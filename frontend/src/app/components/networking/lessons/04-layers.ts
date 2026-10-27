import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, mcq, p, pbq, recap, table, tip, words } from './dsl';
import { LAYERS_MATCH, LAYERS_WRAP } from './practice';

export const LAYERS: LessonBody = {
  goals: [
    'Explain why networking is split into layers',
    'Name the seven OSI layers in order, with the name of the data at each',
    'Say which layer a switch, a router, a firewall and a WAF work at',
    'Describe encapsulation: how each layer adds its own label as data goes out',
  ],
  blocks: [
    recap('You have now met the main pieces: **bits** turned into signals (lesson 1), **MAC addresses** for the local network and **IP addresses** for crossing networks (lesson 2), and **port numbers** with **TCP or UDP** to reach the right program (lesson 3). This lesson puts them all into one picture.'),
    words(
      ['Layer', 'One job in the process of sending data. Each layer handles its own job and passes the rest on'],
      ['OSI model', 'The standard seven-layer picture of networking that the exam uses ("a Layer 2 attack")'],
      ['TCP/IP model', 'A simpler four-layer version of the same picture, describing how the internet actually works'],
      ['Encapsulation', 'Wrapping data in a new header at each layer on the way out, like envelopes inside envelopes'],
      ['Frame', 'The name for data at Layer 2: a packet wrapped with MAC addresses for the local network'],
      ['Segment', 'The name for data at Layer 4: your data with port numbers added'],
      ['Trailer', 'A small check added at the end of a frame so the receiver can spot damage'],
      ['Defense in depth', 'Using protections at many layers, so one failure does not let an attacker straight in'],
    ),

    h('Why networking has layers', { keep: 'Networking is split into layers that each do one job, so a problem or a protection can be pinned to one layer.' }),
    p('Loading one web page involves many separate jobs: turning bits into signals, getting them to the right device on your network, finding a path across the internet, reaching the right program, keeping the data private, and finally showing you the page. Instead of one giant program doing everything, networking splits the work into **layers**. Each layer does one job and only deals with the layer directly above it and the layer directly below it.'),
    p('This is why you can switch from Wi-Fi to a cable and your web browser never notices: only the bottom layer changed. It is also why a network problem can usually be traced to one layer ("the cable is fine, the address is wrong").'),
    analogy('Mailing a letter. You write the letter. You put it in an envelope and write the address. The post office sorts the envelope into a bag and puts the bag on a truck. The truck drives on roads. You never think about the roads, and the truck driver never reads your letter. Each step only cares about its own job.'),

    h('The seven layers (the OSI model)', { keep: 'OSI layers 1 to 7: Physical, Data link, Network, Transport, Session, Presentation, Application. Layer 2 uses MAC addresses, Layer 3 IP addresses, Layer 4 ports.' }),
    p('The standard picture has **seven layers** and is called the **OSI model**. You already know what lives on most of them:'),
    table(
      ['Layer', 'Its job', 'What you already know there'],
      [
        ['**7 Application**', 'Where your programs meet the network', 'Web pages (HTTP, HTTPS), email, name lookups (DNS)'],
        ['**6 Presentation**', 'Gets data into a form both ends understand, including encryption', 'The encryption in HTTPS'],
        ['**5 Session**', 'Starts, keeps track of and ends conversations', 'Staying logged in to a website'],
        ['**4 Transport**', 'Gets data to the right **program**', '**Port numbers**, **TCP** and **UDP** (lesson 3)'],
        ['**3 Network**', 'Gets data to the right **device**, across networks', '**IP addresses** and **routers** (lesson 2)'],
        ['**2 Data Link**', 'Gets data to the next device **on the local network**', '**MAC addresses** and **switches** (lesson 2)'],
        ['**1 Physical**', 'The actual signals', '**Bits** as electricity, light or radio (lesson 1)'],
      ],
    ),
    p('Notice the pattern in the middle three layers. Layer 2 uses **MAC addresses** (which device on this network), Layer 3 uses **IP addresses** (which device anywhere), and Layer 4 uses **port numbers** (which program). That pattern alone answers many exam questions. Open each layer below to see what lives there, how it is attacked and how it is defended:'),
    { type: 'layers' },
    p('The real internet runs on the **TCP/IP model**, which describes the same ideas in four layers instead of seven. The exam mostly uses the OSI numbers ("a Layer 7 firewall", "a Layer 2 attack"), so those are the ones to learn.'),
    table(
      ['TCP/IP layer', 'OSI layers it covers', 'Examples'],
      [
        ['Application', '7, 6 and 5', 'HTTP, DNS, email, TLS encryption'],
        ['Transport', '4', 'TCP, UDP'],
        ['Internet', '3', 'IP, ICMP'],
        ['Network access (link)', '2 and 1', 'Ethernet, Wi-Fi'],
      ],
      { caption: 'The TCP/IP model is the OSI model with the top three and bottom two layers merged.' },
    ),

    h('Encapsulation: envelopes inside envelopes', { keep: 'Each layer adds its own header on the way down. The data is called a segment at Layer 4, a packet at Layer 3, a frame at Layer 2 and bits at Layer 1.' }),
    p('Lesson 1 said every packet has a **header**: a label at the front. In fact, data gets **several** headers, one from each layer, as it travels down from your program to the cable. Each layer takes what the layer above handed it, adds its own header to the front, and passes it down. This wrapping is called **encapsulation**.'),
    p('At the receiving end, each layer reads and removes its own header and passes the rest up, until your data reaches the program. The unwrapping is called **de-encapsulation**.'),
    p('The data even has a different name at each stage, depending on how far it has been wrapped:'),
    {
      type: 'nested',
      layers: [
        { label: 'Frame (Layer 2)', note: 'A header with the MAC addresses for the next hop on the local network, plus a small **trailer** at the end used to spot damage' },
        { label: 'Packet (Layer 3)', note: 'A header with the source and destination IP addresses' },
        { label: 'Segment (Layer 4)', note: 'A header with the source and destination port numbers, and TCP\'s flags and counting' },
        { label: 'Data (Layers 7 to 5)', note: 'Your actual web request, email or file' },
      ],
      caption: 'Each layer wraps the one inside it. What actually crosses the wire is the whole frame, sent as signals (Layer 1).',
    },
    analogy('Your letter (the data) goes in an envelope addressed to the right person (the segment, with the port). That goes in a bigger envelope addressed to the right building (the packet, with the IP address). That goes in a courier bag labeled for the next sorting office (the frame, with the MAC address). Each sorting office opens only the courier bag, reads where it goes next, and puts it in a new bag for the next leg.'),
    exam('Learn the names of the data at each layer, from the top: **Data, Segment, Packet, Frame, Bits** (Layers 7 to 5, then 4, 3, 2 and 1). Common questions: "at which layer does this device work?" and "what is the data called at Layer 3?" (a packet).'),

    pbq('Try it: wrap the data', LAYERS_WRAP, { intro: 'Put the steps in the order they happen as your request leaves the laptop. Drag them, or use the arrows.' }),

    h('Which device works at which layer?', { keep: 'A device works at the layer whose information it reads: a switch at Layer 2 (MAC), a router at Layer 3 (IP).' }),
    p('A device "works at" a layer when that layer\'s information is what it reads to make decisions. Here are the devices you will meet in this course:'),
    table(
      ['Device or control', 'Layer', 'What it reads to decide'],
      [
        ['Hub, repeater, cable', '1', 'Nothing. It just carries or repeats the signals'],
        ['Switch, wireless access point', '2', 'MAC addresses (lesson 6)'],
        ['Router', '3', 'IP addresses (lesson 6)'],
        ['Basic firewall', '3 and 4', 'IP addresses, port numbers and connections (lesson 9)'],
        ['Next-generation firewall', '3 to 7', 'Also which application, which user, and the content itself (lesson 9)'],
        ['Web application firewall (WAF)', '7', 'The contents of web requests, to block attacks on websites (lesson 9)'],
        ['Load balancer', '4 or 7', 'Spreads visitors across several servers, using ports (Layer 4) or web content (Layer 7)'],
        ['IDS and IPS', '3 to 7', 'Watch traffic for signs of attack. An IDS alerts, an IPS also blocks (lesson 9)'],
      ],
    ),

    pbq('Try it: which layer?', LAYERS_MATCH),

    hSecure('How to secure it: a control at every layer', { keep: 'Defense in depth: put a protection at every layer, so when one fails the next one still stands.' }),
    p('An attacker only needs **one** weak layer, so defenders put protections at **every** layer. This idea is called **defense in depth**: if one protection fails, the next one still stands. The table below is a map, not something to memorize. Every attack and defense in it is explained in a later lesson.'),
    table(
      ['Layer', 'What attackers do', 'What defends it'],
      [
        ['1 Physical', 'Plug in a rogue device, tap or cut a cable, jam Wi-Fi', 'Locked wiring closets, switching off unused sockets, cameras'],
        ['2 Data Link', 'Trick switches and devices on the local network (ARP poisoning, MAC flooding, VLAN hopping, fake access points)', 'Switch protections (lesson 6), devices must log in first (802.1X), strong Wi-Fi security (lesson 9)'],
        ['3 Network', 'Fake source IP addresses, flood with ping messages, misdirect routers', 'Router allow and block lists (ACLs), filtering fake addresses (lesson 2)'],
        ['4 Transport', 'SYN floods and port scans (lesson 3)', 'Firewalls that track connections, SYN cookies, closing unused ports'],
        ['5 and 6 Session, Presentation', 'Steal logged-in sessions, strip or weaken encryption', 'Modern encryption, sessions that expire (lesson 10)'],
        ['7 Application', 'Attack websites with malicious input, send phishing and malware', 'A web application firewall, patching, email and web filtering'],
      ],
    ),
    tip('Do not try to memorize this table now. The later lessons show each attack and defense in context, and the flashcards at the end of each lesson reinforce them.'),
  ],
  check: [
    mcq(
      'A switch decides where to send a frame by looking at which address?',
      'The destination MAC address',
      ['The destination IP address', 'The destination port number', 'The domain name in the web address'],
      'Switches work at Layer 2, the Data Link layer, where MAC addresses are used. Routers use IP addresses (Layer 3), and port numbers belong to Layer 4.',
    ),
    mcq(
      'An attacker sends fake messages on the local network to redirect traffic between devices. Which layer is mainly being attacked?',
      'Layer 2, the Data Link layer',
      ['Layer 1, the Physical layer', 'Layer 4, the Transport layer', 'Layer 7, the Application layer'],
      'Tricks that work only on the local network, using MAC addresses (such as ARP poisoning), are Layer 2 problems. Switch protections like Dynamic ARP Inspection and port security defend against them.',
    ),
    mcq(
      'What is the data called at the Network layer (Layer 3)?',
      'A packet',
      ['A frame', 'A segment', 'A bit'],
      'From the top: data, then segment (Layer 4), packet (Layer 3), frame (Layer 2) and bits (Layer 1).',
    ),
    mcq(
      'Which control reads the contents of web requests in order to block attacks on a website?',
      'A web application firewall (WAF)',
      ['A hub', 'A Layer 2 switch', 'A basic packet-filtering router'],
      'A WAF works at Layer 7 and understands web requests. Hubs, switches and simple packet filters only read signals, MAC addresses, or IP addresses and ports.',
    ),
  ],
};
