// Labyrinths explorer: endless labyrinths (triply periodic surfaces) to fly through, foams, mazes to drive and solve, and the
// ancient one-path labyrinths. Importing this module boots the explorer; the exports are the lifecycle js/main.js drives.
import * as THREE from 'three';
import { $, clamp, segClick, clickNext, setRange, setCheck, clickData, setStats, buildSwatches, rampCss, r4, num, standardKeys, buildKeys, makeShare } from '../../js/common/kit.js';
import { rampOf, sampleRamp, sampleMirror, palTitle } from '../../js/common/palettes.js';
import { makeStage3D, makeFinishes } from '../../js/common/three-stage.js';
import { saveCanvasPNG, saveFile, fileName } from '../../js/common/save.js';
import { stlFromTriangles, heightfieldTriangles } from '../../js/common/stl.js';
import { makeMotion3D, addRecorder } from '../../js/common/motion.js';
import { makeVisualizer, pickButton, randomSlider } from '../../js/common/visualizer.js';
import { flashFx as flash, pulseFx as pulse, voiceFx as voice, colourStep, Groove, BeatGate, energyMul } from '../../js/shell/audio/react.js';
import { setPausedTag, drive } from '../../js/shell/keys.js';
import { parseRoute } from '../../js/shell/route.js';
import { TPMS, solidField, periodicMesh, solidForPrint } from './tpms.js';
import { FOAMS, foamCells, faceArea } from './foam.js';
import { makeMaze, solve, wallFollow, degree, isOpen, neighbour } from './maze.js';
import { CLASSIC, randomLabyrinth, countLabyrinths, labyrinthPath } from './classic.js';
import { WALL_PATTERNS, patchMaterial, setPattern, U as WT } from './walltex.js';
import { touchTapping } from '../../js/shell/layout.js';

// ---------- state ----------
const LEVELS = [null, [5, 5, 1], [6, 6, 2], [7, 7, 3], [8, 8, 4], [10, 10, 5]];
const st = { wpat: 'none', wpSize: 0.4, wpGlow: 0, wpMove: false, wpFloor: false, kind: 'tpms', tpms: 'gyroid', tmode: 'sheet', thick: 0.18, cells: 1, flip: 1, auto: true, beacon: false, flySpeed: 1,
  foam: 'kelvin', block: 2, films: true, level: 2, method: 'dfs', loops: 0, goal: 'corner', seed: 1, crumbs: true, race: false,
  classic: 'cretan', seq: CLASSIC.cretan.seq.slice(), rings: 7, detail: 2, fog: 0.5, spin: true, cmode: 'side', palette: 'aurora', palRev: false,
  cycle: 0, cycleSpeed: 0, finish: 'satin', bg: '#0b0d12', paused: false, mm: 80 };
let R = rampOf('aurora', false);
const tone = t => (st.cycle ? sampleMirror(R, t * 0.5 + st.cycle) : sampleRamp(R, t));

// ---------- the stage ----------
const canvas = $('lbc'), S = makeStage3D(canvas, { z: 6 }), V3 = THREE.Vector3, FIN = makeFinishes();
for (const k of ['satin', 'gloss', 'metal', 'flat']) patchMaterial(FIN[k]);   // wall patterns (walltex.js) work on every finish but the soap-film Bubble
S.addFlash(FIN.flat); S.addFlash(FIN.bubble);   // the finishes the lights don't reach still flash on the beat
let foamLineMat = null;
const orbit = new THREE.Group(); S.fit.add(orbit);                  // what you see from outside, scaled to fit
const world = new THREE.Group(); world.visible = false; S.scene.add(world);   // what you move through, at its own size
const lamp = new THREE.PointLight(0xffffff, 0, 6, 1.4); S.scene.add(lamp);
const plain = (opts = {}) => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, ...opts });
function clear(g) { while (g.children.length) { const o = g.children.pop(); o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material && !Object.values(FIN).includes(c.material)) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose()); }); } }
let fpOn = false;   // first person (flying, driving or walking) rather than the outside view
function enterFirstPerson() { fpOn = true; orbit.visible = false; world.visible = true; S.vel.x = S.vel.y = 0; pivotKeep.copy(S.pivot.quaternion); S.camera.near = 0.01; S.camera.updateProjectionMatrix(); }
function leaveFirstPerson() { if (!fpOn) return; fpOn = false; orbit.visible = true; world.visible = false; S.scene.fog = null; lamp.intensity = 0; S.camera.up.set(0, 1, 0); S.camera.quaternion.identity(); S.reset(); S.resize(); $('compass').hidden = true; }
const pivotKeep = new THREE.Quaternion();
const putCamera = (pos, quat) => { S.pivot.quaternion.identity(); S.fit.updateMatrixWorld(true); S.camera.position.copy(pos); S.camera.quaternion.copy(quat); S.camera.up.set(0, 1, 0).applyQuaternion(quat); lamp.position.copy(pos); };
const setFov = f => { if (S.camera.fov !== f) { S.camera.fov = f; S.camera.updateProjectionMatrix(); } };
function setFog(near, far) { const c = new THREE.Color(st.bg); S.scene.fog = st.fog > 0 ? new THREE.Fog(c, near, far) : null; }

// ======================================================================================================
// ENDLESS LABYRINTHS
// ======================================================================================================
const tp = () => TPMS[st.tpms];
// surface nets for a closed block: the solid, intersected with a cube of half-width L, so its cut faces are flat
function blockMesh(F, n, L) {
  const lo = -L * 1.04, h = 2 * L * 1.04 / n, N = n + 1, V = new Float32Array(N * N * N), at = i => lo + i * h;
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = at(i), y = at(j), z = at(k); V[i + j * N + k * N * N] = Math.max(F(x, y, z), Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) - L); }
  const C8 = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], E12 = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cell = new Int32Array(n * n * n).fill(-1), pos = [], idx = [], gv = new Float64Array(8);
  for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let m = 0; for (let c = 0; c < 8; c++) { const q = C8[c]; gv[c] = V[(i + q[0]) + (j + q[1]) * N + (k + q[2]) * N * N]; if (gv[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue; let sx = 0, sy = 0, sz = 0, ne = 0;
    for (const [a, b] of E12) { if ((gv[a] < 0) === (gv[b] < 0)) continue; const t = gv[a] / (gv[a] - gv[b]), A = C8[a], B = C8[b]; sx += A[0] + t * (B[0] - A[0]); sy += A[1] + t * (B[1] - A[1]); sz += A[2] + t * (B[2] - A[2]); ne++; }
    cell[i + j * n + k * n * n] = pos.length / 3; const q = [at(i) + sx / ne * h, at(j) + sy / ne * h, at(k) + sz / ne * h];
    for (let a = 0; a < 3; a++) if (Math.abs(q[a]) > L - 0.75 * h) q[a] = Math.sign(q[a]) * L;   /* points at the cut lie exactly on the cube, so its faces are flat and its edges clean */
    // a point on the cut where the wall also passes (the rim): slide it along the cut face onto the wall itself, so the rim follows
    // the true curve instead of stepping from grid cell to grid cell (that staircase was the blocky edge)
    const fixed = [0, 1, 2].filter(a => Math.abs(q[a]) === L);
    if (fixed.length === 1) { let lo2 = Infinity, hi2 = -Infinity; for (const c of C8) { const f = F(at(i + c[0]), at(j + c[1]), at(k + c[2])); lo2 = Math.min(lo2, f); hi2 = Math.max(hi2, f); }
      if (lo2 < 0 && hi2 > 0) { const ax = fixed[0], e = h * 0.05;
        for (let it = 0; it < 4; it++) { const f = F(q[0], q[1], q[2]), gr = [0, 1, 2].map(d => { if (d === ax) return 0; const a1 = q.slice(), b1 = q.slice(); a1[d] += e; b1[d] -= e; return (F(...a1) - F(...b1)) / (2 * e); }), g2 = gr[0] * gr[0] + gr[1] * gr[1] + gr[2] * gr[2];
          if (g2 < 1e-12) break; const st2 = Math.max(-h, Math.min(h, f / g2)); for (let d = 0; d < 3; d++) q[d] -= gr[d] * st2; for (let d = 0; d < 3; d++) if (d !== ax) q[d] = Math.max(-L, Math.min(L, q[d])); } } }
    pos.push(q[0], q[1], q[2]);
  }
  const P3 = [1, N, N * N];
  for (let a = 0; a < 3; a++) { const u = (a + 1) % 3, w = (a + 2) % 3;
    for (let z = 1; z < n; z++) for (let y = 1; y < n; y++) for (let x = 0; x < n; x++) {
      const p = [0, 0, 0]; p[a] = x; p[u] = y; p[w] = z; const kk = p[0] + p[1] * N + p[2] * N * N, s0 = V[kk] < 0, s1 = V[kk + P3[a]] < 0; if (s0 === s1) continue;
      const ci = (du, dw) => { const c = p.slice(); c[u] -= du; c[w] -= dw; return cell[c[0] + c[1] * n + c[2] * n * n]; };
      const q = [ci(1, 1), ci(0, 1), ci(0, 0), ci(1, 0)]; if (q.includes(-1)) continue;
      if (s0) idx.push(q[0], q[1], q[2], q[0], q[2], q[3]); else idx.push(q[0], q[2], q[1], q[0], q[3], q[2]);
    } }
  return { pos: new Float32Array(pos), idx };
}
const field = () => solidField(tp().g, st.tmode, st.thick, st.flip);
// colours for a labyrinth's surface: which of the two mazes a bit of wall faces, or its height
function tpColours(pos, nor) {
  const g = tp().g, n = pos.length / 3, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; let t;
    if (st.cmode === 'side') { const e = nor ? 0.08 : 0; const s = g(x + (nor ? nor[i * 3] * e : 0), y + (nor ? nor[i * 3 + 1] * e : 0), z + (nor ? nor[i * 3 + 2] * e : 0)); t = 0.51 - 0.29 * Math.tanh(s / 0.06); }   /* a soft step: a hard one coloured whole grid points, so where the two colours meet on a cut face the line came out as a sawtooth */
    else if (st.cmode === 'height') t = 0.5 + 0.5 * Math.sin(y * 0.5); else t = 0.6;
    const c = tone(t); col.set(c, i * 3); }
  return col;
}
function buildTpmsOrbit() {
  clear(orbit); const L = Math.PI * st.cells * 0.98, n = [0, 36, 48, 64, 80][st.detail] * (st.cells === 2 ? 1.5 : 1) | 0, m = blockMesh(field(), n, L), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); g.setIndex(m.idx); g.computeVertexNormals(); g.setAttribute('color', new THREE.BufferAttribute(tpColours(m.pos, g.attributes.normal.array), 3));
  orbit.add(new THREE.Mesh(g, FIN[st.finish])); S.fit.scale.setScalar(2.4 / (2 * L)); S.fit.position.set(0, 0, 0);
}
// ---- flying through one: 27 copies of one seamless cell round you, moved along as you go ----
const fly = { on: false, pos: new V3(), q: new THREE.Quaternion(), manual: 0, cell: [0, 0, 0], visited: new Set(), side: 1, found: 0, beacon: null, beaconMesh: null, hop: null, F: null, g: null, inst: null };
function buildFlyWorld() {
  clear(world); fly.F = field(); fly.g = tp().g;
  const m = periodicMesh(fly.F, [0, 28, 36, 44, 52][st.detail]), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(tpColours(m.pos, m.nor), 3));
  fly.inst = new THREE.InstancedMesh(geo, FIN[st.finish === 'bubble' ? 'satin' : st.finish], 27); world.add(fly.inst); placeCopies();
  fly.beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd36e })); fly.beaconLight = new THREE.PointLight(0xffd36e, 0, 5, 1.5);
  fly.beaconMesh.add(fly.beaconLight); fly.beaconMesh.visible = false; world.add(fly.beaconMesh);
}
const T2 = 2 * Math.PI, cellOf = p => [Math.floor((p.x + Math.PI) / T2), Math.floor((p.y + Math.PI) / T2), Math.floor((p.z + Math.PI) / T2)];
function placeCopies() { const c = fly.cell, M = new THREE.Matrix4(); let k = 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let l = -1; l <= 1; l++) { M.makeTranslation((c[0] + i) * T2, (c[1] + j) * T2, (c[2] + l) * T2); fly.inst.setMatrixAt(k++, M); }
  fly.inst.instanceMatrix.needsUpdate = true; }
const gradAt = (F, p) => { const e = 1e-3; return new V3(F(p.x + e, p.y, p.z) - F(p.x - e, p.y, p.z), F(p.x, p.y + e, p.z) - F(p.x, p.y - e, p.z), F(p.x, p.y, p.z + e) - F(p.x, p.y, p.z - e)).normalize(); };
function freeSpot(near) {   // the nearest point with room to fly, searching outward from near
  for (let r = 0; r < 3; r += 0.15) for (let t = 0; t < 40; t++) { const p = near.clone().add(new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(r)); if (fly.F(p.x, p.y, p.z) > 0.35) return p; }
  return near.clone(); }
function startFly() {
  if (st.tmode === 'double') clickData('#tMode', 'm', 'sheet');   // with both mazes solid the only open space is the thin gap: fly the wall view instead
  buildFlyWorld(); enterFirstPerson(); fly.on = true; fly.pos.copy(freeSpot(new V3(0.3, 0.2, 0.1))); fly.q.identity(); fly.manual = 0; fly.cell = cellOf(fly.pos); fly.visited = new Set([fly.cell.join()]); fly.found = 0; fly.beacon = null; fly.hop = null;
  placeCopies(); setFov(76); labels(); }
function endFly() { if (!fly.on) return; fly.on = false; fly.beaconMesh.visible = false; leaveFirstPerson(); clear(world); labels(); }
const flyClock = new Groove(), CLEAR = 0.32;   /* how close to a wall the camera may get */
function stepFly(dt) {
  const F = fly.F, k = drive(), f = (k.fast ? 3 : 1) * k.scale, fwd = new V3(0, 0, -1).applyQuaternion(fly.q), up = new V3(0, 1, 0).applyQuaternion(fly.q), right = new V3(1, 0, 0).applyQuaternion(fly.q);
  if (S.pointers.size || Math.abs(S.vel.x) + Math.abs(S.vel.y) > 1e-5) { turn(fly.q, -S.vel.x * 1.1, -S.vel.y * 1.1); S.vel.x = S.vel.y = 0; fly.manual = 2.5; }
  if (k.any) { fly.manual = 2.5; turn(fly.q, -k.turnX * 1.2 * f * dt, k.turnY * 0.9 * f * dt); }
  fly.manual = Math.max(0, fly.manual - dt); if (fly.manual > 0) fly.aim = null;   /* steering by hand: the aim starts afresh afterwards */
  // steering itself: try a fan of directions round straight ahead and turn toward the one with the most room
  if (st.auto && fly.manual === 0 && !fly.hop) {
    // a leaning that wanders (a new random one every 3 to 6 s) tips close calls, so forks go different ways
    fly.biasT = (fly.biasT || 0) - dt; if (!fly.bias || fly.biasT <= 0) { fly.bias = new V3(Math.random() - 0.5, 1.8 * (Math.random() - 0.5), Math.random() - 0.5).normalize();   /* leaning up or down more often than not */ fly.biasT = 3 + 3 * Math.random(); }
    let best = fwd, bs = -Infinity;
    for (let a = 0; a < 13; a++) { const d = a === 0 ? fwd.clone() : fwd.clone().applyAxisAngle(up, 0.5 * Math.cos(a * 0.966)).applyAxisAngle(right, 0.5 * Math.sin(a * 0.966)).normalize();
      let s = Infinity; for (const r of [0.5, 1, 1.6, 2.4]) { const p = fly.pos.clone().addScaledVector(d, r); s = Math.min(s, F(p.x, p.y, p.z) + r * 0.04); } s += (a === 0 ? 0.08 : 0) + 0.05 * d.dot(fly.bias); if (fly.beacon && st.beacon) s += 0.1 * d.dot(fly.beacon.clone().sub(fly.pos).normalize());
      if (s > bs) { bs = s; best = d; } }
    const ahead = fly.pos.clone().addScaledVector(fwd, 0.9), room = Math.min(F(fly.pos.x, fly.pos.y, fly.pos.z), F(ahead.x, ahead.y, ahead.z));   /* turn harder the less room there is ahead */
    // ease the aim toward the best direction rather than jumping to it: two nearly equal choices used to win on alternate frames,
    // so the view turned, stopped, turned (a visible judder)
    if (!fly.aim) fly.aim = fwd.clone(); fly.aim.lerp(best, 1 - Math.exp(-dt * 3)).normalize();
    const qt = new THREE.Quaternion().setFromUnitVectors(fwd, fly.aim); const g = 1.4 + 5 * Math.max(0, 0.9 - room); fly.gain = fly.gain == null ? g : fly.gain + (g - fly.gain) * (1 - Math.exp(-dt * 5));   /* how sharply it turns eases in and out rather than jumping as the room ahead changes */
    fly.q.premultiply(new THREE.Quaternion().slerp(qt, Math.min(1, dt * fly.gain)));
    // no level flight: it rolls slowly one way or the other (a new roll every 4 to 8 s, sometimes none), eased in and out, with only
    // a faint pull back toward level so it never stays upside down for long. Holding it level made every turn read as left or right.
    fly.spinT = (fly.spinT || 0) - dt; if (fly.spinT <= 0) { fly.spinWant = Math.random() < 0.25 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.15 + 0.4 * Math.random()); fly.spinT = 4 + 4 * Math.random(); }
    fly.spin = (fly.spin || 0) + ((fly.spinWant || 0) - (fly.spin || 0)) * (1 - Math.exp(-dt * 0.8));
    const lvl = new V3(0, 1, 0).sub(fwd.clone().multiplyScalar(fwd.y)).normalize(); const roll = Math.atan2(up.clone().cross(lvl).dot(fwd), up.dot(lvl)); fly.q.premultiply(new THREE.Quaternion().setFromAxisAngle(fwd, roll * Math.min(1, dt * 0.08) + fly.spin * dt));
  }
  if (fly.hop) {   // stepping through the wall to the other maze
    fly.hop.t += dt / 0.8; const u = Math.min(1, fly.hop.t), e = u * u * (3 - 2 * u); fly.pos.lerpVectors(fly.hop.a, fly.hop.b, e); if (u >= 1) fly.hop = null;
  } else if (!st.paused) {
    const v = flyClock.delta(dt, 0.9 * st.flySpeed * (k.any ? 1 + k.slideY * 0.9 : 1), 0.45 * st.flySpeed);
    fly.pos.addScaledVector(new V3(0, 0, -1).applyQuaternion(fly.q), v); if (k.any && k.slideX) fly.pos.addScaledVector(right, k.slideX * 0.8 * f * dt);
    // never inside the wall: push back out along the slope of the distance
    for (let it = 0; it < 6; it++) { const d = F(fly.pos.x, fly.pos.y, fly.pos.z); if (d >= CLEAR) break; fly.pos.addScaledVector(gradAt(F, fly.pos), CLEAR - d + 0.01); }
  }
  const c = cellOf(fly.pos); if (c.join() !== fly.cell.join()) { fly.cell = c; fly.visited.add(c.join()); placeCopies(); }
  fly.side = fly.g(fly.pos.x, fly.pos.y, fly.pos.z) >= 0 ? 1 : -1;
  if (st.beacon) beaconStep(dt); else { fly.beaconMesh.visible = false; $('compass').hidden = true; }
  putCamera(fly.pos, fly.q); setFov(76); lamp.intensity = 0.9; lamp.distance = 5; setFog(1, 8.5 - st.fog * 4.5);
}
function turn(q, yaw, pitch) { const up = new V3(0, 1, 0).applyQuaternion(q), right = new V3(1, 0, 0).applyQuaternion(q); q.premultiply(new THREE.Quaternion().setFromAxisAngle(up, yaw)).premultiply(new THREE.Quaternion().setFromAxisAngle(right, pitch)).normalize(); }
function hopSide() {
  if (!fly.on) return;
  if (st.tmode === 'network') { st.flip = -st.flip; const keep = fly.pos.clone(); buildFlyWorld(); placeCopies(); fly.pos.copy(freeSpot(keep)); labels(); return; }   // open the other maze and seal this one
  const g = fly.g, F = fly.F, s = g(fly.pos.x, fly.pos.y, fly.pos.z) >= 0 ? 1 : -1, d = gradAt(g, fly.pos).multiplyScalar(-s);
  for (let r = 0.1; r < 3; r += 0.05) { const p = fly.pos.clone().addScaledVector(d, r); if ((g(p.x, p.y, p.z) >= 0 ? 1 : -1) !== s && F(p.x, p.y, p.z) > 0.25) { fly.hop = { a: fly.pos.clone(), b: p, t: 0 }; return; } }
}
// ---- the beacon game ----
const beatGate = new BeatGate();
function beaconStep(dt) {
  if (!fly.beacon) placeBeacon();
  const B = fly.beacon, d = B.clone().sub(fly.pos), dist = d.length(), sameSide = fly.g(B.x, B.y, B.z) * fly.side >= 0;
  fly.beaconMesh.visible = true; fly.beaconMesh.position.copy(B); const beat = beatGate.crossed(); fly.beaconMesh.scale.setScalar(1 + 0.4 * flash() + (beat ? 0.3 : 0)); fly.beaconLight.intensity = 1.6 + 2 * flash();
  if (dist < 0.7 && sameSide) { fly.found++; fly.beacon = null; flashCap(`<b>Found it!</b> Beacon ${fly.found}. The next one is further away.`); return; }
  const cam = d.clone().applyQuaternion(fly.q.clone().invert()), ang = Math.atan2(cam.x, cam.y), behind = cam.z > 0;
  $('compass').hidden = false; $('compassArrow').style.transform = `rotate(${behind ? 180 : ang * 180 / Math.PI}deg)`;
  $('compassText').innerHTML = `${(dist / T2).toFixed(1)} cells${behind ? '<br>behind you' : ''}${sameSide ? '' : '<br><b>in the other maze</b>'}`;
}
function placeBeacon() {
  const far = Math.min(5, 2 + fly.found), dir = new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), target = fly.pos.clone().addScaledVector(dir, far * T2);
  const side = st.tmode === 'sheet' && Math.random() < 0.4 ? -fly.side : fly.side; let best = target, bs = -Infinity;
  for (let i = 0; i < 300; i++) { const p = target.clone().add(new V3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(T2)); const free = fly.F(p.x, p.y, p.z); if (free < 0.35) continue; const s = side * fly.g(p.x, p.y, p.z) + free * 0.2; if (s > bs) { bs = s; best = p; } }
  fly.beacon = best;
}
let capTimer = 0; function flashCap(html) { const el = $('stageCap'); el.innerHTML = html; el.style.display = 'block'; capTimer = 3.5; }

// ======================================================================================================
// FOAMS
// ======================================================================================================
let foamGeo = null;
function foamGeometry(B) {
  const cells = foamCells(st.foam), faces = new Map(), edges = new Map(), key = p => p.map(v => Math.round(v * 1e5)).join(',');
  for (let i = 0; i < B; i++) for (let j = 0; j < B; j++) for (let k = 0; k < B; k++) cells.forEach(c => {
    const off = [i, j, k], type = c.faces.length;
    for (const f of c.faces) { const q = f.map(p => [p[0] + off[0], p[1] + off[1], p[2] + off[2]]), m = q.reduce((s, p) => [s[0] + p[0] / q.length, s[1] + p[1] / q.length, s[2] + p[2] / q.length], [0, 0, 0]), fk = key(m);
      if (!faces.has(fk)) faces.set(fk, { q, type, h: m[1] }); for (let e = 0; e < q.length; e++) { const a = key(q[e]), b = key(q[(e + 1) % q.length]), ek = a < b ? a + '|' + b : b + '|' + a; if (!edges.has(ek)) edges.set(ek, [q[e], q[(e + 1) % q.length]]); } } });
  return { faces: [...faces.values()], edges: [...edges.values()], cells };
}
function foamMeshes(group, scale, centre) {
  const G = foamGeometry(st.block), pos = [], col = [], lp = [];
  for (const f of G.faces) { const c = tone(st.cmode === 'side' ? (f.type === 12 ? 0.2 : 0.75) : st.cmode === 'height' ? f.h / st.block : 0.6);
    for (let i = 1; i + 1 < f.q.length; i++) for (const p of [f.q[0], f.q[i], f.q[i + 1]]) { pos.push((p[0] - centre) * scale, (p[1] - centre) * scale, (p[2] - centre) * scale); col.push(...c); } }
  for (const [a, b] of G.edges) lp.push(...[a, b].flatMap(p => [(p[0] - centre) * scale, (p[1] - centre) * scale, (p[2] - centre) * scale]));
  if (st.films) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    group.add(new THREE.Mesh(g, FIN.bubble)); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  if (foamLineMat) S.dropFlash(foamLineMat);   /* the foam's edges are lines, which the lights don't reach: they flash directly */
  foamLineMat = S.addFlash(new THREE.LineBasicMaterial({ color: st.bg === '#f3efe6' ? 0x334 : 0xe8f0ff, transparent: true, opacity: st.films ? 0.75 : 0.95 }));
  group.add(new THREE.LineSegments(lg, foamLineMat));
  foamGeo = G;
}
function buildFoamOrbit() { clear(orbit); foamMeshes(orbit, 1, st.block / 2); S.fit.scale.setScalar(2.2 / st.block); S.fit.position.set(0, 0, 0); }
const ffly = { on: false, pos: new V3(), q: new THREE.Quaternion(), manual: 0 };
function startFoamFly() { clear(world); foamMeshes(world, 4, 1.5); enterFirstPerson(); ffly.on = true; ffly.pos.set(0, 0, 0.3); ffly.q.identity(); setFov(74); labels(); }
function endFoamFly() { if (!ffly.on) return; ffly.on = false; leaveFirstPerson(); clear(world); labels(); }
function stepFoamFly(dt) {
  const k = drive(), f = (k.fast ? 3 : 1) * k.scale, fwd = new V3(0, 0, -1).applyQuaternion(ffly.q);
  if (S.pointers.size || Math.abs(S.vel.x) + Math.abs(S.vel.y) > 1e-5) { turn(ffly.q, -S.vel.x * 1.1, -S.vel.y * 1.1); S.vel.x = S.vel.y = 0; ffly.manual = 2.5; }
  if (k.any) { ffly.manual = 2.5; turn(ffly.q, -k.turnX * 1.2 * f * dt, k.turnY * 0.9 * f * dt); }
  ffly.manual = Math.max(0, ffly.manual - dt);
  const lim = st.block * 2 - 0.8;   // the block reaches ±2 × block: drift back toward the middle near its edge
  if (st.auto && ffly.manual === 0 && ffly.pos.length() > lim * 0.7) { const qt = new THREE.Quaternion().setFromUnitVectors(fwd, ffly.pos.clone().negate().normalize()); ffly.q.premultiply(new THREE.Quaternion().slerp(qt, Math.min(1, dt * 0.6))); }
  if (st.auto && ffly.manual === 0) turn(ffly.q, dt * 0.12, 0);   // a slow, gentle wander
  if (!st.paused) ffly.pos.addScaledVector(new V3(0, 0, -1).applyQuaternion(ffly.q), flyClock.delta(dt, 0.7 * st.flySpeed * (k.any ? 1 + k.slideY * 0.9 : 1), 0.35 * st.flySpeed));
  if (ffly.pos.length() > lim) ffly.pos.setLength(lim);
  putCamera(ffly.pos, ffly.q); lamp.intensity = 0.8; lamp.distance = 6; setFog(2, 14 - st.fog * 8);
}

// ======================================================================================================
// MAZES
// ======================================================================================================
let maze = null; const H = 1, TH = 0.07, EYE = 0.45;
const mz = { mode: 'drive', pos: new V3(), yaw: 0, pitch: 0, cell: 0, steps: 0, deadEnds: 0, visits: null, t0: 0, done: false, solved: false, path: null, u: 0, hint: 0, over: false, build: null, hand: null, ghost: null, usedMap: false };
const wallMat = patchMaterial(plain()), floorMat = plain({ roughness: 0.8 }), markMat = new THREE.MeshBasicMaterial({ color: 0xffffff }), goalMat = new THREE.MeshBasicMaterial({ color: 0xffd36e });
let walls = null, wallKey = null, floors = null, crumbs = null, pathMarks = null, goalMesh = null, playerMesh = null, ghostMesh = null;
const goalCell = () => (st.goal === 'centre' ? maze.id(Math.floor(maze.X / 2), Math.floor(maze.Y / 2), Math.floor((maze.Z - 1) / 2)) : maze.N - 1);
const cellCentre = (i, exploded) => { const [x, y, z] = maze.xyz(i); return new V3(x + 0.5, z * H * (exploded ? 1.8 : 1) + EYE, y + 0.5); };
function newMaze(seed) {
  if (seed != null) st.seed = seed; const [X, Y, Z] = LEVELS[st.level];
  maze = makeMaze(X, Y, Z, st.method, st.loops, st.seed); buildMazeScene(false);
  Object.assign(mz, { glide: null, cell: 0, steps: 0, deadEnds: 0, visits: new Uint16Array(maze.N), t0: performance.now(), done: false, solved: false, path: null, u: 0, hint: 0, build: null, hand: null, mode: 'drive', usedMap: false, ghost: st.race ? { u: 0, path: solve(maze, 0, goalCell()) } : null });
  mz.visits[0] = 1; mz.pos.copy(cellCentre(0)); mz.yaw = firstYaw(0); mz.pitch = 0; mazeView(); labels(); share.touch();
}
function firstYaw(i) { for (const [d, yaw] of [[0, -Math.PI / 2], [2, Math.PI], [1, Math.PI / 2], [3, 0]]) if (isOpen(maze, i, d)) return yaw; return 0; }
// every wall is one instance of a box, so watching the maze being built can take walls away one at a time
function buildMazeScene(exploded) {
  clear(world); const { X, Y, Z } = maze, list = [], ex = exploded ? 1.8 : 1;
  wallKey = new Map();
  const add = (k, cx, cy, cz, sx, sy, sz, floorLevel) => { wallKey.set(k, list.length); list.push({ cx, cy, cz, sx, sy, sz, z: floorLevel }); };
  for (let z = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) {
    const i = maze.id(x, y, z), b = z * H * ex;
    add(i + ':0', x + 1, b + H / 2, y + 0.5, TH, H, 1 + TH, z); add(i + ':2', x + 0.5, b + H / 2, y + 1, 1 + TH, H, TH, z);
    if (x === 0) add(i + ':1', 0, b + H / 2, y + 0.5, TH, H, 1 + TH, z); if (y === 0) add(i + ':3', x + 0.5, b + H / 2, 0, 1 + TH, H, TH, z);
    add(i + ':5', x + 0.5, b, y + 0.5, 1 + TH, TH, 1 + TH, z);   // the floor under each room (a shaft down is an opening in it)
    if (z === Z - 1 && !exploded) add(i + ':4', x + 0.5, b + H, y + 0.5, 1 + TH, TH, 1 + TH, z);   // the roof
  }
  walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMat, list.length); walls.userData.list = list;
  wallColours();
  world.add(walls); applyOpenings(Infinity);
  crumbs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 16), markMat, maze.N); world.add(crumbs);
  pathMarks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fffd0 }), maze.N); world.add(pathMarks);
  goalMesh = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 12, 32), goalMat); goalMesh.position.copy(cellCentre(goalCell(), exploded)).setY(goalMesh.position.y - EYE + H * 0.5); world.add(goalMesh);
  const gl = new THREE.PointLight(0xffd36e, 1.2, 3, 1.5); goalMesh.add(gl);
  playerMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: 0x9fd0ff })); playerMesh.visible = false; world.add(playerMesh);
  ghostMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff8fd0, transparent: true, opacity: 0.8 })); ghostMesh.visible = false; ghostMesh.add(new THREE.PointLight(0xff8fd0, 0.8, 2.5, 1.5)); world.add(ghostMesh);
  mz.exploded = exploded; refreshMarks();
}
function wallColours() { const list = walls.userData.list, Z = maze.Z; list.forEach((w, k) => { const c = tone(0.12 + 0.76 * (Z > 1 ? w.z / (Z - 1) : 0.5)).map(v => v * (w.sy < H ? 0.55 : 1)); walls.setColorAt(k, new THREE.Color(...c)); }); if (walls.instanceColor) walls.instanceColor.needsUpdate = true; }
// show the walls that are still standing: all of them, or only those not yet opened after `upto` building steps
function applyOpenings(upto) {
  const list = walls.userData.list, M = new THREE.Matrix4(), hidden = new Set(), steps = maze.steps;
  const n = Math.min(upto, steps.length); for (let s = 0; s < n; s++) { const [i, d] = steps[s]; hidden.add(d % 2 === 0 ? i + ':' + d : neighbour(maze, i, d) + ':' + (d - 1)); }
  if (upto === Infinity) for (let i = 0; i < maze.N; i++) for (const d of [0, 2, 4]) if (isOpen(maze, i, d)) hidden.add(i + ':' + d);
  if (upto === Infinity) for (let i = 0; i < maze.N; i++) if (isOpen(maze, i, 5)) hidden.add(i + ':5');
  for (let s = 0; upto !== Infinity && s < n; s++) { const [i, d] = steps[s]; if (d === 4) hidden.add(neighbour(maze, i, 4) + ':5'); if (d === 5) hidden.add(i + ':5'); }
  for (const [key, k] of wallKey) { const w = list[k], off = hidden.has(key) ? 0 : 1; M.makeScale(w.sx * off || 1e-6, w.sy * off || 1e-6, w.sz * off || 1e-6).setPosition(w.cx, w.cy, w.cz); walls.setMatrixAt(k, M); }
  walls.instanceMatrix.needsUpdate = true; if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
}
function refreshMarks() {
  const M = new THREE.Matrix4(), ex = mz.exploded; let k = 0;
  for (let i = 0; i < maze.N; i++) { const v = mz.visits ? mz.visits[i] : 0, c = cellCentre(i, ex); M.makeScale(v && st.crumbs ? 1 : 1e-6, 1, v && st.crumbs ? 1 : 1e-6).setPosition(c.x, c.y - EYE + 0.05, c.z); crumbs.setMatrixAt(i, M); crumbs.setColorAt(i, new THREE.Color(...(v >= 2 ? [1, 0.45, 0.45] : [1, 0.92, 0.55]))); }
  crumbs.instanceMatrix.needsUpdate = true; if (crumbs.instanceColor) crumbs.instanceColor.needsUpdate = true;
  const show = mz.path && (mz.hint > 0 || mz.over || mz.mode === 'solve') ? (mz.hint > 0 ? mz.path.slice(Math.max(0, Math.floor(mz.u)), Math.floor(mz.u) + 7) : mz.path) : [];
  for (let i = 0; i < maze.N; i++) { M.makeScale(1e-6, 1e-6, 1e-6); pathMarks.setMatrixAt(i, M); }
  show.forEach(i => { const c = cellCentre(i, ex); M.makeScale(1, 1, 1).setPosition(c.x, c.y - 0.2, c.z); pathMarks.setMatrixAt(k++, M); });
  pathMarks.instanceMatrix.needsUpdate = true;
}
function mazeView() {   // first person, or the map from above
  if (mz.over) { leaveFirstPerson(); clear(orbit); buildMazeScene(true); world.visible = true; orbit.visible = true; S.scene.remove(world); orbit.add(world);
    const { X, Y, Z } = maze; world.position.set(-X / 2, -(Z - 1) * H * 0.9, -Y / 2); S.fit.scale.setScalar(2.4 / Math.max(X, Y, Z * 1.8)); playerMesh.visible = true; }
  else { if (world.parent !== S.scene) { orbit.remove(world); S.scene.add(world); world.position.set(0, 0, 0); } buildMazeScene(false); enterFirstPerson(); setFov(80); playerMesh.visible = false; }
  refreshMarks();
}
function mazeCollide(p) {   // keep the eye inside the rooms: walls, floors and roofs are solid, openings are not
  const r = 0.2, x = clamp(Math.floor(p.x), 0, maze.X - 1), y = clamp(Math.floor(p.z), 0, maze.Y - 1), z = clamp(Math.floor((p.y - EYE + 0.5) / H), 0, maze.Z - 1), i = maze.id(x, y, z);
  if (p.x - x < r && !isOpen(maze, i, 1)) p.x = x + r; if (x + 1 - p.x < r && !isOpen(maze, i, 0)) p.x = x + 1 - r;
  if (p.z - y < r && !isOpen(maze, i, 3)) p.z = y + r; if (y + 1 - p.z < r && !isOpen(maze, i, 2)) p.z = y + 1 - r;
  const fl = z * H + 0.2, ce = z * H + H - 0.2; if (p.y < fl && !isOpen(maze, i, 5)) p.y = fl; if (p.y > ce && !isOpen(maze, i, 4)) p.y = ce;
  p.x = clamp(p.x, r, maze.X - r); p.z = clamp(p.z, r, maze.Y - r); p.y = clamp(p.y, 0.2, (maze.Z - 1) * H + H - 0.2);
}
const mazeClock = new Groove();
// a tap (no drag) steps into the next room the way you're looking: the touch screen's W
let tapAt = null;
canvas.addEventListener('pointerdown', e => { tapAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', e => { const t = tapAt; tapAt = null; if (e.pointerType === 'touch' && touchTapping()) return;   /* full screen: a tap pauses */ if (!t || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8 || performance.now() - t.t > 400) return;
  if (st.kind === 'maze' && maze && !mz.over && mz.mode === 'drive' && !mz.glide) stepRoom(); });
function stepRoom() {
  const fwd = [-Math.sin(mz.yaw) * Math.cos(mz.pitch), -Math.cos(mz.yaw) * Math.cos(mz.pitch), Math.sin(mz.pitch)], V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];   /* in maze axes: x, y (world z), floor */
  let best = -1, bd = 0.45; for (let d = 0; d < 6; d++) { if (!isOpen(maze, mz.cell, d)) continue; const k = V[d][0] * fwd[0] + V[d][1] * fwd[1] + V[d][2] * fwd[2]; if (k > bd) { bd = k; best = d; } }
  if (best < 0) { flashCap('A wall that way: drag to turn, then tap.'); capTimer = 1.5; return; }
  mz.glide = { a: mz.pos.clone(), b: cellCentre(neighbour(maze, mz.cell, best)), t: 0 }; }
function stepMaze(dt) {
  const k = drive(), f = (k.fast ? 3 : 1) * k.scale;
  if (mz.build) { mz.build.t += dt; const n = Math.floor(mz.build.t / mz.build.dt); applyOpenings(n); if (n >= maze.steps.length) { mz.build = null; applyOpenings(Infinity); } }
  if (mz.over) { S.step(dt); placePlayerMarker(); ghostStep(dt); return; }
  if (S.pointers.size || Math.abs(S.vel.x) + Math.abs(S.vel.y) > 1e-5) { mz.yaw -= S.vel.x * 1.2; mz.pitch = clamp(mz.pitch - S.vel.y * 1.2, -1.3, 1.3); S.vel.x = S.vel.y = 0; }
  if ((mz.mode === 'solve' && mz.path) || (mz.mode === 'hand' && mz.hand)) {   // (a new maze mid-solve clears the route)
    const route = mz.mode === 'solve' ? mz.path : mz.hand.path, speed = mz.mode === 'solve' ? 1.6 : 2.6;
    if (!st.paused) mz.u = Math.min(route.length - 1, mz.u + mazeClock.delta(dt, speed, 1, true));   // with a steady beat: one room per beat, turning corners on the beat
    const i0 = Math.floor(mz.u), w = mz.u - i0, a = cellCentre(route[i0]), b = cellCentre(route[Math.min(route.length - 1, i0 + 1)]);
    mz.pos.lerpVectors(a, b, w * w * (3 - 2 * w)); const d = b.clone().sub(a);
    if (Math.abs(d.x) + Math.abs(d.z) > 0.01) { const want = Math.atan2(-d.x, -d.z); let dy = want - mz.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; mz.yaw += dy * Math.min(1, dt * 6); }
    mz.pitch += ((Math.abs(d.y) > 0.01 ? Math.sign(d.y) * 0.9 : 0) - mz.pitch) * Math.min(1, dt * 4);
    if (mz.u >= route.length - 1) { const reached = route[route.length - 1] === goalCell(); mz.mode = 'drive';
      if (mz.hand) flashCap(reached ? `<b>Out by the left-hand rule</b>, in ${mz.hand.path.length - 1} steps.` : '<b>The left hand went round and round.</b> With loops, keeping your hand on the wall can circle an island forever, and never reach the goal in the middle.');
      else if (reached) { mz.done = true; flashCap('<b>Solved.</b> That was the shortest route. Now press N for a new maze and try to match it yourself.'); } mz.hand = null; labels(); }
  } else {
    if (k.any) { mz.yaw -= k.turnX * 1.8 * f * dt; mz.pitch = clamp(mz.pitch + k.turnY * 1.2 * f * dt, -1.3, 1.3); }
    else if (!S.pointers.size) mz.pitch *= Math.exp(-dt * 1.5);
    const fwd = new V3(-Math.sin(mz.yaw) * Math.cos(mz.pitch), Math.sin(mz.pitch), -Math.cos(mz.yaw) * Math.cos(mz.pitch)), right = new V3(Math.cos(mz.yaw), 0, -Math.sin(mz.yaw)), sp = 1.9 * f * dt;
    if (k.any && !st.paused) { mz.glide = null; mz.pos.addScaledVector(fwd, k.slideY * sp).addScaledVector(right, k.slideX * sp); mazeCollide(mz.pos); }
    else if (mz.glide) { const G2 = mz.glide; G2.t = Math.min(1, G2.t + dt / 0.45); const e = G2.t * G2.t * (3 - 2 * G2.t); mz.pos.lerpVectors(G2.a, G2.b, e); if (G2.t >= 1) mz.glide = null; }
  }
  // which room are we in now?
  const c = maze.id(clamp(Math.floor(mz.pos.x), 0, maze.X - 1), clamp(Math.floor(mz.pos.z), 0, maze.Y - 1), clamp(Math.floor((mz.pos.y - EYE + 0.5) / H), 0, maze.Z - 1));
  if (c !== mz.cell) { mz.cell = c; if (mz.mode === 'drive') { mz.steps++; if (degree(maze, c) === 1 && c !== 0 && c !== goalCell() && !mz.visits[c]) mz.deadEnds++; } mz.visits[c]++; refreshMarks();
    if (c === goalCell() && mz.mode === 'drive' && !mz.done && !mz.solved) finishMaze(); }
  if (mz.hint > 0) { mz.hint -= dt; if (mz.hint <= 0) refreshMarks(); }
  ghostStep(dt);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(mz.pitch, mz.yaw, 0, 'YXZ')); putCamera(mz.pos, q); setFov(80); lamp.intensity = 0.9; lamp.distance = 3.2; setFog(0.5, 7 - st.fog * 4);
  goalMesh.rotation.y += dt * 1.5; goalMesh.scale.setScalar(1 + 0.3 * flash());
}
function placePlayerMarker() { const c = cellCentre(mz.cell, true); playerMesh.position.copy(c); goalMesh.rotation.y += 0.02; }
function ghostStep(dt) {   // racing the solver: a ghost that drives the shortest route at a steady pace
  if (!mz.ghost || mz.done) { if (ghostMesh) ghostMesh.visible = false; return; }
  const P = mz.ghost.path; if (!st.paused) mz.ghost.u = Math.min(P.length - 1, mz.ghost.u + dt * 0.55);
  const i0 = Math.floor(mz.ghost.u), w = mz.ghost.u - i0; ghostMesh.visible = true; ghostMesh.position.lerpVectors(cellCentre(P[i0], mz.over), cellCentre(P[Math.min(P.length - 1, i0 + 1)], mz.over), w);
  if (mz.ghost.u >= P.length - 1 && !mz.ghost.won) { mz.ghost.won = true; flashCap('<b>The solver got there first.</b> Keep going: your score is still measured against the shortest route.'); }
}
function finishMaze() {
  mz.done = true; const best = solve(maze, 0, goalCell()).length - 1, eff = best / Math.max(1, mz.steps), secs = (performance.now() - mz.t0) / 1000;
  const key = `mathexplorer.maze.${st.level}.${st.method}.${st.loops}.${st.goal}.${st.seed}`; let prev = null; try { prev = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { /* storage blocked */ }
  const better = !prev || eff > prev.eff || (eff === prev.eff && secs < prev.secs); if (better) try { localStorage.setItem(key, JSON.stringify({ eff, secs })); } catch (e) { /* not saved */ }
  flashCap(`<b>Out!</b> ${mz.steps} steps; the shortest route is ${best}. Score <b>${Math.round(eff * 100)}%</b> in ${secs.toFixed(0)} s, ${mz.deadEnds} dead end${mz.deadEnds === 1 ? '' : 's'}${mz.usedMap ? ', with the map' : ''}${mz.ghost && mz.ghost.won ? '' : mz.ghost ? ', <b>ahead of the solver</b>' : ''}.${better ? ' A new best for this maze.' : ''}`);
  capTimer = 9; labels();
}
function solveDive() { if (!maze) return; if (mz.over) { mz.over = false; mazeView(); } mz.path = solve(maze, mz.cell, goalCell()); mz.u = 0; mz.mode = 'solve'; mz.solved = true; refreshMarks(); labels(); }
function showHint() { if (!maze) return; mz.path = solve(maze, mz.cell, goalCell()); mz.u = 0; mz.hint = 3; refreshMarks(); }
function leftHand() { if (!maze) return; if (maze.Z > 1) { flashCap('<b>In 3D there is no "left wall" to follow.</b> Choose level 1 (one floor) to try the left-hand rule.'); return; } if (mz.over) { mz.over = false; mazeView(); }
  mz.hand = wallFollow(maze, mz.cell, goalCell(), maze.N * 8); mz.u = 0; mz.mode = 'hand'; labels(); }
function watchBuild() { if (!maze) return; mz.over = true; mazeView(); mz.build = { t: 0, dt: Math.min(0.08, 6 / maze.steps.length) }; applyOpenings(0); labels(); }

// ======================================================================================================
// ANCIENT LABYRINTHS
// ======================================================================================================
let lab = null; const LK = 10;   // the labyrinth's radius is about 1; it is built ten times that size
const walkL = { on: false, s: 0, yaw: 0, pitch: 0, len: 0, cum: null };
function buildClassic(group, k) {
  lab = labyrinthPath(st.seq); const { P, w } = lab, off = w * 0.46, hgt = 0.06, mk = side => {
    const pts = []; for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; pts.push([P[i][0] - ty / l * off * side, P[i][1] + tx / l * off * side]); } return pts; };
  const pos = [], col = [];
  for (const side of [1, -1]) { const L = mk(side);
    for (let i = 0; i + 1 < L.length; i++) { const a = L[i], b = L[i + 1], c = tone(0.15 + 0.7 * i / L.length);
      for (const [p, y] of [[a, 0], [b, 0], [b, hgt], [a, 0], [b, hgt], [a, hgt]]) { pos.push(p[0] * k, y * k, -p[1] * k); col.push(...c); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  group.add(new THREE.Mesh(g, FIN[st.finish === 'bubble' ? 'satin' : st.finish]));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.14 * k, 96), plain({ color: new THREE.Color(st.bg).lerp(new THREE.Color(0x30343e), 0.6) })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.002 * k; group.add(floor);
  const centre = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * k, 0.05 * k, 0.02 * k, 32), goalMat); group.add(centre);
  walkL.cum = [0]; for (let i = 1; i < P.length; i++) walkL.cum.push(walkL.cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); walkL.len = walkL.cum[walkL.cum.length - 1];
}
function buildClassicOrbit() { clear(orbit); buildClassic(orbit, 1); orbit.rotation.set(0.95, orbit.rotation.y, 0); S.fit.scale.setScalar(1.75); S.fit.position.set(0, -0.05, 0); }   /* tipped toward you, and turning about its own middle */
const at2 = s => { const C = walkL.cum, P = lab.P; let lo = 0, hi = C.length - 1; s = clamp(s, 0, walkL.len); while (hi - lo > 1) { const m = (lo + hi) >> 1; if (C[m] <= s) lo = m; else hi = m; } const t = (s - C[lo]) / ((C[hi] - C[lo]) || 1); return [P[lo][0] + (P[hi][0] - P[lo][0]) * t, P[lo][1] + (P[hi][1] - P[lo][1]) * t]; };
const walkClk = new Groove();
function startWalkL() { clear(world); buildClassic(world, LK); enterFirstPerson(); walkL.on = true; walkL.s = 0; walkL.yaw = 0; walkL.pitch = -0.1; setFov(78); labels(); }
function endWalkL() { if (!walkL.on) return; walkL.on = false; leaveFirstPerson(); clear(world); labels(); }
function stepWalkL(dt) {
  const k = drive(), f = (k.fast ? 3 : 1) * k.scale;
  if (S.pointers.size || Math.abs(S.vel.x) + Math.abs(S.vel.y) > 1e-5) { walkL.yaw -= S.vel.x * 1.2; walkL.pitch = clamp(walkL.pitch - S.vel.y, -1, 0.8); S.vel.x = S.vel.y = 0; }
  if (k.any) { walkL.yaw -= k.turnX * 1.5 * f * dt; walkL.pitch = clamp(walkL.pitch + k.turnY * f * dt, -1, 0.8); } else if (!S.pointers.size) walkL.yaw *= Math.exp(-dt * 1.5);
  // there are no choices: the only thing to decide is forward or back (W / S), or let it walk on its own (with the beat)
  const ring = lab.w, step = k.any && k.slideY ? k.slideY * 0.5 * f * dt : (!st.paused ? walkClk.delta(dt, 0.12 * st.flySpeed, 0.06 * st.flySpeed) : 0);
  walkL.s = clamp(walkL.s + step, 0, walkL.len);
  const p = at2(walkL.s), q = at2(walkL.s + ring * 0.6), dir = Math.atan2(-(q[0] - p[0]), (q[1] - p[1]));
  const eye = new V3(p[0] * LK, 0.028 * LK, -p[1] * LK), quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(walkL.pitch, dir + walkL.yaw + Math.PI, 0, 'YXZ'));
  putCamera(eye, quat); lamp.intensity = 0.7; lamp.distance = 4; setFog(0.5, 9 - st.fog * 5);
  if (walkL.s >= walkL.len - 1e-6 && !walkL.done) { walkL.done = true; flashCap('<b>The centre.</b> One path, every ring visited, and never a choice to make.'); }
  if (walkL.s < walkL.len - 0.01) walkL.done = false;
}

// ======================================================================================================
// the panel, labels and numbers
// ======================================================================================================
$('tpmsList').innerHTML = Object.entries(TPMS).map(([k, s]) => `<button data-t="${k}">${s.name}</button>`).join('');
$('foamList').innerHTML = Object.entries(FOAMS).map(([k, s]) => `<button data-f="${k}">${s.name}</button>`).join('');
$('classicList').innerHTML = Object.entries(CLASSIC).map(([k, s]) => `<button data-c="${k}">${s.name}</button>`).join('') + '<button data-c="random">Make a new one</button>';
document.querySelectorAll('#tpmsList, #foamList, #mazeList, #classicList').forEach(el => el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.t) pick('tpms', b.dataset.t); else if (b.dataset.f) pick('foam', b.dataset.f); else if (b.dataset.maze) { st.race = b.dataset.maze === 'race'; pick('maze'); } else pick('classic', b.dataset.c); }));
function stopMoving() { endFly(); endFoamFly(); endWalkL(); if (st.kind !== 'maze' && fpOn) leaveFirstPerson(); }
function pick(kind, key, keepView) {
  stopMoving(); if (st.kind === 'maze' && kind !== 'maze' && fpOn) leaveFirstPerson();   // a maze is always first person: leave it when picking anything else if (world.parent !== S.scene) { orbit.remove(world); S.scene.add(world); world.position.set(0, 0, 0); }
  st.kind = kind; if (kind === 'tpms' && key) st.tpms = key; if (kind === 'foam' && key) st.foam = key;
  if (kind === 'classic') { if (key === 'random') st.seq = randomLabyrinth(st.rings, Math.random) || st.seq, st.classic = 'random'; else if (key && CLASSIC[key]) { st.classic = key; st.seq = CLASSIC[key].seq.slice(); setRange('cRings', st.seq.length); } }
  for (const k of ['tpms', 'foam', 'maze', 'classic']) $('c-' + k).hidden = k !== kind;
  document.querySelectorAll('[data-for]').forEach(el => { el.hidden = el.dataset.for !== kind; });
  canvas.toggleAttribute('data-own-taps', kind === 'maze');   /* in a maze a tap steps forward (outside full screen) */
  motionFor(kind);
  if (!keepView) S.reset(); orbit.rotation.set(0, 0, 0);
  if (kind === 'tpms') buildTpmsOrbit(); else if (kind === 'foam') buildFoamOrbit(); else if (kind === 'classic') buildClassicOrbit(); else { clear(orbit); mz.over = false; newMaze(); }
  markLists(); labels(); share.touch();
}
function markLists() { document.querySelectorAll('#tpmsList button, #foamList button, #mazeList button, #classicList button').forEach(b => b.classList.toggle('on',
  (st.kind === 'tpms' && b.dataset.t === st.tpms) || (st.kind === 'foam' && b.dataset.f === st.foam) || (st.kind === 'maze' && b.dataset.maze === (st.race ? 'race' : '1')) || (st.kind === 'classic' && b.dataset.c === st.classic))); }
const KIND_NAME = { tpms: 'Endless labyrinth', foam: 'Foam', maze: 'Maze', classic: 'Ancient labyrinth' };
function labels() {
  let t = '', sub = '', about = '', hint = '', pr = '';
  if (st.kind === 'tpms') { const s = tp(); t = s.name; sub = s.alt; about = `<strong>${s.name}.</strong> ${s.info}`;
    hint = fly.on ? 'Arrows or drag: steer · W S: faster / slower · A D: slide · N: through the wall · T: steer itself · G: stop' : 'Drag to turn · scroll to zoom · G to fly through it';
    $('flyBtn').textContent = fly.on ? 'Stop flying' : 'Fly through it'; pr = 'Prints the cube you see as a solid block: a light, strong lattice like the ones engineers use inside 3D-printed parts.';
    $('tModeNote').textContent = { sheet: 'The surface given a little thickness: a wall with a maze on each side.', network: 'One maze filled in solid; the other left open to fly through. N swaps them.', double: 'Both mazes filled in, leaving only the thin gap where the wall was.' }[st.tmode]; }
  else if (st.kind === 'foam') { const f = FOAMS[st.foam]; t = f.name; sub = f.alt; about = `<strong>${f.name}.</strong> ${f.info}`; hint = ffly.on ? 'Arrows or drag: steer · W S: speed · G: stop' : 'Drag to turn · scroll to zoom · G to fly through the foam';
    $('fFly').textContent = ffly.on ? 'Stop flying' : 'Fly through the foam'; pr = 'Prints the edges of the bubbles as a frame (the Plateau borders), ready to hold up to the light.'; }
  else if (st.kind === 'maze') { const [X, Y, Z] = LEVELS[st.level]; t = st.race ? 'Race the solver' : 'Maze'; sub = `${X} × ${Y} rooms on ${Z} floor${Z > 1 ? 's' : ''}, maze number ${st.seed}`;
    about = st.race ? '<strong>Race the solver.</strong> A pink ghost drives the shortest route to the goal. Drive yourself (arrows to turn, W to go) and try to get there first, by the best route you can find.' : '<strong>A maze.</strong> Find your way to the golden ring. Arrows turn, W and S move, A and D step sideways; look up or down (↑ ↓) and move to climb shafts between floors. On a touch screen, drag to look and tap to step into the next room. G shows the shortest route by driving it; T gives a hint; O shows the map.';
    hint = mz.over ? 'The map: drag to turn · O to go back in' : mz.mode === 'solve' ? 'Watching the solver drive the shortest route…' : '← →: turn · ↑ ↓: look up / down · W S: move · A D: step aside · tap: next room · G: solve · T: hint · O: map';
    $('mMethodNote').textContent = { dfs: 'Wander until stuck, back up, branch: long winding corridors and few dead ends.', prim: 'Grow outward from the start, picking at random: lots of short dead ends.', wilson: 'Random walks with their loops erased: every possible maze equally likely.' }[st.method];
    let best = null; try { best = JSON.parse(localStorage.getItem(`mathexplorer.maze.${st.level}.${st.method}.${st.loops}.${st.goal}.${st.seed}`) || 'null'); } catch (e) { /* blocked */ }
    $('mBest').textContent = best ? `Your best on this maze: ${Math.round(best.eff * 100)}% in ${best.secs.toFixed(0)} s.` : 'No score on this maze yet: reach the goal yourself to set one.';
    pr = 'Prints the maze as a block you can hold, every floor and wall solid (cut it in half to see inside, or print it in clear plastic).'; }
  else { const c = CLASSIC[st.classic]; t = c ? c.name : `A new ${st.seq.length}-ring labyrinth`; sub = 'one path, no choices: rings ' + st.seq.join(', ') + ', then the centre';
    about = c ? `<strong>${c.name}.</strong> ${c.info}` : `<strong>A new labyrinth.</strong> Made by choosing an order for the rings at random, keeping to the rule that the turns on each side never cross. It is one of ${countLabyrinths(Math.min(st.seq.length, 10)).toLocaleString()} possible ${st.seq.length}-ring labyrinths${st.seq.length > 10 ? ' (and more)' : ''}.`;
    hint = walkL.on ? 'W S: forward / back (or let it walk with the beat) · arrows: look · G: stop' : 'Drag to turn · scroll to zoom · G to walk the path';
    $('cWalk').textContent = walkL.on ? 'Stop walking' : 'Walk the path (G)'; $('cSeq').textContent = `Ring order: ${st.seq.join(' → ')} → centre.`; pr = 'Prints the labyrinth as a plaque with raised walls: run a finger along the path.'; }
  $('title').textContent = t; $('subtitle').textContent = sub; $('about').innerHTML = about; $('hint').textContent = hint; $('gv-shapes').textContent = t; $('prAbout').textContent = pr;
  $('gv-ctl').textContent = fly.on || ffly.on ? 'flying' : walkL.on ? 'walking' : st.kind === 'maze' ? (mz.over ? 'map' : 'driving') : '';
  $('lgBar').style.background = rampCss(R); const L = st.cmode === 'side' ? (st.kind === 'foam' ? ['12-faced', '14-faced'] : st.kind === 'tpms' ? ['one maze', 'the other'] : ['', '']) : st.cmode === 'height' ? ['low', 'high'] : ['', ''];
  $('lgL').textContent = L[0]; $('lgR').textContent = L[1]; $('legend').style.visibility = L[0] ? '' : 'hidden';
  stats();
}
let solidFrac = null;
function stats() {
  let note = '';
  if (st.kind === 'tpms') { const s = tp();
    if (fly.on) { setStats([String(fly.visited.size), 'cells visited'], [fly.side > 0 ? 'maze A' : 'maze B', 'you are in'], st.beacon ? [String(fly.found), 'beacons found'] : [s.meet, 'tunnels at a junction']); note = 'The pattern repeats every cell, forever: there is always more labyrinth.'; }
    else { if (solidFrac === null) { const F = field(); let n = 0; for (let i = 0; i < 4000; i++) if (F((Math.random() * 2 - 1) * Math.PI, (Math.random() * 2 - 1) * Math.PI, (Math.random() * 2 - 1) * Math.PI) < 0) n++; solidFrac = n / 4000; }
      setStats([s.meet, 'tunnels at a junction'], [Math.round(solidFrac * 100) + '%', 'of space solid'], [s.same ? 'yes' : 'no', 'two mazes alike']); note = s.same ? 'Both mazes are the same shape, one shifted (or mirrored) from the other.' : 'The two mazes are different shapes: fly through both.'; } }
  else if (st.kind === 'foam') { const C = foamCells(st.foam), A = C.reduce((s, c) => s + c.faces.reduce((t, f) => t + faceArea(f), 0), 0) / C.length, cost = A / Math.pow(1 / C.length, 2 / 3);
    setStats([String(C.length), 'bubbles in each repeating cube'], [[...new Set(C.map(c => c.faces.length))].join(' and '), 'faces per bubble'], [cost.toFixed(3), 'film per bubble (flat)']);
    note = 'Film per bubble is the area of a bubble\'s faces measured against its volume: smaller is better. Flat-faced Weaire–Phelan beats flat Kelvin by about 0.4%. Every corner has exactly four edges, as Plateau said.'; }
  else if (st.kind === 'maze' && maze) { const best = solve(maze, mz.cell, goalCell()).length - 1;
    setStats([String(mz.steps), 'steps you took'], [String(best), 'shortest from here'], [String(maze.N), 'rooms']);
    note = mz.done ? 'Press N for a new maze, or change the level.' : `${[...Array(maze.N).keys()].filter(i => degree(maze, i) === 1).length} dead ends in this maze. Score = shortest route ÷ your route.`; }
  else if (st.kind === 'classic' && lab) { setStats([String(st.seq.length), 'rings'], [String(st.seq.length + 1), 'U-turns'], [(walkL.len / 2.28).toFixed(1) + '×', 'path length ÷ width']);
    note = `There are ${countLabyrinths(Math.min(st.seq.length, 10)).toLocaleString()} different labyrinths with ${Math.min(st.seq.length, 10)} rings: the "open meander" numbers.`; }
  $('statNote').textContent = note;
}
segClick('tMode', d => { st.tmode = d.m; solidFrac = null; if (fly.on) { buildFlyWorld(); fly.pos.copy(freeSpot(fly.pos)); } else buildTpmsOrbit(); labels(); share.touch(); });
$('tThick').addEventListener('input', e => { st.thick = +e.target.value; $('tThicko').textContent = st.thick.toFixed(2); solidFrac = null; clearTimeout(rebuildT); rebuildT = setTimeout(() => { if (fly.on) { buildFlyWorld(); fly.pos.copy(freeSpot(fly.pos)); } else if (st.kind === 'tpms') buildTpmsOrbit(); labels(); }, 120); share.touch(); });
let rebuildT = 0;
$('tCells').addEventListener('input', e => { st.cells = +e.target.value; $('tCellso').textContent = st.cells; if (st.kind === 'tpms' && !fly.on) buildTpmsOrbit(); share.touch(); });
$('flyBtn').addEventListener('click', () => go()); $('sideBtn').addEventListener('click', () => hopSide());
$('auto').addEventListener('change', e => { st.auto = e.target.checked; share.touch(); });
$('beacon').addEventListener('change', e => { st.beacon = e.target.checked; if (st.beacon && st.kind === 'tpms' && !fly.on) startFly(); labels(); share.touch(); });
$('flySpeed').addEventListener('input', e => { st.flySpeed = +e.target.value; $('flySpeedo').textContent = st.flySpeed.toFixed(1) + '×'; share.touch(); });
$('fBlock').addEventListener('input', e => { st.block = +e.target.value; $('fBlocko').textContent = `${st.block} × ${st.block} × ${st.block}`; if (st.kind === 'foam' && !ffly.on) buildFoamOrbit(); share.touch(); });
$('fFilms').addEventListener('change', e => { st.films = e.target.checked; if (st.kind === 'foam') { if (ffly.on) { clear(world); foamMeshes(world, 4, 1.5); } else buildFoamOrbit(); } share.touch(); });
$('fFly').addEventListener('click', () => go());
$('mLevel').addEventListener('input', e => { st.level = +e.target.value; $('mLevelo').textContent = st.level; if (st.kind === 'maze') newMaze(); share.touch(); });
segClick('mMethod', d => { st.method = d.m; if (st.kind === 'maze') newMaze(); share.touch(); });
$('mLoops').addEventListener('input', e => { st.loops = +e.target.value; $('mLoopso').textContent = st.loops ? Math.round(st.loops * 100) + '%' : 'none'; clearTimeout(rebuildT); rebuildT = setTimeout(() => { if (st.kind === 'maze') newMaze(); }, 200); share.touch(); });
segClick('mGoal', d => { st.goal = d.g; if (st.kind === 'maze') newMaze(); share.touch(); });
$('mSolve').addEventListener('click', () => solveDive()); $('mHint').addEventListener('click', () => showHint()); $('mOver').addEventListener('click', () => toggleMap());
$('mNew').addEventListener('click', () => newMaze(1 + Math.floor(Math.random() * 99998))); $('mBuild').addEventListener('click', () => watchBuild()); $('mHand').addEventListener('click', () => leftHand());
$('mCrumbs').addEventListener('change', e => { st.crumbs = e.target.checked; if (maze) refreshMarks(); share.touch(); });
$('cWalk').addEventListener('click', () => go()); $('cNew').addEventListener('click', () => pick('classic', 'random'));
$('cRings').addEventListener('input', e => { st.rings = +e.target.value; $('cRingso').textContent = st.rings; });
$('cRings').addEventListener('change', e => { if (e.isTrusted) pick('classic', 'random'); });   // let go of Rings: a new labyrinth with that many (picking a named one only shows its count)
$('detail').addEventListener('input', e => { st.detail = +e.target.value; $('detailo').textContent = st.detail; if (st.kind === 'tpms') { if (fly.on) buildFlyWorld(); else buildTpmsOrbit(); } share.touch(); });
$('fog').addEventListener('input', e => { st.fog = +e.target.value; $('fogo').textContent = st.fog.toFixed(2); share.touch(); });
$('spin').addEventListener('change', e => { st.spin = e.target.checked; share.touch(); });
// a palette change on the endless labyrinths only needs new vertex colours, not a new mesh (the music drifts the palette often)
function recolourTpms(mesh) { const g = mesh.geometry; g.setAttribute('color', new THREE.BufferAttribute(tpColours(g.attributes.position.array, g.attributes.normal.array), 3)); }
function recolourAll(cheap) { if (cheap && st.kind === 'maze' && walls) { wallColours(); return; } if (cheap && st.kind === 'tpms') { if (fly.on && fly.inst) recolourTpms(fly.inst); else if (orbit.children[0]) recolourTpms(orbit.children[0]); return; } if (st.kind === 'tpms') { if (fly.on) buildFlyWorld(); else buildTpmsOrbit(); } else if (st.kind === 'foam') { if (ffly.on) { clear(world); foamMeshes(world, 4, 1.5); } else buildFoamOrbit(); } else if (st.kind === 'classic') { if (walkL.on) { clear(world); buildClassic(world, LK); } else buildClassicOrbit(); } else if (maze) buildMazeScene(mz.over); labels(); }
segClick('cmode', d => { st.cmode = d.c; recolourAll(); share.touch(); });
buildSwatches($('palettes'), st.palette, name => { st.palette = name; R = rampOf(st.palette, st.palRev); palLabel(); recolourAll(); share.touch(); });
const palLabel = () => { $('palName').textContent = 'Palette: ' + palTitle(st.palette) + (st.palRev ? ' (reversed)' : ''); };
$('palRev').addEventListener('change', e => { st.palRev = e.target.checked; R = rampOf(st.palette, st.palRev); palLabel(); recolourAll(); share.touch(); });
$('cyc').addEventListener('input', e => { st.cycleSpeed = +e.target.value; $('cyco').textContent = st.cycleSpeed ? st.cycleSpeed.toFixed(1) + '×' : 'off'; share.touch(); });
segClick('finish', d => { st.finish = d.f; recolourAll(); share.touch(); });
// wall patterns: the Tilings patterns (and two more) on the walls, tinted by the palette
$('wallPat').innerHTML = WALL_PATTERNS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
const applyPattern = () => { setPattern(st.wpat, st.wpSize); patternRows(); };
$('wallPat').addEventListener('change', e => { st.wpat = WALL_PATTERNS.some(p => p[0] === e.target.value) ? e.target.value : 'none'; applyPattern(); share.touch(); });
$('patSize').addEventListener('input', e => { st.wpSize = +e.target.value; $('patSizeo').textContent = st.wpSize.toFixed(2); applyPattern(); share.touch(); });
$('patGlow').addEventListener('input', e => { st.wpGlow = +e.target.value; $('patGlowo').textContent = st.wpGlow ? st.wpGlow.toFixed(2) : 'off'; share.touch(); });
$('patMove').addEventListener('change', e => { st.wpMove = e.target.checked; share.touch(); });
$('patFloor').addEventListener('change', e => { st.wpFloor = e.target.checked; patternRows(); share.touch(); });
segClick('bg', d => { st.bg = d.b; lightStage(); S.setBackground(st.bg); recolourAll(); share.touch(); });
segClick('prSize', d => { st.mm = +d.mm; });
$('snap').addEventListener('click', () => { S.render(); saveCanvasPNG(canvas, fileName(fileBase()) + '.png', $('dlnote')); });
const fileBase = () => 'labyrinth_' + (st.kind === 'tpms' ? st.tpms + '_' + st.tmode : st.kind === 'foam' ? st.foam : st.kind === 'maze' ? `maze_L${st.level}_${st.seed}` : 'classic_' + st.seq.join(''));
document.querySelectorAll('.btn.try').forEach(b => b.addEventListener('click', () => { const [kind, a] = b.dataset.try.split('|');
  if (kind === 'tpms') { pick('tpms', a); if (b.dataset.try.endsWith('fly')) startFly(); if (b.dataset.try.endsWith('beacon')) setCheck('beacon', true); }
  else if (kind === 'foam') { pick('foam', a); if (b.dataset.try.endsWith('fly')) startFoamFly(); }
  else if (kind === 'maze') { st.race = a === 'race'; if (a === 'prim') clickData('#mMethod', 'm', 'prim'); if (a === 'hand' || a === 'handloops') { setRange('mLevel', 1); setRange('mLoops', a === 'handloops' ? 1 : 0); clickData('#mGoal', 'g', a === 'handloops' ? 'centre' : 'corner'); }
    pick('maze'); if (a === 'build') watchBuild(); if (a === 'hand' || a === 'handloops') setTimeout(leftHand, 300); }
  else if (kind === 'classic') { pick('classic', a); if (b.dataset.try.endsWith('walk')) startWalkL(); } }));
buildKeys($('keyTable'), [['G', 'Fly / walk / solve the maze (and stop)'], ['← → ↑ ↓', 'Steer and look'], ['W S', 'Forward / back (flying: faster / slower)'], ['A D', 'Step or slide sideways'], ['N', 'Through the wall to the other maze · a new maze · a new labyrinth'],
  ['T', 'Steer itself on / off · maze: a hint'], ['O', 'Maze: the map from above'], ['+ / −', 'Zoom (moving: faster / slower)'], ['1 – 4', 'Endless labyrinths, foams, mazes, ancient labyrinths'], ['Shift', 'Hold with the keys above to go three times faster']]);

// ---------- actions ----------
function go() { st.paused = false;
  if (st.kind === 'tpms') { if (fly.on) endFly(); else startFly(); }
  else if (st.kind === 'foam') { if (ffly.on) endFoamFly(); else startFoamFly(); }
  else if (st.kind === 'maze') { if (mz.mode === 'solve') { mz.mode = 'drive'; refreshMarks(); labels(); } else solveDive(); }
  else { if (walkL.on) endWalkL(); else startWalkL(); } }
function toggleMap() { if (st.kind !== 'maze' || !maze) return; mz.over = !mz.over; if (mz.over) mz.usedMap = true; mazeView(); labels(); }
function renew() { st.paused = false; if (st.kind === 'tpms') hopSide(); else if (st.kind === 'maze') newMaze(1 + Math.floor(Math.random() * 99998)); else if (st.kind === 'classic') pick('classic', 'random'); }
function resetView() { st.paused = false; if (st.kind === 'maze') { mz.over = false; newMaze(st.seed); } else { stopMoving(); S.reset(); } share.touch(); }

// ---------- loop ----------
let running = false, tPrev = 0, frame = 0;
// Rotation & motion (its own group), for the outside view and the maze map: turning (an ancient labyrinth turns about its
// own middle), rocking, tumbling, the camera's zoom and drift, and Slowly change (a wall's thickness, the foam's block...)
// a maze is always first person: turning and the camera don't apply there (looked up by id: the group may not exist yet)
function patternRows() { const none = st.wpat === 'none'; $('patSec').hidden = st.kind === 'foam'; $('patOpts').hidden = none; $('patFloorRow').hidden = st.kind !== 'maze'; WT.u_wtTop.value = st.kind !== 'maze' || st.wpFloor ? 1 : 0; }
function motionFor(kind) { patternRows(); for (const id of ['mvTurnSec', 'mvCamSec']) { const el = document.getElementById(id); if (el) el.hidden = kind === 'maze'; }
  // and the controls that only some kinds use: Detail (the surfaces' mesh), Colour by (surfaces and foams), Finish (not the maze's flat-lit walls)
  const show = (id, on) => { const el = $(id); el.hidden = !on; const l = el.previousElementSibling; if (l && l.matches('.lbl')) l.hidden = !on; };
  $('detail').closest('.row').hidden = kind !== 'tpms'; show('cmode', kind === 'tpms' || kind === 'foam'); show('finish', kind !== 'maze'); }
const MO = makeMotion3D(S, { spinRow: $('spin').closest('label'), rate: () => (st.kind === 'classic' ? 0.12 : 0.175), spinOn: () => st.spin,
  turn: a => { if (st.kind === 'classic') orbit.rotation.y += a; else S.turn(a, 0); },
  sweep: { skip: ['flySpeed', 'mLevel', 'mLoops', 'cRings', 'detail'], every: 120 } });
motionFor(st.kind);
const REC = addRecorder({ stage: canvas.parentElement, name: () => fileBase(), bg: () => st.bg });
// the Visualizer: a new labyrinth, foam or ancient labyrinth every so often; when the chorus comes in, fly through an
// endless labyrinth until the next change
makeVisualizer(MO, { preset: 'mvt=0.2&mvb=0.3&mvd=0.25', shape: () => (fpOn ? false : pickButton('#tpmsList button, #foamList button, #classicList button:not([data-c="random"])')),
  drop: () => { if (fly.on) return; if (st.kind !== 'tpms') pickButton('#tpmsList button'); startFly(); return () => endFly(); },
  extra: [['a new wall pattern', () => { if (st.kind === 'foam') return false; const o = WALL_PATTERNS.filter(q => q[0] !== st.wpat && q[0] !== 'none'), k = o[Math.floor(Math.random() * o.length)][0]; $('wallPat').value = k; $('wallPat').dispatchEvent(new Event('change')); if (!st.wpGlow) setRange('patGlow', 0.8); return true; }, 2]] });
function loop(now) {
  if (!running) return; const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now; frame++;
  setPausedTag(st.paused); const goOn = !st.paused;
  const outside = !fly.on && !ffly.on && !walkL.on && (st.kind !== 'maze' || !maze || mz.over);
  MO.step(dt, outside ? { go: goOn, spin: !S.pointers.size } : { away: true, go: goOn });
  if (fly.on) stepFly(dt); else if (ffly.on) stepFoamFly(dt); else if (walkL.on) stepWalkL(dt); else if (st.kind === 'maze' && maze) stepMaze(dt);
  else S.step(dt);
  const cs = goOn ? colourStep(dt) : 0; if (((goOn && st.cycleSpeed > 0) || cs) && frame % 6 === 0) { st.cycle = (st.cycle + (goOn ? dt * 6 * st.cycleSpeed * 0.06 : 0) + cs * 6) % 1; recolourAll(true); }
  // on each beat the outside view pulses (pivot is free here: the fit group's scale is set by each build), and vocals sway it
  const showing = outside && st.kind !== 'maze'; S.pivot.scale.setScalar(showing ? 1 + 0.05 * pulse() : 1); S.fit.rotation.z = showing ? 0.1 * voice() : 0;
  S.setFlash(flash());
  WT.u_wtGlow.value = st.wpGlow * (1 + 1.6 * flash() + 0.8 * pulse()); if (st.wpMove && !st.paused && st.wpat !== 'none') { WT.u_wtShift.value.x += dt * 0.025; WT.u_wtShift.value.y += dt * 0.011; }   // the pattern's glow follows the beat
  if (capTimer > 0) { capTimer -= dt; if (capTimer <= 0) { $('stageCap').style.display = 'none'; } }
  S.render(); if (frame % 15 === 0) stats(); if (frame % 30 === 0) share.touch();
  requestAnimationFrame(loop);
}

// ---------- 3D print ----------
$('prBtn').addEventListener('click', () => {
  const note = $('prNote'); let T = null;
  if (st.kind === 'tpms') { const L = Math.PI * st.cells * 0.98, F = field(); T = solidForPrint((x, y, z) => Math.max(F(x, y, z), Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) - L), 72, L * 1.04); }
  else if (st.kind === 'foam') { const G = foamGeometry(st.block), B = st.block, r = 0.03, edges = G.edges;
    T = solidForPrint((x, y, z) => { const p = [x + B / 2, y + B / 2, z + B / 2]; let d = Infinity; for (const [a, b] of edges) { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], t = clamp((ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2), 0, 1); const q = Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t); if (q < d) d = q; } return d - r; }, 56, B / 2 + 0.05); }
  else if (st.kind === 'maze' && maze) { const { X, Y, Z } = maze, half = Math.max(X, Y, Z * H) / 2 + 0.1, G = 80, tW = Math.max(TH / 2, 1.0 * 2 * half / G);   /* walls at least a grid step thick, so none drop out of the print */
    T = solidForPrint((x, y, z) => { const px = x + X / 2 + 0.01373, py = y + Z * H / 2 + 0.00917, pz = z + Y / 2 + 0.01131;   /* a small odd shift, so no wall lies exactly on the sampling grid */ if (px < -0.05 || pz < -0.05 || py < -0.05 || px > X + 0.05 || pz > Y + 0.05 || py > Z * H + 0.05) return 1;
      const cx = clamp(Math.floor(px), 0, X - 1), cz = clamp(Math.floor(pz), 0, Y - 1), cy = clamp(Math.floor(py / H), 0, Z - 1), i = maze.id(cx, cz, cy), t = tW; let d = 1;
      const fx = px - cx, fz = pz - cz, fy = py - cy * H;
      if (!isOpen(maze, i, 1) || cx === 0) d = Math.min(d, Math.abs(fx) - t); if (!isOpen(maze, i, 0)) d = Math.min(d, Math.abs(1 - fx) - t);
      if (!isOpen(maze, i, 3) || cz === 0) d = Math.min(d, Math.abs(fz) - t); if (!isOpen(maze, i, 2)) d = Math.min(d, Math.abs(1 - fz) - t);
      if (!isOpen(maze, i, 5)) d = Math.min(d, Math.abs(fy) - t); if (!isOpen(maze, i, 4) && cy === Z - 1) d = Math.min(d, Math.abs(H - fy) - t);
      return d; }, G, half); }
  else if (st.kind === 'classic' && lab) { const W = 360, c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, W); x.strokeStyle = '#fff'; x.lineCap = x.lineJoin = 'round';
    const { P, w } = lab, sc = W / 2.5, off = w * 0.46; x.lineWidth = Math.max(2, w * sc * 0.18);
    for (const side of [1, -1]) { x.beginPath(); P.forEach((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, q = [p[0] - ty / l * off * side, p[1] + tx / l * off * side]; const X2 = W / 2 + q[0] * sc, Y2 = W / 2 - q[1] * sc; i ? x.lineTo(X2, Y2) : x.moveTo(X2, Y2); }); x.stroke(); }
    const px = x.getImageData(0, 0, W, W).data, Hf = new Float32Array(W * W); for (let i = 0; i < W * W; i++) Hf[i] = px[i * 4] / 255; T = heightfieldTriangles(Hf, W, W, st.mm, 2.5, 3.5); }
  if (!T) return;
  if (st.kind !== 'classic') for (let i = 0; i < T.length; i += 3) { const y = T[i + 1], z = T[i + 2]; T[i + 1] = -z; T[i + 2] = y; }
  const r2 = stlFromTriangles(T, st.mm, 'Math Explorer labyrinth');
  saveFile(fileName(fileBase()) + `_${st.mm}mm.stl`, r2.bytes, note).then(ok => { if (ok) note.textContent += ` ${r2.size.map(v => Math.round(v)).join(' × ')} mm, ${r2.tris.toLocaleString()} triangles.`; });
});

// ---------- keys, sharing, lifecycle ----------
export function onKey(e) {
  if (e.key === 't' || e.key === 'T') { if (st.kind === 'maze') showHint(); else setCheck('auto', !st.auto); return true; }
  if (e.key === 'o' || e.key === 'O') { toggleMap(); return true; }
  return standardKeys(e, {
    pause: () => { st.paused = !st.paused; }, go, renew, reset: resetView,
    shape: dir => clickNext('#tpmsList button, #foamList button, #mazeList button, #classicList button', dir), palette: dir => clickNext('#palettes button', dir), colourMode: dir => clickNext('#cmode button', dir),
    reverse: () => $('palRev').click(), cycle: () => setRange('cyc', st.cycleSpeed > 0 ? 0 : 1),
    zoom: f => { if (fpOn) setRange('flySpeed', clamp(st.flySpeed / f, 0.2, 3)); else S.zoom(f); },
    mode: i => { const k = ['tpms', 'foam', 'maze', 'classic'][i]; if (k) pick(k, k === 'tpms' ? st.tpms : k === 'foam' ? st.foam : k === 'classic' ? 'cretan' : null); },
  });
}
const encode = () => { const p = new URLSearchParams(); p.set('k', st.kind);
  if (st.kind === 'tpms') { p.set('s', st.tpms); p.set('m', st.tmode); p.set('t', st.thick); if (st.cells !== 1) p.set('c', st.cells); if (st.flip < 0) p.set('fl', 1); if (!st.auto) p.set('au', 0); if (st.beacon) p.set('b', 1); }
  if (st.kind === 'foam') { p.set('s', st.foam); p.set('bl', st.block); if (!st.films) p.set('fi', 0); }
  if (st.kind === 'maze') { p.set('lv', st.level); p.set('me', st.method); if (st.loops) p.set('lo', st.loops); if (st.goal !== 'corner') p.set('go', st.goal); p.set('seed', st.seed); if (st.race) p.set('race', 1); if (!st.crumbs) p.set('cr', 0); }
  if (st.kind === 'classic') { p.set('seq', st.seq.join('-')); }
  if (st.flySpeed !== 1) p.set('fs', st.flySpeed); if (st.detail !== 2) p.set('d', st.detail); if (st.fog !== 0.5) p.set('fog', st.fog); p.set('cm', st.cmode); p.set('pal', st.palette); if (st.palRev) p.set('rev', 1);
  if (st.cycleSpeed) p.set('cyc', st.cycleSpeed); if (!st.spin) p.set('sp', 0); if (st.wpat !== 'none') { p.set('wp', st.wpat); if (st.wpSize !== 0.4) p.set('wps', st.wpSize); if (st.wpGlow) p.set('wpg', st.wpGlow); if (st.wpMove) p.set('wpm', 1); if (st.wpFloor) p.set('wpf', 1); } if (st.finish !== 'satin') p.set('fin', st.finish); if (st.bg !== '#0b0d12') p.set('bg', st.bg.slice(1));
  if (!fpOn && st.kind !== 'maze') { const q = S.pivot.quaternion; p.set('q', [q.x, q.y, q.z, q.w].map(r4).join('_')); p.set('z', r4(MO.baseZ())); }   /* the turned view, as you see it */
  MO.encode(p); return p.toString(); };
function apply(code) {
  const p = new URLSearchParams(code); let kind = p.get('k');
  if (!kind && TPMS[p.get('s')]) kind = 'tpms';   // an old Surfaces link to a triply periodic surface
  if (!['tpms', 'foam', 'maze', 'classic'].includes(kind)) return false;
  clickData('#palettes', 'pal', p.get('pal') || 'aurora'); setCheck('palRev', p.get('rev') === '1'); setRange('cyc', num(p, 'cyc', 0)); clickData('#finish', 'f', p.get('fin') || 'satin'); clickData('#bg', 'b', '#' + (p.get('bg') || '0b0d12'));
  clickData('#cmode', 'c', ['side', 'height', 'solid'].includes(p.get('cm')) ? p.get('cm') : 'side'); setRange('flySpeed', num(p, 'fs', 1)); setRange('detail', clamp(num(p, 'd', 2), 1, 4)); setRange('fog', num(p, 'fog', 0.5)); $('wallPat').value = WALL_PATTERNS.some(q => q[0] === p.get('wp')) ? p.get('wp') : 'none'; $('wallPat').dispatchEvent(new Event('change')); setRange('patSize', clamp(num(p, 'wps', 0.4), 0.1, 1.5)); setRange('patGlow', clamp(num(p, 'wpg', 0), 0, 2)); setCheck('patMove', p.get('wpm') === '1'); setCheck('patFloor', p.get('wpf') === '1'); setCheck('spin', p.get('sp') !== '0');
  if (kind === 'tpms') { st.tpms = TPMS[p.get('s')] ? p.get('s') : 'gyroid'; const m = p.get('m'); st.tmode = ['sheet', 'network', 'double'].includes(m) ? m : 'sheet'; document.querySelectorAll('#tMode button').forEach(b => b.classList.toggle('on', b.dataset.m === st.tmode));
    st.thick = clamp(num(p, 't', 0.18), 0.06, 0.6); $('tThick').value = st.thick; $('tThicko').textContent = st.thick.toFixed(2); st.cells = clamp(num(p, 'c', 1), 1, 2); $('tCells').value = st.cells; $('tCellso').textContent = st.cells;
    st.flip = p.get('fl') === '1' ? -1 : 1; setCheck('auto', p.get('au') !== '0'); st.beacon = p.get('b') === '1'; $('beacon').checked = st.beacon; }
  if (kind === 'foam') { st.foam = FOAMS[p.get('s')] ? p.get('s') : 'kelvin'; st.block = clamp(num(p, 'bl', 2), 1, 3); $('fBlock').value = st.block; $('fBlocko').textContent = `${st.block} × ${st.block} × ${st.block}`; st.films = p.get('fi') !== '0'; $('fFilms').checked = st.films; }
  if (kind === 'maze') { st.level = clamp(num(p, 'lv', 2), 1, 5); $('mLevel').value = st.level; $('mLevelo').textContent = st.level; st.method = ['dfs', 'prim', 'wilson'].includes(p.get('me')) ? p.get('me') : 'dfs'; document.querySelectorAll('#mMethod button').forEach(b => b.classList.toggle('on', b.dataset.m === st.method));
    st.loops = clamp(num(p, 'lo', 0), 0, 1); $('mLoops').value = st.loops; $('mLoopso').textContent = st.loops ? Math.round(st.loops * 100) + '%' : 'none'; st.goal = p.get('go') === 'centre' ? 'centre' : 'corner'; document.querySelectorAll('#mGoal button').forEach(b => b.classList.toggle('on', b.dataset.g === st.goal));
    st.seed = Math.max(1, Math.round(num(p, 'seed', 1))); st.race = p.get('race') === '1'; st.crumbs = p.get('cr') !== '0'; $('mCrumbs').checked = st.crumbs; }
  if (kind === 'classic') { const seq = (p.get('seq') || '').split('-').map(Number).filter(n => n > 0); const key = Object.keys(CLASSIC).find(k => CLASSIC[k].seq.join('-') === seq.join('-'));
    if (seq.length >= 1) { st.seq = seq; st.classic = key || 'custom'; } }
  pick(kind, kind === 'tpms' ? st.tpms : kind === 'foam' ? st.foam : kind === 'classic' ? (CLASSIC[st.classic] ? st.classic : null) : null, true);
  const q = (p.get('q') || '').split('_').map(Number); if (q.length === 4 && q.every(isFinite) && kind !== 'maze') S.pivot.quaternion.set(...q).normalize();
  const z = num(p, 'z', 0); if (z > 0 && kind !== 'maze') S.camera.position.z = clamp(z, 1.2, 14);
  MO.decode(p);
  if (kind === 'tpms' && st.beacon) startFly();
  return true;
}
const share = makeShare('labyrinth', encode, apply);
// the Paper background: dark stage text (as in Fractals); removed again when you leave this explorer
function lightStage() { document.getElementById('app').classList.toggle('light', st.bg === '#f3efe6'); }
MO.onChange = () => share.touch();
palLabel();
if (!apply(parseRoute().code)) pick('tpms', 'gyroid');
export function start() { lightStage(); S.resize(); running = true; tPrev = performance.now(); requestAnimationFrame(loop); share.write(); }
export function stop() { running = false; REC.stop(); document.getElementById('app').classList.remove('light'); }
export const reset = resetView;
export const going = () => st.kind === 'tpms' ? fly.on : st.kind === 'foam' ? ffly.on : st.kind === 'maze' ? mz.mode === 'solve' : walkL.on;
export const layoutChanged = () => S.resize();
export const showView = code => apply(code);
window.__lab = { st, fly, ffly, mz, walkL, S, get maze() { return maze; } };
export const soundHelp = 'Here, each beat flashes the light brighter (or, with Pulse, gives the outside view a little bounce), and the beacon pulses with it. Energy sets how fast you fly; with a steady beat the solver takes one room per beat, walking an ancient labyrinth each beat is a stride, and the turning and everything under Rotation & motion keep time. Vocals sway the outside view gently, and colour drifts the palette.';
