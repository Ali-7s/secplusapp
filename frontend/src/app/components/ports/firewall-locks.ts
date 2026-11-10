/**
 * Written scenarios are fixed, so trying one again straight after reading its answers shows nothing about memory.
 * A written scenario checked with a mistake is therefore locked: its Try again opens only once every rule is right on
 * a table from a different category, which puts another topic in between. Nothing here depends on time.
 */

/** Written scenarios whose retry has been earned back since they last failed. */
export type Unlocked = Record<string, true>;

/** A written scenario whose last check had a mistake. */
export interface Failed { id: string; set: string }

export interface CheckedTable {
  id: string;
  /** Its category: a trainer set, or the mixed group. */
  set: string;
  /** A written scenario, as opposed to a random table. */
  written: boolean;
  /** Every rule was right. */
  perfect: boolean;
  /** A random table's first check. A second try comes after reading its answers, so it unlocks nothing. */
  first: boolean;
}

/**
 * What is unlocked after a table is checked. `failed` is every written scenario whose last check had a mistake,
 * counting the one just checked. A perfect table opens the failed scenarios of every other category and none of its
 * own; a written scenario that fails is locked again.
 */
export function unlockedAfter(unlocked: Unlocked, table: CheckedTable, failed: Failed[]): Unlocked {
  const next: Unlocked = {};
  for (const f of failed) if (unlocked[f.id]) next[f.id] = true;
  if (table.written && !table.perfect) delete next[table.id];
  if (table.perfect && (table.written || table.first)) {
    for (const f of failed) if (f.set !== table.set) next[f.id] = true;
  }
  return next;
}
