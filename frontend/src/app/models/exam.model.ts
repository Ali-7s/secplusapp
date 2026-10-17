/**
 * Practice exam content (public/data/practice-exam.json).
 *
 * Every choice carries its own "why", so the review can explain the option the learner picked as well as the
 * right one. Option order is shuffled at run time, so explanations never refer to letters.
 */
export type ExamDomain = 1 | 2 | 3 | 4 | 5;

export interface ExamOption {
  text: string;
  correct?: boolean;
  why: string;
}

interface ExamQuestionBase {
  id: string;
  domain: ExamDomain;
  /** SY0-701 objective, such as "4.5". */
  objective: string;
  scenario?: string;
  stem: string;
  /** Monospace block shown above the answer area: logs, configs, command output, a network map. */
  exhibit?: string;
  /** The one-line lesson, shown after the per-option reasons. */
  takeaway: string;
  /** Slug of the Networking Basics lesson that teaches the background; such questions make up the networking drill. */
  lesson?: string;
}

export interface ChoiceQuestion extends ExamQuestionBase {
  kind: 'single' | 'multi';
  options: ExamOption[];
}

export interface FirewallRow {
  answer: Record<string, string>;
  why: string;
}

/** PBQ: fill in a rule table. Rules are evaluated top to bottom; row N implements requirement N. */
export interface FirewallQuestion extends ExamQuestionBase {
  kind: 'firewall';
  requirements: string[];
  columns: string[];
  choices: Record<string, string[]>;
  rows: FirewallRow[];
}

export interface MatchPrompt {
  label: string;
  /** Optional section heading shown above this prompt and the ones after it. */
  group?: string;
  /** Choices for this prompt only; otherwise the question's shared choices are used. */
  choices?: string[];
  answer: string;
  why: string;
}

/** PBQ: pick a value for each prompt (matching, placement, configuration forms, log classification). */
export interface MatchQuestion extends ExamQuestionBase {
  kind: 'match';
  choices?: string[];
  /** Prompts are log lines or requests: shown in monospace on their own line, with the choice underneath. */
  codeLabels?: boolean;
  prompts: MatchPrompt[];
}

export interface OrderItem {
  text: string;
  why: string;
}

/** PBQ: put the items in order. `items` is stored in the correct order and scrambled at run time. */
export interface OrderQuestion extends ExamQuestionBase {
  kind: 'order';
  items: OrderItem[];
}

export type ExamQuestion = ChoiceQuestion | FirewallQuestion | MatchQuestion | OrderQuestion;

export const DOMAIN_NAMES: Record<ExamDomain, string> = {
  1: 'General Security Concepts',
  2: 'Threats, Vulnerabilities and Mitigations',
  3: 'Security Architecture',
  4: 'Security Operations',
  5: 'Security Program Management and Oversight',
};

export function isPbq(q: ExamQuestion): boolean {
  return q.kind === 'firewall' || q.kind === 'match' || q.kind === 'order';
}
