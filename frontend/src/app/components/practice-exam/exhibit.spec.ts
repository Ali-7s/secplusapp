import { ExamQuestion } from '../../models/exam.model';
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

  it('presents every exhibit as what it is, never as bare text', () => {
    for (const q of [...pool, ...lessonPbqs]) {
      if (q.exhibit) expect(q.diagram ?? q.topology ?? q.blocks?.[0]).withContext(q.id).toBeDefined();
    }
  });

  it('shows text tables as tables, unless they are a log, a terminal or a file', () => {
    for (const q of [...pool, ...lessonPbqs]) {
      if (!q.exhibit || !looksTabular(q.exhibit) || q.diagram || q.topology) continue;
      const kinds = (q.blocks ?? []).map(b => (b.kind === 'table' ? 'table' : b.style));
      expect(kinds.some(k => ['table', 'log', 'terminal', 'file'].includes(k))).withContext(q.id).toBeTrue();
    }
  });

  it('keeps everything the text version said in its tables and drawings', () => {
    for (const q of [...pool, ...lessonPbqs]) {
      const shown = q.blocks ?? q.topology;
      if (!shown || !q.exhibit) continue;
      const text = JSON.stringify(shown).toLowerCase();
      for (const t of tokens(q.exhibit)) {
        if (!RENAMED.has(t)) expect(text).withContext(`${q.id}: ${t}`).toContain(t);
      }
    }
  });

  it('gives every table row one cell per column, or one cell spanning the table', () => {
    for (const q of [...pool, ...lessonPbqs]) {
      for (const t of q.blocks ?? []) {
        if (t.kind !== 'table') continue;
        const width = t.columns?.length ?? 2;
        for (const r of t.rows) expect([1, width]).withContext(`${q.id} ${r.join(' | ')}`).toContain(r.length);
      }
    }
  });
});
