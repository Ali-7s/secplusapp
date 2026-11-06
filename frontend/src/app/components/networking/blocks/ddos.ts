/**
 * The DDoS sandbox's engine. An online shop with a 1 Gbps internet link and a web server that handles 5,000 requests a
 * second; an attacker with a botnet and four ways to use it; and defences, some the shop controls and some only the
 * wider internet can apply. Pure functions, so the spec can check every challenge.
 */

export type Method = 'http' | 'syn' | 'dns' | 'ntp';
export type DefenceId = 'ratelimit' | 'syncookies' | 'scrub' | 'antispoof' | 'resolvers';

export const LINK_MBPS = 1000;
export const SERVER_RPS = 5000;
export const SYN_PER_S = 500_000;
const NORMAL_MBPS = 200;
const NORMAL_RPS = 500;
export const BOT_STEPS = [10, 100, 1000, 2000, 10000];

export const METHODS: { id: Method; name: string; detail: string; amp?: number; reflected?: boolean }[] = [
  { id: 'http', name: 'HTTP flood', detail: 'Each bot requests the search page 20 times a second. Looks like real visitors.' },
  { id: 'syn', name: 'SYN flood', detail: 'Each bot opens 1,000 half-finished TCP connections a second, using 0.5 Mbps.' },
  { id: 'dns', name: 'DNS amplification', detail: 'Each bot sends 2 Mbps of small DNS queries to open resolvers, with your address forged as the source.', amp: 50, reflected: true },
  { id: 'ntp', name: 'NTP amplification', detail: 'Each bot sends 2 Mbps of tiny NTP requests to old time servers, with your address forged.', amp: 500, reflected: true },
];

export const DEFENCES: { id: DefenceId; name: string; detail: string; yours: boolean; icon: string }[] = [
  { id: 'ratelimit', name: 'Rate limit per address', detail: 'Your web server answers at most 2 requests a second from any one address', yours: true, icon: 'speed' },
  { id: 'syncookies', name: 'SYN cookies', detail: 'Your server stops keeping half-open connections in a table', yours: true, icon: 'cookie' },
  { id: 'scrub', name: 'Upstream scrubbing service', detail: 'Your traffic is routed through a provider with huge capacity that drops junk before it reaches your link', yours: true, icon: 'filter_alt' },
  { id: 'antispoof', name: 'ISPs drop forged source addresses', detail: 'Networks refuse to send packets whose source address is not theirs', yours: false, icon: 'policy' },
  { id: 'resolvers', name: 'Open resolvers and NTP servers fixed', detail: 'Third-party servers stop answering anyone who asks', yours: false, icon: 'build' },
];

export interface DdosState { method: Method; bots: number; on: DefenceId[] }

export interface DdosResult {
  /** Traffic arriving at your link, in Mbps, including normal customers. */
  linkMbps: number;
  /** Requests a second reaching the web server, including customers. */
  serverRps: number;
  /** Half-open connections a second the server must track (0 with SYN cookies). */
  synRate: number;
  up: boolean;
  /** Why the shop is down, or what saved it. */
  verdict: string;
  /** What each chosen defence did, in order. */
  notes: { id: DefenceId; helped: boolean; text: string }[];
  /** A few packets as they arrive at your firewall. */
  sample: string[];
}

export const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toLocaleString('en-US', { maximumFractionDigits: n >= 100_000 ? 0 : 1 })} Gbps` : `${Math.round(n)} Mbps`;

export function runDdos({ method, bots, on }: DdosState): DdosResult {
  const has = (d: DefenceId) => on.includes(d);
  const m = METHODS.find(x => x.id === method)!;
  const notes: DdosResult['notes'] = [];
  let attackMbps = 0, attackRps = 0, synRate = 0;

  if (method === 'http') { attackMbps = bots * 0.2; attackRps = bots * 20; }
  if (method === 'syn') { attackMbps = bots * 0.5; synRate = bots * 1000; }
  let reflectedStopped = false;
  if (m.reflected) {
    if (has('antispoof')) { reflectedStopped = true; notes.push({ id: 'antispoof', helped: true, text: 'Bots cannot forge your address any more, so the servers reply to the bots, not to you. Reflection is gone.' }); }
    if (has('resolvers')) { reflectedStopped = true; notes.push({ id: 'resolvers', helped: true, text: `The ${method === 'dns' ? 'resolvers' : 'time servers'} no longer answer strangers, so there is nothing to amplify.` }); }
    attackMbps = reflectedStopped ? 0 : bots * 2 * m.amp!;
  } else {
    if (has('antispoof')) notes.push({ id: 'antispoof', helped: false, text: 'No effect: these bots send from their own real addresses, so there is nothing forged to drop.' });
    if (has('resolvers')) notes.push({ id: 'resolvers', helped: false, text: 'No effect: this attack does not bounce off anyone\'s servers.' });
  }

  if (has('scrub')) {
    if (method === 'http') notes.push({ id: 'scrub', helped: false, text: 'Barely helps: each request is a normal-looking page load from a real address, so the scrubbing service passes it on to you.' });
    else if (attackMbps || synRate) {
      notes.push({ id: 'scrub', helped: true, text: method === 'syn' ? 'Drops the half-open connections at the provider: they never complete, real visitors do.' : 'Drops the flood of replies nobody asked for at the provider, far upstream of your link.' });
      attackMbps = 0; synRate = 0;
    } else notes.push({ id: 'scrub', helped: false, text: 'Nothing left for it to drop.' });
  }

  if (has('syncookies')) {
    if (method === 'syn') { if (synRate) notes.push({ id: 'syncookies', helped: true, text: 'The server no longer stores half-open connections, so a SYN flood cannot fill its table.' }); synRate = 0; }
    else notes.push({ id: 'syncookies', helped: false, text: 'No effect: this attack is not about half-open connections.' });
  }

  if (has('ratelimit')) {
    if (method === 'http') { attackRps = bots * 2; notes.push({ id: 'ratelimit', helped: true, text: `Each bot now gets 2 answers a second, not 20: ${(bots * 2).toLocaleString('en-US')} requests a second reach the server instead of ${(bots * 20).toLocaleString('en-US')}.` }); }
    else if (attackMbps > LINK_MBPS - NORMAL_MBPS) notes.push({ id: 'ratelimit', helped: false, text: 'No effect: the flood fills your internet link before it ever reaches the web server, so the server cannot limit it.' });
    else notes.push({ id: 'ratelimit', helped: false, text: 'No effect: this attack does not send web requests.' });
  }

  const linkMbps = NORMAL_MBPS + attackMbps;
  const linkFull = linkMbps > LINK_MBPS;
  // A full link drops most packets before the server sees them.
  const serverRps = linkFull ? Math.round((NORMAL_RPS + attackRps) * LINK_MBPS / linkMbps) : NORMAL_RPS + attackRps;
  const serverFull = !linkFull && serverRps > SERVER_RPS;
  const synFull = synRate > SYN_PER_S;
  const up = !linkFull && !serverFull && !synFull;

  const verdict = linkFull ? `Down: ${fmt(linkMbps)} is arriving at a ${fmt(LINK_MBPS)} link. Real customers' traffic is lost in the flood.`
    : synFull ? `Down: ${(synRate).toLocaleString('en-US')} half-open connections a second fill the server's table, so real visitors cannot connect.`
    : serverFull ? `Down: ${serverRps.toLocaleString('en-US')} requests a second against a server that handles ${SERVER_RPS.toLocaleString('en-US')}.`
    : `Up: customers can shop. The link carries ${fmt(linkMbps)} and the server answers ${serverRps.toLocaleString('en-US')} requests a second.`;

  const sample = method === 'http'
    ? ['192.0.2.14:51123 → shop:443  GET /search?q=xk3  (real bot address)', '198.51.100.201:40712 → shop:443  GET /search?q=9fa', '203.0.113.77:33019 → shop:443  GET /search?q=pq1']
    : method === 'syn'
      ? ['192.0.2.14:51123 → shop:443  SYN  (never answers our SYN-ACK)', '198.51.100.201:40712 → shop:443  SYN', '203.0.113.77:33019 → shop:443  SYN']
      : reflectedStopped
        ? ['Only normal customer traffic is arriving.']
        : method === 'dns'
          ? ['resolver 198.51.100.53:53 → shop  DNS response, 3,000 bytes, to a query we never sent', 'resolver 203.0.113.9:53 → shop  DNS response, 3,000 bytes', 'resolver 192.0.2.250:53 → shop  DNS response, 3,000 bytes']
          : ['timeserver 198.51.100.123:123 → shop  NTP reply, 48,000 bytes, to a request we never sent', 'timeserver 203.0.113.40:123 → shop  NTP reply, 48,000 bytes', 'timeserver 192.0.2.8:123 → shop  NTP reply, 48,000 bytes'];

  return { linkMbps, serverRps, synRate, up, verdict, notes, sample };
}

export interface DdosChallenge {
  id: string;
  role: 'attacker' | 'defender';
  goal: string;
  /** Fixed settings for the challenge. The attacker picks the method; the defender picks defences. */
  method?: Method;
  bots: number;
  /** Defences the defender may use. */
  allowed?: DefenceId[];
  max?: number;
  lesson: string;
}

export const DDOS_CHALLENGES: DdosChallenge[] = [
  { id: 'few-bots', role: 'attacker', bots: 100, goal: 'You have only 100 bots. Pick a method that takes the shop down.',
    lesson: '100 bots send 200 Mbps directly, not enough. Reflected off servers that reply with 50 to 500 times more data, the same 100 bots can deliver 10 to 100 Gbps.' },
  { id: 'ntp', role: 'defender', method: 'ntp', bots: 10000, allowed: ['ratelimit', 'syncookies', 'scrub'], max: 1,
    goal: '10,000 bots, NTP amplification. With one defence you control, keep the shop up.',
    lesson: 'A volumetric flood fills your link before your own equipment sees it, so it has to be stopped upstream, by a provider with more capacity than the attacker.' },
  { id: 'http', role: 'defender', method: 'http', bots: 2000, allowed: ['ratelimit', 'syncookies', 'scrub'], max: 1,
    goal: '2,000 bots, HTTP flood. With one defence you control, keep the shop up.',
    lesson: 'An application-layer flood looks like real visitors and is small in bandwidth, so scrubbing passes it. Limiting what each address may ask for is what works.' },
  { id: 'syn', role: 'defender', method: 'syn', bots: 1000, allowed: ['ratelimit', 'syncookies'], max: 1,
    goal: '1,000 bots, SYN flood, no scrubbing budget. With one defence, keep the shop up.',
    lesson: 'A SYN flood exhausts the connection table, not the link. SYN cookies mean the server keeps no state until the handshake completes.' },
  { id: 'internet', role: 'defender', method: 'dns', bots: 10000, allowed: ['antispoof', 'resolvers'], max: 1,
    goal: 'Imagine fixing the internet: one internet-wide change that makes a 10,000-bot DNS amplification harmless.',
    lesson: 'Reflection needs a forged source address and a server that answers anyone. Remove either and amplification stops working, for everyone. Neither is yours to change, which is why victims pay for scrubbing.' },
];

export function ddosMet(c: DdosChallenge, s: DdosState): boolean {
  if (s.bots !== c.bots) return false;
  if (c.role === 'attacker') return s.on.length === 0 && !runDdos(s).up;
  if (s.method !== c.method) return false;
  if (s.on.some(d => !c.allowed!.includes(d)) || s.on.length > (c.max ?? 9)) return false;
  return runDdos(s).up;
}
