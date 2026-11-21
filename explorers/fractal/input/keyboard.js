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
export function onKey(e){
  const k=e.key;
  let used=true;
  switch (k){
    case ' ': if (st.mode==='grow') $('growPlay').click(); else if (st.mode==='orbit') $('orbPlay').click(); else if (st.mode==='explore') $('diveBtn').click(); else if (st.mode==='link') { $('linkAuto').click(); } else if (st.mode==='d3'){ const el=$('turn3'); el.value = +el.value!==0 ? 0 : 0.25; el.dispatchEvent(new Event('input')); } if (document.activeElement && document.activeElement!==document.body) document.activeElement.blur(); break;
    case '1': case '2': case '3': case '4': case '5': setMode(['explore','grow','link','orbit','d3'][+k-1]); break;
    case 'ArrowRight': case 'ArrowLeft': clickNext(st.mode==='grow'?'#growShapes button':st.mode==='d3'?'.sh3 button':'#types button', k==='ArrowRight'?1:-1); break;
    case '+': case '=': zoomBy(0.8, cssW/2, cssH/2); break;
    case '-': case '_': zoomBy(1.25, cssW/2, cssH/2); break;
    case 'd': case 'D': if (st.mode==='explore') $('diveBtn').click(); else if (st.mode==='d3') $('dive3Btn').click(); else used=false; break;
    case 'p': case 'P': if (st.mode==='explore'){ flyTo((st.placeIdx+1)%TYPES[st.type].places.length); } else used=false; break;
    case 'j': case 'J': if (TYPES[st.type].julia && st.mode==='explore') $('juliaChk').click(); else used=false; break;
    case ']': st.iterAuto=false; $('iterAuto').checked=false; st.iter=Math.min(isExt()?100000:30000,Math.round(effIter(st.vE)*1.25)); $('iter').value=st.iter; touch(); updateDynamic(); break;
    case '[': st.iterAuto=false; $('iterAuto').checked=false; st.iter=Math.max(50,Math.round(effIter(st.vE)/1.25)); $('iter').value=st.iter; touch(); updateDynamic(); break;
    case 'c': case 'C': clickNext('#cmode button', e.shiftKey?-1:1); break;
    case 'v': clickNext('#palettes button',1); break;
    case 'V': clickNext('#palettes button',-1); break;
    case 'k': case 'K': { const el=$('cyc'); if (+el.value>0){ lastCyc=+el.value; el.value=0; } else el.value=lastCyc; el.dispatchEvent(new Event('input')); break; }
    case 'r': case 'R': resetView(); break;
    case 'n': case 'N': if (st.mode==='orbit') $('orbNew').click(); else if (st.mode==='grow') $('growReplay').click(); else used=false; break;
    default: used=false;
  }
  return used;
}
