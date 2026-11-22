// ---------- the shapes: surfaces from a formula of two numbers (u, v) ----------
// Each surface gives a point for every (u, v) in its ranges; wrapU / wrapV say which edges join up, and closed: true marks
// surfaces whose parameter edges are glued to each other. stats(P) gives the three Numbers; P holds the slider values.
// (Knots and links are in explorers/knot; the triply periodic surfaces in explorers/labyrinth.)
const { sin, cos, sinh, cosh, PI, sqrt, log, abs, hypot, atan2 } = Math;
// complex numbers and the Weierstrass functions of the square lattice (periods 1 and i), for the Costa surface. ζ comes from
// the Jacobi theta function θ₁ with nome e^(−π); ℘ = −ζ'. Checked: ζ(z+1) − ζ(z) = π, ζ(z+i) − ζ(z) = −πi, ℘(½) = 6.875186.
const cx = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
  div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }, s: (k, z) => [k * z[0], k * z[1]],
  sin: z => [sin(z[0]) * cosh(z[1]), cos(z[0]) * sinh(z[1])], cos: z => [cos(z[0]) * cosh(z[1]), -sin(z[0]) * sinh(z[1])] };
const NOME = Math.exp(-PI);
function wzeta(z) { const v = cx.s(PI, z); let th = [0, 0], dth = [0, 0];
  for (let n = 0; n < 8; n++) { const c = 2 * (n % 2 ? -1 : 1) * NOME ** ((n + 0.5) ** 2), k = 2 * n + 1; th = cx.add(th, cx.s(c, cx.sin(cx.s(k, v)))); dth = cx.add(dth, cx.s(c * k, cx.cos(cx.s(k, v)))); }
  return cx.add(cx.s(PI, z), cx.s(PI, cx.div(dth, th))); }
const wp = z => cx.s(-1 / 2e-5, cx.sub(wzeta(cx.add(z, [1e-5, 0])), wzeta(cx.sub(z, [1e-5, 0]))));
const E1 = 6.875185818020373;
// the Costa surface over the torus [0,1]², cut away near its three ends (w = 0, ½, i/2); its mean curvature was checked to be 0
function costa(u, v) {
  const near = (a, b) => { const du = Math.abs(((u - a) % 1 + 1.5) % 1 - 0.5), dv = Math.abs(((v - b) % 1 + 1.5) % 1 - 0.5); return Math.hypot(du, dv) < 0.004; };   /* right at an end: infinitely far away */
  if (near(0, 0) || near(0.5, 0) || near(0, 0.5)) return null;
  const w = [u, v], a = wzeta(w), b = wzeta(cx.sub(w, [0.5, 0])), c = wzeta(cx.sub(w, [0, 0.5])), k = PI / (2 * E1), I = [0, 1];
  const x = 0.5 * (-a[0] + PI * u + k * (b[0] - c[0])), y = 0.5 * (-cx.mul(I, a)[0] + PI * v - k * (cx.mul(I, b)[0] - cx.mul(I, c)[0]));
  const p = wp(w), z = Math.sqrt(2 * PI) / 4 * log(hypot(...cx.sub(p, [E1, 0])) / hypot(...cx.add(p, [E1, 0])));
  return [x * 0.42, z * 0.42, y * 0.42];
}

export const SHAPES = {
  // ----- surfaces -----
  sphere: { group: 'surface', name: 'Sphere', alt: 'the simplest closed surface', u: [0, 2 * PI], v: [0, PI], wrapU: true,
    f: (u, v) => [sin(v) * cos(u), cos(v), sin(v) * sin(u)],
    stats: () => [['2', 'Euler number'], ['2', 'sides'], ['0', 'edges']],
    info: 'Every closed surface can be described by its Euler number, corners − edges + faces for any way of dividing it into polygons. For a sphere it is always 2, whether you draw a cube on it, a football or a single triangle. It has two sides, inside and out, and no edge.' },
  torus: { group: 'surface', name: 'Torus', alt: 'a doughnut: one hole, two sides', u: [0, 2 * PI], v: [0, 2 * PI], wrapU: true, wrapV: true,
    params: [{ id: 'tr', label: 'Tube', min: 0.15, max: 0.9, step: 0.01, def: 0.42 }],
    f: (u, v, P) => { const r = P.tr; return [(1 + r * cos(v)) * cos(u), r * sin(v), (1 + r * cos(v)) * sin(u)]; },
    stats: () => [['0', 'Euler number'], ['2', 'sides'], ['1', 'hole']],
    info: 'A doughnut. Its Euler number is 0, two less than the sphere\'s: every hole (handle) takes away 2. A coffee mug is the same surface to a topologist, because one can be squashed into the other without tearing.' },
  band: { group: 'surface', name: 'Twisted band', alt: 'a strip with half twists: one twist makes the Möbius strip', u: [0, 2 * PI], v: [-1, 1], wrapU: true, band: true,
    params: [{ id: 'tw', label: 'Half twists', min: 0, max: 6, step: 1, def: 1 }, { id: 'bw', label: 'Width', min: 0.2, max: 0.9, step: 0.01, def: 0.5 }],
    f: (u, v, P) => { const k = P.tw, w = P.bw * v, c = cos(k * u / 2), s = sin(k * u / 2); return [(1 + w * c) * cos(u), w * s, (1 + w * c) * sin(u)]; },
    stats: P => P.tw % 2 ? [['1', 'side'], ['1', 'edge'], [String(P.tw), 'half twists']] : [['2', 'sides'], ['2', 'edges'], [String(P.tw), 'half twists']],
    info: 'A strip of paper with its ends joined. With no twist it\'s a plain loop with two sides and two edges. Give it one half twist and you get the Möbius strip: only one side and one edge. An ant could walk over the whole thing without crossing an edge. Every odd number of half twists gives one side; every even number, two. Press G to cut it down the middle and see what happens.' },
  klein: { group: 'surface', name: 'Klein bottle', alt: 'a bottle whose inside is its outside', u: [0, PI], v: [0, 2 * PI], wrapV: true, closed: true,
    f: (u, v) => { const cu = cos(u), su = sin(u), cv = cos(v), sv = sin(v);
      const x = -2 / 15 * cu * (3 * cv - 30 * su + 90 * cu ** 4 * su - 60 * cu ** 6 * su + 5 * cu * cv * su);
      const y = -1 / 15 * su * (3 * cv - 3 * cu ** 2 * cv - 48 * cu ** 4 * cv + 48 * cu ** 6 * cv - 60 * su + 5 * cu * cv * su - 5 * cu ** 3 * cv * su - 80 * cu ** 5 * cv * su + 80 * cu ** 7 * cv * su);
      const z = 2 / 15 * (3 + 5 * cu * su) * sv; return [x * 0.55, -y * 0.55 + 1.0, z * 0.55]; },
    stats: () => [['0', 'Euler number'], ['1', 'side'], ['0', 'edges']],
    info: 'A closed surface with only one side: the neck bends round and enters the bottle through its own wall, so the outside flows smoothly into the inside. In our 3D world it has to pass through itself, but in 4D it doesn\'t: the neck can slip past the wall by stepping into the fourth direction. Cut it in half the right way and you get two Möbius strips.' },
  klein8: { group: 'surface', name: 'Klein bottle (figure 8)', alt: 'the same surface, a figure-eight swept round a circle with a twist', u: [0, 2 * PI], v: [0, 2 * PI], wrapU: true, wrapV: true,
    f: (u, v) => { const r = 2, a = cos(u / 2) * sin(v) - sin(u / 2) * sin(2 * v); return [(r + a) * cos(u) * 0.45, (sin(u / 2) * sin(v) + cos(u / 2) * sin(2 * v)) * 0.45, (r + a) * sin(u) * 0.45]; },
    stats: () => [['0', 'Euler number'], ['1', 'side'], ['0', 'edges']],
    info: 'The Klein bottle again, drawn differently: a figure-eight swept once round a circle while turning half a turn. The half turn joins it up back to front, which is what makes it one-sided, just as the half twist does in a Möbius strip.' },
  boy: { group: 'surface', name: 'Boy\'s surface', alt: 'the projective plane, drawn in 3D', u: [-PI / 2, PI / 2], v: [0, PI], closed: true,
    f: (u, v) => { const d = 2 - sqrt(2) * sin(3 * u) * sin(2 * v), c2 = cos(v) ** 2; return [(sqrt(2) * c2 * cos(2 * u) + cos(u) * sin(2 * v)) / d, 3 * c2 / d - 1.0, (sqrt(2) * c2 * sin(2 * u) - sin(u) * sin(2 * v)) / d]; },
    stats: () => [['1', 'Euler number'], ['1', 'side'], ['0', 'edges']],
    info: 'The projective plane: take a disc and glue every point of its edge to the point opposite. It can\'t be built in 3D without passing through itself; Werner Boy found this way in 1901, with three lobes and a single triple point where three sheets cross. Like the Klein bottle it has only one side.' },
  roman: { group: 'surface', name: 'Roman surface', alt: 'Steiner\'s drawing of the projective plane', u: [0, PI], v: [-PI / 2, PI / 2], closed: true,
    f: (u, v) => [sin(2 * u) * cos(v) ** 2 * 1.3, sin(u) * sin(2 * v) * 1.3, cos(u) * sin(2 * v) * 1.3],
    stats: () => [['1', 'Euler number'], ['1', 'side'], ['0', 'edges']],
    info: 'Jakob Steiner found it in Rome in 1844: another projective plane, with four bulges and three lines where it passes through itself. Boy\'s surface is smoother (no pinch points), but both are the same surface underneath.' },
  crosscap: { group: 'surface', name: 'Cross-cap', alt: 'a disc whose edge is sewn to itself', u: [0, 2 * PI], v: [0, PI / 2], wrapU: true, closed: true,
    f: (u, v) => [cos(u) * sin(2 * v) * 1.2, -(cos(v) ** 2 - cos(u) ** 2 * sin(v) ** 2) * 1.2 + 0.4, sin(u) * sin(2 * v) * 1.2],
    stats: () => [['1', 'Euler number'], ['1', 'side'], ['0', 'edges']],
    info: 'A cross-cap is a Möbius strip with its edge closed up: a bag whose mouth is sewn shut across itself. Gluing one onto a sphere gives the projective plane; gluing two gives the Klein bottle.' },
  // ----- curved surfaces -----
  monkey: { group: 'curved', name: 'Monkey saddle', alt: 'z = x³ − 3xy²: a saddle with room for a tail', u: [0, 1], v: [0, 2 * PI], wrapV: true, polar: true,
    f: (r, t) => { const x = r * cos(t), y = r * sin(t); return [x, (x ** 3 - 3 * x * y * y) * 0.9, y]; },
    stats: () => [['3', 'ways down'], ['0', 'curvature at the middle'], ['1', 'piece']],
    info: 'An ordinary saddle goes down on two sides, for a rider\'s legs. This one goes down on three: two for the legs and one for a monkey\'s tail. At the very middle it is completely flat, curving neither up nor down in any direction.' },
  hyperboloid: { group: 'curved', name: 'Hyperboloid', alt: 'a curved tower made entirely of straight lines', u: [0, 2 * PI], v: [-1.2, 1.2], wrapU: true,
    params: [{ id: 'hw', label: 'Waist', min: 0.15, max: 1, step: 0.01, def: 0.5 }],
    f: (u, v, P) => [P.hw * cosh(v) * cos(u) * 0.8, sinh(v) * 0.8, P.hw * cosh(v) * sin(u) * 0.8],
    stats: () => [['2', 'families of straight lines'], ['< 0', 'curvature'], ['1', 'hole']],
    info: 'Curved everywhere, yet through every point run two perfectly straight lines lying on the surface. That\'s why cooling towers and some radio masts have this shape: they can be built from straight beams. Choose Wire to see a grid of its curves.' },
  pseudosphere: { group: 'curved', name: 'Pseudosphere', alt: 'the opposite of a sphere: curvature −1 everywhere', u: [0, 2 * PI], v: [-3.2, 3.2], wrapU: true,
    f: (u, v) => [cos(u) / cosh(v), (v - Math.tanh(v)) * 0.55, sin(u) / cosh(v)],
    stats: () => [['−1', 'curvature everywhere'], ['2', 'horns'], ['1', 'rim (a cusp)']],
    info: 'A sphere curves the same way in every direction (curvature +1 everywhere). The pseudosphere curves opposite ways at once, like a saddle, and by exactly the same amount everywhere (−1). Eugenio Beltrami used it in 1868 to show that the strange geometry of the hyperbolic plane really exists: triangles drawn on it have angles adding up to less than 180°.' },
  dini: { group: 'curved', name: 'Dini\'s surface', alt: 'a pseudosphere twisted into a spiral', u: [0, 4 * PI], v: [0.06, 2.2],
    params: [{ id: 'db', label: 'Twist', min: 0, max: 0.5, step: 0.01, def: 0.2 }],
    f: (u, v, P) => [cos(u) * sin(v) * 0.8, (cos(v) + log(Math.tan(v / 2)) + P.db * u) * 0.32, sin(u) * sin(v) * 0.8],
    stats: P => [[(-1 / (1 + P.db * P.db)).toFixed(3), 'curvature everywhere'], ['2', 'turns'], ['1', 'piece']],
    info: 'Ulisse Dini, 1865: take the pseudosphere and twist it as it rises, like a shell or a drill bit. Remarkably the curvature stays exactly the same at every point; twisting more only makes it a little less negative.' },
  kuen: { group: 'curved', name: 'Kuen surface', alt: 'curvature −1, with a star of spikes', u: [-4.4, 4.4], v: [0.03, PI - 0.03],
    f: (u, v) => { const d = 1 + u * u * sin(v) ** 2; return [2 * (cos(u) + u * sin(u)) * sin(v) / d * 0.5, (log(Math.tan(v / 2)) + 2 * cos(v) / d) * 0.5, 2 * (sin(u) - u * cos(u)) * sin(v) / d * 0.5]; },
    stats: () => [['−1', 'curvature everywhere'], ['1', 'piece'], ['2', 'spikes']],
    info: 'Found by Theodor Kuen in 1884, another surface with curvature exactly −1 at every point. It comes from a soliton, a wave that keeps its shape, written into geometry. Plaster models of it sit in maths departments around the world.' },
  breather: { group: 'curved', name: 'Breather', alt: 'a soliton wave frozen into a surface', u: [-7.5, 7.5], v: [-37.4, 37.4], view: [0.35, 1.25, 0],
    f: (u, v) => { const b = 0.4, r = 1 - b * b, w = sqrt(r), den = b * ((w * cosh(b * u)) ** 2 + (b * sin(w * v)) ** 2);
      return [(-u + 2 * r * cosh(b * u) * sinh(b * u) / den) * 0.17, 2 * w * cosh(b * u) * (-(w * sin(v) * cos(w * v)) + cos(v) * sin(w * v)) / den * 0.17, 2 * w * cosh(b * u) * (-(w * cos(v) * cos(w * v)) - sin(v) * sin(w * v)) / den * 0.17]; },
    stats: () => [['−1', 'curvature everywhere'], ['1', 'piece'], ['14', 'ridges']],
    info: 'A "breather" is a wave that pulses in place without spreading out, a solution of the sine-Gordon equation. Turned into geometry it gives this ribbed surface, again with curvature exactly −1 everywhere.' },
  seashell: { group: 'curved', name: 'Seashell', alt: 'a tube growing as it spirals', u: [0, 6 * PI], v: [0, 2 * PI], wrapV: true,
    f: (u, v) => { const e = Math.exp(u / (6 * PI)), c = cos(v / 2) ** 2; return [2 * (1 - e) * cos(u) * c * 0.42, (1 - Math.exp(u / (3 * PI)) - sin(v) + e * sin(v)) * 0.42 + 0.8, 2 * (-1 + e) * sin(u) * c * 0.42]; },
    stats: () => [['3', 'turns'], ['1', 'opening'], ['×' + Math.exp(1 / 3).toFixed(2), 'growth per turn']],
    info: 'A shell grows by adding to its opening, always in the same proportion, so every turn is a scaled-up copy of the one before: a logarithmic spiral. Snails, nautiluses and rams\' horns all grow this way.' },
  // ----- minimal surfaces -----
  helicoid: { group: 'minimal', name: 'Catenoid ↔ helicoid', alt: 'one soap film that bends into another', u: [-PI, PI], v: [-1.3, 1.3], wrapU: false,
    params: [{ id: 'mo', label: 'Morph', min: 0, max: 1, step: 0.01, def: 0 }],
    f: (u, v, P) => { const t = P.mo * PI / 2, a = cos(t), b = sin(t); return [(a * sinh(v) * sin(u) + b * cosh(v) * cos(u)) * 0.62, (u * a + v * b) * 0.5, (-a * sinh(v) * cos(u) + b * cosh(v) * sin(u)) * 0.62]; },
    stats: P => [[(P.mo * 90).toFixed(0) + '°', 'bend'], ['0', 'mean curvature'], [P.mo > 0.99 ? 'catenoid' : P.mo < 0.01 ? 'helicoid' : 'in between', 'shape']],
    info: 'A soap film stretched between two rings makes a catenoid; a spiral staircase of film makes a helicoid. They are the same surface bent differently: every point keeps its distances to its neighbours as one turns into the other, and every shape in between is a perfect soap film too (its mean curvature is zero everywhere). Press G to bend it back and forth.' },
  enneper: { group: 'minimal', name: 'Enneper\'s surface', alt: 'a saddle that folds back through itself', u: [0, 1.25], v: [0, 2 * PI], wrapV: true, polar: true,
    f: (r, t) => { const u = r * cos(t), v = r * sin(t); return [(u - u ** 3 / 3 + u * v * v) * 0.7, (u * u - v * v) * 0.7, (v - v ** 3 / 3 + v * u * u) * 0.7]; },
    stats: () => [['0', 'mean curvature'], ['1', 'piece'], ['—', 'edges']],
    info: 'Alfred Enneper, 1864: a minimal surface like a saddle that keeps going, curling up and folding back through itself if you let it grow. Near the middle it looks like a monkey saddle\'s gentler cousin.' },
  scherk: { group: 'minimal', name: 'Scherk\'s saddle tower', alt: 'z = ln(cos y ÷ cos x): a minimal surface over a square', u: [-1.52, 1.52], v: [-1.52, 1.52],
    f: (u, v) => [u * 0.7, log(cos(v) / cos(u)) * 0.32, v * 0.7],
    stats: () => [['0', 'mean curvature'], ['1', 'cell'], ['∞', 'repeats']],
    info: 'Heinrich Scherk, 1834. Over a square it rises to infinity along two opposite sides and falls to minus infinity along the other two; copies fit together in a chessboard pattern to make an endless soap film. This is one cell, cut off before it runs away.' },
  costa: { group: 'minimal', name: 'Costa\'s surface', alt: 'a soap film with three holes, found in 1982', u: [0, 1], v: [0, 1], wrapU: true, wrapV: true,
    f: (u, v) => costa(u, v), keep: p => Math.hypot(p[0], p[2]) < 1.05 && Math.abs(p[1]) < 0.62,   // its ends cut off by a cylinder
    stats: () => [['1', 'genus (holes)'], ['3', 'ends'], ['0', 'mean curvature']],
    info: 'Celso Costa found it in 1982, and it surprised everyone: the first new complete soap film without self-crossings since the 1700s. Two ends open out like a catenoid, one spreads flat like a plane, and the three are joined through holes. It\'s drawn here with its ends cut short; really they go on forever.' },
  henneberg: { group: 'minimal', name: 'Henneberg\'s surface', alt: 'a one-sided soap film', u: [0.12, 0.95], v: [0, 2 * PI], wrapV: true,
    f: (u, v) => [(2 * sinh(u) * cos(v) - 2 / 3 * sinh(3 * u) * cos(3 * v)) * 0.32, 2 * cosh(2 * u) * cos(2 * v) * 0.32, (2 * sinh(u) * sin(v) + 2 / 3 * sinh(3 * u) * sin(3 * v)) * 0.32],
    stats: () => [['1', 'side'], ['0', 'mean curvature'], ['1', 'piece']],
    info: 'Lebrecht Henneberg, 1875: a minimal surface with only one side, like a Möbius strip. It passes through itself, which a real soap film can\'t, but locally every bit of it is a perfect film.' },
  bour: { group: 'minimal', name: 'Bour\'s surface', alt: 'a minimal surface that spirals twice round', u: [0.02, 1.05], v: [0, 4 * PI], wrapV: true, polar: true,
    f: (r, t) => [(r * cos(t) - r * r / 2 * cos(2 * t)) * 0.8, 4 / 3 * r ** 1.5 * cos(1.5 * t) * 0.8, (-r * sin(t) - r * r / 2 * sin(2 * t)) * 0.8],
    stats: () => [['0', 'mean curvature'], ['2', 'turns'], ['1', 'piece']],
    info: 'Edmond Bour, 1862. It can be bent, without stretching, into a surface of revolution; the bending passes through a whole family of minimal surfaces, like the catenoid and helicoid.' },
  richmond: { group: 'minimal', name: 'Richmond\'s surface', alt: 'a soap film folded through itself', u: [0.32, 1.3], v: [0, 2 * PI], wrapV: true, polar: true,
    f: (r, t) => [(-cos(t) / (2 * r) - r ** 3 * cos(3 * t) / 6) * 0.9, r * cos(t) * 0.9, (-sin(t) / (2 * r) - r ** 3 * sin(3 * t) / 6) * 0.9],
    stats: () => [['0', 'mean curvature'], ['2', 'ends'], ['1', 'piece']],
    info: 'Herbert Richmond, 1904. Near the middle it looks like a flat plane folded through itself; further out it curls up like Enneper\'s surface.' },
  catalan: { group: 'minimal', name: 'Catalan\'s surface', alt: 'a soap film containing a cycloid', u: [-2 * PI, 2 * PI], v: [-1.5, 1.5],
    f: (u, v) => [(u - sin(u) * cosh(v)) * 0.14, (1 - cos(u) * cosh(v)) * 0.14, -4 * sin(u / 2) * sinh(v / 2) * 0.14],
    stats: () => [['0', 'mean curvature'], ['2', 'arches'], ['1', 'cycloid on it']],
    info: 'Eugène Catalan, 1855. Running along its middle is a cycloid, the curve traced by a point on a rolling wheel, and the soap film hangs off it in arches.' },
};

export const GROUPS = [['surface', 'Surfaces'], ['curved', 'Curved surfaces'], ['minimal', 'Minimal surfaces']];

// ---------- meshes ----------
/** Default slider values of a shape. */
export const defaults = sh => Object.fromEntries((sh.params || []).map(p => [p.id, p.def]));

/**
 * A grid mesh of a parametric surface: positions, (u, v) for colouring, and triangles. n: points per side.
 * gap (0..1, bands only): cut a slit down the middle line, as wide as this fraction of the band.
 * A shape may leave points out (f returns null) or give keep(p) to trim itself in 3D. A left-out point next to a kept one
 * is slid along the grid line to exactly where the trim begins (by bisection), so the cut edge comes out smooth.
 */
export function gridMesh(sh, P, n, gap = 0) {
  const nu = n, nv = sh.band ? Math.max(12, n >> 2) : n, pos = [], uv = [], idx = [];
  const [u0, u1] = sh.u, [v0, v1] = sh.v;
  const sheets = gap > 0 ? [[v0, -gap], [gap, v1]] : [[v0, v1]];
  const bad = [];   // points the shape leaves out: quads touching them are not drawn
  const fOk = (u, v) => { const p = sh.f(u, v, P); return p && p.every(Number.isFinite) && (!sh.keep || sh.keep(p)) ? p : null; };
  for (const [a, b] of sheets) {
    const base = pos.length / 3, UV = (i, j) => [u0 + (u1 - u0) * i / nu, a + (b - a) * j / nv];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const [u, v] = UV(i, j), p = fOk(u, v);
      pos.push(p ? p[0] : 0, p ? p[1] : 0, p ? p[2] : 0); bad.push(p ? 0 : 1); uv.push(i / nu, (v - v0) / (v1 - v0));
    }
    if (bad.slice(base).includes(1)) {   // slide left-out points that border kept ones onto the edge of the trim
      const W = nu + 1, snapped = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const q = base + j * W + i; if (!bad[q]) continue;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni > nu || nj > nv || bad[base + nj * W + ni]) continue;
          let [ga, gb] = UV(ni, nj), [ba, bb] = UV(i, j), pIn = fOk(ga, gb);
          for (let it = 0; it < 18; it++) { const ma = (ga + ba) / 2, mb = (gb + bb) / 2, pm = fOk(ma, mb); if (pm) { ga = ma; gb = mb; pIn = pm; } else { ba = ma; bb = mb; } }
          snapped.push([q, pIn]); break; } }
      for (const [q, p] of snapped) { pos[q * 3] = p[0]; pos[q * 3 + 1] = p[1]; pos[q * 3 + 2] = p[2]; bad[q] = 0; }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a0 = base + j * (nu + 1) + i, b0 = a0 + 1, c0 = a0 + nu + 1, d0 = c0 + 1;
      if (bad[a0] || bad[b0] || bad[c0] || bad[d0]) continue;
      idx.push(a0, c0, b0, b0, c0, d0);
    }
  }
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), idx, nu, nv, sheets: sheets.length, bad: bad.includes(1) ? Uint8Array.from(bad) : null };
}
