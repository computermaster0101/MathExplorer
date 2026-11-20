import { $, an, lerpN, low } from '../util.js';
import { st } from '../state.js';
import { AXISCOL, WHITE, wColor } from '../render/colour.js';
import { cellAdjacency, cellName, gon, shapeCtx, smooth, subN, topo } from '../geometry/common.js';
import { SHAPES } from '../geometry/polytopes.js';
import { LAD, LAD0, buildCrossN, buildSimplexN } from '../geometry/higher-dim.js';
import { buildHyper, buildLift } from '../geometry/prisms.js';
import { mulM, planeRot, project } from '../math/rotate4d.js';

// ---------- what to draw, per mode ----------
// ---------- Build up: how each shape is put together ----------

export const centroid = P => P[0].map((_,i)=>P.reduce((s,p)=>s+p[i],0)/P.length);
const plural = s => s.endsWith('hedron') ? s.slice(0,-2)+'a' : s+'s';

   // name used mid-sentence

export function cellSummary(sh, key){
  if (sh._summary) return sh._summary; topo(sh); const cnt={};
  sh._cells.forEach((c,i)=>{ const n=cellName(key, c.length, sh._cellEdges[i].length, sh, i); cnt[n]=(cnt[n]||0)+1; });
  const parts=Object.entries(cnt).map(([n,c])=>`${c} ${c===1?n:plural(n)}`);
  return sh._summary = parts.length>1 ? parts.slice(0,-1).join(', ')+' and '+parts[parts.length-1] : parts[0];
}
// which cells share a face (each face belongs to exactly two cells)


const EXTRUDE_CAP = [
  '<b>0D: a point.</b> No length, width or height. There is nowhere for it to move.',
  '<b>1D: a line.</b> Drag the point along X (red) and it traces a line: 2 corners, 1 edge.',
  '<b>2D: a square.</b> Drag the line along Y (green), a new direction at right angles to X: 4 corners, 4 edges.',
  '<b>3D: a cube.</b> Drag the square along Z (blue), at right angles to X and Y: 8 corners, 12 edges, 6 square faces.',
  '<b>4D: a tesseract.</b> Drag the cube along W (violet), at right angles to X, Y and Z. Perspective draws the far copy smaller, so it sits inside the near one: 16 corners, 32 edges, 8 cubes.',
];
const PYRAMID_CAP = [
  '<b>0D: a point.</b>',
  '<b>1D: a line.</b> Pull a second point away from the first.',
  '<b>2D: a triangle.</b> Pull a new point out of the middle of the line, at right angles to it, until it is as far from both ends as they are from each other.',
  '<b>3D: a tetrahedron.</b> Pull a point up out of the middle of the triangle, at right angles to it: a triangular pyramid.',
  '<b>4D: a 5-cell.</b> Pull a fifth point out of the middle of the tetrahedron along W, at right angles to all three directions: a pyramid whose base is a tetrahedron. Every corner is joined to every other: 5 corners, 10 edges, 10 triangles, 5 tetrahedra.',
];
const BIPYR_CAP = [
  '<b>0D: a point.</b>',
  '<b>1D: a line.</b> Push two points apart along X, one each way.',
  '<b>2D: a square</b> (standing on a corner). Push a new pair out of the middle along Y and join each to both ends. The old line is now a diagonal inside, not an edge.',
  '<b>3D: an octahedron.</b> Push a pair out along Z and join each to all four corners: two square pyramids base to base.',
  '<b>4D: a 16-cell.</b> Push a pair out along W and join each to all six corners: two octahedral pyramids, base to base. Every corner is joined to every other except its opposite: 8 corners, 24 edges, 32 triangles, 16 tetrahedra.',
];
function buildExtrude(){
  const T=shapeCtx(SHAPES[8]), fam=T.fam;
  return { kind:'ladder', chips:['0D','1D','2D','3D','4D'], stages:[LAD0,LAD,LAD,LAD,LAD], tk:1.25,
    names:['0D: point','1D: line','2D: square','3D: cube','4D: tesseract'], caption:k=>EXTRUDE_CAP[k],
    stats:k=>[[1,0,0],[2,1,0],[4,4,1],[8,12,6],[16,32,24]][k].concat(['corners','edges','squares']),
    frame:(k,e)=>({ O:T.verts, V:T.verts.map(v=>v.map((x,a)=> a<k-1 ? x : a===k-1 ? x*e : 0)), edges:T.edges,
      edgeMul:fam.map(a=> a<k-1 ? 1 : a===k-1 ? (e>0.002?1:0) : 0), edgeCol:i=>AXISCOL[fam[i]], ballCol:WHITE }) };
}
// a regular 5-cell built point by point, so its first 2, 3 and 4 corners are a line, triangle and tetrahedron
const P5 = (() => { const P=[[0,0,0,0]];
  for (let k=1;k<5;k++){ const c=centroid(P), r=Math.hypot(...subN(c,P[0])), v=c.slice(); v[k-1]=Math.sqrt(1-r*r); P.push(v); }
  const c=centroid(P), Q=P.map(p=>subN(p,c)), R=Math.max(...Q.map(q=>Math.hypot(...q))); return Q.map(q=>q.map(x=>x/R)); })();
function buildPyramid(){
  const V0=P5, edges=[]; for (let i=0;i<5;i++) for (let j=i+1;j<5;j++) edges.push([i,j]);
  return { kind:'ladder', chips:['0D','1D','2D','3D','4D'], stages:[LAD0,LAD,LAD,LAD,LAD], tk:1.25,
    names:['0D: point','1D: line','2D: triangle','3D: tetrahedron','4D: 5-cell'], caption:k=>PYRAMID_CAP[k],
    stats:k=>[[1,0,0],[2,1,0],[3,3,1],[4,6,4],[5,10,10]][k].concat(['corners','edges','triangles']),
    frame:(k,e)=>{
      const base = k>0 ? centroid(V0.slice(0,k)) : V0[0];
      const V=V0.map((v,i)=> i<k ? v : i===k ? (k===0 ? v : lerpN(base, v, e)) : base);
      return { O:V0, V, edges, edgeMul:edges.map(([i,j])=> k>0 && j<=k ? 1 : 0), edgeCol:n=>AXISCOL[edges[n][1]-1],
        ballMul:V0.map((_,i)=> i<=k ? 1 : 0), ballCol:WHITE }; } };
}
function buildBipyramid(){
  const V0=[]; for (let a=0;a<4;a++) for (const s of [1,-1]){ const v=[0,0,0,0]; v[a]=s*0.9; V0.push(v); }
  const ax=i=>i>>1, edges=[[0,1]];
  for (let i=0;i<8;i++) for (let j=i+1;j<8;j++) if (ax(i)!==ax(j)) edges.push([i,j]);
  return { kind:'ladder', chips:['0D','1D','2D','3D','4D'], stages:[LAD0,LAD,LAD,LAD,LAD], tk:1.25,
    names:['0D: point','1D: line','2D: square','3D: octahedron','4D: 16-cell'], caption:k=>BIPYR_CAP[k],
    stats:k=>[[1,0,0],[2,1,0],[4,4,1],[6,12,8],[8,24,32]][k].concat(['corners','edges','faces']),
    frame:(k,e)=>({ O:V0, edges, ballCol:WHITE,
      V:V0.map((v,i)=> ax(i)<k-1 ? v : ax(i)===k-1 ? v.map(x=>x*e) : [0,0,0,0]),
      edgeMul:edges.map(([i,j],n)=> n===0 ? (k===1?1:0) : (Math.max(ax(i),ax(j))<k ? 1 : 0)),
      edgeCol:n=>AXISCOL[n===0 ? 0 : Math.max(ax(edges[n][0]),ax(edges[n][1]))],
      ballMul:V0.map((_,i)=> k===0 ? (i===0?1:0) : (ax(i)<k ? 1 : 0)) }) };
}
function buildProduct(p, q){
  const k1=1/Math.sin(Math.PI/p), k2=1/Math.sin(Math.PI/q), L=Math.hypot(k1,k2), r1=k1/L, r2=k2/L;
  const A=i=>(i+0.5)*2*Math.PI/p, B=j=>(j+0.25)*2*Math.PI/q;
  const pos=(i,b)=>[r1*Math.cos(A(i)), r1*Math.sin(A(i)), r2*Math.cos(b), r2*Math.sin(b)];
  const V0=[], edges=[], kind=[];
  for (let i=0;i<p;i++) for (let j=0;j<q;j++){
    V0.push(pos(i,B(j)));
    edges.push([i*q+j, ((i+1)%p)*q+j]); kind.push([0,i,j]);    // around the polygon
    edges.push([i*q+j, i*q+(j+1)%q]);   kind.push([1,i,j]);    // swept from copy j to copy j+1
  }
  const P=gon(p), Q=gon(q);
  return { kind:'ladder', chips:['0D','2D','3D','4D'], stages:[LAD0, LAD, LAD, {ext:0.9*(q-1)+0.6, hold:2.6}], tk:1.1,
    names:['0D: point', `2D: ${P}`, `3D: ${P} prism`, `4D: ${p}-${q} duoprism`],
    caption:k=>[ '<b>0D: a point.</b>',
      `<b>2D: ${an(P)}.</b> Trace ${p} equal edges around a circle in the XY plane.`,
      `<b>3D: ${an(P)} prism.</b> Slide a copy of the ${P} along a curved path in the ZW plane, at right angles to it. Each corner's path becomes a new edge.`,
      `<b>4D: ${an(p+'-'+q)} duoprism.</b> Keep sliding round the ZW circle, leaving a copy at each corner of ${an(Q)}, until it comes back to the start. The ${q} prisms join up into a ring, which is only possible in 4D.` ][k],
    stats:k=>[[1,0,0],[p,p,1],[2*p,3*p,p+2],[p*q,2*p*q,p*q+p+q]][k].concat(['corners','edges','faces']),
    frame:(k,e)=>{
      const ang=new Array(q).fill(null); let closeG=0;
      if (k>=1) ang[0]=B(0);
      if (k===2) ang[1]=B(0)+(B(1)-B(0))*e;
      if (k>=3){ ang[1]=B(1); const ep=e*(q-1);
        for (let j=2;j<q;j++) if (ep>j-2) ang[j]=B(j-1)+(B(j)-B(j-1))*Math.min(1,ep-(j-2));
        closeG=Math.max(0,Math.min(1,ep-(q-2))); }
      const V=V0.map((_,n)=>{ const i=Math.floor(n/q), j=n%q; return ang[j]==null ? pos(0,B(0)) : pos(i,ang[j]); });
      const ballMul=V0.map((_,n)=>{ const i=Math.floor(n/q), j=n%q; if (k===0) return n===0?1:0; if (ang[j]==null) return 0; return (k>1 || e*p>=i) ? 1 : 0; });
      const grow=edges.map((_,n)=>{ const [t,i,j]=kind[n]; if (k===0) return 0;
        if (t===0) return ang[j]==null ? 0 : (k===1 ? Math.max(0,Math.min(1,e*p-i)) : 1);
        const j2=(j+1)%q; if (j2===0) return k>=3 ? closeG : 0; return ang[j2]==null ? 0 : 1; });
      return { O:V0, V, edges, grow, edgeMul:grow.map(g=>g>0?1:0), ballMul, ballCol:WHITE,
        edgeCol:n=> kind[n][0]===0 ? AXISCOL[0] : (kind[n][2]===0 ? AXISCOL[2] : AXISCOL[3]) }; } };
}
function buildParts(key){
  const sh=topo(shapeCtx(SHAPES[key])), cells=sh._cells, N=cells.length, adj=cellAdjacency(sh);
  const cen=cells.map(c=>centroid(c.map(i=>sh.verts[i])));
  let root=0; cen.forEach((c,i)=>{ if (c[3]<cen[root][3]) root=i; });               // start from the innermost cell
  const order=[root], seen=new Set([root]);
  for (let h=0;h<order.length;h++) for (const nb of adj[order[h]]) if (!seen.has(nb)){ seen.add(nb); order.push(nb); }
  const rank=new Array(N); order.forEach((c,i)=>rank[c]=i);
  const birth=new Array(sh.edges.length).fill(N); sh._cellEdges.forEach((es,c)=>es.forEach(e=>{ if (rank[c]<birth[e]) birth[e]=rank[c]; }));
  const ext=Math.max(4, Math.min(11, N*0.4)), gd=Math.min(0.6, ext/3), step=(ext-gd)/Math.max(1,N-1);
  const placed=x=>Math.min(N, Math.floor(x*ext/step+1e-9)+1), summary=cellSummary(sh,key);
  return { kind:'parts', chips:['Corners','Cells','Closed'], stages:[{ext:1.4,hold:0.6},{ext,hold:0.8},{ext:0,hold:2}], tk:sh.tk||1,
    names:['corners','gluing on cells','closed up'],
    caption:(k,e,x)=> k===0 ? `<b>Corners.</b> Start with all ${sh.verts.length} corners of the ${low(sh.name)}, floating in 4D.`
      : k===1 ? `<b>Cells: ${placed(x)} of ${N}.</b> Glue on the 3D cells one at a time, face to face (${summary}). In 3D, polygons glued edge to edge curl round and close into a solid. In 4D, cells curl round through the 4th dimension and close up the same way.`
      : `<b>Closed.</b> All ${N} cells fit together with no gaps, and every face is shared by exactly two cells.`,
    stats:(k,e,x)=> k===0 ? [sh.verts.length,0,0,'corners','edges','cells']
      : k===1 ? [sh.verts.length, birth.filter(b=>x*ext>=b*step).length, placed(x),'corners','edges','cells']
      : [sh.verts.length, sh.edges.length, N,'corners','edges','cells'],
    frame:(k,e,x)=>{ const tl=x*ext;
      const grow = k===0 ? birth.map(()=>0) : k===1 ? birth.map(b=>Math.max(0,Math.min(1,(tl-b*step)/gd))) : birth.map(()=>1);
      return { O:sh.verts, V:sh.verts, edges:sh.edges, grow, edgeMul:grow.map(g=> g<=0 ? 0 : 1+0.9*(1-g)),
        edgeCol:n=>wColor(-1+2*birth[n]/Math.max(1,N-1)), ballMul:sh.verts.map(()=> k===0 ? smooth(Math.min(1,x*1.2)) : 1), ballCol:()=>[0.93,0.94,0.98] }; } };
}
function makeBuild(key){
  if (key==8) return buildExtrude();
  if (key==5) return buildPyramid();
  if (key==16) return buildBipyramid();
  if (key==='d') return buildProduct(+$('dp').value, +$('dq').value);
  if (key==='hcube') return buildHyper(SHAPES.hcube.n);
  if (key==='hsimp') return buildSimplexN(SHAPES.hsimp);
  if (SHAPES[key] && SHAPES[key].lift) return buildLift(SHAPES[key]);
  if (key==='hcross') return buildCrossN(SHAPES.hcross);
  return buildParts(key);
}
let buildCache={key:null};
export function getBuild(){
  const key = st.shape==='d' ? `d${$('dp').value}x${$('dq').value}` : SHAPES[st.shape].highD ? st.shape+SHAPES[st.shape].n : SHAPES[st.shape].ver ? st.shape+SHAPES[st.shape].ver : String(st.shape);
  if (buildCache.key!==key){
    const b=makeBuild(String(st.shape)); b.total=b.stages.reduce((s,x)=>s+x.ext+x.hold,0);
    const last=b.stages.length-1, f=b.frame(last,1,1);
    b.fitR=Math.max(0.3, ...f.V.map(v=>{ const p=project(v,'persp'); return Math.hypot(p[0],p[1],p[2]); }))*1.08;
    buildCache={key, b}; $('buildStages').innerHTML=b.chips.map((c,i)=>`<button data-k="${i}">${c}</button>`).join('');
  }
  return buildCache.b;
}
export function stageStart(b,k){ let s=0; for (let i=0;i<k;i++) s+=b.stages[i].ext+b.stages[i].hold; return s; }
export function buildStage(b, t){
  if (t>=b.total) return {k:b.stages.length-1, x:1, e:1, after:t-b.total};
  let acc=0;
  for (let k=0;k<b.stages.length;k++){ const s=b.stages[k], d=s.ext+s.hold;
    if (t<acc+d){ const x = s.ext>0 ? Math.min(1,Math.max(0,(t-acc)/s.ext)) : 1; return {k, x, e:smooth(x), after:0}; }
    acc+=d; }
  return {k:b.stages.length-1, x:1, e:1, after:0};
}
export function buildSource(){
  const b=getBuild(), s=buildStage(b, st.build.t), f=b.frame(s.k, s.e, s.x);
  let V=f.V;
  if (s.after>0){ const M=planeRot(4,[[0,3,16*s.after],[2,3,10*s.after]]); V=V.map(v=>mulM(M,v)); }   // finished: spin it in 4D
  return Object.assign({ fam:f.edges.map(()=>-1), amax:[1,1,1,1], wmax:1, tk:b.tk, proj:'persp', curved:false }, f, {V});
}
