/**
 * The ports trainer: ports learned in small sets by job, then drilled five ways (port to name, name to port,
 * TCP or UDP, the secure replacement, and which port a situation needs). Each port has a mastery level from
 * 0 to 4; rounds favour the weakest ports. Answers also feed the Reference deck's spaced repetition schedule.
 */

import { PORTS, PortEntry } from '../reference/reference-data';
import { PORT_NAMES, protocolCheck } from '../reference/reference-cards';
import { Verdict, numbersIn } from '../../utils/typed-answer';

export interface PortGroup {
  id: string;
  title: string;
  blurb: string;
  ports: string[];
  hooks: string[];
}

/** Every port in the Reference table, in exactly one set, most-tested sets first (the spec checks). */
export const GROUPS: PortGroup[] = [
  {
    id: 'remote', title: 'Remote access', blurb: 'Logging in to another machine: a command line or a whole desktop.',
    ports: ['22', '23', '3389', '5900'],
    hooks: ['22 and 23 are neighbours: SSH (22) replaced Telnet (23).', 'RDP is 3389: "33 89", the Windows desktop.', 'VNC is 5900, screen sharing that is often unencrypted.'],
  },
  {
    id: 'web', title: 'The web', blurb: 'Web pages, plain and encrypted, and their alternative ports.',
    ports: ['80', '443', '8080', '8443'],
    hooks: ['80 is the open web, 443 the locked web (the S in HTTPS).', 'The alternatives add 8000 and keep the ending: 8080 for HTTP, 8443 for HTTPS.'],
  },
  {
    id: 'names', title: 'Names, addresses and time', blurb: 'The helpers every network needs: DNS, DHCP and NTP.',
    ports: ['53', '67/68', '123', '853'],
    hooks: ['DNS is 53, on UDP for lookups and TCP for big answers and zone transfers.', 'DHCP: the server gets the lower number, 67; the client 68.', 'NTP is 123, "one two three", like counting the seconds.', 'DNS over TLS is 853: DNS 53 with an 8 in front.'],
  },
  {
    id: 'mail', title: 'Email', blurb: 'Sending mail, and reading it plain or encrypted.',
    ports: ['25', '587', '465', '110', '995', '143', '993'],
    hooks: ['Mail goes out on 25 (server to server) and 587 (your app submitting it).', 'It comes in on 110 (POP3) or 143 (IMAP).', 'The secure readers live in the 990s: IMAPS 993, POP3S 995.', '465 is SMTP encrypted from the first byte.'],
  },
  {
    id: 'files', title: 'Files and sharing', blurb: 'Moving files, and Windows sharing.',
    ports: ['20', '21', '69', '445', '137-139', '989/990'],
    hooks: ['FTP is 21 for commands and 20 for data: the data port is one below.', 'TFTP is 69, trivial: no login at all.', 'SMB is 445, the Windows file share; NetBIOS (137 to 139) is its old helper.', 'FTPS lives at 989 and 990, just below the secure mail ports.'],
  },
  {
    id: 'directory', title: 'Directory and sign-in', blurb: 'Who users are, and checking their logins.',
    ports: ['88', '389', '636', '49', '1812/1813'],
    hooks: ['Kerberos is 88, two loops like two tickets.', 'LDAP is 389; LDAPS is 636, a number that reads the same backwards.', 'TACACS+ is a lone 49; RADIUS is 1812 for logins and 1813 for accounting.'],
  },
  {
    id: 'manage', title: 'Managing and logging', blurb: 'Watching devices and collecting their logs.',
    ports: ['161/162', '514', '6514'],
    hooks: ['SNMP: 161 asks, 162 tells (devices send traps on 162).', 'Syslog is 514 over UDP; with TLS it becomes 6514: a 6 in front.'],
  },
  {
    id: 'vpn', title: 'VPNs', blurb: 'Tunnels: IPsec, the old ones, and the modern ones.',
    ports: ['500', '4500', '1701', '1723', '1194', '51820'],
    hooks: ['IPsec starts with IKE on UDP 500, and switches to 4500 (500 with a 4) to pass through NAT.', 'L2TP is 1701, PPTP 1723: the old tunnels in the 1700s.', 'OpenVPN is 1194; WireGuard is 51820.'],
  },
  {
    id: 'other', title: 'Databases and the rest', blurb: 'Database servers, routing, Windows RPC, voice and IoT.',
    ports: ['1433', '1521', '3306', '135', '179', '5060/5061', '1883/8883', '119'],
    hooks: ['Databases sit in the thousands: SQL Server 1433, Oracle 1521, MySQL 3306.', 'BGP is 179, Windows RPC 135.', 'SIP is 5060, or 5061 with TLS; MQTT is 1883, or 8883 with TLS.', 'NNTP (newsgroups) is 119.'],
  },
];

/** Situations that need a port, without naming the protocol. */
export const SITUATIONS: Record<string, string> = {
  '20': 'A classic FTP download sends the file contents over a separate data connection. Which port does that data come from?',
  '21': 'An old file server must let users log in and send FTP commands. Which port carries the commands?',
  '22': 'An administrator must manage a Linux server remotely over an encrypted command line, and copy files to it securely.',
  '23': 'An audit finds an old switch accepting an unencrypted remote terminal. Which port should be closed?',
  '25': 'Two mail servers hand email to each other across the internet.',
  '49': 'Routers check administrators\' logins against a central server that also authorizes and logs every command, encrypting the whole packet.',
  '53': 'Laptops must turn names such as shop.example into IP addresses.',
  '67/68': 'Laptops plugged into the network must get an IP address automatically.',
  '69': 'IP phones download their configuration at startup from a server with no login and no encryption.',
  '80': 'An old web server still serves an unencrypted site, and the firewall must allow it.',
  '88': 'Windows domain users sign in and receive tickets from the domain controller.',
  '110': 'An old mail app downloads mail and deletes it from the server, without encryption.',
  '119': 'A legacy server shares newsgroup articles.',
  '123': 'Every server must keep its clock in sync, or domain sign-ins start failing.',
  '135': 'Windows machines manage each other with remote procedure calls, starting at the endpoint mapper.',
  '137-139': 'Very old Windows file sharing looks up computer names and opens sessions with a legacy protocol suite.',
  '143': 'A mail app reads mail while leaving it on the server, without encryption.',
  '161/162': 'A monitoring server polls switches for their counters, and the switches send alerts back on their own.',
  '179': 'Two internet providers exchange routes between their networks.',
  '389': 'An application looks up users and groups in the company directory, unencrypted.',
  '443': 'Staff must be able to browse secure websites.',
  '445': 'Windows PCs open shared folders on a file server, the protocol ransomware loves to spread over.',
  '465': 'A mail server accepts mail over a connection that is encrypted from the very first byte.',
  '500': 'Two offices build a site-to-site IPsec VPN and must first negotiate their keys.',
  '514': 'Firewalls send their logs to the SIEM the traditional way, unencrypted over UDP.',
  '587': 'Staff mail apps send outgoing mail to the company\'s mail server, upgrading to encryption with STARTTLS.',
  '636': 'An application must query the company directory over an encrypted connection.',
  '853': 'Laptops must encrypt their name lookups with TLS so nobody on the network can read or change them.',
  '989/990': 'A partner insists on FTP, but wrapped in TLS from the start.',
  '993': 'Phones read company mail securely, leaving it on the server.',
  '995': 'An old mail app must download mail over an encrypted connection.',
  '1194': 'Remote staff connect through an open-source, TLS-based VPN, usually over UDP.',
  '1433': 'The web app must reach its Microsoft database server.',
  '1521': 'An application must reach an Oracle database.',
  '1701': 'A VPN uses a layer 2 tunnelling protocol with no encryption of its own, so it is paired with IPsec.',
  '1723': 'An audit finds an old VPN that relies on MS-CHAPv2 and is considered broken. Which port is it on?',
  '1812/1813': 'Wi-Fi access points check 802.1X logins against a central AAA server, and send it accounting records.',
  '1883/8883': 'IoT sensors publish their readings to a lightweight message broker.',
  '3306': 'A web shop must reach its open-source MySQL-compatible database.',
  '3389': 'Administrators open a Windows server\'s full graphical desktop remotely.',
  '4500': 'An IPsec VPN must cross a NAT router, so it wraps its traffic in UDP.',
  '5060/5061': 'Desk phones set up calls with the phone system (the signalling, not the audio).',
  '5900': 'Support staff view and control a desktop with a screen-sharing protocol that is often unencrypted.',
  '6514': 'Logs must reach the SIEM encrypted, over a reliable connection.',
  '8080': 'A web proxy listens on the usual alternative HTTP port.',
  '8443': 'An appliance\'s admin page uses HTTPS on the usual alternative port.',
  '51820': 'A modern, minimal VPN with a tiny attack surface runs over UDP.',
};

/** Plaintext protocols and the ports that replace them. */
export const SECURE_SWAPS: Record<string, { to: number[]; name: string }> = {
  '23': { to: [22], name: 'SSH on 22' },
  '21': { to: [22, 989, 990], name: 'SFTP on 22 (or FTPS on 989/990)' },
  '20': { to: [22, 989, 990], name: 'SFTP on 22 (or FTPS on 989/990)' },
  '69': { to: [22], name: 'SFTP or SCP on 22' },
  '80': { to: [443], name: 'HTTPS on 443' },
  '8080': { to: [8443, 443], name: 'HTTPS on 8443 (or 443)' },
  '110': { to: [995], name: 'POP3S on 995' },
  '143': { to: [993], name: 'IMAPS on 993' },
  '389': { to: [636], name: 'LDAPS on 636' },
  '514': { to: [6514], name: 'Syslog over TLS on 6514' },
  '53': { to: [853], name: 'DNS over TLS on 853' },
  '5900': { to: [22, 3389], name: 'tunnel it through SSH on 22, or use RDP on 3389 with NLA' },
  '1723': { to: [500, 4500, 1194, 51820], name: 'IPsec (500, 4500), OpenVPN (1194) or WireGuard (51820)' },
  '1701': { to: [500, 4500], name: 'IPsec: IKE on 500 and NAT-T on 4500' },
  '25': { to: [587, 465], name: 'submission on 587 with STARTTLS (or 465)' },
};

export type QKind = 'name' | 'number' | 'transport' | 'secure' | 'situation';

/** What is saved for a question, so a round can be rebuilt after a refresh. */
export interface QRef { kind: QKind; port: string }

export interface PortQuestion extends QRef {
  label: string;
  prompt: string;
  choices?: string[];
  answer: string;
  check: (typed: string) => Verdict;
  /** The Reference deck card this answer counts for. */
  card?: string;
}

export const entryOf = (port: string): PortEntry => PORTS.find(p => p.port === port)!;
export const shortName = (e: PortEntry) => PORT_NAMES[e.port]?.[0] ?? e.protocol;
const ends = (port: string) => port.split(/[/-]/).map(Number);
const rangeOf = (port: string) => {
  const [a, b] = ends(port);
  return port.includes('-') ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : ends(port);
};
const transportAnswer = (t: string) => (t.includes('/') ? 'Both' : t);

/** "Port 22: which protocol?" */
function nameQ(e: PortEntry): PortQuestion {
  return {
    kind: 'name', port: e.port, label: 'Port to name', prompt: `Port ${e.port}: which protocol?`,
    answer: e.protocol, check: protocolCheck(e.port), card: `port:${e.port}`,
  };
}

/** "SSH: which port?" Right with every port it uses, and nothing else. */
function numberQ(e: PortEntry): PortQuestion {
  const need = ends(e.port);
  const allowed = rangeOf(e.port);
  return {
    kind: 'number', port: e.port, label: 'Name to port', prompt: `${e.protocol} (${e.service}): which port${need.length > 1 ? 's' : ''}?`,
    answer: e.port, card: `proto:${e.protocol}`,
    check: typed => {
      const got = numbersIn(typed);
      const extra = got.find(n => !allowed.includes(n));
      if (extra !== undefined) return { right: false, note: extra ? `${extra} is ${portName(extra) ?? 'not one of its ports'}.` : undefined };
      const missing = need.filter(n => !got.includes(n));
      if (missing.length) return { right: false, note: got.length ? `It uses ${need.join(' and ')}.` : undefined };
      return { right: true };
    },
  };
}

function transportQ(e: PortEntry): PortQuestion {
  const want = transportAnswer(e.transport);
  return {
    kind: 'transport', port: e.port, label: 'TCP or UDP', prompt: `${shortName(e)} on port ${e.port}: TCP, UDP or both?`,
    choices: ['TCP', 'UDP', 'Both'], answer: want,
    check: typed => ({ right: typed.trim().toLowerCase() === want.toLowerCase() }),
  };
}

function secureQ(e: PortEntry): PortQuestion {
  const s = SECURE_SWAPS[e.port];
  return {
    kind: 'secure', port: e.port, label: 'Secure replacement',
    prompt: `${shortName(e)} on port ${e.port} is not safe to use as it is. Which port does its secure replacement use?`,
    answer: s.name,
    check: typed => {
      const got = numbersIn(typed);
      if (!got.length) return { right: false };
      const bad = got.find(n => !s.to.includes(n));
      return bad !== undefined ? { right: false, note: bad === Number(e.port) ? 'That is the insecure one.' : `${bad} is ${portName(bad) ?? 'not a replacement'}.` } : { right: true };
    },
  };
}

function situationQ(e: PortEntry): PortQuestion {
  const allowed = rangeOf(e.port);
  return {
    kind: 'situation', port: e.port, label: 'Which port?', prompt: SITUATIONS[e.port],
    answer: `${e.port} (${shortName(e)})`, card: `proto:${e.protocol}`,
    check: typed => {
      const got = numbersIn(typed);
      if (!got.length) return { right: false };
      const bad = got.find(n => !allowed.includes(n));
      return bad !== undefined ? { right: false, note: `${bad} is ${portName(bad) ?? 'not it'}.` } : { right: true };
    },
  };
}

/** The protocol a port number belongs to, for "that is port X" notes. */
export function portName(n: number): string | undefined {
  const e = PORTS.find(p => rangeOf(p.port).includes(n));
  return e ? shortName(e) : undefined;
}

export function buildQuestion(ref: QRef): PortQuestion {
  const e = entryOf(ref.port);
  switch (ref.kind) {
    case 'name': return nameQ(e);
    case 'number': return numberQ(e);
    case 'transport': return transportQ(e);
    case 'secure': return secureQ(e);
    case 'situation': return situationQ(e);
  }
}

/** The kinds of question a port can be asked. */
export function kindsFor(port: string): QKind[] {
  const k: QKind[] = ['name', 'number', 'transport'];
  if (SITUATIONS[port]) k.push('situation');
  if (SECURE_SWAPS[port]) k.push('secure');
  return k;
}

// ── Mastery ───────────────────────────────────────────────────────────────

/** `rose` is when the level last went up: a level rises at most once an hour. */
export interface PortMastery { level: number; right: number; wrong: number; at: number; rose?: number }
export type Mastery = Record<string, PortMastery>;
export const MAX_LEVEL = 4;

/** How long after a rise a port's level can rise again. */
export const RISE_GAP_MS = 3_600_000;

/** Whether this port moved up within the last hour, so another right answer now will not raise it. */
export const roseRecently = (m: Mastery, port: string, now: number) => now - (m[port]?.rose ?? 0) < RISE_GAP_MS;

/** When each set was last practiced, meaning a finished round or a checked firewall table. */
export type Practiced = Record<string, number>;

/** In a practice that spans sets, how many questions a set needs before it counts as practiced. */
const MIN_TO_COUNT = 2;

export const groupOf = (port: string) => GROUPS.find(g => g.ports.includes(port))?.id;

/** Whether this port went up and no different set has been practiced since, so it may still be fresh in mind. */
export function needsOtherSet(m: Mastery, port: string, practiced: Practiced): boolean {
  const rose = m[port]?.rose;
  if (rose === undefined) return false;
  const own = groupOf(port);
  return !Object.entries(practiced).some(([set, at]) => set !== own && at > rose);
}

/**
 * Which sets a finished practice counts for. A set's own round counts only for that set, because the few ports mixed
 * in from other sets are not practicing them. A practice across sets counts for each set it asked enough about.
 */
export function setsPracticed(set: string, ports: string[]): string[] {
  if (GROUPS.some(g => g.id === set)) return [set];
  const counts = new Map<string, number>();
  for (const p of ports) {
    const g = groupOf(p);
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= MIN_TO_COUNT).map(([g]) => g);
}

export const markPracticed = (practiced: Practiced, sets: string[], now: number): Practiced =>
  ({ ...practiced, ...Object.fromEntries(sets.map(s => [s, now])) });

/**
 * A right answer raises the level by one, but only once an hour and only after a different set has been practiced
 * since the last rise: recalling a port minutes after reading it shows it is familiar, not that it is learned.
 * A wrong answer drops it two levels at any time.
 */
export function updateMastery(m: Mastery, port: string, right: boolean, now: number, practiced: Practiced): Mastery {
  const cur = m[port] ?? { level: 0, right: 0, wrong: 0, at: 0 };
  let next: PortMastery;
  if (right) {
    const rise = !roseRecently(m, port, now) && !needsOtherSet(m, port, practiced) && cur.level < MAX_LEVEL;
    next = { ...cur, level: rise ? cur.level + 1 : cur.level, right: cur.right + 1, at: now, ...(rise ? { rose: now } : {}) };
  } else {
    next = { ...cur, level: Math.max(0, cur.level - 2), wrong: cur.wrong + 1, at: now };
  }
  return { ...m, [port]: next };
}

export const levelOf = (m: Mastery, port: string) => m[port]?.level ?? 0;
export const masteredIn = (m: Mastery, ports: string[]) => ports.filter(p => levelOf(m, p) >= MAX_LEVEL).length;

// ── Rounds ────────────────────────────────────────────────────────────────

export const ROUND = 10;

/**
 * Picks a round: weaker ports more often (and ports that rose in the last hour less often), never the same port twice
 * in a row, and the easy directions first for ports not yet learned (port to name and back), the harder kinds once a
 * port is known.
 */
export function pickRound(ports: string[], m: Mastery, random: () => number = Math.random, size = ROUND, now = Date.now()): QRef[] {
  if (!ports.length) return [];
  const out: QRef[] = [];
  const asked = new Map<string, QKind[]>();
  for (let i = 0; i < size; i++) {
    const pool = ports.filter(p => ports.length === 1 || p !== out[i - 1]?.port);
    const weights = pool.map(p => (MAX_LEVEL + 1 - levelOf(m, p)) ** 2 / (1 + (asked.get(p)?.length ?? 0)) * (roseRecently(m, p, now) ? 0.4 : 1));
    let r = random() * weights.reduce((a, b) => a + b, 0);
    let k = 0;
    while (k < pool.length - 1 && (r -= weights[k]) > 0) k++;
    const port = pool[k];
    const level = levelOf(m, port);
    const kinds = kindsFor(port).filter(x => level >= 2 || x === 'name' || x === 'number' || x === 'situation');
    const used = asked.get(port) ?? [];
    const fresh = kinds.filter(x => !used.includes(x));
    const choice = (fresh.length ? fresh : kinds)[Math.floor(random() * (fresh.length ? fresh.length : kinds.length))];
    asked.set(port, [...used, choice]);
    out.push({ kind: choice, port });
  }
  return out;
}

/** How many questions of a set's round come from ports outside the set. */
export const MIX_IN = 3;

/**
 * A round for one set, with a few ports from other sets already started mixed in, so an answer cannot be found
 * by elimination ("it must be one of these four") and older sets keep coming back.
 */
export function setRound(setPorts: string[], m: Mastery, random: () => number = Math.random, now = Date.now()): QRef[] {
  const others = Object.keys(m).filter(p => !setPorts.includes(p))
    .sort((a, b) => levelOf(m, a) - levelOf(m, b) || m[a].at - m[b].at)
    .slice(0, 6);
  const k = others.length ? MIX_IN : 0;
  const own = pickRound(setPorts, m, random, ROUND - k, now);
  if (!k) return own;
  const mixed = pickRound(others, m, random, k, now);
  // Spread the outside questions through the round: after the 2nd, 5th and 8th of the set's own.
  const out: QRef[] = [];
  own.forEach((q, i) => { out.push(q); if ((i + 1) % 3 === 2 && mixed.length) out.push(mixed.shift()!); });
  return [...out, ...mixed];
}
