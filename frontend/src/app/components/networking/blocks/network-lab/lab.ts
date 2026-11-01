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

export const SERVICES: Record<string, string> = {
  https: 'HTTPS (TCP 443)', http: 'HTTP (TCP 80)', ssh: 'SSH (TCP 22)', rdp: 'RDP (TCP 3389)', sql: 'SQL (TCP 1433)',
  smb: 'SMB (TCP 445)', print: 'Printing (TCP 9100)', modbus: 'Modbus (TCP 502)', opcua: 'OPC UA (TCP 4840)',
  sip: 'SIP over TLS (TCP 5061)', rtp: 'SRTP voice (UDP 16384-32767)', ntp: 'NTP (UDP 123)', rtsp: 'RTSP video (TCP 554)', hl7: 'HL7 (TCP 2575)',
};

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
}

export const START_DETECT: Detect = { ipsMode: 'detect', signatures: true, anomaly: false, reputation: false, siem: false };

export const emptyWork = (): LabWork => ({ slots: {}, ports: {}, addr: {}, rules: [], detect: { ...START_DETECT } });

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

function ruleMatches(r: LabRule, src: string, srcHost: string | undefined, dst: string, dstHost: string | undefined, service: string): boolean {
  const from = r.from === 'any' || r.from === src || (!!srcHost && r.from === srcHost);
  const to = r.to === 'any' || r.to === dst || (!!dstHost && r.to === dstHost);
  // A scan tries every port, so only a rule allowing any service lets it find more than the allowed ones.
  const svc = r.service === 'any' || (service !== 'scan' && r.service === service);
  return from && to && svc;
}

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

export function runFlow(sc: LabScenario, w: LabWork, flow: LabFlow): FlowResult {
  const hops: Hop[] = [];
  const done = (delivered: boolean, blocked: boolean, alerted: boolean): FlowResult => {
    const ok = flow.expect === 'works' ? delivered : flow.expect === 'blocked' ? blocked : blocked || alerted;
    return { hops, delivered, blocked, alerted, ok };
  };

  // Where it starts.
  let src: string;
  let srcHost: string | undefined;
  if (flow.from === 'internet') {
    src = 'internet';
    hops.push({ at: 'Internet', result: 'info', text: 'It arrives from the internet.' });
  } else if (externalById(sc, flow.from)) {
    src = 'internet';
    srcHost = flow.from;
    hops.push({ at: nameOf(sc, flow.from), result: 'info', text: 'It arrives from the internet.' });
  } else if (flow.from === 'remote') {
    const spot = sc.slots.find(s => s.vpn);
    if (spot && w.slots[spot.id] === 'vpn') {
      src = sc.zones.find(z => z.virtual)!.id;
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
  } else {
    const host = hostById(sc, flow.from)!;
    const faults = addrFaults(sc, w, host);
    if (faults.length) {
      hops.push({ at: host.name, result: 'fail', text: faults[0] });
      return done(false, false, false);
    }
    src = hostZone(sc, w, host)!.id;
    srcHost = host.id;
    hops.push({ at: host.name, result: 'info', text: `It starts in ${where(sc, src)}.` });
  }

  // Where it is going.
  let dst: string;
  let dstHost: string | undefined;
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
  }

  const ctx: PathCtx = { src, dst, dstHost };
  const path = sc.slots.filter(s => !s.vpn && s.on(ctx));
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
  for (const slot of path) {
    const dev = w.slots[slot.id];
    const at = dev ? `${DEVICES[dev].name} (${slot.label})` : slot.label;
    if (slot.mode === 'tap') {
      if (dev === 'ids' || dev === 'ips') {
        const how = detects(d, flow.threat);
        if (how) alert(at, dev === 'ips' ? `${how}, but on a mirror port it only gets a copy, so it cannot drop anything` : how);
      }
      continue;
    }
    if (src === dst) continue;
    if (!dev) {
      hops.push({ at, result: 'info', text: 'This spot is empty, so the traffic passes straight through.' });
      continue;
    }
    if (dev === 'firewall' || dev === 'ngfw') {
      if (filtered) continue;
      filtered = true;
      const i = w.rules.findIndex(r => ruleMatches(r, src, srcHost, dst, dstHost, flow.service));
      const rule = w.rules[i];
      const svc = flow.service === 'scan' ? 'the probed ports' : SERVICES[flow.service] ?? flow.service;
      if (!rule) {
        hops.push({ at, result: 'block', text: `No rule allows ${svc} from ${where(sc, src)} to ${dstHost ? nameOf(sc, dstHost) : where(sc, dst)}, so the implicit deny drops it.` });
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
      hops.push({ at, result: 'pass', text: 'It fetches the site for the user.' });
      continue;
    }
    hops.push({ at, result: 'info', text: { router: 'A router just forwards it; nothing here applies the security rules.', hub: 'A hub repeats it to every port, so anyone plugged in can capture it.', honeypot: 'A honeypot is a decoy, not a filter: it does nothing to traffic passing through.', lb: 'A load balancer forwards it to a server without inspecting it.', vpn: 'A VPN concentrator only handles tunnels; it passes this through.' }[dev as 'router' | 'hub' | 'honeypot' | 'lb' | 'vpn'] });
  }
  if (src !== dst && !filtered) hops.push({ at: 'Firewall', result: 'fail', text: 'No firewall stands on this path, so nothing applies the rules and everything gets through.' });

  hops.push({ at: dstHost ? nameOf(sc, dstHost) : 'Internet', result: 'pass', text: flow.threat ? `It gets there: ${THREAT_NAME[flow.threat]} reaches its target.` : 'Delivered.' });
  return done(true, false, alerted);
}
