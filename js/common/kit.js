// Shared building blocks for explorers: panel helpers (segmented buttons, palette swatches, stats, share codes) and the
// standard keys, so every explorer's keys mean the same thing (see "Keys are the same in both explorers" in CLAUDE.md).
import { PALETTES, css } from './palettes.js';

export const $ = id => document.getElementById(id);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Mark one button of a segmented control as chosen. */
export const setSeg = (el, b) => el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
/** A segmented control: fn(button.dataset) when a button is clicked. */
export function segClick(id, fn) { $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setSeg($(id), b); fn(b.dataset, b); }); }
/** Click the button after (dir 1) or before (dir −1) the chosen one, wrapping round. */
export function clickNext(sel, dir = 1) { const bs = [...document.querySelectorAll(sel)].filter(b => !b.closest('[hidden]')); if (!bs.length) return; const i = bs.findIndex(b => b.classList.contains('on')); bs[(i + dir + bs.length) % bs.length].click(); }
/** Set a range input's value and fire its input event (so its own handler updates everything). */
export function setRange(id, v) { const el = $(id); if (!el || v == null || isNaN(v)) return; el.value = v; el.dispatchEvent(new Event('input')); }
/** Tick or untick a checkbox and fire its change event, if it isn't already that way. */
export function setCheck(id, on) { const el = $(id); if (!el || on == null || el.checked === !!on) return; el.checked = !!on; el.dispatchEvent(new Event('change')); }
/** Click the button with data-<attr>="value" inside a container. */
export function clickData(sel, attr, val) { const b = document.querySelector(`${sel} [data-${attr}="${CSS.escape(String(val))}"]`); if (b) b.click(); }
/** The three numbers in the Numbers group: setStats([value, label], …) for ids s1..s3 and s1l..s3l. */
export function setStats(...pairs) { pairs.forEach(([v, l], i) => { const a = $('s' + (i + 1)), b = $('s' + (i + 1) + 'l'); if (a) a.textContent = v; if (b) b.textContent = l; }); }

/** Fill a .swatches element with one button per palette; onPick(name) when one is chosen. */
export function buildSwatches(el, current, onPick) {
  el.innerHTML = '';
  for (const [name, stops] of Object.entries(PALETTES)) {
    const b = document.createElement('button'); b.dataset.pal = name; b.title = name.replace('_', ' & ').replace(/^./, c => c.toUpperCase());
    b.style.background = `linear-gradient(90deg,${stops.map(c => css(c)).join(',')})`; if (name === current) b.classList.add('on');
    b.addEventListener('click', () => { el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); onPick(name); });
    el.appendChild(b);
  }
}
/** The legend bar's background for a palette ramp. */
export const rampCss = r => `linear-gradient(90deg,${r.map(c => css(c)).join(',')})`;

// ---------- share codes: a view as URL parameters ----------
/** Numbers rounded for a share code. */
export const r4 = x => +(+x).toFixed(4);
export const r8 = x => +(+x).toPrecision(10);
/** Read a number parameter, or a default when it's missing or broken. */
export const num = (P, k, d) => { const v = P.get(k); if (v == null || v === '') return d; const n = +v; return isFinite(n) ? n : d; };

// ---------- the standard keys ----------
/**
 * Handle the keys every explorer shares, given what each means here. A = {
 *   pause(), go(), reset(), renew(),            Space, G, R, N
 *   shape(dir), palette(dir), colourMode(dir),  Z / X, C / V, Shift + C / V
 *   reverse(), cycle(), zoom(f), mode(i) }       B, K, + / −, 1–9
 * Missing actions leave their keys unused. Returns true when the key was used.
 */
export function standardKeys(e, A) {
  const k = e.key, call = (f, ...a) => (f ? (f(...a), true) : false);
  switch (k) {
    case ' ': { const used = call(A.pause); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); return used; }
    case 'g': case 'G': return call(A.go);
    case 'r': case 'R': return call(A.reset);
    case 'n': case 'N': return call(A.renew);
    case 'z': case 'Z': case ',': case '<': return call(A.shape, -1);
    case 'x': case 'X': case '.': case '>': return call(A.shape, 1);
    case 'c': return call(A.palette, -1);
    case 'v': return call(A.palette, 1);
    case 'C': return call(A.colourMode, -1);
    case 'V': return call(A.colourMode, 1);
    case 'b': case 'B': return call(A.reverse);
    case 'k': case 'K': return call(A.cycle);
    case '+': case '=': return call(A.zoom, 0.8);
    case '-': case '_': return call(A.zoom, 1.25);
    default: if (/^[1-9]$/.test(k)) return call(A.mode, +k - 1); return false;
  }
}

/** The keyboard-shortcut rows every explorer shows (its own rows go in front), plus the shared invert / speed controls. */
export const KEY_ROWS = [
  ['Space', 'Pause / resume everything that\'s moving'], ['R', 'Reset view'], ['Z X', 'Previous / next shape (, and . work too)'],
  ['C V', 'Previous / next palette'], ['Shift + C V', 'Previous / next colour mode'], ['B', 'Reverse the palette on / off'], ['K', 'Colour cycling on / off'],
  ['+ −', 'Zoom in / out'], ['M', 'Play / pause the music'], ['H', 'Hide / show panel'], ['F', 'Full screen (Esc to leave)'], ['E / Q', 'Expand / collapse all sections'], ['?', 'Open this list']];
/** Fill the Keyboard shortcuts group: the explorer's own rows first, then the shared ones. */
export function buildKeys(tableEl, ownRows) {
  const norm = k => k.replace(/[\s/]/g, ''), own = new Set(ownRows.map(([k]) => norm(k)));   // an explorer's own meaning for a key replaces the shared row
  tableEl.innerHTML = [...ownRows, ...KEY_ROWS.filter(([k]) => !own.has(norm(k)))].map(([k, t]) => `<tr><td><kbd>${k}</kbd></td><td>${t}</td></tr>`).join('');
}

// ---------- the Save & share group ----------
import { codeFromText, setViewCode, shareLink } from '../shell/route.js';
/**
 * Wire an explorer's share box (#linkBox, #copyLink, #viewIn, #loadView, #shareNote): encode() gives the view code now,
 * apply(code) loads one (return false if it isn't valid). touch() after any change keeps the address bar up to date
 * (at most every 0.4 s); write() does it at once.
 */
export function makeShare(name, encode, apply) {
  let pend = null, last = null;
  const write = () => { const c = encode(); if (c === last) return; last = c; setViewCode(name, c); const box = $('linkBox'); if (box && document.activeElement !== box) box.value = shareLink(name, c); };
  const touch = () => { if (!pend) pend = setTimeout(() => { pend = null; write(); }, 400); };
  $('copyLink').addEventListener('click', async () => { last = null; write(); const box = $('linkBox'); box.select();
    try { await navigator.clipboard.writeText(box.value); $('shareNote').textContent = 'Link copied.'; } catch (e) { $('shareNote').textContent = 'Link selected: press Ctrl+C to copy it.'; } });
  $('loadView').addEventListener('click', () => { const c = codeFromText($('viewIn').value.trim());
    if (!c) { $('shareNote').textContent = 'Paste a view link or code first.'; return; }
    $('shareNote').textContent = apply(c) === false ? 'That doesn\'t look like a view for this explorer.' : 'Loaded.'; last = null; write(); });
  return { write: () => { last = null; write(); }, touch };
}
