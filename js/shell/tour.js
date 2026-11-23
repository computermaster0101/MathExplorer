// First visits: an eight-step tour of what every explorer shares (the menu, moving round the picture, the buttons on it, the
// panel, music, saving and sharing, 3D printing, keys and help), and, the first time in each explorer, a small card saying what you're looking at and two things to try that
// only that explorer has. Nothing here repeats the tour. Remembered on this device (localStorage; a session's worth when
// storage is blocked). Someone arriving on a shared link sees the picture they were sent, with a small bar offering the tour,
// rather than the tour on top of it; nothing appears in full screen.
import { inZen, panelHidden, togglePanel } from './layout.js';
import { track } from './analytics.js';

const TOUR = 'mathexplorer.tour', TOUR_V = '1', CARD = 'mathexplorer.card.';
const mem = {}, store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { try { return sessionStorage.getItem(k); } catch (e2) { return mem[k] || null; } } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { try { sessionStorage.setItem(k, v); } catch (e2) { mem[k] = v; } } } };
const $ = id => document.getElementById(id), touch = () => matchMedia('(pointer: coarse)').matches;

// ---------- what each explorer is, and two things to try there (and only there) ----------
const CARDS = {
  fractal: ['Shapes made by repeating one simple rule over and over. Zoom into an edge and the detail never runs out.', ['Press <b>G</b> (or Dive) to zoom in deeper than any microscope', 'Open <b>3D</b> for fractals you can fly round']],
  polytope: ['Shapes from the fourth dimension, shown the way a cube casts a flat shadow: what you see is their shadow in our space.', ['Try <b>Slice</b>: watch the 4D shape pass through our 3D world', 'Press <b>G</b> to fly inside it']],
  surface: ['Surfaces with surprises: some have only one side, others are soap films stretched as small as they can be.', ['Press <b>G</b> to walk round the Möbius band and come back upside down', 'Pick the <b>Klein bottle</b>: a bottle with no inside']],
  knot: ['Knots as mathematicians see them: closed loops that can\'t be untied without cutting, and links of several loops.', ['Press <b>G</b> to ride the knot like a roller coaster', 'Pick the <b>Borromean rings</b>: no two are linked, yet all three hold together']],
  labyrinth: ['Endless surfaces that split space into two mazes, mazes to solve, and the ancient one-path labyrinths.', ['Press <b>G</b> to fly through an endless labyrinth', 'Pick <b>Race the solver</b> and try to beat the computer']],
  foam: ['The ways soap bubbles can fill space, from Kelvin\'s 1887 guess to the record-holding Weaire–Phelan foam.', ['Press <b>G</b> to fly through the bubbles', 'Turn up <b>Pull apart</b> to see each bubble\'s shape']],
  complex: ['Every point here is a number, coloured by where a function sends it. The colours wheel round each zero.', ['Pick <b>Zeros and poles</b> and drag them about', 'Raise <b>Steps</b> to grow a fractal out of the function']],
  attractor: ['Chaos: a point following simple rules that never repeats, yet never leaves this shape.', ['Try <b>Butterfly effect</b>: two starts a hair apart end up far apart', 'Pick a map such as <b>Clifford</b> and watch millions of points build a picture']],
  tiling: ['Patterns that cover a surface with no gaps: on a ball, on the flat plane and on the curved hyperbolic plane.', ['Press <b>G</b> to glide through a hyperbolic tiling', 'Pick <b>The hat</b>: one shape that tiles without ever repeating']],
  wave: ['Waves you can see: ripples adding up, a wave tank, sand on a ringing plate and a plucked string.', ['In the <b>Wave tank</b>, click in the water to splash', 'Try a <b>Chladni plate</b>: the sand gathers where the plate keeps still']],
  draw: ['Machines that draw: circles spinning on circles, gears rolling in rings, swinging pendulums and threads round a circle.', ['Tick <b>Add the circles one by one</b> and watch a drawing build up', 'Press <b>Draw your own</b>: the circles will copy it']],
  life: ['Patterns that grow by themselves, from simple rules about each cell\'s neighbours.', ['Paint on the picture with the brush to start new life', 'Try <b>Lenia</b>: smooth cells that move like creatures']],
};

// ---------- the tour: a step for each thing every explorer shares, each pointing at the real thing ----------
// Steps on a panel group open it while they're shown (and close it again after, if it was closed); a group an explorer
// hides in its current mode is left out.
const STEPS = () => [
  { el: '#switcher', title: 'Welcome to Math Explorer', text: 'Twelve ways to see mathematics, all running live in your browser. Pick an explorer here. Play freely: you can\'t break anything.' },
  { el: '#stage', title: 'The picture', text: touch()
      ? 'Drag to move or turn it, pinch to zoom. Tap to dive in (tap again to pause or play), press and hold to start afresh.'
      : 'Drag to move or turn it, scroll to zoom. On the keyboard the arrows and W A S D move you, G dives or flies, Space pauses and R starts afresh.' },
  { el: '#stageBtns', title: 'Buttons on the picture', text: touch()
      ? 'Press and hold any of them to see its name. In order: hide the panel, full screen (or double-tap the picture: nothing but the picture, ready for a screenshot; there, swipe sideways for colours and up or down for the shape), reset the view; play or pause, and go (dive, fly, ride…); slower and faster; music and the Visualizer; and <b>?</b> for help, Report a problem and this tour.'
      : 'Point at any of them to see its name and key. In order: hide the panel (H), full screen (F; Esc comes back), reset the view (R); play or pause (Space) and go: dive, fly, ride… (G); slower and faster; music and the ♫ Visualizer; and <b>?</b> for help, the keys, Report a problem and this tour.' },
  { el: '#panel', title: 'The panel', text: 'Choose a shape at the top, then open any group to change how it moves, how it looks and its colours. Every explorer\'s panel is laid out in the same order.' },
  { el: '#g-sound', open: true, title: 'Music', text: 'Play a song from your device, use the microphone, or listen to another tab. Every explorer moves with the beat; ♫ Visualizer changes the picture with the song as well.' },
  { el: '#g-share', open: true, title: 'Save and share', text: 'Save a picture of exactly what you see, or record a video with the music. <b>Copy link</b> gives a link that reopens this very view (shape, colours and angle) for anyone you send it to; paste one under <b>Load a view</b> to open it here.' },
  { el: '#g-print', open: true, title: '3D print', text: 'Download what you\'re looking at as an STL file, ready for a 3D printer, at the size you choose.' },
  { el: '#g-keys', open: true, title: 'Keys and help', text: (touch() ? 'With a keyboard, every key for this explorer is listed here. ' : 'Every key for this explorer is listed here; Keyboard shortcuts in the <b>?</b> menu opens it any time. ')
      + '<b>Navigation speed</b> sets how fast you move. To see this tour again, read about the explorer you\'re in, or report a problem, press <b>?</b> on the picture.' },
].filter(s => { if (!s.open) return true; const el = document.querySelector(s.el); return el && !el.hidden && el.offsetParent !== null; });
let T = null;   // the open tour: { i, root, spot, tip }
function startTour(from) {
  if (T) return; hideBar(); hideCard();
  if (panelHidden()) togglePanel(false);
  const root = document.createElement('div'); root.id = 'tour'; root.innerHTML = '<div id="tourSpot"></div><div id="tourTip" role="dialog" aria-live="polite"></div>'; document.body.appendChild(root);
  T = { i: 0, root, spot: root.querySelector('#tourSpot'), tip: root.querySelector('#tourTip') }; document.body.classList.add('touring');   /* the consent bar stays on top; the tour keeps clear of it (see room()) */
  track('tour_start', { from }); window.addEventListener('keydown', tourKey, true); window.addEventListener('resize', place); step(0);
}
function step(i) {
  const S = STEPS(); T.i = i; const s = S[i], el = document.querySelector(s.el);
  shut(); if (s.open && el && !el.open) { el.open = true; T.opened = el; }   // open this step's group (shut() closes the last one again)
  if (el) { const r = el.getBoundingClientRect(); if (r.top < 0 || r.bottom > room()) el.scrollIntoView({ block: r.height > innerHeight * 0.8 ? 'start' : 'center' }); }   // bring it into view (on a phone the panel is below the picture)
  T.tip.innerHTML = `<div class="ttStep">${i + 1} of ${S.length}</div><h3>${s.title}</h3><p>${s.text}</p>
    <div class="ttBtns"><button class="sbtn" id="ttSkip">${i === S.length - 1 ? 'Close' : 'Skip'}</button><span></span>${i ? '<button class="sbtn" id="ttBack">Back</button>' : ''}<button class="sbtn on" id="ttNext">${i === S.length - 1 ? 'Done' : 'Next'}</button></div>`;
  T.tip.querySelector('#ttNext').onclick = next; T.tip.querySelector('#ttSkip').onclick = () => endTour(i === S.length - 1 ? 'tour_complete' : 'tour_skip');
  const b = T.tip.querySelector('#ttBack'); if (b) b.onclick = () => step(i - 1);
  track('tour_step', { step: i + 1 }); setTimeout(place, 60); setTimeout(place, 400); T.tip.querySelector('#ttNext').focus();
}
// the height the tour may use: above the consent bar while it's waiting for an answer
const room = () => { const b = $('consentBar'), r = b && !b.hidden ? b.getBoundingClientRect() : null; return r && r.height ? Math.max(200, r.top - 6) : innerHeight; };   /* (a fixed bar has no offsetParent) */
// when the bar is answered the tour gets the whole height back
new MutationObserver(() => { if (T) place(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
const next = () => { if (T.i < STEPS().length - 1) step(T.i + 1); else endTour('tour_complete'); };
function place() {
  if (!T) return; const s = STEPS()[T.i], el = document.querySelector(s.el), vw = innerWidth, vh = room(), pad = 6;
  const r = el ? el.getBoundingClientRect() : { left: vw / 2, top: vh / 2, width: 0, height: 0, right: vw / 2, bottom: vh / 2 };
  const x0 = Math.max(4, r.left - pad), y0 = Math.max(4, r.top - pad), x1 = Math.min(vw - 4, r.right + pad), y1 = Math.min(vh - 4, r.bottom + pad);
  Object.assign(T.spot.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
  // the card goes beside the highlighted part if there's room, else below or above it, always on screen
  const tw = Math.min(330, vw - 24); T.tip.style.width = tw + 'px'; const th = T.tip.offsetHeight || 170;
  let x, y;
  if (vw - x1 > tw + 24) { x = x1 + 12; y = y0; } else if (x0 > tw + 24) { x = x0 - tw - 12; y = y0; }
  else if (vh - y1 > th + 24) { x = x0; y = y1 + 12; } else if (y0 > th + 24) { x = x0; y = y0 - th - 12; } else { x = (vw - tw) / 2; y = Math.max(12, vh - th - 24); }   // a big target: in front, at the bottom
  T.tip.style.left = Math.max(12, Math.min(vw - tw - 12, x)) + 'px'; T.tip.style.top = Math.max(12, Math.min(vh - th - 12, y)) + 'px';
}
// while the tour is open it has the keyboard (the explorer underneath ignores keys): Esc skips, Enter or → goes on, ← back, Tab moves round its buttons
function tourKey(e) { if (!T || e.key === 'Tab' || (e.target.closest && e.target.closest('#consentBar,.modalBack'))) return;   /* the consent bar and privacy note keep their own keys */ if (e.key === 'Escape') endTour('tour_skip'); else if (e.key === 'Enter' || e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft' && T.i) step(T.i - 1); e.preventDefault(); e.stopPropagation(); }
const shut = () => { if (T && T.opened) { T.opened.open = false; T.opened = null; } };
function endTour(how) {
  if (!T) return; track(how, { step: T.i + 1 }); store.set(TOUR, TOUR_V); shut();
  const pn = $('panel'); if (pn) pn.scrollTop = 0; scrollTo(0, 0);   // back to the top, where the shapes are
  window.removeEventListener('keydown', tourKey, true); window.removeEventListener('resize', place); T.root.remove(); T = null; document.body.classList.remove('touring');
  if (current && !store.get(CARD + current.name)) showCard(current.name, current.title);   // then this explorer's own card
  if (how === 'tour_skip') laterHint();
}
// after a skip (or closing the shared-link bar): where the tour lives, for a few seconds, under the ? button
function laterHint() {
  const sw = $('helpBtn'); if (!sw) return; const old = $('tourHint'); if (old) old.remove();
  const r = sw.getBoundingClientRect(), seen = r.width > 0 && r.top >= 0 && r.bottom <= innerHeight;
  const h = document.createElement('div'); h.id = 'tourHint'; h.setAttribute('role', 'status');
  h.innerHTML = 'You can take the tour any time from the <b>?</b> button.';
  document.body.appendChild(h);
  if (seen) { const w = Math.min(280, innerWidth - 24), x = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - 28)); h.style.width = w + 'px'; h.style.left = x + 'px'; h.style.top = (r.bottom + 10) + 'px';
    h.style.setProperty('--arrowX', Math.round(r.left + r.width / 2 - x - 5) + 'px'); h.classList.add('arrow'); sw.classList.add('tourPulse'); }
  else h.classList.add('top');
  setTimeout(() => { h.classList.add('out'); sw.classList.remove('tourPulse'); }, 5500); setTimeout(() => h.remove(), 6200);
}

// ---------- the explorer's card ----------
// each explorer's own page (explore/<slug>.html: a fuller explanation, and what search engines find)
const PAGE = {"fractal": "fractals", "polytope": "4d-polytopes", "surface": "surfaces", "knot": "knots", "labyrinth": "labyrinths", "foam": "foams", "complex": "complex-functions", "attractor": "strange-attractors", "tiling": "tilings", "wave": "waves", "draw": "drawing-machines", "life": "growing-patterns"};
function showCard(name, title) {
  const c = CARDS[name]; if (!c) return; hideCard();
  const d = document.createElement('div'); d.id = 'xCard'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'About ' + title);
  d.innerHTML = `<div class="xcHead"><b>${title}</b><button class="xcX" aria-label="Close">✕</button></div><p>${c[0]}</p><div class="xcTry">Try this:</div><ul>${c[1].map(t => `<li>${t}</li>`).join('')}</ul><div class="xcBtns">${PAGE[name] ? `<a class="xcMore" href="explore/${PAGE[name]}.html" target="_blank" rel="noopener">More about it</a>` : ''}<button class="sbtn on" id="xcOk">Got it</button></div>`;
  $('stage').appendChild(d);
  const close = () => { store.set(CARD + name, '1'); track('card_dismiss', { explorer: name }); hideCard(); };
  d.querySelector('#xcOk').onclick = close; d.querySelector('.xcX').onclick = close;
  track('card_shown', { explorer: name });
}
const hideCard = () => { const d = $('xCard'); if (d) d.remove(); };

// ---------- the bar for someone arriving on a shared link ----------
function showBar(title) {
  if ($('tourBar')) return; const b = document.createElement('div'); b.id = 'tourBar';
  b.innerHTML = `<span>You're looking at <b>${title}</b>. New here?</span><button class="sbtn on" id="tbGo">Take the tour</button><button class="sbtn" id="tbX" aria-label="Close">✕</button>`;
  $('stage').appendChild(b);
  b.querySelector('#tbGo').onclick = () => { hideBar(); startTour('shared_link'); };
  b.querySelector('#tbX').onclick = () => { hideBar(); laterHint(); try { sessionStorage.setItem('mathexplorer.tourBar', '1'); } catch (e) { /* fine */ } };
}
const hideBar = () => { const b = $('tourBar'); if (b) b.remove(); };

// ---------- called by main.js each time an explorer comes on screen ----------
let current = null, waiting = null;
/** name, its title, and whether the address held a view (a shared link) */
// automated browsers (tests, preview tools) skip the first-visit help, unless asked for it
const AUTO = navigator.webdriver && !/[?&](analyticsTest|tourTest)/.test(location.search);
export function explorerShown(name, title, fromLink) {
  current = { name, title }; hideCard();
  if (AUTO) return;
  if (T) return;
  if (inZen()) { clearInterval(waiting); waiting = setInterval(() => { if (!inZen()) { clearInterval(waiting); explorerShown(name, title, false); } }, 1000); return; }   // nothing in full screen: wait until it ends
  if (store.get(TOUR) !== TOUR_V) {
    let barDone = false; try { barDone = sessionStorage.getItem('mathexplorer.tourBar') === '1'; } catch (e) { /* fine */ }
    if (fromLink) { if (!barDone) showBar(title); }
    else setTimeout(() => { if (current && current.name === name && !inZen() && !T) startTour('first_visit'); }, 900);
    return;
  }
  if (!store.get(CARD + name)) setTimeout(() => { if (current && current.name === name && !T && !inZen()) showCard(name, title); }, 700);
}
/** From the menu: the tour again, or this explorer's card again. */
export const takeTour = () => startTour('menu');
export const aboutThis = () => { if (current) showCard(current.name, current.title); };
