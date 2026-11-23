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
//   showView(code)      the address changed to a view code (a pasted link, back/forward)
//   moving()            optional: true while anything moves that Space would pause; false shows the picture's play icon
//   going()             optional: true while diving / flying / riding / walking, so a tap on a phone pauses rather than goes
//   goLabel()           optional: what the picture's Go button (G) is called right now, e.g. 'Dive in'; null hides it
//   extraCtl()          optional: one button of the explorer's own on the picture: { label, icon, on, run }; null hides it
//   autoCtl()           optional: the target button, what steers itself here: { label, on } (T toggles it); null hides it
//   canZoom()           optional: false hides the zoom buttons (they send the wheel to the middle of the picture)
//   speedCtl()          optional: what its slower / faster buttons move: a range input's id, { id, invert }, or { label, step(dir) }; null hides them
//
// Only one explorer is attached to the page at a time: the others' DOM is kept, detached, so their
// element ids never clash and their own document queries only ever see their own controls.
import { parseRoute, DEFAULT_EXPLORER, setActiveExplorer } from './shell/route.js';
const HOME_TITLE = document.title; let bareHome = !location.hash;   // opened at the plain address: keep the home title until the visitor moves on
import { onLayoutChange, setGoing } from './shell/layout.js';
import { setToolbarExplorer } from './shell/toolbar.js';
import './shell/perf.js';   // slow graphics: a notice, lighter starts, and recovery when the graphics card resets
import { setKeyHandler, syncKeyPrefs } from './shell/keys.js';
import { colourFromCode, colourSync } from './common/colours.js';
import { soundGroup, setSoundHelp } from './shell/audio/panel.js';
import { pageView, consentBar, showPrivacy } from './shell/analytics.js';
import { explorerShown, takeTour, aboutThis } from './shell/tour.js';
import { openReport } from './shell/report.js';

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

const fileUrl = (name, file) => new URL(`../explorers/${name}/${file}`, import.meta.url);
const fetchText = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${url.pathname}: ${r.status}`); return r.text(); };

async function mount(name) {
  const [stageHtml, panelHtml] = await Promise.all([fetchText(fileUrl(name, 'stage.html')), fetchText(fileUrl(name, 'panel.html'))]);
  const stageEl = Object.assign(document.createElement('div'), { className: 'explorer-stage', innerHTML: stageHtml });
  const panelEl = Object.assign(document.createElement('div'), { className: 'explorer-panel', innerHTML: panelHtml });
  views[name] = { stageEl, panelEl };
  if (current === name) attach(views[name]);   // the explorer's modules look up their elements as they load
  return import(fileUrl(name, 'index.js').href);
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
  for (const a of document.querySelectorAll('#switcher a')) a.classList.toggle('on', a.dataset.explorer === name);
  $('xName').textContent = EXPLORERS[name].title;
  // the bare home page keeps its full, descriptive title (what search results show); an explorer's own address names it
  document.title = bareHome && name === DEFAULT_EXPLORER ? HOME_TITLE : `${EXPLORERS[name].title} · Math Explorer`;
}

let queue = Promise.resolve();
const route = () => { queue = queue.then(show).catch(e => console.error(e)); };

// shapes that moved to their own explorer: old links to them still open them, in their new home
const MOVED = { surface: { knot: ['unknot', 'trefoil', 'figure8', 'cinquefoil', 'torusknot', 'lissajous', 'k61', 'k62', 'k63', 'k72', 'k73', 'k74', 'granny', 'square', 'hopf', 'solomon', 'whitehead', 'chain', 'olympic', 'borromean'],
  labyrinth: ['gyroid', 'schwarzP', 'schwarzD', 'neovius', 'lidinoid', 'iwp'] } };
// Waves' epicycles moved to Drawing Machines: an old Waves epicycle link becomes the same drawing there
function epicyclesMoved(name, code) { const p = new URLSearchParams(code); if (name !== 'wave' || p.get('m') !== 'epi') return null;
  const q = new URLSearchParams(), c = p.get('c') || 'heart'; q.set('k', c === 'own' ? 'own' : 'e_' + c); if (p.has('n')) q.set('n', p.get('n')); if (p.get('ci') === '0') q.set('mc', '0'); if (p.get('tg') === '1') q.set('tg', '1');
  for (const k of ['own', 'pal', 'rev', 'cyc', 'bg', 'spd']) if (p.has(k)) q.set(k, p.get(k)); return ['draw', q.toString()]; }
function movedTo(name, code) { const m = MOVED[name], k = new URLSearchParams(code).get('s'); if (!m || !k) return null; for (const to in m) if (EXPLORERS[to] && m[to].includes(k)) return to; return null; }

async function show() {
  let { explorer: name, code } = parseRoute();
  const to = movedTo(name, code); if (to) { name = to; try { history.replaceState(null, '', '#/' + name + '/' + code); } catch (e) { /* sandboxed */ } }
  const ep = epicyclesMoved(name, code); if (ep) { [name, code] = ep; try { history.replaceState(null, '', '#/' + name + '/' + code); } catch (e) { /* sandboxed */ } }
  if (!EXPLORERS[name]) { name = DEFAULT_EXPLORER; code = ''; try { history.replaceState(null, '', '#/' + name); } catch (e) { /* sandboxed */ } }
  colourFromCode(code);   // a link's colour adjustments (shared by every explorer), before the explorer reads the rest
  if (name === current) { if (code) { (await loaded[name]).showView?.(code); colourSync(); } return; }

  if (current) {
    (await loaded[current].catch(() => null))?.stop?.();
    if (views[current]) detach(views[current]);
  }
  current = name; setActiveExplorer(name); app.dataset.explorer = name; markSwitcher(name);
  setKeyHandler(null); onLayoutChange(() => {}); setToolbarExplorer(null);

  const first = !loaded[name];
  if (first) loaded[name] = mount(name);   // boots with the view code in the address
  else if (views[name]) attach(views[name]);
  loading.textContent = 'Loading…'; loading.hidden = false;
  let api;
  try { api = await loaded[name]; }
  catch (e) {
    console.error(e);
    // a failure the explorer already explained on the stage (no WebGL 2, say) needs no second message
    if (e.shown) loading.hidden = true; else loading.textContent = `This explorer couldn't start: ${e.message}`;
    return;
  }
  loading.hidden = true;
  if (current !== name) return;            // the user moved on while it loaded

  if (!first && code) api.showView?.(code);
  setKeyHandler(api.onKey); setGoing(api.going); onLayoutChange(() => api.layoutChanged?.()); setSoundHelp(api.soundHelp);
  api.start?.(); colourSync(); setToolbarExplorer(api);
  pageView(name, EXPLORERS[name].title); explorerShown(name, EXPLORERS[name].title, !!code);   // analytics (names only), and first-visit help
}

// the explorer menu: the button opens the list; choosing one (or clicking elsewhere, or Esc) closes it
const xBtn = $('xBtn'), xList = $('xList');
const setMenu = open => { xList.hidden = !open; xBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); if (open) (xList.querySelector('a.on') || xList.querySelector('a')).focus(); };
xBtn.addEventListener('click', () => setMenu(xList.hidden));
document.addEventListener('pointerdown', e => { if (!xList.hidden && !e.target.closest('#switcher')) setMenu(false); });
document.addEventListener('keydown', e => { if (!xList.hidden && e.key === 'Escape') { setMenu(false); xBtn.focus(); e.stopPropagation(); } }, true);
// clicking the explorer already on screen would drop its view code from the address
$('switcher').addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; setMenu(false); if (a.dataset.explorer === current) e.preventDefault(); });
// the menu's extras: the tour again, this explorer's card again, and the privacy note
// the ? menu's items (js/shell/layout.js opens and closes it)
$('tourAgain').addEventListener('click', () => takeTour());
$('aboutThis').addEventListener('click', () => aboutThis());
$('privacyBtn').addEventListener('click', () => showPrivacy());
$('reportBtn').addEventListener('click', () => openReport());
consentBar();
$('resetBtn').addEventListener('click', async () => { if (current) (await loaded[current].catch(() => null))?.reset?.(); });
window.addEventListener('hashchange', () => { bareHome = false; route(); });
route();
