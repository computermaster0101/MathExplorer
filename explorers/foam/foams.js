// ---------- foams: ways of filling space with bubbles ----------
// Almost every foam here is a Voronoi pattern: scatter points, and give each point the bubble of everything closer to it than to
// any other point. Repeat a crystal's points and you get a crystal foam; scatter them at random and you get something like
// soap suds. Give the points weights and big bubbles push into small ones (a power diagram). Put the points in a tube, or
// between two plates, and the walls of the container cut the bubbles too. The films are drawn flat; in a real foam they bend
// very slightly so that three films meet at 120° along every edge and four edges at every corner (Plateau's laws), which these
// patterns already nearly obey. The double bubble is drawn exactly, from spheres.
//
// Each bubble is found by cutting: start from a big box round its point and cut away everything on the far side of the plane
// halfway to each neighbour, nearest neighbours first. A cut that passes exactly through corners (as in very symmetric
// crystals) keeps those corners on the new face, so no face goes missing.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => mul(a, 1 / (len(a) || 1));
const EPS = 1e-9;

// a convex polyhedron is a list of faces; each face is { p: [corners in order], nb } where nb says what made it (a neighbour or a wall)
function boxPoly(c, h) {
  const [x, y, z] = c, v = (i, j, k) => [x + (i ? h : -h), y + (j ? h : -h), z + (k ? h : -h)];
  return [[v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)], [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)], [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)],
    [v(0, 1, 0), v(0, 1, 1), v(1, 1, 1), v(1, 1, 0)], [v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0)], [v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)]].map(p => ({ p, nb: null }));
}
// a prism round the z axis (a tube of radius r, approximated by m flat sides), from z0 to z1
function prismPoly(r, m, z0, z1) {
  const ring = z => Array.from({ length: m }, (_, i) => [r * Math.cos(2 * Math.PI * i / m), r * Math.sin(2 * Math.PI * i / m), z]);
  const lo = ring(z0), hi = ring(z1), F = [{ p: lo.slice().reverse(), nb: null }, { p: hi, nb: null }];
  for (let i = 0; i < m; i++) F.push({ p: [lo[i], lo[(i + 1) % m], hi[(i + 1) % m], hi[i]], nb: 'wall' });
  return F;
}
// keep the part with n·x <= d; the new face (if any) is tagged nb
function clip(poly, n, d, nb) {
  let cut = false; for (const f of poly) for (const q of f.p) if (dot(n, q) - d > EPS * 10) { cut = true; break; }
  if (!cut) return poly;
  const out = [], cap = [];
  for (const f of poly) {
    const P = f.p, m = P.length, Q = [];
    for (let i = 0; i < m; i++) {
      const a = P[i], b = P[(i + 1) % m], sa = dot(n, a) - d, sb = dot(n, b) - d;
      if (sa <= EPS * 10) { Q.push(a); if (Math.abs(sa) <= EPS * 10) cap.push(a); }
      if ((sa < -EPS * 10 && sb > EPS * 10) || (sa > EPS * 10 && sb < -EPS * 10)) { const t = sa / (sa - sb), x = add(a, mul(sub(b, a), t)); Q.push(x); cap.push(x); }
    }
    const R = dedupe(Q); if (R.length >= 3 && area(R) > 1e-12) out.push({ p: R, nb: f.nb });
  }
  const C = dedupe(cap);
  if (C.length >= 3) { const m = mul(C.reduce(add, [0, 0, 0]), 1 / C.length), nn = norm(n), t = Math.abs(nn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = norm(cross(nn, t)), w = cross(nn, u);
    C.sort((p, q) => Math.atan2(dot(sub(p, m), w), dot(sub(p, m), u)) - Math.atan2(dot(sub(q, m), w), dot(sub(q, m), u)));
    if (area(C) > 1e-12) out.push({ p: C, nb }); }   /* corners anticlockwise seen from outside, like the other faces */
  return out;
}
function dedupe(P) { const R = []; for (const q of P) if (!R.some(r => Math.abs(r[0] - q[0]) + Math.abs(r[1] - q[1]) + Math.abs(r[2] - q[2]) < 1e-7)) R.push(q);
  // drop corners that lie on a straight line between their neighbours
  for (let i = 0; R.length > 3 && i < R.length; i++) { const a = R[(i + R.length - 1) % R.length], b = R[i], c = R[(i + 1) % R.length]; if (len(cross(sub(b, a), sub(c, b))) < 1e-10) { R.splice(i, 1); i--; } }
  return R; }
export const area = f => { let s = [0, 0, 0]; for (let i = 1; i + 1 < f.length; i++) s = add(s, cross(sub(f[i], f[0]), sub(f[i + 1], f[0]))); return len(s) / 2; };
export function volume(poly, c) { let v = 0; for (const f of poly) for (let i = 1; i + 1 < f.p.length; i++) v += dot(sub(f.p[0], c), cross(sub(f.p[i], c), sub(f.p[i + 1], c))) / 6; return Math.abs(v); }
export function centroid(poly, c) { let v = 0, s = [0, 0, 0];
  for (const f of poly) for (let i = 1; i + 1 < f.p.length; i++) { const a = f.p[0], b = f.p[i], e = f.p[i + 1], t = Math.abs(dot(sub(a, c), cross(sub(b, c), sub(e, c)))) / 6; v += t; s = add(s, mul(add(add(add(a, b), e), c), t / 4)); }
  return v ? mul(s, 1 / v) : c; }

/**
 * The bubbles of a repeating foam. A = the three edge vectors of the repeating box (rows), pts = fractional positions,
 * w = optional weights (bigger weight, bigger bubble), per = which directions repeat ([1,1,1] for a crystal; [0,0,1] in a tube;
 * [1,1,0] between plates), box0 = the starting shape of every bubble (for a tube or plates) as a function of the point.
 * Returns one entry per point: { c (position), poly (faces, each tagged with the neighbour it faces: [point, image offset] or 'wall') }.
 */
export function cells({ A, pts, w = null, per = [1, 1, 1], start = null }) {
  const N = pts.length, X = pts.map(f => add(add(mul(A[0], f[0]), mul(A[1], f[1])), mul(A[2], f[2]))), W = w || pts.map(() => 0);
  const span = Math.max(len(A[0]), len(A[1]), len(A[2])), R = N > 12 ? 1 : 2, imgs = [];
  for (let i = -R * per[0]; i <= R * per[0]; i++) for (let j = -R * per[1]; j <= R * per[1]; j++) for (let k = -R * per[2]; k <= R * per[2]; k++) imgs.push([i, j, k]);
  return X.map((c, a) => {
    const cand = [];
    for (let b = 0; b < N; b++) for (const o of imgs) { if (b === a && !o[0] && !o[1] && !o[2]) continue;
      const q = add(add(add(X[b], mul(A[0], o[0])), mul(A[1], o[1])), mul(A[2], o[2])), n = sub(q, c); cand.push([len(n), b, o, q, n]); }
    cand.sort((x, y) => x[0] - y[0]);
    let poly = start ? start(c) : boxPoly(c, span * 1.6), rmax = Infinity;
    for (const [r, b, o, q, n] of cand) {
      if (r / 2 - Math.abs(W[a] - W[b]) / (2 * r) > rmax + 1e-9) break;
      poly = clip(poly, n, (dot(q, q) - dot(c, c) - W[b] + W[a]) / 2, [b, o]);
      if (!poly.length) break;
      rmax = 0; for (const f of poly) for (const p of f.p) rmax = Math.max(rmax, len(sub(p, c)));
    }
    return { c, poly };
  });
}

// ---------- the foams ----------
const S3 = Math.sqrt(3), cubic = (s = 1) => [[s, 0, 0], [0, s, 0], [0, 0, s]], hex = (a, c) => [[a, 0, 0], [-a / 2, a * S3 / 2, 0], [0, 0, c]];
const fcc = b => [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]].flatMap(t => b.map(p => p.map((x, i) => (((x + t[i]) % 1) + 1) % 1)));
// a seeded random number source, so every random foam comes out the same from its seed (and share links reproduce it)
export function rng(seed) { let h = (seed * 2654435761) >>> 0 || 1; return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; }; }
// space group P4_2/mnm, for the σ phase: the 16 ways it maps a point onto the others
const P42mnm = ([x, y, z]) => { const o = []; for (const [a, b, c] of [[x, y, z], [-x, -y, z], [-y + .5, x + .5, z + .5], [y + .5, -x + .5, z + .5], [-x + .5, y + .5, -z + .5], [x + .5, -y + .5, -z + .5], [y, x, -z], [-y, -x, -z]]) { o.push([a, b, c], [-a, -b, -c]); }
  return o.map(p => p.map(v => ((v % 1) + 1) % 1)); };
const uniq = P => { const R = []; for (const p of P) if (!R.some(r => r.every((v, i) => { const d = Math.abs(v - p[i]); return d < 1e-6 || Math.abs(d - 1) < 1e-6; }))) R.push(p); return R; };
const sigmaPts = () => uniq([[0, 0, 0], [0.398, 0.398, 0], [0.464, 0.131, 0], [0.741, 0.066, 0], [0.183, 0.183, 0.252]].flatMap(P42mnm));

// randomly scattered points that keep a little apart (a bubble's point never lands right next to another's)
function scatter(n, seed, minD) { const r = rng(seed), P = []; let tries = 0;
  while (P.length < n && tries++ < 20000) { const p = [r(), r(), r()]; if (P.every(q => { let s = 0; for (let i = 0; i < 3; i++) { let d = Math.abs(p[i] - q[i]); d = Math.min(d, 1 - d); s += d * d; } return s > minD * minD; })) P.push(p); }
  return P; }
function scatter2(n, seed, minD) { const r = rng(seed), P = []; let tries = 0;
  while (P.length < n && tries++ < 20000) { const p = [r(), r(), 0]; if (P.every(q => { let s = 0; for (let i = 0; i < 2; i++) { let d = Math.abs(p[i] - q[i]); d = Math.min(d, 1 - d); s += d * d; } return s > minD * minD; })) P.push(p); }
  return P; }
// bubbles of two or many sizes: radii, and points spread so that the spheres of those radii barely overlap
function sized(n, seed, radius) { const r = rng(seed), R = Array.from({ length: n }, () => radius(r)), P = Array.from({ length: n }, () => [r(), r(), r()]);
  for (let it = 0; it < 160; it++) for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const d = [0, 1, 2].map(i => { let v = P[b][i] - P[a][i]; return v - Math.round(v); }), l = Math.hypot(...d) || 1e-6, want = R[a] + R[b];
    if (l < want) { const push = (want - l) / 2 * 0.5; for (let i = 0; i < 3; i++) { P[a][i] = (((P[a][i] - d[i] / l * push) % 1) + 1) % 1; P[b][i] = (((P[b][i] + d[i] / l * push) % 1) + 1) % 1; } } }
  return { pts: P, w: R.map(x => x * x) }; }
// Lloyd's settling: move each point to the middle of its bubble, again and again; the bubbles even out like a foam left to rest
export function settle(def, steps) {
  let pts = def.pts.map(p => p.slice());
  for (let s = 0; s < steps; s++) { const C = cells({ ...def, pts });
    pts = C.map(({ c, poly }) => { const m = centroid(poly, c), A = def.A, inv = invert3(A), f = [0, 1, 2].map(j => m[0] * inv[0][j] + m[1] * inv[1][j] + m[2] * inv[2][j]); return f.map((v, i) => def.per[i] ? ((v % 1) + 1) % 1 : v); }); }
  return pts; }
function invert3(m) { const [a, b, c] = m, d = dot(a, cross(b, c)), r0 = cross(b, c), r1 = cross(c, a), r2 = cross(a, b); return [[r0[0] / d, r1[0] / d, r2[0] / d], [r0[1] / d, r1[1] / d, r2[1] / d], [r0[2] / d, r1[2] / d, r2[2] / d]]; }

const TUBE = (r = 1, m = 40) => ({ per: [0, 0, 1], start: c => prismPoly(r, m, c[2] - 3, c[2] + 3) });
const helix = (n, turn, rad) => Array.from({ length: n }, (_, k) => [rad * Math.cos(k * turn), rad * Math.sin(k * turn), k / n]);

export const GROUPS = [['crystal', 'Crystal foams'], ['fk', 'Frank–Kasper foams (the Weaire–Phelan family)'], ['natural', 'Natural foams'], ['tube', 'Bubbles in a tube'], ['flat', 'Flat foams and clusters']];
export const FOAMS = {
  // crystal foams: one repeating point (or a few), every bubble alike or nearly
  cube: { group: 'crystal', name: 'Cubes', alt: 'the simple cubic lattice', def: () => ({ A: cubic(), pts: [[0, 0, 0]] }),
    info: 'The simplest way to fill space: cubes. As a foam it is a poor one. Twelve films meet four at a time along each edge, and real soap films never do that: they slide until only three meet, at 120°. Cubes use about 13% more wall than Kelvin\'s foam.' },
  kelvin: { group: 'crystal', name: 'Kelvin\'s foam', alt: 'truncated octahedra, 1887', def: () => ({ A: cubic(), pts: [[0, 0, 0], [0.5, 0.5, 0.5]] }),
    info: 'In 1887 Lord Kelvin asked how to divide space into bubbles of equal size with the least wall. His answer: truncated octahedra, each with six squares and eight hexagons, the films bent very slightly. For over a century nobody did better.' },
  rhombic: { group: 'crystal', name: 'Rhombic dodecahedra', alt: 'twelve diamonds: the face-centred cubic lattice', def: () => ({ A: cubic(), pts: [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]] }),
    info: 'Pack oranges the greengrocer\'s way and squash them until the gaps close: each becomes a rhombic dodecahedron with twelve diamond faces. The ends of honeybee cells are made of three of these diamonds. But some corners have eight edges meeting, which a soap foam won\'t allow.' },
  hcp: { group: 'crystal', name: 'Stacked close packing', alt: 'trapezo-rhombic dodecahedra: the hexagonal close-packed lattice', def: () => ({ A: hex(1, Math.sqrt(8 / 3)), pts: [[1 / 3, 2 / 3, 0.25], [2 / 3, 1 / 3, 0.75]] }),
    info: 'The other way of stacking oranges: each layer sits in the hollows of the one below, alternating between two positions. Squashed, every orange becomes a twelve-faced bubble with six diamonds and six trapezia, a cousin of the rhombic dodecahedron.' },
  prism: { group: 'crystal', name: 'Hexagonal prisms', alt: 'a honeycomb, stacked', def: () => ({ A: hex(1, 0.8), pts: [[0, 0, 0]] }),
    info: 'Honeycomb cells stacked in layers: hexagonal prisms. Across each layer the walls meet three at a time at 120°, just as soap films like. Between layers, though, the flat floors meet the walls at right angles.' },
  diamond: { group: 'crystal', name: 'Diamond', alt: 'triakis truncated tetrahedra: the points of a diamond crystal', def: () => ({ A: cubic(), pts: fcc([[0, 0, 0], [0.25, 0.25, 0.25]]) }),
    info: 'The carbon atoms of a diamond, each given its own bubble. Every bubble has sixteen faces: four hexagons and twelve triangles, a shape called a triakis truncated tetrahedron. It is the only foam here whose bubbles come in left- and right-leaning pairs that interlock.' },
  stretched: { group: 'crystal', name: 'Kelvin, stretched', alt: 'from Kelvin\'s foam to rhombic dodecahedra', params: [{ id: 'c', label: 'Stretch', min: 0.7, max: 1.6, step: 0.01, def: 1.2 }],
    def: P => ({ A: [[1, 0, 0], [0, 1, 0], [0, 0, P.c]], pts: [[0, 0, 0], [0.5, 0.5, 0.5]] }),
    info: 'Take Kelvin\'s foam and stretch it in one direction. At 1 it is Kelvin\'s; at about 1.41 (the square root of 2) every bubble has become a rhombic dodecahedron. In between, the squares shrink and vanish. Metals do this when they change crystal form (the Bain path).' },
  // Frank–Kasper foams: bubbles with 12, 14, 15 and 16 faces, every face a pentagon or hexagon
  wp: { group: 'fk', name: 'Weaire–Phelan', alt: 'A15: beat Kelvin in 1993', def: () => ({ A: cubic(), pts: [[0, 0, 0], [0.5, 0.5, 0.5], [0.25, 0, 0.5], [0.75, 0, 0.5], [0, 0.5, 0.25], [0, 0.5, 0.75], [0.5, 0.25, 0], [0.5, 0.75, 0]] }),
    info: 'In 1993 Denis Weaire and Robert Phelan found a foam with 0.3% less wall than Kelvin\'s, using two kinds of bubble: twelve-faced ones made of pentagons, and fourteen-faced ones with two hexagons. The 2008 Beijing Olympic swimming centre, the Water Cube, was built from it. It is the crystal structure called A15.' },
  c15: { group: 'fk', name: 'C15', alt: 'Laves phase: twelve- and sixteen-faced bubbles', def: () => ({ A: cubic(), pts: fcc([[0, 0, 0], [0.25, 0.25, 0.25], [0.625, 0.625, 0.625], [0.625, 0.875, 0.875], [0.875, 0.625, 0.875], [0.875, 0.875, 0.625]]) }),
    info: 'Another Frank–Kasper foam, from the alloy MgCu₂: two twelve-faced bubbles for every sixteen-faced one. Clathrate ice, which traps gas such as methane in cages of water molecules under the sea floor, has the same arrangement.' },
  c14: { group: 'fk', name: 'C14', alt: 'Laves phase, hexagonal', def: () => { const x = -0.1695, z = 0.0622; return { A: hex(1, Math.sqrt(8 / 3)), pts: [[1 / 3, 2 / 3, z], [2 / 3, 1 / 3, z + 0.5], [2 / 3, 1 / 3, -z], [1 / 3, 2 / 3, 0.5 - z], [0, 0, 0], [0, 0, 0.5], [x, 2 * x, 0.25], [-2 * x, -x, 0.25], [x, -x, 0.25], [-x, -2 * x, 0.75], [2 * x, x, 0.75], [-x, x, 0.75]].map(p => p.map(v => ((v % 1) + 1) % 1)) }; },
    info: 'The hexagonal cousin of C15, from the alloy MgZn₂: the same two kinds of bubble, twelve- and sixteen-faced, stacked in a different order, as the two ways of stacking oranges differ.' },
  z: { group: 'fk', name: 'Z phase', alt: 'twelve-, fourteen- and fifteen-faced bubbles', def: () => ({ A: hex(1, 0.99), pts: [[0.5, 0, 0], [0, 0.5, 0], [0.5, 0.5, 0], [1 / 3, 2 / 3, 0.5], [2 / 3, 1 / 3, 0.5], [0, 0, 0.25], [0, 0, 0.75]] }),   /* Zr₄Al₃: Al (3f) twelve faces, Zr (2d) fourteen, Zr (2e) fifteen, in chains along the axis */
    info: 'Seven bubbles in each repeat: three with twelve faces, two with fourteen and two with fifteen. It is the structure of the alloy Zr₄Al₃.' },
  sigma: { group: 'fk', name: 'σ phase', file: 'sigma phase', alt: 'thirty bubbles of three kinds', def: () => ({ A: [[1, 0, 0], [0, 1, 0], [0, 0, 0.52]], pts: sigmaPts() }),
    info: 'The σ phase of iron and chromium, which makes stainless steel brittle when it forms: thirty bubbles in each repeat, ten with twelve faces, sixteen with fourteen and four with fifteen. In 2018 it turned up as a soft-matter foam too, in self-assembling polymer spheres.' },
  // natural foams
  random: { group: 'natural', name: 'Random foam', alt: 'like soap suds', params: [{ id: 'n', label: 'Bubbles', min: 8, max: 60, step: 1, def: 32 }], seeded: true,
    def: (P, seed) => ({ A: cubic(), pts: scatter(P.n, seed, 0.35 / Math.cbrt(P.n)) }),
    info: 'Bubbles where they happen to fall: points scattered at random, each given its bubble. Random points give bubbles with about 15.5 faces on average, more than real suds, whose films have had time to pull straight (about 13.5; Kelvin\'s have exactly 14). Settle it and the count falls.' },
  settled: { group: 'natural', name: 'Settled foam', alt: 'a random foam, left to even out', params: [{ id: 'n', label: 'Bubbles', min: 8, max: 60, step: 1, def: 32 }, { id: 'k', label: 'Settling', min: 0, max: 30, step: 1, def: 12 }], seeded: true,
    def: (P, seed) => ({ A: cubic(), pts: scatter(P.n, seed, 0.35 / Math.cbrt(P.n)), settle: P.k }),
    info: 'Start from random bubbles and let each one move to the middle of the space it has (Lloyd\'s method), again and again. The sizes even out and the faces drift toward pentagons, as a real foam does when its films relax. Press Settle to watch it happen.' },
  twosize: { group: 'natural', name: 'Big and small', alt: 'two sizes of bubble', params: [{ id: 'n', label: 'Bubbles', min: 10, max: 50, step: 1, def: 28 }, { id: 'r', label: 'Size ratio', min: 1, max: 2.2, step: 0.05, def: 1.6 }], seeded: true,
    def: (P, seed) => { const big = 0.33; return { A: cubic(), ...sized(P.n, seed, r => (r() < big ? P.r : 1) * 0.52 / Math.cbrt(P.n * (big * P.r ** 3 + 1 - big))) }; },
    info: 'A third of the bubbles bigger than the rest. Big bubbles have more faces, small ones fewer: bubbles with more than about fourteen faces tend to grow and steal gas from their smaller neighbours, which is how a real foam coarsens over time.' },
  mixed: { group: 'natural', name: 'Many sizes', alt: 'bubbles of every size', params: [{ id: 'n', label: 'Bubbles', min: 10, max: 50, step: 1, def: 30 }, { id: 'spread', label: 'Spread', min: 0, max: 1, step: 0.05, def: 0.6 }], seeded: true,
    def: (P, seed) => ({ A: cubic(), ...sized(P.n, seed, r => Math.exp(P.spread * (r() + r() + r() - 1.5)) * 0.5 / Math.cbrt(P.n)) }),
    info: 'Sizes spread out the way they are in beer froth or a bath: a few big bubbles among many small ones. The number of faces follows the size closely.' },
  // bubbles in a tube
  bamboo: { group: 'tube', name: 'Bamboo', alt: 'one bubble across the tube', tube: true, params: [{ id: 'h', label: 'Bubble length', min: 0.3, max: 1.4, step: 0.02, def: 0.6 }],
    def: P => ({ A: [[1, 0, 0], [0, 1, 0], [0, 0, P.h]], pts: [[0, 0, 0]], ...TUBE() }),
    info: 'Blow bubbles into a straw that is narrow compared with them and they line up one after another, divided by flat films straight across: the bamboo structure.' },
  zigzag: { group: 'tube', name: 'Zigzag', alt: 'two bubbles, side by side in turn', tube: true, params: [{ id: 'h', label: 'Bubble length', min: 0.4, max: 1.4, step: 0.02, def: 0.8 }],
    def: P => ({ A: [[1, 0, 0], [0, 1, 0], [0, 0, 2 * P.h]], pts: [[0.42, 0, 0], [-0.42, 0, 0.5]], ...TUBE() }),
    info: 'Make the bubbles a little smaller than the tube is wide and they no longer fit one at a time: they fall to alternate sides, and the films between them tilt into a zigzag.' },
  twisted: { group: 'tube', name: 'Twisted zigzag', alt: 'the zigzag, turning as it goes', tube: true, params: [{ id: 'h', label: 'Bubble length', min: 0.3, max: 1, step: 0.02, def: 0.5 }],
    def: P => ({ A: [[1, 0, 0], [0, 1, 0], [0, 0, 8 * P.h]], pts: helix(8, Math.PI * (1 - 1 / 4), 0.45), ...TUBE() }),
    info: 'Slightly smaller bubbles again: the zigzag twists, each bubble a little round from the last, so the pattern winds down the tube like a screw.' },
  three: { group: 'tube', name: 'Three-bubble spiral', alt: 'three around, winding down the tube', tube: true, params: [{ id: 'h', label: 'Bubble length', min: 0.2, max: 0.8, step: 0.02, def: 0.36 }],
    def: P => ({ A: [[1, 0, 0], [0, 1, 0], [0, 0, 6 * P.h]], pts: helix(6, 2 * Math.PI / 3 + 0.35, 0.52), ...TUBE() }),
    info: 'With smaller bubbles still, three fit across the tube, and they stack in a spiral staircase. Such ordered foams in tubes were first sorted out by drawing them on paper and then by computer; the same structures appear in packed spheres and in some plant stems.' },
  // flat foams and clusters
  raft: { group: 'flat', name: 'Honeycomb raft', alt: 'a single layer between glass plates', flat: true, def: () => ({ A: hex(1, 1), pts: [[0, 0, 0]], per: [1, 1, 0] }),
    info: 'Squeeze a single layer of equal bubbles between two sheets of glass and they form a perfect honeycomb: three films meeting at 120° everywhere. In 1999 Thomas Hales proved that no other way of dividing a flat surface into equal areas uses less wall.' },
  flatrandom: { group: 'flat', name: 'Flat random foam', alt: 'a layer of uneven bubbles', flat: true, params: [{ id: 'n', label: 'Bubbles', min: 10, max: 90, step: 1, def: 40 }, { id: 'k', label: 'Settling', min: 0, max: 30, step: 1, def: 0 }], seeded: true,
    def: (P, seed) => ({ A: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], pts: scatter2(P.n, seed, 0.4 / Math.sqrt(P.n)), per: [1, 1, 0], settle: P.k }),
    info: 'A layer of uneven bubbles. On average each has six sides, as in the honeycomb (a fact that follows from Euler\'s formula). John von Neumann showed that in such a foam a bubble with more than six sides grows and one with fewer shrinks, at a rate set only by the number of its sides.' },
  double: { group: 'flat', name: 'Double bubble', alt: 'two bubbles stuck together', exact: true, params: [{ id: 'r', label: 'Second bubble', min: 0.4, max: 1, step: 0.01, def: 0.75 }],
    info: 'Two soap bubbles that touch share a wall. Every film is part of a sphere, and the three films meet at 120°. The shared wall bulges into the bigger bubble, which has the lower pressure inside. That this is the least wall for two volumes was proved only in 2000.' },
};
for (const k in FOAMS) FOAMS[k].key = k;
export const defaults = f => Object.fromEntries((f.params || []).map(p => [p.id, p.def]));

/** Build a foam: its repeating bubbles, with what they face, plus settling if asked. Cached by its settings. */
const memo = new Map();
export function build(key, P, seed) {
  const f = FOAMS[key], id = key + JSON.stringify(P) + (f.seeded ? seed : ''); if (memo.has(id)) return memo.get(id);
  const d = { per: [1, 1, 1], ...f.def(P, seed) };
  if (d.settle) d.pts = settle(d, d.settle);
  if (f.flat) { const a = Math.hypot(...[d.A[0][1] * d.A[1][2] - d.A[0][2] * d.A[1][1], d.A[0][2] * d.A[1][0] - d.A[0][0] * d.A[1][2], d.A[0][0] * d.A[1][1] - d.A[0][1] * d.A[1][0]]) / d.pts.length, h = 0.18 * Math.sqrt(a); d.start = c => slab(c, h); }   // the plates a little closer than a bubble is wide
  const C = cells(d), out = { def: d, cells: C };
  if (memo.size > 40) memo.delete(memo.keys().next().value); memo.set(id, out); return out;
}
// a flat slab round a point, for foams between plates
function slab(c, h) { let P = boxPoly([c[0], c[1], 0], 2.5);   /* the bubbles' points lie at height 0, inside the slab */ P = clip(P, [0, 0, 1], h, 'plate'); return clip(P, [0, 0, -1], h, 'plate'); }

/** Faces of each bubble counted, and the kinds of bubble (how many of each face count) in one repeat. */
export function kinds(C) { const m = {}; for (const { poly } of C) { const n = poly.filter(f => f.nb !== 'wall' && f.nb !== 'plate').length; m[n] = (m[n] || 0) + 1; } return m; }
/** Surface of each bubble over its volume to the power ⅔ (5.315 for Kelvin's foam, 4.836 for a sphere): less is better. */
export function wallScore(C) { let s = 0; for (const { c, poly } of C) { const a = poly.reduce((t, f) => t + area(f.p), 0), v = volume(poly, c); s += a / Math.pow(v, 2 / 3); } return s / C.length; }

// ---------- the double bubble, exactly ----------
// Two spheres of radii r1 ≥ r2 whose films meet at 120°: their centres are d apart with d² = r1² + r2² − r1·r2. The shared wall is a
// sphere of radius r1·r2 / (r1 − r2), bulging into the bigger bubble (flat when they're equal).
export function doubleBubble(ratio, seg = 64) {
  const r1 = 1, r2 = ratio, d = Math.sqrt(r1 * r1 + r2 * r2 - r1 * r2), x = (d * d + r1 * r1 - r2 * r2) / (2 * d), a = Math.sqrt(Math.max(0, r1 * r1 - x * x));   // the circle where they meet: at x from the first centre, radius a
  // a spherical cap round the x axis: centre cx, radius r, polar angle (from +x) from t0 to t1
  const cap = (cx, r, t0, t1, flip) => { const P = []; for (let i = 0; i < seg / 2; i++) for (let j = 0; j < seg; j++) {
      const q = (u, v) => { const t = t0 + (t1 - t0) * u, p = 2 * Math.PI * v; return [cx + r * Math.cos(t), r * Math.sin(t) * Math.cos(p), r * Math.sin(t) * Math.sin(p)]; };
      const A = q(i / (seg / 2), j / seg), B = q((i + 1) / (seg / 2), j / seg), C = q((i + 1) / (seg / 2), (j + 1) / seg), D = q(i / (seg / 2), (j + 1) / seg);
      P.push(...(flip ? [A, C, B, A, D, C] : [A, B, C, A, C, D])); } return P; };
  const th1 = Math.atan2(a, x), th2 = Math.atan2(a, d - x);   // half-angles of the caps cut off at the meeting circle
  const one = cap(0, r1, th1, Math.PI, false), two = cap(d, r2, 0, Math.PI - th2, false);
  let wall, wallC = null, wallR = Infinity;
  if (Math.abs(r1 - r2) < 1e-4) { wall = []; for (let i = 0; i < seg / 2; i++) for (let j = 0; j < seg; j++) { const q = (u, v) => [x, a * u * Math.cos(2 * Math.PI * v), a * u * Math.sin(2 * Math.PI * v)];
      const A = q(i / (seg / 2), j / seg), B = q((i + 1) / (seg / 2), j / seg), C = q((i + 1) / (seg / 2), (j + 1) / seg), D = q(i / (seg / 2), (j + 1) / seg); wall.push(A, B, C, A, C, D); } }
  else { const R = r1 * r2 / (r1 - r2), cx = x + Math.sqrt(Math.max(0, R * R - a * a)), tw = Math.asin(Math.min(1, a / R)); wall = cap(cx, R, Math.PI - tw, Math.PI, false); wallC = [cx, 0, 0]; wallR = R; }   // centred on the small bubble's side, so it bulges into the big one
  return { tris: [one, two, wall], centres: [[0, 0, 0], [d, 0, 0]], radii: [r1, r2], d, wallC, wallR };
}
