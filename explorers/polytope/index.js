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
import './geometry/faces.js';
import './geometry/schlafli.js';
import './math/rotate4d.js';
import './render/scene.js';
import './render/stereo.js';
import './input/orbit.js';
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
import { resize, startLoop, stopLoop } from './loop.js';
import { applyView, showView } from './io/share.js';
import { onKey } from './input/keyboard.js';
import { parseRoute } from '../../js/shell/route.js';

applyMorph(false);
setMode('explore'); setZoomZ(8.5); resize();
{ const code=parseRoute().code; if (code) try { applyView(code); } catch(e){ console.warn('could not load view', e); } }

// ---------- lifecycle (see js/main.js) ----------
export function start(){ resize(); startLoop(); }
export function stop(){ stopLoop(); }
export const reset = resetAll;
export const layoutChanged = resize;
export { onKey, showView };
