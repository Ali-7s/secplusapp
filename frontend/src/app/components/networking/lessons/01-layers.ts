import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, mcq, p, table, tip } from './dsl';

export const LAYERS: LessonBody = {
  goals: [
    'Explain why networking is split into layers',
    'Name the seven OSI layers in order, with the data unit at each',
    'Say which layer a switch, a router, a firewall and a WAF work at',
    'Describe encapsulation: how data gets wrapped as it goes down the layers',
  ],
  blocks: [
    h('Why networking has layers'),
    p('Loading one web page involves hundreds of separate jobs: turning bits into electrical or radio signals, finding the right computer, making sure nothing gets lost, and finally showing you the page. Instead of one giant program doing all of it, networking splits the work into **layers**. Each layer does one job and only talks to the layer directly above and the layer directly below.'),
    p('That is why you can swap Wi-Fi for a cable and your web browser never notices, and why a network problem can usually be traced to one layer.'),
    analogy('Mailing a letter. You write the letter and put it in an envelope with an address. The post office sorts envelopes into bags and trucks. The trucks drive on roads. You never think about the roads, and the truck driver never reads your letter. Each step only cares about its own job.'),

    h('The seven layers (the OSI model)'),
    p('The OSI model has **seven layers**. Real networks actually run TCP/IP, which squeezes the same ideas into four layers, but the exam uses the OSI numbers constantly ("a Layer 7 firewall", "a Layer 2 attack"), so they are worth learning. Open each layer below and read what lives there.'),
    { type: 'layers' },
    table(
      ['TCP/IP layer', 'OSI layers it covers', 'Examples'],
      [
        ['Application', '7, 6 and 5', 'HTTP, DNS, SMTP, TLS'],
        ['Transport', '4', 'TCP, UDP'],
        ['Internet', '3', 'IP, ICMP, IPsec'],
        ['Network access (link)', '2 and 1', 'Ethernet, Wi-Fi'],
      ],
      { caption: 'The TCP/IP model is the OSI model with the top three and bottom two layers merged.' },
    ),

    h('Encapsulation: wrapping data on the way down'),
    p('When you send something, each layer wraps what it received from the layer above in its own **header**. The data link layer also adds a **trailer**. The receiver unwraps one layer at a time on the way back up, which is called **de-encapsulation**.'),
    {
      type: 'nested',
      layers: [
        { label: 'Frame (Layer 2)', note: 'Ethernet header with MAC addresses, plus a trailer' },
        { label: 'Packet (Layer 3)', note: 'IP header with IP addresses' },
        { label: 'Segment (Layer 4)', note: 'TCP header with port numbers' },
        { label: 'Data (Layers 7 to 5)', note: 'Your web request or your email' },
      ],
      caption: 'Each layer wraps the one above it. What actually travels is the whole frame, sent as signals (Layer 1).',
    },
    exam('Learn the names of the data unit at each layer: **Data, Segment, Packet, Frame, Bits** (Layers 7 to 5, 4, 3, 2 and 1). A very common question is "at which layer does this device work?" or "what is the data called at Layer 3?"'),

    h('Which device works at which layer?'),
    table(
      ['Device or control', 'Layer', 'What it looks at'],
      [
        ['Hub, repeater, cable', '1', 'Nothing. It just carries signals'],
        ['Switch, bridge, wireless access point', '2', 'MAC addresses'],
        ['Router, Layer 3 switch', '3', 'IP addresses'],
        ['Packet-filtering or stateful firewall', '3 and 4', 'IP addresses, ports and connection state'],
        ['Next-generation firewall', '3 to 7', 'Applications, users and content'],
        ['Web application firewall (WAF)', '7', 'HTTP and HTTPS requests'],
        ['Load balancer', '4 or 7', 'Ports (Layer 4) or content such as URLs and cookies (Layer 7)'],
        ['IDS and IPS', '3 to 7', 'Traffic patterns and attack signatures'],
      ],
    ),

    hSecure('How to secure it: a control at every layer'),
    p('An attacker only needs one weak layer, so defenders put controls at **every** layer. That idea is called **defense in depth**. Here is what typically goes wrong at each layer and what stops it:'),
    table(
      ['Layer', 'What attackers do', 'What defends it'],
      [
        ['1 Physical', 'Plug in a rogue device, tap or cut a cable, jam Wi-Fi', 'Locked wiring closets, disabled or blocked unused ports, cameras, fiber or shielded cable'],
        ['2 Data Link', 'ARP poisoning, MAC flooding, VLAN hopping, evil twin access points', 'Port security, Dynamic ARP Inspection, DHCP snooping, 802.1X, WPA3'],
        ['3 Network', 'Spoof IP addresses, flood with ICMP, hijack routes', 'ACLs, ingress and egress filtering, authenticated routing, rate limiting'],
        ['4 Transport', 'SYN floods and port scans', 'Stateful firewall, SYN cookies, closing unused ports'],
        ['5 and 6 Session, Presentation', 'Hijack sessions, strip or downgrade encryption', 'TLS 1.2 or 1.3, HSTS, session timeouts, strong cipher suites'],
        ['7 Application', 'SQL injection, cross-site scripting, malware, phishing', 'WAF, input validation, patching, email and web filtering'],
      ],
    ),
    tip('Do not memorize this table now. The lessons that follow show each of these attacks and defenses in context, and the flashcards at the end of each lesson reinforce them.'),
  ],
  check: [
    mcq(
      'A switch decides where to send a frame by looking at which address?',
      'The destination MAC address',
      ['The destination IP address', 'The destination port number', 'The domain name in the web address'],
      'Switches work at Layer 2, the Data Link layer, where MAC addresses are used. Routers use IP addresses (Layer 3) and firewalls often look at ports (Layer 4).',
    ),
    mcq(
      'An attacker sends forged ARP replies to redirect traffic on a local network. Which layer is mainly being attacked?',
      'Layer 2, the Data Link layer',
      ['Layer 1, the Physical layer', 'Layer 4, the Transport layer', 'Layer 7, the Application layer'],
      'ARP poisoning abuses how devices map IP addresses to MAC addresses on the local network, which is a Layer 2 problem. Dynamic ARP Inspection and port security defend against it.',
    ),
    mcq(
      'What is the data unit called at the Network layer (Layer 3)?',
      'A packet',
      ['A frame', 'A segment', 'A bit'],
      'Remember the order from the top: data, then segment (Layer 4), packet (Layer 3), frame (Layer 2) and bits (Layer 1).',
    ),
    mcq(
      'Which control inspects HTTP requests in order to block SQL injection?',
      'A web application firewall (WAF)',
      ['A hub', 'A Layer 2 switch', 'A basic packet-filtering router'],
      'A WAF works at Layer 7 and understands web requests. Hubs, switches and simple packet filters cannot read the contents of an HTTP request.',
    ),
  ],
};
