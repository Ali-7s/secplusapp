/**
 * The privilege escalation lab's engine. A Linux server where you are the ordinary user `jo`, with three ways to
 * become root waiting to be found, and a web app where one customer can reach what is not theirs. Then the fixes.
 */

export type FixId = 'perms' | 'sudo' | 'patch' | 'authz';
export type CmdId = 'id' | 'crontab' | 'ls-script' | 'sudo-l' | 'uname' | 'x-cron' | 'x-sudo' | 'x-kernel' | 'inv-own' | 'inv-other' | 'role' | 'admin';
export type PrivMission = 'cron' | 'sudo' | 'kernel' | 'horizontal' | 'vertical' | 'server-fixed' | 'web-fixed';

export const FIXES: { id: FixId; name: string; detail: string; where: 'server' | 'web' }[] = [
  { id: 'perms', name: 'Fix the script\'s permissions', detail: 'cleanup.sh owned by root and writable only by root (chmod 755)', where: 'server' },
  { id: 'sudo', name: 'Remove the sudo rule', detail: 'jo only gets the rights the job needs: least privilege', where: 'server' },
  { id: 'patch', name: 'Patch the kernel', detail: 'Install the update that fixes the local privilege escalation flaw', where: 'server' },
  { id: 'authz', name: 'Check authorization on every request', detail: 'The API checks who owns each record and who may change roles, not just that you are signed in', where: 'web' },
];

export interface Cmd { id: CmdId; label: string; where: 'server' | 'web'; kind: 'look' | 'try'; needs?: CmdId[]; mono?: boolean }

export const CMDS: Cmd[] = [
  { id: 'id', label: 'id', where: 'server', kind: 'look', mono: true },
  { id: 'crontab', label: 'cat /etc/crontab', where: 'server', kind: 'look', mono: true },
  { id: 'ls-script', label: 'ls -l /opt/scripts/cleanup.sh', where: 'server', kind: 'look', needs: ['crontab'], mono: true },
  { id: 'sudo-l', label: 'sudo -l', where: 'server', kind: 'look', mono: true },
  { id: 'uname', label: 'uname -r', where: 'server', kind: 'look', mono: true },
  { id: 'x-cron', label: 'Add your own line to cleanup.sh and wait a minute for cron', where: 'server', kind: 'try', needs: ['ls-script'] },
  { id: 'x-sudo', label: 'Open a log with sudo less, then start a shell from inside it', where: 'server', kind: 'try', needs: ['sudo-l'] },
  { id: 'x-kernel', label: 'Run a public exploit for the kernel flaw', where: 'server', kind: 'try', needs: ['uname'] },
  { id: 'inv-own', label: 'GET /api/invoices/1043', where: 'web', kind: 'look', mono: true },
  { id: 'inv-other', label: 'GET /api/invoices/1044', where: 'web', kind: 'try', needs: ['inv-own'], mono: true },
  { id: 'role', label: 'PATCH /api/users/jo  {"role": "admin"}', where: 'web', kind: 'try', mono: true },
  { id: 'admin', label: 'GET /api/admin/users', where: 'web', kind: 'look', needs: ['role'], mono: true },
];

/** `triedFixed` and `webFixed` record the attacks tried while every fix was on; switching a fix off empties them. */
export interface PrivState { fixes: FixId[]; ran: CmdId[]; webAdmin: boolean; done: PrivMission[]; triedFixed: CmdId[]; webFixed: CmdId[] }
export const PRIV_START: PrivState = { fixes: [], ran: [], webAdmin: false, done: [], triedFixed: [], webFixed: [] };

export const PRIV_MISSIONS: { id: PrivMission; text: string }[] = [
  { id: 'cron', text: 'Become root through the scheduled script' },
  { id: 'sudo', text: 'Become root through the sudo rule' },
  { id: 'kernel', text: 'Become root through the unpatched kernel' },
  { id: 'horizontal', text: 'Read another customer\'s invoice (horizontal)' },
  { id: 'vertical', text: 'Make yourself an admin in the web app (vertical)' },
  { id: 'server-fixed', text: 'Apply the three server fixes and watch every root path fail' },
  { id: 'web-fixed', text: 'Fix the web app and watch both web attacks fail' },
];

export interface Output { lines: string[]; tone: 'info' | 'bad' | 'good'; note?: string }

const ROOT = ['# id', 'uid=0(root) gid=0(root) groups=0(root)'];

export function run(s: PrivState, id: CmdId): { s: PrivState; out: Output } {
  const has = (f: FixId) => s.fixes.includes(f);
  const ran = s.ran.includes(id) ? s.ran : [...s.ran, id];
  let done = [...s.done];
  let webAdmin = s.webAdmin;
  const mark = (...m: PrivMission[]) => { done = PRIV_MISSIONS.map(x => x.id).filter(x => m.includes(x) || done.includes(x)); };
  let out: Output;

  switch (id) {
    case 'id': out = { tone: 'info', lines: ['uid=1001(jo) gid=1001(jo) groups=1001(jo)'], note: 'An ordinary user, no admin groups. Now look for something that runs as root but that jo can influence.' }; break;
    case 'crontab': out = { tone: 'info', lines: ['# m h dom mon dow user  command', '*  *  *   *   *   root  /opt/scripts/cleanup.sh'], note: 'Root runs cleanup.sh every minute. Who can edit that file?' }; break;
    case 'ls-script': out = has('perms')
      ? { tone: 'good', lines: ['-rwxr-xr-x 1 root root 214 Mar  3 cleanup.sh'], note: 'Only root can write to it now.' }
      : { tone: 'bad', lines: ['-rwxrwxrwx 1 root root 214 Mar  3 cleanup.sh'], note: 'rwx for everyone: any user can change a script that root runs every minute.' }; break;
    case 'sudo-l': out = has('sudo')
      ? { tone: 'good', lines: ['Sorry, user jo may not run sudo on app-server.'] }
      : { tone: 'bad', lines: ['User jo may run the following commands on app-server:', '    (root) NOPASSWD: /usr/bin/less /var/log/app/*'], note: 'jo may run a file viewer as root, without a password. Many programs, less included, can start a shell.' }; break;
    case 'uname': out = has('patch')
      ? { tone: 'good', lines: ['5.15.0-112-generic'], note: 'Current, with the fix installed.' }
      : { tone: 'bad', lines: ['5.15.0-41-generic'], note: 'Over a year old. A published local privilege escalation flaw affects this version.' }; break;
    case 'x-cron':
      if (has('perms')) out = { tone: 'good', lines: ['bash: /opt/scripts/cleanup.sh: Permission denied'], note: 'jo can no longer change what root runs.' };
      else { out = { tone: 'bad', lines: ['(a minute later, cron runs the script as root, including jo\'s line)', ...ROOT], note: 'Root ran code jo wrote. A writable file that a privileged process executes is one of the most common escalation paths.' }; mark('cron'); }
      break;
    case 'x-sudo':
      if (has('sudo')) out = { tone: 'good', lines: ['Sorry, user jo is not allowed to execute \'/usr/bin/less\' as root.'] };
      else { out = { tone: 'bad', lines: ['$ sudo less /var/log/app/app.log', '(inside less, start a shell)', ...ROOT], note: 'The shell inherits less\'s root rights. Granting "just a file viewer" as root granted everything.' }; mark('sudo'); }
      break;
    case 'x-kernel':
      if (has('patch')) out = { tone: 'good', lines: ['exploit: target kernel is not vulnerable. Exiting.'] };
      else { out = { tone: 'bad', lines: ['exploit: kernel 5.15.0-41 is vulnerable', ...ROOT], note: 'A flaw in the operating system itself gave root. No misconfiguration needed: only a missing patch.' }; mark('kernel'); }
      break;
    case 'inv-own': out = { tone: 'info', lines: ['200 OK', '{"invoice": 1043, "customer": "jo", "total": "€120.00"}'], note: 'Your own invoice. The number is in the address. What if you change it?' }; break;
    case 'inv-other':
      if (has('authz')) out = { tone: 'good', lines: ['403 Forbidden', '{"error": "invoice 1044 does not belong to you"}'] };
      else { out = { tone: 'bad', lines: ['200 OK', '{"invoice": 1044, "customer": "Harbor Supplies Ltd", "total": "€48,900.00", "bank": "NL91 ABNA ..."}'], note: 'Same rights level, someone else\'s data: horizontal escalation. The API checked that you were signed in, not that the invoice was yours.' }; mark('horizontal'); }
      break;
    case 'role':
      if (has('authz')) { out = { tone: 'good', lines: ['403 Forbidden', '{"error": "only admins may change roles"}'] }; webAdmin = false; }
      else { out = { tone: 'bad', lines: ['200 OK', '{"user": "jo", "role": "admin"}'], note: 'A customer gave themselves admin rights: vertical escalation.' }; webAdmin = true; mark('vertical'); }
      break;
    case 'admin':
      out = webAdmin && !has('authz')
        ? { tone: 'bad', lines: ['200 OK', '[{"user": "ana", "role": "admin"}, {"user": "ben", ...}, ... 4,212 users]'], note: 'Every user\'s account, available to a customer.' }
        : { tone: 'good', lines: ['403 Forbidden'] };
      break;
  }

  let triedFixed = s.triedFixed;
  if (SERVER_FIXES.every(has) && id.startsWith('x-')) {
    triedFixed = [...new Set([...triedFixed, id])];
    if (triedFixed.length === 3) mark('server-fixed');
  }
  let webFixed = s.webFixed;
  if (has('authz') && (id === 'inv-other' || id === 'role')) {
    webFixed = [...new Set([...webFixed, id])];
    if (webFixed.length === 2) mark('web-fixed');
  }
  return { s: { ...s, ran, webAdmin, done, triedFixed, webFixed }, out: out! };
}

const SERVER_FIXES: FixId[] = ['perms', 'sudo', 'patch'];

export function toggleFix(s: PrivState, f: FixId): PrivState {
  const off = s.fixes.includes(f);
  const fixes = off ? s.fixes.filter(x => x !== f) : FIXES.map(x => x.id).filter(x => x === f || s.fixes.includes(x));
  return {
    ...s, fixes,
    triedFixed: off && f !== 'authz' ? [] : s.triedFixed,
    webFixed: off && f === 'authz' ? [] : s.webFixed,
    webAdmin: !off && f === 'authz' ? false : s.webAdmin,
  };
}

export function unlocked(s: PrivState, c: Cmd): boolean {
  return (c.needs ?? []).every(n => s.ran.includes(n));
}
