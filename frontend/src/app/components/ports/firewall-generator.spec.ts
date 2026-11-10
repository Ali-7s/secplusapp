import { NetDiagram } from '../../models/exam.model';
import { gradeQuestion, isAnswered } from '../../utils/exam-engine';
import { ICON_H, ICON_W, narrowLayout, wideLayout } from '../practice-exam/network-diagram';
import { PORTS } from '../reference/reference-data';
import { SrsCard } from '../../utils/srs';
import { FACTS, FLOWS, LOOKALIKES, NEW_PER_TABLE, RuleMemory, TableContext, buildTable, factOf, newTable, setOfFact } from './firewall-generator';
import { rateTable } from './firewall-memory';
import { MIXED, portNumbers } from './firewall-scenarios';
import { GROUPS } from './ports-trainer';
import { seededRandom } from '../../utils/exam-engine';

const SETS = [...GROUPS.map(g => g.id), MIXED];
const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7919);
const NEW = { level: () => 0 };
const KNOWN = { level: () => 4 };
const flow = (id: string) => FLOWS.find(f => f.id === id)!;
const MIN = 60_000, DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 10, 9);
/** A learned rule: last answered `ago` days back, with this many days of stability, so it was due after about that long. */
const learned = (stability: number, ago: number): SrsCard => ({
  state: 'review', step: 0, interval: stability, ease: 2.5, due: NOW - ago * DAY + stability * DAY, reps: 3, lapses: 0, right: 3, wrong: 0,
  at: NOW - ago * DAY, first: NOW - 30 * DAY, stability, difficulty: 5, last: NOW - ago * DAY,
});
const memoryOf = (facts: string[], card: (fact: string, i: number) => SrsCard): RuleMemory => Object.fromEntries(facts.map((f, i) => [f, card(f, i)]));
/** Every rule learned and far from due. */
const allRested = () => memoryOf(FACTS, () => learned(60, 1));
/** A learner partway through: some rules new, some due, some resting, different for every seed. */
const partway = (seed: number): TableContext => {
  const rand = seededRandom(seed);
  const memory: RuleMemory = {};
  for (const fact of FACTS) {
    const r = rand();
    if (r < 0.3) memory[fact] = learned(2 + rand() * 5, 8 + rand() * 20);
    else if (r < 0.6) memory[fact] = learned(30, rand() * 5);
  }
  return { level: () => Math.floor(rand() * 5), memory, now: NOW };
};
/** New learners and learners partway through, so the checks below meet many different tables. */
const table = (set: string, seed: number) => buildTable(newTable(set, seed % 2 ? partway(seed) : NEW, seed));
const factsOf = (set: string, ctx: TableContext, seed: number) => newTable(set, { now: NOW, ...ctx }, seed).flows.map(factOf);
const transports = (proto: string) => (proto === 'TCP and UDP' ? ['TCP', 'UDP'] : [proto]);

describe('firewall table generator', () => {
  it('has a unique id and both ways of wording every rule', () => {
    expect(new Set(FLOWS.map(f => f.id)).size).toBe(FLOWS.length);
    for (const f of FLOWS) {
      expect(f.plain.length).withContext(f.id).toBeGreaterThan(0);
      expect(f.job.length).withContext(f.id).toBeGreaterThan(0);
      expect(f.why.length).withContext(f.id).toBeGreaterThan(20);
    }
  });

  it('can ask about every port number and transport in the trainer', () => {
    for (const e of PORTS) {
      const numbers = portNumbers(e.port);
      const flows = FLOWS.filter(f => numbers.includes(Number(f.port)));
      for (const n of numbers) expect(flows.some(f => Number(f.port) === n)).withContext(`${e.protocol} ${n}`).toBeTrue();
      const used = new Set(flows.flatMap(f => transports(f.proto)));
      for (const t of e.transport.split('/')) expect(used.has(t)).withContext(`${e.protocol} ${t}`).toBeTrue();
    }
  });

  it('covers each set from that set\'s own rules', () => {
    for (const g of GROUPS) {
      const own = FLOWS.filter(f => f.set === g.id).map(f => Number(f.port));
      for (const n of g.ports.flatMap(portNumbers)) expect(own).withContext(`${g.id} ${n}`).toContain(n);
    }
  });

  it('rebuilds exactly the same table from its ref, so a refresh changes nothing', () => {
    for (const set of SETS) {
      const ref = newTable(set, NEW, 4242);
      expect(buildTable(JSON.parse(JSON.stringify(ref)))).withContext(set).toEqual(buildTable(ref));
    }
  });

  it('makes different tables each time', () => {
    for (const set of SETS) {
      const seen = new Set(SEEDS.map(seed => table(set, seed).requirements.join('|')));
      expect(seen.size).withContext(set).toBeGreaterThan(SEEDS.length / 2);
    }
  });

  it('uses both exam-style wording and vague wording, and gets vaguer as the ports are learned', () => {
    const named = (ctx: { level: () => number }) => {
      const needs = SETS.flatMap(set => SEEDS.flatMap(seed => buildTable(newTable(set, ctx, seed)).requirements));
      return needs.filter(n => /^(Allow|Block) /.test(n)).length / needs.length;
    };
    expect(named(NEW)).toBeGreaterThan(0.5);
    expect(named(NEW)).toBeLessThan(0.7);
    expect(named(KNOWN)).toBeGreaterThan(0.12);
    expect(named(KNOWN)).toBeLessThan(0.3);
  });

  it('still rebuilds a table saved before the wording was stored with it', () => {
    const { vague, ...old } = newTable('mail', NEW, 4242);
    expect(vague?.length).toBe(old.flows.length);
    expect(buildTable(old)).toEqual(buildTable(JSON.parse(JSON.stringify(old))));
    expect(buildTable(old).rows.length).toBe(old.flows.length);
  });

  it('stays mostly on the chosen set', () => {
    for (const g of GROUPS) {
      for (const seed of SEEDS) {
        const own = newTable(g.id, NEW, seed).flows.filter(id => flow(id).set === g.id);
        expect(own.length).withContext(`${g.id} ${seed}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  describe('choosing rules by spaced repetition', () => {
    const share = (set: string, ctx: TableContext, fact: string) => SEEDS.filter(seed => factsOf(set, ctx, seed).includes(fact)).length / SEEDS.length;

    it('gives rules that ask for the same fact one memory, under names that never change', () => {
      // These names are saved with the learner's progress. Add new facts; never rename or reuse one.
      expect(FACTS).toEqual([
        'ssh', 'sftp', 'telnet', 'rdp', 'vnc', 'https-in', 'http', 'alt-http', 'alt-https',
        'dns', 'dns-zone', 'dot', 'dhcp', 'dhcp-reply', 'ntp',
        'smtp-in', 'submission', 'smtps', 'pop3', 'pop3s', 'imap', 'imaps',
        'smb', 'tftp', 'ftp', 'ftp-data', 'ftps', 'ftps-data', 'nb-name', 'nb-dgram', 'nb-session',
        'kerberos', 'ldap', 'ldaps', 'radius', 'radius-acct', 'tacacs',
        'snmp', 'snmp-trap', 'syslog', 'syslog-tls', 'ping',
        'ike', 'natt', 'esp', 'ah', 'l2tp', 'pptp', 'ovpn-udp', 'ovpn-tcp', 'wireguard',
        'mssql', 'oracle', 'mysql', 'rpc', 'bgp', 'nntp', 'sip', 'sips', 'mqtt', 'mqtts',
      ]);
      expect(factOf('telnet-block')).toBe('telnet');
      expect(factOf('pptp-block')).toBe('pptp');
      expect(factOf('https-out')).toBe('https-in');
      expect(factOf('https-app')).toBe('https-in');
      // Same port, different thing to know.
      expect(factOf('sftp')).not.toBe(factOf('ssh'));
      expect(factOf('ovpn-tcp')).not.toBe(factOf('ovpn-udp'));
      for (const f of FLOWS) {
        const fact = flow(factOf(f.id));
        expect([fact.set, fact.label, fact.proto, fact.port]).withContext(f.id).toEqual([f.set, f.label, f.proto, f.port]);
      }
    });

    it('never asks for one fact twice in a table', () => {
      for (const set of SETS) {
        for (const seed of SEEDS) {
          const facts = factsOf(set, partway(seed), seed);
          expect(new Set(facts).size).withContext(`${set} ${seed}`).toBe(facts.length);
        }
      }
    });

    it('starts a new learner on the most-tested sets, the same rules whatever the seed', () => {
      for (const seed of SEEDS) {
        expect(new Set(factsOf(MIXED, NEW, seed))).withContext(String(seed)).toEqual(new Set(['ssh', 'telnet', 'rdp', 'https-in', 'http', 'alt-http', 'dns']));
      }
    });

    it('brings missed rules straight back, and lets new rules in only where there is room', () => {
      for (const seed of SEEDS.slice(0, 20)) {
        const first = newTable(MIXED, { ...NEW, now: NOW }, seed).flows;
        const right = first.map((_, i) => i >= 4);
        const memory = rateTable({}, first, right, NOW);
        const next = factsOf(MIXED, { ...NEW, memory }, seed + 1);
        for (const id of first.slice(0, 4)) expect(next).withContext(`${seed} ${id}`).toContain(factOf(id));
        const fresh = next.filter(f => !memory[f]).length;
        expect(fresh).withContext(String(seed)).toBeGreaterThan(0);
        expect(fresh).withContext(String(seed)).toBeLessThanOrEqual(NEW_PER_TABLE);
      }
    });

    it('leaves no room for new rules while a full table of missed ones is waiting', () => {
      const first = newTable(MIXED, { ...NEW, now: NOW }, 5).flows;
      const memory = rateTable({}, first, first.map(() => false), NOW);
      for (const seed of SEEDS) expect(new Set(factsOf(MIXED, { ...NEW, memory }, seed))).toEqual(new Set(first.map(factOf)));
    });

    it('introduces at most three new rules while it has others to ask', () => {
      const memory = memoryOf(FACTS.filter((_, i) => i % 3 === 0), () => learned(60, 1));
      for (const seed of SEEDS) expect(factsOf(MIXED, { ...NEW, memory }, seed).filter(f => !memory[f]).length).withContext(String(seed)).toBe(NEW_PER_TABLE);
      // The same in a set's own table, as long as the set has learned rules to fill it with.
      const other = FACTS.filter(f => setOfFact(f) === 'other');
      const mostly = memoryOf(other.slice(4), () => learned(60, 1));
      for (const seed of SEEDS) expect(factsOf('other', { ...NEW, memory: mostly }, seed).filter(f => !mostly[f]).length).withContext(String(seed)).toBe(NEW_PER_TABLE);
    });

    it('stops introducing new rules once today\'s limit is reached', () => {
      const memory = memoryOf(FACTS.filter((_, i) => i % 2 === 0), () => learned(60, 1));
      for (const seed of SEEDS) {
        expect(factsOf(MIXED, { ...NEW, memory, newLeft: 0 }, seed).filter(f => !memory[f]).length).withContext(String(seed)).toBe(0);
        expect(factsOf(MIXED, { ...NEW, memory, newLeft: 1 }, seed).filter(f => !memory[f]).length).withContext(String(seed)).toBe(1);
      }
    });

    it('asks the due rules most likely forgotten first', () => {
      const files = FACTS.filter(f => setOfFact(f) === 'files');
      // All due, each last answered a day earlier than the one before: the later in the list, the more forgotten.
      const memory = memoryOf(files, (_, i) => learned(2, 3 + i));
      for (const seed of SEEDS) expect(new Set(factsOf('files', { ...NEW, memory }, seed))).withContext(String(seed)).toEqual(new Set(files.slice(-6)));
    });

    it('lets a learned rule rest until it is due', () => {
      const due = FACTS.filter(f => setOfFact(f) === 'mail' || setOfFact(f) === 'vpn');
      const memory = { ...memoryOf(due, () => learned(2, 9)), bgp: learned(10, 2) };
      expect(share(MIXED, { ...NEW, memory }, 'bgp')).toBe(0);
      // Eleven days on it is overdue, and by then more forgotten than rules learned a moment ago.
      const later = { ...memoryOf(due, () => learned(60, 0)), bgp: learned(10, 13) };
      expect(share(MIXED, { ...NEW, memory: later }, 'bgp')).toBe(1);
    });

    it('asks look-alike rules together when one of them is being relearned', () => {
      expect(new Set(LOOKALIKES.flat().filter(id => !FLOWS.some(f => f.id === id)))).toEqual(new Set());
      const rested = allRested();
      // IMAPS was just missed, so its secure and plain neighbors come along although they are not due.
      const lapsed = { ...rested, ...rateTable(rested, ['imaps'], [false], NOW - 15 * MIN) };
      for (const seed of SEEDS) {
        const facts = factsOf(MIXED, { ...NEW, memory: lapsed }, seed);
        expect(facts).withContext(String(seed)).toContain('imaps');
        expect(facts.filter(f => f === 'pop3s' || f === 'imap').length).withContext(String(seed)).toBe(2);
      }
      expect(share(MIXED, { ...NEW, memory: rested }, 'pop3s')).toBeLessThan(0.4);
    });

    it('keeps a mixed table spread over several sets, but never by leaving a due rule out', () => {
      for (const seed of SEEDS) {
        for (const ctx of [NEW, { ...NEW, memory: allRested() }]) {
          const sets = factsOf(MIXED, ctx, seed).map(setOfFact);
          for (const s of new Set(sets)) expect(sets.filter(x => x === s).length).withContext(`${seed} ${s}`).toBeLessThanOrEqual(3);
        }
      }
      const mail = FACTS.filter(f => setOfFact(f) === 'mail');
      const memory = { ...allRested(), ...memoryOf(mail, () => learned(2, 9)) };
      expect(new Set(factsOf(MIXED, { ...NEW, memory }, 3))).toEqual(new Set(mail));
    });

    it('asks a set\'s own rules before anyone else\'s, even when others are due', () => {
      const memory = memoryOf(FACTS.filter(f => setOfFact(f) !== 'web'), () => learned(2, 9));
      for (const seed of SEEDS) {
        const facts = factsOf('web', { ...NEW, memory }, seed);
        expect(facts.filter(f => setOfFact(f) === 'web').length).withContext(String(seed)).toBe(4);
        expect(facts.length).withContext(String(seed)).toBe(6);
      }
    });
  });

  it('builds sound tables for every set', () => {
    const says = (text: string, n: string) => new RegExp(`(?<![\\d./])${n}(?![\\d.])`).test(text);
    for (const set of SETS) {
      for (const seed of SEEDS) {
        const q = table(set, seed);
        const where = `${set} ${seed}`;
        expect(q.rows.length).withContext(where).toBeGreaterThanOrEqual(5);
        expect(q.rows.length).withContext(where).toBe(q.requirements.length);
        expect(q.requirements.join(' ')).withContext(where).not.toMatch(/[{}]|undefined/);
        expect(new Set(q.requirements).size).withContext(where).toBe(q.requirements.length);

        // Nothing shown gives away a port.
        const shown = [q.scenario, ...q.requirements, JSON.stringify(q.diagram).replace(/"ip":"[^"]*"|"subnet":"[^"]*"/g, '')].join(' ');
        for (const r of q.rows) if (/^\d+$/.test(r.answer['Port'])) expect(says(shown, r.answer['Port'])).withContext(`${where} ${r.answer['Port']}`).toBeFalse();

        // Every answer can be chosen, and the two ends of a rule differ unless they are both Any.
        for (const r of q.rows) {
          for (const c of q.columns) if (c !== 'Port') expect(q.choices[c]).withContext(`${where} ${c}`).toContain(r.answer[c]);
          if (r.answer['Source'] !== 'Any') expect(r.answer['Source']).withContext(where).not.toBe(r.answer['Destination']);
        }

        // First match wins, so one port can't be both allowed and blocked in a table.
        const actions = new Map<string, Set<string>>();
        for (const r of q.rows) if (r.answer['Port'] !== 'Not applicable') actions.set(r.answer['Port'], (actions.get(r.answer['Port']) ?? new Set()).add(r.answer['Action']));
        for (const [port, seen] of actions) expect(seen.size).withContext(`${where} ${port}`).toBe(1);

        const answer = { cells: q.rows.map(r => ({ ...r.answer })) };
        expect(isAnswered(q, answer)).withContext(where).toBeTrue();
        expect(gradeQuestion(q, answer).correct).withContext(where).toBeTrue();
      }
    }
  });

  it('draws every network without overlaps, wide and narrow', () => {
    const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const set of SETS) {
      for (const seed of SEEDS) {
        const q = table(set, seed);
        for (const layout of [wideLayout, narrowLayout]) {
          const l = layout(q.diagram as NetDiagram);
          l.zones.forEach((z, i) => {
            expect(z.x >= 0 && z.y >= 0 && z.x + z.w <= l.w && z.y + z.h <= l.h).withContext(`${set} ${seed} ${z.name}`).toBeTrue();
            expect(z.hosts.length).withContext(`${set} ${seed} ${z.name}`).toBeGreaterThan(0);
            for (const h of z.hosts) expect(h.x >= z.x && h.y >= z.y && h.x + ICON_W <= z.x + z.w && h.y + ICON_H <= z.y + z.h).withContext(`${set} ${seed} ${h.host.name}`).toBeTrue();
            l.zones.slice(i + 1).forEach(o => expect(overlaps(z, o)).withContext(`${set} ${seed} ${z.name} ${o.name}`).toBeFalse());
          });
        }
      }
    }
  });
});
