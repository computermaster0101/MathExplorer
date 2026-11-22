# Math Explorer

Interactive maths in the browser: one page with eleven explorers, picked from the menu at the top of the side panel.

- **Fractals**: Mandelbrot, Julia and other escape-time sets with very deep zoom, Buddhabrot, 3D and 4D fractals, fractals grown from rules, and orbits.
- **4D Polytopes**: the regular 4D shapes and many others, turned through four dimensions, sliced, unfolded into nets and built up step by step.
- **Surfaces**: one-sided surfaces (Möbius band, Klein bottle, Boy's surface), surfaces of constant curvature and minimal surfaces (including Costa's). Walk on one (G) to come back on the other side of a Möbius band; cut a band down the middle or bend a soap film (N).
- **Knots & Links**: 20 knots and links, from the trefoil to the Borromean rings, each verified by its invariants. Ride along one like a roller coaster (G), sitting on top or inside the tube.
- **Labyrinths**: endless labyrinths (gyroid, Schwarz P and D and five more triply periodic surfaces) to fly through and find a beacon in; Kelvin's and Weaire–Phelan's foams; 3D mazes to drive, race the solver through, and score against the shortest route; and the ancient one-path labyrinths, with a generator for new ones.
- **Foams**: 23 foams, from Kelvin's and Weaire–Phelan's to the Frank–Kasper family (C15, C14, Z, σ), random, settled and mixed-size foams, bubbles stacked in a tube, flat foams and the exact double bubble. Drawn as soap films, separate bubbles or edges, pulled apart, filtered by number of faces, flown through, with each foam's wall score against Kelvin's.
- **Complex Functions**: domain colouring on the plane or the Riemann sphere, 29 functions including Gamma, Riemann zeta and Weierstrass ℘, draggable zeros and poles, your own formulas, and a Steps slider that grows Julia and Newton fractals (with a link across to Fractals).
- **Strange Attractors**: 17 chaotic flows traced in 3D (Lorenz, Rössler, Chua's circuit…), the butterfly effect, and 10 chaotic maps built up from millions of points.
- **Tilings**: regular and uniform tilings (Wythoff's construction) on the sphere, the plane and the hyperbolic plane, all 11 Archimedean tilings, the 17 wallpaper groups, Truchet tiles, Penrose tilings, quasicrystals and the hat monotile.
- **Waves & Cymatics**: interfering ripples, a simulated wave tank (slits, a lens, a moving source), sand on Chladni plates of six shapes (including a guitar), a plucked string and Fourier epicycles.
- **Growing Patterns**: 20 Life-like rules (including Brian's Brain, Wireworld and a Larger-than-Life rule) with classic patterns, Lenia and 11 reaction–diffusion recipes, with a brush to paint into them.

Every explorer shares the same keys, reacts to the music player, saves images, records videos (with the music), makes share links and exports 3D-printable STL files. Each newer explorer has a one-click **Visualizer** (the ♫ button next to Full screen): it goes full screen, sets everything moving and changes the scene with the song, a new look every eight bars and a bigger change when the chorus or a drop comes in. The music panel's Intensity (Calm, Lively, Wild) sets how big the reactions are. Each also has a motion group for making moving pictures: the 3D ones turn, rock, tumble, zoom in and out and drift; the flat ones drift, keep zooming and turn; and in all of them "Slowly change the shape" sweeps one of the shape's own sliders back and forth, so the shape morphs as you watch.

## Why it exists

Math Explorer is a toy that makes people curious about mathematics by letting them see it, play with it and move through it. It has two equal purposes, both standing on true mathematics.

- **Visualisation.** It shows mathematical objects as they really are, and beautifully: the hyperbolic plane, a gyroid, a Penrose tiling, a shape turning through four dimensions. The first look should make someone say "whoa"; the beauty is the hook.
- **Learning through play.** Everything you can touch teaches something. Diving, driving, solving, sliding a number or pressing a Learn button each shows an idea at work. Game elements are there to make exploring rewarding, and every one points at a piece of real mathematics.
- **Music, paired with the picture.** Music isn't decoration. Motions lock to the beat and the bar, energy sets the pace, and the music becomes something you can see. It is mathematical too: rhythm is repetition, pitch is frequency, harmonics are the patterns on a string or a plate.

### Principles

- **True mathematics.** Formulas are checked, names are honest and claims hold up. New shapes are verified, not just looked at: knots by their invariants, minimal surfaces by their curvature, tilings by their symmetry. Where something doesn't work, it says so rather than pretending.
- **Every playful feature points at an idea.** A maze score compares your route with the shortest one; the hand-on-the-wall rule fails once a maze has loops; a beacon in the other half of a gyroid shows that it splits space in two. If a feature teaches or reveals nothing, it doesn't go in.
- **Plain English for everyone.** No jargon. Explanations a curious 12-year-old can follow, with depth for adults who want it.
- **Beautiful by default.** Every explorer opens on a good view with good colours and motion, on a big screen or a phone.
- **One way to move.** The same keys mean the same thing everywhere: Space pauses, G dives or flies, R resets, N makes something new, T steers toward what's interesting, the arrows and W A S D drive. Learn to move in one explorer and you can move in all of them.
- **Music in the motion, sparingly.** One or two things move with the music at a time, cycles land on bar lines, and nothing jumps, so the picture reads as rhythm rather than chaos.
- **Something to keep.** Share links reopen exactly what you saw, and 3D prints let you hold the shape in your hand.

## Running it

The site is static files with no build step. Serve the repository folder with any web server and open `index.html`.
Browsers block ES modules on `file://`, so double-clicking `index.html` does not work.

```sh
python -m http.server 8000      # then open http://localhost:8000/
```

With nginx, point a `root` at the folder:

```nginx
server {
    listen 80;
    root /var/www/math-explorer;
    index index.html;
    add_header Cache-Control "no-cache";   # always check for a newer file (an unchanged one is still a quick 304)
}
```

The app is many small JavaScript modules with no build step to stamp new file names on them. Without that header, a browser may keep using cached copies for a while after an update, and a mix of old and new modules can misbehave. `python -m http.server` can't send the header, so when developing with it, reload with Ctrl+Shift+R (Cmd+Shift+R on a Mac) after changing files.

nginx's default `mime.types` already serves `.js` as JavaScript, which is all the modules need. Fonts come from Google Fonts. three.js (r128) is kept in `vendor/three/`, so nothing else is loaded from outside.

## Links

The address says which explorer is open and holds the current view, so a copied address reopens the same picture. Links from before Knots & Links and Labyrinths split off from Surfaces still open, redirected to the knot or labyrinth they showed:

```
index.html#/fractal/v=11&m=explore&t=mandelbrot&x=-0.6&y=0&sc=1.25
index.html#/polytope/s=8&m=slice&...
index.html#/tiling/t=7_3&md=disc&...
```
