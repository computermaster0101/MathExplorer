import * as THREE from 'three';
import { shared } from '../shared.js';
import { st } from '../state.js';

// ---------- colour ----------
export const PALETTES = {
  aurora:[[0.23,0.42,1],[0.64,0.36,1],[1,0.44,0.66],[1,0.70,0.36]],
  ember:[[0.25,0.06,0.35],[0.7,0.12,0.38],[0.98,0.4,0.15],[1,0.85,0.35]],
  ocean:[[0.06,0.16,0.45],[0.1,0.45,0.78],[0.2,0.8,0.85],[0.8,1,0.92]],
  viridis:[[0.27,0.0,0.33],[0.23,0.32,0.55],[0.13,0.57,0.55],[0.37,0.79,0.38],[0.99,0.91,0.14]],
  neon:[[0,1,0.9],[0.3,0.4,1],[1,0.2,0.8],[1,0.95,0.2]],
  rainbow:[[1,0.25,0.25],[1,0.7,0.2],[0.4,0.9,0.3],[0.2,0.6,1],[0.7,0.3,1]],
  gold:[[0.4,0.22,0.05],[0.82,0.56,0.2],[1,0.85,0.5],[1,0.97,0.85]],
  ice:[[0.3,0.36,0.48],[0.62,0.7,0.84],[0.88,0.93,1],[1,1,1]],
  sunset:[[0.18,0.1,0.42],[0.62,0.18,0.55],[0.98,0.38,0.38],[1,0.66,0.3],[1,0.9,0.55]],
  forest:[[0.08,0.22,0.14],[0.16,0.45,0.25],[0.45,0.7,0.3],[0.85,0.9,0.5]],
  magma:[[0.0,0.0,0.02],[0.32,0.07,0.5],[0.72,0.21,0.47],[0.99,0.53,0.38],[0.99,0.99,0.75]],
  plasma:[[0.05,0.03,0.53],[0.49,0.01,0.66],[0.8,0.28,0.47],[0.97,0.59,0.25],[0.94,0.98,0.13]],
  cyber:[[1,0.1,0.55],[0.6,0.15,1],[0.1,0.6,1],[0.1,1,0.75]],
  candy:[[1,0.6,0.8],[0.75,0.65,1],[0.55,0.85,1],[0.7,1,0.8],[1,0.95,0.65]],
  lava:[[0.15,0.02,0.02],[0.6,0.05,0.02],[1,0.35,0],[1,0.8,0.2]],
  mint:[[0.05,0.3,0.35],[0.15,0.65,0.6],[0.55,0.92,0.75],[0.9,1,0.92]],
  galaxy:[[0.08,0.05,0.25],[0.3,0.12,0.6],[0.85,0.3,0.85],[0.55,0.8,1],[1,1,1]],
  desert:[[0.45,0.22,0.12],[0.78,0.45,0.25],[0.93,0.72,0.48],[0.98,0.9,0.75]],
  berry:[[0.25,0.02,0.2],[0.55,0.08,0.38],[0.85,0.2,0.45],[1,0.55,0.6]],
  toxic:[[0.05,0.15,0.05],[0.2,0.6,0.1],[0.6,1,0.1],[1,1,0.4]],
  steel:[[0.18,0.22,0.28],[0.4,0.47,0.55],[0.65,0.72,0.8],[0.92,0.95,0.98]],
  copper:[[0.25,0.1,0.06],[0.6,0.3,0.18],[0.88,0.55,0.35],[1,0.82,0.65]],
  spring:[[1,0.45,0.6],[1,0.8,0.4],[0.6,0.9,0.4],[0.4,0.85,0.9]],
  pastel:[[0.98,0.7,0.7],[0.98,0.86,0.66],[0.75,0.92,0.75],[0.7,0.82,0.98],[0.85,0.75,0.98]],
  fire_ice:[[0.15,0.5,1],[0.6,0.85,1],[1,1,1],[1,0.7,0.3],[1,0.25,0.1]],
  peacock:[[0.05,0.2,0.4],[0.0,0.5,0.55],[0.15,0.7,0.4],[0.7,0.8,0.2],[0.3,0.3,0.8]],
  thermal:[[0,0,0.3],[0.4,0,0.7],[0.9,0.1,0.4],[1,0.6,0],[1,1,0.8]],
  mono:[[0.25,0.25,0.25],[0.55,0.55,0.55],[0.8,0.8,0.8],[1,1,1]],
};
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
