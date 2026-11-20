// The address after the # says which explorer is open and, optionally, a view code for it:
//   #/fractal            the fractal explorer, default view
//   #/polytope/s=8&m=…   the polytope explorer, at a saved view
// Each explorer owns the format of its own view code; the shell only splits it off.

export const DEFAULT_EXPLORER = 'fractal';

/** Split a hash (or any text that contains one, such as a pasted link) into explorer name and view code. */
export function parseRoute(text = location.hash) {
  let h = String(text || '');
  const i = h.indexOf('#'); if (i >= 0) h = h.slice(i + 1);
  const m = h.match(/^\/([a-z0-9-]+)\/?(.*)$/i);
  return m ? { explorer: m[1], code: m[2] } : { explorer: null, code: h };
}

/** The view code from a pasted link or a bare code, whichever the user gave. */
export const codeFromText = text => parseRoute(text).code;

let active = null;
export const activeExplorer = () => active;
export const setActiveExplorer = name => { active = name; };

const hashFor = (explorer, code) => '#/' + explorer + (code ? '/' + code : '');

/** Record the current view in the address bar, without adding a history entry. Ignored unless that explorer is the one on screen. */
export function setViewCode(explorer, code) {
  if (explorer !== active) return;
  const h = hashFor(explorer, code);
  if (location.hash !== h) try { history.replaceState(null, '', h); } catch (e) { /* sandboxed frames may refuse */ }
}

/** A full link that opens this explorer at this view. */
export const shareLink = (explorer, code) => location.href.split('#')[0] + hashFor(explorer, code);
