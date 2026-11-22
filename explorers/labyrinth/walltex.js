// ---------- patterns on the walls ----------
// The flat patterns of the Tilings explorer (wallpaper groups, Truchet tiles, an Archimedean tiling, quasicrystals, the hat),
// plus the honeycomb from Foams and the ripples from Waves, drawn in greys onto a texture that darkens and lightens the walls'
// own colours, so palettes, cycling and the beat still work. The texture is laid on from three directions at once and blended
// by which way each bit of wall faces (triplanar mapping), in the mesh's own coordinates, so it sits on curved labyrinth walls
// as well as flat maze walls and stays put as the shape turns. A repeating pattern is drawn over whole repeats, so it joins up
// seamlessly; a never-repeating one is drawn as one big patch, mirrored where it wraps.
import * as THREE from 'three';
import { PATTERNS } from '../tiling/patterns.js';

const S3 = Math.sqrt(3), SNUB = Math.sqrt(2 + S3);
// [key, name, period in pattern units ([w, h]: a rectangle the pattern repeats in) or null (never repeats: span instead), repeats drawn]
export const WALL_PATTERNS = [
  ['none', 'Plain'],
  ['wp_p6m', 'Wallpaper p6m', [1, S3], [2, 1]], ['wp_p4m', 'Wallpaper p4m', [1, 1], [2, 2]], ['wp_p4g', 'Wallpaper p4g', [1, 1], [2, 2]], ['wp_p31m', 'Wallpaper p31m', [1, S3], [2, 1]],
  ['wp_pgg', 'Wallpaper pgg', [1, 0.72], [2, 3]], ['wp_cmm', 'Wallpaper cmm', [1, 1.45], [2, 1]],
  ['truchetArcs', 'Truchet quarter circles', [1, 1], [6, 6]], ['truchetTri', 'Truchet half squares', [1, 1], [6, 6]], ['truchetMaze', 'Random diagonals', [1, 1], [8, 8]],
  ['elong', 'Squares and triangles', [1, 1 + 2 * (S3 / 2)], [3, 1]], ['snubsq', 'Snub squares', [SNUB, SNUB], [2, 2]],
  ['qc8', 'Ammann–Beenker', null, 14], ['qc10', 'Penrose rhombi', null, 14], ['qc12', '12-fold', null, 14], ['hat', 'The hat', null, 30],
  ['honeycomb', 'Honeycomb (Foams)', [S3, 3], [2, 1]], ['ripples', 'Ripples (Waves)', null, 10],
];
export const patternInfo = k => WALL_PATTERNS.find(p => p[0] === k) || WALL_PATTERNS[0];

const cache = {};
/** The pattern as a texture, and how big one repeat of it is (pattern units). */
export function patternTexture(key) {
  if (cache[key]) return cache[key];
  const [, , period, reps] = patternInfo(key); if (key === 'none') return null;
  const periodic = !!period, w = periodic ? period[0] * reps[0] : reps, h = periodic ? period[1] * reps[1] : reps;
  const ppu = Math.min(256, 1536 / Math.max(w, h)), W = Math.round(w * ppu), H = Math.round(h * ppu), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), X = x => x * ppu, Y = y => H - y * ppu;   // pattern (x, y) from the texture's bottom-left corner
  g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, W, H); g.lineJoin = 'round'; g.lineCap = 'round';
  const poly = (p, fill, stroke, lw) => { g.beginPath(); p.forEach((q, i) => (i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1])))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw * ppu; g.stroke(); } };
  const grey = v => { const c = Math.round(255 * v); return `rgb(${c},${c},${c})`; };
  if (key === 'honeycomb') {   // hexagons of side 1, pointy side up: the repeat is √3 wide and 3 high
    for (let i = -1; i <= reps[0] + 1; i++) for (let j = -1; j <= 2 * reps[1] + 1; j++) { const cx = (i + (j & 1) / 2) * S3, cy = j * 1.5, P = Array.from({ length: 6 }, (_, k) => [cx + Math.cos(Math.PI / 6 + k * Math.PI / 3), cy + Math.sin(Math.PI / 6 + k * Math.PI / 3)]);
      poly(P, grey(0.72 + 0.2 * (((i * 7 + j * 3) % 3 + 3) % 3) / 2), grey(0.12), 0.09); } }
  else if (key === 'ripples') {   // two sources' waves adding up, as in Waves' ripple tank
    const img = g.createImageData(W, H), A = [w * 0.3, h * 0.35], B = [w * 0.72, h * 0.62];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const px = x / ppu, py = (H - y) / ppu, d1 = Math.hypot(px - A[0], py - A[1]), d2 = Math.hypot(px - B[0], py - B[1]), v = 0.5 + 0.25 * (Math.cos(d1 * 5) + Math.cos(d2 * 5)), c = Math.round(255 * (0.35 + 0.6 * v)), o = (y * W + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = c; img.data[o + 3] = 255; }
    g.putImageData(img, 0, 0); }
  else {
    const P = PATTERNS[key], ctr = P.centre ? P.centre() : [0, 0], off = periodic ? [0, 0] : [ctr[0] - w / 2, ctr[1] - h / 2];
    const b = [off[0], off[0] + w, off[1], off[1] + h], G = P.gen(b, 3), nC = G.classes || (P.classes ? P.classes.length : 2), sh = (x, y) => [x - off[0], y - off[1]];
    for (const q of G.polys || []) { const t = P.wallpaper ? (q.flip ? 0.42 : 0.92) : 0.5 + 0.45 * (q.c % nC) / Math.max(1, nC - 1);
      poly(q.p.map(([x, y]) => sh(x, y)), grey(t), P.wallpaper ? null : grey(0.14), 0.05); }
    for (const L of G.lines || []) { g.beginPath(); L.p.forEach(([x, y], i) => { const [u, v] = sh(x, y); i ? g.lineTo(X(u), Y(v)) : g.moveTo(X(u), Y(v)); }); g.strokeStyle = P.wallpaper ? 'rgba(40,40,40,0.35)' : grey(0.1); g.lineWidth = (P.wallpaper ? 0.02 : 0.14) * ppu; g.stroke(); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = periodic ? THREE.RepeatWrapping : THREE.MirroredRepeatWrapping; tex.anisotropy = 4;
  return (cache[key] = { tex, size: [w, h] });
}

/**
 * Teach a lit material to show the pattern: shared uniforms (U), so switching pattern or size changes every patched material at once.
 * U.on: 0 or 1; U.tex: the texture; U.scale: texture repeats per world unit (x, y); U.amt: how strongly it darkens.
 */
export const U = { u_wtOn: { value: 0 }, u_wt: { value: null }, u_wtScale: { value: new THREE.Vector2(1, 1) }, u_wtAmt: { value: 0.55 }, u_wtGlow: { value: 0 }, u_wtShift: { value: new THREE.Vector2(0, 0) }, u_wtTop: { value: 1 } };   // u_wtTop 0: floors and roofs (faces looking up or down) stay plain
export function patchMaterial(m) {
  if (m.userData.wallPattern) return m; m.userData.wallPattern = true;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLPos; varying vec3 vLNorm;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  { vec4 tp = vec4(transformed, 1.0); vec3 tn = normal;   /* the normal attribute: objectNormal isn't defined in the unlit (Neon) shader */
  #ifdef USE_INSTANCING
    tp = instanceMatrix * tp; tn = mat3(instanceMatrix) * tn;
  #endif
    vLPos = tp.xyz; vLNorm = tn; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLPos; varying vec3 vLNorm; uniform float u_wtOn, u_wtAmt, u_wtGlow, u_wtTop; uniform sampler2D u_wt; uniform vec2 u_wtScale, u_wtShift;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  float wtT = 1.0; vec3 wtBase = diffuseColor.rgb;
  if (u_wtOn > 0.5) { vec3 bw = pow(abs(normalize(vLNorm)), vec3(4.0)); bw /= (bw.x + bw.y + bw.z + 1e-5);
    wtT = texture2D(u_wt, vLPos.zy * u_wtScale + u_wtShift).r * bw.x + (u_wtTop > 0.5 ? texture2D(u_wt, vLPos.xz * u_wtScale + u_wtShift).r : 0.86) * bw.y + texture2D(u_wt, vLPos.xy * u_wtScale + u_wtShift).r * bw.z;
    diffuseColor.rgb *= mix(1.0 - u_wtAmt, 1.08, wtT); }`)
      // glow: the pattern's dark lines light up in the wall's own colour (lit finishes only; Neon is unlit already)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  if (u_wtOn > 0.5) totalEmissiveRadiance += wtBase * u_wtGlow * smoothstep(0.75, 0.2, wtT);`);
  };
  m.customProgramCacheKey = () => 'wallpattern';
  m.needsUpdate = true; return m;
}
/** Switch to a pattern; size = how many world units one pattern unit covers. */
export function setPattern(key, size) {
  const T = patternTexture(key); U.u_wtOn.value = T ? 1 : 0; if (!T) return;
  U.u_wt.value = T.tex; U.u_wtScale.value.set(1 / (T.size[0] * size), 1 / (T.size[1] * size));
}
