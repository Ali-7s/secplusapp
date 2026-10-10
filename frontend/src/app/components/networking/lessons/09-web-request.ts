import { LessonBody, SequenceField } from '../networking.model';
import { h, hSecure, mcq, p, table, tip } from './dsl';

const f = (name: string, value: string, changed = false): SequenceField => ({ name, value, changed });

export const WEB_REQUEST: LessonBody = {
  goals: [
    'Describe, in order, what happens when you load a secure web page',
    'Say which addresses and ports appear in the packet at each step',
    'Explain what NAT and a stateful firewall do to the traffic',
    'Match each step to the attacks and defenses from the earlier lessons',
  ],
  blocks: [
    h('The setup'),
    p('Here is the payoff. You are on a laptop at home, connected over Wi-Fi to your home router, which acts as switch, router, NAT device and firewall in one box. You type `https://www.example.com` and press Enter. Step through what happens and watch the address and port fields change.'),
    table(
      ['Device', 'Addresses used in this walkthrough'],
      [
        ['Your laptop', 'IP `192.168.1.10`, MAC `aa:aa`'],
        ['Home router, inside (LAN) side', 'IP `192.168.1.1` (your default gateway), MAC `cc:cc`'],
        ['Home router, outside (WAN) side', 'Public IP `198.51.100.5`, MAC `dd:dd`'],
        ['Your provider\'s next router', 'MAC `ee:ee`'],
        ['DNS resolver', 'IP `192.0.2.53`'],
        ['Web server', 'IP `203.0.113.80`, listening on TCP port 443'],
      ],
      { caption: 'MAC addresses are shortened to keep the tables readable, and the IP addresses come from ranges reserved for examples.' },
    ),
    p('When you joined the Wi-Fi earlier, **DHCP** already gave the laptop its address, its gateway and its DNS server, so we start from there.'),

    h('The request, step by step'),
    {
      type: 'sequence',
      title: 'Loading https://www.example.com',
      intro: 'Orange fields show what changed compared with the snapshot above them. Watch how NAT rewrites the source address and port, and how the MAC addresses change at the router.',
      steps: [
        {
          from: 'Laptop', to: 'Home router', label: 'ARP: who has 192.168.1.1?',
          note: 'The laptop will send everything for other networks to its **default gateway**, but it needs the gateway\'s **MAC address** first. It broadcasts an ARP request, the router answers, and the laptop caches the answer. This is the first hop, and the first place an attacker could interfere.',
          snapshots: [
            { label: 'ARP request (broadcast)', fields: [f('Source MAC', 'aa:aa'), f('Destination MAC', 'ff:ff (everyone)'), f('Asks', 'Who has 192.168.1.1?')] },
            { label: 'ARP reply', fields: [f('Source MAC', 'cc:cc'), f('Destination MAC', 'aa:aa'), f('Says', '192.168.1.1 is at cc:cc')] },
          ],
        },
        {
          from: 'Laptop', to: 'DNS resolver', label: 'DNS query (UDP 53)',
          note: 'The laptop needs the IP address for `www.example.com`, so it sends a DNS query over **UDP port 53**. The destination IP is the resolver, but the destination **MAC is the gateway**, because the resolver is on another network. The router performs **NAT**: it replaces the private source address and port with its own public address and a new port. The answer (`203.0.113.80`) comes back the same way in reverse.',
          snapshots: [
            { label: 'Leaving the laptop', fields: [f('Source MAC', 'aa:aa'), f('Destination MAC', 'cc:cc'), f('Source IP', '192.168.1.10'), f('Destination IP', '192.0.2.53'), f('Source port', '53011'), f('Destination port', '53')] },
            { label: 'After the router (NAT)', fields: [f('Source MAC', 'dd:dd', true), f('Destination MAC', 'ee:ee', true), f('Source IP', '198.51.100.5', true), f('Destination IP', '192.0.2.53'), f('Source port', '61001', true), f('Destination port', '53')] },
          ],
        },
        {
          from: 'Laptop', to: 'Web server', label: 'TCP SYN to port 443',
          note: 'With the address known, the laptop starts a TCP connection: a **SYN** to `203.0.113.80` on **port 443**, from a random high source port. The router\'s **stateful firewall** allows this outbound connection and records it in its state table, and **NAT** rewrites the source address and port as before.',
          snapshots: [
            { label: 'Leaving the laptop', fields: [f('Source MAC', 'aa:aa'), f('Destination MAC', 'cc:cc'), f('Source IP', '192.168.1.10'), f('Destination IP', '203.0.113.80'), f('Source port', '50123'), f('Destination port', '443')] },
            { label: 'After the router (NAT)', fields: [f('Source MAC', 'dd:dd', true), f('Destination MAC', 'ee:ee', true), f('Source IP', '198.51.100.5', true), f('Destination IP', '203.0.113.80'), f('Source port', '61002', true), f('Destination port', '443')] },
          ],
        },
        {
          from: 'Web server', to: 'Laptop', label: 'SYN-ACK comes back',
          note: 'The server replies to the router\'s public address and port. The router finds that port in its **NAT table**, rewrites the destination back to `192.168.1.10:50123`, and the firewall lets the packet through because it matches a connection it already knows about. That is what "stateful" means. Unrequested traffic from the internet would have no entry and be dropped.',
          snapshots: [
            { label: 'Arriving at the router', fields: [f('Source MAC', 'ee:ee'), f('Destination MAC', 'dd:dd'), f('Source IP', '203.0.113.80'), f('Destination IP', '198.51.100.5'), f('Source port', '443'), f('Destination port', '61002')] },
            { label: 'After the router (NAT)', fields: [f('Source MAC', 'cc:cc', true), f('Destination MAC', 'aa:aa', true), f('Source IP', '203.0.113.80'), f('Destination IP', '192.168.1.10', true), f('Source port', '443'), f('Destination port', '50123', true)] },
          ],
        },
        {
          from: 'Laptop', to: 'Web server', label: 'ACK, then the TLS handshake',
          note: 'The laptop sends the final **ACK**, so the TCP connection is established. Then the **TLS handshake** begins: the server presents its **certificate**, the laptop checks that it is valid and matches the name, and both sides agree on a **session key**. From this point on, everything is encrypted.',
        },
        {
          from: 'Laptop', to: 'Web server', label: 'HTTP request (inside TLS)',
          note: 'The browser sends `GET /` inside the encrypted tunnel, and the page comes back in many packets, each acknowledged. Anyone watching the network sees only encrypted data between two IP addresses on port 443, not the page itself.',
        },
        {
          from: 'Laptop', to: 'Web server', label: 'FIN: close the connection',
          note: 'When you leave, each side sends a **FIN** and the other acknowledges it. The router deletes the matching entries from its NAT and state tables, so the temporary "doors" close again.',
        },
      ],
    },

    hSecure('Where could an attacker interfere, and what stops them?'),
    table(
      ['Step', 'Attack', 'Defense'],
      [
        ['Joining the Wi-Fi', 'Evil twin access point, rogue DHCP server', 'WPA3 or 802.1X, DHCP snooping'],
        ['1. ARP', 'ARP poisoning makes the attacker the gateway', 'Dynamic ARP Inspection, 802.1X, TLS everywhere'],
        ['2. DNS', 'Cache poisoning or a malicious resolver sends you to a fake site', 'DNSSEC, DoH or DoT, a trusted resolver, DNS filtering'],
        ['3 and 4. TCP', 'SYN flood against the server, port scans against the router', 'SYN cookies, rate limiting, stateful firewall, closing unused ports'],
        ['5. TLS', 'SSL stripping, downgrade attacks, fake certificates', 'HSTS, TLS 1.2 or 1.3, certificate validation and pinning'],
        ['6. HTTP', 'SQL injection, XSS and session hijacking against the application', 'WAF, input validation, secure cookies, patching'],
        ['Everywhere', 'Eavesdropping on a link', 'Encryption in transit (TLS, VPN, WPA3)'],
      ],
    ),
    tip('A good test of whether the lessons have landed: cover the right-hand columns and try to name an attack and a defense for each step.'),
  ],
  check: [
    mcq(
      'At which point does the packet\'s source IP address change from private to public?',
      'At the router that performs NAT',
      ['At the laptop\'s network card', 'At the web server', 'At the DNS resolver'],
      'The NAT router rewrites the private source address to its own public address on the way out, and reverses the change for the reply.',
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
      'DNS translates names into IP addresses and normally uses UDP port 53. ARP maps IP addresses to MAC addresses, DHCP assigns addresses and ICMP is for diagnostics.',
    ),
    mcq(
      'The reply from the web server is only allowed through the home router because...',
      'it matches an existing connection in the stateful firewall and NAT tables',
      ['all traffic from port 443 is always trusted', 'the laptop has a public IP address', 'NAT encrypts the reply'],
      'Stateful inspection and NAT track the outbound connection, so the matching reply is recognized. Unrequested inbound traffic has no entry and is dropped.',
    ),
  ],
};
