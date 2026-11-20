import { CELL600, SHAPES, autoTilt, dot4 } from './polytopes.js';

// ---------- star polytopes: the 600-cell's or 120-cell's corners, joined by longer chords so the faces pass through each other ----------
// Checked by counting faces: these are the only chord lengths where every edge sits in the right number of
// pentagrams or triangles for each shape's symbol. Nine of the ten use the 600-cell's 120 corners.
const STARS = {
  sst120:['600', 60, 'Small stellated 120-cell', '{5/2,5,3}: 120 small stellated dodecahedra', 120,
    'The 4D version of the small stellated dodecahedron. It uses the 600-cell\'s 120 corners, but joins each to the 20 corners 60° away instead of its 12 nearest. The faces are pentagrams, and the 120 cells are small stellated dodecahedra that pass right through each other. The great grand 120-cell {5,5/2,3} has exactly the same corners and edges, so its frame looks identical.'],
  g600:['600', 108, 'Grand 600-cell', '{3,3,5/2}: 600 tetrahedra, wrapped around twice', 600,
    'Like the 600-cell, its cells are 600 tetrahedra, but its edges are much longer chords (108° apart instead of 36°), so the cells cut through each other and the surface wraps the centre more than once. Three more of the ten star polytopes share exactly this frame: the great icosahedral, grand stellated and great stellated 120-cells.'],
  ggs120:['120', 135.52, 'Great grand stellated 120-cell', '{5/2,3,3}: 120 great stellated dodecahedra', 120,
    'The most stellated of all ten: the 120-cell\'s 600 corners, each joined to just 4 others that are 135.5° away, almost across the sphere. Its faces are pentagrams and its cells are great stellated dodecahedra. It\'s the only star polytope built on the 120-cell\'s corners rather than the 600-cell\'s.'],
};
// the other seven: each shares its corners and edges with one of the three above (or with the 600-cell itself)
Object.assign(STARS, {
  ico120:['600', 36, 'Icosahedral 120-cell', '{3,5,5/2}: 120 icosahedra', 120,
    'Its corners, edges and even its triangular faces are exactly the 600-cell\'s, so frame and filled faces look identical. The difference is how the faces group into cells: here they form 120 icosahedra that pass through each other, five around every edge, wrapping twice.'],
  gr120:['600', 36, 'Great 120-cell', '{5,5/2,5}: 120 great dodecahedra', 120,
    'Built on the 600-cell\'s corners and edges, but its faces are pentagons rather than triangles. Fill the faces to see them. Its cells are great dodecahedra. The grand 120-cell has exactly the same faces, grouped into different cells.'],
  grand120:['600', 36, 'Grand 120-cell', '{5,3,5/2}: 120 dodecahedra', 120,
    'Its cells are ordinary dodecahedra, like the 120-cell\'s, but they are spread so they cut through each other around the sphere. Same corners and edges as the 600-cell, same pentagon faces as the great 120-cell.'],
  gg120:['600', 60, 'Great grand 120-cell', '{5,5/2,3}: 120 great dodecahedra', 120,
    'Same corners and edges as the small stellated 120-cell, joined 60° apart. Its faces are pentagons where that one has pentagrams, so filling the faces tells the two apart.'],
  gi120:['600', 108, 'Great icosahedral 120-cell', '{3,5/2,5}: 120 great icosahedra', 120,
    'Long 108° edges, like the grand 600-cell, and the same triangular faces. The triangles group into 120 great icosahedra instead of 600 tetrahedra.'],
  gs120:['600', 108, 'Grand stellated 120-cell', '{5/2,5,5/2}: 120 small stellated dodecahedra', 120,
    'Pentagram faces on the long 108° edges, grouped into small stellated dodecahedra. The great stellated 120-cell has the same faces, grouped differently.'],
  gst120:['600', 108, 'Great stellated 120-cell', '{5/2,3,5}: 120 great stellated dodecahedra', 120,
    'Pentagram faces on the long 108° edges, five around each edge, grouped into great stellated dodecahedra. Same frame and faces as the grand stellated 120-cell.'],
});
for (const k in STARS){ const [base, deg, name, alt, cells, info]=STARS[k]; let cache=null; const sh=SHAPES[k]={ name, alt, cells, info, star:true, sym:alt.split(':')[0], tk: base==='600'?0.4:0.3 };
  const init=()=>{ if (!cache){ const V=base==='600' ? autoTilt(CELL600) : SHAPES[120].verts, c=Math.cos(deg*Math.PI/180), E=[];
      for (let i=0;i<V.length;i++) for (let j=i+1;j<V.length;j++) if (Math.abs(dot4(V[i],V[j])-c)<2e-4) E.push([i,j]);
      cache={verts:V, edges:E}; } return cache; };
  Object.defineProperty(sh,'verts',{get:()=>init().verts, configurable:true}); Object.defineProperty(sh,'edges',{get:()=>init().edges, configurable:true}); }
