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
import './io/music.js';
import './io/recorder.js';
import './input/pointers.js';
import './loop.js';
import './input/keyboard.js';
import { shared } from './shared.js';
import { ddFrom } from './math/double-double.js';
import { fixToNum, strToFix } from './math/big-fixed.js';
import { aud, st } from './state.js';
import { gl, glc, refSlots } from './render/webgl.js';
import { moveCentre, resetViews, sizeBuffers, touch } from './view.js';
import { auxRender, render2DAll } from './render/bla.js';
import { nestIn, nestOut, nestReset, render3D } from './modes/fractal3d.js';
import { newOrbit } from './modes/orbit.js';
import { buildPlaces, d3Rows, flyTo, resetView, setMode, typeChanged } from './ui/controls.js';
import { applyState, applyView, decodeState, encodeState, getState, parseView, readView, showView, viewCode, writeHash } from './io/share.js';
import { startLoop, stopLoop } from './loop.js';
import { onKey } from './input/keyboard.js';
import { parseRoute } from '../../js/shell/route.js';

new ResizeObserver(()=>touch()).observe(glc.parentElement);

sizeBuffers(); resetViews(); buildPlaces(); typeChanged(); d3Rows(); setMode('explore');
{ const h=parseRoute().code, S=h?readView(h):null; if (S){ shared.lastHash=h; applyView(S); } writeHash(true); }
window.__fx={st, aud, render3D, nestIn, nestOut, nestReset, render2DAll, refSlots, gl, encodeState, decodeState, applyState, getState, viewCode, readView, applyView, parseView, setMode, flyTo, newOrbit, touch, auxRender, get target(){ const sx="-0.743643887037158704752191506114774", sy="0.131825904205311970493132056385139", x=ddFrom(sx), y=ddFrom(sy); return {cx:x[0],lx:x[1],cy:y[0],ly:y[1],bx:strToFix(sx),by:strToFix(sy)}; }, strToFix, fixToNum, moveCentre};

// ---------- lifecycle (see js/main.js) ----------
export function start(){ touch(); writeHash(true); startLoop(); }
export function stop(){ stopLoop(); }
export const reset = resetView;
export const layoutChanged = touch;
export { onKey, showView };
