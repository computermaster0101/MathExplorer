import { shared } from '../shared.js';
import { $, clamp } from '../util.js';
import { ptrs, st, toMath } from '../state.js';
import { glc } from '../render/webgl.js';
import { cssH, cssW, moveCentre, panBy, toOff, toWorld, touch, viewDescs, zoomAt } from '../view.js';
import { notAvail } from '../ui/notice.js';
import { d3Bound, d3MinDist, pan3, tap3 } from '../modes/fractal3d.js';
import { newOrbit } from '../modes/orbit.js';
import { touchTapping, recentTouch } from '../../../js/shell/layout.js';

// ---------- pointers ----------
 let lastMid=null, lastPinch=0, dragDesc=null; shared.vel3 = {x:0,y:0}; let downAt=null;
// two fingers twisting turn the 2D picture round the point between them (after a 10° dead zone, so a pinch doesn't wobble it); the Rotate slider follows
let lastAng=null, twistSum=0, twisting=false;
function twistAt(da, x, y){ const d=descAt(x,y), a=toOff(d,x,y); d.v.rot+=da; const b=toOff(d,x,y); moveCentre(d.v, a[0]-b[0], a[1]-b[1]);
  const deg=((st.rotDeg+da*180/Math.PI+180)%360+360)%360-180; st.rotDeg=deg; $('rot').value=Math.round(deg); $('roto').textContent=Math.round(deg)+'°'; touch(); }
// on the Julia link screen a double tap (or double click) on the Julia side opens it full screen
let linkTap=0; const openLink=()=>{ linkTap=0; $('linkOpen').click(); };
// turning round the point you're looking at (3D)
function turn3(dx,dy){ st.d3.aim=null; st.d3.yaw-=dx*0.008; st.d3.pitch=clamp(st.d3.pitch+dy*0.008,-1.45,1.45); shared.vel3={x:dx,y:dy}; touch(); }
function descAt(x,y){ return viewDescs().find(d=>x>=d.x&&x<=d.x+d.w&&y>=d.y&&y<=d.y+d.h) || viewDescs()[0]; }
function setCFrom(d,x,y){ const w=toWorld(d,x,y); st.jc=toMath(st.type,w); st.link.auto=false; $('linkAuto').checked=false; touch(); }
glc.addEventListener('pointerdown', e=>{
  glc.setPointerCapture(e.pointerId); st.hover=null; ptrs.set(e.pointerId,{x:e.offsetX,y:e.offsetY}); downAt={x:e.offsetX,y:e.offsetY,t:e.timeStamp};
  if (ptrs.size===1){ dragDesc=descAt(e.offsetX,e.offsetY); if (st.mode==='link' && dragDesc.side==='L' && !notAvail()) setCFrom(dragDesc,e.offsetX,e.offsetY); if (st.fly && st.endlessRun){ st.fly=null; st.dive=true; } else st.fly=null; } touch(); });
glc.addEventListener('pointermove', e=>{
  const x=e.offsetX, y=e.offsetY;
  if (!ptrs.has(e.pointerId)){ if (st.mode==='explore' && e.pointerType==='mouse'){ st.hover=[x,y]; } return; }
  const prev=ptrs.get(e.pointerId); ptrs.set(e.pointerId,{x,y}); const dx=x-prev.x, dy=y-prev.y;
  if (ptrs.size===1){
    /* mouse: dragging does the Dragging setting, Shift- or right-drag the other; touch: one finger looks around (with Move chosen) and two fingers move */
    if (st.mode==='d3'){ if ((st.d3.dragMode==='move') !== (e.shiftKey || !!(e.buttons&2) || e.pointerType==='touch')) pan3(dx,dy); else turn3(dx,dy); }
    else if (st.mode==='grow'){ st.grow.gv.ox+=dx; st.grow.gv.oy+=dy; }
    else if (st.mode==='link' && dragDesc && dragDesc.side==='L'){ if (!notAvail()) setCFrom(dragDesc,x,y); }
    else if (dragDesc){ panBy(dragDesc,dx,dy); }
  } else if (ptrs.size===2){ const [a,b]=[...ptrs.values()], d=Math.hypot(a.x-b.x,a.y-b.y), mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    if (lastMid){ const ddx=mx-lastMid[0], ddy=my-lastMid[1]; if (st.mode==='d3'){ if (st.d3.dragMode==='move') pan3(ddx,ddy); else turn3(ddx,ddy); }   /* two fingers do the Dragging setting (and pinch moves closer) */ else if (st.mode==='grow'){ st.grow.gv.ox+=ddx; st.grow.gv.oy+=ddy; } else if (!(st.mode==='link' && dragDesc && dragDesc.side==='L')) panBy(descAt(mx,my),ddx,ddy); }
    const ang=Math.atan2(b.y-a.y, b.x-a.x);
    if (lastAng!==null && st.mode==='explore' && !notAvail()){ const da=((ang-lastAng+3*Math.PI)%(2*Math.PI))-Math.PI;
      if (twisting) twistAt(da, mx, my); else if (Math.abs(twistSum+=da)>0.17) twisting=true; }
    lastAng=ang; lastMid=[mx,my]; if (lastPinch) zoomBy(lastPinch/d, mx, my); lastPinch=d; }
});
const endP=e=>{ const p=ptrs.get(e.pointerId), zt=e.pointerType==='touch' && touchTapping();   /* in full screen a touch tap pauses (the shell): no tap actions here */ if (e.pointerType==='mouse' && st.mode==='explore') st.hover=[e.offsetX,e.offsetY]; ptrs.delete(e.pointerId); if (ptrs.size<2){ lastPinch=0; lastMid=null; lastAng=null; twistSum=0; twisting=false; }
  if (p && downAt && !zt && st.mode==='d3' && !ptrs.size && Math.hypot(p.x-downAt.x,p.y-downAt.y)<6 && e.timeStamp-downAt.t<450) tap3(p.x,p.y);
  if (p && downAt && !zt && st.mode==='orbit' && Math.hypot(p.x-downAt.x,p.y-downAt.y)<6 && e.timeStamp-downAt.t<600){ const d=viewDescs()[0]; newOrbit(toWorld(d,p.x,p.y)); st.orbit.playing=true; $('orbPlay').textContent='Pause'; }
  if (p && downAt && !zt && st.mode==='explore' && (st.dive||st.endlessRun) && Math.hypot(p.x-downAt.x,p.y-downAt.y)<6 && e.timeStamp-downAt.t<500){
    const d=viewDescs()[0]; st.fly=null; st.dive=true; st.steerTo=toOff(d,p.x,p.y); st.manualT=3; shared.tapMark={x:p.x,y:p.y,t:performance.now()}; }
  if (p && downAt && e.pointerType==='touch' && st.mode==='link' && !ptrs.size && Math.hypot(p.x-downAt.x,p.y-downAt.y)<10 && e.timeStamp-downAt.t<350 && descAt(p.x,p.y).side==='R'){
    const now=performance.now(); if (now-linkTap<400) openLink(); else linkTap=now; }
  if (!ptrs.size){ dragDesc=null; } touch(); };
shared.tapMark = null;
glc.addEventListener('contextmenu', e=>e.preventDefault());
glc.addEventListener('pointerup', endP); glc.addEventListener('pointercancel', endP);
glc.addEventListener('pointerleave', ()=>{ if (!ptrs.size) st.hover=null; });
export function zoomBy(f, x, y){
  if (st.mode==='d3'){ const b=d3Bound(); st.d3.dist=clamp(st.d3.dist*f, st.d3.target?d3MinDist():b*1.02, b*8); touch(); return; }
  if (st.mode==='grow'){ const G=st.grow.gv, nz=clamp(G.z/f,0.2,60), k=nz/G.z, cx=cssW/2, cy=70+(cssH-170)/2; G.ox=x-cx-(x-cx-G.ox)*k; G.oy=y-cy-(y-cy-G.oy)*k; G.z=nz; return; }
  if (notAvail()) return; const d=descAt(x,y); st.fly=null; zoomAt(d,x,y,f); }
glc.addEventListener('wheel', e=>{ e.preventDefault(); zoomBy(Math.exp(e.deltaY*0.0015), e.offsetX, e.offsetY); }, {passive:false});
glc.addEventListener('dblclick', e=>{ if (st.mode==='link' && descAt(e.offsetX,e.offsetY).side==='R'){ openLink(); return; }
  if (recentTouch()) return;   /* a double tap is full screen (the shell), not a zoom */ if (st.mode==='explore' || st.mode==='orbit' || false){ const d=descAt(e.offsetX,e.offsetY); zoomAt(d,e.offsetX,e.offsetY,e.shiftKey?2:0.5); } });
