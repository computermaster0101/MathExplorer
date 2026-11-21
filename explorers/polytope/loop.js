import { BeatGate, Groove, Phase, colourStep, cycleBeats, flash, pulse, voice } from '../../js/shell/audio/react.js';
import { shared } from './shared.js';
import { $ } from './util.js';
import { st } from './state.js';
import { wColor } from './render/colour.js';
import { SHAPES } from './geometry/polytopes.js';
import { camera, canvas, pivot, renderer, setFlash } from './render/scene.js';
import { renderView } from './render/stereo.js';
import { UP, pointers, rotatePivot, vel } from './input/orbit.js';
import { driveStep } from './input/fly.js';
import { setPausedTag } from '../../js/shell/keys.js';
import { newPing, pingData, pingPhase, updateGeometry } from './modes/ping.js';
import { drawInset, drawShadow } from './panels/cousin-inset.js';
import { drawFlat, drawSliceView } from './panels/extra-panels.js';
import { notAvail, refreshColours, updateDynamic } from './ui/text.js';
import { updatePrintNote } from './io/export.js';
import { syncAngles, unfLabel } from './ui/controls.js';
import { applyMorph, morphAnim, morphFam, unfCurve, wrap } from './ui/learn.js';

// ---------- loop ----------
// motion clocks: with the music's tempo locked, turning surges on each beat, the knife sweeps across whole bars and ping steps land on beats
const clk={ spin:new Groove(), turn:new Groove(), morph:new Groove(), sweep:new Phase(), build:new Groove(), unf:new Groove(), ping:new Groove(), pingGate:new BeatGate() };
export function resize(){ const r=canvas.parentElement.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect=r.width/r.height; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(canvas.parentElement);
let t0=performance.now(), frameN=0;
// the shell starts and stops the loop as this explorer comes on and off screen
let running=false;
export function startLoop(){ if (running) return; running=true; t0=performance.now(); requestAnimationFrame(loop); }
export function stopLoop(){ running=false; }
export function loop(now){
  if (!running) return;
  const dt=Math.min(0.05,(now-t0)/1000); t0=now; setPausedTag(st.paused); const go=!st.paused;   // Space pauses every motion below
  if (go && (st.mode==='explore' || st.mode==='ping' || (st.mode==='slice' && st.sliceSpin)) && st.spin){
    const g=clk.spin.delta(dt, 1, 0.5);   // seconds' worth of turning: real seconds, or half a second per beat with the music
    if (st.spinStyle==='double'){ st.xy=wrap(st.xy+20*st.speed*g); st.zw=wrap(st.zw+20*st.speed*g); }
    else { st.xw=wrap(st.xw+22*st.speed*g); st.zw=wrap(st.zw+13*st.speed*g); }
    const vo=voice(); if (vo) st.yw=wrap(st.yw+25*vo*dt);   // vocals and melody sway the shape back and forth through a third 4D plane
    if (morphAnim && st.shape==='morph' && (st.mode==='explore'||st.mode==='ping') && (shared.morphT+=clk.morph.delta(dt, 1, 0.5))>(morphFam==='h4'?0.12:0.05)){ shared.morphT=0; const el=$('morphS'); let v=+el.value+shared.morphDir*(morphFam==='h4'?0.03:0.012); if (v>=3||v<=0){ shared.morphDir=-shared.morphDir; v=Math.max(0,Math.min(3,v)); } el.value=v; applyMorph(false); }
    if (SHAPES[st.shape].highD && st.mode!=='slice') st.hdA+=g*st.speed*0.35;   // and through the higher dimensions
    syncAngles();
  }
  const cs=go ? colourStep(dt) : 0;   // the music: treble shimmer, and a shift of the palette on each new bar
  if ((go && st.cycleSpeed>0) || cs){ st.cycle=(st.cycle+dt*st.cycleSpeed*0.06+cs)%1; shared.DIRCOL=[0,1,2,3].map(i=>wColor(-0.92+i*0.613)); shared.SOLID=wColor(0.35); shared.CELLCOL=[0,1,2,3,4,5,6,7].map(i=>wColor(-1+2*i/7)); if (st.ping.cache) st.ping.cache.RC=new Map(); if (frameN%10===0) refreshColours(); }
  if (shared.knifeAnim) shared.knifeAnim.t+=dt/1.1;
  if (go && st.mode==='slice' && st.sweep){ st.sweepT=clk.sweep.step(st.sweepT, dt, 2*Math.PI, cycleBeats(1), 0.6); st.knifeU=Math.sin(st.sweepT); $('knife').value=Math.round(st.knifeU*100); }
  if (go && st.mode==='build' && st.build.playing) st.build.t+=clk.build.delta(dt, 1, 0.5);
  if (go && st.mode==='ping' && st.ping.playing){ st.ping.t+=clk.ping.delta(dt, 1, st.ping.step, true); const D=pingData(), onBeat=clk.pingGate.crossed();   // with the music: one step per beat, new pings start on a beat
    if (st.ping.auto && st.ping.t/st.ping.step > pingPhase().end && (onBeat || clk.pingGate.last===null)) newPing(); }
  if (go && st.mode==='unfold' && st.unf.playing){ st.unf.t+=clk.unf.delta(dt, 1, 0.5); [st.unf.u, st.unf.f]=unfCurve(st.unf.t); unfLabel(); }
  if (go && st.turn && !st.turnHold && !pointers.size) pivot.rotateOnWorldAxis(UP, clk.turn.delta(dt, 0.35*st.turn, 0.175*st.turn));
  if (!pointers.size && (Math.abs(vel.x)+Math.abs(vel.y)>1e-5)){ rotatePivot(vel.x,vel.y); vel.x*=0.93; vel.y*=0.93; }
  driveStep(dt);   // the arrows and W A S D, and flying
  pivot.scale.setScalar(1+0.05*pulse()); setFlash(flash());   // on each beat: pulse the shape, or flash the lights
  if (notAvail()){ pivot.visible=false; for (const c of document.querySelectorAll('#insets canvas')) c.style.display='none'; }
  else { pivot.visible=true; updateGeometry(); drawSliceView(); drawFlat(); drawInset(); drawShadow(); }
  frameN++; if (frameN%6===0) updateDynamic(); if (frameN%12===0) updatePrintNote();
  renderView();
  requestAnimationFrame(loop);
}
