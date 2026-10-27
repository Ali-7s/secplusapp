import { LEARN_STEPS, SrsCard, answerOutsideQueue, formatDelay, isMature, nextCard, previewIntervals, schedule } from './srs';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const NOW = Date.UTC(2026, 9, 26, 12);

describe('spaced repetition scheduler', () => {
  it('walks a new card through the learning steps and graduates it to a one-day interval', () => {
    let c = schedule(undefined, 'good', NOW);
    expect(c.state).toBe('learning');
    expect(c.due - NOW).toBe(LEARN_STEPS[1]);
    c = schedule(c, 'good', NOW);
    expect(c.state).toBe('review');
    expect(c.interval).toBe(1);
    expect(c.due - NOW).toBe(DAY);
  });

  it('labels the buttons for a new card with its learning steps', () => {
    expect(previewIntervals(undefined, NOW)).toEqual({ again: '1m', hard: '6m', good: '10m', easy: '4d' });
  });

  it('grows review intervals by the ease, and Easy grows them faster', () => {
    const review: SrsCard = { state: 'review', step: 0, interval: 10, ease: 2.5, due: NOW, reps: 5, lapses: 0, right: 5, wrong: 0, at: NOW };
    expect(schedule(review, 'hard', NOW).interval).toBe(12);
    expect(schedule(review, 'good', NOW).interval).toBe(25);
    expect(schedule(review, 'easy', NOW).interval).toBe(33);
    expect(schedule(review, 'easy', NOW).ease).toBeCloseTo(2.65);
    expect(schedule(review, 'hard', NOW).ease).toBeCloseTo(2.35);
  });

  it('sends a forgotten review card to a 10-minute relearning step, lowers its ease and restarts at one day', () => {
    const review: SrsCard = { state: 'review', step: 0, interval: 30, ease: 2.5, due: NOW, reps: 6, lapses: 0, right: 6, wrong: 0, at: NOW };
    const lapsed = schedule(review, 'again', NOW);
    expect(lapsed.state).toBe('relearning');
    expect(lapsed.due - NOW).toBe(10 * MIN);
    expect(lapsed.ease).toBeCloseTo(2.3);
    expect(lapsed.lapses).toBe(1);
    const back = schedule(lapsed, 'good', NOW);
    expect(back.state).toBe('review');
    expect(back.interval).toBe(1);
  });

  it('never lets the ease fall below 1.3', () => {
    let c: SrsCard = { state: 'review', step: 0, interval: 5, ease: 1.35, due: NOW, reps: 1, lapses: 0, right: 1, wrong: 0, at: NOW };
    c = schedule(c, 'again', NOW);
    expect(c.ease).toBe(1.3);
  });

  it('does not push a review card further out when it is answered early outside the queue', () => {
    const review: SrsCard = { state: 'review', step: 0, interval: 10, ease: 2.5, due: NOW + 5 * DAY, reps: 5, lapses: 0, right: 5, wrong: 0, at: NOW };
    const early = answerOutsideQueue(review, 'good', NOW);
    expect(early.due).toBe(review.due);
    expect(early.right).toBe(6);
    expect(answerOutsideQueue(review, 'again', NOW).state).toBe('relearning');
    expect(answerOutsideQueue(undefined, 'good', NOW).state).toBe('learning');
  });

  it('calls a card mature at a 21-day interval', () => {
    const c: SrsCard = { state: 'review', step: 0, interval: 21, ease: 2.5, due: NOW, reps: 6, lapses: 0, right: 6, wrong: 0, at: NOW };
    expect(isMature(c)).toBeTrue();
    expect(isMature({ ...c, interval: 20 })).toBeFalse();
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
    expect(nextCard(ids, cards, NOW, 2)).toEqual({ next: 'L', newCount: 2, learningCount: 1, reviewCount: 1 });
    expect(nextCard(ids, { R: cards.R, F: cards.F }, NOW, 2).next).toBe('R');
    expect(nextCard(ids, { F: cards.F }, NOW, 2).next).toBe('N1');
  });

  it('learns ahead when nothing else is left, and finishes when nothing is due', () => {
    const cards = { L: learning(NOW + 8 * MIN), F: review(NOW + DAY) };
    expect(nextCard(['L', 'F'], cards, NOW, 0).next).toBe('L');
    expect(nextCard(['F'], { F: cards.F }, NOW, 0).next).toBeNull();
  });
});
