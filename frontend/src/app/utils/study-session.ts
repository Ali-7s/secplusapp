/**
 * Where you were on the Acronyms and Key Terms pages, kept in this browser so a refresh picks up in the same
 * place: the flashcard deck and card, the mode and filters, and the Quick Checks already answered. These are this
 * device's screens, not study progress, so they are not synced (card schedules and results are, via progress).
 */

import { FcMode } from '../components/brain-dump/fc-mode-switch.component';

export type DeckKind = 'acr' | 'term';

export interface DeckSession {
  flashcards: boolean;
  mode: FcMode;
  order: 'smart' | 'az';
  category: string;
  search: string;
  /** The deck's cards by name, in the order they were dealt. */
  deck: string[];
  index: number;
  /** Cards marked known in this pass through the deck. */
  done: string[];
}

const sessionKey = (kind: DeckKind) => `sp-deck-${kind}`;
const quickKey = (kind: DeckKind) => `sp-quick-${kind}`;

function read<T>(key: string): T | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return value && typeof value === 'object' ? (value as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or unavailable */ }
}

export const loadDeckSession = (kind: DeckKind) => read<DeckSession>(sessionKey(kind));
export const saveDeckSession = (kind: DeckKind, session: DeckSession) => write(sessionKey(kind), session);

/**
 * The saved deck rebuilt from today's cards, or null when the cards no longer match (new cards, a changed filter),
 * in which case a fresh deck is dealt.
 */
export function restoreDeck<T>(session: DeckSession, cards: T[], nameOf: (card: T) => string): { deck: T[]; index: number; done: Set<number> } | null {
  if (!Array.isArray(session.deck) || session.deck.length !== cards.length || !cards.length) return null;
  const byName = new Map(cards.map(c => [nameOf(c), c]));
  const deck = session.deck.map(name => byName.get(name));
  if (deck.some(c => !c)) return null;
  const position = new Map(session.deck.map((name, i) => [name, i]));
  const done = new Set((session.done ?? []).map(name => position.get(name)).filter((i): i is number => i !== undefined));
  return { deck: deck as T[], index: Math.min(Math.max(Number(session.index) || 0, 0), deck.length - 1), done };
}

/** A cheap fingerprint of a session, so it is only written when something actually changed. */
export const sessionSignature = (s: DeckSession) =>
  [s.flashcards, s.mode, s.order, s.category, s.search, s.index, s.done.length, s.deck.length, s.deck[0], s.deck[s.index]].join('|');

/** A Quick Check answered on a card: the letter picked and whether it was marked as a guess. */
export interface QuickAnswer { letter: string; guess: boolean }

export function loadQuickAnswers(kind: DeckKind): Map<string, QuickAnswer> {
  const saved = read<Record<string, QuickAnswer>>(quickKey(kind)) ?? {};
  return new Map(Object.entries(saved).filter(([, a]) => a && typeof a.letter === 'string'));
}

export function saveQuickAnswers(kind: DeckKind, answers: ReadonlyMap<string, QuickAnswer>) {
  write(quickKey(kind), Object.fromEntries(answers));
}

/** A brain dump round in progress: its cards in order, the open card, and what has been typed for it so far. */
export interface DumpRound { ids: string[]; index: number; draft: string }

const roundKey = (deck: string) => `sp-dump-round-${deck}`;
export const loadDumpRound = (deck: string) => read<DumpRound>(roundKey(deck));
export const saveDumpRound = (deck: string, round: DumpRound) => write(roundKey(deck), round);
