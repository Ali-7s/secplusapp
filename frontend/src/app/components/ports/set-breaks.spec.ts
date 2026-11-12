import { BREAK_MS, LOCK_AFTER, SetPractice, afterAnswer, afterOverrule, afterRound, isRested, lockedSets } from './set-breaks';

const NOW = Date.UTC(2026, 10, 12, 9);
const MIN = 60_000;

/** A set's record after these answers, one a minute from NOW. */
function drill(answers: boolean[], rec?: SetPractice, start = NOW) {
  answers.forEach((right, i) => (rec = afterAnswer(rec, right, start + i * MIN)));
  return rec!;
}

describe('Breaks between sets', () => {
  it('locks a set on its tenth miss without an hour\'s break, right answers in between or not', () => {
    const nine = drill([...Array(9).fill(false), true, true]);
    expect(nine.misses).toBe(LOCK_AFTER - 1);
    expect(nine.locked).toBeUndefined();
    const ten = drill([false], nine, NOW + 20 * MIN);
    expect(ten.locked).toBe(NOW + 20 * MIN);
    expect(drill([true, true], ten, NOW + 21 * MIN).locked).withContext('stays locked to the end of the round').toBe(ten.locked!);
  });

  it('starts the count over after an hour away from the set', () => {
    const before = drill(Array(8).fill(false));
    expect(drill([false], before, before.at + BREAK_MS).misses).toBe(1);
    expect(drill([false], before, before.at + BREAK_MS - MIN).misses).toBe(9);
  });

  it('takes back a miss that was overruled, and the lock with it if that miss made it', () => {
    const locked = drill(Array(LOCK_AFTER).fill(false));
    const back = afterOverrule(locked);
    expect(back.misses).toBe(LOCK_AFTER - 1);
    expect(back.locked).toBeUndefined();
    expect(afterOverrule(drill([false, false], locked, NOW + 20 * MIN)).locked).toBeDefined();
  });

  it('opens locked sets when a round of another set, rested when it began, is finished', () => {
    const sets = { mail: drill(Array(LOCK_AFTER).fill(false)), web: drill([true]), files: drill([false]) };
    expect(afterRound(sets, 'names', true)).toEqual({ mail: { at: sets.mail.at, misses: 0 } });
    expect(afterRound(sets, 'web', false)).withContext('drilled within the hour: not a break').toEqual({});
    expect(afterRound(sets, 'mail', true)).withContext('not by a round of itself').toEqual({});
  });

  it('counts a set as rested after an hour, or if never drilled', () => {
    expect(isRested(undefined, NOW)).toBeTrue();
    expect(isRested({ at: NOW, misses: 0 }, NOW + BREAK_MS - 1)).toBeFalse();
    expect(isRested({ at: NOW, misses: 0 }, NOW + BREAK_MS)).toBeTrue();
  });

  it('never locks every set, which would leave none to open them', () => {
    const lock = { at: NOW, misses: LOCK_AFTER, locked: NOW };
    expect([...lockedSets({ a: lock, b: { at: NOW, misses: 2 } }, ['a', 'b'])]).toEqual(['a']);
    expect([...lockedSets({ a: lock, b: lock }, ['a', 'b'])]).toEqual([]);
  });
});
