// The colour controls under every explorer's palette swatches: Hue, Saturation and Light (which adjust whatever palette is
// chosen, see ADJ in palettes.js) and Your palette (2 to 6 colours you pick, remembered on this device). One set of values
// serves the whole app, like the music player, and share links carry them (hue, sat, lit, and mine when it's chosen).
// Explorers don't need to know: each one's swatch builder calls colourControls(box), and a change "re-picks" the chosen
// swatch, so the explorer recolours through its own palette code (rampOf applies the adjustments).
import { PALETTES, ADJ, palTitle, adjust, css, hexRGB } from './palettes.js';
import { setCodeExtra, refreshView } from '../shell/route.js';

const KEY = 'mathexplorer.mine';
const hex = c => '#' + c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const okMine = a => Array.isArray(a) && a.length >= 2 && a.length <= 6 && a.every(c => Array.isArray(c) && c.length === 3 && c.every(v => isFinite(v)));
try { const m = JSON.parse(localStorage.getItem(KEY) || 'null'); if (okMine(m)) PALETTES.mine = m; } catch (e) { /* the default */ }
const saveMine = () => { try { localStorage.setItem(KEY, JSON.stringify(PALETTES.mine)); } catch (e) { /* not remembered */ } };

const boxes = new Set();   // every explorer's swatch box (only the one on screen is attached)
const palOf = b => b.dataset.pal || b.dataset.p;
const attached = () => [...boxes].find(b => b.isConnected);
let mineInLink = false;   // the address shows `mine` while Your palette is the chosen one

// ---------- share links: the colours' part of the view code ----------
setCodeExtra(() => {
  const P = [];
  if (ADJ.hue) P.push('hue=' + ADJ.hue); if (ADJ.sat !== 1) P.push('sat=' + ADJ.sat); if (ADJ.lit !== 1) P.push('lit=' + ADJ.lit);
  if (mineInLink) P.push('mine=' + PALETTES.mine.map(c => hex(c).slice(1)).join('-'));
  return P.join('&');
});
/** Read the colours from a view code (a link being opened). A code without them means the plain palettes. */
export function colourFromCode(code) {
  if (!code) return false;
  let P; try { P = new URLSearchParams(String(code)); } catch (e) { return false; }
  const n = (k, d, lo, hi) => { const v = parseFloat(P.get(k)); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const was = JSON.stringify([ADJ, PALETTES.mine]);
  ADJ.hue = Math.round(n('hue', 0, -180, 180)); ADJ.sat = n('sat', 1, 0, 2); ADJ.lit = n('lit', 1, 0.4, 1.6);
  const m = (P.get('mine') || '').split('-').filter(h => /^[0-9a-f]{6}$/i.test(h)).map(h => hexRGB('#' + h));
  if (okMine(m)) { PALETTES.mine = m; saveMine(); }
  const changed = was !== JSON.stringify([ADJ, PALETTES.mine]); if (changed) refreshAll(false); return changed;
}
// a pasted link in Load a view: take its colours before the explorer reads the rest (capture runs first)
document.addEventListener('click', e => { if (!e.target.closest || !e.target.closest('#loadView')) return; const v = document.getElementById('viewIn');
  const t = v ? v.value.trim() : ''; const i = t.indexOf('#'); colourFromCode(i >= 0 ? t.slice(i + 1).replace(/^\/[a-z0-9-]+\/?/i, '') : t); }, true);

// ---------- keeping every box in step ----------
let raf = 0, ver = 0;   // ver counts changes, so an explorer coming back on screen knows whether to recolour
/** After a change: redraw the swatches, set the sliders, and (repick) have the explorer on screen recolour. */
function refreshAll(repick = true) {
  ver++; for (const box of boxes) paint(box);
  if (repick && !raf) raf = requestAnimationFrame(() => { raf = 0; colourRepick(); });
}
/** The explorer on screen recolours with the current adjustments (by clicking its chosen swatch again). */
export function colourRepick() { const box = attached(); if (!box) return; box._ver = ver; const b = box.querySelector('button.on'); if (b) b.click(); refreshView(); }
/** An explorer came on screen: recolour it if the colours changed while it was away (or a link just set them). */
export function colourSync() { const box = attached(); if (box && (box._ver || 0) !== ver) colourRepick(); else refreshView(); }
function paint(box) {
  for (const b of box.querySelectorAll('button')) { const name = palOf(b); if (!PALETTES[name]) continue; b.title = palTitle(name);
    b.style.background = `linear-gradient(90deg,${PALETTES[name].map(c => css(adjust(c))).join(',')})`; }
  const ui = box._colours; if (!ui) return;
  const set = (k, v, txt) => { const r = ui.querySelector(`[data-k="${k}"]`); if (document.activeElement !== r) r.value = v; r.nextElementSibling.textContent = txt; };
  set('hue', ADJ.hue, (ADJ.hue > 0 ? '+' : '') + ADJ.hue + '°'); set('sat', ADJ.sat, Math.round(ADJ.sat * 100) + '%');
  set('lit', ADJ.lit, ADJ.lit === 1 ? 'normal' : (ADJ.lit > 1 ? '+' : '−') + Math.round(Math.abs(ADJ.lit - 1) * 100) + '%');
  ui.querySelector('.cAdjReset').hidden = !ADJ.hue && ADJ.sat === 1 && ADJ.lit === 1;
  const on = box.querySelector('button.on'), mine = !!on && palOf(on) === 'mine'; ui.querySelector('.myPal').hidden = !mine; ui.querySelector('.cMake').hidden = mine;
  if (box.isConnected) { if (mine !== mineInLink) { mineInLink = mine; refreshView(); } }
  const row = ui.querySelector('.myCols'), cols = PALETTES.mine;
  if (row.children.length !== cols.length) row.innerHTML = cols.map((_, i) => `<input type="color" data-i="${i}" aria-label="Colour ${i + 1}">`).join('');
  [...row.children].forEach((inp, i) => { if (document.activeElement !== inp) inp.value = hex(cols[i]); });
  ui.querySelector('.myAdd').disabled = cols.length >= 6; ui.querySelector('.myDel').disabled = cols.length <= 2;
}

// ---------- the controls ----------
/** Add the colour controls below a box of palette swatches (call once the swatches are in it). */
export function colourControls(box) {
  if (box._colours) { paint(box); return; }
  const ui = document.createElement('div'); ui.className = 'cAdj';
  ui.innerHTML = `<div class="myPal" hidden><div class="lbl">Your palette</div><div class="myCols"></div>
      <div class="btns"><button class="btn myAdd">+ Colour</button><button class="btn myDel">− Colour</button></div>
      <p class="note">Pick 2 to 6 colours, from low to high. They're remembered on this device and go into share links.</p></div>
    <div class="row"><span style="width:74px">Hue</span><input type="range" data-k="hue" min="-180" max="180" step="1" value="0"><output></output></div>
    <div class="row"><span style="width:74px">Saturation</span><input type="range" data-k="sat" min="0" max="2" step="0.05" value="1"><output></output></div>
    <div class="row"><span style="width:74px">Light</span><input type="range" data-k="lit" min="0.4" max="1.6" step="0.02" value="1"><output></output></div>
    <div class="btns"><button class="btn cMake">✎ Make your own</button><button class="btn cAdjReset" hidden>Plain colours</button></div>`;
  // below the palette's name if it follows the swatches, else right under them
  const after = box.nextElementSibling && box.nextElementSibling.id === 'palName' ? box.nextElementSibling : box; after.after(ui);
  box._colours = ui; box._ver = ver; boxes.add(box);
  ui.addEventListener('input', e => { const k = e.target.dataset.k;
    if (k) { ADJ[k] = +e.target.value; refreshAll(); return; }
    if (e.target.dataset.i != null) { PALETTES.mine[+e.target.dataset.i] = hexRGB(e.target.value); saveMine(); refreshAll(); } });
  ui.querySelector('.cAdjReset').addEventListener('click', () => { ADJ.hue = 0; ADJ.sat = 1; ADJ.lit = 1; refreshAll(); });
  ui.querySelector('.myAdd').addEventListener('click', () => { const c = PALETTES.mine; if (c.length < 6) { c.push(c[c.length - 1].map(v => 1 - v * 0.6)); saveMine(); refreshAll(); } });
  ui.querySelector('.myDel').addEventListener('click', () => { const c = PALETTES.mine; if (c.length > 2) { c.pop(); saveMine(); refreshAll(); } });
  // start your own from the palette you're on (up to 6 of its colours, as you see them), then choose it
  ui.querySelector('.cMake').addEventListener('click', () => {
    const on = box.querySelector('button.on'), name = on ? palOf(on) : 'aurora';
    if (name !== 'mine') { const src = PALETTES[name].map(adjust), n = Math.min(6, src.length);
      PALETTES.mine = Array.from({ length: n }, (_, i) => src[Math.round(i * (src.length - 1) / (n - 1))].slice()); saveMine();
      ADJ.hue = 0; ADJ.sat = 1; ADJ.lit = 1; }
    const mb = box.querySelector('button[data-pal="mine"],button[data-p="mine"]'); paint(box); if (mb) mb.click(); refreshAll(); });
  // choosing a swatch shows or hides Your palette's colours
  box.addEventListener('click', () => setTimeout(() => paint(box)));
  paint(box);
}
