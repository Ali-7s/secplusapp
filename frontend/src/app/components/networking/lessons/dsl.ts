import { Block, CalloutKind, QuizQuestion } from '../networking.model';

/** Small builders so lesson files read like the lessons themselves. Text supports **bold** and `code`. */

export const h = (text: string): Block => ({ type: 'h', text });
export const hSecure = (text: string): Block => ({ type: 'h', text, tone: 'secure' });
export const p = (md: string): Block => ({ type: 'p', md });
export const list = (...items: string[]): Block => ({ type: 'list', items });
export const steps = (...items: string[]): Block => ({ type: 'list', items, ordered: true });

const callout = (kind: CalloutKind, title: string) => (md: string, customTitle?: string): Block =>
  ({ type: 'callout', kind, title: customTitle ?? title, md });

export const analogy = callout('analogy', 'Think of it like this');
export const exam = callout('exam', 'On the exam');
export const tip = callout('tip', 'Tip');
export const trap = callout('trap', 'Common trap');
export const secure = callout('secure', 'How to secure it');

/** The lesson's new vocabulary up front, in plain English, so nothing is used before it is explained. */
export const words = (...rows: [string, string][]): Block =>
  ({ type: 'table', columns: ['Word', 'What it means'], rows, caption: 'New words in this lesson. Come back here whenever one trips you up.' });

/** A short reminder of what this lesson builds on. */
export const recap = (md: string): Block => tip(md, 'From earlier lessons');

export const table = (columns: string[], rows: string[][], opts: { caption?: string; mono?: number[] } = {}): Block =>
  ({ type: 'table', columns, rows, caption: opts.caption, mono: opts.mono });

/** Small deterministic PRNG so shuffled answers are the same on every load. */
function seededRandom(text: string): () => number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a multiple-choice question. Pass the correct answer and the three wrong ones; the options are
 * shuffled deterministically (seeded by the question) so the right answer is not always in the same slot.
 * Wrong options must not refer to each other ("all of the above" and the like), because they get reordered.
 */
export function mcq(question: string, correct: string, wrong: [string, string, string], explanation: string): QuizQuestion {
  const random = seededRandom(question);
  const options = [correct, ...wrong];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { question, options, answer: options.indexOf(correct), explanation };
}
