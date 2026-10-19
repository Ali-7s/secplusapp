import { LessonBody, SequenceField } from '../networking.model';
import { h, hSecure, mcq, p, recap, table, tip, words } from './dsl';

const f = (name: string, value: string, changed = false): SequenceField => ({ name, value, changed });

export const WEB_REQUEST: LessonBody = {
  goals: [
    'Describe, in order, what happens when you load a secure web page',
    'Say which addresses and ports appear in the packet at each step',
    'Explain what NAT and a stateful firewall do to the traffic',
    'Match each step to the attacks and defenses from the earlier lessons',
  ],
  blocks: [
    recap('This lesson uses everything so far: **IP and MAC addresses** and the **default gateway** (lesson 2), **ports** and the **TCP handshake** (lesson 3), **ARP**, **DNS** and **NAT** (lesson 8), and **stateful firewalls** (lesson 9). If a step loses you, the lesson it comes from is named next to it.'),
    words(
      ['TLS handshake', 'The short exchange at the start of an HTTPS connection where the two sides check identity and agree on a secret key'],
      ['Certificate', 'A digital ID card a website presents to prove it really is the site it claims to be'],
      ['Session key', 'A secret key both sides agree on during the TLS handshake, used to encrypt everything after it'],
      ['GET request', 'The message a browser sends to ask a web server for a page'],
    ),

    h('The setup'),
    p('Here is where it all comes together. You are on a laptop at home, connected over Wi-Fi to your home router, which is a switch, a router, a NAT device and a firewall in one box (lesson 1). You type `https://www.example.com` and press Enter. Step through what happens, and watch the address and port fields in the packet change.'),
    table(
      ['Device', 'Addresses used in this walkthrough'],
      [
        ['Your laptop', 'IP `192.168.1.10`, MAC `aa:aa`'],
        ['Home router, inside (home network) side', 'IP `192.168.1.1` (your default gateway), MAC `cc:cc`'],
        ['Home router, outside (internet) side', 'Public IP `198.51.100.5`, MAC `dd:dd`'],
        ['Your provider\'s next router', 'MAC `ee:ee`'],
        ['DNS resolver', 'IP `192.0.2.53`'],
        ['Web server', 'IP `203.0.113.80`, listening on TCP port 443 (HTTPS)'],
      ],
      { caption: 'MAC addresses are shortened to keep the tables readable, and the IP addresses come from ranges reserved for examples.' },
    ),
    p('When the laptop joined the Wi-Fi earlier, **DHCP** already gave it an IP address, a subnet mask, a default gateway and a DNS server (lesson 8). So we start from there.'),

    h('The request, step by step'),
    {
      type: 'sequence',
      title: 'Loading https://www.example.com',
      intro: 'Orange fields show what changed compared with the snapshot above them. Watch how NAT rewrites the source address and port, and how the MAC addresses change at the router.',
      steps: [
        {
          from: 'Laptop', to: 'Home router', label: 'ARP: who has 192.168.1.1?',
          note: 'The website is on another network, so the laptop will send everything to its **default gateway** (lesson 2). To put the gateway\'s MAC address on the frame, it first needs to learn it, so it broadcasts an **ARP** request (lesson 8). The router answers, and the laptop remembers the answer. This is the first hop, and the first place an attacker could interfere.',
          snapshots: [
            { label: 'ARP request (broadcast)', fields: [f('Source MAC', 'aa:aa'), f('Destination MAC', 'ff:ff (everyone)'), f('Asks', 'Who has 192.168.1.1?')] },
            { label: 'ARP reply', fields: [f('Source MAC', 'cc:cc'), f('Destination MAC', 'aa:aa'), f('Says', '192.168.1.1 is at cc:cc')] },
          ],
        },
        {
          from: 'Laptop', to: 'DNS resolver', label: 'DNS query (UDP 53)',
          note: 'The laptop knows the name `www.example.com` but needs its IP address, so it asks its DNS resolver over **UDP port 53** (lesson 8). Look at the addresses: the destination **IP** is the resolver, but the destination **MAC** is the gateway, because the resolver is on another network and the gateway is the next hop (lesson 6). At the router, **NAT** replaces the private source address and port with the router\'s public address and a new port. The answer (`203.0.113.80`) comes back the same way in reverse.',
          snapshots: [
            { label: 'Leaving the laptop', fields: [f('Source MAC', 'aa:aa'), f('Destination MAC', 'cc:cc'), f('Source IP', '192.168.1.10'), f('Destination IP', '192.0.2.53'), f('Source port', '53011'), f('Destination port', '53')] },
            { label: 'After the router (NAT)', fields: [f('Source MAC', 'dd:dd', true), f('Destination MAC', 'ee:ee', true), f('Source IP', '198.51.100.5', true), f('Destination IP', '192.0.2.53'), f('Source port', '61001', true), f('Destination port', '53')] },
          ],
        },
        {
          from: 'Laptop', to: 'Web server', label: 'TCP SYN to port 443',
          note: 'Now it knows the address, the laptop starts a TCP connection with a **SYN** (lesson 3) to `203.0.113.80` on **port 443**, from a random high port of its own. The router\'s **stateful firewall** (lesson 9) allows this outgoing connection and writes it in its state table, and **NAT** rewrites the source address and port as before.',
          snapshots: [
            { label: 'Leaving the laptop', fields: [f('Source MAC', 'aa:aa'), f('Destination MAC', 'cc:cc'), f('Source IP', '192.168.1.10'), f('Destination IP', '203.0.113.80'), f('Source port', '50123'), f('Destination port', '443')] },
            { label: 'After the router (NAT)', fields: [f('Source MAC', 'dd:dd', true), f('Destination MAC', 'ee:ee', true), f('Source IP', '198.51.100.5', true), f('Destination IP', '203.0.113.80'), f('Source port', '61002', true), f('Destination port', '443')] },
          ],
        },
        {
          from: 'Web server', to: 'Laptop', label: 'SYN-ACK comes back',
          note: 'The server replies to the router\'s public address and port. The router finds that port in its **NAT table**, changes the destination back to `192.168.1.10:50123`, and the firewall lets the packet in because it belongs to a conversation it already knows about. That is what "stateful" means. Traffic from the internet that nobody asked for would have no entry and be blocked.',
          snapshots: [
            { label: 'Arriving at the router', fields: [f('Source MAC', 'ee:ee'), f('Destination MAC', 'dd:dd'), f('Source IP', '203.0.113.80'), f('Destination IP', '198.51.100.5'), f('Source port', '443'), f('Destination port', '61002')] },
            { label: 'After the router (NAT)', fields: [f('Source MAC', 'cc:cc', true), f('Destination MAC', 'aa:aa', true), f('Source IP', '203.0.113.80'), f('Destination IP', '192.168.1.10', true), f('Source port', '443'), f('Destination port', '50123', true)] },
          ],
        },
        {
          from: 'Laptop', to: 'Web server', label: 'ACK, then the TLS handshake',
          note: 'The laptop sends the final **ACK**, so the TCP connection is set up. Now the **TLS handshake** begins, which is what puts the S in HTTPS. The server presents its **certificate** (a digital ID card), the laptop checks that it is genuine and matches the name `www.example.com`, and both sides agree on a secret **session key**. From this point on, everything is encrypted with that key.',
        },
        {
          from: 'Laptop', to: 'Web server', label: 'HTTP request (inside TLS)',
          note: 'The browser sends a **GET request** ("please send me the page") inside the encrypted tunnel, and the page comes back in many packets, each acknowledged. Anyone watching the network sees only scrambled data passing between two IP addresses on port 443, not the page itself.',
        },
        {
          from: 'Laptop', to: 'Web server', label: 'FIN: close the connection',
          note: 'When you leave the page, each side sends a **FIN** and the other acknowledges it (lesson 3). The router deletes the matching entries from its NAT and state tables, so the temporary "doors" close again.',
        },
      ],
    },

    hSecure('Where could an attacker interfere, and what stops them?'),
    p('Every step above is a chance for an attacker. This table lines them up with the defenses from earlier lessons. Each attack is described in plain words, with the lesson that covers it:'),
    table(
      ['Step', 'What an attacker could do', 'What stops it'],
      [
        ['Joining the Wi-Fi', 'Run a fake access point with the same name (evil twin), or a fake DHCP server that hands out a bad gateway (lessons 8 and 9)', 'WPA3 or 802.1X, DHCP snooping'],
        ['1. ARP', 'Answer the ARP question with their own MAC address, so the laptop\'s traffic goes through them (ARP poisoning, lesson 8)', 'Dynamic ARP Inspection, 802.1X, and HTTPS everywhere'],
        ['2. DNS', 'Give a fake answer so the laptop connects to the attacker\'s copy of the site (DNS poisoning, lesson 8)', 'DNSSEC, encrypted DNS (DoH or DoT), a trusted resolver'],
        ['3 and 4. TCP', 'Flood the server with SYNs, or scan the router for open ports (lesson 3)', 'SYN cookies, rate limiting, a stateful firewall, closing unused ports'],
        ['5. TLS', 'Quietly turn HTTPS into plain HTTP (SSL stripping), force an older weak version, or present a fake certificate', 'HSTS (the site tells browsers "only ever use HTTPS"), modern TLS, checking certificates properly'],
        ['6. HTTP', 'Attack the website itself with malicious input, or steal the logged-in session (lesson 4)', 'A web application firewall, checking input, secure cookies, patching'],
        ['Everywhere', 'Listen in on any link the traffic crosses', 'Encryption in transit: HTTPS, VPNs, WPA3'],
      ],
    ),
    tip('A good test of whether the lessons have landed: cover the right-hand columns and try to name an attack and a defense for each step.'),
  ],
  check: [
    mcq(
      'At which point does the packet\'s source IP address change from private to public?',
      'At the router that performs NAT',
      ['At the laptop\'s network card', 'At the web server', 'At the DNS resolver'],
      'The NAT router replaces the private source address with its own public address on the way out, and reverses the swap for the reply.',
    ),
    mcq(
      'Before sending traffic to a website on another network, the laptop must learn the MAC address of which device?',
      'The default gateway (the router)',
      ['The web server', 'The DNS resolver', 'The internet provider\'s billing server'],
      'Frames only travel to the next hop on the local network. For other networks that next hop is the default gateway, whose MAC address is found with ARP.',
    ),
    mcq(
      'Which protocol did the laptop use to find the web server\'s IP address?',
      'DNS over UDP port 53',
      ['ARP over TCP port 80', 'DHCP over UDP port 123', 'ICMP over TCP port 443'],
      'DNS turns names into IP addresses and normally uses UDP port 53. ARP maps IP addresses to MAC addresses, DHCP hands out addresses and ICMP carries status messages.',
    ),
    mcq(
      'The reply from the web server is only allowed through the home router because...',
      'it matches an existing conversation in the stateful firewall and NAT tables',
      ['all traffic from port 443 is always trusted', 'the laptop has a public IP address', 'NAT encrypts the reply'],
      'The stateful firewall and NAT track the outgoing connection, so the matching reply is recognized. Incoming traffic nobody asked for has no entry and is blocked.',
    ),
  ],
};
