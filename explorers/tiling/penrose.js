// Penrose tilings, built by "deflation": every tile is cut into smaller copies of the two tile shapes, over and over.
// The tiles are kept as halves (Robinson triangles): [kind, A, B, C] with points as [x, y]. Two halves that share a side
// make one whole tile, so that side is never drawn (SHARED): for rhombs B–C, the diagonal (the base of both halves); for
// kites and darts A–B, the tile's axis (in the starting sun, neighbouring halves meet along A–B). Counting shared sides
// can't decide this, since in a tiling neighbouring tiles share sides too; the test is that the two halves of a tile are
// mirror images across it. The kite-and-dart cuts were worked out from the triangles' shapes and chosen so that every
// half finds its mirror partner (all but the ones on the patch's rim). Each step
// keeps the total area exactly (a quick check that the cuts are right), and thick rhombs outnumber thin ones, and kites
// outnumber darts, by the golden ratio.
export const PHI = (1 + Math.sqrt(5)) / 2;
export const SHARED = { rh: [2, 3], kd: [1, 2] };
const lerp = (P, Q, t) => [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];

/** The starting wheel of ten halves round the centre: a "sun" (all kind 0) for both tilings. */
export function start(kind) {
  const T = [];
  for (let i = 0; i < 10; i++) {
    let B = [Math.cos((2 * i - 1) * Math.PI / 10), Math.sin((2 * i - 1) * Math.PI / 10)], C = [Math.cos((2 * i + 1) * Math.PI / 10), Math.sin((2 * i + 1) * Math.PI / 10)];
    if (i % 2 === 0) [B, C] = [C, B];   // mirror every other half so neighbours match up
    T.push([0, [0, 0], B, C]);
  }
  return T;
}

/** One deflation step. Rhombs (P3): kind 0 = half a thin rhomb, 1 = half a thick one. Kites & darts (P2): 0 = half kite, 1 = half dart. */
export function deflate(T, kind) {
  const out = [];
  if (kind === 'kd') for (const [k, A, B, C] of T) {
    // half kite (36° at A, the axis A–B): two smaller half kites and a half dart
    if (k === 0) { const D = lerp(A, B, 1 / PHI), E = lerp(A, C, 1 / (PHI * PHI)); out.push([0, C, D, B], [0, C, D, E], [1, E, A, D]); }
    // half dart (108° at A, the axis A–B): a half kite and a smaller half dart
    else { const E = lerp(B, C, 1 / PHI); out.push([0, B, A, E], [1, E, C, A]); }
  } else for (const [k, A, B, C] of T) {
    if (k === 0) { const P = lerp(A, B, 1 / PHI); out.push([0, C, P, B], [1, P, C, A]); }
    else { const Q = lerp(B, A, 1 / PHI), R = lerp(B, C, 1 / PHI); out.push([1, R, C, A], [1, Q, R, B], [0, R, Q, A]); }
  }
  return out;
}

/** The tiling after n steps, cached per kind. The wheel is scaled so tiles stay about the same size on screen. */
const cache = {};
export function tiling(kind, n) {
  const c = cache[kind] || (cache[kind] = [start(kind)]);
  while (c.length <= n) c.push(deflate(c[c.length - 1], kind));
  return c[n];
}

/** Which way a whole tile points, the same for both its halves, for "colour by direction". Kites and darts point along
 *  their axis (A→B), one of ten directions; a rhomb's two halves point opposite ways along its other diagonal, so a
 *  rhomb only has one of five. */
export function direction(t, kind) {
  const [, A, B, C] = t;
  if (kind === 'kd') return ((Math.round(Math.atan2(B[1] - A[1], B[0] - A[0]) / (Math.PI / 5)) % 10) + 10) % 10;
  const a = Math.atan2((B[1] + C[1]) / 2 - A[1], (B[0] + C[0]) / 2 - A[0]); return ((Math.round(a / (Math.PI / 5)) % 5) + 5) % 5;
}
