import { clamp } from '../util.js';
import { PHX, TYPES } from '../fractals/types.js';
import { st, toDisp, toMath } from '../state.js';
import { escR2, startZ, stepFn } from '../fractals/iterate.js';
import { css, palM } from '../color/palettes.js';
import { isLight, octx } from '../render/webgl.js';
import { toScreen, toWorld, touch, viewDescs } from '../view.js';

// ---------- Orbit: follow one point ----------



const SHOWMAX=260;
function computeOrbit(pDisp, type=st.type, julia=st.julia){
  const T=TYPES[type], m=toMath(type,pDisp), pts=[];
  if (T.newton){ let z=m.slice(); pts.push(z.slice()); const roots=[[1,0],[-0.5,0.8660254],[-0.5,-0.8660254]]; let root=-1;
    for (let i=0;i<120;i++){ const x=z[0],y=z[1], z2=[x*x-y*y,2*x*y], z3=[z2[0]*x-z2[1]*y, z2[0]*y+z2[1]*x], num=[z3[0]-1,z3[1]], den=[3*z2[0],3*z2[1]], dd=den[0]*den[0]+den[1]*den[1]; if (dd<1e-30) break;
      z=[x-(num[0]*den[0]+num[1]*den[1])/dd, y-(num[1]*den[0]-num[0]*den[1])/dd]; pts.push(z.slice());
      root=roots.findIndex(r=>(z[0]-r[0])**2+(z[1]-r[1])**2<1e-12); if (root>=0) break; }
    return {kind:'newton', pts, root, n:pts.length-1, show:pts.length-1, p0:pDisp}; }
  let z, c, zp=[0,0]; const jv=julia||T.juliaOnly; if (jv){ z=m.slice(); c=T.juliaOnly?PHX:st.jc; } else { z=startZ(type,m); c=m; }
  const f=type===5?null:stepFn(type); pts.push(z.slice()); let esc=-1;
  const step=()=>{ if (type===5){ const nz=[z[0]*z[0]-z[1]*z[1]+c[0]+c[1]*zp[0], 2*z[0]*z[1]+c[1]*zp[1]]; zp=z; z=nz; } else z=f(z,c); };
  const R2=escR2(type);
  for (let i=1;i<=3000;i++){ const zl=z; step(); if (!isFinite(z[0])||!isFinite(z[1])){ z=zl; esc=i; break; } if (i<=SHOWMAX) pts.push(z.slice()); if (z[0]*z[0]+z[1]*z[1]>R2){ esc=i; break; } }
  let period=0, cyc=[];
  if (esc<0){ const ref=z.slice(); for (let p=1;p<=64;p++){ step(); cyc.push(z.slice()); if (Math.hypot(z[0]-ref[0],z[1]-ref[1])<1e-7){ period=p; break; } } if (!period) cyc=[]; }
  const show = esc>0 ? Math.min(esc,SHOWMAX) : Math.min(SHOWMAX, period ? Math.max(40, 12*period) : 160);
  return {kind:'escape', pts, esc, period, cyc, show, julia:jv, c, p0:pDisp};
}
export const orbitIdx=t=>{ const s=st.orbit.step, a=12*s; return t<a ? t/s : 12+(t-a)/(s*0.3); };
export function newOrbit(p){ const O=st.orbit; if (TYPES[st.type].noOrbit) return;
  if (!p){ const d=viewDescs()[0]; let best=null;
    for (let tries=0;tries<400;tries++){ const sx=d.w*(0.12+0.76*Math.random()), sy=d.h*(0.2+0.6*Math.random()), w=toWorld(d,sx,sy), o=computeOrbit(w);
      if (o.kind==='newton'){ if (o.n>=4){ best=o; break; } continue; }
      if (o.esc>0 ? (o.esc>=7 && o.esc<=150) : (o.period>=1 && o.period<=9 && (o.period>1 || Math.random()<0.35))){ best=o; break; } if (!best) best=o; }
    O.data=best; } else O.data=computeOrbit(p);
  O.t=0; touch(); }
export function drawOrbit(){
  const O=st.orbit, D=O.data; if (!D) return; const g=octx, d=viewDescs()[0], T=orbitIdx(O.t), n=D.show, type=st.type;
  const scr=z=>{ const q=toDisp(type,z); return toScreen(d,q[0],q[1]); };
  if (O.circle && D.kind==='escape'){ const c0=toScreen(d,0,0), r=Math.sqrt(escR2(type))/d.v.scale*d.h/2; g.setLineDash([5,6]); g.strokeStyle=isLight()?'rgba(40,44,60,0.45)':'rgba(220,228,245,0.4)'; g.lineWidth=1.2; g.beginPath(); g.arc(c0[0],c0[1],r,0,7); g.stroke(); g.setLineDash([]); }
  const lw=1.6*st.lw, echo=O.style==='echo'; g.lineCap='round'; g.lineJoin='round';
  const upto=Math.min(n, Math.floor(T));
  for (let i=0;i<upto+1 && i<n;i++){ const fr=i<upto?1:T-upto; if (fr<=0) break; const a=scr(D.pts[i]), b0=scr(D.pts[i+1]), b=[a[0]+(b0[0]-a[0])*fr, a[1]+(b0[1]-a[1])*fr];
    const alpha=echo?clamp(1-(T-i-1)/6,0.06,1):0.95; g.strokeStyle=css(palM(i/Math.max(1,n)*0.5+st.cycle),alpha); g.lineWidth=lw; g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); }
  for (let i=0;i<=Math.min(n,upto);i++){ const p=scr(D.pts[i]), alpha=echo?clamp(1-(T-i)/6,0.06,1):1, r=(i===0?5:3)*Math.sqrt(st.lw);
    g.fillStyle= i===0 ? css([1,1,1],alpha) : css(palM(i/Math.max(1,n)*0.5+st.cycle).map(x=>Math.min(1,x*1.1)),alpha); g.beginPath(); g.arc(p[0],p[1],r,0,7); g.fill(); }
  const cur=Math.min(n, T), ci=Math.floor(cur), cf=cur-ci, pa=scr(D.pts[ci]), pb=scr(D.pts[Math.min(D.pts.length-1,ci+1)]), pc=[pa[0]+(pb[0]-pa[0])*cf, pa[1]+(pb[1]-pa[1])*cf];
  g.fillStyle=css([1,1,1],0.25); g.beginPath(); g.arc(pc[0],pc[1],10*Math.sqrt(st.lw),0,7); g.fill(); g.fillStyle='#fff'; g.beginPath(); g.arc(pc[0],pc[1],4.5*Math.sqrt(st.lw),0,7); g.fill();
  const s0=toScreen(d,D.p0[0],D.p0[1]); g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); g.arc(s0[0],s0[1],8,0,7); g.stroke();
  if (D.period && T>=n){ g.strokeStyle=isLight()?'#222':'#fff'; g.lineWidth=1.5; for (const z of D.cyc){ const p=scr(z); g.beginPath(); g.arc(p[0],p[1],7,0,7); g.stroke(); } }
}
