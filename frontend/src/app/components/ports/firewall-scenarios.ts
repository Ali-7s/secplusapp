/**
 * Firewall scenarios for the ports trainer: write the rules for a network, recalling each protocol and typing each
 * port. Requirements and diagrams name the job or the protocol but never the number, so the port has to come from
 * memory. Each trainer set has its own scenarios, and the mixed ones pull ports from every set.
 *
 * firewall-scenarios.spec.ts checks that every port and transport in the trainer is covered.
 */

import { FirewallQuestion, NetHost, NetZone } from '../../models/exam.model';
import { normalizePort } from '../../utils/exam-engine';
import { PORTS } from '../reference/reference-data';

export interface PortScenario extends FirewallQuestion {
  /** The trainer set this scenario practices, or MIXED. */
  set: string;
  title: string;
  /** Set on a generated table: what it was built from. Written scenarios have none. */
  seed?: number;
}

export const MIXED = 'mixed';

export const TCP = 'TCP';
export const UDP = 'UDP';
export const BOTH = 'TCP and UDP';
export const ICMP = 'ICMP';
export const ESP = 'ESP (IP protocol 50)';
export const AH = 'AH (IP protocol 51)';
export const NO_PORT = 'Not applicable';

const PROTOCOLS = [TCP, UDP, ICMP, BOTH, ESP, AH, 'Any'];

/** A rule, with hosts and zones given by name. `to` or `from` is the host itself on a host-based firewall. */
export interface Rule { need: string; from: string; to: string; proto: string; port: string; action?: 'Deny'; why: string }

export interface Draft {
  id: string;
  set: string;
  title: string;
  story: string;
  firewall: string;
  zones: NetZone[];
  outside?: NetHost[];
  /** Set on a host-based firewall: the table is written from this host's point of view. */
  host?: string;
  /** Draw the internet even when no outside host is named. */
  internet?: boolean;
  seed?: number;
  rules: Rule[];
  takeaway: string;
}

const RULES_TEXT = 'The firewall is stateful, so replies pass automatically. Rules run top to bottom and the first match wins. Its implicit deny at the end is not logged, so write only the rules listed.';

export function build(d: Draft): PortScenario {
  const outside = d.outside ?? [];
  const hosts = [...d.zones.flatMap(z => z.hosts), ...outside];
  const addr = (name: string) => name === 'Any' ? 'Any' : hosts.find(h => h.name === name)?.ip ?? d.zones.find(z => z.name === name)?.subnet ?? name;
  const addresses = ['Any', ...new Set([...d.zones.flatMap(z => [z.subnet!, ...z.hosts.map(h => h.ip!)]), ...outside.map(h => h.ip!)])];
  const base = {
    id: d.id, domain: 3 as const, objective: '3.2', kind: 'firewall' as const, set: d.set, title: d.title,
    ...(d.seed === undefined ? {} : { seed: d.seed }),
    scenario: `${d.story} ${RULES_TEXT}`,
    diagram: { firewall: d.firewall, ...(outside.length || d.internet ? { outside: { label: 'Internet', hosts: outside } } : {}), zones: d.zones },
    stem: 'Complete the rule table so that it meets every requirement and follows least privilege.',
    requirements: d.rules.map(r => r.need),
    takeaway: d.takeaway,
  };
  if (d.host) {
    const own = addr(d.host);
    return {
      ...base,
      columns: ['Direction', 'Remote address', 'Protocol', 'Port', 'Action'],
      choices: { Direction: ['Inbound', 'Outbound'], 'Remote address': addresses.filter(a => a !== own), Protocol: PROTOCOLS, Action: ['Allow', 'Deny'] },
      rows: d.rules.map(r => {
        const inbound = r.to === d.host;
        return { why: r.why, answer: { Direction: inbound ? 'Inbound' : 'Outbound', 'Remote address': addr(inbound ? r.from : r.to), Protocol: r.proto, Port: r.port, Action: r.action ?? 'Allow' } };
      }),
    };
  }
  return {
    ...base,
    columns: ['Source', 'Destination', 'Protocol', 'Port', 'Action'],
    choices: { Source: addresses, Destination: addresses, Protocol: PROTOCOLS, Action: ['Allow', 'Deny'] },
    rows: d.rules.map(r => ({ why: r.why, answer: { Source: addr(r.from), Destination: addr(r.to), Protocol: r.proto, Port: r.port, Action: r.action ?? 'Allow' } })),
  };
}

export const SCENARIOS: PortScenario[] = ([
  // ── Remote access ────────────────────────────────────────────
  {
    id: 'pf-remote', set: 'remote', title: 'The IT team\'s remote tools', firewall: 'FW-IT',
    story: 'An IT team manages servers, kiosks and an old switch from its own network. You are writing the internal firewall rules for its remote tools.',
    zones: [
      { name: 'ADMIN', subnet: '10.1.5.0/24', hosts: [{ name: 'ADM01', ip: '10.1.5.10', role: 'administrator\'s PC', icon: 'pc' }, { name: 'BK01', ip: '10.1.5.20', role: 'backup server' }] },
      { name: 'HELPDESK', subnet: '10.1.6.0/24', hosts: [{ name: 'Help desk', ip: '10.1.6.0/24', role: 'help desk PCs', icon: 'pc' }] },
      { name: 'SERVERS', subnet: '10.1.20.0/24', hosts: [{ name: 'LINUX01', ip: '10.1.20.10', role: 'Linux server' }, { name: 'WIN01', ip: '10.1.20.20', role: 'Windows server' }] },
      { name: 'LOBBY', subnet: '10.1.30.0/24', hosts: [{ name: 'KIOSK01', ip: '10.1.30.5', role: 'visitor kiosk', icon: 'pc' }] },
      { name: 'NETWORK', subnet: '10.1.40.0/24', hosts: [{ name: 'SW-OLD', ip: '10.1.40.2', role: 'old network switch', icon: 'device' }] },
    ],
    rules: [
      { need: 'ADM01 can manage LINUX01 over an encrypted command line.', from: 'ADM01', to: 'LINUX01', proto: TCP, port: '22', why: 'An encrypted command line is SSH on TCP 22. It replaced Telnet, its neighbor on port 23, which sends everything in cleartext.' },
      { need: 'BK01 can copy files from LINUX01 with SFTP.', from: 'BK01', to: 'LINUX01', proto: TCP, port: '22', why: 'SFTP runs inside SSH, so it shares TCP 22. Do not confuse it with FTPS, which is FTP wrapped in TLS on its own ports.' },
      { need: 'ADM01 can open the full graphical desktop of WIN01.', from: 'ADM01', to: 'WIN01', proto: TCP, port: '3389', why: 'A whole Windows desktop over the network is RDP on TCP 3389. Attackers love it, so here only one admin PC may reach it.' },
      { need: 'The help desk can take over the screen of KIOSK01 with VNC.', from: 'HELPDESK', to: 'KIOSK01', proto: TCP, port: '5900', why: 'VNC screen sharing uses TCP 5900. It is often unencrypted, so keep it on trusted networks or inside a tunnel.' },
      { need: 'An audit wants every attempt to reach the unencrypted remote terminal on SW-OLD blocked and logged, from anywhere.', from: 'Any', to: 'SW-OLD', proto: TCP, port: '23', action: 'Deny', why: 'The unencrypted remote terminal is Telnet on TCP 23. A written deny puts each attempt in the log, which the silent implicit deny would not.' },
      { need: 'ADM01 can ping LINUX01 to check that it is up.', from: 'ADM01', to: 'LINUX01', proto: ICMP, port: NO_PORT, why: 'Ping is ICMP. It sits beside TCP and UDP and has no ports at all, so the Port is N/A.' },
    ],
    takeaway: 'SSH is 22 and carries SFTP too, Telnet is 23, RDP is 3389 and VNC is 5900.',
  },

  // ── The web ──────────────────────────────────────────────────
  {
    id: 'pf-web', set: 'web', title: 'A public site and a staff web proxy', firewall: 'FW-WEB',
    story: 'A company hosts its public website in a screened subnet and sends all staff browsing through a web proxy.',
    zones: [
      { name: 'DMZ', subnet: '172.16.1.0/24', hosts: [{ name: 'WEB01', ip: '172.16.1.10', role: 'public website' }] },
      { name: 'STAFF', subnet: '10.2.10.0/24', hosts: [{ name: 'Staff PCs', ip: '10.2.10.0/24', icon: 'pc' }] },
      { name: 'IT', subnet: '10.2.15.0/24', hosts: [{ name: 'IT01', ip: '10.2.15.7', role: 'IT administrator\'s PC', icon: 'pc' }] },
      { name: 'SERVERS', subnet: '10.2.20.0/24', hosts: [{ name: 'PROXY01', ip: '10.2.20.5', role: 'web proxy on the alternate HTTP port' }, { name: 'APP01', ip: '10.2.20.10', role: 'management console on the alternate HTTPS port' }] },
    ],
    rules: [
      { need: 'Anyone on the internet can open the website on WEB01 over an encrypted connection.', from: 'Any', to: 'WEB01', proto: TCP, port: '443', why: 'Encrypted web traffic is HTTPS on TCP 443. Think of 80 as the open web and 443 as the locked web.' },
      { need: 'Visitors who type the address without HTTPS still reach WEB01, so it can redirect them.', from: 'Any', to: 'WEB01', proto: TCP, port: '80', why: 'Plain HTTP is TCP 80. Sites often keep it open only to send visitors straight to HTTPS.' },
      { need: 'Staff browsers send all their web requests to PROXY01.', from: 'STAFF', to: 'PROXY01', proto: TCP, port: '8080', why: 'The alternate HTTP port is TCP 8080, a common home for web proxies. It is 80 with 80 in front, and it is still unencrypted.' },
      { need: 'PROXY01 can fetch encrypted websites on the internet.', from: 'PROXY01', to: 'Any', proto: TCP, port: '443', why: 'The proxy makes the real connection to the site, so the rule starts at the proxy and uses HTTPS on TCP 443.' },
      { need: 'PROXY01 can fetch unencrypted websites on the internet.', from: 'PROXY01', to: 'Any', proto: TCP, port: '80', why: 'Plain websites use HTTP on TCP 80, and again only the proxy goes out to them, not the staff PCs.' },
      { need: 'Only IT01 can open the management console on APP01.', from: 'IT01', to: 'APP01', proto: TCP, port: '8443', why: 'The alternate HTTPS port is TCP 8443, often used by management interfaces. The alternatives add 8000 and keep the ending.' },
    ],
    takeaway: 'Web is 80 and 443. The alternates add 8000: 8080 for HTTP and 8443 for HTTPS.',
  },

  // ── Names, addresses and time ────────────────────────────────
  {
    id: 'pf-names', set: 'names', title: 'One server for names, addresses and time', firewall: 'Host firewall on CORE01', host: 'CORE01',
    story: 'CORE01 answers name lookups, hands out IP addresses and serves the time for a whole company. You are writing its host-based firewall, so each rule is inbound to it or outbound from it.',
    zones: [
      { name: 'CORE01', subnet: '10.3.1.10', hosts: [{ name: 'CORE01', ip: '10.3.1.10', role: 'DNS, DHCP and time server' }] },
      { name: 'Company network', subnet: '10.3.0.0/16', hosts: [{ name: 'Staff devices', ip: '10.3.20.0/24', icon: 'pc' }, { name: 'DNS02', ip: '10.3.1.11', role: 'secondary DNS server' }] },
    ],
    outside: [{ name: 'FILTER-DNS', ip: '198.51.100.9', role: 'filtering DNS service, accepts DNS over TLS only' }, { name: 'TIME-X', ip: '203.0.113.12', role: 'public time server' }],
    rules: [
      { need: 'Staff devices can look up names on CORE01 with ordinary small DNS queries.', from: 'Staff devices', to: 'CORE01', proto: UDP, port: '53', why: 'Ordinary DNS lookups are small and use UDP 53, because a quick question needs no connection setup.' },
      { need: 'DNS02 can copy the whole zone from CORE01 with a zone transfer.', from: 'DNS02', to: 'CORE01', proto: TCP, port: '53', why: 'A zone transfer is large and must arrive complete, so DNS switches to TCP 53 for it. Same port, different transport.' },
      { need: 'CORE01 forwards lookups to the filtering DNS service, encrypted with TLS.', from: 'CORE01', to: 'FILTER-DNS', proto: TCP, port: '853', why: 'DNS over TLS is TCP 853: DNS 53 with an 8 in front. TLS needs a connection, so it is TCP and not UDP.' },
      { need: 'Devices that have no address yet can ask CORE01 for one.', from: 'Any', to: 'CORE01', proto: UDP, port: '67', why: 'DHCP servers listen on UDP 67. The source has to be Any, because a device asking for an address does not have one yet.' },
      { need: 'CORE01 can answer those devices with their new address.', from: 'CORE01', to: 'Any', proto: UDP, port: '68', why: 'DHCP clients listen on UDP 68. The server gets the lower number, 67, and the client the higher, 68.' },
      { need: 'Staff devices can set their clocks from CORE01.', from: 'Staff devices', to: 'CORE01', proto: UDP, port: '123', why: 'NTP is UDP 123, easy to remember as one, two, three. Kerberos sign-ins start failing when clocks drift.' },
      { need: 'CORE01 can set its own clock from the public time server.', from: 'CORE01', to: 'TIME-X', proto: UDP, port: '123', why: 'Here CORE01 is the NTP client, so the rule is outbound, still to UDP 123.' },
    ],
    takeaway: 'DNS is 53 (UDP for lookups, TCP for transfers), DNS over TLS is 853, DHCP is 67 and 68, and NTP is 123.',
  },

  // ── Email ────────────────────────────────────────────────────
  {
    id: 'pf-mail', set: 'mail', title: 'Every way mail moves', firewall: 'FW-MAIL',
    story: 'A company receives mail through a gateway in its screened subnet and keeps mailboxes on an internal server. Some older systems can only use old mail protocols.',
    zones: [
      { name: 'DMZ', subnet: '172.16.2.0/24', hosts: [{ name: 'MX01', ip: '172.16.2.10', role: 'inbound mail gateway' }] },
      { name: 'USERS', subnet: '10.4.10.0/24', hosts: [{ name: 'Staff PCs', ip: '10.4.10.0/24', icon: 'pc' }] },
      { name: 'SERVERS', subnet: '10.4.20.0/24', hosts: [{ name: 'MAIL01', ip: '10.4.20.10', role: 'internal mail server' }, { name: 'BILL01', ip: '10.4.20.20', role: 'billing app' }, { name: 'FAX01', ip: '10.4.20.30', role: 'old fax-to-email gateway' }, { name: 'TCK01', ip: '10.4.20.40', role: 'old ticketing system' }, { name: 'ARCH01', ip: '10.4.20.50', role: 'mail archive server' }] },
    ],
    rules: [
      { need: 'Mail servers on the internet can deliver mail to MX01.', from: 'Any', to: 'MX01', proto: TCP, port: '25', why: 'Server-to-server mail delivery is SMTP on TCP 25.' },
      { need: 'MX01 can pass clean mail on to MAIL01.', from: 'MX01', to: 'MAIL01', proto: TCP, port: '25', why: 'This is still one mail server handing mail to another, so it is SMTP on TCP 25.' },
      { need: 'Staff mail apps send outgoing mail to MAIL01 by authenticated client submission, upgraded with STARTTLS.', from: 'USERS', to: 'MAIL01', proto: TCP, port: '587', why: 'A mail app submitting mail uses TCP 587 with STARTTLS. 25 is for servers talking to each other, 587 is for you sending.' },
      { need: 'BILL01 sends invoices through MAIL01 over SMTP that is encrypted from the very first byte.', from: 'BILL01', to: 'MAIL01', proto: TCP, port: '465', why: 'Implicit TLS for SMTP is TCP 465: encrypted from the first byte, where 587 starts plain and upgrades.' },
      { need: 'Staff mail apps read mail on MAIL01 over an encrypted connection, leaving it on the server.', from: 'USERS', to: 'MAIL01', proto: TCP, port: '993', why: 'Leaving mail on the server means IMAP, and encrypted IMAP is IMAPS on TCP 993. The secure readers live in the 990s.' },
      { need: 'ARCH01 downloads mailboxes from MAIL01 over an encrypted connection, removing them from the server.', from: 'ARCH01', to: 'MAIL01', proto: TCP, port: '995', why: 'Download and remove means POP3, and encrypted POP3 is POP3S on TCP 995.' },
      { need: 'FAX01 can only download mail the old unencrypted way, removing it from the server.', from: 'FAX01', to: 'MAIL01', proto: TCP, port: '110', why: 'Plain POP3 is TCP 110. It is cleartext, so it is allowed only for this one old device.' },
      { need: 'TCK01 can only read its mailbox the old unencrypted way, leaving the mail on the server.', from: 'TCK01', to: 'MAIL01', proto: TCP, port: '143', why: 'Plain IMAP is TCP 143. Its encrypted replacement is 993.' },
    ],
    takeaway: 'Sending: 25 between servers, 587 from apps, 465 with TLS from the start. Reading: POP3 110 or 995, IMAP 143 or 993.',
  },

  // ── Files and sharing ────────────────────────────────────────
  {
    id: 'pf-shares', set: 'files', title: 'File shares, old PCs and phones', firewall: 'FW-CORE',
    story: 'An office shares files from a Windows server. One old PC still needs legacy Windows networking, and the desk phones fetch their settings at startup.',
    zones: [
      { name: 'USERS', subnet: '10.5.10.0/24', hosts: [{ name: 'Staff PCs', ip: '10.5.10.0/24', icon: 'pc' }] },
      { name: 'GUEST', subnet: '10.5.40.0/24', hosts: [{ name: 'Guest Wi-Fi', ip: '10.5.40.0/24', icon: 'wifi' }] },
      { name: 'LEGACY', subnet: '10.5.50.0/24', hosts: [{ name: 'OLD01', ip: '10.5.50.5', role: 'old Windows PC', icon: 'pc' }] },
      { name: 'VOICE', subnet: '10.5.60.0/24', hosts: [{ name: 'IP phones', ip: '10.5.60.0/24', icon: 'phone' }] },
      { name: 'SERVERS', subnet: '10.5.20.0/24', hosts: [{ name: 'FS01', ip: '10.5.20.10', role: 'Windows file server' }, { name: 'BOOT01', ip: '10.5.20.20', role: 'phone settings server, no login' }] },
    ],
    rules: [
      { need: 'Staff PCs can open shared folders on FS01.', from: 'USERS', to: 'FS01', proto: TCP, port: '445', why: 'Windows file sharing is SMB on TCP 445, the port ransomware loves to spread over.' },
      { need: 'Guest Wi-Fi devices trying to open the shared folders on FS01 are blocked and logged.', from: 'GUEST', to: 'FS01', proto: TCP, port: '445', action: 'Deny', why: 'Same service, same TCP 445, but a deny. Writing it out is what gets the attempts into the log.' },
      { need: 'IP phones download their settings from BOOT01 at startup with the trivial file transfer protocol.', from: 'VOICE', to: 'BOOT01', proto: UDP, port: '69', why: 'TFTP is UDP 69, with no login and no encryption, so keep it on internal networks.' },
      { need: 'OLD01 can look up computer names on FS01 with the NetBIOS name service.', from: 'OLD01', to: 'FS01', proto: UDP, port: '137', why: 'NetBIOS uses three neighbors. The name service is UDP 137, the first of the three.' },
      { need: 'OLD01 can use the NetBIOS datagram service with FS01.', from: 'OLD01', to: 'FS01', proto: UDP, port: '138', why: 'The NetBIOS datagram service is UDP 138. Datagrams are connectionless, which is what UDP is for.' },
      { need: 'OLD01 can open a NetBIOS session with FS01 for file sharing.', from: 'OLD01', to: 'FS01', proto: TCP, port: '139', why: 'A session needs a connection, so the NetBIOS session service is TCP 139. SMB on 445 replaced it.' },
    ],
    takeaway: 'SMB is 445, NetBIOS is 137 to 139 (name and datagram on UDP, session on TCP) and TFTP is UDP 69.',
  },
  {
    id: 'pf-ftp', set: 'files', title: 'Three ways to exchange files with partners', firewall: 'FW-EDGE',
    story: 'A company swaps files with outside firms over three different services in its screened subnet. Watch the data connections: in active mode the server opens them, so for those rules the Port is the server\'s own well-known data port.',
    zones: [
      { name: 'DMZ', subnet: '172.16.3.0/24', hosts: [{ name: 'FTP01', ip: '172.16.3.10', role: 'old FTP server' }, { name: 'FTPS01', ip: '172.16.3.20', role: 'FTP over TLS, implicit mode' }, { name: 'SFTP01', ip: '172.16.3.30', role: 'SSH file transfer server' }] },
    ],
    outside: [{ name: 'PARTNER', ip: '198.51.100.40' }, { name: 'SUPPLIER', ip: '203.0.113.70' }, { name: 'CARRIER', ip: '192.0.2.15' }],
    rules: [
      { need: 'PARTNER can log in to FTP01 and send FTP commands.', from: 'PARTNER', to: 'FTP01', proto: TCP, port: '21', why: 'FTP commands and logins travel on the control channel, TCP 21, in cleartext.' },
      { need: 'FTP01 can open the active-mode data connection back to PARTNER.', from: 'FTP01', to: 'PARTNER', proto: TCP, port: '20', why: 'In active mode the server sends the file from its own TCP 20. The data port is one below the command port.' },
      { need: 'SUPPLIER can connect to FTPS01 for the control channel of implicit FTPS.', from: 'SUPPLIER', to: 'FTPS01', proto: TCP, port: '990', why: 'Implicit FTPS uses TCP 990 for control, encrypted with TLS from the start.' },
      { need: 'FTPS01 can open the implicit FTPS data connection back to SUPPLIER.', from: 'FTPS01', to: 'SUPPLIER', proto: TCP, port: '989', why: 'Implicit FTPS data is TCP 989, one below control, just as FTP data on 20 sits one below 21.' },
      { need: 'CARRIER can upload files to SFTP01.', from: 'CARRIER', to: 'SFTP01', proto: TCP, port: '22', why: 'SFTP runs over SSH on TCP 22 and needs just this one port, which is why firewall teams prefer it to either kind of FTP.' },
    ],
    takeaway: 'FTP is 21 for commands and 20 for data. Implicit FTPS is 990 and 989. SFTP is not FTP at all: it is SSH on 22.',
  },

  // ── Directory and sign-in ────────────────────────────────────
  {
    id: 'pf-directory', set: 'directory', title: 'Sign-ins for people, apps and routers', firewall: 'FW-ID',
    story: 'A company checks every sign-in against central identity servers: domain logins, application lookups, Wi-Fi and router administration.',
    zones: [
      { name: 'USERS', subnet: '10.6.10.0/24', hosts: [{ name: 'Domain PCs', ip: '10.6.10.0/24', icon: 'pc' }] },
      { name: 'APPS', subnet: '10.6.20.0/24', hosts: [{ name: 'APP01', ip: '10.6.20.10', role: 'staff portal' }, { name: 'OLDAPP', ip: '10.6.20.11', role: 'old app with no TLS support' }] },
      { name: 'IDENTITY', subnet: '10.6.30.0/24', hosts: [{ name: 'DC01', ip: '10.6.30.10', role: 'domain controller' }, { name: 'NAC01', ip: '10.6.30.20', role: 'RADIUS server' }, { name: 'TAC01', ip: '10.6.30.30', role: 'TACACS+ server' }] },
      { name: 'NETWORK', subnet: '10.6.40.0/24', hosts: [{ name: 'Access points', ip: '10.6.40.0/25', icon: 'wifi' }, { name: 'Routers', ip: '10.6.40.128/25', icon: 'device' }] },
    ],
    rules: [
      { need: 'Domain PCs can get Kerberos tickets from DC01.', from: 'USERS', to: 'DC01', proto: BOTH, port: '88', why: 'Kerberos is port 88 on both UDP and TCP, because larger tickets do not fit in UDP. Picture 88 as two loops, like two tickets.' },
      { need: 'APP01 can look up users in the directory on DC01 over an encrypted connection.', from: 'APP01', to: 'DC01', proto: TCP, port: '636', why: 'Encrypted directory lookups are LDAPS on TCP 636, a number that reads the same backwards.' },
      { need: 'OLDAPP can look up users in the directory on DC01, unencrypted, until it is replaced.', from: 'OLDAPP', to: 'DC01', proto: TCP, port: '389', why: 'Plain LDAP is TCP 389. It sends directory queries in cleartext, so this rule should go when the app does.' },
      { need: 'Access points can check 802.1X logins against NAC01.', from: 'Access points', to: 'NAC01', proto: UDP, port: '1812', why: 'RADIUS authentication is UDP 1812, the protocol behind 802.1X and enterprise Wi-Fi.' },
      { need: 'Access points can send accounting records to NAC01.', from: 'Access points', to: 'NAC01', proto: UDP, port: '1813', why: 'RADIUS accounting is the next port up, UDP 1813: 1812 for logins, 1813 for records.' },
      { need: 'Routers can check administrators\' logins against TAC01, which encrypts the whole packet.', from: 'Routers', to: 'TAC01', proto: TCP, port: '49', why: 'TACACS+ is TCP 49 and encrypts the entire packet, where RADIUS encrypts only the password. It is built for device administration.' },
    ],
    takeaway: 'Kerberos 88, LDAP 389, LDAPS 636, TACACS+ on TCP 49, RADIUS on UDP 1812 and 1813.',
  },

  // ── Managing and logging ─────────────────────────────────────
  {
    id: 'pf-manage', set: 'manage', title: 'Watching the network and collecting logs', firewall: 'FW-MGMT',
    story: 'A monitoring server watches the switches, and a SIEM collects logs from servers and printers. The printers are too old to encrypt anything.',
    zones: [
      { name: 'MGMT', subnet: '10.7.1.0/24', hosts: [{ name: 'MON01', ip: '10.7.1.10', role: 'monitoring server' }, { name: 'SIEM01', ip: '10.7.1.20', role: 'log collector' }] },
      { name: 'NETWORK', subnet: '10.7.20.0/24', hosts: [{ name: 'Switches', ip: '10.7.20.0/24', icon: 'device' }] },
      { name: 'SERVERS', subnet: '10.7.30.0/24', hosts: [{ name: 'Servers', ip: '10.7.30.0/24' }] },
      { name: 'PRINT', subnet: '10.7.40.0/24', hosts: [{ name: 'Printers', ip: '10.7.40.0/24', icon: 'printer' }] },
    ],
    rules: [
      { need: 'MON01 can poll the switches for their counters with SNMP.', from: 'MON01', to: 'NETWORK', proto: UDP, port: '161', why: 'SNMP polling goes to the device on UDP 161: 161 asks.' },
      { need: 'The switches can send SNMP alerts to MON01 on their own.', from: 'NETWORK', to: 'MON01', proto: UDP, port: '162', why: 'Traps come from the device to the manager on UDP 162: 162 tells. Notice that the source and destination flip.' },
      { need: 'Servers can send their logs to SIEM01 over an encrypted connection.', from: 'SERVERS', to: 'SIEM01', proto: TCP, port: '6514', why: 'Syslog over TLS is TCP 6514: the old 514 with a 6 in front. TLS needs TCP.' },
      { need: 'Printers can send their logs to SIEM01 the traditional unencrypted way.', from: 'PRINT', to: 'SIEM01', proto: UDP, port: '514', why: 'Traditional syslog is UDP 514, with no authentication and no encryption.' },
      { need: 'MON01 can ping the switches to check that they are up.', from: 'MON01', to: 'NETWORK', proto: ICMP, port: NO_PORT, why: 'Ping is ICMP echo, which has no port. A monitoring server is the classic reason to allow it.' },
    ],
    takeaway: 'SNMP: 161 asks, 162 tells. Syslog is UDP 514, and with TLS it is TCP 6514.',
  },

  // ── VPNs ─────────────────────────────────────────────────────
  {
    id: 'pf-ipsec', set: 'vpn', title: 'Branch offices over IPsec', firewall: 'FW-HQ',
    story: 'Headquarters connects three branches with IPsec, and still runs one old L2TP server. Note that two of these rules use a protocol that is neither TCP nor UDP, so they have no port.',
    zones: [
      { name: 'DMZ', subnet: '172.16.8.0/24', hosts: [{ name: 'VPN01', ip: '172.16.8.1', role: 'IPsec gateway' }, { name: 'L2TP01', ip: '172.16.8.2', role: 'old L2TP server' }] },
    ],
    outside: [{ name: 'All branches', ip: '203.0.113.0/24' }, { name: 'BRANCH-A', ip: '203.0.113.10', role: 'behind a NAT router' }, { name: 'BRANCH-B', ip: '203.0.113.20', role: 'public address, no NAT' }, { name: 'BRANCH-C', ip: '203.0.113.30', role: 'needs integrity, not secrecy' }],
    rules: [
      { need: 'All the branches can negotiate IPsec keys with VPN01 using IKE.', from: 'All branches', to: 'VPN01', proto: UDP, port: '500', why: 'IKE sets up the tunnel on UDP 500, and every branch has to do it first.' },
      { need: 'BRANCH-A sits behind NAT, so its tunnel traffic must be wrapped to cross the NAT router.', from: 'BRANCH-A', to: 'VPN01', proto: UDP, port: '4500', why: 'NAT traversal wraps IPsec in UDP 4500: IKE\'s 500 with a 4 in front.' },
      { need: 'BRANCH-B has no NAT, so its encrypted tunnel traffic reaches VPN01 unwrapped.', from: 'BRANCH-B', to: 'VPN01', proto: ESP, port: NO_PORT, why: 'Encrypted IPsec traffic is ESP, IP protocol 50. It is its own protocol, so there is no port.' },
      { need: 'BRANCH-C only needs its tunnel traffic authenticated, not encrypted.', from: 'BRANCH-C', to: 'VPN01', proto: AH, port: NO_PORT, why: 'AH, IP protocol 51, proves who sent the data and that it was not changed, but does not hide it.' },
      { need: 'Anyone on the internet can start a layer 2 tunnel on L2TP01.', from: 'Any', to: 'L2TP01', proto: UDP, port: '1701', why: 'L2TP is UDP 1701. It has no encryption of its own, which is why it is paired with IPsec.' },
    ],
    takeaway: 'IKE is UDP 500, NAT traversal is UDP 4500, ESP is protocol 50, AH is protocol 51 and L2TP is UDP 1701.',
  },
  {
    id: 'pf-remote-vpn', set: 'vpn', title: 'VPNs for people working remotely', firewall: 'FW-EDGE2',
    story: 'A company offers two modern VPNs for remote staff and is shutting down an old one.',
    zones: [
      { name: 'DMZ', subnet: '172.16.9.0/24', hosts: [{ name: 'OVPN01', ip: '172.16.9.10', role: 'OpenVPN server' }, { name: 'WG01', ip: '172.16.9.20', role: 'WireGuard server' }, { name: 'OLDVPN', ip: '172.16.9.30', role: 'old PPTP server, being retired' }] },
      { name: 'VPN USERS', subnet: '10.9.99.0/24', hosts: [{ name: 'VPN clients', ip: '10.9.99.0/24', icon: 'pc' }] },
      { name: 'INTERNAL', subnet: '10.9.10.0/24', hosts: [{ name: 'INTRA01', ip: '10.9.10.5', role: 'intranet site' }] },
    ],
    rules: [
      { need: 'Home workers can connect to OVPN01 on OpenVPN\'s preferred transport.', from: 'Any', to: 'OVPN01', proto: UDP, port: '1194', why: 'OpenVPN is port 1194, and UDP is preferred because it performs better.' },
      { need: 'Travelers on networks that block that transport can fall back to OpenVPN\'s other one.', from: 'Any', to: 'OVPN01', proto: TCP, port: '1194', why: 'OpenVPN can also run on TCP 1194, which gets through more restrictive networks at some cost in speed.' },
      { need: 'Developers anywhere can connect to WG01.', from: 'Any', to: 'WG01', proto: UDP, port: '51820', why: 'WireGuard is UDP 51820, a modern VPN with a small attack surface.' },
      { need: 'Attempts to reach the old server\'s control channel on OLDVPN are blocked and logged, from anywhere.', from: 'Any', to: 'OLDVPN', proto: TCP, port: '1723', action: 'Deny', why: 'PPTP control is TCP 1723. It depends on the broken MS-CHAPv2, so it is being retired.' },
      { need: 'Connected VPN users can reach INTRA01 over HTTPS.', from: 'VPN USERS', to: 'INTRA01', proto: TCP, port: '443', why: 'Once connected, VPN users are just another source network, and the intranet site is ordinary HTTPS on TCP 443.' },
    ],
    takeaway: 'OpenVPN is 1194, UDP preferred. WireGuard is UDP 51820. PPTP is TCP 1723 and should be gone.',
  },

  // ── Databases and the rest ───────────────────────────────────
  {
    id: 'pf-data', set: 'other', title: 'Databases, Windows admin and routing', firewall: 'FW-DC',
    story: 'A data center runs three kinds of database, Windows servers, one old newsgroup server and an edge router that talks to the internet provider.',
    zones: [
      { name: 'APPS', subnet: '10.10.1.0/24', hosts: [{ name: 'HR01', ip: '10.10.1.10', role: 'HR app' }, { name: 'FIN01', ip: '10.10.1.20', role: 'finance app' }, { name: 'SHOP01', ip: '10.10.1.30', role: 'web shop' }] },
      { name: 'DATA', subnet: '10.10.2.0/24', hosts: [{ name: 'MSSQL01', ip: '10.10.2.10', role: 'Microsoft SQL Server' }, { name: 'ORA01', ip: '10.10.2.20', role: 'Oracle database' }, { name: 'MARIA01', ip: '10.10.2.30', role: 'MariaDB database' }] },
      { name: 'WINDOWS', subnet: '10.10.3.0/24', hosts: [{ name: 'ADM02', ip: '10.10.3.5', role: 'admin PC', icon: 'pc' }, { name: 'WIN02', ip: '10.10.3.10', role: 'Windows server' }, { name: 'NEWS01', ip: '10.10.3.20', role: 'old newsgroup server' }] },
      { name: 'EDGE', subnet: '10.10.9.0/24', hosts: [{ name: 'RTR01', ip: '10.10.9.1', role: 'edge router', icon: 'device' }] },
    ],
    outside: [{ name: 'ISP-RTR', ip: '198.51.100.1', role: 'internet provider\'s router' }],
    rules: [
      { need: 'HR01 can query its database on MSSQL01.', from: 'HR01', to: 'MSSQL01', proto: TCP, port: '1433', why: 'Microsoft SQL Server is TCP 1433.' },
      { need: 'FIN01 can query its database on ORA01.', from: 'FIN01', to: 'ORA01', proto: TCP, port: '1521', why: 'Oracle Database listens on TCP 1521. Databases sit in the thousands.' },
      { need: 'SHOP01 can query its database on MARIA01.', from: 'SHOP01', to: 'MARIA01', proto: TCP, port: '3306', why: 'MariaDB uses the same port as MySQL, TCP 3306.' },
      { need: 'ADM02 can manage WIN02 with Windows remote procedure calls, starting at the endpoint mapper.', from: 'ADM02', to: 'WIN02', proto: TCP, port: '135', why: 'The Windows RPC endpoint mapper is TCP 135, and it is a frequent attack surface.' },
      { need: 'RTR01 can open a routing session with the provider\'s router to exchange internet routes.', from: 'RTR01', to: 'ISP-RTR', proto: TCP, port: '179', why: 'BGP exchanges routes between networks over TCP 179.' },
      { need: 'ADM02 can read articles on NEWS01.', from: 'ADM02', to: 'NEWS01', proto: TCP, port: '119', why: 'Newsgroups are NNTP on TCP 119.' },
    ],
    takeaway: 'SQL Server 1433, Oracle 1521, MySQL and MariaDB 3306, Windows RPC 135, BGP 179 and NNTP 119.',
  },
  {
    id: 'pf-voice-iot', set: 'other', title: 'Desk phones and factory sensors', firewall: 'FW-OT',
    story: 'A factory is moving its desk phones to encrypted calling, and its sensors report to a message broker.',
    zones: [
      { name: 'VOICE', subnet: '10.11.1.0/24', hosts: [{ name: 'New phones', ip: '10.11.1.0/25', icon: 'phone' }, { name: 'Old phones', ip: '10.11.1.128/25', icon: 'phone' }] },
      { name: 'SERVERS', subnet: '10.11.2.0/24', hosts: [{ name: 'PBX01', ip: '10.11.2.10', role: 'call manager' }, { name: 'BROKER01', ip: '10.11.2.20', role: 'IoT message broker' }] },
      { name: 'SENSORS', subnet: '10.11.3.0/24', hosts: [{ name: 'Indoor sensors', ip: '10.11.3.0/25', icon: 'device' }, { name: 'Field sensors', ip: '10.11.3.128/25', icon: 'device' }] },
      { name: 'MGMT', subnet: '10.11.9.0/24', hosts: [{ name: 'MON02', ip: '10.11.9.5', role: 'monitoring server' }] },
    ],
    rules: [
      { need: 'Old phones can register with PBX01 using unencrypted SIP, on either of its transports.', from: 'Old phones', to: 'PBX01', proto: BOTH, port: '5060', why: 'Plain SIP signaling is 5060 and can run on UDP or TCP, so this rule covers both.' },
      { need: 'New phones can register with PBX01 using SIP over TLS.', from: 'New phones', to: 'PBX01', proto: TCP, port: '5061', why: 'SIP over TLS is TCP 5061, one above plain SIP. TLS needs TCP.' },
      { need: 'Indoor sensors on the isolated factory network publish readings to BROKER01 without encryption.', from: 'Indoor sensors', to: 'BROKER01', proto: TCP, port: '1883', why: 'Plain MQTT, the lightweight IoT messaging protocol, is TCP 1883.' },
      { need: 'Field sensors publish readings to BROKER01 over TLS.', from: 'Field sensors', to: 'BROKER01', proto: TCP, port: '8883', why: 'MQTT over TLS is TCP 8883. Both MQTT ports end in 883.' },
      { need: 'MON02 can ping PBX01 to check that it is up.', from: 'MON02', to: 'PBX01', proto: ICMP, port: NO_PORT, why: 'Ping is ICMP, which has no ports, so the Port is N/A.' },
    ],
    takeaway: 'SIP is 5060, or 5061 with TLS. MQTT is 1883, or 8883 with TLS.',
  },

  // ── Mixed: whole companies ───────────────────────────────────
  {
    id: 'pf-mix-office', set: MIXED, title: 'A small law office', firewall: 'FW-OFFICE',
    story: 'A law office runs its own domain, file share and mail server. This one pulls ports from several sets, just as a real office does.',
    zones: [
      { name: 'STAFF', subnet: '10.20.10.0/24', hosts: [{ name: 'Staff PCs', ip: '10.20.10.0/24', icon: 'pc' }] },
      { name: 'SERVERS', subnet: '10.20.20.0/24', hosts: [{ name: 'DC02', ip: '10.20.20.10', role: 'domain controller and DNS server' }, { name: 'FS02', ip: '10.20.20.20', role: 'Windows file server' }, { name: 'MAIL02', ip: '10.20.20.30', role: 'mail server' }] },
      { name: 'IT', subnet: '10.20.30.0/24', hosts: [{ name: 'IT02', ip: '10.20.30.5', role: 'IT administrator\'s PC', icon: 'pc' }] },
    ],
    outside: [{ name: 'TIME01', ip: '203.0.113.50', role: 'public time server' }],
    rules: [
      { need: 'Staff PCs can browse the web, but only over encrypted connections.', from: 'STAFF', to: 'Any', proto: TCP, port: '443', why: 'Encrypted web only means HTTPS on TCP 443, with no rule for 80.' },
      { need: 'Staff PCs can look up names on DC02, including large answers that fall back from UDP.', from: 'STAFF', to: 'DC02', proto: BOTH, port: '53', why: 'DNS is UDP 53 for normal lookups and TCP 53 for large answers, so this rule needs both.' },
      { need: 'Staff PCs can get Kerberos tickets from DC02.', from: 'STAFF', to: 'DC02', proto: BOTH, port: '88', why: 'Kerberos runs on port 88 over both UDP and TCP.' },
      { need: 'Staff PCs can open the shared folders on FS02.', from: 'STAFF', to: 'FS02', proto: TCP, port: '445', why: 'Windows file sharing is SMB on TCP 445.' },
      { need: 'Staff mail apps can read mail on MAIL02 over an encrypted connection, leaving it on the server.', from: 'STAFF', to: 'MAIL02', proto: TCP, port: '993', why: 'Mail left on the server is IMAP, and encrypted IMAP is TCP 993.' },
      { need: 'Staff mail apps can send mail through MAIL02 by client submission with STARTTLS.', from: 'STAFF', to: 'MAIL02', proto: TCP, port: '587', why: 'Client submission with STARTTLS is TCP 587.' },
      { need: 'DC02 can set its clock from TIME01.', from: 'DC02', to: 'TIME01', proto: UDP, port: '123', why: 'NTP is UDP 123, and a domain controller\'s clock has to be right or Kerberos fails.' },
      { need: 'IT02 can open the full graphical desktop of DC02.', from: 'IT02', to: 'DC02', proto: TCP, port: '3389', why: 'A remote Windows desktop is RDP on TCP 3389, limited here to one PC.' },
    ],
    takeaway: 'A plain office needs surprisingly few ports: 443, 53, 88, 445, 993, 587, 123 and 3389.',
  },
  {
    id: 'pf-mix-encrypt', set: MIXED, title: 'Encrypt everything: the audit', firewall: 'FW-AUDIT',
    story: 'An audit found old cleartext protocols all over a company. Each system below is moving to the encrypted version of what it used. Write the rule for the new, encrypted service.',
    zones: [
      { name: 'APPS', subnet: '10.21.1.0/24', hosts: [{ name: 'APP02', ip: '10.21.1.10', role: 'staff portal' }, { name: 'WEB02', ip: '10.21.1.20', role: 'intranet site' }, { name: 'FILER', ip: '10.21.1.30', role: 'transfer server' }] },
      { name: 'USERS', subnet: '10.21.5.0/24', hosts: [{ name: 'Staff PCs', ip: '10.21.5.0/24', icon: 'pc' }] },
      { name: 'CORE', subnet: '10.21.9.0/24', hosts: [{ name: 'DC03', ip: '10.21.9.10', role: 'domain controller' }, { name: 'MAIL03', ip: '10.21.9.20', role: 'mail server' }, { name: 'SIEM03', ip: '10.21.9.30', role: 'log collector' }, { name: 'SW01', ip: '10.21.9.40', role: 'network switch', icon: 'device' }] },
    ],
    outside: [{ name: 'SAFE-DNS', ip: '198.51.100.53', role: 'public resolver' }],
    rules: [
      { need: 'APP02 used plain LDAP to look up users on DC03.', from: 'APP02', to: 'DC03', proto: TCP, port: '636', why: 'LDAP on 389 becomes LDAPS on TCP 636.' },
      { need: 'Staff used Telnet to manage SW01.', from: 'USERS', to: 'SW01', proto: TCP, port: '22', why: 'Telnet on 23 becomes SSH on TCP 22.' },
      { need: 'Staff read mail on MAIL03 with IMAP.', from: 'USERS', to: 'MAIL03', proto: TCP, port: '993', why: 'IMAP on 143 becomes IMAPS on TCP 993.' },
      { need: 'APP02 collected mail from MAIL03 with POP3.', from: 'APP02', to: 'MAIL03', proto: TCP, port: '995', why: 'POP3 on 110 becomes POP3S on TCP 995.' },
      { need: 'Staff opened WEB02 over plain HTTP.', from: 'USERS', to: 'WEB02', proto: TCP, port: '443', why: 'HTTP on 80 becomes HTTPS on TCP 443.' },
      { need: 'WEB02 sent logs to SIEM03 with traditional syslog.', from: 'WEB02', to: 'SIEM03', proto: TCP, port: '6514', why: 'Syslog on UDP 514 becomes syslog over TLS on TCP 6514. Note that the transport changes as well as the number.' },
      { need: 'DC03 sent its forwarded lookups to SAFE-DNS as plain DNS, and now they must be encrypted with TLS.', from: 'DC03', to: 'SAFE-DNS', proto: TCP, port: '853', why: 'DNS on 53 becomes DNS over TLS on TCP 853.' },
      { need: 'Staff sent FTP commands to FILER, and it now runs implicit FTPS.', from: 'USERS', to: 'FILER', proto: TCP, port: '990', why: 'FTP control on 21 becomes implicit FTPS control on TCP 990.' },
    ],
    takeaway: 'Know the pairs: 23 to 22, 80 to 443, 110 to 995, 143 to 993, 389 to 636, 514 to 6514, 53 to 853 and 21 to 990.',
  },
  {
    id: 'pf-mix-hospital', set: MIXED, title: 'A clinic\'s patient records system', firewall: 'FW-CLINIC',
    story: 'A clinic is isolating the servers that hold patient records, so every flow has to be named.',
    zones: [
      { name: 'CLINICAL', subnet: '10.30.10.0/24', hosts: [{ name: 'Clinical PCs', ip: '10.30.10.0/24', icon: 'pc' }] },
      { name: 'WIRELESS', subnet: '10.30.20.0/24', hosts: [{ name: 'Access points', ip: '10.30.20.0/24', icon: 'wifi' }] },
      { name: 'SERVERS', subnet: '10.30.40.0/24', hosts: [{ name: 'EHR01', ip: '10.30.40.10', role: 'patient records app' }, { name: 'ORA02', ip: '10.30.40.20', role: 'Oracle database on Linux' }, { name: 'DC04', ip: '10.30.40.30', role: 'domain controller' }, { name: 'RAD01', ip: '10.30.40.40', role: 'RADIUS server' }] },
      { name: 'MGMT', subnet: '10.30.90.0/24', hosts: [{ name: 'SIEM02', ip: '10.30.90.10', role: 'log collector' }, { name: 'MON03', ip: '10.30.90.20', role: 'monitoring server' }, { name: 'JMP01', ip: '10.30.90.30', role: 'jump host' }] },
    ],
    rules: [
      { need: 'Clinical PCs can open EHR01 over an encrypted web connection.', from: 'CLINICAL', to: 'EHR01', proto: TCP, port: '443', why: 'An encrypted web app is HTTPS on TCP 443.' },
      { need: 'EHR01 can query its database on ORA02.', from: 'EHR01', to: 'ORA02', proto: TCP, port: '1521', why: 'Oracle Database is TCP 1521.' },
      { need: 'EHR01 can look up staff in the directory on DC04 over an encrypted connection.', from: 'EHR01', to: 'DC04', proto: TCP, port: '636', why: 'Encrypted directory lookups are LDAPS on TCP 636.' },
      { need: 'Access points can check Wi-Fi logins against RAD01.', from: 'WIRELESS', to: 'RAD01', proto: UDP, port: '1812', why: 'Wi-Fi logins through 802.1X use RADIUS authentication on UDP 1812.' },
      { need: 'EHR01 can send its logs to SIEM02 over an encrypted connection.', from: 'EHR01', to: 'SIEM02', proto: TCP, port: '6514', why: 'Encrypted log forwarding is syslog over TLS on TCP 6514.' },
      { need: 'MON03 can poll EHR01 for its counters with SNMP.', from: 'MON03', to: 'EHR01', proto: UDP, port: '161', why: 'SNMP polling goes to the device on UDP 161.' },
      { need: 'JMP01 can manage ORA02 over an encrypted command line.', from: 'JMP01', to: 'ORA02', proto: TCP, port: '22', why: 'An encrypted command line is SSH on TCP 22, and a jump host is the one place admins come from.' },
      { need: 'MON03 can ping DC04 to check that it is up.', from: 'MON03', to: 'DC04', proto: ICMP, port: NO_PORT, why: 'Ping is ICMP and has no port.' },
    ],
    takeaway: 'Sensitive systems still need the basics, each named exactly: web, database, directory, logs, monitoring and admin access.',
  },
  {
    id: 'pf-mix-shop', set: MIXED, title: 'An online shop', firewall: 'FW-SHOP',
    story: 'An online shop runs in three tiers, and it also receives mail and takes card payments through an outside provider.',
    zones: [
      { name: 'DMZ', subnet: '172.16.30.0/24', hosts: [{ name: 'WEB03', ip: '172.16.30.10', role: 'load balancer for the shop' }, { name: 'MX03', ip: '172.16.30.20', role: 'inbound mail gateway' }] },
      { name: 'APP', subnet: '10.40.2.0/24', hosts: [{ name: 'APP03', ip: '10.40.2.10', role: 'shop app on the alternate HTTPS port' }] },
      { name: 'DATA', subnet: '10.40.3.0/24', hosts: [{ name: 'DB03', ip: '10.40.3.10', role: 'MySQL database' }] },
      { name: 'OFFICE', subnet: '10.40.8.0/24', hosts: [{ name: 'OPS01', ip: '10.40.8.5', role: 'operations PC', icon: 'pc' }] },
    ],
    outside: [{ name: 'PAY', ip: '203.0.113.80', role: 'card payment provider, HTTPS API' }],
    rules: [
      { need: 'Anyone on the internet can open the shop on WEB03 over an encrypted connection.', from: 'Any', to: 'WEB03', proto: TCP, port: '443', why: 'Public encrypted web traffic is HTTPS on TCP 443.' },
      { need: 'Only WEB03 can send requests to APP03.', from: 'WEB03', to: 'APP03', proto: TCP, port: '8443', why: 'The diagram says APP03 listens on the alternate HTTPS port, which is TCP 8443.' },
      { need: 'Only APP03 can query DB03.', from: 'APP03', to: 'DB03', proto: TCP, port: '3306', why: 'MySQL is TCP 3306.' },
      { need: 'APP03 can send card payments to the provider, and to no other internet host.', from: 'APP03', to: 'PAY', proto: TCP, port: '443', why: 'The provider\'s API is HTTPS, so TCP 443, with the destination limited to that one address.' },
      { need: 'Mail servers on the internet can deliver mail to MX03.', from: 'Any', to: 'MX03', proto: TCP, port: '25', why: 'Server-to-server mail is SMTP on TCP 25.' },
      { need: 'OPS01 can manage APP03 over an encrypted command line.', from: 'OPS01', to: 'APP03', proto: TCP, port: '22', why: 'SSH on TCP 22 from one operations PC.' },
      { need: 'OPS01 can query DB03 directly for reports.', from: 'OPS01', to: 'DB03', proto: TCP, port: '3306', why: 'The database listens on the same TCP 3306 whichever host connects. Only the source changes.' },
    ],
    takeaway: 'Tiers chain together: 443 into the front, 8443 to the app, 3306 to the database, and each tier reaches only the next.',
  },
  {
    id: 'pf-mix-branch', set: MIXED, title: 'A new branch office', firewall: 'FW-BRANCH',
    story: 'You are writing the headquarters firewall rules for a new branch that connects over IPsec. It depends on headquarters for sign-ins, phones, files and names.',
    zones: [
      { name: 'HQ SERVERS', subnet: '10.50.1.0/24', hosts: [{ name: 'VPN02', ip: '10.50.1.1', role: 'IPsec gateway' }, { name: 'DNS03', ip: '10.50.1.10', role: 'DNS and time server' }, { name: 'FS03', ip: '10.50.1.20', role: 'Windows file server' }, { name: 'RAD02', ip: '10.50.1.30', role: 'RADIUS server' }, { name: 'TAC02', ip: '10.50.1.40', role: 'TACACS+ server' }, { name: 'PBX02', ip: '10.50.1.50', role: 'call manager, encrypted signaling' }, { name: 'CFG01', ip: '10.50.1.60', role: 'phone settings server, no login' }] },
      { name: 'BRANCH', subnet: '192.168.70.0/24', hosts: [{ name: 'Branch PCs', ip: '192.168.70.0/25', icon: 'pc' }, { name: 'Branch phones', ip: '192.168.70.128/26', icon: 'phone' }, { name: 'Branch gear', ip: '192.168.70.192/26', role: 'switch and access points', icon: 'device' }] },
    ],
    outside: [{ name: 'BR-GW', ip: '203.0.113.90', role: 'branch VPN gateway, behind NAT' }],
    rules: [
      { need: 'BR-GW can negotiate the tunnel\'s keys with VPN02.', from: 'BR-GW', to: 'VPN02', proto: UDP, port: '500', why: 'IKE negotiates the tunnel on UDP 500.' },
      { need: 'BR-GW sits behind NAT, so its tunnel traffic has to be wrapped to reach VPN02.', from: 'BR-GW', to: 'VPN02', proto: UDP, port: '4500', why: 'NAT traversal for IPsec is UDP 4500.' },
      { need: 'Branch PCs can look up names on DNS03 with ordinary small queries.', from: 'Branch PCs', to: 'DNS03', proto: UDP, port: '53', why: 'Ordinary DNS lookups are UDP 53.' },
      { need: 'Branch PCs can open the shared folders on FS03.', from: 'Branch PCs', to: 'FS03', proto: TCP, port: '445', why: 'SMB on TCP 445.' },
      { need: 'Branch phones can set up encrypted calls through PBX02.', from: 'Branch phones', to: 'PBX02', proto: TCP, port: '5061', why: 'Encrypted call signaling is SIP over TLS on TCP 5061.' },
      { need: 'Branch phones can download their settings from CFG01 at startup.', from: 'Branch phones', to: 'CFG01', proto: UDP, port: '69', why: 'A settings server with no login is TFTP on UDP 69.' },
      { need: 'The branch access points can check Wi-Fi logins against RAD02.', from: 'Branch gear', to: 'RAD02', proto: UDP, port: '1812', why: 'RADIUS authentication is UDP 1812.' },
      { need: 'The branch switch can check administrators\' logins against TAC02.', from: 'Branch gear', to: 'TAC02', proto: TCP, port: '49', why: 'Device administrator logins against a TACACS+ server use TCP 49.' },
    ],
    takeaway: 'A branch is a small copy of the whole list: tunnel ports first, then the services it borrows from headquarters.',
  },
] satisfies Draft[]).map(build);

/** Each number in a trainer entry such as "67/68" or "137-139". */
export function portNumbers(entry: string): number[] {
  return entry.split('/').flatMap(part => {
    const [lo, hi] = part.split('-').map(Number);
    return hi ? Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) : [lo];
  });
}

/** The trainer entry a typed-style port answer belongs to, such as "68" to "67/68". */
export function trainerEntry(port: string): string | undefined {
  const n = Number(port);
  return Number.isInteger(n) && n > 0 ? PORTS.find(e => portNumbers(e.port).includes(n))?.port : undefined;
}

/**
 * How each trainer port went in a checked table: right only if every rule using it had both Protocol and Port right.
 * The Source, Destination and Action do not count here, because this is about knowing the port.
 */
export function portOutcomes(q: FirewallQuestion, cells: Record<string, string>[] | undefined): { port: string; right: boolean }[] {
  const seen = new Map<string, boolean>();
  q.rows.forEach((row, r) => {
    const port = trainerEntry(row.answer['Port']);
    if (!port) return;
    const cell = cells?.[r] ?? {};
    const right = (cell['Protocol'] ?? '') === row.answer['Protocol'] && normalizePort(cell['Port'] ?? '') === normalizePort(row.answer['Port']);
    seen.set(port, (seen.get(port) ?? true) && right);
  });
  return [...seen].map(([port, right]) => ({ port, right }));
}
