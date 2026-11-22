// Knots & Links explorer: knots and links drawn as tubes, and a ride along the knot like a roller coaster.
// Importing this module boots the explorer; the exports are the lifecycle the shell (js/main.js) drives.
import * as THREE from 'three';
import { $, clamp, segClick, clickNext, setRange, setCheck, clickData, setStats, buildSwatches, rampCss, r4, num, standardKeys, buildKeys, makeShare } from '../../js/common/kit.js';
import { rampOf, sampleRamp, sampleMirror } from '../../js/common/palettes.js';
import { makeStage3D, makeFinishes } from '../../js/common/three-stage.js';
import { saveCanvasPNG, saveFile, fileName } from '../../js/common/save.js';
import { stlFromTriangles, tubeTriangles } from '../../js/common/stl.js';
import { makeMotion3D, addRecorder } from '../../js/common/motion.js';
import { makeVisualizer, pickButton, randomSlider } from '../../js/common/visualizer.js';
import { flashFx as flash, pulseFx as pulse, voiceFx as voice, colourStep, Groove, Phase, cycleBeats, tempoLocked, bpm } from '../../js/shell/audio/react.js';
import { setPausedTag, drive } from '../../js/shell/keys.js';
import { parseRoute } from '../../js/shell/route.js';
import { SHAPES, GROUPS, defaults, curvePoints } from './knots.js';

// ---------- state ----------
const st = { shape: 'trefoil', P: {}, detail: 3, draw: 'solid', tube: 0.07, cmode: 'along', palette: 'aurora', palRev: false, cycle: 0, cycleSpeed: 0,
  finish: 'satin', bg: '#0b0d12', spin: true, speed: 0.5, paused: false, mm: 80, seat: 'top', watch: false, rideSpeed: 1 };
for (const k in SHAPES) st.P[k] = defaults(SHAPES[k]);
const sh = () => SHAPES[st.shape];

// ---------- the 3D stage ----------
const canvas = $('kc'), S = makeStage3D(canvas, { z: 6 }), FIN = makeFinishes(), V3 = THREE.Vector3;
S.addFlash(FIN.flat); S.addFlash(FIN.bubble);   // the finishes the lights don't reach still flash on the beat
const wireMat = S.addFlash(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
const rideLight = new THREE.PointLight(0xffffff, 0, 4, 1.6); S.scene.add(rideLight);   // a lamp on the rider, for the view inside the tube
let meshes = [], wires = [], ext = 1, centre = new V3();
function clearScene() { for (const o of [...meshes, ...wires]) { S.fit.remove(o); o.geometry.dispose(); } meshes = []; wires = []; }
const N_OF = [0, 48, 72, 104, 140, 190];
function build() {
  clearScene(); const s = sh(), P = st.P[st.shape], n = N_OF[st.detail], comps = curvePoints(s, P, Math.round(n * 2.4)), parts = [];
  comps.forEach((c, ci) => { const curve = new THREE.CatmullRomCurve3(c.map(p => new V3(...p)), true);
    parts.push({ g: new THREE.TubeGeometry(curve, c.length, st.tube, Math.max(8, n >> 3), true), comp: ci, n: comps.length }); });
  const box = new THREE.Box3(); for (const p of parts) { p.g.computeBoundingBox(); box.union(p.g.boundingBox); }
  centre = box.getCenter(new V3()); const sz = box.getSize(new V3()); ext = Math.max(sz.x, sz.y, sz.z) || 1;
  S.fit.position.set(0, 0, 0); S.fit.scale.setScalar(2.6 / ext);
  for (const p of parts) { p.g.translate(-centre.x, -centre.y, -centre.z); p.g.computeBoundingBox();
    const mesh = new THREE.Mesh(p.g, FIN[st.finish]); mesh.userData = p; meshes.push(mesh); S.fit.add(mesh);
    if (st.draw !== 'solid') { const w = new THREE.LineSegments(new THREE.WireframeGeometry(p.g), wireMat); wires.push(w); S.fit.add(w); } }
  rideTrack = null; recolour(); applyLook();
}
// ---------- colour (tubes come with uv: along the knot, and round the tube) ----------
function recolour() {
  const R = rampOf(st.palette, st.palRev), off = st.cycle;
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.attributes.position.array, uv = g.attributes.uv.array, nV = pos.length / 3, p = mesh.userData, yMin = g.boundingBox.min.y, yMax = g.boundingBox.max.y;
    const col = g.attributes.color ? g.attributes.color.array : new Float32Array(nV * 3);
    for (let i = 0; i < nV; i++) {
      const a = uv[i * 2], r = uv[i * 2 + 1]; let t, k = 1;
      switch (st.cmode) {
        case 'ring': t = p.n > 1 ? 0.08 + 0.84 * p.comp / (p.n - 1) : 0.5; break;
        case 'height': t = (pos[i * 3 + 1] - yMin) / (yMax - yMin || 1); break;
        case 'bands': t = (Math.floor(a * 24) & 1) ? 0.25 : 0.78; break;   // rings round the tube: you can see them rush past when riding
        case 'stripe': t = 0.25; if (Math.abs(r - 0.5) < 0.09) { t = 0.85; } break;   // one stripe along the tube: it shows how the tube twists
        case 'solid': t = 0.6; break;
        default: t = (a + (p.n > 1 ? p.comp / p.n : 0)) % 1;
      }
      const c = off ? sampleMirror(R, t * 0.5 + off) : sampleRamp(R, t); col[i * 3] = c[0] * k; col[i * 3 + 1] = c[1] * k; col[i * 3 + 2] = c[2] * k;
    }
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(col, 3)); else g.attributes.color.needsUpdate = true;
  }
  $('lgBar').style.background = rampCss(R);
  const L = { along: ['start', 'once round'], ring: ['first ring', 'last ring'], height: ['low', 'high'], bands: ['', ''], stripe: ['', ''], solid: ['', ''] }[st.cmode];
  $('lgL').textContent = L[0]; $('lgR').textContent = L[1]; $('legend').style.visibility = L[0] ? '' : 'hidden';
  $('cmodeNote').textContent = { along: 'Colour runs once round each loop, so you can follow it with your eye.', ring: 'Each loop of a link in its own colour.', height: 'Low strands dark, high strands bright.', bands: 'Bands round the tube, like a caterpillar: best for riding.', stripe: 'A single stripe painted along the tube, showing how it twists as it goes.', solid: 'One colour.' }[st.cmode];
}
function applyLook() { for (const m of meshes) { m.material = FIN[st.finish]; m.visible = st.draw !== 'wire'; } wireMat.color.set(st.bg === '#f3efe6' ? 0x223 : 0xffffff); wireMat.opacity = st.draw === 'wire' ? 0.8 : 0.3; }

// ---------- the ride ----------
// The track is each loop sampled finely, with a frame (forward, up, side) carried along without twisting (parallel
// transport). Coming back to the start the frame may have turned a little round the track; that turn is spread evenly
// over the lap so the frame joins up. "Up" therefore stays level as far as a knot allows, instead of rolling at bends.
let rideTrack = null;   // [{P, T, N, B, len}] per loop
function makeTrack() {
  const s = sh(), P = st.P[st.shape], NR = 2400;
  rideTrack = curvePoints(s, P, NR).map(pts => {
    const Pv = pts.map(p => new V3(p[0] - centre.x, p[1] - centre.y, p[2] - centre.z)), n = Pv.length, T = [], N = [], B = []; let len = 0;
    for (let i = 0; i < n; i++) { T.push(Pv[(i + 1) % n].clone().sub(Pv[(i + n - 1) % n]).normalize()); len += Pv[(i + 1) % n].distanceTo(Pv[i]); }
    let nrm = new V3(0, 1, 0); if (Math.abs(nrm.dot(T[0])) > 0.9) nrm.set(1, 0, 0); nrm.sub(T[0].clone().multiplyScalar(nrm.dot(T[0]))).normalize(); N.push(nrm);
    const q = new THREE.Quaternion();
    for (let i = 1; i <= n; i++) { q.setFromUnitVectors(T[i - 1], T[i % n]); const m = N[i - 1].clone().applyQuaternion(q); m.sub(T[i % n].clone().multiplyScalar(m.dot(T[i % n]))).normalize(); if (i < n) N.push(m); else nrm = m; }
    // close the frame: the angle between where N came back and where it started, spread over the lap
    const ang = Math.atan2(T[0].clone().cross(N[0]).dot(nrm), N[0].dot(nrm));
    for (let i = 0; i < n; i++) { N[i].applyAxisAngle(T[i], -ang * i / n); B.push(T[i].clone().cross(N[i])); }
    return { P: Pv, T, N, B, len };
  });
}
const ride = { on: false, comp: 0, s: 0, laps: 0, yaw: 0, pitch: 0, around: 0, aim: new V3(), aimW: 0, pivotQ: new THREE.Quaternion(), fov: 0 };
const lapClock = new Phase();
function startRide() {
  if (!rideTrack) makeTrack(); ride.on = true; ride.cmodeBefore = null;
  if (st.cmode === 'along') { ride.cmodeBefore = 'along'; clickData('#cmode', 'c', 'bands'); }   // bands rushing past show the motion; put back afterwards ride.comp = Math.min(ride.comp, rideTrack.length - 1); ride.s = 0; ride.laps = 0; ride.yaw = ride.pitch = 0; ride.aimW = 0;
  ride.pivotQ.copy(S.pivot.quaternion); S.vel.x = S.vel.y = 0; st.paused = false; labels(); }
function endRide() { if (!ride.on) return; ride.on = false; if (ride.cmodeBefore && st.cmode === 'bands') clickData('#cmode', 'c', ride.cmodeBefore); rideLight.intensity = 0; S.camera.up.set(0, 1, 0); S.camera.quaternion.identity(); S.reset(); S.resize(); labels(); }
const at = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
function trackAt(t, s) {   // position and frame at fraction s of the lap, interpolated
  const n = t.P.length, f = (((s % 1) + 1) % 1) * n, i = Math.floor(f), w = f - i, lerp = (a, b) => a.clone().lerp(b, w);
  return { P: lerp(at(t.P, i), at(t.P, i + 1)), T: lerp(at(t.T, i), at(t.T, i + 1)).normalize(), N: lerp(at(t.N, i), at(t.N, i + 1)).normalize(), B: lerp(at(t.B, i), at(t.B, i + 1)).normalize() };
}
function stepRide(dt) {
  const t = rideTrack[ride.comp], k = drive();
  // looking about: arrows (and dragging), easing back to straight ahead when let go; A / D slide round the tube; W / S lean on the speed
  if (S.pointers.size || Math.abs(S.vel.x) + Math.abs(S.vel.y) > 1e-5) { ride.yaw -= S.vel.x * 1.2; ride.pitch -= S.vel.y * 1.2; S.vel.x = S.vel.y = 0; }
  S.pivot.quaternion.copy(ride.pivotQ);   // the knot itself stays put while you ride
  if (k.any) { const f = (k.fast ? 3 : 1) * k.scale; ride.yaw -= k.turnX * 1.4 * f * dt; ride.pitch += k.turnY * 1.0 * f * dt; ride.around += k.slideX * 1.6 * f * dt; }
  else if (!S.pointers.size) { ride.yaw *= Math.exp(-dt * 1.2); ride.pitch *= Math.exp(-dt * 1.2); }
  ride.yaw = clamp(ride.yaw, -2.6, 2.6); ride.pitch = clamp(ride.pitch, -1.3, 1.3);
  const lean = 1 + (k.any ? k.slideY * 0.8 : 0), lapSec = t.len / (0.55 * st.rideSpeed * Math.max(0.2, lean)) * (2.6 / ext) / 1.3;
  if (!st.paused) {
    let mult = 1; if (tempoLocked() && bpm()) mult = Math.max(1, Math.round(lapSec * bpm() / 60 / cycleBeats(1)));   // whole bars per lap when the music has a beat
    const before = ride.s; ride.s = lapClock.step(ride.s, dt, 1, cycleBeats(mult), 1 / lapSec);
    if (Math.floor(ride.s) > Math.floor(before)) ride.laps++;
  }
  const F = trackAt(t, ride.s), up = F.N.clone().multiplyScalar(Math.cos(ride.around)).add(F.B.clone().multiplyScalar(Math.sin(ride.around))).normalize();
  const r = st.tube, pos = st.seat === 'top' ? F.P.clone().addScaledVector(up, r * 3.4).addScaledVector(F.T, -r * 3.5) : F.P.clone();   // on top: a little above and behind, so you see the track ahead
  // where to look: ahead, turned by yaw and pitch; with "watch" on, drawn toward the nearest other strand ahead
  let dir = F.T.clone().applyAxisAngle(up, ride.yaw); const side = dir.clone().cross(up).normalize(); dir.applyAxisAngle(side, ride.pitch);
  if (st.watch) { const target = nearestStrand(pos, F.T); if (target) { ride.aim.lerp(target.sub(pos).normalize(), Math.min(1, dt * 3)); ride.aimW = Math.min(0.75, ride.aimW + dt * 1.5); } else ride.aimW = Math.max(0, ride.aimW - dt); dir.lerp(ride.aim, ride.aimW).normalize(); }
  // into the scene's world coordinates (the knot sits scaled and turned inside the stage)
  S.fit.updateMatrixWorld(true); const M = S.fit.matrixWorld, wPos = pos.clone().applyMatrix4(M), wDir = dir.clone().transformDirection(M), wUp = up.clone().transformDirection(M);
  S.camera.position.copy(wPos); S.camera.up.copy(wUp); S.camera.lookAt(wPos.clone().add(wDir));
  const fov = st.seat === 'top' ? 70 : 82; if (S.camera.fov !== fov) { S.camera.fov = fov; S.camera.updateProjectionMatrix(); }
  rideLight.position.copy(wPos); rideLight.intensity = st.seat === 'inside' ? 1.4 : 0.5; rideLight.distance = 2.6;
}
// the closest strand that isn't the bit of track you're on, a little ahead of you (for "watch the strands")
function nearestStrand(pos, fwd) {
  let best = null, bd = Infinity; const lim = st.tube * 14;
  rideTrack.forEach((t, ci) => { const n = t.P.length, here = Math.round((((ride.s % 1) + 1) % 1) * n);
    for (let i = 0; i < n; i += 6) { if (ci === ride.comp) { const g = Math.abs(i - here); if (Math.min(g, n - g) < n * 0.06) continue; }
      const q = t.P[i], d = q.distanceTo(pos); if (d < bd && d < lim && q.clone().sub(pos).dot(fwd) > -0.2 * d) { bd = d; best = q; } } });
  return best ? best.clone() : null;
}

// ---------- panel ----------
{ const box = $('shapeLists');
  box.innerHTML = GROUPS.map(([g, label]) => `<div class="shapeGroup"><div class="lbl">${label}</div><div class="seg g2 shapes">${Object.entries(SHAPES).filter(([, s]) => s.group === g).map(([k, s]) => `<button data-s="${k}">${s.name}</button>`).join('')}</div></div>`).join('');
  box.addEventListener('click', e => { const b = e.target.closest('button[data-s]'); if (b) pickShape(b.dataset.s); }); }
function pickShape(k, keepView) {
  if (!SHAPES[k]) return; const wasRiding = ride.on; st.shape = k; ride.comp = 0;
  document.querySelectorAll('#shapeLists button').forEach(b => b.classList.toggle('on', b.dataset.s === k));
  buildParams(); build(); if (wasRiding) { makeTrack(); ride.s = 0; } labels(); share.touch(); if (!keepView) S.vel.x = S.vel.y = 0;
}
function buildParams() {
  const s = sh(), P = st.P[st.shape], box = $('params'); $('paramSec').hidden = !(s.params || []).length;
  box.innerHTML = (s.params || []).map(p => `<div class="row"><span style="width:74px">${p.label}</span><input type="range" id="pp_${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.id]}"><output id="pp_${p.id}o">${P[p.id]}</output></div>`).join('');
  for (const p of s.params || []) $('pp_' + p.id).addEventListener('input', e => { P[p.id] = +e.target.value; $('pp_' + p.id + 'o').textContent = e.target.value; build(); if (ride.on) { makeTrack(); ride.comp = Math.min(ride.comp, rideTrack.length - 1); } labels(); share.touch(); });
}
function labels() {
  const s = sh(), P = st.P[st.shape], loops = s.curves(P).length;
  $('title').textContent = s.name; $('subtitle').textContent = s.alt; $('gv-shapes').textContent = s.name; $('about').innerHTML = `<strong>${s.name}.</strong> ${s.info}`;
  $('rideBtn').textContent = ride.on ? 'Stop riding' : 'Ride the knot'; $('gv-ctl').textContent = ride.on ? 'riding' : '';
  $('hint').textContent = ride.on ? `Arrows or drag: look round · A D: slide round the tube · W S, + −: speed${loops > 1 ? ' · N: next ring' : ''} · G: stop` : 'Drag to turn · scroll / pinch to zoom · G to ride the knot';
  stats();
  const el = $('stageCap'); const cap = ride.on && st.seat === 'top' && st.watch ? '' : ''; el.innerHTML = cap; el.style.display = cap ? 'block' : 'none';
}
function stats() {
  const s = sh(), P = st.P[st.shape], loops = s.curves(P).length;
  if (ride.on) { setStats([String(ride.laps), ride.laps === 1 ? 'lap' : 'laps'], [loops > 1 ? `${ride.comp + 1} of ${loops}` : '1', loops > 1 ? 'riding ring' : 'loop'], [st.rideSpeed.toFixed(1) + '×', 'speed']);
    $('statNote').textContent = loops > 1 ? 'Each ring is a closed loop: ride it forever and you never reach an end. N hops to the next ring.' : 'A knot has no ends: every lap brings you back where you started, having passed over and under the same crossings.'; }
  else { setStats(...s.stats(P)); $('statNote').textContent = ''; }
}
$('rideBtn').addEventListener('click', () => go());
$('resetBtn2').addEventListener('click', () => resetView());
segClick('seat', d => { st.seat = d.s; share.touch(); });
$('watch').addEventListener('change', e => { st.watch = e.target.checked; share.touch(); });
$('rideSpeed').addEventListener('input', e => { st.rideSpeed = +e.target.value; $('rideSpeedo').textContent = st.rideSpeed.toFixed(1) + '×'; share.touch(); });
$('spin').addEventListener('change', e => { st.spin = e.target.checked; share.touch(); });
$('speed').addEventListener('input', e => { st.speed = +e.target.value; $('speedo').textContent = st.speed.toFixed(1) + '×'; share.touch(); });
$('detail').addEventListener('input', e => { st.detail = +e.target.value; $('detailo').textContent = st.detail; build(); share.touch(); });
$('tube').addEventListener('input', e => { st.tube = +e.target.value; $('tubeo').textContent = st.tube.toFixed(3); build(); share.touch(); });
segClick('drawMode', d => { st.draw = d.d; build(); share.touch(); });
segClick('cmode', d => { st.cmode = d.c; recolour(); share.touch(); });
buildSwatches($('palettes'), st.palette, name => { st.palette = name; palLabel(); recolour(); share.touch(); });
const palLabel = () => { $('palName').textContent = 'Palette: ' + st.palette.replace('_', ' & ').replace(/^./, c => c.toUpperCase()) + (st.palRev ? ' (reversed)' : ''); };
$('palRev').addEventListener('change', e => { st.palRev = e.target.checked; palLabel(); recolour(); share.touch(); });
$('cyc').addEventListener('input', e => { st.cycleSpeed = +e.target.value; $('cyco').textContent = st.cycleSpeed ? st.cycleSpeed.toFixed(1) + '×' : 'off'; share.touch(); });
segClick('finish', d => { st.finish = d.f; applyLook(); share.touch(); });
segClick('bg', d => { st.bg = d.b; lightStage(); S.setBackground(st.bg); applyLook(); share.touch(); });
segClick('prSize', d => { st.mm = +d.mm; });
$('snap').addEventListener('click', () => { S.render(); saveCanvasPNG(canvas, fileName(sh().name) + '.png', $('dlnote')); });
document.querySelectorAll('.btn.try').forEach(b => b.addEventListener('click', () => { const [k, act] = b.dataset.try.split('|'); endRide(); pickShape(k); if (act === 'ride') { clickData('#cmode', 'c', 'bands'); startRide(); } }));
buildKeys($('keyTable'), [['G', 'Ride the knot / stop riding'], ['← → ↑ ↓', 'Turn the knot (riding: look round)'], ['W A S D', 'Slide the view (riding: A D slide round the tube, W S speed)'], ['T', 'Watch the other strands as they pass'], ['N', 'Riding a link: hop to the next ring'], ['+ / −', 'Zoom (riding: faster / slower)'], ['1 – 3', 'Knots, links, torus knots'], ['Shift', 'Hold with the keys above to go three times faster']]);

// ---------- actions ----------
function go() { st.paused = false; if (ride.on) endRide(); else startRide(); }
function resetView() { endRide(); S.reset(); st.paused = false; share.touch(); }
function moving() { return ride.on || st.spin || st.cycleSpeed > 0 || MO.moving(); }

// ---------- loop ----------
// Rotation & motion (its own group): turning, rocking, tumbling, the camera's zoom and drift, and Slowly change
const MO = makeMotion3D(S, { spinRow: $('spin').closest('label'), speedRow: $('speed').closest('.row'), rate: () => 0.35, spinOn: () => st.spin, speed: () => st.speed,
  sweep: { skip: ['speed', 'rideSpeed', 'detail'] } });
const REC = addRecorder({ stage: canvas.parentElement, name: () => sh().name, bg: () => st.bg });
// the Visualizer: a new knot, palette or slow change every eight bars; when the chorus comes in, ride the knot until the next change
makeVisualizer(MO, { preset: 'mvt=0.25&mvb=0.35&mvd=0.3', shape: () => (ride.on ? false : pickButton('#shapeLists button')),
  drop: () => { if (!ride.on) startRide(); return () => endRide(); } });
let running = false, tPrev = 0, frame = 0;
function loop(now) {
  if (!running) return; const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now; frame++;
  setPausedTag(st.paused); const goOn = !st.paused;
  if (ride.on) { MO.step(dt, { away: true, go: goOn }); stepRide(dt); }
  else { S.step(dt); MO.step(dt, { go: goOn, spin: !S.pointers.size }); }
  const cs = goOn ? colourStep(dt) : 0; if ((goOn && st.cycleSpeed > 0) || cs) { st.cycle = (st.cycle + (goOn ? dt * st.cycleSpeed * 0.06 : 0) + cs) % 1; recolour(); }
  S.fit.scale.setScalar(2.6 / ext * (ride.on ? 1 : 1 + 0.05 * pulse())); S.setFlash(flash());
  S.fit.rotation.z = ride.on ? 0 : 0.12 * voice();   // vocals and melody sway the knot gently from side to side
  S.render(); if (frame % 15 === 0 && ride.on) stats(); if (frame % 30 === 0) share.touch();
  requestAnimationFrame(loop);
}

// ---------- 3D print ----------
$('prBtn').addEventListener('click', () => {
  const s = sh(), P = st.P[st.shape], note = $('prNote'), mmPerUnit = st.mm / (ext * 1.02); let T = [];
  for (const c of curvePoints(s, P, 360)) T.push(...tubeTriangles(c, Math.max(st.tube, 0.9 / mmPerUnit), 16, true));
  for (let i = 0; i < T.length; i += 3) { const y = T[i + 1], z = T[i + 2]; T[i + 1] = -z; T[i + 2] = y; }   // the explorer's up (y) becomes the printer's up (z)
  const r = stlFromTriangles(T, st.mm, 'Math Explorer knot');
  saveFile(fileName(s.name) + `_${st.mm}mm.stl`, r.bytes, note).then(ok => { if (ok) note.textContent += ` ${r.size.map(v => Math.round(v)).join(' × ')} mm, ${r.tris.toLocaleString()} triangles.`; });
});

// ---------- keys, sharing, lifecycle ----------
export function onKey(e) {
  if (e.key === 't' || e.key === 'T') { setCheck('watch', !st.watch); return true; }
  return standardKeys(e, {
    pause: () => { if (st.paused) st.paused = false; else if (moving()) st.paused = true; else { st.spin = true; $('spin').checked = true; } },
    go, reset: resetView, renew: () => { if (ride.on && rideTrack.length > 1) { ride.comp = (ride.comp + 1) % rideTrack.length; ride.s = 0; stats(); } },
    shape: dir => clickNext('#shapeLists button', dir), palette: dir => clickNext('#palettes button', dir), colourMode: dir => clickNext('#cmode button', dir),
    reverse: () => $('palRev').click(), cycle: () => setRange('cyc', st.cycleSpeed > 0 ? 0 : 1),
    zoom: f => { if (ride.on) setRange('rideSpeed', clamp(st.rideSpeed / f, 0.1, 3)); else S.zoom(f); },
    mode: i => { const g = GROUPS[i]; if (g) pickShape(Object.keys(SHAPES).find(k => SHAPES[k].group === g[0])); },
  });
}
const encode = () => { const p = new URLSearchParams(), P = st.P[st.shape]; p.set('s', st.shape); for (const k in P) p.set(k, r4(P[k]));
  p.set('d', st.detail); if (st.draw !== 'solid') p.set('dr', st.draw); p.set('tu', r4(st.tube)); p.set('cm', st.cmode); p.set('pal', st.palette); if (st.palRev) p.set('rev', 1); if (st.cycleSpeed) p.set('cyc', st.cycleSpeed);
  p.set('fin', st.finish); if (st.bg !== '#0b0d12') p.set('bg', st.bg.slice(1)); if (!st.spin) p.set('sp', 0); if (st.speed !== 0.5) p.set('spd', st.speed);
  if (st.seat !== 'top') p.set('seat', st.seat); if (st.watch) p.set('w', 1); if (st.rideSpeed !== 1) p.set('rs', st.rideSpeed);
  const q = ride.on ? ride.pivotQ : S.pivot.quaternion; p.set('q', [q.x, q.y, q.z, q.w].map(r4).join('_')); if (!ride.on) p.set('z', r4(MO.baseZ())); MO.encode(p); return p.toString(); };
function apply(code) {
  const p = new URLSearchParams(code), k = p.get('s'); if (!SHAPES[k]) return false; endRide();
  for (const q of SHAPES[k].params || []) st.P[k][q.id] = clamp(num(p, q.id, q.def), q.min, q.max);
  setRange('detail', num(p, 'd', 3)); clickData('#drawMode', 'd', p.get('dr') || 'solid'); setRange('tube', num(p, 'tu', 0.07));
  clickData('#cmode', 'c', ['along', 'ring', 'height', 'bands', 'stripe', 'solid'].includes(p.get('cm')) ? p.get('cm') : 'along'); clickData('#palettes', 'pal', p.get('pal') || 'aurora'); setCheck('palRev', p.get('rev') === '1');
  setRange('cyc', num(p, 'cyc', 0)); clickData('#finish', 'f', p.get('fin') || 'satin'); clickData('#bg', 'b', '#' + (p.get('bg') || '0b0d12'));
  setCheck('spin', p.get('sp') !== '0'); setRange('speed', num(p, 'spd', 0.5)); clickData('#seat', 's', p.get('seat') === 'inside' ? 'inside' : 'top'); setCheck('watch', p.get('w') === '1'); setRange('rideSpeed', num(p, 'rs', 1));
  pickShape(k, true);
  const q = (p.get('q') || '').split('_').map(Number); if (q.length === 4 && q.every(isFinite)) S.pivot.quaternion.set(...q).normalize();
  const z = num(p, 'z', 0); if (z > 0) S.camera.position.z = clamp(z, 1.2, 14);
  MO.decode(p);
  return true;
}
const share = makeShare('knot', encode, apply);
// the Paper background: dark stage text (as in Fractals); removed again when you leave this explorer
function lightStage() { document.getElementById('app').classList.toggle('light', st.bg === '#f3efe6'); }
MO.onChange = () => share.touch();
palLabel();
if (!apply(parseRoute().code)) pickShape('trefoil');
export function start() { lightStage(); S.resize(); running = true; tPrev = performance.now(); requestAnimationFrame(loop); share.write(); }
export function stop() { running = false; REC.stop(); document.getElementById('app').classList.remove('light'); }
export const reset = resetView;
export const layoutChanged = () => { S.resize(); if (ride.on) S.camera.fov = 0; };
export const showView = code => apply(code);
export const soundHelp = 'Here, each beat flashes the light brighter (or, with Pulse, gives the knot a little bounce). Tempo times the turning and everything under Rotation & motion, and when the music has a steady beat each lap of a ride takes a whole number of bars, so you come round to the start on the downbeat. Vocals sway the knot gently from side to side, energy sets the pace, and colour drifts the palette.';
