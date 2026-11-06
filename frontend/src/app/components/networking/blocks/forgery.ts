/**
 * Request forgery engines. CSRF: write the page that makes Sam's browser send a request to Sam's bank. SSRF: type
 * addresses into a link-preview box and make the server fetch things only it can reach. Pure, so the spec can play.
 */

// ---------------------------------------------------------------- CSRF

export type PayloadId = 'img' | 'link' | 'form' | 'fetch';
export type CsrfGuard = 'post' | 'samesite' | 'token' | 'reauth';

export const PAYLOADS: { id: PayloadId; name: string; code: string; how: string }[] = [
  { id: 'img', name: 'Hidden image', how: 'Loads as soon as Sam opens your page',
    code: '<img src="https://bank.example/transfer?to=mallory&amount=5000">' },
  { id: 'link', name: 'Tempting link', how: 'Sam has to click it',
    code: '<a href="https://bank.example/transfer?to=mallory&amount=5000">Claim your prize</a>' },
  { id: 'form', name: 'Auto-submitting form', how: 'Posts as soon as Sam opens your page',
    code: '<form method="POST" action="https://bank.example/transfer">\n  <input name="to" value="mallory"><input name="amount" value="5000">\n</form>\n<script>document.forms[0].submit()</script>' },
  { id: 'fetch', name: 'JavaScript fetch with JSON', how: 'Runs as soon as Sam opens your page',
    code: 'fetch("https://bank.example/api/transfer", {\n  method: "POST", credentials: "include",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ to: "mallory", amount: 5000 })\n})' },
];

export const CSRF_GUARDS: { id: CsrfGuard; name: string; detail: string }[] = [
  { id: 'post', name: 'Transfers need POST', detail: 'The bank refuses to change anything on a GET request' },
  { id: 'samesite', name: 'SameSite=Lax session cookie', detail: 'The browser leaves the cookie off cross-site POSTs and background requests' },
  { id: 'token', name: 'Anti-CSRF token', detail: 'Every bank form carries a secret random value that other sites cannot read' },
  { id: 'reauth', name: 'Confirm with password', detail: 'Sam must type the password again to send money' },
];

export interface CsrfResult { ok: boolean; text: string; blockedBy?: CsrfGuard | 'browser' }

export function csrf(p: PayloadId, on: CsrfGuard[]): CsrfResult {
  const has = (g: CsrfGuard) => on.includes(g);
  if (p === 'fetch') return { ok: false, blockedBy: 'browser',
    text: 'Sam\'s browser first sent a preflight OPTIONS request to ask whether your site may send JSON with Sam\'s cookies. The bank did not say yes, so the browser never sent the transfer. Same-origin rules stop this one even with no defences on.' };
  const background = p !== 'link';
  const cookieSent = !has('samesite') || (p === 'link');
  if (!cookieSent) return { ok: false, blockedBy: 'samesite',
    text: `The browser left the session cookie off this cross-site ${p === 'form' ? 'POST' : 'background request'}, so the bank saw an anonymous request and sent it to the sign-in page.` };
  if (has('post') && p !== 'form') return { ok: false, blockedBy: 'post', text: '405 Method Not Allowed: the bank no longer moves money on a GET.' };
  if (has('token')) return { ok: false, blockedBy: 'token', text: '403 Forbidden: the request had no anti-CSRF token. Your page cannot read the token from the bank\'s pages, so you cannot include it.' };
  if (has('reauth')) return { ok: false, blockedBy: 'reauth',
    text: background ? 'The bank answered with a password prompt that nobody saw. No money moved.' : 'Sam saw "Enter your password to send €5,000 to mallory", got suspicious and closed the tab.' };
  return { ok: true,
    text: `${background ? 'Sam just opened your page.' : 'Sam clicked.'} The browser attached Sam's bank session cookie, so the bank saw a normal ${p === 'form' ? 'POST' : 'GET'} from Sam: €5,000 sent to mallory.${has('samesite') ? ' SameSite=Lax still sends cookies when the user clicks a link to the site, and the bank allowed GET transfers.' : ''}` };
}

export type CsrfMission = 'img' | 'form' | 'fetch' | 'lax' | 'stop';
export const CSRF_MISSIONS: { id: CsrfMission; text: string }[] = [
  { id: 'img', text: 'Move Sam\'s money without Sam clicking anything' },
  { id: 'form', text: 'Move Sam\'s money with a POST request' },
  { id: 'fetch', text: 'Try the JSON fetch and see what stops it' },
  { id: 'lax', text: 'Turn on SameSite=Lax, then still move the money' },
  { id: 'stop', text: 'Find one defence that, on its own, stops all four payloads' },
];

/** `stopped` is the payloads already shown to fail with exactly the current defences; the component empties it on any change. */
export function csrfMissions(p: PayloadId, on: CsrfGuard[], stopped: PayloadId[]): { done: CsrfMission[]; stopped: PayloadId[] } {
  const r = csrf(p, on);
  const done: CsrfMission[] = [];
  if (p === 'fetch') done.push('fetch');
  if (r.ok && p === 'img') done.push('img');
  if (r.ok && p === 'form') done.push('form');
  if (r.ok && on.includes('samesite')) done.push('lax');
  let s = stopped;
  if (on.length === 1 && !r.ok) {
    s = PAYLOADS.map(x => x.id).filter(id => id === p || stopped.includes(id));
    if (s.length === PAYLOADS.length) done.push('stop');
  }
  return { done, stopped: s };
}

// ---------------------------------------------------------------- SSRF

export type SsrfGuard = 'blocklist' | 'scheme' | 'private' | 'allow' | 'imdstoken';

export const SSRF_GUARDS: { id: SsrfGuard; name: string; detail: string }[] = [
  { id: 'blocklist', name: 'Block list', detail: 'Reject an address whose host is written as 169.254.169.254, localhost or 127.0.0.1' },
  { id: 'scheme', name: 'Web addresses only', detail: 'Only http:// and https:// are fetched' },
  { id: 'private', name: 'Block internal destinations', detail: 'Look up the real IP, refuse private, loopback and link-local ones, and check every redirect too' },
  { id: 'allow', name: 'Allow list', detail: 'Only fetch from approved news sites: news.example' },
  { id: 'imdstoken', name: 'Metadata needs a token', detail: 'The cloud metadata service only answers requests that first obtained a session token' },
];

export const BLOCKLIST = ['169.254.169.254', 'localhost', '127.0.0.1'];
export const ALLOWED = ['news.example'];
const DNS: Record<string, string> = { 'news.example': '203.0.113.10', 'evil.example': '203.0.113.66', 'localhost': '127.0.0.1' };

export const FILES: Record<string, string[]> = {
  '/etc/passwd': ['root:x:0:0:root:/root:/bin/bash', 'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin', 'deploy:x:1000:1000::/home/deploy:/bin/bash'],
  '/etc/hostname': ['preview-01'],
};

export type Reached = 'news' | 'meta-list' | 'meta-creds' | 'admin' | 'hr' | 'file' | 'self' | 'evil' | 'none';
export interface Hop { url: string; ip?: string }
export interface SsrfResult { ok: boolean; reached: Reached; status: string; lines: string[]; hops: Hop[]; blockedBy?: SsrfGuard; note?: string }

/** Which internal kind of address an IPv4 address is, if any. */
export function internalKind(ip: string): string | null {
  if (ip === '::1' || ip.startsWith('127.') || ip === '0.0.0.0') return 'loopback';
  if (ip.startsWith('169.254.')) return 'link-local';
  const [a, b] = ip.split('.').map(Number);
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'private';
  return null;
}

function resolve(host: string): string | null {
  const h = host.replace(/^\[|\]$/g, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h === '::1') return h;
  return DNS[h] ?? null;
}

const blocked = (by: SsrfGuard, hops: Hop[], status: string, note?: string): SsrfResult => ({ ok: false, reached: 'none', status, lines: [], hops, blockedBy: by, note });

/** The preview server fetches `input`, with the given defences on. */
export function preview(input: string, on: SsrfGuard[]): SsrfResult {
  const has = (g: SsrfGuard) => on.includes(g);
  let raw = input.trim();
  if (!raw) return { ok: false, reached: 'none', status: 'Type an address to preview.', lines: [], hops: [] };
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = 'http://' + raw;
  // A typical home-made check: compare the host as it was typed with a list, before anything is parsed or resolved.
  const typedHost = (/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/?#]*@)?(\[[^\]]*\]|[^:/?#]*)/i.exec(raw)?.[1] ?? '').toLowerCase();
  if (has('blocklist') && BLOCKLIST.includes(typedHost)) return blocked('blocklist', [], `Blocked: ${typedHost} is on the block list.`);

  const hops: Hop[] = [];
  let url = raw;
  for (let i = 0; i < 4; i++) {
    let u: URL;
    try { u = new URL(url); } catch { return { ok: false, reached: 'none', status: 'That is not a valid address.', lines: [], hops }; }
    const hop: Hop = { url: u.href };
    hops.push(hop);

    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      if (has('scheme')) return blocked('scheme', hops, `Blocked: ${u.protocol}// is not a web address.`);
      if (i > 0) return { ok: false, reached: 'none', status: `The HTTP library refused to follow a redirect to ${u.protocol}//.`, lines: [], hops };
      if (u.protocol !== 'file:') return { ok: false, reached: 'none', status: `The preview library does not speak ${u.protocol}//.`, lines: [], hops };
      const file = FILES[decodeURIComponent(u.pathname)];
      return file ? { ok: true, reached: 'file', status: '200 (read from the server\'s own disk)', lines: file, hops, note: 'The preview library also understands file://, so it read a file from the server itself.' }
        : { ok: false, reached: 'none', status: 'No such file on the server.', lines: [], hops };
    }
    if (has('allow') && !ALLOWED.includes(u.hostname)) return blocked('allow', hops, `Blocked: ${u.hostname} is not on the allow list.`);
    const ip = resolve(u.hostname);
    if (!ip) return { ok: false, reached: 'none', status: `Could not find ${u.hostname}.`, lines: [], hops };
    hop.ip = ip;
    const kind = internalKind(ip);
    if (has('private') && kind) return blocked('private', hops, `Blocked: ${u.hostname} is ${ip}, a ${kind} address.`);
    const port = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80);

    if (ip === '203.0.113.66') {
      const to = u.searchParams.get('to');
      if (u.pathname === '/redirect' && to) { url = to; continue; }
      return { ok: true, reached: 'evil', status: '200 OK', lines: ['Your own server. It redirects anywhere you like: /redirect?to=<address>'], hops };
    }
    if (ip === '203.0.113.10') return { ok: true, reached: 'news', status: '200 OK', lines: ['Harbour reopens after the storm', 'news.example · 3 min read'], hops };
    if (ip === '169.254.169.254') {
      if (has('imdstoken')) return blocked('imdstoken', hops, '401 Unauthorized: get a session token first.', 'A plain GET cannot first make the token request, so the metadata service stays shut.');
      const p = u.pathname.replace(/\/+$/, '/');
      if (p === '/latest/meta-data/iam/security-credentials/app-role' || p === '/latest/meta-data/iam/security-credentials/app-role/')
        return { ok: true, reached: 'meta-creds', status: '200 OK', lines: ['{', '  "key_id": "LAB-ONLY-NOT-REAL",', '  "secret": "lab-only-not-a-real-secret",', '  "expires": "in 6 hours"', '}'], hops, note: 'These are the server\'s own cloud credentials. With them you can act as the server against the cloud account.' };
      const tree: Record<string, string[]> = {
        '/': ['latest/'], '/latest/': ['meta-data/'], '/latest/meta-data/': ['hostname', 'instance-id', 'iam/'],
        '/latest/meta-data/iam/': ['security-credentials/'], '/latest/meta-data/iam/security-credentials/': ['app-role'],
      };
      if (tree[p]) return { ok: true, reached: 'meta-list', status: '200 OK', lines: tree[p], hops, note: 'The cloud metadata service answers anything on the server itself. Keep following the folders.' };
      return { ok: false, reached: 'none', status: '404 Not Found', lines: [], hops, note: 'The metadata service is here. Start at / and follow the listing.' };
    }
    if (kind === 'loopback') {
      if (port === 8080 && u.pathname.startsWith('/admin')) return { ok: true, reached: 'admin', status: '200 OK', lines: ['Internal admin (no sign-in: "only reachable from this machine")', '[ Delete user ]  [ Show config ]  [ Restart ]'], hops };
      if (port === 8080) return { ok: false, reached: 'none', status: '404 Not Found', lines: [], hops, note: 'Something answers on 8080. The admin page is under /admin.' };
      if (port === 80) return { ok: true, reached: 'self', status: '200 OK', lines: ['Link preview service, version 2.3'], hops, note: 'That is the preview server itself. The admin panel listens on port 8080.' };
      return { ok: false, reached: 'none', status: 'Connection refused.', lines: [], hops };
    }
    if (ip === '10.0.5.12' && port === 80) return { ok: true, reached: 'hr', status: '200 OK', lines: ['Internal HR portal', 'Salaries 2026 · Disciplinary cases · Payroll export'], hops };
    return { ok: false, reached: 'none', status: 'Connection timed out.', lines: [], hops };
  }
  return { ok: false, reached: 'none', status: 'Too many redirects.', lines: [], hops };
}

export type SsrfMission = 'internal' | 'meta' | 'file' | 'bypass' | 'stop';
export const SSRF_MISSIONS: { id: SsrfMission; text: string }[] = [
  { id: 'internal', text: 'Open a page that is only reachable from inside: the admin panel or the HR portal' },
  { id: 'meta', text: 'Steal the server\'s cloud credentials from the metadata service' },
  { id: 'file', text: 'Read /etc/passwd from the server\'s own disk' },
  { id: 'bypass', text: 'Switch on the block list alone, then reach the metadata service or localhost anyway' },
  { id: 'stop', text: 'Stop the metadata theft with a defence that still lets news.example previews work' },
];

const INSIDE: Reached[] = ['admin', 'hr', 'meta-list', 'meta-creds', 'self'];

/** `trial` remembers, for exactly the current defences, whether news worked and whether a metadata attempt was stopped. */
export interface SsrfTrial { news: boolean; metaStopped: boolean }

export function ssrfMissions(input: string, on: SsrfGuard[], trial: SsrfTrial): { done: SsrfMission[]; trial: SsrfTrial } {
  const r = preview(input, on);
  const done: SsrfMission[] = [];
  if (r.reached === 'admin' || r.reached === 'hr') done.push('internal');
  if (r.reached === 'meta-creds') done.push('meta');
  if (r.reached === 'file' && r.lines[0]?.startsWith('root:')) done.push('file');
  if (on.length === 1 && on[0] === 'blocklist' && INSIDE.includes(r.reached)) done.push('bypass');
  const aimedAtMeta = r.hops.some(h => h.ip === '169.254.169.254') || /169\.254\.169\.254|2852039166|0xa9fea9fe/i.test(input);
  const t: SsrfTrial = {
    news: trial.news || r.reached === 'news',
    metaStopped: trial.metaStopped || (aimedAtMeta && !!r.blockedBy && ['private', 'allow', 'imdstoken'].includes(r.blockedBy)),
  };
  if (t.news && t.metaStopped) done.push('stop');
  return { done, trial: t };
}
