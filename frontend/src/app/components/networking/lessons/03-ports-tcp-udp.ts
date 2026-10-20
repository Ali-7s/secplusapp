import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, list, mcq, p, pbq, recap, table, tip, trap, words } from './dsl';
import { PORT_STATES } from './practice';

export const PORTS_TCP_UDP: LessonBody = {
  goals: [
    'Explain what a port number is and how an IP address plus a port makes a socket',
    'Tell the well-known, registered and dynamic port ranges apart',
    'Compare TCP and UDP and choose the right one for a job',
    'Describe the three-way handshake and how a SYN flood abuses it',
    'Explain open, closed and filtered ports and why open ports matter for security',
  ],
  blocks: [
    recap('An **IP address** gets a packet to the right **device** (lesson 2). A **server** is a program that waits for requests, and waiting for requests is called **listening** (lesson 1).'),
    words(
      ['Port number', 'A number from 0 to 65,535 that says which program on a device the data is for'],
      ['Service', 'A program that runs in the background and offers something over the network, such as a web server'],
      ['Socket', 'An IP address plus a port, such as 203.0.113.10:443: one exact program on one exact device'],
      ['TCP', 'A careful delivery method: sets up a connection first and makes sure everything arrives, in order'],
      ['UDP', 'A fast delivery method: just sends, with no setup and no checking'],
      ['Handshake', 'The short exchange of messages that sets up a TCP connection before any data moves'],
      ['Flag', 'A marker in a TCP header that says what kind of message it is, such as SYN or ACK'],
      ['Acknowledgement (ACK)', 'A "got it" reply that confirms data arrived'],
      ['Port scan', 'Checking a device\'s ports one by one to see which programs are listening'],
      ['Attack surface', 'Everything an attacker could try to attack. Every open port adds to it'],
      ['Firewall', 'A guard that allows or blocks traffic according to rules (lesson 9)'],
      ['DoS / DDoS', 'Denial of service: flooding a target so real users cannot use it. DDoS uses many attacking machines at once'],
    ),

    h('What is a port?'),
    p('An IP address gets data to the right **computer**. But one computer runs many network programs at the same time: a web browser, an email app, a game, an update checker. When a packet arrives, the computer needs to know **which program** it is for. That is what the **port number** is for. Ports are numbered from 0 to 65,535, and the port number travels in the packet\'s header next to the IP address.'),
    analogy('An IP address is the **street address of an apartment building**. The port is the **apartment number**. The mail carrier gets the letter to the building (IP address), and the front desk hands it to the right apartment (port).'),
    p('On a server, each **service** (a program offering something over the network) **listens** on an agreed port, so clients know where to knock. For example, a secure web server listens on port **443**. That number is a convention everyone agreed on, which is why your browser knows to use it without being told.'),
    p('Your own computer also needs a port for its side of the conversation, so replies come back to the right browser tab. For that it just picks a random, unused high number, such as 50123.'),
    p('An IP address plus a port is called a **socket**, written with a colon: `203.0.113.10:443` means "port 443 on the device at 203.0.113.10". Every conversation is really between two sockets: yours and the server\'s.'),
    table(
      ['Range', 'Name', 'Used for'],
      [
        ['0 to 1023', 'Well-known (system) ports', 'Standard services: 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS'],
        ['1024 to 49151', 'Registered ports', 'Specific applications: 3389 remote desktop, 3306 MySQL database, 8080 alternate web'],
        ['49152 to 65535', 'Dynamic (ephemeral) ports', 'Temporary ports your computer picks for its side of a conversation'],
      ],
    ),
    p('"Ephemeral" just means short-lived: the port is used for one conversation and then released.'),

    h('TCP and UDP: two ways to deliver'),
    p('Once a packet knows which program it is for, there is still a choice to make: **how carefully** should the data be delivered? There are two protocols for this, and each program picks the one that suits it.'),
    list(
      '**TCP** (Transmission Control Protocol) is the careful one. Before sending data it sets up a **connection** with the other side, numbers every piece, waits for an **acknowledgement** ("got it") for each one, and sends again anything that goes missing. Everything arrives, complete and in order. The cost is speed: all that checking adds delay and extra traffic.',
      '**UDP** (User Datagram Protocol) is the fast one. It just sends, with no setup and no checking. If a packet is lost, nobody notices and nobody resends it. That sounds bad, but for some jobs it is exactly right.',
    ),
    table(
      ['', 'TCP', 'UDP'],
      [
        ['Setup', 'A handshake first, then a connection', 'None: just send'],
        ['Reliability', 'Guaranteed: acknowledgements, resending, correct order', 'Best effort: no guarantee and no resending'],
        ['Speed', 'Slower, more overhead (extra traffic for the checking)', 'Faster and very light'],
        ['Good for', 'Web pages, email, file transfer, remote logins: things that must arrive complete', 'Name lookups (DNS), voice and video calls, live streaming, online games, time sync'],
        ['Like', 'A phone call: "hello?" "yes, I can hear you"', 'Shouting across a room, or sending postcards'],
        ['Often abused by', 'SYN floods (below)', 'UDP floods and amplification attacks (lesson 8)'],
      ],
    ),
    tip('If losing a piece breaks the whole thing (a file, a web page), use **TCP**. If a late piece is useless anyway (a live call, a game), use **UDP**. In a video call, resending a sound from two seconds ago would only make things worse.'),

    h('The TCP three-way handshake'),
    p('Before any data moves, TCP sets up the connection with three messages. Each message has **flags** in its header: short markers that say what kind of message it is. The three you need are **SYN** (synchronize: "let us start"), **ACK** (acknowledge: "got it") and **FIN** (finish: "I am done"). Step through it:'),
    {
      type: 'sequence',
      title: 'TCP: setting up and closing a connection',
      steps: [
        {
          from: 'Client', to: 'Server', label: 'SYN',
          note: 'The client says "I would like to talk" by sending a packet with the **SYN** flag. It also picks a starting number for counting the data it will send. It uses a random high port as its own port (for example 50123) and the service\'s port as the destination (443).',
        },
        {
          from: 'Server', to: 'Client', label: 'SYN-ACK',
          note: 'The server answers "OK, I am ready, and I got your message" with both the **SYN** and **ACK** flags set, plus its own starting number. The server now sets aside a little memory for this half-finished ("half-open") connection while it waits for the last step.',
        },
        {
          from: 'Client', to: 'Server', label: 'ACK',
          note: 'The client confirms "got it" with an **ACK**. The connection is now **established**, and data can flow in both directions.',
        },
        {
          from: 'Client', to: 'Server', label: 'Data and ACKs',
          note: 'Every chunk of data is acknowledged. If an acknowledgement does not arrive in time, the sender sends that chunk again. This is the reliability that UDP does not have.',
        },
        {
          from: 'Client', to: 'Server', label: 'FIN, then ACK',
          note: 'To close politely, each side sends a **FIN** and the other acknowledges it. There is also a **RST** (reset) flag, which slams a connection shut instantly, or says "nothing is listening here".',
        },
      ],
    },
    exam('A **SYN flood** is a denial of service (**DoS**) attack: an attempt to overwhelm a server so real users cannot use it. The attacker sends huge numbers of SYN packets, often with fake source addresses, and never sends the final ACK. The server keeps memory set aside for every half-open connection until it runs out, and real users cannot connect. Defenses: **SYN cookies** (a trick that lets the server avoid setting memory aside until the handshake completes), shorter timeouts, limiting how many new connections one source may open (**rate limiting**), and a firewall in front.'),

    h('Open, closed and filtered'),
    p('A **port scan** knocks on a device\'s ports one by one to see which ones answer. Attackers do it to find targets, and defenders do it to check their own systems. The best-known scanning tool is **nmap**. Each port ends up in one of three states:'),
    table(
      ['State', 'Meaning', 'What the scanner sees'],
      [
        ['Open', 'A program is listening and reachable', 'A reply: the port accepts the connection (a SYN-ACK)'],
        ['Closed', 'The device is reachable, but nothing is listening on that port', 'A reset (RST) reply'],
        ['Filtered', 'A firewall is silently dropping the traffic', 'No reply at all'],
      ],
    ),
    p('Every **open port** is a door an attacker can try: if the program behind it has a flaw, that flaw is reachable. The total of everything an attacker could try is called the **attack surface**, and making it smaller always starts with closing the doors you do not need.'),
    trap('Moving a service to an unusual port (SSH on 2222 instead of 22) is **obscurity, not security**. It cuts down on automated noise, but any port scan finds the new port in seconds. It is fine as an extra, never as the only protection.'),

    pbq('Try it: read a scan, pick a protocol', PORT_STATES),

    hSecure('How to secure it: ports and services'),
    list(
      '**Close what you do not use.** Stop the service itself, not just block it. A program that is not running cannot be attacked.',
      '**Block by default.** Set firewalls to block everything and allow only what is needed, in both directions. The automatic "block anything not allowed" rule is called **implicit deny**.',
      '**Run a firewall on every device.** A firewall on the device itself (a **host-based firewall**), not only at the network edge, stops one infected machine from freely reaching its neighbors.',
      '**Limit the remote admin ports.** Allow remote logins (SSH on 22, Windows remote desktop on 3389) only from administrators\' networks or over a VPN (an encrypted tunnel, lesson 9). Never expose remote desktop directly to the internet.',
      '**Scan yourself.** Run regular port scans of your own systems and compare the open ports with the list you expect. Anything extra is worth investigating.',
      '**Blunt flood attacks.** Use SYN cookies and rate limiting on servers and firewalls, and keep DDoS protection (a service that soaks up floods from many attacking machines at once) in front of public services.',
    ),
  ],
  check: [
    mcq(
      'A live video call should use which delivery protocol, and why?',
      'UDP, because a late packet is useless and speed matters more than perfection',
      ['TCP, because every packet must be resent until it arrives', 'TCP, because UDP cannot carry audio or video', 'UDP, because it guarantees delivery in the right order'],
      'Real-time traffic prefers UDP: resending old audio only adds delay. TCP guarantees delivery and order but at the cost of speed, and UDP does not guarantee delivery at all.',
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
