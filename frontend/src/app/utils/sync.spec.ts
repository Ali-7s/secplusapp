import { emptyProgress, ProgressData } from './progress';
import { SrsCard } from './srs';
import {
  SyncPayload, deriveSyncKeys, formatSyncCode, mergeProgress, mergeSynced, newSyncCode, normalizeSyncCode, parsePayload,
  seal, stableStringify, unseal,
} from './sync';

const card = (at: number, interval = 1): SrsCard =>
  ({ state: 'review', step: 0, interval, ease: 2.5, due: at + interval * 86_400_000, reps: 1, lapses: 0, right: 1, wrong: 0, at });

const progress = (change: (d: ProgressData) => void): ProgressData => {
  const d = emptyProgress();
  change(d);
  return d;
};

describe('mergeProgress', () => {
  it('keeps the most recent result for each card and question, and every card from both', () => {
    const a = progress(d => {
      d.cards['acr:AH'] = card(100, 1);
      d.cards['acr:ESP'] = card(500, 3);
      d.questions['q1'] = { seen: 1, right: 0, last: false, at: 100 };
    });
    const b = progress(d => {
      d.cards['acr:AH'] = card(200, 4);
      d.cards['term:Hashing'] = card(50);
      d.questions['q1'] = { seen: 2, right: 2, last: true, at: 300 };
    });
    const m = mergeProgress(a, b);
    expect(m.cards['acr:AH'].interval).toBe(4);
    expect(m.cards['acr:ESP'].interval).toBe(3);
    expect(m.cards['term:Hashing']).toBeDefined();
    expect(m.questions['q1'].last).toBeTrue();
  });

  it('keeps exams from both devices once each, in time order', () => {
    const exam = (at: number) => ({ at, length: 'quick', mode: 'exam' as const, scaled: 700, percent: 70, correct: 7, total: 10,
      byDomain: { 1: null, 2: null, 3: null, 4: null, 5: null } });
    const a = progress(d => { d.exams = [exam(100), exam(300)]; });
    const b = progress(d => { d.exams = [exam(100), exam(200)]; });
    expect(mergeProgress(a, b).exams.map(e => e.at)).toEqual([100, 200, 300]);
  });

  it('combines lessons: best PBQ scores, the latest self-check and the first completion', () => {
    const a = progress(d => { d.lessons['vlans'] = { pbqs: { p1: 1, p2: 0.5 }, check: { score: 3, total: 5, at: 100 }, completedAt: 100, part: 2, at: 100 }; });
    const b = progress(d => { d.lessons['vlans'] = { pbqs: { p2: 0.8 }, check: { score: 5, total: 5, at: 400 }, completedAt: 400, part: 6, at: 400 }; });
    const l = mergeProgress(a, b).lessons['vlans'];
    expect(l.pbqs).toEqual({ p1: 1, p2: 0.8 });
    expect(l.check?.score).toBe(5);
    expect(l.completedAt).toBe(100);
    expect(l.part).toBe(6);
  });

  it('takes settings from the device that changed them last', () => {
    const a = progress(d => { d.plan.examDate = '2026-12-01'; d.review.newPerDay = 10; d.settingsAt = 500; });
    const b = progress(d => { d.plan.examDate = '2026-11-15'; d.review.newPerDay = 30; d.settingsAt = 200; });
    const m = mergeProgress(a, b);
    expect(m.plan.examDate).toBe('2026-12-01');
    expect(m.review.newPerDay).toBe(10);
    expect(m.settingsAt).toBe(500);
  });

  it('counts the new cards both devices introduced today, and keeps each day studied', () => {
    const a = progress(d => { d.review.day = '2026-10-28'; d.review.newToday = { acr: 5, term: 0 }; d.days = { '2026-10-27': 10, '2026-10-28': 3 }; });
    const b = progress(d => { d.review.day = '2026-10-28'; d.review.newToday = { acr: 2, term: 4 }; d.days = { '2026-10-28': 8 }; });
    const m = mergeProgress(a, b);
    expect(m.review.newToday).toEqual({ acr: 5, term: 4 });
    expect(m.days).toEqual({ '2026-10-27': 10, '2026-10-28': 8 });
  });

  it('lets a reset on one device clear the older progress of another', () => {
    const resetAt = new Date(2026, 9, 28, 12).getTime();
    const wiped = progress(d => { d.resetAt = resetAt; });
    const old = progress(d => {
      d.cards['acr:AH'] = card(resetAt - 1000);
      d.cards['acr:ESP'] = card(resetAt + 1000);
      d.lessons['vlans'] = { pbqs: { p1: 1 }, at: resetAt - 1000 };
      d.days = { '2026-10-20': 5 };
    });
    old.plan.examDate = '2026-12-01';
    old.settingsAt = resetAt - 1000;
    wiped.settingsAt = resetAt;
    const m = mergeProgress(old, wiped);
    expect(m.plan).toEqual({});
    expect(Object.keys(m.cards)).toEqual(['acr:ESP']);
    expect(m.lessons).toEqual({});
    expect(m.days).toEqual({});
    expect(m.resetAt).toBe(resetAt);
  });

  it('gives the same result whichever side is first, and changes nothing when merged with itself', () => {
    const a = progress(d => { d.cards['acr:AH'] = card(100); d.days = { '2026-10-28': 2 }; });
    const b = progress(d => { d.cards['acr:ESP'] = card(200); d.settingsAt = 5; d.plan.examDate = '2026-12-01'; });
    expect(stableStringify(mergeProgress(a, b))).toBe(stableStringify(mergeProgress(b, a)));
    const m = mergeProgress(a, b);
    expect(stableStringify(mergeProgress(m, m))).toBe(stableStringify(m));
  });
});

describe('mergeSynced', () => {
  const dump = (ratings: Record<string, string>, cards: Record<string, number>, cleared?: number) =>
    ({ ratings: { acronyms: ratings }, times: { acronyms: cleared ? { cleared, cards } : { cards } } });

  it('keeps the latest brain dump rating of each card, from either device', () => {
    const a: SyncPayload = { progress: emptyProgress(), braindump: dump({ AH: 'missed', ESP: 'nailed' }, { AH: 100, ESP: 300 }) };
    const b: SyncPayload = { progress: emptyProgress(), braindump: dump({ AH: 'nailed', IKE: 'partly' }, { AH: 200, IKE: 50 }) };
    expect(mergeSynced(a, b).braindump.ratings).toEqual({ acronyms: { AH: 'nailed', ESP: 'nailed', IKE: 'partly' } });
  });

  it('drops ratings made before the deck was cleared or progress was reset', () => {
    const cleared: SyncPayload = { progress: emptyProgress(), braindump: dump({ IKE: 'nailed' }, { IKE: 500 }, 400) };
    const old: SyncPayload = { progress: emptyProgress(), braindump: dump({ AH: 'nailed' }, { AH: 300 }) };
    expect(mergeSynced(old, cleared).braindump.ratings).toEqual({ acronyms: { IKE: 'nailed' } });

    const reset: SyncPayload = { progress: progress(d => { d.resetAt = 1000; }), braindump: { ratings: {}, times: {} } };
    expect(mergeSynced(cleared, reset).braindump.ratings).toEqual({ acronyms: {} });
  });

  it('reads the first sync build, which dated all ratings at once', () => {
    const legacy = parsePayload({ progress: emptyProgress(), braindump: { at: 70, ratings: { acronyms: { AH: 'nailed' } } } });
    expect(legacy.braindump.times).toEqual({ acronyms: { cards: { AH: 70 } } });
  });
});

describe('stableStringify', () => {
  it('ignores key order and undefined values', () => {
    expect(stableStringify({ b: 1, a: [{ y: 2, x: undefined, w: null }] })).toBe(stableStringify({ a: [{ w: null, y: 2 }], b: 1 }));
  });
});

describe('sync codes', () => {
  it('makes 12-character codes that read back unchanged', () => {
    const code = newSyncCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
    expect(normalizeSyncCode(formatSyncCode(code))).toBe(code);
    expect(newSyncCode()).not.toBe(code);
  });

  it('forgives case, spaces, dashes and look-alike letters', () => {
    expect(normalizeSyncCode(' k7p2-9xma qr4t ')).toBe('K7P29XMAQR4T');
    expect(normalizeSyncCode('O0IL-0000-0000')).toBe('001100000000');
    expect(formatSyncCode('K7P29XMAQR4T')).toBe('K7P2-9XMA-QR4T');
  });

  it('rejects anything that cannot be a code', () => {
    expect(normalizeSyncCode('')).toBeNull();
    expect(normalizeSyncCode('K7P2-9XMA')).toBeNull();
    expect(normalizeSyncCode('K7P2-9XMA-QR4U')).toBeNull();
  });
});

describe('encryption', () => {
  const payload: SyncPayload = {
    progress: progress(d => { d.cards['acr:AH'] = card(100); d.plan.examDate = '2026-12-01'; }),
    braindump: { ratings: { acronyms: { AH: 'nailed' } }, times: { acronyms: { cards: { AH: 5 } } } },
  };

  it('derives the same document id on every device, and a different one for another code', async () => {
    const a = await deriveSyncKeys('K7P29XMAQR4T');
    const b = await deriveSyncKeys('K7P29XMAQR4T');
    const c = await deriveSyncKeys('K7P29XMAQR4V');
    expect(a.id).toMatch(/^[0-9a-f]{64}$/);
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
  });

  it('reads back what it sealed, and refuses the wrong code', async () => {
    const keys = await deriveSyncKeys('K7P29XMAQR4T');
    const sealed = await seal(keys, payload);
    expect(sealed.data).not.toContain('AH');
    expect(stableStringify(await unseal(keys, sealed))).toBe(stableStringify(parsePayload(payload)));
    await expectAsync(unseal(await deriveSyncKeys('K7P29XMAQR4V'), sealed)).toBeRejected();
  });
});
