import { shared } from '../shared.js';
import { $, clickData, setRange } from '../util.js';
import { st } from '../state.js';
import { SHAPES } from '../geometry/polytopes.js';
import { camera, pivot } from '../render/scene.js';
import { setStereo, stereoMode } from '../render/stereo.js';
import { setZoomZ, vel } from '../input/orbit.js';
import { setMode, setNet, syncAngles, togglePlay } from '../ui/controls.js';
import { morphFam } from '../ui/learn.js';
import { activeExplorer, codeFromText, setViewCode, shareLink } from '../../../js/shell/route.js';

// ---------- shareable views: everything that sets up the picture goes into the link after the # ----------
const r2=(x,d=2)=>+(+x).toFixed(d);
function viewCode(){ const sh=SHAPES[st.shape], q=pivot.quaternion, P=new URLSearchParams();
  P.set('s',st.shape); P.set('m',st.mode);
  if (sh.highD) P.set('n',sh.n); if (st.shape==='d'){ P.set('dp',$('dp').value); P.set('dq',$('dq').value); }
  if (st.shape==='morph'){ P.set('mf',morphFam); P.set('ms',$('morphS').value); } if (sh.round) P.set('dt',sh.detail||3); if (sh.packing && st.packView!=='balls') P.set('pv',st.packView);
  P.set('pal',st.palette); if (st.palRev) P.set('rev',1); if (st.cycleSpeed) P.set('cyc',r2(st.cycleSpeed)); if (st.density!==1) P.set('dn',r2(st.density)); P.set('cm',st.cmode); P.set('fin',st.finish); P.set('bg',st.bg.replace('#','')); P.set('pr',st.proj); P.set('ed',st.edges);
  if (st.faceFill) P.set('ff',1);
  P.set('ss',st.spinStyle); P.set('sp',st.spin?1:0); P.set('spd',r2(st.speed)); P.set('tt',r2(st.turn)); P.set('th',r2(st.thk));
  P.set('a',['xy','xw','yw','zw'].map(k=>Math.round(st[k])).join('_')); P.set('q',[q.x,q.y,q.z,q.w].map(x=>r2(x,4)).join('_')); P.set('z',r2(camera.position.z,3));
  if (st.mode==='slice'){ P.set('kd',shared.knifeDir); P.set('ku',r2(st.knifeU,3)); P.set('sw',st.sweep?1:0); P.set('sf',st.sliceFill?1:0); }
  if (st.mode==='unfold' && shared.netSeed) P.set('net',shared.netSeed);
  if (typeof stereoMode!=='undefined' && stereoMode!=='off'){ P.set('st',stereoMode); P.set('eye',r2(shared.eyeSep,3)); }
  return P.toString(); }


export function applyView(code){
  const P=new URLSearchParams(codeFromText(code)), g=k=>P.get(k); if (!g('s') || !SHAPES[g('s')]) return false;
  document.querySelector(`.shapes [data-s="${g('s')}"]`).click();
  if (g('n') && SHAPES[st.shape].highD) setRange('hd', g('n'));
  if (g('dp')){ $('dp').value=g('dp'); setRange('dq', g('dq')); }
  if (g('mf')) clickData('#morphFam','f',g('mf')); if (g('ms')) setRange('morphS', g('ms'), 'change');
  if (g('dt') && SHAPES[st.shape].round) setRange('rdet', g('dt'));
  if (SHAPES[st.shape].packing){ const pv=g('pv')==='net'?'net':'balls'; const b=document.querySelector(`#packView [data-pv="${pv}"]`); if (b) b.click(); }
  if (g('m')) setMode(g('m'));
  if (g('pal')){ const b=[...document.querySelectorAll('#palettes button')].find(x=>x.dataset.pal===g('pal')); if (b) b.click(); }
  if ((g('rev')==='1')!==st.palRev) $('palRev').click(); setRange('cyc', g('cyc')!=null ? +g('cyc') : 0); setRange('dens', g('dn')!=null ? +g('dn') : 1);
  if (g('cm')) clickData('#cmode','c',g('cm')); if (g('fin')) clickData('#finish','f',g('fin')); if (g('bg')) clickData('#bg','b','#'+g('bg'));
  if (g('pr')) clickData('#proj','p',g('pr')); if (g('ed')) clickData('#edgemode','e',g('ed')); if (g('ss')) clickData('#spinstyle','y',g('ss'));
  if ((g('ff')==='1')!==st.faceFill) $('faceFillChk').click();
  if (g('kd')) clickData('#knifeDir','k',g('kd')); shared.knifeAnim=null;
  if (g('sw')!=null && (g('sw')==='1')!==st.sweep) $('sweep').click(); if (g('sf')!=null && (g('sf')==='1')!==st.sliceFill) $('sliceFillChk').click();
  if (g('ku')!=null) setRange('knife', Math.round(+g('ku')*100));
  if (g('net')) setNet(+g('net'));
  if (g('st') && typeof setStereo==='function') setStereo(g('st'), g('eye')!=null ? +g('eye') : null);
  if (g('spd')) setRange('speed', g('spd')); if (g('tt')!=null) setRange('turn', g('tt')); if (g('th')) setRange('thk', g('th'));
  if (g('a')){ g('a').split('_').forEach((v,i)=>{ st[['xy','xw','yw','zw'][i]]=+v; }); syncAngles(); }
  if (g('sp')!=null && (g('sp')==='1')!==st.spin) togglePlay();
  if (g('q')){ const [x,y,z,w]=g('q').split('_').map(Number); if ([x,y,z,w].every(isFinite)) pivot.quaternion.set(x,y,z,w).normalize(); vel.x=vel.y=0; }
  if (g('z')) setZoomZ(+g('z'));
  return true; }
let lastCode='', insideClaude=!!(window.claude && typeof window.claude.use==='function');
if (insideClaude) $('g-share').querySelector('.note').textContent='This view code records the shape, mode, camera angle, zoom, 4D turn, colours and knife. Inside Claude, paste it into "Load a view" to return to this exact picture; in a saved copy of the page it also works after # at the end of the address.';
setInterval(()=>{ if (activeExplorer()!=='polytope') return; const c=viewCode(); if (c===lastCode) return; lastCode=c; $('viewLink').value = insideClaude ? c : shareLink('polytope',c);
  if (!insideClaude) setViewCode('polytope',c); }, 700);
// the shell calls this when the address changes to a view code (a pasted link, back/forward)
export function showView(code){ if (code && code!==lastCode){ try { applyView(code); } catch(e){ console.warn('could not load view', e); } } }
$('copyView').addEventListener('click', async ()=>{ const el=$('viewLink'); el.select(); let ok=false;
  try { await navigator.clipboard.writeText(el.value); ok=true; } catch(e){ try { ok=document.execCommand('copy'); } catch(e2){} }
  $('shareNote').textContent = ok ? (insideClaude ? 'Copied. Paste it into "Load a view" to come back to this exact picture.' : 'Copied. Anyone opening this link sees this exact picture.') : 'Select the text above and copy it.'; });
$('loadView').addEventListener('click', ()=>{ const ok=applyView($('viewIn').value.trim()); $('shareNote').textContent = ok ? 'View loaded.' : 'That doesn\'t look like a view link or code.'; });
