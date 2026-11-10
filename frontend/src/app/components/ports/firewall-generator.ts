/**
 * Builds a new firewall table every time, so nothing can be memorized by position: the hosts, the addresses and the
 * wording all change. Each rule is worded one of two ways: `plain` names the protocol the way exam simulations do
 * ("Allow LDAP queries from ..."), and `job` only describes what is needed. Neither ever gives the number.
 *
 * Which rules a table asks is decided by spaced repetition, the same FSRS-6 memory model Review mode uses (see
 * utils/srs.ts). Every rule has its own memory, and a table is put together like a review session: rules that are due
 * come first, the ones most likely forgotten ahead of the rest, then a few new rules, then rules that are nearly due.
 * A rule being learned brings its look-alikes into the same table. The better a port is known, the more often its
 * rule only describes the job.
 *
 * A table is rebuilt from a small GeneratedRef, so a refresh brings back exactly the same one.
 */

import { NetHost, NetZone } from '../../models/exam.model';
import { seededRandom, shuffled } from '../../utils/exam-engine';
import { SrsCard, recallNow } from '../../utils/srs';
import { AH, BOTH, Draft, ESP, ICMP, MIXED, NO_PORT, PortScenario, Rule, TCP, UDP, build, trainerEntry } from './firewall-scenarios';
import { GROUPS, MAX_LEVEL } from './ports-trainer';

type ZoneKey = 'corp' | 'guest' | 'dmz' | 'servers' | 'mgmt' | 'devices' | 'voice' | 'iot';

const ZONE_NAMES: Record<ZoneKey, string> = {
  corp: 'Corporate Network', guest: 'Guest Network', dmz: 'Screened Subnet', servers: 'Server Network',
  mgmt: 'Management Network', devices: 'Network Devices', voice: 'Voice Network', iot: 'IoT Network',
};
const ZONE_ORDER: ZoneKey[] = ['corp', 'guest', 'dmz', 'servers', 'mgmt', 'devices', 'voice', 'iot'];

interface HostDef { name: string; zones: ZoneKey[]; icon?: NetHost['icon']; /** Stands for a whole subnet of devices. */ many?: boolean }

const HOSTS: Record<string, HostDef> = {
  employee: { name: 'Employee Workstation', zones: ['corp'], icon: 'pc' },
  admin: { name: 'Administrator', zones: ['corp'], icon: 'pc' },
  legacy: { name: 'Legacy PC', zones: ['corp'], icon: 'pc' },
  kiosk: { name: 'Lobby Kiosk', zones: ['corp'], icon: 'pc' },
  guests: { name: 'Guest Devices', zones: ['guest'], icon: 'wifi', many: true },
  web: { name: 'Web Server', zones: ['dmz'] },
  mailgw: { name: 'Mail Gateway', zones: ['dmz'] },
  ftp: { name: 'File Transfer Server', zones: ['dmz'] },
  vpn: { name: 'VPN Gateway', zones: ['dmz'] },
  mail: { name: 'Email Server', zones: ['dmz', 'servers'] },
  proxy: { name: 'Web Proxy', zones: ['dmz', 'servers'] },
  dns: { name: 'DNS Server', zones: ['servers', 'dmz'] },
  dns2: { name: 'Secondary DNS Server', zones: ['dmz', 'servers'] },
  dhcp: { name: 'DHCP Server', zones: ['servers'] },
  time: { name: 'Time Server', zones: ['servers'] },
  file: { name: 'File Server', zones: ['servers'] },
  print: { name: 'Print Server', zones: ['servers'], icon: 'printer' },
  phonecfg: { name: 'Phone Config Server', zones: ['servers'] },
  dc: { name: 'Domain Controller', zones: ['servers'] },
  auth: { name: 'Authentication Server', zones: ['servers'] },
  db: { name: 'Database Server', zones: ['servers'] },
  app: { name: 'App Server', zones: ['servers'] },
  linux: { name: 'Linux Server', zones: ['servers'] },
  win: { name: 'Windows Server', zones: ['servers'] },
  pbx: { name: 'Call Manager', zones: ['servers'] },
  broker: { name: 'IoT Broker', zones: ['servers'] },
  news: { name: 'News Server', zones: ['servers'] },
  console: { name: 'Management Console', zones: ['mgmt'] },
  siem: { name: 'Log Collector', zones: ['mgmt'] },
  mon: { name: 'Monitoring Server', zones: ['mgmt'] },
  jump: { name: 'Jump Host', zones: ['mgmt'] },
  sw: { name: 'Network Switch', zones: ['devices'], icon: 'device' },
  ap: { name: 'Access Point', zones: ['devices'], icon: 'wifi' },
  router: { name: 'Edge Router', zones: ['devices'], icon: 'device' },
  phones: { name: 'IP Phones', zones: ['voice'], icon: 'phone', many: true },
  sensors: { name: 'Sensors', zones: ['iot'], icon: 'device', many: true },
};

const OUTSIDE: Record<string, string> = {
  partner: 'Partner Site', branch: 'Branch Gateway', isp: 'ISP Router', resolver: 'Public Resolver', ptime: 'Public Time Server',
};

/** Hosts drawn in the network without being in any rule, so the answer is not just "every host shown". */
const DECOYS = ['file', 'db', 'app', 'print', 'linux', 'win', 'mon', 'siem', 'web'];

export interface Flow {
  id: string;
  set: string;
  /** How the takeaway names it. */
  label: string;
  port: string;
  proto: string;
  action?: 'Deny';
  /** Places: a HOSTS or OUTSIDE key, 'corp', 'guest', 'internet' or 'anydev'. */
  from: string[];
  to: string[];
  plain: string[];
  job: string[];
  why: string;
}

const BLOCK_LOG = 'Log each attempt';

export const FLOWS: Flow[] = [
  // ── Remote access ──
  { id: 'ssh', set: 'remote', label: 'SSH', port: '22', proto: TCP, from: ['admin', 'jump'], to: ['linux', 'sw'],
    plain: ['Allow SSH from {from} to {to}', 'Allow secure shell connections from {from} to {to}'],
    job: ['{from} can manage {to} over an encrypted command line', '{from} needs an encrypted remote terminal on {to}'],
    why: 'SSH is TCP 22. It replaced Telnet, its neighbor on port 23, which sends everything in cleartext.' },
  { id: 'sftp', set: 'remote', label: 'SFTP', port: '22', proto: TCP, from: ['partner', 'admin'], to: ['ftp'],
    plain: ['Allow SFTP file transfers from {from} to {to}'],
    job: ['{from} can upload files to {to} with the transfer that runs inside an encrypted shell'],
    why: 'SFTP runs inside SSH, so it shares TCP 22. FTPS is a different thing: FTP wrapped in TLS on its own ports.' },
  { id: 'telnet', set: 'remote', label: 'Telnet', port: '23', proto: TCP, from: ['admin'], to: ['sw', 'router'],
    plain: ['Allow Telnet from {from} to {to}'],
    job: ['{to} only supports the old unencrypted remote terminal, and {from} still has to manage it'],
    why: 'Telnet is TCP 23. Everything including the password crosses the network in cleartext.' },
  { id: 'telnet-block', set: 'remote', label: 'Telnet', port: '23', proto: TCP, action: 'Deny', from: ['corp', 'guest', 'employee'], to: ['sw', 'router'],
    plain: ['Block all Telnet connections from {from} to {to}'],
    job: [`{from} must not be able to open an unencrypted remote terminal on {to}. ${BLOCK_LOG}`],
    why: 'Telnet is TCP 23. Block means the Action is Deny, and a written deny is what puts each attempt in the log.' },
  { id: 'rdp', set: 'remote', label: 'RDP', port: '3389', proto: TCP, from: ['admin', 'jump'], to: ['win'],
    plain: ['Allow RDP connections from {from} to {to}', 'Allow Remote Desktop from {from} to {to}'],
    job: ['{from} can open the full graphical desktop of {to}'],
    why: 'A whole Windows desktop over the network is RDP on TCP 3389.' },
  { id: 'rdp-block', set: 'remote', label: 'RDP', port: '3389', proto: TCP, action: 'Deny', from: ['employee', 'guest', 'corp'], to: ['win', 'dc'],
    plain: ['Block Remote Desktop traffic from {from} to {to}'],
    job: [`{from} must not be able to open a graphical desktop on {to}. ${BLOCK_LOG}`],
    why: 'RDP is TCP 3389, and block means the Action is Deny.' },
  { id: 'vnc', set: 'remote', label: 'VNC', port: '5900', proto: TCP, from: ['admin'], to: ['kiosk'],
    plain: ['Allow VNC connections from {from} to {to}'],
    job: ['{from} can take over the screen of {to} with the screen-sharing tool that is not tied to Windows'],
    why: 'VNC screen sharing uses TCP 5900 and is often unencrypted.' },

  // ── The web ──
  { id: 'https-in', set: 'web', label: 'HTTPS', port: '443', proto: TCP, from: ['internet'], to: ['web'],
    plain: ['Allow HTTPS from {from} to {to}', 'Allow secure web traffic from {from} to {to}'],
    job: ['{from} can open the site on {to} over an encrypted connection'],
    why: 'Encrypted web traffic is HTTPS on TCP 443. Think of 80 as the open web and 443 as the locked web.' },
  { id: 'https-out', set: 'web', label: 'HTTPS', port: '443', proto: TCP, from: ['corp', 'proxy'], to: ['internet'],
    plain: ['Allow HTTPS browsing from {from} to {to}'],
    job: ['{from} can browse encrypted websites on {to}'],
    why: 'Encrypted browsing is HTTPS on TCP 443, and the Internet as a destination is Any.' },
  { id: 'https-app', set: 'web', label: 'HTTPS', port: '443', proto: TCP, from: ['corp', 'employee'], to: ['app', 'console'],
    plain: ['Allow HTTPS from {from} to {to}'],
    job: ['{from} can open the web interface on {to} over an encrypted connection'],
    why: 'An encrypted web interface is HTTPS on TCP 443 unless the question says it uses another port.' },
  { id: 'http', set: 'web', label: 'HTTP', port: '80', proto: TCP, from: ['internet'], to: ['web'],
    plain: ['Allow HTTP from {from} to {to}', 'Allow unencrypted web traffic from {from} to {to}'],
    job: ['{from} can still reach {to} without encryption, so visitors can be redirected to the secure site'],
    why: 'Plain HTTP is TCP 80. Sites often keep it open only to send visitors straight to HTTPS.' },
  { id: 'http-block', set: 'web', label: 'HTTP', port: '80', proto: TCP, action: 'Deny', from: ['corp', 'guest'], to: ['app', 'console'],
    plain: ['Block all HTTP connections from {from} to {to}'],
    job: [`{from} must not be able to reach the site on {to} without encryption. ${BLOCK_LOG}`],
    why: 'Unencrypted web traffic is HTTP on TCP 80, and block means the Action is Deny.' },
  { id: 'alt-http', set: 'web', label: 'Alternate HTTP', port: '8080', proto: TCP, from: ['corp', 'employee'], to: ['proxy'],
    plain: ['Allow traffic on the alternate HTTP port from {from} to {to}', 'Allow web proxy traffic on the alternate HTTP port from {from} to {to}'],
    job: ['{from} sends its web requests to {to}, which listens on the alternate port for unencrypted web traffic'],
    why: 'The alternate HTTP port is TCP 8080, a common home for web proxies. It is still unencrypted.' },
  { id: 'alt-https', set: 'web', label: 'Alternate HTTPS', port: '8443', proto: TCP, from: ['admin', 'jump'], to: ['console'],
    plain: ['Allow traffic on the alternate HTTPS port from {from} to {to}'],
    job: ['{from} can open {to}, which serves its encrypted interface on the alternate port'],
    why: 'The alternate HTTPS port is TCP 8443. The alternates add 8000 and keep the ending.' },

  // ── Names, addresses and time ──
  { id: 'dns', set: 'names', label: 'DNS lookups', port: '53', proto: UDP, from: ['corp', 'employee'], to: ['dns'],
    plain: ['Allow standard DNS lookups from {from} to {to}'],
    job: ['{from} can look up names on {to} with ordinary small queries'],
    why: 'Ordinary DNS lookups are small and use UDP 53, because a quick question needs no connection setup.' },
  { id: 'dns-zone', set: 'names', label: 'DNS zone transfers', port: '53', proto: TCP, from: ['dns2'], to: ['dns'],
    plain: ['Allow DNS zone transfers from {from} to {to}'],
    job: ['{from} can copy the full set of name records from {to}'],
    why: 'A zone transfer is large and must arrive complete, so DNS switches to TCP 53. Same port, different transport.' },
  { id: 'dot', set: 'names', label: 'DNS over TLS', port: '853', proto: TCP, from: ['dns'], to: ['resolver'],
    plain: ['Allow DNS over TLS from {from} to {to}'],
    job: ['{from} can forward its name lookups to {to} inside an encrypted TLS connection'],
    why: 'DNS over TLS is TCP 853: DNS 53 with an 8 in front. TLS needs a connection, so it is TCP.' },
  { id: 'dhcp', set: 'names', label: 'DHCP to the server', port: '67', proto: UDP, from: ['anydev'], to: ['dhcp'],
    plain: ['Allow DHCP requests from {from} to {to}'],
    job: ['Devices with no address yet can ask {to} for one'],
    why: 'DHCP servers listen on UDP 67. The source has to be Any, because a device asking for an address does not have one.' },
  { id: 'dhcp-reply', set: 'names', label: 'DHCP to the client', port: '68', proto: UDP, from: ['dhcp'], to: ['anydev'],
    plain: ['Allow DHCP replies from {from} to {to}'],
    job: ['{from} can hand new addresses back to devices that do not have one yet'],
    why: 'DHCP clients listen on UDP 68. The server gets the lower number, 67, and the client the higher, 68.' },
  { id: 'ntp', set: 'names', label: 'NTP', port: '123', proto: UDP, from: ['corp', 'dc'], to: ['time'],
    plain: ['Allow NTP from {from} to {to}'],
    job: ['{from} can set its clocks from {to}'],
    why: 'NTP is UDP 123, easy to remember as one, two, three.' },
  { id: 'ntp-out', set: 'names', label: 'NTP', port: '123', proto: UDP, from: ['time', 'dc'], to: ['ptime'],
    plain: ['Allow NTP from {from} to {to}'],
    job: ['{from} can set its own clock from {to}'],
    why: 'Here the inside host is the NTP client, still going to UDP 123.' },

  // ── Email ──
  { id: 'smtp-in', set: 'mail', label: 'SMTP', port: '25', proto: TCP, from: ['internet'], to: ['mailgw'],
    plain: ['Allow SMTP mail delivery from {from} to {to}'],
    job: ['Mail servers on {from} can deliver messages to {to}'],
    why: 'Server-to-server mail delivery is SMTP on TCP 25.' },
  { id: 'smtp-relay', set: 'mail', label: 'SMTP', port: '25', proto: TCP, from: ['mailgw'], to: ['mail'],
    plain: ['Allow SMTP relay from {from} to {to}'],
    job: ['{from} can hand clean mail on to {to}'],
    why: 'One mail server passing mail to another is SMTP on TCP 25.' },
  { id: 'submission', set: 'mail', label: 'Mail submission', port: '587', proto: TCP, from: ['corp', 'employee'], to: ['mail'],
    plain: ['Allow SMTP mail submission with STARTTLS from {from} to {to}'],
    job: ['Mail apps on {from} can send outgoing mail through {to} with a connection that starts plain and upgrades'],
    why: 'A mail app submitting mail uses TCP 587 with STARTTLS. 25 is servers talking to each other, 587 is you sending.' },
  { id: 'smtps', set: 'mail', label: 'SMTP over implicit TLS', port: '465', proto: TCP, from: ['app'], to: ['mail'],
    plain: ['Allow SMTP over implicit TLS from {from} to {to}'],
    job: ['{from} can send mail through {to} over a connection that is encrypted from the very first byte'],
    why: 'Implicit TLS for SMTP is TCP 465: encrypted from the first byte, where 587 starts plain and upgrades.' },
  { id: 'pop3', set: 'mail', label: 'POP3', port: '110', proto: TCP, from: ['legacy', 'corp'], to: ['mail'],
    plain: ['Allow POP3 email retrieval from {from} to {to}'],
    job: ['{from} can download mail from {to} without encryption, removing it from the server'],
    why: 'Download and remove is POP3, and plain POP3 is TCP 110.' },
  { id: 'pop3-block', set: 'mail', label: 'POP3', port: '110', proto: TCP, action: 'Deny', from: ['corp', 'guest'], to: ['mail'],
    plain: ['Block all POP3 connections from {from} to {to}'],
    job: [`{from} must not be able to download mail from {to} without encryption. ${BLOCK_LOG}`],
    why: 'Plain POP3 is TCP 110, and block means the Action is Deny.' },
  { id: 'pop3s', set: 'mail', label: 'POP3S', port: '995', proto: TCP, from: ['corp', 'employee'], to: ['mail'],
    plain: ['Allow secure POP3 email retrieval from {from} to {to}', 'Allow POP3S from {from} to {to}'],
    job: ['{from} can download mail from {to} over an encrypted connection, removing it from the server'],
    why: 'Encrypted POP3 is POP3S on TCP 995.' },
  { id: 'imap', set: 'mail', label: 'IMAP', port: '143', proto: TCP, from: ['corp', 'legacy'], to: ['mail'],
    plain: ['Allow unencrypted IMAP mailbox access from {from} to {to}'],
    job: ['{from} can read mail on {to} without encryption, leaving it on the server'],
    why: 'Leaving mail on the server is IMAP, and plain IMAP is TCP 143.' },
  { id: 'imaps', set: 'mail', label: 'IMAPS', port: '993', proto: TCP, from: ['corp', 'employee'], to: ['mail'],
    plain: ['Allow secure IMAP mailbox access from {from} to {to}', 'Allow IMAPS from {from} to {to}'],
    job: ['{from} can read mail on {to} over an encrypted connection, leaving it on the server'],
    why: 'Encrypted IMAP is IMAPS on TCP 993. The secure mail readers live in the 990s.' },

  // ── Files and sharing ──
  { id: 'smb', set: 'files', label: 'SMB', port: '445', proto: TCP, from: ['corp', 'employee'], to: ['file'],
    plain: ['Allow SMB file sharing from {from} to {to}'],
    job: ['{from} can open the shared folders on {to}'],
    why: 'Windows file sharing is SMB on TCP 445, the port ransomware loves to spread over.' },
  { id: 'smb-block', set: 'files', label: 'SMB', port: '445', proto: TCP, action: 'Deny', from: ['guest'], to: ['file', 'print'],
    plain: ['Block all SMB connections from {from} to {to}'],
    job: [`{from} must not be able to open Windows shares on {to}. ${BLOCK_LOG}`],
    why: 'SMB is TCP 445, and block means the Action is Deny.' },
  { id: 'tftp', set: 'files', label: 'TFTP', port: '69', proto: UDP, from: ['phones'], to: ['phonecfg'],
    plain: ['Allow TFTP from {from} to {to}'],
    job: ['{from} can fetch settings from {to} at startup with the simple transfer that has no login'],
    why: 'TFTP is UDP 69, with no login and no encryption, so keep it on internal networks.' },
  { id: 'ftp', set: 'files', label: 'FTP control', port: '21', proto: TCP, from: ['partner', 'employee'], to: ['ftp'],
    plain: ['Allow FTP control connections from {from} to {to}'],
    job: ['{from} can log in to {to} and send file transfer commands in cleartext'],
    why: 'FTP commands and logins travel on the control channel, TCP 21, in cleartext.' },
  { id: 'ftp-data', set: 'files', label: 'FTP data', port: '20', proto: TCP, from: ['ftp'], to: ['partner'],
    plain: ['Allow active-mode FTP data connections from {from} to {to}. Enter the well-known port the server sends from'],
    job: ['{from} can open the cleartext file transfer\'s active-mode data connection back to {to}. Enter the well-known port the server sends from'],
    why: 'In active mode the server sends the file from its own TCP 20. The data port is one below the command port.' },
  { id: 'ftps', set: 'files', label: 'Implicit FTPS control', port: '990', proto: TCP, from: ['partner'], to: ['ftp'],
    plain: ['Allow implicit FTPS control connections from {from} to {to}'],
    job: ['{from} can send file transfer commands to {to} over a channel that uses TLS from the start'],
    why: 'Implicit FTPS uses TCP 990 for control, encrypted with TLS from the start.' },
  { id: 'ftps-data', set: 'files', label: 'Implicit FTPS data', port: '989', proto: TCP, from: ['ftp'], to: ['partner'],
    plain: ['Allow implicit FTPS data connections from {from} to {to}. Enter the well-known port the server sends from'],
    job: ['{from} can open the TLS file transfer\'s data connection back to {to}. Enter the well-known port the server sends from'],
    why: 'Implicit FTPS data is TCP 989, one below control, just as FTP data on 20 sits one below 21.' },
  { id: 'nb-name', set: 'files', label: 'NetBIOS name service', port: '137', proto: UDP, from: ['legacy'], to: ['file', 'win'],
    plain: ['Allow NetBIOS name service traffic from {from} to {to}'],
    job: ['{from} can look up Windows computer names on {to} the legacy way'],
    why: 'NetBIOS uses three neighbors. The name service is UDP 137, the first of the three.' },
  { id: 'nb-dgram', set: 'files', label: 'NetBIOS datagram service', port: '138', proto: UDP, from: ['legacy'], to: ['file', 'win'],
    plain: ['Allow NetBIOS datagram service traffic from {from} to {to}'],
    job: ['{from} can send connectionless legacy Windows networking messages to {to}'],
    why: 'The NetBIOS datagram service is UDP 138. Datagrams are connectionless, which is what UDP is for.' },
  { id: 'nb-session', set: 'files', label: 'NetBIOS session service', port: '139', proto: TCP, from: ['legacy'], to: ['file', 'win'],
    plain: ['Allow NetBIOS session service traffic from {from} to {to}'],
    job: ['{from} can open a legacy Windows file sharing session with {to}'],
    why: 'A session needs a connection, so the NetBIOS session service is TCP 139. SMB on 445 replaced it.' },

  // ── Directory and sign-in ──
  { id: 'kerberos', set: 'directory', label: 'Kerberos', port: '88', proto: BOTH, from: ['corp', 'employee'], to: ['dc'],
    plain: ['Allow Kerberos authentication from {from} to {to}'],
    job: ['{from} can get sign-in tickets from {to}'],
    why: 'Kerberos is port 88 on both UDP and TCP, because larger tickets do not fit in UDP.' },
  { id: 'ldap', set: 'directory', label: 'LDAP', port: '389', proto: TCP, from: ['app', 'legacy'], to: ['dc'],
    plain: ['Allow LDAP queries from {from} to {to}'],
    job: ['{from} can look up users in the directory on {to} without encryption'],
    why: 'Plain LDAP is TCP 389, and it sends directory queries in cleartext.' },
  { id: 'ldaps', set: 'directory', label: 'LDAPS', port: '636', proto: TCP, from: ['app', 'web'], to: ['dc'],
    plain: ['Allow LDAPS queries from {from} to {to}', 'Allow secure LDAP from {from} to {to}'],
    job: ['{from} can look up users in the directory on {to} over an encrypted connection'],
    why: 'Encrypted directory lookups are LDAPS on TCP 636, a number that reads the same backwards.' },
  { id: 'radius', set: 'directory', label: 'RADIUS authentication', port: '1812', proto: UDP, from: ['ap'], to: ['auth'],
    plain: ['Allow RADIUS authentication from {from} to {to}'],
    job: ['{from} can check 802.1X logins against {to}'],
    why: 'RADIUS authentication is UDP 1812, the protocol behind 802.1X and enterprise Wi-Fi.' },
  { id: 'radius-acct', set: 'directory', label: 'RADIUS accounting', port: '1813', proto: UDP, from: ['ap'], to: ['auth'],
    plain: ['Allow RADIUS accounting from {from} to {to}'],
    job: ['{from} can send 802.1X session records to {to}'],
    why: 'RADIUS accounting is the next port up, UDP 1813: 1812 for logins, 1813 for records.' },
  { id: 'tacacs', set: 'directory', label: 'TACACS+', port: '49', proto: TCP, from: ['router', 'sw'], to: ['auth'],
    plain: ['Allow TACACS+ authentication from {from} to {to}'],
    job: ['{from} can check administrators\' logins against {to} with the protocol that encrypts the whole packet'],
    why: 'TACACS+ is TCP 49 and encrypts the entire packet, where RADIUS encrypts only the password.' },

  // ── Managing and logging ──
  { id: 'snmp', set: 'manage', label: 'SNMP polling', port: '161', proto: UDP, from: ['mon'], to: ['sw', 'router', 'linux'],
    plain: ['Allow SNMP polling from {from} to {to}'],
    job: ['{from} can read the counters on {to}'],
    why: 'SNMP polling goes to the device on UDP 161: 161 asks.' },
  { id: 'snmp-trap', set: 'manage', label: 'SNMP traps', port: '162', proto: UDP, from: ['sw', 'router', 'linux'], to: ['mon'],
    plain: ['Allow SNMP traps from {from} to {to}'],
    job: ['{from} can send alerts to {to} without being asked'],
    why: 'Traps come from the device to the manager on UDP 162: 162 tells.' },
  { id: 'syslog', set: 'manage', label: 'Syslog', port: '514', proto: UDP, from: ['sw', 'router'], to: ['siem'],
    plain: ['Allow traditional syslog from {from} to {to}'],
    job: ['{from} can send logs to {to} the traditional unencrypted way'],
    why: 'Traditional syslog is UDP 514, with no authentication and no encryption.' },
  { id: 'syslog-tls', set: 'manage', label: 'Syslog over TLS', port: '6514', proto: TCP, from: ['linux', 'win', 'web'], to: ['siem'],
    plain: ['Allow syslog over TLS from {from} to {to}'],
    job: ['{from} can send logs to {to} over an encrypted connection'],
    why: 'Syslog over TLS is TCP 6514: the old 514 with a 6 in front. TLS needs TCP.' },
  { id: 'ping', set: 'manage', label: 'ICMP', port: NO_PORT, proto: ICMP, from: ['mon', 'admin'], to: ['linux', 'win', 'sw'],
    plain: ['Allow ICMP echo requests from {from} to {to}'],
    job: ['{from} can ping {to} to check that it is up'],
    why: 'Ping is ICMP. It sits beside TCP and UDP and has no ports at all, so the Port is N/A.' },
  { id: 'ping-block', set: 'manage', label: 'ICMP', port: NO_PORT, proto: ICMP, action: 'Deny', from: ['guest', 'internet'], to: ['dc', 'db', 'web'],
    plain: ['Block all ICMP traffic from {from} to {to}'],
    job: [`{from} must not be able to ping {to}. ${BLOCK_LOG}`],
    why: 'Ping is ICMP, which has no port, and block means the Action is Deny.' },

  // ── VPNs ──
  { id: 'ike', set: 'vpn', label: 'IKE', port: '500', proto: UDP, from: ['internet', 'branch'], to: ['vpn'],
    plain: ['Allow IKE from {from} to {to}'],
    job: ['{from} can negotiate the keys for an IPsec tunnel with {to}'],
    why: 'IKE sets up an IPsec tunnel on UDP 500, and every IPsec peer has to do it first.' },
  { id: 'natt', set: 'vpn', label: 'IPsec NAT traversal', port: '4500', proto: UDP, from: ['branch'], to: ['vpn'],
    plain: ['Allow IPsec NAT traversal from {from} to {to}'],
    job: ['{from} sits behind NAT, so its IPsec traffic has to be wrapped to reach {to}'],
    why: 'NAT traversal wraps IPsec in UDP 4500: IKE\'s 500 with a 4 in front.' },
  { id: 'esp', set: 'vpn', label: 'ESP', port: NO_PORT, proto: ESP, from: ['branch'], to: ['vpn'],
    plain: ['Allow ESP traffic from {from} to {to}'],
    job: ['{from} has no NAT in the way, so its encrypted IPsec traffic reaches {to} unwrapped'],
    why: 'Encrypted IPsec traffic is ESP, IP protocol 50. It is its own protocol, so there is no port.' },
  { id: 'ah', set: 'vpn', label: 'AH', port: NO_PORT, proto: AH, from: ['branch'], to: ['vpn'],
    plain: ['Allow AH traffic from {from} to {to}'],
    job: ['{from} only needs its IPsec traffic to {to} authenticated, not encrypted'],
    why: 'AH, IP protocol 51, proves who sent the data and that it was not changed, but does not hide it.' },
  { id: 'l2tp', set: 'vpn', label: 'L2TP', port: '1701', proto: UDP, from: ['internet', 'branch'], to: ['vpn'],
    plain: ['Allow L2TP connections from {from} to {to}'],
    job: ['{from} can start a layer 2 tunnel with {to}'],
    why: 'L2TP is UDP 1701. It has no encryption of its own, which is why it is paired with IPsec.' },
  { id: 'pptp-block', set: 'vpn', label: 'PPTP', port: '1723', proto: TCP, action: 'Deny', from: ['internet'], to: ['vpn'],
    plain: ['Block all PPTP control connections from {from} to {to}'],
    job: [`{from} must not be able to reach the control channel of the old broken VPN on {to}. ${BLOCK_LOG}`],
    why: 'PPTP control is TCP 1723. It depends on the broken MS-CHAPv2, and block means the Action is Deny.' },
  { id: 'pptp', set: 'vpn', label: 'PPTP', port: '1723', proto: TCP, from: ['branch'], to: ['vpn'],
    plain: ['Allow PPTP control connections from {from} to {to}'],
    job: ['{from} still uses the old broken VPN, and needs its control channel to {to} until it is replaced'],
    why: 'PPTP control is TCP 1723. It should be replaced as soon as possible.' },
  { id: 'ovpn-udp', set: 'vpn', label: 'OpenVPN', port: '1194', proto: UDP, from: ['internet'], to: ['vpn'],
    plain: ['Allow OpenVPN over UDP from {from} to {to}'],
    job: ['{from} can connect to {to} with OpenVPN on its preferred transport'],
    why: 'OpenVPN is port 1194, and UDP is preferred because it performs better.' },
  { id: 'ovpn-tcp', set: 'vpn', label: 'OpenVPN', port: '1194', proto: TCP, from: ['partner', 'branch'], to: ['vpn'],
    plain: ['Allow OpenVPN over TCP from {from} to {to}'],
    job: ['{from} is on a network that blocks OpenVPN\'s preferred transport, and has to reach {to} with the fallback'],
    why: 'OpenVPN can also run on TCP 1194, which gets through more restrictive networks at some cost in speed.' },
  { id: 'wireguard', set: 'vpn', label: 'WireGuard', port: '51820', proto: UDP, from: ['internet', 'partner'], to: ['vpn'],
    plain: ['Allow WireGuard from {from} to {to}'],
    job: ['{from} can connect to {to} with the lean modern VPN that has a small attack surface'],
    why: 'WireGuard is UDP 51820, a modern VPN with a small attack surface.' },

  // ── Databases and the rest ──
  { id: 'mssql', set: 'other', label: 'Microsoft SQL Server', port: '1433', proto: TCP, from: ['app', 'web'], to: ['db'],
    plain: ['Allow Microsoft SQL Server connections from {from} to {to}'],
    job: ['{from} can query its Microsoft SQL Server database on {to}'],
    why: 'Microsoft SQL Server is TCP 1433.' },
  { id: 'oracle', set: 'other', label: 'Oracle Database', port: '1521', proto: TCP, from: ['app'], to: ['db'],
    plain: ['Allow Oracle database connections from {from} to {to}'],
    job: ['{from} can query its Oracle database on {to}'],
    why: 'Oracle Database listens on TCP 1521.' },
  { id: 'mysql', set: 'other', label: 'MySQL', port: '3306', proto: TCP, from: ['app', 'web'], to: ['db'],
    plain: ['Allow MySQL connections from {from} to {to}'],
    job: ['{from} can query its MariaDB database on {to}'],
    why: 'MySQL and MariaDB share TCP 3306.' },
  { id: 'rpc', set: 'other', label: 'Windows RPC', port: '135', proto: TCP, from: ['admin', 'jump'], to: ['win'],
    plain: ['Allow Windows RPC endpoint mapper connections from {from} to {to}'],
    job: ['{from} can start remote management of {to} through the Windows service that tells callers where to connect'],
    why: 'The Windows RPC endpoint mapper is TCP 135, and it is a frequent attack surface.' },
  { id: 'rpc-block', set: 'other', label: 'Windows RPC', port: '135', proto: TCP, action: 'Deny', from: ['guest', 'employee'], to: ['win', 'dc'],
    plain: ['Block all Windows RPC endpoint mapper connections from {from} to {to}'],
    job: [`{from} must not be able to reach the Windows service on {to} that tells callers where to connect. ${BLOCK_LOG}`],
    why: 'The Windows RPC endpoint mapper is TCP 135, and block means the Action is Deny.' },
  { id: 'bgp', set: 'other', label: 'BGP', port: '179', proto: TCP, from: ['router'], to: ['isp'],
    plain: ['Allow BGP sessions from {from} to {to}'],
    job: ['{from} can exchange internet routes with {to}'],
    why: 'BGP exchanges routes between networks over TCP 179.' },
  { id: 'nntp', set: 'other', label: 'NNTP', port: '119', proto: TCP, from: ['corp', 'employee'], to: ['news'],
    plain: ['Allow NNTP from {from} to {to}'],
    job: ['{from} can read newsgroup articles on {to}'],
    why: 'Newsgroups are NNTP on TCP 119.' },
  { id: 'sip', set: 'other', label: 'SIP', port: '5060', proto: BOTH, from: ['phones'], to: ['pbx'],
    plain: ['Allow unencrypted SIP signaling over both of its transports from {from} to {to}'],
    job: ['{from} can register with {to} using call signaling that is not encrypted, on either of its transports'],
    why: 'Plain SIP signaling is 5060 and can run on UDP or TCP, so the rule covers both.' },
  { id: 'sips', set: 'other', label: 'SIP over TLS', port: '5061', proto: TCP, from: ['phones'], to: ['pbx'],
    plain: ['Allow SIP over TLS from {from} to {to}'],
    job: ['{from} can set up encrypted calls through {to}'],
    why: 'SIP over TLS is TCP 5061, one above plain SIP. TLS needs TCP.' },
  { id: 'mqtt', set: 'other', label: 'MQTT', port: '1883', proto: TCP, from: ['sensors'], to: ['broker'],
    plain: ['Allow unencrypted MQTT from {from} to {to}'],
    job: ['{from} can publish readings to {to} without encryption'],
    why: 'Plain MQTT, the lightweight IoT messaging protocol, is TCP 1883.' },
  { id: 'mqtts', set: 'other', label: 'MQTT over TLS', port: '8883', proto: TCP, from: ['sensors'], to: ['broker'],
    plain: ['Allow MQTT over TLS from {from} to {to}'],
    job: ['{from} can publish readings to {to} over an encrypted connection'],
    why: 'MQTT over TLS is TCP 8883. Both MQTT ports end in 883.' },
];

const flowById = new Map(FLOWS.map(f => [f.id, f]));

/**
 * Rules that ask for the same thing share one memory: allowing Telnet and blocking Telnet both come down to "Telnet is
 * TCP 23". That shared thing is a fact, named after the first rule that asks for it (an allow rule if there is one).
 * Fact names are saved with the learner's progress, so they must never change (the spec keeps the list).
 */
const factKey = (f: Flow) => `${f.label}|${f.proto}|${f.port}`;
const firstAsking = new Map<string, string>();
for (const f of [...FLOWS.filter(x => !x.action), ...FLOWS]) if (!firstAsking.has(factKey(f))) firstAsking.set(factKey(f), f.id);

/** The fact a rule asks for. */
export const factOf = (flowId: string): string => {
  const f = flowById.get(flowId);
  return f ? firstAsking.get(factKey(f))! : flowId;
};
/** Every fact, in the order new ones are introduced: the most-tested sets first. */
export const FACTS: string[] = [...new Set(FLOWS.map(f => factOf(f.id)))];
const rulesAsking = new Map(FACTS.map(fact => [fact, FLOWS.filter(f => factOf(f.id) === fact)]));
/** The trainer set a fact belongs to. */
export const setOfFact = (fact: string) => flowById.get(fact)?.set;
/** How feedback names a fact ("SSH", "DNS zone transfers"). */
export const factLabel = (fact: string) => flowById.get(fact)?.label ?? fact;
/** The port a fact is about, or NO_PORT. */
export const factPort = (fact: string) => flowById.get(fact)?.port ?? NO_PORT;

/** What is remembered about each rule, by fact: a spaced repetition card. A fact with none is new. */
export type RuleMemory = Record<string, SrsCard>;

const ORGS = ['A credit union', 'A regional hospital', 'A school district', 'A law firm', 'A shipping company', 'A retail chain', 'A manufacturer', 'A city government', 'A software startup', 'An insurance agency'];
const FIREWALLS = ['FW-EDGE', 'FW-CORE', 'FW-MAIN', 'FW-HQ', 'FW-PERIMETER'];

/** What a generated table is rebuilt from. `vague` says, rule by rule, whether it only describes the job. */
export interface GeneratedRef { set: string; seed: number; flows: string[]; vague?: boolean[] }

const SET_SIZE = 6;
const MIXED_SIZE = 7;
/** A mixed table takes at most this many rules from one set. */
const MIXED_PER_SET = 3;

/** Two rules that would clash or repeat: the same service twice, or an allow and a block on one port (first match would win). */
function clashes(a: Flow, b: Flow): boolean {
  if (a.port === NO_PORT || b.port === NO_PORT) return a.proto === b.proto;
  if (a.port !== b.port) return false;
  return a.proto === b.proto || a.action !== b.action;
}

/** Rules that get mixed up with each other: one job plain and encrypted, or neighbors that split a job between them. */
export const LOOKALIKES: string[][] = [
  ['ssh', 'telnet'], ['sftp', 'ftps'], ['rdp', 'vnc'],
  ['http', 'https-in'], ['alt-http', 'alt-https'],
  ['dns', 'dns-zone', 'dot'], ['dhcp', 'dhcp-reply'],
  ['smtp-in', 'submission', 'smtps'], ['pop3', 'imap'], ['pop3s', 'imaps'], ['pop3', 'pop3s'], ['imap', 'imaps'],
  ['ftp', 'ftp-data'], ['ftps', 'ftps-data'], ['tftp', 'ftp'], ['nb-name', 'nb-dgram', 'nb-session'], ['smb', 'nb-session'],
  ['ldap', 'ldaps'], ['radius', 'radius-acct'], ['radius', 'tacacs'], ['kerberos', 'ldap'],
  ['snmp', 'snmp-trap'], ['syslog', 'syslog-tls'],
  ['ike', 'natt'], ['esp', 'ah'], ['l2tp', 'pptp'], ['ovpn-udp', 'wireguard'],
  ['mssql', 'oracle', 'mysql'], ['sip', 'sips'], ['mqtt', 'mqtts'],
];
/** The facts a fact gets mixed up with. */
const lookalikesOf = (fact: string) => [...new Set(LOOKALIKES.map(g => g.map(factOf)).filter(g => g.includes(fact)).flat())].filter(x => x !== fact);

export interface TableContext {
  /** A trainer port's level, from 0 to MAX_LEVEL. It only decides how often a rule is worded vaguely. */
  level: (trainerPort: string) => number;
  /** Each rule's memory. Without it every rule is new. */
  memory?: RuleMemory;
  now?: number;
  /** New rules that may still be introduced today (the daily limit Review mode uses). */
  newLeft?: number;
}

/** A table introduces at most this many new rules while it has anything else to ask. */
export const NEW_PER_TABLE = 3;
/** A table takes a few minutes to fill in, so a rule that falls due within this time is due by the time it is answered. */
const FILLING_IN = 2 * 60 * 1000;
/** A rule in its learning steps may be asked this long before it is due, as in Review mode. */
const LEARN_AHEAD = 20 * 60 * 1000;
/** A rule in its learning steps brings at most this many look-alikes that are not due yet. */
const LOOKALIKES_PULLED = 2;
/** Rules that are not due are ranked by recall chance, give or take this much, so two such tables differ. */
const LUCK = 0.03;
/** How often a rule only describes the job, by its port's level. Rules with no port use the middle. */
const VAGUE_AT = [0.4, 0.5, 0.6, 0.7, 0.8];

const levelOf = (f: Flow, ctx: TableContext): number | undefined => {
  const entry = trainerEntry(f.port);
  return entry ? Math.min(MAX_LEVEL, Math.max(0, ctx.level(entry))) : undefined;
};

/**
 * Chooses a new table's rules the way a review session chooses cards:
 * 1. rules in their learning steps that are due (a rule just missed is, a minute later), the longest-waiting first;
 * 2. learned rules that are due, the ones most likely forgotten first;
 * 3. look-alikes of any rule chosen so far that is still in its learning steps, if they have been met before, so the
 *    table makes you tell them apart;
 * 4. new rules in their fixed order, at most NEW_PER_TABLE and within today's limit;
 * 5. rules in their learning steps that are nearly due, then learned rules by how close they are to forgotten.
 * Only when all of that leaves the table short does it take more new rules than the limits allow.
 *
 * A set's table asks that set's rules first and fills up from the others. A mixed table spreads over the sets (at
 * most MIXED_PER_SET from one), though never by leaving a due rule out.
 */
export function newTable(set: string, ctx: TableContext, seed: number): GeneratedRef {
  const rand = seededRandom(seed);
  const now = ctx.now ?? Date.now();
  const memory = ctx.memory ?? {};
  const mixed = set === MIXED;
  const size = mixed ? MIXED_SIZE : SET_SIZE;
  const luck = new Map(FACTS.map(fact => [fact, rand() * LUCK]));
  const recall = (fact: string) => recallNow(memory[fact], now) ?? 0;

  const isNew = (fact: string) => !memory[fact];
  const inSteps = (fact: string) => !!memory[fact] && memory[fact].state !== 'review';
  const isDue = (fact: string) => !!memory[fact] && memory[fact].due <= now + FILLING_IN;
  const byDue = (a: string, b: string) => memory[a].due - memory[b].due;
  const byRecall = (a: string, b: string) => recall(a) - recall(b) || byDue(a, b);
  const byRecallRoughly = (a: string, b: string) => recall(a) + luck.get(a)! - (recall(b) + luck.get(b)!);

  const chosen: Flow[] = [];
  const asked = new Set<string>();
  /** Adds rules for these facts, in order, while the table has room. `spread` keeps a mixed table from leaning on one set. */
  const take = (facts: string[], opts: { limit?: number; spread?: boolean } = {}) => {
    let added = 0;
    for (const fact of facts) {
      if (chosen.length >= size || added >= (opts.limit ?? size)) break;
      if (asked.has(fact)) continue;
      const open = rulesAsking.get(fact)!.filter(f => !chosen.some(c => clashes(c, f)));
      if (!open.length) continue;
      if (opts.spread && chosen.filter(c => c.set === open[0].set).length >= MIXED_PER_SET) continue;
      chosen.push(open[Math.floor(rand() * open.length)]);
      asked.add(fact);
      added++;
    }
  };

  const due = (facts: string[]) => {
    const waiting = facts.filter(isDue);
    return [...waiting.filter(inSteps).sort(byDue), ...waiting.filter(f => !inSteps(f)).sort(byRecall)];
  };
  const nearlyDue = (facts: string[]) => facts.filter(f => inSteps(f) && !isDue(f) && memory[f].due <= now + LEARN_AHEAD).sort(byDue);
  const notDue = (facts: string[]) => facts.filter(f => !isNew(f) && !isDue(f)).sort(byRecallRoughly);

  const own = FACTS.filter(fact => mixed || setOfFact(fact) === set);
  const spread = mixed;

  take(due(own), { spread });
  if (spread) take(due(own));

  // A rule still being learned (or relearned) brings along the look-alikes already met, never ones that would be new.
  const alike = [...new Set([...asked].filter(inSteps).flatMap(lookalikesOf))].filter(fact => own.includes(fact) && !isNew(fact));
  take(alike.sort(byRecall), { limit: LOOKALIKES_PULLED });

  const fresh = own.filter(isNew);
  take(fresh, { limit: Math.max(0, Math.min(NEW_PER_TABLE, ctx.newLeft ?? NEW_PER_TABLE)), spread });

  for (const facts of [nearlyDue(own), notDue(own)]) take(facts, { spread });
  if (spread) for (const facts of [nearlyDue(own), notDue(own)]) take(facts);
  // Nothing else of its own to ask: go past the limits on new rules rather than leave the table short.
  take(fresh, { spread });
  if (spread) take(fresh);

  if (!mixed) {
    const others = FACTS.filter(fact => !own.includes(fact));
    for (const facts of [due(others), nearlyDue(others), notDue(others), others.filter(isNew)]) take(facts);
  }

  const flows = shuffled(chosen, rand);
  return { set, seed, flows: flows.map(f => f.id), vague: flows.map(f => rand() < VAGUE_AT[levelOf(f, ctx) ?? MAX_LEVEL / 2]) };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Builds the table a ref describes. The same ref always gives the same table. */
export function buildTable(ref: GeneratedRef): PortScenario {
  const rand = seededRandom(ref.seed ^ 0x5bd1e995);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const picked = ref.flows.map((id, i) => ({ f: flowById.get(id), vague: ref.vague?.[i] })).filter((x): x is { f: Flow; vague: boolean | undefined } => !!x.f);
  const flows = picked.map(x => x.f);

  // Where each host sits in this table, and which hosts are in it.
  const zoneOf = new Map<string, ZoneKey>();
  const place = (key: string) => {
    if (HOSTS[key] && !zoneOf.has(key)) zoneOf.set(key, pick(HOSTS[key].zones));
    return key;
  };
  const outsideUsed = new Set<string>();
  let internet = false;
  const usedZones = new Set<ZoneKey>();

  const resolved = flows.map(f => {
    const from = place(pick(f.from));
    let to = place(pick(f.to));
    if (to === from) to = place(f.to.find(t => t !== from) ?? to);
    for (const p of [from, to]) {
      if (OUTSIDE[p]) outsideUsed.add(p);
      if (p === 'internet') internet = true;
      if (p === 'corp' || p === 'guest') usedZones.add(p);
    }
    return { f, from, to };
  });

  // A subnet named in a rule still needs something drawn in it.
  if (usedZones.has('corp') && ![...zoneOf.values()].includes('corp')) place('employee');
  if (usedZones.has('guest') && ![...zoneOf.values()].includes('guest')) place('guests');
  if (zoneOf.size < 12) {
    for (const d of shuffled(DECOYS.filter(k => !zoneOf.has(k)), rand).slice(0, 1 + Math.floor(rand() * 2))) zoneOf.set(d, HOSTS[d].zones[0]);
  }

  // Addresses.
  const a = 11 + Math.floor(rand() * 200), dmz = 1 + Math.floor(rand() * 200), guest = 2 + Math.floor(rand() * 200);
  const thirds = shuffled([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], rand);
  const subnets: Record<ZoneKey, string> = {
    corp: `10.${a}.${thirds[0]}.0/24`, servers: `10.${a}.${thirds[1]}.0/24`, mgmt: `10.${a}.${thirds[2]}.0/24`,
    devices: `10.${a}.${thirds[3]}.0/24`, voice: `10.${a}.${thirds[4]}.0/24`, iot: `10.${a}.${thirds[5]}.0/24`,
    dmz: `172.16.${dmz}.0/24`, guest: `192.168.${guest}.0/24`,
  };

  const zones: NetZone[] = [];
  for (const key of ZONE_ORDER) {
    const members = [...zoneOf].filter(([, z]) => z === key).map(([k]) => HOSTS[k]);
    if (!members.length) continue;
    const prefix = subnets[key].replace(/\.0\/24$/, '');
    let last = 4 + Math.floor(rand() * 30);
    const hosts: NetHost[] = members.map(h => {
      last += 1 + Math.floor(rand() * 15);
      return { name: h.name, ip: h.many ? subnets[key] : `${prefix}.${last}`, ...(h.icon ? { icon: h.icon } : {}) };
    });
    zones.push({ name: ZONE_NAMES[key], subnet: subnets[key], hosts });
  }

  const outsideOctets = shuffled([9, 14, 27, 33, 41, 58, 62, 75, 86, 97], rand);
  const outside: NetHost[] = [...outsideUsed].map((k, i) => ({ name: OUTSIDE[k], ip: `${i % 2 ? '203.0.113' : '198.51.100'}.${outsideOctets[i]}` }));

  /** The value a rule's Source or Destination resolves through, and how the requirement says it. */
  const nameOf = (k: string) => k === 'internet' || k === 'anydev' ? 'Any' : k === 'corp' || k === 'guest' ? ZONE_NAMES[k] : HOSTS[k]?.name ?? OUTSIDE[k];
  const say = (k: string, isDestination: boolean) => {
    if (k === 'internet') return 'the Internet';
    if (k === 'anydev') return 'any device';
    if (k === 'corp' || k === 'guest') return `the ${ZONE_NAMES[k]}`;
    if (OUTSIDE[k]) return `the ${OUTSIDE[k]}`;
    const showZone = isDestination && !HOSTS[k].many && rand() < (zoneOf.get(k) === 'dmz' ? 0.7 : 0.4);
    return `the ${HOSTS[k].name}${showZone ? ` in the ${ZONE_NAMES[zoneOf.get(k)!]}` : ''}`;
  };

  const rules: Rule[] = resolved.map(({ f, from, to }, i) => {
    // A table saved before the wording was chosen with the rules still tosses a coin here.
    const template = pick((picked[i].vague ?? rand() >= 0.5) ? f.job : f.plain);
    const fromText = say(from, false), toText = say(to, true);
    const need = capitalize(template.replace(/\{from\}/g, fromText).replace(/\{to\}/g, toText)) + '.';
    return { need, from: nameOf(from), to: nameOf(to), proto: f.proto, port: f.port, action: f.action, why: f.why };
  });

  const noted = flows.map(f => f.port !== NO_PORT ? `${f.label} is ${f.proto} ${f.port}`
    : f.proto === ICMP ? 'ICMP has no port' : `${f.label} is ${f.proto.replace(/^.*\((.*)\)$/, '$1')}`);
  const setTitle = GROUPS.find(g => g.id === ref.set)?.title ?? 'Every set';

  const draft: Draft = {
    id: `gen-${ref.set}`, set: ref.set, seed: ref.seed, title: `Random table: ${setTitle}`,
    story: `${pick(ORGS)} is rewriting its firewall rules. Use Any for the Internet or for devices that are not listed.`,
    firewall: pick(FIREWALLS), zones, outside, internet, rules,
    takeaway: `In this table: ${[...new Set(noted)].join(', ')}.`,
  };
  return build(draft);
}
