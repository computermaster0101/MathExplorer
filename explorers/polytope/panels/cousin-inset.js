import { $, an, lerpN, low } from '../util.js';
import { st } from '../state.js';
import { bgRGB, colorOf, css } from '../render/colour.js';
import { dotN, polyName } from '../geometry/common.js';
import { SHAPES } from '../geometry/polytopes.js';
import { getCousin } from '../geometry/cousins3d.js';
import { mulM, rot3, softW } from '../math/rotate4d.js';
import { pivot } from '../render/scene.js';
import { centroid } from '../modes/build.js';

// ---------- the 3D cousin (inset) ----------
const inset=$('inset'), ictx=inset.getContext('2d'); let insetFit=null;
const shadowCv=$('shadow2d'), sctx=shadowCv.getContext('2d'); let shadowFit=null;
export function wrapText(g, text, x, y, maxW, lh){ const words=text.split(' '); let line='';
  for (const w of words){ const t=line?line+' '+w:w; if (g.measureText(t).width>maxW && line){ g.fillText(line,x,y); y+=lh; line=w; } else line=t; }
  if (line) g.fillText(line,x,y); }
export function applyQ(v, q){   // rotate a 3D point by the main view's orbit quaternion
  const [x,y,z]=v, ix=q.w*x+q.y*z-q.z*y, iy=q.w*y+q.z*x-q.x*z, iz=q.w*z+q.x*y-q.y*x, iw=-q.x*x-q.y*y-q.z*z;
  return [ix*q.w+iw*-q.x+iy*-q.z-iz*-q.y, iy*q.w+iw*-q.y+iz*-q.x-ix*-q.z, iz*q.w+iw*-q.z+ix*-q.y-iy*-q.x];
}
// colour for the 3D cousin: same rules as the big view, one dimension down (its Z plays the role of W)
function cousinColor(o, z, fam, cz, ctx){
  if (st.cmode==='rgb4'){ const q=[o[0]/cz.amax[0], o[1]/cz.amax[1], o[2]/cz.amax[2]];
    const c=[0,1,2].map(a=>Math.min(1,Math.max(0,0.5+0.62*q[a]))), m=(c[0]+c[1]+c[2])/3;
    return c.map(x=>0.18+0.82*Math.min(1,Math.max(0,m+(x-m)*1.4))); }
  return colorOf([o[0],o[1],0,o[2]], z, fam, ctx);
}
const SHEET_VIEW = (()=>{ const ax=-0.5, ay=0.38, a={x:0,y:Math.sin(ay/2),z:0,w:Math.cos(ay/2)}, b={x:Math.sin(ax/2),y:0,z:0,w:Math.cos(ax/2)};
  return { w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z, x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y, y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x, z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w }; })();
export function drawInset(){
  const show = st.cousin && (st.mode==='explore' || st.mode==='slice');
  inset.style.display = show ? 'block' : 'none'; if (!show) return;
  const dpr=Math.min(devicePixelRatio,2), W=inset.clientWidth, H=inset.clientHeight;
  if (inset.width!==Math.round(W*dpr) || inset.height!==Math.round(H*dpr)){ inset.width=Math.round(W*dpr); inset.height=Math.round(H*dpr); }
  const g=ictx; g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  const light=st.bg==='#f3efe6', txt=light?'#2b303b':'#d5dbe7', mute=light?'#6b7180':'#8a93a8';
  inset.style.background = light ? 'rgba(255,255,255,.78)' : ''; inset.style.borderColor = light ? '#d9d3c4' : '';
  g.textAlign='left'; g.font='600 11px Inter, sans-serif'; g.fillStyle=txt;
  const cz=getCousin();
  if (!cz){ g.fillText('3D cousin', 10, 18); g.font='12px Inter, sans-serif'; g.fillStyle=mute;
    wrapText(g, SHAPES[st.shape].highD ? `One dimension down from ${SHAPES[st.shape].n}D is ${SHAPES[st.shape].n-1}D, still too many to draw, so there's no 3D cousin to show.` : `The ${SHAPES[st.shape].name} has no 3D cousin. It only exists from 4D up.`, 10, 42, W-20, 16); return; }
  const slice=st.mode==='slice', proj=slice?'ortho':st.proj, curved=!slice && st.edges==='curved', S2=curved?16:2;
  const M=rot3(), q=pivot.quaternion, bg=bgRGB(), V=cz.verts.map(v=>{ const r=mulM(M,v); return slice ? applyQ(r,q) : r; });
  const ctx={amax:[cz.amax[0],cz.amax[1],1,cz.amax[2]], wmax:cz.amax[2]};
  const fade=(c,a)=>c.map((x,i)=>bg[i]+(x-bg[i])*a);
  // build every stroke in the cousin's own space, then view it from the main view's angle
  const strokes=[], dots=[];
  cz.edges.forEach(([i,j],e)=>{
    const ang=Math.acos(Math.max(-1,Math.min(1,dotN(V[i],V[j])))), sa=Math.sin(ang)||1, body=[], shad=[];
    for (let k=0;k<S2;k++){ const t=k/(S2-1); let p, o;
      if (curved){ const ka=Math.sin((1-t)*ang)/sa, kb=Math.sin(t*ang)/sa; p=V[i].map((x,a)=>ka*x+kb*V[j][a]); o=cz.verts[i].map((x,a)=>ka*x+kb*cz.verts[j][a]); }
      else { p=lerpN(V[i],V[j],t); o=lerpN(cz.verts[i],cz.verts[j],t); }
      const c=cousinColor(o, p[2], cz.fam[e], cz, ctx);
      body.push({p, c}); }
    for (let k=0;k<S2-1;k++){
      strokes.push({a:body[k].p, b:body[k+1].p, c: slice ? fade(body[k].c,0.3) : body[k].c, w: slice?1.1:1.8}); }
  });
  V.forEach((p,n)=>dots.push({p, c:cousinColor(cz.verts[n], p[2], -1, cz, ctx).map(x=>Math.min(1,x*1.08)), r:slice?1.4:2.2}));
  let wall=null, slicePoly=null;
  if (slice){ // the knife: plane z = h cuts the cousin in a polygon
    const h=knifeFor(V), side=V.map(v=>v[2]-h>=0), cut=new Map();
    const pt=ei=>{ if (cut.has(ei)) return cut.get(ei); const [a,b]=cz.edges[ei], da=V[a][2]-h, db=V[b][2]-h, t=da/(da-db);
      const o=lerpN(cz.verts[a],cz.verts[b],t), r={p:lerpN(V[a],V[b],t), c:colorOf([o[0],o[1],0,o[2]], h, -1, ctx)}; cut.set(ei,r); return r; };
    for (const fe of cz.faceEdges){ const cr=fe.filter(ei=>side[cz.edges[ei][0]]!==side[cz.edges[ei][1]]);
      if (cr.length===2){ const a=pt(cr[0]), b=pt(cr[1]); strokes.push({a:a.p, b:b.p, c:a.c.map((x,k)=>(x+b.c[k])/2), w:2.6}); } }
    for (const p of cut.values()) dots.push({p:p.p, c:p.c, r:2.8});
    const m=1.15; wall=[[-m,-m,h],[m,-m,h],[m,m,h],[-m,m,h]];
    const cp=[...cut.values()];
    if (cp.length>=3){ const cc=centroid(cp.map(x=>x.p)); cp.sort((A,B)=>Math.atan2(A.p[1]-cc[1],A.p[0]-cc[0])-Math.atan2(B.p[1]-cc[1],B.p[0]-cc[0]));
      slicePoly={pts:cp.map(x=>x.p), col:centroid(cp.map(x=>x.c))}; }
  }
  // view transform: same orbit as the big view, simple perspective, auto-fit
  const view = slice ? (p=>applyQ(p,SHEET_VIEW)) : (p=>applyQ(p,q));
  const all=[...strokes.flatMap(s=>[view(s.a),view(s.b)]), ...(wall||[]).map(view)];
  const bound=Math.max(0.3, ...all.map(v=>Math.hypot(v[0],v[1])));
  const target=(Math.min(W,H)*0.40)/bound; insetFit = insetFit==null ? target : insetFit+(target-insetFit)*0.15;
  const D=4.2*bound, cx=W/2, cy=H/2+6;
  const scr=v=>{ const f=D/(D-v[2]); return [cx+v[0]*insetFit*f, cy-v[1]*insetFit*f, v[2]]; };
  // wall / knife plane
  if (wall){ const wq=wall.map(p=>scr(view(p)));
  g.beginPath(); wq.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath();
  g.fillStyle = slice ? (light ? 'rgba(60,70,90,0.12)' : 'rgba(170,190,230,0.16)') : (light ? 'rgba(60,70,90,0.07)' : 'rgba(150,170,210,0.07)'); g.fill();
  g.strokeStyle = slice ? (light ? 'rgba(60,70,90,0.35)' : 'rgba(170,190,230,0.38)') : (light ? 'rgba(60,70,90,0.18)' : 'rgba(150,170,210,0.16)'); g.lineWidth=1; g.stroke(); }
  if (slicePoly){ const sp=slicePoly.pts.map(p=>scr(view(p)));    // the slice: a bright solid polygon lying in the sheet
    g.beginPath(); sp.forEach((v,i)=>i?g.lineTo(v[0],v[1]):g.moveTo(v[0],v[1])); g.closePath();
    g.fillStyle=`rgba(${slicePoly.col.map(x=>Math.round(Math.min(1,x)*255)).join(',')},0.7)`; g.fill(); }
  // strokes back to front
  const items=strokes.map(s=>{ const a=scr(view(s.a)), b=scr(view(s.b)); return {a, b, z:(a[2]+b[2])/2, c:s.c, w:s.w}; });
  items.sort((x,y)=>x.z-y.z);
  g.lineCap='round';
  const zs=items.map(it=>it.z), zlo=Math.min(...zs), zhi=Math.max(...zs), depth=z=> zhi-zlo>1e-6 ? (z-zlo)/(zhi-zlo) : 1;
  const shade=(c,z)=>{ const s=0.38+0.62*depth(z); return c.map((x,i)=>bg[i]+(x-bg[i])*s); };
  for (const it of items){ const f=D/(D-it.z); g.strokeStyle=css(shade(it.c,it.z)); g.lineWidth=it.w*(0.6+st.thk)*(0.65+0.7*depth(it.z))*Math.max(0.7,Math.min(1.4,f));
    g.beginPath(); g.moveTo(it.a[0],it.a[1]); g.lineTo(it.b[0],it.b[1]); g.stroke(); }
  for (const d of dots){ const s=scr(view(d.p)); g.fillStyle=css(shade(d.c,s[2])); g.beginPath(); g.arc(s[0],s[1],d.r*(0.7+st.thk*0.6)*(0.7+0.6*depth(s[2])),0,7); g.fill(); }
  const small=W<170; g.fillStyle=txt;
  if (small){ g.font='600 10px Inter, sans-serif'; g.fillText('3D cousin', 8, 15); g.font='10px Inter, sans-serif'; g.fillStyle=mute; g.fillText(cz.name.split(' (')[0], 8, 27); }
  else { g.font='600 11px Inter, sans-serif'; wrapText(g, '3D cousin: '+cz.name, 10, 18, W-20, 14);
    g.font='10.5px Inter, sans-serif'; g.fillStyle=mute; g.fillText(slice ? 'turning through a fixed flat world' : 'turns with the big view', 10, H-9); }
}

const WALL_Z = -1.45;
function castShadow(p, proj){   // where a light (the analog of the 4D "camera") throws point p onto the wall z = WALL_Z
  if (proj==='ortho') return [p[0], p[1], WALL_Z, 1];
  const L = proj==='stereo' ? 1 : 2.2, z = proj==='stereo' ? softW(p[2]) : p[2], k=(L-WALL_Z)/(L-z);
  return [p[0]*k, p[1]*k, WALL_Z, k];
}
// the 3D cousin's shadow on a wall, in one shadow colour, seen from the same angle as the big view
// Slice mode, one dimension down: what a flat creature living in the knife's plane sees.
// The cousin's shadow on that plane is the faint frame; the bright filled polygon is the slice.
function drawFlatland(g, cz, W, H, light, txt, mute, small){
  const M=rot3(), q=pivot.quaternion, B=cz.verts.map(v=>applyQ(mulM(M,v),q)), h=knifeFor(B);   // the cousin, turned by the 4D-analog turns and your drag
  const ctx={amax:[cz.amax[0],cz.amax[1],1,cz.amax[2]], wmax:cz.amax[2]};
  const sc=(Math.min(W,H)*0.40)/1.12, cx=W/2, cy=H/2+(small?8:6), scr=p=>[cx+p[0]*sc, cy-p[1]*sc];     // fixed scale: the shape visibly grows and shrinks
  const top=small?30:28, bot=small?6:22, wx0=8, wx1=W-8, wy0=top, wy1=H-bot;
  g.fillStyle = light ? 'rgba(255,253,246,0.95)' : 'rgba(26,30,40,0.9)';
  g.beginPath(); g.roundRect ? g.roundRect(wx0,wy0,wx1-wx0,wy1-wy0,6) : g.rect(wx0,wy0,wx1-wx0,wy1-wy0); g.fill();
  g.strokeStyle = light ? 'rgba(60,70,90,0.2)' : 'rgba(170,190,230,0.22)'; g.lineWidth=1; g.stroke();
  // where each face of the cousin crosses the flat world: one flat line per face
  const side=B.map(v=>v[2]-h>=0), cut=new Map();
  const pt=ei=>{ if (cut.has(ei)) return cut.get(ei); const [a,b]=cz.edges[ei], da=B[a][2]-h, db=B[b][2]-h, t=da/(da-db);
    const r={p:lerpN(B[a],B[b],t), c:cousinColor(lerpN(cz.verts[a],cz.verts[b],t), h, -1, cz, ctx)}; cut.set(ei,r); return r; };
  const lines=[];
  for (const fe of cz.faceEdges){ const cr=fe.filter(ei=>side[cz.edges[ei][0]]!==side[cz.edges[ei][1]]); if (cr.length===2) lines.push([pt(cr[0]),pt(cr[1])]); }
  g.save(); g.beginPath(); g.rect(wx0,wy0,wx1-wx0,wy1-wy0); g.clip(); g.lineCap='round';
  if (lines.length){
    const all=[...cut.values()], cc=centroid(all.map(x=>x.p)), ord=all.slice().sort((A,B2)=>Math.atan2(A.p[1]-cc[1],A.p[0]-cc[0])-Math.atan2(B2.p[1]-cc[1],B2.p[0]-cc[0]));
    const col=centroid(all.map(x=>x.c)), sp=ord.map(x=>scr(x.p));
    g.beginPath(); sp.forEach((v,i)=>i?g.lineTo(v[0],v[1]):g.moveTo(v[0],v[1])); g.closePath();
    g.fillStyle=`rgba(${col.map(x=>Math.round(Math.min(1,x)*255)).join(',')},0.16)`; g.fill();
    for (const [A,B2] of lines){ const a=scr(A.p), b=scr(B2.p), grd=g.createLinearGradient(a[0],a[1],b[0],b[1]);
      grd.addColorStop(0,css(A.c)); grd.addColorStop(1,css(B2.c)); g.strokeStyle=grd; g.lineWidth=2.2*(0.6+st.thk); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); }
    for (const x of all){ const s=scr(x.p); g.fillStyle=css(x.c); g.beginPath(); g.arc(s[0],s[1],2.4*(0.7+st.thk*0.6),0,7); g.fill(); }
  }
  g.restore();
  g.fillStyle=txt;
  if (small){ g.font='600 10px Inter, sans-serif'; g.fillText('2D shadow', 8, 15); }
  else { g.font='600 11px Inter, sans-serif'; g.fillText('2D shadow of 3D cousin', 10, 18);
    g.font='10.5px Inter, sans-serif'; g.fillStyle=mute;
    const roundC=SHAPES[st.shape].round && lines.length>=10;
    g.fillText(lines.length ? (roundC ? (st.shape==='sph4' ? 'flat world: a circle' : 'flat world: a rounded shape') : `flat world: ${lines.length} lines, ${an(polyName(lines.length))}`) : 'flat world: nothing here right now', 10, H-8); }
}
export function drawShadow(){
  const show = st.shadow2d && (st.mode==='explore' || st.mode==='slice');
  shadowCv.style.display = show ? 'block' : 'none'; if (!show) return;
  const dpr=Math.min(devicePixelRatio,2), W=shadowCv.clientWidth, H=shadowCv.clientHeight;
  if (shadowCv.width!==Math.round(W*dpr) || shadowCv.height!==Math.round(H*dpr)){ shadowCv.width=Math.round(W*dpr); shadowCv.height=Math.round(H*dpr); }
  const g=sctx; g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  const light=st.bg==='#f3efe6', txt=light?'#2b303b':'#d5dbe7', mute=light?'#6b7180':'#8a93a8', small=W<170;
  shadowCv.style.background = light ? 'rgba(255,255,255,.78)' : ''; shadowCv.style.borderColor = light ? '#d9d3c4' : '';
  const cz=getCousin();
  if (!cz){ g.fillStyle=txt; g.font='600 11px Inter, sans-serif'; g.fillText('2D shadow', small?8:10, small?15:18); g.font='12px Inter, sans-serif'; g.fillStyle=mute;
    wrapText(g, SHAPES[st.shape].highD ? 'No 3D cousin for this many dimensions, so no 2D shadow.' : `No 3D cousin, so no 2D shadow for the ${low(SHAPES[st.shape].name)}.`, 10, 42, W-20, 16); return; }
  if (st.mode==='slice'){ drawFlatland(g, cz, W, H, light, txt, mute, small); return; }
  const slice=false, proj=st.proj, curved=st.edges==='curved', S2=curved?16:2;
  // the cousin turns (4D-analog turns, then your drag / turntable); the lamp and the wall stay put, facing you
  const M=rot3(), q=pivot.quaternion, R0=cz.verts.map(v=>mulM(M,v)), V=R0.map(v=>applyQ(v,q));
  const segs=[], dots=[];
  cz.edges.forEach(([i,j])=>{
    const ang=Math.acos(Math.max(-1,Math.min(1,dotN(V[i],V[j])))), sa=Math.sin(ang)||1, pts=[];
    for (let k=0;k<S2;k++){ const t=k/(S2-1);
      const p = curved ? (()=>{ const ka=Math.sin((1-t)*ang)/sa, kb=Math.sin(t*ang)/sa; return V[i].map((x,a)=>ka*x+kb*V[j][a]); })() : lerpN(V[i],V[j],t);
      pts.push(castShadow(p,proj)); }
    for (let k=0;k<S2-1;k++) segs.push({a:pts[k], b:pts[k+1], w:1.5*(st.conf?Math.min(2.2,Math.sqrt((pts[k][3]+pts[k+1][3])/2)):1.2)});
  });
  V.forEach(p=>{ const s=castShadow(p,proj); dots.push({p:s, r:1.9*(st.conf?Math.min(2,Math.sqrt(s[3])):1.1)}); });
  if (slice){ // the knife cuts the cousin (in its own space); that polygon turns with it and casts its shadow too
    const h=knifeFor(R0), side=R0.map(v=>v[2]-h>=0), cut=new Map();
    const pt=ei=>{ if (cut.has(ei)) return cut.get(ei); const [a,b]=cz.edges[ei], da=R0[a][2]-h, db=R0[b][2]-h;
      const r=castShadow(applyQ(lerpN(R0[a],R0[b],da/(da-db)),q),proj); cut.set(ei,r); return r; };
    for (const fe of cz.faceEdges){ const cr=fe.filter(ei=>side[cz.edges[ei][0]]!==side[cz.edges[ei][1]]);
      if (cr.length===2) segs.push({a:pt(cr[0]), b:pt(cr[1]), w:3.4}); }
  }
  // fit the (fixed, face-on) wall around the shadow
  const ext=segs.flatMap(s=>[Math.max(Math.abs(s.a[0]),Math.abs(s.a[1])), Math.max(Math.abs(s.b[0]),Math.abs(s.b[1]))]).sort((x,y)=>x-y);
  const m=Math.max(0.3, ext.length ? ext[Math.floor((ext.length-1)*(proj==='stereo'?0.85:1))] : 0.3);   // stereographic tips may spill off the wall
  const target=(Math.min(W,H)*0.40)/(m*1.12); shadowFit = shadowFit==null ? target : shadowFit+(target-shadowFit)*0.12;
  const cx=W/2, cy=H/2+(small?8:6), scr=v=>[cx+v[0]*shadowFit, cy-v[1]*shadowFit];
  const half=Math.min(W,H)*0.44, top=small?30:28, bot=small?6:22;
  const wx0=8, wx1=W-8, wy0=top, wy1=H-bot;
  g.fillStyle = light ? 'rgba(255,253,246,0.95)' : 'rgba(205,214,232,0.82)';
  g.beginPath(); g.roundRect ? g.roundRect(wx0,wy0,wx1-wx0,wy1-wy0,6) : g.rect(wx0,wy0,wx1-wx0,wy1-wy0); g.fill();
  const SH = light ? 'rgba(40,44,54,0.8)' : 'rgba(22,25,34,0.85)';
  g.save(); g.beginPath(); g.rect(wx0,wy0,wx1-wx0,wy1-wy0); g.clip();
  g.strokeStyle=SH; g.fillStyle=SH; g.lineCap='round'; g.lineJoin='round';
  for (const s of segs){ const a=scr(s.a), b=scr(s.b); g.lineWidth=s.w*(0.6+st.thk); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); }
  for (const d of dots){ const s=scr(d.p); g.beginPath(); g.arc(s[0],s[1],d.r*(0.7+st.thk*0.6),0,7); g.fill(); }
  g.restore();
  g.fillStyle=txt;
  if (small){ g.font='600 10px Inter, sans-serif'; g.fillText('2D shadow', 8, 15); }
  else { g.font='600 11px Inter, sans-serif'; g.fillText('2D shadow of 3D cousin', 10, 18);
    g.font='10.5px Inter, sans-serif'; g.fillStyle=mute; g.fillText(slice ? 'the slice’s shadow too' : 'turns on the wall as you drag', 10, H-8); }
}

const knifeFor=P=>{ let lo=Infinity, hi=-Infinity; for (const v of P){ if (v[2]<lo) lo=v[2]; if (v[2]>hi) hi=v[2]; } return Math.max(lo+1e-9, Math.min(hi-1e-9, (lo+hi)/2+st.knifeU*(hi-lo)/2)); };
