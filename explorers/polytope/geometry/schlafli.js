import { $ } from '../util.js';
import { st } from '../state.js';

// ---------- Schläfli symbols: a short name built from how the shape is put together ----------
const BASE_SYM={tesseract:'{4,3,3}', '16-cell':'{3,3,4}', '5-cell':'{3,3,3}', '24-cell':'{3,4,3}', '120-cell':'{5,3,3}', '600-cell':'{3,3,5}'};
const POLY_SYM={tetrahedron:'{3,3}', cube:'{4,3}', octahedron:'{3,4}', icosahedron:'{3,5}', dodecahedron:'{5,3}'};
const runSym=(a,n)=> n<=7 ? '{'+a.join(',')+'}' : null;
export function symbolFor(sh){
  if (sh.sym) return sh.sym;
  if (sh.highD){ const n=sh.n, k=n-2;
    if (sh.fam==='cube') return n<=7 ? '{4,'+Array(k).fill(3).join(',')+'}' : `{4,3,…,3} (${k} threes)`;
    if (sh.fam==='simp') return n<=7 ? '{'+Array(n-1).fill(3).join(',')+'}' : `{3,…,3} (${n-1} threes)`;
    return n<=7 ? '{'+Array(k).fill(3).join(',')+',4}' : `{3,…,3,4} (${k} threes)`; }
  if (sh.round || sh.compound || /^Part-way/.test(sh.name)) return '';
  if (st.shape==='d') return `{${$('dp').value}}×{${$('dq').value}}`;
  if (sh.lift) return sh.lift.kind==='prism' ? `${POLY_SYM[sh.lift.bn]}×{ }` : `( ) ∨ ${POLY_SYM[sh.lift.bn]}`;
  const nm=sh.name.toLowerCase(), hits=Object.keys(BASE_SYM).filter(b=>nm.includes(b)).sort((a,b)=>nm.indexOf(a)-nm.indexOf(b)), base=hits[0]; if (!base) return '';
  const pre=[['omnitruncated','t₀,₁,₂,₃'],['cantitruncated','tr'],['runcinated','t₀,₃'],['cantellated','rr'],['bitruncated','2t'],['truncated','t'],['rectified','r'],['snub','s']].find(([w])=>nm.startsWith(w));
  return (pre ? pre[1] : '') + BASE_SYM[base]; }
// one click: turn a corner to face the knife, then stop the knife just inside that corner. The small slice is the vertex figure.
