// First visits (design pack U09): the first time in each explorer, a small card saying what you're looking at, one thing to
// try with a button that does it, and one more idea, all only that explorer has. On the very first visit that card is the
// welcome, offering the tour (every part of the interface, each step pointing at the real thing) rather than starting it;
// Help → Take the tour has it any time. Nothing here repeats the tour. Remembered on this device (localStorage; a session's worth when
// storage is blocked). Someone arriving on a shared link sees the picture they were sent, with a small bar offering the tour,
// rather than the tour on top of it; nothing appears in full screen.
import { inZen, panelHidden, togglePanel } from './layout.js';
import { track } from './analytics.js';
import { revealGroup, showSheet, sheetMode } from './sheet.js';
import { showAllButtons, isFolded, setFolded } from './toolbar.js';

const TOUR = 'mathexplorer.tour', TOUR_V = '2', CARD = 'mathexplorer.card.';
const mem = {}, store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { try { return sessionStorage.getItem(k); } catch (e2) { return mem[k] || null; } } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { try { sessionStorage.setItem(k, v); } catch (e2) { mem[k] = v; } } } };
const $ = id => document.getElementById(id), touch = () => matchMedia('(pointer: coarse)').matches;

// ---------- what each explorer is, and two things to try there (and only there) ----------
const CARDS = {
  fractal: ['Shapes made by repeating one simple rule over and over. Zoom into an edge and the detail never runs out.', ['Press <b>G</b> (or Dive) to zoom in deeper than any microscope', 'Open <b>3D</b> for fractals you can fly round'], ['Dive in', 'g']],
  polytope: ['Shapes from the fourth dimension, shown the way a cube casts a flat shadow: what you see is their shadow in our space.', ['Press <b>G</b> to fly inside it', 'Try <b>Slice</b>: watch the 4D shape pass through our 3D world'], ['Fly inside', 'g']],
  surface: ['Surfaces with surprises: some have only one side, others are soap films stretched as small as they can be.', ['Press <b>G</b> to walk round the Möbius band and come back upside down', 'Pick the <b>Klein bottle</b>: a bottle with no inside'], ['Walk round it', 'g']],
  knot: ['Knots as mathematicians see them: closed loops that can\'t be untied without cutting, and links of several loops.', ['Press <b>G</b> to ride the knot like a roller coaster', 'Pick the <b>Borromean rings</b>: no two are linked, yet all three hold together'], ['Ride it', 'g']],
  labyrinth: ['Endless surfaces that split space into two mazes, mazes to solve, and the ancient one-path labyrinths.', ['Press <b>G</b> to fly through an endless labyrinth', 'Pick <b>Race the solver</b> and try to beat the computer'], ['Fly through it', 'g']],
  foam: ['The ways soap bubbles can fill space, from Kelvin\'s 1887 guess to the record-holding Weaire–Phelan foam.', ['Press <b>G</b> to fly through the bubbles', 'Turn up <b>Pull apart</b> to see each bubble\'s shape'], ['Fly through it', 'g']],
  complex: ['Every point here is a number, coloured by where a function sends it. The colours wheel round each zero.', ['Place your own <b>zeros and poles</b> and drag them about', 'Raise <b>Steps</b> to grow a fractal out of the function'], ['Place zeros and poles', '[data-try="roots"]']],
  attractor: ['Chaos: a point following simple rules that never repeats, yet never leaves this shape.', ['Try <b>Butterfly effect</b>: two starts a hair apart end up far apart', 'Pick a map such as <b>Clifford</b> and watch millions of points build a picture'], ['Show the butterfly effect', '#mode button[data-m="butterfly"]']],
  tiling: ['Patterns that cover a surface with no gaps: on a ball, on the flat plane and on the curved hyperbolic plane.', ['Press <b>G</b> to glide through a hyperbolic tiling', 'Pick <b>The hat</b>: one shape that tiles without ever repeating'], ['Glide', 'g']],
  wave: ['Waves you can see: ripples adding up, a wave tank, sand on a ringing plate and a plucked string.', ['In the <b>Wave tank</b>, ' + (matchMedia('(pointer: coarse)').matches ? 'tap' : 'click') + ' in the water to splash', 'Try a <b>Chladni plate</b>: the sand gathers where the plate keeps still'], ['Open the wave tank', 'button[data-m="tank"]']],
  draw: ['Machines that draw: circles spinning on circles, gears rolling in rings, swinging pendulums and threads round a circle.', ['Add the circles <b>one by one</b> and watch a drawing build up', 'Press <b>Draw your own</b>: the circles will copy it'], ['Add them one by one', '#build:not(:checked)']],
  life: ['Patterns that grow by themselves, from simple rules about each cell\'s neighbours.', ['Try <b>Lenia</b>: smooth cells that move like creatures', 'Paint on the picture with the brush to start new life'], ['Try Lenia', 'button[data-m="lenia"]']],
};

// ---------- the tour of the 2026 interface: every part of it, each step pointing at the real thing ----------
// A step is { el, title, text (or a function), group?, prep?, show? }. A group step opens that panel group while it's shown
// (on a phone the sheet opens on its tab). prep() gets the part ready (opens the More row on a phone, unfolds a folded group
// of buttons, opens the sheet on a tab) and returns what undoes it, run before the next step and at the end. Steps whose part
// isn't in this explorer or mode (hidden) are left out, so the count is this explorer's own.
const visible = sel => { const el = document.querySelector(sel); return !!el && !el.closest('[hidden]'); };
const phone = () => sheetMode();
/** Make a group of the picture's buttons visible for a step: on a phone the More row, on a big screen unfold the group. */
const showBtns = g => () => {
  if (phone()) { const was = $('stageBtns').classList.contains('allOpen'); showAllButtons(true); return () => showAllButtons(was); }
  if (!g || !isFolded(g)) return null; setFolded(g, false, false); return () => setFolded(g, true, false);
};
const sheetOn = t => () => { showSheet(true, t); return () => showSheet(false); };
const speedWord = () => { const b = $('tbSlower'), t = b && b.dataset.tip; return t && t.includes(': ') ? t.split(': ')[1].toLowerCase() : 'the speed'; };
const TOUR_STEPS = () => [
  { el: '#topBar', title: 'Welcome to Math Explorer', text: 'Twelve ways to see mathematics, all running live in your browser. This tour shows you round every part of it: the buttons, the panel and the shortcuts. Play freely: you can\'t break anything. Skip any time; <b>Help</b> brings the tour back.' },
  { el: '#switcher', title: 'Choose an explorer', text: 'This shows the explorer on screen. Open it to pick another: fractals, 4D shapes, surfaces, knots, labyrinths, foams, complex functions, chaos, tilings, waves, drawing machines and growing patterns.' },
  { el: '#galleryBtn', title: 'All 12, as pictures', text: 'See every explorer as a picture and open whichever catches your eye.' },
  { el: '#helpBtn', title: 'Help', text: 'This tour, <b>About this explorer</b>, <b>Keyboard shortcuts</b>, <b>Report a problem</b>, privacy, the source code, the picture\'s frame, and the classic interface if you\'d rather have it back.' },
  { el: '#stage', title: 'The picture', text: () => touch()
      ? 'Drag to move or turn it, pinch to zoom, twist two fingers to turn a flat picture. Tap to go (dive, fly, ride…), tap again to pause; double-tap for full screen (<b>Exit</b> or a double-tap to leave it); press and hold to start afresh (<b>Undo</b> brings it back). In full screen, swipe left or right for colours, up or down for the next shape.'
      : 'Drag to move or turn it, scroll to zoom. On the keyboard the arrows and W A S D move you (Shift for faster), + and − zoom, G goes (dive, fly, ride…), Space pauses and R starts afresh.' },
  { el: '#stageBtns', title: 'The picture\'s buttons', text: () => 'Each button is named underneath. ' + (touch() ? 'Press and hold one to see its full name without pressing it.' : 'Point at one to see its full name and its key.') + ' In the middle they work like a music player.' },
  { el: '#tbOut', show: () => visible('#tbOut'), title: 'Zoom out and in', text: 'The magnifying glass at this end zooms out, the one at the other end zooms in. A press is one step; hold it to keep zooming.' },
  { el: '#tbSlower', show: () => visible('#tbSlower'), title: 'Slower and faster', text: () => 'These change ' + speedWord() + ': the one on the left slows it, the one on the right speeds it up.' },
  { el: '#tbPlay', title: () => visible('#tbRev') && visible('#tbFwd') ? 'Stop' : 'Play and pause', text: () => visible('#tbRev') && visible('#tbFwd')
      ? 'Stops the dive. It\'s lit while nothing is diving. Space still pauses everything that moves, and starts it again.'
      : 'Pauses everything that\'s moving, and starts it again (Space). With nothing moving it starts the main motion.' },
  { el: '#tbRev', show: () => visible('#tbRev') && visible('#tbFwd'), title: 'Backwards and forwards', text: '◀ dives out and ▶ dives in, at the same pace (Shift + G and G). The way it\'s going is lit; pressing it again after a pause carries on.' },
  { el: '#tbGo', show: () => visible('#tbGo'), prep: () => phone() && !$('stageBtns').classList.contains('goInline') ? showBtns('go')() : null, title: 'Go', text: () => 'Starts this explorer\'s own journey (G). Here it says <b>' + ($('tbGo').dataset.lbl || 'Go') + '</b>; in other explorers it flies, rides, walks or glides.' },
  { el: '#tbAll', show: phone, title: 'More buttons', text: 'The rest of the picture\'s buttons. It opens them as a row above the player; <b>Less</b> folds them away again.' },
  { el: '.tbGroup[data-group="view"]', prep: showBtns('view'), title: 'The view', text: () => '<b>Panel</b> hides or shows the panel (H). <b>Full screen</b> leaves nothing but the picture (F; ' + (touch() ? 'Exit or a double-tap' : 'Exit or Escape') + ' to come back). <b>Reset</b> puts the view back where it started (R); <b>Undo</b> and <b>Redo</b> step back and forward through your changes to the view and its settings (' + (/Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘Z, ⇧⌘Z' : 'Ctrl+Z, Ctrl+Shift+Z') + '), a reset included. <b>Frame</b> switches the picture between a frame and the full width.' },
  { el: '#tbSteer', show: () => visible('#tbSteer'), prep: showBtns('go'), title: 'Steer itself', text: 'Lets the explorer choose where to go, toward the most detail (T). It\'s lit while it\'s on.' },
  { el: '#tbExtra', show: () => visible('#tbExtra'), prep: showBtns('go'), title: 'This explorer\'s own button', text: () => 'Something only this explorer does. Here: ' + ($('tbExtra').dataset.tip || '').replace(/ \(.\)$/, '') + '.' },
  { el: '#musicBtn', prep: showBtns('more'), title: 'Music', text: 'Opens the music settings, and the <b>Visualizer</b>: full screen, the picture changing with the song.' },
  { el: '#tbShare', prep: showBtns('more'), title: 'Share, save and record', text: 'Copy a link that reopens exactly this view, share it, save a picture, record a video (as it plays, or a seamless loop), or download a 3D print.' },
  { el: '#panel', title: 'The panel', text: () => phone()
      ? 'Its four tabs along the bottom open it on one part: <b>Shapes</b>, <b>Colours</b>, <b>Music</b> and <b>Settings</b>. Tap the open tab again, or the picture, to fold it away.'
      : 'Everything you can change, in groups. Every explorer\'s panel is laid out in the same order: open any group to see inside.' },
  { el: '#panel', show: phone, prep: sheetOn('shapes'), title: 'Shapes', text: 'What you\'re looking at: choose a shape, and change the numbers that make it. Fractals and 4D Polytopes have their modes here too.' },
  { el: '#panel', show: phone, prep: sheetOn('colours'), title: 'Colours', text: 'Palettes and how the colours are laid on, plus Hue, Saturation and Light, and your own palette. Every explorer shares them.' },
  { el: '#panel', show: phone, prep: sheetOn('music'), title: 'Music', text: 'Play a song from your phone, use the microphone, and choose what reacts to it: beats, tempo, vocals, colour and energy.' },
  { el: '#panel', show: phone, prep: sheetOn('settings'), title: 'Settings', text: 'Everything else, in groups: the controls, how it moves by itself, how it\'s drawn, saving and sharing, numbers, Learn, 3D print and keys.' },
  { el: '#g-shapes', group: true, show: () => !phone(), title: 'Shapes', text: 'What you\'re looking at: choose a shape, and change the numbers that make it.' },
  { el: '#g-ctl', group: true, show: () => !phone() && visible('#g-ctl'), title: 'Controls', text: 'Things to do and play with: start, step, ride, fly, solve, paint, presets.' },
  { el: '#g-motion, #g-rot', group: true, show: () => !phone() && visible('#g-motion, #g-rot'), title: 'Motion', text: 'Everything that moves by itself: keep turning, glide, drift, zoom, and slowly changing the shape.' },
  { el: '#g-view', group: true, show: () => !phone() && visible('#g-view'), title: 'View & detail', text: 'How it\'s drawn: detail, quality, what\'s shown and how.' },
  { el: '#g-style', group: true, show: () => !phone(), title: 'Colour & style', text: 'Palettes and how the colours are laid on, plus Hue, Saturation and Light, and your own palette.' },
  { el: '#g-sound', group: true, show: () => !phone(), title: 'Music & sound', text: 'Play a song from your computer, use the microphone, or listen to another tab (YouTube, Spotify…). Choose what reacts: beats, tempo, vocals, colour and energy.' },
  { el: '#g-share', group: true, show: () => visible('#g-share'), title: 'Save, share & record', text: 'Save a picture of exactly what you see, record a video with the music, or a seamless loop. <b>Copy link</b> reopens this very view for anyone you send it to; paste one under <b>Load a view</b>.' },
  { el: '#g-info', group: true, show: () => visible('#g-info'), title: 'Numbers', text: 'Live numbers about what\'s on screen.' },
  { el: '#g-learn', group: true, show: () => visible('#g-learn'), title: 'Learn', text: 'The mathematics in plain English, with buttons that show you each idea.' },
  { el: '#g-print', group: true, show: () => visible('#g-print'), title: '3D print', text: 'Download what you\'re looking at as an STL file, ready for a 3D printer, at the size you choose.' },
  { el: '#g-keys', group: true, show: () => visible('#g-keys'), title: 'Keyboard shortcuts', text: () => (touch() ? 'With a keyboard, every key for this explorer is listed here. ' : 'Every key for this explorer is listed here. ') + '<b>Navigation speed</b> sets how fast you move, and <b>Invert up / down</b> flips the arrows.' },
  { el: '#helpBtn', title: 'That\'s everything', text: 'Each explorer also shows a card the first time you open it, with two things to try. <b>Help</b> brings this tour back, and <b>Report a problem</b> tells us when something\'s wrong. Enjoy exploring!' },
].filter(s => !s.show || s.show());
const STEPS = TOUR_STEPS;
let T = null;   // the open tour: { i, root, spot, tip }
function startTour(from) {
  if (T) return; hideBar(); hideCard();
  if (panelHidden()) togglePanel(false);
  const root = document.createElement('div'); root.id = 'tour'; root.innerHTML = '<div id="tourSpot"></div><div id="tourTip" role="dialog" aria-labelledby="ttTitle" aria-live="polite"></div>'; document.body.appendChild(root);
  T = { i: 0, undo: [], from: document.activeElement, root, spot: root.querySelector('#tourSpot'), tip: root.querySelector('#tourTip') }; document.body.classList.add('touring');   /* the consent bar stays on top; the tour keeps clear of it (see room()) */
  track('tour_start', { from }); window.addEventListener('keydown', tourKey, true); window.addEventListener('resize', place); step(0);
}
function step(i) {
  const S = STEPS(); T.i = Math.max(0, Math.min(i, S.length - 1)); i = T.i; const s = S[i];
  shut();   // undo the last step's preparations (a group opened, the More row, the sheet)
  if (s.prep) { const u = s.prep(); if (u) T.undo.push(u); }
  const el = document.querySelector(s.el);
  if (s.group && el) { if (!el.open) { el.open = true; T.undo.push(() => { el.open = false; }); } if (phone()) { revealGroup(el); T.undo.push(() => showSheet(false)); } }
  else if (phone() && !s.prep && s.el !== '#panel') showSheet(false);   // the picture's steps: the sheet folded out of the way
  if (el && !phone()) { const r = el.getBoundingClientRect(); if (r.top < 0 || r.bottom > room()) el.scrollIntoView({ block: r.height > innerHeight * 0.8 ? 'start' : 'center' }); }
  const title = typeof s.title === 'function' ? s.title() : s.title, text = typeof s.text === 'function' ? s.text() : s.text;
  T.tip.innerHTML = `<div class="ttStep">${i + 1} of ${S.length}</div><h3 id="ttTitle">${title}</h3><p>${text}</p>
    <div class="ttBtns"><button class="sbtn" id="ttSkip">${i === S.length - 1 ? 'Close' : 'Skip'}</button><span></span>${i ? '<button class="sbtn" id="ttBack">Back</button>' : ''}<button class="sbtn on" id="ttNext">${i === S.length - 1 ? 'Done' : 'Next'}</button></div>`;
  T.tip.querySelector('#ttNext').onclick = next; T.tip.querySelector('#ttSkip').onclick = () => endTour(i === S.length - 1 ? 'tour_complete' : 'tour_skip');
  const b = T.tip.querySelector('#ttBack'); if (b) b.onclick = () => step(i - 1);
  track('tour_step', { step: i + 1 }); setTimeout(place, 60); setTimeout(place, 320); T.tip.querySelector('#ttNext').focus();
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
// (design pack U03): Enter or Space on Skip, Back or Next presses that button, as buttons do; Tab goes round the card's buttons
function tourKey(e) {
  if (!T || (e.target.closest && e.target.closest('#consentBar,.modalBack'))) return;   /* the consent bar and privacy note keep their own keys */
  const onBtn = e.target.closest && e.target.closest('#tourTip button');
  if (e.key === 'Tab') { const b = [...T.tip.querySelectorAll('button')], i = b.indexOf(document.activeElement); if (b.length) { b[(i < 0 ? 0 : i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus(); e.preventDefault(); } e.stopPropagation(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && onBtn) { e.stopPropagation(); return; }
  if (e.key === 'Escape') endTour('tour_skip'); else if (e.key === 'Enter' || e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft' && T.i) step(T.i - 1);
  e.preventDefault(); e.stopPropagation();
}
const shut = () => { if (!T) return; while (T.undo.length) { try { T.undo.pop()(); } catch (e) { /* already undone */ } } };
function endTour(how) {
  if (!T) return; track(how, { step: T.i + 1 }); store.set(TOUR, TOUR_V); shut(); showSheet(false); showAllButtons(false);
  const pn = $('panel'); if (pn) pn.scrollTop = 0; scrollTo(0, 0);   // back to the top, where the shapes are
  window.removeEventListener('keydown', tourKey, true); window.removeEventListener('resize', place); T.root.remove(); const from = T.from; T = null; document.body.classList.remove('touring');
  // focus goes back where it was (Help's item is gone by now: then the Help button), unless the tour opened by itself
  if (from && from !== document.body) { const to = from.isConnected && from.offsetParent ? from : $('helpBtn'); if (to && to.offsetParent) to.focus(); }
  if (current && !store.get(CARD + current.name)) showCard(current.name, current.title);   // then this explorer's own card
  if (how === 'tour_skip') laterHint();
}
// after a skip (or closing the shared-link bar): where the tour lives, for a few seconds, under the ? button
function laterHint() {
  const hb = $('helpBtn'), sw = hb && hb.getBoundingClientRect().width ? hb : document.querySelector('.tbGroup[data-group="more"] .tbHandle'); if (!sw) return; const old = $('tourHint'); if (old) old.remove();
  const r = sw.getBoundingClientRect(), seen = r.width > 0 && r.top >= 0 && r.bottom <= innerHeight;
  const h = document.createElement('div'); h.id = 'tourHint'; h.setAttribute('role', 'status');
  h.innerHTML = 'You can take the tour any time from <b>Help</b>.';
  document.body.appendChild(h);
  if (seen) { const w = Math.min(280, innerWidth - 24), x = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - 28)); h.style.width = w + 'px'; h.style.left = x + 'px'; h.style.top = (r.bottom + 10) + 'px';
    h.style.setProperty('--arrowX', Math.round(r.left + r.width / 2 - x - 5) + 'px'); h.classList.add('arrow'); sw.classList.add('tourPulse'); }
  else h.classList.add('top');
  setTimeout(() => { h.classList.add('out'); sw.classList.remove('tourPulse'); }, 5500); setTimeout(() => h.remove(), 6200);
}

// ---------- the explorer's card ----------
// each explorer's own page (explore/<slug>.html: a fuller explanation, and what search engines find)
const PAGE = {"fractal": "fractals", "polytope": "4d-polytopes", "surface": "surfaces", "knot": "knots", "labyrinth": "labyrinths", "foam": "foams", "complex": "complex-functions", "attractor": "strange-attractors", "tiling": "tilings", "wave": "waves", "draw": "drawing-machines", "life": "growing-patterns"};
// The card (design pack U09): what you're looking at, one thing to try with a button that does it, and a second idea.
// On a first visit it is also the welcome, with Take the tour beside it: the tour is offered, never started by itself.
// Closing it (✕, Got it), trying the suggestion or taking the tour all count as an answer and are remembered.
function showCard(name, title, welcome = false) {
  const c = CARDS[name]; if (!c) return; hideCard();
  /* on a touch screen G is a tap on the picture (layout.js), so the cards say so */
  const [desc, tries0, act] = c, tries = touch() ? tries0.map(t => t.replace(/Press <b>G<\/b>( \(or Dive\))?/, 'Tap the picture')) : tries0, doable = act && (act[1] === 'g' || document.querySelector(act[1]));
  const d = document.createElement('div'); d.id = 'xCard'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-labelledby', 'xcTitle');
  if (welcome) d.classList.add('welcome');
  d.innerHTML = `${welcome ? '<div class="xcHi">Welcome to Math Explorer</div>' : ''}<div class="xcHead"><b id="xcTitle">${title}</b><button class="xcX" aria-label="Close">✕</button></div><p>${desc}</p>`
    + `<div class="xcTry">Try this:</div><div class="xcDo"><span>${tries[0]}</span>${doable ? `<button class="sbtn on" id="xcGo">${act[0]}</button>` : ''}</div>`
    + (tries[1] ? `<p class="xcAlso">Or: ${tries[1]}</p>` : '')
    + `<div class="xcBtns">${PAGE[name] ? `<a class="xcMore" href="explore/${PAGE[name]}.html" target="_blank" rel="noopener">More about it</a>` : ''}${welcome ? '<button class="sbtn" id="xcTour">Take the tour</button>' : ''}<button class="sbtn${doable ? '' : ' on'}" id="xcOk">${welcome ? 'Not now' : 'Got it'}</button></div>`;
  $('stage').appendChild(d);
  const answered = how => { store.set(CARD + name, '1'); if (welcome) store.set(TOUR, TOUR_V); track('card_dismiss', { explorer: name, how }); hideCard(); };
  const close = () => { answered('close'); if (welcome) laterHint(); };
  d.querySelector('#xcOk').onclick = close; d.querySelector('.xcX').onclick = close;
  d.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  const go = d.querySelector('#xcGo');
  if (go) go.onclick = () => {
    answered('try');
    if (act[1] === 'g') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', bubbles: true, cancelable: true }));
    else { const el = document.querySelector(act[1]); if (el) { const g = el.closest('details.grp'); if (g) g.open = true; el.click(); } }
    track('card_try', { explorer: name });
  };
  const tb = d.querySelector('#xcTour'); if (tb) tb.onclick = () => { answered('tour'); startTour('first_visit'); };
  track('card_shown', { explorer: name, welcome: welcome ? 1 : 0 });
}
const hideCard = () => { const d = $('xCard'); if (d) d.remove(); };

// ---------- the bar for someone arriving on a shared link ----------
function showBar(title) {
  if ($('tourBar')) return; const b = document.createElement('div'); b.id = 'tourBar';
  b.innerHTML = `<span>You're looking at <b>${title}</b>. New here?</span><button class="sbtn on" id="tourBarGo">Take the tour</button><button class="sbtn" id="tourBarX" aria-label="Close">✕</button>`;
  $('stage').appendChild(b);
  b.querySelector('#tourBarGo').onclick = () => { hideBar(); startTour('shared_link'); };
  b.querySelector('#tourBarX').onclick = () => { hideBar(); laterHint(); try { sessionStorage.setItem('mathexplorer.tourBar', '1'); } catch (e) { /* fine */ } };
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
    if (fromLink) { if (!barDone) showBar(title); }   /* a shared link keeps the picture it was sent with: just a small bar offering the tour */
    else setTimeout(() => { if (current && current.name === name && !inZen() && !T) showCard(name, title, true); }, 700);   /* the welcome: one suggestion, the tour if they want it; it doesn't wait for the consent bar, and doesn't block anything */
    return;
  }
  if (!store.get(CARD + name)) setTimeout(() => { if (current && current.name === name && !T && !inZen()) showCard(name, title); }, 700);
}
/** From the menu: the tour again, or this explorer's card again. */
export const takeTour = () => startTour('menu');
export const aboutThis = () => { if (current) showCard(current.name, current.title); };
