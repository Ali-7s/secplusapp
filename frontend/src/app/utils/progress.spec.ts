import {
  CardRecord, DEFAULT_NEW_PER_DAY, capDues, emptyProgress, isBenchmark, objectiveScores, parseProgress, recordQuestion,
  smartOrder, weakQuestionIds,
} from './progress';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 26);

describe('progress storage', () => {
  it('starts empty and survives missing, broken or partial data', () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('{not json')).toEqual(emptyProgress());
    expect(parseProgress('{"exams":[{"scaled":700}]}').exams.length).toBe(1);
    expect(parseProgress('{"exams":[{"scaled":700}]}').cards).toEqual({});
    expect(parseProgress('{"exams":[]}').review.newPerDay).toBe(DEFAULT_NEW_PER_DAY);
  });

  it('gives a deck added since the last save a zero count of new cards today', () => {
    const saved = JSON.stringify({ review: { newPerDay: 15, day: '2026-10-28', newToday: { acr: 4, term: 2 } } });
    expect(parseProgress(saved).review).toEqual({ newPerDay: 15, day: '2026-10-28', newToday: { acr: 4, term: 2, ref: 0 } });
  });

  it('drops card records saved in an older shape', () => {
    const card = { state: 'review', step: 0, interval: 3, ease: 2.5, due: NOW, reps: 3, lapses: 0, right: 3, wrong: 0, at: NOW };
    const parsed = parseProgress(JSON.stringify({ cards: { 'acr:PKI': card, 'acr:AES': { box: 3, due: NOW, right: 1, wrong: 0, at: NOW } } }));
    expect(Object.keys(parsed.cards)).toEqual(['acr:PKI']);
  });
});

describe('capping saved cards', () => {
  const card = (at: number, dueIn: number): CardRecord =>
    ({ state: 'review', step: 0, interval: dueIn, ease: 2.5, due: at + dueIn * DAY, reps: 3, lapses: 0, right: 3, wrong: 0, at, last: at });

  it('brings in Review cards and lesson work cards scheduled weeks out, and leaves the rest as it is', () => {
    const d = emptyProgress();
    d.cards['ref:port:22'] = card(NOW, 48);
    d.cards['acr:PKI'] = card(NOW, 2);
    d.lessons['ports-trainer'] = { pbqs: {}, work: { 'tr:22': { v: card(NOW, 40), at: NOW }, 'fw:m:x': { v: card(NOW, 3), at: NOW }, 'pos': { v: { due: 'x' }, at: NOW } } };
    const capped = capDues(d);
    expect(capped.cards['ref:port:22'].due).toBe(NOW + 7 * DAY);
    expect(capped.cards['acr:PKI']).toBe(d.cards['acr:PKI']);
    expect((capped.lessons['ports-trainer'].work!['tr:22'].v as CardRecord).due).toBe(NOW + 7 * DAY);
    expect(capped.lessons['ports-trainer'].work!['tr:22'].at).withContext('times unchanged, so sync still picks the latest answer').toBe(NOW);
    expect(capped.lessons['ports-trainer'].work!['fw:m:x']).toBe(d.lessons['ports-trainer'].work!['fw:m:x']);
    expect(capped.lessons['ports-trainer'].work!['pos'].v).toEqual({ due: 'x' });
    expect(d.cards['ref:port:22'].due).withContext('the original is not changed').toBe(NOW + 48 * DAY);
    expect(capDues(capped)).withContext('nothing left to change').toBe(capped);
  });

  it('counts down to the exam date once one is set', () => {
    const d = emptyProgress();
    d.cards['ref:port:22'] = card(NOW, 48);
    const exam = new Date(NOW + 10 * DAY);
    d.plan.examDate = `${exam.getFullYear()}-${String(exam.getMonth() + 1).padStart(2, '0')}-${String(exam.getDate()).padStart(2, '0')}`;
    const examAt = new Date(exam.getFullYear(), exam.getMonth(), exam.getDate()).getTime();
    expect(capDues(d).cards['ref:port:22'].due).toBe(NOW + (examAt - NOW) / 3);
  });
});

describe('smart order', () => {
  const card = (state: CardRecord['state'], due: number, ease = 2.5): CardRecord =>
    ({ state, step: 0, interval: state === 'review' ? 3 : 0, ease, due, reps: 2, lapses: 0, right: 1, wrong: 1, at: NOW });

  it('orders a deck: due cards (learning, then hardest), then new cards, then the rest by due date', () => {
    const cards: Record<string, CardRecord> = {
      dueEasy: card('review', NOW - DAY, 2.5),
      dueHard: card('review', NOW - DAY, 1.8),
      learning: card('learning', NOW),
      later: card('review', NOW + 9 * DAY),
      soon: card('review', NOW + 2 * DAY),
    };
    const deck = ['later', 'newA', 'dueEasy', 'soon', 'newB', 'dueHard', 'learning'];
    expect(smartOrder(deck, k => k, cards, NOW)).toEqual(['learning', 'dueHard', 'dueEasy', 'newA', 'newB', 'soon', 'later']);
  });
});

describe('weak spots', () => {
  const meta: Record<string, { objective: string; domain: number }> = {
    a: { objective: '2.4', domain: 2 }, b: { objective: '2.4', domain: 2 },
    c: { objective: '4.5', domain: 4 }, d: { objective: '1.4', domain: 1 },
  };

  it('scores objectives weakest first and ignores ones seen too rarely', () => {
    const q = {
      a: { seen: 2, right: 0, last: false, at: NOW },
      b: { seen: 2, right: 1, last: true, at: NOW },
      c: { seen: 3, right: 3, last: true, at: NOW },
      d: { seen: 1, right: 0, last: false, at: NOW },
    };
    const scores = objectiveScores(q, id => meta[id]);
    expect(scores.map(s => s.objective)).toEqual(['2.4', '4.5']);
    expect(scores[0].rate).toBe(0.25);
  });

  it('builds a weak-spots set from missed questions first, then the weakest objectives', () => {
    const q = { a: recordQuestion(undefined, false, NOW), c: recordQuestion(undefined, true, NOW) };
    const pool = [{ id: 'a', objective: '2.4' }, { id: 'b', objective: '2.4' }, { id: 'c', objective: '4.5' }, { id: 'd', objective: '1.4' }];
    expect(weakQuestionIds(q, pool, ['2.4'])).toEqual(['a', 'b']);
  });
});

describe('exam scores', () => {
  it('counts only full exams and quick sets as exam scores, never drills', () => {
    expect(['full', 'quick'].every(length => isBenchmark({ length }))).toBeTrue();
    expect(['objective', 'network', 'weak'].some(length => isBenchmark({ length }))).toBeFalse();
  });
});
