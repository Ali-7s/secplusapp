export interface AcronymDetail {
  practicalScenario: string;
  quizQuestion: string;
  quizOptions: string[];
  quizAnswer: string;
}

export interface Acronym {
  acronym: string;
  expansion: string;
  definition: string;
  category: string;
  examContext: string;
  relatedAcronyms: string;
  detail: AcronymDetail;
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
}
