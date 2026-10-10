import { LessonBody } from '../networking.model';
import { exam, h, hSecure, list, mcq, p, table } from './dsl';

export const PORTS_TO_KNOW: LessonBody = {
  goals: [
    'Group the common ports by job instead of memorizing a flat list',
    'Pair each insecure protocol with its secure replacement',
    'Use a few memory hooks for the numbers that always show up',
    'Know where to practice the numbers until they stick',
  ],
  blocks: [
    p('There is no way to reason your way to a port number. They are conventions you simply have to learn. The trick is to learn them **by job** (about ten families instead of forty loose numbers) and to always learn the **secure version next to the insecure one**.'),

    h('The ports, by job'),
    table(
      ['Job', 'Protocol and port', 'Remember'],
      [
        ['Remote access', '**SSH** `22` TCP', 'Encrypted. Also carries SFTP and SCP'],
        ['', '**Telnet** `23` TCP', 'Plaintext. Replace it with SSH'],
        ['', '**RDP** `3389` TCP', 'Windows remote desktop. A favorite target, so never expose it to the internet'],
        ['Web', '**HTTP** `80` TCP', 'Plaintext web traffic'],
        ['', '**HTTPS** `443` TCP', 'Web over TLS (use TLS 1.2 or 1.3)'],
        ['Email', '**SMTP** `25` TCP', 'Server-to-server mail. Use STARTTLS'],
        ['', '**SMTP submission** `587` TCP and **SMTPS** `465` TCP', 'Mail clients sending: STARTTLS on 587, implicit TLS on 465'],
        ['', '**POP3** `110` TCP, secure **POP3S** `995`', 'Downloads mail. The secure version is in the 990s'],
        ['', '**IMAP** `143` TCP, secure **IMAPS** `993`', 'Reads mail on the server. Also in the 990s when secure'],
        ['File transfer', '**FTP** `21` TCP (control) and `20` (data)', 'Plaintext logins and data'],
        ['', '**SFTP** `22` TCP', 'Runs inside SSH. Not the same thing as FTPS'],
        ['', '**FTPS** `990` TCP (implicit) or `21` (explicit)', 'FTP wrapped in TLS. Needs certificates and extra data ports'],
        ['', '**TFTP** `69` UDP', 'No login and no encryption. For network booting only'],
        ['', '**SMB** `445` TCP', 'Windows file sharing. SMBv1 is dangerous (EternalBlue)'],
        ['Names and addresses', '**DNS** `53` UDP and TCP', 'UDP for queries, TCP for zone transfers and large answers'],
        ['', '**DHCP** `67` and `68` UDP', 'Server 67, client 68'],
        ['Directory and sign-in', '**LDAP** `389` TCP, secure **LDAPS** `636`', 'Directory lookups. The secure version uses TLS'],
        ['', '**Kerberos** `88` TCP and UDP', 'Windows domain sign-in with tickets'],
        ['', '**RADIUS** `1812` and `1813` UDP', 'Authentication and accounting for Wi-Fi (802.1X), VPN and switches'],
        ['', '**TACACS+** `49` TCP', 'Device administration. Encrypts the whole payload'],
        ['Management', '**SNMP** `161` and `162` UDP', '161 polls, 162 receives traps. Use version 3'],
        ['', '**Syslog** `514` UDP', 'Plaintext logs. Secure version: TLS on `6514`'],
        ['', '**NTP** `123` UDP', 'Time. Kerberos breaks if clocks drift by about five minutes'],
        ['VPN and tunnels', '**IKE** `500` UDP and **NAT-T** `4500` UDP', 'IPsec key exchange, and IPsec through NAT'],
        ['', '**L2TP** `1701` UDP and **PPTP** `1723` TCP', 'L2TP needs IPsec for encryption. PPTP is broken: do not use it'],
        ['', '**OpenVPN** `1194` and **WireGuard** `51820` UDP', 'Modern VPNs (these are the default ports)'],
        ['Databases', '**MS SQL** `1433`, **Oracle** `1521`, **MySQL** `3306`', 'Restrict to the application servers that need them'],
        ['Voice', '**SIP** `5060` (and `5061` with TLS)', 'VoIP call signaling'],
      ],
    ),

    h('Insecure to secure: learn them in pairs'),
    table(
      ['Plaintext (avoid)', 'Secure replacement', 'How it is secured'],
      [
        ['Telnet `23`', 'SSH `22`', 'Encrypted session and key-based login'],
        ['HTTP `80`', 'HTTPS `443`', 'HTTP wrapped in TLS'],
        ['FTP `21`', 'SFTP `22` or FTPS `990`', 'SFTP runs inside SSH. FTPS wraps FTP in TLS'],
        ['POP3 `110`', 'POP3S `995`', 'TLS from the start'],
        ['IMAP `143`', 'IMAPS `993`', 'TLS from the start'],
        ['SMTP `25`', 'SMTPS `465` or STARTTLS on `587`', 'TLS from the start, or upgrade the connection with STARTTLS'],
        ['LDAP `389`', 'LDAPS `636`', 'Directory queries inside TLS'],
        ['SNMP v1 and v2c `161`', 'SNMP v3 `161`', 'Adds authentication and encryption (v1 and v2c use a shared "community string")'],
        ['Syslog `514`', 'Syslog over TLS `6514`', 'Encrypted and reliable log delivery'],
        ['TFTP `69`', 'SFTP or SCP', 'TFTP has no login and no encryption'],
      ],
    ),

    h('Memory hooks'),
    list(
      '**The ascending run.** 22 SSH, 23 Telnet, 25 SMTP, 53 DNS, 80 HTTP, 110 POP3, 123 NTP, 143 IMAP, 161 SNMP, 389 LDAP, 443 HTTPS, 445 SMB, 3389 RDP. Say it out loud a few times: the numbers are in order.',
      '**22 and 23 are neighbors.** SSH (22) is the secure replacement for Telnet (23).',
      '**Mail goes out on 25 and comes in on 110 or 143.** The secure versions of the incoming ones both live in the 990s: POP3S is 995 and IMAPS is 993.',
      '**80 is plain web, 443 is the locked web** (the S in HTTPS).',
      '**DHCP: server 67, client 68.** The server is the lower number.',
      '**SNMP: 161 asks, 162 tells.** Managers poll devices on 161, and devices send unprompted alerts (traps) on 162.',
      '**LDAPS is 636,** a palindrome. **RADIUS is 1812 and 1813** (authentication then accounting). **TACACS+ is a lone 49.**',
      '**DNS 53 uses both UDP and TCP.** UDP for everyday queries, TCP for zone transfers and big replies.',
    ),
    exam('Expect two kinds of question: a port or protocol given and the other asked for, and a firewall scenario such as "allow secure web and block plaintext email retrieval" where you choose the ports. Also expect "which protocol should replace Telnet or FTP?"'),

    h('Practice it'),
    p('Memorizing needs repetition, not reading. Short rounds on consecutive days work far better than one long session.'),
    {
      type: 'cta',
      to: '/reference',
      icon: 'fitness_center',
      label: 'Open the Reference Sheet and start the Ports recall drill',
      note: 'The first tab, Network Ports, has a Recall Drill button that quizzes you on exactly this list.',
    },

    hSecure('How to secure it: protocols and ports'),
    list(
      '**Use the encrypted version and switch off the plaintext one.** Disable Telnet, FTP, HTTP management pages and SNMP v1 and v2c on devices, and use SSH, SFTP, HTTPS and SNMPv3 instead.',
      '**Do not expose management protocols to the internet.** Keep SSH, RDP, SNMP, WinRM and database ports reachable only from administrator networks, a VPN or a jump server.',
      '**Block what you do not use at the firewall, in both directions.** Outbound (egress) filtering also catches malware trying to phone home on odd ports.',
      '**Hunt for legacy leftovers.** Common ones are SMBv1, SNMP with the "public" community string, anonymous FTP, TFTP and NetBIOS.',
      '**Watch for surprises.** Alert on connections to risky ports such as 23, 445 or 3389 arriving from the internet.',
    ),
  ],
  check: [
    mcq(
      'An administrator must replace Telnet for managing routers. Which protocol and port should they use?',
      'SSH on TCP 22',
      ['SFTP on TCP 21', 'HTTP on TCP 80', 'SNMP on UDP 161'],
      'SSH is the encrypted replacement for Telnet and uses TCP 22. SFTP is for file transfer, HTTP is plaintext web traffic and SNMP is for monitoring.',
    ),
    mcq(
      'Which pair shows a plaintext email-retrieval protocol and its encrypted replacement?',
      'IMAP on 143 and IMAPS on 993',
      ['SMTP on 25 and POP3 on 110', 'HTTP on 80 and IMAPS on 993', 'POP3 on 110 and IMAP on 143'],
      'IMAP (143) is plaintext and IMAPS (993) is the same protocol inside TLS. The other pairs mix unrelated protocols or pair two plaintext ones.',
    ),
    mcq(
      'Which ports does DHCP use?',
      'UDP 67 for the server and UDP 68 for the client',
      ['TCP 67 and TCP 68', 'UDP 53 and UDP 123', 'UDP 161 and UDP 162'],
      'DHCP runs over UDP. The server listens on 67 and clients use 68. Port 53 is DNS, 123 is NTP, and 161 and 162 are SNMP.',
    ),
    mcq(
      'Which protocol sends encrypted directory queries over port 636?',
      'LDAPS',
      ['LDAP', 'Kerberos', 'RADIUS'],
      'LDAP uses 389 in plaintext. LDAPS wraps the same directory protocol in TLS on 636. Kerberos is 88 and RADIUS is 1812 and 1813.',
    ),
  ],
};
