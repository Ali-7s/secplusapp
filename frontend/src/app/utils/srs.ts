/**
 * Spaced repetition using SM-2 with learning steps, the classic flashcard scheduling algorithm.
 *
 * A new card goes through short learning steps (1 minute, then 10 minutes) before it "graduates" to review,
 * where the gap between reviews grows by the card's ease (2.5x at first). Forgetting a review card (Again)
 * sends it through a 10-minute relearning step, lowers its ease and restarts its interval at one day.
 * Hard, Good and Easy tune how fast the gap grows, through the four rating buttons.
 */

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type CardState = 'learning' | 'review' | 'relearning';

/** A studied card. Cards with no record are "new". */
export interface SrsCard {
  state: CardState;
  /** Index into the learning or relearning steps while in those states. */
  step: number;
  /** Review interval in days (0 while learning for the first time). */
  interval: number;
  /** Growth factor for review intervals, 1.3 at the lowest. */
  ease: number;
  /** When the card is next due (ms since epoch). */
  due: number;
  reps: number;
  lapses: number;
  /** Answers counted as remembered (Hard, Good, Easy) and forgotten (Again), for progress stats. */
  right: number;
  wrong: number;
  at: number;
}

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
export const LEARN_STEPS = [1 * MIN, 10 * MIN];
export const RELEARN_STEPS = [10 * MIN];
const GRADUATING_DAYS = 1;
const EASY_DAYS = 4;
const START_EASE = 2.5;
const MIN_EASE = 1.3;
const HARD_FACTOR = 1.2;
const EASY_BONUS = 1.3;
const MAX_DAYS = 36500;

/** Days of interval at which a card counts as "mature". */
export const MATURE_DAYS = 21;

/** The card after answering it with `rating` at time `now`. */
export function schedule(card: SrsCard | undefined, rating: Rating, now: number): SrsCard {
  const base: SrsCard = card ?? { state: 'learning', step: 0, interval: 0, ease: START_EASE, due: now, reps: 0, lapses: 0, right: 0, wrong: 0, at: now };
  const next: SrsCard = {
    ...base,
    reps: base.reps + 1,
    right: base.right + (rating === 'again' ? 0 : 1),
    wrong: base.wrong + (rating === 'again' ? 1 : 0),
    at: now,
  };

  if (base.state === 'review') {
    const ivl = Math.max(base.interval, 1);
    if (rating === 'again') {
      return { ...next, state: 'relearning', step: 0, lapses: base.lapses + 1, ease: Math.max(MIN_EASE, base.ease - 0.2), interval: 1, due: now + RELEARN_STEPS[0] };
    }
    let days: number;
    let ease = base.ease;
    if (rating === 'hard') { days = ivl * HARD_FACTOR; ease = Math.max(MIN_EASE, ease - 0.15); }
    else if (rating === 'good') days = ivl * ease;
    else { days = ivl * ease * EASY_BONUS; ease += 0.15; }
    days = Math.min(MAX_DAYS, Math.max(ivl + 1, Math.round(days)));
    return { ...next, ease, interval: days, due: now + days * DAY };
  }

  // Learning (first time) or relearning (after a lapse).
  const steps = base.state === 'relearning' ? RELEARN_STEPS : LEARN_STEPS;
  const graduate = (days: number): SrsCard => ({ ...next, state: 'review', step: 0, interval: days, due: now + days * DAY });
  switch (rating) {
    case 'again':
      return { ...next, step: 0, due: now + steps[0] };
    case 'hard': {
      // Repeat the current step; on the first step, use the midpoint between the first two.
      const delay = base.step === 0 && steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[Math.min(base.step, steps.length - 1)];
      return { ...next, due: now + delay };
    }
    case 'good':
      if (base.step + 1 < steps.length) return { ...next, step: base.step + 1, due: now + steps[base.step + 1] };
      return graduate(base.state === 'relearning' ? Math.max(1, base.interval) : GRADUATING_DAYS);
    case 'easy':
      return graduate(base.state === 'relearning' ? Math.max(1, base.interval) + 1 : EASY_DAYS);
  }
}

/**
 * Records an answer given outside the review queue, such as browsing the deck in flip mode. Forgetting still
 * counts in full, but remembering a review card before it is due only counts the answer: pushing its next review
 * further out early would let a quick browse inflate the schedule.
 */
export function answerOutsideQueue(card: SrsCard | undefined, rating: Rating, now: number): SrsCard {
  if (card?.state === 'review' && card.due > now && rating !== 'again') return { ...card, right: card.right + 1, at: now };
  return schedule(card, rating, now);
}

/** The delay each button would give, for the labels on the rating buttons ("1m", "10m", "4d"). */
export function previewIntervals(card: SrsCard | undefined, now: number): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  for (const r of ['again', 'hard', 'good', 'easy'] as Rating[]) out[r] = formatDelay(schedule(card, r, now).due - now);
  return out;
}

export function formatDelay(ms: number): string {
  const mins = Math.round(ms / MIN);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(ms / DAY);
  if (days < 31) return `${days}d`;
  const months = days / 30.4;
  if (months < 12) return `${months.toFixed(months < 10 ? 1 : 0).replace(/\.0$/, '')}mo`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, '')}y`;
}

export const isNewCard = (card: SrsCard | undefined) => !card;
export const isLearning = (card: SrsCard | undefined) => !!card && card.state !== 'review';
export const isDueCard = (card: SrsCard | undefined, now: number) => !!card && card.due <= now;
export const isMature = (card: SrsCard | undefined) => !!card && card.state === 'review' && card.interval >= MATURE_DAYS;

/** The local calendar day, for counting new cards per day. */
export const dayKey = (now: number) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export interface Queue {
  /** The card to show next, or null when the session is finished. */
  next: string | null;
  newCount: number;
  learningCount: number;
  reviewCount: number;
}

/**
 * Picks the next card: learning cards that are due, then due reviews, then new cards up to
 * today's limit, then (when nothing else is left) learning cards due within the next 20 minutes.
 */
export function nextCard(ids: string[], cards: Record<string, SrsCard>, now: number, newLeftToday: number): Queue {
  const learning = ids.filter(id => isLearning(cards[id])).sort((a, b) => cards[a].due - cards[b].due);
  const learningDue = learning.filter(id => cards[id].due <= now);
  const reviews = ids.filter(id => cards[id]?.state === 'review' && cards[id].due <= now).sort((a, b) => cards[a].due - cards[b].due);
  const fresh = ids.filter(id => !cards[id]).slice(0, Math.max(0, newLeftToday));
  const learnAhead = learning.filter(id => cards[id].due <= now + 20 * MIN);
  const next = learningDue[0] ?? reviews[0] ?? fresh[0] ?? learnAhead[0] ?? null;
  return { next, newCount: fresh.length, learningCount: learning.filter(id => cards[id].due <= now + 20 * MIN).length, reviewCount: reviews.length };
}
