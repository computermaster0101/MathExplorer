import { $ } from '../util.js';
import { st } from '../state.js';
import { d3Bound, freeze3, printDE } from '../modes/fractal3d.js';
import { fileBase, inClaude, saveBlob } from './save-image.js';
import { zipStore } from '../../../js/shell/zip.js';

// ---------- 3D print ----------
// The shape is measured on a grid of points (its distance function says how far each point is from the surface), a
// mesh is wrapped around the inside points ("surface nets": one corner per grid cell the surface passes through, joined
// across every grid edge it crosses), and that is written as an STL in millimetres, standing on the print bed.
// A fractal's detail goes on forever, so anything finer than the grid is smoothed away, and parts thinner than a printer
// can make are thickened (every point within half the minimum width of the surface counts as inside).
const pr={ mm:80, n:150, busy:false };
const MIN_MM=0.8;   // thinnest wall most FDM printers manage cleanly with a 0.4 mm nozzle
const btn=$('prBtn'), note=$('prNote');
const segPick=(id, key, fn)=>$(id).addEventListener('click', e=>{ const b=e.target.closest('button'); if (!b || pr.busy) return;
  $(id).querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b)); fn(+b.dataset[key]); showPrint(); });
segPick('prSize','mm', v=>pr.mm=v); segPick('prRes','n', v=>pr.n=v);
function showPrint(){ if (!pr.busy) note.textContent=`Prints the whole shape as it's set now, with its turn, twist, cut and knife. Detail finer than about ${(pr.mm/pr.n*1.5).toFixed(1)} mm is smoothed away. Building takes from a few seconds to a minute.`; }
showPrint();

const tick=()=>new Promise(r=>setTimeout(r,0));
async function build(progress){
  freeze3(true);
  try {
    const de=printDE(), B=d3Bound()*1.02, n=pr.n, N=n+1, h=2*B/n, NN=N*N, V=new Float32Array(N*NN);
    // 1. measure. Blocks of 4×4×4 points whose centre is clearly outside are filled in without measuring each point.
    // Inside (the "iso" level) means closer than iso to the surface: some distance functions (the Mandelbox's) never go
    // negative, so a little over half a grid step is the least that finds every surface between the grid points.
    let iso=0.6*h; const S=4, nb=Math.ceil(N/S), at=i=>-B+i*h;
    let t0=performance.now();
    for (let bz=0;bz<nb;bz++){ for (let by=0;by<nb;by++) for (let bx=0;bx<nb;bx++){
        const x0=bx*S, y0=by*S, z0=bz*S, x1=Math.min(N,x0+S), y1=Math.min(N,y0+S), z1=Math.min(N,z0+S);
        const c=[at((x0+x1-1)/2), at((y0+y1-1)/2), at((z0+z1-1)/2)], dc=de(c), half=Math.sqrt(3)*(S-1)*h/2;
        for (let z=z0;z<z1;z++) for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++){
          const k=x+y*N+z*NN;
          if (x===0||y===0||z===0||x===n||y===n||z===n){ V[k]=1e9; continue; }   // a layer of outside all round closes the mesh
          V[k] = dc>half+2*h ? dc-Math.hypot(at(x)-c[0],at(y)-c[1],at(z)-c[2]) : de([at(x),at(y),at(z)]); } }
      if (performance.now()-t0>40){ progress(0.8*(bz+1)/nb); await tick(); t0=performance.now(); } }
    // 2. thicken: the finished print is scaled so its longest side is pr.mm, so find that size first
    const ext=()=>{ const lo=[n,n,n], hi=[0,0,0];
      for (let z=0;z<N;z++) for (let y=0;y<N;y++) for (let x=0;x<N;x++) if (V[x+y*N+z*NN]<iso){ const p=[x,y,z]; for (let a=0;a<3;a++){ if (p[a]<lo[a]) lo[a]=p[a]; if (p[a]>hi[a]) hi[a]=p[a]; } }
      return Math.max(hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2])*h; };
    let span=ext(); if (!(span>0)) return null;
    if ($('prThick').checked){ iso=Math.max(iso, MIN_MM/2*span/pr.mm); span=ext(); }
    progress(0.85); await tick();
    // 3. keep only the biggest connected piece: loose crumbs would print as separate specks (or not at all)
    if ($('prOne').checked){ const mark=new Uint8Array(N*NN), stack=new Int32Array(N*NN); let best=-1, bestN=0;
      // flood the inside points marked `from` that touch s0, marking them `m`; the border layer is outside, so j never leaves the grid
      const fill=(s0, from, m)=>{ let sp=0, cnt=0; stack[sp++]=s0; mark[s0]=m;
        while (sp){ const k=stack[--sp]; cnt++; for (const d of [1,-1,N,-N,NN,-NN]){ const j=k+d; if (mark[j]===from && V[j]<iso){ mark[j]=m; stack[sp++]=j; } } } return cnt; };
      for (let k=0;k<V.length;k++) if (!mark[k] && V[k]<iso){ const c=fill(k,0,1); if (c>bestN){ bestN=c; best=k; } }
      if (best>=0){ fill(best,1,2); for (let k=0;k<V.length;k++) if (mark[k]===1) V[k]=iso+h; }
      span=ext(); if (!(span>0)) return null; }
    progress(0.9); await tick();
    // 4. surface nets: a corner in each cell the surface passes through, placed at the average of its edge crossings
    const cell=new Int32Array(n*n*n).fill(-1); let vs=new Float32Array(1<<18), nv=0;
    const C8=[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]], E12=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]], g=new Float64Array(8);
    for (let z=0;z<n;z++) for (let y=0;y<n;y++) for (let x=0;x<n;x++){ let m=0;
      for (let c=0;c<8;c++){ const q=C8[c]; g[c]=V[(x+q[0])+(y+q[1])*N+(z+q[2])*NN]-iso; if (g[c]<0) m|=1<<c; }
      if (m===0 || m===255) continue;
      let sx=0, sy=0, sz=0, ne=0;
      for (const [a,b] of E12){ if ((g[a]<0)===(g[b]<0)) continue; const t=g[a]/(g[a]-g[b]), A=C8[a], Bc=C8[b];
        sx+=A[0]+t*(Bc[0]-A[0]); sy+=A[1]+t*(Bc[1]-A[1]); sz+=A[2]+t*(Bc[2]-A[2]); ne++; }
      if (nv*3+3>vs.length){ const w=new Float32Array(vs.length*2); w.set(vs); vs=w; }
      vs[nv*3]=(x+sx/ne)*h; vs[nv*3+1]=(y+sy/ne)*h; vs[nv*3+2]=(z+sz/ne)*h; cell[x+y*n+z*n*n]=nv++; }
    // a quad across every grid edge with a sign change, joining the four cells around it, facing from inside to outside
    let qs=new Int32Array(1<<18), nq=0; const P=[x=>x, y=>y*N, z=>z*NN];
    for (let a=0;a<3;a++){ const u=(a+1)%3, w=(a+2)%3;
      for (let z=1;z<n;z++) for (let y=1;y<n;y++) for (let x=0;x<n;x++){
        const p=[0,0,0]; p[a]=x; p[u]=y; p[w]=z; const k=p[0]+p[1]*N+p[2]*NN, s0=V[k]<iso, s1=V[k+P[a](1)]<iso; if (s0===s1) continue;
        const ci=(du,dw)=>{ const c=p.slice(); c[u]-=du; c[w]-=dw; return cell[c[0]+c[1]*n+c[2]*n*n]; };
        const q=[ci(1,1), ci(0,1), ci(0,0), ci(1,0)]; if (q.includes(-1)) continue;
        if (nq*4+4>qs.length){ const w2=new Int32Array(qs.length*2); w2.set(qs); qs=w2; }
        if (s0) qs.set(q, nq*4); else qs.set([q[3],q[2],q[1],q[0]], nq*4); nq++; } }
    progress(0.97); await tick();
    // 5. STL in millimetres: the explorer's up (y) becomes the printer's up (z), standing on the bed, centred
    { const l=[Infinity,Infinity,Infinity], u=[-Infinity,-Infinity,-Infinity]; for (let i=0;i<nv*3;i++){ const a=i%3; if (vs[i]<l[a]) l[a]=vs[i]; if (vs[i]>u[a]) u[a]=vs[i]; }
      span=Math.max(u[0]-l[0], u[1]-l[1], u[2]-l[2]); }   // the mesh's own size, so the longest side comes out at exactly pr.mm
    const s=pr.mm/span, lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity], T=new Float32Array(nv*3);
    for (let i=0;i<nv;i++){ const x=vs[i*3], y=vs[i*3+1], z=vs[i*3+2], o=[x*s, -z*s, y*s]; for (let a=0;a<3;a++){ T[i*3+a]=o[a]; if (o[a]<lo[a]) lo[a]=o[a]; if (o[a]>hi[a]) hi[a]=o[a]; } }
    const off=[-(lo[0]+hi[0])/2, -(lo[1]+hi[1])/2, -lo[2]];
    for (let i=0;i<nv;i++) for (let a=0;a<3;a++) T[i*3+a]+=off[a];
    const nt=nq*2, buf=new ArrayBuffer(84+nt*50), dv=new DataView(buf), hdr='Math Explorer fractal';
    for (let i=0;i<hdr.length;i++) dv.setUint8(i, hdr.charCodeAt(i));
    dv.setUint32(80, nt, true); let o=84;
    const tri=(A,Bv,Cv)=>{ const ax=T[Bv*3]-T[A*3], ay=T[Bv*3+1]-T[A*3+1], az=T[Bv*3+2]-T[A*3+2], bx=T[Cv*3]-T[A*3], by=T[Cv*3+1]-T[A*3+1], bz=T[Cv*3+2]-T[A*3+2];
      let nx=ay*bz-az*by, ny=az*bx-ax*bz, nz=ax*by-ay*bx; const l=Math.hypot(nx,ny,nz)||1; nx/=l; ny/=l; nz/=l;
      dv.setFloat32(o,nx,true); dv.setFloat32(o+4,ny,true); dv.setFloat32(o+8,nz,true); o+=12;
      for (const v of [A,Bv,Cv]){ dv.setFloat32(o,T[v*3],true); dv.setFloat32(o+4,T[v*3+1],true); dv.setFloat32(o+8,T[v*3+2],true); o+=12; } o+=2; };
    for (let i=0;i<nq;i++){ const q=qs.subarray(i*4,i*4+4); tri(q[0],q[1],q[2]); tri(q[0],q[2],q[3]); }
    return { stl:new Uint8Array(buf), tris:nt, size:[hi[0]-lo[0], hi[1]-lo[1], hi[2]-lo[2]], wall:2*iso*s };
  } finally { freeze3(false); }
}

btn.addEventListener('click', async ()=>{
  if (pr.busy || st.mode!=='d3') return;
  pr.busy=true; btn.disabled=true; const label=btn.textContent;
  try {
    const r=await build(f=>{ btn.textContent=`Building… ${Math.round(f*100)}%`; });
    if (!r || !r.tris){ note.textContent='Nothing to print: no part of the shape is solid at this setting. Try more detail or a different setting.'; return; }
    const base=`${fileBase()}_${pr.mm}mm`, mb=(r.stl.length/1048576).toFixed(r.stl.length<1e7?1:0);
    const ok = inClaude ? await saveBlob(base+'.zip', zipStore(base+'.stl', r.stl), note) : await saveBlob(base+'.stl', new Blob([r.stl]), note);
    if (ok) note.textContent+=` ${r.size.map(v=>Math.round(v)).join(' × ')} mm, ${r.tris.toLocaleString()} triangles (${mb} MB)`+($('prThick').checked?`, nothing thinner than ${r.wall.toFixed(1)} mm.`:'.');
  } catch(e){ note.textContent='Couldn\'t build the print'+(e&&e.message?': '+e.message:'.'); }
  finally { btn.textContent=label; btn.disabled=false; pr.busy=false; }
});
