// One music player for the whole app: a file, the microphone, or another tab's sound, analysed live. It keeps playing when you switch
// explorers, and every explorer reads the same features (analysis.js) through react.js.
//
// Sound path:  source ─┬─> speakers (files only; the microphone would feed back, and a shared tab is already audible)
//                      ├─> recorder stream (for the fractal explorer's video recorder)
//                      └─> frame maker (AudioWorklet, or a ScriptProcessor where worklets aren't allowed) ─> analysis
import { Analysis, restingFeatures } from './analysis.js';
import { FrameMaker } from './frames.js';

const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(player); };
/** Called whenever the player changes (loaded, playing, paused, stopped, message). */
export const onPlayerChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };

// kind: 'file' | 'mic' | 'tab' | null. stream: the live capture (microphone or shared tab), stopped when we let go of it.
export const player = { ctx: null, dest: null, tap: null, el: null, src: null, stream: null, name: '', kind: null, playing: false, message: '' };
let analysis = null, raf = 0, starting = null;
/** The live feature object (always the same object once the audio has started; values change every frame). */
export let features = restingFeatures();

// AudioWorklet needs a secure page (https or localhost); elsewhere (plain http on a home server) fall back to a ScriptProcessor
async function makeTap(ctx) {
  if (ctx.audioWorklet && window.isSecureContext) {
    try {
      await ctx.audioWorklet.addModule(new URL('./frames-worklet.js', import.meta.url));
      const node = new AudioWorkletNode(ctx, 'sound-frames', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      node.port.onmessage = e => { if (player.playing) for (const fr of e.data) analysis.ingest(fr); };
      return node;
    } catch (e) { console.warn('AudioWorklet unavailable, using ScriptProcessor', e); }
  }
  const fm = new FrameMaker(ctx.sampleRate), size = 1024, node = ctx.createScriptProcessor(size, 2, 1), mono = new Float32Array(size);
  node.onaudioprocess = e => {
    const ib = e.inputBuffer, n = ib.numberOfChannels; mono.fill(0);
    for (let c = 0; c < n; c++) { const d = ib.getChannelData(c); for (let i = 0; i < size; i++) mono[i] += d[i] / n; }
    // these samples entered the graph about one buffer before e.playbackTime
    const frames = fm.push(mono, e.playbackTime - size / ctx.sampleRate);
    if (player.playing) for (const fr of frames) analysis.ingest(fr);
  };
  return node;
}

function init() {
  if (starting) return starting;
  return (starting = (async () => {
    try { player.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { player.message = 'This browser can\'t analyse sound.'; emit(); starting = null; return false; }
    const ctx = player.ctx;
    analysis = new Analysis(ctx.sampleRate); features = analysis.f;
    player.dest = ctx.createMediaStreamDestination();   // a copy of the sound for the video recorder
    player.tap = await makeTap(ctx);
    const mute = ctx.createGain(); mute.gain.value = 0; player.tap.connect(mute).connect(ctx.destination);   // keeps the tap running, silently
    return true;
  })());
}

function disconnect() {
  if (player.src) { try { player.src.disconnect(); } catch (e) { /* already */ } player.src = null; }
  if (player.stream) { player.stream.getTracks().forEach(t => t.stop()); player.stream = null; }
  if (player.el) { player.el.pause(); URL.revokeObjectURL(player.el.src); player.el = null; }
}

function connect(src, toSpeakers) {
  player.src = src; src.connect(player.tap); src.connect(player.dest);
  if (toSpeakers) src.connect(player.ctx.destination);
}

// once per screen frame: let the analysis place the beat clock at the moment being heard
function tick() {
  raf = 0;
  const ctx = player.ctx, lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  const f = analysis.update(ctx.currentTime, player.playing, lat);
  if (player.playing || f.level + f.beat + f.bass > 0.002) raf = requestAnimationFrame(tick);   // and a moment after, to settle
}
const run = () => { if (!raf) raf = requestAnimationFrame(tick); };

/** Load a music file (it loops). Doesn't start playing. */
export async function loadFile(file) {
  if (!file || !(await init())) return;
  stop(); disconnect(); analysis.reset();
  const el = new Audio(); el.src = URL.createObjectURL(file); el.loop = true; el.preload = 'auto';
  el.addEventListener('error', () => { if (player.el !== el) return; player.message = 'The browser couldn\'t read that file.'; player.playing = false; emit(); });
  player.el = el; connect(player.ctx.createMediaElementSource(el), true);
  player.name = file.name; player.kind = 'file'; player.message = 'Press Play.';
  emit();
}

/** Listen to the microphone (not sent to the speakers, so it can't feed back). */
export async function useMic() {
  if (!(await init())) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    stop(); disconnect(); analysis.reset();
    player.stream = stream; connect(player.ctx.createMediaStreamSource(stream), false);
    await player.ctx.resume();
    analysis.resume(player.ctx.currentTime);
    player.name = 'microphone'; player.kind = 'mic'; player.playing = true; player.message = 'Listening to the microphone.';
    run(); emit();
  } catch (e) {
    const inClaude = !!(window.claude && typeof window.claude.use === 'function');
    player.message = inClaude ? 'The microphone is blocked inside Claude. Choose a music file instead, or open the page in its own browser tab.'
                              : 'The microphone wasn\'t allowed. Check the browser\'s permission, or choose a music file.';
    emit();
  }
}

/** Tab sharing needs Chrome or Edge on desktop, on a secure page (https or localhost). */
export const canShareTab = () => !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

/**
 * Listen to another tab (YouTube, Spotify Web, SoundCloud…): the browser asks which tab to share, with its audio.
 * Only the sound is used. It isn't played again here (the tab is already audible), and play, pause and seek happen in
 * that tab. Stopping the share from the browser's own bar stops listening here too.
 */
export async function useTab() {
  if (!canShareTab()) {
    player.message = window.isSecureContext ? 'This browser can\'t share another tab\'s sound. Desktop Chrome and Edge can.'
                                            : 'Sharing a tab\'s sound needs a secure page: open Math Explorer over https (or on localhost).';
    emit(); return;
  }
  if (!(await init())) return;
  let stream;
  // Chrome normally jumps to the tab you share; ask it to stay here, so the picture keeps drawing
  const controller = window.CaptureController ? new CaptureController() : null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      ...(controller ? { controller } : {}),
      video: { frameRate: 1, width: { max: 320 }, height: { max: 240 } },   // the browser insists on video; keep it tiny, it isn't used
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
      preferCurrentTab: false, selfBrowserSurface: 'exclude', surfaceSwitching: 'include', systemAudio: 'include',
    });
    if (controller) try { controller.setFocusBehavior('no-focus-change'); } catch (e) { /* only allowed for tabs and windows, and only right away */ }
  } catch (e) {
    player.message = e && e.name === 'NotAllowedError' ? 'Sharing was cancelled.' : 'The browser couldn\'t share that tab\'s sound.';
    emit(); return;
  }
  if (!stream.getAudioTracks().length) {
    stream.getTracks().forEach(t => t.stop());
    player.message = 'No sound came with that. Choose a tab and tick "Share tab audio" (or "Also share tab audio").';
    emit(); return;
  }
  stop(); disconnect(); analysis.reset();
  player.stream = stream;
  connect(player.ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks())), false);
  for (const t of stream.getTracks()) t.addEventListener('ended', () => { if (player.stream === stream) stop(); });   // "Stop sharing" in the browser bar
  await player.ctx.resume();
  analysis.resume(player.ctx.currentTime);
  const label = (stream.getVideoTracks()[0] || {}).label || '';
  player.name = label && !/^(screen|window|tab)\b|^web-contents/i.test(label) ? label : 'a shared tab';
  player.kind = 'tab'; player.playing = true;
  player.message = 'Listening to the shared tab. Play, pause and skip there; Stop here ends the sharing. If Chrome switched to that tab, come back here (or drag the music tab into its own window).';
  run(); emit();
}

export async function play() {
  if (!player.el) return;
  try { await player.ctx.resume(); await player.el.play(); analysis.resume(player.ctx.currentTime); player.playing = true; player.message = ''; run(); }
  catch (e) { player.playing = false; player.message = 'The browser wouldn\'t play that file.'; }
  emit();
}

export function pause() {
  if (player.el) player.el.pause();
  if (analysis && player.playing) analysis.pause(player.ctx.currentTime);
  player.playing = false; emit();
}

/** Play/pause a file; for the microphone or a shared tab, stop listening. */
export const toggle = () => (player.kind === 'mic' || player.kind === 'tab' ? stop() : player.playing ? pause() : play());

/** Stop: rewind a file, or stop listening to the microphone or the shared tab. */
export function stop() {
  if (player.el) { player.el.pause(); player.el.currentTime = 0; }
  if (analysis && player.playing) analysis.pause(player.ctx.currentTime);
  if (player.kind === 'mic' || player.kind === 'tab') { disconnect(); player.kind = null; player.name = ''; player.message = ''; }
  player.playing = false; emit();
}

/** The analysis itself, for console debugging and tests. */
export const analysisForDebug = () => analysis;

/** Audio tracks for a video recording: the music, while it plays. */
export const recordTracks = () => (player.dest && player.playing ? player.dest.stream.getAudioTracks() : []);
