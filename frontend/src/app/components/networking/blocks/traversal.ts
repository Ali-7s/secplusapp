/**
 * The directory traversal lab's engine: a download page that glues the `file=` value onto /var/www/files/, four ways
 * the developer might check it, and the account the web server runs as. Pure, so the spec can try every trick.
 */

export type FilterId = 'none' | 'strip' | 'early' | 'canon';
export type RunAs = 'root' | 'www-data';

export const BASE = '/var/www/files/';

export const FILTERS: { id: FilterId; name: string; code: string }[] = [
  { id: 'none', name: 'No check', code: 'open(BASE + file)' },
  { id: 'strip', name: 'Remove "../" from the name', code: 'file = file.replace("../", "")  # every match, once' },
  { id: 'early', name: 'Reject names containing "../"', code: 'if "../" in raw_query: reject()\nfile = url_decode(raw_query)' },
  { id: 'canon', name: 'Resolve the real path, then check it', code: 'path = realpath(BASE + file)\nif not path.startswith(BASE): reject()' },
];

interface FakeFile { lines: string[]; owner: string; mode: string; who: RunAs[] }
const ALL: RunAs[] = ['root', 'www-data'];

export const FS: Record<string, FakeFile> = {
  '/var/www/files/report.pdf': { lines: ['%PDF-1.7  Quarterly report (the file this page is meant to serve)'], owner: 'www-data', mode: '-rw-r--r--', who: ALL },
  '/var/www/files/menu.pdf': { lines: ['%PDF-1.7  Canteen menu'], owner: 'www-data', mode: '-rw-r--r--', who: ALL },
  '/var/www/app/config.php': { lines: ['<?php', '$db_host = \'db.internal\';', '$db_user = \'shop\';', '$db_pass = \'lab-only-example\';'], owner: 'www-data', mode: '-rw-r-----', who: ALL },
  '/etc/passwd': { lines: ['root:x:0:0:root:/root:/bin/bash', 'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin', 'deploy:x:1000:1000::/home/deploy:/bin/bash'], owner: 'root', mode: '-rw-r--r--', who: ALL },
  '/etc/shadow': { lines: ['root:$6$labonly$(password hash):19800:0:99999:7:::', 'deploy:$6$labonly$(password hash):19800:0:99999:7:::'], owner: 'root', mode: '-rw-r-----', who: ['root'] },
  '/home/deploy/.ssh/id_rsa': { lines: ['(deploy\'s private SSH key: with it you can sign in to other servers as deploy)'], owner: 'deploy', mode: '-rw-------', who: ['root'] },
};

/** Collapse ".", ".." and repeated slashes, the way the operating system would. ".." at the root stays at the root. */
export function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop(); else out.push(part);
  }
  return '/' + out.join('/');
}

export interface Step { label: string; value: string }
export interface TravResult { ok: boolean; status: string; steps: Step[]; lines: string[]; resolved?: string; escaped: boolean; blockedBy?: FilterId | 'perms'; note?: string }

export function download(raw: string, filter: FilterId, runAs: RunAs): TravResult {
  const steps: Step[] = [{ label: 'You sent', value: 'file=' + raw }];
  if (!raw) return { ok: false, status: 'Type a file name.', steps, lines: [], escaped: false };
  if (filter === 'early' && /\.\.[/\\]/.test(raw)) return { ok: false, status: '400 Bad Request: the name contains ../', steps, lines: [], escaped: false, blockedBy: 'early' };
  let file: string;
  try { file = decodeURIComponent(raw); } catch { return { ok: false, status: '400 Bad Request: broken % encoding', steps, lines: [], escaped: false }; }
  if (file !== raw) steps.push({ label: 'After URL decoding', value: file });
  if (filter === 'strip') {
    const stripped = file.split('../').join('');
    steps.push({ label: 'After removing "../"', value: stripped });
    file = stripped;
  }
  const full = BASE + file;
  const resolved = normalize(full);
  steps.push({ label: 'Path opened', value: full });
  if (resolved !== full) steps.push({ label: 'Which the system resolves to', value: resolved });
  const escaped = !resolved.startsWith(BASE);
  if (filter === 'canon' && escaped)
    return { ok: false, status: `403 Forbidden: that resolves to ${resolved}, outside ${BASE}`, steps, lines: [], resolved, escaped, blockedBy: 'canon' };
  const f = FS[resolved];
  if (!f) return { ok: false, status: '404 Not Found', steps, lines: [], resolved, escaped,
    note: file.startsWith('/') ? 'A name starting with / is just glued onto /var/www/files/. Climb out with ../ instead.' : escaped ? 'You are outside the download folder, but nothing is there. Count the folders again.' : undefined };
  if (!f.who.includes(runAs))
    return { ok: false, status: '500: permission denied', steps, lines: [`${f.mode} ${f.owner} ${resolved}`], resolved, escaped, blockedBy: 'perms',
      note: `The traversal worked, but the web server runs as ${runAs}, and only ${f.owner === 'root' ? 'root' : f.owner + ' and root'} may read this file.` };
  return { ok: true, status: '200 OK', steps, lines: f.lines, resolved, escaped,
    note: escaped ? (runAs === 'root' ? 'The web server runs as root, so every file on the machine is readable through this page.' : undefined) : undefined };
}

export type TravMission = 'passwd' | 'config' | 'strip' | 'early' | 'shadow' | 'least' | 'canon';
export const TRAV_MISSIONS: { id: TravMission; text: string }[] = [
  { id: 'passwd', text: 'Download /etc/passwd instead of a report' },
  { id: 'config', text: 'Steal the database password from the app\'s config.php' },
  { id: 'strip', text: 'Get outside the folder past the "remove ../" check' },
  { id: 'early', text: 'Get outside the folder past the "reject ../" check' },
  { id: 'shadow', text: 'Read the password hashes in /etc/shadow' },
  { id: 'least', text: 'Run the server as www-data and watch a traversal hit "permission denied"' },
  { id: 'canon', text: 'With the real-path check on, try a trick that beat another check, and see it fail' },
];

export function travMissions(raw: string, filter: FilterId, runAs: RunAs): TravMission[] {
  const r = download(raw, filter, runAs);
  const done: TravMission[] = [];
  if (r.ok && r.resolved === '/etc/passwd') done.push('passwd');
  if (r.ok && r.resolved === '/var/www/app/config.php') done.push('config');
  if (r.ok && r.escaped && filter === 'strip') done.push('strip');
  if (r.ok && r.escaped && filter === 'early') done.push('early');
  if (r.ok && r.resolved === '/etc/shadow') done.push('shadow');
  if (r.blockedBy === 'perms' && runAs === 'www-data') done.push('least');
  // Any trick that got out past a weaker check, now failing under the real-path check.
  if (filter === 'canon' && !r.ok && (['strip', 'early'] as FilterId[]).some(f => download(raw, f, 'root').escaped && download(raw, f, 'root').ok)) done.push('canon');
  return done;
}
