// Waves & Cymatics explorer: ripples adding up, a simulated wave tank, sand on a ringing plate, a plucked string and
// drawings made of circles. Importing this module boots the explorer; the exports are the lifecycle js/main.js drives.
import { $, clamp, segClick, clickNext, setRange, setCheck, clickData, setStats, buildSwatches, rampCss, r4, num, standardKeys, buildKeys, makeShare } from '../../js/common/kit.js';
import { rampOf, rampUniform, sampleRamp, css, hexRGB, PAL_GLSL } from '../../js/common/palettes.js';
import { makeGL, noWebGL } from '../../js/common/gl.js';
import { saveCanvasPNG, saveFile, fileName } from '../../js/common/save.js';
import { stlFromTriangles, heightfieldTriangles } from '../../js/common/stl.js';
import { flashFx as flash, pulseFx as pulse, voiceFx as voice, colourStep, energyMul, BeatGate, reacting } from '../../js/shell/audio/react.js';
import { setPausedTag, drive } from '../../js/shell/keys.js';
import { parseRoute } from '../../js/shell/route.js';
import { makeMotion2D, addRecorder } from '../../js/common/motion.js';
import { makeVisualizer, pickButton, randomSlider } from '../../js/common/visualizer.js';
import { plateGrid, modeName, SQUARE_MODES, ROUND_MODES, CURVES, samplePath, resample, dft, shapedModes, isShaped, PLATE_INFO, MASKS } from './fields.js';

// ---------- state ----------
const st = { mode: 'ripple', speed: 1, show: 'wave', relief: true, palette: 'ocean', palRev: false, cycle: 0, cycleSpeed: 0, bg: '#0b0d12', paused: false, mm: 90, high: 4,
  rip: { pre: 'two', wlen: 0.14, fade: 0.6, src: [] },
  tank: { pre: 'double', wlen: 22, mach: 0.6, draw: 'splash' },
  plate: { shape: 'square', i: 4, grains: 16000, shake: 1, showPlate: true, beatMode: false },
  str: { pluck: 0.2, harm: 12, damp: 0.5, parts: true },
  epi: { curve: 'heart', n: 40, circ: true, target: false, own: null } };
const INFO = {
  ripple: ['Ripples', 'waves spreading from points, adding up', 'Each white dot sends out rings of waves. Where the rings meet they simply add: crest plus crest makes a bigger crest, crest plus trough makes calm water. That is <strong>interference</strong>, and it\'s the same for sound, light and water.'],
  tank: ['Wave tank', 'a simulated pool: splashes, slits, walls', 'A real simulation of the wave equation: every point of the water is pulled toward the average of its neighbours, so a bump spreads out as a ring. Walls reflect, gaps make new rings, and slower water (the lens) bends the waves. The edges soak the waves up, as if the pool went on forever.'],
  plate: ['Chladni plate', 'sand gathers where the plate stays still', 'A ringing plate moves in a pattern: some parts swing up and down, but along certain lines it doesn\'t move at all. Sand bounces off the moving parts and comes to rest on those still lines. Each pattern belongs to one note; higher notes draw busier figures.'],
  string: ['A plucked string', 'one pluck, many harmonics at once', 'A plucked string vibrates in many ways at once: as a whole, in halves, thirds, quarters… Each of these <strong>harmonics</strong> sounds at a whole-number multiple of the lowest note. Added together they make the bent shape you plucked, and the mix of them is what makes a guitar sound like a guitar.'],
  epi: ['Epicycles', 'any closed drawing, rebuilt from spinning circles', 'Each circle spins at a whole number of turns per lap and rides on the end of the one before. The pen at the end of the chain draws the shape. This is the <strong>Fourier series</strong>: any repeating motion can be built from simple circles.'] };

// ---------- canvases ----------
const wc = $('wc'), wo = $('wo'), og = wo.getContext('2d'), G = makeGL(wc);
if (!G) throw noWebGL($('na'), 'Waves & Cymatics');
const g = G.g;
const fitOverlay = () => { const r = wo.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2), W = Math.max(1, Math.round(r.width * d)), H = Math.max(1, Math.round(r.height * d)); if (wo.width !== W || wo.height !== H) { wo.width = W; wo.height = H; } og.setTransform(d, 0, 0, d, 0, 0); return r; };
// the ripples spread over the whole plane, so the driving keys move round it: pan is where the middle of the screen is (ripples only)
// wz is how much of the plane the screen shows (1: two units from top to bottom) and wa how far the view is turned
const pan = [0, 0]; let wz = 1, wa = 0;
const toWorld = (px, py) => { const r = wo.getBoundingClientRect(), x = (px - r.left - r.width / 2) / (r.height / 2), y = -(py - r.top - r.height / 2) / (r.height / 2);
  if (st.mode !== 'ripple') return [x, y]; const c = Math.cos(wa), s = Math.sin(wa); return [(c * x - s * y) * wz + pan[0], (s * x + c * y) * wz + pan[1]]; };
// Motion (its own group): drift, zoom and turn round the pond (ripples only; it keeps within reach of the sources), and
// Slowly change, which works in every mode (the wavelength, the plate's pattern, the number of circles...)
const MO = makeMotion2D({
  pan: (dx, dy) => { const c = Math.cos(wa), s = Math.sin(wa); pan[0] += 2 * wz * (c * dx - s * dy); pan[1] += 2 * wz * (s * dx + c * dy);
    const r = Math.hypot(...pan); if (r > 2.5) { pan[0] *= 2.5 / r; pan[1] *= 2.5 / r; } },
  zoom: f => { const z = clamp(wz * f, 0.3, 4), ok = z !== wz; wz = z; return ok; },
  rotate: a => { wa = (wa + a) % (2 * Math.PI); },
  note: 'Drift, zoom and turn move round the pond (Ripples only). Slowly change works in every mode.',
  sweep: { skip: ['speed', 'grains'], every: 40 } });
const REC = addRecorder({ stage: wc.parentElement, name: () => fileBase(), bg: () => st.bg });
// the Visualizer: something new in this mode every eight bars (a ripple pattern, a tank set-up, a plate pattern, a pluck,
// a drawing); a fresh start when the chorus comes in; in the tank, snares splash
const waveShape = () => ({ ripple: () => pickButton('#ripPre button'), tank: () => pickButton('#tankPre button'), plate: () => randomSlider('pmode'), string: () => randomSlider('pluck', 0.1, 0.9), epi: () => pickButton('#curveList button') }[st.mode]());
makeVisualizer(MO, { preset: 'mvd=0.2&mvw=1&mvb=0.3&mvn=0.1', shape: waveShape, drop: () => { waveShape(); renew(); },
  snare: () => { if (st.mode === 'tank' && TK) TK.splash = [TK.W * (0.15 + 0.7 * Math.random()), TK.H * (0.15 + 0.7 * Math.random()), 1.2]; } });

// ---------- ripples (one shader adds up every source exactly) ----------
const FS_RIP = `#version 300 es
precision highp float; out vec4 outC;
uniform vec2 u_res, u_src[8], u_pan, u_ang; uniform int u_n, u_show, u_relief; uniform float u_zs, u_k, u_t, u_fade, u_cycle, u_flash, u_amp; uniform vec3 u_bg;
${PAL_GLSL}
float H(vec2 p){ float h=0.0; for (int i=0;i<8;i++){ if (i>=u_n) break; float r=distance(p,u_src[i]); h+=cos(u_k*r-u_t)*pow(1.0+r*8.0,-0.5*u_fade); } return h; }
void main(){
  vec2 p=mat2(u_ang.x,u_ang.y,-u_ang.y,u_ang.x)*(gl_FragCoord.xy-0.5*u_res)/(0.5*u_res.y)*u_zs+u_pan; float nn=max(1.0,sqrt(float(u_n))); vec3 col;
  if (u_show==1){ vec2 s=vec2(0.0); for (int i=0;i<8;i++){ if (i>=u_n) break; float r=distance(p,u_src[i]), a=pow(1.0+r*8.0,-0.5*u_fade); s+=a*vec2(cos(u_k*r),sin(u_k*r)); }
    float L=length(s)/float(max(u_n,1)); col=pal(clamp(L*1.15,0.0,1.0)*0.5+u_cycle); col*=0.25+0.75*smoothstep(0.0,0.35,L); }
  else { float h=H(p)*u_amp, t=clamp(0.5+0.5*h/nn,0.0,1.0); col=pal(t*0.5+u_cycle);
    if (u_relief==1){ float e=1.5/(0.5*u_res.y); vec3 n=normalize(vec3(-(H(p+vec2(e,0.0))-H(p-vec2(e,0.0)))/(2.0*e), -(H(p+vec2(0.0,e))-H(p-vec2(0.0,e)))/(2.0*e), u_k*1.4*nn)); col*=0.55+0.6*max(dot(n,normalize(vec3(-0.4,0.5,0.8))),0.0); } }
  outC=vec4(col*(1.0+0.35*u_flash)+0.05*u_flash,1.0); }`;

// ---------- the wave tank: the wave equation, stepped on the graphics card ----------
// state texture: r = height now, g = height a step ago, b = how loud it's been lately; medium texture: r = wall, g = wave speed (1 normal)
const FS_SIM = `#version 300 es
precision highp float; in vec2 vUv; out vec4 outC;
uniform sampler2D u_s, u_m; uniform vec2 u_px, u_sp[4]; uniform float u_t, u_om, u_line; uniform int u_ns; uniform vec3 u_splash;
void main(){
  vec4 s=texture(u_s,vUv), m=texture(u_m,vUv); vec2 g=vUv/u_px, sz=1.0/u_px;
  if (m.r>0.5){ outC=vec4(0.0,0.0,s.b*0.995,1.0); return; }
  float u=s.r, lap=texture(u_s,vUv+vec2(u_px.x,0.0)).r+texture(u_s,vUv-vec2(u_px.x,0.0)).r+texture(u_s,vUv+vec2(0.0,u_px.y)).r+texture(u_s,vUv-vec2(0.0,u_px.y)).r-4.0*u;
  float un=2.0*u-s.g+0.24*m.g*lap;
  float e=min(min(g.x,sz.x-g.x),min(g.y,sz.y-g.y)); un*= e<20.0 ? mix(0.90,1.0,e/20.0) : 0.9998;   // the edges soak waves up
  float drive=sin(u_t*u_om);
  for (int i=0;i<4;i++){ if (i>=u_ns) break; float d=distance(g,u_sp[i]); un=mix(un,drive,1.0-smoothstep(0.0,2.5,d)); }
  if (u_line>=0.0 && abs(g.x-u_line)<1.0) un=drive;
  if (u_splash.z!=0.0){ vec2 d=g-u_splash.xy; un+=u_splash.z*exp(-dot(d,d)/14.0); }
  outC=vec4(un,u,mix(s.b,un*un,0.012),1.0); }`;
const FS_MED = `#version 300 es
precision highp float; in vec2 vUv; out vec4 outC;
uniform sampler2D u_m; uniform int u_pre; uniform vec4 u_paint; uniform vec2 u_size;
void main(){
  vec2 g=vUv*u_size; float W=u_size.x, H=u_size.y; vec4 m=vec4(0.0,1.0,0.0,1.0);
  if (u_pre<0) m=texture(u_m,vUv);
  else if (u_pre==1){ if (abs(g.x-W*0.4)<2.0 && abs(abs(g.y-H*0.5)-H*0.1)>3.5) m.r=1.0; }
  else if (u_pre==2){ if (abs(g.x-W*0.4)<2.0 && abs(g.y-H*0.5)>8.0) m.r=1.0; }
  else if (u_pre==3){ float R=H*0.62, th=H*0.13; vec2 c=vec2(W*0.42,H*0.5); if (distance(g,c-vec2(R-th,0.0))<R && distance(g,c+vec2(R-th,0.0))<R) m.g=0.42; }
  else if (u_pre==4){ if (abs(g.x-W*0.4)<2.0 && g.y<H*0.5) m.r=1.0; }
  if (u_paint.w>0.0 && distance(g,u_paint.xy)<u_paint.z) m.r = u_paint.w<1.5 ? 1.0 : 0.0;
  outC=m; }`;
const FS_TANK = `#version 300 es
precision highp float; out vec4 outC;
uniform sampler2D u_s, u_m; uniform vec2 u_res, u_px; uniform int u_show, u_relief; uniform float u_cycle, u_flash, u_gain; uniform vec3 u_bg;
${PAL_GLSL}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res; vec4 s=texture(u_s,uv), m=texture(u_m,uv); vec3 col;
  if (u_show==1) col=pal(clamp(sqrt(s.b)*2.2,0.0,1.0)*0.5+u_cycle)*(0.2+0.8*smoothstep(0.0,0.25,sqrt(s.b)*2.2));
  else { col=pal((0.5+0.5*tanh(s.r*2.5*u_gain))*0.5+u_cycle);   // squeezed, so faint waves past a slit still show
    if (u_relief==1){ float dx=texture(u_s,uv+vec2(u_px.x,0.0)).r-texture(u_s,uv-vec2(u_px.x,0.0)).r, dy=texture(u_s,uv+vec2(0.0,u_px.y)).r-texture(u_s,uv-vec2(0.0,u_px.y)).r;
      vec3 n=normalize(vec3(-dx*3.0,-dy*3.0,1.0)); col*=0.55+0.6*max(dot(n,normalize(vec3(-0.4,0.5,0.8))),0.0); } }
  if (m.g<0.9) col=mix(col,vec3(0.85,0.95,1.0),0.18);
  if (m.r>0.5) col=vec3(0.78,0.8,0.86);
  outC=vec4(col*(1.0+0.35*u_flash)+0.05*u_flash,1.0); }`;
const FS_CLEAR = `#version 300 es
precision highp float; out vec4 outC; void main(){ outC=vec4(0.0); }`;
let P = {};
function progs() { P = { rip: G.prog(FS_RIP), sim: G.prog(FS_SIM), med: G.prog(FS_MED), tank: G.prog(FS_TANK), clr: G.prog(FS_CLEAR) }; }
const PRE_ID = { splash: 0, double: 1, single: 2, lens: 3, corner: 4, doppler: 0 };
let TK = null;   // {W, H, S, M, t, src, line, splash}
function tankSetup(keepWalls) {
  if (!G.floatOK) { TK = null; return; }
  const r = wc.getBoundingClientRect(), W = 420, H = Math.max(60, Math.round(420 * r.height / Math.max(1, r.width)));
  if (!TK || TK.W !== W || TK.H !== H) { if (TK) { TK.S.free(); TK.M.free(); } TK = { W, H, S: G.pair(W, H, { float: true }), M: G.pair(W, H, { float: false }) }; keepWalls = false; }
  TK.t = 0; TK.splash = null; TK.paint = null;
  for (const f of [TK.S.a.fb, TK.S.b.fb]) { g.useProgram(P.clr.p); G.draw(f, W, H); }
  if (!keepWalls) medPass(PRE_ID[st.tank.pre] ?? 0, null);
  tankSources();
}
function medPass(pre, paint) {
  const M = TK.M; g.useProgram(P.med.p); G.bindTex(P.med, 'u_m', M.a.t, 0); g.uniform1i(P.med.u('u_pre'), pre); g.uniform2f(P.med.u('u_size'), TK.W, TK.H);
  g.uniform4f(P.med.u('u_paint'), ...(paint || [0, 0, 0, 0])); G.draw(M.b.fb, TK.W, TK.H); M.swap();
}
function tankSources() { const p = st.tank.pre, W = TK.W, H = TK.H;
  TK.src = p === 'doppler' ? [[W * 0.15, H * 0.5]] : p === 'splash' ? [] : []; TK.line = ['double', 'single', 'lens', 'corner'].includes(p) ? 26 : -1; TK.x0 = W * 0.15; }
function tankStep(n) {
  const T = TK, om = Math.PI / st.tank.wlen * 1.0;   // waves move about 0.49 cells a step, so this gives the chosen wavelength in cells
  for (let i = 0; i < n; i++) {
    T.t++; if (st.tank.pre === 'doppler') { const v = 0.49 * st.tank.mach; T.src[0][0] = T.x0 + v * T.t; if (T.src[0][0] > T.W - 24) { T.t = 0; T.src[0][0] = T.x0; } }
    g.useProgram(P.sim.p); const U = k => P.sim.u(k); G.bindTex(P.sim, 'u_s', T.S.a.t, 0); G.bindTex(P.sim, 'u_m', T.M.a.t, 1);
    g.uniform2f(U('u_px'), 1 / T.W, 1 / T.H); g.uniform1f(U('u_t'), T.t); g.uniform1f(U('u_om'), om); g.uniform1f(U('u_line'), T.line); g.uniform1i(U('u_ns'), T.src.length);
    const sp = new Float32Array(8); T.src.forEach((s, j) => { sp[j * 2] = s[0]; sp[j * 2 + 1] = s[1]; }); g.uniform2fv(U('u_sp'), sp);
    g.uniform3f(U('u_splash'), ...(T.splash && i === 0 ? T.splash : [0, 0, 0])); G.draw(T.S.b.fb, T.W, T.H); T.S.swap();
  }
  T.splash = null; if (T.paint) { medPass(-1, T.paint); T.paint = null; }
}

// ---------- the plate and its sand ----------
let PL = null, sand = null;   // PL: {A, N, pitch, img}; sand: Float32Array of x, y pairs in -1..1
function plateSetup() { const shape = st.plate.shape; PL = plateGrid(shape, st.plate.i, 200);
  if (!PL) { PL = { A: new Float32Array(4).fill(NaN), N: 2, pitch: 1, waiting: true }; const el = $('stageCap'); el.innerHTML = '<b>Working out how this plate can ring…</b> (a second or two, once)'; el.style.display = 'block';
    shapedModes(shape).then(() => { if (st.plate.shape !== shape) return; el.style.display = 'none'; plateSetup(); freshSand(); labels(); }); return; }
  PL.img = null; }
const insidePlate = (x, y) => { if (st.plate.shape === 'round') return x * x + y * y <= 0.99; if (!isShaped(st.plate.shape)) return Math.abs(x) < 0.995 && Math.abs(y) < 0.995;
  return MASKS[st.plate.shape](x, y); };   // the exact outline, so sand lines up with the smooth edge
// a sharp outline for shaped plates (their patterns are worked out on a coarser grid)
const maskCanvas = {};
function plateMask(shape, S) { const k = shape + S; if (maskCanvas[k]) return maskCanvas[k]; const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), im = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { let n = 0; for (const [a, b] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) if (MASKS[shape]((i + a) / S * 2 - 1, 1 - (j + b) / S * 2)) n++; im.data[(j * S + i) * 4 + 3] = n * 63.75; }
  x.putImageData(im, 0, 0); return (maskCanvas[k] = c); }
function freshSand() { const n = st.plate.grains; sand = new Float32Array(n * 2); for (let i = 0; i < n; i++) { let x, y; let tries = 0; do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; } while (!insidePlate(x, y) && ++tries < 200); sand[i * 2] = x; sand[i * 2 + 1] = y; } }
const ampAt = (x, y) => { const N = PL.N, fx = (x + 1) / 2 * N - 0.5, fy = (y + 1) / 2 * N - 0.5, i = clamp(Math.floor(fx), 0, N - 2), j = clamp(Math.floor(fy), 0, N - 2), tx = clamp(fx - i, 0, 1), ty = clamp(fy - j, 0, 1), A = PL.A;
  const v = (A[j * N + i] * (1 - tx) + A[j * N + i + 1] * tx) * (1 - ty) + (A[(j + 1) * N + i] * (1 - tx) + A[(j + 1) * N + i + 1] * tx) * ty; return isNaN(v) ? 0 : v; };
let gauss2 = () => { const u = Math.random() || 1e-9, v = Math.random(); const r = Math.sqrt(-2 * Math.log(u)); return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)]; };
function sandStep(dt, shake) {
  if (PL.waiting) return; const n = sand.length / 2, round = st.plate.shape === 'round', shaped = isShaped(st.plate.shape), k = 0.05 * shake * Math.min(dt * 60, 2), e = 0.004;
  for (let i = 0; i < n; i++) { let x = sand[i * 2], y = sand[i * 2 + 1]; const a = Math.abs(ampAt(x, y));
    if (a > 0.02) { const [gx, gy] = gauss2(); const ax = Math.abs(ampAt(x + e, y)) - Math.abs(ampAt(x - e, y)), ay = Math.abs(ampAt(x, y + e)) - Math.abs(ampAt(x, y - e));
      x += gx * k * a * 0.5 - ax / (2 * e) * k * 0.08; y += gy * k * a * 0.5 - ay / (2 * e) * k * 0.08; }
    if (round) { const r = Math.hypot(x, y); if (r > 0.995) { x *= 0.99 / r; y *= 0.99 / r; } } else if (shaped) { if (!insidePlate(x, y)) { x = sand[i * 2]; y = sand[i * 2 + 1]; } } else { x = clamp(x, -0.995, 0.995); y = clamp(y, -0.995, 0.995); }
    sand[i * 2] = x; sand[i * 2 + 1] = y; }
}
// guide lines (plate outline, the string's rest line, circles and arms): white, or dark ink on the Paper background
const ink = a => (st.bg === '#f3efe6' ? `rgba(28,30,38,${a})` : `rgba(255,255,255,${a})`);
function drawPlate(r) {
  const S = Math.min(r.width, r.height) * 0.86, x0 = (r.width - S) / 2, y0 = (r.height - S) / 2, round = st.plate.shape === 'round';
  og.fillStyle = st.bg; og.fillRect(0, 0, r.width, r.height);
  if (!PL.img) { const N = PL.N, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), im = x.createImageData(N, N), lut = [];
    for (let i = 0; i < 256; i++) lut.push(sampleRamp(R, ((i / 255) * 0.999 + st.cycle) % 1));
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let a = PL.A[(N - 1 - j) * N + i]; const o = (j * N + i) * 4; if (isNaN(a)) { if (!isShaped(st.plate.shape)) { im.data[o + 3] = 0; continue; } a = 0; }   /* shaped plates: outside cells as still, the sharp mask trims them */
      const c3 = st.plate.showPlate ? lut[Math.round((0.5 + 0.5 * a) * 255)].map(v => v * 0.55) : [0.16, 0.17, 0.2]; im.data[o] = c3[0] * 255; im.data[o + 1] = c3[1] * 255; im.data[o + 2] = c3[2] * 255; im.data[o + 3] = 255; }
    x.putImageData(im, 0, 0); PL.img = c; }
  if (PL.waiting) return; const shaped = isShaped(st.plate.shape);
  if (shaped) { const Si = Math.max(8, Math.round(S)), t = drawPlate.tmp || (drawPlate.tmp = document.createElement('canvas')); t.width = t.height = Si; const tx = t.getContext('2d');
    tx.imageSmoothingEnabled = true; tx.drawImage(PL.img, 0, 0, Si, Si); tx.globalCompositeOperation = 'destination-in'; tx.drawImage(plateMask(st.plate.shape, Si), 0, 0); tx.globalCompositeOperation = 'source-over'; og.drawImage(t, x0, y0, S, S); }
  else { og.save(); og.beginPath(); if (round) og.arc(r.width / 2, r.height / 2, S / 2, 0, 2 * Math.PI); else og.rect(x0, y0, S, S); og.clip(); og.imageSmoothingEnabled = true; og.drawImage(PL.img, x0, y0, S, S); og.restore(); }
  if (!shaped) { og.strokeStyle = ink(.25); og.lineWidth = 1.5; og.beginPath(); if (round) og.arc(r.width / 2, r.height / 2, S / 2, 0, 2 * Math.PI); else og.rect(x0, y0, S, S); og.stroke(); }
  og.fillStyle = css([0.97, 0.93, 0.82].map(v => Math.min(1, v * (1 + 0.35 * flashNow) + 0.05 * flashNow))); const n = sand.length / 2, gs = Math.max(1, S / 520);
  for (let i = 0; i < n; i++) og.fillRect(x0 + (sand[i * 2] + 1) / 2 * S - gs / 2, y0 + (1 - sand[i * 2 + 1]) / 2 * S - gs / 2, gs, gs);
}

// ---------- the string ----------
let strT = 0;
const coef = (n, p) => 2 * Math.sin(n * Math.PI * p) / (n * n * Math.PI * Math.PI * p * (1 - p));
function drawString(r) {
  og.fillStyle = st.bg; og.fillRect(0, 0, r.width, r.height);
  const S = st.str, L = r.width * 0.84, x0 = (r.width - L) / 2, yc = r.height * (S.parts ? 0.34 : 0.5), amp = r.height * 0.16, N = 160, w = 2 * Math.PI * 0.9;
  const dec = n => Math.exp(-S.damp * strT * (0.3 + 0.12 * n)), y = (x, n) => coef(n, S.pluck) * Math.sin(n * Math.PI * x) * Math.cos(n * w * strT) * dec(n);
  og.strokeStyle = ink(.18); og.lineWidth = 1; og.beginPath(); og.moveTo(x0, yc); og.lineTo(x0 + L, yc); og.stroke();
  og.fillStyle = '#9aa0ad'; og.fillRect(x0 - 4, yc - 14, 4, 28); og.fillRect(x0 + L, yc - 14, 4, 28);
  og.strokeStyle = css(sampleRamp(R, (0.75 + st.cycle) % 1).map(v => Math.min(1, v * (1 + 0.35 * flashNow) + 0.05 * flashNow))); og.lineWidth = 3; og.beginPath();
  for (let i = 0; i <= N; i++) { const x = i / N; let s = 0; for (let n = 1; n <= S.harm; n++) s += y(x, n); i ? og.lineTo(x0 + x * L, yc - s * amp) : og.moveTo(x0 + x * L, yc - s * amp); } og.stroke();
  if (S.parts) { const rows = Math.min(S.harm, 8), top = r.height * 0.56, rh = (r.height * 0.36) / rows;
    for (let n = 1; n <= rows; n++) { const yc2 = top + (n - 0.5) * rh; og.strokeStyle = css(sampleRamp(R, ((n - 1) / Math.max(1, rows - 1) * 0.8 + 0.1 + st.cycle) % 1)); og.lineWidth = 1.6; og.beginPath();
      for (let i = 0; i <= N; i++) { const x = i / N, v = y(x, n) * amp * 1.4; i ? og.lineTo(x0 + x * L * 0.78, yc2 - v) : og.moveTo(x0, yc2 - v); } og.stroke();
      og.fillStyle = '#9aa0ad'; og.font = '11px system-ui, sans-serif'; og.fillText(n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th', x0 + L * 0.8, yc2 + 4);
      const bw = L * 0.16 * Math.abs(coef(n, S.pluck)) / Math.abs(coef(1, S.pluck) || 1); og.fillRect(x0 + L * 0.84, yc2 - 3, Math.max(1, bw), 6); } }
  og.fillStyle = ink(.55); og.beginPath(); og.arc(x0 + S.pluck * L, yc + 22, 4, 0, 2 * Math.PI); og.fill();
}

// ---------- epicycles ----------
let EP = { C: [], t: 0, trail: [], path: [] }, drawing = null;
function epiSetup() { const pts = st.epi.curve === 'own' && st.epi.own ? st.epi.own : samplePath(CURVES[st.epi.curve in CURVES ? st.epi.curve : 'heart'][1], 512); EP = { C: dft(pts), t: 0, trail: [], path: pts }; }
function drawEpi(r, dt) {
  og.fillStyle = st.bg; og.fillRect(0, 0, r.width, r.height); const S = Math.min(r.width, r.height) * 0.4, cx = r.width / 2, cy = r.height / 2, X = p => cx + p[0] * S, Y = p => cy - p[1] * S;
  if (drawing) { og.strokeStyle = ink(1); og.lineWidth = 2; og.beginPath(); drawing.forEach((p, i) => i ? og.lineTo(X(p), Y(p)) : og.moveTo(X(p), Y(p))); og.stroke(); return; }
  if (st.epi.target) { og.strokeStyle = ink(.2); og.lineWidth = 1.5; og.beginPath(); EP.path.forEach((p, i) => i ? og.lineTo(X(p), Y(p)) : og.moveTo(X(p), Y(p))); og.closePath(); og.stroke(); }
  const n = Math.min(st.epi.n, EP.C.length), at = t => { let x = 0, y = 0; for (let i = 0; i < n; i++) { const c = EP.C[i], a = 2 * Math.PI * c.f * t + c.ph; x += c.r * Math.cos(a); y += c.r * Math.sin(a); } return [x, y]; };
  let x = 0, y = 0;
  if (st.epi.circ) for (let i = 0; i < n; i++) { const c = EP.C[i], a = 2 * Math.PI * c.f * EP.t + c.ph, nx = x + c.r * Math.cos(a), ny = y + c.r * Math.sin(a);
    if (c.r * S > 0.6) { og.strokeStyle = ink(.16); og.lineWidth = 1; og.beginPath(); og.arc(X([x, y]), Y([x, y]), c.r * S, 0, 2 * Math.PI); og.stroke();
      og.strokeStyle = ink(.5); og.beginPath(); og.moveTo(X([x, y]), Y([x, y])); og.lineTo(X([nx, ny]), Y([nx, ny])); og.stroke(); } x = nx; y = ny; }
  else [x, y] = at(EP.t);
  // the trail: the curve drawn so far this lap, then the whole lap fading
  const steps = 400, done = Math.floor(EP.t * steps); og.lineWidth = 2.4; og.lineCap = 'round';
  for (let k = 0; k < steps; k++) { const t0 = k / steps, t1 = (k + 1) / steps, ahead = k > done; if (ahead && EP.laps === 0) break;
    const a = ahead ? 0.25 : 0.35 + 0.65 * (k / Math.max(1, done)); og.strokeStyle = css(sampleRamp(R, (t0 * 0.9 + 0.05 + st.cycle) % 1).map(v => Math.min(1, v * (1 + 0.35 * flashNow) + 0.05 * flashNow)), a);
    const p0 = EP.cache[k] || (EP.cache[k] = at(t0)), p1 = EP.cache[k + 1] || (EP.cache[k + 1] = at(t1)); og.beginPath(); og.moveTo(X(p0), Y(p0)); og.lineTo(X(p1), Y(p1)); og.stroke(); }
  og.fillStyle = ink(1); og.beginPath(); og.arc(X([x, y]), Y([x, y]), 3.5, 0, 2 * Math.PI); og.fill();
}
const epiReset = () => { EP.t = 0; EP.laps = 0; EP.cache = []; };

// ---------- pointer ----------
let grab = null;
wo.addEventListener('pointerdown', e => { wo.setPointerCapture(e.pointerId); const [x, y] = toWorld(e.clientX, e.clientY), m = st.mode;
  if (m === 'ripple') { let best = 0.08, bi = -1; st.rip.src.forEach((s, i) => { const d = Math.hypot(s[0] - x, s[1] - y); if (d < best) { best = d; bi = i; } });
    if (bi < 0 && st.rip.src.length) { let bd = 1e9; st.rip.src.forEach((s, i) => { const d = Math.hypot(s[0] - x, s[1] - y); if (d < bd) { bd = d; bi = i; } }); st.rip.src[bi] = [x, y]; } grab = { i: bi }; dirty = true; share.touch(); }
  else if (m === 'tank') { grab = { tank: true }; tankPointer(e); }
  else if (m === 'string') { grab = { str: true }; strPointer(e); }
  else if (m === 'epi') drawing = [epiPt(e)]; });
wo.addEventListener('pointermove', e => { const [x, y] = toWorld(e.clientX, e.clientY); hover = [x, y];
  if (!grab && !drawing) return;
  if (grab && grab.i >= 0 && st.mode === 'ripple') { st.rip.src[grab.i] = [x, y]; dirty = true; share.touch(); }
  else if (grab && grab.tank) tankPointer(e); else if (grab && grab.str) strPointer(e);
  else if (drawing) drawing.push(epiPt(e)); });
wo.addEventListener('pointerup', () => { grab = null; if (drawing) { if (drawing.length > 12) { st.epi.own = resample(drawing, 512); st.epi.curve = 'own'; markCurves(); epiSetup(); epiReset(); labels(); share.touch(); } drawing = null; } });
wo.addEventListener('pointerleave', () => { hover = null; });
let hover = null;
function epiPt(e) { const r = wo.getBoundingClientRect(), S = Math.min(r.width, r.height) * 0.4; return [(e.clientX - r.left - r.width / 2) / S, -(e.clientY - r.top - r.height / 2) / S]; }
function tankPointer(e) { if (!TK) return; const r = wo.getBoundingClientRect(), gx = (e.clientX - r.left) / r.width * TK.W, gy = (1 - (e.clientY - r.top) / r.height) * TK.H;
  if (st.tank.draw === 'splash') TK.splash = [gx, gy, 1.6]; else TK.paint = [gx, gy, 3.5, st.tank.draw === 'wall' ? 1 : 2]; }
function strPointer(e) { const r = wo.getBoundingClientRect(), x = ((e.clientX - r.left) - r.width * 0.08) / (r.width * 0.84); setRange('pluck', clamp(Math.round((x > 0.5 ? 1 - x : x) * 100) / 100, 0.03, 0.5)); strT = 0; }

// ---------- panel ----------
segClick('modeList', d => pickMode(d.m));
function pickMode(m) {
  st.mode = m; MO.group.querySelector('.sec').querySelectorAll('.row').forEach(e => { e.hidden = m !== 'ripple'; }); $('mvWander').closest('label').hidden = m !== 'ripple'; document.querySelectorAll('#modeList button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  for (const k of ['ripple', 'tank', 'plate', 'string', 'epi']) $('c-' + k).hidden = k !== m;
  for (const k of ['plate', 'epi']) $('s-' + k).hidden = k !== m;
  $('bgSec').hidden = m === 'ripple';   /* ripples fill the screen: no background to see */
  const gl = m === 'ripple' || m === 'tank'; wc.hidden = !gl; $('g-view').hidden = !gl;
  if (m === 'tank') tankSetup(); if (m === 'plate') { plateSetup(); freshSand(); } if (m === 'epi') { epiSetup(); epiReset(); } if (m === 'string') strT = 0;
  $('hint').textContent = { ripple: 'Drag the white dots · click to move the nearest one there · arrows or W A S D move round the pond', tank: 'Click or drag in the water', plate: 'G: fresh sand · N: another pattern', string: 'Drag along the string to pluck it there', epi: 'Draw a closed line on the picture to make your own' }[m];
  $('goBtn').textContent = { ripple: 'Pause the waves', tank: 'Start again', plate: 'Fresh sand', string: 'Pluck again', epi: 'Draw again' }[m];
  labels(); dirty = true; share.touch();
}
function labels() {
  const [t, sub, about] = INFO[st.mode]; let title = t;
  if (st.mode === 'plate') title = `${t}: ${modeName(st.plate.shape, st.plate.i)}`; if (st.mode === 'epi') title = `${t}: ${st.epi.curve === 'own' ? 'your drawing' : CURVES[st.epi.curve][0]}`;
  $('title').textContent = title; $('subtitle').textContent = sub; $('about').innerHTML = `<strong>${t}.</strong> ${about}`; $('gv-shapes').textContent = t;
  $('gv-ctl').textContent = st.mode === 'ripple' ? st.rip.src.length + ' sources' : st.mode === 'tank' ? $('tankPre').querySelector('.on')?.textContent || '' : st.mode === 'plate' ? st.plate.shape : st.mode === 'string' ? Math.round(st.str.pluck * 100) + '%' : st.epi.n + ' circles';
  const gl = st.mode === 'ripple' || st.mode === 'tank';
  $('lgL').textContent = gl ? (st.show === 'loud' ? 'still' : 'trough') : st.mode === 'plate' ? 'down' : ''; $('lgR').textContent = gl ? (st.show === 'loud' ? 'loud' : 'crest') : st.mode === 'plate' ? 'up' : '';
  $('legend').style.display = gl || (st.mode === 'plate' && st.plate.showPlate) ? '' : 'none'; $('lgBar').style.background = rampCss(R);
  $('showNote').textContent = st.show === 'loud' ? 'How big the swing is at each spot, averaged over time: dark bands are where the waves always cancel.' : 'The water as it is right now.';
  $('machRow').hidden = st.tank.pre !== 'doppler';
  $('prAbout').textContent = { ripple: 'Prints the picture as a landscape: high where the wave is high (or loud).', tank: 'Prints the water as a landscape, walls included.', plate: 'Prints the sand pattern: the still lines stand up from the plate, like a Chladni coaster.', string: 'Prints the string\'s shape right now as a raised line on a plaque.', epi: 'Prints the drawing the circles make as a raised line on a plaque.' }[st.mode];
  pmodeLabel();
}
const modeCount = sh => (isShaped(sh) ? 14 : sh === 'square' ? SQUARE_MODES : ROUND_MODES).length || 14;
const pmodeLabel = () => { $('pmode').max = modeCount(st.plate.shape) - 1; $('pmodeo').textContent = st.plate.i + 1; };
function stats() {
  let note = '';
  if (st.mode === 'ripple') { const S = st.rip.src; let pd = '–';
    if (hover && S.length >= 2) { const d = (Math.hypot(hover[0] - S[0][0], hover[1] - S[0][1]) - Math.hypot(hover[0] - S[1][0], hover[1] - S[1][1])) / st.rip.wlen; pd = Math.abs(d).toFixed(2); const f = Math.abs(d) % 1; note = f < 0.15 || f > 0.85 ? 'Under the pointer the first two sources arrive in step: their waves add up.' : Math.abs(f - 0.5) < 0.15 ? 'Under the pointer the waves arrive half a wave apart: they cancel.' : 'Partly in step under the pointer.'; }
    else note = 'Point at the picture: a whole number of waves\' difference means they add up; a half means they cancel.';
    setStats([String(S.length), 'sources'], [st.rip.wlen.toFixed(2), 'wavelength'], [pd, 'waves\' difference (first two)']); }
  else if (st.mode === 'tank') { if (!TK) { setStats(['–', ''], ['–', ''], ['–', '']); note = 'This needs a graphics card that can draw into float textures.'; }
    else { setStats([(TK.t / 60).toFixed(1) + ' s', 'water time'], [String(st.tank.wlen), 'wavelength (cells)'], st.tank.pre === 'doppler' ? [st.tank.mach.toFixed(2) + '×', 'source / wave speed'] : [TK.W + '×' + TK.H, 'cells']);
      note = st.tank.pre === 'doppler' ? (st.tank.mach > 1 ? 'Faster than its own waves: they pile up into a V, a shock wave (a sonic boom).' : 'Waves bunch up ahead of the source and spread out behind: a higher pitch coming, lower going.') : st.tank.pre === 'lens' ? 'The waves slow down in the lens, so they bend and come together beyond it: a focus.' : ''; } }
  else if (st.mode === 'plate') { let still = 0; const n = sand.length / 2; for (let i = 0; i < n; i += 7) if (Math.abs(ampAt(sand[i * 2], sand[i * 2 + 1])) < 0.12) still++;
    setStats([modeName(st.plate.shape, st.plate.i), 'pattern'], [PL.pitch.toFixed(2) + '×', 'pitch (vs. lowest)'], [Math.round(still / Math.ceil(n / 7) * 100) + '%', 'sand settled']);
    note = isShaped(st.plate.shape) ? PLATE_INFO[st.plate.shape] : st.plate.shape === 'round' ? 'Round plate: the numbers are the straight still lines through the middle and the still rings.' : 'Square plate: each pattern is two simple waves added, one along and one across.'; }
  else if (st.mode === 'string') { const S = st.str, a = []; for (let n = 1; n <= S.harm; n++) a.push(Math.abs(coef(n, S.pluck))); const mx = Math.max(...a), miss = a.map((v, i) => (Math.abs(Math.sin((i + 1) * Math.PI * S.pluck)) < 0.02 ? i + 1 : 0)).filter(Boolean);   // truly silent: a still point right at the pluck
    setStats([String(a.indexOf(mx) + 1), 'loudest harmonic'], [String(a.length - miss.length), 'harmonics sounding'], [miss.length ? miss.slice(0, 4).join(', ') + (miss.length > 4 ? '…' : '') : 'none', 'missing']);
    note = miss.length ? `Plucking at ${Math.round(S.pluck * 100)}% puts a still point of these harmonics right where you pluck, so they can't sound.` : 'Every harmonic sounds a little.'; }
  else { const tot = EP.C.reduce((s, c) => s + c.r * c.r, 0) || 1, n = Math.min(st.epi.n, EP.C.length), got = EP.C.slice(0, n).reduce((s, c) => s + c.r * c.r, 0);
    setStats([String(n), 'circles'], [(got / tot * 100).toFixed(got / tot > 0.999 ? 2 : 1) + '%', 'of the shape captured'], [EP.C.length ? (EP.C[0].f === 0 && EP.C[1] ? EP.C[1] : EP.C[0]).f + '×' : '–', 'biggest circle\'s turns per lap']);
    note = 'The circles are sorted biggest first: each one added fixes a smaller detail.'; }
  $('statNote').textContent = note;
}
segClick('ripPre', d => { ripPreset(d.p); dirty = true; labels(); share.touch(); });
function ripPreset(p) { st.rip.pre = p; st.rip.src = { two: [[-0.25, 0], [0.25, 0]], three: [[-0.4, 0], [0, 0], [0.4, 0]], one: [[0, 0]], ring: Array.from({ length: 8 }, (_, i) => [0.82 * Math.cos(i * Math.PI / 4), 0.82 * Math.sin(i * Math.PI / 4)]) }[p] || [[0, 0]]; }
$('wlen').addEventListener('input', e => { st.rip.wlen = +e.target.value; $('wleno').textContent = st.rip.wlen.toFixed(2); dirty = true; share.touch(); });
$('fade').addEventListener('input', e => { st.rip.fade = +e.target.value; $('fadeo').textContent = st.rip.fade.toFixed(1); dirty = true; share.touch(); });
$('addSrc').addEventListener('click', () => { if (st.rip.src.length < 8) st.rip.src.push([Math.random() - 0.5, Math.random() - 0.5]); labels(); dirty = true; share.touch(); });
$('delSrc').addEventListener('click', () => { if (st.rip.src.length > 1) st.rip.src.pop(); labels(); dirty = true; share.touch(); });
segClick('tankPre', d => { st.tank.pre = d.p; if (st.mode === 'tank') tankSetup(); labels(); share.touch(); });
$('twlen').addEventListener('input', e => { st.tank.wlen = +e.target.value; $('twleno').textContent = st.tank.wlen; share.touch(); });
$('mach').addEventListener('input', e => { st.tank.mach = +e.target.value; $('macho').textContent = st.tank.mach.toFixed(2) + '× wave'; share.touch(); });
segClick('tankDraw', d => { st.tank.draw = d.d; });
$('calm').addEventListener('click', () => { if (TK) tankSetup(true); });
$('clearWalls').addEventListener('click', () => { if (TK) medPass(0, null); });
segClick('plateShape', d => { st.plate.shape = d.s; st.plate.i = Math.min(st.plate.i, modeCount(d.s) - 1); $('pmode').value = st.plate.i; plateSetup(); freshSand(); labels(); share.touch(); });
$('pmode').addEventListener('input', e => { st.plate.i = +e.target.value; plateSetup(); labels(); share.touch(); });
$('grains').addEventListener('input', e => { st.plate.grains = +e.target.value; $('grainso').textContent = Math.round(st.plate.grains / 1000) + 'k'; freshSand(); share.touch(); });
$('shake').addEventListener('input', e => { st.plate.shake = +e.target.value; $('shakeo').textContent = st.plate.shake.toFixed(1) + '×'; share.touch(); });
$('showPlate').addEventListener('change', e => { st.plate.showPlate = e.target.checked; if (PL) PL.img = null; labels(); share.touch(); });
$('beatMode').addEventListener('change', e => { st.plate.beatMode = e.target.checked; share.touch(); });
$('newSand').addEventListener('click', () => freshSand());
$('pluck').addEventListener('input', e => { st.str.pluck = +e.target.value; $('plucko').textContent = Math.round(st.str.pluck * 100) + '%'; labels(); share.touch(); });
$('harm').addEventListener('input', e => { st.str.harm = +e.target.value; $('harmo').textContent = st.str.harm; share.touch(); });
$('damp').addEventListener('input', e => { st.str.damp = +e.target.value; $('dampo').textContent = st.str.damp.toFixed(1); share.touch(); });
$('showParts').addEventListener('change', e => { st.str.parts = e.target.checked; share.touch(); });
$('curveList').innerHTML = Object.entries(CURVES).map(([k, [n]]) => `<button data-c="${k}">${n}</button>`).join('') + '<button data-c="own" id="ownBtn" hidden>Yours</button>';
const markCurves = () => { $('ownBtn').hidden = !st.epi.own; document.querySelectorAll('#curveList button').forEach(b => b.classList.toggle('on', b.dataset.c === st.epi.curve)); };
segClick('curveList', d => { st.epi.curve = d.c; markCurves(); epiSetup(); epiReset(); labels(); share.touch(); });
$('ncirc').addEventListener('input', e => { st.epi.n = +e.target.value; $('ncirco').textContent = st.epi.n; EP.cache = []; labels(); share.touch(); });
$('showCirc').addEventListener('change', e => { st.epi.circ = e.target.checked; share.touch(); });
$('showTarget').addEventListener('change', e => { st.epi.target = e.target.checked; share.touch(); });
$('goBtn').addEventListener('click', () => go());
$('speed').addEventListener('input', e => { st.speed = +e.target.value; $('speedo').textContent = st.speed.toFixed(1) + '×'; share.touch(); });
segClick('show', d => { st.show = d.v; labels(); dirty = true; share.touch(); });
$('relief').addEventListener('change', e => { st.relief = e.target.checked; dirty = true; share.touch(); });
let R = rampOf('ocean', false);
const recolour = () => { R = rampOf(st.palette, st.palRev); if (PL) PL.img = null; palLabel(); labels(); dirty = true; };
buildSwatches($('palettes'), st.palette, name => { st.palette = name; recolour(); share.touch(); });
const palLabel = () => { $('palName').textContent = 'Palette: ' + st.palette.replace('_', ' & ').replace(/^./, c => c.toUpperCase()) + (st.palRev ? ' (reversed)' : ''); };
$('palRev').addEventListener('change', e => { st.palRev = e.target.checked; recolour(); share.touch(); });
$('cyc').addEventListener('input', e => { st.cycleSpeed = +e.target.value; $('cyco').textContent = st.cycleSpeed ? st.cycleSpeed.toFixed(1) + '×' : 'off'; share.touch(); });
segClick('bg', d => { st.bg = d.b; if (PL) PL.img = null; dirty = true; share.touch(); });
segClick('prSize', d => { st.mm = +d.mm; });
$('prHigh').addEventListener('input', e => { st.high = +e.target.value; $('prHigho').textContent = st.high + ' mm'; });
const fileBase = () => 'waves_' + st.mode + (st.mode === 'plate' ? '_' + st.plate.shape + (st.plate.i + 1) : st.mode === 'epi' ? '_' + st.epi.curve : '');
$('snap').addEventListener('click', () => { const gl = st.mode === 'ripple' || st.mode === 'tank';
  if (!gl) return saveCanvasPNG(wo, fileBase() + '.png', $('dlnote'), st.bg);
  render(); const c = document.createElement('canvas'); c.width = wc.width; c.height = wc.height; const x = c.getContext('2d'); x.drawImage(wc, 0, 0); x.drawImage(wo, 0, 0, c.width, c.height); saveCanvasPNG(c, fileBase() + '.png', $('dlnote')); });
document.querySelectorAll('.btn.try').forEach(b => b.addEventListener('click', () => { const [m, a, c] = b.dataset.try.split('|'); st.paused = false;
  if (m === 'ripple') { pickMode('ripple'); clickData('#ripPre', 'p', a); clickData('#show', 'v', c === 'loud' ? 'loud' : 'wave'); }
  else if (m === 'tank') { if (c) setRange('mach', +c); clickData('#tankPre', 'p', a); pickMode('tank'); }
  else if (m === 'plate') { clickData('#plateShape', 's', a); pickMode('plate'); }
  else if (m === 'string') { setRange('pluck', +a); pickMode('string'); }
  else if (m === 'epi') { setRange('ncirc', +c); clickData('#curveList', 'c', a); pickMode('epi'); } }));
buildKeys($('keyTable'), [['G', 'Ripples: pause the waves · tank: start again · plate: fresh sand · string: pluck · epicycles: draw again'], ['N', 'Something new: move the sources, splash, a random pattern or pluck'], ['1 – 5', 'Ripples, wave tank, plate, string, epicycles'], ['+ / −', 'Ripples: longer / shorter waves · epicycles: more / fewer circles'], ['← → ↑ ↓ / W A S D', 'Ripples: move round the pond']]);

// ---------- actions ----------
let ripRun = true;
function go() { st.paused = false; const m = st.mode;
  if (m === 'ripple') { ripRun = !ripRun; $('goBtn').textContent = ripRun ? 'Pause the waves' : 'Start the waves'; }
  else if (m === 'tank') tankSetup(true); else if (m === 'plate') freshSand(); else if (m === 'string') strT = 0; else epiReset(); }
function renew() { st.paused = false; const m = st.mode;
  if (m === 'ripple') { st.rip.src = st.rip.src.map(() => [(Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4]); dirty = true; }
  else if (m === 'tank' && TK) TK.splash = [TK.W * (0.2 + 0.6 * Math.random()), TK.H * (0.2 + 0.6 * Math.random()), 2];
  else if (m === 'plate') setRange('pmode', Math.floor(Math.random() * (+$('pmode').max + 1)));
  else if (m === 'string') { setRange('pluck', Math.round((0.04 + Math.random() * 0.46) * 100) / 100); strT = 0; }
  else { const ks = Object.keys(CURVES); clickData('#curveList', 'c', ks[(ks.indexOf(st.epi.curve) + 1) % ks.length]); }
  share.touch(); }
function resetView() { st.paused = false; const m = st.mode; if (m === 'ripple') { pan[0] = pan[1] = 0; wz = 1; wa = 0; MO.resetView(); ripPreset(st.rip.pre); } else if (m === 'tank') tankSetup(); else if (m === 'plate') freshSand(); else if (m === 'string') strT = 0; else { epiSetup(); epiReset(); } dirty = true; share.touch(); }

// ---------- loop ----------
const beats = new BeatGate(); let beatCount = 0;
// the drawn modes (plate, string, epicycles): the beat's pulse swells the picture a little (the string: its swing), vocals
// turn it gently (the string: they stretch its swing), and the flash adds a faint glow over everything, as in Fractals
function beatDraw(r, turn, stretch, draw) {
  const vo = voice(), cx = r.width / 2, cy = r.height / 2, k = 1 + 0.04 * pulseNow;
  og.save(); og.fillStyle = st.bg; og.fillRect(0, 0, r.width, r.height); og.translate(cx, cy); og.rotate(turn * vo);
  if (stretch) og.scale(1, 1 + 0.35 * pulseNow + 0.12 * vo); else og.scale(k, k); og.translate(-cx, -cy); draw(); og.restore();
  if (flashNow) { og.fillStyle = `rgba(255,255,255,${(0.05 * flashNow).toFixed(3)})`; og.fillRect(0, 0, r.width, r.height); } }
let running = false, tPrev = 0, frame = 0, dirty = true, ripT = 0, flashNow = 0, pulseNow = 0;
function render() {
  if (st.mode === 'ripple') { G.fit(Math.min(devicePixelRatio, 1.5)); const p = P.rip, U = k => p.u(k), pu = rampUniform(R); g.useProgram(p.p);
    const src = new Float32Array(16); st.rip.src.slice(0, 8).forEach((s, i) => { src[i * 2] = s[0]; src[i * 2 + 1] = s[1]; });
    g.uniform2f(U('u_res'), wc.width, wc.height); g.uniform2fv(U('u_src'), src); g.uniform2f(U('u_pan'), pan[0], pan[1]); g.uniform2f(U('u_ang'), Math.cos(wa), Math.sin(wa)); g.uniform1f(U('u_zs'), wz); g.uniform1i(U('u_n'), Math.min(8, st.rip.src.length)); g.uniform1i(U('u_show'), st.show === 'loud' ? 1 : 0); g.uniform1i(U('u_relief'), st.relief ? 1 : 0);
    g.uniform1f(U('u_k'), 2 * Math.PI / (st.rip.wlen * (1 + 0.04 * voice()))); g.uniform1f(U('u_t'), ripT); g.uniform1f(U('u_fade'), st.rip.fade); g.uniform1f(U('u_cycle'), st.cycle); g.uniform1f(U('u_flash'), flashNow); g.uniform1f(U('u_amp'), 1 + 0.5 * pulseNow);
    g.uniform3f(U('u_bg'), ...hexRGB(st.bg)); g.uniform3fv(U('u_pal'), pu.data); g.uniform1i(U('u_npal'), pu.n); G.draw(null, wc.width, wc.height); }
  else if (st.mode === 'tank' && TK) { G.fit(Math.min(devicePixelRatio, 1.5)); const p = P.tank, U = k => p.u(k), pu = rampUniform(R); g.useProgram(p.p);
    G.bindTex(p, 'u_s', TK.S.a.t, 0); G.bindTex(p, 'u_m', TK.M.a.t, 1); g.uniform2f(U('u_res'), wc.width, wc.height); g.uniform2f(U('u_px'), 1 / TK.W, 1 / TK.H);
    g.uniform1i(U('u_show'), st.show === 'loud' ? 1 : 0); g.uniform1i(U('u_relief'), st.relief ? 1 : 0); g.uniform1f(U('u_cycle'), st.cycle); g.uniform1f(U('u_flash'), flashNow);
    g.uniform1f(U('u_gain'), 1 + 0.6 * pulseNow + 0.12 * voice());   /* the beat swells the waves; vocals a little */
    g.uniform3f(U('u_bg'), ...hexRGB(st.bg)); g.uniform3fv(U('u_pal'), pu.data); g.uniform1i(U('u_npal'), pu.n); G.draw(null, wc.width, wc.height); }
}
function loop(now) {
  if (!running) return; const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now; frame++;
  setPausedTag(st.paused); const go = !st.paused, m = st.mode, sp = st.speed * energyMul();
  flashNow = flash(); pulseNow = pulse(); const beat = beats.crossed(); if (beat) beatCount++;
  const cs = go ? colourStep(dt) : 0; if ((go && st.cycleSpeed > 0) || cs) { st.cycle = (st.cycle + (go ? dt * st.cycleSpeed * 0.06 : 0) + cs) % 1; if (PL && frame % 6 === 0) PL.img = null; }
  const r = fitOverlay();
  if (MO.step(dt, go) && m === 'ripple' && frame % 20 === 0) share.touch();
  if (m === 'ripple') { const k = drive(); if (k.any) { const cl = x => Math.max(-1, Math.min(1, x)), v = (k.fast ? 3 : 1) * k.scale * dt; pan[0] = clamp(pan[0] + cl(k.slideX + k.turnX) * v, -6, 6); pan[1] = clamp(pan[1] + cl(k.slideY + k.rawY) * v, -6, 6); }
    if (go && ripRun) ripT += dt * 4 * sp; render(); og.clearRect(0, 0, r.width, r.height);
    const ca = Math.cos(wa), sa = Math.sin(wa); for (const s of st.rip.src) { const ax = (s[0] - pan[0]) / wz, ay = (s[1] - pan[1]) / wz, x = r.width / 2 + (ca * ax + sa * ay) * r.height / 2, y = r.height / 2 - (-sa * ax + ca * ay) * r.height / 2; og.fillStyle = '#fff'; og.strokeStyle = 'rgba(0,0,0,.6)'; og.lineWidth = 2; og.beginPath(); og.arc(x, y, 5, 0, 2 * Math.PI); og.fill(); og.stroke(); } }
  else if (m === 'tank') { og.clearRect(0, 0, r.width, r.height);
    if (TK) { if (beat && st.tank.pre === 'splash') TK.splash = [TK.W * (0.15 + 0.7 * Math.random()), TK.H * (0.15 + 0.7 * Math.random()), 1.4];
      if (go) tankStep(Math.max(1, Math.round(4 * sp))); else if (TK.paint) { medPass(-1, TK.paint); TK.paint = null; } render(); }
    else { og.fillStyle = '#ccc'; og.font = '14px system-ui, sans-serif'; og.fillText('The wave tank needs a graphics card that can draw into float textures.', 20, r.height / 2); } }
  else if (m === 'plate') { if (go) { if (st.plate.beatMode && beat && beatCount % 8 === 0) setRange('pmode', (st.plate.i + 1) % (+$('pmode').max + 1)); sandStep(dt, st.plate.shake * sp * (1 + 0.6 * pulseNow)); } beatDraw(r, 0.025, 0, () => drawPlate(r)); }
  else if (m === 'string') { if (go) strT += dt * st.speed * energyMul(); if (beat && reacting() && beatCount % 4 === 0) strT = 0; beatDraw(r, 0, 1, () => drawString(r)); }
  else { if (go && !drawing) { EP.t += dt * 0.12 * sp; if (EP.t >= 1) { EP.t -= 1; EP.laps = (EP.laps || 0) + 1; } } beatDraw(r, 0.04, 0, () => drawEpi(r, dt)); }
  if (frame % 12 === 0) stats();
  if (frame % 30 === 0) share.touch();
  requestAnimationFrame(loop);
}

// ---------- 3D print ----------
function curveRelief(draw) { const W = 400, H = 400, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.strokeStyle = '#fff'; x.lineCap = x.lineJoin = 'round'; draw(x, W, H);
  const px = x.getImageData(0, 0, W, H).data, A = new Float32Array(W * H); for (let i = 0; i < W * H; i++) A[i] = px[i * 4] / 255; return { A, W, H }; }
$('prBtn').addEventListener('click', () => {
  const m = st.mode; let F;
  if (m === 'ripple') { const r = wc.getBoundingClientRect(), W = 240, H = Math.round(240 * r.height / r.width), A = new Float32Array(W * H), k = 2 * Math.PI / st.rip.wlen, S = st.rip.src;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = (i - W / 2) / (H / 2), y = (H / 2 - j) / (H / 2); let h = 0, re = 0, im = 0;
      for (const s of S) { const d = Math.hypot(x - s[0], y - s[1]), a = Math.pow(1 + d * 8, -0.5 * st.rip.fade); h += Math.cos(k * d - ripT) * a; re += a * Math.cos(k * d); im += a * Math.sin(k * d); }
      A[j * W + i] = st.show === 'loud' ? Math.min(1, Math.hypot(re, im) / S.length * 1.15) : clamp(0.5 + 0.5 * h / Math.max(1, Math.sqrt(S.length)), 0, 1); }
    F = { A, W, H }; }
  else if (m === 'tank') { if (!TK) return; const { W, H } = TK, buf = new Float32Array(W * H * 4); g.bindFramebuffer(g.FRAMEBUFFER, TK.S.a.fb); g.readPixels(0, 0, W, H, g.RGBA, g.FLOAT, buf); g.bindFramebuffer(g.FRAMEBUFFER, null);
    const mb = new Uint8Array(W * H * 4); g.bindFramebuffer(g.FRAMEBUFFER, TK.M.a.fb); g.readPixels(0, 0, W, H, g.RGBA, g.UNSIGNED_BYTE, mb); g.bindFramebuffer(g.FRAMEBUFFER, null);
    const A = new Float32Array(W * H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const o = ((H - 1 - j) * W + i); A[j * W + i] = mb[o * 4] > 127 ? 1 : st.show === 'loud' ? Math.min(1, Math.sqrt(buf[o * 4 + 2]) * 2.2) * 0.85 : (0.5 + 0.5 * Math.tanh(buf[o * 4] * 2.5)) * 0.85; }
    F = { A, W, H }; }
  else if (m === 'plate') { const N = PL.N, A = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = PL.A[(N - 1 - j) * N + i]; A[j * N + i] = isNaN(a) ? 0 : 0.25 + 0.75 * Math.max(0, 1 - Math.abs(a) * 6); } F = { A, W: N, H: N }; }
  else if (m === 'string') F = curveRelief((x, W, H) => { const S = st.str; x.lineWidth = 9; x.beginPath(); for (let i = 0; i <= 200; i++) { const t = i / 200; let s = 0; for (let n = 1; n <= S.harm; n++) s += coef(n, S.pluck) * Math.sin(n * Math.PI * t) * Math.cos(n * 2 * Math.PI * 0.9 * strT) * Math.exp(-S.damp * strT * (0.3 + 0.12 * n));
    const X = 20 + t * (W - 40), Y = H / 2 - s * H * 0.3; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); });
  else F = curveRelief((x, W, H) => { const n = Math.min(st.epi.n, EP.C.length); x.lineWidth = 8; x.beginPath(); for (let i = 0; i <= 600; i++) { const t = i / 600; let a = 0, b = 0; for (let k = 0; k < n; k++) { const c = EP.C[k], q = 2 * Math.PI * c.f * t + c.ph; a += c.r * Math.cos(q); b += c.r * Math.sin(q); }
    const X = W / 2 + a * W * 0.42, Y = H / 2 - b * H * 0.42; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); });
  const T3 = heightfieldTriangles(F.A, F.W, F.H, st.mm, 2, st.high), res = stlFromTriangles(T3, st.mm, 'Math Explorer waves');
  saveFile(fileBase() + `_${st.mm}mm.stl`, res.bytes, $('prNote')).then(ok => { if (ok) $('prNote').textContent += ` ${res.size.map(v => Math.round(v)).join(' × ')} mm.`; });
});

// ---------- keys, sharing, lifecycle ----------
export function onKey(e) {
  return standardKeys(e, {
    pause: () => { st.paused = !st.paused; }, go, renew, reset: resetView,
    shape: dir => { const sel = { ripple: '#ripPre button', tank: '#tankPre button', plate: null, string: null, epi: '#curveList button:not([hidden])' }[st.mode];
      if (sel) clickNext(sel, dir); else if (st.mode === 'plate') setRange('pmode', (st.plate.i + dir + (+$('pmode').max + 1)) % (+$('pmode').max + 1)); else setRange('pluck', clamp(st.str.pluck + dir * 0.03, 0.03, 0.5)); },
    palette: dir => clickNext('#palettes button', dir), colourMode: () => { if (st.mode === 'ripple' || st.mode === 'tank') clickData('#show', 'v', st.show === 'wave' ? 'loud' : 'wave'); },
    reverse: () => $('palRev').click(), cycle: () => setRange('cyc', st.cycleSpeed > 0 ? 0 : 1),
    zoom: f => { if (st.mode === 'ripple') setRange('wlen', clamp(st.rip.wlen * f, 0.04, 0.5)); else if (st.mode === 'epi') setRange('ncirc', clamp(Math.round(st.epi.n / f + (f < 1 ? 1 : -1)), 1, 200)); },
    mode: i => { const b = document.querySelectorAll('#modeList button')[i]; if (b) b.click(); },
  });
}
const encode = () => { const p = new URLSearchParams(), m = st.mode; p.set('m', m);
  if (m === 'ripple') { p.set('src', st.rip.src.map(s => s.map(r4).join('_')).join('~')); p.set('wl', st.rip.wlen); p.set('fd', st.rip.fade); if (pan[0] || pan[1]) p.set('pn', pan.map(r4).join('_')); if (wz !== 1) p.set('wz', r4(wz)); if (wa) p.set('wa', r4(wa)); }
  if (m === 'tank') { p.set('pre', st.tank.pre); p.set('wl', st.tank.wlen); if (st.tank.pre === 'doppler') p.set('mach', st.tank.mach); }
  if (m === 'ripple' || m === 'tank') { if (st.show !== 'wave') p.set('sh', st.show); if (!st.relief) p.set('rl', 0); }
  if (m === 'plate') { p.set('ps', st.plate.shape); p.set('pi', st.plate.i); p.set('gr', st.plate.grains); if (st.plate.shake !== 1) p.set('sk', st.plate.shake); if (!st.plate.showPlate) p.set('sp', 0); if (st.plate.beatMode) p.set('bm', 1); }
  if (m === 'string') { p.set('pl', st.str.pluck); p.set('hm', st.str.harm); p.set('dp', st.str.damp); if (!st.str.parts) p.set('pt', 0); }
  if (m === 'epi') { p.set('c', st.epi.curve); p.set('n', st.epi.n); if (!st.epi.circ) p.set('ci', 0); if (st.epi.target) p.set('tg', 1);
    if (st.epi.curve === 'own' && st.epi.own) p.set('own', st.epi.own.filter((_, i) => i % 4 === 0).map(q => q.map(v => Math.round(v * 500)).join('_')).join('~')); }
  if (st.speed !== 1) p.set('spd', st.speed); p.set('pal', st.palette); if (st.palRev) p.set('rev', 1); if (st.cycleSpeed) p.set('cyc', st.cycleSpeed); if (st.bg !== '#0b0d12') p.set('bg', st.bg.slice(1));
  MO.encode(p);
  return p.toString(); };
function apply(code) {
  const p = new URLSearchParams(code), m = p.get('m'); if (!INFO[m]) return false;
  clickData('#palettes', 'pal', p.get('pal') || 'ocean'); setCheck('palRev', p.get('rev') === '1'); setRange('cyc', num(p, 'cyc', 0)); clickData('#bg', 'b', '#' + (p.get('bg') || '0b0d12')); setRange('speed', num(p, 'spd', 1));
  clickData('#show', 'v', p.get('sh') === 'loud' ? 'loud' : 'wave'); setCheck('relief', p.get('rl') !== '0');
  if (m === 'ripple') { const s = (p.get('src') || '').split('~').map(q => q.split('_').map(Number)).filter(q => q.length === 2 && q.every(isFinite)).slice(0, 8); if (s.length) st.rip.src = s; else ripPreset('two');
    setRange('wlen', num(p, 'wl', 0.14)); setRange('fade', num(p, 'fd', 0.6));
    const pn = (p.get('pn') || '').split('_').map(Number); if (pn.length === 2 && pn.every(isFinite)) { pan[0] = clamp(pn[0], -6, 6); pan[1] = clamp(pn[1], -6, 6); } wz = clamp(num(p, 'wz', 1), 0.3, 4); wa = num(p, 'wa', 0); }
  if (m === 'tank') { setRange('twlen', num(p, 'wl', 22)); setRange('mach', num(p, 'mach', 0.6)); const pre = p.get('pre'); document.querySelectorAll('#tankPre button').forEach(b => b.classList.toggle('on', b.dataset.p === pre)); if (PRE_ID[pre] != null) st.tank.pre = pre; }
  if (m === 'plate') { clickData('#plateShape', 's', ['round', 'guitar', 'triangle', 'stadium', 'rectangle'].includes(p.get('ps')) ? p.get('ps') : 'square'); setRange('pmode', num(p, 'pi', 4)); setRange('grains', num(p, 'gr', 16000)); setRange('shake', num(p, 'sk', 1)); setCheck('showPlate', p.get('sp') !== '0'); setCheck('beatMode', p.get('bm') === '1'); }
  if (m === 'string') { setRange('pluck', num(p, 'pl', 0.2)); setRange('harm', num(p, 'hm', 12)); setRange('damp', num(p, 'dp', 0.5)); setCheck('showParts', p.get('pt') !== '0'); }
  if (m === 'epi') { const own = (p.get('own') || '').split('~').map(q => q.split('_').map(v => +v / 500)).filter(q => q.length === 2 && q.every(isFinite));
    if (own.length > 8) st.epi.own = resample(own, 512); const c = p.get('c'); st.epi.curve = c === 'own' && st.epi.own ? 'own' : CURVES[c] ? c : 'heart'; markCurves();
    setRange('ncirc', num(p, 'n', 40)); setCheck('showCirc', p.get('ci') !== '0'); setCheck('showTarget', p.get('tg') === '1'); }
  pickMode(m); MO.decode(p); return true;
}
const share = makeShare('wave', encode, apply);
MO.onChange = () => share.touch();
progs(); ripPreset('two'); markCurves(); clickData('#tankPre', 'p', 'double'); palLabel();
if (!apply(parseRoute().code)) pickMode('ripple');
export function start() { running = true; tPrev = performance.now(); if (st.mode === 'tank') tankSetup(true); dirty = true; requestAnimationFrame(loop); share.write(); }
export function stop() { running = false; REC.stop(); }
export const reset = resetView;
export const layoutChanged = () => { if (st.mode === 'tank') tankSetup(true); dirty = true; };
export const showView = code => apply(code);
export const soundHelp = 'Here, each beat flashes the picture (or, with Pulse, swells it: the waves rise, the sand jumps, the string swings wider and the epicycles grow). Energy sets the pace and how hard the plate shakes, vocals stretch the ripples and gently turn or stretch the drawn modes, and colour drifts the palette. Beats also drop rain into the tank (Splashes), re-pluck the string every bar, and can change the plate\'s pattern; under Motion, drifting round the pond keeps time.';
