# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Two standalone, single-file interactive math visualizers. Each `.html` file has all of its CSS, markup and JavaScript inline. There is no build step, package manager, test suite or linter.

- `Fractal Explorer.html` (title `Fractal Explorer v12`): escape-time fractals (Mandelbrot/Julia families, Newton, custom formulas), deep zoom, Buddhabrot, 3D fractals, "Grow" (L-system-style rule fractals), orbit tracing, audio-reactive mode and a video recorder. Raw WebGL2 (`#version 300 es` shaders), no libraries.
- `4D Polytope Explorer.html` (title `4D Polytope Explorer v7`): 4D polytopes (regular, star, compounds, round shapes, n-D hypercube/simplex/cross-polytope, prisms/pyramids, Wythoff construction) projected to 3D. Uses three.js r128 from cdnjs.

Both load Google Fonts (Inter, JetBrains Mono). The version number in `<title>` is bumped by hand when a file changes.

## Running

Open the file in a browser (double-click, or `start "" "Fractal Explorer.html"` in PowerShell). No server is needed. To check that a change works, open the page and look at the browser console.

## Code layout (applies to both files)

- One IIFE inside one `<script>`, split into sections by banner comments like `// ---------- state ----------`. Grep for `// ----------` to get a table of contents.
- One global mutable state object `st` holds every UI setting and mode. `$ = id => document.getElementById(id)`.
- The UI is the markup at the top of the file. Event handlers are wired up in the `// ---------- UI wiring ----------` section, and a single `requestAnimationFrame(loop)` drives rendering. A change to an `st` field usually needs: the markup control, the wiring, the code that reads it while rendering, and the share-link encoding.
- Shareable views live in the URL `#hash`, handled by `applyView`/`viewCode` (Fractal also has `encodeState`/`decodeState`). The Fractal Explorer still accepts old link formats (`f3-…`, `f4-…`), so keep backward compatibility when you change the link format.
- The "Learn" section holds user-facing explanations. The text is plain English with no jargon, and comments are written in the same style.
- Code is dense, with many statements per line and short names. Match that style when you edit.

### Fractal Explorer specifics
- `TYPES` defines the fractal families. `PALETTES` holds the color ramps, kept in sync with the shader palette uniforms (`setPal`).
- Deep zoom uses three precision tiers: plain doubles, double-double (`dd*`, about 32 digits), and 416-bit BigInt fixed point (`strToFix`/`dblToFix`/`fixToNum`, about 125 digits). It uses perturbation: a reference orbit is computed on the CPU (`computeRefBig`, run in a Blob-URL `new Worker` for Extreme precision), uploaded as a texture (`refSlots`, `upRef`), and sped up with BLA (`buildBLA`).
- Custom formulas: `parseFormula` builds an AST, which is compiled twice, by `toGLSL` (shader) and by `toJS` (CPU paths such as orbits and the escape probe). Both must give the same results.
- `window.__fx` exposes the internals (state, renderers, encode/decode) for debugging from the console.

### 4D Polytope Explorer specifics
- Each shape is built as vertices on the unit 3-sphere plus edges. `SHAPES`, `STARS`, `makeCompound`, `makeRound`, `HD_MAKE` and `wythoff` all produce `{verts, edges, ...}`, and many are built lazily and cached. `INFO` holds the per-shape descriptions.
- The modes (`st.mode`: explore, slice, build, unfold, ping, …) each have their own section that decides what to draw. The extra canvases (`#sliceview`, `#flat2d`, `#inset` for the "3D cousin", `#shadow2d`) are drawn in the "extra panels" and "3D cousin" sections.
