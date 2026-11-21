// Keyboard shortcuts. The shell handles the keys every explorer shares; anything else goes to the explorer on screen.
// The driving keys (arrows and W A S D, with Shift for faster) aren't one-off shortcuts: they're held, and each explorer reads
// drive() every frame, so movement is smooth for as long as a key is down instead of stepping at the keyboard's repeat rate.
import { togglePanel, toggleZen, exitZen, showKeys } from './layout.js';
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
  '?': () => showKeys(),
  '/': () => showKeys(),
};

// ---------- held keys for driving ----------
const DRIVE = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd']);
const held = new Set();
let lastDrive = -1e9;
const release = () => held.clear();
window.addEventListener('blur', release);
document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });

/** Shared keyboard settings, remembered in this browser. invertY: ↑ ↓ work like an aeroplane (up tips the view down). */
export const keyPrefs = { invertY: false };
try { keyPrefs.invertY = localStorage.getItem('mathexplorer.invertY') === '1'; } catch (e) { /* storage blocked: default */ }
// every explorer's Keyboard shortcuts group has an "Invert up / down" box with this id (only one panel is attached at a time)
document.addEventListener('change', e => {
  if (e.target && e.target.id === 'invertY') {
    keyPrefs.invertY = e.target.checked;
    try { localStorage.setItem('mathexplorer.invertY', keyPrefs.invertY ? '1' : '0'); } catch (err) { /* not saved */ }
  }
});
/** Tick the invert box in a freshly attached panel to match the saved setting. */
export const syncKeyPrefs = root => { const c = root.querySelector('#invertY'); if (c) c.checked = keyPrefs.invertY; };

/**
 * The driving keys held right now, each −1, 0 or 1. turnX/turnY: arrows (turnY follows the invert setting; rawY doesn't).
 * slideX/slideY: D−A and W−S. fast: Shift. any: something is held. recent: driven in the last 1.5 s.
 */
export function drive() {
  const h = k => (held.has(k) ? 1 : 0), up = h('ArrowUp') - h('ArrowDown');
  const any = h('ArrowUp') + h('ArrowDown') + h('ArrowLeft') + h('ArrowRight') + h('w') + h('a') + h('s') + h('d') > 0;
  if (any) lastDrive = performance.now();
  return { turnX: h('ArrowRight') - h('ArrowLeft'), turnY: keyPrefs.invertY ? -up : up, rawY: up,
    slideX: h('d') - h('a'), slideY: h('w') - h('s'), fast: held.has('Shift'), any, recent: performance.now() - lastDrive < 1500 };
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
