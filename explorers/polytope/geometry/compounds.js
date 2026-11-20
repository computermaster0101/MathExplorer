import { wColor } from '../render/colour.js';
import { nrm } from './common.js';
import { CELL600, SHAPES, autoTilt, edgesByMinDist } from './polytopes.js';

// ---------- compounds: several polytopes sharing one centre, passing through each other ----------
function qmul(a,b){ return [a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3], a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2], a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1], a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]]; }
function cosets24(){   // the 600-cell's 120 corners as quaternions split into five copies of the 24-cell
  const key=v=>v.map(x=>Math.round(x*1e5)).join(','), all=new Map(CELL600.map((v,i)=>[key(v),i])), T=CELL600.slice(0,24), used=new Set(), out=[];
  for (let g=0; g<120 && out.length<5; g++){ if (used.has(g)) continue; const C=T.map(t=>all.get(key(qmul(CELL600[g],t))));
    if (C.some(i=>i===undefined)) return null; C.forEach(i=>used.add(i)); out.push(C.map(i=>CELL600[i])); }
  return out.length===5 && used.size===120 ? out : null; }
function makeCompound(key, name, alt, comps, info, sym){
  let cache=null; const sh=SHAPES[key]={ name, alt, info, sym, compound:true, cells:'—', tk: 0.6 };
  const init=()=>{ if (cache) return cache; const V=[], E=[], comp=[], ecomp=[];
    comps().forEach((C,ci)=>{ const off=V.length, U=C.map(v=>nrm(v)); U.forEach(v=>{ V.push(v); comp.push(ci); }); edgesByMinDist(U).forEach(([a,b])=>{ E.push([a+off,b+off]); ecomp.push(ci); }); });
    const T=autoTilt(V); return cache={verts:T, edges:E, comp, ecomp, k:comps().length}; };
  sh.parts=()=>{ const c=init(), P=[]; for (let ci=0; ci<c.k; ci++){ const idx=c.comp.map((x,i)=>x===ci?i:-1).filter(i=>i>=0), map=new Map(idx.map((g,l)=>[g,l]));
    P.push({ idx, part:{ verts:idx.map(i=>c.verts[i]), edges:c.edges.filter(([a,b])=>map.has(a)&&map.has(b)).map(([a,b])=>[map.get(a),map.get(b)]) } }); } return P; };
  Object.defineProperty(sh,'verts',{get:()=>init().verts, configurable:true}); Object.defineProperty(sh,'edges',{get:()=>init().edges, configurable:true});
  sh.edgeColor = i=>{ const c=init(); return wColor(-1+2*(c.ecomp[i]+0.5)/c.k); };
  sh.compOf = ()=>init().comp; }
const TESS=[...Array(16)].map((_,s)=>[0,1,2,3].map(i=>(s>>i&1)?-0.5:0.5)), CROSS16=CELL600.slice(0,8);
const PAR=v=>v.filter(x=>x<0).length%2;
const C16x3=()=>[CROSS16, TESS.filter(v=>!PAR(v)), TESS.filter(v=>PAR(v))];
function dualOf16(C){ const U=C.map(v=>nrm(v)), E=edgesByMinDist(U), A=U.map(()=>new Set()); E.forEach(([a,b])=>{A[a].add(b);A[b].add(a);}); const out=[];
  for (let a=0;a<8;a++) for (const b of A[a]) if (b>a) for (const c of A[a]) if (c>b&&A[b].has(c)) for (const d of A[a]) if (d>c&&A[b].has(d)&&A[c].has(d)) out.push([0,1,2,3].map(i=>U[a][i]+U[b][i]+U[c][i]+U[d][i]));
  return out; }
makeCompound('c3x16','Three 16-cells','3{3,3,4}: the 24-cell\'s corners, split three ways', C16x3,
  'The 24-cell\'s 24 corners split cleanly into three 16-cells, each a different colour. They share a centre and pass through each other without sharing a single edge. A regular compound: every corner, edge and cell looks the same as every other.', '3{3,3,4}');
makeCompound('c3x8','Three tesseracts','3{4,3,3}: the dual of three 16-cells', ()=>C16x3().map(dualOf16),
  'Swap each of the three 16-cells for its dual and you get three tesseracts, interlocked around one centre. A regular compound, the partner of the three 16-cells.', '3{4,3,3}');
makeCompound('c5x24','Five 24-cells','5{3,4,3}: the 600-cell\'s 120 corners, split five ways', ()=>cosets24()||[CELL600.slice(0,24)],
  'The 600-cell\'s 120 corners split exactly into five 24-cells, a 4D echo of the five cubes hidden in a dodecahedron. Each colour is one complete 24-cell. Turn it and watch them weave through each other.', '5{3,4,3}');
makeCompound('c8and16','Tesseract + 16-cell','a tesseract and a 16-cell on one sphere', ()=>[TESS, CROSS16],
  'A tesseract and its dual, the 16-cell, drawn on the same sphere. Together their 16 + 8 corners are exactly the 24-cell\'s corners, which is one way to see why the 24-cell exists.', '');
makeCompound('c2x8','Two tesseracts','two tesseracts, one turned 45° in two planes', ()=>[TESS, TESS.map(v=>{ const c=Math.SQRT1_2; return [c*(v[0]-v[1]), c*(v[0]+v[1]), c*(v[2]-v[3]), c*(v[2]+v[3])]; })],
  'Two tesseracts sharing a centre, the second turned 45° in the XY and ZW planes at once (a double rotation). Their 32 corners sit evenly on one sphere.', '');
