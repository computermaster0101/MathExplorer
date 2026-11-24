import { SHAPES, autoTilt } from './polytopes.js';
import { mirrors, group, build, signature } from './star-search.js';
import { STAR_LIST } from './star-list.js';
import { st } from '../state.js';

// ---------- the star uniform shapes: one at a time, as the shape "ustar" ----------
// Built exactly like the convex uniform shapes (Wythoff's construction), from four mirrors that meet at star angles; the
// list of which mirrors and rings make each different picture is star-list.js. The group (up to 14,400 turns and
// reflections) is worked out once per set of mirrors and kept.
const SYM = { 14400:'the 120-cell’s symmetry', 1152:'the 24-cell’s symmetry', 384:'the tesseract’s symmetry' };
export const STAR_SYM = { 14400:'120-cell', 1152:'24-cell', 384:'tesseract' };
const groups = new Map();
const frac = t => { const [n, d] = t.split('/').map(Number); return [n, d || 1]; };
// the ten regular star polytopes, matched by their picture, so a star shape that is one of them says so
let REG = null;
const regular = () => { if (REG) return REG; REG = new Map();
  for (const k of ['ico120', 'sst120', 'gr120', 'grand120', 'gst120', 'gs120', 'gg120', 'gi120', 'g600', 'ggs120']) { const sh = SHAPES[k]; if (!sh) continue;
    const V = sh.verts.map(v => { const l = Math.hypot(...v); return v.map(x => x / l); }), s = signature({ verts: V, edges: sh.edges });
    const was = REG.get(s); if (was) { was.names.push(sh.name); was.syms.push(sh.sym); } else REG.set(s, { names: [sh.name], syms: [sh.sym] }); }
  return REG; };
const fmt = n => n.toLocaleString('en');
/** Star shape i (0-based) of STAR_LIST, as a shape. */
export function makeStar(i) {
  const [lab, rings, order] = STAR_LIST[i], L = lab.split(','), R = [...rings].map(Number);
  let G = groups.get(lab); const A = mirrors(L.map(frac)); if (!G) { G = group(A); groups.set(lab, G); }
  const r = build(A, G, R), sig = signature(r), rm = regular().get(sig), E = r.edges.length;
  const and = a => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0]), reg = rm && and(rm.names.map(n => 'the ' + n.toLowerCase()));
  const ringed = R.map((x, k) => (x ? k + 1 : 0)).filter(Boolean), angles = L.map((x, k) => [x, ['1–2', '1–3', '1–4', '2–3', '2–4', '3–4'][k]]).filter(([x]) => x !== '2');
  return { name: rm ? rm.names[0] + (rm.names.length > 1 ? ` (same picture as ${rm.names.length - 1} more)` : '') : `Star shape ${i + 1}`, star: true, ustar: i, dia: { lab: L, rings }, ...(rm ? { sym: rm.syms[0] } : {}),
    alt: `${fmt(r.verts.length)} corners, ${fmt(E)} edges · ${SYM[order]}`, verts: autoTilt(r.verts), edges: r.edges,
    tk: E > 12000 ? 0.12 : E > 5000 ? 0.16 : E > 2000 ? 0.22 : E > 800 ? 0.32 : 0.45,
    info: `${reg ? `This picture is ${reg} (under Star polytopes), made here from star mirrors. ` : ''}A star uniform shape: built just like the uniform shapes above, from four mirrors with the point one step from each ringed one, but the mirrors meet at star angles (a half turn divided by ${[...new Set(L.filter(x => x.includes('/')))].join(' or ')}), so its cells pass through one another. Mirrors ${angles.map(([x, p]) => `${p} at ${x}`).join(', ')}, the rest at right angles; ringed: ${ringed.join(', ')}. ${fmt(r.verts.length)} corners and ${fmt(E)} edges, with ${SYM[order]}. Every corner looks the same and every edge is the same length.` };
}
let built = null;
const cur = () => { const i = Math.max(0, Math.min(STAR_LIST.length - 1, st.ustar | 0)); if (!built || built.ustar !== i) built = makeStar(i); return built; };
// the shape the rest of the explorer sees: whichever star shape is chosen (st.ustar), built when it's first looked at
SHAPES.ustar = new Proxy({}, { get: (t, k) => cur()[k], has: (t, k) => k in cur(), set: (t, k, v) => { cur()[k] = v; return true; },
  ownKeys: () => Reflect.ownKeys(cur()), getOwnPropertyDescriptor: (t, k) => { const d = Reflect.getOwnPropertyDescriptor(cur(), k); return d && { ...d, configurable: true }; } });
