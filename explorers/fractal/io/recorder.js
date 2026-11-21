import { shared } from '../shared.js';
import { $ } from '../util.js';
import { st } from '../state.js';
import { recordTracks } from '../../../js/shell/audio/engine.js';
import { glc, ovc } from '../render/webgl.js';
import { cssH, cssW, touch } from '../view.js';
import { segClick } from '../ui/controls.js';
import { fileBase, saveBlob } from './save-image.js';

// ---------- video recorder: the picture (and the music) straight to a file ----------
const rec={mr:null, chunks:[], cv:document.createElement('canvas'), t0:0, limit:0, res:0, mime:'', ext:'webm'};
function recMime(){ if (!window.MediaRecorder) return ''; for (const m of ['video/webm;codecs=vp9,opus','video/webm;codecs=vp9','video/webm;codecs=vp8,opus','video/webm','video/mp4;codecs=avc1,mp4a','video/mp4']) if (MediaRecorder.isTypeSupported(m)) return m; return ''; }
function recSize(){ const aw=ovc.width||cssW, ah=ovc.height||cssH; let w,h; if (!rec.res){ const k=Math.min(1,1920/aw); w=aw*k; h=ah*k; } else { h=rec.res; w=h*aw/ah; } return [Math.round(w/2)*2, Math.round(h/2)*2]; }
export function recFrame(){ if (!rec.mr) return; const g=rec.cv.getContext('2d'), W=rec.cv.width, H=rec.cv.height; g.fillStyle=st.bg; g.fillRect(0,0,W,H); g.drawImage(glc,0,0,W,H); g.drawImage(ovc,0,0,W,H);
  const t=(performance.now()-rec.t0)/1000; $('recTime').textContent=`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`+(rec.limit?` / 0:${String(rec.limit).padStart(2,'0')}`:''); if (rec.limit && t>=rec.limit) recStop(); }
function recStart(){ const mime=recMime(); if (!mime || !rec.cv.captureStream){ $('recNote').textContent='This browser can\'t record video from the page. Recent Chrome, Edge, Firefox and Safari can.'; return; }
  [rec.cv.width, rec.cv.height]=recSize(); recFrame.call(); const vs=rec.cv.captureStream(30), tracks=[...vs.getVideoTracks()];
  tracks.push(...recordTracks());
  try { rec.mr=new MediaRecorder(new MediaStream(tracks), {mimeType:mime, videoBitsPerSecond: rec.cv.height>=1000 ? 12e6 : 7e6}); } catch(e){ $('recNote').textContent='Couldn\'t start recording here.'; rec.mr=null; return; }
  rec.mime=mime; rec.ext=mime.startsWith('video/mp4')?'mp4':'webm'; rec.chunks=[]; rec.mr.ondataavailable=e=>{ if (e.data && e.data.size) rec.chunks.push(e.data); };
  rec.mr.onstop=()=>{ const blob=new Blob(rec.chunks,{type:rec.mime.split(';')[0]}); rec.chunks=[]; $('recBtn').textContent='● Record'; $('recBtn').classList.remove('on'); $('recTime').textContent='';
    if (blob.size) saveBlob(`${fileBase()}-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.${rec.ext}`, blob, $('recNote')); else $('recNote').textContent='Nothing was recorded.'; };
  rec.mr.start(1000); rec.t0=performance.now(); shared.recCapH=rec.res||0; touch(); $('recBtn').textContent='■ Stop recording'; $('recBtn').classList.add('on');
  $('recNote').textContent=`Recording ${rec.cv.width}×${rec.cv.height} ${rec.ext.toUpperCase()}${tracks.length>1?' with sound':''}. The panel and captions aren't included.`; }
function recStop(){ shared.recCapH=0; touch(); if (rec.mr && rec.mr.state!=='inactive'){ const mr=rec.mr; rec.mr=null; mr.stop(); } }
$('recBtn').addEventListener('click', ()=>{ if (rec.mr) recStop(); else recStart(); });
segClick('recLen', d=>{ rec.limit=+d.s; });
segClick('recRes', d=>{ rec.res=+d.r; });
