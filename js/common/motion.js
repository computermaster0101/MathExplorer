// Motion for making pictures that move, shared by the newer explorers:
//  - makeMotion3D: a "Rotation & motion" group for the 3D stage: turn round or rock to and fro, tumble, zoom, zoom in and
//    out, drift the camera.
//  - makeMotion2D: a "Motion" group for flat pictures: drift (straight or wandering), keep zooming, zoom in and out, turn.
//  - Both carry "Slowly change": pick any of the explorer's own sliders and it sweeps back and forth round where it was,
//    so the shape itself morphs (a surface's twist, Lenia's growth rule, a wall's thickness).
//  - addRecorder: records whatever the stage shows (every visible canvas, stacked) as a video file, with the music.
// Every motion follows the music like the rest of the app: turning surges on the beat (Groove), and the to-and-fro
// motions land their cycles on bar lines (Phase). Each group goes right after the explorer's Controls group.
import { $ } from './kit.js';
import { Groove, Phase, cycleBeats } from '../shell/audio/react.js';
import { recordTracks } from '../shell/audio/engine.js';
import { saveFile, fileName } from './save.js';
import { LOOP, loopRate } from './seamless.js';
import { wireLoop, LOOP_HTML, LOOP_OPTS_HTML } from './loopmaker.js';

const TAU = 2 * Math.PI;
const r6 = x => +(+x).toPrecision(6);
const row = (label, id, min, max, step, val, fmt) => `<div class="row"><span style="width:74px">${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output id="${id}o">${fmt(val)}</output></div>`;
const times = v => (+v).toFixed(2).replace(/\.?0+$/, '') + '×', amount = v => (+v === 0 ? 'off' : Math.round(v * 100) + '%');

/** Put a new panel group right after the explorer's Controls group (or after Shapes); returns its body. */
function addGroup(id, title, html) {
  const d = document.createElement('details'); d.className = 'grp'; d.id = id;
  d.innerHTML = `<summary><span class="gt">${title}</span><span class="gv"></span></summary><div class="gb">${html}</div>`;
  const after = $('g-ctl') || $('g-shapes'); after.parentNode.insertBefore(d, after.nextSibling); return d;
}
/** Move an explorer's own rows into the group; a section of its panel left empty by the move is removed. */
function adopt(el, into, before) { const old = el.parentElement; into.insertBefore(el, before === undefined ? into.firstChild : before);
  if (old && old.classList.contains('sec') && !old.querySelector('input,button,select')) old.remove(); }
/** Wire a slider made by row(): its output shows fmt(value) and set(value) is called on each change. */
function slider(id, fmt, set) { const el = $(id), o = $(id + 'o'); el.addEventListener('input', () => { o.textContent = fmt(el.value); set(+el.value); }); return el; }
// Loading settings can happen while the explorer's panel is detached (the Visualizer stopping as you switch explorer), so
// lookups go through the group itself (ROOT) first, which stays whole when it's off the page.
let ROOT = null;
const inG = (g, id) => (g && g.querySelector('#' + id)) || $(id);
function setSlider(id, v, fmt) { const el = inG(ROOT, id); if (!el) return; el.value = v; const o = inG(ROOT, id + 'o'); if (o) o.textContent = fmt(el.value); el.dispatchEvent(new Event('input')); }

// ---------- Slowly change: sweep one of the explorer's sliders ----------
const SWEEP_HTML = `<div class="sec" id="mvSweepSec"><div class="lbl">Slowly change the shape</div>
  <select id="mvWhat" class="txt"><option value="">Nothing</option></select>
  ${row('How far', 'mvFar', 0.05, 1, 0.01, 0.3, amount)}
  ${row('Cycle', 'mvLen', 4, 60, 1, 16, v => v + ' s')}
  <p class="note">Sweeps the chosen slider back and forth round where you left it. With a steady beat, each sweep takes whole bars.</p></div>`;
/**
 * The sweep. Any slider in Shapes, Controls or View & detail can be chosen; opts.skip: slider ids to leave out;
 * opts.every: least ms between changes (for sliders that rebuild something heavy); opts.far: the starting How far
 * (a small one for sliders where a little goes a long way, like Lenia's growth rule).
 */
function makeSweep(opts, changed) {
  const FAR = opts.far || 0.3;
  $('mvFar').value = FAR; $('mvFaro').textContent = amount(FAR);
  const sw = { id: '', far: FAR, len: 16, t: 0, mid: 0, half: 0, centre: null, last: -1, phase: new Phase() };
  const sel = $('mvWhat'), skip = new Set(['navSpeed', 'mvFar', 'mvLen', ...(opts.skip || [])]);
  const candidates = () => ['g-shapes', 'g-ctl', 'g-view'].flatMap(g => { const el = $(g); return el ? [...el.querySelectorAll('input[type=range]')] : []; })
    .filter(el => el.id && !skip.has(el.id) && !el.id.startsWith('mv') && !el.closest('[hidden]'));
  const labelOf = el => { const r = el.closest('.row'), s = r && r.querySelector('span'); return (s ? s.textContent : el.id).trim(); };
  const fill = () => { const list = candidates(); if (sw.id && !list.some(el => el.id === sw.id) && $(sw.id)) list.push($(sw.id));
    sel.innerHTML = '<option value="">Nothing</option>' + list.map(el => `<option value="${el.id}">${labelOf(el)}</option>`).join(''); sel.value = sw.id; };
  sel.addEventListener('pointerdown', fill); sel.addEventListener('focus', fill);
  // the window it sweeps: as wide as asked, moved inside the slider's range, starting from where the slider is now
  const aim = el => { const lo = +el.min, hi = +el.max, c = sw.centre ?? +el.value; sw.half = Math.min(0.5 * (hi - lo), 0.5 * sw.far * (hi - lo));
    sw.mid = Math.min(hi - sw.half, Math.max(lo + sw.half, c)); sw.t = Math.asin(Math.max(-1, Math.min(1, sw.half ? (+el.value - sw.mid) / sw.half : 0))); };
  const choose = id => { const old = sw.id && $(sw.id); if (old && sw.centre != null) { old.value = sw.centre; old.dispatchEvent(new Event('input')); }
    sw.id = id; sw.centre = null; const el = id && $(id); if (el) { sw.centre = +el.value; aim(el); } };
  sel.addEventListener('change', () => { choose(sel.value); changed(); });
  slider('mvFar', amount, v => { sw.far = v; const el = sw.id && $(sw.id); if (el) aim(el); changed(); });
  slider('mvLen', v => v + ' s', v => { sw.len = v; changed(); });
  // dragging the swept slider by hand moves the middle of the sweep there
  document.addEventListener('input', e => { if (e.isTrusted && e.target.id === sw.id) { sw.centre = +e.target.value; aim(e.target); } }, true);
  sw.step = (dt, on) => { sw.tidy(); const el = sw.id && $(sw.id); if (!el || !on || el.closest('[hidden]')) return false;
    if (sw.centre == null) { sw.centre = +el.value; aim(el); }
    sw.t = sw.phase.step(sw.t, dt, TAU, cycleBeats(4), TAU / sw.len);
    const st = +el.step || 0, raw = sw.mid + sw.half * Math.sin(sw.t), v = st ? Math.round(raw / st) * st : raw, now = performance.now();
    if (Math.abs(v - +el.value) < 1e-9 || (!LOOP.on && now - sw.last < (opts.every || 0))) return true;
    sw.last = now; el.value = v; el.dispatchEvent(new Event('input')); return true; };
  sw.encode = p => { if (!sw.id) return; p.set('mvx', sw.id); if (sw.centre != null) p.set('mvc', r6(sw.centre)); if (sw.far !== FAR) p.set('mvf', sw.far); if (sw.len !== 16) p.set('mvh', sw.len); };
  sw.decode = p => { setSlider('mvFar', p.get('mvf') ?? FAR, amount); setSlider('mvLen', p.get('mvh') ?? 16, v => v + ' s');
    sw.id = p.get('mvx') || ''; sw.centre = null; const el = sw.id && $(sw.id);
    if (el && p.has('mvc')) { el.value = +p.get('mvc'); el.dispatchEvent(new Event('input')); }
    fill(); };
  sw.moving = () => !!sw.id;
  /** As a seamless loop's part (js/common/seamless.js), while a slider is being swept. */
  sw.part = () => { const el = sw.id && $(sw.id); return el && !el.closest('[hidden]') ? [{ name: 'Slowly change (' + labelOf(el) + ')', rate: TAU / sw.len, cycle: TAU, noun: ['sweep', 'sweeps'] }] : []; };
  /** The sliders that can be swept here, and choosing one (for the Visualizer). */
  sw.list = () => candidates().map(el => el.id);
  sw.pick = id => { fill(); sel.value = id; choose(id); changed(); };
  // the section shows only when this mode has sliders to sweep
  let n = 0; sw.tidy = () => { if (n++ % 30) return; const sec = $('mvSweepSec'); if (sec) sec.hidden = !sw.id && !candidates().length; };
  return sw;
}

// ---------- 3D ----------
/**
 * The Rotation & motion group for a makeStage3D stage. opts:
 *  spinRow, speedRow: the explorer's own "Keep turning" and speed rows, moved into the group (speedRow optional; without
 *    one the group adds its own Turn speed slider);
 *  rate(): radians per second at speed 1; spinOn(): whether "Keep turning" is ticked; speed(): the explorer's speed, if any;
 *  turn(a): turn about the vertical (default S.turn(a, 0)); sweep: options for Slowly change.
 * Call step(dt, { go, away, spin }) every frame instead of turning the shape yourself: go is false while paused (everything
 * holds still), away is true in a first-person view (walking, riding, flying: the camera motions are taken off, and eased
 * back in afterwards), spin is false while the shape is being dragged.
 */
export function makeMotion3D(S, opts) {
  const own = !opts.speedRow;
  const g = addGroup('g-motion', 'Rotation &amp; motion', `<div class="sec" id="mvTurnSec">
    ${own ? row('Turn speed', 'mvSpeed', -3, 3, 0.05, 1, times) : ''}
    <div class="lbl" style="margin-top:8px">How it turns</div>
    <div class="seg" id="mvStyle"><button data-s="round" class="on">Round and round</button><button data-s="rock">Rock to and fro</button></div>
    ${row('Tumble', 'mvTumble', 0, 1, 0.01, 0, amount)}
    <p class="note">Tumble also turns it head over heels, slower than it turns round, so you see every side.</p></div>
  <div class="sec" id="mvCamSec"><div class="lbl">Camera</div>
    ${row('Zoom', 'mvZoom', 0.3, 3, 0.01, 1, times)}
    ${row('In &amp; out', 'mvBreathe', 0, 1, 0.01, 0, amount)}
    ${row('Drift', 'mvDrift', 0, 1, 0.01, 0, amount)}
    <p class="note">In &amp; out slowly zooms in and back out; Drift lets the camera wander a little from side to side.</p></div>${SWEEP_HTML}`);
  const sec = $('mvTurnSec');
  if (opts.speedRow) adopt(opts.speedRow, sec);
  if (opts.spinRow) { opts.spinRow.style.marginTop = '0'; adopt(opts.spinRow, sec); }
  const M = { spd: 1, style: 'round', tumble: 0, breathe: 0, drift: 0, onChange: null };
  const changed = () => M.onChange && M.onChange();
  if (own) slider('mvSpeed', times, v => { M.spd = v; changed(); });
  const styleSeg = $('mvStyle'); styleSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; M.style = b.dataset.s; styleSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); changed(); });
  slider('mvTumble', amount, v => { M.tumble = v; changed(); });
  slider('mvBreathe', amount, v => { M.breathe = v; changed(); });
  slider('mvDrift', amount, v => { M.drift = v; changed(); });
  const cam = S.camera.position, z0 = cam.z;
  // the camera motions are kept as what they added last frame, so dragging, the wheel and W A S D still work on top
  let w = 0, fz = 1, ox = 0, oy = 0, rockA = 0, zoomBusy = false;
  const zs = $('mvZoom'); zs.addEventListener('input', () => { zoomBusy = true; $('mvZoomo').textContent = times(zs.value); S.zoom(z0 / zs.value * fz / cam.z); });
  zs.addEventListener('change', () => { zoomBusy = false; });
  const undo = () => { cam.z /= fz; cam.x -= ox; cam.y -= oy; fz = 1; ox = oy = 0; };
  const r0 = S.reset; S.reset = () => { r0(); fz = 1; ox = oy = 0; w = 0; rockA = 0; };
  const clk = { spin: new Groove(), tumble: new Groove(), rock: new Phase(), breathe: new Phase(), drift: new Phase() }; let tr = 0, tb = 0, td = 0;
  M.sweep = makeSweep(opts.sweep || {}, changed);
  const turn = opts.turn || (a => S.turn(a, 0));
  // ---- seamless loops (js/common/seamless.js) ----
  const lp = { q0: S.pivot.quaternion.clone(), qx: S.pivot.quaternion.clone(), qy: S.pivot.quaternion.clone(), X: new S.THREE.Vector3(1, 0, 0), Y: new S.THREE.Vector3(0, 1, 0), yaw: 0, tum: 0, rock0: 0, yawDone: 0, tumDone: 0 };
  /** Start of a loop: remember the pose the turning is measured from. */
  M.loopBegin = () => { S.vel.x = S.vel.y = 0; lp.q0.copy(S.pivot.quaternion); lp.yaw = lp.tum = lp.yawDone = lp.tumDone = 0; lp.rock0 = rockA; w = 1; };
  /** What this group would move in a loop (nothing while paused, or in a first-person view). */
  M.loopParts = (go = true, away = false) => { const parts = [], held = [];
    if (!go) return { parts, held };
    const rate = opts.rate() * (opts.speed ? opts.speed() : M.spd);
    if (!away && opts.spinOn() && rate) {
      parts.push(M.style === 'round' ? { name: 'Keep turning', rate, cycle: TAU } : { name: 'Rock to and fro', rate: Math.abs(rate) * 0.9, cycle: TAU, noun: ['swing', 'swings'] });
      if (M.tumble) parts.push({ name: 'Tumble', rate: 0.6 * rate * M.tumble, cycle: TAU }); }
    if (!away && M.breathe) parts.push({ name: 'In & out', rate: TAU / 14, cycle: TAU, noun: ['time', 'times'] });
    if (!away && M.drift) parts.push({ name: 'Drift', rate: TAU / 23, cycle: TAU, noun: ['time round', 'times round'] });
    parts.push(...M.sweep.part());
    return { parts, held }; };
  let frame = 0, wasOn = false;
  const syncZoom = () => { if (frame % 10 || zoomBusy) return; zs.value = Math.min(3, Math.max(0.3, z0 * fz / cam.z)); $('mvZoomo').textContent = times(zs.value); };
  M.step = (dt, { go = true, away = false, spin = true } = {}) => {
    frame++; if (M.viz) M.viz.step(dt, go);
    if (away) { if (wasOn) undo(); wasOn = false; w = 0; if (go) M.sweep.step(dt, true); return false; }
    wasOn = true; syncZoom(); if (!go) return false;
    w += (1 - w) * (1 - Math.exp(-dt / 0.8)); if (LOOP.on) w = 1;
    const rate = opts.rate() * (opts.speed ? opts.speed() : M.spd), spinning = spin && opts.spinOn();
    if (spinning && LOOP.on) {
      // a seamless loop: the turn and the tumble each go round whole times; with the default turn the pose is worked out
      // from the two angles (turning and tumbling a step at a time doesn't come back to where it started)
      let yaw;
      if (M.style === 'round') yaw = (lp.yaw += loopRate(rate) * dt);
      else { tr = clk.rock.step(tr, dt, TAU, cycleBeats(1), Math.abs(rate) * 0.9); rockA = 0.7 * Math.sin(tr) * Math.sign(rate || 1); yaw = rockA - lp.rock0; }
      if (M.tumble) lp.tum += loopRate(0.6 * rate * M.tumble) * dt;
      if (opts.turn) { turn(yaw - lp.yawDone); lp.yawDone = yaw; if (M.tumble) { S.turn(0, lp.tum - lp.tumDone); lp.tumDone = lp.tum; } }
      else S.pivot.quaternion.copy(lp.qx.setFromAxisAngle(lp.X, lp.tum)).multiply(lp.qy.setFromAxisAngle(lp.Y, yaw)).multiply(lp.q0);
    } else if (spinning) {
      if (M.style === 'round') turn(clk.spin.delta(dt, rate, rate * 0.5));
      else { tr = clk.rock.step(tr, dt, TAU, cycleBeats(1), Math.abs(rate) * 0.9); const a = 0.7 * Math.sin(tr) * Math.sign(rate || 1); turn(a - rockA); rockA = a; }
      if (M.tumble) S.turn(0, clk.tumble.delta(dt, 0.6 * rate * M.tumble, 0.3 * rate * M.tumble));
    }
    // camera: zoom in and out round the zoom you chose, and drift on a slow figure of eight
    if (M.breathe || M.drift || fz !== 1 || ox || oy) {
      cam.z /= fz; cam.x -= ox; cam.y -= oy;
      tb = clk.breathe.step(tb, dt, TAU, cycleBeats(4), TAU / 14); td = clk.drift.step(td, dt, TAU, cycleBeats(8), TAU / 23);
      fz = Math.exp(-0.55 * M.breathe * w * Math.sin(tb)); const amp = 0.22 * cam.z * M.drift * w; ox = amp * Math.sin(td); oy = 0.6 * amp * Math.sin(2 * td);
      cam.z *= fz; cam.x += ox; cam.y += oy;
    }
    M.sweep.step(dt, true);
    return spinning || M.moving();
  };
  /** The camera distance without In & out (for share links). */
  M.baseZ = () => cam.z / fz;
  /** Anything this group keeps moving by itself (for Space: "is anything moving?"). */
  M.moving = () => M.breathe > 0 || M.drift > 0 || M.sweep.moving();
  M.encode = p => { if (own && M.spd !== 1) p.set('mvs', M.spd); if (M.style === 'rock') p.set('mvr', 1); if (M.tumble) p.set('mvt', M.tumble); if (M.breathe) p.set('mvb', M.breathe); if (M.drift) p.set('mvd', M.drift); M.sweep.encode(p); };
  M.decode = p => { const n = (k, d) => (p.has(k) && isFinite(+p.get(k)) ? +p.get(k) : d); ROOT = g;
    if (own) setSlider('mvSpeed', n('mvs', 1), times);
    const b = inG(g, 'mvStyle').querySelector(`[data-s="${p.get('mvr') === '1' ? 'rock' : 'round'}"]`); b.click();
    setSlider('mvTumble', n('mvt', 0), amount); setSlider('mvBreathe', n('mvb', 0), amount); setSlider('mvDrift', n('mvd', 0), amount); M.sweep.decode(p); ROOT = null; };
  M.group = g;
  return M;
}

// ---------- 2D ----------
/**
 * The Motion group for a flat picture. opts:
 *  pan(dx, dy): move the view by dx, dy screen heights (the picture slides the other way);
 *  zoom(f): zoom by f (below 1 is in) about the middle; returns false at the limit, which turns the zoom round;
 *  rotate(a): turn the view by a radians (optional; without it there's no Turn slider);
 *  note: a sentence shown under the controls; sweep: options for Slowly change;
 *  rows: the explorer's own motion controls (an element), moved to the top of the group.
 * Call step(dt, on) every frame; it returns true when it moved the view.
 */
export function makeMotion2D(opts) {
  const g = addGroup('g-motion', 'Motion', `<div class="sec">
    ${row('Drift', 'mvDrift', 0, 1, 0.01, 0, amount)}
    ${row('Heading', 'mvHead', 0, 359, 1, 30, v => v + '°')}
    <label class="check"><input type="checkbox" id="mvWander"> Wander (the heading turns slowly by itself)</label>
    ${opts.zoom ? row('Zoom', 'mvZoom', -1, 1, 0.01, 0, v => (+v === 0 ? 'off' : (v > 0 ? 'in ' : 'out ') + Math.round(Math.abs(v) * 100) + '%')) + row('In &amp; out', 'mvBreathe', 0, 1, 0.01, 0, amount) : ''}
    ${opts.rotate ? row('Turn', 'mvTurn', -1, 1, 0.01, 0, v => (+v === 0 ? 'off' : Math.round(v * 100) + '%')) : ''}
    <p class="note">${opts.note || 'Drift glides across the picture. Zoom keeps going in (or out) and turns round at the limit; In &amp; out zooms gently in and back out.'}</p></div>${SWEEP_HTML}`);
  if (opts.rows) { const first = g.querySelector('.sec'); if (opts.rows.classList.contains('sec')) adopt(opts.rows, first.parentElement, first); else adopt(opts.rows, first); }
  const M = { drift: 0, head: 30, wander: false, zoom: 0, breathe: 0, turn: 0, onChange: null };
  const changed = () => M.onChange && M.onChange();
  slider('mvDrift', amount, v => { M.drift = v; changed(); });
  slider('mvHead', v => v + '°', v => { M.head = v; changed(); });
  $('mvWander').addEventListener('change', e => { M.wander = e.target.checked; changed(); });
  const zf = v => (+v === 0 ? 'off' : (v > 0 ? 'in ' : 'out ') + Math.round(Math.abs(v) * 100) + '%');
  if (opts.zoom) { slider('mvZoom', zf, v => { M.zoom = v; zdir = 1; changed(); }); slider('mvBreathe', amount, v => { M.breathe = v; changed(); }); }
  if (opts.rotate) slider('mvTurn', v => (+v === 0 ? 'off' : Math.round(v * 100) + '%'), v => { M.turn = v; changed(); });
  const clk = { drift: new Groove(), zoom: new Groove(), turn: new Groove(), breathe: new Phase(), wander: new Phase() };
  let zdir = 1, tb = 0, lastB = 0, tw = 0;
  M.sweep = makeSweep(opts.sweep || {}, changed);
  M.step = (dt, on) => {
    if (M.viz) M.viz.step(dt, on);
    if (!on) return false; let moved = false;
    if (M.drift && !LOOP.on) {
      if (M.wander) { tw = clk.wander.step(tw, dt, TAU, cycleBeats(16), TAU / 40); }
      const a = (M.head * Math.PI / 180) + (M.wander ? 1.4 * Math.sin(tw) + 0.5 * Math.sin(2.3 * tw) : 0), d = clk.drift.delta(dt, 0.12 * M.drift, 0.06 * M.drift);
      if (d) { opts.pan(d * Math.cos(a), d * Math.sin(a)); moved = true; }
    }
    if (opts.zoom && M.zoom && !LOOP.on) { const d = clk.zoom.delta(dt, 0.35 * Math.abs(M.zoom), 0.18 * Math.abs(M.zoom)); if (d && opts.zoom(Math.exp(-d * Math.sign(M.zoom) * zdir)) === false) zdir = -zdir; moved = true; }
    if (opts.zoom && M.breathe) { tb = clk.breathe.step(tb, dt, TAU, cycleBeats(4), TAU / 14); const b = 0.6 * M.breathe * Math.sin(tb); opts.zoom(Math.exp(lastB - b)); lastB = b; moved = true; }
    else if (lastB) { opts.zoom(Math.exp(lastB)); lastB = 0; moved = true; }
    if (opts.rotate && M.turn) { const d = clk.turn.delta(dt, loopRate(0.25 * M.turn), 0.13 * M.turn); if (d) { opts.rotate(d); moved = true; } }
    if (M.sweep.step(dt, true)) moved = true;
    return moved;
  };
  M.moving = () => !!(M.drift || M.zoom || M.breathe || M.turn || M.sweep.moving());
  /** What this group would move in a seamless loop, and what holds still (drifting and zooming never come back). */
  M.loopParts = (go = true) => { const parts = [], held = [];
    if (!go) return { parts, held };
    if (opts.rotate && M.turn) parts.push({ name: 'Turn', rate: 0.25 * M.turn, cycle: TAU });
    if (opts.zoom && M.breathe) parts.push({ name: 'In & out', rate: TAU / 14, cycle: TAU, noun: ['time', 'times'] });
    parts.push(...M.sweep.part());
    if (M.drift) held.push('Drift'); if (opts.zoom && M.zoom) held.push('Zoom');
    return { parts, held }; };
  /** Forget the In & out offset (after the view is reset, so it doesn't jump back). */
  M.resetView = () => { lastB = 0; };
  M.encode = p => { if (M.drift) p.set('mvd', M.drift); if (M.head !== 30) p.set('mva', M.head); if (M.wander) p.set('mvw', 1); if (M.zoom) p.set('mvz', M.zoom); if (M.breathe) p.set('mvb', M.breathe); if (M.turn) p.set('mvn', M.turn); M.sweep.encode(p); };
  M.decode = p => { const n = (k, d) => (p.has(k) && isFinite(+p.get(k)) ? +p.get(k) : d); ROOT = g;
    setSlider('mvDrift', n('mvd', 0), amount); setSlider('mvHead', n('mva', 30), v => v + '°');
    const w = inG(g, 'mvWander'); if (w.checked !== (p.get('mvw') === '1')) { w.checked = !w.checked; w.dispatchEvent(new Event('change')); }
    if (opts.zoom) { setSlider('mvZoom', n('mvz', 0), zf); setSlider('mvBreathe', n('mvb', 0), amount); }
    if (opts.rotate) setSlider('mvTurn', n('mvn', 0), v => (+v === 0 ? 'off' : Math.round(v * 100) + '%'));
    M.sweep.decode(p); ROOT = null; };
  M.group = g;
  return M;
}

// ---------- recording ----------
function recMime() { if (!window.MediaRecorder) return ''; for (const m of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4']) if (MediaRecorder.isTypeSupported(m)) return m; return ''; }
/**
 * A Record video section at the end of the explorer's Save & share group. stage: the element holding the explorer's
 * canvases (every visible one is drawn, in page order, as it sits on screen); name(): the file name's start;
 * bg(): the background colour behind the canvases. "As it plays" records at 30 frames a second, with the music if it's
 * playing. "Seamless loop" (when the explorer gives loop) makes a video that plays round and round without a seam
 * (js/common/loopmaker.js): loop = { parts(): { parts, held, block } (js/common/seamless.js), step(dt): one frame of the
 * explorer's loop, drawn; begin(L, W, H), end(): optional }.
 */
export function addRecorder({ stage, name, bg, loop }) {
  const box = $('g-share').querySelector('.gb'), sec = document.createElement('div'); sec.className = 'sec';
  sec.innerHTML = `<div class="lbl">Record video <b id="recTime"></b></div>
    ${loop ? LOOP_HTML : ''}
    <div class="seg" id="recLen" style="margin-top:6px"><button data-s="0" class="on">Until I stop</button><button data-s="10">10 s</button><button data-s="30">30 s</button></div>
    ${loop ? LOOP_OPTS_HTML : ''}
    <div class="seg" id="recRes" style="margin-top:6px"><button data-r="0" class="on">Screen size</button><button data-r="720">720p</button><button data-r="1080">1080p</button></div>
    <div class="btns" style="margin-top:8px"><button class="btn" id="recBtn">● Record</button></div>
    <p class="note" id="recNote">Records whatever is moving as a video file, with the music if it's playing. Set things moving under Rotation &amp; motion (or Motion) first.</p>`;
  box.appendChild(sec);
  const btn = $('recBtn'), noteEl = $('recNote'), timeEl = $('recTime');   /* held: the panel may be off the page when a recording ends */
  const rec = { mr: null, chunks: [], cv: document.createElement('canvas'), t0: 0, limit: 0, res: 0, mime: '', raf: 0 };
  const seg = (id, fn) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b || (LP && LP.making())) return; $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset); });
  seg('recLen', d => { rec.limit = +d.s; }); seg('recRes', d => { rec.res = +d.r; });
  const layers = () => [...stage.querySelectorAll('canvas')].filter(c => c.width && c.height && !c.closest('[hidden]') && getComputedStyle(c).display !== 'none' && getComputedStyle(c).visibility !== 'hidden');
  const LP = loop ? wireLoop({ stage, layers, bg, loop, sec, res: () => rec.res,
    save: (blob, tag, ext) => saveFile(`${fileName(name())}${tag}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.${ext}`, blob, noteEl) }) : null;
  const label = () => { if (LP) LP.label(); else btn.textContent = '● Record'; };
  const frame = () => { if (!rec.mr) return; rec.raf = requestAnimationFrame(frame);
    const g = rec.cv.getContext('2d'), W = rec.cv.width, H = rec.cv.height, R = stage.getBoundingClientRect(), k = W / Math.max(1, R.width);
    g.fillStyle = (bg && bg()) || '#0b0d12'; g.fillRect(0, 0, W, H);
    for (const c of layers()) { const r = c.getBoundingClientRect(); try { g.drawImage(c, (r.left - R.left) * k, (r.top - R.top) * k, r.width * k, r.height * k); } catch (e) { /* a canvas that can't be read */ } }
    const t = (performance.now() - rec.t0) / 1000; timeEl.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` + (rec.limit ? ` / 0:${String(rec.limit).padStart(2, '0')}` : '');
    if (rec.limit && t >= rec.limit) stopRec(); };
  const start = () => { const mime = recMime(); if (!mime || !rec.cv.captureStream) { noteEl.textContent = 'This browser can\'t record video from the page. Recent Chrome, Edge, Firefox and Safari can.'; return; }
    const R = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); let w, h;
    if (!rec.res) { const k = Math.min(1, 1920 / (R.width * dpr)); w = R.width * dpr * k; h = R.height * dpr * k; } else { h = rec.res; w = h * R.width / Math.max(1, R.height); }
    rec.cv.width = Math.round(w / 2) * 2; rec.cv.height = Math.round(h / 2) * 2;
    const tracks = [...rec.cv.captureStream(30).getVideoTracks(), ...recordTracks()];
    try { rec.mr = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: rec.cv.height >= 1000 ? 12e6 : 7e6 }); } catch (e) { noteEl.textContent = 'Couldn\'t start recording here.'; rec.mr = null; return; }
    rec.mime = mime; const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'; rec.chunks = []; rec.mr.ondataavailable = e => { if (e.data && e.data.size) rec.chunks.push(e.data); };
    rec.mr.onstop = () => { const blob = new Blob(rec.chunks, { type: rec.mime.split(';')[0] }); rec.chunks = []; btn.classList.remove('on'); label(); timeEl.textContent = '';
      if (blob.size) saveFile(`${fileName(name())}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.${ext}`, blob, noteEl); else noteEl.textContent = 'Nothing was recorded.'; };
    rec.mr.start(1000); rec.t0 = performance.now(); frame(); btn.textContent = '■ Stop recording'; btn.classList.add('on');
    noteEl.textContent = `Recording ${rec.cv.width}×${rec.cv.height} ${ext.toUpperCase()}${tracks.length > 1 ? ' with sound' : ''}. The panel and captions aren't included.`; };
  const stopRec = () => { cancelAnimationFrame(rec.raf); if (rec.mr && rec.mr.state !== 'inactive') { const mr = rec.mr; rec.mr = null; mr.stop(); } else rec.mr = null; };
  btn.addEventListener('click', () => { if (LP && LP.making()) LP.cancel(); else if (rec.mr) stopRec(); else if (LP && LP.kind() === 'loop') LP.make(); else start(); });
  return { stop: () => { stopRec(); if (LP && LP.making()) LP.cancel(); }, recording: () => !!rec.mr || !!(LP && LP.making()) };
}
