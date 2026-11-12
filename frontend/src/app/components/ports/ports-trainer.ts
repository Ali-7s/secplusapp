/**
 * The ports trainer: ports learned in small sets by job, then drilled five ways (port to name, name to port,
 * TCP or UDP, the secure replacement, and which port a situation needs). Answers are reviews of the port's two
 * Reference deck cards, scheduled by FSRS-6, and the port's level from 0 to 4 comes from those cards (port-memory.ts).
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
    hooks: ['FTP is 21 for commands and 20 for data: the data port is one below.', 'TFTP is 69, trivial: no login at all.', 'SMB is 445, the Windows file share; NetBIOS (137 to 139) is its old helper.', 'FTPS lives at 989 and 990, just below the secure mail ports: commands on 990, data one below on 989, as in FTP.'],
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
  '69': 'IP phones download their configuration at startup from a server with no login and no encryption.',
  '80': 'An old web server still serves an unencrypted site, and the firewall must allow it.',
  '88': 'Windows domain users sign in and receive tickets from the domain controller.',
  '110': 'An old mail app downloads mail and deletes it from the server, without encryption.',
  '119': 'A legacy server shares newsgroup articles.',
  '123': 'Every server must keep its clock in sync, or domain sign-ins start failing.',
  '135': 'Windows machines manage each other with remote procedure calls, starting at the endpoint mapper.',
  '143': 'A mail app reads mail while leaving it on the server, without encryption.',
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
  '993': 'Phones read company mail securely, leaving it on the server.',
  '995': 'An old mail app must download mail over an encrypted connection.',
  '1194': 'Remote staff connect through an open-source, TLS-based VPN, usually over UDP.',
  '1433': 'The web app must reach its Microsoft database server.',
  '1521': 'An application must reach an Oracle database.',
  '1701': 'A VPN uses a layer 2 tunnelling protocol with no encryption of its own, so it is paired with IPsec.',
  '1723': 'An audit finds an old VPN that relies on MS-CHAPv2 and is considered broken. Which port is it on?',
  '3306': 'A web shop must reach its open-source MySQL-compatible database.',
  '3389': 'Administrators open a Windows server\'s full graphical desktop remotely.',
  '4500': 'An IPsec VPN must cross a NAT router, so it wraps its traffic in UDP.',
  '5900': 'Support staff view and control a desktop with a screen-sharing protocol that is often unencrypted.',
  '6514': 'Logs must reach the SIEM encrypted, over a reliable connection.',
  '8080': 'A web proxy listens on the usual alternative HTTP port.',
  '8443': 'An appliance\'s admin page uses HTTPS on the usual alternative port.',
  '51820': 'A modern, minimal VPN with a tiny attack surface runs over UDP.',
};

/**
 * The memory hook shown after a drill question. Each names only its own port's numbers, never another port's, not
 * even as sums ("853 is 53 with an 8 in front"): a set's ports are drilled together, and the hint after one question
 * must not answer another. The set hooks, which tie ports together, are for the Learn view.
 */
export const PORT_HOOKS: Record<string, string> = {
  '20': 'FTP-DATA is 20: the file itself travels here, in the clear.',
  '21': 'FTP is 21: the commands and the login, in the clear.',
  '22': 'SSH is 22: read the two S\'s in SSH as two 2s.',
  '23': 'Telnet is 23: the old remote login where every keystroke, password included, can be read.',
  '25': 'SMTP is 25: mail servers passing mail on to each other.',
  '49': 'TACACS+ is a lone 49: admins logging in to network devices.',
  '53': 'DNS is 53, on UDP for lookups and TCP for big answers and zone transfers.',
  '67/68': 'DHCP: the server gets the lower number, 67; the client 68.',
  '69': 'TFTP is 69, trivial: no login at all.',
  '80': 'HTTP is 80: the open web, a round number with nothing locked.',
  '88': 'Kerberos is 88, two loops like two tickets.',
  '110': 'POP3 is 110: pull the mail down, then delete it from the server.',
  '119': 'NNTP (newsgroups) is 119.',
  '123': 'NTP is 123, "one two three", like counting the seconds.',
  '135': 'Windows RPC is 135: the endpoint mapper that hands out other ports.',
  '137-139': 'NetBIOS is 137 to 139: names on 137, broadcasts on 138, sessions on 139.',
  '143': 'IMAP is 143: the mailbox stays on the server, the same on every device.',
  '161/162': 'SNMP: 161 asks, 162 tells (devices send traps on 162).',
  '179': 'BGP is 179: the routers of internet providers swapping routes.',
  '389': 'LDAP is 389: questions to the directory, readable on the wire.',
  '443': 'HTTPS is 443: the padlock port behind every login page.',
  '445': 'SMB is 445, the Windows file share.',
  '465': 'SMTPS is 465: sending mail encrypted from the first byte.',
  '500': 'IKE is UDP 500: two VPN gateways agree on keys before anything is encrypted.',
  '514': 'Syslog is 514 over UDP: logs sent and forgotten, readable by anyone.',
  '587': 'SMTP Submission is 587: your mail app logs in and hands over what you send.',
  '636': 'LDAPS is 636, a number that reads the same backwards.',
  '853': 'DNS over TLS is 853: encrypted lookups on a port of their own, so a firewall can see them.',
  '989/990': 'FTPS: commands on 990, data one below on 989.',
  '993': 'IMAPS is 993: the synced mailbox, inside TLS.',
  '995': 'POP3S is 995: download-and-delete, inside TLS.',
  '1194': 'OpenVPN is 1194: "11 94", the open-source tunnel.',
  '1433': 'SQL Server is 1433: databases sit in the thousands.',
  '1521': 'Oracle DB is 1521: databases sit in the thousands.',
  '1701': 'L2TP is 1701: an old tunnel that needs IPsec to be secure.',
  '1723': 'PPTP is 1723: an old tunnel whose encryption is broken.',
  '1812/1813': 'RADIUS is 1812 for logins and 1813 for accounting.',
  '1883/8883': 'MQTT is 1883, or 8883 with TLS: the 1 becomes an 8.',
  '3306': 'MySQL is 3306: databases sit in the thousands.',
  '3389': 'RDP is 3389: "33 89", the Windows desktop.',
  '4500': 'NAT-T is UDP 4500: IPsec wrapped up so it gets through NAT.',
  '5060/5061': 'SIP is 5060, or 5061 with TLS: one up for the locked version.',
  '5900': 'VNC is 5900, screen sharing that is often unencrypted.',
  '6514': 'Syslog over TLS is 6514: logs that arrive unread and unchanged.',
  '8080': 'HTTP-Alt is 8080, "eighty-eighty": where web proxies and test sites listen.',
  '8443': 'HTTPS-Alt is 8443: the encrypted side door to an appliance\'s admin page.',
  '51820': 'WireGuard is 51820, the newest and leanest of the tunnels.',
};

/** One number of a port whose numbers do different jobs. `label` finishes "Which port is for …?". */
export interface PortPart { n: number; label: string; situation: string }

/** Ports whose numbers do different jobs. Their questions ask one number at a time, so the answer is always one number. */
export const PARTS: Record<string, PortPart[]> = {
  '67/68': [
    { n: 67, label: 'the DHCP server', situation: 'A DHCP server waits for laptops asking for an IP address. Which port does the server listen on?' },
    { n: 68, label: 'the DHCP client', situation: 'A laptop with no IP address yet waits for the DHCP server\'s offer. Which port does the laptop listen on?' },
  ],
  '137-139': [
    { n: 137, label: 'the NetBIOS name service', situation: 'A very old Windows PC looks up another computer by its NetBIOS name.' },
    { n: 138, label: 'the NetBIOS datagram service', situation: 'Very old Windows PCs broadcast announcements to each other over NetBIOS, without a connection.' },
    { n: 139, label: 'the NetBIOS session service', situation: 'A very old Windows PC opens a file-sharing session the legacy NetBIOS way, not with SMB straight over TCP.' },
  ],
  '161/162': [
    { n: 161, label: 'SNMP polling', situation: 'A monitoring server asks a switch for its interface counters. Which port does the switch answer on?' },
    { n: 162, label: 'SNMP traps', situation: 'A switch tells the monitoring server that a fan failed, without being asked. Which port does the monitoring server listen on?' },
  ],
  '989/990': [
    { n: 990, label: 'FTPS commands', situation: 'A partner\'s FTPS client logs in and sends its commands, inside TLS from the start. Which port carries the commands?' },
    { n: 989, label: 'FTPS data', situation: 'An FTPS transfer sends the file itself on its own encrypted connection. Which port carries the file?' },
  ],
  '1812/1813': [
    { n: 1812, label: 'RADIUS authentication', situation: 'Wi-Fi access points check each 802.1X login with the central RADIUS server.' },
    { n: 1813, label: 'RADIUS accounting', situation: 'A VPN gateway reports to the RADIUS server when each user connected and for how long.' },
  ],
  '1883/8883': [
    { n: 1883, label: 'MQTT without encryption', situation: 'IoT sensors on an isolated network publish their readings to a message broker, unencrypted.' },
    { n: 8883, label: 'MQTT over TLS', situation: 'IoT sensors publish their readings to a message broker over TLS.' },
  ],
  '5060/5061': [
    { n: 5060, label: 'SIP without encryption', situation: 'Desk phones set up calls with the phone system in cleartext (the signalling, not the audio).' },
    { n: 5061, label: 'SIP over TLS', situation: 'Desk phones set up calls with the phone system over TLS (the signalling, not the audio).' },
  ],
};

/** The kinds asked one number at a time for a port in PARTS. */
const PER_NUMBER: QKind[] = ['name', 'number', 'situation'];

/** The number a question asks about, for a port whose numbers do different jobs. */
export const partOf = (ref: QRef): PortPart | undefined =>
  PER_NUMBER.includes(ref.kind) ? PARTS[ref.port]?.[ref.part ?? 0] : undefined;

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

/** What is saved for a question, so a round can be rebuilt after a refresh. `part` picks a number of a port in PARTS. */
export interface QRef { kind: QKind; port: string; part?: number }

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

/** The ports the exam leans on most (see PortEntry.core). */
export const CORE_PORTS: string[] = PORTS.filter(p => p.core).map(p => p.port);
export const isCore = (port: string) => CORE_PORTS.includes(port);
/** Every port in the order to start learning them: core ports first, set by set, then the rest. */
export const startOrder = (): string[] => {
  const all = GROUPS.flatMap(g => g.ports);
  return [...all.filter(isCore), ...all.filter(p => !isCore(p))];
};
export const shortName = (e: PortEntry) => PORT_NAMES[e.port]?.[0] ?? e.protocol;
const ends = (port: string) => port.split(/[/-]/).map(Number);
const rangeOf = (port: string) => {
  const [a, b] = ends(port);
  return port.includes('-') ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : ends(port);
};
const transportAnswer = (t: string) => (t.includes('/') ? 'Both' : t);

/** "Port 22: which protocol?", or "Port 68: which protocol?" for one number of a pair. */
function nameQ(e: PortEntry, ref: QRef): PortQuestion {
  return {
    ...ref, label: 'Port to name', prompt: `Port ${partOf(ref)?.n ?? e.port}: which protocol?`,
    answer: e.protocol, check: protocolCheck(e.port), card: `port:${e.port}`,
  };
}

/** Right with this one number and nothing else; a neighbour from the same port gets told what it is for. */
function oneNumberCheck(port: string, part: PortPart) {
  return (typed: string): Verdict => {
    const got = numbersIn(typed);
    if (!got.length) return { right: false };
    const bad = got.find(n => n !== part.n);
    if (bad === undefined) return { right: true };
    const sibling = PARTS[port].find(p => p.n === bad);
    return { right: false, note: sibling ? `${bad} is for ${sibling.label}.` : `${bad} is ${portName(bad) ?? 'not it'}.` };
  };
}

/** "SSH: which port?" Right with every port it uses, and nothing else. */
function numberQ(e: PortEntry, ref: QRef): PortQuestion {
  const part = partOf(ref);
  if (part) {
    return {
      ...ref, label: 'Name to port', prompt: `Which port is for ${part.label}?`,
      answer: String(part.n), card: `proto:${e.protocol}`, check: oneNumberCheck(e.port, part),
    };
  }
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
    choices: ['TCP', 'UDP', 'Both'], answer: want, card: `proto:${e.protocol}`,
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

function situationQ(e: PortEntry, ref: QRef): PortQuestion {
  const part = partOf(ref);
  if (part) {
    return {
      ...ref, label: 'Which port?', prompt: part.situation,
      answer: `${part.n} (${shortName(e)})`, card: `proto:${e.protocol}`, check: oneNumberCheck(e.port, part),
    };
  }
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
    case 'name': return nameQ(e, ref);
    case 'number': return numberQ(e, ref);
    case 'transport': return transportQ(e);
    case 'secure': return secureQ(e);
    case 'situation': return situationQ(e, ref);
  }
}

/** The kinds of question a port can be asked. */
export function kindsFor(port: string): QKind[] {
  const k: QKind[] = ['name', 'number', 'transport'];
  if (SITUATIONS[port] || PARTS[port]) k.push('situation');
  if (SECURE_SWAPS[port]) k.push('secure');
  return k;
}

// ── Levels ────────────────────────────────────────────────────────────────

/** A port's level runs from 0 (new) to 4 (mastered). It comes from the port's Review cards: see port-memory.ts. */
export const MAX_LEVEL = 4;

/** How a drill last asked a port, so the next round asks it another way (and about its other number, for PARTS). */
export interface Asked { kind: QKind; part?: number }

/** What a round needs to know about a port. */
export interface PortState {
  level: number;
  /** Which of its two cards wants a review now, being new or due: "port 22: which protocol?" and "SSH: which port?". */
  wants: { name: boolean; number: boolean };
  asked?: Asked;
}

// ── Rounds ────────────────────────────────────────────────────────────────

export const ROUND = 10;

/**
 * Picks a round that asks each port once, so a set smaller than a round gives a shorter round instead of repeats.
 * When there are more ports than questions, weaker ports and ports with a card due are likelier to make the cut.
 * The order is shuffled, so it says nothing about which ports are weak.
 */
export function pickRound(ports: string[], stateOf: (port: string) => PortState, random: () => number = Math.random, size = ROUND): QRef[] {
  const pool = [...new Set(ports)];
  const chosen: string[] = [];
  while (chosen.length < size && pool.length) {
    const weights = pool.map(p => {
      const st = stateOf(p);
      return (MAX_LEVEL + 1 - st.level) ** 2 * (st.wants.name || st.wants.number ? 3 : 1);
    });
    let r = random() * weights.reduce((a, b) => a + b, 0);
    let k = 0;
    while (k < pool.length - 1 && (r -= weights[k]) > 0) k++;
    chosen.push(pool.splice(k, 1)[0]);
  }
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  return chosen.map(port => nextAsk(port, stateOf(port), random));
}

/** The kinds asked before a port is known: port to name and back, or a situation. */
const EASY: QKind[] = ['name', 'number', 'situation'];

/**
 * How to ask a port this time. A card that is new or due gets the review: the name question for "port 22: which
 * protocol?", a number or situation question for "SSH: which port?". Otherwise any kind its level allows. Either way
 * a different kind from last time, and its other number for a port in PARTS.
 */
function nextAsk(port: string, st: PortState, random: () => number): QRef {
  const kinds = kindsFor(port).filter(x => st.level >= 2 || EASY.includes(x));
  const reviews = (k: QKind) => (k === 'name' ? st.wants.name : (k === 'number' || k === 'situation') && st.wants.number);
  const wanted = kinds.filter(reviews);
  const parts = PARTS[port];
  const asks: QRef[] = (wanted.length ? wanted : kinds)
    .flatMap(kind => (parts && PER_NUMBER.includes(kind) ? parts.map((_, part) => ({ kind, port, part })) : [{ kind, port }]));
  const last = st.asked;
  const otherKind = asks.filter(a => a.kind !== last?.kind);
  const otherPart = otherKind.filter(a => a.part === undefined || a.part !== last?.part);
  const from = otherPart.length ? otherPart : otherKind.length ? otherKind : asks;
  return from[Math.floor(random() * from.length)];
}
