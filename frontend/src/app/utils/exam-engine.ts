import { ChoiceQuestion, ExamDomain, ExamQuestion, isPbq } from '../models/exam.model';

export interface ExamSpec {
  label: string;
  minutes: number;
  pbqs: number;
  /** Multiple choice per domain, following the SY0-701 weights. */
  perDomain?: Record<ExamDomain, number>;
  /** Or a flat count drawn from the whole (filtered) pool. */
  choices?: number;
  /** Only questions linked to a Networking Basics lesson. */
  networking?: boolean;
}

/** How each exam is assembled. PBQs come first, as on the real exam; the rest follows the SY0-701 domain weights. */
export const EXAM_SPECS = {
  full: { label: 'Full exam', minutes: 90, pbqs: 5, perDomain: { 1: 10, 2: 19, 3: 15, 4: 24, 5: 17 } },
  quick: { label: 'Quick set', minutes: 35, pbqs: 2, perDomain: { 1: 3, 2: 6, 3: 5, 4: 8, 5: 6 } },
  network: { label: 'Networking drill', minutes: 30, pbqs: 2, choices: 23, networking: true },
  /** Built from the learner's history: the caller passes only the questions to draw from. */
  weak: { label: 'Weak spots', minutes: 35, pbqs: 2, choices: 28 },
  /** One exam objective, opened from the Objectives page: the caller passes only that objective's questions. */
  objective: { label: 'Objective drill', minutes: 25, pbqs: 1, choices: 15 },
} satisfies Record<string, ExamSpec>;
export type ExamLength = keyof typeof EXAM_SPECS;

export function examSize(length: ExamLength): number {
  const spec: ExamSpec = EXAM_SPECS[length];
  return spec.pbqs + (spec.choices ?? Object.values(spec.perDomain ?? {}).reduce((s, n) => s + n, 0));
}

/** PBQs are worth more than a multiple choice question and earn partial credit; multiple choice is all or nothing. */
export const PBQ_POINTS = 3;
/** CompTIA reports 100 to 900 and passes at 750. Its scaling is not public, so this is a straight-line estimate. */
export const PASSING_SCALED = 750;

export interface ExamItem {
  id: string;
  /** Display order of a choice question's options (indexes into `options`). */
  optionOrder?: number[];
  /** Starting order of an ordering PBQ (indexes into `items`). */
  itemOrder?: number[];
}

export interface ExamAnswer {
  /** Option indexes (original, not display) for single and multi. */
  choices?: number[];
  /** Firewall cells, one record per row keyed by column. */
  cells?: Record<string, string>[];
  /** Match picks, one per prompt. */
  picks?: string[];
  /** Ordering PBQ: item indexes in the learner's order. */
  order?: number[];
}

export interface GradedPart {
  label: string;
  given: string;
  expected: string;
  ok: boolean;
  why: string;
}

export interface GradedQuestion {
  id: string;
  earned: number;
  max: number;
  /** True only for full marks. */
  correct: boolean;
  answered: boolean;
  /** Per row, prompt or position breakdown for PBQs. */
  parts: GradedPart[];
}

export interface ExamGrade {
  earned: number;
  max: number;
  percent: number;
  scaled: number;
  passed: boolean;
  correctCount: number;
  byDomain: Record<ExamDomain, { earned: number; max: number }>;
  results: GradedQuestion[];
}

/** Small seeded generator (mulberry32) so an exam can be rebuilt from its seed after a page reload. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** How many past attempts each question appeared in, keyed by question id. */
export type SeenCounts = Record<string, number>;

/**
 * Draws an exam from the pool: PBQs first, then multiple choice spread by domain weight in random order.
 * Questions seen in fewer past attempts are drawn first, so repeats only start once the pool runs dry.
 */
export function buildExam(pool: readonly ExamQuestion[], length: ExamLength, seed: number, seen: SeenCounts = {}): ExamItem[] {
  const spec: ExamSpec = EXAM_SPECS[length];
  const rand = seededRandom(seed);
  // Random order, then a stable sort by times seen: unseen first, ties stay random.
  const freshFirst = (list: ExamQuestion[]) => shuffled(list, rand).sort((a, b) => (seen[a.id] ?? 0) - (seen[b.id] ?? 0));
  if (spec.networking) pool = pool.filter(q => !!q.lesson);
  // Every exam gets at least one firewall rule table, the PBQ type learners most need practice on.
  const allPbqs = freshFirst(pool.filter(isPbq));
  const firewall = allPbqs.find(q => q.kind === 'firewall');
  const picked = firewall ? [firewall, ...allPbqs.filter(q => q !== firewall)] : allPbqs;
  const pbqs = shuffled(picked.slice(0, spec.pbqs), rand);
  const choices: ExamQuestion[] = [];
  if (spec.perDomain) {
    for (const domain of [1, 2, 3, 4, 5] as ExamDomain[]) {
      const inDomain = pool.filter(q => !isPbq(q) && q.domain === domain);
      choices.push(...freshFirst(inDomain).slice(0, spec.perDomain[domain]));
    }
  } else {
    choices.push(...freshFirst(pool.filter(q => !isPbq(q))).slice(0, spec.choices));
  }
  return [...pbqs, ...shuffled(choices, rand)].map(q => {
    const item: ExamItem = { id: q.id };
    if (q.kind === 'single' || q.kind === 'multi') item.optionOrder = shuffled(range(q.options.length), rand);
    if (q.kind === 'order') {
      let order = shuffled(range(q.items.length), rand);
      // Never hand out an ordering PBQ that is already solved.
      while (q.items.length > 1 && order.every((v, i) => v === i)) order = shuffled(order, rand);
      item.itemOrder = order;
    }
    return item;
  });
}

export function correctIndexes(q: ChoiceQuestion): number[] {
  return q.options.map((o, i) => (o.correct ? i : -1)).filter(i => i >= 0);
}

export function isAnswered(q: ExamQuestion, a: ExamAnswer | undefined): boolean {
  if (!a) return false;
  switch (q.kind) {
    case 'single':
    case 'multi':
      return (a.choices?.length ?? 0) > 0;
    case 'firewall':
      return q.rows.every((_, r) => q.columns.every(c => !!a.cells?.[r]?.[c]));
    case 'match':
      return q.prompts.every((_, i) => !!a.picks?.[i]);
    case 'order':
      return (a.order?.length ?? 0) === q.items.length;
  }
}

/** Has the learner touched the question at all (used for partially filled PBQs in the navigator). */
export function isStarted(q: ExamQuestion, a: ExamAnswer | undefined): boolean {
  if (!a) return false;
  return (a.choices?.length ?? 0) > 0 || (a.picks ?? []).some(Boolean)
    || (a.cells ?? []).some(row => !!row && Object.values(row).some(Boolean)) || !!a.order;
}

const same = (x: string | undefined, y: string) => (x ?? '').trim().toLowerCase() === y.trim().toLowerCase();

export function gradeQuestion(q: ExamQuestion, a: ExamAnswer | undefined, item?: ExamItem): GradedQuestion {
  const answered = isStarted(q, a);
  if (q.kind === 'single' || q.kind === 'multi') {
    const want = correctIndexes(q);
    const got = [...new Set(a?.choices ?? [])].sort((x, y) => x - y);
    const correct = got.length === want.length && got.every((v, i) => v === want[i]);
    return { id: q.id, earned: correct ? 1 : 0, max: 1, correct, answered, parts: [] };
  }
  let parts: GradedPart[] = [];
  if (q.kind === 'firewall') {
    let okCells = 0;
    parts = q.rows.map((row, r) => {
      const cell = (c: string) => a?.cells?.[r]?.[c] ?? '';
      const rowOk = q.columns.filter(c => same(cell(c), row.answer[c])).length;
      okCells += rowOk;
      return {
        label: `Rule ${r + 1}`,
        given: q.columns.map(c => cell(c) || '(blank)').join(' | '),
        expected: q.columns.map(c => row.answer[c]).join(' | '),
        ok: rowOk === q.columns.length,
        why: row.why,
      };
    });
    return finish(q.id, okCells / (q.rows.length * q.columns.length), parts, answered);
  }
  if (q.kind === 'match') {
    parts = q.prompts.map((p, i) => ({
      label: p.label,
      given: a?.picks?.[i] || '(blank)',
      expected: p.answer,
      ok: same(a?.picks?.[i], p.answer),
      why: p.why,
    }));
  } else if (q.kind === 'order') {
    const order = a?.order ?? item?.itemOrder ?? range(q.items.length);
    parts = q.items.map((it, pos) => ({
      label: `Position ${pos + 1}`,
      given: q.items[order[pos]]?.text ?? '(blank)',
      expected: it.text,
      ok: order[pos] === pos,
      why: it.why,
    }));
  }
  return finish(q.id, parts.filter(p => p.ok).length / parts.length, parts, answered);
}

function finish(id: string, fraction: number, parts: GradedPart[], answered: boolean): GradedQuestion {
  const earned = Math.round(fraction * PBQ_POINTS * 100) / 100;
  return { id, earned, max: PBQ_POINTS, correct: fraction === 1, answered, parts };
}

export function scaledScore(fraction: number): number {
  return Math.round(100 + 800 * Math.max(0, Math.min(1, fraction)));
}

export function gradeExam(pool: readonly ExamQuestion[], items: readonly ExamItem[], answers: Record<string, ExamAnswer>): ExamGrade {
  const byId = new Map(pool.map(q => [q.id, q]));
  const byDomain = { 1: { earned: 0, max: 0 }, 2: { earned: 0, max: 0 }, 3: { earned: 0, max: 0 }, 4: { earned: 0, max: 0 }, 5: { earned: 0, max: 0 } } as ExamGrade['byDomain'];
  const results: GradedQuestion[] = [];
  let earned = 0, max = 0;
  for (const item of items) {
    const q = byId.get(item.id);
    if (!q) continue;
    const g = gradeQuestion(q, answers[q.id], item);
    results.push(g);
    earned += g.earned; max += g.max;
    byDomain[q.domain].earned += g.earned;
    byDomain[q.domain].max += g.max;
  }
  const fraction = max ? earned / max : 0;
  const scaled = scaledScore(fraction);
  return {
    earned: Math.round(earned * 100) / 100, max, percent: fraction * 100, scaled, passed: scaled >= PASSING_SCALED,
    correctCount: results.filter(r => r.correct).length, byDomain, results,
  };
}
