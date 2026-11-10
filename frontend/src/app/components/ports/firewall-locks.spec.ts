import { CheckedTable, Failed, unlockedAfter } from './firewall-locks';

const table = (over: Partial<CheckedTable>): CheckedTable => ({ id: 't', set: 'web', written: false, perfect: true, first: true, ...over });
const MAIL: Failed = { id: 'pf-mail', set: 'mail' };
const WEB: Failed = { id: 'pf-web', set: 'web' };

describe('written scenario locks', () => {
  it('keeps a failed scenario locked until something unlocks it', () => {
    expect(unlockedAfter({}, table({ id: 'pf-mail', set: 'mail', written: true, perfect: false }), [MAIL])).toEqual({});
  });

  it('unlocks on a perfect table from a different category, random or written', () => {
    expect(unlockedAfter({}, table({ set: 'web' }), [MAIL])).toEqual({ 'pf-mail': true });
    expect(unlockedAfter({}, table({ id: 'pf-vpn', set: 'vpn', written: true }), [MAIL])).toEqual({ 'pf-mail': true });
    expect(unlockedAfter({}, table({ set: 'mixed' }), [MAIL])).toEqual({ 'pf-mail': true });
  });

  it('never unlocks from the same category', () => {
    expect(unlockedAfter({}, table({ set: 'mail' }), [MAIL])).toEqual({});
    expect(unlockedAfter({}, table({ id: 'pf-mail-2', set: 'mail', written: true }), [MAIL])).toEqual({});
    expect(unlockedAfter({}, table({ set: 'web' }), [MAIL, WEB])).toEqual({ 'pf-mail': true });
  });

  it('needs every rule right', () => {
    expect(unlockedAfter({}, table({ set: 'web', perfect: false }), [MAIL])).toEqual({});
  });

  it('ignores a second try at a random table, which comes after reading its answers', () => {
    expect(unlockedAfter({}, table({ set: 'web', first: false }), [MAIL])).toEqual({});
  });

  it('locks a scenario again when its retry fails', () => {
    const open = unlockedAfter({}, table({ set: 'web' }), [MAIL]);
    expect(unlockedAfter(open, table({ id: 'pf-mail', set: 'mail', written: true, perfect: false }), [MAIL])).toEqual({});
  });

  it('keeps other scenarios unlocked while one fails, and forgets scenarios that are no longer failed', () => {
    const open = { 'pf-mail': true, 'pf-old': true } as const;
    expect(unlockedAfter(open, table({ id: 'pf-web', set: 'web', written: true, perfect: false }), [MAIL, WEB])).toEqual({ 'pf-mail': true });
  });

  it('a failing scenario does not unlock others, even from another category', () => {
    expect(unlockedAfter({}, table({ id: 'pf-web', set: 'web', written: true, perfect: false }), [MAIL, WEB])).toEqual({});
  });
});
