import { CardRef, LessonMeta, TrackId } from '../networking.model';

const acr = (...names: string[]): CardRef[] => names.map(name => ({ kind: 'acr', name }));
const term = (...names: string[]): CardRef[] => names.map(name => ({ kind: 'term', name }));

/** The two sets of lessons. Each is numbered from 1 and read in its own order. */
export const TRACKS: Record<TrackId, { title: string; unit: string; icon: string }> = {
  networking: { title: 'Networking Basics', unit: 'Lesson', icon: 'lan' },
  topics: { title: 'Hands-on topics', unit: 'Topic', icon: 'touch_app' },
};

const inTrack = (track: TrackId, lessons: Omit<LessonMeta, 'track'>[]): LessonMeta[] => lessons.map(l => ({ ...l, track }));

/**
 * The lesson list, in teaching order. Kept apart from the lesson text so the glossary pages can ask
 * "is there a lesson for this card?" without loading all of the lessons.
 *
 * In `related`, list the lesson's core cards first and set `focus` to how many there are. A card that
 * several lessons mention links to the lesson it is mainly about first.
 */
export const LESSON_META: LessonMeta[] = [...inTrack('networking', [
  {
    slug: 'start', number: 1, minutes: 24, optionalMinutes: 2, icon: 'flag',
    title: 'Start here: what a network is',
    summary: 'For complete beginners: what a network is, what bits and packets are, what addresses, protocols, clients and servers are, and how your home network connects to the internet.',
    related: [...acr('LAN', 'MAN', 'ISP', 'NIC', 'IP', 'MAC', 'TCP', 'UDP', 'DNS')],
    focus: 3,
  },
  {
    slug: 'addresses', number: 2, minutes: 41, optionalMinutes: 14, icon: 'tag',
    title: 'Addresses: MAC, IP and subnets',
    summary: 'Why every device has two addresses, what a subnet mask does, how to read a /24 and split a network into subnets, which ranges are private, and what a default gateway is.',
    related: [...acr('MAC', 'IP', 'IPv4', 'IPv6', 'CIDR', 'VLSM'), ...term('MAC address', 'IP address', 'Subnet', 'Subnet mask', 'Default gateway', 'Spoofing'), ...acr('NAT', 'DHCP', 'ARP'), ...term('Network segmentation')],
    focus: 12,
  },
  {
    slug: 'ports-tcp-udp', number: 3, minutes: 24, icon: 'settings_ethernet',
    title: 'Ports, TCP and UDP',
    summary: 'What a port is, how TCP and UDP differ, the three-way handshake, and why every open port is part of your attack surface.',
    related: [...acr('TCP', 'UDP'), ...term('Network port', 'Three-way handshake', 'Attack surface', 'Implicit deny'), ...acr('DoS', 'DDoS'), ...term('Hardening', 'Stateful inspection')],
    focus: 8,
  },
  {
    slug: 'layers', number: 4, minutes: 28, icon: 'layers',
    title: 'The layers: everything in one picture',
    summary: 'The seven-layer model in plain English: what each layer does, which devices and attacks live where, and how data gets wrapped on the way down.',
    related: [...acr('OSI'), ...term('Defense in depth', 'Encapsulation'), ...acr('TCP', 'UDP', 'IP', 'ARP', 'WAF', 'NGFW'), ...term('Firewall', 'Packet filtering', 'Stateful inspection')],
    focus: 3,
  },
  {
    slug: 'ports-to-know', number: 5, minutes: 25, icon: 'format_list_numbered',
    title: 'The ports and protocols to know',
    summary: 'Common ports grouped by job, the secure replacement for each insecure protocol, a few memory hooks, and where to practice.',
    related: [...acr('HTTP', 'HTTPS', 'SSH', 'FTP', 'SFTP', 'FTPS', 'SMTP', 'IMAP', 'POP', 'LDAPS', 'SNMP', 'NTP', 'RDP', 'TLS'), ...term('Hardening')],
    focus: 14,
  },
  {
    slug: 'devices', number: 6, minutes: 32, icon: 'router',
    title: 'Hubs, switches and routers',
    summary: 'What each device looks at to decide where traffic goes, how a switch learns, why MAC addresses change at every hop while IP addresses do not, and how to harden switches and routers.',
    related: [...term('Switch', 'Hub', 'Router', 'Layer 3 switch', 'Routing table', 'Collision domain', 'Broadcast domain', 'Port security', 'MAC flooding', 'Port mirroring', 'Network tap'), ...acr('BPDU', 'NIC', 'AP'), ...term('Default credentials'), ...acr('NAC', 'VLAN'), ...term('ARP poisoning', '802.1X', 'Network segmentation', 'Hardening')],
    focus: 15,
  },
  {
    slug: 'vlans', number: 7, minutes: 22, icon: 'device_hub',
    title: 'VLANs and segmentation',
    summary: 'How one switch becomes several separate networks, what trunks and 802.1Q tags are, and how VLAN hopping is stopped.',
    related: [...acr('VLAN'), ...term('Trunk port', 'VLAN hopping', 'Network segmentation', 'Microsegmentation', 'Air-gapped network', 'Security zone'), ...acr('NAC'), ...term('802.1X', 'Zero trust', 'Screened subnet', 'Broadcast domain')],
    focus: 9,
  },
  {
    slug: 'helpers', number: 8, minutes: 50, icon: 'dns',
    title: 'The helpers: DHCP, DNS, ARP, ICMP and NAT',
    summary: 'The quiet protocols every connection depends on: how each works step by step, how each is attacked, and how each is defended.',
    related: [...acr('DHCP', 'DNS', 'DNSSEC', 'ARP', 'ICMP', 'NAT', 'PAT', 'DNAT', 'NTP'), ...term('DNS poisoning', 'ARP poisoning', 'Pharming', 'Spoofing', 'Amplification attack', 'DNS filtering')],
    focus: 15,
  },
  {
    slug: 'security-devices', number: 9, minutes: 63, icon: 'security',
    title: 'Firewalls, zones, VPNs and Wi-Fi',
    summary: 'How firewall rules are read, where firewalls and the screened subnet sit, what proxies and load balancers do, and the basics of VPNs and Wi-Fi security, with hardening for each.',
    related: [...term('Firewall', 'Screened subnet', 'Proxy server', 'Load balancing', 'Implicit deny', 'Packet filtering', 'Stateful inspection'), ...acr('NGFW', 'WAF', 'UTM', 'SWG', 'DMZ', 'VPN', 'IPSec', 'WPA2', 'WPA3'), ...term('Evil twin', 'Rogue access point', 'Web filter', 'Jump server')],
    focus: 20,
  },
  {
    slug: 'web-request', number: 10, minutes: 20, icon: 'language',
    title: 'One web request, start to finish',
    summary: 'Follow a single page load from your laptop to a web server and back, with the address and port fields at every hop, then see where each attack and defense fits.',
    related: [...acr('DNS', 'ARP', 'NAT', 'TCP', 'TLS', 'HTTPS', 'DHCP'), ...term('Default gateway', 'Man-in-the-middle attack', 'Session hijacking', 'SSL stripping', 'DNS poisoning', 'ARP poisoning')],
    // A capstone that revisits earlier lessons, so it never outranks the lesson a card is really about.
    focus: 0,
  },
  {
    slug: 'hardening', number: 11, minutes: 37, optionalMinutes: 2, icon: 'shield',
    title: 'Hardening: how to secure network devices',
    summary: 'What hardening means, a checklist that works for any device, quick lists for each kind of device, and a hands-on exercise: spot the weaknesses in a router configuration.',
    related: [...term('Hardening', 'Attack surface', 'Secure baseline', 'Baseline configuration', 'Default credentials', 'Patch management', 'Least privilege', 'Misconfiguration', 'Change management', 'Port security', 'Application allow list'), ...acr('CIS', 'STIG', 'SNMP', 'SSH')],
    focus: 11,
  },
]), ...inTrack('topics', [
  {
    slug: 'crypto', number: 1, minutes: 40, optionalMinutes: 1, icon: 'key',
    title: 'Encryption, hashing and signatures',
    summary: 'Hash some text and watch it change, salt a password, and pick which of Alice\'s and Bob\'s keys locks, unlocks, signs and verifies. Then see how TLS combines them all.',
    related: [...term('Symmetric encryption', 'Asymmetric encryption', 'Hashing', 'Salting', 'Key stretching', 'Digital signature', 'Non-repudiation', 'Hybrid encryption', 'Key exchange', 'Public key', 'Private key', 'Plaintext and ciphertext', 'Rainbow table', 'Perfect forward secrecy', 'Session key'),
      ...acr('AES', 'RSA', 'ECC', 'DH', 'SHA', 'MD5', 'HMAC', 'PBKDF2'),
      ...term('Encryption', 'Block cipher', 'Stream cipher', 'Key length', 'Cipher suite', 'Collision attack', 'Blockchain', 'Open public ledger', 'Encryption levels', 'Obfuscation', 'Tokenization', 'Data masking', 'Steganography'),
      ...acr('ECDHE', 'PFS', 'DES', 'RC4', 'ECDSA', 'GCM', 'FDE')],
    focus: 23,
  },
  {
    slug: 'pki', number: 2, minutes: 36, icon: 'verified',
    title: 'Certificates and PKI: should the browser trust it?',
    summary: 'Read a certificate, follow the chain of trust to a root, request one with a CSR and revoke it with OCSP. Then judge six real-looking certificate chains the way a browser does.',
    related: [...term('Certificate', 'Certificate authority', 'Chain of trust', 'Root of trust', 'Self-signed certificate', 'Wildcard certificate', 'Certificate pinning', 'Key escrow', 'Code signing'),
      ...acr('PKI', 'CA', 'CRL', 'OCSP', 'CSR', 'RA', 'HSM', 'TPM', 'KMS'),
      ...acr('SAN', 'S/MIME', 'TLS'), ...term('Secure enclave', 'Digital signature', 'Man-in-the-middle attack')],
    focus: 18,
  },
  {
    slug: 'sign-in', number: 3, minutes: 36, icon: 'login',
    title: 'Sign-in protocols: Kerberos, SAML, OAuth and more',
    summary: 'Step through a Kerberos sign-in, a SAML login and an OAuth consent, see what OpenID Connect adds, and compare RADIUS with TACACS+. Then identify each protocol from what it looks like on the wire.',
    related: [...acr('SSO', 'SAML', 'OAUTH', 'OIDC', 'IdP', 'KDC', 'TGT', 'LDAP', 'LDAPS', 'RADIUS', 'TACACS+', 'AAA'), ...term('Kerberos', 'Federation', 'Single sign-on'),
      ...term('Authentication', 'Authorization', 'Pass-the-hash', '802.1X'), ...acr('NTLM', 'MFA')],
    focus: 15,
  },
  {
    slug: 'incident-response', number: 4, minutes: 38, icon: 'emergency',
    title: 'Incident response and forensics, step by step',
    summary: 'The response phases in order, then a ransomware incident told one decision at a time. Finish with evidence handling: order of volatility, write blockers, hashes, chain of custody and legal hold.',
    related: [...term('Incident response', 'Containment', 'Eradication', 'Lessons learned', 'Isolation', 'Playbook', 'Runbook', 'Tabletop exercise', 'Threat hunting', 'Digital forensics', 'Order of volatility', 'Chain of custody', 'Legal hold', 'e-Discovery'), ...acr('IR', 'CSIRT', 'RCA'),
      ...term('Indicator of compromise', 'Quarantine'), ...acr('IoC', 'EDR', 'IRP', 'SIEM')],
    focus: 17,
  },
])];

export function trackLessons(track: TrackId): LessonMeta[] {
  return LESSON_META.filter(l => l.track === track);
}

/** Where a lesson lives, for router links. */
export const lessonLink = (slug: string) => ['/lessons', slug];

/** "Lesson 3" or "Topic 2". */
export const lessonLabel = (l: LessonMeta) => `${TRACKS[l.track].unit} ${l.number}`;

/** The line a flashcard shows above the title of a lesson that explains it. */
export const lessonHint = (l: LessonMeta) =>
  l.track === 'networking' ? `New to this? Start with lesson ${l.number}` : `Try it hands-on: topic ${l.number}`;

export function lessonBySlug(slug: string | null | undefined): LessonMeta | undefined {
  return LESSON_META.find(l => l.slug === slug);
}

/**
 * Lessons that cover a flashcard, so a card can say "New to this? Start with lesson N".
 * The lesson a card is mainly about comes first, then the others in list order (networking before topics).
 */
export function lessonsForCard(kind: CardRef['kind'], name: string): LessonMeta[] {
  return LESSON_META
    .map(lesson => ({ lesson, index: lesson.related.findIndex(r => r.kind === kind && r.name === name) }))
    .filter(hit => hit.index >= 0)
    .sort((a, b) => Number(b.index < b.lesson.focus) - Number(a.index < a.lesson.focus) || LESSON_META.indexOf(a.lesson) - LESSON_META.indexOf(b.lesson))
    .map(hit => hit.lesson);
}
