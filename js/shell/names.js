// Names and states for screen readers in every panel (design pack U04), worked out from the panels' own markup so all
// twelve (and controls built in JS, like the colour sliders and the motion groups) follow without each one being edited:
//  - a slider, list or text box with no name takes the label beside it: the first text in its .row (`<span>Turn speed</span>`),
//    else the nearest `.lbl` above it, else its group's title;
//  - a slider's value is read out as the panel shows it ("0.5×", "off", "16 s"): the <output> in its row is copied into
//    aria-valuetext, and kept up to date as it changes (the <output> itself is then hidden from screen readers, since as a
//    live region it was read out on every change);
//  - a row of buttons where one is chosen (`.on`: shapes, palettes, Colour by, sizes…) becomes a named group, and each
//    button says whether it's chosen (aria-pressed follows `.on`); a lone button lit with `.on` says so too.
// Nothing here changes what the panel looks like or does. The panel element (#panel) stays while explorers come and go,
// so one observer covers every explorer's panel as it's attached.
const panel = document.getElementById('panel');
const txt = e => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '');
const FIELD = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button]), select, textarea';
let n = 0;
const idOf = e => e.id || (e.id = 'nm' + (++n));

function named(el) {
  if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return true;
  if (el.labels && [...el.labels].some(l => txt(l))) return true;
  return false;
}
/** The text that labels a field: the row's own label, or the nearest heading above it in its section. */
function labelFor(el) {
  const row = el.closest('.row');
  if (row) for (const c of row.children) {
    if (c === el || c.contains(el)) break;
    if (/^(OUTPUT|INPUT|SELECT|TEXTAREA|BUTTON)$/.test(c.tagName)) continue;
    if (txt(c)) return c;
  }
  // walk back through earlier siblings, then the parents' earlier siblings, as far as the group's body
  for (let e = row || el; e && e !== panel && !e.classList.contains('gb'); e = e.parentElement) {
    for (let s = e.previousElementSibling; s; s = s.previousElementSibling) {
      if (s.matches('.lbl, label:not(.check), h3, h4')) return s;
      const l = s.querySelector && [...s.querySelectorAll('.lbl')].pop(); if (l) return l;
      if (s.matches('.sec, .btns, .seg, details')) break;
    }
  }
  return null;
}
const groupTitle = el => { const g = el.closest('details.grp'); return g ? txt(g.querySelector('summary .gt')) : ''; };
/* where the panel shows a slider's value: the <output> in its row, the element named after it (`<b id="thko">`), or the bold
   value in the label above it (`<div class="lbl">Step speed <b id="orbo">…</b></div>`) */
const outputFor = el => { const row = el.closest('.row'), l = !row && labelFor(el);
  return (row && row.querySelector('output')) || (el.id && document.getElementById(el.id + 'o')) || (l && l.querySelector('b, output')) || null; };

const outs = new Map();   // output -> slider, for keeping aria-valuetext current
function field(el) {
  if (!named(el)) {
    const l = labelFor(el);
    if (l) el.setAttribute('aria-labelledby', idOf(l)); else { const t = groupTitle(el); if (t) el.setAttribute('aria-label', t); }
  }
  if (el.type === 'range') { const o = outputFor(el); if (o) { outs.set(o, el); value(o); if (o.tagName === 'OUTPUT') o.setAttribute('aria-hidden', 'true'); } }   /* an <output> is a live region: the slider reads its value now, so it isn't read out twice (or on every frame of Slowly change) */
}
function value(o) { const el = outs.get(o); if (!el) return; const t = txt(o); if (t) el.setAttribute('aria-valuetext', t); else el.removeAttribute('aria-valuetext'); }

/** A row of buttons with one chosen: name the row, and have each button say whether it's chosen. */
function group(box) {
  const bs = [...box.children].filter(b => b.tagName === 'BUTTON'); if (bs.length < 2) return false;
  if (!box.getAttribute('role')) box.setAttribute('role', 'group');
  if (!named(box)) { const l = labelFor(box); if (l) box.setAttribute('aria-labelledby', idOf(l)); else { const t = groupTitle(box); if (t) box.setAttribute('aria-label', t); } }
  for (const b of bs) pressed(b);
  box.dataset.nmGroup = '1'; return true;
}
const pressed = b => b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false');
/** A button changed its class: keep its row (or itself) in step. */
function lit(b) {
  const box = b.parentElement;
  if (box && (box.dataset.nmGroup || (b.classList.contains('on') && group(box)))) { for (const x of box.children) if (x.tagName === 'BUTTON') pressed(x); return; }
  if (b.hasAttribute('aria-pressed') || b.classList.contains('on')) pressed(b);
}

function scan(root) {
  if (!root.querySelectorAll) return;
  if (root.matches && root.matches(FIELD)) field(root);
  if (root.matches && root.matches('button.on')) lit(root);
  if (root.tagName === 'OUTPUT') value(root);
  for (const el of root.querySelectorAll(FIELD)) field(el);
  for (const b of root.querySelectorAll('button.on')) lit(b);
  for (const o of root.querySelectorAll('output, b[id]')) value(o);
}

let queued = new Set(), raf = 0;
const flush = () => { raf = 0; const q = queued; queued = new Set(); for (const r of q) if (r.isConnected) scan(r); };
new MutationObserver(list => {
  for (const m of list) {
    if (m.type === 'attributes') { if (m.target.tagName === 'BUTTON') lit(m.target); continue; }
    const t = m.target.nodeType === 3 ? m.target.parentElement : m.target;
    const o = t && t.closest && t.closest('output, b[id]'); if (o && outs.has(o)) { value(o); continue; }
    if (m.type === 'childList') for (const a of m.addedNodes) if (a.nodeType === 1) queued.add(a);
  }
  if (queued.size && !raf) raf = requestAnimationFrame(flush);
}).observe(panel, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
scan(panel);
