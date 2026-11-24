// Making a seamless loop (see js/common/seamless.js): frames the picture in the video's shape, steps the explorer frame by
// frame at exactly 1/30 s with every periodic motion rounded to whole turns, and writes each frame at its moment
// (js/common/video.js). Shared by the recorder in js/common/motion.js and Fractals' own (fractal/io/recorder.js).
import { LOOP, FPS, bestLength, describe } from './seamless.js';
import { videoWriter } from './video.js';

export const SHAPES = { screen: 0, wide: 16 / 9, tall: 9 / 16, square: 1 };
const even = x => Math.max(2, Math.round(x / 2) * 2);
/** The film's size: shape (SHAPES key) and res (0 = the screen's own size, or 720 / 1080 for the short side). */
export function filmSize(stage, shape, res) {
  const R = stage.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), a = SHAPES[shape] || R.width / Math.max(1, R.height);
  if (shape === 'screen' && !res) { const k = Math.min(1, 1920 / (R.width * dpr)); return [even(R.width * dpr * k), even(R.height * dpr * k)]; }
  const s = res || 1080; return a >= 1 ? [even(s * a), even(s)] : [even(s), even(s / a)];
}
const frameWait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const tick = () => new Promise(r => setTimeout(r, 0));

/**
 * Make one loop. o: stage (element holding the canvases), layers() (the canvases to draw, in order), bg() (the colour
 * behind them), loop ({ parts(), step(dt), begin?(), end?() }: see addRecorder), len (seconds, 0: best fit), shape, res,
 * onProgress(text), name (for the bar). Resolves to { blob, ext, L } or null when cancelled; throws on failure.
 */
export async function makeLoop(o) {
  const plan = o.loop.parts(), L = o.len || bestLength(plan.parts), N = L * FPS;
  const [W, H] = filmSize(o.stage, o.shape, o.res);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  // the picture takes the film's shape while the loop is made (only when the shape differs from the screen's)
  const R0 = o.stage.getBoundingClientRect(), framed = o.shape !== 'screen' && Math.abs(W / H - R0.width / R0.height) > 0.01, oldCss = o.stage.style.cssText;
  const bar = document.createElement('div'); bar.className = 'loopBar'; bar.setAttribute('role', 'status');
  bar.innerHTML = `<canvas class="loopPrev"></canvas><div class="loopTxt"></div><div class="loopTrack"><div class="loopFill"></div></div><button class="btn" type="button">Cancel</button>`;
  // a small live picture of the film: the framed picture can be bigger than the screen, so it may be out of sight
  const prev = bar.querySelector('.loopPrev'), pk = Math.min(96 / H, 128 / W); prev.width = Math.max(2, Math.round(W * pk)); prev.height = Math.max(2, Math.round(H * pk));
  const pg = prev.getContext('2d'), preview = () => pg.drawImage(cv, 0, 0, prev.width, prev.height);
  // a cover over the page, so a stray drag or click can't move the picture halfway through
  const cover = document.createElement('div'); cover.className = 'loopCover'; document.body.appendChild(cover); document.body.appendChild(bar);
  let cancelled = false; const cancel = () => { cancelled = true; };
  bar.querySelector('button').addEventListener('click', cancel);
  const keys = e => { e.stopPropagation(); e.preventDefault(); if (e.type === 'keydown' && e.key === 'Escape') cancel(); };
  window.addEventListener('keydown', keys, true); window.addEventListener('keyup', keys, true);
  const say = (i, extra) => { const t = `Making a ${L} s seamless loop, ${W}×${H}: frame ${i} of ${N}${extra || ''}`; bar.querySelector('.loopTxt').textContent = t;
    bar.querySelector('.loopFill').style.width = (100 * i / N).toFixed(1) + '%'; if (o.onProgress) o.onProgress(t); };
  const draw = () => { const R = o.stage.getBoundingClientRect(), kx = W / Math.max(1, R.width), ky = H / Math.max(1, R.height);
    g.fillStyle = (o.bg && o.bg()) || '#0b0d12'; g.fillRect(0, 0, W, H);
    for (const c of o.layers()) { const r = c.getBoundingClientRect(); try { g.drawImage(c, (r.left - R.left) * kx, (r.top - R.top) * ky, r.width * kx, r.height * ky); } catch (e) { /* a canvas that can't be read */ } } };
  let writer = null, mr = null;
  LOOP.on = true; LOOP.L = L;
  try {
    if (framed) { const e = Math.min(2, devicePixelRatio || 1);
      o.stage.style.cssText = oldCss + `;position:fixed;left:0;top:0;width:${W / e}px;height:${H / e}px;z-index:60;min-height:0`; o.stage.classList.add('framing'); }
    await frameWait();
    if (o.loop.begin) o.loop.begin(L, W, H);
    // frames drawn and thrown away until the picture has settled into its new shape (the 3D stages resize a frame or more
    // later, on a ResizeObserver, and a busy page can be slower), so frame 0 isn't drawn at the old size
    const fits = () => { const R = o.stage.getBoundingClientRect(), a = R.width / Math.max(1, R.height), cs = o.layers(); if (!cs.length) return true;
      const big = cs.reduce((m, c) => (c.width * c.height > m.width * m.height ? c : m)); return Math.abs(big.width / Math.max(1, big.height) - a) < 0.01 * a; };
    for (let k = 0; k < 2 || (k < 90 && !fits()); k++) { o.loop.step(0); await frameWait(); }
    say(0);
    writer = await videoWriter(W, H, FPS, H >= 1000 || W >= 1000 ? 12e6 : 7e6);
    if (writer) {
      for (let i = 0; i < N; i++) {
        if (cancelled) return null;
        o.loop.step(i ? 1 / FPS : 0); draw(); await writer.add(cv, i);
        if (i % 3 === 0) { say(i + 1); preview(); await tick(); }
      }
      say(N, ', finishing'); const blob = await writer.finish(); writer = null;
      return { blob, ext: blob.type === 'video/mp4' ? 'mp4' : 'webm', L, W, H };
    }
    // no WebCodecs (older Safari and Firefox): record in real time, a frame every 1/30 s, which stays seamless while the
    // picture can be drawn that fast
    const mime = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime || !cv.captureStream) throw new Error('This browser can\'t make video files from the page. Recent Chrome, Edge, Firefox and Safari can.');
    o.loop.step(0); draw();   // frame 0 drawn before the stream exists, so it's sent once (by requestFrame below)
    const stream = cv.captureStream(0), track = stream.getVideoTracks()[0], chunks = [];
    mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: H >= 1000 ? 12e6 : 7e6 }); mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(r => { mr.onstop = r; });
    mr.start(); let next = performance.now();
    for (let i = 0; i < N; i++) {
      if (cancelled) { mr.stop(); return null; }
      if (i) { o.loop.step(1 / FPS); draw(); }
      if (track.requestFrame) track.requestFrame();
      next += 1000 / FPS; const wait = next - performance.now(); await new Promise(r => setTimeout(r, Math.max(0, wait)));
      if (i % 3 === 0) { say(i + 1, ' (in real time: this browser can\'t write frames one by one)'); preview(); }
    }
    mr.stop(); await done; mr = null;
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    return { blob, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm', L, W, H };
  } finally {
    if (writer) writer.close();
    if (mr && mr.state !== 'inactive') try { mr.stop(); } catch (e) { /* stopped */ }
    LOOP.on = false;
    if (o.loop.end) try { o.loop.end(); } catch (e) { console.warn(e); }
    if (framed) { o.stage.style.cssText = oldCss; o.stage.classList.remove('framing'); }
    window.removeEventListener('keydown', keys, true); window.removeEventListener('keyup', keys, true);
    bar.remove(); cover.remove();
  }
}

/** The loop controls' markup (inside a Record video section; ids shared by every recorder). */
export const LOOP_HTML = `<div class="seg" id="recKind"><button data-k="live" class="on">As it plays</button><button data-k="loop">Seamless loop</button></div>`;
export const LOOP_OPTS_HTML = `<div id="recLoopSec" hidden>
  <div class="seg" id="recLoopLen" style="margin-top:6px"><button data-l="0" class="on">Best fit</button><button data-l="6">6 s</button><button data-l="12">12 s</button><button data-l="24">24 s</button></div>
  <div class="seg" id="recShape" style="margin-top:6px"><button data-a="screen" class="on">Screen</button><button data-a="wide">Wide</button><button data-a="tall">Tall</button><button data-a="square">Square</button></div></div>`;
/**
 * Wire the loop controls of a Record video section (#recKind, #recLoopSec, #recLen, #recRes, #recBtn, #recNote).
 * o: stage, layers(), bg(), loop (see makeLoop), save(blob, fileEnding), res() (the chosen size), sec (the section).
 * Returns { kind(), making(), make(), cancel(), label() }: the recorder calls make() when its button is pressed in loop mode.
 */
export function wireLoop(o) {
  // the elements are held, not looked up: the panel may be off the page (the explorer left) when a loop ends
  const root = o.sec, $ = id => root.querySelector('#' + id) || document.getElementById(id), btn = $('recBtn'), noteEl = $('recNote'), liveNote = noteEl.innerHTML;
  const S = { kind: 'live', len: 0, shape: 'screen', making: false };
  const seg = (id, fn) => { const el = $(id); el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || S.making) return; el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset); }); };
  const label = () => { if (S.making || btn.classList.contains('on')) return; btn.textContent = S.kind === 'loop' ? '● Make the loop' : '● Record'; btn.dataset.menu = S.kind === 'loop' ? '● Make a seamless loop' : '● Record video'; };
  // the note says what will loop, for how long and at what size, and what holds still
  const plan = () => { if (S.kind !== 'loop' || S.making) return; const P = o.loop.parts(), note = noteEl;
    if (P.block) { note.textContent = P.block; return; }
    if (!P.parts.some(p => p.rate)) { note.textContent = 'Nothing here is turning or cycling (is it paused?). Set something going round (turning, the colours’ Cycle speed, a breathe or a spin…) and it will be rounded to whole turns, so the end meets the start.'; return; }
    const L = S.len || bestLength(P.parts), [W, H] = filmSize(o.stage, S.shape, o.res());
    note.textContent = `A ${L} s loop, ${W}×${H}, that plays round and round without a seam. ${describe(P.parts, L)}.`
      + (P.held && P.held.length ? ` Held still while it’s made (they never come back to where they started): ${P.held.join(', ')}.` : '')
      + ' Each motion is rounded to whole turns in that time, so it may run a little faster or slower than on screen. No sound.'; };
  seg('recKind', d => { S.kind = d.k; $('recLen').hidden = S.kind === 'loop'; $('recLoopSec').hidden = S.kind !== 'loop'; if (S.kind === 'live') noteEl.innerHTML = liveNote; label(); plan(); });
  seg('recLoopLen', d => { S.len = +d.l; plan(); }); seg('recShape', d => { S.shape = d.a; plan(); });
  $('recRes').addEventListener('click', () => setTimeout(plan, 0));
  setInterval(() => { const g = o.sec.closest('details'); if (S.kind === 'loop' && o.sec.isConnected && !S.making && (!g || g.open)) plan(); }, 1200);
  const cancel = () => { const b = document.querySelector('.loopBar button'); if (b) b.click(); };
  const make = async () => {
    const P = o.loop.parts(); if (P.block || !P.parts.some(p => p.rate)) { plan(); return; }
    S.making = true; btn.textContent = '■ Cancel'; btn.dataset.stop = '■ Cancel the loop'; btn.classList.add('on');
    try { const r = await makeLoop({ stage: o.stage, layers: o.layers, bg: o.bg, loop: o.loop, len: S.len, shape: S.shape, res: o.res(), onProgress: t => { noteEl.textContent = t; } });
      if (r) o.save(r.blob, `-loop-${r.L}s`, r.ext); else noteEl.textContent = 'Cancelled.'; }
    catch (e) { console.warn(e); noteEl.textContent = 'The loop couldn’t be made here: ' + ((e && e.message) || e); }
    finally { S.making = false; btn.classList.remove('on'); delete btn.dataset.stop; label(); }
  };
  label();
  return { kind: () => S.kind, making: () => S.making, make, cancel, label };
}
