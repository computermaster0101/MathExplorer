// Small WebGL 2 helpers for the explorers that draw with full-screen shaders (Complex Functions, Tilings, Waves, Growing
// Patterns): one triangle covering the canvas, programs built from a fragment shader, float textures and ping-pong pairs
// for simulations that update a picture from the previous one.
const VS = `#version 300 es
in vec2 a; out vec2 vUv;
void main(){ vUv = a*0.5+0.5; gl_Position = vec4(a, 0.0, 1.0); }`;

/**
 * A WebGL 2 context on a canvas, or null when the browser has none.
 * prog(fs) builds (and caches) a program; draw(fb, w, h) runs the program in use over a framebuffer (null: the canvas).
 * tex/fbo/pair make float textures (RGBA16F when the card can draw into them, otherwise RGBA8).
 */
export function makeGL(canvas) {
  const g = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, premultipliedAlpha: false });
  if (!g) return null;
  const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf);
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
  g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
  const floatOK = !!g.getExtension('EXT_color_buffer_float');
  g.getExtension('OES_texture_float_linear');
  const progs = new Map();
  const C = { g, canvas, floatOK };
  C.prog = fs => {
    if (progs.has(fs)) return progs.get(fs);
    const p = g.createProgram();
    for (const [t, src] of [[g.VERTEX_SHADER, VS], [g.FRAGMENT_SHADER, fs]]) {
      const sh = g.createShader(t); g.shaderSource(sh, src); g.compileShader(sh);
      if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(sh) || 'shader failed');
      g.attachShader(p, sh);
    }
    g.bindAttribLocation(p, 0, 'a'); g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p) || 'program failed');
    const loc = {}, P = { p, u: n => (n in loc ? loc[n] : (loc[n] = g.getUniformLocation(p, n))) };
    progs.set(fs, P); return P;
  };
  /** Forget a program built from this source (to rebuild it, or to free it). */
  C.drop = fs => { const P = progs.get(fs); if (P) { g.deleteProgram(P.p); progs.delete(fs); } };
  /** Run program P over a framebuffer (null: the canvas) of w × h pixels. P must already be in use with its uniforms set. */
  C.draw = (fb, w, h) => { g.bindFramebuffer(g.FRAMEBUFFER, fb); g.viewport(0, 0, w, h); g.drawArrays(g.TRIANGLES, 0, 3); };
  C.tex = (w, h, { float = true, full = false, linear = false, data = null } = {}) => {   // full: 32-bit floats, for simulations whose steps are smaller than half floats can hold
    const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
    const f = linear ? g.LINEAR : g.NEAREST;
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, f); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, f);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
    if (float && floatOK && full) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA32F, w, h, 0, g.RGBA, g.FLOAT, null);
    else if (float && floatOK) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, w, h, 0, g.RGBA, g.HALF_FLOAT, null);
    else g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, data);
    t.w = w; t.h = h; t.float = float && floatOK; return t;
  };
  C.fbo = tex => { const fb = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, fb); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0); g.bindFramebuffer(g.FRAMEBUFFER, null); return fb; };
  /** Two textures that take turns: read from one, draw into the other, then swap. */
  C.pair = (w, h, opts) => {
    const mk = () => { const t = C.tex(w, h, opts); return { t, fb: C.fbo(t) }; };
    const P = { w, h, a: mk(), b: mk() };
    P.swap = () => { const x = P.a; P.a = P.b; P.b = x; };
    P.free = () => { for (const s of [P.a, P.b]) { g.deleteTexture(s.t); g.deleteFramebuffer(s.fb); } };
    return P;
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
