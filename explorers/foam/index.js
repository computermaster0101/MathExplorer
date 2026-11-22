// Foams explorer: crystal foams, the Frank–Kasper family (Weaire–Phelan and its relatives), random and settled foams, bubbles in
// a tube, flat foams and the double bubble; drawn as soap films, as separate bubbles or as their edges, and flown through.
// Importing this module boots the explorer; the exports are the lifecycle the shell (js/main.js) drives.
import * as THREE from 'three';
import { $, clamp, segClick, clickNext, setRange, setCheck, clickData, setStats, buildSwatches, rampCss, r4, num, standardKeys, buildKeys, makeShare } from '../../js/common/kit.js';
import { rampOf, sampleRamp, sampleMirror } from '../../js/common/palettes.js';
import { makeStage3D, makeFinishes } from '../../js/common/three-stage.js';
import { saveCanvasPNG, saveFile, fileName } from '../../js/common/save.js';
import { stlFromTriangles, tubeTriangles } from '../../js/common/stl.js';
import { makeMotion3D, addRecorder } from '../../js/common/motion.js';
import { makeVisualizer, pickButton } from '../../js/common/visualizer.js';
import { flashFx as flash, pulseFx as pulse, voiceFx as voice, colourStep, Groove } from '../../js/shell/audio/react.js';
import { setPausedTag, drive } from '../../js/shell/keys.js';
import { parseRoute } from '../../js/shell/route.js';
import { FOAMS, GROUPS, defaults, build, cells, settle, kinds, wallScore, volume, doubleBubble } from './foams.js';

// ---------- state ----------
const st = { foam: 'kelvin', P: {}, seed: 1, draw: 'films', explode: 0, amount: 3, piece: 'ball', edgeW: 0.35, only: 0, cmode: 'faces', palette: 'aurora', palRev: false,
  cycle: 0, cycleSpeed: 0, finish: 'bubble', bg: '#0b0d12', spin: true, speed: 0.4, flySpeed: 1, paused: false, mm: 80 };
for (const k in FOAMS) st.P[k] = defaults(FOAMS[k]);
const fm = () => FOAMS[st.foam];
const KELVIN = 5.315;

// ---------- the 3D stage ----------
const canvas = $('fc'), S = makeStage3D(canvas, { z: 6 }), FIN = makeFinishes(), V3 = THREE.Vector3;
S.addFlash(FIN.flat); S.addFlash(FIN.bubble);   // the finishes the lights don't reach still flash on the beat
const edgeMat = new THREE.MeshStandardMaterial({ color: 0xe9eef8, roughness: 0.35, metalness: 0.2 }), tubeMat = S.addFlash(new THREE.MeshBasicMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
const flyLight = new THREE.PointLight(0xffffff, 0, 3, 1.4); S.scene.add(flyLight);
let objs = [], ext = 1, built = null, shown = [], live = null, colourOf = [];
function clearScene() { for (const o of objs) { S.fit.remove(o); o.geometry.dispose(); } objs = []; }

// the repeating bubbles, built (and cached) for the current foam and settings; while settling, the live copy instead
const current = () => live || build(st.foam, st.P[st.foam], st.seed);

// ---------- the piece you see: the repeating bubbles, copied and cut to a ball, a cube, a length of tube or a disc ----------
const AMOUNT = [0, 8, 27, 60, 110, 180], TUBE_LEN = [0, 3, 5, 7.5, 10, 14], FLAT_N = [0, 12, 30, 60, 100, 160];
const tubeLen = () => (fly.on ? 30 : TUBE_LEN[st.amount]);   // flying down a tube: a long stretch, so its ends stay far out of sight
function cutPiece(B) {
  const f = fm(), d = B.def, A = d.A, C = B.cells.filter(c => c.poly.length), N = C.length || 1, per = d.per;
  const boxV = Math.abs(A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]));
  const O = C.reduce((s, c) => s.add(new V3(...c.c)), new V3()).multiplyScalar(1 / N);   // the middle of one repeat: the piece is centred on it
  let inside, K;
  if (f.tube) { const L = tubeLen(); inside = p => Math.abs(p.z - O.z) <= L / 2; K = [0, 0, Math.ceil(L / A[2][2] / 2) + 1]; }
  else if (f.flat) { const a = Math.hypot(...crossA(A[0], A[1])) / N, R = Math.sqrt(FLAT_N[st.amount] * a / Math.PI);
    inside = st.piece === 'ball' ? p => Math.hypot(p.x - O.x, p.y - O.y) <= R : p => Math.max(Math.abs(p.x - O.x), Math.abs(p.y - O.y)) <= R * 0.886; K = [Math.ceil(R / minLen(A)) + 2, Math.ceil(R / minLen(A)) + 2, 0]; }
  else { const Vb = boxV / N, M = AMOUNT[st.amount], R = Math.cbrt(3 * M * Vb / (4 * Math.PI)), H = Math.cbrt(M * Vb) / 2;
    inside = st.piece === 'ball' ? p => p.distanceTo(O) <= R : p => Math.max(Math.abs(p.x - O.x), Math.abs(p.y - O.y), Math.abs(p.z - O.z)) <= H; const k = Math.ceil(R / minLen(A)) + 2; K = [k, k, k]; }
  const out = [], ids = new Set();
  for (let i = -K[0]; i <= K[0]; i++) for (let j = -K[1]; j <= K[1]; j++) for (let k = -K[2]; k <= K[2]; k++) {
    const T = new V3(A[0][0] * i + A[1][0] * j + A[2][0] * k, A[0][1] * i + A[1][1] * j + A[2][1] * k, A[0][2] * i + A[1][2] * j + A[2][2] * k);
    B.cells.forEach((cell, a) => { if (!cell.poly.length) return; const c = new V3(...cell.c).add(T); if (!inside(c)) return;
      const n = cell.poly.filter(q => q.nb !== 'wall' && q.nb !== 'plate').length; if (st.only && n !== st.only) return;
      const gid = `${a}|${i}|${j}|${k}`; ids.add(gid); out.push({ gid, a, ijk: [i, j, k], c, n, vol: volume(cell.poly, cell.c), poly: cell.poly.map(q => ({ p: q.p.map(p => new V3(p[0] + T.x, p[1] + T.y, p[2] + T.z)), nb: q.nb })) }); });
  }
  for (const s of out) for (const q of s.poly) q.other = Array.isArray(q.nb) ? `${q.nb[0]}|${s.ijk[0] + q.nb[1][0]}|${s.ijk[1] + q.nb[1][1]}|${s.ijk[2] + q.nb[1][2]}` : null;
  return { cells: out, ids, O };
}
const crossA = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], minLen = A => Math.min(...A.map(v => Math.hypot(...v)).filter(x => x > 1e-9));
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

// ---------- drawing ----------
function rebuild() {
  clearScene(); const f = fm();
  if (f.exact) { drawDouble(); return; }
  const B = current(), piece = cutPiece(B); shown = piece.cells; built = B;
  const nn = shown.map(s => s.n), vv = shown.map(s => s.vol), ys = shown.map(s => s.c.y), lo = a => Math.min(...a), hi = a => Math.max(...a);
  const tOf = s => { switch (st.cmode) {
    case 'faces': return hi(nn) > lo(nn) ? (s.n - lo(nn)) / (hi(nn) - lo(nn)) : 0.55;
    case 'size': return hi(vv) > lo(vv) * 1.001 ? (s.vol - lo(vv)) / (hi(vv) - lo(vv)) : 0.55;
    case 'each': return hash(s.gid); case 'height': return hi(ys) > lo(ys) ? (s.c.y - lo(ys)) / (hi(ys) - lo(ys)) : 0.5; default: return 0.6; } };
  const ex = st.explode, solid = st.draw === 'cells', films = st.draw === 'films', apart = ex > 0.001 || solid, mid = piece.O;
  const pos = [], nor = [], cell = [], E = new Map(), key = p => `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`;
  shown.forEach((s, si) => {
    const shrink = solid ? 0.9 : 1, push = s.c.clone().sub(mid).multiplyScalar(ex * 0.9), map = p => p.clone().sub(s.c).multiplyScalar(shrink).add(s.c).add(push);
    for (const q of s.poly) {
      const wall = q.nb === 'wall' || q.nb === 'plate';
      if (!apart && q.other && piece.ids.has(q.other) && q.other < s.gid) continue;   // a film between two bubbles you can see: drawn once
      if (wall && !solid) continue;   // the tube's wall and the glass plates aren't films
      const P = q.p.map(map);
      // the lighting of each face is bent a little outward from its bubble's middle, as if the film bowed slightly (as real ones do):
      // a perfectly flat face caught the light all at once and flashed white
      if (st.draw !== 'edges') { const n = new V3(); for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; n.x += (a.y - b.y) * (a.z + b.z); n.y += (a.z - b.z) * (a.x + b.x); n.z += (a.x - b.x) * (a.y + b.y); } n.normalize();
        const cc = s.c.clone().add(push), bend = p => p.clone().sub(cc).normalize().multiplyScalar(0.45).add(n).normalize();
        for (let i = 1; i + 1 < P.length; i++) for (const p of [P[0], P[i], P[i + 1]]) { pos.push(p.x, p.y, p.z); const m = bend(p); nor.push(m.x, m.y, m.z); cell.push(si); } }
      if (!wall || solid) for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ka = key(a), kb = key(b), k2 = ka < kb ? ka + kb : kb + ka; if (!E.has(k2)) E.set(k2, [a, b, si]); }
    }
  });
  colourOf = shown.map(tOf);
  // fit the piece to the view
  const box = new THREE.Box3(); for (const s of shown) for (const q of s.poly) for (const p of q.p) box.expandByPoint(p);
  const centre = box.isEmpty() ? new V3() : box.getCenter(new V3()), sz = box.isEmpty() ? new V3(1, 1, 1) : box.getSize(new V3()); ext = Math.max(sz.x, sz.y, sz.z) * (1 + ex * 0.9) || 1;
  S.fit.position.set(0, 0, 0); S.fit.scale.setScalar(2.4 / ext);
  if (pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.translate(-centre.x, -centre.y, -centre.z);
    g.userData.cell = cell; g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3)); const m = new THREE.Mesh(g, FIN[st.finish]); m.userData.faces = true; objs.push(m); S.fit.add(m); }
  // the edges, as thin struts lit like the rest (lines are only ever a pixel wide)
  const lb = Math.cbrt(Math.max(1e-6, vv.reduce((a, b) => a + b, 0) / Math.max(1, vv.length))), r = (st.draw === 'edges' ? Math.max(0.25, st.edgeW) : st.edgeW) * 0.03 * lb;
  if (r > 1e-6 && E.size) addStruts([...E.values()], r, centre);
  if (f.tube && !solid) { const L = tubeLen(), g = new THREE.CylinderGeometry(1.002, 1.002, L, 48, 1, true); g.rotateX(Math.PI / 2); g.translate(-centre.x, -centre.y, piece.O.z - centre.z); const m = new THREE.Mesh(g, tubeMat); objs.push(m); S.fit.add(m); }
  fly.centre = centre; fly.radius = Math.max(sz.x, sz.y, sz.z) / 2; fly.lb = lb;
  recolour(); applyLook();
}
function addStruts(edges, r, centre) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 7, 1, false), m = new THREE.InstancedMesh(g, edgeMat, edges.length), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new V3(0, 1, 0);
  edges.forEach(([a, b], i) => { const d = b.clone().sub(a), l = d.length(); Q.setFromUnitVectors(Y, d.multiplyScalar(1 / (l || 1))); M.compose(a.clone().add(b).multiplyScalar(0.5).sub(centre), Q, new V3(r, l + r * 0.6, r)); m.setMatrixAt(i, M); });
  m.userData.struts = edges; if (st.draw === 'edges' && edges[0] && edges[0][2] != null) m.userData.cells = edges.map(e => e[2]); objs.push(m); S.fit.add(m);
}
// the double bubble: exact spherical films
function drawDouble() {
  const P = st.P.double, D = doubleBubble(P.r), ex = st.explode, solid = st.draw === 'cells', parts = [];
  const shift = i => (i === 0 ? -1 : 1) * ex * 0.6;   // pulled apart along the line of centres
  // films: outer of each bubble and the shared wall; bubbles: each closed (its outer film plus a copy of the wall)
  const sets = solid || ex > 0.001 ? [[D.tris[0], 0, 0], [D.tris[2], 0, 2], [D.tris[1], 1, 1], [D.tris[2], 1, 2]] : [[D.tris[0], 0, 0], [D.tris[1], 1, 1], [D.tris[2], -1, 2]];
  const pos = [], nor = [], cell = [];   // smooth lighting: each film's normal points straight out of its own sphere
  const nrm = (p, kind) => { const c = kind === 2 ? D.wallC : D.centres[kind]; if (!c) return [1, 0, 0]; const v = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], l = Math.hypot(...v) || 1; return v.map(x => x / l); };
  for (const [T, b, kind] of sets) { const dx = b < 0 ? 0 : shift(b); for (const p of T) { pos.push(p[0] + dx, p[1], p[2]); nor.push(...nrm(p, kind)); cell.push(kind); } }
  const cx = D.d / 2, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.translate(-cx, 0, 0);
  g.userData.cell = cell; g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  if (st.draw !== 'edges') { const m = new THREE.Mesh(g, FIN[st.finish]); m.userData.faces = true; objs.push(m); S.fit.add(m); }
  // the circle where the three films meet
  const r1 = 1, x = (D.d * D.d + r1 * r1 - P.r * P.r) / (2 * D.d), a = Math.sqrt(Math.max(0, r1 - x * x)), ring = [];
  for (let i = 0; i < 64; i++) { const t0 = 2 * Math.PI * i / 64, t1 = 2 * Math.PI * (i + 1) / 64; ring.push([new V3(x, a * Math.cos(t0), a * Math.sin(t0)), new V3(x, a * Math.cos(t1), a * Math.sin(t1))]); }
  const rr = (st.draw === 'edges' ? Math.max(0.25, st.edgeW) : st.edgeW) * 0.03; if (rr > 0 && ex < 0.001) addStruts(ring, rr, new V3(cx, 0, 0));   /* the meeting circle, while the bubbles are together */
  colourOf = [0.2, 0.8, 0.5]; ext = (1 + P.r + D.d) * (1 + ex * 0.5); S.fit.position.set(0, 0, 0); S.fit.scale.setScalar(2.4 / ext); shown = []; built = { double: D };
  fly.centre = new V3(); fly.radius = 1; fly.lb = 1;
  recolour(); applyLook();
}
function recolour() {
  const R = rampOf(st.palette, st.palRev), off = st.cycle, tone = t => (off ? sampleMirror(R, t * 0.5 + off) : sampleRamp(R, 0.06 + 0.88 * t));
  // in the Edges view the struts carry the colours (each the colour of a bubble it belongs to)
  for (const o of objs) if (o.userData.cells) { const C = new THREE.Color(); o.userData.cells.forEach((ci, i) => { const t = tone(colourOf[ci]); o.setColorAt(i, C.setRGB(t[0], t[1], t[2])); }); if (o.instanceColor) o.instanceColor.needsUpdate = true; }
  for (const o of objs) if (o.userData.faces) { const g = o.geometry, c = g.attributes.color.array, cell = g.userData.cell; for (let i = 0; i < cell.length; i++) { const t = tone(colourOf[cell[i]]); c[i * 3] = t[0]; c[i * 3 + 1] = t[1]; c[i * 3 + 2] = t[2]; } g.attributes.color.needsUpdate = true; }
  $('lgBar').style.background = rampCss(R);
  const nn = shown.map(s => s.n), L = fm().exact ? ['', ''] : { faces: [Math.min(...nn) + ' faces', Math.max(...nn) + ' faces'], size: ['smaller', 'bigger'], height: ['low', 'high'], each: ['', ''], solid: ['', ''] }[st.cmode];
  if (st.cmode === 'faces' && Math.min(...nn) === Math.max(...nn)) { L[0] = ''; L[1] = ''; }
  $('lgL').textContent = L[0]; $('lgR').textContent = L[1]; $('legend').style.visibility = L[0] && st.draw !== 'edges' ? '' : 'hidden';
  $('cmodeNote').textContent = { faces: 'Bubbles coloured by how many faces they have (walls of a tube or plates not counted).', size: 'Small bubbles dark, big ones bright.', each: 'Every bubble its own colour.', height: 'Low bubbles dark, high ones bright.', solid: 'One colour.' }[st.cmode];
}
function applyLook() {
  const fin = $('finish'); fin.hidden = fin.previousElementSibling.hidden = st.draw === 'edges';   // the struts have one finish of their own
  for (const o of objs) if (o.userData.faces) o.material = FIN[st.finish];
  const paper = st.bg === '#f3efe6'; edgeMat.color.set(st.draw === 'edges' ? 0xffffff : paper ? 0x2a3040 : 0xe9eef8); tubeMat.color.set(paper ? 0x334466 : 0xbfd4ff);
  $('drawNote').textContent = { films: 'Each film once, as thin as soap: you see through the foam.', cells: 'Each bubble on its own, a little shrunk, so you see its shape.', edges: 'Just the edges, where three films meet (Plateau borders).' }[st.draw];
}

// ---------- flying through ----------
const fly = { on: false, pos: new V3(), q: new THREE.Quaternion(), manual: 0, pivotQ: new THREE.Quaternion(), centre: new V3(), radius: 1, lb: 1, wander: 0, roll: 0, rollT: 0 };
const flyClock = new Groove();
function startFly() { if (fm().exact || fly.on) return; fly.on = true; if (fm().tube) rebuild(); fly.pivotQ.copy(S.pivot.quaternion); S.vel.x = S.vel.y = 0; st.paused = false;
  fly.pos.set(0, 0, fly.radius * 0.2); fly.q.identity(); if (fm().tube) fly.q.setFromUnitVectors(new V3(0, 0, -1), new V3(0, 0, -1)); labels(); }
function endFly() { if (!fly.on) return; fly.on = false; if (fm().tube) rebuild(); flyLight.intensity = 0; S.camera.up.set(0, 1, 0); S.camera.quaternion.identity(); S.reset(); S.resize(); labels(); }
function turnQ(q, yaw, pitch, roll = 0) { const up = new V3(0, 1, 0).applyQuaternion(q), right = new V3(1, 0, 0).applyQuaternion(q), fwd = new V3(0, 0, -1).applyQuaternion(q);
  q.premultiply(new THREE.Quaternion().setFromAxisAngle(up, yaw)).premultiply(new THREE.Quaternion().setFromAxisAngle(right, pitch)).premultiply(new THREE.Quaternion().setFromAxisAngle(fwd, roll)).normalize(); }
function stepFly(dt) {
  const k = drive(), f = (k.fast ? 3 : 1) * k.scale, sc = 2.4 / ext;   // local units: the piece's own
  if (S.pointers.size || Math.abs(S.vel.x) + Math.abs(S.vel.y) > 1e-5) { turnQ(fly.q, -S.vel.x * 1.1, -S.vel.y * 1.1); S.vel.x = S.vel.y = 0; fly.manual = 2.5; }
  if (k.any) { fly.manual = 2.5; turnQ(fly.q, -k.turnX * 1.2 * f * dt, k.turnY * 0.9 * f * dt); }
  fly.manual = Math.max(0, fly.manual - dt);
  const fwd = new V3(0, 0, -1).applyQuaternion(fly.q);
  if (!fly.manual) {
    if (fm().tube) { const along = new V3(0, 0, fwd.z >= 0 ? 1 : -1), toAxis = new V3(-fly.pos.x, -fly.pos.y, 0).multiplyScalar(0.8), want = along.add(toAxis).normalize();   // down the tube, keeping off the wall
      fly.q.premultiply(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(fwd, want), Math.min(1, dt * 1.2)));
    }
    else { // drift and wander, turning back toward the middle near the edge of the piece; rolling slowly one way or the other
      fly.wander += dt * 0.35; turnQ(fly.q, Math.sin(fly.wander) * 0.18 * dt, Math.sin(fly.wander * 0.73 + 1) * 0.14 * dt);
      const out = fly.pos.length() / (fly.radius || 1); if (out > 0.55) { const back = fly.pos.clone().negate().normalize(); fly.q.premultiply(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(fwd, back), Math.min(1, dt * 1.6 * (out - 0.45)))); } }
    fly.rollT -= dt; if (fly.rollT <= 0) { fly.rollWant = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.1 + 0.3 * Math.random()); fly.rollT = 4 + 4 * Math.random(); }
    fly.roll += ((fly.rollWant || 0) - fly.roll) * (1 - Math.exp(-dt)); turnQ(fly.q, 0, 0, fly.roll * dt);
  }
  if (!st.paused) fly.pos.addScaledVector(new V3(0, 0, -1).applyQuaternion(fly.q), flyClock.delta(dt, 0.45 * fly.lb * st.flySpeed * (k.any ? 1 + k.slideY * 0.9 : 1), 0.22 * fly.lb * st.flySpeed));
  if (k.any && k.slideX) fly.pos.addScaledVector(new V3(1, 0, 0).applyQuaternion(fly.q), k.slideX * 0.4 * fly.lb * f * dt);
  if (fm().tube) { const per = built && built.def ? built.def.A[2][2] : 1; while (fly.pos.z > per / 2) fly.pos.z -= per; while (fly.pos.z < -per / 2) fly.pos.z += per;   // endless: one repeat along, the foam is the same
    const rr = Math.hypot(fly.pos.x, fly.pos.y); if (rr > 0.7) { fly.pos.x *= 0.7 / rr; fly.pos.y *= 0.7 / rr; } }
  else if (fly.pos.length() > fly.radius * 1.3) fly.pos.setLength(fly.radius * 1.3);
  S.pivot.quaternion.copy(fly.pivotQ); S.fit.updateMatrixWorld(true);
  const wPos = fly.pos.clone().applyMatrix4(S.fit.matrixWorld), wq = fly.pivotQ.clone().multiply(fly.q);
  S.camera.position.copy(wPos); S.camera.quaternion.copy(wq); S.camera.up.set(0, 1, 0).applyQuaternion(wq);
  if (S.camera.fov !== 74) { S.camera.fov = 74; S.camera.updateProjectionMatrix(); }
  flyLight.position.copy(wPos); flyLight.intensity = 0.7; flyLight.distance = 3 * fly.lb * sc + 1;
}

// ---------- settling, as you watch ----------
let settleT = 0;
function startSettle() { const f = fm(); if (!(f.params || []).some(p => p.id === 'k')) return; const P = st.P[st.foam]; if (P.k >= 30) setRange('pp_k', 0);
  const B = build(st.foam, P, st.seed); live = { def: { ...B.def, pts: B.def.pts.map(p => p.slice()) }, cells: B.cells, k: P.k }; settleT = 0; labels(); }
function stepSettle(dt) { if (!live || st.paused) return; settleT -= dt; if (settleT > 0) return; settleT = 0.22;
  const P = st.P[st.foam]; live.def.pts = settle(live.def, 1); live.cells = cells(live.def); live.k++; P.k = live.k; $('pp_k').value = P.k; $('pp_ko').textContent = P.k;
  rebuild(); stats(); if (live.k >= 30) { live = null; share.touch(); labels(); } }

// ---------- panel ----------
{ const box = $('shapeLists');
  box.innerHTML = GROUPS.map(([g, label]) => `<div class="shapeGroup"><div class="lbl">${label}</div><div class="seg g2 shapes">${Object.entries(FOAMS).filter(([, s]) => s.group === g).map(([k, s]) => `<button data-s="${k}">${s.name}</button>`).join('')}</div></div>`).join('');
  box.addEventListener('click', e => { const b = e.target.closest('button[data-s]'); if (b) pickFoam(b.dataset.s); }); }
function pickFoam(k, keepView) {
  if (!FOAMS[k]) return; const wasFlying = fly.on; if (wasFlying) endFly(); live = null; st.foam = k; st.only = 0;
  document.querySelectorAll('#shapeLists button').forEach(b => b.classList.toggle('on', b.dataset.s === k));
  buildParams(); rebuild(); buildOnly(); labels(); share.touch(); if (!keepView) { S.vel.x = S.vel.y = 0; if (fm().tube) S.pivot.quaternion.setFromEuler(new THREE.Euler(0.35, Math.PI / 2, 0)); else if (fm().flat) S.pivot.quaternion.setFromEuler(new THREE.Euler(0.9, 0, 0)); }   // a tube side-on, a raft tipped toward you
  if (wasFlying && !fm().exact) startFly();
}
function buildParams() {
  const f = fm(), P = st.P[st.foam], box = $('params'); $('paramSec').hidden = !(f.params || []).length;
  box.innerHTML = (f.params || []).map(p => `<div class="row"><span style="width:84px">${p.label}</span><input type="range" id="pp_${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.id]}"><output id="pp_${p.id}o">${P[p.id]}</output></div>`).join('');
  for (const p of f.params || []) { const el = $('pp_' + p.id); let t = 0;
    el.addEventListener('input', e => { P[p.id] = +e.target.value; $('pp_' + p.id + 'o').textContent = e.target.value; live = null;
      // heavy foams (many bubbles, or long settling) rebuild once the slider rests for a moment
      clearTimeout(t); const go = () => { rebuild(); buildOnly(); labels(); share.touch(); }; if (p.id === 'k' || p.id === 'n') t = setTimeout(go, 120); else go(); }); }
}
// "Only bubbles with": one button per kind of bubble in this foam (when there are a few kinds)
function buildOnly() {
  const B = fm().exact ? null : current(), K = B ? kinds(B.cells.filter(c => c.poly.length)) : {}, keys = Object.keys(K).map(Number).sort((a, b) => a - b);
  $('onlyRow').hidden = keys.length < 2 || keys.length > 6;
  $('only').innerHTML = `<button data-o="0" class="${st.only ? '' : 'on'}">All</button>` + keys.map(n => `<button data-o="${n}" class="${st.only === n ? 'on' : ''}">${n} faces</button>`).join('');
}
function labels() {
  const f = fm(), seeded = !!f.seeded, settles = (f.params || []).some(p => p.id === 'k');
  $('title').textContent = f.name; $('subtitle').textContent = f.alt; $('gv-shapes').textContent = f.name; $('about').innerHTML = `<strong>${f.name}.</strong> ${f.info}`;
  $('flyBtn').textContent = fly.on ? 'Stop flying' : (f.tube ? 'Fly down the tube' : 'Fly through it'); $('flyBtn').hidden = !!f.exact; $('flyNote').hidden = !!f.exact; $('flySpeed').closest('.row').hidden = !!f.exact;
  $('newBtn').hidden = !seeded; $('settleRow').hidden = !settles; $('settleBtn').textContent = live ? 'Settling…' : 'Settle (watch it even out)';
  $('gv-ctl').textContent = fly.on ? 'flying' : live ? 'settling' : '';
  $('amountRow').hidden = !!f.exact; $('pieceRow').hidden = !!(f.exact || f.tube); $('cmode').hidden = !!f.exact; $('cmode').previousElementSibling.hidden = !!f.exact; $('cmodeNote').hidden = !!f.exact;
  $('piece').querySelector('[data-p="ball"]').textContent = f.flat ? 'Disc' : 'Ball'; $('piece').querySelector('[data-p="cube"]').textContent = f.flat ? 'Square' : 'Cube';
  $('hint').textContent = fly.on ? 'Arrows or drag: look round · W S, + −: faster / slower · A D: slide · G: stop' : f.exact ? 'Drag to turn · scroll / pinch to zoom' : 'Drag to turn · scroll / pinch to zoom · G to fly through the foam';
  stats();
}
function stats() {
  const f = fm(); let note = '';
  if (f.exact) { const r = st.P.double.r, R = r < 0.999 ? r / (1 - r) : Infinity;
    setStats(['1 : ' + r.toFixed(2), 'sizes (radii)'], [R === Infinity ? 'flat' : R.toFixed(2), 'shared wall\'s radius'], ['120°', 'where films meet']);
    note = r < 0.999 ? `The smaller bubble has the higher pressure inside (pressure goes as 1 / radius), so the shared wall bulges into the bigger one. Its curvature is the difference of theirs: 1/${r.toFixed(2)} − 1/1.` : 'Equal bubbles: equal pressures, so the shared wall is flat.'; }
  else { const B = current(), C = B.cells.filter(c => c.poly.length), K = kinds(C), keys = Object.keys(K).map(Number).sort((a, b) => a - b), avg = C.reduce((s, c) => s + c.poly.filter(q => q.nb !== 'wall' && q.nb !== 'plate').length, 0) / C.length;
    const conf = f.tube || f.flat, w = conf ? null : wallScore(C);
    setStats([String(shown.length), 'bubbles shown'], [avg.toFixed(conf ? 1 : 2), conf ? 'neighbours each' : 'faces each, on average'], conf ? [String(C.length), 'in each repeat'] : [w.toFixed(3), 'wall score']);
    if (keys.length <= 6) note = (conf ? 'Each repeat: ' : 'In each repeat: ') + keys.map(n => `${K[n]} with ${n} ${conf ? 'neighbours' : 'faces'}`).join(', ') + '.';
    if (!conf) note += ` Wall score ${w.toFixed(3)}: ${Math.abs(w - KELVIN) < 0.0005 ? 'Kelvin\'s own' : w < KELVIN ? ((KELVIN - w) / KELVIN * 100).toFixed(2) + '% less wall than Kelvin\'s foam' : ((w - KELVIN) / KELVIN * 100).toFixed(1) + '% more wall than Kelvin\'s foam'} (lower is better; a sphere would be 4.836).`; }
  $('statNote').textContent = note;
}
$('flyBtn').addEventListener('click', () => go());
$('newBtn').addEventListener('click', () => renew());
$('settleBtn').addEventListener('click', () => (live ? null : startSettle()));
$('flySpeed').addEventListener('input', e => { st.flySpeed = +e.target.value; $('flySpeedo').textContent = st.flySpeed.toFixed(1) + '×'; share.touch(); });
$('spin').addEventListener('change', e => { st.spin = e.target.checked; share.touch(); });
$('speed').addEventListener('input', e => { st.speed = +e.target.value; $('speedo').textContent = st.speed.toFixed(1) + '×'; share.touch(); });
segClick('drawMode', d => { st.draw = d.d; rebuild(); share.touch(); });
$('explode').addEventListener('input', e => { st.explode = +e.target.value; $('explodeo').textContent = st.explode.toFixed(2); rebuild(); share.touch(); });
$('amount').addEventListener('input', e => { st.amount = +e.target.value; $('amounto').textContent = st.amount; rebuild(); stats(); share.touch(); });
segClick('piece', d => { st.piece = d.p; rebuild(); stats(); share.touch(); });
$('edgeW').addEventListener('input', e => { st.edgeW = +e.target.value; $('edgeWo').textContent = st.edgeW.toFixed(2); rebuild(); share.touch(); });
$('only').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st.only = +b.dataset.o; $('only').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); rebuild(); stats(); share.touch(); });
segClick('cmode', d => { st.cmode = d.c; rebuild(); share.touch(); });
buildSwatches($('palettes'), st.palette, name => { st.palette = name; palLabel(); recolour(); share.touch(); });
const palLabel = () => { $('palName').textContent = 'Palette: ' + st.palette.replace('_', ' & ').replace(/^./, c => c.toUpperCase()) + (st.palRev ? ' (reversed)' : ''); };
$('palRev').addEventListener('change', e => { st.palRev = e.target.checked; palLabel(); recolour(); share.touch(); });
$('cyc').addEventListener('input', e => { st.cycleSpeed = +e.target.value; $('cyco').textContent = st.cycleSpeed ? st.cycleSpeed.toFixed(1) + '×' : 'off'; share.touch(); });
segClick('finish', d => { st.finish = d.f; applyLook(); share.touch(); });
segClick('bg', d => { st.bg = d.b; lightStage(); S.setBackground(st.bg); applyLook(); share.touch(); });
segClick('prSize', d => { st.mm = +d.mm; });
$('snap').addEventListener('click', () => { S.render(); saveCanvasPNG(canvas, fileName(fm().file || fm().name) + '.png', $('dlnote')); });
document.querySelectorAll('.btn.try').forEach(b => b.addEventListener('click', () => { const [k, act] = b.dataset.try.split('|'); endFly(); pickFoam(k);
  if (act === 'cells' || act === 'edges') clickData('#drawMode', 'd', act); else if (act === 'settle') { setRange('pp_k', 0); startSettle(); } else if (act === 'fly') startFly(); }));
buildKeys($('keyTable'), [['G', 'Fly through the foam / stop'], ['N', 'A new random foam (the random ones)'], ['← → ↑ ↓', 'Turn the foam (flying: look round)'], ['W A S D', 'Slide the view (flying: W S faster / slower, A D slide)'], ['+ / −', 'Zoom (flying: faster / slower)'], ['1 – 5', 'Crystal, Frank–Kasper, natural, tube, flat foams'], ['Shift', 'Hold with the keys above to go three times faster']]);

// ---------- actions ----------
function go() { st.paused = false; if (fly.on) endFly(); else startFly(); }
function renew() { if (!fm().seeded) return; live = null; st.seed = Math.floor(Math.random() * 9999) + 1; rebuild(); buildOnly(); labels(); share.touch(); }
function resetView() { endFly(); S.reset(); st.paused = false; share.touch(); }
function moving() { return fly.on || !!live || st.spin || st.cycleSpeed > 0 || MO.moving(); }

// ---------- loop ----------
const MO = makeMotion3D(S, { spinRow: $('spin').closest('label'), speedRow: $('speed').closest('.row'), rate: () => 0.3, spinOn: () => st.spin, speed: () => st.speed,
  sweep: { skip: ['speed', 'flySpeed', 'amount', 'pp_n', 'pp_k'], every: 90 } });
const REC = addRecorder({ stage: canvas.parentElement, name: () => fm().file || fm().name, bg: () => st.bg });
// the Visualizer: a new foam, palette or slow change every eight bars, sometimes the bubbles pulled apart; when the chorus comes in, fly through
makeVisualizer(MO, { preset: 'mvt=0.2&mvb=0.3&mvd=0.25', shape: () => (fly.on ? false : pickButton('#shapeLists button')),
  drop: () => { if (fm().exact) { pickButton('#shapeLists button:not([data-s="double"])'); } if (!fly.on) startFly(); return () => endFly(); },
  extra: [['the bubbles pulled apart, or put back', () => { setRange('explode', st.explode > 0.1 ? 0 : 0.25 + 0.4 * Math.random()); return true; }], ['another way of drawing it', () => { pickButton('#drawMode button:not(.on)'); return true; }]] });
let running = false, tPrev = 0, frame = 0;
function loop(now) {
  if (!running) return; const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now; frame++;
  setPausedTag(st.paused); const goOn = !st.paused;
  if (fly.on) { MO.step(dt, { away: true, go: goOn }); stepFly(dt); }
  else { S.step(dt); MO.step(dt, { go: goOn, spin: !S.pointers.size }); }
  if (live) stepSettle(dt);
  const cs = goOn ? colourStep(dt) : 0; if ((goOn && st.cycleSpeed > 0) || cs) { st.cycle = (st.cycle + (goOn ? dt * st.cycleSpeed * 0.06 : 0) + cs) % 1; recolour(); }
  S.fit.scale.setScalar(2.4 / ext * (fly.on ? 1 : 1 + 0.05 * pulse())); S.setFlash(flash());
  S.fit.rotation.z = fly.on ? 0 : 0.12 * voice();   // vocals and melody sway the foam gently from side to side
  S.render(); if (frame % 30 === 0) share.touch();
  requestAnimationFrame(loop);
}

// ---------- 3D print ----------
$('prBtn').addEventListener('click', () => {
  const f = fm(), note = $('prNote'); let T = [];
  if (f.exact) { const D = built.double; for (const tri of D.tris) for (const p of tri) T.push(p[0], p[1], p[2]); }
  else { const struts = (objs.find(o => o.userData.struts) || {}).userData; const E = struts ? struts.struts : []; if (!E.length) { note.textContent = 'Turn Edges up a little first: the print is made of the edges.'; return; }
    const mmPer = st.mm / ext, r = Math.max(st.edgeW * 0.03 * fly.lb, 0.6 / mmPer); for (const [a, b] of E) T.push(...tubeTriangles([[a.x, a.y, a.z], [b.x, b.y, b.z]], r, 8, false)); }
  for (let i = 0; i < T.length; i += 3) { const y = T[i + 1], z = T[i + 2]; T[i + 1] = -z; T[i + 2] = y; }   // the explorer's up (y) becomes the printer's up (z)
  const r = stlFromTriangles(T, st.mm, 'Math Explorer foam');
  saveFile(fileName(f.file || f.name) + `_${st.mm}mm.stl`, r.bytes, note).then(ok => { if (ok) note.textContent += ` ${r.size.map(v => Math.round(v)).join(' × ')} mm, ${r.tris.toLocaleString()} triangles.`; });
});

// ---------- keys, sharing, lifecycle ----------
export function onKey(e) {
  return standardKeys(e, {
    pause: () => { if (st.paused) st.paused = false; else if (moving()) st.paused = true; else { st.spin = true; $('spin').checked = true; } },
    go, reset: resetView, renew,
    shape: dir => clickNext('#shapeLists button', dir), palette: dir => clickNext('#palettes button', dir), colourMode: dir => clickNext('#cmode button', dir),
    reverse: () => $('palRev').click(), cycle: () => setRange('cyc', st.cycleSpeed > 0 ? 0 : 1),
    zoom: f => { if (fly.on) setRange('flySpeed', clamp(st.flySpeed / f, 0.2, 3)); else S.zoom(f); },
    mode: i => { const g = GROUPS[i]; if (g) pickFoam(Object.keys(FOAMS).find(k => FOAMS[k].group === g[0])); },
  });
}
const encode = () => { const p = new URLSearchParams(), P = st.P[st.foam]; p.set('f', st.foam); for (const k in P) p.set(k, r4(P[k])); if (fm().seeded) p.set('sd', st.seed);
  if (st.draw !== 'films') p.set('dr', st.draw); if (st.explode) p.set('ex', st.explode); if (st.amount !== 3) p.set('am', st.amount); if (st.piece !== 'ball') p.set('pc', st.piece); if (st.edgeW !== 0.35) p.set('ew', st.edgeW); if (st.only) p.set('o', st.only);
  p.set('cm', st.cmode); p.set('pal', st.palette); if (st.palRev) p.set('rev', 1); if (st.cycleSpeed) p.set('cyc', st.cycleSpeed); if (st.finish !== 'bubble') p.set('fin', st.finish); if (st.bg !== '#0b0d12') p.set('bg', st.bg.slice(1));
  if (!st.spin) p.set('sp', 0); if (st.speed !== 0.4) p.set('spd', st.speed); if (st.flySpeed !== 1) p.set('fs', st.flySpeed);
  const q = fly.on ? fly.pivotQ : S.pivot.quaternion; p.set('q', [q.x, q.y, q.z, q.w].map(r4).join('_')); if (!fly.on) p.set('z', r4(MO.baseZ())); MO.encode(p); return p.toString(); };
function apply(code) {
  const p = new URLSearchParams(code), k = p.get('f'); if (!FOAMS[k]) return false; endFly(); live = null;
  for (const q of FOAMS[k].params || []) st.P[k][q.id] = clamp(num(p, q.id, q.def), q.min, q.max);
  st.seed = clamp(Math.round(num(p, 'sd', 1)), 1, 9999999);
  clickData('#drawMode', 'd', ['films', 'cells', 'edges'].includes(p.get('dr')) ? p.get('dr') : 'films'); setRange('explode', clamp(num(p, 'ex', 0), 0, 1)); setRange('amount', clamp(Math.round(num(p, 'am', 3)), 1, 5));
  clickData('#piece', 'p', p.get('pc') === 'cube' ? 'cube' : 'ball'); setRange('edgeW', clamp(num(p, 'ew', 0.35), 0, 1));
  clickData('#cmode', 'c', ['faces', 'size', 'each', 'height', 'solid'].includes(p.get('cm')) ? p.get('cm') : 'faces'); clickData('#palettes', 'pal', p.get('pal') || 'aurora'); setCheck('palRev', p.get('rev') === '1');
  setRange('cyc', num(p, 'cyc', 0)); clickData('#finish', 'f', p.get('fin') || 'bubble'); clickData('#bg', 'b', '#' + (p.get('bg') || '0b0d12'));
  setCheck('spin', p.get('sp') !== '0'); setRange('speed', num(p, 'spd', 0.4)); setRange('flySpeed', num(p, 'fs', 1));
  pickFoam(k, true);
  const o = Math.round(num(p, 'o', 0)); if (o) { const b = $('only').querySelector(`[data-o="${o}"]`); if (b) b.click(); }
  const q = (p.get('q') || '').split('_').map(Number); if (q.length === 4 && q.every(isFinite)) S.pivot.quaternion.set(...q).normalize();
  const z = num(p, 'z', 0); if (z > 0) S.camera.position.z = clamp(z, 1.2, 14);
  MO.decode(p);
  return true;
}
const share = makeShare('foam', encode, apply);
// the Paper background: dark stage text (as in Fractals); removed again when you leave this explorer
function lightStage() { document.getElementById('app').classList.toggle('light', st.bg === '#f3efe6'); }
MO.onChange = () => share.touch();
palLabel();
if (!apply(parseRoute().code)) pickFoam('kelvin');
export function start() { lightStage(); S.setBackground(st.bg); S.resize(); running = true; tPrev = performance.now(); requestAnimationFrame(loop); share.write(); }
export function stop() { running = false; REC.stop(); document.getElementById('app').classList.remove('light'); }
export const reset = resetView;
export const layoutChanged = () => { S.resize(); };
export const showView = code => apply(code);
export const soundHelp = 'Here, each beat flashes the films brighter (or, with Pulse, gives the foam a little bounce). Tempo times the turning and everything under Rotation & motion; the flight surges on each beat. Vocals sway the foam gently from side to side, energy sets the pace, and colour drifts the palette. The Visualizer brings in a new foam every eight bars, sometimes pulls the bubbles apart, and flies through the foam when the chorus comes in.';
