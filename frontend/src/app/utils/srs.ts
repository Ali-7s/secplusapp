/**
 * Spaced repetition with a memory model: FSRS-6, the open-source Free Spaced Repetition Scheduler, with its
 * default parameters (fitted to hundreds of millions of real reviews).
 *
 * Each studied card carries two numbers about your memory of it:
 * - stability: days until the chance of remembering it falls to 90%;
 * - difficulty: 1 to 10, how hard the card is for you, which slows how fast its stability grows.
 * From these the scheduler predicts the chance you still remember a card at any moment (its recall chance) and
 * brings it back when that chance falls to your target (90% unless changed). A review grows stability most when
 * the card was close to forgotten, and least when it was answered while still fresh, so an early or late review is
 * scheduled from what really happened rather than from a fixed multiplier.
 *
 * New cards still go through short learning steps (1 minute, then 10 minutes), and a forgotten card through a
 * 10-minute relearning step. Cards studied under the old SM-2 scheduler carry over: their interval stands in for
 * stability and their ease for difficulty, the first time they are answered again.
 */

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export type CardState = 'learning' | 'review' | 'relearning';

/** A studied card. Cards with no record are "new". */
export interface SrsCard {
  state: CardState;
  /** Index into the learning or relearning steps while in those states. */
  step: number;
  /** Days from the last review to the next one (0 while learning for the first time). */
  interval: number;
  /**
   * The SM-2 growth factor this card was scheduled with before the memory model. Still written (worked out from
   * difficulty: harder cards have lower ease) because older records and stats sort by it.
   */
  ease: number;
  /** When the card is next due (ms since epoch). */
  due: number;
  reps: number;
  lapses: number;
  /** Answers counted as remembered (Hard, Good, Easy) and forgotten (Again), for progress stats. */
  right: number;
  wrong: number;
  /** When the card was last answered anywhere, including answers that did not change its schedule. */
  at: number;
  /** When the card was first studied, for the daily pace on the Today page. Missing on early records. */
  first?: number;
  /** Memory model: days until recall falls to 90%. Missing on records from the SM-2 scheduler. */
  stability?: number;
  /** Memory model: 1 (easy for you) to 10 (hard for you). */
  difficulty?: number;
  /** When stability was last updated by an answer (ms). */
  last?: number;
}

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
export const LEARN_STEPS = [1 * MIN, 10 * MIN];
export const RELEARN_STEPS = [10 * MIN];
const MAX_DAYS = 36500;

/** Days of interval at which a card counts as "mature". */
export const MATURE_DAYS = 21;

/** Forgotten this many times: the card is flagged, because repeating it the same way is not working. */
export const LEECH_LAPSES = 4;

/** The recall chance reviews are timed for, and the choices offered in Review mode's settings. */
export const DEFAULT_RETENTION = 0.9;
export const RETENTION_CHOICES = [0.8, 0.85, 0.9, 0.95] as const;
export const clampRetention = (r: number | undefined) =>
  typeof r === 'number' && Number.isFinite(r) ? Math.min(0.97, Math.max(0.7, r)) : DEFAULT_RETENTION;

// ── The memory model (FSRS-6) ────────────────────────────────────────────────

/** FSRS-6 default parameters w0 to w20, as published with the reference implementation (py-fsrs). */
const W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483,
  0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];
const DECAY = -W[20];
/** Chosen so that recall is exactly 90% when the days elapsed equal the stability. */
const FACTOR = 0.9 ** (1 / DECAY) - 1;
const S_MIN = 0.001;
const GRADE: Record<Rating, number> = { again: 1, hard: 2, good: 3, easy: 4 };

/** The chance of recalling a card `days` after its last review, given its stability. */
export const recallChance = (days: number, stability: number) => (1 + (FACTOR * Math.max(0, days)) / stability) ** DECAY;

/** Days until the recall chance falls to `retention`. */
export const daysUntil = (stability: number, retention: number) => (stability / FACTOR) * (retention ** (1 / DECAY) - 1);

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const initialStability = (g: number) => Math.max(S_MIN, W[g - 1]);
const initialDifficulty = (g: number) => W[4] - Math.exp(W[5] * (g - 1)) + 1;

function nextDifficulty(d: number, g: number): number {
  const damped = d + ((10 - d) * -(W[6] * (g - 3))) / 9;
  return clampD(W[7] * initialDifficulty(4) + (1 - W[7]) * damped);
}

function recallStability(d: number, s: number, r: number, g: number): number {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  return Math.max(S_MIN, s * (1 + Math.exp(W[8]) * (11 - d) * s ** -W[9] * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy));
}

function forgetStability(d: number, s: number, r: number): number {
  const long = W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * Math.exp((1 - r) * W[14]);
  return Math.max(S_MIN, Math.min(long, s / Math.exp(W[17] * W[18])));
}

/** An answer less than a day after the last one: memory has had no time to fade, so stability barely moves. */
function sameDayStability(s: number, g: number): number {
  let grow = Math.exp(W[17] * (g - 3 + W[18])) * s ** -W[19];
  if (g >= 2) grow = Math.max(grow, 1);
  return Math.max(S_MIN, s * grow);
}

/** SM-2 ease and difficulty, mapped onto each other (ease 2.5, the SM-2 start, is difficulty 5). */
const difficultyFromEase = (ease: number) => clampD(5 + (2.5 - ease) * 3.5);
const easeFromDifficulty = (d: number) => Math.round(Math.max(1.3, 2.5 - (d - 5) / 3.5) * 100) / 100;

interface Memory { s: number; d: number; last: number }

/** A card's memory state, or null for a card in its first learning steps under the old scheduler. */
function memoryOf(card: SrsCard): Memory | null {
  if (typeof card.stability === 'number' && typeof card.difficulty === 'number') {
    return { s: card.stability, d: card.difficulty, last: card.last ?? card.at };
  }
  if (card.state === 'learning' && !(card.interval > 0)) return null;
  // An SM-2 record: its interval was about the time to 90% recall, which is what stability means.
  const days = Math.max(card.interval, 1);
  return { s: days, d: difficultyFromEase(card.ease), last: card.state === 'review' ? card.due - days * DAY : card.at };
}

/** The chance you remember a studied card right now (0 to 1), or null for a card never studied. */
export function recallNow(card: SrsCard | undefined, now: number): number | null {
  if (!card) return null;
  const m = memoryOf(card);
  return m ? recallChance((now - m.last) / DAY, m.s) : 0;
}

/** The card's difficulty for you, 1 to 10, on old records too. */
export const difficultyOf = (card: SrsCard) => card.difficulty ?? difficultyFromEase(card.ease);

// ── Fuzz ─────────────────────────────────────────────────────────────────────

/** A number from 0 to 1 that is always the same for the same text. */
function unitHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0) / 0x100000000;
}

/**
 * Nudges an interval of three days or more by a few days either way, so cards learned together do not keep
 * falling due together (and a port's two cards drift apart). Seeded by the card and its answer count, so the
 * label on a rating button is exactly what pressing it gives.
 */
function fuzz(days: number, seed: string | undefined): number {
  if (!seed || days < 2.5) return days;
  let delta = 1;
  for (const [start, end, f] of [[2.5, 7, 0.15], [7, 20, 0.1], [20, Infinity, 0.05]]) delta += f * Math.max(Math.min(days, end) - start, 0);
  const lo = Math.max(2, Math.round(days - delta));
  const hi = Math.min(MAX_DAYS, Math.round(days + delta));
  return lo + Math.floor(unitHash(seed) * (hi - lo + 1));
}

// ── Scheduling ───────────────────────────────────────────────────────────────

export interface ScheduleOptions {
  /** The recall chance to time the next review for (DEFAULT_RETENTION if missing). */
  retention?: number;
  /** The card's progress key, which seeds the fuzz. Without it intervals are not fuzzed. */
  id?: string;
}

/** The card after answering it with `rating` at time `now`. */
export function schedule(card: SrsCard | undefined, rating: Rating, now: number, opts: ScheduleOptions = {}): SrsCard {
  const g = GRADE[rating];
  const retention = clampRetention(opts.retention);
  const base: SrsCard = card ?? { state: 'learning', step: 0, interval: 0, ease: 2.5, due: now, reps: 0, lapses: 0, right: 0, wrong: 0, at: now, first: now };

  const memory = card ? memoryOf(card) : null;
  let s: number;
  let d: number;
  if (!memory) {
    s = initialStability(g);
    d = clampD(initialDifficulty(g));
  } else {
    const elapsed = (now - memory.last) / DAY;
    const r = recallChance(elapsed, memory.s);
    s = elapsed < 1 ? sameDayStability(memory.s, g) : g === 1 ? forgetStability(memory.d, memory.s, r) : recallStability(memory.d, memory.s, r, g);
    d = nextDifficulty(memory.d, g);
  }

  const next: SrsCard = {
    ...base,
    reps: base.reps + 1,
    right: base.right + (rating === 'again' ? 0 : 1),
    wrong: base.wrong + (rating === 'again' ? 1 : 0),
    at: now,
    last: now,
    stability: Math.round(s * 10000) / 10000,
    difficulty: Math.round(d * 10000) / 10000,
    ease: easeFromDifficulty(d),
  };
  const days = Math.min(MAX_DAYS, Math.max(1, Math.round(daysUntil(s, retention))));
  const graduate = (): SrsCard => {
    const ivl = fuzz(days, opts.id && `${opts.id}#${base.reps}`);
    return { ...next, state: 'review', step: 0, interval: ivl, due: now + ivl * DAY };
  };

  if (base.state === 'review' && card) {
    if (rating === 'again') return { ...next, state: 'relearning', step: 0, lapses: base.lapses + 1, interval: days, due: now + RELEARN_STEPS[0] };
    return graduate();
  }

  // Learning (first time) or relearning (after a lapse).
  const steps = base.state === 'relearning' ? RELEARN_STEPS : LEARN_STEPS;
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
      return graduate();
    case 'easy':
      return graduate();
  }
}

/**
 * Records an answer given outside the review queue, such as browsing the deck in flip mode. Forgetting still
 * counts in full, but remembering a review card before it is due only counts the answer: pushing its next review
 * further out early would let a quick browse inflate the schedule.
 */
export function answerOutsideQueue(card: SrsCard | undefined, rating: Rating, now: number, opts: ScheduleOptions = {}): SrsCard {
  if (card?.state === 'review' && card.due > now && rating !== 'again') return { ...card, right: card.right + 1, at: now };
  return schedule(card, rating, now, opts);
}

/** The delay each button would give, for the labels on the rating buttons ("1m", "10m", "4d"). */
export function previewIntervals(card: SrsCard | undefined, now: number, opts: ScheduleOptions = {}): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  for (const r of ['again', 'hard', 'good', 'easy'] as Rating[]) out[r] = formatDelay(schedule(card, r, now, opts).due - now);
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
export const isLeech = (card: SrsCard | undefined) => !!card && card.lapses >= LEECH_LAPSES;

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
  /** Due or new cards held back until tomorrow because their other direction was answered today. */
  held: number;
}

/**
 * Picks the next card: learning cards that are due, then due reviews (the ones you are most likely to have
 * forgotten first), then new cards up to today's limit, then (when nothing else is left) learning cards due
 * within the next 20 minutes.
 *
 * `siblingAt` gives, for a card that has a twin (a port's "which protocol?" and "which port?" cards), when the
 * twin was last answered. A due or new card whose twin was answered today waits for tomorrow, since the twin
 * just showed its answer.
 */
export function nextCard(
  ids: string[], cards: Record<string, SrsCard>, now: number, newLeftToday: number, siblingAt?: (id: string) => number | undefined,
): Queue {
  const today = dayKey(now);
  const heldBack = (id: string) => {
    const at = siblingAt?.(id);
    return at !== undefined && at <= now && dayKey(at) === today;
  };
  const learning = ids.filter(id => isLearning(cards[id])).sort((a, b) => cards[a].due - cards[b].due);
  const learningDue = learning.filter(id => cards[id].due <= now);
  const dueReviews = ids.filter(id => cards[id]?.state === 'review' && cards[id].due <= now);
  const chance = new Map(dueReviews.map(id => [id, recallNow(cards[id], now) ?? 0]));
  const reviews = dueReviews.filter(id => !heldBack(id)).sort((a, b) => chance.get(a)! - chance.get(b)! || cards[a].due - cards[b].due);
  const unseen = ids.filter(id => !cards[id]);
  const fresh = unseen.filter(id => !heldBack(id)).slice(0, Math.max(0, newLeftToday));
  const heldNew = unseen.slice(0, Math.max(0, newLeftToday)).filter(heldBack).length;
  const learnAhead = learning.filter(id => cards[id].due <= now + 20 * MIN);
  const next = learningDue[0] ?? reviews[0] ?? fresh[0] ?? learnAhead[0] ?? null;
  return {
    next,
    newCount: fresh.length,
    learningCount: learnAhead.length,
    reviewCount: reviews.length,
    held: dueReviews.length - reviews.length + heldNew,
  };
}
