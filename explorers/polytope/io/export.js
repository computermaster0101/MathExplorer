import { $ } from '../util.js';
import { st } from '../state.js';
import { cross, nrm } from '../geometry/common.js';
import { SHAPES } from '../geometry/polytopes.js';
import { mainLines } from '../render/scene.js';
import { lastFrame, sliceFrame } from '../modes/ping.js';
import { notAvail } from '../ui/text.js';
import { zipStore } from '../../../js/shell/zip.js';

// ---------- export ----------
const RX=12, CX=Array.from({length:RX},(_,m)=>Math.cos(2*Math.PI*m/RX)), SX=Array.from({length:RX},(_,m)=>Math.sin(2*Math.PI*m/RX));
function exportTriangles(fr){
  const tris=[];
  for (const t of fr.tubes){ const n=t.P.length; if (Math.max(...t.rad)<=0) continue;
    const rings=t.P.map((p,k)=>{ const r=t.rad[k], [N,B]=t.F[k]; return CX.map((c,m)=>[p[0]+r*(c*N[0]+SX[m]*B[0]), p[1]+r*(c*N[1]+SX[m]*B[1]), p[2]+r*(c*N[2]+SX[m]*B[2])]); });
    for (let k=0;k<n-1;k++) for (let m=0;m<RX;m++){ const m2=(m+1)%RX;
      tris.push([rings[k][m],rings[k][m2],rings[k+1][m2]],[rings[k][m],rings[k+1][m2],rings[k+1][m]]); }
    for (let m=0;m<RX;m++){ const m2=(m+1)%RX; tris.push([t.P[0],rings[0][m2],rings[0][m]]); tris.push([t.P[n-1],rings[n-1][m],rings[n-1][m2]]); }
  }
  const U=20, Vn=12;
  for (const b of fr.balls){ if (b.r<=0) continue;
    const pt=(i,j)=>{ const u=Math.PI*i/Vn, v=2*Math.PI*j/U; return [b.c[0]+b.r*Math.sin(u)*Math.cos(v), b.c[1]+b.r*Math.sin(u)*Math.sin(v), b.c[2]+b.r*Math.cos(u)]; };
    for (let i=0;i<Vn;i++) for (let j=0;j<U;j++){ const a=pt(i,j), bb=pt(i,j+1), c=pt(i+1,j+1), d=pt(i+1,j); if (i>0) tris.push([a,c,bb]); if (i<Vn-1) tris.push([a,d,c]); }
  }
  return tris;
}
function extents(fr){
  const lo=[1e9,1e9,1e9], hi=[-1e9,-1e9,-1e9]; let minR=1e9;
  for (const t of fr.tubes) for (let k=0;k<t.P.length;k++){ const p=t.P[k], r=t.rad[k]; if (r<=0) continue; if (r<minR) minR=r;
    for (let a=0;a<3;a++){ lo[a]=Math.min(lo[a],p[a]-r); hi[a]=Math.max(hi[a],p[a]+r); } }
  for (const b of fr.balls) for (let a=0;a<3;a++){ lo[a]=Math.min(lo[a],b.c[a]-b.r); hi[a]=Math.max(hi[a],b.c[a]+b.r); }
  return {lo, hi, span:Math.max(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]), minR};
}
const exportFrame = () => st.mode==='slice' ? sliceFrame : lastFrame;
export function updatePrintNote(){
  const fr=exportFrame(); const pn=$('printnote');
  if (notAvail()){ pn.textContent=`Nothing to print: this mode isn't available for the ${SHAPES[st.shape].name}.`; pn.className='note'; return; }
  if (fr && fr.packing){ const ex=extents(fr); if (!(ex.span>0)) return; const r=Math.min(...fr.balls.map(b=>b.r))*2*st.mm/ex.span;
    pn.textContent=`Smallest ball: ${r.toFixed(1)} mm across. Each ball is printed 4% bigger so the touching ones fuse into one piece; the glass container is left out.`+(r<1.5?' Some balls are very small: print bigger, or use less detail.':''); pn.className='note'+(r<1.5?' warn':''); return; }
  if (!fr || !fr.tubes.length){ pn.textContent = st.mode==='slice' ? 'Move the knife into the shape to get something to print.' : (mainLines.vis ? 'Too many connections to print as tubes. Pick 10D or fewer to export an STL.' : 'Thinnest tube: –'); pn.className='note'; return; }
  const ex=extents(fr); if (!(ex.span>0)) return;
  const dia=2*ex.minR*st.mm/ex.span;
  pn.textContent=`Thinnest tube: ${dia.toFixed(2)} mm` + (dia<1.5 ? ' (too thin for most FDM printers; thicken the tubes or print bigger)' : dia<2 ? ' (fine for resin, borderline on FDM)' : ' (prints fine on FDM)');
  pn.className='note'+(dia<1.5?' warn':'');
}
function makeSTL(tris, lo, s){
  const buf=new ArrayBuffer(84+tris.length*50), dv=new DataView(buf), hdr='4D polytope explorer';
  for (let i=0;i<hdr.length;i++) dv.setUint8(i, hdr.charCodeAt(i));
  dv.setUint32(80, tris.length, true); let o=84;
  for (const t of tris){ const p=t.map(v=>[(v[0]-lo[0])*s,(v[1]-lo[1])*s,(v[2]-lo[2])*s]);
    const n=nrm(cross([p[1][0]-p[0][0],p[1][1]-p[0][1],p[1][2]-p[0][2]],[p[2][0]-p[0][0],p[2][1]-p[0][1],p[2][2]-p[0][2]]));
    for (const x of n){ dv.setFloat32(o,x,true); o+=4; } for (const v of p) for (const x of v){ dv.setFloat32(o,x,true); o+=4; } o+=2; }
  return new Uint8Array(buf);
}
export let downloads=null;
export const exportBtn=$('export'), dlNote=$('dlnote');
// Saving files: inside Claude the artifact asks for its downloads permission; opened straight from disk or a web
// server, the browser's ordinary download is used instead, so both buttons work there too.
const localSave = { local:true, save: async ({filename, data})=>{ const url=URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
  const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 4000); } };
const dlReady = d => { downloads=d; exportBtn.disabled=false; $('snap').disabled=false;
  dlNote.textContent='Exports exactly what you see. Pause the motion to pick a moment.' + (d.local ? ' Files go to your browser\'s downloads folder.' : ''); };
if (window.claude && typeof window.claude.use==='function'){
  window.claude.use('downloads').then(d=>{ if (d) dlReady(d); else dlNote.textContent='Downloads aren\'t available in this view. Open the artifact on claude.ai, or save the page and open it in your browser.'; })
    .catch(()=>{ dlNote.textContent='Downloads aren\'t available in this view.'; });
} else dlReady(localSave);
exportBtn.addEventListener('click', async ()=>{ if (notAvail()) return;
  let fr=exportFrame(); if (!downloads || !fr || !(fr.tubes.length || (fr.packing && fr.balls.length))) return;
  if (fr.packing) fr={tubes:[], balls:fr.balls.map(b=>({...b, r:b.r*1.04}))};   // balls that only touch at a point would fall apart: overlap them a little
  exportBtn.disabled=true; const label=exportBtn.textContent; exportBtn.textContent='Building…';
  await new Promise(r=>setTimeout(r,30));
  try {
    const ex=extents(fr), s=st.mm/ex.span, nm=SHAPES[st.shape].name.toLowerCase().replace(/\W+/g,'');
    const base = !fr.tubes.length ? `${nm}_balls_${st.mm}mm` : st.mode==='unfold' ? `${nm}_net_${st.unf.f>0?'2d_'+Math.round(st.unf.f*100):'3d_'+Math.round(st.unf.u*100)}pct_${st.mm}mm` : st.mode==='slice' ? `${nm}_slice_${st.mm}mm` : `${nm}_${st.proj}_${st.mm}mm`;
    const stl=makeSTL(exportTriangles(fr), ex.lo, s);   // Claude's downloads won't take .stl directly, so it goes in a zip there; a plain browser saves the .stl itself
    if (downloads.local){ await downloads.save({ filename: base+'.stl', data: stl }); dlNote.textContent='Saved '+base+'.stl.'; }
    else { await downloads.save({ filename: base+'.zip', data: zipStore(base+'.stl', stl) }); dlNote.textContent='Saved. Unzip to get the STL.'; }
  } catch(e){ dlNote.textContent = e && e.code==='declined' ? 'Download cancelled.' : 'Couldn\'t save the file'+(e&&e.message?': '+e.message:'.'); }
  exportBtn.textContent=label; exportBtn.disabled=false;
});
