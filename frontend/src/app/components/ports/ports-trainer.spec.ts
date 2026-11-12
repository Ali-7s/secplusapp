import { PORTS } from '../reference/reference-data';
import { PORT_NAMES, referenceCards } from '../reference/reference-cards';
import {
  Asked, GROUPS, MAX_LEVEL, PARTS, PortState, QKind, ROUND, SECURE_SWAPS, SITUATIONS, buildQuestion, kindsFor, pickRound,
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
    for (const p of all) expect(SITUATIONS[p] ?? PARTS[p]).withContext(p).toBeTruthy();
    for (const p of Object.keys(SECURE_SWAPS)) {
      expect(all).withContext(p).toContain(p);
      expect(SECURE_SWAPS[p].to).withContext(p).not.toContain(Number(p));
    }
  });

  it('asks a port with several numbers about one at a time, so every typed answer fits a phone\'s number pad', () => {
    for (const p of all.filter(x => /[/-]/.test(x))) {
      const parts = PARTS[p];
      expect(parts).withContext(p).toBeDefined();
      const [a, b] = p.split(/[/-]/).map(Number);
      const numbers = p.includes('-') ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a, b];
      expect(parts.map(x => x.n).sort((x, y) => x - y)).withContext(p).toEqual(numbers);
      expect(new Set(parts.map(x => x.situation)).size).withContext(p).toBe(parts.length);
    }
    expect(Object.keys(PARTS).every(p => all.includes(p))).toBeTrue();
  });

  it('accepts the right answer to every question it can ask', () => {
    for (const p of PORTS) {
      for (const kind of kindsFor(p.port)) {
        for (const part of PARTS[p.port] && kind !== 'transport' && kind !== 'secure' ? PARTS[p.port].map((_, i) => i) : [undefined]) {
          const q = buildQuestion({ kind, port: p.port, part });
          const n = part === undefined ? p.port : String(PARTS[p.port][part].n);
          const right: Record<QKind, string> = {
            name: PORT_NAMES[p.port]?.[0] ?? p.protocol,
            number: n,
            transport: q.answer,
            secure: String(SECURE_SWAPS[p.port]?.to[0]),
            situation: n,
          };
          const at = `${kind} ${p.port} ${part ?? ''}: "${right[kind]}"`;
          expect(q.check(right[kind]).right).withContext(at).toBeTrue();
          expect(q.prompt.trim()).withContext(at).toBeTruthy();
          if (part !== undefined && kind !== 'name') expect(q.prompt).withContext(at).not.toContain(n);
        }
      }
    }
  });

  it('marks the other number of a pair wrong, and says what that number is for', () => {
    const client = buildQuestion({ kind: 'situation', port: '67/68', part: 1 });
    expect(client.check('68').right).toBeTrue();
    expect(client.check('67').right).toBeFalse();
    expect(client.check('67').note).toBe('67 is for the DHCP server.');
    expect(client.check('6768').right).toBeFalse();
    const traps = buildQuestion({ kind: 'number', port: '161/162', part: 1 });
    expect(traps.prompt).toBe('Which port is for SNMP traps?');
    expect(traps.check('161').note).toBe('161 is for SNMP polling.');
    expect(traps.check('161 162').right).toBeFalse();
    expect(buildQuestion({ kind: 'name', port: '1812/1813', part: 1 }).prompt).toBe('Port 1813: which protocol?');
    // A round saved before pairs were split still opens, on the first number.
    expect(buildQuestion({ kind: 'number', port: '67/68' }).answer).toBe('67');
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

  /** A port's state for a round: its level, which cards want a review, and how it was last asked. */
  const st = (level: number, wants = { name: false, number: false }, asked?: Asked): PortState => ({ level, wants, asked });
  const fresh = () => st(0, { name: true, number: true });

  it('asks every port of a set once, and nothing from other sets', () => {
    for (const g of GROUPS) {
      for (let s = 1; s <= 20; s++) {
        const round = pickRound(g.ports, fresh, seeded(s)).map(r => r.port);
        expect([...round].sort()).withContext(`${g.id} ${s}`).toEqual([...g.ports].sort());
      }
    }
  });

  it('asks each port at most once when there are more ports than questions, and picks weak and due ports most', () => {
    const known = new Set(all.slice(0, 20));
    let weak = 0;
    for (let s = 1; s <= 30; s++) {
      const round = pickRound(all, p => (known.has(p) ? st(MAX_LEVEL) : st(1, { name: true, number: false })), seeded(s)).map(r => r.port);
      expect(round.length).toBe(ROUND);
      expect(new Set(round).size).toBe(ROUND);
      weak += round.filter(p => !known.has(p)).length;
    }
    expect(weak / (30 * ROUND)).toBeGreaterThan(0.8);
  });

  it('asks about the card that is due: the name for "port 22: which protocol?", a number or situation for "SSH: which port?"', () => {
    for (let s = 1; s <= 30; s++) {
      expect(pickRound(['22'], () => st(3, { name: true, number: false }), seeded(s))[0].kind).toBe('name');
      expect(['number', 'situation']).toContain(pickRound(['22'], () => st(3, { name: false, number: true }), seeded(s))[0].kind);
    }
    // With nothing due, a known port may be asked any way at all, TCP or UDP and its secure replacement included.
    const kinds = new Set(Array.from({ length: 60 }, (_, s) => pickRound(['23'], () => st(3), seeded(s + 1))[0].kind));
    expect(kinds).toEqual(new Set(kindsFor('23')));
  });

  it('asks a port a different way from last time', () => {
    for (const kind of ['name', 'number', 'situation'] as QKind[]) {
      for (let s = 1; s <= 20; s++) expect(pickRound(['22'], () => st(0, { name: true, number: true }, { kind }), seeded(s))[0].kind).withContext(`${kind} ${s}`).not.toBe(kind);
    }
  });

  it('asks about the other number of a pair next time', () => {
    for (const part of [0, 1]) {
      for (let s = 1; s <= 20; s++) {
        const next = pickRound(['67/68'], () => st(1, { name: true, number: true }, { kind: 'situation', part }), seeded(s))[0];
        expect(next.kind).withContext(`${part} ${s}`).not.toBe('situation');
        expect(next.part).withContext(`${part} ${s}`).toBe(1 - part);
      }
    }
  });

  it('keeps new ports to the easy kinds', () => {
    for (let s = 1; s <= 10; s++) {
      for (const r of pickRound(all, fresh, seeded(s))) expect(['name', 'number', 'situation']).toContain(r.kind);
      for (const r of pickRound(all, () => st(1), seeded(s))) expect(['name', 'number', 'situation']).toContain(r.kind);
    }
  });
});
