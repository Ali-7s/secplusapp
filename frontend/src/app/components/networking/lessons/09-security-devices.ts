import { LessonBody } from '../networking.model';
import { analogy, exam, h, hSecure, list, mcq, p, recap, table, trap, words } from './dsl';

export const SECURITY_DEVICES: LessonBody = {
  goals: [
    'Read a firewall rule list from the top and predict what happens to a packet',
    'Tell packet-filter, stateful and next-generation firewalls and a WAF apart',
    'Explain where a screened subnet sits and why public servers go there',
    'Describe what proxies, load balancers and jump servers do',
    'Explain remote-access and site-to-site VPNs, and rank the Wi-Fi security standards',
  ],
  blocks: [
    recap('Packets carry source and destination **IP addresses** and **port numbers** (lessons 2 and 3). TCP sets up a **connection** with a handshake before data flows (lesson 3). **Encryption** scrambles data so only the receiver can read it (lesson 1).'),
    words(
      ['Firewall', 'A device or program that checks traffic against a list of rules and allows or blocks it'],
      ['Rule', 'One line in a firewall\'s list: which source, which destination, which port, and allow or block'],
      ['Implicit deny', 'The hidden last rule: anything not allowed by an earlier rule is blocked'],
      ['Stateful', 'Remembering conversations, so replies to a conversation you started are let back in automatically'],
      ['IDS / IPS', 'Intrusion detection / prevention system: watches traffic for signs of attack. An IDS alerts, an IPS also blocks'],
      ['Zone', 'A part of the network with one level of trust, such as "internet", "public servers" or "internal"'],
      ['Screened subnet (DMZ)', 'A buffer zone between the internet and the inside network, for servers the public must reach'],
      ['Proxy', 'A go-between that makes requests on someone else\'s behalf'],
      ['VPN', 'Virtual private network: an encrypted tunnel across an untrusted network such as the internet'],
      ['Tunnel', 'Traffic wrapped inside other traffic, so it can cross a network as if it were a private link'],
      ['SSID', 'The name a Wi-Fi network broadcasts, the one you pick from the list'],
      ['MFA', 'Multifactor authentication: proving who you are with two different things, such as a password plus a phone code'],
    ),

    h('Firewalls: the rule-based guard'),
    p('A **firewall** sits where traffic passes and checks each packet against a list of **rules**. Each rule names a **source** (where the traffic comes from), a **destination** (where it is going), a **port and protocol** (which service, lesson 3), and an **action**: allow or deny (block).'),
    p('Three facts decide what happens to any packet:'),
    list(
      'The firewall reads the rules **from the top down**.',
      'The **first rule that matches wins**, and the rest are ignored for that packet.',
      'If nothing matches, the packet is **blocked**. This hidden final rule is called **implicit deny**.',
    ),
    table(
      ['#', 'Source', 'Destination', 'Port', 'Action'],
      [
        ['1', 'Any', 'Web server `10.0.1.10`', 'TCP 443', 'Allow'],
        ['2', 'Admin PC `10.0.5.20`', 'Any', 'TCP 22', 'Allow'],
        ['3', 'Any', 'Any', 'Any', 'Deny (implicit)'],
      ],
      { caption: 'A tiny rule list. Anyone may reach the web server over HTTPS (443), the admin PC may use SSH (22) to anything, and everything else is blocked.', mono: [0] },
    ),
    analogy('A bouncer with a list, reading from the top. "Rule 1: anyone with a ticket for the concert hall, let in. Rule 2: the manager, let in anywhere." The bouncer stops at the first line that fits the person in front of them. If no line fits, they do not get in.'),
    trap('**Order matters.** If an "allow everything" rule sits above a more specific "block Telnet" rule, the block never happens, because the first match wins. Specific rules go **first** and broad rules go **last**.'),

    h('Kinds of firewall'),
    p('Firewalls differ in how much they understand about the traffic:'),
    list(
      'A **packet filter** (also called **stateless**) judges each packet on its own, by addresses, ports and protocol, with no memory. It is fast and simple, but it does not know whether a packet is a reply to something you asked for, so you have to write extra rules for replies.',
      'A **stateful** firewall also keeps a **state table**: a list of the conversations currently open. When your laptop starts a connection to a website, the firewall notes it, and the website\'s replies are recognized as part of that conversation and let back in automatically. Traffic from the internet that nobody asked for has no entry, so it is blocked.',
      'A **next-generation firewall (NGFW)** is stateful and also understands **which application** the traffic belongs to (not just which port), **which user** sent it, and what the content is. It usually includes an **IPS** (below) and can decrypt and inspect encrypted traffic (**TLS inspection**).',
      'A **web application firewall (WAF)** sits in front of a website and reads the actual web requests, blocking attacks aimed at the website itself, such as **SQL injection** (sneaking database commands into a form) and **cross-site scripting** (sneaking malicious script into a page).',
      'A **host-based firewall** runs on one device and protects just that device, even when it is on an untrusted network like hotel Wi-Fi.',
    ),
    table(
      ['Firewall type', 'Looks at', 'Remembers conversations?'],
      [
        ['Packet filter (stateless)', 'Addresses, ports, protocol', 'No'],
        ['Stateful', 'The same, plus the state table', 'Yes'],
        ['Next-generation (NGFW)', 'Also applications, users and content', 'Yes'],
        ['Web application firewall (WAF)', 'The contents of web requests', 'Yes, for web traffic'],
        ['Host-based', 'Traffic to and from one device', 'Usually yes'],
      ],
    ),
    p('Related to firewalls are **IDS** and **IPS** (intrusion detection and intrusion prevention systems). They watch traffic for signs of attack, using known attack patterns (**signatures**) or unusual behavior. An IDS only **alerts** someone; an IPS sits in the path of the traffic and can **block** it too.'),

    h('Where firewalls sit: zones and the screened subnet'),
    p('Networks are divided into **zones** by how much they are trusted: the internet (not trusted at all), servers the public must reach (somewhat trusted), and the internal network (trusted). Firewalls enforce the rules where zones meet.'),
    p('Public-facing servers, such as a website, mail server or public DNS, must be reachable from the internet. But you do not want them sitting next to your staff PCs and databases, because a public server is the most likely thing to be hacked. So they go in a **screened subnet**: a buffer zone with a firewall on each side. Its older name, still widely used, is **DMZ** (demilitarized zone).'),
    {
      type: 'flow',
      caption: 'If the public web server is broken into, the attacker is still outside the internal firewall.',
      nodes: [
        { label: 'Internet', sub: 'Not trusted', tone: 'danger' },
        { label: 'External firewall', sub: 'Lets only web, mail and DNS traffic in', tone: 'accent' },
        { label: 'Screened subnet (DMZ)', sub: 'Public web server, mail server, public DNS', tone: 'warn' },
        { label: 'Internal firewall', sub: 'Allows only specific traffic from the screened subnet inward', tone: 'accent' },
        { label: 'Internal network', sub: 'Staff, databases and file servers: trusted', tone: 'safe' },
      ],
    },
    p('A cheaper version uses **one firewall with three connections** (internet, inside and screened subnet), sometimes called a three-legged firewall.'),

    h('Proxies, load balancers and jump servers'),
    table(
      ['Device', 'Sits in front of', 'What it does'],
      [
        ['Forward proxy', 'Your users', 'Your users reach the internet through it. It can block bad sites, keep copies of popular pages, and log activity'],
        ['Reverse proxy', 'Your servers', 'Visitors from the internet reach the proxy, which passes requests to the real servers behind it. It hides them, can handle their encryption, and can include a WAF'],
        ['Load balancer', 'A group of identical servers', 'Spreads visitors across the servers and skips any that are unhealthy, so the site stays up even if one server fails'],
        ['Jump server (bastion host)', 'Sensitive systems', 'One locked-down computer that administrators must log in to first, before reaching important servers. One door to guard instead of many'],
      ],
    ),
    analogy('A forward proxy is like a personal assistant who makes calls for you: the other side only sees the assistant. A reverse proxy is like a company\'s receptionist: callers only ever talk to the receptionist, who passes messages to the right person inside.'),

    h('VPNs: a private tunnel over a public network'),
    p('A **VPN** (virtual private network) wraps traffic in an encrypted **tunnel**, so it can cross an untrusted network such as the internet or café Wi-Fi as safely as if it were a private cable. Anyone watching sees only scrambled data going to the VPN server. There are two main shapes:'),
    table(
      ['Type', 'Connects', 'Typical use'],
      [
        ['Remote-access VPN', 'One person\'s device to the company network', 'Working from home or a hotel'],
        ['Site-to-site VPN', 'Two whole networks, through a VPN box at each end', 'Linking a branch office to headquarters'],
      ],
    ),
    list(
      '**IPsec** is a common VPN technology that encrypts whole packets. It uses a setup protocol called **IKE** (UDP 500) to agree on encryption keys, and a protocol called **ESP** to carry the encrypted data. **TLS VPNs** use the same encryption as HTTPS on port 443, so they get through almost any firewall. **L2TP** needs IPsec added for encryption, and **PPTP** is old and broken.',
      'A **full tunnel** sends **all** of the user\'s traffic through the VPN, so the company\'s security checks still apply to everything. A **split tunnel** sends only company traffic through the VPN and everything else straight to the internet. That saves bandwidth, but that other traffic skips the company\'s protections.',
    ),

    h('Wi-Fi basics'),
    p('A wireless **access point** broadcasts a network name, called the **SSID**, and connects Wi-Fi devices to the wired network (lesson 6). Wi-Fi travels through the air, so **anyone nearby can capture it**. That is why encryption is essential. The security standards, from worst to best:'),
    table(
      ['Standard', 'Verdict', 'Why'],
      [
        ['Open (no password)', 'Unsafe', 'Nothing is encrypted'],
        ['WEP', 'Broken', 'Can be cracked in minutes'],
        ['WPA (with TKIP)', 'Outdated', 'A stopgap fix for WEP, now also weak'],
        ['WPA2 (with AES)', 'Good', 'Strong encryption (AES). Its weakness: an attacker can record the moment a device joins (the **handshake**) and then guess the password offline, trying millions of words without being noticed'],
        ['WPA3 (with SAE)', 'Best', 'A new joining method (**SAE**) that stops offline guessing, keeps old traffic safe even if the password leaks later, and protects the control messages Wi-Fi devices send each other'],
      ],
    ),
    p('Each standard comes in two modes:'),
    list(
      '**Personal** mode: everyone uses one shared password. Simple, but one leaked password exposes everyone, and removing one person means changing it for all.',
      '**Enterprise** mode: each person logs in with their own username and password or certificate, checked by a central login server (**RADIUS**, lesson 5) using **802.1X**. One person\'s access can be removed without affecting anyone else.',
    ),
    p('The Wi-Fi attacks to know:'),
    list(
      '**Evil twin**: an attacker\'s access point copying the name of a real network, so devices join it instead.',
      '**Rogue access point**: any access point plugged into the network without permission, often by an employee wanting better signal.',
      '**Deauthentication attack**: sending fake "disconnect" messages to knock devices off the network, often to capture the handshake when they rejoin.',
      '**Jamming**: drowning out the radio signal so nobody can connect.',
      '**WPS attack**: guessing the short PIN of the "push button" setup feature (WPS) found on many routers.',
    ),
    exam('"Which control stops an attacker setting up an access point with your company\'s network name?" A **wireless intrusion prevention system (WIPS)**, plus 802.1X with certificate checking. "Which Wi-Fi mode gives each user their own login?" Enterprise mode (802.1X with RADIUS).'),

    hSecure('How to secure it: firewalls, Wi-Fi and VPNs'),
    {
      type: 'harden',
      title: 'Harden a firewall',
      items: [
        { action: 'Block by default, in both directions', why: 'Block everything and allow only what is needed. Rules on outgoing traffic (**egress** rules) stop malware contacting its owner and stop data leaving.' },
        { action: 'Keep the rule list clean', why: 'Remove "allow anything to anything" rules, old and duplicate rules, and rules nobody can explain. Every rule should have a reason and an owner, and the list should be reviewed regularly.' },
        { action: 'Put specific rules before general ones, and log what gets blocked', why: 'Rule order decides the outcome. Logs of blocked traffic reveal scans and attacks.' },
        { action: 'Protect the firewall\'s own admin login', why: 'Change the default admin account, require MFA, allow admin logins only from an admin network, and turn off plaintext admin pages.' },
        { action: 'Update the firewall\'s software promptly', why: 'Firewalls and VPN boxes face the internet, so attackers target their flaws as soon as they are announced.' },
        { action: 'Use stateful inspection, an IPS, and anti-spoofing', why: 'Block packets claiming impossible source addresses (lesson 2) and traffic matching known attacks.' },
        { action: 'Send logs to a central system, keep the clock in sync, and control changes', why: 'So alerts and investigations work. Back up the settings, and make rule changes through an approval process (**change management**) so nobody weakens a rule by accident.' },
      ],
    },
    {
      type: 'harden',
      title: 'Harden Wi-Fi',
      items: [
        { action: 'Use WPA3 (or at least WPA2 with AES), and Enterprise mode where you can', why: 'Personal logins through 802.1X can be removed one at a time, and there is no shared password to leak.' },
        { action: 'Use a long, unique passphrase in Personal mode', why: 'It is exactly what an offline guessing attack has to find.' },
        { action: 'Turn off WPS, WEP and TKIP', why: 'WPS PINs can be guessed, and the others are broken or outdated.' },
        { action: 'Put guests on their own network name and VLAN, with client isolation', why: 'Guests get the internet only, and **client isolation** stops guest devices from reaching each other.' },
        { action: 'Change default admin passwords and turn off admin access from the internet', why: 'Default logins on routers and access points are scanned for constantly.' },
        { action: 'Use wireless intrusion detection or prevention (WIDS or WIPS), and do a site survey', why: 'To spot rogue access points and evil twins. A **site survey** (measuring the signal around the building) helps set the power so the signal does not spill far outside.' },
        { action: 'Do not rely on hiding the network name', why: 'A "hidden" SSID still appears in the radio traffic, and free tools reveal it instantly. It is not security.' },
      ],
    },
    {
      type: 'harden',
      title: 'Harden VPNs',
      items: [
        { action: 'Require MFA and use strong encryption', why: 'Use modern setups (IKEv2 or TLS). Retire PPTP and weak setups such as one shared password for every user.' },
        { action: 'Update VPN boxes quickly', why: 'They face the internet and are heavily targeted.' },
        { action: 'Limit what VPN users can reach', why: 'After login, give people access only to what they need, not the whole network, and choose between full and split tunnel on purpose.' },
        { action: 'Log connections and alert on odd behavior', why: 'Logins from unexpected countries or at strange hours are a sign of a stolen password.' },
      ],
    },
  ],
  check: [
    mcq(
      'A firewall has these rules in order: 1) Allow any to any, 2) Deny TCP 23 to any. A user tries Telnet. What happens?',
      'It is allowed, because the first matching rule wins',
      ['It is denied, because specific rules always override general ones', 'It is denied, because Telnet is blocked by default', 'The firewall asks the administrator'],
      'Firewalls read rules from the top and stop at the first match. Rule 1 matches everything, so rule 2 is never reached. Specific rules must come first.',
    ),
    mcq(
      'Where should a public web server be placed to limit the damage if it is broken into?',
      'In a screened subnet (DMZ) between two firewalls',
      ['On the internal network next to the database', 'Outside any firewall, directly on the internet', 'On the same VLAN as the staff PCs'],
      'A screened subnet keeps public servers away from the internal network, so a compromise does not give direct access inside.',
    ),
    mcq(
      'Which Wi-Fi security standard uses SAE to stop offline password guessing and also protects Wi-Fi control messages?',
      'WPA3',
      ['WEP', 'WPA with TKIP', 'WPA2 Personal'],
      'WPA3 replaces the old joining handshake with SAE. WEP and TKIP are broken or outdated, and a captured WPA2 Personal handshake can be guessed offline.',
    ),
    mcq(
      'Which VPN setting sends only company traffic through the tunnel and everything else directly to the internet?',
      'Split tunnel',
      ['Full tunnel', 'Site-to-site tunnel', 'Port mirroring'],
      'A split tunnel saves bandwidth but lets that other traffic skip the company\'s security controls, which is why many organizations prefer a full tunnel.',
    ),
  ],
};
