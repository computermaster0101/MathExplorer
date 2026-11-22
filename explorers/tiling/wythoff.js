// Wythoff's construction: uniform tilings made from the same mirror triangle as {p, q}, by putting the vertex somewhere
// other than a corner. The first triangle has corners O (a tile's centre), M (the middle of an edge) and V (a tile's corner),
// and three mirrors: m1 (through O and M), m2 (through O and V) and m3 (the tile's edge, through M and V). The vertex W sits
// on some mirrors and at equal distance from the others (the "ringed" mirrors); an edge runs from W straight across each
// ringed mirror. Those edges cut the triangle into up to three pieces, one round each corner, which become the faces:
// p-sided faces round O, q-sided round V and squares round M.
// Distances are measured in each world's own geometry (sphere, flat or hyperbolic), so W is exactly placed.

// kind → which mirrors are ringed (Coxeter diagram nodes 1, 2, 3 = mirrors m1, m2, m3)
export const KINDS = {
  regular: { rings: [1], name: 'Regular', sym: (p, q) => `{${p}, ${q}}`, vf: (p, q) => Array(q).fill(p) },
  rectified: { rings: [2], name: 'Rectified', sym: (p, q) => `r{${p}, ${q}}`, vf: (p, q) => [p, q, p, q] },
  dual: { rings: [3], name: 'Dual', sym: (p, q) => `{${q}, ${p}}`, vf: (p, q) => Array(p).fill(q) },
  truncated: { rings: [1, 2], name: 'Truncated', sym: (p, q) => `t{${p}, ${q}}`, vf: (p, q) => [q, 2 * p, 2 * p] },
  bitruncated: { rings: [2, 3], name: 'Truncated dual', sym: (p, q) => `t{${q}, ${p}}`, vf: (p, q) => [p, 2 * q, 2 * q] },
  cantellated: { rings: [1, 3], name: 'Cantellated', sym: (p, q) => `rr{${p}, ${q}}`, vf: (p, q) => [p, 4, q, 4] },
  omnitruncated: { rings: [1, 2, 3], name: 'Omnitruncated', sym: (p, q) => `tr{${p}, ${q}}`, vf: (p, q) => [4, 2 * p, 2 * q] },
};

/** Names of the uniform tilings that have one, by vertex configuration (faces round a vertex, smallest rotation first). */
const NAMED = {
  '3.6.6': 'truncated tetrahedron', '3.4.3.4': 'cuboctahedron', '3.3.3.3': 'octahedron', '4.6.6': 'truncated octahedron', '3.8.8': 'truncated cube',
  '3.4.4.4': 'rhombicuboctahedron', '4.6.8': 'truncated cuboctahedron', '3.10.10': 'truncated dodecahedron', '5.6.6': 'truncated icosahedron (a football)',
  '3.5.3.5': 'icosidodecahedron', '3.4.5.4': 'rhombicosidodecahedron', '4.6.10': 'truncated icosidodecahedron', '3.3.3': 'tetrahedron', '4.4.4': 'cube',
  '3.3.3.3.3': 'icosahedron', '5.5.5': 'dodecahedron', '4.8.8': 'truncated square tiling', '3.6.3.6': 'trihexagonal tiling', '3.12.12': 'truncated hexagonal tiling',
  '3.4.6.4': 'rhombitrihexagonal tiling', '4.6.12': 'truncated trihexagonal tiling', '4.4.4.4': 'square tiling', '6.6.6': 'hexagonal tiling', '3.3.3.3.3.3': 'triangular tiling' };
export function vertexConfig(kind, p, q) { const v = KINDS[kind].vf(p, q); let best = null;
  const less = (x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };   // compare as numbers, so 3.10.10 comes before 10.10.3
  for (let i = 0; i < v.length; i++) for (const s of [v.slice(i).concat(v.slice(0, i)), v.slice(i).concat(v.slice(0, i)).reverse()]) if (!best || less(s, best)) best = s;
  return best.join('.'); }
export const tilingName = (kind, p, q) => NAMED[vertexConfig(kind, p, q)] || '';

const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
/**
 * geo: {K, a, x0, v, c, r} from the tiling explorer's geometry(). Returns W, the separating lines (as vec4: circle
 * [cx, cy, r², 0] or line [nx, ny, d, 1]; value of the line at a point is |w−c|² − r² or n·w − d), the side each corner's
 * face lies on (+1 / −1, or 0 when that line doesn't bound it), and which corners have a face.
 */
export function wythoff(geo, kind) {
  const { K, a, x0 } = geo, rings = KINDS[kind].rings, O = [0, 0], M = [x0, 0], V = [geo.v * Math.cos(a), geo.v * Math.sin(a)];
  const dist = (P, Q) => { const d = Math.hypot(P[0] - Q[0], P[1] - Q[1]); if (K === 0) return d; const den = Math.hypot(...[1, 0].map((v, i) => v + K * cmul([Q[0], -Q[1]], P)[i])); return K < 0 ? 2 * Math.atanh(Math.min(d / den, 0.999999999)) : 2 * Math.atan(d / den); };
  const refl = [P => [P[0], -P[1]], P => { const c2 = Math.cos(2 * a), s2 = Math.sin(2 * a); return [c2 * P[0] + s2 * P[1], s2 * P[0] - c2 * P[1]]; },
    P => { if (K === 0) return [2 * x0 - P[0], P[1]]; const d = [P[0] - geo.c, P[1]], k = geo.r * geo.r / (d[0] * d[0] + d[1] * d[1]); return [geo.c + d[0] * k, d[1] * k]; }];
  const dm = (P, i) => dist(P, refl[i - 1](P)) / 2;   // distance from P to mirror i
  const bisect = (f, lo, hi) => { let flo = f(lo); for (let it = 0; it < 80; it++) { const mid = (lo + hi) / 2, fm = f(mid); if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid; } return (lo + hi) / 2; };
  const onM1 = t => [t * x0, 0], onM2 = t => [t * V[0], t * V[1]];
  const onM3 = t => { if (K === 0) return [x0, t * V[1]]; const tM = Math.atan2(0, x0 - geo.c), tV = Math.atan2(V[1], V[0] - geo.c); let d = tV - tM; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; const th = tM + t * d; return [geo.c + geo.r * Math.cos(th), geo.r * Math.sin(th)]; };
  let W; const has = i => rings.includes(i);
  if (rings.length === 1) W = has(1) ? V : has(2) ? M : O;
  else if (rings.length === 2) {
    if (!has(3)) W = onM3(bisect(t => dm(onM3(t), 1) - dm(onM3(t), 2), 1e-9, 1 - 1e-9));
    else if (!has(1)) W = onM1(bisect(t => dm(onM1(t), 2) - dm(onM1(t), 3), 1e-9, 1 - 1e-9));
    else W = onM2(bisect(t => dm(onM2(t), 1) - dm(onM2(t), 3), 1e-9, 1 - 1e-9));
  } else {   // all three: on the bisector of m1 and m2 (the line through O at half the angle), equally far from m3
    const dir = [Math.cos(a / 2), Math.sin(a / 2)], beyond = P => (K < 0 ? Math.hypot(P[0] - geo.c, P[1]) < geo.r : K > 0 ? Math.hypot(P[0] - geo.c, P[1]) > geo.r : P[0] > x0);
    const sMax = bisect(s => (beyond([dir[0] * s, dir[1] * s]) ? 1 : -1), 0, Math.max(geo.v, x0) * 1.01 + 1e-9);
    W = (s => [dir[0] * s, dir[1] * s])(bisect(s => dm([dir[0] * s, dir[1] * s], 1) - dm([dir[0] * s, dir[1] * s], 3), 1e-9 * sMax, sMax * (1 - 1e-9)));
  }
  // the line (geodesic) through two points, as a circle or a straight line in the picture
  const through = (A, B) => {
    if (K === 0 || Math.hypot(...A) < 1e-9 || Math.hypot(...B) < 1e-9) { const P = Math.hypot(...A) < 1e-9 ? B : A, Q = P === A ? B : A;
      if (K !== 0) { const n = [-P[1], P[0]], l = Math.hypot(...n); return [n[0] / l, n[1] / l, 0, 1]; }   // through the middle: a straight line
      const n = [-(B[1] - A[1]), B[0] - A[0]], l = Math.hypot(...n); return [n[0] / l, n[1] / l, (n[0] * A[0] + n[1] * A[1]) / l, 1]; }
    const a2 = A[0] * A[0] + A[1] * A[1];   // A's partner: its inversion in the rim (hyperbolic) or its opposite point (sphere)
    const Ast = K < 0 ? [A[0] / a2, A[1] / a2] : [-A[0] / a2, -A[1] / a2];
    const P1 = A, P2 = B, P3 = Ast, d = 2 * (P1[0] * (P2[1] - P3[1]) + P2[0] * (P3[1] - P1[1]) + P3[0] * (P1[1] - P2[1]));
    if (Math.abs(d) < 1e-12) { const n = [-(B[1] - A[1]), B[0] - A[0]], l = Math.hypot(...n); return [n[0] / l, n[1] / l, (n[0] * A[0] + n[1] * A[1]) / l, 1]; }
    const s1 = P1[0] ** 2 + P1[1] ** 2, s2 = P2[0] ** 2 + P2[1] ** 2, s3 = P3[0] ** 2 + P3[1] ** 2;
    const cx = (s1 * (P2[1] - P3[1]) + s2 * (P3[1] - P1[1]) + s3 * (P1[1] - P2[1])) / d, cy = (s1 * (P3[0] - P2[0]) + s2 * (P1[0] - P3[0]) + s3 * (P2[0] - P1[0])) / d;
    return [cx, cy, (P1[0] - cx) ** 2 + (P1[1] - cy) ** 2, 0];
  };
  const sep = [1, 2, 3].map(i => (has(i) ? through(W, refl[i - 1](W)) : null));
  const val = (L, P) => (L[3] ? L[0] * P[0] + L[1] * P[1] - L[2] : (P[0] - L[0]) ** 2 + (P[1] - L[1]) ** 2 - L[2]);
  const G = [(O[0] + M[0] + V[0]) / 3, (O[1] + M[1] + V[1]) / 3], near = X => [X[0] + 0.04 * (G[0] - X[0]), X[1] + 0.04 * (G[1] - X[1])];
  const corners = [O, M, V], bound = [[1, 2], [1, 3], [2, 3]];
  const sign = corners.map((X, ci) => [1, 2, 3].map(i => (bound[ci].includes(i) && sep[i - 1] ? Math.sign(val(sep[i - 1], near(X))) || 1 : 0)));
  // the face round a corner has 2n sides when both its mirrors are ringed and n when one is (the corner's angle is π/n); at M
  // (a right angle, n = 2) one ringed mirror gives a 2-sided face, which is no face at all
  const exists = [has(1) || has(2), has(1) && has(3), has(2) || has(3)];
  return { W, sep: sep.map(L => L || [0, 0, 0, 2]), sign, exists, dm: [1, 2, 3].map(i => dm(W, i)) };
}
