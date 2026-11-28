// Undo for a reset (design pack U06): pressing R, the Reset button or holding a finger on the picture puts the view back
// to its start, and a bar says so with an Undo button for a few seconds. Undo opens the view code the address held just
// before (main.js listens for 'mx:view' and hands it to the explorer's showView), so it brings back what a share link
// would: the view and its settings, not a running simulation's cells or a drawing in progress. It goes through history.js,
// so the reset can be redone (Redo) and the step it was isn't left behind in Undo.
import { backTo } from './history.js';
const $ = id => document.getElementById(id);
let bar = null, timer = null;
/** Show "<text> · Undo" for a few seconds; Undo calls back(). */
export function offerUndo(text, back) {
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'undoBar'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span></span><button type="button" class="sbtn on" id="undoBtn">Undo</button><button type="button" class="sbtn" id="undoX" aria-label="Close">✕</button>';
    $('stage').appendChild(bar);
    bar.querySelector('#undoX').addEventListener('click', hide);
  }
  bar.querySelector('span').textContent = text;
  bar.querySelector('#undoBtn').onclick = () => { hide(); back(); };
  bar.hidden = false; clearTimeout(timer); timer = setTimeout(hide, 6000);
}
function hide() { clearTimeout(timer); if (bar) bar.hidden = true; }
window.addEventListener('hashchange', hide);   // a new explorer or a pasted link: nothing to undo here any more

/** Run a reset (fn) and offer to undo it: the view comes back from the address as it was. */
export function resetWithUndo(fn) {
  const before = location.hash, used = fn();
  if (used !== false && /^#\/[a-z]+\/./.test(before)) offerUndo('View reset', () => backTo(before));
  return used;
}
