import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, mcq, p, table, tip } from './dsl';

export const DEVICES: LessonBody = {
  goals: [
    'Say what a hub, switch, router, Layer 3 switch and access point each look at',
    'Explain how a switch learns MAC addresses and what it does with unknown destinations and broadcasts',
    'Tell a collision domain from a broadcast domain',
    'Explain why MAC addresses change at every hop but IP addresses do not',
    'Name the main attacks on switches and routers, and the defenses',
  ],
  blocks: [
    p('The whole pile of boxes comes down to one question: **what does the device look at to decide where traffic goes?**'),
    analogy('An office building. A **hub** is someone shouting every message to the whole room. A **switch** is a receptionist who knows which desk everyone sits at and walks each note straight to the right person. A **router** is the mailroom that sends mail between different buildings using their street addresses.'),
    table(
      ['Device', 'Layer', 'Looks at', 'What it does'],
      [
        ['Hub', '1', 'Nothing', 'Repeats every signal out of every other port. Obsolete, and everyone can see everyone\'s traffic'],
        ['Switch', '2', 'Destination MAC address', 'Learns which MAC address is on which port and forwards frames only there'],
        ['Router', '3', 'Destination IP address', 'Connects different networks and picks the next hop from its routing table'],
        ['Layer 3 switch', '2 and 3', 'MAC and IP', 'A switch that can also route between VLANs at high speed'],
        ['Wireless access point', '2', 'MAC address', 'Bridges Wi-Fi devices onto the wired network. Think of a switch port without a cable'],
        ['Modem', '1', 'Signals', 'Converts between your provider\'s cable, DSL or fiber and Ethernet'],
        ['Firewall', '3 to 7', 'IPs, ports, state, applications', 'Allows or blocks traffic by rules (lesson 8)'],
      ],
    ),

    h('How a switch learns'),
    p('A switch keeps a **MAC address table** (also called a CAM table) listing which MAC address lives on which port. Nobody types it in. The switch builds it by watching traffic.'),
    {
      type: 'sequence',
      title: 'Watch a switch learn',
      steps: [
        {
          from: 'PC-A', to: 'Switch', label: 'Frame for PC-B',
          note: 'PC-A (MAC `aa`) sends a frame to PC-B (MAC `bb`). The switch reads the **source** address and writes down "aa is on port 1". It does not know where `bb` is yet.',
          table: { title: 'MAC address table now', columns: ['MAC address', 'Port'], rows: [['aa', '1']] },
        },
        {
          from: 'Switch', to: 'PC-B and PC-C', label: 'Flooded',
          note: 'For an **unknown** destination the switch **floods** the frame out of every port except the one it arrived on. PC-C receives it too, but ignores it because it is not addressed to PC-C.',
        },
        {
          from: 'PC-B', to: 'Switch', label: 'Reply to PC-A',
          note: 'PC-B answers. The switch learns "bb is on port 2". It already knows `aa` is on port 1, so it sends this reply **only** out of port 1.',
          table: { title: 'MAC address table now', columns: ['MAC address', 'Port'], rows: [['aa', '1'], ['bb', '2']] },
        },
        {
          from: 'PC-A', to: 'PC-B', label: 'Switched directly',
          note: 'From now on, frames between A and B go only to the right ports and PC-C sees nothing. This is why switches beat hubs for both speed and privacy.',
        },
      ],
    },
    tip('A **broadcast** frame (destination `ff:ff:ff:ff:ff:ff`) always goes out of every port. ARP depends on this (lesson 7).'),

    h('Collision domains and broadcast domains'),
    p('Two terms the exam likes. A **collision domain** is the group of devices that share the same wire and can interfere with each other. A **broadcast domain** is the group of devices that all receive each other\'s broadcasts.'),
    table(
      ['Device', 'Collision domains', 'Broadcast domains'],
      [
        ['Hub', 'One for all its ports', 'One'],
        ['Switch', 'One **per port**', 'One (unless you use VLANs)'],
        ['Router', 'One per interface', 'One **per interface**'],
      ],
    ),
    p('So a switch cuts up collisions but still forwards broadcasts everywhere. Only a **router** (or a VLAN) splits a broadcast domain.'),

    h('What a router does'),
    p('A router connects **different networks**. It has an IP address on each network it touches. When a packet arrives, the router reads the destination IP address, finds the best match in its **routing table**, and forwards the packet to the **next hop**. Routers do not forward broadcasts.'),
    table(
      ['Destination', 'Next hop', 'Out of interface'],
      [
        ['`192.168.1.0/24`', 'Directly connected', 'LAN'],
        ['`10.0.0.0/8`', '`192.168.1.254`', 'LAN'],
        ['`0.0.0.0/0` (default route)', 'The provider\'s router', 'WAN'],
      ],
      { caption: 'A tiny routing table. The most specific match wins, and the default route catches everything else.', mono: [0, 1] },
    ),
    p('Routes come from three places: networks the router is **directly connected** to, **static routes** an administrator types in, and **dynamic routing protocols** (such as OSPF inside a company and BGP between internet providers).'),

    h('The key idea: MAC addresses change at every hop, IP addresses do not'),
    p('This is the one fact that finally separates "switch" from "router". Follow a packet from your PC to a server on another network.'),
    table(
      ['Where the frame is', 'Source MAC', 'Destination MAC', 'Source IP', 'Destination IP'],
      [
        ['On your LAN (PC to router)', 'Your PC', 'The router (your gateway)', 'Your PC', 'The server'],
        ['Across the provider link (router to next router)', 'Your router', 'The next router', 'Your PC*', 'The server'],
        ['On the server\'s LAN (last router to server)', 'The last router', 'The server', 'Your PC*', 'The server'],
      ],
      { caption: 'The MAC addresses are rewritten at every router. The IP addresses stay the same all the way (*unless NAT rewrites the source, lesson 7).' },
    ),
    exam('**Switch = MAC. Router = IP.** MAC addresses only matter on the local link, while IP addresses travel end to end.'),

    hSecure('How to secure it: switches and routers'),
    p('Switches and routers are favorite targets because whoever controls them controls the traffic. First, the attacks:'),
    table(
      ['Attack', 'What happens', 'The defense'],
      [
        ['MAC flooding', 'Fake source MAC addresses overflow the switch table, so it floods traffic like a hub and the attacker can sniff it', '**Port security**: limit the MAC addresses per port'],
        ['ARP poisoning', 'Forged ARP replies make the attacker the "gateway" (an on-path attack)', '**Dynamic ARP Inspection** together with DHCP snooping'],
        ['VLAN hopping', 'The attacker reaches VLANs they should not (lesson 6)', 'Disable trunk negotiation and change the native VLAN'],
        ['Spanning tree attack', 'A rogue switch claims to be the root bridge and attracts traffic', '**BPDU Guard** and **Root Guard** on edge ports'],
        ['Rogue device or access point', 'Someone plugs in an unapproved switch or Wi-Fi router', '**802.1X / NAC**, disabled unused ports, port security'],
        ['Router attacks', 'Default logins, exposed management, forged routing updates, source routing', 'Hardening (below), ACLs and authenticated routing'],
      ],
    ),
    {
      type: 'harden',
      title: 'Harden a switch',
      intro: 'Tap each item as you work through it. Each one says what to do and why it matters.',
      items: [
        { action: 'Change default credentials and use individual accounts with central authentication (AAA)', why: 'Default passwords are published online. Individual accounts leave an audit trail, and a central RADIUS or TACACS+ server lets you remove access in one place.' },
        { action: 'Manage it with SSH and HTTPS only, from a management network', why: 'Telnet and plain HTTP send passwords in clear text. Limiting where management is allowed from (a management VLAN, an ACL on the login lines, a jump server) shrinks the number of people who can even try.', example: 'transport input ssh' },
        { action: 'Shut down unused ports and park them in an unused VLAN', why: 'An empty wall jack is an open door. A disabled port cannot be used to plug in a rogue device.', example: 'shutdown' },
        { action: 'Turn on port security', why: 'It limits how many MAC addresses a port may learn and can shut the port on a violation. That stops MAC flooding and unknown devices.' },
        { action: 'Use 802.1X on user-facing ports', why: 'A device must authenticate before it gets any network access, so a stranger cannot just plug in.' },
        { action: 'Enable DHCP snooping, Dynamic ARP Inspection and IP source guard', why: 'Snooping marks which ports may host a DHCP server, and DAI uses that table to drop forged ARP replies. Together they stop rogue DHCP servers and ARP poisoning.' },
        { action: 'Protect spanning tree with BPDU Guard on edge ports, plus Root Guard', why: 'A port that receives a BPDU (a message only switches send) from a user device is shut down, so nobody can slip in a rogue switch and become the root.' },
        { action: 'Set ports to access or trunk explicitly, disable trunk negotiation (DTP), and move the native VLAN off VLAN 1', why: 'This blocks VLAN hopping through switch spoofing and double tagging.' },
        { action: 'Turn off discovery protocols (CDP and LLDP) on edge ports', why: 'They announce the device model and software version to anything plugged in, which helps an attacker pick an exploit.' },
        { action: 'Use SNMPv3, keep the clock in sync (NTP) and send logs to a central server', why: 'SNMP v1 and v2c use a shared "community string" in plain text. Correct time and central logs are what make an investigation possible.' },
        { action: 'Patch the firmware and keep an encrypted backup of the configuration', why: 'Switch firmware has vulnerabilities like any software, and a backup lets you restore quickly and compare against your approved baseline.' },
        { action: 'Lock the wiring closet', why: 'Physical access to a switch, especially its console port, can bypass many software controls.' },
      ],
    },
    {
      type: 'harden',
      title: 'Harden a router',
      items: [
        { action: 'Change defaults and use strong, centrally managed accounts', why: 'Same reasons as for switches. Use a strong hashed "enable secret" instead of a plaintext password.' },
        { action: 'Turn off services you do not use', why: 'Every running service is attack surface: the router\'s web server (use HTTPS if you need it), Telnet, finger, TFTP and BOOTP servers, and similar legacy services.' },
        { action: 'Disable IP source routing, directed broadcasts and ICMP redirects', why: 'Source routing lets a sender dictate the path (useful to attackers), directed broadcasts enable Smurf amplification, and ICMP redirects can be abused to reroute traffic.' },
        { action: 'Filter at the edge with ingress and egress filtering', why: 'Drop packets from the internet that claim private or internal source addresses (they are spoofed), and stop your own network from sending spoofed packets out.' },
        { action: 'Restrict who can reach the management plane', why: 'Apply an ACL on the login lines so only administrator addresses can connect, and prefer a separate out-of-band management network.' },
        { action: 'Authenticate routing protocol updates', why: 'Use authentication (MD5 or SHA keys) for OSPF and similar protocols, and filter the routes you accept from internet providers (BGP), so a forged update cannot hijack your traffic.' },
        { action: 'Set session timeouts, a login banner and login-attempt limits', why: 'An idle administrator session left open is an invitation, and lockouts slow down password guessing.' },
        { action: 'Keep firmware current, log to a central server and back up configurations', why: 'Same as switches. Routers sit on the edge of the network and are scanned constantly.' },
      ],
    },
  ],
  check: [
    mcq(
      'Which device decides where to forward a frame by looking at the destination MAC address?',
      'A switch',
      ['A router', 'A hub', 'A proxy server'],
      'A switch works at Layer 2 and keeps a table of MAC addresses and ports. A router uses IP addresses, and a hub does not look at addresses at all.',
    ),
    mcq(
      'A switch\'s MAC table fills up with thousands of fake entries and it starts sending all traffic out of every port. Which attack is this, and which control stops it?',
      'MAC flooding, stopped by port security',
      ['ARP poisoning, stopped by a stateful firewall', 'VLAN hopping, stopped by a longer password', 'A SYN flood, stopped by DHCP snooping'],
      'MAC flooding overflows the table so the switch falls back to hub-like flooding. Port security limits the MAC addresses allowed per port.',
    ),
    mcq(
      'PC1 sends data to a server on another network. What changes as the frame crosses each router?',
      'The source and destination MAC addresses',
      ['The destination IP address', 'The destination port number', 'Nothing at all'],
      'Routers rewrite the MAC addresses on every hop because MAC addresses only matter on the local link. The IP addresses stay the same end to end, unless NAT rewrites them.',
    ),
    mcq(
      'Which setting stops a user from plugging a rogue switch into an edge port and taking over spanning tree?',
      'BPDU Guard',
      ['A longer SSH key', 'A larger MAC address table', 'Disabling HTTPS on the router'],
      'BPDU Guard shuts down an edge port that receives spanning-tree messages, which only switches should send.',
    ),
  ],
};
