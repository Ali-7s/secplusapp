import { NetDiagram } from '../../models/exam.model';
import { gradeQuestion, isAnswered, normalizePort } from '../../utils/exam-engine';
import { ICON_H, ICON_W, narrowLayout, wideLayout } from '../practice-exam/network-diagram';
import { PORTS } from '../reference/reference-data';
import { MIXED, PortScenario, SCENARIOS, portNumbers, portOutcomes, trainerEntry } from './firewall-scenarios';
import { GROUPS } from './ports-trainer';

const numberOf = (row: PortScenario['rows'][number]) => Number(row.answer['Port']);
const transports = (proto: string) => (proto === 'TCP and UDP' ? ['TCP', 'UDP'] : [proto]);
const everyRow = SCENARIOS.flatMap(q => q.rows);

describe('firewall scenarios', () => {
  it('have unique ids and belong to a trainer set or the mixed group', () => {
    expect(new Set(SCENARIOS.map(q => q.id)).size).toBe(SCENARIOS.length);
    const sets = new Set([...GROUPS.map(g => g.id), MIXED]);
    for (const q of SCENARIOS) expect(sets.has(q.set)).withContext(q.id).toBeTrue();
  });

  it('cover every port number in the trainer', () => {
    const typed = new Set(everyRow.map(numberOf));
    for (const e of PORTS) for (const n of portNumbers(e.port)) expect(typed.has(n)).withContext(`${e.protocol} ${n}`).toBeTrue();
  });

  it('cover every transport the trainer lists for a port', () => {
    for (const e of PORTS) {
      const numbers = portNumbers(e.port);
      const used = new Set(everyRow.filter(r => numbers.includes(numberOf(r))).flatMap(r => transports(r.answer['Protocol'])));
      for (const t of e.transport.split('/')) expect(used.has(t)).withContext(`${e.protocol} ${t}`).toBeTrue();
    }
  });

  it('cover each set in that set\'s own scenarios', () => {
    for (const g of GROUPS) {
      const rows = SCENARIOS.filter(q => q.set === g.id).flatMap(q => q.rows).map(numberOf);
      expect(rows.length).withContext(g.id).toBeGreaterThan(0);
      for (const n of g.ports.flatMap(portNumbers)) expect(rows).withContext(`${g.id} ${n}`).toContain(n);
    }
  });

  it('have mixed scenarios and rules for the protocols that have no port', () => {
    expect(SCENARIOS.filter(q => q.set === MIXED).length).toBeGreaterThanOrEqual(5);
    for (const proto of ['ICMP', 'ESP (IP protocol 50)', 'AH (IP protocol 51)']) {
      const rows = everyRow.filter(r => r.answer['Protocol'] === proto);
      expect(rows.length).withContext(proto).toBeGreaterThan(0);
      for (const r of rows) expect(r.answer['Port']).withContext(proto).toBe('Not applicable');
    }
  });

  it('never state a port in the requirements, the story or the diagram', () => {
    const says = (text: string, n: string) => new RegExp(`(?<![\\d./])${n}(?![\\d.])`).test(text);
    for (const q of SCENARIOS) {
      const shown = [q.scenario, ...q.requirements, JSON.stringify(q.diagram).replace(/"ip":"[^"]*"|"subnet":"[^"]*"/g, '')].join(' ');
      for (const r of q.rows) {
        if (/^\d+$/.test(r.answer['Port'])) expect(says(shown, r.answer['Port'])).withContext(`${q.id} ${r.answer['Port']}`).toBeFalse();
      }
    }
  });

  it('only use answers the table offers, one rule for each requirement, each explained', () => {
    for (const q of SCENARIOS) {
      expect(q.rows.length).withContext(q.id).toBe(q.requirements.length);
      expect(q.takeaway.length).withContext(q.id).toBeGreaterThan(20);
      q.rows.forEach((row, r) => {
        for (const c of q.columns) if (c !== 'Port') expect(q.choices[c]).withContext(`${q.id} rule ${r + 1} ${c}`).toContain(row.answer[c]);
        expect(/^(any|not applicable|\d+)$/.test(normalizePort(row.answer['Port']))).withContext(`${q.id} rule ${r + 1} port`).toBeTrue();
        expect(row.why.trim().split(/\s+/).length).withContext(`${q.id} rule ${r + 1} why`).toBeGreaterThanOrEqual(4);
      });
    }
  });

  it('never ask for the same rule twice in one table', () => {
    for (const q of SCENARIOS) {
      const keys = q.rows.map(r => q.columns.map(c => r.answer[c]).join('|'));
      expect(new Set(keys).size).withContext(q.id).toBe(keys.length);
    }
  });

  it('mark correctly when every cell is filled in with the answer', () => {
    for (const q of SCENARIOS) {
      const answer = { cells: q.rows.map(r => ({ ...r.answer })) };
      expect(isAnswered(q, answer)).withContext(q.id).toBeTrue();
      expect(gradeQuestion(q, answer).correct).withContext(q.id).toBeTrue();
    }
  });

  it('draw every network without overlaps, wide and narrow', () => {
    const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const inside = (x: number, y: number, w: number, h: number, box: { x: number; y: number; w: number; h: number }) => x >= box.x && y >= box.y && x + w <= box.x + box.w && y + h <= box.y + box.h;
    for (const q of SCENARIOS) {
      for (const layout of [wideLayout, narrowLayout]) {
        const l = layout(q.diagram as NetDiagram);
        l.zones.forEach((z, i) => {
          expect(inside(z.x, z.y, z.w, z.h, { x: 0, y: 0, w: l.w, h: l.h })).withContext(`${q.id} ${z.name}`).toBeTrue();
          for (const h of z.hosts) expect(inside(h.x, h.y, ICON_W, ICON_H, z)).withContext(`${q.id} ${h.host.name}`).toBeTrue();
          l.zones.slice(i + 1).forEach(o => expect(overlaps(z, o)).withContext(`${q.id} ${z.name} ${o.name}`).toBeFalse());
        });
      }
    }
  });

  describe('counting toward the trainer', () => {
    const q = SCENARIOS.find(s => s.id === 'pf-names')!;
    const perfect = () => q.rows.map(r => ({ ...r.answer }));

    it('finds a port\'s trainer entry, and nothing for Any or N/A', () => {
      expect(trainerEntry('68')).toBe('67/68');
      expect(trainerEntry('138')).toBe('137-139');
      expect(trainerEntry('443')).toBe('443');
      expect(trainerEntry('Any')).toBeUndefined();
      expect(trainerEntry('Not applicable')).toBeUndefined();
    });

    it('reports each port once, right when both Protocol and Port are right', () => {
      expect(portOutcomes(q, perfect()).sort((a, b) => a.port.localeCompare(b.port)))
        .toEqual([{ port: '123', right: true }, { port: '53', right: true }, { port: '67/68', right: true }, { port: '853', right: true }]);
    });

    it('accepts a typed port written differently', () => {
      const cells = perfect();
      cells[0]['Port'] = ' 053 ';
      expect(portOutcomes(q, cells).find(o => o.port === '53')?.right).toBeTrue();
    });

    it('counts a wrong protocol or port as a miss for that port, even if another rule got it right', () => {
      const wrongProto = perfect();
      wrongProto[1]['Protocol'] = 'UDP';
      expect(portOutcomes(q, wrongProto).find(o => o.port === '53')?.right).toBeFalse();
      const wrongPort = perfect();
      wrongPort[4]['Port'] = '69';
      expect(portOutcomes(q, wrongPort).find(o => o.port === '67/68')?.right).toBeFalse();
    });

    it('ignores a wrong source or action, which is not about the port', () => {
      const cells = perfect();
      cells[5]['Remote address'] = 'Any';
      cells[5]['Action'] = 'Deny';
      expect(portOutcomes(q, cells).find(o => o.port === '123')?.right).toBeTrue();
    });
  });
});
