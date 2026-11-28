// Calm motion (design pack U13): for anyone whose system asks for reduced motion, or who turns it on in Help. While it's on:
// each picture opens still (the Paused tag says how to start it; main.js), the beat never flashes the picture (react.js:
// flash() and flashFx() are 0; Pulse, which the visitor chooses, still works), and the interface's own animations stop
// (html.calm in app.css). Remembered in localStorage mathexplorer.calm ('1' / '0'); unset, it follows the system.
const KEY = 'mathexplorer.calm', RM = matchMedia('(prefers-reduced-motion: reduce)');
const saved = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
let on = saved() === '1' || (saved() !== '0' && RM.matches);
export const calm = () => on;
const paint = () => document.documentElement.classList.toggle('calm', on);
/** Turn it on or off (no argument: the other way), and remember the choice. */
export function setCalm(v = !on) { on = v; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* this visit only */ } paint(); }
RM.addEventListener('change', () => { if (saved() === null) { on = RM.matches; paint(); } });
paint();
