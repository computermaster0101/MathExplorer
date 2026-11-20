import { shared } from '../shared.js';
import { $, an, low } from '../util.js';
import { st } from '../state.js';
import { AXISCOL, PALETTES, css, wColor } from '../render/colour.js';
import { binom, cellName, topo } from '../geometry/common.js';
import { SHAPES } from '../geometry/polytopes.js';
import { axisHue } from '../geometry/higher-dim.js';
import { facePolys } from '../geometry/faces.js';
import { symbolFor } from '../geometry/schlafli.js';
import { pivot } from '../render/scene.js';
import { buildStage, cellSummary, getBuild } from '../modes/build.js';
import { flatData, unfoldData } from '../modes/unfold.js';
import { echoAlpha, pingData, pingPhase, sliceInfo } from '../modes/ping.js';
import { sliceFaces } from '../panels/extra-panels.js';

// ---------- text ----------
const ABOUT = {
  build:'<strong>Build up.</strong> Some 4D shapes can be built one dimension at a time, each step adding a direction at right angles to all the others: the tesseract by dragging (a cube swept along W), the 5-cell by pulling out a point (a pyramid on a tetrahedron), the 16-cell by pushing out a pair of points (a double pyramid on an octahedron), and duoprisms by sweeping a polygon round a circle. Edges are coloured by the step that made them: red, green, blue, then violet for the 4th dimension.',
  parts:'<strong>Build up.</strong> This shape can\'t be made just by dragging or pulling a 3D shape, so it is built from its parts instead: first its corners, then its 3D cells glued on one at a time, face to face. Colours run from the first cell to the last. Watch the cells wrap round and close up on themselves in 4D, the way the patches of a soccer ball close up into a sphere in 3D.',
  unfold:'<strong>Unfold.</strong> A cube can be cut along some of its edges and opened into a flat net of 6 squares. Any 4D shape can be cut along some of its faces and opened into a net of 3D cells in ordinary space. Each cell swings around the face it shares with its neighbour, turning through the 4th dimension. Colours run from the centre cell outward, in the order the cells are attached. The tesseract\'s net, 8 cubes in a cross, is the one Salvador Dalí painted in <em>Crucifixion (Corpus Hypercubus)</em>, 1954. Then keep going to 2D: past the middle of the slider, every cell opens into its own flat net of polygons and they all lie down on one floor. That last step pulls the cells apart, because in 4D each face is shared by two cells. Download the STL and you can print any of these nets.',
  ping:'<strong>Ping.</strong> A pulse starts at one corner and travels along the edges, one step at a time. Each ring of the same colour is every corner exactly that many edges from the start. The number of steps it takes to reach the last corner is the shape\'s <em>diameter</em> as a network, and because these shapes look the same from every corner, it doesn\'t matter which corner you start from. The ring sizes are a fingerprint of the shape: the tesseract\'s are 1, 4, 6, 4, 1, the same numbers as a row of Pascal\'s triangle.',
  slice:'<strong>Slice mode.</strong> The shape holds still and a flat 3D "knife" slides through it along W, the 4th direction. At each position we see only the part of the shape the knife is passing through, the way slicing a ball with a knife shows a circle that grows and then shrinks. The bright solid is that slice; the faint frame is the whole shape. Each face of the slice is where the knife cuts one of the shape\'s cells. You choose which part of the shape faces the knife (a corner, edge, face or cell); the shape turns once to face it that way, then stays put while the knife moves. Unlike a shadow, a slice is a real 3D object, so its STL is an honest piece of the 4D shape.',
};
// Which shapes a mode can't show, and why. The shape stays picked so switching back to a mode that can show it just works.
export function notAvail(m=st.mode, k=st.shape){ const sh=SHAPES[k], nm=sh.name, ML={build:'Build up',slice:'Slice',unfold:'Unfold'}[m];
  if (sh.round && m==='build') return [`Build up isn't available for the ${nm}`, 'It\'s a smooth curved surface, not corners joined by edges, so there are no steps to build it from. Try it in Explore, Ping or Slice.'];
  if (sh.round && m==='unfold') return [`Unfold isn't available for the ${nm}`, 'A smooth curved surface has no flat cells to hinge open, so there\'s no net. Try it in Explore, Ping or Slice.'];
  if (sh.compound && (m==='build' || m==='slice' || m==='unfold')) return [`${ML} isn't available for the ${nm}`, 'A compound is several separate shapes passing through each other, with no cells joining them into one solid. Look at it in Explore, or Ping it: the light can\'t jump between the separate shapes. To slice or unfold one part, pick that shape on its own.'];
  if (sh.star && (m==='build' || m==='slice' || m==='unfold')) return [`${ML} isn't available for the ${nm}`, 'A star polytope\'s cells pass through each other, so they don\'t enclose one clean region: there\'s nothing solid to slice, and no way to glue or unfold the cells without them crossing. Try it in Explore or Ping.'];
  if (sh.highD && (m==='slice' || m==='unfold')) return [`${ML} isn't available for the ${nm}`, `${ML} works on the 4D shape itself, and this one is drawn as a shadow of ${sh.n} dimensions. Try it in Explore, Ping or Build up, or pick the Tesseract to ${m==='slice'?'slice':'unfold'} the 4D cube.`];
  return null; }
function showNA(){ const r=notAvail(); $('na').hidden=!r; pivot.visible=!r;
  if (r){ $('na').querySelector('.naT').textContent=r[0]; $('na').querySelector('.naB').textContent=r[1];
    $('title').textContent=SHAPES[st.shape].name; $('subtitle').textContent='not available in this mode'; $('legend').style.display='none'; $('stageCap').style.display='none'; }
  else $('stageCap').style.display = st.mode==='explore' ? 'none' : 'block';
  return !!r; }
function setStats(a,b,c,la='vertices',lb='edges',lc='cells'){
  $('nv').textContent=a; $('ne').textContent=b; $('nc').textContent=c; $('nvl').textContent=la; $('nel').textContent=lb; $('ncl').textContent=lc; }
export function updateLabels(){
  updateEuler(); if (st.faceFill) updateFaceNote(); $('sym').textContent=symbolFor(SHAPES[st.shape]);
  { const shN=SHAPES[st.shape]; $('gv-shapes').textContent = shN.name + (st.shape==='hcube' ? '' : ''); }
  if (showNA()) return;
  const sh=SHAPES[st.shape], pj={stereo:'stereographic',persp:'perspective',ortho:'orthographic'}[st.proj];
  if (st.mode==='explore'){ $('title').textContent=sh.name; $('subtitle').textContent=`${sh.alt} · ${pj} projection`;
    $('about').innerHTML=`<strong>${sh.name}.</strong> ${sh.info||''}`; if (sh.round) setStats(sh.verts.length, sh.edges.length, '—', 'mesh points', 'mesh lines', 'flat cells'); else if (sh.highD) setStats(sh.verts.length.toLocaleString(), sh.edges.length.toLocaleString(), sh.cells.toLocaleString(), 'corners', 'connections', sh.cellWord); else setStats(sh.verts.length, sh.edges.length, sh.cells); }
  else if (st.mode==='ping'){ $('title').textContent=`${sh.name}: ping`; $('subtitle').textContent='a pulse spreading edge by edge';
    $('about').innerHTML=ABOUT.ping+` <br><br><strong>${sh.name}.</strong> ${sh.info||''}`; }
  else if (st.mode==='slice'){ $('title').textContent=`${sh.name}: slice`; $('subtitle').textContent='the 3D cross-section at one value of W';
    $('about').innerHTML=ABOUT.slice+` <br><br><strong>${sh.name}.</strong> ${sh.info||''}`; }
  else if (st.mode==='build'){ const b=getBuild(); $('title').textContent=`Building the ${low(sh.name)}`; $('about').innerHTML=(b.kind==='parts'?ABOUT.parts:ABOUT.build)+` <br><br><strong>${sh.name}.</strong> ${sh.info||''}`; }
  else { $('title').textContent=`Unfolding the ${low(sh.name)}`; $('subtitle').textContent=`${topo(sh)._cells.length} cells → a 3D net`; $('about').innerHTML=ABOUT.unfold+` <br><br><strong>${sh.name}.</strong> ${sh.info||''}`; setStats(sh.verts.length, sh.edges.length, sh._cells.length); }
  updateDynamic();
}
shared.lastCap = '';
function setCap(html){ if (html!==shared.lastCap){ $('stageCap').innerHTML=html; shared.lastCap=html; } }
export function updateDynamic(){
  if (notAvail()) return;
  if (st.mode==='build'){ const b=getBuild(), s=buildStage(b, st.build.t);
    setCap(b.caption(s.k,s.e,s.x) + (s.after>0 ? ' <i>Now it spins in 4D.</i>' : ''));
    $('subtitle').textContent=b.names[s.k]; setStats(...b.stats(s.k,s.e,s.x));
    document.querySelectorAll('#buildStages button').forEach(x=>x.classList.toggle('on', +x.dataset.k===s.k)); }
  else if (st.mode==='unfold'){ const u=st.unf.u, f=st.unf.f;
    const sh=SHAPES[st.shape], U=unfoldData(sh), N=U.N;
    if (f>0){ const FD=flatData(sh);
      setCap(f>0.96 ? `<b>Fully flat.</b> All ${N} cells opened into flat nets and laid on one floor: ${FD.nPoly} polygons in 2D. Every face of the ${low(sh.name)} appears twice, once in each of the two cells that share it. To go all the way to 2D, the cells have to come apart.`
        : `<b>Flattening 3D → 2D.</b> Each cell in the 3D net now opens into its own flat net of polygons${st.shape==8?' (each cube into a cross of 6 squares)':''} and lies down on the floor.`); }
    else setCap(u<0.04 ? `<b>Folded.</b> The ${low(sh.name)}'s ${N} cells, glued face to face (${cellSummary(sh, st.shape)}).`
      : u>0.96 ? `<b>Unfolded.</b> All ${N} cells laid out in ordinary 3D: a net of the ${low(sh.name)}. Fold it back up through the 4th dimension and it closes into the 4D shape` + (st.shape==8 ? ', just as a cross of 6 squares folds into a cube. This is Dalí\'s cross.' : '.')
          + (U.overlap ? ' With this many cells, some parts of this net pass through each other. A net that never overlaps needs a cleverer choice of which faces to cut.' : '')
      : '<b>Unfolding 4D → 3D.</b> Each cell swings around the face it shares with its neighbour, turning through the 4th dimension, the way a cube\'s net opens by turning squares through the 3rd.'); }
  else if (st.mode==='ping'){ const D=pingData(), ph=pingPhase(), T=ph.T, k=Math.min(D.maxD, Math.max(0, Math.floor(ph.back ? ph.U : T)));
    const echo=st.ping.style==='echo', sh=SHAPES[st.shape];
    const lit=D.d.filter(x=>x>=0 && x<=T && (!ph.back || ph.U<x) && (!echo || echoAlpha(T-x-0.6)>0)).length;
    const litE=sh.edges.filter(([a,b])=>{ if (D.d[a]<0||D.d[b]<0) return false; const lo=Math.min(D.d[a],D.d[b]); return lo<T && Math.max(D.d[a],D.d[b])<=T+(D.d[a]===D.d[b]?1:0) && (!ph.back || ph.U<lo+1) && (!echo || echoAlpha(T-lo-1)>0); }).length;
    setStats(`${k}/${D.maxD}`, lit, litE, 'steps', 'corners lit', 'edges lit');
    setCap(ph.back ? (lit===0 ? `<b>All dark again.</b> The darkness followed the light along exactly the same paths, from the same starting corner.` : `<b>Unlighting: step ${k} of ${D.maxD}.</b> The darkness starts where the light did and follows it outward. ${lit} of ${D.d.length} still lit.`)
      : T>=D.maxD ? `<b>Every corner reached in ${D.maxD} step${D.maxD===1?'':'s'}.</b> On the ${low(sh.name)}, no corner is more than ${D.maxD} edge${D.maxD===1?'':'s'} from any other. Corners per ring: ${D.rings.length>14 ? D.rings.slice(0,6).join(', ')+' … '+D.rings.slice(-3).join(', ') : D.rings.join(', ')}.${D.unreached ? ` The other ${D.unreached} points are on separate pieces the pulse can\'t reach${st.shape==='hopf'?': every Hopf circle is its own closed loop':''}.` : ''}`
      : k===0 ? `<b>Ping!</b> The pulse starts at one corner (white).`
      : `<b>Step ${k} of ${D.maxD}.</b> ${D.rings[k]} corner${D.rings[k]===1?' is':'s are'} exactly ${k} edge${k===1?'':'s'} from the start. ${lit} of ${D.d.length} lit${echo?', and the wave fades behind itself':''}.`); }
  else if (st.mode==='slice' && sliceInfo && SHAPES[st.shape].round){ const k=st.shape, s=sliceInfo, kn=`<b>Knife at W = ${st.knife.toFixed(2)}.</b> `;
    setStats(s.pts.length || '—', s.segs.length, '—', 'points', 'lines', 'cells');
    setCap(k==='sph4' ? (s.r ? kn+`The slice is an ordinary sphere of radius ${s.r.toFixed(2)}. It is biggest when the knife is through the middle and shrinks to a point at the edges, like a balloon passing through a flat world.` : kn+'The knife is outside the hypersphere.')
      : k==='hopf' ? (s.pts.length ? kn+`Each circle meets the knife at just two points: ${s.pts.length} points from ${s.pts.length/2} of the circles. The slice of a circle is a pair of points.` : kn+'No circles cross the knife here.')
      : (s.segs.length ? kn+`The knife cuts the doughnut-shaped grid in closed loops (${s.segs.length} short lines), and the spokes and core circles in single points.` : kn+'The knife is outside the duocylinder.')); }
  else if (st.mode==='slice' && sliceInfo){ const n=sliceInfo.pts.length;
    setStats(n, sliceInfo.segs.length, sliceInfo.cut, 'corners', 'edges', 'faces');
    const sf=sliceFaces(sliceInfo);
    const kn=`<b>Knife at W = ${st.knife.toFixed(2)}.</b> `;
    if (n && (!sliceInfo.cut || sliceInfo.flat)){   // right at the very edge of the shape: the knife only touches it
      setCap(kn + (n===1 ? 'The knife is just touching the shape at a single corner, so the slice is one point. Move it inward and the point grows into a solid.'
        : n===2 ? 'The knife is just touching the shape along a single edge, so the slice is a line segment. Move it inward and it opens into a solid.'
        : `The knife is lying flat against one face of the shape, so the slice is that flat ${n===3?'triangle':n===4?'square':n===5?'pentagon':n===6?'hexagon':n+'-sided polygon'}, with no thickness yet. Move it inward and it thickens into a solid.`)); }
    else setCap(n ? `<b>Knife at W = ${st.knife.toFixed(2)}.</b> ${shared.vfigOn?'<b>Vertex figure.</b> ':''}The slice has ${n} corners and ${sliceInfo.cut} faces (${sf.list})${sf.name?`: shaped like ${an(sf.name)}`:''}. Each face is where the knife cuts one cell.`
             : `<b>Knife at W = ${st.knife.toFixed(2)}.</b> The knife is outside the shape, so nothing is in our 3D world right now.`); }
}
export function updateCellLabel(){
  $('cellNav').hidden=!st.hl; if (!st.hl) return;
  if (SHAPES[st.shape].round){ $('cellLbl').textContent='Round shapes have no flat cells'; return; }
  if (SHAPES[st.shape].compound){ $('cellLbl').textContent='Pick one of its shapes on its own to light up cells'; return; }
  if (SHAPES[st.shape].star){ $('cellLbl').textContent='Its cells pass through each other, so they can\'t be lit one at a time'; return; }
  if (SHAPES[st.shape].highD){ $('cellLbl').textContent=`Its cells are ${SHAPES[st.shape].cellWord}, too many dimensions to show one at a time`; return; }
  const sh=topo(SHAPES[st.shape]), n=sh._cells.length; st.cell=((st.cell%n)+n)%n;
  $('cellLbl').textContent=`Cell ${st.cell+1} of ${n}: ${cellName(st.shape, sh._cells[st.cell].length, sh._cellEdges[st.cell].length, sh, st.cell)}`;
}
export function refreshColours(){
  shared.RAMP = st.palRev ? PALETTES[st.palette].slice().reverse() : PALETTES[st.palette]; if (st.ping.cache) st.ping.cache.RC=new Map();
  shared.DIRCOL=[0,1,2,3].map(i=>wColor(-0.92+i*0.613)); shared.SOLID=wColor(0.35); shared.CELLCOL=[0,1,2,3,4,5,6,7].map(i=>wColor(-1+2*i/7));
  const bar=$('lgBar'), L=$('lgL'), Rr=$('lgR'), lg=$('legend');
  if (notAvail()){ lg.style.display='none'; return; }
  lg.style.display='flex';
  const hdLegend = SHAPES[st.shape].highD && (st.mode==='build' || (st.cmode==='dir' && st.mode!=='ping' && st.mode!=='unfold'));
  if (hdLegend){ const n=SHAPES[st.shape].n; bar.style.background=`linear-gradient(90deg,${[...Array(n)].map((_,k)=>`${css(axisHue(k,n))} ${k*100/n}% ${(k+1)*100/n}%`).join(',')})`; L.textContent='direction 1'; Rr.textContent=`… ${n}`; }
  else if (st.mode==='build' && getBuild().kind!=='parts'){ bar.style.background=`linear-gradient(90deg,${AXISCOL.map((c,i)=>`${css(c)} ${i*25}% ${(i+1)*25}%`).join(',')})`; L.textContent='step 1'; Rr.textContent='2 · 3 · 4'; }
  else if (st.mode==='build' || st.mode==='unfold' || st.mode==='ping'){ bar.style.background=`linear-gradient(90deg,${shared.RAMP.map(css).join(',')})`; L.textContent=st.mode==='unfold'?'centre cell':st.mode==='ping'?'start':'first cell'; Rr.textContent=st.mode==='ping'?'farthest':'last'; }
  else if (st.cmode==='w' || st.cmode==='body'){ bar.style.background=`linear-gradient(90deg,${shared.RAMP.map(css).join(',')})`; L.textContent=st.cmode==='body'?'painted W −':'W −'; Rr.textContent='W +'; }
  else if (st.cmode==='dir'){ bar.style.background=`linear-gradient(90deg,${shared.DIRCOL.map((c,i)=>`${css(c)} ${i*25}% ${(i+1)*25}%`).join(',')})`; L.textContent='X'; Rr.textContent='Y · Z · W'; }
  else if (st.cmode==='rgb4'){ bar.style.background='linear-gradient(90deg,#ff3b3b 0 25%,#35d24a 25% 50%,#3b7bff 50% 75%,#1c1f2b 75% 82%,#f4f6ff 92% 100%)'; L.textContent='X'; Rr.textContent='Y · Z · W (dark→light)'; }
  else lg.style.display='none';
  const light=st.bg==='#f3efe6';
  lg.style.color=$('title').style.color=light?'#3a3f4b':''; $('subtitle').style.color=light?'#6b7180':'';
}

export function updateEuler(){
  const el=$('eulerLive'); if (!el || !$('lt-euler').open || !$('g-learn').open) return;
  const sh=SHAPES[st.shape], nm=low(sh.name);
  if (sh.highD){ const n=sh.n, f=[...Array(n)].map((_,k)=> sh.fam==='cube' ? binom(n,k)*2**(n-k) : sh.fam==='simp' ? binom(n+1,k+1) : 2**(k+1)*binom(n,k+1));
    const sum=f.reduce((s,x,k)=>s+(k%2?-x:x),0), lab=['corners','edges','faces','cells'];
    const shown=f.slice(0,Math.min(n,6)).map((x,k)=>`${x.toLocaleString()} ${k<4?lab[k]:k+'D pieces'}`).join(', ')+(n>6?', …':'');
    el.innerHTML=`<strong>The ${nm}</strong>: ${shown}. Alternating sum of all ${n} counts: <strong>${sum}</strong> (${n%2?'odd':'even'} dimension, so ${n%2?2:0}).`; return; }
  if (sh.round){ el.textContent=`The ${nm} is a smooth surface, so it has no true corners or cells to count. Pick a shape with flat cells.`; return; }
  if (sh.compound){ el.textContent=`The ${nm} is several separate shapes, so count one at a time: each part on its own gives 0.`; return; }
  if (sh.star){ el.textContent=`The ${nm}'s faces pass through each other, so the plain rule doesn't apply. Star shapes need a corrected version of it.`; return; }
  if (sh.verts.length>1500 && !sh._cells){ el.innerHTML=`The ${nm} is a giant. <button class="btn try" id="eulerGo">Count its pieces</button>`; $('eulerGo').onclick=()=>{ el.textContent='Counting…'; setTimeout(()=>{ topo(sh); updateEuler(); },30); }; return; }
  topo(sh); const V=sh.verts.length, E=sh.edges.length, F=sh._faces.length, C=sh._cells.length;
  el.innerHTML=`<strong>The ${nm}</strong>: V − E + F − C = ${V.toLocaleString()} − ${E.toLocaleString()} + ${F.toLocaleString()} − ${C.toLocaleString()} = <strong>${V-E+F-C}</strong>`; }
export function updateFaceNote(){ const sh=SHAPES[st.shape], el=$('faceNote'); if (!st.faceFill){ el.textContent='Tints every flat face so you can see the surfaces, not just the edges. It\'s the way to tell apart star polytopes that share the same edges: some have triangles, some pentagons, some pentagrams.'; return; }
  if (sh.round || sh.highD){ el.textContent=`This shape has no flat faces to fill.`; return; }
  if (sh.verts.length>1500 && !sh._fpolys){ el.textContent='Finding the faces of this giant…'; setTimeout(updateFaceNote, 60); return; }
  const F=facePolys(sh), n=F.length, k=F[0]?F[0].length:0, kind=sh.star ? (sh.sym.startsWith('{3')?'triangles':sh.sym.startsWith('{5/2')?'pentagrams':'pentagons') : 'faces';
  el.textContent=`${n.toLocaleString()} ${kind} filled.` + (kind==='pentagrams' ? ' Each pentagram is filled point by point, so its middle shows darker where it overlaps.' : ''); }
