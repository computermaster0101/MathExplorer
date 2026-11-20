import { clamp } from '../util.js';
import { st } from '../state.js';
import { hexRGB, palRamp } from '../color/palettes.js';
import { octx } from '../render/webgl.js';
import { cssH, cssW } from '../view.js';

// ---------- Buddhabrot: count where escaping orbits go (on the CPU, sharpening over time) ----------
export const bud={key:'', cv:document.createElement('canvas'), W:1, H:1, k:1, R:null, G:null, B:null, n:0, orb:new Float64Array(8200), frame:0, img:null};
export function budLimit(){ return st.budMode==='nebula' ? 2000 : st.budMode==='anti' ? 300 : (st.iterAuto ? 1000 : clamp(st.iter,50,4000)); }
export function budStep(){
  const v=st.vE, lim=budLimit(), key=[v.cx,v.cy,v.scale,v.rot,cssW,cssH,st.budMode,lim].join('|');
  if (key!==bud.key){ bud.key=key; bud.k=Math.min(1,1000/cssW); bud.W=Math.max(1,Math.round(cssW*bud.k)); bud.H=Math.max(1,Math.round(cssH*bud.k)); const N=bud.W*bud.H;
    bud.R=new Float32Array(N); bud.G=new Float32Array(N); bud.B=new Float32Array(N); bud.n=0; bud.cv.width=bud.W; bud.cv.height=bud.H; bud.img=bud.cv.getContext('2d').createImageData(bud.W,bud.H); bud.frame=0; }
  const W=bud.W, H=bud.H, hh=H/2, hw=W/2, sc=v.scale, cr0=Math.cos(v.rot), sr0=Math.sin(v.rot), O=bud.orb, R=bud.R, G=bud.G, B=bud.B, anti=st.budMode==='anti', neb=st.budMode==='nebula', vx=v.cx, vy=v.cy;
  const t0=performance.now();
  while (performance.now()-t0<14){
    for (let rep=0;rep<250;rep++){
      const cr=-2.05+Math.random()*2.7, ci=Math.random()*1.25;
      if (!anti){ const xq=cr-0.25, q=xq*xq+ci*ci; if (q*(q+xq)<0.25*ci*ci) continue; if ((cr+1)*(cr+1)+ci*ci<0.0625) continue; }
      let zr=0, zi=0, n=0, esc=false;
      for (; n<lim; n++){ const t=zr*zr-zi*zi+cr; zi=2*zr*zi+ci; zr=t; O[2*n]=zr; O[2*n+1]=zi; if (zr*zr+zi*zi>4){ esc=true; n++; break; } }
      bud.n++; if (anti ? esc : !esc) continue;
      for (let i=anti?30:0; i<n; i++){ const xr=O[2*i];
        for (let sg=-1; sg<=1; sg+=2){ const dx=(xr-vx)/sc, dy=(sg*O[2*i+1]-vy)/sc, px=Math.floor(hw+(cr0*dx+sr0*dy)*hh), py=Math.floor(hh-(-sr0*dx+cr0*dy)*hh);
          if (px<0||py<0||px>=W||py>=H) continue; const id=py*W+px;
          if (neb){ R[id]++; if (n<200) G[id]++; if (n<40) B[id]++; } else R[id]++; } } } }
}
export function budDraw(){
  if (bud.img && bud.frame++%4===0){ const N=bud.W*bud.H, d=bud.img.data, bg=hexRGB(st.bg), neb=st.budMode==='nebula';
    let mR=1,mG=1,mB=1; for (let i=0;i<N;i++){ if (bud.R[i]>mR) mR=bud.R[i]; if (bud.G[i]>mG) mG=bud.G[i]; if (bud.B[i]>mB) mB=bud.B[i]; }
    const tone=(x,m)=>Math.min(1,Math.sqrt(x/m)*1.7), lut=Array.from({length:256},(_,i)=>palRamp(i/255));
    for (let i=0;i<N;i++){ let r,g,b;
      if (neb){ const a=tone(bud.R[i],mR), e=tone(bud.G[i],mG), f=tone(bud.B[i],mB), m=Math.max(a,e,f); r=bg[0]*(1-m)+a; g=bg[1]*(1-m)+e; b=bg[2]*(1-m)+f; }
      else { const t=tone(bud.R[i],mR), c=lut[Math.min(255,Math.floor(t*255))], k=Math.min(1,t*1.25); r=bg[0]+(c[0]-bg[0])*k; g=bg[1]+(c[1]-bg[1])*k; b=bg[2]+(c[2]-bg[2])*k; }
      const o=i*4; d[o]=Math.min(255,r*255); d[o+1]=Math.min(255,g*255); d[o+2]=Math.min(255,b*255); d[o+3]=255; }
    bud.cv.getContext('2d').putImageData(bud.img,0,0); }
  octx.imageSmoothingEnabled=true; octx.drawImage(bud.cv,0,0,cssW,cssH);
}
