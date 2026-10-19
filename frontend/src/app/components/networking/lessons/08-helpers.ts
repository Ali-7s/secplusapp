import { LessonBody } from '../networking.model';
import { analogy, exam, examPbqs, h, hSecure, list, mcq, p, pbq, recap, secure, table, tip, trap, words } from './dsl';
import { DNS_ORDER, HELPERS_SYMPTOMS } from './practice';

export const HELPERS: LessonBody = {
  goals: [
    'Say what DHCP, DNS, ARP, ICMP and NAT each do, in one sentence each',
    'Walk through getting an address (DHCP) and looking up a name (DNS) step by step',
    'Explain how ARP works and why ARP poisoning is possible',
    'Explain NAT and PAT, and why NAT is not a firewall',
    'Name the attack that targets each helper and the defense that stops it',
  ],
  blocks: [
    recap('A device needs an **IP address**, a **subnet mask** and a **default gateway** (lesson 2). Data on the local network is delivered by **MAC address**, and a **broadcast** reaches every device on the local network (lessons 2 and 6). **Private addresses** are never sent across the internet (lesson 2).'),
    words(
      ['DHCP', 'The service that hands out IP addresses and settings to devices automatically'],
      ['Lease', 'How long a device may keep the address DHCP gave it before renewing'],
      ['DNS', 'The internet\'s phone book: turns names like www.example.com into IP addresses'],
      ['Domain name', 'A human-friendly name for something on the internet, such as example.com'],
      ['Resolver', 'The DNS server your device asks. It finds the answer for you and remembers it'],
      ['Cache', 'A short-term memory of recent answers, so the same question is not asked twice'],
      ['ARP', 'The protocol that finds the MAC address belonging to an IP address on the local network'],
      ['ICMP', 'The network\'s messenger: error reports and the "are you there?" test used by ping'],
      ['NAT', 'A router swapping private addresses for its public address on the way out, and back again'],
      ['PAT', 'The kind of NAT that lets many devices share one public address, by also swapping port numbers'],
      ['Rogue', 'Unauthorized: a device or server set up by an attacker or without permission'],
      ['On-path attack', 'An attacker secretly sitting between two devices so their traffic flows through the attacker'],
    ),

    p('Before your computer can load a single web page, a handful of quiet **helper protocols** have to do their jobs. You never see them, but almost every local network attack on the exam is an abuse of one of them. Here is the cast:'),
    table(
      ['Helper', 'The question it answers', 'Port', 'Typically attacked by'],
      [
        ['DHCP', '"What IP address, mask, gateway and DNS server should I use?"', 'UDP 67 and 68', 'Fake DHCP servers, and draining all the addresses'],
        ['DNS', '"What IP address belongs to this name?"', 'UDP and TCP 53', 'Fake answers, hijacked records, hiding data in lookups'],
        ['ARP', '"Which MAC address owns this IP address on my network?"', 'None (works directly on the local network)', 'ARP poisoning'],
        ['ICMP', '"Can you reach this device? What went wrong?"', 'None (rides directly on IP)', 'Floods, and mapping a network'],
        ['NAT', '"Can many private devices share one public address?"', 'None (a router feature)', 'Not attacked as such, but often mistaken for a firewall'],
      ],
    ),

    h('DHCP: getting an address'),
    p('A device that has just joined a network has no IP address yet, and it cannot talk properly without one. **DHCP** (Dynamic Host Configuration Protocol) solves this. A DHCP server on the network (often built into the router) hands out an address, the subnet mask, the default gateway and the DNS server to use, all at once. The address is a **lease**: the device may keep it for a set time (say 8 hours) and must renew it to keep using it.'),
    p('The exchange has four steps, remembered as **DORA**: Discover, Offer, Request, Acknowledge.'),
    {
      type: 'sequence',
      title: 'DHCP: Discover, Offer, Request, Acknowledge',
      steps: [
        {
          from: 'New device', to: 'Everyone (broadcast)', label: 'Discover',
          note: 'The device has no address and does not know where the DHCP server is, so it **broadcasts** to the whole local network: "Is there a DHCP server out there?" It uses the special source address `0.0.0.0` ("I have no address yet") and the destination `255.255.255.255` ("everyone").',
        },
        {
          from: 'DHCP server', to: 'Device', label: 'Offer',
          note: 'A server replies with an offer: "How about `192.168.1.50`, mask `255.255.255.0`, gateway `192.168.1.1` and DNS server `192.168.1.1`, for 8 hours?"',
        },
        {
          from: 'Device', to: 'Everyone (broadcast)', label: 'Request',
          note: 'The device accepts: "I will take that one." It broadcasts this too, so any other server that made an offer knows it was not chosen.',
        },
        {
          from: 'DHCP server', to: 'Device', label: 'Acknowledge',
          note: 'The server confirms, and the lease begins. The device will try to renew it halfway through the lease.',
        },
      ],
    },
    p('Notice the weakness: the device takes the **first** offer it gets, from anyone. That leads to two attacks:'),
    list(
      '**Rogue DHCP server.** An attacker runs their own DHCP server and answers first. They hand out a gateway or DNS server that points to the attacker\'s own machine, so victims send their traffic through the attacker. That is an **on-path attack** (an attacker secretly sitting in the middle of a conversation).',
      '**DHCP starvation.** The attacker pretends to be thousands of new devices (using fake MAC addresses) and requests every address the server has, so real devices cannot get one. Often this is followed by a rogue server to "help" them.',
    ),
    secure('Turn on **DHCP snooping** on the switches. You tell the switch which ports lead to the real DHCP server; DHCP offers arriving on any other port are dropped, and the number of requests from one port is limited. Also use **port security** and **802.1X** (lesson 6) so unknown devices never get on the network, and watch for DHCP servers that should not exist.', 'Stopping rogue DHCP'),

    h('DNS: turning names into addresses'),
    p('People remember names; computers need numbers. A **domain name** like `www.example.com` is easy to type, but to connect, your device needs the IP address behind it. **DNS** (Domain Name System) is the internet\'s phone book: you give it a name, and it gives you the address.'),
    p('Your device does not search the whole internet itself. It asks one DNS server, called a **resolver** (usually provided by your router or your ISP), and the resolver does the legwork. The resolver keeps recent answers in a **cache** (a short-term memory) so it can answer the same question instantly next time. Each answer comes with a **TTL** (time to live): how many seconds it may be remembered before it must be looked up again.'),
    p('Names are read from right to left, like an address from country down to house: `.com` is the top level, `example.com` is a domain inside it, and `www.example.com` is one name inside that domain. A full lookup walks down that tree:'),
    {
      type: 'sequence',
      title: 'A DNS lookup, step by step',
      steps: [
        {
          from: 'Laptop', to: 'Resolver', label: 'www.example.com?',
          note: 'The laptop asks its resolver for the address. If the resolver already has the answer in its cache, it replies immediately and the rest of these steps are skipped.',
        },
        {
          from: 'Resolver', to: 'Root server', label: 'Where is .com?',
          note: 'The resolver starts at the top of the tree. A **root server** does not know the answer, but it knows which servers are in charge of **.com**.',
        },
        {
          from: 'Resolver', to: '.com server', label: 'Where is example.com?',
          note: 'The server for `.com` (called a top-level domain or **TLD** server) replies with the servers in charge of `example.com`.',
        },
        {
          from: 'Resolver', to: 'example.com server', label: 'Address of www?',
          note: 'The server in charge of example.com is called its **authoritative** server, because it holds the real records. It answers `www.example.com = 203.0.113.80` (an address reserved for examples like this lesson).',
        },
        {
          from: 'Resolver', to: 'Laptop', label: 'Answer, with a TTL',
          note: 'The resolver hands the address back to the laptop and caches it until the TTL runs out. The laptop can now connect to that IP address.',
        },
      ],
    },
    pbq('Try it: put the lookup in order', DNS_ORDER),
    p('DNS holds several kinds of **record** (entry), each mapping a name to a different kind of information:'),
    table(
      ['Record', 'What it maps'],
      [
        ['`A` and `AAAA`', 'A name to an IPv4 address (A) or an IPv6 address (AAAA)'],
        ['`CNAME`', 'A name to another name (a nickname, or alias)'],
        ['`MX`', 'A domain to the mail servers that receive its email'],
        ['`NS`', 'A domain to the name servers that are in charge of it'],
        ['`PTR`', 'An IP address back to a name (a "reverse" lookup)'],
        ['`TXT`', 'Free text. Used to publish email security settings (SPF, DKIM, DMARC) and to prove you own a domain'],
      ],
    ),
    p('DNS was designed when the internet was a friendly place, so it trusts answers easily. The main attacks:'),
    list(
      '**Cache poisoning.** The attacker gets a fake answer stored in a resolver\'s cache, so everyone using that resolver is sent to the attacker\'s site when they type the real name.',
      '**DNS hijacking.** Changing which DNS server a device or router uses, or changing the domain\'s records at the **registrar** (the company where the domain name was bought).',
      '**DNS tunneling.** Hiding stolen data or secret commands inside DNS lookups, because firewalls almost always let DNS through.',
      '**Amplification attacks.** The attacker sends small lookups with the victim\'s address faked as the sender. The servers send much larger answers to the victim, flooding them.',
      '**Zone transfer leaks.** A zone transfer copies all of a domain\'s records from one DNS server to another. If anyone can request one, the attacker gets a full list of your systems.',
      '**Lookalike domains.** **Typosquatting** registers misspellings of real names (`exmaple.com`) to catch typing mistakes, and **pharming** redirects users from the real site to a fake one.',
    ),
    secure('**DNSSEC** adds digital signatures to DNS records, so a resolver can tell a forged answer from a real one. **DoH and DoT** (DNS over HTTPS and DNS over TLS) encrypt lookups so others cannot see or change them. Also: allow zone transfers only to your own named servers, do not answer lookups for strangers on the internet (no "open recursion"), patch DNS servers, limit how many answers one source can get, block known malicious domains (**DNS filtering**, or a **sinkhole** that sends them nowhere), and log lookups to spot tunneling.', 'Securing DNS'),

    h('ARP: finding the MAC address'),
    p('Here is a gap from lesson 6: to deliver a frame on the local network, a device needs the destination\'s **MAC address**, but usually it only knows the **IP address**. Even to reach the internet, it needs the MAC address of its default gateway. **ARP** (Address Resolution Protocol) fills the gap by shouting a question to everyone, and the owner answers.'),
    {
      type: 'sequence',
      title: 'ARP: who has this address?',
      steps: [
        {
          from: 'PC-A', to: 'Everyone (broadcast)', label: 'Who has 192.168.1.1?',
          note: 'PC-A wants to reach its gateway, `192.168.1.1`, but does not know its MAC address. It broadcasts: "Who has `192.168.1.1`? Tell `192.168.1.10`."',
        },
        {
          from: 'Router', to: 'PC-A', label: '192.168.1.1 is at cc:cc',
          note: 'The router replies directly to PC-A with its MAC address. PC-A stores the pair in its **ARP cache** (its memory of IP to MAC pairs) and can now send frames to the gateway.',
        },
        {
          from: 'Attacker', to: 'PC-A', label: 'Fake reply',
          note: 'Here is the weakness: ARP has **no way to check** who is answering. An attacker can announce "`192.168.1.1` is at **my** MAC address", and PC-A will believe it and send all its internet traffic to the attacker. That is **ARP poisoning**, and it gives the attacker an on-path position.',
        },
      ],
    },
    secure('**Dynamic ARP Inspection (DAI)** makes the switch check every ARP reply against the list of genuine address assignments that DHCP snooping recorded, and drop fakes. Also: fixed (static) ARP entries for critical devices such as the gateway, port security and 802.1X, segmentation (lesson 7), and encryption (HTTPS and VPNs) so that even intercepted traffic is unreadable. IPv6 uses a different protocol, **NDP**, for the same job and has similar attacks; a switch feature called **RA Guard** helps block them.', 'Stopping ARP poisoning'),

    h('ICMP: the network\'s messenger'),
    p('**ICMP** (Internet Control Message Protocol) carries the network\'s status messages: "that address cannot be reached", "this packet expired on the way", "are you there?" "yes I am". It has no ports. Instead each message has a **type** that says what it is.'),
    p('Two everyday tools use it:'),
    list(
      '**ping** sends an ICMP "echo request" ("are you there?") and waits for an "echo reply". It tells you whether a device is reachable and how long the round trip takes.',
      '**traceroute** (`tracert` on Windows) shows every router on the path to a destination. Every IP packet carries a counter called its **TTL** (time to live, different from the DNS TTL above), and each router lowers it by one; when it hits zero, the router drops the packet and sends back an ICMP message saying so. Traceroute sends packets with a TTL of 1, then 2, then 3, so each router along the way reveals itself in turn.',
    ),
    p('The attacks on ICMP:'),
    list(
      '**Ping floods and Smurf attacks.** Overwhelm a target with echo requests, or send one fake ping (with the victim\'s address as the sender) to a whole network\'s broadcast address, so every device there replies to the victim at once.',
      '**ICMP tunneling.** Hiding data inside ICMP messages to sneak it past firewalls.',
      '**Mapping the network.** A **ping sweep** pings every address in a range to see which devices are alive, a first step before an attack.',
      '**Fake redirects.** An ICMP redirect tells a device "use a different router". A forged one can send traffic through the attacker.',
    ),
    secure('Limit how much ICMP any one source can send, block redirects and broadcasts aimed at whole networks, and allow only the message types you need. But **do not block all ICMP**. Every link has a **maximum packet size** (its MTU), and devices discover the right size through ICMP "packet too big" messages. Block those, and some connections mysteriously stall.', 'Handling ICMP safely'),
    p('Security+ expects you to match a command line tool to its job. These are the ones to know:'),
    table(
      ['Tool', 'What it shows'],
      [
        ['`ping`', 'Whether a device is reachable, and how long a round trip takes'],
        ['`traceroute` / `tracert`', 'Each router on the path to a destination'],
        ['`nslookup` / `dig`', 'DNS answers for a name, and which server gave them'],
        ['`ipconfig` / `ifconfig` / `ip addr`', 'Your own IP address, mask and gateway'],
        ['`arp -a`', 'Your ARP cache: the IP to MAC pairs your device remembers'],
        ['`netstat` / `ss`', 'Your device\'s current connections and **listening ports**: how you check what is open on a machine'],
        ['`nmap`', 'A port scan of another device: which ports are open, closed or filtered (lesson 3)'],
        ['Wireshark / `tcpdump`', 'Captures packets so you can read their headers and contents'],
      ],
      { caption: 'Windows names come first where the tools differ (ipconfig, tracert), Linux and Mac names second.' },
    ),

    h('NAT and PAT: sharing one public address'),
    p('Lesson 2 said **private addresses** (such as `192.168.x.x`) are never sent across the internet. So how does your laptop, with a private address, load a website? Your router uses **NAT** (Network Address Translation). On the way out, it replaces the private source address in each packet with its own **public** address, and writes down the swap in a **translation table**. When the reply comes back, it looks up the table and swaps the address back, so the reply reaches the right device.'),
    p('A home has many devices but only one public address. To tell their conversations apart, the router also swaps the **source port number**, giving each conversation its own port. This version is called **PAT** (port address translation, also known as NAT overload), and it is what nearly every home and small office router does:'),
    table(
      ['Inside address and port', 'Becomes (public address and port)', 'Talking to'],
      [
        ['`192.168.1.10:50123`', '`198.51.100.5:61001`', '`203.0.113.80:443`'],
        ['`192.168.1.11:50124`', '`198.51.100.5:61002`', '`203.0.113.80:443`'],
        ['`192.168.1.12:40022`', '`198.51.100.5:61003`', '`192.0.2.7:443`'],
      ],
      { caption: 'A PAT translation table. Three private devices share one public address and are told apart by the port the router gave each conversation.', mono: [0, 1, 2] },
    ),
    analogy('A company switchboard. Everyone in the office calls out through one main phone number. The switchboard notes which desk made each call, so when someone calls back, it can put them through to the right desk.'),
    table(
      ['Type', 'What it does', 'Typical use'],
      [
        ['Static NAT', 'One private address always maps to the same public address', 'Making one internal server reachable from the internet'],
        ['Dynamic NAT', 'Private addresses share a pool of public addresses', 'Larger organizations with several public addresses'],
        ['PAT (NAT overload)', 'Many private addresses share one public address, told apart by port', 'Home and small business routers'],
        ['Port forwarding (DNAT)', 'Incoming traffic to one public port is sent on to one internal device', 'Letting the internet reach a game server or a camera at home'],
      ],
    ),
    trap('**NAT is not a firewall.** NAT hides internal addresses, and as a side effect it drops incoming traffic nobody asked for, because there is no matching entry in the table. But it makes no decisions about what is safe. Always pair it with real firewall rules.'),
    secure('Keep real **firewall rules** alongside NAT. **Turn off UPnP** on routers: it is a feature that lets programs on your network open ports to the internet by themselves, and malware uses it. Forward only the ports you truly need, to hardened devices, and avoid the home router "DMZ host" setting, which exposes one device completely to the internet.', 'Using NAT safely'),
    tip('One more helper: **NTP** (network time protocol, UDP 123) keeps every device\'s clock in sync. Accurate time matters for logs (to line up events from different devices), for certificates, and for **Kerberos**, the Windows sign-in system, which refuses logins if clocks differ by more than about five minutes. NTP can also be abused for amplification attacks, so use trusted internal time servers where you can.'),
    exam('Match the symptom to the helper: "devices got a strange gateway" is a rogue DHCP server, "users reach a fake site even though they typed the right name" is DNS poisoning, "traffic on the local network flows through the attacker" is ARP poisoning, and "one public IP address shared by many devices" is PAT.'),

    pbq('Try it: diagnose the symptom', HELPERS_SYMPTOMS),

    hSecure('The defenses at a glance'),
    table(
      ['Attack', 'Best defense'],
      [
        ['Rogue DHCP server, DHCP starvation', 'DHCP snooping, port security, 802.1X'],
        ['DNS cache poisoning and hijacking', 'DNSSEC, patched DNS servers, DNS filtering, trusted resolvers, registrar account protection'],
        ['DNS tunneling', 'Logging and watching DNS lookups, and only allowing outgoing DNS to your own resolvers'],
        ['ARP poisoning', 'Dynamic ARP Inspection, 802.1X, segmentation, encryption'],
        ['ICMP floods and Smurf attacks', 'Limiting ICMP, blocking broadcasts to whole networks, filtering fake source addresses'],
        ['Exposed devices behind NAT', 'A stateful firewall (lesson 9), UPnP turned off, as little port forwarding as possible'],
      ],
    ),
    examPbqs('helpers'),
  ],
  check: [
    mcq(
      'A guest connects to Wi-Fi and receives a gateway address that belongs to an attacker\'s laptop. Which attack is this, and which switch feature helps stop it?',
      'A rogue DHCP server, stopped by DHCP snooping',
      ['ARP poisoning, stopped by a longer Wi-Fi password', 'DNS tunneling, stopped by DNSSEC', 'A Smurf attack, stopped by port forwarding'],
      'A rogue DHCP server hands out malicious settings. DHCP snooping only trusts DHCP offers that arrive on approved ports.',
    ),
    mcq(
      'Which protocol finds the MAC address that goes with an IP address on the local network?',
      'ARP',
      ['DNS', 'DHCP', 'ICMP'],
      'ARP broadcasts "who has this IP address?" and the owner replies with its MAC address. DNS turns names into addresses, DHCP hands out addresses and ICMP carries status and error messages.',
    ),
    mcq(
      'A home router lets twenty devices share one public IP address by giving each conversation a different port. What is this called?',
      'Port address translation (PAT)',
      ['Static NAT', 'Port mirroring', 'VLAN tagging'],
      'PAT, also called NAT overload, maps many private address and port pairs onto one public address.',
    ),
    mcq(
      'Which technology lets a resolver prove that a DNS answer is genuine and has not been forged?',
      'DNSSEC',
      ['DHCP snooping', 'Port security', 'NAT'],
      'DNSSEC signs DNS records so forged answers (cache poisoning) can be detected. It does not encrypt lookups; DoH and DoT do that.',
    ),
  ],
};
