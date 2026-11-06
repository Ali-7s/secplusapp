/**
 * A small packet model shared by the packet capture lab and the SOC Lab's tcpdump. Captures are built from
 * conversations (ARP, DHCP, DNS, TCP sessions, ping), so the frames always agree with each other: the MAC
 * addresses follow the gateway rule, TCP sequence numbers add up, replies mirror requests.
 *
 * Two filter languages read them: the display filter that capture tools use (ip.addr == 10.0.4.15 && tcp.port == 443)
 * and the capture filter syntax that tcpdump uses (host 10.0.4.15 and port 443).
 */

export interface Host { name: string; ip: string; mac: string }

export interface TcpFlags { syn?: boolean; ack?: boolean; fin?: boolean; rst?: boolean; psh?: boolean }

/** One row of the packet details, with the field's filter name and what it means. */
export interface Field { name: string; value: string; key?: string; explain?: string }

export interface AppData {
  /** The Protocol column: DNS, DHCP, HTTP, TLS, FTP... */
  proto: string;
  /** The Info column. */
  info: string;
  fields: Field[];
  /** Readable payload (cleartext protocols only), shown by tcpdump -A and the bytes view. */
  text?: string;
  dns?: { id: number; qname: string; qtype: string; answers: string[]; response: boolean; rcode?: 'SERVFAIL' };
  http?: { method?: string; uri?: string; status?: number };
  sni?: string;
}

export interface Pkt {
  no: number;
  /** Seconds since midnight, with microseconds. */
  t: number;
  len: number;
  eth: { src: string; dst: string; type: 'IPv4' | 'ARP' };
  arp?: { op: 1 | 2; senderMac: string; senderIp: string; targetMac: string; targetIp: string };
  ip?: { src: string; dst: string; ttl: number; proto: 'TCP' | 'UDP' | 'ICMP' };
  tcp?: { sport: number; dport: number; flags: TcpFlags; seq: number; ack: number; win: number; len: number };
  udp?: { sport: number; dport: number; len: number };
  icmp?: { type: number; code: number; id?: number; seq?: number };
  app?: AppData;
}

export const BROADCAST = 'ff:ff:ff:ff:ff:ff';

// ── Addresses ─────────────────────────────────────────────────────────────

export function ipToNum(ip: string): number {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return NaN;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

export function inCidr(ip: string, cidr: string): boolean {
  const [net, bitsText] = cidr.split('/');
  const bits = bitsText === undefined ? 32 : Number(bitsText);
  const a = ipToNum(ip), b = ipToNum(net);
  if (Number.isNaN(a) || Number.isNaN(b) || !(bits >= 0 && bits <= 32)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

const isIp = (s: string) => !Number.isNaN(ipToNum(s));

// ── Building captures ─────────────────────────────────────────────────────

const PROTO_NAME: Record<number, string> = {
  20: 'FTP-DATA', 21: 'FTP', 22: 'SSH', 23: 'TELNET', 25: 'SMTP', 53: 'DNS', 67: 'DHCP', 68: 'DHCP', 69: 'TFTP', 80: 'HTTP', 88: 'KRB5',
  110: 'POP', 123: 'NTP', 143: 'IMAP', 161: 'SNMP', 389: 'LDAP', 443: 'TLS', 445: 'SMB', 514: 'SYSLOG', 636: 'LDAPS', 993: 'IMAPS',
  995: 'POP3S', 1433: 'TDS', 3306: 'MYSQL', 3389: 'RDP', 5900: 'VNC', 8080: 'HTTP',
};

const SERVICE_NAME: Record<number, string> = {
  20: 'ftp-data', 21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'domain', 67: 'bootps', 68: 'bootpc', 80: 'http', 88: 'kerberos',
  110: 'pop3', 123: 'ntp', 135: 'msrpc', 139: 'netbios-ssn', 143: 'imap', 161: 'snmp', 389: 'ldap', 443: 'https', 445: 'microsoft-ds',
  514: 'syslog', 636: 'ldaps', 993: 'imaps', 995: 'pop3s', 1433: 'ms-sql-s', 3306: 'mysql', 3389: 'ms-wbt-server', 5900: 'vnc', 8080: 'http-alt',
};

/** The usual name of what listens on a port, for scan results and explanations. */
export const serviceName = (port: number) => SERVICE_NAME[port];

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export class Capture {
  readonly packets: Pkt[] = [];
  t: number;
  private poisoned = new Map<string, Host>();
  private nextId = 0x1a2b;

  constructor(readonly opts: { start: number; lan: string; gateway: Host }) {
    this.t = opts.start;
  }

  wait(seconds: number) { this.t += seconds; return this; }
  at(t: number) { this.t = Math.max(this.t, t); return this; }

  inLan(ip: string) { return inCidr(ip, this.opts.lan); }

  /** From now on, `victimIp` sends frames meant for `forIp` to the attacker, who forwards them on. */
  poison(victimIp: string, forIp: string, attacker: Host) { this.poisoned.set(`${victimIp}>${forIp}`, attacker); return this; }
  heal(victimIp: string, forIp: string) { this.poisoned.delete(`${victimIp}>${forIp}`); return this; }

  private push(p: Omit<Pkt, 'no' | 't'>, gap = 0.0004) {
    this.t += gap;
    this.packets.push({ ...p, no: this.packets.length + 1, t: round6(this.t) });
  }

  /** The frames an IP packet takes on the capture's LAN: one normally, two when an attacker sits in the middle. */
  private frames(src: Host, dst: Host): { src: string; dst: string; ttlDrop: number }[] {
    const fromMac = this.inLan(src.ip) ? src.mac : this.opts.gateway.mac;
    const nextHop = this.inLan(dst.ip) ? dst : this.opts.gateway;
    const sender = this.inLan(src.ip) ? src.ip : this.opts.gateway.ip;
    const realMac = this.inLan(dst.ip) ? dst.mac : this.opts.gateway.mac;
    const mitm = this.poisoned.get(`${sender}>${nextHop.ip}`);
    if (!mitm) return [{ src: fromMac, dst: realMac, ttlDrop: 0 }];
    return [{ src: fromMac, dst: mitm.mac, ttlDrop: 0 }, { src: mitm.mac, dst: realMac, ttlDrop: 1 }];
  }

  private ipPacket(src: Host, dst: Host, ttl: number, body: Omit<Pkt, 'no' | 't' | 'eth' | 'ip'> & { proto: 'TCP' | 'UDP' | 'ICMP' }, gap?: number) {
    const { proto, ...rest } = body;
    this.frames(src, dst).forEach((f, i) => {
      this.push({ ...rest, eth: { src: f.src, dst: f.dst, type: 'IPv4' }, ip: { src: src.ip, dst: dst.ip, ttl: ttl - f.ttlDrop, proto } }, i ? 0.00008 : gap);
    });
  }

  arpRequest(from: Host, targetIp: string, gap?: number) {
    this.push({
      len: 42, eth: { src: from.mac, dst: BROADCAST, type: 'ARP' },
      arp: { op: 1, senderMac: from.mac, senderIp: from.ip, targetMac: '00:00:00:00:00:00', targetIp },
    }, gap);
    return this;
  }

  /** An ARP reply. `claimIp` lets a liar say that someone else's address is at its own MAC. */
  arpReply(from: Host, to: Host | null, claimIp = from.ip, gap?: number) {
    this.push({
      len: 42, eth: { src: from.mac, dst: to ? to.mac : BROADCAST, type: 'ARP' },
      arp: { op: 2, senderMac: from.mac, senderIp: claimIp, targetMac: to ? to.mac : BROADCAST, targetIp: to ? to.ip : claimIp },
    }, gap);
    return this;
  }

  udp(src: Host, dst: Host, sport: number, dport: number, app?: AppData, payload = 40, ttl = 64, gap?: number) {
    this.ipPacket(src, dst, ttl, { proto: 'UDP', len: 42 + payload, udp: { sport, dport, len: 8 + payload }, app }, gap);
    return this;
  }

  /**
   * A DNS question and its answer. No answers means "no such name", unless `servfail` says the server failed to
   * get an answer at all; `noReply` sends the question and nothing comes back. `during` adds packets between the
   * question and the answer (a resolver asking the servers it forwards to, say).
   */
  dns(client: Host, server: Host, name: string, qtype: string, answers: string[], sport: number,
    opts: { ttl?: number; delay?: number; servfail?: boolean; noReply?: boolean; during?: () => void } = {}) {
    const id = this.nextId++;
    const q = `Standard query 0x${id.toString(16).padStart(4, '0')} ${qtype} ${name}`;
    const fields = (response: boolean): Field[] => [
      { name: 'Transaction ID', value: `0x${id.toString(16).padStart(4, '0')}`, key: 'dns.id', explain: 'Matches a response to its question. A reply with an unexpected ID is ignored, which is why DNS spoofers try to guess it.' },
      { name: 'Type', value: response ? 'Response' : 'Query', key: 'dns.flags.response', explain: 'Whether this is the question or the answer.' },
      { name: 'Question', value: `${name} ${qtype}`, key: 'dns.qry.name', explain: `The name being looked up, and the record type: ${QTYPE[qtype] ?? qtype}.` },
      ...(response && opts.servfail ? [{ name: 'Reply code', value: 'Server failure (2)', explain: 'SERVFAIL: the server could not get an answer, for example because the servers it forwards to did not reply. It is not "no such name" (NXDOMAIN, code 3): the name may well exist.' }] : []),
      ...(response ? [{ name: 'Answers', value: answers.length ? answers.join(', ') : opts.servfail ? '(none: server failure)' : '(none: no such name)', key: 'dns.a', explain: 'What the DNS server says the name resolves to. Clients trust this, which is what DNSSEC protects.' }] : []),
    ];
    const len = 12 + name.length + 6;
    this.udp(client, server, sport, 53, {
      proto: 'DNS', info: q, fields: fields(false), dns: { id, qname: name, qtype, answers: [], response: false },
    }, len, opts.ttl ?? 64);
    if (opts.noReply) return this;
    opts.during?.();
    this.wait(opts.delay ?? 0.012);
    const hex = id.toString(16).padStart(4, '0');
    this.udp(server, client, 53, sport, {
      proto: 'DNS',
      info: opts.servfail ? `Standard query response 0x${hex} Server failure ${qtype} ${name}`
        : `Standard query response 0x${hex} ${qtype} ${name}${answers.length ? ' ' + answers.map(a => `${qtype} ${a}`).join(' ') : ' No such name'}`,
      fields: fields(true), dns: { id, qname: name, qtype, answers, response: true, ...(opts.servfail ? { rcode: 'SERVFAIL' as const } : {}) },
    }, len + answers.length * 16, 64);
    return this;
  }

  dhcp(client: Host, server: Host, offered: string, xid: number, dnsServer = '10.0.1.53') {
    const anyHost: Host = { name: '', ip: '0.0.0.0', mac: client.mac };
    const bcast: Host = { name: '', ip: '255.255.255.255', mac: BROADCAST };
    const tx = `0x${xid.toString(16)}`;
    const msg = (kind: string, extra: Field[]): AppData => ({
      proto: 'DHCP', info: `DHCP ${kind} - Transaction ID ${tx}`,
      fields: [
        { name: 'Message type', value: kind, key: 'dhcp.option.dhcp', explain: DHCP_STEP[kind] },
        { name: 'Transaction ID', value: tx, key: 'dhcp.id', explain: 'Ties the four messages of one exchange together.' },
        { name: 'Client MAC address', value: client.mac, key: 'dhcp.hw.mac_addr', explain: 'Who is asking. A DHCP reservation matches on this.' },
        ...extra,
      ],
    });
    const lanBcast = (src: Host, dst: Host, sport: number, dport: number, app: AppData) =>
      this.push({ len: 342, eth: { src: src.mac, dst: dst.mac === BROADCAST ? BROADCAST : dst.mac, type: 'IPv4' }, ip: { src: src.ip, dst: dst.ip, ttl: 64, proto: 'UDP' }, udp: { sport, dport, len: 308 }, app });
    lanBcast(anyHost, bcast, 68, 67, msg('Discover', []));
    this.wait(0.002);
    const offerFields: Field[] = [
      { name: 'Your (client) IP address', value: offered, key: 'dhcp.ip.your', explain: 'The address the server is offering.' },
      { name: 'Router (default gateway)', value: this.opts.gateway.ip, explain: 'Where to send anything not on the local network.' },
      { name: 'DNS server', value: dnsServer, explain: 'Who to ask for names.' },
      { name: 'Lease time', value: '8 hours', explain: 'How long the client may keep the address before renewing.' },
    ];
    lanBcast(server, { ...client, ip: offered }, 67, 68, msg('Offer', offerFields));
    this.wait(0.001);
    lanBcast(anyHost, bcast, 68, 67, msg('Request', [{ name: 'Requested IP address', value: offered, key: 'dhcp.option.requested_ip_address', explain: 'The client asks for the address it was offered, out loud, so other DHCP servers know it chose.' }]));
    this.wait(0.002);
    lanBcast(server, { ...client, ip: offered }, 67, 68, msg('ACK', offerFields));
    return this;
  }

  ping(src: Host, dst: Host, seq: number, opts: { reply?: boolean; ttl?: number; replyTtl?: number; rtt?: number } = {}) {
    this.ipPacket(src, dst, opts.ttl ?? 64, { proto: 'ICMP', len: 98, icmp: { type: 8, code: 0, id: 1, seq } });
    if (opts.reply !== false) {
      this.wait(opts.rtt ?? 0.004);
      this.ipPacket(dst, src, opts.replyTtl ?? 57, { proto: 'ICMP', len: 98, icmp: { type: 0, code: 0, id: 1, seq } });
    }
    return this;
  }

  tcp(client: Host, server: Host, sport: number, dport: number, opts: { ttl?: number; serverTtl?: number; rtt?: number } = {}) {
    return new Conn(this, client, server, sport, dport, opts.ttl ?? 64, opts.serverTtl ?? (this.inLan(server.ip) ? 64 : 54), opts.rtt ?? 0.02);
  }

  /** Internal: used by Conn. */
  segment(src: Host, dst: Host, ttl: number, sport: number, dport: number, flags: TcpFlags, seq: number, ack: number, len: number, app?: AppData, gap?: number) {
    this.ipPacket(src, dst, ttl, { proto: 'TCP', len: 54 + len + (flags.syn ? 12 : 0), tcp: { sport, dport, flags, seq, ack, win: flags.syn ? 64240 : 502, len }, app }, gap);
  }
}

/** A TCP connection: handshake, data both ways, and the close, with sequence numbers that add up. */
export class Conn {
  private cSeq = 0;
  private sSeq = 0;

  constructor(private cap: Capture, readonly client: Host, readonly server: Host, readonly sport: number, readonly dport: number,
    private cTtl: number, private sTtl: number, private rtt: number) {}

  private c(flags: TcpFlags, len = 0, app?: AppData, gap?: number) {
    this.cap.segment(this.client, this.server, this.cTtl, this.sport, this.dport, flags, this.cSeq, flags.syn && !flags.ack ? 0 : this.sSeq, len, app, gap);
    this.cSeq += len + (flags.syn || flags.fin ? 1 : 0);
  }

  private s(flags: TcpFlags, len = 0, app?: AppData, gap?: number) {
    this.cap.segment(this.server, this.client, this.sTtl, this.dport, this.sport, flags, this.sSeq, this.cSeq, len, app, gap);
    this.sSeq += len + (flags.syn || flags.fin ? 1 : 0);
  }

  /** SYN, SYN-ACK, ACK. */
  open() {
    this.c({ syn: true });
    this.cap.wait(this.rtt);
    this.s({ syn: true, ack: true });
    this.c({ ack: true });
    return this;
  }

  /** A SYN to a closed port: the server answers with a reset. */
  refused() {
    this.c({ syn: true });
    this.cap.wait(this.rtt / 2);
    this.s({ rst: true, ack: true });
    return this;
  }

  /** A SYN nobody answers (a firewall dropped it), sent `tries` times with the usual doubling wait between. */
  unanswered(tries = 1, firstWait = 1) {
    for (let k = 0; k < tries; k++) {
      if (k) this.cap.wait(firstWait * 2 ** (k - 1));
      this.cSeq = 0;
      this.c({ syn: true });
    }
    return this;
  }

  /** A half-open scan: SYN, SYN-ACK, then the scanner resets instead of finishing the handshake. */
  halfOpen() {
    this.c({ syn: true });
    this.cap.wait(this.rtt / 2);
    this.s({ syn: true, ack: true });
    this.c({ rst: true });
    return this;
  }

  send(fromClient: boolean, len: number, app?: AppData, gap?: number) {
    if (fromClient) {
      this.c({ psh: true, ack: true }, len, app, gap);
      this.cap.wait(this.rtt);
      this.s({ ack: true });
    } else {
      this.s({ psh: true, ack: true }, len, app, gap);
      this.c({ ack: true });
    }
    return this;
  }

  close() {
    this.c({ fin: true, ack: true });
    this.cap.wait(this.rtt);
    this.s({ fin: true, ack: true });
    this.c({ ack: true });
    return this;
  }

  reset() {
    this.c({ rst: true, ack: true });
    return this;
  }
}

// ── Application payloads ──────────────────────────────────────────────────

const QTYPE: Record<string, string> = {
  A: 'an IPv4 address', AAAA: 'an IPv6 address', MX: 'the mail server', TXT: 'free text', CNAME: 'another name this one points to', PTR: 'the name for an address', NS: 'the name servers',
};

const DHCP_STEP: Record<string, string> = {
  Discover: 'Step 1 of DORA: a new client shouts to the whole LAN, "is there a DHCP server?" It has no address yet, so it sends from 0.0.0.0 to 255.255.255.255.',
  Offer: 'Step 2: a server offers an address, with the gateway and DNS server to use.',
  Request: 'Step 3: the client asks for the offered address. It is still broadcast, so any other server that made an offer knows it was not chosen.',
  ACK: 'Step 4: the server confirms. The client may now use the address.',
};

export const app = {
  http(text: string): AppData {
    const first = text.split('\n')[0];
    const req = /^(GET|POST|PUT|DELETE|HEAD) (\S+)/.exec(first);
    const res = /^HTTP\/1\.[01] (\d{3})/.exec(first);
    const fields: Field[] = req
      ? [
          { name: 'Request method', value: req[1], key: 'http.request.method', explain: req[1] === 'POST' ? 'POST sends data to the server, such as a filled-in form.' : 'GET asks for a page.' },
          { name: 'Request URI', value: req[2], key: 'http.request.uri', explain: 'The page asked for.' },
        ]
      : res ? [{ name: 'Status code', value: res[1], key: 'http.response.code', explain: '200 is OK, 301 and 302 redirect, 401 and 403 refuse, 404 is not found, 500 is a server error.' }] : [];
    return { proto: 'HTTP', info: first, fields: [...fields, { name: 'Readable', value: 'Yes: HTTP is cleartext', explain: 'Anyone who captures it can read every header, cookie and form field.' }], text, http: { method: req?.[1], uri: req?.[2], status: res ? Number(res[1]) : undefined } };
  },
  clientHello(sni: string): AppData {
    return {
      proto: 'TLSv1.3', info: `Client Hello (SNI=${sni})`, sni,
      fields: [
        { name: 'Handshake type', value: 'Client Hello', explain: 'The browser opens TLS: the versions and cipher suites it supports, and a random value for the keys.' },
        { name: 'Server Name Indication', value: sni, key: 'tls.handshake.extensions_server_name', explain: 'The site name, sent before encryption starts so the server knows which certificate to present. It is the one readable clue to where encrypted traffic goes.' },
      ],
    };
  },
  serverHello(): AppData {
    return {
      proto: 'TLSv1.3', info: 'Server Hello, Change Cipher Spec, Application Data',
      fields: [{ name: 'Handshake type', value: 'Server Hello', explain: 'The server picks the version and cipher suite. From here on everything, including the certificate in TLS 1.3, is encrypted.' }],
    };
  },
  tlsData(dir: 'request' | 'response'): AppData {
    return {
      proto: 'TLSv1.3', info: 'Application Data',
      fields: [{ name: 'Encrypted application data', value: '(unreadable)', explain: `The ${dir} itself, encrypted. You can see its size and timing, but not what it says.` }],
    };
  },
  line(proto: string, text: string, explain: string): AppData {
    return { proto, info: text.split('\n')[0].replace(/\r$/, ''), text, fields: [{ name: 'Payload', value: text.trim(), explain }] };
  },
  opaque(proto: string, info: string, explain: string): AppData {
    return { proto, info, fields: [{ name: 'Payload', value: '(encrypted)', explain }] };
  },
};

// ── Columns, details and explanations ─────────────────────────────────────

export function protocolOf(p: Pkt): string {
  if (p.arp) return 'ARP';
  if (p.app) return p.app.proto;
  if (p.icmp) return 'ICMP';
  if (p.tcp) return 'TCP';
  if (p.udp) return PROTO_NAME[p.udp.dport] ?? PROTO_NAME[p.udp.sport] ?? 'UDP';
  return 'Ethernet';
}

export const flagNames = (f: TcpFlags) =>
  [f.fin && 'FIN', f.syn && 'SYN', f.rst && 'RST', f.psh && 'PSH', f.ack && 'ACK'].filter(Boolean) as string[];

export function infoOf(p: Pkt): string {
  if (p.arp) return p.arp.op === 1 ? `Who has ${p.arp.targetIp}? Tell ${p.arp.senderIp}` : `${p.arp.senderIp} is at ${p.arp.senderMac}`;
  if (p.app) return p.app.info;
  if (p.icmp) {
    if (p.icmp.type === 8 || p.icmp.type === 0) return `Echo (ping) ${p.icmp.type === 8 ? 'request' : 'reply'}  id=0x0001, seq=${p.icmp.seq}, ttl=${p.ip!.ttl}`;
    if (p.icmp.type === 11) return 'Time-to-live exceeded (Time to live exceeded in transit)';
    return `Destination unreachable (code ${p.icmp.code})`;
  }
  if (p.tcp) return `${p.tcp.sport} → ${p.tcp.dport} [${flagNames(p.tcp.flags).join(', ')}] Seq=${p.tcp.seq}${p.tcp.flags.ack ? ` Ack=${p.tcp.ack}` : ''} Win=${p.tcp.win} Len=${p.tcp.len}`;
  if (p.udp) return `${p.udp.sport} → ${p.udp.dport} Len=${p.udp.len - 8}`;
  return '';
}

export interface Layer { title: string; fields: Field[] }

const MAC_EXPLAIN = 'A MAC address names a network card on this LAN only. It changes at every router hop.';

/** The packet as layers, each field with its filter name and a plain explanation. */
export function layersOf(p: Pkt, gateway?: Host): Layer[] {
  const out: Layer[] = [
    { title: `Frame ${p.no}: ${p.len} bytes`, fields: [
      { name: 'Arrival time', value: clock(p.t), key: 'frame.time', explain: 'When the capture saw it.' },
      { name: 'Length', value: `${p.len} bytes`, key: 'frame.len', explain: 'The size of the whole frame on the wire, headers included.' },
    ] },
    { title: `Ethernet II, Src: ${p.eth.src}, Dst: ${p.eth.dst}`, fields: [
      { name: 'Destination', value: p.eth.dst + (p.eth.dst === BROADCAST ? ' (broadcast)' : gateway && p.eth.dst === gateway.mac ? ' (the gateway)' : ''), key: 'eth.dst', explain: p.eth.dst === BROADCAST ? 'Broadcast: every device on the LAN receives this frame. ARP requests and DHCP discovers are sent this way because the sender does not know who to ask yet.' : `${MAC_EXPLAIN} For an address outside the LAN, the frame goes to the gateway's MAC, not the far server's.` },
      { name: 'Source', value: p.eth.src + (gateway && p.eth.src === gateway.mac ? ' (the gateway)' : ''), key: 'eth.src', explain: MAC_EXPLAIN },
      { name: 'Type', value: p.eth.type === 'ARP' ? 'ARP (0x0806)' : 'IPv4 (0x0800)', key: 'eth.type', explain: 'What is inside the frame: an IP packet, or an ARP message (which has no IP header at all).' },
    ] },
  ];
  if (p.arp) {
    out.push({ title: `Address Resolution Protocol (${p.arp.op === 1 ? 'request' : 'reply'})`, fields: [
      { name: 'Opcode', value: p.arp.op === 1 ? 'request (1)' : 'reply (2)', key: 'arp.opcode', explain: p.arp.op === 1 ? 'A question to everyone: who has this IP address?' : 'An answer: this IP is at this MAC. Devices believe replies even when they never asked, which is what ARP poisoning abuses.' },
      { name: 'Sender MAC address', value: p.arp.senderMac, key: 'arp.src.hw_mac', explain: 'The MAC the sender claims.' },
      { name: 'Sender IP address', value: p.arp.senderIp, key: 'arp.src.proto_ipv4', explain: 'The IP address the sender claims goes with that MAC.' },
      { name: 'Target MAC address', value: p.arp.targetMac, key: 'arp.dst.hw_mac', explain: p.arp.op === 1 ? 'All zeros: unknown, that is the question.' : 'Who the answer is for.' },
      { name: 'Target IP address', value: p.arp.targetIp, key: 'arp.dst.proto_ipv4', explain: 'The address being asked about, or the asker.' },
    ] });
    return out;
  }
  if (p.ip) {
    out.push({ title: `Internet Protocol Version 4, Src: ${p.ip.src}, Dst: ${p.ip.dst}`, fields: [
      { name: 'Source address', value: p.ip.src, key: 'ip.src', explain: 'Who sent the packet. Unlike the MAC, it stays the same end to end (unless NAT rewrites it).' },
      { name: 'Destination address', value: p.ip.dst, key: 'ip.dst', explain: 'Where the packet is going, end to end.' },
      { name: 'Time to live', value: String(p.ip.ttl), key: 'ip.ttl', explain: 'Starts at 64 (Linux, phones) or 128 (Windows) and drops by one at each router. Packets from far away arrive lower; a hop that should not be there shows up as one less than expected.' },
      { name: 'Protocol', value: p.ip.proto === 'TCP' ? 'TCP (6)' : p.ip.proto === 'UDP' ? 'UDP (17)' : 'ICMP (1)', key: 'ip.proto', explain: 'Which transport is inside: TCP for connections, UDP for quick one-off messages, ICMP for network errors and ping.' },
    ] });
  }
  if (p.tcp) {
    const f = flagNames(p.tcp.flags);
    out.push({ title: `Transmission Control Protocol, Src Port: ${p.tcp.sport}, Dst Port: ${p.tcp.dport}`, fields: [
      { name: 'Source port', value: portLabel(p.tcp.sport), key: 'tcp.srcport', explain: 'The sending program. A client picks a random high (ephemeral) port; a server answers from its well-known port.' },
      { name: 'Destination port', value: portLabel(p.tcp.dport), key: 'tcp.dstport', explain: 'The program it is for. On a request this is the service: 443 for HTTPS, 22 for SSH.' },
      { name: 'Sequence number', value: String(p.tcp.seq), key: 'tcp.seq', explain: 'Counts the bytes this side has sent (shown relative, starting at 0), so the receiver can put data in order and spot gaps.' },
      ...(p.tcp.flags.ack ? [{ name: 'Acknowledgment number', value: String(p.tcp.ack), key: 'tcp.ack', explain: 'The next byte this side expects from the other: "I have everything before this."' }] : []),
      { name: 'Flags', value: f.join(', '), key: 'tcp.flags', explain: FLAG_EXPLAIN(p.tcp.flags) },
      { name: 'Window', value: String(p.tcp.win), key: 'tcp.window_size', explain: 'How much more data the sender can take before it must be acknowledged.' },
      { name: 'Payload length', value: `${p.tcp.len} bytes`, key: 'tcp.len', explain: p.tcp.len ? 'Data carried by this segment.' : 'No data: this segment only manages the connection.' },
    ] });
  }
  if (p.udp) {
    out.push({ title: `User Datagram Protocol, Src Port: ${p.udp.sport}, Dst Port: ${p.udp.dport}`, fields: [
      { name: 'Source port', value: portLabel(p.udp.sport), key: 'udp.srcport', explain: 'The sending program. A client uses a random high port; a server replies from its well-known one.' },
      { name: 'Destination port', value: portLabel(p.udp.dport), key: 'udp.dstport', explain: 'The program it is for. UDP has no handshake: the message is simply sent.' },
      { name: 'Length', value: `${p.udp.len} bytes`, key: 'udp.length', explain: 'The UDP header (8 bytes) plus the data.' },
    ] });
  }
  if (p.icmp) {
    out.push({ title: 'Internet Control Message Protocol', fields: [
      { name: 'Type', value: `${p.icmp.type} (${ICMP_TYPE[p.icmp.type] ?? 'other'})`, key: 'icmp.type', explain: 'ICMP carries network messages, not data: 8 is an echo request (ping), 0 its reply, 3 destination unreachable, 11 time exceeded (what traceroute uses).' },
      ...(p.icmp.seq !== undefined ? [{ name: 'Sequence number', value: String(p.icmp.seq), key: 'icmp.seq', explain: 'Numbers each ping so replies can be matched and losses counted.' }] : []),
    ] });
  }
  if (p.app) out.push({ title: APP_TITLE[p.app.proto] ?? p.app.proto, fields: p.app.fields });
  return out;
}

const APP_TITLE: Record<string, string> = {
  DNS: 'Domain Name System', DHCP: 'Dynamic Host Configuration Protocol', HTTP: 'Hypertext Transfer Protocol', 'TLSv1.3': 'Transport Layer Security',
  FTP: 'File Transfer Protocol', TELNET: 'Telnet', SSH: 'SSH Protocol', SMB2: 'SMB2 (Server Message Block)', NTP: 'Network Time Protocol', SYSLOG: 'Syslog message',
};

const ICMP_TYPE: Record<number, string> = { 0: 'Echo reply', 3: 'Destination unreachable', 8: 'Echo (ping) request', 11: 'Time exceeded' };

function FLAG_EXPLAIN(f: TcpFlags): string {
  if (f.syn && f.ack) return 'SYN, ACK: step 2 of the handshake. The server agrees, so this port is open.';
  if (f.syn) return 'SYN: step 1 of the three-way handshake, "I would like to connect". Many SYNs to many ports from one source is a port scan.';
  if (f.rst) return 'RST: reset, "no". Sent back for a closed port, or to abort a connection (a half-open scan sends one instead of finishing the handshake).';
  if (f.fin) return 'FIN: "I have finished sending." Each side sends one to close the connection politely.';
  if (f.psh) return 'PSH, ACK: data, to be passed to the program straight away, plus an acknowledgment.';
  return 'ACK: acknowledges what has arrived. The third step of the handshake is a bare ACK.';
}

function portLabel(port: number): string {
  const s = SERVICE_NAME[port];
  return s ? `${port} (${s})` : port >= 49152 ? `${port} (ephemeral)` : String(port);
}

export function clock(t: number): string {
  const s = Math.floor(t);
  const us = Math.round((t - s) * 1e6);
  const hh = Math.floor(s / 3600) % 24, mm = Math.floor(s / 60) % 60, ss = s % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(us).padStart(6, '0')}`;
}

// ── tcpdump output ────────────────────────────────────────────────────────

const tcpFlagLetters = (f: TcpFlags) => (f.syn ? 'S' : '') + (f.fin ? 'F' : '') + (f.rst ? 'R' : '') + (f.psh ? 'P' : '') + (f.ack ? '.' : '');

export function tcpdumpLine(p: Pkt, opts: { e?: boolean } = {}): string {
  const head = clock(p.t);
  const ether = opts.e ? `${p.eth.src} > ${p.eth.dst}, ethertype ${p.eth.type === 'ARP' ? 'ARP (0x0806)' : 'IPv4 (0x0800)'}, length ${p.len}: ` : '';
  if (p.arp) {
    const body = p.arp.op === 1
      ? `Request who-has ${p.arp.targetIp} tell ${p.arp.senderIp}, length 28`
      : `Reply ${p.arp.senderIp} is-at ${p.arp.senderMac}, length 28`;
    return `${head} ${ether}${opts.e ? '' : 'ARP, '}${body}`;
  }
  const ip = p.ip!;
  const lead = opts.e ? '' : 'IP ';
  if (p.icmp) {
    const kind = p.icmp.type === 8 ? `ICMP echo request, id 1, seq ${p.icmp.seq}, length 64` : p.icmp.type === 0 ? `ICMP echo reply, id 1, seq ${p.icmp.seq}, length 64` : p.icmp.type === 11 ? 'ICMP time exceeded in-transit, length 36' : 'ICMP unreachable, length 36';
    return `${head} ${ether}${lead}${ip.src} > ${ip.dst}: ${kind}`;
  }
  if (p.tcp) {
    const t = p.tcp;
    const seq = t.len ? `seq ${t.seq}:${t.seq + t.len}` : `seq ${t.seq}`;
    return `${head} ${ether}${lead}${ip.src}.${t.sport} > ${ip.dst}.${t.dport}: Flags [${tcpFlagLetters(t.flags)}], ${seq}${t.flags.ack ? `, ack ${t.ack}` : ''}, win ${t.win}, length ${t.len}`;
  }
  const u = p.udp!;
  let rest = `UDP, length ${u.len - 8}`;
  const d = p.app?.dns;
  if (d) rest = d.response
    ? d.rcode === 'SERVFAIL' ? `${d.id} ServFail 0/0/0 (${u.len - 8})`
    : `${d.id} ${d.answers.length}/0/0 ${d.answers.length ? d.answers.map(a => `${d.qtype} ${a}`).join(', ') : 'NXDomain'} (${u.len - 8})`
    : `${d.id}+ ${d.qtype}? ${d.qname}. (${u.len - 8})`;
  else if (p.app?.proto === 'DHCP') rest = `BOOTP/DHCP, ${u.dport === 67 ? 'Request' : 'Reply'} from ${p.eth.src}, length ${u.len - 8}`;
  return `${head} ${ether}${lead}${ip.src}.${u.sport} > ${ip.dst}.${u.dport}: ${rest}`;
}

// ── Display filters (capture tool syntax) ─────────────────────────────────

type Val = string | number;

function fieldValues(p: Pkt, key: string): Val[] | undefined {
  const tcp = p.tcp, udp = p.udp, ip = p.ip, arp = p.arp;
  const b = (x: boolean | undefined) => [x ? 1 : 0];
  switch (key) {
    case 'frame.number': return [p.no];
    case 'frame.len': return [p.len];
    case 'eth.src': return [p.eth.src];
    case 'eth.dst': return [p.eth.dst];
    case 'eth.addr': return [p.eth.src, p.eth.dst];
    case 'ip.src': return ip && [ip.src];
    case 'ip.dst': return ip && [ip.dst];
    case 'ip.addr': return ip && [ip.src, ip.dst];
    case 'ip.ttl': return ip && [ip.ttl];
    case 'tcp.srcport': return tcp && [tcp.sport];
    case 'tcp.dstport': return tcp && [tcp.dport];
    case 'tcp.port': return tcp && [tcp.sport, tcp.dport];
    case 'tcp.seq': return tcp && [tcp.seq];
    case 'tcp.ack': return tcp && [tcp.ack];
    case 'tcp.len': return tcp && [tcp.len];
    case 'tcp.flags.syn': return tcp && b(tcp.flags.syn);
    case 'tcp.flags.ack': return tcp && b(tcp.flags.ack);
    case 'tcp.flags.fin': return tcp && b(tcp.flags.fin);
    case 'tcp.flags.reset': return tcp && b(tcp.flags.rst);
    case 'tcp.flags.push': return tcp && b(tcp.flags.psh);
    case 'udp.srcport': return udp && [udp.sport];
    case 'udp.dstport': return udp && [udp.dport];
    case 'udp.port': return udp && [udp.sport, udp.dport];
    case 'icmp.type': return p.icmp && [p.icmp.type];
    case 'arp.opcode': return arp && [arp.op];
    case 'arp.src.proto_ipv4': return arp && [arp.senderIp];
    case 'arp.dst.proto_ipv4': return arp && [arp.targetIp];
    case 'arp.src.hw_mac': return arp && [arp.senderMac];
    case 'dns.qry.name': return p.app?.dns && [p.app.dns.qname];
    case 'dns.qry.type': return p.app?.dns && [p.app.dns.qtype];
    case 'dns.a': return p.app?.dns?.response ? p.app.dns.answers : undefined;
    case 'dns.flags.response': return p.app?.dns && b(p.app.dns.response);
    case 'http.request.method': return p.app?.http?.method ? [p.app.http.method] : undefined;
    case 'http.request.uri': return p.app?.http?.uri ? [p.app.http.uri] : undefined;
    case 'http.response.code': return p.app?.http?.status ? [p.app.http.status] : undefined;
    case 'tls.handshake.extensions_server_name': return p.app?.sni ? [p.app.sni] : undefined;
  }
  return undefined;
}

const PROTOCOL_WORDS: Record<string, (p: Pkt) => boolean> = {
  eth: () => true, frame: () => true,
  arp: p => !!p.arp, ip: p => !!p.ip, tcp: p => !!p.tcp, udp: p => !!p.udp, icmp: p => !!p.icmp,
  dns: p => !!p.app?.dns, dhcp: p => p.app?.proto === 'DHCP', http: p => p.app?.proto === 'HTTP', tls: p => !!p.app?.proto.startsWith('TLS'),
  ftp: p => p.app?.proto === 'FTP', telnet: p => p.app?.proto === 'TELNET', ssh: p => p.app?.proto === 'SSH', smb2: p => p.app?.proto === 'SMB2',
  ntp: p => p.app?.proto === 'NTP', syslog: p => p.app?.proto === 'SYSLOG',
};

/** Every field name the display filter knows, for help and autocompletion. */
export const FILTER_FIELDS = [
  'ip.addr', 'ip.src', 'ip.dst', 'ip.ttl', 'eth.addr', 'eth.src', 'eth.dst', 'tcp.port', 'tcp.srcport', 'tcp.dstport', 'tcp.flags.syn', 'tcp.flags.ack',
  'tcp.flags.reset', 'tcp.flags.fin', 'tcp.flags.push', 'tcp.len', 'tcp.seq', 'tcp.ack', 'udp.port', 'udp.srcport', 'udp.dstport', 'icmp.type', 'arp.opcode',
  'arp.src.proto_ipv4', 'arp.dst.proto_ipv4', 'arp.src.hw_mac', 'dns.qry.name', 'dns.qry.type', 'dns.a', 'dns.flags.response', 'http.request.method',
  'http.request.uri', 'http.response.code', 'tls.handshake.extensions_server_name', 'frame.number', 'frame.len',
];

export class FilterError extends Error {}

type Tok = { k: 'w' | 's' | 'op' | '(' | ')'; v: string };

function lexFilter(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') { out.push({ k: c, v: c }); i++; continue; }
    if (c === '"') {
      const j = src.indexOf('"', i + 1);
      if (j < 0) throw new FilterError('A quote is never closed.');
      out.push({ k: 's', v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(two)) { out.push({ k: 'op', v: two }); i += 2; continue; }
    if ('<>!&|='.includes(c)) {
      if (c === '=') throw new FilterError('Use == to compare, not =.');
      out.push({ k: 'op', v: c });
      i++;
      continue;
    }
    let j = i;
    while (j < src.length && /[A-Za-z0-9_.:/\-\[\]+]/.test(src[j])) j++;
    if (j === i) throw new FilterError(`Unexpected "${c}".`);
    out.push({ k: 'w', v: src.slice(i, j) });
    i = j;
  }
  return out;
}

type Pred = (p: Pkt) => boolean;

const CMP: Record<string, string> = { '==': '==', eq: '==', '!=': '!=', ne: '!=', '>': '>', gt: '>', '<': '<', lt: '<', '>=': '>=', ge: '>=', '<=': '<=', le: '<=', contains: 'contains', matches: 'matches' };

function compare(a: Val, op: string, raw: string): boolean {
  if (op === 'contains') return String(a).toLowerCase().includes(raw.toLowerCase());
  if (op === 'matches') { try { return new RegExp(raw, 'i').test(String(a)); } catch { throw new FilterError(`"${raw}" is not a valid pattern.`); } }
  if (typeof a === 'string' && isIp(a) && raw.includes('/')) return op === '==' ? inCidr(a, raw) : op === '!=' ? !inCidr(a, raw) : false;
  const n = /^0x[0-9a-f]+$/i.test(raw) ? parseInt(raw, 16) : raw === 'true' ? 1 : raw === 'false' ? 0 : Number(raw);
  if (typeof a === 'number' && !Number.isNaN(n)) {
    return op === '==' ? a === n : op === '!=' ? a !== n : op === '>' ? a > n : op === '<' ? a < n : op === '>=' ? a >= n : a <= n;
  }
  const s = String(a).toLowerCase(), r = raw.toLowerCase();
  return op === '==' ? s === r : op === '!=' ? s !== r : op === '>' ? s > r : op === '<' ? s < r : op === '>=' ? s >= r : s <= r;
}

/** Compiles a display filter such as `ip.addr == 10.0.4.15 && tcp.flags.syn == 1`. Empty means everything. */
export function displayFilter(src: string): Pred {
  const toks = lexFilter(src);
  if (!toks.length) return () => true;
  let i = 0;
  const peek = () => toks[i];
  const word = (t: Tok | undefined, ...ws: string[]) => !!t && (t.k === 'w' || t.k === 'op') && ws.includes(t.v.toLowerCase());
  const or = (): Pred => {
    let l = and();
    while (word(peek(), '||', 'or')) { i++; const r = and(), a = l; l = p => a(p) || r(p); }
    return l;
  };
  const and = (): Pred => {
    let l = not();
    while (word(peek(), '&&', 'and')) { i++; const r = not(), a = l; l = p => a(p) && r(p); }
    return l;
  };
  const not = (): Pred => {
    if (word(peek(), '!', 'not')) { i++; const x = not(); return p => !x(p); }
    return primary();
  };
  const primary = (): Pred => {
    const t = toks[i++];
    if (!t) throw new FilterError('The filter ends too soon.');
    if (t.k === '(') {
      const x = or();
      if (toks[i]?.k !== ')') throw new FilterError('A bracket is never closed.');
      i++;
      return x;
    }
    if (t.k !== 'w') throw new FilterError(`Unexpected "${t.v}".`);
    const key = t.v.toLowerCase();
    const nxt = peek();
    const op = nxt && (nxt.k === 'op' || nxt.k === 'w') ? CMP[nxt.v.toLowerCase()] : undefined;
    if (op) {
      i++;
      const v = toks[i++];
      if (!v || (v.k !== 'w' && v.k !== 's')) throw new FilterError(`"${key} ${nxt!.v}" needs a value after it.`);
      if (!FILTER_FIELDS.includes(key)) throw new FilterError(`"${key}" is not a field this capture knows. Try ip.addr, tcp.port or dns.qry.name.`);
      return p => {
        const vals = fieldValues(p, key);
        if (!vals?.length) return false;
        return op === '!=' ? !vals.some(x => compare(x, '==', v.v)) : vals.some(x => compare(x, op, v.v));
      };
    }
    if (PROTOCOL_WORDS[key]) return PROTOCOL_WORDS[key];
    // A bare field means "present", and for a flag, "set".
    if (FILTER_FIELDS.includes(key)) return p => { const v = fieldValues(p, key); return !!v?.length && !(key.includes('.flags.') && v[0] === 0); };
    throw new FilterError(`"${t.v}" is not a protocol or field this capture knows. Try tcp, udp, dns, arp, http, or ip.addr == 10.0.4.15.`);
  };
  const pred = or();
  if (i < toks.length) throw new FilterError(`Unexpected "${toks[i].v}". Join conditions with && or ||.`);
  return pred;
}

// ── Capture filters (tcpdump / BPF syntax) ────────────────────────────────

const TCP_BITS: Record<string, number> = { 'tcp-fin': 1, 'tcp-syn': 2, 'tcp-rst': 4, 'tcp-push': 8, 'tcp-ack': 16 };
const bitsOf = (f: TcpFlags) => (f.fin ? 1 : 0) | (f.syn ? 2 : 0) | (f.rst ? 4 : 0) | (f.psh ? 8 : 0) | (f.ack ? 16 : 0);

/** Compiles a tcpdump filter such as `host 10.0.4.15 and tcp port 443` or `tcp[tcpflags] & tcp-syn != 0`. */
export function bpfFilter(src: string): Pred {
  const text = src.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ').replace(/!=/g, ' \u0001 ').replace(/!/g, ' not ')
    .replace(/\u0001/g, '!=').replace(/==/g, ' == ').replace(/([()&|])/g, ' $1 ');
  const toks = text.split(/\s+/).filter(Boolean);
  if (!toks.length) return () => true;
  let i = 0;
  const peek = () => toks[i]?.toLowerCase();
  const or = (): Pred => {
    let l = and();
    while (peek() === 'or') { i++; const r = and(), a = l; l = p => a(p) || r(p); }
    return l;
  };
  const and = (): Pred => {
    let l = not();
    while (peek() === 'and') { i++; const r = not(), a = l; l = p => a(p) && r(p); }
    return l;
  };
  const not = (): Pred => {
    if (peek() === 'not') { i++; const x = not(); return p => !x(p); }
    return primary();
  };
  const flagValue = (): number => {
    let v = 0;
    const one = () => {
      const t = toks[i++]?.toLowerCase();
      if (t === undefined) throw new FilterError('syntax error: the flags expression ends too soon');
      if (t in TCP_BITS) return TCP_BITS[t];
      if (/^\d+$/.test(t)) return Number(t);
      if (/^0x[0-9a-f]+$/.test(t)) return parseInt(t, 16);
      throw new FilterError(`syntax error near "${t}"`);
    };
    if (peek() === '(') {
      i++;
      v = one();
      while (peek() === '|') { i++; v |= one(); }
      if (toks[i++] !== ')') throw new FilterError('syntax error: missing ")"');
      return v;
    }
    v = one();
    while (peek() === '|') { i++; v |= one(); }
    return v;
  };
  const primary = (): Pred => {
    const t = peek();
    if (t === undefined) throw new FilterError('syntax error: the filter ends too soon');
    if (t === '(') {
      i++;
      const x = or();
      if (toks[i++] !== ')') throw new FilterError('syntax error: missing ")"');
      return x;
    }
    if (t === 'tcp[tcpflags]' || t === 'tcp[13]') {
      i++;
      let mask = 0xff;
      if (peek() === '&') { i++; mask = flagValue(); }
      const op = toks[i++];
      if (!['!=', '==', '=', '>', '<'].includes(op ?? '')) throw new FilterError('syntax error: compare the flags with != 0 or == a value');
      const v = flagValue();
      return p => {
        if (!p.tcp) return false;
        const x = bitsOf(p.tcp.flags) & mask;
        return op === '!=' ? x !== v : op === '>' ? x > v : op === '<' ? x < v : x === v;
      };
    }
    let proto: string | undefined;
    if (['tcp', 'udp', 'icmp', 'arp', 'ip', 'ether'].includes(t)) { proto = t; i++; }
    let dir: string | undefined;
    if (peek() === 'src' || peek() === 'dst') { dir = peek(); i++; }
    let kind: string | undefined;
    if (['host', 'port', 'net', 'portrange'].includes(peek() ?? '')) { kind = peek(); i++; }
    if (!kind && !dir) {
      if (!proto) throw new FilterError(`syntax error near "${toks[i]}"`);
      const pr = proto;
      return p => pr === 'tcp' ? !!p.tcp : pr === 'udp' ? !!p.udp : pr === 'icmp' ? !!p.icmp : pr === 'arp' ? !!p.arp : pr === 'ip' ? !!p.ip : true;
    }
    const raw = toks[i++];
    if (raw === undefined) throw new FilterError(`syntax error: "${kind ?? dir}" needs a value`);
    const k = kind ?? (proto === 'ether' ? 'host' : isIp(raw) ? 'host' : 'port');
    const want = (p: Pkt) => proto === 'tcp' ? !!p.tcp : proto === 'udp' ? !!p.udp : proto === 'icmp' ? !!p.icmp : proto === 'arp' ? !!p.arp : proto === 'ip' ? !!p.ip : true;
    if (proto === 'ether') {
      const mac = raw.toLowerCase();
      return p => (dir !== 'dst' && p.eth.src === mac) || (dir !== 'src' && p.eth.dst === mac);
    }
    if (k === 'host' || k === 'net') {
      const match = (ip: string) => (k === 'net' ? inCidr(ip, raw) : ip === raw);
      if (k === 'host' && !isIp(raw)) throw new FilterError(`unknown host '${raw}' (use an IP address)`);
      return p => {
        if (!want(p)) return false;
        const srcIp = p.ip?.src ?? p.arp?.senderIp, dstIp = p.ip?.dst ?? p.arp?.targetIp;
        return (dir !== 'dst' && !!srcIp && match(srcIp)) || (dir !== 'src' && !!dstIp && match(dstIp));
      };
    }
    const [lo, hi] = k === 'portrange' ? raw.split('-').map(Number) : [Number(raw), Number(raw)];
    if (Number.isNaN(lo) || Number.isNaN(hi)) throw new FilterError(`illegal port number "${raw}"`);
    const inRange = (n: number) => n >= lo && n <= hi;
    return p => {
      const l4 = p.tcp ?? p.udp;
      if (!l4 || !want(p)) return false;
      return (dir !== 'dst' && inRange(l4.sport)) || (dir !== 'src' && inRange(l4.dport));
    };
  };
  const pred = or();
  if (i < toks.length) throw new FilterError(`syntax error near "${toks[i]}"`);
  return pred;
}
