import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, list, mcq, p, pbq, steps, table, tip, words } from './dsl';
import { START_LABELS } from './practice';

export const START: LessonBody = {
  goals: [
    'Say in plain words what a network is and what actually travels across it',
    'Explain what a bit, a packet and a header are',
    'Say what an address, a protocol, a client and a server are',
    'Tell a local network (LAN) from the internet, and name the boxes that join them',
  ],
  blocks: [
    p('This lesson assumes you know **nothing** about networking. Every later lesson builds on the handful of ideas here, so it is worth reading slowly. Every new word is in bold the first time it appears, and explained right there. The table below collects them in one place.'),
    words(
      ['Network', 'Two or more devices connected so they can send each other messages'],
      ['Device (host)', 'Anything that connects to a network: laptop, phone, printer, server, camera'],
      ['Bit', 'The smallest piece of computer data: a single 0 or 1, like a switch that is off or on'],
      ['Byte', 'A group of 8 bits. One letter of text is about one byte'],
      ['Packet', 'A small chunk of a message, sent on its own and put back together at the other end'],
      ['Header', 'The label at the front of a packet saying where it is going, where it came from and what it is'],
      ['Address', 'A number that identifies a device on a network, so packets can be delivered to it'],
      ['Protocol', 'An agreed set of rules for how two devices talk, so they understand each other'],
      ['Client', 'A device or program that asks for something (your web browser)'],
      ['Server', 'A device or program that waits for requests and answers them (a website\'s computer)'],
      ['LAN', 'Local area network: the network in one place, such as your home or an office floor'],
      ['Internet', 'Millions of separate networks joined together'],
      ['Router', 'A box that joins networks together and passes packets from one network to the next'],
      ['Switch', 'A box with many network sockets that passes packets between the devices plugged into it'],
      ['ISP', 'Internet service provider: the company that connects your home or office to the internet'],
      ['Encryption', 'Scrambling data so that only the intended receiver can read it'],
    ),

    h('What a network is', { keep: 'A network is two or more devices connected so they can send each other messages.' }),
    p('A **network** is simply two or more devices connected so they can send each other messages. A **device** is anything with a network connection: a laptop, a phone, a printer, a smart TV, a security camera, or a **server** (a computer whose job is to provide something to others, such as a website). Networking books often call a device a **host** or a **node**. They all mean the same thing.'),
    p('Every time you load a web page, stream a video or send a message, your device is swapping messages with another device somewhere else. **Networking** is the equipment plus the agreed rules that get those messages to the right place, in one piece.'),
    analogy('The postal service. You write a letter, put it in an envelope with an address, and drop it in a mailbox. Sorting offices read the address and pass it along, one office at a time, until it reaches the right house. Nobody along the way reads the letter itself. Almost every idea in networking has a match in this picture, and the lessons keep coming back to it.'),

    h('What actually travels: bits', { keep: 'Everything sent over a network is bits (0s and 1s). The part of a device that sends and receives them is its network card (NIC).' }),
    p('Computers do not store words or pictures. Underneath, they store only numbers, and those numbers are written using just two values: **0 and 1**. A single 0 or 1 is called a **bit**. Think of a bit as a light switch: off (0) or on (1).'),
    p('Everything you send (a message, a photo, a video call) is turned into a long row of bits. Eight bits together are called a **byte**, and one letter of text takes about one byte. A photo might be a few million bytes.'),
    p('To travel, bits are turned into something physical:'),
    list(
      '**Electrical pulses** in a copper cable. The usual network cable, with a plug a little wider than a phone plug, is called an **Ethernet** cable.',
      '**Flashes of light** in a glass **fiber optic** cable, used for long distances and very high speeds.',
      '**Radio waves** through the air, which is what **Wi-Fi** is.',
    ),
    p('The part of a device that sends and receives these signals is its **network interface card**, or **NIC** (also called a network adapter). Every device that connects to a network has one, whether it is a socket for a cable or a Wi-Fi radio inside the device.'),
    tip('Network speeds are measured in **bits per second**. "100 Mbps" means 100 million bits per second. A lowercase **b** means bits and an uppercase **B** means bytes, so 100 Mbps is about 12.5 MB (megabytes) per second.'),

    h('Messages are chopped into packets', { keep: 'Data travels in small packets. Each one has a header (a label saying where it is going) and a payload (the data itself).' }),
    p('A big file is not sent as one giant stream. It is cut into small pieces, usually up to about 1,500 bytes each, called **packets**. Each packet travels on its own, and the receiving device puts them back together in the right order.'),
    p('Why chop things up? Two reasons:'),
    list(
      '**Sharing.** Many conversations can use the same cable at the same time by taking turns, one packet at a time. Your video call and your download both get through.',
      '**Repairs.** If one packet is lost or damaged on the way, only that small piece has to be sent again, not the whole file.',
    ),
    p('Every packet has two parts. The front part is the **header**: a label with the information the network needs, such as where the packet is going, where it came from, and which program it is for. The rest is the **payload**: the actual piece of your message. Network equipment reads the header to decide where to send the packet, and normally ignores the payload.'),
    analogy('Sending a flat-pack bookcase by mail in numbered boxes. Each box has its own shipping label (the header) and holds one part of the bookcase (the payload). The boxes might travel on different trucks and arrive out of order, but the numbers let you put the bookcase together correctly at the end.'),
    {
      type: 'nested',
      caption: 'A packet: a header (the label) wrapped around a payload (a piece of your data).',
      layers: [
        { label: 'Header', note: 'Destination address, source address, which program it is for, which piece of the message it is' },
        { label: 'Payload', note: 'A small piece of your actual message, file or video' },
      ],
    },

    h('Addresses: how a packet finds the right device', { keep: 'Three labels deliver a packet: the IP address finds the device across networks, the MAC address finds it on the local network, and the port finds the program on it.' }),
    p('To deliver a packet, the network has to know which device it is for, just as a letter needs an address. Networks use three kinds of label, and each answers a different question. You do not need the details yet: each one gets its own lesson.'),
    table(
      ['The question', 'Answered by', 'Looks like'],
      [
        ['Which device, anywhere in the world?', '**IP address** (lesson 2)', '`192.168.1.25`'],
        ['Which device, on this local network?', '**MAC address** (lesson 2)', '`00:1A:2B:3C:4D:5E`'],
        ['Which program on that device?', '**Port number** (lesson 3)', '`443`'],
      ],
    ),
    analogy('An **IP address** is like a postal address: it gets the letter to the right building anywhere in the country. A **MAC address** is like the name on the door, used for the final hand-off inside the building. A **port number** is like the apartment number, saying which resident (which program) the letter is for.'),

    h('Protocols: the agreed rules', { keep: 'A protocol is an agreed set of rules for talking. An S at the end (HTTPS, SFTP) usually means the secure, encrypted version.' }),
    p('Two devices can only understand each other if they follow the same rules: how a conversation starts, how messages are laid out, what reply to send, and what to do when something goes wrong. An agreed set of rules like this is called a **protocol**.'),
    analogy('A phone call has a protocol everyone learns as a child. You dial, the other person says "hello", you say who you are, you take turns talking, and you say "bye" before hanging up. If one person spoke French and the other only Japanese, the call would connect but nothing would be understood. Devices are the same: they must speak the same protocol.'),
    p('You will meet many protocols. Most have short names, and many end in **P** for protocol. A few you will see constantly:'),
    table(
      ['Protocol', 'Its job, in plain words'],
      [
        ['**IP** (Internet Protocol)', 'Puts addresses on packets and gets them from network to network'],
        ['**TCP** and **UDP**', 'Two different styles of delivering data between programs (lesson 3)'],
        ['**HTTP** and **HTTPS**', 'Fetching web pages. HTTPS is the secure version'],
        ['**DNS**', 'Looking up the address that belongs to a name like `www.example.com` (lesson 8)'],
      ],
    ),
    p('An **S** on the end of a protocol name usually means a **secure** version that uses **encryption**. Encryption scrambles the data so that only the intended receiver can unscramble and read it. Without encryption, data is sent in **plaintext** (also called clear text), and anyone who can see the packets can read them, including passwords.'),

    h('Clients and servers', { keep: 'The client asks and the server answers. A server is a role (a program listening for requests), not a special kind of box.' }),
    p('Most network conversations have two sides. The **client** asks for something and the **server** answers. Your web browser is a client. The computer that holds the website is a server.'),
    p('"Server" describes a **role**, not a special kind of box. A server is just a program that waits for requests. Waiting for requests is called **listening**. The same laptop can be a client when it browses the web and a server when it shares a folder with other computers.'),
    analogy('A restaurant. You (the client) order from the menu. The kitchen (the server) waits for orders, prepares them and sends them out. The kitchen never phones you to suggest dinner: it only responds to orders.'),

    h('Local networks and the internet', { keep: 'A LAN is the network in one place; the internet is millions of networks joined by routers. A switch connects devices inside a LAN, a router connects networks.' }),
    p('A **LAN** (local area network) is the network in one place: your home, an office floor, a school. Devices on the same LAN can reach each other **directly**. Two boxes usually build a LAN:'),
    list(
      'A **switch**: a box with many network sockets. Every wired device plugs into it, and it passes packets between them (lesson 6 shows how it knows where to send each one).',
      'A **wireless access point**: a box that lets Wi-Fi devices join the same network without a cable.',
    ),
    p('The **internet** is not one giant network. It is **millions of separate networks** joined together. The boxes that join one network to another are called **routers**. A router reads the destination IP address in a packet\'s header and passes the packet one step closer to the network it is going to. Each step from one router to the next is called a **hop**, and a packet crossing the internet might take 10 to 20 hops.'),
    p('Your home "router" is really several boxes in one case: a switch (the sockets on the back), a wireless access point, a router, and a **firewall** (a guard that blocks traffic that is not allowed, covered in lesson 9). The company that connects that box to the rest of the internet is your **ISP** (internet service provider).'),
    {
      type: 'flow',
      caption: 'Loading a web page: your packets leave your LAN through your router, hop across many routers on the internet, and arrive at the web server\'s network.',
      nodes: [
        { label: 'Your laptop', sub: 'A client on your home LAN', tone: 'accent' },
        { label: 'Your home router', sub: 'Switch, Wi-Fi, router and firewall in one box', tone: 'neutral' },
        { label: 'Your ISP', sub: 'Its routers connect you to the internet', tone: 'neutral' },
        { label: 'The internet', sub: 'Many routers, each passing the packet one hop closer', tone: 'warn' },
        { label: 'The website\'s network', sub: 'Its own routers and firewall', tone: 'neutral' },
        { label: 'Web server', sub: 'The server that answers your request', tone: 'safe' },
      ],
    },
    p('Bigger networks have names too. A **WAN** (wide area network) links LANs that are far apart, such as a company\'s offices in different cities. A **MAN** (metropolitan area network) covers a city or a campus. The internet is the biggest WAN of all.'),
    exam('Security+ assumes you already know the basics in this course: what addresses, ports, protocols, switches and routers are. It rarely asks about them directly, but it constantly builds questions on top of them ("which device should be placed...", "which port should be blocked..."). That is why this groundwork matters.'),

    pbq('Try it: labels, clients and servers', START_LABELS, { intro: 'A quick check on the three labels and the two roles before you move on. Pick an answer for each line, then check.' }),

    hSecure('Why every one of these ideas matters for security', { keep: 'Every idea in this lesson is also something attackers abuse, which is why Security+ builds on all of it.' }),
    p('Each idea in this lesson is also something attackers abuse. You will see the defenses in later lessons, but it helps to know now why you are learning each one:'),
    table(
      ['Idea', 'What can go wrong', 'Defense in'],
      [
        ['Packets travel through many devices', 'Anyone along the path can read plaintext packets', 'Encryption, lessons 5 and 10'],
        ['Addresses in the header', 'Attackers can fake (**spoof**) the source address', 'Lesson 2'],
        ['Programs listening on ports', 'Every listening program is a door an attacker can try', 'Lesson 3'],
        ['Switches and routers', 'Whoever controls them controls the traffic', 'Lessons 6 and 11'],
        ['The helper protocols', 'Fake answers can send you to the wrong place', 'Lesson 8'],
      ],
    ),

    h('Your path through the rest of the course', { keep: 'Take the lessons in order: each one adds a single idea to the ones before.', optional: 'A map of the rest of the course. Skim it; there is nothing here to remember.' }),
    p('Each lesson adds one idea on top of the ones before it, so take them in order:'),
    steps(
      '**Addresses** (lesson 2): how IP and MAC addresses work, what a subnet mask is, and how a device decides whether to send a packet directly or to the router.',
      '**Ports, TCP and UDP** (lesson 3): how a packet reaches the right program, and the two styles of delivery.',
      '**The layers** (lesson 4): the "OSI model" that puts everything so far into one picture, which the exam refers to constantly.',
      '**The ports to know** (lesson 5): the port numbers you have to memorize, in sensible groups.',
      '**Switches and routers** (lesson 6) and **VLANs** (lesson 7): the boxes that move traffic, and how one network is split into safer pieces.',
      '**The helper protocols** (lesson 8): DHCP, DNS, ARP, ICMP and NAT, the quiet services every connection depends on.',
      '**Firewalls, VPNs and Wi-Fi** (lesson 9), then **one web request start to finish** (lesson 10), which ties everything together.',
      '**Hardening** (lesson 11): how to lock down network devices, which is where much of Security+ lives.',
    ),
  ],
  check: [
    mcq(
      'Why is a large file split into packets before it is sent?',
      'So many conversations can share a link and only damaged pieces need to be resent',
      ['So the file can be encrypted, because only small pieces can be encrypted', 'So the file goes to many different receivers at once', 'Because cables can only carry one byte at a time'],
      'Small packets let many conversations take turns on the same link, and if one packet is lost only that piece is sent again. Encryption works on data of any size, and packets of one file all go to the same receiver.',
    ),
    mcq(
      'What does a router do?',
      'It joins networks together and passes packets one hop closer to their destination',
      ['It gives every device on the network a name', 'It stores websites so they load faster', 'It turns bits into radio waves for Wi-Fi'],
      'Routers read the destination IP address and forward each packet toward the right network. Naming is DNS\'s job, caching websites is a proxy\'s job, and turning bits into radio waves is the Wi-Fi radio\'s job.',
    ),
    mcq(
      'Your web browser asks a website for a page. In this conversation, which side is the server?',
      'The computer that holds the website and answers the request',
      ['Your web browser, because it starts the conversation', 'Your home router, because the traffic passes through it', 'Whichever device has the faster connection'],
      'The client asks and the server answers. The browser is the client. A router only passes packets along, and speed has nothing to do with which side is the server.',
    ),
    mcq(
      'What is a protocol?',
      'An agreed set of rules that two devices follow so they understand each other',
      ['A cable that connects two devices', 'A password that protects a network', 'The address of a device on the internet'],
      'A protocol defines how a conversation starts, how messages are laid out and how to reply. Both sides must use the same protocol to understand each other.',
    ),
  ],
};
