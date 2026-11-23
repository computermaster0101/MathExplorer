// Strange Attractors explorer: chaotic flows traced through time in 3D, and chaotic maps built up as clouds of points in 2D.
// Importing this module boots the explorer; the exports are the lifecycle the shell (js/main.js) drives.
import * as THREE from 'three';
import { $, clamp, segClick, clickNext, setRange, setCheck, clickData, setStats, buildSwatches, rampCss, r4, r8, num, standardKeys, buildKeys, makeShare } from '../../js/common/kit.js';
import { rampOf, sampleRamp, sampleMirror, hexRGB, palTitle } from '../../js/common/palettes.js';
import { makeStage3D } from '../../js/common/three-stage.js';
import { makeView2D } from '../../js/common/view2d.js';
import { saveCanvasPNG, saveFile, fileName } from '../../js/common/save.js';
import { stlFromTriangles, tubeTriangles, heightfieldTriangles } from '../../js/common/stl.js';
import { makeMotion3D, addRecorder } from '../../js/common/motion.js';
import { makeVisualizer, pickButton, randomSlider } from '../../js/common/visualizer.js';
import { flashFx as flash, pulseFx as pulse, voiceFx as voice, colourStep, Groove, energyMul } from '../../js/shell/audio/react.js';
import { setPausedTag } from '../../js/shell/keys.js';
import { parseRoute } from '../../js/shell/route.js';
import { SYSTEMS, rk4, defaults, isBad } from './systems.js';

// ---------- state ----------
const st = { sys: 'lorenz', P: {}, mode: 'path', speed: 1, spin: true, pathLen: 20000, count: 800, trail: 60, expo: 1, cmode: 'speed', palette: 'aurora', palRev: false,
  cycle: 0, cycleSpeed: 0, finish: 'lines', bg: '#0b0d12', paused: false, mm: 80, thick: 1.2, start: null };
for (const k in SYSTEMS) st.P[k] = defaults(SYSTEMS[k]);
const sy = () => SYSTEMS[st.sys], isMap = () => sy().kind === 'map';

// ---------- the 3D stage (flows) and the 2D canvas (maps) ----------
const canvas = $('ac'), mapc = $('mapc'), S = makeStage3D(canvas, { z: 6.2 }), mg = mapc.getContext('2d');
const lineMat = S.addFlash(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92 }));   // lines don't take light: they flash directly
let obj = null;   // the current line object in the fit group
function setObj(o) { if (obj) { S.fit.remove(obj); obj.geometry.dispose(); } obj = o; if (o) S.fit.add(o); }

// ---------- surveying a flow: where it lives, how fast it moves ----------
let surv = null;   // {c, ext, vlo, vhi, ylo, yhi, pts}
function survey() {
  const s = sy(), P = st.P[st.sys]; let p = (st.start || s.start).slice();
  for (let i = 0; i < 3000; i++) { p = rk4(s.f, p, s.dt, P); if (isBad(p)) break; }
  const pts = [], lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], sp = [];
  for (let i = 0; i < 24000 && !isBad(p); i++) { p = rk4(s.f, p, s.dt, P); if (i % 2 === 0) { pts.push(p); for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); } const v = s.f(p[0], p[1], p[2], P); sp.push(Math.hypot(...v)); } }
  sp.sort((a, b) => a - b); const q = f => sp[Math.floor(sp.length * f)] || 0;
  surv = { c: lo.map((l, a) => (l + hi[a]) / 2), ext: Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1, vlo: q(0.05), vhi: q(0.95) || 1, ylo: lo[1], yhi: hi[1], pts, ok: pts.length > 1000 };
  // a system may turn itself so its long side faces the viewer (rot: [x, y, z] angles); the centre turns with it
  if (s.rot === 'pca') S.fit.quaternion.setFromRotationMatrix(facing(pts, surv.c)); else S.fit.rotation.set(...(s.rot || [0, 0, 0]));
  surv.rc = new THREE.Vector3(...surv.c).applyQuaternion(S.fit.quaternion).toArray();
  const sc = 2.6 / surv.ext; S.fit.scale.setScalar(sc); S.fit.position.set(...surv.rc.map(x => -x * sc));
}

// the turn that shows a cloud of points at its widest: its principal directions (eigenvectors of the spread, by Jacobi
// rotations) become left-right, up-down and depth, widest first
function facing(pts, c) {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (const p of pts) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) A[i][j] += (p[i] - c[i]) * (p[j] - c[j]);
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep++) for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) { if (Math.abs(A[p][q]) < 1e-12) continue;
    const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), cs = Math.cos(th), sn = Math.sin(th);
    for (let k = 0; k < 3; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = cs * akp - sn * akq; A[k][q] = sn * akp + cs * akq; }
    for (let k = 0; k < 3; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = cs * apk - sn * aqk; A[q][k] = sn * apk + cs * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = cs * vkp - sn * vkq; V[k][q] = sn * vkp + cs * vkq; } }
  const order = [0, 1, 2].sort((a, b) => A[b][b] - A[a][a]), e = order.map(k => [V[0][k], V[1][k], V[2][k]]);
  const z = [e[0][1] * e[1][2] - e[0][2] * e[1][1], e[0][2] * e[1][0] - e[0][0] * e[1][2], e[0][0] * e[1][1] - e[0][1] * e[1][0]];   // keep it a turn, not a mirror
  return new THREE.Matrix4().set(...e[0], 0, ...e[1], 0, ...z, 0, 0, 0, 0, 1);
}

// ---------- drawing a flow ----------
let R = rampOf('aurora', false), colOff = 0, bgRGB = hexRGB('#0b0d12');
const tone = t => (colOff ? sampleMirror(R, t * 0.5 + colOff) : sampleRamp(R, t));
function colourFor(p, speed, age) {
  const t = st.cmode === 'height' ? (p[1] - surv.ylo) / (surv.yhi - surv.ylo || 1) : st.cmode === 'age' ? age : (speed - surv.vlo) / (surv.vhi - surv.vlo || 1);
  return tone(clamp(t, 0, 1));
}
let F = null;   // the running flow: path / swarm / butterfly buffers
function startFlow() {
  if (!surv || !surv.ok) { setObj(null); F = null; return; }
  const s = sy(), P = st.P[st.sys];
  if (st.mode === 'path') {
    const L = st.pathLen, pos = new Float32Array(L * 3), col = new Float32Array(L * 3), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage)); g.setDrawRange(0, 0);
    setObj(new THREE.Line(g, lineMat)); F = { kind: 'path', L, n: 0, p: surv.pts[0].slice(), pos, col };
  } else if (st.mode === 'swarm') {
    const N = st.count, T = st.trail, tr = new Float32Array(N * T * 3), seg = new Float32Array(N * (T - 1) * 6), col = new Float32Array(N * (T - 1) * 6), g = new THREE.BufferGeometry();
    for (let i = 0; i < N; i++) { const q = surv.pts[Math.floor(Math.random() * surv.pts.length)]; for (let k = 0; k < T; k++) tr.set(q, (i * T + k) * 3); }
    g.setAttribute('position', new THREE.BufferAttribute(seg, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    setObj(new THREE.LineSegments(g, lineMat)); F = { kind: 'swarm', N, T, tr, seg, col };
  } else {
    const L = 1600, g = new THREE.BufferGeometry(), pos = new Float32Array(2 * L * 2 * 3), col = new Float32Array(2 * L * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage)); g.setDrawRange(0, 0);
    const a = surv.pts[Math.floor(surv.pts.length / 3)].slice(), b = [a[0] + 1e-6 * surv.ext, a[1], a[2]];
    setObj(new THREE.LineSegments(g, lineMat)); F = { kind: 'butterfly', L, n: 0, a, b, ha: [], hb: [], t: 0, pos, col };
  }
}
// one frame of a flow: k steps of the rule
function stepFlow(k, Pv) {
  const s = sy(), h = s.dt;
  if (F.kind === 'path') {
    for (let i = 0; i < k; i++) {
      F.p = rk4(s.f, F.p, h, Pv); if (isBad(F.p)) { F.p = surv.pts[0].slice(); continue; }
      if (F.n >= F.L) { F.pos.copyWithin(0, 3); F.col.copyWithin(0, 3); F.n = F.L - 1; }
      const v = s.f(F.p[0], F.p[1], F.p[2], Pv), c = colourFor(F.p, Math.hypot(...v), F.n / F.L); F.pos.set(F.p, F.n * 3); F.col.set(c, F.n * 3); F.n++;
    }
    if (st.cmode === 'age') for (let i = 0; i < F.n; i++) F.col.set(tone(i / F.L), i * 3);
    obj.geometry.setDrawRange(0, F.n);
  } else if (F.kind === 'swarm') {
    const { N, T, tr, seg, col } = F, glow = st.finish === 'glow';
    for (let i = 0; i < N; i++) {
      const o = i * T * 3; tr.copyWithin(o + 3, o, o + (T - 1) * 3);   // shift the trail back by one
      let p = [tr[o], tr[o + 1], tr[o + 2]]; for (let j = 0; j < k; j++) p = rk4(s.f, p, h, Pv);
      if (isBad(p)) p = surv.pts[Math.floor(Math.random() * surv.pts.length)].slice();
      tr[o] = p[0]; tr[o + 1] = p[1]; tr[o + 2] = p[2];
      const v = s.f(p[0], p[1], p[2], Pv), c = colourFor(p, Math.hypot(...v), 0);
      for (let t = 0; t < T - 1; t++) {
        const w = (i * (T - 1) + t) * 6, fade = 1 - t / (T - 1), a = o + t * 3, b = a + 3;
        seg[w] = tr[a]; seg[w + 1] = tr[a + 1]; seg[w + 2] = tr[a + 2]; seg[w + 3] = tr[b]; seg[w + 4] = tr[b + 1]; seg[w + 5] = tr[b + 2];
        const cc = st.cmode === 'age' ? tone(t / (T - 1)) : c;
        for (let e = 0; e < 2; e++) for (let ch = 0; ch < 3; ch++) col[w + e * 3 + ch] = glow ? cc[ch] * fade : bgRGB[ch] + (cc[ch] - bgRGB[ch]) * fade;
      }
    }
  } else {
    for (let i = 0; i < k; i++) { F.a = rk4(s.f, F.a, h, Pv); F.b = rk4(s.f, F.b, h, Pv); F.t += h; F.ha.push(F.a); F.hb.push(F.b); if (F.ha.length > F.L) { F.ha.shift(); F.hb.shift(); } }
    const ca = sampleRamp(R, 0.05), cb = sampleRamp(R, 0.95); let w = 0;
    for (const [H, c] of [[F.ha, ca], [F.hb, cb]]) for (let t = 0; t + 1 < H.length; t++) {
      F.pos.set(H[t], w * 3); F.pos.set(H[t + 1], w * 3 + 3); const fade = 0.25 + 0.75 * t / H.length;
      for (let e = 0; e < 2; e++) for (let ch = 0; ch < 3; ch++) F.col[(w + e) * 3 + ch] = bgRGB[ch] + (c[ch] - bgRGB[ch]) * fade; w += 2; }
    obj.geometry.setDrawRange(0, w);
  }
  obj.geometry.attributes.position.needsUpdate = obj.geometry.attributes.color.needsUpdate = true;
}

// ---------- maps: a cloud of landing places on a 2D canvas ----------
let M = null, viewFromCode = false;   // M: {w, h, cnt, p, n, max}; viewFromCode: a share link set the map view, so keep it
const view = makeView2D(mapc, { onChange: () => resetMap() });
function mapHome() { const b = sy().box, r = mapc.getBoundingClientRect(), asp = r.width / Math.max(1, r.height); view.home = { cx: (b[0] + b[1]) / 2, cy: (b[2] + b[3]) / 2, scale: Math.max((b[3] - b[2]) / 2, (b[1] - b[0]) / 2 / asp) * 1.08 }; }
function resetMap() { const r = mapc.getBoundingClientRect(), d = Math.min(devicePixelRatio, 1.5), w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
  if (mapc.width !== w || mapc.height !== h) { mapc.width = w; mapc.height = h; }
  M = { w, h, cnt: new Float32Array(w * h), p: (sy().start || [0.1, 0.1]).slice(), n: 0, max: 1 }; share.touch(); }
function stepMap(k, Pv) {
  const s = sy(), { w, h, cnt } = M, sc = (h / 2) / view.scale, cx = view.cx, cy = view.cy; let [x, y] = M.p, mx = M.max;
  for (let i = 0; i < k; i++) {
    // maps that keep area (the standard map) have no single attractor: start a fresh point every so often to show them all
    if (s.restart && (M.n + i) % s.restart === 0) { const b = s.box; x = b[0] + Math.random() * (b[1] - b[0]); y = b[2] + Math.random() * (b[3] - b[2]); }
    const q = s.m(x, y, Pv); x = q[0]; y = q[1]; if (!isFinite(x) || Math.abs(x) > 1e6) { const s0 = s.start || [0, 0]; x = s0[0] + Math.random() * 0.2; y = s0[1] + Math.random() * 0.2; continue; }
    const px = Math.floor(w / 2 + (x - cx) * sc), py = Math.floor(h / 2 - (y - cy) * sc); if (px >= 0 && py >= 0 && px < w && py < h) { const c = ++cnt[py * w + px]; if (c > mx) mx = c; } }
  M.p = [x, y]; M.n += k; M.max = mx;
}
// the beat: flash brightens the points (and a faint glow lifts the background, as in Fractals); pulse kicks the exposure
let mapBeat = [0, 0];
function drawMap() {
  const [fl, pu] = mapBeat, k = 1 + 0.35 * fl + 0.3 * pu, gl = 0.05 * fl * 255;
  const { w, h, cnt } = M, img = mg.createImageData(w, h), d = img.data, L = Math.log(1 + M.max), e = st.expo * (1 + 0.6 * pu), bg = bgRGB.map(x => x * 255 + gl), lut = [];
  for (let i = 0; i < 256; i++) lut.push(tone(i / 255).map(x => Math.min(255, x * 255 * k + gl)));
  for (let i = 0; i < w * h; i++) { const c = cnt[i], o = i * 4; if (!c) { d[o] = bg[0]; d[o + 1] = bg[1]; d[o + 2] = bg[2]; d[o + 3] = 255; continue; }
    const t = Math.min(1, Math.pow(Math.log(1 + c) / L, 1 / e)), col = lut[Math.min(255, Math.floor(t * 255))], a = Math.min(1, 0.25 + t);
    d[o] = bg[0] + (col[0] - bg[0]) * a; d[o + 1] = bg[1] + (col[1] - bg[1]) * a; d[o + 2] = bg[2] + (col[2] - bg[2]) * a; d[o + 3] = 255; }
  mg.putImageData(img, 0, 0);
}

// ---------- the chaos rate: how fast two neighbouring starts drift apart (largest Lyapunov exponent) ----------
let LY = null;
function resetLyap() { const s = sy(), p = isMap() ? (s.start || [0.1, 0.1]).slice() : (surv && surv.ok ? surv.pts[0].slice() : s.start.slice()); LY = { p, q: p.map((v, i) => v + (i ? 0 : 1e-8)), sum: 0, n: 0 }; }
function stepLyap(k) {
  const s = sy(), P = st.P[st.sys], d0 = 1e-8;
  for (let i = 0; i < k; i++) {
    if (isMap()) { LY.p = s.m(LY.p[0], LY.p[1], P); LY.q = s.m(LY.q[0], LY.q[1], P); } else { LY.p = rk4(s.f, LY.p, s.dt, P); LY.q = rk4(s.f, LY.q, s.dt, P); }
    const dv = LY.q.map((v, j) => v - LY.p[j]), d = Math.hypot(...dv); if (!isFinite(d) || d === 0) { resetLyap(); return; }
    LY.sum += Math.log(d / d0); LY.n++; LY.q = LY.p.map((v, j) => v + dv[j] * d0 / d);
  }
}
const lyap = () => (LY && LY.n > 300 ? LY.sum / LY.n / (isMap() ? 1 : sy().dt) : null);

// ---------- panel ----------
for (const [id, kind] of [['flowList', 'flow'], ['mapList', 'map']]) $(id).innerHTML = Object.entries(SYSTEMS).filter(([, s]) => s.kind === kind).map(([k, s]) => `<button data-s="${k}">${s.name}</button>`).join('');
document.querySelectorAll('#flowList, #mapList').forEach(el => el.addEventListener('click', e => { const b = e.target.closest('button[data-s]'); if (b) pickSystem(b.dataset.s); }));
function pickSystem(k, keepView) {
  if (!SYSTEMS[k]) return; st.sys = k; st.start = null; if (!keepView) viewFromCode = false;
  document.querySelectorAll('#flowList button, #mapList button').forEach(b => b.classList.toggle('on', b.dataset.s === k));
  const m = isMap(); canvas.hidden = m; mapc.hidden = !m; $('viewSec').hidden = m; $('flowView').hidden = m; $('mapView').hidden = !m; $('spinRow').hidden = m; MO.group.querySelector('#mvTurnSec').hidden = m; MO.group.querySelector('#mvCamSec').hidden = m; for (const id of ['cmode', 'finish']) { const el = $(id); el.hidden = m; const l = el.previousElementSibling; if (l && l.matches('.lbl')) l.hidden = m; }   /* a map is coloured by how often points land, drawn flat */   /* a map is flat and drawn by its own view: turning and the camera don't apply */
  $('hint').textContent = m ? 'Drag to move · scroll / pinch to zoom · arrows and W A S D to move around' : 'Drag to turn · scroll / pinch to zoom · arrows and W A S D to steer';
  view.enabled = m; buildParams(); rebuild(keepView); labels();
}
function rebuild(keepView) {
  if (isMap()) { mapHome(); if (!keepView) view.reset(); else resetMap(); }
  else { survey(); startFlow(); }
  resetLyap(); share.touch();
}
function buildParams() {
  const s = sy(), P = st.P[st.sys];
  $('params').innerHTML = s.params.map(p => `<div class="row"><span style="width:40px">${p.label}</span><input type="range" id="pp_${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.id]}"><output id="pp_${p.id}o">${(+P[p.id]).toFixed(p.step < 0.01 ? 3 : 2)}</output></div>`).join('');
  for (const p of s.params) $('pp_' + p.id).addEventListener('input', e => { P[p.id] = +e.target.value; $('pp_' + p.id + 'o').textContent = (+e.target.value).toFixed(p.step < 0.01 ? 3 : 2); if (e.isTrusted) rebuild(true); else { if (isMap()) resetMap(); resetLyap(); share.touch(); } labels(); });
}
function labels() {
  $('pathLen').closest('.row').hidden = st.mode !== 'path'; $('count').closest('.row').hidden = $('trail').closest('.row').hidden = st.mode !== 'swarm';   // each slider only where it does something (the butterfly effect has none, so its View group goes)
  $('g-view').hidden = !isMap() && st.mode === 'butterfly';
  const s = sy(); $('title').textContent = s.name; $('subtitle').textContent = s.alt; $('gv-shapes').textContent = s.name; $('about').innerHTML = `<strong>${s.name}.</strong> ${s.info}`;
  $('modeNote').textContent = { path: 'One point, followed for a long time: the path traces out the attractor.', swarm: 'Many points at once, each with a fading trail: watch the flow stretch and fold them.', butterfly: 'Two points that start a millionth apart. For a while they move as one, then they part for good.' }[st.mode];
  $('gv-ctl').textContent = isMap() ? 'map' : st.mode;
  const L = isMap() ? ['rarely', 'often'] : { speed: ['slow', 'fast'], height: ['low', 'high'], age: ['old', 'new'] }[st.cmode]; $('lgL').textContent = L[0]; $('lgR').textContent = L[1];
}
function stats() {
  const l = lyap(), s = sy();
  setStats([l == null ? '…' : l.toFixed(isMap() ? 2 : 2), isMap() ? 'chaos rate (per jump)' : 'chaos rate (per second)'], [s.dim, 'dimension'],
    isMap() ? [M ? (M.n / 1e6).toFixed(1) + 'M' : '0', 'points landed'] : [st.mode === 'swarm' ? String(st.count) : st.mode === 'butterfly' ? '2' : (F ? Math.round(F.n / 1000) + 'k' : '0'), st.mode === 'swarm' ? 'particles' : st.mode === 'butterfly' ? 'points' : 'path points']);
  let cap = '';
  if (!isMap() && surv && !surv.ok) cap = '<b>It runs away.</b> With these numbers the point flies off to infinity instead of settling onto a shape. Try nearer the usual numbers.';
  else if (!isMap() && st.mode === 'butterfly' && F) { const d = Math.hypot(...F.a.map((v, i) => v - F.b[i])) / surv.ext;
    cap = d < 1e-3 ? `<b>${F.t.toFixed(1)} s:</b> still together (${d < 1e-5 ? 'less than a hundred-thousandth' : (d * 100).toPrecision(2) + '%'} of the shape apart).` : d < 0.15 ? `<b>${F.t.toFixed(1)} s:</b> drifting apart: now ${(d * 100).toFixed(1)}% of the shape's size apart.` : `<b>${F.t.toFixed(1)} s:</b> they've parted for good. A millionth of a difference at the start, and now nothing in common.`; }
  else if (l != null && l < 0.005 && !(isMap() && sy().restart)) cap = '<b>Not chaotic here.</b> With these numbers the point settles into a loop or a still point: neighbouring starts don\'t drift apart.';
  const el = $('stageCap'); el.innerHTML = cap; el.style.display = cap ? 'block' : 'none';
}
segClick('mode', d => { st.mode = d.m; startFlow(); labels(); share.touch(); });
$('defaultsBtn').addEventListener('click', () => { st.P[st.sys] = defaults(sy()); buildParams(); rebuild(true); labels(); });
$('goBtn').addEventListener('click', () => go());
$('newBtn').addEventListener('click', () => renew());
$('speed').addEventListener('input', e => { st.speed = +e.target.value; $('speedo').textContent = st.speed.toFixed(1) + '×'; share.touch(); });
$('spin').addEventListener('change', e => { st.spin = e.target.checked; share.touch(); });
$('pathLen').addEventListener('input', e => { st.pathLen = +e.target.value; $('pathLeno').textContent = Math.round(st.pathLen / 1000) + 'k'; if (st.mode === 'path') startFlow(); share.touch(); });
$('count').addEventListener('input', e => { st.count = +e.target.value; $('counto').textContent = st.count; if (st.mode === 'swarm') startFlow(); share.touch(); });
$('trail').addEventListener('input', e => { st.trail = +e.target.value; $('trailo').textContent = st.trail; if (st.mode === 'swarm') startFlow(); share.touch(); });
$('expo').addEventListener('input', e => { st.expo = +e.target.value; $('expoo').textContent = st.expo.toFixed(1) + '×'; share.touch(); });
segClick('cmode', d => { st.cmode = d.c; if (F && F.kind === 'path') startFlow(); labels(); share.touch(); });
buildSwatches($('palettes'), st.palette, name => { st.palette = name; recolour(); palLabel(); share.touch(); });
const palLabel = () => { $('palName').textContent = 'Palette: ' + palTitle(st.palette) + (st.palRev ? ' (reversed)' : ''); };
function recolour() { R = rampOf(st.palette, st.palRev); $('lgBar').style.background = rampCss(R); if (F && F.kind === 'path' && !isMap()) { const s = sy(), P = st.P[st.sys]; for (let i = 0; i < F.n; i++) { const p = [F.pos[i * 3], F.pos[i * 3 + 1], F.pos[i * 3 + 2]], v = s.f(p[0], p[1], p[2], P); F.col.set(colourFor(p, Math.hypot(...v), i / F.L), i * 3); } obj.geometry.attributes.color.needsUpdate = true; } }
$('palRev').addEventListener('change', e => { st.palRev = e.target.checked; recolour(); palLabel(); share.touch(); });
$('cyc').addEventListener('input', e => { st.cycleSpeed = +e.target.value; $('cyco').textContent = st.cycleSpeed ? st.cycleSpeed.toFixed(1) + '×' : 'off'; share.touch(); });
segClick('finish', d => { st.finish = d.f; const g = st.finish === 'glow'; lineMat.blending = g ? THREE.AdditiveBlending : THREE.NormalBlending; lineMat.depthWrite = !g; lineMat.opacity = g ? 0.7 : 0.92; lineMat.needsUpdate = true; share.touch(); });
segClick('bg', d => { st.bg = d.b; lightStage(); bgRGB = hexRGB(st.bg); S.setBackground(st.bg); recolour(); share.touch(); });
segClick('prSize', d => { st.mm = +d.mm; });
$('prThick').addEventListener('input', e => { st.thick = +e.target.value; $('prThicko').textContent = st.thick.toFixed(1) + ' mm'; });
$('snap').addEventListener('click', () => { if (isMap()) saveCanvasPNG(mapc, fileName(sy().name) + '.png', $('dlnote')); else { S.render(); saveCanvasPNG(canvas, fileName(sy().name) + '.png', $('dlnote')); } });
document.querySelectorAll('.btn.try').forEach(b => b.addEventListener('click', () => { const [k, m] = b.dataset.try.split('|'); if (m && m !== 'map') clickData('#mode', 'm', m); pickSystem(k); }));
buildKeys($('keyTable'), [['G', 'Start drawing again'], ['N', 'A new starting point'], ['1 – 3', 'Path, swarm, butterfly effect'], ['← → ↑ ↓', 'Turn the shape (maps: move around)'], ['W A S D', 'Slide the view (maps: move around)'], ['Shift', 'Hold with the keys above to go three times faster']]);

// ---------- actions ----------
function go() { st.paused = false; if (isMap()) resetMap(); else startFlow(); resetLyap(); }
function renew() { st.paused = false; if (isMap()) { resetMap(); const s0 = sy().start || [0, 0]; M.p = [s0[0] + Math.random() * 0.4 - 0.2, s0[1] + Math.random() * 0.4 - 0.2]; return; }
  const q = surv && surv.ok ? surv.pts[Math.floor(Math.random() * surv.pts.length)] : sy().start; st.start = q.map(v => v + (Math.random() - 0.5) * 0.01 * (surv ? surv.ext : 1)); survey(); startFlow(); resetLyap(); }
function resetView() { st.paused = false; if (isMap()) view.reset(); else S.reset(); share.touch(); }

// Some flows creep round their attractor far slower than Lorenz (measured: distance moved per step over the attractor's
// size, Lorenz = 1: Four-wing 0.07, Newton–Leipnik 0.09, Sprott B 0.15, Dadras and Sprott A 0.22, Rucklidge 0.34,
// Rabinovich–Fabrikant 0.37, Arneodo 0.38). They take more steps a frame, so every flow shows its shape in about the same time.
const PACE = { fourwing: 8, leipnik: 8, sprottB: 6, dadras: 4, sprottA: 4, rucklidge: 3, rabinovich: 2.5, arneodo: 2.5 };

// ---------- loop ----------
// Rotation & motion (its own group): turning, rocking, tumbling, the camera's zoom and drift, and Slowly change, which
// sweeps one of the rule's numbers while the points keep moving, so the attractor morphs (maps: only Slowly change)
const MO = makeMotion3D(S, { spinRow: $('spinRow'), rate: () => 0.175, spinOn: () => st.spin, sweep: { skip: ['speed', 'pathLen', 'count'] } });
const REC = addRecorder({ stage: canvas.parentElement, name: () => sy().name, bg: () => st.bg });
// the Visualizer: a new flow, palette or slowly changing rule every eight bars; when the chorus comes in, a swarm of
// points takes over from the single path until the next change
makeVisualizer(MO, { preset: 'mvt=0.2&mvb=0.3&mvd=0.25', shape: () => pickButton('#flowList button'),
  drop: () => { if (isMap()) pickButton('#flowList button'); const was = st.mode; clickData('#mode', 'm', 'swarm'); return () => clickData('#mode', 'm', was === 'swarm' ? 'path' : was); } });
let running = false, tPrev = 0, frame = 0;
function loop(now) {
  if (!running) return; const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now; frame++;
  setPausedTag(st.paused); const go = !st.paused, s = sy(), P = st.P[st.sys];
  // the music: vocals sway the first number a little (only for the moving point, not the survey); energy sets the pace
  const vo = voice(), Pv = vo && s.params.length ? { ...P, [s.params[0].id]: P[s.params[0].id] * (1 + 0.025 * vo) } : P, pace = st.speed * energyMul();
  const cs = go ? colourStep(dt) : 0; if ((go && st.cycleSpeed > 0) || cs) { colOff = (colOff + (go ? dt * st.cycleSpeed * 0.06 : 0) + cs) % 1; if (isMap() || (F && F.kind === 'path' && frame % 6 === 0)) recolourPathCheap(); }
  if (isMap()) {
    view.step(dt); if (go) MO.sweep.step(dt, true);
    if (go && M) stepMap(Math.round(120000 * pace), Pv);
    const beatNow = [flash(), pulse()], beatMoved = Math.abs(beatNow[0] - mapBeat[0]) + Math.abs(beatNow[1] - mapBeat[1]) > 0.004; mapBeat = beatNow;
    if (M && (go || frame % 10 === 0 || beatMoved)) drawMap();
    if (go) stepLyap(200);
  } else {
    S.step(dt); MO.step(dt, { go, spin: !S.pointers.size });
    if (go && F) stepFlow(Math.max(1, Math.round((st.mode === 'swarm' ? 2 : st.mode === 'butterfly' ? 4 : 6) * pace * (PACE[st.sys] || 1))), Pv);
    if (go) stepLyap(120);
    S.fit.scale.setScalar(2.6 / (surv ? surv.ext : 1) * (1 + 0.05 * pulse())); if (surv) S.fit.position.set(...surv.rc.map(x => -x * S.fit.scale.x));
    S.setFlash(flash()); S.render();
  }
  if (frame % 15 === 0) stats();
  if (frame % 30 === 0) share.touch();   // keep the link up to date as the view is turned
  requestAnimationFrame(loop);
}
function recolourPathCheap() { if (F && F.kind === 'path' && st.cmode !== 'age') return; if (F && F.kind === 'path') { for (let i = 0; i < F.n; i++) F.col.set(tone(i / F.L), i * 3); obj.geometry.attributes.color.needsUpdate = true; } }

// ---------- 3D print ----------
$('prBtn').addEventListener('click', () => {
  const note = $('prNote'), s = sy(); let T;
  if (isMap()) { if (!M) return; const w = 180, h = Math.max(20, Math.round(180 * M.h / M.w)), H = new Float32Array(w * h), L = Math.log(1 + M.max);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let mx = 0; const x0 = Math.floor(i * M.w / w), x1 = Math.floor((i + 1) * M.w / w), y0 = Math.floor(j * M.h / h), y1 = Math.floor((j + 1) * M.h / h);
      for (let y = y0; y < Math.max(y1, y0 + 1); y++) for (let x = x0; x < Math.max(x1, x0 + 1); x++) mx = Math.max(mx, M.cnt[y * M.w + x]); H[j * w + i] = mx ? Math.pow(Math.log(1 + mx) / L, 1 / st.expo) : 0; }
    T = heightfieldTriangles(H, w, h, st.mm, 2, 3);
  } else { if (!surv || !surv.ok) return; const pts = surv.pts.filter((_, i) => i % 4 === 0).slice(0, 3000), r = (st.thick / 2) / (st.mm / surv.ext);
    T = tubeTriangles(pts, r, 10, false); for (let i = 0; i < T.length; i += 3) { const y = T[i + 1], z = T[i + 2]; T[i + 1] = -z; T[i + 2] = y; } }
  const res = stlFromTriangles(T, st.mm, 'Math Explorer attractor');
  saveFile(fileName(s.name) + `_${st.mm}mm.stl`, res.bytes, note).then(ok => { if (ok) note.textContent += ` ${res.size.map(v => Math.round(v)).join(' × ')} mm, ${res.tris.toLocaleString()} triangles.`; });
});

// ---------- keys, sharing, lifecycle ----------
export function onKey(e) {
  return standardKeys(e, {
    pause: () => { st.paused = !st.paused; }, go, renew, reset: resetView,
    shape: dir => clickNext('#flowList button, #mapList button', dir), palette: dir => clickNext('#palettes button', dir), colourMode: dir => clickNext('#cmode button', dir),
    reverse: () => $('palRev').click(), cycle: () => setRange('cyc', st.cycleSpeed > 0 ? 0 : 1),
    zoom: f => (isMap() ? view.zoomAt(f) : S.zoom(f)), mode: i => { if (!isMap()) clickData('#mode', 'm', ['path', 'swarm', 'butterfly'][i]); },
  });
}
const encode = () => { const p = new URLSearchParams(), P = st.P[st.sys]; p.set('s', st.sys); for (const k in P) p.set(k, r4(P[k]));
  if (!isMap()) { p.set('m', st.mode); if (st.mode === 'path') p.set('pl', st.pathLen); if (st.mode === 'swarm') { p.set('n', st.count); p.set('tr', st.trail); } if (!st.spin) p.set('sp', 0); const q = S.pivot.quaternion; p.set('q', [q.x, q.y, q.z, q.w].map(r4).join('_')); p.set('z', r4(MO.baseZ())); }
  else { p.set('v', [view.cx, view.cy, view.scale].map(r8).join('_')); if (st.expo !== 1) p.set('ex', st.expo); }
  if (st.speed !== 1) p.set('spd', st.speed); p.set('cm', st.cmode); p.set('pal', st.palette); if (st.palRev) p.set('rev', 1); if (st.cycleSpeed) p.set('cyc', st.cycleSpeed); if (st.finish !== 'lines') p.set('fin', st.finish); if (st.bg !== '#0b0d12') p.set('bg', st.bg.slice(1));
  MO.encode(p); return p.toString(); };
function apply(code) {
  const p = new URLSearchParams(code), k = p.get('s'); if (!SYSTEMS[k]) return false;
  for (const q of SYSTEMS[k].params) st.P[k][q.id] = clamp(num(p, q.id, q.def), q.min, q.max);
  clickData('#mode', 'm', p.get('m') || 'path'); setRange('pathLen', num(p, 'pl', 20000)); setRange('count', num(p, 'n', 800)); setRange('trail', num(p, 'tr', 60)); setCheck('spin', p.get('sp') !== '0');
  setRange('expo', num(p, 'ex', 1)); setRange('speed', num(p, 'spd', 1)); clickData('#cmode', 'c', p.get('cm') || 'speed'); clickData('#palettes', 'pal', p.get('pal') || 'aurora'); setCheck('palRev', p.get('rev') === '1');
  setRange('cyc', num(p, 'cyc', 0)); clickData('#finish', 'f', p.get('fin') || 'lines'); clickData('#bg', 'b', '#' + (p.get('bg') || '0b0d12'));
  pickSystem(k, true);
  const q = (p.get('q') || '').split('_').map(Number); if (q.length === 4 && q.every(isFinite)) S.pivot.quaternion.set(...q).normalize();
  const z = num(p, 'z', 0); if (z > 0) S.camera.position.z = clamp(z, 1.2, 14);
  const v = (p.get('v') || '').split('_').map(Number); if (isMap() && v.length === 3 && v.every(isFinite) && v[2] > 0){ view.set(v[0], v[1], v[2]); viewFromCode = true; }
  MO.decode(p);
  return true;
}
const share = makeShare('attractor', encode, apply);
// the Paper background: dark stage text (as in Fractals); removed again when you leave this explorer
function lightStage() { document.getElementById('app').classList.toggle('light', st.bg === '#f3efe6'); }
MO.onChange = () => share.touch();
palLabel(); recolour();
if (!apply(parseRoute().code)) pickSystem('lorenz');
// the canvas has its real size by now, so the map's home view can be worked out properly
export function start() { lightStage(); S.resize(); if (isMap()) { mapHome(); if (viewFromCode) resetMap(); else view.reset(); } running = true; tPrev = performance.now(); requestAnimationFrame(loop); share.write(); }
export function stop() { running = false; REC.stop(); document.getElementById('app').classList.remove('light'); }
export const reset = resetView;
export const going = () => true;   /* G restarts the path, so a tap just pauses */
export const layoutChanged = () => { S.resize(); if (isMap()) { mapHome(); resetMap(); } };   // a new window size: build the picture up again
export const showView = code => apply(code);
export const soundHelp = 'Here, each beat flashes the picture brighter (or, with Pulse, gives the shape a bounce; a map\'s points glow brighter instead). Energy sets how fast the points move, tempo times the turning and everything under Rotation & motion (Slowly change morphs the rule in time with the bars), vocals nudge the rule\'s first number very slightly, and colour drifts the palette.';
