// ---------- mazes on a 3D grid ----------
// A maze is a grid of rooms (X × Y on each of Z floors) and a set of openings between neighbours. A "perfect" maze has exactly
// one route between any two rooms: as a network it is a spanning tree (connected, no loops, one fewer opening than rooms).
// Three ways of building one, each with its own feel:
//   depth-first: wander until stuck, back up, branch: long winding corridors and few, deep dead ends
//   Prim's: grow outward from the start, picking frontier rooms at random: lots of short dead ends
//   Wilson's: random walks with their loops erased: every possible perfect maze equally likely
// "Loops" then opens extra walls at dead ends, so there is more than one route (and the hand-on-the-wall rule can fail).
export const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];   // east, west, north, south, up, down
export const OPP = [1, 0, 3, 2, 5, 4];
export function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s ^= s << 13, s >>>= 0, s ^= s >>> 17, s ^= s << 5, s >>>= 0) / 4294967296); }

export function makeMaze(X, Y, Z, method, loops, seed) {
  const N = X * Y * Z, open = new Uint8Array(N), id = (x, y, z) => x + y * X + z * X * Y, xyz = i => [i % X, Math.floor(i / X) % Y, Math.floor(i / (X * Y))], r = rng(seed), steps = [];
  const nbrs = i => { const [x, y, z] = xyz(i), out = []; DIRS.forEach(([dx, dy, dz], d) => { const a = x + dx, b = y + dy, c = z + dz; if (a >= 0 && b >= 0 && c >= 0 && a < X && b < Y && c < Z) out.push([id(a, b, c), d]); }); return out; };
  // going up or down is made rarer than going sideways, so each floor feels like a floor rather than a sponge
  const weight = d => (d >= 4 ? 0.22 : 1), pick = list => { const tot = list.reduce((s, [, d]) => s + weight(d), 0); let t = r() * tot; for (const e of list) { t -= weight(e[1]); if (t <= 0) return e; } return list[list.length - 1]; };
  const carve = (i, j, d) => { open[i] |= 1 << d; open[j] |= 1 << OPP[d]; steps.push([i, d]); };
  const seen = new Uint8Array(N);
  if (method === 'prim') {
    const front = []; const addF = i => { for (const [j, d] of nbrs(i)) if (!seen[j]) front.push([i, j, d]); };
    seen[0] = 1; addF(0);
    while (front.length) { const tot = front.reduce((s, e) => s + weight(e[2]), 0); let t = r() * tot, k = 0; for (; k < front.length - 1; k++) { t -= weight(front[k][2]); if (t <= 0) break; }
      const [i, j, d] = front.splice(k, 1)[0]; if (seen[j]) continue; seen[j] = 1; carve(i, j, d); addF(j); }
  } else if (method === 'wilson') {
    seen[Math.floor(r() * N)] = 1; let left = N - 1; const next = new Int32Array(N).fill(-1), nd = new Int8Array(N);
    while (left > 0) { let start = 0; do { start = Math.floor(r() * N); } while (seen[start]);
      let i = start; while (!seen[i]) { const [j, d] = pick(nbrs(i)); next[i] = j; nd[i] = d; i = j; }   // a random walk; revisiting a room overwrites its exit, which erases the loop
      i = start; while (!seen[i]) { seen[i] = 1; left--; carve(i, next[i], nd[i]); i = next[i]; } }
  } else {   // depth-first
    const stack = [0]; seen[0] = 1;
    while (stack.length) { const i = stack[stack.length - 1], cand = nbrs(i).filter(([j]) => !seen[j]); if (!cand.length) { stack.pop(); continue; }
      const [j, d] = pick(cand); seen[j] = 1; carve(i, j, d); stack.push(j); }
  }
  // loops: open a closed wall at some dead ends
  if (loops > 0) for (let i = 0; i < N; i++) { const deg = [0, 1, 2, 3, 4, 5].filter(d => open[i] >> d & 1).length; if (deg !== 1 || r() > loops) continue;
    const closed = nbrs(i).filter(([, d]) => !(open[i] >> d & 1) && d < 4); if (closed.length) { const [j, d] = closed[Math.floor(r() * closed.length)]; carve(i, j, d); } }
  return { X, Y, Z, N, open, steps, id, xyz, start: 0, exit: N - 1, method, loops, seed };
}
export const isOpen = (m, i, d) => (m.open[i] >> d & 1) === 1;
export const degree = (m, i) => { let k = 0; for (let d = 0; d < 6; d++) if (m.open[i] >> d & 1) k++; return k; };
export function neighbour(m, i, d) { const [x, y, z] = m.xyz(i), [dx, dy, dz] = DIRS[d]; return m.id(x + dx, y + dy, z + dz); }
/** Shortest route between two rooms (breadth-first search): the list of rooms, start and end included. */
export function solve(m, from, to) {
  const prev = new Int32Array(m.N).fill(-2), q = [from]; prev[from] = -1;
  for (let h = 0; h < q.length; h++) { const i = q[h]; if (i === to) break; for (let d = 0; d < 6; d++) if (isOpen(m, i, d)) { const j = neighbour(m, i, d); if (prev[j] === -2) { prev[j] = i; q.push(j); } } }
  if (prev[to] === -2) return null; const path = []; for (let i = to; i !== -1; i = prev[i]) path.push(i); return path.reverse();
}
/** The hand-on-the-left-wall rule on one floor: the rooms it visits (stops after a limit, so a loop can't trap it forever). */
export function wallFollow(m, from, to, limit = 4000) {
  let i = from, d = isOpen(m, from, 0) ? 0 : isOpen(m, from, 2) ? 2 : 1; const path = [i];
  const LEFT = { 0: 2, 2: 1, 1: 3, 3: 0 }, RIGHT = { 0: 3, 3: 1, 1: 2, 2: 0 }, BACK = { 0: 1, 1: 0, 2: 3, 3: 2 };
  for (let n = 0; n < limit && i !== to; n++) {
    for (const nd of [LEFT[d], d, RIGHT[d], BACK[d]]) if (isOpen(m, i, nd)) { d = nd; i = neighbour(m, i, d); path.push(i); break; }
  }
  return { path, reached: i === to };
}
