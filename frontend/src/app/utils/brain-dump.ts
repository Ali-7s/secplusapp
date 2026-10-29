/**
 * Helpers for the brain dump flashcard mode.
 *
 * In brain dump mode the learner writes down everything they can say about an acronym or term from memory,
 * then compares it with a checklist of what a complete explanation covers. Guessing the name from a
 * description is not the same skill as explaining the idea, and this mode trains the second one.
 */

import { Acronym, Term, VariantGroup } from '../models/glossary.model';

export type DeckId = 'acronyms' | 'terms';

/** What the learner decides about a card after comparing their explanation with the checklist. */
export type Rating = 'missed' | 'partly' | 'nailed';

/** Which cards a round goes through. */
export type Scope = 'todo' | 'review' | 'all';

/** What brain dump needs from an acronym or key-term card, so one component can serve both pages. */
export interface DumpCard {
  /** Unique within its deck: the acronym, or the term. */
  id: string;
  name: string;
  category: string;
  /** What the letters stand for. Acronym cards only. */
  expansion?: string;
  definition: string;
  examContext: string;
  /** The everyday comparison on a Key Terms card. */
  analogy?: string;
  related: string[];
  variants?: VariantGroup[];
  /** What to recall, shown under the name. Reference deck cards only ("Which port, and TCP or UDP?"). */
  prompt?: string;
  /** Labelled lines under the answer ("Example: ..."). Reference deck cards only. */
  notes?: { label: string; text: string }[];
}

/** One line of the "a complete answer covers" checklist. */
export interface RubricItem {
  /** A small label in front of the text ("Letters"). */
  tag?: string;
  text: string;
}

/** A run of text, flagged when the learner used the same word. */
export interface Segment {
  text: string;
  hit: boolean;
}

const splitRelated = (list: string): string[] =>
  (list ?? '').split(/[,;]/).map(s => s.trim()).filter(Boolean);

export function acronymToDumpCard(a: Acronym): DumpCard {
  return {
    id: a.acronym,
    name: a.acronym,
    category: a.category,
    expansion: a.expansion,
    definition: a.definition,
    examContext: a.examContext,
    related: splitRelated(a.relatedAcronyms),
    variants: a.variants,
  };
}

export function termToDumpCard(t: Term): DumpCard {
  return {
    id: t.term,
    name: t.term,
    category: t.category,
    definition: t.definition,
    examContext: t.examContext,
    analogy: t.analogy,
    related: splitRelated(t.relatedTerms),
    variants: t.variants,
  };
}

// ── Checklist ──────────────────────────────────────────────────────────────

/** Splits prose into sentences. Dots inside "802.1X" or "TLS 1.3" are not followed by a space, so they stay put. */
export function splitSentences(text: string | null | undefined): string[] {
  return (text ?? '')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * The checklist a finished explanation is compared with: what the letters stand for (acronyms), then the key
 * points written for the card. A card without written points falls back to the sentences of its definition,
 * so every card still has something to check against.
 */
export function buildRubric(card: DumpCard, points: ReadonlyArray<string> | undefined): RubricItem[] {
  const items: RubricItem[] = [];
  if (card.expansion) items.push({ tag: 'Letters', text: card.expansion });

  const core = points?.length ? points : splitSentences(card.definition).slice(0, 3);
  for (const text of core) items.push({ text });
  return items;
}

/** A card counts as nailed with three quarters of the checklist, and as partly known with two fifths. */
export function rate(covered: number, total: number): Rating {
  if (total <= 0) return 'missed';
  if (covered * 4 >= total * 3) return 'nailed';
  return covered * 5 >= total * 2 ? 'partly' : 'missed';
}

// ── Highlighting the words the learner used ────────────────────────────────

/** Words that carry no meaning of their own, so sharing them proves nothing. */
const STOP_WORDS = new Set(
  (
    'a about above after again all also an and any are as at be because been before being between both but by ' +
    'can could did do does doing during each few for from further had has have having he her here how i if ' +
    'in into is it its just like make makes many may might more most must my no nor not now of off on once only ' +
    'or other our out over own same she should so some such than that the their them then there these they this ' +
    'those through to too under until use used uses using usually very was we were what when where which ' +
    'while who whom why will with within without would you your often typically commonly generally called known'
  ).split(/\s+/),
);

/** Lower-case form with the plural and the common verb endings removed, so "rules" matches "rule". */
function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 5 && w.endsWith('ed')) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
  return w;
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Same word, or two long words that share most of their start ("encrypt" and "encryption"). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 6 || b.length < 6) return false;
  const shared = commonPrefix(a, b);
  return shared >= 5 && shared / Math.min(a.length, b.length) >= 0.75;
}

const WORD = /[A-Za-z0-9]+/g;

/** Two-letter words only count when they look like acronyms ("IP", "AI") or contain a digit ("S3"). */
function isContentWord(word: string): boolean {
  if (STOP_WORDS.has(word.toLowerCase())) return false;
  if (word.length >= 3) return true;
  return word.length === 2 && (word === word.toUpperCase() || /\d/.test(word));
}

/**
 * Splits `text` into runs, flagging each word the learner also used in `attempt`. Matching ignores case and
 * plurals, and treats "encrypt", "encrypted" and "encryption" as the same word. Neighbouring hits are merged,
 * so "access control list" is one highlight rather than three.
 *
 * This only compares words, not meaning: a correct explanation in different words will not light up, so it is
 * a hint for the learner's own judgement and never a score.
 */
export function highlight(text: string, attempt: string): Segment[] {
  const used = [...new Set((attempt.match(WORD) ?? []).filter(w => w.length >= 2 && !STOP_WORDS.has(w.toLowerCase())).map(stem))];
  if (!used.length || !text) return [{ text, hit: false }];

  const words = [...text.matchAll(WORD)].map(m => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    hit: isContentWord(m[0]) && used.some(u => sameWord(u, stem(m[0]))),
  }));

  const segments: Segment[] = [];
  let cursor = 0;
  let open: { start: number; end: number } | null = null;

  const flush = () => {
    if (!open) return;
    if (open.start > cursor) segments.push({ text: text.slice(cursor, open.start), hit: false });
    segments.push({ text: text.slice(open.start, open.end), hit: true });
    cursor = open.end;
    open = null;
  };

  for (const word of words) {
    if (!word.hit) continue;
    // Only spaces, hyphens or slashes between two hits: "top-down", "access control".
    if (open && /^[\s\-/]*$/.test(text.slice(open.end, word.start))) open.end = word.end;
    else {
      flush();
      open = { start: word.start, end: word.end };
    }
  }
  flush();
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
}

// ── Choosing the cards for a round ─────────────────────────────────────────

/** The cards a round goes through, in their current order. */
export function pickDeck(cards: ReadonlyArray<DumpCard>, results: ReadonlyMap<string, Rating>, scope: Scope): DumpCard[] {
  switch (scope) {
    case 'all':
      return [...cards];
    case 'review':
      return cards.filter(c => needsReview(results.get(c.id)));
    default:
      return cards.filter(c => results.get(c.id) !== 'nailed');
  }
}

const needsReview = (rating: Rating | undefined): boolean => rating === 'missed' || rating === 'partly';

export interface Tally {
  nailed: number;
  partly: number;
  missed: number;
  /** Cards never rated. */
  fresh: number;
}

export function tally(cards: ReadonlyArray<DumpCard>, results: ReadonlyMap<string, Rating>): Tally {
  const counts: Tally = { nailed: 0, partly: 0, missed: 0, fresh: 0 };
  for (const card of cards) {
    const rating = results.get(card.id);
    if (rating) counts[rating]++;
    else counts.fresh++;
  }
  return counts;
}

/** A shuffled copy, so the order of the alphabet stops giving the next card away. */
export function shuffled<T>(items: ReadonlyArray<T>, random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
