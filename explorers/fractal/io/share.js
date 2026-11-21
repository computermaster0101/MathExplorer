import { shared } from '../shared.js';
import { $, clamp, clickIn, setCheck, setRange } from '../util.js';
import { FIXN, dblToFix, fixToNum, strToFix } from '../math/big-fixed.js';
import { TYPES } from '../fractals/types.js';
import { isExt, ptrs, st } from '../state.js';
import { PALETTES } from '../color/palettes.js';
import { minScale, touch } from '../view.js';
import { S3, d3Bound, syncT3 } from '../modes/fractal3d.js';
import { GROW, GROW_EXT, GROW_HOLD, growStage } from '../modes/grow.js';
import { newOrbit } from '../modes/orbit.js';
import { updateLabels } from '../ui/learn.js';
import { setMode, setSeg, syncR4, syncW } from '../ui/controls.js';
import { applyCustomState, customState } from '../ui/formula-panel.js';
import { inClaude } from './save-image.js';
import { codeFromText, setViewCode, shareLink } from '../../../js/shell/route.js';

// ---------- shareable links: readable fields after the # (old v3/v4 codes, f3-… and f4-…, still load) ----------
const B32='abcdefghijklmnopqrstuvwxyz234567';
function b32enc(bytes){ let out='', bits=0, val=0; for (const b of bytes){ val=(val<<8)|b; bits+=8; while (bits>=5){ out+=B32[(val>>>(bits-5))&31]; bits-=5; } val&=(1<<bits)-1; } if (bits>0) out+=B32[(val<<(5-bits))&31]; return out; }
function b32dec(str){ const out=[]; let bits=0, val=0; for (const ch of str){ const i=B32.indexOf(ch); if (i<0) continue; val=(val<<5)|i; bits+=5; if (bits>=8){ out.push((val>>>(bits-8))&255); bits-=8; } val&=(1<<bits)-1; } return new Uint8Array(out); }
function fixToDec(b, digits){ const neg=b<0n; let a=neg?-b:b; const ip=a>>FIXN, fr=a-(ip<<FIXN); let f=((fr*(10n**BigInt(digits)))>>FIXN).toString().padStart(digits,'0').replace(/0+$/,''); return (neg?'-':'')+ip.toString()+(f?'.'+f:''); }
const r6=x=>+(+x).toPrecision(12);
export function getState(){ const v=st.vE, dg=clamp(Math.ceil(-Math.log10(v.scale))+8,17,125), D=st.d3, sh=st.grow, S={
  m:st.mode, t:st.type, j:st.julia?1:0, c:[r6(st.jc[0]),r6(st.jc[1])], pw:r6(st.power), pr:isExt()?1:0,
  v:[fixToDec(v.bx??dblToFix(v.cx),dg), fixToDec(v.by??dblToFix(v.cy),dg), +v.scale.toPrecision(8), r6(st.rotDeg)],
  p:st.palette, rv:st.palRev?1:0, cm:st.cmode, dn:r6(st.density), cy:r6(st.cycleSpeed), in:st.inside, bg:st.bg.slice(1), it:st.iterAuto?0:st.iter, aa:st.aa,
  ly:st.lyaSeq, bm:st.budMode, bl:st.bla?1:0, ed:st.endless?1:0, sd:st.steer?1:0,
  g:[sh.shape, growStage(GROW[sh.shape],sh.t).k, sh.playing?1:0, sh.zoom?1:0, sh.angle.pyth, sh.angle.tree],
  l:[st.link.auto?1:0, st.link.path], o:st.orbit.data?[r6(st.orbit.data.p0[0]), r6(st.orbit.data.p0[1]), st.orbit.auto?1:0]:null,
  d:[D.shape, r6(D.power), r6(D.boxS), r6(D.w), D.lvl, r6(D.twist), r6(D.yaw), r6(D.pitch), +D.dist.toPrecision(9), D.target?D.target.map(r6):0, r6(D.turn), D.breathe?1:0, D.sweep?1:0, D.twAnim?1:0, D.dragMode, r6(D.axw), r6(D.ayw), r6(D.azw), D.spin4?1:0, D.nestM||0, r6(D.rxy), r6(D.rxz), r6(D.ryz), D.spin3?1:0, D.cut?1:0, D.bsBreathe?1:0, D.glass?1:0, D.hyp||'534', D.hypW?1:0, D.shadows?1:0] };
  if (typeof customState==='function') S.f=customState();
  return S; }
export function encodeState(){ return 'f4-'+b32enc(new TextEncoder().encode(JSON.stringify(getState()))); }
export function decodeState(h){ try { if (!h.startsWith('f3-') && !h.startsWith('f4-')) return null; const S=JSON.parse(new TextDecoder().decode(b32dec(h.slice(3)))); if (h.startsWith('f3-') && S.d) S.d[3]=(+S.d[3]||0)/0.9; return S; } catch(e){ return null; } }



export function applyState(S){ if (!S) return;
  try {
    if (S.p && PALETTES[S.p]) clickIn('palettes','p',S.p); setCheck('palRev', S.rv?1:0);
    if (S.bg) clickIn('bg','b','#'+S.bg); if (S.cm!=null) clickIn('cmode','c',S.cm); if (S.in!=null) clickIn('inside','i',S.in); if (S.aa) clickIn('aa','a',S.aa);
    setRange('dens',S.dn); setRange('cyc',S.cy);
    if (S.f && typeof applyCustomState==='function') applyCustomState(S.f);
    if (S.t!=null && TYPES[S.t]) clickIn('types','t',S.t);
    if (S.ly) st.lyaSeq=S.ly; if (S.bm) clickIn('budMode','bm',S.bm);
    if (S.pw!=null) setRange('pow',S.pw);
    if (S.c) st.jc=S.c.slice(); if (S.j!=null && TYPES[st.type].julia && !!S.j!==st.julia){ $('juliaChk').checked=!!S.j; $('juliaChk').dispatchEvent(new Event('change')); }
    if (S.c) st.jc=S.c.slice();
    clickIn('prec','pr',S.pr?'extreme':'standard');
    if (S.it){ st.iterAuto=false; $('iterAuto').checked=false; st.iter=S.it; $('iter').value=S.it; }
    if (S.bl!=null) setCheck('blaChk',S.bl);
    setCheck('endlessChk',S.ed); setCheck('steerChk',S.sd); $('steer3Chk').checked=$('steerChk').checked;
    if (S.l){ setCheck('linkAuto',S.l[0]); if (S.l[1]) { st.link.path=S.l[1]; setSeg($('linkPath'), document.querySelector(`#linkPath [data-p="${S.l[1]}"]`)); } }
    if (S.d){ const d=S.d; d[0]=({box4:'box',apo4:'apo'})[d[0]]||d[0]; { const b=document.querySelector(`.sh3 [data-s3="${d[0]}"]`); if (b) b.click(); } setRange('pw3',d[1]); setRange('bs3',d[2]); setRange('lvl3',d[4]); setRange('tw3',d[5]); setRange('turn3',d[10]);
      setCheck('cut3',d[24]?1:0); setCheck('breathe',d[11]); setCheck('bsBreathe',d[25]?1:0); setCheck('glass3',d[26]?1:0); clickIn('hypKind','h',['435','534','535','353'].includes(String(d[27]))?String(d[27]):'534'); setCheck('hypWalls',d[28]?1:0); setCheck('shadow3',d[29]?1:0); setCheck('sweep3',d[12]); setCheck('twAnim',d[13]); setCheck('spin3',d[23]?1:0); if (d[14]) clickIn('drag3','dm',d[14]);
      Object.assign(st.d3,{w:clamp(+d[3]||0,-1,1), yaw:d[6], pitch:d[7], dist:d[8], target:d[9]?d[9].slice():null, axw:+d[15]||0, ayw:+d[16]||0, azw:+d[17]||0, spin4:!!d[18], nestM:d[0]==='nest'?(+d[19]||0):0, rxy:+d[20]||0, rxz:+d[21]||0, ryz:+d[22]||0, spin3:!!d[23], cut:!!d[24], bsBreathe:!!d[25]}); syncT3(); $('cut3').checked=st.d3.cut; $('spin4').checked=st.d3.spin4; syncR4(); syncW(); }
    if (S.g){ const g=S.g; clickIn('growShapes','g',g[0]); st.grow.angle.pyth=g[4]||45; st.grow.angle.tree=g[5]||28; }
    if (S.m) setMode(S.m);
    if (S.v){ const v=st.vE; v.bx=strToFix(S.v[0]); v.by=strToFix(S.v[1]); v.cx=fixToNum(v.bx); v.lx=fixToNum(v.bx-dblToFix(v.cx)); v.cy=fixToNum(v.by); v.ly=fixToNum(v.by-dblToFix(v.cy));
      v.scale=Math.max(S.v[2], minScale(st.type)); setRange('rot', S.v[3]||0); st.fly=null; }
    if (S.m==='grow' && S.g){ const k=S.g[1]; st.grow.t = k===0 ? 0.01 : GROW_HOLD+(k-1)*(GROW_EXT+GROW_HOLD)+GROW_EXT+0.01; st.grow.playing=!!S.g[2]; $('growPlay').textContent=st.grow.playing?'Pause':'Play'; setCheck('growZoom',S.g[3]); }
    if (S.m==='orbit' && S.o){ setCheck('orbAuto',S.o[2]); newOrbit([S.o[0],S.o[1]]); }
    st.iterNeed=0; touch(); updateLabels();
  } catch(e){ console.warn('Could not restore that link', e); } }
// the centre written with just enough digits for this zoom (a few past one pixel), rounded so it reads back to the same digits
function fixToDecR(b, digits){ const neg=b<0n; let a=neg?-b:b; const ip=a>>FIXN, fr=a-(ip<<FIXN), q=((fr*(10n**BigInt(digits)))+(1n<<(FIXN-1n)))>>FIXN;
  let I=ip, F=q; if (F>=10n**BigInt(digits)){ I+=1n; F-=10n**BigInt(digits); } const f=F.toString().padStart(digits,'0').replace(/0+$/,''); const out=I.toString()+(f?'.'+f:''); return (neg && out!=='0'?'-':'')+out; }
// readable names for the fractals in a link (numbers work too)
const TKEY=['mandelbrot','burning-ship','tricorn','multibrot','celtic','phoenix','newton','magnet','nova','lyapunov','buddhabrot','custom'];
const n6=x=>String(r6(x)), b01=x=>x?'1':'0', _j=a=>a.map(x=>typeof x==='number'?n6(x):String(x)).join('_');
// the state as readable fields: only what the current mode needs, and only settings that differ from the defaults
export function viewCode(){ const S=getState(), P=new URLSearchParams(), on2D=['explore','link','orbit'].includes(S.m);
  P.set('v','11'); P.set('m',S.m);
  if (on2D){ const v=st.vE, dg=clamp(Math.ceil(-Math.log10(v.scale))+5,4,125); P.set('t',TKEY[S.t]); P.set('x',fixToDecR(v.bx??dblToFix(v.cx),dg)); P.set('y',fixToDecR(v.by??dblToFix(v.cy),dg)); P.set('sc',String(S.v[2])); if (S.v[3]) P.set('rot',n6(S.v[3]));
    if (S.j) P.set('j','1'); if (S.j || S.m==='link' || TYPES[S.t].noBounded) P.set('c',_j(S.c));
    if (S.t===3) P.set('pw',n6(S.pw)); if (S.pr) P.set('pr','extreme'); if (S.t===9) P.set('ly',S.ly); if (S.t===10) P.set('bm',S.bm);
    if (S.t===11 && S.f){ P.set('f',S.f[0]); if (S.f[1]!=='0') P.set('z0',S.f[1]); P.set('bail',String(S.f[2])); if (S.f[3]) P.set('fv',_j(S.f[3])); }
    if (S.cm) P.set('cm',String(S.cm)); if (S.in) P.set('in','1'); if (S.it) P.set('it',String(S.it)); if (S.aa!==2) P.set('aa',String(S.aa));
    if (!S.bl) P.set('bla','0'); if (!S.ed) P.set('endless','0'); if (!S.sd) P.set('steer','0');
    if (S.m==='link'){ P.set('auto',b01(S.l[0])); P.set('path',S.l[1]); }
    if (S.m==='orbit' && S.o){ P.set('o',_j(S.o.slice(0,2))); if (!S.o[2]) P.set('oauto','0'); } }
  else if (S.m==='grow'){ const g=S.g; P.set('g',g[0]); P.set('gen',String(g[1])); if (!g[2]) P.set('play','0'); if (g[3]) P.set('gzoom','1'); if (g[4]!==45) P.set('pyth',String(g[4])); if (g[5]!==28) P.set('tree',String(g[5])); }
  else { const d=S.d; P.set('s3',d[0]);
    if (d[0]==='bulb'){ P.set('pow3',n6(d[1])); if (d[11]) P.set('breathe','1'); }
    if (d[0]==='box') P.set('box',n6(d[2]));
    if (d[5]) P.set('twist',n6(d[5])); if (d[13]) P.set('twanim','1');
    if (d[20]||d[21]||d[22]) P.set('turn3d',_j([d[20],d[21],d[22]])); if (d[23]) P.set('spin3','1'); if (d[25]) P.set('bbreathe','1');
    if (d[24]) P.set('cut','1'); if (d[26]) P.set('glass','1'); if (d[29]) P.set('shadow','1'); if (d[0]==='hyp'){ P.set('hyp',String(d[27])); if (d[28]) P.set('hw','1'); }
    if (S3[d[0]] && (S3[d[0]].four || d[24])){ if (d[3]) P.set('w',n6(d[3])); if (d[12]) P.set('sweep','1'); if (d[15]||d[16]||d[17]) P.set('knife',_j([d[15],d[16],d[17]])); if (d[18]) P.set('spin4','1'); }
    P.set('lvl',String(d[4])); P.set('cam',_j([d[6],d[7],d[8]])); if (d[9]) P.set('tgt',_j(d[9])); if (d[10]) P.set('turn',n6(d[10])); if (d[14]!=='turn') P.set('drag',d[14]); if (d[19]) P.set('nl',String(d[19])); if (!S.ed) P.set('endless','0'); }
  P.set('pal',S.p); if (S.rv) P.set('rev','1'); if (S.bg!=='0b0d12') P.set('bg',S.bg); if (S.dn!==1) P.set('dn',n6(S.dn)); if (S.cy) P.set('cy',n6(S.cy));
  return P.toString().replace(/\+/g,'%20').replace(/%28/g,'(').replace(/%29/g,')').replace(/%2A/g,'*').replace(/%2C/g,',').replace(/%5E/g,'^').replace(/%2F/g,'/').replace(/%7C/g,'|'); }
// readable fields back into the same state object the restore code already uses (anything left out gets its default)
export function parseView(code){
  const P=new URLSearchParams(String(code).replace(/\+/g,'%2B')), g=k=>P.get(k), has=k=>P.has(k), num=(k,d)=>{ const v=parseFloat(g(k)); return isFinite(v)?v:d; }, nums=k=>(g(k)||'').split('_').map(Number);
  if (!['m','t','x','y','sc','g','s3','pal'].some(has)) return null;   // nothing we recognise: not a view code
  const m=g('m')||'explore'; if (!['explore','grow','link','orbit','d3'].includes(m)) return null;
  const S={ m, p:PALETTES[g('pal')]?g('pal'):'aurora', rv:g('rev')==='1'?1:0, bg:/^[0-9a-f]{6}$/i.test(g('bg')||'')?g('bg'):'0b0d12', dn:num('dn',1), cy:num('cy',0), ed:g('endless')==='0'?0:1 };
  if (['explore','link','orbit'].includes(m)){ let t=g('t'); t=TKEY.includes(t)?TKEY.indexOf(t):parseInt(t,10); if (!TYPES[t]) t=0; S.t=t;
    if (!has('x') || !has('y') || !/^-?\d+(\.\d+)?$/.test(g('x')) || !/^-?\d+(\.\d+)?$/.test(g('y'))){ const V=TYPES[t].view; S.v=[String(V[0]),String(V[1]),V[2],0]; }
    else S.v=[g('x'), g('y'), num('sc',1.25), num('rot',0)];
    S.j=g('j')==='1'?1:0; if (has('c')){ const c=nums('c'); if (c.length===2 && c.every(isFinite)) S.c=c; }
    S.pw=num('pw',3); S.pr=g('pr')==='extreme'?1:0; S.cm=num('cm',0); S.in=num('in',0); S.it=num('it',0); S.aa=num('aa',2);
    S.ly=/^[AB]{1,16}$/.test(g('ly')||'')?g('ly'):'AB'; S.bm=['buddha','nebula','anti'].includes(g('bm'))?g('bm'):'buddha';
    S.bl=g('bla')==='0'?0:1; S.sd=g('steer')==='0'?0:1;
    if (t===11 && has('f')){ const fv=has('fv')?nums('fv'):null; S.f=[g('f'), g('z0')||'0', num('bail',100), fv&&fv.length===3&&fv.every(isFinite)?fv:null]; }
    if (m==='link') S.l=[g('auto')==='0'?0:1, g('path')==='edge'?'edge':'circle'];
    if (m==='orbit' && has('o')){ const o=nums('o'); if (o.length===2 && o.every(isFinite)) S.o=[o[0],o[1],g('oauto')==='0'?0:1]; } }
  else if (m==='grow'){ S.g=[GROW[g('g')]?g('g'):'koch', num('gen',0), g('play')==='0'?0:1, g('gzoom')==='1'?1:0, num('pyth',45), num('tree',28)]; }
  else { const old=!has('v'), s3n=({box4:'box',apo4:'apo'})[g('s3')]||g('s3'), sh=S3[s3n]?s3n:'bulb', D=st.d3, cam=nums('cam'), tg=has('tgt')?nums('tgt'):null, kn=has('knife')?nums('knife'):[0,0,0];
    const ok=a=>a&&a.every(isFinite);
    S.d=[sh, num('pow3',8), num('box',-1.8), num('w',0), num('lvl',5), num('twist',!has('v')&&(sh==='kifs'||sh==='kifs4')?20:0), ok(cam)&&cam.length===3?cam[0]:0.7, ok(cam)&&cam.length===3?cam[1]:0.32, ok(cam)&&cam.length===3?cam[2]:0,
      ok(tg)&&tg.length===3?tg:0, num('turn',old?0.25:0), g('breathe')==='1'?1:0, old?(g('sweep')==='0'||!S3[sh].four?0:1):(g('sweep')==='1'?1:0), old?(g('twanim')==='0'||!(sh==='kifs'||sh==='kifs4')?0:1):(g('twanim')==='1'?1:0), g('drag')==='move'?'move':'turn', ok(kn)?kn[0]:0, ok(kn)?kn[1]:0, ok(kn)?kn[2]:0, g('spin4')==='1'?1:0, Math.max(0,Math.round(num('nl',0))), ...(()=>{ const t=has('turn3d')?nums('turn3d'):[0,0,0]; return ok(t)&&t.length===3?t:[0,0,0]; })(), g('spin3')==='1'?1:0, g('cut')==='1'?1:0, g('bbreathe')==='1'?1:0, g('glass')==='1'?1:0, g('hyp')||'534', g('hw')==='1'?1:0, g('shadow')==='1'?1:0];
    if (!(S.d[8]>0)) S.d[8]=null; }
  return S; }
// a pasted link, a #code, or an old f3-/f4- code
export function readView(text){ const h=codeFromText(String(text||'').trim()); if (!h) return null;
  if (h.startsWith('f3-')||h.startsWith('f4-')) return decodeState(h);
  return parseView(h); }
export function applyView(S){ if (!S) return false; applyState(S); if (S.it===0) setCheck('iterAuto',1);
  if (S.d && S.d[8]==null){ st.d3.dist=d3Bound()*3.4; touch(); } return true; }
shared.lastHash = ''; shared.hashT = 0;
const linkFor=c=> inClaude ? c : shareLink('fractal',c);
export function writeHash(force){ if (!force && ptrs.size) return; const c=viewCode(); if (c===shared.lastHash && !force) return; shared.lastHash=c;
  if (document.activeElement!==$('linkBox')) $('linkBox').value=linkFor(c);
  if (!inClaude) setViewCode('fractal',c); }
// the shell calls this when the address changes to a view code (a pasted link, back/forward)
export function showView(h){ if (h && h!==shared.lastHash){ const S=readView(h); if (S){ shared.lastHash=h; applyView(S); } } }
if (inClaude) $('linkNote').textContent='This view code records the fractal, mode, place and zoom (to the last digit), colours and settings. Inside Claude, paste it into "Load a view" to return to this exact picture; in a saved copy of the page it also works after # at the end of the address.';
$('copyLink').addEventListener('click', async ()=>{ writeHash(true); const box=$('linkBox'); box.select(); let ok=false;
  try { await navigator.clipboard.writeText(box.value); ok=true; } catch(e){ try { ok=document.execCommand('copy'); } catch(e2){} }
  $('shareNote').textContent = ok ? (inClaude ? 'Copied. Paste it into "Load a view" to come back to this exact picture.' : 'Copied. Anyone opening this link sees this exact picture.') : 'Select the text above and copy it.'; });
function loadFromBox(){ const S=readView($('viewIn').value); if (!S){ $('shareNote').textContent='That doesn\'t look like a view link or code.'; return; }
  applyView(S); shared.lastHash=''; writeHash(true); $('shareNote').textContent='View loaded.'; }
$('loadView').addEventListener('click', loadFromBox);
$('viewIn').addEventListener('keydown', e=>{ if (e.key==='Enter'){ e.preventDefault(); loadFromBox(); } });
