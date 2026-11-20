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
js/shell/keys.js           shared keys (h f Esc e q ?) and dispatch to the active explorer's onKey
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

## Module conventions inside an explorer

These modules came from splitting large single-file apps, and they keep that code's dense style (many statements per line, short names). Match it when editing.

- **Load order is the import order in `index.js`, and it matters.** Modules are layered so that every import points to a module listed earlier in `index.js` (for example util → state → geometry/maths → render → modes → ui → io → input → loop). Top-level code runs at import time (building shape tables, wiring DOM listeners), so a module must not import from a later one. If a lower module needs to call something higher up, move the function down to the lowest module it fits in, rather than adding an upward import.
- ES imports are read-only. A top-level variable that several modules reassign lives on the `shared` object in `<explorer>/shared.js` (`shared.dirty = true`). A variable that only its own module reassigns can be a plain exported `let`.
- `st` in `state.js` is the explorer's single settings object. Changing a setting usually touches the panel markup (`panel.html`), its wiring (`ui/controls.js` or `ui/learn.js`), the code that reads it while drawing, and the view-code encoder/decoder in `io/share.js`. Keep old view codes loading.
- The "Learn" sections are user-facing explanations written in plain English with no jargon; comments follow the same style.

### Fractal explorer specifics
- `fractals/types.js` (`TYPES`) defines the families. `render/webgl.js` holds the GLSL shaders as strings, plus context setup.
- Deep zoom uses three precision tiers: doubles, double-double (`math/double-double.js`, about 32 digits) and 416-bit BigInt fixed point (`math/big-fixed.js`, about 125 digits). It uses perturbation: a reference orbit is computed on the CPU (in a Blob-URL worker for Extreme precision), uploaded as a texture, and sped up with BLA (`render/bla.js`).
- Custom formulas (`formula/formula.js`) are compiled twice, by `toGLSL` and by `toJS`. Both must give the same results.
- `window.__fx` exposes internals for console debugging.

### Polytope explorer specifics
- `geometry/` builds every shape as vertices on the unit 3-sphere plus edges, registered in `SHAPES` (`geometry/polytopes.js`). Several sections add more shapes at load time (stars, compounds, round, higher-dim, prisms, wythoff), many built lazily and cached.
- The modes (`modes/build.js`, `modes/unfold.js`, `modes/ping.js`, plus slice and explore) decide what to draw. `render/scene.js` owns the three.js scene, and `loop.js` holds the per-frame update. The inset canvases are drawn by `panels/`.
