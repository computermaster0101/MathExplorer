// The Visualizer: one button that turns a newer explorer into a music visualizer. It sets the explorer's motion going
// (a preset for its Rotation & motion or Motion group), goes full screen, raises Intensity to Lively if it was Calm, and
// then directs: at each new eight-bar phrase it changes one thing (the shape, the palette, which slider slowly changes,
// how it turns, the colour mode); when a chorus or drop comes in it makes a bigger change (each explorer's own: ride the
// knot, fly the labyrinth, a new start in Growing Patterns...), which is undone at the next change; in a quiet passage it
// only drifts the palette. Kicks and snares can trigger an explorer's own small reactions. Pressing the button again puts
// everything back as it was. Nothing here goes into share links.
import { $, clickNext } from './kit.js';
import { Director, HitGate, playing, intensity, bpm, tempoLocked } from '../shell/audio/react.js';
import { enterZen, exitZen, inZen } from '../shell/layout.js';

/** Click a random visible button matching sel that isn't already chosen. Returns true if one was clicked. */
export function pickButton(sel) {
  const bs = [...document.querySelectorAll(sel)].filter(b => !b.closest('[hidden]') && !b.classList.contains('on') && !b.disabled);
  if (!bs.length) return false; bs[Math.floor(Math.random() * bs.length)].click(); return true;
}
/** Set a slider to a random value in [lo, hi] of its range (fractions), firing its input event. */
export function randomSlider(id, lo = 0, hi = 1) {
  const el = $(id); if (!el || el.closest('[hidden]')) return false; const a = +el.min, b = +el.max, st = +el.step || 0;
  let v = a + (b - a) * (lo + (hi - lo) * Math.random()); if (st) v = Math.round(v / st) * st; el.value = v; el.dispatchEvent(new Event('input')); return true;
}

/**
 * MO: the explorer's motion group. cfg:
 *  preset: the motion settings while it runs (a share-code string of mv… keys, as the group writes them);
 *  start(), stop(): anything else to set going / put back (e.g. tick Keep turning);
 *  shape(): change to another shape; drop(): the explorer's big change, may return a function that undoes it;
 *  calm(): for a quiet passage (default: a new palette); kick(), snare(): small reactions on those hits;
 *  extra: [[name, fn], ...] more phrase changes this explorer offers.
 */
export function makeVisualizer(MO, cfg) {
  const box = MO.group.querySelector('.gb'), sec = document.createElement('div'); sec.className = 'sec'; sec.id = 'vizSec';
  sec.innerHTML = `<div class="btns"><button class="btn primary" id="vizBtn">▶ Visualizer</button></div>
    <p class="note" id="vizNote">Turns this into a music visualizer: it sets everything moving, goes full screen and changes the scene with the song (a new look every eight bars, a big change when the chorus or drop comes in). Play a song under Music &amp; sound first. Esc leaves full screen; press the button again to stop. To keep a video of it, start Record video (under Save, share &amp; record) before you press it.</p>`;
  box.insertBefore(sec, box.firstChild);
  const V = { on: false }, dir = new Director(), gate = new HitGate();
  let saved = null, zenned = false, bumped = false, undo = null, lastAct = '', lastName = '', t = 0, noteT = 0, spinWas = null;
  const btn = $('vizBtn'), note = $('vizNote'), idle = note.textContent;
  const setIntensity = k => { const b = document.querySelector(`#sndIntensity [data-i="${k}"]`); if (b) b.click(); };
  // the phrase changes: each is [name shown, function]; a function returning false means "not here", and another is tried
  const ACTS = [
    ['a new shape', () => cfg.shape && cfg.shape() !== false, 3],
    ['a new palette', () => pickButton('#palettes button'), 2],
    ['a new slow change', () => { const ids = MO.sweep.list(); if (!ids.length) return false; MO.sweep.pick(ids[Math.floor(Math.random() * ids.length)]); return true; }, 2],
    ['a new colour mode', () => { const cm = $('cmode'); if (!cm || cm.closest('[hidden]') || cm.querySelectorAll('button').length < 2) return false; clickNext('#cmode button', 1); return true; }, 1],
    ['a new way of turning', () => { const s = $('mvStyle'); if (s) { const b = s.querySelector('button:not(.on)'); if (b) { b.click(); return true; } } const h = $('mvHead'); if (!h || h.closest('[hidden]')) return false; h.value = Math.floor(Math.random() * 360); h.dispatchEvent(new Event('input')); return true; }, 1],
    ...(cfg.extra || []).map(([n, fn, w]) => [n, fn, w || 1])];
  const act = kind => {
    if (undo) { try { undo(); } catch (e) { /* the scene moved on */ } undo = null; }
    let name = '';
    if (kind === 'drop') { pickButton('#palettes button'); if (cfg.drop) { const u = cfg.drop(); if (typeof u === 'function') undo = u; name = 'the chorus comes in: a big change'; } else { if (cfg.shape) cfg.shape(); name = 'the chorus comes in: a new shape and palette'; } }
    else if (kind === 'calm') { if (cfg.calm) cfg.calm(); else pickButton('#palettes button'); name = 'a quiet passage: easing off'; }
    else {
      const pool = ACTS.filter(a => a[0] !== lastAct); let tries = 0;
      while (tries++ < 8) { const tot = pool.reduce((s, a) => s + a[2], 0); let r = Math.random() * tot, a = pool[0]; for (const x of pool) { r -= x[2]; if (r <= 0) { a = x; break; } }
        if (a[1]() !== false) { lastAct = a[0]; name = a[0]; break; } pool.splice(pool.indexOf(a), 1); if (!pool.length) break; }
    }
    lastName = name; noteT = 0;
  };
  const status = () => {
    if (!playing()) { note.textContent = 'Running. Play a song under Music & sound (or Listen to a tab) and the scene will change with it.'; return; }
    const left = dir.barsLeft(), b = bpm();
    note.textContent = `Following the music${tempoLocked() && b ? ` at ${Math.round(b)} BPM` : ''}, ${intensity()}. ` + (left ? `Next change in ${left} bar${left > 1 ? 's' : ''}.` : 'Waiting for a steady beat (it changes about every 20 s meanwhile).') + (lastName ? ` Last: ${lastName}.` : '');
  };
  V.start = () => {
    if (V.on) return; V.on = true; home = where(); saved = new URLSearchParams(); MO.encode(saved);
    MO.decode(new URLSearchParams(cfg.preset || '')); if (cfg.start) cfg.start();
    const sp = MO.group.querySelector('#spin') || $('spin'); spinWas = sp ? sp.checked : null; if (sp && !sp.checked) { sp.checked = true; sp.dispatchEvent(new Event('change')); }   // Keep turning, while it runs
    if (intensity() === 'calm') { setIntensity('lively'); bumped = true; } else bumped = false;
    if (!inZen()) { enterZen(); zenned = true; } else zenned = false;
    btn.textContent = '■ Stop the visualizer'; btn.classList.add('on'); lastName = ''; lastAct = ''; t = 0; status(); claim();
  };
  V.stop = () => {
    if (!V.on) return; V.on = false;
    if (undo) { try { undo(); } catch (e) { /* gone */ } undo = null; }
    if (saved) MO.decode(saved); saved = null; if (cfg.stop) cfg.stop();
    const sp = MO.group.querySelector('#spin') || $('spin'); if (sp && spinWas !== null && sp.checked !== spinWas) { sp.checked = spinWas; sp.dispatchEvent(new Event('change')); }
    if (bumped && intensity() === 'lively') setIntensity('calm'); bumped = false;
    if (zenned && inZen()) exitZen(); zenned = false;
    btn.textContent = '▶ Visualizer'; btn.classList.remove('on'); note.textContent = idle; claim();
  };
  btn.addEventListener('click', () => (V.on ? V.stop() : V.start()));
  // the same button on the picture, next to Full screen (shared by the explorers: whichever is on screen takes it over)
  const stageBtn = $('vizStageBtn'), claim = () => { if (!stageBtn) return; stageBtn.hidden = false; stageBtn.onclick = () => (V.on ? V.stop() : V.start()); stageBtn.textContent = V.on ? '■ Stop visualizer' : '♫ Visualizer'; };
  let claimed = 0;
  V.step = (dt, go) => {
    if (stageBtn && (stageBtn.hidden || claimed++ % 30 === 0)) claim();
    if (!V.on) return; t += dt; noteT -= dt; if (noteT <= 0) { noteT = 0.5; status(); }
    if (!go) return;
    const h = gate.crossed(); if (h.kick && cfg.kick) cfg.kick(); if (h.snare && cfg.snare) cfg.snare();
    const ev = dir.step(dt); if (ev) act(ev);
  };
  // switching to another explorer stops it, putting everything back: at once, while this explorer's panel is still attached
  const where = () => (location.hash.match(/^#\/([a-z]+)/) || [])[1]; let home = null;
  window.addEventListener('hashchange', () => { if (V.on && where() !== home) V.stop(); });
  // the Learn topic: how the app hears a song, and what the Visualizer does with it
  const learn = document.querySelector('#g-learn .explain');
  if (learn) { const d = document.createElement('details'); d.className = 'topic';
    d.innerHTML = `<summary>Moving with music</summary>
      <p>Music is counting. Most songs count <strong>four beats to a bar</strong>, and group bars in fours and eights, so verses and choruses start on those boundaries. The app listens for the hits (kicks are low thumps, snares and claps sit higher), works out the <strong>tempo</strong> in beats per minute by finding how often the hits repeat, and finds where each bar begins. Motions then finish their cycles on bar lines, which is why they feel in time rather than merely fast.</p>
      <p>Play a song under <strong>Music &amp; sound</strong> (or <strong>Listen to a tab</strong> in desktop Chrome or Edge) and press <strong>♫ Visualizer</strong>. It goes full screen, sets everything moving and changes one thing every eight bars. When the chorus or a drop comes in, which it hears as a jump in loudness compared with the last ten seconds, it makes a bigger change. <strong>Intensity</strong> in the music panel sets how big the reactions are. To keep a video, start <strong>Record video</strong> first.</p>
      <div class="btns"><button class="btn" id="vizTry">Start the Visualizer</button></div>`;
    learn.appendChild(d); $('vizTry').addEventListener('click', () => V.start()); }
  MO.viz = V;
  return V;
}
