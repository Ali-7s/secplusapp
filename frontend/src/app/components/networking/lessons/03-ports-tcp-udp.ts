import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, list, mcq, p, table, tip, trap } from './dsl';

export const PORTS_TCP_UDP: LessonBody = {
  goals: [
    'Explain what a port number is and how an IP address plus a port makes a socket',
    'Tell the well-known, registered and dynamic port ranges apart',
    'Compare TCP and UDP and choose the right one for a job',
    'Describe the three-way handshake and how a SYN flood abuses it',
    'Explain open, closed and filtered ports and why open ports matter for security',
  ],
  blocks: [
    h('What is a port?'),
    p('An IP address gets traffic to the right **computer**. But one computer runs many network programs at once: a browser, email, a game, update services. A **port number** tells the computer which **program** the traffic is for. Ports are numbered from 0 to 65,535.'),
    analogy('An IP address is the **street address of an apartment building**. The port is the **apartment number**. The postal service delivers to the building (IP address) and the doorman hands the letter to the right apartment (port).'),
    p('A server **listens** on a port for a particular service. For example, a secure web server listens on port 443. Your own computer picks a random high port for its side of the conversation. An IP address plus a port is called a **socket**, written like `203.0.113.10:443`.'),
    table(
      ['Range', 'Name', 'Used for'],
      [
        ['0 to 1023', 'Well-known (system) ports', 'Standard services: 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS'],
        ['1024 to 49151', 'Registered ports', 'Specific applications: 3389 RDP, 3306 MySQL, 8080 alternate web'],
        ['49152 to 65535', 'Dynamic (ephemeral) ports', 'Temporary ports your computer picks for its side of a connection'],
      ],
    ),

    h('TCP and UDP: two ways to deliver'),
    p('Layer 4 offers two delivery styles, and each application picks the one that suits it.'),
    table(
      ['Feature', 'TCP', 'UDP'],
      [
        ['Connection', 'Connection-oriented: a handshake first', 'Connectionless: just send'],
        ['Reliability', 'Guaranteed: acknowledgements, retransmission, correct order', 'Best effort: no guarantee and no retransmission'],
        ['Speed and overhead', 'Slower, more overhead', 'Faster, very light'],
        ['Good for', 'Web, email, file transfer, SSH: things that must arrive complete', 'DNS queries, DHCP, voice and video calls, streaming, syslog, SNMP, NTP'],
        ['Like', 'A phone call: "hello?" ... "yes, I hear you"', 'A postcard or a radio broadcast'],
        ['Often abused by', 'SYN floods', 'UDP floods and amplification attacks'],
      ],
    ),
    tip('If losing a piece breaks the whole thing (a file, a web page) use **TCP**. If a late piece is useless anyway (a live call, a game) use **UDP**.'),

    h('The TCP three-way handshake'),
    p('Before any data moves, TCP sets up a connection with three messages. Step through it.'),
    {
      type: 'sequence',
      title: 'TCP: setting up and closing a connection',
      steps: [
        {
          from: 'Client', to: 'Server', label: 'SYN',
          note: 'The client says "I would like to talk" and picks a starting sequence number. It uses a random high port as its source (for example 50123) and the service port as the destination (443). This is the **SYN** (synchronize) flag.',
        },
        {
          from: 'Server', to: 'Client', label: 'SYN-ACK',
          note: 'The server answers "OK, I am ready, and I got your number" and sends its own starting number. Both the **SYN** and **ACK** flags are set. The server now reserves memory for this half-open connection.',
        },
        {
          from: 'Client', to: 'Server', label: 'ACK',
          note: 'The client confirms "got it". The connection is now **established** and data can flow in both directions.',
        },
        {
          from: 'Client', to: 'Server', label: 'Data and ACKs',
          note: 'Every chunk of data is acknowledged. If an acknowledgement does not arrive, the sender sends the data again. This is the reliability that UDP does not have.',
        },
        {
          from: 'Client', to: 'Server', label: 'FIN, then ACK',
          note: 'To close politely, each side sends a **FIN** and the other acknowledges it. A **RST** (reset) slams a connection shut instantly.',
        },
      ],
    },
    exam('A **SYN flood** sends huge numbers of SYN packets (often with fake source addresses) and never sends the final ACK. The server keeps holding half-open connections until it runs out of room and real users cannot connect. Defenses: **SYN cookies**, shorter timeouts, rate limiting, and firewalls or an IPS in front.'),

    h('Open, closed and filtered'),
    p('A port scanner (such as nmap) knocks on ports to see what answers. Each port ends up in one of three states:'),
    table(
      ['State', 'Meaning', 'What the scanner sees'],
      [
        ['Open', 'A program is listening and reachable', 'A reply: the port accepts the connection'],
        ['Closed', 'Reachable, but nothing is listening', 'A reset (RST) reply'],
        ['Filtered', 'A firewall is dropping or blocking the traffic', 'No reply at all'],
      ],
    ),
    p('Every **open port** is a door an attacker can try. The total number of doors is your **attack surface**, which is why locking things down starts with closing the ones you do not need.'),
    trap('Moving a service to a non-standard port (SSH on 2222 instead of 22) is **obscurity, not security**. It cuts down on automated noise, but any port scan finds it in seconds. It is fine as an extra, never as the only control.'),

    hSecure('How to secure it: ports and services'),
    list(
      '**Close what you do not use.** Stop the service itself, not just the firewall rule. A service that is not running cannot be attacked.',
      '**Default deny.** Block everything and allow only what is needed (this is called **implicit deny**), in both directions.',
      '**Host firewalls everywhere.** Run a firewall on every device, not only at the network edge, so one compromised machine cannot freely talk to its neighbors.',
      '**Limit management ports.** Allow SSH (22) and RDP (3389) only from administrator networks or over a VPN. Never expose RDP directly to the internet.',
      '**Scan yourself.** Run regular vulnerability and port scans and compare the open ports with the list you expect. Anything extra is something to investigate.',
      '**Blunt flood attacks.** Use SYN cookies and rate limiting on servers and firewalls, and keep DDoS protection in front of public services.',
    ),
  ],
  check: [
    mcq(
      'A live video call should use which transport protocol, and why?',
      'UDP, because a late packet is useless and speed matters more than perfection',
      ['TCP, because every packet must be retransmitted until it arrives', 'TCP, because UDP cannot carry audio or video', 'UDP, because it guarantees delivery in the right order'],
      'Real-time traffic prefers UDP: sending an old audio packet again only adds delay. TCP guarantees delivery and order but at the cost of speed, and UDP does not guarantee delivery at all.',
    ),
    mcq(
      'A server is overwhelmed by thousands of SYN packets, and the final ACK of the handshake never arrives. What attack is this?',
      'A SYN flood',
      ['ARP poisoning', 'DNS cache poisoning', 'VLAN hopping'],
      'The attacker abuses the three-way handshake by starting connections and never finishing them, so the server fills up with half-open connections. SYN cookies and rate limiting help.',
    ),
    mcq(
      'A port scan gets no reply at all from port 3389. How does the scanner classify the port?',
      'Filtered, because a firewall is probably dropping the traffic',
      ['Open, because nothing refused the connection', 'Closed, because the host sent back a reset', 'Listening, because the host is online'],
      'An open port answers, a closed port sends back a reset, and a filtered port stays silent because a firewall drops the packets.',
    ),
    mcq(
      'What is the range of well-known (system) ports?',
      '0 to 1023',
      ['1024 to 49151', '49152 to 65535', '1 to 65535'],
      'Well-known ports are 0 to 1023 and hold the standard services such as 22, 53, 80 and 443. The range 1024 to 49151 is registered ports, and 49152 upward is dynamic ports.',
    ),
  ],
};
