// Growing Patterns explorer: Life-like cellular automata, Lenia (smooth life) and Gray–Scott reaction–diffusion, each
// stepped on the graphics card by drawing the next state from the last one. Importing this module boots the explorer.
import { $, clamp, segClick, clickNext, setRange, setCheck, clickData, setStats, buildSwatches, rampCss, num, standardKeys, buildKeys, makeShare } from '../../js/common/kit.js';
import { rampOf, rampUniform, hexRGB, PAL_GLSL } from '../../js/common/palettes.js';
import { makeGL, noWebGL } from '../../js/common/gl.js';
import { saveCanvasPNG, saveFile } from '../../js/common/save.js';
import { stlFromTriangles, heightfieldTriangles } from '../../js/common/stl.js';
import { flashFx as flash, pulseFx as pulse, voiceFx as voice, colourStep, energyMul, BeatGate } from '../../js/shell/audio/react.js';
import { setPausedTag, drive } from '../../js/shell/keys.js';
import { parseRoute } from '../../js/shell/route.js';
import { makeMotion2D, addRecorder } from '../../js/common/motion.js';
import { makeVisualizer, pickButton, randomSlider } from '../../js/common/visualizer.js';

// ---------- rules and recipes ----------
const RULES = { conway: ['Conway\'s Life', 'B3/S23'], highlife: ['HighLife', 'B36/S23'], daynight: ['Day & Night', 'B3678/S34678'], seeds: ['Seeds', 'B2/S'], maze: ['Maze', 'B3/S12345'],
  coral: ['Coral', 'B3/S45678'], replicator: ['Replicator', 'B1357/S1357'], diamoeba: ['Diamoeba', 'B35678/S5678'], twobytwo: ['2×2', 'B36/S125'], morley: ['Move', 'B368/S245'],
  anneal: ['Anneal', 'B4678/S35678'], nodeath: ['Life without death', 'B3/S012345678'], gnarl: ['Gnarl', 'B1/S1'], serviettes: ['Serviettes', 'B234/S'], amoeba: ['Amoeba', 'B357/S1358'],
  walled: ['Walled cities', 'B45678/S2345'], longlife: ['Long life', 'B345/S5'], brain: ['Brian\'s Brain', 'brain'], wire: ['Wireworld', 'wire'], bosco: ['Bosco\'s rule', 'bosco'] };
const RTYPE = { brain: 1, wire: 2, bosco: 3 }, rtype = () => RTYPE[st.ruleText] || 0;
// How each rule starts (checked by running every rule from its start and looking at it a few hundred generations on).
// Most grow best from the usual blobs of random soup at 30%. Day & Night, Anneal, Diamoeba and Move need random cells
// everywhere at about half density (from the blobs they died out or froze; Diamoeba is touchy: 46% dwindles, 48% fills
// the world, 47% keeps its diamonds); Seeds and Replicator explode or copy, so
// they start from a small random square in the middle, where you can watch it happen (from the blobs they were noise
// at once); Gnarl and Serviettes grow their symmetric shapes from a few cells; Life without death makes its ladders
// and crystals from sparse soup. [kind, density, size or cells]
const START = { daynight: ['field', 0.5], anneal: ['field', 0.5], diamoeba: ['field', 0.47], morley: ['field', 0.5],
  seeds: ['seed', 0.5, 6], replicator: ['seed', 0.5, 5], gnarl: ['cells', 0, 'o!'], serviettes: ['cells', 0, '2o$2o!'], nodeath: ['soup', 0.12] };
const startOf = () => (st.mode === 'life' && START[st.rule]) || ['soup', null];
const RULE_INFO = { conway: 'The classic: gliders, oscillators and still lifes settle out of the chaos.', highlife: 'Like Life, plus birth on six neighbours: it has a pattern that copies itself.', daynight: 'Swap live and dead and the rule is the same: islands of each flicker in the other.',
  seeds: 'Nothing survives, and every cell with two neighbours is born: it explodes outward.', maze: 'Cells survive easily, so the growth fills in as winding corridors.', coral: 'Slow growth that hardens into coral-like branches.',
  replicator: 'Every pattern ends up making copies of itself.', diamoeba: 'Big diamond-shaped blobs that wobble and crawl.', twobytwo: 'Patterns built from 2×2 blocks.', morley: 'Full of small spaceships drifting in all directions.',
  anneal: 'Each cell goes along with the majority of its neighbourhood, nearly: the patches slowly round off and shrink, like metal cooling.', nodeath: 'Nothing ever dies, so every pattern leaves a growing frozen trail: ladders and tangled crystals.',
  gnarl: 'A cell is born, or survives, with exactly one neighbour: gnarled, twisting growth.', serviettes: 'Every cell dies, and cells with 2, 3 or 4 neighbours are born: symmetric patterns like folded paper napkins.',
  amoeba: 'Blobs that grow and shrink, and split and merge, like amoebas.', walled: 'Cities grow walls round themselves: solid regions with crisp edges.', longlife: 'Oscillators that take a long time to repeat.',
  brain: 'Brian Silverman\'s rule with three states: a lit cell (bright) fades for one step (dim), then goes dark; a dark cell lights up if exactly two neighbours are lit. Almost everything becomes gliders streaming outward.',
  wire: 'Brian Silverman\'s Wireworld (1987): copper wires (dim) carry electrons, a head (bright) followed by a tail. Loops are clocks that send pulses down the wires. With these rules people have built working computers. Paint wire with the brush.',
  bosco: 'Kellie Evans\' "Larger than Life": each cell counts every live cell in an 11 × 11 square round it. This one, Bosco\'s rule, grows smooth blobs and slow gliding creatures called bugs.' };
const LENIA = { tangle: [0.15, 0.015, "The numbers of Lenia's best-known glider, Orbium; from a random start, each patch grows into a spreading coral tangle."], stripes: [0.26, 0.036, 'The world fills with fine stripes, like a fingerprint.'], broad: [0.35, 0.07, 'Wide, slowly shifting stripes.'] };
const RD = { coral: [0.0545, 0.062, 'Branches that spread like coral.'], mitosis: [0.0367, 0.0649, 'Spots that grow and split in two, like dividing cells.'], spots: [0.035, 0.065, 'A field of round spots, like a leopard.'],
  maze: [0.029, 0.057, 'Winding stripes, like a fingerprint or a brain coral.'], holes: [0.039, 0.058, 'A sheet full of holes, like a sponge.'],
  worms: [0.078, 0.061, 'Short worms that grow until they fill the space, then stop.'], uskate: [0.062, 0.0609, 'Spots that slide about like skaters, leaving trails.'],
  bubbles: [0.098, 0.0555, 'The other way round: bubbles of A in a sea of B.'], waves: [0.022, 0.051, 'Waves that roll outward from every seed and lock together into stripes.'], pulse: [0.018, 0.051, 'Spots that pulse, swell and split, never quite settling.'], beans: [0.010, 0.047, 'Bean shapes that stretch, curl and split.'] };
const PATTERNS = { glider: 'bob$2bo$3o!', lwss: 'bo2bo$o4b$o3bo$4o!', rpent: 'b2o$2ob$bo!', acorn: 'bo5b$3bo3b$2o2b3o!',
  gun: '24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!',
  pulsar: '2b3o3b3o2b2$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b2$2b3o3b3o2b$o4bobo4bo$o4bobo4bo$o4bobo4bo2$2b3o3b3o!',
  // each of these was checked by simulation: diehard vanishes at generation 130, the pentadecathlon repeats every 15,
  // the spaceships move 2 cells every 4 generations (the Copperhead 1 every 10), Kok's galaxy repeats every 8, and the
  // ten-cell pattern grows forever (about 110 cells per 1,000 generations)
  diehard: '6bo$2o$bo3b3o!', pentadecathlon: '2bo4bo$2ob4ob2o$2bo4bo!', mwss: '3bo$bo3bo$o$o4bo$5o!', hwss: '3b2o$bo4bo$o$o5bo$6o!',
  infinite: '8bo$6bob2o$6bobo$6bo$4bo$2bobo!', copperhead: 'b2o2b2o$3b2o$3b2o$obo2bobo$o6bo2$o6bo$b2o2b2o$2b4o2$3b2o$3b2o!', galaxy: '6ob2o$6ob2o$7b2o$2o5b2o$2o5b2o$2o5b2o$2o7b$2ob6o$2ob6o!' };
function parseRule(s) { const m = /^B([0-8]*)\/S([0-8]*)$/i.exec(String(s).replace(/\s/g, '')); if (!m) return null; let b = 0, sv = 0; for (const c of m[1]) b |= 1 << +c; for (const c of m[2]) sv |= 1 << +c; return { b, s: sv, text: `B${m[1]}/S${m[2]}` }; }
function rle(s) { const cells = []; let x = 0, y = 0, n = ''; for (const c of s) { if (/\d/.test(c)) { n += c; continue; } const k = n ? +n : 1; n = '';
  if (c === 'b') x += k; else if (c === 'o') { for (let i = 0; i < k; i++) cells.push([x + i, y]); x += k; } else if (c === '$') { y += k; x = 0; } else if (c === '!') break; } return cells; }

// ---------- state ----------
const st = { mode: 'life', rule: 'conway', ruleText: 'B3/S23', lenia: 'tangle', mu: 0.15, sigma: 0.015, rd: 'coral', feed: 0.0545, kill: 0.062, seed: 1, dens: 0.3, speed: 1,
  brush: 'paint', bsize: 6, beatSeed: true, cell: 3, trails: true, round: true, relief: true, palette: 'aurora', palRev: false, cycle: 0, cycleSpeed: 0, bg: '#0b0d12', paused: false, mm: 90, high: 1.6 };
const INFO = { life: ['Life', 'cells live or die by how many neighbours they have'], lenia: ['Lenia', 'smooth life: soft cells, soft rules'], rd: ['Reaction–diffusion', 'two chemicals spreading and reacting'] };

// ---------- WebGL ----------
const lc = $('lc'), G = makeGL(lc);
if (!G) throw noWebGL($('na'), 'Growing Patterns');
const g = G.g;
const HEAD = `#version 300 es
precision highp float; out vec4 outC; uniform sampler2D u_s; uniform ivec2 u_n;
vec4 at(ivec2 p){ return texelFetch(u_s, (p+u_n)%u_n, 0); }
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }`;
const FS_LIFE = HEAD + `
uniform int u_b, u_sv, u_rt;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=at(p); int n=0;
  if (u_rt==1){   // Brian's Brain: lit (1) → fading (0.5) → dark (0); dark lights up with exactly two lit neighbours
    for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++) if (x!=0||y!=0) n+= at(p+ivec2(x,y)).r>0.75 ? 1 : 0;
    float nx = s.r>0.75 ? 0.5 : s.r>0.25 ? 0.0 : (n==2 ? 1.0 : 0.0); outC=vec4(nx,0.0, nx>0.75 ? 1.0 : s.b*0.9, 1.0); return; }
  if (u_rt==2){   // Wireworld: empty 0, wire 1/3, tail 2/3, head 1; wire becomes a head next to one or two heads
    float c=s.r, nx=c; if (c>0.83) nx=0.66; else if (c>0.5) nx=0.33; else if (c>0.17){ for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++) if (x!=0||y!=0) n+= at(p+ivec2(x,y)).r>0.83 ? 1 : 0; nx = (n==1||n==2) ? 1.0 : 0.33; }
    outC=vec4(nx,0.0, nx>0.83 ? 1.0 : s.b*0.85, 1.0); return; }
  if (u_rt==3){   // Bosco's rule (Larger than Life): count the 11 × 11 square, the cell itself included
    for (int y=-5;y<=5;y++) for (int x=-5;x<=5;x++) n+= at(p+ivec2(x,y)).r>0.5 ? 1 : 0;
    bool al=s.r>0.5, nx = al ? (n>=33 && n<=57) : (n>=34 && n<=45); outC=vec4(nx?1.0:0.0, nx ? (al ? min(s.g+1.0/64.0,1.0) : 0.0) : 0.0, nx ? 1.0 : s.b*0.9, 1.0); return; }
  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++) if (x!=0||y!=0) n+= at(p+ivec2(x,y)).r>0.5 ? 1 : 0;
  bool alive=s.r>0.5, next = alive ? ((u_sv>>n)&1)==1 : ((u_b>>n)&1)==1;
  outC=vec4(next?1.0:0.0, next ? (alive ? min(s.g+1.0/64.0,1.0) : 0.0) : 0.0, next ? 1.0 : s.b*0.9, 1.0); }`;
const FS_LENIA = HEAD + `
uniform float u_mu, u_sigma, u_ksum, u_dt;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float a=at(p).r, u=0.0; const int R=13;
  for (int y=-R;y<=R;y++) for (int x=-R;x<=R;x++){ float r=length(vec2(x,y))/float(R); if (r>0.0 && r<1.0) u+=at(p+ivec2(x,y)).r*exp(4.0-1.0/(r*(1.0-r))); }
  u/=u_ksum; float d=u-u_mu, gr=2.0*exp(-d*d/(2.0*u_sigma*u_sigma))-1.0;
  outC=vec4(clamp(a+u_dt*gr,0.0,1.0), u, 0.0, 1.0); }`;
const FS_RD = HEAD + `
uniform float u_f, u_k;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec2 c=at(p).rg;
  vec2 l=-c+0.2*(at(p+ivec2(1,0)).rg+at(p-ivec2(1,0)).rg+at(p+ivec2(0,1)).rg+at(p-ivec2(0,1)).rg)+0.05*(at(p+ivec2(1,1)).rg+at(p+ivec2(-1,1)).rg+at(p+ivec2(1,-1)).rg+at(p+ivec2(-1,-1)).rg);
  float A=c.x, B=c.y, r=A*B*B; A+=1.0*l.x-r+u_f*(1.0-A); B+=0.5*l.y+r-(u_k+u_f)*B;
  outC=vec4(clamp(A,0.0,1.0), clamp(B,0.0,1.0), 0.0, 1.0); }`;
// Starts. The random numbers are an integer hash (PCG) of the cell, a counter and the seed, so every seed gives a truly
// different start (the float hash lost precision on big seeds, and different seeds came out much alike).
// Life starts as a few blobs of random soup, each a different size with a wobbly edge, at random places: one square of
// soup always crumbled the same way from its edges and corners, so every new start looked the same.
const FS_INIT = HEAD + `
uniform int u_mode, u_start; uniform float u_seed, u_dens;
uint pcg(uint v){ uint s=v*747796405u+2891336453u; uint w=((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w; }
float rnd(int a, int b, int c){ return float(pcg(uint(a)+pcg(uint(b)+pcg(uint(c)+0x9e3779b9u))))/4294967295.0; }
vec2 wrapd(vec2 q, vec2 o, vec2 sz){ vec2 d=abs(q-o); return min(d, sz-d); }
void main(){ vec2 q=gl_FragCoord.xy, sz=vec2(u_n); ivec2 iq=ivec2(q); int sd=int(u_seed); float h=rnd(iq.x+65536*iq.y, 1, sd);
  if (u_mode==0){ int nb=3+int(rnd(0,2,sd)*5.0); bool inside=u_start==1; float m=min(sz.x,sz.y);
    for (int i=0;i<8;i++){ if (i>=nb) break; vec2 o=i==0 ? sz*(0.5+0.24*(vec2(rnd(i,3,sd), rnd(i,4,sd))-0.5)) : vec2(rnd(i,3,sd), rnd(i,4,sd))*sz; float R=m*(i==0 ? 0.16+0.08*rnd(i,5,sd) : 0.07+0.2*rnd(i,5,sd));   /* the first blob sits near the middle, so a start never opens on an empty screen */ vec2 d=q-o; d=d-sz*round(d/sz);
      float th=atan(d.y,d.x), wob=1.0+0.22*sin(3.0*th+6.283*rnd(i,6,sd))+0.12*sin(5.0*th+6.283*rnd(i,7,sd));
      if (length(d)<R*wob) inside=true; if (inside) break; }
    outC=vec4(inside && h<u_dens ? 1.0 : 0.0, 0.0, 0.0, 1.0); }
  else if (u_mode==1){ float m=0.0; for (int i=0;i<16;i++){ vec2 o=vec2(rnd(i,8,sd), rnd(i,9,sd))*sz; if (length(wrapd(q,o,sz))<16.0+10.0*u_dens) m=1.0; }   // small round patches, about one ring across
    outC=vec4(m*rnd(iq.x+65536*iq.y, 10, sd), 0.0, 0.0, 1.0); }
  else { float B=0.0; for (int i=0;i<10;i++){ vec2 o=vec2(rnd(i,11,sd), rnd(i,12,sd))*sz; vec2 d=wrapd(q,o,sz); if (max(d.x,d.y)<8.0+10.0*u_dens) B=1.0; }
    outC = B>0.5 ? vec4(0.5, 0.25+0.1*h, 0.0, 1.0) : vec4(1.0, 0.0, 0.0, 1.0); } }   // seeds part-used, which lets the shy recipes (spots, dividing cells) take hold`;
const FS_PAINT = HEAD + `
uniform int u_mode, u_rt; uniform vec4 u_brush; uniform float u_seed;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=at(p); vec2 d=abs(gl_FragCoord.xy-u_brush.xy); d=min(d,vec2(u_n)-d); float r=length(d);
  if (r<u_brush.z){ float h=hash(gl_FragCoord.xy+u_seed);
    if (u_brush.w>1.5) s = u_mode==2 ? vec4(1.0,0.0,0.0,1.0) : vec4(0.0,0.0,s.b,1.0);
    else if (u_mode==0) s = u_rt==2 ? vec4(0.33,0.0,s.b,1.0) : h<0.45 ? vec4(1.0,0.0,1.0,1.0) : s;   // Wireworld paints wire
    else if (u_mode==1) s.r = max(s.r, h*(1.0-r/u_brush.z)*0.9+0.1);
    else s.g = max(s.g, 0.5+0.5*h); }
  outC=s; }`;
const FS_SHOW = `#version 300 es
precision highp float; out vec4 outC; uniform sampler2D u_s; uniform ivec2 u_n; uniform vec2 u_res; uniform int u_mode, u_trails, u_relief, u_grid, u_rt, u_round; uniform float u_cycle, u_flash, u_zoom; uniform vec3 u_bg; uniform vec2 u_off, u_ang;
${PAL_GLSL}
vec4 at(ivec2 p){ return texelFetch(u_s, p-u_n*ivec2(floor(vec2(p)/vec2(u_n))), 0); }   /* wraps any distance (a turned view reaches below zero) */
// Lenia and reaction-diffusion are smooth fields, not squares: they are drawn by bicubic (Catmull-Rom) interpolation
// between cells, and the relief light uses the slope of the same smooth surface, so neither shows the grid
float val(ivec2 p){ vec4 s=at(p); return u_mode==1 ? s.r : clamp(s.g*2.6,0.0,1.0); }
vec4 cr(float t){ float t2=t*t, t3=t2*t; return vec4(-0.5*t3+t2-0.5*t, 1.5*t3-2.5*t2+1.0, -1.5*t3+2.0*t2+0.5*t, 0.5*t3-0.5*t2); }
vec4 crd(float t){ float t2=t*t; return vec4(-1.5*t2+2.0*t-0.5, 4.5*t2-5.0*t, -4.5*t2+4.0*t+0.5, 1.5*t2-t); }
vec3 smoothField(vec2 f){   /* value, slope across, slope up */
  vec2 g=f-0.5; ivec2 b=ivec2(floor(g)); vec2 t=g-vec2(b); vec4 wx=cr(t.x), wy=cr(t.y), dx=crd(t.x), dy=crd(t.y); vec3 r=vec3(0.0);
  for (int j=0;j<4;j++){ vec4 v=vec4(val(b+ivec2(-1,j-1)), val(b+ivec2(0,j-1)), val(b+ivec2(1,j-1)), val(b+ivec2(2,j-1)));
    r+=vec3(wy[j]*dot(wx,v), wy[j]*dot(dx,v), dy[j]*dot(wx,v)); }
  return r; }
float trail(vec2 f){ vec2 g=f-0.5; ivec2 b=ivec2(floor(g)); vec2 t=g-vec2(b); t=t*t*(3.0-2.0*t);   /* Life's fading trails are soft: blended between cells */
  return mix(mix(at(b).b, at(b+ivec2(1,0)).b, t.x), mix(at(b+ivec2(0,1)).b, at(b+ivec2(1,1)).b, t.x), t.y); }
// Round cells are metaballs: every live cell is a round soft ball (Gaussian, about a cell across) and the picture is cut
// where the balls add up to T, so a lone cell is a dot, neighbours melt into one smooth blob, and diagonal cells just part.
// m holds the three state layers (thresholds th) and the age of the middle one; tr is the trail, blurred the same way.
const float T=0.61;
void balls(vec2 f, vec3 th, out vec4 m, out float tr){ ivec2 b=ivec2(floor(f-0.5)); m=vec4(0.0); vec2 t=vec2(0.0);
  for (int j=-1;j<3;j++) for (int i=-1;i<3;i++){ ivec2 q=b+ivec2(i,j); vec4 c=at(q); vec2 d=f-vec2(q)-0.5; float r2=dot(d,d);
    float w=exp(-r2*2.47), w2=exp(-r2*1.4); vec3 on=step(th,vec3(c.r)); m+=w*vec4(on, on.y*c.g); t+=w2*vec2(c.b,1.0); }
  m.w = m.y>0.0 ? m.w/m.y : 0.0; tr=t.x/t.y; }
float edge(float a){ float w=max(fwidth(a)*0.8, 1e-3); return smoothstep(T-w, T+w, a); }
void main(){
  vec2 f=mat2(u_ang.x,u_ang.y,-u_ang.y,u_ang.x)*((gl_FragCoord.xy-0.5*u_res)/u_res*vec2(u_n))/u_zoom+0.5*vec2(u_n)+u_off;   /* zoomed and turned about the middle */ ivec2 p=ivec2(floor(f)); vec4 s=at(p); vec3 col;
  if (u_mode==0 && u_round==1){ vec4 m; float tr; balls(f, u_rt==2 ? vec3(0.17,0.5,0.83) : u_rt==1 ? vec3(0.25,0.5,0.75) : vec3(0.5), m, tr);
    vec3 back = u_trails==1 && u_rt!=2 ? mix(u_bg, pal(0.03+u_cycle)*0.8, tr*(u_rt==1 ? 0.4 : 0.55)) : u_bg;
    if (u_rt==2){ col=mix(back, pal(0.12+u_cycle)*0.85, edge(m.x)); col=mix(col, pal(0.36+u_cycle), edge(m.y)); col=mix(col, min(pal(0.48+u_cycle)*1.4+0.15, vec3(1.0)), edge(m.z)); }
    else if (u_rt==1){ col=mix(back, pal(0.2+u_cycle)*0.75, edge(m.x)); col=mix(col, pal(0.47+u_cycle), edge(m.z)); }
    else col=mix(back, pal((0.25+0.75*m.w)*0.5+u_cycle), edge(m.y)); }
  else if (u_mode==0 && u_rt==2){ col = s.r>0.83 ? min(pal(0.48+u_cycle)*1.4+0.15, vec3(1.0)) : s.r>0.5 ? pal(0.36+u_cycle) : s.r>0.17 ? pal(0.12+u_cycle)*0.85 : u_bg; }
  else if (u_mode==0 && u_rt==1){ col = s.r>0.75 ? pal(0.47+u_cycle) : s.r>0.25 ? pal(0.2+u_cycle)*0.75 : (u_trails==1 ? mix(u_bg, pal(0.03+u_cycle)*0.8, trail(f)*0.4) : u_bg); }
  else if (u_mode==0){ col = s.r>0.5 ? pal((0.25+0.75*s.g)*0.5+u_cycle) : (u_trails==1 ? mix(u_bg, pal(0.03+u_cycle)*0.8, trail(f)*0.55) : u_bg);
    if (u_grid==1){ vec2 e=fract(f); if (min(e.x,e.y)<0.08) col=mix(col,u_bg,0.5); } }
  else { vec3 sf=smoothField(f); float v=clamp(sf.x,0.0,1.0); col = mix(u_bg, pal((0.05+0.95*v)*0.5+u_cycle), smoothstep(0.0,0.12,v));
    if (u_relief==1){ float dx=2.0*sf.y, dy=2.0*sf.z;
      vec3 n=normalize(vec3(-dx*3.0,-dy*3.0,1.0)); col*=0.6+0.55*max(dot(n,normalize(vec3(-0.4,0.5,0.8))),0.0); } }
  outC=vec4(col*(1.0+0.35*u_flash)+0.05*u_flash,1.0); }`;
const P = { life: G.prog(FS_LIFE), lenia: G.prog(FS_LENIA), rd: G.prog(FS_RD), init: G.prog(FS_INIT), paint: G.prog(FS_PAINT), show: G.prog(FS_SHOW) };
let KSUM = 0; { const R = 13; for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const r = Math.hypot(x, y) / R; if (r > 0 && r < 1) KSUM += Math.exp(4 - 1 / (r * (1 - r))); } }
const MODE_ID = { life: 0, lenia: 1, rd: 2 };

// ---------- the grid ----------
let S = null, W = 0, H = 0, gen = 0, pop = '–';
const needsFloat = () => st.mode !== 'life';
// the world wraps round, so the driving keys scroll it: off is how far, in cells (always within 0..W, 0..H)
const off = [0, 0];
function scroll(dt) {
  const k = drive(); if (!k.any) return false; const cl = x => Math.max(-1, Math.min(1, x)), x = cl(k.slideX + k.turnX), y = cl(k.slideY + k.rawY); if (!x && !y) return false;
  const v = 0.5 * H / lz * (k.fast ? 3 : 1) * k.scale * dt, c = Math.cos(la), s = Math.sin(la);   /* along the screen, however the view is turned and zoomed */
  off[0] = ((off[0] + (c * x - s * y) * v) % W + W) % W; off[1] = ((off[1] + (s * x + c * y) * v) % H + H) % H; return true;
}
function setup() {
  $('seedIn').value = st.seed;   // the start number on show is always the one in use
  off[0] = off[1] = 0;
  const r = lc.getBoundingClientRect(), w = Math.max(16, Math.min(1024, Math.floor(r.width / st.cell))), h = Math.max(16, Math.min(1024, Math.floor(r.height / st.cell)));
  const fl = needsFloat(); if (fl && !G.floatOK) { S = null; return; }
  if (!S || W !== w || H !== h || S.float !== fl) { if (S) S.free(); S = G.pair(w, h, { float: fl, full: true }); S.float = fl; W = w; H = h; }
  gen = 0; const rt = st.mode === 'life' ? rtype() : 0;
  const [kind, , extra] = startOf(), few = kind === 'seed' || kind === 'cells';
  pass(P.init, p => { g.uniform1i(p.u('u_mode'), MODE_ID[st.mode]); g.uniform1i(p.u('u_start'), kind === 'field' ? 1 : 0); g.uniform1f(p.u('u_seed'), st.seed); g.uniform1f(p.u('u_dens'), rt === 2 || few ? 0 : rt === 3 ? Math.max(st.dens, 0.45) : st.dens); });
  if (rt === 2) circuit();
  if (kind === 'cells' && st.dens > 0) placeCells(rle(extra));
  else if (kind === 'seed' && st.dens > 0) { let h = st.seed * 2654435761 >>> 0; const rnd = () => ((h = (h ^ (h << 13)) >>> 0, h = (h ^ (h >>> 17)) >>> 0, h = (h ^ (h << 5)) >>> 0) / 4294967296);   // a small random square, from the seed
    const cells = []; for (let y = 0; y < extra; y++) for (let x = 0; x < extra; x++) if (rnd() < st.dens) cells.push([x, y]); if (!cells.length) cells.push([0, 0]); placeCells(cells); }
}
function pass(p, set) { g.useProgram(p.p); G.bindTex(p, 'u_s', S.a.t, 0); g.uniform2i(p.u('u_n'), W, H); if (set) set(p); G.draw(S.b.fb, W, H); S.swap(); }
function step() {
  if (st.mode === 'life') { const R = parseRule(st.ruleText) || parseRule('B3/S23'); pass(P.life, p => { g.uniform1i(p.u('u_b'), R.b); g.uniform1i(p.u('u_sv'), R.s); g.uniform1i(p.u('u_rt'), rtype()); }); }
  else if (st.mode === 'lenia') pass(P.lenia, p => { g.uniform1f(p.u('u_mu'), st.mu); g.uniform1f(p.u('u_sigma'), st.sigma); g.uniform1f(p.u('u_ksum'), KSUM); g.uniform1f(p.u('u_dt'), 0.1); });
  else { const f = st.feed * (1 + 0.03 * voice()); pass(P.rd, p => { g.uniform1f(p.u('u_f'), f); g.uniform1f(p.u('u_k'), st.kill); }); }
  gen++;
}
function paintAt(x, y, erase, rad) { if (!S) return; pass(P.paint, p => { g.uniform1i(p.u('u_mode'), MODE_ID[st.mode]); g.uniform1i(p.u('u_rt'), st.mode === 'life' ? rtype() : 0); g.uniform4f(p.u('u_brush'), x, y, rad || st.bsize, erase ? 2 : 1); g.uniform1f(p.u('u_seed'), Math.random() * 1000); }); dirty = true; }
// a Wireworld circuit: clock loops of different sizes (each with one electron going round) feeding wires to the right,
// two of them merging, so pulses race along, meet and sometimes cancel
function circuit() {
  if (!S || S.float) return; const cw = Math.min(W - 4, 150), ch = Math.min(H - 4, 70), d = new Uint8Array(cw * ch * 4), set = (x, y, v) => { if (x < 0 || y < 0 || x >= cw || y >= ch) return; const o = ((ch - 1 - y) * cw + x) * 4; d[o] = v; d[o + 3] = 255; };
  for (let i = 0; i < cw * ch; i++) d[i * 4 + 3] = 255;
  const loop = (x0, y0, w, h) => { for (let x = x0; x < x0 + w; x++) { set(x, y0, 84); set(x, y0 + h - 1, 84); } for (let y = y0; y < y0 + h; y++) { set(x0, y, 84); set(x0 + w - 1, y, 84); } set(x0 + 1, y0, 255); set(x0, y0, 168); };
  const rows = [[4, 4, 7, 5], [4, 20, 9, 5], [4, 36, 6, 4], [4, 52, 11, 6]];
  rows.forEach(([x, y, w, h], i) => { loop(x, y, w, h); const yy = y + 1; for (let xx = x + w; xx < cw - 4; xx++) set(xx, yy, 84); });
  for (let y = 5; y <= 21; y++) set(60, y, 84);   // a bridge joining the first two wires
  for (let y = 37; y <= 53; y++) set(95, y, 84);
  g.bindTexture(g.TEXTURE_2D, S.a.t); g.texSubImage2D(g.TEXTURE_2D, 0, Math.floor((W - cw) / 2), Math.floor((H - ch) / 2), cw, ch, g.RGBA, g.UNSIGNED_BYTE, d); dirty = true;
}
function placePattern(k) { placeCells(rle(PATTERNS[k])); }
function placeCells(cells) {
  if (!S || st.mode !== 'life') return; const mw = Math.max(...cells.map(c => c[0])) + 1, mh = Math.max(...cells.map(c => c[1])) + 1;
  if (mw > W || mh > H) return; const x0 = Math.floor((W - mw) / 2), y0 = Math.floor((H - mh) / 2), d = new Uint8Array(mw * mh * 4);
  for (let i = 0; i < mw * mh; i++) d[i * 4 + 3] = 255; for (const [x, y] of cells) { const o = ((mh - 1 - y) * mw + x) * 4; d[o] = 255; d[o + 2] = 255; }   // rows from the top, textures from the bottom
  g.bindTexture(g.TEXTURE_2D, S.a.t); g.texSubImage2D(g.TEXTURE_2D, 0, x0, y0, mw, mh, g.RGBA, g.UNSIGNED_BYTE, d); dirty = true;
}
function count() {
  if (!S) return; const n = W * H; let tot = 0;
  g.bindFramebuffer(g.FRAMEBUFFER, S.a.fb);
  if (!S.float) { const b = new Uint8Array(n * 4), th = st.mode === 'life' && rtype() === 2 ? 211 : st.mode === 'life' && rtype() === 1 ? 191 : 127; g.readPixels(0, 0, W, H, g.RGBA, g.UNSIGNED_BYTE, b); for (let i = 0; i < n; i++) if (b[i * 4] > th) tot++; pop = tot.toLocaleString(); }
  else { const b = new Float32Array(n * 4); g.readPixels(0, 0, W, H, g.RGBA, g.FLOAT, b); const ch = st.mode === 'lenia' ? 0 : 1; let cov = 0; for (let i = 0; i < n; i++) { const v = b[i * 4 + ch]; tot += v; if (v > (ch ? 0.2 : 0.1)) cov++; }
    pop = st.mode === 'lenia' ? Math.round(tot).toLocaleString() : (cov / n * 100).toFixed(1) + '%'; }
  g.bindFramebuffer(g.FRAMEBUFFER, null);
}
function show() {
  G.fit(Math.min(devicePixelRatio, 2)); if (!S) { g.bindFramebuffer(g.FRAMEBUFFER, null); g.clearColor(0.04, 0.05, 0.07, 1); g.clear(g.COLOR_BUFFER_BIT); return; }
  const p = P.show, pu = rampUniform(R); g.useProgram(p.p); G.bindTex(p, 'u_s', S.a.t, 0); g.uniform2i(p.u('u_n'), W, H); g.uniform2f(p.u('u_res'), lc.width, lc.height); g.uniform2f(p.u('u_off'), off[0], off[1]); const sway = st.mode === 'rd' ? 0 : 0.04 * voiceNow;   /* vocals turn Life and Lenia gently (reaction-diffusion's feed already sways) */
  g.uniform2f(p.u('u_ang'), Math.cos(la + sway), Math.sin(la + sway)); g.uniform1f(p.u('u_zoom'), lz * (1 + 0.04 * pulseNow));
  g.uniform1i(p.u('u_mode'), MODE_ID[st.mode]); g.uniform1i(p.u('u_rt'), st.mode === 'life' ? rtype() : 0); g.uniform1i(p.u('u_trails'), st.trails ? 1 : 0); g.uniform1i(p.u('u_relief'), st.relief ? 1 : 0); g.uniform1i(p.u('u_grid'), st.cell >= 6 ? 1 : 0); g.uniform1i(p.u('u_round'), st.round ? 1 : 0);
  g.uniform1f(p.u('u_cycle'), st.cycle); g.uniform1f(p.u('u_flash'), flashNow); g.uniform3f(p.u('u_bg'), ...hexRGB(st.bg)); g.uniform3fv(p.u('u_pal'), pu.data); g.uniform1i(p.u('u_npal'), pu.n);
  G.draw(null, lc.width, lc.height);
}

// ---------- painting with the pointer ----------
let painting = false;
const toCell = e => { const r = lc.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width - 0.5) * W / lz, y = (0.5 - (e.clientY - r.top) / r.height) * H / lz, c = Math.cos(la), s = Math.sin(la), m = (v, n) => ((v % n) + n) % n;
  return [m(c * x - s * y + W / 2 + off[0], W), m(s * x + c * y + H / 2 + off[1], H)]; };
lc.addEventListener('pointerdown', e => { lc.setPointerCapture(e.pointerId); painting = true; const [x, y] = toCell(e); paintAt(x, y, st.brush === 'erase' || e.button === 2); });
lc.addEventListener('pointermove', e => { if (!painting) return; const [x, y] = toCell(e); paintAt(x, y, st.brush === 'erase' || (e.buttons & 2)); });
lc.addEventListener('pointerup', () => { painting = false; }); lc.addEventListener('contextmenu', e => e.preventDefault());

// ---------- panel ----------
$('ruleList').innerHTML = Object.entries(RULES).map(([k, [n, r]]) => `<button data-r="${k}">${n}<small style="display:block;opacity:.7;font-size:10.5px">${r}</small></button>`).join('');
segClick('modeList', d => pickMode(d.m));
segClick('ruleList', d => { const was = rtype(); st.rule = d.r; st.ruleText = RULES[d.r][1]; $('ruleIn').value = '';
  const how = ruleStart(); if (how === 'keep') { if (was !== rtype() || rtype()) setup(); }   // the same cells under the new rule (the special rules still need their own start)
  else { if (how === 'new') st.seed = newSeed(); const s = START[d.r]; setRange('dens', s && s[0] !== 'cells' ? s[1] : 0.3); setup(); }   // the rule starts afresh, in its own way (START), from a new or the same start number
  count(); labels(); share.touch(); });
$('ruleApply').addEventListener('click', () => { const R0 = parseRule($('ruleIn').value); if (!R0) { $('ruleNote').textContent = 'Write it as B, the birth counts, then /S and the survival counts: for example B36/S23.'; return; }
  st.ruleText = R0.text; st.rule = Object.keys(RULES).find(k => RULES[k][1] === R0.text) || 'custom'; labels(); share.touch(); });
$('ruleIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('ruleApply').click(); });
segClick('leniaList', d => { st.lenia = d.p; setRange('mu', LENIA[d.p][0]); setRange('sigma', LENIA[d.p][1]); setup(); labels(); share.touch(); });
segClick('rdList', d => { st.rd = d.p; setRange('feed', RD[d.p][0]); setRange('kill', RD[d.p][1]); setup(); labels(); share.touch(); });
function pickMode(m) {
  st.mode = m; document.querySelectorAll('#modeList button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('lifeRules').hidden = m !== 'life'; $('leniaPre').hidden = m !== 'lenia'; $('rdPre').hidden = m !== 'rd'; $('lifePat').hidden = m !== 'life'; $('leniaCtl').hidden = m !== 'lenia'; $('rdCtl').hidden = m !== 'rd';
  $('trailRow').hidden = m !== 'life'; $('roundRow').hidden = m !== 'life'; $('reliefRow').hidden = m === 'life';
  if (m !== 'life' && st.cell < 2) setRange('cell', 2); else setup();
  count(); labels(); stats(); dirty = true; share.touch();
}
function labels() {
  const [t, sub] = INFO[st.mode]; let name = t, about;
  if (st.mode === 'life') { const rn = st.rule === 'custom' ? 'Your rule' : RULES[st.rule][0]; name = rtype() ? rn : `${rn} (${st.ruleText})`; about = `<strong>${rn}, ${st.ruleText}.</strong> ${st.rule === 'custom' ? 'A rule of your own: B lists the neighbour counts that bring a dead cell to life, S the counts that let a live cell survive.' : RULE_INFO[st.rule]}`;
    document.querySelectorAll('#ruleList button').forEach(b => b.classList.toggle('on', b.dataset.r === st.rule)); }
  else if (st.mode === 'lenia') { name = 'Lenia'; about = `<strong>Lenia.</strong> ${LENIA[st.lenia] ? LENIA[st.lenia][2] : ''} Each cell sums a soft ring of neighbours; if the sum is near the growth centre it grows, otherwise it fades.`; }
  else { name = 'Reaction–diffusion'; about = `<strong>Reaction–diffusion.</strong> ${RD[st.rd] ? RD[st.rd][2] : ''} Chemical B feeds on A and makes more of itself; A is topped up by the feed, B is removed by the kill, and both spread out, B more slowly.`; }
  $('title').textContent = name; $('subtitle').textContent = sub; $('about').innerHTML = about; $('gv-shapes').textContent = t;
  $('ruleNote').textContent = 'B: neighbour counts that bring a cell to life. S: counts that keep it alive.';
  $('lgBar').style.background = rampCss(R); const L = st.mode === 'life' ? ['young', 'old'] : st.mode === 'lenia' ? ['empty', 'full'] : ['no B', 'lots of B']; $('lgL').textContent = L[0]; $('lgR').textContent = L[1];
  const cap = st.mode !== 'life' && !G.floatOK ? '<b>Not on this graphics card.</b> Lenia and reaction–diffusion need float textures, which this browser doesn\'t offer. Life still works.' : '';
  $('stageCap').innerHTML = cap; $('stageCap').style.display = cap ? 'block' : 'none';
  $('gv-ctl').textContent = st.paused ? 'paused' : '';
}
function stats() {
  if (!S) { setStats(['–', ''], ['–', ''], ['–', '']); return; }
  const lab = st.mode === 'life' ? 'live cells' : st.mode === 'lenia' ? 'total mass' : 'covered by B';
  setStats([gen.toLocaleString(), st.mode === 'life' ? 'generations' : 'steps'], [pop, lab], [`${W}×${H}`, 'cells']);
  $('statNote').textContent = st.mode === 'life' ? 'The grid wraps round: what leaves one edge comes back on the other.' : st.mode === 'lenia' ? 'Mass is the sum of every cell\'s amount. A glider keeps its mass while it moves.' : 'Feed ' + st.feed.toFixed(4) + ', kill ' + st.kill.toFixed(4) + ': tiny changes give very different patterns.';
}
$('goBtn').addEventListener('click', () => togglePause()); $('stepBtn').addEventListener('click', () => { st.paused = true; step(); count(); labels(); $('goBtn').textContent = 'Run'; dirty = true; });
$('newBtn').addEventListener('click', () => renew()); $('clearBtn').addEventListener('click', () => { if (!S) return; clearWorld(); count(); });
const ruleStart = () => (document.querySelector('#ruleStart input:checked') || {}).value || 'new', newSeed = () => Math.floor(Math.random() * 9999) + 1;
// a start number typed in: restart from exactly that start
const useSeed = () => { const v = Math.round(+$('seedIn').value.replace(/[^0-9]/g, '')); if (!(v >= 1)) { $('seedIn').value = st.seed; return; } st.seed = Math.min(v, 9999999);   /* the shader gets it as a float: exact to 16.7 million */ st.paused = false; $('goBtn').textContent = 'Pause'; setup(); count(); dirty = true; share.touch(); };
$('seedGo').addEventListener('click', useSeed); $('seedIn').addEventListener('keydown', e => { if (e.key === 'Enter') { useSeed(); e.target.blur(); } });
function clearWorld() { const d = st.dens; st.dens = 0; setup(); st.dens = d; dirty = true; }
$('speed').addEventListener('input', e => { st.speed = +e.target.value; $('speedo').textContent = st.speed.toFixed(1) + '×'; share.touch(); });
$('dens').addEventListener('input', e => { st.dens = +e.target.value; $('denso').textContent = Math.round(st.dens * 100) + '%'; share.touch(); });
// a pattern goes into an empty world under Life's own rule, where it does what its name says; with Keep the cells, it's added to what's there
segClick('patList', d => { if (!S) return; if (ruleStart() !== 'keep') { if (st.ruleText !== 'B3/S23') { st.rule = 'conway'; st.ruleText = 'B3/S23'; $('ruleIn').value = ''; } clearWorld(); labels(); share.touch(); } placePattern(d.p); count(); });
$('mu').addEventListener('input', e => { st.mu = +e.target.value; $('muo').textContent = st.mu.toFixed(3); share.touch(); });
$('sigma').addEventListener('input', e => { st.sigma = +e.target.value; $('sigmao').textContent = st.sigma.toFixed(4); share.touch(); });
$('feed').addEventListener('input', e => { st.feed = +e.target.value; $('feedo').textContent = st.feed.toFixed(4); share.touch(); });
$('kill').addEventListener('input', e => { st.kill = +e.target.value; $('killo').textContent = st.kill.toFixed(4); share.touch(); });
segClick('brush', d => { st.brush = d.b; });
$('bsize').addEventListener('input', e => { st.bsize = +e.target.value; $('bsizeo').textContent = st.bsize; });
$('beatSeed').addEventListener('change', e => { st.beatSeed = e.target.checked; share.touch(); });
$('cell').addEventListener('input', e => { st.cell = +e.target.value; $('cello').textContent = st.cell + ' px'; setup(); dirty = true; share.touch(); });
$('trails').addEventListener('change', e => { st.trails = e.target.checked; dirty = true; share.touch(); });
$('round').addEventListener('change', e => { st.round = e.target.checked; dirty = true; share.touch(); });
$('relief').addEventListener('change', e => { st.relief = e.target.checked; dirty = true; share.touch(); });
let R = rampOf('aurora', false);
const recolour = () => { R = rampOf(st.palette, st.palRev); palLabel(); labels(); dirty = true; };
buildSwatches($('palettes'), st.palette, name => { st.palette = name; recolour(); share.touch(); });
const palLabel = () => { $('palName').textContent = 'Palette: ' + st.palette.replace('_', ' & ').replace(/^./, c => c.toUpperCase()) + (st.palRev ? ' (reversed)' : ''); };
$('palRev').addEventListener('change', e => { st.palRev = e.target.checked; recolour(); share.touch(); });
$('cyc').addEventListener('input', e => { st.cycleSpeed = +e.target.value; $('cyco').textContent = st.cycleSpeed ? st.cycleSpeed.toFixed(1) + '×' : 'off'; share.touch(); });
segClick('bg', d => { st.bg = d.b; dirty = true; share.touch(); });
segClick('prSize', d => { st.mm = +d.mm; });
$('prHigh').addEventListener('input', e => { st.high = +e.target.value; $('prHigho').textContent = st.high.toFixed(1) + ' mm'; });
const fileBase = () => 'patterns_' + (st.mode === 'life' ? st.ruleText.replace('/', '_') : st.mode === 'lenia' ? 'lenia_' + st.lenia : 'rd_' + st.rd);
$('snap').addEventListener('click', () => { show(); saveCanvasPNG(lc, fileBase() + '.png', $('dlnote')); });
document.querySelectorAll('.btn.try').forEach(b => b.addEventListener('click', () => { const [m, a, c] = b.dataset.try.split('|'); st.paused = false; $('goBtn').textContent = 'Pause';
  if (m === 'life') { pickMode('life'); clickData('#ruleList', 'r', a); if (c) { const d = st.dens; st.dens = 0; setup(); st.dens = d; if (c === 'gun' && st.cell > 3) setRange('cell', 3); placePattern(c); } else setup(); }
  else if (m === 'lenia') { pickMode('lenia'); clickData('#leniaList', 'p', a); } else { pickMode('rd'); clickData('#rdList', 'p', a); } }));
buildKeys($('keyTable'), [['G', 'Pause / run'], ['N', 'A new random start'], ['1 – 3', 'Life, Lenia, reaction–diffusion'], ['+ / −', 'Bigger / smaller cells'], ['Wheel', 'Zoom in / out on the middle'], ['Right-drag', 'Erase'], ['← → ↑ ↓ / W A S D', 'Scroll the world (it wraps round: off one edge, on at the other)']]);

// ---------- actions ----------
function togglePause() { st.paused = !st.paused; $('goBtn').textContent = st.paused ? 'Run' : 'Pause'; labels(); }
function renew() { st.paused = false; $('goBtn').textContent = 'Pause'; st.seed = newSeed(); setup(); count(); dirty = true; share.touch(); }
function resetView() { st.paused = false; $('goBtn').textContent = 'Pause'; lz = 1; la = 0; MO.resetView(); setup(); count(); dirty = true; share.touch(); }

// ---------- loop ----------
const beats = new BeatGate();
// Motion (its own group): drift over the wrapped world, zoom in (1 to 8 times) and turn, and Slowly change, which sweeps
// Lenia's or reaction–diffusion's numbers while it grows, so the creatures change as you watch
let lz = 1, la = 0;
const MO = makeMotion2D({
  pan: (dx, dy) => { const c = Math.cos(la), s = Math.sin(la), k = H / lz; off[0] = (((off[0] + k * (c * dx - s * dy)) % W) + W) % W; off[1] = (((off[1] + k * (s * dx + c * dy)) % H) + H) % H; dirty = true; },
  zoom: f => { const z = clamp(lz / f, 1, 8), ok = z !== lz; lz = z; dirty = true; return ok; },
  rotate: a => { la = (la + a) % (2 * Math.PI); dirty = true; },
  sweep: { skip: ['speed', 'dens', 'bsize', 'cell'], far: 0.06 } });
const REC = addRecorder({ stage: lc.parentElement, name: () => fileBase(), bg: () => st.bg });
// the Visualizer: a new kind of Lenia or reaction-diffusion recipe (or, for Life, a new start) every eight bars; a fresh
// start when the chorus comes in; in Lenia and reaction-diffusion, kicks drop seeds
makeVisualizer(MO, { preset: 'mvd=0.25&mvw=1&mvb=0.3&mvn=0.1', shape: () => (st.mode === 'lenia' ? pickButton('#leniaList button') : st.mode === 'rd' ? pickButton('#rdList button') : (renew(), true)),
  drop: () => renew(), kick: () => { if (st.mode !== 'life' && S) paintAt(Math.random() * W, Math.random() * H, false, st.mode === 'lenia' ? 12 : 6); } });
lc.addEventListener('wheel', e => { e.preventDefault(); lz = clamp(lz * Math.exp(-e.deltaY * 0.0015), 1, 8); dirty = true; share.touch(); }, { passive: false });   // the wheel zooms in on the middle
let running = false, tPrev = 0, frame = 0, dirty = true, flashNow = 0, pulseNow = 0, voiceNow = 0, acc = 0;
function loop(now) {
  if (!running) return; const dt = Math.min(0.05, (now - tPrev) / 1000); tPrev = now; frame++;
  setPausedTag(st.paused); const go = !st.paused;
  const fl = flash(), pu = pulse(), vo = voice(); if (fl !== flashNow || pu !== pulseNow || Math.abs(vo - voiceNow) > 0.005) { flashNow = fl; pulseNow = pu; voiceNow = vo; dirty = true; }
  const cs = go ? colourStep(dt) : 0; if ((go && st.cycleSpeed > 0) || cs) { st.cycle = (st.cycle + (go ? dt * st.cycleSpeed * 0.06 : 0) + cs) % 1; dirty = true; }
  if (S && go) {
    if (st.beatSeed && beats.crossed()) paintAt(Math.random() * W, Math.random() * H, false, st.mode === 'life' ? 5 : st.mode === 'lenia' ? 12 : 6);
    const per = st.mode === 'life' ? 12 : st.mode === 'lenia' ? 30 : 600;   // steps per second at 1×
    acc += dt * per * st.speed * energyMul(); let n = Math.min(Math.floor(acc), st.mode === 'rd' ? 40 : 8); acc -= Math.floor(acc); if (acc > 4) acc = 0;
    for (let i = 0; i < n; i++) step(); if (n) dirty = true;
  }
  if (scroll(dt)) dirty = true;
  if (!painting) MO.step(dt, go);
  if (dirty) { dirty = false; show(); }
  if (frame % 30 === 0) { count(); stats(); }
  if (frame % 60 === 0) share.touch();
  requestAnimationFrame(loop);
}

// ---------- 3D print ----------
$('prBtn').addEventListener('click', () => {
  if (!S) return; const n = W * H, A = new Float32Array(n);
  g.bindFramebuffer(g.FRAMEBUFFER, S.a.fb);
  if (!S.float) { const b = new Uint8Array(n * 4); g.readPixels(0, 0, W, H, g.RGBA, g.UNSIGNED_BYTE, b); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) A[j * W + i] = b[((H - 1 - j) * W + i) * 4] > 127 ? 1 : 0; }
  else { const b = new Float32Array(n * 4); g.readPixels(0, 0, W, H, g.RGBA, g.FLOAT, b); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const o = ((H - 1 - j) * W + i) * 4; A[j * W + i] = st.mode === 'lenia' ? b[o] : clamp(b[o + 1] * 2.6, 0, 1); } }
  g.bindFramebuffer(g.FRAMEBUFFER, null);
  // keep the mesh a printable size: big grids are averaged down to about 300 cells across
  const k = Math.max(1, Math.ceil(Math.max(W, H) / 300)), w = Math.floor(W / k), h = Math.floor(H / k), B = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let s = 0; for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) s += A[(j * k + y) * W + i * k + x]; B[j * w + i] = s / (k * k); }
  const T = heightfieldTriangles(B, w, h, st.mm, 2, st.high), res = stlFromTriangles(T, st.mm, 'Math Explorer patterns');
  saveFile(fileBase() + `_${st.mm}mm.stl`, res.bytes, $('prNote')).then(ok => { if (ok) $('prNote').textContent += ` ${res.size.map(v => Math.round(v)).join(' × ')} mm.`; });
});

// ---------- keys, sharing, lifecycle ----------
export function onKey(e) {
  return standardKeys(e, {
    pause: togglePause, go: togglePause, renew, reset: resetView,
    shape: dir => clickNext(st.mode === 'life' ? '#ruleList button' : st.mode === 'lenia' ? '#leniaList button' : '#rdList button', dir), palette: dir => clickNext('#palettes button', dir),
    colourMode: () => { if (st.mode === 'life') setCheck('trails', !st.trails); else setCheck('relief', !st.relief); dirty = true; },
    reverse: () => $('palRev').click(), cycle: () => setRange('cyc', st.cycleSpeed > 0 ? 0 : 1),
    zoom: f => setRange('cell', clamp(st.cell + (f < 1 ? 1 : -1), 1, 10)), mode: i => { const b = document.querySelectorAll('#modeList button')[i]; if (b) b.click(); },
  });
}
const encode = () => { const p = new URLSearchParams(); p.set('m', st.mode); p.set('seed', st.seed); p.set('d', st.dens); p.set('cs', st.cell);
  if (st.mode === 'life') { p.set('r', st.ruleText); if (!st.trails) p.set('tr', 0); if (!st.round) p.set('rc', 0); }
  if (st.mode === 'lenia') { p.set('k', st.lenia); p.set('mu', st.mu); p.set('sg', st.sigma); }
  if (st.mode === 'rd') { p.set('k', st.rd); p.set('f', st.feed); p.set('kl', st.kill); }
  if (st.mode !== 'life' && !st.relief) p.set('rl', 0); if (st.speed !== 1) p.set('spd', st.speed); if (!st.beatSeed) p.set('bs', 0);
  p.set('pal', st.palette); if (st.palRev) p.set('rev', 1); if (st.cycleSpeed) p.set('cyc', st.cycleSpeed); if (st.bg !== '#0b0d12') p.set('bg', st.bg.slice(1));
  if (lz !== 1) p.set('lz', +lz.toFixed(3)); if (la) p.set('la', +la.toFixed(4)); MO.encode(p);
  return p.toString(); };
function apply(code) {
  const p = new URLSearchParams(code), m = p.get('m'); if (!INFO[m]) return false;
  clickData('#palettes', 'pal', p.get('pal') || 'aurora'); setCheck('palRev', p.get('rev') === '1'); setRange('cyc', num(p, 'cyc', 0)); clickData('#bg', 'b', '#' + (p.get('bg') || '0b0d12'));
  setRange('speed', num(p, 'spd', 1)); setCheck('beatSeed', p.get('bs') !== '0'); setCheck('trails', p.get('tr') !== '0'); setCheck('round', p.get('rc') !== '0'); setCheck('relief', p.get('rl') !== '0');
  st.seed = clamp(Math.round(num(p, 'seed', 1)), 1, 9999999); st.dens = clamp(num(p, 'd', 0.3), 0, 0.9); $('dens').value = st.dens; $('denso').textContent = Math.round(st.dens * 100) + '%';
  st.cell = clamp(Math.round(num(p, 'cs', 3)), 1, 10); $('cell').value = st.cell; $('cello').textContent = st.cell + ' px';
  if (m === 'life') { if (RTYPE[p.get('r')]) { st.ruleText = p.get('r'); st.rule = p.get('r'); } else { const R0 = parseRule(p.get('r') || 'B3/S23') || parseRule('B3/S23'); st.ruleText = R0.text; st.rule = Object.keys(RULES).find(k => RULES[k][1] === R0.text) || 'custom'; } }
  if (m === 'lenia') { st.lenia = LENIA[p.get('k')] ? p.get('k') : 'tangle'; document.querySelectorAll('#leniaList button').forEach(b => b.classList.toggle('on', b.dataset.p === st.lenia)); setRange('mu', num(p, 'mu', LENIA[st.lenia][0])); setRange('sigma', num(p, 'sg', LENIA[st.lenia][1])); }
  if (m === 'rd') { st.rd = RD[p.get('k')] ? p.get('k') : 'coral'; document.querySelectorAll('#rdList button').forEach(b => b.classList.toggle('on', b.dataset.p === st.rd)); setRange('feed', num(p, 'f', RD[st.rd][0])); setRange('kill', num(p, 'kl', RD[st.rd][1])); }
  pickMode(m); lz = clamp(num(p, 'lz', 1), 1, 8); la = num(p, 'la', 0); MO.decode(p); return true;
}
const share = makeShare('life', encode, apply);
MO.onChange = () => share.touch();
palLabel(); clickData('#leniaList', 'p', 'tangle'); clickData('#rdList', 'p', 'coral');
if (!apply(parseRoute().code)) pickMode('life');
export function start() { running = true; tPrev = performance.now(); if (!S) setup(); dirty = true; requestAnimationFrame(loop); share.write(); }
export function stop() { running = false; REC.stop(); }
export const reset = resetView;
export const layoutChanged = () => { setup(); dirty = true; };
export const showView = code => apply(code);
export const soundHelp = 'Here, each beat flashes the picture (or, with Pulse, zooms in a touch) and, if ticked under Controls, drops a seed somewhere on the grid. Energy sets how fast it grows, vocals gently turn Life and Lenia and nudge reaction–diffusion\'s feed, tempo times everything under Motion, and colour drifts the palette.';
