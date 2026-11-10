import { LessonBody } from '../networking.model';
import { analogy, captureLab, exam, h, list, mcq, p, recap, table, tip, trap, words } from './dsl';

export const CAPTURES_LESSON: LessonBody = {
  goals: [
    'Read a packet list: who talked to whom, with which protocol, and what each packet says',
    'Open a packet layer by layer and explain every address, port and flag in it',
    'Filter a capture down to the packets that answer a question, in both filter languages',
    'Recognise a port scan, ARP poisoning, cleartext logins and a firewall drop from the packets alone',
  ],
  blocks: [
    recap('Everything in this lesson has come up before, now seen in real packets: MAC and IP addresses and the default gateway (lesson 2), ports, TCP, UDP and the handshake, the layers (lesson 3), the port numbers (lesson 4), DHCP, DNS, ARP and ICMP (lesson 7), and mirror ports and firewalls (lesson 8). Lesson 9 followed one web request in words; here you watch it happen.'),
    words(
      ['Packet capture', 'A recording of the packets that crossed a network point, saved as a file (often .pcap) to read later'],
      ['Frame', 'One packet as it travels on the local network, with its Ethernet header of MAC addresses'],
      ['Display filter', 'A rule that hides the packets you do not want while you read a capture, such as tcp.port == 443'],
      ['Capture filter', 'A rule given to a capture tool such as tcpdump, in its own syntax, such as port 443'],
      ['Ephemeral port', 'The random high port a client picks for its side of a connection'],
      ['TTL', 'Time to live: a counter in every IP packet that each router lowers by one'],
      ['Flags', 'Bits in the TCP header that say what a segment does: SYN to open, ACK to acknowledge, FIN to close, RST to refuse'],
      ['Mirror port (SPAN)', 'A switch port that receives a copy of other ports\' traffic, where a capture or an IDS can listen'],
      ['Half-open scan', 'A port scan that sends SYN, notes the answer, and resets instead of completing the handshake'],
      ['SNI', 'Server Name Indication: the site name a browser sends in clear text at the very start of a TLS connection'],
    ),

    h('What a packet capture is', { objective: '4.9', keep: 'A capture records every packet that crossed one point in the network. Where it was taken decides what it can see: your own laptop, or a mirror port that copies a whole switch.' }),
    p('A **packet capture** records the packets crossing one point of a network, with every header and every byte, so you can read them later. Logs say what a system *decided* to write down; a capture shows what *actually went over the wire*. That is why it is the evidence of last resort in an investigation, and why the exam lists it among the data sources (with logs, NetFlow and metadata).'),
    list(
      '**Where it was taken decides what it holds.** A capture on a laptop sees only that laptop\'s traffic. A capture on a **mirror port** (SPAN) or a **network tap** sees everything crossing that switch or link.',
      '**Encrypted traffic shows who, when and how much, but not what.** Addresses, ports, sizes and timing stay readable; the contents of HTTPS and SSH do not.',
      '**Captures are big and sensitive.** They can hold passwords and personal data, so they are stored, shared and deleted with care, and often captured only for a short window.',
    ),
    analogy('Logs are the guards\' notebooks: what each guard chose to write down. A packet capture is the CCTV recording of the corridor: everything that went past, whether anyone thought it mattered or not.'),

    h('Reading the packet list', { objective: '4.9', keep: 'Each row is one packet: its number, time, source and destination addresses, protocol, size and a one-line summary. Requests and replies come in pairs, so read them together.' }),
    p('A capture opens as a list, one row per packet, in the order they were seen:'),
    table(
      ['Column', 'What it tells you'],
      [
        ['No.', 'The packet\'s number in the capture. Questions and reports point to packets by number.'],
        ['Time', 'Seconds since the capture started. Gaps show waiting; bursts show machines (people are slower).'],
        ['Source, Destination', 'IP addresses for IP packets. ARP has no IP header, so it shows MAC addresses, or "Broadcast".'],
        ['Protocol', 'The highest layer the tool recognised: TCP alone for a bare handshake, DNS or HTTP when it can read what is inside.'],
        ['Length', 'The size of the frame in bytes. Bare control packets are around 54 to 66 bytes; data is larger.'],
        ['Info', 'A one-line summary: the DNS question, the HTTP request, the TCP ports and flags.'],
      ],
      { caption: 'The columns of a packet list' },
    ),
    p('Conversations come in pairs, so read requests with their replies: a DNS query and its response, a SYN and its SYN-ACK (or RST), an ARP request and its reply. **An unanswered request is often the finding**: a SYN with no reply is a firewall dropping it, a ping with no reply is a host that is down or silent.'),

    h('Opening a packet: the layers', { objective: '4.9', keep: 'Ethernet carries MAC addresses that change at every hop; IP carries the end-to-end addresses and a TTL; TCP or UDP carries the ports; the top layer carries the protocol itself, readable only if it is not encrypted.' }),
    p('Open a packet and it unfolds into the layers from lesson 3, outermost first. Each one answers a different question:'),
    table(
      ['Layer', 'Key fields', 'What to look for'],
      [
        ['Ethernet (layer 2)', 'Source and destination MAC', 'For anything off the LAN, the destination MAC is the gateway\'s. A MAC claiming an address it should not is ARP poisoning.'],
        ['IP (layer 3)', 'Source and destination IP, TTL', 'The real ends of the conversation. TTL starts at 64 (Linux, phones) or 128 (Windows); a value one lower than it should be means an extra hop.'],
        ['TCP or UDP (layer 4)', 'Ports, TCP flags, sequence numbers', 'The server side uses the well-known port; the client a random ephemeral one. Flags show the handshake, refusals and closes.'],
        ['Application (layer 7)', 'DNS question, HTTP request, TLS Client Hello', 'Cleartext protocols are fully readable here. Encrypted ones show only the start of the handshake, such as the SNI site name.'],
      ],
      { caption: 'What each layer of a packet tells you' },
      ),
    trap('The MAC addresses on a packet from the internet are the gateway\'s and yours, not the far server\'s. MAC addresses only cover one hop of the LAN; only IP addresses go end to end. A question that asks for "the server\'s MAC" from a capture taken on a laptop means the gateway\'s.'),

    h('Filters: finding the needle', { objective: '4.9', keep: 'Capture tools filter with fields such as ip.addr == x and tcp.flags.syn == 1, joined by && and ||. tcpdump uses its own words: host x, port 443, and, or, not.' }),
    p('A real capture has thousands of packets, so the skill is asking for the few that matter. There are two filter languages, and the exam expects you to recognise both:'),
    table(
      ['To show', 'Display filter (capture tools)', 'Capture filter (tcpdump)'],
      [
        ['One address, either direction', 'ip.addr == 10.0.4.57', 'host 10.0.4.57'],
        ['Sent by one address', 'ip.src == 10.0.4.57', 'src host 10.0.4.57'],
        ['One port', 'tcp.port == 443', 'tcp port 443'],
        ['A whole subnet', 'ip.addr == 10.0.4.0/24', 'net 10.0.4.0/24'],
        ['Connection attempts', 'tcp.flags.syn == 1 && tcp.flags.ack == 0', 'tcp[tcpflags] == tcp-syn'],
        ['Only DNS', 'dns', 'udp port 53'],
        ['Everything but ARP', '!arp', 'not arp'],
      ],
      { caption: 'The same question in both filter languages', mono: [1, 2] },
    ),
    tip('Not sure of a field\'s name? Open a packet, tap the field, and use **Filter on this**: the lab writes the filter for you.'),

    h('Try it: five captures', { objective: '2.4', keep: 'Answer each question from the packets: filter first, then open the packet that proves it. Every capture teaches one pattern you will meet again.' }),
    p('Each capture tells a story. Use the filter chips to start, open packets to read their layers, and answer the questions. Packet questions want a packet number: select the packet and press **Use packet**.'),
    captureLab(),

    h('What attacks look like in a capture', { objective: '2.4', keep: 'A scan is one source, many ports, SYN after SYN. ARP poisoning is unasked-for ARP replies and one MAC claiming two IPs. Cleartext logins are readable. Silence after a SYN is a firewall; RST is a closed port.' }),
    table(
      ['Pattern', 'What you see in the packets'],
      [
        ['Port scan', 'One source sends SYNs to many ports in under a second. Open ports answer SYN-ACK, closed ones RST, filtered ones nothing. A half-open scan answers SYN-ACK with RST.'],
        ['ARP poisoning (on-path)', 'ARP replies nobody asked for, repeated every few seconds; one MAC claiming the gateway\'s IP; every packet appearing twice, the second time with a TTL one lower.'],
        ['Cleartext credentials', 'USER and PASS in FTP, a readable login form in HTTP, a Telnet session with the password in it.'],
        ['DNS tunnelling', 'Many queries to one domain with long, random-looking names, often TXT records, from a machine that should not need them.'],
        ['Beaconing', 'Small connections from one host to the same address at a steady interval, all day, even when nobody is at the desk.'],
        ['Brute force', 'Hundreds of short connections to one service port (22, 3389) from one source, each closed after a refusal.'],
        ['A firewall drop', 'The same SYN sent again after 1, then 2, then 4 seconds, with no answer at all.'],
      ],
      { caption: 'Attack and fault patterns in packets' },
    ),
    exam('A question that shows you a few lines of capture usually wants one of these patterns named. Look at the flags (SYN, SYN-ACK, RST), the ports, and whether one source is talking to many destinations or many ports.'),
  ],
  check: [
    mcq('A capture shows 10.0.4.122 sending SYNs to ports 21, 22, 23, 25, 80 and 443 on one server within a second. The server answers port 22 with SYN-ACK and the others with RST, ACK. What is happening, and which port is open?',
      'A port scan; port 22 is open', ['A brute force attack; port 22 is closed', 'A denial of service; every port is open', 'Normal browsing; ports 80 and 443 are open'],
      'One source probing many ports at once is a scan. SYN-ACK means open, RST means closed, so only 22 (SSH) accepted.'),
    mcq('In a capture taken on a laptop, a packet from the laptop to 192.0.2.10 on the internet has a destination MAC address. Whose is it?',
      'The default gateway\'s', ['The server 192.0.2.10\'s', 'The DNS server\'s', 'The broadcast address'],
      'Frames only travel one hop of the LAN. Anything off the local network is sent to the gateway\'s MAC; the IP header carries the real destination.'),
    mcq('ARP replies say that 10.0.4.1, the gateway, is at two different MAC addresses, and one of them sends replies every two seconds that nobody asked for. Which switch feature stops this?',
      'Dynamic ARP Inspection', ['Spanning tree', 'Port mirroring', 'A trunk port'],
      'This is ARP poisoning, the start of an on-path attack. Dynamic ARP Inspection checks ARP replies against DHCP snooping\'s records and drops the forged ones.'),
    mcq('Which tcpdump filter shows only traffic to or from 10.0.4.57 on port 443?',
      'host 10.0.4.57 and port 443', ['ip.addr == 10.0.4.57 && tcp.port == 443', 'src 10.0.4.57 or 443', 'tcp.port 443 host 10.0.4.57'],
      'tcpdump uses words: host, port, and, or, not. The == form is the display filter syntax of capture tools, not tcpdump\'s.'),
  ],
};
