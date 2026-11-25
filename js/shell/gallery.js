// The gallery: every explorer as a picture card (the "All 12" button in the top bar). The cards are built from the explorer
// menu (#xList), so its names, descriptions and addresses stay the one list; the pictures are images/explorers/<name>.jpg,
// loaded the first time the gallery opens. A card is a plain link to the explorer, so routing, Back and analytics' explorer_open
// work as they do for the menu; choosing the explorer on screen, Escape, the close button or a click outside the cards just closes.
import { track } from './analytics.js';
const $ = id => document.getElementById(id);
const gal = $('gallery'), grid = $('galGrid'), btn = $('galleryBtn');
let built = false, back = null;

function build() {
  const cur = document.querySelector('#xList a.on'), name = cur && cur.dataset.explorer;
  if (!built) {
    built = true;
    for (const a of document.querySelectorAll('#xList a')) {
      const c = document.createElement('a'); c.className = 'galCard'; c.href = a.getAttribute('href'); c.dataset.explorer = a.dataset.explorer;
      const t = a.querySelector('b').textContent, d = a.querySelector('small').textContent;
      c.innerHTML = `<span class="galPic"><img src="images/explorers/${a.dataset.explorer}.jpg" alt="" loading="lazy" decoding="async" width="1200" height="630"></span>`
        + `<span class="galTxt"><b></b><small></small><span class="galGo">Explore →</span></span>`;
      c.querySelector('b').textContent = t; c.querySelector('small').textContent = d.charAt(0).toUpperCase() + d.slice(1);
      grid.appendChild(c);
    }
  }
  for (const c of grid.children) { const on = c.dataset.explorer === name; c.classList.toggle('on', on); if (on) c.setAttribute('aria-current', 'page'); else c.removeAttribute('aria-current'); c.querySelector('.galGo').textContent = on ? 'You\'re here · back to it' : 'Explore →'; }
}

export function openGallery() {
  if (!gal.hidden) return;
  build(); back = document.activeElement; gal.hidden = false; document.body.classList.add('galOpen'); btn.setAttribute('aria-expanded', 'true');
  gal.scrollTop = 0; (grid.querySelector('.galCard.on') || grid.firstElementChild).focus({ preventScroll: true });
  track('gallery', { detail: 'open', explorer: document.getElementById('app').dataset.explorer || '' });
}
export function closeGallery() {
  if (gal.hidden) return;
  gal.hidden = true; document.body.classList.remove('galOpen'); btn.setAttribute('aria-expanded', 'false');
  if (back && back.focus && document.contains(back)) back.focus({ preventScroll: true }); back = null;
}

btn.addEventListener('click', openGallery);
$('galClose').addEventListener('click', closeGallery);
gal.addEventListener('click', e => {
  const c = e.target.closest('.galCard');
  if (c) { if (c.classList.contains('on')) e.preventDefault(); else track('gallery', { detail: 'pick', explorer: c.dataset.explorer }); closeGallery(); return; }
  if (!e.target.closest('.galHead, .galGrid')) closeGallery();   /* the empty space round the cards */
});
// while it's open, keys belong to the gallery: Escape closes, arrows move between cards, and nothing reaches the explorer underneath
gal.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeGallery(); e.preventDefault(); }
  else if (/^Arrow/.test(e.key) && e.target.closest('.galCard')) {
    const cards = [...grid.children], i = cards.indexOf(e.target.closest('.galCard')), cols = Math.max(1, Math.round(grid.clientWidth / cards[0].offsetWidth));
    const j = i + ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols })[e.key];
    if (cards[j]) cards[j].focus(); e.preventDefault();
  }
  if (e.key === 'Tab') {   /* keep Tab inside the dialog */
    const f = [$('galClose'), ...grid.children], k = f.indexOf(document.activeElement);
    if (e.shiftKey && k <= 0) { f[f.length - 1].focus(); e.preventDefault(); } else if (!e.shiftKey && k === f.length - 1) { f[0].focus(); e.preventDefault(); }
  }
  e.stopPropagation();
});
gal.addEventListener('keyup', e => e.stopPropagation());
window.addEventListener('hashchange', closeGallery);
