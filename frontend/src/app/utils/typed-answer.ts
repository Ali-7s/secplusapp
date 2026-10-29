/**
 * Checking a typed answer in Review mode. A card can carry its own check (the Reference deck's ports, RAID
 * levels and so on); an acronym card is checked against its expansion. Cards whose answer is an explanation,
 * such as Key Terms, have no check: you still type your answer, then compare it with the card yourself.
 */

export interface Verdict {
  right: boolean;
  /** Why, when it helps: "Missing: TCP", "HTTP is port 80". */
  note?: string;
}

export type AnswerCheck = (typed: string) => Verdict;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function phraseRegExp(phrase: string): RegExp | null {
  const parts = phrase.split(/[^A-Za-z0-9]+/).filter(Boolean).map(escapeRegExp);
  if (!parts.length) return null;
  // Parts may be joined by any separator or none, so "sha256", "SHA 256" and "SHA-256" all match "SHA-256".
  return new RegExp(`(?<![A-Za-z0-9])${parts.join(String.raw`[^A-Za-z0-9]*`)}(?![A-Za-z0-9])`, 'i');
}

/** Where `text` mentions `phrase` as whole words, or -1. "POP3" is not found in "POP3S". */
export function mentionAt(text: string, phrase: string): number {
  const re = phraseRegExp(phrase);
  return re ? text.search(re) : -1;
}

export const mentions = (text: string, phrase: string) => mentionAt(text, phrase) >= 0;

export const mentionsAny = (text: string, phrases: readonly string[]) => phrases.some(p => mentions(text, p));

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, none: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
};

/** The numbers in `text`, written as digits or (with `words`) as words up to ten. The 3 in "POP3" is not one. */
export function numbersIn(text: string, words = false): number[] {
  const re = words ? /(?<![a-z])\d+|[a-z]+/gi : /(?<![a-z])\d+/gi;
  const out: number[] = [];
  for (const m of text.match(re) ?? []) {
    if (/^\d+$/.test(m)) out.push(Number(m));
    else if (m.toLowerCase() in NUMBER_WORDS) out.push(NUMBER_WORDS[m.toLowerCase()]);
  }
  return out;
}

// ── Expansions ("Authentication Header") ─────────────────────────────────────

const STOP_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'over', 'the', 'to', 'with']);

const words = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[^a-z0-9]+/).filter(w => w && !STOP_WORDS.has(w));

/** Edit distance with swaps of neighbouring letters counted once ("hedaer" is one away from "header"). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Whether a typed word is the wanted one: same word, a plural, or a small typo in a longer word. */
function sameWord(got: string, want: string): 'same' | 'typo' | null {
  if (got === want || got === `${want}s` || want === `${got}s`) return 'same';
  if (want.length >= 5 && distance(got, want) <= (want.length >= 9 ? 2 : 1)) return 'typo';
  return null;
}

/**
 * Right when every word of the expansion is there, in any order and ignoring small words like "of". Small typos
 * in longer words pass, with a note.
 */
export function expansionCheck(expansion: string): AnswerCheck {
  const want = words(expansion);
  return typed => {
    const got = words(typed);
    const missing: string[] = [];
    const typos: string[] = [];
    for (const w of want) {
      const matches = got.map(g => sameWord(g, w));
      if (matches.includes('same')) continue;
      if (matches.includes('typo')) typos.push(w);
      else missing.push(w);
    }
    if (missing.length) return { right: false, note: `Missing: ${missing.join(', ')}.` };
    return typos.length ? { right: true, note: `Close enough. Check the spelling of ${typos.join(', ')}.` } : { right: true };
  };
}
