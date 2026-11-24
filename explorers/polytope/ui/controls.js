import * as THREE from 'three';
import { shared } from '../shared.js';
import { $ } from '../util.js';
import { st } from '../state.js';
import { PALETTES, css } from '../render/colour.js';
import { colourControls } from '../../../js/common/colours.js';
import { SHAPES } from '../geometry/polytopes.js';
import { STAR_LIST } from '../geometry/star-list.js';
import { STAR_SYM } from '../geometry/ustar.js';
import { HD_MAX } from '../geometry/higher-dim.js';
import { FINISH, HOME, canvas, mainLayer, pingLayer, pivot, renderer, sliceLayer } from '../render/scene.js';
import { renderView } from '../render/stereo.js';
import { capsFor, kissOK } from '../render/packing.js';
import { foamOK } from '../render/foam.js';
import { vel } from '../input/orbit.js';
import { toggleFly } from '../input/fly.js';
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
  st.paused=false;
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
colourControls(palBox);
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
export const shapeBtns=[...document.querySelectorAll('.shapes button[data-s]')];
// Every uniform shape: one list per family of mirrors, chosen by the tabs; the regular shapes there stand in for their
// buttons at the top (data-alias), and the tab follows whatever shape is chosen, however it was chosen
const uniTab=f=>{ document.querySelectorAll('#uniFam button').forEach(x=>x.classList.toggle('on', x.dataset.u===f));
  document.querySelectorAll('.uniList').forEach(l=>{ l.hidden = l.dataset.u!==f; if (!l.hidden) $('uniNote').textContent=l.dataset.note; }); };
$('uniFam').addEventListener('click', e=>{ const b=e.target.closest('button'); if (b) uniTab(b.dataset.u); });
document.querySelectorAll('.uniList [data-alias]').forEach(a=>a.addEventListener('click', ()=>document.querySelector(`.shapes button[data-s="${a.dataset.alias}"]`).click()));
// the current shape's mirror diagram: four mirrors in a row, the angles between neighbours (3 is left unwritten, as usual),
// and a ring round each mirror the point stands off from
const UNI_M={ a4:[3,3,3], b4:[4,3,3], f4:[3,4,3], h4:[5,3,3] };
const PAIRS=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
function uniDiagram(){ const sh=SHAPES[st.shape], el=$('uniDia'), u=sh && sh.uni, d=sh && st.shape==='ustar' ? sh.dia : null; el.hidden=!u && !d; if (el.hidden) return;
  const lab = d ? d.lab : (m=>[m[0],2,2,m[1],2,m[2]].map(String))(UNI_M[u.fk]), R=[...(d ? d.rings : u.rings)].map(Number);
  const links=PAIRS.map((p,k)=>[p,lab[k]]).filter(([,x])=>x!=='2'), deg=[0,1,2,3].map(i=>links.filter(([p])=>p.includes(i)).length);
  let pos;
  if (links.length===3 && Math.max(...deg)<=2){ const order=[deg.indexOf(1)]; while (order.length<4){ const a=order[order.length-1], n=links.map(([p])=>p).find(p=>p.includes(a) && !order.includes(p[0]+p[1]-a)); order.push(n[0]+n[1]-a); }
    pos=[]; order.forEach((n,i)=>{ pos[n]=[22+i*56, 30]; }); }
  else pos=[[40,14],[172,14],[172,52],[40,52]];
  const H=pos.some(p=>p[1]>40) ? 62 : 44, ring=R.map((r,i)=>r?i+1:0).filter(Boolean);
  el.innerHTML=`<svg viewBox="0 0 212 ${H}" width="212" height="${H}" role="img" aria-label="Mirror diagram: ${links.map(([p,x])=>`mirrors ${p[0]+1} and ${p[1]+1} at ${x}`).join(', ')}; ringed: ${ring.join(', ')}" style="display:block;color:var(--text)">`
    +links.map(([[a,b],x])=>{ const [x1,y1]=pos[a], [x2,y2]=pos[b], mx=(x1+x2)/2, my=(y1+y2)/2, ly = y1===y2 ? my-7 : my, lx = y1===y2 ? mx : mx+(x1===x2 ? 12 : 0);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.5"/>${x!=='3'?`<text x="${lx}" y="${ly}" fill="currentColor" font-size="12" text-anchor="middle" dominant-baseline="${y1===y2?'auto':'middle'}" paint-order="stroke" stroke="var(--panel)" stroke-width="4">${x}</text>`:''}`; }).join('')
    +R.map((r,i)=>`<circle cx="${pos[i][0]}" cy="${pos[i][1]}" r="4.5" fill="currentColor"/>${r?`<circle cx="${pos[i][0]}" cy="${pos[i][1]}" r="9" fill="none" stroke="var(--accent)" stroke-width="2"/>`:''}`).join('')+'</svg>'; }
// the star uniform shapes: one shape ("ustar") stepped through the list, optionally only those with one symmetry
let ustarSym=0;
const ustarIdx=()=>STAR_LIST.map((r,i)=>[r,i]).filter(([r])=>!ustarSym || r[2]===ustarSym).map(([,i])=>i);
function ustarShow(){ const L=ustarIdx(), k=L.indexOf(st.ustar); $('ustarPos').textContent = k<0 ? `${L.length} shapes` : `${k+1} of ${L.length}${ustarSym ? ` with the ${STAR_SYM[ustarSym]}\u2019s symmetry` : ''}`; }
function ustarSet(i){ st.ustar=i; ustarShow(); if (st.shape==='ustar'){ shapeChanged(true); uniDiagram(); } }
function ustarStep(d){ const L=ustarIdx(); if (!L.length) return; const k=L.indexOf(st.ustar); ustarSet(L[k<0 ? 0 : (k+d+L.length)%L.length]); }
$('ustarPrev').addEventListener('click', ()=>ustarStep(-1)); $('ustarNext').addEventListener('click', ()=>ustarStep(1));
$('ustarSym').addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; ustarSym=+b.dataset.y; $('ustarSym').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
  if (!ustarIdx().includes(st.ustar)) ustarStep(0); else ustarShow(); });
function uniSync(){ document.querySelectorAll('.uniList [data-alias]').forEach(a=>a.classList.toggle('on', a.dataset.alias===st.shape)); uniDiagram();
  const b=document.querySelector(`.uniList [data-s="${st.shape}"], .uniList [data-alias="${st.shape}"]`); if (b) uniTab(b.closest('.uniList').dataset.u); }
uniSync();
shapeBtns.forEach(b=>b.addEventListener('click', ()=>{ st.shape=b.dataset.s; shapeBtns.forEach(x=>x.classList.toggle('on', x===b)); uniSync();
  $('duo').hidden = st.shape!=='d'; $('morphRow').hidden = st.shape!=='morph'; $('ustarRow').hidden = st.shape!=='ustar'; if (st.shape==='ustar') ustarShow(); syncRoundRow(); syncHdRow(); syncDrawAs(); shapeChanged(); }));
function syncRoundRow(){ const sh=SHAPES[st.shape]; $('roundRow').hidden=!sh.round; if (!sh.round) return; $('rdet').value=sh.detail||3; $('rdeto').textContent=sh.detail||3;
  $('packView').hidden=!sh.packing; $('packView').querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.pv===st.packView));
  $('rdetNote').textContent = sh.packing ? `${sh.gens} round${sh.gens===1?'':'s'} of filling: ${sh.verts.length.toLocaleString()} balls touching at ${sh.edges.length.toLocaleString()} points. Always shown in stereographic projection, the only one that keeps balls round.`
    : (st.shape==='hopf' ? `${sh.nRings} rings of circles, ${sh.fiberInfo.length} circles in all` : `${sh.verts.length.toLocaleString()} mesh points, ${sh.edges.length.toLocaleString()} lines`)+'. More detail draws more of the surface.'; }
// Draw as: edges, touching balls at the corners, or bubble foam (the faces as curved soap films)
export function syncDrawAs(){ const sh=SHAPES[st.shape], el=$('drawAsNote'); $('drawAs').querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.da===st.drawAs));
  if (sh.packing){ el.textContent='The Apollonian packing has its own choice under Shapes: balls, or the touching points joined up.'; return; }
  if (st.drawAs==='edges'){ el.textContent='Corners joined by edges: the usual picture.'; return; }
  if (!(st.drawAs==='foam' ? foamOK(sh) : kissOK(sh))){ el.textContent=`Not available for the ${sh.name}: ${sh.round||sh.highD ? 'it is not made of corners on the 3-sphere' : st.drawAs==='foam' ? 'it has no flat faces, or too many' : 'it has too many corners'}. Showing edges.`; return; }
  if (st.drawAs==='balls'){ capsFor(sh); const k=Math.round(sh._kissN*10)/10;
    el.textContent=`A ball at each of the ${sh.verts.length.toLocaleString()} corners, just big enough to touch its nearest neighbours (each touches ${k}). Always stereographic, which keeps every ball round; the ball holding the projection point becomes the glass container, so turning in 4D turns it inside out. Try the 24-cell (each ball touches 8) or the 600-cell (each touches 12). Pick Bubble under Colour & style to see through them.`; return; }
  el.textContent='Every flat face becomes part of a sphere in stereographic projection, so the shape turns into a cluster of soap bubbles stuck together. Try the 120-cell: 120 bubbles. Pick Bubble under Colour & style for rainbow films.'; }
$('drawAs').addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; st.drawAs=b.dataset.da; syncDrawAs(); shapeChanged(true); });
syncDrawAs();
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

$('flyBtn').addEventListener('click', ()=>{ toggleFly(); st.paused=false; });   // the same as G
