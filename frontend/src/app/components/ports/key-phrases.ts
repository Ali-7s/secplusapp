/**
 * The Ports trainer's cheat sheet: how the vague requirements of the firewall tables point to a port and protocol.
 * One entry per firewall rule (fact), in plain words, never naming the protocol; the answer shown beside it comes from
 * the rule itself. key-phrases.spec.ts checks every rule has one.
 */

/** Words that change the answer for many rules at once. */
export const QUALIFIERS: { says: string[]; means: string }[] = [
  { says: ['without encryption', 'in cleartext', 'in the clear'], means: 'The plain version: HTTP, Telnet, FTP, POP3, IMAP, LDAP, syslog' },
  { says: ['encrypted', 'inside TLS', 'with the padlock'], means: 'The secure version: HTTPS, SSH or SFTP, FTPS, POP3S, IMAPS, LDAPS, syslog over TLS' },
  { says: ['encrypted from the very first byte', 'TLS already in place', 'never starts in cleartext'], means: 'Implicit TLS, a port of its own: 465, 990, 993, 995, 636' },
  { says: ['starts plain and upgrades', 'switches to encryption partway'], means: 'STARTTLS: mail apps sending on TCP 587' },
  { says: ['inside the encrypted shell', 'not TLS'], means: 'SFTP on TCP 22, not FTPS' },
  { says: ['one small packet', 'connectionless', 'no delivery guarantee'], means: 'UDP' },
  { says: ['reliable connection', 'connection-based', 'large transfer'], means: 'TCP' },
  { says: ['moved off the standard port', 'the usual alternate'], means: 'TCP 8080 for web, TCP 8443 for secure web' },
  { says: ['must not', 'stop', 'log every attempt'], means: 'A Deny rule, written out so attempts are logged' },
];

/** What a requirement says for each firewall rule, by fact id (see FACTS in firewall-generator.ts). */
export const CUES: Record<string, string[]> = {
  // Remote access
  ssh: ['encrypted command line', 'encrypted remote terminal', 'run commands remotely, login encrypted too'],
  sftp: ['upload or exchange files inside the encrypted shell', 'file transfer on the channel admins use for the command line', 'secure shell, not TLS'],
  telnet: ['old unencrypted remote terminal', 'cleartext command line', 'legacy terminal that encrypts nothing, not even the password'],
  rdp: ['full graphical desktop', 'remote access built into Windows', 'work on it as if sitting in front of it'],
  vnc: ['take over the screen, not tied to Windows', 'cross-platform screen sharing', 'open screen-sharing service, often unencrypted'],
  // The web
  'https-in': ['website with the padlock', 'encrypted connection to the site or web interface', 'browse TLS-protected sites', 'browser-based app on the standard secure port'],
  http: ['pages in cleartext on the standard web port', 'typed without the secure prefix', 'so visitors can be redirected to the secure site'],
  'alt-http': ['unencrypted web traffic on the alternate port', 'sends its web requests through a proxy', 'cleartext web moved off the standard port'],
  'alt-https': ['encrypted admin page on the alternate port', 'TLS web interface moved off the standard secure port'],
  // Names, addresses and time
  dns: ['look up names', 'turn hostnames into IP addresses', 'one quick question that fits in a small packet'],
  'dns-zone': ['copy the full set of name records', 'replicate the whole zone', 'large transfer that needs a reliable connection'],
  dot: ['name lookups inside TLS', 'encrypted name resolution on its own port, not inside web traffic'],
  dhcp: ['devices with no address yet ask for one', 'just plugged in, asks for its network settings', 'broadcast for an address'],
  'dhcp-reply': ['hand addresses back to devices', 'answer devices that asked for an address', 'offers of network settings'],
  ntp: ['set its clocks', 'keep time in sync', 'so sign-in tickets and log timestamps stay valid'],
  // Email
  'smtp-in': ['mail servers deliver to us, server to server', 'other organizations\' mail servers hand over email', 'relay scanned mail on to another mail server'],
  submission: ['mail apps send outgoing mail', 'connection starts plain and upgrades', 'sign in first, then switch to encryption'],
  smtps: ['send mail encrypted from the very first byte', 'encryption assumed, not negotiated'],
  pop3: ['download mail without encryption', 'removes it from the server, empties the mailbox', 'kept only on the one device'],
  pop3s: ['download-and-delete, but encrypted', 'pull mail down inside TLS'],
  imap: ['read mail, leaving it on the server, unencrypted', 'folders synced for every device, in cleartext'],
  imaps: ['mail stays on the server, encrypted', 'sync folders inside TLS'],
  // Files and sharing
  smb: ['open shared folders', 'map a network drive the modern Windows way', 'Windows shares, the service ransomware spreads over'],
  tftp: ['fetch settings or boot files at startup', 'simple transfer with no login', 'trivial, connectionless file transfer'],
  ftp: ['upload or download files in cleartext', 'log in and send file commands unencrypted', 'command channel of the old file transfer'],
  'ftp-data': ['file contents on a second connection, active mode', 'the port the cleartext transfer\'s server sends data from'],
  ftps: ['file transfer commands in TLS from the start', 'TLS-wrapped file transfer that never starts in cleartext'],
  'ftps-data': ['data connection of the TLS-wrapped transfer', 'the files themselves, TLS from the start'],
  'nb-name': ['look up Windows computer names the legacy way', 'names before DNS on Windows networks'],
  'nb-dgram': ['connectionless legacy Windows messages', 'browse announcements, no session set up'],
  'nb-session': ['legacy Windows file sharing session', 'too old for modern Windows file sharing'],
  // Directory and sign-in
  kerberos: ['sign-in tickets', 'prove who it is and get tickets for the domain\'s services', 'time-limited tickets instead of passwords'],
  ldap: ['look up users in the directory, unencrypted', 'search accounts and groups in cleartext'],
  ldaps: ['directory lookups, encrypted', 'search accounts and groups inside TLS'],
  radius: ['check 802.1X or enterprise Wi-Fi logins', 'central AAA server that encrypts only the password'],
  'radius-acct': ['802.1X session records', 'when each Wi-Fi session started and stopped, and how much data', 'the port next to the login check'],
  tacacs: ['administrators\' logins with the whole packet encrypted', 'approve each command typed', 'device administration AAA over a reliable connection'],
  // Managing and logging
  snmp: ['read the counters', 'interface statistics and health readings on a schedule', 'ask the management agent for values'],
  'snmp-trap': ['alerts sent without being asked', 'warn the moment something fails, not waiting to be polled', 'unprompted alarm messages'],
  syslog: ['send logs the traditional unencrypted way', 'classic connectionless logging', 'log lines in cleartext, no delivery guarantee'],
  'syslog-tls': ['send logs encrypted', 'event messages inside TLS', 'logs must arrive reliably and encrypted'],
  ping: ['check that it is up', 'test whether it is reachable and how long replies take', 'echo requests and replies'],
  // VPNs
  ike: ['negotiate the keys for an IPsec tunnel', 'agree on algorithms and keys first', 'opening handshake of an IPsec tunnel'],
  natt: ['IPsec from behind NAT', 'IPsec through an address-translating router', 'wrapped or encapsulated IPsec'],
  esp: ['encrypted IPsec traffic with no NAT in the way', 'the part of IPsec that hides the data', 'its own IP protocol'],
  ah: ['IPsec authenticated but not encrypted', 'proves the sender and catches tampering, data stays readable'],
  l2tp: ['layer 2 tunnel', 'tunnel with no encryption of its own, paired with IPsec'],
  pptp: ['control channel of the old broken VPN', 'obsolete Microsoft VPN whose authentication was cracked'],
  'ovpn-udp': ['open-source TLS-based VPN, default faster setup', 'its preferred, connectionless transport'],
  'ovpn-tcp': ['open-source VPN\'s fallback when its preferred transport is blocked', 'slower, connection-based mode for strict networks'],
  wireguard: ['lean modern VPN with a small attack surface', 'tiny codebase, fast handshakes', 'fixed, up-to-date cryptography'],
  // Databases and the rest
  mssql: ['Microsoft\'s SQL database engine'],
  oracle: ['Oracle database, connecting to its listener'],
  mysql: ['MariaDB, or the open-source engine it was forked from'],
  rpc: ['Windows service that tells callers where to connect', 'look up which port a Windows management service is on'],
  bgp: ['exchange internet routes', 'peer and announce which networks it can reach', 'path information shared between providers'],
  nntp: ['newsgroup articles', 'Usenet discussion groups'],
  sip: ['call signalling, unencrypted, on either transport', 'set up and end calls in cleartext'],
  sips: ['encrypted call setup', 'call signalling protected by TLS'],
  mqtt: ['publish sensor readings unencrypted', 'lightweight publish and subscribe for IoT, in cleartext'],
  mqtts: ['IoT readings or telemetry, encrypted', 'publish and subscribe inside TLS'],
};
