// Fractal explorer entry. Importing this module boots the explorer (the side-effect imports below run in this order);
// the exports are the lifecycle the shell (js/main.js) drives.
import './util.js';
import './math/double-double.js';
import './math/big-fixed.js';
import './fractals/types.js';
import './state.js';
import './fractals/iterate.js';
import './color/palettes.js';
import './render/webgl.js';
import './formula/formula.js';
import './view.js';
import './render/bla.js';
import './ui/notice.js';
import './modes/buddhabrot.js';
import './modes/fractal3d.js';
import './modes/grow.js';
import './modes/orbit.js';
import './modes/julia-link.js';
import './ui/insets.js';
import './ui/learn.js';
import './ui/controls.js';
import './ui/formula-panel.js';
import './io/save-image.js';
import './io/share.js';
import './io/recorder.js';
import './io/print3d.js';
import './input/pointers.js';
import './loop.js';
import './input/keyboard.js';
import { shared } from './shared.js';
import { ddFrom } from './math/double-double.js';
import { fixToNum, strToFix } from './math/big-fixed.js';
import { st } from './state.js';
import { gl, glc, refSlots } from './render/webgl.js';
import { moveCentre, resetViews, sizeBuffers, touch } from './view.js';
import { auxRender, render2DAll } from './render/bla.js';
import { drop3, nestIn, nestOut, nestReset, render3D } from './modes/fractal3d.js';
import { newOrbit } from './modes/orbit.js';
import { buildPlaces, d3Rows, diveUI, flyTo, juliaAvail, juliaSwap, resetView, setMode, typeChanged } from './ui/controls.js';
import { TYPES } from './fractals/types.js';
import { applyState, applyView, decodeState, encodeState, getState, parseView, readView, showView, viewCode, writeHash } from './io/share.js';
import { pace, startLoop, stopLoop, loopParts, loopTick, loopBegin, loopEnd } from './loop.js';
import { setLoopHooks, loopCancel } from './io/recorder.js';
import { onKey } from './input/keyboard.js';
export { moving } from './input/keyboard.js';   /* the picture's play icon shows while nothing moves */
import { parseRoute } from '../../js/shell/route.js';

new ResizeObserver(()=>touch()).observe(glc.parentElement);
setLoopHooks({ parts: loopParts, step: loopTick, begin: (L, W, H) => loopBegin(L, H), end: loopEnd });   // Record video's Seamless loop

sizeBuffers(); resetViews(); buildPlaces(); typeChanged(); d3Rows(); setMode('explore');
{ const h=parseRoute().code, S=h?readView(h):null; if (S){ shared.lastHash=h; applyView(S); } writeHash(true); }
window.__fx={st, pace, render3D, nestIn, nestOut, nestReset, render2DAll, refSlots, gl, encodeState, decodeState, applyState, getState, viewCode, readView, applyView, parseView, setMode, flyTo, newOrbit, touch, auxRender, get target(){ const sx="-0.743643887037158704752191506114774", sy="0.131825904205311970493132056385139", x=ddFrom(sx), y=ddFrom(sy); return {cx:x[0],lx:x[1],cy:y[0],ly:y[1],bx:strToFix(sx),by:strToFix(sy)}; }, strToFix, fixToNum, moveCentre};

// ---------- lifecycle (see js/main.js) ----------
export function start(){ touch(); writeHash(true); startLoop(); }
export function stop(){ loopCancel(); stopLoop(); drop3(); }   // leaving the explorer lets the 3D program go; it's rebuilt when needed
export const reset = resetView;
export const layoutChanged = touch;
export { onKey, showView };

/* the picture's Go button (null hides it) and what its slower / faster buttons move (js/shell/toolbar.js) */
export const goLabel = () => st.mode === 'explore' ? (st.dive || st.endlessRun ? 'Stop the dive' : 'Dive in') : st.mode === 'd3' ? (st.d3.dive ? 'Stop the dive' : 'Dive in') : null;
/* the picture's target button: what steers itself here, and whether it's on (null hides it) */
export const extraCtl = () => st.mode==='link' ? { label: 'Open this Julia set full screen (J)', icon: 'julia', run: () => document.getElementById('linkOpen').click() }
  : !juliaAvail() ? null : st.julia ? { label: 'Back to the ' + TYPES[st.type].name + ' (J)', icon: 'back', run: juliaSwap }
  : { label: 'Swap with the Julia set in the panel (J)', icon: 'julia', run: juliaSwap };
export const autoCtl = () => (st.mode === 'explore' || st.mode === 'd3') ? { label: 'Steer toward detail', on: st.steer } : null;
/* the picture's backwards / stop / forwards buttons, in Explore: dive out and dive in, at the same pace (Shift + G, G), and stop the dive. Each is lit
   while it's what's happening; pressing a lit direction only goes on after a pause (Space) */
const diving = d => (st.dive || st.endlessRun) && Math.sign(st.diveDir) === d;
const diveWay = (d, id) => () => { if (!diving(d)) document.getElementById(id).click(); st.paused = false; };
export const stopCtl = () => st.mode !== 'explore' ? null : { label: diving(1) || diving(-1) ? 'Stop the dive' : 'Stopped', on: !diving(1) && !diving(-1),
  run: () => { st.dive = false; st.endlessRun = false; st.diveDir = 1; st.fly = null; st.steerTo = null; st.paused = false; diveUI(); touch(); } };
export const reverseCtl = () => st.mode !== 'explore' ? null : { label: diving(-1) ? (st.paused ? 'Go on diving out' : 'Diving out') + ' (Shift + G)' : 'Play backwards: dive out (Shift + G)', on: diving(-1), run: diveWay(-1, 'diveOutBtn') };
export const forwardCtl = () => st.mode !== 'explore' ? null : { label: diving(1) ? (st.paused ? 'Go on diving in' : 'Diving in') + ' (G)' : 'Play forwards: dive in (G)', on: diving(1), run: diveWay(1, 'diveBtn') };
export const speedCtl = () => ({ explore: 'diveSpd', d3: 'dive3Spd', orbit: { id: 'orbSpd', invert: true } })[st.mode] || null;   /* orbit: seconds per step, so bigger is slower */
export const going = () => st.mode === 'explore' ? !!(st.dive || st.endlessRun || st.fly) : st.mode === 'd3' ? !!(st.d3.dive || st.d3.warp || st.d3.aim) : false;
/** Shown under the Music & sound switches while this explorer is on screen. */
export const soundHelp='Here, each beat flashes the picture brighter (or, with Pulse the shape, nudges the 3D shape and the Julia constant). Tempo times only the animations you switch on: turning, Breathe, Keep twisting, the 4D sweep and turn, Explore\'s turntable and Let c wander, Julia link\'s path, Orbit\'s steps and Grow. Vocals slowly sway the twist of 3D shapes, or the slice of 4D ones. Energy sets how fast dives, turns and growth go. In 3D the shape dances: it nods toward you on each beat, leans from side to side across two beats, twists back and forth across four, and the bass flexes the twist further. Intensity (Lively, Wild) makes all of this bigger.';
