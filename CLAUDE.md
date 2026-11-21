# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Math Explorer is a single-page static site made of plain HTML, CSS and native ES modules. It has **no build step, no package.json and no bundler**, and must stay that way: it is deployed by copying the folder to nginx. Third-party code is kept in the repo (`vendor/three/three.module.js`, three.js r128, mapped to the bare specifier `three` by the import map in `index.html`). Do not switch to a CDN or add npm dependencies.

## Running and checking

Serve the folder over HTTP (modules don't load from `file://`), for example `python -m http.server 8000`, then open `http://localhost:8000/`. After editing, reload with Ctrl+Shift+R: browsers cache the modules, and the README's nginx config sends `Cache-Control: no-cache` for the same reason. There are no tests or linters. To check a change, load the page, use the affected explorer and mode, and watch the browser console. A missing import or a load-order problem shows up as an error the moment the explorer loads.

## Layout

```
index.html                 shell markup: stage, side panel, explorer switcher, import map
css/app.css                shared theme, layout and panel controls
js/main.js                 explorer registry, routing, mount/start/stop lifecycle
js/shell/route.js          #/<explorer>/<view-code> parsing, setViewCode, shareLink, activeExplorer
js/shell/layout.js         hide panel / full screen (zen)
js/shell/keys.js           shared keys (h f m Esc e q ?), held driving keys (drive()), the Paused tag, dispatch to onKey
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
- Keys are the same in both explorers: Space pauses and resumes everything moving (`st.paused`, gating every motion in the loop; with nothing moving it starts the mode's main motion), G dives or flies in, R resets, Z / X change shape (`,` / `.` too; Shift + Z / X change the number of dimensions on the polytopes), C / V change palette, B changes colour mode.
  - The driving keys (arrows and W A S D, Shift for faster) never reach `onKey`. The shell keeps them in a held set, cleared on blur, and each explorer reads `drive()` every frame. The arrows turn and W A S D slides; in 2D both pan.
  - `turnY` follows the shared "Invert up / down" box (`#invertY` in each `g-keys` group, saved in localStorage); `rawY` ignores it.
  - Space is also blocked on key-up, and auto-repeat is ignored. After a mouse click, buttons, checkboxes and sliders give up focus. Otherwise Space also pressed the last-clicked button, and holding it flipped the pause on and off.
  - Each loop calls `setPausedTag(st.paused)`.

## Music (js/shell/audio/)

One player serves the whole app. Music keeps playing across explorer switches and both explorers react to it. Its panel group (`#g-sound` in `index.html`) is moved by `main.js` into the active explorer's panel, right after that explorer's `#g-style` group. Both panels keep the same group order: Shapes, Controls, (Rotation & motion), View, Colour & style, Music & sound, Share, Numbers/Structure, Learn, 3D print, Keyboard shortcuts. Explorers never touch the audio graph.

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
  - `new Phase().step(value, dt, period, cycleBeats(n), freeRate)` is for periodic motions: their cycles land on bar lines when the tempo is locked. It never jumps: its speed eases over about 1.5 s when the lock or tempo changes, and it catches up with the bar at most ±25% faster or slower. An earlier version snapped into place, which made Breathe lurch.
  - Choose `n` by how much the motion changes the picture. Turning and twisting can cycle every "Slow motions take" bars (`n=1`), but Breathe reshapes the whole object and uses `n=4`; at bar speed it "hit too hard".
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
- Frame pacing lives in `loop.js` (`pace`, `adjustPace`). When a moving scene can't hold the screen's rate, it draws on every other refresh (an even 30 fps), checking for headroom every 8 s. Render quality `st.q` changes only in small steps, after real measurements: uneven frames and quality swings looked far worse than a steady lower rate. `pace.simulate` lets tests imitate a slow graphics card, because headless Chrome doesn't wait for the GPU. The viewer's "While moving" choice (`st.motionQ`: smooth / balanced / sharp, saved in localStorage, not in share codes) sets where `st.q` starts, its ceiling while moving and its floor, through `qLimits()` in `state.js`. Dives get a slightly higher floor.
- While recording at 720p/1080p, `shared.recCapH` caps the render size to the video's height.
- Dive steering (`startGrid`/`finishGrid` in `view.js`) scans a coarse grid and pulls toward the busiest edge. While the middle of the view is in the black (`st.steerCentreIn`), it favours a random direction chosen per dive (`st.steerPref`) and the zoom eases off. Without that, a mirror-symmetric view such as the whole Mandelbrot set pulls equally both ways and dives straight into the black.
- `d3Bound()` is the sphere the 3D ray-marcher starts in, and the camera distance is fitted from it. A shape that reaches past it is drawn sliced off as a ball. The Mandelbulb (`bulbBound`, by power, including negative powers) and the Mandelbox (`boxBound`, by scale, including positive scales) size it from measurements: rays marched inward with the same distance formulas. Remeasure if you change a formula or a range. Power −2…2 and box scale −1.1…1.5 are dead zones that the sliders snap out of (`snapGap`).
- The Twist slider's range depends on the shape (`twRange` in `ui/controls.js`): −180…180 for most shapes (negative is the mirror-image spiral), but the kaleidoscopes turn their folded wedge and are empty outside about −20…70° (3D) and 0…50° (4D).
- `fractals/types.js` (`TYPES`) defines the families. `render/webgl.js` holds the GLSL shaders as strings, plus context setup.
- The 3D shader is built **per shape, on demand**. `FS3` is only the source text. `fs3For(i, glass)` cuts out the shared header, that shape's `deX` function (with the constants and helpers just above it), a one-line `mapRaw`, and the shared drawing code. The see-through block sits under `#ifdef GLASS`.
  - `prog3()` in `modes/fractal3d.js` builds the program for the current shape and see-through setting, then drops the others with `main.drop`. Leaving 3D, or the explorer, calls `drop3()`.
  - One program with all 20 shapes took Windows' Direct3D shader compiler minutes, or failed. Per shape, it's 0.3–2.5 s.
  - When adding a shape: put helpers used by more than one shape in the header (as with `rotYv`, `mDE2`), and add the function name to `DE3` in SH3 order.
  - Long fixed loops compile slowly there because they get unrolled. Starting a loop at `min(u_it3,0)` prevents that.
- Deep zoom uses three precision tiers: doubles, double-double (`math/double-double.js`, about 32 digits) and 416-bit BigInt fixed point (`math/big-fixed.js`, about 125 digits). It uses perturbation: a reference orbit is computed on the CPU (in a Blob-URL worker for Extreme precision), uploaded as a texture, and sped up with BLA (`render/bla.js`).
- Custom formulas (`formula/formula.js`) are compiled twice, by `toGLSL` and by `toJS`. Both must give the same results.
- The Apollonian packing (`soddy`, `deSoddy`) flips points through five partner spheres. Alongside, it carries the chain of flips as a 5×5 matrix acting on each sphere's five numbers (co-curvature, curvature, curvature × centre), so every nearby ball's real centre and radius are exact. Two earlier attempts left visible seams: limiting detail by number of flips (balls got half drawn), and shrinking the balls to keep them apart (a flip doesn't map a shrunk ball onto itself). So detail is a minimum ball size (`soddyMin`), applied to whole balls. Keep the shader version lean: the matrix rows are named variables, and the partner-sphere numbers are picked with `if`s, not arrays indexed at run time. After each flip, only the replaced ball and the middle ball are re-measured, since balls the flip crosses at right angles stay put. A version that did neither took 2.8 s a frame on an Intel card, and Windows reset the GPU. Measure frame cost with a `readPixels` after `render3D`; `gl.finish()` does not wait in Chrome. "Apollonian foam" (`apo`) is the older fold-based slab.
- See-through bubbles (`st.d3.glass`, `u_glass`) marches on |distance|, so it can also find its way out of a solid. Each surface crossed is shaded as a soap film and blended front to back, up to six crossings. The shared colour lookup is `baseCol()`.
- The hyperbolic honeycomb (`hyp`, `deHyp`; kinds in `HYP`, mirrors from `hypMirrors`) folds with three planes through the centre plus one face sphere orthogonal to the ball. Detail is a cell-size cut-off (`dsMax`), not a fold count: past it, cells aren't opened up, because drawing them all turned the rim into noise. Walls are drawn only for the middle cell and its neighbours. Its 2D cousin in `ui/insets.js` is the matching disc tiling {p,r}, drawn per pixel with the same folding.
- 3D print (`io/print3d.js`) samples `printDE()` from `modes/fractal3d.js` on a grid. It skips 4×4×4 blocks that are clearly outside, thickens the shape (everything within half the minimum wall counts as inside), keeps the biggest connected piece and wraps it with surface nets. The STL is written in millimetres with the explorer's y axis up. The build spans many frames, so `freeze3(true)` makes the distance functions read a frozen copy of `st.d3` (via `D3()`), and a Breathe can't change the shape halfway through. Camera helpers (`cam3`, `d3Mag`) keep reading `st.d3`. The Mandelbox's distance never goes negative, so "inside" is always "within a little over half a grid step", never "below 0". A Downloads-in-Claude save goes in a zip (`js/shell/zip.js`, shared with the polytope export).
- `window.__fx` exposes internals for console debugging.

### Polytope explorer specifics
- `geometry/` builds every shape as vertices on the unit 3-sphere plus edges, registered in `SHAPES` (`geometry/polytopes.js`). Several sections add more shapes at load time (stars, compounds, round, higher-dim, prisms, wythoff), many built lazily and cached.
- The Apollonian packing (`apack`, end of `geometry/round.js`) is made of caps on the 3-sphere, each kept as five numbers `(centre, cos r)/sin r`; two caps touch when their form is −1. A new ball is "sum of the other four − this one". The 3D filling rule can reach the same ball twice, so duplicates are merged. In Balls view, `render/packing.js` draws each cap as an exact sphere under true stereographic projection. The cap holding the pole becomes the glass container. `updateGeometry` hands the balls to the 3D print as a balls-only frame, and the print enlarges each ball 4% so touching balls fuse. The packing always uses stereographic projection and has no Slice. A ball bigger than `BIG` (it is swelling towards becoming the container) is drawn as a faint glass shell, not solid, so it cannot fill the view.
- "Draw as" (`st.drawAs`, Explore only):
  - **Touching balls:** `render/packing.js` puts a ball at every corner with radius half the closest pair's angle (`capsFor`, cached in `sh._kiss`), drawn exactly like the packing.
  - **Bubble foam:** `render/foam.js` pushes each face onto the 3-sphere, where it lies on a great sphere, so it projects to an exact sphere. Normals come from that sphere's centre. The subdivided points are built once per shape; each frame only turns and projects them with plain arithmetic (allocating per point cost 40+ ms a frame), then re-sorts whole faces back to front.
  - Both views force stereographic projection (`roundView`).
- The "Bubble" finish is `bubbleMaterial()` in `render/scene.js`: a thin-film ShaderMaterial that works on instanced balls (instance colour) and on vertex-coloured meshes. Transparent balls are sorted back to front each frame.
- Flying (`input/fly.js`, G): the camera leaves its spot on the z axis and moves freely. Normally it never rotates, and the shape group (`pivot`) turns instead.
  - Speed eases down near the middle.
  - After drifting out without steering, it turns back toward a random point near the middle.
  - Stopping, or Reset view, restores the axis camera.
  - Not flying, the arrows turn `pivot` like a drag and W A S D slide the camera sideways.
- The modes (`modes/build.js`, `modes/unfold.js`, `modes/ping.js`, plus slice and explore) decide what to draw. `render/scene.js` owns the three.js scene, and `loop.js` holds the per-frame update. The inset canvases are drawn by `panels/`.
