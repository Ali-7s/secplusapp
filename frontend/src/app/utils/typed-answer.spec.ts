import { expansionCheck, mentions, numbersIn } from './typed-answer';

describe('typed answers', () => {
  it('finds a name however it is written, but only as whole words', () => {
    expect(mentions('sha256 is fine', 'SHA-256')).toBeTrue();
    expect(mentions('use SHA 256', 'SHA-256')).toBeTrue();
    expect(mentions('POP3S', 'POP3')).toBeFalse();
    expect(mentions('tacacs+', 'TACACS+')).toBeTrue();
  });

  it('reads numbers as digits, and as words when asked', () => {
    expect(numbersIn('UDP 67/68')).toEqual([67, 68]);
    expect(numbersIn('POP3 is TCP 110')).toEqual([110]);
    expect(numbersIn('three disks, survives one', true)).toEqual([3, 1]);
  });

  it('marks an expansion right in any order and case, forgiving small typos', () => {
    const check = expansionCheck('Recovery Time Objective');
    expect(check('recovery time objective').right).toBeTrue();
    expect(check('Objective for recovery time').right).toBeTrue();
    expect(check('Recovery Time Objectives').right).toBeTrue();
    const typo = check('Recovery Tme Objectvie');
    expect(typo.right).toBeFalse();
    const close = check('Recovery Time Objectvie');
    expect(close.right).toBeTrue();
    expect(close.note).toContain('objective');
  });

  it('says which words are missing', () => {
    const v = expansionCheck('Authentication Header')('Authentication');
    expect(v.right).toBeFalse();
    expect(v.note).toBe('Missing: header.');
  });
});
