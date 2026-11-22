// Saving files from an explorer: inside Claude through its downloads permission (STL files go in a zip there, because
// Claude's downloads won't take .stl directly), anywhere else as the browser's ordinary download. Everything is made
// in the browser; nothing is sent anywhere.
import { zipStore } from '../shell/zip.js';

const inClaude = !!(window.claude && typeof window.claude.use === 'function');
let downloads = null;
if (inClaude) window.claude.use('downloads').then(d => { downloads = d; }).catch(() => {});

/** Save data (a Blob or bytes) as name, reporting what happened in the note element (optional). Returns true if saved. */
export async function saveFile(name, data, note) {
  let blob = data instanceof Blob ? data : new Blob([data]);
  if (downloads && /\.stl$/i.test(name)) { const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data; blob = zipStore(name, bytes); name = name.replace(/\.stl$/i, '.zip'); }
  if (downloads) {
    try { await downloads.save({ filename: name, data: blob }); if (note) note.textContent = 'Saved ' + name + (name.endsWith('.zip') ? ' (unzip to get the STL).' : '.'); return true; }
    catch (e) { if (e && e.code === 'declined') { if (note) note.textContent = 'Save cancelled.'; return false; } }
  }
  try {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (note) note.textContent = inClaude ? 'Sent ' + name + ' to your browser\'s downloads. If nothing appeared, open the page on claude.ai or in its own tab.' : 'Downloaded ' + name + '.';
    return true;
  } catch (e) { if (note) note.textContent = 'Couldn\'t save the file in this view.'; return false; }
}

/** Save what a canvas shows as a PNG. A WebGL canvas needs preserveDrawingBuffer (or a fresh draw just before). */
export function saveCanvasPNG(canvas, name, note, background) {
  let src = canvas;
  if (background) { src = document.createElement('canvas'); src.width = canvas.width; src.height = canvas.height; const g = src.getContext('2d'); g.fillStyle = background; g.fillRect(0, 0, src.width, src.height); g.drawImage(canvas, 0, 0); }
  src.toBlob(b => { if (b) saveFile(name, b, note); else if (note) note.textContent = 'Couldn\'t make the image.'; }, 'image/png');
}

/** A safe file name from a title: "Klein bottle" -> "klein-bottle". */
export const fileName = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'math-explorer';
