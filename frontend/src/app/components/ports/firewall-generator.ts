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
 * About one table in three is a host-based firewall: the rules are written on one server, so each is inbound to it
 * or outbound from it, and the other end is the remote address.
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
  /** Servers use this service as well as PCs, so a host-based table may ask for it outbound from its server. */
  serverToo?: boolean;
  plain: string[];
  job: string[];
  why: string;
}

const BLOCK_LOG = 'Log each attempt';

export const FLOWS: Flow[] = [
  // ── Remote access ──
  { id: 'ssh', set: 'remote', label: 'SSH', port: '22', proto: TCP, from: ['admin', 'jump'], to: ['linux', 'sw'],
    plain: ['Allow SSH from {from} to {to}', 'Allow secure shell connections from {from} to {to}'],
    job: ['{from} can manage {to} over an encrypted command line', '{from} needs an encrypted remote terminal on {to}', '{from} must be able to run commands on {to} remotely, with everything encrypted including the login'],
    why: 'SSH is TCP 22. It replaced Telnet, its neighbor on port 23, which sends everything in cleartext.' },
  { id: 'sftp', set: 'remote', label: 'SFTP', port: '22', proto: TCP, from: ['partner', 'admin'], to: ['ftp'],
    plain: ['Allow SFTP file transfers from {from} to {to}', '{from} must be able to move files to {to} with SFTP'],
    job: ['{from} can upload files to {to} with the transfer that runs inside an encrypted shell', '{from} can exchange files with {to} over the same encrypted channel administrators use for a remote command line', '{from} needs encrypted file transfers to {to} that ride on the secure shell service, not on TLS'],
    why: 'SFTP runs inside SSH, so it shares TCP 22. FTPS is a different thing: FTP wrapped in TLS on its own ports.' },
  { id: 'telnet', set: 'remote', label: 'Telnet', port: '23', proto: TCP, from: ['admin'], to: ['sw', 'router'],
    plain: ['Allow Telnet from {from} to {to}', 'Permit Telnet sessions from {from} to {to}'],
    job: ['{to} only supports the old unencrypted remote terminal, and {from} still has to manage it', '{from} has to reach the cleartext command line on {to}, the only remote access it offers', '{from} can log in to {to} remotely with the legacy terminal protocol that encrypts nothing, not even the password'],
    why: 'Telnet is TCP 23. Everything including the password crosses the network in cleartext.' },
  { id: 'telnet-block', set: 'remote', label: 'Telnet', port: '23', proto: TCP, action: 'Deny', from: ['corp', 'guest', 'employee'], to: ['sw', 'router'],
    plain: ['Block all Telnet connections from {from} to {to}', 'Deny Telnet from {from} to {to}'],
    job: [`{from} must not be able to open an unencrypted remote terminal on {to}. ${BLOCK_LOG}`, 'Stop {from} from reaching the cleartext remote command line on {to}, and record every attempt in the log', `Nothing coming from {from} may log in to {to} with the legacy terminal protocol that sends passwords in the clear. ${BLOCK_LOG}`],
    why: 'Telnet is TCP 23. Block means the Action is Deny, and a written deny is what puts each attempt in the log.' },
  { id: 'rdp', set: 'remote', label: 'RDP', port: '3389', proto: TCP, from: ['admin', 'jump'], to: ['win'],
    plain: ['Allow RDP connections from {from} to {to}', 'Allow Remote Desktop from {from} to {to}'],
    job: ['{from} can open the full graphical desktop of {to}', '{from} needs to see and control the Windows desktop of {to} with the remote access protocol built into Windows', '{from} can work on {to} as if sitting in front of it, using the remote screen protocol that ships with Windows'],
    why: 'A whole Windows desktop over the network is RDP on TCP 3389.' },
  { id: 'rdp-block', set: 'remote', label: 'RDP', port: '3389', proto: TCP, action: 'Deny', from: ['employee', 'guest', 'corp'], to: ['win', 'dc'],
    plain: ['Block Remote Desktop traffic from {from} to {to}', 'Deny RDP from {from} to {to}'],
    job: [`{from} must not be able to open a graphical desktop on {to}. ${BLOCK_LOG}`, '{from} must be kept away from the Windows remote screen service on {to}, with each attempt logged', `Stop {from} from taking remote control of the Windows desktop on {to}. ${BLOCK_LOG}`],
    why: 'RDP is TCP 3389, and block means the Action is Deny.' },
  { id: 'vnc', set: 'remote', label: 'VNC', port: '5900', proto: TCP, from: ['admin'], to: ['kiosk'],
    plain: ['Allow VNC connections from {from} to {to}', '{from} must be able to reach {to} over VNC'],
    job: ['{from} can take over the screen of {to} with the screen-sharing tool that is not tied to Windows', '{from} can view and control the screen of {to} with the cross-platform remote screen protocol that is often left unencrypted', '{from} needs remote control of the display on {to}, which runs the open screen-sharing service instead of the Windows one'],
    why: 'VNC screen sharing uses TCP 5900 and is often unencrypted.' },

  // ── The web ──
  { id: 'https-in', set: 'web', label: 'HTTPS', port: '443', proto: TCP, from: ['internet'], to: ['web'],
    plain: ['Allow HTTPS from {from} to {to}', 'Allow secure web traffic from {from} to {to}'],
    job: ['{from} can open the site on {to} over an encrypted connection', 'Visitors from {from} can reach the website on {to} with the padlock showing in their browser', '{from} can load pages from {to} with TLS protecting every request'],
    why: 'Encrypted web traffic is HTTPS on TCP 443. Think of 80 as the open web and 443 as the locked web.' },
  { id: 'https-out', set: 'web', label: 'HTTPS', port: '443', proto: TCP, from: ['corp', 'proxy'], to: ['internet'],
    plain: ['Allow HTTPS browsing from {from} to {to}', 'Permit outbound HTTPS from {from} to {to}'],
    job: ['{from} can browse encrypted websites on {to}', '{from} can open TLS-protected websites on {to}', '{from} needs outbound access to websites on {to} that encrypt the connection'],
    why: 'Encrypted browsing is HTTPS on TCP 443, and the Internet as a destination is Any.' },
  { id: 'https-app', set: 'web', label: 'HTTPS', port: '443', proto: TCP, from: ['corp', 'employee'], to: ['app', 'console'],
    plain: ['Allow HTTPS from {from} to {to}', '{from} must be able to reach {to} over HTTPS'],
    job: ['{from} can open the web interface on {to} over an encrypted connection', '{from} can use the browser-based app on {to}, which accepts only TLS-protected requests on the standard port', '{from} can sign in to the web page served by {to}, with the session encrypted on the usual secure web port'],
    why: 'An encrypted web interface is HTTPS on TCP 443 unless the question says it uses another port.' },
  { id: 'http', set: 'web', label: 'HTTP', port: '80', proto: TCP, from: ['internet'], to: ['web'],
    plain: ['Allow HTTP from {from} to {to}', 'Allow unencrypted web traffic from {from} to {to}'],
    job: ['{from} can still reach {to} without encryption, so visitors can be redirected to the secure site', '{from} can request pages from {to} in cleartext on the standard web port', 'Visitors from {from} who type the address of {to} without the secure prefix must still get a page back'],
    why: 'Plain HTTP is TCP 80. Sites often keep it open only to send visitors straight to HTTPS.' },
  { id: 'http-block', set: 'web', label: 'HTTP', port: '80', proto: TCP, action: 'Deny', from: ['corp', 'guest'], to: ['app', 'console'],
    plain: ['Block all HTTP connections from {from} to {to}', 'Deny unencrypted HTTP from {from} to {to}'],
    job: [`{from} must not be able to reach the site on {to} without encryption. ${BLOCK_LOG}`, 'Stop {from} from loading the web interface on {to} in cleartext, and log every attempt', `Cleartext web requests from {from} to {to} must be refused. ${BLOCK_LOG}`],
    why: 'Unencrypted web traffic is HTTP on TCP 80, and block means the Action is Deny.' },
  { id: 'alt-http', set: 'web', label: 'Alternate HTTP', port: '8080', proto: TCP, from: ['corp', 'employee'], to: ['proxy'],
    plain: ['Allow traffic on the alternate HTTP port from {from} to {to}', 'Allow web proxy traffic on the alternate HTTP port from {from} to {to}'],
    job: ['{from} sends its web requests to {to}, which listens on the alternate port for unencrypted web traffic', '{from} browses through {to}, which accepts unencrypted web traffic on its common alternate port instead of the standard one', '{from} needs the cleartext web service on {to} that was moved off the standard port to the usual alternate'],
    why: 'The alternate HTTP port is TCP 8080, a common home for web proxies. It is still unencrypted.' },
  { id: 'alt-https', set: 'web', label: 'Alternate HTTPS', port: '8443', proto: TCP, from: ['admin', 'jump'], to: ['console'],
    plain: ['Allow traffic on the alternate HTTPS port from {from} to {to}', '{from} must be able to reach {to} on the alternate HTTPS port'],
    job: ['{from} can open {to}, which serves its encrypted interface on the alternate port', '{from} can sign in to {to}, whose TLS-protected admin page was moved off the standard secure web port to the usual alternate', '{from} needs the encrypted web interface on {to} that listens on the common alternate to the standard secure web port'],
    why: 'The alternate HTTPS port is TCP 8443. The alternates add 8000 and keep the ending.' },

  // ── Names, addresses and time ──
  { id: 'dns', set: 'names', label: 'DNS lookups', port: '53', proto: UDP, from: ['corp', 'employee'], to: ['dns'], serverToo: true,
    plain: ['Allow standard DNS lookups from {from} to {to}', 'Permit ordinary DNS queries from {from} to {to}'],
    job: ['{from} can look up names on {to} with ordinary small queries', '{from} can ask {to} to turn hostnames into IP addresses, one quick question at a time', '{from} needs everyday name resolution from {to}, the kind that fits in a single small packet'],
    why: 'Ordinary DNS lookups are small and use UDP 53, because a quick question needs no connection setup.' },
  { id: 'dns-zone', set: 'names', label: 'DNS zone transfers', port: '53', proto: TCP, from: ['dns2'], to: ['dns'],
    plain: ['Allow DNS zone transfers from {from} to {to}', '{from} must be able to pull DNS zone transfers from {to}'],
    job: ['{from} can copy the full set of name records from {to}', '{from} can replicate the whole zone from {to}, a large transfer that needs a reliable connection', '{from} keeps its name records in step with {to} by requesting complete copies of the zone'],
    why: 'A zone transfer is large and must arrive complete, so DNS switches to TCP 53. Same port, different transport.' },
  { id: 'dot', set: 'names', label: 'DNS over TLS', port: '853', proto: TCP, from: ['dns'], to: ['resolver'],
    plain: ['Allow DNS over TLS from {from} to {to}', 'Permit DNS over TLS queries from {from} to {to}'],
    job: ['{from} can forward its name lookups to {to} inside an encrypted TLS connection', '{from} can send its lookups to {to} so that nobody on the path can read or change them, using the dedicated port for name queries inside TLS', '{from} needs encrypted name resolution from {to} over TLS on its own port, not hidden inside web traffic'],
    why: 'DNS over TLS is TCP 853: DNS 53 with an 8 in front. TLS needs a connection, so it is TCP.' },
  { id: 'dhcp', set: 'names', label: 'DHCP to the server', port: '67', proto: UDP, from: ['anydev'], to: ['dhcp'],
    plain: ['Allow DHCP requests from {from} to {to}', '{to} must accept DHCP requests from {from}'],
    job: ['Devices with no address yet can ask {to} for one', 'A laptop that has just been plugged in can ask {to} for its network settings', 'New devices broadcast for an address, and their requests must reach {to}'],
    why: 'DHCP servers listen on UDP 67. The source has to be Any, because a device asking for an address does not have one.' },
  { id: 'dhcp-reply', set: 'names', label: 'DHCP to the client', port: '68', proto: UDP, from: ['dhcp'], to: ['anydev'],
    plain: ['Allow DHCP replies from {from} to {to}', 'Permit DHCP offers and replies from {from} to {to}'],
    job: ['{from} can hand new addresses back to devices that do not have one yet', '{from} can answer devices that asked for an address, on the port those clients listen on', 'Offers of network settings from {from} must be able to reach the devices that requested them'],
    why: 'DHCP clients listen on UDP 68. The server gets the lower number, 67, and the client the higher, 68.' },
  { id: 'ntp', set: 'names', label: 'NTP', port: '123', proto: UDP, from: ['corp', 'dc'], to: ['time'],
    plain: ['Allow NTP from {from} to {to}', '{from} must be able to reach {to} over NTP'],
    job: ['{from} can set its clocks from {to}', '{from} can keep its time in sync with {to}, so that sign-in tickets and log timestamps stay valid', '{from} needs time synchronization from {to}'],
    why: 'NTP is UDP 123, easy to remember as one, two, three.' },
  { id: 'ntp-out', set: 'names', label: 'NTP', port: '123', proto: UDP, from: ['time', 'dc'], to: ['ptime'],
    plain: ['Allow NTP from {from} to {to}', 'Permit outbound NTP from {from} to {to}'],
    job: ['{from} can set its own clock from {to}', '{from} can check its time against {to}, the outside source the whole company\'s clocks follow', '{from} needs to synchronize with {to} so it can serve accurate time to everything inside'],
    why: 'Here the inside host is the NTP client, still going to UDP 123.' },

  // ── Email ──
  { id: 'smtp-in', set: 'mail', label: 'SMTP', port: '25', proto: TCP, from: ['internet'], to: ['mailgw'],
    plain: ['Allow SMTP mail delivery from {from} to {to}', '{to} must accept SMTP from {from}'],
    job: ['Mail servers on {from} can deliver messages to {to}', 'Other organizations\' mail servers on {from} can hand incoming email to {to}', 'Email sent to the company from {from} arrives at {to}, server to server'],
    why: 'Server-to-server mail delivery is SMTP on TCP 25.' },
  { id: 'smtp-relay', set: 'mail', label: 'SMTP', port: '25', proto: TCP, from: ['mailgw'], to: ['mail'],
    plain: ['Allow SMTP relay from {from} to {to}', 'Permit SMTP from {from} to {to}'],
    job: ['{from} can hand clean mail on to {to}', '{from} can pass scanned messages to {to}, one mail server relaying to another', '{from} forwards incoming email to {to} with the standard server-to-server mail transfer protocol'],
    why: 'One mail server passing mail to another is SMTP on TCP 25.' },
  { id: 'submission', set: 'mail', label: 'Mail submission', port: '587', proto: TCP, from: ['corp', 'employee'], to: ['mail'],
    plain: ['Allow SMTP mail submission with STARTTLS from {from} to {to}', 'Permit mail submission from {from} to {to} on the port mail apps use with STARTTLS'],
    job: ['Mail apps on {from} can send outgoing mail through {to} with a connection that starts plain and upgrades', 'Email programs on {from} can hand outgoing messages to {to} for sending, signing in first and switching to encryption partway through', 'Users on {from} can send email through {to} on the port meant for mail clients, where the connection upgrades to TLS after it opens'],
    why: 'A mail app submitting mail uses TCP 587 with STARTTLS. 25 is servers talking to each other, 587 is you sending.' },
  { id: 'smtps', set: 'mail', label: 'SMTP over implicit TLS', port: '465', proto: TCP, from: ['app'], to: ['mail'],
    plain: ['Allow SMTP over implicit TLS from {from} to {to}', '{from} must be able to reach {to} with SMTPS, mail sending over implicit TLS'],
    job: ['{from} can send mail through {to} over a connection that is encrypted from the very first byte', '{from} can submit outgoing mail to {to} with TLS already in place before the first mail command is sent', '{from} sends its email through {to} on the port where encryption is not negotiated but simply assumed'],
    why: 'Implicit TLS for SMTP is TCP 465: encrypted from the first byte, where 587 starts plain and upgrades.' },
  { id: 'pop3', set: 'mail', label: 'POP3', port: '110', proto: TCP, from: ['legacy', 'corp'], to: ['mail'],
    plain: ['Allow POP3 email retrieval from {from} to {to}', 'Permit unencrypted POP3 from {from} to {to}'],
    job: ['{from} can download mail from {to} without encryption, removing it from the server', 'Old mail software on {from} can pull messages down from {to} in cleartext and keep them only locally', '{from} can collect its mail from {to} with the unencrypted protocol that empties the mailbox as it downloads'],
    why: 'Download and remove is POP3, and plain POP3 is TCP 110.' },
  { id: 'pop3-block', set: 'mail', label: 'POP3', port: '110', proto: TCP, action: 'Deny', from: ['corp', 'guest'], to: ['mail'],
    plain: ['Block all POP3 connections from {from} to {to}', 'Deny unencrypted POP3 from {from} to {to}'],
    job: [`{from} must not be able to download mail from {to} without encryption. ${BLOCK_LOG}`, 'Stop {from} from fetching mail from {to} with the cleartext download-and-delete protocol, and log every attempt', `Mail apps on {from} must not download mail from {to} without encryption with the protocol that removes it from the server. ${BLOCK_LOG}`],
    why: 'Plain POP3 is TCP 110, and block means the Action is Deny.' },
  { id: 'pop3s', set: 'mail', label: 'POP3S', port: '995', proto: TCP, from: ['corp', 'employee'], to: ['mail'],
    plain: ['Allow secure POP3 email retrieval from {from} to {to}', 'Allow POP3S from {from} to {to}'],
    job: ['{from} can download mail from {to} over an encrypted connection, removing it from the server', '{from} can pull messages down from {to} inside TLS and keep them only locally', 'Mail apps on {from} can collect mail from {to} with the encrypted version of the download-and-delete protocol'],
    why: 'Encrypted POP3 is POP3S on TCP 995.' },
  { id: 'imap', set: 'mail', label: 'IMAP', port: '143', proto: TCP, from: ['corp', 'legacy'], to: ['mail'],
    plain: ['Allow unencrypted IMAP mailbox access from {from} to {to}', 'Permit plain IMAP from {from} to {to}'],
    job: ['{from} can read mail on {to} without encryption, leaving it on the server', '{from} can work with its mailbox on {to} in cleartext, with messages and folders staying on the server for every device', 'Mail apps on {from} can sync folders with {to} without encryption, using the protocol that keeps mail on the server'],
    why: 'Leaving mail on the server is IMAP, and plain IMAP is TCP 143.' },
  { id: 'imaps', set: 'mail', label: 'IMAPS', port: '993', proto: TCP, from: ['corp', 'employee'], to: ['mail'],
    plain: ['Allow secure IMAP mailbox access from {from} to {to}', 'Allow IMAPS from {from} to {to}'],
    job: ['{from} can read mail on {to} over an encrypted connection, leaving it on the server', '{from} can work with its mailbox on {to} inside TLS, with messages and folders staying on the server for every device', 'Mail apps on {from} can sync folders with {to} over an encrypted connection, using the protocol that keeps mail on the server'],
    why: 'Encrypted IMAP is IMAPS on TCP 993. The secure mail readers live in the 990s.' },

  // ── Files and sharing ──
  { id: 'smb', set: 'files', label: 'SMB', port: '445', proto: TCP, from: ['corp', 'employee'], to: ['file'], serverToo: true,
    plain: ['Allow SMB file sharing from {from} to {to}', '{from} must be able to reach {to} over SMB'],
    job: ['{from} can open the shared folders on {to}', '{from} can map a network drive to {to} the modern Windows way, with no legacy name services involved', '{from} can read and save documents in the Windows shares on {to}'],
    why: 'Windows file sharing is SMB on TCP 445, the port ransomware loves to spread over.' },
  { id: 'smb-block', set: 'files', label: 'SMB', port: '445', proto: TCP, action: 'Deny', from: ['guest'], to: ['file', 'print'],
    plain: ['Block all SMB connections from {from} to {to}', 'Deny SMB from {from} to {to}'],
    job: [`{from} must not be able to open Windows shares on {to}. ${BLOCK_LOG}`, 'Stop {from} from reaching the Windows file sharing service on {to}, the one ransomware spreads over, and log every attempt', `Nothing on {from} may connect to shared folders or shared printers on {to}. ${BLOCK_LOG}`],
    why: 'SMB is TCP 445, and block means the Action is Deny.' },
  { id: 'tftp', set: 'files', label: 'TFTP', port: '69', proto: UDP, from: ['phones'], to: ['phonecfg'],
    plain: ['Allow TFTP from {from} to {to}', '{to} must accept TFTP from {from}'],
    job: ['{from} can fetch settings from {to} at startup with the simple transfer that has no login', '{from} can download boot files from {to} with the bare-bones transfer protocol that has no login and no encryption', '{from} can pull configuration from {to} over the trivial, connectionless file transfer used by devices as they start up'],
    why: 'TFTP is UDP 69, with no login and no encryption, so keep it on internal networks.' },
  { id: 'ftp', set: 'files', label: 'FTP control', port: '21', proto: TCP, from: ['partner', 'employee'], to: ['ftp'],
    plain: ['Allow FTP control connections from {from} to {to}', 'Permit the FTP command channel from {from} to {to}'],
    job: ['{from} can log in to {to} and send file transfer commands in cleartext', '{from} can sign in to {to} with the classic unencrypted file transfer protocol and list or request files on its command channel', '{from} needs the channel that carries usernames, passwords and commands for the old cleartext file transfer service on {to}'],
    why: 'FTP commands and logins travel on the control channel, TCP 21, in cleartext.' },
  { id: 'ftp-data', set: 'files', label: 'FTP data', port: '20', proto: TCP, from: ['ftp'], to: ['partner'],
    plain: ['Allow active-mode FTP data connections from {from} to {to}. Enter the well-known port the server sends from', 'Permit the FTP data channel from {from} back to {to} in active mode. Enter the well-known port the server sends from'],
    job: ['{from} can open the cleartext file transfer\'s active-mode data connection back to {to}. Enter the well-known port the server sends from', 'In active mode {from} opens a second connection back to {to} to carry the file contents of the cleartext transfer. Enter the well-known port the server sends from', 'File contents of the old cleartext transfer travel on their own connection, opened by {from} toward {to}. Enter the well-known port the server sends from'],
    why: 'In active mode the server sends the file from its own TCP 20. The data port is one below the command port.' },
  { id: 'ftps', set: 'files', label: 'Implicit FTPS control', port: '990', proto: TCP, from: ['partner'], to: ['ftp'],
    plain: ['Allow implicit FTPS control connections from {from} to {to}', 'Permit the implicit FTPS command channel from {from} to {to}'],
    job: ['{from} can send file transfer commands to {to} over a channel that uses TLS from the start', '{from} can sign in to {to} and issue commands for the classic file transfer protocol wrapped in TLS from the first byte', '{from} needs the command channel of the TLS-wrapped file transfer service on {to}, the kind that never starts in cleartext'],
    why: 'Implicit FTPS uses TCP 990 for control, encrypted with TLS from the start.' },
  { id: 'ftps-data', set: 'files', label: 'Implicit FTPS data', port: '989', proto: TCP, from: ['ftp'], to: ['partner'],
    plain: ['Allow implicit FTPS data connections from {from} to {to}. Enter the well-known port the server sends from', 'Permit the implicit FTPS data channel from {from} back to {to}. Enter the well-known port the server sends from'],
    job: ['{from} can open the TLS file transfer\'s data connection back to {to}. Enter the well-known port the server sends from', 'File contents of the TLS-wrapped transfer travel on their own connection, opened by {from} toward {to}. Enter the well-known port the server sends from', '{from} sends the files themselves to {to} on the data channel of the transfer that uses TLS from the start. Enter the well-known port the server sends from'],
    why: 'Implicit FTPS data is TCP 989, one below control, just as FTP data on 20 sits one below 21.' },
  { id: 'nb-name', set: 'files', label: 'NetBIOS name service', port: '137', proto: UDP, from: ['legacy'], to: ['file', 'win'],
    plain: ['Allow NetBIOS name service traffic from {from} to {to}', 'Permit the NetBIOS name service from {from} to {to}'],
    job: ['{from} can look up Windows computer names on {to} the legacy way', '{from} can register and resolve old-style Windows computer names with {to}, the first of the three legacy Windows networking services', '{from} finds other Windows machines by name through {to}, using the legacy lookup that predates DNS on Windows networks'],
    why: 'NetBIOS uses three neighbors. The name service is UDP 137, the first of the three.' },
  { id: 'nb-dgram', set: 'files', label: 'NetBIOS datagram service', port: '138', proto: UDP, from: ['legacy'], to: ['file', 'win'],
    plain: ['Allow NetBIOS datagram service traffic from {from} to {to}', 'Permit the NetBIOS datagram service from {from} to {to}'],
    job: ['{from} can send connectionless legacy Windows networking messages to {to}', '{from} can send browse announcements and other one-off messages to {to} with the middle one of the three legacy Windows networking services', '{from} needs the legacy Windows service on {to} that delivers single messages with no session set up first'],
    why: 'The NetBIOS datagram service is UDP 138. Datagrams are connectionless, which is what UDP is for.' },
  { id: 'nb-session', set: 'files', label: 'NetBIOS session service', port: '139', proto: TCP, from: ['legacy'], to: ['file', 'win'],
    plain: ['Allow NetBIOS session service traffic from {from} to {to}', 'Permit the NetBIOS session service from {from} to {to}'],
    job: ['{from} can open a legacy Windows file sharing session with {to}', '{from} can reach shared folders on {to} the old way, through the connection-based one of the three legacy Windows networking services', '{from} is too old for modern Windows file sharing and needs the legacy session service on {to} instead'],
    why: 'A session needs a connection, so the NetBIOS session service is TCP 139. SMB on 445 replaced it.' },

  // ── Directory and sign-in ──
  { id: 'kerberos', set: 'directory', label: 'Kerberos', port: '88', proto: BOTH, from: ['corp', 'employee'], to: ['dc'], serverToo: true,
    plain: ['Allow Kerberos authentication from {from} to {to}', '{from} must be able to reach {to} over Kerberos'],
    job: ['{from} can get sign-in tickets from {to}', '{from} can prove who it is to {to} and receive tickets for the domain\'s services', 'Domain sign-ins from {from} are checked by {to}, which issues time-limited tickets instead of passing passwords around'],
    why: 'Kerberos is port 88 on both UDP and TCP, because larger tickets do not fit in UDP.' },
  { id: 'ldap', set: 'directory', label: 'LDAP', port: '389', proto: TCP, from: ['app', 'legacy'], to: ['dc'],
    plain: ['Allow LDAP queries from {from} to {to}', 'Permit unencrypted LDAP from {from} to {to}'],
    job: ['{from} can look up users in the directory on {to} without encryption', '{from} can search for accounts and groups on {to} in cleartext', '{from} reads user details from the directory service on {to} with nothing encrypted'],
    why: 'Plain LDAP is TCP 389, and it sends directory queries in cleartext.' },
  { id: 'ldaps', set: 'directory', label: 'LDAPS', port: '636', proto: TCP, from: ['app', 'web'], to: ['dc'],
    plain: ['Allow LDAPS queries from {from} to {to}', 'Allow secure LDAP from {from} to {to}'],
    job: ['{from} can look up users in the directory on {to} over an encrypted connection', '{from} can search for accounts and groups on {to} inside TLS', '{from} reads user details from the directory service on {to}, and the queries have to be encrypted'],
    why: 'Encrypted directory lookups are LDAPS on TCP 636, a number that reads the same backwards.' },
  { id: 'radius', set: 'directory', label: 'RADIUS authentication', port: '1812', proto: UDP, from: ['ap'], to: ['auth'],
    plain: ['Allow RADIUS authentication from {from} to {to}', '{to} must accept RADIUS authentication requests from {from}'],
    job: ['{from} can check 802.1X logins against {to}', '{from} can ask {to} whether a Wi-Fi user\'s enterprise login is valid before letting the device on', '{from} passes each network login to {to}, the central AAA server that encrypts only the password'],
    why: 'RADIUS authentication is UDP 1812, the protocol behind 802.1X and enterprise Wi-Fi.' },
  { id: 'radius-acct', set: 'directory', label: 'RADIUS accounting', port: '1813', proto: UDP, from: ['ap'], to: ['auth'],
    plain: ['Allow RADIUS accounting from {from} to {to}', '{to} must accept RADIUS accounting records from {from}'],
    job: ['{from} can send 802.1X session records to {to}', '{from} can report to {to} when each Wi-Fi session starts and stops and how much data it used', '{from} sends usage records for every network login to {to}, on the port next to the one that checks the logins'],
    why: 'RADIUS accounting is the next port up, UDP 1813: 1812 for logins, 1813 for records.' },
  { id: 'tacacs', set: 'directory', label: 'TACACS+', port: '49', proto: TCP, from: ['router', 'sw'], to: ['auth'],
    plain: ['Allow TACACS+ authentication from {from} to {to}', 'Permit TACACS+ from {from} to {to}'],
    job: ['{from} can check administrators\' logins against {to} with the protocol that encrypts the whole packet', '{from} can ask {to} to approve each administrator and each command typed, over the AAA protocol that keeps authentication, authorization and accounting separate', 'Administrators logging in to {from} are checked against {to} with the device administration protocol that runs over a reliable connection'],
    why: 'TACACS+ is TCP 49 and encrypts the entire packet, where RADIUS encrypts only the password.' },

  // ── Managing and logging ──
  { id: 'snmp', set: 'manage', label: 'SNMP polling', port: '161', proto: UDP, from: ['mon'], to: ['sw', 'router', 'linux'],
    plain: ['Allow SNMP polling from {from} to {to}', '{to} must accept SNMP queries from {from}'],
    job: ['{from} can read the counters on {to}', '{from} can ask {to} for its interface statistics and health readings on a schedule', '{from} collects status values from the management agent on {to} by asking for them'],
    why: 'SNMP polling goes to the device on UDP 161: 161 asks.' },
  { id: 'snmp-trap', set: 'manage', label: 'SNMP traps', port: '162', proto: UDP, from: ['sw', 'router', 'linux'], to: ['mon'],
    plain: ['Allow SNMP traps from {from} to {to}', '{to} must accept SNMP traps from {from}'],
    job: ['{from} can send alerts to {to} without being asked', '{from} can warn {to} the moment something fails, instead of waiting to be polled', 'Unprompted alarm messages from the management agent on {from} must reach {to}'],
    why: 'Traps come from the device to the manager on UDP 162: 162 tells.' },
  { id: 'syslog', set: 'manage', label: 'Syslog', port: '514', proto: UDP, from: ['sw', 'router'], to: ['siem'],
    plain: ['Allow traditional syslog from {from} to {to}', 'Permit standard unencrypted syslog from {from} to {to}'],
    job: ['{from} can send logs to {to} the traditional unencrypted way', '{from} can forward its event messages to {to} with the classic connectionless logging protocol', 'Log lines from {from} reach {to} in cleartext, with no delivery guarantee'],
    why: 'Traditional syslog is UDP 514, with no authentication and no encryption.' },
  { id: 'syslog-tls', set: 'manage', label: 'Syslog over TLS', port: '6514', proto: TCP, from: ['linux', 'win', 'web'], to: ['siem'],
    plain: ['Allow syslog over TLS from {from} to {to}', 'Permit TLS-protected syslog from {from} to {to}'],
    job: ['{from} can send logs to {to} over an encrypted connection', '{from} can forward its event messages to {to} inside TLS, so they cannot be read or altered on the way', 'Log lines from {from} must reach {to} reliably and encrypted'],
    why: 'Syslog over TLS is TCP 6514: the old 514 with a 6 in front. TLS needs TCP.' },
  { id: 'ping', set: 'manage', label: 'ICMP', port: NO_PORT, proto: ICMP, from: ['mon', 'admin'], to: ['linux', 'win', 'sw'],
    plain: ['Allow ICMP echo requests from {from} to {to}', '{to} must accept ICMP echo requests from {from}'],
    job: ['{from} can ping {to} to check that it is up', '{from} can test whether {to} is reachable and how long replies take', '{from} sends echo requests to {to} and waits for the echo replies'],
    why: 'Ping is ICMP. It sits beside TCP and UDP and has no ports at all, so the Port is N/A.' },
  { id: 'ping-block', set: 'manage', label: 'ICMP', port: NO_PORT, proto: ICMP, action: 'Deny', from: ['guest', 'internet'], to: ['dc', 'db', 'web'],
    plain: ['Block all ICMP traffic from {from} to {to}', 'Deny ICMP from {from} to {to}'],
    job: [`{from} must not be able to ping {to}. ${BLOCK_LOG}`, 'Stop {from} from probing {to} with echo requests, and log every attempt', `{to} must stay silent when {from} tests whether it is reachable. ${BLOCK_LOG}`],
    why: 'Ping is ICMP, which has no port, and block means the Action is Deny.' },

  // ── VPNs ──
  { id: 'ike', set: 'vpn', label: 'IKE', port: '500', proto: UDP, from: ['internet', 'branch'], to: ['vpn'],
    plain: ['Allow IKE from {from} to {to}', '{to} must accept IKE key exchange from {from}'],
    job: ['{from} can negotiate the keys for an IPsec tunnel with {to}', '{from} can start an IPsec tunnel with {to} by agreeing on algorithms and keys first', 'The opening handshake of an IPsec tunnel from {from} must reach {to}, before any NAT wrapping comes into play'],
    why: 'IKE sets up an IPsec tunnel on UDP 500, and every IPsec peer has to do it first.' },
  { id: 'natt', set: 'vpn', label: 'IPsec NAT traversal', port: '4500', proto: UDP, from: ['branch'], to: ['vpn'],
    plain: ['Allow IPsec NAT traversal from {from} to {to}', 'Permit IPsec NAT-T from {from} to {to}'],
    job: ['{from} sits behind NAT, so its IPsec traffic has to be wrapped to reach {to}', '{from} reaches {to} through an address-translating router, so its IPsec packets need an extra header that survives the translation', 'The IPsec tunnel that {from} opens to {to} crosses a NAT device and needs the encapsulated form of IPsec'],
    why: 'NAT traversal wraps IPsec in UDP 4500: IKE\'s 500 with a 4 in front.' },
  { id: 'esp', set: 'vpn', label: 'ESP', port: NO_PORT, proto: ESP, from: ['branch'], to: ['vpn'],
    plain: ['Allow ESP traffic from {from} to {to}', '{to} must accept ESP from {from}'],
    job: ['{from} has no NAT in the way, so its encrypted IPsec traffic reaches {to} unwrapped', 'The encrypted payload of the IPsec tunnel from {from} must reach {to} directly, as its own IP protocol', '{from} sends {to} the part of IPsec that hides the data as well as protecting it, with no NAT between them'],
    why: 'Encrypted IPsec traffic is ESP, IP protocol 50. It is its own protocol, so there is no port.' },
  { id: 'ah', set: 'vpn', label: 'AH', port: NO_PORT, proto: AH, from: ['branch'], to: ['vpn'],
    plain: ['Allow AH traffic from {from} to {to}', '{to} must accept AH from {from}'],
    job: ['{from} only needs its IPsec traffic to {to} authenticated, not encrypted', '{from} uses the part of IPsec that proves the sender and catches tampering but leaves the data readable, and it must reach {to}', 'IPsec traffic from {from} to {to} needs integrity and origin checks only, with no confidentiality'],
    why: 'AH, IP protocol 51, proves who sent the data and that it was not changed, but does not hide it.' },
  { id: 'l2tp', set: 'vpn', label: 'L2TP', port: '1701', proto: UDP, from: ['internet', 'branch'], to: ['vpn'],
    plain: ['Allow L2TP connections from {from} to {to}', '{to} must accept L2TP from {from}'],
    job: ['{from} can start a layer 2 tunnel with {to}', '{from} can open the tunnel to {to} that carries no encryption of its own and is normally paired with IPsec', '{from} needs the tunneling protocol on {to} that depends on IPsec for its protection'],
    why: 'L2TP is UDP 1701. It has no encryption of its own, which is why it is paired with IPsec.' },
  { id: 'pptp-block', set: 'vpn', label: 'PPTP', port: '1723', proto: TCP, action: 'Deny', from: ['internet'], to: ['vpn'],
    plain: ['Block all PPTP control connections from {from} to {to}', 'Deny PPTP from {from} to {to}'],
    job: [`{from} must not be able to reach the control channel of the old broken VPN on {to}. ${BLOCK_LOG}`, 'Stop {from} from reaching the obsolete Microsoft VPN service on {to}, whose authentication has been cracked, and log every attempt', `Nothing from {from} may start the outdated VPN on {to} that has been broken for years. ${BLOCK_LOG}`],
    why: 'PPTP control is TCP 1723. It depends on the broken MS-CHAPv2, and block means the Action is Deny.' },
  { id: 'pptp', set: 'vpn', label: 'PPTP', port: '1723', proto: TCP, from: ['branch'], to: ['vpn'],
    plain: ['Allow PPTP control connections from {from} to {to}', 'Permit PPTP from {from} to {to}'],
    job: ['{from} still uses the old broken VPN, and needs its control channel to {to} until it is replaced', '{from} can still connect to {to} with the obsolete Microsoft VPN whose authentication has been cracked', '{from} has not migrated yet and needs the outdated, insecure VPN service on {to} for now'],
    why: 'PPTP control is TCP 1723. It should be replaced as soon as possible.' },
  { id: 'ovpn-udp', set: 'vpn', label: 'OpenVPN', port: '1194', proto: UDP, from: ['internet'], to: ['vpn'],
    plain: ['Allow OpenVPN over UDP from {from} to {to}', '{to} must accept OpenVPN on UDP from {from}'],
    job: ['{from} can connect to {to} with OpenVPN on its preferred transport', 'Remote users on {from} can reach {to} with the open-source TLS-based VPN in its default, faster configuration', '{from} can connect to {to} with the open-source VPN on the connectionless transport it normally uses'],
    why: 'OpenVPN is port 1194, and UDP is preferred because it performs better.' },
  { id: 'ovpn-tcp', set: 'vpn', label: 'OpenVPN', port: '1194', proto: TCP, from: ['partner', 'branch'], to: ['vpn'],
    plain: ['Allow OpenVPN over TCP from {from} to {to}', '{to} must accept OpenVPN on TCP from {from}'],
    job: ['{from} is on a network that blocks OpenVPN\'s preferred transport, and has to reach {to} with the fallback', '{from} can reach {to} with the open-source TLS-based VPN set to its slower, connection-based mode, which gets through stricter networks', '{from} connects to {to} with the open-source VPN on its usual port, but on the reliable transport instead of the default one'],
    why: 'OpenVPN can also run on TCP 1194, which gets through more restrictive networks at some cost in speed.' },
  { id: 'wireguard', set: 'vpn', label: 'WireGuard', port: '51820', proto: UDP, from: ['internet', 'partner'], to: ['vpn'],
    plain: ['Allow WireGuard from {from} to {to}', '{to} must accept WireGuard from {from}'],
    job: ['{from} can connect to {to} with the lean modern VPN that has a small attack surface', '{from} can connect to {to} with the newest of the common VPNs, known for its tiny codebase and fast handshakes', '{from} needs the minimal modern VPN on {to} that uses fixed, up-to-date cryptography instead of negotiating it'],
    why: 'WireGuard is UDP 51820, a modern VPN with a small attack surface.' },

  // ── Databases and the rest ──
  { id: 'mssql', set: 'other', label: 'Microsoft SQL Server', port: '1433', proto: TCP, from: ['app', 'web'], to: ['db'],
    plain: ['Allow Microsoft SQL Server connections from {from} to {to}', '{from} must be able to reach {to} on the Microsoft SQL Server port'],
    job: ['{from} can query its Microsoft SQL Server database on {to}', '{from} stores its data in the Microsoft database engine on {to} and has to connect to it', '{from} needs a database connection to {to}, which runs Microsoft\'s SQL product'],
    why: 'Microsoft SQL Server is TCP 1433.' },
  { id: 'oracle', set: 'other', label: 'Oracle Database', port: '1521', proto: TCP, from: ['app'], to: ['db'],
    plain: ['Allow Oracle database connections from {from} to {to}', '{from} must be able to reach {to} on the Oracle listener port'],
    job: ['{from} can query its Oracle database on {to}', '{from} stores its data in the Oracle engine on {to} and has to connect to its listener', '{from} needs a database connection to {to}, which runs Oracle'],
    why: 'Oracle Database listens on TCP 1521.' },
  { id: 'mysql', set: 'other', label: 'MySQL', port: '3306', proto: TCP, from: ['app', 'web'], to: ['db'],
    plain: ['Allow MySQL connections from {from} to {to}', '{from} must be able to reach {to} on the MySQL port'],
    job: ['{from} can query its MariaDB database on {to}', '{from} stores its data in the open-source database engine on {to} that MariaDB was forked from', '{from} needs a database connection to {to}, which runs MariaDB or the engine it is compatible with'],
    why: 'MySQL and MariaDB share TCP 3306.' },
  { id: 'rpc', set: 'other', label: 'Windows RPC', port: '135', proto: TCP, from: ['admin', 'jump'], to: ['win'],
    plain: ['Allow Windows RPC endpoint mapper connections from {from} to {to}', 'Permit the Windows RPC endpoint mapper from {from} to {to}'],
    job: ['{from} can start remote management of {to} through the Windows service that tells callers where to connect', '{from} can ask {to} which port a Windows management service is listening on, the first step of a remote procedure call', '{from} manages {to} with Windows tools that first look up where each remote procedure service lives'],
    why: 'The Windows RPC endpoint mapper is TCP 135, and it is a frequent attack surface.' },
  { id: 'rpc-block', set: 'other', label: 'Windows RPC', port: '135', proto: TCP, action: 'Deny', from: ['guest', 'employee'], to: ['win', 'dc'],
    plain: ['Block all Windows RPC endpoint mapper connections from {from} to {to}', 'Deny Windows RPC from {from} to {to}'],
    job: [`{from} must not be able to reach the Windows service on {to} that tells callers where to connect. ${BLOCK_LOG}`, 'Stop {from} from asking {to} where its Windows management services listen, and log every attempt', `{from} must not be able to start remote procedure calls to Windows services on {to}. ${BLOCK_LOG}`],
    why: 'The Windows RPC endpoint mapper is TCP 135, and block means the Action is Deny.' },
  { id: 'bgp', set: 'other', label: 'BGP', port: '179', proto: TCP, from: ['router'], to: ['isp'],
    plain: ['Allow BGP sessions from {from} to {to}', '{from} must be able to reach {to} over BGP'],
    job: ['{from} can exchange internet routes with {to}', '{from} can peer with {to} and announce which networks it can reach', '{from} opens a session to {to} over which the internet\'s path information is shared between providers'],
    why: 'BGP exchanges routes between networks over TCP 179.' },
  { id: 'nntp', set: 'other', label: 'NNTP', port: '119', proto: TCP, from: ['corp', 'employee'], to: ['news'],
    plain: ['Allow NNTP from {from} to {to}', '{from} must be able to reach {to} over NNTP'],
    job: ['{from} can read newsgroup articles on {to}', '{from} can post to and download from the discussion groups hosted on {to}', '{from} needs the Usenet service on {to}'],
    why: 'Newsgroups are NNTP on TCP 119.' },
  { id: 'sip', set: 'other', label: 'SIP', port: '5060', proto: BOTH, from: ['phones'], to: ['pbx'],
    plain: ['Allow unencrypted SIP signaling over both of its transports from {from} to {to}', '{to} must accept plain SIP from {from} on both of its transports'],
    job: ['{from} can register with {to} using call signaling that is not encrypted, on either of its transports', '{from} can set up and end calls through {to} with cleartext signaling, whichever of its two transports a phone picks', 'Unencrypted call setup messages from {from} must reach {to}, on the connectionless transport and the connection-based one alike'],
    why: 'Plain SIP signaling is 5060 and can run on UDP or TCP, so the rule covers both.' },
  { id: 'sips', set: 'other', label: 'SIP over TLS', port: '5061', proto: TCP, from: ['phones'], to: ['pbx'],
    plain: ['Allow SIP over TLS from {from} to {to}', '{to} must accept SIP over TLS from {from}'],
    job: ['{from} can set up encrypted calls through {to}', '{from} can register with {to} using call signaling protected by TLS', 'Call setup messages from {from} must reach {to} encrypted, on the secure signaling port'],
    why: 'SIP over TLS is TCP 5061, one above plain SIP. TLS needs TCP.' },
  { id: 'mqtt', set: 'other', label: 'MQTT', port: '1883', proto: TCP, from: ['sensors'], to: ['broker'],
    plain: ['Allow unencrypted MQTT from {from} to {to}', '{to} must accept plain MQTT from {from}'],
    job: ['{from} can publish readings to {to} without encryption', '{from} can send measurements to {to} with the lightweight publish and subscribe protocol for small devices, in cleartext', 'Telemetry from {from} must reach {to} unencrypted, over the messaging protocol built for IoT'],
    why: 'Plain MQTT, the lightweight IoT messaging protocol, is TCP 1883.' },
  { id: 'mqtts', set: 'other', label: 'MQTT over TLS', port: '8883', proto: TCP, from: ['sensors'], to: ['broker'],
    plain: ['Allow MQTT over TLS from {from} to {to}', '{to} must accept MQTT over TLS from {from}'],
    job: ['{from} can publish readings to {to} over an encrypted connection', '{from} can send measurements to {to} with the lightweight publish and subscribe protocol for small devices, inside TLS', 'Telemetry from {from} must reach {to} encrypted, over the messaging protocol built for IoT'],
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

/**
 * What a generated table is rebuilt from. `vague` says, rule by rule, whether it only describes the job. `host` makes
 * it the host-based firewall of one server instead of a network firewall.
 */
export interface GeneratedRef { set: string; seed: number; flows: string[]; vague?: boolean[]; host?: boolean }

/** How many random tables are host-based firewalls. */
export const HOST_SHARE = 0.3;
/** The server a host-based table is written on. It does whatever jobs the table's rules need. */
const HOST_NAMES = ['Main Server', 'Office Server', 'Core Server', 'Branch Server'];
const SELF = 'self';
/** On a host-based table, how often a rule that could go either way is written as outbound. */
const OUTBOUND_SHARE = 0.6;

/** A single machine, which the server of a host-based table can stand in for as the destination of a rule. */
const isMachine = (place: string) => !!HOSTS[place] && !HOSTS[place].many;
/** A server or network device, which that server can stand in for as the source of a rule. Users' own PCs cannot. */
const isServer = (place: string) => isMachine(place) && !HOSTS[place].zones.some(z => z === 'corp' || z === 'guest');
/** Whether the server of a host-based table can be the one a rule's traffic comes from, or the one it goes to. */
const canSend = (f: Flow) => !!f.serverToo || f.from.some(isServer);
const canReceive = (f: Flow) => f.to.some(isMachine);
/** Whether a rule can be written on a host-based firewall at all. */
export const fitsHostTable = (f: Flow) => canReceive(f) || canSend(f);

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
  const host = rand() < HOST_SHARE;
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
      const open = rulesAsking.get(fact)!.filter(f => (!host || fitsHostTable(f)) && !chosen.some(c => clashes(c, f)));
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
  const vague = flows.map(f => rand() < VAGUE_AT[levelOf(f, ctx) ?? MAX_LEVEL / 2]);
  return { set, seed, flows: flows.map(f => f.id), vague, ...(host ? { host } : {}) };
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

  // On a host-based table every rule has the server at one end: it offers the service, or it is the one using it.
  const self = ref.host ? pick(HOST_NAMES) : null;
  const resolved = flows.map(f => {
    let from: string, to: string;
    if (self) {
      const outbound = canSend(f) && (!canReceive(f) || rand() < OUTBOUND_SHARE);
      from = outbound ? SELF : place(pick(f.from));
      to = outbound ? place(pick(f.to)) : SELF;
    } else {
      from = place(pick(f.from));
      to = place(pick(f.to));
      if (to === from) to = place(f.to.find(t => t !== from) ?? to);
    }
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

  if (self) {
    const ip = `${subnets.servers.replace(/\.0\/24$/, '')}.${200 + Math.floor(rand() * 50)}`;
    zones.unshift({ name: self, subnet: ip, hosts: [{ name: self, ip }] });
  }

  const outsideOctets = shuffled([9, 14, 27, 33, 41, 58, 62, 75, 86, 97], rand);
  const outside: NetHost[] = [...outsideUsed].map((k, i) => ({ name: OUTSIDE[k], ip: `${i % 2 ? '203.0.113' : '198.51.100'}.${outsideOctets[i]}` }));

  /** The value a rule's Source or Destination resolves through, and how the requirement says it. */
  const nameOf = (k: string) => k === SELF ? self! : k === 'internet' || k === 'anydev' ? 'Any' : k === 'corp' || k === 'guest' ? ZONE_NAMES[k] : HOSTS[k]?.name ?? OUTSIDE[k];
  const say = (k: string, isDestination: boolean) => {
    if (k === SELF) return `the ${self}`;
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

  const org = pick(ORGS), firewall = pick(FIREWALLS);
  const draft: Draft = {
    id: `gen-${ref.set}`, set: ref.set, seed: ref.seed, zones, outside, internet, rules,
    takeaway: `In this table: ${[...new Set(noted)].join(', ')}.`,
    ...(self ? {
      title: `Random host firewall: ${setTitle}`, firewall: `Host firewall on ${self}`, host: self,
      story: `${org} runs several services on its ${self}. You are writing that server's own host-based firewall, so each rule is inbound to it or outbound from it, and the remote address is the other end. Use Any for the Internet or for devices that are not listed.`,
    } : {
      title: `Random table: ${setTitle}`, firewall,
      story: `${org} is rewriting its firewall rules. Use Any for the Internet or for devices that are not listed.`,
    }),
  };
  return build(draft);
}
