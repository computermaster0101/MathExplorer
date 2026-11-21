import * as THREE from 'three';
import { $ } from '../util.js';
import { st } from '../state.js';
import { camera } from '../render/scene.js';
import { rotatePivot, setZoomZ } from './orbit.js';
import { drive } from '../../../js/shell/keys.js';

// ---------- driving with the keys, and flying through the shape ----------
// Not flying: the arrows turn the shape (like dragging) and W A S D slide the view. G flies in: the camera leaves its spot on
// the axis and moves forward on its own; the arrows turn it in place, W A S D slide it, + and − set the speed and Shift is
// three times faster. Flight slows near the middle, so you can thread between edges and through cells. If you drift out
// the far side without steering, it turns gently back toward a spot near the middle and flies in again, so it never runs
// out. G again, or Reset view, puts the camera back where it was.
export const fly={ on:false, speed:1, z0:8.5, aim:null };
const fwd=new THREE.Vector3(), toAim=new THREE.Vector3(), m4=new THREE.Matrix4(), qAim=new THREE.Quaternion();
export function flyUI(){ const b=$('flyBtn'); if (b){ b.textContent=fly.on?'Stop flying':'Fly in'; b.classList.toggle('on', fly.on); } }
export function startFly(){ if (fly.on) return; fly.on=true; fly.aim=null; fly.z0=camera.position.z; camera.position.x=camera.position.y=0; camera.quaternion.identity(); flyUI(); }
export function stopFly(){ if (!fly.on) return; fly.on=false; camera.quaternion.identity(); camera.position.set(0,0,fly.z0); setZoomZ(fly.z0); flyUI(); }
export const toggleFly=()=>(fly.on ? stopFly() : startFly());
/** Speed up (f > 1) or slow down while flying. */
export function flySpeed(f){ fly.speed=Math.min(6, Math.max(0.2, fly.speed*f)); }
/** Every frame: apply the held keys, and move forward while flying (not while paused). Returns true if anything moved. */
export function driveStep(dt){
  const k=drive(), f=k.fast?3:1;
  if (!fly.on){ if (!k.any) return false;
    if (k.turnX||k.turnY) rotatePivot(k.turnX*1.3*f*dt, -k.turnY*1.1*f*dt);   // like dragging: → turns it right, ↑ tips it up
    if (k.slideX||k.slideY){ const z=camera.position.z, v=0.45*z*f*dt, lim=0.6*z;
      camera.position.x=Math.max(-lim, Math.min(lim, camera.position.x+k.slideX*v)); camera.position.y=Math.max(-lim, Math.min(lim, camera.position.y+k.slideY*v)); }
    return true; }
  const r=camera.position.length(), v=fly.speed*(0.12+0.28*r)*f;   // slower near the middle
  if (k.turnX) camera.rotateY(-k.turnX*1.1*f*dt);
  if (k.turnY) camera.rotateX(k.turnY*0.9*f*dt);
  if (k.slideX) camera.translateX(k.slideX*v*dt*1.2);
  if (k.slideY) camera.translateY(k.slideY*v*dt*1.2);
  if (st.paused) return k.any;
  camera.translateZ(-v*dt);
  // flown out the far side and not steering: turn back toward a spot near the middle
  camera.getWorldDirection(fwd);
  if (!k.recent && r>2.2 && fwd.dot(camera.position)>0 && !fly.aim) fly.aim=new THREE.Vector3((Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6);
  if (fly.aim){ if (k.recent){ fly.aim=null; } else {
    m4.lookAt(camera.position, fly.aim, camera.up); qAim.setFromRotationMatrix(m4); camera.quaternion.slerp(qAim, 1-Math.exp(-dt*1.4));
    toAim.copy(fly.aim).sub(camera.position).normalize(); if (fwd.dot(toAim)>0.985) fly.aim=null; } }
  return true; }
