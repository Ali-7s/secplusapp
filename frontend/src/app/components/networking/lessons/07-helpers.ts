import { LessonBody } from '../networking.model';
import { exam, h, hSecure, list, mcq, p, secure, table, tip, trap } from './dsl';

export const HELPERS: LessonBody = {
  goals: [
    'Say what DHCP, DNS, ARP, ICMP and NAT each do, in one sentence each',
    'Walk through the DHCP exchange (DORA) and a DNS lookup step by step',
    'Explain how ARP works and why ARP poisoning is possible',
    'Explain NAT and PAT, and why NAT is not a firewall',
    'Name the attack that targets each helper and the defense that stops it',
  ],
  blocks: [
    p('Before your computer can load a web page, a handful of quiet **helper protocols** have to do their jobs. Almost every Layer 2 and Layer 3 attack on the exam is an abuse of one of them.'),
    table(
      ['Helper', 'The question it answers', 'Where it lives', 'Typically attacked by'],
      [
        ['DHCP', '"What is my IP address, gateway and DNS server?"', 'UDP 67 and 68', 'Rogue DHCP servers and address starvation'],
        ['DNS', '"What IP address belongs to this name?"', 'UDP and TCP 53', 'Cache poisoning, hijacking, tunneling and amplification'],
        ['ARP', '"Which MAC address owns this IP on my LAN?"', 'Layer 2 (no port)', 'ARP poisoning'],
        ['ICMP', '"Is it reachable? What went wrong?"', 'Layer 3 (no port)', 'Floods, Smurf, tunneling and reconnaissance'],
        ['NAT', '"Can many private devices share one public address?"', 'A router feature', 'Not attacked as such, but often mistaken for a firewall'],
      ],
    ),

    h('DHCP: getting an address'),
    p('A new device has no IP address, so it needs one. **DHCP** (Dynamic Host Configuration Protocol) hands out an address, a **lease** time, the default gateway and the DNS server. The exchange has four steps, remembered as **DORA**.'),
    {
      type: 'sequence',
      title: 'DHCP: Discover, Offer, Request, Acknowledge',
      steps: [
        {
          from: 'Client', to: 'Everyone (broadcast)', label: 'Discover',
          note: 'The client has no address yet, so it **broadcasts**: "Is there a DHCP server out there?" The source address is `0.0.0.0` and the destination is `255.255.255.255`.',
        },
        {
          from: 'DHCP server', to: 'Client', label: 'Offer',
          note: 'A server replies: "How about `192.168.1.50`, mask `255.255.255.0`, gateway `192.168.1.1` and DNS `192.168.1.1`, for 8 hours?"',
        },
        {
          from: 'Client', to: 'Everyone (broadcast)', label: 'Request',
          note: 'The client accepts one offer: "I will take that one." It is broadcast so that any other server that made an offer knows it was not chosen.',
        },
        {
          from: 'DHCP server', to: 'Client', label: 'Acknowledge',
          note: 'The server confirms and the lease begins. The client tries to renew it halfway through the lease.',
        },
      ],
    },
    list(
      '**Rogue DHCP server.** An attacker answers first and hands out a malicious gateway or DNS server, so victims send their traffic through the attacker (an on-path attack).',
      '**DHCP starvation.** The attacker requests every address in the pool using fake MAC addresses so real devices cannot get one, and then runs a rogue server.',
    ),
    secure('Turn on **DHCP snooping** on switches: only ports you trust may send server replies, and the request rate is limited. Add port security and 802.1X so unknown devices never reach the network, and monitor for DHCP servers that should not exist.', 'Stopping rogue DHCP'),

    h('DNS: names to addresses'),
    p('People use names, computers use addresses. **DNS** translates `www.example.com` into an IP address. Your device asks a **recursive resolver** (usually your router or your provider), which does the legwork and remembers the answer for a while (its **TTL**).'),
    {
      type: 'sequence',
      title: 'A DNS lookup, step by step',
      steps: [
        {
          from: 'Laptop', to: 'Resolver', label: 'www.example.com?',
          note: 'The laptop asks its configured resolver. If the resolver already has the answer cached, it replies immediately and the rest of the steps are skipped.',
        },
        {
          from: 'Resolver', to: 'Root server', label: 'Where is .com?',
          note: 'The resolver starts at the top of the DNS tree. A root server does not know the answer, but it knows who handles **.com**.',
        },
        {
          from: 'Resolver', to: '.com server', label: 'Where is example.com?',
          note: 'The top-level domain (TLD) server for .com replies with the name servers responsible for `example.com`.',
        },
        {
          from: 'Resolver', to: 'example.com server', label: 'Address of www?',
          note: 'The **authoritative** server for example.com holds the real record and answers `www.example.com = 203.0.113.80` (a documentation address used in this lesson).',
        },
        {
          from: 'Resolver', to: 'Laptop', label: 'Answer, with a TTL',
          note: 'The resolver returns the address and caches it until the TTL runs out. The laptop can now open a connection to that IP address.',
        },
      ],
    },
    table(
      ['Record', 'What it maps'],
      [
        ['`A` and `AAAA`', 'A name to an IPv4 or IPv6 address'],
        ['`CNAME`', 'A name to another name (an alias)'],
        ['`MX`', 'A domain to its mail servers'],
        ['`NS`', 'A domain to its authoritative name servers'],
        ['`PTR`', 'An IP address back to a name (a reverse lookup)'],
        ['`TXT`', 'Free text, used for SPF, DKIM, DMARC and domain verification'],
      ],
    ),
    list(
      '**Cache poisoning.** Forged answers are planted in a resolver\'s cache so users are sent to the attacker\'s site.',
      '**DNS hijacking.** Changing the DNS settings on a router or device, or the records at the registrar.',
      '**DNS tunneling.** Hiding data (or a command channel) inside DNS queries to sneak past firewalls.',
      '**Amplification DDoS.** Tiny spoofed queries make open resolvers send big answers to a victim.',
      '**Zone transfer leaks.** An exposed zone transfer (AXFR) hands an attacker your whole list of hosts.',
      '**Lookalike domains.** Typosquatting and pharming steer users to fake sites.',
    ),
    secure('**DNSSEC** signs records so forged answers can be detected. **DoH and DoT** encrypt queries for privacy. Also: restrict zone transfers to named servers, disable open recursion, patch resolvers, rate limit responses, use DNS filtering or sinkholes to block known-bad domains, and log queries to spot tunneling.', 'Securing DNS'),

    h('ARP: IP to MAC on the local network'),
    p('To deliver a frame on the LAN, a device needs the MAC address that goes with an IP address. **ARP** (Address Resolution Protocol) finds it by asking everyone, and the owner answers.'),
    {
      type: 'sequence',
      title: 'ARP: who has this address?',
      steps: [
        {
          from: 'PC-A', to: 'Everyone (broadcast)', label: 'Who has 192.168.1.1?',
          note: 'PC-A wants to reach its gateway but does not know its MAC address. It broadcasts "Who has `192.168.1.1`? Tell `192.168.1.10`."',
        },
        {
          from: 'Router', to: 'PC-A', label: '192.168.1.1 is at cc:cc',
          note: 'The router replies directly to PC-A with its MAC address. PC-A stores the pair in its **ARP cache** and can now build frames for the gateway.',
        },
        {
          from: 'Attacker', to: 'PC-A', label: 'Forged reply',
          note: 'Here is the weakness: ARP has **no authentication**. An attacker can announce "`192.168.1.1` is at **my** MAC address" and PC-A will believe it, sending its gateway traffic to the attacker. That is **ARP poisoning**, and it gives the attacker an on-path position.',
        },
      ],
    },
    secure('**Dynamic ARP Inspection** makes switches check ARP replies against the DHCP snooping table. Also: static ARP entries for critical hosts such as the gateway, port security and 802.1X, segmentation, and encryption (TLS and VPNs) so intercepted traffic is useless. IPv6 uses NDP instead of ARP and has similar attacks, which **RA Guard** helps stop.', 'Stopping ARP poisoning'),

    h('ICMP: the network\'s messenger'),
    p('**ICMP** (Internet Control Message Protocol) reports errors and tests reachability. It rides on IP and has no ports, only message **types**. `ping` sends an echo request and waits for an echo reply. `traceroute` (`tracert` on Windows) sends packets with growing **TTL** values. Each router that drops one reports back, which reveals the path.'),
    list(
      '**Ping flood and Smurf.** Overwhelm a target with echo requests, or send a spoofed ping to a broadcast address so many hosts all reply to the victim.',
      '**ICMP tunneling.** Hiding data inside ICMP packets.',
      '**Reconnaissance.** Ping sweeps map which hosts are alive.',
      '**Redirects.** Forged ICMP redirect messages can reroute traffic.',
    ),
    secure('Rate limit ICMP, block redirects and directed broadcasts, and allow only the message types you need. **Do not block all ICMP**: path MTU discovery depends on it, and blocking it breaks some connections.', 'Handling ICMP safely'),
    table(
      ['Tool', 'What it shows'],
      [
        ['`ping`', 'Whether a host is reachable, and how long it takes'],
        ['`traceroute` / `tracert`', 'Each router on the path to a destination'],
        ['`nslookup` / `dig`', 'DNS answers, and which server gave them'],
        ['`ipconfig` / `ifconfig` / `ip addr`', 'Your own addresses, mask and gateway'],
        ['`arp -a`', 'The ARP cache'],
        ['`netstat` / `ss`', 'Connections and **listening ports**: how you check what is open on a host'],
        ['`nmap`', 'A port scan: which ports are open, closed or filtered'],
        ['Wireshark / `tcpdump`', 'Packet capture and analysis'],
      ],
      { caption: 'Tools worth knowing. Security+ expects you to match the tool to the job.' },
    ),

    h('NAT and PAT: sharing one public address'),
    p('Private addresses cannot be routed on the internet, so a router performing **NAT** (Network Address Translation) rewrites the source address of outgoing packets to its own public address and remembers the swap in a **translation table**. When the reply comes back, it swaps the address back. Most home routers use **PAT** (also called NAT overload), which lets many devices share **one** public IP by also tracking the source port.'),
    table(
      ['Inside address and port', 'Translated (public) address and port', 'Destination'],
      [
        ['`192.168.1.10:50123`', '`198.51.100.5:61001`', '`203.0.113.80:443`'],
        ['`192.168.1.11:50124`', '`198.51.100.5:61002`', '`203.0.113.80:443`'],
        ['`192.168.1.12:40022`', '`198.51.100.5:61003`', '`192.0.2.7:443`'],
      ],
      { caption: 'A PAT table. Three private devices share one public address and are told apart by the translated port.', mono: [0, 1, 2] },
    ),
    table(
      ['Type', 'What it does', 'Typical use'],
      [
        ['Static NAT', 'One private address always maps to one public address', 'Publishing an internal server'],
        ['Dynamic NAT', 'Private addresses map to a pool of public addresses', 'Larger organizations with several public IPs'],
        ['PAT (overload)', 'Many private addresses share one public address using ports', 'Home and small business routers'],
        ['Port forwarding (DNAT)', 'Inbound traffic to a public address and port is sent to an internal host', 'Letting the internet reach a game server or camera'],
      ],
    ),
    trap('**NAT is not a firewall.** It hides internal addresses and, as a side effect, drops unsolicited inbound traffic because no translation exists. But it makes no decisions about what is safe. Always pair it with real firewall rules.'),
    secure('Keep **firewall rules** alongside NAT. **Disable UPnP** on routers (malware and games use it to open ports on their own). Forward only the ports you truly need, to hardened servers, and avoid the home router "DMZ host" feature, which exposes a device completely.', 'Using NAT safely'),
    tip('**NTP** (UDP 123) keeps clocks in sync. Accurate time matters for logs, certificates and Kerberos (which fails if clocks drift by more than about five minutes), and NTP can be abused for amplification attacks. Use authenticated, internal time sources where you can.'),
    exam('Match the symptom to the helper: "devices got a strange gateway" is a rogue DHCP server, "users reach a fake site for the right name" is DNS poisoning, "traffic flows through the attacker on the LAN" is ARP poisoning, "one public IP shared by many hosts" is PAT.'),
    hSecure('The defenses at a glance'),
    table(
      ['Attack', 'Best defense'],
      [
        ['Rogue DHCP server, DHCP starvation', 'DHCP snooping, port security, 802.1X'],
        ['DNS cache poisoning and hijacking', 'DNSSEC, patched resolvers, DNS filtering, trusted resolvers'],
        ['DNS tunneling', 'DNS logging and monitoring, restricting outbound DNS to your own resolvers'],
        ['ARP poisoning', 'Dynamic ARP Inspection, 802.1X, segmentation, encryption'],
        ['ICMP floods and Smurf', 'Rate limiting, no directed broadcasts, ingress and egress filtering'],
        ['Exposed internal hosts behind NAT', 'A stateful firewall, no UPnP, minimal port forwarding'],
      ],
    ),
  ],
  check: [
    mcq(
      'A guest connects to Wi-Fi and receives a gateway address that belongs to an attacker\'s laptop. Which attack is this, and which switch feature helps stop it?',
      'A rogue DHCP server, stopped by DHCP snooping',
      ['ARP poisoning, stopped by a longer Wi-Fi password', 'DNS tunneling, stopped by DNSSEC', 'A Smurf attack, stopped by port forwarding'],
      'A rogue DHCP server hands out malicious settings. DHCP snooping only trusts DHCP server replies that come from approved ports.',
    ),
    mcq(
      'Which protocol finds the MAC address that goes with an IP address on the local network?',
      'ARP',
      ['DNS', 'DHCP', 'ICMP'],
      'ARP broadcasts "who has this IP?" and the owner replies with its MAC address. DNS resolves names, DHCP assigns addresses and ICMP reports errors.',
    ),
    mcq(
      'A home router lets twenty devices share one public IP address by tracking different source ports. What is this called?',
      'Port address translation (PAT)',
      ['Static NAT', 'Port mirroring', 'VLAN tagging'],
      'PAT, also called NAT overload, maps many private address and port pairs onto one public address.',
    ),
    mcq(
      'Which technology lets a resolver prove that a DNS answer is authentic and has not been forged?',
      'DNSSEC',
      ['DHCP snooping', 'Port security', 'NAT'],
      'DNSSEC signs DNS records so forged answers (cache poisoning) can be detected. It does not encrypt queries; DoH and DoT do that.',
    ),
  ],
};
