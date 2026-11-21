// Turns spectral frames (frames.js, about 86 a second, each stamped with its audio time) into the few numbers the
// explorers react to. Beat, tempo and phase work happens per frame on the audio clock; the screen only reads the result,
// so it behaves the same at 30, 60 or 144 frames per second.
//
//   bass, voice, treble   0..1, each auto-levelled to the song's own range (loud masters don't pin at the top)
//   voiceSway             -1..1, slow: the vocals and melody rising above (or falling below) their recent level
//   level                 0..1, loudness right now (for the meter)
//   energy                0..1, slow: how big this passage is compared with the song so far (verse vs chorus)
//   beat                  0..1, rises quickly on each hit (harder for bass-heavy hits) and fades over about 0.25 s;
//                         the rise is gentler when the screen is drawing slowly, so it never pops in one frame
//   frameDt               seconds per screen frame, smoothed (explorers soften quick motions when it is large)
//   beatCount             increases by one on each hit
//   bpm, tempoConf        tempo estimate and how sure we are of it (0..1)
//   locked                true when the tempo is steady enough for motion to follow it
//   beats                 musical time in beats at the moment being heard (whole numbers fall on the beat)
//   barOffset             which beat of four starts the bar (0..3)
import { FFT_SIZE, HOP } from './frames.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const ease = (dt, tau) => 1 - Math.exp(-dt / tau);   // fraction of the way to move for time constant tau

/** Features at rest: what explorers see before any music has played. */
export const restingFeatures = () => ({ playing: false, bass: 0, voice: 0, voiceSway: 0, frameDt: 1 / 60, treble: 0, level: 0, energy: 0, beat: 0, beatCount: 0, bpm: 0, tempoConf: 0, locked: false, beats: 0, barOffset: 0 });

// Follows the recent range of a value in dB (top falls slowly, bottom rises slowly) and maps it to 0..1.
class Leveller {
  constructor(minSpan, release) { this.minSpan = minSpan; this.release = release; this.hi = null; this.lo = null; }
  update(v, dt) {
    if (this.hi === null) { this.hi = v; this.lo = v - this.minSpan; }
    this.hi = v > this.hi ? this.hi + (v - this.hi) * ease(dt, 0.05) : this.hi - this.release * dt;
    this.lo = v < this.lo ? this.lo + (v - this.lo) * ease(dt, 0.05) : this.lo + this.release * dt;
    if (this.hi - this.lo < this.minSpan) { const m = (this.hi + this.lo) / 2; this.hi = m + this.minSpan / 2; this.lo = m - this.minSpan / 2; }
    return clamp((v - this.lo) / (this.hi - this.lo), 0, 1);
  }
}

// Exponential running mean and spread.
class RunningStats {
  constructor(tau) { this.tau = tau; this.mean = 0; this.var = 0; this.n = 0; }
  update(x, dt) { const k = this.n++ ? ease(dt, this.tau) : 1; const d = x - this.mean; this.mean += k * d; this.var = (1 - k) * (this.var + k * d * d); }
  get sd() { return Math.sqrt(this.var); }
}

const HISTORY = 8;   // seconds of onset history for the tempo, phase and bar searches

export class Analysis {
  constructor(sampleRate) {
    this.sr = sampleRate; this.hop = HOP / sampleRate; this.rate = sampleRate / HOP;   // frames per second
    this.len = Math.ceil(HISTORY * this.rate);
    this.Lmin = Math.floor(this.rate * 60 / 200); this.Lmax = Math.ceil(this.rate * 60 / 50);   // lags for 50–200 BPM
    this.f = restingFeatures();
    this.hits = null;   // set to [] to record [time, beat position, strength] of every hit (for tests)
    this.reset();
  }

  /** A new song: forget the levels, the tempo and the bar. */
  reset() {
    Object.assign(this.f, restingFeatures());
    this.lev = { bass: new Leveller(12, 1.5), voice: new Leveller(12, 1.5), treble: new Leveller(12, 1.5), level: new Leveller(15, 1.2) };
    this.lowFlux = new RunningStats(2); this.midFlux = new RunningStats(2); this.onset = new RunningStats(1.5); this.loudStats = new RunningStats(40);
    this.envLow = new Float32Array(this.len); this.envMid = new Float32Array(this.len); this.n = 0;
    this.tg = new Float32Array(2 * this.Lmax + 2); this.tgN = 0; this.wLow = 0.65; this.wMid = 0.35;   // accumulated tempo evidence, per lag
    this.o1 = 0; this.o2 = 0; this.low1 = 0; this.lastHit = -1; this.nextEstimate = 0;
    this.cand = null; this.candN = 0; this.slot = [0, 0, 0, 0];
    this.beatPos = 0; this.bpT = 0; this.corr = 0;   // beat clock: beatPos beats at audio time bpT; corr = correction still to glide in
    this.beatRaw = 0; this.voiceSlow = 0; this.voiceMean = 0;
    this.loudSmooth = null; this.tShown = null; this.pausedAt = null; this.skipUntil = -Infinity;
  }

  posAt(t) { return this.beatPos + (t - this.bpT) * this.f.bpm / 60; }

  /** One spectral frame from frames.js. */
  ingest(fr) {
    if (fr.t < this.skipUntil) return;
    const f = this.f, dt = this.hop, t = fr.t;
    const silent = fr.loud < -60;
    for (const [k, up, dn] of [['bass', 0.02, 0.14], ['voice', 0.06, 0.25], ['treble', 0.02, 0.18]]) {
      const v = silent ? 0 : this.lev[k].update(fr[k], dt);
      f[k] += (v - f[k]) * ease(dt, v > f[k] ? up : dn);
    }
    const lv = silent ? 0 : this.lev.level.update(fr.loud, dt); f.level += (lv - f.level) * ease(dt, lv > f.level ? 0.03 : 0.2);
    // energy: this passage's loudness against the song's long-run average and spread (about the last 40 s)
    if (!silent) { this.loudSmooth = this.loudSmooth === null ? fr.loud : this.loudSmooth + (fr.loud - this.loudSmooth) * ease(dt, 1.5); this.loudStats.update(this.loudSmooth, dt); }
    const en = silent || this.loudSmooth === null ? 0 : clamp(0.5 + (this.loudSmooth - this.loudStats.mean) / (2.5 * Math.max(1.5, this.loudStats.sd)), 0, 1);
    f.energy += (en - f.energy) * ease(dt, 0.6);

    // onsets: how fast the spectrum rises, low end weighted for kicks
    this.lowFlux.update(fr.lf, dt); this.midFlux.update(fr.mf, dt);
    const low = silent ? 0 : fr.lf / (this.lowFlux.mean + 1e-6), mid = silent ? 0 : fr.mf / (this.midFlux.mean + 1e-6);
    const o = 0.65 * low + 0.35 * mid;
    // a peak in the onset curve one frame ago, well above the recent level, is a hit. Its punch grows with how far above
    // the threshold it is and how much of it is bass, so kicks hit hard and hi-hats barely register.
    const thr = this.onset.mean + 2 * this.onset.sd;
    if (this.o1 > thr && this.o1 > 1.6 && this.o1 >= this.o2 && this.o1 >= o && t - dt - this.lastHit > 0.12) {
      const rel = (this.o1 - thr) / (thr + 1e-6);
      this.hit(t - dt, clamp(0.3 + 0.6 * rel, 0, 1) * (0.45 + 0.55 * clamp(this.low1 / 2, 0, 1)));
    }
    this.onset.update(o, dt);
    this.o2 = this.o1; this.o1 = o; this.low1 = low;

    // onset history for tempo, phase and bar
    const i = this.n++ % this.len; this.envLow[i] = low; this.envMid[i] = mid;
    if (f.bpm) { this.beatPos = this.posAt(t); this.bpT = t; const d = this.corr * ease(dt, 0.35); this.beatPos += d; this.corr -= d; }   // corrections glide in over ~0.35 s
    if (t >= this.nextEstimate) { this.nextEstimate = t + 0.5; this.estimateTempo(t); if (f.bpm) { this.alignPhase(t); this.alignBar(t); } }
  }

  hit(t, strength) {
    const f = this.f; this.lastHit = t; f.beatCount++;
    this.beatRaw = Math.max(this.beatRaw, strength);
    if (this.hits) this.hits.push([t, f.bpm ? this.posAt(t) : NaN, strength]);
    if (!f.bpm) return;
    // a strong hit close to a beat nudges the clock a little between the twice-a-second phase checks
    const bp = this.posAt(t), err = Math.round(bp) - bp;
    if (Math.abs(err) < 0.15 && strength > 0.5) this.corr += err * 0.1;
  }

  /** Playback paused at audio time t (the audio clock keeps running, the music doesn't). */
  pause(t) { if (this.pausedAt === null) this.pausedAt = t; }
  /**
   * Playback started or resumed at audio time t. After a pause, move the beat clock and the schedule along by its length.
   * Either way, ignore frames until the analysis window holds only fresh audio: a window that jumps from silence to
   * music reads as one huge false hit, which would swamp the beat and tempo search for seconds.
   */
  resume(t) {
    if (this.pausedAt !== null) { const d = t - this.pausedAt; this.bpT += d; this.nextEstimate += d; this.lastHit += d; this.pausedAt = null; }
    this.skipUntil = t + (FFT_SIZE / 2 + 2 * HOP) / this.sr + 0.05;
  }

  /** Once per screen frame: t is the audio clock now, latency how much later the sound reaches the ears. */
  update(t, playing, latency = 0) {
    const f = this.f, dt = this.tShown === null ? 1 / 60 : clamp(t - this.tShown, 0, 0.1); this.tShown = t;
    f.playing = playing;
    if (dt > 0) f.frameDt += (dt - f.frameDt) * ease(dt, 0.5);
    // the punch: the hit's raw envelope fades over 0.25 s; what explorers see rises towards it over at least ~1.5 frames
    this.beatRaw *= Math.exp(-dt / 0.25);
    f.beat += (this.beatRaw - f.beat) * ease(dt, this.beatRaw > f.beat ? Math.max(0.035, 1.5 * f.frameDt) : 0.06);
    // vocals as a slow sway around their own recent level
    this.voiceSlow += (f.voice - this.voiceSlow) * ease(dt, 0.5); this.voiceMean += (f.voice - this.voiceMean) * ease(dt, 8);
    f.voiceSway = playing ? clamp((this.voiceSlow - this.voiceMean) * 3, -1, 1) : f.voiceSway * (1 - ease(dt, 0.3));
    if (!playing) {   // paused or stopped: settle to rest, keep the tempo for when playback resumes
      const k = ease(dt || 1 / 60, 0.3);
      for (const key of ['bass', 'voice', 'treble', 'level', 'energy']) f[key] -= f[key] * k;
      f.locked = false; return f;
    }
    // musical time at the moment being heard, plus one frame for the picture to reach the screen
    if (f.bpm) f.beats = this.posAt(t - latency + 0.016);
    f.locked = f.bpm > 0 && f.tempoConf > 0.5;
    return f;
  }

  // the history, oldest first, as [value above the mean, beat position] for samples above the mean.
  // The onset value is wl × the bass onsets + wm × the mid/high onsets.
  *recent(tNow, wl, wm) {
    const N = Math.min(this.n, this.len), at = j => { const i = (this.n - N + j) % this.len; return wl * this.envLow[i] + wm * this.envMid[i]; };
    let m = 0; for (let j = 0; j < N; j++) m += at(j); m /= N || 1;
    for (let j = 0; j < N; j++) {
      const x = at(j) - m; if (x <= 0) continue;
      yield [x, this.posAt(tNow - (N - 1 - j) * this.hop)];
    }
  }

  // Autocorrelation of one onset curve over the history, normalised, plus how clearly it shows a pulse (peak / average).
  pulseCurve(buf) {
    const N = Math.min(this.n, this.len), x = new Float32Array(N); let m = 0;
    for (let j = 0; j < N; j++) { x[j] = buf[(this.n - N + j) % this.len]; m += x[j]; } m /= N;
    let e0 = 0; for (let j = 0; j < N; j++) { x[j] -= m; e0 += x[j] * x[j]; } if (e0 < 1e-9) return null;
    const A = new Float32Array(this.tg.length), top = Math.min(A.length - 1, N - 1);
    for (let L = this.Lmin - 1; L <= top; L++) { let s = 0; for (let j = L; j < N; j++) s += x[j] * x[j - L]; A[L] = s / e0; }
    let pk = 0, sum = 0; for (let L = this.Lmin; L <= this.Lmax; L++) { pk = Math.max(pk, A[L]); sum += Math.abs(A[L]); }
    return pk > 0 ? { A, pk, clarity: pk / (sum / (this.Lmax - this.Lmin + 1) + 1e-9) } : null;
  }

  // The tempo a lag curve G favours: weighted towards common tempos, with support from half the tempo, refined between lags.
  pickTempo(G) {
    let best = 0, bestL = 0;
    for (let L = this.Lmin; L <= this.Lmax; L++) {
      const bpm = 60 * this.rate / L, w = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
      const s = w * (G[L] + 0.5 * Math.max(0, G[2 * L] || 0));
      if (s > best) { best = s; bestL = L; }
    }
    if (!bestL) return 0;
    const a = G[bestL - 1], b = G[bestL], c = G[bestL + 1];
    const off = (a - 2 * b + c) ? clamp(0.5 * (a - c) / (a - 2 * b + c), -0.5, 0.5) : 0;
    // measured where the evidence is strongest, then folded into 85–170 BPM so motion speeds are predictable from song to
    // song (a 69 BPM pulse becomes 138; a 180 BPM one, 90). Folding keeps the precision of the strong peak.
    let bpm = 60 * this.rate / (bestL + off);
    while (bpm < 85) bpm *= 2;
    while (bpm >= 170) bpm /= 2;
    return bpm;
  }

  // Tempo. Songs carry their pulse in different places (kick drum, or snare, chords and voice), so the bass and the
  // mid/high onsets each get an autocorrelation, weighted by how clearly each shows a pulse right now. The result is
  // accumulated over several seconds (a smoothed tempogram) rather than decided afresh from each short window, and
  // confidence is how consistently recent windows agree with the tempo (half, double and 2:3 count as agreeing),
  // which carries across songs with strong or soft beats alike.
  estimateTempo(t) {
    const f = this.f; if (Math.min(this.n, this.len) < 3 * this.rate) return;
    const lo = this.pulseCurve(this.envLow), mi = this.pulseCurve(this.envMid);
    const wl = lo ? Math.max(0, lo.clarity - 1.5) ** 2 : 0, wm = mi ? Math.max(0, mi.clarity - 1.5) ** 2 : 0;
    if (wl + wm <= 0) { f.tempoConf -= f.tempoConf * 0.15; return; }   // no pulse in this stretch
    this.wLow += (wl / (wl + wm) - this.wLow) * 0.2; this.wMid = 1 - this.wLow;
    const C = new Float32Array(this.tg.length);
    for (let L = this.Lmin - 1; L < C.length; L++) C[L] = ((lo ? wl * lo.A[L] / lo.pk : 0) + (mi ? wm * mi.A[L] / mi.pk : 0)) / (wl + wm);
    for (let L = 0; L < C.length; L++) this.tg[L] = 0.9 * this.tg[L] + 0.1 * C[L];
    this.tgN++;

    const now = this.pickTempo(C), acc = this.pickTempo(this.tg); if (!acc) return;
    const rel = (a, b, ms) => ms.find(m => Math.abs(a / (b * m) - 1) < 0.04);
    if (!f.bpm) {
      // after a couple of seconds of evidence, start the clock on the last hit
      if (this.tgN >= 4) { f.bpm = acc; this.beatPos = (t - this.lastHit) * acc / 60; this.bpT = t; }
    } else {
      const m = rel(acc, f.bpm, [1, 0.5, 2]);
      if (m) { f.bpm += (acc / m - f.bpm) * 0.2; this.candN = 0; }   // the same tempo (or an octave of it): refine
      else {
        // a different tempo has to win the accumulated evidence for about 3 s before we switch (the beat position carries on)
        if (this.cand && Math.abs(acc / this.cand - 1) < 0.04) this.candN++; else { this.cand = acc; this.candN = 1; }
        if (this.candN >= 6) { this.beatPos = this.posAt(t); this.bpT = t; f.bpm = acc; this.candN = 0; }
      }
    }
    f.tempoConf += ((f.bpm && now && rel(now, f.bpm, [1, 0.5, 2, 2 / 3, 1.5]) ? 1 : 0) - f.tempoConf) * 0.15;
  }

  // Beat phase: fold the last 8 s of onsets over one beat and nudge the clock so that the biggest pile sits on the beat.
  // Kicks and snares pile up on the beat; in-between notes make smaller piles that don't win. Weighted towards the bass
  // like the hit detector, so the clock and the punches agree on where the beat is (tested on 17 songs).
  alignPhase(t) {
    const K = 48, H = new Float32Array(K);
    for (const [x, bp] of this.recent(t, 0.65, 0.35)) H[Math.floor((((bp % 1) + 1) % 1) * K) % K] += x;
    const S = H.map((_, k) => H[(k + K - 1) % K] + 2 * H[k] + H[(k + 1) % K]);
    let k = 0; for (let i = 1; i < K; i++) if (S[i] > S[k]) k = i;
    const mean = S.reduce((s, v) => s + v, 0) / K; if (mean <= 0 || S[k] < 1.4 * mean) return;   // no clear pulse right now
    const a = S[(k + K - 1) % K], b = S[k], c = S[(k + 1) % K], off = (a - 2 * b + c) ? clamp(0.5 * (a - c) / (a - 2 * b + c), -0.5, 0.5) : 0;
    let ph = (k + 0.5 + off) / K; if (ph > 0.5) ph -= 1;
    this.corr -= clamp(ph * 0.5, -0.06, 0.06);   // small steps (glided in): a passing off-beat pile can't walk the grid half a beat
  }

  // Bar: of the four beats in a bar, the one where the bass hits hardest (folded over the last 8 s and remembered over
  // many checks) is taken as the first. It changes only when another beat is clearly stronger.
  alignBar(t) {
    const acc = [0, 0, 0, 0];
    for (const [x, bp] of this.recent(t, 1, 0)) { const r = Math.round(bp); if (Math.abs(bp - r) < 0.15) acc[((r % 4) + 4) % 4] += x; }
    const top = Math.max(...acc); if (top <= 0) return;
    for (let i = 0; i < 4; i++) this.slot[i] = 0.93 * this.slot[i] + 0.07 * acc[i] / top;
    const best = this.slot.indexOf(Math.max(...this.slot));
    if (this.slot[best] > 1.3 * this.slot[this.f.barOffset]) this.f.barOffset = best;
  }
}
