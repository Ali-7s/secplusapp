export type QuestionType =
  | 'MULTIPLE_CHOICE' | 'MULTI_SELECT' | 'SCENARIO' | 'DRAG_DROP' | 'ORDER_LIST'
  | 'FIREWALL_RULES' | 'NETWORK_PLACEMENT' | 'LOG_ANALYSIS' | 'CONFIG_FORM';

export interface PairItem {
  id: string;
  label: string;
}

export interface ConfigField {
  group?: string;      // optional section header, e.g. "Gateway A — Phase 1"
  label: string;       // e.g. "Encryption algorithm" or "SRV-02"
  options: string[];
  correct?: string;
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

  // PBQ: Log / attack identification (LOG_ANALYSIS) — log block above standard options
  logText?: string;

  // PBQ: Firewall ruleset (FIREWALL_RULES)
  firewallColumns?: string[];
  firewallOptions?: Record<string, string[]>;
  correctRules?: Record<string, string>[];

  // PBQ: Configuration form (CONFIG_FORM) — VPN config, host classification, zone placement
  configFields?: ConfigField[];
}

export interface ExamSubmission {
  sectionId?: string;
  domainId?: string;
  examType: 'SECTION' | 'DOMAIN' | 'FULL';
  answers: QuestionAnswer[];
  timeTakenSeconds: number;
}

export interface QuestionAnswer {
  questionId: string;
  selectedAnswer?: string;
  selectedAnswers?: string[];
  // PBQ answers
  pairAnswers?: Record<string, string>;        // DRAG_DROP / NETWORK_PLACEMENT
  orderAnswer?: string[];                       // ORDER_LIST
  firewallAnswer?: Record<string, string>[];    // FIREWALL_RULES
  configAnswer?: string[];                      // CONFIG_FORM (per field, by index)
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
