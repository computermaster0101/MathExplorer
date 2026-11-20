// Hide panel and full screen ("zen"), shared by every explorer.
const app = document.getElementById('app');
const $ = id => document.getElementById(id);

let onChange = () => {};
/** Called after the panel is shown or hidden, or full screen starts or ends, so the explorer can redraw. */
export const onLayoutChange = fn => { onChange = fn; };

export const panelHidden = () => app.classList.contains('nopanel');
export const inZen = () => app.classList.contains('zen');

export function togglePanel(hide = !panelHidden()) {
  app.classList.toggle('nopanel', hide);
  $('panelBtn').textContent = hide ? 'Show panel' : 'Hide panel';
  onChange();
}

let zenFS = false, zenTimer = null;
// in full screen the exit button and the pointer fade out until the pointer moves
function zenWake() {
  if (!inZen()) return;
  $('zenExit').classList.remove('fade'); app.classList.add('awake');
  clearTimeout(zenTimer);
  zenTimer = setTimeout(() => { $('zenExit').classList.add('fade'); app.classList.remove('awake'); }, 2500);
}

export function enterZen() {
  app.classList.add('zen'); zenWake(); window.scrollTo(0, 0); zenFS = false;
  const el = document.documentElement;
  try { const r = el.requestFullscreen && el.requestFullscreen(); if (r && r.then) r.then(() => { zenFS = true; }).catch(() => {}); } catch (e) { /* not allowed here */ }
  onChange();
}

export function exitZen() {
  if (!inZen()) return;
  app.classList.remove('zen', 'awake'); clearTimeout(zenTimer);
  if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { /* already gone */ } }
  zenFS = false; onChange();
}

export const toggleZen = () => (inZen() ? exitZen() : enterZen());

/** Open the panel's "Keyboard shortcuts" group (id g-keys) and bring it into view. */
export function showKeys() {
  if (panelHidden()) togglePanel(false);
  exitZen();
  const g = $('g-keys'); if (!g) return;
  g.open = true; g.scrollIntoView({ block: 'nearest' });
}

$('panelBtn').addEventListener('click', () => togglePanel());
$('zenBtn').addEventListener('click', enterZen);
$('zenExit').addEventListener('click', exitZen);
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && zenFS) exitZen(); });
for (const ev of ['pointermove', 'pointerdown', 'touchstart']) document.addEventListener(ev, zenWake, { passive: true });
