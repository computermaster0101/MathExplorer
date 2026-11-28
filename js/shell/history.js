// Undo and redo for the view (design pack U14): the Undo / Redo buttons in the View group and Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y;
// ⌘ on a Mac). Every explorer keeps its view and settings in the address (route.js), so a step of history is an address:
// when the visitor starts doing something (a press or the wheel on the picture, a control in the panel, a key, a button on
// the picture) after a pause, the address as it is then is kept, and once things have been quiet for GAP ms, it becomes an
// undo step if the address has changed. So a drag, a slider pulled across or a key held down is one step, not hundreds.
// Only what the visitor does counts (trusted events): motion, the Visualizer and Slowly change never add steps. A new step
// clears redo; each explorer keeps its own last MAX steps for this visit. Going back opens the old address through
// 'mx:view' (main.js: the explorer's showView), so it brings back what a share link holds: the view and its settings, not a
// running simulation's cells or a drawing in progress. A pasted link in the same explorer is a step too.
import { parseRoute, activeExplorer } from './route.js';
import { modalOpen } from './a11y.js';
const $ = id => document.getElementById(id);
const MAX = 50, GAP = 800, WAIT = 4000;
const stacks = {};
const S = ex => stacks[ex] || (stacks[ex] = { undo: [], redo: [] });
const exOf = h => parseRoute(h).explorer;
const viewable = h => /^#\/[a-z]+\/./.test(h);   /* only addresses with a view code: showView needs one */
let pending = null, last = 0, timer = null;

// Some explorers write the new address only once the picture settles (Fractals after a drag's glide), so an address that
// hasn't changed yet is checked again for a few seconds (WAIT) before the step is given up.
function commit(final) {
  clearTimeout(timer); timer = null;
  const h = pending; if (!h) return;
  const now = location.hash, ex = exOf(now);
  if (exOf(h) !== ex || !viewable(h)) { pending = null; return; }
  if (h !== now) { pending = null; push(ex, h); return; }
  if (final || performance.now() - last > WAIT) pending = null; else timer = setTimeout(commit, 400);
}
function push(ex, h) {
  const s = S(ex); if (s.undo[s.undo.length - 1] !== h) s.undo.push(h);
  if (s.undo.length > MAX) s.undo.shift();
  s.redo.length = 0; paint();
}
/** Something the visitor did: keep the address from before it, unless it continues what they were already doing. */
function act(e) {
  if (!e.isTrusted || modalOpen()) return;
  const t = e.target, el = t && t.closest ? t : null;
  if (el && el.closest('#tbUndo, #tbRedo, #undoBar, #topBar, #helpMenu, #shareMenu, #musicMenu, #gallery, .tbHandle, #tbAll, #sheetBar, #consent, #tour, #tourTip')) return;
  const now = performance.now();
  if (pending && now - last > GAP) commit(true);
  if (!pending) pending = location.hash;
  last = now; clearTimeout(timer); timer = setTimeout(commit, GAP);
}
const onStage = e => e.target && e.target.closest && e.target.closest('#stage');
const inPanel = e => e.target && e.target.closest && e.target.closest('#panel');
document.addEventListener('pointerdown', e => { if (onStage(e)) act(e); }, true);
document.addEventListener('pointermove', e => { if (e.buttons && pending && onStage(e)) act(e); }, true);   /* a drag keeps its one step going */
document.addEventListener('wheel', e => { if (onStage(e)) act(e); }, { capture: true, passive: true });
document.addEventListener('input', e => { if (inPanel(e)) act(e); }, true);
document.addEventListener('change', e => { if (inPanel(e)) act(e); }, true);
document.addEventListener('click', e => { if (inPanel(e) && e.target.closest('button, a, label, [role], [data-pal], .swatch, canvas')) act(e); }, true);
// keys that change nothing in the view: the shell's own (panel, full screen, music, help) and moving round the page
const QUIET = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape', 'CapsLock', 'h', 'H', 'f', 'F', 'm', 'M', 'e', 'E', 'q', 'Q', '?', '/']);
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || QUIET.has(e.key) || /^F\d+$/.test(e.key)) return;
  const t = e.target; if (t && t.closest && t.closest('input[type=text], input[type=number], input[type=search], textarea, [contenteditable]')) return;   /* typing: its input events count instead */
  act(e);
}, true);

function go(h) { pending = null; clearTimeout(timer); paint(); window.dispatchEvent(new CustomEvent('mx:view', { detail: h })); }
/** One step back. Returns false when there's nothing to undo. */
export function undoView() {
  commit(true); const ex = activeExplorer(); if (!ex) return false;
  const s = S(ex), h = s.undo.pop(); if (!h) return false;
  if (location.hash !== h) s.redo.push(location.hash); go(h); return true;
}
/** One step forward again. */
export function redoView() {
  commit(true); const ex = activeExplorer(); if (!ex) return false;
  const s = S(ex), h = s.redo.pop(); if (!h) return false;
  s.undo.push(location.hash); go(h); return true;
}
/** Undo a reset (undo.js's bar): back to the address from before it, which is the last step if it has been kept. */
export function backTo(h) {
  commit(true); const ex = activeExplorer(); if (!ex || exOf(h) !== ex) return;
  const s = S(ex); if (s.undo[s.undo.length - 1] === h) s.undo.pop();
  if (location.hash !== h) s.redo.push(location.hash); go(h);
}

// a link pasted into the address bar, or back / forward, within the same explorer: the address it left is a step
window.addEventListener('hashchange', e => {
  pending = null; clearTimeout(timer);
  const was = '#' + (String(e.oldURL).split('#')[1] || ''), now = location.hash;
  if (exOf(was) === exOf(now) && viewable(was) && was !== now) push(exOf(now), was); else paint();
});

const mac = /Mac|iPhone|iPad/.test(navigator.platform || '');
const writing = t => t && t.closest && t.closest('input[type=text], input[type=number], input[type=search], textarea, [contenteditable]');
window.addEventListener('keydown', e => {
  if (!(mac ? e.metaKey : e.ctrlKey) || e.altKey || writing(e.target) || modalOpen()) return;   /* in a text box, Ctrl+Z undoes the typing */
  const k = e.key.toLowerCase(), redo = (k === 'z' && e.shiftKey) || (k === 'y' && !mac);
  if (k !== 'z' && !redo) return;
  e.preventDefault(); if (redo) redoView(); else undoView();
});

export const KEYS = mac ? { undo: '⌘Z', redo: '⇧⌘Z' } : { undo: 'Ctrl+Z', redo: 'Ctrl+Shift+Z' };
function paint() {
  const ex = activeExplorer(), s = ex ? S(ex) : { undo: [], redo: [] };
  const u = $('tbUndo'), r = $('tbRedo'); if (!u || !r) return;
  u.disabled = !s.undo.length; r.disabled = !s.redo.length;
}
$('tbUndo').addEventListener('click', () => undoView());
$('tbRedo').addEventListener('click', () => redoView());
// the explorer on screen changes without any of the above (a menu choice): show its own history
setInterval(paint, 500); paint();
