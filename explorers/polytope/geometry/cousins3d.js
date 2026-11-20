import { $, an } from '../util.js';
import { st } from '../state.js';
import { dot3, edgesMinDistN, edgesWithin, findFacets, gon, maxOf, nrm } from './common.js';
import { PHI, SHAPES } from './polytopes.js';

// ---------- 3D cousins ----------
function signedPerms3(base, cyclic){
  const perms = cyclic ? [[0,1,2],[1,2,0],[2,0,1]] : [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  const seen=new Set(), out=[];
  for (const pm of perms) for (let s=0;s<8;s++){ const v=pm.map((b,i)=>(s>>i&1)?-base[b]:base[b]);
    const k=v.map(x=>(x+0).toFixed(6)).join(); if (!seen.has(k)){ seen.add(k); out.push(nrm(v)); } }
  return out;
}
const XI = Math.SQRT2-1;
const POLY3 = {
  tet:['Tetrahedron', ()=>[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(nrm)],
  cube:['Cube', ()=>signedPerms3([1,1,1])],
  oct:['Octahedron', ()=>signedPerms3([1,0,0])],
  dod:['Dodecahedron', ()=>[...signedPerms3([1,1,1]), ...signedPerms3([0,1/PHI,PHI],true)]],
  ico:['Icosahedron', ()=>signedPerms3([0,1,PHI],true)],
  cubo:['Cuboctahedron', ()=>signedPerms3([1,1,0])],
  tcube:['Truncated cube', ()=>signedPerms3([XI,1,1])],
  toct:['Truncated octahedron', ()=>signedPerms3([0,1,2])],
  tco:['Truncated cuboctahedron', ()=>signedPerms3([1,1+Math.SQRT2,1+2*Math.SQRT2])],
  rco:['Rhombicuboctahedron', ()=>signedPerms3([1,1,1+Math.SQRT2])],
  ttet:['Truncated tetrahedron', ()=>signedPerms3([1,1,3]).filter(v=>v.filter(x=>x<0).length%2===0)],
  sph:['Sphere', ()=>{ const V=[[0,0,1],[0,0,-1]], E=[], nLa=7, nLo=16, id=(i,j)=>2+i*nLo+(j%nLo);
    for (let i=0;i<nLa;i++){ const la=-Math.PI/2+Math.PI*(i+1)/(nLa+1); for (let j=0;j<nLo;j++){ const lo=2*Math.PI*j/nLo; V.push([Math.cos(la)*Math.cos(lo),Math.cos(la)*Math.sin(lo),Math.sin(la)]); } }
    for (let i=0;i<nLa;i++) for (let j=0;j<nLo;j++){ E.push([id(i,j),id(i,j+1)]); if (i<nLa-1) E.push([id(i,j),id(i+1,j)]); }
    for (let j=0;j<nLo;j++){ E.push([1,id(0,j)],[0,id(nLa-1,j)]); } return {verts:V, edges:E}; }],
  cyl:['Cylinder', ()=>{ const n=24, r=Math.SQRT1_2, V=[], E=[];
    for (let i=0;i<n;i++){ const a=2*Math.PI*(i+0.5)/n; V.push([r*Math.cos(a),r*Math.sin(a),r],[r*Math.cos(a),r*Math.sin(a),-r]); }
    for (let i=0;i<n;i++){ const i2=(i+1)%n; E.push([2*i,2*i2],[2*i+1,2*i2+1],[2*i,2*i+1]); } return {verts:V, edges:E}; }],
  tico:['Truncated icosahedron', ()=>[...signedPerms3([0,1,3*PHI],true), ...signedPerms3([1,2+PHI,2*PHI],true), ...signedPerms3([PHI,2,PHI**3],true)]],
  tdod:['Truncated dodecahedron', ()=>[...signedPerms3([0,1/PHI,2+PHI],true), ...signedPerms3([1/PHI,PHI,2*PHI],true), ...signedPerms3([PHI,2,PHI+1],true)]],
  ssd:['Small stellated dodecahedron', ()=>{ const V=signedPerms3([0,1,PHI],true), c=dot3(V[0],V[0]), E=[];
    for (let i=0;i<V.length;i++) for (let j=i+1;j<V.length;j++){ const d=dot3(V[i],V[j])/c; if (Math.abs(d+1/Math.sqrt(5))<1e-6) E.push([i,j]); } return {verts:V, edges:E}; }],
  gico:['Great icosahedron', ()=>POLY3.ssd[1]()],
  gsd:['Great stellated dodecahedron', ()=>{ const V=[...signedPerms3([1,1,1]), ...signedPerms3([0,1/PHI,PHI],true)], c=3, E=[];
    for (let i=0;i<V.length;i++) for (let j=i+1;j<V.length;j++){ const d=dot3(V[i],V[j])/c; if (Math.abs(d+Math.sqrt(5)/3)<1e-6) E.push([i,j]); } return {verts:V, edges:E}; }],
  idd:['Icosidodecahedron', ()=>[...signedPerms3([0,0,PHI],true), ...signedPerms3([0.5,PHI/2,PHI*PHI/2],true)]],
};
const COUSIN_NAME_EXTRA={};
export const COUSIN = {sph4:'sph',duocyl:'cyl',spherinder:'cyl',cubinder:'cyl',5:'tet',8:'cube',16:'oct',120:'dod',600:'ico',rt:'cubo',tt:'tcube',bt:'toct',ot:'tco',r5:'oct',ru5:'cubo',o5:'toct',d:'prism',
  ru8:'rco',ca8:'rco',t5:'ttet',bt5:'ttet',ca5:'cubo',r600:'idd',r120:'idd',
  sst120:'ssd',g600:'gico',ggs120:'gsd',t16:'toct',t600:'tico',t120:'tdod',bt120:'tico',
  ptet:'tet',poct:'oct',pdod:'dod',pico:'ico',ycube:'cube',yoct:'oct',ydod:'dod',yico:'ico'};
for (const k of ['ptet','poct','pdod','pico','ycube','yoct','ydod','yico']) COUSIN_NAME_EXTRA[k]=true;
const COUSIN_NAME = {bt120:'Truncated icosahedron (bitruncated dodecahedron)', duocyl:'Cylinder (a disk × a line)', spherinder:'Cylinder (a disk × a line)', cubinder:'Cylinder (a disk × a line)', ru8:'Rhombicuboctahedron (expanded cube)', ca8:'Rhombicuboctahedron (cantellated cube)', bt5:'Truncated tetrahedron (bitruncated tetrahedron)',
  ca5:'Cuboctahedron (cantellated tetrahedron)', r600:'Icosidodecahedron (rectified icosahedron)', r120:'Icosidodecahedron (rectified dodecahedron)', rt:'Cuboctahedron (rectified cube)', bt:'Truncated octahedron (bitruncated cube)', ot:'Truncated cuboctahedron',
  r5:'Octahedron (rectified tetrahedron)', ru5:'Cuboctahedron (expanded tetrahedron)', o5:'Truncated octahedron (3D permutohedron)'};
for (const k in COUSIN_NAME_EXTRA){ const b=SHAPES[k].lift.bn; COUSIN_NAME[k]=b[0].toUpperCase()+b.slice(1)+' (its 3D base)'; }
function rot3t(v,t){ let [x,y,z]=v; [x,z]=[Math.cos(t)*x-Math.sin(t)*z, Math.sin(t)*x+Math.cos(t)*z];
  const u=0.7*t; [y,z]=[Math.cos(u)*y-Math.sin(u)*z, Math.sin(u)*y+Math.cos(u)*z]; return [x,y,z]; }
function autoTilt3(V){ const mz=A=>maxOf(A, v=>v[2]); if (mz(V)<=0.8) return V;
  let best=[9,0]; for (let t=0;t<Math.PI;t+=0.01){ const m=mz(V.map(v=>rot3t(v,t))); if (m<best[0]) best=[m,t]; }
  return V.map(v=>rot3t(v,best[1])); }
const cousinCache = {};
export function getCousin(){
  const key = SHAPES[st.shape].highD ? (SHAPES[st.shape].n===4 ? SHAPES[st.shape].cousin4 : null) : st.shape==='morph' ? SHAPES.morph.ckey : COUSIN[st.shape]; if (!key) return null;
  const p=+$('dp').value, ck = key==='prism' ? 'prism'+p : key;
  if (!cousinCache[ck]){
    let name, verts;
    if (key==='prism'){ name=`${gon(p)} prism (${an(gon(p))} × a line)`; verts=[];
      for (let i=0;i<p;i++){ const a=(i+0.5)*2*Math.PI/p; for (const s of [1,-1]) verts.push(nrm([Math.cos(a),Math.sin(a),s*Math.sin(Math.PI/p)])); } }
    let given=null;
    if (key!=='prism'){ name=POLY3[key][0]; const r=POLY3[key][1](); if (Array.isArray(r)) verts=r; else { verts=r.verts; given=r.edges; } }
    verts=autoTilt3(verts);
    const edges=given || edgesMinDistN(verts), faces=findFacets(verts, edges);
    const amax=[0,1,2].map(a=>Math.max(...verts.map(v=>Math.abs(v[a])))||1);
    cousinCache[ck]={ name, verts, edges, faces, faceEdges:edgesWithin(faces, edges, verts.length), amax,
      fam: edges.map(([i,j])=>{ const d=[0,1,2].map(a=>Math.abs(verts[i][a]-verts[j][a])); return [0,1,3][d.indexOf(Math.max(...d))]; }) };
  }
  const c=cousinCache[ck];
  return Object.assign({}, c, { name: (key!=='prism' && st.shape!=='morph' && COUSIN_NAME[st.shape]) || c.name });
}
