/**
 * The outbreak simulator's engine: release one malware sample into a small office network with a chosen set of
 * defences, and get back what happens hour by hour. Pure functions, so the spec can check every challenge.
 */

export type Segment = 'office' | 'finance' | 'servers';
export const SEGMENT_NAME: Record<Segment, string> = { office: 'Office', finance: 'Finance', servers: 'Servers' };

export interface Host {
  id: string;
  name: string;
  seg: Segment;
  server?: boolean;
  /** Has the patch for the SMB flaw that worms use. */
  patched: boolean;
}

export const HOSTS: Host[] = [
  { id: 'PC-01', name: 'Ana', seg: 'office', patched: true },
  { id: 'PC-02', name: 'Ben', seg: 'office', patched: false },
  { id: 'PC-03', name: 'Cara', seg: 'office', patched: false },
  { id: 'PC-04', name: 'Dev', seg: 'office', patched: true },
  { id: 'PC-05', name: 'Eli', seg: 'office', patched: false },
  { id: 'FN-01', name: 'Gil', seg: 'finance', patched: false },
  { id: 'FN-02', name: 'Hana', seg: 'finance', patched: true },
  { id: 'FN-03', name: 'Ivo', seg: 'finance', patched: false },
  { id: 'FS', name: 'File server', seg: 'servers', server: true, patched: false },
  { id: 'DB', name: 'Payroll database', seg: 'servers', server: true, patched: true },
];

export type ControlId = 'patch' | 'segment' | 'macros' | 'allowlist' | 'edr' | 'backups' | 'review';
export const CONTROLS: { id: ControlId; name: string; detail: string; icon: string }[] = [
  { id: 'patch', name: 'Patch every machine', detail: 'Install the fix for the SMB flaw on the five machines that are missing it', icon: 'system_update' },
  { id: 'segment', name: 'Segment the network', detail: 'Firewall between Office, Finance and Servers; PCs may still reach the file share', icon: 'call_split' },
  { id: 'macros', name: 'Block macros in files from the internet', detail: 'Documents from email or the web open without running code', icon: 'code_off' },
  { id: 'allowlist', name: 'Application allow list', detail: 'Only programs IT has approved can run', icon: 'playlist_add_check' },
  { id: 'edr', name: 'EDR', detail: 'Watches behaviour, not signatures, and can isolate a machine', icon: 'radar' },
  { id: 'backups', name: 'Offline backups', detail: 'Nightly copies kept off the network, tested monthly', icon: 'backup' },
  { id: 'review', name: 'Code review for script changes', detail: 'A second person approves every change to production scripts', icon: 'rate_review' },
];

export type SampleId = 'worm' | 'virus' | 'trojan' | 'ransomworm' | 'logicbomb' | 'fileless';
export const SAMPLES: { id: SampleId; name: string; start: string }[] = [
  { id: 'worm', name: 'Worm', start: 'Cara runs "photos.exe" from a USB stick she found' },
  { id: 'virus', name: 'Macro virus', start: 'Ana opens a spreadsheet attached to an email' },
  { id: 'trojan', name: 'Trojan', start: 'Ben installs a free PDF converter from a download site' },
  { id: 'ransomworm', name: 'Ransomware worm', start: 'Eli opens "invoice.pdf.exe" from an email' },
  { id: 'logicbomb', name: 'Logic bomb', start: 'A dismissed admin left a hidden condition in the payroll script' },
  { id: 'fileless', name: 'Fileless malware', start: 'Hana opens an invoice document and clicks "Enable content"' },
];

export type HostState = 'clean' | 'infected' | 'isolated' | 'encrypted' | 'wiped' | 'restored';
export type ShareState = 'clean' | 'infected' | 'encrypted' | 'restored';

export interface SimEvent {
  tone: 'bad' | 'good' | 'info' | 'none';
  text: string;
  /** The defence this event is about, if any. */
  control?: ControlId;
}

export interface Frame {
  hour: number;
  hosts: Record<string, HostState>;
  share: ShareState;
  events: SimEvent[];
}

export interface Outcome {
  /** Machines the malware ran on or an attacker signed in to. */
  compromised: string[];
  dataLost: boolean;
  dataStolen: boolean;
  restored: boolean;
  /** The logic bomb went off. */
  fired: boolean;
}

export interface SimResult { frames: Frame[]; outcome: Outcome }

const list = (ids: string[]) => ids.length <= 2 ? ids.join(' and ') : ids.slice(0, -1).join(', ') + ' and ' + ids[ids.length - 1];

export function simulate(sample: SampleId, on: ControlId[]): SimResult {
  const has = (c: ControlId) => on.includes(c);
  const host = (id: string) => HOSTS.find(h => h.id === id)!;
  const st: Record<string, HostState> = Object.fromEntries(HOSTS.map(h => [h.id, 'clean' as HostState]));
  let share: ShareState = 'clean';
  const frames: Frame[] = [];
  const touched = new Set<string>();
  const outcome: Outcome = { compromised: [], dataLost: false, dataStolen: false, restored: false, fired: false };
  const infect = (id: string) => { st[id] = 'infected'; touched.add(id); };
  const push = (events: SimEvent[]) => frames.push({ hour: frames.length, hosts: { ...st }, share, events });
  /** A note for each chosen defence that plays no part in this sample. */
  const noHelp = (notes: Partial<Record<ControlId, string>>): SimEvent[] =>
    on.filter(c => notes[c]).map(c => ({ tone: 'none' as const, control: c, text: notes[c]! }));
  const finish = (): SimResult => ({ frames, outcome: { ...outcome, compromised: HOSTS.map(h => h.id).filter(id => touched.has(id)) } });

  const patched = (h: Host) => h.patched || has('patch');
  const reaches = (from: Host, to: Host) => !has('segment') || from.seg === to.seg || (to.id === 'FS' && !from.server);

  const told = new Set<string>();
  /** One hour of a worm: every active copy scans for SMB and exploits what it can reach. */
  const spread = (): SimEvent[] => {
    const active = HOSTS.filter(h => st[h.id] === 'infected');
    if (!active.length) return [{ tone: 'info', text: 'No active copies are left on the network.' }];
    if (has('edr')) {
      active.forEach(h => st[h.id] = 'isolated');
      return [{ tone: 'good', control: 'edr', text: `EDR saw ${list(active.map(h => h.id))} suddenly connecting to port 445 on dozens of machines, killed the process and isolated ${active.length > 1 ? 'them' : 'it'} from the network.` }];
    }
    const targets = HOSTS.filter(t => st[t.id] === 'clean');
    const reachable = targets.filter(t => active.some(a => reaches(a, t)));
    const hit = reachable.filter(t => !patched(t)).map(t => t.id);
    // Each defended machine is reported once, the first hour the worm tries it.
    const saved = reachable.filter(t => patched(t) && !told.has('p' + t.id)).map(t => t.id);
    const walled = targets.filter(t => !reachable.includes(t) && !told.has('s' + t.id)).map(t => t.id);
    saved.forEach(id => told.add('p' + id));
    walled.forEach(id => told.add('s' + id));
    const events: SimEvent[] = [];
    events.push(hit.length
      ? { tone: 'bad', text: `${list(active.map(h => h.id))} scanned the network for SMB and exploited the flaw on ${list(hit)}.` }
      : { tone: 'info', text: `${list(active.map(h => h.id))} kept scanning, but found nothing left it can infect.` });
    if (saved.length) events.push({ tone: 'good', control: has('patch') ? 'patch' : undefined, text: `${list(saved)} ${saved.length > 1 ? 'were' : 'was'} reached but ${has('patch') ? 'patched' : 'already patched'}, so the exploit failed.` });
    if (walled.length && has('segment')) events.push({ tone: 'good', control: 'segment', text: `The segment firewall kept the worm from reaching ${list(walled)}.` });
    hit.forEach(infect);
    return events;
  };

  switch (sample) {
    case 'worm':
    case 'ransomworm': {
      const zero = sample === 'worm' ? 'PC-03' : 'PC-05';
      const who = host(zero).name;
      const what = sample === 'worm' ? 'runs "photos.exe" from a USB stick found in the car park' : 'opens "invoice.pdf.exe" from an email';
      if (has('allowlist')) {
        push([{ tone: 'info', text: `${who} ${what}.` }, { tone: 'good', control: 'allowlist', text: 'The allow list stops it: the program is not approved, so it never runs. Nothing is infected.' }]);
        return finish();
      }
      infect(zero);
      push([
        { tone: 'bad', text: `${who} ${what}. The ${sample === 'worm' ? 'worm' : 'ransomware worm'} starts on ${zero}.` },
        { tone: 'info', text: 'Signature antivirus has no match: this build is new.' },
        ...noHelp({ macros: 'Blocking macros makes no difference: no document is involved.', review: 'Code review makes no difference: no script was changed.' }),
        ...(sample === 'worm' ? noHelp({ backups: 'Backups do not stop a worm spreading. They only help if it damages data.' }) : []),
      ]);
      push(spread());
      push(spread());
      if (sample === 'worm') {
        push(spread());
        return finish();
      }
      // The ransomware payload fires on every copy, and anything still on the network encrypts the mapped file share too.
      const victims = HOSTS.filter(h => st[h.id] === 'infected' || st[h.id] === 'isolated').map(h => h.id);
      const online = victims.filter(id => st[id] === 'infected');
      victims.forEach(id => st[id] = 'encrypted');
      if (online.length) share = 'encrypted';
      push([
        { tone: 'bad', text: `The payload fires: files on ${list(victims)} are encrypted and a ransom note appears.` },
        online.length
          ? { tone: 'bad', text: 'The S: drive is mapped on every PC, so the file share is encrypted too.' }
          : { tone: 'good', control: 'edr', text: 'The isolated machine can no longer reach the file share, so the share is safe.' },
      ]);
      if (has('backups')) {
        victims.forEach(id => st[id] = 'restored');
        if (share === 'encrypted') share = 'restored';
        outcome.restored = true;
        push([{ tone: 'good', control: 'backups', text: `The encrypted machines are rebuilt and the data restored from last night's offline backup, which the ransomware could not reach. Nothing is lost.` }]);
      } else {
        outcome.dataLost = true;
        push([{ tone: 'bad', text: 'There is no backup the ransomware could not reach. The encrypted data is lost unless someone pays, with no guarantee.' }]);
      }
      return finish();
    }

    case 'virus': {
      if (has('macros')) {
        push([{ tone: 'info', text: 'Ana opens "Q3 budget.xlsm", attached to an email.' }, { tone: 'good', control: 'macros', text: 'The file came from the internet, so its macro is blocked. The virus never runs.' }]);
        return finish();
      }
      infect('PC-01');
      push([
        { tone: 'bad', text: 'Ana opens "Q3 budget.xlsm" and its macro runs on PC-01. PC-01 is fully patched: the macro needs no flaw, only someone opening the file.' },
        { tone: 'info', text: 'Signature antivirus has no match for this macro.' },
        ...noHelp({ allowlist: 'The allow list makes no difference: the macro runs inside the approved spreadsheet app.', review: 'Code review makes no difference: it covers changes to production scripts, not documents people open.' }),
      ]);
      share = 'infected';
      push([
        { tone: 'bad', text: 'Ana saves her work to the file share. The macro copies itself into 40 spreadsheets there. The file server itself is not infected: the virus lives inside the files.' },
        ...noHelp({ edr: 'EDR sees nothing unusual: a spreadsheet app editing spreadsheets looks like normal work.' }),
      ]);
      const opens: [string, string][][] = [[['PC-03', 'Cara'], ['FN-01', 'Gil']], [['PC-04', 'Dev'], ['FN-02', 'Hana']], [['PC-02', 'Ben'], ['FN-03', 'Ivo']]];
      opens.forEach((pair, i) => {
        pair.forEach(([id]) => infect(id));
        const patchedOnes = pair.filter(([id]) => patched(host(id)));
        push([
          { tone: 'bad', text: `${pair.map(p => p[1]).join(' and ')} open shared spreadsheets. The macro runs on ${pair.map(p => p[0]).join(' and ')}.` },
          ...(patchedOnes.length ? [{ tone: 'info' as const, text: `${list(patchedOnes.map(p => p[0]))} ${patchedOnes.length > 1 ? 'are' : 'is'} patched, which makes no difference to a virus.` }] : []),
          ...(i === 0 ? noHelp({ segment: 'Segmentation makes no difference: every PC is allowed to reach the file share, and that is all the virus needs.', patch: 'Patching makes no difference: no flaw is being exploited.' }) : []),
        ]);
      });
      if (has('backups')) {
        share = 'restored';
        outcome.restored = true;
        push([{ tone: 'good', control: 'backups', text: 'The 40 infected spreadsheets are replaced with clean copies from the offline backup. The PCs still need cleaning. Eli never opened a shared file, so PC-05 stayed clean.' }]);
      } else {
        push([{ tone: 'info', text: 'Eli never opened a shared spreadsheet, so PC-05 stayed clean. The infected files are still on the share, waiting for the next person.' }]);
      }
      return finish();
    }

    case 'trojan': {
      if (has('allowlist')) {
        push([{ tone: 'info', text: 'Ben downloads "PDF Converter Pro (free)" from a download site and runs the installer.' }, { tone: 'good', control: 'allowlist', text: 'The allow list blocks it: it is not approved software, so it never runs.' }]);
        return finish();
      }
      infect('PC-02');
      push([
        { tone: 'bad', text: 'Ben installs "PDF Converter Pro (free)". It converts PDFs perfectly, and quietly installs a hidden program as well.' },
        { tone: 'info', text: 'Signature antivirus has no match: it is a fresh build.' },
        ...noHelp({ patch: 'Patching makes no difference: Ben installed it himself, no flaw was used.', macros: 'Blocking macros makes no difference: this is a program, not a document.' }),
      ]);
      if (has('edr')) {
        st['PC-02'] = 'isolated';
        push([{ tone: 'good', control: 'edr', text: 'The hidden program downloads a backdoor from a domain registered last week. EDR flags an unsigned program fetching and running code, kills it and isolates PC-02.' }]);
      } else {
        push([{ tone: 'bad', text: 'The hidden program downloads a backdoor and connects out to the attacker\'s server.' }]);
        outcome.dataStolen = true;
        push([{ tone: 'bad', text: 'Through the backdoor, the attacker browses Ben\'s files and copies the customer list.' }]);
      }
      push([
        { tone: 'info', text: 'Still only PC-02. A trojan does not spread by itself: it needed Ben to install it.' },
        ...noHelp({ segment: 'Segmentation makes no difference: nothing tried to spread.', backups: 'Backups cannot undo stolen data, and nothing was destroyed.', review: 'Code review makes no difference: no script was changed.' }),
      ]);
      return finish();
    }

    case 'logicbomb': {
      push([{ tone: 'info', text: 'Before he was dismissed, a database admin added a hidden condition to the nightly payroll script on DB: if his employee ID is ever missing from the payroll, delete the database.' }]);
      if (has('review')) {
        push([{ tone: 'good', control: 'review', text: 'Every change to production scripts needs a second person\'s approval. The reviewer spots the delete command, rejects the change and reports it.' }]);
        return finish();
      }
      push([
        { tone: 'none', text: 'Nightly payroll run. Nothing happens: his ID is still on the payroll.' },
        ...noHelp({ edr: 'EDR sees nothing: a scheduled script run by the payroll account looks normal.', patch: 'Patching makes no difference: no flaw is involved.', allowlist: 'The allow list makes no difference: the payroll script is approved.', segment: 'Segmentation makes no difference: the bomb is already on the server.', macros: 'Blocking macros makes no difference: there is no document.' }),
      ]);
      push([{ tone: 'none', text: 'HR removes his record from the payroll.' }]);
      st['DB'] = 'wiped';
      touched.add('DB');
      outcome.fired = true;
      push([{ tone: 'bad', text: 'Nightly payroll run: his ID is missing, so the condition is true. The script deletes the payroll database.' }]);
      if (has('backups')) {
        st['DB'] = 'restored';
        outcome.restored = true;
        push([{ tone: 'good', control: 'backups', text: 'The database is restored from last night\'s offline backup. Payroll is a day late, but nothing is lost.' }]);
      } else {
        outcome.dataLost = true;
        push([{ tone: 'bad', text: 'No offline backup exists. The payroll records are gone.' }]);
      }
      return finish();
    }

    case 'fileless': {
      if (has('macros')) {
        push([{ tone: 'info', text: 'Hana opens an invoice document from an email and clicks "Enable content".' }, { tone: 'good', control: 'macros', text: 'The document came from the internet, so its macro is blocked. Nothing runs.' }]);
        return finish();
      }
      infect('FN-02');
      push([
        { tone: 'bad', text: 'The macro starts PowerShell with an encoded command. The payload runs only in memory; nothing is written to disk.' },
        { tone: 'info', text: 'Signature antivirus has nothing to scan: there is no file.' },
        ...noHelp({ allowlist: 'The allow list makes no difference: PowerShell is part of the operating system and approved.' }),
      ]);
      if (has('edr')) {
        st['FN-02'] = 'isolated';
        push([{ tone: 'good', control: 'edr', text: 'EDR knows a document app starting encoded PowerShell is a bad sign. It kills the process and isolates FN-02 before anything else happens.' }]);
        return finish();
      }
      push([{ tone: 'bad', text: 'In memory, it reads the password hashes of everyone signed in to FN-02, including the payroll admin\'s.' }]);
      infect('DB');
      push([
        { tone: 'bad', text: 'It signs in to the payroll database as the payroll admin, with the stolen hash.' },
        ...noHelp({ patch: 'Patching makes no difference: it signed in with real credentials, no exploit needed.', segment: 'Segmentation makes no difference: Finance is allowed to reach payroll.' }),
      ]);
      outcome.dataStolen = true;
      push([
        { tone: 'bad', text: 'It copies every employee\'s salary and bank details out to the attacker.' },
        ...noHelp({ backups: 'Backups cannot undo a theft: the data was copied, not destroyed.', review: 'Code review makes no difference: no script was changed.' }),
      ]);
      return finish();
    }
  }
}

export interface OutbreakChallenge {
  sample: SampleId;
  goal: string;
  max: number;
  /** A defence this challenge takes off the table, so the answer is about something else. */
  without?: ControlId;
  met: (o: Outcome) => boolean;
  /** What the solution teaches, shown once solved. */
  lesson: string;
}

export const CHALLENGES: OutbreakChallenge[] = [
  { sample: 'worm', max: 1, without: 'allowlist', goal: 'Cara will run it whatever you do. With one defence, keep the worm on her PC alone.',
    met: o => o.compromised.length <= 1,
    lesson: 'A worm spreads by exploiting a flaw, so patching closes its path. EDR also works by isolating the first machine. Segmentation alone only slows it.' },
  { sample: 'virus', max: 1, goal: 'With one defence, stop the virus infecting any machine.',
    met: o => o.compromised.length === 0,
    lesson: 'A virus rides inside a file and runs when someone opens it. Patching does nothing; stopping the macro from running does.' },
  { sample: 'trojan', max: 1, goal: 'With one defence, stop the trojan ever running.',
    met: o => o.compromised.length === 0,
    lesson: 'A trojan relies on someone choosing to install it. An allow list means unapproved programs never run, however convincing they look.' },
  { sample: 'ransomworm', max: 2, without: 'allowlist', goal: 'Eli will open it whatever you do. With two defences, lose no data and let it encrypt one machine at most.',
    met: o => !o.dataLost && o.compromised.length <= 1,
    lesson: 'Two jobs, two defences: patching or EDR stops the spread, and only an offline backup gets encrypted data back.' },
  { sample: 'logicbomb', max: 1, goal: 'With one defence, stop the logic bomb before it goes off.',
    met: o => !o.fired,
    lesson: 'A logic bomb is planted by an insider and looks like normal code until it fires. Review of changes catches it; backups only recover afterwards.' },
  { sample: 'fileless', max: 1, goal: 'With one defence, keep the payroll data from being stolen.',
    met: o => !o.dataStolen,
    lesson: 'Fileless malware leaves no file for antivirus and uses approved tools, so the allow list does not help. Block the macro, or let EDR catch the behaviour.' },
];

/** Whether a set of defences solves a challenge, and if not, why not. */
export function judge(c: OutbreakChallenge, on: ControlId[]): { ok: boolean; why: string } {
  if (c.without && on.includes(c.without)) return { ok: false, why: `This challenge assumes no ${CONTROLS.find(x => x.id === c.without)!.name.toLowerCase()}. Turn it off.` };
  if (on.length > c.max) return { ok: false, why: `Use ${c.max === 1 ? 'one defence' : `${c.max} defences`} at most; you have ${on.length} on.` };
  const o = simulate(c.sample, on).outcome;
  if (c.met(o)) return { ok: true, why: c.lesson };
  const bits = [`${o.compromised.length} machine${o.compromised.length === 1 ? '' : 's'} hit`];
  if (o.dataLost) bits.push('data lost');
  if (o.dataStolen) bits.push('data stolen');
  if (o.fired) bits.push('the bomb went off');
  return { ok: false, why: `Not yet: ${bits.join(', ')}.` };
}
