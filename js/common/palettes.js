// The colour palettes every explorer offers (each a list of colours from low to high), and small colour helpers.
export const PALETTES = {
  aurora:[[0.23,0.42,1],[0.64,0.36,1],[1,0.44,0.66],[1,0.70,0.36]],
  ember:[[0.25,0.06,0.35],[0.7,0.12,0.38],[0.98,0.4,0.15],[1,0.85,0.35]],
  ocean:[[0.06,0.16,0.45],[0.1,0.45,0.78],[0.2,0.8,0.85],[0.8,1,0.92]],
  viridis:[[0.27,0.0,0.33],[0.23,0.32,0.55],[0.13,0.57,0.55],[0.37,0.79,0.38],[0.99,0.91,0.14]],
  neon:[[0,1,0.9],[0.3,0.4,1],[1,0.2,0.8],[1,0.95,0.2]],
  wheel:[[0.947,0.007,0.007],[0.947,0.947,0.007],[0.007,0.947,0.007],[0.007,0.947,0.947],[0.007,0.007,0.947],[0.947,0.007,0.947],[0.947,0.007,0.007]],   // the colour wheel, all the way round (Complex Functions' classic angle colours)
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
  // wide ones: the whole colour wheel, or opposite colours side by side
  spectrum:[[1,0.2,0.2],[1,0.6,0.1],[0.95,0.95,0.2],[0.3,0.9,0.3],[0.2,0.85,0.9],[0.25,0.4,1],[0.75,0.3,1],[1,0.2,0.6]],
  turbo:[[0.19,0.07,0.23],[0.27,0.42,0.89],[0.1,0.75,0.86],[0.36,0.98,0.47],[0.84,0.92,0.21],[0.98,0.6,0.12],[0.8,0.2,0.04],[0.48,0.02,0.01]],
  spectral:[[0.62,0,0.26],[0.9,0.33,0.28],[0.99,0.68,0.38],[1,1,0.75],[0.67,0.87,0.64],[0.4,0.76,0.65],[0.2,0.53,0.74],[0.37,0.31,0.64]],
  cubehelix:[[0,0,0],[0.09,0.11,0.25],[0.08,0.33,0.33],[0.24,0.47,0.18],[0.63,0.47,0.29],[0.81,0.5,0.66],[0.78,0.72,0.95],[1,1,1]],
  twilight:[[0.89,0.85,0.89],[0.55,0.65,0.8],[0.38,0.4,0.72],[0.27,0.15,0.4],[0.47,0.15,0.3],[0.73,0.38,0.32],[0.87,0.7,0.62],[0.89,0.85,0.89]],
  carnival:[[0.95,0.2,0.45],[1,0.55,0.1],[1,0.9,0.2],[0.1,0.8,0.5],[0.1,0.5,0.95],[0.55,0.2,0.85]],
  teal_orange:[[0,0.35,0.4],[0,0.65,0.65],[0.9,0.9,0.85],[1,0.6,0.2],[0.75,0.3,0]],
  blue_gold:[[0.05,0.1,0.4],[0.15,0.35,0.85],[0.95,0.95,0.95],[1,0.8,0.3],[0.7,0.45,0]],
  purple_lime:[[0.3,0.05,0.45],[0.6,0.25,0.85],[0.92,0.92,0.92],[0.65,0.9,0.25],[0.25,0.55,0.05]],
  red_cyan:[[0.55,0,0.05],[1,0.3,0.3],[0.15,0.15,0.18],[0.3,0.9,1],[0,0.5,0.6]],
  bold:[[0.05,0.05,0.1],[1,0.15,0.3],[1,0.85,0.1],[0.1,0.6,1],[1,1,1]],
  // your own (Colour & style → Make your own): replaced by the colours you pick, remembered on this device
  mine:[[0.1,0.2,0.6],[0.9,0.3,0.6],[1,0.85,0.4]],
};
/** A palette's name for people. */
const TITLES = { mine: 'Your palette', wheel: 'Colour wheel' };
export const palTitle = name => TITLES[name] || name.replace('_', ' & ').replace(/^./, c => c.toUpperCase());
/** Does the palette end where it starts (so it can run once round a circle without a seam)? */
export const loops = r => r.length > 2 && r[0].every((v, i) => Math.abs(v - r[r.length - 1][i]) < 0.02);

// ---------- colour adjustments, shared by every explorer and kept in share links ----------
// Hue turns every colour round the colour wheel (keeping its brightness), saturation makes them bolder or greyer, light
// darker or paler. They apply to whatever palette is chosen, through rampOf, so every explorer's colouring, cycling and
// reversing work on the adjusted colours unchanged.
export const ADJ = { hue: 0, sat: 1, lit: 1 };
export function adjust(c) {
  if (!ADJ.hue && ADJ.sat === 1 && ADJ.lit === 1) return c;
  const [r, g, b] = c, y = 0.299 * r + 0.587 * g + 0.114 * b, i0 = 0.596 * r - 0.274 * g - 0.322 * b, q0 = 0.211 * r - 0.523 * g + 0.312 * b;
  const a = ADJ.hue * Math.PI / 180, ca = Math.cos(a) * ADJ.sat, sa = Math.sin(a) * ADJ.sat, i = i0 * ca - q0 * sa, q = i0 * sa + q0 * ca;   // turn and scale the colour part, keep the brightness y
  let o = [y + 0.956 * i + 0.621 * q, y - 0.272 * i - 0.647 * q, y - 1.106 * i + 1.703 * q];
  o = o.map(v => ADJ.lit <= 1 ? v * ADJ.lit : v + (1 - v) * (ADJ.lit - 1));   /* below 1 darker, above 1 toward white */
  return o.map(v => Math.min(1, Math.max(0, v)));
}
/** The colours of a palette, reversed if asked. */
export const rampOf=(name, rev)=>{ const r=(PALETTES[name]||PALETTES.aurora).map(adjust); return rev ? r.reverse() : r; };
/** A colour from a ramp at t (0..1), blending between its stops. */
export function sampleRamp(r, t){ t=Math.min(0.99999, Math.max(0, t))*(r.length-1); const i=Math.floor(t), f=t-i; return [0,1,2].map(c=>r[i][c]+(r[i+1][c]-r[i][c])*f); }
/** The same, mirrored so it cycles seamlessly (t wraps round 1). */
export const sampleMirror=(r, t)=>{ t=((t%1)+1)%1; return sampleRamp(r, 1-Math.abs(2*t-1)); };
/** A palette as uniform data for a shader: up to 8 stops, flattened, and how many there are. */
export function rampUniform(r){ const a=new Float32Array(24); r.slice(0,8).forEach((c,i)=>a.set(c,i*3)); return {data:a, n:Math.min(8,r.length)}; }
export const css=(c,a)=>{ const s=c.map(x=>Math.round(Math.min(1,Math.max(0,x))*255)).join(','); return a==null?`rgb(${s})`:`rgba(${s},${a})`; };
export const hexRGB=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
/** GLSL for a palette lookup: declares u_pal[8], u_npal and vec3 pal(float t). It is mirrored so it cycles seamlessly: t from 0 to 0.5
 *  runs the palette start to end and 0.5 to 1 runs it back. For an amount from 0 to 1, look up pal(v*0.5 + cycle). */
export const PAL_GLSL=`uniform vec3 u_pal[8]; uniform int u_npal;
vec3 pal(float t){ t=fract(t); float s=1.0-abs(2.0*t-1.0); float x=s*float(u_npal-1); int i=min(int(x),u_npal-2); return mix(u_pal[i],u_pal[i+1],x-float(i)); }`;
