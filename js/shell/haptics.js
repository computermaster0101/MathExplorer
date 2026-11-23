// Vibration on touch (issue #34), on phones that can (Android Chrome and others; iPhone browsers have no vibration, and
// desktops none either, so the setting only shows on a touch screen whose browser offers it): a short tick when a button is
// pressed, and explorers call buzz() to let you feel the picture (Tilings: each edge of the tiling that passes the middle of
// the screen while your finger moves it). Off until ticked (#hapOn in Music & sound), remembered on this device.
// ?hapticsTest shows it anywhere and logs each buzz to window.__buzzLog instead of vibrating, for checking locally.
const KEY = 'mathexplorer.haptics', TEST = /[?&]hapticsTest/.test(location.search);
if (TEST) window.__buzzLog = [];
export const canBuzz = TEST || (typeof navigator.vibrate === 'function' && matchMedia('(pointer: coarse)').matches);
let on = false; try { on = localStorage.getItem(KEY) === '1'; } catch (e) { /* off */ }
let last = 0;
/** A short vibration (ms), if the visitor turned it on; buzzes closer than 40 ms apart are merged into one. */
export function buzz(ms = 10) {
  if (!on || !canBuzz) return; const t = performance.now(); if (t - last < 40) return; last = t;
  if (TEST) window.__buzzLog.push(ms); else try { navigator.vibrate(ms); } catch (e) { /* not allowed yet */ }
}
const box = document.getElementById('hapOn'), sec = box && box.closest('.sec');
if (sec) { sec.hidden = !canBuzz; box.checked = on;
  box.addEventListener('change', () => { on = box.checked; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* this visit only */ } if (on) buzz(25); }); }
// a tick for every button, choice, tick box and menu item pressed with a finger
document.addEventListener('pointerdown', e => { if ((e.pointerType === 'touch' || TEST) && e.target.closest && e.target.closest('button, a.btn, label.check, label.btn, #xList a, #xBtn, summary')) buzz(8); }, true);
