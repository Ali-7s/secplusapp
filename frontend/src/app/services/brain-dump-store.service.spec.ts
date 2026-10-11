import { TestBed } from '@angular/core/testing';
import { BrainDumpStore } from './brain-dump-store.service';

describe('BrainDumpStore', () => {
  const KEY = 'sp-braindump';
  let store: BrainDumpStore;

  beforeEach(() => {
    localStorage.removeItem(KEY);
    store = TestBed.inject(BrainDumpStore);
  });

  afterEach(() => localStorage.removeItem(KEY));

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
    store.save('acronyms', new Map([['ACL', 'nailed'], ['AES', 'missed']]));
    expect([...store.load('acronyms')]).toEqual([['ACL', 'nailed'], ['AES', 'missed']]);
  });

  it('keeps acronyms and key terms apart', () => {
    store.save('acronyms', new Map([['ACL', 'nailed']]));
    store.save('terms', new Map([['Hashing', 'partly']]));
    expect([...store.load('acronyms')]).toEqual([['ACL', 'nailed']]);
    expect([...store.load('terms')]).toEqual([['Hashing', 'partly']]);
  });

  it('clears one deck without touching the other', () => {
    store.save('acronyms', new Map([['ACL', 'nailed']]));
    store.save('terms', new Map([['Hashing', 'partly']]));
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
    expect(() => store.save('acronyms', new Map([['ACL', 'nailed']]))).not.toThrow();
    expect(store.load('acronyms').size).toBe(0);
  });
});
