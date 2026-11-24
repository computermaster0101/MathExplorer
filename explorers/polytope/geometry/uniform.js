import { SHAPES, autoTilt } from './polytopes.js';
import { WY_FAM, wyGroup, wythoff } from './wythoff.js';
import { COUSIN } from './cousins3d.js';

// ---------- every convex uniform 4D shape ----------
// There are 47 (besides the endless prism families): 45 come from Wythoff's construction in the four families of mirrors,
// plus the snub 24-cell and the grand antiprism. Each family's four mirrors are the nodes of a diagram o–p–o–q–o–r–o, and a
// shape is a choice of "ringed" mirrors: the point sits on every unringed mirror and one step from each ringed one, so all
// its edges come out the same length. 15 choices a family; those that match another (the 5-cell's and 24-cell's diagrams
// read the same backwards, and three tesseract-family shapes are 24-cell-family ones) are listed once.
//
// The cells come from the diagram too: leave out one mirror, and if every piece of what's left still has a ringed mirror,
// the three that remain build a polyhedron (or a polygon × a line: a prism), and there are as many as the whole group is
// bigger than theirs. So nothing below is typed in by hand but the names.
const P3 = {   // polyhedra from a 3-mirror diagram [a,b] and its rings
  '3,3':{ '100':'tetrahedron', '010':'octahedron', '001':'tetrahedron', '110':'truncated tetrahedron', '011':'truncated tetrahedron', '101':'cuboctahedron', '111':'truncated octahedron' },
  '4,3':{ '100':'cube', '010':'cuboctahedron', '001':'octahedron', '110':'truncated cube', '011':'truncated octahedron', '101':'rhombicuboctahedron', '111':'truncated cuboctahedron' },
  '3,4':{ '100':'octahedron', '010':'cuboctahedron', '001':'cube', '110':'truncated octahedron', '011':'truncated cube', '101':'rhombicuboctahedron', '111':'truncated cuboctahedron' },
  '5,3':{ '100':'dodecahedron', '010':'icosidodecahedron', '001':'icosahedron', '110':'truncated dodecahedron', '011':'truncated icosahedron', '101':'rhombicosidodecahedron', '111':'truncated icosidodecahedron' },
  '3,5':{ '100':'icosahedron', '010':'icosidodecahedron', '001':'dodecahedron', '110':'truncated icosahedron', '011':'truncated dodecahedron', '101':'rhombicosidodecahedron', '111':'truncated icosidodecahedron' },
};
const ORD3 = { '3,3':24, '4,3':48, '3,4':48, '5,3':120, '3,5':120 };
const GON = { 3:'triangular', 4:'square', 5:'pentagonal', 6:'hexagonal', 8:'octagonal', 10:'decagonal' };
const plural = n => n.replace(/hedron$/, 'hedra').replace(/(cube|prism)$/, '$1s');
const prism = n => (n === 4 ? 'cube' : GON[n] + ' prism');
/** The cells of the shape with rings R (four 0/1) in family fk: [{ name, count }], biggest count first. */
export function cellsOf(fk, R) {
  const m = WY_FAM[fk].m, N = wyGroup(fk).order, out = new Map(), add = (name, n) => out.set(name, (out.get(name) || 0) + n);
  if (R[1] || R[2] || R[3]) { const d = m[1] + ',' + m[2]; add(P3[d][`${R[1]}${R[2]}${R[3]}`], N / ORD3[d]); }   // leave out mirror 0
  if (R[0] || R[1] || R[2]) { const d = m[0] + ',' + m[1]; add(P3[d][`${R[0]}${R[1]}${R[2]}`], N / ORD3[d]); }   // leave out mirror 3
  if (R[0] && (R[2] || R[3])) add(prism(R[2] && R[3] ? 2 * m[2] : m[2]), N / (2 * 2 * m[2]));                  // mirror 1: a line × a polygon
  if ((R[0] || R[1]) && R[3]) add(prism(R[0] && R[1] ? 2 * m[0] : m[0]), N / (2 * 2 * m[0]));                  // mirror 2: a polygon × a line
  return [...out].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
// how each choice of rings changes the regular shape, in words (from the start of the diagram; the far end is the dual's)
const OPS = { '1000':['', ''], '0100':['Rectified', 'its corners shaved down to the middles of its edges'], '1100':['Truncated', 'its corners sliced off'],
  '0110':['Bitruncated', 'cut so deep that it meets its dual halfway'], '1010':['Cantellated', 'its edges and corners cut back'],
  '1001':['Runcinated', 'its cells pushed apart and the gaps filled'], '1110':['Cantitruncated', 'its edges and corners cut back, deeper at the corners'],
  '1101':['Runcitruncated', 'its cells pushed apart and their corners sliced off'], '1111':['Omnitruncated', 'every corner, edge and face shaved off'] };
const BASE = { a4:['5-cell', '5-cell', '{3,3,3}', '{3,3,3}'], b4:['tesseract', '16-cell', '{4,3,3}', '{3,3,4}'], f4:['24-cell', '24-cell', '{3,4,3}', '{3,4,3}'], h4:['120-cell', '600-cell', '{5,3,3}', '{3,3,5}'] };
const SUB = '₀₁₂₃';
// The catalogue, family by family, in the order the panel lists them. key: the shape's key (the earlier named ones keep
// theirs); rings: which mirrors are ringed; dual: named from the other end of the diagram (the 16-cell's or 600-cell's side).
export const UNIFORM = {
  a4: [['5','1000'], ['r5','0100'], ['t5','1100'], ['bt5','0110'], ['ca5','1010'], ['ru5','1001'], ['ct5','1110'], ['rt5','1101'], ['o5','1111']],
  b4: [['8','1000'], ['16','0001',1], ['rt','0100'], ['tt','1100'], ['t16','0011',1], ['bt','0110'], ['ca8','1010'], ['ru8','1001'], ['ct8','1110'], ['rt8','1101'], ['rt16','1011',1], ['ot','1111']],
  f4: [['24','1000'], ['r24','0100'], ['t24','1100'], ['bt24','0110'], ['ca24','1010'], ['ru24','1001'], ['ct24','1110'], ['rt24','1101'], ['o24','1111'], ['s24','']],
  h4: [['120','1000'], ['600','0001',1], ['r120','0100'], ['r600','0010',1], ['t120','1100'], ['t600','0011',1], ['bt120','0110'], ['ca120','1010'], ['ca600','0101',1], ['ru120','1001'], ['ct120','1110'], ['ct600','0111',1], ['rt120','1101'], ['rt600','1011',1], ['o120','1111']],
  other: [['ga','']],
};
export const UNI_FAMS = { a4:'5-cell', b4:'Tesseract & 16-cell', f4:'24-cell', h4:'120-cell & 600-cell', other:'Others' };
// the 3D shape built the same way, one dimension down (Show the 3D cousin)
const C3 = { '4,3':{ '1000':'cube', '0100':'cubo', '0001':'oct', '1100':'tcube', '0110':'toct', '0011':'toct', '1010':'rco', '0101':'rco', '1001':'rco', '1110':'tco', '0111':'tco', '1101':'tco', '1011':'tco', '1111':'tco' },
  '3,3':{ '1000':'tet', '0100':'oct', '1100':'ttet', '0110':'ttet', '1010':'cubo', '1001':'cubo', '1110':'toct', '1101':'toct', '1111':'toct' },
  '5,3':{ '1000':'dod', '0100':'idd', '0010':'idd', '0001':'ico', '1100':'tdod', '0110':'tico', '0011':'tico', '1010':'rid', '0101':'rid', '1001':'rid', '1110':'grid', '0111':'grid', '1101':'grid', '1011':'grid', '1111':'grid' } };
const C3_FAM = { a4:'3,3', b4:'4,3', f4:'4,3', h4:'5,3' };
const list = cs => { const s = cs.map(c => `${c.count} ${c.count === 1 ? c.name : plural(c.name)}`); return s.length > 1 ? s.slice(0, -1).join(', ') + ' and ' + s[s.length - 1] : s[0]; };
const fmt = n => n.toLocaleString('en');
for (const fk of ['a4', 'b4', 'f4', 'h4']) for (const [key, rings, dual] of UNIFORM[fk]) {
  if (!rings) continue;
  const R = [...rings].map(Number), own = dual ? [...R].reverse() : R, op = OPS[own.join('')], base = BASE[fk][dual ? 1 : 0], cells = cellsOf(fk, R);
  const total = cells.reduce((s, c) => s + c.count, 0), idx = own.map((r, i) => (r ? SUB[i] : '')).filter(Boolean).join(',');
  const sym = own.join('') === '1000' ? BASE[fk][dual ? 3 : 2] : `t${idx}${BASE[fk][dual ? 3 : 2]}`;
  if (!COUSIN[key] && C3[C3_FAM[fk]][rings]) COUSIN[key] = C3[C3_FAM[fk]][rings];
  if (SHAPES[key]) { SHAPES[key].uni = { fk, rings }; continue; }   // named before: keep its own text
  const name = `${op[0]} ${base}`, alt = list(cells);
  // the symbol: Coxeter's short forms (r, t, rr, tr…) come from the name (schlafli.js); runcitruncation has none, so t₀,₁,₃
  const sh = SHAPES[key] = { name, alt, cells: total, ...(op[0] === 'Runcitruncated' ? { sym } : {}), uni: { fk, rings },
    info: `The ${base} with ${op[1]}. Its ${fmt(total)} cells are ${alt}. One of the 47 convex uniform 4D shapes: every corner looks the same, and every cell is a regular or uniform polyhedron (or a prism). Made by Wythoff's construction in the ${WY_FAM[fk].label}, with ${R.filter(Boolean).length === 4 ? 'all four' : R.filter(Boolean).length} of its four mirrors ringed (see “Every uniform shape” in Learn).` };
  let cache = null;
  const init = () => { if (!cache) { const r = wythoff(fk, R); cache = { verts: autoTilt(r.verts), edges: r.edges };
      const E = cache.edges.length; sh.tk = E > 12000 ? 0.12 : E > 5000 ? 0.16 : E > 2000 ? 0.22 : E > 800 ? 0.32 : E > 300 ? 0.5 : 0.7;
      sh.info = sh.info.replace(' One of the 47', ` ${fmt(cache.verts.length)} corners and ${fmt(E)} edges. One of the 47`); }
    return cache; };
  Object.defineProperty(sh, 'verts', { get: () => init().verts, configurable: true }); Object.defineProperty(sh, 'edges', { get: () => init().edges, configurable: true });
  Object.defineProperty(sh, 'tk', { get() { init(); return this._tk; }, set(v) { this._tk = v; }, configurable: true });
}
