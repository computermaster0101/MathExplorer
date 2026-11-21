import { edgesWithin } from './common.js';
import { INFO, SHAPES, tilt } from './polytopes.js';

// ---------- round shapes (meshes drawn on curved surfaces, not built from flat cells) ----------
function roundHypersphere(d=3){   // nested Clifford tori joined by great-circle arcs, plus the two core circles
  const n=6+2*d, etas=[...Array(d)].map((_,i)=>Math.PI/2*(i+1)/(d+1)), V=[], E=[], F=[], add=p=>V.push(p)-1;
  const cx=[], cz=[];
  for (let i=0;i<n;i++){ const a=2*Math.PI*i/n; cx.push(add([Math.cos(a),Math.sin(a),0,0])); cz.push(add([0,0,Math.cos(a),Math.sin(a)])); }
  for (let i=0;i<n;i++) E.push([cx[i],cx[(i+1)%n]],[cz[i],cz[(i+1)%n]]);
  const T=etas.map(eta=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>{ const a=2*Math.PI*i/n, b=2*Math.PI*j/n;
    return add([Math.cos(eta)*Math.cos(a),Math.cos(eta)*Math.sin(a),Math.sin(eta)*Math.cos(b),Math.sin(eta)*Math.sin(b)]); })));
  T.forEach(g=>{ for (let i=0;i<n;i++) for (let j=0;j<n;j++){ const i2=(i+1)%n, j2=(j+1)%n;
    E.push([g[i][j],g[i2][j]],[g[i][j],g[i][j2]]); F.push([g[i][j],g[i2][j],g[i2][j2],g[i][j2]]); } });
  for (let i=0;i<n;i++) for (let j=0;j<n;j++){ E.push([cx[i],T[0][i][j]]); for (let q=0;q+1<T.length;q++) E.push([T[q][i][j],T[q+1][i][j]]); E.push([T[T.length-1][i][j],cz[j]]); }
  return {V,E,F};
}
function roundDuocylinder(d=3){   // the Clifford-torus ridge where the two solid tori meet, their core circles, and spokes
  const n=4*d+4, r=Math.SQRT1_2, V=[], E=[], F=[], add=p=>V.push(p)-1;
  const g=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>{ const a=2*Math.PI*i/n, b=2*Math.PI*j/n; return add([r*Math.cos(a),r*Math.sin(a),r*Math.cos(b),r*Math.sin(b)]); }));
  const ca=Array.from({length:n},(_,i)=>{ const a=2*Math.PI*i/n; return add([r*Math.cos(a),r*Math.sin(a),0,0]); });
  const cb=Array.from({length:n},(_,j)=>{ const b=2*Math.PI*j/n; return add([0,0,r*Math.cos(b),r*Math.sin(b)]); });
  for (let i=0;i<n;i++) for (let j=0;j<n;j++){ const i2=(i+1)%n, j2=(j+1)%n; E.push([g[i][j],g[i2][j]],[g[i][j],g[i][j2]]); F.push([g[i][j],g[i2][j],g[i2][j2],g[i][j2]]); }
  for (let i=0;i<n;i++){ E.push([ca[i],ca[(i+1)%n]],[cb[i],cb[(i+1)%n]]); }
  for (let i=0;i<n;i++) for (let j=0;j<n;j+=4){ E.push([g[i][j],ca[i]]); E.push([g[j][i],cb[i]]); }
  return {V,E,F};
}
function roundHopf(d=3){   // whole circles on the 3-sphere, one for each point of a few rings on an ordinary sphere
  const nr=2*d-1, rings=[...Array(nr)].map((_,i)=>{ const th=Math.PI*(i+1)/(nr+1); return [th, Math.max(3, Math.round(4*d*Math.sin(th)))]; }), m=32, V=[], E=[], fiber=[], info=[];
  rings.forEach(([th,k],ri)=>{ for (let q=0;q<k;q++){ const ph=2*Math.PI*q/k+ri*0.35, fi=info.length, base=V.length; info.push({ri,th,ph});
    for (let s=0;s<m;s++){ const t=2*Math.PI*s/m; V.push([Math.cos(th/2)*Math.cos(t),Math.cos(th/2)*Math.sin(t),Math.sin(th/2)*Math.cos(t+ph),Math.sin(th/2)*Math.sin(t+ph)]); }
    for (let s=0;s<m;s++){ E.push([base+s, base+(s+1)%m]); fiber.push(fi); } } });
  return {V,E,F:[],fiber,info,rings:rings.length};
}
export const hsl=(h,s,l)=>{ const k=n=>(n+h*12)%12, a=s*Math.min(l,1-l); return [0,8,4].map(n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1))); };
function roundSpherinder(d=3){   // a sphere dragged along W: two spheres joined by straight lines
  const nLa=d+3, nLo=4*d+4, r=0.8, h=0.5, V=[], E=[], F=[], add=p=>V.push(p)-1, G=[];
  for (const w of [-h,h]){ const g=[]; for (let i=0;i<nLa;i++){ const la=-Math.PI/2+Math.PI*(i+1)/(nLa+1), row=[];
    for (let j=0;j<nLo;j++){ const lo=2*Math.PI*j/nLo; row.push(add([r*Math.cos(la)*Math.cos(lo), r*Math.cos(la)*Math.sin(lo), r*Math.sin(la), w])); } g.push(row); }
    g.S=add([0,0,-r,w]); g.N=add([0,0,r,w]); G.push(g); }
  for (const g of G){ for (let i=0;i<nLa;i++) for (let j=0;j<nLo;j++){ E.push([g[i][j],g[i][(j+1)%nLo]]); if (i+1<nLa) E.push([g[i][j],g[i+1][j]]); }
    for (let j=0;j<nLo;j++) E.push([g.S,g[0][j]],[g[nLa-1][j],g.N]); }
  for (let i=0;i<nLa;i++) for (let j=0;j<nLo;j++) E.push([G[0][i][j],G[1][i][j]]);
  E.push([G[0].S,G[1].S],[G[0].N,G[1].N]);
  const up=(a,b)=>F.push([a(G[0]),b(G[0]),b(G[1]),a(G[1])]);   // every line on the sphere, dragged along W, is a face
  for (let i=0;i<nLa;i++) for (let j=0;j<nLo;j++){ up(g=>g[i][j], g=>g[i][(j+1)%nLo]); if (i+1<nLa) up(g=>g[i][j], g=>g[i+1][j]); }
  for (let j=0;j<nLo;j++){ up(g=>g.S, g=>g[0][j]); up(g=>g[nLa-1][j], g=>g.N); }
  return {V,E,F};
}
function roundCubinder(d=3){   // a circle times a square: four circles, one at each corner of the square, joined across
  const n=4*d+8, r=0.7, s=0.5, V=[], E=[], F=[], add=p=>V.push(p)-1, sq=[[s,s],[-s,s],[-s,-s],[s,-s]];
  const g=sq.map(([z,w])=>Array.from({length:n},(_,i)=>{ const a=2*Math.PI*i/n; return add([r*Math.cos(a), r*Math.sin(a), z, w]); }));
  for (let c=0;c<4;c++){ const c2=(c+1)%4; for (let i=0;i<n;i++){ const i2=(i+1)%n; E.push([g[c][i],g[c][i2]],[g[c][i],g[c2][i]]); F.push([g[c][i],g[c][i2],g[c2][i2],g[c2][i]]); } }
  return {V,E,F};
}
function roundTiger(d=3){   // a torus of tori: three circles, one inside another
  const na=2*d+6, nc=d+3, R=0.62, r=0.3, V=[], E=[], F=[];
  const id=(a,b,c)=>((a%na)*na+(b%na))*nc+(c%nc);
  for (let a=0;a<na;a++) for (let b=0;b<na;b++) for (let c=0;c<nc;c++){ const A=2*Math.PI*a/na, B=2*Math.PI*b/na, C=2*Math.PI*c/nc, p=R+r*Math.cos(C), q=R+r*Math.sin(C);
    V.push([p*Math.cos(A), p*Math.sin(A), q*Math.cos(B), q*Math.sin(B)]); }
  const S=Math.max(...V.map(v=>Math.hypot(...v))); for (const v of V) for (let i=0;i<4;i++) v[i]/=S;
  for (let a=0;a<na;a++) for (let b=0;b<na;b++) for (let c=0;c<nc;c++){ const o=id(a,b,c);
    E.push([o,id(a+1,b,c)],[o,id(a,b+1,c)],[o,id(a,b,c+1)]); F.push([o,id(a+1,b,c),id(a+1,b,c+1),id(a,b,c+1)],[o,id(a,b+1,c),id(a,b+1,c+1),id(a,b,c+1)]); }
  return {V,E,F};
}
function makeRound(key, name, alt, build, opts, d=3){
  const m=build(d); const V=m.V.map(v=>tilt(v,0.21));

  const sh=Object.assign({ name, alt, round:true, cells:'—', verts:V, edges:m.E, tk:0.45, ballScale:0.5 }, opts);
  sh._cells=[]; sh._cellEdges=[]; sh._faces=m.F; sh._faceEdges=edgesWithin(m.F, m.E, V.length);
  if (m.fiber){ sh.fiber=m.fiber; sh.fiberInfo=m.info; sh.nRings=m.rings; }
  sh.remake=dd=>{ const old=SHAPES[key]; makeRound(key, name, alt, build, opts, dd); Object.assign(SHAPES[key], {info:old.info, edgeColor:old.edgeColor, detail:dd}); };
  sh.detail=d; SHAPES[key]=sh;
}
makeRound('sph4','Hypersphere','the 3-sphere, or glome: the surface of a 4D ball', roundHypersphere, {tk:0.42,
  sliceCap:400, sliceAnalytic:h=>{ const r=Math.sqrt(Math.max(0,1-h*h)); if (r<1e-3) return null;   // a slice of the 3-sphere is an ordinary sphere
    const segs=[], P=(la,lo)=>[r*Math.cos(la)*Math.cos(lo), r*Math.cos(la)*Math.sin(lo), r*Math.sin(la)], nLa=8, nLo=20;
    for (let i=1;i<nLa;i++){ const la=-Math.PI/2+Math.PI*i/nLa; for (let j=0;j<nLo;j++) segs.push([P(la,2*Math.PI*j/nLo), P(la,2*Math.PI*(j+1)/nLo)]); }
    for (let j=0;j<nLo;j+=2) for (let i=0;i<nLa;i++) segs.push([P(-Math.PI/2+Math.PI*i/nLa,2*Math.PI*j/nLo), P(-Math.PI/2+Math.PI*(i+1)/nLa,2*Math.PI*j/nLo)]);
    return {segs, r}; }});
makeRound('duocyl','Duocylinder','a circle × a circle: two solid doughnuts glued together', roundDuocylinder, {noCurve:true, tk:0.5});
makeRound('hopf','Hopf fibration','the 3-sphere filled with linked circles', roundHopf, {tk:0.42, ballScale:0});
makeRound('spherinder','Spherinder','a sphere × a line: two spheres joined by straight lines', roundSpherinder, {noCurve:true, tk:0.45});
makeRound('cubinder','Cubinder','a circle × a square: four circles in a square', roundCubinder, {noCurve:true, tk:0.5});
makeRound('tiger','Tiger (4D torus)','a torus of tori: three circles nested in each other', roundTiger, {noCurve:true, tk:0.4, ballScale:0.35});
SHAPES.hopf.edgeColor = i=>{ const f=SHAPES.hopf.fiberInfo[SHAPES.hopf.fiber[i]]; return hsl((f.ph/(2*Math.PI)+1)%1, 0.78, 0.38+0.32*(f.ri/(SHAPES.hopf.nRings-1))); };
Object.assign(INFO, {
  sph4:'The 4D ball\'s surface: the 3-sphere, also called the glome. Every point is the same distance from the centre. It\'s drawn here as three nested doughnut-shaped tori joined by great-circle arcs, plus two core circles that link through each other. Slice it and you get an ordinary sphere that swells and shrinks, like a balloon passing through a flat world.',
  duocyl:'A circle times a circle: the perfectly round version of a duoprism. Its surface is two solid doughnuts glued together along a flat torus, the Clifford torus, drawn here as the grid. The two loops through the middle are the doughnuts\' core circles, and the spokes run from the grid to them.',
  hopf:'The whole 3-sphere filled with circles, no two touching, and every circle linked through every other one like the links of a chain. Each colour is one circle, and circles of the same brightness lie on the same doughnut. Found by Heinz Hopf in 1931. The circles are all separate, so a ping can only travel around the one it starts on.',
});
Object.assign(INFO, {
  spherinder:'A sphere dragged along W: the round version of a prism. Two spheres, one at each end, joined by straight lines along W, like a cylinder one dimension up. Slice it across W and you get a sphere that stays the same size the whole way through, then vanishes.',
  cubinder:'A circle times a square, or a cylinder dragged along W. Think of four circles, one at each corner of a square, with every point joined to the matching point on the next circle. Halfway between a duocylinder (circle × circle) and a tesseract (square × square).',
  tiger:'A torus whose tube is itself a torus: three circles nested inside each other. It\'s one of four shapes that could be called a 4D doughnut, and it\'s named after its stripes. Slice it and you get two or four separate rings, depending on where the knife falls.',
});
for (const k of ['sph4','duocyl','hopf','spherinder','cubinder','tiger']) SHAPES[k].info=INFO[k];

// ---------- Apollonian packing on the 3-sphere ----------
// Five balls on the 3-sphere (caps), centred on the corners of a 5-cell and just big enough that each touches the other four.
// Every gap is then filled with the biggest ball that fits, round after round. A ball is kept as five numbers,
// x = (centre, cos r) / sin r, where r is its angular radius: two balls touch exactly when x·y (with the last term
// subtracted) is −1. In those numbers the ball that fills the gap left by ball i of five touching balls is simply
// (the sum of the other four) − x_i. Stereographic projection turns every ball on the 3-sphere into a round ball in 3D, and
// the one holding the projection point turns inside out into the container round all the others (see render/packing.js).
function packing(gens){
  const a=Math.acos(-0.25)/2, sa=Math.sin(a), ca=Math.cos(a), t=Math.sqrt(15)/4/Math.sqrt(3);
  const C=[[0,0,0,1], ...[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(v=>[v[0]*t, v[1]*t, v[2]*t, -0.25])];   // a 5-cell, one corner at the pole
  const X=C.map(n=>[...n.map(v=>v/sa), ca/sa]), gen=[0,0,0,0,0], E=[], seenE=new Set(), at=new Map();
  const key=x=>x.map(v=>Math.round(v*1e6)).join();   // in 3D the same ball can be reached by two routes: keep one copy
  X.forEach((x,i)=>at.set(key(x),i));
  const edge=(i,j)=>{ const k=i<j?i+'_'+j:j+'_'+i; if (!seenE.has(k)){ seenE.add(k); E.push([i,j]); } };
  for (let i=0;i<5;i++) for (let j=i+1;j<5;j++) edge(i,j);
  const grow=(cfg, skip, g)=>{ for (let i=0;i<5;i++){ if (i===skip) continue;
    const x=[0,1,2,3,4].map(k=>cfg.reduce((s,b,j)=>j===i ? s : s+X[b][k], 0)-X[cfg[i]][k]), kx=key(x);
    let id=at.get(kx); if (id===undefined){ id=X.push(x)-1; gen.push(g); at.set(kx,id); }
    for (let j=0;j<5;j++) if (j!==i) edge(cfg[j], id);
    if (g<gens){ const nc=cfg.slice(); nc[i]=id; grow(nc, i, g+1); } } };
  if (gens>0) grow([0,1,2,3,4], -1, 1);
  const caps=X.map((x,i)=>{ const L=Math.hypot(x[0],x[1],x[2],x[3]); return { n:[x[0]/L,x[1]/L,x[2]/L,x[3]/L], c:x[4]/L, s:1/L, gen:gen[i] }; });
  return { V:caps.map(q=>q.n), E, caps, gens };
}
function makePacking(d){
  const m=packing(d), sh={ name:'Apollonian packing', alt:'balls in every gap between balls, on the 3-sphere', round:true, packing:true, cells:'—',
    verts:m.V, edges:m.E, caps:m.caps, gens:m.gens, tk:0.6, ballScale:0.6, detail:d };
  sh._cells=[]; sh._cellEdges=[]; sh._faces=[]; sh._faceEdges=[];
  sh.remake=dd=>{ const old=SHAPES.apack; makePacking(dd); Object.assign(SHAPES.apack, {info:old.info}); };
  SHAPES.apack=sh;
}
makePacking(3);
INFO.apack='Five balls on the 3-sphere, centred on the corners of a 5-cell, each just touching the other four (so the touching points join up exactly like the 5-cell\'s edges). Every gap is then filled with the biggest ball that fits, and the new gaps filled again, forever. Seen through stereographic projection every ball stays perfectly round, and the ball holding the projection point turns inside out into the container round all the others: the classic Apollonian packing, a ball full of balls. Turn it in 4D and a different ball swells to become the container while the old one shrinks inside. In between, where the projection point passes a touching point, the two balls there become flat walls: the slab of Apollonian foam. It\'s the same packing every time, seen from a different point of the 3-sphere.';
SHAPES.apack.info=INFO.apack;
