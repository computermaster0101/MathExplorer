// ---------- classical labyrinths: one path, no choices ----------
// A classical labyrinth is a set of rings (circuits) that one path visits in a fixed order, turning back at the top. Write the
// order down (the Cretan labyrinth on ancient coins goes 3, 2, 1, 4, 7, 6, 5 and then the centre) and the whole labyrinth
// follows. The U-turns alternate between the left and right of the top, and on each side they must nest inside each other
// without crossing, the same rule as a meander: a river crossing a straight road. Every valid order is a different labyrinth.
export const CLASSIC = {
  cretan: { name: 'Cretan (7 rings)', seq: [3, 2, 1, 4, 7, 6, 5], info: 'The labyrinth on coins from Knossos in Crete, about 300 BC, and carved on rocks and drawn on floors across the world. Its path visits the seven rings in the order 3, 2, 1, 4, 7, 6, 5 before reaching the centre.' },
  three: { name: 'Three rings', seq: [1, 2, 3], info: 'The simplest labyrinth that turns back on itself: round the outside, then the middle, then the inside. Every 3-ring labyrinth is one of just two orders.' },
  simple3: { name: 'Three rings, folded', seq: [3, 2, 1], info: 'The other 3-ring order: dive straight to the innermost ring, then work outward before turning into the centre.' },
  five: { name: 'Five rings', seq: [1, 4, 3, 2, 5], info: 'A five-ring labyrinth: the path doubles back three times in the middle rings before the centre.' },
  eleven: { name: 'Eleven rings', seq: [5, 4, 3, 2, 1, 6, 11, 10, 9, 8, 7], info: 'Eleven rings: two folded halves joined in the middle. Medieval church labyrinths like Chartres also have eleven rings, though their paths turn on more than one line.' },
};
/** Is this order a valid labyrinth? (Each ring once; the U-turns on each side never cross.) */
export function valid(seq) {
  const n = seq.length; if ([...seq].sort((a, b) => a - b).some((v, i) => v !== i + 1)) return false;
  const s = [0, ...seq, n + 1], arcs = [[], []];
  for (let i = 0; i + 1 < s.length; i++) arcs[i % 2].push([Math.min(s[i], s[i + 1]), Math.max(s[i], s[i + 1])]);
  for (const side of arcs) for (const [a, b] of side) for (const [c, d] of side) if (a < c && c < b && b < d) return false;
  return true;
}
/** A random valid order for n rings (backtracking over the meander rule). */
export function randomLabyrinth(n, rnd) {
  const seq = [], used = new Array(n + 2).fill(false), arcs = [[], []];
  const crosses = (side, a, b) => { const [x, y] = [Math.min(a, b), Math.max(a, b)]; return arcs[side].some(([c, d]) => (x < c && c < y && y < d) || (c < x && x < d && d < y)); };
  const go = prev => {
    if (seq.length === n) { const side = n % 2; return !crosses(side, prev, n + 1); }
    const opts = []; for (let c = 1; c <= n; c++) if (!used[c]) opts.push(c);
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    const side = seq.length % 2;
    for (const c of opts) { if (crosses(side, prev, c)) continue; used[c] = true; seq.push(c); arcs[side].push([Math.min(prev, c), Math.max(prev, c)]);
      if (go(c)) return true; used[c] = false; seq.pop(); arcs[side].pop(); }
    return false;
  };
  return go(0) ? seq.slice() : null;
}
/** How many different labyrinths have n rings (counted by trying every order that keeps to the rule). */
const counts = {};
export function countLabyrinths(n) {
  if (counts[n] != null) return counts[n]; let total = 0; const used = new Array(n + 2).fill(false), arcs = [[], []], seq = [];
  const crosses = (side, a, b) => { const [x, y] = [Math.min(a, b), Math.max(a, b)]; return arcs[side].some(([c, d]) => (x < c && c < y && y < d) || (c < x && x < d && d < y)); };
  const go = prev => { if (seq.length === n) { if (!crosses(n % 2, prev, n + 1)) total++; return; } const side = seq.length % 2;
    for (let c = 1; c <= n; c++) { if (used[c] || crosses(side, prev, c)) continue; used[c] = true; seq.push(c); arcs[side].push([Math.min(prev, c), Math.max(prev, c)]); go(c); used[c] = false; seq.pop(); arcs[side].pop(); } };
  go(0); return (counts[n] = total);
}
/**
 * The path as a polyline in the plane (radius about 1), plus where each ring starts along it. Rings are concentric; ring k
 * runs nearly all the way round between its two ends beside the top. All the U-turns on one side share one angle, nested
 * half-circles bulging toward the top line, so nested turns sit inside each other and side-by-side ones don't touch.
 */
export function labyrinthPath(seq) {
  const n = seq.length, w = 0.82 / (n + 2.6), rad = k => (k === 0 ? 1 + 0.5 * w : 1 - (k - 0.5) * w), s = [0, ...seq, n + 1];
  const arcs = []; for (let i = 0; i + 1 < s.length; i++) arcs.push({ a: s[i], b: s[i + 1], side: i % 2 });
  const delta = [0, 1].map(side => { let m = 0.05; for (const A of arcs.filter(x => x.side === side)) { const rm = (rad(A.a) + rad(A.b)) / 2, rho = Math.abs(rad(A.a) - rad(A.b)) / 2; m = Math.max(m, Math.asin(Math.min(0.98, (rho + 0.55 * w) / rm))); } return m; });
  const th = side => Math.PI / 2 + (side === 0 ? delta[0] : -delta[1]), P = [], marks = [], pt = (r, t) => [r * Math.cos(t), r * Math.sin(t)];
  P.push(pt(rad(0) + 1.5 * w, th(0)));
  for (let i = 0; i < arcs.length; i++) {
    const A = arcs[i], t0 = th(A.side), ra = rad(A.a), rb = rad(A.b), rm = (ra + rb) / 2, rho = Math.abs(ra - rb) / 2, tdir = [-Math.sin(t0), Math.cos(t0)], toward = A.side === 0 ? -1 : 1, er = [Math.cos(t0), Math.sin(t0)];
    // the U-turn: half a circle from radius ra to rb, bulging toward the top line
    const sgn = rb > ra ? 1 : -1;
    for (let k = i === 0 ? 0 : 1; k <= 16; k++) { const ph = Math.PI * k / 16,   /* (the first point is where the ring ended) */ c = Math.cos(ph), sn = Math.sin(ph); const r = -sgn * rho * c, side2 = toward * rho * sn;
      P.push([rm * er[0] + r * er[0] + side2 * tdir[0], rm * er[1] + r * er[1] + side2 * tdir[1]]); }
    if (A.b === n + 1) { P.push([0, 0]); break; }
    // round ring b, from this side to the other the long way
    marks.push({ ring: A.b, at: P.length });
    const from = th(A.side), to = th(1 - A.side), r = rad(A.b), dir = A.side === 0 ? 1 : -1; let span = dir * (to - from); while (span <= 0) span += 2 * Math.PI;
    const steps = Math.max(24, Math.round(span * 40)); for (let k = 1; k <= steps; k++) P.push(pt(r, from + dir * span * k / steps));
  }
  return { P, w, marks, n };
}
