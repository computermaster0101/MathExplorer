// The "Music & sound" panel group: player buttons, the live meter, and the reaction switches.
import * as engine from './engine.js';
import { settings, saveSettings } from './react.js';

const $ = id => document.getElementById(id);
export const soundGroup = $('g-sound');
const NOTE = $('sndNote').textContent;   // the default note, shown when there's no message

/** Text under the switches saying what each one does in the explorer on screen. */
export const setSoundHelp = text => { $('sndHow').textContent = text || ''; };

function showPlayer(p) {
  const loaded = p.kind === 'file';
  $('sndName').textContent = p.name ? (p.name.length > 26 ? p.name.slice(0, 24) + '…' : p.name) : 'none';
  $('sndPlay').disabled = !loaded; $('sndPlay').textContent = p.playing && loaded ? 'Pause' : 'Play';
  $('sndStop').disabled = !p.kind; $('sndMic').textContent = p.kind === 'mic' ? 'Microphone on' : 'Use microphone';
  $('sndTab').textContent = p.kind === 'tab' ? 'Tab shared' : 'Listen to a tab';
  $('sndTab').classList.toggle('on', p.kind === 'tab'); $('sndMic').classList.toggle('on', p.kind === 'mic');
  $('sndNote').textContent = p.message || NOTE;
  summary();
}

function summary() {
  const p = engine.player, f = engine.features;
  $('gv-sound').textContent = !p.kind ? '' : `${p.kind === 'mic' ? 'microphone' : p.kind === 'tab' ? 'tab audio' : p.name}${p.playing ? (f.locked ? ` · ${Math.round(f.bpm)} BPM` : ' · playing') : ' · paused'}`;
}

// the live meter, refreshed by its own frame loop while the group is open and something is playing
let raf = 0, lastSummary = 0;
function meter(now) {
  raf = 0;
  const f = engine.features, p = engine.player;
  $('sndLevel').style.width = Math.round(Math.min(1, f.level) * 100) + '%';
  const b = Math.min(1, f.beat);
  $('sndBeat').style.background = `rgb(${42 + b * 180 | 0},${48 + b * 114 | 0},${66 + b * 189 | 0})`;
  $('sndBpm').textContent = !p.playing ? (p.kind ? 'paused' : 'no music') : f.locked ? `♩ ${Math.round(f.bpm)} BPM` : f.bpm ? `♩ ~${Math.round(f.bpm)} BPM` : 'finding the beat…';
  if (now - lastSummary > 1000) { lastSummary = now; summary(); }
  if (p.playing || f.level > 0.01 || f.beat > 0.01) raf = requestAnimationFrame(meter);
}
const runMeter = () => { if (!raf) raf = requestAnimationFrame(meter); };

engine.onPlayerChange(p => { showPlayer(p); runMeter(); });

$('sndFile').addEventListener('change', e => { const file = e.target.files && e.target.files[0]; if (file) engine.loadFile(file); e.target.value = ''; });
$('sndMic').addEventListener('click', () => (engine.player.kind === 'mic' ? engine.stop() : engine.useMic()));
$('sndTab').addEventListener('click', () => (engine.player.kind === 'tab' ? engine.stop() : engine.useTab()));
if (!engine.canShareTab()) $('sndTab').title = window.isSecureContext ? 'Needs desktop Chrome or Edge' : 'Needs a secure page (https or localhost)';
$('sndPlay').addEventListener('click', () => engine.toggle());
$('sndStop').addEventListener('click', () => engine.stop());

// reaction switches, restored from last time
const checks = { sndOn: 'on', sndBeats: 'beats', sndTempo: 'tempo', sndVocals: 'vocals', sndColour: 'colour', sndEnergy: 'energy' };
for (const [id, key] of Object.entries(checks)) {
  $(id).checked = !!settings[key];
  $(id).addEventListener('change', e => { settings[key] = e.target.checked; saveSettings(); });
}
const showAmt = () => { $('sndAmt').value = settings.amount; $('sndAmto').textContent = (+settings.amount).toFixed(1) + '×'; };
showAmt();
$('sndAmt').addEventListener('input', e => { settings.amount = +e.target.value; saveSettings(); showAmt(); });
const showStyle = () => document.querySelectorAll('#sndBeatStyle button').forEach(b => b.classList.toggle('on', b.dataset.s === settings.beatStyle));
showStyle();
$('sndBeatStyle').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; settings.beatStyle = b.dataset.s; saveSettings(); showStyle(); });
const showIntensity = () => document.querySelectorAll('#sndIntensity button').forEach(b => b.classList.toggle('on', b.dataset.i === settings.intensity));
showIntensity();
$('sndIntensity').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; settings.intensity = b.dataset.i; saveSettings(); showIntensity(); });
const showBars = () => document.querySelectorAll('#sndBars button').forEach(b => b.classList.toggle('on', +b.dataset.b === settings.bars));
showBars();
$('sndBars').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; settings.bars = +b.dataset.b; saveSettings(); showBars(); });
showPlayer(engine.player);
