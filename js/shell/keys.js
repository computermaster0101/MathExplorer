// Keyboard shortcuts. The shell handles the keys every explorer shares; anything else goes to the explorer on screen.
// The driving keys (arrows and W A S D, with Shift for faster) aren't one-off shortcuts: they're held, and each explorer reads
// drive() every frame, so movement is smooth for as long as a key is down instead of stepping at the keyboard's repeat rate.
import { togglePanel, toggleZen, exitZen, toggleHelp } from './layout.js';
import { toggle as toggleMusic } from './audio/engine.js';

let handler = () => false;
/** The active explorer's key handler: gets the keydown event, returns true when it used the key. */
export const setKeyHandler = fn => { handler = fn || (() => false); };

const SHARED = {
  h: () => togglePanel(),
  m: () => toggleMusic(),
  f: () => toggleZen(),
  Escape: () => exitZen(),
  e: () => document.querySelectorAll('details.grp:not([hidden])').forEach(g => { g.open = true; }),
  q: () => document.querySelectorAll('details.grp').forEach(g => { g.open = false; }),
  '?': () => toggleHelp(undefined, true),   // the help menu (shut in full screen)
  '/': () => toggleHelp(undefined, true),
};

// ---------- held keys for driving ----------
const DRIVE = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd']);
const held = new Set();
let lastDrive = -1e9;
const release = () => held.clear();
window.addEventListener('blur', release);
document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });

/**
 * Shared keyboard settings, remembered in this browser. invertY: ↑ ↓ work like an aeroplane (up tips the view down).
 * navSpeed: how fast the driving keys turn and slide, as a multiple of the explorers' base speeds (0.1–2, default 0.5).
 */
export const keyPrefs = { invertY: false, navSpeed: 0.5 };
try { keyPrefs.invertY = localStorage.getItem('mathexplorer.invertY') === '1';
  const n = parseFloat(localStorage.getItem('mathexplorer.navSpeed')); if (n >= 0.1 && n <= 2) keyPrefs.navSpeed = n; } catch (e) { /* storage blocked: defaults */ }
const showNav = root => { const o = root.querySelector('#navSpeedo'); if (o) o.textContent = keyPrefs.navSpeed.toFixed(2) + '×'; };
// every explorer's Keyboard shortcuts group has these controls with these ids (only one panel is attached at a time)
document.addEventListener('change', e => {
  if (e.target && e.target.id === 'invertY') {
    keyPrefs.invertY = e.target.checked;
    try { localStorage.setItem('mathexplorer.invertY', keyPrefs.invertY ? '1' : '0'); } catch (err) { /* not saved */ }
  }
});
document.addEventListener('input', e => {
  if (e.target && e.target.id === 'navSpeed') {
    keyPrefs.navSpeed = Math.min(2, Math.max(0.1, +e.target.value)); showNav(document);
    try { localStorage.setItem('mathexplorer.navSpeed', String(keyPrefs.navSpeed)); } catch (err) { /* not saved */ }
  }
});
/** Set the keyboard controls in a freshly attached panel to match the saved settings. */
export const syncKeyPrefs = root => { const c = root.querySelector('#invertY'); if (c) c.checked = keyPrefs.invertY;
  const s = root.querySelector('#navSpeed'); if (s) s.value = keyPrefs.navSpeed; showNav(root); };

// Each axis eases toward the keys over about a fifth of a second, so a quick tap is a small nudge and letting go glides to a stop.
const sm = { turnX: 0, turnY: 0, rawY: 0, slideX: 0, slideY: 0 };
let smT = performance.now();
/**
 * The driving keys, smoothed: each axis runs −1…1. turnX/turnY: arrows (turnY follows the invert setting; rawY doesn't).
 * slideX/slideY: D−A and W−S. fast: Shift. scale: the Navigation speed setting (explorers multiply their speeds by it).
 * any: something is held or still gliding to a stop. recent: driven in the last 1.5 s. Call it once per frame.
 */
export function drive() {
  const now = performance.now(), dt = Math.min(0.1, (now - smT) / 1000); smT = now;
  const h = k => (held.has(k) ? 1 : 0), up = h('ArrowUp') - h('ArrowDown');
  const target = { turnX: h('ArrowRight') - h('ArrowLeft'), turnY: keyPrefs.invertY ? -up : up, rawY: up, slideX: h('d') - h('a'), slideY: h('w') - h('s') };
  const pressed = Object.values(target).some(v => v !== 0), a = 1 - Math.exp(-dt / 0.18);
  let moving = false;
  for (const k in sm) { sm[k] += (target[k] - sm[k]) * a; if (Math.abs(sm[k]) < 0.01 && !target[k]) sm[k] = 0; if (sm[k]) moving = true; }
  if (pressed) lastDrive = now;
  return { ...sm, fast: held.has('Shift'), scale: keyPrefs.navSpeed, any: moving, recent: now - lastDrive < 1500 };
}

// ---------- "Paused" tag on the stage (Space) ----------
const pausedTag = document.getElementById('pausedTag');
let pausedShown = false;
/** Show or hide the "Paused · Space to resume" tag. Explorers call this every frame with their own pause state. */
export function setPausedTag(on) { if (on === pausedShown || !pausedTag) return; pausedShown = on; pausedTag.hidden = !on; }

// ---------- dispatch ----------
const typing = t => {
  const tag = (t.tagName || '').toLowerCase();
  return tag === 'textarea' || tag === 'select' || t.isContentEditable || (tag === 'input' && !['checkbox', 'range', 'radio', 'button'].includes(t.type));
};
let spaceUsed = false;
document.addEventListener('keydown', e => {
  if (e.key === 'Shift') { held.add('Shift'); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target, tag = (t.tagName || '').toLowerCase();
  if (typing(t)) return;   // leave keys alone while the user types
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (DRIVE.has(k)) {
    // a focused slider keeps its arrow keys (tab to it to use them); everywhere else they drive
    if (tag === 'input' && t.type === 'range' && k.startsWith('Arrow')) return;
    held.add(k); e.preventDefault(); return;
  }
  if (tag === 'input' && t.type === 'range' && e.key !== ' ') return;
  if ((k === ' ' || k === 'g') && e.repeat) { e.preventDefault(); return; }   // holding Space (or G) mustn't flip it on and off
  const shared = SHARED[k];
  const used = shared ? (shared(), true) : handler(e);
  if (used) e.preventDefault();
  if (k === ' ') spaceUsed = used;
});
document.addEventListener('keyup', e => {
  if (e.key === 'Shift') { held.delete('Shift'); return; }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  held.delete(k);
  // a focused button or checkbox would also "click" when Space comes back up: we already used it, so stop that
  if (k === ' ' && spaceUsed) { e.preventDefault(); spaceUsed = false; }
});
// after a mouse or touch click, buttons, checkboxes and sliders let go of keyboard focus, so Space and the driving keys
// reach the explorer instead of pressing the last thing clicked (keyboard users who tab to a control keep its focus)
document.addEventListener('pointerup', e => {
  if (!e.target.closest || !e.target.closest('button, label, input[type=checkbox], input[type=radio], input[type=range]')) return;
  setTimeout(() => { const a = document.activeElement; if (a && a !== document.body && a.matches('button, input[type=checkbox], input[type=radio], input[type=range]')) a.blur(); }, 0);
});
