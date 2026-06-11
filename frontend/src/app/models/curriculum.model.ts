export interface Domain {
  id: string;
  number: string;
  name: string;
  description: string;
  examWeight: number;
  sections: Section[];
  icon: string;
  color: string;
}

export interface Section {
  id: string;
  domainId: string;
  objectiveNumber: string;
  name: string;
  description: string;
  keyTopics: string[];
  keyTerms: string[];
  order: number;
  passingScore: number;
}

export interface SectionProgress {
  sectionId: string;
  domainId: string;
  unlocked: boolean;
  examPassed: boolean;
  bestExamScore: number;
  examAttempts: number;
  flashcardsReviewed: number;
  practiceQuestionsAnswered: number;
  practiceQuestionsCorrect: number;
  labCompleted: boolean;
  conceptRead: boolean;
  lastExamAt: string | null;
}

export interface ProgressSummary {
  totalSections: number;
  sectionsPassed: number;
  sectionsUnlocked: number;
  overallProgress: number;
  totalQuestionsAnswered: number;
  totalCorrectAnswers: number;
  overallAccuracy: number;
  totalFlashcardsReviewed: number;
  domainProgress: DomainProgress[];
}

export interface DomainProgress {
  domainId: string;
  domainName: string;
  totalSections: number;
  sectionsPassed: number;
  progress: number;
  color: string;
}
