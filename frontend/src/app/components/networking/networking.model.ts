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

/** One of the four keys in a public-key exercise: each person has a public key and a private key. */
export type KeyName = 'alice-public' | 'alice-private' | 'bob-public' | 'bob-private';

export interface KeyTask {
  /** What Alice or Bob wants to achieve, e.g. "Alice sends Bob a message only Bob can read". */
  goal: string;
  /** The two actions to fill in, e.g. ["Encrypt with", "Decrypt with"] or ["Sign with", "Verify with"]. */
  verbs: [string, string];
  answer: [KeyName, KeyName];
  why: string;
}

/** A certificate as a browser sees it. `trusted` is set on a root that is (or is not) in the device's trust store. */
export interface CertInfo {
  role: string;
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  /** Other fields worth showing: names it covers, key usage, revocation status... */
  fields?: { name: string; value: string }[];
  trusted?: boolean;
}

/** One certificate check: the site being visited, the chain it sent, and what the browser should decide. */
export interface CertCase {
  name: string;
  /** The address typed in the browser. */
  site: string;
  today: string;
  /** Leaf first, then each issuer up to the root. */
  chain: CertInfo[];
  answer: string;
  why: string;
  /** The field that gives it away, highlighted after checking: the certificate's index in `chain` and the field name. */
  clue?: { cert: number; field: string };
}

export interface DecideOption {
  text: string;
  best?: boolean;
  feedback: string;
}

/** One moment in a scenario: what is happening, and what you would do next. */
export interface DecideStep {
  /** A label for the phase or stage, shown once the step is answered ("Containment"). */
  phase?: string;
  situation: string;
  question: string;
  /** Already in display order. */
  options: DecideOption[];
}

/** A value a request can have in the policy playground, such as Department: Finance, HR, Sales. */
export interface PolicyAttr {
  name: string;
  options: string[];
}

/** A policy statement: it matches when every listed attribute has one of the listed values. */
export interface PolicyRule {
  id: string;
  effect: 'Allow' | 'Deny';
  /** The statement as written, e.g. "Allow Finance to read Payroll". */
  text: string;
  when: Record<string, string[]>;
}

/** Something to make happen in the playground, e.g. a request allowed by rule R2. `by` is a rule id or "implicit". */
export interface PolicyChallenge {
  goal: string;
  effect: 'Allow' | 'Deny';
  by: string;
}

/** One line of evidence in a hunt: a log event or a captured packet. `detail` is shown when the row is opened. */
export interface HuntRow {
  id: string;
  cells: string[];
  /** Which log source the event came from, for the source filter (SIEM view only). */
  source?: string;
  detail?: string[];
}

/** Something to find: pin the row that shows it. Any id in `answer` is right; `hint` steers a wrong pick. */
export interface HuntTask {
  ask: string;
  answer: string[];
  why: string;
  hint: string;
}

export type Block =
  /**
   * A heading starts a new part of the lesson. `keep` is the one or two lines worth remembering from the part,
   * shown in a "Remember this" box at its end; `optional` marks a part that can be skipped on a first pass, and why.
   * `objective` is the SY0-701 objective the part teaches, such as "4.9", linked from the heading.
   */
  | { type: 'h'; text: string; tone?: 'secure'; keep?: string; optional?: string; objective?: string }
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
  | { type: 'pbqs'; title: string; intro?: string; lesson: string }
  /** The hash lab: type text and watch its hash change (`digest`), or see what a salt does to stored passwords (`salt`). */
  | { type: 'hashlab'; show: 'digest' | 'salt' }
  /** Pick which of Alice's and Bob's keys each step uses. */
  | { type: 'keys'; title: string; intro?: string; tasks: KeyTask[] }
  /** Look at certificate chains and decide whether the browser should trust each one. */
  | { type: 'certs'; title: string; intro?: string; options: string[]; cases: CertCase[] }
  /** Investigate infected machines with responder tools and name the malware. */
  | { type: 'mlab'; round: 'spread' | 'hidden' | 'dns' }
  /** Release malware into a small office with chosen defences and watch it hour by hour. */
  | { type: 'outbreak' }
  /** Attack labs, each a self-contained simulation with missions: a DDoS sandbox, ARP poisoning, credential replay,
   *  privilege escalation, CSRF, SSRF and directory traversal. */
  | { type: 'ddos' } | { type: 'onpath' } | { type: 'replay' } | { type: 'privesc' } | { type: 'csrf' } | { type: 'ssrf' } | { type: 'traversal' }
  /** A scenario told one decision at a time: pick what you would do, see why, then move on. */
  | { type: 'decide'; title: string; intro?: string; steps: DecideStep[] }
  /** Risk calculators: SLE and ALE with a control's yearly value (`ale`), or uptime from MTBF, SLAs and redundancy (`availability`). */
  | { type: 'riskcalc'; show: 'ale' | 'availability' }
  /** An access policy to experiment with: set the request, see which statements match and what decides. Deny overrides allow. */
  | { type: 'policy'; title: string; intro?: string; attributes: PolicyAttr[]; rules: PolicyRule[]; challenges: PolicyChallenge[] }
  /** A week of backups: pick full, incremental or differential and a failure day, see what has to be restored. */
  | { type: 'backups' }
  /** Search and filter a SIEM's events (`siem`) or a packet capture (`pcap`), and pin the evidence each task asks for. */
  | { type: 'hunt'; title: string; intro?: string; look: 'siem' | 'pcap'; columns: string[]; rows: HuntRow[]; tasks: HuntTask[] }
  /** Set a password and lockout policy and see which attacks it stops and which problems it causes. */
  | { type: 'pwpolicy' }
  /** Set Linux file permissions with checkboxes or numbers, and match the tasks. */
  | { type: 'perms' }
  /** Configure MDM policies for three device groups and see how they handle a week of incidents. */
  | { type: 'mdm' }
  /** Sort security controls by category and type. */
  | { type: 'controls'; set?: 'tricky' }
  /** Pick which of confidentiality, integrity and availability each attack breaks or each control protects. */
  | { type: 'cia'; show: 'attacks' | 'controls' }
  /** An inbox of messages to inspect for phishing warning signs. */
  | { type: 'email' }
  /** A CVSS 3.1 base score calculator with vulnerabilities to score. */
  | { type: 'cvss' }
  /** Build a network from a scenario: place devices, set VLANs and addresses, write rules, then run traffic. */
  | { type: 'netlab' }
  /** Read packet captures: filter them, open each packet layer by layer, and answer what happened. */
  | { type: 'capture' };

/** The PBQ kinds a lesson can embed (the practice exam's own types). */
export type PbqQuestion = FirewallQuestion | MatchQuestion | OrderQuestion;

/** Networking Basics, the guided path from zero, or the hands-on topics that follow it. */
export type TrackId = 'networking' | 'topics';

/** What the lesson list and the glossary cards need, without the lesson text itself. */
export interface LessonMeta {
  slug: string;
  track: TrackId;
  /** Position within its track, from 1. */
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
  /** The SY0-701 objectives the lesson's parts teach, in order. A test keeps it in step with the parts. */
  objectives: string[];
  /** Hands-on topics: which of the CIA goals the topic protects, and how, shown on its card and header. */
  cia?: { goals: CiaGoal[]; how: string };
}

/** Confidentiality, integrity and availability. */
export type CiaGoal = 'C' | 'I' | 'A';
export const CIA_GOALS: CiaGoal[] = ['C', 'I', 'A'];
export const CIA_NAME: Record<CiaGoal, string> = { C: 'Confidentiality', I: 'Integrity', A: 'Availability' };

export interface LessonBody {
  goals: string[];
  blocks: Block[];
  check: QuizQuestion[];
}

export interface Lesson extends LessonMeta, LessonBody {}
