/**
 * Types for the Networking Basics lessons.
 *
 * A lesson is a list of content blocks followed by a short self-check. Blocks are plain data so the
 * lesson text can be edited without touching any component code.
 */
import { FirewallQuestion, MatchQuestion, OrderQuestion } from '../../models/exam.model';

/** A glossary card a lesson points to ("see the flashcard for this"). */
export interface CardRef {
  kind: 'acr' | 'term';
  name: string;
}

export interface QuizQuestion {
  question: string;
  /** Four options, already in display order. */
  options: string[];
  /** Index of the correct option. */
  answer: number;
  explanation: string;
}

export type CalloutKind = 'analogy' | 'exam' | 'secure' | 'tip' | 'trap';

export interface SequenceField {
  name: string;
  value: string;
  /** Highlight a value that changed compared with the previous snapshot. */
  changed?: boolean;
}

export interface SequenceSnapshot {
  label: string;
  fields: SequenceField[];
}

export interface SequenceStep {
  from: string;
  to: string;
  /** Short label drawn on the arrow, e.g. "DHCP Discover (broadcast)". */
  label: string;
  /** Explanation of the step (supports **bold** and `code`). */
  note: string;
  /** Header values at this point, e.g. the MAC/IP/port fields of a packet. */
  snapshots?: SequenceSnapshot[];
  /** A small table of state after this step, e.g. a switch's MAC address table. */
  table?: { title: string; columns: string[]; rows: string[][] };
}

export interface HardenItem {
  action: string;
  why: string;
  example?: string;
}

export interface SpotLine {
  text: string;
  /** Present when this line is a weakness. */
  issue?: { why: string; fix: string };
  /** Present on good lines, to say why they are fine. */
  fine?: string;
}

export type FlowTone = 'neutral' | 'accent' | 'safe' | 'warn' | 'danger';

export interface FlowNode {
  label: string;
  sub?: string;
  tone?: FlowTone;
}

export interface PortCell {
  label: string;
  /** Matches an entry of the legend. */
  group: string;
}

export type PortTone = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'gray';

export interface PortLegend {
  group: string;
  label: string;
  tone?: PortTone;
}

export interface NestedLayer {
  label: string;
  note?: string;
}

export type Block =
  /**
   * A heading starts a new part of the lesson. `keep` is the one or two lines worth remembering from the part,
   * shown in a "Remember this" box at its end; `optional` marks a part that can be skipped on a first pass, and why.
   */
  | { type: 'h'; text: string; tone?: 'secure'; keep?: string; optional?: string }
  | { type: 'p'; md: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'callout'; kind: CalloutKind; title?: string; md: string }
  /** `words` marks the lesson's vocabulary table, shown folded away so it reads as a lookup, not a list to learn. */
  | { type: 'table'; caption?: string; columns: string[]; rows: string[][]; mono?: number[]; words?: boolean }
  | { type: 'flow'; caption?: string; direction?: 'down' | 'right'; nodes: FlowNode[] }
  | { type: 'ports'; caption?: string; cells: PortCell[]; legend: PortLegend[] }
  | { type: 'nested'; caption?: string; layers: NestedLayer[] }
  | { type: 'sequence'; title: string; intro?: string; steps: SequenceStep[] }
  | { type: 'layers' }
  | { type: 'cidr' }
  | { type: 'cta'; to: string; query?: Record<string, string>; label: string; icon: string; note?: string }
  | { type: 'harden'; title: string; intro?: string; items: HardenItem[] }
  | { type: 'spot'; title: string; intro: string; lines: SpotLine[] }
  /** A guided PBQ written for this lesson. `given` pre-fills (and locks) that many firewall rows as a worked example. */
  | { type: 'pbq'; title: string; intro?: string; question: PbqQuestion; given?: number }
  /** The practice exam's PBQs tagged with this lesson, one at a time. */
  | { type: 'pbqs'; title: string; intro?: string; lesson: string };

/** The PBQ kinds a lesson can embed (the practice exam's own types). */
export type PbqQuestion = FirewallQuestion | MatchQuestion | OrderQuestion;

/** What the lesson list and the glossary cards need, without the lesson text itself. */
export interface LessonMeta {
  slug: string;
  number: number;
  title: string;
  summary: string;
  /** Estimated time for the lesson's core parts and self-check, checked against the content by a test. */
  minutes: number;
  /** Extra time for parts marked optional, when there are any. */
  optionalMinutes?: number;
  icon: string;
  /** Flashcards that go with the lesson. The first `focus` of them are what the lesson is mainly about. */
  related: CardRef[];
  focus: number;
}

export interface LessonBody {
  goals: string[];
  blocks: Block[];
  check: QuizQuestion[];
}

export interface Lesson extends LessonMeta, LessonBody {}
