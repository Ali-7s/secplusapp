/**
 * Builds a shift's world: every event of the shift (background plus incidents), the workstation's file system with
 * logs that only show what has happened by the shift clock, the company notes, and the lookups (whois, intel, DNS).
 */

import { Ev, LOG_FILES, Source, resetPids } from './events';
import { PEOPLE, SITES, background, rng } from './env';
import { Shift } from './model';
import { Shell, ShellHost } from './shell';
import { joinLines } from './text';
import { HOME, Vfs } from './vfs';

export const DOCS: Record<string, string> = {
  'README.txt': `SOC analyst workstation (soc-ws)

Logs collected from Fernco's systems are in /var/log; they grow as the shift goes on.
Company notes are in ~/docs. Put your scripts in ~/bin (it is on your PATH).

  help            the commands available here
  man <command>   options and examples for one command
  nano <file>     edit a file (Ctrl+S saves, Esc closes)
  tail -f <log>   watch a log live (Ctrl+C stops)
`,
  'docs/assets.csv': `hostname,ip,owner,role
web01,10.0.2.10,s.ito,Public web shop in the DMZ (public address 192.0.2.10); SSH open to the internet for deployments (RISK-77)
ci01,10.0.5.20,p.harris,Build server; deploys to web01 as user deploy using an SSH key
scanner01,10.0.9.5,l.moreau,IT Security vulnerability scanner
dc01,10.0.1.5,p.harris,Windows domain controller
dns01,10.0.1.53,s.ito,Internal DNS resolver; forwards outside lookups to the internet
proxy01,10.0.1.80,s.ito,Web proxy for staff browsing
bk01,10.0.6.40,k.mensah,Backup server; nightly offsite copy to Offsite Vault (CHG-420)
db02,10.0.3.22,p.harris,Customer database server (Linux); should only talk to the web shop and backups
vpn-gw,192.0.2.6,s.ito,Remote-access VPN gateway (cloud hosted in Frankfurt); remote staff appear from this address
office-line,192.0.2.5,s.ito,Office internet connection (Lisbon)
`,
  'docs/staff.csv': `user,name,laptop,ip,department,notes
${PEOPLE.map(p => `${p.user},${p.name},${p.host},${p.ip},${p.dept},${p.user === 'k.park' ? 'on leave 2 to 9 November' : p.host === 'LT-122' ? 'EDR sensor not reporting since 3 Nov (ticket IT-5521)' : ''}`).join('\n')}
`,
  'docs/change-calendar.txt': `Approved changes, Thursday 5 November 2026

CHG-415  daily 07:00-18:00  web01  Deployments from ci01 (user deploy, SSH key) and nginx reloads. Owner: p.harris
CHG-412  08:45-09:30        web01  Weekly authenticated vulnerability scan from scanner01 (10.0.9.5). Owner: l.moreau
CHG-420  nightly 01:00-03:00 bk01  Offsite backup to Offsite Vault Backup Services (198.51.100.200), about 8-10 GB. Owner: k.mensah
CHG-418  10:30-11:00        mail   Mail filter rule update. Owner: s.ito
`,
  'docs/oncall.txt': `IT on call, week of 2 to 8 November 2026
  Primary:  k.mensah (Kofi Mensah)
  Backup:   s.ito (Sam Ito)

Administrative work outside 07:00-19:00 needs a change ticket or an on-call page.
Anyone else doing admin work at night: treat as suspicious and call the on-call engineer.
`,
  'docs/playbook.txt': `Triage, in order
  1. Read the alert: what fired, on which host, for which user or address?
  2. Find the events behind it (SIEM or /var/log) and the context: assets.csv, staff.csv, change-calendar.txt, oncall.txt.
  3. Look up outside addresses and domains: intel, whois.
  4. Scope it: did the same address, domain or file touch other hosts or accounts?
  5. Decide: true positive, benign true positive (real but authorised) or false positive (the detection is wrong).
  6. Respond in proportion: block, isolate, disable, reset, escalate, or close (and ask for tuning if it was noise).

Escalate to incident response when an attacker got in: a successful sign-in, malware running, data leaving.
`,
};

export interface World {
  shift: Shift;
  events: Ev[];
  bySource: Map<Source, Ev[]>;
  vfs: Vfs;
  host: ShellHost;
  clock: { now: number };
}

export function buildEvents(shift: Shift): Ev[] {
  resetPids();
  const r = rng(shift.seed);
  let evs = [...background(r, shift.sources, shift.start, shift.end, shift.busy), ...shift.incidents(rng(shift.seed * 7 + 1))];
  if (shift.edrSilent?.length) evs = evs.filter(e => !(e.source === 'edr' && shift.edrSilent!.includes(e.host)));
  evs = evs.filter(e => e.t >= shift.start && e.t < shift.end);
  // Stable sort by time keeps multi-line events (Invalid user, then Failed password) in order.
  return evs.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i).map(x => x.e);
}

/** How many events of a sorted list happened by time t. */
export function countBy(evs: Ev[], t: number): number {
  let lo = 0;
  let hi = evs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (evs[mid].t <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function buildWorld(shift: Shift, clock = { now: shift.start }): World {
  const events = buildEvents(shift);
  const bySource = new Map<Source, Ev[]>();
  for (const e of events) {
    let list = bySource.get(e.source);
    if (!list) bySource.set(e.source, (list = []));
    list.push(e);
  }
  const vfs = new Vfs(() => clock.now);
  for (const d of ['/var/log', '/tmp', '/etc', HOME, `${HOME}/bin`, `${HOME}/docs`]) vfs.mkdirp(d);
  // Each log file shows the events up to the shift clock; the text is cached until a new line arrives.
  for (const source of shift.sources) {
    const list = bySource.get(source) ?? [];
    const cache = { n: -1, text: '' };
    vfs.add(LOG_FILES[source].path, {
      gen: () => {
        const n = countBy(list, clock.now);
        if (n !== cache.n) { cache.n = n; cache.text = joinLines(list.slice(0, n).map(e => e.raw)); }
        return cache.text;
      },
      mtime: () => { const n = countBy(list, clock.now); return n ? list[n - 1].t : shift.start; },
    });
  }
  for (const [path, text] of Object.entries(DOCS)) vfs.add(`${HOME}/${path}`, { text, mtime: 0 });
  vfs.add('/etc/hostname', { text: 'soc-ws\n' });
  vfs.add('/etc/hosts', { text: '127.0.0.1 localhost\n10.0.8.15 soc-ws\n10.0.1.5 dc01\n10.0.1.53 dns01\n10.0.2.10 web01\n' });

  const dnsTable = new Map<string, string>([
    ...SITES.map(([n, ip]) => [n, ip] as [string, string]),
    ['invoices-portal.example', '192.0.2.140'], ['cdn-update.example', '192.0.2.77'], ['sync-check.example', '203.0.113.9'],
    ['ns1.sync-check.example', '203.0.113.9'], ['shop.fernco.example', '192.0.2.10'], ['intranet.fernco.example', '10.0.2.20'],
  ]);
  const host: ShellHost = {
    now: () => clock.now,
    lookup(kind, q) {
      const key = q.trim().toLowerCase();
      if (kind === 'intel') return shift.intel[key] ?? shift.intel[q.trim()];
      if (kind === 'whois') return shift.whois[key];
      const ip = dnsTable.get(key) ?? (key.endsWith('.sync-check.example') ? undefined : undefined);
      return ip ? `${q}\n  Address: ${ip}` : undefined;
    },
  };
  return { shift, events, bySource, vfs, host, clock };
}

/** A fresh shell on this world, sharing its file system. */
export function shellFor(world: World): Shell {
  return new Shell(world.vfs, world.host);
}
