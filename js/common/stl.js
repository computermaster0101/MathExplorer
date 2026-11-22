// Building STL files for 3D printing: from triangles, from tubes along a path, and from a height map (a relief tile).
// Sizes are in millimetres; the model is centred and stands on the bed (lowest point at z = 0).

/** Binary STL from a flat list of triangles (9 numbers each: three corners), scaled so the longest side is mm long. */
export function stlFromTriangles(T, mm, header = 'Math Explorer') {
  const n = Math.floor(T.length / 9), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n * 9; i++) { const a = i % 3; if (T[i] < lo[a]) lo[a] = T[i]; if (T[i] > hi[a]) hi[a] = T[i]; }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1, s = mm ? mm / span : 1;
  const off = [-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]];
  // drop triangles with two identical corners (where a grid collapses to a point, as at a sphere's poles): they have no
  // area, and printing software warns about them
  const tol = span * 1e-6, same = (t, a, b) => Math.abs(T[t * 9 + a * 3] - T[t * 9 + b * 3]) < tol && Math.abs(T[t * 9 + a * 3 + 1] - T[t * 9 + b * 3 + 1]) < tol && Math.abs(T[t * 9 + a * 3 + 2] - T[t * 9 + b * 3 + 2]) < tol;
  const keep = []; for (let t = 0; t < n; t++) if (!same(t, 0, 1) && !same(t, 1, 2) && !same(t, 0, 2)) keep.push(t);
  const buf = new ArrayBuffer(84 + keep.length * 50), dv = new DataView(buf);
  for (let i = 0; i < Math.min(80, header.length); i++) dv.setUint8(i, header.charCodeAt(i));
  dv.setUint32(80, keep.length, true); let o = 84;
  for (const t of keep) {
    const P = [0, 1, 2].map(k => [0, 1, 2].map(a => (T[t * 9 + k * 3 + a] + off[a]) * s));
    const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], v = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
    let nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0]; const l = Math.hypot(nx, ny, nz) || 1;
    for (const x of [nx / l, ny / l, nz / l]) { dv.setFloat32(o, x, true); o += 4; }
    for (const p of P) for (const x of p) { dv.setFloat32(o, x, true); o += 4; }
    o += 2;
  }
  return { bytes: new Uint8Array(buf), size: [0, 1, 2].map(a => (hi[a] - lo[a]) * s), tris: keep.length };
}

/** Triangles of a closed tube of radius r along a path of 3D points (closed: join the end to the start). */
export function tubeTriangles(P, r, sides = 12, closed = false) {
  const n = P.length, T = [], frames = [];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], nrm = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let N = null;
  for (let i = 0; i < n; i++) {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)], t = nrm(sub(b, a));
    if (!N) N = nrm(cross(t, Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
    else { const d = N[0] * t[0] + N[1] * t[1] + N[2] * t[2]; N = nrm([N[0] - d * t[0], N[1] - d * t[1], N[2] - d * t[2]]); }   // carry the frame along the path
    frames.push([N, cross(t, N)]);
  }
  const ring = i => { const [U, V] = frames[i], p = P[i]; return Array.from({ length: sides }, (_, k) => { const c = Math.cos(2 * Math.PI * k / sides), s = Math.sin(2 * Math.PI * k / sides); return [0, 1, 2].map(a => p[a] + r * (c * U[a] + s * V[a])); }); };
  const R = P.map((_, i) => ring(i)), push = (...q) => { for (const p of q) T.push(...p); };
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) { const A = R[i], B = R[(i + 1) % n]; for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; push(A[k], A[k2], B[k2]); push(A[k], B[k2], B[k]); } }
  if (!closed) for (const [i, flip] of [[0, true], [n - 1, false]]) { const c = P[i], Rg = R[i]; for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; if (flip) push(c, Rg[k2], Rg[k]); else push(c, Rg[k], Rg[k2]); } }
  return T;
}

/**
 * A relief tile from a height map H (w × h values, 0..1): a solid block whose top follows the heights.
 * baseMm: solid floor thickness; reliefMm: how high the brightest point rises above it. The tile is sizeMm across.
 */
export function heightfieldTriangles(H, w, h, sizeMm, baseMm = 2, reliefMm = 3) {
  const T = [], sx = sizeMm / (w - 1), sy = sizeMm * (h / w) / (h - 1), z = (i, j) => baseMm + reliefMm * Math.min(1, Math.max(0, H[j * w + i]));
  const P = (i, j, top) => [i * sx, (h - 1 - j) * sy, top ? z(i, j) : 0], push = (a, b, c) => T.push(...a, ...b, ...c);
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = P(i, j, 1), b = P(i + 1, j, 1), c = P(i + 1, j + 1, 1), d = P(i, j + 1, 1); push(a, d, c); push(a, c, b);   // top, facing up
    const A = P(i, j, 0), B = P(i + 1, j, 0), C = P(i + 1, j + 1, 0), D = P(i, j + 1, 0); push(A, B, C); push(A, C, D);   // bottom, facing down
  }
  // the four sides
  for (let i = 0; i < w - 1; i++) { let a = P(i, 0, 1), b = P(i + 1, 0, 1), A = P(i, 0, 0), B = P(i + 1, 0, 0); push(a, b, B); push(a, B, A);
    a = P(i, h - 1, 1); b = P(i + 1, h - 1, 1); A = P(i, h - 1, 0); B = P(i + 1, h - 1, 0); push(a, B, b); push(a, A, B); }
  for (let j = 0; j < h - 1; j++) { let a = P(0, j, 1), b = P(0, j + 1, 1), A = P(0, j, 0), B = P(0, j + 1, 0); push(a, B, b); push(a, A, B);
    a = P(w - 1, j, 1); b = P(w - 1, j + 1, 1); A = P(w - 1, j, 0); B = P(w - 1, j + 1, 0); push(a, b, B); push(a, B, A); }
  return T;
}
