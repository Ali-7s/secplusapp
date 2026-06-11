export interface Flashcard {
  id: string;
  sectionId: string;
  front: string;
  back: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  mnemonic: string;
  examTip: string;
}

export interface ConceptExplanation {
  sectionId: string;
  title: string;
  overview: string;
  detailedExplanation: string;
  keyPoints: string[];
  realWorldExamples: string[];
  examTips: string[];
  commonMistakes: string[];
  analogyExplanation: string;
  relatedTopics: string[];
}

export interface Lab {
  id: string;
  sectionId: string;
  title: string;
  objective: string;
  scenario: string;
  background: string;
  steps: LabStep[];
  tools: string[];
  difficulty: string;
  estimatedMinutes: number;
  questions: LabQuestion[];
  walkthrough: string;
}

export interface LabStep {
  stepNumber: number;
  title: string;
  instruction: string;
  command: string;
  expectedOutput: string;
  hint: string;
}

export interface LabQuestion {
  question: string;
  answer: string;
  explanation: string;
}

export interface Acronym {
  acronym: string;
  expansion: string;
  definition: string;
  category: string;
  examContext: string;
  relatedAcronyms: string;
}
