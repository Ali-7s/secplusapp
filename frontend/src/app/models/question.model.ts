export type QuestionType = 'MULTIPLE_CHOICE' | 'MULTI_SELECT' | 'SCENARIO' | 'DRAG_DROP' | 'ORDER_LIST';

export interface PairItem {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  sectionId: string;
  domainId: string;
  type: QuestionType;
  scenario?: string;
  stem: string;
  options: string[];
  correctAnswer: string;
  correctAnswers?: string[];
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  points: number;
  selectedAnswer?: string;
  selectedAnswers?: string[];
  flagged?: boolean;

  // PBQ: Matching (DRAG_DROP)
  dragPairs?: PairItem[];
  dropTargets?: PairItem[];
  correctPairs?: Record<string, string>;

  // PBQ: Sequencing (ORDER_LIST)
  orderItems?: string[];
  correctOrder?: string[];
}

export interface ExamSubmission {
  sectionId?: string;
  examType: 'SECTION' | 'FULL';
  answers: QuestionAnswer[];
  timeTakenSeconds: number;
}

export interface QuestionAnswer {
  questionId: string;
  selectedAnswer?: string;
  selectedAnswers?: string[];
}

export interface ExamResult {
  sectionId: string;
  examType: string;
  totalQuestions: number;
  correctAnswers: number;
  scorePercent: number;
  passed: boolean;
  passingScore: number;
  timeTakenSeconds: number;
  results: QuestionResult[];
  domainBreakdown: Record<string, number>;
  feedback: string;
  nextSteps: string;
}

export interface QuestionResult {
  questionId: string;
  stem: string;
  selectedAnswer: string;
  correctAnswer: string;
  correct: boolean;
  explanation: string;
  difficulty: string;
}
