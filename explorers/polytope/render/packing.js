import * as THREE from 'three';
import { shared } from '../shared.js';
import { st } from '../state.js';
import { wColor } from './colour.js';
import { fit } from './scene.js';
import { mulM, rot4 } from '../math/rotate4d.js';

// ---------- the Apollonian packing drawn as balls ----------
// Each ball is a cap on the 3-sphere: centre n, angular radius r (kept as cos r = c, sin r = s). Stereographic projection
// from the pole (0,0,0,1) sends it to an exact round ball in 3D. With A = n_w − c:
//   A < 0: an ordinary ball, centre n_xyz / −A, radius s / −A;
//   A > 0: the cap holds the pole, so it turns inside out: everything outside a sphere of that centre and radius
//          (that ball is the container, drawn as a faint glass shell);
//   A ≈ 0: the cap's edge passes through the pole and it becomes a flat wall (too big to draw).
// Projected points use the explorer's usual stereographic scale (a point with W = 0 lands at distance 1).
const MAX_R=40;   // anything bigger is effectively a flat wall: skip it
let mesh=null, cap=0, shell=null;
const tmpM=new THREE.Matrix4(), tmpC=new THREE.Color();
function ensure(n){
  if (n<=cap && mesh) return; if (mesh){ fit.remove(mesh); mesh.geometry.dispose(); }
  cap=Math.max(n, 64); mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1, 32, 22), shared.ballMat, cap); mesh.frustumCulled=false;
  for (let i=0;i<cap;i++) mesh.setColorAt(i, tmpC.setRGB(1,1,1)); fit.add(mesh);
  if (!shell){ shell=new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), new THREE.MeshPhongMaterial({color:0xdfe8ff, transparent:true, opacity:0.1, side:THREE.BackSide, depthWrite:false, shininess:90}));
    shell.frustumCulled=false; shell.renderOrder=4; fit.add(shell); }
}
export function hidePacking(){ if (mesh) mesh.visible=false; if (shell) shell.visible=false; }
/** Draw the packing's balls for the current 4D turn. Returns the drawn balls (for the 3D print) and how far out they reach. */
export function drawPacking(sh){
  ensure(sh.caps.length); mesh.visible=true; mesh.material=shared.ballMat;
  const M=rot4(), balls=[], gmax=Math.max(1, sh.gens); let bound=0, k=0, container=null;
  for (const q of sh.caps){ const n=mulM(M, q.n), A=n[3]-q.c;
    if (Math.abs(A)<1e-9) continue;
    const R=q.s/Math.abs(A), c=[-n[0]/A, -n[1]/A, -n[2]/A];
    if (A>0){ container={c, r:R}; continue; }
    if (R>MAX_R) continue;
    const col=wColor(-0.9+1.8*q.gen/gmax);
    tmpM.makeScale(R,R,R).setPosition(c[0],c[1],c[2]); mesh.setMatrixAt(k, tmpM); mesh.setColorAt(k, tmpC.setRGB(col[0],col[1],col[2])); k++;
    balls.push({c, r:R, col});
    if (R<4){ const d=Math.hypot(c[0],c[1],c[2])+R; if (d>bound) bound=d; } }   // fit the view to the balls, not to giant ones near the pole
  mesh.count=k; mesh.instanceMatrix.needsUpdate=true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
  if (container && container.r<MAX_R){ shell.visible=true; shell.scale.setScalar(container.r); shell.position.set(...container.c);
    if (container.r<6) bound=Math.max(bound, Math.hypot(...container.c)+container.r); }
  else shell.visible=false;
  return { bound:Math.min(Math.max(bound,0.5), 6), balls, container };
}
