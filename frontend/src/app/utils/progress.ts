/**
 * The study memory: what has been practiced and how it went, kept in the browser (localStorage) and
 * movable between browsers as a backup file. Everything here is pure so it can be unit tested; the
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

/** Review mode's daily limit on new cards, and how many each deck has introduced today. */
export interface ReviewSettings {
  newPerDay: number;
  /** The local day the counts below belong to ("2026-10-26"). */
  day: string;
  newToday: { acr: number; term: number };
}

export const DEFAULT_NEW_PER_DAY = 20;

export interface LessonRecord {
  /** The end-of-lesson self-check, last finished attempt. */
  check?: { score: number; total: number; at: number };
  /** Best fraction (0 to 1) reached on each PBQ in the lesson, by question id. */
  pbqs: Record<string, number>;
  completedAt?: number;
}

export interface ProgressData {
  version: 1;
  exams: ExamRecord[];
  questions: Record<string, QuestionRecord>;
  /** Keyed "acr:PKI" or "term:Hardening". */
  cards: Record<string, CardRecord>;
  lessons: Record<string, LessonRecord>;
  review: ReviewSettings;
}

const emptyReview = (): ReviewSettings => ({ newPerDay: DEFAULT_NEW_PER_DAY, day: '', newToday: { acr: 0, term: 0 } });

export const emptyProgress = (): ProgressData => ({ version: 1, exams: [], questions: {}, cards: {}, lessons: {}, review: emptyReview() });

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
      review: { ...emptyReview(), ...(d.review && typeof d.review === 'object' ? d.review : {}) },
    };
  } catch {
    return emptyProgress();
  }
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

// ── Backup file ───────────────────────────────────────────────────────────

export const BACKUP_APP = 'secplus-study';

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: 1;
  exportedAt: string;
  /** Every saved key of the app ("sp-..."), as stored. */
  data: Record<string, string>;
}

export function makeBackup(data: Record<string, string>, now: Date): BackupFile {
  return { app: BACKUP_APP, version: 1, exportedAt: now.toISOString(), data };
}

/** Checks an uploaded file really is one of this app's backups; returns its data or an error message. */
export function readBackup(text: string): { data: Record<string, string> } | { error: string } {
  let file: Partial<BackupFile>;
  try {
    file = JSON.parse(text);
  } catch {
    return { error: 'That file is not a backup from this app (it is not valid JSON).' };
  }
  if (file.app !== BACKUP_APP || !file.data || typeof file.data !== 'object') {
    return { error: 'That file is not a backup from this app.' };
  }
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(file.data)) {
    if (k.startsWith('sp-') && typeof v === 'string') data[k] = v;
  }
  return { data };
}
