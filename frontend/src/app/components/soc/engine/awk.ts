/**
 * A small awk: patterns and actions, fields, BEGIN and END, variables and arrays, if/while/for/for-in, print and
 * printf, and the everyday functions (length, substr, split, index, tolower, toupper, sub, gsub, match, int,
 * sprintf). Enough for the one-liners analysts write all day: pick fields, count by key, sum a column, filter rows.
 */

import { format, makeRegex, posixRegex, toNum } from './text';

/** Input text that looks like a number compares as one (awk's "strnum"). */
class SN { constructor(public s: string) {} }
type Val = string | number | SN;

type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 're'; v: string }
  | { k: 'var'; name: string }
  | { k: 'field'; e: Expr }
  | { k: 'idx'; name: string; keys: Expr[] }
  | { k: 'assign'; op: string; target: Expr; e: Expr }
  | { k: 'incdec'; op: '++' | '--'; prefix: boolean; target: Expr }
  | { k: 'bin'; op: string; a: Expr; b: Expr }
  | { k: 'un'; op: string; e: Expr }
  | { k: 'cond'; c: Expr; a: Expr; b: Expr }
  | { k: 'match'; neg: boolean; a: Expr; re: Expr }
  | { k: 'in'; keys: Expr[]; name: string }
  | { k: 'call'; name: string; args: Expr[] }
  | { k: 'group'; e: Expr };

type Stmt =
  | { k: 'print'; args: Expr[] }
  | { k: 'printf'; args: Expr[] }
  | { k: 'expr'; e: Expr }
  | { k: 'if'; c: Expr; a: Stmt; b?: Stmt }
  | { k: 'while'; c: Expr; body: Stmt }
  | { k: 'do'; c: Expr; body: Stmt }
  | { k: 'for'; init?: Stmt; c?: Expr; step?: Stmt; body: Stmt }
  | { k: 'forin'; v: string; arr: string; body: Stmt }
  | { k: 'block'; body: Stmt[] }
  | { k: 'next' } | { k: 'exit'; e?: Expr } | { k: 'break' } | { k: 'continue' }
  | { k: 'delete'; name: string; keys?: Expr[] };

interface Rule { kind: 'begin' | 'end' | 'main'; pattern?: Expr; range?: Expr; action?: Stmt[] }

interface Tok { t: 'num' | 'str' | 're' | 'name' | 'func' | 'op' | 'nl' | 'eof'; v: string }

const KEYWORDS = new Set(['BEGIN', 'END', 'print', 'printf', 'if', 'else', 'while', 'for', 'do', 'in', 'next', 'exit', 'break', 'continue', 'delete', 'getline', 'function', 'return']);
const BUILTINS = new Set(['length', 'substr', 'index', 'split', 'tolower', 'toupper', 'sub', 'gsub', 'match', 'int', 'sprintf', 'sqrt', 'log', 'exp', 'sin', 'cos', 'rand', 'srand', 'system']);

export class AwkError extends Error {}

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const regexOk = () => {
    const last = out[out.length - 1];
    if (!last) return true;
    if (last.t === 'nl') return true;
    if (last.t === 'op') return !([')', ']', '$', '++', '--'].includes(last.v));
    if (last.t === 'name') return ['print', 'printf', 'return', 'in'].includes(last.v);
    return false;
  };
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
    if (c === '\n' || c === ';') {
      out.push(c === ';' ? { t: 'op', v: ';' } : { t: 'nl', v: '\n' });
      i++;
      continue;
    }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] ?? ''))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(src.slice(i))!;
      out.push({ t: 'num', v: m[0] });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_]\w*/.exec(src.slice(i))!;
      i += m[0].length;
      out.push({ t: src[i] === '(' && BUILTINS.has(m[0]) ? 'func' : 'name', v: m[0] });
      continue;
    }
    if (c === '"') {
      let s = '';
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < src.length) {
          const n = src[++i];
          s += ({ n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/' } as Record<string, string>)[n] ?? '\\' + n;
        } else s += src[i];
        i++;
      }
      if (i >= src.length) throw new AwkError('unterminated string');
      i++;
      out.push({ t: 'str', v: s });
      continue;
    }
    if (c === '/' && regexOk()) {
      let s = '';
      i++;
      while (i < src.length && src[i] !== '/') {
        if (src[i] === '\\' && src[i + 1] === '/') { s += '/'; i += 2; continue; }
        if (src[i] === '\\') { s += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        if (src[i] === '\n') throw new AwkError('newline in regex');
        s += src[i++];
      }
      if (i >= src.length) throw new AwkError('unterminated regex');
      i++;
      out.push({ t: 're', v: s });
      continue;
    }
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    if (['**='].includes(three)) { out.push({ t: 'op', v: '^=' }); i += 3; continue; }
    if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '^=', '!~', '>>', '**'].includes(two)) {
      out.push({ t: 'op', v: two === '**' ? '^' : two });
      i += 2;
      continue;
    }
    if ('{}()[],+-*/%^!<>=?:~$|'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    throw new AwkError(`syntax error at '${c}'`);
  }
  out.push({ t: 'eof', v: '' });
  return out;
}

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  private peek(o = 0) { return this.toks[this.i + o]; }
  private next() { return this.toks[this.i++]; }
  private is(v: string, o = 0) { const t = this.peek(o); return (t.t === 'op' || t.t === 'name') && t.v === v; }
  private eat(v: string) {
    if (!this.is(v)) throw new AwkError(`syntax error: expected '${v}' near '${this.peek().v || 'end'}'`);
    return this.next();
  }
  private nls() { while (this.peek().t === 'nl') this.i++; }
  private terms() { while (this.peek().t === 'nl' || this.is(';')) this.i++; }

  program(): Rule[] {
    const rules: Rule[] = [];
    this.terms();
    while (this.peek().t !== 'eof') {
      if (this.is('BEGIN')) { this.next(); this.nls(); rules.push({ kind: 'begin', action: this.block() }); }
      else if (this.is('END')) { this.next(); this.nls(); rules.push({ kind: 'end', action: this.block() }); }
      else if (this.is('function')) throw new AwkError('user-defined functions are not supported here');
      else {
        let pattern: Expr | undefined;
        let range: Expr | undefined;
        if (!this.is('{')) {
          pattern = this.expr();
          if (this.is(',')) { this.next(); this.nls(); range = this.expr(); }
        }
        rules.push({ kind: 'main', pattern, range, action: this.is('{') ? this.block() : undefined });
      }
      this.terms();
    }
    return rules;
  }

  private block(): Stmt[] {
    this.eat('{');
    const body: Stmt[] = [];
    this.terms();
    while (!this.is('}')) {
      if (this.peek().t === 'eof') throw new AwkError("syntax error: missing '}'");
      body.push(this.stmt());
      this.terms();
    }
    this.eat('}');
    return body;
  }

  private simpleOrBlock(): Stmt {
    this.nls();
    if (this.is(';')) { this.next(); return { k: 'block', body: [] }; }
    return this.stmt();
  }

  private stmt(): Stmt {
    if (this.is('{')) return { k: 'block', body: this.block() };
    if (this.is('if')) {
      this.next(); this.eat('(');
      const c = this.expr();
      this.eat(')');
      const a = this.simpleOrBlock();
      const save = this.i;
      this.terms();
      if (this.is('else')) { this.next(); return { k: 'if', c, a, b: this.simpleOrBlock() }; }
      this.i = save;
      return { k: 'if', c, a };
    }
    if (this.is('while')) {
      this.next(); this.eat('(');
      const c = this.expr();
      this.eat(')');
      return { k: 'while', c, body: this.simpleOrBlock() };
    }
    if (this.is('do')) {
      this.next();
      const body = this.simpleOrBlock();
      this.terms();
      this.eat('while'); this.eat('(');
      const c = this.expr();
      this.eat(')');
      return { k: 'do', c, body };
    }
    if (this.is('for')) {
      this.next(); this.eat('(');
      if (this.peek().t === 'name' && this.is('in', 1) && this.peek(2).t === 'name' && this.is(')', 3)) {
        const v = this.next().v; this.next();
        const arr = this.next().v;
        this.eat(')');
        return { k: 'forin', v, arr, body: this.simpleOrBlock() };
      }
      const init = this.is(';') ? undefined : this.simple();
      this.eat(';'); this.nls();
      const c = this.is(';') ? undefined : this.expr();
      this.eat(';'); this.nls();
      const step = this.is(')') ? undefined : this.simple();
      this.eat(')');
      return { k: 'for', init, c, step, body: this.simpleOrBlock() };
    }
    if (this.is('next')) { this.next(); return { k: 'next' }; }
    if (this.is('break')) { this.next(); return { k: 'break' }; }
    if (this.is('continue')) { this.next(); return { k: 'continue' }; }
    if (this.is('exit')) {
      this.next();
      return { k: 'exit', e: this.endOfStmt() ? undefined : this.expr() };
    }
    if (this.is('delete')) {
      this.next();
      const name = this.next().v;
      if (this.is('[')) { this.next(); const keys = this.exprList(']'); this.eat(']'); return { k: 'delete', name, keys }; }
      return { k: 'delete', name };
    }
    return this.simple();
  }

  private endOfStmt() {
    const t = this.peek();
    return t.t === 'nl' || t.t === 'eof' || this.is(';') || this.is('}');
  }

  private simple(): Stmt {
    if (this.is('print') || this.is('printf')) {
      const kind = this.next().v as 'print' | 'printf';
      let args: Expr[] = [];
      if (!this.endOfStmt() && !this.is('>') && !this.is('|')) {
        if (this.is('(')) {
          // print (a, b) or print (a)(b): try the parenthesised list first.
          const save = this.i;
          this.next();
          const list = this.exprList(')', true);
          if (this.is(')')) {
            this.next();
            if (this.endOfStmt() || this.is('>') || this.is('|')) args = list;
            else { this.i = save; args = this.exprList(null, true); }
          } else { this.i = save; args = this.exprList(null, true); }
        } else args = this.exprList(null, true);
      }
      if (this.is('>') || this.is('>>') || this.is('|')) throw new AwkError('print redirection is not supported here; pipe the output instead');
      return { k: kind, args };
    }
    return { k: 'expr', e: this.expr() };
  }

  private exprList(end: string | null, noGt = false): Expr[] {
    const out: Expr[] = [];
    if (end && this.is(end)) return out;
    out.push(this.expr(noGt));
    while (this.is(',')) { this.next(); this.nls(); out.push(this.expr(noGt)); }
    return out;
  }

  // Precedence, lowest first: ?: || && in ~ comparison concatenation additive multiplicative unary ^ postfix $
  expr(noGt = false): Expr { return this.ternary(noGt); }

  private ternary(noGt: boolean): Expr {
    const c = this.assign(noGt);
    if (this.is('?')) {
      this.next(); this.nls();
      const a = this.ternary(noGt);
      this.nls(); this.eat(':'); this.nls();
      return { k: 'cond', c, a, b: this.ternary(noGt) };
    }
    return c;
  }

  private assign(noGt: boolean): Expr {
    const left = this.or(noGt);
    const t = this.peek();
    if (t.t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '^='].includes(t.v) && (left.k === 'var' || left.k === 'field' || left.k === 'idx')) {
      this.next(); this.nls();
      return { k: 'assign', op: t.v, target: left, e: this.ternary(noGt) };
    }
    return left;
  }

  private or(noGt: boolean): Expr {
    let a = this.and(noGt);
    while (this.is('||')) { this.next(); this.nls(); a = { k: 'bin', op: '||', a, b: this.and(noGt) }; }
    return a;
  }

  private and(noGt: boolean): Expr {
    let a = this.inop(noGt);
    while (this.is('&&')) { this.next(); this.nls(); a = { k: 'bin', op: '&&', a, b: this.inop(noGt) }; }
    return a;
  }

  private inop(noGt: boolean): Expr {
    let a = this.match(noGt);
    while (this.is('in') && this.peek(1).t === 'name') {
      this.next();
      a = { k: 'in', keys: a.k === 'group' && (a as { e: Expr }).e ? [a.e] : [a], name: this.next().v };
    }
    return a;
  }

  private match(noGt: boolean): Expr {
    let a = this.compare(noGt);
    while (this.is('~') || this.is('!~')) {
      const neg = this.next().v === '!~';
      a = { k: 'match', neg, a, re: this.compare(noGt) };
    }
    return a;
  }

  private compare(noGt: boolean): Expr {
    const a = this.concat(noGt);
    const t = this.peek();
    if (t.t === 'op' && ['<', '<=', '==', '!=', '>=', ...(noGt ? [] : ['>'])].includes(t.v)) {
      this.next();
      return { k: 'bin', op: t.v, a, b: this.concat(noGt) };
    }
    return a;
  }

  private startsOperand() {
    const t = this.peek();
    if (t.t === 'num' || t.t === 'str' || t.t === 're' || t.t === 'func') return true;
    if (t.t === 'name') return !KEYWORDS.has(t.v) || t.v === 'getline';
    if (t.t === 'op') return ['$', '(', '!', '-', '+', '++', '--'].includes(t.v);
    return false;
  }

  private concat(noGt: boolean): Expr {
    let a = this.additive();
    while (this.startsOperand() && !this.is('in')) {
      // "a -1" is subtraction, not concatenation; additive() has already taken it.
      a = { k: 'bin', op: 'concat', a, b: this.additive() };
    }
    void noGt;
    return a;
  }

  private additive(): Expr {
    let a = this.mult();
    while (this.is('+') || this.is('-')) { const op = this.next().v; a = { k: 'bin', op, a, b: this.mult() }; }
    return a;
  }

  private mult(): Expr {
    let a = this.unary();
    while (this.is('*') || this.is('/') || this.is('%')) { const op = this.next().v; a = { k: 'bin', op, a, b: this.unary() }; }
    return a;
  }

  private unary(): Expr {
    if (this.is('!')) { this.next(); return { k: 'un', op: '!', e: this.unary() }; }
    if (this.is('-')) { this.next(); return { k: 'un', op: '-', e: this.unary() }; }
    if (this.is('+')) { this.next(); return { k: 'un', op: '+', e: this.unary() }; }
    return this.power();
  }

  private power(): Expr {
    const a = this.postfix();
    if (this.is('^')) { this.next(); return { k: 'bin', op: '^', a, b: this.unary() }; }
    return a;
  }

  private postfix(): Expr {
    if (this.is('++') || this.is('--')) {
      const op = this.next().v as '++' | '--';
      return { k: 'incdec', op, prefix: true, target: this.postfix() };
    }
    const e = this.primary();
    if ((this.is('++') || this.is('--')) && (e.k === 'var' || e.k === 'field' || e.k === 'idx')) {
      return { k: 'incdec', op: this.next().v as '++' | '--', prefix: false, target: e };
    }
    return e;
  }

  private primary(): Expr {
    const t = this.next();
    switch (t.t) {
      case 'num': return { k: 'num', v: Number(t.v) };
      case 'str': return { k: 'str', v: t.v };
      case 're': return { k: 're', v: t.v };
      case 'func': {
        this.eat('(');
        const args = this.exprList(')');
        this.eat(')');
        return { k: 'call', name: t.v, args };
      }
      case 'name': {
        if (t.v === 'length' && !this.is('(')) return { k: 'call', name: 'length', args: [] };
        if (KEYWORDS.has(t.v)) throw new AwkError(`syntax error at '${t.v}'`);
        if (this.is('[')) {
          this.next();
          const keys = this.exprList(']');
          this.eat(']');
          return { k: 'idx', name: t.v, keys };
        }
        return { k: 'var', name: t.v };
      }
      case 'op':
        if (t.v === '$') return { k: 'field', e: this.primaryForField() };
        if (t.v === '(') {
          const e = this.expr();
          if (this.is(',')) {
            // (a, b) in arr
            const keys = [e];
            while (this.is(',')) { this.next(); keys.push(this.expr()); }
            this.eat(')');
            if (!this.is('in')) throw new AwkError('syntax error: grouping');
            this.next();
            return { k: 'in', keys, name: this.next().v };
          }
          this.eat(')');
          return { k: 'group', e };
        }
        if (t.v === '-' || t.v === '!' || t.v === '+') { this.i--; return this.unary(); }
        break;
    }
    throw new AwkError(`syntax error at '${t.v || 'end of program'}'`);
  }

  private primaryForField(): Expr {
    if (this.is('++') || this.is('--')) return this.postfix();
    if (this.is('-')) { this.next(); return { k: 'un', op: '-', e: this.primaryForField() }; }
    return this.primary();
  }
}

class Next {}
class Exit { constructor(public code: number) {} }
class Break {}
class Continue {}

const looksNumeric = (s: string) => /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(s);

/** How awk prints a number: integers as integers, others with up to six significant digits. */
export function numStr(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e16) return String(n);
  if (!isFinite(n)) return n > 0 ? 'inf' : n < 0 ? '-inf' : 'nan';
  const g = Number(n.toPrecision(6));
  return String(g);
}
const str = (v: Val): string => (typeof v === 'number' ? numStr(v) : v instanceof SN ? v.s : v);
const num = (v: Val): number => (typeof v === 'number' ? v : toNum(v instanceof SN ? v.s : v));
const isNum = (v: Val) => typeof v === 'number' || (v instanceof SN && looksNumeric(v.s));
const truthy = (v: Val) => (typeof v === 'number' ? v !== 0 : v instanceof SN ? (looksNumeric(v.s) ? toNum(v.s) !== 0 : v.s !== '') : v !== '');

export interface AwkOptions { fs?: string; vars?: Record<string, string> }

export function awk(program: string, inputs: { name: string; text: string }[], opts: AwkOptions = {}): string {
  const rules = new Parser(lex(program)).program();
  const vars = new Map<string, Val>();
  const arrays = new Map<string, Map<string, Val>>();
  let out = '';
  let fields: string[] = [''];
  let nr = 0;
  let fnr = 0;
  let steps = 0;
  const rangeOn = new Map<Rule, boolean>();

  vars.set('FS', opts.fs ?? ' ');
  vars.set('OFS', ' ');
  vars.set('ORS', '\n');
  vars.set('SUBSEP', '\x1c');
  vars.set('RSTART', 0);
  vars.set('RLENGTH', -1);
  for (const [k, v] of Object.entries(opts.vars ?? {})) vars.set(k, new SN(v));

  const array = (name: string) => {
    let a = arrays.get(name);
    if (!a) { a = new Map(); arrays.set(name, a); }
    return a;
  };

  const splitFields = (line: string): string[] => {
    const fs = str(vars.get('FS') ?? ' ');
    if (fs === ' ') return line.trim() === '' ? [] : line.trim().split(/[ \t\n]+/);
    if (line === '') return [];
    if (fs.length === 1 && fs !== '\\') return line.split(fs === '|' ? '|' : fs);
    const re = makeRegex(posixRegex(fs, true), '');
    return typeof re === 'string' ? line.split(fs) : line.split(re);
  };

  const setRecord = (line: string) => { fields = [line, ...splitFields(line)]; };
  const rebuild = () => { fields[0] = fields.slice(1).join(str(vars.get('OFS') ?? ' ')); };

  const getVar = (name: string): Val => {
    switch (name) {
      case 'NR': return nr;
      case 'FNR': return fnr;
      case 'NF': return fields.length - 1;
      default: return vars.get(name) ?? '';
    }
  };

  const key = (keys: Expr[]) => keys.map(k => str(ev(k))).join(str(vars.get('SUBSEP') ?? '\x1c'));

  const toRegex = (e: Expr): RegExp => {
    const src = e.k === 're' ? e.v : str(ev(e));
    const re = makeRegex(posixRegex(src, true), '');
    if (typeof re === 'string') throw new AwkError(`${re}: /${src}/`);
    return re;
  };

  const compare = (op: string, a: Expr, b: Expr): number => {
    const x = ev(a);
    const y = ev(b);
    let c: number;
    if (isNum(x) && isNum(y)) c = num(x) - num(y);
    else { const xs = str(x); const ys = str(y); c = xs < ys ? -1 : xs > ys ? 1 : 0; }
    switch (op) {
      case '<': return c < 0 ? 1 : 0;
      case '<=': return c <= 0 ? 1 : 0;
      case '>': return c > 0 ? 1 : 0;
      case '>=': return c >= 0 ? 1 : 0;
      case '==': return c === 0 ? 1 : 0;
      default: return c !== 0 ? 1 : 0;
    }
  };

  const store = (target: Expr, v: Val) => {
    if (target.k === 'var') {
      if (target.name === 'NF') { const n = Math.max(0, Math.trunc(num(v))); fields = fields.slice(0, n + 1); while (fields.length < n + 1) fields.push(''); rebuild(); return; }
      if (target.name === 'NR') { nr = num(v); return; }
      vars.set(target.name, v);
    } else if (target.k === 'field') {
      const i = Math.trunc(num(ev(target.e)));
      if (i === 0) setRecord(str(v));
      else { while (fields.length <= i) fields.push(''); fields[i] = str(v); rebuild(); }
    } else if (target.k === 'idx') {
      array(target.name).set(key(target.keys), v);
    }
  };

  const load = (target: Expr): Val => ev(target);

  const subst = (args: Expr[], global: boolean): number => {
    const re = toRegex(args[0]);
    const rep = str(ev(args[1]));
    const target = args[2] ?? { k: 'field', e: { k: 'num', v: 0 } } as Expr;
    const before = str(load(target));
    let count = 0;
    const g = new RegExp(re.source, global ? 'g' : '');
    const after = before.replace(g, m => {
      count++;
      return rep.replace(/\\&|&/g, x => (x === '&' ? m : '&'));
    });
    if (count) store(target, after);
    return count;
  };

  const call = (name: string, args: Expr[]): Val => {
    switch (name) {
      case 'length': {
        if (!args.length) return fields[0].length;
        const a = args[0];
        if (a.k === 'var' && arrays.has(a.name)) return arrays.get(a.name)!.size;
        return str(ev(a)).length;
      }
      case 'substr': {
        const s = str(ev(args[0]));
        const m = Math.round(num(ev(args[1])));
        const n = args[2] ? Math.round(num(ev(args[2]))) : Infinity;
        const start = Math.max(m, 1);
        const end = n === Infinity ? s.length + 1 : m + n;
        return end <= start ? '' : s.slice(start - 1, end - 1);
      }
      case 'index': { const s = str(ev(args[0])); return s.indexOf(str(ev(args[1]))) + 1; }
      case 'split': {
        const s = str(ev(args[0]));
        const target = args[1];
        if (target.k !== 'var') throw new AwkError('split: second argument must be an array');
        const a = array(target.name);
        a.clear();
        let parts: string[];
        if (args[2]) {
          const sep = args[2].k === 're' ? args[2].v : str(ev(args[2]));
          parts = s === '' ? [] : sep === ' ' ? s.trim().split(/\s+/) : sep.length === 1 ? s.split(sep) : s.split(toRegex(args[2]));
        } else parts = splitFields(s);
        parts.forEach((p, i) => a.set(String(i + 1), new SN(p)));
        return parts.length;
      }
      case 'tolower': return str(ev(args[0])).toLowerCase();
      case 'toupper': return str(ev(args[0])).toUpperCase();
      case 'sub': return subst(args, false);
      case 'gsub': return subst(args, true);
      case 'match': {
        const s = str(ev(args[0]));
        const m = toRegex(args[1]).exec(s);
        vars.set('RSTART', m ? m.index + 1 : 0);
        vars.set('RLENGTH', m ? m[0].length : -1);
        return m ? m.index + 1 : 0;
      }
      case 'int': return Math.trunc(num(ev(args[0])));
      case 'sqrt': return Math.sqrt(num(ev(args[0])));
      case 'log': return Math.log(num(ev(args[0])));
      case 'exp': return Math.exp(num(ev(args[0])));
      case 'sin': return Math.sin(num(ev(args[0])));
      case 'cos': return Math.cos(num(ev(args[0])));
      case 'rand': return 0.5;
      case 'srand': return 0;
      case 'sprintf': {
        const vals = args.map(a => ev(a));
        return format(str(vals[0] ?? ''), vals.slice(1).map(v => (isNum(v) ? num(v) : str(v))), true);
      }
      case 'system': throw new AwkError('system() is not available on this workstation');
    }
    throw new AwkError(`unknown function ${name}`);
  };

  function ev(e: Expr): Val {
    if (++steps > 2_000_000) throw new AwkError('program ran too long');
    switch (e.k) {
      case 'num': return e.v;
      case 'str': return e.v;
      case 're': return toRegex(e).test(fields[0]) ? 1 : 0;
      case 'group': return ev(e.e);
      case 'var': return getVar(e.name);
      case 'field': {
        const i = Math.trunc(num(ev(e.e)));
        if (i < 0) throw new AwkError(`trying to access out of range field ${i}`);
        return new SN(fields[i] ?? '');
      }
      case 'idx': {
        const a = array(e.name);
        const k = key(e.keys);
        if (!a.has(k)) a.set(k, '');
        return a.get(k)!;
      }
      case 'in': return array(e.name).has(key(e.keys)) ? 1 : 0;
      case 'assign': {
        let v = ev(e.e);
        if (e.op !== '=') {
          const cur = num(load(e.target));
          const r = num(v);
          v = e.op === '+=' ? cur + r : e.op === '-=' ? cur - r : e.op === '*=' ? cur * r : e.op === '/=' ? div(cur, r) : e.op === '%=' ? cur % r : cur ** r;
        }
        store(e.target, v);
        return v;
      }
      case 'incdec': {
        const cur = num(load(e.target));
        const nv = e.op === '++' ? cur + 1 : cur - 1;
        store(e.target, nv);
        return e.prefix ? nv : cur;
      }
      case 'un': {
        if (e.op === '!') return truthy(ev(e.e)) ? 0 : 1;
        if (e.op === '-') return -num(ev(e.e));
        return num(ev(e.e));
      }
      case 'cond': return truthy(ev(e.c)) ? ev(e.a) : ev(e.b);
      case 'match': {
        const s = str(ev(e.a));
        const hit = toRegex(e.re).test(s);
        return (hit !== e.neg) ? 1 : 0;
      }
      case 'call': return call(e.name, e.args);
      case 'bin': {
        switch (e.op) {
          case '&&': return truthy(ev(e.a)) && truthy(ev(e.b)) ? 1 : 0;
          case '||': return truthy(ev(e.a)) || truthy(ev(e.b)) ? 1 : 0;
          case 'concat': return str(ev(e.a)) + str(ev(e.b));
          case '+': return num(ev(e.a)) + num(ev(e.b));
          case '-': return num(ev(e.a)) - num(ev(e.b));
          case '*': return num(ev(e.a)) * num(ev(e.b));
          case '/': return div(num(ev(e.a)), num(ev(e.b)));
          case '%': { const b = num(ev(e.b)); if (b === 0) throw new AwkError('division by zero in %'); return num(ev(e.a)) % b; }
          case '^': return num(ev(e.a)) ** num(ev(e.b));
          default: return compare(e.op, e.a, e.b);
        }
      }
    }
  }

  const div = (a: number, b: number) => {
    if (b === 0) throw new AwkError('division by zero');
    return a / b;
  };

  const exec = (s: Stmt): void => {
    switch (s.k) {
      case 'print': {
        const ofs = str(vars.get('OFS') ?? ' ');
        out += (s.args.length ? s.args.map(a => str(ev(a))).join(ofs) : fields[0]) + str(vars.get('ORS') ?? '\n');
        break;
      }
      case 'printf': {
        if (!s.args.length) throw new AwkError('printf: no format');
        const vals = s.args.map(a => ev(a));
        out += format(str(vals[0]), vals.slice(1).map(v => (isNum(v) ? num(v) : str(v))), true);
        break;
      }
      case 'expr': ev(s.e); break;
      case 'if': if (truthy(ev(s.c))) exec(s.a); else if (s.b) exec(s.b); break;
      case 'while':
        while (truthy(ev(s.c))) {
          try { exec(s.body); } catch (x) { if (x instanceof Break) break; if (x instanceof Continue) continue; throw x; }
        }
        break;
      case 'do':
        do {
          try { exec(s.body); } catch (x) { if (x instanceof Break) break; if (x instanceof Continue) continue; throw x; }
        } while (truthy(ev(s.c)));
        break;
      case 'for':
        if (s.init) exec(s.init);
        while (!s.c || truthy(ev(s.c))) {
          try { exec(s.body); } catch (x) { if (x instanceof Break) break; if (!(x instanceof Continue)) throw x; }
          if (s.step) exec(s.step);
          if (++steps > 2_000_000) throw new AwkError('program ran too long');
        }
        break;
      case 'forin':
        for (const k of [...array(s.arr).keys()]) {
          vars.set(s.v, k);
          try { exec(s.body); } catch (x) { if (x instanceof Break) break; if (x instanceof Continue) continue; throw x; }
        }
        break;
      case 'block': for (const b of s.body) exec(b); break;
      case 'next': throw new Next();
      case 'exit': throw new Exit(s.e ? num(ev(s.e)) : 0);
      case 'break': throw new Break();
      case 'continue': throw new Continue();
      case 'delete':
        if (s.keys) array(s.name).delete(key(s.keys));
        else array(s.name).clear();
        break;
    }
  };

  const runAction = (action: Stmt[] | undefined) => {
    if (!action) { out += fields[0] + str(vars.get('ORS') ?? '\n'); return; }
    for (const s of action) exec(s);
  };

  const matches = (r: Rule): boolean => {
    if (r.range) {
      if (rangeOn.get(r)) {
        if (truthy(ev(r.range))) rangeOn.set(r, false);
        return true;
      }
      if (r.pattern && truthy(ev(r.pattern))) {
        rangeOn.set(r, !truthy(ev(r.range)));
        return true;
      }
      return false;
    }
    return !r.pattern || truthy(ev(r.pattern));
  };

  const mains = rules.filter(r => r.kind === 'main');
  try {
    setRecord('');
    for (const r of rules) if (r.kind === 'begin') runAction(r.action);
    if (mains.length || rules.some(r => r.kind === 'end')) {
      outer: for (const input of inputs) {
        vars.set('FILENAME', input.name);
        fnr = 0;
        const text = input.text.endsWith('\n') ? input.text.slice(0, -1) : input.text;
        if (!input.text) continue;
        for (const line of text.split('\n')) {
          nr++; fnr++;
          setRecord(line);
          try {
            for (const r of mains) if (matches(r)) runAction(r.action);
          } catch (x) {
            if (x instanceof Next) continue;
            if (x instanceof Exit) break outer;
            throw x;
          }
        }
      }
    }
  } catch (x) {
    if (!(x instanceof Exit)) throw x;
  }
  try {
    for (const r of rules) if (r.kind === 'end') runAction(r.action);
  } catch (x) {
    if (!(x instanceof Exit)) throw x;
  }
  return out;
}
