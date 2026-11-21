import * as THREE from 'three';
import { shared } from '../shared.js';
import { $ } from '../util.js';
import { st } from '../state.js';
import { PALETTES, css } from '../render/colour.js';
import { SHAPES } from '../geometry/polytopes.js';
import { HD_MAX } from '../geometry/higher-dim.js';
import { FINISH, HOME, canvas, mainLayer, pingLayer, pivot, renderer, sliceLayer } from '../render/scene.js';
import { renderView } from '../render/stereo.js';
import { vel } from '../input/orbit.js';
import { I4, KNIFE_NOTES, KNIFE_TURN, knifeNow, newPing } from '../modes/ping.js';
import { panelFit } from '../panels/extra-panels.js';
import { notAvail, refreshColours, updateCellLabel, updateLabels } from './text.js';
import { dlNote, downloads, exportBtn, updatePrintNote } from '../io/export.js';

// ---------- UI wiring ----------
export function setSeg(group, el){ group.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===el)); }
export function segClick(id, fn){ $(id).addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; setSeg($(id), b); fn(b.dataset); }); }
export function syncAngles(){ for (const k of ['xy','xw','yw','zw']){ $(k).value=st[k]; $(k+'o').textContent=Math.round(st[k])+'°'; } }
export function resetBuild(){ st.build.t=0; st.build.playing=true; $('buildPlay').textContent='Pause'; shared.fitScale=null; }
export function unfLabel(){ const v=st.unf.u+st.unf.f; $('unf').value=Math.round(v*100);
  $('unfo').textContent = st.unf.f>0 ? `3D → 2D: ${Math.round(st.unf.f*100)}%` : `4D → 3D: ${Math.round(st.unf.u*100)}%`; }
export function resetUnfold(){ st.unf.t=0; st.unf.u=0; st.unf.f=0; st.unf.playing=true; $('unfPlay').textContent='Pause'; unfLabel(); shared.fitScale=null; }
export function shapeChanged(keepView){ shared.vfigOn=false; if (st.mode==='slice' && !keepView) sliceHome(); st.cell=0; shared.fitScale=null; shared.sliceCen=null; panelFit.slice=null; const na=notAvail(); if (st.mode==='build' && !na) resetBuild(); if (st.mode==='unfold' && !na) resetUnfold(); if (st.mode==='ping') newPing(); shared.lastCap=''; updateCellLabel(); refreshColours(); updateLabels(); }
export function setMode(m){
  st.mode=m; setSeg($('modes'), document.querySelector(`#modes [data-m="${m}"]`));
  document.querySelectorAll('[data-show]').forEach(el=>el.hidden=!el.dataset.show.split(' ').includes(m));
  document.querySelectorAll('details.grp').forEach(g=>{ const secs=g.querySelectorAll(':scope > .gb > .sec, :scope > .gb > .explain'); g.hidden = ![...secs].some(s=>!s.hidden); });
  $('g-ctl').querySelector('.gt').textContent = ({explore:'Explore',build:'Build up',slice:'Slice',unfold:'Unfold',ping:'Ping'}[m]||'')+' controls';
  const na=notAvail(m);
  if (m==='build' && !na){ resetBuild(); }
  if (m==='unfold' && !na){ resetUnfold(); }
  if (m==='ping'){ newPing(); st.ping.playing=true; $('pingPlay').textContent='Pause'; }
  if (m==='slice') sliceHome();
  exportBtn.textContent = m==='slice' ? 'Download slice STL (.zip)' : m==='unfold' ? 'Download net STL (.zip)' : 'Download STL (.zip)';
  shared.fitScale=null; shared.sliceCen=null; panelFit.slice=null; shared.lastCap=''; refreshColours(); updateLabels();
}
segClick('modes', d=>setMode(d.m));
const palBox=$('palettes');
for (const [name, stops] of Object.entries(PALETTES)){
  const b=document.createElement('button'); b.dataset.pal=name; b.title=name.replace('_',' & ').replace(/^./,c=>c.toUpperCase()); b.style.background=`linear-gradient(90deg,${stops.map(css).join(',')})`;
  if (name===st.palette) b.classList.add('on');
  b.addEventListener('click', ()=>{ st.palette=name; palBox.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b)); palLabel(); refreshColours(); });
  palBox.appendChild(b);
}
function palLabel(){ const b=palBox.querySelector('button.on'); $('palName').textContent='Palette: '+(b?b.title:'')+(st.palRev?' (reversed)':''); }
palLabel();
$('palRev').addEventListener('change', e=>{ st.palRev=e.target.checked; refreshColours(); palLabel(); });
$('cyc').addEventListener('input', e=>{ st.cycleSpeed=+e.target.value; $('cyco').textContent=st.cycleSpeed?st.cycleSpeed.toFixed(1)+'×':'off'; if (!st.cycleSpeed) refreshColours(); });
$('dens').addEventListener('input', e=>{ st.density=+e.target.value; $('denso').textContent=st.density.toFixed(1)+'×'; refreshColours(); });
segClick('cmode', d=>{ st.cmode=d.c; refreshColours(); });
segClick('finish', d=>{ st.finish=d.f; shared.tubeMat=FINISH[d.f].tube; shared.ballMat=FINISH[d.f].ball; mainLayer.setMaterials(shared.tubeMat,shared.ballMat); sliceLayer.setMaterials(shared.tubeMat,shared.ballMat); pingLayer.setMaterials(shared.tubeMat,shared.ballMat); });
segClick('bg', d=>{ st.bg=d.b; renderer.setClearColor(new THREE.Color(st.bg)); refreshColours(); });
segClick('edgemode', d=>{ st.edges=d.e; });
segClick('proj', d=>{ st.proj=d.p; updateLabels(); });
segClick('sizes', d=>{ st.mm=+d.mm; updatePrintNote(); });
segClick('spinstyle', d=>{ st.spinStyle=d.y;
  $('spinnote').textContent = d.y==='double'
    ? 'Double rotation spins two separate planes, XY and ZW, at the same speed. Every point moves in a circle at the same rate and nothing stays still: no axis at all, which is impossible in 3D.'
    : 'Tumble turns the shape through the XW and ZW planes at different speeds.';
  if (!st.spin) togglePlay(); });
$('snap').addEventListener('click', ()=>{ if (!downloads) return; renderView();
  canvas.toBlob(async blob=>{ try { await downloads.save({ filename:`${(st.mode==='explore'||st.mode==='slice'?SHAPES[st.shape].name:'tesseract-'+st.mode).toLowerCase().replace(/\W+/g,'-')}.png`, data:blob }); }
    catch(e){ if (!e || e.code!=='declined') dlNote.textContent='Couldn\'t save the image.'; } }, 'image/png'); });
export const shapeBtns=[...document.querySelectorAll('.shapes button')];
shapeBtns.forEach(b=>b.addEventListener('click', ()=>{ st.shape=b.dataset.s; shapeBtns.forEach(x=>x.classList.toggle('on', x===b));
  $('duo').hidden = st.shape!=='d'; $('morphRow').hidden = st.shape!=='morph'; syncRoundRow(); syncHdRow(); shapeChanged(); }));
function syncRoundRow(){ const sh=SHAPES[st.shape]; $('roundRow').hidden=!sh.round; if (!sh.round) return; $('rdet').value=sh.detail||3; $('rdeto').textContent=sh.detail||3;
  $('packView').hidden=!sh.packing; $('packView').querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.pv===st.packView));
  $('rdetNote').textContent = sh.packing ? `${sh.gens} round${sh.gens===1?'':'s'} of filling: ${sh.verts.length.toLocaleString()} balls touching at ${sh.edges.length.toLocaleString()} points. Always shown in stereographic projection, the only one that keeps balls round.`
    : (st.shape==='hopf' ? `${sh.nRings} rings of circles, ${sh.fiberInfo.length} circles in all` : `${sh.verts.length.toLocaleString()} mesh points, ${sh.edges.length.toLocaleString()} lines`)+'. More detail draws more of the surface.'; }
$('packView').addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; st.packView=b.dataset.pv; syncRoundRow(); shapeChanged(true); });
$('rdet').addEventListener('input', e=>{ const sh=SHAPES[st.shape]; if (!sh.round || !sh.remake) return; sh.remake(+e.target.value); syncRoundRow(); shapeChanged(true); });
$('knifeDir').querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{ if (b.dataset.k!==shared.knifeDir) shared.knifeAnim={from:knifeNow||I4, t:0}; shared.knifeDir=b.dataset.k; setSeg($('knifeDir'), b); $('knifeNote').textContent=KNIFE_NOTES[shared.knifeDir]+KNIFE_TURN;
  if (shared.knifeDir!=='free' && st.spin && $('sliceSpin').checked) $('sliceSpin').click();
  sliceHome(); }));
export function setNet(s){ shared.netSeed=s; $('netNote').textContent = s ? `Net ${s+1}: a different centre cell, with the cells glued on in a different order. Every choice of which faces stay joined gives a different net. The tesseract alone has 261.` : 'Net 1: the standard one, grown outward from the biggest cell.'; shared.lastCap=''; shared.fitScale=null; updateLabels(); }
$('netNext').addEventListener('click', ()=>setNet(shared.netSeed+1));
$('netStd').addEventListener('click', ()=>setNet(0));
function syncHdRow(){ const sh=SHAPES[st.shape]; $('hdRow').hidden=!sh.highD; if (!sh.highD) return;
  $('hd').max=HD_MAX[st.shape]; $('hd').value=sh.n; $('hdo').textContent=sh.n+'D'; $('hdnote').textContent=sh.note; }
export function togglePlay(){ st.spin=!st.spin; st.turnHold=!st.spin; $('play').textContent=st.spin?'Pause spin':'Resume spin'; }
export function sliceHome(){   // Slice always starts the same way: no 4D turn, the home camera angle, and the knife at the end that meets the shape first
  st.hdA=0; for (const k of ['xy','xw','yw','zw']) st[k]=0; syncAngles(); pivot.quaternion.setFromEuler(HOME); vel.x=vel.y=0;
  st.sweepT=Math.PI/2; st.knifeU=1; $('knife').value=100; shared.sliceCen=null; panelFit.slice=null; shared.fitScale=null; }
