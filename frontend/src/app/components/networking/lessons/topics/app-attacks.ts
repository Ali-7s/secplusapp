import { HuntRow, LessonBody } from '../../networking.model';
import { h, hunt, lab, mcq, recap, words } from '../dsl';

const ev = (id: string, time: string, source: string, host: string, event: string, detail?: string[]): HuntRow =>
  ({ id, source, cells: [id, time, source, host, event], detail });

/** A Tuesday at Fernco: one event for each indicator, with look-alikes that are harmless. */
const TUESDAY: HuntRow[] = [
  ev('1', '03:00:02', 'Backup', 'bk01', 'Nightly backup job started (scheduled daily at 03:00)'),
  ev('2', '03:12:44', 'Windows', 'fs01', '4624 logon user=a.ng type=10 (remote desktop) from=10.8.0.31',
    ['a.ng works in finance, Monday to Friday, 08:30 to 17:00.', 'No change request, no on-call rota, no earlier sign-in at this hour.']),
  ev('3', '03:58:31', 'Backup', 'bk01', 'Nightly backup completed: 412 GB'),
  ev('4', '04:20:10', 'SIEM', 'siem', 'Log source fw-edge resumed after 75 minutes with no events (usual rate: about 300 a minute)',
    ['The gap runs from 03:05 to 04:20.', 'No outage or maintenance was recorded for fw-edge.']),
  ev('5', '07:30:00', 'Monitoring', 'build-01', 'CPU 96% for 35 min, process=compiler, job=nightly-release (scheduled)'),
  ev('6', '08:02:15', 'Identity', 'idp', 'Sign-in success user=r.diaz src=198.51.100.40 geo=Lisbon, PT device=LT-221 mfa=approved'),
  ev('7', '08:05:40', 'Directory', 'dc01', 'Failed sign-in user=j.osei reason=bad password (attempt 1)'),
  ev('8', '08:05:52', 'Directory', 'dc01', 'Sign-in success user=j.osei'),
  ev('9', '08:31:09', 'Identity', 'idp', 'Sign-in success user=r.diaz src=203.0.113.88 geo=Singapore, SG device=unknown mfa=approved'),
  ev('10', '08:33:00', 'Identity', 'idp', 'Active sessions user=r.diaz count=2: LT-221 (Lisbon) and an unknown device (Singapore)'),
  ev('11', '08:40:12', 'Directory', 'dc01', '4740 account locked out user=k.park after 10 failed sign-ins in 90 s, via vpn-gw',
    ['k.park is on leave this week.', 'The helpdesk has had no call from k.park.']),
  ev('12', '09:10:33', 'Proxy', 'LT-221', 'BLOCKED by DLP: 2.1 GB upload to upload.dropzone.example containing 1,840 customer records, user=r.diaz'),
  ev('13', '09:12:01', 'Proxy', 'LT-114', 'BLOCKED category=gambling url=bets.example user=t.ward'),
  ev('14', '09:30:00', 'Monitoring', 'db02', 'CPU 99% for 50 min, process=kworkerds, outbound to pool.mine.example:3333',
    ['No job is scheduled on db02 at this time.', 'kworkerds is not an operating system process.']),
  ev('15', '10:05:20', 'Monitoring', 'fs01', 'Share \\\\fs01\\projects: 3,214 files cannot be opened; new extension .lkd'),
  ev('16', '10:15:00', 'Monitoring', 'web01', 'Health check failed: HTTP 503 (maintenance window 10:00 to 10:30, change CHG-311)'),
  ev('17', '10:42:00', 'Threat intel', 'feed', 'Leak site post: 1,200 fernco.example email addresses with passwords, dated today'),
  ev('18', '11:02:00', 'Antivirus', 'LT-114', 'Signature update installed'),
];

export const APP_ATTACKS: LessonBody = {
  goals: [
    'Escalate from an ordinary user to root three different ways, and from one customer to another, then close every path',
    'Forge requests from both sides: make a victim\'s browser send one (CSRF) and make a server fetch one (SSRF)',
    'Climb out of a download folder past weak filters, and see what a real path check and least privilege change',
    'Spot each indicator of malicious activity in a day of logs, and tell it from the harmless look-alike',
  ],
  blocks: [
    recap('Topic 15 attacked the network. Here the attacks are on systems and applications: getting more rights than you were given, and tricking software into acting for you. Then you hunt for the signs that any of it is happening.'),
    words(
      ['Root', 'The all-powerful administrator account on Linux; in Windows the equivalent is SYSTEM or a local administrator'],
      ['Vertical escalation', 'Gaining a higher level of rights, such as a user becoming an administrator'],
      ['Horizontal escalation', 'Reaching another account\'s data at the same level, such as one customer reading another\'s invoices'],
      ['Session cookie', 'The value a site stores in your browser after you sign in; the browser sends it with every request to that site'],
      ['Metadata service', 'An address inside a cloud server (169.254.169.254) that tells the server about itself, including its credentials'],
      ['Path traversal', 'Using ../ ("the folder above") in a file name to reach files outside the folder an app meant to serve'],
    ),

    h('Privilege escalation: from jo to root', { objective: '2.4', keep: 'Escalation abuses something privileged that a user can influence: a writable script root runs, a sudo rule on a program that can start a shell, an unpatched kernel, or an API that does not check ownership. Least privilege, patching, server-side authorization.' }),
    lab('privesc'),

    h('CSRF: the victim\'s browser sends it', { objective: '2.4', keep: 'CSRF makes a signed-in victim\'s browser send a request the attacker wrote; the cookie goes along automatically. SameSite=Lax stops cross-site POSTs but not clicked links. Anti-CSRF tokens or re-entering the password stop it all.' }),
    lab('csrf'),

    h('SSRF: the server fetches it', { objective: '2.4', keep: 'SSRF makes a server fetch an address the attacker chose, reaching what only the server can: metadata credentials, localhost admin pages, internal hosts. Block lists are spelled around; check the resolved destination on every redirect, or allow-list.' }),
    lab('ssrf'),

    h('Directory traversal: climb out of the folder', { objective: '2.4', keep: 'Traversal adds ../ to a file name to leave the intended folder. Removing or rejecting ../ is beaten by nesting (....//) and encoding (%2e%2e%2f). Resolve the real path and check where it lands; run the server with least privilege.' }),
    lab('traversal'),

    h('Indicators of malicious activity: a day of logs', { objective: '2.4', keep: 'Account lockout, concurrent sessions, impossible travel, blocked content, resource consumption, resource inaccessibility, out-of-cycle logging, missing logs, and published or documented leaks. Each has a harmless look-alike: check the context before raising the alarm.' }),
    hunt('SIEM: Tuesday at Fernco', 'siem', ['#', 'Time', 'Source', 'Host', 'Event'], TUESDAY, [
      { ask: 'Pin the **account lockout** that points at an attack.', answer: ['11'],
        hint: 'Filter on Directory. One mistyped password is normal; look for an account that was locked.',
        why: 'Ten failures in 90 seconds over the VPN, on an account whose owner is on leave: someone else is guessing k.park\'s password. The lockout stopped it, and is the signal.' },
      { ask: 'Pin the sign-in that shows **impossible travel**.', answer: ['9'],
        hint: 'Search for one user and compare where and when they signed in.',
        why: 'Lisbon at 08:02, Singapore at 08:31. Nobody covers 11,000 km in 29 minutes, so someone else has r.diaz\'s password, and got an MFA push approved too.' },
      { ask: 'Pin the event showing **concurrent session usage**.', answer: ['10'],
        hint: 'Look for one account that is signed in from more than one place at the same time.',
        why: 'r.diaz has two sessions open at once, one on their own laptop and one on an unknown device abroad. One person rarely needs two live sessions from different continents.' },
      { ask: 'Pin the **blocked content** that points at an attack, not just a policy breach.', answer: ['12'],
        hint: 'Filter on Proxy. Two things were blocked: which one is data leaving the company?',
        why: 'DLP stopped 1,840 customer records being uploaded to a file-sharing site, from the same r.diaz account that just signed in from Singapore: attempted exfiltration. The gambling block is a policy matter.' },
      { ask: 'Pin the **resource consumption** that points at malware.', answer: ['14'],
        hint: 'Filter on Monitoring. One CPU spike was a scheduled job; which one has no reason to happen?',
        why: 'db02 runs at 99% with an unknown process talking to a mining pool on port 3333: cryptojacking. The build server\'s spike is its scheduled nightly job.' },
      { ask: 'Pin the **resource inaccessibility** that points at an attack.', answer: ['15'],
        hint: 'Something could not be reached. Which outage was planned, and which one was not?',
        why: 'Thousands of files on a share suddenly cannot be opened and have a new extension: ransomware encrypting them. web01 was down inside an approved maintenance window.' },
      { ask: 'Pin the event that is **out-of-cycle logging**: activity at a time it should not happen.', answer: ['2'],
        hint: 'Look at the early hours. One job runs at 03:00 every night by design; what else happened then?',
        why: 'A finance user who works office hours opened a remote desktop session at 03:12, with no change or on-call reason. The 03:00 backup is on its schedule.' },
      { ask: 'Pin the event showing **missing logs**.', answer: ['4'],
        hint: 'Filter on SIEM. Look for a source that went quiet when it should not have.',
        why: 'The edge firewall sent nothing for 75 minutes, with no recorded outage, and the gap covers the 03:12 remote desktop session. Attackers turn off or wipe logging to hide.' },
      { ask: 'Pin the **published or documented** indicator.', answer: ['17'],
        hint: 'Some evidence comes from outside the company. Which source is not one of your own systems?',
        why: 'Company addresses and passwords posted on a leak site are evidence of a breach found outside your own logs. Reset those accounts and look for how they were taken.' },
    ], 'One working day at a small company. Every indicator from the exam objectives is in here, along with harmless events that look like them. Filter, search, open events for details, and pin the one each task asks for.'),
  ],
  check: [
    mcq('A Linux user notices that a script run every minute by root is writable by everyone. They add a line and soon have a root shell. What should have prevented this?',
      'File permissions so that only root can change the script', ['A stronger password for the user', 'Patching the kernel', 'MFA on SSH sign-ins'],
      'The user changed code that root then ran. Nothing about passwords or the kernel was involved; least privilege on the file closes the path.'),
    mcq('A customer changes /invoices/1043 to /invoices/1044 in the address bar and sees another company\'s invoice. Which attack is this, and what fixes it?',
      'Horizontal privilege escalation; check ownership on the server for every request', ['Vertical privilege escalation; require MFA', 'CSRF; add an anti-CSRF token', 'Directory traversal; reject ../ in the name'],
      'Same level of rights, someone else\'s data: horizontal. The server must check that the record belongs to the signed-in user, not only that someone is signed in.'),
    mcq('A link preview feature is given http://2852039166/latest/meta-data/ and returns the server\'s cloud credentials, despite a block list containing 169.254.169.254. What BEST prevents this?',
      'Resolve each destination and refuse internal addresses, including after redirects', ['Add 2852039166 to the block list', 'Require HTTPS for all previews', 'Add an anti-CSRF token to the preview form'],
      'The decimal number is the metadata address spelled differently, and there are endless spellings. Checking the address actually connected to, on every hop, catches them all.'),
    mcq('A web server rejects any file name containing ../ but still returns /etc/passwd for file=%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd. Why?',
      'The check ran before the name was URL-decoded', ['The server runs as www-data', 'The file name was too long to check', 'The server canonicalized the path'],
      'The raw name has no ../ in it, so it passes, then decoding turns %2e%2e%2f into ../. Check the final resolved path, after all decoding.'),
  ],
};
