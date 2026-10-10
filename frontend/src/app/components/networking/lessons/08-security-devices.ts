import { LessonBody } from '../networking.model';
import { exam, h, hSecure, list, mcq, p, table, trap } from './dsl';

export const SECURITY_DEVICES: LessonBody = {
  goals: [
    'Read a firewall rule list from the top and predict what happens to a packet',
    'Tell packet-filter, stateful and next-generation firewalls and a WAF apart',
    'Explain where a screened subnet sits and why public servers go there',
    'Describe what proxies and load balancers do',
    'Explain remote-access and site-to-site VPNs, and rank the Wi-Fi security standards',
  ],
  blocks: [
    h('Firewalls: the rule-based guard'),
    p('A **firewall** allows or blocks traffic according to rules. Each rule names a source, a destination, a port and protocol, and an action. The firewall reads the rules **from the top down**, the **first match wins**, and traffic that matches nothing is **denied** (this is called **implicit deny**).'),
    table(
      ['#', 'Source', 'Destination', 'Port', 'Action'],
      [
        ['1', 'Any', 'Web server `10.0.1.10`', 'TCP 443', 'Allow'],
        ['2', 'Admin PC `10.0.5.20`', 'Any', 'TCP 22', 'Allow'],
        ['3', 'Any', 'Any', 'Any', 'Deny (implicit)'],
      ],
      { caption: 'A tiny rule list. HTTPS to the web server is allowed, the admin PC can use SSH, and everything else is dropped.', mono: [0] },
    ),
    trap('**Order matters.** If an "allow any to any" rule sits above a more specific "deny Telnet" rule, the deny never fires, because the first match wins. Specific rules go **first** and broad rules go last.'),
    table(
      ['Firewall type', 'Looks at', 'Notes'],
      [
        ['Packet filter (stateless)', 'Each packet on its own: IPs, ports and protocol', 'Fast and simple, with no memory of connections'],
        ['Stateful', 'The same, plus a table of active connections', 'Return traffic for an established connection is allowed automatically'],
        ['Next-generation firewall (NGFW)', 'Applications, users, content and threats', 'Stateful filtering plus an IPS, TLS inspection and application awareness'],
        ['Web application firewall (WAF)', 'HTTP and HTTPS requests', 'Blocks SQL injection and cross-site scripting in front of a website'],
        ['Host-based firewall', 'Traffic to and from one device', 'Protects the device even when it is on an untrusted network'],
      ],
    ),

    h('Where firewalls sit: zones and the screened subnet'),
    p('Networks are divided into **zones** by trust, and firewalls enforce the rules where zones meet. Public-facing servers (web, mail, DNS) must be reachable from the internet, but you do not want them on the same network as your staff and databases. So they go in a **screened subnet** (formerly called a **DMZ**): a buffer zone between two firewalls.'),
    {
      type: 'flow',
      caption: 'If the public web server is compromised, the attacker is still outside the internal firewall.',
      nodes: [
        { label: 'Internet', sub: 'Untrusted', tone: 'danger' },
        { label: 'External firewall', sub: 'Lets only web, mail and DNS traffic in', tone: 'accent' },
        { label: 'Screened subnet (DMZ)', sub: 'Public web server, mail gateway, public DNS', tone: 'warn' },
        { label: 'Internal firewall', sub: 'Allows only specific flows from the screened subnet inward', tone: 'accent' },
        { label: 'Internal network', sub: 'Staff, databases and file servers: trusted', tone: 'safe' },
      ],
    },
    p('A cheaper variant uses **one firewall with three interfaces** (outside, inside and screened subnet), sometimes called a three-legged firewall.'),

    h('Proxies and load balancers'),
    table(
      ['Device', 'Sits in front of', 'What it does'],
      [
        ['Forward proxy', 'Your users', 'Users reach the internet through it. It can filter sites, cache content and log activity'],
        ['Reverse proxy', 'Your servers', 'The internet reaches the proxy, which forwards to the real servers. It hides them, offloads TLS and can add a WAF'],
        ['Load balancer', 'A group of servers', 'Spreads requests across servers and checks their health, which improves availability and removes a single point of failure'],
        ['Jump server (bastion host)', 'Management access', 'A hardened host that administrators connect through to reach sensitive systems'],
      ],
    ),

    h('VPNs: a private tunnel over a public network'),
    p('A **VPN** (virtual private network) wraps traffic in an encrypted tunnel so it can cross an untrusted network such as the internet safely. There are two main shapes:'),
    table(
      ['Type', 'Connects', 'Typical use'],
      [
        ['Remote-access VPN', 'One user\'s device to the company network', 'Working from home or a hotel'],
        ['Site-to-site VPN', 'Two networks together, through gateways', 'Linking a branch office to headquarters'],
      ],
    ),
    list(
      '**IPsec** works at Layer 3 and uses IKE on UDP 500 to set up keys and ESP to encrypt. **TLS VPNs** run over port 443 and pass through almost any firewall. **L2TP** needs IPsec for encryption, and **PPTP** is obsolete.',
      '**Full tunnel** sends all of the user\'s traffic through the VPN, so company inspection still applies. **Split tunnel** sends only company-bound traffic through the VPN and the rest straight to the internet, which saves bandwidth but bypasses company security controls.',
    ),

    h('Wi-Fi basics'),
    p('An access point announces a network name (the **SSID**) and connects wireless devices to the wired network. Wi-Fi uses shared radio, so anyone nearby can listen, which is why encryption is essential.'),
    table(
      ['Standard', 'Verdict', 'Why'],
      [
        ['Open (no password)', 'Unsafe', 'Nothing is encrypted'],
        ['WEP', 'Broken', 'Can be cracked in minutes'],
        ['WPA (TKIP)', 'Deprecated', 'A stop-gap fix for WEP hardware'],
        ['WPA2 (AES-CCMP)', 'Good', 'Strong encryption, but a captured Personal-mode handshake can be attacked offline with a dictionary'],
        ['WPA3 (SAE)', 'Best', 'Resists offline guessing, gives forward secrecy and protects management frames'],
      ],
      { caption: 'Personal mode uses one shared password. Enterprise mode uses 802.1X and a RADIUS server so each user has their own login.' },
    ),
    p('The Wi-Fi attacks to know are the **evil twin** (a rogue access point copying a real network name), a **rogue access point** (any unapproved AP), **deauthentication** floods that kick users off, **jamming**, and **WPS PIN** brute force.'),
    exam('"Which control stops an attacker setting up an access point with your company\'s network name?" Wireless intrusion prevention (WIPS) plus 802.1X with certificate validation. "Which Wi-Fi mode gives each user their own credentials?" Enterprise (802.1X with RADIUS).'),

    hSecure('How to secure it: firewalls, Wi-Fi and VPNs'),
    {
      type: 'harden',
      title: 'Harden a firewall',
      items: [
        { action: 'Default deny in both directions', why: 'Block everything and allow only what is needed. Egress (outbound) rules stop malware calling home and data leaving.' },
        { action: 'Keep the rule list clean', why: 'Remove "any to any" rules, stale and duplicate rules, and rules nobody owns. Every rule should have a reason, an owner and a ticket, and the list should be reviewed regularly.' },
        { action: 'Put specific rules before general ones, and log the denies', why: 'Rule order decides the outcome. Logged denies show scans and attacks.' },
        { action: 'Protect the firewall\'s own management', why: 'Change the default admin account, use MFA, allow management only from a management network, and disable Telnet and plain HTTP management.' },
        { action: 'Patch the firmware promptly', why: 'Firewalls and VPN gateways face the internet and are prime targets for exploits.' },
        { action: 'Turn on stateful inspection, an IPS and anti-spoofing', why: 'Block packets with impossible source addresses and known attack signatures.' },
        { action: 'Send logs to a central system, keep time in sync and control changes', why: 'So investigations and alerts work. Back up the configuration and make rule changes through change management.' },
      ],
    },
    {
      type: 'harden',
      title: 'Harden Wi-Fi',
      items: [
        { action: 'Use WPA3 (or WPA2 with AES), and Enterprise mode where you can', why: 'Individual logins through 802.1X can be revoked one at a time and leave no shared password to leak.' },
        { action: 'Use a long, unique passphrase for Personal mode', why: 'It is exactly what an offline attack has to guess.' },
        { action: 'Disable WPS, WEP and TKIP', why: 'WPS PINs can be brute-forced and the others are broken or deprecated.' },
        { action: 'Put guests on their own SSID and VLAN with client isolation', why: 'Guests get internet only and cannot see each other or your network.' },
        { action: 'Change default admin credentials and disable remote (WAN-side) administration', why: 'Default logins on routers and access points are scanned for constantly.' },
        { action: 'Use wireless intrusion prevention (WIDS and WIPS) and a site survey', why: 'To spot rogue access points and evil twins, and to size signal power so it does not spill far outside the building.' },
        { action: 'Do not rely on hiding the SSID', why: 'The name still appears in the airwaves, and tools find it instantly. It is not security.' },
      ],
    },
    {
      type: 'harden',
      title: 'Harden VPNs',
      items: [
        { action: 'Require MFA and use strong encryption', why: 'Prefer IKEv2 or TLS with modern ciphers. Retire PPTP and weak setups such as one pre-shared key shared by everyone.' },
        { action: 'Patch VPN gateways quickly', why: 'They are exposed to the internet and heavily targeted.' },
        { action: 'Limit what VPN users can reach', why: 'Apply least privilege after login, not full network access. Decide deliberately between full tunnel and a controlled split tunnel.' },
        { action: 'Log connections and alert on odd behavior', why: 'Logins from unexpected countries or at strange hours are an indicator of stolen credentials.' },
      ],
    },
  ],
  check: [
    mcq(
      'A firewall has these rules in order: 1) Allow any to any, 2) Deny TCP 23 to any. A user tries Telnet. What happens?',
      'It is allowed, because the first matching rule wins',
      ['It is denied, because specific rules always override general ones', 'It is denied, because Telnet is blocked by default', 'The firewall asks the administrator'],
      'Firewalls read rules from the top and stop at the first match. Rule 1 matches everything, so rule 2 never gets used. Specific rules must come first.',
    ),
    mcq(
      'Where should a public web server be placed to limit the damage if it is compromised?',
      'In a screened subnet (DMZ) between two firewalls',
      ['On the internal network next to the database', 'Outside any firewall, directly on the internet', 'On the same VLAN as the staff PCs'],
      'A screened subnet keeps public servers away from the internal network, so a compromise does not give direct access inside.',
    ),
    mcq(
      'Which Wi-Fi security standard uses SAE to resist offline dictionary attacks and also protects management frames?',
      'WPA3',
      ['WEP', 'WPA with TKIP', 'WPA2 Personal'],
      'WPA3 replaces the pre-shared-key handshake with SAE. WEP and TKIP are broken or deprecated, and WPA2 Personal is open to offline guessing of a captured handshake.',
    ),
    mcq(
      'Which VPN setting sends only company-bound traffic through the tunnel and everything else directly to the internet?',
      'Split tunneling',
      ['Full tunneling', 'Site-to-site tunneling', 'Port mirroring'],
      'Split tunneling saves bandwidth but lets that traffic bypass company security controls, which is why many organizations prefer a full tunnel.',
    ),
  ],
};
