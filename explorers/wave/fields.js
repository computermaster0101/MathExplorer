// The maths behind Waves & Cymatics: vibration patterns of square and round plates, shapes for the epicycles, and the
// Fourier transform that turns a drawing into circles.

// ---------- Bessel functions: the shapes a round drum can vibrate in ----------
/** J_m(x) from its integral, (1/π) ∫ cos(m t − x sin t) dt over 0..π (accurate to about 1e-6 for x < 40 with 64 steps). */
export function besselJ(m, x) { const N = 64; let s = 0; for (let i = 0; i < N; i++) { const t = (i + 0.5) * Math.PI / N; s += Math.cos(m * t - x * Math.sin(t)); } return s / N; }
/** The first n places where J_m crosses zero: where a round drum's rings of stillness sit. */
export function besselZeros(m, n) {
  const z = []; let x = 0.5, prev = besselJ(m, x);
  while (z.length < n && x < 80) { const nx = x + 0.05, v = besselJ(m, nx);
    if (prev * v < 0) { let a = x, b = nx; for (let i = 0; i < 40; i++) { const c = (a + b) / 2; if (besselJ(m, a) * besselJ(m, c) <= 0) b = c; else a = c; } if (m === 0 || (a + b) / 2 > 0.6) z.push((a + b) / 2); }
    x = nx; prev = v; }
  return z;
}

// ---------- plate patterns ----------
// Square plate (free edges, the classic Chladni figures): cos(nπx)cos(mπy) ± cos(mπx)cos(nπy), x and y from -1/2 to 1/2.
// Round plate (a drum): J_m(k r) cos(m θ), with k the n-th zero of J_m so the rim stays still.
export const SQUARE_MODES = [[1, 2, 1], [1, 3, -1], [2, 3, 1], [1, 4, 1], [2, 4, -1], [1, 5, -1], [3, 4, 1], [2, 5, 1], [3, 5, -1], [1, 6, 1], [4, 5, 1], [3, 6, -1], [2, 7, 1], [5, 6, -1], [4, 7, 1], [3, 8, 1], [5, 8, -1], [6, 7, 1]];
export const ROUND_MODES = [[0, 2], [1, 1], [2, 1], [0, 3], [3, 1], [1, 2], [4, 1], [2, 2], [0, 4], [5, 1], [3, 2], [1, 3], [6, 1], [4, 2], [2, 3], [0, 5], [7, 1], [5, 2], [3, 3], [8, 2]];
const zeroCache = {};
export function roundK(m, n) { const z = zeroCache[m] || (zeroCache[m] = besselZeros(m, 8)); return z[n - 1]; }
/** The vibration (−1..1) over an N×N grid covering the plate (x, y from −1 to 1); NaN outside a round plate. Also returns how high it sounds compared with the plate's lowest pattern. */
export function plateGrid(shape, i, N) {
  if (isShaped(shape)) { const S = solved[shape]; if (!S) return null; const k = Math.min(i, S.modes.length - 1); return { A: S.modes[k], N: S.N, pitch: Math.sqrt(S.lam[k] / S.lam[0]) }; }
  const A = new Float32Array(N * N); let mx = 1e-9, pitch;
  if (shape === 'square') { const [n, m, s] = SQUARE_MODES[i % SQUARE_MODES.length], P = Math.PI;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = (x + 0.5) / N - 0.5, v = (y + 0.5) / N - 0.5, a = Math.cos(n * P * u) * Math.cos(m * P * v) + s * Math.cos(m * P * u) * Math.cos(n * P * v); A[y * N + x] = a; mx = Math.max(mx, Math.abs(a)); }
    pitch = (n * n + m * m) / 5; }
  else { const [m, n] = ROUND_MODES[i % ROUND_MODES.length], k = roundK(m, n), Jl = []; const R = 512; for (let j = 0; j <= R; j++) Jl.push(besselJ(m, k * j / R));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = (x + 0.5) / N * 2 - 1, v = (y + 0.5) / N * 2 - 1, r = Math.hypot(u, v);
      if (r > 1) { A[y * N + x] = NaN; continue; } const f = r * R, j0 = Math.floor(f), t = f - j0, J = Jl[j0] + (Jl[Math.min(R, j0 + 1)] - Jl[j0]) * t, a = J * Math.cos(m * Math.atan2(v, u)); A[y * N + x] = a; mx = Math.max(mx, Math.abs(a)); }
    pitch = k / roundK(0, 1); }
  for (let j = 0; j < A.length; j++) A[j] /= mx;
  return { A, N, pitch };
}
// ---------- plates of any outline: their vibration patterns worked out numerically ----------
// Shapes without a formula (a guitar, a triangle, a stadium) are solved like a drum with its edge held still: the lowest
// patterns of the Laplacian on a grid, by block inverse iteration with conjugate-gradient solves and a Rayleigh–Ritz step
// to separate close patterns. Checked on a square and a disc, where the answers are known: within 0.2%. It takes a second
// or two, so it runs in a worker, once per shape.
export const MASKS = {
  guitar: (x, y) => { const a = x * x / 0.33 + (y + 0.36) ** 2 / 0.36 < 1, b = x * x / 0.2 + (y - 0.42) ** 2 / 0.22 < 1, w = Math.abs(x) < 0.36 + 0.1 * Math.cos((y - 0.05) * 6) && y > -0.3 && y < 0.5; return (a || b || w) && Math.abs(x) < 0.62 && y > -0.96 && y < 0.88; },
  triangle: (x, y) => y > -0.475 && y < 0.95 - Math.sqrt(3) * Math.abs(x),   // equilateral, corners on a circle of radius 0.95
  stadium: (x, y) => (Math.abs(x) < 0.4 && Math.abs(y) < 0.5) || (x - 0.4) ** 2 + y * y < 0.25 || (x + 0.4) ** 2 + y * y < 0.25,
  rectangle: (x, y) => Math.abs(x) < 0.94 && Math.abs(y) < 0.94 / 1.6,
};
export const PLATE_INFO = { guitar: 'A drum shaped like a guitar\'s top. Luthiers tap and bow real guitar tops sprinkled with glitter or tea leaves to see exactly these patterns, and shave the wood until the patterns fall where they want.',
  triangle: 'An equilateral triangle: one of the few shapes besides rectangles and discs whose patterns can be written down exactly (Gabriel Lamé found them in 1833).',
  stadium: 'A stadium (a rectangle with round ends) is a famous shape in chaos theory: a ball bouncing inside it moves chaotically, and its higher patterns look jumbled, with strange "scars" along special paths.',
  rectangle: 'A rectangular drum, 1.6 times wider than tall: its still lines are straight, a grid in each direction, because its waves along and across are independent.' };
function membraneModes(mask, N, k, iters = 14) {
  const idx = new Int32Array(N * N).fill(-1), pts = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i + 0.5) / N * 2 - 1, y = (j + 0.5) / N * 2 - 1; if (mask(x, y)) { idx[j * N + i] = pts.length; pts.push(j * N + i); } }
  const n = pts.length, nb = pts.map(c => { const i = c % N, j = (c / N) | 0; return [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].map(([a, b]) => (a < 0 || b < 0 || a >= N || b >= N ? -1 : idx[b * N + a])); });
  const A = (v, out) => { for (let p = 0; p < n; p++) { let s = 4 * v[p]; const q = nb[p]; for (let t = 0; t < 4; t++) if (q[t] >= 0) s -= v[q[t]]; out[p] = s; } return out; };   // −Δ with the edge held still (missing neighbours count as 0)
  const dot = (a, b) => { let s = 0; for (let p = 0; p < n; p++) s += a[p] * b[p]; return s; };
  const cg = (b) => { const x = new Float64Array(n), r = Float64Array.from(b), pv = Float64Array.from(b), Ap = new Float64Array(n); let rr = dot(r, r); const tol = rr * 1e-18;
    for (let it = 0; it < 3 * Math.sqrt(n) + 100 && rr > tol; it++) { A(pv, Ap); const al = rr / dot(pv, Ap); for (let p = 0; p < n; p++) { x[p] += al * pv[p]; r[p] -= al * Ap[p]; } const r2 = dot(r, r); const be = r2 / rr; rr = r2; for (let p = 0; p < n; p++) pv[p] = r[p] + be * pv[p]; } return x; };
  const m = k + 4; let X = Array.from({ length: m }, (_, c) => { const v = new Float64Array(n); let s = c * 7919 + 1; for (let p = 0; p < n; p++) { s = (s * 16807) % 2147483647; v[p] = s / 2147483647 - 0.5; } return v; });
  const orth = V => { for (let a = 0; a < V.length; a++) { for (let b = 0; b < a; b++) { const d = dot(V[a], V[b]); for (let p = 0; p < n; p++) V[a][p] -= d * V[b][p]; } const l = Math.sqrt(dot(V[a], V[a])); for (let p = 0; p < n; p++) V[a][p] /= l; } return V; };
  X = orth(X); let lam = [];
  for (let it = 0; it < iters; it++) {
    X = orth(X.map(cg));
    // Rayleigh–Ritz: small eigenproblem of X^T A X (Jacobi rotations)
    const AX = X.map(v => A(v, new Float64Array(n))), S = X.map(a => AX.map(b => dot(a, b))), Q = S.map((_, i) => S.map((_, j) => (i === j ? 1 : 0)));
    for (let sw = 0; sw < 40; sw++) for (let p = 0; p < m; p++) for (let q = p + 1; q < m; q++) { if (Math.abs(S[p][q]) < 1e-14) continue;
      const th = 0.5 * Math.atan2(2 * S[p][q], S[q][q] - S[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (let r = 0; r < m; r++) { const sp = S[r][p], sq = S[r][q]; S[r][p] = c * sp - s * sq; S[r][q] = s * sp + c * sq; }
      for (let r = 0; r < m; r++) { const sp = S[p][r], sq = S[q][r]; S[p][r] = c * sp - s * sq; S[q][r] = s * sp + c * sq; }
      for (let r = 0; r < m; r++) { const qp = Q[r][p], qq = Q[r][q]; Q[r][p] = c * qp - s * qq; Q[r][q] = s * qp + c * qq; } }
    const order = [...Array(m).keys()].sort((a, b) => S[a][a] - S[b][b]); lam = order.map(i => S[i][i]);
    X = order.map(i => { const v = new Float64Array(n); for (let a = 0; a < m; a++) { const w = Q[a][i]; for (let p = 0; p < n; p++) v[p] += w * X[a][p]; } return v; });
  }
  const modes = X.slice(0, k).map(v => { const g = new Float32Array(N * N).fill(NaN); let mx = 0; for (let p = 0; p < n; p++) mx = Math.max(mx, Math.abs(v[p])); for (let p = 0; p < n; p++) g[pts[p]] = v[p] / mx; return g; });
  return { modes, lam: lam.slice(0, k), N };
}

const solved = {}, pending = {};
/** The patterns of a shaped plate, worked out in a worker the first time (resolves to {modes, lam, N}). */
export function shapedModes(shape) {
  if (solved[shape]) return Promise.resolve(solved[shape]);
  if (pending[shape]) return pending[shape];
  const src = `const MASKS = { ${Object.entries(MASKS).map(([k, f]) => k + ': ' + f.toString()).join(', ')} };\n${membraneModes.toString()}\nonmessage = e => { const r = membraneModes(MASKS[e.data], 72, 14, 16); postMessage(r, r.modes.map(m => m.buffer)); };`;
  return (pending[shape] = new Promise(res => {
    let w; try { w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); } catch (e) { w = null; }
    if (!w) { const r = membraneModes(MASKS[shape], 72, 14, 16); solved[shape] = r; res(r); return; }
    w.onmessage = e => { solved[shape] = e.data; res(e.data); w.terminate(); };
    w.postMessage(shape);
  }));
}
export const isShaped = shape => !!MASKS[shape];

export function modeName(shape, i) { if (isShaped(shape)) return `pattern ${i + 1}`; if (shape === 'square') { const [n, m] = SQUARE_MODES[i % SQUARE_MODES.length]; return `${n}, ${m}`; } const [m, n] = ROUND_MODES[i % ROUND_MODES.length]; return `${m} line${m === 1 ? '' : 's'}, ${n} ring${n === 1 ? '' : 's'}`; }

// ---------- shapes for the epicycles (closed curves, t from 0 to 1) ----------
const heart = t => { const a = 2 * Math.PI * t; return [16 * Math.sin(a) ** 3 / 17, (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17]; };
const star = t => { const k = Math.floor(t * 10), f = t * 10 - k, P = j => { const a = Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? 0.4 : 1; return [r * Math.cos(a), r * Math.sin(a)]; }, A = P(k), B = P(k + 1); return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]; };
const square = t => { const k = Math.floor(t * 4), f = t * 4 - k, C = [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8], [-0.8, -0.8]]; return [C[k][0] + (C[k + 1][0] - C[k][0]) * f, C[k][1] + (C[k + 1][1] - C[k][1]) * f]; };
const trefoil = t => { const a = 2 * Math.PI * t; return [(Math.sin(a) + 2 * Math.sin(2 * a)) / 3, (Math.cos(a) - 2 * Math.cos(2 * a)) / 3]; };
const butterfly = t => { const a = 12 * Math.PI * t, r = Math.exp(Math.cos(a)) - 2 * Math.cos(4 * a) - Math.sin(a / 12) ** 5; return [r * Math.sin(a) / 4.2, r * Math.cos(a) / 4.2 + 0.15]; };
const pi = t => { // the letter π, as one closed outline
  const P = [[-0.85, 0.55], [0.85, 0.55], [0.85, 0.75], [-0.85, 0.75], [-0.85, 0.55], [-0.5, 0.55], [-0.55, -0.2], [-0.7, -0.75], [-0.45, -0.75], [-0.3, -0.2], [-0.27, 0.55], [0.2, 0.55], [0.2, -0.5], [0.3, -0.72], [0.6, -0.72], [0.7, -0.5], [0.55, -0.5], [0.48, -0.58], [0.42, -0.5], [0.42, 0.55], [0.85, 0.55]];
  const L = []; let tot = 0; for (let i = 0; i + 1 < P.length; i++) { const d = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); L.push(d); tot += d; }
  let s = t * tot; for (let i = 0; i < L.length; i++) { if (s <= L[i]) { const f = s / L[i]; return [P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f]; } s -= L[i]; } return P[0]; };
const infinity = t => { const a = 2 * Math.PI * t, d = 1 + Math.sin(a) ** 2; return [Math.cos(a) / d * 0.95, Math.sin(a) * Math.cos(a) / d * 0.95]; };
const rose = t => { const a = 2 * Math.PI * t, r = Math.cos(5 * a); return [r * Math.cos(a) * 0.9, r * Math.sin(a) * 0.9]; };
const spiro = t => { const a = 6 * Math.PI * t, R0 = 5, r0 = 3, d = 4.2; return [((R0 - r0) * Math.cos(a) + d * Math.cos((R0 - r0) / r0 * a)) / 6.4, ((R0 - r0) * Math.sin(a) - d * Math.sin((R0 - r0) / r0 * a)) / 6.4]; };
const cardioid = t => { const a = 2 * Math.PI * t, r = 1 - Math.cos(a); return [r * Math.sin(a) * 0.48, (r * Math.cos(a) + 0.9) * 0.48 + 0.05]; };
const note = t => { // a musical quaver, as one closed outline
  const P = [[-0.52, -0.72], [-0.32, -0.86], [-0.08, -0.82], [0.02, -0.64], [0.02, 0.62], [0.42, 0.34], [0.5, 0.08], [0.56, 0.22], [0.5, 0.48], [0.08, 0.86], [-0.06, 0.86], [-0.06, -0.52], [-0.22, -0.48], [-0.46, -0.52], [-0.58, -0.62]];
  const L = []; let tot = 0; for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length], d = Math.hypot(B[0] - A[0], B[1] - A[1]); L.push(d); tot += d; }
  let s = t * tot; for (let i = 0; i < P.length; i++) { if (s <= L[i]) { const A = P[i], B = P[(i + 1) % P.length], f = s / L[i]; return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]; } s -= L[i]; } return P[0]; };
export const CURVES = { infinity: ['Infinity', infinity], rose: ['Five-petal rose', rose], spiro: ['Spirograph', spiro], cardioid: ['Cardioid', cardioid], note: ['Musical note', note], heart: ['Heart', heart], star: ['Star', star], square: ['Square', square], trefoil: ['Trefoil', trefoil], butterfly: ['Butterfly', butterfly], pi: ['π', pi] };
export function samplePath(f, n = 512) { const P = []; for (let i = 0; i < n; i++) P.push(f(i / n)); return P; }
/** Evenly re-spaced copy of a drawn path (so slow and fast strokes count the same), closed back to its start. */
export function resample(P, n = 512) {
  if (P.length < 2) return P; const Q = [...P, P[0]], L = [0]; for (let i = 1; i < Q.length; i++) L.push(L[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]));
  const tot = L[L.length - 1] || 1, out = []; let j = 0;
  for (let i = 0; i < n; i++) { const s = tot * i / n; while (j < L.length - 2 && L[j + 1] < s) j++; const f = (s - L[j]) / ((L[j + 1] - L[j]) || 1); out.push([Q[j][0] + (Q[j + 1][0] - Q[j][0]) * f, Q[j][1] + (Q[j + 1][1] - Q[j][1]) * f]); }
  return out;
}
/** Discrete Fourier transform of a closed path: one circle per frequency, sorted biggest first. Each is {f, r, ph}. */
export function dft(P) {
  const N = P.length, out = [];
  for (let k = 0; k < N; k++) { const f = k <= N / 2 ? k : k - N; let re = 0, im = 0;
    for (let n = 0; n < N; n++) { const a = -2 * Math.PI * f * n / N; re += P[n][0] * Math.cos(a) - P[n][1] * Math.sin(a); im += P[n][0] * Math.sin(a) + P[n][1] * Math.cos(a); }
    re /= N; im /= N; out.push({ f, r: Math.hypot(re, im), ph: Math.atan2(im, re) }); }
  return out.sort((a, b) => b.r - a.r);
}
