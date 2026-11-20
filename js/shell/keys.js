// Keyboard shortcuts. The shell handles the keys every explorer shares; anything else goes to the explorer on screen.
import { togglePanel, toggleZen, exitZen, showKeys } from './layout.js';

let handler = () => false;
/** The active explorer's key handler: gets the keydown event, returns true when it used the key. */
export const setKeyHandler = fn => { handler = fn || (() => false); };

const SHARED = {
  h: () => togglePanel(),
  f: () => toggleZen(),
  Escape: () => exitZen(),
  e: () => document.querySelectorAll('details.grp:not([hidden])').forEach(g => { g.open = true; }),
  q: () => document.querySelectorAll('details.grp').forEach(g => { g.open = false; }),
  '?': () => showKeys(),
  '/': () => showKeys(),
};

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // leave keys alone while the user types; sliders keep their arrow keys, but Space still works on them
  const t = e.target, tag = (t.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
  if (tag === 'input' && !['checkbox', 'range', 'radio'].includes(t.type)) return;
  if (tag === 'input' && t.type === 'range' && e.key !== ' ') return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const shared = SHARED[k];
  const used = shared ? (shared(), true) : handler(e);
  if (used) e.preventDefault();
});
