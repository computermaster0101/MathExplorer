// Surfaces explorer: one-sided surfaces, surfaces of constant curvature and soap-film (minimal) surfaces, and a walk on
// the surface itself. Importing this module boots the explorer; the exports are the lifecycle js/main.js drives.
import * as THREE from 'three';
import { $, clamp, segClick, clickNext, setRange, setCheck, clickData, setStats, buildSwatches, rampCss, r4, num, standardKeys, buildKeys, makeShare } from '../../js/common/kit.js';
import { rampOf, sampleRamp, sampleMirror } from '../../js/common/palettes.js';
import { makeStage3D, makeFinishes } from '../../js/common/three-stage.js';
import { saveCanvasPNG, saveFile, fileName } from '../../js/common/save.js';
import { stlFromTriangles } from '../../js/common/stl.js';
import { makeMotion3D, addRecorder } from '../../js/common/motion.js';
import { makeVisualizer, pickButton, randomSlider } from '../../js/common/visualizer.js';
import { flashFx as flash, pulseFx as pulse, voiceFx as voice, colourStep, Groove, Phase, cycleBeats, energyMul } from '../../js/shell/audio/react.js';
import { setPausedTag, drive } from '../../js/shell/keys.js';
import { parseRoute } from '../../js/shell/route.js';
import { SHAPES, GROUPS, defaults, gridMesh } from './shapes.js';

// ---------- state ----------
const st = { shape: 'band', P: {}, detail: 3, draw: 'solid', cmode: 'height', twoSide: false, palette: 'aurora', palRev: false, cycle: 0, cycleSpeed: 0,
  finish: 'satin', bg: '#0b0d12', spin: true, speed: 0.5, slice: false, sliceAt: 0, paused: false, anim: { on: false, t: 0 }, gap: 0, mm: 80, thick: 1.6, walkSpeed: 1, autoRound: false };
for (const k in SHAPES) st.P[k] = defaults(SHAPES[k]);
const sh = () => SHAPES[st.shape];

// ---------- the 3D stage ----------
const canvas = $('sc'), S = makeStage3D(canvas, { z: 6 }), V3 = THREE.Vector3;
S.renderer.localClippingEnabled = true;
const FIN = makeFinishes(), clip = new THREE.Plane(new V3(0, 0, -1), 0);
S.addFlash(FIN.flat); S.addFlash(FIN.bubble);   // the finishes the lights don't reach still flash on the beat
// "colour the two sides differently": the back of every face takes one colour, so a one-sided surface shows where its sides swap
const TWO = { uTwo: { value: 0 }, uBack: { value: new THREE.Color(1, 1, 1) } };
for (const k of ['satin', 'gloss', 'metal', 'flat']) {
  const m = FIN[k]; m.onBeforeCompile = sh => { sh.uniforms.uTwo = TWO.uTwo; sh.uniforms.uBack = TWO.uBack;
    sh.fragmentShader = 'uniform float uTwo; uniform vec3 uBack;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  if (uTwo > 0.5 && !gl_FrontFacing) diffuseColor.rgb = uBack;'); };
  m.customProgramCacheKey = () => 'twoside-' + k;
}
const wireMat = S.addFlash(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
const walkLight = new THREE.PointLight(0xffffff, 0, 3, 1.5); S.scene.add(walkLight);
let meshes = [], wires = [], ext = 1, centre = new V3();
function clearScene() { for (const o of [...meshes, ...wires]) { S.fit.remove(o); o.geometry.dispose(); } meshes = []; wires = []; }

// ---------- building the shape ----------
const N_OF = [0, 48, 72, 104, 140, 190];   // grid points per side by Detail
function build() {
  clearScene(); const s = sh(), P = st.P[st.shape], n = N_OF[st.detail];
  const m = gridMesh(s, P, n, s.band ? st.gap : 0), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2)); g.setIndex(m.idx); g.computeVertexNormals();
  g.computeBoundingBox(); centre = g.boundingBox.getCenter(new V3()); const sz = g.boundingBox.getSize(new V3()); ext = Math.max(sz.x, sz.y, sz.z) || 1;
  S.fit.position.set(0, 0, 0); S.fit.scale.setScalar(2.6 / ext); g.translate(-centre.x, -centre.y, -centre.z); g.computeBoundingBox();
  const mesh = new THREE.Mesh(g, FIN[st.finish]); mesh.userData = { grid: m }; meshes.push(mesh); S.fit.add(mesh);
  if (st.draw !== 'solid') { const w = new THREE.LineSegments(gridLines(g, m), wireMat); wires.push(w); S.fit.add(w); }
  recolour(); applyLook();
}
// grid lines of the surface, every few rows, so the wire view shows the (u, v) net rather than every triangle
function gridLines(g, m) { const P = g.attributes.position.array, out = [], su = Math.max(1, Math.round(m.nu / 24)), sv = Math.max(1, Math.round(m.nv / 12)), W = m.nu + 1;
  for (let s = 0; s < m.sheets; s++) { const base = s * (m.nv + 1) * W;
    const ok = (a, b) => !m.bad || (!m.bad[a] && !m.bad[b]);   // skip lines into points the shape leaves out
    for (let j = 0; j <= m.nv; j += sv) for (let i = 0; i < m.nu; i++) { const a = base + j * W + i; if (ok(a, a + 1)) out.push(...P.slice(a * 3, a * 3 + 3), ...P.slice((a + 1) * 3, (a + 1) * 3 + 3)); }
    for (let i = 0; i <= m.nu; i += su) for (let j = 0; j < m.nv; j++) { const a = base + j * W + i, b = a + W; if (ok(a, b)) out.push(...P.slice(a * 3, a * 3 + 3), ...P.slice(b * 3, b * 3 + 3)); } }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); return lg; }

// ---------- colour ----------
function recolour() {
  const R = rampOf(st.palette, st.palRev), off = st.cycle;
  TWO.uTwo.value = st.twoSide ? 1 : 0; const back = sampleRamp(R, st.palRev ? 0 : 1); TWO.uBack.value.setRGB(...back.map(x => Math.min(1, x * 0.9 + 0.12)));   // the back: the bright end of the palette
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.attributes.position.array, uv = g.attributes.uv.array, nV = pos.length / 3;
    const col = g.attributes.color ? g.attributes.color.array : new Float32Array(nV * 3), curv = st.cmode === 'curv' ? curvature(g) : null;
    const yMin = g.boundingBox.min.y, yMax = g.boundingBox.max.y;
    for (let i = 0; i < nV; i++) {
      let t;
      switch (st.cmode) {
        case 'along': t = uv[i * 2]; break;
        case 'across': t = uv[i * 2 + 1]; break;
        case 'curv': t = curv[i]; break;
        case 'check': t = ((Math.floor(uv[i * 2] * 24) + Math.floor(uv[i * 2 + 1] * 12)) & 1) ? 0.25 : 0.8; break;
        case 'solid': t = 0.6; break;
        default: t = (pos[i * 3 + 1] - yMin) / (yMax - yMin || 1);
      }
      const c = off ? sampleMirror(R, t * 0.5 + off) : sampleRamp(R, t); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(col, 3)); else g.attributes.color.needsUpdate = true;
  }
  $('lgBar').style.background = rampCss(R);
  const L = { height: ['low', 'high'], along: ['start', 'once round'], across: ['one edge', 'the other'], curv: ['flat', 'tightly curved'], check: ['', ''], solid: ['', ''] }[st.cmode];
  $('lgL').textContent = L[0]; $('lgR').textContent = L[1]; $('legend').style.visibility = (st.cmode === 'check' || st.cmode === 'solid') ? 'hidden' : '';
}
// how sharply the surface bends at each point: the average change of surface direction to its neighbours, scaled 0..1
function curvature(g) { const n = g.attributes.normal.array, idx = g.index.array, nV = n.length / 3, s = new Float32Array(nV), c = new Float32Array(nV);
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = idx[t + k], b = idx[t + (k + 1) % 3]; const d = Math.hypot(n[a * 3] - n[b * 3], n[a * 3 + 1] - n[b * 3 + 1], n[a * 3 + 2] - n[b * 3 + 2]); s[a] += d; s[b] += d; c[a]++; c[b]++; }
  let mx = 0; for (let i = 0; i < nV; i++) { s[i] = c[i] ? s[i] / c[i] : 0; if (s[i] > mx) mx = s[i]; }
  const q = [...s].sort((a, b) => a - b)[Math.floor(nV * 0.95)] || mx || 1; for (let i = 0; i < nV; i++) s[i] = Math.min(1, s[i] / q); return s; }
function applyLook() {
  for (const m of meshes) { m.material = FIN[st.finish]; m.visible = st.draw !== 'wire'; }
  const planes = st.slice && !walk.on ? [clip] : [];
  for (const k in FIN) FIN[k].clippingPlanes = planes;
  wireMat.color.set(st.bg === '#f3efe6' ? 0x223 : 0xffffff); wireMat.opacity = st.draw === 'wire' ? 0.8 : 0.3; wireMat.clippingPlanes = planes;
}

// ---------- the walk ----------
// You stand on the surface and walk across it. Each step goes the way you're facing, flattened onto the surface, and turned
// into a change of (u, v) through the surface's own stretching (its metric). "Up" is carried along continuously instead of
// being read off the formula, so on a one-sided surface, after going round, the formula's "up" points the other way to yours:
// you are on the "other" side, which was the same side all along. Where the surface joins up (a seam in u or v), the walker
// finds which point across the seam is where it is standing and carries on from there; at an open edge it turns back.
const walk = { on: false, u: 0, v: 0, d: new V3(), up: new V3(), side0: 1, side: 1, flips: 0, dist: 0, yaw: 0, pitch: 0, pivotQ: new THREE.Quaternion() };
const walkClock = new Groove();
function frameAt(u, v) {   // point, the two directions along u and v, and the surface's normal from the formula
  const s = sh(), P = st.P[st.shape], hu = (s.u[1] - s.u[0]) * 1e-4, hv = (s.v[1] - s.v[0]) * 1e-4, f = (a, b) => { const q = s.f(a, b, P); return q && q.every(Number.isFinite) ? new V3(q[0] - centre.x, q[1] - centre.y, q[2] - centre.z) : null; };
  const p = f(u, v), a = f(u + hu, v), b = f(u - hu, v), c = f(u, v + hv), d = f(u, v - hv); if (!p || !a || !b || !c || !d) return null;
  const fu = a.sub(b).divideScalar(2 * hu), fv = c.sub(d).divideScalar(2 * hv), n = fu.clone().cross(fv);
  return { p, fu, fv, n: n.length() > 1e-9 ? n.normalize() : null };
}
function startWalk() {
  const s = sh(); let F = null, u = 0, v = 0;
  for (const [a, b] of [[0.3, 0.5], [0.25, 0.4], [0.6, 0.55], [0.4, 0.3], [0.7, 0.7]]) { u = s.u[0] + (s.u[1] - s.u[0]) * a; v = s.v[0] + (s.v[1] - s.v[0]) * b; F = frameAt(u, v); if (F && F.n) break; }
  if (!F || !F.n) return;
  Object.assign(walk, { on: true, u, v, flips: 0, dist: 0, yaw: 0, pitch: 0 }); walk.d.copy(F.fu).normalize(); walk.up.copy(F.n); walk.side0 = walk.side = 1;
  walk.pivotQ.copy(S.pivot.quaternion); S.vel.x = S.vel.y = 0; st.paused = false;
  if (oneSided() && !st.twoSide) setCheck('twoSide', true);   // seeing the two "sides" in different colours is the point of walking a one-sided surface
  applyLook(); labels();
}
function endWalk() { if (!walk.on) return; walk.on = false; walkLight.intensity = 0; S.camera.up.set(0, 1, 0); S.camera.quaternion.identity(); S.reset(); S.resize(); applyLook(); labels(); }
const oneSided = () => { const s = sh(); return s.stats(st.P[st.shape]).some(([v, l]) => v === '1' && /^side/.test(l)); };
// across a seam: the point on the other side of the (u, v) domain that matches where we should be
function reseat(u, v, want) {
  const s = sh(), U = s.u[1] - s.u[0], Vr = s.v[1] - s.v[0], inU = x => x >= s.u[0] && x <= s.u[1], inV = y => y >= s.v[0] && y <= s.v[1];
  // candidates: shifted by a whole or half period, or mirrored about the ends, the middle or the quarter points (the Klein
  // bottle glues (π, v) to (0, π − v)), each brought back into range
  const cands = (x, lo, hi) => { const W = hi - lo, into = y => { while (y < lo) y += W; while (y > hi) y -= W; return y; }, out = new Set();
    for (const y of [x, x + W / 2, ...[lo, hi, (lo + hi) / 2, lo + W / 4, lo + 3 * W / 4].map(c => 2 * c - x)]) out.add(into(y)); return [...out]; };
  const us = cands(u, s.u[0], s.u[1]), vs = cands(v, s.v[0], s.v[1]);
  let best = null, bd = Infinity;
  for (const a of us) if (inU(a)) for (const b of vs) if (inV(b)) { const q = s.f(a, b, st.P[st.shape]); if (!q || !q.every(Number.isFinite)) continue; const d = want.distanceTo(new V3(q[0] - centre.x, q[1] - centre.y, q[2] - centre.z)); if (d < bd) { bd = d; best = [a, b]; } }
  return bd < 0.06 * ext ? best : null;
}
function stepWalk(dt) {
  const s = sh(), k = drive();
  if (S.pointers.size || Math.abs(S.vel.x) + Math.abs(S.vel.y) > 1e-5) { walk.yaw -= S.vel.x * 1.2; walk.pitch -= S.vel.y * 1.2; S.vel.x = S.vel.y = 0; }
  S.pivot.quaternion.copy(walk.pivotQ);   // the surface stays put while you walk on it
  let F = frameAt(walk.u, walk.v); if (!F) { endWalk(); return; }
  if (F.n) { const n = F.n.clone(); if (n.dot(walk.up) < 0) n.negate(); walk.up.lerp(n, 0.6).normalize();
    const side = F.n.dot(walk.up) >= 0 ? 1 : -1; if (side !== walk.side) { walk.side = side; walk.flips++; } }
  // steering: arrows (left / right) turn your heading on the surface, up / down tilt your gaze; A / D step sideways; W / S lean on the pace
  const f = (k.fast ? 3 : 1) * k.scale;
  if (k.any) { walk.d.applyAxisAngle(walk.up, -k.turnX * 1.5 * f * dt); walk.pitch = clamp(walk.pitch + k.turnY * 0.9 * f * dt, -1.1, 0.9); }
  else if (!S.pointers.size) { walk.yaw *= Math.exp(-dt * 1.2); walk.pitch *= Math.exp(-dt * 0.8); }
  if (st.autoRound) {   // "go the long way round": keep heading along u, and on a strip with open edges drift back toward its middle
    const fu = F.fu.clone().normalize(), target = fu.dot(walk.d) >= 0 ? fu : fu.negate();
    if (!s.wrapV && !s.closed) { const vm = (s.v[0] + s.v[1]) / 2, off = (walk.v - vm) / ((s.v[1] - s.v[0]) / 2); target.addScaledVector(F.fv.clone().normalize(), -0.8 * off); target.normalize(); }
    walk.d.lerp(target, Math.min(1, dt * 1.5)); }
  walk.d.addScaledVector(walk.up, -walk.d.dot(walk.up)).normalize();
  const pace = 0.38 * st.walkSpeed * (ext / 2.6) * (k.any ? 1 + k.slideY * 0.8 : 1);
  if (!st.paused) {
    let ds = walkClock.delta(dt, pace, pace * 0.5);   // with a steady beat, each beat is a stride
    const side = walk.d.clone().cross(walk.up).normalize(), move = walk.d.clone().multiplyScalar(ds).addScaledVector(side, k.any ? k.slideX * pace * dt : 0);
    // into a change of (u, v): solve the 2×2 system given by the surface's stretching
    const E = F.fu.dot(F.fu), Fm = F.fu.dot(F.fv), G = F.fv.dot(F.fv), a = F.fu.dot(move), b = F.fv.dot(move), det = E * G - Fm * Fm;
    let du = 0, dv = 0; if (det > 1e-12) { du = (G * a - Fm * b) / det; dv = (E * b - Fm * a) / det; } else { du = (s.u[1] - s.u[0]) * 0.002; }   // a pinch point: step over it
    let nu = walk.u + du, nv = walk.v + dv; const want = F.p.clone().add(move);
    if (nu < s.u[0] || nu > s.u[1] || nv < s.v[0] || nv > s.v[1]) {
      const r = (s.wrapU || s.wrapV || s.closed || nu < s.u[0] || nu > s.u[1] || nv < s.v[0] || nv > s.v[1]) ? reseat(nu, nv, want) : null;
      if (r) { nu = r[0]; nv = r[1]; }
      else {   // an open edge: turn back, as if bumping into a rail
        const e = (nu < s.u[0] || nu > s.u[1] ? F.fu : F.fv).clone().normalize(); walk.d.addScaledVector(e, -2 * walk.d.dot(e)).normalize();
        nu = clamp(nu, s.u[0], s.u[1]); nv = clamp(nv, s.v[0], s.v[1]); }
    }
    const F2 = frameAt(nu, nv); if (F2) { walk.u = nu; walk.v = nv; walk.dist += Math.abs(ds); F = F2; } else { walk.d.negate(); }
  }
  // the camera: standing a little above the surface, looking where you're heading
  const eye = F.p.clone().addScaledVector(walk.up, 0.035 * ext), side = walk.d.clone().cross(walk.up).normalize();
  const dir = walk.d.clone().applyAxisAngle(walk.up, walk.yaw).applyAxisAngle(side, walk.pitch - 0.18);
  S.fit.updateMatrixWorld(true); const M = S.fit.matrixWorld, wEye = eye.applyMatrix4(M);
  S.camera.position.copy(wEye); S.camera.up.copy(walk.up.clone().transformDirection(M)); S.camera.lookAt(wEye.clone().add(dir.transformDirection(M)));
  if (S.camera.fov !== 78) { S.camera.fov = 78; S.camera.updateProjectionMatrix(); }
  walkLight.position.copy(wEye); walkLight.intensity = 0.6; walkLight.distance = 2.2;
}

// ---------- panel ----------
{ const box = $('shapeLists');
  box.innerHTML = GROUPS.map(([g, label]) => `<div class="shapeGroup"><div class="lbl">${label}</div><div class="seg g2 shapes">${Object.entries(SHAPES).filter(([, s]) => s.group === g).map(([k, s]) => `<button data-s="${k}">${s.name}</button>`).join('')}</div></div>`).join('');
  box.addEventListener('click', e => { const b = e.target.closest('button[data-s]'); if (b) pickShape(b.dataset.s); }); }
function pickShape(k, keepView) {
  if (!SHAPES[k]) return; const was = walk.on; if (was) endWalk(); st.shape = k; st.anim = { on: false, t: 0 }; st.gap = 0;
  document.querySelectorAll('#shapeLists button').forEach(b => b.classList.toggle('on', b.dataset.s === k));
  buildParams(); build(); labels(); share.touch(); if (!keepView) { S.vel.x = S.vel.y = 0; if (SHAPES[k].view) S.pivot.quaternion.setFromEuler(new THREE.Euler(...SHAPES[k].view)); }   // a shape that reads best from one side starts there
  if (was) startWalk();
}
function buildParams() {
  const s = sh(), P = st.P[st.shape], box = $('params'); $('paramSec').hidden = !(s.params || []).length;
  box.innerHTML = (s.params || []).map(p => `<div class="row"><span style="width:74px">${p.label}</span><input type="range" id="pp_${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.id]}"><output id="pp_${p.id}o">${P[p.id]}</output></div>`).join('');
  for (const p of s.params || []) $('pp_' + p.id).addEventListener('input', e => { P[p.id] = +e.target.value; $('pp_' + p.id + 'o').textContent = p.step < 1 ? (+e.target.value).toFixed(2) : e.target.value; if (p.id === 'mo') st.anim.on = false; build(); labels(); share.touch(); });
  const play = s.band ? ['Cut down the middle', 'Cuts the band along its middle line. Press again to join it back up.'] : s.params && s.params.some(p => p.id === 'mo') ? ['Bend it', 'Bends the catenoid into the helicoid and back, again and again.'] : null;
  $('playBtn').hidden = !play; if (play) { $('playBtn').textContent = play[0]; $('playNote').textContent = play[1] + ' (N)'; } else $('playNote').textContent = '';
}
function labels() {
  const s = sh(), P = st.P[st.shape];
  $('title').textContent = s.name; $('subtitle').textContent = s.alt; $('gv-shapes').textContent = s.name; $('about').innerHTML = `<strong>${s.name}.</strong> ${s.info}`;
  $('walkBtn').textContent = walk.on ? 'Stop walking' : 'Walk on it'; $('gv-ctl').textContent = walk.on ? 'walking' : '';
  $('hint').textContent = walk.on ? '← →: turn · ↑ ↓: look · A D: step sideways · W S, + −: pace · T: go the long way round · G: stop' : 'Drag to turn · scroll / pinch to zoom · G to walk on the surface';
  stats();
  let cap = '';
  if (s.band && st.gap > 0.02) cap = P.tw % 2 ? `<b>Cut down the middle.</b> With ${P.tw} half twist${P.tw > 1 ? 's' : ''}, the cut leaves <b>one</b> band, twice as long, with ${P.tw * 2 + 2} half twists.` : P.tw ? `<b>Cut down the middle.</b> With ${P.tw} half twists the cut leaves <b>two</b> bands, linked together, each with ${P.tw} half twists.` : '<b>Cut down the middle.</b> With no twist, you simply get two separate loops.';
  else if (walk.on && oneSided() && walk.flips > 0) cap = walk.side === walk.side0 ? '<b>Back where you started.</b> Twice round and you are on the side you began on.' : '<b>You are on the "other" side.</b> You never crossed an edge: there was only ever one side.';
  else if (st.twoSide && !walk.on) cap = s.stats(P)[1][0] === '1' ? '<b>One side.</b> Follow the colour round: where the surface joins up, the colour swaps, because there was only ever one side.' : '<b>Two sides.</b> The colour never swaps: inside stays inside.';
  const el = $('stageCap'); el.innerHTML = cap; el.style.display = cap ? 'block' : 'none';
}
function stats() {
  const s = sh(), P = st.P[st.shape];
  if (walk.on) { setStats([(walk.dist / ext).toFixed(1) + '×', 'walked (shape widths)'], [walk.side === walk.side0 ? 'start side' : 'the other', 'side you are on'], [String(walk.flips), walk.flips === 1 ? 'flip' : 'flips']);
    $('statNote').textContent = oneSided() ? 'A one-sided surface: keep walking the long way round (T) and you come back on the "other" side, without crossing any edge.' : 'A two-sided surface: however you walk, you stay on the side you started on.'; }
  else { setStats(...s.stats(P)); $('statNote').textContent = ''; }
}
$('walkBtn').addEventListener('click', () => go());
$('playBtn').addEventListener('click', () => play());
$('walkSpeed').addEventListener('input', e => { st.walkSpeed = +e.target.value; $('walkSpeedo').textContent = st.walkSpeed.toFixed(1) + '×'; share.touch(); });
$('autoRound').addEventListener('change', e => { st.autoRound = e.target.checked; share.touch(); });
$('spin').addEventListener('change', e => { st.spin = e.target.checked; share.touch(); });
$('speed').addEventListener('input', e => { st.speed = +e.target.value; $('speedo').textContent = st.speed.toFixed(1) + '×'; share.touch(); });
$('sliceChk').addEventListener('change', e => { st.slice = e.target.checked; $('sliceRow').hidden = !st.slice; applyLook(); share.touch(); });
$('slice').addEventListener('input', e => { st.sliceAt = +e.target.value; $('sliceo').textContent = st.sliceAt.toFixed(2); share.touch(); });
$('detail').addEventListener('input', e => { st.detail = +e.target.value; $('detailo').textContent = st.detail; build(); share.touch(); });
segClick('drawMode', d => { st.draw = d.d; build(); share.touch(); });
segClick('cmode', d => { st.cmode = d.c; recolour(); share.touch(); });
$('twoSide').addEventListener('change', e => { st.twoSide = e.target.checked; recolour(); labels(); share.touch(); });
buildSwatches($('palettes'), st.palette, name => { st.palette = name; palLabel(); recolour(); share.touch(); });
const palLabel = () => { $('palName').textContent = 'Palette: ' + st.palette.replace('_', ' & ').replace(/^./, c => c.toUpperCase()) + (st.palRev ? ' (reversed)' : ''); };
$('palRev').addEventListener('change', e => { st.palRev = e.target.checked; palLabel(); recolour(); share.touch(); });
$('cyc').addEventListener('input', e => { st.cycleSpeed = +e.target.value; $('cyco').textContent = st.cycleSpeed ? st.cycleSpeed.toFixed(1) + '×' : 'off'; share.touch(); });
segClick('finish', d => { st.finish = d.f; applyLook(); share.touch(); });
segClick('bg', d => { st.bg = d.b; lightStage(); S.setBackground(st.bg); applyLook(); share.touch(); });
segClick('prSize', d => { st.mm = +d.mm; });
$('prThick').addEventListener('input', e => { st.thick = +e.target.value; $('prThicko').textContent = st.thick.toFixed(1) + ' mm'; });
$('snap').addEventListener('click', () => { S.render(); saveCanvasPNG(canvas, fileName(sh().name) + '.png', $('dlnote')); });
document.querySelectorAll('.btn.try').forEach(b => b.addEventListener('click', () => { const [k, tw, act] = b.dataset.try.split('|'); endWalk(); if (tw) st.P[k].tw = +tw; pickShape(k);
  if (act === 'cut') st.anim = { on: true, t: 0 }; if (act === 'walk') { setCheck('autoRound', true); startWalk(); } }));
buildKeys($('keyTable'), [['G', 'Walk on the surface / stop walking'], ['N', 'Play: cut the band, or bend the soap film'], ['← →', 'Turn the shape (walking: turn your heading)'], ['↑ ↓', 'Turn the shape (walking: look up and down)'], ['W A S D', 'Slide the view (walking: W S pace, A D step sideways)'], ['T', 'Walking: keep going the long way round'], ['1 – 3', 'Surfaces, curved surfaces, minimal surfaces'], ['Shift', 'Hold with the keys above to go three times faster']]);

// ---------- actions ----------
function go() { st.paused = false; if (walk.on) endWalk(); else startWalk(); }
function play() { const s = sh(); st.paused = false;
  if (s.band) { if (walk.on) endWalk(); st.anim = st.gap > 0.01 ? { on: true, t: 0, close: true } : { on: true, t: 0 }; return; }
  if (s.params && s.params.some(p => p.id === 'mo')) { st.anim.on = !st.anim.on; return; }
  st.spin = !st.spin; $('spin').checked = st.spin; }
function resetView() { endWalk(); S.reset(); st.paused = false; st.anim = { on: false, t: 0 }; if (st.gap) { st.gap = 0; build(); labels(); } share.touch(); }
function moving() { return walk.on || st.spin || st.anim.on || st.cycleSpeed > 0 || MO.moving(); }

// ---------- loop ----------
const clk = { morph: new Phase() };
// Rotation & motion (its own group): turning, rocking, tumbling, the camera's zoom and drift, and Slowly change (any shape slider)
const MO = makeMotion3D(S, { spinRow: $('spin').closest('label'), speedRow: $('speed').closest('.row'), rate: () => 0.35, spinOn: () => st.spin, speed: () => st.speed,
  sweep: { skip: ['speed', 'walkSpeed', 'detail'] } });
const REC = addRecorder({ stage: canvas.parentElement, name: () => sh().name, bg: () => st.bg });
// the Visualizer: a new surface, palette or slow change every eight bars; when the chorus comes in, a new surface
// with one of its own numbers slowly changing
makeVisualizer(MO, { preset: 'mvt=0.25&mvb=0.35&mvd=0.3', shape: () => (walk.on ? false : pickButton('#shapeLists button')),
  drop: () => { if (walk.on) return; pickButton('#shapeLists button'); const ids = MO.sweep.list().filter(id => id.startsWith('pp_')); if (ids.length) MO.sweep.pick(ids[Math.floor(Math.random() * ids.length)]); } });
let running = false, tPrev = 0, frame = 0;
function loop(now) {
  if (!running) return; const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now; frame++;
  setPausedTag(st.paused); const goOn = !st.paused;
  const s = sh(), P = st.P[st.shape];
  if (goOn && st.anim.on) {
    if (s.band) { st.anim.t += dt / 1.6; const u = Math.min(1, st.anim.t), e = u * u * (3 - 2 * u); st.gap = 0.22 * (st.anim.close ? 1 - e : e); if (u >= 1) { st.anim.on = false; if (st.anim.close) st.gap = 0; } build(); labels(); }
    else if ('mo' in P) { st.anim.t = clk.morph.step(st.anim.t, dt * energyMul(), 2 * Math.PI, cycleBeats(2), 0.6); P.mo = 0.5 - 0.5 * Math.cos(st.anim.t); const el = $('pp_mo'); if (el) { el.value = P.mo; $('pp_moo').textContent = P.mo.toFixed(2); } build(); labels(); }
  }
  if (walk.on) { MO.step(dt, { away: true, go: goOn }); stepWalk(dt); }
  else { S.step(dt); MO.step(dt, { go: goOn, spin: !S.pointers.size }); }
  // the music: vocals sway the soap film's bend a little; beats flash or pulse; colour drifts
  const vo = voice(); if (vo && 'mo' in P && !st.anim.on && !walk.on) { const keep = P.mo; P.mo = clamp(keep + 0.06 * vo, 0, 1); build(); P.mo = keep; }
  const cs = goOn ? colourStep(dt) : 0; if ((goOn && st.cycleSpeed > 0) || cs) { st.cycle = (st.cycle + (goOn ? dt * st.cycleSpeed * 0.06 : 0) + cs) % 1; recolour(); }
  S.fit.scale.setScalar(2.6 / ext * (walk.on ? 1 : 1 + 0.05 * pulse())); S.setFlash(flash());
  if (st.slice && !walk.on) { clip.normal.set(0, 0, -1).applyQuaternion(S.pivot.quaternion); clip.constant = st.sliceAt * 1.3; }
  S.render(); if (walk.on && frame % 10 === 0) labels(); if (frame % 30 === 0) share.touch();   // keep the link up to date as the view is turned
  requestAnimationFrame(loop);
}

// ---------- 3D print ----------
$('prBtn').addEventListener('click', () => {
  const s = sh(), P = st.P[st.shape], note = $('prNote'), mmPerUnit = st.mm / (ext * 1.02), half = st.thick / 2 / mmPerUnit;
  const T = thicken(s, P, 140, half);
  for (let i = 0; i < T.length; i += 3) { const y = T[i + 1], z = T[i + 2]; T[i + 1] = -z; T[i + 2] = y; }   // the explorer's up (y) becomes the printer's up (z)
  const r = stlFromTriangles(T, st.mm, 'Math Explorer surface');
  saveFile(fileName(s.name) + `_${st.mm}mm.stl`, r.bytes, note).then(ok => { if (ok) note.textContent += ` ${r.size.map(v => Math.round(v)).join(' × ')} mm, ${r.tris.toLocaleString()} triangles.`; });
});
// a surface given thickness: pushed out both ways along its normals, with walls along any open edge
function thicken(s, P, n, h) {
  const m = gridMesh(s, P, n, s.band ? st.gap : 0), W = m.nu + 1, du = 1e-4;
  const [u0, u1] = s.u, [v0, v1] = s.v, T = [];
  const nrm = (i, j, sheet) => { const v = m.sheets > 1 ? (sheet ? [st.gap, v1] : [v0, -st.gap]) : [v0, v1];
    const u = u0 + (u1 - u0) * i / m.nu, vv = v[0] + (v[1] - v[0]) * j / m.nv, a = s.f(u + du, vv, P), b = s.f(u - du, vv, P), c = s.f(u, vv + du, P), d = s.f(u, vv - du, P);
    if (!a || !b || !c || !d) return [0, 1, 0];   // next to a point the shape leaves out: this corner isn't printed anyway
    const pu = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], pv = [c[0] - d[0], c[1] - d[1], c[2] - d[2]], x = [pu[1] * pv[2] - pu[2] * pv[1], pu[2] * pv[0] - pu[0] * pv[2], pu[0] * pv[1] - pu[1] * pv[0]], l = Math.hypot(...x);
    return l > 1e-12 ? x.map(q => q / l) : s.closed ? [0, 0, 0] : [0, 1, 0]; };   // a pinch point of a closed surface: both sides of the shell meet there
  for (let sh2 = 0; sh2 < m.sheets; sh2++) {
    const base = sh2 * (m.nv + 1) * W, top = [], bot = [];
    for (let j = 0; j <= m.nv; j++) for (let i = 0; i <= m.nu; i++) { const k = base + j * W + i, p = [m.pos[k * 3], m.pos[k * 3 + 1], m.pos[k * 3 + 2]], q = nrm(i, j, sh2);
      top.push(p.map((x, a) => x + q[a] * h)); bot.push(p.map((x, a) => x - q[a] * h)); }
    const at = (A, i, j) => A[j * W + i], tri = (a, b, c) => T.push(...a, ...b, ...c), k = (i, j) => j * W + i;
    // a grid square is solid when all four corners are points the shape keeps; walls close every edge where a solid square
    // meets a missing one or the end of a strip that doesn't wrap round. Closed surfaces (Klein bottle, projective planes)
    // glue their parameter edges to each other: the two sides of the shell already meet there, so those edges get no walls
    const keep = (i, j) => { if (s.wrapU) i = (i + m.nu) % m.nu; if (s.wrapV) j = (j + m.nv) % m.nv; if (i < 0 || j < 0 || i >= m.nu || j >= m.nv) return !!s.closed;
      return !m.bad || ![k(i, j), k(i + 1, j), k(i, j + 1), k(i + 1, j + 1)].some(q => m.bad[base + q]); };
    const wall = (a, b) => { tri(top[a], top[b], bot[b]); tri(top[a], bot[b], bot[a]); };
    for (let j = 0; j < m.nv; j++) for (let i = 0; i < m.nu; i++) { if (!keep(i, j)) continue;
      tri(at(top, i, j), at(top, i, j + 1), at(top, i + 1, j)); tri(at(top, i + 1, j), at(top, i, j + 1), at(top, i + 1, j + 1));
      tri(at(bot, i, j), at(bot, i + 1, j), at(bot, i, j + 1)); tri(at(bot, i + 1, j), at(bot, i + 1, j + 1), at(bot, i, j + 1));
      if (!keep(i, j - 1)) wall(k(i + 1, j), k(i, j)); if (!keep(i, j + 1)) wall(k(i, j + 1), k(i + 1, j + 1));
      if (!keep(i - 1, j)) wall(k(i, j), k(i, j + 1)); if (!keep(i + 1, j)) wall(k(i + 1, j + 1), k(i + 1, j)); }
  }
  return T;
}

// ---------- keys, sharing, lifecycle ----------
export function onKey(e) {
  if (e.key === 't' || e.key === 'T') { setCheck('autoRound', !st.autoRound); return true; }
  return standardKeys(e, {
    pause: () => { if (st.paused) st.paused = false; else if (moving()) st.paused = true; else { st.spin = true; $('spin').checked = true; } },
    go, reset: resetView, renew: () => play(),
    shape: dir => clickNext('#shapeLists button', dir), palette: dir => clickNext('#palettes button', dir), colourMode: dir => clickNext('#cmode button', dir),
    reverse: () => $('palRev').click(), cycle: () => setRange('cyc', st.cycleSpeed > 0 ? 0 : 1),
    zoom: f => { if (walk.on) setRange('walkSpeed', clamp(st.walkSpeed / f, 0.1, 3)); else S.zoom(f); },
    mode: i => { const g = GROUPS[i]; if (g) pickShape(Object.keys(SHAPES).find(k => SHAPES[k].group === g[0])); },
  });
}
const encode = () => { const p = new URLSearchParams(), P = st.P[st.shape]; p.set('s', st.shape); for (const k in P) p.set(k, r4(P[k]));
  p.set('d', st.detail); if (st.draw !== 'solid') p.set('dr', st.draw);
  p.set('cm', st.cmode); if (st.twoSide) p.set('two', 1); p.set('pal', st.palette); if (st.palRev) p.set('rev', 1); if (st.cycleSpeed) p.set('cyc', st.cycleSpeed);
  p.set('fin', st.finish); if (st.bg !== '#0b0d12') p.set('bg', st.bg.slice(1)); if (!st.spin) p.set('sp', 0); if (st.speed !== 0.5) p.set('spd', st.speed); if (st.slice) p.set('sl', r4(st.sliceAt));
  if (st.walkSpeed !== 1) p.set('ws', st.walkSpeed); if (st.autoRound) p.set('ar', 1);
  const q = walk.on ? walk.pivotQ : S.pivot.quaternion; p.set('q', [q.x, q.y, q.z, q.w].map(r4).join('_')); if (!walk.on) p.set('z', r4(MO.baseZ())); MO.encode(p); return p.toString(); };
function apply(code) {
  const p = new URLSearchParams(code); if (!SHAPES[p.get('s')]) return false; const k = p.get('s'); endWalk();
  for (const q of SHAPES[k].params || []) st.P[k][q.id] = clamp(num(p, q.id, q.def), q.min, q.max);
  setRange('detail', num(p, 'd', 3)); clickData('#drawMode', 'd', p.get('dr') || 'solid');
  clickData('#cmode', 'c', p.get('cm') || 'height'); setCheck('twoSide', p.get('two') === '1'); clickData('#palettes', 'pal', p.get('pal') || 'aurora'); setCheck('palRev', p.get('rev') === '1');
  setRange('cyc', num(p, 'cyc', 0)); clickData('#finish', 'f', p.get('fin') || 'satin'); clickData('#bg', 'b', '#' + (p.get('bg') || '0b0d12'));
  setCheck('spin', p.get('sp') !== '0'); setRange('speed', num(p, 'spd', 0.5)); setCheck('sliceChk', p.has('sl')); if (p.has('sl')) setRange('slice', num(p, 'sl', 0));
  setRange('walkSpeed', num(p, 'ws', 1)); setCheck('autoRound', p.get('ar') === '1');
  pickShape(k, true);
  const q = (p.get('q') || '').split('_').map(Number); if (q.length === 4 && q.every(isFinite)) S.pivot.quaternion.set(...q).normalize();
  const z = num(p, 'z', 0); if (z > 0) S.camera.position.z = clamp(z, 1.2, 14);
  MO.decode(p);
  return true;
}
const share = makeShare('surface', encode, apply);
// the Paper background: dark stage text (as in Fractals); removed again when you leave this explorer
function lightStage() { document.getElementById('app').classList.toggle('light', st.bg === '#f3efe6'); }
MO.onChange = () => share.touch();
palLabel();
if (!apply(parseRoute().code)) pickShape('band');
export function start() { lightStage(); S.resize(); running = true; tPrev = performance.now(); requestAnimationFrame(loop); share.write(); }
export function stop() { running = false; REC.stop(); document.getElementById('app').classList.remove('light'); }
export const reset = resetView;
export const layoutChanged = () => S.resize();
export const showView = code => apply(code);
export const soundHelp = 'Here, each beat flashes the light brighter (or, with Pulse, gives the shape a little bounce). Tempo times the turning and everything under Rotation & motion (rocking, tumbling, zooming in and out, Slowly change), and the soap film\'s bending; when you walk on a surface, each beat is a stride. Vocals sway the bend gently, energy sets the pace, and colour drifts the palette.';
