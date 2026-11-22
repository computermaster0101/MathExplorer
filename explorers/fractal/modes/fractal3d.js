import { shared } from '../shared.js';
import { $, clamp } from '../util.js';
import { effDensity, st } from '../state.js';
import { flashFx as flash, pulseFx as pulse, voiceFx as voice, boost, beatLevel, bassLevel, energyLevel, beatPos, reacting, intensity } from '../../../js/shell/audio/react.js';
import { hexRGB } from '../color/palettes.js';
import { fs3For, gl, glc, main, setPal } from '../render/webgl.js';
import { cssH, cssW, touch } from '../view.js';
import { showNA } from '../ui/notice.js';

// ---------- 3D ----------
export const S3 = {
  bulb:{ name:'Mandelbulb', alt:'a 3D power of the Mandelbrot recipe, in spherical coordinates', bound:1.25, dim:'≈ 3 (surface ≈ 2.x)',
    info:'There\'s no true 3D version of the Mandelbrot set, because 3D numbers don\'t multiply the way complex numbers do. In 2009 Daniel White and Paul Nylander faked it: write the point in spherical coordinates, raise the distance to a power and multiply both angles by that power. Power 8 gives the famous cauliflower-and-temple look.' },
  box:{ name:'Mandelbox', alt:'fold space in a box, then in a ball, then scale', bound:3.6, dim:'—',
    info:'Found by Tom Lowe in 2010. Each step folds space back into a cube, turns it inside out through a sphere, then scales it and adds the starting point. The scale slider changes everything: values near −1.5 give cities of chambers and corridors.' },
  menger:{ name:'Menger sponge', alt:'cut every cube into 27 and remove the middle cross', bound:1.75, dim:'log 20 ÷ log 3 ≈ 2.727',
    info:'Karl Menger, 1926. Cut a cube into 27 smaller cubes and pull out the middle one and the six in the middle of each face, leaving 20. Repeat forever. Its volume shrinks to zero while its surface area grows without limit. Each face of the sponge is a Sierpinski carpet.' },
  tet:{ name:'Sierpinski tetrahedron', alt:'four half-size copies of itself, corner to corner', bound:1.8, dim:'log 4 ÷ log 2 = 2',
    info:'Four half-size copies at the four corners of a tetrahedron, repeated forever. Surprisingly its dimension is exactly 2, like a flat sheet, even though it\'s spread through 3D: every step keeps the total surface area the same while the volume vanishes.' },
  qj:{ name:'Quaternion Julia set', alt:'a 4D Julia set, seen one 3D slice at a time', bound:1.6, dim:'4D object, 3D slice', four:true, wR:0.9, rg:[0.47,1.12],
    info:'Quaternions are 4-part numbers (1, i, j, k) that do multiply properly, so z → z² + c works in 4D. The full Julia set lives in 4D, so we see a 3D slice of it at one value of W, just like the knife in the polytope explorer\'s Slice mode. Sweep the knife and watch the slice swell, split and merge.' },
};
S3.apo={ name:'Apollonian foam', alt:'a sphere in every gap: a round slab of endless foam', bound:1.5, dim:'≈ 2.47',
  info:'A foam of bubbles in the spirit of the 3D Apollonian gasket, where every gap between touching spheres holds the biggest sphere that fits, forever (Apollonian packing shows the true gasket, in a ball). It\'s drawn by folding space into a repeating box and turning it inside out through a sphere, over and over (Inigo Quilez\'s method), and cutting a round slab out of the endless foam. Dive into the rim: the bubbles never stop.' };
S3.kifs={ name:'Kaleidoscopic IFS', alt:'fold space like a kaleidoscope, twist, scale, repeat', bound:2.1, dim:'—',
  info:'Knighty\'s kaleidoscopic iterated function systems (2010): fold space into a single wedge with mirrors, the way a kaleidoscope does, turn it a little, scale it up and shift it, and repeat. With no twist the half-size copies fit together exactly and fill a plain solid cube; any twist turns them apart and grows crystal spires and cathedral tracery. Keep twisting to watch it morph.' };
Object.assign(S3, {
  mj:{ name:'Mandelbrot–Julia object', alt:'every c and every starting z of z → z² + c at once: a 4D shape', bound:2.85, dim:'4D solid, 3D slice', four:true, wR:1.6, rg:[0.2,0.9],
    info:'Every pair of a c and a starting z either stays bounded under z → z² + c or runs away. All the pairs that stay bounded make one shape in 4D: across and up are c, depth and the hidden W direction are the starting z. Cut it at the starting z = 0 and you get the Mandelbrot set; cut it at a fixed c and you get that c\'s Julia set. The 3D slices in between show how one turns into the other. The thin dust that floats out past |c| = 2 (the Julia sets of points outside the Mandelbrot set) is trimmed off.' },
  tetra:{ name:'Tetrabrot', alt:'z → z² + c with bicomplex numbers, which split it into two Mandelbrot sets', bound:2.1, dim:'4D solid, 3D slice', four:true, wR:1.4, rg:[0.06,0.32],
    info:'Bicomplex numbers have two imaginary units, i and j, that multiply happily with each other, so z → z² + c works in 4D. Dominic Rochon (2000) noticed that they quietly split into two ordinary complex numbers, so the bicomplex Mandelbrot set is two Mandelbrot sets "multiplied" together, which gives it straight edges and boxy terraces. The classic Tetrabrot is the slice with the knife at W = 0.' },
  sier5:{ name:'Sierpinski 5-cell', alt:'five half-size copies at the corners of a 4D simplex', bound:2.0, dim:'log 5 ÷ log 2 ≈ 2.32 (slice ≈ 1.32)', four:true, wR:1.2, rg:[0.5,0.95],
    info:'The next step after the Sierpinski triangle (3 copies) and tetrahedron (4): five half-size copies at the five corners of a 5-cell, the simplest 4D polytope. Its dimension is log 5 ÷ log 2 ≈ 2.32. A 3D slice of it is roughly one dimension less, about 1.32, so what you see is lacy and broken into floating pieces. That isn\'t a drawing fault: there is very little of it in any one slice. Keep the detail low for chunky pieces, or turn the knife and watch them join and part.' },
  menger4:{ name:'4D Menger sponge', alt:'cut a tesseract into 81 and keep the 48 that have at most one middle coordinate', bound:2.05, dim:'log 48 ÷ log 3 ≈ 3.52 (slice ≈ 2.52)', four:true, wR:1.0, rg:[0,1],
    info:'Cut a tesseract (a 4D cube) into 3 × 3 × 3 × 3 = 81 smaller ones and remove every one that sits in the middle third along two or more directions, leaving 48. Repeat. The 3D Menger sponge follows the same rule (keep 20 of 27). Slide the knife: in the middle third, a slice looks like a frame of hollow bars; near the edges it looks like an ordinary Menger sponge. Tilt the knife and you get patterns neither one has.' },
  kifs4:{ name:'4D kaleidoscope', alt:'mirror-fold 4D space into one wedge, twist, scale, repeat', bound:2.4, dim:'—', four:true, wR:1.5, rg:[1.1,1.45],
    info:'The kaleidoscopic IFS with a fourth mirror direction: fold 4D space into a single wedge (all 384 symmetries of the tesseract), twist in the XY and ZW planes, scale by 2 and repeat. The twist slider still works. Slices of it look like crystals that rearrange themselves as the knife moves.' },
});
Object.assign(S3, {
  nest:{ name:'Nested spheres', alt:'a hollow sphere with windows, and inside it a smaller copy, forever', bound:1.05, dim:'2 (every layer is a surface)', rg:[0,1],
    info:'A hollow sphere with six round windows. Inside sits a copy half the size, turned 45°, with its own windows and its own copy inside, and so on forever. The vertical windows line up all the way down, so a dive flies through window after window. Because every layer is an exact copy of the one outside it, the app can swap in the next layer as you pass through, so this dive never runs out of digits.' },
  klein:{ name:'Kleinian pearls', alt:'spheres made of spheres made of spheres, by turning space inside out', bound:1.75, dim:'less than 1 (a dust of pearls)', rg:[0,1],
    info:'Seven separate spheres: six around the middle and one small one in the centre. Each sphere turns space inside out (an inversion), so everything outside it lands inside it, shrunk. Repeat, and every sphere fills up with smaller copies of the other six, each filled with smaller copies again. It\'s the 3D version of the pictures in <em>Indra\'s Pearls</em> (Mumford, Series and Wright, 2002). More detail shows deeper pearls.' },
  pk:{ name:'Pseudo-Kleinian', alt:'fold into a box, invert through a ball, repeat: endless halls and arches', bound:2.0, dim:'—', rg:[0.25,0.95],
    info:'Knighty\'s pseudo-Kleinian fractal (2011): fold space back into a box, turn it inside out through a ball, repeat. It looks like the limit set of a Kleinian group but is far quicker to draw. The full shape goes on forever in every direction, a cathedral with no walls at the edge, so what you see is a round chunk of it. Dive in and fly through the halls.' },
  flake:{ name:'Sphereflake', alt:'nine spheres a third the size on every sphere, forever', bound:2.05, dim:'log 9 ÷ log 3 = 2', rg:[0,1],
    info:'Eric Haines, 1987, made as a test scene for ray tracers. Every sphere sprouts nine spheres a third its size: six around its middle and three on top, leaving the side facing its parent clear. Each new sphere does the same. The whole thing never grows past twice the first sphere\'s size, and with nine copies at a third the size its dimension is exactly 2.' },
  jcube:{ name:'Jerusalem cube', alt:'a cube carved by cross-shaped tunnels, made of smaller Jerusalem cubes', bound:1.75, dim:'≈ 2.529', rg:[0,1],
    info:'Eric Baird, 2011. Keep eight corner cubes, each √2 − 1 ≈ 0.414 times the size, and twelve smaller cubes along the edges, each (√2 − 1)² ≈ 0.172 times the size, and each piece is a Jerusalem cube again. The gaps between them form cross-shaped tunnels through every face. Using √2 − 1 makes the corner and edge cubes fit edge to edge exactly.' },
  hyp:{ name:'Hyperbolic honeycomb', alt:'cells that never run out, shrinking towards the rim of a ball', bound:1.0, dim:'3 (it fills curved space)', rg:[0,1],
    info:'Cubes fit together to fill ordinary space, four round every edge. Squeeze in a fifth round each edge and they no longer fit flat: they need space that curves the other way from a sphere, called hyperbolic space. In it, cubes five to an edge fill everything and never run out. This is the Poincaré ball picture of that space: the whole endless space shrunk into a ball, with every cell the same true size, but drawn smaller and smaller towards the rim, which is infinitely far away. The names are the same Schläfli symbols as 4D polytopes: {5,3,3} is the 120-cell (dodecahedra three to an edge, closing up into a ball in 4D), while {5,3,4}, with four to an edge, can only fill hyperbolic space. Turn on See-through bubbles and the walls to see the cells as soap films.' },
  soddy:{ name:'Apollonian packing', alt:'a ball filled with balls: every gap holds the biggest ball that fits, forever', bound:1.02, dim:'≈ 2.47', rg:[0,1],
    info:'Start with five balls that all touch each other: one big outer ball and four inside it. Fill every gap with the biggest ball that fits, then fill the new gaps, forever. The sizes follow a rule found by Frederick Soddy in 1936 (and Thorold Gosset): for any five balls that all touch, the sum of their curvatures squared, times three, equals the square of their sum (curvature is one over the radius). The balls end up filling the whole ball, leaving only a dust of points between them, so here each one is drawn a little smaller to keep them apart. It\'s the ball-shaped cousin of Apollonian foam: blow the outer ball up until it\'s infinitely big and from inside it looks like two flat walls, which gives the foam\'s slab.' },
  mosely:{ name:'Mosely snowflake', alt:'cut a cube into 27, keep 18: drop the 8 corners and the middle', bound:1.75, dim:'log 18 ÷ log 3 ≈ 2.631', rg:[0,1],
    info:'Jeannine Mosely, 2006, who also built a Menger sponge out of 66,048 business cards. Like the Menger sponge, cut a cube into 27 and keep some: here the 12 edge cubes and 6 face cubes, dropping the 8 corners and the centre. Repeat in each of the 18. The Menger sponge does the opposite (it keeps the corners and drops the face middles), so here the faces stay solid in the middle while the corners erode, and from along a diagonal the outline looks like a snowflake. Keeping 18 instead of 20 also makes its dimension a little lower: log 18 ÷ log 3 ≈ 2.631, against the sponge\'s 2.727.' },
});
export const QC=[-0.2,0.6,0.2,0.2], SH3=['bulb','box','menger','tet','qj','apo','kifs','mj','tetra','sier5','menger4','kifs4','nest','klein','pk','flake','jcube','mosely','soddy','hyp'];
// nested spheres: how many layers we've swapped in (each one: ×2 bigger, turned 45° back), and up to 3 outer layers kept in view
// While a 3D print is built (over many frames) the shape's distance functions read a frozen copy of the settings, so a
// Breathe or Keep twisting going on meanwhile can't change the shape halfway through. Everything else reads st.d3.
let frozen=null; const D3=()=>frozen||st.d3;
export function freeze3(on){ if (on){ const tw=twistNow(); frozen={...st.d3, twNow:tw}; } else frozen=null; }
const NEST_S=0.5, NEST_TH=Math.PI/4, nestOuter=()=>Math.min(D3().nestM||0,3);
const rotY=(p,a)=>{ const c=Math.cos(a), s=Math.sin(a); return [c*p[0]+s*p[2], p[1], -s*p[0]+c*p[2]]; };
export function nestIn(){ const D=st.d3; D.target=rotY(D.target,-NEST_TH).map(x=>x/NEST_S); D.dist/=NEST_S; D.yaw-=NEST_TH; D.nestM=(D.nestM||0)+1; }
export function nestOut(){ const D=st.d3; D.target=rotY(D.target.map(x=>x*NEST_S),NEST_TH); D.dist*=NEST_S; D.yaw+=NEST_TH; D.nestM--; }
export function nestReset(){ const D=st.d3; if (D.target) while ((D.nestM||0)>0) nestOut(); D.nestM=0; }
// the knife's 4D turn: R = turn in XW, then YW, then ZW (degrees)
function rot4(axw, ayw, azw){
  const M=(i,a)=>{ const c=Math.cos(a*Math.PI/180), s=Math.sin(a*Math.PI/180), R=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]; R[i][i]=c; R[i][3]=-s; R[3][i]=s; R[3][3]=c; return R; };
  const mul=(A,B)=>A.map((r,i)=>B[0].map((_,j)=>A[i].reduce((sm,_,k)=>sm+A[i][k]*B[k][j],0)));
  return mul(mul(M(0,axw),M(1,ayw)),M(2,azw)); }
export let r4c={key:'', R:null};
function getR4(){ const D=D3(), k=D.axw+'|'+D.ayw+'|'+D.azw; if (r4c.key!==k){ r4c={key:k, R:rot4(D.axw,D.ayw,D.azw)}; } return r4c.R; }
export const is4=()=>!!S3[D3().shape].four;
export const isKifs=()=>D3().shape==='kifs'||D3().shape==='kifs4';
// the shape's own turn (object → world), built from the XY, XZ and YZ sliders
let r3c={key:'', R:null};
function getR3(){ const D=D3(), k=D.rxy+'|'+D.rxz+'|'+D.ryz; if (r3c.key!==k){ const R=[[1,0,0],[0,1,0],[0,0,1]], rot=(a,b,deg)=>{ const t=deg*Math.PI/180, c=Math.cos(t), s=Math.sin(t);
    for (let r=0;r<3;r++){ const x=R[r][a], y=R[r][b]; R[r][a]=c*x-s*y; R[r][b]=s*x+c*y; } }; rot(1,2,D.ryz); rot(0,2,D.rxz); rot(0,1,D.rxy); r3c={key:k, R}; } return r3c.R; }
// for 3D shapes the knife is a flat cut: its tilt comes from the same three sliders as the 4D knife
function cutPlane(){ const D=D3(), t=a=>a*Math.PI/180; let n=[0,0,1];
  const rp=(v,a,b,deg)=>{ const c=Math.cos(t(deg)), s=Math.sin(t(deg)), o=v.slice(); o[a]=c*v[a]-s*v[b]; o[b]=s*v[a]+c*v[b]; return o; };
  n=rp(n,0,2,D.axw); n=rp(n,1,2,D.ayw); n=rp(n,0,1,D.azw); return {n, o:D.w*d3Bound()*0.95}; }
export const knifeVal=()=> is4() ? wAct() : D3().w*d3Bound()*0.95;
// the twist actually drawn: the slider, plus a slow sway with the vocals and melody on 3D shapes (4D shapes sway their slice instead)
export const twistNow=()=>frozen ? frozen.twNow : st.d3.twist+(is4()?0:voice()*(isKifs()?6:15));
// ---------- the dance: while music plays, the shape nods toward you on each beat, leans side to side across two beats (locked to
// the song's beat when there is one), twists back and forth across four beats and flexes its twist with the bass, all bigger at Lively and Wild (boost()) and in loud
// passages. Applied only to what's drawn (the camera distance and turn sent to the shader), so dives aim and prints build as before.
const DZ={ nod:0, yaw:0, pitch:0, flex:0, tw:0, t:0 };
export function dance(){ const now=performance.now()/1000, dt=Math.min(0.1, now-(DZ.t||now)); DZ.t=now;
  // how big: Wild is the full dance; Calm a gentle sway, Lively in between (scaling straight with boost() made even Calm look wild);
  // at Lively and Wild boost() also adds a little in loud passages and just after a drop
  const lvl=intensity(), on=reacting(), b=on ? { calm:0.14, lively:0.45, wild:1 }[lvl] * (lvl==='calm' ? 1 : boost() / { lively:1.7, wild:2.6 }[lvl]) : 0, e=energyLevel(), ph=beatPos(), sw=ph==null ? Math.sin(now*Math.PI*2/1.1) : Math.sin(Math.PI*ph), sp=ph==null ? Math.sin(now*Math.PI/1.1) : Math.sin(Math.PI*ph/2), st4=ph==null ? Math.sin(now*Math.PI/2.2) : Math.sin(Math.PI*ph/4);
  const want={ nod:on?Math.min(0.3, 0.21*beatLevel()*b):0, yaw:on?0.27*b*(0.45+e)*sw:0, pitch:on?0.12*b*(0.45+e)*sp:0, flex:on?2.6*bassLevel()*b:0, tw:on?b*(0.45+e)*st4:0 }, k=1-Math.exp(-dt*12), kn=1-Math.exp(-dt*20);
  DZ.nod+=(want.nod-DZ.nod)*kn; DZ.yaw+=(want.yaw-DZ.yaw)*k; DZ.pitch+=(want.pitch-DZ.pitch)*k; DZ.flex+=(want.flex-DZ.flex)*k; DZ.tw+=(want.tw-DZ.tw)*k; return DZ; }
function d3Tf(){ const D=D3(), b=d3Bound(), tw=isKifs()?0:twistNow()*Math.PI/180/b; return {R:getR3(), tw, twS:1/Math.sqrt(1+(tw*b)*(tw*b)), cut:!is4()&&D.cut ? cutPlane() : null}; }
export const wAct=()=>D3().w*(S3[D3().shape].wR||0.9);
// 4D distance estimates, in double precision (the shader's twins), for aiming dives
const S5=1/Math.sqrt(5), V5=[[1,1,1,-S5],[1,-1,-1,-S5],[-1,1,-1,-S5],[-1,-1,1,-S5],[0,0,0,4*S5]];
function mDE2(cr,ci,it){ let zr=0,zi=0,dr=0,di=0;
  for (let i=0;i<it;i++){ const t=2*(zr*dr-zi*di)+1; di=2*(zr*di+zi*dr); dr=t; const a=zr*zr-zi*zi+cr; zi=2*zr*zi+ci; zr=a; const m=zr*zr+zi*zi; if (m>1e4){ const r=Math.sqrt(m); return 0.5*r*Math.log(r)/Math.max(Math.hypot(dr,di),1e-300); } }
  return 0; }
function de4(q, sh, it){ const D=D3(), [x,y,z,w]=q;
  if (sh==='mj'){ let zr=z, zi=w, ar=1,ai=0, br=0,bi=0; const cut=Math.hypot(x,y)-2;
    for (let i=0;i<it;i++){ let t=2*(zr*ar-zi*ai); ai=2*(zr*ai+zi*ar); ar=t; t=2*(zr*br-zi*bi)+1; bi=2*(zr*bi+zi*br); br=t; t=zr*zr-zi*zi+x; zi=2*zr*zi+y; zr=t; const m=zr*zr+zi*zi;
      if (m>1e4){ const r=Math.sqrt(m); return Math.max(0.5*r*Math.log(r)/Math.max(Math.sqrt(ar*ar+ai*ai+br*br+bi*bi),1e-300), cut); } }
    return Math.max(0,cut); }
  if (sh==='tetra') return Math.max(mDE2(x+w,y-z,it), mDE2(x-w,y+z,it))*Math.SQRT1_2;
  if (sh==='sier5'){ let p=q.slice(), n=0;
    for (let i=0;i<it;i++){ let v=V5[0], bd=Infinity; for (const u of V5){ const d=(p[0]-u[0])**2+(p[1]-u[1])**2+(p[2]-u[2])**2+(p[3]-u[3])**2; if (d<bd){ bd=d; v=u; } } p=p.map((a,j)=>2*a-v[j]); n++; }
    return (Math.hypot(...p)-1.8)*Math.pow(2,-n); }
  if (sh==='menger4'){ const a0=q.map(v=>Math.abs(v)-1); let d=Math.hypot(...a0.map(v=>Math.max(v,0)))+Math.min(Math.max(...a0),0), s=1;
    for (let m=0;m<it;m++){ const r=q.map(v=>Math.abs(1-3*Math.abs(mod2(v*s)-1))); s*=3; const mn=r.slice().sort((u,v)=>v-u)[1]; const c=(mn-1)/s; if (c>d) d=c; }
    return d; }
  if (sh==='kifs4'){ const a=twistNow()*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a), cb=Math.cos(a*0.7), sb=Math.sin(a*0.7); let p=q.slice(), n=0;
    for (let i=0;i<it;i++){ p=p.map(Math.abs).sort((u,v)=>v-u); let t=ca*p[0]-sa*p[1]; p[1]=sa*p[0]+ca*p[1]; p[0]=t; t=cb*p[2]-sb*p[3]; p[3]=sb*p[2]+cb*p[3]; p[2]=t; p=p.map(v=>2*v-1); n++; }
    return (Math.hypot(...p)-1)*Math.pow(2,-n); }
  // quaternion Julia
  const qm=(a,b)=>[a[0]*b[0]-(a[1]*b[1]+a[2]*b[2]+a[3]*b[3]), a[0]*b[1]+b[0]*a[1]+(a[2]*b[3]-a[3]*b[2]), a[0]*b[2]+b[0]*a[2]+(a[3]*b[1]-a[1]*b[3]), a[0]*b[3]+b[0]*a[3]+(a[1]*b[2]-a[2]*b[1])];
  let Z=q.slice(), dz=[1,0,0,0], m=Z.reduce((sm,v)=>sm+v*v,0);
  for (let i=0;i<it;i++){ dz=qm(Z,dz).map(v=>2*v); Z=qm(Z,Z).map((v,k)=>v+QC[k]); m=Z.reduce((sm,v)=>sm+v*v,0); if (m>16) break; }
  return 0.25*Math.log(Math.max(m,1e-12))*Math.sqrt(m)/Math.hypot(...dz); }
export function d3Extra(){ const D=D3(); if (D.shape==='nest') return 0; return D.target ? Math.max(0, Math.floor(Math.log2(d3Bound()*3.4/D.dist)*0.7)) : 0; }
export function d3Iter(x=d3Extra()){ const l=D3().lvl, s=D3().shape; return Math.min({bulb:16,box:20,menger:12,tet:20,qj:16,apo:20,kifs:20,mj:48,tetra:48,sier5:12,menger4:7,kifs4:20,nest:1,klein:24,pk:20,flake:10,jcube:12,mosely:10,soddy:40,hyp:30}[s],
  {bulb:3+l, box:7+l, menger:Math.min(l,6), tet:4+l, qj:4+l, apo:3+l, kifs:6+l, mj:10+3*l, tetra:10+3*l, sier5:Math.max(2,l-1), menger4:Math.min(l,5), kifs4:6+l, nest:1, klein:l>>1, pk:5+l, flake:1+l, jcube:1+l, mosely:l, soddy:l, hyp:l}[s]+(s==='soddy'?Math.round(1.66*x):s==='hyp'?Math.round(2.44*x):x)); }   // the packing's smallest ball keeps pace with the zoom
export const d3MinDist=()=>d3Bound()*2e-4;
export const d3Mag=()=>{ const D=st.d3; return D.shape==='nest' ? 1.05*3.4/D.dist*Math.pow(2,(D.nestM||0)) : d3Bound()*3.4/D.dist; };
function cam3(){ const D=st.d3, T=D.target||[0,0,0], cp=Math.cos(D.pitch), bz=[cp*Math.sin(D.yaw), Math.sin(D.pitch), cp*Math.cos(D.yaw)];
  let r=[bz[2],0,-bz[0]]; const rl=Math.hypot(...r)||1; r=r.map(x=>x/rl); const u=[bz[1]*r[2]-bz[2]*r[1], bz[2]*r[0]-bz[0]*r[2], bz[0]*r[1]-bz[1]*r[0]];
  return {pos:[T[0]+D.dist*bz[0], T[1]+D.dist*bz[1], T[2]+D.dist*bz[2]], r, u, b:bz}; }
// the same distance estimates as the shader, in double precision, to aim the dive
const fract=x=>x-Math.floor(x), mod2=x=>x-2*Math.floor(x/2);
const KCJ=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[0,0,0]], KRJ=[0.68,0.68,0.68,0.68,0.68,0.68,0.3];
const FDJ=[...Array(9)].map((_,j)=> j<6 ? [Math.cos(j*Math.PI/3),0,Math.sin(j*Math.PI/3)] : (b=>[0.5*Math.cos(b),0.8660254,0.5*Math.sin(b)])(Math.PI/6+(j-6)*2*Math.PI/3));
// Apollonian packing (see deSoddy in render/webgl.js): inner balls at SDA·(±1,±1,±1) with radius SDR, partner spheres at the
// middle (radius SDA) and at −SDE·(the same corners) with radius √8, every ball drawn SH0 of its size
const SDA=0.317837245, SDE=1.732050808, SDV=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
// …and the same balls and partner spheres as five numbers each (co-curvature, curvature, curvature × centre); SDG = the form applied to SDD
const SB=[[0.22474487,2.22474487,0.7071067804,0.7071067804,0.7071067804],[0.22474487,2.22474487,0.7071067804,-0.7071067804,-0.7071067804],[0.22474487,2.22474487,-0.7071067804,0.7071067804,-0.7071067804],[0.22474487,2.22474487,-0.7071067804,-0.7071067804,0.7071067804],[-0.1010205143,9.898979498,0,0,0],[1,-1,0,0,0]],
  SDD=[[-0.317837245,3.146264372,0,0,0],[0.3535533906,0.3535533906,-0.6123724357,-0.6123724357,-0.6123724357],[0.3535533906,0.3535533906,-0.6123724357,0.6123724357,0.6123724357],[0.3535533906,0.3535533906,0.6123724357,-0.6123724357,0.6123724357],[0.3535533906,0.3535533906,0.6123724357,0.6123724357,-0.6123724357]],
  SDG=[[-1.573132186,0.1589186225,0,0,0],[-0.1767766953,-0.1767766953,-0.6123724357,-0.6123724357,-0.6123724357],[-0.1767766953,-0.1767766953,-0.6123724357,0.6123724357,0.6123724357],[-0.1767766953,-0.1767766953,0.6123724357,-0.6123724357,0.6123724357],[-0.1767766953,-0.1767766953,0.6123724357,0.6123724357,-0.6123724357]];
/** The smallest ball drawn in the Apollonian packing, as a share of the outer radius, from its detail level (the shader uses the same formula). */
export const soddyMin=it=>0.025*Math.pow(0.55,it-5);
// Hyperbolic honeycombs {p,q,r}: the four mirrors (see deHyp in render/webgl.js). The cell's symmetry triangle on the unit
// sphere has corners F (face centre), E (edge middle) and V (corner), with angles π/p at F, π/q at V and a right angle at E.
// The face sphere is centred along F and meets the ball's edge at right angles (d² = 1 + ρ²), tilted π/r from the plane
// through O, E and V: that fixes d = cos(π/r) / √(cos²(π/r) − sin²FE). It only exists when the honeycomb is hyperbolic.
export const HYP={ 435:'{4,3,5}: cubes, five round each edge', 534:'{5,3,4}: dodecahedra, four round each edge', 535:'{5,3,5}: dodecahedra, five round each edge', 353:'{3,5,3}: icosahedra, three round each edge' };
const hypCache={};
export function hypMirrors(kind){ if (hypCache[kind]) return hypCache[kind];
  const [p,q,r]=String(kind).split('').map(Number), PI=Math.PI, FE=Math.acos(Math.cos(PI/q)/Math.sin(PI/p)), FV=Math.acos(1/(Math.tan(PI/p)*Math.tan(PI/q)));
  const F=[0,0,1], E=[Math.sin(FE),0,Math.cos(FE)], V=[Math.sin(FV)*Math.cos(PI/p), Math.sin(FV)*Math.sin(PI/p), Math.cos(FV)];
  const cr=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], nz=v=>{ const l=Math.hypot(...v); return v.map(x=>x/l); }, dt=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const G=nz([F[0]+E[0]+V[0], F[1]+E[1]+V[1], F[2]+E[2]+V[2]]), N=[cr(E,F), cr(V,F), cr(V,E)].map(nz).map(n=>dt(n,G)<0 ? n.map(x=>-x) : n);
  const k=Math.sin(FE), cq=Math.cos(PI/r), d=cq/Math.sqrt(cq*cq-k*k), rho=Math.sqrt(d*d-1), C=F.map(x=>x*d), h=dt(C,N[2]);
  return hypCache[kind]={ N, C, rho, Ec:[C[0]-h*N[2][0], C[1]-h*N[2][1], C[2]-h*N[2][2]], Er:Math.sqrt(rho*rho-h*h) }; }
const dot5=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]+a[4]*b[4];
const len3=v=>Math.hypot(v[0],v[1],v[2]), sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const sdBox3=(p,h)=>{ const q=p.map(x=>Math.abs(x)-h); return Math.hypot(Math.max(q[0],0),Math.max(q[1],0),Math.max(q[2],0))+Math.min(Math.max(q[0],q[1],q[2]),0); };
const sortDesc=p=>{ const a=p.map(Math.abs); return a.sort((u,v)=>v-u); };
function deNew(p, sh, it){
  if (sh==='nest'){ const r=Math.max(len3(p),1e-300), kf=Math.floor(-Math.log2(r)); let d=Infinity;
    for (let j=0;j<2;j++){ const k=Math.max(kf,-nestOuter())+j, sc=Math.pow(2,-k), q=rotY(p,-k*NEST_TH).map(x=>x/sc);
      const sh2=Math.abs(len3(q)-1)-0.035, h=Math.min(Math.hypot(q[1],q[2]),Math.hypot(q[0],q[2]),Math.hypot(q[0],q[1]))-0.55; d=Math.min(d, Math.max(sh2,-h)*sc); }
    return d; }
  if (sh==='klein'){ let q=p.slice(), ds=1, last=-1;
    for (let n=0;n<it;n++){ let hit=-1; for (let i=0;i<7;i++){ if (i===last) continue; const v=sub3(q,KCJ[i]); if (v[0]*v[0]+v[1]*v[1]+v[2]*v[2]<KRJ[i]*KRJ[i]){ hit=i; break; } }
      if (hit<0){ let m=Infinity; for (let a=0;a<7;a++){ if (a===last) continue; for (let b=0;b<7;b++){ if (b===a) continue; const e=sub3(KCJ[b],KCJ[a]), qq=KRJ[a]*KRJ[a]/(e[0]*e[0]+e[1]*e[1]+e[2]*e[2]-KRJ[b]*KRJ[b]);
          m=Math.min(m, len3(sub3(q,KCJ[a].map((c,k)=>c+e[k]*qq)))-Math.abs(qq)*KRJ[b]); } } return m/ds; }
      const v=sub3(q,KCJ[hit]), f=KRJ[hit]*KRJ[hit]/Math.max(v[0]*v[0]+v[1]*v[1]+v[2]*v[2],1e-300); q=KCJ[hit].map((c,i)=>c+v[i]*f); ds*=f; last=hit; }
    let m=Infinity; for (let i=0;i<7;i++) if (i!==last) m=Math.min(m, len3(sub3(q,KCJ[i]))-KRJ[i]); return m/ds; }
  if (sh==='pk'){ const CS=[0.92436,0.90756,0.92436]; let q=p.map(x=>x*1.6), df=1;
    for (let i=0;i<it;i++){ q=q.map((x,k)=>2*clamp(x,-CS[k],CS[k])-x); const r2=q[0]*q[0]+q[1]*q[1]+q[2]*q[2], k=Math.max(1/Math.max(r2,1e-12),1); q=q.map(x=>x*k); df*=k; }
    const rxy=Math.hypot(q[0],q[1]); return Math.max(Math.max(rxy-0.92784, Math.abs(rxy*q[2])/Math.max(len3(q),1e-12))/(df*1.6), len3(p)-1.9); }
  if (sh==='flake'){ let q=p.slice(), sc=1, d=len3(q)-1;
    for (let n=0;n<it;n++){ let bj=0, bb=Infinity; const b=FDJ.map((u,j)=>{ const x=len3(sub3(q,u.map(c=>c*4/3)))-2/3; if (x<bb){ bb=x; bj=j; } return x; });
      b.forEach((x,j)=>{ if (j!==bj) d=Math.min(d,x/sc); }); if (bb/sc>d) break;
      const u=FDJ[bj], a=Math.abs(u[1])<0.9?[0,1,0]:[1,0,0], cx=[a[1]*u[2]-a[2]*u[1], a[2]*u[0]-a[0]*u[2], a[0]*u[1]-a[1]*u[0]], xl=len3(cx), x=cx.map(c=>c/xl),
        z=[u[1]*x[2]-u[2]*x[1], u[2]*x[0]-u[0]*x[2], u[0]*x[1]-u[1]*x[0]], v=sub3(q,u.map(c=>c*4/3)), dt=(A,B)=>A[0]*B[0]+A[1]*B[1]+A[2]*B[2];
      q=[dt(v,x)*3, dt(v,u)*3, dt(v,z)*3]; sc*=3; d=Math.min(d,(len3(q)-1)/sc); }
    return d; }
  if (sh==='soddy'){ let q=p.slice(), ds=1, best=Infinity, last=-1; const rmin=soddyMin(it), M=[0,1,2,3,4].map(i=>[0,1,2,3,4].map(j=>+(i===j)));   // the shader's deSoddy
    for (let n=0;n<49;n++){
      for (const b of SB){ const k=dot5(M[1],b); if (k<=0 || k*rmin>1) continue; const c=[dot5(M[2],b)/k, dot5(M[3],b)/k, dot5(M[4],b)/k]; best=Math.min(best, len3(sub3(p,c))-1/k); }
      if (best<0 || ds*rmin>4 || n===48) break;
      let hit=-1, c=[0,0,0], R2=8;
      if (last!==0 && q[0]*q[0]+q[1]*q[1]+q[2]*q[2]<SDA*SDA){ hit=0; R2=SDA*SDA; }
      else for (let i=0;i<4;i++){ if (i+1===last) continue; const cc=SDV[i].map(x=>-SDE*x), v=sub3(q,cc); if (v[0]*v[0]+v[1]*v[1]+v[2]*v[2]<8){ hit=i+1; c=cc; break; } }
      if (hit<0) break;
      const v=sub3(q,c), f=R2/Math.max(v[0]*v[0]+v[1]*v[1]+v[2]*v[2],1e-300); q=c.map((x,i)=>x+v[i]*f); ds*=f; last=hit;
      for (const row of M){ const s=2*dot5(row,SDD[hit]); for (let i=0;i<5;i++) row[i]-=s*SDG[hit][i]; } }
    return Math.max(best, len3(p)-1); }
  if (sh==='hyp'){ const H=hypMirrors(D3().hyp||'534'), dsMax=4*Math.pow(1.5,it-5); let q=p.slice(), ds=1;   // the shader's deHyp
    for (let n=0;n<64;n++){ let moved=false;
      for (const nj of H.N){ const d=q[0]*nj[0]+q[1]*nj[1]+q[2]*nj[2]; if (d<0){ q=[q[0]-2*d*nj[0], q[1]-2*d*nj[1], q[2]-2*d*nj[2]]; moved=true; } }
      const v=sub3(q,H.C), r2=v[0]*v[0]+v[1]*v[1]+v[2]*v[2];
      if (r2<H.rho*H.rho && ds<dsMax){ const f=H.rho*H.rho/r2; q=H.C.map((c,i)=>c+v[i]*f); ds*=f; moved=true; }
      if (!moved) break; }
    const n2=H.N[2], h=q[0]*n2[0]+q[1]*n2[1]+q[2]*n2[2], qq=[q[0]-h*n2[0], q[1]-h*n2[1], q[2]-h*n2[2]];
    let d=Math.hypot(h, len3(sub3(qq,H.Ec))-H.Er)-0.012; if (D3().hypW && ds<2.5) d=Math.min(d, Math.abs(len3(sub3(q,H.C))-H.rho)-0.004);
    return Math.max(d/ds, len3(p)-0.985); }
  if (sh==='jcube'){ const K=Math.SQRT2-1, K2=K*K; let q=p.slice(), sc=1, d=Infinity;
    for (let n=0;n<it;n++){ q=sortDesc(q); const ca=[1-K,1-K,1-K], cb=[1-K2,1-K2,0], ba=sdBox3(sub3(q,ca),K), bb=sdBox3(sub3(q,cb),K2);
      if (Math.min(ba,bb)/sc>d) return d;
      if (ba<=bb){ d=Math.min(d,bb/sc); q=sub3(q,ca).map(x=>x/K); sc/=K; } else { d=Math.min(d,ba/sc); q=sub3(q,cb).map(x=>x/K2); sc/=K2; } }
    return Math.min(d, sdBox3(q,1)/sc); }
  if (sh==='mosely'){ let q=p.slice(), sc=1, d=Infinity;
    for (let n=0;n<it;n++){ q=sortDesc(q); const cf=[2/3,0,0], ce=[2/3,2/3,0], bf=sdBox3(sub3(q,cf),1/3), be=sdBox3(sub3(q,ce),1/3);
      if (Math.min(bf,be)/sc>d) return d;
      if (bf<=be){ d=Math.min(d,be/sc); q=sub3(q,cf).map(x=>x*3); } else { d=Math.min(d,bf/sc); q=sub3(q,ce).map(x=>x*3); } sc*=3; }
    return Math.min(d, sdBox3(q,1)/sc); }
  return null; }
function de3(p, T=d3Tf(), it=d3Iter()){ const R=T.R, q=[0,1,2].map(i=>R[0][i]*p[0]+R[1][i]*p[1]+R[2][i]*p[2]);
  let d = T.tw ? de3raw(rotY(q,T.tw*q[1]),it)*T.twS : de3raw(q,it); if (T.cut) d=Math.max(d, q[0]*T.cut.n[0]+q[1]*T.cut.n[1]+q[2]*T.cut.n[2]-T.cut.o); return d; }
function de3raw(p, it){ const D=D3(), sh=D.shape;
  { const n=deNew(p, sh, it); if (n!==null) return n; }
  if (S3[sh].four){ const R=getR4(), w=wAct(), q=[0,1,2,3].map(i=>R[i][0]*p[0]+R[i][1]*p[1]+R[i][2]*p[2]+R[i][3]*w); return de4(q, sh, it); }
  if (sh==='bulb'){ const P=[p[0],p[2],p[1]]; let z=P.slice(), dr=1, r=0;
    for (let i=0;i<it;i++){ r=Math.hypot(z[0],z[1],z[2]); if (r>2) break; const th=Math.acos(clamp(z[2]/Math.max(r,1e-9),-1,1))*D.power, ph=Math.atan2(z[1],z[0]+1e-12)*D.power;
      dr=Math.pow(r,D.power-1)*Math.abs(D.power)*dr+1; const zr=Math.pow(r,D.power); z=[zr*Math.sin(th)*Math.cos(ph)+P[0], zr*Math.sin(th)*Math.sin(ph)+P[1], zr*Math.cos(th)+P[2]]; }
    r=Math.max(r,1e-9); return 0.5*Math.log(r)*r/dr; }
  if (sh==='box'){ let z=p.slice(), dr=1; const S=D.boxS;
    for (let i=0;i<it;i++){ z=z.map(x=>clamp(x,-1,1)*2-x); const r2=z[0]*z[0]+z[1]*z[1]+z[2]*z[2]; if (r2<0.25){ z=z.map(x=>x*4); dr*=4; } else if (r2<1){ z=z.map(x=>x/r2); dr/=r2; } z=z.map((x,k)=>x*S+p[k]); dr=dr*Math.abs(S)+1; }
    return Math.hypot(...z)/Math.abs(dr); }
  if (sh==='menger'){ const q=p.map(x=>Math.abs(x)-1); let d=Math.hypot(...q.map(x=>Math.max(x,0)))+Math.min(Math.max(...q),0), s=1;
    for (let m=0;m<it;m++){ const a=p.map(x=>mod2(x*s)-1); s*=3; const r=a.map(x=>Math.abs(1-3*Math.abs(x))); const c=(Math.min(Math.max(r[0],r[1]),Math.max(r[1],r[2]),Math.max(r[2],r[0]))-1)/s; if (c>d) d=c; }
    return d; }
  if (sh==='tet'){ let [x,y,z]=p, n=0;
    for (let i=0;i<it;i++){ if (x+y<0){ const t=-y; y=-x; x=t; } if (x+z<0){ const t=-z; z=-x; x=t; } if (y+z<0){ const t=-y; y=-z; z=t; } x=2*x-1; y=2*y-1; z=2*z-1; n++; }
    return (Math.hypot(x,y,z)-1.2)*Math.pow(2,-n); }
  if (sh==='qj'){ const qm=(a,b)=>[a[0]*b[0]-(a[1]*b[1]+a[2]*b[2]+a[3]*b[3]), a[0]*b[1]+b[0]*a[1]+(a[2]*b[3]-a[3]*b[2]), a[0]*b[2]+b[0]*a[2]+(a[3]*b[1]-a[1]*b[3]), a[0]*b[3]+b[0]*a[3]+(a[1]*b[2]-a[2]*b[1])];
    let z=[p[0],p[1],p[2],D.w], dz=[1,0,0,0], m=z.reduce((s,x)=>s+x*x,0);
    for (let i=0;i<it;i++){ dz=qm(z,dz).map(x=>2*x); z=qm(z,z).map((x,k)=>x+QC[k]); m=z.reduce((s,x)=>s+x*x,0); if (m>16) break; }
    return 0.25*Math.log(Math.max(m,1e-12))*Math.sqrt(m)/Math.hypot(...dz); }
  if (sh==='apo'){ let q=p.slice(), s=1; for (let i=0;i<it;i++){ q=q.map(x=>-1+2*fract(0.5*x+0.5)); const r2=q[0]*q[0]+q[1]*q[1]+q[2]*q[2], k=1.2/Math.max(r2,1e-9); q=q.map(x=>x*k); s*=k; }
    return Math.max(0.25*Math.abs(q[1])/s, Math.hypot(...p)-1.45); }
  const a=twistNow()*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a), cb=Math.cos(a*0.7), sb=Math.sin(a*0.7); let [x,y,z]=p, n=0;
  for (let i=0;i<it;i++){ x=Math.abs(x); y=Math.abs(y); z=Math.abs(z); if (x<y){ const t=x; x=y; y=t; } if (x<z){ const t=x; x=z; z=t; } if (y<z){ const t=y; y=z; z=t; }
    let t=ca*x-sa*y; y=sa*x+ca*y; x=t; t=cb*y-sb*z; z=sb*y+cb*z; y=t; x=2*x-1; y=2*y-1; z=2*z-1; n++; }
  return (Math.hypot(x,y,z)-1)*Math.pow(2,-n); }
/** For 3D printing: the distance to the whole shape as it's set now (turn, twist, cut, knife), cut off at the sphere it's
 * drawn in, at the detail level's own iteration count (no extra for zooming). Call freeze3(true) first. */
export function printDE(){ const T=d3Tf(), it=d3Iter(0), B=d3Bound(); return p=>Math.max(de3(p,T,it), Math.hypot(p[0],p[1],p[2])-B); }
function raycast3(){ const C=cam3(); return raycastRay(C.pos, C.b.map(x=>-x)); }
function raycastRay(ro, rd){ const R=d3Bound(), bb=ro[0]*rd[0]+ro[1]*rd[1]+ro[2]*rd[2], c=ro[0]*ro[0]+ro[1]*ro[1]+ro[2]*ro[2]-R*R, h=bb*bb-c;
  if (h<0) return null; const sq=Math.sqrt(h), tmax=-bb+sq, k=0.8; let t=Math.max(0,-bb-sq), hit=false;
  for (let i=0;i<900;i++){ const d=de3([ro[0]+rd[0]*t, ro[1]+rd[1]*t, ro[2]+rd[2]*t]); if (d<Math.max(1e-9,t*1e-4)){ hit=true; break; } t+=d*k; if (t>tmax) return null; }
  if (!hit) return null;
  for (let i=0;i<300;i++){ const d=de3([ro[0]+rd[0]*t, ro[1]+rd[1]*t, ro[2]+rd[2]*t]); if (d<1e-9) break; t+=d*k; }
  return {p:[ro[0]+rd[0]*t, ro[1]+rd[1]*t, ro[2]+rd[2]*t], t}; }
// ---------- steering a 3D dive toward detail (the same "Steer toward detail" setting as 2D, st.steer) ----------
// About every half second while diving, a 7×7 fan of rays is cast in a cone round the view, a few each frame (within ~3 ms).
// Each ray that hits scores how sharply the depth jumps between it and its neighbours: creases, edges and bumps jump a lot,
// a flat face or open space hardly at all. If somewhere scores clearly better than straight ahead (by a third or more), the dive turns slowly
// toward it (in place, like the arrow keys). Steering by hand, or dragging, puts it on hold (the loop decides that).
const S3N=7, S3A=0.32;
let scan3=null, aim3=null, rest3=0;
function scanScore(T){ const at=(i,j)=>T[j*S3N+i], mid=(S3N-1)/2; let best=null, centre=null;
  for (let j=1;j<S3N-1;j++) for (let i=1;i<S3N-1;i++){ const t=at(i,j); if (!isFinite(t)) continue; let s=0;
    for (const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const n=at(i+a,j+b); s+= isFinite(n) ? Math.min(1, Math.abs(n-t)/t*4) : 0.5; }
    const gx=i/(S3N-1)*2-1, gy=j/(S3N-1)*2-1; s*=1-0.25*Math.hypot(gx,gy);   // a little preference for straight ahead
    if (!best || s>best.s) best={s, i, j}; if (i===mid && j===mid) centre=s; }
  return {best, centre}; }   // the best spot, and how good straight ahead is
/** One frame of 3D dive steering; returns true while it's turning. Call only while diving and not on hold. */
export function steer3Step(dt){ const D=st.d3;
  if (aim3){ const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)), dy=wrap(aim3.yaw-D.yaw), dp=aim3.pitch-D.pitch, k=1-Math.exp(-dt/1.8), mx=0.18*dt;   // turns gently: at most about 10° a second
    const sy=Math.max(-mx,Math.min(mx,dy*k)), sp=Math.max(-mx,Math.min(mx,dp*k)); turn3(sy, sp, true);
    if (Math.abs(dy)<0.015 && Math.abs(dp)<0.015){ aim3=null; rest3=0.5; } return true; }
  if (rest3>0){ rest3-=dt; return false; }
  if (!scan3){ const C=cam3(); scan3={ pos:C.pos, r:C.r, u:C.u, b:C.b, T:new Array(S3N*S3N), i:0 }; }
  const S=scan3, t0=performance.now();
  while (S.i<S3N*S3N && performance.now()-t0<3){ const gx=(S.i%S3N)/(S3N-1)*2-1, gy=Math.floor(S.i/S3N)/(S3N-1)*2-1;
    let d=[0,1,2].map(k=>-S.b[k]+S3A*(gx*S.r[k]+gy*S.u[k])); const l=Math.hypot(...d); d=d.map(x=>x/l);
    const h=raycastRay(S.pos, d); S.T[S.i]=h ? h.t : Infinity; S.i++; }
  if (S.i<S3N*S3N) return false;
  scan3=null; const {best, centre}=scanScore(S.T);
  if (!best || (centre!=null && best.s<centre*1.35+0.1)){ rest3=0.4; return false; }   // straight ahead is as good: keep going
  const gx=best.i/(S3N-1)*2-1, gy=best.j/(S3N-1)*2-1; let v=[0,1,2].map(k=>-S.b[k]+S3A*(gx*S.r[k]+gy*S.u[k])); const l=Math.hypot(...v); v=v.map(x=>x/l);
  aim3={ yaw:Math.atan2(-v[0],-v[2]), pitch:clamp(Math.asin(clamp(-v[1],-1,1)),-1.45,1.45) }; return true; }
/** Forget any scan or turn in progress (new dive, steering switched off, or the user took over). */
export function steer3Reset(){ scan3=null; aim3=null; rest3=0.3; }
export function retarget3(){ const h=raycast3(); if (!h) return false; const D=st.d3; D.target=h.p; D.dist=Math.max(d3MinDist(), h.t); D.floating=false; return true; }
// slide the camera sideways (and the point it looks at) by a screen drag, then re-aim at whatever surface is straight ahead
export function pan3(dx, dy){ const D=st.d3, C=cam3(), k=D.dist/(cssH*1.6); if (!D.target) D.target=[0,0,0]; D.aim=null;
  D.target=[0,1,2].map(i=>D.target[i]-C.r[i]*dx*k+C.u[i]*dy*k); D.needAim=true; shared.vel3={x:0,y:0}; touch(); }
/** Keyboard turning: round the shape, like dragging; or, while diving, in place (the camera stays put and looks round, then
 * the dive heads for whatever surface is now straight ahead). */
export function turn3(dyaw, dpitch, inPlace){ const D=st.d3; D.aim=null;
  if (inPlace && D.target){ const C=cam3(); D.yaw+=dyaw; D.pitch=clamp(D.pitch+dpitch,-1.45,1.45);
    const cp=Math.cos(D.pitch), bz=[cp*Math.sin(D.yaw), Math.sin(D.pitch), cp*Math.cos(D.yaw)];
    D.target=C.pos.map((x,i)=>x-D.dist*bz[i]); D.needAim=true; }
  else { D.yaw+=dyaw; D.pitch=clamp(D.pitch+dpitch,-1.45,1.45); }
  touch(); }
// tap a spot: swing round to face it and dive toward it
export let tap3Miss=-1e9;
export function tap3(x, y){ const D=st.d3, C=cam3(), ux=(x-cssW/2)/cssH, uy=(cssH/2-y)/cssH;
  let rd=[0,1,2].map(i=>C.r[i]*ux+C.u[i]*uy-C.b[i]*1.6); const l=Math.hypot(...rd); rd=rd.map(v=>v/l);
  const h=raycastRay(C.pos, rd); if (!h){ tap3Miss=performance.now(); return; } hold4();
  const v=[0,1,2].map(i=>C.pos[i]-h.p[i]), dist=Math.max(d3MinDist(), Math.hypot(...v)), bz=v.map(q=>q/Math.hypot(...v));
  let y1=Math.atan2(bz[0],bz[2]); while (y1-D.yaw>Math.PI) y1-=2*Math.PI; while (y1-D.yaw<-Math.PI) y1+=2*Math.PI;
  D.aim={t:0, T0:(D.target||[0,0,0]).slice(), T1:h.p, y0:D.yaw, y1, p0:D.pitch, p1:clamp(Math.asin(clamp(bz[1],-1,1)),-1.45,1.45), l0:Math.log(D.dist), l1:Math.log(dist)};
  if (!D.target) D.target=[0,0,0]; D.floating=false; shared.vel3={x:0,y:0}; shared.tapMark={x,y,t:performance.now()}; touch(); }
export let dive3Msg=-1e9;
export function dive3UI(){ const D=st.d3, on=D.dive||!!D.warp; $('dive3Btn').classList.toggle('on',on); $('dive3Btn').textContent=on?'Stop diving':'Dive in'; }
export function start3Warp(why){ const D=st.d3; D.dive=false; D.warpWhy=why; D.warpMag=d3Mag(); if (D.shape==='nest') nestReset();
  D.warp={t:0, dur:why==='reset'?2.2:3.2, ls0:Math.log(D.dist), ls1:Math.log(d3Bound()*3.4), T0:(D.target||[0,0,0]).slice(), y0:D.yaw, y1:D.yaw+0.9+Math.random()*1.6, p0:D.pitch, p1:-0.25+Math.random()*1.0};
  if (!D.target) D.target=[0,0,0]; dive3UI(); touch(); }
function hold4(){ const D=st.d3; for (const [k,id] of [['sweep','sweep3'],['spin4','spin4'],['spin3','spin3'],['twAnim','twAnim'],['breathe','breathe'],['bsBreathe','bsBreathe']]){ D[k]=false; $(id).checked=false; }
  if (D.shape==='nest'){ Object.assign(D,{rxy:0,rxz:0,ryz:0,twist:0,cut:false}); $('cut3').checked=false; $('tw3').value=0; $('tw3o').textContent='0°'; syncT3(); } }
export const nestStraight=()=>{ const D=st.d3; return !D.rxy && !D.rxz && !D.ryz && !D.twist && !D.cut; };
export function nestDive(){ const D=st.d3; hold4(); D.aim={t:0, T0:(D.target||[0,0,0]).slice(), T1:[0,0,0], y0:D.yaw, y1:D.yaw, p0:D.pitch, p1:1.25, l0:Math.log(D.dist), l1:Math.log(Math.min(D.dist,2.5))};
  if (!D.target) D.target=[0,0,0]; D.floating=false; D.dive=true; shared.vel3={x:0,y:0}; }
export function setDive3(on){ const D=st.d3; if (!on) D.warp=null; if (on) hold4();
  if (on && D.shape==='nest'){ nestDive(); dive3UI(); touch(); return; }
  if (on && !retarget3()){ const C=cam3(); let found=null;
    for (let r=0.03; r<=0.4 && !found; r+=0.03) for (let k=0;k<12 && !found;k++){ const a=k*Math.PI/6+r*7, ux=Math.cos(a)*r, uy=Math.sin(a)*r;
      let rd=[0,1,2].map(i=>C.r[i]*ux+C.u[i]*uy-C.b[i]*1.6); const l=Math.hypot(...rd); rd=rd.map(v=>v/l); if (raycastRay(C.pos, rd)) found=[cssW/2+ux*cssH, cssH/2-uy*cssH]; }
    if (found){ D.dive=true; tap3(found[0], found[1]); dive3UI(); return; } }
  if (on){ if (!retarget3()){ dive3Msg=performance.now(); D.dive=false; } else { D.dive=true; D.extra=d3Extra(); } } else D.dive=false;
  dive3UI(); touch(); }
// How far each shape reaches, measured by marching rays with the same formulas (bounds a little bigger than that).
// Mandelbulb: powers 2 to 3 reach out to about 1.7, high powers hug the unit ball. Negative powers leave every point closer
// than 2 hanging, so their surface is wherever the distance estimate says; they get extra room (and smaller steps in the shader).
// 1.25 is kept as the smallest so the usual power-8 view is unchanged.
export function bulbBound(n){ const a=Math.abs(n); if (n>0) return Math.max(1.25, Math.min(1.75, Math.pow(2,1/(a-1)))*1.04);
  const T=[[2,1.95],[3,1.95],[4,1.8],[8,1.6],[16,1.42]]; for (let i=1;i<T.length;i++) if (a<=T[i][0]){ const [x0,y0]=T[i-1], [x1,y1]=T[i]; return y0+(y1-y0)*(clamp(a,x0,x1)-x0)/(x1-x0); } return 1.42; }
// Mandelbox: negative scales stay inside the cube of half-width 2 (corners 2√3 ≈ 3.46) and shrink for big scales;
// positive scales fill a cube of half-width 2(S+1)/(S−1), so corners at 2√3 times that: 10.4 at scale 2, 17.3 at 1.5.
export function boxBound(S){ return S<0 ? clamp((-S+1)/(-S-1)*1.05,2.2,3.7) : 2*Math.sqrt(3)*(S+1)/(S-1)*1.02; }
// The gaps where these shapes fall apart (power between −2 and 2, box scale between −1.1 and 1.5): snap to the nearer end.
export const snapGap=(v,lo,hi)=> v>lo && v<hi ? (v-lo < hi-v ? lo : hi) : v;
export function d3Bound(){ const s=D3().shape; if (s==='nest') return 1.05*Math.pow(2,nestOuter()); if (s==='box') return boxBound(D3().boxS); if (s==='bulb') return bulbBound(D3().power); return S3[s].bound; }
// The 3D program is built for the shape on screen (and its see-through version only when that's on), when it's first needed.
// Once it's ready, programs for other shapes are thrown away, and leaving 3D throws away this one too.
export let f3Ready=false, f3Since=0; shared.f3Err = ''; let f3Key='';   // f3Since: when the program now being built was started (for the caption's timer)
const key3=()=>'f3:'+st.d3.shape+(st.d3.glass?':glass':'')+(st.d3.shadows?':shadows':'');
export function prog3(){ const k=key3();
  if (k!==f3Key){ f3Key=k; f3Ready=false; f3Since=performance.now(); shared.f3Err=''; }
  if (shared.f3Err) return null;
  let P; try { P=main.progAsync(k, fs3For(SH3.indexOf(st.d3.shape), st.d3.glass, st.d3.shadows)); } catch(e){ shared.f3Err=String(e.message||e).slice(0,240); showNA(); return null; }
  if (P) for (const n of [...Object.keys(main.progs), ...Object.keys(main.pend)]) if (n.startsWith('f3:') && n!==k) main.drop(n);
  return P; }
export function drop3(){ for (const n of [...Object.keys(main.progs), ...Object.keys(main.pend)]) if (n.startsWith('f3:')) main.drop(n); f3Key=''; f3Ready=false; }
export function render3D(hq){
  const P=prog3(); if (shared.f3Err) return false;
  if (!P){ const b=hexRGB(st.bg); gl.viewport(0,0,glc.width,glc.height); gl.clearColor(b[0],b[1],b[2],1); gl.clear(gl.COLOR_BUFFER_BIT); shared.dirty=true; return false; }   // still being built: try again next frame
  if (!f3Ready){ f3Ready=true; shared.lastCap=''; touch(); }
  const g=gl, D=st.d3; g.useProgram(P.p); g.viewport(0,0,glc.width,glc.height);
  const C=cam3(), r=C.r, u=C.u, bz=C.b, Tg=D.target||[0,0,0], nod=dance().nod*(D.dive?0.4:1), pos=C.pos.map((v,i)=>Tg[i]+(v-Tg[i])*(1-nod));   /* the nod: the camera dips toward what it looks at on each beat */
  g.uniform2f(P.u('u_res'),glc.width,glc.height); g.uniform3fv(P.u('u_cam'),pos);
  g.uniformMatrix3fv(P.u('u_rotM'),false,new Float32Array([...r,...u,...bz])); g.uniform1f(P.u('u_fov'),1.6);
  g.uniform1i(P.u('u_s3'),SH3.indexOf(D.shape));
  { const R=getR4(), cm=new Float32Array(16); for (let j=0;j<4;j++) for (let i=0;i<4;i++) cm[j*4+i]=R[i][j]; g.uniformMatrix4fv(P.u('u_r4'),false,cm); const rg=S3[D.shape].rg||[0,1]; g.uniform2f(P.u('u_rg'),rg[0],rg[1]); g.uniform1i(P.u('u_nest0'),-nestOuter()); g.uniform1i(P.u('u_nestM'),st.d3.nestM||0);
    const T=d3Tf(), dz=DZ, dv=D.dive?0.5:1, cy=Math.cos(dz.yaw*dv), sy=Math.sin(dz.yaw*dv), cp=Math.cos(dz.pitch*dv), spp=Math.sin(dz.pitch*dv);
    const Rd=[[cy, sy*spp, sy*cp],[0, cp, -spp],[-sy, cy*spp, cy*cp]], M0=T.R, M=[0,1,2].map(i=>[0,1,2].map(j=>Rd[i][0]*M0[0][j]+Rd[i][1]*M0[1][j]+Rd[i][2]*M0[2][j]));   // the lean, on top of the view's own turn
    g.uniformMatrix3fv(P.u('u_rot3'),false,new Float32Array([M[0][0],M[0][1],M[0][2],M[1][0],M[1][1],M[1][2],M[2][0],M[2][1],M[2][2]]));
    g.uniform1f(P.u('u_tw'),T.tw); g.uniform1f(P.u('u_twS'),T.twS); g.uniform1i(P.u('u_cut'),T.cut?1:0); g.uniform1i(P.u('u_glass'),D.glass?1:0);
  if (D.shape==='hyp'){ const H=hypMirrors(D.hyp||'534'); g.uniformMatrix3fv(P.u('u_hN'),false,new Float32Array(H.N.flat())); g.uniform3f(P.u('u_hC'),...H.C); g.uniform1f(P.u('u_hR'),H.rho); g.uniform4f(P.u('u_hE'),...H.Ec,H.Er); g.uniform1i(P.u('u_hW'),D.hypW?1:0); } if (T.cut) g.uniform4f(P.u('u_cutP'),T.cut.n[0],T.cut.n[1],T.cut.n[2],T.cut.o); } g.uniform1f(P.u('u_twist'),(twistNow()+(!D.target?pulse()*3+(DZ.flex+DZ.tw*2.4)*(isKifs()?3:9):0))*Math.PI/180);   /* the twist dances too: back and forth across four beats, and the bass flexes it */ g.uniform1i(P.u('u_it3'),d3Iter()); g.uniform1i(P.u('u_hq'),hq?1:0);
  const ab=!D.target ? pulse() : 0, vo=voice();   // music: an optional pulse of the shape on each beat, and the vocal sway (4D slice)
  g.uniform1f(P.u('u_power'),D.power+Math.sign(D.power)*ab*0.8); g.uniform1f(P.u('u_boxS'),D.boxS+Math.sign(D.boxS)*ab*0.06);   // a beat pushes away from zero, never into the gap g.uniform1f(P.u('u_w'),(is4()?wAct()+vo*0.1:0)+ab*0.05);
  g.uniform1f(P.u('u_density'),effDensity()); g.uniform1f(P.u('u_cycle'),st.cycle); g.uniform1f(P.u('u_flash'),flash()); g.uniform1f(P.u('u_bound'),d3Bound()); g.uniform1f(P.u('u_view'),D.dist);
  g.uniform4fv(P.u('u_qc'),QC); setPal(g,P); g.uniform3fv(P.u('u_bg'),hexRGB(st.bg));
  g.drawArrays(g.TRIANGLES,0,3);
}

export function syncT3(){ const D=st.d3; for (const k of ['rxy','rxz','ryz']){ const id='t3'+k.slice(1); $(id).value=Math.round(D[k]); $(id+'o').textContent=Math.round(D[k])+'°'; } }
