/**
 * Guards the practice exam pool (public/data/practice-exam.json).
 *
 * Every option, firewall rule, match prompt and ordering step carries its own explanation, because the review
 * explains what the learner picked as well as the right answer. Options are shuffled at run time, so nothing may
 * refer to a letter or to another option, and the correct option must not be a giveaway by being the longest.
 */
import { EXAM_SPECS } from './exam-engine';
import { ChoiceQuestion, ExamDomain, ExamQuestion, isPbq } from '../models/exam.model';

describe('practice exam pool', () => {
  let pool: ExamQuestion[];
  const words = (text: string) => text.trim().split(/\s+/).length;
  const choicesOf = (pool: ExamQuestion[]) => pool.filter((q): q is ChoiceQuestion => q.kind === 'single' || q.kind === 'multi');

  beforeAll(async () => {
    const response = await fetch('/data/practice-exam.json');
    expect(response.ok).toBeTrue();
    pool = (await response.json()) as ExamQuestion[];
  });

  it('has unique ids, a domain, an objective in that domain and a takeaway', () => {
    const problems: string[] = [];
    const ids = new Set<string>();
    for (const q of pool) {
      if (ids.has(q.id)) problems.push(`${q.id}: duplicate id`);
      ids.add(q.id);
      if (![1, 2, 3, 4, 5].includes(q.domain)) problems.push(`${q.id}: bad domain`);
      if (!new RegExp(`^${q.domain}\\.\\d$`).test(q.objective)) problems.push(`${q.id}: objective ${q.objective}`);
      if (words(q.takeaway) < 8) problems.push(`${q.id}: short takeaway`);
      if (words(`${q.scenario ?? ''} ${q.stem}`) < 12) problems.push(`${q.id}: short stem`);
    }
    expect(problems).toEqual([]);
  });

  it('has enough questions for a full exam in every domain, plus enough PBQs', () => {
    const spec = EXAM_SPECS.full;
    expect(pool.filter(isPbq).length).toBeGreaterThanOrEqual(spec.pbqs * 2);
    for (const d of [1, 2, 3, 4, 5] as ExamDomain[]) {
      expect(pool.filter(q => !isPbq(q) && q.domain === d).length).withContext(`domain ${d}`).toBeGreaterThanOrEqual(spec.perDomain[d]);
    }
    expect(pool.some(q => q.kind === 'firewall')).toBeTrue();
    expect(pool.some(q => q.kind === 'order')).toBeTrue();
    expect(pool.some(q => q.kind === 'match')).toBeTrue();
  });

  it('gives single answer questions four options with one correct, and multi select the count its stem asks for', () => {
    const problems: string[] = [];
    for (const q of choicesOf(pool)) {
      const correct = q.options.filter(o => o.correct).length;
      if (q.kind === 'single' && (q.options.length !== 4 || correct !== 1)) problems.push(q.id);
      if (q.kind === 'multi') {
        const asked = /Select (TWO|THREE)/.exec(q.stem)?.[1];
        if (!asked || correct !== (asked === 'TWO' ? 2 : 3) || q.options.length < 5) problems.push(q.id);
      }
      if (new Set(q.options.map(o => o.text.toLowerCase())).size !== q.options.length) problems.push(`${q.id}: duplicate option`);
    }
    expect(problems).toEqual([]);
  });

  it('explains every option and never refers to letters or other options', () => {
    const problems: string[] = [];
    const crossRef = /\b(all|none|both) of the above\b|\boption [A-H]\b|\b[A-H] and [A-H]\b/i;
    for (const q of choicesOf(pool)) {
      for (const o of q.options) {
        if (words(o.why) < 8) problems.push(`${q.id}: short why on "${o.text}"`);
        if (crossRef.test(o.text) || crossRef.test(o.why)) problems.push(`${q.id}: cross reference`);
        if (/\.$/.test(o.text)) problems.push(`${q.id}: trailing period`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps PBQ answers inside their choices and explains every row, prompt and step', () => {
    const problems: string[] = [];
    for (const q of pool) {
      if (q.kind === 'firewall') {
        if (q.rows.length !== q.requirements.length) problems.push(`${q.id}: rows and requirements differ`);
        q.rows.forEach((row, r) => {
          for (const c of q.columns) if (!q.choices[c]?.includes(row.answer[c])) problems.push(`${q.id}: rule ${r + 1} ${c}`);
          if (words(row.why) < 8) problems.push(`${q.id}: rule ${r + 1} why`);
        });
      } else if (q.kind === 'match') {
        q.prompts.forEach(p => {
          if (!(p.choices ?? q.choices ?? []).includes(p.answer)) problems.push(`${q.id}: ${p.label}`);
          if (words(p.why) < 8) problems.push(`${q.id}: ${p.label} why`);
        });
      } else if (q.kind === 'order') {
        if (q.items.length < 4) problems.push(`${q.id}: too few steps`);
        q.items.forEach(it => { if (words(it.why) < 8) problems.push(`${q.id}: ${it.text} why`); });
      }
    }
    expect(problems).toEqual([]);
  });

  it('does not make the correct answer the longest option too often', () => {
    const singles = choicesOf(pool).filter(q => q.kind === 'single');
    const longest = singles.filter(q => {
      const correct = q.options.find(o => o.correct)!.text.length;
      return q.options.every(o => o.correct || o.text.length < correct);
    });
    expect(longest.length / singles.length).toBeLessThanOrEqual(0.3);
  });
});
