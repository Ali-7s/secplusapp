import { DeckSession, loadQuickAnswers, restoreDeck, saveQuickAnswers, sessionSignature } from './study-session';

const session = (deck: string[], index = 0, done: string[] = []): DeckSession =>
  ({ flashcards: true, mode: 'flip', order: 'smart', category: 'All', search: '', deck, index, done });

describe('restoreDeck', () => {
  const cards = ['AES', 'AH', 'ESP'].map(name => ({ name }));

  it('deals the saved order again, on the same card, with the same cards marked known', () => {
    const r = restoreDeck(session(['ESP', 'AES', 'AH'], 2, ['ESP']), cards, c => c.name)!;
    expect(r.deck.map(c => c.name)).toEqual(['ESP', 'AES', 'AH']);
    expect(r.index).toBe(2);
    expect([...r.done]).toEqual([0]);
  });

  it('gives up when the cards no longer match, so a fresh deck is dealt', () => {
    expect(restoreDeck(session(['AES', 'AH']), cards, c => c.name)).toBeNull();
    expect(restoreDeck(session(['AES', 'AH', 'IKE']), cards, c => c.name)).toBeNull();
  });

  it('keeps the card position inside the deck', () => {
    expect(restoreDeck(session(['AES', 'AH', 'ESP'], 99), cards, c => c.name)!.index).toBe(2);
  });
});

describe('session signature', () => {
  it('changes when the card or the known count changes', () => {
    const a = session(['AES', 'AH'], 0);
    expect(sessionSignature(a)).not.toBe(sessionSignature({ ...a, index: 1 }));
    expect(sessionSignature(a)).not.toBe(sessionSignature({ ...a, done: ['AES'] }));
  });
});

describe('quick answers', () => {
  afterEach(() => localStorage.removeItem('sp-quick-acr'));

  it('round-trips through storage and ignores damaged entries', () => {
    saveQuickAnswers('acr', new Map([['AH', { letter: 'D', guess: true }]]));
    expect([...loadQuickAnswers('acr')]).toEqual([['AH', { letter: 'D', guess: true }]]);
    localStorage.setItem('sp-quick-acr', '{"AH":{"letter":4},"ESP":{"letter":"B","guess":false}}');
    expect([...loadQuickAnswers('acr').keys()]).toEqual(['ESP']);
  });
});
