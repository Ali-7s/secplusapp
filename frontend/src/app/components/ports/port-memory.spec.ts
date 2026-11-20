import { SrsCard, schedule } from '../../utils/srs';
import { referenceCards } from '../reference/reference-cards';
import { PORTS } from '../reference/reference-data';
import {
  CardLookup, OldPortLevel, askedFromOldLevels, cardLevel, cardsFromOldLevels, drillAnswer, isDue, isNew, nameCard, nextDue, numberCard, otherSetSince, portLevel, portState,
  setsPracticed, urgency,
} from './port-memory';
import { MAX_LEVEL, transportCard } from './ports-trainer';

const MIN = 60_000, DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 11, 9);
const lookup = (cards: Record<string, SrsCard>): CardLookup => id => cards[id];
/** A learned card with this stability, last reviewed `ago` ms before NOW. */
const learned = (stability: number, ago = 0): SrsCard => ({
  state: 'review', step: 0, interval: Math.round(stability), ease: 2.5, due: NOW - ago + stability * DAY, reps: 3, lapses: 0, right: 3, wrong: 0,
  at: NOW - ago, stability, difficulty: 5, last: NOW - ago,
});

describe('Port memory', () => {
  it('gives every port two Review cards that exist', () => {
    const ids = new Set(referenceCards().map(c => c.id));
    for (const p of PORTS) {
      expect(ids.has(nameCard(p.port))).withContext(p.port).toBeTrue();
      expect(ids.has(numberCard(p.port))).withContext(p.port).toBeTrue();
    }
  });

  it('reads a level from a card: new, learning, learned, a week, three weeks', () => {
    expect(cardLevel(undefined)).toBe(0);
    expect(cardLevel(schedule(undefined, 'good', NOW))).toBe(1);
    expect(cardLevel(schedule(undefined, 'again', NOW))).withContext('missed the first time: started, but no level').toBe(0);
    expect(cardLevel({ ...learned(10), state: 'relearning' })).toBe(1);
    expect(cardLevel(learned(2.3))).toBe(2);
    expect(cardLevel(learned(7))).toBe(3);
    expect(cardLevel(learned(21))).toBe(MAX_LEVEL);
  });

  it('takes a port\'s level from its weaker card, so both directions have to be known', () => {
    const cards = { [nameCard('22')]: learned(30), [numberCard('22')]: learned(3) };
    expect(portLevel('22', lookup(cards))).toBe(2);
    expect(portLevel('22', lookup({ [nameCard('22')]: learned(30) }))).toBe(0);
    expect(portLevel('22', lookup({}))).toBe(0);
  });

  describe('a drill answer', () => {
    it('steps a new card through its learning steps, but not faster than the steps allow', () => {
      const first = drillAnswer(undefined, true, NOW)!;
      expect(first.review).toBeTrue();
      expect(cardLevel(first.card)).toBe(1);

      expect(first.card.due).withContext('the drills\' last step is 20 minutes').toBe(NOW + 20 * MIN);

      const rushed = drillAnswer(first.card, true, NOW + 12 * MIN)!;
      expect(rushed.review).withContext('the 20 minute step is not due yet').toBeFalse();
      expect(rushed.card.due).toBe(first.card.due);
      expect(rushed.card.right).toBe(first.card.right + 1);

      const graduated = drillAnswer(first.card, true, NOW + 21 * MIN)!;
      expect(graduated.review).toBeTrue();
      expect(graduated.card.state).toBe('review');
      expect(cardLevel(graduated.card)).toBe(2);
    });

    it('takes a new port to level 2 only after a round of another set since its last step', () => {
      const first = drillAnswer(undefined, true, NOW)!.card;
      const held = drillAnswer(first, true, NOW + 25 * MIN, {}, false)!;
      expect(held.review).toBeFalse();
      expect(held.card.state).toBe('learning');
      expect(cardLevel(held.card)).toBe(1);
      expect(held.card.due).withContext('still due, so it comes back').toBeLessThanOrEqual(NOW + 25 * MIN);
      expect(cardLevel(drillAnswer(held.card, true, NOW + 30 * MIN, {}, true)!.card)).toBe(2);
      // Only the last step waits for another set: the first right answer and a miss never do.
      expect(drillAnswer(undefined, true, NOW, {}, false)!.review).toBeTrue();
      expect(drillAnswer(first, false, NOW + 25 * MIN, {}, false)!.card.step).toBe(0);
    });

    it('knows whether another set was finished since a card\'s last step', () => {
      const card = drillAnswer(undefined, true, NOW)!.card;
      expect(otherSetSince('25', card, {})).toBeFalse();
      expect(otherSetSince('25', card, { mail: NOW + 5 * MIN })).withContext('its own set does not count').toBeFalse();
      expect(otherSetSince('25', card, { names: NOW - MIN })).withContext('before the step does not count').toBeFalse();
      expect(otherSetSince('25', card, { names: NOW + 5 * MIN })).toBeTrue();
      expect(otherSetSince('25', undefined, {})).toBeTrue();
    });

    it('counts a round for its own set, or for each set a mixed round asked two or more of', () => {
      expect(setsPracticed('mail', ['25', '587'])).toEqual(['mail']);
      expect(setsPracticed('due', ['25', '587', '53', '22', '23', '3389']).sort()).toEqual(['mail', 'remote']);
    });

    it('sends a card back on a miss, whenever it comes', () => {
      const missed = drillAnswer(learned(30), false, NOW)!;
      expect(missed.card.state).toBe('relearning');
      expect(cardLevel(missed.card)).toBe(1);
    });


    it('rates a right answer by its speed: Easy, Good or Hard', () => {
      const card = learned(10, 10 * DAY);
      const at = (speed: 'easy' | 'good' | 'hard') => drillAnswer(card, true, card.due, {}, true, speed).card.stability!;
      expect(at('easy')).toBeGreaterThan(at('good'));
      expect(at('good')).toBeGreaterThan(at('hard'));
    });

    it('never lets a quick answer skip a new card\'s learning steps', () => {
      const first = drillAnswer(undefined, true, NOW, {}, true, 'easy').card;
      expect(first.state).toBe('learning');
      expect(first.due).toBe(NOW + 20 * MIN);
      const slow = drillAnswer(first, true, NOW + 21 * MIN, {}, true, 'hard').card;
      expect(slow.state).withContext('a slow answer repeats the step').toBe('learning');
      expect(drillAnswer(first, true, NOW + 21 * MIN, {}, false, 'easy').card.state).withContext('another set still needed').toBe('learning');
    });

    it('gives an early review less credit than one on time', () => {
      const card = learned(10, 2 * DAY);
      const early = drillAnswer(card, true, NOW)!.card;
      const onTime = drillAnswer(card, true, card.due)!.card;
      expect(early.stability!).toBeGreaterThan(10);
      expect(early.stability!).toBeLessThan(onTime.stability!);
    });

    it('cannot master a port in one day, however often it is drilled', () => {
      let card: SrsCard | undefined;
      for (let m = 0; m < 12 * 60; m += 15) card = drillAnswer(card, true, NOW + m * MIN)!.card;
      expect(cardLevel(card)).toBe(2);
    });

    it('masters a port answered right each time it falls due within a few weeks', () => {
      let card: SrsCard | undefined;
      let t = NOW;
      for (let i = 0; i < 20 && cardLevel(card) < MAX_LEVEL; i++) {
        card = drillAnswer(card, true, t)!.card;
        t = Math.max(card.due, t + MIN);
      }
      expect(cardLevel(card)).toBe(MAX_LEVEL);
      expect((card!.last! - NOW) / DAY).toBeGreaterThan(10);
      expect((card!.last! - NOW) / DAY).toBeLessThan(45);
    });
  });

  it('knows which ports are new, due, and closest to forgotten', () => {
    const cards = lookup({
      [nameCard('22')]: learned(5, 7 * DAY), [numberCard('22')]: learned(30),
      [nameCard('80')]: learned(5, 20 * DAY), [numberCard('80')]: learned(30),
      [nameCard('443')]: learned(5),
    });
    expect(isNew('25', cards)).toBeTrue();
    expect(isDue('25', cards, NOW)).withContext('never started is new, not due').toBeFalse();
    expect(isDue('22', cards, NOW)).toBeTrue();
    expect(isDue('443', cards, NOW)).withContext('its other card is still new').toBeTrue();
    expect(urgency('80', cards, NOW)).toBeLessThan(urgency('22', cards, NOW));
    expect(nextDue('22', cards)).toBe(NOW - 2 * DAY);
    const st = portState('22', cards, NOW);
    expect(st.wants).toEqual({ name: 'due', number: false, transport: 'new' });
  });

  it('gives TCP or UDP its own card, which never moves the level', () => {
    const strong = { [nameCard('22')]: learned(30), [numberCard('22')]: learned(30) };
    const missed = drillAnswer(learned(30), false, NOW).card;
    const cards = lookup({ ...strong, [transportCard('22')]: missed });
    expect(portLevel('22', cards)).withContext('a TCP or UDP miss').toBe(MAX_LEVEL);
    expect(portState('22', cards, NOW + 11 * MIN).wants).toEqual({ name: false, number: false, transport: 'due' });
    expect(isDue('22', cards, NOW + 11 * MIN)).withContext('its TCP or UDP card is due').toBeTrue();
    expect(nextDue('22', cards)).toBe(missed.due);
    expect(isDue('22', lookup(strong), NOW)).withContext('never asked TCP or UDP: not due because of it').toBeFalse();
    expect(isDue('25', lookup({ [transportCard('25')]: missed }), NOW + 11 * MIN)).withContext('a new port answered only TCP or UDP').toBeTrue();
    expect(isNew('25', lookup({ [transportCard('25')]: missed }))).toBeTrue();
  });

  describe('levels from before the drills used FSRS', () => {
    const old = (level: number, at = NOW - 3 * DAY): OldPortLevel => ({ level, right: level, wrong: 0, at, asked: 'name', askedPart: undefined });

    it('become cards a level or so lower, timed from when the port was last drilled', () => {
      const cards = cardsFromOldLevels({ '22': old(4), '23': old(3), '80': old(2), '443': old(1), '25': old(0) }, lookup({}), NOW);
      const levelOf = (port: string) => portLevel(port, lookup(cards));
      expect([levelOf('22'), levelOf('23'), levelOf('80'), levelOf('443'), levelOf('25')]).toEqual([3, 2, 2, 1, 0]);
      expect(cards[nameCard('22')].due).toBe(NOW - 3 * DAY + 8 * DAY);
      expect(cards[nameCard('80')].due).withContext('not drilled for longer than it would last: due now').toBeLessThan(NOW);
      expect(cards[nameCard('22')].at).withContext('stamped now for sync').toBe(NOW);
    });

    it('never weaken a card that already says more', () => {
      const strong = learned(30);
      const cards = cardsFromOldLevels({ '22': old(4) }, lookup({ [nameCard('22')]: strong }), NOW);
      expect(cards[nameCard('22')]).toBeUndefined();
      expect(cards[numberCard('22')]).toBeDefined();
      expect(cardsFromOldLevels({ 'nope': old(4) }, lookup({}), NOW)).toEqual({});
    });

    it('keep how each port was last asked', () => {
      expect(askedFromOldLevels({ '22': old(2), '23': { level: 1, right: 1, wrong: 0, at: 0 } })).toEqual({ '22': { kind: 'name' } });
      expect(askedFromOldLevels({ '67/68': { level: 2, right: 2, wrong: 0, at: 0, asked: 'situation', askedPart: 1 } })).toEqual({ '67/68': { kind: 'situation', part: 1 } });
    });
  });
});
