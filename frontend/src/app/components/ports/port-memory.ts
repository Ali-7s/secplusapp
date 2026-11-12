/**
 * A port's memory, shared by the drills, Review mode and the firewall tables: the two Reference deck cards every port
 * has, "Port 22: which protocol?" and "SSH: which port, and TCP or UDP?", both scheduled by FSRS-6. A drill question
 * is a review of one of them, so a port answered in a drill is not asked again in Review mode until it is due, and
 * the other way round.
 *
 * Its level, 0 to 4, is read from the weaker of the two cards:
 * - 0: never studied;
 * - 1: in its first learning steps after a right answer (in the drills 1 minute, then 20 minutes and a round of
 *   another set: DRILL_LEARN_STEPS), or relearning after a miss;
 * - 2: learned, but recall would fall below 90% within a week;
 * - 3: it would last a week or more;
 * - 4, mastered: three weeks or more.
 */

import { ProgressService, cardKey } from '../../services/progress.service';
import { ScheduleOptions, SrsCard, recallNow, schedule, stabilityOf } from '../../utils/srs';
import { PORTS } from '../reference/reference-data';
import { Asked, GROUPS, MAX_LEVEL, PortState, QKind, entryOf } from './ports-trainer';

/** Finds a Reference deck card by its id ("port:22"). */
export type CardLookup = (id: string) => SrsCard | undefined;

/** "Port 22: which protocol?" */
export const nameCard = (port: string) => `port:${port}`;
/** "SSH: which port, and TCP or UDP?" */
export const numberCard = (port: string) => `proto:${entryOf(port).protocol}`;

/**
 * A new port's learning steps in the drills: 1 minute, then 20 (Review mode keeps 1 and 10). The last step also
 * needs a finished round of another set since the one before, so a port reaches level 2 only when it is recalled
 * twenty minutes later with other ports in between, not while it is fresh in mind.
 */
export const DRILL_LEARN_STEPS = [60_000, 20 * 60_000];

/** The stability, in days, a card needs for level 3 and for level 4. */
export const LEVEL_DAYS = { 3: 7, 4: 21 } as const;

export function cardLevel(card: SrsCard | undefined): number {
  if (!card) return 0;
  // A first answer that was wrong starts the card but is no level yet.
  if (card.state !== 'review') return card.right > 0 ? 1 : 0;
  const s = stabilityOf(card);
  return s >= LEVEL_DAYS[4] ? MAX_LEVEL : s >= LEVEL_DAYS[3] ? 3 : 2;
}

const cardsOf = (port: string, cardOf: CardLookup) => [cardOf(nameCard(port)), cardOf(numberCard(port))];

export const portLevel = (port: string, cardOf: CardLookup) => Math.min(...cardsOf(port, cardOf).map(cardLevel));

/** A card wants a review when it is new or due. */
const wants = (card: SrsCard | undefined, now: number) => !card || card.due <= now;

export function portState(port: string, cardOf: CardLookup, now: number, asked?: Asked): PortState {
  const [name, number] = cardsOf(port, cardOf);
  return { level: Math.min(cardLevel(name), cardLevel(number)), wants: { name: wants(name, now), number: wants(number, now) }, asked };
}

/** A port already started with a card that wants a review: one due, or its other card still new. */
export function isDue(port: string, cardOf: CardLookup, now: number): boolean {
  const [name, number] = cardsOf(port, cardOf);
  return (!!name || !!number) && (wants(name, now) || wants(number, now));
}

/** A port never studied in either direction. */
export const isNew = (port: string, cardOf: CardLookup) => cardsOf(port, cardOf).every(c => !c);

/** How close to forgotten a due port is: the lowest recall chance among its due cards (a new one counts as 1). */
export function urgency(port: string, cardOf: CardLookup, now: number): number {
  return Math.min(...cardsOf(port, cardOf).filter(c => wants(c, now)).map(c => (c ? recallNow(c, now) ?? 1 : 1)));
}

/** When the port's next card falls due, or undefined if it has never been studied. */
export function nextDue(port: string, cardOf: CardLookup): number | undefined {
  const due = cardsOf(port, cardOf).filter((c): c is SrsCard => !!c).map(c => c.due);
  return due.length ? Math.min(...due) : undefined;
}

/** When the port was last answered anywhere. */
export function lastAnswered(port: string, cardOf: CardLookup): number | undefined {
  const at = cardsOf(port, cardOf).filter((c): c is SrsCard => !!c).map(c => c.at);
  return at.length ? Math.max(...at) : undefined;
}

/**
 * A drill answer on one of a port's cards. Wrong always counts in full (Again). Right is a review (Good), except in
 * two cases, where only the answer is counted:
 * - the question asked for part of the card only (TCP or UDP, without the number);
 * - the card is in a learning step that is not due yet, so drilling a new set three times in five minutes cannot rush
 *   it through its steps;
 * - the card is at its last learning step and no round of another set has been finished since the step before
 *   (`otherSet` false), so it stays at level 1, and due, until one has.
 * A learned card answered before it is due is still a review: the memory model gives it less credit the fresher it is.
 * Returns null when nothing changes (a partial answer about a card never studied).
 */
export function drillAnswer(
  card: SrsCard | undefined, kind: QKind, right: boolean, now: number, opts: ScheduleOptions = {}, otherSet = true,
): { card: SrsCard; review: boolean } | null {
  const o = { ...opts, learnSteps: DRILL_LEARN_STEPS };
  if (!right) return { card: schedule(card, 'again', now, o), review: true };
  const partial = kind === 'transport';
  const waiting = !!card && card.state !== 'review' && card.due > now;
  if (partial || waiting || (atLastStep(card) && !otherSet)) return card ? { card: { ...card, right: card.right + 1, at: now }, review: false } : null;
  return { card: schedule(card, 'good', now, o), review: true };
}

/** A new card whose next right answer would graduate it, to level 2. */
export const atLastStep = (card: SrsCard | undefined) => card?.state === 'learning' && card.step + 1 >= DRILL_LEARN_STEPS.length;

/** The set a port is in. */
export const groupOf = (port: string) => GROUPS.find(g => g.ports.includes(port))?.id;

/** In a round across sets, how many of a set's ports it must ask before it counts as a round of that set. */
const MIN_TO_COUNT = 2;

/** The sets a finished round counts for: a set round its own set, a round across sets each set it asked enough of. */
export function setsPracticed(set: string, ports: string[]): string[] {
  if (GROUPS.some(g => g.id === set)) return [set];
  const counts = new Map<string, number>();
  for (const p of ports) {
    const g = groupOf(p);
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= MIN_TO_COUNT).map(([g]) => g);
}

/**
 * Whether a round of a set other than the port's own was finished after the card's last step, given when each set's
 * last round finished. A card never studied needs none.
 */
export function otherSetSince(port: string, card: SrsCard | undefined, practiced: Record<string, number>): boolean {
  if (!card) return true;
  const since = card.last ?? card.at;
  const own = groupOf(port);
  return Object.entries(practiced).some(([set, at]) => set !== own && at > since);
}

// ── Levels from before the drills used FSRS ──────────────────────────────────

/** A port's level as the drills kept it before they used the Review cards, saved under lessonWork 'mastery'. */
export interface OldPortLevel { level: number; right: number; wrong: number; at: number; asked?: QKind; askedPart?: number }

const DAY = 86_400_000;
/**
 * The stability an old level stands for. Lower than the level would now need: old levels could rise every hour, so
 * all four might have come in one day, which FSRS would barely count.
 */
const OLD_LEVEL_DAYS = [0, 0, 2.5, 4, 8];

/**
 * Cards for the ports' old levels, for each card that is weaker than its port's old level says. A level 1 port gets a
 * card in its learning steps; a higher one a learned card, timed from when the port was last drilled, so a port not
 * drilled for a while is due straight away. Stronger cards are left as they are.
 */
export function cardsFromOldLevels(old: Record<string, OldPortLevel>, cardOf: CardLookup, now: number): Record<string, SrsCard> {
  const out: Record<string, SrsCard> = {};
  for (const [port, o] of Object.entries(old)) {
    if (!PORTS.some(p => p.port === port) || !(o?.level >= 1)) continue;
    const last = Math.min(o.at || now, now);
    const level = Math.min(MAX_LEVEL, Math.round(o.level));
    for (const id of [nameCard(port), numberCard(port)]) {
      const existing = cardOf(id);
      const s = OLD_LEVEL_DAYS[level];
      const target: SrsCard = level === 1
        ? schedule(undefined, 'good', last)
        : {
          state: 'review', step: 0, interval: Math.round(s), ease: 2.5, due: last + s * DAY, reps: level, lapses: 0,
          right: level, wrong: 0, at: last, first: last, stability: s, difficulty: existing?.difficulty ?? 5, last,
        };
      if (cardLevel(existing) >= cardLevel(target)) continue;
      // Stamped now, so sync keeps it over an older copy of the card.
      out[id] = { ...target, right: Math.max(target.right, existing?.right ?? 0), wrong: existing?.wrong ?? 0, first: existing?.first ?? last, at: now };
    }
  }
  return out;
}

/** How the drills last asked each port, carried over from the old levels. */
export function askedFromOldLevels(old: Record<string, OldPortLevel>): Record<string, Asked> {
  return Object.fromEntries(Object.entries(old).filter(([, o]) => o?.asked).map(([port, o]) => [port, o.askedPart === undefined ? { kind: o.asked! } : { kind: o.asked!, part: o.askedPart }]));
}

/**
 * The drills used to keep their own level for each port. Turns those levels into the port's Review cards once (only
 * where a card is weaker than the old level), then drops them, with the record of which sets were practiced. It lives
 * here rather than in PortLinks so the Progress page can run it without loading the firewall rules.
 */
export function adoptOldLevels(progress: ProgressService) {
  const slug = 'ports-trainer';
  const old = progress.lessonWork(slug, 'mastery') as Record<string, OldPortLevel> | null | undefined;
  if (!old || typeof old !== 'object') return;
  const cards = progress.data().cards;
  progress.saveCards('ref', cardsFromOldLevels(old, id => cards[cardKey('ref', id)], Date.now()));
  const asked = (progress.lessonWork(slug, 'asked') as Record<string, Asked> | undefined) ?? {};
  progress.setLessonWorks(slug, { mastery: null, practiced: null, asked: { ...askedFromOldLevels(old), ...asked } });
}
