import { NetDiagram } from '../../models/exam.model';
import { gradeQuestion, isAnswered } from '../../utils/exam-engine';
import { ICON_H, ICON_W, narrowLayout, wideLayout } from '../practice-exam/network-diagram';
import { PORTS } from '../reference/reference-data';
import { FLOWS, buildTable, newTable } from './firewall-generator';
import { MIXED, portNumbers } from './firewall-scenarios';
import { GROUPS } from './ports-trainer';

const SETS = [...GROUPS.map(g => g.id), MIXED];
const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7919);
const table = (set: string, seed: number) => buildTable(newTable(set, () => 0, seed));
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
      const ref = newTable(set, () => 0, 4242);
      expect(buildTable(JSON.parse(JSON.stringify(ref)))).withContext(set).toEqual(buildTable(ref));
    }
  });

  it('makes different tables each time', () => {
    for (const set of SETS) {
      const seen = new Set(SEEDS.map(seed => table(set, seed).requirements.join('|')));
      expect(seen.size).withContext(set).toBeGreaterThan(SEEDS.length / 2);
    }
  });

  it('uses both exam-style wording and vague wording', () => {
    const needs = SETS.flatMap(set => SEEDS.flatMap(seed => table(set, seed).requirements));
    const named = needs.filter(n => /^(Allow|Block) /.test(n)).length;
    expect(named).toBeGreaterThan(needs.length * 0.3);
    expect(named).toBeLessThan(needs.length * 0.7);
  });

  it('stays mostly on the chosen set', () => {
    for (const g of GROUPS) {
      for (const seed of SEEDS) {
        const own = newTable(g.id, () => 0, seed).flows.filter(id => FLOWS.find(f => f.id === id)!.set === g.id);
        expect(own.length).withContext(`${g.id} ${seed}`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('asks about the weakest ports first', () => {
    const level = (port: string) => (port === '993' ? 0 : 4);
    let hits = 0;
    for (const seed of SEEDS) if (newTable('mail', level, seed).flows.includes('imaps')) hits++;
    expect(hits).toBe(SEEDS.length);
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
