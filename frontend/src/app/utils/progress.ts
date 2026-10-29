/**
 * The study memory: what has been practiced and how it went, kept in the browser (localStorage) and synced
 * between devices when sync is on (see sync.ts). Everything here is pure so it can be unit tested; the
 * ProgressService wraps it with storage.
 */

import { SrsCard } from './srs';

export type ExamDomainKey = 1 | 2 | 3 | 4 | 5;

/** One graded practice exam. */
export interface ExamRecord {
  at: number;
  length: string;
  mode: 'exam' | 'study';
  scaled: number;
  percent: number;
  correct: number;
  total: number;
  /** Percent of points per domain, or null when the exam had no questions from that domain. */
  byDomain: Record<ExamDomainKey, number | null>;
  /** Right answers marked "I'm guessing", and the scaled score with those answers taken out. */
  guessedRight?: number;
  knownScaled?: number;
  /** The objective an objective drill covered, such as "4.6". */
  objective?: string;
}

/** How one practice exam question has gone over time. */
export interface QuestionRecord {
  seen: number;
  right: number;
  /** Whether the most recent attempt was fully correct. */
  last: boolean;
  at: number;
}

/** A glossary card's spaced repetition state (SM-2, see srs.ts) and its results. */
export type CardRecord = SrsCard;

/** The flashcard decks: acronyms, key terms, and cards made from the Reference tables. */
export type CardKind = 'acr' | 'term' | 'ref';
export const CARD_KINDS: readonly CardKind[] = ['acr', 'term', 'ref'];

/** No new cards yet today in any deck. */
export const noNewToday = (): Record<CardKind, number> => ({ acr: 0, term: 0, ref: 0 });

/** Review mode's daily limit on new cards, and how many each deck has introduced today. */
export interface ReviewSettings {
  newPerDay: number;
  /** The local day the counts below belong to ("2026-10-26"). */
  day: string;
  newToday: Record<CardKind, number>;
  /** False when answers are shown without typing them first. Typing is on unless turned off. */
  typeAnswers?: boolean;
}

export const DEFAULT_NEW_PER_DAY = 20;

/** The study plan: the exam date the Today page counts down to. */
export interface StudyPlan {
  /** Local date of the exam, "2026-12-15". */
  examDate?: string;
}

export interface LessonRecord {
  /** The end-of-lesson self-check, last finished attempt. */
  check?: { score: number; total: number; at: number };
  /** Best fraction (0 to 1) reached on each PBQ in the lesson, by question id. */
  pbqs: Record<string, number>;
  completedAt?: number;
  /** The part being read in step-by-step mode, so the lesson reopens where you stopped. */
  part?: number;
  /** When anything in this record last changed, so sync can tell which device's copy is newer. */
  at?: number;
  /**
   * Work in progress on the lesson's exercises (self-check answers, PBQ answers, checklist ticks), keyed by
   * exercise, so it survives a refresh and moves between devices. A value of null means the exercise was reset.
   */
  work?: Record<string, LessonWork>;
}

/** One exercise's saved state and when it was saved. */
export interface LessonWork {
  v: unknown;
  at: number;
}

export interface ProgressData {
  version: 1;
  exams: ExamRecord[];
  questions: Record<string, QuestionRecord>;
  /** Keyed "acr:PKI", "term:Hardening" or "ref:port:22". */
  cards: Record<string, CardRecord>;
  lessons: Record<string, LessonRecord>;
  review: ReviewSettings;
  plan: StudyPlan;
  /** How many things were studied on each local day ("2026-10-26": 41), for streaks. The last 120 days are kept. */
  days: Record<string, number>;
  /** When the exam date or new-cards-per-day setting last changed, so sync keeps the newest choice. */
  settingsAt?: number;
  /** When all progress was last reset. Sync drops anything older, so a reset reaches every device. */
  resetAt?: number;
}

const emptyReview = (): ReviewSettings => ({ newPerDay: DEFAULT_NEW_PER_DAY, day: '', newToday: noNewToday() });

export const emptyProgress = (): ProgressData => ({ version: 1, exams: [], questions: {}, cards: {}, lessons: {}, review: emptyReview(), plan: {}, days: {} });

/** Reads stored progress, tolerating missing or older fields so a bad save never breaks the app. */
export function parseProgress(raw: string | null): ProgressData {
  if (!raw) return emptyProgress();
  try {
    const d = JSON.parse(raw) as Partial<ProgressData>;
    return {
      version: 1,
      exams: Array.isArray(d.exams) ? d.exams : [],
      questions: d.questions && typeof d.questions === 'object' ? d.questions : {},
      cards: d.cards && typeof d.cards === 'object' ? validCards(d.cards) : {},
      lessons: d.lessons && typeof d.lessons === 'object' ? d.lessons : {},
      review: parseReview(d.review),
      plan: d.plan && typeof d.plan === 'object' ? d.plan : {},
      days: d.days && typeof d.days === 'object' ? d.days : {},
      ...(typeof d.settingsAt === 'number' ? { settingsAt: d.settingsAt } : {}),
      ...(typeof d.resetAt === 'number' ? { resetAt: d.resetAt } : {}),
    };
  } catch {
    return emptyProgress();
  }
}

/** Review settings, with a zero count for any deck added since they were saved. */
function parseReview(r: unknown): ReviewSettings {
  if (!r || typeof r !== 'object') return emptyReview();
  const review = { ...emptyReview(), ...(r as Partial<ReviewSettings>) };
  const counts = noNewToday();
  for (const kind of CARD_KINDS) {
    const n = review.newToday?.[kind];
    if (typeof n === 'number' && Number.isFinite(n)) counts[kind] = n;
  }
  return { ...review, newToday: counts };
}

/** Keeps only cards in the current scheduler's shape (an early build saved simpler records). */
function validCards(cards: Record<string, unknown>): Record<string, CardRecord> {
  const out: Record<string, CardRecord> = {};
  for (const [k, c] of Object.entries(cards)) {
    const card = c as Partial<CardRecord> | null;
    if (card && typeof card === 'object' && typeof card.state === 'string' && typeof card.due === 'number' && typeof card.ease === 'number') {
      out[k] = card as CardRecord;
    }
  }
  return out;
}

// ── Spaced repetition ─────────────────────────────────────────────────────

export const isDue = (card: CardRecord | undefined, now: number) => !!card && card.due <= now;

/**
 * Smart order for a flashcard deck: cards due for review first (ones still being learned, then the hardest by
 * ease), then cards never studied, then everything else by when it falls due. Ties keep the deck's own order.
 */
export function smartOrder<T>(items: T[], keyOf: (item: T) => string, cards: Record<string, CardRecord>, now: number): T[] {
  const group = (c: CardRecord | undefined) => (!c ? 1 : c.due <= now ? 0 : 2);
  const learning = (c: CardRecord) => (c.state === 'review' ? 1 : 0);
  return items
    .map((item, i) => ({ item, i, c: cards[keyOf(item)] }))
    .sort((a, b) => {
      const g = group(a.c) - group(b.c);
      if (g) return g;
      if (a.c && b.c) {
        const dueFirst = a.c.due <= now ? learning(a.c) - learning(b.c) || a.c.ease - b.c.ease : 0;
        return dueFirst || a.c.due - b.c.due || a.i - b.i;
      }
      return a.i - b.i;
    })
    .map(x => x.item);
}

// ── Practice exam questions ───────────────────────────────────────────────

export function recordQuestion(prev: QuestionRecord | undefined, correct: boolean, now: number): QuestionRecord {
  return { seen: (prev?.seen ?? 0) + 1, right: (prev?.right ?? 0) + (correct ? 1 : 0), last: correct, at: now };
}

export interface ObjectiveScore {
  objective: string;
  domain: number;
  seen: number;
  right: number;
  /** Fraction right, 0 to 1. */
  rate: number;
}

/**
 * Accuracy per exam objective from every graded question, weakest first. Objectives answered fewer than
 * `minSeen` times are left out, because one unlucky answer is not a weak spot.
 */
export function objectiveScores(
  questions: Record<string, QuestionRecord>,
  objectiveOf: (id: string) => { objective: string; domain: number } | undefined,
  minSeen = 3,
): ObjectiveScore[] {
  const by = new Map<string, ObjectiveScore>();
  for (const [id, r] of Object.entries(questions)) {
    const o = objectiveOf(id);
    if (!o) continue;
    const s = by.get(o.objective) ?? { objective: o.objective, domain: o.domain, seen: 0, right: 0, rate: 0 };
    s.seen += r.seen;
    s.right += r.right;
    by.set(o.objective, s);
  }
  return [...by.values()]
    .filter(s => s.seen >= minSeen)
    .map(s => ({ ...s, rate: s.right / s.seen }))
    .sort((a, b) => a.rate - b.rate || b.seen - a.seen || a.objective.localeCompare(b.objective, undefined, { numeric: true }));
}

/** Question ids for a weak-spots exam: questions last answered wrong, then unseen or shaky ones in the weakest objectives. */
export function weakQuestionIds(
  questions: Record<string, QuestionRecord>,
  pool: { id: string; objective: string }[],
  weakObjectives: string[],
): string[] {
  const missed = pool.filter(q => questions[q.id] && !questions[q.id].last).map(q => q.id);
  const weak = new Set(weakObjectives);
  const more = pool
    .filter(q => weak.has(q.objective) && !missed.includes(q.id) && !(questions[q.id]?.last && questions[q.id].right >= 2))
    .map(q => q.id);
  return [...missed, ...more];
}
