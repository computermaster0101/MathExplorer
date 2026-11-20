import * as THREE from 'three';
import { $ } from '../util.js';
import { st } from '../state.js';
import { camera, canvas, pivot } from '../render/scene.js';

// ---------- orbit (drag / pinch / wheel) ----------
export const pointers=new Map(); let lastPinch=0; export const vel={x:0,y:0};
canvas.addEventListener('pointerdown', e=>{ canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); });
canvas.addEventListener('pointermove', e=>{
  if (!pointers.has(e.pointerId)) return;
  const prev=pointers.get(e.pointerId); pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if (pointers.size===1){ const dx=(e.clientX-prev.x)*0.008, dy=(e.clientY-prev.y)*0.008; rotatePivot(dx,dy); vel.x=dx; vel.y=dy; }
  else if (pointers.size===2){ const [a,b]=[...pointers.values()], d=Math.hypot(a.x-b.x,a.y-b.y); if (lastPinch) zoom(lastPinch/d); lastPinch=d; }
});
const endP=e=>{ pointers.delete(e.pointerId); if (pointers.size<2) lastPinch=0; };
canvas.addEventListener('pointerup', endP); canvas.addEventListener('pointercancel', endP);
canvas.addEventListener('wheel', e=>{ e.preventDefault(); zoom(Math.exp(e.deltaY*0.001)); }, {passive:false});
export const qx=new THREE.Quaternion(), qy=new THREE.Quaternion(), UP=new THREE.Vector3(0,1,0), XA=new THREE.Vector3(1,0,0);
export function rotatePivot(dx,dy){ qy.setFromAxisAngle(UP,dx); qx.setFromAxisAngle(XA,dy); pivot.quaternion.premultiply(qy).premultiply(qx); }
export function setZoomZ(z){ camera.position.z=Math.min(8.5,Math.max(1.62,z)); const zf=3.4/camera.position.z; $('zoom').value=zf; $('zoomo').textContent=zf.toFixed(1)+'×'; }
function zoom(f){ setZoomZ(camera.position.z*f); }
$('zoom').addEventListener('input', e=>setZoomZ(3.4/(+e.target.value)));
$('turn').addEventListener('input', e=>{ st.turn=+e.target.value; $('turno').textContent=st.turn?st.turn.toFixed(1)+'×':'off'; });
