// "Report a problem" (in the ? menu on the picture): a short form that becomes a GitHub issue on MathExplorer, through a small
// AWS Lambda (aws/report/index.mjs), which holds the GitHub token; the page never sees it. Issues are public, so the form
// asks for nothing personal: what happened, and optionally the link to the view on screen. It also sends the explorer,
// the browser and screen size, and the last few error messages from this page, which is what usually finds the bug.
import { track } from './analytics.js';

const ENDPOINT = 'https://tyk356jjsyekfyuiobmqp7pq5u0flqzt.lambda-url.us-east-1.on.aws/';
const $ = id => document.getElementById(id);
const recent = [];   // the page's last few errors, messages only
const note = m => { if (!m) return; recent.push(String(m).slice(0, 200)); if (recent.length > 5) recent.shift(); };
window.addEventListener('error', e => note(e.message)); window.addEventListener('unhandledrejection', e => note(e.reason && e.reason.message));

export function openReport() {
  let d = $('reportForm'); if (!d) d = build();
  $('rpWhat').value = ''; $('rpStatus').textContent = ''; $('rpSend').disabled = false; $('rpSend').hidden = false; $('rpCancel').textContent = 'Cancel';
  d.hidden = false; $('rpWhat').focus();
}
function build() {
  const d = document.createElement('div'); d.id = 'reportForm'; d.className = 'modalBack';
  d.innerHTML = `<form class="modal" role="dialog" aria-labelledby="rpT" novalidate><h2 id="rpT">Report a problem</h2>
    <label class="lbl" for="rpWhat">What happened?</label>
    <textarea id="rpWhat" class="txt" rows="5" maxlength="3000" placeholder="What you did, what you expected, and what happened instead"></textarea>
    <label class="check"><input type="checkbox" id="rpView" checked> Include a link to what I'm looking at</label>
    <input type="text" name="website" id="rpTrap" tabindex="-1" autocomplete="off" aria-hidden="true" class="rpTrap">
    <p class="note">Reports are posted publicly as issues on GitHub, so please don't include personal details. Also sent: which explorer, your browser and screen size, and any recent error messages from this page.</p>
    <p class="note" id="rpStatus" role="status"></p>
    <div class="btns"><button type="button" class="btn" id="rpCancel">Cancel</button><button type="submit" class="btn primary" id="rpSend">Send</button></div></form>`;
  document.body.appendChild(d);
  const close = () => { d.hidden = true; };
  d.addEventListener('click', e => { if (e.target === d || e.target.id === 'rpCancel') close(); });
  d.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  d.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault(); const what = $('rpWhat').value.trim(), st = $('rpStatus');
    if (what.length < 5) { st.textContent = 'Please say what happened.'; $('rpWhat').focus(); return; }
    $('rpSend').disabled = true; st.textContent = 'Sending…';
    const explorer = document.getElementById('app').dataset.explorer || '';
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        what, explorer, view: $('rpView').checked ? location.href : '', browser: navigator.userAgent, screen: `${screen.width}x${screen.height} (window ${innerWidth}x${innerHeight})`,
        errors: recent.slice(), website: $('rpTrap').value }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || 'Couldn\'t send the report just now.');
      track('report_sent', { explorer });
      // the link is built as an element, and only for an issue on this repository, so nothing in the reply can become markup
      st.textContent = 'Thank you!';
      if (typeof j.url === 'string' && j.url.startsWith('https://github.com/computermaster0101/MathExplorer/issues/')) {
        const a = document.createElement('a'); a.href = j.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'issue #' + (parseInt(j.number, 10) || '');
        st.append(' It\'s ', a, ' on GitHub.');
      }
      $('rpSend').hidden = true; $('rpCancel').textContent = 'Close';
    } catch (er) { st.textContent = (er && er.message) || 'Couldn\'t send the report just now.'; $('rpSend').disabled = false; }
  });
  return d;
}
