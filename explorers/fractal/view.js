import { shared } from './shared.js';
import { clamp } from './util.js';
import { ddAdd } from './math/double-double.js';
import { FIXB, centreDiff, computeRefBig, dblToFix } from './math/big-fixed.js';
import { PHX, TYPES } from './fractals/types.js';
import { fitV, isExt, juliaView, st, toMath, view } from './state.js';
import { escR2, startZ, stepFn } from './fractals/iterate.js';
import { glc, ovc, refSlots, upRef } from './render/webgl.js';

// ---------- views & mapping ----------
export let cssW=800, cssH=600, bufScale=1, ovScale=1;
export const baseDpr=()=>Math.min(window.devicePixelRatio||1,2);
shared.dirty = true; let hqDone=false, lastChange=0;
export function touch(){ shared.dirty=true; hqDone=false; lastChange=performance.now(); }
/** A colour-only change (palette, reverse, density, colour mode, background): nothing moved, so redraw once at full quality
 * straight away, instead of the softer moving resolution first (that showed as a heavy, blurry flash before it sharpened). */
export function recolour(){ shared.recol=true; touch(); }
export function sizeBuffers(){
  const r=glc.parentElement.getBoundingClientRect(); cssW=Math.max(1,r.width); cssH=Math.max(1,r.height);
  const b=baseDpr(); let s= st.mode==='grow' ? 1 : (st.mode==='d3' ? Math.min(b,1.5) : b)*st.q;
  if (shared.recCapH && st.mode!=='grow') s=Math.min(s, shared.recCapH/cssH);   // recording at 720p/1080p: no need to draw more pixels than the video keeps
  const w=Math.max(1,Math.round(cssW*s)), h=Math.max(1,Math.round(cssH*s));
  if (glc.width!==w || glc.height!==h){ glc.width=w; glc.height=h; shared.dirty=true; hqDone=false; }
  bufScale=glc.width/cssW;
  const ow=Math.round(cssW*b), oh=Math.round(cssH*b); if (ovc.width!==ow || ovc.height!==oh){ ovc.width=ow; ovc.height=oh; } ovScale=ow/cssW;
}
export function viewDescs(){
  const T=TYPES[st.type], jv=st.julia||!!T.juliaOnly;
  if (st.mode==='link'){ const wide=cssW>=cssH;
    const a=wide?{x:0,y:0,w:cssW/2,h:cssH}:{x:0,y:0,w:cssW,h:cssH/2}, b=wide?{x:cssW/2,y:0,w:cssW/2,h:cssH}:{x:0,y:cssH/2,w:cssW,h:cssH/2};
    return [Object.assign(a,{v:st.vL, julia:false, slot:0, side:'L'}), Object.assign(b,{v:st.vR, julia:true, slot:1, side:'R'})]; }
  if (st.mode==='orbit') return [{x:0,y:0,w:cssW,h:cssH,v:st.vO,julia:jv,slot:0,dim:true}];
  return [{x:0,y:0,w:cssW,h:cssH,v:st.vE,julia:jv,slot:0}];
}
export function toOff(d,sx,sy){ const px=(sx-d.x-d.w/2)/(d.h/2), py=(d.y+d.h/2-sy)/(d.h/2), c=Math.cos(d.v.rot), s=Math.sin(d.v.rot); return [(c*px-s*py)*d.v.scale, (s*px+c*py)*d.v.scale]; }
export function toWorld(d,sx,sy){ const o=toOff(d,sx,sy); return [d.v.cx+o[0], d.v.cy+o[1]]; }
export function toScreen(d,wx,wy){ const dx=(wx-d.v.cx)/d.v.scale, dy=(wy-d.v.cy)/d.v.scale, c=Math.cos(d.v.rot), s=Math.sin(d.v.rot);
  return [d.x+d.w/2+(c*dx+s*dy)*d.h/2, d.y+d.h/2-(-s*dx+c*dy)*d.h/2]; }
const intPow=()=>Math.abs(st.power-Math.round(st.power))<1e-6;
export const deepT=(type=st.type)=> type===0||type===1||type===2||type===4||type===5||(type===3&&intPow());   // families with a perturbation formula
export const extT=(type=st.type)=> deepT(type) && type!==5;                                                   // ...and with a full-precision reference
export const minScale=(type,julia)=> deepT(type) ? (isExt()&&extT(type) ? 1e-100 : 2e-29) : type===10 ? 0.03 : 3e-6;
export function moveCentre(v, dx, dy){ v.bx=(v.bx??dblToFix(v.cx))+dblToFix(dx); v.by=(v.by??dblToFix(v.cy))+dblToFix(dy); [v.cx,v.lx]=ddAdd([v.cx,v.lx||0],[dx,0]); [v.cy,v.ly]=ddAdd([v.cy,v.ly||0],[dy,0]); }
export function zoomAt(d, sx, sy, f){ const v=d.v, ns=clamp(v.scale*f, minScale(st.type,d.julia), 6); f=ns/v.scale; const o=toOff(d,sx,sy); moveCentre(v, o[0]*(1-f), o[1]*(1-f)); v.scale=ns; touch(); }
export function panBy(d, dx, dy){ const a=toOff(d,0,0), b=toOff(d,dx,dy); moveCentre(d.v, a[0]-b[0], a[1]-b[1]); touch(); }
// while diving, look over a coarse grid near the middle and drift toward the busiest edge, so the dive never ends in a flat colour
export function refShift(slot, c){ return slot.c ? centreDiff(c, slot.c) : [0,0]; }
function escCount(off, iter, base){
  const type=st.type, v=base||st.vE, jv=st.julia;
  if (deepT(type)){ const S=refSlots[0]; if (!S.d64) return -2; const R=S.d64, L=S.len, r0=R[0], i0=R[1], sh=refShift(S,v), J=jv||type===5, n=Math.round(st.power), q=PHX[1];
    off=[off[0]+sh[0], off[1]+sh[1]]; if (type===1) off[1]=-off[1];
    let dr=J?off[0]:0, di=J?off[1]:0, pr=0, pi=0; const cr=J?0:off[0], ci=J?0:off[1]; let k=0;
    const dabs=(c,d)=> c>=0 ? (c+d>=0 ? d : -(2*c+d)) : (c+d>0 ? 2*c+d : -d);
    for (let i=0;i<iter;i++){ const X=R[2*k], Y=R[2*k+1], x=dr, y=di; if ((X+x)*(X+x)+(Y+y)*(Y+y)>1e4) return i; let nr, ni;
      const c1=S.aux?S.aux[k]:(type===1?X*Y:X*X-Y*Y);
      if (type===1){ nr=2*(X*x-Y*y)+x*x-y*y; ni=2*dabs(c1, X*y+x*Y+x*y); }
      else if (type===4){ nr=dabs(c1, 2*(X*x-Y*y)+x*x-y*y); ni=2*(X*y+x*Y+x*y); }
      else if (type===3){ const ar=X+x, ai=Y+y; let sr=1, si=0, br=1, bi=0; for (let j=1;j<n;j++){ const t=br*X-bi*Y; bi=br*Y+bi*X; br=t; const u=sr*ar-si*ai; si=sr*ai+si*ar+bi; sr=u+br; } nr=x*sr-y*si; ni=x*si+y*sr; }
      else { nr=2*(X*x-Y*y)+x*x-y*y; ni=2*(X*y+Y*x)+2*x*y; if (type===2) ni=-ni; }
      if (type===5){ nr+=q*pr; ni+=q*pi; pr=dr; pi=di; dr=nr; di=ni; k++;
        if (k>1){ const er=R[2*k]+dr-R[2], ei=R[2*k+1]+di-R[3]; if (k>=L-1 || er*er+ei*ei<dr*dr+di*di){ pr=R[2*k-2]+pr-r0; pi=R[2*k-1]+pi-i0; dr=er; di=ei; k=1; } } continue; }
      dr=nr+cr; di=ni+ci; k++;
      const er=R[2*k]+dr-r0, ei=R[2*k+1]+di-i0; if (k>=L-1 || er*er+ei*ei<dr*dr+di*di){ dr=er; di=ei; k=0; } }
    return -1; }
  if (type>4 && type!==11) return -2;
  const f=stepFn(type), w=toMath(type,[v.cx+off[0], v.cy+off[1]]), R2=escR2(type); let z=jv?w.slice():startZ(type,w); const c=jv?st.jc:w;
  for (let i=0;i<iter;i++){ z=f(z,c); if (!(z[0]*z[0]+z[1]*z[1]<=R2)) return i; } return -1;
}
// scans run a few milliseconds per frame, so looking for detail never freezes the picture
shared.gridJob = null;
export function startGrid(kind){ const v=st.vE, d=viewDescs()[0], steer=kind==='steer';
  shared.gridJob={kind, N:steer?15:9, i:0, lo:steer?0.15:0.05, hi:steer?0.85:0.95, it:deepT()?(isExt()&&extT()?100000:30000):Math.min(effIter(v),8000), t0:performance.now(), cells:[],
    c0:{cx:v.cx,lx:v.lx||0,cy:v.cy,ly:v.ly||0,bx:v.bx,by:v.by}, d:{x:0,y:0,w:d.w,h:d.h,v:{cx:v.cx,cy:v.cy,scale:v.scale,rot:v.rot}}}; }
export function runGrid(budget){ const J=shared.gridJob; if (!J) return; const t0=performance.now(), d=J.d, N=J.N;
  while (J.i<N*N && performance.now()-t0<budget){ const gx=J.i%N, gy=Math.floor(J.i/N); J.i++;
    const sx=d.w*(J.lo+(J.hi-J.lo)*gx/(N-1)), sy=d.h*(J.lo+(J.hi-J.lo)*gy/(N-1)), off=toOff(d,sx,sy), n=escCount(off,J.it,J.c0);
    if (n===-2){ shared.gridJob=null; return; } J.cells.push({off, n, r:Math.hypot(sx-d.w/2,sy-d.h/2)/(d.h/2)}); }
  if (J.i>=N*N){ shared.gridJob=null; finishGrid(J); } }
function finishGrid(J){ const esc=J.cells.filter(c=>c.n>=0); let mx=0, mn=Infinity; for (const c of esc){ if (c.n>mx) mx=c.n; if (c.n<mn) mn=c.n; }
  if (deepT() && mx>0) setNeed(mx,mn);
  if (J.kind!=='steer') return;
  st.steerInside=1-esc.length/J.cells.length;
  { let c0=J.cells[0]; for (const c of J.cells) if (c.r<c0.r) c0=c; st.steerCentreIn = c0.n<0; }   // is the middle of the view in the black?
  if (!esc.length){ st.insideT+=(performance.now()-J.t0)/1000+0.2; return; } st.insideT=0;
  if (st.manualT>0) return;
  // a soft choice: every cell pulls, the busiest (and most central) pull hardest
  // While the middle is in the black, also favour one direction, picked at random for each dive: a symmetric view (the whole
  // Mandelbrot set is a mirror image top to bottom) would otherwise pull equally both ways and slide straight into the black.
  const pd=st.steerPref||0, px=Math.cos(pd), py=Math.sin(pd), bias=c=>{ if (!st.steerCentreIn) return 1; const m=Math.hypot(c.off[0],c.off[1])||1; return 1+0.3*(c.off[0]*px+c.off[1]*py)/m; };
  const sc=esc.map(c=>c.n*(1-0.35*c.r)*bias(c)), top=Math.max(...sc), spread=Math.max(1,top*0.06); let wx=0, wy=0, ws=0;
  esc.forEach((c,i)=>{ const w=Math.exp((sc[i]-top)/spread); wx+=w*c.off[0]; wy+=w*c.off[1]; ws+=w; });
  const dd=centreDiff(J.c0, st.vE), goal=[dd[0]+wx/ws, dd[1]+wy/ws];
  st.steerTo = st.steerTo ? [st.steerTo[0]*0.5+goal[0]*0.5, st.steerTo[1]*0.5+goal[1]*0.5] : goal; }
// how many iterations does this view really need? Deep views need far more than a formula can guess.
function setNeed(mx, mn){ const need=v=>Math.min(isExt()&&extT()?100000:30000, Math.round(Math.max(mx*1.3, mn+1500))), n=st.vE.scale>1e-5 ? 0 : need();
  if (Math.abs(n-st.iterNeed)>Math.max(200, st.iterNeed*0.08)){ st.iterNeed=n; touch(); } }
function autoIter(s){ return Math.round(clamp(160+150*Math.pow(Math.max(0,Math.log10(2/s)),1.3),160,deepT()?(isExt()&&extT()?100000:30000):8000)); }
export function effIter(v){ if (TYPES[st.type].newton) return st.iterAuto ? 80 : Math.min(st.iter,400); return st.iterAuto ? Math.max(autoIter(v.scale), v===st.vE && deepT() ? (st.iterNeed||0) : 0) : st.iter; }
let refWorker=null, refReqId=0;
function onRefDone(r){ for (const slot of refSlots){ const P=slot.pending; if (!P || P.id!==r.id) continue;
    const f32=new Float32Array(r.d64.length); f32.set(r.d64); upRef(slot.tex, {data:f32, len:r.len, aux:r.aux}, slot);
    Object.assign(slot, {key:P.key, base:P.base, len:r.len, d64:r.d64, julia:P.julia, c:P.c, maxIt:P.cap, escaped:r.len<P.cap+1, refId:(slot.refId||0)+1}); slot.pending=null; touch(); } }
try { refWorker=new Worker(URL.createObjectURL(new Blob(['const computeRefBig='+computeRefBig.toString()+';onmessage=e=>{const r=computeRefBig(e.data);postMessage(r,r.aux?[r.d64.buffer,r.aux.buffer]:[r.d64.buffer]);};'],{type:'text/javascript'})));
  refWorker.onmessage=e=>onRefDone(e.data); refWorker.onerror=()=>{ refWorker=null; }; } catch(e){ refWorker=null; }
export function requestExtRef(slot, key, base, v, julia, cap, type=0){ if (slot.pending) return; const id=++refReqId;
  slot.pending={id, key, base, julia, cap, c:{cx:v.cx,lx:v.lx||0,cy:v.cy,ly:v.ly||0,bx:v.bx,by:v.by}};
  const by=type===1?-v.by:v.by, q={id, F:FIXB, t:type, n:Math.round(st.power), zr:(julia?v.bx:0n).toString(), zi:(julia?by:0n).toString(), ar:(julia?dblToFix(st.jc[0]):v.bx).toString(), ai:(julia?dblToFix(st.jc[1]):by).toString(), cap};
  if (refWorker) refWorker.postMessage(q); else setTimeout(()=>onRefDone(computeRefBig(q)),0); }
export function resetViews(){ const T=TYPES[st.type], jv=st.julia||T.juliaOnly, a=cssW/cssH, la= cssW>=cssH ? (cssW/2)/cssH : cssW/(cssH/2);
  st.vE = fitV(jv && !T.juliaOnly ? juliaView() : view(T.view), a); st.vE.rot += st.rotDeg*Math.PI/180;
  st.vL = fitV(view(T.view), la); st.vR = fitV(juliaView(), la); st.vO = fitV(jv && !T.juliaOnly ? juliaView() : view(T.view), a); st.fly=null; }
