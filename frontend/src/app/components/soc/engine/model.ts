import { Ev, Source } from './events';
import { Rng } from './env';
import type { Pkt } from '../../networking/blocks/capture/packets';
import type { NetNode } from './net';

export type Verdict = 'tp' | 'benign' | 'fp';
export type ActionId = 'block' | 'isolate' | 'disable' | 'reset' | 'escalate' | 'tune' | 'close';
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export const VERDICTS: { id: Verdict; label: string; hint: string }[] = [
  { id: 'tp', label: 'True positive', hint: 'Malicious activity, correctly detected' },
  { id: 'benign', label: 'Benign true positive', hint: 'The activity really happened, but it is expected and authorised' },
  { id: 'fp', label: 'False positive', hint: 'The detection is wrong: what it claims did not happen' },
];

export const ACTIONS: { id: ActionId; label: string }[] = [
  { id: 'block', label: 'Block the address or domain at the firewall and proxy' },
  { id: 'isolate', label: 'Isolate the affected host(s) from the network' },
  { id: 'disable', label: 'Disable the account(s) involved' },
  { id: 'reset', label: 'Reset the user\'s password and end their sessions' },
  { id: 'escalate', label: 'Escalate to incident response' },
  { id: 'tune', label: 'Ask for the detection rule to be tuned' },
  { id: 'close', label: 'Close the alert: no response needed' },
];

export interface Question {
  id: string;
  ask: string;
  /** Accepted answers, compared without case or surrounding spaces. */
  answers: string[];
  /** Accept any answer that contains one of the answers. */
  contains?: boolean;
  hint: string;
}

export interface Alert {
  id: string;
  /** When it fires, seconds since midnight. */
  t: number;
  rule: string;
  severity: Severity;
  host: string;
  summary: string;
  entities: [string, string][];
  /** A starting search for the SIEM. */
  query: string;
  verdict: Verdict;
  need: ActionId[];
  /** Reasonable extra actions that are not required. */
  fine: ActionId[];
  questions: Question[];
  /** The debrief: what really happened. */
  why: string;
  /** Why particular actions were wrong here. */
  actionWhy: Partial<Record<ActionId, string>>;
}

export type Compare = 'exact' | 'set' | 'ranked' | 'tokens' | 'contains' | 'number';

export interface Task {
  id: string;
  /** Available from this moment (when the data it needs exists). */
  after: number;
  where: 'terminal' | 'siem';
  ask: string;
  hint: string;
  /** The model answer: a command, a SIEM query, or (for script tasks) the script body. */
  ref: string;
  compare: Compare;
  /** For 'contains': text the output must include. */
  needle?: string;
  /** Strip key= prefixes before comparing, so "src=10.0.4.114" and "10.0.4.114" both count. */
  kv?: boolean;
  /** For SIEM tasks: the column whose order must match the model answer. */
  orderBy?: string;
  /** A script the analyst writes, run with each set of arguments. */
  script?: { path: string; tests: string[][] };
  learn: string;
}

export interface Shift {
  id: string;
  number: number;
  title: string;
  tagline: string;
  start: number;
  end: number;
  skills: string[];
  brief: string[];
  sources: Source[];
  busy: number;
  seed: number;
  incidents(r: Rng): Ev[];
  /** Hosts whose EDR sensor is not reporting this shift. */
  edrSilent?: string[];
  alerts: Alert[];
  tasks: Task[];
  intel: Record<string, string>;
  whois: Record<string, string>;
  /** Network details the network commands use: extra devices, a DNS fault, saved packet captures. */
  net?: ShiftNet;
  /** Extra company notes in ~/docs for this shift, by file name. */
  docs?: Record<string, string>;
  /** Rewrites a background event, for example a DNS answer once a fault has started. */
  adjust?: (e: Ev) => Ev;
}

export interface ShiftNet {
  /** Devices that exist only in this shift (a rogue device, say). */
  hosts?: NetNode[];
  /** From `from`, this DNS server answers SERVFAIL for every name outside the company's own zone. */
  dnsFault?: { server: string; from: number };
  /** Packet captures saved by a sensor: the file appears at `at`. */
  captures?: { path: string; at: number; build: () => Pkt[] }[];
}
