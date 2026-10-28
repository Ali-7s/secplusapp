import { TestBed } from '@angular/core/testing';
import { BrainDumpStore } from './brain-dump-store.service';

describe('BrainDumpStore', () => {
  const KEY = 'sp-braindump';
  const TIMES = 'sp-braindump-times';
  let store: BrainDumpStore;
  const rateAll = (deck: 'acronyms' | 'terms', ratings: [string, 'missed' | 'partly' | 'nailed'][]) =>
    ratings.forEach(([id, r]) => store.rate(deck, id, r));

  beforeEach(() => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(TIMES);
    store = TestBed.inject(BrainDumpStore);
  });

  afterEach(() => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(TIMES);
  });

  it('starts empty', () => {
    expect(store.load('acronyms').size).toBe(0);
  });

  it('remembers the deck and shuffle choice per deck, starting from the cards not yet nailed', () => {
    expect(store.roundOptions('acronyms')).toEqual({ scope: 'todo', shuffle: false });
    store.setRoundOptions('acronyms', { scope: 'review', shuffle: true });
    expect(store.roundOptions('acronyms')).toEqual({ scope: 'review', shuffle: true });
    expect(store.roundOptions('terms')).toEqual({ scope: 'todo', shuffle: false });
  });

  it('remembers ratings between loads', () => {
    rateAll('acronyms', [['ACL', 'nailed'], ['AES', 'missed']]);
    expect([...store.load('acronyms')]).toEqual([['ACL', 'nailed'], ['AES', 'missed']]);
  });

  it('dates every rating and every clear, for sync', () => {
    store.rate('acronyms', 'ACL', 'nailed');
    const before = store.forSync();
    expect(before.ratings).toEqual({ acronyms: { ACL: 'nailed' } });
    expect(before.times['acronyms']?.cards['ACL']).toBeGreaterThan(0);
    store.clear('acronyms');
    const after = store.forSync();
    expect(after.ratings).toEqual({ acronyms: {} });
    expect(after.times['acronyms']?.cleared).toBeGreaterThan(0);
  });

  it('adds a rating on top of ratings that arrived from another device', () => {
    store.rate('acronyms', 'ACL', 'nailed');
    store.replaceFromSync({ ratings: { acronyms: { ACL: 'nailed', AES: 'partly' } }, times: { acronyms: { cards: { ACL: 1, AES: 2 } } } });
    store.rate('acronyms', 'DNS', 'missed');
    expect([...store.load('acronyms')].sort()).toEqual([['ACL', 'nailed'], ['AES', 'partly'], ['DNS', 'missed']]);
  });

  it('keeps acronyms and key terms apart', () => {
    store.rate('acronyms', 'ACL', 'nailed');
    store.rate('terms', 'Hashing', 'partly');
    expect([...store.load('acronyms')]).toEqual([['ACL', 'nailed']]);
    expect([...store.load('terms')]).toEqual([['Hashing', 'partly']]);
  });

  it('clears one deck without touching the other', () => {
    store.rate('acronyms', 'ACL', 'nailed');
    store.rate('terms', 'Hashing', 'partly');
    store.clear('acronyms');
    expect(store.load('acronyms').size).toBe(0);
    expect(store.load('terms').size).toBe(1);
  });

  it('ignores damaged storage instead of throwing', () => {
    localStorage.setItem(KEY, '{not json');
    expect(store.load('acronyms').size).toBe(0);
    localStorage.setItem(KEY, '[1,2]');
    expect(store.load('acronyms').size).toBe(0);
    localStorage.setItem(KEY, JSON.stringify({ acronyms: { ACL: 'nailed', AES: 'great', DNS: 3 } }));
    expect([...store.load('acronyms')]).toEqual([['ACL', 'nailed']]);
  });

  it('carries on quietly when storage refuses to write or read', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('quota');
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    expect(() => store.rate('acronyms', 'ACL', 'nailed')).not.toThrow();
    expect(store.load('acronyms').size).toBe(0);
  });
});
