import { $ } from '../util.js';
import { st } from '../state.js';
import { SHAPES } from '../geometry/polytopes.js';
import { camera } from '../render/scene.js';
import { setZoomZ } from './orbit.js';
import { notAvail } from '../ui/text.js';
import { resetBuild, resetUnfold, setMode, shapeBtns, togglePlay } from '../ui/controls.js';
import { resetAll } from '../ui/learn.js';
import { fly, flySpeed, toggleFly } from './fly.js';

// ---------- keyboard: this explorer's keys (the shell handles h, f, Esc, e, q, ? and skips keys typed into text fields) ----------
const clickNext = (sel, dir=1) => { const bs=[...document.querySelectorAll(sel)].filter(b=>b.offsetParent!==null || 1), i=bs.findIndex(b=>b.classList.contains('on')); bs[(i+dir+bs.length)%bs.length].click(); };
const nudge = (id, d) => { const el=$(id), v=Math.min(+el.max, Math.max(+el.min, +el.value + d)); el.value=v; el.dispatchEvent(new Event('input')); };
let lastTurn=1, lastCyc=1;
// Space: resume if paused; pause if anything moves (spin, turntable, knife sweep, build, unfold, ping, flying, colour
// cycling all hold still where they are); with nothing moving, start this mode's main motion, as Space always did.
export function moving(){ return fly.on || st.cycleSpeed>0 || (st.turn && !st.turnHold) || (st.spin && (st.mode==='explore' || st.mode==='ping' || (st.mode==='slice' && st.sliceSpin)))
  || (st.mode==='slice' && st.sweep) || (st.mode==='build' && st.build.playing) || (st.mode==='unfold' && st.unf.playing) || (st.mode==='ping' && st.ping.playing); }
function spacePause(){
  if (st.paused){ st.paused=false; return; }
  if (moving()){ st.paused=true; return; }
  if (st.mode==='build') $('buildPlay').click(); else if (st.mode==='unfold') $('unfPlay').click(); else togglePlay(); }
export function onKey(e){
  const k=e.key;
  let used=true;
  switch (k){
    case ' ': spacePause(); if (document.activeElement && document.activeElement!==document.body) document.activeElement.blur(); break;
    case 'g': case 'G': toggleFly(); st.paused=false; break;
    case '1': case '2': case '3': case '4': case '5': setMode(['explore','build','slice','unfold','ping'][+k-1]); break;
    case 'z': case 'x': case ',': case '.': { const i=shapeBtns.findIndex(b=>b.dataset.s===String(st.shape)); shapeBtns[(i+('x.'.includes(k)?1:-1)+shapeBtns.length)%shapeBtns.length].click(); break; }
    case 'Z': case 'X': case '<': case '>': if (SHAPES[st.shape].highD) nudge('hd', 'X>'.includes(k)?1:-1); else used=false; break;   // Shift + Z / X (or , .): fewer / more dimensions
    case '+': case '=': if (fly.on) flySpeed(1.25); else setZoomZ(camera.position.z*0.88); break;
    case '-': case '_': if (fly.on) flySpeed(0.8); else setZoomZ(camera.position.z/0.88); break;
    case ']': nudge('speed', 0.15); break;
    case '[': nudge('speed', -0.15); break;
    case 't': case 'T': { const el=$('turn'); if (+el.value!==0){ lastTurn=+el.value; el.value=0; } else el.value=lastTurn; el.dispatchEvent(new Event('input')); st.turnHold=false; break; }
    case 'c': clickNext('#palettes button',-1); break;   // C / V: previous / next palette; with Shift: previous / next colour mode
    case 'v': clickNext('#palettes button',1); break;
    case 'C': clickNext('#cmode button',-1); break;
    case 'V': clickNext('#cmode button',1); break;
    case 'b': case 'B': $('palRev').click(); break;   // reverse the palette on / off
    case 'r': case 'R': resetAll(); break;
    case 'k': case 'K': { const el=$('cyc'); if (+el.value>0){ lastCyc=+el.value; el.value=0; } else el.value=lastCyc; el.dispatchEvent(new Event('input')); break; }
    case 'n': case 'N': if (st.mode==='ping') $('pingNew').click(); else if (st.mode==='build' && !notAvail()) resetBuild(); else if (st.mode==='unfold' && !notAvail()) resetUnfold(); else used=false; break;
    default: used=false;
  }
  return used;
}
