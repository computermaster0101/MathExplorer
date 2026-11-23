// Tilings explorer: regular tilings {p, q} on the sphere, the flat plane and the hyperbolic plane, drawn by one shader
// that reflects every point back into a single triangle; and Penrose tilings, built by cutting tiles into smaller tiles.
// Importing this module boots the explorer; the exports are the lifecycle the shell (js/main.js) drives.
import { $, clamp, segClick, clickNext, setRange, setCheck, clickData, setStats, buildSwatches, rampCss, r4, r8, num, standardKeys, buildKeys, makeShare } from '../../js/common/kit.js';
import { rampOf, rampUniform, sampleRamp, css, hexRGB, PAL_GLSL } from '../../js/common/palettes.js';
import { makeGL, noWebGL } from '../../js/common/gl.js';
import { makeView2D } from '../../js/common/view2d.js';
import { saveCanvasPNG, saveFile, fileName } from '../../js/common/save.js';
import { stlFromTriangles, heightfieldTriangles } from '../../js/common/stl.js';
import { flashFx as flash, pulseFx as pulse, voiceFx as voice, colourStep, energyMul, Groove } from '../../js/shell/audio/react.js';
import { setPausedTag, drive } from '../../js/shell/keys.js';
import { parseRoute } from '../../js/shell/route.js';
import { tiling, direction, PHI, SHARED } from './penrose.js';
import { wythoff, KINDS, vertexConfig, tilingName } from './wythoff.js';
import { PATTERNS, WALLPAPER } from './patterns.js';
import { makeMotion2D, addRecorder } from '../../js/common/motion.js';
import { makeVisualizer, pickButton, randomSlider } from '../../js/common/visualizer.js';

// ---------- state ----------
const st = { kind: 'pq', pat: 'qc8', seed: 1, wk: 'regular', p: 7, q: 3, pen: 'rh', level: 6, model: 'disc', zoom: 1, edges: true, dual: false, tri: false, lw: 1, cm: 'tiles', pcm: 'shapes',
  palette: 'aurora', palRev: false, cycle: 0, cycleSpeed: 0, bg: '#0b0d12', gliding: false, spin: false, speed: 1, paused: false, mm: 90, high: 1.6 };
const NAMES = { 3: 'triangles', 4: 'squares', 5: 'pentagons', 6: 'hexagons', 7: 'heptagons', 8: 'octagons', 9: 'nonagons', 10: 'decagons', 11: 'hendecagons', 12: 'dodecagons' };
const WORDS = { 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve' };
const SOLIDS = { '3_3': 'tetrahedron', '4_3': 'cube', '3_4': 'octahedron', '5_3': 'dodecahedron', '3_5': 'icosahedron' };
const LISTS = { sphList: ['3_3', '4_3', '3_4', '5_3', '3_5'], flatList: ['4_4', '6_3', '3_6'], hypList: ['7_3', '5_4', '4_5', '3_7', '6_4', '8_3', '4_6', '5_5', '12_3'] };

// ---------- the geometry of {p, q}: which world, and where the first triangle's mirrors are ----------
// The first triangle has a corner at the tile's centre (angle 180/p), one at the middle of an edge (a right angle) and
// one at a tile corner (180/q). Two of its mirrors are lines through the centre; the third, the tile's edge, is a circle
// (sphere, drawn by stereographic projection, and the hyperbolic disc) or a straight line (flat).
let geo = null;   // set from geometry() just below the function
function geometry(p, q) {
  const s = (p - 2) * (q - 2), K = s < 4 ? 1 : s > 4 ? -1 : 0, a = Math.PI / p, b = Math.PI / q;
  let x0, v, rho, c = 0, r = 0;
  if (K < 0) { rho = Math.acosh(Math.cos(b) / Math.sin(a)); x0 = Math.tanh(rho / 2); v = Math.tanh(Math.acosh(1 / (Math.tan(a) * Math.tan(b))) / 2); c = (x0 + 1 / x0) / 2; r = (1 / x0 - x0) / 2; }
  else if (K > 0) { rho = Math.acos(Math.cos(b) / Math.sin(a)); x0 = Math.tan(rho / 2); v = Math.tan(Math.acos(1 / (Math.tan(a) * Math.tan(b))) / 2); c = (x0 - 1 / x0) / 2; r = (x0 + 1 / x0) / 2; }
  else { x0 = 0.2; rho = 0.2; v = x0 / Math.cos(a); }
  return { K, a, x0, v, rho, c, r };
}

geo = geometry(7, 3);

// ---------- complex numbers and Möbius maps (a z + b) / (c z + d), kept as [a, b, c, d] ----------
const cm = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]], cadd = (x, y) => [x[0] + y[0], x[1] + y[1]], cdiv = (x, y) => { const d = y[0] * y[0] + y[1] * y[1] || 1e-300; return [(x[0] * y[0] + x[1] * y[1]) / d, (x[1] * y[0] - x[0] * y[1]) / d]; };
const conj = x => [x[0], -x[1]], csqrt = x => { const m = Math.hypot(x[0], x[1]), t = Math.atan2(x[1], x[0]) / 2, s = Math.sqrt(m); return [s * Math.cos(t), s * Math.sin(t)]; };
const mob = (M, z) => cdiv(cadd(cm(M[0], z), M[1]), cadd(cm(M[2], z), M[3]));
const mul = (A, B) => [cadd(cm(A[0], B[0]), cm(A[1], B[2])), cadd(cm(A[0], B[1]), cm(A[1], B[3])), cadd(cm(A[2], B[0]), cm(A[3], B[2])), cadd(cm(A[2], B[1]), cm(A[3], B[3]))];
const norm = M => { const s = csqrt(cadd(cm(M[0], M[3]), cm(M[1], M[2]).map(x => -x))), k = cdiv([1, 0], s); return M.map(e => cm(e, k)); };
const ID = () => [[1, 0], [0, 0], [0, 0], [1, 0]];
// the move that sends 0 to t, along a straight line of the world (a rotation of the ball when K = 1)
const T = t => [[1, 0], t, cm(conj(t), [-geo.K, 0]), [1, 0]];
const ROT = th => [[Math.cos(th), Math.sin(th)], [0, 0], [0, 0], [1, 0]];
let MV = ID(), par = 0;   // the view: screen point z shows the tiling at MV(z); par flips the two-colouring after a half turn
const apply = S => { MV = norm(mul(MV, S)); };
const moveBetween = (z0, z1) => apply(mul(T(z0), T([-z1[0], -z1[1]])));   // the point under z1 now shows what z0 showed

// keep the middle of the screen inside the first tile, using the tiling's own turns, so the numbers never grow
function outside(w) { const g = geo; return g.K < 0 ? Math.hypot(w[0] - g.c, w[1]) < g.r : g.K > 0 ? Math.hypot(w[0] - g.c, w[1]) > g.r : w[0] > g.x0; }
function recentre() {
  const zc = toModelXY(0, 0); if (!zc) return; let w = mob(MV, zc);
  for (let i = 0; i < 60; i++) {
    const k = Math.round(Math.atan2(w[1], w[0]) / (2 * geo.a)); if (k) { const g = ROT(-k * 2 * geo.a); MV = norm(mul(g, MV)); w = mob(g, w); }
    if (!outside(w)) break;
    const m = [geo.x0, 0], H = mul(T(m), mul([[-1, 0], [0, 0], [0, 0], [1, 0]], T([-m[0], 0])));   // half turn about the middle of the edge
    MV = norm(mul(H, MV)); w = mob(H, w); par ^= 1;
  }
}

// ---------- screen to model point (the same as the shader) ----------
const tc = $('tc'), pc = $('pc'), pg = pc.getContext('2d'), G = makeGL(tc);
if (!G) throw noWebGL($('na'), 'Tilings');
const g = G.g;
function toModelXY(x, y) {   // x, y: screen position in half-heights from the middle, y up
  if (st.model === 'half') { const s = [x * st.zoom * 1.6, (y + 1) * st.zoom * 1.6]; if (s[1] <= 1e-6) return null; return cdiv([s[0], s[1] - 1], [s[0], s[1] + 1]); }
  if (st.model === 'ball') { const d = [x * 0.42 * st.zoom, y * 0.42 * st.zoom, -1], L = Math.hypot(...d), rd = d.map(v => v / L), ro = [0, 0, 3.2];
    const b = ro[2] * rd[2], h = b * b - (9.24); if (h < 0) return null; const t = -b - Math.sqrt(h), n = [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t]; return [n[0] / (1 + n[2]), n[1] / (1 + n[2])]; }
  const z = [x * st.zoom, y * st.zoom]; if (geo.K < 0 && Math.hypot(...z) >= 0.995) return null; return z;
}
function toModel(px, py) { const r = tc.getBoundingClientRect(); return toModelXY((px - r.left - r.width / 2) / (r.height / 2), -(py - r.top - r.height / 2) / (r.height / 2)); }

// ---------- the shader ----------
const FS = `#version 300 es
precision highp float;
out vec4 outC;
uniform vec2 u_res, u_ma, u_mb, u_mc, u_md, u_V; uniform float u_K, u_ang, u_x0, u_c, u_r, u_unit, u_zoom, u_lw, u_cycle, u_flash, u_par, u_odd;
uniform int u_model, u_cm, u_edges, u_dual, u_tri, u_print, u_wk; uniform vec3 u_bg;
uniform vec4 u_sep[3]; uniform vec3 u_sgn[3]; uniform vec3 u_has;   // Wythoff: the lines through the vertex, which side each corner's face is on, which faces exist
${PAL_GLSL}
vec2 cm(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
vec2 cdiv(vec2 a, vec2 b){ return vec2(a.x*b.x+a.y*b.y, a.y*b.x-a.x*b.y)/dot(b,b); }
float dist0(float r){ return u_K<-0.5 ? 2.0*atanh(min(r,0.999999)) : u_K>0.5 ? 2.0*atan(r) : r; }   // distance from the centre, in the world's own measure
float lam(vec2 w){ return u_K==0.0 ? 1.0 : 2.0/max(1.0+u_K*dot(w,w),1e-6); }
void main(){
  vec2 p=gl_FragCoord.xy-0.5*u_res, q=p/(0.5*u_res.y), z; float shade=1.0, spec=0.0, rim=1e9; bool ok=true;
  if (u_model==2){ vec3 ro=vec3(0.0,0.0,3.2), rd=normalize(vec3(q*0.42*u_zoom,-1.0)); float b=dot(ro,rd), h=b*b-dot(ro,ro)+1.0;
    if (h<0.0) ok=false; else { vec3 n=ro+rd*(-b-sqrt(h)); z=n.xy/(1.0+n.z); vec3 L=normalize(vec3(0.5,0.6,0.8)); shade=0.42+0.68*max(dot(n,L),0.0); spec=0.2*pow(max(dot(reflect(rd,n),L),0.0),40.0); } }
  else if (u_model==1){ vec2 s=vec2(q.x,q.y+1.0)*u_zoom*1.6; rim=s.y/(u_zoom*1.6)*0.5*u_res.y; if (s.y<=0.0) ok=false; else z=cdiv(s-vec2(0.0,1.0), s+vec2(0.0,1.0)); }
  else { z=q*u_zoom; if (u_K<-0.5){ rim=(1.0-length(z))/u_zoom*0.5*u_res.y; if (length(z)>=1.0) ok=false; } }
  if (!ok){ if (u_print==1){ outC=vec4(0.0,0.0,0.0,1.0); return; } float e=u_model==1 ? 1.0-smoothstep(0.0,2.0,-rim) : 1.0-smoothstep(0.0,2.0,-rim); outC=vec4(mix(u_bg,vec3(0.75),u_K<-0.5?e*0.6:0.0),1.0); return; }
  vec2 w=cdiv(cm(u_ma,z)+u_mb, cm(u_mc,z)+u_md);
  // fold back into the first triangle, counting mirrors crossed (n) and tile edges crossed (e)
  float n=0.0, e=0.0;
  for (int i=0;i<160;i++){
    float a=atan(w.y,w.x), k=floor(a/u_ang), r=length(w), a2=a-k*u_ang; if (mod(k,2.0)>0.5) a2=u_ang-a2; n+=abs(k); w=r*vec2(cos(a2),sin(a2));
    bool beyond = u_K<-0.5 ? distance(w,vec2(u_c,0.0))<u_r : u_K>0.5 ? distance(w,vec2(u_c,0.0))>u_r : w.x>u_x0;
    if (!beyond) break;
    if (u_K==0.0) w.x=2.0*u_x0-w.x; else { vec2 d=w-vec2(u_c,0.0); w=vec2(u_c,0.0)+d*(u_r*u_r/dot(d,d)); }
    n+=1.0; e+=1.0; }
  float L=lam(w)/u_unit, dE=(u_K==0.0 ? abs(u_x0-w.x) : abs(distance(w,vec2(u_c,0.0))-u_r))*L, dD=abs(w.y)*L, dT=abs(dot(w,vec2(-sin(u_ang),cos(u_ang))))*L;
  // which face this point is in (round O, M or V), and how far to that face's edges
  int reg=0; for (int c=0;c<3;c++){ if (u_has[c]<0.5) continue; bool inC=true;
    for (int i=0;i<3;i++){ float sg=u_sgn[c][i]; if (sg!=0.0){ vec4 S=u_sep[i]; float v = S.w>0.5 ? dot(S.xy,w)-S.z : dot(w-S.xy,w-S.xy)-S.z; if (sign(v)!=sg) inC=false; } }
    if (inC){ reg=c; break; } }
  float dW=1e9; for (int i=0;i<3;i++){ if (u_sgn[reg][i]!=0.0){ vec4 S=u_sep[i]; float d = S.w>0.5 ? abs(dot(S.xy,w)-S.z) : abs(distance(w,S.xy)-sqrt(S.z)); dW=min(dW,d*L); } }
  dE=dW;
  float rr=length(z), t = u_K>0.5 ? dist0(rr)/3.1416 : u_K<-0.5 ? dist0(rr)*0.16 : rr*0.18/u_x0;   // distance from the middle of the screen, for the colour
  float tileP = mod(e,2.0); if (u_odd<0.5) tileP=abs(tileP-u_par); float triP=mod(n,2.0);
  float lw=0.04*u_lw;
  #define LINE(d,wd) (1.0-smoothstep((wd)-fwidth(d), (wd)+fwidth(d), d))
  if (u_print==1){ float hgt = u_edges==1 ? LINE(dE,lw*1.6) : 0.0; if (u_dual==1) hgt=max(hgt,LINE(dD,lw*1.2)); if (u_tri==1) hgt=max(hgt,LINE(dT,lw*0.8)*0.7);
    if (u_K<-0.5 && u_model==0) hgt=max(hgt,1.0-smoothstep(1.5,3.0,rim)); outC=vec4(hgt,hgt,hgt,1.0); return; }
  vec3 col; vec3 ink=vec3(0.04,0.045,0.06);
  if (u_cm==0){ if (u_wk==0){ col = pal(t*0.5+u_cycle); if (u_odd<0.5) col = tileP>0.5 ? col*0.62+0.03 : col; }
    else col = pal(0.03+float(reg)*0.22+t*0.1+u_cycle);   // uniform tilings: each kind of face its own colour, lightly shaded by distance
  }
  else if (u_cm==1){ col = pal(t*0.5+u_cycle); col = triP>0.5 ? col*0.22+0.02 : mix(col,vec3(1.0),0.12); }
  else if (u_cm==2){ col = pal(t*0.5+u_cycle)*(u_odd<0.5 && tileP>0.5 ? 0.7 : 1.0);
    float d0=dist0(length(w))/u_unit, ring=LINE(abs(d0-0.62),lw*1.4); vec2 dv=cdiv(w-u_V, vec2(1.0,0.0)+u_K*cm(vec2(u_V.x,-u_V.y),w)); float dvv=dist0(length(dv))/u_unit;
    col=mix(col, pal(t*0.5+u_cycle+0.25), 1.0-smoothstep(0.30-fwidth(dvv),0.30+fwidth(dvv),dvv)); col=mix(col, vec3(1.0), ring*0.85); }
  else { col = u_bg; ink = pal(t*0.5+u_cycle); }
  if (u_tri==1) col=mix(col, u_cm==3 ? ink*0.7 : vec3(1.0), LINE(dT,lw*0.5)*0.55);
  if (u_dual==1) col=mix(col, u_cm==3 ? ink : vec3(1.0), LINE(dD,lw*0.8)*0.85);
  if (u_edges==1) col=mix(col, ink, LINE(dE,lw));
  col = col*shade + spec; col = col*(1.0+0.35*u_flash)+0.05*u_flash;
  if (u_K<-0.5 && u_model==0) col=mix(col, vec3(0.75), (1.0-smoothstep(0.0,2.0,rim))*0.6);
  outC=vec4(col,1.0); }`;
let prog = null, wyCache = null;
const WY = () => { const key = st.p + '_' + st.q + '_' + st.wk; if (!wyCache || wyCache.key !== key) wyCache = { key, ...wythoff(geo, st.wk) }; return wyCache; };
function draw(target, w, h, print) {
  if (!target) G.fit(Math.min(devicePixelRatio, 1.5)); w = w || tc.width; h = h || tc.height;
  g.useProgram(prog.p); const U = n => prog.u(n), pu = rampUniform(R);
  g.uniform2f(U('u_res'), w, h); g.uniform2f(U('u_ma'), ...MV[0]); g.uniform2f(U('u_mb'), ...MV[1]); g.uniform2f(U('u_mc'), ...MV[2]); g.uniform2f(U('u_md'), ...MV[3]);
  g.uniform1f(U('u_K'), geo.K); g.uniform1f(U('u_ang'), geo.a); g.uniform1f(U('u_x0'), geo.x0); g.uniform1f(U('u_c'), geo.c); g.uniform1f(U('u_r'), geo.r); g.uniform1f(U('u_unit'), geo.rho);
  g.uniform2f(U('u_V'), geo.v * Math.cos(geo.a), geo.v * Math.sin(geo.a));
  g.uniform1f(U('u_zoom'), st.zoom * (1 - 0.03 * pulseNow)); g.uniform1f(U('u_lw'), st.lw * (1 + 0.15 * voiceNow)); g.uniform1f(U('u_cycle'), st.cycle); g.uniform1f(U('u_flash'), flashNow);
  g.uniform1f(U('u_par'), par); g.uniform1f(U('u_odd'), st.q % 2); g.uniform1i(U('u_model'), { disc: 0, flat: 0, plane: 0, half: 1, ball: 2 }[st.model]);
  g.uniform1i(U('u_cm'), ['tiles', 'triangles', 'rings', 'lines'].indexOf(st.cm)); g.uniform1i(U('u_edges'), st.edges ? 1 : 0); g.uniform1i(U('u_dual'), st.dual ? 1 : 0); g.uniform1i(U('u_tri'), st.tri ? 1 : 0); g.uniform1i(U('u_print'), print ? 1 : 0);
  g.uniform3f(U('u_bg'), ...hexRGB(st.bg)); g.uniform3fv(U('u_pal'), pu.data); g.uniform1i(U('u_npal'), pu.n);
  const Y = WY(); g.uniform4fv(U('u_sep'), new Float32Array(Y.sep.flat())); g.uniform3fv(U('u_sgn'), new Float32Array(Y.sign.flat())); g.uniform3f(U('u_has'), ...Y.exists.map(b => (b ? 1 : 0)));
  g.uniform1i(U('u_wk'), Object.keys(KINDS).indexOf(st.wk));
  G.draw(target, w, h);
}

// ---------- Penrose: drawn on a 2D canvas ----------
const pview = makeView2D(pc, { home: { cx: 0, cy: 0, scale: 1.05 }, min: 0.002, max: 40, onChange: () => { dirty = true; share.touch(); } });
// a turned view (pview.rot): the canvas is turned about its middle, and what's drawn covers the circle round the screen
// the beat's pulse zooms the picture in a little, as drawn (not in prints); the flash adds a faint glow, as in Fractals
const turnCtx = (ctx, W, H, print) => { if (!print && flashNow) { ctx.fillStyle = `rgba(255,255,255,${(0.05 * flashNow).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  ctx.save(); const k = print ? 1 : 1 + 0.03 * pulseNow; if (pview.rot || k !== 1) { ctx.translate(W / 2, H / 2); ctx.rotate(pview.rot); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2); } };
const halfW = (W, H) => (pview.rot ? Math.hypot(W, H) / 2 : W / 2), halfH = (W, H) => (pview.rot ? Math.hypot(W, H) / 2 : H / 2);
function drawPenrose(ctx, W, H, opts = {}) {
  const T = tiling(st.pen, st.level), sh = SHARED[st.pen], s = (H / 2) / pview.scale, ox = W / 2 - pview.cx * s, oy = H / 2 + pview.cy * s;
  const X = P => ox + P[0] * s, Y = P => oy - P[1] * s, cull = 2 / s;
  const hw = halfW(W, H), hh = halfH(W, H), bx0 = pview.cx - hw / s - cull, bx1 = pview.cx + hw / s + cull, by0 = pview.cy - hh / s - cull, by1 = pview.cy + hh / s + cull;
  ctx.fillStyle = opts.print ? '#000' : st.bg; ctx.fillRect(0, 0, W, H); turnCtx(ctx, W, H, opts.print);
  const groups = new Map(), edges = new Path2D(); let shown = 0;
  for (const t of T) {
    const [k, A, B, C] = t; if (Math.max(A[0], B[0], C[0]) < bx0 || Math.min(A[0], B[0], C[0]) > bx1 || Math.max(A[1], B[1], C[1]) < by0 || Math.min(A[1], B[1], C[1]) > by1) continue; shown++;
    if (!opts.print && st.pcm !== 'lines') { const key = st.pcm === 'direction' ? direction(t, st.pen) : k; let P = groups.get(key); if (!P) groups.set(key, P = new Path2D());
      P.moveTo(X(A), Y(A)); P.lineTo(X(B), Y(B)); P.lineTo(X(C), Y(C)); P.closePath(); }
    if (st.edges || opts.print) { const V = [A, B, C]; for (let i = 0; i < 3; i++) { const j = (i + 1) % 3, a = i + 1, b = j + 1; if ((a === sh[0] && b === sh[1]) || (a === sh[1] && b === sh[0])) continue; edges.moveTo(X(V[i]), Y(V[i])); edges.lineTo(X(V[j]), Y(V[j])); } }
  }
  for (const [key, P] of groups) { const tt = st.pcm === 'direction' ? key / (st.pen === 'kd' ? 10 : 5) : key ? 0.78 : 0.22; ctx.fillStyle = css(sampleRamp(R, (tt + st.cycle) % 1).map(v => Math.min(1, v * (1 + 0.35 * flashNow) + 0.05 * flashNow))); ctx.fill(P); }
  if (st.edges || opts.print) { const lw = Math.max(0.6, Math.min(3, s / Math.pow(PHI, st.level) * 0.035)) * st.lw * (opts.print ? 2.2 : 1 + 0.15 * voiceNow);
    ctx.strokeStyle = opts.print ? '#fff' : st.pcm === 'lines' ? css(sampleRamp(R, (0.6 + st.cycle) % 1)) : 'rgba(6,7,10,.85)'; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(edges); }
  ctx.restore(); return shown;
}
// flat patterns (wallpaper groups, Truchet, quasicrystals, the non-Wythoff Archimedean tilings), drawn for what's on screen
let patInfo = null;   // counts from the last drawing, for the Numbers
function drawPattern(ctx, W, H, opts = {}) {
  const P = PATTERNS[st.pat], s = (H / 2) / pview.scale, ox = W / 2 - pview.cx * s, oy = H / 2 + pview.cy * s, X = q => ox + q[0] * s, Y = q => oy - q[1] * s;
  const hw = halfW(W, H), hh = halfH(W, H), b = [pview.cx - hw / s, pview.cx + hw / s, pview.cy - hh / s, pview.cy + hh / s], g = P.gen(b, st.seed), nC = g.classes || (P.classes ? P.classes.length : 2);
  ctx.fillStyle = opts.print ? '#000' : st.bg; ctx.fillRect(0, 0, W, H); turnCtx(ctx, W, H, opts.print);
  const groups = new Map(), count = {};
  for (const q of g.polys || []) { const key = opts.print ? 0 : st.pcm === 'direction' ? (P.wallpaper ? (q.flip ? 1 : 0) : 0) : q.c; count[q.c] = (count[q.c] || 0) + 1;
    let path = groups.get(key); if (!path) groups.set(key, path = new Path2D()); path.moveTo(X(q.p[0]), Y(q.p[0])); for (let i = 1; i < q.p.length; i++) path.lineTo(X(q.p[i]), Y(q.p[i])); path.closePath(); }
  const tone = k => css(sampleRamp(R, ((st.pcm === 'direction' && P.wallpaper ? 0.15 + 0.7 * k : 0.08 + 0.84 * k / Math.max(1, nC - 1)) + st.cycle) % 1).map(v => Math.min(1, v * (1 + 0.35 * flashNow) + 0.05 * flashNow)));
  if (st.pcm !== 'lines' || (opts.print && P.wallpaper)) for (const [key, path] of groups) { ctx.fillStyle = opts.print ? '#fff' : tone(key); ctx.fill(path); }
  if (!P.wallpaper && g.polys && (st.edges || st.pcm === 'lines' || opts.print)) { ctx.strokeStyle = opts.print ? '#fff' : st.pcm === 'lines' ? tone(nC - 1) : 'rgba(6,7,10,.85)';
    ctx.lineWidth = Math.max(0.6, Math.min(4, s * 0.045)) * st.lw * (opts.print ? 2.2 : 1 + 0.15 * voiceNow); ctx.lineJoin = 'round'; for (const path of groups.values()) ctx.stroke(path); }
  if (g.lines && (!P.wallpaper || st.edges)) { ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const L of g.lines) { ctx.beginPath(); L.p.forEach((q, i) => (i ? ctx.lineTo(X(q), Y(q)) : ctx.moveTo(X(q), Y(q))));
      if (P.wallpaper) { ctx.strokeStyle = opts.print ? 'rgba(0,0,0,0)' : st.bg === '#f3efe6' ? 'rgba(28,30,38,.25)' : 'rgba(255,255,255,.22)'; ctx.lineWidth = st.lw; }
      else { ctx.strokeStyle = opts.print ? '#fff' : tone(L.c); ctx.lineWidth = Math.max(1, s * 0.12) * st.lw; }
      ctx.stroke(); } }
  ctx.restore(); patInfo = { count, nC, lines: (g.lines || []).length }; return (g.polys || []).length;
}
function drawCanvas() { if (st.kind === 'pat') { const r = pc.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2), W = Math.max(1, Math.round(r.width * d)), H = Math.max(1, Math.round(r.height * d)); if (pc.width !== W || pc.height !== H) { pc.width = W; pc.height = H; } penShown = drawPattern(pg, W, H); stats(); } else drawPen(); }
const flat2d = () => st.kind !== 'pq';
let penShown = 0;
function drawPen() { const r = pc.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2), W = Math.max(1, Math.round(r.width * d)), H = Math.max(1, Math.round(r.height * d)); if (pc.width !== W || pc.height !== H) { pc.width = W; pc.height = H; } penShown = drawPenrose(pg, W, H); }

// ---------- dragging and zooming the {p, q} view ----------
let drag = null;
tc.addEventListener('pointerdown', e => { tc.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY }; });
tc.addEventListener('pointermove', e => { if (!drag) return; const z0 = toModel(drag.x, drag.y), z1 = toModel(e.clientX, e.clientY); drag = { x: e.clientX, y: e.clientY };
  if (z0 && z1) { moveBetween(z0, z1); recentre(); dirty = true; share.touch(); } });
tc.addEventListener('pointerup', () => { drag = null; }); tc.addEventListener('pointercancel', () => { drag = null; });
tc.addEventListener('wheel', e => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0012), e.clientX, e.clientY); }, { passive: false });
function zoomBy(f, px, py) {
  if (geo.K === 0 && st.model === 'plane') { const r = tc.getBoundingClientRect(), zc = px == null ? toModelXY(0, 0) : toModel(px, py);   // flat: zoom about the pointer, through the view map
    apply([[f, 0], cm(zc, [1 - f, 0]), [0, 0], [1, 0]]); recentre(); }
  else st.zoom = clamp(st.zoom * f, st.model === 'ball' ? 0.3 : 0.02, st.model === 'half' ? 3 : 2.5);
  dirty = true; share.touch();
}

// ---------- panel ----------
const UNIFORM = [['5_3_bitruncated', 'Football'], ['4_3_rectified', 'Cuboctahedron'], ['5_3_rectified', 'Icosidodecahedron'], ['4_3_truncated', 'Truncated cube'], ['4_3_cantellated', 'Rhombicuboctahedron'],
  ['5_3_cantellated', 'Rhombicosidodecahedron'], ['5_3_omnitruncated', 'Great rhombicosidodecahedron'], ['4_4_truncated', '4.8.8'], ['6_3_rectified', '3.6.3.6'], ['6_3_truncated', '3.12.12'], ['6_3_cantellated', '3.4.6.4'],
  ['6_3_omnitruncated', '4.6.12'], ['7_3_bitruncated', '6.6.7'], ['7_3_truncated', '3.14.14'], ['5_4_rectified', '4.5.4.5'], ['4_5_omnitruncated', '4.8.10'], ['8_3_cantellated', '3.4.8.4']];
for (const [id, grp] of [['archList', 'arch'], ['qcList', 'quasi'], ['wallList', 'wall'], ['truList', 'truchet']])
  $(id).innerHTML = Object.entries(PATTERNS).filter(([, P]) => P.group === grp).map(([k, P]) => `<button data-pat="${k}">${P.name}${grp === 'wall' ? '' : `<small style="display:block;opacity:.7;font-size:10.5px">${P.alt.split(':')[0]}</small>`}</button>`).join('');
$('patNew').addEventListener('click', () => renew());
$('uniList').innerHTML = UNIFORM.map(([k, n]) => { const [p, q, wk] = k.split('_'); return `<button data-uni="${k}">${n}<small style="display:block;opacity:.7;font-size:10.5px">${KINDS[wk].sym(+p, +q)}</small></button>`; }).join('');
$('wyKind').innerHTML = Object.entries(KINDS).map(([k, d]) => `<button data-k="${k}">${d.name}</button>`).join('');
segClick('wyKind', d => { st.wk = d.k; markList(); labels(); stats(); dirty = true; share.touch(); });
for (const id in LISTS) $(id).innerHTML = LISTS[id].map(k => { const [p, q] = k.split('_'); return `<button data-pq="${k}">{${p}, ${q}}<small style="display:block;opacity:.7;font-size:10.5px">${SOLIDS[k] || (id === 'flatList' ? NAMES[p] : NAMES[p] + ', ' + q)}</small></button>`; }).join('');
document.querySelectorAll('#sphList, #flatList, #hypList, #uniList, #penList, #archList, #qcList, #wallList, #truList').forEach(el => el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.pq) { const [p, q] = b.dataset.pq.split('_').map(Number); st.wk = 'regular'; setPQ(p, q, true); }
  else if (b.dataset.uni) { const [p, q, wk] = b.dataset.uni.split('_'); st.wk = wk; setPQ(+p, +q, true); } else if (b.dataset.pat) pickPat(b.dataset.pat); else pickPen(b.dataset.pen); }));
function markList() {
  document.querySelectorAll('#sphList button, #flatList button, #hypList button, #uniList button, #penList button, #archList button, #qcList button, #wallList button, #truList button').forEach(b => b.classList.toggle('on', st.kind === 'pq'
    ? (b.dataset.pq === st.p + '_' + st.q && st.wk === 'regular') || b.dataset.uni === `${st.p}_${st.q}_${st.wk}` : st.kind === 'pat' ? b.dataset.pat === st.pat : b.dataset.pen === st.pen));
  document.querySelectorAll('#wyKind button').forEach(b => b.classList.toggle('on', b.dataset.k === st.wk)); }
const MODELS = { [-1]: [['disc', 'Poincaré disc'], ['half', 'Half-plane']], 0: [['plane', 'The plane']], 1: [['ball', 'A ball'], ['flat', 'Flat map']] };
function setPQ(p, q, fresh) {
  const wasK = geo ? geo.K : null; st.kind = 'pq'; st.p = clamp(Math.round(p), 3, 12); st.q = clamp(Math.round(q), 3, 12); geo = geometry(st.p, st.q);
  $('pIn').value = st.p; $('pIno').textContent = st.p; $('qIn').value = st.q; $('qIno').textContent = st.q;
  if (fresh || wasK !== geo.K) { const ms = MODELS[geo.K]; if (!ms.some(m => m[0] === st.model)) st.model = ms[0][0]; homeView(); }
  else recentre();
  showKind(); dirty = true; share.touch();
}
function pickPat(k, keepView) { if (!PATTERNS[k]) return; st.kind = 'pat'; st.pat = k; if (!keepView) { const c = PATTERNS[k].centre ? PATTERNS[k].centre() : [0, 0]; pview.home = { cx: c[0], cy: c[1], scale: PATTERNS[k].scale }; pview.reset(); } showKind(); dirty = true; share.touch(); }
function pickPen(k) { pview.home = { cx: 0, cy: 0, scale: 1.05 }; st.kind = 'pen'; st.pen = k === 'kd' ? 'kd' : 'rh'; showKind(); dirty = true; share.touch(); }
function showKind() {
  const pen = flat2d(); tc.hidden = pen; pc.hidden = !pen; pview.enabled = pen; $('pqSec').hidden = pen; $('glideSec').hidden = pen; $('g-ctl').hidden = st.kind !== 'pat';   /* only the random patterns have controls of their own */ $('penSec').hidden = st.kind !== 'pen'; $('patSec').hidden = st.kind !== 'pat'; $('modelSec').hidden = pen;
  $('dualRow').hidden = pen; $('triRow').hidden = pen;
  if (!pen) { $('model').innerHTML = MODELS[geo.K].map(([k, n]) => `<button data-m="${k}" class="${k === st.model ? 'on' : ''}">${n}</button>`).join('');
    $('modelNote').textContent = { disc: 'The whole infinite plane squeezed into a disc. Every tile is really the same size.', half: 'Another map of the same plane: the rim is now the bottom edge, stretched out straight.', ball: 'The tiles wrapped round a ball, as they really are.', flat: 'The ball unrolled from its far point (stereographic projection): circles stay circles, but the far side spreads out to infinity.', plane: 'Flat tiles on a flat plane: nothing to bend.' }[st.model]; }
  const PP = st.kind === 'pat' && PATTERNS[st.pat], cms = PP ? [['shapes', PP.wallpaper ? 'By symmetry' : 'By shape'], ['direction', PP.wallpaper ? 'Mirror images' : 'One colour'], ['lines', PP.lineMode ? 'Curves' : 'Lines only']]
    : pen ? [['shapes', 'Two shapes'], ['direction', 'Direction'], ['lines', 'Lines only']] : [['tiles', 'Tiles'], ['triangles', 'Mirror triangles'], ['rings', 'Rings & stars'], ['lines', 'Lines only']], cur = pen ? st.pcm : st.cm;
  $('cmode').innerHTML = cms.map(([k, n]) => `<button data-c="${k}" class="${k === cur ? 'on' : ''}">${n}</button>`).join('');
  $('hint').textContent = pen ? 'Drag to move · scroll / pinch to zoom · ' + (st.kind === 'pat' && PATTERNS[st.pat].gen.length > 1 ? 'N for a new random pattern' : 'arrows and W A S D to move around') : st.model === 'ball' ? 'Drag to turn the ball · scroll to zoom · G to keep turning' : 'Drag to glide · scroll to zoom · G to keep gliding';
  markList(); labels(); stats();
}
function labels() {
  let t, sub, about;
  if (st.kind === 'pen') { t = st.pen === 'kd' ? 'Kites & darts' : 'Penrose rhombs'; sub = 'two shapes, a pattern that never repeats';
    about = st.pen === 'kd' ? '<strong>Kites and darts.</strong> Penrose\'s second pair of tiles (1974). Like the rhombs, they cover the plane without ever repeating, and there are φ = 1.618… kites for every dart.' : '<strong>Penrose rhombs.</strong> A thick and a thin diamond, all sides equal. Laid by the rules, they cover the plane forever without the pattern ever repeating, and the thick ones outnumber the thin ones by the golden ratio.'; }
  else { const sk = SOLIDS[st.p + '_' + st.q]; t = `{${st.p}, ${st.q}}`; sub = `${NAMES[st.p]}, ${WORDS[st.q]} at every corner` + (sk ? `: the ${sk}` : geo.K < 0 ? ', hyperbolic' : ', flat');
    const sum = st.q * (180 - 360 / st.p);
    about = `<strong>{${st.p}, ${st.q}}.</strong> ${WORDS[st.q][0].toUpperCase() + WORDS[st.q].slice(1)} ${NAMES[st.p]} meet at every corner. Flat, their corners would add up to ${+sum.toFixed(1)}°, ` +
      (geo.K > 0 ? `less than 360°, so the tiles close up into a ball${sk ? ': the ' + sk + ', one of the five Platonic solids' : ''}.` : geo.K < 0 ? `more than 360°, so there's too much tile to lie flat: it can only live in the hyperbolic plane.` : 'exactly 360°: they lie flat, and repeat forever.'); }
  if (st.kind === 'pat') { const P = PATTERNS[st.pat]; t = P.wallpaper ? 'Wallpaper group ' + P.name : P.name; sub = P.alt; about = `<strong>${t}.</strong> ${P.info}`; }
  if (st.kind === 'pq' && st.wk !== 'regular') { const vc = vertexConfig(st.wk, st.p, st.q), nm = tilingName(st.wk, st.p, st.q), w = geo.K > 0 ? 'on a ball' : geo.K < 0 ? 'in the hyperbolic plane' : 'on the flat plane';
    t = KINDS[st.wk].sym(st.p, st.q); sub = (nm || 'a uniform tiling') + ': ' + vc + ' round every corner';
    about = `<strong>${t}${nm ? ', the ' + nm : ''}.</strong> Made by Wythoff's construction from the mirror triangle of {${st.p}, ${st.q}}: the same mirrors, with the corner of the tiles moved. Every corner looks the same, with faces of ${vc.split('.').join(', ')} sides round it, ${w}.`; }
  $('title').textContent = t; $('subtitle').textContent = sub; $('about').innerHTML = about; $('gv-shapes').textContent = t;
  $('wyNote').textContent = { regular: 'The corner of the tiles at the triangle\'s corner: the regular tiling itself.', rectified: 'Corners at the middle of each edge: the old tiles shrink and new ones grow where the corners were.',
    dual: 'Corners at the middle of each tile: the dual tiling, {q, p}.', truncated: 'Each corner cut off: the tiles get twice as many sides, with small tiles in the gaps.', bitruncated: 'The dual\'s corners cut off.',
    cantellated: 'Corners cut off and edges too: squares appear along every old edge.', omnitruncated: 'Everything cut: three kinds of tile, every one with an even number of sides.' }[st.wk];
  $('pqNote').textContent = st.kind === 'pq' ? (geo.K > 0 ? 'Corners add up to less than 360°: a sphere.' : geo.K < 0 ? 'Corners add up to more than 360°: the hyperbolic plane.' : 'Corners add up to exactly 360°: flat.') : '';
  $('gv-ctl').textContent = st.kind === 'pat' ? '' : st.kind === 'pen' ? 'step ' + st.level : geo.K > 0 ? 'sphere' : geo.K < 0 ? 'hyperbolic' : 'flat';
  $('lgBar').style.background = rampCss(R); const PL = st.kind === 'pat' && PATTERNS[st.pat], L = PL ? (PL.wallpaper ? (st.pcm === 'direction' ? ['turned copies', 'mirror images'] : ['', 'one colour per copy in the cell']) : [PL.classes[0], PL.classes[PL.classes.length - 1]]) : st.kind === 'pen' ? (st.pcm === 'direction' ? ['', st.pen === 'kd' ? 'ten directions' : 'five directions'] : [st.pen === 'kd' ? 'kites' : 'thin', st.pen === 'kd' ? 'darts' : 'thick']) : ['near the middle', 'far away']; $('lgL').textContent = L[0]; $('lgR').textContent = L[1];
  $('cmodeNote').textContent = st.kind === 'pat' ? (PATTERNS[st.pat].wallpaper ? { shapes: 'Each copy of the motif inside one repeating cell gets its own colour.', direction: 'Mirror-image copies in one colour, turned copies in another: groups with no mirrors or glides show only one.', lines: 'Just the outline of the repeating cell.' }[st.pcm] : { shapes: 'One colour for each shape of tile.', direction: 'All tiles the same colour.', lines: 'Just the lines.' }[st.pcm]) : st.kind === 'pen' ? { shapes: 'One colour for each of the two tile shapes.', direction: st.pen === 'kd' ? 'Coloured by which way each tile points: there are only ten directions, the five-fold symmetry showing.' : 'Coloured by which way each rhomb lies: only five directions ever appear, the five-fold symmetry showing.', lines: 'Just the edges.' }[st.pcm]
    : { tiles: st.q % 2 ? 'Shaded by distance from the middle of the screen. (With an odd number at each corner, the tiles can\'t be two-coloured.)' : 'Two colours, so no two neighbours match, shaded by distance from the middle of the screen.', triangles: 'Each tile cut into 2p triangles along its mirror lines, alternately light and dark: every dark one is a mirror image of the light ones.', rings: 'A ring in every tile and a star at every corner: the kind of motif Escher used.', lines: 'Just the lines.' }[st.cm];
}
function stats() {
  let note = '';
  if (st.kind === 'pat') { const P = PATTERNS[st.pat], c = patInfo ? patInfo.count : {};
    if (P.wallpaper) { const g = WALLPAPER[P.name], flips = g.ops.filter(o => o[0] * o[3] - o[1] * o[2] < 0).length, turn = Math.max(...g.ops.map(o => { const tr = o[0] + o[3]; return o[0] * o[3] - o[1] * o[2] < 0 ? 1 : tr === 2 ? 1 : tr === -2 ? 2 : tr === 0 ? 4 : tr === 1 ? 6 : 3; }));
      setStats([String(g.ops.length), 'copies in each cell'], [turn > 1 ? turn + '-fold' : 'none', 'turns'], [flips ? 'yes' : 'no', 'mirrors or glides']);
      note = 'Every repeating flat pattern has one of these 17 symmetry types, no more and no fewer.'; }
    else if (P.group === 'quasi') { const tot = Object.values(c).reduce((x, y) => x + y, 0), [num, den, lab] = P.ratio, r2 = c[den] ? (c[num] || 0) / c[den] : 0;
      setStats([String(tot), 'tiles drawn'], [r2 ? r2.toFixed(3) : '–', lab], P.third || [String(P.fold), 'fold symmetry']);
      note = P.limit ? `In the whole infinite tiling this ratio is exactly ${P.limit}. Zoom out (scroll) and watch the count close in on it.` : 'Zoom out to see the counts settle.'; }
    else if (P.group === 'arch') { setStats([P.name, 'round every corner'], [String(c[0] || 0), P.classes[0]], [String(c[1] || 0), P.classes[1]]); note = 'Every corner is surrounded in exactly the same way.'; }
    else { setStats([String(st.seed), 'random pattern no.'], [String((patInfo && (patInfo.lines || Object.values(c).reduce((x, y) => x + y, 0))) || 0), 'pieces drawn'], ['2', 'ways to lay each tile']); note = 'N lays the tiles again at random.'; }
    $('statNote').textContent = note; return; }
  if (st.kind === 'pen') { const T = tiling(st.pen, st.level), k0 = T.filter(t => t[0] === 0).length, k1 = T.length - k0, ratio = st.pen === 'kd' ? k0 / Math.max(1, k1) : k1 / Math.max(1, k0);
    setStats([Math.round(T.length / 2).toLocaleString(), 'tiles'], [ratio.toFixed(4), st.pen === 'kd' ? 'kites per dart' : 'thick per thin'], [String(st.level), 'steps']);
    note = `The golden ratio is 1.6180…; each step brings the count closer to it.`; }
  else if (st.wk !== 'regular') { const v = vertexConfig(st.wk, st.p, st.q).split('.').map(Number), k = v.length, V = geo.K > 0 ? 2 / (1 - k / 2 + v.reduce((a, n) => a + 1 / n, 0)) : Infinity;
    setStats([v.join('.'), 'round every corner'], [isFinite(V) ? String(Math.round(V * v.reduce((a, n) => a + 1 / n, 0))) : '∞', 'tiles'], [isFinite(V) ? String(Math.round(V)) : '∞', 'corners']);
    note = geo.K > 0 ? `Corners × (1 − ${k}/2 + the sum of 1/sides) = 2: Euler's formula fixes how many corners a ball can have.` : 'Every corner is surrounded in exactly the same way: that is what makes a tiling uniform.'; }
  else { const sum = st.q * (180 - 360 / st.p), F = geo.K > 0 ? 4 * st.q / (4 - (st.p - 2) * (st.q - 2)) : Infinity;
    setStats([+sum.toFixed(1) + '°', 'corners add up to'], [isFinite(F) ? String(Math.round(F)) : '∞', 'tiles'], [geo.K > 0 ? 'sphere' : geo.K < 0 ? 'hyperbolic' : 'flat', 'world']);
    note = geo.K > 0 ? `Short of 360° by ${+(360 - sum).toFixed(1)}°: that missing angle at every corner is what curls the tiles into a ball.` : geo.K < 0 ? `${+(sum - 360).toFixed(1)}° too much at every corner, so the plane ruffles: hyperbolic space has room for all of it.` : 'Exactly 360° at every corner, so the tiles lie flat.'; }
  $('statNote').textContent = note;
}
$('pIn').addEventListener('input', e => setPQ(+e.target.value, st.q)); $('qIn').addEventListener('input', e => setPQ(st.p, +e.target.value));
$('goBtn').addEventListener('click', () => go()); $('resetBtn2').addEventListener('click', () => resetView());
$('speed').addEventListener('input', e => { st.speed = +e.target.value; $('speedo').textContent = st.speed.toFixed(1) + '×'; share.touch(); });
$('spin').addEventListener('change', e => { st.spin = e.target.checked; share.touch(); });
$('level').addEventListener('input', e => { st.level = +e.target.value; $('levelo').textContent = st.level; labels(); stats(); dirty = true; share.touch(); });
$('penGo').addEventListener('click', () => go());
segClick('model', d => { const old = st.model; st.model = d.m; if (old !== st.model) homeView(); showKind(); dirty = true; share.touch(); });
$('edges').addEventListener('change', e => { st.edges = e.target.checked; dirty = true; share.touch(); });
$('dual').addEventListener('change', e => { st.dual = e.target.checked; dirty = true; share.touch(); });
$('tri').addEventListener('change', e => { st.tri = e.target.checked; dirty = true; share.touch(); });
$('lw').addEventListener('input', e => { st.lw = +e.target.value; $('lwo').textContent = st.lw.toFixed(1) + '×'; dirty = true; share.touch(); });
segClick('cmode', d => { if (flat2d()) st.pcm = d.c; else st.cm = d.c; labels(); dirty = true; share.touch(); });
let R = rampOf('aurora', false);
buildSwatches($('palettes'), st.palette, name => { st.palette = name; R = rampOf(st.palette, st.palRev); palLabel(); labels(); dirty = true; share.touch(); });
const palLabel = () => { $('palName').textContent = 'Palette: ' + st.palette.replace('_', ' & ').replace(/^./, c => c.toUpperCase()) + (st.palRev ? ' (reversed)' : ''); };
$('palRev').addEventListener('change', e => { st.palRev = e.target.checked; R = rampOf(st.palette, st.palRev); palLabel(); labels(); dirty = true; share.touch(); });
$('cyc').addEventListener('input', e => { st.cycleSpeed = +e.target.value; $('cyco').textContent = st.cycleSpeed ? st.cycleSpeed.toFixed(1) + '×' : 'off'; share.touch(); });
segClick('bg', d => { st.bg = d.b; dirty = true; share.touch(); });
segClick('prSize', d => { st.mm = +d.mm; });
$('prHigh').addEventListener('input', e => { st.high = +e.target.value; $('prHigho').textContent = st.high.toFixed(1) + ' mm'; });
const fileBase = () => st.kind === 'pat' ? 'tiling_' + (PATTERNS[st.pat].wallpaper ? 'wallpaper_' + PATTERNS[st.pat].name : st.pat) : st.kind === 'pen' ? 'penrose_' + (st.pen === 'kd' ? 'kites_darts' : 'rhombs') : `tiling_${st.p}_${st.q}`;
$('snap').addEventListener('click', () => { if (flat2d()) { drawCanvas(); saveCanvasPNG(pc, fileBase() + '.png', $('dlnote')); } else { draw(null); saveCanvasPNG(tc, fileBase() + '.png', $('dlnote')); } });
document.querySelectorAll('.btn.try').forEach(b => b.addEventListener('click', () => { const [a, c, x] = b.dataset.try.split('|');
  if (a === 'pen') { pickPen(c); pview.reset(); return; } if (a === 'pat') { pickPat(c); return; }
  st.wk = KINDS[x] ? x : 'regular'; setPQ(+a, +c, true); if (x === 'half') clickData('#model', 'm', 'half'); setCheck('tri', x === 'tri'); setCheck('dual', x === 'dual'); if (x === 'tri') clickData('#cmode', 'c', 'triangles');
  if (x === 'glide') { st.gliding = true; st.paused = false; } }));
buildKeys($('keyTable'), [['G', 'Glide through the tiling (Penrose: one more step)'], ['N', 'Glide off in a new direction'], ['1 – 4', 'Colour styles'], ['← → ↑ ↓', 'Glide (on the ball: turn it)'], ['W A S D', 'Glide'], ['Shift', 'Hold with the keys above to go three times faster']]);

// ---------- actions ----------
let glideDir = Math.PI / 2;
function go() { st.paused = false; if (st.kind === 'pat') { renew(); return; } if (st.kind === 'pen') { setRange('level', st.level >= 9 ? 2 : st.level + 1); return; } st.gliding = !st.gliding; $('goBtn').textContent = st.gliding ? 'Stop gliding' : 'Glide'; }
function renew() { st.paused = false; if (st.kind === 'pat') { st.seed = 1 + Math.floor(Math.random() * 9998); dirty = true; share.touch(); return; } if (st.kind === 'pen') { pview.set(Math.random() - 0.5, Math.random() - 0.5, 0.25); return; } glideDir = Math.random() * 2 * Math.PI; st.gliding = true; $('goBtn').textContent = 'Stop gliding'; }
function resetView() { st.paused = false; MO.resetView(); if (flat2d()) pview.reset(); else { homeView(); st.gliding = false; $('goBtn').textContent = 'Glide'; } dirty = true; share.touch(); }
// the starting view: a tile in the middle; on the ball, turned partway toward a corner so three or more tiles show
function homeView() { const r = tc.getBoundingClientRect(), tall = r.width > 0 && r.height > r.width ? r.height / r.width : 1;   // fit the shorter side of the screen
  MV = ID(); par = 0; st.zoom = (st.model === 'ball' ? 1 : geo.K < 0 ? 1.04 : geo.K > 0 ? 1.6 : 1) * tall;
  if (st.model === 'ball') MV = norm(T([0.55 * geo.v * Math.cos(geo.a), 0.55 * geo.v * Math.sin(geo.a)])); }
// slide the view by (dx, dy) half-heights at the middle of the screen
function slide(dx, dy) { const z0 = toModelXY(0, 0), z1 = toModelXY(dx, dy); if (z0 && z1) { moveBetween(z1, z0); recentre(); } }
function turn(th) { const zc = toModelXY(0, 0); if (!zc) return; apply(mul(T(zc), mul(ROT(th), T([-zc[0], -zc[1]])))); recentre(); }

// ---------- loop ----------
let running = false, tPrev = 0, frame = 0, dirty = true, flashNow = 0, pulseNow = 0, voiceNow = 0;
// Motion (its own group): drift, zoom and turn, on flat patterns and on {p, q} worlds alike, and Slowly change
const MO = makeMotion2D({ rows: $('glideSec'),
  pan: (dx, dy) => { if (!flat2d()) slide(2 * dx, 2 * dy); else { pview.glide(dx, dy);
    /* a Penrose patch has an edge: slide round it rather than drift off into the empty */
    const r = Math.hypot(pview.cx, pview.cy); if (st.kind === 'pen' && r > 0.55) pview.set(pview.cx * 0.55 / r, pview.cy * 0.55 / r, pview.scale); } dirty = true; },
  zoom: f => { if (flat2d()) return pview.zoomBy(f); const z = st.zoom, flat = geo.K === 0 && st.model === 'plane'; zoomBy(f); return flat || st.zoom !== z; },
  rotate: a => { if (flat2d()) pview.rotate(a); else turn(a); dirty = true; },
  sweep: { skip: ['speed'], every: 60 } });
const REC = addRecorder({ stage: tc.parentElement, name: () => fileBase(), bg: () => st.bg });
// the Visualizer: a new tiling, kind (Wythoff's construction), palette or slow change every eight bars; when the chorus
// comes in, a {p, q} world starts gliding until the next change (a flat pattern gets a fresh random one)
makeVisualizer(MO, { preset: 'mvd=0.25&mvw=1&mvb=0.3&mvn=0.12', shape: () => pickButton('#hypList button, #uniList button, #sphList button, #qcList button, #wallList button, #truList button, #archList button'),
  drop: () => { if (flat2d()) { renew(); return; } if (st.gliding) return; go(); return () => { if (st.gliding) go(); }; }, extra: [['a new kind of tiling', () => !flat2d() && pickButton('#wyKind button')]] });
const clk = { glide: new Groove(), spin: new Groove() };
function loop(now) {
  if (!running) return; const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now; frame++;
  setPausedTag(st.paused); const go = !st.paused;
  if (MO.step(dt, go && !pview.dragging && !drag)) share.touch();
  if (flat2d()) { if (pview.step(dt)) dirty = true; }
  else {
    const d = drive(); if (d.any) { const k = dt * 0.9 * d.scale * (d.fast ? 3 : 1); slide((d.turnX + d.slideX) * k, (d.turnY + d.slideY) * k); dirty = true; }
    // glide and turn surge on each beat with the music, like every other motion (and follow its energy)
    if (go && st.gliding) { const k = clk.glide.delta(dt, 0.18 * st.speed, 0.09 * st.speed); slide(Math.cos(glideDir) * k, Math.sin(glideDir) * k); dirty = true; }
    if (go && st.spin) { turn(clk.spin.delta(dt, 0.15 * st.speed, 0.075 * st.speed)); dirty = true; }
  }
  const cs = go ? colourStep(dt) : 0; if ((go && st.cycleSpeed > 0) || cs) { st.cycle = (st.cycle + (go ? dt * st.cycleSpeed * 0.06 : 0) + cs) % 1; if (st.kind === 'pq' || frame % 4 === 0) dirty = true; }
  const fl = flash(), pu = pulse(), vo = voice(); if (fl !== flashNow || pu !== pulseNow || Math.abs(vo - voiceNow) > 0.01) { flashNow = fl; pulseNow = pu; voiceNow = vo; if (st.kind === 'pq' || frame % 3 === 0) dirty = true; }
  if (dirty) { dirty = false; if (flat2d()) drawCanvas(); else draw(null); }
  if (frame % 30 === 0) share.touch();
  requestAnimationFrame(loop);
}

// ---------- 3D print: the view as a coaster with raised lines ----------
$('prBtn').addEventListener('click', () => {
  const r = (flat2d() ? pc : tc).getBoundingClientRect(), W = 320, Hh = Math.max(40, Math.round(320 * r.height / r.width))   /* about 0.3 mm detail on a 90 mm tile */, H = new Float32Array(W * Hh);
  if (flat2d()) { const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d'); if (st.kind === 'pat') drawPattern(x, W, Hh, { print: true }); else drawPenrose(x, W, Hh, { print: true });
    const px = x.getImageData(0, 0, W, Hh).data; for (let i = 0; i < W * Hh; i++) H[i] = px[i * 4] / 255; }
  else { const t = G.tex(W, Hh, { float: false }) /* 8-bit, so it reads back as bytes */, fb = G.fbo(t); draw(fb, W, Hh, true); const px = new Uint8Array(W * Hh * 4); g.readPixels(0, 0, W, Hh, g.RGBA, g.UNSIGNED_BYTE, px);
    g.bindFramebuffer(g.FRAMEBUFFER, null); g.deleteFramebuffer(fb); g.deleteTexture(t);
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) H[j * W + i] = px[((Hh - 1 - j) * W + i) * 4] / 255; dirty = true; }
  const T3 = heightfieldTriangles(H, W, Hh, st.mm, 2, st.high), res = stlFromTriangles(T3, st.mm, 'Math Explorer tiling');
  saveFile(fileBase() + `_${st.mm}mm.stl`, res.bytes, $('prNote')).then(ok => { if (ok) $('prNote').textContent += ` ${res.size.map(v => Math.round(v)).join(' × ')} mm.`; });
});

// ---------- keys, sharing, lifecycle ----------
export function onKey(e) {
  return standardKeys(e, {
    pause: () => { st.paused = !st.paused; if (st.paused === false && !st.gliding && !st.spin && st.kind === 'pq') go(); }, go, renew, reset: resetView,
    shape: dir => clickNext('#sphList button, #flatList button, #hypList button, #uniList button, #penList button, #archList button, #qcList button, #wallList button, #truList button', dir), palette: dir => clickNext('#palettes button', dir), colourMode: dir => clickNext('#cmode button', dir),
    reverse: () => $('palRev').click(), cycle: () => setRange('cyc', st.cycleSpeed > 0 ? 0 : 1),
    zoom: f => (flat2d() ? pview.zoomAt(f) : zoomBy(f)), mode: i => { const b = document.querySelectorAll('#cmode button')[i]; if (b) b.click(); },
  });
}
const encode = () => { const p = new URLSearchParams();
  if (st.kind === 'pat') { p.set('t', 'pat_' + st.pat); p.set('sd', st.seed); p.set('v', [pview.cx, pview.cy, pview.scale].map(r8).join('_')); p.set('cm', st.pcm); }
  else if (st.kind === 'pen') { p.set('t', st.pen); p.set('lv', st.level); p.set('v', [pview.cx, pview.cy, pview.scale].map(r8).join('_')); p.set('cm', st.pcm); }
  else { p.set('t', st.p + '_' + st.q); if (st.wk !== 'regular') p.set('wk', st.wk); p.set('md', st.model); p.set('zm', r4(st.zoom)); p.set('m', MV.flat().map(r8).join('_')); if (par) p.set('pr', 1); p.set('cm', st.cm);
    if (st.dual) p.set('du', 1); if (st.tri) p.set('tr', 1); if (st.gliding) p.set('gl', r4(glideDir)); if (st.spin) p.set('sp', 1); if (st.speed !== 1) p.set('spd', st.speed); }
  if (!st.edges) p.set('ed', 0); if (st.lw !== 1) p.set('lw', st.lw); p.set('pal', st.palette); if (st.palRev) p.set('rev', 1); if (st.cycleSpeed) p.set('cyc', st.cycleSpeed); if (st.bg !== '#0b0d12') p.set('bg', st.bg.slice(1));
  if (flat2d() && pview.rot) p.set('vr', r4(pview.rot)); MO.encode(p);
  return p.toString(); };
function applyCode(code) {
  const p = new URLSearchParams(code), t = p.get('t') || ''; let ok = false;
  setCheck('edges', p.get('ed') !== '0'); setRange('lw', num(p, 'lw', 1)); clickData('#palettes', 'pal', p.get('pal') || 'aurora'); setCheck('palRev', p.get('rev') === '1'); setRange('cyc', num(p, 'cyc', 0)); clickData('#bg', 'b', '#' + (p.get('bg') || '0b0d12'));
  if (t.startsWith('pat_') && PATTERNS[t.slice(4)]) { st.pcm = ['shapes', 'direction', 'lines'].includes(p.get('cm')) ? p.get('cm') : 'shapes'; st.seed = Math.max(1, Math.round(num(p, 'sd', 1))); pickPat(t.slice(4));
    const v = (p.get('v') || '').split('_').map(Number); if (v.length === 3 && v.every(isFinite) && v[2] > 0) pview.set(v[0], v[1], v[2]); ok = true; }
  else if (t === 'rh' || t === 'kd') { st.pcm = ['shapes', 'direction', 'lines'].includes(p.get('cm')) ? p.get('cm') : 'shapes'; pickPen(t); setRange('level', clamp(num(p, 'lv', 6), 0, 9));
    const v = (p.get('v') || '').split('_').map(Number); if (v.length === 3 && v.every(isFinite) && v[2] > 0) pview.set(v[0], v[1], v[2]); else pview.reset(); ok = true; }
  else { const [a, b] = t.split('_').map(Number); if (a >= 3 && b >= 3 && a <= 12 && b <= 12) {
    st.cm = ['tiles', 'triangles', 'rings', 'lines'].includes(p.get('cm')) ? p.get('cm') : 'tiles'; st.wk = KINDS[p.get('wk')] ? p.get('wk') : 'regular'; st.model = p.get('md') || ''; setPQ(a, b, true);
    if (MODELS[geo.K].some(m => m[0] === p.get('md'))) { st.model = p.get('md'); showKind(); }
    st.zoom = clamp(num(p, 'zm', st.zoom), 0.02, 3); const m = (p.get('m') || '').split('_').map(Number); if (m.length === 8 && m.every(isFinite)) { MV = norm([[m[0], m[1]], [m[2], m[3]], [m[4], m[5]], [m[6], m[7]]]); par = p.get('pr') === '1' ? 1 : 0; recentre(); }
    setCheck('dual', p.get('du') === '1'); setCheck('tri', p.get('tr') === '1'); setCheck('spin', p.get('sp') === '1'); setRange('speed', num(p, 'spd', 1));
    st.gliding = p.has('gl'); if (st.gliding) glideDir = num(p, 'gl', Math.PI / 2); $('goBtn').textContent = st.gliding ? 'Stop gliding' : 'Glide'; ok = true; } }
  pview.rot = flat2d() ? num(p, 'vr', 0) : 0; MO.decode(p);
  dirty = true; return ok;
}
const share = makeShare('tiling', encode, applyCode);
MO.onChange = () => share.touch();
prog = G.prog(FS); palLabel();
if (!applyCode(parseRoute().code)) setPQ(7, 3, true);
export function start() { running = true; tPrev = performance.now(); dirty = true; requestAnimationFrame(loop); share.write(); }
export function stop() { running = false; REC.stop(); }
export const reset = resetView;
export const going = () => st.kind !== 'pq' || st.gliding;   /* a tap glides {p,q}; elsewhere G makes a new pattern, so a tap just pauses */
export const layoutChanged = () => { dirty = true; };
export const showView = code => applyCode(code);
export const soundHelp = 'Here, each beat flashes the tiles brighter (or, with Pulse, zooms in a touch). Gliding and turning surge on each beat and follow the music\'s energy, as does everything under Motion; vocals swell the lines a little, and colour drifts the palette.';
