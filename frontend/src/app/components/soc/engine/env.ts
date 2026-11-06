/**
 * Fernco, the small company whose SOC the lab puts you in: its people, machines and everyday traffic. The background
 * generators make a believable working day of harmless events for each log source, so the incidents have to be found
 * among normal noise. Everything is seeded, so a shift's logs come out the same on every visit and every device.
 */

import { Ev, Source, auth, dns, edr, fw, ids, idp, proxy, web, win } from './events';

export type Rng = () => number;

/** mulberry32: small, fast and good enough for believable logs. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
export const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

export interface Person { user: string; name: string; host: string; ip: string; dept: string }

/** Servers that make background lookups and connections of their own. */
export const SERVERS = [{ ip: '10.0.1.5' }, { ip: '10.0.6.40' }, { ip: '10.0.3.22' }, { ip: '10.0.1.80' }];

export const PEOPLE: Person[] = [
  { user: 'a.ng', name: 'Alex Ng', host: 'LT-101', ip: '10.0.4.101', dept: 'Finance' },
  { user: 'r.diaz', name: 'Rosa Diaz', host: 'LT-104', ip: '10.0.4.104', dept: 'Sales' },
  { user: 'j.osei', name: 'Jo Osei', host: 'LT-106', ip: '10.0.4.106', dept: 'Sales' },
  { user: 's.ito', name: 'Sam Ito', host: 'LT-110', ip: '10.0.4.110', dept: 'IT' },
  { user: 't.ward', name: 'Tom Ward', host: 'LT-114', ip: '10.0.4.114', dept: 'Accounts' },
  { user: 'k.park', name: 'Kim Park', host: 'LT-115', ip: '10.0.4.115', dept: 'Marketing' },
  { user: 'm.lee', name: 'Mia Lee', host: 'LT-118', ip: '10.0.4.118', dept: 'Marketing' },
  { user: 'd.kim', name: 'Dan Kim', host: 'LT-122', ip: '10.0.4.122', dept: 'Accounts' },
  { user: 'l.moreau', name: 'Lea Moreau', host: 'LT-125', ip: '10.0.4.125', dept: 'IT Security' },
  { user: 'p.harris', name: 'Pat Harris', host: 'LT-128', ip: '10.0.4.128', dept: 'IT' },
  { user: 'k.mensah', name: 'Kofi Mensah', host: 'LT-129', ip: '10.0.4.129', dept: 'IT' },
  { user: 'e.silva', name: 'Eva Silva', host: 'LT-131', ip: '10.0.4.131', dept: 'HR' },
];

/** Internet addresses used by harmless background traffic. Scenario addresses are kept out of this pool. */
const RESERVED = new Set(['198.51.100.23', '198.51.100.200', '203.0.113.50']);
export const PUBLIC_POOL: string[] = [
  ...Array.from({ length: 120 }, (_, i) => `198.51.100.${40 + i}`),
  ...Array.from({ length: 140 }, (_, i) => `203.0.113.${100 + i}`),
].filter(ip => !RESERVED.has(ip));

/** Everyday outside services: name, address, proxy category. */
export const SITES: [string, string, string][] = [
  ['crm.saas-vendor.example', '192.0.2.21', 'business'],
  ['files.cloud-share.example', '192.0.2.22', 'file-sharing'],
  ['docs.office-suite.example', '192.0.2.23', 'business'],
  ['updates.os-vendor.example', '192.0.2.24', 'software-updates'],
  ['login.idp-vendor.example', '192.0.2.25', 'business'],
  ['news.daily.example', '192.0.2.31', 'news'],
  ['cdn.static-assets.example', '192.0.2.32', 'content-delivery'],
  ['weather.example', '192.0.2.33', 'weather'],
  ['maps.example', '192.0.2.34', 'reference'],
  ['video.stream.example', '192.0.2.35', 'streaming-media'],
  ['bank.partner.example', '192.0.2.36', 'finance'],
  ['travel.booking.example', '192.0.2.37', 'travel'],
];
const INTERNAL_NAMES: [string, string][] = [
  ['intranet.fernco.example', '10.0.2.20'],
  ['mail.fernco.example', '10.0.2.25'],
  ['files.fernco.example', '10.0.2.30'],
  ['dc01.fernco.example', '10.0.1.5'],
];

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36',
];
const PATHS: [string, number][] = [
  ['/', 9200], ['/products', 15400], ['/cart', 4100], ['/login', 3900], ['/static/app.js', 88120], ['/static/style.css', 23110],
  ['/favicon.ico', 1150], ['/about', 6200], ['/contact', 5100], ['/robots.txt', 120],
];

/** Common usernames that internet-wide SSH scanners try. */
export const SCANNER_NAMES = ['admin', 'test', 'user', 'ubuntu', 'oracle', 'guest', 'ftp', 'pi', 'git', 'support'];

/** Calls `each` at random moments, averaging `perMin` a minute, between start and end. */
function every(r: Rng, start: number, end: number, perMin: number, each: (t: number) => void) {
  if (perMin <= 0) return;
  let t = start + r() * (60 / perMin);
  while (t < end) {
    each(Math.floor(t));
    t += (-Math.log(1 - r()) * 60) / perMin;
  }
}

/** Harmless traffic for the given sources. `busy` scales it down for night shifts. */
export function background(r: Rng, sources: Source[], start: number, end: number, busy = 1): Ev[] {
  const out: Ev[] = [];
  const has = (s: Source) => sources.includes(s);
  // At night only the on-call engineer is about; servers still look things up and talk to the internet.
  const staff = PEOPLE.filter(p => busy >= 1 || p.user === 'k.mensah');
  const clients: { ip: string }[] = busy >= 1 ? staff : [...staff, ...SERVERS, ...SERVERS];

  if (has('auth')) {
    // Health check every five minutes, deployments from the build server, admins doing admin things.
    for (let t = Math.ceil(start / 300) * 300; t < end; t += 300) out.push(auth.cron(t, '/usr/local/bin/healthcheck.sh'));
    every(r, start, end, 0.07 * busy, t => {
      out.push(...auth.accepted(t, 'deploy', '10.0.5.20', int(r, 40000, 60000), 'publickey'));
      out.push(auth.sudo(t + 4, 'deploy', '/usr/bin/systemctl reload nginx'));
      out.push(auth.closed(t + int(r, 20, 60), 'deploy'));
    });
    every(r, start, end, 0.03 * busy, t => {
      const admin = pick(r, ['s.ito', 'p.harris']);
      const ip = PEOPLE.find(p => p.user === admin)!.ip;
      if (r() < 0.35) out.push(...auth.failed(t - 9, admin, ip, int(r, 50000, 60000), false));
      out.push(...auth.accepted(t, admin, ip, int(r, 50000, 60000), 'publickey'));
      out.push(auth.sudo(t + int(r, 30, 200), admin, pick(r, ['/usr/bin/tail -n 50 /var/log/nginx/error.log', '/usr/bin/apt list --upgradable', '/usr/bin/df -h', '/usr/bin/systemctl status nginx'])));
      out.push(auth.closed(t + int(r, 300, 900), admin));
    });
    // The internet's background radiation: bots trying a name or two, then moving on.
    every(r, start, end, 0.12, t => {
      const ip = pick(r, PUBLIC_POOL);
      const tries = int(r, 1, 3);
      for (let i = 0; i < tries; i++) {
        const name = pick(r, SCANNER_NAMES);
        out.push(...auth.failed(t + i * 3, name, ip, int(r, 30000, 65000), true));
      }
    });
  }

  if (has('web')) {
    every(r, start, end, 6 * busy, t => {
      const ip = pick(r, PUBLIC_POOL);
      const [path, size] = pick(r, PATHS);
      const product = path === '/products' && r() < 0.6 ? `/products/${int(r, 1, 48)}` : path;
      const status = r() < 0.12 ? 304 : 200;
      out.push(web(t, ip, 'GET', product, status, status === 304 ? 0 : size + int(r, 0, 900), pick(r, UAS)));
      if (path === '/login' && r() < 0.5) out.push(web(t + int(r, 5, 30), ip, 'POST', '/login', 302, 410, pick(r, UAS), 'https://shop.fernco.example/login'));
    });
    every(r, start, end, 0.15, t => out.push(web(t, pick(r, PUBLIC_POOL), 'GET', pick(r, ['/old-catalogue', '/products/99', '/img/banner2.png']), 404, 512, pick(r, UAS))));
  }

  if (has('fw')) {
    every(r, start, end, 7 * busy, t => {
      const p = pick(r, clients);
      const [, ip] = pick(r, SITES);
      out.push(fw(t, 'allow', p.ip, int(r, 49152, 65000), ip, r() < 0.9 ? 443 : 80, int(r, 1200, 250000)));
    });
    every(r, start, end, 2, t => {
      const [port] = pick(r, [[23], [445], [3389], [1433], [5900], [8080]] as const);
      out.push(fw(t, 'deny', pick(r, PUBLIC_POOL), int(r, 30000, 65000), '192.0.2.10', port, 0));
    });
  }

  if (has('dns')) {
    every(r, start, end, 7 * busy, t => {
      const p = pick(r, clients);
      const [name, ip] = r() < 0.3 ? pick(r, INTERNAL_NAMES) : pick(r, SITES);
      out.push(dns(t, p.ip, name, 'A', ip));
    });
    every(r, start, end, 0.2 * Math.max(busy, 0.5), t => out.push(dns(t, pick(r, clients).ip, pick(r, ['wpad.fernco.example', 'printer3.fernco.example']), 'A', '-', 'NXDOMAIN')));
  }

  if (has('proxy')) {
    every(r, start, end, 4 * busy, t => {
      const p = pick(r, staff);
      const [name, , cat] = pick(r, SITES);
      const page = pick(r, ['/', '/home', '/api/v2/items', '/assets/main.js', '/search?q=report', '/inbox']);
      out.push(proxy(t, p.user, p.ip, 'GET', `https://${name}${page}`, 200, int(r, 900, 180000), cat));
    });
    every(r, start, end, 0.1 * busy, t => {
      const p = pick(r, staff);
      out.push(proxy(t, p.user, p.ip, 'GET', pick(r, ['https://bets.example/', 'https://free-games.example/play']), 403, 0, pick(r, ['gambling', 'games']), 'blocked'));
    });
  }

  if (has('edr')) {
    every(r, start, end, 1.5 * busy, t => {
      const p = pick(r, staff);
      const [parent, process, cmd] = pick(r, [
        ['explorer.exe', 'browser.exe', 'browser.exe --profile-default'],
        ['explorer.exe', 'outlook.exe', 'outlook.exe'],
        ['explorer.exe', 'winword.exe', `winword.exe C:\\Users\\${p.user}\\Documents\\notes.docx`],
        ['explorer.exe', 'excel.exe', `excel.exe C:\\Users\\${p.user}\\Documents\\budget.xlsx`],
        ['services.exe', 'svchost.exe', 'svchost.exe -k netsvcs'],
        ['svchost.exe', 'updater.exe', 'updater.exe /silent /check'],
        ['explorer.exe', 'chat.exe', 'chat.exe --minimized'],
      ] as const);
      out.push(edr(t, p.host, { event: 'process_start', user: p.user, parent, process, cmd }));
    });
  }

  if (has('win')) {
    const wb = busy >= 1 ? busy : busy * 0.3; // one person at night signs in far less than a full office
    every(r, start, end, 3 * wb, t => {
      const p = pick(r, staff);
      out.push(win(t, { EventID: '4624', user: p.user, src: p.ip, logon_type: r() < 0.8 ? '3' : '2', result: 'success' }));
    });
    every(r, start, end, 1 * wb, t => {
      const p = pick(r, staff);
      out.push(win(t, { EventID: '4634', user: p.user, src: p.ip, result: 'logoff' }));
    });
    every(r, start, end, 0.15 * wb, t => {
      const p = pick(r, staff);
      out.push(win(t, { EventID: '4625', user: p.user, src: p.ip, logon_type: '3', result: 'bad_password' }));
      out.push(win(t + int(r, 6, 20), { EventID: '4624', user: p.user, src: p.ip, logon_type: '3', result: 'success' }));
    });
  }

  if (has('idp')) {
    every(r, start, end, 1 * busy, t => {
      const p = pick(r, staff);
      const remote = r() < 0.3;
      out.push(idp(t, {
        user: p.user, src: remote ? '192.0.2.6' : '192.0.2.5', geo: remote ? 'Frankfurt, DE' : 'Lisbon, PT',
        device: p.host, mfa: 'approved', result: 'success',
      }));
    });
  }

  if (has('ids')) {
    // Everyday low-severity detections: the old intranet still takes sign-ins over plain HTTP, a news site's
    // certificate has expired, and the odd lookup of a dynamic DNS name.
    every(r, start, end, 0.08 * busy, t => {
      const p = pick(r, staff);
      out.push(ids(t, { sig: 'Policy: password sent over cleartext HTTP', severity: 'low', proto: 'tcp', src: p.ip, dst: '10.0.2.20', dpt: '80' }));
    });
    every(r, start, end, 0.12 * busy, t => {
      out.push(ids(t, { sig: 'TLS: server presented an expired certificate', severity: 'low', proto: 'tcp', src: pick(r, staff).ip, dst: '192.0.2.31', dpt: '443' }));
    });
    every(r, start, end, 0.03, t => {
      out.push(ids(t, { sig: 'DNS: lookup of a dynamic DNS domain', severity: 'low', proto: 'udp', src: pick(r, staff).ip, dst: '10.0.1.53', dpt: '53', query: pick(r, ['home-nas.dyn-dns.example', 'camera7.dyn-dns.example']) }));
    });
  }

  return out;
}
