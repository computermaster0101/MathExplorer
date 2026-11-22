// ---------- knots and links: closed curves, drawn as tubes ----------
// Each shape gives curves(P): one function per loop, t from 0 to 2π → a point. stats(P) gives the three Numbers.
// The 6- and 7-crossing knots, the granny and square knots and the Whitehead link come from knots-data.js: built from
// braids and plats, relaxed into smooth shapes and stored as Fourier series. Every knot here was checked to be the knot
// its name says by computing its Alexander polynomial from three views; the links by their linking numbers.
const { sin, cos, PI } = Math;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
import { FOURIER } from './knots-data.js';
const fourierCurve = (C, k = 1) => t => C.map(c => c.reduce((s, [a, b], h) => s + a * cos(h * t) + b * sin(h * t), 0) * k);
export const SHAPES = {
  unknot: { group: 'knot', name: 'Unknot', alt: 'a plain loop: the simplest knot', curves: () => [t => [cos(t), 0, sin(t)]],
    stats: () => [['0', 'crossings'], ['1', 'piece'], ['0', 'unknotting number']],
    info: 'A loop with no knot in it. Knot theory asks when two tangles are really the same: any loop you can wiggle into a circle without cutting is the unknot, however messy it looks.' },
  trefoil: { group: 'knot', name: 'Trefoil (3₁)', alt: 'the simplest true knot', curves: () => [t => [(sin(t) + 2 * sin(2 * t)) * 0.4, -sin(3 * t) * 0.4, (cos(t) - 2 * cos(2 * t)) * 0.4]],
    stats: () => [['3', 'crossings'], ['1', 'piece'], ['1', 'unknotting number']],
    info: 'The simplest knot that can\'t be undone: three crossings, and no fewer will do. It comes in two mirror-image forms, left- and right-handed, and no amount of wiggling turns one into the other.' },
  figure8: { group: 'knot', name: 'Figure-eight (4₁)', alt: 'four crossings, its own mirror image', curves: () => [t => [(2 + cos(2 * t)) * cos(3 * t) * 0.36, sin(4 * t) * 0.36, (2 + cos(2 * t)) * sin(3 * t) * 0.36]],
    stats: () => [['4', 'crossings'], ['1', 'piece'], ['1', 'unknotting number']],
    info: 'The next simplest knot, with four crossings. Unlike the trefoil it is the same as its mirror image: you can wiggle a left-handed one into a right-handed one.' },
  cinquefoil: { group: 'knot', name: 'Cinquefoil (5₁)', alt: 'a five-pointed star knot', curves: () => [torusCurve(5, 2, 0)],
    stats: () => [['5', 'crossings'], ['1', 'piece'], ['2', 'unknotting number']],
    info: 'The (5, 2) torus knot: wind round a doughnut five times the long way while going round twice the short way. It needs two crossings changed to come undone.' },
  torusknot: { group: 'torus', name: 'Torus knot (p, q)', alt: 'wound round a doughnut', params: [{ id: 'kp', label: 'p', min: 2, max: 9, step: 1, def: 3 }, { id: 'kq', label: 'q', min: 2, max: 9, step: 1, def: 2 }],
    curves: P => { const g = gcd(P.kp, P.kq), p = P.kp / g, q = P.kq / g; return Array.from({ length: g }, (_, j) => torusCurve(p, q, 2 * PI * j / (g * q))); },   // ring j: q·a − p·b = 2πj/g, so the rings never meet
    stats: P => { const g = gcd(P.kp, P.kq); if (g > 1) return [[String(P.kp * P.kq - Math.max(P.kp, P.kq)), 'crossings'], [String(g), 'pieces (a link)'], ['—', 'unknotting number']];
      const p = P.kp, q = P.kq; return [[String(Math.min(p * (q - 1), q * (p - 1))), 'crossings'], ['1', 'piece'], [String((p - 1) * (q - 1) / 2), 'unknotting number']]; },
    info: 'Wind a string p times round a doughnut the long way and q times the short way. When p and q share no factor you get one knot; when they do, you get a link of several loops. (3, 2) is the trefoil and (5, 2) the cinquefoil; swapping p and q gives the same knot.' },
  lissajous: { group: 'knot', name: 'Lissajous knot (5₂)', alt: 'three sine waves at different speeds', curves: () => [t => [cos(3 * t + 0.7) * 0.9, cos(7 * t) * 0.9, cos(2 * t + 0.2) * 0.9]],
    stats: () => [['5', 'crossings (at fewest)'], ['1', 'piece'], ['3 : 2 : 7', 'frequencies']],
    info: 'Move a point with a different steady wiggle in each direction, here 3, 2 and 7 waves per loop, and it traces a closed curve. When the curve never meets itself it is a knot, a Lissajous knot. This one is the knot 5₂, the three-twist knot, drawn with many extra crossings. Knotted tangles like this turn up in physics, chemistry and DNA.' },
  k61: { group: 'knot', name: 'Stevedore (6₁)', alt: 'six crossings, named after a docker\'s knot', curves: () => [fourierCurve(FOURIER['6_1'], 0.95)],
    stats: () => [['6', 'crossings'], ['1', 'piece'], ['1', 'unknotting number']],
    info: 'The stevedore knot, named for the stopper knot dockworkers tie in ropes. It is a slice knot: it can be the edge of a smooth disc in 4D space, something that sets it apart from most knots.' },
  k62: { group: 'knot', name: 'Knot 6₂', alt: 'six crossings, a twisted cousin of the trefoil', curves: () => [fourierCurve(FOURIER['6_2'], 0.95)],
    stats: () => [['6', 'crossings'], ['1', 'piece'], ['1', 'unknotting number']],
    info: 'One of the three prime knots with six crossings. Like the trefoil it is chiral: it can\'t be turned into its mirror image.' },
  k63: { group: 'knot', name: 'Knot 6₃', alt: 'six crossings, its own mirror image', curves: () => [fourierCurve(FOURIER['6_3'], 0.95)],
    stats: () => [['6', 'crossings'], ['1', 'piece'], ['1', 'unknotting number']],
    info: 'The third six-crossing knot. Like the figure-eight it is amphichiral: it can be wriggled into its own mirror image.' },
  k72: { group: 'knot', name: 'Knot 7₂', alt: 'seven crossings: a long twist with a clasp', curves: () => [fourierCurve(FOURIER['7_2'], 0.95)],
    stats: () => [['7', 'crossings'], ['1', 'piece'], ['1', 'unknotting number']],
    info: 'A twist knot: a loop twisted five times and then hooked through itself. All twist knots can be undone by changing a single crossing.' },
  k73: { group: 'knot', name: 'Knot 7₃', alt: 'seven crossings', curves: () => [fourierCurve(FOURIER['7_3'], 0.95)],
    stats: () => [['7', 'crossings'], ['1', 'piece'], ['2', 'unknotting number']],
    info: 'A seven-crossing knot that needs two crossing changes to undo. It is built from two groups of twists, four and three.' },
  k74: { group: 'knot', name: 'Endless knot (7₄)', alt: 'seven crossings, a symbol in Buddhist art', curves: () => [fourierCurve(FOURIER['7_4'], 0.95)],
    stats: () => [['7', 'crossings'], ['1', 'piece'], ['2', 'unknotting number']],
    info: 'This knot is the endless knot of Tibetan and Chinese art, a symbol of things without beginning or end. It can also be drawn as a Lissajous knot.' },
  granny: { group: 'knot', name: 'Granny knot', alt: 'two trefoils the same way round', curves: () => [fourierCurve(FOURIER.granny, 0.95)],
    stats: () => [['6', 'crossings'], ['2', 'trefoils joined'], ['2', 'unknotting number']],
    info: 'Tie two trefoils one after the other in the same direction and you get the granny knot, the one that slips. The square knot is made of the same two pieces with one of them mirrored, yet the two knots are different: no wriggling turns one into the other.' },
  square: { group: 'knot', name: 'Square knot', alt: 'a trefoil and its mirror image', curves: () => [fourierCurve(FOURIER.square, 0.95)],
    stats: () => [['6', 'crossings'], ['2', 'trefoils joined'], ['2', 'unknotting number']],
    info: 'A left-handed trefoil joined to a right-handed one: the reef knot sailors tie. It is its own mirror image, while the granny knot is not. The two have the same Alexander polynomial, yet they are different knots.' },
  hopf: { group: 'link', name: 'Hopf link', alt: 'two rings linked once', curves: () => [t => [cos(t) - 0.5, sin(t), 0], t => [cos(t) + 0.5, 0, sin(t)]],
    stats: () => [['2', 'crossings'], ['2', 'pieces'], ['1', 'linking number']],
    info: 'The simplest link: two rings through each other. Each passes once through the other, so their linking number is 1. The circles of the Hopf fibration in 4D are all linked like this.' },
  solomon: { group: 'link', name: 'Solomon link', alt: 'two rings linked twice', curves: () => [torusCurve(2, 1, 0), torusCurve(2, 1, PI)],   // the (4, 2) torus link
    stats: () => [['4', 'crossings'], ['2', 'pieces'], ['2', 'linking number']],
    info: 'Two rings that wind round each other twice: the (4, 2) torus link, found on Roman mosaics and medieval carvings as Solomon\'s knot (even though it\'s really a link).' },
  whitehead: { group: 'link', name: 'Whitehead link', alt: 'linked, though neither ring winds round the other', curves: () => FOURIER.whitehead.map(C => fourierCurve(C, 0.95)),
    stats: () => [['5', 'crossings'], ['2', 'pieces'], ['0', 'linking number']],
    info: 'J. H. C. Whitehead, 1934. Count how many times one ring winds round the other and you get zero, yet they can\'t be pulled apart. It shows that the linking number alone can\'t tell whether things are truly linked.' },
  chain: { group: 'link', name: 'Chain of three', alt: 'three rings, each linked to the next', curves: () => [-1, 0, 1].map((k, i) => t => (i % 2 ? [k * 0.62 + cos(t) * 0.42, 0, sin(t) * 0.42] : [k * 0.62 + cos(t) * 0.42, sin(t) * 0.42, 0])),
    stats: () => [['3', 'pieces'], ['1', 'linking number of neighbours'], ['0', 'of the two ends']],
    info: 'A chain: each ring links its neighbours once, and the two end rings aren\'t linked to each other at all. Cut the middle ring and the chain falls apart.' },
  olympic: { group: 'link', name: 'Olympic rings', alt: 'five rings in two rows, like the flag', curves: () => OLYMPIC.map(([x, y, ph]) => t => [x + cos(t) * 0.5, y + sin(t) * 0.5, 0.22 * sin(2 * t + ph)]),
    stats: () => [['5', 'pieces'], ['4', 'linked pairs'], ['0', 'linking of non-neighbours']],
    info: 'The Olympic rings, as a link: each ring of the bottom row passes through the two rings above it. Each linked pair has linking number 1; rings that aren\'t neighbours don\'t link at all.' },
  borromean: { group: 'link', name: 'Borromean rings', alt: 'three rings held together, no two linked', curves: () => [t => [cos(t) * 1.0, sin(t) * 0.5, 0], t => [0, cos(t) * 1.0, sin(t) * 0.5], t => [sin(t) * 0.5, 0, cos(t) * 1.0]],
    stats: () => [['6', 'crossings'], ['3', 'pieces'], ['0', 'linking numbers']],
    info: 'Three rings that hold together, although no two of them are linked: cut any one and the other two fall apart. Each pair has linking number 0. The Borromeo family of Milan used them as an emblem.' },
};
// ring centres for the Olympic rings, and the phase of each ring's small up-and-down weave (chosen so every bottom ring
// links the two above it and nothing else: checked by linking numbers)
const OLYMPIC = [[-1.1, 0.25, 4.035], [0, 0.25, 6.185], [1.1, 0.25, 1.977], [-0.55, -0.2, 4.633], [0.55, -0.2, 0.997]];
// a (p, q) curve on a torus, shifted round the long way by `shift` (two shifted copies can't meet when the shifts give different q·a − p·b)
function torusCurve(p, q, shift) { return t => { const a = p * t + shift, b = q * t; const r = 1 + 0.42 * cos(b); return [r * cos(a) * 0.78, 0.42 * sin(b) * 0.78, r * sin(a) * 0.78]; }; }

export const GROUPS = [['knot', 'Knots'], ['link', 'Links'], ['torus', 'Torus knots and links']];
export const defaults = sh => Object.fromEntries((sh.params || []).map(p => [p.id, p.def]));
/** Sample every loop of a shape into n points (closed). */
export const curvePoints = (sh, P, n) => sh.curves(P).map(c => Array.from({ length: n }, (_, i) => c(2 * PI * i / n)));
