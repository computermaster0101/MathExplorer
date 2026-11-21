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
//
// Only one explorer is attached to the page at a time: the others' DOM is kept, detached, so their
// element ids never clash and their own document queries only ever see their own controls.
import { parseRoute, DEFAULT_EXPLORER, setActiveExplorer } from './shell/route.js';
import { onLayoutChange } from './shell/layout.js';
import { setKeyHandler, syncKeyPrefs } from './shell/keys.js';
import { soundGroup, setSoundHelp } from './shell/audio/panel.js';

const EXPLORERS = {
  fractal:  { title: 'Fractals' },
  polytope: { title: '4D Polytopes' },
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
  const ctl = panelEl.querySelector('#g-style');
  panelEl.insertBefore(soundGroup, ctl ? ctl.nextSibling : null);
}
function detach({ stageEl, panelEl }) { $('shellParts').append(soundGroup); stageEl.remove(); panelEl.remove(); }

function markSwitcher(name) {
  for (const a of document.querySelectorAll('#switcher a')) a.classList.toggle('on', a.dataset.explorer === name);
  document.title = `${EXPLORERS[name].title} · Math Explorer`;
}

let queue = Promise.resolve();
const route = () => { queue = queue.then(show).catch(e => console.error(e)); };

async function show() {
  let { explorer: name, code } = parseRoute();
  if (!EXPLORERS[name]) { name = DEFAULT_EXPLORER; code = ''; try { history.replaceState(null, '', '#/' + name); } catch (e) { /* sandboxed */ } }
  if (name === current) { if (code) (await loaded[name]).showView?.(code); return; }

  if (current) {
    (await loaded[current].catch(() => null))?.stop?.();
    if (views[current]) detach(views[current]);
  }
  current = name; setActiveExplorer(name); app.dataset.explorer = name; markSwitcher(name);
  setKeyHandler(null); onLayoutChange(() => {});

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
  setKeyHandler(api.onKey); onLayoutChange(() => api.layoutChanged?.()); setSoundHelp(api.soundHelp);
  api.start?.();
}

// clicking the explorer already on screen would drop its view code from the address
$('switcher').addEventListener('click', e => { const a = e.target.closest('a'); if (a && a.dataset.explorer === current) e.preventDefault(); });
$('resetBtn').addEventListener('click', async () => { if (current) (await loaded[current].catch(() => null))?.reset?.(); });
window.addEventListener('hashchange', route);
route();
