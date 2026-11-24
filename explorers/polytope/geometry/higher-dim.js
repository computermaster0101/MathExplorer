import { an } from '../util.js';
import { WHITE } from '../render/colour.js';
import { SHAPES } from './polytopes.js';
import { hsl } from './round.js';

// ---------- n-dimensional hypercube (4D to 10D): every corner has n connections, one per direction ----------
export const HD_NAMES=['point','line','square','cube','tesseract','penteract','hexeract','hepteract','octeract','enneract','dekeract','hendekeract','dodekeract','tridekeract','tetradekeract','pentadekeract','hexadekeract'];
const HD_PROJ={5:[2,1.3],6:[3,0.45],7:[2,0.6],8:[3,0.85],9:[2,0.3],10:[5,0.65],11:[2,0.15],12:[9,1.35],13:[2,0.15],14:[8,0.05],15:[4,0.05],16:[15,0.15]};   // chosen so no two corners land on the same spot
function hdDirs(n){ if (n===4) return [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]; const [m,ph]=HD_PROJ[n];
  return [...Array(n)].map((_,k)=>[Math.cos(Math.PI*k/n),Math.sin(Math.PI*k/n),Math.cos(Math.PI*k*m/n+ph),Math.sin(Math.PI*k*m/n+ph)]); }
const AXH={}; export const axisHue=(k,n)=>{ const key=n*100+k; return AXH[key] || (AXH[key]=hsl(k/n, 0.75, 0.6)); };
function makeHyper(n){
  const N=1<<n, VN=[], edges=[], axis=[];
  for (let i=0;i<N;i++) VN.push([...Array(n)].map((_,b)=>(i>>b&1)?0.5:-0.5));
  for (let i=0;i<N;i++) for (let b=0;b<n;b++){ const j=i^(1<<b); if (j>i){ edges.push([i,j]); axis.push(b); } }
  const U=hdDirs(n), projN=v=>[0,1,2,3].map(c=>v.reduce((s,x,k)=>s+x*U[k][c],0)), R=VN.reduce((m,v)=>Math.max(m,Math.hypot(...projN(v))),0);
  return { name:`${n}D hypercube`, alt:`the ${HD_NAMES[n]}: ${N} corners, ${n} connections each`, highD:true, noCurve:true, n, m:n, VN, axis, edges, fam:'cube', cousin4:'cube', cellWord:`${n-1}D cubes`,
    note:`${N.toLocaleString()} corners, ${n} connections each, any corner at most ${n} steps from any other.`,
    UF:Float64Array.from(U.flat().map(x=>x/R)), verts:VN.map(v=>projN(v).map(x=>x/R)), project:v=>projN(v).map(x=>x/R), cells:2*n, tk: n<=6?0.7:n<=8?0.5:n<=10?0.35:0.28, big:n>=15,
    info:`The ${n}-dimensional cube, the ${HD_NAMES[n]}: ${N.toLocaleString()} corners, and every corner has exactly ${n} connections, one along each of the ${n} directions, like a node with ${n} weights. Each extra dimension doubles the corners and gives every corner one more connection, yet any corner is at most ${n} steps from any other. Try Ping. The picture squashes ${n} directions into our 3D view, so some lines cross that don't really meet. With the spin on, it also turns through its higher dimensions.` };
}
// extra turn per plane, added while a seamless loop is made (each plane's angle must go round whole times, and a × (1 + 0.37 q)
// never does); cleared whenever the higher-dimension turn is reset
export const hdOff=[];
export function hdProjectAll(sh, a, k, e){   // every corner: optional turn through the higher dimensions (a), optional build stage (k, e), then squash to 4D
  const n=sh.m||sh.n, U=sh.UF, out=new Array(sh.VN.length), r=new Float64Array(n), half=Math.floor(n/2), cs=[], sn=[];
  const turn = !!a || (k==null && hdOff.length>0);
  for (let q=0;q<half;q++){ const t=a*(1+0.37*q)+(k==null ? hdOff[q]||0 : 0); cs.push(Math.cos(t)); sn.push(Math.sin(t)); }
  for (let idx=0; idx<sh.VN.length; idx++){ const v=sh.VN[idx];
    for (let d=0; d<n; d++) r[d] = k==null ? v[d] : (d<k-1 ? v[d] : d===k-1 ? v[d]*e : 0);
    if (turn) for (let q=0;q<half;q++){ const i=q, j=n-1-q, x=r[i], y=r[j]; r[i]=cs[q]*x-sn[q]*y; r[j]=sn[q]*x+cs[q]*y; }
    let p0=0,p1=0,p2=0,p3=0; for (let d=0, o=0; d<n; d++, o+=4){ const x=r[d]; p0+=x*U[o]; p1+=x*U[o+1]; p2+=x*U[o+2]; p3+=x*U[o+3]; }
    out[idx]=sh.offset ? [p0-sh.offset[0],p1-sh.offset[1],p2-sh.offset[2],p3-sh.offset[3]] : [p0,p1,p2,p3]; }
  return out; }
function hdRotate(v, a, n){ const r=v.slice();   // turn through pairs of the higher directions
  for (let k=0;k<Math.floor(n/2);k++){ const i=k, j=n-1-k, t=a*(1+0.37*k), c=Math.cos(t), s=Math.sin(t), x=r[i], y=r[j]; r[i]=c*x-s*y; r[j]=s*x+c*y; }
  return r; }
SHAPES.hcube = makeHyper(6);
// ---------- n-D simplex (every node joined to every other) and n-D cross-polytope (joined to all but its opposite) ----------
const SIMP_NAMES=['point','line segment','triangle','tetrahedron','5-cell'];
const CROSS_NAMES=['point','line segment','square','octahedron','16-cell'];
function hdFinish(m, VN, U, extra){   // squash m coordinates to 4D through the directions U, centred and scaled to radius 1
  const P=VN.map(v=>{ const o=[0,0,0,0]; for (let k=0;k<m;k++) if (v[k]) for (let c=0;c<4;c++) o[c]+=v[k]*U[k][c]; return o; });
  const C=[0,1,2,3].map(c=>P.reduce((s,p)=>s+p[c],0)/P.length), R=P.reduce((mx,p)=>Math.max(mx,Math.hypot(...p.map((x,c)=>x-C[c]))),0)||1;
  const UF=Float64Array.from(U.flat().map(x=>x/R)), proj=v=>{ const o=[0,0,0,0]; for (let k=0;k<m;k++) for (let c=0;c<4;c++) o[c]+=v[k]*U[k][c]/R; return o.map((x,c)=>x-C[c]/R); };
  return Object.assign({ highD:true, noCurve:true, m, VN, UF, offset:C.map(x=>x/R), verts:P.map(p=>p.map((x,c)=>(x-C[c])/R)), project:proj }, extra); }
function makeSimplexN(n){
  const m=n+1, VN=[], edges=[], axis=[];
  for (let i=0;i<m;i++){ const v=new Array(m).fill(0); v[i]=1; VN.push(v); }
  for (let j=1;j<m;j++) for (let i=0;i<j;i++){ edges.push([i,j]); axis.push(j-1); }
  const q=Math.max(2, Math.round(m/3)), U=[...Array(m)].map((_,k)=>{ const a=2*Math.PI*k/m; return [Math.cos(a),Math.sin(a),0.9*Math.cos(q*a+0.4),0.9*Math.sin(q*a+0.4)]; });
  return hdFinish(m, VN, U, { name:`${n}D simplex`, alt:`${m} nodes, every one joined to every other`, n, axis, edges, fam:'simp', cousin4:'tet', cells:m, cellWord:`${n-1}D simplices`,
    tk: m<=12?0.7:m<=24?0.45:0.3, note:`${m} corners, each joined to all ${n} others: ${edges.length.toLocaleString()} connections, and every corner is 1 step from every other.`,
    info:`The simplest shape in ${n} dimensions: ${m} corners, every one joined to every other. In network terms it's a fully connected layer: ${m} nodes and ${edges.length.toLocaleString()} weights. Add a dimension and you add one node joined to all the rest. Compare its connections with the hypercube's: here every node is one step from every other, so a Ping lights the whole thing in a single step.` }); }
function makeCrossN(n){
  const m=n, VN=[], edges=[], axis=[];
  for (let k=0;k<m;k++) for (const s of [1,-1]){ const v=new Array(m).fill(0); v[k]=s; VN.push(v); }
  for (let a=0;a<VN.length;a++) for (let b=a+1;b<VN.length;b++){ const pa=a>>1, pb=b>>1; if (pa!==pb){ edges.push([a,b]); axis.push(Math.max(pa,pb)); } }
  const q=Math.max(2, Math.round(m/3)+1), U=[...Array(m)].map((_,k)=>{ const a=Math.PI*k/m; return [Math.cos(a),Math.sin(a),0.9*Math.cos(q*a+0.3),0.9*Math.sin(q*a+0.3)]; });
  return hdFinish(m, VN, U, { name:`${n}D cross-polytope`, alt:`${2*m} nodes, each joined to all but its opposite`, n, axis, edges, fam:'cross', cousin4:'oct', cells:2**n, cellWord:`${n-1}D simplices`,
    tk: m<=8?0.7:m<=16?0.45:0.3, note:`${2*m} corners, each joined to ${2*m-2} others (all but its opposite), ${edges.length.toLocaleString()} connections, any corner at most 2 steps from any other.`,
    info:`The ${n}D version of the octahedron: one pair of corners on each of the ${n} axes, and every corner joined to everything except the corner straight across from it. That's ${2*m} nodes and ${edges.length.toLocaleString()} connections, nearly fully connected. It sits between the other two: the hypercube is sparse (${n} links per node), the simplex is complete, and this one is complete minus ${n} links. Any corner is at most 2 steps from any other.` }); }
export const HD_MAKE={hcube:makeHyper, hsimp:makeSimplexN, hcross:makeCrossN}, HD_MAX={hcube:16, hsimp:40, hcross:40}, HD_N={hcube:6, hsimp:8, hcross:6};
SHAPES.hsimp=makeSimplexN(8); SHAPES.hcross=makeCrossN(6);
function hdProjVecs(sh, vecs){ const m=sh.m, U=sh.UF, o=sh.offset||[0,0,0,0];
  return vecs.map(v=>{ let p0=0,p1=0,p2=0,p3=0; for (let d=0,k=0; d<m; d++, k+=4){ const x=v[d]; if (x){ p0+=x*U[k]; p1+=x*U[k+1]; p2+=x*U[k+2]; p3+=x*U[k+3]; } } return [p0-o[0],p1-o[1],p2-o[2],p3-o[3]]; }); }
export function buildSimplexN(sh){   // each step: a new corner rises out of the middle of the last shape and joins every corner
  const n=sh.n, m=sh.m, L=n>5 ? {ext:1.8, hold:1.3} : LAD, C=(a,b)=>{ let r=1; for (let i=0;i<b;i++) r=r*(a-i)/(i+1); return Math.round(r); };
  const nm=k=> k<SIMP_NAMES.length ? SIMP_NAMES[k] : `${k}D simplex`;
  return { kind:'ladder', chips:[...Array(n+1)].map((_,k)=>k+'D'), stages:[{ext:0,hold:1.4}, ...Array(n).fill(L)], tk:sh.tk*1.3,
    names:[...Array(n+1)].map((_,k)=>`${k}D: ${nm(k)}`),
    caption:k=> k===0 ? '<b>0D: a point.</b> One node, nothing to connect.' : `<b>${k}D: ${an(nm(k))}.</b> A new corner rises out of the middle of the ${nm(k-1)}, in a direction at right angles to everything so far, and joins all ${k} existing corners: ${k+1} corners, ${C(k+1,2)} connections.${k===n?' Every corner is now 1 step from every other.':''}`,
    stats:k=>[k+1, C(k+1,2), C(k+1,3), 'corners','edges','triangles'],
    frame:(k,e)=>{ const P=sh.VN.map(v=>v.slice()), cen=new Array(m).fill(0);
      for (let j=0;j<Math.min(k,m);j++) for (let d=0;d<m;d++) cen[d]+=sh.VN[j][d]/Math.max(1,k);
      for (let j=k;j<m;j++) for (let d=0;d<m;d++) P[j][d] = j===k ? cen[d]+(sh.VN[j][d]-cen[d])*e : cen[d];
      const mul=new Float32Array(sh.edges.length); sh.edges.forEach(([i,j],x)=>{ mul[x] = j<k ? 1 : j===k ? (e>0.002?1:0) : 0; });
      const bm=sh.VN.map((_,j)=> j<k || (j===k && e>0.002) || (k===0 && j===0) ? 1 : 0);
      return { O:sh.verts, V:hdProjVecs(sh,P), edges:sh.edges, edgeMul:mul, ballMul:bm, edgeCol:i=>axisHue(sh.axis[i],n), ballCol:WHITE }; } }; }
export function buildCrossN(sh){   // each step: a new pair of opposite corners pushes out from the centre and joins every existing corner
  const n=sh.n, L=n>5 ? {ext:1.8, hold:1.3} : LAD, nm=k=> k<CROSS_NAMES.length ? CROSS_NAMES[k] : `${k}D cross-polytope`;
  return { kind:'ladder', chips:[...Array(n+1)].map((_,k)=>k+'D'), stages:[{ext:0,hold:1.4}, ...Array(n).fill(L)], tk:sh.tk*1.3,
    names:[...Array(n+1)].map((_,k)=>`${k}D: ${nm(k)}`),
    caption:k=> k===0 ? '<b>0D: a point.</b> Just the centre.' : k===1 ? '<b>1D: a line segment.</b> Two corners push out along direction 1, one each way. In higher dimensions this pair of opposites is never joined directly.'
      : `<b>${k}D: ${an(nm(k))}.</b> Two new corners push out from the centre along direction ${k}, one each way, and each joins every corner already there: ${2*k} corners, ${2*k*(k-1)} connections.${k===n?' Any corner is at most 2 steps from any other.':''}`,
    stats:k=>[2*k, k<2?(k?1:0):2*k*(k-1), Math.round(4*k*(k-1)*(k-2)/3), 'corners','edges','triangles'],
    frame:(k,e)=>{ const mul=new Float32Array(sh.edges.length); for (let i=0;i<mul.length;i++){ const a=sh.axis[i]; mul[i] = a<k-1 ? 1 : a===k-1 ? (e>0.002?1:0) : 0; }
      const bm=sh.VN.map((_,j)=>{ const pr=j>>1; return pr<k-1 || (pr===k-1 && e>0.002) ? 1 : 0; });
      return { O:sh.verts, V:hdProjectAll(sh, 0, k, e), edges:sh.edges, edgeMul:mul, ballMul:bm, edgeCol:i=>axisHue(sh.axis[i],n), ballCol:WHITE }; } }; }
export const LAD0={ext:0, hold:1.6};
export const LAD={ext:2.6, hold:2.6};
