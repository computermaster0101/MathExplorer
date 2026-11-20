import { clamp, smooth } from '../util.js';
import { st } from '../state.js';
import { css, fmtN, palM } from '../color/palettes.js';
import { isLight, octx } from '../render/webgl.js';
import { cssH, cssW, ovScale } from '../view.js';

// ---------- Grow: fractals built by a rule ----------
const R3=Math.sqrt(3);
const TRI=[[0,1],[-R3/2,-0.5],[R3/2,-0.5]];
export const pow=(a,b)=>Math.pow(a,b);
export const pctTxt=x=> x>=0.1 ? (x*100).toFixed(0)+'%' : x>=0.001 ? (x*100).toFixed(1)+'%' : (x*100).toExponential(1)+'%';
function kochRec(a,b,lvl,k,e,out){
  if (lvl>=k){ out.push(a); return; }
  const s=lvl===k-1?e:1, dx=b[0]-a[0], dy=b[1]-a[1], p1=[a[0]+dx/3,a[1]+dy/3], p3=[a[0]+2*dx/3,a[1]+2*dy/3];
  const pk=[a[0]+dx/2+dy*s*R3/6, a[1]+dy/2-dx*s*R3/6];
  kochRec(a,p1,lvl+1,k,e,out); kochRec(p1,pk,lvl+1,k,e,out); kochRec(pk,p3,lvl+1,k,e,out); kochRec(p3,b,lvl+1,k,e,out);
}
function levyRec(a,b,lvl,k,e,out){
  if (lvl>=k){ out.push(a); return; }
  const s=lvl===k-1?e:1, dx=b[0]-a[0], dy=b[1]-a[1], m=[a[0]+dx/2-dy*s/2, a[1]+dy/2+dx*s/2];
  levyRec(a,m,lvl+1,k,e,out); levyRec(m,b,lvl+1,k,e,out);
}
const DRAGON=[[[0,0],[1,0]]];
for (let k=1;k<=15;k++){ const P=DRAGON[k-1], pv=P[P.length-1], Q=P.slice(); for (let i=P.length-2;i>=0;i--){ const x=P[i][0]-pv[0], y=P[i][1]-pv[1]; Q.push([pv[0]-y, pv[1]+x]); } DRAGON.push(Q); }
const HIL={};
function hilbert(order){ if (HIL[order]) return HIL[order]; const n=1<<order, N=n*n, P=new Array(N);
  for (let d=0;d<N;d++){ let t=d,x=0,y=0; for (let s=1;s<n;s*=2){ const rx=1&(t>>1), ry=1&(t^rx); if (ry===0){ if (rx===1){ x=s-1-x; y=s-1-y; } const tmp=x; x=y; y=tmp; } x+=s*rx; y+=s*ry; t>>=2; } P[d]=[(x+0.5)/n,(y+0.5)/n]; }
  return HIL[order]=P; }
export const fern={cv:document.createElement('canvas'), n:0, x:0, y:0, key:'', W:600, H:1224, img:null, buf:null, lut:null};
function fernReset(){ const F=fern; F.cv.width=F.W; F.cv.height=F.H; F.img=F.cv.getContext('2d').createImageData(F.W,F.H); F.buf=new Uint32Array(F.img.data.buffer); F.n=0; F.x=0; F.y=0;
  F.lut=Array.from({length:64},(_,i)=>{ const c=palM(i/63*0.5); return (255<<24)|(Math.round(c[2]*255)<<16)|(Math.round(c[1]*255)<<8)|Math.round(c[0]*255); }); }
function fernGrow(target){ const F=fern; const key=st.palette+(st.palRev?'|r':''); if (F.key!==key || target<F.n){ F.key=key; fernReset(); }
  let todo=Math.min(target-F.n, 60000); if (todo<=0) return; let {x,y}=F;
  while (todo--){ const r=Math.random(); let nx,ny;
    if (r<0.01){ nx=0; ny=0.16*y; } else if (r<0.86){ nx=0.85*x+0.04*y; ny=-0.04*x+0.85*y+1.6; } else if (r<0.93){ nx=0.2*x-0.26*y; ny=0.23*x+0.22*y+1.6; } else { nx=-0.15*x+0.28*y; ny=0.26*x+0.24*y+0.44; }
    x=nx; y=ny; F.n++; if (F.n<20) continue;
    const px=Math.floor((x+2.2)/4.9*F.W), py=Math.floor((1-y/10)*F.H); if (px>=0&&px<F.W&&py>=0&&py<F.H) F.buf[py*F.W+px]=F.lut[Math.min(63,Math.max(0,Math.floor(y/10*63)))]; }
  F.x=x; F.y=y; F.cv.getContext('2d').putImageData(F.img,0,0); }
const FERN_N=[0,400,4000,30000,120000,400000];
// each shape: build(k,e) -> {bbox, draw(G)}; G = {g, tf, s, lw}
function strokeGrad(G, P, closed, lw){
  const n=P.length; if (n<2) return; const segs=closed?n:n-1, nb=Math.min(96,segs), g=G.g; g.lineWidth=lw; g.lineJoin='round'; g.lineCap='round';
  for (let b=0;b<nb;b++){ const i0=Math.floor(b*segs/nb), i1=Math.floor((b+1)*segs/nb); g.beginPath(); let p=G.tf(P[i0]); g.moveTo(p[0],p[1]);
    for (let i=i0+1;i<=i1;i++){ p=G.tf(P[i%n]); g.lineTo(p[0],p[1]); } g.strokeStyle=css(palM(b/nb*0.5+st.cycle)); g.stroke(); }
}
function fillPoly(G, P, col){ const g=G.g; g.beginPath(); P.forEach((q,i)=>{ const p=G.tf(q); i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]); }); g.closePath(); g.fillStyle=col; g.fill(); }
function bboxOf(P){ let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity; for (const p of P){ if (p[0]<a)a=p[0]; if (p[1]<b)b=p[1]; if (p[0]>c)c=p[0]; if (p[1]>d)d=p[1]; } return [a,b,c,d]; }
export const GROW = {
  koch:{ name:'Koch snowflake', max:7, dim:Math.log(4)/Math.log(3), dimTxt:'log 4 ÷ log 3', zoom:{a:[0,1], r:3}, legend:['start of edge','end'],
    info:'Helge von Koch, 1904: a curve made entirely of corners, with no smooth stretch anywhere. Every edge becomes four edges a third as long.',
    cap:k=> k===0 ? '<b>Generation 0: a triangle.</b> 3 edges. Now push the middle third of every edge out into a point.'
      : `<b>Generation ${k}.</b> The middle third of every edge has grown a point. ${fmtN(3*pow(4,k))} edges, each 1/${fmtN(pow(3,k))} as long. The perimeter is ${pow(4/3,k).toFixed(2)}× the triangle's and grows forever, yet the area never passes 1.6× the triangle.`,
    stats:k=>[fmtN(3*pow(4,k)),'edges', pow(4/3,k).toFixed(2)+'×','perimeter'],
    build(k,e){ const P=[]; for (let i=0;i<3;i++) kochRec(TRI[i],TRI[(i+1)%3],0,k,e,P);
      return {bbox:[-1,-1,1,1.02], draw:G=>{ fillPoly(G,P,css(palM(0.18+st.cycle),0.13)); strokeGrad(G,P,true,G.lw*1.3); }}; } },
  sier:{ name:'Sierpinski triangle', max:8, dim:Math.log(3)/Math.log(2), dimTxt:'log 3 ÷ log 2', zoom:{a:TRI[1], r:2}, legend:['bottom','top'],
    info:'Wacław Sierpiński, 1915. Cut the middle out of a triangle, then out of the three triangles left, and so on forever. It also appears in Pascal\'s triangle: colour the odd numbers and this is what you get.',
    cap:k=> k===0 ? '<b>Generation 0: a solid triangle.</b> Now cut out the triangle joining the middles of its sides.'
      : `<b>Generation ${k}.</b> The middle of every triangle is cut away. ${fmtN(pow(3,k))} triangles remain, each 1/${fmtN(pow(2,k))} the width. Only ${pctTxt(pow(0.75,k))} of the area is left, heading for zero, yet infinitely many points always remain.`,
    stats:k=>[fmtN(pow(3,k)),'triangles', pctTxt(pow(0.75,k)),'area left'],
    build(k,e){ const L=[]; const rec=(a,b,c,l)=>{ if (l>=Math.max(0,k-1)){ L.push([a,b,c]); return; } const ab=mid(a,b), bc=mid(b,c), ca=mid(c,a); rec(a,ab,ca,l+1); rec(ab,b,bc,l+1); rec(ca,bc,c,l+1); };
      rec(TRI[0],TRI[1],TRI[2],0); const bg=st.bg;
      return {bbox:[-0.9,-0.55,0.9,1.02], draw:G=>{ for (const [a,b,c] of L){ const cy=(a[1]+b[1]+c[1])/3, cx=(a[0]+b[0]+c[0])/3; fillPoly(G,[a,b,c],css(palM(((cy+0.5)/1.5*0.4+(cx+0.87)/1.74*0.1)+st.cycle)));
        if (k>0){ const ab=mid(a,b), bc=mid(b,c), ca=mid(c,a), m=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3], sc=q=>[m[0]+(q[0]-m[0])*e, m[1]+(q[1]-m[1])*e]; fillPoly(G,[sc(ab),sc(bc),sc(ca)],bg); } } }}; } },
  carpet:{ name:'Sierpinski carpet', max:5, dim:Math.log(8)/Math.log(3), dimTxt:'log 8 ÷ log 3', zoom:{a:[-1,-1], r:3}, legend:['bottom','top'],
    info:'Cut a square into 9, remove the middle one, and repeat in the 8 that are left. Any flat curve you can draw, however tangled, fits inside it somewhere: it is a universal plane curve.',
    cap:k=> k===0 ? '<b>Generation 0: a solid square.</b> Now cut it into 9 and remove the middle.'
      : `<b>Generation ${k}.</b> ${fmtN(pow(8,k))} squares, each 1/${fmtN(pow(3,k))} the width. ${pctTxt(pow(8/9,k))} of the area is left; in the limit, none.`,
    stats:k=>[fmtN(pow(8,k)),'squares', pctTxt(pow(8/9,k)),'area left'],
    build(k,e){ const L=[]; const rec=(x,y,s,l)=>{ if (l>=Math.max(0,k-1)){ L.push([x,y,s]); return; } const t=s/3; for (let i=0;i<3;i++) for (let j=0;j<3;j++) if (i!==1||j!==1) rec(x+i*t,y+j*t,t,l+1); };
      rec(-1,-1,2,0); const bg=st.bg;
      return {bbox:[-1,-1,1,1], draw:G=>{ const g=G.g; for (const [x,y,s] of L){ const a=G.tf([x,y+s]), b=G.tf([x+s,y]); g.fillStyle=css(palM((y+1)/2*0.4+(x+1)/2*0.1+st.cycle)); g.fillRect(a[0],a[1],b[0]-a[0]+0.5,b[1]-a[1]+0.5);
        if (k>0){ const h=s/3*e, c=x+s/2, d=y+s/2, p=G.tf([c-h/2,d+h/2]), q=G.tf([c+h/2,d-h/2]); g.fillStyle=bg; g.fillRect(p[0],p[1],q[0]-p[0],q[1]-p[1]); } } }}; } },
  cantor:{ name:'Cantor set', max:7, dim:Math.log(2)/Math.log(3), dimTxt:'log 2 ÷ log 3', zoom:{a:[0,0], r:3, xOnly:true}, legend:['left','right'],
    info:'Georg Cantor, 1883. Remove the middle third of a line, then the middle third of each piece, forever. The total length left is zero, yet there are as many points left as there were on the whole line.',
    cap:k=> k===0 ? '<b>Generation 0: a line.</b> Each row below removes the middle third of every piece above it.'
      : `<b>Generation ${k}.</b> ${fmtN(pow(2,k))} pieces, each 1/${fmtN(pow(3,k))} as long, totalling ${pctTxt(pow(2/3,k))} of the line. The leftover "dust" has dimension 0.63: more than a point, less than a line.`,
    stats:k=>[fmtN(pow(2,k)),'pieces', pctTxt(pow(2/3,k)),'length left'],
    build(k,e){ const gap=0.13, rows=[[[0,1]]];
      for (let r=1;r<=k;r++){ const g=r===k?e/3:1/3, prev=rows[r-1], next=[]; for (const [a,b] of prev){ const L=b-a; next.push([a,a+L*(1-g)/2],[b-L*(1-g)/2,b]); } rows.push(next); }
      return {bbox:[0,-7*gap-0.03,1,0.03], draw:G=>{ const g=G.g; rows.forEach((row,r)=>{ const y=-r*gap, h=Math.max(1.5,gap*0.45*G.s), alpha=r===k?Math.max(0.15,e):1;
        for (const [a,b] of row){ const p=G.tf([a,y]), q=G.tf([b,y]); g.fillStyle=css(palM((a+b)/2*0.5+st.cycle),alpha); g.fillRect(p[0],p[1]-h/2,Math.max(0.6,q[0]-p[0]),h); } }); }}; } },
  dragon:{ name:'Dragon curve', max:14, dim:2, dimTxt:'2 (its edge: ≈ 1.52)', legend:['start of curve','end'],
    info:'The Heighway dragon (NASA physicists, 1966). Fold a strip of paper in half again and again, then open every fold to a right angle. It never crosses itself, and four copies fit together around a point to tile the plane.',
    cap:k=> k===0 ? '<b>Generation 0: one segment.</b> Make a copy and swing it 90° around the end.'
      : `<b>Generation ${k}.</b> Copy the whole curve and swing the copy 90° around its last point. ${fmtN(pow(2,k))} segments, like a strip of paper folded ${k} times and opened to right angles.`,
    stats:k=>[fmtN(pow(2,k)),'segments', k+'','folds'],
    build(k,e){ let P; if (k===0) P=DRAGON[0]; else { const B=DRAGON[k-1], pv=B[B.length-1], a=e*Math.PI/2, c=Math.cos(a), s=Math.sin(a); P=B.slice(); for (let i=B.length-2;i>=0;i--){ const x=B[i][0]-pv[0], y=B[i][1]-pv[1]; P.push([pv[0]+c*x-s*y, pv[1]+s*x+c*y]); } }
      return {bbox:bboxOf(P), auto:true, draw:G=>strokeGrad(G,P,false,G.lw*(k>11?0.8:1.3))}; } },
  levy:{ name:'Lévy C curve', max:14, dim:2, dimTxt:'2', legend:['start of curve','end'],
    info:'Paul Lévy, 1938. Replace every segment with the two short sides of a right-angled triangle standing on it. The curve folds into a shape like a letter C made of smaller C\'s.',
    cap:k=> k===0 ? '<b>Generation 0: one segment.</b> Replace it with two at right angles.'
      : `<b>Generation ${k}.</b> Every segment became two at right angles. ${fmtN(pow(2,k))} segments, each ${pow(Math.SQRT1_2,k).toPrecision(2)} as long; the curve gets ${pow(Math.SQRT2,k).toFixed(1)}× longer but never leaves its C-shaped region.`,
    stats:k=>[fmtN(pow(2,k)),'segments', pow(Math.SQRT2,k).toFixed(1)+'×','length'],
    build(k,e){ const P=[]; levyRec([0,0],[1,0],0,k,e,P); P.push([1,0]); return {bbox:bboxOf(P), auto:true, draw:G=>strokeGrad(G,P,false,G.lw*(k>11?0.8:1.3))}; } },
  hilbert:{ name:'Hilbert curve', max:7, dim:2, dimTxt:'2 (fills the square)', legend:['start of curve','end'],
    info:'David Hilbert, 1891. A single line that visits every cell of a grid once, keeping nearby steps nearby. In the limit it passes through every point of the square: a 1D line that fills 2D space. Databases and maps use it to store nearby things near each other.',
    cap:k=> k===0 ? '<b>Generation 0: a single point</b> in the middle of the square.'
      : `<b>Generation ${k}.</b> The curve snakes through all ${fmtN(pow(4,k))} cells of a ${1<<k} × ${1<<k} grid, visiting each exactly once. Each generation is four copies of the last, turned so their ends join.`,
    stats:k=>[fmtN(pow(4,k)),'cells visited', `${1<<k}×${1<<k}`,'grid'],
    build(k,e){ if (k===0) return {bbox:[0,0,1,1], draw:G=>{ const p=G.tf([0.5,0.5]); G.g.fillStyle=css(palM(st.cycle)); G.g.beginPath(); G.g.arc(p[0],p[1],5,0,7); G.g.fill(); }};
      const P=hilbert(k), n=Math.max(2,Math.floor(P.length*e)), Q=hilbert(k-1);
      return {bbox:[0,0,1,1], draw:G=>{ if (e<1 && k>1){ G.g.globalAlpha=0.18*(1-e); strokeGrad(G,Q,false,G.lw*1.2); G.g.globalAlpha=1; } strokeGrad(G,P.slice(0,n),false,G.lw*(k>5?1:1.6)); }}; } },
  pyth:{ name:'Pythagoras tree', max:11, dim:2, dimTxt:'2 (at 45°)', angle:'pyth', legend:['trunk','tips'],
    info:'Albert Bosman, 1942. Stand two squares on top of every square, along the two short sides of a right triangle. By Pythagoras\' theorem the two new squares\' areas add up to exactly the old one\'s, so every generation adds the same amount of area.',
    cap:k=> k===0 ? '<b>Generation 0: one square.</b> Now stand two squares on it, along the sides of a right triangle.'
      : `<b>Generation ${k}.</b> ${fmtN(pow(2,k+1)-1)} squares. Each new pair's areas add up to its parent's (a² + b² = c²), so every generation adds exactly one more trunk's worth of area: ${k+1}× so far.`,
    stats:k=>[fmtN(pow(2,k+1)-1),'squares', (k+1)+'×','area of trunk'],
    build(k,e){ const Q=[], A=st.grow.angle.pyth*Math.PI/180;
      const rec=(a,b,l)=>{ const n=[a[1]-b[1], b[0]-a[0]], d=[a[0]+n[0],a[1]+n[1]], c=[b[0]+n[0],b[1]+n[1]], gr=l===k?e:1, m=mid(a,b), sc=p=>[m[0]+(p[0]-m[0])*gr, m[1]+(p[1]-m[1])*gr];
        Q.push({q:[sc(a),sc(b),sc(c),sc(d)], l}); if (l>=k) return;
        const ux=c[0]-d[0], uy=c[1]-d[1], ca=Math.cos(A), sa=Math.sin(A), ap=[d[0]+ca*(ca*ux-sa*uy), d[1]+ca*(sa*ux+ca*uy)]; rec(d,ap,l+1); rec(ap,c,l+1); };
      rec([-0.5,0],[0.5,0],0); const pts=Q.flatMap(o=>o.q);
      return {bbox:bboxOf(pts), auto:true, draw:G=>{ for (const o of Q){ fillPoly(G,o.q,css(palM(o.l/Math.max(1,GROW.pyth.max)*0.5+st.cycle))); } }}; } },
  tree:{ name:'Branching tree', max:11, dim:null, dimTxt:'depends on the angle', angle:'tree', legend:['trunk','twigs'],
    info:'Every branch splits into two smaller branches, each 0.7 as long, turned left and right by the angle. Real trees, rivers, lungs and lightning branch in the same self-similar way.',
    cap:k=> k===0 ? '<b>Generation 0: a trunk.</b> Every tip will split in two.'
      : `<b>Generation ${k}.</b> ${fmtN(pow(2,k))} new tips, ${fmtN(pow(2,k+1)-1)} branches in all, each new one 0.7 as long as its parent. Change the angle to see how the canopy fills in.`,
    stats:k=>[fmtN(pow(2,k+1)-1),'branches', fmtN(pow(2,k)),'tips'],
    build(k,e){ const L=[], A=st.grow.angle.tree*Math.PI/180;
      const rec=(p,an,len,l)=>{ const ln=l===k?len*e:len, q=[p[0]+Math.cos(an)*ln, p[1]+Math.sin(an)*ln]; L.push({a:p,b:q,l}); if (l>=k) return; rec(q,an+A,len*0.7,l+1); rec(q,an-A,len*0.7,l+1); };
      rec([0,0],Math.PI/2,1,0); const pts=L.flatMap(o=>[o.a,o.b]);
      return {bbox:bboxOf(pts), auto:true, draw:G=>{ const g=G.g; g.lineCap='round'; for (const o of L){ const a=G.tf(o.a), b=G.tf(o.b); g.strokeStyle=css(palM(o.l/11*0.5+st.cycle)); g.lineWidth=Math.max(0.6,G.lw*7*pow(0.68,o.l)); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); } }}; } },
  fern:{ name:'Barnsley fern', max:5, dim:null, dimTxt:'≈ 1.8', legend:['stem','tip'],
    info:'Michael Barnsley, 1988. Play the "chaos game": start anywhere and repeatedly apply one of four simple stretch-and-turn rules, chosen at random. The dots settle onto a fern. Each rule maps the whole fern onto one part of itself: the stem, the rest of the fern above the lowest leaves, the left leaf and the right leaf.',
    cap:k=> k===0 ? '<b>No dots yet.</b> Each dot is placed by one of four rules picked at random.'
      : `<b>${fmtN(FERN_N[k])} dots.</b> Each one came from the previous dot by a randomly chosen rule, yet together they always draw the same fern. Four rules, a handful of numbers each, encode the whole plant.`,
    stats:k=>[fmtN(FERN_N[k]),'dots', '4','rules'],
    build(k,e){ fernGrow(Math.round(FERN_N[Math.max(0,k-1)]+(FERN_N[k]-FERN_N[Math.max(0,k-1)])*(k===0?0:e)));
      return {bbox:[-2.2,0,2.7,10], draw:G=>{ const a=G.tf([-2.2,10]), b=G.tf([2.7,0]); G.g.imageSmoothingEnabled=true; G.g.drawImage(fern.cv,a[0],a[1],b[0]-a[0],b[1]-a[1]); }}; } },
};
const GOS={};
function gosper(k){ if (GOS[k]) return GOS[k]; let s='A'; for (let i=0;i<k;i++) s=s.replace(/[AB]/g, ch=>ch==='A'?'A-B--B+A++AA+B-':'+A-BB--B-A++A+B');
  let x=0,y=0,a=0; const P=[[0,0]]; for (const ch of s){ if (ch==='A'||ch==='B'){ x+=Math.cos(a); y+=Math.sin(a); P.push([x,y]); } else if (ch==='+') a+=Math.PI/3; else if (ch==='-') a-=Math.PI/3; }
  return GOS[k]=P; }
const apCount=k=>pow(3,k+1)+2;
Object.assign(GROW, {
  apollo:{ name:'Apollonian gasket', max:7, dim:1.3057, dimTxt:'≈ 1.3057', legend:['big circles','small'],
    info:'Apollonius of Perga (around 200 BC) asked how to draw a circle touching three others. Keep filling every curved-triangle gap with the biggest circle that fits, forever. Descartes found the rule in 1643: the "bends" (1 ÷ radius) of four touching circles obey a simple equation. Start with bends −1, 2, 2 and 3 (the outer circle counts as negative) and every circle in the whole gasket has a whole-number bend. The numbers are written in the bigger circles.',
    cap:k=> k===0 ? '<b>Generation 0: four circles inside one.</b> Bends −1 (the outside), 2, 2, 3 and 3. Every curved triangle between them is a gap to fill.'
      : `<b>Generation ${k}.</b> Every gap got the largest circle that touches all three of its neighbours: ${fmtN(apCount(k))} circles. Each new circle leaves three smaller gaps, so it never ends, yet the gaps' total area shrinks to zero. New bend = 2 × (sum of the three neighbours) − the old circle opposite.`,
    stats:k=>[fmtN(apCount(k)),'circles', fmtN(6*pow(3,k)),'gaps left'],
    build(k,e){ const C=[], O={k:-1,x:0,y:0,l:0}, A={k:2,x:-0.5,y:0,l:0}, B={k:2,x:0.5,y:0,l:0}, Cc={k:3,x:0,y:2/3,l:0}, D={k:3,x:0,y:-2/3,l:0};
      C.push(O,A,B,Cc,D);
      const rec=(a,b,c,d,l)=>{ if (l>k) return; const kn=2*(a.k+b.k+c.k)-d.k; if (kn>700) return;
        const n={k:kn, x:(2*(a.k*a.x+b.k*b.x+c.k*c.x)-d.k*d.x)/kn, y:(2*(a.k*a.y+b.k*b.y+c.k*c.y)-d.k*d.y)/kn, l}; C.push(n);
        rec(a,b,n,c,l+1); rec(b,c,n,a,l+1); rec(c,a,n,b,l+1); };
      for (const [a,b,c,d] of [[O,A,Cc,B],[O,B,Cc,A],[A,B,Cc,D],[O,A,D,B],[O,B,D,A],[A,B,D,Cc]]) rec(a,b,c,d,1);
      return {bbox:[-1,-1,1,1], draw:G=>{ const g=G.g, light=isLight();
        for (const c of C){ const r=Math.abs(1/c.k)*(c.l===k?e:1), p=G.tf([c.x,c.y]), R=r*G.s; if (R<0.3) continue;
          g.beginPath(); g.arc(p[0],p[1],R,0,7);
          if (c.k<0){ g.strokeStyle=css(palM(st.cycle)); g.lineWidth=G.lw*1.5; g.stroke(); continue; }
          g.fillStyle=css(palM(Math.min(1,Math.log(c.k)/Math.log(700))*0.5+st.cycle),0.9); g.fill(); g.strokeStyle=st.bg; g.lineWidth=Math.min(1.2,R*0.08); g.stroke();
          if (R>15){ g.fillStyle=light?'rgba(20,22,30,0.75)':'rgba(10,12,18,0.72)'; g.font=`600 ${Math.min(26,R*0.55)}px Inter, sans-serif`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(Math.round(c.k)),p[0],p[1]); g.textAlign='left'; g.textBaseline='alphabetic'; } } }}; } },
  vicsek:{ name:'Vicsek fractal', max:5, dim:Math.log(5)/Math.log(3), dimTxt:'log 5 ÷ log 3', zoom:{a:[0,0], r:3}, legend:['bottom','top'],
    info:'Tamás Vicsek, 1989. Cut a square into 9 and keep only the middle one and the four that share its edges, a plus sign. Repeat in each of the five. It ends up like a snowflake made of crosses, and engineers use it to shape small antennas that pick up many frequencies.',
    cap:k=> k===0 ? '<b>Generation 0: a solid square.</b> Now cut it into 9 and drop the four corners.'
      : `<b>Generation ${k}.</b> Every square became a plus sign of 5 smaller ones: ${fmtN(pow(5,k))} squares, each 1/${fmtN(pow(3,k))} the width, with ${pctTxt(pow(5/9,k))} of the area left.`,
    stats:k=>[fmtN(pow(5,k)),'squares', pctTxt(pow(5/9,k)),'area left'],
    build(k,e){ const L=[]; const rec=(x,y,s,l)=>{ if (l>=Math.max(0,k-1)){ L.push([x,y,s]); return; } const t=s/3; for (const [i,j] of [[1,1],[0,1],[2,1],[1,0],[1,2]]) rec(x+i*t,y+j*t,t,l+1); };
      rec(-1,-1,2,0);
      return {bbox:[-1,-1,1,1], draw:G=>{ const g=G.g; for (const [x,y,s] of L){ const t=s/3;
        for (let i=0;i<3;i++) for (let j=0;j<3;j++){ const corner=(i!==1&&j!==1); if (k===0 && (i||j)) continue; const sz = k===0 ? s : corner ? t*(1-e) : t; if (sz<=0) continue;
          const cx=k===0?x+s/2:x+i*t+t/2, cy=k===0?y+s/2:y+j*t+t/2, a=G.tf([cx-sz/2,cy+sz/2]), b=G.tf([cx+sz/2,cy-sz/2]);
          g.fillStyle=css(palM((cy+1)/2*0.4+(cx+1)/2*0.1+st.cycle)); g.fillRect(a[0],a[1],b[0]-a[0]+0.5,b[1]-a[1]+0.5); } } }}; } },
  gosper:{ name:'Gosper curve', max:5, dim:2, dimTxt:'2 (fills the "flowsnake" island)', legend:['start of curve','end'],
    info:'Bill Gosper, 1973, nicknamed the flowsnake. Each segment becomes 7 segments at 60° turns. The curve never crosses itself and fills a hexagon-like island whose edge is itself a fractal (dimension 1.13). Seven copies of the island fit together into a bigger copy of the same island.',
    cap:k=> k===0 ? '<b>Generation 0: one segment.</b> Each segment will become 7, wiggling at 60°.'
      : `<b>Generation ${k}.</b> ${fmtN(pow(7,k))} segments, each 1/${pow(Math.sqrt(7),k).toFixed(1)} as long as the whole. The curve snakes through a hexagonal grid without ever touching itself.`,
    stats:k=>[fmtN(pow(7,k)),'segments', '7','copies per step'],
    build(k,e){ const P=gosper(k), n=k===0?2:Math.max(2,Math.floor(P.length*e)), Q=k>0?gosper(k-1):null, bb=bboxOf(P);
      return {bbox:bb, auto:true, draw:G=>{ if (Q && e<1){ const sc=Math.sqrt(7), an=Math.atan2(P[P.length-1][1],P[P.length-1][0])-Math.atan2(Q[Q.length-1][1],Q[Q.length-1][0]), c=Math.cos(an)*sc, s=Math.sin(an)*sc;
          G.g.globalAlpha=0.2*(1-e); strokeGrad(G,Q.map(p=>[c*p[0]-s*p[1], s*p[0]+c*p[1]]),false,G.lw*1.4); G.g.globalAlpha=1; }
        strokeGrad(G,P.slice(0,n),false,G.lw*(k>3?1:1.6)); }}; } },
  htree:{ name:'H-tree', max:10, dim:2, dimTxt:'2 (fills a rectangle)', legend:['centre','tips'],
    info:'Draw an H, then a smaller H on each of its four tips, √2 times smaller, and repeat. The H-tree fills a rectangle, and every tip is exactly the same distance from the centre along the wires. That\'s why chip designers use it to deliver a clock signal to every part of a processor at the same instant.',
    cap:k=> k===0 ? '<b>Generation 0: one bar.</b> Each end will grow a crossbar √2 times shorter.'
      : `<b>Generation ${k}.</b> ${fmtN(pow(2,k+1)-1)} bars and ${fmtN(pow(2,k))} tips, every tip the same wire length from the centre. In the limit the tips touch every point of the rectangle.`,
    stats:k=>[fmtN(pow(2,k+1)-1),'bars', fmtN(pow(2,k)),'tips'],
    build(k,e){ const L=[]; const rec=(p,len,h,l)=>{ const ln=l===k?len*e:len, d=h?[ln/2,0]:[0,ln/2], a=[p[0]-d[0],p[1]-d[1]], b=[p[0]+d[0],p[1]+d[1]]; L.push({a,b,l}); if (l>=k) return; rec(a,len/Math.SQRT2,!h,l+1); rec(b,len/Math.SQRT2,!h,l+1); };
      rec([0,0],1,true,0); const full=[]; const rf=(p,len,h,l)=>{ const d=h?[len/2,0]:[0,len/2]; full.push([p[0]-d[0],p[1]-d[1]],[p[0]+d[0],p[1]+d[1]]); if (l>=Math.max(k,3)) return; rf([p[0]-d[0],p[1]-d[1]],len/Math.SQRT2,!h,l+1); rf([p[0]+d[0],p[1]+d[1]],len/Math.SQRT2,!h,l+1); }; rf([0,0],1,true,0);
      return {bbox:bboxOf(full), auto:true, draw:G=>{ const g=G.g; g.lineCap='round'; for (const o of L){ const a=G.tf(o.a), b=G.tf(o.b); g.strokeStyle=css(palM(o.l/10*0.5+st.cycle)); g.lineWidth=Math.max(0.7,G.lw*5*pow(0.78,o.l)); g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(b[0],b[1]); g.stroke(); } }}; } },
});
function mid(a,b){ return [(a[0]+b[0])/2,(a[1]+b[1])/2]; }
export const GROW_EXT=1.5, GROW_HOLD=1.1, GROW_END=4;
export function growStage(sh,t){ const per=GROW_EXT+GROW_HOLD; if (t<GROW_HOLD) return {k:0,e:1,x:1};
  t-=GROW_HOLD; const k=1+Math.floor(t/per); if (k>sh.max) return {k:sh.max,e:1,x:1,after:t-sh.max*per}; const x=clamp((t-(k-1)*per)/GROW_EXT,0,1); return {k,e:smooth(x),x}; }
export const growTotal=sh=>GROW_HOLD+sh.max*(GROW_EXT+GROW_HOLD);
export function drawGrow(){
  const g=octx, W=cssW, H=cssH, sh=GROW[st.grow.shape]; g.setTransform(ovScale,0,0,ovScale,0,0); g.clearRect(0,0,W,H);
  const s=growStage(sh,st.grow.t), zoomOn=st.grow.zoom && sh.zoom; let k=s.k, e=s.e; if (zoomOn){ k=sh.max; e=1; }
  const B=sh.build(k,e), top=70, bot=st.mode==='grow'?100:40, aw=Math.max(40,W-40), ah=Math.max(40,H-top-bot);
  const bw=Math.max(1e-6,B.bbox[2]-B.bbox[0]), bh=Math.max(1e-6,B.bbox[3]-B.bbox[1]), target=Math.min(aw/bw, ah/bh), bx=(B.bbox[0]+B.bbox[2])/2, by=(B.bbox[1]+B.bbox[3])/2;
  let F=st.grow.fit; if (!F || F.shape!==st.grow.shape || !B.auto){ F=st.grow.fit={shape:st.grow.shape, s:target, bx, by}; } else { F.s+=(target-F.s)*0.12; F.bx+=(bx-F.bx)*0.12; F.by+=(by-F.by)*0.12; }
  const gv=st.grow.gv, S=F.s*gv.z, cx=W/2+gv.ox, cy=top+ah/2+gv.oy;
  let tf=p=>[cx+(p[0]-F.bx)*S, cy-(p[1]-F.by)*S];
  if (zoomOn){ const Z=pow(sh.zoom.r, st.grow.zph), A=sh.zoom.a, base=tf; tf = sh.zoom.xOnly ? (p=>base([A[0]+(p[0]-A[0])*Z, p[1]])) : (p=>base([A[0]+(p[0]-A[0])*Z, A[1]+(p[1]-A[1])*Z])); }
  B.draw({g, tf, s:S*(zoomOn?pow(sh.zoom.r,st.grow.zph):1), lw:st.lw});
}
