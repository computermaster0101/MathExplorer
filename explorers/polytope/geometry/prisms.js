import { an, lerpN, low } from '../util.js';
import { AXISCOL, WHITE } from '../render/colour.js';
import { PHI, SHAPES, tilt } from './polytopes.js';
import { HD_NAMES, LAD, axisHue, hdProjectAll } from './higher-dim.js';

// ---------- polyhedral prisms and pyramids: a 3D shape dragged along W, or coned to a point in W ----------
const POLY_BASE = {
  tet:['tetrahedron', [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]], 4],
  cube:['cube', [...Array(8)].map((_,i)=>[0,1,2].map(b=>(i>>b&1)?1:-1)), 6],
  oct:['octahedron', [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]], 8],
  ico:['icosahedron', (()=>{ const o=[]; for (const a of [1,-1]) for (const b of [PHI,-PHI]) o.push([0,a,b],[a,b,0],[b,0,a]); return o; })(), 20],
  dod:['dodecahedron', (()=>{ const o=[]; for (let i=0;i<8;i++) o.push([0,1,2].map(b=>(i>>b&1)?1:-1)); const q=1/PHI;
    for (const a of [1,-1]) for (const b of [1,-1]) o.push([0,a*q,b*PHI],[a*q,b*PHI,0],[b*PHI,0,a*q]); return o; })(), 12],
};
function liftShape(kind, base){
  const anL=s=>/^[aeiou]/i.test(s)?'an '+s:'a '+s;
  const [bn, raw, nf]=POLY_BASE[base], c3=[0,1,2].map(i=>raw.reduce((s,v)=>s+v[i],0)/raw.length);
  let P=raw.map(v=>v.map((x,i)=>x-c3[i]));
  let min=Infinity; for (let i=0;i<P.length;i++) for (let j=i+1;j<P.length;j++) min=Math.min(min, Math.hypot(...P[i].map((x,k)=>x-P[j][k])));
  P=P.map(v=>v.map(x=>x/min)); const R3=Math.max(...P.map(v=>Math.hypot(...v)));
  const BE=[]; for (let i=0;i<P.length;i++) for (let j=i+1;j<P.length;j++) if (Math.hypot(...P[i].map((x,k)=>x-P[j][k]))<1.001) BE.push([i,j]);
  const n=P.length; let V=[], E=[], up=[];
  if (kind==='prism'){ V=[...P.map(v=>[...v,-0.5]), ...P.map(v=>[...v,0.5])];
    BE.forEach(([i,j])=>{ E.push([i,j],[i+n,j+n]); up.push(0,0); }); for (let i=0;i<n;i++){ E.push([i,i+n]); up.push(1); } }
  else { const H = R3<1 ? Math.sqrt(1-R3*R3) : 0.9, wb=-H/(n+1);   // equal edges when the base fits inside a unit sphere
    V=[...P.map(v=>[...v,wb]), [0,0,0,wb+H]]; BE.forEach(e=>{ E.push(e); up.push(0); }); for (let i=0;i<n;i++){ E.push([i,n]); up.push(1); } }
  const S=Math.max(...V.map(v=>Math.hypot(...v))), T=kind==='prism'?0:0.33, fix=v=>tilt(v.map(x=>x/S),T);
  const nm=bn[0].toUpperCase()+bn.slice(1), adj={tetrahedron:'Tetrahedral',cube:'Cubic',octahedron:'Octahedral',dodecahedron:'Dodecahedral',icosahedron:'Icosahedral'}[bn];
  const cells = kind==='prism' ? 2+nf : 1+nf, side = kind==='prism' ? ({tetrahedron:'triangular',octahedron:'triangular',icosahedron:'triangular',dodecahedron:'pentagonal',cube:'square'}[bn])+' prisms' : ({dodecahedron:'pentagonal pyramids',cube:'square pyramids'}[bn]||'tetrahedra');
  return { name:`${adj} ${kind}`, alt: kind==='prism' ? `two ${bn}s joined by ${nf} ${side}` : `${anL(bn)} coned to a point: 1 ${bn} + ${nf} ${side}`, cells, tk:0.75,
    verts:V.map(fix), edges:E, lift:{kind, base, bn, n, P, up, S, T, nf, wb: kind==='prism' ? 0 : V[0][3]},
    info: kind==='prism'
      ? `Take ${anL(bn)} and drag it 1 unit along W, at right angles to all three of its directions. Every corner traces a new edge, every face traces a ${side.replace('s','')}: two ${bn}s (start and end) joined by ${nf} ${side}. The tesseract is the cubic prism. Watch Build up to see the drag.`
      : `Put ${anL(bn)} in our 3D space and pull a single point out of its middle along W, joining it to every corner. You get one ${bn} as the base plus ${nf} ${side}, one per face. The 5-cell is the tetrahedral pyramid.${R3<1?' Every edge here is the same length.':' A dodecahedron is too wide for equal edges, so the lines to the tip are longer than the base edges.'}` };
}
for (const b of ['tet','oct','dod','ico']) SHAPES['p'+b]=liftShape('prism', b);
for (const b of ['cube','oct','dod','ico']) SHAPES['y'+b]=liftShape('pyramid', b);
export function buildLift(sh){   // 3D base first, then drag it along W (prism) or pull a tip out of its middle (pyramid)
  const L=sh.lift, prism=L.kind==='prism', bn=L.bn, fix=v=>tilt(v.map(x=>x/L.S),L.T), E0=sh.edges.filter((_,i)=>!L.up[i]).length;
  const tipFrom = prism ? null : fix([0,0,0,sh.verts.length ? (L.wb ?? 0) : 0]);
  return { kind:'ladder', chips:['3D','4D'], stages:[{ext:0,hold:2},LAD], tk:1.1,
    names:[`3D: ${bn}`, `4D: ${low(sh.name)}`],
    caption:k=> k===0 ? `<b>3D: ${an(bn)}.</b> The starting shape, sitting in our ordinary 3D space.`
      : prism ? `<b>4D: the ${low(sh.name)}.</b> Drag the ${bn} along W, at right angles to X, Y and Z. Each corner traces an edge and each face traces a prism. Perspective draws the far copy smaller, inside the near one.`
      : `<b>4D: the ${low(sh.name)}.</b> Pull one point out of the middle of the ${bn} along W and join it to all ${L.n} corners. Each face of the ${bn} becomes the base of a ${bn==='cube'?'square pyramid':bn==='dodecahedron'?'pentagonal pyramid':'tetrahedron'}.`,
    stats:k=> k ? [sh.verts.length, sh.edges.length, sh.cells, 'corners','edges','cells'] : [L.n, prism?E0/2:E0, L.nf, 'corners','edges','faces'],
    frame:(k,e)=>{ const t=k===0?0:e;
      const V = prism ? sh.verts.map((_,i)=>fix([...L.P[i%L.n], (i<L.n?-0.5:0.5)*t]))
                      : sh.verts.map((v,i)=> i<L.n ? v : lerpN(tipFrom, v, t));
      return { O:sh.verts, V, edges:sh.edges, edgeMul:L.up.map(u=> u ? (t>0.002?1:0) : (prism && t<=0.002 && 0) || 1), edgeCol:i=>AXISCOL[L.up[i]?3:0], ballCol:WHITE,
        ballMul:sh.verts.map((_,i)=> prism ? (i<L.n || t>0.002 ? 1 : 0) : (i<L.n || t>0.002 ? 1 : 0)) }; } };
}
export function buildHyper(n){
  const sh=SHAPES.hcube, L=n>5 ? {ext:2.0, hold:1.4} : LAD;
  const cap=k=> k===0 ? '<b>0D: a point.</b> Nothing to connect yet.'
    : k===1 ? '<b>1D: a line.</b> Drag the point along direction 1: 2 corners, each with 1 connection.'
    : k===2 ? '<b>2D: a square.</b> Drag the line along direction 2, at right angles to the first: 4 corners, each with 2 connections.'
    : k===3 ? '<b>3D: a cube.</b> Drag the square along direction 3: 8 corners, each with 3 connections.'
    : `<b>${k}D: the ${HD_NAMES[k]}.</b> Drag the whole ${k-1}D cube along direction ${k}, at right angles to all ${k-1} others. Every corner gets a copy and one more connection: ${(1<<k).toLocaleString()} corners, each with ${k} connections, ${(k*(1<<(k-1))).toLocaleString()} lines.` + (k===n ? ` Even so, any corner is at most ${n} steps from any other.` : '');
  return { kind:'ladder', chips:[...Array(n+1)].map((_,k)=>k+'D'), stages:[{ext:0,hold:1.4}, ...Array(n).fill(L)], tk:sh.tk*1.3,
    names:[...Array(n+1)].map((_,k)=>`${k}D: ${HD_NAMES[k]}`), caption:cap,
    stats:k=>[1<<k, k*(1<<Math.max(0,k-1)), k<2?0:(k*(k-1)/2)*(1<<(k-2)), 'corners','edges','squares'],
    frame:(k,e)=>{ const mul=new Float32Array(sh.axis.length); for (let i=0;i<mul.length;i++){ const a=sh.axis[i]; mul[i] = a<k-1 ? 1 : a===k-1 ? (e>0.002?1:0) : 0; }
      return { O:sh.verts, V:hdProjectAll(sh, 0, k, e), edges:sh.edges, edgeMul:mul, edgeCol:i=>axisHue(sh.axis[i],n), ballCol:WHITE }; } };
}
