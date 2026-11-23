// Hide panel and full screen ("zen"), shared by every explorer.
const app = document.getElementById('app');
const $ = id => document.getElementById(id);

let onChange = () => {};
/** Called after the panel is shown or hidden, or full screen starts or ends, so the explorer can redraw. */
export const onLayoutChange = fn => { onChange = fn; };

export const panelHidden = () => app.classList.contains('nopanel');
export const inZen = () => app.classList.contains('zen');

export function togglePanel(hide = !panelHidden()) {
  app.classList.toggle('nopanel', hide);
  const pb = $('panelBtn'); pb.setAttribute('aria-label', hide ? 'Show panel (H)' : 'Hide panel (H)'); pb.dataset.tip = pb.getAttribute('aria-label');
  onChange();
}

let zenFS = false, zenTimer = null;
// in full screen the exit button and the pointer fade out until the pointer moves
function zenWake() {
  if (!inZen()) return;
  $('zenExit').classList.remove('fade'); app.classList.add('awake');
  clearTimeout(zenTimer);
  zenTimer = setTimeout(() => { $('zenExit').classList.add('fade'); app.classList.remove('awake'); }, 2500);
}

export function enterZen() {
  app.classList.add('zen'); zenWake(); showTip(); window.scrollTo(0, 0); zenFS = false;
  const el = document.documentElement;
  try { const r = el.requestFullscreen && el.requestFullscreen(); if (r && r.then) r.then(() => { zenFS = true; }).catch(() => {}); } catch (e) { /* not allowed here */ }
  onChange();
}

export function exitZen() {
  if (!inZen()) return;
  app.classList.remove('zen', 'awake'); clearTimeout(zenTimer);
  if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { /* already gone */ } }
  zenFS = false; onChange();
}

export const toggleZen = () => (inZen() ? exitZen() : enterZen());

/** Open the panel's "Keyboard shortcuts" group (id g-keys) and bring it into view. */
// ---------- the ? help menu (on the picture, with the other buttons; hidden in full screen with them) ----------
const helpBtn = $('helpBtn'), helpMenu = $('helpMenu');
const helpItems = () => [...helpMenu.querySelectorAll('[role=menuitem]')];
/** Open or close the ? menu (no argument: toggle). In full screen it stays shut, like every button on the picture. */
export function toggleHelp(open = helpMenu.hidden, focusFirst = false) {
  if (open && inZen()) return;
  helpMenu.hidden = !open; helpBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) { helpMenu.style.left = '0px'; const r = helpMenu.getBoundingClientRect(); if (r.right > innerWidth - 8) helpMenu.style.left = Math.round(innerWidth - 8 - r.right) + 'px'; }   /* keep it on screen */
  if (open && focusFirst) helpItems()[0].focus();
}
helpBtn.addEventListener('click', e => toggleHelp(undefined, e.detail === 0));   /* opened from the keyboard: focus the first item */
helpMenu.addEventListener('click', e => { if (e.target.closest('[role=menuitem]')) toggleHelp(false); });
document.addEventListener('pointerdown', e => { if (!helpMenu.hidden && !e.target.closest('.helpWrap')) toggleHelp(false); });
helpMenu.addEventListener('keydown', e => { const it = helpItems(), i = it.indexOf(document.activeElement);
  if (e.key === 'Escape') { toggleHelp(false); helpBtn.focus(); e.stopPropagation(); e.preventDefault(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { it[(i + (e.key === 'ArrowDown' ? 1 : -1) + it.length) % it.length].focus(); e.stopPropagation(); e.preventDefault(); } }, true);
new MutationObserver(() => { if (inZen() && !helpMenu.hidden) toggleHelp(false); }).observe(app, { attributes: true, attributeFilter: ['class'] });
$('keysBtn').addEventListener('click', () => showKeys());
export function showKeys() {
  if (panelHidden()) togglePanel(false);
  exitZen();
  const g = $('g-keys'); if (!g) return;
  g.open = true; g.scrollIntoView({ block: 'nearest' });
}

// ---------- touch gestures on the picture (phones and tablets) ----------
// A tap goes (as G does: dive, fly, ride, walk); during that, taps pause and resume it (as Space does), and where there is
// nothing to go on, a tap is Space. A double tap turns full screen on or off. Where tapping is the
// explorer's own way to play (a canvas marked data-own-taps: Growing Patterns' brush, Waves' splashes, a maze's step forward,
// drawing your own epicycles), its taps stay its own outside full screen; in full screen a tap is always the shell's. Pressing and holding still for a moment resets the view (as R does), anywhere. In full screen a
// quick swipe changes things: left / right the next / previous palette (V / C), up / down the next / previous shape (X / Z). Only quick, still, one-finger taps on the picture itself count: drags, pinches, buttons and
// the mouse are untouched. While a touch screen is in use, full screen shows nothing but the picture (no exit button, no
// Paused tag), so screenshots come out clean; a tip says how to get out, for a moment, on the way in.
let going = () => false;
/** The active explorer's "is it diving / flying / riding / walking now?" (main.js sets it), so a tap knows whether to go or to pause. */
export const setGoing = fn => { going = fn || (() => false); };
const key = (k, extra) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));   // true when nothing used it
function tapGo() {
  const paused = !$('pausedTag').hidden;
  if (!paused && !going() && !key('g', { code: 'KeyG' })) return;   // G started something
  key(' ', { code: 'Space' });   // already going, paused, or no G here: pause / resume
}
const stage = $('stage'), T = { down: null, n: 0, multi: false, last: 0, lastXY: null, timer: null, touch: 0 };
/** True just after a touch on the picture: explorers' own tap actions (fly to a spot, next room…) stand aside in full screen. */
export const touchTapping = () => performance.now() - (T.claim || 0) < 400;   // a tap the shell has taken (pause, full screen): explorers ignore it
/** True just after any touch: a double tap that the browser also reports as a double click shouldn't zoom as well. */
export const recentTouch = () => performance.now() - T.touch < 800;
const onPicture = e => e.target && e.target.tagName === 'CANVAS' && !e.target.closest('#insets');   /* the panels over the picture keep their own taps */
stage.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') { app.classList.remove('touch'); return; }
  app.classList.add('touch'); T.touch = performance.now();
  T.n++; if (T.n > 1) T.multi = true;
  if (T.n === 1) { T.multi = false; T.down = onPicture(e) ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; T.start = T.down && { ...T.down }; }
  clearTimeout(T.hold); if (T.down && !T.multi) T.hold = setTimeout(() => { if (!T.down || T.multi) return; T.down = null; clearTimeout(T.timer); T.last = 0;   // press and hold: reset
    try { navigator.vibrate && navigator.vibrate(15); } catch (er) { /* no buzz here */ } document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', bubbles: true })); }, 600);
}, true);
stage.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && T.down && Math.hypot(e.clientX - T.down.x, e.clientY - T.down.y) > 10) { clearTimeout(T.hold); T.down = null; } }, true);   // moving: a drag, not a press
const press = (key, shift) => document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: !!shift, bubbles: true }));
const lift = e => {
  if (e.pointerType !== 'touch') return; clearTimeout(T.hold); T.touch = performance.now(); T.n = Math.max(0, T.n - 1);
  // a swipe (full screen): deliberate, so dragging round the picture never counts: across at least 40% of the screen's
  // shorter side (and 140 px), in under 300 ms, and three times further one way than the other
  const g = T.start; if (T.n === 0) T.start = null;
  if (g && T.n === 0 && !T.multi && inZen() && e.type !== 'pointercancel') { const dx = e.clientX - g.x, dy = e.clientY - g.y, ax = Math.abs(dx), ay = Math.abs(dy);
    if (performance.now() - g.t < 300 && Math.max(ax, ay) > Math.max(140, 0.4 * Math.min(innerWidth, innerHeight)) && Math.max(ax, ay) > 3 * Math.min(ax, ay)) { T.down = null; T.last = 0; clearTimeout(T.timer);
      if (ax > ay) press(dx < 0 ? 'v' : 'c'); else press(dy < 0 ? 'x' : 'z'); return; } }
  const d = T.down; if (T.n > 0 || !d) return; T.down = null;
  if (T.multi || e.type === 'pointercancel' || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 300) return;
  const now = performance.now(), near = T.lastXY && Math.hypot(e.clientX - T.lastXY[0], e.clientY - T.lastXY[1]) < 40;
  const own = !inZen() && e.target && e.target.closest && e.target.closest('[data-own-taps]');
  if (!own) T.claim = now;
  if (now - T.last < 320 && near) { clearTimeout(T.timer); T.last = 0; toggleZen(); return; }   // double tap: full screen on or off
  T.last = now; T.lastXY = [e.clientX, e.clientY]; clearTimeout(T.timer);
  if (!own) T.timer = setTimeout(() => { T.last = 0; tapGo(); }, 320);   // one tap: go, or pause / resume
};
stage.addEventListener('pointerup', lift, true); stage.addEventListener('pointercancel', lift, true);
// the tip, shown for a moment on going full screen by touch
const tip = document.createElement('div'); tip.id = 'zenTip'; tip.textContent = 'Tap: go / pause · double-tap: leave full screen · hold: start afresh · swipe ↔ colours, ↕ shape'; stage.appendChild(tip);
let tipT = null;
const showTip = () => { if (!app.classList.contains('touch')) return; tip.classList.add('on'); clearTimeout(tipT); tipT = setTimeout(() => tip.classList.remove('on'), 2200); };
$('panelBtn').addEventListener('click', () => togglePanel());
$('zenBtn').addEventListener('click', enterZen);
$('zenExit').addEventListener('click', exitZen);
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && zenFS) exitZen(); });
for (const ev of ['pointermove', 'pointerdown', 'touchstart']) document.addEventListener(ev, zenWake, { passive: true });
