// Spectral frames at a fixed hop, straight from the samples, so the analysis never depends on the screen's frame rate.
// Used inside an AudioWorklet (frames-worklet.js), by a ScriptProcessor fallback (engine.js), and by tests.
//
// Each frame: { t, bass, voice, treble, loud, lf, mf }
//   t                   audio time (s) at the centre of the analysed window
//   bass, voice, treble band levels in dB (absolute level doesn't matter: analysis.js auto-levels them)
//   loud                loudness of the window in dB
//   lf, mf              spectral flux (how much the spectrum rose since the last frame) in the low and mid/high ranges

export const FFT_SIZE = 2048, HOP = 512;
const BANDS = { bass: [30, 150], voice: [250, 3500], treble: [5000, 12000] };

export class FrameMaker {
  constructor(sampleRate) {
    this.sr = sampleRate; const N = FFT_SIZE, half = N / 2, bw = sampleRate / N;
    this.ring = new Float32Array(N); this.pos = 0; this.since = 0; this.filled = 0;
    this.win = new Float32Array(N); for (let i = 0; i < N; i++) this.win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    this.re = new Float64Array(N); this.im = new Float64Array(N); this.db = new Float32Array(half); this.prev = new Float32Array(half).fill(-100);
    this.rev = new Uint32Array(N); for (let i = 0, bits = Math.log2(N); i < N; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); this.rev[i] = r; }
    this.cos = new Float64Array(half); this.sin = new Float64Array(half); for (let i = 0; i < half; i++) { this.cos[i] = Math.cos(2 * Math.PI * i / N); this.sin[i] = -Math.sin(2 * Math.PI * i / N); }
    const bin = f => Math.max(1, Math.min(half - 1, Math.round(f / bw)));
    this.bins = {}; for (const [k, [lo, hi]] of Object.entries(BANDS)) this.bins[k] = [bin(lo), bin(hi)];
    this.low = [bin(30), bin(150)]; this.mid = [bin(150), bin(8000)];
    this.norm = 4 / (N * N);   // so a full-scale sine reads about 0 dB (with the Hann window)
  }

  /** Add mono samples; t0 is the audio time of samples[0]. Returns the frames completed by these samples. */
  push(samples, t0) {
    const out = [], N = FFT_SIZE;
    for (let i = 0; i < samples.length; i++) {
      this.ring[this.pos] = samples[i]; this.pos = (this.pos + 1) % N; if (this.filled < N) this.filled++;
      if (++this.since >= HOP) { this.since = 0; if (this.filled === N) out.push(this.frame(t0 + (i + 1) / this.sr - N / 2 / this.sr)); }
    }
    return out;
  }

  frame(t) {
    const N = FFT_SIZE, half = N / 2, re = this.re, im = this.im, rev = this.rev;
    let rms = 0;
    for (let i = 0; i < N; i++) { const x = this.ring[(this.pos + i) % N]; rms += x * x; re[rev[i]] = x * this.win[i]; im[rev[i]] = 0; }
    // iterative radix-2 FFT
    for (let size = 2; size <= N; size <<= 1) {
      const h = size >> 1, step = N / size;
      for (let s = 0; s < N; s += size) for (let j = 0; j < h; j++) {
        const k = j * step, wr = this.cos[k], wi = this.sin[k], a = s + j, b = a + h;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
    const db = this.db; for (let k = 0; k < half; k++) db[k] = Math.max(-100, 10 * Math.log10((re[k] * re[k] + im[k] * im[k]) * this.norm + 1e-12));
    const band = ([a, b]) => { let s = 0; for (let k = a; k <= b; k++) s += Math.pow(10, db[k] / 10); return 10 * Math.log10(s / (b - a + 1) + 1e-12); };
    const flux = ([a, b]) => { let s = 0; for (let k = a; k <= b; k++) { const d = db[k] - this.prev[k]; if (d > 0) s += d; } return s / (b - a + 1); };
    const fr = { t, bass: band(this.bins.bass), voice: band(this.bins.voice), treble: band(this.bins.treble), loud: 10 * Math.log10(rms / N + 1e-12), lf: flux(this.low), mf: flux(this.mid) };
    this.prev.set(db);
    return fr;
  }
}
