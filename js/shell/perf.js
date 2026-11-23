// Slow graphics: detect when the browser draws without the graphics card, and recover when the graphics card resets.
// Software drawing (hardware acceleration off, blocked, or a card the browser won't use) makes the pictures very slow
// and heavy ones can stop the page; a weak card can also reset when one frame takes too long, which loses every
// explorer's drawing surface. The first gets a small notice (once; dismissable) and lighter starting settings, the second
// a message with a button that reloads exactly this view. Analytics counts which kind of drawing visits get.
import { track } from './analytics.js';

const $ = id => document.getElementById(id);
const AUTO = navigator.webdriver && !/[?&]perfTest/.test(location.search);   // test browsers draw in software: no notice there
const FORCE = (location.search.match(/[?&]perfTest=(software|lost)/) || [])[1];   // for checking the notices locally

/** What the browser draws with: 'gpu' (the graphics card), 'software' (no card: slow) or 'none' (no WebGL 2 at all). */
function detect() {
  if (FORCE === 'software') return { kind: 'software', name: 'test' };
  try {
    const c = document.createElement('canvas');
    let gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });   // refuses when it would be software
    let kind = 'gpu';
    if (!gl) { gl = c.getContext('webgl2'); kind = gl ? 'software' : 'none'; }
    let name = '';
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
      if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i.test(name)) kind = 'software';
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();   // give the test context back at once
    }
    return { kind, name };
  } catch (e) { return { kind: 'none', name: '' }; }
}
const G = detect();
/** True when pictures should start light: no graphics card, or a phone-class device with little memory. */
export const lowGraphics = () => G.kind !== 'gpu' || (navigator.deviceMemory && navigator.deviceMemory <= 2);
track('graphics', { kind: G.kind });

// ---------- the notice for software drawing (once a device; dismissable) ----------
const KEY = 'mathexplorer.slowNotice';
const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
function softwareNotice() {
  if (AUTO || G.kind !== 'software' || seen()) return;
  const b = document.createElement('div'); b.id = 'slowNotice'; b.setAttribute('role', 'status');
  b.innerHTML = `<span><b>Your browser is drawing without the graphics card</b>, so pictures will be slow, and the heaviest may stop. Turning on <b>hardware acceleration</b> fixes it: in Chrome or Edge, Settings → System → "Use graphics acceleration when available", then restart the browser.</span><button class="sbtn" id="slowX">Got it</button>`;
  document.body.appendChild(b);
  $('slowX').onclick = () => { b.remove(); try { localStorage.setItem(KEY, '1'); } catch (e) { /* shows again next time */ } };
}

// ---------- the graphics card reset: offer to reload this very view ----------
let lostShown = false;
function lost() {
  if (lostShown) return; lostShown = true; track('graphics_lost', { explorer: ($('app') || {}).dataset?.explorer || '' });
  const d = document.createElement('div'); d.id = 'lostNote'; d.className = 'modalBack';
  d.innerHTML = `<div class="modal" role="alertdialog" aria-labelledby="lostT"><h2 id="lostT">The graphics card stopped drawing</h2>
    <p>That can happen on slower computers, or with a very heavy picture. Reloading picks up exactly where you were${G.kind === 'software' ? ', though the browser is drawing without the graphics card, so it will be slow (turning on hardware acceleration in its settings helps)' : ''}.</p>
    <div class="btns"><button class="btn primary" id="lostReload">Reload this view</button></div></div>`;
  document.body.appendChild(d); $('lostReload').onclick = () => location.reload(); $('lostReload').focus();
}
// the event is sent to the canvas and doesn't bubble, so listen on the way down
document.addEventListener('webglcontextlost', e => { if (e.target && e.target.tagName === 'CANVAS' && e.target.width > 1) lost(); }, true);
if (FORCE === 'lost') setTimeout(lost, 2500);

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', softwareNotice); else setTimeout(softwareNotice, 0);
