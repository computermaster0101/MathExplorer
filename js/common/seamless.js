// Seamless loops: a video whose last frame leads straight back into its first, so it can play round and round.
//
// While one is being made (LOOP.on), time is the loop's own: the explorer is stepped frame by frame at exactly 1/30 s,
// however long each frame takes to draw, and the music is ignored (js/shell/audio/react.js answers as if nothing were
// playing). Every periodic motion is rounded so it goes round a whole number of times in the loop's length: an
// explorer passes its speeds through loopRate(rate, cycle), and Phase does it by itself. Motions that never come back
// (drifting, zooming, a simulation, a flight) hold still while the loop is made.
//
// An explorer tells the recorder what would move with loopParts(): { parts: [{ name, rate, cycle, noun? }], held: [names],
// block: 'why it can't loop' }. rate is in the motion's units per second, cycle in units per round (2π for an angle in
// radians, 360 in degrees, 1 for a palette's cycle).
export const LOOP = { on: false, L: 0 };
export const FPS = 30;
export const TAU = 2 * Math.PI;

const rounds = (rate, cycle, L) => Math.max(1, Math.round(Math.abs(rate) * L / cycle));
/** rate, changed while a loop is made so it goes round a whole number of times (at least once) in the loop's length. */
export function loopRate(rate, cycle = TAU) {
  if (!LOOP.on || !rate || !LOOP.L) return rate;
  return Math.sign(rate) * rounds(rate, cycle, LOOP.L) * cycle / LOOP.L;
}
/** The loop length (whole seconds, 4–40) that changes the speeds least, slightly preferring shorter loops. */
export function bestLength(parts) {
  const live = parts.filter(p => p.rate && p.cycle);
  if (!live.length) return 12;
  let best = 12, bestE = Infinity;
  for (let L = 4; L <= 40; L++) {
    let e = 0.004 * L;
    for (const p of live) { const c = Math.abs(p.rate) / p.cycle; e += Math.abs(Math.log(rounds(p.rate, p.cycle, L) / (c * L))); }
    if (e < bestE - 1e-9) { bestE = e; best = L; }
  }
  return best;
}
/** "Keep turning: 2 turns · Colours: 1 time round", for the note under the button. */
export function describe(parts, L) {
  return parts.filter(p => p.rate && p.cycle).map(p => { const n = rounds(p.rate, p.cycle, L), w = p.noun || ['turn', 'turns'], k = n * p.cycle / (Math.abs(p.rate) * L);
    const sp = k >= 1.5 ? ` (${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}× faster)` : k <= 0.67 ? ` (${(1 / k).toFixed(1).replace(/\.0$/, '')}× slower)` : '';
    return `${p.name}: ${n} ${n === 1 ? w[0] : w[1]}${sp}`; }).join(' · ');
}
/** The palette's own cycling (st.cycle += cycleSpeed × 0.06 a second), as a loop part. */
export const colourPart = cycleSpeed => (cycleSpeed > 0 ? [{ name: 'Colours', rate: cycleSpeed * 0.06, cycle: 1, noun: ['time round', 'times round'] }] : []);
