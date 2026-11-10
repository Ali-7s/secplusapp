/**
 * What the learner remembers of each firewall rule. Random tables are scheduled by spaced repetition: a rule answered
 * in a checked table is rated like a Review card (right is Good, wrong is Again) and FSRS-6 decides when it is due
 * next. Missed rules come back within minutes, learned ones after days that grow each time.
 *
 * firewall-generator.ts reads this memory to choose the next table's rules.
 */

import { SrsCard, dayKey, formatDelay, schedule } from '../../utils/srs';
import { FACTS, FLOWS, RuleMemory, factLabel, factOf, factPort, setOfFact } from './firewall-generator';
import { MIXED } from './firewall-scenarios';
import { isRuleCard, memoryKey } from './rule-cards';

export { memoryKey };

/** Reads every saved card through `read`, which looks a key up in the saved lesson work. */
export function loadMemory(read: (key: string) => unknown): RuleMemory {
  const memory: RuleMemory = {};
  for (const fact of FACTS) {
    const card = read(memoryKey(fact));
    if (isRuleCard(card)) memory[fact] = card;
  }
  return memory;
}

/**
 * The cards changed by a checked table. `right` says, rule by rule, whether the protocol and the port were both right:
 * that is the fact being learned, so a slip in the source, destination or action does not count against it.
 */
export function rateTable(memory: RuleMemory, flows: string[], right: boolean[], now: number, retention?: number): RuleMemory {
  const changed: RuleMemory = {};
  flows.forEach((id, i) => {
    const fact = factOf(id);
    if (!FACTS.includes(fact)) return;
    changed[fact] = schedule(memory[fact], right[i] ? 'good' : 'again', now, { retention, id: memoryKey(fact) });
  });
  return changed;
}

/** The facts a table for this set draws on first: the set's own, or all of them for a mixed table. */
export const factsIn = (set: string) => FACTS.filter(fact => set === MIXED || setOfFact(fact) === set);

export interface RuleCounts {
  total: number;
  /** Rules whose review time has come. */
  due: number;
  /** Rules never asked yet. */
  fresh: number;
  /** Rules past their learning steps. */
  learned: number;
  /** When the next rule falls due (ms), if none is due now. */
  next: number | null;
}

export function ruleCounts(memory: RuleMemory, facts: string[], now: number): RuleCounts {
  const cards = facts.map(fact => memory[fact]).filter((c): c is SrsCard => !!c);
  const waiting = cards.filter(c => c.due > now).map(c => c.due);
  const due = cards.length - waiting.length;
  return {
    total: facts.length, due, fresh: facts.length - cards.length, learned: cards.filter(c => c.state === 'review').length,
    next: !due && waiting.length ? Math.min(...waiting) : null,
  };
}

/** New rules that may still be introduced today, given the daily limit. */
export function newRulesLeft(memory: RuleMemory, perDay: number, now: number): number {
  const today = dayKey(now);
  const introduced = Object.values(memory).filter(c => c.first !== undefined && dayKey(c.first) === today).length;
  return Math.max(0, perDay - introduced);
}

/** When each rule of a table comes back, soonest first, for the line under a checked table. */
export function comesBack(memory: RuleMemory, flows: string[], now: number): { label: string; when: string; soon: boolean }[] {
  return [...new Set(flows.map(factOf))]
    .filter(fact => memory[fact])
    .sort((a, b) => memory[a].due - memory[b].due)
    .map(fact => {
      const wait = memory[fact].due - now;
      return { label: factLabel(fact), when: wait <= 0 ? 'now' : formatDelay(wait), soon: memory[fact].state !== 'review' };
    });
}

/** How tables kept score before each rule had a memory: by table count, with no times. */
export interface OldRuleHistory { rules?: Record<string, { ok: boolean; at: number }> }

/**
 * Starts the memory from the older table history, once. A rule missed the last time it was asked starts as missed and
 * one answered right as answered right once, both dated when its port was last practiced (`practicedAt`), because the
 * old history kept no times. Either way the rule is due straight away and its next answer sets the real schedule.
 */
export function memoryFromHistory(history: OldRuleHistory, practicedAt: (port: string) => number | undefined, now: number, retention?: number): RuleMemory {
  const latest = new Map<string, { ok: boolean; at: number }>();
  for (const [id, stat] of Object.entries(history.rules ?? {})) {
    if (!FLOWS.some(f => f.id === id) || !stat || typeof stat.at !== 'number') continue;
    const fact = factOf(id);
    const seen = latest.get(fact);
    if (!seen || stat.at > seen.at) latest.set(fact, stat);
  }
  const memory: RuleMemory = {};
  for (const [fact, stat] of latest) {
    const at = Math.min(now, practicedAt(factPort(fact)) ?? now);
    memory[fact] = schedule(undefined, stat.ok ? 'good' : 'again', at, { retention, id: memoryKey(fact) });
  }
  return memory;
}
