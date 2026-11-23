// Small WebGL 2 helpers for the explorers that draw with full-screen shaders (Complex Functions, Tilings, Waves, Growing
// Patterns): one triangle covering the canvas, programs built from a fragment shader, float textures and ping-pong pairs
// for simulations that update a picture from the previous one.
const VS = `#version 300 es
in vec2 a; out vec2 vUv;
void main(){ vUv = a*0.5+0.5; gl_Position = vec4(a, 0.0, 1.0); }`;

// ---------- sleeping drawing surfaces ----------
// Browsers keep only so many WebGL contexts alive in a page (16 on desktop Chrome, fewer on phones; headless test browsers
// as few as 2) and silently kill the oldest beyond that. Explorers you've left are kept, detached, so after visiting
// several the first ones came back black. So the shell puts an explorer's drawing surfaces to sleep when you leave it
// (sleepIn, after stop()) and wakes them when you come back (wakeIn, before start()): only the explorer on screen holds a
// context. Each surface registers how it sleeps and wakes; waking is asynchronous (the browser fires webglcontextrestored),
// so whatever it rebuilds must redraw itself then. A sleeping canvas is marked data-asleep, so js/shell/perf.js doesn't
// mistake it for the graphics card failing. Fractals doesn't register: its state is costly to rebuild and it stays awake.
const SLEEPERS = new WeakMap();
/** Register how a canvas's context sleeps and wakes (see above). */
export function sleeper(canvas, sleep, wake) { SLEEPERS.set(canvas, { sleep, wake }); }
const each = (el, k) => { for (const c of el.querySelectorAll('canvas')) { const s = SLEEPERS.get(c); if (s) try { s[k](); } catch (e) { console.warn(e); } } };
export const sleepIn = el => each(el, 'sleep');
export const wakeIn = el => each(el, 'wake');
/** Lose / restore a context through WEBGL_lose_context, marking the canvas while it sleeps. */
export function loseCtl(canvas, g) {
  const ext = g.getExtension('WEBGL_lose_context');
  canvas.addEventListener('webglcontextrestored', () => { delete canvas.dataset.asleep; });
  return { sleep: () => { if (!ext || g.isContextLost()) return; canvas.dataset.asleep = '1'; ext.loseContext(); },
           wake: () => { if (ext && canvas.dataset.asleep) ext.restoreContext(); } };
}
/** Sleep and wake for a three.js renderer. three.js re-sends every mesh, texture and material itself when it wakes, but
 *  starts its clear colour again from black, so the last one set is remembered and put back. */
export function sleepThree(renderer) {
  const canvas = renderer.domElement, c = loseCtl(canvas, renderer.getContext()), set = renderer.setClearColor.bind(renderer);
  let last = null; renderer.setClearColor = (...a) => { last = a; return set(...a); };
  canvas.addEventListener('webglcontextrestored', () => { if (last) set(...last); });   /* after three.js's own handler, added first */
  sleeper(canvas, c.sleep, c.wake);
}

/**
 * A WebGL 2 context on a canvas, or null when the browser has none.
 * prog(fs) builds (and caches) a program; draw(fb, w, h) runs the program in use over a framebuffer (null: the canvas).
 * tex/fbo/pair make float textures (RGBA16F when the card can draw into them, otherwise RGBA8).
 */
export function makeGL(canvas) {
  const g = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, premultipliedAlpha: false });
  if (!g) return null;
  const setup = () => {   // the full-screen triangle and the extensions: again after waking, since a new context has neither
    const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    const ok = !!g.getExtension('EXT_color_buffer_float'); g.getExtension('OES_texture_float_linear'); return ok;
  };
  const floatOK = setup();
  const progs = new Map(), pairs = new Set(), onWake = [];
  const C = { g, canvas, floatOK };
  /** Run fn after the context wakes up and everything here is rebuilt (the explorer redraws). */
  C.onWake = fn => onWake.push(fn);
  // Sleeping keeps what the explorer would miss: programs are rebuilt from their source into the same objects (explorers
  // keep the { p, u } they were given), and every ping-pong pair is read back first and refilled on waking, so a simulation
  // carries on where it was. Lone textures (C.tex, C.fbo) aren't kept: the explorers use them only for a moment.
  const ctl = loseCtl(canvas, g);
  sleeper(canvas, () => {
    if (g.isContextLost()) return;
    for (const P of pairs) { const t = P.a.t, n = P.w * P.h * 4; g.bindFramebuffer(g.FRAMEBUFFER, P.a.fb);
      try { P.saved = t.float ? new Float32Array(n) : new Uint8Array(n); g.readPixels(0, 0, P.w, P.h, g.RGBA, t.float ? g.FLOAT : g.UNSIGNED_BYTE, P.saved); } catch (e) { P.saved = null; } }
    g.bindFramebuffer(g.FRAMEBUFFER, null); ctl.sleep();
  }, ctl.wake);
  canvas.addEventListener('webglcontextlost', e => e.preventDefault());   // asks the browser to let it come back
  canvas.addEventListener('webglcontextrestored', () => {
    setup();
    for (const P of progs.values()) { P.p = build(P.fs); P.loc = {}; }
    for (const P of pairs) { for (const s of [P.a, P.b]) { s.t = C.tex(P.w, P.h, P.opts, P.saved); s.fb = C.fbo(s.t); } P.saved = null; }
    for (const fn of onWake) try { fn(); } catch (e) { console.warn(e); }
  });
  function build(fs) {
    // the shaders are deleted once linked (the program keeps what it needs), and everything is deleted on a failure, so a
    // custom formula that doesn't compile leaves nothing behind on the graphics card
    const p = g.createProgram(), shs = [];
    const fail = msg => { for (const sh of shs) g.deleteShader(sh); g.deleteProgram(p); throw new Error(msg); };
    for (const [t, src] of [[g.VERTEX_SHADER, VS], [g.FRAGMENT_SHADER, fs]]) {
      const sh = g.createShader(t); shs.push(sh); g.shaderSource(sh, src); g.compileShader(sh);
      if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) fail(g.getShaderInfoLog(sh) || 'shader failed');
      g.attachShader(p, sh);
    }
    g.bindAttribLocation(p, 0, 'a'); g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) fail(g.getProgramInfoLog(p) || 'program failed');
    for (const sh of shs) { g.detachShader(p, sh); g.deleteShader(sh); }
    return p;
  }
  C.prog = fs => {
    if (progs.has(fs)) return progs.get(fs);
    const P = { p: build(fs), fs, loc: {} }; P.u = n => (n in P.loc ? P.loc[n] : (P.loc[n] = g.getUniformLocation(P.p, n)));
    progs.set(fs, P); return P;
  };
  /** Forget a program built from this source (to rebuild it, or to free it). */
  C.drop = fs => { const P = progs.get(fs); if (P) { g.deleteProgram(P.p); progs.delete(fs); } };
  /** Run program P over a framebuffer (null: the canvas) of w × h pixels. P must already be in use with its uniforms set. */
  C.draw = (fb, w, h) => { g.bindFramebuffer(g.FRAMEBUFFER, fb); g.viewport(0, 0, w, h); g.drawArrays(g.TRIANGLES, 0, 3); };
  // full: 32-bit floats, for simulations whose steps are smaller than half floats can hold. saved: what a pair held before
  // sleeping (floats for float textures, bytes otherwise)
  C.tex = (w, h, { float = true, full = false, linear = false, data = null } = {}, saved = null) => {
    const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
    const f = linear ? g.LINEAR : g.NEAREST;
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, f); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, f);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
    const fs = saved instanceof Float32Array ? saved : null;
    if (float && floatOK && full) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA32F, w, h, 0, g.RGBA, g.FLOAT, fs);
    else if (float && floatOK) { if (fs) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, w, h, 0, g.RGBA, g.FLOAT, fs); else g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, w, h, 0, g.RGBA, g.HALF_FLOAT, null); }
    else g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, saved instanceof Uint8Array ? saved : data);
    t.w = w; t.h = h; t.float = float && floatOK; return t;
  };
  C.fbo = tex => { const fb = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, fb); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0); g.bindFramebuffer(g.FRAMEBUFFER, null); return fb; };
  /** Two textures that take turns: read from one, draw into the other, then swap. */
  C.pair = (w, h, opts) => {
    const mk = () => { const t = C.tex(w, h, opts); return { t, fb: C.fbo(t) }; };
    const P = { w, h, opts, a: mk(), b: mk() };
    P.swap = () => { const x = P.a; P.a = P.b; P.b = x; };
    P.free = () => { pairs.delete(P); for (const s of [P.a, P.b]) { g.deleteTexture(s.t); g.deleteFramebuffer(s.fb); } };
    pairs.add(P); return P;
  };
  /** Bind a texture to a unit and point a sampler uniform at it. */
  C.bindTex = (P, name, tex, unit) => { g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, tex); g.uniform1i(P.u(name), unit); };
  /** Match the canvas's drawing size to its size on screen × scale. Returns true if it changed. */
  C.fit = (scale = 1) => {
    const r = canvas.getBoundingClientRect(), w = Math.max(1, Math.round(r.width * scale)), h = Math.max(1, Math.round(r.height * scale));
    if (canvas.width === w && canvas.height === h) return false; canvas.width = w; canvas.height = h; return true;
  };
  return C;
}

/** A small explanation on the stage when WebGL 2 isn't available: thrown errors marked shown aren't repeated by the shell. */
export function noWebGL(naEl, what) {
  if (naEl) { naEl.hidden = false; naEl.querySelector('.naT').textContent = `${what} needs WebGL 2`; naEl.querySelector('.naB').textContent = 'This browser or graphics card can\'t draw it. Recent desktop Chrome, Edge, Firefox and Safari can.'; }
  const e = new Error('WebGL 2 is not available'); e.shown = true; return e;
}
