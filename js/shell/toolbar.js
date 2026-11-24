// The buttons on the picture, as icons with names on hover (and on a long press on a touch screen), in four groups:
//   View    hide panel, full screen, reset view                         (folds away)
//   Player  back (zoom out), slower, play / pause, faster, forward (zoom in), laid out like a music player
//   Go      go (dive, fly, ride…), then steer itself and the explorer's own button   (the extras fold away)
//   More    music (♫ menu), share (⇪ menu), help (?)                    (folds away)
// Folded groups show one icon; the choice is remembered on this device, and phones start with them folded. The whole row
// is hidden in full screen, so never in the Visualizer. Explorers say what Go is called right now (`goLabel()`, null to
// hide it), what slower / faster move (`speedCtl()`: a range input's id, { id, invert } when a bigger number is slower,
// or { label, step(dir) }; null to hide them), whether it can zoom (`canZoom()`), what steers itself (`autoCtl()`) and one
// button of its own (`extraCtl()`). The buttons press the same keys the keyboard does, or the panel's own buttons.
import { track } from './analytics.js';
const $ = id => document.getElementById(id);
const app = $('app');
const svg = d => `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICON = {
  panel: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="15" y1="4" x2="15" y2="20"/>'),
  zen: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  view: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 19v2M16 19v2M7 10h4M7 14h7"/>'),
  play: svg('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  pause: svg('<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>'),
  slower: svg('<path d="M11 6l-7 6 7 6z" fill="currentColor"/><path d="M20 6l-7 6 7 6z" fill="currentColor"/>'),
  faster: svg('<path d="M13 6l7 6-7 6z" fill="currentColor"/><path d="M4 6l7 6-7 6z" fill="currentColor"/>'),
  zoomOut: svg('<circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/><line x1="7.5" y1="10.5" x2="13.5" y2="10.5"/>'),
  zoomIn: svg('<circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/><line x1="7.5" y1="10.5" x2="13.5" y2="10.5"/><line x1="10.5" y1="7.5" x2="10.5" y2="13.5"/>'),
  go: svg('<circle cx="12" cy="12" r="9"/><path d="M10 8l4 4-4 4"/>'),
  julia: svg('<path d="M12 12c1.5-2.5 5-2 5.5 .5s-2 4.5-5 4-4.5-3-3-6 6-4.5 9-2"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
  back: svg('<path d="M9 14l-5-5 5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  steer: svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>'),
  music: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  share: svg('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><line x1="8.2" y1="10.8" x2="15.8" y2="6.2"/><line x1="8.2" y1="13.2" x2="15.8" y2="17.8"/>'),
  more: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>'),
  open: svg('<path d="M9 6l6 6-6 6"/>'),
  fold: svg('<path d="M15 6l-6 6 6 6"/>'),
};
/** Give a picture button its icon and name (shown on hover, read by screen readers). */
export function setTip(b, name) { b.setAttribute('aria-label', name); b.dataset.tip = name; }

const key = (k, extra) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));
// press one of the explorer's own panel buttons (the Save, share & record group); analytics counts it once, as a toolbar press
const press = el => { if (!el) return; window.__tbClick = true; try { el.click(); } finally { window.__tbClick = false; } };
let api = {};
/** The explorer on screen (main.js calls this on every switch). */
export function setToolbarExplorer(a) { api = a || {}; refresh(); }

// ---------- folding groups ----------
const GKEY = 'mathexplorer.tbGroups', small = () => matchMedia('(pointer: coarse)').matches || innerWidth < 640;
let folded = {}; try { folded = JSON.parse(localStorage.getItem(GKEY) || 'null') || {}; } catch (e) { folded = {}; }
const isFolded = g => g in folded ? folded[g] : small();   // phones start folded, big screens open, until you choose
const GROUP = {
  view: { icon: 'view', name: 'View: hide panel, full screen, reset view' },
  go: { icon: 'open', name: 'More ways to move: steer itself and more' },
  more: { icon: 'more', name: 'More: music, share, help' },
};
function paintGroup(g) {
  const el = document.querySelector(`.tbGroup[data-group="${g}"]`), h = el.querySelector('.tbHandle'), f = isFolded(g);
  el.classList.toggle('folded', f); h.setAttribute('aria-expanded', f ? 'false' : 'true');
  const want = f ? GROUP[g].icon : 'fold'; if (h.dataset.icon !== want) { h.dataset.icon = want; h.innerHTML = ICON[want]; }
  setTip(h, f ? GROUP[g].name : 'Fold these away');
}
/** Open or fold a group (no argument: the other way); `keep` false doesn't remember it (opened for a moment by a key). */
export function setFolded(g, f = !isFolded(g), keep = true) { if (keep) { folded[g] = f; try { localStorage.setItem(GKEY, JSON.stringify(folded)); } catch (e) { /* not remembered */ } } else folded[g] = f; paintGroup(g); }
for (const h of document.querySelectorAll('.tbHandle')) h.addEventListener('click', () => setFolded(h.dataset.group));

// ---------- the player: back (zoom out), slower, play / pause, faster, forward (zoom in) ----------
$('tbPlay').addEventListener('click', () => { key(' ', { code: 'Space' }); setTimeout(refresh, 60); });
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
// zoom out / in: the same as the scroll wheel over the middle of the picture (every explorer zooms with the wheel, so this
// does whatever zooming means there); a click is one step, holding keeps zooming smoothly
function wheelAtMiddle(dy) {
  const r = $('stage').getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const el = document.elementFromPoint(x, y); if (!el || !el.closest('#stage') || el.closest('#stageBtns')) return;
  el.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, deltaMode: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
}
for (const [id, dir] of [['tbOut', 1], ['tbIn', -1]]) {
  const b = $(id); let rep = null, held = false;
  b.addEventListener('pointerdown', e => { if (e.button) return; held = false; clearInterval(rep); rep = setTimeout(() => { held = true; rep = setInterval(() => wheelAtMiddle(dir * 30), 40); }, 300); });
  const stop = () => { clearTimeout(rep); clearInterval(rep); rep = null; };
  b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
  b.addEventListener('click', () => { if (!held) wheelAtMiddle(dir * 240); held = false; });   /* a click (or Enter) is one wheel notch-and-a-half */
}

// ---------- go, steer itself, the explorer's own button ----------
$('tbGo').addEventListener('click', () => { key('g', { code: 'KeyG' }); setTimeout(refresh, 60); });
$('tbSteer').addEventListener('click', () => { key('t', { code: 'KeyT' }); setTimeout(refresh, 60); });
$('tbExtra').addEventListener('click', () => { const x = api.extraCtl && api.extraCtl(); if (x) x.run(); setTimeout(refresh, 60); });

// ---------- the ♫ and ⇪ menus ----------
function menu(btnId, menuId, wrapSel) {
  const btn = $(btnId), m = $(menuId);
  const toggle = (open = m.hidden) => {
    if (open && app.classList.contains('zen')) return;
    m.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { m.style.left = '0px'; const r = m.getBoundingClientRect(); if (r.right > innerWidth - 8) m.style.left = Math.round(innerWidth - 8 - r.right) + 'px'; }
  };
  btn.addEventListener('click', () => toggle());
  m.addEventListener('click', e => { if (e.target.closest('[role=menuitem]')) toggle(false); });
  document.addEventListener('pointerdown', e => { if (!m.hidden && !e.target.closest(wrapSel)) toggle(false); });
  m.addEventListener('keydown', e => { if (e.key === 'Escape') { toggle(false); btn.focus(); e.stopPropagation(); e.preventDefault(); } }, true);
  return toggle;
}
export const toggleMusic = menu('musicBtn', 'musicMenu', '.musicWrap');
const toggleShare = menu('tbShare', 'shareMenu', '.shareWrap');
// ♫: the Visualizer item is the explorer's own #vizStageBtn, which it shows and names
$('tbMusicSet').addEventListener('click', () => {
  if (app.classList.contains('nopanel')) $('panelBtn').click();
  const g = $('g-sound'); if (g) { g.open = true; g.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
});
// ⇪: copy the link (the address always holds this view, colours included), the system share sheet, and the panel's
// own Save picture, Record video and 3D print buttons (so their settings stay in the panel)
const say = t => { const b = $('tbShare'), was = b.dataset.tip; b.dataset.tip = t; b.classList.add('tipShow'); setTimeout(() => { b.classList.remove('tipShow'); b.dataset.tip = was; }, 1800); };
$('shCopy').addEventListener('click', async () => {
  const url = location.href; let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch (e) {
    try { const t = document.createElement('textarea'); t.value = url; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch (e2) { /* nothing to copy with */ } }
  say(ok ? 'Link copied: it opens exactly this view' : 'Copy the address from the address bar to share this view'); if (ok) track('share_link', { via: 'copy' });
});
$('shSheet').addEventListener('click', async () => { try { await navigator.share({ title: document.title, text: 'Look at this in Math Explorer', url: location.href }); track('share_link', { via: 'share_sheet' }); } catch (e) { /* closed without sharing */ } });
const PRINT = ['prBtn', 'export'], printBtn = () => PRINT.map($).find(b => b && !b.closest('[hidden]') && !b.disabled);
$('shSnap').addEventListener('click', () => press($('snap')));
$('shRec').addEventListener('click', () => press($('recBtn')));
$('shPrint').addEventListener('click', () => press(printBtn()));

// ---------- which buttons get used: one event per press, the button's name and the explorer, nothing else ----------
const NAMES = { panelBtn: 'panel', zenBtn: 'fullscreen', resetBtn: 'reset', tbPlay: 'play_pause', tbGo: 'go', tbSteer: 'steer', tbExtra: 'explorer_button', tbOut: 'zoom_out', tbIn: 'zoom_in',
  tbSlower: 'slower', tbFaster: 'faster', musicBtn: 'music_menu', tbMusicSet: 'music_settings', vizStageBtn: 'visualizer', tbShare: 'share_menu', shCopy: 'copy_link', shSheet: 'share_sheet',
  shSnap: 'snapshot', shRec: 'record', shPrint: 'print_3d', helpBtn: 'help_menu', tourAgain: 'tour', aboutThis: 'about', keysBtn: 'keys', reportBtn: 'report', privacyBtn: 'privacy', ghMenu: 'github' };
$('stageBtns').addEventListener('click', e => { const b = e.target.closest('button, a'); if (!b) return;
  const ex = app.dataset.explorer || '';
  if (b.classList.contains('tbHandle')) { track('toolbar', { button: 'group_' + b.dataset.group, detail: isFolded(b.dataset.group) ? 'open' : 'fold', explorer: ex }); return; }
  if (!NAMES[b.id]) return;
  const p = { button: NAMES[b.id], explorer: ex }; if (b.id === 'tbExtra' && b.dataset.icon) p.detail = b.dataset.icon;
  track('toolbar', p); }, true);

// ---------- keeping the buttons true to what's on screen ----------
function refresh() {
  /* the play icon while paused, and while nothing is moving (the explorer's moving(), where it has one): Space would then start the main motion */
  const paused = !$('pausedTag').hidden || !!(api.moving && !api.moving());
  const play = $('tbPlay'); if (play.dataset.state !== String(paused)) { play.dataset.state = String(paused); play.innerHTML = paused ? ICON.play : ICON.pause; }
  setTip(play, paused ? 'Play (Space)' : 'Pause (Space)');
  const sn = speedName(); $('tbSlower').hidden = $('tbFaster').hidden = !sn;
  if (sn) { setTip($('tbSlower'), `Slower: ${sn}`); setTip($('tbFaster'), `Faster: ${sn}`); }
  const z = !api.canZoom || api.canZoom(); for (const e of document.querySelectorAll('.tbZoom')) e.hidden = !z;
  const g = api.goLabel ? api.goLabel() : null, go = $('tbGo'); go.hidden = !g; if (g) setTip(go, g + ' (G)');
  const a = api.autoCtl ? api.autoCtl() : null, sb = $('tbSteer'); sb.hidden = !a;
  if (a) { setTip(sb, a.label + (a.on ? ': on' : a.on === false ? ': off' : '') + ' (T)'); sb.classList.toggle('on', !!a.on); sb.setAttribute('aria-pressed', a.on ? 'true' : 'false'); }
  const x = api.extraCtl ? api.extraCtl() : null, xb = $('tbExtra'); xb.hidden = !x;
  if (x) { setTip(xb, x.label); xb.classList.toggle('on', !!x.on); xb.setAttribute('aria-pressed', x.on ? 'true' : 'false'); if (xb.dataset.icon !== x.icon) { xb.dataset.icon = x.icon; xb.innerHTML = ICON[x.icon] || ICON.go; } }
  // the Go group: its fold handle only when there's something to fold; the whole group only when there's anything at all
  const goGroup = document.querySelector('.tbGroup[data-group="go"]'), extras = !!a || !!x;
  goGroup.querySelector('.tbHandle').hidden = !extras; goGroup.hidden = !g && !extras;
  if (!g && extras && isFolded('go')) setFolded('go', false, false);   /* nothing else to show: open it */
  // the share menu: share sheet where the browser has one; print where this view can be printed; recording shows a dot
  $('shSheet').hidden = !navigator.share; $('shPrint').hidden = !printBtn();
  const rec = $('recBtn') && $('recBtn').classList.contains('on'); $('tbShare').classList.toggle('rec', !!rec);
  $('shRec').textContent = rec ? ($('recBtn').dataset.stop || '■ Stop recording') : ($('recBtn') && $('recBtn').dataset.menu) || '● Record video';   /* the panel says which kind: as it plays, or a seamless loop */
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

// icons and names
for (const [id, ic, name] of [['panelBtn', 'panel', 'Hide panel (H)'], ['zenBtn', 'zen', 'Full screen (F)'], ['resetBtn', 'reset', 'Reset view (R)'], ['musicBtn', 'music', 'Music and the Visualizer'],
  ['tbShare', 'share', 'Share, save or record this view'], ['tbSteer', 'steer', 'Steer'], ['tbGo', 'go', 'Go'], ['tbSlower', 'slower', 'Slower'], ['tbFaster', 'faster', 'Faster'],
  ['tbOut', 'zoomOut', 'Zoom out: back (−, or the wheel)'], ['tbIn', 'zoomIn', 'Zoom in: forwards (+, or the wheel)']]) { const b = $(id); b.innerHTML = ICON[ic]; setTip(b, name); }
setTip($('helpBtn'), 'Help: the tour, keys, Report a problem (?)');
for (const g of Object.keys(GROUP)) paintGroup(g);
refresh();
