// Keyboard behaviour shared by the shell's menus and dialogs (design pack U08, U16), so they all work the same way:
//   menus    ↑ ↓ Home End move through the items that are showing, Escape closes and puts focus back on the button that
//            opened it, Tab closes it and lets focus move on; opened from the keyboard, the first item takes focus
//   dialogs  focus goes in when they open and stays inside (Tab and Shift + Tab go round), Escape closes, the page behind
//            can't be reached (inert), and focus goes back where it was when they close
// Explorers don't use these; the shell's keys (keys.js) also leave every key alone while a dialog is open (modalOpen()).
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const shown = el => !el.hidden && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
/** The items in a container that can take focus and are showing. */
export const focusables = (box, sel = FOCUSABLE) => [...box.querySelectorAll(sel)].filter(shown);

/** Arrow keys, Home / End, Escape and Tab for a menu. close() shuts it; items are `itemSel` inside `menu`. */
export function menuKeys(menu, btn, close, itemSel = '[role=menuitem]') {
  menu.addEventListener('keydown', e => {
    const it = focusables(menu, itemSel), i = it.indexOf(document.activeElement);
    let to = -1;
    if (e.key === 'ArrowDown') to = (i + 1) % it.length; else if (e.key === 'ArrowUp') to = (i - 1 + it.length) % it.length;
    else if (e.key === 'Home') to = 0; else if (e.key === 'End') to = it.length - 1;
    else if (e.key === 'Escape') { close(); btn.focus(); e.preventDefault(); e.stopPropagation(); return; }
    else if (e.key === 'Tab') { close(); return; }   /* focus moves on as usual */
    else return;
    if (it.length) it[to].focus(); e.preventDefault(); e.stopPropagation();
  }, true);
}
/** Focus a menu's first showing item (when it was opened from the keyboard). */
export const focusFirst = (menu, itemSel = '[role=menuitem]') => { const f = focusables(menu, itemSel)[0]; if (f) f.focus(); };

// ---------- dialogs ----------
let open = [];   // the dialogs open now, newest last: { back, from }
export const modalOpen = () => open.length > 0;
const app = () => document.getElementById('app');
/** Show the dialog `back` (a .modalBack wrapping a role=dialog), focusing `first` (an element, or the first focusable). */
export function openModal(back, first) {
  if (!open.some(m => m.back === back)) open.push({ back, from: document.activeElement });
  back.hidden = false; const dlg = back.querySelector('[role=dialog]'); if (dlg) dlg.setAttribute('aria-modal', 'true');
  const a = app(); if (a) a.inert = true;
  if (!back.dataset.trap) {
    back.dataset.trap = '1';
    back.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeModal(back); e.preventDefault(); e.stopPropagation(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables(back); if (!f.length) { e.preventDefault(); return; }
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { f[f.length - 1].focus(); e.preventDefault(); } else if (!e.shiftKey && i === f.length - 1) { f[0].focus(); e.preventDefault(); }
    });
    // anything that hides it some other way (its own buttons set hidden) closes it properly too
    new MutationObserver(() => { if (back.hidden && open.some(m => m.back === back)) closeModal(back); }).observe(back, { attributes: true, attributeFilter: ['hidden'] });
  }
  (first || focusables(back)[0] || back).focus();
}
/** Hide it and give focus back to whatever had it before. */
export function closeModal(back) {
  const m = open.find(o => o.back === back); open = open.filter(o => o.back !== back);
  back.hidden = true;
  if (!open.length) { const a = app(); if (a) a.inert = false; }
  // back where focus was; an item of a menu that has since closed hands it to the menu's button
  let to = m && m.from; if (to && to.closest && !shown(to)) { const mn = to.closest('[role=menu]'); to = mn && mn.id ? document.querySelector(`[aria-controls="${mn.id}"]`) : null; }
  if (to && to.isConnected && to !== document.body && shown(to)) to.focus();
}
