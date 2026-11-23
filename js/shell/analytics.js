// Visit counts and feature use, through Google Analytics 4, only on the live site and only as much as the visitor allows.
// Until someone presses Allow, Google's Consent Mode keeps it to anonymous, cookie-free pings; Allow lets it count properly.
// The choice is remembered on this device (localStorage, no cookie of ours). Nothing personal is sent: page views carry only
// the explorer's name (never the view code after it, which can hold a hand-drawn shape), and events carry names and counts.
const GA_ID = 'G-LK5Z3FJD40', LIVE = location.hostname === 'mathexplorer.thedigitalspace.net';
const TEST = !LIVE && /[?&]analyticsTest/.test(location.search);   // for checking locally: the bar shows and events are logged to window.__trackLog, nothing is sent
if (TEST) window.__trackLog = [];
const KEY = 'mathexplorer.consent';   // 'granted' | 'denied'
const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
const write = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* not remembered */ } };

window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
if (LIVE) {
  const was = read(), granted = was === 'granted' ? 'granted' : 'denied';
  gtag('consent', 'default', { analytics_storage: granted, ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('js', new Date()); gtag('config', GA_ID, { send_page_view: false, anonymize_ip: true });
  const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID; document.head.appendChild(s);
}
/** Record an event (no-op away from the live site, except a note in the console). */
export function track(name, params = {}) { if (LIVE) gtag('event', name, params); else if (TEST) window.__trackLog.push([name, params]); }
/** A page view for the explorer on screen: its name only, never the view code. */
export function pageView(explorer, title) { track('page_view', { page_title: title, page_location: location.origin + '/#/' + explorer, page_path: '/' + explorer }); track('explorer_open', { explorer }); }

// ---------- the actions worth counting, from one listener (so no explorer needs to know about analytics) ----------
const ACTIONS = { vizBtn: 'visualizer', vizStageBtn: 'visualizer', zenBtn: 'fullscreen', snap: 'snapshot', recBtn: 'record_video', copyLink: 'share_link', prBtn: 'print_3d', sndPlay: 'music_play', sndMic: 'music_mic', sndTab: 'music_tab' };
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (!b || !ACTIONS[b.id]) return;
  track(ACTIONS[b.id], { explorer: document.getElementById('app').dataset.explorer || '' }); }, true);
document.addEventListener('change', e => { if (e.target && e.target.id === 'sndFile') track('music_file', { explorer: document.getElementById('app').dataset.explorer || '' }); }, true);
// errors on real devices: the message only, cut short
let errs = 0;
const err = msg => { if (errs++ < 5) track('js_error', { message: String(msg || '').slice(0, 120), explorer: document.getElementById('app').dataset.explorer || '' }); };
window.addEventListener('error', e => err(e.message)); window.addEventListener('unhandledrejection', e => err(e.reason && e.reason.message));

// ---------- the consent bar and the privacy note ----------
export function showPrivacy() {
  let d = document.getElementById('privacyNote'); if (!d) {
    d = document.createElement('div'); d.id = 'privacyNote'; d.className = 'modalBack';
    d.innerHTML = `<div class="modal" role="dialog" aria-labelledby="pvT"><h2 id="pvT">Privacy</h2>
      <p>Math Explorer runs entirely in your browser. Music you play, files you open and anything you draw stay on your device.</p>
      <p>If you allow it, we use Google Analytics to count visits and which features are used (which explorer, whether the Visualizer or a share link was used, and errors), so we can make the app better. It is never used for advertising and we don't send anything personal: not your drawings, not the view in your address bar.</p>
      <p>If you choose No thanks, Google Analytics gets only anonymous, cookie-free counts. Your choice is remembered on this device; change it here any time.</p>
      <div class="btns"><button class="btn" id="pvDeny">No thanks</button><button class="btn primary" id="pvAllow">Allow</button><button class="btn" id="pvClose">Close</button></div></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d || e.target.id === 'pvClose') d.hidden = true; });
    d.querySelector('#pvAllow').addEventListener('click', () => { choose('granted'); d.hidden = true; });
    d.querySelector('#pvDeny').addEventListener('click', () => { choose('denied'); d.hidden = true; });
  }
  d.hidden = false; d.querySelector('#pvClose').focus();
}
function choose(v) { write(v); if (LIVE) gtag('consent', 'update', { analytics_storage: v }); track('consent', { choice: v }); const bar = document.getElementById('consentBar'); if (bar) bar.hidden = true; document.body.classList.remove('consentAsk'); }
/** The bar, at the bottom, until the visitor chooses (live site only). */
export function consentBar() {
  if (!(LIVE || TEST) || read()) return;
  const bar = document.createElement('div'); bar.id = 'consentBar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Analytics choice');
  bar.innerHTML = '<span>May we count visits and which features you use, to improve Math Explorer? Nothing personal, no ads.</span><span class="cbBtns"><button class="sbtn" id="cbPriv">Privacy</button><button class="sbtn" id="cbDeny">No thanks</button><button class="sbtn on" id="cbAllow">Allow</button></span>';
  document.body.appendChild(bar); document.body.classList.add('consentAsk');   /* lifts the explorer card above the bar */
  bar.querySelector('#cbAllow').addEventListener('click', () => choose('granted'));
  bar.querySelector('#cbDeny').addEventListener('click', () => choose('denied'));
  bar.querySelector('#cbPriv').addEventListener('click', showPrivacy);
}
