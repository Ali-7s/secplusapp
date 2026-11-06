/**
 * A bash-like shell for the analyst workstation. It parses real shell syntax (quotes, variables, $(...), $((...)),
 * globs, pipes, redirections, && and ||, for/while/until/if, functions) and runs the commands in commands.ts against
 * the lab's file system. Commands work on whole strings rather than streams, which is plenty for log analysis.
 */

import type { Net } from './net';
import { HOME, Vfs } from './vfs';
import { globRegex, lines } from './text';
import { COMMANDS, CmdCtx } from './commands';

// ── Lexer ─────────────────────────────────────────────────────────────────

/** Part of a word: q=0 unquoted, 1 single-quoted (literal), 2 double-quoted. */
export interface Part { q: 0 | 1 | 2; s: string }
export interface Word { parts: Part[] }
type Tok = { t: 'w'; w: Word; raw: string } | { t: 'op'; v: string };

export class ShellSyntaxError extends Error {}

const OPS = ['&&', '||', ';;', '>>', '2>&1', '2>>', '2>', '&>', '|', ';', '&', '>', '<', '(', ')', '\n'];

/** Reads a balanced $( ... ), ${ ... } or backquote run starting at i; returns the index after it. */
function skipBalanced(src: string, i: number, open: string, close: string): number {
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') { j++; continue; }
    if (c === "'" && open === '(') { const k = src.indexOf("'", j + 1); if (k < 0) break; j = k; continue; }
    if (c === '"' && open === '(') {
      for (j++; j < src.length && src[j] !== '"'; j++) if (src[j] === '\\') j++;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return j + 1;
  }
  throw new ShellSyntaxError(`unexpected end of input: missing '${close}'`);
}

export function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let dblBracket = false;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (!dblBracket) {
      if (c === '2' && src[i + 1] === '>') {
        const op = OPS.find(o => o.startsWith('2') && src.startsWith(o, i))!;
        toks.push({ t: 'op', v: op });
        i += op.length;
        continue;
      }
      const op = OPS.find(o => !o.startsWith('2') && src.startsWith(o, i));
      if (op) { toks.push({ t: 'op', v: op }); i += op.length; continue; }
    } else if (src.startsWith('&&', i) || src.startsWith('||', i)) {
      toks.push({ t: 'w', w: { parts: [{ q: 1, s: src.slice(i, i + 2) }] }, raw: src.slice(i, i + 2) });
      i += 2;
      continue;
    }
    // A word: runs until an unquoted space or operator.
    const parts: Part[] = [];
    const start = i;
    let buf = '';
    const flush = () => { if (buf) { parts.push({ q: 0, s: buf }); buf = ''; } };
    while (i < src.length) {
      const ch = src[i];
      if (' \t\r\n'.includes(ch)) break;
      if (!dblBracket && '|&;<>()'.includes(ch)) {
        if (ch === '(' && buf.endsWith('$')) { const j = skipBalanced(src, i, '(', ')'); buf += src.slice(i, j); i = j; continue; }
        if (ch === '(' && /^[!@?*+]$/.test(buf.slice(-1))) { const j = skipBalanced(src, i, '(', ')'); buf += src.slice(i, j); i = j; continue; }
        break;
      }
      if (dblBracket && (src.startsWith('&&', i) || src.startsWith('||', i))) break;
      if (ch === '\\') {
        flush();
        if (i + 1 < src.length) parts.push({ q: 1, s: src[i + 1] });
        i += 2;
        continue;
      }
      if (ch === "'") {
        flush();
        const j = src.indexOf("'", i + 1);
        if (j < 0) throw new ShellSyntaxError("unexpected end of input: missing closing '");
        parts.push({ q: 1, s: src.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
      if (ch === '"') {
        flush();
        i++;
        let dq = '';
        while (i < src.length && src[i] !== '"') {
          if (src[i] === '\\' && '"\\$`\n'.includes(src[i + 1] ?? '')) {
            if (dq) { parts.push({ q: 2, s: dq }); dq = ''; }
            if (src[i + 1] !== '\n') parts.push({ q: 1, s: src[i + 1] });
            i += 2;
            continue;
          }
          if (src[i] === '$' && src[i + 1] === '(') { const j = skipBalanced(src, i + 1, '(', ')'); dq += src.slice(i, j); i = j; continue; }
          if (src[i] === '$' && src[i + 1] === '{') { const j = skipBalanced(src, i + 1, '{', '}'); dq += src.slice(i, j); i = j; continue; }
          if (src[i] === '`') { const j = src.indexOf('`', i + 1); if (j < 0) throw new ShellSyntaxError('unexpected end of input: missing closing `'); dq += src.slice(i, j + 1); i = j + 1; continue; }
          dq += src[i++];
        }
        if (i >= src.length) throw new ShellSyntaxError('unexpected end of input: missing closing "');
        i++;
        parts.push({ q: 2, s: dq });
        if (!parts.length || parts[parts.length - 1].s === '' ) { /* "" still makes a word */ }
        continue;
      }
      if (ch === '$' && src[i + 1] === '(') { const j = skipBalanced(src, i + 1, '(', ')'); buf += src.slice(i, j); i = j; continue; }
      if (ch === '$' && src[i + 1] === '{') { const j = skipBalanced(src, i + 1, '{', '}'); buf += src.slice(i, j); i = j; continue; }
      if (ch === '`') { const j = src.indexOf('`', i + 1); if (j < 0) throw new ShellSyntaxError('unexpected end of input: missing closing `'); buf += src.slice(i, j + 1); i = j + 1; continue; }
      buf += ch;
      i++;
    }
    flush();
    const raw = src.slice(start, i);
    if (!parts.length && raw === '') { i++; continue; }
    if (!parts.length) parts.push({ q: 2, s: '' });
    toks.push({ t: 'w', w: { parts }, raw });
    if (raw === '[[') dblBracket = true;
    if (raw === ']]') dblBracket = false;
  }
  return toks;
}

// ── Parser ────────────────────────────────────────────────────────────────

export interface Redir { op: string; target?: Word }
export type Node =
  | { k: 'seq'; items: { node: Node; bg?: boolean }[] }
  | { k: 'andor'; first: Node; rest: { op: '&&' | '||'; node: Node }[] }
  | { k: 'pipe'; cmds: Node[]; neg: boolean }
  | { k: 'simple'; assigns: { name: string; value: Word }[]; words: Word[]; redirs: Redir[] }
  | { k: 'for'; name: string; items: Word[] | null; body: Node; redirs: Redir[] }
  | { k: 'cfor'; init: string; cond: string; step: string; body: Node; redirs: Redir[] }
  | { k: 'while'; cond: Node; body: Node; until: boolean; redirs: Redir[] }
  | { k: 'if'; branches: { cond: Node; body: Node }[]; otherwise?: Node; redirs: Redir[] }
  | { k: 'group'; body: Node; sub: boolean; redirs: Redir[] }
  | { k: 'arith'; expr: string; redirs: Redir[] }
  | { k: 'case'; word: Word; arms: { pats: Word[]; body: Node }[]; redirs: Redir[] }
  | { k: 'func'; name: string; body: Node };

const plain = (w: Word) => (w.parts.length === 1 && w.parts[0].q === 0 ? w.parts[0].s : null);

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}

  peek() { return this.toks[this.i]; }
  isOp(v: string) { const t = this.peek(); return !!t && t.t === 'op' && t.v === v; }
  isWord(v: string) { const t = this.peek(); return !!t && t.t === 'w' && plain(t.w) === v; }
  skipNl() { while (this.isOp('\n')) this.i++; }
  expectWord(v: string) {
    this.skipNl();
    if (!this.isWord(v)) {
      const t = this.peek();
      throw new ShellSyntaxError(t ? `syntax error near unexpected token '${t.t === 'op' ? (t.v === '\n' ? 'newline' : t.v) : t.raw}' (expected '${v}')` : `syntax error: unexpected end of input (expected '${v}')`);
    }
    this.i++;
  }

  program(): Node {
    const n = this.seq(new Set());
    if (this.i < this.toks.length) {
      const t = this.peek();
      throw new ShellSyntaxError(`syntax error near unexpected token '${t.t === 'op' ? t.v : t.raw}'`);
    }
    return n;
  }

  /** A list of commands, ending at end of input or at one of the given reserved words or ')'. */
  seq(stop: Set<string>): Node {
    const items: { node: Node; bg?: boolean }[] = [];
    for (;;) {
      this.skipNl();
      while (this.isOp(';')) { this.i++; this.skipNl(); }
      const t = this.peek();
      if (!t) break;
      if (t.t === 'w' && stop.has(plain(t.w) ?? '\0')) break;
      if (t.t === 'op' && (t.v === ')' || t.v === ';;')) break;
      const node = this.andOr();
      let bg = false;
      if (this.isOp('&')) { this.i++; bg = true; }
      else if (this.isOp(';') || this.isOp('\n')) this.i++;
      items.push({ node, bg });
    }
    return items.length === 1 && !items[0].bg ? items[0].node : { k: 'seq', items };
  }

  andOr(): Node {
    const first = this.pipeline();
    const rest: { op: '&&' | '||'; node: Node }[] = [];
    while (this.isOp('&&') || this.isOp('||')) {
      const op = (this.peek() as { v: '&&' | '||' }).v;
      this.i++;
      this.skipNl();
      rest.push({ op, node: this.pipeline() });
    }
    return rest.length ? { k: 'andor', first, rest } : first;
  }

  pipeline(): Node {
    let neg = false;
    if (this.isWord('!')) { this.i++; neg = true; }
    const cmds = [this.command()];
    while (this.isOp('|')) { this.i++; this.skipNl(); cmds.push(this.command()); }
    return cmds.length === 1 && !neg ? cmds[0] : { k: 'pipe', cmds, neg };
  }

  redirs(): Redir[] {
    const out: Redir[] = [];
    for (;;) {
      const t = this.peek();
      if (!t || t.t !== 'op' || !['>', '>>', '<', '2>', '2>>', '&>', '2>&1'].includes(t.v)) return out;
      this.i++;
      if (t.v === '2>&1') { out.push({ op: t.v }); continue; }
      const w = this.peek();
      if (!w || w.t !== 'w') throw new ShellSyntaxError(`syntax error near unexpected token '${w && w.v !== '\n' ? w.v : 'newline'}'`);
      this.i++;
      out.push({ op: t.v, target: w.w });
    }
  }

  command(): Node {
    const t = this.peek();
    if (!t) throw new ShellSyntaxError('syntax error: unexpected end of input');
    if (t.t === 'op') {
      if (t.v === '(') {
        this.i++;
        if (this.isOp('(')) {
          // (( arithmetic ))
          this.i++;
          let depth = 0;
          let expr = '';
          while (this.peek() && !(depth === 0 && this.isOp(')'))) {
            const x = this.peek();
            if (x.t === 'op') { if (x.v === '(') depth++; if (x.v === ')') depth--; expr += x.v; } else expr += ' ' + x.raw + ' ';
            this.i++;
          }
          if (!this.isOp(')')) throw new ShellSyntaxError("syntax error: missing '))'");
          this.i++;
          if (!this.isOp(')')) throw new ShellSyntaxError("syntax error: missing '))'");
          this.i++;
          return { k: 'arith', expr, redirs: this.redirs() };
        }
        const body = this.seq(new Set());
        if (!this.isOp(')')) throw new ShellSyntaxError("syntax error: missing ')'");
        this.i++;
        return { k: 'group', body, sub: true, redirs: this.redirs() };
      }
      if (['>', '>>', '<', '2>', '2>>', '&>'].includes(t.v)) return this.simple();
      throw new ShellSyntaxError(`syntax error near unexpected token '${t.v === '\n' ? 'newline' : t.v}'`);
    }
    const w = plain(t.w);
    switch (w) {
      case 'if': return this.ifCmd();
      case 'for': return this.forCmd();
      case 'while': case 'until': return this.whileCmd(w === 'until');
      case 'case': return this.caseCmd();
      case '{': {
        this.i++;
        const body = this.seq(new Set(['}']));
        this.expectWord('}');
        return { k: 'group', body, sub: false, redirs: this.redirs() };
      }
      case 'then': case 'else': case 'elif': case 'fi': case 'do': case 'done': case '}': case 'esac':
        throw new ShellSyntaxError(`syntax error near unexpected token '${w}'`);
      case 'function': {
        this.i++;
        const nameTok = this.peek();
        if (!nameTok || nameTok.t !== 'w') throw new ShellSyntaxError('syntax error: function name expected');
        this.i++;
        if (this.isOp('(')) { this.i++; if (!this.isOp(')')) throw new ShellSyntaxError("syntax error: expected ')'"); this.i++; }
        this.skipNl();
        return { k: 'func', name: nameTok.raw, body: this.command() };
      }
    }
    // name() { ... }
    const after = this.toks[this.i + 1];
    const after2 = this.toks[this.i + 2];
    if (w && /^[A-Za-z_][\w-]*$/.test(w) && after?.t === 'op' && after.v === '(' && after2?.t === 'op' && after2.v === ')') {
      this.i += 3;
      this.skipNl();
      return { k: 'func', name: w, body: this.command() };
    }
    return this.simple();
  }

  simple(): Node {
    const assigns: { name: string; value: Word }[] = [];
    const words: Word[] = [];
    const redirs: Redir[] = [];
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (t.t === 'op') {
        if (['>', '>>', '<', '2>', '2>>', '&>', '2>&1'].includes(t.v)) { redirs.push(...this.redirs()); continue; }
        break;
      }
      const first = t.w.parts[0];
      const m = !words.length && first.q === 0 ? /^([A-Za-z_]\w*)=/.exec(first.s) : null;
      if (m) {
        const value: Word = { parts: [{ q: 0, s: first.s.slice(m[0].length) }, ...t.w.parts.slice(1)].filter((p, i) => i > 0 || p.s !== '') as Part[] };
        assigns.push({ name: m[1], value });
        this.i++;
        continue;
      }
      words.push(t.w);
      this.i++;
    }
    if (!assigns.length && !words.length && !redirs.length) throw new ShellSyntaxError('syntax error: empty command');
    return { k: 'simple', assigns, words, redirs };
  }

  ifCmd(): Node {
    this.i++;
    const branches: { cond: Node; body: Node }[] = [];
    let otherwise: Node | undefined;
    const cond = this.seq(new Set(['then']));
    this.expectWord('then');
    branches.push({ cond, body: this.seq(new Set(['elif', 'else', 'fi'])) });
    for (;;) {
      this.skipNl();
      if (this.isWord('elif')) {
        this.i++;
        const c = this.seq(new Set(['then']));
        this.expectWord('then');
        branches.push({ cond: c, body: this.seq(new Set(['elif', 'else', 'fi'])) });
        continue;
      }
      if (this.isWord('else')) { this.i++; otherwise = this.seq(new Set(['fi'])); }
      break;
    }
    this.expectWord('fi');
    return { k: 'if', branches, otherwise, redirs: this.redirs() };
  }

  forCmd(): Node {
    this.i++;
    if (this.isOp('(')) {
      // for (( init; cond; step ))
      this.i++;
      if (!this.isOp('(')) throw new ShellSyntaxError("syntax error near 'for ('");
      this.i++;
      const pieces: string[] = [''];
      let depth = 0;
      while (this.peek() && !(depth === 0 && this.isOp(')'))) {
        const x = this.peek();
        if (x.t === 'op' && x.v === ';') pieces.push('');
        else if (x.t === 'op') { if (x.v === '(') depth++; if (x.v === ')') depth--; pieces[pieces.length - 1] += x.v; }
        else pieces[pieces.length - 1] += ' ' + x.raw + ' ';
        this.i++;
      }
      this.i += 2;
      if (pieces.length !== 3) throw new ShellSyntaxError('syntax error in for (( ; ; ))');
      this.skipNl();
      if (this.isOp(';')) this.i++;
      this.expectWord('do');
      const body = this.seq(new Set(['done']));
      this.expectWord('done');
      return { k: 'cfor', init: pieces[0], cond: pieces[1], step: pieces[2], body, redirs: this.redirs() };
    }
    const nameTok = this.peek();
    if (!nameTok || nameTok.t !== 'w' || !/^[A-Za-z_]\w*$/.test(nameTok.raw)) throw new ShellSyntaxError("syntax error: 'for' needs a variable name");
    this.i++;
    let items: Word[] | null = null;
    this.skipNl();
    if (this.isWord('in')) {
      this.i++;
      items = [];
      while (this.peek() && this.peek().t === 'w') { items.push((this.peek() as { w: Word }).w); this.i++; }
    }
    if (this.isOp(';')) this.i++;
    this.expectWord('do');
    const body = this.seq(new Set(['done']));
    this.expectWord('done');
    return { k: 'for', name: nameTok.raw, items, body, redirs: this.redirs() };
  }

  caseCmd(): Node {
    this.i++;
    const wt = this.peek();
    if (!wt || wt.t !== 'w') throw new ShellSyntaxError("syntax error: 'case' needs a word");
    this.i++;
    this.expectWord('in');
    const arms: { pats: Word[]; body: Node }[] = [];
    for (;;) {
      this.skipNl();
      if (this.isWord('esac')) { this.i++; break; }
      if (!this.peek()) throw new ShellSyntaxError("syntax error: unexpected end of input (expected 'esac')");
      if (this.isOp('(')) this.i++;
      const pats: Word[] = [];
      for (;;) {
        const t = this.peek();
        if (!t || t.t !== 'w') throw new ShellSyntaxError("syntax error in case pattern (expected 'pattern)')");
        pats.push(t.w);
        this.i++;
        if (this.isOp('|')) { this.i++; continue; }
        break;
      }
      if (!this.isOp(')')) throw new ShellSyntaxError("syntax error: expected ')' after case pattern");
      this.i++;
      const body = this.seq(new Set(['esac']));
      if (this.isOp(';;')) this.i++;
      arms.push({ pats, body });
    }
    return { k: 'case', word: wt.w, arms, redirs: this.redirs() };
  }

  whileCmd(until: boolean): Node {
    this.i++;
    const cond = this.seq(new Set(['do']));
    this.expectWord('do');
    const body = this.seq(new Set(['done']));
    this.expectWord('done');
    return { k: 'while', cond, body, until, redirs: this.redirs() };
  }
}

export function parse(src: string): Node {
  return new Parser(lex(src)).program();
}

/** True when the input is unfinished (an open quote, loop or if), so the terminal should ask for more lines. */
export function needsMore(src: string): boolean {
  try {
    parse(src);
    return /\\$/.test(src) || /(\||&&|\|\|)\s*$/.test(src);
  } catch (e) {
    return e instanceof ShellSyntaxError && /unexpected end of input|missing|expected '(then|fi|do|done|\})'/.test(e.message) && !/near unexpected token '(?!newline)/.test(e.message);
  }
}

// ── Interpreter ───────────────────────────────────────────────────────────

export interface Stdin { text: string; pos: number }
export interface Result { out: string; code: number }

/** Something to keep running after the command returns: tail -f. */
export interface Follow { path: string; seen: number; rest: Node[] }

export interface RunOutput {
  /** Standard output only (what a pipe or a grader sees). */
  out: string;
  err: string;
  /** Output and errors in the order they happened, for the screen. */
  display: string;
  code: number;
  follow?: Follow;
  edit?: string;
  clear?: boolean;
}

export interface ShellHost {
  /** Seconds since midnight on the shift's day. */
  now(): number;
  lookup(kind: 'whois' | 'intel' | 'dns', q: string): string | undefined;
  /** The network the network commands see. */
  net?: Net;
}

/** break, continue, return and exit unwind the interpreter; `partial` carries the output made before them. */
class Flow { partial = ''; constructor(public kind: 'break' | 'continue' | 'return' | 'exit', public n = 1, public code = 0) {} }

/** Runs fn; if it unwinds, the output gathered so far goes along. */
function carry<T>(acc: string, fn: () => T): T {
  try { return fn(); } catch (e) { if (e instanceof Flow) e.partial = acc + e.partial; throw e; }
}
export class TooLong extends Error {}

export class Shell {
  cwd = HOME;
  vars = new Map<string, string>([['HOME', HOME], ['USER', 'analyst'], ['HOSTNAME', 'soc-ws'], ['PATH', `${HOME}/bin:/usr/local/bin:/usr/bin:/bin`], ['SHELL', '/bin/bash'], ['PWD', HOME]]);
  funcs = new Map<string, Node>();
  history: string[] = [];
  args: string[] = [];
  scriptName = 'bash';
  lastCode = 0;
  steps = 0;
  depth = 0;
  err = '';
  /**
   * Error-stream lines a command printed before any of its output, such as tcpdump's "reading from file" line.
   * The screen shows them ahead of the output, as a real terminal would.
   */
  errLead = '';
  edit?: string;
  clear = false;
  /** False while output goes into a pipe, a file or $(...), like isatty() in a real shell. */
  tty = true;
  private exited = false;

  constructor(public vfs: Vfs, public host: ShellHost) {}

  /** Runs one line (or several) as typed at the prompt. */
  run(src: string): RunOutput {
    this.err = '';
    this.errLead = '';
    this.edit = undefined;
    this.clear = false;
    this.steps = 0;
    this.tty = true;
    let node: Node;
    try {
      node = parse(src);
    } catch (e) {
      if (e instanceof ShellSyntaxError) return { out: '', err: `bash: ${e.message}\n`, display: `bash: ${e.message}\n`, code: 2 };
      throw e;
    }
    const follow = this.followOf(node);
    if (follow) {
      const head = follow.node;
      const res = this.guard(() => this.exec({ k: 'pipe', cmds: [head, ...follow.rest], neg: false }, { text: '', pos: 0 }));
      const file = this.vfs.read(follow.path);
      const err = this.errLead + this.err;
      const display = this.errLead + res.out + this.err;
      if (res.code !== 0 || file === undefined) return { out: res.out, err, display, code: res.code };
      return { out: res.out, err, display, code: 0, follow: { path: follow.path, seen: lines(file).length, rest: follow.rest } };
    }
    // Top-level commands run one at a time so each one's errors show right after its output.
    const items = node.k === 'seq' ? node.items.map(i => i.node) : [node];
    let out = '';
    let err = '';
    let display = '';
    let code = 0;
    for (const item of items) {
      this.err = '';
      this.errLead = '';
      const res = this.guard(() => this.exec(item, { text: '', pos: 0 }));
      out += res.out;
      err += this.errLead + this.err;
      display += this.errLead + res.out + this.err;
      code = this.lastCode = res.code;
      if (this.exited) break;
    }
    this.exited = false;
    return { out, err, display, code, edit: this.edit, clear: this.clear };
  }

  /** Runs source text with $1, $2 ... set, as if it were a script. */
  runWith(src: string, args: string[]): RunOutput {
    const saved = this.args;
    this.args = args;
    try { return this.run(src); } finally { this.args = saved; }
  }

  /** New output for a running tail -f: the lines added since last time, through the rest of the pipeline. */
  followTick(f: Follow): string {
    const text = this.vfs.read(f.path) ?? '';
    const all = lines(text);
    if (all.length <= f.seen) return '';
    const fresh = all.slice(f.seen).join('\n') + '\n';
    f.seen = all.length;
    if (!f.rest.length) return fresh;
    this.err = '';
    this.errLead = '';
    const res = this.guard(() => this.exec({ k: 'pipe', cmds: f.rest, neg: false }, { text: fresh, pos: 0 }));
    return res.out;
  }

  private followOf(node: Node): { path: string; node: Node; rest: Node[] } | null {
    const cmds = node.k === 'pipe' && !node.neg ? node.cmds : node.k === 'simple' ? [node] : null;
    if (!cmds) return null;
    const head = cmds[0];
    if (head.k !== 'simple' || head.words.length < 2) return null;
    const words = head.words.map(w => w.parts.map(p => p.s).join(''));
    if (words[0] !== 'tail' || !words.some(w => /^-[a-zA-Z0-9]*[fF]/.test(w) || w === '--follow')) return null;
    const files = words.slice(1).filter((w, i, a) => !w.startsWith('-') && !(i > 0 && a[i - 1] === '-n'));
    if (files.length !== 1) return null;
    const path = this.vfs.resolve(this.cwd, files[0]);
    // Drop -f, and the f from combined flags such as -fn20.
    const words2: Word[] = head.words
      .map(w => {
        const s = w.parts.map(p => p.s).join('');
        if (s === '--follow') return null;
        return /^-[a-zA-Z0-9]*[fF]/.test(s) ? ({ parts: [{ q: 1, s: s.replace(/[fF]/g, '') }] } as Word) : w;
      })
      .filter((w): w is Word => !!w && w.parts.map(p => p.s).join('') !== '-');
    return { path, node: { ...head, words: words2 }, rest: cmds.slice(1) };
  }

  private guard(fn: () => Result): Result {
    try {
      return fn();
    } catch (e) {
      if (e instanceof Flow) { if (e.kind === 'exit') this.exited = true; return { out: e.partial, code: e.code }; }
      if (e instanceof TooLong) { this.err += 'bash: stopped: the command ran too long (is a loop never ending?)\n'; return { out: '', code: 130 }; }
      if (e instanceof ShellSyntaxError) { this.err += `bash: ${e.message}\n`; return { out: '', code: 2 }; }
      if (e instanceof RangeError) { this.err += 'bash: stopped: too much recursion\n'; return { out: '', code: 1 }; }
      throw e;
    }
  }

  tick() {
    if (++this.steps > 300_000) throw new TooLong();
  }

  exec(node: Node, stdin: Stdin): Result {
    this.tick();
    switch (node.k) {
      case 'seq': {
        let out = '';
        let code = 0;
        for (const it of node.items) {
          const r = carry(out, () => this.exec(it.node, stdin));
          out += r.out;
          code = r.code;
          this.lastCode = code;
        }
        return { out, code };
      }
      case 'andor': {
        let r = this.exec(node.first, stdin);
        let out = r.out;
        this.lastCode = r.code;
        for (const { op, node: n } of node.rest) {
          if ((op === '&&') === (r.code === 0)) {
            r = carry(out, () => this.exec(n, stdin));
            out += r.out;
            this.lastCode = r.code;
          }
        }
        return { out, code: r.code };
      }
      case 'pipe': {
        let input = stdin;
        let r: Result = { out: '', code: 0 };
        const tty = this.tty;
        node.cmds.forEach((c, i) => {
          this.tty = tty && i === node.cmds.length - 1;
          r = this.exec(c, i === 0 ? input : { text: r.out, pos: 0 });
          input = { text: r.out, pos: 0 };
        });
        this.tty = tty;
        return { out: r.out, code: node.neg ? (r.code === 0 ? 1 : 0) : r.code };
      }
      case 'simple': return this.simple(node, stdin);
      case 'func': this.funcs.set(node.name, node.body); return { out: '', code: 0 };
      case 'arith': {
        const v = this.arith(node.expr);
        return { out: '', code: v !== 0 ? 0 : 1 };
      }
      default: return this.withRedirs(node.redirs, stdin, s => this.compound(node, s));
    }
  }

  private compound(node: Node, stdin: Stdin): Result {
    switch (node.k) {
      case 'group': {
        if (!node.sub) return this.exec(node.body, stdin);
        const saved = { cwd: this.cwd, vars: new Map(this.vars) };
        try { return this.exec(node.body, stdin); } finally { this.cwd = saved.cwd; this.vars = saved.vars; }
      }
      case 'if': {
        let out = '';
        for (const b of node.branches) {
          const c = carry(out, () => this.exec(b.cond, stdin));
          out += c.out;
          if (c.code === 0) { const r = carry(out, () => this.exec(b.body, stdin)); return { out: out + r.out, code: r.code }; }
        }
        if (node.otherwise) { const r = carry(out, () => this.exec(node.otherwise!, stdin)); return { out: out + r.out, code: r.code }; }
        return { out, code: 0 };
      }
      case 'for': {
        const items = node.items ? node.items.flatMap(w => this.expand(w)) : [...this.args];
        return this.loop(stdin, function* () { for (const it of items) yield it; }, (v) => this.vars.set(node.name, v), node.body);
      }
      case 'cfor': {
        if (node.init.trim()) this.arith(node.init);
        const self = this;
        return this.loop(stdin, function* () {
          while (!node.cond.trim() || self.arith(node.cond) !== 0) {
            yield '';
            if (node.step.trim()) self.arith(node.step);
          }
        }, () => undefined, node.body);
      }
      case 'case': {
        const v = this.expandOne(node.word);
        for (const arm of node.arms) {
          if (arm.pats.some(p => globRegex(this.expandOne(p)).test(v))) return this.exec(arm.body, stdin);
        }
        return { out: '', code: 0 };
      }
      case 'while': {
        const self = this;
        let condOut = '';
        const r = this.loop(stdin, function* () {
          for (;;) {
            const c = self.exec(node.cond, stdin);
            condOut += c.out;
            if ((c.code === 0) === node.until) return;
            yield '';
          }
        }, () => undefined, node.body);
        return { out: condOut + r.out, code: r.code };
      }
    }
    return { out: '', code: 0 };
  }

  private loop(stdin: Stdin, items: () => Generator<string>, set: (v: string) => void, body: Node): Result {
    let out = '';
    let code = 0;
    for (const v of items()) {
      this.tick();
      set(v);
      try {
        const r = this.exec(body, stdin);
        out += r.out;
        code = r.code;
      } catch (e) {
        if (!(e instanceof Flow)) throw e;
        if ((e.kind === 'break' || e.kind === 'continue') && e.n <= 1) {
          out += e.partial;
          if (e.kind === 'break') break;
          continue;
        }
        if (e.kind === 'break' || e.kind === 'continue') e.n--;
        e.partial = out + e.partial;
        throw e;
      }
    }
    return { out, code };
  }

  private withRedirs(redirs: Redir[], stdin: Stdin, run: (s: Stdin) => Result): Result {
    let input = stdin;
    let outTo: { path: string; append: boolean } | null = null;
    let errTo: { path: string; append: boolean } | null = null;
    let errToOut = false;
    for (const r of redirs) {
      if (r.op === '2>&1') { errToOut = true; continue; }
      const target = this.expandOne(r.target!);
      const path = this.vfs.resolve(this.cwd, target);
      if (r.op === '<') {
        const text = this.vfs.read(path);
        if (text === undefined) { this.err += `bash: ${target}: ${this.vfs.isDir(path) ? 'Is a directory' : 'No such file or directory'}\n`; return { out: '', code: 1 }; }
        input = { text, pos: 0 };
      } else if (r.op === '>' || r.op === '>>') outTo = { path, append: r.op === '>>' };
      else if (r.op === '2>' || r.op === '2>>') errTo = { path, append: r.op === '2>>' };
      else if (r.op === '&>') { outTo = { path, append: false }; errToOut = true; }
    }
    if (!outTo && !errTo && !errToOut) return run(input);
    const savedErr = this.err;
    const savedLead = this.errLead;
    const tty = this.tty;
    this.err = '';
    this.errLead = '';
    if (outTo) this.tty = false;
    let res: Result;
    try { res = run(input); } finally { this.tty = tty; }
    let err = this.err;
    let lead = this.errLead;
    this.err = savedErr;
    this.errLead = savedLead;
    let out = res.out;
    if (errToOut) { out = lead + out + err; err = ''; lead = ''; }
    if (errTo) {
      const e = this.vfs.write(errTo.path, lead + err, errTo.append);
      if (e) this.err += `bash: ${e}\n`;
      err = '';
      lead = '';
    }
    this.errLead += lead;
    this.err += err;
    if (outTo) {
      const e = this.vfs.write(outTo.path, out, outTo.append);
      if (e) { this.err += `bash: ${e}\n`; return { out: '', code: 1 }; }
      return { out: '', code: res.code };
    }
    return { out, code: res.code };
  }

  private simple(node: Extract<Node, { k: 'simple' }>, stdin: Stdin): Result {
    const words = node.words.flatMap(w => this.expand(w));
    if (!words.length) {
      for (const a of node.assigns) this.vars.set(a.name, this.expandOne(a.value));
      return this.withRedirs(node.redirs, stdin, () => ({ out: '', code: 0 }));
    }
    const saved: [string, string | undefined][] = [];
    for (const a of node.assigns) { saved.push([a.name, this.vars.get(a.name)]); this.vars.set(a.name, this.expandOne(a.value)); }
    try {
      return this.withRedirs(node.redirs, stdin, s => this.command(words, s));
    } finally {
      for (const [k, v] of saved) if (v === undefined) this.vars.delete(k); else this.vars.set(k, v);
    }
  }

  /** Runs a command by name: a function, a script file, or a built-in command. */
  command(words: string[], stdin: Stdin): Result {
    const [name, ...args] = words;
    const fn = this.funcs.get(name);
    if (fn) return this.callWith(args, name, () => this.exec(fn, stdin));
    if (name.includes('/')) return this.runScript(name, args, stdin, true);
    const cmd = COMMANDS[name];
    if (cmd) {
      const ctx: CmdCtx = { sh: this, args, stdin, name };
      const r = cmd(ctx);
      return r;
    }
    // Scripts in ~/bin are on the PATH.
    for (const dir of (this.vars.get('PATH') ?? '').split(':')) {
      const p = `${dir}/${name}`;
      if (this.vfs.isFile(p)) return this.runScript(p, args, stdin, true);
    }
    this.err += `bash: ${name}: command not found\n`;
    return { out: '', code: 127 };
  }

  runScript(path: string, args: string[], stdin: Stdin, needExec: boolean): Result {
    const full = this.vfs.resolve(this.cwd, path);
    if (this.vfs.isDir(full)) { this.err += `bash: ${path}: Is a directory\n`; return { out: '', code: 126 }; }
    const text = this.vfs.read(full);
    if (text === undefined) { this.err += `bash: ${path}: No such file or directory\n`; return { out: '', code: 127 }; }
    if (needExec && !this.vfs.file(full)?.exec) {
      this.err += `bash: ${path}: Permission denied (make it runnable with: chmod +x ${path}, or run it with: bash ${path})\n`;
      return { out: '', code: 126 };
    }
    if (++this.depth > 20) { this.depth--; this.err += 'bash: scripts calling scripts too deeply\n'; return { out: '', code: 1 }; }
    try {
      let node: Node;
      try { node = parse(text.replace(/^#!.*\n/, '')); } catch (e) {
        if (e instanceof ShellSyntaxError) { this.err += `${path}: ${e.message}\n`; return { out: '', code: 2 }; }
        throw e;
      }
      const saved = { cwd: this.cwd, vars: new Map(this.vars), funcs: new Map(this.funcs) };
      try {
        return this.callWith(args, path, () => this.exec(node, stdin), true);
      } finally {
        this.cwd = saved.cwd;
        this.vars = saved.vars;
        this.funcs = saved.funcs;
      }
    } finally {
      this.depth--;
    }
  }

  private callWith(args: string[], name: string, run: () => Result, script = false): Result {
    const saved = { args: this.args, name: this.scriptName };
    this.args = args;
    if (script) this.scriptName = name;
    try {
      return run();
    } catch (e) {
      if (e instanceof Flow && (e.kind === 'return' || (script && e.kind === 'exit'))) {
        return { out: e.partial, code: e.code };
      }
      throw e;
    } finally {
      this.args = saved.args;
      this.scriptName = saved.name;
    }
  }

  flow(kind: 'break' | 'continue' | 'return' | 'exit', n: number, code: number): never {
    throw new Flow(kind, n, code);
  }

  // ── Expansion ──────────────────────────────────────────────────────────

  getVar(name: string): string {
    if (/^\d+$/.test(name)) return name === '0' ? this.scriptName : this.args[Number(name) - 1] ?? '';
    switch (name) {
      case '#': return String(this.args.length);
      case '@': case '*': return this.args.join(' ');
      case '?': return String(this.lastCode);
      case '$': return '4242';
      case 'RANDOM': return String(Math.floor(Math.random() * 32768));
      case 'PWD': return this.cwd;
      case 'SECONDS': return '0';
    }
    return this.vars.get(name) ?? '';
  }

  /** Expands $... inside text (no splitting). */
  expandText(s: string): string {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '`') {
        const j = s.indexOf('`', i + 1);
        out += this.substitute(s.slice(i + 1, j));
        i = j;
        continue;
      }
      if (c !== '$' || i + 1 >= s.length) { out += c; continue; }
      const n = s[i + 1];
      if (n === '(' && s[i + 2] === '(') {
        const j = skipBalanced(s, i + 1, '(', ')');
        out += String(this.arith(s.slice(i + 3, j - 2)));
        i = j - 1;
        continue;
      }
      if (n === '(') {
        const j = skipBalanced(s, i + 1, '(', ')');
        out += this.substitute(s.slice(i + 2, j - 1));
        i = j - 1;
        continue;
      }
      if (n === '{') {
        const j = skipBalanced(s, i + 1, '{', '}');
        out += this.braced(s.slice(i + 2, j - 1));
        i = j - 1;
        continue;
      }
      const m = /^([A-Za-z_]\w*|\d|[#@*?$!])/.exec(s.slice(i + 1));
      if (!m) { out += c; continue; }
      out += this.getVar(m[1]);
      i += m[1].length;
    }
    return out;
  }

  private braced(inner: string): string {
    let m = /^#([A-Za-z_]\w*|\d+|@)$/.exec(inner);
    if (m) return m[1] === '@' ? String(this.args.length) : String(this.getVar(m[1]).length);
    m = /^([A-Za-z_]\w*|\d+|[#@*?])(?:(:?[-=+?])(.*)|(##?|%%?)(.*)|\/(\/?)([^/]*)\/?(.*)|:(\d+)(?::(\d+))?)?$/s.exec(inner);
    if (!m) throw new ShellSyntaxError(`\${${inner}}: bad substitution`);
    const [, name, op, word, cut, pattern, all, find, rep, off, len] = m;
    const v = this.getVar(name);
    if (op) {
      const unset = op.startsWith(':') ? v === '' : !this.vars.has(name) && !/^\d+$/.test(name);
      const kind = op.replace(':', '');
      if (kind === '-') return unset ? this.expandText(word) : v;
      if (kind === '=') { if (unset) { const w = this.expandText(word); this.vars.set(name, w); return w; } return v; }
      if (kind === '+') return unset ? '' : this.expandText(word);
      if (kind === '?') { if (unset) throw new ShellSyntaxError(`${name}: ${word || 'parameter null or not set'}`); return v; }
    }
    if (cut) {
      const re = globRegex(this.expandText(pattern)).source.slice(1, -1);
      const greedy = cut.length === 2;
      if (cut[0] === '#') {
        const r = new RegExp(`^${greedy ? re : re.replace(/\.\*/g, '.*?')}`);
        return v.replace(r, '');
      }
      // Suffix removal: try the shortest (or longest) matching suffix.
      const r = new RegExp(`^${re}$`);
      if (greedy) { for (let i = 0; i <= v.length; i++) if (r.test(v.slice(i))) return v.slice(0, i); }
      else { for (let i = v.length; i >= 0; i--) if (r.test(v.slice(i))) return v.slice(0, i); }
      return v;
    }
    if (find !== undefined) {
      const re = new RegExp(globRegex(this.expandText(find)).source.slice(1, -1), all ? 'g' : '');
      return v.replace(re, this.expandText(rep ?? ''));
    }
    if (off !== undefined) return v.substr(Number(off), len !== undefined ? Number(len) : undefined);
    return v;
  }

  private substitute(cmd: string): string {
    const saved = { cwd: this.cwd, vars: new Map(this.vars), tty: this.tty };
    this.tty = false;
    try {
      const r = this.exec(parse(cmd), { text: '', pos: 0 });
      this.lastCode = r.code;
      return r.out.replace(/\n+$/, '');
    } catch (e) {
      if (e instanceof Flow) return e.partial.replace(/\n+$/, '');
      throw e;
    } finally {
      this.cwd = saved.cwd;
      this.vars = saved.vars;
      this.tty = saved.tty;
    }
  }

  /** A word to its fields: expansion, then splitting of unquoted results, then globbing. */
  expand(w: Word): string[] {
    type Field = { s: string; glob: boolean };
    const fields: Field[] = [];
    let cur: Field | null = null;
    const ensure = (): Field => (cur ??= { s: '', glob: false });
    const cut = () => { if (cur) fields.push(cur); cur = null; };
    w.parts.forEach((p, pi) => {
      if (p.q === 1) { ensure().s += p.s; return; }
      if (p.q === 2) {
        if (p.s === '$@' || p.s === '${@}') {
          this.args.forEach((a, i) => { if (i > 0) cut(); ensure().s += a; });
          return;
        }
        ensure().s += this.expandText(p.s);
        return;
      }
      let s = p.s;
      if (pi === 0 && (s === '~' || s.startsWith('~/'))) s = HOME + s.slice(1);
      const literal = s.replace(/\$\{[^}]*\}|\$\([^)]*\)|\$\w+|\$./g, '');
      const glob = /[*?]|\[[^\]]+\]/.test(literal);
      if (!/[$`]/.test(s)) { const c = ensure(); c.s += s; c.glob ||= glob; return; }
      const pieces = this.expandText(s).split(/[ \t\n]+/);
      pieces.forEach((piece, i) => {
        if (i > 0) cut();
        if (piece !== '') { const c = ensure(); c.s += piece; c.glob ||= glob; }
      });
    });
    cut();
    const out: string[] = [];
    for (const f of fields) {
      const matches = f.glob ? this.glob(f.s) : [];
      if (matches.length) out.push(...matches);
      else out.push(f.s);
    }
    return out;
  }

  expandOne(w: Word): string {
    return w.parts.map((p, i) => (p.q === 1 ? p.s : p.q === 2 ? this.expandText(p.s) : this.expandText(i === 0 && (p.s === '~' || p.s.startsWith('~/')) ? HOME + p.s.slice(1) : p.s))).join('');
  }

  glob(pattern: string): string[] {
    const abs = pattern.startsWith('/');
    const base = abs ? '/' : this.cwd;
    const segs = pattern.split('/').filter(Boolean);
    let paths = [abs ? '/' : ''];
    for (const seg of segs) {
      const next: string[] = [];
      for (const p of paths) {
        const dir = this.vfs.resolve(base, p || '.');
        if (/[*?[]/.test(seg)) {
          const re = globRegex(seg);
          for (const name of this.vfs.list(dir)) {
            if (name.startsWith('.') && !seg.startsWith('.')) continue;
            if (re.test(name)) next.push(p === '/' ? `/${name}` : p ? `${p}/${name}` : name);
          }
        } else {
          const cand = p === '/' ? `/${seg}` : p ? `${p}/${seg}` : seg;
          if (this.vfs.exists(this.vfs.resolve(base, cand))) next.push(cand);
        }
      }
      paths = next;
    }
    return paths.filter(p => p !== '' && p !== '/').sort();
  }

  // ── Arithmetic ─────────────────────────────────────────────────────────

  arith(expr: string): number {
    const src = this.expandText(expr);
    let i = 0;
    const toks = src.match(/\d+|[A-Za-z_]\w*|\*\*|<=|>=|==|!=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|%=|[-+*/%()<>!=?:,]/g) ?? [];
    const peek = () => toks[i];
    const eat = () => toks[i++];
    const val = (t: string) => (/^\d+$/.test(t) ? Number(t) : Number(this.getVar(t)) || 0);
    const set = (name: string, v: number) => { this.vars.set(name, String(v)); return v; };
    const assignment = (): number => {
      if (/^[A-Za-z_]/.test(peek() ?? '') && ['=', '+=', '-=', '*=', '/=', '%='].includes(toks[i + 1])) {
        const name = eat();
        const op = eat();
        const r = assignment();
        const cur = val(name);
        return set(name, op === '=' ? r : op === '+=' ? cur + r : op === '-=' ? cur - r : op === '*=' ? cur * r : op === '/=' ? Math.trunc(cur / (r || 1)) : cur % (r || 1));
      }
      return ternary();
    };
    const ternary = (): number => {
      const c = or();
      if (peek() === '?') { eat(); const a = assignment(); eat(); const b = assignment(); return c ? a : b; }
      return c;
    };
    const or = (): number => { let a = and(); while (peek() === '||') { eat(); const b = and(); a = a || b ? 1 : 0; } return a; };
    const and = (): number => { let a = cmp(); while (peek() === '&&') { eat(); const b = cmp(); a = a && b ? 1 : 0; } return a; };
    const cmp = (): number => {
      let a = add();
      while (['<', '>', '<=', '>=', '==', '!='].includes(peek())) {
        const op = eat();
        const b = add();
        a = (op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : op === '>=' ? a >= b : op === '==' ? a === b : a !== b) ? 1 : 0;
      }
      return a;
    };
    const add = (): number => { let a = mul(); while (peek() === '+' || peek() === '-') { const op = eat(); const b = mul(); a = op === '+' ? a + b : a - b; } return a; };
    const mul = (): number => {
      let a = pow();
      while (['*', '/', '%'].includes(peek())) {
        const op = eat();
        const b = pow();
        if ((op === '/' || op === '%') && b === 0) throw new ShellSyntaxError('division by 0');
        a = op === '*' ? a * b : op === '/' ? Math.trunc(a / b) : a % b;
      }
      return a;
    };
    const pow = (): number => { const a = unary(); if (peek() === '**') { eat(); return a ** pow(); } return a; };
    const unary = (): number => {
      const t = peek();
      if (t === '-') { eat(); return -unary(); }
      if (t === '+') { eat(); return unary(); }
      if (t === '!') { eat(); return unary() ? 0 : 1; }
      if (t === '++' || t === '--') { eat(); const name = eat(); return set(name, val(name) + (t === '++' ? 1 : -1)); }
      return postfix();
    };
    const postfix = (): number => {
      const t = eat();
      if (t === undefined) throw new ShellSyntaxError('arithmetic: missing operand');
      if (t === '(') { const v = assignment(); if (eat() !== ')') throw new ShellSyntaxError("arithmetic: missing ')'"); return v; }
      if (/^[A-Za-z_]/.test(t) && (peek() === '++' || peek() === '--')) { const op = eat(); const v = val(t); set(t, v + (op === '++' ? 1 : -1)); return v; }
      if (/^\d+$|^[A-Za-z_]/.test(t)) return val(t);
      throw new ShellSyntaxError(`arithmetic: syntax error near '${t}'`);
    };
    if (!toks.length) return 0;
    let v = assignment();
    while (peek() === ',') { eat(); v = assignment(); }
    if (i < toks.length) throw new ShellSyntaxError(`arithmetic: syntax error near '${toks[i]}'`);
    return v;
  }
}
