/**
 * What ties the three places a port is practiced to each other, so an answer in one counts in the others:
 * - the drills and Review mode, which share the port's two Reference deck cards ("SSH: which port, and TCP or
 *   UDP?"), and its level comes from those (port-memory.ts);
 * - the firewall rules of the random tables, each with its own spaced repetition card (see firewall-memory.ts).
 *
 * How much an answer counts elsewhere depends on how much of the thing it tested:
 * - A full answer gave the protocol and the port for exactly that rule or card. It is a review everywhere.
 * - A partial answer gave only the number, or belongs to a port that splits into several rules (DHCP's 67 and 68,
 *   DNS over UDP and over TCP). Right, it only starts a rule that was new, so tables stop treating it as new: it
 *   never moves a schedule forward. Wrong, it sends the rules back like any miss.
 */

import { SrsCard, schedule } from '../../utils/srs';
import { PORTS } from '../reference/reference-data';
import { FACTS, RuleMemory, factOf, factPort, factProto } from './firewall-generator';
import { trainerEntry } from './firewall-scenarios';
import { memoryKey } from './rule-cards';

export type Evidence = 'full' | 'partial';

/** The trainer port a fact is about, or undefined for ICMP, ESP and AH, which have none. */
export const entryOfFact = (fact: string): string | undefined => trainerEntry(factPort(fact));
/** The firewall rules about a trainer port. */
export const factsOfEntry = (port: string): string[] => FACTS.filter(fact => entryOfFact(fact) === port);
/** The different protocol and port answers a trainer port's rules have: one for most, two or three where it splits. */
const answerOf = (fact: string) => `${factProto(fact)} ${factPort(fact)}`;
export const answersOf = (port: string): string[] => [...new Set(factsOfEntry(port).map(answerOf))];

/** The Review card that asks for a trainer port's number and transport. */
export const reviewCardOf = (port: string): string | undefined => {
  const entry = PORTS.find(p => p.port === port);
  return entry && `proto:${entry.protocol}`;
};

/** The trainer port a Reference deck card is about, and whether the card asks for the number (as tables do) or the name. */
export function entryOfCard(cardId: string): { port: string; asksNumber: boolean } | null {
  if (cardId.startsWith('port:')) {
    const port = cardId.slice(5);
    return PORTS.some(p => p.port === port) ? { port, asksNumber: false } : null;
  }
  if (cardId.startsWith('proto:')) {
    const entry = PORTS.find(p => p.protocol === cardId.slice(6));
    return entry ? { port: entry.port, asksNumber: true } : null;
  }
  return null;
}

/** One rule's card after an answer given somewhere other than a table. */
export function creditRule(card: SrsCard | undefined, right: boolean, evidence: Evidence, now: number, opts: { retention?: number; id?: string } = {}): SrsCard {
  if (!right) return schedule(card, 'again', now, opts);
  if (!card) return schedule(undefined, 'good', now, opts);
  // Only a full answer is a review, and not while the rule is still waiting out a learning step.
  const waiting = card.state !== 'review' && card.due > now;
  if (evidence === 'partial' || waiting) return { ...card, right: card.right + 1, at: now };
  return schedule(card, 'good', now, opts);
}

/**
 * The rule cards changed by an answer about a trainer port given in a drill or in Review mode. `only` narrows it to
 * the rules on one of the port's numbers, when the question asked about that number alone (DHCP's client port, 68).
 */
export function creditRules(memory: RuleMemory, port: string, right: boolean, evidence: Evidence, now: number, retention?: number, only?: number): RuleMemory {
  const changed: RuleMemory = {};
  const facts = factsOfEntry(port).filter(fact => only === undefined || factPort(fact) === String(only));
  for (const fact of facts) changed[fact] = creditRule(memory[fact], right, evidence, now, { retention, id: memoryKey(fact) });
  return changed;
}

/**
 * What a checked table says about each trainer port in it, for the port's Review card. The card asks for every
 * number and transport the port has, so the answer is full only when the table's rules covered all of them.
 */
export function tableCredits(flows: string[], right: boolean[]): { port: string; right: boolean; full: boolean }[] {
  const asked = new Map<string, { right: boolean; answers: Set<string> }>();
  flows.forEach((id, i) => {
    const fact = factOf(id);
    const port = entryOfFact(fact);
    if (!port) return;
    const seen = asked.get(port) ?? { right: true, answers: new Set<string>() };
    seen.right &&= !!right[i];
    seen.answers.add(answerOf(fact));
    asked.set(port, seen);
  });
  return [...asked].map(([port, seen]) => ({ port, right: seen.right, full: seen.right && seen.answers.size === answersOf(port).length }));
}

/**
 * A Review mode answer on one of the Reference deck's port cards, carried over to the port's firewall rules when the
 * card asks for the number. (The port's level needs nothing: it is read from the card itself.) Returns the rules
 * that changed, or null for a card that is not about a port.
 */
export function creditReview(memory: RuleMemory, cardId: string, right: boolean, now: number, retention?: number): RuleMemory | null {
  const entry = entryOfCard(cardId);
  if (!entry) return null;
  const evidence: Evidence = answersOf(entry.port).length <= 1 ? 'full' : 'partial';
  return entry.asksNumber ? creditRules(memory, entry.port, right, evidence, now, retention) : {};
}
