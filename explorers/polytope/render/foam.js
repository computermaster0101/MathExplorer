import * as THREE from 'three';
import { wColor } from './colour.js';
import { bubbleMaterial, camera, fit } from './scene.js';
import { facePolys } from '../geometry/faces.js';
import { rot4 } from '../math/rotate4d.js';

// ---------- bubble foam: every face as a curved soap film ----------
// A flat face of a polytope on the 3-sphere, pushed out onto the 3-sphere, lies on a great sphere: the 3-sphere cut by the
// 3D slice through the centre that holds the face. Stereographic projection sends a great sphere to an ordinary sphere in 3D
// (or a flat plane, when it passes through the projection point). So each face is drawn as a patch of an exact sphere, and the
// whole polytope becomes a cluster of soap bubbles stuck together, the way real foam meets in curved films.
// Each face is cut into a fan of triangles from its middle, each triangle cut again into k×k, and every point pushed onto the
// 3-sphere. That part doesn't depend on the 4D turn, so it's done once per shape; each frame only turns and projects the points.
// The surface direction comes from the face's sphere, so the films shade smoothly.
const MAX_F=6000, TARGET=60000;   // most faces drawn; about how many small triangles to aim for
/** Can this shape be drawn as bubble foam? */
export const foamOK=sh=>!sh.round && !sh.highD && sh.verts.every(v=>Math.abs(Math.hypot(...v)-1)<1e-6) && facePolys(sh).length>0 && facePolys(sh).length<=MAX_F;
const mat=bubbleMaterial(true), camL=new THREE.Vector3();
let mesh=null, built=null;
export function hideFoam(){ if (mesh) mesh.visible=false; }
// the unit 4-vector at right angles to three points (the 3D slice through the centre that holds them)
function perp4(a,b,c){
  const m=(i,j,k)=>a[i]*(b[j]*c[k]-b[k]*c[j])-a[j]*(b[i]*c[k]-b[k]*c[i])+a[k]*(b[i]*c[j]-b[j]*c[i]);
  const n=[ m(1,2,3), -m(0,2,3), m(0,1,3), -m(0,1,2)], l=Math.hypot(...n)||1; return n.map(x=>x/l); }
const unit=v=>{ const l=Math.hypot(v[0],v[1],v[2],v[3]); return [v[0]/l,v[1]/l,v[2]/l,v[3]/l]; };
// once per shape: the points of every face on the 3-sphere, and each face's triangles
function build(sh){
  const F=facePolys(sh), V=sh.verts, sides=F.reduce((s,f)=>s+f.length,0), k=Math.max(1, Math.min(6, Math.round(Math.sqrt(TARGET/Math.max(1,sides)))));
  const per=(k+1)*(k+2)/2, P=new Float64Array(sides*per*4), faces=[]; let np=0;
  for (const f of F){ const c4=unit([0,1,2,3].map(a=>f.reduce((s,i)=>s+V[i][a],0))), start=np, idx=[];
    for (let e=0;e<f.length;e++){ const A=V[f[e]], B=V[f[(e+1)%f.length]], base=np, id=(i,j)=>base+i*(k+1)-i*(i-1)/2+j;   // row i holds k+1−i points
      for (let i=0;i<=k;i++) for (let j=0;j<=k-i;j++){ const u=i/k, v=j/k, w=1-u-v, q=unit([0,1,2,3].map(a=>w*c4[a]+u*A[a]+v*B[a])); P.set(q, np*4); np++; }
      for (let i=0;i<k;i++) for (let j=0;j<k-i;j++){ idx.push(id(i,j), id(i+1,j), id(i,j+1)); if (i+j<k-1) idx.push(id(i+1,j), id(i+1,j+1), id(i,j+1)); } }
    const cw=f.reduce((s,i)=>s+V[i][3],0)/f.length;
    faces.push({ f, c4, m4:perp4(V[f[0]],V[f[1]],V[f[2]]), start, count:np-start, idx:Uint32Array.from(idx), col:wColor(Math.max(-1,Math.min(1,cw*1.6))) }); }
  const g=new THREE.BufferGeometry(), pos=new Float32Array(np*3), nrm=new Float32Array(np*3), col=new Float32Array(np*3);
  for (const fc of faces) for (let i=fc.start;i<fc.start+fc.count;i++) col.set(fc.col, i*3);
  g.setAttribute('position', new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm,3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col,3));
  const nIdx=faces.reduce((s,fc)=>s+fc.idx.length,0); g.setIndex(new THREE.BufferAttribute(new Uint32Array(nIdx),1).setUsage(THREE.DynamicDrawUsage));
  return { sh, P, faces, pos, nrm, col, g, palKey:'' };
}
// 4D turn as the explorer does it: the result's c-th part is the sum over r of v[r]·M[r][c]
const turn=(M,v,o=0)=>[0,1,2,3].map(c=>v[o]*M[0][c]+v[o+1]*M[1][c]+v[o+2]*M[2][c]+v[o+3]*M[3][c]);
/** Draw the foam for the current 4D turn (V: the turned corners). Returns how far it reaches. */
export function drawFoam(sh, V, palKey){
  if (!built || built.sh!==sh){ if (mesh){ fit.remove(mesh); mesh.geometry.dispose(); } built=build(sh); mesh=new THREE.Mesh(built.g, mat); mesh.frustumCulled=false; mesh.renderOrder=6; fit.add(mesh); }
  if (palKey!==built.palKey){ built.palKey=palKey; for (const fc of built.faces){ const cw=fc.f.reduce((s,i)=>s+sh.verts[i][3],0)/fc.f.length; fc.col=wColor(Math.max(-1,Math.min(1,cw*1.6))); for (let i=fc.start;i<fc.start+fc.count;i++) built.col.set(fc.col, i*3); } built.g.attributes.color.needsUpdate=true; }
  mesh.visible=true;
  const M=rot4(), {P, pos, nrm, faces, g}=built; fit.updateMatrixWorld();
  const [[m00,m01,m02,m03],[m10,m11,m12,m13],[m20,m21,m22,m23],[m30,m31,m32,m33]]=M; camL.copy(camera.position); fit.worldToLocal(camL);
  const show=[]; let bound=0;
  for (const fc of faces){
    if (fc.f.some(i=>V[i][3]>0.96)) continue;   // runs off towards infinity near the projection point
    const m=turn(M,fc.m4), c=turn(M,fc.c4), sc=Math.abs(m[3])>1e-6 ? [-m[0]/m[3], -m[1]/m[3], -m[2]/m[3]] : null;   // the face's sphere centre (null: flat)
    const fl=!sc, cx=sc?sc[0]:0, cy=sc?sc[1]:0, cz=sc?sc[2]:0;
    for (let i=fc.start, o=i*3, p=i*4; i<fc.start+fc.count; i++, o+=3, p+=4){   // plain arithmetic: this runs for every point, every frame
      const a=P[p], b=P[p+1], cc=P[p+2], d=P[p+3];
      const s=1/(1-(a*m03+b*m13+cc*m23+d*m33)), x=(a*m00+b*m10+cc*m20+d*m30)*s, y=(a*m01+b*m11+cc*m21+d*m31)*s, z=(a*m02+b*m12+cc*m22+d*m32)*s;
      pos[o]=x; pos[o+1]=y; pos[o+2]=z;
      const nx=fl?m[0]:x-cx, ny=fl?m[1]:y-cy, nz=fl?m[2]:z-cz, l=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1); nrm[o]=nx*l; nrm[o+1]=ny*l; nrm[o+2]=nz*l; }
    const s=1/(1-c[3]), pc=[c[0]*s, c[1]*s, c[2]*s], r=Math.hypot(...pc); if (r>bound) bound=r;
    show.push({fc, d:(pc[0]-camL.x)**2+(pc[1]-camL.y)**2+(pc[2]-camL.z)**2}); }
  show.sort((a,b)=>b.d-a.d);   // see-through films are drawn from the back forward
  const I=g.index.array; let o=0; for (const {fc} of show){ I.set(fc.idx, o); o+=fc.idx.length; }
  g.setDrawRange(0, o); g.index.needsUpdate=true; g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=true;
  return Math.min(bound, 6);
}
