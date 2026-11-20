import { shared } from '../shared.js';
import { $, clickData, setRange } from '../util.js';
import { st } from '../state.js';
import { dotN } from '../geometry/common.js';
import { SHAPES, makeDuo } from '../geometry/polytopes.js';
import { HD_MAKE } from '../geometry/higher-dim.js';
import { WY_STOPS, makeMorph } from '../geometry/wythoff.js';
import { HOME, pivot } from '../render/scene.js';
import { setStereo } from '../render/stereo.js';
import { setZoomZ, vel } from '../input/orbit.js';
import { getBuild, stageStart } from '../modes/build.js';
import { newPing } from '../modes/ping.js';
import { notAvail, updateCellLabel, updateEuler, updateFaceNote, updateLabels } from './text.js';
import { resetBuild, resetUnfold, segClick, setMode, setNet, setSeg, shapeChanged, sliceHome, syncAngles, togglePlay, unfLabel } from './controls.js';

// ---------- Learn: live Euler check and Try-it buttons ----------
   // the cousins' knife: same fraction of their own depth


$('lt-euler').addEventListener('toggle', updateEuler); $('g-learn').addEventListener('toggle', updateEuler);
document.querySelectorAll('.btn.try').forEach(b=>b.addEventListener('click', ()=>{ const [shape,mode,extra]=b.dataset.try.split('|');
  document.querySelector(`.shapes [data-s="${shape}"]`).click(); setMode(mode);
  if (extra==='vert') document.querySelector('#knifeDir [data-k="vert"]').click();
  if (['b4','a4','f4','h4'].includes(extra)){ document.querySelector(`#morphFam [data-f="${extra}"]`).click(); if (!morphAnim) $('morphPlay').click(); }
  if (extra==='vfig') showVertexFigure();
  if (extra==='double'){ document.querySelector('[data-y="double"]').click(); }
  if (window.innerWidth<=820) window.scrollTo({top:0, behavior:'smooth'}); }));
$('morphS').addEventListener('input', ()=>applyMorph(false));

$('morphS').addEventListener('change', ()=>applyMorph(true));
$('morphFam').querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{ morphFam=b.dataset.f; setSeg($('morphFam'), b); applyMorph(true); }));
const morphStep = d => { const el=$('morphS'), v=+el.value, t=d>0 ? Math.floor(v*2+1e-6)/2+0.5 : Math.ceil(v*2-1e-6)/2-0.5; el.value=Math.max(0,Math.min(3,t)); applyMorph(true); };
$('morphPrev').addEventListener('click', ()=>morphStep(-1)); $('morphNext').addEventListener('click', ()=>morphStep(1));
$('morphPlay').addEventListener('click', ()=>{ morphAnim=!morphAnim; $('morphPlay').textContent=morphAnim?'Stop animating':'Animate'; });
export let morphFam='b4', morphAnim=false; shared.morphDir = 1; shared.morphT = 0;
export function applyMorph(full){ const s=+$('morphS').value; SHAPES.morph=makeMorph(morphFam, s); $('morphO').textContent=s.toFixed(2);
  $('morphNote').textContent=`${SHAPES.morph.name}: ${SHAPES.morph.verts.length.toLocaleString()} corners, ${SHAPES.morph.edges.length.toLocaleString()} edges. Stops: ${WY_STOPS[morphFam].map(x=>x.replace(/ \(.*\)/,'')).filter((x,i,a)=>a.indexOf(x)===i).join(' · ')}.`;
  if (st.shape!=='morph') return;
  if (full || st.mode==='explore' || st.mode==='ping') shapeChanged(true); else updateLabels(); }

$('hd').addEventListener('input', e=>{ const n=+e.target.value; $('hdo').textContent=n+'D'; SHAPES[st.shape]=HD_MAKE[st.shape](n); st.hdA=0;
  $('hdnote').textContent=SHAPES[st.shape].note; shapeChanged(); });
for (const id of ['dp','dq']) $(id).addEventListener('input', ()=>{ $('dpo').textContent=$('dp').value; $('dqo').textContent=$('dq').value;
  SHAPES.d=makeDuo(+$('dp').value, +$('dq').value); shapeChanged(); });
for (const k of ['xy','xw','yw','zw']){
  $(k).addEventListener('input', e=>{ st[k]=+e.target.value; $(k+'o').textContent=Math.round(st[k])+'°'; });
  $(k).addEventListener('pointerdown', ()=>{ if (st.spin) togglePlay(); });
}
$('speed').addEventListener('input', e=>{ st.speed=+e.target.value; $('speedo').textContent=st.speed.toFixed(1)+'×'; });
$('thk').addEventListener('input', e=>{ st.thk=+e.target.value; $('thko').textContent=st.thk.toFixed(1)+'×'; });
$('conf').addEventListener('change', e=>{ st.conf=e.target.checked; });

$('play').addEventListener('click', togglePlay);

// Reset view: everything about how the shape is shown goes back to how the page starts (the shape and the colours stay)
function setCheckP(id, on){ const e=$(id); if (e && e.checked!==!!on) e.click(); }
export function resetAll(){
  st.hdA=0; for (const k of ['xy','xw','yw','zw']) st[k]=0; syncAngles();
  pivot.quaternion.setFromEuler(HOME); setZoomZ(8.5); vel.x=vel.y=0; shared.fitScale=null;
  clickData('#spinstyle','y','tumble'); if (st.spin) togglePlay(); st.turnHold=false;   // Reset view stops all motion, like the Fractal Explorer
  setRange('speed',0.6); setRange('turn',0); setRange('thk',0.4); setCheckP('conf',1);
  clickData('#edgemode','e','straight'); clickData('#proj','p','persp'); setStereo('off',0.08);
  setCheckP('faceFillChk',0); setCheckP('hl',0); st.cell=0; updateCellLabel();
  if (morphAnim) $('morphPlay').click();
  // slice
  clickData('#knifeDir','k','free'); shared.knifeAnim=null; setCheckP('sweep',0); setCheckP('sliceSpin',0); setCheckP('sliceFillChk',1); shared.vfigOn=false;
  $('vfNote').textContent='One click: a corner faces the knife and the knife stops just inside it.'; sliceHome();
  // build, unfold, ping
  if (st.mode==='build' && !notAvail()) resetBuild();
  if (shared.netSeed) setNet(0); if (st.mode==='unfold' && !notAvail()) resetUnfold();
  setRange('pingSpd',0.6); clickData('#pingstyle','ps','stay'); setCheckP('pingAuto',1); setCheckP('pingBack',1);
  if (st.mode==='ping'){ newPing(); st.ping.playing=true; $('pingPlay').textContent='Pause'; }
  shared.lastCap=''; updateLabels(); }
$('reset').addEventListener('click', resetAll);
$('hl').addEventListener('change', e=>{ st.hl=e.target.checked; updateCellLabel(); });
$('cellPrev').addEventListener('click', ()=>{ st.cell--; updateCellLabel(); });
$('cellNext').addEventListener('click', ()=>{ st.cell++; updateCellLabel(); });
$('cousin').addEventListener('change', e=>{ st.cousin=e.target.checked; });
$('shadowchk').addEventListener('change', e=>{ st.shadow2d=e.target.checked; });
$('slicechk').addEventListener('change', e=>{ st.sliceview=e.target.checked; });
$('sliceSpin').addEventListener('change', e=>{ st.sliceSpin=e.target.checked; });
$('sliceFillChk').addEventListener('change', e=>{ st.sliceFill=e.target.checked; });
document.querySelectorAll('#stereo button').forEach(b=>b.addEventListener('click', ()=>setStereo(b.dataset.st)));
$('eye').addEventListener('input', e=>{ shared.eyeSep=+e.target.value; $('eyeo').textContent=shared.eyeSep.toFixed(2); });
$('faceFillChk').addEventListener('change', e=>{ st.faceFill=e.target.checked; updateFaceNote(); });

$('flatchk').addEventListener('change', e=>{ st.flat2d=e.target.checked; });
$('pingNew').addEventListener('click', ()=>{ newPing(); st.ping.playing=true; $('pingPlay').textContent='Pause'; });
$('pingPlay').addEventListener('click', ()=>{ st.ping.playing=!st.ping.playing; $('pingPlay').textContent=st.ping.playing?'Pause':'Play'; });
$('pingAuto').addEventListener('change', e=>{ st.ping.auto=e.target.checked; });
$('pingBack').addEventListener('change', e=>{ st.ping.back=e.target.checked; });
segClick('pingstyle', d=>{ st.ping.style=d.ps; shared.lastCap=''; $('pingBackRow').hidden = d.ps!=='stay';
  $('pingnote').textContent = d.ps==='echo'
    ? 'Echo: each ring lights up as the pulse arrives, then fades as the next ring lights, so a single wave of light travels across the shape like a ripple.'
    : 'Stay lit: every corner the pulse reaches stays on, so the lit region grows until the whole shape glows. With unlighting on, a wave of darkness then starts from the same corner and follows the light outward along the same paths.'; });
$('pingSpd').addEventListener('input', e=>{ const T=st.ping.t/st.ping.step; st.ping.step=+e.target.value; st.ping.t=T*st.ping.step; $('pingo').textContent=st.ping.step.toFixed(2).replace(/0$/,'')+' s per step'; });
$('knife').addEventListener('input', e=>{ st.knifeU=+e.target.value/100; if (e.isTrusted) shared.vfigOn=false; if (st.sweep){ st.sweep=false; $('sweep').checked=false; } });
$('sweep').addEventListener('change', e=>{ st.sweep=e.target.checked; if (st.sweep) st.sweepT=Math.asin(Math.max(-1,Math.min(1,st.knifeU))); });
$('buildStages').addEventListener('click', e=>{ const btn=e.target.closest('button'); if (!btn) return; const b=getBuild(), k=+btn.dataset.k;
  st.build.t=stageStart(b,k)+b.stages[k].ext+0.01; st.build.playing=false; $('buildPlay').textContent='Play'; });
$('buildPlay').addEventListener('click', ()=>{
  st.build.playing=!st.build.playing; $('buildPlay').textContent=st.build.playing?'Pause':'Play'; });
$('buildReplay').addEventListener('click', ()=>{ st.build.t=0; st.build.playing=true; $('buildPlay').textContent='Pause'; });
$('unf').addEventListener('input', e=>{ const v=+e.target.value/100; st.unf.u=Math.min(1,v); st.unf.f=Math.max(0,v-1); unfLabel(); st.unf.playing=false; $('unfPlay').textContent='Play'; });
$('unfPlay').addEventListener('click', ()=>{ st.unf.playing=!st.unf.playing;
  if (st.unf.playing){ // resume the cycle from the current position
    const u=st.unf.u, f=st.unf.f; st.unf.t = f>0 ? (f>=0.999 ? 9.5 : 5.5+4*Math.acos(1-2*f)/Math.PI) : (u>=0.999 ? 4 : 4*Math.acos(1-2*u)/Math.PI); }
  $('unfPlay').textContent=st.unf.playing?'Pause':'Play'; });
const UNF_PERIOD=22, ease=x=>(1-Math.cos(Math.PI*Math.max(0,Math.min(1,x))))/2;
export function unfCurve(t){ const x=t%UNF_PERIOD;   // 4D→3D, pause, 3D→2D, pause, back to 3D, pause, fold back into 4D, pause
  if (x<4) return [ease(x/4),0]; if (x<5.5) return [1,0]; if (x<9.5) return [1,ease((x-5.5)/4)]; if (x<11.5) return [1,1];
  if (x<15.5) return [1,1-ease((x-11.5)/4)]; if (x<16.5) return [1,0]; if (x<20.5) return [1-ease((x-16.5)/4),0]; return [0,0]; }
export const wrap=a=>((a+180)%360+360)%360-180;

shared.vfigOn = false;
function showVertexFigure(){
  const sh=SHAPES[st.shape]; if (sh.round || sh.highD || sh.star || sh.compound || notAvail()){ $('vfNote').textContent='Vertex figures need a shape with flat cells and corners.'; return; }
  if (st.mode!=='slice') setMode('slice');
  document.querySelector('#knifeDir [data-k="vert"]').click(); if (st.sweep) $('sweep').click();
  const V=sh.verts, v0=V[0], L=Math.hypot(...v0), d=V.map(v=>dotN(v,v0)/L), top=d[0];
  let second=-Infinity, lo=Infinity; d.forEach((x,i)=>{ if (i && x<top-1e-6 && x>second) second=x; if (x<lo) lo=x; });
  const W=top-0.4*(top-second), mid=(top+lo)/2, half=(top-lo)/2;   // 40% of the way down to the next layer of corners
  st.knifeU=(W-mid)/half; $('knife').value=Math.round(st.knifeU*100); shared.vfigOn=true;
  $('vfNote').textContent='The knife sits just inside one corner. The small solid it cuts out shows how the cells meet at that corner: that\'s the vertex figure.'; }
$('vfBtn').addEventListener('click', showVertexFigure);
