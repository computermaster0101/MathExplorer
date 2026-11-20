import { $ } from '../util.js';
import { aud, audOn, st } from '../state.js';
import { touch } from '../view.js';
import { inClaude } from './save-image.js';

// ---------- music: a file (or the microphone) analysed live, gently driving the picture ----------

function audInit(){ if (aud.ctx) return true; try { aud.ctx=new (window.AudioContext||window.webkitAudioContext)(); } catch(e){ $('audNote').textContent='This browser can\'t analyse sound.'; return false; }
  aud.an=aud.ctx.createAnalyser(); aud.an.fftSize=1024; aud.an.smoothingTimeConstant=0.72; aud.data=new Uint8Array(aud.an.frequencyBinCount); aud.dest=aud.ctx.createMediaStreamDestination(); return true; }
function audStopAll(){ if (aud.el){ aud.el.pause(); } if (aud.mic){ aud.mic.getTracks().forEach(t=>t.stop()); aud.mic=null; } aud.playing=false; $('audPlay').textContent='Play'; }
$('audFile').addEventListener('change', e=>{ const f=e.target.files&&e.target.files[0]; if (!f || !audInit()) return; audStopAll();
  if (aud.src){ try { aud.src.disconnect(); } catch(_){} }
  const el=new Audio(); el.src=URL.createObjectURL(f); el.loop=true; el.crossOrigin='anonymous'; aud.el=el;
  aud.src=aud.ctx.createMediaElementSource(el); aud.src.connect(aud.an); aud.src.connect(aud.dest); aud.an.connect(aud.ctx.destination);
  $('audName').textContent=f.name.length>26?f.name.slice(0,24)+'…':f.name; $('audPlay').disabled=false; $('audStop').disabled=false; $('audNote').textContent='Press Play. Recording a video now includes this music.'; });
$('audPlay').addEventListener('click', async ()=>{ if (!aud.el) return; try { await aud.ctx.resume(); if (aud.playing){ aud.el.pause(); aud.playing=false; $('audPlay').textContent='Play'; } else { await aud.el.play(); aud.playing=true; $('audPlay').textContent='Pause'; } }
  catch(e){ $('audNote').textContent='The browser wouldn\'t play that file.'; } });
$('audStop').addEventListener('click', ()=>{ if (aud.el){ aud.el.pause(); aud.el.currentTime=0; } audStopAll(); });
$('micBtn').addEventListener('click', async ()=>{ if (!audInit()) return;
  try { const stream=await navigator.mediaDevices.getUserMedia({audio:true}); audStopAll(); if (aud.src){ try { aud.src.disconnect(); } catch(_){} }
    aud.mic=stream; aud.src=aud.ctx.createMediaStreamSource(stream); aud.src.connect(aud.an); aud.src.connect(aud.dest); try { aud.an.disconnect(aud.ctx.destination); } catch(_){}
    await aud.ctx.resume(); aud.playing=true; $('audName').textContent='microphone'; $('audStop').disabled=false; $('audNote').textContent='Listening to the microphone. Stop ends it.'; }
  catch(e){ $('audNote').textContent = inClaude ? 'The microphone is blocked inside Claude. Choose a music file instead, or open the page in its own browser tab.' : 'The microphone wasn\'t allowed. Check the browser\'s permission, or choose a music file.'; } });
$('audReact').addEventListener('change', e=>{ aud.react=e.target.checked; touch(); });
$('audAmt').addEventListener('input', e=>{ aud.amt=+e.target.value; $('audAmto').textContent=aud.amt.toFixed(1)+'×'; });
export function audStep(dt){
  if (!aud.an || !aud.playing){ aud.level*=0.9; aud.bass*=0.9; aud.treb*=0.9; aud.pulse*=0.85; $('audBar').style.width=Math.round(aud.level*100)+'%'; return false; }
  aud.an.getByteFrequencyData(aud.data); const D=aud.data, bw=aud.ctx.sampleRate/aud.an.fftSize, band=(lo,hi)=>{ let s=0,n=0; for (let k=Math.max(1,Math.floor(lo/bw)); k<=Math.min(D.length-1,Math.ceil(hi/bw)); k++){ s+=D[k]; n++; } return n?s/n/255:0; };
  const ease=(o,v,up,dn)=>o+(v-o)*(v>o?up:dn), b=band(20,160), m=band(160,2000), t=band(2000,9000);
  aud.bass=ease(aud.bass,b,0.6,0.12); aud.mid=ease(aud.mid,m,0.5,0.1); aud.treb=ease(aud.treb,t,0.5,0.1); aud.level=ease(aud.level,(b+m+t)/3*1.6,0.4,0.08);
  aud.bassAvg+=(aud.bass-aud.bassAvg)*Math.min(1,dt*1.2); aud.pulse=Math.max(aud.pulse*Math.exp(-dt*6), Math.max(0,aud.bass-aud.bassAvg)*3);
  $('audBar').style.width=Math.round(Math.min(1,aud.level)*100)+'%';
  if (!aud.react) return false;
  st.cycle=(st.cycle+dt*(0.015+aud.treb*0.12+aud.pulse*0.5)*aud.amt)%1; return true; }

export const audSpeed=()=> audOn() ? 1+1.4*Math.min(1,aud.level)*aud.amt : 1;
