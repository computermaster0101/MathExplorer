// AudioWorklet: turns the music into fixed-hop spectral frames (frames.js) on the audio thread and posts them to the page.
import { FrameMaker } from './frames.js';

class SoundFrames extends AudioWorkletProcessor {
  constructor() { super(); this.fm = new FrameMaker(sampleRate); this.mono = new Float32Array(128); }
  process(inputs) {
    const inp = inputs[0];
    if (inp && inp.length) {
      const n = inp[0].length; if (this.mono.length !== n) this.mono = new Float32Array(n);
      const m = this.mono; m.fill(0);
      for (const ch of inp) for (let i = 0; i < n; i++) m[i] += ch[i] / inp.length;
      const frames = this.fm.push(m, currentTime);
      if (frames.length) this.port.postMessage(frames);
    }
    return true;
  }
}
registerProcessor('sound-frames', SoundFrames);
