# Math Explorer

Interactive maths in the browser: one page with two explorers.

- **Fractals**: Mandelbrot, Julia and other escape-time sets with very deep zoom, Buddhabrot, 3D and 4D fractals, fractals grown from rules, and orbits.
- **4D Polytopes**: the regular 4D shapes and many others, turned through four dimensions, sliced, unfolded into nets and built up step by step.

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
}
```

nginx's default `mime.types` already serves `.js` as JavaScript, which is all the modules need. Fonts come from Google Fonts. three.js (r128) is kept in `vendor/three/`, so nothing else is loaded from outside.

## Links

The address says which explorer is open and holds the current view, so a copied address reopens the same picture:

```
index.html#/fractal/v=11&m=explore&t=mandelbrot&x=-0.6&y=0&sc=1.25
index.html#/polytope/s=8&m=slice&...
```
