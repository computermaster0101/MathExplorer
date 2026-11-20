import * as THREE from 'three';
import { shared } from '../shared.js';
import { $ } from '../util.js';
import { camera, renderer, scene } from './scene.js';

// ---------- stereo 3D: red/cyan glasses, or side-by-side pairs for VR viewers and cross-eyed viewing ----------
export let stereoMode='off'; shared.eyeSep = 0.08;
const stereoCam=new THREE.StereoCamera(); let anaglyph=null;
function makeAnaglyph(){
  const rp={minFilter:THREE.LinearFilter, magFilter:THREE.NearestFilter, format:THREE.RGBAFormat};
  const rtL=new THREE.WebGLRenderTarget(4,4,rp), rtR=new THREE.WebGLRenderTarget(4,4,rp);
  // Dubois least-squares red/cyan matrices (the ones three.js's own AnaglyphEffect uses): keeps colour while cutting ghosting
  const mat=new THREE.ShaderMaterial({ uniforms:{ mapLeft:{value:rtL.texture}, mapRight:{value:rtR.texture},
      colorMatrixLeft:{value:new THREE.Matrix3().fromArray([0.456100,-0.0400822,-0.0152161, 0.500484,-0.0378246,-0.0205971, 0.176381,-0.0157589,-0.00546856])},
      colorMatrixRight:{value:new THREE.Matrix3().fromArray([-0.0434706,0.378476,-0.0721527, -0.0879388,0.73364,-0.112961, -0.00155529,-0.0184503,1.2264])} },
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:`uniform sampler2D mapLeft, mapRight; uniform mat3 colorMatrixLeft, colorMatrixRight; varying vec2 vUv;
      float lin(float c){ return c<=0.04045 ? c*0.0773993808 : pow(c*0.9478672986+0.0521327014, 2.4); }
      vec4 lin(vec4 c){ return vec4(lin(c.r), lin(c.g), lin(c.b), c.a); }
      float dev(float c){ return c<=0.0031308 ? c*12.92 : pow(c,0.41666)*1.055-0.055; }
      void main(){ vec4 L=lin(texture2D(mapLeft,vUv)), R=lin(texture2D(mapRight,vUv)); vec3 c=clamp(colorMatrixLeft*L.rgb+colorMatrixRight*R.rgb,0.,1.);
        gl_FragColor=vec4(dev(c.r),dev(c.g),dev(c.b),max(L.a,R.a)); }` });
  const sc=new THREE.Scene(), cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1); sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat));
  return {rtL, rtR, sc, cam}; }
export function renderView(){
  if (stereoMode==='off'){ renderer.render(scene, camera); return; }
  const size=new THREE.Vector2(); renderer.getDrawingBufferSize(size); const w=size.x, h=size.y;
  camera.updateMatrixWorld(); stereoCam.eyeSep=shared.eyeSep;
  if (stereoMode==='anaglyph'){
    if (!anaglyph) anaglyph=makeAnaglyph();
    if (anaglyph.rtL.width!==w || anaglyph.rtL.height!==h){ anaglyph.rtL.setSize(w,h); anaglyph.rtR.setSize(w,h); }
    stereoCam.update(camera);
    renderer.setRenderTarget(anaglyph.rtL); renderer.clear(); renderer.render(scene, stereoCam.cameraL);
    renderer.setRenderTarget(anaglyph.rtR); renderer.clear(); renderer.render(scene, stereoCam.cameraR);
    renderer.setRenderTarget(null); renderer.render(anaglyph.sc, anaglyph.cam); return; }
  // side by side: each half gets its own camera with half the width
  const pr=renderer.getPixelRatio(), W=w/pr, H=h/pr, asp=camera.aspect; camera.aspect=(W/2)/H; camera.updateProjectionMatrix(); stereoCam.update(camera);
  const [first, second] = stereoMode==='cross' ? [stereoCam.cameraR, stereoCam.cameraL] : [stereoCam.cameraL, stereoCam.cameraR];
  renderer.setScissorTest(true); renderer.clear();
  renderer.setScissor(0,0,W/2,H); renderer.setViewport(0,0,W/2,H); renderer.render(scene, first);
  renderer.setScissor(W/2,0,W/2,H); renderer.setViewport(W/2,0,W/2,H); renderer.render(scene, second);
  renderer.setScissorTest(false); renderer.setViewport(0,0,W,H); camera.aspect=asp; camera.updateProjectionMatrix(); }
const STEREO_NOTES={off:'Ordinary single view.',
  anaglyph:'Red/cyan: put on red–cyan 3D glasses (red over the left eye). The shape will float in depth.',
  sbs:'Side by side, left eye on the left: for phone VR headsets and parallel ("wall-eyed") viewing. Works best in full screen.',
  cross:'Cross-eyed pair: the right eye\'s view is on the left. Cross your eyes until the two pictures merge into one in the middle.'};
export function setStereo(m, sep){ stereoMode=m; if (sep!=null){ shared.eyeSep=sep; $('eye').value=sep; } $('eyeo').textContent=shared.eyeSep.toFixed(2);
  document.querySelectorAll('#stereo button').forEach(b=>b.classList.toggle('on', b.dataset.st===m)); $('stereoNote').textContent=STEREO_NOTES[m]; $('eyeRow').hidden=m==='off'; }
