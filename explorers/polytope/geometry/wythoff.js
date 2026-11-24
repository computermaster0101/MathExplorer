import { SHAPES, autoTilt, dot4, tilt } from './polytopes.js';
import { COUSIN } from './cousins3d.js';

// ---------- Wythoff's construction: a symmetry group made of 4 mirrors, and one point placed between them ----------
// Each family (5-cell, tesseract/16-cell, 24-cell, 600-cell/120-cell) is a set of mirrors. Put a point somewhere between
// the mirrors, reflect it in every way the mirrors allow, and the copies are the corners. Two corners are joined when one
// mirror swaps them. Moving the point slides smoothly through the whole family.
export const WY_FAM = {
  a4:{ m:[3,3,3], label:'5-cell family' },
  b4:{ m:[4,3,3], label:'Tesseract / 16-cell family' },
  f4:{ m:[3,4,3], label:'24-cell family' },
  h4:{ m:[5,3,3], label:'120-cell / 600-cell family' },
};
export function wyGroup(fk){
  const F=WY_FAM[fk]; if (F.G) return F;
  const M=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]].map(r=>r.slice());   // Gram matrix of the mirror normals
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) M[i][j] = i===j ? 1 : Math.abs(i-j)===1 ? -Math.cos(Math.PI/F.m[Math.min(i,j)]) : 0;
  const A=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];   // Cholesky: mirror normals as rows
  for (let i=0;i<4;i++) for (let j=0;j<=i;j++){ let s=M[i][j]; for (let k=0;k<j;k++) s-=A[i][k]*A[j][k]; A[i][j] = i===j ? Math.sqrt(s) : s/A[j][j]; }
  // fundamental weights: W[k] is perpendicular to every mirror but k
  const inv=(()=>{ const n=4, a=A.map((r,i)=>[...r, ...[0,1,2,3].map(j=>i===j?1:0)]);
    for (let c=0;c<n;c++){ let piv=c; for (let r=c+1;r<n;r++) if (Math.abs(a[r][c])>Math.abs(a[piv][c])) piv=r; [a[c],a[piv]]=[a[piv],a[c]];
      const d=a[c][c]; for (let j=0;j<2*n;j++) a[c][j]/=d; for (let r=0;r<n;r++) if (r!==c){ const f=a[r][c]; for (let j=0;j<2*n;j++) a[r][j]-=f*a[c][j]; } }
    return a.map(r=>r.slice(n)); })();
  const W=[0,1,2,3].map(k=>[0,1,2,3].map(i=>inv[i][k]));
  // the group: every combination of reflections, found by reflecting a generic point until nothing new appears
  const gen=[0.3,0.5,0.7,1.1], pg=[0,1,2,3].map(i=>W.reduce((s,w,k)=>s+gen[k]*w[i],0));
  const key=v=>v.map(x=>Math.round(x*1e5)).join(','), seen=new Map(), mats=[];
  const I=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; seen.set(key(pg),0); mats.push(I);
  for (let q=0;q<mats.length;q++){ const g=mats[q];
    for (let r=0;r<4;r++){ const a=A[r], h=new Array(16);   // reflect: R_a * g
      for (let c=0;c<4;c++){ const d=a[0]*g[c]+a[1]*g[4+c]+a[2]*g[8+c]+a[3]*g[12+c]; for (let i=0;i<4;i++) h[i*4+c]=g[i*4+c]-2*a[i]*d; }
      const v=[0,1,2,3].map(i=>h[i*4]*pg[0]+h[i*4+1]*pg[1]+h[i*4+2]*pg[2]+h[i*4+3]*pg[3]), kk=key(v);
      if (!seen.has(kk)){ seen.set(kk,mats.length); mats.push(h); } } }
  F.A=A; F.W=W; F.G=Float64Array.from(mats.flat()); F.order=mats.length;
  return F; }
export function wythoff(fk, w, tiltT=0){   // w = how far the point sits from each of the 4 mirrors
  const F=wyGroup(fk), G=F.G, N=F.order, p=[0,1,2,3].map(i=>F.W.reduce((s,ww,k)=>s+w[k]*ww[i],0)), pl=Math.hypot(...p);
  const pn=p.map(x=>x/pl), refl=F.A.map(a=>{ const d=2*dot4(a,pn); return pn.map((x,i)=>x-d*a[i]); });
  const act=(g,v)=>{ const o=g*16; return [G[o]*v[0]+G[o+1]*v[1]+G[o+2]*v[2]+G[o+3]*v[3], G[o+4]*v[0]+G[o+5]*v[1]+G[o+6]*v[2]+G[o+7]*v[3],
    G[o+8]*v[0]+G[o+9]*v[1]+G[o+10]*v[2]+G[o+11]*v[3], G[o+12]*v[0]+G[o+13]*v[1]+G[o+14]*v[2]+G[o+15]*v[3]]; };
  const key=v=>Math.round(v[0]*2e4)+','+Math.round(v[1]*2e4)+','+Math.round(v[2]*2e4)+','+Math.round(v[3]*2e4);
  const idx=new Map(), V=[], E=[], es=new Set(), live=[0,1,2,3].filter(k=>w[k]>1e-9);
  const id=v=>{ const k=key(v); let i=idx.get(k); if (i===undefined){ i=V.length; idx.set(k,i); V.push(v); } return i; };
  for (let g=0; g<N; g++){ const a=id(act(g,pn));
    for (const r of live){ const b=id(act(g,refl[r])); if (a===b) continue; const lo=Math.min(a,b), hi=Math.max(a,b), ek=lo*1e6+hi; if (!es.has(ek)){ es.add(ek); E.push([lo,hi]); } } }
  return { verts: tiltT ? V.map(v=>tilt(v,tiltT)) : V, edges:E }; }
// a point between mirrors k and k+1 (s from 0 to 3): whole numbers are the regular and rectified shapes, halves are truncations
const wyWeights = s => { const w=[0,0,0,0], k=Math.min(2, Math.floor(s)), f=s-k; w[k]=1-f; w[k+1]=f; return w; };
export const WY_STOPS = {
  a4:['5-cell','Truncated 5-cell','Rectified 5-cell','Bitruncated 5-cell','Rectified 5-cell','Truncated 5-cell','5-cell'],
  b4:['Tesseract','Truncated tesseract','Rectified tesseract','Bitruncated tesseract','24-cell (rectified 16-cell)','Truncated 16-cell','16-cell'],
  f4:['24-cell','Truncated 24-cell','Rectified 24-cell','Bitruncated 24-cell','Rectified 24-cell','Truncated 24-cell','24-cell'],
  h4:['120-cell','Truncated 120-cell','Rectified 120-cell','Bitruncated 120-cell','Rectified 600-cell','Truncated 600-cell','600-cell'],
};
const WY_KEYS = { a4:['5','t5','r5','bt5','r5','t5','5'], b4:['8','tt','rt','bt','24','t16','16'], f4:['24','t24','r24','bt24','r24','t24','24'], h4:['120','t120','r120','bt120','r600','t600','600'] };
// shapes made by Wythoff's construction, worked out the first time someone picks them
const WY_SHAPES = {
  t16:['b4',2.5,'Truncated 16-cell','8 truncated octahedra + 16 truncated tetrahedra',24,0.7,'The 16-cell with its corners sliced off. Each tetrahedral cell becomes a truncated tetrahedron, and each cut corner leaves a truncated octahedron. Same symmetry as the tesseract, seen from the other end of the family.'],
  bt24:['f4',1.5,'Bitruncated 24-cell','48 identical truncated cubes',48,0.42,'Cut the 24-cell so deep it meets its own dual halfway. All 48 cells are identical truncated cubes, and the shape looks the same from every cell. Also called the tetracontoctachoron, and one of only a few 4D shapes whose cells are all alike without being regular.'],
  t600:['h4',2.5,'Truncated 600-cell','600 truncated tetrahedra + 120 icosahedra',720,0.24,'The 600-cell with every corner sliced off: each tetrahedron becomes a truncated tetrahedron, and each of the 120 cut corners leaves an icosahedron. 1,440 corners. A giant, so give it a moment.'],
  t120:['h4',0.5,'Truncated 120-cell','120 truncated dodecahedra + 600 tetrahedra',720,0.2,'The 120-cell with every corner sliced off: each dodecahedron becomes a truncated dodecahedron (its pentagons become decagons), and each cut corner leaves a small tetrahedron. 2,400 corners.'],
  bt120:['h4',1.5,'Bitruncated 120-cell','120 truncated icosahedra + 600 truncated tetrahedra',720,0.18,'Halfway between the 120-cell and the 600-cell. The 120 cells are truncated icosahedra, the soccer-ball shape, and the 600 are truncated tetrahedra. 3,600 corners and 7,200 edges, the biggest shape here.'],
};
for (const k in WY_SHAPES){ const [fk,s,name,alt,cells,tk,info]=WY_SHAPES[k]; let cache=null;
  const sh=SHAPES[k]={ name, alt, cells, tk, info, wy:[fk,s] };
  const init=()=>{ if (!cache){ const r=wythoff(fk, wyWeights(s)); const V=autoTilt(r.verts); cache={verts:V, edges:r.edges}; } return cache; };
  Object.defineProperty(sh,'verts',{get:()=>init().verts, configurable:true}); Object.defineProperty(sh,'edges',{get:()=>init().edges, configurable:true}); }
// the morph: one point sliding between the mirrors, so one family's shapes flow into each other
const WY_TILT={};
function wyTilt(fk){ if (WY_TILT[fk]!=null) return WY_TILT[fk];
  const sets=[0,1,2,3].map(s=>wythoff(fk, wyWeights(s)).verts); let best=[9,0];
  for (let t=0;t<Math.PI;t+=0.02){ let m=-9; for (const V of sets) for (const v of V){ const w=tilt(v,t)[3]; if (w>m) m=w; } if (m<best[0]) best=[m,t]; }
  return WY_TILT[fk]=best[1]; }
let morphVer=0;
export function makeMorph(fk, s){
  const r=wythoff(fk, wyWeights(s), wyTilt(fk)), names=WY_STOPS[fk], h2=s*2, near=Math.abs(h2-Math.round(h2))<0.03, k=Math.round(h2);
  const a=names[Math.floor(h2)], b=names[Math.min(6,Math.floor(h2)+1)], src=near ? SHAPES[WY_KEYS[fk][k]] : null;
  const name = near ? names[k] : `Part-way shape (${a.replace(/ \(.*\)/,'').toLowerCase()} → ${b.replace(/ \(.*\)/,'').toLowerCase()})`;
  const E=r.edges.length;
  return { name, alt: `${WY_FAM[fk].label} · cut ${s.toFixed(2)} of 3`, verts:r.verts, edges:r.edges, cells:(near ? src : SHAPES[WY_KEYS[fk][2*Math.min(2,Math.floor(s))+1]]).cells, morph:{fk,s}, ver:++morphVer,
    ckey: near ? COUSIN[WY_KEYS[fk][k]] : null, tk: E>3000?0.2:E>1000?0.3:E>300?0.5:0.75,
    info: (near && src && src.info ? src.info+' ' : '') + `One mirror-point is sliding through the ${WY_FAM[fk].label}: at 0 it's the ${names[0].toLowerCase()}, at 3 the ${names[6].replace(/ \(.*\)/,'').toLowerCase()}. Whole and half steps are the named shapes, where every edge is the same length; in between, the corners stay joined the same way but two edge lengths differ. Every shape in the family has the same symmetry.` }; }
