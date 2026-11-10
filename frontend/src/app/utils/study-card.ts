/** The shape a flashcard has once it leaves its page: what Review and the deck code work with. */

import { Acronym, Term, VariantGroup } from '../models/glossary.model';
import { AnswerCheck } from './typed-answer';

/** A flashcard as Review and the flip deck see it, whatever page it comes from. */
export interface StudyCard {
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
  /** Marks an answer typed in Review mode. Reference deck cards with a short answer only (see typed-answer.ts). */
  check?: AnswerCheck;
  /** The id of this card's twin in the same deck (a port's "which protocol?" and "which port?" cards). Review mode never shows both on one day. */
  sibling?: string;
}

const splitRelated = (list: string): string[] =>
  (list ?? '').split(/[,;]/).map(s => s.trim()).filter(Boolean);

export function acronymToCard(a: Acronym): StudyCard {
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

export function termToCard(t: Term): StudyCard {
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
