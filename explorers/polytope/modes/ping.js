import { shared } from '../shared.js';
import { $, lerpN } from '../util.js';
import { BASE_R, st } from '../state.js';
import { colorOf, wColor } from '../render/colour.js';
import { cross, dot3, dotN, nrm, shapeCtx, smooth, subN, topo } from '../geometry/common.js';
import { SHAPES } from '../geometry/polytopes.js';
import { axisHue, hdProjectAll } from '../geometry/higher-dim.js';
import { facePolys } from '../geometry/faces.js';
import { mulM, project, rot4 } from '../math/rotate4d.js';
import { LINE_LIMIT, drawSource, faceFill, fit, mainLayer, mainLines, makeFrames, pingLayer, pingLines, sliceFill, sliceLayer } from '../render/scene.js';
import { drawPacking, hidePacking, kissOK } from '../render/packing.js';
import { drawFoam, foamOK, hideFoam } from '../render/foam.js';
import { buildSource, getBuild } from './build.js';
import { unfoldSource } from './unfold.js';

// ---------- Ping: a pulse spreading edge by edge from one corner ----------
function vertexAdj(sh){ if (sh._vadj) return sh._vadj; const a=sh.verts.map(()=>[]); sh.edges.forEach(([i,j])=>{ a[i].push(j); a[j].push(i); }); return sh._vadj=a; }
export function pingData(){
  const sh=SHAPES[st.shape], P=st.ping;
  if (!P.data || P.data.sh!==sh || P.data.start!==P.start){
    const NV=sh.verts.length; if (P.start<0 || P.start>=NV) P.start=Math.floor(Math.random()*NV);
    const adj=vertexAdj(sh), d=new Array(NV).fill(-1); d[P.start]=0; const q=[P.start];
    for (let h=0;h<q.length;h++) for (const n of adj[q[h]]) if (d[n]<0){ d[n]=d[q[h]]+1; q.push(n); }
    const maxD=Math.max(...d), rings=new Array(maxD+1).fill(0); d.forEach(x=>{ if (x>=0) rings[x]++; });
    P.data={sh, start:P.start, d, maxD, rings, unreached:d.filter(x=>x<0).length};
  }
  return P.data;
}
const ringCol = (k, maxD) => wColor(-1+2*k/Math.max(1,maxD));
const PING_HOLD=1.0;   // steps to pause fully lit before running backward
export function pingPhase(){ const D=pingData(), t=st.ping.t/st.ping.step, m=D.maxD, chase=st.ping.style==='stay' && st.ping.back;
  const end = chase ? 2*m+PING_HOLD+1.8 : m+2.2;
  if (!chase || t<=m+PING_HOLD) return {T:t, U:-1, back:false, end};
  return {T:m+1, U:t-m-PING_HOLD, back:true, end}; }      // darkness spreads from the start along the same paths
const ECHO_FADE=1.0;   // steps it takes a lit part to fade out in Echo
export const echoAlpha = s => st.ping.style==='echo' ? 1-Math.max(0,Math.min(1,s/ECHO_FADE)) : 1;
function pingSource(base){
  const sh=SHAPES[st.shape], D=pingData(), ph=pingPhase(), T=ph.T, U=ph.U, echo=st.ping.style==='echo', P=st.ping;
  let C=P.cache;
  if (!C || C.D!==D){   // everything that only depends on the starting corner is worked out once per ping
    const NV=sh.verts.length, fwd=[], back=[], cols=[], eStart=[], skip=[], mids=[];
    sh.edges.forEach(([a,b])=>{
      if (D.d[a]<0 || D.d[b]<0){ fwd.push([a,b]); back.push([a,b]); cols.push(0); eStart.push(0); skip.push(1); return; }   // on a piece the pulse can't reach
      let x=a, y=b; if (D.d[y]<D.d[x]){ x=b; y=a; }
      if (D.d[x]===D.d[y]){ const m=NV+mids.length; mids.push([x,y]);   // same ring: both fronts meet in the middle
        for (const e of [x,y]){ fwd.push([e,m]); back.push([m,e]); cols.push(D.d[x]); eStart.push(D.d[x]); skip.push(0); } }
      else { fwd.push([x,y]); back.push([y,x]); cols.push(D.d[x]+0.5); eStart.push(D.d[x]); skip.push(0); } });
    const N=fwd.length;
    C=P.cache={D, NV, fwd, back, cols, eStart, skip, mids, grow:new Float32Array(N), mul:new Float32Array(N), eA:new Float32Array(N), RC:new Map()};
  }
  const N=C.fwd.length, clamp=x=>x<0?0:x>1?1:x;
  for (let e=0;e<N;e++){
    if (C.skip[e]){ C.grow[e]=0; C.mul[e]=0; C.eA[e]=0; continue; }
    const s0=C.eStart[e], g = ph.back ? 1-clamp(U-s0) : clamp(T-s0), a = echo ? echoAlpha(T-s0-1) : 1;
    C.grow[e]=g; C.eA[e]=a; C.mul[e] = g<=0 ? 0 : echo ? (a>0 ? 1.5*(0.4+0.6*a) : 0) : 1.5; }
  let V=base.V, O=base.O;
  if (C.mids.length){ V=V.slice(); O=O.slice();
    for (const [x,y] of C.mids){ let mv=lerpN(base.V[x],base.V[y],0.5); if (base.curved){ const L=Math.hypot(...base.V[x])/(Math.hypot(...mv)||1); mv=mv.map(c=>c*L); } V.push(mv); O.push(lerpN(base.O[x],base.O[y],0.5)); } }
  const NV=C.NV, RC=C.RC;
  const ballMul=new Array(V.length), ballDim = echo ? new Array(V.length) : null;
  for (let n=0;n<V.length;n++){ if (n>=NV){ ballMul[n]=0; if (ballDim) ballDim[n]=0; continue; }
    const k=D.d[n]; if (k<0 || T<k || (ph.back && U>=k)){ ballMul[n]=0; if (ballDim) ballDim[n]=0; continue; }
    const na=echoAlpha(T-k-0.6), pop = ph.back ? 1 : 1+1.3*Math.exp(-(T-k)*3), m=(n===D.start?1.6:1.15)*pop;
    ballMul[n] = echo ? (na>0 ? m*(0.35+0.65*na) : 0) : m; if (ballDim) ballDim[n]=na; }
  return Object.assign({}, base, { V, O, edges: ph.back ? C.back : C.fwd, grow:C.grow, edgeMul:C.mul, edgeDim: echo ? C.eA : null, ballDim, ballMul,
    edgeCol:i=>{ const k=C.cols[i]; let c=RC.get(k); if (!c){ c=ringCol(k, D.maxD); RC.set(k,c); } return c; },
    ballCol:n=>{ if (n===D.start) return [1,1,1]; const k='b'+(D.d[n]||0); let c=RC.get(k); if (!c){ c=ringCol(D.d[n]||0, D.maxD).map(x=>Math.min(1,x*1.12)); RC.set(k,c); } return c; } });
}
export function newPing(){ const NV=SHAPES[st.shape].verts.length, old=st.ping.start; let s;
  do { s=Math.floor(Math.random()*NV); } while (NV>1 && s===old);
  st.ping.start=s; st.ping.t=0; shared.lastCap=''; }

// knife direction: turn the shape so one corner, edge middle, face middle or cell middle points straight along W
shared.knifeDir = 'free'; shared.netSeed = 0; const knifeCache=new WeakMap();
function knifeAlign(sh){
  if (shared.knifeDir==='free' || sh.round || sh.highD) return null;
  let c=knifeCache.get(sh); if (!c){ c={}; knifeCache.set(sh,c); } if (c[shared.knifeDir]) return c[shared.knifeDir];
  topo(sh); const V=sh.verts, mid=ids=>{ const m=[0,0,0,0]; for (const i of ids) for (let k=0;k<4;k++) m[k]+=V[i][k]/ids.length; return m; };
  const pick=L=>L.reduce((b,x)=>x.length>b.length?x:b, L[0]);   // the biggest face or cell
  const d=nrm(shared.knifeDir==='vert' ? V[0] : shared.knifeDir==='edge' ? mid(sh.edges[0]) : shared.knifeDir==='face' ? mid(pick(sh._faces)) : mid(pick(sh._cells)));
  const u=[d[0],d[1],d[2],d[3]-1], ul=Math.hypot(...u), A=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
  if (ul>1e-9){ const n=u.map(x=>x/ul); for (let r=0;r<4;r++) for (let k=0;k<4;k++) A[r][k]=(r===k?1:0)-2*n[r]*n[k]; }
  for (let r=0;r<4;r++) A[r][0]=-A[r][0];   // a reflection then a flip in X: a true rotation, not a mirror image
  return c[shared.knifeDir]=A; }
// changing the knife direction turns the shape smoothly, so you can see it move (the knife itself never moves)
export const I4=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]; shared.knifeAnim = null; export let knifeNow=null;
function orthoRows(M){ const R=[]; for (const r of M){ let v=r.slice(); for (const q of R){ const d=dotN(v,q); v=v.map((x,i)=>x-d*q[i]); } const l=Math.hypot(...v)||1; R.push(v.map(x=>x/l)); } return R; }
function knifeMatrix(sh){ const target=knifeAlign(sh)||I4;
  if (shared.knifeAnim){ const k=smooth(Math.min(1,shared.knifeAnim.t)); knifeNow=orthoRows(shared.knifeAnim.from.map((r,i)=>r.map((x,j)=>x+(target[i][j]-x)*k))); if (shared.knifeAnim.t>=1) shared.knifeAnim=null; }
  else knifeNow=target;
  return knifeNow; }
const mat4mul=(A,B)=>A.map(r=>[0,1,2,3].map(c=>r[0]*B[0][c]+r[1]*B[1][c]+r[2]*B[2][c]+r[3]*B[3][c]));
export const KNIFE_TURN=' Picking an option turns the shape once to face the knife that way. After that the shape stays still and only the knife moves, sliding through it from one side to the other.';
export const KNIFE_NOTES={free:'Free: the shape sits square to the knife, the way it first appears.',
  vert:'Corner first: one corner faces the knife, so the first cut is a single point that grows. On a tesseract: a tetrahedron that swells into an octahedron at the middle, then shrinks back.',
  edge:'Edge first: one edge faces the knife, lying across its path, so the first cut is a line segment.',
  face:'Face first: one face meets the knife flat on, so the first cut is that flat polygon, which then thickens. For mixed shapes it\'s one of the biggest faces.',
  cell:'Cell first: a whole 3D cell meets the knife flat on, so the first cut is a copy of that cell. On a tesseract it\'s a cube the whole way through. For mixed shapes it\'s one of the biggest cells.'};
// the Apollonian packing, and any shape drawn as balls or foam, is always stereographic: the only projection that keeps balls round
export const foamView=sh=>st.mode==='explore' && st.drawAs==='foam' && !sh.packing && foamOK(sh);
export const roundView=sh=>sh.packing || foamView(sh) || (st.mode==='explore' && st.drawAs==='balls' && kissOK(sh));
export function getSource(){
  if (st.mode==='build') return buildSource();
  if (st.mode==='unfold') return unfoldSource();
  const sh=shapeCtx(SHAPES[st.shape]), KA=st.mode==='slice' ? knifeMatrix(SHAPES[st.shape]) : null, M=KA ? mat4mul(KA, rot4()) : rot4();
  const V4 = sh.highD && sh.n>4 && st.hdA ? hdProjectAll(sh, st.hdA) : sh.verts;
  const src={ O:sh.verts, V:V4.map(v=>mulM(M,v)), edges:sh.edges, fam:sh.fam, amax:sh.amax, wmax:sh.wmax, tk:sh.tk,
    proj: roundView(sh) ? 'stereo' : st.mode==='slice' && st.proj==='stereo' ? 'persp' : st.proj, curved: (st.mode==='explore' || st.mode==='ping') && st.edges==='curved' && !sh.noCurve };
  if (sh.edgeColor && st.mode!=='ping') src.edgeCol=sh.edgeColor;
  if (sh.highD && st.cmode==='dir' && st.mode!=='ping') src.edgeCol=i=>axisHue(sh.axis[i], sh.n);   // one colour per direction
  const E=sh.edges.length, NV=sh.verts.length;
  if (st.mode==='ping' && E>LINE_LIMIT){ const base=shared.SOLID.map(x=>x*0.7); src.edgeCol=()=>base; }
  if (st.mode==='ping'){ src.edgeMul=new Array(E).fill(0.55); src.edgeDim=new Array(E).fill(0.22); src.ballMul=new Array(NV).fill(0.5); src.ballDim=new Array(NV).fill(0.22); }
  else if (st.mode==='slice'){ src.edgeMul=new Array(E).fill(0.5); src.edgeDim=new Array(E).fill(0.28); src.ballMul=new Array(NV).fill(0.45); src.ballDim=new Array(NV).fill(0.28); }
  else if (st.hl && !sh.round && !sh.highD && !sh.star && !sh.compound){ topo(sh); const c=Math.min(st.cell, sh._cells.length-1), inV=new Set(sh._cells[c]), inE=new Set(sh._cellEdges[c]);
    src.edgeMul=sh.edges.map((_,e)=>inE.has(e)?1.9:0.55); src.edgeDim=sh.edges.map((_,e)=>inE.has(e)?1:0.13);
    src.ballMul=sh.verts.map((_,n)=>inV.has(n)?1.5:0.55); src.ballDim=sh.verts.map((_,n)=>inV.has(n)?1:0.13); }
  if (foamView(sh)){   // bubble foam: fine curved edges where the films meet, none running off towards infinity
    src.curved=true; const far=src.V.map(v=>v[3]>0.96);
    src.edgeMul=sh.edges.map(([a,b])=>far[a]||far[b] ? 0 : 0.45); src.ballMul=src.V.map((v,n)=>far[n] ? 0 : 0.35); }
  if (sh.round){   // round meshes: small corners, and in stereographic drop the lines that run off towards infinity
    src.ballMul=(src.ballMul||new Array(NV).fill(1)).map(x=>x*sh.ballScale);
    if (src.proj==='stereo'){ const far=src.V.map(v=>v[3]>0.9);
      src.edgeMul=(src.edgeMul||new Array(E).fill(1)).map((x,e)=> far[sh.edges[e][0]]||far[sh.edges[e][1]] ? 0 : x);
      src.ballMul=src.ballMul.map((x,n)=>far[n]?0:x); } }
  return src;
}


// cross-section of the rotated shape by the hyperplane W = h: one segment per 2D face the knife crosses
function orderPoly(P){   // put a flat polygon's corners in order around its middle
  const c=[0,1,2].map(k=>P.reduce((s,q)=>s+q.p[k],0)/P.length); let n=[0,0,0];
  for (let i=0;i<P.length;i++){ const a=subN(P[i].p,c), b=subN(P[(i+1)%P.length].p,c), x=cross(a,b); if (dot3(x,n)<0) n=n.map((v,k)=>v-x[k]); else n=n.map((v,k)=>v+x[k]); }
  n=nrm(n); const u=nrm(subN(P[0].p,c)), v=cross(n,u);
  return P.map(q=>({q, a:Math.atan2(dot3(subN(q.p,c),v), dot3(subN(q.p,c),u))})).sort((x,y)=>x.a-y.a).map(x=>x.q); }
function computeSlice(sh, V, h, proj='ortho'){
  const P3=x=>project([x[0],x[1],x[2],h], proj).slice(0,3);   // every slice point has W = h, so the projection only scales the slice evenly: it sits exactly on the drawn shape
  if (sh.sliceAnalytic){ const a=sh.sliceAnalytic(h); if (!a) return {segs:[], pts:[], cut:0, sides:[], round:true};
    return {segs:a.segs.map(([p,q])=>[{p:P3(p), o:[p[0],p[1],p[2],h]},{p:P3(q), o:[q[0],q[1],q[2],h]}]), pts:[], cut:0, sides:[], round:true, r:a.r}; }
  topo(sh); let lo=Infinity, hi=-Infinity; for (const v of V){ if (v[3]<lo) lo=v[3]; if (v[3]>hi) hi=v[3]; }
  // at the very ends, corners that should share one W differ by rounding noise: keep the knife a hair inside the shape
  const rng=Math.max(1e-9,hi-lo); h=Math.max(lo+1e-6*rng, Math.min(hi-1e-6*rng, h));
  const pts=new Map(), grid=new Map(), side=V.map(v=>v[3]-h>=0), tol=2e-4*rng;
  // when the knife passes through or right next to a corner, several edges cross at (almost) the same spot: merge those points
  const pt=ei=>{ let r=pts.get(ei); if (r) return r; const [a,b]=sh.edges[ei], da=V[a][3]-h, db=V[b][3]-h, t=da/(da-db);
    r={ p:P3([0,1,2].map(k=>V[a][k]+(V[b][k]-V[a][k])*t)), o:[0,1,2,3].map(k=>sh.verts[a][k]+(sh.verts[b][k]-sh.verts[a][k])*t) };
    const g=r.p.map(x=>Math.floor(x/tol)); let found=null;
    for (let i=-1;i<=1&&!found;i++) for (let j=-1;j<=1&&!found;j++) for (let k=-1;k<=1&&!found;k++){ const L=grid.get((g[0]+i)+','+(g[1]+j)+','+(g[2]+k)); if (L) for (const q of L) if (Math.hypot(q.p[0]-r.p[0],q.p[1]-r.p[1],q.p[2]-r.p[2])<tol){ found=q; break; } }
    if (found) r=found; else { const key=g.join(','); if (!grid.has(key)) grid.set(key,[]); grid.get(key).push(r); }
    pts.set(ei,r); return r; };
  const segs=[], segSeen=new Set();
  for (const fe of sh._faceEdges){ const cr=[]; for (const ei of fe){ const [a,b]=sh.edges[ei]; if (side[a]!==side[b]) cr.push(ei); }
    if (cr.length<2) continue; const P=[...new Set(cr.map(pt))]; if (P.length!==2) continue;
    const k1=P[0].p.join()+'|'+P[1].p.join(), k2=P[1].p.join()+'|'+P[0].p.join(); if (segSeen.has(k1)) continue; segSeen.add(k1); segSeen.add(k2); segs.push(P); }
  let cut=0; const sides=[], polys=[];
  sh._cells.forEach((c,ci)=>{ let up=false, dn=false; for (const v of c){ if (side[v]) up=true; else dn=true; }
    if (up&&dn){ const P=[...new Set(sh._cellEdges[ci].filter(ei=>side[sh.edges[ei][0]]!==side[sh.edges[ei][1]]).map(pt))]; if (P.length>=3){ cut++; sides.push(P.length); polys.push(orderPoly(P)); } } });
  if (sh.round && !sh._faceEdges.length) sh.edges.forEach(([a,b],ei)=>{ if (side[a]!==side[b]) pt(ei); });   // circles: just the points where they cross
  const U=[...new Set(pts.values())]; let flat=false;   // a slice with no thickness: the knife lies flat against a face (or touches an edge or corner)
  if (U.length>=3){ const a=U[0].p; let b=null, n=null;
    for (const q of U){ const d=subN(q.p,a); if (!b){ if (Math.hypot(...d)>tol) b=d; continue; } const c=cross(b,d); if (Math.hypot(...c)>tol*Math.hypot(...b)){ n=nrm(c); break; } }
    flat = !n || U.every(q=>Math.abs(dot3(subN(q.p,a),n))<tol*4); }
  return {segs, pts:U, cut, sides, polys, flat, round:!!sh.round};
}
function sliceTubes(sh, sl, src){
  const thick=BASE_R*st.thk*(sh.tk||1)*1.6;
  return { tubes: sl.segs.map(([a,b])=>{ const P=[a.p,b.p]; return {P, rad:[thick,thick], cols:[colorOf(a.o,st.knife,-1,src), colorOf(b.o,st.knife,-1,src)], F:makeFrames(P)}; }),
           balls: sl.pts.map(q=>({c:q.p, r:thick*1.45, col:colorOf(q.o,st.knife,-1,src).map(x=>Math.min(1,x*1.1))})) };
}

export let lastFrame=null, sliceFrame=null, sliceInfo=null; shared.fitScale = null;
let stillKey='', stillBound=0;
export function updateGeometry(){
  // Unfold doesn't spin in 4D, so while the slider isn't moving the picture doesn't change: skip the rebuild
  // (dragging and the turntable only turn the camera, so they don't need it either)
  const key = st.mode==='unfold' ? [st.shape+(SHAPES[st.shape].ver||'')+'n'+shared.netSeed, $('dp').value, $('dq').value, st.unf.u, st.unf.f, st.thk, st.conf, st.palette, st.palRev, st.cycle, st.density, st.bg].join('|') : '';
  let bound;
  const sh0=SHAPES[st.shape], pk=st.mode==='explore' && (sh0.packing ? st.packView==='balls' : st.drawAs==='balls' && kissOK(sh0));
  if (pk){ const r=drawPacking(SHAPES[st.shape]); mainLayer.setVisible(false); mainLines.setVisible(false); lastFrame={tubes:[], balls:r.balls, packing:true}; bound=r.bound; }
  else hidePacking();
  if (pk){ hideFoam(); }
  else if (key && key===stillKey && lastFrame){ bound=stillBound; }
  else {
    const src=getSource(), r=drawSource(src, mainLayer, mainLines); lastFrame=r.frame; bound=r.bound; stillKey=key; stillBound=bound;
    if (foamView(SHAPES[st.shape])) bound=Math.max(bound, drawFoam(SHAPES[st.shape], src.V, [st.palette, st.palRev, st.cycle.toFixed(3), st.density].join('|'))); else hideFoam();
  }
  { const sh=SHAPES[st.shape];   // see-through faces (Explore and Ping)
    if (st.faceFill && (st.mode==='explore'||st.mode==='ping') && !sh.round && !sh.highD && !foamView(sh)){
      const src=getSource(), P=src.V.map(v=>project(v,src.proj)), F=facePolys(sh);
      faceFill.update(F.map(f=>f.map(i=>({p:P[i], i}))), q=>colorOf(src.O[q.i], src.V[q.i][3], -1, src)); }
    else faceFill.hide(); }
  if (st.mode==='slice'){
    const sh=topo(SHAPES[st.shape]); sliceLayer.setVisible(true); sliceLayer.ensure(Math.max(1, sh._faces.length, sh.sliceCap||0), Math.max(1, sh.edges.length), 2, 10);
    const src=getSource(); let lo=Infinity, hi=-Infinity; for (const v of src.V){ if (v[3]<lo) lo=v[3]; if (v[3]>hi) hi=v[3]; }
    if (sh.sliceAnalytic){ lo=-1; hi=1; }
    st.knife=Math.max(lo+1e-9, (lo+hi)/2+st.knifeU*(hi-lo)/2); $('knifeo').textContent=st.knife.toFixed(2);   // the slider spans the shape's own depth along W, so the knife always cuts something
    sliceInfo=computeSlice(sh, src.V, st.knife, src.proj); sliceFrame=sliceTubes(sh, sliceInfo, src);
    if (st.sliceFill && sliceInfo.polys && sliceInfo.polys.length) sliceFill.update(sliceInfo.polys, q=>colorOf(q.o, st.knife, -1, src)); else sliceFill.hide();
    bound=Math.max(bound, sliceLayer.update(sliceFrame));
  } else { sliceLayer.setVisible(false); sliceFill.hide(); }
  if (st.mode==='ping'){
    bound=Math.max(bound, drawSource(pingSource(getSource()), pingLayer, pingLines).bound);
  } else { pingLayer.setVisible(false); pingLines.setVisible(false); }
  const target = st.mode==='build' ? 1/Math.max(getBuild().fitR, bound) : 1/Math.max(bound,0.3);
  shared.fitScale = shared.fitScale==null ? target : shared.fitScale+(target-shared.fitScale)*0.08;
  fit.scale.setScalar(shared.fitScale);
}
