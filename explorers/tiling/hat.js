// The hat: the "einstein" monotile found by David Smith, Joseph Myers, Craig Kaplan and Chaim Goodman-Strauss (2023). One
// shape, with mirror images, tiles the plane, but never periodically. Built by the metatile substitution from their paper:
// four supertiles (H, T, P, F) are made of hats, and each level's H, T, P, F are assembled from the level below.
const hr3 = Math.sqrt(3) / 2, PI = Math.PI;
const pt = (x, y) => ({ x, y }), hexPt = (x, y) => pt(x + 0.5 * y, hr3 * y);
// transforms [a, b, c, d, e, f]: x' = a x + b y + c, y' = d x + e y + f
const ident = [1, 0, 0, 0, 1, 0];
const mul = (A, B) => [A[0] * B[0] + A[1] * B[3], A[0] * B[1] + A[1] * B[4], A[0] * B[2] + A[1] * B[5] + A[2], A[3] * B[0] + A[4] * B[3], A[3] * B[1] + A[4] * B[4], A[3] * B[2] + A[4] * B[5] + A[5]];
const inv = T => { const det = T[0] * T[4] - T[1] * T[3]; return [T[4] / det, -T[1] / det, (T[1] * T[5] - T[2] * T[4]) / det, -T[3] / det, T[0] / det, (T[2] * T[3] - T[0] * T[5]) / det]; };
const trot = ang => { const c = Math.cos(ang), s = Math.sin(ang); return [c, -s, 0, s, c, 0]; };
const ttrans = (tx, ty) => [1, 0, tx, 0, 1, ty];
const rotAbout = (p, ang) => mul(ttrans(p.x, p.y), mul(trot(ang), ttrans(-p.x, -p.y)));
const transPt = (M, P) => pt(M[0] * P.x + M[1] * P.y + M[2], M[3] * P.x + M[4] * P.y + M[5]);
const padd = (p, q) => pt(p.x + q.x, p.y + q.y), psub = (p, q) => pt(p.x - q.x, p.y - q.y);
const matchSeg = (p, q) => [q.x - p.x, p.y - q.y, p.x, q.y - p.y, q.x - p.x, p.y];
const matchTwo = (p1, q1, p2, q2) => mul(matchSeg(p2, q2), inv(matchSeg(p1, q1)));
function intersect(p1, q1, p2, q2) { const d = (q2.y - p2.y) * (q1.x - p1.x) - (q2.x - p2.x) * (q1.y - p1.y), uA = ((q2.x - p2.x) * (p1.y - p2.y) - (q2.y - p2.y) * (p1.x - p2.x)) / d; return pt(p1.x + uA * (q1.x - p1.x), p1.y + uA * (q1.y - p1.y)); }

export const HAT = [hexPt(0, 0), hexPt(-1, -1), hexPt(0, -2), hexPt(2, -2), hexPt(2, -1), hexPt(4, -2), hexPt(5, -1), hexPt(4, 0), hexPt(3, 0), hexPt(2, 2), hexPt(0, 3), hexPt(0, 2), hexPt(-1, 2)];
class HatTile { constructor(label) { this.label = label; } collect(T, out) { out.push({ T, label: this.label }); } }
class MetaTile {
  constructor(shape, width) { this.shape = shape; this.width = width; this.children = []; }
  addChild(T, geom) { this.children.push({ T, geom }); }
  evalChild(n, i) { return transPt(this.children[n].T, this.children[n].geom.shape[i]); }
  collect(T, out) { for (const ch of this.children) ch.geom.collect(mul(T, ch.T), out); }
  recentre() { let cx = 0, cy = 0; for (const p of this.shape) { cx += p.x; cy += p.y; } cx /= this.shape.length; cy /= this.shape.length; const tr = pt(-cx, -cy);
    this.shape = this.shape.map(p => padd(p, tr)); const M = ttrans(-cx, -cy); for (const ch of this.children) ch.T = mul(M, ch.T); }
}
const H1_hat = new HatTile('H1'), H_hat = new HatTile('H'), T_hat = new HatTile('T'), P_hat = new HatTile('P'), F_hat = new HatTile('F');
function initH() { const o = [pt(0, 0), pt(4, 0), pt(4.5, hr3), pt(2.5, 5 * hr3), pt(1.5, 5 * hr3), pt(-0.5, hr3)], m = new MetaTile(o, 2);
  m.addChild(matchTwo(HAT[5], HAT[7], o[5], o[0]), H_hat); m.addChild(matchTwo(HAT[9], HAT[11], o[1], o[2]), H_hat); m.addChild(matchTwo(HAT[5], HAT[7], o[3], o[4]), H_hat);
  m.addChild(mul(ttrans(2.5, hr3), mul([-0.5, -hr3, 0, hr3, -0.5, 0], [0.5, 0, 0, 0, -0.5, 0])), H1_hat); return m; }
function initT() { const o = [pt(0, 0), pt(3, 0), pt(1.5, 3 * hr3)], m = new MetaTile(o, 2); m.addChild([0.5, 0, 0.5, 0, 0.5, hr3], T_hat); return m; }
function initP() { const o = [pt(0, 0), pt(4, 0), pt(3, 2 * hr3), pt(-1, 2 * hr3)], m = new MetaTile(o, 2);
  m.addChild([0.5, 0, 1.5, 0, 0.5, hr3], P_hat); m.addChild(mul(ttrans(0, 2 * hr3), mul([0.5, hr3, 0, -hr3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0])), P_hat); return m; }
function initF() { const o = [pt(0, 0), pt(3, 0), pt(3.5, hr3), pt(3, 2 * hr3), pt(-1, 2 * hr3)], m = new MetaTile(o, 2);
  m.addChild([0.5, 0, 1.5, 0, 0.5, hr3], F_hat); m.addChild(mul(ttrans(0, 2 * hr3), mul([0.5, hr3, 0, -hr3, 0.5, 0], [0.5, 0, 0, 0, 0.5, 0])), F_hat); return m; }
const RULES = [['H'], [0, 0, 'P', 2], [1, 0, 'H', 2], [2, 0, 'P', 2], [3, 0, 'H', 2], [4, 4, 'P', 2], [0, 4, 'F', 3], [2, 4, 'F', 3], [4, 1, 3, 2, 'F', 0], [8, 3, 'H', 0], [9, 2, 'P', 0], [10, 2, 'H', 0],
  [11, 4, 'P', 2], [12, 0, 'H', 2], [13, 0, 'F', 3], [14, 2, 'F', 1], [15, 3, 'H', 4], [8, 2, 'F', 1], [17, 3, 'H', 0], [18, 2, 'P', 0], [19, 2, 'H', 2], [20, 4, 'F', 3], [20, 0, 'P', 2], [22, 0, 'H', 2],
  [23, 4, 'F', 3], [23, 0, 'F', 3], [16, 0, 'P', 2], [9, 4, 0, 2, 'T', 2], [4, 0, 'F', 3]];
function constructPatch(H, T, P, F) {
  const ret = new MetaTile([], H.width), S = { H, T, P, F };
  for (const r of RULES) {
    if (r.length === 1) ret.addChild(ident, S[r[0]]);
    else if (r.length === 4) { const poly = ret.children[r[0]].geom.shape, M = ret.children[r[0]].T, Pp = transPt(M, poly[(r[1] + 1) % poly.length]), Q = transPt(M, poly[r[1]]), n = S[r[2]], np = n.shape;
      ret.addChild(matchTwo(np[r[3]], np[(r[3] + 1) % np.length], Pp, Q), n); }
    else { const chP = ret.children[r[0]], chQ = ret.children[r[2]], Pp = transPt(chQ.T, chQ.geom.shape[r[3]]), Q = transPt(chP.T, chP.geom.shape[r[1]]), n = S[r[4]], np = n.shape;
      ret.addChild(matchTwo(np[r[5]], np[(r[5] + 1) % np.length], Pp, Q), n); }
  }
  return ret;
}
function constructMetatiles(patch) {
  const bps1 = patch.evalChild(8, 2), bps2 = patch.evalChild(21, 2), rbps = transPt(rotAbout(bps1, -2 * PI / 3), bps2), p72 = patch.evalChild(7, 2), p252 = patch.evalChild(25, 2);
  const llc = intersect(bps1, rbps, patch.evalChild(6, 2), p72); let w = psub(patch.evalChild(6, 2), llc);
  const Ho = [llc, bps1]; w = transPt(trot(-PI / 3), w); Ho.push(padd(Ho[1], w)); Ho.push(patch.evalChild(14, 2)); w = transPt(trot(-PI / 3), w); Ho.push(psub(Ho[3], w)); Ho.push(patch.evalChild(6, 2));
  const nH = new MetaTile(Ho, patch.width * 2); for (const c of [0, 9, 16, 27, 26, 6, 1, 8, 10, 15]) nH.addChild(patch.children[c].T, patch.children[c].geom);
  const nP = new MetaTile([p72, padd(p72, psub(bps1, llc)), bps1, llc], patch.width * 2); for (const c of [7, 2, 3, 4, 28]) nP.addChild(patch.children[c].T, patch.children[c].geom);
  const nF = new MetaTile([bps2, patch.evalChild(24, 2), patch.evalChild(25, 0), p252, padd(p252, psub(llc, bps1))], patch.width * 2); for (const c of [21, 20, 22, 23, 24, 25]) nF.addChild(patch.children[c].T, patch.children[c].geom);
  const AAA = Ho[2], BBB = padd(Ho[1], psub(Ho[4], Ho[5])), CCC = transPt(rotAbout(BBB, -PI / 3), AAA);
  const nT = new MetaTile([BBB, CCC, AAA], patch.width * 2); nT.addChild(patch.children[11].T, patch.children[11].geom);
  for (const m of [nH, nP, nF, nT]) m.recentre();
  return [nH, nT, nP, nF];
}
/** The hats of a patch after `levels` rounds of substitution: each as a polygon (list of [x, y]) and its kind (H1 = mirrored). */
const cache = {};
export function hatPatch(levels) {
  if (cache[levels]) return cache[levels];
  let tiles = [initH(), initT(), initP(), initF()];
  for (let i = 0; i < levels; i++) tiles = constructMetatiles(constructPatch(...tiles));
  const out = []; constructPatch(...tiles).collect(ident, out);
  return (cache[levels] = out.map(({ T, label }) => ({ p: HAT.map(q => { const r = transPt(T, q); return [r.x, r.y]; }), label })));
}
