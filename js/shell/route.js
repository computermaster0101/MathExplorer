// The address after the # says which explorer is open and, optionally, a view code for it:
//   #/fractal            the fractal explorer, default view
//   #/polytope/s=8&m=…   the polytope explorer, at a saved view
// Each explorer owns the format of its own view code; the shell only splits it off.

export const DEFAULT_EXPLORER = 'fractal';

// While an explorer boots, parseRoute() with no argument answers with the address it was opened for, not the live one: the
// visitor may already have moved on to another explorer, whose code it must not read (js/main.js sets and clears it).
let boot = null;
export const setBootRoute = r => { boot = r; };
/** Split a hash (or any text that contains one, such as a pasted link) into explorer name and view code. */
export function parseRoute(text) {
  if (text === undefined && boot) return { ...boot };
  let h = String(text === undefined ? location.hash : text || '');
  const i = h.indexOf('#'); if (i >= 0) h = h.slice(i + 1);
  const m = h.match(/^\/([a-z0-9-]+)\/?(.*)$/i);
  return m ? { explorer: m[1], code: m[2] } : { explorer: null, code: h };
}

/** The view code from a pasted link or a bare code, whichever the user gave. */
export const codeFromText = text => parseRoute(text).code;

let active = null;
export const activeExplorer = () => active;
export const setActiveExplorer = name => { active = name; };

// the shell's own part of every view code (the colour adjustments, js/common/colours.js), added after the explorer's
let extra = () => '';
export const setCodeExtra = fn => { extra = fn; };
const withExtra = code => { const x = extra(); return x ? (code ? code + '&' + x : x) : code; };
const hashFor = (explorer, code) => { code = withExtra(code); return '#/' + explorer + (code ? '/' + code : ''); };
const lastCode = {};

/** Record the current view in the address bar, without adding a history entry. Ignored unless that explorer is the one on screen. */
export function setViewCode(explorer, code) {
  if (explorer !== active) return;
  lastCode[explorer] = code; const h = hashFor(explorer, code);
  if (location.hash !== h) try { history.replaceState(null, '', h); } catch (e) { /* sandboxed frames may refuse */ }
}

/** A full link that opens this explorer at this view. */
export const shareLink = (explorer, code) => location.href.split('#')[0] + hashFor(explorer, code);
/** The shell's part changed: rewrite the address and the explorer's link box with the explorer's last code. */
export function refreshView() {
  if (!active || lastCode[active] == null) return; setViewCode(active, lastCode[active]);
  for (const id of ['linkBox', 'viewLink']) { const b = document.getElementById(id); if (b && b.isConnected && document.activeElement !== b && /^https?:/.test(b.value)) b.value = shareLink(active, lastCode[active]); }
}
