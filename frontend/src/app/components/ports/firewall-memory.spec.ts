import { DEFAULT_RETENTION, SrsCard, recallNow } from '../../utils/srs';
import { FACTS, RuleMemory, buildTable, newTable } from './firewall-generator';
import { comesBack, factsIn, loadMemory, memoryFromHistory, memoryKey, newRulesLeft, rateTable, ruleCounts } from './firewall-memory';
import { MIXED, portsRight } from './firewall-scenarios';
import { savedRuleCounts } from './rule-cards';

const MIN = 60_000, DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 10, 9);
const rate = (memory: RuleMemory, flow: string, right: boolean, at: number): RuleMemory => ({ ...memory, ...rateTable(memory, [flow], [right], at) });

describe('firewall rule memory', () => {
  it('brings a missed rule back in a minute and a right one in ten', () => {
    const m = rateTable({}, ['ssh', 'rdp'], [false, true], NOW);
    expect(m['ssh'].due - NOW).toBe(1 * MIN);
    expect(m['rdp'].due - NOW).toBe(10 * MIN);
    expect(m['ssh'].state).toBe('learning');
  });

  it('sends a rule away for days once it has been right twice, and for longer each time after', () => {
    let m = rate({}, 'ssh', true, NOW);
    m = rate(m, 'ssh', true, NOW + 12 * MIN);
    expect(m['ssh'].state).toBe('review');
    const gaps = [m['ssh'].due - (NOW + 12 * MIN)];
    for (let i = 0; i < 3; i++) {
      const at = m['ssh'].due;
      m = rate(m, 'ssh', true, at);
      gaps.push(m['ssh'].due - at);
    }
    expect(gaps[0]).toBeGreaterThanOrEqual(1 * DAY);
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).withContext(String(i)).toBeGreaterThan(gaps[i - 1]);
    expect(gaps[3]).toBeGreaterThan(14 * DAY);
  });

  it('times each review for the recall chance asked for', () => {
    let m = rate({}, 'ssh', true, NOW);
    m = rate(m, 'ssh', true, NOW + 12 * MIN);
    m = rate(m, 'ssh', true, m['ssh'].due);
    const strict = rateTable(m, ['ssh'], [true], m['ssh'].due, 0.95)['ssh'];
    const normal = rateTable(m, ['ssh'], [true], m['ssh'].due, DEFAULT_RETENTION)['ssh'];
    expect(strict.interval).toBeLessThan(normal.interval);
    // Not fuzzed past the point: on its due day the chance is near the target.
    expect(recallNow(normal, normal.due)!).toBeGreaterThan(0.85);
    expect(recallNow(normal, normal.due)!).toBeLessThan(0.95);
  });

  it('forgets most of a learned rule that is missed, and asks again within minutes', () => {
    let m = rate({}, 'ssh', true, NOW);
    m = rate(m, 'ssh', true, NOW + 12 * MIN);
    m = rate(m, 'ssh', true, m['ssh'].due);
    const before = m['ssh'];
    m = rate(m, 'ssh', false, before.due);
    expect(m['ssh'].state).toBe('relearning');
    expect(m['ssh'].lapses).toBe(1);
    expect(m['ssh'].stability!).toBeLessThan(before.stability! / 2);
    expect(m['ssh'].due - before.due).toBe(10 * MIN);
  });

  it('keeps one memory for the allow and the block version of a rule', () => {
    const m = rateTable({}, ['telnet-block'], [false], NOW);
    expect(Object.keys(m)).toEqual(['telnet']);
    expect(Object.keys(rateTable({}, ['https-out', 'pptp-block'], [true, true], NOW))).toEqual(['https-in', 'pptp']);
  });

  it('counts a rule as known when the protocol and port are right, whatever else is wrong', () => {
    const q = buildTable(newTable(MIXED, { level: () => 0, now: NOW }, 11));
    const cells = q.rows.map(r => ({ ...r.answer }));
    cells[0] = { ...cells[0], Source: 'Any', Action: cells[0]['Action'] === 'Allow' ? 'Deny' : 'Allow' };
    cells[1] = { ...cells[1], Port: '1' };
    cells[2] = { ...cells[2], Protocol: cells[2]['Protocol'] === 'TCP' ? 'UDP' : 'TCP' };
    expect(portsRight(q, cells)).toEqual(q.rows.map((_, i) => i !== 1 && i !== 2));
    expect(portsRight(q, undefined)).toEqual(q.rows.map(() => false));
  });

  it('counts the rules due, new and learned, and says when the next is due', () => {
    let m = rate({}, 'ssh', true, NOW);
    m = rate(m, 'ssh', true, NOW + 12 * MIN);
    m = rate(m, 'rdp', false, NOW + 12 * MIN);
    const soon = ruleCounts(m, factsIn('remote'), NOW + 12 * MIN);
    expect(soon).toEqual({ total: 5, due: 0, fresh: 3, learned: 1, next: NOW + 13 * MIN });
    const later = ruleCounts(m, factsIn('remote'), NOW + 20 * MIN);
    expect([later.due, later.next]).toEqual([1, null]);
    expect(ruleCounts(m, factsIn(MIXED), NOW + 20 * MIN).total).toBe(FACTS.length);
    expect(ruleCounts({}, factsIn('web'), NOW)).toEqual({ total: 4, due: 0, fresh: 4, learned: 0, next: null });
  });

  it('counts down the new rules left for today', () => {
    const m = rateTable({}, ['ssh', 'rdp', 'vnc'], [true, false, true], NOW);
    expect(newRulesLeft(m, 20, NOW + 60 * MIN)).toBe(17);
    expect(newRulesLeft(m, 2, NOW + 60 * MIN)).toBe(0);
    expect(newRulesLeft(m, 20, NOW + 2 * DAY)).toBe(20);
  });

  it('says when each rule of a table comes back, soonest first', () => {
    let m = rate({}, 'ssh', true, NOW - 12 * MIN);
    m = { ...m, ...rateTable(m, ['ssh', 'telnet-block', 'rdp'], [true, false, true], NOW) };
    const back = comesBack(m, ['ssh', 'telnet-block', 'rdp'], NOW);
    expect(back.map(b => b.label)).toEqual(['Telnet', 'RDP', 'SSH']);
    expect(back.map(b => b.when)).toEqual(['1m', '10m', '2d']);
    expect(back.map(b => b.soon)).toEqual([true, true, false]);
    expect(comesBack(m, ['telnet'], NOW + 5 * MIN)[0].when).toBe('now');
  });

  it('reads saved cards back and ignores anything that is not one', () => {
    const m = rateTable({}, ['ssh', 'rdp'], [true, false], NOW);
    const saved: Record<string, unknown> = { [memoryKey('ssh')]: m['ssh'], [memoryKey('rdp')]: { due: 'soon' }, [memoryKey('vnc')]: null, 'fw:m:not-a-rule': m['rdp'] };
    expect(loadMemory(key => saved[key])).toEqual({ ssh: m['ssh'] });
  });

  it('counts due and learned rules from the saved work alone, for the Today page', () => {
    let m = rate({}, 'ssh', true, NOW);
    m = rate(m, 'ssh', true, NOW + 12 * MIN);
    m = rate(m, 'rdp', false, NOW + 12 * MIN);
    const work: Record<string, { v: unknown }> = { mastery: { v: {} }, [memoryKey('ssh')]: { v: m['ssh'] }, [memoryKey('rdp')]: { v: m['rdp'] }, [memoryKey('vnc')]: { v: null } };
    expect(savedRuleCounts(work, NOW + 20 * MIN)).toEqual({ due: 1, learned: 1 });
    expect(savedRuleCounts(work, NOW + 5 * DAY)).toEqual({ due: 2, learned: 1 });
    expect(savedRuleCounts(undefined, NOW)).toEqual({ due: 0, learned: 0 });
  });

  it('starts from the older table history, with every rule in it due', () => {
    const history = { n: 3, rules: {
      ssh: { asked: 2, missed: 0, ok: true, at: 1 }, 'telnet-block': { asked: 1, missed: 1, ok: false, at: 2 },
      telnet: { asked: 1, missed: 0, ok: true, at: 3 }, bgp: { asked: 1, missed: 1, ok: false, at: 3 }, gone: { asked: 1, missed: 0, ok: true, at: 1 },
    } };
    const practiced: Record<string, number> = { '22': NOW - 3 * DAY, '23': NOW - 3 * DAY };
    const m = memoryFromHistory(history, port => practiced[port], NOW);
    expect(Object.keys(m).sort()).toEqual(['bgp', 'ssh', 'telnet']);
    // The latest answer for Telnet was right, in whichever version it was asked.
    expect(m['telnet'].right).toBe(1);
    expect(m['bgp'].wrong).toBe(1);
    for (const card of Object.values(m) as SrsCard[]) expect(card.due).toBeLessThanOrEqual(NOW + MIN);
    expect(m['ssh'].last).toBe(NOW - 3 * DAY);
    // Right again three days on: the gap really was three days, so it goes out further than a rule first seen today.
    const again = rateTable(m, ['ssh'], [true], NOW)['ssh'];
    expect(again.state).toBe('review');
    expect(again.interval).toBeGreaterThan(4);
    // A rule that was missed needs two right answers before it goes away for days.
    expect(rateTable(m, ['bgp'], [true], NOW + 5 * MIN)['bgp'].state).toBe('learning');
    expect(memoryFromHistory({}, () => undefined, NOW)).toEqual({});
  });
});
