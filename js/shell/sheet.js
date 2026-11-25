// Phones (the 2026 layout): the panel is a sheet along the bottom of the screen. Folded, it's a row of four tabs (Shapes, Colours,
// Music, Settings); a tab opens the sheet on that part of the panel, the open tab again (or the arrow) folds it. Nothing is moved
// or rebuilt: the tabs only choose which of the panel's own groups show (the CSS in app.css, by aside[data-tab]), so every
// explorer's panel works unchanged:
//   Shapes    the mode row (Fractals, Polytopes) and the Shapes group     Colours  Colour & style
//   Music     Music & sound                                               Settings everything else, in the usual order, as groups
// The single-group tabs show their group open with its title hidden. On bigger screens none of this applies and the panel is
// the side panel as before. revealGroup(g) brings a group into view either way (Keyboard shortcuts, Music settings, the tour).
import { track } from './analytics.js';
const $ = id => document.getElementById(id);
const app = $('app'), panel = $('panel');
const SHEET_Q = '(max-width: 820px), (max-height: 500px) and (pointer: coarse)';   /* phones, upright or sideways (the same query as the CSS) */
export const sheetMode = () => matchMedia(SHEET_Q).matches;
const TABS = [['shapes', 'Shapes', '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>'],
  ['colours', 'Colours', '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="9.5" r="1.3" fill="currentColor"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="9.5" r="1.3" fill="currentColor"/><path d="M12 21a3 3 0 0 1 0-6h1.5a2.5 2.5 0 0 0 0-5"/>'],
  ['music', 'Music', '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'],
  ['settings', 'Settings', '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="9" cy="7" r="2.5" fill="var(--panel)"/><circle cx="15" cy="17" r="2.5" fill="var(--panel)"/>']];
const ONE = { shapes: 'g-shapes', colours: 'g-style', music: 'g-sound' };   // the tabs that show one group, open
const TKEY = 'mathexplorer.sheetTab';
let tab = 'shapes'; try { tab = localStorage.getItem(TKEY) || 'shapes'; } catch (e) { /* first tab */ }
if (!TABS.some(t => t[0] === tab)) tab = 'shapes';

const bar = document.createElement('div'); bar.id = 'sheetBar'; bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'Panel');
bar.innerHTML = TABS.map(([k, n, d]) => `<button type="button" role="tab" class="shTab" data-tab="${k}" aria-selected="false" aria-controls="panel"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg><span>${n}</span></button>`).join('')
  + '<button type="button" class="shFold" id="sheetFold" aria-expanded="false" aria-label="Open the panel"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg></button>';
panel.prepend(bar);

const isOpen = () => app.classList.contains('sheetOpen');
function paint() {
  panel.dataset.tab = tab;
  for (const b of bar.querySelectorAll('.shTab')) { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', on && isOpen() ? 'true' : 'false'); b.classList.toggle('on', on && isOpen()); }
  const f = $('sheetFold'); f.setAttribute('aria-expanded', isOpen() ? 'true' : 'false'); f.setAttribute('aria-label', isOpen() ? 'Fold the panel away' : 'Open the panel');
  const g = ONE[tab] && $(ONE[tab]); if (g && isOpen()) g.open = true;
}
/** Open the sheet (on tab `t`, or the last one), or fold it (open = false). Does nothing on big screens. */
export function showSheet(open = true, t = tab) {
  if (!sheetMode()) return;
  if (t !== tab) { tab = t; try { localStorage.setItem(TKEY, t); } catch (e) { /* not remembered */ } }
  app.classList.toggle('sheetOpen', open); paint();
  const pe = panel.querySelector('.explorer-panel'); if (pe && open) pe.scrollTop = 0;
}
/** The tab a panel group lives in. */
const tabOf = g => Object.keys(ONE).find(k => ONE[k] === g.id) || (g.closest('.explorer-panel > .sec') ? 'shapes' : 'settings');
/** Open a panel group and bring it into view: on a phone, open the sheet on its tab first. */
export function revealGroup(g, smooth = false) {
  if (!g) return;
  if (sheetMode()) showSheet(true, tabOf(g));
  g.open = true; requestAnimationFrame(() => g.scrollIntoView({ block: ONE[tab] ? 'start' : 'nearest', behavior: smooth ? 'smooth' : 'auto' }));
}

bar.addEventListener('click', e => {
  const b = e.target.closest('.shTab');
  if (b) { const same = b.dataset.tab === tab && isOpen(); showSheet(!same, b.dataset.tab); track('toolbar', { button: 'sheet_' + b.dataset.tab, detail: same ? 'fold' : 'open', explorer: app.dataset.explorer || '' }); return; }
  if (e.target.closest('#sheetFold')) showSheet(!isOpen());
});
// arrow keys move between tabs, as tabs do
bar.addEventListener('keydown', e => {
  const tabs = [...bar.querySelectorAll('.shTab')], i = tabs.indexOf(document.activeElement); if (i < 0) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; n.focus(); showSheet(true, n.dataset.tab); e.preventDefault(); e.stopPropagation(); }
  if (e.key === 'Escape' && isOpen()) { showSheet(false); e.stopPropagation(); }
});
panel.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen() && sheetMode() && !e.target.closest('input, textarea, select')) { showSheet(false); bar.querySelector('.shTab[aria-selected="true"], .shTab').focus(); } });
// a tap on the picture while the sheet is open only folds it: the picture doesn't also take it as a tap (a dive) or a drag
let swallow = 0;
window.addEventListener('pointerdown', e => {
  if (!isOpen() || !sheetMode() || !e.target.closest || !e.target.closest('#stage') || e.target.closest('#stageBtns, #insets')) return;
  showSheet(false); swallow = performance.now(); e.stopPropagation(); e.preventDefault();
}, true);
for (const ev of ['pointerup', 'click']) window.addEventListener(ev, e => { if (performance.now() - swallow < 600 && e.target.closest && e.target.closest('#stage')) { e.stopPropagation(); if (ev === 'click') { e.preventDefault(); swallow = 0; } } }, true);
// a new explorer's panel: fill its one-group tab again
new MutationObserver(paint).observe(panel, { childList: true });
matchMedia(SHEET_Q).addEventListener('change', () => { if (!sheetMode()) app.classList.remove('sheetOpen'); paint(); });
paint();
