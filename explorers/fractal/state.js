import { dblToFix } from './math/big-fixed.js';
import { TYPES } from './fractals/types.js';

// ---------- state ----------
export const st = { motionQ:'balanced', paused:false, keyDriveT:0, bla:true, custom:{src:'z^3 + sin(z) + c', z0:'0', bail:100, js:(z,c)=>{ const r=Math.hypot(z[0],z[1]), t=Math.atan2(z[1],z[0])*3, r3=r*r*r; return [r3*Math.cos(t)+Math.sin(z[0])*Math.cosh(z[1])+c[0], r3*Math.sin(t)+Math.cos(z[0])*Math.sinh(z[1])+c[1]]; }, z0js:c=>[0,0]}, precision:'standard', prog:null, vel:[0,0], endless:true, endlessRun:false, trip:0, manualT:0, insideT:0, iterNeed:0, probeT:0, steer:true, steerT:0, steerTo:null, q:1, qMove:1, lyaSeq:'AB', budMode:'buddha', mode:'explore', type:0, julia:false, jc:[-0.123,0.745], power:3,
  vE:null, vL:null, vR:null, vO:null, rotDeg:0,
  iterAuto:true, iter:300, aa:2, cmode:0, palette:'aurora', cycle:0, cycleSpeed:0, density:1, inside:0, bg:'#0b0d12', lw:1.2,
  dive:false, diveSpeed:0.5, fly:null, hover:null, placeIdx:0, mapInset:true, prevInset:true, centreMark:false, chartInset:true, cousinInset:true,
  grow:{shape:'koch', t:0, playing:true, zoom:false, zph:0, angle:{pyth:45, tree:28}, gv:{ox:0,oy:0,z:1}, fit:null},
  link:{auto:true, path:'circle', t:0.9},
  orbit:{data:null, t:0, playing:true, auto:true, step:0.4, style:'stay', circle:true},
  d3:{axw:0, ayw:0, azw:0, spin4:false, spT:0, shape:'bulb', power:8, breathe:false, boxS:-1.8, w:0, sweep:false, lvl:5, yaw:0.7, pitch:0.32, dist:4.25, dragMode:'turn', floating:false, needAim:false, aimT:0, aim:null, target:null, dive:false, extra:0, twist:0, twAnim:false, rxy:0, rxz:0, ryz:0, spin3:false, cut:false, glass:false, hyp:'534', hypW:false, bsBreathe:false, bsT:0, twT:0, turn:0, t:0, q:0.6, wt:0} };
export const view = (a,extraRot=0) => ({cx:a[0], cy:a[1], lx:0, ly:0, bx:dblToFix(a[0]), by:dblToFix(a[1]), scale:a[2], rot:a[3]+extraRot, def:a[2]});
export function juliaView(){ const T=TYPES[st.type], j=T.jview||[0,0,1.5]; return view([j[0],j[1],j[2],T.view[3]]); }
export function fitV(v, a){ v.scale=Math.max(v.scale, v.scale*1.18/a); v.def=v.scale; return v; }

export const toMath=(type,p)=> type===1 ? [p[0],-p[1]] : p;       // the Burning Ship is drawn upside down (that's how it's always shown)
export const toDisp=toMath;

export const isExt=()=>st.precision==='extreme';
// colour density (the music flashes brightness instead, through u_flash)
export const effDensity=()=> st.density;
export const ptrs=new Map();

// ---------- sharpness while moving ----------
// While anything moves, the picture is drawn at a fraction st.q of full resolution so motion stays steady; once it's still it
// is redrawn sharp. The viewer's choice (saved in this browser, not in share links) sets where q starts, its ceiling while
// moving and how low the frame-rate controller may take it. Dives get a higher floor: their motion is steady, so a slightly
// lower frame rate shows less than a soft picture.
export const MOTION_Q={
  smooth:  { d3:[0.6, 0.85, 0.3], d2:[1, 1, 0.3], dive:0 },      // [start, ceiling, floor]: how it always was
  balanced:{ d3:[0.85, 1, 0.5],  d2:[1, 1, 0.6], dive:0.1 },
  sharp:   { d3:[1, 1, 1],       d2:[1, 1, 1],   dive:0 },
};
try { const v=localStorage.getItem('mathexplorer.motionQ'); if (MOTION_Q[v]) st.motionQ=v; } catch(e){ /* storage blocked: keep the default */ }
export function qLimits(){ const M=MOTION_Q[st.motionQ]||MOTION_Q.balanced, [start, max, floor]=st.mode==='d3' ? M.d3 : M.d2;
  const diving = st.mode==='d3' ? !!(st.d3.dive||st.d3.warp) : !!(st.dive||st.endlessRun);
  return { start, max, floor: Math.min(max, floor+(diving?M.dive:0)) }; }
