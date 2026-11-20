import { shared } from '../shared.js';
import { $ } from '../util.js';
import { TYPES } from '../fractals/types.js';
import { st, toDisp } from '../state.js';
import { stepFn } from '../fractals/iterate.js';
import { fmtC } from '../color/palettes.js';
import { isLight, octx } from '../render/webgl.js';
import { cssH, cssW, toScreen, viewDescs } from '../view.js';

// ---------- overlay for Julia link ----------
export function pathC(t){ if (st.link.path==='edge'){ const r=0.985; return [r/2*Math.cos(t)-r*r/4*Math.cos(2*t), r/2*Math.sin(t)-r*r/4*Math.sin(2*t)]; } return [0.7885*Math.cos(t), 0.7885*Math.sin(t)]; }
export function boundedTest(c){ const T=TYPES[st.type]; if (T.juliaOnly||T.newton||T.noBounded||T.cpu) return null; const f=stepFn(st.type); let z=[0,0]; for (let i=1;i<=1500;i++){ z=f(z,c); if (z[0]*z[0]+z[1]*z[1]>4) return i; } return 0; }
export function drawLink(){
  const g=octx, [L,R]=viewDescs(), light=isLight(), txt=light?'#2b303b':'#e8ebf2';
  g.strokeStyle=light?'rgba(40,44,60,0.35)':'rgba(220,228,245,0.3)'; g.lineWidth=1; g.beginPath(); if (R.x>0){ g.moveTo(R.x,0); g.lineTo(R.x,cssH); } else { g.moveTo(0,R.y); g.lineTo(cssW,R.y); } g.stroke();
  g.save(); g.beginPath(); g.rect(L.x,L.y,L.w,L.h); g.clip();
  if (st.link.auto){ g.strokeStyle=light?'rgba(40,44,60,0.35)':'rgba(255,255,255,0.28)'; g.setLineDash([3,5]); g.beginPath();
    for (let i=0;i<=160;i++){ const c=toDisp(st.type,pathC(i/160*Math.PI*2)), p=toScreen(L,c[0],c[1]); i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]); } g.stroke(); g.setLineDash([]); }
  const cd=toDisp(st.type,st.jc), p=toScreen(L,cd[0],cd[1]);
  g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); g.arc(p[0],p[1],9,0,7); g.stroke(); g.strokeStyle='rgba(0,0,0,0.6)'; g.lineWidth=1; g.beginPath(); g.arc(p[0],p[1],11,0,7); g.stroke();
  g.fillStyle='#fff'; g.beginPath(); g.arc(p[0],p[1],2.5,0,7); g.fill(); g.restore();
  g.font='600 12px Inter, sans-serif'; g.fillStyle=txt;
  const capH = $('stageCap').style.display==='block' ? $('stageCap').offsetHeight+46 : 40;
  const lab=(x,yb,t1,t2)=>{ g.font='600 12px Inter, sans-serif'; const w1=g.measureText(t1).width; g.font='11.5px Inter, sans-serif'; const w=Math.max(w1,g.measureText(t2).width)+18;
    g.fillStyle=light?'rgba(255,255,255,0.8)':'rgba(11,13,18,0.75)'; g.beginPath(); g.roundRect ? g.roundRect(x,yb-40,w,40,8) : g.rect(x,yb-40,w,40); g.fill();
    g.fillStyle=txt; g.font='600 12px Inter, sans-serif'; g.fillText(t1,x+9,yb-23); g.font='11.5px Inter, sans-serif'; g.fillStyle=light?'#5b6170':'#aab3c5'; g.fillText(t2,x+9,yb-8); };
  const wide=R.x>0;
  lab(L.x+12, wide ? cssH-capH : L.y+L.h-10, 'The map: every point is a c', 'drag to move the marker');
  lab(R.x+12, wide ? cssH-capH : R.y+50, 'Julia set for c = '+fmtC(st.jc), 'drag to move · scroll to zoom');
}

export function drawTapMark(){ if (!shared.tapMark) return; const a=(performance.now()-shared.tapMark.t)/900; if (a>1){ shared.tapMark=null; return; }
  const g=octx; g.strokeStyle=`rgba(255,255,255,${1-a})`; g.lineWidth=2; g.beginPath(); g.arc(shared.tapMark.x,shared.tapMark.y,8+26*a,0,7); g.stroke(); }
export function drawCentreMark(){
  const T=TYPES[st.type]; if (!st.prevInset || !T.julia || st.julia || st.hover) return;
  const g=octx, x=cssW/2, y=cssH/2, light=isLight();
  g.lineCap='round'; for (const [col,w] of [[light?'rgba(255,255,255,0.8)':'rgba(0,0,0,0.55)',3.5],[light?'#222':'#fff',1.5]]){ g.strokeStyle=col; g.lineWidth=w;
    g.beginPath(); g.moveTo(x-11,y); g.lineTo(x-4,y); g.moveTo(x+4,y); g.lineTo(x+11,y); g.moveTo(x,y-11); g.lineTo(x,y-4); g.moveTo(x,y+4); g.lineTo(x,y+11); g.stroke(); }
}
