/**
 * The words in a question that point to one port or protocol: the Ports trainer's cheat sheet. Each phrase belongs
 * to one port only (key-phrases.spec.ts checks), so terms several protocols share, such as STARTTLS or "jump box",
 * are left out.
 */
export const KEY_PHRASES: Record<string, string[]> = {
  // Remote access
  '22': ['Secure Shell', 'SFTP or SCP file copy', 'encrypted command line', 'key-based login, authorized_keys', 'SSH tunnel, port forwarding'],
  '23': ['cleartext remote terminal', 'legacy switch or router command line', 'passwords sniffed in plain text'],
  '3389': ['Remote Desktop', 'graphical Windows session', 'NLA (Network Level Authentication)', 'BlueKeep'],
  '5900': ['screen sharing', 'RFB (remote framebuffer)', 'remote control on any operating system'],
  // The web
  '80': ['cleartext web traffic', 'unencrypted website', 'redirect to HTTPS'],
  '443': ['TLS certificate and padlock', 'HSTS', 'SSL/TLS inspection', 'SSL VPN, clientless VPN', 'DoH (DNS over HTTPS)', 'QUIC, HTTP/3 (UDP 443)'],
  '8080': ['web proxy', 'alternate HTTP port', 'test or development web server'],
  '8443': ['alternate HTTPS port', 'appliance or management web console'],
  // Names, addresses and time
  '53': ['name resolution', 'zone transfer, AXFR (TCP)', 'DNS poisoning, cache poisoning', 'DNSSEC', 'A, AAAA, MX, TXT, CNAME records', 'DNS tunneling'],
  '67/68': ['automatic IP addressing', 'DORA: discover, offer, request, acknowledge', 'lease', 'DHCP snooping', 'rogue DHCP server', 'DHCP starvation', 'BOOTP'],
  '123': ['time synchronization', 'clock skew, clock drift', 'stratum', 'log timestamps that line up', 'NTP amplification'],
  '853': ['DNS over TLS', 'encrypted DNS lookups on their own port'],
  // Email
  '25': ['server-to-server mail (MTA to MTA)', 'mail relay, open relay', 'outbound mail from a mail server'],
  '587': ['mail submission', 'a mail app sending mail', 'authenticated SMTP from clients'],
  '465': ['SMTPS', 'SMTP with implicit TLS'],
  '110': ['download and delete', 'mail kept on one device', 'cleartext mailbox login'],
  '995': ['POP3 over TLS', 'encrypted mail download'],
  '143': ['mail stays on the server', 'folders synced across devices', 'cleartext IMAP login'],
  '993': ['IMAP over TLS', 'encrypted mail sync across devices'],
  // Files and sharing
  '20': ['FTP data channel', 'active mode FTP data'],
  '21': ['FTP control channel, FTP commands', 'anonymous FTP login', 'cleartext file transfer login'],
  '69': ['PXE, network boot', 'switch or router config backup', 'no login, no directory listing'],
  '445': ['Windows file and printer sharing', 'CIFS', 'mapped drive, \\\\server\\share', 'EternalBlue, WannaCry', 'SMBv1'],
  '137-139': ['NetBIOS name service (137)', 'NetBIOS datagram service (138)', 'NetBIOS session service (139)', 'NBT-NS poisoning', 'nbtstat'],
  '989/990': ['FTP over TLS', 'implicit FTPS', 'not SFTP'],
  // Directory and sign-in
  '88': ['tickets, TGT (ticket-granting ticket)', 'KDC (Key Distribution Center)', 'golden ticket, silver ticket', 'Kerberoasting', 'pass-the-ticket', 'Active Directory single sign-on'],
  '389': ['directory lookups', 'bind', 'DN, OU, CN (distinguished name)', 'LDAP injection', 'cleartext directory queries'],
  '636': ['LDAP over TLS', 'encrypted directory lookups'],
  '49': ['network device administration', 'separates authentication, authorization and accounting', 'per-command authorization and logging', 'encrypts the whole payload'],
  '1812/1813': ['802.1X, EAP', 'WPA2 or WPA3-Enterprise login', 'NAC', 'encrypts only the password', 'RADIUS accounting (1813)'],
  // Managing and logging
  '161/162': ['MIB, OID', 'community string, public or private', 'SNMP trap (162)', 'polling device counters (161)', 'SNMPv3 authPriv', 'network monitoring system'],
  '514': ['log forwarding to a SIEM', 'facility and severity', 'unencrypted log collection'],
  '6514': ['syslog over TLS', 'encrypted log forwarding'],
  // VPNs
  '500': ['IKE, ISAKMP', 'IPsec tunnel setup', 'phase 1 and phase 2', 'security association (SA)'],
  '4500': ['NAT traversal (NAT-T)', 'IPsec through a NAT router', 'ESP wrapped in UDP'],
  '1701': ['Layer 2 Tunneling Protocol', 'L2TP/IPsec', 'no encryption on its own'],
  '1723': ['MS-CHAPv2', 'data carried in GRE', 'deprecated, broken VPN'],
  '1194': ['open-source TLS-based VPN'],
  '51820': ['modern minimal VPN', 'small codebase, fixed modern ciphers', 'UDP only, no TCP option'],
  // Databases and the rest
  '1433': ['Microsoft SQL Server', 'Windows database server'],
  '1521': ['Oracle database', 'TNS listener'],
  '3306': ['MySQL, MariaDB', 'LAMP web app database'],
  '135': ['RPC endpoint mapper', 'DCOM, WMI'],
  '179': ['routing between ISPs', 'autonomous system (AS)', 'BGP hijacking, route leak'],
  '5060/5061': ['VoIP call setup, signalling', 'PBX, SIP trunk', 'SIP over TLS (5061)'],
  '1883/8883': ['IoT sensors', 'publish and subscribe through a broker', 'MQTT over TLS (8883)'],
  '119': ['Usenet newsgroups'],
};

/** Protocols with no port at all: a firewall rule names the protocol instead. */
export interface NoPort { name: string; where: string; phrases: string[] }
export const NO_PORT: NoPort[] = [
  { name: 'ICMP', where: 'IP protocol 1', phrases: ['ping, echo request and reply', 'traceroute', 'destination unreachable', 'ping flood, smurf attack'] },
  { name: 'ESP', where: 'IP protocol 50', phrases: ['IPsec encryption of the payload', 'confidentiality and integrity in IPsec'] },
  { name: 'AH', where: 'IP protocol 51', phrases: ['IPsec integrity and origin only, no encryption', 'does not survive NAT'] },
  { name: 'GRE', where: 'IP protocol 47', phrases: ['generic tunnel, no encryption', 'carries PPTP\'s data'] },
];
