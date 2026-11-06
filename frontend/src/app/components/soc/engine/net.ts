/**
 * The network as the SOC workstation sees it: Fernco's subnets and devices, the workstation's own interface, routes,
 * ARP cache and sockets, two DNS resolvers, and the packet captures a sensor saves. The network commands (ping,
 * traceroute, ip, ss, dig, tcpdump and friends) answer from this model, with output in the format the real tools
 * print, so what you read here reads the same on a real Linux box.
 *
 * From soc-ws: devices on 10.0.8.0/24 are on the same LAN; everything else in 10.0.0.0/8 is one router hop away,
 * through core-gw (10.0.8.1). The internet is not reachable: the edge firewall drops the workstation's traffic.
 */

import type { CmdCtx } from './commands';
import type { Result } from './shell';
import type { ShiftNet } from './model';
import { PEOPLE, SITES } from './env';
import { DAY, hms } from './events';
import { FilterError, Pkt, bpfFilter, inCidr, tcpdumpLine } from '../../networking/blocks/capture/packets';

export type Os = 'linux' | 'windows' | 'router';

export interface NetNode {
  name: string;
  ip: string;
  mac: string;
  os: Os;
  /** Answers ping. Windows laptops' firewalls drop it, which does not mean they are off. */
  ping: boolean;
  /** Has a DNS name (fernco.example). A device nobody registered has none. */
  dns?: boolean;
}

export const DOMAIN = 'fernco.example';
export const WS = { name: 'soc-ws', ip: '10.0.8.15', mac: '52:54:00:8a:0f:15', gw: '10.0.8.1', lan: '10.0.8.0/24', mask: '255.255.255.0', bcast: '10.0.8.255' };
export const RESOLVERS = { primary: '10.0.1.53', secondary: '10.0.1.54' };

/** The starting TTL each kind of system puts on its packets: the usual clue to what answered. */
const TTL0: Record<Os, number> = { linux: 64, windows: 128, router: 255 };

export const LAPTOP_MACS: Record<string, string> = {
  'LT-101': '28:d2:44:7a:10:65', 'LT-104': '54:ee:75:3c:91:04', 'LT-106': '9c:7b:ef:11:40:6a', 'LT-110': '70:cd:0d:44:8a:b2',
  'LT-114': 'f8:75:a4:22:6b:14', 'LT-115': 'd8:bb:c1:0e:73:5a', 'LT-118': 'a4:bb:6d:20:91:c3', 'LT-122': '3c:52:82:4a:19:7e',
  'LT-125': 'f4:5c:89:3b:12:07', 'LT-128': '8c:16:45:61:0a:28', 'LT-129': '8c:16:45:61:0a:29', 'LT-131': '48:2a:e3:5e:77:31',
};

const node = (name: string, ip: string, mac: string, os: Os, ping = os !== 'windows'): NetNode => ({ name, ip, mac, os, ping, dns: true });

export const NODES: NetNode[] = [
  node('core-gw', '10.0.8.1', '00:1a:2b:00:08:01', 'router'),
  node('fw-edge', '10.0.0.1', '00:1a:2b:00:00:01', 'router'),
  node('dc01', '10.0.1.5', '00:15:5d:01:00:05', 'windows', true),
  node('dns01', '10.0.1.53', '00:1a:2b:00:01:53', 'linux'),
  node('dns02', '10.0.1.54', '00:15:5d:01:00:54', 'linux'),
  node('proxy01', '10.0.1.80', '00:15:5d:01:00:80', 'linux'),
  node('web01', '10.0.2.10', '00:15:5d:02:00:10', 'linux'),
  node('intranet', '10.0.2.20', '00:15:5d:02:00:20', 'linux'),
  node('mail', '10.0.2.25', '00:15:5d:02:00:25', 'linux'),
  node('files', '10.0.2.30', '00:15:5d:02:00:30', 'windows', true),
  node('db02', '10.0.3.22', '00:15:5d:03:00:22', 'linux'),
  node('gw-floor2', '10.0.4.1', '00:1a:2b:00:04:01', 'router'),
  node('ci01', '10.0.5.20', '00:15:5d:05:00:20', 'linux'),
  node('bk01', '10.0.6.40', '00:15:5d:06:00:40', 'linux'),
  node('soc-ws', WS.ip, WS.mac, 'linux'),
  node('siem01', '10.0.8.20', '52:54:00:8a:0f:20', 'linux'),
  node('sensor01', '10.0.8.30', '52:54:00:8a:0f:30', 'linux'),
  node('sw-floor2', '10.0.9.2', '00:1e:7a:09:00:02', 'router'),
  node('scanner01', '10.0.9.5', '00:15:5d:09:00:05', 'linux'),
  ...PEOPLE.map(p => node(p.host, p.ip, LAPTOP_MACS[p.host] ?? '00:15:5d:04:00:00', 'windows')),
];

/** Port names from /etc/services, for tools that show names unless told -n. */
export const SERVICES: Record<number, string> = {
  20: 'ftp-data', 21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'domain', 67: 'bootps', 68: 'bootpc', 69: 'tftp', 80: 'http',
  88: 'kerberos', 110: 'pop3', 123: 'ntp', 143: 'imap2', 161: 'snmp', 162: 'snmp-trap', 389: 'ldap', 443: 'https', 465: 'submissions',
  514: 'syslog', 587: 'submission', 636: 'ldaps', 993: 'imaps', 995: 'pop3s', 1812: 'radius', 3306: 'mysql', 5432: 'postgresql',
  6514: 'syslog-tls', 8080: 'http-alt',
};
const svc = (port: number) => SERVICES[port] ?? String(port);

export const ETC_SERVICES = `# Network services, Internet style (an excerpt)
${Object.entries(SERVICES).map(([p, n]) => {
  const udpOnly = ['67', '68', '69', '123', '161', '162', '514', '1812'].includes(p);
  const both = ['53', '88', '389'].includes(p);
  return both ? `${n.padEnd(16)}${p}/tcp\n${n.padEnd(16)}${p}/udp` : `${n.padEnd(16)}${p}/${udpOnly ? 'udp' : 'tcp'}`;
}).join('\n')}
`;

interface Rr { name: string; ttl: number; type: string; value: string }
export type Rcode = 'NOERROR' | 'NXDOMAIN' | 'SERVFAIL' | 'TIMEOUT';
export interface DnsReply { rcode: Rcode; answers: Rr[]; aa: boolean; ms: number; server: string }

/** A small, repeatable hash, so pings and query ids come out the same every time. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const isIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
const reverseName = (ip: string) => ip.split('.').reverse().join('.') + '.in-addr.arpa';

export class Net {
  readonly nodes: NetNode[];
  private byIp = new Map<string, NetNode>();
  private records = new Map<string, Rr[]>();
  private caps = new Map<string, { at: number; build: () => Pkt[]; pkts?: Pkt[] }>();

  constructor(private now: () => number, extraNames: [string, string][] = [], private shift: ShiftNet = {}) {
    this.nodes = [...NODES, ...(shift.hosts ?? [])];
    for (const n of this.nodes) this.byIp.set(n.ip, n);
    const add = (name: string, type: string, value: string, ttl: number) => {
      const k = name.toLowerCase();
      this.records.set(k, [...(this.records.get(k) ?? []), { name: k, ttl, type, value }]);
    };
    for (const n of this.nodes) {
      if (!n.dns) continue;
      add(`${n.name.toLowerCase()}.${DOMAIN}`, 'A', n.ip, 3600);
      add(reverseName(n.ip), 'PTR', `${n.name.toLowerCase()}.${DOMAIN}.`, 3600);
    }
    for (const a of ['shop', 'www']) add(`${a}.${DOMAIN}`, 'A', '192.0.2.10', 3600);
    add(DOMAIN, 'MX', `10 mail.${DOMAIN}.`, 3600);
    add(DOMAIN, 'TXT', '"v=spf1 ip4:192.0.2.25 -all"', 3600);
    add(DOMAIN, 'NS', `dns01.${DOMAIN}.`, 3600);
    add(DOMAIN, 'NS', `dns02.${DOMAIN}.`, 3600);
    const seen = new Set<string>();
    for (const [name, ip] of [...SITES.map(([n, ip]) => [n, ip] as [string, string]), ...extraNames]) {
      if (name.endsWith(DOMAIN) || seen.has(name)) continue;
      seen.add(name);
      add(name, 'A', ip, 300);
    }
    for (const c of shift.captures ?? []) this.caps.set(c.path, { at: c.at, build: c.build });
  }

  node(ip: string) { return this.byIp.get(ip); }

  /** The DNS name of an address, if it has one. */
  nameOf(ip: string): string | undefined {
    const n = this.byIp.get(ip);
    return n?.dns ? `${n.name.toLowerCase()}.${DOMAIN}` : undefined;
  }

  private internal(q: string) {
    return q === DOMAIN || q.endsWith('.' + DOMAIN) || (q.endsWith('.in-addr.arpa') && q.split('.').reverse()[2] === '10');
  }

  /** Asks one DNS server one question. */
  query(qname: string, qtype: string, server: string): DnsReply {
    const q = qname.toLowerCase().replace(/\.$/, '');
    const type = qtype.toUpperCase();
    const ms = 1 + (hash(q + server) % 3);
    if (server !== RESOLVERS.primary && server !== RESOLVERS.secondary) return { rcode: 'TIMEOUT', answers: [], aa: false, ms: 0, server };
    if (this.internal(q)) {
      const rrs = this.records.get(q);
      if (!rrs) return { rcode: 'NXDOMAIN', answers: [], aa: true, ms, server };
      return { rcode: 'NOERROR', answers: rrs.filter(r => r.type === type || type === 'ANY'), aa: true, ms, server };
    }
    const fault = this.shift.dnsFault;
    if (fault && fault.server === server && this.now() >= fault.from) return { rcode: 'SERVFAIL', answers: [], aa: false, ms: 3000 + (hash(q) % 90), server };
    const rrs = this.records.get(q);
    const ext = 12 + (hash(q + 'x') % 30);
    if (!rrs) return { rcode: 'NXDOMAIN', answers: [], aa: false, ms: ext, server };
    return { rcode: 'NOERROR', answers: rrs.filter(r => r.type === type || type === 'ANY'), aa: false, ms: ext, server };
  }

  /**
   * Resolves a host name the way ping and ssh do: /etc/hosts, then DNS through the primary resolver, trying the
   * search domain (fernco.example) for names without a dot first.
   */
  lookupHost(name: string): { ip: string; name: string } | 'unknown' | 'temporary' {
    if (isIp(name)) return { ip: name, name };
    const lower = name.toLowerCase().replace(/\.$/, '');
    if (lower === 'localhost') return { ip: '127.0.0.1', name: 'localhost' };
    if (lower === 'soc-ws') return { ip: WS.ip, name: 'soc-ws' };
    const tries = lower.includes('.') ? [lower, `${lower}.${DOMAIN}`] : [`${lower}.${DOMAIN}`, lower];
    let failed = false;
    for (const t of tries) {
      const r = this.query(t, 'A', RESOLVERS.primary);
      if (r.rcode === 'SERVFAIL') failed = true;
      if (r.rcode === 'NOERROR' && r.answers.length) return { ip: r.answers[0].value, name: t };
    }
    return failed ? 'temporary' : 'unknown';
  }

  /** What a ping from soc-ws to this address gets back. */
  reach(ip: string): { kind: 'reply'; ttl: number; base: number } | { kind: 'silent' } | { kind: 'no-arp' } {
    if (ip.startsWith('127.')) return { kind: 'reply', ttl: 64, base: 0.03 };
    if (ip === WS.ip) return { kind: 'reply', ttl: 64, base: 0.04 };
    const n = this.byIp.get(ip);
    if (inCidr(ip, WS.lan)) return n ? { kind: 'reply', ttl: TTL0[n.os], base: 0.3 } : { kind: 'no-arp' };
    if (!inCidr(ip, '10.0.0.0/8')) return { kind: 'silent' };
    if (!n || !n.ping) return { kind: 'silent' };
    return { kind: 'reply', ttl: TTL0[n.os] - 1, base: 0.7 };
  }

  /** The routers a packet passes on its way to `ip`, then the destination itself (null where nothing answers). */
  path(ip: string): { hops: (string | null)[]; reached: boolean } {
    if (ip.startsWith('127.') || ip === WS.ip) return { hops: [ip], reached: true };
    const n = this.byIp.get(ip);
    if (inCidr(ip, WS.lan)) return n ? { hops: [ip], reached: true } : { hops: [], reached: false };
    if (ip === WS.gw) return { hops: [ip], reached: true };
    if (!inCidr(ip, '10.0.0.0/8')) return { hops: [WS.gw, '10.0.0.1'], reached: false };
    if (ip === '10.0.0.1') return { hops: [WS.gw, ip], reached: true };
    return n?.ping ? { hops: [WS.gw, ip], reached: true } : { hops: [WS.gw], reached: false };
  }

  /** Milliseconds for one probe, repeatable. */
  rtt(ip: string, seq: number, base: number) {
    return base * (0.8 + (hash(`${ip}#${seq}`) % 1000) / 2000);
  }

  isCapture(path: string) { return this.caps.has(path); }

  /** The packets of a saved capture, once the sensor has written it. */
  capture(path: string): Pkt[] | undefined {
    const c = this.caps.get(path);
    if (!c || c.at > this.now()) return undefined;
    return (c.pkts ??= c.build());
  }

  /** The workstation's ARP cache: only devices on its own LAN that it has talked to. */
  arpCache(): { ip: string; mac: string; state: string }[] {
    return [
      { ip: WS.gw, mac: '00:1a:2b:00:08:01', state: 'REACHABLE' },
      { ip: '10.0.8.20', mac: '52:54:00:8a:0f:20', state: 'REACHABLE' },
      { ip: '10.0.8.30', mac: '52:54:00:8a:0f:30', state: 'STALE' },
    ];
  }

  clock() { return this.now(); }
}

// ── Helpers ───────────────────────────────────────────────────────────────

type Cmd = (c: CmdCtx) => Result;
const ok = (out = ''): Result => ({ out, code: 0 });
const fail = (c: CmdCtx, msg: string, code = 1): Result => { c.sh.err += `${msg}\n`; return { out: '', code }; };
const lines = (xs: string[]) => (xs.length ? xs.join('\n') + '\n' : '');

/** Short options: -abc, -c 4, -c4. Returns the bad option letter when there is one. */
function opts(args: string[], flags: string, withVal: string) {
  const f = new Set<string>();
  const v = new Map<string, string>();
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { rest.push(...args.slice(i + 1)); break; }
    if (a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const ch = a[j];
        if (withVal.includes(ch)) {
          const val = j + 1 < a.length ? a.slice(j + 1) : args[++i];
          if (val === undefined) return { f, v, rest, bad: ch, missing: true };
          v.set(ch, val);
          break;
        }
        if (!flags.includes(ch)) return { f, v, rest, bad: ch, missing: false };
        f.add(ch);
      }
      continue;
    }
    rest.push(a);
  }
  return { f, v, rest, bad: undefined as string | undefined, missing: false };
}

function netOf(c: CmdCtx): Net | undefined { return c.sh.host.net; }

const pad = (s: string, n: number) => s.padEnd(n);
const ms = (x: number) => (x < 1 ? x.toFixed(3) : x < 10 ? x.toFixed(2) : x < 100 ? x.toFixed(1) : x.toFixed(0));
const when = (t: number) => `Thu Nov 05 ${hms(t)} UTC ${DAY.slice(0, 4)}`;

// ── ping and traceroute ───────────────────────────────────────────────────

const ping: Cmd = c => {
  const net = netOf(c);
  const o = opts(c.args, 'nq4vD', 'cWiwst');
  if (o.bad) return fail(c, o.missing ? `ping: option requires an argument -- '${o.bad}'` : `ping: invalid option -- '${o.bad}'\nTry 'man ping' for the options this workstation supports.`, 2);
  const target = o.rest[0];
  if (!target) return fail(c, 'ping: usage error: Destination address required');
  if (!net) return fail(c, 'ping: network unavailable', 2);
  const count = Math.min(20, Math.max(1, Number(o.v.get('c') ?? 4) || 4));
  const found = net.lookupHost(target);
  if (found === 'unknown') return fail(c, `ping: ${target}: Name or service not known`, 2);
  if (found === 'temporary') return fail(c, `ping: ${target}: Temporary failure in name resolution`, 2);
  const numeric = isIp(target);
  const shown = numeric ? found.ip : found.name;
  const from = numeric || o.f.has('n') ? found.ip : `${found.name} (${found.ip})`;
  const r = net.reach(found.ip);
  const out = [`PING ${shown} (${found.ip}) 56(84) bytes of data.`];
  const times: number[] = [];
  for (let i = 1; i <= count; i++) {
    if (r.kind === 'reply') {
      const t = net.rtt(found.ip, i, r.base);
      times.push(t);
      if (!o.f.has('q')) out.push(`64 bytes from ${from}: icmp_seq=${i} ttl=${r.ttl} time=${ms(t)} ms`);
    } else if (r.kind === 'no-arp' && !o.f.has('q')) out.push(`From ${WS.ip} icmp_seq=${i} Destination Host Unreachable`);
  }
  const recv = times.length;
  const loss = Math.round(((count - recv) / count) * 100);
  out.push('', `--- ${shown} ping statistics ---`,
    `${count} packets transmitted, ${recv} received, ${r.kind === 'no-arp' ? `+${count} errors, ` : ''}${loss}% packet loss, time ${(count - 1) * 1001 + (count > 1 ? 2 : 0)}ms`);
  if (recv) {
    const avg = times.reduce((a, b) => a + b, 0) / recv;
    const mdev = Math.sqrt(times.reduce((a, b) => a + (b - avg) ** 2, 0) / recv);
    out.push(`rtt min/avg/max/mdev = ${Math.min(...times).toFixed(3)}/${avg.toFixed(3)}/${Math.max(...times).toFixed(3)}/${mdev.toFixed(3)} ms`);
  }
  return { out: lines(out), code: recv ? 0 : 1 };
};

const traceroute: Cmd = c => {
  const net = netOf(c);
  const o = opts(c.args, 'nI4', 'mqwf');
  if (o.bad) return fail(c, `Bad option \`-${o.bad}' (argc 1)`, 2);
  const target = o.rest[0];
  if (!target) return fail(c, 'Usage: traceroute [ -n ] [ -m max_ttl ] host', 2);
  if (!net) return fail(c, 'traceroute: network unavailable', 2);
  const found = net.lookupHost(target);
  if (typeof found === 'string') return fail(c, `${target}: ${found === 'temporary' ? 'Temporary failure in name resolution' : 'Name or service not known'}\nCannot handle "host" cmdline arg \`${target}' on position 1 (argc 1)`, 2);
  const max = Math.min(30, Math.max(1, Number(o.v.get('m') ?? 30) || 30));
  const label = (ip: string) => (o.f.has('n') ? ip : `${net.nameOf(ip) ?? ip} (${ip})`);
  const out = [`traceroute to ${isIp(target) ? found.ip : found.name} (${found.ip}), ${max} hops max, 60 byte packets`];
  const { hops, reached } = net.path(found.ip);
  for (let h = 1; h <= max; h++) {
    const ip = hops[h - 1];
    if (ip) {
      const base = ip === found.ip && !inCidr(ip, WS.lan) ? 0.8 : 0.35;
      out.push(`${String(h).padStart(2)}  ${label(ip)}  ${[1, 2, 3].map(k => `${net.rtt(ip, h * 10 + k, base).toFixed(3)} ms`).join('  ')}`);
      if (ip === found.ip && reached) break;
    } else out.push(`${String(h).padStart(2)}  * * *`);
  }
  return ok(lines(out));
};

// ── Interfaces, routes, neighbours ────────────────────────────────────────

const LO_LINK = ['1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000', '    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00'];
const ETH_LINK = ['2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000', `    link/ether ${WS.mac} brd ff:ff:ff:ff:ff:ff`];

const ip: Cmd = c => {
  const net = netOf(c);
  const args = c.args.filter(a => !['-4', '-c', '-color', '--color'].includes(a));
  const brief = args.includes('-br') || args.includes('-brief');
  const words = args.filter(a => !a.startsWith('-'));
  const obj = words[0];
  if (!obj) return fail(c, 'Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\n       OBJECT := { address | route | neigh | link }', 255);
  const is = (...names: string[]) => names.includes(obj);
  if (is('a', 'addr', 'address')) {
    if (brief) return ok(lines([`${pad('lo', 17)}UNKNOWN        127.0.0.1/8`, `${pad('eth0', 17)}UP             ${WS.ip}/24`]));
    return ok(lines([
      ...LO_LINK, '    inet 127.0.0.1/8 scope host lo', '       valid_lft forever preferred_lft forever',
      ...ETH_LINK, `    inet ${WS.ip}/24 brd ${WS.bcast} scope global eth0`, '       valid_lft forever preferred_lft forever',
    ]));
  }
  if (is('l', 'link')) {
    if (brief) return ok(lines([`${pad('lo', 17)}UNKNOWN        00:00:00:00:00:00 <LOOPBACK,UP,LOWER_UP>`, `${pad('eth0', 17)}UP             ${WS.mac} <BROADCAST,MULTICAST,UP,LOWER_UP>`]));
    return ok(lines([...LO_LINK, ...ETH_LINK]));
  }
  if (is('r', 'ro', 'route')) {
    return ok(lines([`default via ${WS.gw} dev eth0 proto static metric 100`, `10.0.8.0/24 dev eth0 proto kernel scope link src ${WS.ip} metric 100`]));
  }
  if (is('n', 'neigh', 'neighbor', 'neighbour')) {
    return ok(lines((net?.arpCache() ?? []).map(e => `${e.ip} dev eth0 lladdr ${e.mac} ${e.state}`)));
  }
  if (is('help')) return ok('Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }\n       OBJECT := { address | route | neigh | link }\n');
  return fail(c, `Object "${obj}" is unknown, try "ip help".`, 1);
};

const ifconfig: Cmd = c => {
  const eth = [
    'eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500',
    `        inet ${WS.ip}  netmask ${WS.mask}  broadcast ${WS.bcast}`,
    `        ether ${WS.mac}  txqueuelen 1000  (Ethernet)`,
    '        RX packets 1048213  bytes 912384213 (912.3 MB)',
    '        TX packets 402871  bytes 61203344 (61.2 MB)',
    '',
  ];
  const lo = [
    'lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536',
    '        inet 127.0.0.1  netmask 255.0.0.0',
    '        loop  txqueuelen 1000  (Local Loopback)',
    '        RX packets 5120  bytes 448210 (448.2 KB)',
    '        TX packets 5120  bytes 448210 (448.2 KB)',
    '',
  ];
  const which = c.args.filter(a => !a.startsWith('-'))[0];
  if (which === 'eth0') return ok(lines(eth));
  if (which === 'lo') return ok(lines(lo));
  if (which) return fail(c, `${which}: error fetching interface information: Device not found`);
  return ok(lines([...eth, ...lo]));
};

function routeTable(numeric: boolean): string[] {
  return [
    'Kernel IP routing table',
    'Destination     Gateway         Genmask         Flags Metric Ref    Use Iface',
    `${pad(numeric ? '0.0.0.0' : 'default', 16)}${pad(numeric ? WS.gw : '_gateway', 16)}0.0.0.0         UG    100    0        0 eth0`,
    `${pad('10.0.8.0', 16)}${pad(numeric ? '0.0.0.0' : '0.0.0.0', 16)}255.255.255.0   U     100    0        0 eth0`,
  ];
}

const route: Cmd = c => ok(lines(routeTable(c.args.some(a => /^-\w*n/.test(a)))));

const arp: Cmd = c => {
  const net = netOf(c);
  const o = opts(c.args, 'anve', 'i');
  if (o.bad) return fail(c, `arp: invalid option -- '${o.bad}'`);
  const cache = net?.arpCache() ?? [];
  const nameFor = (ipAddr: string) => (ipAddr === WS.gw ? '_gateway' : net?.nameOf(ipAddr) ?? '?');
  if (o.f.has('a')) {
    return ok(lines(cache.map(e => `${o.f.has('n') ? '?' : nameFor(e.ip)} (${e.ip}) at ${e.mac} [ether] on eth0`)));
  }
  return ok(lines(['Address                  HWtype  HWaddress           Flags Mask            Iface',
    ...cache.map(e => `${pad(o.f.has('n') ? e.ip : nameFor(e.ip), 25)}ether   ${e.mac}   C                     eth0`)]));
};

// ── Sockets: ss and netstat ───────────────────────────────────────────────

interface Sock { proto: 'tcp' | 'udp'; v6?: boolean; state: string; local: [string, number]; peer: [string, string | number]; proc: string; pid: number; own?: boolean; recvq?: number; sendq?: number }

const SOCKETS: Sock[] = [
  { proto: 'tcp', state: 'LISTEN', local: ['0.0.0.0', 22], peer: ['0.0.0.0', '*'], proc: 'sshd', pid: 812, sendq: 128 },
  { proto: 'tcp', v6: true, state: 'LISTEN', local: ['[::]', 22], peer: ['[::]', '*'], proc: 'sshd', pid: 812, sendq: 128 },
  { proto: 'udp', state: 'UNCONN', local: ['127.0.0.1', 323], peer: ['0.0.0.0', '*'], proc: 'chronyd', pid: 640 },
  { proto: 'tcp', state: 'ESTAB', local: [WS.ip, 44812], peer: ['10.0.8.20', 443], proc: 'soc-console', pid: 2311, own: true },
  { proto: 'tcp', state: 'ESTAB', local: [WS.ip, 44818], peer: ['10.0.8.20', 443], proc: 'soc-console', pid: 2311, own: true },
  { proto: 'tcp', state: 'ESTAB', local: [WS.ip, 38114], peer: ['10.0.8.20', 6514], proc: 'rsyslogd', pid: 701 },
  { proto: 'tcp', state: 'TIME-WAIT', local: [WS.ip, 50992], peer: ['10.0.8.30', 443], proc: '', pid: 0 },
];

const listening = (s: Sock) => s.state === 'LISTEN' || s.state === 'UNCONN';

function pickSockets(f: Set<string>): Sock[] {
  const types = f.has('t') || f.has('u') ? SOCKETS.filter(s => (f.has('t') && s.proto === 'tcp') || (f.has('u') && s.proto === 'udp')) : SOCKETS;
  return types.filter(s => (f.has('a') ? true : f.has('l') ? listening(s) : !listening(s)));
}

function table(rows: string[][], right: number[] = []): string[] {
  const w = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)));
  return rows.map(r => r.map((cell, i) => (i === r.length - 1 ? cell : right.includes(i) ? cell.padStart(w[i]) : cell.padEnd(w[i]))).join('  ').trimEnd());
}

const ss: Cmd = c => {
  const net = netOf(c);
  const o = opts(c.args, 'tulanpr4e', '');
  if (o.bad) return fail(c, `ss: invalid option -- '${o.bad}'\nTry 'man ss' for the options this workstation supports.`);
  const socks = pickSockets(o.f);
  const name = (port: number | string) => (typeof port === 'number' && !o.f.has('n') ? svc(port) : String(port));
  const host = (h: string) => (o.f.has('r') ? net?.nameOf(h) ?? h : h);
  const netid = !(o.f.has('t') !== o.f.has('u'));
  const head = [...(netid ? ['Netid'] : []), 'State', 'Recv-Q', 'Send-Q', 'Local Address:Port', 'Peer Address:Port', 'Process'];
  const rows = socks.map(s => [
    ...(netid ? [s.proto] : []), s.state, String(s.recvq ?? 0), String(s.sendq ?? 0),
    `${host(s.local[0])}:${name(s.local[1])}`, `${host(s.peer[0])}:${name(s.peer[1])}`,
    o.f.has('p') && s.own ? `users:(("${s.proc}",pid=${s.pid},fd=21))` : '',
  ]);
  const off = netid ? 1 : 0;
  return ok(lines(table([head, ...rows], [off + 3, off + 4])));
};

const netstat: Cmd = c => {
  const net = netOf(c);
  const o = opts(c.args, 'tulanpre46W', '');
  if (o.bad) return fail(c, `netstat: invalid option -- '${o.bad}'`);
  if (o.f.has('r')) return ok(lines(routeTable(o.f.has('n'))));
  const socks = pickSockets(o.f);
  const name = (port: number | string) => (typeof port === 'number' && !o.f.has('n') ? svc(port) : String(port));
  const host = (h: string) => (h === '[::]' ? '::' : o.f.has('n') || h === '0.0.0.0' ? h : net?.nameOf(h) ?? h);
  const state = (s: Sock) => (s.proto === 'udp' ? '' : s.state === 'ESTAB' ? 'ESTABLISHED' : s.state.replace('-', '_'));
  const title = o.f.has('a') ? '(servers and established)' : o.f.has('l') ? '(only servers)' : '(w/o servers)';
  const out = [`Active Internet connections ${title}`,
    `Proto Recv-Q Send-Q Local Address           Foreign Address         State      ${o.f.has('p') ? ' PID/Program name' : ''}`.trimEnd()];
  for (const s of socks) {
    const local = `${host(s.local[0])}:${name(s.local[1])}`;
    const peer = s.peer[1] === '*' ? `${s.v6 ? '::' : '0.0.0.0'}:*` : `${host(s.peer[0])}:${name(s.peer[1])}`;
    const pid = o.f.has('p') ? ` ${s.own ? `${s.pid}/${s.proc}` : '-'}` : '';
    out.push(`${pad(s.proto + (s.v6 ? '6' : ''), 6)}${String(s.recvq ?? 0).padStart(6)} ${String(s.sendq ?? 0).padStart(6)} ${pad(local, 23)} ${pad(peer, 23)} ${pad(state(s), 11)}${pid}`.trimEnd());
  }
  if (o.f.has('p')) c.sh.err += '(Not all processes could be identified, non-owned process info\n will not be shown, you would have to be root to see it all.)\n';
  return ok(lines(out));
};

// ── DNS: dig, nslookup, host ──────────────────────────────────────────────

const TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'PTR', 'CNAME', 'SOA', 'ANY'];

const dig: Cmd = c => {
  const net = netOf(c);
  if (!net) return fail(c, 'dig: network unavailable');
  let server = RESOLVERS.primary;
  let explicit = false;
  let type = 'A';
  let name: string | undefined;
  let short = false;
  let reverse = false;
  for (let i = 0; i < c.args.length; i++) {
    const a = c.args[i];
    if (a.startsWith('@')) { server = a.slice(1); explicit = true; }
    else if (a === '+short') short = true;
    else if (a.startsWith('+')) { /* other display options are accepted and ignored */ }
    else if (a === '-x') { reverse = true; name = c.args[++i]; }
    else if (a === '-t') type = (c.args[++i] ?? 'A').toUpperCase();
    else if (TYPES.includes(a.toUpperCase()) && name !== undefined) type = a.toUpperCase();
    else if (a.startsWith('-')) return fail(c, `Invalid option: ${a}\nTry 'man dig' for the options this workstation supports.`);
    else if (name === undefined) name = a;
    else if (TYPES.includes(a.toUpperCase())) type = a.toUpperCase();
  }
  if (name === undefined) return fail(c, 'usage: dig [@server] name [type] [+short]   (for example: dig shop.fernco.example)');
  if (!isIp(server)) {
    const s = net.lookupHost(server);
    if (typeof s === 'string') return fail(c, `dig: couldn't get address for '${server}': not found`, 10);
    server = s.ip;
  }
  const qname = reverse ? reverseName(name) : name.replace(/\.$/, '');
  if (reverse) type = 'PTR';
  const r = net.query(qname, type, server);
  const head = `; <<>> DiG 9.18.28 <<>> ${c.args.join(' ')}`;
  if (r.rcode === 'TIMEOUT') {
    const err = `;; communications error to ${server}#53: timed out\n`.repeat(3);
    return { out: short ? '' : `${err}\n${head}\n${explicit ? '; (1 server found)\n' : ''};; global options: +cmd\n;; no servers could be reached\n`, code: 9 };
  }
  const rr = (x: Rr) => `${x.name}.\t${x.ttl}\tIN\t${x.type}\t${x.value}`;
  if (short) return ok(lines(r.answers.map(a => a.value)));
  const id = hash(qname + server + net.clock()) % 65536;
  const size = 12 + qname.length + 6 + r.answers.reduce((s, a) => s + 12 + a.value.length, 0) + 11;
  return ok([
    '', head, ';; global options: +cmd', ';; Got answer:',
    `;; ->>HEADER<<- opcode: QUERY, status: ${r.rcode}, id: ${id}`,
    `;; flags: qr${r.aa ? ' aa' : ''} rd ra; QUERY: 1, ANSWER: ${r.answers.length}, AUTHORITY: 0, ADDITIONAL: 1`,
    '', ';; OPT PSEUDOSECTION:', '; EDNS: version: 0, flags:; udp: 1232', ';; QUESTION SECTION:', `;${qname}.\t\t\tIN\t${type}`,
    ...(r.answers.length ? ['', ';; ANSWER SECTION:', ...r.answers.map(rr)] : []),
    '', `;; Query time: ${r.ms} msec`, `;; SERVER: ${server}#53(${server}) (UDP)`, `;; WHEN: ${when(net.clock())}`, `;; MSG SIZE  rcvd: ${size}`, '', '',
  ].join('\n'));
};

const nslookup: Cmd = c => {
  const net = netOf(c);
  if (!net) return fail(c, 'nslookup: network unavailable');
  let type = 'A';
  const words: string[] = [];
  for (const a of c.args) {
    const m = /^-(?:type|query|q|t)=(\w+)$/i.exec(a);
    if (m) type = m[1].toUpperCase();
    else if (a.startsWith('-')) return fail(c, `*** Invalid option: ${a.slice(1)}`);
    else words.push(a);
  }
  const [name, srv] = words;
  if (!name) return fail(c, 'usage: nslookup [-type=TYPE] name [server]   (interactive mode is not available here)');
  let server = RESOLVERS.primary;
  if (srv) {
    const s = net.lookupHost(srv);
    if (typeof s === 'string') return fail(c, `nslookup: couldn't get address for '${srv}': not found`);
    server = s.ip;
  }
  const headLines = [`Server:\t\t${server}`, `Address:\t${server}#53`, ''];
  if (isIp(name)) {
    const r = net.query(reverseName(name), 'PTR', server);
    if (r.rcode === 'TIMEOUT') return { out: ';; connection timed out; no servers could be reached\n\n', code: 1 };
    if (!r.answers.length) return { out: lines(headLines) + `** server can't find ${reverseName(name)}: ${r.rcode === 'NOERROR' ? 'NXDOMAIN' : r.rcode}\n\n`, code: 1 };
    return ok(lines([...r.answers.map(a => `${a.name}\tname = ${a.value}`), '']));
  }
  // The search domain is tried for names without a dot.
  const tries = name.includes('.') ? [name] : [`${name}.${DOMAIN}`, name];
  let last: DnsReply | undefined;
  for (const q of tries) {
    last = net.query(q, type, server);
    if (last.rcode === 'TIMEOUT') return { out: ';; connection timed out; no servers could be reached\n\n', code: 1 };
    if (last.rcode === 'NOERROR') {
      const body = last.answers.map(a =>
        a.type === 'A' ? `Name:\t${a.name}\nAddress: ${a.value}` : a.type === 'MX' ? `${a.name}\tmail exchanger = ${a.value}` : a.type === 'NS' ? `${a.name}\tnameserver = ${a.value}` : a.type === 'TXT' ? `${a.name}\ttext = ${a.value}` : `${a.name}\t${a.type.toLowerCase()} = ${a.value}`);
      return ok(lines([...headLines, ...(last.aa ? [] : ['Non-authoritative answer:']), ...(body.length ? body : [`*** Can't find ${q}: No answer`]), '']));
    }
  }
  return { out: lines(headLines) + `** server can't find ${name}: ${last!.rcode}\n\n`, code: 1 };
};

const host: Cmd = c => {
  const net = netOf(c);
  if (!net) return fail(c, 'host: network unavailable');
  const o = opts(c.args, 'av4', 't');
  if (o.bad) return fail(c, `host: invalid option -- '${o.bad}'`);
  const [name, srv] = o.rest;
  if (!name) return fail(c, 'Usage: host [-t type] name [server]');
  let server = RESOLVERS.primary;
  const pre: string[] = [];
  if (srv) {
    const s = net.lookupHost(srv);
    if (typeof s === 'string') return fail(c, `host: couldn't get address for '${srv}': not found`);
    server = s.ip;
    pre.push('Using domain server:', `Name: ${srv}`, `Address: ${server}#53`, 'Aliases: ', '');
  }
  if (isIp(name)) {
    const r = net.query(reverseName(name), 'PTR', server);
    if (r.rcode === 'TIMEOUT') return { out: `;; communications error to ${server}#53: timed out\n;; no servers could be reached\n`, code: 1 };
    if (!r.answers.length) return { out: lines([...pre, `Host ${reverseName(name)} not found: 3(NXDOMAIN)`]), code: 1 };
    return ok(lines([...pre, ...r.answers.map(a => `${reverseName(name)} domain name pointer ${a.value}`)]));
  }
  const types = o.v.has('t') ? [o.v.get('t')!.toUpperCase()] : ['A', 'MX'];
  const q = name.includes('.') ? name : `${name}.${DOMAIN}`;
  const out = [...pre];
  for (const t of types) {
    const r = net.query(q, t, server);
    if (r.rcode === 'TIMEOUT') return { out: `;; communications error to ${server}#53: timed out\n;; no servers could be reached\n`, code: 1 };
    if (r.rcode !== 'NOERROR') return { out: lines([...out, `Host ${name} not found: ${r.rcode === 'SERVFAIL' ? '2(SERVFAIL)' : '3(NXDOMAIN)'}`]), code: 1 };
    for (const a of r.answers) {
      out.push(a.type === 'A' ? `${q} has address ${a.value}` : a.type === 'MX' ? `${q} mail is handled by ${a.value}` : a.type === 'NS' ? `${q} name server ${a.value}` : a.type === 'TXT' ? `${q} descriptive text ${a.value}` : `${q} ${a.type} ${a.value}`);
    }
    if (o.v.has('t') && !r.answers.length) out.push(`${q} has no ${t} record`);
  }
  return ok(lines(out));
};

// ── tcpdump: reading saved captures ───────────────────────────────────────

const tcpdump: Cmd = c => {
  const net = netOf(c);
  const o = opts(c.args, 'neAtqvpSlNK', 'rcsiwC');
  if (o.bad) return fail(c, o.missing ? `tcpdump: option requires an argument -- '${o.bad}'` : `tcpdump: invalid option -- '${o.bad}'\nTry 'man tcpdump' for the options this workstation supports.`);
  if (o.v.has('w')) return fail(c, 'tcpdump: writing capture files is not available on this workstation; read the saved ones with -r');
  const file = o.v.get('r');
  if (!file) {
    return fail(c, `tcpdump: ${o.v.get('i') ?? 'eth0'}: You don't have permission to perform this capture on that device\n(socket: Operation not permitted)\nThe sensor saves captures in /var/captures: read one with tcpdump -r /var/captures/FILE`);
  }
  const path = c.sh.vfs.resolve(c.sh.cwd, file);
  if (!c.sh.vfs.isFile(path)) return fail(c, `tcpdump: ${file}: No such file or directory`);
  const pkts = net?.capture(path);
  if (!pkts) return fail(c, `tcpdump: ${file}: unknown file format`);
  let pred: (p: Pkt) => boolean;
  try {
    pred = bpfFilter(o.rest.join(' '));
  } catch (e) {
    if (e instanceof FilterError) return fail(c, `tcpdump: ${e.message}`);
    throw e;
  }
  c.sh.err += `reading from file ${file}, link-type EN10MB (Ethernet), snapshot length 262144\n`;
  const limit = o.v.has('c') ? Math.max(1, Number(o.v.get('c')) || 1) : Infinity;
  const numeric = o.f.has('n');
  const out: string[] = [];
  let shown = 0;
  for (const p of pkts) {
    if (shown >= limit) break;
    if (!pred(p)) continue;
    shown++;
    let line = tcpdumpLine(numeric || !net ? p : named(p, net), { e: o.f.has('e') });
    if (o.f.has('t')) line = line.replace(/^\S+ /, '');
    out.push(line);
    if (o.f.has('A') && p.app?.text) out.push(...p.app.text.replace(/\r/g, '').split('\n').filter((l, i, a) => i < a.length - 1 || l));
  }
  return ok(lines(out));
};

/** The packet with names in place of addresses and ports, as tcpdump prints it without -n. */
function named(p: Pkt, net: Net): Pkt {
  const h = (ipAddr: string) => net.nameOf(ipAddr) ?? ipAddr;
  const q: Pkt = { ...p };
  if (p.ip) q.ip = { ...p.ip, src: h(p.ip.src), dst: h(p.ip.dst) };
  if (p.tcp) q.tcp = { ...p.tcp, sport: svc(p.tcp.sport) as unknown as number, dport: svc(p.tcp.dport) as unknown as number };
  if (p.udp) q.udp = { ...p.udp, sport: svc(p.udp.sport) as unknown as number, dport: svc(p.udp.dport) as unknown as number };
  if (p.arp) q.arp = { ...p.arp, senderIp: h(p.arp.senderIp), targetIp: h(p.arp.targetIp) };
  return q;
}

/** What `cat` shows for a capture file: it is binary, made for tcpdump. */
export const PCAP_TEXT = 'ÔÃ²¡\u0002\u0000\u0004\u0000 (binary packet capture: read it with tcpdump -r)\n';

export const NET_COMMANDS: Record<string, Cmd> = {
  ping, traceroute, tracepath: traceroute, ip, ifconfig, route, arp, ss, netstat, dig, nslookup, host, tcpdump,
};

export const NET_MAN: Record<string, string> = {
  ping: 'ping [-c COUNT] [-n] [-q] HOST\n  Send ICMP echo requests and wait for replies. Here it stops after 4 unless -c says otherwise\n  (a real ping runs until Ctrl+C). ttl= in each reply hints at the system: about 64 Linux, 128 Windows,\n  255 network devices, minus one for each router on the way. No reply does not mean the host is off:\n  many firewalls drop ping. Exit status 0 if any reply came back, 1 if none.\n  ping -c 2 dc01',
  traceroute: 'traceroute [-n] [-m MAX_HOPS] HOST\n  Show each router on the way to HOST, by sending probes with TTL 1, 2, 3... Each router that drops a probe\n  says so, and that reveals it. * * * means no answer at that hop (often a firewall). -n skips name lookups.\n  traceroute -n web01',
  ip: 'ip addr | ip route | ip neigh | ip link   (short forms: ip a, ip r, ip n; -br for one line each)\n  This machine\'s addresses (inet = IPv4 address/prefix length), its routing table (the default route is\n  the gateway for everything else), and its neighbour (ARP) cache: MAC addresses of devices on the same LAN.',
  ifconfig: 'ifconfig [INTERFACE]\n  The older way to show interfaces and addresses. ip addr shows the same.',
  route: 'route -n\n  The routing table in the older format. ip route shows the same. UG = a route through a gateway.',
  arp: 'arp -a | arp -n\n  The ARP cache: which MAC address answers for each IP on this LAN. Devices on other subnets never\n  appear here: traffic to them goes to the gateway\'s MAC.',
  ss: 'ss [-t] [-u] [-l] [-a] [-n] [-p]\n  Sockets: -t TCP, -u UDP, -l listening only, -a all, -n numbers instead of service names, -p the process\n  (yours only, unless you are root). LISTEN = waiting for connections; ESTAB = connected.\n  ss -tuln     what this machine is listening on',
  netstat: 'netstat [-t] [-u] [-l] [-a] [-n] [-p] [-r]\n  The older tool for sockets (ss shows the same). -r prints the routing table.\n  netstat -tuln',
  dig: 'dig [@SERVER] NAME [TYPE] [+short]   or   dig -x IP\n  Ask a DNS server a question and show the whole answer. status: NOERROR (answered), NXDOMAIN (no such\n  name), SERVFAIL (the server could not get an answer). TYPE: A, MX, TXT, NS, PTR. @SERVER asks that server\n  instead of the one in /etc/resolv.conf. dig does not add the search domain: use full names.\n  dig shop.fernco.example      dig @10.0.1.54 crm.saas-vendor.example +short      dig -x 10.0.1.5',
  nslookup: 'nslookup [-type=TYPE] NAME [SERVER]\n  Look a name up (or an IP, for its name). Adds the search domain to names without a dot.',
  host: 'host [-t TYPE] NAME [SERVER]\n  Short DNS answers: addresses and mail servers.',
  tcpdump: 'tcpdump -r FILE [-n] [-e] [-c N] [-A] [-t] [FILTER]\n  Read a saved packet capture, one line per packet. Live capture needs root, so here you read the files the\n  sensor saves in /var/captures. -n numbers instead of names (always use it), -e show MAC addresses,\n  -c N stop after N packets, -A print readable payload, -t no timestamps.\n  FILTER: host 10.0.4.101, src host X, dst port 22, net 10.0.4.0/24, arp, icmp, tcp, udp port 53,\n  ether host MAC, tcp[tcpflags] & tcp-syn != 0. Join with and, or, not.\n  tcpdump -nr /var/captures/FILE.pcap \'arp\'      tcpdump -nAr FILE.pcap \'tcp port 80\'',
};
