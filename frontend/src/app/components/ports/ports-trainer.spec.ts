import { PORTS } from '../reference/reference-data';
import { PORT_NAMES, referenceCards } from '../reference/reference-cards';
import {
  GROUPS, MAX_LEVEL, Mastery, QKind, ROUND, SECURE_SWAPS, SITUATIONS, buildQuestion, kindsFor, levelOf, markPracticed, needsOtherSet, pickRound, setsPracticed, updateMastery,
} from './ports-trainer';

/** A seeded random, so round tests are repeatable. */
function seeded(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

/** A different set practiced later than any rise, so only the hour limit applies. */
const OTHER = { web: Number.MAX_SAFE_INTEGER };

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

  it('raises a level at most once an hour, and drops two on a miss', () => {
    const HOUR = 3_600_000;
    const noon = new Date(2026, 10, 5, 12).getTime();
    let m: Mastery = {};
    m = updateMastery(m, '22', true, noon, OTHER);
    m = updateMastery(m, '22', true, noon + 60_000, OTHER);
    m = updateMastery(m, '22', true, noon + HOUR - 1, OTHER);
    expect(levelOf(m, '22')).withContext('three right within the hour').toBe(1);
    expect(m['22'].right).toBe(3);
    m = updateMastery(m, '22', true, noon + HOUR, OTHER);
    expect(levelOf(m, '22')).withContext('an hour after the rise').toBe(2);
    for (let h = 2; h <= 6; h++) m = updateMastery(m, '22', true, noon + h * HOUR, OTHER);
    expect(levelOf(m, '22')).withContext('capped').toBe(MAX_LEVEL);
    m = updateMastery(m, '22', false, noon + 7 * HOUR, OTHER);
    expect(levelOf(m, '22')).toBe(MAX_LEVEL - 2);
    m = updateMastery(updateMastery(m, '22', false, noon + 7 * HOUR, OTHER), '22', false, noon + 7 * HOUR, OTHER);
    expect(levelOf(m, '22')).toBe(0);
    expect(m['22'].wrong).toBe(3);
    // Misses do not start the hour again: only a rise does.
    m = updateMastery(m, '22', true, noon + 7 * HOUR, OTHER);
    expect(levelOf(m, '22')).toBe(1);
  });

  it('lets a port saved under the old once-a-day rule rise', () => {
    const noon = new Date(2026, 10, 5, 12).getTime();
    const saved = { '22': { level: 1, right: 1, wrong: 0, at: noon, day: '2026-11-5' } } as Mastery;
    expect(levelOf(updateMastery(saved, '22', true, noon + 60_000, OTHER), '22')).toBe(2);
  });

  it('holds a port back until a different set is practiced after it went up', () => {
    const HOUR = 3_600_000;
    const noon = new Date(2026, 10, 5, 12).getTime();
    let m = updateMastery({}, '22', true, noon, {});
    expect(levelOf(m, '22')).withContext('a first rise needs nothing').toBe(1);
    m = updateMastery(m, '22', true, noon + 2 * HOUR, { remote: noon + HOUR });
    expect(levelOf(m, '22')).withContext('its own set does not count').toBe(1);
    m = updateMastery(m, '22', true, noon + 3 * HOUR, { web: noon - 1 });
    expect(levelOf(m, '22')).withContext('a set done before the rise does not count').toBe(1);
    const practiced = { web: noon + HOUR };
    expect(needsOtherSet(m, '22', practiced)).toBeFalse();
    m = updateMastery(m, '22', true, noon + 4 * HOUR, practiced);
    expect(levelOf(m, '22')).withContext('a different set since the rise').toBe(2);
    expect(needsOtherSet(m, '22', practiced)).withContext('and the rise starts the wait again').toBeTrue();
  });

  it('still needs the hour after a different set', () => {
    const noon = new Date(2026, 10, 5, 12).getTime();
    const m = updateMastery({}, '22', true, noon, {});
    expect(levelOf(updateMastery(m, '22', true, noon + 60_000, { web: noon + 1 }), '22')).toBe(1);
  });

  it('counts a set round only for that set, and mixed practice for sets it asked enough about', () => {
    expect(setsPracticed('remote', ['22', '22', '80', '443', '53'])).toEqual(['remote']);
    expect(setsPracticed('weak', ['22', '23', '80', '443', '53'])).toEqual(['remote', 'web']);
    expect(markPracticed({ web: 1 }, ['remote'], 5)).toEqual({ web: 1, remote: 5 });
  });

  it('asks every port of a set once, and nothing from other sets', () => {
    const started: Mastery = { '80': { level: 0, right: 0, wrong: 3, at: 1 }, '443': { level: 0, right: 0, wrong: 1, at: 2 } };
    for (const g of GROUPS) {
      for (let s = 1; s <= 20; s++) {
        const round = pickRound(g.ports, started, seeded(s)).map(r => r.port);
        expect([...round].sort()).withContext(`${g.id} ${s}`).toEqual([...g.ports].sort());
      }
    }
  });

  it('asks each port at most once when there are more ports than questions, and picks weak ports most', () => {
    const known = Object.fromEntries(all.slice(0, 20).map(p => [p, { level: 4, right: 4, wrong: 0, at: 0 }])) as Mastery;
    let weak = 0;
    for (let s = 1; s <= 30; s++) {
      const round = pickRound(all, known, seeded(s)).map(r => r.port);
      expect(round.length).toBe(ROUND);
      expect(new Set(round).size).toBe(ROUND);
      weak += round.filter(p => !known[p]).length;
    }
    expect(weak / (30 * ROUND)).toBeGreaterThan(0.8);
  });

  it('asks a port a different way from last time', () => {
    for (const asked of ['name', 'number', 'situation'] as QKind[]) {
      const m = updateMastery({}, '22', false, 1, {}, asked);
      expect(m['22'].asked).toBe(asked);
      for (let s = 1; s <= 20; s++) expect(pickRound(['22'], m, seeded(s))[0].kind).withContext(`${asked} ${s}`).not.toBe(asked);
    }
  });

  it('keeps new ports to the easy kinds', () => {
    for (let s = 1; s <= 10; s++) {
      for (const r of pickRound(all, {}, seeded(s))) expect(['name', 'number', 'situation']).toContain(r.kind);
    }
  });
});
