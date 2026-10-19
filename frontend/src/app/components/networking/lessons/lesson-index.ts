import { CardRef, LessonMeta } from '../networking.model';

const acr = (...names: string[]): CardRef[] => names.map(name => ({ kind: 'acr', name }));
const term = (...names: string[]): CardRef[] => names.map(name => ({ kind: 'term', name }));

/**
 * The lesson list, in teaching order. Kept apart from the lesson text so the glossary pages can ask
 * "is there a lesson for this card?" without loading all of the lessons.
 *
 * In `related`, list the lesson's core cards first and set `focus` to how many there are. A card that
 * several lessons mention links to the lesson it is mainly about first.
 */
export const LESSON_META: LessonMeta[] = [
  {
    slug: 'start', number: 1, minutes: 13, icon: 'flag',
    title: 'Start here: what a network is',
    summary: 'For complete beginners: what a network is, what bits and packets are, what addresses, protocols, clients and servers are, and how your home network connects to the internet.',
    related: [...acr('LAN', 'MAN', 'ISP', 'NIC', 'IP', 'MAC', 'TCP', 'UDP', 'DNS')],
    focus: 3,
  },
  {
    slug: 'addresses', number: 2, minutes: 14, icon: 'tag',
    title: 'Addresses: MAC, IP and subnets',
    summary: 'Why every device has two addresses, how to read an IP address and a /24, which ranges are private, and what a default gateway is.',
    related: [...acr('MAC', 'IP', 'IPv4', 'IPv6', 'CIDR', 'VLSM'), ...term('MAC address', 'IP address', 'Subnet', 'Subnet mask', 'Default gateway', 'Spoofing'), ...acr('NAT', 'DHCP', 'ARP'), ...term('Network segmentation')],
    focus: 12,
  },
  {
    slug: 'ports-tcp-udp', number: 3, minutes: 11, icon: 'settings_ethernet',
    title: 'Ports, TCP and UDP',
    summary: 'What a port is, how TCP and UDP differ, the three-way handshake, and why every open port is part of your attack surface.',
    related: [...acr('TCP', 'UDP'), ...term('Network port', 'Three-way handshake', 'Attack surface', 'Implicit deny'), ...acr('DoS', 'DDoS'), ...term('Hardening', 'Stateful inspection')],
    focus: 8,
  },
  {
    slug: 'layers', number: 4, minutes: 10, icon: 'layers',
    title: 'The layers: everything in one picture',
    summary: 'The seven-layer model in plain English: what each layer does, which devices and attacks live where, and how data gets wrapped on the way down.',
    related: [...acr('OSI'), ...term('Defense in depth', 'Encapsulation'), ...acr('TCP', 'UDP', 'IP', 'ARP', 'WAF', 'NGFW'), ...term('Firewall', 'Packet filtering', 'Stateful inspection')],
    focus: 3,
  },
  {
    slug: 'ports-to-know', number: 5, minutes: 10, icon: 'format_list_numbered',
    title: 'The ports and protocols to know',
    summary: 'Common ports grouped by job, the secure replacement for each insecure protocol, a few memory hooks, and where to practice.',
    related: [...acr('HTTP', 'HTTPS', 'SSH', 'FTP', 'SFTP', 'FTPS', 'SMTP', 'IMAP', 'POP', 'LDAPS', 'SNMP', 'NTP', 'RDP', 'TLS'), ...term('Hardening')],
    focus: 14,
  },
  {
    slug: 'devices', number: 6, minutes: 16, icon: 'router',
    title: 'Hubs, switches and routers',
    summary: 'What each device looks at to decide where traffic goes, how a switch learns, why MAC addresses change at every hop while IP addresses do not, and how to harden switches and routers.',
    related: [...term('Switch', 'Hub', 'Router', 'Layer 3 switch', 'Routing table', 'Collision domain', 'Broadcast domain', 'Port security', 'MAC flooding', 'Port mirroring', 'Network tap'), ...acr('BPDU', 'NIC', 'AP'), ...term('Default credentials'), ...acr('NAC', 'VLAN'), ...term('ARP poisoning', '802.1X', 'Network segmentation', 'Hardening')],
    focus: 15,
  },
  {
    slug: 'vlans', number: 7, minutes: 11, icon: 'device_hub',
    title: 'VLANs and segmentation',
    summary: 'How one switch becomes several separate networks, what trunks and 802.1Q tags are, and how VLAN hopping is stopped.',
    related: [...acr('VLAN'), ...term('Trunk port', 'VLAN hopping', 'Network segmentation', 'Microsegmentation', 'Air-gapped network', 'Security zone'), ...acr('NAC'), ...term('802.1X', 'Zero trust', 'Screened subnet', 'Broadcast domain')],
    focus: 9,
  },
  {
    slug: 'helpers', number: 8, minutes: 18, icon: 'dns',
    title: 'The helpers: DHCP, DNS, ARP, ICMP and NAT',
    summary: 'The quiet protocols every connection depends on: how each works step by step, how each is attacked, and how each is defended.',
    related: [...acr('DHCP', 'DNS', 'DNSSEC', 'ARP', 'ICMP', 'NAT', 'PAT', 'DNAT', 'NTP'), ...term('DNS poisoning', 'ARP poisoning', 'Pharming', 'Spoofing', 'Amplification attack', 'DNS filtering')],
    focus: 15,
  },
  {
    slug: 'security-devices', number: 9, minutes: 15, icon: 'security',
    title: 'Firewalls, zones, VPNs and Wi-Fi',
    summary: 'How firewall rules are read, where firewalls and the screened subnet sit, what proxies and load balancers do, and the basics of VPNs and Wi-Fi security, with hardening for each.',
    related: [...term('Firewall', 'Screened subnet', 'Proxy server', 'Load balancing', 'Implicit deny', 'Packet filtering', 'Stateful inspection'), ...acr('NGFW', 'WAF', 'UTM', 'SWG', 'DMZ', 'VPN', 'IPSec', 'WPA2', 'WPA3'), ...term('Evil twin', 'Rogue access point', 'Web filter', 'Jump server')],
    focus: 20,
  },
  {
    slug: 'web-request', number: 10, minutes: 12, icon: 'language',
    title: 'One web request, start to finish',
    summary: 'Follow a single page load from your laptop to a web server and back, with the address and port fields at every hop, then see where each attack and defense fits.',
    related: [...acr('DNS', 'ARP', 'NAT', 'TCP', 'TLS', 'HTTPS', 'DHCP'), ...term('Default gateway', 'Man-in-the-middle attack', 'Session hijacking', 'SSL stripping', 'DNS poisoning', 'ARP poisoning')],
    // A capstone that revisits earlier lessons, so it never outranks the lesson a card is really about.
    focus: 0,
  },
  {
    slug: 'hardening', number: 11, minutes: 14, icon: 'shield',
    title: 'Hardening: how to secure network devices',
    summary: 'What hardening means, a checklist that works for any device, quick lists for each kind of device, and a hands-on exercise: spot the weaknesses in a router configuration.',
    related: [...term('Hardening', 'Attack surface', 'Secure baseline', 'Baseline configuration', 'Default credentials', 'Patch management', 'Least privilege', 'Misconfiguration', 'Change management', 'Port security', 'Application allow list'), ...acr('CIS', 'STIG', 'SNMP', 'SSH')],
    focus: 11,
  },
];

export function lessonBySlug(slug: string | null | undefined): LessonMeta | undefined {
  return LESSON_META.find(l => l.slug === slug);
}

/**
 * Lessons that cover a flashcard, so a card can say "New to this? Start with lesson N".
 * The lesson a card is mainly about comes first, then the others in teaching order.
 */
export function lessonsForCard(kind: CardRef['kind'], name: string): LessonMeta[] {
  return LESSON_META
    .map(lesson => ({ lesson, index: lesson.related.findIndex(r => r.kind === kind && r.name === name) }))
    .filter(hit => hit.index >= 0)
    .sort((a, b) => Number(b.index < b.lesson.focus) - Number(a.index < a.lesson.focus) || a.lesson.number - b.lesson.number)
    .map(hit => hit.lesson);
}
