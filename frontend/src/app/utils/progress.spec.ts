import {
  CardRecord, DEFAULT_NEW_PER_DAY, emptyProgress, makeBackup, objectiveScores, parseProgress, readBackup, recordQuestion,
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

  it('drops card records saved in an older shape', () => {
    const card = { state: 'review', step: 0, interval: 3, ease: 2.5, due: NOW, reps: 3, lapses: 0, right: 3, wrong: 0, at: NOW };
    const parsed = parseProgress(JSON.stringify({ cards: { 'acr:PKI': card, 'acr:AES': { box: 3, due: NOW, right: 1, wrong: 0, at: NOW } } }));
    expect(Object.keys(parsed.cards)).toEqual(['acr:PKI']);
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

describe('backup file', () => {
  it('round-trips the saved keys and rejects files that are not backups', () => {
    const backup = makeBackup({ 'sp-progress': '{"version":1}', 'sp-theme': 'dark' }, new Date(NOW));
    const back = readBackup(JSON.stringify(backup));
    expect('data' in back && back.data).toEqual({ 'sp-progress': '{"version":1}', 'sp-theme': 'dark' });
    expect('error' in readBackup('{"hello":1}')).toBeTrue();
    expect('error' in readBackup('not json')).toBeTrue();
  });

  it('ignores keys that do not belong to this app', () => {
    const back = readBackup(JSON.stringify({ app: 'secplus-study', version: 1, exportedAt: '', data: { 'sp-x': '1', other: '2' } }));
    expect('data' in back && back.data).toEqual({ 'sp-x': '1' });
  });
});
