import { maxOf } from './common.js';

const norm4 = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
export function edgesByMinDist(V){
  let min = Infinity; const d = [];
  for (let i=0;i<V.length;i++) for (let j=i+1;j<V.length;j++){
    const dd = Math.hypot(V[i][0]-V[j][0],V[i][1]-V[j][1],V[i][2]-V[j][2],V[i][3]-V[j][3]);
    d.push([i,j,dd]); if (dd < min) min = dd;
  }
  return d.filter(e => e[2] < min*1.001).map(e => [e[0],e[1]]);
}
export const PHI = (1+Math.sqrt(5))/2;
const PERMS = (() => { const out=[]; const go=(a,r)=>{ if(!r.length){out.push(a);return;} r.forEach((x,i)=>go([...a,x],[...r.slice(0,i),...r.slice(i+1)])); }; go([],[0,1,2,3]); return out; })();
const parity = pm => { let n=0; for (let i=0;i<4;i++) for (let j=i+1;j<4;j++) if (pm[i]>pm[j]) n++; return n%2; };
// a fixed generic 4D turn, so no corner sits on the projection pole
export function tilt(v, t){ const c=Math.cos(t), s=Math.sin(t), c2=Math.cos(t*1.7), s2=Math.sin(t*1.7);
  let [x,y,z,w]=v; [z,w]=[c*z-s*w, s*z+c*w]; [x,w]=[c2*x-s2*w, s2*x+c2*w]; [x,y]=[c*x-s*y, s*x+c*y]; return [x,y,z,w]; }
export const CELL600 = (() => { const o=[];
  for (let a=0;a<4;a++) for (const s of [1,-1]){ const v=[0,0,0,0]; v[a]=s; o.push(v); }      // 8
  for (let s=0;s<16;s++) o.push([0,1,2,3].map(i=>(s>>i&1)?-0.5:0.5));                          // 16  (these 24 = a 24-cell)
  const base=[PHI/2,0.5,1/(2*PHI),0];
  for (const pm of PERMS.filter(p=>!parity(p))) for (let s=0;s<8;s++){ const v=[0,0,0,0];
    for (let k=0;k<4;k++) v[pm[k]] = base[k]*((k<3 && (s>>k&1))?-1:1); o.push(v); }            // 96
  return o; })();
// 5-cell family: coordinates in 5D on the hyperplane sum = const, mapped into 4D
const B5 = (() => { const basis=[]; for (const r of [[1,-1,0,0,0],[0,1,-1,0,0],[0,0,1,-1,0],[0,0,0,1,-1]]){
  let v=r.slice(); for (const b of basis){ const d=v.reduce((s,x,k)=>s+x*b[k],0); v=v.map((x,k)=>x-d*b[k]); }
  const l=Math.hypot(...v); basis.push(v.map(x=>x/l)); } return basis; })();
function perms5(base){ const seen=new Set(), out=[];
  const go=(a,r)=>{ if(!r.length){ const k=a.join(); if(!seen.has(k)){seen.add(k); out.push(a);} return; }
    r.forEach((x,i)=>go([...a,x],[...r.slice(0,i),...r.slice(i+1)])); };
  go([],base); return out.map(e => { const m=e.reduce((s,x)=>s+x,0)/5; const c=e.map(x=>x-m);
    return norm4(B5.map(b=>b.reduce((s,x,i)=>s+x*c[i],0))); }); }
function signedPerms4(base){ const seen=new Set(), out=[];
  for (const pm of PERMS) for (let s=0;s<16;s++){ const v=pm.map((b,i)=>(s>>i&1)?-base[b]:base[b]);
    const k=v.map(x=>x.toFixed(6)).join(); if(!seen.has(k)){seen.add(k); out.push(norm4(v));} }
  return out; }
// turn a shape so no corner sits near the stereographic pole (keeps the 3D shadow finite)
   // safe for very long lists
export function autoTilt(V){ const mw = A => maxOf(A, v=>v[3]);
  if (mw(V) <= 0.8) return V; let best=[9,0];
  for (let t=0;t<Math.PI;t+=0.01){ const m=mw(V.map(v=>tilt(v,t))); if (m<best[0]) best=[m,t]; }
  return V.map(v=>tilt(v,best[1])); }
export const dot4 = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];
export function makeDuo(p, q){
  const k1=1/Math.sin(Math.PI/p), k2=1/Math.sin(Math.PI/q), L=Math.hypot(k1,k2), r1=k1/L, r2=k2/L;
  const verts=[], edges=[];
  for (let i=0;i<p;i++) for (let j=0;j<q;j++){
    const a=(i+0.5)*2*Math.PI/p, b=(j+0.25)*2*Math.PI/q;
    verts.push([r1*Math.cos(a), r1*Math.sin(a), r2*Math.cos(b), r2*Math.sin(b)]);
    edges.push([i*q+j, ((i+1)%p)*q+j], [i*q+j, i*q+(j+1)%q]);
  }
  const gon = n => ({3:'triangle',4:'square',5:'pentagon',6:'hexagon',8:'octagon'})[n] || n+'-gon';
  return { name:`${p}-${q} duoprism`, alt:`${gon(p)} × ${gon(q)}: ${p} ${gon(q)} prisms + ${q} ${gon(p)} prisms`,
           cells:p+q, tk: p*q>100 ? 0.6 : 0.85, verts:autoTilt(verts), edges,
           info:`Every corner of a ${gon(p)} paired with every corner of a ${gon(q)}. The prisms form two rings that link like chain links. Set both sliders to 4 and you get the tesseract.` };
}
export const SHAPES = {
  5: { name:'5-cell', alt:'pentachoron (4D tetrahedron)', cells:5, verts:(() => {
        const basis = []; const raw = [[1,-1,0,0,0],[0,1,-1,0,0],[0,0,1,-1,0],[0,0,0,1,-1]];
        for (const r of raw){ let v = r.slice();
          for (const b of basis){ const d = v.reduce((s,x,k)=>s+x*b[k],0); v = v.map((x,k)=>x-d*b[k]); }
          const l = Math.hypot(...v); basis.push(v.map(x=>x/l)); }
        const out = [];
        for (let k=0;k<5;k++){ const e = [0,0,0,0,0].map((_,i)=>(i===k?1:0)-0.2);
          out.push(norm4(basis.map(b=>b.reduce((s,x,i)=>s+x*e[i],0)))); }
        // tilt so no vertex sits at the projection pole
        return out.map(v => [v[0], v[1]*0.8+v[3]*0.6, v[2], -v[1]*0.6+v[3]*0.8]);
      })() },
  8: { name:'Tesseract', alt:'8-cell (4D cube)', cells:8, verts:(() => {
        const o=[]; for (let i=0;i<16;i++) o.push([0,1,2,3].map(b => (i>>b&1)?0.5:-0.5)); return o; })() },
  16:{ name:'16-cell', alt:'hexadecachoron (4D octahedron)', cells:16, verts:(() => {
        const o=[]; for (let a=0;a<4;a++) for (const s of [1,-1]){ const v=[0,0,0,0]; v[a]=s; o.push(v); }
        // rotate 45° in XW and YZ so no vertex is at the pole
        const c=Math.SQRT1_2; return o.map(v=>norm4([c*(v[0]-v[3]),c*(v[1]-v[2]),c*(v[1]+v[2]),c*(v[0]+v[3])+0.0001])); })() },
  24:{ name:'24-cell', alt:'icositetrachoron (no 3D cousin)', cells:24, verts:(() => {
        const o=[];
        for (let a=0;a<4;a++) for (let b=a+1;b<4;b++) for (const sa of [1,-1]) for (const sb of [1,-1]){
          const v=[0,0,0,0]; v[a]=sa; v[b]=sb; o.push(norm4(v)); }
        return o; })() },
  tt:{ name:'Truncated tesseract', alt:'8 truncated cubes (octagons) + 16 tetrahedra', cells:24, verts:(() => {
        const a = 1+Math.SQRT2, o=[];
        for (let p=0;p<4;p++) for (let s=0;s<16;s++){
          const v=[a,a,a,a]; v[p]=1; o.push(norm4(v.map((x,i)=>(s>>i&1)?-x:x))); }
        return o; })() },
  rt:{ name:'Rectified tesseract', alt:'8 cuboctahedra + 16 tetrahedra', cells:24, tk:0.8, verts:(() => {
        const o=[]; for (let p=0;p<4;p++) for (let s=0;s<8;s++){ let k=0;
          o.push(norm4([0,1,2,3].map(i => i===p ? 0 : ((s>>(k++)&1)?-1:1)))); }
        return o.map(v=>tilt(v,0.25)); })() },
  ot:{ name:'Omnitruncated tesseract', alt:'every corner, edge & face of the tesseract shaved', cells:80, tk:0.42, verts:(() => {
        const r2=Math.SQRT2, base=[1,1+r2,1+2*r2,1+3*r2], o=[];
        for (const pm of PERMS) for (let s=0;s<16;s++)
          o.push(norm4(pm.map((b,i)=>(s>>i&1)?-base[b]:base[b])));
        return o; })() },
  120:{ name:'120-cell', alt:'120 dodecahedra, the 4D dodecahedron', cells:120, tk:0.34, verts:null },
  600:{ name:'600-cell', alt:'600 tetrahedra, the 4D icosahedron', cells:600, tk:0.45, verts:CELL600 },
  s24:{ name:'Snub 24-cell', alt:'24 icosahedra + 120 tetrahedra (600-cell minus a 24-cell)', cells:144, tk:0.55,
        verts:CELL600.slice(24) },
  bt:{ name:'Bitruncated tesseract', alt:'8 truncated octahedra + 16 truncated tetrahedra', cells:24, tk:0.6,
        verts:signedPerms4([0,1,2,2]) },
  r5:{ name:'Rectified 5-cell', alt:'5 octahedra + 5 tetrahedra', cells:10, verts:perms5([0,0,0,1,1]) },
  ru5:{ name:'Runcinated 5-cell', alt:'10 tetrahedra + 20 triangular prisms', cells:30, tk:0.85, verts:perms5([0,1,1,1,2]) },
  o5:{ name:'Omnitruncated 5-cell', alt:'4D permutohedron: 10 truncated octahedra + 20 hexagonal prisms', cells:30, tk:0.55, verts:perms5([0,1,2,3,4]) },
  ga:{ name:'Grand antiprism', alt:'20 pentagonal antiprisms + 300 tetrahedra', cells:320, tk:0.5, verts:(() => {
        const V=CELL600, [a,b]=edgesByMinDist(V)[0], e1=V[a];
        const e2=norm4(V[b].map((x,i)=>x-dot4(V[b],e1)*e1[i]));
        const inPlane = w => Math.abs(Math.hypot(dot4(w,e1),dot4(w,e2))-1) < 1e-6;
        const ortho = w => Math.abs(dot4(w,e1)) < 1e-6 && Math.abs(dot4(w,e2)) < 1e-6;
        return V.filter(w => !inPlane(w) && !ortho(w)); })() },
  ru8:{ name:'Runcinated tesseract', alt:'8 + 24 cubes, 32 triangular prisms, 16 tetrahedra', cells:80, tk:0.6, verts:signedPerms4([0,0,0,1+Math.SQRT2].map((x,i)=>i<3?1:x)) },
  ca8:{ name:'Cantellated tesseract', alt:'8 rhombicuboctahedra, 16 octahedra, 32 triangular prisms', cells:56, tk:0.55, verts:signedPerms4([1,1,1+Math.SQRT2,1+Math.SQRT2]) },
  t5:{ name:'Truncated 5-cell', alt:'5 truncated tetrahedra + 5 tetrahedra', cells:10, tk:0.9, verts:perms5([0,0,0,1,2]) },
  bt5:{ name:'Bitruncated 5-cell', alt:'10 identical truncated tetrahedra (decachoron)', cells:10, tk:0.85, verts:perms5([0,0,1,2,2]) },
  ca5:{ name:'Cantellated 5-cell', alt:'5 cuboctahedra, 5 octahedra, 10 triangular prisms', cells:20, tk:0.8, verts:perms5([0,0,1,1,2]) },
  r24:{ name:'Rectified 24-cell', alt:'24 cuboctahedra + 24 cubes (no 3D cousin)', cells:48, tk:0.55, verts:signedPerms4([0,1,1,2]) },
  t24:{ name:'Truncated 24-cell', alt:'24 truncated octahedra + 24 cubes (no 3D cousin)', cells:48, tk:0.45, verts:signedPerms4([0,1,2,3]) },
  r600:{ name:'Rectified 600-cell', alt:'600 octahedra + 120 icosahedra', cells:720, tk:0.3, verts:null },
  r120:{ name:'Rectified 120-cell', alt:'120 icosidodecahedra + 600 tetrahedra', cells:720, tk:0.25, verts:null },
  d:{ name:'Duoprism', alt:'', cells:0, verts:[] },
};
// 120-cell = dual of the 600-cell: one corner at the centre of each of its 600 tetrahedra
(() => { const V=CELL600, E=edgesByMinDist(V), adj=V.map(()=>new Set());
  E.forEach(([a,b])=>{adj[a].add(b); adj[b].add(a);});
  const out=[];
  for (let a=0;a<V.length;a++) for (const b of adj[a]) if (b>a) for (const c of adj[a]) if (c>b && adj[b].has(c))
    for (const d of adj[a]) if (d>c && adj[b].has(d) && adj[c].has(d))
      out.push(norm4([0,1,2,3].map(i=>V[a][i]+V[b][i]+V[c][i]+V[d][i])));
  SHAPES[120].verts = out; })();
// rectified 600-cell and 120-cell: one corner at the middle of every edge of the parent.
// They're big, so they're worked out the first time someone picks them, not at start-up.
const LAZY = {r600:()=>CELL600, r120:()=>SHAPES[120].verts};
for (const k in LAZY){ let cache=null; const sh=SHAPES[k];
  const init=()=>{ if (!cache){ const parent=LAZY[k](), E=edgesByMinDist(parent);
    const V=autoTilt(E.map(([a,b])=>norm4(parent[a].map((x,i)=>x+parent[b][i])))); cache={verts:V, edges:edgesByMinDist(V)}; } return cache; };
  delete sh.verts; Object.defineProperty(sh,'verts',{get:()=>init().verts, configurable:true});
  Object.defineProperty(sh,'edges',{get:()=>init().edges, configurable:true}); }
for (const k in SHAPES) if (k!=='d' && k!=='r600' && k!=='r120'){ SHAPES[k].verts = autoTilt(SHAPES[k].verts); SHAPES[k].edges = edgesByMinDist(SHAPES[k].verts); }
SHAPES.d = makeDuo(8,8);
export const INFO = {
  5:'The simplest 4D shape: 5 corners, each joined to all the others. Its 5 cells are tetrahedra, and 3 meet around every edge.',
  8:'The 4D cube. Its 8 cubic cells are glued so 3 cubes meet around every edge. Rotate in XW and watch the inner cube swap places with an outer one.',
  16:'The 4D octahedron: one corner at ±1 on each of the 4 axes. 16 tetrahedra, 4 around every edge. It\'s the tesseract\'s dual: one corner at the centre of each of the tesseract\'s cubes.',
  24:'Has no 3D equivalent. 24 octahedral cells, and it\'s its own dual. Its 24 corners are also the 24 spheres that can touch one central sphere in the densest known 4D packing.',
  120:'The 4D dodecahedron: 120 dodecahedra with 3 around every edge, 600 corners. Turning it feels like flying through soap-bubble foam.',
  600:'The 4D icosahedron: 600 tetrahedra with 5 around every edge. Its 120 corners split into 12 rings of 10 that never touch, a pattern linked to the Hopf fibration.',
  rt:'Shave the tesseract\'s corners down to the midpoints of its edges. Each cube becomes a cuboctahedron, and each removed corner leaves a tetrahedron.',
  tt:'Slice each corner off the tesseract just enough to turn its squares into octagons: 8 truncated cubes plus 16 small tetrahedra.',
  bt:'Cut so deep that the tesseract and its dual, the 16-cell, meet halfway: 8 truncated octahedra from the cubes and 16 truncated tetrahedra from the 16-cell.',
  ot:'Every corner, edge and face of the tesseract shaved off: 384 corners and 80 cells (truncated cuboctahedra, truncated octahedra, octagonal prisms and hexagonal prisms).',
  r5:'The 5-cell with its corners shaved down to the edge midpoints: 5 octahedra plus 5 tetrahedra.',
  ru5:'Push the 5-cell\'s cells apart and fill the gaps: 10 tetrahedra (5 from its cells, 5 from its corners) linked by 20 triangular prisms.',
  o5:'The 4D permutohedron. Its 120 corners are all the ways to shuffle 0, 1, 2, 3, 4, and every edge swaps two neighbouring numbers. Cells: 10 truncated octahedra and 20 hexagonal prisms.',
  s24:'Delete a 24-cell\'s worth of corners from the 600-cell and each hole becomes an icosahedron: 24 icosahedra plus 120 tetrahedra.',
  ga:'Found by Conway and Guy in 1965 with a computer search. It\'s the 600-cell minus two linked rings of 10 corners: two interlocking towers of 10 pentagonal antiprisms, wrapped in 300 tetrahedra.',
};
Object.assign(INFO, {
  ru8:'Push the tesseract\'s 8 cubes apart and fill the gaps: the gaps between pairs of cubes become 24 more cubes, the gaps along the edges become 32 triangular prisms, and the corners become 16 tetrahedra. You get the same shape by doing this to the 16-cell.',
  ca8:'Cut the tesseract\'s edges and corners back: the cubes become 8 rhombicuboctahedra, the corners leave 16 octahedra, and the edges leave 32 triangular prisms.',
  t5:'The 5-cell with its corners sliced off: 5 truncated tetrahedra, with a small tetrahedron filling the hole left at each corner.',
  bt5:'Slice the 5-cell so deeply that it meets its own dual halfway. All 10 cells are identical truncated tetrahedra, and the shape looks the same from every cell. It\'s sometimes called the decachoron.',
  ca5:'The 5-cell with its edges and corners cut back: 5 cuboctahedra, 5 octahedra and 10 triangular prisms.',
  r24:'The 24-cell with its corners shaved down to the middles of its edges: 24 cuboctahedra and 24 cubes. Like the 24-cell itself, it has no 3D cousin.',
  t24:'The 24-cell with its corners sliced off: 24 truncated octahedra and 24 cubes. Its 192 corners are every arrangement of 0, 1, 2 and 3 with any signs.',
  r600:'The 600-cell shaved down to the middles of its 720 edges: 720 corners, 600 octahedra and 120 icosahedra. A giant, so give it a moment to work out its cells.',
  r120:'The 120-cell shaved down to the middles of its 1,200 edges: 1,200 corners, 120 icosidodecahedra and 600 tetrahedra. The biggest shape here.',
});
for (const k in INFO) SHAPES[k].info = INFO[k];
