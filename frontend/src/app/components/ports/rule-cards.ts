/**
 * How firewall rule memory is saved: one spaced repetition card per fact, each under its own key in the ports
 * trainer's lesson work, so devices merge rule by rule. This file knows nothing about the rules themselves, which
 * keeps it small enough for the Today page to count due rules without loading the whole trainer.
 */

import { SrsCard } from '../../utils/srs';

const PREFIX = 'fw:m:';
export const memoryKey = (fact: string) => `${PREFIX}${fact}`;

export const isRuleCard = (v: unknown): v is SrsCard => {
  const c = v as SrsCard | null | undefined;
  return !!c && typeof c === 'object' && typeof c.due === 'number' && typeof c.at === 'number'
    && (c.state === 'learning' || c.state === 'review' || c.state === 'relearning');
};

/** Rules due now and rules past their learning steps, counted straight from the trainer's saved work. */
export function savedRuleCounts(work: Record<string, { v: unknown }> | undefined, now: number): { due: number; learned: number } {
  const cards = Object.entries(work ?? {}).filter(([key]) => key.startsWith(PREFIX)).map(([, saved]) => saved.v).filter(isRuleCard);
  return { due: cards.filter(c => c.due <= now).length, learned: cards.filter(c => c.state === 'review').length };
}
