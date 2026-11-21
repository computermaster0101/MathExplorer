import { $ } from '../util.js';
import { TYPES } from '../fractals/types.js';
import { isExt, st } from '../state.js';
import { cssH, cssW, effIter, touch } from '../view.js';
import { updateDynamic } from '../ui/learn.js';
import { flyTo, resetView, setMode } from '../ui/controls.js';
import { zoomBy } from './pointers.js';

// ---------- keyboard: this explorer's keys (the shell handles h, f, Esc, e, q, ? and skips keys typed into text fields) ----------
const clickNext=(sel,dir=1)=>{ const bs=[...document.querySelectorAll(sel)], i=bs.findIndex(b=>b.classList.contains('on')); bs[(i+dir+bs.length)%bs.length].click(); };
let lastCyc=1;
// Is anything moving that Space should pause?
function moving(){ const D=st.d3;
  if (st.cycleSpeed>0) return true;
  if (st.mode==='explore') return !!(st.dive||st.endlessRun||st.fly);
  if (st.mode==='link') return !!st.link.auto;
  if (st.mode==='orbit') return !!st.orbit.playing;
  if (st.mode==='grow') return !!(st.grow.playing||st.grow.zoom);
  return !!(D.dive||D.warp||D.aim||D.turn||D.breathe||D.bsBreathe||D.spin3||D.twAnim||D.sweep||D.spin4); }
// Space: resume if paused; pause if anything moves (dives, turning, Breathe, twisting, sweeps, colour cycling all hold still
// exactly where they are); with nothing moving, start this mode's main motion, as Space always did.
function spacePause(){
  if (st.paused){ st.paused=false; touch(); return; }
  if (moving()){ st.paused=true; touch(); return; }
  const id={ grow:'growPlay', orbit:'orbPlay', explore:'diveBtn', link:'linkAuto', d3:'dive3Btn' }[st.mode]; if (id) $(id).click(); }
// starting something by hand ends a pause
for (const id of ['diveBtn','dive3Btn','growPlay','orbPlay','linkAuto']) $(id).addEventListener('click', ()=>{ st.paused=false; });
export function onKey(e){
  const k=e.key;
  let used=true;
  switch (k){
    case ' ': spacePause(); if (document.activeElement && document.activeElement!==document.body) document.activeElement.blur(); break;
    case '1': case '2': case '3': case '4': case '5': setMode(['explore','grow','link','orbit','d3'][+k-1]); break;
    case 'z': case 'Z': case 'x': case 'X': case ',': case '.': case '<': case '>': clickNext(st.mode==='grow'?'#growShapes button':st.mode==='d3'?'.sh3 button':'#types button', 'xX.>'.includes(k)?1:-1); break;
    case '+': case '=': zoomBy(0.8, cssW/2, cssH/2); break;
    case '-': case '_': zoomBy(1.25, cssW/2, cssH/2); break;
    case 'g': case 'G': if (st.mode==='explore') $('diveBtn').click(); else if (st.mode==='d3') $('dive3Btn').click(); else used=false; break;
    case 'p': case 'P': if (st.mode==='explore'){ flyTo((st.placeIdx+1)%TYPES[st.type].places.length); } else used=false; break;
    case 'j': case 'J': if (TYPES[st.type].julia && st.mode==='explore') $('juliaChk').click(); else used=false; break;
    case ']': st.iterAuto=false; $('iterAuto').checked=false; st.iter=Math.min(isExt()?100000:30000,Math.round(effIter(st.vE)*1.25)); $('iter').value=st.iter; touch(); updateDynamic(); break;
    case '[': st.iterAuto=false; $('iterAuto').checked=false; st.iter=Math.max(50,Math.round(effIter(st.vE)/1.25)); $('iter').value=st.iter; touch(); updateDynamic(); break;
    case 'c': case 'C': clickNext('#palettes button',-1); break;   // Z X C V: previous / next shape, previous / next palette
    case 'v': case 'V': clickNext('#palettes button',1); break;
    case 'b': case 'B': clickNext('#cmode button', e.shiftKey?-1:1); break;   // colour mode (Shift+B back)
    case 'k': case 'K': { const el=$('cyc'); if (+el.value>0){ lastCyc=+el.value; el.value=0; } else el.value=lastCyc; el.dispatchEvent(new Event('input')); break; }
    case 'r': case 'R': resetView(); break;
    case 'n': case 'N': if (st.mode==='orbit') $('orbNew').click(); else if (st.mode==='grow') $('growReplay').click(); else used=false; break;
    default: used=false;
  }
  return used;
}
