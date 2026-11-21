import * as THREE from 'three';
import { shared } from '../shared.js';
import { st } from '../state.js';
import { wColor } from './colour.js';
import { camera, fit } from './scene.js';
import { mulM, rot4 } from '../math/rotate4d.js';

// ---------- balls on the 3-sphere, drawn exactly ----------
// Used by the Apollonian packing, and by "touching balls" for any polytope (a ball at every corner, just big enough to touch
// its nearest neighbours). Each ball is a cap on the 3-sphere: centre n, angular radius r (kept as cos r = c, sin r = s).
// Stereographic projection from the pole (0,0,0,1) sends it to an exact round ball in 3D. With A = n_w − c:
//   A < 0: an ordinary ball, centre n_xyz / −A, radius s / −A;
//   A > 0: the cap holds the pole, so it turns inside out: everything outside a sphere of that centre and radius
//          (that ball is the container, drawn as a faint glass shell);
//   A ≈ 0: the cap's edge passes through the pole and it becomes a flat wall (too big to draw).
// Projected points use the explorer's usual stereographic scale (a point with W = 0 lands at distance 1).
const MAX_R=40, KISS_MAX=2500;   // bigger than MAX_R is effectively a flat wall; corner balls only for shapes up to KISS_MAX corners
// A ball near the projection point swells towards infinity on its way to becoming the container. Past BIG it would fill the
// view, so it's drawn like the container, as a faint glass shell: you still see it swell, but it can't block everything.
const BIG=2.5, SHELLS=4;
let mesh=null, cap=0; const shells=[];
const tmpM=new THREE.Matrix4(), tmpC=new THREE.Color(), camL=new THREE.Vector3();
/** Can this shape be drawn as touching balls at its corners? */
export const kissOK=sh=>!sh.round && !sh.highD && sh.verts.length<=KISS_MAX && sh.verts.every(v=>Math.abs(Math.hypot(...v)-1)<1e-6);
/** The balls to draw: the packing's own, or one per corner with radius half the smallest gap between corners (cached). */
export function capsFor(sh){
  if (sh.packing) return sh.caps;
  if (sh._kiss) return sh._kiss;
  const V=sh.verts; let m=-1;   // the largest dot product between two corners = the closest pair
  for (let i=0;i<V.length;i++){ const a=V[i]; for (let j=i+1;j<V.length;j++){ const b=V[j], d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]; if (d>m) m=d; } }
  const r=Math.acos(Math.min(1,m))/2, c=Math.cos(r), s=Math.sin(r);
  let touch=0; for (let i=0;i<V.length;i++){ const a=V[i]; for (let j=0;j<V.length;j++){ if (i===j) continue; const b=V[j]; if (a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]>m-1e-6) touch++; } }
  sh._kissN=touch/V.length;   // how many neighbours each ball touches, on average
  return sh._kiss=V.map(v=>({ n:v, c, s, w0:v[3] }));
}
function ensure(n){
  if (n<=cap && mesh) return; if (mesh){ fit.remove(mesh); mesh.geometry.dispose(); }
  cap=Math.max(n, 64); mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1, 32, 22), shared.ballMat, cap); mesh.frustumCulled=false;
  for (let i=0;i<cap;i++) mesh.setColorAt(i, tmpC.setRGB(1,1,1)); fit.add(mesh);
  if (!shells.length){ const geo=new THREE.SphereGeometry(1, 64, 40);
    for (let i=0;i<SHELLS;i++){ const m=new THREE.Mesh(geo, new THREE.MeshPhongMaterial({color:0xdfe8ff, transparent:true, opacity:0.1, side:THREE.BackSide, depthWrite:false, shininess:90}));
      m.frustumCulled=false; m.renderOrder=4; m.visible=false; fit.add(m); shells.push(m); } }
}
export function hidePacking(){ if (mesh) mesh.visible=false; for (const m of shells) m.visible=false; }
/** Draw the shape's balls for the current 4D turn. Returns the drawn balls (for the 3D print) and how far out they reach. */
export function drawPacking(sh){
  const caps=capsFor(sh); ensure(caps.length); mesh.visible=true; mesh.material=shared.ballMat;
  const M=rot4(), balls=[], big=[], gmax=Math.max(1, sh.gens||1); let bound=0, container=null;
  for (const q of caps){ const n=mulM(M, q.n), A=n[3]-q.c;
    if (Math.abs(A)<1e-9) continue;
    const R=q.s/Math.abs(A), c=[-n[0]/A, -n[1]/A, -n[2]/A];
    if (A>0){ container={c, r:R}; continue; }
    if (R>MAX_R) continue;
    if (R>BIG){ big.push({c, r:R}); continue; }
    balls.push({c, r:R, col: sh.packing ? wColor(-0.9+1.8*q.gen/gmax) : wColor(q.w0)});   // the packing by filling round, corners by W
    const d=Math.hypot(c[0],c[1],c[2])+R; if (d>bound) bound=d; }   // fit the view to the solid balls, not to the giant ones near the pole
  // see-through balls must be drawn from the back forward
  if (shared.ballMat.transparent){ fit.updateMatrixWorld(); camL.copy(camera.position); fit.worldToLocal(camL);
    const d2=b=>(b.c[0]-camL.x)**2+(b.c[1]-camL.y)**2+(b.c[2]-camL.z)**2; balls.sort((a,b)=>d2(b)-d2(a)); }
  balls.forEach((b,k)=>{ tmpM.makeScale(b.r,b.r,b.r).setPosition(b.c[0],b.c[1],b.c[2]); mesh.setMatrixAt(k, tmpM); mesh.setColorAt(k, tmpC.setRGB(b.col[0],b.col[1],b.col[2])); });
  mesh.count=balls.length; mesh.instanceMatrix.needsUpdate=true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
  // glass shells: the container (seen from inside) and any giant balls (seen from outside), the biggest first
  const glass=[...(container && container.r<MAX_R ? [{...container, inside:true}] : []), ...big.sort((a,b)=>b.r-a.r)].slice(0,SHELLS);
  shells.forEach((m,i)=>{ const q=glass[i]; m.visible=!!q; if (!q) return; m.scale.setScalar(q.r); m.position.set(...q.c);
    m.material.side=q.inside ? THREE.BackSide : THREE.DoubleSide; m.material.opacity=q.inside ? 0.1 : 0.07; });
  if (container && container.r<6) bound=Math.max(bound, Math.hypot(...container.c)+container.r);
  return { bound:Math.min(Math.max(bound,0.5), 6), balls, container };   // the print gets the solid balls only, like the view
}
