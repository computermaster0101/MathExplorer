import { $ } from '../util.js';
import { st } from '../state.js';
import { SHAPES } from '../geometry/polytopes.js';
import { camera } from '../render/scene.js';
import { setZoomZ } from './orbit.js';
import { notAvail } from '../ui/text.js';
import { resetBuild, resetUnfold, setMode, shapeBtns, togglePlay } from '../ui/controls.js';
import { resetAll } from '../ui/learn.js';

// ---------- keyboard: this explorer's keys (the shell handles h, f, Esc, e, q, ? and skips keys typed into text fields) ----------
const clickNext = (sel, dir=1) => { const bs=[...document.querySelectorAll(sel)].filter(b=>b.offsetParent!==null || 1), i=bs.findIndex(b=>b.classList.contains('on')); bs[(i+dir+bs.length)%bs.length].click(); };
const nudge = (id, d) => { const el=$(id), v=Math.min(+el.max, Math.max(+el.min, +el.value + d)); el.value=v; el.dispatchEvent(new Event('input')); };
let lastTurn=1, lastCyc=1;
export function onKey(e){
  const k=e.key;
  let used=true;
  switch (k){
    case ' ': if (st.mode==='build') $('buildPlay').click(); else if (st.mode==='unfold') $('unfPlay').click(); else togglePlay(); if (document.activeElement && document.activeElement!==document.body) document.activeElement.blur(); break;
    case '1': case '2': case '3': case '4': case '5': setMode(['explore','build','slice','unfold','ping'][+k-1]); break;
    case 'ArrowRight': case 'ArrowLeft': { const i=shapeBtns.findIndex(b=>b.dataset.s===String(st.shape)); shapeBtns[(i+(k==='ArrowRight'?1:-1)+shapeBtns.length)%shapeBtns.length].click(); break; }
    case 'ArrowUp': case 'ArrowDown': if (SHAPES[st.shape].highD) nudge('hd', k==='ArrowUp'?1:-1); else used=false; break;
    case '+': case '=': setZoomZ(camera.position.z*0.88); break;
    case '-': case '_': setZoomZ(camera.position.z/0.88); break;
    case ']': nudge('speed', 0.15); break;
    case '[': nudge('speed', -0.15); break;
    case 't': case 'T': { const el=$('turn'); if (+el.value!==0){ lastTurn=+el.value; el.value=0; } else el.value=lastTurn; el.dispatchEvent(new Event('input')); st.turnHold=false; break; }
    case 'c': case 'C': clickNext('#cmode button', e.shiftKey?-1:1); break;
    case 'v': clickNext('#palettes button', 1); break;
    case 'V': clickNext('#palettes button', -1); break;
    case 'r': case 'R': resetAll(); break;
    case 'k': case 'K': { const el=$('cyc'); if (+el.value>0){ lastCyc=+el.value; el.value=0; } else el.value=lastCyc; el.dispatchEvent(new Event('input')); break; }
    case 'n': case 'N': if (st.mode==='ping') $('pingNew').click(); else if (st.mode==='build' && !notAvail()) resetBuild(); else if (st.mode==='unfold' && !notAvail()) resetUnfold(); else used=false; break;
    default: used=false;
  }
  return used;
}
