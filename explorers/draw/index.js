// Drawing Machines explorer: epicycles (any drawing from spinning circles), the spirograph, the harmonograph, Lissajous figures,
// times tables on a circle and roses, each drawn by its machine as you watch.
// Importing this module boots the explorer; the exports are the lifecycle the shell (js/main.js) drives.
import { $, clamp, segClick, clickNext, setRange, setCheck, clickData, setStats, buildSwatches, rampCss, r4, num, standardKeys, buildKeys, makeShare } from '../../js/common/kit.js';
import { rampOf, sampleRamp, css, palTitle } from '../../js/common/palettes.js';
import { makeView2D } from '../../js/common/view2d.js';
import { saveCanvasPNG, saveFile, fileName } from '../../js/common/save.js';
import { stlFromTriangles, heightfieldTriangles } from '../../js/common/stl.js';
import { LOOP, loopRate, colourPart, TAU as LTAU } from '../../js/common/seamless.js';
import { makeMotion2D, addRecorder } from '../../js/common/motion.js';
import { makeVisualizer, pickButton } from '../../js/common/visualizer.js';
import { flashFx as flash, pulseFx as pulse, voiceFx as voice, colourStep, Groove } from '../../js/shell/audio/react.js';
import { setPausedTag } from '../../js/shell/keys.js';
import { parseRoute } from '../../js/shell/route.js';
import { DRAWINGS, GROUPS, defaults, epicycles, resample } from './machines.js';

// ---------- state ----------
const st = { d: 'e_heart', P: {}, speed: 1, machine: true, loop: true, target: false, build: false, keep: true, slide: false, lw: 1.4, glow: false,
  cmode: 'along', palette: 'aurora', palRev: false, cycle: 0, cycleSpeed: 0, bg: '#0b0d12', paused: false, mm: 80, own: null, ownN: 60 };
for (const k in DRAWINGS) st.P[k] = defaults(DRAWINGS[k]);
const OWN = { group: 'epi', name: 'Your drawing', alt: 'drawn by spinning circles', key: 'own', info: 'Your own drawing, rebuilt from spinning circles: a Fourier series, worked out from the points you drew.', params: [{ id: 'n', label: 'Circles', min: 1, max: 200, step: 1, def: 60 }] };
st.P.own = { n: 60 };
const dr = () => (st.d === 'own' && st.own ? OWN : DRAWINGS[st.d] || DRAWINGS.e_heart);

// ---------- the canvas and the view ----------
const cv = $('dc'), g = cv.getContext('2d');
const view = makeView2D(cv, { home: { cx: 0, cy: 0, scale: 1.25 }, min: 0.05, max: 40, wrap: false, onChange: () => share.touch() });
let W = 0, H = 0, dpr = 1;
function resize() { const r = cv.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr)); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } }
const ink = a => (st.bg === '#f3efe6' ? `rgba(28,30,38,${a})` : `rgba(255,255,255,${a})`);

// ---------- the machine for the current drawing, and its path ----------
let M = null, path = null, clk = { draw: new Groove() }, prog = 0, hold = 0, lapK = 0, slideM = 0;
// with the circles added one by one, each stage's finished drawing stays on, fainter, under the next (issue #36: to see every
// stage at once, how each new circle pulls the curve closer); cleared whenever the drawing starts over
let ghosts = [];
const BUILD = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 200];
function machine() {
  const d = dr(), P = st.P[d.key];
  if (d.key === 'own') return epicycles(st.own, P.n);
  if (d.group === 'times') return d.make({ ...P, m: st.slide ? slideM : P.m });
  return d.make(P);
}
function rebuild(restart = true, keepGhosts = false) {
  const d = dr(); M = machine(); if (!keepGhosts) ghosts = [];
  if (st.build && d.group === 'epi') M = epicycles(M.target, Math.min(st.P[d.key].n, BUILD[lapK] || st.P[d.key].n));   // the circles joining one by one
  if (M.kind === 'pen') { const n = M.samples || 1200, pts = new Float32Array((n + 1) * 2); for (let i = 0; i <= n; i++) { const p = M.pos(M.T * i / n); pts[i * 2] = p[0]; pts[i * 2 + 1] = p[1]; } path = { pts, n }; }
  else path = null;
  if (restart) { prog = 0; hold = 0; }
  labels();
}
const duration = () => (M.kind === 'lines' ? 4 : clamp(5 + 1.6 * (M.laps || 1), 5, 22)) / st.speed;   // seconds to draw it once

// ---------- drawing ----------
function frame() {
  const R = rampOf(st.palette, st.palRev), fl = flash(), bright = c => c.map(v => Math.min(1, v * (1 + 0.35 * fl) + 0.05 * fl));
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = st.bg; g.fillRect(0, 0, W, H);
  if (fl > 0.02) { g.fillStyle = `rgba(255,255,255,${0.05 * fl})`; g.fillRect(0, 0, W, H); }
  // world → canvas: the view's centre, scale (as drawn, with the music's pulse) and turn
  const s = (H / 2) / view.eff(), cr = Math.cos(-view.rot), sr = Math.sin(-view.rot);
  g.setTransform(s * cr * 1, -s * sr, -s * sr, -s * cr, W / 2 - s * (cr * view.cx - sr * view.cy), H / 2 + s * (sr * view.cx + cr * view.cy));
  const px = 1 / s;   // one canvas pixel in world units
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (st.glow) { g.shadowBlur = 10 * dpr; g.shadowColor = css(bright(sampleRamp(R, 0.6))); } else g.shadowBlur = 0;
  const tone = t => css(bright(sampleRamp(R, ((st.cmode === 'solid' ? 0.62 : 0.06 + 0.88 * t) + st.cycle) % 1)));
  if (M.kind === 'lines') drawTimes(R, tone, px);
  else drawPen(tone, px);
  g.shadowBlur = 0;
  if (drawing) { g.strokeStyle = ink(0.9); g.lineWidth = 2 * px * dpr; g.beginPath(); drawing.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
}
function drawPen(tone, px) {
  const { pts, n } = path, upto = Math.min(n, Math.floor(clamp(prog, 0, 1) * n)), laps = M.laps || 1;
  if (st.target && M.target) { g.strokeStyle = ink(0.18); g.lineWidth = 1.2 * px * dpr; g.beginPath(); M.target.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke(); }
  // the earlier stages (circles one by one), each in its own colour from the palette, thinner and fainter
  if (ghosts.length) { const last = Math.max(1, BUILD.filter(b => b <= st.P[dr().key].n).length - 1); g.lineWidth = Math.max(0.6, st.lw * 0.6) * px * dpr; g.globalAlpha = 0.45;
    for (const G of ghosts) { g.strokeStyle = tone(G.k / last); g.beginPath(); g.moveTo(G.pts[0], G.pts[1]); for (let i = 1; i <= G.n; i++) g.lineTo(G.pts[i * 2], G.pts[i * 2 + 1]); g.stroke(); }
    g.globalAlpha = 1; }
  // the line so far, in batches of one colour each (a separate stroke per tiny piece would be slow)
  const B = Math.max(1, Math.ceil(n / 240)), fade = st.loop && !st.build && hold > 1.6 ? Math.max(0, 1 - (hold - 1.6) / 0.8) : 1;   /* fades only on its way to drawing again; otherwise the finished drawing stays */
  g.lineWidth = st.lw * px * dpr * (1 + 0.15 * Math.max(0, voice()));
  g.globalAlpha = fade;
  for (let a = 0; a < upto; a += B) { const b = Math.min(upto, a + B), t = st.cmode === 'laps' ? Math.floor(a / n * laps) / Math.max(1, laps - 1) : a / n;
    g.strokeStyle = tone(laps > 1 || st.cmode !== 'laps' ? t : 0.5); g.beginPath(); g.moveTo(pts[a * 2], pts[a * 2 + 1]); for (let i = a + 1; i <= b; i++) g.lineTo(pts[i * 2], pts[i * 2 + 1]); g.stroke(); }
  g.globalAlpha = 1;
  // the machine itself, and the pen
  const t = M.T * clamp(prog, 0, 1);
  if (st.machine && prog < 1 && M.parts) for (const q of M.parts(t)) {
    if (q.circle) { if (q.circle[2] / px < 0.8) continue; g.strokeStyle = ink(q.ring ? 0.3 : 0.16); g.lineWidth = px * dpr; g.beginPath(); g.arc(q.circle[0], q.circle[1], q.circle[2], 0, 2 * Math.PI); g.stroke(); }
    if (q.arm) { g.strokeStyle = ink(0.5); g.lineWidth = px * dpr; g.beginPath(); g.moveTo(q.arm[0], q.arm[1]); g.lineTo(q.arm[2], q.arm[3]); g.stroke(); }
    if (q.guide) { g.strokeStyle = ink(0.14); g.lineWidth = px * dpr; g.setLineDash([4 * px * dpr, 4 * px * dpr]); g.beginPath(); g.moveTo(q.guide[0], q.guide[1]); g.lineTo(q.guide[2], q.guide[3]); g.stroke(); g.setLineDash([]); }
    if (q.bob) { g.fillStyle = ink(0.7); g.beginPath(); g.arc(q.bob[0], q.bob[1], 4 * px * dpr, 0, 2 * Math.PI); g.fill(); }
  }
  if (prog < 1) { const p = M.pos(t); g.fillStyle = ink(1); g.beginPath(); g.arc(p[0], p[1], 3.2 * px * dpr, 0, 2 * Math.PI); g.fill(); }
}
function drawTimes(R, tone, px) {
  const N = M.N, m = M.m, shown = Math.min(N, Math.floor(clamp(prog, 0, 1) * N + (st.slide ? N : 0))), at = k => { const a = Math.PI / 2 - 2 * Math.PI * k / N; return [Math.cos(a), Math.sin(a)]; };
  g.strokeStyle = ink(0.16); g.lineWidth = px * dpr; g.beginPath(); g.arc(0, 0, 1, 0, 2 * Math.PI); g.stroke();
  g.lineWidth = st.lw * 0.6 * px * dpr; g.globalAlpha = 0.85;
  const B = Math.max(1, Math.ceil(N / 60));
  for (let a = 0; a < shown; a += B) { g.strokeStyle = tone(a / N); g.beginPath(); for (let k = a; k < Math.min(shown, a + B); k++) { const p = at(k), q = at(k * m); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); } g.stroke(); }
  g.globalAlpha = 1;
  if (st.machine && N <= 400) { g.fillStyle = ink(0.55); for (let k = 0; k < N; k += 1) { const p = at(k); g.fillRect(p[0] - px * dpr, p[1] - px * dpr, 2 * px * dpr, 2 * px * dpr); } }
}

// ---------- drawing your own (for the epicycles) ----------
let drawing = null, ownMode = false;
const worldAt = e => view.toWorld(e.clientX, e.clientY);
function setOwnMode(on) { ownMode = on; view.enabled = !on; cv.classList.toggle('drawing', on); cv.toggleAttribute('data-own-taps', on); const b = $('ownBtn'); if (b) { b.textContent = on ? 'Cancel drawing' : '✎ Draw your own'; b.classList.toggle('on', on); } $('ownNote').hidden = !on; if (on) $('g-shapes').open = true; }
cv.addEventListener('pointerdown', e => { if (!ownMode) return; cv.setPointerCapture(e.pointerId); drawing = [worldAt(e)]; });
cv.addEventListener('pointermove', e => { if (ownMode && drawing) drawing.push(worldAt(e)); });
cv.addEventListener('pointerup', () => { if (!ownMode || !drawing) return; const d = drawing; drawing = null;
  if (d.length > 12) { st.own = resample(d, 512); st.d = 'own'; setOwnMode(false); buildLists(); pickDrawing('own'); } });

// ---------- panel ----------
function buildLists() {
  $('shapeLists').innerHTML = GROUPS.map(([gk, label]) => `<div class="shapeGroup"><div class="lbl">${label}</div><div class="seg g2 shapes">${Object.values(DRAWINGS).filter(d => d.group === gk).map(d => `<button data-s="${d.key}">${d.name}</button>`).join('')}${gk === 'epi' && st.own ? '<button data-s="own">Your drawing</button>' : ''}${gk === 'epi' ? '<button id="ownBtn">✎ Draw your own</button>' : ''}</div></div>`).join('');
  markList(); if (ownMode) setOwnMode(true);
}
const markList = () => document.querySelectorAll('#shapeLists button[data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === st.d));
$('shapeLists').addEventListener('click', e => { if (e.target.closest('#ownBtn')) { setOwnMode(!ownMode); return; } const b = e.target.closest('button[data-s]'); if (b) pickDrawing(b.dataset.s); });
function pickDrawing(k, keep) {
  if (k !== 'own' && !DRAWINGS[k]) return; if (k === 'own' && !st.own) return; st.d = k; lapK = 0; if (ownMode) setOwnMode(false);   /* picking a drawing leaves drawing-your-own */
  const d = dr(); if (d.group === 'times') slideM = st.P[d.key].m;
  markList(); buildParams(); rebuild(); share.touch(); if (!keep) view.reset();
}
function buildParams() {
  const d = dr(), P = st.P[d.key], box = $('params'); $('paramSec').hidden = !d.params.length;
  const fmt = (p, v) => (p.id === 'out' ? (+v ? 'yes' : 'no') : p.step < 1 ? (+v).toFixed(p.step < 0.01 ? 4 : 2) : String(v));
  box.innerHTML = d.params.map(p => `<div class="row"><span style="width:84px">${p.label}</span><input type="range" id="pp_${p.id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.id]}"><output id="pp_${p.id}o">${fmt(p, P[p.id])}</output></div>`).join('');
  for (const p of d.params) $('pp_' + p.id).addEventListener('input', e => { P[p.id] = +e.target.value; $('pp_' + p.id + 'o').textContent = fmt(p, P[p.id]); if (p.id === 'm') slideM = P.m;
    // a live change keeps drawing from where it is (the Visualizer and Slowly change morph it); a new choice starts again
    rebuild(!e.isTrusted ? false : true); share.touch(); });
}
function labels() {
  const d = dr(), epi = d.group === 'epi', times = d.group === 'times';
  $('title').textContent = d.name; $('subtitle').textContent = d.alt; $('gv-shapes').textContent = d.name; $('about').innerHTML = `<strong>${d.name}.</strong> ${d.info}`;
  $('targetRow').hidden = !epi; $('buildRow').hidden = !epi; $('keepRow').hidden = !epi || !st.build; $('slideRow').hidden = !times; $('loop').closest('label').hidden = false;
  $('gv-ctl').textContent = ownMode ? 'drawing' : st.paused ? 'paused' : '';
  $('hint').textContent = ownMode ? 'Draw one closed shape · it will be rebuilt from circles' : 'Drag to move · scroll / pinch to zoom · G draws it again';
  const lg = st.cmode === 'along' ? ['start', 'end'] : st.cmode === 'laps' ? ['first lap', 'last lap'] : ['', ''];
  $('lgL').textContent = lg[0]; $('lgR').textContent = lg[1]; $('legend').style.visibility = lg[0] && !(st.cmode === 'laps' && (M && (M.laps || 1) < 2)) ? '' : 'hidden';
  $('cmodeNote').textContent = { along: 'The line changes colour from start to finish, so you can see the order it was drawn in.', laps: 'Each lap of the machine in its own colour.', solid: 'One colour.' }[st.cmode];
  stats();
}
function stats() {
  const d = dr(); if (!M) return; let note = '';
  if (M.kind === 'lines') { setStats([String(M.N), 'points'], ['× ' + (+M.m).toFixed(2), 'multiplier'], [String(M.N), 'threads']); note = Math.abs(M.m - Math.round(M.m)) < 0.005 ? `Times ${Math.round(M.m)}: a curve with ${Math.round(M.m) - 1} lobe${Math.round(M.m) - 1 === 1 ? '' : 's'} (an epicycloid), outlined by straight threads.` : 'Between whole numbers the threads tangle; at whole numbers they snap into an epicycloid.'; }
  else if (d.group === 'epi') { const tot = M.C.reduce((a, c) => a + c.r * c.r, 0) || 1, got = M.C.slice(0, M.n).reduce((a, c) => a + c.r * c.r, 0); setStats([String(M.n), 'circles'], [Math.round(100 * got / tot) + '%', 'of the drawing'], [String(M.C.length), 'circles in all']); note = 'The biggest circles carry most of the shape; the small fast ones add the detail. "Of the drawing" is how much of its total size (energy) the circles used so far capture.'; }
  else if (d.group === 'spiro') { const P = st.P[d.key], gg = gcdJS(P.R, P.r); setStats([String(M.laps), M.laps === 1 ? 'lap' : 'laps'], [String(P.R / gg), 'petals'], [String(gg), 'shared factor']); note = `${P.R} and ${P.r} teeth share the factor ${gg}: the wheel goes round ${P.r} ÷ ${gg} = ${M.laps} time${M.laps > 1 ? 's' : ''}, and the pattern repeats ${P.R} ÷ ${gg} = ${P.R / gg} times round the ring.`; }
  else if (d.group === 'harmono') { const P = st.P[d.key]; setStats([`${P.fx} : ${P.fy}`, 'ratio'], [(P.detune * 100).toFixed(2) + '%', 'out of tune'], [Math.round(Math.log(40) / P.damp) + '', 'swings to die away']); note = intervalName(P.fx, P.fy); }
  else if (d.group === 'liss') { const P = st.P[d.key], gg = gcdJS(P.a, P.b); setStats([`${P.a / gg} : ${P.b / gg}`, 'ratio'], [String(P.a / gg), 'loops across'], [String(P.b / gg), 'loops up & down']); note = intervalName(P.a, P.b); }
  else { const P = st.P[d.key], gg = gcdJS(P.n, P.d), n = P.n / gg, dd = P.d / gg; setStats([`${n} / ${dd}`, 'n / d'], [dd === 1 ? String(n % 2 ? n : 2 * n) : '–', 'petals'], [String(M.laps), M.laps === 1 ? 'turn' : 'turns']); }
  $('statNote').textContent = note;
}
const gcdJS = (a, b) => { a = Math.round(a); b = Math.round(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const intervalName = (a, b) => { const gg = gcdJS(a, b), x = Math.max(a, b) / gg, y = Math.min(a, b) / gg, k = x + ':' + y;
  const NAMES = { '1:1': 'unison', '2:1': 'an octave', '3:2': 'a perfect fifth', '4:3': 'a perfect fourth', '5:4': 'a major third', '6:5': 'a minor third', '5:3': 'a major sixth', '8:5': 'a minor sixth', '3:1': 'an octave and a fifth', '4:1': 'two octaves', '9:8': 'a whole tone', '7:4': 'a "harmonic" seventh' };
  return NAMES[k] ? `${x} : ${y} is ${NAMES[k]} in music: two notes whose pitches are in this ratio sound together like this picture's two swings.` : `${x} : ${y}: as notes, a rough interval; the picture is as busy as the sound.`; };
$('goBtn').addEventListener('click', () => go());
$('speed').addEventListener('input', e => { st.speed = +e.target.value; $('speedo').textContent = st.speed.toFixed(1) + '×'; share.touch(); });
$('machine').addEventListener('change', e => { st.machine = e.target.checked; share.touch(); });
$('loop').addEventListener('change', e => { st.loop = e.target.checked; share.touch(); });
$('target').addEventListener('change', e => { st.target = e.target.checked; share.touch(); });
$('build').addEventListener('change', e => { st.build = e.target.checked; lapK = 0; rebuild(); share.touch(); });
$('keep').addEventListener('change', e => { st.keep = e.target.checked; if (!st.keep) ghosts = []; share.touch(); });
$('slide').addEventListener('change', e => { st.slide = e.target.checked; slideM = st.P[dr().key].m || 2; rebuild(); share.touch(); });
$('lw').addEventListener('input', e => { st.lw = +e.target.value; $('lwo').textContent = st.lw.toFixed(2); share.touch(); });
$('glow').addEventListener('change', e => { st.glow = e.target.checked; share.touch(); });
segClick('cmode', d => { st.cmode = d.c; labels(); share.touch(); });
buildSwatches($('palettes'), st.palette, name => { st.palette = name; palLabel(); share.touch(); });
const palLabel = () => { $('palName').textContent = 'Palette: ' + palTitle(st.palette) + (st.palRev ? ' (reversed)' : ''); $('lgBar').style.background = rampCss(rampOf(st.palette, st.palRev)); };
$('palRev').addEventListener('change', e => { st.palRev = e.target.checked; palLabel(); share.touch(); });
$('cyc').addEventListener('input', e => { st.cycleSpeed = +e.target.value; $('cyco').textContent = st.cycleSpeed ? st.cycleSpeed.toFixed(1) + '×' : 'off'; share.touch(); });
segClick('bg', d => { st.bg = d.b; lightStage(); share.touch(); });
segClick('prSize', d => { st.mm = +d.mm; });
$('snap').addEventListener('click', () => { frame(); saveCanvasPNG(cv, fileName('drawing ' + dr().name) + '.png', $('dlnote')); });
document.querySelectorAll('.btn.try').forEach(b => b.addEventListener('click', () => { const [k, act] = b.dataset.try.split('|'); pickDrawing(k);
  if (act === 'build') setCheck('build', true); if (act === 'slide') setCheck('slide', true); if (act === 'own') setOwnMode(true); }));
buildKeys($('keyTable'), [['G', 'Draw it again'], ['T', 'Show or hide the machine'], ['N', 'Epicycles: add the circles one by one · times tables: keep sliding'], ['+ / −', 'Zoom (epicycles: more / fewer circles with Shift)'], ['1 – 6', 'Epicycles, spirograph, harmonograph, Lissajous, times tables, roses'], ['← → ↑ ↓ / W A S D', 'Move the picture'], ['Shift', 'Hold with the keys above to go three times faster']]);

// ---------- actions ----------
function go() { st.paused = false; lapK = 0; rebuild(); }
function resetView() { view.reset(); MO.resetView && MO.resetView(); st.paused = false; go(); share.touch(); }

// ---------- loop ----------
const MO = makeMotion2D({ pan: (dx, dy) => view.glide(dx, dy), zoom: f => view.zoomBy(f), rotate: a => view.rotate(a), zoomOpt: true, rotateOpt: true,
  sweep: { skip: ['speed', 'lw', 'pp_N', 'pp_n', 'pp_out'] } });
const lp = { draw: false, u: 0 };
const loopsDrawing = () => M.kind === 'pen' && st.loop && !st.build;
const REC = addRecorder({ stage: cv.parentElement, name: () => 'drawing ' + dr().name, bg: () => st.bg, loop: {
  // a seamless loop (js/common/seamless.js): with Draw it again and again, whole drawings from empty; the times table's
  // slide, turning, In & out and the colours go round whole times; drifting, zooming and a pen still drawing hold still
  parts: () => { if (ownMode) return { block: 'Finish drawing your own first: a loop is made of a drawing the machine draws.' };
    const go = !st.paused, r = MO.loopParts(go), parts = [...r.parts], held = [...r.held];
    if (go && loopsDrawing()) parts.push({ name: 'The drawing', rate: 1 / (duration() + 2.4), cycle: 1, noun: ['drawing', 'drawings'] });
    else if (go && prog < 1) held.push('the pen');
    if (go && st.build && dr().group === 'epi') held.push('the circles joining');
    if (go && st.slide && M.kind === 'lines') parts.push({ name: 'Slide', rate: 0.12 * st.speed, cycle: 98, noun: ['time round', 'times round'] });
    if (go) parts.push(...colourPart(st.cycleSpeed));
    return { parts, held }; },
  begin: () => { lp.draw = loopsDrawing() && !st.paused; lp.u = 0; if (lp.draw) rebuild(); },
  step: tick } });
// the Visualizer: a new drawing, palette or slow change every eight bars; when the chorus comes in, a drawing from another machine,
// with the epicycles building up or the times table sliding
makeVisualizer(MO, { preset: 'mvd=0.15&mvw=1&mvb=0.25&mvn=0.08', shape: () => (ownMode ? false : pickButton('#shapeLists button[data-s]')),
  drop: () => { const gk = GROUPS[Math.floor(Math.random() * GROUPS.length)][0]; pickButton(`#shapeLists .shapeGroup:nth-child(${GROUPS.findIndex(x => x[0] === gk) + 1}) button[data-s]`);
    if (gk === 'epi') setCheck('build', true); if (gk === 'times') setCheck('slide', true); return () => { setCheck('build', false); setCheck('slide', false); }; },
  extra: [['a new colour scheme', () => { clickNext('#cmode button', 1); return true; }]] });
let running = false, tPrev = 0, frameN = 0;
function loop(now) {
  if (!running) return; requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now; if (LOOP.on) return;   // a seamless loop being made steps the picture itself (js/common/seamless.js)
  tick(dt);
}
/** One frame: move everything by dt seconds and draw. */
function tick(dt) {
  frameN++;
  resize(); setPausedTag(st.paused); const goOn = !st.paused && !ownMode;
  view.step(dt); MO.step(dt, goOn);
  view.beat = 1 - 0.04 * pulse();   // the beat's pulse: the drawing swells a touch
  if (goOn && LOOP.on) {
    // a seamless loop (js/common/seamless.js): the drawing, its hold and its fade take a whole number of turns of the loop,
    // starting from empty; otherwise the pen holds still where it is
    if (lp.draw) { const P0 = duration() + 2.4, Pq = 1 / loopRate(1 / P0, 1), hl = Math.min(2.4, Pq - 0.5), dl = Pq - hl;
      lp.u += dt / Pq; if (lp.u >= 1 - 1e-9) { lp.u -= 1; rebuild(); }
      const tt = lp.u * Pq; prog = Math.min(1, tt / dl); hold = Math.max(0, tt - dl) * 2.4 / hl; }
    if (st.slide && M.kind === 'lines') { slideM = 2 + (((slideM - 2) + dt * loopRate(0.12 * st.speed, 98)) % 98); M = machine(); }
  }
  else if (goOn) {
    const d = clk.draw.delta(dt, 1 / duration(), 0.5 / duration());   // the pen surges on each beat with the music
    if (prog < 1) prog = Math.min(1, prog + d); else { hold += dt;
      if (st.build && dr().group === 'epi' && hold > 1.2 && (BUILD[lapK + 1] || 0) <= st.P[dr().key].n && BUILD[lapK + 1]) { if (st.keep) ghosts.push({ ...path, k: lapK }); lapK++; rebuild(true, true); }
      else if (st.loop && hold > 2.4 && M.kind === 'pen') { if (st.build) lapK = 0; rebuild(); } }
    if (st.slide && M.kind === 'lines') { slideM = 2 + (((slideM - 2) + dt * 0.12 * st.speed) % 98); M = machine(); if (frameN % 10 === 0) stats(); }
  }
  const cs = goOn ? colourStep(dt) : 0; if ((goOn && st.cycleSpeed > 0) || cs) st.cycle = (st.cycle + (goOn ? dt * loopRate(st.cycleSpeed * 0.06, 1) : 0) + cs) % 1;
  frame(); if (frameN % 30 === 0) share.touch();
}

// ---------- 3D print: the finished drawing as a raised line on a tile ----------
$('prBtn').addEventListener('click', () => {
  const N = 400, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
  x.setTransform(N / 2.3, 0, 0, -N / 2.3, N / 2, N / 2); x.strokeStyle = '#fff'; x.lineCap = x.lineJoin = 'round'; x.lineWidth = 2.6 / (N / 2.3) * Math.max(1, st.lw);
  if (M.kind === 'lines') { const at = k => { const a = Math.PI / 2 - 2 * Math.PI * k / M.N; return [Math.cos(a), Math.sin(a)]; }; x.beginPath(); for (let k = 0; k < M.N; k++) { const p = at(k), q = at(k * M.m); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); } x.stroke(); }
  else { x.beginPath(); for (let i = 0; i <= path.n; i++) (i ? x.lineTo : x.moveTo).call(x, path.pts[i * 2], path.pts[i * 2 + 1]); x.stroke(); }
  const px = x.getImageData(0, 0, N, N).data, A = new Float32Array(N * N); for (let i = 0; i < N * N; i++) A[i] = px[i * 4] / 255;
  const T = heightfieldTriangles(A, N, N, st.mm, 2, 2.5), r = stlFromTriangles(T, st.mm, 'Math Explorer drawing');
  saveFile(fileName('drawing ' + dr().name) + `_${st.mm}mm.stl`, r.bytes, $('prNote')).then(ok => { if (ok) $('prNote').textContent += ` ${r.size.map(v => Math.round(v)).join(' × ')} mm.`; });
});

// ---------- keys, sharing, lifecycle ----------
export function onKey(e) {
  if (e.key === 't' || e.key === 'T') { setCheck('machine', !st.machine); return true; }
  return standardKeys(e, {
    pause: () => { st.paused = !st.paused; labels(); }, go, reset: resetView,
    renew: () => { const gk = dr().group; if (gk === 'epi') setCheck('build', !st.build); else if (gk === 'times') setCheck('slide', !st.slide); else go(); },
    shape: dir => clickNext('#shapeLists button[data-s]', dir), palette: dir => clickNext('#palettes button', dir), colourMode: dir => clickNext('#cmode button', dir),
    reverse: () => $('palRev').click(), cycle: () => setRange('cyc', st.cycleSpeed > 0 ? 0 : 1),
    zoom: f => { if (e.shiftKey && dr().group === 'epi') { const el = $('pp_n'); if (el) setRange('pp_n', clamp(Math.round(+el.value / f), 1, 200)); } else view.zoomBy(f); },
    mode: i => { const gk = GROUPS[i]; if (gk) pickDrawing(Object.values(DRAWINGS).find(d => d.group === gk[0]).key); },
  });
}
const encode = () => { const p = new URLSearchParams(), d = dr(), P = st.P[d.key]; p.set('k', d.key); for (const k in P) p.set(k, r4(P[k]));   // k: which drawing (the roses have a setting called d)
  if (d.key === 'own' && st.own) p.set('own', st.own.filter((_, i) => i % 4 === 0).map(q => q.map(v => Math.round(v * 500)).join('_')).join('~'));
  if (st.speed !== 1) p.set('spd', st.speed); if (!st.machine) p.set('mc', 0); if (!st.loop) p.set('lp', 0); if (st.target) p.set('tg', 1); if (st.build) p.set('bu', 1); if (!st.keep) p.set('ke', 0); if (st.slide) p.set('sl', 1);
  if (st.lw !== 1.4) p.set('lw', st.lw); if (st.glow) p.set('gw', 1); p.set('cm', st.cmode); p.set('pal', st.palette); if (st.palRev) p.set('rev', 1); if (st.cycleSpeed) p.set('cyc', st.cycleSpeed); if (st.bg !== '#0b0d12') p.set('bg', st.bg.slice(1));
  p.set('v', [view.cx, view.cy, view.scale, view.rot].map(r4).join('_')); MO.encode(p); return p.toString(); };
function apply(code) {
  const p = new URLSearchParams(code); let k = p.get('k');
  if (k === 'own') { const own = (p.get('own') || '').split('~').map(q => q.split('_').map(v => +v / 500)).filter(q => q.length === 2 && q.every(isFinite)); if (own.length > 8) st.own = resample(own, 512); else k = 'e_heart'; }
  if (k !== 'own' && !DRAWINGS[k]) return false;
  const d = k === 'own' ? OWN : DRAWINGS[k]; for (const q of d.params) st.P[d.key][q.id] = clamp(num(p, q.id, q.def), q.min, q.max);
  setRange('speed', num(p, 'spd', 1)); setCheck('machine', p.get('mc') !== '0'); setCheck('loop', p.get('lp') !== '0'); setCheck('target', p.get('tg') === '1'); st.build = p.get('bu') === '1'; $('build').checked = st.build; setCheck('keep', p.get('ke') !== '0'); st.slide = p.get('sl') === '1'; $('slide').checked = st.slide;
  setRange('lw', num(p, 'lw', 1.4)); setCheck('glow', p.get('gw') === '1'); clickData('#cmode', 'c', ['along', 'laps', 'solid'].includes(p.get('cm')) ? p.get('cm') : 'along');
  clickData('#palettes', 'pal', p.get('pal') || 'aurora'); setCheck('palRev', p.get('rev') === '1'); setRange('cyc', num(p, 'cyc', 0)); clickData('#bg', 'b', '#' + (p.get('bg') || '0b0d12'));
  buildLists(); pickDrawing(k, true);
  const v = (p.get('v') || '').split('_').map(Number); if (v.length === 4 && v.every(isFinite)) { view.cx = v[0]; view.cy = v[1]; view.scale = clamp(v[2], 0.05, 40); view.rot = v[3]; } else view.reset();
  MO.decode(p);
  return true;
}
const share = makeShare('draw', encode, apply);
// the Paper background: dark stage text (as in Fractals); removed again when you leave this explorer
function lightStage() { document.getElementById('app').classList.toggle('light', st.bg === '#f3efe6'); }
MO.onChange = () => share.touch();
palLabel(); buildLists();
if (!apply(parseRoute().code)) pickDrawing('e_heart');
export function start() { lightStage(); resize(); running = true; tPrev = performance.now(); requestAnimationFrame(loop); share.write(); }
export function stop() { running = false; REC.stop(); document.getElementById('app').classList.remove('light'); }
export const reset = resetView;
export const going = () => true;
/* the picture's Go button (null hides it) and what its slower / faster buttons move (js/shell/toolbar.js) */
export const goLabel = () => 'Draw it again';
export const speedCtl = () => 'speed';   /* G redraws from the start, so a tap just pauses */
export const layoutChanged = () => { resize(); };
export const showView = code => apply(code);
export const soundHelp = 'Here, each beat flashes the drawing brighter (or, with Pulse, swells it a touch), and the pen surges forward on the beat. Vocals thicken the line a little, energy sets the pace, and colour drifts the palette. The Visualizer brings in a new drawing every eight bars and, when the chorus comes in, a different machine: epicycles building up circle by circle, or a times table sliding.';
