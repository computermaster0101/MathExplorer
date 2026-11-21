import * as THREE from 'three';
import { shared } from '../shared.js';
import { $, lerpN } from '../util.js';
import { BASE_R, st } from '../state.js';
import { bgRGB, colorOf } from './colour.js';
import { cross, dot3, dotN, nrm } from '../geometry/common.js';
import { project } from '../math/rotate4d.js';

// ---------- three.js ----------
export const canvas = $('c');
export const renderer = new THREE.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x0b0d12);
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
camera.position.set(0,0,8.5);   // start zoomed all the way out
const hemi = new THREE.HemisphereLight(0xdfe6ff, 0x1a1420, 0.75); scene.add(hemi);
const d1 = new THREE.DirectionalLight(0xffffff, 0.85); d1.position.set(2,3,4); scene.add(d1);
const d2 = new THREE.DirectionalLight(0x99aaff, 0.35); d2.position.set(-3,-1,-2); scene.add(d2);
/** The music's beat flash: brighten the lights by up to half again (k = 0..1.5). */
export function setFlash(k){ const m=1+0.5*k; hemi.intensity=0.75*m; d1.intensity=0.85*m; d2.intensity=0.35*m; }
export const pivot = new THREE.Group(); scene.add(pivot);
export const fit = new THREE.Group(); pivot.add(fit);
export const HOME = new THREE.Euler(0.38, -0.62, 0);
pivot.quaternion.setFromEuler(HOME);

/**
 * A soap-film look: nearly clear where you look straight through, bright at the rim, with the rainbow sheen of a thin film
 * (the colour shifts with the viewing angle, because the light's path through the film gets longer at a slant). Works on
 * instanced balls (their colour tints the film) and on ordinary meshes with a vertex colour. Drawn see-through from both sides.
 */
export function bubbleMaterial(vertexColors){
  return new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side:THREE.DoubleSide, vertexColors:!!vertexColors,
    uniforms:{ uGain:{value:1} },
    vertexShader:`varying vec3 vN, vV, vC;
      void main(){
        mat4 m=modelMatrix; vec3 nn=normal; vec4 p=vec4(position,1.0);
        #ifdef USE_INSTANCING
          p=instanceMatrix*p; nn=mat3(instanceMatrix)*nn;
        #endif
        vec4 wp=m*p; vN=normalize(mat3(m)*nn); vV=cameraPosition-wp.xyz; vC=vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vC=instanceColor;
        #endif
        #ifdef USE_COLOR
          vC=color;
        #endif
        gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader:`uniform float uGain; varying vec3 vN, vV, vC;
      void main(){
        vec3 n=normalize(vN), v=normalize(vV); float c=abs(dot(n,v)), fr=pow(1.0-c,2.5);
        float t=1.15/max(c,0.12)+0.35*dot(n,vec3(0.3,0.8,0.2));          // film path length: longer at a slant
        vec3 film=0.55+0.45*cos(6.2831*(t+vec3(0.0,0.33,0.67)));
        vec3 col=mix(vC, film, 0.5);
        vec3 L=normalize(vec3(0.35,0.75,0.55)); float sp=pow(max(dot(n,normalize(L+v)),0.0),90.0)+0.5*pow(max(dot(-n,normalize(L+v)),0.0),90.0);
        gl_FragColor=vec4(col*(0.25+1.1*fr)*uGain+vec3(sp), clamp(0.07+0.8*fr+sp,0.0,1.0)); }` });
}
export const FINISH = {
  satin:{ tube:new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.38, metalness:0.08}), ball:new THREE.MeshStandardMaterial({roughness:0.3, metalness:0.1}) },
  gloss:{ tube:new THREE.MeshPhongMaterial({vertexColors:true, shininess:120, specular:0x666666}), ball:new THREE.MeshPhongMaterial({shininess:140, specular:0x777777}) },
  metal:{ tube:new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.22, metalness:0.75}), ball:new THREE.MeshStandardMaterial({roughness:0.18, metalness:0.8}) },
  flat:{ tube:new THREE.MeshBasicMaterial({vertexColors:true}), ball:new THREE.MeshBasicMaterial() },
  bubble:{ tube:new THREE.MeshPhongMaterial({vertexColors:true, shininess:140, specular:0x888888, transparent:true, opacity:0.45, depthWrite:false}), ball:bubbleMaterial(false) },
};
shared.tubeMat = FINISH.satin.tube; shared.ballMat = FINISH.satin.ball;
const tmpM = new THREE.Matrix4(), tmpC = new THREE.Color();

// A set of tubes + corner balls drawn from per-frame data
class TubeLayer {
  constructor(){ this.key=''; this.vis=true; }
  ensure(E, NV, S, R){
    const key=[E,NV,S,R].join('|'); if (key===this.key) return; this.key=key; this.dispose();
    Object.assign(this, {E,NV,S,R});
    this.cos=Array.from({length:R},(_,m)=>Math.cos(2*Math.PI*m/R)); this.sin=Array.from({length:R},(_,m)=>Math.sin(2*Math.PI*m/R));
    const n=Math.max(1,E*S*R);
    this.pos=new Float32Array(n*3); this.nrm=new Float32Array(n*3); this.col=new Float32Array(n*3);
    const idx=new Uint32Array(Math.max(6,E*(S-1)*R*6)); let q=0;
    for (let e=0;e<E;e++){ const base=e*S*R;
      for (let k=0;k<S-1;k++) for (let m=0;m<R;m++){ const m2=(m+1)%R, a=base+k*R+m, b=base+k*R+m2, c=base+(k+1)*R+m2, d=base+(k+1)*R+m;
        idx[q++]=a; idx[q++]=b; idx[q++]=c; idx[q++]=a; idx[q++]=c; idx[q++]=d; } }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col,3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(idx,1));
    this.mesh=new THREE.Mesh(g, shared.tubeMat); this.mesh.frustumCulled=false; fit.add(this.mesh);
    const big=NV>200;
    this.balls=new THREE.InstancedMesh(new THREE.SphereGeometry(1, big?10:20, big?8:14), shared.ballMat, Math.max(1,NV));
    this.balls.frustumCulled=false; for (let i=0;i<Math.max(1,NV);i++) this.balls.setColorAt(i, tmpC.setRGB(1,1,1));
    fit.add(this.balls); this.setVisible(this.vis);
  }
  dispose(){ if (this.mesh){ fit.remove(this.mesh); this.mesh.geometry.dispose(); fit.remove(this.balls); this.balls.geometry.dispose(); this.mesh=null; } }
  setVisible(v){ this.vis=v; if (this.mesh){ this.mesh.visible=v; this.balls.visible=v; } }
  setMaterials(t,b){ if (this.mesh){ this.mesh.material=t; this.balls.material=b; } }
  update(fr){
    const {S,R,cos,sin,pos,nrm,col}=this; let o=0, bound=0;
    for (const t of fr.tubes) for (let k=0;k<S;k++){
      const p=t.P[k], r=t.rad[k], [N,B]=t.F[k], c=t.cols[k];
      for (let m=0;m<R;m++){
        const nx=cos[m]*N[0]+sin[m]*B[0], ny=cos[m]*N[1]+sin[m]*B[1], nz=cos[m]*N[2]+sin[m]*B[2];
        pos[o]=p[0]+r*nx; pos[o+1]=p[1]+r*ny; pos[o+2]=p[2]+r*nz; nrm[o]=nx; nrm[o+1]=ny; nrm[o+2]=nz;
        col[o]=c[0]; col[o+1]=c[1]; col[o+2]=c[2]; o+=3;
      }
      const d=Math.hypot(p[0],p[1],p[2])+r; if (d>bound) bound=d;
    }
    const g=this.mesh.geometry; g.setDrawRange(0, fr.tubes.length*(S-1)*R*6);
    g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=g.attributes.color.needsUpdate=true;
    const bm=this.balls; bm.count=fr.balls.length;
    fr.balls.forEach((b,i)=>{ tmpM.makeScale(b.r,b.r,b.r).setPosition(b.c[0],b.c[1],b.c[2]); bm.setMatrixAt(i,tmpM);
      bm.setColorAt(i, tmpC.setRGB(b.col[0],b.col[1],b.col[2])); const d=Math.hypot(...b.c)+b.r; if (d>bound) bound=d; });
    bm.instanceMatrix.needsUpdate=true; if (bm.instanceColor) bm.instanceColor.needsUpdate=true;
    return bound;
  }
}
export const mainLayer = new TubeLayer(), sliceLayer = new TubeLayer(), pingLayer = new TubeLayer();
// Very dense shapes (over LINE_LIMIT connections): draw every connection as a fine line instead of a shaded tube
export const LINE_LIMIT=6000;
class LineLayer {
  constructor(order){ this.cap=0; this.vcap=0; this.vis=false; this.order=order||0;
    this.mat=new THREE.LineBasicMaterial({vertexColors:true, transparent:true, opacity:0.9});
    this.pmat=new THREE.PointsMaterial({vertexColors:true, size:3, sizeAttenuation:false}); }
  ensure(E, NV){
    if (E>this.cap){ if (this.lines){ fit.remove(this.lines); this.lines.geometry.dispose(); }
      this.cap=E; this.pos=new Float32Array(E*6); this.col=new Float32Array(E*6);
      const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(this.col,3).setUsage(THREE.DynamicDrawUsage));
      this.lines=new THREE.LineSegments(g, this.mat); this.lines.frustumCulled=false; this.lines.renderOrder=this.order; fit.add(this.lines); }
    if (NV>this.vcap){ if (this.pts){ fit.remove(this.pts); this.pts.geometry.dispose(); }
      this.vcap=NV; this.ppos=new Float32Array(NV*3); this.pcol=new Float32Array(NV*3);
      const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.ppos,3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(this.pcol,3).setUsage(THREE.DynamicDrawUsage));
      this.pts=new THREE.Points(g, this.pmat); this.pts.frustumCulled=false; this.pts.renderOrder=this.order+1; fit.add(this.pts); }
    this.setVisible(this.vis);
  }
  setVisible(v){ this.vis=v; if (this.lines){ this.lines.visible=v; this.pts.visible=v; } }
  update(src){
    const E=src.edges.length, NV=src.V.length; this.ensure(E, NV); this.setVisible(true);
    const bg=bgRGB(), P=src.V.map(v=>project(v,src.proj)), pos=this.pos, col=this.col; let bound=0, o=0;
    const dimc=(c,d)=> d==null||d>=1 ? c : c.map((x,i)=>bg[i]+(x-bg[i])*d);
    const VC = !src.edgeCol && st.cmode!=='dir' ? src.V.map((v,n)=>colorOf(src.O[n], v[3], -1, src)) : null;
    for (let e=0;e<E;e++){ const [i,j]=src.edges[e], mul=src.edgeMul?src.edgeMul[e]:1, g=src.grow?src.grow[e]:1;
      const a=P[i], b = mul<=0 ? a : (g<1 ? project(lerpN(src.V[i],src.V[j],g),src.proj) : P[j]);
      const dim=src.edgeDim?src.edgeDim[e]:1, k=dim>=1?1:dim, k0=1-k;   // fade towards the background without making new arrays
      const ca=src.edgeCol ? src.edgeCol(e) : VC ? VC[i] : colorOf(src.O[i], src.V[i][3], src.fam[e], src);
      const cb=src.edgeCol ? ca : VC ? VC[j] : colorOf(src.O[j], src.V[j][3], src.fam[e], src);
      pos[o]=a[0]; pos[o+1]=a[1]; pos[o+2]=a[2]; pos[o+3]=b[0]; pos[o+4]=b[1]; pos[o+5]=b[2];
      col[o]=bg[0]*k0+ca[0]*k; col[o+1]=bg[1]*k0+ca[1]*k; col[o+2]=bg[2]*k0+ca[2]*k; col[o+3]=bg[0]*k0+cb[0]*k; col[o+4]=bg[1]*k0+cb[1]*k; col[o+5]=bg[2]*k0+cb[2]*k; o+=6;
    }
    for (let n=0;n<P.length;n++){ const d=P[n][0]*P[n][0]+P[n][1]*P[n][1]+P[n][2]*P[n][2]; if (d>bound) bound=d; } bound=Math.sqrt(bound);
    const lg=this.lines.geometry; lg.setDrawRange(0, E*2); lg.attributes.position.needsUpdate=lg.attributes.color.needsUpdate=true;
    let q=0;   // corners as dots (hidden ones parked far away)
    for (let n=0;n<NV;n++){ const m=src.ballMul?src.ballMul[n]:0.6, p=P[n], c=dimc(src.ballCol ? src.ballCol(n) : VC ? VC[n] : colorOf(src.O[n], src.V[n][3], -1, src), src.ballDim?src.ballDim[n]:1);
      if (m>0){ this.ppos[q]=p[0]; this.ppos[q+1]=p[1]; this.ppos[q+2]=p[2]; } else { this.ppos[q]=1e6; this.ppos[q+1]=1e6; this.ppos[q+2]=1e6; }
      this.pcol[q]=c[0]; this.pcol[q+1]=c[1]; this.pcol[q+2]=c[2]; q+=3; }
    const pg=this.pts.geometry; pg.setDrawRange(0, NV); pg.attributes.position.needsUpdate=pg.attributes.color.needsUpdate=true;
    return bound;
  }
}
export const mainLines=new LineLayer(0), pingLines=new LineLayer(2);
// draw a source with tubes, or with fine lines if it has too many connections
export function drawSource(src, tubeL, lineL){
  const E=src.edges.length;
  if (E>LINE_LIMIT){ tubeL.setVisible(false); return {bound:lineL.update(src), frame:null}; }
  lineL.setVisible(false); tubeL.setVisible(true);
  const [S,R]=resFor(E, src.curved); tubeL.ensure(E, src.V.length, S, R); const fr=computeTubes(src,S);
  return {bound:tubeL.update(fr), frame:fr};
}

function resFor(E, curved){
  return curved ? (E>600?[8,8]:E>300?[12,10]:E>150?[18,12]:[32,14]) : (E>20000?[2,4]:E>3000?[2,6]:E>600?[3,8]:E>300?[4,10]:E>150?[8,12]:[12,14]);
}

export function makeFrames(P){
  const n=P.length, T=P.map((_,k)=>{ const a=P[Math.max(0,k-1)], b=P[Math.min(n-1,k+1)]; return nrm([b[0]-a[0],b[1]-a[1],b[2]-a[2]]); });
  let N=nrm(cross(T[0], Math.abs(T[0][2])<0.9 ? [0,0,1] : [1,0,0])); const F=[];
  for (let k=0;k<n;k++){ if (k){ const d=dot3(N,T[k]); N=nrm([N[0]-d*T[k][0],N[1]-d*T[k][1],N[2]-d*T[k][2]]); } F.push([N, cross(T[k],N)]); }
  return F;
}
function computeTubes(src, S){
  const thick=BASE_R*st.thk*(src.tk||1), bg=bgRGB(), tubes=[];
  const radius = f => st.conf ? thick*f : thick*1.4;
  const dimc = (c,d) => d>=1 ? c : c.map((x,i)=>bg[i]+(x-bg[i])*d);
  src.edges.forEach(([i,j], e) => {
    const mulR=src.edgeMul?src.edgeMul[e]:1, dim=src.edgeDim?src.edgeDim[e]:1, fixed=src.edgeCol?src.edgeCol(e):null;
    const g=src.grow?src.grow[e]:1, Vi=src.V[i], Oi=src.O[i], P=[], rad=[], cols=[];
    const Vj = g<1 ? lerpN(Vi,src.V[j],g) : src.V[j].slice(), Oj = g<1 ? lerpN(Oi,src.O[j],g) : src.O[j];
    if (src.curved){
      if (g<1){ const L=Math.hypot(...Vi)/(Math.hypot(...Vj)||1); for (let a=0;a<4;a++) Vj[a]*=L; }
      const ang=Math.acos(Math.max(-1,Math.min(1,dotN(Vi,Vj)))), sa=Math.sin(ang)||1;
      for (let k=0;k<S;k++){ const t=k/(S-1), ka=Math.sin((1-t)*ang)/sa, kb=Math.sin(t*ang)/sa;
        const p4=Vi.map((x,a)=>ka*x+kb*Vj[a]), p=project(p4, src.proj);
        P.push([p[0],p[1],p[2]]); rad.push(radius(p[3])*mulR);
        cols.push(dimc(fixed || colorOf(Oi.map((x,a)=>ka*x+kb*Oj[a]), p4[3], src.fam[e], src), dim)); }
    } else {
      const pa=project(Vi, src.proj), pb=project(Vj, src.proj);
      for (let k=0;k<S;k++){ const t=k/(S-1);
        P.push([0,1,2].map(a=>pa[a]+(pb[a]-pa[a])*t)); rad.push(radius(pa[3]+(pb[3]-pa[3])*t)*mulR);
        cols.push(dimc(fixed || colorOf(Oi.map((x,a)=>x+(Oj[a]-x)*t), Vi[3]+(Vj[3]-Vi[3])*t, src.fam[e], src), dim)); }
    }
    tubes.push({P, rad, cols, F:makeFrames(P)});
  });
  const balls=src.V.map((v,n)=>{ const p=project(v, src.proj);
    const c=src.ballCol ? src.ballCol(n) : colorOf(src.O[n], v[3], -1, src).map(x=>Math.min(1,x*1.08));
    return { c:[p[0],p[1],p[2]], r:radius(p[3])*1.32*(src.ballMul?src.ballMul[n]:1), col:dimc(c, src.ballDim?src.ballDim[n]:1) }; });
  return {tubes, balls};
}
function makeFill(opacity){ let mesh=null, cap=0, pos, col;
  const mat=new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity, side:THREE.DoubleSide, depthWrite:false});
  const ensure=n=>{ if (n<=cap) return; cap=Math.max(n, cap*2, 600); if (mesh){ fit.remove(mesh); mesh.geometry.dispose(); }
    pos=new Float32Array(cap*9); col=new Float32Array(cap*9); const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col,3).setUsage(THREE.DynamicDrawUsage));
    mesh=new THREE.Mesh(g, mat); mesh.frustumCulled=false; mesh.renderOrder=5; fit.add(mesh); };
  return { hide(){ if (mesh) mesh.visible=false; },
    update(polys, colOf){ let tri=0; for (const P of polys) tri+=P.length-2; ensure(Math.max(1,tri)); let o=0;
      for (const P of polys){ const cs=P.map(colOf);
        for (let i=1;i+1<P.length;i++) for (const k of [0,i,i+1]){ pos[o]=P[k].p[0]; pos[o+1]=P[k].p[1]; pos[o+2]=P[k].p[2]; col[o]=cs[k][0]; col[o+1]=cs[k][1]; col[o+2]=cs[k][2]; o+=3; } }
      mesh.geometry.setDrawRange(0, o/3); mesh.geometry.attributes.position.needsUpdate=true; mesh.geometry.attributes.color.needsUpdate=true; mesh.visible=true; } }; }
export const sliceFill=makeFill(0.3);
export const faceFill=makeFill(0.16);
