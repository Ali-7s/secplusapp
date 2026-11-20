/**
 * How a right drill answer is rated, from how long it took: quick recall is Easy, steady recall Good, slow recall
 * Hard, the way a learner would rate a Review card. Nothing on screen says which; only the schedule shows it.
 *
 * The time allowed grows with what had to be read and typed, so a long situation or a typed protocol name is not
 * marked slow for its length. Time with the page hidden never counts, and an answer that took so long the learner
 * was clearly away counts as Good, since it says nothing about recall.
 */

export type SpeedRating = 'easy' | 'good' | 'hard';

/** Reading speed for the question, in characters a second. */
const READ_PER_SEC = 20;
/** Typing time a character, phone keyboards included. */
const TYPE_MS = 350;
/** Moving to the box or the choice and confirming. */
const ACT_MS = 1000;
/** On top of reading and typing: answers within EASY_MS are Easy, within GOOD_MS Good, and slower ones Hard. */
const EASY_MS = 2500;
const GOOD_MS = 8000;
/** Longer than this, the learner was away, not thinking. */
const AWAY_MS = 120_000;

/** The time reading the prompt and entering `typed` should take (nothing to type for a choice). */
export function expectedMs(prompt: string, typed: string, choice: boolean): number {
  return (prompt.length / READ_PER_SEC) * 1000 + ACT_MS + (choice ? 0 : typed.trim().length * TYPE_MS);
}

export function speedRating(ms: number | undefined, prompt: string, typed: string, choice: boolean): SpeedRating {
  if (ms === undefined || !(ms >= 0) || ms > AWAY_MS) return 'good';
  const extra = ms - expectedMs(prompt, typed, choice);
  return extra <= EASY_MS ? 'easy' : extra <= GOOD_MS ? 'good' : 'hard';
}
