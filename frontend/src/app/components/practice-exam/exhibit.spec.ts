import { ExamQuestion, isPbq } from '../../models/exam.model';
import * as LESSON_PBQS from '../networking/lessons/practice';

/** Box-drawing characters: the exhibit is a picture drawn in text. */
const DRAWN = /[─│┌┐└┘├┤┬┴┼]/;

/** Lines that split into three or more columns at runs of spaces: the exhibit is a table typed in text. */
const looksTabular = (text: string) => text.split('\n').filter(l => l.trim().split(/\s{2,}/).length >= 3).length >= 3;

/** Words and values in a text exhibit that a table or drawing must keep. */
const tokens = (text: string) => (text.match(/[A-Za-z0-9][\w./:*-]*/g) ?? []).map(t => t.toLowerCase().replace(/[.:]+$/, ''));

/** Exhibit words a table or drawing may say differently ("Proto" as "Protocol", "PFS off" as its own row). */
const RENAMED = new Set(['proto', 'dest', 'pfs', 'implicit', 'any', 'ip', 'deny', 'off', 'and', 'of', 'per', 'on', 'one', 'address', 'router', 'rest', 'user/group']);

describe('exhibits', () => {
  let pool: ExamQuestion[];
  const lessonPbqs = (Object.values(LESSON_PBQS) as unknown[]).filter((v): v is ExamQuestion => !!v && typeof v === 'object' && 'kind' in v);

  beforeAll(async () => {
    pool = await (await fetch('/data/practice-exam.json')).json() as ExamQuestion[];
  });

  it('draws every network instead of showing it in text', () => {
    for (const q of [...pool, ...lessonPbqs]) {
      if (q.exhibit && DRAWN.test(q.exhibit)) expect(q.diagram ?? q.topology).withContext(q.id).toBeDefined();
    }
  });

  it('shows every table in a lesson as a table', () => {
    const inLessons = [...pool.filter(q => q.lesson && isPbq(q)), ...lessonPbqs];
    expect(inLessons.length).toBeGreaterThan(10);
    for (const q of inLessons) {
      if (q.exhibit && looksTabular(q.exhibit) && !q.diagram && !q.topology) expect(q.tables?.length).withContext(q.id).toBeGreaterThan(0);
    }
  });

  it('keeps everything the text version said in its tables and drawings', () => {
    for (const q of [...pool, ...lessonPbqs]) {
      const shown = q.tables ?? q.topology;
      if (!shown || !q.exhibit) continue;
      const text = JSON.stringify(shown).toLowerCase();
      for (const t of tokens(q.exhibit)) {
        if (!RENAMED.has(t)) expect(text).withContext(`${q.id}: ${t}`).toContain(t);
      }
    }
  });

  it('gives every table row one cell per column', () => {
    for (const q of [...pool, ...lessonPbqs]) {
      for (const t of q.tables ?? []) {
        for (const r of t.rows) expect(r.length).withContext(`${q.id} ${r.join(' | ')}`).toBe(t.columns.length);
      }
    }
  });
});
