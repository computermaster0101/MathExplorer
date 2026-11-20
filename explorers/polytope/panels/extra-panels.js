import { shared } from '../shared.js';
import { $, an, lerpN, low } from '../util.js';
import { st } from '../state.js';
import { bgRGB, colorOf, css, wColor } from '../render/colour.js';
import { cross, dot3, nrm, polyName, subN } from '../geometry/common.js';
import { SHAPES } from '../geometry/polytopes.js';
import { getCousin } from '../geometry/cousins3d.js';
import { pivot } from '../render/scene.js';
import { centroid } from '../modes/build.js';
import { hingeApply } from '../modes/unfold.js';
import { getSource, sliceFrame, sliceInfo } from '../modes/ping.js';
import { applyQ, wrapText } from './cousin-inset.js';

// ---------- extra panels: Slice view (slice mode) and Fully flat (unfold mode) ----------


const SOLID_BY_FACES={'3:4':'tetrahedron','3:2,4:3':'triangular prism','4:6':'box','3:8':'octahedron','3:4,4:1':'square pyramid',
  '3:6':'triangular bipyramid','4:5,5:2':'pentagonal prism','4:6,6:2':'hexagonal prism','4:8,8:2':'octagonal prism','3:4,6:4':'truncated tetrahedron',
  '3:8,4:6':'cuboctahedron','4:6,6:8':'truncated octahedron','3:20':'icosahedron','5:12':'dodecahedron','3:8,8:6':'truncated cube'};
export function sliceFaces(sl){
  const cnt={}; for (const s of sl.sides) cnt[s]=(cnt[s]||0)+1;
  const keys=Object.keys(cnt).map(Number).sort((a,b)=>a-b);
  const sig=keys.map(k=>`${k}:${cnt[k]}`).join(','), name=SOLID_BY_FACES[sig];
  const list=keys.map(k=>`${cnt[k]} ${cnt[k]===1?polyName(k):polyName(k)+'s'}`);
  let nm=name; if (nm==='box'){ const L=sl.segs.map(([a,b])=>Math.hypot(...subN(a.p,b.p))); nm = sl.pts.length!==8 ? null : (Math.max(...L)/Math.min(...L)<1.001 ? 'cube' : 'box (a stretched or slanted cube)'); }
  return { name: nm,
           list: list.length>1 ? list.slice(0,-1).join(', ')+' and '+list[list.length-1] : (list[0]||'') };
}
function panelSetup(cv, cx){
  const dpr=Math.min(devicePixelRatio,2), W=cv.clientWidth, H=cv.clientHeight;
  if (cv.width!==Math.round(W*dpr) || cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  cx.setTransform(dpr,0,0,dpr,0,0); cx.clearRect(0,0,W,H);
  const light=st.bg==='#f3efe6';
  cv.style.background = light ? 'rgba(255,255,255,.78)' : ''; cv.style.borderColor = light ? '#d9d3c4' : '';
  return {W, H, light, txt:light?'#2b303b':'#d5dbe7', mute:light?'#6b7180':'#8a93a8', small:W<170};
}
function panelTitle(g, P, big, small, foot){
  g.fillStyle=P.txt; g.textAlign='left';
  if (P.small){ g.font='600 10px Inter, sans-serif'; g.fillText(small, 8, 15); }
  else { g.font='600 11px Inter, sans-serif'; g.fillText(big, 10, 18); if (foot){ g.font='10.5px Inter, sans-serif'; g.fillStyle=P.mute; wrapText(g, foot, 10, P.H-9, P.W-20, 12); } }
}
// draw coloured 3D strokes from the main view's angle, recentred and auto-fitted, with depth shading
function draw3DStrokes(g, P, segs, dots, fitKey, centre, rate=0.18, minBound=0.05, polys=null){
  const q=pivot.quaternion, bg=bgRGB(), view=p=>applyQ(subN(p,centre),q);
  const items=segs.map(s=>({a:view(s.a), b:view(s.b), c:s.c, w:s.w}));
  const vd=dots.map(d=>({p:view(d.p), c:d.c, r:d.r}));
  const bound=Math.max(minBound, ...items.flatMap(it=>[Math.hypot(it.a[0],it.a[1]),Math.hypot(it.b[0],it.b[1])]));
  const target=(Math.min(P.W,P.H)*0.36)/bound; panelFit[fitKey] = panelFit[fitKey]==null ? target : Math.min(target, panelFit[fitKey]+(target-panelFit[fitKey])*rate);
  const s=panelFit[fitKey], D=4.2*bound, cx=P.W/2, cy=P.H/2+(P.small?7:4);
  const scr=v=>{ const f=D/(D-v[2]); return [cx+v[0]*s*f, cy-v[1]*s*f]; };
  const zs=[...items.map(it=>(it.a[2]+it.b[2])/2), ...vd.map(d=>d.p[2])], zlo=Math.min(...zs), zhi=Math.max(...zs);
  const depth=z=> zhi-zlo>1e-9 ? (z-zlo)/(zhi-zlo) : 1, shade=(c,z)=>{ const k=0.38+0.62*depth(z); return c.map((x,i)=>bg[i]+(x-bg[i])*k); };
  if (polys && polys.length){ const pv=polys.map(pl=>{ const vs=pl.pts.map(view); return {vs, z:vs.reduce((s,v)=>s+v[2],0)/vs.length, c:pl.c}; }).sort((x,y)=>x.z-y.z);
    for (const pl of pv){ g.beginPath(); pl.vs.forEach((v,i)=>{ const q2=scr(v); i?g.lineTo(q2[0],q2[1]):g.moveTo(q2[0],q2[1]); }); g.closePath();
      g.fillStyle=`rgba(${pl.c.map(x=>Math.round(Math.min(1,Math.max(0,x))*255)).join(',')},0.22)`; g.fill(); } }
  items.sort((x,y)=>(x.a[2]+x.b[2])-(y.a[2]+y.b[2])); g.lineCap='round';
  for (const it of items){ const z=(it.a[2]+it.b[2])/2, a=scr(it.a), b=scr(it.b);
    g.strokeStyle=css(shade(it.c,z)); g.lineWidth=it.w*(0.6+st.thk)*(0.65+0.7*depth(z)); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); }
  for (const d of vd){ const p=scr(d.p); g.fillStyle=css(shade(d.c,d.p[2])); g.beginPath(); g.arc(p[0],p[1],d.r*(0.7+st.thk*0.6)*(0.7+0.6*depth(d.p[2])),0,7); g.fill(); }
}
export const panelFit={};


const sliceCv=$('sliceview'), slctx=sliceCv.getContext('2d'); shared.sliceCen = null;
export function drawSliceView(){
  const show = st.sliceview && st.mode==='slice'; sliceCv.style.display = show ? 'block' : 'none'; if (!show) return;
  const P=panelSetup(sliceCv, slctx), g=slctx;
  if (!sliceFrame || (!sliceFrame.tubes.length && !sliceFrame.balls.length) || !sliceInfo){ panelTitle(g,P,'Slice view','Slice view');
    g.font='12px Inter, sans-serif'; g.fillStyle=P.mute; wrapText(g,'The knife is outside the shape, so there is no slice right now.', 10, 44, P.W-20, 16); return; }
  const segs=sliceFrame.tubes.map(t=>({a:t.P[0], b:t.P[1], c:t.cols[0].map((x,i)=>(x+t.cols[1][i])/2), w:2.1}));
  const dots=sliceFrame.balls.map(b=>({p:b.c, c:b.col, r:2.4}));
  const cpts=sliceFrame.balls.length ? sliceFrame.balls.map(b=>b.c) : sliceFrame.tubes.flatMap(t=>[t.P[0],t.P[1]]), c=centroid(cpts);
  shared.sliceCen = shared.sliceCen ? shared.sliceCen.map((x,i)=>x+(c[i]-x)*0.06) : c;                      // glide, don't jump, as corners come and go
  const src0=getSource(), polys = st.sliceFill && sliceInfo.polys ? sliceInfo.polys.map(pl=>({pts:pl.map(q=>q.p), c:centroid(pl.map(q=>colorOf(q.o, st.knife, -1, src0)))})) : null;
  draw3DStrokes(g, P, segs, dots, 'slice', shared.sliceCen, 0.05, 0.32, polys);
  if (sliceInfo.round){ panelTitle(g, P, 'Slice view', 'Slice view', st.shape==='sph4' ? 'a sphere' : st.shape==='hopf' ? `${sliceInfo.pts.length} points` : 'loops and points'); return; }
  const f=sliceFaces(sliceInfo);
  panelTitle(g, P, 'Slice view', 'Slice view', f.name ? `shaped like ${an(f.name.split(" (")[0])}` : `${sliceInfo.pts.length} corners · ${sliceInfo.cut} faces`);
}
// the 3D cousin's net, opening into 2D in step with the big unfold
const flatCv=$('flat2d'), flctx=flatCv.getContext('2d'), netCache={};
function cousinNet(cz){
  const key=cz.name+'|'+cz.verts.length; if (netCache[key]) return netCache[key];
  const V=cz.verts, F=cz.faces;
  const fn=F.map(f=>{ const P=f.map(i=>V[i]); let n=nrm(cross(subN(P[1],P[0]),subN(P[2],P[0]))); if (dot3(n,P[0])<0) n=n.map(x=>-x); return n; });
  const ord=F.map((f,fi)=>{ const P=f.map(i=>V[i]), c=centroid(P), e1=nrm(subN(P[0],c)), e2=cross(fn[fi],e1);   // corners in order round the face
    return f.map((v,k)=>({v, a:Math.atan2(dot3(subN(P[k],c),e2), dot3(subN(P[k],c),e1))})).sort((x,y)=>x.a-y.a).map(o=>o.v); });
  const eface=new Map(); cz.faceEdges.forEach((es,fi)=>es.forEach(e=>{ if (!eface.has(e)) eface.set(e,[]); eface.get(e).push(fi); }));
  let root=0; F.forEach((f,i)=>{ if (f.length>F[root].length) root=i; });
  const parent=new Array(F.length).fill(-1), hinge=new Array(F.length).fill(null), order=[root], seen=new Set([root]);
  for (let h=0;h<order.length;h++){ const c=order[h];
    for (const e of cz.faceEdges[c]) for (const nb of eface.get(e)) if (!seen.has(nb)){ seen.add(nb); order.push(nb); parent[nb]=c;
      const [a,b]=cz.edges[e], np=fn[c], nc=fn[nb], cs=Math.max(-1,Math.min(1,dot3(nc,np)));
      hinge[nb]={ f0:lerpN(V[a],V[b],0.5), e1:np, e2:nrm(nc.map((x,i)=>x-cs*np[i])), alpha:Math.acos(cs) }; } }
  const a=fn[root], b=[0,0,1], cAB=dot3(a,b), ab=a.map((x,i)=>x+b[i]);
  const align = cAB<-0.999 ? (x=>[x[0],-x[1],-x[2]]) : (x=>{ const k1=dot3(ab,x)/(1+cAB), k2=2*dot3(a,x); return x.map((xi,i)=>xi-k1*ab[i]+k2*b[i]); });
  const rank=new Array(F.length); order.forEach((c,i)=>rank[c]=i);
  return netCache[key]={ord, parent, hinge, order, align, rank, N:F.length};
}
export function drawFlat(){
  const show = st.flat2d && st.mode==='unfold'; flatCv.style.display = show ? 'block' : 'none'; if (!show) return;
  const P=panelSetup(flatCv, flctx), g=flctx, cz=getCousin();
  if (!cz){ panelTitle(g,P,'Cousin\'s net (2D)','Cousin net'); g.font='12px Inter, sans-serif'; g.fillStyle=P.mute;
    wrapText(g, `The ${low(SHAPES[st.shape].name)} has no 3D cousin, so there is no 2D net to show.`, 10, 44, P.W-20, 16); return; }
  const net=cousinNet(cz), u=st.unf.u, q=pivot.quaternion, bg=bgRGB();
  const polys=net.order.map(fi=>{ let pts=net.ord[fi].map(i=>cz.verts[i]);
    for (let x=fi; net.parent[x]>=0; x=net.parent[x]){ const h=net.hinge[x]; pts=pts.map(p=>hingeApply(p,h,u)); }
    return {fi, pts:pts.map(net.align)}; });
  const cen=centroid(polys.flatMap(p=>p.pts)), view=p=>applyQ(subN(p,cen),q);
  polys.forEach(p=>{ p.v=p.pts.map(view); p.z=p.v.reduce((s,v)=>s+v[2],0)/p.v.length; });
  const bound=Math.max(0.2, ...polys.flatMap(p=>p.v.map(v=>Math.hypot(v[0],v[1]))));
  const target=(Math.min(P.W,P.H)*0.37)/bound; panelFit.flat = panelFit.flat==null ? target : panelFit.flat+(target-panelFit.flat)*0.15;
  const s=panelFit.flat, D=4.2*bound, cx=P.W/2, cy=P.H/2+(P.small?7:4), scr=v=>{ const f=D/(D-v[2]); return [cx+v[0]*s*f, cy-v[1]*s*f]; };
  polys.sort((a,b)=>a.z-b.z);
  for (const p of polys){ const c=wColor(-1+2*net.rank[p.fi]/Math.max(1,net.N-1)), pts=p.v.map(scr);
    g.beginPath(); pts.forEach((v,i)=>i?g.lineTo(v[0],v[1]):g.moveTo(v[0],v[1])); g.closePath();
    g.fillStyle=`rgba(${c.map(x=>Math.round(x*255)).join(',')},0.38)`; g.fill();
    g.strokeStyle=css(c); g.lineWidth=1.3*(0.6+st.thk); g.lineJoin='round'; g.stroke(); }
  const nm=cz.name.split(' (')[0].toLowerCase();
  panelTitle(g, P, 'Cousin\'s net (2D)', 'Cousin net', u>0.96 ? `the ${nm}'s net: ${net.N} faces, flat` : `the ${nm} opening into ${net.N} flat faces`);
}
