import { Acronym, Term } from '../models/glossary.model';
import {
  DumpCard, Rating, acronymToDumpCard, buildRubric, highlight, pickDeck, rate, shuffled, splitSentences, tally,
  termToDumpCard,
} from './brain-dump';

const card = (id: string, extra: Partial<DumpCard> = {}): DumpCard => ({
  id, name: id, category: 'Test', definition: 'A first sentence. A second sentence. A third one. A fourth one.',
  examContext: '', related: [], ...extra,
});

describe('splitSentences', () => {
  it('splits on sentence ends and keeps dots inside names and versions', () => {
    expect(splitSentences('An IEEE standard (802.1X) for ports. It uses TLS 1.3 today.')).toEqual([
      'An IEEE standard (802.1X) for ports.',
      'It uses TLS 1.3 today.',
    ]);
  });

  it('copes with empty input', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences(undefined)).toEqual([]);
  });
});

describe('buildRubric', () => {
  it('puts the letters first for an acronym, then the written key points', () => {
    const items = buildRubric(card('ACL', { expansion: 'Access Control List' }), ['Permit and deny rules', 'First match wins']);
    expect(items).toEqual([
      { tag: 'Letters', text: 'Access Control List' },
      { text: 'Permit and deny rules' },
      { text: 'First match wins' },
    ]);
  });

  it('has no letters item for a key term', () => {
    expect(buildRubric(card('Hashing'), ['One-way function'])).toEqual([{ text: 'One-way function' }]);
  });

  it('falls back to the first three sentences of the definition when no points are written', () => {
    const items = buildRubric(card('X'), undefined);
    expect(items.map(i => i.text)).toEqual(['A first sentence.', 'A second sentence.', 'A third one.']);
    expect(buildRubric(card('X'), []).length).toBe(3);
  });
});

describe('rate', () => {
  const cases: Array<[number, number, Rating]> = [
    [4, 4, 'nailed'], [3, 4, 'nailed'], [2, 4, 'partly'], [1, 4, 'missed'], [0, 4, 'missed'],
    [4, 5, 'nailed'], [3, 5, 'partly'], [2, 5, 'partly'], [1, 5, 'missed'],
    [3, 3, 'nailed'], [2, 3, 'partly'], [1, 3, 'missed'],
    [2, 2, 'nailed'], [1, 2, 'partly'], [0, 2, 'missed'],
    [5, 6, 'nailed'], [4, 6, 'partly'],
  ];
  for (const [covered, total, expected] of cases) {
    it(`${covered} of ${total} is ${expected}`, () => expect(rate(covered, total)).toBe(expected));
  }

  it('treats an empty checklist as missed', () => expect(rate(0, 0)).toBe('missed'));
});

describe('highlight', () => {
  const joined = (segments: { text: string }[]) => segments.map(s => s.text).join('');
  const hits = (segments: { text: string; hit: boolean }[]) => segments.filter(s => s.hit).map(s => s.text);

  it('flags the words the learner used and leaves the text itself untouched', () => {
    const text = 'A set of rules that permits or denies traffic by IP address.';
    const segments = highlight(text, 'a list of rule that allow or deny traffic from an ip');
    expect(joined(segments)).toBe(text);
    expect(hits(segments)).toEqual(['rules', 'denies traffic', 'IP']);
  });

  it('matches plurals and related word forms', () => {
    expect(hits(highlight('It encrypts data in transit.', 'encryption'))).toEqual(['encrypts']);
    expect(hits(highlight('Hosts authenticate first.', 'authentication'))).toEqual(['authenticate']);
    expect(hits(highlight('Blocked sessions are logged.', 'it blocks the session'))).toEqual(['Blocked sessions']);
  });

  it('never highlights words that carry no meaning', () => {
    expect(hits(highlight('It is a list of the things that are in it.', 'it is a list of the things that are in it'))).toEqual(['list', 'things']);
  });

  it('does not treat short or merely similar words as the same', () => {
    expect(hits(highlight('A portal to the port.', 'port'))).toEqual(['port']);
    expect(hits(highlight('The protocol protects data.', 'protect'))).toEqual(['protects']);
  });

  it('merges neighbouring hits into one highlight', () => {
    const segments = highlight('Rules are processed top-down, in access control order.', 'top down access control');
    expect(hits(segments)).toEqual(['top-down', 'access control']);
    expect(joined(segments)).toBe('Rules are processed top-down, in access control order.');
  });

  it('keeps hits apart when something other than a space, hyphen or slash sits between them', () => {
    expect(hits(highlight('Hash, then sign.', 'hash sign'))).toEqual(['Hash', 'sign']);
  });

  it('counts two-letter acronyms but not two-letter filler', () => {
    expect(hits(highlight('Works at the IP layer, to an extent.', 'ip at to'))).toEqual(['IP']);
  });

  it('returns the text as one plain run when nothing was written', () => {
    expect(highlight('Some text.', '')).toEqual([{ text: 'Some text.', hit: false }]);
    expect(highlight('Some text.', '   ')).toEqual([{ text: 'Some text.', hit: false }]);
  });
});

describe('pickDeck and tally', () => {
  const cards = ['A', 'B', 'C', 'D'].map(id => card(id));
  const results = new Map<string, Rating>([['A', 'nailed'], ['B', 'partly'], ['C', 'missed']]);

  it('"todo" skips the nailed cards and keeps new ones', () => {
    expect(pickDeck(cards, results, 'todo').map(c => c.id)).toEqual(['B', 'C', 'D']);
  });

  it('"review" is only the cards that were missed or partly known', () => {
    expect(pickDeck(cards, results, 'review').map(c => c.id)).toEqual(['B', 'C']);
  });

  it('"all" is every card', () => {
    expect(pickDeck(cards, results, 'all').map(c => c.id)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('counts each rating and the cards not yet tried', () => {
    expect(tally(cards, results)).toEqual({ nailed: 1, partly: 1, missed: 1, fresh: 1 });
  });

  it('ignores results for cards outside the deck', () => {
    expect(tally([cards[3]], results)).toEqual({ nailed: 0, partly: 0, missed: 0, fresh: 1 });
  });
});

describe('shuffled', () => {
  it('returns every item once without touching the original', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = shuffled(original);
    expect([...copy].sort()).toEqual(original);
    expect(original).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('is driven by the random source', () => {
    expect(shuffled([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
});

describe('card mapping', () => {
  it('maps an acronym card, splitting the related list', () => {
    const acronym = {
      acronym: 'ACL', expansion: 'Access Control List', definition: 'd', category: 'Access Control',
      examContext: 'e', relatedAcronyms: 'DAC, MAC; NAC', detail: {} as Acronym['detail'],
    } as Acronym;
    expect(acronymToDumpCard(acronym)).toEqual({
      id: 'ACL', name: 'ACL', category: 'Access Control', expansion: 'Access Control List', definition: 'd',
      examContext: 'e', related: ['DAC', 'MAC', 'NAC'], variants: undefined,
    });
  });

  it('maps a term card with its analogy and no letters', () => {
    const term = {
      term: 'Hashing', definition: 'd', category: 'Cryptography', examContext: 'e', analogy: 'a', relatedTerms: '',
      detail: {} as Term['detail'],
    } as Term;
    const mapped = termToDumpCard(term);
    expect(mapped.id).toBe('Hashing');
    expect(mapped.analogy).toBe('a');
    expect(mapped.expansion).toBeUndefined();
    expect(mapped.related).toEqual([]);
  });
});
