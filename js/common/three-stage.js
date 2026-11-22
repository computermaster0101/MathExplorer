// A three.js stage for the 3D explorers (Surfaces & Knots, Strange Attractors): renderer, camera, lights, a group that turns
// (drag, the arrow keys) inside a group that's scaled to fit, zoom (wheel, pinch, + / −), sliding (W A S D), and the finishes,
// including the see-through soap-film "Bubble" (shared with the 4D Polytopes explorer).
import * as THREE from 'three';
import { drive } from '../shell/keys.js';

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

/** The finishes offered in Colour & style: materials for meshes coloured per vertex. */
export function makeFinishes(){ return {
  satin: new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.42, metalness:0.08, side:THREE.DoubleSide }),
  gloss: new THREE.MeshPhongMaterial({ vertexColors:true, shininess:120, specular:0x666666, side:THREE.DoubleSide }),
  metal: new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.22, metalness:0.75, side:THREE.DoubleSide }),
  flat:  new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.DoubleSide }),
  bubble: bubbleMaterial(true),
}; }

/**
 * The stage. opts: z (starting camera distance), zMin, zMax. Returns { THREE, renderer, scene, camera, pivot, fit, step(dt),
 * render(), resize(), setFlash(k), setBackground(hex), reset(), pointers, vel }.
 * step(dt) glides after a drag and applies the driving keys (arrows turn the shape, W A S D slide the view); it returns true
 * if anything moved. Explorers put their meshes in fit (scaled to the window) inside pivot (turned).
 */
export function makeStage3D(canvas, opts={}){
  const z0=opts.z||6, zMin=opts.zMin||1.2, zMax=opts.zMax||14;
  const renderer=new THREE.WebGLRenderer({ canvas, antialias:true, preserveDrawingBuffer:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x0b0d12);
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(38, 1, 0.01, 200); camera.position.set(0,0,z0);
  const hemi=new THREE.HemisphereLight(0xdfe6ff, 0x1a1420, 0.75); scene.add(hemi);
  const d1=new THREE.DirectionalLight(0xffffff, 0.85); d1.position.set(2,3,4); scene.add(d1);
  const d2=new THREE.DirectionalLight(0x99aaff, 0.35); d2.position.set(-3,-1,-2); scene.add(d2);
  const pivot=new THREE.Group(), fit=new THREE.Group(); scene.add(pivot); pivot.add(fit);
  const HOME=new THREE.Euler(0.38,-0.62,0); pivot.quaternion.setFromEuler(HOME);
  const S={ THREE, renderer, scene, camera, pivot, fit, vel:{x:0,y:0}, pointers:new Map() };
  const UP=new THREE.Vector3(0,1,0), XA=new THREE.Vector3(1,0,0), qx=new THREE.Quaternion(), qy=new THREE.Quaternion();
  S.turn=(dx,dy)=>{ qy.setFromAxisAngle(UP,dx); qx.setFromAxisAngle(XA,dy); pivot.quaternion.premultiply(qy).premultiply(qx); };
  S.zoom=f=>{ camera.position.z=Math.min(zMax, Math.max(zMin, camera.position.z*f)); };
  // materials the lights don't reach (lines, Neon, Bubble) are registered with addFlash and brightened directly
  const flashMats=new Set();
  S.addFlash=mat=>{ if (mat.color) mat.userData.flashBase=mat.color.clone(); flashMats.add(mat); return mat; };
  S.dropFlash=mat=>{ flashMats.delete(mat); };
  S.setFlash=k=>{ const m=1+0.5*k; hemi.intensity=0.75*m; d1.intensity=0.85*m; d2.intensity=0.35*m;
    for (const mat of flashMats){ if (mat.uniforms && mat.uniforms.uGain) mat.uniforms.uGain.value=m; else if (mat.userData.flashBase) mat.color.copy(mat.userData.flashBase).multiplyScalar(m); } };
  S.setBackground=hex=>renderer.setClearColor(new THREE.Color(hex));
  S.reset=()=>{ pivot.quaternion.setFromEuler(HOME); camera.position.set(0,0,z0); S.vel.x=S.vel.y=0; };
  // on a tall, narrow screen (a phone held upright) widen the view so the shape fits across, not just up and down
  const fov0=camera.fov;
  S.resize=()=>{ const r=canvas.parentElement.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect=r.width/Math.max(1,r.height);
    camera.fov = camera.aspect<1 ? 2*Math.atan(Math.tan(fov0*Math.PI/360)/camera.aspect)*180/Math.PI : fov0; camera.updateProjectionMatrix(); };
  S.render=()=>renderer.render(scene, camera);
  let pinch=0;
  canvas.addEventListener('pointerdown', e=>{ canvas.setPointerCapture(e.pointerId); S.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}); });
  canvas.addEventListener('pointermove', e=>{ if (!S.pointers.has(e.pointerId)) return; const p=S.pointers.get(e.pointerId); S.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if (S.pointers.size===1){ const dx=(e.clientX-p.x)*0.008, dy=(e.clientY-p.y)*0.008; S.turn(dx,dy); S.vel.x=dx; S.vel.y=dy; }
    else if (S.pointers.size===2){ const [a,b]=[...S.pointers.values()], d=Math.hypot(a.x-b.x,a.y-b.y); if (pinch) S.zoom(pinch/d); pinch=d; } });
  const up=e=>{ S.pointers.delete(e.pointerId); if (S.pointers.size<2) pinch=0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e=>{ e.preventDefault(); S.zoom(Math.exp(e.deltaY*0.001)); }, { passive:false });
  S.step=dt=>{ let moved=false;
    if (!S.pointers.size && Math.abs(S.vel.x)+Math.abs(S.vel.y)>1e-5){ S.turn(S.vel.x,S.vel.y); S.vel.x*=0.93; S.vel.y*=0.93; moved=true; }
    const k=drive(); if (k.any){ const f=(k.fast?3:1)*k.scale;
      if (k.turnX||k.turnY) S.turn(k.turnX*1.3*f*dt, -k.turnY*1.1*f*dt);
      if (k.slideX||k.slideY){ const zz=camera.position.z, v=0.45*zz*f*dt, lim=0.6*zz; camera.position.x=Math.max(-lim,Math.min(lim,camera.position.x+k.slideX*v)); camera.position.y=Math.max(-lim,Math.min(lim,camera.position.y+k.slideY*v)); }
      moved=true; }
    return moved; };
  new ResizeObserver(S.resize).observe(canvas.parentElement); S.resize();
  return S;
}
