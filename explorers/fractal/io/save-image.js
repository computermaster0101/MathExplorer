import { shared } from '../shared.js';
import { $ } from '../util.js';
import { st } from '../state.js';
import { glc, ovc } from '../render/webgl.js';
import { sizeBuffers } from '../view.js';
import { render2DAll } from '../render/bla.js';
import { render3D } from '../modes/fractal3d.js';
import { drawGrow } from '../modes/grow.js';
import { curName } from '../ui/learn.js';

// ---------- save image ----------
let downloads=null; export const snapBtn=$('snap'), dlNote=$('dlnote'), inClaude=!!(window.claude && typeof window.claude.use==='function');
dlNote.textContent = inClaude ? 'Checking how saving works in this view…' : 'Files save through your browser\'s normal downloads.';
if (inClaude) window.claude.use('downloads').then(d=>{ downloads=d; dlNote.textContent = d ? 'Saves exactly what you see, at full sharpness.' : 'If nothing downloads here, open the page on claude.ai or in its own browser tab.'; }).catch(()=>{});
export async function saveBlob(name, blob, note){
  if (downloads){ try { await downloads.save({filename:name, data:blob}); note.textContent='Saved '+name+'.'; return true; } catch(e){ if (e && e.code==='declined'){ note.textContent='Save cancelled.'; return false; } } }
  try { const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=name; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
    note.textContent = inClaude ? 'Sent '+name+' to your browser\'s downloads. If nothing appeared, this view blocks downloads: open the page on claude.ai or in its own tab.' : 'Downloaded '+name+'.'; return true; }
  catch(e){ note.textContent='Couldn\'t save the file in this view.'; return false; } }
export const fileBase=()=>curName().toLowerCase().replace(/\W+/g,'-').replace(/^-|-$/g,'');
function composite(w, h){ const out=document.createElement('canvas'); out.width=w||ovc.width; out.height=h||ovc.height; const g=out.getContext('2d');
  g.fillStyle=st.bg; g.fillRect(0,0,out.width,out.height); g.drawImage(glc,0,0,out.width,out.height); g.drawImage(ovc,0,0,out.width,out.height); return out; }
snapBtn.addEventListener('click', ()=>{
  if (st.mode!=='grow'){ st.prog=null; st.q=1; sizeBuffers(); if (st.mode==='d3') render3D(true); else render2DAll(true); shared.hqShown=true; } else drawGrow();
  composite().toBlob(blob=>saveBlob(fileBase()+'.png', blob, dlNote), 'image/png'); });
