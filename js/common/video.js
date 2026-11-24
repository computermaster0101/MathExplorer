// Writing a video file frame by frame, each at its exact moment (for seamless loops, js/common/seamless.js).
// MediaRecorder stamps frames with the wall clock, so a frame that took half a second to draw would last half a second
// in the film; here the browser's own encoder (WebCodecs) takes frames with their times, and the file around them is
// written by hand: MP4 with H.264 (plays everywhere, and what Instagram, YouTube and phones expect) or, where the
// browser can't encode H.264, WebM with VP9 or VP8. No sound: a loop has none.

const enc = new TextEncoder();
const cat = parts => { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };
const u8 = (...a) => Uint8Array.from(a);
const u16 = v => u8(v >>> 8 & 255, v & 255);
const u32 = v => u8(v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
const i32 = v => u32(v >>> 0);
const str = s => enc.encode(s);
const zeros = n => new Uint8Array(n);

// ---------- MP4 (ISO base media file) ----------
const box = (type, ...parts) => { const body = cat(parts); return cat([u32(body.length + 8), str(type), body]); };
const full = (type, version, flags, ...parts) => box(type, u8(version, flags >>> 16 & 255, flags >>> 8 & 255, flags & 255), ...parts);
const MATRIX = cat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);
function mp4(samples, avcC, w, h, fps) {
  const N = samples.length, TS = fps * 1000, D = 1000, dur = N * D, ms = Math.round(N * 1000 / fps);
  const ftyp = box('ftyp', str('isom'), u32(512), str('isom'), str('iso2'), str('avc1'), str('mp41'));
  const data = cat(samples.map(s => s.data));
  const mdatHead = cat([u32(data.length + 8), str('mdat')]);
  const offset = ftyp.length + mdatHead.length;
  // composition offsets, only if the encoder reordered frames (B-frames)
  const ctsOff = samples.map((s, i) => Math.round(s.ts * TS / 1e6) - i * D), reordered = ctsOff.some(x => x !== 0);
  const stbl = box('stbl',
    full('stsd', 0, 0, u32(1), box('avc1', zeros(6), u16(1), zeros(16), u16(w), u16(h), u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x18), u16(0xffff), box('avcC', avcC))),
    full('stts', 0, 0, u32(1), u32(N), u32(D)),
    ...(reordered ? [full('ctts', 1, 0, u32(N), ...ctsOff.flatMap(x => [u32(1), i32(x)]))] : []),
    full('stss', 0, 0, u32(samples.filter(s => s.key).length), ...samples.flatMap((s, i) => (s.key ? [u32(i + 1)] : []))),
    full('stsc', 0, 0, u32(1), u32(1), u32(N), u32(1)),
    full('stsz', 0, 0, u32(0), u32(N), ...samples.map(s => u32(s.data.length))),
    full('stco', 0, 0, u32(1), u32(offset)));
  const minf = box('minf', full('vmhd', 0, 1, zeros(8)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
  const mdia = box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(TS), u32(dur), u16(0x55c4), u16(0)),
    full('hdlr', 0, 0, u32(0), str('vide'), zeros(12), str('Video\0')), minf);
  const trak = box('trak', full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(ms), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(w << 16), u32(h << 16)), mdia);
  const moov = box('moov', full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(ms), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(2)), trak);
  return new Blob([ftyp, mdatHead, data, moov], { type: 'video/mp4' });
}

// ---------- WebM (Matroska) ----------
const vsize = n => { const b = new Uint8Array(8); b[0] = 1; let v = n; for (let i = 7; i >= 1; i--) { b[i] = v % 256; v = Math.floor(v / 256); } return b; };   // 8-byte size
const idb = id => { const a = []; let v = id; while (v > 0) { a.unshift(v & 255); v = Math.floor(v / 256); } return Uint8Array.from(a); };
const el = (id, ...parts) => { const body = cat(parts); return cat([idb(id), vsize(body.length), body]); };
const uint = (id, v) => { const a = []; let x = v; do { a.unshift(x & 255); x = Math.floor(x / 256); } while (x > 0); return el(id, Uint8Array.from(a)); };
const f64 = (id, v) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return el(id, b); };
function webm(samples, codec, w, h, fps) {
  const head = el(0x1A45DFA3, uint(0x4286, 1), uint(0x42F7, 1), uint(0x42F2, 4), uint(0x42F3, 8), el(0x4282, str('webm')), uint(0x4287, 4), uint(0x4285, 2));
  const info = el(0x1549A966, uint(0x2AD7B1, 1000000), el(0x4D80, str('Math Explorer')), el(0x5741, str('Math Explorer')), f64(0x4489, samples.length * 1000 / fps));
  const tracks = el(0x1654AE6B, el(0xAE, uint(0xD7, 1), uint(0x73C5, 1), uint(0x83, 1), el(0x86, str(codec)), uint(0x23E383, Math.round(1e9 / fps)), el(0xE0, uint(0xB0, w), uint(0xBA, h))));
  const clusters = []; let cur = null, base = 0;
  samples.forEach((s, i) => { const t = Math.round(i * 1000 / fps);
    if (!cur || s.key || t - base > 30000) { if (cur) clusters.push(el(0x1F43B675, ...cur)); base = t; cur = [uint(0xE7, t)]; }
    const rel = t - base; cur.push(el(0xA3, u8(0x81, rel >> 8 & 255, rel & 255, s.key ? 0x80 : 0), s.data)); });
  if (cur) clusters.push(el(0x1F43B675, ...cur));
  return new Blob([head, el(0x18538067, info, tracks, ...clusters)], { type: 'video/webm' });
}

// ---------- the writer ----------
const H264 = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42e01f'];
const VPX = [['vp09.00.40.08', 'V_VP9'], ['vp8', 'V_VP8']];
/** Whether this browser can write frame-exact video (WebCodecs). */
export const canWriteFrames = () => typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';
/**
 * A writer for a w × h film at fps frames a second, or null when the browser can't encode one.
 * add(canvas, i): frame i is what canvas shows now. finish(): the file, as a Blob. close(): give up.
 */
export async function videoWriter(w, h, fps, bitrate) {
  if (!canWriteFrames()) return null;
  const base = { width: w, height: h, bitrate, framerate: fps };
  let cfg = null, kind = '', track = '';
  for (const codec of H264) { const c = { ...base, codec, avc: { format: 'avc' } }; try { if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; kind = 'mp4'; break; } } catch (e) { /* not this one */ } }
  if (!cfg) for (const [codec, id] of VPX) { const c = { ...base, codec }; try { if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; kind = 'webm'; track = id; break; } } catch (e) { /* not this one */ } }
  if (!cfg) return null;
  const samples = []; let avcC = null, failed = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => { const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data); samples.push({ data, key: chunk.type === 'key', ts: chunk.timestamp });
      if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcC) { const d = meta.decoderConfig.description; avcC = new Uint8Array(d.buffer ? d.buffer.slice(d.byteOffset || 0, (d.byteOffset || 0) + d.byteLength) : d); } },
    error: e => { failed = e; } });
  encoder.configure(cfg);
  const step = 1e6 / fps;
  return {
    ext: kind, codec: cfg.codec,
    async add(canvas, i) {
      if (failed) throw failed;
      while (encoder.encodeQueueSize > 3) await new Promise(r => setTimeout(r, 2));
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * step), duration: Math.round(step) });
      try { encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 }); } finally { frame.close(); }
    },
    async finish() {
      await encoder.flush(); encoder.close(); if (failed) throw failed;
      if (kind === 'mp4') { if (!avcC) throw new Error('The encoder gave no H.264 settings'); return mp4(samples, avcC, w, h, fps); }
      return webm(samples, track, w, h, fps);
    },
    close() { try { encoder.close(); } catch (e) { /* already closed */ } },
  };
}
