/**
 * Marking: terminal output against the model answer, SIEM results against the model search, scripts run against
 * test arguments, and tickets against what really happened.
 */

import { ActionId, Alert, Question, Task, Verdict } from './model';
import { SiemResult, SiemRange, runSiem } from './siem';
import { lines } from './text';
import { World, shellFor } from './world';

const norm = (l: string, kv: boolean) => {
  let s = l.trim().replace(/\s+/g, ' ');
  if (kv) s = s.replace(/(^|\s)[A-Za-z_]\w*=/g, '$1');
  return s;
};
const normAll = (text: string, kv: boolean) => lines(text).map(l => norm(l, kv)).filter(Boolean);
/** A line with its words in a fixed order, so "400 1.2.3.4" and "1.2.3.4 400" count as the same. */
const bag = (l: string) => l.split(' ').sort().join(' ');
const firstNum = (l: string) => { const m = /(^|\s)(-?\d+(?:\.\d+)?)(?=\s|$)/.exec(l); return m ? Number(m[2]) : NaN; };

export function compareOutput(user: string, ref: string, task: Pick<Task, 'compare' | 'needle' | 'kv'>): boolean {
  const kv = !!task.kv;
  switch (task.compare) {
    case 'contains': return !!task.needle && user.includes(task.needle);
    case 'number': {
      const a = /-?\d+(?:\.\d+)?/.exec(user);
      const b = /-?\d+(?:\.\d+)?/.exec(ref);
      return !!a && !!b && Math.abs(Number(a[0]) - Number(b[0])) < 0.006;
    }
    case 'tokens': {
      const a = user.split(/\s+/).filter(Boolean).sort();
      const b = ref.split(/\s+/).filter(Boolean).sort();
      return a.length > 0 && a.join(' ') === b.join(' ');
    }
  }
  const u = normAll(user, kv);
  const r = normAll(ref, kv);
  if (!u.length || u.length !== r.length) return false;
  if (task.compare === 'exact') return u.every((l, i) => l === r[i]);
  const su = u.map(bag).sort();
  const sr = r.map(bag).sort();
  if (!su.every((l, i) => l === sr[i])) return false;
  if (task.compare === 'ranked') {
    const nums = u.map(firstNum);
    return nums.every((n, i) => !isNaN(n) && (i === 0 || n <= nums[i - 1]));
  }
  return true;
}

/** The cells of a SIEM result as rows of values, for comparing two results. */
function cells(res: SiemResult): string[][] {
  if (res.kind === 'events') return res.events.map(e => [e.raw]);
  return res.rows.map(r => res.cols.map(c => r[c] ?? ''));
}

export function compareSiem(user: SiemResult, ref: SiemResult, task: Pick<Task, 'orderBy'>): boolean {
  const u = cells(user);
  const r = cells(ref);
  if (!u.length || u.length !== r.length) return false;
  // Every model row must be found in a different user row (extra columns in the user's are fine).
  const used = new Set<number>();
  const contains = (row: string[], want: string[]) => {
    const pool = [...row];
    return want.every(v => { const i = pool.indexOf(v); if (i < 0) return false; pool.splice(i, 1); return true; });
  };
  for (const want of r) {
    const i = u.findIndex((row, k) => !used.has(k) && contains(row, want));
    if (i < 0) return false;
    used.add(i);
  }
  if (task.orderBy && ref.kind !== 'events') {
    const col = ref.cols.indexOf(task.orderBy);
    if (col >= 0) return r.every((row, i) => u[i].includes(row[col]));
  }
  return true;
}

export interface CheckResult { ok: boolean; detail?: string }

const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** Runs the analyst's script with each test's arguments and compares it with the model script. */
export function checkScript(world: World, task: Task): CheckResult {
  const s = task.script!;
  if (!world.vfs.isFile(s.path)) return { ok: false, detail: `There is no file ${s.path.replace('/home/analyst', '~')} yet. Create it with: nano ${s.path.replace('/home/analyst', '~')}` };
  for (const args of s.tests) {
    const mine = shellFor(world).run(`bash ${s.path} ${args.map(quote).join(' ')}`);
    const model = shellFor(world).runWith(task.ref, args);
    if (!compareOutput(mine.out, model.out, task)) {
      const shown = (t: string) => (t.trim() ? lines(t).slice(0, 6).join('\n') + (lines(t).length > 6 ? '\n...' : '') : '(nothing)');
      return {
        ok: false,
        detail: `With ${args.join(' ')} your script printed:\n${shown(mine.out)}${mine.err ? `\nerrors:\n${shown(mine.err)}` : ''}\nExpected:\n${shown(model.out)}`,
      };
    }
  }
  return { ok: true };
}

/** Did this command's output answer the task? */
export function checkTerminal(world: World, task: Task, output: string): boolean {
  if (task.script || !output.trim()) return false;
  const model = shellFor(world).run(task.ref);
  return compareOutput(output, model.out, task);
}

export function checkSiem(world: World, task: Task, result: SiemResult, range: SiemRange): boolean {
  let model: SiemResult;
  try { model = runSiem(task.ref, world.events, range); } catch { return false; }
  return compareSiem(result, model, task);
}

// ── Tickets ───────────────────────────────────────────────────────────────

export interface Ticket {
  verdict?: Verdict;
  actions: ActionId[];
  answers: Record<string, string>;
  notes: string;
  submitted?: boolean;
}

export const emptyTicket = (): Ticket => ({ actions: [], answers: {}, notes: '' });

export function answerOk(q: Question, input: string | undefined): boolean {
  const a = (input ?? '').trim().toLowerCase().replace(/[.!]+$/, '').replace(/\s+/g, ' ');
  if (!a) return false;
  return q.answers.some(x => {
    const want = x.toLowerCase();
    return q.contains ? a.includes(want) : a === want || a.replace(/^the /, '') === want;
  });
}

export interface TicketMark {
  verdict: boolean;
  missing: ActionId[];
  wrong: ActionId[];
  answers: Record<string, boolean>;
  points: number;
  max: number;
}

export function markTicket(alert: Alert, t: Ticket): TicketMark {
  const verdict = t.verdict === alert.verdict;
  const missing = alert.need.filter(a => !t.actions.includes(a));
  const wrong = t.actions.filter(a => !alert.need.includes(a) && !alert.fine.includes(a));
  const answers = Object.fromEntries(alert.questions.map(q => [q.id, answerOk(q, t.answers[q.id])]));
  const actionPts = !t.actions.length ? 0 : !missing.length && !wrong.length ? 2 : missing.length + wrong.length === 1 ? 1 : 0;
  const points = (verdict ? 2 : 0) + actionPts + Object.values(answers).filter(Boolean).length;
  return { verdict, missing, wrong, answers, points, max: 4 + alert.questions.length };
}

export interface TaskState { done?: boolean; revealed?: boolean }

export const taskPoints = (s: TaskState | undefined) => (s?.done ? (s.revealed ? 1 : 2) : 0);
