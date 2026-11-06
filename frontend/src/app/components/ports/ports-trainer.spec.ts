import { PORTS } from '../reference/reference-data';
import { PORT_NAMES, referenceCards } from '../reference/reference-cards';
import {
  GROUPS, MAX_LEVEL, MIX_IN, Mastery, QKind, ROUND, SECURE_SWAPS, SITUATIONS, buildQuestion, kindsFor, levelOf, pickRound, setRound, updateMastery,
} from './ports-trainer';

/** A seeded random, so round tests are repeatable. */
function seeded(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

describe('Ports trainer', () => {
  const all = PORTS.map(p => p.port);

  it('puts every port in exactly one set', () => {
    const grouped = GROUPS.flatMap(g => g.ports);
    expect(new Set(grouped).size).withContext('a port is in two sets').toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...all].sort());
  });

  it('keeps sets small and gives each one memory hooks', () => {
    for (const g of GROUPS) {
      expect(g.ports.length).withContext(g.id).toBeGreaterThanOrEqual(2);
      expect(g.ports.length).withContext(g.id).toBeLessThanOrEqual(8);
      expect(g.hooks.length).withContext(g.id).toBeGreaterThan(0);
    }
  });

  it('has a situation for every port, and swaps only for ports that need one', () => {
    for (const p of all) expect(SITUATIONS[p]).withContext(p).toBeTruthy();
    for (const p of Object.keys(SECURE_SWAPS)) {
      expect(all).withContext(p).toContain(p);
      expect(SECURE_SWAPS[p].to).withContext(p).not.toContain(Number(p));
    }
  });

  it('accepts the right answer to every question it can ask', () => {
    for (const p of PORTS) {
      for (const kind of kindsFor(p.port)) {
        const q = buildQuestion({ kind, port: p.port });
        const right: Record<QKind, string> = {
          name: PORT_NAMES[p.port]?.[0] ?? p.protocol,
          number: p.port.split(/[/-]/).join(' and '),
          transport: q.answer,
          secure: String(SECURE_SWAPS[p.port]?.to[0]),
          situation: p.port.split(/[/-]/)[0],
        };
        expect(q.check(right[kind]).right).withContext(`${kind} ${p.port}: "${right[kind]}"`).toBeTrue();
        expect(q.prompt.trim()).withContext(`${kind} ${p.port}`).toBeTruthy();
      }
    }
  });

  it('rejects clear wrong answers', () => {
    expect(buildQuestion({ kind: 'name', port: '5900' }).check('RDP').right).toBeFalse();
    const ssh = buildQuestion({ kind: 'number', port: '22' });
    expect(ssh.check('23').right).toBeFalse();
    expect(ssh.check('23').note).toContain('Telnet');
    const telnet = buildQuestion({ kind: 'secure', port: '23' });
    expect(telnet.check('23').right).toBeFalse();
    expect(telnet.check('').right).toBeFalse();
    expect(buildQuestion({ kind: 'transport', port: '22' }).check('UDP').right).toBeFalse();
  });

  it('counts answers in the Reference deck', () => {
    const ids = new Set(referenceCards().map(c => c.id));
    for (const p of PORTS) {
      for (const kind of kindsFor(p.port)) {
        const card = buildQuestion({ kind, port: p.port }).card;
        if (card) expect(ids.has(card)).withContext(card).toBeTrue();
      }
    }
  });

  it('raises a level at most once a day, and drops two on a miss', () => {
    const DAY = 86_400_000;
    const noon = new Date(2026, 10, 5, 12).getTime();
    let m: Mastery = {};
    m = updateMastery(m, '22', true, noon);
    m = updateMastery(m, '22', true, noon + 60_000);
    m = updateMastery(m, '22', true, noon + 3_600_000);
    expect(levelOf(m, '22')).withContext('three right in one day').toBe(1);
    expect(m['22'].right).toBe(3);
    for (let d = 1; d <= 5; d++) m = updateMastery(m, '22', true, noon + d * DAY);
    expect(levelOf(m, '22')).withContext('capped').toBe(MAX_LEVEL);
    m = updateMastery(m, '22', false, noon + 6 * DAY);
    expect(levelOf(m, '22')).toBe(MAX_LEVEL - 2);
    m = updateMastery(updateMastery(m, '22', false, noon + 6 * DAY), '22', false, noon + 6 * DAY);
    expect(levelOf(m, '22')).toBe(0);
    expect(m['22'].wrong).toBe(3);
    // A miss does not reset the day: a right answer later the same day still rises only if it has not risen today.
    m = updateMastery(m, '22', true, noon + 6 * DAY);
    expect(levelOf(m, '22')).toBe(1);
  });

  it('mixes ports from other started sets into a set round, spread out', () => {
    const remote = GROUPS[0].ports;
    const started: Mastery = { '80': { level: 1, right: 1, wrong: 0, at: 1 }, '443': { level: 0, right: 0, wrong: 1, at: 2 }, '53': { level: 2, right: 2, wrong: 0, at: 3 } };
    for (let s = 1; s <= 20; s++) {
      const round = setRound(remote, started, seeded(s));
      expect(round.length).toBe(ROUND);
      const outside = round.map((r, i) => (remote.includes(r.port) ? -1 : i)).filter(i => i >= 0);
      expect(outside.length).toBe(MIX_IN);
      for (let i = 1; i < outside.length; i++) expect(outside[i] - outside[i - 1]).toBeGreaterThan(1);
      round.forEach((r, i) => { if (i) expect(r.port).not.toBe(round[i - 1].port); });
    }
    // Before any other set is started, the round is the set alone.
    expect(setRound(remote, {}, seeded(3)).every(r => remote.includes(r.port))).toBeTrue();
  });

  it('never asks the same port twice in a row, and asks weak ports most', () => {
    const ports = ['22', '23', '3389', '5900'];
    const m: Mastery = { '22': { level: 4, right: 4, wrong: 0, at: 0 }, '23': { level: 4, right: 4, wrong: 0, at: 0 }, '3389': { level: 4, right: 4, wrong: 0, at: 0 } };
    const counts: Record<string, number> = {};
    for (let s = 1; s <= 30; s++) {
      const round = pickRound(ports, m, seeded(s));
      expect(round.length).toBe(10);
      round.forEach((r, i) => {
        if (i) expect(r.port).not.toBe(round[i - 1].port);
        counts[r.port] = (counts[r.port] ?? 0) + 1;
      });
    }
    expect(counts['5900']).toBeGreaterThan(counts['22']);
  });

  it('keeps new ports to the easy kinds', () => {
    for (let s = 1; s <= 10; s++) {
      for (const r of pickRound(all, {}, seeded(s))) expect(['name', 'number', 'situation']).toContain(r.kind);
    }
  });
});
