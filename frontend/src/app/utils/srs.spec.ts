import {
  LEARN_STEPS, SrsCard, answerOutsideQueue, daysUntil, formatDelay, isLeech, isMature, nextCard, previewIntervals, recallChance,
  recallNow, schedule,
} from './srs';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const NOW = new Date(2026, 9, 26, 12).getTime();

/** A review card in the memory model, last reviewed `ago` days before NOW. */
function memoryCard(stability: number, difficulty: number, ago: number, extra: Partial<SrsCard> = {}): SrsCard {
  return {
    state: 'review', step: 0, interval: Math.round(stability), ease: 2.5, due: NOW - ago * DAY + Math.round(stability) * DAY, reps: 5, lapses: 0,
    right: 5, wrong: 0, at: NOW - ago * DAY, last: NOW - ago * DAY, stability, difficulty, ...extra,
  };
}

/** A record saved by the SM-2 scheduler before the memory model, due now. */
const sm2 = (interval: number, ease = 2.5): SrsCard =>
  ({ state: 'review', step: 0, interval, ease, due: NOW, reps: 5, lapses: 0, right: 5, wrong: 0, at: NOW - interval * DAY });

describe('memory model', () => {
  it('puts recall at exactly 90% when the days elapsed equal the stability, and lets it fall slowly after', () => {
    expect(recallChance(0, 10)).toBe(1);
    expect(recallChance(10, 10)).toBeCloseTo(0.9, 10);
    expect(recallChance(30, 10)).toBeLessThan(0.9);
    expect(recallChance(30, 10)).toBeGreaterThan(0.7);
    expect(daysUntil(10, 0.9)).toBeCloseTo(10, 10);
    expect(daysUntil(10, 0.95)).toBeLessThan(5);
    expect(daysUntil(10, 0.8)).toBeGreaterThan(30);
  });
});

describe('spaced repetition scheduler', () => {
  it('walks a new card through the learning steps, then times its first review from the model', () => {
    let c = schedule(undefined, 'good', NOW);
    expect(c.state).toBe('learning');
    expect(c.due - NOW).toBe(LEARN_STEPS[1]);
    expect(c.stability).toBeCloseTo(2.3065, 4);
    c = schedule(c, 'good', NOW + 10 * MIN);
    expect(c.state).toBe('review');
    expect(c.interval).toBe(2);
    expect(c.due - (NOW + 10 * MIN)).toBe(2 * DAY);
  });

  it('takes other learning steps when asked, and keeps relearning as it is', () => {
    const steps = [MIN, 20 * MIN];
    const c = schedule(undefined, 'good', NOW, { learnSteps: steps });
    expect(c.due - NOW).toBe(20 * MIN);
    expect(schedule(c, 'again', NOW + 21 * MIN, { learnSteps: steps }).due - (NOW + 21 * MIN)).toBe(MIN);
    expect(schedule(memoryCard(10, 5, 10), 'again', NOW, { learnSteps: steps }).due - NOW).toBe(10 * MIN);
  });

  it('labels the buttons for a new card with its learning steps', () => {
    expect(previewIntervals(undefined, NOW)).toEqual({ again: '1m', hard: '6m', good: '10m', easy: '8d' });
  });

  it('starts a card you got wrong at first as harder, with less stability, than one you knew', () => {
    const missed = schedule(undefined, 'again', NOW);
    const known = schedule(undefined, 'good', NOW);
    expect(missed.difficulty!).toBeGreaterThan(known.difficulty!);
    expect(missed.stability!).toBeLessThan(known.stability!);
    // The easier card gets the higher SM-2 style ease, which older stats sort by.
    expect(known.ease).toBeGreaterThan(missed.ease);
  });

  it('grows the gap after an on-time review, and Easy more than Good more than Hard', () => {
    const card = memoryCard(10, 5, 10);
    const hard = schedule(card, 'hard', NOW).interval;
    const good = schedule(card, 'good', NOW).interval;
    const easy = schedule(card, 'easy', NOW).interval;
    expect(hard).toBeGreaterThan(10);
    expect(good).toBeGreaterThan(hard);
    expect(easy).toBeGreaterThan(good);
  });

  it('grows the gap more when the card was nearly forgotten, and little when it was still fresh', () => {
    const early = schedule(memoryCard(10, 5, 2), 'good', NOW).stability!;
    const onTime = schedule(memoryCard(10, 5, 10), 'good', NOW).stability!;
    const late = schedule(memoryCard(10, 5, 40), 'good', NOW).stability!;
    expect(early).toBeLessThan(onTime);
    expect(onTime).toBeLessThan(late);
    expect(early).toBeLessThan(onTime / 1.5);
  });

  it('grows hard cards more slowly than easy ones', () => {
    const hardCard = schedule(memoryCard(10, 9, 10), 'good', NOW).interval;
    const easyCard = schedule(memoryCard(10, 2, 10), 'good', NOW).interval;
    expect(easyCard).toBeGreaterThan(hardCard);
  });

  it('sends a forgotten review card to a 10-minute relearning step, cuts its stability and raises its difficulty', () => {
    const card = memoryCard(30, 5, 30);
    const lapsed = schedule(card, 'again', NOW);
    expect(lapsed.state).toBe('relearning');
    expect(lapsed.due - NOW).toBe(10 * MIN);
    expect(lapsed.stability!).toBeLessThan(30);
    expect(lapsed.difficulty!).toBeGreaterThan(5);
    expect(lapsed.lapses).toBe(1);
    const back = schedule(lapsed, 'good', NOW + 10 * MIN);
    expect(back.state).toBe('review');
    expect(back.interval).toBeLessThan(30);
    expect(back.interval).toBeGreaterThanOrEqual(1);
  });

  it('keeps difficulty between 1 and 10', () => {
    let c = memoryCard(5, 9.5, 5);
    for (let i = 0; i < 6; i++) c = schedule(c, 'again', c.due + DAY);
    expect(c.difficulty!).toBeLessThanOrEqual(10);
    let e = memoryCard(5, 1.5, 5);
    for (let i = 0; i < 6; i++) e = schedule(e, 'easy', e.due);
    expect(e.difficulty!).toBeGreaterThanOrEqual(1);
  });

  it('times reviews for the target recall: a higher target gives shorter gaps', () => {
    const card = memoryCard(10, 5, 10);
    const at = (retention: number) => schedule(card, 'good', NOW, { retention }).interval;
    expect(at(0.95)).toBeLessThan(at(0.9));
    expect(at(0.9)).toBeLessThan(at(0.8));
    expect(at(0.9)).toBe(schedule(card, 'good', NOW).interval);
  });

  it('carries over cards saved by the old SM-2 scheduler', () => {
    const old = sm2(10);
    expect(recallNow(old, NOW)).toBeCloseTo(0.9, 5);
    const good = schedule(old, 'good', NOW);
    expect(good.stability!).toBeGreaterThan(10);
    expect(good.interval).toBeGreaterThan(10);
    expect(good.difficulty).toBeCloseTo(5, 0);
    // A low ease (a card often missed) carries over as a high difficulty.
    expect(schedule(sm2(10, 1.3), 'good', NOW).interval).toBeLessThan(good.interval);
    // An SM-2 card still in its first learning steps starts the model on its next answer.
    const learning: SrsCard = { state: 'learning', step: 1, interval: 0, ease: 2.5, due: NOW, reps: 1, lapses: 0, right: 1, wrong: 0, at: NOW - 10 * MIN };
    expect(schedule(learning, 'good', NOW).stability).toBeCloseTo(2.3065, 4);
  });

  it('spreads cards learned together over nearby days, the same way every time for the same card', () => {
    const card = memoryCard(20, 5, 20);
    const plain = schedule(card, 'good', NOW).interval;
    const fuzzed = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const ivl = schedule(card, 'good', NOW, { id: `ref:card${i}` }).interval;
      expect(Math.abs(ivl - plain)).toBeLessThanOrEqual(Math.ceil(plain * 0.1) + 1);
      fuzzed.add(ivl);
    }
    expect(fuzzed.size).toBeGreaterThan(3);
    expect(schedule(card, 'good', NOW, { id: 'acr:SSH' }).interval).toBe(schedule(card, 'good', NOW + 5 * MIN, { id: 'acr:SSH' }).interval);
    // The button label matches what the answer gives.
    const label = previewIntervals(card, NOW, { id: 'acr:SSH' }).good;
    expect(label).toBe(formatDelay(schedule(card, 'good', NOW, { id: 'acr:SSH' }).due - NOW));
  });

  it('does not push a review card further out when it is answered early outside the queue', () => {
    const review = memoryCard(10, 5, 5);
    const early = answerOutsideQueue(review, 'good', NOW);
    expect(early.due).toBe(review.due);
    expect(early.right).toBe(6);
    expect(early.stability).toBe(review.stability);
    expect(answerOutsideQueue(review, 'again', NOW).state).toBe('relearning');
    expect(answerOutsideQueue(undefined, 'good', NOW).state).toBe('learning');
  });

  it('calls a card mature at a 21-day interval, and a leech after four lapses', () => {
    const c = memoryCard(21, 5, 0, { interval: 21 });
    expect(isMature(c)).toBeTrue();
    expect(isMature({ ...c, interval: 20 })).toBeFalse();
    expect(isLeech({ ...c, lapses: 3 })).toBeFalse();
    expect(isLeech({ ...c, lapses: 4 })).toBeTrue();
  });

  it('formats delays as short button labels', () => {
    expect(formatDelay(MIN)).toBe('1m');
    expect(formatDelay(90 * MIN)).toBe('2h');
    expect(formatDelay(3 * DAY)).toBe('3d');
    expect(formatDelay(60 * DAY)).toBe('2mo');
    expect(formatDelay(400 * DAY)).toBe('1.1y');
  });
});

describe('review queue', () => {
  const learning = (due: number): SrsCard => ({ state: 'learning', step: 0, interval: 0, ease: 2.5, due, reps: 1, lapses: 0, right: 0, wrong: 1, at: NOW });
  const review = (due: number): SrsCard => ({ state: 'review', step: 0, interval: 3, ease: 2.5, due, reps: 3, lapses: 0, right: 3, wrong: 0, at: NOW });

  it('shows due learning cards first, then due reviews, then new cards up to the daily limit', () => {
    const cards = { L: learning(NOW - MIN), R: review(NOW - DAY), F: review(NOW + 5 * DAY) };
    const ids = ['N1', 'N2', 'N3', 'R', 'L', 'F'];
    expect(nextCard(ids, cards, NOW, 2)).toEqual({ next: 'L', newCount: 2, learningCount: 1, reviewCount: 1, held: 0 });
    expect(nextCard(ids, { R: cards.R, F: cards.F }, NOW, 2).next).toBe('R');
    expect(nextCard(ids, { F: cards.F }, NOW, 2).next).toBe('N1');
  });

  it('learns ahead when nothing else is left, and finishes when nothing is due', () => {
    const cards = { L: learning(NOW + 8 * MIN), F: review(NOW + DAY) };
    expect(nextCard(['L', 'F'], cards, NOW, 0).next).toBe('L');
    expect(nextCard(['F'], { F: cards.F }, NOW, 0).next).toBeNull();
  });

  it('shows the due review you are most likely to have forgotten first', () => {
    // Both are due. The strong card fell due first, but the weak one has faded further.
    const strong = memoryCard(30, 5, 40);
    const weak = memoryCard(2, 5, 4);
    expect(strong.due).toBeLessThan(weak.due);
    expect(recallNow(weak, NOW)!).toBeLessThan(recallNow(strong, NOW)!);
    expect(nextCard(['S', 'W'], { S: strong, W: weak }, NOW, 0).next).toBe('W');
  });

  it("holds back a port's other card until tomorrow once one direction has been answered today", () => {
    const twin: Record<string, string> = { 'port:22': 'proto:SSH', 'proto:SSH': 'port:22' };
    const due = memoryCard(5, 5, 6);
    const answeredToday = { ...memoryCard(5, 5, 0), at: NOW - 30 * MIN };
    const cards = { 'port:22': answeredToday, 'proto:SSH': due };
    const siblingAt = (id: string) => (twin[id] ? cards[twin[id] as keyof typeof cards]?.at : undefined);
    const q = nextCard(['port:22', 'proto:SSH'], cards, NOW, 0, siblingAt);
    expect(q.next).toBeNull();
    expect(q.reviewCount).toBe(0);
    expect(q.held).toBe(1);
    // Tomorrow it comes up.
    expect(nextCard(['port:22', 'proto:SSH'], cards, NOW + DAY, 0, siblingAt).next).toBe('proto:SSH');
    // A new card whose twin was learned today waits too, and the next new card takes its place.
    const fresh = nextCard(['proto:SSH', 'proto:DNS'], { 'port:22': answeredToday }, NOW, 5, id => (id === 'proto:SSH' ? answeredToday.at : undefined));
    expect(fresh.next).toBe('proto:DNS');
    expect(fresh.held).toBe(1);
  });
});
