// ---------- endless labyrinths: triply periodic surfaces ----------
// Each surface is where g(x, y, z) = 0, repeating every 2π in each direction, and divides space into two tangled tunnel
// systems (labyrinths). The formulas are the standard "nodal" approximations; each was checked to behave like a soap film
// (mean curvature averaging nearly zero over the surface, against a non-minimal control) and, where the two labyrinths are
// alike, to split space about 50 : 50. (A Lidinoid formula failed that check and was left out.)
const { sin, cos } = Math;
export const TPMS = {
  gyroid: { name: 'Gyroid', alt: 'two mazes that twist like screws, no straight lines anywhere', g: (x, y, z) => sin(x) * cos(y) + sin(y) * cos(z) + sin(z) * cos(x), meet: '3', same: true,
    info: 'Alan Schoen found it at NASA in 1970. Its two labyrinths are mirror images that twist round each other like screws, and there is not one straight line on the surface. Butterfly wings get their colours from tiny gyroid crystals.' },
  schwarzP: { name: 'Schwarz P', alt: 'rooms joined by tunnels in six directions', g: (x, y, z) => cos(x) + cos(y) + cos(z), meet: '6', same: true,
    info: 'Hermann Schwarz, 1865. Every room has six tunnels, along the three axes, like a 3D plus sign; the two labyrinths are exactly the same shape, shifted half a step.' },
  schwarzD: { name: 'Schwarz D (diamond)', alt: 'tunnels joined four at a time, like a diamond', g: (x, y, z) => sin(x) * sin(y) * sin(z) + sin(x) * cos(y) * cos(z) + cos(x) * sin(y) * cos(z) + cos(x) * cos(y) * sin(z), meet: '4', same: true,
    info: 'Each labyrinth has the shape of the bonds in a diamond crystal: four tunnels meeting at every junction, at equal angles.' },
  neovius: { name: 'Neovius', alt: 'rooms with twelve windows', g: (x, y, z) => 3 * (cos(x) + cos(y) + cos(z)) + 4 * cos(x) * cos(y) * cos(z), meet: '6 and 12', same: false,
    info: 'Edvard Neovius, 1883: like Schwarz P, but the walls bulge into rooms with round windows. One labyrinth has six tunnels at each junction, the other twelve.' },
  iwp: { name: 'I-WP', alt: 'two different labyrinths: eight arms and four', g: (x, y, z) => 2 * (cos(x) * cos(y) + cos(y) * cos(z) + cos(z) * cos(x)) - (cos(2 * x) + cos(2 * y) + cos(2 * z)), meet: '8 and 4', same: false,
    info: 'Another of Schoen\'s surfaces. Unlike the gyroid, the two labyrinths are different: in one, eight tunnels meet at each junction; in the other, four.' },
  fischerKochS: { name: 'Fischer–Koch S', alt: 'tight, twisting tunnels', g: (x, y, z) => cos(2 * x) * sin(y) * cos(z) + cos(x) * cos(2 * y) * sin(z) + sin(x) * cos(y) * cos(2 * z), meet: '—', same: true,
    info: 'Found by Werner Fischer and Elke Koch in 1987 while classifying crystal structures. Its tunnels are narrower and twist more tightly than the gyroid\'s.' },
  frd: { name: 'Schoen F-RD', alt: 'a labyrinth with the shape of a crystal', g: (x, y, z) => 4 * cos(x) * cos(y) * cos(z) - (cos(2 * x) * cos(2 * y) + cos(2 * y) * cos(2 * z) + cos(2 * z) * cos(2 * x)), meet: '—', same: false,
    info: 'Schoen\'s F-RD: its rooms sit in a face-centred cubic pattern, like the atoms of copper or gold, joined to the rhombic dodecahedral cells of the other labyrinth.' },
  splitP: { name: 'Split P', alt: 'Schwarz P split into a double', g: (x, y, z) => 1.1 * (sin(2 * x) * sin(z) * cos(y) + sin(2 * y) * sin(x) * cos(z) + sin(2 * z) * sin(y) * cos(x)) - 0.2 * (cos(2 * x) * cos(2 * y) + cos(2 * y) * cos(2 * z) + cos(2 * z) * cos(2 * x)) - 0.4 * (cos(2 * x) + cos(2 * y) + cos(2 * z)), meet: '—', same: true,
    info: 'A surface between the gyroid and Schwarz P, found in studies of how soap-like molecules arrange themselves. Its tunnels split and rejoin.' },
};
/**
 * The solid for each way of showing a labyrinth, as a field that is negative inside the solid: sheet (a wall of thickness
 * t round the surface), network (one labyrinth made solid, the other left open) and double (both labyrinths solid, with a
 * gap of width t between them).
 */
export function solidField(g, mode, t, flip = 1) {
  // g ÷ |∇g| is close to the true distance from the surface, so walls come out the same thickness everywhere (plain |g| < t
  // made some walls thinner than the mesh grid, which left holes)
  const e = 1e-3, d = (x, y, z) => { const v = g(x, y, z), gx = g(x + e, y, z) - g(x - e, y, z), gy = g(x, y + e, z) - g(x, y - e, z), gz = g(x, y, z + e) - g(x, y, z - e); return v / Math.max(Math.hypot(gx, gy, gz) / (2 * e), 0.05); };
  return mode === 'sheet' ? (x, y, z) => Math.abs(d(x, y, z)) - t : mode === 'network' ? (x, y, z) => t - flip * d(x, y, z) : (x, y, z) => t - Math.abs(d(x, y, z));
}

/**
 * One repeating cell (x, y, z each from −π to π) of the surface where F = 0, meshed with surface nets on a grid that wraps
 * round, so the triangles of neighbouring copies join up exactly: copies of this cell fill space with no seams. Returns
 * flat arrays of triangle corners and normals (from F's gradient, so it shades smoothly).
 */
export function periodicMesh(F, n) {
  const h = 2 * Math.PI / n, V = new Float32Array(n * n * n), at = i => -Math.PI + i * h, w = i => ((i % n) + n) % n, I = (i, j, k) => w(i) + w(j) * n + w(k) * n * n;
  for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) V[i + j * n + k * n * n] = F(at(i), at(j), at(k));
  const C8 = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], E12 = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cell = new Float32Array(n * n * n * 3).fill(NaN), gv = new Float64Array(8);
  for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let m = 0; for (let c = 0; c < 8; c++) { const q = C8[c]; gv[c] = V[I(i + q[0], j + q[1], k + q[2])]; if (gv[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue; let sx = 0, sy = 0, sz = 0, ne = 0;
    for (const [a, b] of E12) { if ((gv[a] < 0) === (gv[b] < 0)) continue; const t = gv[a] / (gv[a] - gv[b]), A = C8[a], B = C8[b]; sx += A[0] + t * (B[0] - A[0]); sy += A[1] + t * (B[1] - A[1]); sz += A[2] + t * (B[2] - A[2]); ne++; }
    const o = (i + j * n + k * n * n) * 3; cell[o] = at(i) + sx / ne * h; cell[o + 1] = at(j) + sy / ne * h; cell[o + 2] = at(k) + sz / ne * h;
  }
  // a cell index that wrapped round the grid sits a whole period away: shift its corner back next to its neighbours
  const pos = [], nor = [], vert = (i, j, k) => { const o = I(i, j, k) * 3; if (isNaN(cell[o])) return null; const T = 2 * Math.PI; return [cell[o] + Math.floor(i / n) * T, cell[o + 1] + Math.floor(j / n) * T, cell[o + 2] + Math.floor(k / n) * T]; };
  const grad = p => { const e = 1e-3; const g = [F(p[0] + e, p[1], p[2]) - F(p[0] - e, p[1], p[2]), F(p[0], p[1] + e, p[2]) - F(p[0], p[1] - e, p[2]), F(p[0], p[1], p[2] + e) - F(p[0], p[1], p[2] - e)], l = Math.hypot(...g) || 1; return g.map(v => v / l); };
  for (let a = 0; a < 3; a++) { const u = (a + 1) % 3, wv = (a + 2) % 3;
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const p = [0, 0, 0]; p[a] = x; p[u] = y; p[wv] = z; const s0 = V[I(p[0], p[1], p[2])] < 0, q2 = p.slice(); q2[a]++; const s1 = V[I(q2[0], q2[1], q2[2])] < 0; if (s0 === s1) continue;
      const ci = (du, dw) => { const c = p.slice(); c[u] -= du; c[wv] -= dw; return vert(c[0], c[1], c[2]); };
      const q = [ci(1, 1), ci(0, 1), ci(0, 0), ci(1, 0)]; if (q.includes(null)) continue;
      const tri = s0 ? [q[0], q[1], q[2], q[0], q[2], q[3]] : [q[0], q[2], q[1], q[0], q[3], q[2]];
      for (const v of tri) { pos.push(...v); nor.push(...grad(v)); }
    } }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor) };
}
/** A watertight solid for printing: where F < 0 inside a cube of half-width L, by marching tetrahedra. */
export function solidForPrint(F, n, L) {
  const N = n + 1, h = 2 * L / n, V = new Float32Array(N * N * N), at = i => -L + i * h;
  for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let val = F(at(i), at(j), at(k)); if (i === 0 || j === 0 || k === 0 || i === n || j === n || k === n) val = Math.max(val, 1e-3); if (val === 0) val = 1e-9; V[i + j * N + k * N * N] = val; }
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], TET = [[0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7], [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7]], T = [];
  const P = (i, j, k) => [at(i), at(j), at(k)];
  for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const cp = C.map(c => P(i + c[0], j + c[1], k + c[2])), cv = C.map(c => V[(i + c[0]) + (j + c[1]) * N + (k + c[2]) * N * N]);
    for (const t of TET) { const ins = t.filter(q => cv[q] < 0), out = t.filter(q => cv[q] >= 0); if (!ins.length || !out.length) continue;
      const E = (a, b) => { const [x, y] = cv[a] < 0 ? [a, b] : [b, a], tt = cv[x] / (cv[x] - cv[y]); return cp[x].map((q, r) => q + (cp[y][r] - q) * tt); };
      const mi = ins.reduce((s, q) => s.map((x, r) => x + cp[q][r] / ins.length), [0, 0, 0]);
      const emit = (a, b, c) => { const u = b.map((x, r) => x - a[r]), w = c.map((x, r) => x - a[r]), nn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], d = a.map((x, r) => x - mi[r]);
        if (nn[0] * d[0] + nn[1] * d[1] + nn[2] * d[2] >= 0) T.push(...a, ...b, ...c); else T.push(...a, ...c, ...b); };
      if (ins.length === 1) emit(E(ins[0], out[0]), E(ins[0], out[1]), E(ins[0], out[2]));
      else if (ins.length === 3) emit(E(out[0], ins[0]), E(out[0], ins[1]), E(out[0], ins[2]));
      else { const [a, b] = ins, [c, d] = out, p1 = E(a, c), p2 = E(a, d), p3 = E(b, d), p4 = E(b, c); emit(p1, p2, p3); emit(p1, p3, p4); } } }
  return T;
}
