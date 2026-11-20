import { st } from '../state.js';

export const escR2=type=>type===11 ? st.custom.bail*st.custom.bail : 4;
export const startZ=(type,c)=> type===11 ? st.custom.z0js(c) : [0,0];
export function stepFn(type){ if (type===11) return (z,c)=>st.custom.js(z,c); const P=st.power; return [
  (z,c)=>[z[0]*z[0]-z[1]*z[1]+c[0], 2*z[0]*z[1]+c[1]],
  (z,c)=>{ const a=Math.abs(z[0]), b=Math.abs(z[1]); return [a*a-b*b+c[0], 2*a*b+c[1]]; },
  (z,c)=>[z[0]*z[0]-z[1]*z[1]+c[0], -2*z[0]*z[1]+c[1]],
  (z,c)=>{ const r=Math.hypot(z[0],z[1]); if (r<1e-300) return c.slice(); const th=Math.atan2(z[1],z[0])*P, rp=Math.pow(r,P); return [rp*Math.cos(th)+c[0], rp*Math.sin(th)+c[1]]; },
  (z,c)=>[Math.abs(z[0]*z[0]-z[1]*z[1])+c[0], 2*z[0]*z[1]+c[1]] ][type]; }
