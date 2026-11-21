import { shared } from './shared.js';
import { $, clamp, lerp, smooth } from './util.js';
import { TYPES } from './fractals/types.js';
import { isExt, ptrs, st } from './state.js';
import { hexRGB, minus } from './color/palettes.js';
import { ctxLost, gl, glc, octx, refSlots } from './render/webgl.js';
import { cssH, cssW, deepT, extT, minScale, moveCentre, ovScale, runGrid, sizeBuffers, startGrid, touch } from './view.js';
import { drawBlit, grabFrame, render2DAll } from './render/bla.js';
import { notAvail } from './ui/notice.js';
import { budDraw, budStep } from './modes/buddhabrot.js';
import { d3Extra, d3MinDist, dive3UI, nestDive, nestIn, nestOut, nestStraight, render3D, retarget3, setDive3, start3Warp, syncT3 } from './modes/fractal3d.js';
import { GROW, GROW_END, drawGrow, fern, growTotal } from './modes/grow.js';
import { drawOrbit, newOrbit, orbitIdx } from './modes/orbit.js';
import { drawCentreMark, drawLink, drawTapMark, pathC } from './modes/julia-link.js';
import { drawInsets } from './ui/insets.js';
import { refreshLegend, updateDynamic } from './ui/learn.js';
import { advanceFly, bsSweep, diveUI, endlessWarp, pwSweep, syncR4, syncW, twAmp } from './ui/controls.js';
import { writeHash } from './io/share.js';
import { BeatGate, Groove, Phase, colourStep, cycleBeats, energyMul, pulse, reacting, voice } from '../../js/shell/audio/react.js';
import { recFrame } from './io/recorder.js';

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
  if (!ptrs.size && Math.abs(shared.vel3.x)+Math.abs(shared.vel3.y)>0.05){ D.yaw-=shared.vel3.x*0.008; D.pitch=clamp(D.pitch+shared.vel3.y*0.008,-1.45,1.45); shared.vel3.x*=0.9; shared.vel3.y*=0.9; moving=true; }
  if (D.turn && !D.target){ D.yaw+=clk.yaw.delta(dt, 0.3*D.turn, 0.15*D.turn); moving=true; }
  if (D.aim){ const A=D.aim; A.t+=dt/0.8; const u=clamp(A.t,0,1), e=smooth(u); moving=true;
    D.target=[0,1,2].map(i=>lerp(A.T0[i],A.T1[i],e)); D.yaw=lerp(A.y0,A.y1,e); D.pitch=lerp(A.p0,A.p1,e); D.dist=Math.exp(lerp(A.l0,A.l1,e));
    if (u>=1){ D.aim=null; if (st.endless || D.dive){ D.dive=true; D.extra=d3Extra(); dive3UI(); } } }
  if (D.needAim){ D.aimT-=dt; if (!ptrs.size || D.aimT<=0){ D.aimT=0.15; D.needAim=false; const ok=retarget3(); if (!ok) D.floating=true; } moving=true; }
  if (D.dive && !D.floating && !D.aim){ const mn=d3MinDist(); D.dist=Math.max(mn, D.dist*Math.exp(-dt*st.diveSpeed*0.3*diveEnergy())); moving=true;
    const x=d3Extra(); if (x!==D.extra){ D.extra=x; retarget3(); }
    if (D.dist<=mn*1.0001){ if (st.endless) start3Warp('floor'); else setDive3(false); } }
  if (D.warp){ const W=D.warp; W.t+=dt; const u=clamp(W.t/W.dur,0,1), e=smooth(u); moving=true;
    D.dist=Math.exp(lerp(W.ls0,W.ls1,e)); D.target=[0,1,2].map(i=>lerp(W.T0[i],0,smooth(clamp((u-0.4)/0.6,0,1)))); D.yaw=lerp(W.y0,W.y1,e); D.pitch=lerp(W.p0,W.p1,e);
    if (u>=1){ D.warp=null; D.target=null; D.trip=(D.trip||1)+1; let ok=false;
      for (let k=0;k<8 && !ok;k++){ ok=retarget3(); if (!ok){ D.yaw+=0.7; D.pitch=clamp(D.pitch+0.25*(Math.random()-0.5),-0.6,0.9); } }
      if (D.shape==='nest'){ D.target=[0,0,0]; nestDive(); } else if (ok){ D.dive=true; D.extra=d3Extra(); } else { D.target=null; D.dive=false; } dive3UI(); } }
  if (D.breathe && D.shape==='bulb'){ D.t=clk.breathe.step(D.t, dt, 2*Math.PI/0.22, cycleBeats(1)); { const [c,a]=pwSweep(); D.power=c+a*Math.sin(D.t*0.22); } $('pw3').value=D.power; $('pw3o').textContent=D.power.toFixed(1); moving=true; }
  if (D.bsBreathe && D.shape==='box'){ D.bsT=clk.box.step(D.bsT, dt, 2*Math.PI/0.3, cycleBeats(1)); { const [c,a]=bsSweep(); D.boxS=c+a*Math.sin(D.bsT*0.3); } $('bs3').value=D.boxS; $('bs3o').textContent=minus(D.boxS.toFixed(2)); moving=true; }
  if (D.spin3){ const wrap=a=>((a+180)%360+360)%360-180; const g=clk.spin3.delta(dt, 1, 0.5); D.rxy=wrap(D.rxy+g*9); D.rxz=wrap(D.rxz+g*13); D.ryz=wrap(D.ryz+g*6); if (frameN%3===0) syncT3(); moving=true; }
  if (D.twAnim){ D.twT=clk.twist.step(D.twT, dt, 2*Math.PI/0.25, cycleBeats(2)); D.twist=(D.twSg||1)*twAmp()*(1+Math.sin(D.twT*0.25)); $('tw3').value=D.twist; $('tw3o').textContent=D.twist.toFixed(1)+'°'; moving=true; }
  if (D.sweep){ D.wt=clk.sweep.step(D.wt, dt, 2*Math.PI/0.45, cycleBeats(1)); D.w=0.94*Math.sin(D.wt*0.45); syncW(); moving=true; }
  if (D.spin4){ D.spT+=dt; const wrap=a=>((a+180)%360+360)%360-180, g=clk.spin4.delta(dt, 1, 0.5); D.axw=wrap(D.axw+g*11); D.ayw=wrap(D.ayw+g*7); D.azw=wrap(D.azw+g*4.5); if (frameN%3===0) syncR4(); moving=true; }
  if (reacting()) moving=true;   // the music bends the shape every frame (see render3D)
  return moving; }
// Choose between full rate and every other refresh, and nudge render quality only when clearly needed, in small steps,
// so the picture doesn't keep sharpening and softening. Quality is the render scale (cost grows with its square).
function adjustPace(now, qMax, dtMs){
  const full=pace.vsync, half=2*pace.vsync;
  if (pace.probeN>0){   // trying full rate: measure what a frame really costs (raw frame times, after a few to settle)
    if (pace.probeN<=16) pace.probeT+=dtMs; if (--pace.probeN>0) return;
    pace.cost=pace.probeT/16;
    if (pace.cost<full*1.15){ pace.every=1; }
    else { pace.every=2; if (pace.cost<half*0.75) st.q=Math.min(qMax,st.q*1.05); else if (pace.cost>half*1.05) st.q=Math.max(0.3,st.q*0.92); }
    pace.probeAt=now+8000; dtAvg=pace.every===1?full:half; return;
  }
  if (frameN%10) return;
  if (pace.every===1){
    // can't hold full rate: go to an even half rate. (At full rate frames wait for the screen, so spare time can't be
    // seen here; quality only rises after a half-rate check has measured real headroom.)
    if (dtAvg>full*1.3){ pace.every=2; dtAvg=half; pace.probeAt=now+4000; }
  } else {
    if (dtAvg>half*1.2) st.q=Math.max(0.3,st.q*0.92);                              // even half rate is too much: soften a little
    else if (now>pace.probeAt){ pace.probeN=20; pace.probeT=0; pace.every=1; }      // time to check for headroom
  }
}
// the shell starts and stops the loop as this explorer comes on and off screen
let running=false;
export function startLoop(){ if (running) return; running=true; tPrev=performance.now(); requestAnimationFrame(loop); }
export function stopLoop(){ running=false; }
const diveEnergy=()=>clamp(energyMul(),0.8,1.2);
export function loop(now){
  if (!running) return;
  { const gap=now-pace.lastRaf; pace.lastRaf=now; if (gap>4 && gap<25) pace.vsync+=(gap-pace.vsync)*0.05; }
  if (pace.every===2 && now-pace.lastDraw < pace.vsync*1.5){ requestAnimationFrame(loop); return; }   // skip this refresh
  pace.lastDraw=now; if (pace.simulate) pace.simulate();
  const dt=clamp((now-tPrev)/1000,0,0.12); tPrev=now;   // the first frame's timestamp can be slightly earlier than start-up
  let anim=false;
  { const c=colourStep(dt); if (c){ st.cycle=(st.cycle+c)%1; if (frameN%10===0) refreshLegend(); } if (reacting() && st.mode!=='grow') anim=true; }
  if (st.cycleSpeed>0){ st.cycle=(st.cycle+dt*st.cycleSpeed*0.06)%1; anim=true; if (frameN%10===0) refreshLegend(); }
  if (ptrs.size) anim=true;
  if (st.mode==='explore'){ if (st.fly){ advanceFly(dt); anim=true; } else if (st.dive){ const v=st.vE, ms=minScale(st.type);
    st.manualT-=dt;
    if (st.steer){ if (!shared.gridJob) startGrid('steer'); runGrid(5); }
    if (st.steerTo){ const sc=v.scale, man=st.manualT>0, gain=man?1.8:0.9, mxv=man?1.0:st.steerCentreIn?0.9:0.45; let tx=st.steerTo[0]/sc*gain, ty=st.steerTo[1]/sc*gain; const m=Math.hypot(tx,ty); if (m>mxv){ tx*=mxv/m; ty*=mxv/m; }
      const k=1-Math.exp(-dt/(man?0.3:0.6)); st.vel=[st.vel[0]+(tx-st.vel[0])*k, st.vel[1]+(ty-st.vel[1])*k];
      const mx=st.vel[0]*sc*dt, my=st.vel[1]*sc*dt; moveCentre(v,mx,my); st.steerTo=[st.steerTo[0]-mx, st.steerTo[1]-my]; }
    // Zoom: at the default 0.5× the picture doubles in size about every 3.5 s. While the middle is still in the black, ease
    // off so the steering can reach the edge first. The music's energy only nudges it (diving is easy to overdo).
    v.scale=Math.max(ms, v.scale*Math.exp(-dt*st.diveSpeed*0.4*diveEnergy()*(st.steer&&st.steerCentreIn&&st.steerInside>0.55?0.5:1)));
    if (v.scale<=ms){ if (st.endless) endlessWarp('floor'); else { st.dive=false; diveUI(); } }
    else if (st.endless && st.insideT>2.2) endlessWarp('inside');
    anim=true; } }
  if (st.mode==='link' && st.link.auto && !notAvail()){ st.link.t=clk.link.step(st.link.t, dt, 2*Math.PI, cycleBeats(4), 0.15); const c=pathC(st.link.t), k=1+0.035*pulse()+0.015*voice(); st.jc=[c[0]*k, c[1]*k]; anim=true; }
  if (st.mode==='explore' && TYPES[st.type].cpu) budStep();
  if (st.mode==='explore' && deepT() && !(st.dive && st.steer)){ st.probeT-=dt;
    if (st.probeT<=0 && !shared.gridJob){ st.probeT=0.6; if (st.vE.scale<=1e-5 && refSlots[0].d64) startGrid('probe'); else if (st.iterNeed){ st.iterNeed=0; touch(); } }
    runGrid(4); }
  if (st.mode==='orbit' && st.orbit.playing && st.orbit.data && !notAvail()){ st.orbit.t+=clk.orbit.delta(dt, 1, st.orbit.step, true); const D=st.orbit.data, onBeat=clk.orbitGate.crossed();   // with the music: one step per beat, and a new point starts on a beat
    if (st.orbit.auto && orbitIdx(st.orbit.t)>D.show+8 && (onBeat || clk.orbitGate.last===null)) newOrbit(); }
  if (st.mode==='grow'){ const sh=GROW[st.grow.shape]; if (st.grow.zoom && sh.zoom){ st.grow.zph=(st.grow.zph+dt*0.35)%1; } else if (st.grow.playing){ st.grow.t+=clk.grow.delta(dt, 1, 0.5); if (st.grow.t>growTotal(sh)+GROW_END){ st.grow.t=0; fern.n=1e12; } } }
  if (st.mode==='d3') anim=advance3D(dt)||anim;
  let goHQ=false;
  if (st.mode!=='grow' && !notAvail()){      // drop resolution while moving if frames get slow; full quality once still
    const qMax = st.mode==='d3' ? 0.85 : 1;
    if (anim || shared.dirty){ if (shared.hqShown || st.prog){ st.q=Math.min(qMax, st.qMove||qMax); shared.hqShown=false; } st.prog=null;
      if (anim){ dtAvg=dtAvg*0.9+dt*1000*0.1; adjustPace(now, qMax, dt*1000); }
      lastStill=now; }
    else if (!shared.hqShown && !st.prog && now-lastStill>240){ st.qMove=st.q; st.q=1; goHQ=true; pace.every=1; pace.probeN=0; } }
  const progHQ = goHQ && st.mode==='explore' && extT() && isExt() && st.vE.scale<1e-20;
  if (progHQ && !ctxLost) grabFrame();
  sizeBuffers();
  if (!ctxLost){
    if (notAvail()){ const b=hexRGB(st.bg); gl.viewport(0,0,glc.width,glc.height); gl.clearColor(b[0],b[1],b[2],1); gl.clear(gl.COLOR_BUFFER_BIT); }
    else if (st.mode==='grow'){ if (shared.dirty){ const b=hexRGB(st.bg); gl.viewport(0,0,glc.width,glc.height); gl.clearColor(b[0],b[1],b[2],1); gl.clear(gl.COLOR_BUFFER_BIT); } }
    else if (goHQ && progHQ){ drawBlit(); st.prog={y:0, strip:24}; }
    else if (goHQ){ if (st.mode==='d3') render3D(true); else render2DAll(true); shared.hqShown=true; }
    else if (st.prog){ const P=st.prog, y1=Math.min(glc.height, P.y+P.strip); render2DAll(true,[P.y,y1]); P.y=y1;
      if (dt<0.03) P.strip=Math.min(1024,Math.ceil(P.strip*1.5)); else if (dt>0.06) P.strip=Math.max(8,Math.floor(P.strip/2));
      if (P.y>=glc.height){ st.prog=null; shared.hqShown=true; } }
    else if (anim || shared.dirty){ if (st.mode==='d3') render3D(false); else render2DAll(false); }
  }
  octx.setTransform(ovScale,0,0,ovScale,0,0);
  if (st.mode==='grow') drawGrow();
  else { octx.clearRect(0,0,cssW,cssH); if (!notAvail()){ if (st.mode==='orbit') drawOrbit(); else if (st.mode==='link') drawLink(); else if (st.mode==='explore' && TYPES[st.type].cpu) budDraw(); else if (st.mode==='explore'){ drawCentreMark(); drawTapMark(); } else if (st.mode==='d3') drawTapMark(); } }
  drawInsets(); recFrame(); shared.dirty=false;
  frameN++; if (frameN%6===0) updateDynamic();
  if (now-shared.hashT>1000){ shared.hashT=now; writeHash(false); }
  requestAnimationFrame(loop);
}
