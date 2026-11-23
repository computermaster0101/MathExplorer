import { clamp } from '../util.js';
import { st } from '../state.js';

// ---------- palettes ----------
import { PALETTES, rampOf } from '../../../js/common/palettes.js';   // the table (and the colour adjustments) are shared by every explorer
export { PALETTES };
export let RAMP = PALETTES.aurora;
// the palette, optionally run backwards; everything that colours reads RAMP
export function setRamp(){ RAMP = rampOf(st.palette, st.palRev); }
export function palRamp(t){ t=clamp(t,0,0.99999)*(RAMP.length-1); const i=Math.floor(t), f=t-i; return [0,1,2].map(c=>RAMP[i][c]+(RAMP[i+1][c]-RAMP[i][c])*f); }
export function palM(t){ t=((t%1)+1)%1; return palRamp(1-Math.abs(2*t-1)); }     // mirrored, so it cycles seamlessly (same as the shader)
export const css=(c,a)=>{ const s=c.map(x=>Math.round(clamp(x,0,1)*255)).join(','); return a==null?`rgb(${s})`:`rgba(${s},${a})`; };
export const hexRGB=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const sup=n=>String(n).split('').map(ch=>'⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(ch)]||'⁻').join('');
export function fmtBig(m){ if (m<1000) return m.toFixed(m<10?1:0); const e=Math.floor(Math.log10(m)); return (m/10**e).toFixed(1)+'×10'+sup(e); }
export const fmtN=n=>Math.round(n).toLocaleString();
export const minus=x=>(x<0?'−':'')+Math.abs(x);
export const cDigits=()=>clamp(Math.ceil(-Math.log10(st.vE.scale))+3,3,14);
export function fmtC(c,dg=3){ const a=c[0].toFixed(dg), b=Math.abs(c[1]).toFixed(dg); return `${a.replace('-','−')} ${c[1]<0?'−':'+'} ${b}i`; }
