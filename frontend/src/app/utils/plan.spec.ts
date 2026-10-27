import { ExamRecord } from './progress';
import { DeckState, PlanInput, buildPlan, daysUntil, pace, phaseFor, readiness, streak } from './plan';

const NOW = new Date(2026, 9, 26, 12).getTime();
const DAY = 24 * 60 * 60 * 1000;
const day = (offset: number) => {
  const d = new Date(NOW + offset * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const deck = (over: Partial<DeckState> = {}): DeckState => ({ label: 'Acronyms', path: '/acronyms', total: 400, studied: 100, due: 0, newLeftToday: 20, ...over });
const exam = (length: string, scaled: number, at = NOW - DAY, extra: Partial<ExamRecord> = {}): ExamRecord =>
  ({ at, length, mode: 'exam', scaled, percent: 0, correct: 0, total: 30, byDomain: { 1: null, 2: null, 3: null, 4: null, 5: null }, ...extra });
const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  now: NOW, decks: [deck()], newPerDay: 20, exams: [], weakObjectives: [], untestedObjectives: [], missedQuestions: 0, days: {}, ...over,
});

describe('study plan', () => {
  it('counts whole days to the exam date', () => {
    expect(daysUntil(day(0), NOW)).toBe(0);
    expect(daysUntil(day(30), NOW)).toBe(30);
    expect(daysUntil(day(-2), NOW)).toBe(-2);
  });

  it('moves from learning to review to the final days', () => {
    expect(phaseFor(null)).toBe('none');
    expect(phaseFor(40)).toBe('learn');
    expect(phaseFor(14)).toBe('review');
    expect(phaseFor(2)).toBe('final');
    expect(phaseFor(-1)).toBe('past');
  });

  it('works out the new cards a day needed to meet every card before the last two weeks', () => {
    const p = pace([deck({ total: 400, studied: 100 }), deck({ total: 405, studied: 5 })], 34, 20)!;
    expect(p.learnDays).toBe(20);
    expect(p.neededPerDay).toBe(20);
    expect(p.onTrack).toBeTrue();
    expect(pace([deck()], 24, 20)!.onTrack).toBeFalse();
  });

  it('counts a streak back from today, or from yesterday before studying today', () => {
    expect(streak({ [day(0)]: 3, [day(-1)]: 1, [day(-2)]: 9, [day(-4)]: 2 }, NOW)).toBe(3);
    expect(streak({ [day(-1)]: 1, [day(-2)]: 1 }, NOW)).toBe(2);
    expect(streak({ [day(-2)]: 1 }, NOW)).toBe(0);
  });

  it('judges readiness from full and quick exams only, preferring the score without lucky guesses', () => {
    expect(readiness({ exams: [], decks: [deck()] }, 0, 28).verdict).toBe('unknown');
    const exams = [exam('weak', 400), exam('quick', 820), exam('full', 840, NOW - DAY, { knownScaled: 790 }), exam('quick', 810)];
    const r = readiness({ exams, decks: [deck()] }, 28, 28);
    expect(r.average).toBe(807);
    expect(r.verdict).toBe('ready');
    expect(readiness({ exams, decks: [deck()] }, 20, 28).verdict).toBe('borderline');
    expect(readiness({ exams: [exam('quick', 700)], decks: [deck()] }, 28, 28).verdict).toBe('not-yet');
  });

  it('starts with reviews, then new cards, then a baseline exam', () => {
    const plan = buildPlan(input({ examDate: day(60), decks: [deck({ due: 12 })] }), 0, 28);
    expect(plan.phase).toBe('learn');
    expect(plan.tasks.map(t => t.id)).toEqual(['reviews', 'new', 'practice']);
    expect(plan.tasks[0].links[0]).toEqual({ label: 'Acronyms (12)', path: '/acronyms', query: { mode: 'review' } });
    expect(plan.tasks[2].links[0].query).toEqual({ length: 'quick' });
  });

  it('asks for full exams in the review window and drills untested objectives', () => {
    const plan = buildPlan(input({ examDate: day(10), exams: [exam('quick', 700, NOW - 5 * DAY)], untestedObjectives: ['4.2', '5.6'] }), 26, 28);
    expect(plan.tasks.map(t => t.id)).toEqual(['reviews', 'practice', 'objective']);
    expect(plan.tasks[1].links[0].query).toEqual({ length: 'full' });
    expect(plan.tasks[2].links[0].query).toEqual({ objective: '4.2' });
  });

  it('marks practice done only for an exam taken today, and an objective drill separately', () => {
    const drill = exam('objective', 300, NOW, { objective: '1.2' });
    let plan = buildPlan(input({ examDate: day(60), exams: [drill] }), 1, 28);
    expect(plan.tasks.find(t => t.id === 'practice')?.done).toBeFalse();
    expect(plan.tasks.find(t => t.id === 'objective')?.title).toBe('Objective 1.2 drilled today');
    plan = buildPlan(input({ examDate: day(60), exams: [drill, exam('quick', 640, NOW)] }), 1, 28);
    expect(plan.tasks.find(t => t.id === 'practice')).toEqual(jasmine.objectContaining({ done: true, title: "Practice done: 640 on today's quick set" }));
  });

  it('keeps the last days light', () => {
    const plan = buildPlan(input({ examDate: day(1), exams: [exam('full', 800)] }), 28, 28);
    expect(plan.tasks.map(t => t.id)).toEqual(['rest', 'reviews']);
  });
});
