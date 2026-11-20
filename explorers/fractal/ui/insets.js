import { $ } from '../util.js';
import { PHX, TYPES } from '../fractals/types.js';
import { st, toDisp, toMath } from '../state.js';
import { escR2 } from '../fractals/iterate.js';
import { cDigits, css, fmtBig, fmtC, palM } from '../color/palettes.js';
import { auxCv, isLight } from '../render/webgl.js';
import { baseDpr, toScreen, toWorld, viewDescs } from '../view.js';
import { auxRender } from '../render/bla.js';
import { notAvail } from './notice.js';
import { QC } from '../modes/fractal3d.js';
import { GROW } from '../modes/grow.js';
import { orbitIdx } from '../modes/orbit.js';

// ---------- insets ----------
const in1=$('in1'), in2=$('in2'), caches={};
function panel(cv){
  const dpr=baseDpr(), W=cv.clientWidth, H=cv.clientHeight; if (!W||!H) return null;
  if (cv.width!==Math.round(W*dpr) || cv.height!==Math.round(H*dpr)){ cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H); const light=isLight();
  cv.style.background=light?'rgba(255,255,255,.78)':''; cv.style.borderColor=light?'#d9d3c4':'';
  return {g,W,H,dpr,light,txt:light?'#2b303b':'#d5dbe7',mute:light?'#6b7180':'#8a93a8',small:W<170};
}
function panelTitle(P, big, foot, imgBehind){
  const g=P.g; if (imgBehind){ g.fillStyle=P.light?'rgba(255,255,255,0.7)':'rgba(11,13,18,0.62)'; g.fillRect(0,0,P.W,24); if (foot && !P.small) g.fillRect(0,P.H-20,P.W,20); }
  g.fillStyle=P.txt; g.font=`600 ${P.small?10:11}px Inter, sans-serif`; g.fillText(big, 9, 16);
  if (foot && !P.small){ g.font='10.5px Inter, sans-serif'; g.fillStyle=P.mute; g.fillText(foot, 9, P.H-6); }
}
function roundClip(P){ const g=P.g; g.save(); g.beginPath(); g.roundRect ? g.roundRect(0,0,P.W,P.H,11) : g.rect(0,0,P.W,P.H); g.clip(); }
function cachedAux(name, key, P, o){
  let c=caches[name]; if (!c){ c=caches[name]={key:'', cv:document.createElement('canvas')}; }
  const w=Math.round(P.W*P.dpr), h=Math.round(P.H*P.dpr);
  if (c.key!==key || c.cv.width!==w){ c.key=key; c.cv.width=w; c.cv.height=h; auxRender(o,w,h); c.cv.getContext('2d').drawImage(auxCv,0,0); }
  return c.cv;
}
const styleKey=()=>[st.palette,st.palRev?1:0,st.cmode,st.density.toFixed(2),st.inside,st.bg,Math.round(st.cycle*50),st.power.toFixed(2)].join('|');
export function drawInsets(){
  const show=(cv,on)=>{ cv.style.display=on?'block':'none'; return on; }, T=TYPES[st.type], na=notAvail();
  if (na){ show(in1,false); show(in2,false); return; }
  if (st.mode==='explore'){
    const jv=st.julia||T.juliaOnly;
    if (show(in1, st.mapInset)){ const P=panel(in1); if (P){ const jw=T.jview||[0,0,1.5], ov=jv&&!T.juliaOnly ? [jw[0],jw[1],jw[2]*1.07,T.view[3]] : [T.view[0],T.view[1],T.view[2]*1.15,T.view[3]];
      const d={x:0,y:0,w:P.W,h:P.H,v:{cx:ov[0],cy:ov[1],scale:ov[2],rot:ov[3]}};
      const img=cachedAux('map', ['m',st.type,jv,st.jc.join(),st.lyaSeq,styleKey()].join('|'), P, {cx:ov[0],cy:ov[1],scale:ov[2],rot:ov[3],type:T.cpu?0:st.type,julia:jv,c:T.juliaOnly?PHX:st.jc,iter:T.newton?60:220});
      roundClip(P); P.g.drawImage(img,0,0,P.W,P.H);
      const md=viewDescs()[0], cs=[[0,0],[md.w,0],[md.w,md.h],[0,md.h]].map(([x,y])=>{ const w=toWorld(md,x,y); return toScreen(d,w[0],w[1]); });
      const span=Math.hypot(cs[0][0]-cs[2][0],cs[0][1]-cs[2][1]), g=P.g; g.strokeStyle='#fff'; g.lineWidth=1.5;
      if (span>10){ g.beginPath(); cs.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.stroke(); g.strokeStyle='rgba(0,0,0,.5)'; g.lineWidth=0.8; g.stroke(); }
      else { const c=toScreen(d,st.vE.cx,st.vE.cy); g.beginPath(); g.arc(c[0],c[1],6,0,7); g.moveTo(c[0]-12,c[1]); g.lineTo(c[0]-4,c[1]); g.moveTo(c[0]+4,c[1]); g.lineTo(c[0]+12,c[1]); g.moveTo(c[0],c[1]-12); g.lineTo(c[0],c[1]-4); g.moveTo(c[0],c[1]+4); g.lineTo(c[0],c[1]+12); g.stroke(); }
      g.restore(); panelTitle(P, 'Map', `you are here · ×${fmtBig(st.vE.def/st.vE.scale)}`, true); } }
    const canPrev=T.julia;
    if (show(in2, st.prevInset && canPrev)){ const P=panel(in2); if (P){ roundClip(P);
      if (!st.julia){ const md=viewDescs()[0], w=st.hover ? toWorld(md,st.hover[0],st.hover[1]) : [st.vE.cx,st.vE.cy], c=toMath(st.type,w), dg=cDigits(), jw=T.jview||[0,0,1.55];
        const img=cachedAux('prev', ['p',st.type,c[0].toFixed(dg),c[1].toFixed(dg),styleKey()].join('|'), P, {cx:jw[0],cy:jw[1],scale:jw[2],type:st.type,julia:true,c,iter:200});
        P.g.drawImage(img,0,0,P.W,P.H); P.g.restore(); panelTitle(P, st.hover?'Julia set at your pointer':'Julia set at the + mark', 'c = '+fmtC(c,dg), true); }
      else { const ov=[T.view[0],T.view[1],T.view[2]*1.15,T.view[3]], d={x:0,y:0,w:P.W,h:P.H,v:{cx:ov[0],cy:ov[1],scale:ov[2],rot:ov[3]}};
        const img=cachedAux('prevM', ['pm',st.type,styleKey()].join('|'), P, {cx:ov[0],cy:ov[1],scale:ov[2],type:st.type,julia:false,iter:200});
        P.g.drawImage(img,0,0,P.W,P.H); const cd=toDisp(st.type,st.jc), p=toScreen(d,cd[0],cd[1]); P.g.strokeStyle='#fff'; P.g.lineWidth=2; P.g.beginPath(); P.g.arc(p[0],p[1],6,0,7); P.g.stroke();
        P.g.restore(); panelTitle(P, 'Where c sits on the map', 'c = '+fmtC(st.jc), true); } } }
  } else if (st.mode==='orbit'){
    show(in2,false);
    if (show(in1, st.chartInset && st.orbit.data)){ const P=panel(in1); if (P) drawChart(P); }
  } else if (st.mode==='d3'){
    show(in2,false);
    if (show(in1, st.cousinInset)){ const P=panel(in1); if (P) drawCousin(P); }
  } else { show(in1,false); show(in2,false); }
}
function drawChart(P){
  const D=st.orbit.data, g=P.g, T=orbitIdx(st.orbit.t), n=D.show, upto=Math.min(n, Math.floor(T));
  const R=Math.sqrt(escR2(st.type)), x0=10, x1=P.W-10, y0=32, y1=P.H-26, top=D.kind==='newton'?2:Math.max(3,R*1.5);
  const yOf=v=>y1-(Math.min(v,top)/top)*(y1-y0), lim=D.kind==='newton'?null:R;
  g.strokeStyle=P.light?'rgba(40,44,60,0.18)':'rgba(220,228,245,0.14)'; g.lineWidth=1; g.beginPath(); g.moveTo(x0,y1); g.lineTo(x1,y1); g.stroke();
  if (lim){ g.setLineDash([4,4]); g.strokeStyle=P.light?'rgba(180,60,40,0.7)':'rgba(255,150,120,0.75)'; g.beginPath(); g.moveTo(x0,yOf(lim)); g.lineTo(x1,yOf(lim)); g.stroke(); g.setLineDash([]);
    g.fillStyle=g.strokeStyle; g.font='10px Inter, sans-serif'; g.fillText(String(R), x1-6-6*String(R).length, yOf(lim)-3); }
  const N=Math.max(n,12), bw=(x1-x0)/(N+1);
  for (let i=0;i<=upto;i++){ const z=D.pts[i], v=D.kind==='newton' ? Math.hypot(z[0]-1,z[1])*0+Math.min(...[[1,0],[-0.5,0.866],[-0.5,-0.866]].map(r=>Math.hypot(z[0]-r[0],z[1]-r[1]))) : Math.hypot(z[0],z[1]);
    g.fillStyle=css(palM(i/Math.max(1,n)*0.5+st.cycle)); const x=x0+i*bw, y=yOf(v); g.fillRect(x, y, Math.max(1,bw*0.75), y1-y); if (v>top){ g.fillStyle='#fff'; g.fillRect(x,y0-3,Math.max(1,bw*0.75),2); } }
  panelTitle(P, D.kind==='newton'?'Distance to nearest root':'|z| at each step', D.kind==='newton'?'shrinks to 0 when it lands':`escapes once it passes ${R}`);
}
function drawCousin(P){
  let s=st.d3.shape; const g=P.g;
  if (s==='bulb'){ roundClip(P); const img=cachedAux('cb', ['cb',st.d3.power.toFixed(2),styleKey()].join('|'), P, {cx:0,cy:0,scale:1.4,type:3,julia:false,iter:120,power:st.d3.power});
    g.drawImage(img,0,0,P.W,P.H); g.restore(); panelTitle(P,'2D cousin: Multibrot', `zⁿ + c with the same power, ${st.d3.power.toFixed(1)}`, true); return; }
  if (s==='mj' || s==='tetra'){ roundClip(P); const img=cachedAux('cm', ['cm',styleKey()].join('|'), P, {cx:-0.6,cy:0,scale:1.35,type:0,julia:false,iter:160});
    g.drawImage(img,0,0,P.W,P.H); g.restore(); panelTitle(P, s==='mj'?'2D slice: Mandelbrot set':'2D cousin: Mandelbrot set', s==='mj'?'the cut where the starting z is 0':'the Tetrabrot is two of these at once', true); return; }
  if (s==='qj'){ roundClip(P); const c=[QC[0],QC[1]]; const img=cachedAux('cq', ['cq',styleKey()].join('|'), P, {cx:0,cy:0,scale:1.5,type:0,julia:true,c,iter:160});
    g.drawImage(img,0,0,P.W,P.H); g.restore(); panelTitle(P,'2D cousin: Julia set', 'same recipe, c = −0.2 + 0.6i', true); return; }
  if (s==='mosely'){ const sh=GROW.vicsek, B=sh.build(4,1), pad=26, S=Math.min((P.W-24)/2,(P.H-pad-24)/2), cx=P.W/2, cy=pad+(P.H-pad-20)/2;
    B.draw({g, tf:p=>[cx+p[0]*S, cy-p[1]*S], s:S, lw:1}); panelTitle(P,'Each face: Vicsek fractal','centre and edge squares, corners gone'); return; }
  if (s==='nest' || s==='flake' || s==='jcube'){ const W=P.W, H=P.H, cx=W/2, cy=26+(H-46)/2, R=Math.min(W-24,H-56)/2, col=(t,a)=>css(palM(t+st.cycle),a); g.lineCap='round';
    if (s==='nest'){ for (let k=0;k<9;k++){ const r=R*Math.pow(0.5,k), rot=k*Math.PI/4; if (r<1.2) break; g.strokeStyle=col(k*0.12); g.lineWidth=Math.max(0.8,2.2*Math.pow(0.8,k));
        for (let q=0;q<4;q++){ const a0=rot+q*Math.PI/2+0.42, a1=rot+(q+1)*Math.PI/2-0.42; g.beginPath(); g.arc(cx,cy,r,-a1,-a0); g.stroke(); } }
      panelTitle(P,'2D cousin: rings in rings','each ring has gaps and a copy inside'); return; }
    if (s==='flake'){ const draw=(x,y,r,ang,l)=>{ g.fillStyle=col(l*0.12,0.9); g.beginPath(); g.arc(x,y,r,0,7); g.fill(); if (l>=4 || r<1) return;
        for (const da of [-Math.PI/2,-Math.PI/6,Math.PI/6,Math.PI/2,0]){ const a=ang+da; draw(x+Math.cos(a)*r*4/3, y-Math.sin(a)*r*4/3, r/3, a, l+1); } };
      draw(cx,cy+R*0.05,R*0.5,Math.PI/2,0); panelTitle(P,'2D cousin: circleflake','every circle grows smaller circles'); return; }
    const K=s==='jcube'?Math.SQRT2-1:1/3;
    const sq=(x,y,h,l)=>{ if (l>=4 || h*R<0.8){ g.fillStyle=col(l*0.12+(x+y)*0.05); g.fillRect(cx+(x-h)*R, cy-(y+h)*R, 2*h*R+0.4, 2*h*R+0.4); return; }
      if (s==='jcube'){ const K2=K*K; for (const sx of [-1,1]) for (const sy of [-1,1]) sq(x+sx*h*(1-K), y+sy*h*(1-K), h*K, l+1);
        for (const [ex,ey] of [[0,1],[0,-1],[1,0],[-1,0]]) sq(x+ex*h*(1-K2), y+ey*h*(1-K2), h*K2, l+1); }
      else for (const [ex,ey] of [[0,1],[0,-1],[1,0],[-1,0]]) sq(x+ex*h*2/3, y+ey*h*2/3, h/3, l+1); };
    sq(0,0,1,0); panelTitle(P, s==='jcube'?'2D cousin: Jerusalem square':'2D cousin: one face', s==='jcube'?'corner and edge squares, cross-shaped gaps':'corners and centre removed, flat'); return; }
  if (s==='klein' || s==='pk'){ const sh=GROW.apollo, B=sh.build(5,1), pad=26, S=Math.min((P.W-24)/2,(P.H-pad-24)/2), cx=P.W/2, cy=pad+(P.H-pad-20)/2;
    B.draw({g, tf:p=>[cx+p[0]*S, cy-p[1]*S], s:S, lw:1}); panelTitle(P,'2D cousin: Apollonian gasket', s==='klein'?'circles inside circles, by inversion':'the same invert-and-fold idea, flat'); return; }
  if (s==='menger4') s='menger'; else if (s==='sier5') s='tet'; else if (s==='kifs4') s='kifs';
  if (s==='menger' || s==='tet' || s==='apo' || s==='kifs'){ const k=s==='menger'?4:s==='apo'?5:6, sh=GROW[s==='menger'?'carpet':s==='apo'?'apollo':'sier'], B=sh.build(k,1), pad=26, bw=B.bbox[2]-B.bbox[0], bh=B.bbox[3]-B.bbox[1], S=Math.min((P.W-24)/bw,(P.H-pad-24)/bh), cx=P.W/2, cy=pad+(P.H-pad-20)/2, bx=(B.bbox[0]+B.bbox[2])/2, by=(B.bbox[1]+B.bbox[3])/2;
    const sbg=st.bg; B.draw({g, tf:p=>[cx+(p[0]-bx)*S, cy-(p[1]-by)*S], s:S, lw:1});
    panelTitle(P, {menger:'2D cousin: Sierpinski carpet',tet:'2D cousin: Sierpinski triangle',apo:'2D cousin: Apollonian gasket',kifs:'2D cousin: Sierpinski triangle'}[s], {menger:'each face of the sponge',tet:'each face of the tetrahedron',apo:'circles in every gap',kifs:'the same fold-and-scale, flat'}[s]); return; }
  panelTitle(P,'2D cousin'); g.font='12px Inter, sans-serif'; g.fillStyle=P.mute; wrapText(g,'The Mandelbox has a flat version too, but it looks nothing like a simple slice of this one, so there\'s no picture here.',10,44,P.W-20,16);
}
function wrapText(g, text, x, y, maxW, lh){ const words=text.split(' '); let line=''; for (const w of words){ const t=line?line+' '+w:w; if (g.measureText(t).width>maxW && line){ g.fillText(line,x,y); y+=lh; line=w; } else line=t; } if (line) g.fillText(line,x,y); }
