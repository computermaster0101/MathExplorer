// Panning and zooming a flat picture: drag to move, wheel or pinch to zoom where the pointer is, and the driving keys
// (arrows and W A S D, at the shared Navigation speed). Used by Complex Functions, Tilings and Strange Attractors (Waves and Growing Patterns scroll with their own offsets).
import { LOOP } from './seamless.js';
import { drive } from '../shell/keys.js';

/**
 * A view of the plane on a canvas: centre (cx, cy), scale = half the canvas height, in world units, and rot, how far the
 * view is turned (radians; a shader turns its screen offset by rot before scaling it).
 * opts: home {cx, cy, scale}, min/max scale, onChange() after any move, onTap(x, y) for a click without a drag
 * (world coordinates), wrap: false to keep x/y unbounded. step(dt) applies the driving keys; returns true if it moved.
 */
export function makeView2D(canvas, opts = {}) {
  const home = { cx: 0, cy: 0, scale: 1.5, ...(opts.home || {}) }, minS = opts.min ?? 1e-13, maxS = opts.max ?? 1e5;
  const v = { cx: home.cx, cy: home.cy, scale: home.scale, rot: 0, beat: 1, home: { ...home }, enabled: true };
  /** The scale as drawn: beat is the music's pulse (a little below 1 on a beat), applied only when drawing. */
  v.eff = () => v.scale * v.beat;
  const turnBy = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const changed = () => opts.onChange && opts.onChange();
  const rect = () => canvas.getBoundingClientRect();
  /** World coordinates of a point on the page (clientX, clientY). */
  v.toWorld = (px, py) => { const r = rect(), s = v.eff() / (r.height / 2), [x, y] = turnBy((px - r.left - r.width / 2) * s, -(py - r.top - r.height / 2) * s, v.rot); return [v.cx + x, v.cy + y]; };
  /** Page coordinates of a world point. */
  v.toScreen = (x, y) => { const r = rect(), s = (r.height / 2) / v.eff(), [a, b] = turnBy(x - v.cx, y - v.cy, -v.rot); return [r.left + r.width / 2 + a * s, r.top + r.height / 2 - b * s]; };
  v.zoomAt = (f, px, py) => {
    const ns = Math.min(maxS, Math.max(minS, v.scale * f)); f = ns / v.scale;
    const [wx, wy] = px == null ? [v.cx, v.cy] : v.toWorld(px, py);
    v.cx = wx + (v.cx - wx) * f; v.cy = wy + (v.cy - wy) * f; v.scale = ns; changed();
  };
  /** Move the picture by a drag of dx, dy screen pixels (the picture follows the pointer). */
  v.pan = (dx, dy) => { const s = v.scale / (rect().height / 2), [x, y] = turnBy(-dx * s, dy * s, v.rot); v.cx += x; v.cy += y; changed(); };
  /** Move the view itself by dx, dy screen heights (right and up as seen on screen); for the Motion group's drift. */
  v.glide = (dx, dy) => { const h = rect().height; v.pan(-dx * h, dy * h); };
  /** Zoom by f about the middle; false if it was already at the limit. */
  v.zoomBy = f => { const ns = Math.min(maxS, Math.max(minS, v.scale * f)); if (Math.abs(ns - v.scale) < 1e-15 * v.scale) return false; v.scale = ns; changed(); return true; };
  /** Turn the view by a radians. */
  v.rotate = a => { v.rot = (v.rot + a) % (2 * Math.PI); changed(); };
  // the home view fits the shorter side, so on a phone held upright it isn't cut off at the left and right
  v.reset = () => { const r = rect(), k = r.width > 0 && r.height > r.width ? r.height / r.width : 1; Object.assign(v, { cx: v.home.cx, cy: v.home.cy, scale: v.home.scale * k, rot: 0 }); changed(); };
  v.set = (cx, cy, scale) => { Object.assign(v, { cx, cy, scale: Math.min(maxS, Math.max(minS, scale)) }); changed(); };
  v.step = dt => { if (LOOP.on) return false;   /* a seamless loop being made: keys don't move it (js/common/seamless.js) */
    const k = drive(); if (!k.any || !v.enabled) return false;
    const cl = x => Math.max(-1, Math.min(1, x)), x = cl(k.slideX + k.turnX), y = cl(k.slideY + k.rawY); if (!x && !y) return false;
    const px = 0.5 * rect().height * (k.fast ? 3 : 1) * k.scale * dt; v.pan(-x * px, y * px); return true;
  };
  // pointers
  const ptr = new Map(); let pinch = 0, moved = 0, down = null;
  canvas.addEventListener('pointerdown', e => { if (!v.enabled) return; canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; down = { x: e.clientX, y: e.clientY }; v.dragging = true; });
  canvas.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId)) return; const p = ptr.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptr.size === 1) { moved += Math.abs(dx) + Math.abs(dy); if (opts.onDrag && opts.onDrag(e, dx, dy)) return; v.pan(dx, dy); }
    else if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) v.zoomAt(pinch / d, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch = d; moved = 99; }
  });
  const up = e => {
    if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); if (ptr.size < 2) pinch = 0;
    if (!ptr.size) { v.dragging = false; if (moved < 5 && down && opts.onTap) { const [x, y] = v.toWorld(down.x, down.y); opts.onTap(x, y, e); } }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { if (!v.enabled) return; e.preventDefault(); v.zoomAt(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
  v.pointers = ptr;
  return v;
}
