// ---------- Drawing Machines: the maths ----------
// Every drawing here is a pen moved by a machine: spinning circles (epicycles, a Fourier series), a wheel rolling round a ring
// (the spirograph), swinging pendulums (the harmonograph), two vibrations at right angles (Lissajous figures), a radius that
// grows and shrinks as it turns (roses), or, for the times tables, straight threads stretched round a circle. Each drawing
// gives make(P) → a machine: { kind: 'pen', T, pos(t) → [x, y] in about −1…1, parts(t) → what to draw of the machine itself }
// or { kind: 'lines', N, m } for the times tables. The epicycle drawings and their Fourier transform moved here from Waves &
// Cymatics, unchanged.

// ---------- the epicycles' drawings (closed curves, t from 0 to 1) ----------
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
const EPI_CURVES = { infinity: ['Infinity', infinity], rose: ['Five-petal rose', rose], spiro: ['Spirograph', spiro], cardioid: ['Cardioid', cardioid], note: ['Musical note', note], heart: ['Heart', heart], star: ['Star', star], square: ['Square', square], trefoil: ['Trefoil', trefoil], butterfly: ['Butterfly', butterfly], pi: ['π', pi] };
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

// ---------- the machines ----------
const TAU = 2 * Math.PI, gcd = (a, b) => { a = Math.round(Math.abs(a)); b = Math.round(Math.abs(b)); while (b) [a, b] = [b, a % b]; return a || 1; };
/** Epicycles: the drawing's Fourier circles, biggest first; n of them draw it (more circles, closer to the drawing). */
export function epicycles(points, n) {
  const C = dft(points), k = Math.max(1, Math.min(n, C.length));
  const at = t => { let x = 0, y = 0; for (let i = 0; i < k; i++) { const c = C[i], a = TAU * c.f * t + c.ph; x += c.r * Math.cos(a); y += c.r * Math.sin(a); } return [x, y]; };
  return { kind: 'pen', T: 1, laps: 1, pos: at, C, n: k, target: points, samples: 1200,
    parts: t => { const out = []; let x = 0, y = 0; for (let i = 0; i < k; i++) { const c = C[i], a = TAU * c.f * t + c.ph, nx = x + c.r * Math.cos(a), ny = y + c.r * Math.sin(a); out.push({ circle: [x, y, c.r] }, { arm: [x, y, nx, ny] }); x = nx; y = ny; } return out; } };
}
/** Spirograph: a wheel of r teeth rolling inside (or outside) a ring of R teeth, the pen in a hole h × r from its middle. */
function spirograph({ R, r, h, out }) {
  const d = h * r, s = out ? 1 : -1, rad = R + s * r, k = rad / r, ext = Math.abs(rad) + d, laps = r / gcd(R, r);
  const pos = t => [(rad * Math.cos(t) - s * d * Math.cos(k * t)) / ext, (rad * Math.sin(t) - d * Math.sin(k * t)) / ext];
  return { kind: 'pen', T: TAU * laps, laps, pos, samples: Math.min(12000, Math.round(500 * laps + 160 * Math.abs(k) * laps)),
    parts: t => { const cx = rad * Math.cos(t) / ext, cy = rad * Math.sin(t) / ext, [px, py] = pos(t); return [{ circle: [0, 0, R / ext], ring: true }, { circle: [cx, cy, r / ext] }, { arm: [cx, cy, px, py] }]; } };
}
/** Harmonograph: pendulums swinging the pen sideways and the paper back and forth, slowly dying away. */
function harmonograph({ fx, fy, detune, damp, phase }) {
  const T = Math.log(40) / damp, A = 1 / 1.5;
  const pos = t => { const e = Math.exp(-damp * t); return [e * A * (Math.sin(fx * t + phase) + 0.5 * Math.sin(fx * (1 + detune) * t)), e * A * (Math.sin(fy * t) + 0.5 * Math.cos(fy * (1 + detune) * t + phase))]; };
  return { kind: 'pen', T, laps: 1, pos, samples: Math.min(16000, Math.round(T * Math.max(fx, fy) * 4)),
    parts: t => { const [x, y] = pos(t); return [{ bob: [x, -1.15] }, { bob: [-1.15, y] }]; } };   // each pendulum's swing, along an edge
}
/** Lissajous figure: one vibration across, another up and down; whole-number frequencies close the curve. */
function lissajous({ a, b, phase }) {
  const g = gcd(a, b), pos = t => [Math.sin(a * t + phase), Math.sin(b * t)];
  return { kind: 'pen', T: TAU / g, laps: 1, pos, samples: Math.min(6000, 400 * (a + b)),
    parts: t => { const [x, y] = pos(t); return [{ guide: [x, -1.15, x, y] }, { guide: [-1.15, y, x, y] }, { bob: [x, -1.15] }, { bob: [-1.15, y] }]; } };
}
/** Rose: the distance from the middle is cos(n/d × angle); the pen goes round d times (or d/2) before the curve closes. */
function roseCurve({ n, d }) {
  const g = gcd(n, d), nn = n / g, dd = d / g, T = TAU * dd * ((nn * dd) % 2 ? 0.5 : 1), pos = t => { const r = Math.cos(nn / dd * t); return [r * Math.cos(t), r * Math.sin(t)]; };
  return { kind: 'pen', T, laps: dd, pos, samples: Math.min(8000, Math.round(900 * dd * Math.max(1, nn / 3))), parts: t => { const [x, y] = pos(t); return [{ arm: [0, 0, x, y] }]; } };
}
/** Times table on a circle: N points round a circle, and a thread from each point k to point m × k (counting on round). */
function timesTable({ N, m }) { return { kind: 'lines', N: Math.round(N), m }; }

export const GROUPS = [['epi', 'Epicycles: any drawing from spinning circles'], ['spiro', 'Spirograph'], ['harmono', 'Harmonograph'], ['liss', 'Lissajous figures'], ['times', 'Times tables on a circle'], ['rose', 'Roses']];
const EPI_INFO = 'Every closed drawing can be made by circles spinning on circles, each turning a whole number of times per lap: this is a Fourier series. The biggest circles give the rough shape, the small fast ones the detail.';
const SPIRO = [{ id: 'R', label: 'Ring teeth', min: 24, max: 150, step: 1 }, { id: 'r', label: 'Wheel teeth', min: 6, max: 120, step: 1 }, { id: 'h', label: 'Pen hole', min: 0, max: 1.3, step: 0.01 }, { id: 'out', label: 'Outside', min: 0, max: 1, step: 1 }];
const HARM = [{ id: 'fx', label: 'Across', min: 1, max: 8, step: 1 }, { id: 'fy', label: 'Up & down', min: 1, max: 8, step: 1 }, { id: 'detune', label: 'Detune', min: 0, max: 0.03, step: 0.0005 }, { id: 'damp', label: 'Dying away', min: 0.005, max: 0.05, step: 0.001 }, { id: 'phase', label: 'Phase', min: 0, max: 3.1416, step: 0.01 }];
const LISS = [{ id: 'a', label: 'Across', min: 1, max: 9, step: 1 }, { id: 'b', label: 'Up & down', min: 1, max: 9, step: 1 }, { id: 'phase', label: 'Phase', min: 0, max: 3.1416, step: 0.01 }];
const TIMES = [{ id: 'm', label: 'Times', min: 2, max: 100, step: 0.01 }, { id: 'N', label: 'Points', min: 20, max: 400, step: 1 }];
const ROSE = [{ id: 'n', label: 'n', min: 1, max: 9, step: 1 }, { id: 'd', label: 'd', min: 1, max: 9, step: 1 }];
const withDefaults = (list, def) => list.map(p => ({ ...p, def: def[p.id] }));

export const DRAWINGS = {};
const epiCache = new Map();
for (const [k, [name, f]] of Object.entries(EPI_CURVES)) DRAWINGS['e_' + k] = { group: 'epi', name, alt: 'drawn by spinning circles', info: EPI_INFO, epi: k,
  params: [{ id: 'n', label: 'Circles', min: 1, max: 200, step: 1, def: 40 }],
  make: P => { const key = k + ':' + P.n; if (!epiCache.has(key)) epiCache.set(key, epicycles(samplePath(f, 512), P.n)); return epiCache.get(key); } };
const add = (k, group, name, alt, info, list, def, make) => { DRAWINGS[k] = { group, name, alt, info, params: withDefaults(list, def), make }; };
add('s_flower', 'spiro', 'Eight-petal flower', 'a wheel of 36 teeth inside a ring of 96', 'The toy spirograph: a toothed wheel rolls round inside a toothed ring, with the pen in one of its holes. The pattern closes when the wheel has gone round a whole number of times: here 36 ÷ 12 = 3 laps (12 is the biggest number dividing both 96 and 36), with 96 ÷ 12 = 8 petals.', SPIRO, { R: 96, r: 36, h: 0.8, out: 0 }, spirograph);
add('s_lace', 'spiro', 'Lace', '40 teeth inside 105: 8 laps, 21 points', 'Choose teeth counts that share only a small factor and the wheel must go round many times before the pattern closes, weaving lace. 105 and 40 share just 5, so it takes 40 ÷ 5 = 8 laps.', SPIRO, { R: 105, r: 40, h: 0.9, out: 0 }, spirograph);
add('s_out', 'spiro', 'Outside the ring', 'the wheel rolls round the outside', 'Roll the wheel round the outside of the ring instead and the loops point outward: an epitrochoid. Astronomers once drew the planets\' wandering paths this way, as circles on circles (Ptolemy\'s epicycles).', SPIRO, { R: 80, r: 30, h: 0.7, out: 1 }, spirograph);
add('s_astroid', 'spiro', 'Astroid', 'a wheel a quarter of the ring, pen on its rim', 'Put the pen right on the rim of a wheel one quarter the size of the ring and it draws a four-pointed star, the astroid, with sharp points where the pen stops for an instant against the ring.', SPIRO, { R: 96, r: 24, h: 1, out: 0 }, spirograph);
add('s_nephroid', 'spiro', 'Nephroid', 'a wheel half the ring, rolling outside', 'A wheel half the size of the ring, rolling round the outside, pen on its rim: a kidney shape, the nephroid. It is also the bright curve sunlight makes on the bottom of a teacup.', SPIRO, { R: 48, r: 24, h: 1, out: 1 }, spirograph);
add('h_fifth', 'harmono', 'A fifth (3 : 2)', 'pendulums swinging three to two', 'A harmonograph: pendulums move the pen and the paper, swinging at different speeds and slowly dying away. Swinging 3 to 2, the ratio of a musical fifth, they draw this. Victorian parlours had them: the pictures are the shapes of musical chords.', HARM, { fx: 3, fy: 2, detune: 0.004, damp: 0.012, phase: 1.57 }, harmonograph);
add('h_octave', 'harmono', 'An octave (2 : 1)', 'two to one', 'Two to one, the octave: the simplest harmony after unison, and a simple figure, a looped bow that slowly turns as the slight detune drifts it.', HARM, { fx: 2, fy: 1, detune: 0.005, damp: 0.012, phase: 0.7 }, harmonograph);
add('h_fourth', 'harmono', 'A fourth (4 : 3)', 'four to three', 'Four to three, a musical fourth. The more complicated the ratio, the more intricate the figure, just as the ear hears 4 : 3 as less settled than 2 : 1.', HARM, { fx: 4, fy: 3, detune: 0.003, damp: 0.01, phase: 1.2 }, harmonograph);
add('h_spiral', 'harmono', 'Unison spiral', 'one to one, slightly out of tune', 'Both pendulums at almost the same speed, a quarter swing apart: a circle, shrinking into a spiral as they die away, and turning into ellipses and back as the slight difference drifts their timing.', HARM, { fx: 1, fy: 1, detune: 0.012, damp: 0.008, phase: 1.57 }, harmonograph);
add('l_32', 'liss', 'Lissajous 3 : 2', 'three across for two up and down', 'In 1857 Jules Lissajous shone light off mirrors on two tuning forks vibrating at right angles. When their pitches are in a whole-number ratio the spot draws a closed curve: three loops across and two up and down for 3 : 2. Oscilloscopes show sound the same way.', LISS, { a: 3, b: 2, phase: 0.785 }, lissajous);
add('l_54', 'liss', 'Lissajous 5 : 4', 'five against four', 'Five against four: more loops, closer together. Slowly change the phase (under Motion) and the figure seems to turn in three dimensions.', LISS, { a: 5, b: 4, phase: 1.57 }, lissajous);
add('l_eight', 'liss', 'Figure of eight (1 : 2)', 'once across, twice up and down', 'Once across while going twice up and down: a figure of eight, the simplest Lissajous curve after the circle.', LISS, { a: 1, b: 2, phase: 0 }, lissajous);
add('t_2', 'times', 'Times 2: a cardioid', 'thread each point to the one twice as far round', 'Put points round a circle, numbered 0, 1, 2… and stretch a thread from each number to twice that number (counting on round the circle past the end). The threads outline a heart-shaped cardioid, the same curve as the bright line in a coffee cup.', TIMES, { m: 2, N: 200 }, timesTable);
add('t_3', 'times', 'Times 3: a nephroid', 'each point to three times round', 'Times 3: a kidney with two lobes, the nephroid. Times n gives a curve with n − 1 lobes: the curves a wheel draws rolling round the outside of a circle.', TIMES, { m: 3, N: 200 }, timesTable);
add('t_21', 'times', 'Times 21', 'twenty lobes', 'Times 21 gives twenty lobes. Slide the multiplier slowly (Keep sliding) and the threads swirl from one flower to the next; at whole numbers they snap into place.', TIMES, { m: 21, N: 300 }, timesTable);
add('t_99', 'times', 'Times 99 on 200: a weave', 'just under half the number of points', 'With 200 points and times 99, just under half of 200, every thread lands a little short of halfway round from twice its start, and together the threads weave a basket. Change either number by one and the weave falls apart into loops: small changes, big differences.', TIMES, { m: 99, N: 200 }, timesTable);
add('r_3', 'rose', 'Three petals', 'r = cos 3θ', 'A rose curve: the distance from the middle is cos(nθ/d) as the angle θ turns. With n = 3, d = 1, three petals. Odd n gives n petals, even n gives 2n.', ROSE, { n: 3, d: 1 }, roseCurve);
add('r_4', 'rose', 'Eight petals', 'r = cos 4θ', 'With n = 4, eight petals: an even number doubles them. Guido Grandi named these curves rhodonea, "rose-like", in the 1720s.', ROSE, { n: 4, d: 1 }, roseCurve);
add('r_53', 'rose', 'Rose 5 / 3', 'r = cos (5θ / 3)', 'Fractions make lacier roses: with n/d = 5/3 the pen goes round three times before the curve closes, laying petals over petals.', ROSE, { n: 5, d: 3 }, roseCurve);
for (const k in DRAWINGS) DRAWINGS[k].key = k;
export const defaults = d => Object.fromEntries(d.params.map(p => [p.id, p.def]));
