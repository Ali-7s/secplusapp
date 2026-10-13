export interface AcronymDetail {
  practicalScenario: string;
  quizQuestion: string;
  quizOptions: string[];
  quizAnswer: string;
  /** Why the best answer is best and what makes the closest wrong answers wrong. Shown after the learner answers. */
  explanation?: string;
}

export interface VariantItem {
  name: string;
  detail: string;
}

/** A "types & key differences" breakdown shown on cards that cover a family of sub-types (e.g. RAID levels). */
export interface VariantGroup {
  title: string;
  items: VariantItem[];
}

export interface Acronym {
  acronym: string;
  expansion: string;
  definition: string;
  category: string;
  examContext: string;
  relatedAcronyms: string;
  detail: AcronymDetail;
  variants?: VariantGroup[];
}

export type TermDetail = AcronymDetail;

export interface Term {
  term: string;
  definition: string;
  category: string;
  examContext: string;
  analogy: string;
  relatedTerms: string;
  detail: TermDetail;
  variants?: VariantGroup[];
}

/** Flattens a card's variant groups into one lowercase string so search can match sub-type names and descriptions. */
export function variantsSearchText(item: { variants?: VariantGroup[] }): string {
  return (item.variants ?? [])
    .map(g => g.title + ' ' + g.items.map(i => i.name + ' ' + i.detail).join(' '))
    .join(' ')
    .toLowerCase();
}
