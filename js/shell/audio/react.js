// What explorers use to move with the music. Each helper already respects the Sound panel's switches and strength,
// and returns a neutral value (0, or 1 for multipliers) when the music is off or that reaction is switched off.
//
//   flash()         0..1   a flash of light on each hit (Beats, when 'On each beat' is Flash)
//   pulse()         0..1   a pulse of the shape itself on each hit (Beats, when 'On each beat' is Pulse the shape)
//   voice()         -1..1  vocals and melody as a slow sway around their recent level (Vocals)
//   shimmer()       0..1   treble (Colour)
//   energyMul()     ~0.5..1.5, a speed multiplier: calm passages slower, big ones faster (Energy)
//   colourStep(dt)  how far to advance the palette this frame: treble shimmer, plus a shift on each new bar (Colour)
//   tempoLocked()   true when motion should follow the tempo (Tempo, and a steady beat was found)
//   new Phase()     a periodic motion (breathe, sweep…) that lands its cycles on bar lines when the tempo is locked
//   new Groove()    an advancing motion (turning…) that surges on each beat and settles in between
//
// The newer explorers read the beat through flashFx / pulseFx / voiceFx, which grow with the Intensity setting (Calm is
// exactly flash / pulse / voice; Lively and Wild react bigger, more so in loud passages and just after a drop, and let the
// bass level itself breathe the picture). Fractals and Polytopes keep reading flash / pulse / voice, so Intensity
// doesn't change them.
//   kick(), snare() 0..1   hits carried by the bass, or by the mids
//   lift()          0..1   jumps at a drop, fades over about two seconds
//   new Director()  step(dt) returns 'phrase' every eight bars (about every 20 s without a steady beat), 'drop' or 'calm'
//                   when the song changes section, otherwise null: the Visualizer changes the scene on these
import * as engine from './engine.js';
import { LOOP, loopRate } from '../../common/seamless.js';
import { calm } from '../calm.js';   // Calm motion: no flashing on the beat
const { player } = engine;

const KEY = 'mathexplorer.sound';
const DEFAULTS = { on: true, amount: 1, beats: true, beatStyle: 'flash', tempo: true, vocals: true, colour: true, energy: true, bars: 2, intensity: 'calm' };
export const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* storage blocked: defaults */ }
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* not saved */ } }

const f = () => engine.features;   // the live object (re-created when the audio context first starts)
const live = () => settings.on && player.playing && !LOOP.on;   // a seamless loop being made ignores the music (js/common/seamless.js)
const amt = () => settings.amount;

export const reacting = () => live();
const beat = () => (live() && settings.beats ? Math.min(1.5, f().beat * amt()) : 0);
export const flash = () => (settings.beatStyle === 'pulse' || calm() ? 0 : beat());
export const pulse = () => (settings.beatStyle === 'pulse' ? beat() : 0);
export const voice = () => (live() && settings.vocals ? Math.max(-1.5, Math.min(1.5, f().voiceSway * amt())) : 0);
export const shimmer = () => (live() && settings.colour ? Math.min(1.5, f().treble * amt()) : 0);
export const energyMul = () => (live() && settings.energy ? 1 + (f().energy - 0.5) * Math.min(2, amt()) : 1);
export const tempoLocked = () => live() && settings.tempo && f().locked;
/** Beats per cycle for slow periodic motions, from the "one cycle every N bars" setting, times an optional factor. */
export const cycleBeats = (mult = 1) => 4 * settings.bars * mult;
export const bpm = () => f().bpm;

// ---------- intensity (the newer explorers) ----------
const BOOST = { calm: 1, lively: 1.7, wild: 2.6 };
/** How much bigger the newer explorers react: 1 at Calm; at Lively and Wild more in loud passages and just after a drop. */
export const boost = () => { const b = BOOST[settings.intensity] || 1; if (b === 1 || !live()) return 1; return b * (0.75 + 0.5 * f().energy) * (1 + 0.4 * f().lift); };
const breath = () => (live() && settings.beats && settings.intensity !== 'calm' ? (boost() - 1) * f().bass * amt() : 0);   // the bass level itself, between the hits
export const flashFx = () => (settings.beatStyle === 'pulse' || calm() ? 0 : Math.min(2.2, beat() * boost() + 0.18 * breath()));
export const pulseFx = () => (settings.beatStyle === 'pulse' ? Math.min(2.2, beat() * boost() + 0.25 * breath()) : 0);
export const voiceFx = () => Math.max(-2, Math.min(2, voice() * Math.min(1.8, boost())));
// for a dance (3D fractals): the raw beat and bass, the loudness, and where we are in the beat (null without a steady tempo)
export const beatLevel = () => beat();
export const bassLevel = () => (live() && settings.beats ? Math.min(1.5, f().bass * amt()) : 0);
export const energyLevel = () => (live() ? f().energy : 0);
export const beatPos = () => (live() && settings.tempo && f().locked ? f().beats - f().barOffset : null);
export const kick = () => (live() && settings.beats ? Math.min(1.5, f().kick * amt()) : 0);
export const snare = () => (live() && settings.beats ? Math.min(1.5, f().snare * amt()) : 0);
export const lift = () => (live() ? f().lift : 0);
export const playing = () => live();
export const intensity = () => settings.intensity;
const counts = () => [f().kickCount, f().snareCount];
/** Reports kicks and snares since the last call: { kick, snare } as true / false. */
export class HitGate {
  constructor() { this.c = null; }
  crossed() { if (!(live() && settings.beats)) { this.c = null; return { kick: false, snare: false }; } const c = counts(), o = this.c; this.c = c; return o ? { kick: c[0] !== o[0], snare: c[1] !== o[1] } : { kick: false, snare: false }; }
}
/** The song's structure, for the Visualizer: see the header. */
export class Director {
  constructor() { this.sec = null; this.phrase = null; this.t = 0; this.last = 0; }
  step(dt) {
    if (!live()) { this.sec = null; this.phrase = null; return null; }
    this.t += dt; const F = f(); let ev = null;
    if (this.sec === null) this.sec = F.section; else if (F.section !== this.sec) { this.sec = F.section; ev = F.sectionKind; if (ev === 'calm' && this.t - this.last < 8) ev = null; }   // a drop always counts; a quiet passage right after a change doesn't
    if (F.locked) { const ph = Math.floor((F.beats - F.barOffset) / 32); if (this.phrase === null) this.phrase = ph; else if (ph !== this.phrase) { this.phrase = ph; if (!ev && this.t - this.last > 10) ev = 'phrase'; } }
    else { this.phrase = null; if (!ev && this.t - this.last > 20) ev = 'phrase'; }
    if (ev) this.last = this.t; return ev;
  }
  /** Bars until the next eight-bar phrase (null without a steady beat). */
  barsLeft() { const F = f(); if (!live() || !F.locked) return null; const b = (F.beats - F.barOffset) / 4; return Math.max(1, Math.ceil(8 - (((b % 8) + 8) % 8))); }
}

// musical position in beats, counted from the first beat of a bar
const barBeats = () => f().beats - f().barOffset;

let colourBar = null, colourJump = 0;
export function colourStep(dt) {
  if (!(live() && settings.colour)) { colourBar = null; return 0; }
  let d = dt * (0.008 + 0.09 * f().treble) * amt();
  if (f().locked) {
    // a shift of the palette at the start of each bar, blended in over about half a second
    const bar = Math.floor(barBeats() / 4);
    if (colourBar !== null && bar !== colourBar) colourJump += 0.05 * Math.min(1.5, amt());
    colourBar = bar;
  }
  const j = colourJump * (1 - Math.exp(-dt / 0.4)); colourJump -= j;
  return d + j;
}

/**
 * A periodic motion whose position is `value` (in the motion's own units, `period` per cycle).
 * Free-running it advances at `rate` units per second (times energyMul). With the tempo locked it runs at one cycle
 * per `cycleBeats` beats and is gently pulled so each cycle starts on a bar line.
 * It never jumps: the speed eases over about 1.5 s when the beat locks, unlocks or the tempo changes its mind, and
 * catching up with the bar only ever runs it up to a quarter faster or slower, so it drifts into time.
 */
export class Phase {
  constructor() { this.v = null; }
  step(value, dt, period, beatsPerCycle, rate = 1) {
    if (LOOP.on) return value + dt * loopRate(rate, period);   // a seamless loop: exactly whole cycles, no easing
    const locked = tempoLocked();
    const base = locked ? period * (bpm() / 60) / beatsPerCycle : rate * energyMul();
    if (this.v === null || dt > 0.5) this.v = base;   // first step, or back after a pause
    this.v += (base - this.v) * (1 - Math.exp(-dt / 1.5));
    let pull = 0;
    if (locked) {
      const target = ((barBeats() / beatsPerCycle) % 1 + 1) % 1 * period;
      let e = target - (((value % period) + period) % period);
      if (e > period / 2) e -= period; else if (e < -period / 2) e += period;
      pull = Math.max(-0.25, Math.min(0.25, 4 * e / period));   // close the gap in about a quarter of a cycle, within ±25% speed
    }
    return value + dt * this.v * (1 + pull);
  }
}

/**
 * An advancing motion. `delta(dt, perSecond, perBeat, steps)` returns how far to move this frame: perSecond × dt (times
 * energyMul) when free, or perBeat × the beats that passed, shaped so a little more of each beat's movement happens just
 * after the beat lands. The surge is gentler when the screen draws slowly, so it never becomes a jerk between two frames.
 * Pass steps = true for motions that must take exactly one step per beat (no energy scaling).
 */
export class Groove {
  constructor() { this.last = null; }
  delta(dt, perSecond, perBeat, steps = false) {
    if (!tempoLocked()) { this.last = null; return dt * perSecond * energyMul(); }
    const a = 0.45 - 0.3 * Math.max(0, Math.min(1, (f().frameDt - 0.02) / 0.025));   // surge share: 0.45 at 60 fps, 0.15 at 22 fps
    const g = b => { const n = Math.floor(b), x = b - n; return n + (1 - a) * x + a * (1 - (1 - x) ** 2); };
    const b = f().beats;
    if (this.last === null || Math.abs(b - this.last) > 2) { this.last = b; return 0; }
    const d = Math.max(0, g(b) - g(this.last)); this.last = b;
    return d * perBeat * (settings.energy && !steps ? 0.75 + 0.5 * f().energy : 1);
  }
}

/** True once per beat (first call after each new beat while the tempo is locked). Each caller keeps its own. */
export class BeatGate {
  constructor() { this.last = null; }
  crossed() {
    if (!tempoLocked()) { this.last = null; return false; }
    const n = Math.floor(f().beats), was = this.last; this.last = n;
    return was !== null && n !== was;
  }
}
