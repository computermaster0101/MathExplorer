// Fewer settings / all settings (design pack U17). New visitors see a short panel: Shapes, Controls, Colour & style, Music
// & sound and Learn. The rest (Motion, View & detail, Save, share & record, Numbers, 3D print, Keyboard shortcuts) is one
// press away, at the end of the panel ("Show all settings", which names them), and stays exactly as it was. Hidden
// groups are hidden by CSS only (`#panel.basic`, app.css), so everything in them still works: the picture's ⇪ menu presses
// Save picture, Record video and 3D print as before, and the tour, Help's Keyboard shortcuts and Music settings open their
// group for the moment (`peek`, from revealGroup in sheet.js) without changing the choice. Remembered in localStorage
// mathexplorer.panel ('basic' / 'all'); a returning visitor (one who has seen the tour or an explorer's card) starts on
// all, so nothing they knew disappears.
import { track } from './analytics.js';
const KEY = 'mathexplorer.panel', panel = document.getElementById('panel');
export const ADV = ['g-motion', 'g-rot', 'g-view', 'g-share', 'g-info', 'g-print', 'g-keys'];
const isAdv = g => ADV.includes(g.id);
function first() {
  try {
    const v = localStorage.getItem(KEY); if (v === 'basic' || v === 'all') return v;
    let back = !!localStorage.getItem('mathexplorer.tour');
    for (let i = 0; i < localStorage.length && !back; i++) back = /^mathexplorer\.card\./.test(localStorage.key(i));
    const m = back ? 'all' : 'basic'; localStorage.setItem(KEY, m); return m;
  } catch (e) { return 'basic'; }
}
let mode = first();
export const basicPanel = () => mode === 'basic';

/** Show a group even while it's one of the hidden ones (until the panel changes): for the tour and Help's shortcuts. */
export function peek(g) { if (g && mode === 'basic' && isAdv(g)) g.classList.add('peek'); }
const unpeek = () => { for (const g of panel.querySelectorAll('.peek')) g.classList.remove('peek'); };

export function setPanelMode(m, why = 'button') {
  mode = m; try { localStorage.setItem(KEY, m); } catch (e) { /* this visit only */ }
  unpeek(); paint(); track('panel_mode', { mode: m, via: why });
}
// the button at the end of the panel, which says what "all" adds
function foot(p) {
  let f = p.querySelector(':scope > .panelMore');
  if (!f) {
    f = document.createElement('div'); f.className = 'panelMore';
    f.innerHTML = '<button type="button" class="btn"></button><p class="note"></p>';
    f.querySelector('button').addEventListener('click', () => {
      const going = mode === 'basic' ? 'all' : 'basic'; setPanelMode(going);
      if (going === 'all') { const g = [...p.querySelectorAll(':scope > details.grp')].find(x => isAdv(x) && !x.hidden); if (g) requestAnimationFrame(() => g.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); }
    });
  }
  if (f !== p.lastElementChild) p.appendChild(f);   /* always last: the shared Music group and the motion groups are put in after load */
  const hid = [...p.querySelectorAll(':scope > details.grp')].filter(g => isAdv(g) && !g.hidden && !g.closest('[hidden]'));
  const names = hid.map(g => (g.querySelector('summary .gt') || {}).textContent || '').filter(Boolean);
  const b = f.querySelector('button'), n = f.querySelector('.note');
  b.textContent = mode === 'basic' ? `Show all settings (${hid.length} more)` : 'Fewer settings';
  b.setAttribute('aria-expanded', mode === 'basic' ? 'false' : 'true');
  n.textContent = mode === 'basic' ? names.join(' · ').replace(/&amp;/g, '&') : 'Keep just the main groups: what it is, things to do, colours, music and Learn.';
  f.hidden = !hid.length;
}
function paint() {
  panel.classList.toggle('basic', mode === 'basic');
  const p = panel.querySelector(':scope > .explorer-panel'); if (p) foot(p);
}
// each explorer's panel as it's attached (and the groups added to it afterwards)
let raf = 0;
const wrap = t => t === panel || (t.classList && t.classList.contains('explorer-panel'));
new MutationObserver(ms => { if (!raf && ms.some(m => wrap(m.target))) raf = requestAnimationFrame(() => { raf = 0; paint(); }); }).observe(panel, { childList: true, subtree: true });
window.addEventListener('hashchange', unpeek);
paint();
