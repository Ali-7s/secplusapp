import { Block, CalloutKind, CertCase, DecideOption, DecideStep, HuntRow, HuntTask, KeyTask, PbqQuestion, PolicyAttr, PolicyChallenge, PolicyRule, QuizQuestion } from '../networking.model';

/** Small builders so lesson files read like the lessons themselves. Text supports **bold** and `code`. */

/** Options for a part heading: what to remember from the part, and whether it can be skipped on a first read. */
export interface PartOptions { keep?: string; optional?: string; objective?: string }

export const h = (text: string, opts: PartOptions = {}): Block => ({ type: 'h', text, ...opts });
export const hSecure = (text: string, opts: PartOptions = {}): Block => ({ type: 'h', text, tone: 'secure', ...opts });
export const p = (md: string): Block => ({ type: 'p', md });
export const list = (...items: string[]): Block => ({ type: 'list', items });
export const steps = (...items: string[]): Block => ({ type: 'list', items, ordered: true });

const callout = (kind: CalloutKind, title: string) => (md: string, customTitle?: string): Block =>
  ({ type: 'callout', kind, title: customTitle ?? title, md });

export const analogy = callout('analogy', 'Think of it like this');
export const exam = callout('exam', 'On the exam');
export const tip = callout('tip', 'Tip');
export const trap = callout('trap', 'Common trap');
export const secure = callout('secure', 'How to secure it');

/** The lesson's new vocabulary up front, in plain English, so nothing is used before it is explained. */
export const words = (...rows: [string, string][]): Block =>
  ({ type: 'table', columns: ['Word', 'What it means'], rows, words: true, caption: 'New words in this lesson. Look one up when it trips you up; there is no need to learn the list.' });

/** A hands-on PBQ written for the lesson. For firewall tables, `given` rows are filled in as a worked example. */
export const pbq = (title: string, question: PbqQuestion, opts: { intro?: string; given?: number } = {}): Block =>
  ({ type: 'pbq', title, question, intro: opts.intro, given: opts.given });

/** The practice exam's PBQs tagged with this lesson, offered at the end of it. */
export const examPbqs = (lesson: string, intro?: string): Block =>
  ({ type: 'pbqs', title: 'Exam-level PBQs on this lesson', lesson, intro: intro ?? 'These come from the practice exam and are as hard as the real thing. Expect to get parts wrong at first: the explanations are where you learn. They load when you press Start.' });

/** A short reminder of what this lesson builds on. */
export const recap = (md: string): Block => tip(md, 'From earlier lessons');

export const table = (columns: string[], rows: string[][], opts: { caption?: string; mono?: number[] } = {}): Block =>
  ({ type: 'table', columns, rows, caption: opts.caption, mono: opts.mono });

/** Small deterministic PRNG so shuffled answers are the same on every load. */
function seededRandom(text: string): () => number {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a multiple-choice question. Pass the correct answer and the three wrong ones; the options are
 * shuffled deterministically (seeded by the question) so the right answer is not always in the same slot.
 * Wrong options must not refer to each other ("all of the above" and the like), because they get reordered.
 */
export function mcq(question: string, correct: string, wrong: [string, string, string], explanation: string): QuizQuestion {
  const random = seededRandom(question);
  const options = [correct, ...wrong];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { question, options, answer: options.indexOf(correct), explanation };
}

/** Shuffles a copy of a list the same way on every load, seeded by some text. */
function seededShuffle<T>(items: T[], seed: string): T[] {
  const random = seededRandom(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The hash lab: change a character and watch the hash (`digest`), or watch a salt at work (`salt`). */
export const hashLab = (show: 'digest' | 'salt'): Block => ({ type: 'hashlab', show });

/** A "which key?" exercise with Alice's and Bob's key pairs. */
export const keys = (title: string, tasks: KeyTask[], intro?: string): Block => ({ type: 'keys', title, intro, tasks });

/** Certificate chains to judge, each with one verdict from `options`. */
export const certs = (title: string, options: string[], cases: CertCase[], intro?: string): Block =>
  ({ type: 'certs', title, intro, options, cases });

/** The malware investigation lab: `spread` (six machines) or `hidden` (five that hide). */
export const malwareLab = (round: 'spread' | 'hidden' | 'dns'): Block => ({ type: 'mlab', round });

/** The outbreak simulator: six samples, seven defences, a challenge each. */
export const outbreak = (): Block => ({ type: 'outbreak' });

/** The attack labs: simulations you play as attacker, then defender. */
export const lab = (kind: 'ddos' | 'onpath' | 'replay' | 'privesc' | 'csrf' | 'ssrf' | 'traversal'): Block => ({ type: kind });

/** One step of a scenario. List the best option first; the options are shuffled the same way on every load. */
export const step = (s: Omit<DecideStep, 'options'>, best: Omit<DecideOption, 'best'>, ...others: Omit<DecideOption, 'best'>[]): DecideStep =>
  ({ ...s, options: seededShuffle([{ ...best, best: true }, ...others], s.question + s.situation) });

/** A scenario told one decision at a time. */
export const decide = (title: string, steps: DecideStep[], intro?: string): Block => ({ type: 'decide', title, intro, steps });

/** The risk calculator: SLE and ALE (`ale`) or availability (`availability`). */
export const riskCalc = (show: 'ale' | 'availability'): Block => ({ type: 'riskcalc', show });

/** An access policy playground with challenges to solve. */
export const policy = (title: string, attributes: PolicyAttr[], rules: PolicyRule[], challenges: PolicyChallenge[], intro?: string): Block =>
  ({ type: 'policy', title, intro, attributes, rules, challenges });

/** The backup week simulator. */
export const backupWeek = (): Block => ({ type: 'backups' });

/** An evidence hunt through SIEM events or a packet capture. */
export const hunt = (title: string, look: 'siem' | 'pcap', columns: string[], rows: HuntRow[], tasks: HuntTask[], intro?: string): Block =>
  ({ type: 'hunt', title, intro, look, columns, rows, tasks });

/** The password policy builder. */
export const passwordPolicy = (): Block => ({ type: 'pwpolicy' });

/** The Linux permissions lab. */
export const permsLab = (): Block => ({ type: 'perms' });

/** The MDM policy console. */
export const mdmConsole = (): Block => ({ type: 'mdm' });

/** Sort controls by category and type. */
export const controlSorter = (set: 'basic' | 'tricky' = 'basic'): Block => set === 'tricky' ? { type: 'controls', set } : { type: 'controls' };

/** Which of confidentiality, integrity and availability each attack breaks (`attacks`) or each control protects (`controls`). */
export const ciaSorter = (show: 'attacks' | 'controls'): Block => ({ type: 'cia', show });

/** Inspect four messages for phishing warning signs. */
export const emailInspector = (): Block => ({ type: 'email' });

/** Score five vulnerabilities with CVSS 3.1. */
export const cvssCalc = (): Block => ({ type: 'cvss' });

/** The network lab: six scenarios to build and test. */
export const networkLab = (): Block => ({ type: 'netlab' });

/** The packet capture lab: five captures to filter, open and explain. */
export const captureLab = (): Block => ({ type: 'capture' });
