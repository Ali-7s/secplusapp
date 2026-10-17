import { ChoiceQuestion, ExamQuestion, FirewallQuestion, MatchQuestion, OrderQuestion } from '../models/exam.model';
import { EXAM_SPECS, PASSING_SCALED, buildExam, examSize, gradeExam, gradeQuestion, isAnswered, scaledScore } from './exam-engine';

const why = 'because this explanation is long enough';

function single(id: string, domain: 1 | 2 | 3 | 4 | 5): ChoiceQuestion {
  return {
    id, domain, objective: `${domain}.1`, kind: 'single', stem: 'Which is best?', takeaway: why,
    options: [{ text: 'right', correct: true, why }, { text: 'w1', why }, { text: 'w2', why }, { text: 'w3', why }],
  };
}

const multi: ChoiceQuestion = {
  id: 'multi', domain: 1, objective: '1.1', kind: 'multi', stem: 'Pick two (Select TWO.)', takeaway: why,
  options: [{ text: 'a', correct: true, why }, { text: 'b', correct: true, why }, { text: 'c', why }, { text: 'd', why }, { text: 'e', why }],
};

const firewall: FirewallQuestion = {
  id: 'fw', domain: 3, objective: '3.2', kind: 'firewall', stem: 'Build the rules', takeaway: why,
  requirements: ['web', 'deny'], columns: ['Port', 'Action'],
  choices: { Port: ['443', 'Any'], Action: ['Allow', 'Deny'] },
  rows: [{ answer: { Port: '443', Action: 'Allow' }, why }, { answer: { Port: 'Any', Action: 'Deny' }, why }],
};

const match: MatchQuestion = {
  id: 'match', domain: 4, objective: '4.9', kind: 'match', stem: 'Match them', takeaway: why, choices: ['X', 'Y'],
  prompts: [{ label: 'one', answer: 'X', why }, { label: 'two', answer: 'Y', why }],
};

const order: OrderQuestion = {
  id: 'order', domain: 4, objective: '4.8', kind: 'order', stem: 'Order them', takeaway: why,
  items: [{ text: 'first', why }, { text: 'second', why }, { text: 'third', why }, { text: 'fourth', why }],
};

function pool(): ExamQuestion[] {
  const out: ExamQuestion[] = [multi, firewall, match, order];
  for (let i = 0; i < 6; i++) out.push({ ...firewall, id: `fw${i}` });
  for (const d of [1, 2, 3, 4, 5] as const) for (let i = 0; i < 30; i++) out.push(single(`d${d}-${i}`, d));
  return out;
}

describe('exam engine', () => {
  it('builds a full exam with PBQs first and the domain weights after', () => {
    const p = pool();
    const items = buildExam(p, 'full', 42);
    const spec = EXAM_SPECS.full;
    const byId = new Map(p.map(q => [q.id, q]));
    const total = spec.pbqs + Object.values(spec.perDomain).reduce((s, n) => s + n, 0);
    expect(items.length).toBe(total);
    expect(new Set(items.map(i => i.id)).size).toBe(total);
    const kinds = items.map(i => byId.get(i.id)!.kind);
    expect(kinds.slice(0, spec.pbqs).every(k => k === 'firewall' || k === 'match' || k === 'order')).toBeTrue();
    expect(kinds.slice(spec.pbqs).every(k => k === 'single' || k === 'multi')).toBeTrue();
    for (const d of [1, 2, 3, 4, 5] as const) {
      const n = items.slice(spec.pbqs).filter(i => byId.get(i.id)!.domain === d).length;
      expect(n).withContext(`domain ${d}`).toBe(spec.perDomain[d]);
    }
  });

  it('rebuilds the same exam from the same seed and a different one from another seed', () => {
    const p = pool();
    expect(buildExam(p, 'quick', 7)).toEqual(buildExam(p, 'quick', 7));
    expect(buildExam(p, 'quick', 7)).not.toEqual(buildExam(p, 'quick', 8));
  });

  it('builds the networking drill only from questions linked to a lesson', () => {
    const p = pool();
    for (let i = 0; i < 30; i++) p.push({ ...single(`net-${i}`, 3), lesson: 'vlans' });
    p.push({ ...firewall, id: 'net-fw', lesson: 'security-devices' }, { ...match, id: 'net-match', lesson: 'helpers' });
    const items = buildExam(p, 'network', 3);
    expect(items.length).toBe(examSize('network'));
    expect(items.every(i => i.id.startsWith('net-'))).toBeTrue();
    expect(items.slice(0, EXAM_SPECS.network.pbqs).map(i => i.id).sort()).toEqual(['net-fw', 'net-match']);
  });

  it('draws questions seen in fewer past attempts first', () => {
    const p = pool();
    const first = buildExam(p, 'quick', 11);
    const seen = Object.fromEntries(first.map(i => [i.id, 1]));
    const second = buildExam(p, 'quick', 12, seen);
    // The pool has 30 per domain, so a second quick set can be made entirely of unseen questions.
    expect(second.slice(EXAM_SPECS.quick.pbqs).some(i => seen[i.id])).toBeFalse();
    expect(second.length).toBe(examSize('quick'));
  });

  it('always includes a firewall rule PBQ', () => {
    const p = pool().filter(q => !q.id.startsWith('fw'));
    p.push({ ...firewall, id: 'fw-only' }, { ...match, id: 'm2' }, { ...match, id: 'm3' }, { ...order, id: 'o2' });
    for (let seed = 0; seed < 100; seed++) {
      expect(buildExam(p, 'quick', seed).slice(0, EXAM_SPECS.quick.pbqs).some(i => i.id === 'fw-only')).toBeTrue();
    }
  });

  it('never starts an ordering PBQ in the solved order', () => {
    const p: ExamQuestion[] = [order, ...pool().filter(q => q.kind === 'single')];
    for (let seed = 0; seed < 200; seed++) {
      const item = buildExam(p, 'quick', seed).find(i => i.id === 'order');
      if (item) expect(item.itemOrder).not.toEqual([0, 1, 2, 3]);
    }
  });

  it('grades single and multi select all or nothing', () => {
    const q = single('s', 1);
    expect(gradeQuestion(q, { choices: [0] }).correct).toBeTrue();
    expect(gradeQuestion(q, { choices: [2] }).earned).toBe(0);
    expect(gradeQuestion(multi, { choices: [1, 0] }).correct).toBeTrue();
    expect(gradeQuestion(multi, { choices: [0] }).earned).toBe(0);
    expect(gradeQuestion(multi, { choices: [0, 1, 2] }).earned).toBe(0);
  });

  it('gives PBQs partial credit and explains each part', () => {
    const fw = gradeQuestion(firewall, { cells: [{ Port: '443', Action: 'Allow' }, { Port: 'Any', Action: 'Allow' }] });
    expect(fw.earned).toBe(2.25);
    expect(fw.max).toBe(3);
    expect(fw.correct).toBeFalse();
    expect(fw.parts.map(p => p.ok)).toEqual([true, false]);
    expect(fw.parts[1].expected).toBe('Any | Deny');

    const m = gradeQuestion(match, { picks: ['X', 'X'] });
    expect(m.earned).toBe(1.5);
    expect(m.parts[1]).toEqual(jasmine.objectContaining({ given: 'X', expected: 'Y', ok: false, why }));

    expect(gradeQuestion(order, { order: [0, 1, 2, 3] }).correct).toBeTrue();
    expect(gradeQuestion(order, { order: [1, 0, 2, 3] }).earned).toBe(1.5);
  });

  it('only counts a PBQ as answered when every part is filled', () => {
    expect(isAnswered(firewall, { cells: [{ Port: '443', Action: 'Allow' }] })).toBeFalse();
    expect(isAnswered(match, { picks: ['X', 'Y'] })).toBeTrue();
    expect(isAnswered(order, undefined)).toBeFalse();
  });

  it('scales the score from 100 to 900 and passes at 750', () => {
    expect(scaledScore(0)).toBe(100);
    expect(scaledScore(1)).toBe(900);
    const p = [single('a', 1), single('b', 1), single('c', 1), single('d', 1)];
    const items = p.map(q => ({ id: q.id }));
    const pass = gradeExam(p, items, { a: { choices: [0] }, b: { choices: [0] }, c: { choices: [0] }, d: { choices: [0] } });
    expect(pass.scaled).toBe(900);
    expect(pass.passed).toBeTrue();
    const fail = gradeExam(p, items, { a: { choices: [0] }, b: { choices: [0] }, c: { choices: [0] } });
    expect(fail.scaled).toBe(700);
    expect(fail.scaled < PASSING_SCALED).toBeTrue();
    expect(fail.passed).toBeFalse();
    expect(fail.byDomain[1]).toEqual({ earned: 3, max: 4 });
  });
});
