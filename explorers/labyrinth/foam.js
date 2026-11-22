// ---------- foams: Kelvin's and Weaire–Phelan's ways of dividing space into equal bubbles ----------
// Each foam here is the Voronoi pattern of a repeating set of points: every bubble is the region closer to its point than to
// any other. Kelvin's foam comes from the body-centred cubic lattice (every bubble a truncated octahedron); Weaire–Phelan's
// from the A15 (β-tungsten) arrangement: two 12-faced bubbles and six 14-faced ones in each repeating cube. Drawn with flat
// faces; in a real foam the films curve very slightly. Checked: face counts, four edges at every corner (Plateau's law),
// and the bubbles' volumes adding up to the whole cube.
export const FOAMS = {
  kelvin: { name: 'Kelvin\'s foam', alt: 'truncated octahedra: Kelvin\'s best guess, 1887', pts: [[0, 0, 0], [0.5, 0.5, 0.5]],
    info: 'In 1887 Lord Kelvin asked: how do you divide space into bubbles of equal size using the least wall? His answer: truncated octahedra, each with six squares and eight hexagons, the faces bent very slightly. For over a century nobody did better.' },
  wp: { name: 'Weaire–Phelan', alt: 'beat Kelvin in 1993: the Beijing Water Cube', pts: [[0, 0, 0], [0.5, 0.5, 0.5], [0.25, 0, 0.5], [0.75, 0, 0.5], [0, 0.5, 0.25], [0, 0.5, 0.75], [0.5, 0.25, 0], [0.5, 0.75, 0]],
    info: 'In 1993 Denis Weaire and Robert Phelan found a foam with 0.3% less wall than Kelvin\'s, using two kinds of bubble: 12-faced ones made of pentagons, and 14-faced ones with two hexagons. The swimming centre for the 2008 Beijing Olympics, the Water Cube, was built from it.' },
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/**
 * The bubbles of a foam within one repeating cube (side 1), each as {centre, faces}. Each bubble is the set of points on its
 * own side of the bisecting plane to every nearby point. Its corners are found as meeting points of three planes that lie
 * inside all the others, and each face is the corners on one plane, in order round their middle. (Cutting a box one plane at
 * a time went wrong on the A15 points, where many planes pass exactly through the same corners.)
 */
const cache = {};
export function foamCells(key) {
  if (cache[key]) return cache[key];
  const P = FOAMS[key].pts, cells = [], E = 1e-9;
  for (const c of P) {
    const planes = [];
    for (const q of P) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const o = add(q, [i, j, k]), n = sub(o, c), r = Math.hypot(...n); if (r < 1e-9 || r > 1.2) continue; planes.push([n, dot(n, mul(add(o, c), 0.5))]); }
    const V = [], inside = x => planes.every(([n, d]) => dot(n, x) <= d + E);
    for (let a = 0; a < planes.length; a++) for (let b = a + 1; b < planes.length; b++) for (let e = b + 1; e < planes.length; e++) {
      const [n1, d1] = planes[a], [n2, d2] = planes[b], [n3, d3] = planes[e], c23 = cross(n2, n3), det = dot(n1, c23); if (Math.abs(det) < 1e-12) continue;
      const x = mul(add(add(mul(c23, d1), mul(cross(n3, n1), d2)), mul(cross(n1, n2), d3)), 1 / det);
      if (inside(x) && !V.some(v => Math.hypot(...sub(v, x)) < 1e-7)) V.push(x); }
    const faces = [];
    for (const [n, d] of planes) {
      const on = V.filter(v => Math.abs(dot(n, v) - d) < 1e-7); if (on.length < 3) continue;
      const m = mul(on.reduce(add, [0, 0, 0]), 1 / on.length), nn = mul(n, 1 / Math.hypot(...n)), t = Math.abs(nn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], u = (() => { const v = cross(nn, t); return mul(v, 1 / Math.hypot(...v)); })(), w = cross(nn, u);
      on.sort((p, q) => Math.atan2(dot(sub(p, m), w), dot(sub(p, m), u)) - Math.atan2(dot(sub(q, m), w), dot(sub(q, m), u)));
      if (!faces.some(f => f.length === on.length && f.every(p => on.some(q => Math.hypot(...sub(p, q)) < 1e-7)))) faces.push(on);
    }
    cells.push({ centre: c, faces });
  }
  return (cache[key] = cells);
}
export const faceArea = f => { let s = [0, 0, 0]; for (let i = 1; i + 1 < f.length; i++) s = add(s, cross(sub(f[i], f[0]), sub(f[i + 1], f[0]))); return Math.hypot(...s) / 2; };
export function cellVolume(cell) { let v = 0; const c = cell.centre; for (const f of cell.faces) for (let i = 1; i + 1 < f.length; i++) v += Math.abs(dot(sub(f[0], c), cross(sub(f[i], c), sub(f[i + 1], c)))) / 6; return v; }
