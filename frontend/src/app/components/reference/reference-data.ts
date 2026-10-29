/**
 * The Reference page's tables. The page shows them, and the Reference deck in Review mode is built from them
 * (see reference-cards.ts), so a fix here reaches both.
 */

export interface PortEntry {
  port: string;
  protocol: string;
  service: string;
  transport: string;
  status: 'secure' | 'insecure' | 'deprecated' | 'neutral';
  notes: string;
}

export interface CipherEntry {
  name: string;
  type: string;
  keySize: string;
  status: 'secure' | 'insecure' | 'deprecated' | 'neutral';
  use: string;
  notes: string;
}

export interface HashEntry {
  name: string;
  outputBits: string;
  status: 'secure' | 'insecure' | 'deprecated' | 'neutral';
  use: string;
  notes: string;
}

export interface AuthEntry {
  name: string;
  port: string;
  type: string;
  status: 'secure' | 'insecure' | 'deprecated' | 'neutral';
  notes: string;
}

export interface RefEntry {
  name: string;
  category?: string;
  summary: string;
  detail: string;
  status: 'secure' | 'insecure' | 'deprecated' | 'neutral';
}

export interface FormulaEntry {
  name: string;
  formula: string;
  variables: string;
  example: string;
}

export interface MetricEntry {
  abbr: string;
  name: string;
  definition: string;
  example: string;
}

export interface RaidEntry {
  level: string;
  minDisks: string;
  faultTolerance: string;
  performance: string;
  notes: string;
}

export interface ProcessStepEntry {
  order: number;
  phase: string;
  description: string;
  keyActivities: string;
}

export interface SiteEntry {
  type: string;
  recoveryTime: string;
  cost: string;
  description: string;
}

export interface ThreatActorEntry {
  name: string;
  sophistication: string;
  resources: string;
  motivation: string;
  notes: string;
}

export const PORTS: PortEntry[] = [
  { port: '20', protocol: 'FTP-DATA', service: 'FTP Data Transfer', transport: 'TCP', status: 'insecure', notes: 'Transmits file data in cleartext' },
  { port: '21', protocol: 'FTP', service: 'File Transfer Protocol', transport: 'TCP', status: 'insecure', notes: 'Control channel, cleartext credentials' },
  { port: '22', protocol: 'SSH / SFTP / SCP', service: 'Secure Shell + secure file transfer', transport: 'TCP', status: 'secure', notes: 'Encrypted — replace Telnet/FTP with this' },
  { port: '23', protocol: 'Telnet', service: 'Remote Terminal', transport: 'TCP', status: 'insecure', notes: 'Cleartext — replaced by SSH' },
  { port: '25', protocol: 'SMTP', service: 'Mail Transfer Agent → MTA', transport: 'TCP', status: 'neutral', notes: 'Use with STARTTLS for encryption' },
  { port: '49', protocol: 'TACACS+', service: 'Terminal Access Controller Auth', transport: 'TCP', status: 'secure', notes: 'Encrypts entire packet; used for network device auth' },
  { port: '53', protocol: 'DNS', service: 'Domain Name System', transport: 'TCP/UDP', status: 'neutral', notes: 'UDP for queries; TCP for zone transfers. Use DNSSEC' },
  { port: '67/68', protocol: 'DHCP', service: 'Dynamic Host Configuration', transport: 'UDP', status: 'neutral', notes: 'Server:67, Client:68. DHCP snooping prevents rogue servers' },
  { port: '69', protocol: 'TFTP', service: 'Trivial File Transfer', transport: 'UDP', status: 'insecure', notes: 'No auth, no encryption — only for internal booting' },
  { port: '80', protocol: 'HTTP', service: 'HyperText Transfer Protocol', transport: 'TCP', status: 'insecure', notes: 'Cleartext web traffic — use HTTPS instead' },
  { port: '88', protocol: 'Kerberos', service: 'Authentication (ticket-based)', transport: 'TCP/UDP', status: 'secure', notes: 'Default AD/Windows auth; uses tickets & KDC' },
  { port: '110', protocol: 'POP3', service: 'Post Office Protocol v3', transport: 'TCP', status: 'insecure', notes: 'Downloads & deletes mail; cleartext. Use port 995' },
  { port: '119', protocol: 'NNTP', service: 'Network News Transfer', transport: 'TCP', status: 'neutral', notes: 'Usenet newsgroups' },
  { port: '123', protocol: 'NTP', service: 'Network Time Protocol', transport: 'UDP', status: 'neutral', notes: 'Critical — Kerberos fails if clocks drift >5 min' },
  { port: '135', protocol: 'RPC/MSRPC', service: 'Windows Remote Procedure Call', transport: 'TCP', status: 'neutral', notes: 'Used by many Windows services; frequent attack surface' },
  { port: '137-139', protocol: 'NetBIOS', service: 'Name/Session/Datagram', transport: 'TCP/UDP', status: 'deprecated', notes: 'Legacy Windows networking; disable if not needed' },
  { port: '143', protocol: 'IMAP', service: 'Internet Message Access Protocol', transport: 'TCP', status: 'insecure', notes: 'Reads mail on server; cleartext. Use port 993' },
  { port: '161/162', protocol: 'SNMP', service: 'Simple Network Management', transport: 'UDP', status: 'neutral', notes: 'v1/v2c use community strings (weak); use SNMPv3' },
  { port: '179', protocol: 'BGP', service: 'Border Gateway Protocol', transport: 'TCP', status: 'neutral', notes: 'Inter-AS routing; route hijacking is a major risk' },
  { port: '389', protocol: 'LDAP', service: 'Lightweight Directory Access', transport: 'TCP', status: 'insecure', notes: 'Cleartext directory queries. Use LDAPS (636)' },
  { port: '443', protocol: 'HTTPS', service: 'HTTP over TLS', transport: 'TCP', status: 'secure', notes: 'TLS 1.2+ required; TLS 1.3 preferred' },
  { port: '445', protocol: 'SMB', service: 'Server Message Block', transport: 'TCP', status: 'neutral', notes: 'Windows file sharing; SMBv1 is critical vuln (EternalBlue)' },
  { port: '465', protocol: 'SMTPS', service: 'SMTP over TLS (implicit)', transport: 'TCP', status: 'secure', notes: 'TLS from the start; legacy but still used' },
  { port: '500', protocol: 'IKE', service: 'Internet Key Exchange (IPSec)', transport: 'UDP', status: 'secure', notes: 'Phase 1 & 2 of IPSec tunnel setup' },
  { port: '514', protocol: 'Syslog', service: 'System Logging', transport: 'UDP', status: 'insecure', notes: 'No auth, cleartext. Use syslog over TLS (6514)' },
  { port: '587', protocol: 'SMTP Submission', service: 'Mail Client → Server', transport: 'TCP', status: 'secure', notes: 'STARTTLS required; replaces port 25 for submission' },
  { port: '636', protocol: 'LDAPS', service: 'LDAP over TLS', transport: 'TCP', status: 'secure', notes: 'Encrypted directory queries' },
  { port: '853', protocol: 'DoT', service: 'DNS over TLS', transport: 'TCP', status: 'secure', notes: 'Encrypts DNS lookups so they cannot be read or changed in transit' },
  { port: '989/990', protocol: 'FTPS', service: 'FTP over TLS', transport: 'TCP', status: 'secure', notes: 'Implicit TLS: control 990, data 989. Explicit FTPS starts on port 21 and upgrades with AUTH TLS. Not SFTP' },
  { port: '993', protocol: 'IMAPS', service: 'IMAP over TLS', transport: 'TCP', status: 'secure', notes: 'Encrypted mail reading; replaces 143' },
  { port: '995', protocol: 'POP3S', service: 'POP3 over TLS', transport: 'TCP', status: 'secure', notes: 'Encrypted mail download; replaces 110' },
  { port: '1194', protocol: 'OpenVPN', service: 'OpenVPN', transport: 'UDP/TCP', status: 'secure', notes: 'TLS-based VPN; UDP preferred for performance' },
  { port: '1433', protocol: 'MSSQL', service: 'Microsoft SQL Server', transport: 'TCP', status: 'neutral', notes: 'Restrict access; default target in DB attacks' },
  { port: '1521', protocol: 'Oracle DB', service: 'Oracle Database', transport: 'TCP', status: 'neutral', notes: 'Restrict network access' },
  { port: '1701', protocol: 'L2TP', service: 'Layer 2 Tunneling Protocol', transport: 'UDP', status: 'neutral', notes: 'No encryption alone; pair with IPSec' },
  { port: '1723', protocol: 'PPTP', service: 'Point-to-Point Tunneling', transport: 'TCP', status: 'deprecated', notes: 'Broken MS-CHAPv2; do not use' },
  { port: '1812/1813', protocol: 'RADIUS', service: 'Remote Auth Dial-In User Service', transport: 'UDP', status: 'secure', notes: '1812=auth, 1813=accounting; used for 802.1X / Wi-Fi' },
  { port: '1883/8883', protocol: 'MQTT', service: 'IoT Messaging (plain/TLS)', transport: 'TCP', status: 'neutral', notes: '8883 is TLS; common in IoT environments' },
  { port: '3306', protocol: 'MySQL / MariaDB', service: 'MySQL Database', transport: 'TCP', status: 'neutral', notes: 'Restrict access; common in web-app attacks' },
  { port: '3389', protocol: 'RDP', service: 'Remote Desktop Protocol', transport: 'TCP', status: 'neutral', notes: 'High-value attack target; enable NLA, limit exposure' },
  { port: '4500', protocol: 'NAT-T', service: 'IPSec NAT Traversal', transport: 'UDP', status: 'secure', notes: 'Used when IPSec passes through NAT' },
  { port: '5060/5061', protocol: 'SIP', service: 'Session Initiation Protocol (VoIP)', transport: 'UDP/TCP', status: 'neutral', notes: '5061 is TLS; VoIP signaling' },
  { port: '5900', protocol: 'VNC', service: 'Virtual Network Computing', transport: 'TCP', status: 'insecure', notes: 'Often cleartext; use only over VPN or SSH tunnel' },
  { port: '6514', protocol: 'Syslog-TLS', service: 'Encrypted Syslog', transport: 'TCP', status: 'secure', notes: 'RFC 5425; secure log forwarding' },
  { port: '8080', protocol: 'HTTP-Alt', service: 'Alternate HTTP / Proxy', transport: 'TCP', status: 'insecure', notes: 'Common for web proxies; still cleartext' },
  { port: '8443', protocol: 'HTTPS-Alt', service: 'Alternate HTTPS', transport: 'TCP', status: 'secure', notes: 'TLS on non-standard port; used by management interfaces' },
  { port: '51820', protocol: 'WireGuard', service: 'WireGuard VPN', transport: 'UDP', status: 'secure', notes: 'Modern VPN; minimal attack surface, fast' },
];

export const CIPHERS: CipherEntry[] = [
  // Symmetric
  { name: 'AES-128', type: 'Symmetric block', keySize: '128-bit', status: 'secure', use: 'Encryption at rest/transit', notes: 'NIST standard; used in WPA2, TLS, disk encryption' },
  { name: 'AES-256', type: 'Symmetric block', keySize: '256-bit', status: 'secure', use: 'High-assurance encryption', notes: 'Government/classified standard; Suite B approved' },
  { name: '3DES (TDEA)', type: 'Symmetric block', keySize: '112-bit effective', status: 'deprecated', use: 'Legacy systems', notes: 'Officially deprecated 2023; Sweet32 attack' },
  { name: 'DES', type: 'Symmetric block', keySize: '56-bit', status: 'insecure', use: 'None — historical', notes: 'Broken by brute force; never use' },
  { name: 'Blowfish', type: 'Symmetric block', keySize: '32–448-bit', status: 'neutral', use: 'bcrypt-based password hashing', notes: 'Secure but limited block size (64-bit); no new uses' },
  { name: 'RC4', type: 'Symmetric stream', keySize: '40–2048-bit', status: 'insecure', use: 'None — removed from TLS', notes: 'Statistical biases; prohibited in TLS by RFC 7465' },
  { name: 'ChaCha20', type: 'Symmetric stream', keySize: '256-bit', status: 'secure', use: 'TLS 1.3, mobile/embedded', notes: 'Fast in software; used with Poly1305 MAC (AEAD)' },
  // Asymmetric
  { name: 'RSA-2048', type: 'Asymmetric', keySize: '2048-bit min', status: 'secure', use: 'Key exchange, signatures, TLS', notes: 'Minimum 2048-bit; 3072+ for >2030 security' },
  { name: 'RSA-1024', type: 'Asymmetric', keySize: '1024-bit', status: 'insecure', use: 'None — broken', notes: 'Factorable with modern hardware' },
  { name: 'ECC / ECDSA', type: 'Asymmetric', keySize: '256–521-bit', status: 'secure', use: 'TLS certs, code signing, IoT', notes: '256-bit ECC ≈ 3072-bit RSA security; faster' },
  { name: 'ECDH / ECDHE', type: 'Asymmetric (KE)', keySize: '256–521-bit', status: 'secure', use: 'TLS key exchange', notes: 'ECDHE provides Perfect Forward Secrecy (PFS)' },
  { name: 'DH / DHE', type: 'Asymmetric (KE)', keySize: '2048-bit min', status: 'neutral', use: 'Key exchange without PFS (DH) or with (DHE)', notes: 'Static DH has no PFS; prefer ECDHE' },
  { name: 'DSA', type: 'Asymmetric (sig)', keySize: '1024–3072-bit', status: 'deprecated', use: 'Digital signatures', notes: 'NIST deprecated 2023; use ECDSA or RSA-PSS' },
  { name: 'ElGamal', type: 'Asymmetric', keySize: '2048-bit+', status: 'neutral', use: 'PGP/GPG encryption', notes: 'Rare outside PGP; IND-CPA secure' },
];

export const HASHES: HashEntry[] = [
  { name: 'MD5', outputBits: '128-bit', status: 'insecure', use: 'File checksums (non-security)', notes: 'Collision attacks trivially possible; never for auth or signatures' },
  { name: 'SHA-1', outputBits: '160-bit', status: 'deprecated', use: 'Legacy — avoid', notes: 'Shattered attack (2017); deprecated in certs since 2017' },
  { name: 'SHA-256', outputBits: '256-bit', status: 'secure', use: 'Code signing, TLS certs, HMAC', notes: 'NIST standard; most common in practice' },
  { name: 'SHA-384', outputBits: '384-bit', status: 'secure', use: 'Higher-assurance signing', notes: 'Suite B approved for Top Secret; SHA-2 family' },
  { name: 'SHA-512', outputBits: '512-bit', status: 'secure', use: 'Password hashing helper, HMAC', notes: 'SHA-2 family; faster than SHA-256 on 64-bit CPUs' },
  { name: 'SHA-3 / Keccak', outputBits: '224/256/384/512-bit', status: 'secure', use: 'Alternative to SHA-2', notes: 'Different algorithm family; not SHA-2 dependent' },
  { name: 'HMAC', outputBits: 'Same as underlying hash', status: 'secure', use: 'Message authentication (API keys, TLS MACs)', notes: 'Keyed hash; proves integrity + authenticity' },
  { name: 'PBKDF2', outputBits: 'Variable', status: 'secure', use: 'Password hashing', notes: 'NIST recommended; use high iteration count (600k+ for SHA-256)' },
  { name: 'bcrypt', outputBits: '192-bit', status: 'secure', use: 'Password storage', notes: 'Adaptive work factor; resists GPU cracking' },
  { name: 'Argon2', outputBits: 'Variable', status: 'secure', use: 'Password hashing (modern best)', notes: 'PHC winner; memory-hard; prefer Argon2id' },
  { name: 'RIPEMD-160', outputBits: '160-bit', status: 'neutral', use: 'Bitcoin addresses', notes: 'European alternative to SHA; rarely tested' },
];

export const AUTH_PROTOCOLS: AuthEntry[] = [
  { name: 'RADIUS', port: '1812/1813 UDP', type: 'AAA', status: 'secure', notes: 'Encrypts only password field; used for 802.1X Wi-Fi & VPN' },
  { name: 'TACACS+', port: '49 TCP', type: 'AAA', status: 'secure', notes: 'Encrypts entire body; separates Auth/Authz/Acct; Cisco standard' },
  { name: 'Kerberos', port: '88 TCP/UDP', type: 'Authentication', status: 'secure', notes: 'Ticket-based SSO; KDC issues TGT; used in Active Directory' },
  { name: 'LDAP', port: '389 TCP', type: 'Directory', status: 'insecure', notes: 'Cleartext queries; use LDAPS (636) or STARTTLS' },
  { name: 'LDAPS', port: '636 TCP', type: 'Directory', status: 'secure', notes: 'LDAP over TLS; preferred for AD authentication' },
  { name: 'SAML 2.0', port: 'HTTP/HTTPS', type: 'Federation (SSO)', status: 'secure', notes: 'XML-based; used for enterprise SSO between IdP and SP' },
  { name: 'OAuth 2.0', port: 'HTTPS', type: 'Authorization', status: 'secure', notes: 'Delegates authorization; not authentication by itself' },
  { name: 'OpenID Connect', port: 'HTTPS', type: 'Auth + Authorization', status: 'secure', notes: 'Identity layer on OAuth 2.0; issues ID tokens (JWT)' },
  { name: 'PAP', port: 'PPP', type: 'Authentication', status: 'insecure', notes: 'Passwords sent in cleartext; obsolete' },
  { name: 'CHAP', port: 'PPP', type: 'Authentication', status: 'neutral', notes: 'Challenge-response; never sends password; MS-CHAPv2 is weak' },
  { name: 'EAP-TLS', port: '802.1X', type: 'Authentication', status: 'secure', notes: 'Mutual certificate auth; strongest EAP method' },
  { name: 'EAP-TTLS', port: '802.1X', type: 'Authentication', status: 'secure', notes: 'TLS tunnel, inner auth can be password-based' },
  { name: 'PEAP', port: '802.1X', type: 'Authentication', status: 'secure', notes: 'MS-developed; TLS tunnel for inner EAP (usually EAP-MSCHAPv2)' },
  { name: 'EAP-FAST', port: '802.1X', type: 'Authentication', status: 'secure', notes: 'Cisco; uses PAC instead of certs; faster than EAP-TLS' },
  { name: 'NTLM', port: 'Windows', type: 'Authentication', status: 'deprecated', notes: 'Legacy Windows auth; vulnerable to pass-the-hash; use Kerberos' },
];

export const VPN_PROTOCOLS: AuthEntry[] = [
  { name: 'IPSec (IKEv2)', port: '500/4500 UDP', type: 'VPN/Tunneling', status: 'secure', notes: 'IKEv2 + IPSec; mobile-friendly (MOBIKE); Suite B compliant' },
  { name: 'IPSec AH', port: '500 UDP (proto 51)', type: 'VPN', status: 'neutral', notes: 'Integrity + auth only; no encryption. Often replaced by ESP' },
  { name: 'IPSec ESP', port: '500 UDP (proto 50)', type: 'VPN', status: 'secure', notes: 'Encryption + integrity; AES-GCM preferred mode' },
  { name: 'SSL/TLS VPN', port: '443 TCP', type: 'VPN', status: 'secure', notes: 'Works through firewalls; clientless via browser portal' },
  { name: 'OpenVPN', port: '1194 UDP/TCP', type: 'VPN', status: 'secure', notes: 'Open-source TLS-based; very flexible; widely trusted' },
  { name: 'WireGuard', port: '51820 UDP', type: 'VPN', status: 'secure', notes: 'Modern, minimal codebase; ChaCha20-Poly1305 + Curve25519' },
  { name: 'L2TP/IPSec', port: '1701/500/4500 UDP', type: 'VPN', status: 'neutral', notes: 'L2TP tunneling + IPSec encryption; double-encapsulation overhead' },
  { name: 'PPTP', port: '1723 TCP', type: 'VPN', status: 'deprecated', notes: 'MS-CHAPv2 broken; do not use' },
  { name: 'GRE', port: 'Protocol 47', type: 'Tunneling', status: 'neutral', notes: 'No encryption; used to carry other protocols; pair with IPSec' },
];

export const WIRELESS: AuthEntry[] = [
  { name: 'WEP', port: 'N/A', type: 'Wireless Security', status: 'insecure', notes: 'RC4 + weak IVs; crackable in minutes; never use' },
  { name: 'WPA (TKIP)', port: 'N/A', type: 'Wireless Security', status: 'deprecated', notes: 'Improved IVs over WEP; TKIP deprecated; vulnerable' },
  { name: 'WPA2-Personal', port: 'N/A', type: 'Wireless Security', status: 'secure', notes: 'PSK with AES-CCMP; secure if passphrase is strong' },
  { name: 'WPA2-Enterprise', port: '802.1X', type: 'Wireless Security', status: 'secure', notes: 'RADIUS + EAP; per-user credentials; enterprise standard' },
  { name: 'WPA3-Personal', port: 'N/A', type: 'Wireless Security', status: 'secure', notes: 'SAE (Dragonfly) replaces PSK; protects against offline dict attacks' },
  { name: 'WPA3-Enterprise', port: '802.1X', type: 'Wireless Security', status: 'secure', notes: '192-bit mode for high security; GCMP-256 + SHA-384' },
  { name: 'WPS', port: 'N/A', type: 'Wireless Setup', status: 'insecure', notes: 'PIN brute-force attack (Reaver); disable on all access points' },
  { name: '802.1X / NAC', port: 'RADIUS', type: 'Network Access Control', status: 'secure', notes: 'Port-based auth; blocks unauthorized devices at switch level' },
];

export const RISK_FORMULAS: FormulaEntry[] = [
  { name: 'SLE (Single Loss Expectancy)', formula: 'SLE = AV × EF', variables: 'AV = Asset Value · EF = Exposure Factor (% of asset lost in one incident)', example: 'A $50,000 server with a 40% EF → SLE = $20,000' },
  { name: 'ALE (Annualized Loss Expectancy)', formula: 'ALE = SLE × ARO', variables: 'SLE = Single Loss Expectancy · ARO = Annualized Rate of Occurrence', example: 'SLE of $20,000 with ARO 0.5 (once every 2 years) → ALE = $10,000' },
  { name: 'ARO (Annualized Rate of Occurrence)', formula: 'Expected number of occurrences per year', variables: 'Often a decimal for rare events (0.2 = once every 5 years)', example: 'A flood expected once every 10 years → ARO = 0.1' },
  { name: 'EF (Exposure Factor)', formula: 'EF = asset value lost ÷ total asset value', variables: 'Expressed as a percentage, 0–100%', example: 'A fire destroys 60% of a warehouse\'s value → EF = 0.6' },
  { name: 'Qualitative vs Quantitative Assessment', formula: 'Ranking method, not a formula', variables: 'Qualitative: High/Medium/Low judgment ratings · Quantitative: dollar figures via SLE/ALE/ARO', example: 'Qualitative: "this vendor risk is High." Quantitative: "this risk costs $10,000/year (ALE)."' },
];

export const BCDR_METRICS: MetricEntry[] = [
  { abbr: 'RTO', name: 'Recovery Time Objective', definition: 'The maximum acceptable TIME to restore a system or process after a disruption', example: 'RTO = 4 hours → the system must be back online within 4 hours of an outage' },
  { abbr: 'RPO', name: 'Recovery Point Objective', definition: 'The maximum acceptable DATA LOSS, measured as time since the last good backup', example: 'RPO = 1 hour → backups must run at least hourly so no more than 1 hour of data is ever lost' },
  { abbr: 'MTBF', name: 'Mean Time Between Failures', definition: 'Average operating time between one failure and the next, for a repairable system — a reliability measure', example: 'A server with MTBF 20,000 hours is expected to fail roughly once every 20,000 operating hours' },
  { abbr: 'MTTR', name: 'Mean Time To Repair', definition: 'The average time needed to repair a failed system and return it to service', example: 'MTTR of 2 hours means technicians typically restore service within 2 hours of a failure' },
  { abbr: 'MTTF', name: 'Mean Time To Failure', definition: 'Like MTBF but for NON-repairable components — average lifespan before a one-time failure', example: 'A drive rated for 1,000,000-hour MTTF is replaced, not repaired, when it fails' },
];

export const BACKUP_TYPES: RefEntry[] = [
  { name: 'Full Backup', summary: 'Copies ALL selected data every time', detail: 'Fastest restore (single backup set) but slowest and most storage-heavy to create; typically the weekly/baseline backup', status: 'neutral' },
  { name: 'Incremental Backup', summary: 'Copies only data changed since the LAST backup (full or incremental)', detail: 'Fastest and smallest backup to create, but restore needs the last full backup PLUS every incremental since — slowest restore chain', status: 'neutral' },
  { name: 'Differential Backup', summary: 'Copies all data changed since the LAST FULL backup', detail: 'Grows larger each day until the next full; restore only needs the last full + latest differential — a middle ground on speed and storage', status: 'neutral' },
  { name: 'Snapshot', summary: 'A point-in-time image of an entire system or virtual disk', detail: 'Near-instant to create (copy-on-write on VMs/storage arrays) but typically not a substitute for true off-site backups', status: 'neutral' },
  { name: '3-2-1 Backup Rule', summary: '3 copies of data, on 2 different media types, with 1 copy off-site', detail: 'The standard industry guideline for backup resilience — protects against media failure, site disaster, and ransomware that targets connected backups', status: 'secure' },
];

export const RAID_LEVELS: RaidEntry[] = [
  { level: 'RAID 0', minDisks: '2', faultTolerance: 'None — any disk failure loses all data', performance: 'Best (striping, no redundancy overhead)', notes: 'Speed only (e.g. scratch/cache volumes); never for data you can\'t lose' },
  { level: 'RAID 1', minDisks: '2', faultTolerance: 'Survives 1 disk failure (mirroring)', performance: 'Good read, write = single-disk speed', notes: 'Simple mirror — 50% storage efficiency' },
  { level: 'RAID 5', minDisks: '3', faultTolerance: 'Survives 1 disk failure (distributed parity)', performance: 'Good read, write penalty from parity calc', notes: 'Most common balance of cost/redundancy; rebuild-time risk on large drives' },
  { level: 'RAID 6', minDisks: '4', faultTolerance: 'Survives 2 disk failures (double distributed parity)', performance: 'Similar to RAID 5, slightly more write overhead', notes: 'Preferred over RAID 5 for large drives where rebuild time is longer' },
  { level: 'RAID 10 (1+0)', minDisks: '4', faultTolerance: 'Survives multiple failures as long as not both disks in the same mirrored pair', performance: 'Best redundancy + performance combination', notes: 'Mirroring + striping; 50% efficiency but fast and resilient — common for databases' },
];

export const ACCESS_MODELS: RefEntry[] = [
  { name: 'DAC (Discretionary Access Control)', summary: 'The data OWNER decides who gets access', detail: 'Flexible but weak central control — common in Windows NTFS permissions; vulnerable to owners granting excessive access', status: 'neutral' },
  { name: 'MAC (Mandatory Access Control)', summary: 'A central authority assigns access based on classification LABELS (e.g. Confidential, Secret)', detail: 'Users and data both get labels/clearances; the system enforces access, not the owner — used in military/government systems (e.g. SELinux)', status: 'secure' },
  { name: 'RBAC (Role-Based Access Control)', summary: 'Access is granted based on a user\'s ROLE/job function', detail: 'Most common enterprise model — simplifies onboarding/offboarding since permissions attach to a role, not an individual', status: 'secure' },
  { name: 'ABAC (Attribute-Based Access Control)', summary: 'Access decisions use multiple ATTRIBUTES (user, resource, environment, time)', detail: 'Most granular/flexible model — e.g. allow if department=Finance AND time=business-hours AND device=managed; basis of Zero Trust policy engines', status: 'secure' },
  { name: 'Rule-Based Access Control', summary: 'Access follows explicit IF-THEN rules configured by an administrator', detail: 'Often layered on another model — e.g. firewall ACLs are rule-based; not tied to identity at all', status: 'neutral' },
];

export const IR_PHASES: ProcessStepEntry[] = [
  { order: 1, phase: 'Preparation', description: 'Build the capability to respond BEFORE an incident happens', keyActivities: 'IR policy & plan, playbooks/runbooks, training, tooling, contact lists, tabletop exercises' },
  { order: 2, phase: 'Detection', description: 'Identify that a security incident may be occurring', keyActivities: 'SIEM alerts, IDS/IPS, user reports, anomaly detection, log review' },
  { order: 3, phase: 'Analysis', description: 'Confirm and scope the incident — what happened, what\'s affected', keyActivities: 'Triage, correlate indicators of compromise (IOCs), determine severity, find root cause' },
  { order: 4, phase: 'Containment', description: 'Stop the incident from spreading further', keyActivities: 'Short-term: isolate affected hosts/segments. Long-term: patch, rebuild, rotate credentials' },
  { order: 5, phase: 'Eradication', description: 'Remove the threat completely from the environment', keyActivities: 'Remove malware, disable breached accounts, close the exploited vulnerability' },
  { order: 6, phase: 'Recovery', description: 'Restore affected systems to normal operation', keyActivities: 'Restore from clean backups, monitor closely for reinfection, phased return to production' },
  { order: 7, phase: 'Post-Incident Activity (Lessons Learned)', description: 'Review the response and improve for next time', keyActivities: 'Root cause analysis, lessons-learned report, update playbooks, evidence retention' },
];

export const CLOUD_MODELS: RefEntry[] = [
  { name: 'IaaS', category: 'Service Model', summary: 'Infrastructure as a Service — rent raw compute, storage, networking', detail: 'You manage OS, runtime, and apps; provider manages hardware/virtualization. e.g. AWS EC2, Azure VMs', status: 'neutral' },
  { name: 'PaaS', category: 'Service Model', summary: 'Platform as a Service — rent a platform to deploy your own code', detail: 'Provider manages OS/runtime; you manage your application and data. e.g. Heroku, Azure App Service', status: 'neutral' },
  { name: 'SaaS', category: 'Service Model', summary: 'Software as a Service — rent a complete, ready-to-use application', detail: 'Provider manages everything except your data and user access config. e.g. Gmail, Salesforce, Office 365', status: 'neutral' },
  { name: 'Public Cloud', category: 'Deployment Model', summary: 'Shared infrastructure, owned/operated by a third party, open to any customer', detail: 'Lowest cost, fastest to scale; least control over underlying infrastructure', status: 'neutral' },
  { name: 'Private Cloud', category: 'Deployment Model', summary: 'Dedicated infrastructure used by a single organization', detail: 'Highest control and customization; higher cost — can be on-prem or hosted exclusively for one tenant', status: 'secure' },
  { name: 'Hybrid Cloud', category: 'Deployment Model', summary: 'A mix of private and public cloud, with data/apps able to move between them', detail: 'Common pattern: sensitive workloads stay private, burst capacity uses public cloud', status: 'neutral' },
  { name: 'Community Cloud', category: 'Deployment Model', summary: 'Shared infrastructure for a specific group of organizations with common concerns', detail: 'e.g. several government agencies sharing a cloud built to a common compliance standard', status: 'neutral' },
];

export const COMPLIANCE_FRAMEWORKS: RefEntry[] = [
  { name: 'GDPR', summary: 'General Data Protection Regulation — EU personal data privacy law', detail: 'Applies to any org handling EU residents\' data regardless of where the org is based; includes the "right to be forgotten"', status: 'neutral' },
  { name: 'HIPAA', summary: 'Health Insurance Portability and Accountability Act (US)', detail: 'Protects patient health information (PHI); applies to healthcare providers, insurers, and their business associates', status: 'neutral' },
  { name: 'PCI DSS', summary: 'Payment Card Industry Data Security Standard', detail: 'Required for any organization that stores, processes, or transmits credit card data — a contractual/industry requirement, not a law', status: 'neutral' },
  { name: 'SOX', summary: 'Sarbanes-Oxley Act (US)', detail: 'Financial reporting integrity for public companies, passed after accounting scandals; includes IT controls over financial systems', status: 'neutral' },
  { name: 'ISO 27001', summary: 'International standard for an Information Security Management System (ISMS)', detail: 'Certifiable standard — an organization can be formally audited and certified as ISO 27001 compliant', status: 'neutral' },
  { name: 'NIST CSF', summary: 'NIST Cybersecurity Framework — Identify, Protect, Detect, Respond, Recover', detail: 'Voluntary US framework; widely used as a common language for describing an organization\'s security maturity', status: 'neutral' },
];

export const ATTACK_FRAMEWORKS: RefEntry[] = [
  { name: 'MITRE ATT&CK', summary: 'A knowledge base of real-world adversary Tactics, Techniques, and Procedures (TTPs)', detail: 'Organized as a matrix (tactics = columns, techniques = cells); used for threat hunting, red/blue team exercises, and detection engineering', status: 'neutral' },
  { name: 'Cyber Kill Chain', summary: 'Lockheed Martin\'s 7-stage attack model: Recon, Weaponization, Delivery, Exploitation, Installation, C2, Actions on Objectives', detail: 'Defenders aim to break the chain at the EARLIEST possible stage — the further right an attack gets, the more damage is done', status: 'neutral' },
  { name: 'Diamond Model', summary: 'Models an intrusion as 4 connected points: Adversary, Infrastructure, Capability, Victim', detail: 'Used to pivot between known facts about an attack to uncover related infrastructure/campaigns — complements the Kill Chain and ATT&CK', status: 'neutral' },
];

export const PKI_REFERENCE: RefEntry[] = [
  { name: 'CA (Certificate Authority)', summary: 'The trusted entity that issues and signs digital certificates', detail: 'Root CAs sign intermediate CAs, which sign end-entity certificates — forming the chain of trust', status: 'secure' },
  { name: 'CSR (Certificate Signing Request)', summary: 'A request sent TO a CA containing a public key and identity info, asking for a signed certificate', detail: 'Generated by the applicant using their private key; the CA verifies identity before issuing the certificate', status: 'neutral' },
  { name: 'CRL (Certificate Revocation List)', summary: 'A published list of certificates the CA has revoked before their expiration date', detail: 'Clients must download/check the whole list — slower than OCSP; certificates are revoked for reasons like key compromise', status: 'neutral' },
  { name: 'OCSP (Online Certificate Status Protocol)', summary: 'A real-time protocol to check if a SINGLE certificate has been revoked', detail: 'Faster than CRL since it checks one certificate instead of a whole list; OCSP stapling lets the server provide this proof itself', status: 'secure' },
  { name: 'Chain of Trust', summary: 'The linked path from a root CA down to an end-entity certificate', detail: 'A certificate is only trusted if every link up to a trusted root is valid and unexpired', status: 'secure' },
];

export const MFA_FACTORS: RefEntry[] = [
  { name: 'Something You Know', summary: 'A memorized secret — password, PIN, or security question answer', detail: 'The weakest factor alone since it can be guessed, phished, or shared; always pair with another factor for true MFA', status: 'neutral' },
  { name: 'Something You Have', summary: "A physical item in the user's possession — hardware token, smart card, or authenticator app", detail: 'Can be lost or stolen, but defeats remote-only attacks since the attacker needs physical access to the item', status: 'secure' },
  { name: 'Something You Are', summary: 'A biometric trait — fingerprint, face, iris, or voice', detail: 'Cannot be changed if compromised (unlike a password); false acceptance/rejection rates (FRR) matter for accuracy', status: 'secure' },
  { name: 'Somewhere You Are', summary: 'Location-based verification — GPS coordinates, IP geolocation, or a specific network', detail: 'Often used as a risk signal (e.g. impossible travel detection) rather than a primary standalone factor', status: 'neutral' },
];

export const SITE_TYPES: SiteEntry[] = [
  { type: 'Hot Site', recoveryTime: 'Minutes to hours', cost: 'Highest', description: 'A fully equipped, continuously running duplicate of the production environment, kept in sync in near real-time' },
  { type: 'Warm Site', recoveryTime: 'Hours to a day', cost: 'Moderate', description: 'Has hardware and connectivity ready, but data/systems need to be restored or synced before go-live' },
  { type: 'Cold Site', recoveryTime: 'Days to weeks', cost: 'Lowest', description: 'Just a physical space with power and connectivity — all equipment and data must be brought in and configured from scratch' },
];

export const THREAT_ACTORS: ThreatActorEntry[] = [
  { name: 'Nation-state', sophistication: 'Very High', resources: 'Extensive — government funding, dedicated teams', motivation: 'Espionage, geopolitical advantage, warfare', notes: 'Associated with APTs; patient, well-funded, and the hardest to detect and attribute' },
  { name: 'Organized crime', sophistication: 'High', resources: 'Well-funded, often run like a business', motivation: 'Financial gain', notes: 'Runs ransomware-as-a-service, sells stolen data — highly profit-driven' },
  { name: 'Hacktivist', sophistication: 'Varies (typically Low–Medium)', resources: 'Limited, volunteer-based', motivation: 'Philosophical or political beliefs', notes: 'Favors defacement, DDoS, and leaks to make a public statement rather than steal money' },
  { name: 'Insider threat', sophistication: 'Varies', resources: 'Already has legitimate access', motivation: 'Revenge, financial gain, ideology, or unintentional negligence', notes: 'Hardest to catch with perimeter defenses since they start with authorized access; can be malicious or accidental' },
  { name: 'Unskilled attacker', sophistication: 'Low', resources: 'Minimal — uses pre-built tools/scripts', motivation: 'Thrill, reputation, curiosity', notes: "Also called a 'script kiddie'; relies entirely on tools written by others" },
  { name: 'Shadow IT', sophistication: 'N/A — not malicious', resources: "Whatever a department can access on its own", motivation: 'Convenience — bypassing slow official IT processes', notes: 'Not an attacker, but a risk source: unauthorized apps/hardware deployed outside IT\'s visibility and control' },
];

export const DATA_CLASSIFICATIONS: RefEntry[] = [
  { name: 'Public', summary: 'Information approved for public release with no restrictions', detail: 'e.g. marketing materials, press releases — the lowest classification level', status: 'neutral' },
  { name: 'Private', summary: 'Internal information not meant for public release but with limited sensitivity', detail: 'e.g. internal org charts, routine internal memos', status: 'neutral' },
  { name: 'Sensitive', summary: 'Information that could cause some harm to the organization if disclosed', detail: 'A broad middle tier — often used as a catch-all above Private and below Confidential', status: 'neutral' },
  { name: 'Confidential', summary: 'Information that would cause significant damage if disclosed — requires access controls', detail: 'e.g. financial records, trade secrets, PII; needs explicit authorization to access', status: 'neutral' },
  { name: 'Restricted', summary: 'Highly sensitive information limited to a specific, named group of people', detail: 'e.g. M&A plans, executive compensation; access is tightly audited and logged', status: 'neutral' },
  { name: 'Critical', summary: 'Information whose loss or disclosure would cause severe or existential harm to the organization', detail: 'e.g. encryption keys, core intellectual property — the highest classification tier', status: 'neutral' },
];

export const REPLACEMENTS: Array<{
  category: string;
  from: { name: string; port: string; why: string };
  to: { name: string; port: string; why: string };
  reason: string;
}> = [
  // ── Ports / Services ───────────────────────────────────────
  {
    category: 'Remote Access',
    from: { name: 'Telnet', port: 'TCP 23', why: 'Cleartext — credentials and data fully visible on wire' },
    to:   { name: 'SSH', port: 'TCP 22', why: 'Encrypted channel; supports key-based auth' },
    reason: 'Telnet sends everything in plaintext. An attacker with a packet sniffer captures your password immediately.'
  },
  {
    category: 'File Transfer',
    from: { name: 'FTP', port: 'TCP 20/21', why: 'Cleartext credentials + data; no integrity check' },
    to:   { name: 'SFTP / SCP', port: 'TCP 22 (SSH)', why: 'Full encryption over SSH; same port, no extra config' },
    reason: 'FTP was designed in 1971. Use SFTP (SSH file transfer) or SCP for encrypted transfers, or FTPS (989/990) for TLS-wrapped FTP.'
  },
  {
    category: 'Web Traffic',
    from: { name: 'HTTP', port: 'TCP 80', why: 'Cleartext — passwords, cookies, content all exposed' },
    to:   { name: 'HTTPS', port: 'TCP 443', why: 'TLS 1.2/1.3 encrypts everything; certificate authenticates server' },
    reason: 'HTTP carries no encryption. HTTPS with TLS 1.3 + HSTS is the only acceptable standard for any site handling users.'
  },
  {
    category: 'Email — Retrieval',
    from: { name: 'POP3', port: 'TCP 110', why: 'Cleartext; downloads mail then deletes from server' },
    to:   { name: 'POP3S', port: 'TCP 995', why: 'POP3 over TLS — same behaviour, encrypted' },
    reason: 'POP3 on port 110 sends your username/password in plain text. Port 995 wraps the same protocol in TLS.'
  },
  {
    category: 'Email — Retrieval',
    from: { name: 'IMAP', port: 'TCP 143', why: 'Cleartext; mail left on server but credentials exposed' },
    to:   { name: 'IMAPS', port: 'TCP 993', why: 'IMAP over TLS — server-side mail access, encrypted' },
    reason: 'IMAP is superior to POP3 for multi-device use but shares the same plaintext problem on port 143.'
  },
  {
    category: 'Email — Sending',
    from: { name: 'SMTP (relay)', port: 'TCP 25', why: 'Unencrypted relay; used for server-to-server; open relays allow spam' },
    to:   { name: 'SMTP Submission + STARTTLS', port: 'TCP 587', why: 'Client mail submission; STARTTLS upgrades to TLS; requires auth' },
    reason: 'Port 25 is for MTA-to-MTA relay and is commonly blocked by ISPs. Client-to-server submission uses 587 with mandatory STARTTLS.'
  },
  {
    category: 'Directory Services',
    from: { name: 'LDAP', port: 'TCP 389', why: 'Cleartext directory queries and bind credentials' },
    to:   { name: 'LDAPS', port: 'TCP 636', why: 'LDAP wrapped in TLS from connection start' },
    reason: 'LDAP credentials (including AD service accounts) are exposed on port 389. Use LDAPS or LDAP+STARTTLS for all directory queries.'
  },
  {
    category: 'Logging',
    from: { name: 'Syslog (UDP)', port: 'UDP 514', why: 'No auth, no encryption, no delivery guarantee; logs can be forged' },
    to:   { name: 'Syslog over TLS', port: 'TCP 6514', why: 'RFC 5425 — mutual TLS auth, encrypted, TCP delivery' },
    reason: 'Plain Syslog lets attackers read your logs or inject fake entries. TLS syslog prevents both and adds delivery guarantees.'
  },
  {
    category: 'Network Management',
    from: { name: 'SNMPv1 / SNMPv2c', port: 'UDP 161/162', why: 'Community strings sent in cleartext; "public" is default' },
    to:   { name: 'SNMPv3', port: 'UDP 161/162', why: 'Adds authentication (SHA) + encryption (AES); per-user security' },
    reason: 'SNMP community strings are essentially cleartext passwords. SNMPv3 is the only version that provides real authentication and encryption.'
  },
  {
    category: 'Remote Desktop',
    from: { name: 'VNC (unauthenticated/cleartext)', port: 'TCP 5900', why: 'Often no auth or weak password; screen data unencrypted' },
    to:   { name: 'VNC over SSH tunnel', port: 'TCP 22', why: 'Bind VNC to localhost, forward through encrypted SSH' },
    reason: 'VNC has no built-in encryption. Always tunnel it through SSH (ssh -L 5901:localhost:5900 ...) or use RDP with NLA instead.'
  },
  // ── VPN / Tunneling ────────────────────────────────────────
  {
    category: 'VPN',
    from: { name: 'PPTP', port: 'TCP 1723', why: 'MS-CHAPv2 is trivially crackable; data encryption is weak' },
    to:   { name: 'IKEv2/IPSec or WireGuard', port: 'UDP 500+4500 / UDP 51820', why: 'Strong encryption, forward secrecy, modern cipher suites' },
    reason: 'PPTP was cracked by cloudcracker / asleap attacks. Its MS-CHAPv2 handshake can be captured and cracked offline in hours.'
  },
  // ── Wireless ───────────────────────────────────────────────
  {
    category: 'Wireless Security',
    from: { name: 'WEP', port: 'N/A', why: 'RC4 with static IV reuse; crack in minutes with aircrack-ng' },
    to:   { name: 'WPA3', port: 'N/A', why: 'SAE handshake; brute-force protection; forward secrecy' },
    reason: 'WEP reuses 24-bit IVs — collect ~50k packets and the key falls out. WPA2 is the minimum acceptable; WPA3 is the target.'
  },
  {
    category: 'Wireless Security',
    from: { name: 'WPA / TKIP', port: 'N/A', why: 'TKIP is a patch for WEP hardware; known attacks (TKIP MIC)' },
    to:   { name: 'WPA2-Enterprise (AES-CCMP)', port: '802.1X', why: 'Per-user creds via RADIUS + EAP; no shared passphrase' },
    reason: 'WPA-TKIP was a stop-gap. WPA2 with AES-CCMP is the current minimum; WPA3-Enterprise with 192-bit mode is preferred for corporate.'
  },
  {
    category: 'Wireless Setup',
    from: { name: 'WPS (PIN method)', port: 'N/A', why: '8-digit PIN splits into two 4-digit halves = 11,000 guesses max' },
    to:   { name: 'Disable WPS entirely', port: 'N/A', why: 'No substitute needed — use WPA3 passphrase setup' },
    reason: 'Reaver exploits the WPS PIN split to brute-force the passphrase in under 8 hours. Disable WPS on every access point.'
  },
  // ── Authentication ─────────────────────────────────────────
  {
    category: 'Authentication',
    from: { name: 'PAP', port: 'PPP', why: 'Password sent in cleartext; zero protection' },
    to:   { name: 'EAP-TLS', port: '802.1X', why: 'Mutual certificate-based auth; nothing sensitive on the wire' },
    reason: 'PAP is the original PPP auth method and transmits passwords as plaintext. EAP-TLS uses certificates and a TLS tunnel instead.'
  },
  {
    category: 'Authentication',
    from: { name: 'NTLM', port: 'Windows SMB/HTTP', why: 'Pass-the-hash, relay attacks; no mutual auth' },
    to:   { name: 'Kerberos', port: 'TCP/UDP 88', why: 'Ticket-based; mutual auth; no password on wire; PKI option' },
    reason: 'NTLM hashes can be captured and replayed directly without cracking (pass-the-hash). Kerberos is the Active Directory default since Windows 2000.'
  },
  // ── Ciphers ────────────────────────────────────────────────
  {
    category: 'Symmetric Encryption',
    from: { name: 'DES', port: '56-bit key', why: 'Brute-forced in 22 hours in 1999; trivial today' },
    to:   { name: 'AES-256', port: '256-bit key', why: 'No practical attack; NIST standard; hardware accelerated' },
    reason: 'DES has only 56 effective key bits. Modern CPUs can exhaust the keyspace in seconds. AES-256 with a random key is computationally secure.'
  },
  {
    category: 'Symmetric Encryption',
    from: { name: '3DES / TDEA', port: '112-bit effective', why: 'Sweet32 birthday attack at 64-bit block size; slow' },
    to:   { name: 'AES-128 / AES-256', port: '128 or 256-bit key', why: '128-bit block size eliminates Sweet32; 10× faster in hardware' },
    reason: '3DES was a bridge while AES was standardized. Its 64-bit block size allows Sweet32 attacks after ~32 GB of data on the same key.'
  },
  {
    category: 'Stream Cipher',
    from: { name: 'RC4', port: 'Variable key', why: 'Statistical biases in first bytes; BEAST, RC4 NOMORE attacks' },
    to:   { name: 'ChaCha20-Poly1305', port: '256-bit key', why: 'AEAD stream cipher; no IV reuse issues; fast in software' },
    reason: 'RC4 was banned from TLS by RFC 7465 after researchers demonstrated practical attacks. ChaCha20 is used in TLS 1.3 on mobile/embedded devices.'
  },
  // ── Hashing ────────────────────────────────────────────────
  {
    category: 'Hashing',
    from: { name: 'MD5', port: '128-bit output', why: 'Collision found in seconds; Flame malware forged MD5 certificate' },
    to:   { name: 'SHA-256', port: '256-bit output', why: 'No known collision; NIST standard; ubiquitous in TLS/code signing' },
    reason: 'MD5 collisions are trivially producible — two different files with identical MD5 hashes. Never use for certificate fingerprints, signatures, or passwords.'
  },
  {
    category: 'Hashing',
    from: { name: 'SHA-1', port: '160-bit output', why: 'SHAttered attack (2017) produced first collision for $110k in cloud compute' },
    to:   { name: 'SHA-256 / SHA-3', port: '256-bit output', why: 'SHA-2 family still secure; SHA-3 uses different algorithm (Keccak)' },
    reason: 'The Shattered attack proved SHA-1 collisions are practical. Major CAs stopped issuing SHA-1 certs in 2016; browsers reject them.'
  },
];
