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

/** A device or address range in a network diagram. */
export interface NetHost {
  name: string;
  ip?: string;
  /** What it is or listens on, listed under the diagram ("SQL Server (TCP 1433)"). */
  role?: string;
  icon?: 'server' | 'pc' | 'device' | 'wifi' | 'printer' | 'phone' | 'camera' | 'threat';
}

/** A network segment behind the firewall, drawn as a shaded box holding its hosts. */
export interface NetZone {
  name: string;
  subnet?: string;
  role?: string;
  hosts: NetHost[];
}

/** A firewall PBQ's network: the firewall in the middle, the outside world as a cloud, and the zones around it. */
export interface NetDiagram {
  firewall: string;
  /** The untrusted side, drawn as a cloud ("Internet", "Site-to-site VPN"), with the outside parties named in the task. */
  outside?: { label: string; note?: string; hosts?: NetHost[] };
  zones: NetZone[];
  /** Facts that belong to no one box, listed under the diagram. */
  notes?: string[];
}

/**
 * A table in an exhibit. Without `columns` it is a list of settings, with the first cell of each row as the label.
 * A row with a single cell spans the table (an "... 250 more" line). `mono` lists the columns holding addresses,
 * ports and other values to set in code type.
 */
export interface ExhibitTable {
  title?: string;
  columns?: string[];
  rows: string[][];
  mono?: number[];
  /** A line under the table, such as the implicit deny at the end of a rule list. */
  note?: string;
}

/**
 * Text kept as text, styled as what it is: `log` lines with their timestamps, a `terminal` session, a `file`
 * (config or code), a `message` (email or HTTP headers and body) or a `document` excerpt.
 */
export interface ExhibitText {
  style: 'log' | 'terminal' | 'file' | 'message' | 'document';
  title?: string;
  text: string;
}

export type ExhibitBlock = ({ kind: 'table' } & ExhibitTable) | ({ kind: 'text' } & ExhibitText);

export type TopoIcon = 'cloud' | 'firewall' | 'router' | 'switch' | 'sensor' | 'server' | 'pc' | 'laptop' | 'wifi' | 'threat';

/** A network in a line from the internet inward, with networks hanging off some of the devices. */
export interface Topology {
  chain: TopoNode[];
}

export interface TopoNode {
  name: string;
  icon: TopoIcon;
  note?: string;
  branches?: TopoBranch[];
}

export interface TopoBranch {
  name: string;
  subnet?: string;
  note?: string;
  hosts?: { name: string; ip?: string; icon?: TopoIcon }[];
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
  /** A network drawn as a diagram, shown instead of the exhibit (firewall PBQs). The exhibit stays as a text fallback. */
  diagram?: NetDiagram;
  /** Any other network drawing, shown instead of the exhibit. The exhibit stays as a text fallback. */
  topology?: Topology;
  /** The exhibit as it would appear on screen: tables, logs, terminals, files, messages. Shown instead of the text. */
  blocks?: ExhibitBlock[];
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

/** Short names for the SY0-701 exam objectives, for progress and weak-spot lists. */
export const OBJECTIVE_NAMES: Record<string, string> = {
  '1.1': 'Security controls',
  '1.2': 'Fundamental security concepts',
  '1.3': 'Change management',
  '1.4': 'Cryptographic solutions',
  '2.1': 'Threat actors and motivations',
  '2.2': 'Threat vectors and attack surfaces',
  '2.3': 'Types of vulnerabilities',
  '2.4': 'Indicators of malicious activity',
  '2.5': 'Mitigation techniques',
  '3.1': 'Architecture models',
  '3.2': 'Securing enterprise infrastructure',
  '3.3': 'Protecting data',
  '3.4': 'Resilience and recovery',
  '4.1': 'Securing computing resources',
  '4.2': 'Asset management',
  '4.3': 'Vulnerability management',
  '4.4': 'Alerting and monitoring',
  '4.5': 'Enterprise security capabilities',
  '4.6': 'Identity and access management',
  '4.7': 'Automation and orchestration',
  '4.8': 'Incident response',
  '4.9': 'Data sources for investigations',
  '5.1': 'Security governance',
  '5.2': 'Risk management',
  '5.3': 'Third-party risk',
  '5.4': 'Security compliance',
  '5.5': 'Audits and assessments',
  '5.6': 'Security awareness',
};
