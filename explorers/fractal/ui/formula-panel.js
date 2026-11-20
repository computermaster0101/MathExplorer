import { shared } from '../shared.js';
import { $, clickIn } from '../util.js';
import { TYPES } from '../fractals/types.js';
import { st } from '../state.js';
import { F2SRC_BASE, aux, main, refSlots } from '../render/webgl.js';
import { parseFormula, toGLSL, toJS, usesVar } from '../formula/formula.js';
import { resetViews, touch } from '../view.js';
import { notAvail } from './notice.js';
import { newOrbit } from '../modes/orbit.js';
import { updateLabels } from './learn.js';
import { buildPlaces, setSeg } from './controls.js';

// ---------- custom formula panel ----------
const CF_PRESETS=[
  ['z³ + sin z','z^3 + sin(z) + c','0',100,[0,0,2]],
  ['eᶻ + c','exp(z) + c','0',50,[-0.6,0,2.6]],
  ['cosh z + c','cosh(z) + c','0',100,[0,0,3]],
  ['sin(z²) + c','sin(z^2) + c','0',100,[0,0,1.8]],
  ['Multicorn','conj(z)^3 + c','0',100,[0,0,1.4]],
  ['Ship, typed','(abs(re(z)) + i*abs(im(z)))^2 + c','0',100,[-0.4,-0.55,1.35]],
  ['c · sin z','c*sin(z)','pi/2',50,[0,0,3.2]],
  ['Logistic cz(1−z)','c*z*(1 - z)','0.5',100,[1,0,2.2]] ];
const cfHash=t=>{ let h=0; for (let i=0;i<t.length;i++) h=(h*31+t.charCodeAt(i))|0; return (h>>>0).toString(36); };
function cfMsg(t, bad){ const e=$('cfMsg'); e.textContent=t; e.style.color=bad?'var(--warn)':''; }
function applyCustom(src, z0src, bail, quiet){
  let tree, z0t;
  try { tree=parseFormula(src); } catch(e){ cfMsg('Formula: '+e.message+(e.pos!=null?` (character ${e.pos+1}).`:'.'), true); return false; }
  try { z0t=parseFormula(String(z0src||'0'), false); } catch(e){ cfMsg('Starting value: '+e.message+'.', true); return false; }
  const fs=F2SRC_BASE.replace('CUSTOM_EXPR',toGLSL(tree)).replace('CUSTOM_Z0',toGLSL(z0t)), key='f2:'+cfHash(fs);
  try { main.prog(key,fs); aux.prog(key,fs); } catch(e){ cfMsg('The graphics card couldn\'t build that formula. Try a simpler version.', true); return false; }
  const f0=toJS(z0t); shared.F2KEY=key; shared.F2SRC=fs;
  Object.assign(st.custom,{src:src.trim(), z0:String(z0src||'0').trim(), bail:bail||st.custom.bail, js:toJS(tree), z0js:c=>f0([0,0],c)});
  TYPES[11].alt='z → '+st.custom.src+(st.custom.z0!=='0'?`, starting at ${st.custom.z0}`:'');
  const uz=usesVar(tree,'z'), uc=usesVar(tree,'c');
  cfMsg(!uz ? 'This formula doesn\'t use z, so nothing builds up from one step to the next.' : !uc ? 'This formula doesn\'t use c, so every pixel follows the same recipe. Try adding + c, or turn on the Julia set.' : 'Drawn.', !uz||!uc);
  if (!quiet){ if (st.type!==11) clickIn('types','t','11'); else { resetViews(); refSlots.forEach(sl=>sl.key=''); if (st.mode==='orbit' && !notAvail()) newOrbit(); updateLabels(); } }
  touch(); return true; }
$('cfPresets').innerHTML=CF_PRESETS.map((p,i)=>`<button data-i="${i}">${p[0]}</button>`).join('');
$('cfPresets').addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; const P=CF_PRESETS[+b.dataset.i];
  $('cfInput').value=P[1]; $('cfZ0').value=P[2]; setSeg($('cfBail'), document.querySelector(`#cfBail [data-b="${P[3]}"]`));
  TYPES[11].view=[...P[4],0]; TYPES[11].places[0]=['Whole view',...P[4]]; buildPlaces(); applyCustom(P[1],P[2],P[3]); setSeg($('cfPresets'),b); });
$('cfApply').addEventListener('click', ()=>{ setSeg($('cfPresets'),null); applyCustom($('cfInput').value, $('cfZ0').value, st.custom.bail); });
for (const id of ['cfInput','cfZ0']) $(id).addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); $('cfApply').click(); } });
$('cfBail').addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; setSeg($('cfBail'),b); st.custom.bail=+b.dataset.b; if (st.mode==='orbit' && st.type===11) newOrbit(); touch(); });
export function customState(){ return [st.custom.src, st.custom.z0, st.custom.bail, TYPES[11].view.slice(0,3)]; }
export function applyCustomState(f){ if (!Array.isArray(f)) return; $('cfInput').value=f[0]; $('cfZ0').value=f[1]; setSeg($('cfBail'), document.querySelector(`#cfBail [data-b="${f[2]}"]`));
  if (f[3]) { TYPES[11].view=[...f[3],0]; TYPES[11].places[0]=['Whole view',...f[3]]; } applyCustom(f[0], f[1], f[2], true); }
