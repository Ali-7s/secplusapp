import { PORTS as PORT_LIST } from '../../../reference/reference-data';

/**
 * The network lab's engine: what a scenario is made of, how each stage is graded, and how traffic is simulated
 * through the network the learner built. Pure functions, so the spec can prove every scenario can be solved.
 */

export type DeviceKind = 'firewall' | 'ngfw' | 'router' | 'ips' | 'ids' | 'waf' | 'proxy' | 'vpn' | 'lb' | 'hub' | 'honeypot';

export const DEVICES: Record<DeviceKind, { name: string; icon: string; does: string }> = {
  firewall: { name: 'Firewall', icon: 'local_fire_department', does: 'Allows or blocks traffic between zones by rules, tracking each connection (stateful)' },
  ngfw: { name: 'Next-gen firewall', icon: 'local_fire_department', does: 'A stateful firewall that also recognizes applications and users' },
  router: { name: 'Router', icon: 'router', does: 'Forwards packets between networks; its ACLs are basic and stateless' },
  ips: { name: 'IPS', icon: 'shield', does: 'Sits inline and can drop the attacks it recognizes' },
  ids: { name: 'IDS sensor', icon: 'sensors', does: 'Watches a copy of the traffic and raises alerts; it cannot block' },
  waf: { name: 'WAF', icon: 'web', does: 'Reads the HTTP requests to a web app and blocks attacks such as SQL injection' },
  proxy: { name: 'Forward proxy', icon: 'travel_explore', does: 'Fetches websites for users, filtering them by category and reputation' },
  vpn: { name: 'VPN concentrator', icon: 'vpn_lock', does: 'Ends encrypted tunnels from remote users and gives them an address' },
  lb: { name: 'Load balancer', icon: 'call_split', does: 'Spreads requests across several servers' },
  hub: { name: 'Hub', icon: 'device_hub', does: 'Repeats every frame out of every port; obsolete and insecure' },
  honeypot: { name: 'Honeypot', icon: 'bug_report', does: 'A decoy system that lures attackers and records what they do' },
};

export type Proto = 'TCP' | 'UDP';

/** A service the scenarios use: the transport protocols it runs over and its port (or range of ports). */
export interface Service { name: string; protos: Proto[]; port: number; to?: number }

export const SERVICES: Record<string, Service> = {
  https: { name: 'HTTPS', protos: ['TCP'], port: 443 },
  http: { name: 'HTTP', protos: ['TCP'], port: 80 },
  ssh: { name: 'SSH', protos: ['TCP'], port: 22 },
  sftp: { name: 'SFTP', protos: ['TCP'], port: 22 },
  telnet: { name: 'Telnet', protos: ['TCP'], port: 23 },
  ftp: { name: 'FTP', protos: ['TCP'], port: 21 },
  rdp: { name: 'RDP', protos: ['TCP'], port: 3389 },
  sql: { name: 'SQL Server', protos: ['TCP'], port: 1433 },
  smb: { name: 'SMB', protos: ['TCP'], port: 445 },
  print: { name: 'Printing', protos: ['TCP'], port: 9100 },
  modbus: { name: 'Modbus', protos: ['TCP'], port: 502 },
  opcua: { name: 'OPC UA', protos: ['TCP'], port: 4840 },
  sip: { name: 'SIP over TLS', protos: ['TCP'], port: 5061 },
  rtp: { name: 'SRTP voice', protos: ['UDP'], port: 16384, to: 32767 },
  ntp: { name: 'NTP', protos: ['UDP'], port: 123 },
  rtsp: { name: 'RTSP video', protos: ['TCP'], port: 554 },
  hl7: { name: 'HL7', protos: ['TCP'], port: 2575 },
  dns: { name: 'DNS', protos: ['UDP', 'TCP'], port: 53 },
  smtp: { name: 'SMTP', protos: ['TCP'], port: 25 },
  submission: { name: 'SMTP submission', protos: ['TCP'], port: 587 },
  imaps: { name: 'IMAPS', protos: ['TCP'], port: 993 },
  pop3: { name: 'POP3', protos: ['TCP'], port: 110 },
  ldap: { name: 'LDAP', protos: ['TCP'], port: 389 },
  ldaps: { name: 'LDAPS', protos: ['TCP'], port: 636 },
  kerberos: { name: 'Kerberos', protos: ['TCP', 'UDP'], port: 88 },
  radius: { name: 'RADIUS', protos: ['UDP'], port: 1812 },
  snmp: { name: 'SNMP', protos: ['UDP'], port: 161 },
  syslogtls: { name: 'Syslog over TLS', protos: ['TCP'], port: 6514 },
};

/** "HTTPS (TCP 443)". */
export function serviceLabel(id: string): string {
  const s = SERVICES[id];
  return s ? `${s.name} (${s.protos.join('/')} ${s.port}${s.to ? `-${s.to}` : ''})` : id;
}

/** A rule written with a port number instead of a service name, such as "tcp:443". */
export function parsePortRule(service: string): { proto: Proto; port: number } | null {
  const m = /^(tcp|udp):(\d{1,5})$/.exec(service);
  const port = m ? Number(m[2]) : 0;
  return m && port >= 1 && port <= 65535 ? { proto: m[1].toUpperCase() as Proto, port } : null;
}

/** A typed port as a rule's service ("tcp:443"), or null if it is not a whole number from 1 to 65535. */
export function typedPortRule(proto: 'tcp' | 'udp', typed: string): string | null {
  const t = typed.trim();
  const rule = `${proto}:${Number(t)}`;
  return /^\d{1,5}$/.test(t) && parsePortRule(rule) ? rule : null;
}

export const portRuleLabel = (r: { proto: Proto; port: number }) => `${r.proto} ${r.port}`;

/** Whether a rule's service field covers a flow's service, by name or by protocol and port. */
export function serviceMatches(ruleService: string, flowService: string): boolean {
  if (ruleService === 'any') return true;
  if (flowService === 'scan') return false;
  const pr = parsePortRule(ruleService);
  if (!pr) return ruleService === flowService;
  const s = SERVICES[flowService];
  return !!s && s.protos.includes(pr.proto) && pr.port >= s.port && pr.port <= (s.to ?? s.port);
}

/** What the Reference Sheet's port list says runs on a protocol and port. */
export function identifyPort(proto: Proto, port: number): { names: string; insecure: boolean; notes: string } | null {
  const hits = PORT_LIST.filter(e => {
    if (!e.transport.toUpperCase().split('/').includes(proto)) return false;
    return e.port.split('/').some(part => {
      const [lo, hi] = part.split('-').map(Number);
      return port === lo || (!!hi && port >= lo && port <= hi);
    });
  });
  if (!hits.length) return null;
  return { names: hits.map(h => h.protocol).join(', '), insecure: hits.some(h => h.status === 'insecure' || h.status === 'deprecated'), notes: hits.map(h => h.notes).join(' ') };
}

/** Where a flow is, for deciding which spots it passes: zone ids, or "internet" and "remote". */
export interface PathCtx { src: string; dst: string; dstHost?: string }

export interface LabSlot {
  id: string;
  label: string;
  /** Where it sits, in words. */
  where: string;
  /** Traffic passes through it (inline), or it gets a copy from a mirror port (tap). */
  mode: 'inline' | 'tap';
  /** Acceptable devices; the first is the best. */
  answer: DeviceKind[];
  why: string;
  /** Feedback for tempting wrong choices. */
  wrong?: Partial<Record<DeviceKind, string>>;
  /** Which flows pass this spot (or, for a tap, which it sees a copy of). */
  on: (p: PathCtx) => boolean;
  /** The VPN spot: remote users arrive through it. */
  vpn?: boolean;
}

export interface LabZone {
  id: string;
  name: string;
  vlan: number;
  /** e.g. "10.20.0.0/24". */
  subnet: string;
  gateway: string;
  /** The DHCP pool's first and last host number (last octet); none when the zone has no DHCP. */
  pool?: [number, number];
  note: string;
  tone: 0 | 1 | 2 | 3;
  /** Spots drawn inside this zone, such as a WAF in front of a server. */
  slots?: string[];
  /** Not on a switch port, such as the addresses handed to VPN clients. */
  virtual?: boolean;
}

export type AddrMode = 'static' | 'dhcp' | 'reserved';

export interface LabHost {
  id: string;
  name: string;
  icon: string;
  mac: string;
  /** The switch port it is plugged into (a port row id). */
  port?: string;
  /** For a wireless client: the access point it joins, whose VLAN it inherits. */
  via?: string;
  zone: string;
  zoneWhy: string;
  addr: AddrMode;
  addrWhy: string;
  /** The address of a static or reserved host in the reference setup. */
  ip?: string;
  /** Whether its port should have port security; true unless set. */
  secure?: boolean;
  secureWhy?: string;
}

export interface PortRow { id: string; label: string; host?: string }

/** A named system out on the internet, such as a payment processor, that rules and flows can name. */
export interface LabExternal { id: string; name: string; icon: string }

/** One node of the diagram, top to bottom: the internet, a spot to fill, or a switch with zones hanging off it. */
export interface ChainNode { kind: 'cloud' | 'slot' | 'switch'; name?: string; slot?: string; note?: string; zones?: string[]; tap?: string }

export type Threat = 'sqli' | 'exploit' | 'zeroday' | 'scan' | 'c2' | 'bruteforce';

export interface LabFlow {
  id: string;
  name: string;
  /** A host or external id, "internet", "remote" (a remote worker), "port:<row>" (a laptop in that port) or "swap:<host>" (a laptop in that host's port). */
  from: string;
  to: string;
  service: string;
  threat?: Threat;
  /** works: it must get through; blocked: it must be stopped; detected: stopped, or alerted to the SIEM. */
  expect: 'works' | 'blocked' | 'detected';
}

export interface LabRule { from: string; to: string; service: string; action: 'allow' | 'deny' }
/** The "Add a rule" form before it is added. When rules go by port, `proto` and the typed `port` are used instead of `service`. ICMP has no port. */
export interface RuleDraft extends LabRule { proto: 'any' | 'tcp' | 'udp' | 'icmp'; port: string }

export interface Detect { ipsMode: 'prevent' | 'detect'; signatures: boolean; anomaly: boolean; reputation: boolean; siem: boolean }

export interface LabScenario {
  id: string;
  name: string;
  icon: string;
  story: string;
  requirements: string[];
  chain: ChainNode[];
  slots: LabSlot[];
  palette: DeviceKind[];
  zones: LabZone[];
  hosts: LabHost[];
  ports: PortRow[];
  services: string[];
  flows: LabFlow[];
  externals?: LabExternal[];
  /**
   * The devices, ports and addresses come already set up and the lab opens on the rules, written with port numbers:
   * for scenarios about choosing the right ports.
   */
  portsOnly?: boolean;
  /** A rule set and detection settings that pass every flow, shown on request and checked by the spec. */
  solution: { rules: LabRule[]; detect: Detect };
}

/** Everything the learner has set, saved as they go. */
export interface LabWork {
  slots: Record<string, DeviceKind | undefined>;
  ports: Record<string, { vlan?: number; secure?: boolean; shut?: boolean }>;
  addr: Record<string, { mode?: AddrMode; ip?: string; prefix?: number; gw?: string }>;
  rules: LabRule[];
  detect: Detect;
  /** Rules are written as a protocol and port number ("tcp:443") instead of a service name. */
  portMode?: boolean;
  /** The half-filled "Add a rule" form, so a refresh keeps it. */
  ruleDraft?: RuleDraft;
  /** Built from scratch: the learner's own diagram, which traffic follows instead of the scenario's outline. */
  canvas?: Canvas;
}

export type NodeKind = DeviceKind | 'switch' | 'internet' | 'host';
/** A box on the diagram. A host's id is the host's own id; the internet is "internet"; devices are "<kind>-<n>". */
export interface CanvasNode { id: string; kind: NodeKind; x: number; y: number }
export interface CanvasLink { a: string; b: string }
export interface Canvas { nodes: CanvasNode[]; links: CanvasLink[] }

export const START_DETECT: Detect = { ipsMode: 'detect', signatures: true, anomaly: false, reputation: false, siem: false };

export const emptyWork = (): LabWork => ({ slots: {}, ports: {}, addr: {}, rules: [], detect: { ...START_DETECT }, portMode: true });

// ── Addresses ───────────────────────────────────────────────────────────

export function ipToNum(ip: string | undefined): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec((ip ?? '').trim());
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some(p => p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function subnetOf(cidr: string): { base: number; prefix: number; size: number } {
  const [ip, p] = cidr.split('/');
  const prefix = Number(p);
  const size = 2 ** (32 - prefix);
  const base = ipToNum(ip)!;
  return { base: base - (base % size), prefix, size };
}

export const prefixMask = (prefix: number) => {
  const n = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.');
};

// ── Who is where ─────────────────────────────────────────────────────────

export const hostById = (sc: LabScenario, id: string) => sc.hosts.find(h => h.id === id);
export const zoneById = (sc: LabScenario, id: string) => sc.zones.find(z => z.id === id);
export const externalById = (sc: LabScenario, id: string) => sc.externals?.find(e => e.id === id);
/** The name of a host or an external system. */
const nameOf = (sc: LabScenario, id: string) => hostById(sc, id)?.name ?? externalById(sc, id)?.name ?? id;

/** The zone a port is in, from the VLAN set on it; undefined while it is still in the default VLAN 1. */
export function portZone(sc: LabScenario, w: LabWork, portId: string): LabZone | undefined {
  const vlan = w.ports[portId]?.vlan;
  return sc.zones.find(z => !z.virtual && z.vlan === vlan);
}

/** The zone a host ends up in: its port's VLAN, or for a wireless client, its access point's. */
export function hostZone(sc: LabScenario, w: LabWork, host: LabHost): LabZone | undefined {
  if (host.via) {
    const ap = hostById(sc, host.via);
    return ap ? hostZone(sc, w, ap) : undefined;
  }
  return host.port ? portZone(sc, w, host.port) : undefined;
}

/** Hosts whose addresses are set on the Address stage: everything wired. */
export const addressedHosts = (sc: LabScenario) => sc.hosts.filter(h => !h.via);

// ── Stage 1: placing devices ─────────────────────────────────────────────

export function gradeSlot(slot: LabSlot, placed: DeviceKind | undefined): { ok: boolean; text: string } {
  if (!placed) return { ok: false, text: `Nothing placed yet. ${slot.why}` };
  if (slot.answer.includes(placed)) return { ok: true, text: slot.why };
  return { ok: false, text: `${slot.wrong?.[placed] ?? `A ${DEVICES[placed].name.toLowerCase()} is not the right device here.`} ${slot.why}` };
}

// ── Stage 2: VLANs and port security ─────────────────────────────────────

export function gradePort(sc: LabScenario, w: LabWork, row: PortRow): string[] {
  const p = w.ports[row.id] ?? {};
  if (!row.host) return p.shut ? [] : ['Nothing is plugged in here, so shut the port down. A live spare port lets anyone plug in and join the network.'];
  const host = hostById(sc, row.host)!;
  const want = zoneById(sc, host.zone)!;
  const problems: string[] = [];
  if (p.shut) problems.push(`${host.name} is plugged in here, so the port must stay up.`);
  if (p.vlan !== want.vlan) problems.push(`Put it in VLAN ${want.vlan} (${want.name}). ${host.zoneWhy}`);
  const secure = host.secure ?? true;
  if (secure && !p.secure) problems.push('Turn on port security so only this device\'s MAC address may use the port.');
  if (!secure && p.secure) problems.push(host.secureWhy ?? 'Port security limited to one MAC address would break this port.');
  return problems;
}

// ── Stage 3: addresses ───────────────────────────────────────────────────

/** Settings that stop a host working on the network at all, as opposed to merely being bad practice. */
export function addrFaults(sc: LabScenario, w: LabWork, host: LabHost): string[] {
  const zone = hostZone(sc, w, host);
  if (!zone) return ['Its switch port is still in the default VLAN 1, which has no subnet or gateway here, so it cannot reach anything.'];
  // Wireless clients always use the access point's DHCP; only wired devices are set by hand.
  const a: LabWork['addr'][string] = host.via ? { mode: 'dhcp' } : w.addr[host.id] ?? {};
  if (!a.mode) return ['It has no address yet: choose how it gets one.'];
  if (a.mode === 'dhcp') return zone.pool ? [] : [`${zone.name} has no DHCP server, so it gets no address. Set one by hand.`];
  if (a.mode === 'reserved' && !zone.pool) return [`${zone.name} has no DHCP server to hold a reservation.`];
  const net = subnetOf(zone.subnet);
  const ip = ipToNum(a.ip);
  const faults: string[] = [];
  if (ip === null) return [`"${a.ip ?? ''}" is not an IPv4 address.`];
  const offset = ip - net.base;
  if (offset < 0 || offset >= net.size) faults.push(`${a.ip} is not in ${zone.name}'s subnet, ${zone.subnet}.`);
  else if (offset === 0) faults.push(`${a.ip} is the network address of ${zone.subnet}; no host may use it.`);
  else if (offset === net.size - 1) faults.push(`${a.ip} is the broadcast address of ${zone.subnet}; no host may use it.`);
  if (a.ip?.trim() === zone.gateway) faults.push(`${a.ip} is the gateway's own address, so it would clash with the firewall.`);
  const dup = addressedHosts(sc).find(o => o.id !== host.id && (w.addr[o.id]?.mode === 'static' || w.addr[o.id]?.mode === 'reserved') && ipToNum(w.addr[o.id]?.ip) === ip);
  if (dup) faults.push(`${dup.name} already has ${a.ip}: two devices with one address both stop working.`);
  if (a.mode === 'static') {
    if (zone.pool && offset >= zone.pool[0] && offset <= zone.pool[1]) faults.push(`${a.ip} is inside the DHCP pool (.${zone.pool[0]} to .${zone.pool[1]}), so DHCP could hand it to another device.`);
    if (a.prefix !== net.prefix) faults.push(`The mask must match the subnet: /${net.prefix} (${prefixMask(net.prefix)}).`);
    if ((a.gw ?? '').trim() !== zone.gateway) faults.push(`The default gateway for ${zone.name} is ${zone.gateway}${a.gw ? `, not ${a.gw}` : ''}; without the right one it cannot leave its subnet.`);
  }
  return faults;
}

/** Everything wrong with a host's address settings, including the right method for the device. */
export function gradeAddr(sc: LabScenario, w: LabWork, host: LabHost): string[] {
  const mode = w.addr[host.id]?.mode;
  const out: string[] = [];
  if (mode && mode !== host.addr) out.push(host.addrWhy);
  return [...out, ...addrFaults(sc, w, host)];
}

// ── Traffic ──────────────────────────────────────────────────────────────

export interface Hop { at: string; result: 'pass' | 'block' | 'alert' | 'fail' | 'info'; text: string }
export interface FlowResult { hops: Hop[]; delivered: boolean; blocked: boolean; alerted: boolean; ok: boolean }

const where = (sc: LabScenario, id: string) => id === 'internet' ? 'the internet' : id === 'remote' ? 'a remote laptop' : zoneById(sc, id)?.name ?? id;

function endsMatch(r: LabRule, src: string, srcHost: string | undefined, dst: string, dstHost: string | undefined): boolean {
  const from = r.from === 'any' || r.from === src || (!!srcHost && r.from === srcHost);
  const to = r.to === 'any' || r.to === dst || (!!dstHost && r.to === dstHost);
  return from && to;
}

// A scan tries every port, so only a rule allowing any service lets it find more than the allowed ones.
const ruleMatches = (r: LabRule, src: string, srcHost: string | undefined, dst: string, dstHost: string | undefined, service: string) =>
  endsMatch(r, src, srcHost, dst, dstHost) && serviceMatches(r.service, service);

/**
 * Which threats each detection method recognizes. SQL injection hides inside encrypted HTTPS form fields, which only
 * a WAF (where the TLS connection ends) reads.
 */
const SIGNATURE: Threat[] = ['exploit', 'scan', 'bruteforce'];
const ANOMALY: Threat[] = ['zeroday', 'scan', 'bruteforce', 'c2'];

function detects(d: Detect, threat: Threat | undefined): string | null {
  if (!threat) return null;
  if (d.signatures && SIGNATURE.includes(threat)) return 'a signature matches it';
  if (d.anomaly && ANOMALY.includes(threat)) return 'it looks unlike normal traffic (anomaly)';
  return null;
}

const THREAT_NAME: Record<Threat, string> = {
  sqli: 'SQL injection', exploit: 'a known exploit', zeroday: 'a brand-new exploit', scan: 'a port scan', c2: 'malware calling its command-and-control server', bruteforce: 'password guessing',
};

// ── Diagrams built from scratch ──────────────────────────────────────────

const L3: NodeKind[] = ['firewall', 'ngfw', 'router'];
const L2: NodeKind[] = ['switch', 'hub'];

export const blankCanvas = (): Canvas => ({ nodes: [{ id: 'internet', kind: 'internet', x: 300, y: 16 }], links: [] });

export const neighbours = (c: Canvas, id: string): string[] =>
  c.links.flatMap(l => l.a === id ? [l.b] : l.b === id ? [l.a] : []);
const nodeOf = (c: Canvas, id: string) => c.nodes.find(n => n.id === id);

/** An IDS or IPS whose only cable goes to a switch sits on the switch's mirror port: it gets a copy of the traffic. */
export function isTap(c: Canvas, n: CanvasNode): boolean {
  if (n.kind !== 'ids' && n.kind !== 'ips') return false;
  const nb = neighbours(c, n.id);
  return nb.length === 1 && L2.includes(nodeOf(c, nb[0])?.kind as NodeKind);
}

/** "Firewall", or "Firewall 2" when there are several. */
export function nodeLabel(sc: LabScenario, c: Canvas, id: string): string {
  if (id === 'internet') return 'Internet';
  const n = nodeOf(c, id);
  if (!n || n.kind === 'host') return nameOf(sc, id);
  const base = n.kind === 'switch' ? 'Switch' : DEVICES[n.kind as DeviceKind].name;
  const same = c.nodes.filter(o => o.kind === n.kind);
  return same.length > 1 ? `${base} ${same.indexOf(n) + 1}` : base;
}

/** Shortest cable path. Traffic never passes through a computer, the internet or a mirror-port sensor on the way. */
function bfs(c: Canvas, from: string, to: (id: string) => boolean, through: (n: CanvasNode) => boolean = () => true): string[] | null {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift()!;
    if (id !== from && to(id)) {
      const path = [id];
      for (let p = prev.get(id); p != null; p = prev.get(p)) path.unshift(p);
      return path;
    }
    if (id !== from) {
      const n = nodeOf(c, id);
      if (!n || n.kind === 'host' || n.kind === 'internet' || isTap(c, n) || !through(n)) continue;
    }
    for (const nb of neighbours(c, id)) if (!prev.has(nb)) { prev.set(nb, id); queue.push(nb); }
  }
  return null;
}

/** One device the traffic meets, in order: inline, or a sensor on a switch's mirror port. */
interface Step { at: string; dev?: DeviceKind; tap: boolean }

/**
 * The way a flow takes through a diagram. Inside one VLAN it stays on the switches. Between VLANs it goes to the
 * nearest router or firewall (its default gateway) and on from there, so whatever does the routing is what filters.
 */
function graphRoute(sc: LabScenario, c: Canvas, srcNode: string, src: string, dstNode: string, dst: string): { steps: Step[] } | { at: string; error: string } {
  for (const id of [srcNode, dstNode]) {
    const at = nodeLabel(sc, c, id);
    if (!nodeOf(c, id)) return { at, error: `${at} is not on the diagram yet.` };
    if (!neighbours(c, id).length) return { at, error: `${at} has no cable.` };
  }
  const name = (id: string) => nodeLabel(sc, c, id);
  if (srcNode === dstNode) return { steps: [] };
  let nodes: string[] | null;
  if (src === dst) {
    nodes = bfs(c, srcNode, id => id === dstNode, n => !L3.includes(n.kind));
    if (!nodes) return { at: name(srcNode), error: `Both ends are in ${where(sc, src)}, but no switches connect them without a router or firewall in between, so they cannot reach each other in one VLAN.` };
  } else if (srcNode === 'internet') {
    nodes = bfs(c, srcNode, id => id === dstNode);
  } else {
    // Its default gateway is a router or firewall on its own side of the network; where there are several, the one
    // that leads to the destination, as a network designer would set it.
    const local = c.nodes.filter(n => L3.includes(n.kind))
      .map(n => bfs(c, srcNode, id => id === n.id, x => !L3.includes(x.kind)))
      .filter((p): p is string[] => !!p);
    if (!local.length) return { at: name(srcNode), error: `To reach another network it needs a default gateway, but no router or firewall is cabled to its side of the network.` };
    nodes = null;
    for (const toGw of local) {
      const onward = bfs(c, toGw[toGw.length - 1], id => id === dstNode);
      if (onward && (!nodes || toGw.length + onward.length - 1 < nodes.length)) nodes = [...toGw, ...onward.slice(1)];
    }
  }
  if (!nodes) return { at: name(srcNode), error: `No cables lead from ${name(srcNode)} to ${name(dstNode)}.` };
  const steps: Step[] = [];
  const seen = new Set<string>();
  // A laptop in a spare port starts at a switch, which counts; any other starting box is the sender itself.
  for (const [i, id] of nodes.slice(0, -1).entries()) {
    const n = nodeOf(c, id)!;
    if (i === 0 && !L2.includes(n.kind)) continue;
    if (L2.includes(n.kind)) {
      if (n.kind === 'hub') steps.push({ at: name(id), dev: 'hub', tap: false });
      for (const t of neighbours(c, id).map(x => nodeOf(c, x)!).filter(x => isTap(c, x) && !seen.has(x.id))) {
        seen.add(t.id);
        steps.push({ at: `${name(t.id)} (mirror port)`, dev: t.kind as DeviceKind, tap: true });
      }
    } else {
      steps.push({ at: name(id), dev: n.kind as DeviceKind, tap: false });
    }
  }
  return { steps };
}

/** The VPN concentrator remote workers arrive through: one the internet can reach. */
function vpnNode(c: Canvas): string | undefined {
  return c.nodes.find(n => n.kind === 'vpn' && bfs(c, 'internet', id => id === n.id))?.id;
}

/** Where a laptop in a spare port joins the diagram: the switch its neighbouring ports' devices are cabled to. */
function spareSwitch(sc: LabScenario, c: Canvas, portId: string): string | undefined {
  const i = sc.ports.findIndex(p => p.id === portId);
  const rows = [...sc.ports.slice(0, i).reverse(), ...sc.ports.slice(i + 1)];
  for (const r of rows) {
    if (!r.host) continue;
    const sw = neighbours(c, r.host).find(id => L2.includes(nodeOf(c, id)?.kind as NodeKind));
    if (sw) return sw;
  }
  return c.nodes.find(n => n.kind === 'switch')?.id;
}

export interface DesignCheck { slot: LabSlot; ok: boolean; text: string }

/**
 * Review a diagram built from scratch against the scenario's jobs: each spot of the guided outline becomes a job
 * ("all traffic from the internet passes an IPS") that the learner's own layout must do somewhere.
 */
export function gradeDesign(sc: LabScenario, w: LabWork): { checks: DesignCheck[]; findings: string[] } {
  const c = w.canvas ?? blankCanvas();
  const findings: string[] = [];
  const unplaced = sc.hosts.filter(h => !h.via && !nodeOf(c, h.id));
  if (unplaced.length) findings.push(`Still to place: ${unplaced.map(h => h.name).join(', ')}.`);
  const loose = c.nodes.filter(n => !neighbours(c, n.id).length);
  if (loose.length) findings.push(`Not cabled yet: ${loose.map(n => nodeLabel(sc, c, n.id)).join(', ')}.`);
  if (c.nodes.some(n => n.kind === 'hub')) findings.push('A hub repeats every frame out of every port, so any device on it can capture the others\' traffic. Use a switch.');

  // Each flow between real systems, with the zones the scenario intends, so the review does not depend on the VLAN settings.
  const vpn = vpnNode(c);
  const ends = sc.flows.flatMap(f => {
    if (f.from.startsWith('port:') || f.from.startsWith('swap:')) return [];
    const at = (id: string) => {
      if (id === 'internet' || externalById(sc, id)) return { node: 'internet', zone: 'internet', host: externalById(sc, id) ? id : undefined };
      const h = hostById(sc, id)!;
      return { node: h.via ?? h.id, zone: h.zone, host: h.id };
    };
    const to = at(f.to);
    if (f.from === 'remote') {
      const zone = sc.zones.find(z => z.virtual)!.id;
      return [{ f, remote: true, srcNode: vpn ?? 'internet', src: vpn ? zone : 'internet', ctxSrc: zone, ...to }];
    }
    const from = at(f.from);
    return [{ f, remote: false, srcNode: from.node, src: from.zone, ctxSrc: from.zone, ...to }];
  });

  const checks = sc.slots.map((slot): DesignCheck => {
    if (slot.vpn) {
      return vpn ? { slot, ok: true, text: slot.why } : { slot, ok: false, text: `Nothing lets remote workers in: no VPN concentrator the internet can reach. ${slot.why}` };
    }
    const covered = ends.filter(e => slot.on({ src: e.ctxSrc, dst: e.zone, dstHost: e.host }));
    const routes = covered.map(e => ({ e, r: graphRoute(sc, c, e.srcNode, e.src, e.node, e.zone) }));
    if (routes.some(x => 'error' in x.r)) return { slot, ok: false, text: 'Some of the traffic this job covers cannot get through at all yet, so finish placing and cabling first.' };
    const stepsOf = (x: (typeof routes)[number]) => (x.r as { steps: Step[] }).steps;
    let ok: boolean;
    if (slot.mode === 'inline') {
      ok = routes.every(x => stepsOf(x).some(s => !s.tap && !!s.dev && slot.answer.includes(s.dev)));
    } else {
      const seen = (x: (typeof routes)[number]) => stepsOf(x).some(s => s.tap && !!s.dev && slot.answer.includes(s.dev));
      const detected = routes.filter(x => x.e.f.expect === 'detected');
      ok = detected.length ? detected.every(seen) : routes.some(seen);
    }
    if (ok) return { slot, ok, text: slot.why };
    const wrong = routes.flatMap(stepsOf).map(s => s.dev).find(d => !!d && !!slot.wrong?.[d] && (slot.mode === 'tap') === routes.flatMap(stepsOf).some(s => s.dev === d && s.tap));
    return { slot, ok, text: `${wrong ? slot.wrong![wrong] : 'Nothing does this job yet.'} ${slot.why}` };
  });
  return { checks, findings };
}

/**
 * The scenario's outline drawn as a diagram: one way to build it from scratch, shown on request and used by the spec
 * to prove the routing works.
 */
export function chainCanvas(sc: LabScenario): Canvas {
  const nodes: CanvasNode[] = [];
  const links: CanvasLink[] = [];
  const count: Partial<Record<NodeKind, number>> = {};
  const add = (kind: NodeKind, x: number, y: number, id?: string) => {
    count[kind] = (count[kind] ?? 0) + 1;
    const n = { id: id ?? `${kind}-${count[kind]}`, kind, x, y };
    nodes.push(n);
    return n.id;
  };
  const link = (a: string, b: string) => links.push({ a, b });
  let y = 16;
  const COL = 300;
  // Hang a switch's zones under it: hosts in rows, with any spot drawn inside a zone (a WAF, a VPN) in front.
  // Hang a switch's zones under it: any spot drawn inside a zone (a WAF, a VPN) on the first row, cabled to the switch,
  // with the servers it guards straight below it; every other system on the rows below, cabled to the switch. While
  // more of the outline follows, the middle column stays clear for the cable down to it.
  const hang = (sw: string, zones: string[], spine: boolean) => {
    const cols = spine ? [0, 1, 3, 4] : [0, 1, 2, 3, 4];
    const guards: { kind: NodeKind; hosts: string[] }[] = [];
    const hosts: string[] = [];
    for (const zid of zones) {
      const inZone = sc.hosts.filter(h => h.zone === zid && !h.via);
      for (const sid of zoneById(sc, zid)!.slots ?? []) {
        const slot = sc.slots.find(s => s.id === sid)!;
        guards.push({ kind: slot.answer[0], hosts: slot.vpn ? [] : inZone.filter(h => slot.on({ src: 'internet', dst: zid, dstHost: h.id })).map(h => h.id) });
      }
      hosts.push(...inZone.map(h => h.id));
    }
    const top = y + 76;
    const taken = new Set<string>();
    const at = (row: number, col: number) => { taken.add(`${row}:${col}`); return { x: 16 + cols[col] * 140, y: top + row * 76 }; };
    const rows = guards.length ? 1 : 0;
    const guarded = new Set<string>();
    guards.forEach((g, col) => {
      const p = at(0, col);
      const gid = add(g.kind, p.x, p.y);
      link(sw, gid);
      g.hosts.forEach((h, k) => {
        const q = at(rows + k, col);
        add('host', q.x, q.y, h);
        link(gid, h);
        guarded.add(h);
      });
    });
    let last = rows - 1;
    for (const h of hosts.filter(x => !guarded.has(x))) {
      let cell = 0;
      const n = cols.length;
      while (taken.has(`${rows + Math.floor(cell / n)}:${cell % n}`)) cell++;
      const row = rows + Math.floor(cell / n);
      const p = at(row, cell % n);
      add('host', p.x, p.y, h);
      link(sw, h);
      last = Math.max(last, row);
    }
    for (const t of taken) last = Math.max(last, Number(t.split(':')[0]));
    y = top + last * 76;
  };
  let prev: string | null = null;
  for (const [i, n] of sc.chain.entries()) {
    const spine = i < sc.chain.length - 1;
    let id: string;
    if (n.kind === 'cloud') id = add('internet', COL, y, 'internet');
    else if (n.kind === 'slot') {
      id = add(sc.slots.find(s => s.id === n.slot)!.answer[0], COL, y);
      if (prev) link(prev, id);
      if (n.zones?.length) {
        const sw = add('switch', COL + 180, y);
        link(id, sw);
        hang(sw, n.zones, spine);
      }
    } else {
      id = add('switch', COL, y);
      if (prev) link(prev, id);
      if (n.tap) link(id, add(sc.slots.find(s => s.id === n.tap)!.answer[0], COL + 180, y));
      if (n.zones?.length) hang(id, n.zones, spine);
    }
    prev = id;
    y += 76;
  }
  return { nodes, links };
}

// ── Running traffic ──────────────────────────────────────────────────────

export function runFlow(sc: LabScenario, w: LabWork, flow: LabFlow): FlowResult {
  const hops: Hop[] = [];
  const done = (delivered: boolean, blocked: boolean, alerted: boolean): FlowResult => {
    const ok = flow.expect === 'works' ? delivered : flow.expect === 'blocked' ? blocked : blocked || alerted;
    return { hops, delivered, blocked, alerted, ok };
  };

  // Where it starts: a zone, and in a diagram built from scratch, the box it leaves from.
  let src: string;
  let srcHost: string | undefined;
  let srcNode = 'internet';
  if (flow.from === 'internet') {
    src = 'internet';
    hops.push({ at: 'Internet', result: 'info', text: 'It arrives from the internet.' });
  } else if (externalById(sc, flow.from)) {
    src = 'internet';
    srcHost = flow.from;
    hops.push({ at: nameOf(sc, flow.from), result: 'info', text: 'It arrives from the internet.' });
  } else if (flow.from === 'remote') {
    const spot = sc.slots.find(s => s.vpn);
    const vpn = w.canvas ? vpnNode(w.canvas) : spot && w.slots[spot.id] === 'vpn' ? 'vpn' : undefined;
    if (vpn) {
      src = sc.zones.find(z => z.virtual)!.id;
      srcNode = vpn;
      hops.push({ at: DEVICES.vpn.name, result: 'pass', text: `The VPN concentrator checks the user's sign-in, ends the encrypted tunnel and gives the laptop an address in ${where(sc, src)}.` });
    } else {
      src = 'internet';
      hops.push({ at: 'Internet', result: 'info', text: 'Nothing ends a VPN tunnel, so the laptop can only arrive from the internet, like anyone else.' });
    }
  } else if (flow.from.startsWith('port:') || flow.from.startsWith('swap:')) {
    const swap = flow.from.startsWith('swap:');
    const portId = swap ? hostById(sc, flow.from.slice(5))!.port! : flow.from.slice(5);
    const row = sc.ports.find(p => p.id === portId)!;
    const p = w.ports[portId] ?? {};
    if (p.shut) {
      hops.push({ at: row.label, result: 'block', text: 'The port is shut down, so the laptop gets no link light at all.' });
      return done(false, true, false);
    }
    if (swap && p.secure) {
      hops.push({ at: row.label, result: 'block', text: 'Port security sees a MAC address it has not learned for this port and shuts the port down.' });
      return done(false, true, false);
    }
    const z = portZone(sc, w, portId);
    hops.push({ at: row.label, result: 'fail', text: swap ? 'Without port security the switch accepts the new MAC address.' : 'The spare port is live, so the switch lets the laptop on.' });
    if (!z) {
      hops.push({ at: row.label, result: 'fail', text: 'It lands in the default VLAN 1, alongside anything else left there, and can attack the switch itself.' });
      return done(false, false, false);
    }
    src = z.id;
    hops.push({ at: row.label, result: 'fail', text: `It lands in ${z.name} (VLAN ${z.vlan}) and DHCP gives it an address.` });
    if (w.canvas) {
      const at = swap ? flow.from.slice(5) : spareSwitch(sc, w.canvas, portId);
      if (!at) {
        hops.push({ at: row.label, result: 'info', text: 'There is no switch on the diagram yet for it to plug into.' });
        return done(false, false, false);
      }
      srcNode = at;
    }
  } else {
    const host = hostById(sc, flow.from)!;
    const faults = addrFaults(sc, w, host);
    if (faults.length) {
      hops.push({ at: host.name, result: 'fail', text: faults[0] });
      return done(false, false, false);
    }
    src = hostZone(sc, w, host)!.id;
    srcHost = host.id;
    srcNode = host.via ?? host.id;
    hops.push({ at: host.name, result: 'info', text: `It starts in ${where(sc, src)}.` });
  }

  // Where it is going.
  let dst: string;
  let dstHost: string | undefined;
  let dstNode = 'internet';
  if (flow.to === 'internet') dst = 'internet';
  else if (externalById(sc, flow.to)) {
    dst = 'internet';
    dstHost = flow.to;
  } else {
    const host = hostById(sc, flow.to)!;
    const faults = addrFaults(sc, w, host);
    const mode = w.addr[host.id]?.mode;
    if (!faults.length && mode === 'dhcp' && host.addr !== 'dhcp') faults.push(`${host.name} takes a DHCP address that can change, while DNS and the firewall rules point at its fixed one.`);
    if (faults.length) {
      hops.push({ at: host.name, result: 'fail', text: `${host.name} cannot be reached: ${faults[0]}` });
      return done(false, false, false);
    }
    dst = hostZone(sc, w, host)!.id;
    dstHost = host.id;
    dstNode = host.via ?? host.id;
  }

  // What it meets on the way: the outline's spots, or whatever the learner cabled into their own diagram.
  let steps: Step[];
  if (w.canvas) {
    const route = graphRoute(sc, w.canvas, srcNode, src, dstNode, dst);
    if ('error' in route) {
      hops.push({ at: route.at, result: 'fail', text: route.error });
      return done(false, false, false);
    }
    steps = route.steps;
  } else {
    const ctx: PathCtx = { src, dst, dstHost };
    // Inside one VLAN the switch delivers directly, so only what watches the switch sees it.
    steps = sc.slots.filter(s => !s.vpn && s.on(ctx) && (s.mode === 'tap' || src !== dst)).map(slot => {
      const dev = w.slots[slot.id];
      return { at: dev ? `${DEVICES[dev].name} (${slot.label})` : slot.label, dev, tap: slot.mode === 'tap' };
    });
  }
  const d = w.detect;
  let alerted = false;
  const alert = (at: string, how: string) => {
    alerted = d.siem;
    hops.push({ at, result: 'alert', text: `It raises an alert because ${how}. ${d.siem ? 'The alert goes to the SIEM, where an analyst sees it.' : 'The alert stays in the device\'s own log, where nobody is looking: send alerts to the SIEM.'}` });
  };

  if (src === dst) {
    hops.push({ at: 'Switch', result: 'info', text: `Both ends are in ${where(sc, src)}, the same VLAN, so the switch delivers it directly. No firewall sits in between.` });
  }
  let filtered = false;
  for (const { at, dev, tap } of steps) {
    if (tap) {
      if (dev === 'ids' || dev === 'ips') {
        const how = detects(d, flow.threat);
        if (how) alert(at, dev === 'ips' ? `${how}, but on a mirror port it only gets a copy, so it cannot drop anything` : how);
      }
      continue;
    }
    if (!dev) {
      hops.push({ at, result: 'info', text: 'This spot is empty, so the traffic passes straight through.' });
      continue;
    }
    if (dev === 'firewall' || dev === 'ngfw') {
      if (filtered) continue;
      filtered = true;
      const i = w.rules.findIndex(r => ruleMatches(r, src, srcHost, dst, dstHost, flow.service));
      const rule = w.rules[i];
      // When rules are written with port numbers, name the protocol but not its port, so the learner recalls it.
      const svc = flow.service === 'scan' ? 'the probed ports' : w.portMode ? SERVICES[flow.service]?.name ?? flow.service : serviceLabel(flow.service);
      if (!rule) {
        let text = `No rule allows ${svc} from ${where(sc, src)} to ${dstHost ? nameOf(sc, dstHost) : where(sc, dst)}, so the implicit deny drops it.`;
        const near = w.rules.findIndex(r => r.action === 'allow' && endsMatch(r, src, srcHost, dst, dstHost) && parsePortRule(r.service));
        if (near >= 0 && flow.service !== 'scan') {
          const pr = parsePortRule(w.rules[near].service)!;
          const known = identifyPort(pr.proto, pr.port);
          text += ` Rule ${near + 1} allows ${portRuleLabel(pr)}${known ? `, which is ${known.names}` : ''}, but ${svc} uses a different ${SERVICES[flow.service]?.protos.includes(pr.proto) ? 'port' : 'protocol or port'}.`;
        }
        hops.push({ at, result: 'block', text });
        return done(false, true, alerted);
      }
      if (rule.action === 'deny') {
        hops.push({ at, result: 'block', text: `Rule ${i + 1} denies it.` });
        return done(false, true, alerted);
      }
      hops.push({ at, result: 'pass', text: flow.service === 'scan' ? `Rule ${i + 1} allows any service, so the scan finds every open port.` : `Rule ${i + 1} allows it, and the reply is let back in because the firewall tracks the connection.` });
      continue;
    }
    if (dev === 'ips' || dev === 'ids') {
      const how = detects(d, flow.threat);
      if (!how) {
        hops.push({ at, result: 'pass', text: flow.threat ? `Nothing it is set to look for matches ${THREAT_NAME[flow.threat]}.` : 'Nothing suspicious.' });
        continue;
      }
      if (dev === 'ips' && d.ipsMode === 'prevent') {
        hops.push({ at, result: 'block', text: `It drops the traffic because ${how}.` });
        alert(at, how);
        return done(false, true, alerted);
      }
      alert(at, dev === 'ids' ? `${how}, but an IDS is passive and cannot drop anything` : `${how}, but the IPS is set to detect only`);
      continue;
    }
    if (dev === 'waf') {
      if (flow.threat === 'sqli') {
        hops.push({ at, result: 'block', text: 'It reads the HTTP request, finds SQL in a form field, and blocks it.' });
        return done(false, true, alerted);
      }
      hops.push({ at, result: 'pass', text: flow.service === 'https' || flow.service === 'http' ? 'The web request looks normal.' : 'It only understands web traffic, so it passes this through.' });
      continue;
    }
    if (dev === 'proxy') {
      if (dst === 'internet' && flow.threat === 'c2') {
        if (d.reputation) {
          hops.push({ at, result: 'block', text: 'The destination is on a known-bad reputation list, so the proxy refuses to fetch it.' });
          return done(false, true, alerted);
        }
        hops.push({ at, result: 'pass', text: 'Reputation filtering is off, so the proxy fetches whatever is asked for.' });
        continue;
      }
      hops.push({ at, result: 'pass', text: dst === 'internet' ? 'It fetches the site for the user.' : 'A forward proxy handles users\' requests out to the internet; it passes this through.' });
      continue;
    }
    hops.push({ at, result: 'info', text: { router: 'A router just forwards it; nothing here applies the security rules.', hub: 'A hub repeats it to every port, so anyone plugged in can capture it.', honeypot: 'A honeypot is a decoy, not a filter: it does nothing to traffic passing through.', lb: 'A load balancer forwards it to a server without inspecting it.', vpn: 'A VPN concentrator only handles tunnels; it passes this through.' }[dev as 'router' | 'hub' | 'honeypot' | 'lb' | 'vpn'] });
  }
  if (src !== dst && !filtered) hops.push({ at: 'Firewall', result: 'fail', text: 'No firewall stands on this path, so nothing applies the rules and everything gets through.' });

  hops.push({ at: dstHost ? nameOf(sc, dstHost) : 'Internet', result: 'pass', text: flow.threat ? `It gets there: ${THREAT_NAME[flow.threat]} reaches its target.` : 'Delivered.' });
  return done(true, false, alerted);
}

/**
 * The network as the scenario intends it: the best device in each spot, every port and address right, and the
 * solution's rules and detection. Used for scenarios that come set up, and by the spec.
 */
export function referenceWork(sc: LabScenario, portMode = false): LabWork {
  const w = emptyWork();
  for (const s of sc.slots) w.slots[s.id] = s.answer[0];
  for (const row of sc.ports) {
    if (!row.host) { w.ports[row.id] = { shut: true }; continue; }
    const h = hostById(sc, row.host)!;
    w.ports[row.id] = { vlan: zoneById(sc, h.zone)!.vlan, secure: h.secure ?? true };
  }
  for (const h of addressedHosts(sc)) {
    const z = zoneById(sc, h.zone)!;
    w.addr[h.id] = h.addr === 'dhcp' ? { mode: 'dhcp' }
      : h.addr === 'reserved' ? { mode: 'reserved', ip: h.ip }
      : { mode: 'static', ip: h.ip, prefix: subnetOf(z.subnet).prefix, gw: z.gateway };
  }
  w.rules = sc.solution.rules.map(r => ({ ...r, service: portMode ? toPortRule(r.service) : r.service }));
  w.detect = { ...sc.solution.detect };
  w.portMode = portMode;
  return w;
}

/** A service name as a port rule ("https" becomes "tcp:443"). */
export function toPortRule(service: string): string {
  const s = SERVICES[service];
  return s ? `${s.protos[0].toLowerCase()}:${s.port}` : service;
}

/** Where a scenario starts: empty, or for a ports-only scenario, built except for its rules. */
export function startWork(sc: LabScenario): LabWork {
  if (!sc.portsOnly) return emptyWork();
  return { ...referenceWork(sc, true), rules: [], detect: { ...sc.solution.detect } };
}
