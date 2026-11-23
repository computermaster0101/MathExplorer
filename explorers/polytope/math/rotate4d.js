import { st } from '../state.js';

// ---------- 4D math ----------
export function planeRot(n, planes){
  const M=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
  for (const [a,b,deg] of planes){ const t=deg*Math.PI/180, c=Math.cos(t), s=Math.sin(t);
    for (let r=0;r<n;r++){ const x=M[r][a], y=M[r][b]; M[r][a]=c*x-s*y; M[r][b]=s*x+c*y; } }
  return M;
}
export const rot4 = () => planeRot(4, [[0,1,st.xy],[0,3,st.xw],[1,3,st.yw],[2,3,st.zw]]);
export const rot3 = () => planeRot(3, [[0,1,st.xy],[0,2,st.xw],[1,2,st.yw]]);   // the same turns, one dimension down (Z plays W)
export const mulM = (M,v) => v.length===4 && M.length===4
  ? [v[0]*M[0][0]+v[1]*M[1][0]+v[2]*M[2][0]+v[3]*M[3][0], v[0]*M[0][1]+v[1]*M[1][1]+v[2]*M[2][1]+v[3]*M[3][1],
     v[0]*M[0][2]+v[1]*M[1][2]+v[2]*M[2][2]+v[3]*M[3][2], v[0]*M[0][3]+v[1]*M[1][3]+v[2]*M[2][3]+v[3]*M[3][3]]
  : M[0].map((_,c)=>{ let s=0; for (let r=0;r<v.length;r++) s+=v[r]*M[r][c]; return s; });
// Stereographic projection divides by 1 − W, which blows up near the pole W = 1. Above W = 0.84 (within about 33° of the
// pole) W is eased toward 0.97 instead, so corners passing near it stay on screen; below, the projection is exact. The Learn
// text says so. The packing, touching balls and bubble foam (render/packing.js, render/foam.js) don't use this: they're exact.
export const softW = w => w < 0.84 ? w : 0.84 + 0.13*Math.tanh((w-0.84)/0.13);
export function project(p, proj){            // 4D -> [x,y,z, stretch]
  if (proj === 'stereo'){ const f = 1/(1-softW(p[3])); return [p[0]*f,p[1]*f,p[2]*f,f]; }
  const f = 1.6/(2.2 - p[3]);
  if (proj === 'ortho') return [p[0],p[1],p[2],f];
  return [p[0]*f,p[1]*f,p[2]*f,f];
}
function project2(p, proj){           // 3D -> [x,y, stretch] (the 3D cousin's shadow)
  if (proj === 'stereo'){ const f = 1/(1-softW(p[2])); return [p[0]*f,p[1]*f,f]; }
  const f = 1.6/(2.2 - p[2]);
  if (proj === 'ortho') return [p[0],p[1],f];
  return [p[0]*f,p[1]*f,f];
}
