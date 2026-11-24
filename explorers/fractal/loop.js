import { shared } from './shared.js';
import { $, clamp, lerp, smooth } from './util.js';
import { TYPES } from './fractals/types.js';
import { isExt, ptrs, qLimits, st } from './state.js';
import { drive, setPausedTag } from '../../js/shell/keys.js';
import { hexRGB, minus } from './color/palettes.js';
import { ctxLost, gl, glc, octx, refSlots } from './render/webgl.js';
import { cssH, cssW, deepT, effIter, extT, minScale, moveCentre, ovScale, panBy, runGrid, sizeBuffers, startGrid, touch, viewDescs } from './view.js';
import { drawBlit, grabFrame, render2DAll } from './render/bla.js';
import { notAvail } from './ui/notice.js';
import { budDraw, budStep } from './modes/buddhabrot.js';
import { d3Bound, d3Extra, d3MinDist, dive3UI, steer3Reset, steer3Step, f3Ready, pan3, turn3, nestDive, nestIn, nestOut, nestStraight, render3D, retarget3, setDive3, start3Warp, syncT3 } from './modes/fractal3d.js';
import { GROW, GROW_END, drawGrow, fern, growTotal } from './modes/grow.js';
import { drawOrbit, newOrbit, orbitIdx } from './modes/orbit.js';
import { drawCentreMark, drawLink, drawTapMark, pathC } from './modes/julia-link.js';
import { drawInsets } from './ui/insets.js';
import { refreshLegend, updateDynamic } from './ui/learn.js';
import { advanceFly, bsSweep, diveUI, endlessWarp, pwAt, syncR4, syncW, twAmp } from './ui/controls.js';
import { writeHash } from './io/share.js';
import { BeatGate, Groove, Phase, colourStep, cycleBeats, energyMul, pulseFx as pulse, reacting, voiceFx as voice } from '../../js/shell/audio/react.js';
import { recFrame } from './io/recorder.js';
import { LOOP, loopRate, colourPart, TAU } from '../../js/common/seamless.js';

// ---------- loop ----------
// motion clocks: with the music's tempo locked, periodic motions land their cycles on bar lines and turning surges on each beat
const clk={ yaw:new Groove(), breathe:new Phase(), box:new Phase(), twist:new Phase(), sweep:new Phase(), spin3:new Groove(), spin4:new Groove(), link:new Phase(), orbit:new Groove(), grow:new Groove(), orbitGate:new BeatGate() };
let tPrev=performance.now(), frameN=0; shared.hqShown = false; let dtAvg=16, lastStill=0;
// Frame pacing. Uneven frames look worse than slower even ones, so when a moving scene can't keep up with the screen,
// draw on every other refresh (a steady 30 fps on a 60 Hz screen). Every 8 s try full rate briefly in case it can again.
// pace.simulate: tests can set a function here that runs on every drawn frame, to imitate a slower graphics card
export const pace={ every:1, vsync:16.7, lastRaf:0, lastDraw:0, probeAt:0, probeN:0, probeT:0, cost:0, simulate:null };
function advance3D(dt){ const D=st.d3; let moving=ptrs.size>0;
  if (D.shape==='nest' && D.target && !D.aim && !D.warp && nestStraight()){ let g=0;
    while (D.dist<0.4 && Math.hypot(...D.target)<1.2 && g++<8) nestIn();
    while (D.dist>1.0 && (D.nestM||0)>0 && g++<16) nestOut(); }
  if (!LOOP.on && !ptrs.size && Math.abs(shared.vel3.x)+Math.abs(shared.vel3.y)>0.05){ D.yaw-=shared.vel3.x*0.008; D.pitch=clamp(D.pitch+shared.vel3.y*0.008,-1.45,1.45); shared.vel3.x*=0.9; shared.vel3.y*=0.9; moving=true; }
  if (st.paused){   // Space: everything holds still; dragging, the keys and re-aiming after them still work
    if (D.needAim){ D.aimT-=dt; if (!ptrs.size || D.aimT<=0){ D.aimT=0.15; D.needAim=false; if (!retarget3()) D.floating=true; } moving=true; }
    return moving; }
  if (D.turn && !D.target){ D.yaw+=clk.yaw.delta(dt, loopRate(0.3*D.turn), 0.15*D.turn); moving=true; }
  if (D.aim){ const A=D.aim; A.t+=dt/0.8; const u=clamp(A.t,0,1), e=smooth(u); moving=true;
    D.target=[0,1,2].map(i=>lerp(A.T0[i],A.T1[i],e)); D.yaw=lerp(A.y0,A.y1,e); D.pitch=lerp(A.p0,A.p1,e); D.dist=Math.exp(lerp(A.l0,A.l1,e));
    if (u>=1){ D.aim=null; if (st.endless || D.dive){ D.dive=true; D.extra=d3Extra(); dive3UI(); } } }
  if (D.needAim){ D.aimT-=dt; if (!ptrs.size || D.aimT<=0){ D.aimT=0.15; D.needAim=false; const ok=retarget3(); if (!ok) D.floating=true; } moving=true; }
  if (D.dive && D.floating && !D.aim && D.target && !D.warp){   // steered toward empty space: keep flying forward, looking for a surface ahead
    const cp=Math.cos(D.pitch), bz=[cp*Math.sin(D.yaw), Math.sin(D.pitch), cp*Math.cos(D.yaw)], step=D.dist*(1-Math.exp(-dt*st.diveSpeed*0.3*diveEnergy()));
    D.target=D.target.map((x,i)=>x-bz[i]*step); D.aimT-=dt; if (D.aimT<=0){ D.aimT=0.3; if (retarget3()) D.floating=false; }
    if (Math.hypot(...D.target)>d3Bound()*4){ if (st.endless) start3Warp('floor'); else setDive3(false); }   // flown right out of it
    moving=true; }
  if (D.dive && !D.aim && !D.warp && D.shape!=='nest'){   // steer toward detail, unless steering by hand (keys or drag)
    if (st.steer && !(st.keyDriveT>0) && !ptrs.size){ if (steer3Step(dt)) moving=true; } else steer3Reset(); }
  if (D.dive && !D.floating && !D.aim){ const mn=d3MinDist(); D.dist=Math.max(mn, D.dist*Math.exp(-dt*st.diveSpeed*0.3*diveEnergy())); moving=true;
    const x=d3Extra(); if (x!==D.extra){ D.extra=x; retarget3(); }
    if (D.dist<=mn*1.0001){ if (st.endless) start3Warp('floor'); else setDive3(false); } }
  if (D.warp){ const W=D.warp; W.t+=dt; const u=clamp(W.t/W.dur,0,1), e=smooth(u); moving=true;
    D.dist=Math.exp(lerp(W.ls0,W.ls1,e)); D.target=[0,1,2].map(i=>lerp(W.T0[i],0,smooth(clamp((u-0.4)/0.6,0,1)))); D.yaw=lerp(W.y0,W.y1,e); D.pitch=lerp(W.p0,W.p1,e);
    if (u>=1){ D.warp=null; D.target=null; D.trip=(D.trip||1)+1; let ok=false;
      for (let k=0;k<8 && !ok;k++){ ok=retarget3(); if (!ok){ D.yaw+=0.7; D.pitch=clamp(D.pitch+0.25*(Math.random()-0.5),-0.6,0.9); } }
      if (D.shape==='nest'){ D.target=[0,0,0]; nestDive(); } else if (ok){ D.dive=true; D.extra=d3Extra(); } else { D.target=null; D.dive=false; } dive3UI(); } }
  // Breathe reshapes the whole object, so with music one cycle takes 4× "Slow motions take" (8 bars by default), near its free pace
  if (D.breathe && D.shape==='bulb'){ D.t=clk.breathe.step(D.t, dt, 2*Math.PI/0.22, cycleBeats(4)); D.power=pwAt(Math.sin(D.t*0.22)); $('pw3').value=D.power; $('pw3o').textContent=D.power.toFixed(1); moving=true; }
  if (D.bsBreathe && D.shape==='box'){ D.bsT=clk.box.step(D.bsT, dt, 2*Math.PI/0.3, cycleBeats(4)); { const [c,a]=bsSweep(); D.boxS=c+a*Math.sin(D.bsT*0.3); } $('bs3').value=D.boxS; $('bs3o').textContent=minus(D.boxS.toFixed(2)); moving=true; }
  if (D.spin3){ const wrap=a=>((a+180)%360+360)%360-180; const g=clk.spin3.delta(dt, 1, 0.5); D.rxy=wrap(D.rxy+g*loopRate(9,360)); D.rxz=wrap(D.rxz+g*loopRate(13,360)); D.ryz=wrap(D.ryz+g*loopRate(6,360)); if (frameN%3===0) syncT3(); moving=true; }
  if (D.twAnim){ D.twT=clk.twist.step(D.twT, dt, 2*Math.PI/0.25, cycleBeats(2)); D.twist=(D.twSg||1)*twAmp()*(1+Math.sin(D.twT*0.25)); $('tw3').value=D.twist; $('tw3o').textContent=D.twist.toFixed(1)+'°'; moving=true; }
  if (D.sweep){ D.wt=clk.sweep.step(D.wt, dt, 2*Math.PI/0.45, cycleBeats(1)); D.w=0.94*Math.sin(D.wt*0.45); syncW(); moving=true; }
  if (D.spin4){ D.spT+=dt; const wrap=a=>((a+180)%360+360)%360-180, g=clk.spin4.delta(dt, 1, 0.5); D.axw=wrap(D.axw+g*loopRate(11,360)); D.ayw=wrap(D.ayw+g*loopRate(7,360)); D.azw=wrap(D.azw+g*loopRate(4.5,360)); if (frameN%3===0) syncR4(); moving=true; }
  if (reacting()) moving=true;   // the music bends the shape every frame (see render3D)
  return moving; }
// The driving keys (see drive() in js/shell/keys.js), every frame while held. 3D: arrows turn (round the shape, or in place
// while diving) and W A S D slide. 2D: both pan. Shift is three times faster. Steering a 2D dive pauses its own steering.
function driveKeys(dt){ const k=drive(); if (!k.any || notAvail()) return false; const f=(k.fast?3:1)*k.scale;   // scale: the Navigation speed setting
  if (st.mode==='d3'){ const D=st.d3, g=D.dive?0.45:1;   // gentler while diving: the view is close and moving already
    st.keyDriveT=1.5;   // steering by hand: the automatic steering waits
    if ((k.turnX||k.turnY) && !D.warp) turn3(-k.turnX*1.1*f*g*dt, -k.turnY*0.9*f*g*dt, !!D.dive);
    if (k.slideX||k.slideY){ const px=0.55*cssH*f*g*dt; pan3(-k.slideX*px, k.slideY*px); }
    return true; }
  const cl=v=>Math.max(-1,Math.min(1,v)), x=cl(k.slideX+k.turnX), y=cl(k.slideY+k.rawY), px=0.5*cssH*f*(st.dive?0.5:1)*dt; if (!x && !y) return false;
  if (st.mode==='grow'){ st.grow.gv.ox-=x*px; st.grow.gv.oy+=y*px; touch(); return true; }
  if (st.mode==='explore' || st.mode==='orbit'){ const d=viewDescs()[0]; if (!d) return false; panBy(d, -x*px, y*px); if (st.dive) st.keyDriveT=1.5; return true; }
  return false; }
// Choose between full rate and every other refresh, and nudge render quality only when clearly needed, in small steps,
// so the picture doesn't keep sharpening and softening. Quality is the render scale (cost grows with its square).
function adjustPace(now, qMax, dtMs){
  const full=pace.vsync, half=2*pace.vsync;
  if (pace.probeN>0){   // trying full rate: measure what a frame really costs (raw frame times, after a few to settle)
    if (pace.probeN<=16) pace.probeT+=dtMs; if (--pace.probeN>0) return;
    pace.cost=pace.probeT/16;
    if (pace.cost<full*1.15){ pace.every=1; }
    else { pace.every=2; if (pace.cost<half*0.75) st.q=Math.min(qMax,st.q*1.05); else if (pace.cost>half*1.05) st.q=Math.max(qLimits().floor,st.q*0.92); }
    pace.probeAt=now+8000; dtAvg=pace.every===1?full:half; return;
  }
  if (frameN%10) return;
  if (pace.every===1){
    // can't hold full rate: go to an even half rate. (At full rate frames wait for the screen, so spare time can't be
    // seen here; quality only rises after a half-rate check has measured real headroom.)
    if (dtAvg>full*1.3){ pace.every=2; dtAvg=half; pace.probeAt=now+4000; }
  } else {
    if (dtAvg>half*1.2) st.q=Math.max(qLimits().floor,st.q*0.92);                  // even half rate is too much: soften a little (not below the chosen floor)
    else if (now>pace.probeAt){ pace.probeN=20; pace.probeT=0; pace.every=1; }      // time to check for headroom
  }
}
// 2D: react at once to a frame that clearly overran. The steady controller above looks every 10 frames and steps 8%, which
// at 600 ms a frame (a deep view on a sharp screen with a modest graphics card) took most of a famous place's 2 s flight to
// notice and never got far (it held 0.92 while frames took up to 1.2 s). So after any moving draw (a drag, the keys, a
// flight, a dive or the wheel), a gap past five refreshes cuts the render scale at once by what it measured (cost goes with
// the square of the scale), down to the chosen floor, and the next motion starts from there. It skips the frame right after
// a cut, which can still be paying for the old size, and ignores a gap mostly spent in the frame's own code: a one-off pause
// (building a shader, a new reference orbit) isn't the picture's cost, which the graphics card pays after the frame.
const work={ prev:'', cpu:0, cutAt:0, perQ2:0 };   // prev: what the last drawn frame did ('move', 'hq', 'strip'); cpu: ms spent in that frame's code; perQ2: moving cost (ms) ÷ scale²
function overrun(now, gap){
  if (work.prev!=='move' || st.mode==='d3' || st.mode==='grow' || work.cpu>gap*0.5) return;
  work.perQ2 = work.perQ2 ? work.perQ2*0.6 + 0.4*gap/(st.q*st.q) : gap/(st.q*st.q);
  if (gap>pace.vsync*5 && frameN>work.cutAt+1){ const L=qLimits(), q=Math.max(L.floor, st.q*clamp(Math.sqrt(pace.vsync*1.8/gap),0.5,0.9));
    if (q<st.q){ st.q=q; work.cutAt=frameN; pace.every=2; pace.probeAt=now+4000; dtAvg=2*pace.vsync; } } }
// The strips wait for the graphics card. Drawing calls return at once and the card works through them later, so timing
// frames saw every strip as quick, grew them to the whole picture, and the work landed as one long stall after the last.
// A fence after each strip says when the card has finished it. Two strips may wait at once while they come back quickly (one
// keeps the card busy while the next is sent), only one once they're slow (two slow ones queued made a 150 ms hitch on a
// phone-shaped screen), and each finished strip sets the next one's size: larger if it came back quickly, smaller if slow.
let fences=[];
function dropFence(){ for (const F of fences) try { gl.deleteSync(F.f); } catch(e){ /* context lost */ } fences=[]; }
function stripReady(now, P){
  while (fences.length){ let done=true; try { done=gl.getSyncParameter(fences[0].f, gl.SYNC_STATUS)===gl.SIGNALED; } catch(e){ /* context lost */ }
    if (!done) break; const F=fences.shift(), took=now-F.at; try { gl.deleteSync(F.f); } catch(e){ /* context lost */ }
    P.slow = took>pace.vsync*2.5;
    if (took<pace.vsync*2.2) P.strip=Math.min(1024,Math.ceil(P.strip*1.4)); else if (took>pace.vsync*4) P.strip=Math.max(8,Math.floor(P.strip/2)); }
  return fences.length < (P.slow ? 1 : 2); }
// What the sharp 2D picture will cost: the moving cost at full scale, times the smoothing's samples (2×2 smoothing: 4).
function hqCost(){ const aa=effIter(st.vE)>2500 ? 1 : effIter(st.vE)>1200 ? Math.min(2,st.aa) : st.aa; return work.perQ2*aa*aa; }
// the shell starts and stops the loop as this explorer comes on and off screen
let running=false;
export function startLoop(){ if (running) return; running=true; tPrev=performance.now(); requestAnimationFrame(loop); }
export function stopLoop(){ running=false; }
const diveEnergy=()=>clamp(energyMul(),0.8,1.2);
// ---------- seamless loops (js/common/seamless.js) ----------
// Making one, the recorder steps the picture itself (loopTick), every frame drawn sharp at the video's own size; the
// motions that go round (turntable, breathe, twist, the 3D and 4D spins and slice, c going round the Julia link, a growing
// fractal's endless zoom, the colours) are rounded to whole turns, and dives, flights and orbits can't loop.
const D3P=[['turn','Turntable'],['breathe','Breathe'],['bsBreathe','Breathe'],['spin3','Spin'],['twAnim','Twist'],['sweep','4D slice sweep'],['spin4','4D spin']];
export function loopParts(){
  const parts=[], held=[], stop={ block:'A dive or a flight never comes back to where it started, so it can’t loop. Stop it first (G).' };
  if (notAvail()) return { block:'This view can’t be drawn here, so there’s nothing to loop.' };
  if (st.paused) return { parts, held };
  if (st.mode==='explore' && (st.fly || st.dive)) return stop;
  if (st.mode==='d3'){ const D=st.d3; if (D.dive || D.warp || D.aim) return stop;
    if (D.turn && !D.target) parts.push({ name:'Turntable', rate:0.3*D.turn, cycle:TAU });
    if (D.breathe && D.shape==='bulb') parts.push({ name:'Breathe', rate:1, cycle:2*Math.PI/0.22, noun:['breath','breaths'] });
    if (D.bsBreathe && D.shape==='box') parts.push({ name:'Breathe', rate:1, cycle:2*Math.PI/0.3, noun:['breath','breaths'] });
    if (D.spin3) parts.push({ name:'Spin XY', rate:9, cycle:360 }, { name:'XZ', rate:13, cycle:360 }, { name:'YZ', rate:6, cycle:360 });
    if (D.twAnim) parts.push({ name:'Twist', rate:1, cycle:2*Math.PI/0.25, noun:['time','times'] });
    if (D.sweep) parts.push({ name:'4D slice sweep', rate:1, cycle:2*Math.PI/0.45, noun:['sweep','sweeps'] });
    if (D.spin4) parts.push({ name:'4D spin XW', rate:11, cycle:360 }, { name:'YW', rate:7, cycle:360 }, { name:'ZW', rate:4.5, cycle:360 }); }
  if (st.mode==='link' && st.link.auto) parts.push({ name:'c going round', rate:0.15, cycle:TAU, noun:['time','times'] });
  if (st.mode==='grow'){ const sh=GROW[st.grow.shape]; if (st.grow.zoom && sh.zoom) parts.push({ name:'Endless zoom', rate:0.35, cycle:1, noun:['step','steps'] }); else if (st.grow.playing) held.push('the growing'); }
  if (st.mode==='orbit' && st.orbit.playing) held.push('the orbit');
  if (st.mode==='explore' && TYPES[st.type].cpu) held.push('the picture building up');
  parts.push(...colourPart(st.cycleSpeed));
  return { parts, held };
}
const lpq={ q:1, qMove:0 };
export function loopBegin(L, H){ lpq.q=st.q; lpq.qMove=st.qMove; shared.loopH=H; st.prog=null; dropFence(); shared.vel3.x=shared.vel3.y=0; }
export function loopEnd(){ shared.loopH=0; st.q=lpq.q; st.qMove=lpq.qMove; shared.hqShown=false; touch(); }
/** One frame of a loop: move by dt and draw the sharp picture. */
export function loopTick(dt){
  setPausedTag(st.paused); const go=!st.paused;
  if (go && st.cycleSpeed>0) st.cycle=(st.cycle+dt*loopRate(st.cycleSpeed*0.06,1))%1;
  if (go && st.mode==='link' && st.link.auto && !notAvail()){ st.link.t=clk.link.step(st.link.t, dt, 2*Math.PI, cycleBeats(4), 0.15); const c=pathC(st.link.t); st.jc=[c[0], c[1]]; }
  if (go && st.mode==='grow'){ const sh=GROW[st.grow.shape]; if (st.grow.zoom && sh.zoom){ st.grow.zph=(st.grow.zph+dt*loopRate(0.35,1))%1; } }
  if (st.mode==='d3') advance3D(dt);
  st.q=1; st.prog=null; sizeBuffers(); shared.dirty=true;
  if (!ctxLost){
    if (notAvail() || st.mode==='grow'){ const b=hexRGB(st.bg); gl.viewport(0,0,glc.width,glc.height); gl.clearColor(b[0],b[1],b[2],1); gl.clear(gl.COLOR_BUFFER_BIT); }
    else if (st.mode==='d3') render3D(true); else render2DAll(true); }
  octx.setTransform(ovScale,0,0,ovScale,0,0);
  if (st.mode==='grow') drawGrow(); else { octx.clearRect(0,0,cssW,cssH); if (!notAvail() && st.mode==='link') drawLink(); }
  shared.hqShown=true; frameN++;
}
export function loop(now){
  if (!running) return;
  if (LOOP.on){ tPrev=now; pace.lastDraw=now; requestAnimationFrame(loop); return; }   // a seamless loop being made steps the picture itself
  { const gap=now-pace.lastRaf; pace.lastRaf=now; if (gap>4 && gap<25) pace.vsync+=(gap-pace.vsync)*0.05; }
  if (pace.every===2 && now-pace.lastDraw < pace.vsync*1.5){ requestAnimationFrame(loop); return; }   // skip this refresh
  overrun(now, now-pace.lastDraw); work.prev='';
  pace.lastDraw=now; if (pace.simulate) pace.simulate();
  const dt=clamp((now-tPrev)/1000,0,0.12); tPrev=now;   // the first frame's timestamp can be slightly earlier than start-up
  let anim=false; setPausedTag(st.paused);
  { const c=colourStep(dt); if (c){ st.cycle=(st.cycle+c)%1; if (frameN%10===0) refreshLegend(); } if (reacting() && st.mode!=='grow') anim=true; }
  if (st.cycleSpeed>0 && !st.paused){ st.cycle=(st.cycle+dt*st.cycleSpeed*0.06)%1; anim=true; if (frameN%10===0) refreshLegend(); }
  if (ptrs.size) anim=true;
  st.keyDriveT-=dt;
  if (st.mode==='explore' && !st.paused){ if (st.fly){ advanceFly(dt); anim=true; } else if (st.dive){ const v=st.vE, ms=minScale(st.type);
    st.manualT-=dt; const keys=st.keyDriveT>0;   // steering with the keys: the automatic steering waits
    if (st.steer && !keys){ if (!shared.gridJob) startGrid('steer'); runGrid(5); }
    if (st.steerTo && !keys){ const sc=v.scale, man=st.manualT>0, gain=man?1.8:0.9, mxv=man?1.0:st.steerCentreIn?0.9:0.45; let tx=st.steerTo[0]/sc*gain, ty=st.steerTo[1]/sc*gain; const m=Math.hypot(tx,ty); if (m>mxv){ tx*=mxv/m; ty*=mxv/m; }
      const k=1-Math.exp(-dt/(man?0.3:0.6)); st.vel=[st.vel[0]+(tx-st.vel[0])*k, st.vel[1]+(ty-st.vel[1])*k];
      const mx=st.vel[0]*sc*dt, my=st.vel[1]*sc*dt; moveCentre(v,mx,my); st.steerTo=[st.steerTo[0]-mx, st.steerTo[1]-my]; }
    // Zoom: at the default 0.5× the picture doubles in size about every 3.5 s. While the middle is still in the black, ease
    // off so the steering can reach the edge first. The music's energy only nudges it (diving is easy to overdo).
    v.scale=Math.max(ms, v.scale*Math.exp(-dt*st.diveSpeed*0.4*diveEnergy()*(st.steer&&st.steerCentreIn&&st.steerInside>0.55?0.5:1)));
    if (v.scale<=ms){ if (st.endless) endlessWarp('floor'); else { st.dive=false; diveUI(); } }
    else if (st.endless && st.insideT>2.2) endlessWarp('inside');
    anim=true; } }
  if (st.mode==='link' && st.link.auto && !notAvail() && !st.paused){ st.link.t=clk.link.step(st.link.t, dt, 2*Math.PI, cycleBeats(4), 0.15); const c=pathC(st.link.t), k=1+0.035*pulse()+0.015*voice(); st.jc=[c[0]*k, c[1]*k]; anim=true; }
  if (st.mode==='explore' && TYPES[st.type].cpu) budStep();
  if (st.mode==='explore' && deepT() && !(st.dive && st.steer)){ st.probeT-=dt;
    if (st.probeT<=0 && !shared.gridJob){ st.probeT=0.6; if (st.vE.scale<=1e-5 && refSlots[0].d64) startGrid('probe'); else if (st.iterNeed){ st.iterNeed=0; touch(); } }
    runGrid(4); }
  if (st.mode==='orbit' && st.orbit.playing && st.orbit.data && !notAvail() && !st.paused){ st.orbit.t+=clk.orbit.delta(dt, 1, st.orbit.step, true); const D=st.orbit.data, onBeat=clk.orbitGate.crossed();   // with the music: one step per beat, and a new point starts on a beat
    if (st.orbit.auto && orbitIdx(st.orbit.t)>D.show+8 && (onBeat || clk.orbitGate.last===null)) newOrbit(); }
  if (st.mode==='grow' && !st.paused){ const sh=GROW[st.grow.shape]; if (st.grow.zoom && sh.zoom){ st.grow.zph=(st.grow.zph+dt*0.35)%1; } else if (st.grow.playing){ st.grow.t+=clk.grow.delta(dt, 1, 0.5); if (st.grow.t>growTotal(sh)+GROW_END){ st.grow.t=0; fern.n=1e12; } } }
  if (st.mode==='d3') anim=advance3D(dt)||anim;
  if (driveKeys(dt)) anim=true;
  let goHQ=false;
  if (st.mode!=='grow' && !notAvail()){      // drop resolution while moving if frames get slow; full quality once still
    const L=qLimits(), qMax=L.max; if (st.q<L.floor) st.q=L.floor;   // see "While moving" in View & detail
    const recol=shared.recol && !anim && !ptrs.size; shared.recol=false;
    if (recol && !st.prog){ if (!shared.hqShown) st.qMove=st.q; st.q=1; goHQ=true; }   // colours only: straight to the sharp picture
    else if (anim || shared.dirty){ dropFence(); if (shared.hqShown || st.prog){ st.q=Math.min(qMax, st.qMove||qMax); shared.hqShown=false; } st.prog=null;
      if (anim){ dtAvg=dtAvg*0.9+dt*1000*0.1; adjustPace(now, qMax, dt*1000); }
      lastStill=now; }
    else if (!shared.hqShown && !st.prog && now-lastStill>240){ st.qMove=st.q; st.q=1; goHQ=true; pace.every=1; pace.probeN=0; } }
  // The sharp picture is drawn in strips over several frames, with the last picture kept on screen stretched beneath, when
  // it's slow: past 1e-20 on Extreme, or whenever it would take more than about 80 ms (a single sharp draw at Seahorse
  // Valley on a sharp screen took 600 ms, during which nothing could move). Any drag, key or zoom stops it (st.prog=null).
  const extHQ = goHQ && st.mode==='explore' && extT() && isExt() && st.vE.scale<1e-20, est = goHQ && st.mode!=='d3' && !TYPES[st.type].cpu ? hqCost() : 0;
  const progHQ = extHQ || est>80;
  if (progHQ && !ctxLost) grabFrame();
  sizeBuffers();
  if (!ctxLost){
    if (notAvail()){ const b=hexRGB(st.bg); gl.viewport(0,0,glc.width,glc.height); gl.clearColor(b[0],b[1],b[2],1); gl.clear(gl.COLOR_BUFFER_BIT); }
    else if (st.mode==='grow'){ if (shared.dirty){ const b=hexRGB(st.bg); gl.viewport(0,0,glc.width,glc.height); gl.clearColor(b[0],b[1],b[2],1); gl.clear(gl.COLOR_BUFFER_BIT); } }
    else if (goHQ && progHQ){ dropFence(); drawBlit(); st.prog={y:0, strip: extHQ ? 24 : clamp(Math.round(glc.height*15/est),8,1024), slow:true}; }   /* about 15 ms of work by the estimate (which runs low when moving frames waited for the screen), one at a time until the first comes back */
    else if (goHQ){ if (st.mode==='d3') render3D(true); else render2DAll(true); shared.hqShown=true; work.prev='hq'; }
    else if (st.prog){ const P=st.prog; if (stripReady(now, P)){ const y1=Math.min(glc.height, P.y+P.strip); render2DAll(true,[P.y,y1]); P.y=y1; work.prev='strip';
      if (P.y>=glc.height){ st.prog=null; shared.hqShown=true; } else { fences.push({ f:gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0), at:now }); gl.flush(); } } }
    else if (anim || shared.dirty){ if (st.mode==='d3') render3D(false); else render2DAll(false); work.prev='move'; }
  }
  octx.setTransform(ovScale,0,0,ovScale,0,0);
  if (st.mode==='grow') drawGrow();
  else { octx.clearRect(0,0,cssW,cssH); if (!notAvail()){ if (st.mode==='orbit') drawOrbit(); else if (st.mode==='link') drawLink(); else if (st.mode==='explore' && TYPES[st.type].cpu) budDraw(); else if (st.mode==='explore'){ drawCentreMark(); drawTapMark(); } else if (st.mode==='d3') drawTapMark(); } }
  drawInsets(); recFrame(); shared.dirty = st.mode==='d3' && !f3Ready && !shared.f3Err;   // while a 3D program is still being built, keep asking for the picture so it shows the moment it's ready
  work.cpu=performance.now()-now;
  frameN++; if (frameN%6===0) updateDynamic();
  if (now-shared.hashT>1000){ shared.hashT=now; writeHash(false); }
  requestAnimationFrame(loop);
}
