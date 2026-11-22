// Flat patterns drawn on a 2D canvas: the Archimedean tilings Wythoff's construction can't make, the 17 wallpaper groups,
// Truchet tiles and quasicrystals (de Bruijn's multigrid). Each pattern gives, for a rectangle of the plane, a list of
// polygons ({p: points, c: class}) and lines ({p: points, c: class}) to draw. Edge length is 1 unless said otherwise.
import { hatPatch } from './hat.js';
const { sqrt, cos, sin, PI, floor, ceil, hypot, atan } = Math;
const H3 = sqrt(3) / 2;

// a small seeded random number generator, so a pattern looks the same every time it's drawn
export function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s ^ (s << 13)) >>> 0, s = (s ^ (s >>> 17)) >>> 0, s = (s ^ (s << 5)) >>> 0) / 4294967296); }
const hash2 = (i, j, seed) => { let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------- lattices: the translations that cover a rectangle ----------
function latticeRange(a, b, bounds, pad = 2) {
  const det = a[0] * b[1] - a[1] * b[0], inv = ([x, y]) => [(x * b[1] - y * b[0]) / det, (a[0] * y - a[1] * x) / det];
  const cs = [[bounds[0], bounds[2]], [bounds[1], bounds[2]], [bounds[0], bounds[3]], [bounds[1], bounds[3]]].map(inv);
  return [floor(Math.min(...cs.map(c => c[0]))) - pad, ceil(Math.max(...cs.map(c => c[0]))) + pad, floor(Math.min(...cs.map(c => c[1]))) - pad, ceil(Math.max(...cs.map(c => c[1]))) + pad];
}
const inBounds = (pts, b, m = 1) => pts.some(p => p[0] > b[0] - m && p[0] < b[1] + m && p[1] > b[2] - m && p[1] < b[3] + m);

// ---------- Archimedean tilings that aren't Wythoffian: big tiles on a lattice, triangles in every gap ----------
// Every corner of these tilings belongs to a square or hexagon, so the triangles are exactly the trios of corners that
// are all one edge apart.
function bigTilesAndTriangles(bounds, a, b, cells) {
  const [i0, i1, j0, j1] = latticeRange(a, b, bounds, 2), polys = [], V = new Map(), key = p => Math.round(p[0] * 1e4) + ',' + Math.round(p[1] * 1e4);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const [pts, c] of cells) { const q = pts.map(([x, y]) => [x + i * a[0] + j * b[0], y + i * a[1] + j * b[1]]);
    if (!inBounds(q, bounds, 3)) continue; polys.push({ p: q, c }); for (const v of q) V.set(key(v), v); }
  const P = [...V.values()], grid = new Map(), cell = p => floor(p[0] / 1.2) + ',' + floor(p[1] / 1.2);
  for (const p of P) { const k = cell(p); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); }
  const nb = p => { const out = [], cx = floor(p[0] / 1.2), cy = floor(p[1] / 1.2); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const q of grid.get((cx + dx) + ',' + (cy + dy)) || []) if (q !== p && Math.abs(hypot(q[0] - p[0], q[1] - p[1]) - 1) < 1e-3) out.push(q); return out; };
  const seen = new Set();
  for (const p of P) { const N = nb(p); for (let x = 0; x < N.length; x++) for (let y = x + 1; y < N.length; y++) { if (Math.abs(hypot(N[x][0] - N[y][0], N[x][1] - N[y][1]) - 1) > 1e-3) continue;
    const t = [p, N[x], N[y]], k = t.map(key).sort().join('|'); if (seen.has(k)) continue; seen.add(k); polys.push({ p: t, c: 0 }); } }
  return { polys };
}
const square = (cx, cy, rot) => [0, 1, 2, 3].map(k => [cx + Math.SQRT1_2 * cos(rot + PI / 4 + k * PI / 2), cy + Math.SQRT1_2 * sin(rot + PI / 4 + k * PI / 2)]);
const hexagon = (cx, cy, rot) => [0, 1, 2, 3, 4, 5].map(k => [cx + cos(rot + k * PI / 3), cy + sin(rot + k * PI / 3)]);
const SNUB_SQ = sqrt(2 + sqrt(3)), SNUB_HEX_TH = atan(sqrt(3) / 5);

// ---------- the 17 wallpaper groups: symmetry operations in lattice coordinates (from the International Tables) ----------
// Each op is [m11, m12, m21, m22, t1, t2]: (x, y) → (m11 x + m12 y + t1, m21 x + m22 y + t2), in units of the lattice vectors.
const op = (s) => s;
const C = [[1, 0, 0, 1, 0.5, 0.5]];   // centring, for cm and cmm
const W = {
  p1: { lat: 'oblique', ops: [[1, 0, 0, 1, 0, 0]] },
  p2: { lat: 'oblique', ops: [[1, 0, 0, 1, 0, 0], [-1, 0, 0, -1, 0, 0]] },
  pm: { lat: 'rect', ops: [[1, 0, 0, 1, 0, 0], [-1, 0, 0, 1, 0, 0]] },
  pg: { lat: 'rect', ops: [[1, 0, 0, 1, 0, 0], [-1, 0, 0, 1, 0, 0.5]] },
  cm: { lat: 'crect', ops: [[1, 0, 0, 1, 0, 0], [-1, 0, 0, 1, 0, 0]], centred: true },
  pmm: { lat: 'rect', ops: [[1, 0, 0, 1, 0, 0], [-1, 0, 0, -1, 0, 0], [-1, 0, 0, 1, 0, 0], [1, 0, 0, -1, 0, 0]] },
  pmg: { lat: 'rect', ops: [[1, 0, 0, 1, 0, 0], [-1, 0, 0, -1, 0, 0], [-1, 0, 0, 1, 0.5, 0], [1, 0, 0, -1, 0.5, 0]] },
  pgg: { lat: 'rect', ops: [[1, 0, 0, 1, 0, 0], [-1, 0, 0, -1, 0, 0], [-1, 0, 0, 1, 0.5, 0.5], [1, 0, 0, -1, 0.5, 0.5]] },
  cmm: { lat: 'crect', ops: [[1, 0, 0, 1, 0, 0], [-1, 0, 0, -1, 0, 0], [-1, 0, 0, 1, 0, 0], [1, 0, 0, -1, 0, 0]], centred: true },
  p4: { lat: 'square', ops: [[1, 0, 0, 1, 0, 0], [-1, 0, 0, -1, 0, 0], [0, -1, 1, 0, 0, 0], [0, 1, -1, 0, 0, 0]] },
  p4m: { lat: 'square', ops: [[1, 0, 0, 1, 0, 0], [-1, 0, 0, -1, 0, 0], [0, -1, 1, 0, 0, 0], [0, 1, -1, 0, 0, 0], [-1, 0, 0, 1, 0, 0], [1, 0, 0, -1, 0, 0], [0, 1, 1, 0, 0, 0], [0, -1, -1, 0, 0, 0]] },
  p4g: { lat: 'square', ops: [[1, 0, 0, 1, 0, 0], [-1, 0, 0, -1, 0, 0], [0, -1, 1, 0, 0, 0], [0, 1, -1, 0, 0, 0], [-1, 0, 0, 1, 0.5, 0.5], [1, 0, 0, -1, 0.5, 0.5], [0, 1, 1, 0, 0.5, 0.5], [0, -1, -1, 0, 0.5, 0.5]] },
  p3: { lat: 'hex', ops: [[1, 0, 0, 1, 0, 0], [0, -1, 1, -1, 0, 0], [-1, 1, -1, 0, 0, 0]] },
  p3m1: { lat: 'hex', ops: [[1, 0, 0, 1, 0, 0], [0, -1, 1, -1, 0, 0], [-1, 1, -1, 0, 0, 0], [0, -1, -1, 0, 0, 0], [-1, 1, 0, 1, 0, 0], [1, 0, 1, -1, 0, 0]] },
  p31m: { lat: 'hex', ops: [[1, 0, 0, 1, 0, 0], [0, -1, 1, -1, 0, 0], [-1, 1, -1, 0, 0, 0], [0, 1, 1, 0, 0, 0], [1, -1, 0, -1, 0, 0], [-1, 0, -1, 1, 0, 0]] },
  p6: { lat: 'hex', ops: [[1, 0, 0, 1, 0, 0], [0, -1, 1, -1, 0, 0], [-1, 1, -1, 0, 0, 0], [-1, 0, 0, -1, 0, 0], [0, 1, -1, 1, 0, 0], [1, -1, 1, 0, 0, 0]] },
  p6m: { lat: 'hex', ops: [[1, 0, 0, 1, 0, 0], [0, -1, 1, -1, 0, 0], [-1, 1, -1, 0, 0, 0], [-1, 0, 0, -1, 0, 0], [0, 1, -1, 1, 0, 0], [1, -1, 1, 0, 0, 0],
    [0, -1, -1, 0, 0, 0], [-1, 1, 0, 1, 0, 0], [1, 0, 1, -1, 0, 0], [0, 1, 1, 0, 0, 0], [1, -1, 0, -1, 0, 0], [-1, 0, -1, 1, 0, 0]] },
};
for (const k in W) if (W[k].centred) W[k].ops = W[k].ops.flatMap(o => [o, [o[0], o[1], o[2], o[3], o[4] + 0.5, o[5] + 0.5]]);
export const WALLPAPER = W;
export const LATTICE = { oblique: [[1, 0], [0.32, 0.92]], rect: [[1, 0], [0, 0.72]], crect: [[1, 0], [0, 1.45]], square: [[1, 0], [0, 1]], hex: [[1, 0], [-0.5, H3]] };
// the motif: a lopsided comma, so every turn and mirror shows (it has no symmetry of its own), in lattice coordinates
function motif(seed) { const r = rng(seed), pts = [], cx = 0.22 + r() * 0.06, cy = 0.1 + r() * 0.05, s = 0.085, ph = r() * 6.28;
  for (let k = 0; k < 40; k++) { const t = k / 40 * 2 * PI, rad = s * (1 + 0.42 * cos(t + ph) + 0.22 * sin(2 * t) + 0.12 * cos(3 * t + 1)); pts.push([cx + rad * cos(t) * 1.3, cy + rad * sin(t) * 0.8 + 0.035 * sin(t * 2 + ph)]); }
  return pts; }
function wallpaper(name, bounds, seed) {
  const g = W[name], [a, b] = LATTICE[g.lat], M = motif(seed), [i0, i1, j0, j1] = latticeRange(a, b, bounds, 2), polys = [], lines = [];
  const cart = ([x, y]) => [x * a[0] + y * b[0], x * a[1] + y * b[1]];
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    g.ops.forEach((o, k) => { const q = M.map(([x, y]) => cart([o[0] * x + o[1] * y + o[4] + i, o[2] * x + o[3] * y + o[5] + j])); if (inBounds(q, bounds, 1)) polys.push({ p: q, c: k, flip: o[0] * o[3] - o[1] * o[2] < 0 }); });
    const cell = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => cart([x + i, y + j])); if (inBounds(cell, bounds, 1)) lines.push({ p: [...cell, cell[0]], c: 0 });
  }
  return { polys, lines, classes: g.ops.length };
}

// ---------- Truchet tiles ----------
function truchet(style, bounds, seed) {
  const polys = [], lines = [], s = 1;
  for (let i = floor(bounds[0]) - 1; i <= ceil(bounds[1]); i++) for (let j = floor(bounds[2]) - 1; j <= ceil(bounds[3]); j++) {
    const h = hash2(i, j, seed);
    if (style === 'arcs') { const o = h < 0.5, arc = (cx, cy, a0) => Array.from({ length: 9 }, (_, k) => { const t = a0 + k / 8 * PI / 2; return [cx + 0.5 * cos(t), cy + 0.5 * sin(t)]; });
      if (o) { lines.push({ p: arc(i, j, 0), c: 0 }, { p: arc(i + 1, j + 1, PI), c: 1 }); } else { lines.push({ p: arc(i + 1, j, PI / 2), c: 0 }, { p: arc(i, j + 1, -PI / 2), c: 1 }); } }
    else if (style === 'triangles') { const k = floor(h * 4), C4 = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]; polys.push({ p: [C4[k], C4[(k + 1) % 4], C4[(k + 2) % 4]], c: k % 2 }); polys.push({ p: [C4[(k + 2) % 4], C4[(k + 3) % 4], C4[k]], c: 2 + (k % 2) }); }
    else { lines.push({ p: h < 0.5 ? [[i, j], [i + 1, j + 1]] : [[i + 1, j], [i, j + 1]], c: (i + j) & 1 }); }
  }
  return { polys, lines, classes: 4 };
}

// ---------- quasicrystals: de Bruijn's multigrid ----------
// n families of evenly spaced parallel lines at angles πk/n; every crossing of two lines becomes a rhombus. n = 4 gives the
// Ammann–Beenker tiling (squares and 45° rhombi, 8-fold), n = 5 Penrose's rhombi (10-fold), n = 6 a 12-fold tiling.
export function multigrid(n, bounds, seed) {
  const e = Array.from({ length: n }, (_, k) => [cos(PI * k / n), sin(PI * k / n)]), r = rng(seed);
  let g = Array.from({ length: n }, () => r() * 0.6 + 0.2); if (n === 5) { const m = g.reduce((s, v) => s + v, 0) / n; g = g.map(v => v - m + 0.2); }   // Penrose needs the shifts to add to a whole number
  const polys = [], f = n / 2, D = [bounds[0] / f - 1, bounds[1] / f + 1, bounds[2] / f - 1, bounds[3] / f + 1];   // tiles sit near n/2 × the crossing point
  const range = (v) => { const cs = [[D[0], D[2]], [D[1], D[2]], [D[0], D[3]], [D[1], D[3]]].map(p => p[0] * v[0] + p[1] * v[1]); return [floor(Math.min(...cs)) - 1, ceil(Math.max(...cs)) + 1]; };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const [a0, a1] = range(e[i]), [b0, b1] = range(e[j]), det = e[i][0] * e[j][1] - e[i][1] * e[j][0], typ = Math.min(j - i, n - (j - i));
    for (let ki = a0; ki <= a1; ki++) for (let kj = b0; kj <= b1; kj++) {
      const ri = ki + g[i], rj = kj + g[j], x = (ri * e[j][1] - rj * e[i][1]) / det, y = (rj * e[i][0] - ri * e[j][0]) / det;
      if (x < D[0] - 1 || x > D[1] + 1 || y < D[2] - 1 || y > D[3] + 1) continue;
      const K = e.map((v, m) => ceil(x * v[0] + y * v[1] - g[m])); K[i] = ki; K[j] = kj;
      const P = kk => { let X = 0, Y = 0; kk.forEach((v, m) => { X += v * e[m][0]; Y += v * e[m][1]; }); return [X, Y]; };
      const k1 = K.slice(), k2 = K.slice(), k3 = K.slice(); k1[i]++; k2[i]++; k2[j]++; k3[j]++;
      const q = [P(K), P(k1), P(k2), P(k3)]; if (inBounds(q, bounds, 1)) polys.push({ p: q, c: typ - 1 });
    }
  }
  return { polys, classes: floor(n / 2) };
}

// ---------- the hat: three rounds of substitution (about 25,000 hats), cut to what's on screen ----------
let HATS = null;
function hats(bounds) {
  if (!HATS) { const T = hatPatch(3); HATS = T.map(t => { const xs = t.p.map(q => q[0]), ys = t.p.map(q => q[1]); return { p: t.p, c: t.label === 'H1' ? 1 : 0, bb: [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] }; });
    let cx = 0, cy = 0; for (const h of HATS) { cx += (h.bb[0] + h.bb[1]) / 2; cy += (h.bb[2] + h.bb[3]) / 2; } HATS.centre = [cx / HATS.length, cy / HATS.length]; }
  return { polys: HATS.filter(h => h.bb[1] > bounds[0] - 1 && h.bb[0] < bounds[1] + 1 && h.bb[3] > bounds[2] - 1 && h.bb[2] < bounds[3] + 1) };
}

// ---------- the catalogue ----------
export const PATTERNS = {
  elong: { group: 'arch', name: '3.3.3.4.4', alt: 'elongated triangular tiling', scale: 4, classes: ['triangles', 'squares'],
    gen: b => bigTilesAndTriangles(b, [1, 0], [0.5, 1 + H3], [[[[0, 0], [1, 0], [1, 1], [0, 1]], 1]]),
    info: 'Rows of squares between rows of triangles. It is the only Archimedean tiling that isn\'t made by Wythoff\'s mirrors: it can be sheared along its rows, so its pattern of symmetry is different.' },
  snubsq: { group: 'arch', name: '3.3.4.3.4', alt: 'snub square tiling', scale: 4, classes: ['triangles', 'squares'],
    gen: b => bigTilesAndTriangles(b, [SNUB_SQ, 0], [0, SNUB_SQ], [[square(0, 0, PI / 12), 1], [square(SNUB_SQ / 2, SNUB_SQ / 2, -PI / 12), 1]]),
    info: 'Squares turned alternately a little left and a little right, with triangles in the gaps. "Snub" means made by alternately turning and pulling apart the tiles of a simpler tiling.' },
  snubhex: { group: 'arch', name: '3.3.3.3.6', alt: 'snub hexagonal tiling: it comes in a left and a right hand', scale: 5, classes: ['triangles', 'hexagons'],
    gen: b => bigTilesAndTriangles(b, [sqrt(7) * cos(SNUB_HEX_TH), sqrt(7) * sin(SNUB_HEX_TH)], [sqrt(7) * cos(SNUB_HEX_TH + PI / 3), sqrt(7) * sin(SNUB_HEX_TH + PI / 3)], [[hexagon(0, 0, 0), 1]]),
    info: 'Each hexagon is ringed by triangles, four triangles and one hexagon at every corner. It is chiral: it comes in two mirror-image forms, the only Archimedean tiling that does.' },
  truchetArcs: { group: 'truchet', name: 'Quarter circles', alt: 'Smith\'s Truchet tiles: one tile, two ways round', scale: 8, classes: ['curves', 'curves'], gen: (b, sd) => truchet('arcs', b, sd), lineMode: true,
    info: 'Cyril Stanley Smith, 1987: a square with two quarter circles, laid at random in one of two ways. The arcs always join up, into endless winding paths that never cross.' },
  truchetTri: { group: 'truchet', name: 'Half-filled squares', alt: 'Sébastien Truchet\'s tiles of 1704', scale: 8, classes: ['dark', 'dark', 'light', 'light'], gen: (b, sd) => truchet('triangles', b, sd),
    info: 'Sébastien Truchet, a French priest, studied in 1704 how squares cut along a diagonal, half dark and half light, make patterns when laid in different turns. Here each is turned at random.' },
  truchetMaze: { group: 'truchet', name: 'Random diagonals', alt: 'the famous one-line maze', scale: 10, classes: ['lines', 'lines'], gen: (b, sd) => truchet('maze', b, sd), lineMode: true,
    info: 'Each square gets a diagonal one way or the other at random, like the one-line Commodore 64 program "10 PRINT CHR$(205.5+RND(1)); : GOTO 10". The result looks like a maze.' },
  hat: { group: 'quasi', name: 'The hat', alt: 'one shape that never repeats (2023)', scale: 14, classes: ['hats', 'mirror-image hats'], ratio: [0, 1, 'hats per mirror image'], limit: 'φ⁴ = 6.854…', third: ['1', 'shape of tile'],
    centre: () => (hats([0, 0, 0, 0]), HATS.centre), gen: b => hats(b),
    info: 'For sixty years mathematicians wondered whether one single shape could tile the plane but only without ever repeating: an "einstein" (German for "one stone"). In 2023 David Smith, a retired print technician who liked cutting out shapes, found the hat, and with Joseph Myers, Craig Kaplan and Chaim Goodman-Strauss proved it works. It needs mirror images: about one hat in seven is flipped. Built here by their substitution rules, three levels deep.' },
  qc8: { group: 'quasi', name: 'Ammann–Beenker', alt: 'squares and 45° rhombi: 8-fold, never repeating', scale: 7, classes: ['rhombi', 'squares'], fold: 8, ratio: [0, 1, 'rhombi per square'], limit: '√2 = 1.414…', gen: (b, sd) => multigrid(4, b, sd),
    info: 'Found by Robert Ammann in the 1970s and studied by Frans Beenker in 1982: squares and thin rhombi that never repeat, with eight-fold symmetry. The rhombi outnumber the squares by √2 to 1. Quasicrystals with this symmetry were found in 1987.' },
  qc10: { group: 'quasi', name: '10-fold (Penrose)', alt: 'Penrose\'s rhombi, made from five sets of lines', scale: 7, classes: ['thin rhombi', 'thick rhombi'], fold: 10, ratio: [1, 0, 'thick per thin'], limit: 'the golden ratio, 1.618…', gen: (b, sd) => multigrid(5, b, sd),
    info: 'The Penrose rhombus tiling again, made a different way: Nicolaas de Bruijn showed in 1981 that it is the pattern of crossings of five sets of evenly spaced parallel lines. Every crossing becomes one rhombus.' },
  qc12: { group: 'quasi', name: '12-fold', alt: 'squares, rhombi and hexagon-ish clusters', scale: 7, classes: ['thin rhombi', 'squares', 'wide rhombi'], fold: 12, ratio: [2, 0, 'wide rhombi per thin'], gen: (b, sd) => multigrid(6, b, sd),
    info: 'Six sets of lines at 30° to each other give a tiling with twelve-fold symmetry: three kinds of rhombus. Twelve-fold quasicrystals have been found in some alloys and polymer blends.' },
  qc14: { group: 'quasi', name: '14-fold', alt: 'seven sets of lines', scale: 7, classes: ['thin', 'middle', 'wide'], fold: 14, ratio: [2, 0, 'wide per thin'], gen: (b, sd) => multigrid(7, b, sd),
    info: 'Seven sets of lines give three shapes of rhombus and fourteen-fold symmetry. The same method makes a quasicrystal with any number of directions.' },
};
const WP_INFO = {
  p1: 'Only sliding (translation): the motif repeats along two directions and nothing else.', p2: 'Half turns: every motif has a twin turned upside down.',
  pm: 'Mirrors in parallel lines.', pg: 'Glide reflections: reflect and slide at once, like footprints.', cm: 'Mirrors, plus glides halfway between them.',
  pmm: 'Mirrors in two directions at right angles.', pmg: 'Mirrors one way, glides the other, and half turns.', pgg: 'Glides in two directions, and half turns, but no mirrors.',
  cmm: 'Mirrors both ways, in a staggered (centred) grid.', p4: 'Quarter turns: four motifs spinning round a point.', p4m: 'Quarter turns and mirrors along the edges and diagonals: the symmetry of a square grid.',
  p4g: 'Quarter turns, with mirrors only along the diagonals.', p3: 'Third turns: three motifs spinning round a point.', p3m1: 'Third turns, with every turning point on a mirror.',
  p31m: 'Third turns, with some turning points off the mirrors.', p6: 'Sixth turns: six motifs spinning round a point.', p6m: 'Sixth turns and mirrors: the symmetry of a honeycomb, the richest of all.' };
for (const k of Object.keys(WALLPAPER)) PATTERNS['wp_' + k] = { group: 'wall', name: k, alt: WP_INFO[k], scale: 1.8, wallpaper: true, gen: (b, sd) => wallpaper(k, b, sd),
  info: `Wallpaper group ${k}. ${WP_INFO[k]} There are exactly seventeen ways a pattern can repeat in two directions on a flat plane; Evgraf Fedorov proved it in 1891, and all seventeen appear in the tiles of the Alhambra.` };
