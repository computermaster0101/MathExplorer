import * as THREE from 'three';
import { shared } from '../shared.js';
import { st } from '../state.js';

// ---------- colour ----------
import { PALETTES } from '../../../js/common/palettes.js';   // the table is shared by every explorer
export { PALETTES };
shared.RAMP = PALETTES.aurora; shared.DIRCOL = []; shared.SOLID = [1,1,1]; shared.CELLCOL = [];
export const AXISCOL = [[1,0.32,0.32],[0.3,0.88,0.4],[0.32,0.58,1],[0.8,0.52,1]];
export function wColor(w){
  let u = Math.min(0.9999, Math.max(0, (w+1)/2));
  if (st.density!==1 || st.cycle){ const v=u*0.5*st.density+st.cycle, fr=v-Math.floor(v); u=Math.min(0.9999, 1-Math.abs(2*fr-1)); }   // mirrored, so it cycles seamlessly
  const t = u*(shared.RAMP.length-1), i=Math.floor(t), f=t-i;
  return [0,1,2].map(c => shared.RAMP[i][c]+(shared.RAMP[i+1][c]-shared.RAMP[i][c])*f);
}
// one colour channel per dimension: X→red, Y→green, Z→blue, W→lightness
function rgb4(q){
  const c=[0,1,2].map(a=>Math.min(1,Math.max(0,0.5+0.62*q[a])));
  const m=(c[0]+c[1]+c[2])/3;
  for (let a=0;a<3;a++) c[a]=Math.min(1,Math.max(0,m+(c[a]-m)*1.35));
  for (let a=0;a<3;a++) c[a]=0.2+0.8*c[a];
  const w=Math.max(-1,Math.min(1,q[3]));
  return w>=0 ? c.map(x=>x+(1-x)*0.55*w) : c.map(x=>x*(1+0.45*w)+0.05);
}
// o = point's original ("painted") 4D position, w = where it is along W right now
export function colorOf(o, w, fam, ctx){
  switch (st.cmode){
    case 'rgb4': return rgb4(o.map((x,a)=>x/ctx.amax[a]));
    case 'body': return wColor(o[3]/ctx.wmax);
    case 'w': return wColor(w);
    case 'dir': return fam<0 ? [0.9,0.91,0.94] : shared.DIRCOL[fam];
    default: return shared.SOLID;
  }
}
export const bgRGB = () => { const c=new THREE.Color(st.bg); return [c.r,c.g,c.b]; };
export const css = c => `rgb(${c.map(x=>Math.round(Math.min(1,x)*255)).join(',')})`;

export const WHITE = () => [0.95,0.96,1];
