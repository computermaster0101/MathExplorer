// ---------- the search behind the star uniform shapes (geometry/star-list.js) ----------
// Not loaded by the explorer: it's how star-list.js was made, kept so it can be checked or rerun. In the browser console
// on the explorer: const S = await import('/explorers/polytope/geometry/star-search.js'); const r = S.search(); then
// S.listSource(r) is the text of star-list.js. Plain arithmetic, so it also runs in Node.
//
// Wythoff's construction works with any four mirrors that meet at angles of a half turn divided by a fraction (3, 5/2,
// 3/2…), as long as all their reflections together make a finite group: then the mirrors bound a tetrahedron that covers
// the 3-sphere some whole number of times, and ringing mirrors builds a uniform shape exactly as with the ordinary ones.
// The search tries every such arrangement (each pair of mirrors at 2, 3, 3/2, 4, 4/3, 5, 5/2, 5/3 or 5/4), keeps those
// whose group is finite, builds every choice of rings, and keeps each different picture (corners and edges) once.
export const LABELS = [[2, 1], [3, 1], [3, 2], [4, 1], [4, 3], [5, 1], [5, 2], [5, 3], [5, 4]];
const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const PERMS = (() => { const out = [], go = (a, r) => { if (!r.length) out.push(a); r.forEach((x, i) => go([...a, x], r.filter((_, j) => j !== i))); }; go([], [0, 1, 2, 3]); return out; })();
export const labelText = ([n, d]) => (d === 1 ? String(n) : `${n}/${d}`);
// the Gram matrix of the mirror normals, and the normals themselves (rows), or null when no such tetrahedron exists
export function mirrors(lab) {
  const M = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  PAIRS.forEach(([i, j], k) => { const [n, d] = lab[k]; M[i][j] = M[j][i] = -Math.cos(Math.PI * d / n); });
  const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) { let s = M[i][j]; for (let k = 0; k < j; k++) s -= A[i][k] * A[j][k];
    if (i === j) { if (s < 1e-9) return null; A[i][i] = Math.sqrt(s); } else A[i][j] = s / A[j][j]; }
  return A;
}
const key = v => v.map(x => Math.round(x * 1e6)).join(',');
const refl = (a, v) => { const d = 2 * (a[0] * v[0] + a[1] * v[1] + a[2] * v[2] + a[3] * v[3]); return [v[0] - d * a[0], v[1] - d * a[1], v[2] - d * a[2], v[3] - d * a[3]]; };
/** The group the mirrors make, as matrices (16 numbers each), or null when it has more than cap elements. */
export function group(A, cap = 14400) {
  const gen = [0.3, 0.5, 0.7, 1.1], mul = (g, v) => [0, 1, 2, 3].map(i => g[i * 4] * v[0] + g[i * 4 + 1] * v[1] + g[i * 4 + 2] * v[2] + g[i * 4 + 3] * v[3]);
  const seen = new Map([[key(gen), 0]]), mats = [[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]];
  for (let q = 0; q < mats.length; q++) { const g = mats[q];
    for (const a of A) { const h = new Array(16);
      for (let c = 0; c < 4; c++) { const d = a[0] * g[c] + a[1] * g[4 + c] + a[2] * g[8 + c] + a[3] * g[12 + c]; for (let i = 0; i < 4; i++) h[i * 4 + c] = g[i * 4 + c] - 2 * a[i] * d; }
      const k = key(mul(h, gen)); if (!seen.has(k)) { if (mats.length >= cap) return null; seen.set(k, mats.length); mats.push(h); } } }
  return mats;
}
/** Corners and edges of the shape with rings R (four 0/1) on mirrors A with group G. */
export function build(A, G, R) {
  const inv = (() => { const n = 4, a = A.map((r, i) => [...r, ...[0, 1, 2, 3].map(j => (i === j ? 1 : 0))]);
    for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r; [a[c], a[p]] = [a[p], a[c]];
      const d = a[c][c]; for (let j = 0; j < 2 * n; j++) a[c][j] /= d; for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j]; } }
    return a.map(r => r.slice(n)); })();
  const p = [0, 1, 2, 3].map(i => R.reduce((s, w, k) => s + w * inv[i][k], 0)), pl = Math.hypot(...p), pn = p.map(x => x / pl);
  const ends = A.map((a, r) => (R[r] ? refl(a, pn) : null));
  const idx = new Map(), V = [], E = [], es = new Set();
  const id = v => { const k = key(v); let i = idx.get(k); if (i === undefined) { i = V.length; idx.set(k, i); V.push(v); } return i; };
  const mul = (g, v) => [0, 1, 2, 3].map(i => g[i * 4] * v[0] + g[i * 4 + 1] * v[1] + g[i * 4 + 2] * v[2] + g[i * 4 + 3] * v[3]);
  for (const g of G) { const a = id(mul(g, pn));
    for (let r = 0; r < 4; r++) if (ends[r]) { const b = id(mul(g, ends[r])); if (a === b) continue; const lo = Math.min(a, b), hi = Math.max(a, b), k = lo * 1e6 + hi; if (!es.has(k)) { es.add(k); E.push([lo, hi]); } } }
  return { verts: V, edges: E };
}
/** A fingerprint of a picture that doesn't change when it's turned: corners, edges, and what one corner sees. */
export function signature({ verts: V, edges: E }) {
  const r = x => Math.round(x * 1e5), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]);
  const nb = E.filter(([i, j]) => i === 0 || j === 0).map(([i, j]) => (i === 0 ? j : i));
  const all = V.map(v => r(d(V[0], v))).sort((a, b) => a - b), near = [];
  for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) near.push(r(d(V[nb[i]], V[nb[j]])));
  near.sort((a, b) => a - b);
  return `${V.length}|${E.length}|${r(d(V[E[0][0]], V[E[0][1]]))}|${near.join(',')}|${all.join(',')}`;
}
const connected = ({ verts: V, edges: E }) => { const adj = V.map(() => []); for (const [i, j] of E) { adj[i].push(j); adj[j].push(i); }
  const seen = new Uint8Array(V.length), st = [0]; seen[0] = 1; let n = 1; while (st.length) { for (const j of adj[st.pop()]) if (!seen[j]) { seen[j] = 1; n++; st.push(j); } } return n === V.length; };
const RINGS = [...Array(15)].map((_, i) => [0, 1, 2, 3].map(k => ((i + 1) >> (3 - k)) & 1));
/**
 * Run the search. Returns { diagrams, shapes, convex } where shapes are the different star pictures (the first diagram and
 * rings that make each), and convex the signatures that belong to the 47 convex shapes (left out: they're listed there).
 */
export function search(log = () => {}) {
  // every labelling of the six pairs, once up to renaming the mirrors; numbers from one family of shapes only
  const out = [], seenLab = new Set();
  const total = LABELS.length ** 6;
  for (let c = 0; c < total; c++) {
    const lab = []; let x = c; for (let k = 0; k < 6; k++) { lab.push(x % LABELS.length); x = Math.floor(x / LABELS.length); }
    const canon = Math.min(...PERMS.map(pm => { const m = new Map(PAIRS.map(([i, j], k) => [`${Math.min(pm[i], pm[j])},${Math.max(pm[i], pm[j])}`, lab[k]]));
      return PAIRS.map(([i, j]) => m.get(`${i},${j}`)).reduce((s, v) => s * LABELS.length + v, 0); }));
    if (seenLab.has(canon)) continue; seenLab.add(canon);
    const L = lab.map(i => LABELS[i]), nums = new Set(L.map(l => l[0]).filter(n => n !== 2));
    if (nums.has(4) && nums.has(5)) continue;
    const A = mirrors(L); if (!A) continue;
    const G = group(A); if (!G) continue;
    // a tetrahedron whose mirrors split into two groups that don't meet is a prism's or duoprism's: left out
    const adj = [0, 1, 2, 3].map(i => PAIRS.filter(([a, b], k) => (a === i || b === i) && L[k][0] !== 2).map(([a, b]) => (a === i ? b : a)));
    const seen = new Set([0]), stk = [0]; while (stk.length) for (const j of adj[stk.pop()]) if (!seen.has(j)) { seen.add(j); stk.push(j); }
    if (seen.size < 4) continue;
    out.push({ lab: L, order: G.length, A, G });
  }
  log(`${out.length} mirror arrangements with a finite group`);
  const shapes = new Map(), convex = new Set();
  for (const D of out) {
    const plain = D.lab.every(l => l[1] === 1);
    for (const R of RINGS) {
      const s = build(D.A, D.G, R); if (s.verts.length < 5 || !connected(s)) continue;
      const sig = signature(s);
      if (plain) { convex.add(sig); continue; }
      if (!shapes.has(sig)) shapes.set(sig, { lab: D.lab.map(labelText), rings: R.join(''), order: D.order, V: s.verts.length, E: s.edges.length });
    }
  }
  for (const k of convex) shapes.delete(k);
  log(`${shapes.size} different star pictures`);
  return { diagrams: out.map(D => ({ lab: D.lab.map(labelText), order: D.order })), shapes: [...shapes.values()] };
}
