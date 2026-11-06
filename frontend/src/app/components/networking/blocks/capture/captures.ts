import { Capture, Host, Pkt, app } from './packets';

/**
 * The packet capture lab's captures. Each is built from conversations, so every answer is really in the packets;
 * capture.spec.ts checks each question's answer against them.
 */

export type AnswerKind =
  /** A packet number: the first packet that matches `match`. */
  | 'packet'
  /** Free text, compared with the accepted answers. */
  | 'text'
  /** A list of values in any order (ports, addresses). */
  | 'set';

export interface CaptureQuestion {
  id: string;
  ask: string;
  kind: AnswerKind;
  /** Accepted answers. For 'packet', filled in from `match`; for 'set', the one right set. */
  answers: string[];
  /** For 'packet' questions: the packet that answers it. */
  match?: (p: Pkt) => boolean;
  hint: string;
  /** Shown once answered: why this is the answer, and what it teaches. */
  why: string;
}

export interface CaptureScenario {
  id: string;
  title: string;
  /** Where the capture was taken, which decides what it can see. */
  where: string;
  story: string;
  gateway: Host;
  hosts: Host[];
  /** Filters worth trying, offered as chips. */
  filters: string[];
  build: () => Pkt[];
  questions: CaptureQuestion[];
}

const H = (name: string, ip: string, mac: string): Host => ({ name, ip, mac });

const GW = H('Gateway (router)', '10.0.4.1', '00:1a:2b:00:04:01');
const DNS = H('dns01 (DNS server)', '10.0.1.53', '00:1a:2b:00:01:53');
const SHOP = H('shop.fernco.example', '192.0.2.10', '00:00:00:00:00:00');
const START = 9 * 3600 + 14 * 60 + 2.118;

// ── 1. A laptop joins the network ─────────────────────────────────────────

const LEA = H('Lea\'s laptop', '10.0.4.57', 'f4:5c:89:3b:12:07');
const PRINTER = H('Printer', '10.0.4.20', '00:80:77:5a:2e:11');

function joinCapture(): Pkt[] {
  const c = new Capture({ start: START, lan: '10.0.4.0/24', gateway: GW });
  c.dhcp(LEA, GW, LEA.ip, 0x3a1f9c02);
  c.wait(0.05).arpRequest(PRINTER, '10.0.4.1').arpReply(GW, PRINTER);
  c.wait(0.3).arpRequest(LEA, GW.ip).wait(0.001).arpReply(GW, LEA);
  c.wait(0.2).dns(LEA, DNS, 'update.os-vendor.example', 'A', ['198.51.100.31'], 58211);
  c.wait(0.8).dns(LEA, DNS, 'shop.fernco.example', 'A', [SHOP.ip], 61734);
  const s = c.wait(0.004).tcp(LEA, SHOP, 50122, 443).open();
  s.send(true, 517, app.clientHello('shop.fernco.example'), 0.0002);
  s.send(false, 1384, app.serverHello());
  s.send(true, 412, app.tlsData('request'));
  s.send(false, 2896, app.tlsData('response'));
  c.wait(0.3).ping(LEA, GW, 1, { replyTtl: 64, rtt: 0.0008 });
  c.wait(1.5);
  s.close();
  return c.packets;
}

// ── 2. Cleartext logins ───────────────────────────────────────────────────

const JO = H('Jo Osei\'s PC', '10.0.4.106', '9c:7b:ef:11:40:6a');
const DAN = H('Dan Kim\'s PC', '10.0.4.122', '3c:52:82:4a:19:7e');
const MIA = H('Mia Lee\'s PC', '10.0.4.118', 'a4:bb:6d:20:91:c3');
const INTRANET = H('intranet (old server)', '10.0.2.20', '00:15:5d:02:00:20');
const FILES = H('ftp01 (file server)', '10.0.2.31', '00:15:5d:02:00:31');
const SWITCH = H('sw-floor2 (switch)', '10.0.9.2', '00:1e:7a:09:00:02');

function cleartextCapture(): Pkt[] {
  const c = new Capture({ start: START + 3600, lan: '10.0.0.0/16', gateway: GW });
  // HTTP form login to the old intranet.
  const web = c.tcp(JO, INTRANET, 51840, 80, { rtt: 0.0006 }).open();
  web.send(true, 412, app.http('GET /login HTTP/1.1\nHost: intranet.fernco.example\nUser-Agent: Mozilla/5.0\n'));
  web.send(false, 1830, app.http('HTTP/1.1 200 OK\nContent-Type: text/html\n\n<form method="post" action="/login">...'));
  c.wait(6.2);
  web.send(true, 486, app.http('POST /login HTTP/1.1\nHost: intranet.fernco.example\nContent-Type: application/x-www-form-urlencoded\n\nuser=j.osei&password=Lisbon-Tram-28'));
  web.send(false, 214, app.http('HTTP/1.1 302 Found\nLocation: /home\nSet-Cookie: session=7f3a9c21e4b0\n'));
  // HTTPS login: nothing readable.
  c.wait(2.1);
  const tls = c.tcp(MIA, SHOP, 50433, 443).open();
  tls.send(true, 517, app.clientHello('shop.fernco.example'), 0.0002);
  tls.send(false, 1384, app.serverHello());
  tls.send(true, 690, app.tlsData('request'));
  tls.send(false, 1210, app.tlsData('response'));
  // FTP: every word in the clear.
  c.wait(4.4);
  const ftp = c.tcp(DAN, FILES, 52266, 21, { rtt: 0.0005 }).open();
  const f = (t: string) => app.line('FTP', t, 'FTP sends commands, usernames and passwords as plain text. Anyone capturing can read them.');
  ftp.send(false, 27, f('220 ftp01 FTP server ready\r\n'));
  ftp.send(true, 14, f('USER d.kim\r\n'));
  ftp.send(false, 34, f('331 Password required for d.kim\r\n'));
  ftp.send(true, 22, f('PASS Accounts#2026\r\n'));
  ftp.send(false, 27, f('230 User d.kim logged in\r\n'));
  ftp.send(true, 15, f('RETR payroll.xlsx\r\n'));
  // Telnet to the switch's management address.
  c.wait(3.0);
  const tn = c.tcp(MIA, SWITCH, 52790, 23, { rtt: 0.0004 }).open();
  const t = (x: string) => app.line('TELNET', x, 'Telnet carries a whole terminal session, password included, as plain text. SSH replaced it.');
  tn.send(false, 7, t('login: '));
  tn.send(true, 7, t('admin\r\n'));
  tn.send(false, 10, t('Password: '));
  tn.send(true, 13, t('Sw1tch-Floor2\r\n'));
  tn.send(false, 12, t('sw-floor2# '));
  // SSH for contrast.
  c.wait(1.2);
  const ssh = c.tcp(JO, SWITCH, 52811, 22, { rtt: 0.0004 }).open();
  ssh.send(false, 41, app.line('SSH', 'SSH-2.0-OpenSSH_9.6\r\n', 'The version banner is the only readable part of SSH. After the key exchange everything is encrypted.'));
  ssh.send(true, 1080, app.opaque('SSH', 'Client: Key Exchange Init', 'The two sides agree on keys. From here on, nothing is readable.'));
  ssh.send(true, 96, app.opaque('SSH', 'Client: Encrypted packet (len=96)', 'An encrypted SSH message: commands and passwords stay private.'));
  return c.packets;
}

// ── 3. A port scan ────────────────────────────────────────────────────────

const SCANNER = H('LT-122 (Dan Kim\'s laptop)', '10.0.4.122', '3c:52:82:4a:19:7e');
const TARGET = H('intranet (old server)', '10.0.2.20', '00:15:5d:02:00:20');
const USER = H('Jo Osei\'s PC', '10.0.4.106', '9c:7b:ef:11:40:6a');
const SCAN_PORTS = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 1433, 3306, 3389, 5900, 8080];
const OPEN = [22, 80, 443, 445];
const FILTERED = [3389];

function scanCapture(): Pkt[] {
  const c = new Capture({ start: START + 7200, lan: '10.0.0.0/16', gateway: GW });
  const normal = c.tcp(USER, TARGET, 50812, 443, { rtt: 0.0006 }).open();
  normal.send(true, 517, app.clientHello('intranet.fernco.example'), 0.0002);
  normal.send(false, 1384, app.serverHello());
  c.wait(0.4);
  // The scanner uses one source port for every probe, as SYN scanners usually do.
  for (const port of SCAN_PORTS) {
    const probe = c.tcp(SCANNER, TARGET, 41522, port, { rtt: 0.0005 });
    c.wait(0.003);
    if (OPEN.includes(port)) probe.halfOpen();
    else if (FILTERED.includes(port)) probe.unanswered();
    else probe.refused();
  }
  c.wait(0.9);
  normal.send(true, 412, app.tlsData('request'));
  normal.send(false, 2210, app.tlsData('response'));
  return c.packets;
}

// ── 4. ARP poisoning ──────────────────────────────────────────────────────

const VICTIM = H('LT-115 (Kim Park\'s laptop)', '10.0.4.115', 'd8:bb:c1:0e:73:5a');
const ATTACKER = H('LT-122 (Dan Kim\'s laptop)', '10.0.4.122', '3c:52:82:4a:19:7e');
const INTRA = H('intranet', '10.0.2.20', '00:15:5d:02:00:20');

function arpCapture(): Pkt[] {
  const c = new Capture({ start: START + 10800, lan: '10.0.4.0/24', gateway: GW });
  // Normal: the victim learns the gateway's real MAC and browses.
  c.arpRequest(VICTIM, GW.ip).wait(0.001).arpReply(GW, VICTIM);
  c.wait(0.2).dns(VICTIM, DNS, 'intranet.fernco.example', 'A', [INTRA.ip], 60414);
  const before = c.wait(0.003).tcp(VICTIM, INTRA, 50990, 80, { serverTtl: 63 }).open();
  before.send(true, 380, app.http('GET /news HTTP/1.1\nHost: intranet.fernco.example\n'));
  before.send(false, 4120, app.http('HTTP/1.1 200 OK\nContent-Type: text/html\n'));
  before.close();
  c.wait(1.1).arpRequest(ATTACKER, GW.ip).wait(0.001).arpReply(GW, ATTACKER);
  // The attack: unasked-for replies, repeated so the lie stays in the caches.
  c.wait(2.4);
  for (let k = 0; k < 4; k++) {
    c.arpReply(ATTACKER, VICTIM, GW.ip);
    c.arpReply(ATTACKER, GW, VICTIM.ip);
    c.wait(2);
  }
  c.poison(VICTIM.ip, GW.ip, ATTACKER).poison(GW.ip, VICTIM.ip, ATTACKER);
  c.wait(0.4).dns(VICTIM, DNS, 'intranet.fernco.example', 'A', [INTRA.ip], 60533);
  const after = c.wait(0.003).tcp(VICTIM, INTRA, 51004, 80, { serverTtl: 63 }).open();
  after.send(true, 470, app.http('POST /login HTTP/1.1\nHost: intranet.fernco.example\n\nuser=k.park&password=Spring-Rain-14'));
  after.send(false, 214, app.http('HTTP/1.1 302 Found\nLocation: /home\n'));
  after.close();
  return c.packets;
}

// ── 5. The shop will not load ─────────────────────────────────────────────

const SAM = H('Sam Ito\'s laptop', '10.0.4.110', '70:cd:0d:44:8a:b2');
const ADMIN = H('shop admin portal', '192.0.2.10', '00:00:00:00:00:00');

function troubleCapture(): Pkt[] {
  const c = new Capture({ start: START + 14400, lan: '10.0.4.0/24', gateway: GW });
  c.dns(SAM, DNS, 'shopp.fernco.example', 'A', [], 53001);
  c.wait(4.2).dns(SAM, DNS, 'shop.fernco.example', 'A', [ADMIN.ip], 53002);
  for (let k = 1; k <= 3; k++) c.wait(k === 1 ? 0.5 : 1).ping(SAM, ADMIN, k, { replyTtl: 54, rtt: 0.021 });
  c.wait(0.9);
  // The admin portal listens on 8443, but the firewall drops it: SYNs go out, nothing comes back.
  c.tcp(SAM, ADMIN, 52144, 8443).unanswered(3, 1);
  c.wait(3.1);
  // The public shop on 443 works fine.
  const ok = c.tcp(SAM, ADMIN, 52151, 443).open();
  ok.send(true, 517, app.clientHello('shop.fernco.example'), 0.0002);
  ok.send(false, 1384, app.serverHello());
  return c.packets;
}

const synTo = (port: number, ip?: string) => (p: Pkt) => !!p.tcp?.flags.syn && !p.tcp.flags.ack && p.tcp.dport === port && (!ip || p.ip?.dst === ip);

export const CAPTURES: CaptureScenario[] = [
  {
    id: 'join',
    title: 'A laptop joins the network',
    where: 'On Lea\'s laptop, from the moment it connects to the office Wi-Fi',
    story: 'Lea opens her laptop and goes to the company shop. Everything she needed happened in these packets: getting an address, finding the gateway, looking up the name, connecting, and starting encryption. Find each step.',
    gateway: GW,
    hosts: [LEA, GW, PRINTER, DNS, SHOP],
    filters: ['dhcp', 'arp', 'dns', 'tcp.flags.syn == 1', 'tls', 'ip.addr == 192.0.2.10'],
    build: joinCapture,
    questions: [
      { id: 'ack', kind: 'packet', ask: 'Which packet tells the laptop it may use its new IP address? (Select it, or type its number.)', answers: [],
        match: p => p.app?.info.startsWith('DHCP ACK') ?? false,
        hint: 'Filter on dhcp. Getting an address takes four messages: Discover, Offer, Request, ACK.',
        why: 'The DHCP ACK is step 4 of DORA (Discover, Offer, Request, Acknowledge). Until then the laptop sends from 0.0.0.0, the "no address yet" address, and broadcasts because it knows no server.' },
      { id: 'ip', kind: 'text', ask: 'What IP address did the laptop get?', answers: ['10.0.4.57'],
        hint: 'Open the Offer or the ACK and look in the DHCP layer for "Your (client) IP address".',
        why: 'The server offered 10.0.4.57 in the Offer and confirmed it in the ACK, along with the gateway (10.0.4.1) and DNS server (10.0.1.53) to use.' },
      { id: 'arp', kind: 'text', ask: 'Before it could send anything off the local network, the laptop asked for one device\'s MAC address. Which IP did it ask about?', answers: ['10.0.4.1'],
        hint: 'Filter on arp and find the request the laptop (10.0.4.57) sent.',
        why: 'Everything bound for the internet goes to the default gateway, so the laptop needs the gateway\'s MAC to build frames for it. ARP asks the whole LAN "who has 10.0.4.1?" and the gateway answers.' },
      { id: 'dns', kind: 'text', ask: 'What IP address did DNS give for shop.fernco.example?', answers: ['192.0.2.10'],
        hint: 'Filter: dns.qry.name == "shop.fernco.example", then open the response.',
        why: 'Browsers know names, networks route addresses. The DNS response says shop.fernco.example is 192.0.2.10, which is where the TCP connection then goes.' },
      { id: 'syn', kind: 'packet', ask: 'Which packet starts the TCP connection to the shop?', answers: [], match: synTo(443),
        hint: 'Filter: tcp.flags.syn == 1. The first step of the handshake has SYN set and ACK not set.',
        why: 'SYN, then SYN-ACK, then ACK: the three-way handshake. Only after it can data flow.' },
      { id: 'sport', kind: 'text', ask: 'Which source port did the laptop use for that connection?', answers: ['50122'],
        hint: 'Open the SYN and look at the TCP layer.',
        why: 'The server listens on its well-known port, 443. The client picks a random high port (an ephemeral port) for each connection, so replies find their way back to the right browser tab.' },
      { id: 'sni', kind: 'text', ask: 'The connection is encrypted, yet one name is readable in the browser\'s first TLS message. What is it?', answers: ['shop.fernco.example'],
        hint: 'Filter on tls and open the Client Hello.',
        why: 'The Server Name Indication travels before encryption starts, so the server knows which certificate to send. It is why a proxy or firewall can filter HTTPS by site name without decrypting it.' },
      { id: 'mac', kind: 'text', ask: 'What destination MAC address is on the frames the laptop sends to the shop?', answers: ['00:1a:2b:00:04:01'],
        hint: 'Open any packet from 10.0.4.57 to 192.0.2.10 and look at the Ethernet layer.',
        why: 'The frames go to the gateway\'s MAC, not the shop\'s: MAC addresses only reach the next hop on the local network, while the IP address names the far end. Each router rewrites the MACs; the IPs stay the same.' },
    ],
  },
  {
    id: 'cleartext',
    title: 'What cleartext gives away',
    where: 'On a mirror port of the floor 2 switch, so it sees every PC on the floor',
    story: 'An auditor wants to know what an attacker on the office network could read. Four people sign in to four systems: an old intranet over HTTP, the shop over HTTPS, a file server over FTP and a switch over Telnet. One more connects to the switch over SSH. What can you read?',
    gateway: GW,
    hosts: [JO, MIA, DAN, INTRANET, FILES, SWITCH, SHOP],
    filters: ['http', 'http.request.method == "POST"', 'ftp', 'telnet', 'tls', 'ssh', 'tcp.port == 21'],
    build: cleartextCapture,
    questions: [
      { id: 'http-pw', kind: 'text', ask: 'Whose password can you read in the intranet login? (Their username.)', answers: ['j.osei'],
        hint: 'Filter: http.request.method == "POST", and look at the readable payload.',
        why: 'The form was posted over plain HTTP, so the username and password are in the packet as typed. HTTPS would have encrypted the whole request.' },
      { id: 'ftp-pw-pkt', kind: 'packet', ask: 'Which packet carries the FTP password?', answers: [], match: p => p.app?.info.startsWith('PASS') ?? false,
        hint: 'Filter on ftp and read the commands in order: USER, then PASS.',
        why: 'FTP sends USER and PASS as plain commands. Replace it with SFTP (port 22, part of SSH) or FTPS (FTP over TLS).' },
      { id: 'ftp-file', kind: 'text', ask: 'Which file did Dan download over FTP?', answers: ['payroll.xlsx'],
        hint: 'After logging in, the client sent a RETR (retrieve) command.',
        why: 'Not only the password: every command and the file contents are readable, so a capture also leaks what was taken.' },
      { id: 'telnet-user', kind: 'text', ask: 'Which username was used to sign in to the switch over Telnet?', answers: ['admin'],
        hint: 'Filter on telnet and read the lines after "login:".',
        why: 'Telnet is a whole terminal session in plain text, including the switch\'s admin password. Network devices should be managed over SSH, on a management VLAN.' },
      { id: 'safe', kind: 'text', ask: 'Two sign-ins in this capture are safe from anyone capturing traffic. Name either protocol.', answers: ['https', 'tls', 'ssh'],
        hint: 'Which connections show only "Application Data" or "Encrypted packet"?',
        why: 'HTTPS (HTTP inside TLS) and SSH encrypt everything after their handshake. You can see who talked to whom, when and how much, but not what was said.' },
      { id: 'replace', kind: 'text', ask: 'What port should replace Telnet\'s port 23 for managing the switch securely?', answers: ['22', 'tcp 22', 'ssh 22', '22 ssh'],
        hint: 'The secure remote shell that the last connection in the capture uses.',
        why: 'SSH on TCP 22 replaces Telnet on TCP 23. The same pairs to know: HTTP 80 → HTTPS 443, FTP 21 → SFTP 22 or FTPS 990, LDAP 389 → LDAPS 636, POP3 110 → 995, IMAP 143 → 993.' },
    ],
  },
  {
    id: 'scan',
    title: 'A port scan',
    where: 'On a mirror port in front of the old intranet server, 10.0.2.20',
    story: 'The SIEM flagged one laptop connecting to many ports on the intranet server within a second. Read the scan the way the attacker did: which ports answered, and what kind of scan was it?',
    gateway: GW,
    hosts: [USER, TARGET],
    filters: ['ip.src == 10.0.4.122', 'tcp.flags.syn == 1 && tcp.flags.ack == 0', 'tcp.flags.syn == 1 && tcp.flags.ack == 1', 'tcp.flags.reset == 1'],
    build: scanCapture,
    questions: [
      { id: 'who', kind: 'text', ask: 'Which IP address is scanning?', answers: ['10.0.4.122'],
        hint: 'Filter: tcp.flags.syn == 1 && tcp.flags.ack == 0. Who sends SYNs to many ports?',
        why: 'One source sending SYNs to many different ports in quick succession is the signature of a port scan. Here it is an internal laptop, which is worse than an internet scanner: something on it is mapping the network.' },
      { id: 'open', kind: 'set', ask: 'Which ports are open on 10.0.2.20? List them all, separated by spaces.', answers: ['22 80 443 445'],
        hint: 'An open port answers a SYN with SYN-ACK. Filter: tcp.flags.syn == 1 && tcp.flags.ack == 1 && ip.src == 10.0.2.20',
        why: 'SYN-ACK means "yes, connect": 22 (SSH), 80 (HTTP), 443 (HTTPS) and 445 (SMB) are open. A closed port answers RST, ACK. 445 open to laptops is worth a look: SMB is a favourite for spreading malware.' },
      { id: 'filtered', kind: 'text', ask: 'One port gave no answer at all. Which?', answers: ['3389'],
        hint: 'Every probe got SYN-ACK or RST, except one. Compare the SYNs with the replies.',
        why: 'No reply at all usually means a firewall dropped the probe, so the port shows as "filtered". 3389 is RDP, and the server\'s host firewall blocks it from laptops.' },
      { id: 'kind', kind: 'text', ask: 'After an open port answers, the scanner sends a reset instead of finishing the handshake. What is this kind of scan called?', answers: ['syn scan', 'half-open', 'half open', 'half-open scan', 'half open scan', 'stealth', 'stealth scan', 'syn'],
        hint: 'Look at what 10.0.4.122 sends right after a SYN-ACK.',
        why: 'A SYN scan (half-open scan) never completes the handshake: SYN, SYN-ACK, then RST. It is faster than a full connect scan and less likely to be logged by the application, though firewalls and IDS still see it.' },
      { id: 'sport', kind: 'text', ask: 'What source port did the scanner use for its probes?', answers: ['41522'],
        hint: 'Open any of the scanner\'s SYNs.',
        why: 'Scanners often reuse one source port for every probe, unlike a browser, which takes a new ephemeral port for each connection. It is one more clue that a tool, not a person, made this traffic.' },
    ],
  },
  {
    id: 'arp',
    title: 'ARP poisoning on the LAN',
    where: 'On a mirror port of the floor 2 switch',
    story: 'Kim Park\'s laptop is on leave in a drawer, yet a colleague used it this morning and says the intranet "felt slow" after a few minutes. Someone may be sitting between it and the gateway. Find the lie and its effect.',
    gateway: GW,
    hosts: [VICTIM, GW, DNS, INTRA],
    filters: ['arp', 'arp.opcode == 2', 'arp.src.proto_ipv4 == 10.0.4.1', 'eth.addr == 3c:52:82:4a:19:7e', 'http'],
    build: arpCapture,
    questions: [
      { id: 'mac', kind: 'text', ask: 'Which MAC address falsely claims to own the gateway\'s IP address, 10.0.4.1?', answers: ['3c:52:82:4a:19:7e'],
        hint: 'Filter: arp.src.proto_ipv4 == 10.0.4.1. The real gateway is 00:1a:2b:00:04:01.',
        why: 'Two different MAC addresses claim 10.0.4.1. The gateway\'s real one answered a request; the other sends replies nobody asked for, every two seconds, which is ARP poisoning (ARP spoofing).' },
      { id: 'ip', kind: 'text', ask: 'Which IP address does that MAC really belong to?', answers: ['10.0.4.122'],
        hint: 'Look for an ARP request that MAC sent honestly, before the attack started.',
        why: 'Before attacking, the same laptop asked for the gateway in its own name: 10.0.4.122, LT-122. Matching a MAC to its honest traffic is how you find the device and the switch port.' },
      { id: 'first', kind: 'packet', ask: 'Which packet is the first forged ARP reply?', answers: [],
        match: p => p.arp?.op === 2 && p.arp.senderIp === '10.0.4.1' && p.arp.senderMac === '3c:52:82:4a:19:7e',
        hint: 'Filter: arp.opcode == 2 && arp.src.proto_ipv4 == 10.0.4.1, and take the earliest reply from the wrong MAC.',
        why: 'ARP has no authentication, and devices accept replies they never asked for. From this packet on, the victim sends its traffic for the gateway to the attacker.' },
      { id: 'ttl', kind: 'text', ask: 'The victim\'s packets leave with a TTL of 64. With what TTL do they reach the gateway once the attack is on?', answers: ['63'],
        hint: 'Filter: ip.src == 10.0.4.115 && http, and compare the two copies of the same packet: one to the attacker, one from the attacker to the gateway.',
        why: 'The attacker forwards each packet like a router would, lowering the TTL by one. The same packet appears twice on the LAN, first to the attacker\'s MAC, then from it to the gateway\'s: the on-path position in one picture.' },
      { id: 'pw', kind: 'text', ask: 'Once on-path, whose credentials did the attacker receive? (The username.)', answers: ['k.park'],
        hint: 'Filter on http and look at the POST after the attack started.',
        why: 'The login went over plain HTTP, so the on-path attacker read it. HTTPS (with HSTS) would have protected it even with ARP poisoned.' },
      { id: 'fix', kind: 'text', ask: 'Which switch feature checks ARP replies against DHCP\'s records and drops forged ones?', answers: ['dai', 'dynamic arp inspection', 'arp inspection'],
        hint: 'It works together with DHCP snooping.',
        why: 'Dynamic ARP Inspection (DAI) compares each ARP reply with the DHCP snooping table of which MAC got which IP on which port, and drops lies. Port security and 802.1X help too, by keeping unknown devices off the switch.' },
    ],
  },
  {
    id: 'trouble',
    title: 'Why will the page not load?',
    where: 'On Sam\'s laptop',
    story: 'Sam says the shop\'s admin portal "just spins". Captures settle arguments: did the name resolve, can the server be reached at all, and did anything answer on the port?',
    gateway: GW,
    hosts: [SAM, GW, DNS, ADMIN],
    filters: ['dns', 'icmp', 'tcp.port == 8443', 'tcp.port == 443', 'tcp.flags.syn == 1'],
    build: troubleCapture,
    questions: [
      { id: 'typo', kind: 'text', ask: 'Sam first typed the name wrong. What did DNS answer for shopp.fernco.example?', answers: ['no such name', 'nxdomain', 'none', 'nothing', 'no answer', 'not found'],
        hint: 'Filter on dns and open the first response.',
        why: 'NXDOMAIN, "no such name": the name does not exist. A typo, or a sign that a domain has been taken down. A host that suddenly asks for many names that do not exist is a classic sign of malware searching for its server.' },
      { id: 'ping', kind: 'text', ask: 'Sam then pinged the server. How many echo replies came back?', answers: ['3', 'three'],
        hint: 'Filter on icmp and count the replies.',
        why: 'Every echo request got a reply, so the server is up and routable. A reply\'s TTL of 54 says it started at 64 and crossed 10 routers.' },
      { id: 'port', kind: 'text', ask: 'Which port is the admin portal on?', answers: ['8443'],
        hint: 'Look at the TCP SYNs that never got an answer.',
        why: '8443 is the usual alternative HTTPS port, often used for admin interfaces so they can be firewalled separately from the public site on 443.' },
      { id: 'tries', kind: 'text', ask: 'How many times did the laptop send that SYN before giving up?', answers: ['3', 'three'],
        hint: 'Filter: tcp.port == 8443',
        why: 'With no answer, TCP retransmits the SYN, waiting longer each time (1 second, then 2). Retries of the same SYN, with the same sequence number, mean the packets are vanishing.' },
      { id: 'cause', kind: 'text', ask: 'Ping works and DNS works, but the SYNs to that port get no reply at all, not even a reset. What is most likely dropping them?', answers: ['firewall', 'a firewall', 'the firewall', 'acl', 'an acl'],
        hint: 'A closed port answers with RST. Silence means something in between.',
        why: 'A closed port would send RST at once. Silence means a firewall (or ACL) silently drops the traffic: here, a rule that keeps the admin portal off-limits from staff laptops. That is likely deliberate, so the fix is a change request, not a hole in the firewall.' },
    ],
  },
];

export const captureById = (id: string) => CAPTURES.find(c => c.id === id);

const memo = new Map<string, Pkt[]>();

/** The capture's packets, built once. */
export function packetsOf(c: CaptureScenario): Pkt[] {
  let p = memo.get(c.id);
  if (!p) memo.set(c.id, (p = c.build()));
  return p;
}

/** The accepted answers, with packet questions resolved to the packet that matches. */
export function answersOf(c: CaptureScenario, q: CaptureQuestion): string[] {
  if (q.kind !== 'packet') return q.answers;
  const hit = packetsOf(c).find(p => q.match!(p));
  return hit ? [String(hit.no)] : [];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[.!]+$/, '').replace(/\s+/g, ' ').replace(/^the /, '');

export function checkAnswer(c: CaptureScenario, q: CaptureQuestion, input: string): boolean {
  const a = norm(input);
  if (!a) return false;
  const want = answersOf(c, q);
  if (q.kind === 'packet') return want.includes(a.replace(/^(packet|no\.?|#)\s*/, ''));
  if (q.kind === 'set') {
    const got = [...new Set(a.split(/[\s,;/]+|\band\b/).filter(Boolean))].sort();
    const need = [...new Set(want[0].split(/\s+/))].sort();
    return got.length === need.length && got.every((x, i) => x === need[i]);
  }
  return want.some(w => norm(w) === a);
}
