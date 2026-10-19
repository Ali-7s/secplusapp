import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, mcq, p, recap, table, tip, words } from './dsl';

export const DEVICES: LessonBody = {
  goals: [
    'Say what a hub, switch, router, Layer 3 switch and access point each look at',
    'Explain how a switch learns MAC addresses and what it does with unknown destinations and broadcasts',
    'Tell a collision domain from a broadcast domain',
    'Explain why MAC addresses change at every hop but IP addresses do not',
    'Name the main attacks on switches and routers, and the defenses',
  ],
  blocks: [
    recap('**MAC addresses** deliver data on the local network and **IP addresses** get it across networks (lesson 2). Data on the local network travels as a **frame**: a packet wrapped with MAC addresses (lesson 4). A **broadcast** reaches every device on the local network at once (lesson 2).'),
    words(
      ['Hub', 'An obsolete box that repeats every signal out of every socket, to everyone'],
      ['Switch', 'A box that learns which device is plugged into which socket and sends each frame only where it belongs'],
      ['Router', 'A box that joins different networks and forwards packets between them using IP addresses'],
      ['Interface (port)', 'One socket or connection on a network device. Each switch socket is a "port"'],
      ['MAC address table', 'The switch\'s list of which MAC address is on which of its ports (also called the CAM table)'],
      ['Flooding', 'Sending a frame out of every port because the switch does not know where it belongs'],
      ['Collision', 'Two devices talking on the same shared wire at once, garbling each other'],
      ['Routing table', 'A router\'s list of networks it knows about and where to send packets for each'],
      ['Next hop', 'The next router a packet should be handed to on its way'],
      ['Spanning tree (STP)', 'A protocol switches use to stop traffic going round in loops forever'],
      ['On-path attack', 'An attacker secretly placing themselves between two devices so traffic flows through them'],
      ['Hardening', 'Locking a device down: removing what is not needed and securing what is (lesson 11)'],
    ),

    p('There are several kinds of network box, and they are easy to mix up. They all come down to one question: **what does the device look at to decide where traffic goes?**'),
    analogy('An office building. A **hub** is someone shouting every message across the whole room. A **switch** is a receptionist who knows which desk everyone sits at and walks each note straight to the right person. A **router** is the mailroom that sends mail out to other buildings, using their street addresses.'),
    table(
      ['Device', 'Layer', 'Looks at', 'What it does'],
      [
        ['Hub', '1', 'Nothing', 'Repeats every signal out of every other port. Obsolete, and everyone can see everyone\'s traffic'],
        ['Switch', '2', 'Destination MAC address', 'Learns which MAC address is on which port and sends frames only there'],
        ['Router', '3', 'Destination IP address', 'Joins different networks and decides where to send each packet next'],
        ['Layer 3 switch', '2 and 3', 'MAC and IP', 'A switch that can also route between networks, very quickly'],
        ['Wireless access point', '2', 'MAC address', 'Lets Wi-Fi devices join the wired network. Think of it as a switch port without a cable'],
        ['Modem', '1', 'Signals', 'Converts your provider\'s cable, phone line or fiber signal into normal Ethernet'],
        ['Firewall', '3 to 7', 'Addresses, ports, connections, applications', 'Allows or blocks traffic according to rules (lesson 9)'],
      ],
    ),

    h('How a switch learns'),
    p('A switch keeps a **MAC address table**: a list of which MAC address lives on which of its ports. Nobody types this list in. The switch builds it on its own by watching the traffic go by. Step through it:'),
    {
      type: 'sequence',
      title: 'Watch a switch learn',
      steps: [
        {
          from: 'PC-A', to: 'Switch', label: 'Frame for PC-B',
          note: 'PC-A (MAC address `aa`) sends a frame to PC-B (MAC address `bb`). The switch reads the **source** address and writes down "aa is on port 1". It does not know where `bb` is yet.',
          table: { title: 'MAC address table now', columns: ['MAC address', 'Port'], rows: [['aa', '1']] },
        },
        {
          from: 'Switch', to: 'PC-B and PC-C', label: 'Flooded',
          note: 'When the destination is **unknown**, the switch **floods** the frame: it sends a copy out of every port except the one it came in on. PC-C receives it too, but ignores it because it is not addressed to PC-C.',
        },
        {
          from: 'PC-B', to: 'Switch', label: 'Reply to PC-A',
          note: 'PC-B answers. The switch learns "bb is on port 2". It already knows `aa` is on port 1, so it sends this reply **only** out of port 1.',
          table: { title: 'MAC address table now', columns: ['MAC address', 'Port'], rows: [['aa', '1'], ['bb', '2']] },
        },
        {
          from: 'PC-A', to: 'PC-B', label: 'Switched directly',
          note: 'From now on, frames between A and B go only to the right ports, and PC-C sees nothing. This is why switches beat hubs for both speed and privacy.',
        },
      ],
    },
    tip('A **broadcast** frame (sent to the special MAC address `ff:ff:ff:ff:ff:ff`, meaning "everyone") always goes out of every port. Several helper protocols depend on broadcasts, such as ARP and DHCP (lesson 8).'),

    h('Collision domains and broadcast domains'),
    p('Two terms the exam likes to test.'),
    p('A **collision** happens when two devices on a shared wire talk at the same moment and garble each other, like two people talking over each other on a walkie-talkie. A **collision domain** is the group of devices that can collide with each other. On a hub, everyone shares one wire, so everyone is in one collision domain. On a switch, each port is its own private link, so collisions only ever involve one device and the switch.'),
    p('A **broadcast domain** is the group of devices that all receive each other\'s broadcasts. A switch forwards broadcasts out of every port, so everything plugged into one switch (or a chain of switches) is one broadcast domain. A router does **not** forward broadcasts, so a router is where a broadcast domain ends.'),
    table(
      ['Device', 'Collision domains', 'Broadcast domains'],
      [
        ['Hub', 'One, shared by all its ports', 'One'],
        ['Switch', 'One **per port**', 'One (unless you split it with VLANs, lesson 7)'],
        ['Router', 'One per interface', 'One **per interface**'],
      ],
    ),
    p('So a switch splits up collision domains but still passes broadcasts everywhere. Only a **router** (or a VLAN, lesson 7) splits a broadcast domain. In practice, a broadcast domain is the same thing as a subnet.'),

    h('What a router does'),
    p('A router joins **different networks**. It has a separate connection (an **interface**) and its own IP address on each network it touches. When a packet arrives, the router reads the destination IP address, looks it up in its **routing table** (its list of known networks and where to send packets for each), and hands the packet to the **next hop**: either the destination itself or the next router along the way.'),
    table(
      ['Destination network', 'Next hop', 'Out of interface'],
      [
        ['`192.168.1.0/24`', 'Directly connected', 'LAN'],
        ['`10.0.0.0/8`', '`192.168.1.254`', 'LAN'],
        ['`0.0.0.0/0` (default route)', 'The provider\'s router', 'WAN'],
      ],
      { caption: 'A tiny routing table. The most specific match wins, and the default route (0.0.0.0/0, "everything else") catches whatever is left.', mono: [0, 1] },
    ),
    p('The **default route** is the router\'s version of a default gateway: "if I do not know a better path, send it here", usually toward the internet. A router learns its routes in three ways: networks it is **directly connected** to, **static routes** an administrator types in, and **dynamic routing protocols**, where routers tell each other which networks they can reach (examples: **OSPF** inside a company, **BGP** between internet providers).'),

    h('The key idea: MAC addresses change at every hop, IP addresses do not'),
    p('This one fact finally separates "switch" from "router". Follow a packet from your PC to a server on another network. The **IP addresses** in the packet say the final destination, so they stay the same the whole way. The **MAC addresses** in the frame only say "the next device on this local link", so each router strips off the old frame and wraps the packet in a new one for the next leg.'),
    table(
      ['Where the frame is', 'Source MAC', 'Destination MAC', 'Source IP', 'Destination IP'],
      [
        ['On your LAN (PC to router)', 'Your PC', 'The router (your gateway)', 'Your PC', 'The server'],
        ['Across the provider link', 'Your router', 'The next router', 'Your PC*', 'The server'],
        ['On the server\'s LAN', 'The last router', 'The server', 'Your PC*', 'The server'],
      ],
      { caption: 'The MAC addresses are rewritten at every router. The IP addresses stay the same all the way (*unless NAT rewrites the source, lesson 8).' },
    ),
    analogy('A parcel crossing the country by several couriers. The address on the parcel (the IP address) never changes. But each courier writes a new handover slip (the MAC addresses) saying only "from this depot to the next depot".'),
    exam('**Switch = MAC. Router = IP.** MAC addresses only matter on the local link, while IP addresses travel end to end.'),

    h('Spanning tree: stopping loops'),
    p('Networks often have spare links between switches, so that if one cable fails, traffic can take another path. But spare links create **loops**, and a broadcast caught in a loop goes round and round forever, multiplying until the whole network grinds to a halt (a **broadcast storm**).'),
    p('Switches prevent this with **spanning tree protocol (STP)**. The switches talk to each other using small messages called **BPDUs** (bridge protocol data units), agree on one central switch called the **root bridge**, and temporarily switch off just enough links to break every loop. If an active link fails, a spare one is switched back on. Only switches should ever send BPDUs, which matters for security (below).'),

    hSecure('How to secure it: switches and routers'),
    p('Switches and routers are favorite targets, because whoever controls them controls the traffic. An attacker who can make traffic flow through their own machine is in an **on-path** position (sometimes called man-in-the-middle) and can read or change what passes. First, the attacks:'),
    table(
      ['Attack', 'What happens', 'The defense'],
      [
        ['MAC flooding', 'The attacker sends frames from thousands of fake MAC addresses until the switch\'s table is full. The switch then floods everything to every port, like a hub, and the attacker can watch other people\'s traffic', '**Port security**: limit how many MAC addresses each port may learn'],
        ['ARP poisoning', 'Fake ARP messages trick devices into sending their traffic to the attacker instead of the router, an on-path attack (lesson 8)', '**Dynamic ARP Inspection** (the switch checks ARP messages, lesson 8)'],
        ['VLAN hopping', 'The attacker reaches a separated part of the network they should not (lesson 7)', 'Lock ports to their role and change the default VLAN (lesson 7)'],
        ['Spanning tree attack', 'A rogue switch sends BPDUs claiming to be the root bridge, so traffic flows through it', '**BPDU Guard** and **Root Guard** (below)'],
        ['Rogue device', 'Someone plugs an unapproved switch, Wi-Fi box or laptop into a spare socket', '**802.1X** (devices must log in before getting network access), disabled unused ports, port security'],
        ['Router attacks', 'Default passwords, exposed admin pages, and fake routing updates that send traffic the wrong way', 'Hardening (below), ACLs (allow and block lists) and authenticated routing updates'],
      ],
    ),
    p('Locking a device down is called **hardening** (lesson 11 covers it in depth). Here are the checklists for switches and routers. Tap each item as you go; each one says what to do and why.'),
    {
      type: 'harden',
      title: 'Harden a switch',
      intro: 'Tap each item as you work through it. Each one says what to do and why it matters.',
      items: [
        { action: 'Change the default password and give each administrator their own account, checked by a central login server', why: 'Default passwords are published online. Personal accounts show who changed what, and a central login server (such as RADIUS or TACACS+, lesson 5) lets you remove someone\'s access in one place. This setup is often called **AAA**: authentication, authorization and accounting.' },
        { action: 'Manage it only with encrypted connections (SSH and HTTPS), and only from an admin network', why: 'Telnet and plain HTTP send passwords in plaintext. Limiting where admins may connect from shrinks the number of people who can even try.', example: 'transport input ssh' },
        { action: 'Switch off unused ports and put them in an unused VLAN', why: 'An empty wall socket is an open door. A switched-off port cannot be used to plug in a rogue device.', example: 'shutdown' },
        { action: 'Turn on port security', why: 'It limits how many MAC addresses each port may learn, and can shut the port if that limit is broken. That stops MAC flooding and unknown devices.' },
        { action: 'Use 802.1X on the ports users plug into', why: 'A device must prove who it is (log in) before it gets any network access, so a stranger cannot just plug in and join.' },
        { action: 'Turn on DHCP snooping, Dynamic ARP Inspection and IP source guard', why: 'DHCP snooping marks which ports are allowed to hand out addresses. Dynamic ARP Inspection then uses that knowledge to drop fake ARP messages. Together they stop fake address servers and ARP poisoning (both in lesson 8).' },
        { action: 'Protect spanning tree with BPDU Guard on user ports, plus Root Guard', why: 'BPDUs should only come from switches. BPDU Guard shuts any user-facing port that receives one, so nobody can sneak in a rogue switch. Root Guard stops any unexpected switch from becoming the root bridge.' },
        { action: 'Set every port to "access" or "trunk" yourself, turn off automatic trunk negotiation (DTP), and stop using VLAN 1 as the native VLAN', why: 'This blocks the VLAN hopping tricks explained in lesson 7.' },
        { action: 'Turn off discovery protocols (CDP and LLDP) on user-facing ports', why: 'These protocols announce the switch\'s model and software version to anything plugged in, which helps an attacker choose an exploit.' },
        { action: 'Use SNMPv3, keep the clock in sync with NTP, and send logs to a central server', why: 'Old SNMP uses a plaintext shared password. Correct time and central logs are what make an investigation possible (ports in lesson 5).' },
        { action: 'Update the firmware (the switch\'s own software) and keep an encrypted backup of the settings', why: 'Switch software has flaws like any software. A backup lets you restore quickly and compare against your approved settings.' },
        { action: 'Lock the wiring closet', why: 'Anyone who can physically reach a switch, especially its console port (a socket for direct admin access), can get around many software protections.' },
      ],
    },
    {
      type: 'harden',
      title: 'Harden a router',
      items: [
        { action: 'Change defaults and use strong, centrally managed admin accounts', why: 'Same reasons as for switches. Store the admin password as a scrambled hash (on Cisco routers, "enable secret" instead of the plaintext "enable password").' },
        { action: 'Turn off services you do not use', why: 'Every running service is something an attacker can try: the built-in web page (use HTTPS if you really need it), Telnet, and old leftovers such as TFTP and BOOTP servers.' },
        { action: 'Disable IP source routing, directed broadcasts and ICMP redirects', why: 'Source routing lets a sender choose the path their packets take, which helps attackers get around controls. Directed broadcasts let someone on the internet broadcast to your whole network, which powers flooding attacks. ICMP redirects are messages that tell devices to use a different router, and fake ones can reroute traffic (lesson 8).' },
        { action: 'Filter traffic at the edge in both directions', why: 'Drop packets from the internet that claim private or internal source addresses, because they must be fake, and stop your own network from sending fake addresses out (lesson 2).' },
        { action: 'Restrict who can reach the router\'s admin login', why: 'Allow logins only from administrators\' addresses (with an ACL), and ideally use a separate network just for managing devices.' },
        { action: 'Require proof on routing updates', why: 'Make routers check a shared secret key on routing updates (for OSPF and similar protocols), and filter the routes accepted from internet providers (BGP), so a fake update cannot hijack your traffic.' },
        { action: 'Set login timeouts, a warning banner and limits on failed logins', why: 'An admin session left open is an invitation, and limits slow down password guessing.' },
        { action: 'Keep the firmware current, log to a central server and back up the settings', why: 'Routers sit on the edge of the network and are scanned constantly.' },
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
      'Which setting stops a user from plugging a rogue switch into a wall socket and taking over spanning tree?',
      'BPDU Guard',
      ['A longer SSH key', 'A larger MAC address table', 'Disabling HTTPS on the router'],
      'BPDU Guard shuts down a user-facing port that receives spanning tree messages (BPDUs), which only switches should send.',
    ),
  ],
};
