import { FirewallQuestion, MatchQuestion, OrderQuestion } from '../../../models/exam.model';

/**
 * Guided PBQs for the Networking Basics lessons. They use the practice exam's question format, so the same
 * grading and per-part explanations apply, but they are pitched at the lesson they sit in: only ideas the
 * learner has already met, with plain-English reasons for every part.
 */

const rule = (Source: string, Destination: string, Protocol: string, Port: string, Action: string) =>
  ({ Source, Destination, Protocol, Port, Action });

// ── Lesson 9: firewalls ─────────────────────────────────────────────────

export const FIREWALL_GUIDED: FirewallQuestion = {
  id: 'lesson-fw-office', domain: 3, objective: '3.2', kind: 'firewall',
  scenario: 'A small company has one firewall. Its public website lives in a screened subnet, and its staff sit on the office network. You are writing the firewall\'s rule list.',
  exhibit: [
    'Internet ── [FIREWALL] ─┬─ Screened subnet 10.0.20.0/24',
    '                        │    WEB1   10.0.20.10  website (HTTPS)',
    '                        │',
    '                        └─ Office network 10.0.10.0/24',
    '                             ADMIN  10.0.10.5   IT admin\'s PC',
    '                             Staff  rest of 10.0.10.0/24',
  ].join('\n'),
  stem: 'Fill in rules 2 to 4 so the list meets every requirement, giving each rule only the access it needs.',
  requirements: [
    'Anyone on the internet can view the company website, but only over an encrypted connection.',
    'The IT administrator\'s PC, and no other PC, can log in to WEB1 remotely with an encrypted command line.',
    'All staff PCs can browse websites on the internet, using encrypted web traffic only.',
    'Everything else is blocked.',
  ],
  columns: ['Source', 'Destination', 'Protocol', 'Port', 'Action'],
  choices: {
    Source: ['Any', '10.0.10.0/24', '10.0.10.5', '10.0.20.10'],
    Destination: ['Any', '10.0.20.10', '10.0.20.0/24', '10.0.10.0/24'],
    Protocol: ['TCP', 'UDP', 'Any'],
    Port: ['Any', '22', '23', '80', '443', '3389'],
    Action: ['Allow', 'Deny'],
  },
  rows: [
    {
      answer: rule('Any', '10.0.20.10', 'TCP', '443', 'Allow'),
      why: 'Visitors can come from anywhere, so the source is Any. The destination is only WEB1, not the whole screened subnet. Encrypted web traffic is HTTPS, which is TCP port 443 (port 80 would be unencrypted HTTP).',
    },
    {
      answer: rule('10.0.10.5', '10.0.20.10', 'TCP', '22', 'Allow'),
      why: 'An encrypted command line is SSH, on TCP port 22 (Telnet on 23 is plaintext, and 3389 is graphical Remote Desktop). Only the admin PC is allowed, so the source is its single address, not the whole office network, and the destination is only WEB1.',
    },
    {
      answer: rule('10.0.10.0/24', 'Any', 'TCP', '443', 'Allow'),
      why: 'All staff PCs live in 10.0.10.0/24, so that whole network is the source. Websites can be anywhere on the internet, so the destination is Any. Encrypted web only means TCP 443 and not 80.',
    },
    {
      answer: rule('Any', 'Any', 'Any', 'Any', 'Deny'),
      why: 'The last rule blocks anything the rules above did not allow, from any source to any destination, on any protocol and port. It must be last: placed first, it would block everything, because the first match wins.',
    },
  ],
  takeaway: 'Build each rule from the requirement: who (source), to what (destination), which service (protocol and port), and allow or deny. Use the narrowest source and destination that still works, and end with a rule that blocks everything else.',
};

export const FIREWALL_TRACE: MatchQuestion = {
  id: 'lesson-fw-trace', domain: 4, objective: '4.5', kind: 'match',
  scenario: 'Here is the same company\'s firewall a month later. Someone has added a rule. The firewall reads the list from the top, and the first rule that matches decides.',
  exhibit: [
    ' #  Source         Destination    Protocol  Port   Action',
    ' 1  Any            10.0.20.10     TCP       443    Allow',
    ' 2  10.0.10.5      10.0.20.10     TCP       22     Allow',
    ' 3  Any            10.0.20.10     TCP       22     Deny',
    ' 4  10.0.10.0/24   Any            TCP       443    Allow',
    ' 5  Any            Any            Any       Any    Deny',
    '',
    'WEB1 = 10.0.20.10   Admin PC = 10.0.10.5   Staff PC = 10.0.10.30',
  ].join('\n'),
  stem: 'For each connection attempt, choose which rule decides what happens.',
  choices: ['Allowed by rule 1', 'Allowed by rule 2', 'Denied by rule 3', 'Allowed by rule 4', 'Denied by rule 5'],
  prompts: [
    { label: 'A visitor on the internet opens the website on WEB1 (TCP 443)', answer: 'Allowed by rule 1', why: 'Rule 1 allows any source to reach WEB1 on TCP 443, and it is the first rule that matches.' },
    { label: 'The admin PC logs in to WEB1 with SSH (TCP 22)', answer: 'Allowed by rule 2', why: 'Rule 1 does not match (wrong port). Rule 2 matches exactly: source 10.0.10.5, destination WEB1, TCP 22. The check stops there, so rule 3 is never reached.' },
    { label: 'The staff PC tries to log in to WEB1 with SSH (TCP 22)', answer: 'Denied by rule 3', why: 'Rule 2 only matches the admin PC\'s address, so it does not apply. Rule 3 matches any source going to WEB1 on TCP 22, and blocks it.' },
    { label: 'The staff PC opens a news website on the internet (TCP 443)', answer: 'Allowed by rule 4', why: 'Rules 1 to 3 are all about WEB1, so none match. Rule 4 allows the office network to reach any destination on TCP 443.' },
    { label: 'The staff PC opens the company website on WEB1 (TCP 443)', answer: 'Allowed by rule 1', why: 'It is tempting to pick rule 4 because the source is a staff PC, but rule 1 already matches (any source to WEB1 on 443), and the first match wins.' },
    { label: 'An attacker on the internet tries Remote Desktop on WEB1 (TCP 3389)', answer: 'Denied by rule 5', why: 'No rule allows port 3389, so the packet falls through to rule 5, which blocks everything else.' },
    { label: 'The staff PC opens a website over plain HTTP (TCP 80)', answer: 'Denied by rule 5', why: 'Rule 4 only allows port 443, not 80. Nothing above rule 5 matches, so unencrypted web browsing is blocked.' },
  ],
  takeaway: 'To trace a packet, go down the list and stop at the first rule where every field matches: source, destination, protocol and port. If nothing matches, the block-everything rule at the bottom decides.',
};

export const FIREWALL_PLACEMENT: MatchQuestion = {
  id: 'lesson-fw-placement', domain: 3, objective: '3.2', kind: 'match',
  stem: 'Decide where each server belongs, then which kind of firewall fits each job.',
  scenario: 'A company is redesigning its network with an internet edge, a screened subnet (DMZ) between two firewalls, and an internal network.',
  prompts: [
    { group: 'Where does each server go?', label: 'The public company website', answer: 'Screened subnet (DMZ)', choices: ['Screened subnet (DMZ)', 'Internal network'], why: 'The public must reach it, so it goes in the screened subnet. If it is hacked, the internal firewall still stands between the attacker and the staff.' },
    { group: 'Where does each server go?', label: 'The mail server that receives email from the internet', answer: 'Screened subnet (DMZ)', choices: ['Screened subnet (DMZ)', 'Internal network'], why: 'Other mail servers on the internet must be able to connect to it, which makes it public facing.' },
    { group: 'Where does each server go?', label: 'The HR database with employee records', answer: 'Internal network', choices: ['Screened subnet (DMZ)', 'Internal network'], why: 'Nobody on the internet should ever reach it directly, so it stays behind both firewalls.' },
    { group: 'Where does each server go?', label: 'The staff file server', answer: 'Internal network', choices: ['Screened subnet (DMZ)', 'Internal network'], why: 'Only staff use it. Putting it in the screened subnet would expose it for no reason.' },
    { group: 'Which kind of firewall fits?', label: 'Blocks SQL injection attacks aimed at the company website', answer: 'Web application firewall (WAF)', choices: ['Packet filter', 'Stateful firewall', 'Web application firewall (WAF)', 'Host-based firewall'], why: 'Only a WAF reads the contents of web requests, which is where SQL injection hides. The others only see addresses, ports and connections.' },
    { group: 'Which kind of firewall fits?', label: 'Lets replies to staff browsing back in automatically, but blocks traffic nobody asked for', answer: 'Stateful firewall', choices: ['Packet filter', 'Stateful firewall', 'Web application firewall (WAF)', 'Host-based firewall'], why: 'A stateful firewall remembers each conversation in its state table, so replies are recognized and unrequested traffic is not.' },
    { group: 'Which kind of firewall fits?', label: 'Protects a salesperson\'s laptop on hotel Wi-Fi', answer: 'Host-based firewall', choices: ['Packet filter', 'Stateful firewall', 'Web application firewall (WAF)', 'Host-based firewall'], why: 'On hotel Wi-Fi the laptop is far from the company firewalls. Only a firewall running on the laptop itself can protect it there.' },
  ],
  takeaway: 'Public-facing servers go in the screened subnet; everything only staff use stays internal. Match the firewall to what it must understand: addresses and ports, conversations, web content, or one device.',
};

// ── Lesson 2: addresses ─────────────────────────────────────────────────

export const ADDRESS_DECISION: MatchQuestion = {
  id: 'lesson-addr-decision', domain: 3, objective: '3.2', kind: 'match',
  scenario: 'Your PC has the IP address 192.168.10.20, the mask 255.255.255.0 and the default gateway 192.168.10.1.',
  stem: 'For each destination, decide whether the PC delivers the packet directly or hands it to the default gateway.',
  choices: ['Directly (same network)', 'To the default gateway'],
  prompts: [
    { label: '192.168.10.75', answer: 'Directly (same network)', why: 'The mask makes the first three octets the network. 192.168.10 matches 192.168.10, so it is on the same network.' },
    { label: '192.168.11.75', answer: 'To the default gateway', why: 'The third octet differs (11 instead of 10), so this is another network and the router has to take it.' },
    { label: '8.8.8.8', answer: 'To the default gateway', why: '8.8.8 is nothing like 192.168.10, so this is an internet address on another network.' },
    { label: '192.168.10.1 (the router itself)', answer: 'Directly (same network)', why: 'The gateway must be on the PC\'s own network, otherwise the PC could not reach it. 192.168.10 matches.' },
    { label: '192.168.11.75, if the mask were 255.255.0.0 instead', answer: 'Directly (same network)', why: 'With 255.255.0.0 only the first two octets are the network. 192.168 matches 192.168, so now it counts as the same network. The mask decides.' },
  ],
  takeaway: 'Line up the mask under the address: wherever it says 255, compare that octet with the destination. All match means deliver directly; any difference means send it to the default gateway.',
};

export const ADDRESS_TYPES: MatchQuestion = {
  id: 'lesson-addr-types', domain: 3, objective: '3.2', kind: 'match',
  stem: 'A technician is reviewing addresses seen on the network. What kind of address is each one?',
  scenario: 'Remember the special ranges: 10.x.x.x, 172.16 to 172.31, and 192.168.x.x are private; 127.x.x.x is loopback; 169.254.x.x is link-local (APIPA).',
  choices: ['Private', 'Public', 'Loopback', 'Link-local (APIPA)'],
  prompts: [
    { label: '10.4.8.200', answer: 'Private', why: 'Every address starting with 10 is in the private range 10.0.0.0/8.' },
    { label: '172.31.0.9', answer: 'Private', why: '172.31 is the last block of the private range 172.16 to 172.31.' },
    { label: '172.32.0.9', answer: 'Public', why: 'The private range stops at 172.31, so 172.32 is a public address. This is the classic trick.' },
    { label: '127.0.0.1', answer: 'Loopback', why: '127.0.0.1 always means "this computer itself" and never leaves the device.' },
    { label: '169.254.33.7', answer: 'Link-local (APIPA)', why: 'A 169.254 address means the device could not reach a DHCP server and gave itself an address.' },
    { label: '8.8.8.8', answer: 'Public', why: 'It is not in any special range, so it is a normal public internet address.' },
  ],
  takeaway: 'Private: 10, 172.16 to 172.31, 192.168. Loopback: 127. Link-local (APIPA): 169.254. Everything else is public.',
};

// ── Lesson 3: ports, TCP and UDP ────────────────────────────────────────

export const PORT_STATES: MatchQuestion = {
  id: 'lesson-ports-states', domain: 4, objective: '4.3', kind: 'match',
  stem: 'Classify each port from the scan reply, then pick TCP or UDP for each job.',
  scenario: 'You scan one of your own servers. An open port answers with SYN-ACK, a closed port answers with RST (reset), and a filtered port does not answer at all.',
  prompts: [
    { group: 'What state is each port in?', label: 'Port 443 replied SYN-ACK', answer: 'Open', choices: ['Open', 'Closed', 'Filtered'], why: 'A SYN-ACK is the second step of the handshake, so a program is listening and ready.' },
    { group: 'What state is each port in?', label: 'Port 25 replied RST', answer: 'Closed', choices: ['Open', 'Closed', 'Filtered'], why: 'A reset means the server is reachable but nothing is listening on that port.' },
    { group: 'What state is each port in?', label: 'Port 3389 sent no reply at all', answer: 'Filtered', choices: ['Open', 'Closed', 'Filtered'], why: 'Silence usually means a firewall dropped the probe before it reached the server.' },
    { group: 'TCP or UDP?', label: 'Downloading a software update', answer: 'TCP', choices: ['TCP', 'UDP'], why: 'A single missing piece would corrupt the file, so every piece must arrive and be checked.' },
    { group: 'TCP or UDP?', label: 'A live video call', answer: 'UDP', choices: ['TCP', 'UDP'], why: 'A late piece of sound is useless, so speed matters more than resending what was lost.' },
    { group: 'TCP or UDP?', label: 'Loading a web page', answer: 'TCP', choices: ['TCP', 'UDP'], why: 'The whole page has to arrive complete and in order.' },
    { group: 'TCP or UDP?', label: 'A quick DNS name lookup', answer: 'UDP', choices: ['TCP', 'UDP'], why: 'It is one small question and one small answer, so setting up a connection first would only slow it down.' },
  ],
  takeaway: 'SYN-ACK means open, RST means closed, silence means filtered. Use TCP when everything must arrive; use UDP when speed matters more than perfection.',
};

// ── Lesson 4: layers ────────────────────────────────────────────────────

export const LAYERS_WRAP: OrderQuestion = {
  id: 'lesson-layers-wrap', domain: 3, objective: '3.2', kind: 'order',
  stem: 'Your laptop is sending a web request. Put the wrapping steps in order, from the browser down to the cable.',
  items: [
    { text: 'The browser creates the request (data, layers 7 to 5)', why: 'Everything starts with the program\'s own data, at the top of the stack.' },
    { text: 'TCP adds a header with the port numbers (segment, layer 4)', why: 'The transport layer adds the ports so the reply reaches the right program.' },
    { text: 'IP adds a header with the IP addresses (packet, layer 3)', why: 'The network layer adds the source and destination IP addresses for the trip across networks.' },
    { text: 'Ethernet or Wi-Fi adds a header with MAC addresses and a trailer (frame, layer 2)', why: 'The data link layer adds the MAC addresses for the next hop on the local network.' },
    { text: 'The network card sends it as signals (bits, layer 1)', why: 'Finally the whole frame becomes electricity, light or radio waves.' },
  ],
  takeaway: 'Going out, each layer wraps the one above it: data, segment, packet, frame, bits. Coming in, the receiver unwraps in the reverse order.',
};

export const LAYERS_MATCH: MatchQuestion = {
  id: 'lesson-layers-match', domain: 3, objective: '3.2', kind: 'match',
  stem: 'Match each device or piece of information to its layer.',
  choices: ['Layer 1', 'Layer 2', 'Layer 3', 'Layer 4', 'Layer 7'],
  prompts: [
    { label: 'A switch', answer: 'Layer 2', why: 'Switches decide where to send frames by MAC address, which is the data link layer.' },
    { label: 'A router', answer: 'Layer 3', why: 'Routers forward packets by IP address, which is the network layer.' },
    { label: 'A port number such as 443', answer: 'Layer 4', why: 'Ports belong to the transport layer, alongside TCP and UDP.' },
    { label: 'A web application firewall (WAF)', answer: 'Layer 7', why: 'A WAF reads the contents of web requests, which is the application layer.' },
    { label: 'A MAC address', answer: 'Layer 2', why: 'MAC addresses are used for delivery on the local network, the data link layer.' },
    { label: 'A network cable', answer: 'Layer 1', why: 'A cable just carries signals, which is the physical layer.' },
  ],
  takeaway: 'Layer 2 is MAC addresses and switches, layer 3 is IP addresses and routers, layer 4 is ports, and layer 7 is the application itself.',
};

// ── Lesson 5: ports to know ─────────────────────────────────────────────

export const PORT_NUMBERS: MatchQuestion = {
  id: 'lesson-ports-numbers', domain: 4, objective: '4.5', kind: 'match',
  stem: 'A firewall administrator needs the port for each service. Choose the right number.',
  choices: ['22', '23', '25', '53', '80', '389', '443', '445', '636', '993', '3389'],
  prompts: [
    { label: 'SSH (encrypted remote login)', answer: '22', why: 'SSH is 22, right next to Telnet on 23, which it replaced.' },
    { label: 'Telnet (plaintext remote login)', answer: '23', why: 'Telnet is 23. It sends everything in plaintext, so it should be switched off.' },
    { label: 'SMTP (mail servers passing email)', answer: '25', why: 'Mail servers hand email to each other on port 25. Mail apps sending new mail use 587 or 465 instead.' },
    { label: 'DNS (name lookups)', answer: '53', why: 'DNS uses 53, over UDP for normal lookups and TCP for big answers.' },
    { label: 'HTTPS (encrypted web)', answer: '443', why: 'Encrypted web traffic is 443. Plain HTTP is 80.' },
    { label: 'SMB (Windows file sharing)', answer: '445', why: 'Windows file and printer sharing uses 445, a port that should never be reachable from the internet.' },
    { label: 'LDAPS (encrypted directory lookups)', answer: '636', why: 'LDAP is 389 in plaintext and LDAPS is 636 with TLS.' },
    { label: 'RDP (Windows Remote Desktop)', answer: '3389', why: 'Remote Desktop uses 3389 and should never face the internet.' },
  ],
  takeaway: 'The rising run helps: 22 SSH, 23 Telnet, 25 SMTP, 53 DNS, 80 HTTP, 443 HTTPS, 445 SMB, 3389 RDP. Secure directory lookups are 636.',
};

export const PORT_PAIRS: MatchQuestion = {
  id: 'lesson-ports-pairs', domain: 4, objective: '4.5', kind: 'match',
  stem: 'An audit found these plaintext protocols in use. Pick the secure replacement for each.',
  choices: ['SSH', 'HTTPS', 'SFTP', 'IMAPS', 'LDAPS', 'SNMPv3'],
  prompts: [
    { label: 'Telnet for logging in to routers', answer: 'SSH', why: 'SSH gives the same remote command line, encrypted.' },
    { label: 'HTTP for the admin web page', answer: 'HTTPS', why: 'HTTPS is the same web traffic wrapped in TLS.' },
    { label: 'FTP for uploading backups', answer: 'SFTP', why: 'SFTP transfers files inside an encrypted SSH session.' },
    { label: 'IMAP on 143 for reading email', answer: 'IMAPS', why: 'IMAPS on 993 is IMAP with TLS from the start.' },
    { label: 'LDAP on 389 for checking logins', answer: 'LDAPS', why: 'LDAPS on 636 wraps directory lookups in TLS, so passwords are not sent in plaintext.' },
    { label: 'SNMP v2c with the community string "public"', answer: 'SNMPv3', why: 'Version 3 adds real logins and encryption instead of a plaintext shared password.' },
  ],
  takeaway: 'Telnet to SSH, HTTP to HTTPS, FTP to SFTP, IMAP to IMAPS, LDAP to LDAPS, old SNMP to SNMPv3.',
};

// ── Lesson 6: switches and routers ──────────────────────────────────────

export const DEVICES_MATCH: MatchQuestion = {
  id: 'lesson-devices-match', domain: 3, objective: '3.2', kind: 'match',
  stem: 'Name the device from what it does, then pick the defense for each switch attack.',
  prompts: [
    { group: 'Which device is it?', label: 'Repeats every signal out of every port, so everyone sees everything', answer: 'Hub', choices: ['Hub', 'Switch', 'Router', 'Wireless access point', 'Modem'], why: 'A hub has no idea who is plugged in where, so it repeats everything to everyone.' },
    { group: 'Which device is it?', label: 'Learns MAC addresses and sends each frame only to the right port', answer: 'Switch', choices: ['Hub', 'Switch', 'Router', 'Wireless access point', 'Modem'], why: 'Building a MAC address table and forwarding by it is exactly what a switch does.' },
    { group: 'Which device is it?', label: 'Joins your home network to your provider and forwards packets by IP address', answer: 'Router', choices: ['Hub', 'Switch', 'Router', 'Wireless access point', 'Modem'], why: 'Joining different networks and forwarding by IP address is the router\'s job.' },
    { group: 'Which device is it?', label: 'Lets laptops and phones join the wired network without a cable', answer: 'Wireless access point', choices: ['Hub', 'Switch', 'Router', 'Wireless access point', 'Modem'], why: 'An access point bridges Wi-Fi devices onto the wired network.' },
    { group: 'Which defense stops it?', label: 'Thousands of fake MAC addresses fill the switch\'s table', answer: 'Port security', choices: ['Port security', 'BPDU Guard', '802.1X', 'Dynamic ARP Inspection'], why: 'Port security limits how many MAC addresses each port may learn, so the table cannot be flooded.' },
    { group: 'Which defense stops it?', label: 'A rogue switch claims to be the root bridge', answer: 'BPDU Guard', choices: ['Port security', 'BPDU Guard', '802.1X', 'Dynamic ARP Inspection'], why: 'BPDU Guard shuts any user port that receives spanning tree messages, which only switches send.' },
    { group: 'Which defense stops it?', label: 'A stranger plugs a laptop into a lobby wall socket', answer: '802.1X', choices: ['Port security', 'BPDU Guard', '802.1X', 'Dynamic ARP Inspection'], why: '802.1X makes a device log in before it gets any network access.' },
    { group: 'Which defense stops it?', label: 'Fake ARP replies redirect traffic through an attacker', answer: 'Dynamic ARP Inspection', choices: ['Port security', 'BPDU Guard', '802.1X', 'Dynamic ARP Inspection'], why: 'Dynamic ARP Inspection checks ARP replies against the real address assignments and drops fakes.' },
  ],
  takeaway: 'Hub repeats, switch learns MAC addresses, router forwards by IP address. Port security stops MAC flooding, BPDU Guard stops rogue switches, 802.1X stops unknown devices, and DAI stops ARP poisoning.',
};

// ── Lesson 7: VLANs ─────────────────────────────────────────────────────

const PORT_SETTINGS = ['Access, VLAN 10 (staff)', 'Access, VLAN 20 (guests)', 'Trunk (all VLANs)', 'Shut down'];

export const VLAN_CONFIG: MatchQuestion = {
  id: 'lesson-vlan-config', domain: 3, objective: '3.2', kind: 'match',
  scenario: 'You are setting up a new switch. Staff use VLAN 10 and guests use VLAN 20. The second switch, upstairs, also has staff and guest devices.',
  exhibit: [
    'Port 1    staff PC',
    'Port 2    printer used by staff',
    'Port 3    guest Wi-Fi access point',
    'Port 4    empty wall socket in the lobby',
    'Port 24   cable to the second switch upstairs',
  ].join('\n'),
  stem: 'Choose the setting for each port, then for the trunk\'s native VLAN.',
  prompts: [
    { label: 'Port 1: staff PC', answer: 'Access, VLAN 10 (staff)', choices: PORT_SETTINGS, why: 'A normal device carries one VLAN, so it gets an access port in the staff VLAN.' },
    { label: 'Port 2: printer used by staff', answer: 'Access, VLAN 10 (staff)', choices: PORT_SETTINGS, why: 'Staff need to reach it, and guests should not, so it belongs in the staff VLAN.' },
    { label: 'Port 3: guest Wi-Fi access point', answer: 'Access, VLAN 20 (guests)', choices: PORT_SETTINGS, why: 'Everything joining the guest Wi-Fi should land in the guest VLAN, separated from staff.' },
    { label: 'Port 4: empty lobby wall socket', answer: 'Shut down', choices: PORT_SETTINGS, why: 'An unused port is an open door. Switching it off means nothing plugged in there gets on the network.' },
    { label: 'Port 24: cable to the second switch', answer: 'Trunk (all VLANs)', choices: PORT_SETTINGS, why: 'The upstairs switch has both staff and guest devices, so the link must carry both VLANs, with tags.' },
    { label: 'Native VLAN on the trunk', answer: 'VLAN 999 (unused)', choices: ['VLAN 1 (the default)', 'VLAN 10 (staff)', 'VLAN 999 (unused)'], why: 'Leaving the default VLAN 1, or using a real VLAN, as the native VLAN enables double tagging attacks. An unused number defeats them.' },
  ],
  takeaway: 'Devices get access ports in their VLAN, links between switches get trunks, unused ports are shut down, and the native VLAN moves to an unused number.',
};

// ── Lesson 8: the helpers ───────────────────────────────────────────────

export const HELPERS_SYMPTOMS: MatchQuestion = {
  id: 'lesson-helpers-symptoms', domain: 2, objective: '2.4', kind: 'match',
  stem: 'The help desk reports these problems. Which helper problem or attack is behind each one?',
  choices: ['Rogue DHCP server', 'DHCP failure (APIPA address)', 'DNS poisoning', 'ARP poisoning', 'PAT (normal NAT)'],
  prompts: [
    { label: 'Several laptops received a default gateway address nobody recognizes', answer: 'Rogue DHCP server', why: 'DHCP hands out the gateway setting, so a strange gateway means a server that should not exist answered first.' },
    { label: 'A PC shows the address 169.254.40.12 and cannot reach anything', answer: 'DHCP failure (APIPA address)', why: 'A 169.254 address means the PC never heard back from a DHCP server and gave itself an address.' },
    { label: 'Users typed the bank\'s real name but landed on a fake copy of the site', answer: 'DNS poisoning', why: 'The name was right but the address behind it was wrong, which points at a forged DNS answer.' },
    { label: 'arp -a shows the gateway\'s IP address with another PC\'s MAC address', answer: 'ARP poisoning', why: 'Someone has answered ARP for the gateway with their own MAC address, so traffic goes to them.' },
    { label: 'Twenty devices at home all appear online with the same public IP address', answer: 'PAT (normal NAT)', why: 'This is not an attack: PAT lets many private devices share one public address, told apart by port.' },
  ],
  takeaway: 'Strange gateway: rogue DHCP. 169.254 address: DHCP failed. Right name, wrong site: DNS poisoning. Gateway IP with the wrong MAC: ARP poisoning. One public IP for many devices: PAT.',
};

export const DNS_ORDER: OrderQuestion = {
  id: 'lesson-dns-order', domain: 3, objective: '3.2', kind: 'order',
  stem: 'Your laptop looks up www.example.com for the first time, and nothing is cached anywhere. Put the steps in order.',
  items: [
    { text: 'The laptop asks its resolver for www.example.com', why: 'Devices never search the internet themselves; they always start by asking their configured resolver.' },
    { text: 'The resolver asks a root server where .com is handled', why: 'With nothing cached, the resolver starts at the top of the DNS tree.' },
    { text: 'The resolver asks the .com (TLD) server where example.com is handled', why: 'The root pointed to the .com servers, which know who is in charge of example.com.' },
    { text: 'The resolver asks example.com\'s authoritative server for the address of www', why: 'Only the authoritative server holds the real record.' },
    { text: 'The resolver returns the address to the laptop and caches it for the TTL', why: 'The answer goes back to the laptop, and the resolver remembers it so the next lookup is instant.' },
  ],
  takeaway: 'Laptop to resolver, then root, then top-level domain, then authoritative server, then the answer comes back and is cached until its TTL runs out.',
};

// ── Lesson 10: one web request ──────────────────────────────────────────

export const WEB_ORDER: OrderQuestion = {
  id: 'lesson-web-order', domain: 3, objective: '3.2', kind: 'order',
  stem: 'A laptop joins the Wi-Fi and then opens https://www.example.com. Put everything that happens in order.',
  items: [
    { text: 'DHCP gives the laptop its IP address, mask, gateway and DNS server', why: 'Nothing else can happen until the laptop has an address and knows its gateway and DNS server.' },
    { text: 'ARP finds the MAC address of the default gateway', why: 'Every packet for another network goes to the gateway first, so the laptop needs its MAC address.' },
    { text: 'DNS turns www.example.com into the server\'s IP address', why: 'The laptop cannot connect to a name, only to an address.' },
    { text: 'The TCP handshake (SYN, SYN-ACK, ACK) connects to port 443', why: 'With the address known, TCP sets up the connection to the HTTPS port.' },
    { text: 'The TLS handshake checks the certificate and agrees a session key', why: 'Encryption is set up on top of the TCP connection, before any page data moves.' },
    { text: 'The browser sends the GET request and the page comes back, encrypted', why: 'Only now does the actual web traffic flow, inside the encrypted tunnel.' },
  ],
  takeaway: 'Address (DHCP), next hop (ARP), name lookup (DNS), connection (TCP), encryption (TLS), then the page (HTTP).',
};

// ── Lesson 11: hardening ────────────────────────────────────────────────

export const HARDEN_ORDER: OrderQuestion = {
  id: 'lesson-harden-order', domain: 4, objective: '4.1', kind: 'order',
  stem: 'A new router has arrived. Put the steps for bringing it into service safely in order.',
  items: [
    { text: 'Connect it only to an isolated setup network, not the live network', why: 'Until it is hardened, its default settings are a risk, so it should not be reachable by anyone else.' },
    { text: 'Change the default admin password', why: 'The default login is published online, so it is the first thing to fix: anyone who reaches the router could use it.' },
    { text: 'Install the latest firmware', why: 'New devices often ship with old software that has known flaws, and later settings should be applied on the current version.' },
    { text: 'Apply the approved baseline configuration', why: 'The baseline switches off unneeded services, enforces SSH only and sets logging, so the router matches every other hardened router.' },
    { text: 'Back up the configuration and add the router to the inventory', why: 'A backup allows a quick restore, and an inventory entry means the router will be patched and audited in future.' },
    { text: 'Connect it to the live network and start monitoring it', why: 'Only a hardened, documented device goes into service, and monitoring catches drift from then on.' },
  ],
  takeaway: 'Isolate, change defaults, patch, apply the baseline, document, and only then connect and monitor.',
};

// ── Lesson 1: start here ────────────────────────────────────────────────

export const START_LABELS: MatchQuestion = {
  id: 'lesson-start-labels', domain: 3, objective: '3.2', kind: 'match',
  stem: 'Pick the label that does each job, then decide whether each program is acting as a client or a server.',
  prompts: [
    { group: 'Which label does the job?', label: 'Getting a packet to a server in another country', answer: 'IP address', choices: ['IP address', 'MAC address', 'Port number'], why: 'IP addresses are what routers use to move packets across networks, all the way around the world.' },
    { group: 'Which label does the job?', label: 'Handing a frame to the printer on your own network', answer: 'MAC address', choices: ['IP address', 'MAC address', 'Port number'], why: 'On the local network, the final hand-off uses the MAC address of the device\'s network card.' },
    { group: 'Which label does the job?', label: 'Making sure a reply reaches your browser and not your email app', answer: 'Port number', choices: ['IP address', 'MAC address', 'Port number'], why: 'Both programs are on the same device, so only the port number tells them apart.' },
    { group: 'Client or server?', label: 'Your web browser asking a website for a page', answer: 'Client', choices: ['Client', 'Server'], why: 'The browser asks, so it is the client.' },
    { group: 'Client or server?', label: 'A program waiting for web requests on port 443', answer: 'Server', choices: ['Client', 'Server'], why: 'Waiting for requests (listening) and answering them is what a server does.' },
    { group: 'Client or server?', label: 'A laptop sharing a folder that other PCs open', answer: 'Server', choices: ['Client', 'Server'], why: 'Server is a role, not a special box: the laptop is answering the other PCs\' requests, so here it is a server.' },
  ],
  takeaway: 'IP address: which device anywhere. MAC address: which device on this network. Port: which program. The side that asks is the client; the side that listens and answers is the server.',
};
