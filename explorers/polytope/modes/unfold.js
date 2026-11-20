import { shared } from '../shared.js';
import { lerpN } from '../util.js';
import { st } from '../state.js';
import { wColor } from '../render/colour.js';
import { cellAdjacency, cross, dot3, dotN, hyperNormal, nrm, shapeCtx, smooth, subN, topo } from '../geometry/common.js';
import { SHAPES } from '../geometry/polytopes.js';
import { centroid } from './build.js';

// ---------- Unfold: hinge every cell open into a 3D net ----------
function cellNormal(sh, c){
  const P=c.map(i=>sh.verts[i]), v0=P[0];
  for (let a=1;a<P.length;a++) for (let b=a+1;b<P.length;b++) for (let d=b+1;d<P.length;d++){
    const n=hyperNormal([subN(P[a],v0),subN(P[b],v0),subN(P[d],v0)]), l=Math.hypot(...n);
    if (l>1e-8){ const u=n.map(x=>x/l); return dotN(u,v0)<0 ? u.map(x=>-x) : u; } }
}
export function hingeApply(x, h, u){   // turn about the shared face, in the plane of the two cells' normals
  const d=subN(x,h.f0), a=dotN(d,h.e1), b=dotN(d,h.e2), ph=h.alpha*u, c=Math.cos(ph), s=Math.sin(ph);
  const a2=a*c+b*s, b2=-a*s+b*c;
  return x.map((xi,i)=>xi+(a2-a)*h.e1[i]+(b2-b)*h.e2[i]);
}
function unfoldPositions(sh, U, u){
  const out=[];
  for (const c of U.order){ let pts=sh._cells[c].map(i=>sh.verts[i]);
    for (let x=c; U.parent[x]>=0; x=U.parent[x]){ const h=U.hinge[x]; pts=pts.map(p=>hingeApply(p,h,u)); }
    for (const p of pts) out.push(U.align(p)); }
  return out;
}
export function unfoldData(sh){
  if (sh._unf && sh._unfSeed===shared.netSeed) return sh._unf;
  topo(sh); const adj=cellAdjacency(sh), cells=sh._cells, N=cells.length, V=sh.verts;
  const nrmC=cells.map(c=>cellNormal(sh,c));
  let root=0; cells.forEach((c,i)=>{ if (c.length>cells[root].length) root=i; });   // the biggest cell sits in the middle of the net
  // other nets: a different centre cell, and the cells glued on in a random order (each choice of which faces stay joined is a different net)
  let rnd=shared.netSeed*2654435761>>>0; const rand=()=>{ rnd=(rnd+0x6D2B79F5)>>>0; let t=rnd; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; };
  if (shared.netSeed) root=Math.floor(rand()*N);
  const faceOf=new Map(); sh._faces.forEach((f,fi)=>{ const cs=sh._faceCells[fi]; if (cs.length===2){ faceOf.set(cs[0]+','+cs[1],f); faceOf.set(cs[1]+','+cs[0],f); } });
  const parent=new Array(N).fill(-1), hinge=new Array(N).fill(null), order=[root], seen=new Set([root]);
  const attach=(c,nb)=>{ seen.add(nb); order.push(nb); parent[nb]=c;
      const f=faceOf.get(c+','+nb), np=nrmC[c], nc=nrmC[nb], cs=Math.max(-1,Math.min(1,dotN(nc,np)));
      hinge[nb]={ f0:centroid(f.map(i=>V[i])), e1:np, e2:nrm(nc.map((x,i)=>x-cs*np[i])), alpha:Math.acos(cs) }; };
  if (!shared.netSeed){ for (let h=0;h<order.length;h++){ const c=order[h]; for (const nb of adj[c]) if (!seen.has(nb)) attach(c,nb); } }
  else { const front=[]; const push=c=>{ for (const nb of adj[c]) front.push([c,nb]); }; push(root);
    while (front.length){ const i=Math.floor(rand()*front.length), [c,nb]=front[i]; front[i]=front[front.length-1]; front.pop();
      if (!seen.has(nb)){ attach(c,nb); push(nb); } } }
  const a=nrmC[root]; let b=[0,0,0,-1]; if (dotN(a,b)<-0.99) b=[0,0,0,1];
  const cAB=dotN(a,b), ab=a.map((x,i)=>x+b[i]);
  const align=x=>{ const k1=dotN(ab,x)/(1+cAB), k2=2*dotN(a,x); return x.map((xi,i)=>xi-k1*ab[i]+k2*b[i]); };  // root cell's space -> flat
  const Olocal=[], edges=[], edgeCell=[], vertCell=[];
  for (const c of order){ const idx=new Map();
    cells[c].forEach(v=>{ idx.set(v,Olocal.length); Olocal.push(V[v]); vertCell.push(c); });
    for (const e of sh._cellEdges[c]){ const [x,y]=sh.edges[e]; edges.push([idx.get(x),idx.get(y)]); edgeCell.push(c); } }
  const rank=new Array(N); order.forEach((c,i)=>rank[c]=i);
  const U={order, parent, hinge, align, Olocal, edges, edgeCell, vertCell, rank, N}; sh._unfSeed=shared.netSeed;
  // does the finished net pass through itself? test points of each cell (corners, edge midpoints, face centres, centre)
  // against the face planes of every nearby cell, in the flat 3D net
  const cellFaces=cells.map(()=>[]); sh._faceCells.forEach((cs,fi)=>cs.forEach(c=>cellFaces[c].push(fi)));
  const P=unfoldPositions(sh,U,1), loc=new Array(N); let o=0;
  for (const c of order){ const m=new Map(); cells[c].forEach((v,k)=>m.set(v,P[o+k].slice(0,3))); loc[c]=m; o+=cells[c].length; }
  const geo=cells.map((c,ci)=>{ const m=loc[ci], pts=[...m.values()], cc=centroid(pts);
    const planes=cellFaces[ci].map(fi=>{ const f=sh._faces[fi].map(v=>m.get(v)), fc=centroid(f);
      let n=nrm(cross(subN(f[1],f[0]),subN(f[2],f[0]))); if (dot3(n,subN(cc,fc))<0) n=n.map(x=>-x); return {n, d:dot3(n,fc)}; });
    const probe=[cc, ...pts, ...sh._cellEdges[ci].map(e=>lerpN(m.get(sh.edges[e][0]),m.get(sh.edges[e][1]),0.5)),
      ...cellFaces[ci].map(fi=>centroid(sh._faces[fi].map(v=>m.get(v))))];
    return {cc, R:Math.max(...pts.map(q=>Math.hypot(...subN(q,cc)))), planes, probe}; });
  const inside=(q,g)=>g.planes.every(pl=>dot3(pl.n,q)-pl.d>1e-7);
  U.overlap=false;
  for (let i=0;i<N && !U.overlap;i++) for (let j=0;j<N;j++){ if (i===j) continue; const gi=geo[i], gj=geo[j];
    if (Math.hypot(...subN(gi.cc,gj.cc))>=gi.R+gj.R) continue;
    if (gi.probe.some(q=>inside(q,gj))){ U.overlap=true; break; } }
  return sh._unf=U;
}
// ---------- Unfold, stage 2: flatten the 3D net into 2D (every cell opens into its own net of polygons) ----------
function rodrigues(v, k, th){ const c=Math.cos(th), s=Math.sin(th), kv=dot3(k,v), kx=cross(k,v); return [0,1,2].map(i=>v[i]*c+kx[i]*s+k[i]*kv*(1-c)); }
export function flatData(sh){
  if (sh._flat && sh._flat.U===unfoldData(sh)) return sh._flat;
  const U=unfoldData(sh), P1=unfoldPositions(sh,U,1), cells=sh._cells, N=cells.length, w0=P1[0][3];
  const cellFaces=cells.map(()=>[]); sh._faceCells.forEach((cs,fi)=>cs.forEach(c=>cellFaces[c].push(fi)));
  let o=0; const per=[];
  for (const c of U.order){
    const pos=new Map(); cells[c].forEach((v,k)=>pos.set(v, P1[o+k].slice(0,3))); o+=cells[c].length;
    const cc=centroid([...pos.values()]), fs=cellFaces[c];
    const F=fs.map(fi=>{ const vs=sh._faces[fi], P=vs.map(v=>pos.get(v)), fc=centroid(P);
      let n=nrm(cross(subN(P[1],P[0]),subN(P[2],P[0]))); if (dot3(n,subN(fc,cc))<0) n=n.map(x=>-x);
      const e1=nrm(subN(P[0],fc)), e2=cross(n,e1);
      const ord=vs.map((v,k)=>({v, a:Math.atan2(dot3(subN(P[k],fc),e2),dot3(subN(P[k],fc),e1))})).sort((x,y)=>x.a-y.a).map(q=>q.v);
      return {fi, ord, n, fc}; });
    // faces of this cell that share an edge
    const edgeF=new Map(); F.forEach((f,k)=>f.ord.forEach((v,i)=>{ const u=f.ord[(i+1)%f.ord.length], key=Math.min(u,v)+','+Math.max(u,v); if (!edgeF.has(key)) edgeF.set(key,[]); edgeF.get(key).push(k); }));
    let root=0; F.forEach((f,k)=>{ if (f.ord.length>F[root].ord.length) root=k; });
    const parent=new Array(F.length).fill(-1), hinge=new Array(F.length).fill(null), order=[root], seen=new Set([root]);
    for (let hh=0;hh<order.length;hh++){ const k=order[hh], f=F[k];
      f.ord.forEach((v,i)=>{ const u=f.ord[(i+1)%f.ord.length]; for (const nb of edgeF.get(Math.min(u,v)+','+Math.max(u,v))) if (!seen.has(nb)){ seen.add(nb); order.push(nb); parent[nb]=k;
        const np=f.n, nc=F[nb].n, cs=Math.max(-1,Math.min(1,dot3(nc,np)));
        hinge[nb]={ f0:lerpN(pos.get(u),pos.get(v),0.5), e1:np, e2:nrm(nc.map((x,j)=>x-cs*np[j])), alpha:Math.acos(cs) }; } }); }
    // turn the flat net so it faces up (+Z)
    const nr=F[root].n, ax=cross(nr,[0,0,1]), axl=Math.hypot(...ax);
    const k = axl>1e-9 ? ax.map(x=>x/axl) : [1,0,0], th = axl>1e-9 ? Math.acos(Math.max(-1,Math.min(1,nr[2]))) : (nr[2]<0?Math.PI:0);
    const flatPts=(fFrac)=>F.map((f,kk)=>{ let pts=f.ord.map(v=>pos.get(v)); for (let x=kk; parent[x]>=0; x=parent[x]) pts=pts.map(p=>hingeApply(p,hinge[x],fFrac)); return pts; });
    const P=flatPts(1), cr=F[root].fc, rad=Math.max(...P.flat().map(p=>Math.hypot(...subN(rodrigues(subN(p,cr),k,th),[0,0,0]))));
    per.push({c, F, pos, flatPts, cr, k, th, rad});
  }
  const cols=Math.ceil(Math.sqrt(N)), rows=Math.ceil(N/cols), sp=2.15*Math.max(...per.map(q=>q.rad));
  per.forEach((q,i)=>{ const r=Math.floor(i/cols), cIdx=i%cols; q.slot=[(cIdx-(cols-1)/2)*sp, ((rows-1)/2-r)*sp, 0]; });
  const nPoly=per.reduce((s,q)=>s+q.F.length,0);
  return sh._flat={per, w0, nPoly, U};
}
function flattenSource(){
  const sh=shapeCtx(SHAPES[st.shape]), FD=flatData(sh), f=st.unf.f, e=smooth(f), V=[], O=[], edges=[], edgeCell=[], vertCell=[];
  for (const q of FD.per){
    const polys=q.flatPts(e), slot=q.slot, cr=q.cr;
    const place=p=>{ const r=rodrigues(subN(p,cr), q.k, q.th*e); return [0,1,2].map(i=>cr[i]+(slot[i]-cr[i])*e+r[i]); };
    polys.forEach(pts=>{ const b=V.length; pts.forEach(p=>{ V.push([...place(p), FD.w0]); O.push([0,0,0,0]); vertCell.push(q.c); });
      for (let i=0;i<pts.length;i++){ edges.push([b+i, b+(i+1)%pts.length]); edgeCell.push(q.c); } });
  }
  const m=[0,1,2].map(a=>V.reduce((s,p)=>s+p[a],0)/V.length);
  const col=c=>wColor(-1+2*FD.U.rank[c]/Math.max(1,FD.U.N-1)), big=V.length>2500;
  return { O, V:V.map(p=>[p[0]-m[0],p[1]-m[1],p[2]-m[2],p[3]]), edges, fam:edges.map(()=>-1), amax:sh.amax, wmax:sh.wmax, tk:(sh.tk||1)*1.0, proj:'persp', curved:false,
    edgeCol:i=>col(edgeCell[i]), ballMul:V.map(()=>big?0:0.6), ballCol:n=>col(vertCell[n]).map(x=>Math.min(1,x*1.15)) };
}
export function unfoldSource(){
  if (st.unf.f>0) return flattenSource();
  const sh=shapeCtx(SHAPES[st.shape]), U=unfoldData(sh), P=unfoldPositions(sh,U,st.unf.u);
  const m=[0,1,2].map(a=>P.reduce((s,p)=>s+p[a],0)/P.length);
  const col=c=>wColor(-1+2*U.rank[c]/Math.max(1,U.N-1));
  return { O:U.Olocal, V:P.map(p=>[p[0]-m[0],p[1]-m[1],p[2]-m[2],p[3]]), edges:U.edges, fam:U.edges.map(()=>-1),
    amax:sh.amax, wmax:sh.wmax, tk:(sh.tk||1)*1.1, proj:'persp', curved:false,
    edgeCol:i=>col(U.edgeCell[i]), ballCol:n=>col(U.vertCell[n]).map(x=>Math.min(1,x*1.15)) };
}
