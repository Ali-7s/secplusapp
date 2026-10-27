import { GlossaryCard, buildObjectives, cardsFor, glossaryIndex, normalize, objectiveCoverage, parseOutline, topicNames } from './coverage';

const cards: GlossaryCard[] = [
  { kind: 'acr', name: 'CA', expansion: 'Certificate Authority' },
  { kind: 'acr', name: 'RTO', expansion: 'Recovery Time Objective' },
  { kind: 'acr', name: 'RTOS', expansion: 'Real-time Operating System' },
  { kind: 'term', name: 'Preventive control' },
  { kind: 'term', name: 'Hot site' },
  { kind: 'term', name: 'Script kiddie' },
];
const index = glossaryIndex(cards);
const names = (list: GlossaryCard[]) => list.map(c => c.name);

describe('objective coverage', () => {
  it('folds plurals but keeps capitalized acronyms apart', () => {
    expect(normalize('Certificate authorities')).toBe('certificate authority');
    expect(normalize('APIs')).toBe('api');
    expect(normalize('RTOS')).not.toBe(normalize('RTO'));
  });

  it('reads an indented outline with links', () => {
    const topics = parseOutline('Threat actors\n  Unskilled attacker => Script kiddie; Hacktivist\n  Nation-state\nGap analysis');
    expect(topics.length).toBe(2);
    expect(topics[0].sub?.map(t => t.name)).toEqual(['Unskilled attacker', 'Nation-state']);
    expect(topics[0].sub?.[0].see).toEqual(['Script kiddie', 'Hacktivist']);
    expect(buildObjectives([['2.1', 'Threats', 'A']])[0].domain).toBe(2);
  });

  it('names a short topic together with its heading', () => {
    expect(topicNames('Hot', 'Site considerations')).toContain('hot site');
    expect(topicNames('Allow lists/deny lists')).toEqual(['allow list deny list', 'allow list', 'deny list']);
  });

  it('finds cards by name, abbreviation, expansion, heading and links', () => {
    expect(names(cardsFor({ name: 'Certificate authorities' }, undefined, index))).toEqual(['CA']);
    expect(names(cardsFor({ name: 'Real-time operating system (RTOS)' }, undefined, index))).toEqual(['RTOS']);
    expect(names(cardsFor({ name: 'Preventive' }, 'Control types', index))).toEqual(['Preventive control']);
    expect(names(cardsFor({ name: 'Hot' }, 'Site considerations', index))).toEqual(['Hot site']);
    expect(names(cardsFor({ name: 'Unskilled attacker', see: ['Script kiddie'] }, undefined, index))).toEqual(['Script kiddie']);
  });

  it('rates each topic by its cards and the questions on the same objective that mention it', () => {
    const objective = buildObjectives([['3.4', 'Resilience', 'Site considerations\n  Hot\n  Cold\nGeneric topic']])[0];
    const questions = [
      { id: 'q1', objective: '3.4', text: normalize('Which site is ready at once? A hot site.') },
      { id: 'q2', objective: '1.1', text: normalize('A cold site question on another objective') },
    ];
    const result = objectiveCoverage(objective, index, questions);
    expect(result.map(t => [t.name, t.status, t.questions])).toEqual([
      ['Hot', 'covered', ['q1']],
      ['Cold', 'gap', []],
      ['Generic topic', 'gap', []],
    ]);
    expect(result[0].path).toBe('Site considerations > Hot');
  });
});
