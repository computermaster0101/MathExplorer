// First visits: a five-step tour of what every explorer shares (the menu, moving round the picture, the panel, music, keeping
// what you make), and, the first time in each explorer, a small card saying what you're looking at and two things to try that
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

// ---------- the tour: five steps, each pointing at the real thing ----------
const STEPS = () => [
  { el: '#switcher', title: 'Welcome to Math Explorer', text: 'Twelve ways to see mathematics, all running live in your browser. Pick an explorer here. Play freely: you can\'t break anything.' },
  { el: '#stage', title: 'The picture', text: touch()
      ? 'Drag to move or turn it, pinch to zoom. Tap to pause or play, double-tap for full screen, press and hold to start afresh. In full screen a swipe changes the colours.'
      : 'Drag to move or turn it, scroll to zoom. On the keyboard the arrows and W A S D move you, G dives or flies, Space pauses and R starts afresh.' },
  { el: '#panel', title: 'The panel', text: 'Choose a shape at the top, then open any group to change how it moves, how it looks and its colours.', open: null },
  { el: '#g-sound', title: 'Music', text: 'Play a song (or listen to another tab), then press ♫ Visualizer: the picture moves with the beat and changes with the song.' },
  { el: '#stageBtns', title: 'Keep what you make', text: 'Go full screen here. Under Save, share & record you can save a picture, record a video or copy a link that reopens exactly this view. Press ? any time for every key.' },
];
let T = null;   // the open tour: { i, root, spot, tip }
function startTour(from) {
  if (T) return; hideBar(); hideCard();
  if (panelHidden()) togglePanel(false);
  const root = document.createElement('div'); root.id = 'tour'; root.innerHTML = '<div id="tourSpot"></div><div id="tourTip" role="dialog" aria-live="polite"></div>'; document.body.appendChild(root);
  T = { i: 0, root, spot: root.querySelector('#tourSpot'), tip: root.querySelector('#tourTip') }; document.body.classList.add('touring');   /* the consent bar waits until the tour is over */
  track('tour_start', { from }); window.addEventListener('keydown', tourKey, true); window.addEventListener('resize', place); step(0);
}
function step(i) {
  const S = STEPS(); T.i = i; const s = S[i], el = document.querySelector(s.el);
  if (el) { const r = el.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ block: r.height > innerHeight * 0.8 ? 'start' : 'center' }); }   // bring it into view (on a phone the panel is below the picture)
  T.tip.innerHTML = `<div class="ttStep">${i + 1} of ${S.length}</div><h3>${s.title}</h3><p>${s.text}</p>
    <div class="ttBtns"><button class="sbtn" id="ttSkip">${i === S.length - 1 ? 'Close' : 'Skip'}</button><span></span>${i ? '<button class="sbtn" id="ttBack">Back</button>' : ''}<button class="sbtn on" id="ttNext">${i === S.length - 1 ? 'Done' : 'Next'}</button></div>`;
  T.tip.querySelector('#ttNext').onclick = next; T.tip.querySelector('#ttSkip').onclick = () => endTour(i === S.length - 1 ? 'tour_complete' : 'tour_skip');
  const b = T.tip.querySelector('#ttBack'); if (b) b.onclick = () => step(i - 1);
  track('tour_step', { step: i + 1 }); setTimeout(place, 60); setTimeout(place, 400); T.tip.querySelector('#ttNext').focus();
}
const next = () => { if (T.i < STEPS().length - 1) step(T.i + 1); else endTour('tour_complete'); };
function place() {
  if (!T) return; const s = STEPS()[T.i], el = document.querySelector(s.el), vw = innerWidth, vh = innerHeight, pad = 6;
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
function tourKey(e) { if (!T || e.key === 'Tab') return; if (e.key === 'Escape') endTour('tour_skip'); else if (e.key === 'Enter' || e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft' && T.i) step(T.i - 1); e.preventDefault(); e.stopPropagation(); }
function endTour(how) {
  if (!T) return; track(how, { step: T.i + 1 }); store.set(TOUR, TOUR_V);
  window.removeEventListener('keydown', tourKey, true); window.removeEventListener('resize', place); T.root.remove(); T = null; document.body.classList.remove('touring');
  if (current && !store.get(CARD + current.name)) showCard(current.name, current.title);   // then this explorer's own card
}

// ---------- the explorer's card ----------
function showCard(name, title) {
  const c = CARDS[name]; if (!c) return; hideCard();
  const d = document.createElement('div'); d.id = 'xCard'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'About ' + title);
  d.innerHTML = `<div class="xcHead"><b>${title}</b><button class="xcX" aria-label="Close">✕</button></div><p>${c[0]}</p><div class="xcTry">Try this:</div><ul>${c[1].map(t => `<li>${t}</li>`).join('')}</ul><div class="xcBtns"><button class="sbtn on" id="xcOk">Got it</button></div>`;
  $('stage').appendChild(d);
  const close = () => { store.set(CARD + name, '1'); track('card_dismiss', { explorer: name }); hideCard(); };
  d.querySelector('#xcOk').onclick = close; d.querySelector('.xcX').onclick = close;
  track('card_shown', { explorer: name });
}
const hideCard = () => { const d = $('xCard'); if (d) d.remove(); };

// ---------- the bar for someone arriving on a shared link ----------
function showBar(title) {
  if ($('tourBar')) return; const b = document.createElement('div'); b.id = 'tourBar';
  b.innerHTML = `<span>You're looking at <b>${title}</b>. New here?</span><button class="sbtn on" id="tbGo">Take the 30-second tour</button><button class="sbtn" id="tbX" aria-label="Close">✕</button>`;
  $('stage').appendChild(b);
  b.querySelector('#tbGo').onclick = () => { hideBar(); startTour('shared_link'); };
  b.querySelector('#tbX').onclick = () => { hideBar(); try { sessionStorage.setItem('mathexplorer.tourBar', '1'); } catch (e) { /* fine */ } };
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
