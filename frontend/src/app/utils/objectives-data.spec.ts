/**
 * Guards the exam objective outline (content/objectives.ts) against the study content: every objective is there,
 * every "=>" link names a real card, and every topic is taught by a card or a practice question. A renamed card
 * or a new topic with nothing behind it fails here instead of quietly showing up as a gap on the Objectives page.
 */
import { OBJECTIVE_OUTLINES } from '../content/objectives';
import { OBJECTIVE_NAMES } from '../models/exam.model';
import { GlossaryCard, ObjectiveTopic, buildObjectives, collectText, glossaryIndex, normalize, objectiveCoverage } from './coverage';

describe('exam objectives outline', () => {
  const objectives = buildObjectives(OBJECTIVE_OUTLINES);
  let cards: GlossaryCard[];
  let questions: { id: string; objective: string; text: string }[];

  beforeAll(async () => {
    const load = async (file: string) => {
      const response = await fetch(`/data/${file}.json`);
      expect(response.ok).toBeTrue();
      return response.json();
    };
    const [acronyms, terms, pool] = await Promise.all([load('acronyms'), load('terms'), load('practice-exam')]);
    cards = [
      ...acronyms.map((a: { acronym: string; expansion: string }) => ({ kind: 'acr', name: a.acronym, expansion: a.expansion })),
      ...terms.map((t: { term: string }) => ({ kind: 'term', name: t.term })),
    ];
    questions = pool.map((q: { id: string; objective: string }) => ({ id: q.id, objective: q.objective, text: normalize(collectText(q)) }));
  });

  it('lists all 28 SY0-701 objectives in order', () => {
    expect(objectives.map(o => o.id)).toEqual(Object.keys(OBJECTIVE_NAMES));
  });

  it('links only to cards that exist', () => {
    const index = glossaryIndex(cards);
    const broken: string[] = [];
    const walk = (id: string, topics: ObjectiveTopic[]) => topics.forEach(t => {
      for (const name of t.see ?? []) if (!index.has(normalize(name))) broken.push(`${id} ${t.name} => ${name}`);
      walk(id, t.sub ?? []);
    });
    objectives.forEach(o => walk(o.id, o.topics));
    expect(broken).toEqual([]);
  });

  it('teaches every topic with a card or a practice question', () => {
    const index = glossaryIndex(cards);
    const gaps = objectives.flatMap(o => objectiveCoverage(o, index, questions).filter(t => t.status === 'gap').map(t => `${o.id} ${t.path}`));
    expect(gaps).toEqual([]);
  });
});
