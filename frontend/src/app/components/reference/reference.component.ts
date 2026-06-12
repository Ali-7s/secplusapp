import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';

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

@Component({
  selector: 'app-reference',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTabsModule, MatInputModule,
    MatFormFieldModule, MatIconModule, MatTooltipModule, MatChipsModule],
  templateUrl: './reference.component.html',
  styleUrl: './reference.component.scss'
})
export class ReferenceComponent {
  searchText = '';

  readonly PORTS: PortEntry[] = [
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
    { port: '989/990', protocol: 'FTPS', service: 'FTP over TLS', transport: 'TCP', status: 'secure', notes: 'Explicit (990) or implicit (989) TLS; not SFTP' },
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

  readonly CIPHERS: CipherEntry[] = [
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

  readonly HASHES: HashEntry[] = [
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

  readonly AUTH_PROTOCOLS: AuthEntry[] = [
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

  readonly VPN_PROTOCOLS: AuthEntry[] = [
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

  readonly WIRELESS: AuthEntry[] = [
    { name: 'WEP', port: 'N/A', type: 'Wireless Security', status: 'insecure', notes: 'RC4 + weak IVs; crackable in minutes; never use' },
    { name: 'WPA (TKIP)', port: 'N/A', type: 'Wireless Security', status: 'deprecated', notes: 'Improved IVs over WEP; TKIP deprecated; vulnerable' },
    { name: 'WPA2-Personal', port: 'N/A', type: 'Wireless Security', status: 'secure', notes: 'PSK with AES-CCMP; secure if passphrase is strong' },
    { name: 'WPA2-Enterprise', port: '802.1X', type: 'Wireless Security', status: 'secure', notes: 'RADIUS + EAP; per-user credentials; enterprise standard' },
    { name: 'WPA3-Personal', port: 'N/A', type: 'Wireless Security', status: 'secure', notes: 'SAE (Dragonfly) replaces PSK; protects against offline dict attacks' },
    { name: 'WPA3-Enterprise', port: '802.1X', type: 'Wireless Security', status: 'secure', notes: '192-bit mode for high security; GCMP-256 + SHA-384' },
    { name: 'WPS', port: 'N/A', type: 'Wireless Setup', status: 'insecure', notes: 'PIN brute-force attack (Reaver); disable on all access points' },
    { name: '802.1X / NAC', port: 'RADIUS', type: 'Network Access Control', status: 'secure', notes: 'Port-based auth; blocks unauthorized devices at switch level' },
  ];

  get filteredPorts(): PortEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.PORTS;
    return this.PORTS.filter(p =>
      p.port.includes(q) || p.protocol.toLowerCase().includes(q) ||
      p.service.toLowerCase().includes(q) || p.notes.toLowerCase().includes(q) ||
      p.transport.toLowerCase().includes(q)
    );
  }

  get filteredCiphers(): CipherEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.CIPHERS;
    return this.CIPHERS.filter(c =>
      c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q) ||
      c.use.toLowerCase().includes(q) || c.notes.toLowerCase().includes(q)
    );
  }

  get filteredHashes(): HashEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.HASHES;
    return this.HASHES.filter(h =>
      h.name.toLowerCase().includes(q) || h.use.toLowerCase().includes(q) ||
      h.notes.toLowerCase().includes(q)
    );
  }

  get filteredAuth(): AuthEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.AUTH_PROTOCOLS;
    return this.AUTH_PROTOCOLS.filter(a =>
      a.name.toLowerCase().includes(q) || a.port.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) || a.notes.toLowerCase().includes(q)
    );
  }

  get filteredVpn(): AuthEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.VPN_PROTOCOLS;
    return this.VPN_PROTOCOLS.filter(a =>
      a.name.toLowerCase().includes(q) || a.port.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) || a.notes.toLowerCase().includes(q)
    );
  }

  get filteredWireless(): AuthEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.WIRELESS;
    return this.WIRELESS.filter(a =>
      a.name.toLowerCase().includes(q) || a.port.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) || a.notes.toLowerCase().includes(q)
    );
  }

  readonly REPLACEMENTS: Array<{
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

  get filteredReplacements() {
    const q = this.searchText.toLowerCase();
    if (!q) return this.REPLACEMENTS;
    return this.REPLACEMENTS.filter(r =>
      r.from.name.toLowerCase().includes(q) || r.to.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q) ||
      r.from.port.toLowerCase().includes(q) || r.to.port.toLowerCase().includes(q)
    );
  }

  get replacementCategories(): string[] {
    return [...new Set(this.REPLACEMENTS.map(r => r.category))];
  }

  getReplacementsForCategory(cat: string) {
    return this.filteredReplacements.filter(r => r.category === cat);
  }

  // ── Recall Drill ───────────────────────────────────────────
  drillActive = false;
  drillTabName = '';
  drillLabel = '';
  drillItems: { question: string; hint: string; answer: string; explanation: string; status: string }[] = [];
  drillIdx = 0;
  drillInput = '';
  drillChecked = false;
  drillCorrect = false;
  drillScore = 0;
  drillFinished = false;

  get drillItem() { return this.drillItems[this.drillIdx]; }
  get drillProgress() { return this.drillItems.length ? (this.drillIdx / this.drillItems.length) * 100 : 0; }

  startDrill(tabKey: string, tabLabel: string) {
    const items = this.generateDrillItems(tabKey);
    if (!items.length) return;
    this.drillTabName = tabKey;
    this.drillLabel = tabLabel;
    this.drillItems = this.shuffle(items);
    this.drillIdx = 0;
    this.drillInput = '';
    this.drillChecked = false;
    this.drillCorrect = false;
    this.drillScore = 0;
    this.drillFinished = false;
    this.drillActive = true;
  }

  private generateDrillItems(key: string) {
    switch (key) {
      case 'ports':
        return this.PORTS.map(p => ({
          question: p.protocol,
          hint: `${p.service} · ${p.transport}`,
          answer: p.port,
          explanation: p.notes,
          status: p.status
        }));
      case 'ciphers':
        return this.CIPHERS.map(c => ({
          question: c.name,
          hint: `${c.type} · Used for: ${c.use}`,
          answer: c.keySize,
          explanation: c.notes,
          status: c.status
        }));
      case 'hashes':
        return this.HASHES.map(h => ({
          question: h.name,
          hint: `Used for: ${h.use}`,
          answer: h.outputBits,
          explanation: h.notes,
          status: h.status
        }));
      case 'auth':
        return this.AUTH_PROTOCOLS.map(a => ({
          question: a.name,
          hint: a.type,
          answer: a.port,
          explanation: a.notes,
          status: a.status
        }));
      case 'vpn':
        return this.VPN_PROTOCOLS.map(v => ({
          question: v.name,
          hint: v.type,
          answer: v.port,
          explanation: v.notes,
          status: v.status
        }));
      case 'wireless':
        return this.WIRELESS.map(w => ({
          question: w.name,
          hint: w.notes,
          answer: this.statusLabel(w.status),
          explanation: w.notes,
          status: w.status
        }));
      case 'legacy':
        return this.REPLACEMENTS.map(r => ({
          question: r.from.name,
          hint: `${r.from.port} · ${r.from.why}`,
          answer: r.to.name,
          explanation: `${r.to.name} (${r.to.port}): ${r.to.why}`,
          status: 'neutral'
        }));
      default:
        return [];
    }
  }

  submitDrill() {
    if (this.drillChecked || !this.drillInput.trim()) return;
    this.drillChecked = true;
    this.drillCorrect = this.matchAnswer(this.drillInput, this.drillItem.answer);
    if (this.drillCorrect) this.drillScore++;
  }

  nextDrill() {
    if (this.drillIdx < this.drillItems.length - 1) {
      this.drillIdx++;
      this.drillInput = '';
      this.drillChecked = false;
      this.drillCorrect = false;
    } else {
      this.drillFinished = true;
    }
  }

  restartDrill() {
    this.startDrill(this.drillTabName, this.drillLabel);
  }

  exitDrill() {
    this.drillActive = false;
    this.drillItems = [];
  }

  private matchAnswer(input: string, correct: string): boolean {
    const u = input.trim().toLowerCase();
    const a = correct.toLowerCase();
    if (!u) return false;
    if (u === a) return true;
    // Digit match — for ports, key sizes, output bits
    const uNums: string[] = u.match(/\d+/g) ?? [];
    const aNums: string[] = a.match(/\d+/g) ?? [];
    if (uNums.length && aNums.length && uNums.some(n => aNums.includes(n))) return true;
    // Normalized name match
    const uNorm = u.replace(/[^a-z0-9]/g, '');
    const aNorm = a.replace(/[^a-z0-9]/g, '');
    if (uNorm.length >= 3 && (aNorm.includes(uNorm) || uNorm.includes(aNorm))) return true;
    return false;
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  statusLabel(s: string): string {
    return { secure: 'Secure', insecure: 'Weak/Insecure', deprecated: 'Deprecated', neutral: 'Context-dependent' }[s] ?? s;
  }
}
