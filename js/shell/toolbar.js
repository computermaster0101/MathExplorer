// The buttons on the picture, as icons with names on hover (and on a long press on a touch screen): hide panel, full
// screen, reset view; play / pause and go (dive, fly, ride…); slower and faster; music and the Visualizer; help (?).
// Hidden with the rest of the row in full screen, so never in the Visualizer. Explorers say what Go is called right now
// (`goLabel()`, null to hide it) and what slower / faster move (`speedCtl()`: a range input's id, { id, invert } when a
// bigger number is slower, or { label, step(dir) }; null to hide them). The buttons press the same keys the keyboard does.
const $ = id => document.getElementById(id);
const app = $('app');
const svg = d => `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICON = {
  panel: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="15" y1="4" x2="15" y2="20"/>'),
  zen: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  play: svg('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  pause: svg('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>'),
  go: svg('<circle cx="12" cy="12" r="9"/><path d="M10 8l4 4-4 4"/>'),
  slower: svg('<line x1="6" y1="12" x2="18" y2="12"/>'),
  faster: svg('<line x1="6" y1="12" x2="18" y2="12"/><line x1="12" y1="6" x2="12" y2="18"/>'),
  music: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
};
/** Give a picture button its icon and name (shown on hover, read by screen readers). */
export function setTip(b, name) { b.setAttribute('aria-label', name); b.dataset.tip = name; }

const key = (k, extra) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));
let api = {};
/** The explorer on screen (main.js calls this on every switch). */
export function setToolbarExplorer(a) { api = a || {}; refresh(); }

// ---------- play / pause, go, slower / faster ----------
$('tbPlay').addEventListener('click', () => { key(' ', { code: 'Space' }); setTimeout(refresh, 60); });
$('tbGo').addEventListener('click', () => { key('g', { code: 'KeyG' }); setTimeout(refresh, 60); });
function speed(dir) {
  const c = api.speedCtl && api.speedCtl(); if (!c) return;
  if (typeof c === 'object' && c.step) { c.step(dir); return; }
  const id = typeof c === 'string' ? c : c.id, el = $(id); if (!el) return;
  if (c.invert) dir = -dir;
  const lo = +el.min, hi = +el.max, st = +el.step || 0.01, v = +el.value;
  // multiplying feels even across the range; a range through zero (Polytopes' 4D spin) steps by a tenth instead
  let n = lo < 0 ? v + dir * (hi - lo) / 10 : (dir > 0 ? v * 1.25 : v / 1.25);
  n = Math.min(hi, Math.max(lo, Math.round(n / st) * st)); el.value = n; el.dispatchEvent(new Event('input', { bubbles: true }));
}
$('tbSlower').addEventListener('click', () => speed(-1));
$('tbFaster').addEventListener('click', () => speed(1));
// what slower / faster change, in words: the slider's own label ("Dive speed", "Ride speed"…)
function speedName() {
  const c = api.speedCtl && api.speedCtl(); if (!c) return null;
  if (c.label) return c.label;
  const el = $(typeof c === 'string' ? c : c.id); if (!el) return null;
  const row = el.closest('.row'), s = row && row.querySelector('span');
  return s ? s.textContent.trim() : 'speed';
}

// ---------- the music menu (the Visualizer item is the explorer's own #vizStageBtn, which it shows and names) ----------
const musicBtn = $('musicBtn'), musicMenu = $('musicMenu');
export function toggleMusic(open = musicMenu.hidden) {
  if (open && app.classList.contains('zen')) return;
  musicMenu.hidden = !open; musicBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) { musicMenu.style.left = '0px'; const r = musicMenu.getBoundingClientRect(); if (r.right > innerWidth - 8) musicMenu.style.left = Math.round(innerWidth - 8 - r.right) + 'px'; }
}
musicBtn.addEventListener('click', () => toggleMusic());
musicMenu.addEventListener('click', e => { if (e.target.closest('[role=menuitem]')) toggleMusic(false); });
document.addEventListener('pointerdown', e => { if (!musicMenu.hidden && !e.target.closest('.musicWrap')) toggleMusic(false); });
musicMenu.addEventListener('keydown', e => { if (e.key === 'Escape') { toggleMusic(false); musicBtn.focus(); e.stopPropagation(); e.preventDefault(); } }, true);
$('tbMusicSet').addEventListener('click', () => {
  if (app.classList.contains('nopanel')) $('panelBtn').click();
  const g = $('g-sound'); if (g) { g.open = true; g.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
});

// ---------- keeping the buttons true to what's on screen ----------
function refresh() {
  const paused = !$('pausedTag').hidden;
  const play = $('tbPlay'); if (play.dataset.state !== String(paused)) { play.dataset.state = String(paused); play.innerHTML = paused ? ICON.play : ICON.pause; }
  setTip(play, paused ? 'Play (Space)' : 'Pause (Space)');
  const g = api.goLabel ? api.goLabel() : null, go = $('tbGo'); go.hidden = !g; if (g) setTip(go, g + ' (G)');
  const sn = speedName(); $('tbSlower').hidden = $('tbFaster').hidden = !sn;
  if (sn) { setTip($('tbSlower'), `Slower: ${sn}`); setTip($('tbFaster'), `Faster: ${sn}`); }
  $('tbSep2').hidden = !g && !sn;
  if (!musicMenu.hidden && app.classList.contains('zen')) toggleMusic(false);
}
setInterval(refresh, 400);

// ---------- names on a long press (touch screens have no hover) ----------
let pressT = null, pressed = null, pressedAt = 0;
const tipFor = b => { b.classList.add('tipShow'); setTimeout(() => b.classList.remove('tipShow'), 1600); };
$('stageBtns').addEventListener('pointerdown', e => { const b = e.target.closest('[data-tip]'); if (!b || e.pointerType !== 'touch') return;
  pressed = b; clearTimeout(pressT); pressT = setTimeout(() => { tipFor(b); pressedAt = performance.now(); }, 450); });
$('stageBtns').addEventListener('pointerup', () => clearTimeout(pressT));
$('stageBtns').addEventListener('pointercancel', () => clearTimeout(pressT));
// a long press only shows the name; it doesn't also press the button
$('stageBtns').addEventListener('click', e => { if (pressed && performance.now() - pressedAt < 700 && e.target.closest('[data-tip]') === pressed) { e.stopImmediatePropagation(); e.preventDefault(); } pressed = null; pressedAt = 0; }, true);

// the three shell buttons that were words
for (const [id, ic, name] of [['panelBtn', 'panel', 'Hide panel (H)'], ['zenBtn', 'zen', 'Full screen (F)'], ['resetBtn', 'reset', 'Reset view (R)']]) { const b = $(id); b.innerHTML = ICON[ic]; setTip(b, name); }
musicBtn.innerHTML = ICON.music; setTip(musicBtn, 'Music and the Visualizer');
$('tbGo').innerHTML = ICON.go; $('tbSlower').innerHTML = ICON.slower; $('tbFaster').innerHTML = ICON.faster;
setTip($('helpBtn'), 'Help: the tour, keys, Report a problem (?)');
refresh();
