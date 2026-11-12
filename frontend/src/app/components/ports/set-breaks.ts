/**
 * Breaks between sets, so a day does not go on one set. After LOCK_AFTER misses in a set's drills, with no hour's
 * break from it, the set locks. It opens again when a round of another set is finished, one that had not been
 * drilled for an hour when the round began. Only set drills count, and only for the Ports trainer's drills (not the
 * firewall tables).
 */

/** Misses in a set's drills, without an hour's break, that lock it. */
export const LOCK_AFTER = 10;
/** Time away from a set that counts as a break: its misses start over, and a round of it can open another set. */
export const BREAK_MS = 60 * 60 * 1000;

/** What is kept for each set: when it was last drilled, its misses since the last break, and when it locked. */
export interface SetPractice { at: number; misses: number; locked?: number }
export type SetPractices = Record<string, SetPractice>;

/** Whether a set has not been drilled for an hour (or ever), so a round of it counts as a break from the others. */
export const isRested = (rec: SetPractice | undefined, now: number) => !rec || now - rec.at >= BREAK_MS;

/** A set's record after an answer in one of its drills. The answer that makes LOCK_AFTER misses locks it. */
export function afterAnswer(rec: SetPractice | undefined, right: boolean, now: number): SetPractice {
  const misses = (isRested(rec, now) ? 0 : rec!.misses) + (right ? 0 : 1);
  const locked = rec?.locked ?? (misses >= LOCK_AFTER ? now : undefined);
  return locked === undefined ? { at: now, misses } : { at: now, misses, locked };
}

/** A set's record after a wrong mark is overruled: one miss fewer, and open again if that miss was the one that locked it. */
export function afterOverrule(rec: SetPractice): SetPractice {
  const misses = Math.max(0, rec.misses - 1);
  return misses < LOCK_AFTER ? { at: rec.at, misses } : { ...rec, misses };
}

/**
 * The sets a finished round opens: every other locked set, when the round's set had been rested when it began.
 * Their misses start over.
 */
export function afterRound(sets: SetPractices, set: string, rested: boolean): SetPractices {
  if (!rested) return {};
  return Object.fromEntries(Object.entries(sets).filter(([id, rec]) => id !== set && rec.locked).map(([id, rec]) => [id, { at: rec.at, misses: 0 }]));
}

/** The locked sets among `ids`. If all of them are locked, none is: no set would be left to open them. */
export function lockedSets(sets: SetPractices, ids: string[]): Set<string> {
  const locked = ids.filter(id => sets[id]?.locked);
  return new Set(locked.length < ids.length ? locked : []);
}
