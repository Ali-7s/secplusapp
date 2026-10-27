/**
 * The Today page's study plan: what to do today, whether the pace will cover everything before the exam date,
 * and an honest readiness estimate. Pure functions over numbers the page gathers, so they can be unit tested.
 */

import { ExamRecord } from './progress';

const DAY = 24 * 60 * 60 * 1000;

/** The last stretch before the exam, kept for review and full practice exams rather than new material. */
export const REVIEW_WINDOW_DAYS = 14;
/** Readiness wants a margin over the 750 pass mark, because practice scores are only an estimate. */
export const READY_SCORE = 800;
export const PASS_SCORE = 750;

export type Phase = 'none' | 'learn' | 'review' | 'final' | 'past';

export interface DeckState {
  label: string;
  /** Route of the glossary page, such as "/acronyms". */
  path: string;
  total: number;
  studied: number;
  due: number;
  /** New cards Review mode will still introduce today. */
  newLeftToday: number;
}

export interface PlanInput {
  now: number;
  /** Local date, "2026-12-15". */
  examDate?: string;
  decks: DeckState[];
  newPerDay: number;
  nextLesson?: { slug: string; number: number; title: string };
  exams: ExamRecord[];
  /** Objectives scoring under 75%, weakest first. */
  weakObjectives: string[];
  /** Objectives with no answered questions yet, in exam order. */
  untestedObjectives: string[];
  /** Exam questions last answered wrong. */
  missedQuestions: number;
  /** Study activity per local day. */
  days: Record<string, number>;
}

export interface TaskLink {
  label: string;
  path: string;
  query?: Record<string, string>;
}

export interface PlanTask {
  id: 'reviews' | 'new' | 'lesson' | 'practice' | 'objective' | 'rest';
  icon: string;
  title: string;
  detail: string;
  links: TaskLink[];
  done: boolean;
}

export interface Pace {
  unseen: number;
  /** Days left to meet new material before the review window starts. */
  learnDays: number;
  /** New cards per day, per deck, needed to see every card before the review window. */
  neededPerDay: number;
  onTrack: boolean;
}

export interface Readiness {
  verdict: 'unknown' | 'not-yet' | 'borderline' | 'ready';
  /** Average of the last three full or quick exams, using the score without lucky guesses when recorded. */
  average: number | null;
  examsCounted: number;
  testedObjectives: number;
  studiedShare: number;
  reasons: string[];
}

export interface Plan {
  daysLeft: number | null;
  phase: Phase;
  tasks: PlanTask[];
  pace: Pace | null;
  readiness: Readiness;
  streak: number;
  activeLast7: number;
}

/** Local calendar date for a timestamp, "2026-10-26". */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days from today to a local date ("2026-12-15"); 0 on the day itself, negative once it has passed. */
export function daysUntil(date: string, now: number): number {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
  return Math.round((target - today) / DAY);
}

export function phaseFor(daysLeft: number | null): Phase {
  if (daysLeft === null) return 'none';
  if (daysLeft < 0) return 'past';
  if (daysLeft <= 2) return 'final';
  if (daysLeft <= REVIEW_WINDOW_DAYS) return 'review';
  return 'learn';
}

/** Consecutive days with study, counting back from today (or from yesterday when today has none yet). */
export function streak(days: Record<string, number>, now: number): number {
  let n = 0;
  let t = (days[localDate(now)] ?? 0) > 0 ? now : now - DAY;
  while ((days[localDate(t)] ?? 0) > 0) {
    n++;
    t -= DAY;
  }
  return n;
}

export function activeDays(days: Record<string, number>, now: number, span = 7): number {
  let n = 0;
  for (let i = 0; i < span; i++) if ((days[localDate(now - i * DAY)] ?? 0) > 0) n++;
  return n;
}

/** New cards per day, per deck, needed to meet every card before the last two weeks. */
export function pace(decks: DeckState[], daysLeft: number | null, newPerDay: number): Pace | null {
  if (daysLeft === null || daysLeft < 0) return null;
  const unseen = decks.reduce((s, d) => s + d.total - d.studied, 0);
  const learnDays = Math.max(1, daysLeft - REVIEW_WINDOW_DAYS);
  const neededPerDay = Math.max(0, ...decks.map(d => Math.ceil((d.total - d.studied) / learnDays)));
  return { unseen, learnDays, neededPerDay, onTrack: neededPerDay <= newPerDay };
}

const isBenchmark = (e: ExamRecord) => e.length === 'full' || e.length === 'quick';

export function readiness(input: Pick<PlanInput, 'exams' | 'decks'>, testedObjectives: number, totalObjectives: number): Readiness {
  const recent = input.exams.filter(isBenchmark).slice(-3);
  const scores = recent.map(e => e.knownScaled ?? e.scaled);
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const total = input.decks.reduce((s, d) => s + d.total, 0);
  const studiedShare = total ? input.decks.reduce((s, d) => s + d.studied, 0) / total : 0;
  const reasons: string[] = [];
  let verdict: Readiness['verdict'];
  if (average === null) {
    verdict = 'unknown';
    reasons.push('Take a full exam or a quick set to get a score to judge by.');
  } else {
    if (average >= READY_SCORE) verdict = 'ready';
    else if (average >= PASS_SCORE) verdict = 'borderline';
    else verdict = 'not-yet';
    reasons.push(`Your last ${recent.length === 1 ? 'practice score is' : recent.length + ' practice scores average'} ${average}; aim for ${READY_SCORE} or more to leave a margin over ${PASS_SCORE}.`);
    if (recent.length < 3) reasons.push('A single score swings a lot. Three full or quick exams give a steadier picture.');
  }
  if (testedObjectives < totalObjectives) {
    reasons.push(`${totalObjectives - testedObjectives} of ${totalObjectives} objectives have not been tested enough to judge.`);
    if (verdict === 'ready' && testedObjectives < totalObjectives * 0.85) verdict = 'borderline';
  }
  return { verdict, average, examsCounted: recent.length, testedObjectives, studiedShare, reasons };
}

/** Today's tasks, most important first. */
export function planTasks(input: PlanInput, phase: Phase, daysLeft: number | null): PlanTask[] {
  const today = localDate(input.now);
  const on = (ms?: number) => !!ms && localDate(ms) === today;
  const tasks: PlanTask[] = [];

  if (phase === 'final') {
    tasks.push({
      id: 'rest', icon: 'bedtime', done: false,
      title: daysLeft === 0 ? 'Exam day: you have done the work' : 'Light review only',
      detail: daysLeft === 0
        ? 'Skim the reference sheet over breakfast if it calms you, read every question to its last sentence, and flag hard ones to revisit.'
        : 'Do your due reviews and skim the reference sheet. No new material and no full exams now; sleep does more for your score than cramming.',
      links: [{ label: 'Reference sheet', path: '/reference' }],
    });
  }

  const due = input.decks.reduce((s, d) => s + d.due, 0);
  const reviewDecks = input.decks.filter(d => d.due > 0);
  tasks.push({
    id: 'reviews', icon: 'event_repeat', done: due === 0,
    title: due ? `Review ${due} due card${due === 1 ? '' : 's'}` : 'Reviews: all caught up',
    detail: due
      ? 'Cards spaced repetition says you are about to forget. Do these first; they take the least time for the most memory.'
      : 'Nothing is due right now. Cards you have studied come back here when it is time.',
    links: reviewDecks.map(d => ({ label: `${d.label} (${d.due})`, path: d.path, query: { mode: 'review' } })),
  });

  if (phase === 'learn' || phase === 'none' || phase === 'past') {
    const unseen = input.decks.filter(d => d.total > d.studied);
    if (unseen.length) {
      const left = input.decks.reduce((s, d) => s + Math.min(d.newLeftToday, d.total - d.studied), 0);
      tasks.push({
        id: 'new', icon: 'add_card', done: left === 0,
        title: left ? `Learn up to ${left} new card${left === 1 ? '' : 's'}` : 'New cards: today\'s limit reached',
        detail: left
          ? `Review mode introduces up to ${input.newPerDay} new cards a day in each deck and brings them back on schedule.`
          : 'Come back tomorrow for more, or raise the limit in Review mode if your pace needs it.',
        links: left ? unseen.filter(d => d.newLeftToday > 0).map(d => ({ label: d.label, path: d.path, query: { mode: 'review' } })) : [],
      });
    }
  }

  if (input.nextLesson && phase !== 'final') {
    const l = input.nextLesson;
    tasks.push({
      id: 'lesson', icon: 'lan', done: false,
      title: `Lesson ${l.number}: ${l.title}`,
      detail: 'The next Networking Basics lesson. Finishing its self-check marks it complete.',
      links: [{ label: 'Open the lesson', path: `/networking/${l.slug}` }],
    });
  }

  if (phase !== 'final') {
    const benchmarks = input.exams.filter(isBenchmark);
    const lastFull = [...input.exams].reverse().find(e => e.length === 'full');
    const practicedToday = [...input.exams].reverse().find(e => on(e.at) && (isBenchmark(e) || e.length === 'weak'));
    const practice: PlanTask = { id: 'practice', icon: 'assignment', done: false, title: '', detail: '', links: [] };
    if (practicedToday) {
      const name = { full: 'full exam', quick: 'quick set', weak: 'weak spots set' }[practicedToday.length as 'full' | 'quick' | 'weak'];
      practice.done = true;
      practice.title = `Practice done: ${practicedToday.knownScaled ?? practicedToday.scaled} on today's ${name}`;
      practice.detail = 'Read the explanations for anything you missed while it is fresh. Tomorrow picks the next set from your results.';
    } else if (!benchmarks.length) {
      practice.title = 'Take a quick set for a baseline';
      practice.detail = '30 questions in 35 minutes. Your score and weak objectives shape the rest of the plan.';
      practice.links = [{ label: 'Start a quick set', path: '/exam', query: { length: 'quick' } }];
    } else if (phase === 'review' && (!lastFull || input.now - lastFull.at > 3 * DAY)) {
      practice.title = 'Take a full timed exam';
      practice.detail = '90 questions in 90 minutes, like the real thing. Build stamina and check your readiness.';
      practice.links = [{ label: 'Start a full exam', path: '/exam', query: { length: 'full' } }];
    } else if (input.weakObjectives.length || input.missedQuestions >= 5) {
      const list = input.weakObjectives.slice(0, 3).join(', ');
      practice.title = 'Practice your weak spots';
      practice.detail = list ? `Questions you missed, then more from your weakest objectives (${list}).` : 'The questions you missed last time, until they stick.';
      practice.links = [{ label: 'Start weak spots', path: '/exam', query: { length: 'weak' } }];
    } else {
      practice.title = 'Take a quick set';
      practice.detail = 'Keep your exam skills warm and your readiness estimate current.';
      practice.links = [{ label: 'Start a quick set', path: '/exam', query: { length: 'quick' } }];
    }
    tasks.push(practice);

    const drilled = [...input.exams].reverse().find(e => on(e.at) && e.length === 'objective');
    const next = input.untestedObjectives[0];
    if (drilled) {
      tasks.push({
        id: 'objective', icon: 'checklist', done: true,
        title: drilled.objective ? `Objective ${drilled.objective} drilled today` : 'Objective drilled today',
        detail: 'Its questions now count toward your weak spots and readiness.',
        links: [{ label: 'All objectives', path: '/objectives' }],
      });
    } else if (next && benchmarks.length) {
      tasks.push({
        id: 'objective', icon: 'checklist', done: false,
        title: `Drill objective ${next}`,
        detail: `${input.untestedObjectives.length} objective${input.untestedObjectives.length === 1 ? ' has' : 's have'} no answered questions yet. A short drill fills the gap.`,
        links: [{ label: `Drill ${next}`, path: '/exam', query: { objective: next } }, { label: 'All objectives', path: '/objectives' }],
      });
    }
  }
  return tasks;
}

export function buildPlan(input: PlanInput, testedObjectives: number, totalObjectives: number): Plan {
  const daysLeft = input.examDate ? daysUntil(input.examDate, input.now) : null;
  const phase = phaseFor(daysLeft);
  return {
    daysLeft,
    phase,
    tasks: planTasks(input, phase, daysLeft),
    pace: phase === 'learn' ? pace(input.decks, daysLeft, input.newPerDay) : null,
    readiness: readiness(input, testedObjectives, totalObjectives),
    streak: streak(input.days, input.now),
    activeLast7: activeDays(input.days, input.now),
  };
}
