// "Report a problem" from the site: turns a short report into a GitHub issue on MathExplorer.
// Runs as an AWS Lambda behind a function URL. The GitHub token (issues on this one repository only) is read from the
// encrypted SSM parameter /mathexplorer/github-token; it is never in this code, the repository or the page.
// Guards: only the live site's origin, small bodies, a hidden trap field for bots, a few reports per visitor per
// 10 minutes and a cap per hour, @mentions defused, and nothing personal asked for (the issues are public).
// A picture of the screen, sent only when the visitor ticks the box, must be a JPEG under 500 KB; it is saved under
// reports/ in the site's bucket (the role may only add files there) and shown in the issue from the site's own address.
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'node:crypto';

const REPO = 'computermaster0101/MathExplorer';
const SITE = 'https://mathexplorer.thedigitalspace.net';
const BUCKET = 'mathexplorer.thedigitalspace.net';
const ssm = new SSMClient({}), s3 = new S3Client({});
let token = null;
const perIp = new Map(); let hour = { t: 0, n: 0 };

const reply = (code, obj) => ({ statusCode: code, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });
// plain text, cut short, with @mentions broken so a report can't ping anyone
const clean = (s, n) => String(s ?? '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n).replace(/@/g, '@​');
const fence = s => s.replace(/`{3,}/g, '``');

export const handler = async (event) => {
  const h = event.headers || {}, method = event.requestContext?.http?.method;
  if (method !== 'POST') return reply(405, { error: 'POST only' });
  if (h.origin !== SITE) return reply(403, { error: 'Reports are accepted from the site only.' });
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  if (raw.length > 12000 + 700000) return reply(413, { error: 'Too long.' });
  let b; try { b = JSON.parse(raw); } catch (e) { return reply(400, { error: 'Bad request.' }); }
  if (b.website) return reply(200, { ok: true });   // the hidden field: only bots fill it in
  // everything but the picture keeps to the old size limit
  if (JSON.stringify({ ...b, shot: '' }).length > 12000) return reply(413, { error: 'Too long.' });

  const now = Date.now(), ip = event.requestContext?.http?.sourceIp || '?';
  const mine = (perIp.get(ip) || []).filter(t => now - t < 600000);
  if (mine.length >= 3) return reply(429, { error: 'Thanks! That\'s a few reports already; please try again in a little while.' });
  if (now - hour.t > 3600000) hour = { t: now, n: 0 };
  if (hour.n >= 30) return reply(429, { error: 'Lots of reports right now; please try again later.' });

  const what = clean(b.what, 3000).trim();
  if (what.length < 5) return reply(400, { error: 'Please say what happened.' });
  const explorer = clean(b.explorer, 30).replace(/[^a-z0-9-]/gi, '');
  const view = typeof b.view === 'string' && b.view.startsWith(SITE + '/') && b.view.length < 4000 ? b.view : '';
  const ua = clean(b.browser, 300), screen = clean(b.screen, 40);
  const errs = Array.isArray(b.errors) ? b.errors.slice(0, 5).map(e => clean(e, 200)) : [];
  // the picture: a JPEG (it must start and end like one), under 500 KB
  let jpg = null;
  if (typeof b.shot === 'string' && b.shot.startsWith('data:image/jpeg;base64,')) {
    const buf = Buffer.from(b.shot.slice(23), 'base64'), n = buf.length;
    if (n > 1000 && n < 500000 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff && buf[n - 2] === 0xff && buf[n - 1] === 0xd9) jpg = buf;
  }
  let shotLine = '';
  if (jpg) {
    const key = `reports/${new Date().toISOString().slice(0, 10)}-${randomBytes(9).toString('hex')}.jpg`;
    try {
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: jpg, ContentType: 'image/jpeg', CacheControl: 'public, max-age=31536000, immutable' }));
      shotLine = `### What was on screen\n\n![The picture when the report was sent](${SITE}/${key})\n`;
    } catch (e) { console.error('Couldn\'t save the picture', e); shotLine = '_(A picture was sent but couldn\'t be saved.)_\n'; }
  }

  const first = what.split('\n')[0].slice(0, 70);
  const title = `Report${explorer ? ' (' + explorer + ')' : ''}: ${first}${what.split('\n')[0].length > 70 ? '…' : ''}`;
  const body = [
    '### What happened', '', what, '',
    shotLine,
    '### Details', '',
    explorer && `- **Explorer:** ${explorer}`,
    view && `- **View:** ${view}`,
    ua && `- **Browser:** ${ua}`,
    screen && `- **Screen:** ${screen}`,
    errs.length ? '- **Recent errors on the page:**\n```\n' + fence(errs.join('\n')) + '\n```' : '',
    '', '_Sent from Report a problem on the site._',
  ].filter(x => x !== false && x !== '').join('\n');

  try {
    if (!token) token = (await ssm.send(new GetParameterCommand({ Name: '/mathexplorer/github-token', WithDecryption: true }))).Parameter.Value;
    const r = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'mathexplorer-report' },
      body: JSON.stringify({ title, body, labels: ['from-site'] }),
    });
    if (!r.ok) { console.error('GitHub said', r.status, (await r.text()).slice(0, 300)); if (r.status === 401) token = null; return reply(502, { error: 'Couldn\'t send the report just now.' }); }
    const issue = await r.json();
    mine.push(now); perIp.set(ip, mine); hour.n++;
    return reply(200, { ok: true, number: issue.number, url: issue.html_url });
  } catch (e) { console.error(e); return reply(502, { error: 'Couldn\'t send the report just now.' }); }
};
