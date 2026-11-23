// Complex Functions explorer: colour every point z of the plane (or of the Riemann sphere) by where f sends it.
// Importing this module boots the explorer; the exports are the lifecycle the shell (js/main.js) drives.
import { $, clamp, segClick, clickNext, setRange, setCheck, clickData, setStats, buildSwatches, rampCss, r4, r8, num, standardKeys, buildKeys, makeShare } from '../../js/common/kit.js';
import { rampOf, rampUniform, sampleRamp, hexRGB, PAL_GLSL, palTitle, loops } from '../../js/common/palettes.js';
import { parseFormula, toGLSL, toJS, usesVar, FORMULA_GLSL } from '../../js/common/formula.js';
import { makeGL, noWebGL } from '../../js/common/gl.js';
import { makeView2D } from '../../js/common/view2d.js';
import { saveCanvasPNG, saveFile, fileName } from '../../js/common/save.js';
import { stlFromTriangles, heightfieldTriangles } from '../../js/common/stl.js';
import { flashFx as flash, pulseFx as pulse, voiceFx as voice, colourStep, Phase, cycleBeats } from '../../js/shell/audio/react.js';
import { setPausedTag } from '../../js/shell/keys.js';
import { parseRoute } from '../../js/shell/route.js';
import { gamma, zeta, wp, SPECIAL_GLSL } from './special.js';
import { makeMotion2D, addRecorder } from '../../js/common/motion.js';
import { makeVisualizer, pickButton, randomSlider } from '../../js/common/visualizer.js';

// ---------- the functions ----------
const FNS = {
  z: { f: 'z', name: 'z', alt: 'the colour wheel itself: every point coloured by its own angle', info: 'The function that changes nothing. Its picture is the colour key for every other one: red points right, yellow up and to the left, round to blue below, and the rings show distance from 0 doubling outward.' },
  square: { f: 'z^2', name: 'z²', alt: 'squaring: angles double, so the colours go round twice', info: 'Squaring doubles every angle and squares every size, so the rainbow goes round twice about 0: 0 is a double zero. Each colour appears in two places, opposite each other, because z and −z have the same square.' },
  cubic: { f: 'z^3 - 1', name: 'z³ − 1', alt: 'three zeros: the three cube roots of 1', info: 'Zero at the three cube roots of 1, evenly spaced round a circle. Each is a point where all the colours meet, running round once. Far away it looks like z³: the colours go round three times.' },
  rational: { f: '(z^2 - 1)/(z^2 + 1)', name: '(z² − 1) ÷ (z² + 1)', alt: 'zeros at ±1, poles at ±i', info: 'Zeros at 1 and −1 (the top is 0 there) and poles at i and −i (the bottom is 0, so it shoots off to infinity). Round the zeros the colours run one way; round the poles, the other.' },
  inverse: { f: '1/z', name: '1 ÷ z', alt: 'turns the plane inside out', info: 'Swaps near and far: points close to 0 go far away, and far points come close. The colours run round 0 backwards, the mark of a pole. On the Riemann sphere it is simply a half turn of the ball.' },
  sqrt: { f: 'sqrt(z)', name: '√z', alt: 'halves every angle: watch the seam', info: 'Halves every angle, so the colours only get halfway round. Every number (but 0) has two square roots, so the function has to choose one, and its choice jumps along the negative axis: a branch cut, the visible seam.' },
  exp: { f: 'exp(z)', name: 'eᶻ', alt: 'the exponential: stripes that repeat going up', info: 'eˣ⁺ⁱʸ = eˣ (cos y + i sin y): moving up turns the answer round, moving right makes it bigger. So the colours repeat in horizontal bands every 2π, and the rings are vertical lines. It is never 0.' },
  log: { f: 'log(z)', name: 'log z', alt: 'the logarithm: the exponential backwards', info: 'Undoes eᶻ. Its angle part is the angle of z itself, so the colours sweep round once with a seam on the negative axis (another branch cut), and its size grows ever so slowly outward.' },
  sin: { f: 'sin(z)', name: 'sin z', alt: 'zeros evenly along the real line', info: 'On the real line it is the familiar wave, zero at every multiple of π. Off the line it grows like eʸ, so the colours stretch into tall flames above and below each zero.' },
  tan: { f: 'tan(z)', name: 'tan z', alt: 'zeros and poles taking turns', info: 'sin z ÷ cos z: zeros where sin is 0, poles where cos is 0, alternating along the real line. Far up or down it settles to i or −i: one flat colour each.' },
  mobius: { f: '(z - 1)/(z + 1)', name: '(z − 1) ÷ (z + 1)', alt: 'a Möbius map: circles go to circles', info: 'A Möbius transformation, (az + b) ÷ (cz + d): one zero, one pole. These maps send circles to circles and keep every angle; on the Riemann sphere each is just a rotation or a slide of the ball.' },
  joukowski: { f: 'z + 1/z', name: 'z + 1 ÷ z', alt: 'Joukowski\'s map: circles become wing shapes', info: 'Nikolai Joukowski used it in 1910 to turn the easy problem of air flowing round a cylinder into the hard one of air flowing round a wing: it sends circles to aerofoil shapes. Choose Grid to see how it bends the plane.' },
  gamma: { glsl: 'cgamma(z)', js: z => gamma(z), view: [0, 0, 4.5], name: 'Γ(z)', alt: 'the Gamma function: factorials for every number', info: 'Euler\'s Gamma function fills in the factorials: Γ(n + 1) = n! = 1 × 2 × … × n for whole numbers, and it carries on smoothly in between and across the whole plane. It never reaches zero, but it has a pole at 0 and at every negative whole number: watch them line up along the left.' },
  zeta: { glsl: 'czeta(z)', js: z => zeta(z), view: [0.5, 14, 17], name: 'ζ(z)', alt: 'Riemann\'s zeta function: where the primes hide', info: 'ζ(s) = 1 + 1/2ˢ + 1/3ˢ + …, carried on across the plane. It knows where the prime numbers are. Its zeros on the vertical line through ½ (here near heights 14.13, 21.02, 25.01) are where all the colours meet. The Riemann hypothesis says every such zero, except the ones at −2, −4, −6…, lies exactly on that line. Nobody has proved it; it is worth a million dollars.' },
  wp: { glsl: 'cwp(z)', js: z => wp(z), view: [0, 0, 1.2], name: '℘(z)', alt: 'Weierstrass\'s function: the same picture on every square', info: 'Karl Weierstrass\'s ℘ function repeats in two directions at once: shift by 1 or by i and nothing changes, so the plane is tiled with copies of one square. Each square has a double pole at its corner. Functions like this describe the motion of a pendulum swinging all the way round, and they built the Costa surface in Surfaces & Knots.' },
  blaschke: { f: '(z-0.5)/(1-0.5*z) * (z+0.3-0.6*i)/(1+(0.3+0.6*i)*z) * (z+0.4+0.4*i)/(1+(0.4-0.4*i)*z)', view: [0, 0, 1.4], name: 'Blaschke product', alt: 'three zeros inside the circle, size 1 all round it', info: 'A Blaschke product puts zeros inside the unit circle, each paired with a pole outside, so that on the circle itself the size is exactly 1 everywhere: choose Angle + rings and see that ring sit on the circle. They are the building blocks of functions that keep the disc to itself.' },
  zz: { f: 'z^z', view: [0, 0, 3], name: 'zᶻ', alt: 'a number raised to itself', info: 'z to the power z. For whole numbers it grows fast (3³ = 27), between 0 and 1 it dips to a low of about 0.69 at 1/e, and across the plane it makes swirling bands. It needs a branch cut, like the logarithm it is built from.' },
  newton: { f: 'z - (z^3 - 1)/(3*z^2)', steps: 14, view: [0, 0, 1.6], name: 'Newton\'s method', alt: 'hunting the roots of z³ − 1: raise Steps', info: 'Newton\'s method finds where z³ − 1 = 0 by sliding down the tangent again and again. Raise Steps: almost every starting point ends up at one of the three roots, but the borders between their territories are a fractal where all three meet everywhere: wherever two colours touch, the third is there too.' },
  essential: { f: 'exp(1/z)', view: [0, 0, 0.8], name: 'e^(1/z)', alt: 'an essential singularity: everything happens near 0', info: 'Near 0 this function goes completely wild. Picard\'s great theorem says that in any tiny circle round such a point it takes every value (except one) infinitely often: zoom in on 0 and the colours never settle.' },
  sininv: { f: 'sin(1/z)', view: [0, 0, 0.5], name: 'sin(1/z)', alt: 'zeros piling up at 0', info: 'sin(1/z) is zero wherever 1/z is a multiple of π: at 1/π, 1/2π, 1/3π… crowding ever closer to 0. At 0 itself there is an essential singularity.' },
  roots8: { f: 'z^8 - 1', view: [0, 0, 1.6], name: 'z⁸ − 1', alt: 'the eighth roots of 1, round a circle', info: 'Eight zeros, evenly spaced round the unit circle: the eighth roots of 1. Far away it looks like z⁸, the colours wheeling round eight times.' },
  branch: { f: 'sqrt(z^2 - 1)', view: [0, 0, 2], name: '√(z² − 1)', alt: 'two branch points, joined by cuts', info: 'Square roots have two answers, so this function must choose one, and its choice jumps across lines: the branch cuts. Zeros at ±1 are branch points, where the two answers meet.' },
  cayley: { f: '(z - i)/(z + i)', view: [0, 0, 3], name: 'Cayley map', alt: 'the upper half-plane folded into a disc', info: 'Arthur Cayley\'s map sends the upper half of the plane exactly onto the inside of the unit circle: i goes to 0 and the real line wraps round the circle. It\'s how the half-plane and disc pictures of the hyperbolic plane in Tilings are the same thing.' },
  cubicjulia: { f: 'z^3 + c', steps: 18, c: [0.4, 0.2], view: [0, 0, 1.4], name: 'z³ + c', alt: 'a three-fold Julia set: raise Steps', info: 'Cube instead of square and the Julia sets get three-fold symmetry. As with z² + c, points that escape are shaded by how fast; the frontier is the Julia set.' },
  expjulia: { f: 'exp(z) + c', steps: 14, c: [-0.65, 0], view: [-0.5, 0, 3], name: 'eᶻ + c', alt: 'an exponential Julia set: hairs and bouquets', info: 'Iterating eᶻ + c gives Julia sets made of infinitely many hairs reaching off to the right, called a Cantor bouquet. These sets fill no area, yet adding up their points gives the whole plane minus the hairs.' },
  zexp: { f: 'z*exp(z)', view: [-1, 0, 3], name: 'z·eᶻ', alt: 'the function whose inverse is Lambert\'s W', info: 'z·eᶻ turns up whenever something grows in proportion to itself and time together. Undoing it needs a new function, Lambert\'s W, which has infinitely many branches: one for every band of colour here.' },
  julia: { f: 'z^2 + c', name: 'z² + c', alt: 'the Julia-set rule: raise Steps and watch', info: 'The rule behind the Mandelbrot and Julia sets. Applied once it is just a shifted square. Raise Steps: each step feeds the answer back in, the swirls fold into finer swirls, and the Julia set for this c appears where the colours never settle.' },
  roots: { roots: true, name: 'Zeros & poles', alt: 'place them yourself and drag them about', info: 'A function built from the zeros and poles you place: (z − zero₁)(z − zero₂)… ÷ (z − pole₁)(z − pole₂)…. Drag them about and watch the colours follow. Bring a zero and a pole together and they cancel out.' },
};

// ---------- state ----------
const st = { fn: 'cubic', custom: '', steps: 1, c: [-0.8, 0.156], cWander: false, view: 'plane', spin: true, yaw: 0.6, pitch: 0.35, sz: 1, style: 1, dens: 1, axes: false,
  palette: 'wheel', palRev: false, cycle: 0, cycleSpeed: 0, bg: '#0b0d12', paused: false, mm: 80, high: 8,
  roots: [[1, 0], [-0.5, 0.866], [-0.5, -0.866]], poles: [[0.6, 0.6]] };
const formulaNow = () => (FNS[st.fn] && FNS[st.fn].f ? FNS[st.fn].f : st.fn === 'custom' ? st.custom : null);

// ---------- WebGL ----------
const cv = $('cc'), ov = $('co'), og = ov.getContext('2d'), G = makeGL(cv);
if (!G) throw noWebGL($('na'), 'Complex Functions');
const g = G.g;
function fsFor(expr) {
  return `#version 300 es
precision highp float;
out vec4 outC;
uniform vec2 u_res, u_center, u_c, u_ang; uniform float u_scale, u_density, u_cycle, u_zoomS, u_flash; uniform int u_steps, u_style, u_loop, u_sphere, u_axes, u_nr, u_np;
uniform vec3 u_bg; uniform mat3 u_rot; uniform vec2 u_roots[8], u_poles[8];
${PAL_GLSL}
${FORMULA_GLSL}
${SPECIAL_GLSL}
vec2 F(vec2 z, vec2 c){ ${expr === null ? 'vec2 n=vec2(1.0,0.0), d=vec2(1.0,0.0); for (int i=0;i<8;i++){ if (i<u_nr) n=cm(n,z-u_roots[i]); if (i<u_np) d=cm(d,z-u_poles[i]); } return cdiv(n,d);' : 'return ' + expr + ';'} }
// the angle picks a colour from the palette: once round for a palette that ends where it starts (the colour wheel), there and back for the rest, so there's no seam
vec3 angleCol(vec2 w){ float t=fract(atan(w.y,w.x)/6.2831853+1.0+u_cycle); return u_loop==1 ? pal(t*0.4999) : pal(t*0.999); }
vec3 colourAt(vec2 z){
  // with more than one step, points that run off to infinity are shaded by how quickly they escaped (their angle there is meaningless noise)
  vec2 w=z; int esc=-1; for (int i=0;i<64;i++){ if (i>=u_steps) break; w=F(w,u_c); if (u_steps>1 && dot(w,w)>1e8){ esc=i; break; } if (dot(w,w)>1e20) break; }
  if (esc>=0){ float sm=float(esc)+1.0-log2(log2(dot(w,w))/log2(1e8)); return pal(fract(sm*0.11*u_density+u_cycle))*(0.30+0.70*exp(-sm*0.05))*(1.0+0.35*u_flash)+0.05*u_flash; }
  float r=length(w), lr=log2(max(r,1e-30)); vec3 col = u_style==5 ? pal(clamp(0.5+lr*0.07*u_density,0.0,1.0)*0.5+u_cycle) : angleCol(w);
  if (u_style==1){ col*=0.70+0.30*fract(lr*u_density); float a=fract(atan(w.y,w.x)/6.2831853*12.0*u_density); col*=0.88+0.12*smoothstep(0.0,0.12,a); }
  else if (u_style==2){ float L=0.6366198*atan(r); col = L<0.5 ? col*(L*2.0) : mix(col,vec3(1.0),(L-0.5)*2.0); }
  else if (u_style==3){ vec2 gq=w*u_density*2.0, fw=fwidth(gq), d=abs(fract(gq-0.5)-0.5)/max(fw,vec2(1e-6)); float line=1.0-min(min(d.x,d.y),1.0); col=mix(mix(col,vec3(1.0),0.5),vec3(0.06),line*0.85); }
  else if (u_style==4){ vec2 gq=floor(w*u_density*2.0); float ch=mod(gq.x+gq.y,2.0); col=mix(col*0.5,min(col*1.08+0.06,vec3(1.0)),ch); }
  return col*(1.0+0.35*u_flash)+0.05*u_flash; }
void main(){
  vec2 p=gl_FragCoord.xy-0.5*u_res; vec3 col;
  if (u_sphere==1){
    vec2 q=p/(0.5*u_res.y); vec3 ro=vec3(0.0,0.0,3.2), rd=normalize(vec3(q*0.42*u_zoomS,-1.0));
    float b=dot(ro,rd), cc=dot(ro,ro)-1.0, h=b*b-cc;
    if (h<0.0) col=u_bg*(1.0+0.3*(0.4-length(q)))+0.01;
    else { vec3 n=ro+rd*(-b-sqrt(h)), s=u_rot*n; vec2 z=s.xy/max(1.0-s.z,1e-7); col=colourAt(z);
      vec3 L=normalize(vec3(0.5,0.6,0.8)); col*=0.38+0.72*max(dot(n,L),0.0); col+=0.22*pow(max(dot(reflect(rd,n),L),0.0),40.0); }
  } else {
    float px=u_scale/(0.5*u_res.y); vec2 z=u_center+mat2(u_ang.x,u_ang.y,-u_ang.y,u_ang.x)*p*px; col=colourAt(z);
    if (u_axes==1){ float d=min(abs(z.x),abs(z.y))/px; col=mix(col,vec3(1.0),0.7*(1.0-smoothstep(0.5,1.5,d))); }
  }
  outC=vec4(col,1.0); }`;
}
let prog = null, progErr = '', jsF = null, usesC = false;
function compile() {
  const f = formulaNow(); progErr = '';
  try {
    const sp = FNS[st.fn] && FNS[st.fn].glsl;
    if (sp) { prog = G.prog(fsFor(FNS[st.fn].glsl)); jsF = FNS[st.fn].js; usesC = false; }
    else if (f === null) { prog = G.prog(fsFor(null)); jsF = (z) => { let n = [1, 0], d = [1, 0]; const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
      for (const r of st.roots) n = mul(n, [z[0] - r[0], z[1] - r[1]]); for (const p of st.poles) d = mul(d, [z[0] - p[0], z[1] - p[1]]); const q = d[0] * d[0] + d[1] * d[1] || 1e-300; return [(n[0] * d[0] + n[1] * d[1]) / q, (n[1] * d[0] - n[0] * d[1]) / q]; }; usesC = false; }
    else { const tree = parseFormula(f, true); prog = G.prog(fsFor(toGLSL(tree))); const j = toJS(tree); jsF = (z, c) => j(z, c); usesC = usesVar(tree, 'c'); }
  } catch (e) { progErr = e.message || String(e); }
  $('fnNote').classList.toggle('fnerr', !!progErr);
  $('fnNote').textContent = progErr ? 'That formula didn\'t work: ' + progErr : 'Use z, the number c (set below), i, pi, e, + − × ÷ ^, brackets, and sin cos tan sinh cosh tanh exp log sqrt abs conj re im arg.';
  $('cRow').hidden = !usesC; $('toFractal').hidden = f === null; dirty = true;
}

// ---------- view ----------
let dirty = true;
const view = makeView2D(cv, { home: { cx: 0, cy: 0, scale: 2 }, min: 2e-5, max: 1e4, onChange: () => { dirty = true; share.touch(); },
  onDrag: (e, dx, dy) => { if (st.view === 'sphere') { st.yaw += dx * 0.008; st.pitch = clamp(st.pitch + dy * 0.008, -1.5, 1.5); dirty = true; share.touch(); return true; }
    if (grab) { const [x0, y0] = view.toWorld(e.clientX - dx, e.clientY - dy), [x1, y1] = view.toWorld(e.clientX, e.clientY); grab.p[0] += x1 - x0; grab.p[1] += y1 - y0; dirty = true; share.touch(); return true; } return false; } });
// grabbing a zero or a pole marker
let grab = null;
cv.addEventListener('pointerdown', e => { grab = null; if (st.fn !== 'roots' || st.view !== 'plane') return;
  let best = 16; for (const p of [...st.roots, ...st.poles]) { const [sx, sy] = view.toScreen(p[0], p[1]), d = Math.hypot(sx - e.clientX, sy - e.clientY); if (d < best) { best = d; grab = { p }; } } }, true);
cv.addEventListener('pointerup', () => { grab = null; });
cv.addEventListener('wheel', e => { if (st.view !== 'sphere') return; e.preventDefault(); e.stopImmediatePropagation(); st.sz = clamp(st.sz * Math.exp(e.deltaY * 0.0012), 0.35, 2.2); dirty = true; }, { capture: true, passive: false });
let hover = null;
cv.addEventListener('pointermove', e => { if (st.view === 'plane') { hover = view.toWorld(e.clientX, e.clientY); showPointer(); } });
cv.addEventListener('pointerleave', () => { hover = null; showPointer(); });
const rotMat = () => { const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
  // world n -> turned n' = Rx(pitch) Ry(yaw) n -> sphere s = (n'.x, -n'.z, n'.y): up on screen is the north pole, where infinity is
  const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Rx = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]], M = Rx.map(r => [0, 1, 2].map(j => r[0] * Ry[0][j] + r[1] * Ry[1][j] + r[2] * Ry[2][j]));
  const S3 = [M[0], M[2].map(x => -x), M[1]];   // rows of the full matrix
  return new Float32Array([S3[0][0], S3[1][0], S3[2][0], S3[0][1], S3[1][1], S3[2][1], S3[0][2], S3[1][2], S3[2][2]]); };

// ---------- drawing ----------
let R = rampOf('aurora', false), flashNow = 0, pulseNow = 0;
function draw() {
  G.fit(Math.min(devicePixelRatio, 1.5)); if (!prog) return;
  g.useProgram(prog.p); const U = n => prog.u(n), w = cv.width, h = cv.height, pu = rampUniform(R);
  g.uniform2f(U('u_res'), w, h); g.uniform2f(U('u_center'), view.cx, view.cy); g.uniform2f(U('u_ang'), Math.cos(view.rot), Math.sin(view.rot)); g.uniform1f(U('u_scale'), view.eff()); g.uniform2f(U('u_c'), st.c[0], st.c[1]);
  g.uniform1i(U('u_steps'), st.steps); g.uniform1i(U('u_style'), st.style); g.uniform1i(U('u_loop'), loops(R) ? 1 : 0); g.uniform1f(U('u_density'), st.dens); g.uniform1f(U('u_cycle'), st.cycle);
  g.uniform1i(U('u_sphere'), st.view === 'sphere' ? 1 : 0); g.uniform1i(U('u_axes'), st.axes ? 1 : 0); g.uniform3f(U('u_bg'), ...hexRGB(st.bg)); g.uniform1f(U('u_zoomS'), st.sz * (1 - 0.03 * pulseNow) * Math.max(1, h / Math.max(1, w))); g.uniform1f(U('u_flash'), flashNow);
  g.uniformMatrix3fv(U('u_rot'), false, rotMat()); g.uniform3fv(U('u_pal'), pu.data); g.uniform1i(U('u_npal'), pu.n);
  const flat = (a, n) => { const f = new Float32Array(16); a.slice(0, 8).forEach((p, i) => { f[i * 2] = p[0]; f[i * 2 + 1] = p[1]; }); return f; };
  g.uniform2fv(U('u_roots'), flat(st.roots)); g.uniform2fv(U('u_poles'), flat(st.poles)); g.uniform1i(U('u_nr'), Math.min(8, st.roots.length)); g.uniform1i(U('u_np'), Math.min(8, st.poles.length));
  G.draw(null, w, h); drawOverlay();
}
function drawOverlay() {
  const r = ov.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2); if (ov.width !== Math.round(r.width * d)) { ov.width = Math.round(r.width * d); ov.height = Math.round(r.height * d); }
  og.setTransform(d, 0, 0, d, 0, 0); og.clearRect(0, 0, r.width, r.height);
  if (st.fn !== 'roots' || st.view !== 'plane') return;
  const cr = cv.getBoundingClientRect(); og.lineWidth = 2.2;
  for (const [list, pole] of [[st.roots, false], [st.poles, true]]) for (const p of list) { const [sx, sy] = view.toScreen(p[0], p[1]), x = sx - cr.left, y = sy - cr.top;
    og.strokeStyle = 'rgba(0,0,0,.7)'; og.lineWidth = 4.5; mark(x, y, pole); og.strokeStyle = '#fff'; og.lineWidth = 2; mark(x, y, pole); }
}
function mark(x, y, pole) { og.beginPath(); if (pole) { og.moveTo(x - 7, y - 7); og.lineTo(x + 7, y + 7); og.moveTo(x + 7, y - 7); og.lineTo(x - 7, y + 7); } else og.arc(x, y, 7, 0, 2 * Math.PI); og.stroke(); }

// ---------- the numbers: where the point under the pointer goes ----------
const fmtC = (z, dg = 3) => { if (!z.every(isFinite) || Math.hypot(...z) > 1e9) return '∞'; const a = z[0].toFixed(dg).replace('-', '−'), b = Math.abs(z[1]).toFixed(dg); return `${a} ${z[1] < 0 ? '−' : '+'} ${b}i`; };
const evalAt = z => { if (!jsF) return [NaN, NaN]; let w = z; for (let i = 0; i < st.steps; i++) { w = jsF(w, st.c); if (!w.every(isFinite) || Math.hypot(...w) > 1e10) break; } return w; };
function showPointer() {
  if (!hover) { $('atPointer').textContent = st.view === 'plane' ? 'Point at the picture to see where that z goes.' : 'Turn the sphere by dragging; scroll to zoom.'; setStats(['–', 'size |w|'], ['–', 'angle of w'], [String(st.steps), st.steps === 1 ? 'step' : 'steps']); return; }
  const w = evalAt(hover), r = Math.hypot(...w), a = Math.atan2(w[1], w[0]) * 180 / Math.PI;
  setStats([isFinite(r) && r < 1e9 ? (r < 1000 ? r.toPrecision(3) : r.toExponential(1)) : '∞', 'size |w|'], [isFinite(a) ? Math.round(a) + '°' : '–', 'angle of w'], [String(st.steps), st.steps === 1 ? 'step' : 'steps']);
  $('atPointer').textContent = `z = ${fmtC(hover)}  →  w = ${fmtC(w)}`;
}

// ---------- panel ----------
$('fnList').innerHTML = Object.entries(FNS).map(([k, f]) => `<button data-f="${k}">${f.name}</button>`).join('');
segClick('fnList', d => { pickFn(d.f); if (st.view === 'sphere') clickData('#viewMode', 'v', 'plane'); });   /* every function opens on the plane; the sphere is chosen for one at a time */
function pickFn(k, keep) {
  if (k !== 'custom' && !FNS[k]) return; st.fn = k; document.querySelectorAll('#fnList button').forEach(b => b.classList.toggle('on', b.dataset.f === k));
  $('rootSec').hidden = k !== 'roots';
  if (!keep && FNS[k]) { const v = FNS[k].view || [0, 0, 2]; view.home = { cx: v[0], cy: v[1], scale: v[2] }; view.reset(); setRange('steps', FNS[k].steps || 1);   // each function opens on its best view
    if (FNS[k].c) { st.c = FNS[k].c.slice(); $('cre').value = st.c[0]; $('cim').value = st.c[1]; showC(); } }
  compile(); labels(); dirty = true; share.touch();
}
$('fnApply').addEventListener('click', () => { const t = $('fnIn').value.trim(); if (!t) return; st.custom = t; pickFn('custom'); });
$('fnIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('fnApply').click(); });
function labels() {
  const f = FNS[st.fn], name = f ? f.name : 'f(z) = ' + st.custom;
  $('title').textContent = st.steps > 1 ? `${name}, ${st.steps} steps` : name; $('subtitle').textContent = f ? f.alt : 'your own function'; $('gv-shapes').textContent = name;
  $('about').innerHTML = f ? `<strong>${f.name}.</strong> ${f.info}` : `<strong>Your own function.</strong> Every point z is coloured by where your formula sends it. Zeros are where all the colours meet running one way round; poles, the other way.`;
  const L = st.style === 5 ? ['small', 'large'] : ['angle 0', 'one turn']; $('lgL').textContent = L[0]; $('lgR').textContent = L[1];
  $('lgBar').style.background = rampCss(st.style === 5 || loops(R) ? R : R.concat(R.slice(0, -1).reverse()));   /* angles run there and back through a palette that doesn't loop */
  $('cmodeNote').textContent = ['Angle only: the colour shows which way w points.', 'Angle, plus rings where the size doubles: the classic phase portrait.', 'Angle, darkening toward zeros and whitening toward poles.', 'Lines where w\'s real and imaginary parts are whole numbers: they cross at right angles wherever f is smooth.', 'A chessboard laid on the answers, carried back: you see how f stretches and turns each square.', 'Size only, coloured by the palette: a map of the landscape |f(z)|.'][st.style];
  const el = $('stageCap'); let cap = progErr ? '<b>That formula didn\'t work.</b> ' + progErr : '';
  if (!cap && st.fn === 'julia' && st.steps >= 6) cap = `<b>${st.steps} steps of z² + c.</b> Points that run off to infinity are shaded by how quickly they escape; those that stay keep the angle colours. The intricate edge between them is the Julia set for c = ${fmtC(st.c, 3)}.`;
  el.innerHTML = cap; el.style.display = cap ? 'block' : 'none';
}
segClick('viewMode', d => { st.view = d.v; $('spinRow').hidden = st.view !== 'sphere'; $('bgSec').hidden = st.view !== 'sphere';   /* the plane fills the screen: no background to see */ $('hint').textContent = st.view === 'sphere' ? 'Drag to turn the sphere · scroll to zoom · 0 is at the bottom, infinity at the top' : 'Drag to move · scroll / pinch to zoom · arrows and W A S D to move around'; hover = null; showPointer(); dirty = true; share.touch(); });
$('spin').addEventListener('change', e => { st.spin = e.target.checked; share.touch(); });
$('steps').addEventListener('input', e => { st.steps = +e.target.value; $('stepso').textContent = st.steps; labels(); showPointer(); dirty = true; share.touch(); });
const showC = () => { $('creo').textContent = st.c[0].toFixed(2).replace('-', '−'); $('cimo').textContent = st.c[1].toFixed(2).replace('-', '−'); };
$('cre').addEventListener('input', e => { st.c[0] = +e.target.value; showC(); labels(); dirty = true; share.touch(); });
$('cim').addEventListener('input', e => { st.c[1] = +e.target.value; showC(); labels(); dirty = true; share.touch(); });
$('cWander').addEventListener('change', e => { st.cWander = e.target.checked; share.touch(); });
$('toFractal').addEventListener('click', () => { const f = formulaNow(); if (f === null) return;
  location.hash = `#/fractal/v=11&m=explore&t=custom&x=0&y=0&sc=1.6&j=1&c=${r4(st.c[0])}_${r4(st.c[1])}&f=${encodeURIComponent(f)}&bail=100`; });
$('addZero').addEventListener('click', () => { if (st.roots.length < 8) st.roots.push([view.cx + (Math.random() - 0.5) * view.scale, view.cy + (Math.random() - 0.5) * view.scale]); dirty = true; share.touch(); });
$('addPole').addEventListener('click', () => { if (st.poles.length < 8) st.poles.push([view.cx + (Math.random() - 0.5) * view.scale, view.cy + (Math.random() - 0.5) * view.scale]); dirty = true; share.touch(); });
$('removeLast').addEventListener('click', () => { if (st.poles.length >= st.roots.length && st.poles.length) st.poles.pop(); else if (st.roots.length) st.roots.pop(); dirty = true; share.touch(); });
$('dens').addEventListener('input', e => { st.dens = +e.target.value; $('denso').textContent = st.dens.toFixed(1) + '×'; dirty = true; share.touch(); });
$('axes').addEventListener('change', e => { st.axes = e.target.checked; dirty = true; share.touch(); });
segClick('cmode', d => { st.style = +d.c; labels(); dirty = true; share.touch(); });
buildSwatches($('palettes'), st.palette, name => { st.palette = name; R = rampOf(st.palette, st.palRev); palLabel(); labels(); dirty = true; share.touch(); });
const palLabel = () => { $('palName').textContent = 'Palette: ' + palTitle(st.palette) + (st.palRev ? ' (reversed)' : ''); };
$('palRev').addEventListener('change', e => { st.palRev = e.target.checked; R = rampOf(st.palette, st.palRev); palLabel(); labels(); dirty = true; share.touch(); });
$('cyc').addEventListener('input', e => { st.cycleSpeed = +e.target.value; $('cyco').textContent = st.cycleSpeed ? st.cycleSpeed.toFixed(1) + '×' : 'off'; share.touch(); });
segClick('bg', d => { st.bg = d.b; dirty = true; share.touch(); });
segClick('prSize', d => { st.mm = +d.mm; });
$('prHigh').addEventListener('input', e => { st.high = +e.target.value; $('prHigho').textContent = st.high + ' mm'; });
$('snap').addEventListener('click', () => { draw(); const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const x = c.getContext('2d'); x.drawImage(cv, 0, 0); x.drawImage(ov, 0, 0, c.width, c.height);   // with the zero and pole markers
  saveCanvasPNG(c, fileName(fileBase()) + '.png', $('dlnote')); });
document.querySelectorAll('.btn.try').forEach(b => b.addEventListener('click', () => { const [k, x] = b.dataset.try.split('|');
  pickFn(k); if (x === 'sphere') clickData('#viewMode', 'v', 'sphere'); else clickData('#viewMode', 'v', 'plane'); if (x === '3') clickData('#cmode', 'c', '3');
  if (x === 'steps') { setRange('steps', 1); stepsAnim = { t: 0 }; } view.reset(); }));
buildKeys($('keyTable'), [['G', 'Grow: raise Steps one at a time (watch a fractal appear)'], ['N', 'Back to 1 step'], ['1 – 6', 'Colour styles'], ['← → ↑ ↓', 'Move around'], ['W A S D', 'Move around'], ['Shift', 'Hold with the keys above to go three times faster']]);

// ---------- actions ----------
let stepsAnim = null;
function go() { st.paused = false; if (st.steps >= 40) setRange('steps', 1); stepsAnim = { t: 0 }; }
function resetView() { st.paused = false; view.reset(); MO.resetView(); st.yaw = 0.6; st.pitch = 0.35; st.sz = 1; dirty = true; share.touch(); }

// ---------- loop ----------
const clk = { wander: new Phase() };
// Motion (its own group): drift, zoom and turn the plane (on the sphere: roll it round and zoom), and Slowly change
const sph = () => st.view === 'sphere';
const MO = makeMotion2D({ rows: $('spinRow'), rotate: a => { if (sph()) st.yaw += a; else view.rotate(a); dirty = true; },
  pan: (dx, dy) => { if (sph()) { st.yaw += 2.5 * dx; st.pitch = clamp(st.pitch - 2.5 * dy, -1.5, 1.5); } else view.glide(dx, dy); dirty = true; },
  zoom: f => { dirty = true; if (!sph()) return view.zoomBy(f); const s = clamp(st.sz * f, 0.35, 2.2), ok = s !== st.sz; st.sz = s; return ok; },
  sweep: { skip: [] } });
const REC = addRecorder({ stage: cv.parentElement, name: () => fileBase(), bg: () => st.bg });
// the Visualizer: a new function, palette or slow change every eight bars; when the chorus comes in, the function is
// fed back into itself step by step (it grows into a fractal), and goes back to one step at the next change
makeVisualizer(MO, { preset: 'mvd=0.3&mvw=1&mvb=0.35&mvn=0.15', shape: () => pickButton('#fnList button'),
  drop: () => { go(); return () => { stepsAnim = null; setRange('steps', 1); }; } });
let running = false, tPrev = 0, wanderT = 0, frame = 0;
function loop(now) {
  if (!running) return; const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now; frame++;
  setPausedTag(st.paused); const go = !st.paused;
  if (st.view === 'plane' && view.step(dt)) dirty = true;
  if (!view.dragging && MO.step(dt, go)) share.touch();
  if (go && st.view === 'sphere' && st.spin && !view.dragging) { st.yaw += dt * 0.25; dirty = true; }
  if (go && stepsAnim) { stepsAnim.t += dt; if (stepsAnim.t > 0.45) { stepsAnim.t = 0; if (st.steps < 40) setRange('steps', st.steps + 1); else stepsAnim = null; } }
  if (go && st.cWander && usesC) { wanderT = clk.wander.step(wanderT, dt, 2 * Math.PI, cycleBeats(4), 0.12); const a = wanderT;
    st.c = [0.7885 * Math.cos(a), 0.7885 * Math.sin(a)]; $('cre').value = st.c[0]; $('cim').value = st.c[1]; showC(); if (frame % 10 === 0) labels(); dirty = true; }
  const vo = voice(); if (vo && usesC) { st.c[1] += vo * 0.0006; dirty = true; }
  const cs = go ? colourStep(dt) : 0; if ((go && st.cycleSpeed > 0) || cs) { st.cycle = (st.cycle + (go ? dt * st.cycleSpeed * 0.06 : 0) + cs) % 1; dirty = true; }
  const fl = flash(); if (fl !== flashNow) { flashNow = fl; dirty = true; }
  const pu = pulse(); if (pu !== pulseNow) { pulseNow = pu; view.beat = 1 - 0.03 * pu; dirty = true; }   // the beat's pulse: a small zoom in, as drawn (markers follow)
  if (dirty) { dirty = false; draw(); }
  if (frame % 20 === 0) share.touch();
  requestAnimationFrame(loop);
}

const fileBase = () => 'complex_' + st.fn + (st.steps > 1 ? '_' + st.steps + 'steps' : '');
// ---------- 3D print: the landscape |f(z)| over the view ----------
$('prBtn').addEventListener('click', () => {
  const r = cv.getBoundingClientRect(), w = 200, h = Math.max(20, Math.round(200 * r.height / r.width)), H = new Float32Array(w * h), s = view.scale / (r.height / 2) * (r.width / w);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const z = [view.cx + (i - w / 2) * s, view.cy - (j - h / 2) * s], v = evalAt(z), m = Math.hypot(...v);
    H[j * w + i] = isFinite(m) ? clamp((Math.log2(Math.max(m, 1e-9)) + 4) / 8, 0, 1) : 1; }
  const T = heightfieldTriangles(H, w, h, st.mm, 2, st.high), res = stlFromTriangles(T, st.mm, 'Math Explorer complex function');
  saveFile(fileName(fileBase()) + `_landscape_${st.mm}mm.stl`, res.bytes, $('prNote')).then(ok => { if (ok) $('prNote').textContent += ` ${res.size.map(v => Math.round(v)).join(' × ')} mm.`; });
});

// ---------- keys, sharing, lifecycle ----------
export function onKey(e) {
  return standardKeys(e, {
    pause: () => { if (st.paused) st.paused = false; else if (moving()) st.paused = true; else go(); dirty = true; },   /* nothing moving: Space builds up the steps, like G */ go, renew: () => { stepsAnim = null; setRange('steps', 1); }, reset: resetView,
    shape: dir => clickNext('#fnList button', dir), palette: dir => clickNext('#palettes button', dir), colourMode: dir => clickNext('#cmode button', dir),
    reverse: () => $('palRev').click(), cycle: () => setRange('cyc', st.cycleSpeed > 0 ? 0 : 1),
    zoom: f => { if (st.view === 'sphere') { st.sz = clamp(st.sz * f, 0.35, 2.2); dirty = true; } else view.zoomAt(f); },
    mode: i => { const b = document.querySelectorAll('#cmode button')[i]; if (b) b.click(); },
  });
}
const encode = () => { const p = new URLSearchParams(); p.set('f', st.fn); if (st.fn === 'custom') p.set('fx', st.custom);
  if (st.fn === 'roots') { p.set('zr', st.roots.map(q => q.map(r4).join('_')).join('~')); p.set('pl', st.poles.map(q => q.map(r4).join('_')).join('~')); }
  if (st.steps !== 1) p.set('n', st.steps); if (usesC) p.set('c', st.c.map(r4).join('_')); if (st.cWander) p.set('cw', 1);
  if (st.view === 'sphere') { p.set('vw', 'sphere'); p.set('yp', [st.yaw, st.pitch, st.sz].map(r4).join('_')); if (!st.spin) p.set('sp', 0); }
  else { p.set('v', [view.cx, view.cy, view.scale].map(r8).join('_')); if (view.rot) p.set('vr', r4(view.rot)); }
  MO.encode(p);
  p.set('cm', st.style); p.set('ac', 'p'); if (st.dens !== 1) p.set('dn', st.dens); if (st.axes) p.set('ax', 1);
  p.set('pal', st.palette); if (st.palRev) p.set('rev', 1); if (st.cycleSpeed) p.set('cyc', st.cycleSpeed); if (st.bg !== '#0b0d12') p.set('bg', st.bg.slice(1));
  return p.toString(); };
function apply(code) {
  const p = new URLSearchParams(String(code).replace(/\+/g, '%2B')), f = p.get('f'); if (!(FNS[f] || f === 'custom')) return false;
  if (f === 'custom') { st.custom = p.get('fx') || 'z'; $('fnIn').value = st.custom; }
  const pts = s => (s || '').split('~').map(q => q.split('_').map(Number)).filter(q => q.length === 2 && q.every(isFinite)).slice(0, 8);
  if (p.has('zr')) st.roots = pts(p.get('zr')); if (p.has('pl')) st.poles = pts(p.get('pl'));
  const c = (p.get('c') || '').split('_').map(Number); if (c.length === 2 && c.every(isFinite)) { st.c = c; $('cre').value = c[0]; $('cim').value = c[1]; showC(); }
  setCheck('cWander', p.get('cw') === '1'); pickFn(f, true); setRange('steps', num(p, 'n', 1));
  clickData('#viewMode', 'v', p.get('vw') === 'sphere' ? 'sphere' : 'plane'); const yp = (p.get('yp') || '').split('_').map(Number); if (yp.length === 3 && yp.every(isFinite)) { st.yaw = yp[0]; st.pitch = yp[1]; st.sz = clamp(yp[2], 0.35, 2.2); }
  setCheck('spin', p.get('sp') !== '0');
  const v = (p.get('v') || '').split('_').map(Number); if (v.length === 3 && v.every(isFinite) && v[2] > 0) view.set(v[0], v[1], v[2]); else view.reset(); view.rot = num(p, 'vr', 0); MO.decode(p);
  clickData('#cmode', 'c', p.get('cm') || '1'); setRange('dens', num(p, 'dn', 1)); setCheck('axes', p.get('ax') === '1');
  // links from before angles always used the palette: without ac (or ac=0) the angles were the colour wheel
  const oldWheel = !['p', '1'].includes(p.get('ac')) && (p.get('cm') || '1') !== '5';
  clickData('#palettes', 'pal', oldWheel ? 'wheel' : (p.get('pal') || 'wheel')); setCheck('palRev', p.get('rev') === '1'); setRange('cyc', num(p, 'cyc', 0)); clickData('#bg', 'b', '#' + (p.get('bg') || '0b0d12'));
  dirty = true; return true;
}
const share = makeShare('complex', encode, apply);
MO.onChange = () => share.touch();
showC(); palLabel();
if (!apply(parseRoute().code)) { pickFn('cubic'); clickData('#cmode', 'c', '1'); }
showPointer();
export function start() { running = true; tPrev = performance.now(); dirty = true; requestAnimationFrame(loop); share.write(); }
export function stop() { running = false; REC.stop(); }
export const reset = resetView;
export const going = () => !!stepsAnim;
/** Anything moving that Space would pause (else the picture's play icon shows). */
export function moving() { return !!stepsAnim || st.cycleSpeed > 0 || MO.moving(); }
/* the picture's Go button (null hides it) and what its slower / faster buttons move (js/shell/toolbar.js) */
export const goLabel = () => 'Grow the steps';
export const speedCtl = () => null;
export const layoutChanged = () => { dirty = true; };
export const showView = code => apply(code);
export const soundHelp = 'Here, each beat flashes the picture brighter (or, with Pulse, zooms it in a touch). Tempo times c\'s slow wander (when it\'s on) and the drifting, zooming and turning under Motion; vocals nudge c very slightly, and colour drifts the palette and turns the angle colours.';
