import { TestBed } from '@angular/core/testing';
import { ProgressService } from '../../services/progress.service';
import { SrsCard } from '../../utils/srs';
import { referenceCards } from '../reference/reference-cards';
import { PORTS } from '../reference/reference-data';
import { FACTS, RuleMemory, isCoreFact } from './firewall-generator';
import { loadMemory, rateTable } from './firewall-memory';
import { answersOf, creditReview, creditRule, creditRules, entryOfCard, entryOfFact, factsOfEntry, reviewCardOf, tableCredits } from './port-links';
import { PortLinks } from './port-links.service';
import { CORE_PORTS, GROUPS, Mastery, isCore, startOrder } from './ports-trainer';
import { memoryKey } from './rule-cards';

const MIN = 60_000, DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 10, 9);
/** A rule right twice, ten minutes apart, so it has left its learning steps. */
const learnedAt = (fact: string, at: number): SrsCard => {
  const first = rateTable({}, [fact], [true], at);
  return rateTable(first, [fact], [true], at + 12 * MIN)[fact];
};

describe('core ports', () => {
  it('marks about 25 ports as the ones to learn first', () => {
    expect(CORE_PORTS.length).toBeGreaterThanOrEqual(22);
    expect(CORE_PORTS.length).toBeLessThanOrEqual(28);
    for (const p of ['22', '23', '25', '53', '80', '443', '445', '3389']) expect(isCore(p)).withContext(p).toBeTrue();
    for (const p of ['119', '179', '51820', '1883/8883']) expect(isCore(p)).withContext(p).toBeFalse();
  });

  it('starts drills and introduces rules with the core ports, then the rest', () => {
    const order = startOrder();
    expect([...order].sort()).toEqual(GROUPS.flatMap(g => g.ports).sort());
    expect(order.slice(0, CORE_PORTS.length).every(isCore)).toBeTrue();
    expect(order.slice(CORE_PORTS.length).some(isCore)).toBeFalse();

    const firstExtra = FACTS.findIndex(f => !isCoreFact(f));
    expect(FACTS.slice(firstExtra).some(isCoreFact)).toBeFalse();
    // Every rule about a core port is a core rule, and ping is one too although ICMP has no port.
    for (const fact of FACTS) {
      const port = entryOfFact(fact);
      if (port) expect(isCoreFact(fact)).withContext(fact).toBe(isCore(port));
    }
    expect(isCoreFact('ping')).toBeTrue();
    expect(isCoreFact('esp')).toBeFalse();
  });
});

describe('links between drills, Review cards and firewall rules', () => {
  it('gives every trainer port its firewall rules and a Review card that really exists', () => {
    const ids = new Set(referenceCards().map(c => c.id));
    for (const p of PORTS) {
      expect(factsOfEntry(p.port).length).withContext(p.port).toBeGreaterThan(0);
      expect(ids.has(reviewCardOf(p.port)!)).withContext(p.port).toBeTrue();
      expect(entryOfCard(reviewCardOf(p.port)!)).withContext(p.port).toEqual({ port: p.port, asksNumber: true });
      expect(entryOfCard(`port:${p.port}`)).withContext(p.port).toEqual({ port: p.port, asksNumber: false });
    }
    expect(entryOfCard('raid:RAID 5')).toBeNull();
    expect(entryOfCard('port:99999')).toBeNull();
    // Every rule belongs to one port, except the three with no port at all.
    expect(FACTS.filter(f => !entryOfFact(f)).sort()).toEqual(['ah', 'esp', 'ping']);
  });

  it('knows which ports are one thing to remember and which split into several rules', () => {
    expect(answersOf('22')).toEqual(['TCP 22']);
    expect(factsOfEntry('22')).toEqual(['ssh', 'sftp']);
    expect(answersOf('53')).toEqual(['UDP 53', 'TCP 53']);
    expect(PORTS.filter(p => answersOf(p.port).length > 1).map(p => p.port)).toEqual(['53', '67/68', '137-139', '161/162', '989/990', '1194', '1812/1813', '1883/8883', '5060/5061']);
  });

  describe('an answer given outside the tables', () => {
    it('starts a rule that was new, whatever the answer tested', () => {
      for (const evidence of ['full', 'partial'] as const) {
        const card = creditRule(undefined, true, evidence, NOW);
        expect([card.state, card.due - NOW]).withContext(evidence).toEqual(['learning', 10 * MIN]);
      }
    });

    it('sends a rule back when it is wrong, whatever the answer tested', () => {
      const learned = learnedAt('rdp', NOW - 3 * DAY);
      for (const evidence of ['full', 'partial'] as const) {
        const card = creditRule(learned, false, evidence, NOW);
        expect([card.state, card.lapses, card.due - NOW]).withContext(evidence).toEqual(['relearning', 1, 10 * MIN]);
      }
      expect(creditRule(undefined, false, 'partial', NOW).due - NOW).toBe(1 * MIN);
    });

    it('never moves a rule forward on a partial answer', () => {
      const learned = learnedAt('rdp', NOW - 3 * DAY);
      const after = creditRule(learned, true, 'partial', NOW);
      expect([after.due, after.stability, after.state, after.reps]).toEqual([learned.due, learned.stability, learned.state, learned.reps]);
      expect(after.right).toBe(learned.right + 1);
    });

    it('counts a full answer as a review, but not while the rule waits out a learning step', () => {
      const learned = learnedAt('rdp', NOW - 3 * DAY);
      const after = creditRule(learned, true, 'full', NOW);
      expect(after.due).toBeGreaterThan(learned.due);
      expect(after.stability!).toBeGreaterThan(learned.stability!);

      const started = creditRule(undefined, true, 'full', NOW);
      const tooSoon = creditRule(started, true, 'full', NOW + 2 * MIN);
      expect([tooSoon.state, tooSoon.due]).toEqual([started.state, started.due]);
      expect(creditRule(started, true, 'full', NOW + 11 * MIN).state).toBe('review');
    });

    it('applies to every rule of the port', () => {
      expect(Object.keys(creditRules({}, '67/68', true, 'partial', NOW))).toEqual(['dhcp', 'dhcp-reply']);
      expect(Object.keys(creditRules({}, '3389', false, 'partial', NOW))).toEqual(['rdp']);
    });
  });

  it('turns a checked table into answers for the Review cards: full only when it covered everything the card asks', () => {
    // RDP is one thing. DNS lookups alone are half of what the DNS card asks, both DNS rules are all of it.
    expect(tableCredits(['rdp-block', 'dns', 'ping'], [true, true, true])).toEqual([{ port: '3389', right: true, full: true }, { port: '53', right: true, full: false }]);
    expect(tableCredits(['dns', 'dns-zone'], [true, true])).toEqual([{ port: '53', right: true, full: true }]);
    expect(tableCredits(['dns', 'dns-zone'], [true, false])).toEqual([{ port: '53', right: false, full: false }]);
    // SSH and SFTP share one answer, so either is the whole card.
    expect(tableCredits(['sftp'], [true])).toEqual([{ port: '22', right: true, full: true }]);
  });

  describe('a Review mode answer on a port card', () => {
    const state = (memory: RuleMemory = {}, mastery: Mastery = {}) => ({ mastery, practiced: {}, memory });

    it('moves the port\'s level, and reviews its rules when the card asks for the number', () => {
      const learned = learnedAt('rdp', NOW - 3 * DAY);
      const change = creditReview(state({ rdp: learned }), 'proto:RDP', true, NOW)!;
      expect(change.mastery['3389'].level).toBe(1);
      expect(change.rules['rdp'].due).toBeGreaterThan(learned.due);

      const missed = creditReview(state({ rdp: learned }, { '3389': { level: 3, right: 3, wrong: 0, at: 0 } }), 'proto:RDP', false, NOW)!;
      expect(missed.mastery['3389'].level).toBe(1);
      expect(missed.rules['rdp'].state).toBe('relearning');
    });

    it('leaves the rules alone when the card asks for the name, and only starts them when the port splits into several', () => {
      const byName = creditReview(state(), 'port:3389', true, NOW)!;
      expect(byName.mastery['3389'].level).toBe(1);
      expect(byName.rules).toEqual({});

      const learned = learnedAt('dns', NOW - 3 * DAY);
      const split = creditReview(state({ dns: learned }), 'proto:DNS', true, NOW)!;
      expect(split.rules['dns'].due).toBe(learned.due);
      expect(split.rules['dns-zone'].state).toBe('learning');
      expect(creditReview(state(), 'raid:RAID 5', true, NOW)).toBeNull();
    });

    it('is saved to the trainer and can be taken back', () => {
      localStorage.removeItem('sp-progress');
      const progress = TestBed.inject(ProgressService);
      const links = TestBed.inject(PortLinks);
      const read = () => ({ mastery: progress.lessonWork('ports-trainer', 'mastery') as Mastery | undefined, memory: loadMemory(key => progress.lessonWork('ports-trainer', key)) });

      const undo = links.reviewed('proto:RDP', false)!;
      expect(read().mastery!['3389'].wrong).toBe(1);
      expect(read().memory['rdp'].wrong).toBe(1);
      undo();
      expect(read().mastery).toEqual({});
      expect(read().memory).toEqual({});
      expect(progress.lessonWork('ports-trainer', memoryKey('rdp'))).toBeUndefined();
      expect(links.reviewed('raid:RAID 5', true)).toBeNull();
      localStorage.removeItem('sp-progress');
    });
  });
});
