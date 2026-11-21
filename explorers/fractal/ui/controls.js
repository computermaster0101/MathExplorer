import { shared } from '../shared.js';
import { $, clamp, clickIn, lerp, setCheck, setRange, smooth } from '../util.js';
import { ddFrom } from '../math/double-double.js';
import { dblToFix, fixToNum, strToFix } from '../math/big-fixed.js';
import { JPRESETS, TYPES } from '../fractals/types.js';
import { fitV, isExt, st, toMath, view } from '../state.js';
import { escR2, startZ, stepFn } from '../fractals/iterate.js';
import { PALETTES, css, fmtBig, fmtC, minus, setRamp } from '../color/palettes.js';
import { FS3, main, octx, ovc, refSlots } from '../render/webgl.js';
import { cssH, cssW, effIter, minScale, resetViews, toWorld, touch } from '../view.js';
import { notAvail } from './notice.js';
import { d3Bound, snapGap, f3Ready, is4, isKifs, knifeVal, nestReset, r4c, setDive3, start3Warp, syncT3 } from '../modes/fractal3d.js';
import { GROW, GROW_EXT, GROW_HOLD, fern } from '../modes/grow.js';
import { newOrbit, orbitIdx } from '../modes/orbit.js';
import { CMODE_NOTE, refreshLegend, updateDynamic, updateLabels } from './learn.js';

// ---------- UI wiring ----------
export function setSeg(group, el){ group.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===el)); }
export function segClick(id, fn){ $(id).addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; setSeg($(id), b); fn(b.dataset); touch(); }); }
export function setMode(m){
  st.mode=m; setSeg($('modes'), document.querySelector(`#modes [data-m="${m}"]`));
  document.querySelectorAll('[data-show]').forEach(el=>el.hidden=!el.dataset.show.split(' ').includes(m));
  document.querySelectorAll('details.grp').forEach(g=>{ const secs=g.querySelectorAll(':scope > .gb > .sec, :scope > .gb > .explain'); g.hidden=![...secs].some(s=>!s.hidden); });
  st.dive=false; st.endlessRun=false; st.fly=null; diveUI(); if (st.d3.dive||st.d3.warp) setDive3(false);
  if (m==='grow'){ st.grow.t=0; st.grow.playing=true; $('growPlay').textContent='Pause'; st.grow.fit=null; buildGenChips(); }
  if (m==='orbit'){ if (!notAvail()) newOrbit(); st.orbit.playing=true; $('orbPlay').textContent='Pause'; }
  st.q = m==='d3' ? 0.6 : 1; st.qMove=st.q; shared.hqShown=false;
  if (m==='d3' && !f3Ready && !shared.f3Err) try { main.progAsync('f3',FS3); } catch(e){ shared.f3Err=String(e.message||e).slice(0,240); }
  octx.setTransform(1,0,0,1,0,0); octx.clearRect(0,0,ovc.width,ovc.height);
  $('hint').textContent = m==='d3' ? 'Drag to orbit · scroll / pinch to move closer' : m==='orbit' ? 'Tap a point · drag to move · scroll to zoom' : m==='link' ? 'Drag on the map to move c' : 'Drag to move · scroll / pinch to zoom';
  shared.lastCap=''; touch(); updateLabels();
}
segClick('modes', d=>setMode(d.m));
export function typeChanged(){ const T=TYPES[st.type]; st.iterNeed=0; $('customBox').hidden=st.type!==11; st.dive=false; st.endlessRun=false; if (typeof diveUI==='function') diveUI(); if (T.juliaOnly||T.newton){ st.julia=false; $('juliaChk').checked=false; }
  $('juliaRow').hidden=!T.julia; $('jcBox').hidden=!(st.julia && T.julia); $('powRow').hidden=!T.power;
  resetViews(); buildPlaces(); if (T.places[0][4]) st.lyaSeq=T.places[0][4]; $('budRow').hidden=!T.cpu; if (st.mode==='orbit' && !notAvail()) newOrbit(); refSlots.forEach(s=>s.key=''); touch(); updateLabels(); }
segClick('types', d=>{ st.type=+d.t; typeChanged(); });
export function buildPlaces(){ const T=TYPES[st.type]; $('places').innerHTML=T.places.map((p,i)=>`<button data-i="${i}">${p[0]}</button>`).join(''); st.placeIdx=0; }
$('places').addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; flyTo(+b.dataset.i); });
export function flyTo(i){ const T=TYPES[st.type]; if (st.julia && !T.juliaOnly){ st.julia=false; $('juliaChk').checked=false; $('jcBox').hidden=true; resetViews(); updateLabels(); }
  const p=T.places[i]; st.placeIdx=i; if (p[4]) { st.lyaSeq=p[4]; updateLabels(); } const a=st.vE; st.dive=false; $('diveBtn').classList.remove('on'); $('diveBtn').textContent='Dive in';
  st.endlessRun=false; const bx=ddFrom(p[1]), by=ddFrom(p[2]); startFly(p[0], bx, by, p[3], null, null, {bx:strToFix(p[1]), by:strToFix(p[2])});
  document.querySelectorAll('#places button').forEach(x=>x.classList.toggle('on', +x.dataset.i===i)); touch(); }
function startFly(name, bx, by, scale, then, msg, big){ const a=st.vE, dist=Math.hypot(bx[0]-a.cx,by[0]-a.cy), ls0=Math.log(a.scale), ls1=Math.log(scale);
  big=big||{bx:dblToFix(bx[0])+dblToFix(bx[1]), by:dblToFix(by[0])+dblToFix(by[1])};
  st.fly={name, msg, then, out:ls1>ls0+1, a:{cx:a.cx,cy:a.cy,ls:ls0}, b:{cx:bx[0],lx:bx[1],cy:by[0],ly:by[1],ls:ls1,bx:big.bx,by:big.by}, hump:Math.max(0,Math.log(Math.max(dist*1.3,1e-300))-Math.max(ls0,ls1)), t:0, dur:clamp(1.4+0.08*Math.abs(ls0-ls1),1.4,5)}; touch(); }
export function advanceFly(dt){ const F=st.fly, v=st.vE; F.t+=dt; const u=clamp(F.t/F.dur,0,1), e=smooth(u), w=smooth(clamp(F.out?(u-0.35)/0.6:(u-0.08)/0.62,0,1));
  v.scale=Math.exp(lerp(F.a.ls,F.b.ls,e)+F.hump*Math.sin(Math.PI*u));
  if (w>=1){ v.cx=F.b.cx; v.lx=F.b.lx; v.cy=F.b.cy; v.ly=F.b.ly; v.bx=F.b.bx; v.by=F.b.by; } else { v.cx=lerp(F.a.cx,F.b.cx,w); v.cy=lerp(F.a.cy,F.b.cy,w); v.lx=v.ly=0; v.bx=dblToFix(v.cx); v.by=dblToFix(v.cy); }
  if (u>=1){ v.scale=Math.exp(F.b.ls); st.fly=null; if (F.then) F.then(); } touch(); }
// ---- endless dive: when the digits run out (or it's stuck in black), fly back to the top and dive somewhere new ----
export function diveUI(){ const on=st.dive||st.endlessRun; $('diveBtn').classList.toggle('on',on); $('diveBtn').textContent=on?'Stop diving':'Dive in'; }
function pickSpot(){ const T=TYPES[st.type], h=view(T.view); fitV(h, cssW/cssH); const d={x:0,y:0,w:cssW,h:cssH,v:h}; let pool=[];
  if ((st.type<=4 || st.type===11) && !st.julia){ const f=stepFn(st.type), R2=escR2(st.type);
    for (let gy=0;gy<22;gy++) for (let gx=0;gx<34;gx++){ const w=toWorld(d, cssW*(0.04+0.92*gx/33), cssH*(0.06+0.88*gy/21)), c=toMath(st.type,w); let z=startZ(st.type,c), n=-1;
      for (let i=0;i<500;i++){ z=f(z,c); if (!(z[0]*z[0]+z[1]*z[1]<=R2)){ n=i; break; } } if (n>=30) pool.push({w, n}); } }
  if (!pool.length) return T.places.length>1 ? (()=>{ const p=T.places[1+Math.floor(Math.random()*(T.places.length-1))]; return [ddFrom(p[1]),ddFrom(p[2])]; })() : [[h.cx+(Math.random()-0.5)*h.scale,0],[h.cy+(Math.random()-0.5)*h.scale,0]];
  let tot=0; for (const q of pool) tot+=q.n*q.n; let r=Math.random()*tot; for (const q of pool){ r-=q.n*q.n; if (r<=0) return [[q.w[0],0],[q.w[1],0]]; } return [[pool[0].w[0],0],[pool[0].w[1],0]]; }
export function endlessWarp(why){ const T=TYPES[st.type], v=st.vE; st.dive=false; st.endlessRun=true; st.steerTo=null; st.vel=[0,0]; shared.gridJob=null; st.insideT=0; st.manualT=0; st.steerCentreIn=false; st.steerPref=Math.random()*2*Math.PI; const mag=v.def/v.scale;
  const msg = why==='reset' ? '<b>Starting a new trip.</b> Flying back to the top to pick a fresh spot on the edge.'
    : why==='inside' ? `<b>Landed inside the set at ×${fmtBig(mag)}</b>, where it's black all the way down. Flying back to the top to dive somewhere new.`
    : `<b>Out of digits at ×${fmtBig(mag)}.</b> This is as deep as the numbers go here, so it's flying back to the top to dive somewhere new.`;
  const home=view(T.view); fitV(home, cssW/cssH);
  startFly('the top', [home.cx,0], [home.cy,0], home.scale, ()=>{ const sp=pickSpot();
    startFly('a new spot', sp[0], sp[1], home.scale*0.12, ()=>{ if (st.endlessRun){ st.dive=true; st.trip++; st.vel=[0,0]; shared.gridJob=null; } }, '<b>Picking a new spot on the edge…</b>'); }, msg);
  diveUI(); }
function buildPresets(id){ $(id).innerHTML=JPRESETS.map((p,i)=>`<button data-i="${i}">${p[0]}</button>`).join(''); }
buildPresets('jPresets'); buildPresets('jPresets2');
for (const id of ['jPresets','jPresets2']) $(id).addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; st.jc=JPRESETS[+b.dataset.i][1].slice();
  if (id==='jPresets2'){ st.link.auto=false; $('linkAuto').checked=false; } $('jco').textContent=fmtC(st.jc); setSeg($(id),b); refSlots[1].key=''; touch(); updateLabels(); });
$('juliaChk').addEventListener('change', e=>{ st.julia=e.target.checked; if (st.julia && TYPES[st.type].noBounded) st.jc=toMath(st.type,[st.vE.cx,st.vE.cy]); $('jcBox').hidden=!st.julia; $('jco').textContent=fmtC(st.jc); resetViews(); touch(); updateLabels(); });
$('steerChk').addEventListener('change', e=>{ st.steer=e.target.checked; st.steerTo=null; });
$('endlessChk').addEventListener('change', e=>{ st.endless=e.target.checked; $('endless3Chk').checked=st.endless; });
$('endless3Chk').addEventListener('change', e=>{ st.endless=e.target.checked; $('endlessChk').checked=st.endless; });
$('diveBtn').addEventListener('click', ()=>{ if (st.dive||st.endlessRun){ st.dive=false; st.endlessRun=false; st.fly=null; st.steerTo=null; diveUI(); touch(); return; }
  st.dive=true; st.endlessRun=st.endless; st.trip=1; st.insideT=0; st.steerCentreIn=false; st.steerPref=Math.random()*2*Math.PI; st.manualT=0; st.steerTo=null; st.vel=[0,0]; shared.gridJob=null; st.fly=null; diveUI(); touch(); });
$('diveSpd').addEventListener('input', e=>syncDiveSpd(+e.target.value));
// Reset view puts the current mode back to how it starts: camera, knife, turns, motion and shape settings (not the fractal or colours)
function resetSettings(){ const m=st.mode;
  if (m==='d3'){ const D=st.d3;
    setRange('pw3',8); setCheck('breathe',0); setRange('bs3',-1.8); setCheck('bsBreathe',0); setRange('tw3',0); setCheck('twAnim',0);
    Object.assign(D,{rxy:0,rxz:0,ryz:0,spin3:false,cut:false}); $('spin3').checked=false; $('cut3').checked=false; syncT3();
    setRange('w3',0); setCheck('sweep3',0); Object.assign(D,{axw:0,ayw:0,azw:0,spin4:false}); $('spin4').checked=false; syncR4(); r4c.key='';
    setRange('lvl3',5); setRange('turn3',0); clickIn('drag3','dm','turn'); D.aim=null; D.needAim=false; D.floating=false; shared.vel3={x:0,y:0}; }
  else if (m==='grow'){ st.grow.angle={pyth:45, tree:28}; const sh=GROW[st.grow.shape]; if (sh.angle){ $('ang').value=st.grow.angle[sh.angle]; $('ango').textContent=st.grow.angle[sh.angle]+'°'; } }
  else setRange('rot',0);
  touch(); }
export function resetView(){ resetSettings(); if (st.mode==='explore' && st.endlessRun){ endlessWarp('reset'); return; }
  if (st.mode==='d3' && (st.d3.dive||st.d3.warp) && st.endless){ start3Warp('reset'); return; }
  st.endlessRun=false; if (st.mode==='grow'){ st.grow.gv={ox:0,oy:0,z:1}; } else if (st.mode==='d3'){ nestReset(); st.d3.target=null; setDive3(false); st.d3.dist=d3Bound()*3.4; st.d3.yaw=0.7; st.d3.pitch=0.32; } else resetViews(); st.dive=false; diveUI(); touch(); }
$('resetView').addEventListener('click', resetView);
// grow
function buildGenChips(){ const sh=GROW[st.grow.shape]; $('genChips').innerHTML=[...Array(sh.max+1)].map((_,k)=>`<button data-k="${k}">${k}</button>`).join('');
  $('gzRow').hidden=!sh.zoom; $('angRow').hidden=!sh.angle; if (sh.angle){ $('ang').max = sh.angle==='tree' ? 160 : 80; $('ang').value=st.grow.angle[sh.angle]; $('ango').textContent=st.grow.angle[sh.angle]+'°'; } }
$('genChips').addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return; const k=+b.dataset.k; st.grow.t = k===0 ? 0.01 : GROW_HOLD+(k-1)*(GROW_EXT+GROW_HOLD)+GROW_EXT+0.01; st.grow.playing=false; st.grow.zoom=false; $('growZoom').checked=false; $('growPlay').textContent='Play'; touch(); });
$('growPlay').addEventListener('click', ()=>{ st.grow.playing=!st.grow.playing; $('growPlay').textContent=st.grow.playing?'Pause':'Play'; });
$('growReplay').addEventListener('click', ()=>{ st.grow.t=0; st.grow.playing=true; st.grow.zoom=false; $('growZoom').checked=false; $('growPlay').textContent='Pause'; fern.n=1e12; });
$('growZoom').addEventListener('change', e=>{ st.grow.zoom=e.target.checked; st.grow.zph=0; st.grow.gv={ox:0,oy:0,z:1}; });
$('ang').addEventListener('input', e=>{ const sh=GROW[st.grow.shape]; if (sh.angle){ st.grow.angle[sh.angle]=+e.target.value; $('ango').textContent=e.target.value+'°'; } });
segClick('growShapes', d=>{ st.grow.shape=d.g; st.grow.t=0; st.grow.playing=true; st.grow.zoom=false; $('growZoom').checked=false; $('growPlay').textContent='Pause'; st.grow.fit=null; st.grow.gv={ox:0,oy:0,z:1}; buildGenChips(); updateLabels(); });
// link
$('linkAuto').addEventListener('change', e=>{ st.link.auto=e.target.checked; });
segClick('linkPath', d=>{ st.link.path=d.p; st.link.auto=true; $('linkAuto').checked=true; });
// orbit
$('orbSpd').addEventListener('input', e=>{ const T=orbitIdx(st.orbit.t); st.orbit.step=+e.target.value; $('orbo').textContent=st.orbit.step.toFixed(2)+' s per step';
  const s=st.orbit.step; st.orbit.t = T<12 ? T*s : 12*s+(T-12)*s*0.3; });
$('orbNew').addEventListener('click', ()=>{ newOrbit(); st.orbit.playing=true; $('orbPlay').textContent='Pause'; });
$('orbPlay').addEventListener('click', ()=>{ st.orbit.playing=!st.orbit.playing; $('orbPlay').textContent=st.orbit.playing?'Pause':'Play'; });
$('orbAuto').addEventListener('change', e=>{ st.orbit.auto=e.target.checked; });
segClick('orbStyle', d=>{ st.orbit.style=d.s; });
$('orbCircle').addEventListener('change', e=>{ st.orbit.circle=e.target.checked; });
// 3D
export function d3Rows(){ const s=st.d3.shape, f=is4(); $('pwRow').hidden=s!=='bulb'; $('bsRow').hidden=s!=='box'; $('cutRow').hidden=f;
  $('knifeLbl').textContent=f?'Knife position (W)':'Knife position'; $('sweepLbl').textContent=f?'Sweep the knife through 4D':'Sweep the knife through the shape';
  $('turnKLbl').textContent=f?'Turn the knife in 4D':'Tilt the knife'; [['k1l','XW','XZ'],['k2l','YW','YZ'],['k3l','ZW','XY']].forEach(([id,a,b])=>$(id).textContent=f?a:b);
  $('knifeNote').textContent=f?'Sliding moves the cut along the hidden W direction. Turning it in the XW, YW or ZW plane tilts the cut, so it slices the 4D shape at an angle, the same turns as in the polytope explorer.'
    :'A 3D shape has no hidden direction, so here the knife is a flat cut that slices part of the shape away and shows the inside. Slide it through, tilt it, or let it sweep.';
  twRange(); syncW(); syncT3(); }
// The twist slider's range per shape. A twist either way works on most shapes (left of centre is the mirror-image spiral).
// The kaleidoscopes turn their folded wedge instead, and outside these angles almost nothing survives the folding.
function twRange(){ const s=st.d3.shape, [lo,hi]= s==='kifs' ? [-20,70] : s==='kifs4' ? [0,50] : [-180,180], e=$('tw3');
  e.min=lo; e.max=hi; st.d3.twist=clamp(st.d3.twist,lo,hi); e.value=st.d3.twist; $('tw3o').textContent=st.d3.twist.toFixed(1)+'°'; }
export function syncW(){ const D=st.d3; $('w3').value=Math.round(D.w*100); $('w3o').textContent=knifeVal().toFixed(2); }

export function syncR4(){ const D=st.d3; for (const [k,id] of [['axw','rxw'],['ayw','ryw'],['azw','rzw']]){ $(id).value=Math.round(D[k]); $(id+'o').textContent=Math.round(D[k])+'°'; } }
segClick('drag3', d=>{ st.d3.dragMode=d.dm; });
for (const gid of ['shapes3','shapes3b','shapes4']) $(gid).addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b) return;
  document.querySelectorAll('.sh3 button').forEach(x=>x.classList.toggle('on', x===b)); nestReset(); st.d3.shape=b.dataset.s3; st.d3.target=null; setDive3(false); st.d3.dist=d3Bound()*3.4; d3Rows(); touch(); updateLabels(); });
for (const [k,id] of [['axw','rxw'],['ayw','ryw'],['azw','rzw']]) $(id).addEventListener('input', e=>{ st.d3[k]=+e.target.value; if (e.isTrusted) cutOn(); $(id+'o').textContent=e.target.value+'°'; if (st.d3.spin4){ st.d3.spin4=false; $('spin4').checked=false; } touch(); });
$('spin4').addEventListener('change', e=>{ st.d3.spin4=e.target.checked; if (st.d3.spin4) cutOn(); touch(); });
$('cut3').addEventListener('change', e=>{ st.d3.cut=e.target.checked; syncW(); touch(); });
for (const k of ['xy','xz','yz']) $('t3'+k).addEventListener('input', e=>{ st.d3['r'+k]=+e.target.value; $('t3'+k+'o').textContent=e.target.value+'°'; if (st.d3.spin3){ st.d3.spin3=false; $('spin3').checked=false; } touch(); });
$('spin3').addEventListener('change', e=>{ st.d3.spin3=e.target.checked; touch(); });
$('t3reset').addEventListener('click', ()=>{ Object.assign(st.d3,{rxy:0,rxz:0,ryz:0,spin3:false}); $('spin3').checked=false; syncT3(); touch(); });
$('bsBreathe').addEventListener('change', e=>{ st.d3.bsBreathe=e.target.checked; const [c,a]=bsSweep(); st.d3.bsT=Math.asin(clamp((st.d3.boxS-c)/a,-1,1))/0.3; });
$('r4reset').addEventListener('click', ()=>{ Object.assign(st.d3,{axw:0,ayw:0,azw:0,spin4:false}); $('spin4').checked=false; syncR4(); touch(); });
$('pw3').addEventListener('input', e=>{ const b0=d3Bound(); st.d3.power=snapGap(+e.target.value,-2,2); e.target.value=st.d3.power; refit3(b0); $('pw3o').textContent=st.d3.power.toFixed(1); if (st.d3.breathe){ st.d3.breathe=false; $('breathe').checked=false; } touch(); });
$('breathe').addEventListener('change', e=>{ st.d3.breathe=e.target.checked; const [g,c,a]=pwSweep(); st.d3.t=Math.asin(clamp((Math.log(g*st.d3.power)-c)/a,-1,1))/0.22; });
// Breathe stays on the side it started: powers 2 to 24, or −2 to −16. It sweeps evenly in the power's logarithm (each
// moment multiplies the power by the same amount): 2 to 5 changes the shape far more than 16 to 24, so an even sweep in
// the power itself rushed through the dramatic low end and dawdled at the top. Returns [sign, centre, half-width] of log|power|.
const logSweep=(lo,hi)=>[(Math.log(lo)+Math.log(hi))/2, (Math.log(hi)-Math.log(lo))/2];
export const pwSweep=()=> st.d3.power<0 ? [-1, ...logSweep(2,16)] : [1, ...logSweep(2,24)];
export const pwAt=s=>{ const [g,c,a]=pwSweep(); return g*Math.exp(c+a*s); };   // s: the sweep's sine, -1..1
export const bsSweep=()=> st.d3.boxS>0 ? [2.2,0.6] : [-2,0.6];
$('bs3').addEventListener('input', e=>{ const b0=d3Bound(); st.d3.boxS=snapGap(+e.target.value,-1.1,1.5); e.target.value=st.d3.boxS; refit3(b0); if (e.isTrusted && st.d3.bsBreathe){ st.d3.bsBreathe=false; $('bsBreathe').checked=false; } $('bs3o').textContent=minus(st.d3.boxS.toFixed(2)); touch(); });
const cutOn=()=>{ if (!is4() && !st.d3.cut){ st.d3.cut=true; $('cut3').checked=true; } };   // moving the knife on a 3D shape switches the cut on
$('w3').addEventListener('input', e=>{ st.d3.w=+e.target.value/100; if (e.isTrusted) cutOn(); $('w3o').textContent=knifeVal().toFixed(2); if (st.d3.sweep){ st.d3.sweep=false; $('sweep3').checked=false; } touch(); });
$('sweep3').addEventListener('change', e=>{ st.d3.sweep=e.target.checked; if (st.d3.sweep) cutOn(); st.d3.wt=Math.asin(clamp(st.d3.w/0.94,-1,1))/0.45; });
$('tw3').addEventListener('input', e=>{ st.d3.twist=+e.target.value; $('tw3o').textContent=st.d3.twist.toFixed(1)+'°'; if (st.d3.twAnim){ st.d3.twAnim=false; $('twAnim').checked=false; } touch(); });
export const twAmp=()=>isKifs()?21:60;   // Keep twisting swings the twist between 0 and this × 2 degrees, on the side (left or right hand) it started
$('twAnim').addEventListener('change', e=>{ st.d3.twAnim=e.target.checked; st.d3.twSg=st.d3.twist<0&&!isKifs()?-1:1; st.d3.twT=Math.asin(clamp(Math.abs(st.d3.twist)/twAmp()-1,-1,1))/0.25; touch(); });
$('dive3Btn').addEventListener('click', ()=>{ const D=st.d3; if (D.dive||D.warp){ setDive3(false); } else { D.trip=1; setDive3(true); } });
$('reset3').addEventListener('click', resetView);
function syncDiveSpd(v){ st.diveSpeed=v; for (const [i,o] of [['diveSpd','diveo'],['dive3Spd','dive3o']]){ $(i).value=v; $(o).textContent=v.toFixed(1)+'×'; } }
$('dive3Spd').addEventListener('input', e=>syncDiveSpd(+e.target.value));
$('lvl3').addEventListener('input', e=>{ st.d3.lvl=+e.target.value; $('lvl3o').textContent=e.target.value; touch(); });
// when a slider changes the shape's size a lot, move the camera with it so the framing stays the same
function refit3(b0){ const D=st.d3; if (D.target || D.dive) return; const b1=d3Bound(); if (Math.abs(b1/b0-1)>0.02) D.dist*=b1/b0; }
$('turn3').addEventListener('input', e=>{ st.d3.turn=+e.target.value; $('turn3o').textContent=st.d3.turn?st.d3.turn.toFixed(1)+'×':'off'; });
$('cousinChk').addEventListener('change', e=>{ st.cousinInset=e.target.checked; });
// view
$('pow').addEventListener('input', e=>{ st.power=+e.target.value; $('powo').textContent=st.power.toFixed(2); for (const v of [st.vE,st.vL,st.vR,st.vO]) if (v && v.scale<minScale(st.type)) v.scale=minScale(st.type); touch(); });
$('iter').addEventListener('input', e=>{ st.iter=+e.target.value; st.iterAuto=false; $('iterAuto').checked=false; touch(); updateDynamic(); });
$('iterAuto').addEventListener('change', e=>{ st.iterAuto=e.target.checked; if (!st.iterAuto){ st.iter=effIter(st.vE); $('iter').value=st.iter; } touch(); updateDynamic(); });
segClick('aa', d=>{ st.aa=+d.a; });
$('blaChk').addEventListener('change', e=>{ st.bla=e.target.checked; touch(); });
segClick('prec', d=>{ st.precision=d.pr; const v=st.vE;
  if (!isExt()){ const ms=minScale(st.type); if (v.scale<ms) v.scale=ms; if (v.bx!==undefined){ v.cx=fixToNum(v.bx); v.lx=fixToNum(v.bx-dblToFix(v.cx)); v.cy=fixToNum(v.by); v.ly=fixToNum(v.by-dblToFix(v.cy)); } if (st.iter>30000){ st.iter=30000; $('iter').value=st.iter; } }
  st.iterNeed=0; shared.gridJob=null; updateDynamic(); });
segClick('budMode', d=>{ st.budMode=d.bm; refreshLegend(); });
$('rot').addEventListener('input', e=>{ const nd=+e.target.value; st.vE.rot+=(nd-st.rotDeg)*Math.PI/180; st.rotDeg=nd; $('roto').textContent=nd+'°'; touch(); });
$('mapChk').addEventListener('change', e=>{ st.mapInset=e.target.checked; });
$('prevChk').addEventListener('change', e=>{ st.prevInset=e.target.checked; });
$('markChk').addEventListener('change', e=>{ st.centreMark=e.target.checked; touch(); });
$('chartChk').addEventListener('change', e=>{ st.chartInset=e.target.checked; });
// style
segClick('cmode', d=>{ st.cmode=+d.c; $('cmodeNote').textContent=CMODE_NOTE[st.cmode]; refreshLegend(); });
const palBox=$('palettes');
for (const [name, stops] of Object.entries(PALETTES)){ const b=document.createElement('button'); b.title=name.replace('_',' & ').replace(/^./,c=>c.toUpperCase()); b.dataset.p=name;
  b.style.background=`linear-gradient(90deg,${stops.map(c=>css(c)).join(',')})`; if (name===st.palette) b.classList.add('on');
  b.addEventListener('click', ()=>{ st.palette=name; setRamp(); palBox.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); palLabel(); refreshLegend(); updateLabels(); touch(); });
  palBox.appendChild(b); }
$('palName').textContent='Palette: Aurora';
function palLabel(){ const b=palBox.querySelector('button.on'); $('palName').textContent='Palette: '+(b?b.title:'')+(st.palRev?' (reversed)':''); }
$('palRev').addEventListener('change', e=>{ st.palRev=e.target.checked; setRamp(); palLabel(); refreshLegend(); updateLabels(); touch(); });
$('cyc').addEventListener('input', e=>{ st.cycleSpeed=+e.target.value; $('cyco').textContent=st.cycleSpeed?st.cycleSpeed.toFixed(1)+'×':'off'; touch(); });
$('dens').addEventListener('input', e=>{ st.density=+e.target.value; $('denso').textContent=st.density.toFixed(1)+'×'; touch(); });
segClick('inside', d=>{ st.inside=+d.i; });
segClick('bg', d=>{ st.bg=d.b; refreshLegend(); });
$('lw').addEventListener('input', e=>{ st.lw=+e.target.value; $('lwo').textContent=st.lw.toFixed(1)+'×'; });
