// 4D polytope explorer entry. Importing this module boots the explorer (the side-effect imports below run in this order);
// the exports are the lifecycle the shell (js/main.js) drives.
import './util.js';
import './state.js';
import './render/colour.js';
import './geometry/common.js';
import './geometry/polytopes.js';
import './geometry/stars.js';
import './geometry/compounds.js';
import './geometry/round.js';
import './geometry/higher-dim.js';
import './geometry/prisms.js';
import './geometry/cousins3d.js';
import './geometry/wythoff.js';
import './geometry/uniform.js';
import './geometry/ustar.js';
import './geometry/faces.js';
import './geometry/schlafli.js';
import './math/rotate4d.js';
import './render/scene.js';
import './render/stereo.js';
import './render/packing.js';
import './render/foam.js';
import './input/orbit.js';
import './input/fly.js';
import { fly, flySpeed } from './input/fly.js';
import './modes/build.js';
import './modes/unfold.js';
import './modes/ping.js';
import './panels/cousin-inset.js';
import './panels/extra-panels.js';
import './ui/text.js';
import './io/export.js';
import './ui/controls.js';
import './ui/learn.js';
import './loop.js';
import './input/keyboard.js';
import './io/share.js';
import { setZoomZ } from './input/orbit.js';
import { setMode } from './ui/controls.js';
import { applyMorph, resetAll } from './ui/learn.js';
import { resize, startLoop, stopLoop, tick, loopParts, loopBegin } from './loop.js';
import { applyView, showView } from './io/share.js';
import { onKey } from './input/keyboard.js';
export { moving } from './input/keyboard.js';   /* the picture's play icon shows while nothing moves */
import { parseRoute } from '../../js/shell/route.js';
import { addRecorder } from '../../js/common/motion.js';
import { st } from './state.js';
import { SHAPES } from './geometry/polytopes.js';

applyMorph(false);
setMode('explore'); setZoomZ(8.5); resize();
{ const code=parseRoute().code; if (code) try { applyView(code); } catch(e){ console.warn('could not load view', e); } }

// ---------- lifecycle (see js/main.js) ----------
export function start(){ resize(); startLoop(); }
// Record video (the 3D view and any insets on screen), with the music
const REC = addRecorder({ stage: document.getElementById('c').parentElement, name: () => (st.mode === 'explore' || st.mode === 'slice' ? SHAPES[st.shape].name : 'tesseract-' + st.mode), bg: () => st.bg , loop: { parts: loopParts, step: tick, begin: loopBegin } });
export function stop(){ stopLoop(); REC.stop(); }
export const reset = resetAll;
export const layoutChanged = resize;
export { onKey, showView };
export const going = () => fly.on;
/* the picture's Go button (null hides it) and what its slower / faster buttons move (js/shell/toolbar.js) */
export const goLabel = () => fly.on ? 'Stop flying' : 'Fly in';
export const speedCtl = () => fly.on ? { label: 'flying speed', step: d => flySpeed(d > 0 ? 1.25 : 0.8) } : 'speed';
/** Shown under the Music & sound switches while this explorer is on screen. */
export const soundHelp='Here, each beat flashes the lights (or, with Pulse the shape, pushes the whole shape outward). Tempo times the 4D spin and the turntable, the knife sweep in Slice, Ping\'s steps, Build up, Unfold and the morph animation. Vocals sway the shape through a third 4D plane. Colour shimmers and drifts on each bar. Energy sets how fast it all spins.';
