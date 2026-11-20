import { dotN, nrm, topo } from './common.js';

// ---------- faces as ordered polygons, for the see-through face fill ----------
function starFaceList(sh){
  if (sh._sfaces) return sh._sfaces; const V=sh.verts, N=V.map(()=>[]); sh.edges.forEach(([a,b])=>{ N[a].push(b); N[b].push(a); });
  const p=sh.sym.slice(1).split(',')[0], out=[], seen=new Set(), sub=(u,v)=>u.map((x,i)=>x-v[i]);
  if (p==='3'){ for (const [a,b] of sh.edges) for (const c of N[a]) if (c>b && c>a && N[b].includes(c)){ const k=[a,b,c].sort((x,y)=>x-y).join(); if (!seen.has(k)){ seen.add(k); out.push([a,b,c]); } } }
  else { const want = p==='5' ? 72 : 144;
    for (let a=0;a<V.length;a++) for (const b of N[a]) if (b>a) for (const c of N[b]) if (c>a && c!==b) for (const d of N[c]) if (d>a && d!==b) for (const e of N[d]) if (e>a && e!==b && e!==c && N[e].includes(a)){
      const cyc=[a,b,c,d,e], key=[...cyc].sort((x,y)=>x-y).join(); if (seen.has(key)) continue;
      const m=[0,1,2,3].map(i=>cyc.reduce((s,q)=>s+V[q][i],0)/5), R=cyc.map(q=>Math.hypot(...sub(V[q],m)));
      if (Math.max(...R)-Math.min(...R)>1e-6) continue;
      const u=sub(V[a],m), st2=Math.acos(Math.max(-1,Math.min(1,dotN(u,sub(V[b],m))/(R[0]*R[0]))))*180/Math.PI; if (Math.abs(st2-want)>1) continue;
      let ok=true; for (let i=0;i<5&&ok;i++){ const x=sub(V[cyc[i]],m), y=sub(V[cyc[(i+1)%5]],m); if (Math.abs(Math.acos(Math.max(-1,Math.min(1,dotN(x,y)/(R[0]*R[0]))))*180/Math.PI-want)>1) ok=false; }
      if (!ok) continue; seen.add(key); out.push(cyc); } }
  return sh._sfaces=out; }
export function facePolys(sh){
  if (sh._fpolys) return sh._fpolys;
  if (sh.star) return sh._fpolys=starFaceList(sh);
  if (sh.compound) return sh._fpolys=sh.parts().flatMap(({idx,part})=>facePolys(part).map(f=>f.map(i=>idx[i])));
  topo(sh); const V=sh.verts;
  return sh._fpolys=sh._faces.map(f=>{ const c=[0,1,2,3].map(i=>f.reduce((s,q)=>s+V[q][i],0)/f.length), u=nrm(V[f[0]].map((x,i)=>x-c[i]));
    let w=null, best=-1; for (const q of f){ const d=V[q].map((x,i)=>x-c[i]), pr=dotN(d,u), r=d.map((x,i)=>x-pr*u[i]), l=Math.hypot(...r); if (l>best){ best=l; w=r.map(x=>x/l); } }
    return f.map(q=>{ const d=V[q].map((x,i)=>x-c[i]); return [q, Math.atan2(dotN(d,w), dotN(d,u))]; }).sort((x,y)=>x[1]-y[1]).map(x=>x[0]); }); }
