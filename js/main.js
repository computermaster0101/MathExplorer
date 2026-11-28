// Math Explorer shell: one page, one layout, several explorers.
//
// Each explorer lives in explorers/<name>/ with
//   stage.html  canvases, title and legend, mounted into the stage
//   panel.html  its controls, mounted into the side panel
//   style.css   rules scoped with .app[data-explorer="<name>"] (linked from index.html)
//   index.js    entry module; importing it boots the explorer, and it exports the lifecycle below
//
// Lifecycle exports of explorers/<name>/index.js:
//   start()             begin (or resume) drawing; called each time the explorer comes on screen
//   stop()              stop drawing; called when another explorer takes over
//   reset()             the "Reset view" button
//   onKey(event)        a keydown the shell didn't use; return true when the explorer used it
//   layoutChanged()     the panel was hidden or shown, or full screen started or ended
//   showView(code, force) the address changed to a view code (a pasted link, back/forward); force (Undo after a reset): apply it even if it's the code the explorer last wrote
//   moving()            optional: true while anything moves that Space would pause; false shows the picture's play icon
//   going()             optional: true while diving / flying / riding / walking, so a tap on a phone pauses rather than goes
//   goLabel()           optional: what the picture's Go button (G) is called right now, e.g. 'Dive in'; null hides it
//   extraCtl()          optional: one button of the explorer's own on the picture: { label, icon, on, run }; null hides it
//   autoCtl()           optional: the target button, what steers itself here: { label, on } (T toggles it); null hides it
//   canZoom()           optional: false hides the zoom buttons (they send the wheel to the middle of the picture)
//   speedCtl()          optional: what its slower / faster buttons move: a range input's id, { id, invert }, or { label, step(dir) }; null hides them
//   reverseCtl()        optional: the play-backwards button next to play: { label, on, run } (Fractals: dive out); null hides it
//   forwardCtl()        optional: the play-forwards button after it, the same shape (Fractals: dive in)
//   stopCtl()           optional, with both: play / pause becomes a stop button, the same shape (Fractals: stop the dive, lit while stopped)
//
// Only one explorer is attached to the page at a time: the others' DOM is kept, detached, so their
// element ids never clash and their own document queries only ever see their own controls.
import { parseRoute, DEFAULT_EXPLORER, setActiveExplorer, setBootRoute, restoreHash } from './shell/route.js';
const HOME_TITLE = document.title; let bareHome = !location.hash;   // opened at the plain address: keep the home title until the visitor moves on
import { onLayoutChange, setGoing } from './shell/layout.js';
import { setToolbarExplorer } from './shell/toolbar.js';
import './shell/perf.js';   // slow graphics: a notice, lighter starts, and recovery when the graphics card resets
import { setKeyHandler, syncKeyPrefs } from './shell/keys.js';
import { colourFromCode, colourSync } from './common/colours.js';
import { sleepIn, wakeIn } from './common/gl.js';
import { soundGroup, setSoundHelp } from './shell/audio/panel.js';
import { pageView, consentBar, showPrivacy } from './shell/analytics.js';
import { explorerShown, takeTour, aboutThis } from './shell/tour.js';
import { openReport } from './shell/report.js';
import { menuKeys } from './shell/a11y.js';
import { resetWithUndo } from './shell/undo.js';
import { calm } from './shell/calm.js';
import './shell/basic.js';   // fewer settings / all settings in the panel
import './shell/names.js';   // names and chosen states for screen readers in every panel
import './shell/history.js';   // Undo / Redo for the view (the View group, Ctrl+Z)
import './shell/gallery.js';
import './shell/sheet.js';   // phones: the panel as a bottom sheet with four tabs   // every explorer as a picture (the top bar's All 12)
import './shell/haptics.js';   // vibration on touch, where the phone can (the setting in Music & sound)

const EXPLORERS = {
  fractal:   { title: 'Fractals' },
  polytope:  { title: '4D Polytopes' },
  surface:   { title: 'Surfaces' },
  knot:      { title: 'Knots & Links' },
  labyrinth: { title: 'Labyrinths' },
  foam:      { title: 'Foams' },
  complex:   { title: 'Complex Functions' },
  attractor: { title: 'Strange Attractors' },
  tiling:    { title: 'Tilings' },
  wave:      { title: 'Waves & Cymatics' },
  draw:      { title: 'Drawing Machines' },
  life:      { title: 'Growing Patterns' },
};

const $ = id => document.getElementById(id);
const app = $('app'), stage = $('stage'), panel = $('panel'), loading = $('loading');
const loaded = {};   // name -> Promise of the explorer's index.js module
const views = {};    // name -> {stageEl, panelEl}, its DOM, attached or not
let current = null;  // name of the explorer on screen
let started = null;  // the one whose start() has run (a load overtaken by a newer navigation is on screen but not started)

const fileUrl = (name, file) => new URL(`../explorers/${name}/${file}`, import.meta.url);
const fetchText = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${url.pathname}: ${r.status}`); return r.text(); };

const tries = {};   // name -> failed loads so far: a retry asks for index.js afresh, past any failure the browser kept
async function mount(name, code) {
  const [stageHtml, panelHtml] = await Promise.all([fetchText(fileUrl(name, 'stage.html')), fetchText(fileUrl(name, 'panel.html'))]);
  const stageEl = Object.assign(document.createElement('div'), { className: 'explorer-stage', innerHTML: stageHtml });
  const panelEl = Object.assign(document.createElement('div'), { className: 'explorer-panel', innerHTML: panelHtml });
  views[name] = { stageEl, panelEl };
  if (current === name) attach(views[name]);   // the explorer's modules look up their elements as they load
  const url = fileUrl(name, 'index.js'); if (tries[name]) url.search = '?retry=' + tries[name];
  setBootRoute({ explorer: name, code });   // what its parseRoute() reads at boot, whatever the address says by now
  try { return await import(url.href); } finally { setBootRoute(null); }
}

// shared panel groups (Music & sound) sit inside the active explorer's panel, right after its Colour & style group
function attach({ stageEl, panelEl }) {
  stage.insertBefore(stageEl, $('stageBtns')); panel.append(panelEl); syncKeyPrefs(panelEl);
  $('vizStageBtn').hidden = true;   // the explorer's Visualizer (js/common/visualizer.js) shows it again if it has one
  const ctl = panelEl.querySelector('#g-style');
  panelEl.insertBefore(soundGroup, ctl ? ctl.nextSibling : null);
}
function detach({ stageEl, panelEl }) { $('shellParts').append(soundGroup); stageEl.remove(); panelEl.remove(); }

function markSwitcher(name) {
  for (const a of document.querySelectorAll('#switcher a')) { const on = a.dataset.explorer === name; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  $('xName').textContent = EXPLORERS[name].title;
  // the bare home page keeps its full, descriptive title (what search results show); an explorer's own address names it
  document.title = bareHome && name === DEFAULT_EXPLORER ? HOME_TITLE : `${EXPLORERS[name].title} · Math Explorer`;
}

let queue = Promise.resolve();
// how the visitor got to the explorer, for analytics: 'home' (the plain address, or one naming no explorer, opened the
// default), 'link' (an address naming an explorer: a shared link, a bookmark, a search result), 'menu' (moved there inside
// the app: the explorer menu, a link between explorers, back / forward). Lets the default explorer's opens be told apart.
// Each navigation carries the address it was made for and a number: the address may be rewritten before its turn comes
// (an explorer still loading wrote its own view over it, and the visitor's choice was lost), and a load that a newer
// navigation has overtaken is not started.
let navGen = 0;
const route = (via, hash = location.hash) => { const gen = ++navGen; queue = queue.then(() => show(via, hash, gen)).catch(e => console.error(e)); };

// shapes that moved to their own explorer: old links to them still open them, in their new home
const MOVED = { surface: { knot: ['unknot', 'trefoil', 'figure8', 'cinquefoil', 'torusknot', 'lissajous', 'k61', 'k62', 'k63', 'k72', 'k73', 'k74', 'granny', 'square', 'hopf', 'solomon', 'whitehead', 'chain', 'olympic', 'borromean'],
  labyrinth: ['gyroid', 'schwarzP', 'schwarzD', 'neovius', 'lidinoid', 'iwp'] } };
// Waves' epicycles moved to Drawing Machines: an old Waves epicycle link becomes the same drawing there
function epicyclesMoved(name, code) { const p = new URLSearchParams(code); if (name !== 'wave' || p.get('m') !== 'epi') return null;
  const q = new URLSearchParams(), c = p.get('c') || 'heart'; q.set('k', c === 'own' ? 'own' : 'e_' + c); if (p.has('n')) q.set('n', p.get('n')); if (p.get('ci') === '0') q.set('mc', '0'); if (p.get('tg') === '1') q.set('tg', '1');
  for (const k of ['own', 'pal', 'rev', 'cyc', 'bg', 'spd']) if (p.has(k)) q.set(k, p.get(k)); return ['draw', q.toString()]; }
function movedTo(name, code) { const m = MOVED[name], k = new URLSearchParams(code).get('s'); if (!m || !k) return null; for (const to in m) if (EXPLORERS[to] && m[to].includes(k)) return to; return null; }

async function show(via, hash, gen) {
  let { explorer: name, code } = parseRoute(hash);
  const to = movedTo(name, code); if (to) { name = to; try { history.replaceState(null, '', '#/' + name + '/' + code); } catch (e) { /* sandboxed */ } }
  const ep = epicyclesMoved(name, code); if (ep) { [name, code] = ep; try { history.replaceState(null, '', '#/' + name + '/' + code); } catch (e) { /* sandboxed */ } }
  if (!EXPLORERS[name]) { if (via === 'link') via = 'home'; name = DEFAULT_EXPLORER; code = ''; try { history.replaceState(null, '', '#/' + name); } catch (e) { /* sandboxed */ } }
  colourFromCode(code);   // a link's colour adjustments (shared by every explorer), before the explorer reads the rest
  if (name === current && started === name) { setActiveExplorer(name); if (code) { (await loaded[name]).showView?.(code); colourSync(); } return; }

  if (current && current !== name) {
    started = null; (await loaded[current]?.catch(() => null))?.stop?.();
    // its WebGL contexts sleep until it's back: browsers keep only a few alive per page (js/common/gl.js)
    if (views[current]) { sleepIn(views[current].stageEl); detach(views[current]); }
  }
  current = name; setActiveExplorer(name); app.dataset.explorer = name; markSwitcher(name);
  setKeyHandler(null); onLayoutChange(() => {}); setToolbarExplorer(null);

  const first = !loaded[name];
  if (first) loaded[name] = mount(name, code);   // boots with this view code
  else if (views[name]) attach(views[name]);
  loading.textContent = 'Loading…'; loading.hidden = false;
  let api;
  try { api = await loaded[name]; }
  catch (e) {
    console.error(e);
    // a failure the explorer already explained on the stage (no WebGL 2, say) needs no second message, and won't mend
    if (e.shown) { loading.hidden = true; return; }
    loading.textContent = `This explorer couldn't start: ${e.message}`;
    // anything else (a file that failed to arrive) is tried again next time: the failed load isn't kept
    tries[name] = (tries[name] || 0) + 1; delete loaded[name];
    if (views[name]) { if (current === name) detach(views[name]); delete views[name]; }
    return;
  }
  loading.hidden = true;
  if (current !== name || gen !== navGen) return;   // the user moved on while it loaded (the next show stops and detaches it)

  if (!first) wakeIn(views[name].stageEl);   // asynchronous: each surface redraws when the browser hands its context back
  if (!first && code) api.showView?.(code);
  setKeyHandler(api.onKey); setGoing(api.going); onLayoutChange(() => api.layoutChanged?.()); setSoundHelp(api.soundHelp);
  api.start?.(); started = name; colourSync(); setToolbarExplorer(api);
  // Calm motion (js/shell/calm.js): the picture opens still; the Paused tag (and the player's play icon) say how to start it
  if (calm()) setTimeout(() => { if (current === name && started === name && $('pausedTag').hidden && (!api.moving || api.moving())) document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })); }, 500);
  pageView(name, EXPLORERS[name].title, via); explorerShown(name, EXPLORERS[name].title, !!code);   // analytics (names only), and first-visit help
}

// the explorer menu: the button opens the list; choosing one (or clicking elsewhere, or Esc) closes it
const xBtn = $('xBtn'), xList = $('xList');
const setMenu = open => { xList.hidden = !open; xBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); if (open) (xList.querySelector('a.on') || xList.querySelector('a')).focus(); };
xBtn.addEventListener('click', () => setMenu(xList.hidden));
document.addEventListener('pointerdown', e => { if (!xList.hidden && !e.target.closest('#switcher')) setMenu(false); });
document.addEventListener('keydown', e => { if (!xList.hidden && e.key === 'Escape') { setMenu(false); xBtn.focus(); e.stopPropagation(); } }, true);
menuKeys(xList, xBtn, () => setMenu(false), 'a');   // ↑ ↓ Home End move through the twelve, Tab closes
// clicking the explorer already on screen would drop its view code from the address
$('switcher').addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; setMenu(false); if (a.dataset.explorer === current) e.preventDefault(); });
// the menu's extras: the tour again, this explorer's card again, and the privacy note
// the ? menu's items (js/shell/layout.js opens and closes it)
$('tourAgain').addEventListener('click', () => takeTour());
$('aboutThis').addEventListener('click', () => aboutThis());
$('privacyBtn').addEventListener('click', () => showPrivacy());
$('reportBtn').addEventListener('click', () => openReport());
consentBar();
$('resetBtn').addEventListener('click', async () => { if (!current) return; const api = await loaded[current].catch(() => null); if (api && api.reset) resetWithUndo(() => { api.reset(); }); });   // with Undo (js/shell/undo.js)
// until the new address is shown, no explorer may rewrite it (one still loading would put its own view over the choice)
window.addEventListener('hashchange', () => { bareHome = false; setActiveExplorer(null); route('menu'); });
// Undo after a reset (js/shell/undo.js): the view code from just before goes back to the explorer on screen, as a link would
window.addEventListener('mx:view', async e => {
  const { explorer: name, code } = parseRoute(e.detail); if (!code || name !== current || started !== name) return;
  restoreHash(e.detail);
  colourFromCode(code); (await loaded[name]).showView?.(code, true); colourSync();   // true: even if it's the code the explorer wrote last
});
route(bareHome ? 'home' : 'link');
