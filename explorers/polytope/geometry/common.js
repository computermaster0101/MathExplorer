// ---------- generic geometry ----------
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const nrm=a=>{const l=Math.hypot(...a)||1;return a.map(x=>x/l);};
export const dotN=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;};
export const subN=(a,b)=>a.map((x,i)=>x-b[i]);
const det3=(a,b,c)=>a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);
export const smooth=x=>x*x*(3-2*x);
export const gon = n => ({3:'triangle',4:'square',5:'pentagon',6:'hexagon',7:'heptagon',8:'octagon',10:'decagon',12:'dodecagon'})[n] || n+'-gon';
export function edgesMinDistN(V){
  let min=Infinity; const d=[];
  for (let i=0;i<V.length;i++) for (let j=i+1;j<V.length;j++){ const dd=Math.hypot(...subN(V[i],V[j])); d.push([i,j,dd]); if (dd<min) min=dd; }
  return d.filter(e=>e[2]<min*1.001).map(e=>[e[0],e[1]]);
}
// normal to the hyperplane spanned by D-1 vectors in D dimensions (D = 3 or 4)
export function hyperNormal(vs){
  if (vs.length===2) return cross(vs[0],vs[1]);
  const [u,v,w]=vs;
  return [0,1,2,3].map(k=>{ const c=[0,1,2,3].filter(i=>i!==k); return (k%2?-1:1)*det3(c.map(i=>u[i]),c.map(i=>v[i]),c.map(i=>w[i])); });
}
// facets of a convex polytope centred on the origin (cells in 4D, faces in 3D)
export function findFacets(V, E){
  const D=V[0].length, adj=V.map(()=>[]); E.forEach(([a,b])=>{adj[a].push(b);adj[b].push(a);});
  const seen=new Set(), out=[];
  const tryPlane=(v,nb)=>{
    let n=hyperNormal(nb.map(b=>subN(V[b],V[v]))); const L=Math.hypot(...n); if (L<1e-9) return;
    n=n.map(x=>x/L); let d=dotN(n,V[v]); if (d<0){ n=n.map(x=>-x); d=-d; } if (d<1e-7) return;
    const on=[]; for (let i=0;i<V.length;i++){ const s=dotN(n,V[i]); if (s>d+1e-6) return; if (s>d-1e-6) on.push(i); }
    const key=on.join(','); if (!seen.has(key)){ seen.add(key); out.push(on); }
  };
  for (let v=0;v<V.length;v++){ const nb=adj[v];
    if (D===3){ for (let a=0;a<nb.length;a++) for (let b=a+1;b<nb.length;b++) tryPlane(v,[nb[a],nb[b]]); }
    else { for (let a=0;a<nb.length;a++) for (let b=a+1;b<nb.length;b++) for (let c=b+1;c<nb.length;c++) tryPlane(v,[nb[a],nb[b],nb[c]]); }
  }
  return out;
}
export function edgesWithin(sets, edges, N){
  const ek=new Map(); edges.forEach(([a,b],i)=>ek.set(Math.min(a,b)*N+Math.max(a,b), i));
  return sets.map(s=>{ const out=[]; for (let x=0;x<s.length;x++) for (let y=x+1;y<s.length;y++){ const k=ek.get(s[x]*N+s[y]); if (k!==undefined) out.push(k); } return out; });
}
// cells, 2D faces and their edges for a 4D shape (computed once, on demand)
export function topo(sh){
  if (sh._cells) return sh;
  const N=sh.verts.length, cells=findFacets(sh.verts, sh.edges);
  const vc=Array.from({length:N},()=>[]); cells.forEach((c,ci)=>c.forEach(v=>vc[v].push(ci)));
  const faces=[], fseen=new Set();
  cells.forEach((c,ci)=>{ const cnt=new Map();
    for (const v of c) for (const o of vc[v]) if (o>ci) cnt.set(o,(cnt.get(o)||0)+1);
    for (const [o,n] of cnt) if (n>=3){ const s=new Set(cells[o]); const f=c.filter(v=>s.has(v)); const k=f.join(','); if (!fseen.has(k)){ fseen.add(k); faces.push(f); } } });
  sh._cells=cells; sh._cellEdges=edgesWithin(cells, sh.edges, N); sh._faces=faces; sh._faceEdges=edgesWithin(faces, sh.edges, N);
  return sh;
}
export function shapeCtx(sh){
  if (sh.amax) return sh;
  sh.amax=[0,1,2,3].map(a=>maxOf(sh.verts, v=>Math.abs(v[a]))||1);
  sh.wmax=sh.amax[3];
  sh.fam=sh.edges.map(([i,j])=>{ const d=[0,1,2,3].map(a=>Math.abs(sh.verts[i][a]-sh.verts[j][a])); return d.indexOf(Math.max(...d)); });
  return sh;
}
const ADJ={3:'triangular',4:'square',5:'pentagonal',6:'hexagonal',7:'heptagonal',8:'octagonal',9:'nonagonal',10:'decagonal',12:'dodecagonal'};
const FACE_NAMES={'3:4':'tetrahedron','4:6':'cube','3:8':'octahedron','5:12':'dodecahedron','3:20':'icosahedron','3:8,4:6':'cuboctahedron',
  '3:4,6:4':'truncated tetrahedron','4:6,6:8':'truncated octahedron','3:8,8:6':'truncated cube','4:12,6:8,8:6':'truncated cuboctahedron',
  '3:8,4:18':'rhombicuboctahedron','3:20,5:12':'icosidodecahedron'};
function cellFaceCounts(sh, ci){
  cellAdjacency(sh); if (!sh._cellFaces){ sh._cellFaces=sh._cells.map(()=>[]); sh._faceCells.forEach((cs,fi)=>cs.forEach(c=>sh._cellFaces[c].push(fi))); }
  const cnt={}; for (const fi of sh._cellFaces[ci]){ const n=sh._faces[fi].length; cnt[n]=(cnt[n]||0)+1; } return cnt;
}
function nameByFaces(cnt){
  const k=Object.keys(cnt).map(Number).sort((a,b)=>a-b), sig=k.map(x=>x+':'+cnt[x]).join(',');
  if (FACE_NAMES[sig]) return FACE_NAMES[sig];
  const big=k.find(n=>n!==4 && cnt[n]===2), other=k.find(n=>n!==big);
  if (big && k.length===2 && other===4 && cnt[4]===big) return `${ADJ[big]||big+'-gonal'} prism`;
  if (big && k.length===2 && other===3 && cnt[3]===2*big) return `${ADJ[big]||big+'-gonal'} antiprism`;
  return null;
}
export function cellName(key, nv, ne, sh, ci){
  if (sh && ci!=null){ const n=nameByFaces(cellFaceCounts(sh,ci)); if (n) return n; }
  if (key==='d' && ne===nv*1.5) return `${gon(nv/2)} prism`;
  const t={'4,6':'tetrahedron','6,12':'octahedron','6,9':'triangular prism','8,12':'cube','12,24':'cuboctahedron','12,30':'icosahedron',
           '20,30':'dodecahedron','10,20':'pentagonal antiprism','48,72':'truncated cuboctahedron','16,24':'octagonal prism'}[nv+','+ne];
  if (t) return t;
  if (nv===12 && ne===18) return key==='bt' ? 'truncated tetrahedron' : 'hexagonal prism';
  if (nv===24 && ne===36) return key==='tt' ? 'truncated cube' : 'truncated octahedron';
  return `${nv} corners`;
}

export const maxOf=(A,f)=>{ let m=-Infinity; for (let i=0;i<A.length;i++){ const x=f(A[i]); if (x>m) m=x; } return m; };
export function cellAdjacency(sh){
  if (sh._adj) return sh._adj; topo(sh);
  const vc=Array.from({length:sh.verts.length},()=>[]); sh._cells.forEach((c,ci)=>c.forEach(v=>vc[v].push(ci)));
  const adj=sh._cells.map(()=>[]), fc=[];
  sh._faces.forEach(f=>{ const cs=vc[f[0]].filter(c=>vc[f[1]].includes(c) && vc[f[2]].includes(c)); fc.push(cs);
    if (cs.length===2){ adj[cs[0]].push(cs[1]); adj[cs[1]].push(cs[0]); } });
  sh._faceCells=fc; return sh._adj=adj;
}
const POLY_NAME={3:'triangle',4:'quadrilateral',5:'pentagon',6:'hexagon',7:'heptagon',8:'octagon',9:'nonagon',10:'decagon',12:'dodecagon'};
export const polyName=n=>POLY_NAME[n]||`${n}-gon`;
export const binom=(n,k)=>{ if (k<0||k>n) return 0; let r=1; for (let i=0;i<k;i++) r=r*(n-i)/(i+1); return Math.round(r); };
