# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Math Explorer is a single-page static site made of plain HTML, CSS and native ES modules. It has **no build step, no package.json and no bundler**, and must stay that way: it is deployed by copying the folder to nginx. Third-party code is kept in the repo (`vendor/three/three.module.js`, three.js r128, mapped to the bare specifier `three` by the import map in `index.html`). Do not switch to a CDN or add npm dependencies.

## Running and checking

Serve the folder over HTTP (modules don't load from `file://`), for example `python -m http.server 8000`, then open `http://localhost:8000/`. There are no tests or linters. To check a change, load the page, use the affected explorer and mode, and watch the browser console. A missing import or a load-order problem shows up as an error the moment the explorer loads.

## Layout

```
index.html                 shell markup: stage, side panel, explorer switcher, import map
css/app.css                shared theme, layout and panel controls
js/main.js                 explorer registry, routing, mount/start/stop lifecycle
js/shell/route.js          #/<explorer>/<view-code> parsing, setViewCode, shareLink, activeExplorer
js/shell/layout.js         hide panel / full screen (zen)
js/shell/keys.js           shared keys (h f m Esc e q ?) and dispatch to the active explorer's onKey
js/shell/audio/            the one music player for the whole app (see "Music" below)
explorers/<name>/          one folder per explorer: stage.html, panel.html, style.css, index.js + modules
vendor/three/              three.js r128 ES module build
```

## How the shell drives an explorer

- On first visit, `main.js` fetches `stage.html` and `panel.html`, attaches them, and then dynamically imports `index.js`. Importing that module **boots** the explorer, because its modules look up their DOM elements as they load. So the markup must be attached before the import.
- `index.js` exports the lifecycle: `start`, `stop`, `reset`, `onKey(e) → used`, `layoutChanged`, `showView(code)`. The full contract is in the header comment of `js/main.js`. To add an explorer, create a folder with those files, add it to `EXPLORERS` in `main.js`, add a switcher link in `index.html`, and link its `style.css`.
- Only the active explorer is attached. Switching away calls `stop()` (which ends its `requestAnimationFrame` loop) and detaches its DOM, keeping the nodes. That is why explorers can use bare ids and `document.querySelector` freely. Never leave two explorers' DOM attached at once.
- Explorer CSS must be scoped as `.app[data-explorer="<name>"] …`. Both explorer stylesheets are always loaded.
- Explorers never touch `location.hash` or `history` directly. They use `setViewCode(name, code)` (ignored unless that explorer is active), `shareLink`, `codeFromText` (accepts pasted links or bare codes) and `parseRoute().code` at boot. Old fractal codes (`f3-…`, `f4-…`) still load through `codeFromText`.
- Shell-owned controls (`#panelBtn`, `#zenBtn`, `#zenExit`, `#resetBtn`) and the shared keys are not bound by explorers. Each panel's keyboard group must keep the id `g-keys`, which `?` opens.

## Music (js/shell/audio/)

One player serves the whole app. Music keeps playing across explorer switches and both explorers react to it. Its panel group (`#g-sound` in `index.html`) is moved by `main.js` into the active explorer's panel, right after that explorer's `#g-ctl` group. Explorers never touch the audio graph.

- `frames.js` turns raw samples into spectral frames at a fixed hop (512 samples), each stamped with its audio time. It runs in an AudioWorklet (`frames-worklet.js`). AudioWorklet needs a secure context, so on plain-http hosts `engine.js` falls back to a ScriptProcessor. Keep both paths working.
- `analysis.js` does all beat work per frame on the audio clock, never per screen frame, so results are identical at any frame rate:
  - auto-levelled bands
  - onset detection with an adaptive threshold
  - tempo from a smoothed tempogram: autocorrelation of the bass and the mid/high onset curves, each weighted per song by how clearly it pulses, then folded into 85–170 BPM
  - confidence as how consistently recent windows agree with the tempo (octaves and 2:3 count as agreeing), not as absolute correlation strength, because that varies hugely between songs
  - beat phase by folding onsets over the beat
  - bar start from where the bass falls
  - energy against the song's long-run loudness
  `update()` only places the beat clock at the moment being heard (output latency plus one frame).
- `engine.js` handles playback: a file, the microphone, or another tab's sound. "Listen to a tab" uses `getDisplayMedia` with audio. It needs desktop Chrome or Edge on a secure page; the captured audio isn't sent to the speakers; a `CaptureController` asks Chrome not to jump to the shared tab; and the share ending in the browser bar stops it. To test it headlessly, use a second page plus `--auto-select-tab-capture-source-by-title=<title>`, without puppeteer's default `--mute-audio` and without `--use-fake-ui-for-media-stream`, which substitutes a fake silent device. Also handled:  pause/resume bookkeeping (`analysis.pause/resume`, which also skip the silence-to-music windows that would read as a false hit), and `recordTracks()` for video recording.
- `react.js` is the only thing explorers should import. It holds the panel settings (saved in localStorage) and helpers that already respect them:
  - `flash()` / `pulse()` (0..1) are the beat effect. Only one is non-zero, depending on the panel's "On each beat" choice: Flash brightens (the `u_flash` shader uniform in fractals, light intensity in polytopes); Pulse moves the shape.
  - `voice()` is a slow sway in -1..1 around the vocals' recent level. Use it for at most one gentle parameter per scene.
  - `shimmer()` is treble (0..1); `energyMul()` is a speed multiplier; `colourStep(dt)` advances the palette.
  - Keep the mapping sparse: every extra parameter the music moves at once makes the picture read as chaos, not rhythm. That was the "jumpy" complaint behind this design.
  - `new Phase().step(value, dt, period, cycleBeats(n), freeRate)` is for periodic motions: their cycles land on bar lines when the tempo is locked.
  - `new Groove().delta(dt, perSecond, perBeat, steps)` is for advancing motions: they surge on each beat. Pass `steps=true` when exactly one step per beat matters.
  - `BeatGate` reports beat crossings.
  - Each motion owns its own `Phase`/`Groove` instance (see the `clk` objects in each explorer's `loop.js`).
- Each explorer's `index.js` exports `soundHelp`, the text shown under the switches saying what reacts in that explorer.
- To check analysis changes, run a track through `FrameMaker` and `Analysis` directly: decode it, push 128-sample blocks, call `update()` at a simulated frame rate. Then compare tempo, lock percentage, and how close strong hits land to whole beats (`Analysis.hits = []` records them). Check several songs of different styles, because a tweak that helps one kind of beat can break another. `engine.analysisForDebug()` gives the live instance. There's no test suite for this in the repo.

## Module conventions inside an explorer

These modules came from splitting large single-file apps, and they keep that code's dense style (many statements per line, short names). Match it when editing.

- **Load order is the import order in `index.js`, and it matters.** Modules are layered so that every import points to a module listed earlier in `index.js` (for example util → state → geometry/maths → render → modes → ui → io → input → loop). Top-level code runs at import time (building shape tables, wiring DOM listeners), so a module must not import from a later one. If a lower module needs to call something higher up, move the function down to the lowest module it fits in, rather than adding an upward import.
- ES imports are read-only. A top-level variable that several modules reassign lives on the `shared` object in `<explorer>/shared.js` (`shared.dirty = true`). A variable that only its own module reassigns can be a plain exported `let`.
- `st` in `state.js` is the explorer's single settings object. Changing a setting usually touches the panel markup (`panel.html`), its wiring (`ui/controls.js` or `ui/learn.js`), the code that reads it while drawing, and the view-code encoder/decoder in `io/share.js`. Keep old view codes loading.
- The "Learn" sections are user-facing explanations written in plain English with no jargon; comments follow the same style.

### Fractal explorer specifics
- Frame pacing lives in `loop.js` (`pace`, `adjustPace`). When a moving scene can't hold the screen's rate, it draws on every other refresh (an even 30 fps), checking for headroom every 8 s. Render quality `st.q` changes only in small steps, after real measurements: uneven frames and quality swings looked far worse than a steady lower rate. `pace.simulate` lets tests imitate a slow graphics card, because headless Chrome doesn't wait for the GPU.
- While recording at 720p/1080p, `shared.recCapH` caps the render size to the video's height.
- Dive steering (`startGrid`/`finishGrid` in `view.js`) scans a coarse grid and pulls toward the busiest edge. While the middle of the view is in the black (`st.steerCentreIn`), it favours a random direction chosen per dive (`st.steerPref`) and the zoom eases off. Without that, a mirror-symmetric view such as the whole Mandelbrot set pulls equally both ways and dives straight into the black.
- `d3Bound()` is the sphere the 3D ray-marcher starts in, and the camera distance is fitted from it. A shape that reaches past it is drawn sliced off as a ball. The Mandelbulb (`bulbBound`, by power, including negative powers) and the Mandelbox (`boxBound`, by scale, including positive scales) size it from measurements: rays marched inward with the same distance formulas. Remeasure if you change a formula or a range. Power −2…2 and box scale −1.1…1.5 are dead zones that the sliders snap out of (`snapGap`).
- The Twist slider's range depends on the shape (`twRange` in `ui/controls.js`): −180…180 for most shapes (negative is the mirror-image spiral), but the kaleidoscopes turn their folded wedge and are empty outside about −20…70° (3D) and 0…50° (4D).
- `fractals/types.js` (`TYPES`) defines the families. `render/webgl.js` holds the GLSL shaders as strings, plus context setup.
- Deep zoom uses three precision tiers: doubles, double-double (`math/double-double.js`, about 32 digits) and 416-bit BigInt fixed point (`math/big-fixed.js`, about 125 digits). It uses perturbation: a reference orbit is computed on the CPU (in a Blob-URL worker for Extreme precision), uploaded as a texture, and sped up with BLA (`render/bla.js`).
- Custom formulas (`formula/formula.js`) are compiled twice, by `toGLSL` and by `toJS`. Both must give the same results.
- `window.__fx` exposes internals for console debugging.

### Polytope explorer specifics
- `geometry/` builds every shape as vertices on the unit 3-sphere plus edges, registered in `SHAPES` (`geometry/polytopes.js`). Several sections add more shapes at load time (stars, compounds, round, higher-dim, prisms, wythoff), many built lazily and cached.
- The modes (`modes/build.js`, `modes/unfold.js`, `modes/ping.js`, plus slice and explore) decide what to draw. `render/scene.js` owns the three.js scene, and `loop.js` holds the per-frame update. The inset canvases are drawn by `panels/`.
