/**
 * The commands on the analyst workstation. Each takes its arguments and standard input as text and returns its
 * output; errors go to the shell's error stream. Behaviour follows GNU coreutils closely enough that what you learn
 * here works on a real Linux box, including the error messages you will meet there.
 */

import { parse as parseShell } from './shell';
import type { Shell, Stdin, Result } from './shell';
import { awk, AwkError } from './awk';
import { escapeRe, format, globRegex, joinLines, lines, makeRegex, posixRegex, sha256, toNum, unescape } from './text';
import { HOME, Vfs } from './vfs';
import { DAY, hms } from './events';
import { NET_COMMANDS, NET_MAN } from './net';

export interface CmdCtx { sh: Shell; args: string[]; stdin: Stdin; name: string }
type Cmd = (c: CmdCtx) => Result;

const ok = (out = ''): Result => ({ out, code: 0 });
const fail = (c: CmdCtx, msg: string, code = 1): Result => { c.sh.err += `${c.name}: ${msg}\n`; return { out: '', code }; };

/** The rest of standard input, consumed. */
function readStdin(c: CmdCtx): string {
  const t = c.stdin.text.slice(c.stdin.pos);
  c.stdin.pos = c.stdin.text.length;
  return t;
}

interface Opts { flags: Set<string>; vals: Map<string, string[]>; rest: string[] }

/**
 * Short options the GNU way: -abc, -n 5, -n5, and -- to stop. `long` maps long names to short ones; `num` lets
 * -5 mean -n 5 (head and tail).
 */
function getopts(c: CmdCtx, flags: string, withVal: string, long: Record<string, string> = {}, num?: string): Opts | null {
  const o: Opts = { flags: new Set(), vals: new Map(), rest: [] };
  const add = (k: string, v: string) => o.vals.set(k, [...(o.vals.get(k) ?? []), v]);
  const a = c.args;
  for (let i = 0; i < a.length; i++) {
    const s = a[i];
    if (s === '--') { o.rest.push(...a.slice(i + 1)); break; }
    if (s.startsWith('--') && s.length > 2) {
      const [name, val] = s.slice(2).split(/=(.*)/s);
      const short = long[name];
      if (!short) { fail(c, `unrecognized option '${s}'\nTry 'man ${c.name}' for the options this workstation supports.`, 2); return null; }
      if (withVal.includes(short)) {
        const v = val ?? a[++i];
        if (v === undefined) { fail(c, `option '--${name}' requires an argument`, 2); return null; }
        add(short, v);
      } else o.flags.add(short);
      continue;
    }
    if (s.startsWith('-') && s.length > 1) {
      if (num && /^-\d+$/.test(s)) { add(num, s.slice(1)); continue; }
      if (/^-\d/.test(s) && !flags.includes(s[1])) { o.rest.push(s); continue; }
      for (let j = 1; j < s.length; j++) {
        const ch = s[j];
        if (withVal.includes(ch)) {
          const v = j + 1 < s.length ? s.slice(j + 1) : a[++i];
          if (v === undefined) { fail(c, `option requires an argument -- '${ch}'`, 2); return null; }
          add(ch, v);
          break;
        }
        if (!flags.includes(ch)) { fail(c, `invalid option -- '${ch}'\nTry 'man ${c.name}' for the options this workstation supports.`, 2); return null; }
        o.flags.add(ch);
      }
      continue;
    }
    o.rest.push(s);
  }
  return o;
}

const last = (o: Opts, k: string) => o.vals.get(k)?.slice(-1)[0];

/** Reads each named file (or standard input for none or "-"), reporting missing ones. */
function inputs(c: CmdCtx, files: string[]): { name: string; text: string }[] | null {
  if (!files.length) return [{ name: '(standard input)', text: readStdin(c) }];
  const out: { name: string; text: string }[] = [];
  let bad = false;
  for (const f of files) {
    if (f === '-') { out.push({ name: '(standard input)', text: readStdin(c) }); continue; }
    const p = c.sh.vfs.resolve(c.sh.cwd, f);
    if (c.sh.vfs.isDir(p)) { c.sh.err += `${c.name}: ${f}: Is a directory\n`; bad = true; continue; }
    const t = c.sh.vfs.read(p);
    if (t === undefined) { c.sh.err += `${c.name}: ${f}: No such file or directory\n`; bad = true; continue; }
    out.push({ name: f, text: t });
  }
  return bad && !out.length ? null : out;
}

// ── Files and folders ─────────────────────────────────────────────────────

function lsLong(vfs: Vfs, path: string, name: string, human: boolean): string {
  const dir = vfs.isDir(path);
  const mine = vfs.writable(path);
  const f = vfs.file(path);
  const size = dir ? 4096 : (vfs.read(path) ?? '').length;
  const mode = dir ? 'drwxr-xr-x' : f?.exec ? '-rwxr-xr-x' : mine ? '-rw-r--r--' : '-rw-r-----';
  const owner = mine ? 'analyst analyst' : path.startsWith('/var/log') ? 'syslog  adm    ' : 'root    root   ';
  const t = dir ? 0 : vfs.mtime(path);
  const sz = human ? humanSize(size) : String(size);
  return `${mode} 1 ${owner} ${sz.padStart(human ? 5 : 8)} Nov  5 ${hms(t).slice(0, 5)} ${name}`;
}

function humanSize(n: number): string {
  if (n < 1024) return String(n);
  const units = ['K', 'M', 'G'];
  let v = n;
  let u = -1;
  while (v >= 1024 && u < 2) { v /= 1024; u++; }
  return (v < 10 ? v.toFixed(1) : String(Math.round(v))) + units[u];
}

const ls: Cmd = c => {
  const o = getopts(c, 'lahtr1RF', '', { all: 'a', 'human-readable': 'h' });
  if (!o) return { out: '', code: 2 };
  const { vfs } = c.sh;
  const targets = o.rest.length ? o.rest : ['.'];
  const blocks: string[] = [];
  let code = 0;
  const fileRows: string[] = [];
  for (const t of targets) {
    const p = vfs.resolve(c.sh.cwd, t);
    if (!vfs.exists(p)) { c.sh.err += `ls: cannot access '${t}': No such file or directory\n`; code = 2; continue; }
    if (!vfs.isDir(p)) { fileRows.push(o.flags.has('l') ? lsLong(vfs, p, t, o.flags.has('h')) : t); continue; }
    let names = vfs.list(p).filter(n => o.flags.has('a') || !n.startsWith('.'));
    if (o.flags.has('t')) names.sort((a, b) => vfs.mtime(`${p}/${b}`) - vfs.mtime(`${p}/${a}`));
    if (o.flags.has('r')) names = names.reverse();
    if (o.flags.has('a')) names = ['.', '..', ...names];
    const shown = names.map(n => (o.flags.has('F') && vfs.isDir(`${p}/${n}`) ? n + '/' : o.flags.has('F') && vfs.file(`${p}/${n}`)?.exec ? n + '*' : n));
    let body: string;
    if (o.flags.has('l')) body = joinLines([`total ${names.length * 4}`, ...names.map((n, i) => lsLong(vfs, n === '.' ? p : n === '..' ? Vfs.normalize(p + '/..') : `${p}/${n}`, shown[i], o.flags.has('h')))]);
    else if (o.flags.has('1') || !c.sh.tty) body = joinLines(shown);
    else body = shown.length ? shown.join('  ') + '\n' : '';
    blocks.push(targets.length > 1 ? `${t}:\n${body}` : body);
  }
  const files = fileRows.length ? (o.flags.has('l') || !c.sh.tty ? joinLines(fileRows) : fileRows.join('  ') + '\n') : '';
  return { out: files + (files && blocks.length ? '\n' : '') + blocks.join('\n'), code };
};

const cd: Cmd = c => {
  const target = c.args[0] === undefined || c.args[0] === '~' ? HOME : c.args[0] === '-' ? c.sh.vars.get('OLDPWD') ?? c.sh.cwd : c.args[0];
  const p = c.sh.vfs.resolve(c.sh.cwd, target);
  if (!c.sh.vfs.exists(p)) return fail(c, `${target}: No such file or directory`);
  if (!c.sh.vfs.isDir(p)) return fail(c, `${target}: Not a directory`);
  c.sh.vars.set('OLDPWD', c.sh.cwd);
  c.sh.cwd = p;
  return ok(c.args[0] === '-' ? p + '\n' : '');
};

const cat: Cmd = c => {
  const o = getopts(c, 'nAE', '', { number: 'n' });
  if (!o) return { out: '', code: 2 };
  const ins = inputs(c, o.rest);
  if (!ins) return { out: '', code: 1 };
  let text = ins.map(i => i.text).join('');
  if (o.flags.has('n')) text = joinLines(lines(text).map((l, i) => `${String(i + 1).padStart(6)}\t${l}`));
  return { out: text, code: c.sh.err ? 1 : 0 };
};

const tac: Cmd = c => {
  const ins = inputs(c, c.args);
  if (!ins) return { out: '', code: 1 };
  return ok(joinLines(lines(ins.map(i => i.text).join('')).reverse()));
};

const headTail = (tail: boolean): Cmd => c => {
  const o = getopts(c, 'qvfF', 'nc', { lines: 'n', bytes: 'c', quiet: 'q', follow: 'f' }, 'n');
  if (!o) return { out: '', code: 2 };
  const nArg = last(o, 'n') ?? '10';
  const from = tail && nArg.startsWith('+');
  const n = Math.abs(parseInt(nArg, 10));
  if (isNaN(n)) return fail(c, `invalid number of lines: '${nArg}'`);
  const ins = inputs(c, o.rest);
  if (!ins) return { out: '', code: 1 };
  const bytes = last(o, 'c');
  const parts = ins.map(i => {
    let body: string;
    if (bytes !== undefined) {
      const b = parseInt(bytes, 10);
      body = tail ? i.text.slice(-b) : i.text.slice(0, b);
    } else {
      const ls = lines(i.text);
      const neg = !tail && nArg.startsWith('-');
      body = joinLines(tail ? (from ? ls.slice(Math.max(0, n - 1)) : ls.slice(Math.max(0, ls.length - n))) : neg ? ls.slice(0, Math.max(0, ls.length - n)) : ls.slice(0, n));
    }
    return ins.length > 1 && !o.flags.has('q') ? `==> ${i.name} <==\n${body}` : body;
  });
  return { out: parts.join(ins.length > 1 ? '\n' : ''), code: c.sh.err ? 1 : 0 };
};

const touch: Cmd = c => {
  let code = 0;
  for (const f of c.args.filter(a => !a.startsWith('-'))) {
    const p = c.sh.vfs.resolve(c.sh.cwd, f);
    if (c.sh.vfs.exists(p)) continue;
    const e = c.sh.vfs.write(p, '');
    if (e) { c.sh.err += `touch: cannot touch '${f}': ${e.split(': ').pop()}\n`; code = 1; }
  }
  return { out: '', code };
};

const mkdir: Cmd = c => {
  const o = getopts(c, 'pv', '', { parents: 'p' });
  if (!o) return { out: '', code: 2 };
  let code = 0;
  for (const d of o.rest) {
    const p = c.sh.vfs.resolve(c.sh.cwd, d);
    if (o.flags.has('p')) {
      if (!c.sh.vfs.writable(p)) { c.sh.err += `mkdir: cannot create directory '${d}': Permission denied\n`; code = 1; continue; }
      c.sh.vfs.mkdirp(p);
      continue;
    }
    const e = c.sh.vfs.mkdir(p);
    if (e) { c.sh.err += `mkdir: ${e}\n`; code = 1; }
  }
  return { out: '', code };
};

const rm: Cmd = c => {
  const o = getopts(c, 'rRfiv', '', { recursive: 'r', force: 'f' });
  if (!o) return { out: '', code: 2 };
  let code = 0;
  for (const f of o.rest) {
    const p = c.sh.vfs.resolve(c.sh.cwd, f);
    if (!c.sh.vfs.exists(p) && o.flags.has('f')) continue;
    const e = c.sh.vfs.remove(p, o.flags.has('r') || o.flags.has('R'));
    if (e) { c.sh.err += `rm: ${e}\n`; code = 1; }
  }
  return { out: '', code };
};

const cpmv = (move: boolean): Cmd => c => {
  const o = getopts(c, 'rRfiv', '');
  if (!o) return { out: '', code: 2 };
  if (o.rest.length < 2) return fail(c, `missing destination file operand after '${o.rest[0] ?? ''}'`);
  const { vfs } = c.sh;
  const srcs = o.rest.slice(0, -1);
  const destArg = o.rest[o.rest.length - 1];
  const dest = vfs.resolve(c.sh.cwd, destArg);
  let code = 0;
  for (const s of srcs) {
    const p = vfs.resolve(c.sh.cwd, s);
    const text = vfs.read(p);
    if (text === undefined) { c.sh.err += `${c.name}: cannot stat '${s}': ${vfs.isDir(p) ? 'Is a directory (copying folders is not supported here)' : 'No such file or directory'}\n`; code = 1; continue; }
    const target = vfs.isDir(dest) ? `${dest}/${p.split('/').pop()}` : dest;
    const e = vfs.write(target, text);
    if (e) { c.sh.err += `${c.name}: cannot create regular file '${destArg}': ${e.split(': ').pop()}\n`; code = 1; continue; }
    if (vfs.file(p)?.exec) vfs.setExec(target, true);
    if (move) {
      const r = vfs.remove(p);
      if (r) { c.sh.err += `mv: ${r}\n`; code = 1; }
    }
  }
  return { out: '', code };
};

const chmod: Cmd = c => {
  const [mode, ...files] = c.args.filter(a => a !== '-R');
  if (!mode || !files.length) return fail(c, 'missing operand');
  const on = /^\d+$/.test(mode) ? (parseInt(mode[0], 8) & 1) === 1 : /\+[rw]*x/.test(mode) ? true : /-[rw]*x/.test(mode) ? false : undefined;
  let code = 0;
  for (const f of files) {
    const e = c.sh.vfs.setExec(c.sh.vfs.resolve(c.sh.cwd, f), on ?? !!c.sh.vfs.file(c.sh.vfs.resolve(c.sh.cwd, f))?.exec);
    if (e) { c.sh.err += `chmod: ${e}\n`; code = 1; }
  }
  return { out: '', code };
};

const find: Cmd = c => {
  const { vfs } = c.sh;
  const a = c.args;
  const roots: string[] = [];
  let i = 0;
  while (i < a.length && !a[i].startsWith('-') && a[i] !== '!' && a[i] !== '(') roots.push(a[i++]);
  if (!roots.length) roots.push('.');
  const tests: ((p: string, depth: number) => boolean)[] = [];
  let maxDepth = Infinity;
  let minDepth = 0;
  let negate = false;
  while (i < a.length) {
    const t = a[i++];
    const v = a[i];
    const add = (fn: (p: string, d: number) => boolean) => { const n = negate; tests.push((p, d) => fn(p, d) !== n); negate = false; };
    switch (t) {
      case '!': case '-not': negate = true; break;
      case '-name': add(p => globRegex(v).test(p.split('/').pop() ?? '')); i++; break;
      case '-iname': add(p => new RegExp(globRegex(v).source, 'i').test(p.split('/').pop() ?? '')); i++; break;
      case '-path': add(p => globRegex(v).test(p)); i++; break;
      case '-type': add(p => (v === 'd' ? vfs.isDir(p) : v === 'f' ? vfs.isFile(p) : false)); i++; break;
      case '-maxdepth': maxDepth = Number(v); i++; break;
      case '-mindepth': minDepth = Number(v); i++; break;
      case '-size': {
        const m = /^([+-]?)(\d+)([ckMG]?)$/.exec(v ?? '');
        if (!m) return fail(c, `invalid argument '${v}' to '-size'`);
        const mult = { c: 1, k: 1024, M: 1024 ** 2, G: 1024 ** 3, '': 512 }[m[3]] ?? 1;
        const n = Number(m[2]) * mult;
        add(p => { const s = (vfs.read(p) ?? '').length; return m[1] === '+' ? s > n : m[1] === '-' ? s < n : Math.ceil(s / mult) === Number(m[2]); });
        i++;
        break;
      }
      case '-print': break;
      case '-exec': return fail(c, '-exec is not supported here; pipe the list into xargs instead');
      default: return fail(c, `unknown predicate '${t}'`);
    }
  }
  const out: string[] = [];
  let code = 0;
  for (const r of roots) {
    const base = vfs.resolve(c.sh.cwd, r);
    if (!vfs.exists(base)) { c.sh.err += `find: '${r}': No such file or directory\n`; code = 1; continue; }
    for (const p of vfs.walk(base)) {
      const rel = p === base ? r : (r.endsWith('/') ? r.slice(0, -1) : r) + p.slice(base === '/' ? 0 : base.length);
      const depth = p === base ? 0 : p.slice(base.length).split('/').filter(Boolean).length;
      if (depth > maxDepth || depth < minDepth) continue;
      if (tests.every(t => t(p, depth))) out.push(rel);
    }
  }
  return { out: joinLines(out), code };
};

// ── Searching and slicing text ────────────────────────────────────────────

const grep: Cmd = c => {
  const o = getopts(c, 'ivcnoEFwxhHlLrRqsPZa', 'eABCmf', {
    'ignore-case': 'i', 'invert-match': 'v', count: 'c', 'line-number': 'n', 'only-matching': 'o', 'extended-regexp': 'E',
    'fixed-strings': 'F', 'word-regexp': 'w', 'line-regexp': 'x', 'no-filename': 'h', 'with-filename': 'H', 'files-with-matches': 'l',
    recursive: 'r', quiet: 'q', regexp: 'e', 'max-count': 'm', after: 'A', before: 'B', context: 'C', color: 'a', colour: 'a',
  });
  if (!o) return { out: '', code: 2 };
  if (c.name === 'egrep') o.flags.add('E');
  if (c.name === 'fgrep') o.flags.add('F');
  const f = o.flags;
  let pats = o.vals.get('e') ?? [];
  let files = o.rest;
  if (o.vals.has('f')) {
    const t = c.sh.vfs.read(c.sh.vfs.resolve(c.sh.cwd, last(o, 'f')!));
    if (t === undefined) return fail(c, `${last(o, 'f')}: No such file or directory`, 2);
    pats = [...pats, ...lines(t)];
  }
  if (!pats.length) {
    if (!files.length) { c.sh.err += "Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'man grep' for more information.\n"; return { out: '', code: 2 }; }
    pats = [files[0]];
    files = files.slice(1);
  }
  const recursive = f.has('r') || f.has('R');
  if (recursive && !files.length) files = ['.'];
  const { vfs } = c.sh;
  const srcs: { name: string; text: string }[] = [];
  let code = 0;
  if (!files.length) srcs.push({ name: '(standard input)', text: readStdin(c) });
  for (const file of files) {
    const p = vfs.resolve(c.sh.cwd, file);
    if (vfs.isDir(p)) {
      if (!recursive) { c.sh.err += `grep: ${file}: Is a directory\n`; continue; }
      for (const q of vfs.walk(p)) if (vfs.isFile(q)) srcs.push({ name: (file.endsWith('/') ? file.slice(0, -1) : file) + q.slice(p === '/' ? 0 : p.length), text: vfs.read(q) ?? '' });
      continue;
    }
    const text = file === '-' ? readStdin(c) : vfs.read(p);
    if (text === undefined) { if (!f.has('s')) c.sh.err += `grep: ${file}: No such file or directory\n`; code = 2; continue; }
    srcs.push({ name: file, text });
  }
  const sources = pats.map(p => {
    let src = f.has('F') ? escapeRe(p) : posixRegex(p, f.has('E') || f.has('P'));
    if (f.has('w')) src = `(?<![\\w])(?:${src})(?![\\w])`;
    if (f.has('x')) src = `^(?:${src})$`;
    return src;
  });
  const re = makeRegex(sources.map(s => `(?:${s})`).join('|'), f.has('i') ? 'i' : '');
  if (typeof re === 'string') return fail(c, `${re}: ${pats.join(' ')}`, 2);
  const reG = new RegExp(re.source, re.flags + 'g');
  const prefix = (f.has('H') || srcs.length > 1 || recursive) && !f.has('h');
  const max = o.vals.has('m') ? Number(last(o, 'm')) : Infinity;
  const after = Number(last(o, 'A') ?? last(o, 'C') ?? 0);
  const before = Number(last(o, 'B') ?? last(o, 'C') ?? 0);
  const out: string[] = [];
  let any = false;
  for (const s of srcs) {
    const ls = lines(s.text);
    let count = 0;
    let lastPrinted = -1;
    let afterLeft = 0;
    const pre = (n: number, sep: string) => (prefix ? s.name + sep : '') + (f.has('n') ? n + 1 + sep : '');
    for (let i = 0; i < ls.length && count < max; i++) {
      const hit = re.test(ls[i]) !== f.has('v');
      if (hit) {
        count++;
        any = true;
        if (f.has('c') || f.has('l') || f.has('L') || f.has('q')) continue;
        if ((before || after) && lastPrinted >= 0 && i - before > lastPrinted + 1) out.push('--');
        for (let b = Math.max(lastPrinted + 1, i - before); b < i; b++) out.push(pre(b, '-') + ls[b]);
        if (f.has('o') && !f.has('v')) {
          for (const m of ls[i].matchAll(reG)) if (m[0]) out.push(pre(i, ':') + m[0]);
        } else out.push(pre(i, ':') + ls[i]);
        lastPrinted = i;
        afterLeft = after;
      } else if (afterLeft > 0 && !f.has('c')) {
        out.push(pre(i, '-') + ls[i]);
        lastPrinted = i;
        afterLeft--;
      }
    }
    if (f.has('c')) out.push((prefix ? s.name + ':' : '') + count);
    if (f.has('l') && count) out.push(s.name);
    if (f.has('L') && !count) out.push(s.name);
  }
  if (f.has('q')) return { out: '', code: any ? 0 : 1 };
  return { out: joinLines(out), code: code === 2 && !any ? 2 : any ? 0 : 1 };
};

function sortKey(line: string, sep: string | undefined, start: number, end: number | undefined): string {
  const fields = sep !== undefined ? line.split(sep) : line.trimStart().split(/[ \t]+/);
  return fields.slice(start - 1, end ?? fields.length).join(sep ?? ' ');
}

const sort: Cmd = c => {
  const o = getopts(c, 'nrufbhVsMR', 'kto', { numeric: 'n', 'numeric-sort': 'n', reverse: 'r', unique: 'u', 'ignore-case': 'f', key: 'k', 'field-separator': 't', 'human-numeric-sort': 'h', output: 'o' });
  if (!o) return { out: '', code: 2 };
  const ins = inputs(c, o.rest);
  if (!ins) return { out: '', code: 2 };
  const sep = last(o, 't');
  if (sep !== undefined && sep.length !== 1) return fail(c, 'multi-character tab', 2);
  const g = o.flags;
  const human = (s: string) => { const m = /^\s*([-+]?\d*\.?\d+)\s*([KMGT]?)/i.exec(s); return m ? Number(m[1]) * 1024 ** ' KMGT'.indexOf((m[2] || ' ').toUpperCase()) : 0; };
  const keys = (o.vals.get('k') ?? []).map(k => {
    const m = /^(\d+)(?:\.\d+)?([a-zA-Z]*)(?:,(\d+)(?:\.\d+)?([a-zA-Z]*))?$/.exec(k);
    if (!m) return null;
    const mods = (m[2] ?? '') + (m[4] ?? '');
    return { start: Number(m[1]), end: m[3] ? Number(m[3]) : undefined, n: mods.includes('n') || (!mods && g.has('n')), h: mods.includes('h') || (!mods && g.has('h')), r: mods.includes('r') || (!mods && g.has('r')), f: mods.includes('f') || (!mods && g.has('f')) };
  });
  if (keys.some(k => !k)) return fail(c, `invalid key: '${(o.vals.get('k') ?? []).join(' ')}'`, 2);
  const ks = keys.length ? keys as NonNullable<typeof keys[0]>[] : [{ start: 1, end: undefined as number | undefined, n: g.has('n'), h: g.has('h'), r: g.has('r'), f: g.has('f'), whole: true }];
  const cmp1 = (a: string, b: string, k: typeof ks[0]) => {
    const x = (k as { whole?: boolean }).whole ? a : sortKey(a, sep, k.start, k.end);
    const y = (k as { whole?: boolean }).whole ? b : sortKey(b, sep, k.start, k.end);
    let r: number;
    if (k.n) r = toNum(x) - toNum(y);
    else if (k.h) r = human(x) - human(y);
    else { const xs = k.f ? x.toUpperCase() : x; const ys = k.f ? y.toUpperCase() : y; r = xs < ys ? -1 : xs > ys ? 1 : 0; }
    return k.r ? -r : r;
  };
  const all = lines(ins.map(i => i.text).join(''));
  const cmp = (a: string, b: string) => {
    for (const k of ks) { const r = cmp1(a, b, k); if (r) return r; }
    if (g.has('u') || g.has('s')) return 0;
    const r = a < b ? -1 : a > b ? 1 : 0;
    return g.has('r') ? -r : r;
  };
  let sorted = [...all].sort(cmp);
  if (g.has('u')) sorted = sorted.filter((l, i) => i === 0 || cmp(sorted[i - 1], l) !== 0);
  const text = joinLines(sorted);
  const outFile = last(o, 'o');
  if (outFile) {
    const e = c.sh.vfs.write(c.sh.vfs.resolve(c.sh.cwd, outFile), text);
    if (e) return fail(c, e, 2);
    return ok();
  }
  return ok(text);
};

const uniq: Cmd = c => {
  const o = getopts(c, 'cdui', 'f', { count: 'c', repeated: 'd', unique: 'u', 'ignore-case': 'i', 'skip-fields': 'f' });
  if (!o) return { out: '', code: 2 };
  const ins = inputs(c, o.rest.slice(0, 1));
  if (!ins) return { out: '', code: 1 };
  const skip = Number(last(o, 'f') ?? 0);
  const key = (l: string) => {
    let k = skip ? l.trimStart().split(/[ \t]+/).slice(skip).join(' ') : l;
    if (o.flags.has('i')) k = k.toLowerCase();
    return k;
  };
  const out: string[] = [];
  const ls = lines(ins[0].text);
  for (let i = 0; i < ls.length;) {
    let j = i + 1;
    while (j < ls.length && key(ls[j]) === key(ls[i])) j++;
    const n = j - i;
    if ((!o.flags.has('d') || n > 1) && (!o.flags.has('u') || n === 1)) out.push(o.flags.has('c') ? `${String(n).padStart(7)} ${ls[i]}` : ls[i]);
    i = j;
  }
  return ok(joinLines(out));
};

function ranges(spec: string): ((n: number) => boolean) | null {
  const parts = spec.split(',').map(p => {
    const m = /^(\d*)(-?)(\d*)$/.exec(p);
    if (!m || (!m[1] && !m[3])) return null;
    const lo = m[1] ? Number(m[1]) : 1;
    const hi = m[2] ? (m[3] ? Number(m[3]) : Infinity) : lo;
    return (n: number) => n >= lo && n <= hi;
  });
  if (parts.some(p => !p)) return null;
  return n => parts.some(p => p!(n));
}

const cut: Cmd = c => {
  const o = getopts(c, 's', 'dfcb', { delimiter: 'd', fields: 'f', characters: 'c', bytes: 'b', 'only-delimited': 's', 'output-delimiter': 'O' });
  if (!o) return { out: '', code: 2 };
  const d = last(o, 'd') ?? '\t';
  if (d.length !== 1) return fail(c, 'the delimiter must be a single character');
  const fspec = last(o, 'f');
  const cspec = last(o, 'c') ?? last(o, 'b');
  if (!fspec && !cspec) return fail(c, 'you must specify a list of bytes, characters, or fields');
  const sel = ranges((fspec ?? cspec)!);
  if (!sel) return fail(c, `invalid field value '${fspec ?? cspec}'`);
  const ins = inputs(c, o.rest);
  if (!ins) return { out: '', code: 1 };
  const out = lines(ins.map(i => i.text).join('')).flatMap(l => {
    if (cspec) return [[...l].filter((_, i) => sel(i + 1)).join('')];
    if (!l.includes(d)) return o.flags.has('s') ? [] : [l];
    return [l.split(d).filter((_, i) => sel(i + 1)).join(d)];
  });
  return { out: joinLines(out), code: c.sh.err ? 1 : 0 };
};

const wc: Cmd = c => {
  const o = getopts(c, 'lwcm', '', { lines: 'l', words: 'w', bytes: 'c', chars: 'm' });
  if (!o) return { out: '', code: 2 };
  const ins = inputs(c, o.rest);
  if (!ins) return { out: '', code: 1 };
  const want = o.flags.size ? ['l', 'w', 'c'].filter(k => o.flags.has(k) || (k === 'c' && o.flags.has('m'))) : ['l', 'w', 'c'];
  const count = (t: string) => ({ l: (t.match(/\n/g) ?? []).length, w: t.split(/\s+/).filter(Boolean).length, c: new TextEncoder().encode(t).length } as Record<string, number>);
  const rows = ins.map(i => ({ name: o.rest.length ? i.name : '', n: count(i.text) }));
  if (rows.length > 1) rows.push({ name: 'total', n: { l: rows.reduce((s, r) => s + r.n['l'], 0), w: rows.reduce((s, r) => s + r.n['w'], 0), c: rows.reduce((s, r) => s + r.n['c'], 0) } });
  const single = want.length === 1 && rows.length === 1;
  const width = single ? 0 : Math.max(...rows.flatMap(r => want.map(k => String(r.n[k]).length)));
  return { out: joinLines(rows.map(r => [...want.map(k => String(r.n[k]).padStart(width)), r.name].filter(Boolean).join(' '))), code: c.sh.err ? 1 : 0 };
};

function trSet(spec: string): string[] {
  const s = spec.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
  const classes: Record<string, string> = {
    lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digit: '0123456789', space: ' \t\n\r\f\v', blank: ' \t',
    punct: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
  };
  classes['alpha'] = classes['lower'] + classes['upper'];
  classes['alnum'] = classes['alpha'] + classes['digit'];
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const m = /^\[:(\w+):\]/.exec(s.slice(i));
    if (m && classes[m[1]]) { out.push(...classes[m[1]]); i += m[0].length - 1; continue; }
    if (s[i + 1] === '-' && i + 2 < s.length) {
      for (let x = s.charCodeAt(i); x <= s.charCodeAt(i + 2); x++) out.push(String.fromCharCode(x));
      i += 2;
      continue;
    }
    out.push(s[i]);
  }
  return out;
}

const tr: Cmd = c => {
  const o = getopts(c, 'dscC', '', { delete: 'd', 'squeeze-repeats': 's', complement: 'c' });
  if (!o) return { out: '', code: 2 };
  if (!o.rest.length) return fail(c, 'missing operand');
  const text = readStdin(c);
  const s1 = new Set(trSet(o.rest[0]));
  const comp = o.flags.has('c') || o.flags.has('C');
  const in1 = (ch: string) => s1.has(ch) !== comp;
  let out = '';
  if (o.flags.has('d')) {
    for (const ch of text) if (!in1(ch)) out += ch;
    if (o.flags.has('s') && o.rest[1]) { const sq = new Set(trSet(o.rest[1])); out = out.replace(/(.)\1+/gs, (m, ch: string) => (sq.has(ch) ? ch : m)); }
    return ok(out);
  }
  if (o.rest[1] !== undefined) {
    const a = trSet(o.rest[0]);
    const b = trSet(o.rest[1]);
    const map = new Map<string, string>();
    a.forEach((ch, i) => map.set(ch, b[Math.min(i, b.length - 1)] ?? ''));
    for (const ch of text) out += comp ? (in1(ch) ? b[b.length - 1] : ch) : map.get(ch) ?? ch;
    if (o.flags.has('s')) { const sq = new Set(b); out = out.replace(/(.)\1+/gs, (m, ch: string) => (sq.has(ch) ? ch : m)); }
    return ok(out);
  }
  if (o.flags.has('s')) return ok(text.replace(/(.)\1+/gs, (m, ch: string) => (in1(ch) ? ch : m)));
  return fail(c, 'missing operand after the first set');
};

interface SedCmd { a1?: SedAddr; a2?: SedAddr; neg: boolean; cmd: string; re?: RegExp; rep?: string; global?: boolean; print?: boolean; nth?: number; text?: string }
type SedAddr = { line: number } | { last: true } | { re: RegExp };

function parseSed(script: string, ere: boolean): SedCmd[] | string {
  const out: SedCmd[] = [];
  let i = 0;
  const regexUntil = (delim: string): string => {
    let s = '';
    while (i < script.length && script[i] !== delim) {
      if (script[i] === '\\' && script[i + 1] === delim) { s += delim; i += 2; continue; }
      if (script[i] === '\\' && i + 1 < script.length) { s += script[i] + script[i + 1]; i += 2; continue; }
      s += script[i++];
    }
    if (script[i] !== delim) throw new Error(`unterminated address or command`);
    i++;
    return s;
  };
  const addr = (): SedAddr | undefined => {
    if (/\d/.test(script[i] ?? '')) { const m = /^\d+/.exec(script.slice(i))!; i += m[0].length; return { line: Number(m[0]) }; }
    if (script[i] === '$') { i++; return { last: true }; }
    if (script[i] === '/' || script[i] === '\\') {
      const d = script[i] === '\\' ? script[++i] : '/';
      i++;
      const r = makeRegex(posixRegex(regexUntil(d), ere), '');
      if (typeof r === 'string') throw new Error(r);
      return { re: r };
    }
    return undefined;
  };
  try {
    while (i < script.length) {
      while (/[\s;]/.test(script[i] ?? '')) i++;
      if (i >= script.length) break;
      const c: SedCmd = { neg: false, cmd: '' };
      c.a1 = addr();
      if (c.a1 && script[i] === ',') { i++; c.a2 = addr(); }
      while (script[i] === ' ') i++;
      if (script[i] === '!') { c.neg = true; i++; }
      c.cmd = script[i++] ?? '';
      if (c.cmd === 's' || c.cmd === 'y') {
        const d = script[i++];
        const pat = regexUntil(d);
        const rep = regexUntil(d);
        if (c.cmd === 'y') { c.text = pat + '\0' + rep; out.push(c); continue; }
        let flags = '';
        while (/[gipI0-9]/.test(script[i] ?? '')) flags += script[i++];
        const r = makeRegex(posixRegex(pat, ere), /[iI]/.test(flags) ? 'i' : '');
        if (typeof r === 'string') throw new Error(r);
        c.re = r;
        c.rep = rep;
        c.global = flags.includes('g');
        c.print = flags.includes('p');
        const n = /\d+/.exec(flags);
        c.nth = n ? Number(n[0]) : 1;
      } else if ('aic'.includes(c.cmd)) {
        while (script[i] === ' ' || script[i] === '\\') i++;
        const end = script.indexOf('\n', i);
        c.text = script.slice(i, end < 0 ? undefined : end).replace(/;$/, '');
        i = end < 0 ? script.length : end;
      } else if (!'dpqP=nNhHgGx'.includes(c.cmd) || !c.cmd) throw new Error(`unknown command: '${c.cmd}'`);
      out.push(c);
    }
  } catch (e) {
    return (e as Error).message;
  }
  return out;
}

const sed: Cmd = c => {
  const o = getopts(c, 'nErsi', 'e', { quiet: 'n', silent: 'n', 'regexp-extended': 'E', expression: 'e', 'in-place': 'i' });
  if (!o) return { out: '', code: 2 };
  const scripts = o.vals.get('e') ?? (o.rest.length ? [o.rest.shift()!] : []);
  if (!scripts.length) return fail(c, 'no script given. Example: sed \'s/old/new/g\' file');
  const prog = parseSed(scripts.join('\n'), o.flags.has('E') || o.flags.has('r'));
  if (typeof prog === 'string') return fail(c, `-e expression #1: ${prog}`);
  if (o.flags.has('i')) {
    for (const f of o.rest) {
      const p = c.sh.vfs.resolve(c.sh.cwd, f);
      if (!c.sh.vfs.writable(p)) return fail(c, `couldn't edit ${f}: Permission denied (logs are evidence: copy one to your home folder first)`, 4);
    }
  }
  const ins = inputs(c, o.rest);
  if (!ins) return { out: '', code: 2 };
  const run = (text: string) => {
    const ls = lines(text);
    const out: string[] = [];
    const active = new Map<SedCmd, boolean>();
    const hit = (a: SedAddr, n: number, l: string) => ('line' in a ? a.line === n + 1 : 'last' in a ? n === ls.length - 1 : a.re.test(l));
    let quit = false;
    for (let n = 0; n < ls.length && !quit; n++) {
      let l = ls[n];
      let deleted = false;
      const extra: string[] = [];
      for (const cmd of prog) {
        let sel = true;
        if (cmd.a1 && cmd.a2) {
          if (active.get(cmd)) { sel = true; if (hit(cmd.a2, n, l) || ('line' in cmd.a2 && n + 1 >= cmd.a2.line)) active.set(cmd, false); }
          else if (hit(cmd.a1, n, l)) { sel = true; active.set(cmd, !('line' in cmd.a2 && cmd.a2.line <= n + 1)); }
          else sel = false;
        } else if (cmd.a1) sel = hit(cmd.a1, n, l);
        if (cmd.neg) sel = !sel;
        if (!sel) continue;
        switch (cmd.cmd) {
          case 's': {
            let count = 0;
            let changed = false;
            const g = new RegExp(cmd.re!.source, cmd.re!.flags + 'g');
            l = l.replace(g, (...m: unknown[]) => {
              count++;
              if (!cmd.global && count !== cmd.nth) return m[0] as string;
              changed = true;
              const groups = m.slice(0, -2) as string[];
              return cmd.rep!.replace(/\\(\d)|\\n|\\t|\\&|&|\\\\/g, (x, d: string) =>
                x === '&' ? groups[0] : x === '\\&' ? '&' : x === '\\n' ? '\n' : x === '\\t' ? '\t' : x === '\\\\' ? '\\' : groups[Number(d)] ?? '');
            });
            if (changed && cmd.print) extra.push(l);
            break;
          }
          case 'y': {
            const [from, to] = cmd.text!.split('\0');
            l = [...l].map(ch => { const k = from.indexOf(ch); return k >= 0 ? to[k] ?? ch : ch; }).join('');
            break;
          }
          case 'd': deleted = true; break;
          case 'p': extra.push(l); break;
          case 'q': quit = true; break;
          case '=': extra.push(String(n + 1)); break;
          case 'a': extra.push('\0after' + cmd.text); break;
          case 'i': out.push(cmd.text!); break;
          case 'c': deleted = true; out.push(cmd.text!); break;
        }
        if (deleted || quit) break;
      }
      const after = extra.filter(e => e.startsWith('\0after')).map(e => e.slice(6));
      out.push(...extra.filter(e => !e.startsWith('\0after')));
      if (!deleted && !o.flags.has('n')) out.push(l);
      out.push(...after);
    }
    return joinLines(out);
  };
  if (o.flags.has('i')) {
    for (const i of ins) c.sh.vfs.write(c.sh.vfs.resolve(c.sh.cwd, i.name), run(i.text));
    return ok();
  }
  return ok(run(ins.map(i => i.text).join('')));
};

const awkCmd: Cmd = c => {
  const a = c.args;
  let fs: string | undefined;
  const vars: Record<string, string> = {};
  let i = 0;
  let program: string | undefined;
  for (; i < a.length; i++) {
    const s = a[i];
    if (s === '-F') { fs = a[++i]; continue; }
    if (s.startsWith('-F')) { fs = s.slice(2); continue; }
    if (s === '-v') { const [k, ...v] = (a[++i] ?? '').split('='); vars[k] = unescape(v.join('=')); continue; }
    if (s.startsWith('-v') && s.length > 2) { const [k, ...v] = s.slice(2).split('='); vars[k] = unescape(v.join('=')); continue; }
    if (s === '-f') return fail(c, 'program files are not supported here; put the program in quotes on the command line', 2);
    if (s === '--') { i++; break; }
    break;
  }
  program = a[i++];
  if (program === undefined) { c.sh.err += "usage: awk [-F fs][-v var=value] 'program' [file ...]\n"; return { out: '', code: 2 }; }
  if (fs === 't' || fs === '\\t') fs = '\t';
  const files = a.slice(i).filter(f => { const m = /^([A-Za-z_]\w*)=(.*)$/.exec(f); if (m) vars[m[1]] = m[2]; return !m; });
  const ins = inputs(c, files);
  if (!ins) return { out: '', code: 2 };
  try {
    return ok(awk(program, ins, { fs, vars }));
  } catch (e) {
    if (e instanceof AwkError) {
      c.sh.err += `awk: ${e.message}\n`;
      if (/^syntax error/.test(e.message) && /'\$\w|"\$/.test(program) === false && /\$\d/.test(program) === false && /\$/.test(program)) c.sh.err += "awk: tip: put the program in single quotes so the shell leaves the $ signs alone.\n";
      return { out: '', code: 2 };
    }
    throw e;
  }
};

const column: Cmd = c => {
  const o = getopts(c, 't', 'so', { table: 't', separator: 's' });
  if (!o) return { out: '', code: 2 };
  const ins = inputs(c, o.rest);
  if (!ins) return { out: '', code: 1 };
  const sep = last(o, 's');
  const rows = lines(ins.map(i => i.text).join('')).map(l => (sep ? l.split(new RegExp(`[${escapeRe(sep)}]+`)) : l.trim().split(/\s+/)));
  if (!o.flags.has('t')) return ok(joinLines(rows.map(r => r.join(' '))));
  const widths: number[] = [];
  rows.forEach(r => r.forEach((cell, i) => (widths[i] = Math.max(widths[i] ?? 0, cell.length))));
  return ok(joinLines(rows.map(r => r.map((cell, i) => (i === r.length - 1 ? cell : cell.padEnd(widths[i]))).join('  '))));
};

const rev: Cmd = c => {
  const ins = inputs(c, c.args);
  if (!ins) return { out: '', code: 1 };
  return ok(joinLines(lines(ins.map(i => i.text).join('')).map(l => [...l].reverse().join(''))));
};

const nl: Cmd = c => {
  const ins = inputs(c, c.args);
  if (!ins) return { out: '', code: 1 };
  let n = 0;
  return ok(joinLines(lines(ins.map(i => i.text).join('')).map(l => (l.trim() ? `${String(++n).padStart(6)}\t${l}` : l))));
};

const seq: Cmd = c => {
  const nums = c.args.filter(a => !/^-[a-z]/.test(a)).map(Number);
  if (!nums.length || nums.some(isNaN)) return fail(c, 'invalid argument. Example: seq 1 10');
  const [first, step, lastN] = nums.length === 1 ? [1, 1, nums[0]] : nums.length === 2 ? [nums[0], 1, nums[1]] : nums;
  if (step === 0) return fail(c, 'invalid Zero increment value');
  const out: string[] = [];
  for (let x = first; step > 0 ? x <= lastN : x >= lastN; x += step) { out.push(String(x)); if (out.length > 100000) break; }
  return ok(joinLines(out));
};

const tee: Cmd = c => {
  const o = getopts(c, 'a', '', { append: 'a' });
  if (!o) return { out: '', code: 2 };
  const text = readStdin(c);
  let code = 0;
  for (const f of o.rest) {
    const e = c.sh.vfs.write(c.sh.vfs.resolve(c.sh.cwd, f), text, o.flags.has('a'));
    if (e) { c.sh.err += `tee: ${e}\n`; code = 1; }
  }
  return { out: text, code };
};

const xargs: Cmd = c => {
  const o = getopts(c, 'rt', 'nIL', { 'max-args': 'n', replace: 'I', 'no-run-if-empty': 'r' });
  if (!o) return { out: '', code: 2 };
  const cmd = o.rest.length ? o.rest : ['echo'];
  const text = readStdin(c);
  const repl = last(o, 'I');
  const items = repl ? lines(text).filter(l => l.trim()) : text.split(/\s+/).filter(Boolean);
  if (!items.length) return o.flags.has('r') || repl ? ok() : c.sh.command(cmd, { text: '', pos: 0 });
  const n = repl ? 1 : Number(last(o, 'n') ?? last(o, 'L') ?? items.length);
  let out = '';
  let code = 0;
  for (let i = 0; i < items.length; i += n) {
    const chunk = items.slice(i, i + n);
    const words = repl ? cmd.map(w => w.split(repl).join(chunk[0])) : [...cmd, ...chunk];
    const r = c.sh.command(words, { text: '', pos: 0 });
    out += r.out;
    if (r.code) code = 123;
  }
  return { out, code };
};

const base64: Cmd = c => {
  const o = getopts(c, 'diw', 'w', { decode: 'd', 'ignore-garbage': 'i', wrap: 'w' });
  if (!o) return { out: '', code: 2 };
  const ins = inputs(c, o.rest);
  if (!ins) return { out: '', code: 1 };
  const text = ins.map(i => i.text).join('');
  if (o.flags.has('d')) {
    const clean = text.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return fail(c, 'invalid input');
    let bin: string;
    try { bin = atob(clean); } catch { return fail(c, 'invalid input'); }
    // PowerShell's -EncodedCommand is UTF-16LE: every other byte is zero. A terminal shows those as nothing.
    const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    let decoded: string;
    try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes.filter(b => b !== 0)); } catch { decoded = [...bytes].filter(b => b !== 0).map(b => String.fromCharCode(b)).join(''); }
    return ok(decoded);
  }
  const bytes = new TextEncoder().encode(text);
  const enc = btoa(String.fromCharCode(...bytes));
  const w = Number(last(o, 'w') ?? 76);
  return ok((w ? enc.match(new RegExp(`.{1,${w}}`, 'g'))?.join('\n') ?? '' : enc) + '\n');
};

const sha256sum: Cmd = c => {
  const ins = inputs(c, c.args.filter(a => !a.startsWith('-')));
  if (!ins) return { out: '', code: 1 };
  return { out: joinLines(ins.map(i => `${sha256(i.text)}  ${i.name === '(standard input)' ? '-' : i.name}`)), code: c.sh.err ? 1 : 0 };
};

const fileCmd: Cmd = c => {
  const out = c.args.map(f => {
    const p = c.sh.vfs.resolve(c.sh.cwd, f);
    if (c.sh.vfs.isDir(p)) return `${f}: directory`;
    const t = c.sh.vfs.read(p);
    if (t === undefined) return `${f}: cannot open \`${f}' (No such file or directory)`;
    if (c.sh.host.net?.isCapture(p)) return `${f}: pcap capture file, microsecond ts (little-endian) - version 2.4 (Ethernet, capture length 262144)`;
    if (!t) return `${f}: empty`;
    if (t.startsWith('#!')) return `${f}: Bourne-Again shell script, ASCII text executable`;
    if (/^[\w.-]+,[\w.-]+,/.test(t)) return `${f}: CSV text`;
    return `${f}: ASCII text`;
  });
  return ok(joinLines(out));
};

const basename: Cmd = c => {
  const [p, suffix] = c.args;
  if (p === undefined) return fail(c, 'missing operand');
  let b = p.replace(/\/+$/, '').split('/').pop() ?? '';
  if (suffix && b.endsWith(suffix) && b !== suffix) b = b.slice(0, -suffix.length);
  return ok(b + '\n');
};

const dirname: Cmd = c => {
  const p = c.args[0];
  if (p === undefined) return fail(c, 'missing operand');
  const d = p.replace(/\/+$/, '').split('/').slice(0, -1).join('/');
  return ok((d || (p.startsWith('/') ? '/' : '.')) + '\n');
};

// ── Shell built-ins ───────────────────────────────────────────────────────

const echo: Cmd = c => {
  let a = c.args;
  let newline = true;
  let esc = false;
  while (a.length && /^-[neE]+$/.test(a[0])) {
    if (a[0].includes('n')) newline = false;
    if (a[0].includes('e')) esc = true;
    a = a.slice(1);
  }
  const s = a.join(' ');
  return ok((esc ? unescape(s) : s) + (newline ? '\n' : ''));
};

const printf: Cmd = c => {
  const [fmt, ...args] = c.args;
  if (fmt === undefined) return fail(c, 'usage: printf format [arguments]', 2);
  const used = (fmt.match(/%[^%]/g) ?? []).length;
  let out = format(fmt, args);
  for (let i = used; used && i < args.length; i += used) out += format(fmt, args.slice(i));
  return ok(out);
};

const read: Cmd = c => {
  const names: string[] = [];
  for (let i = 0; i < c.args.length; i++) {
    const a = c.args[i];
    if (a === '-p' || a === '-d' || a === '-t' || a === '-n' || a === '-u') { i++; continue; }
    if (a.startsWith('-')) continue;
    names.push(a);
  }
  if (!names.length) names.push('REPLY');
  const s = c.stdin;
  if (s.pos >= s.text.length) { names.forEach(n => c.sh.vars.set(n, '')); return { out: '', code: 1 }; }
  const nlAt = s.text.indexOf('\n', s.pos);
  const line = nlAt < 0 ? s.text.slice(s.pos) : s.text.slice(s.pos, nlAt);
  s.pos = nlAt < 0 ? s.text.length : nlAt + 1;
  const ifs = c.sh.vars.get('IFS');
  const raw = c.args.includes('-r') ? line : line.replace(/\\(.)/g, '$1');
  if (names.length === 1) { c.sh.vars.set(names[0], ifs === '' ? raw : raw.trim()); return ok(); }
  const parts = ifs !== undefined && ifs.length === 1 && ifs !== ' ' ? raw.split(ifs) : raw.trim().split(/[ \t]+/);
  names.forEach((n, i) => c.sh.vars.set(n, i === names.length - 1 ? parts.slice(i).join(ifs && ifs.length === 1 && ifs !== ' ' ? ifs : ' ') : parts[i] ?? ''));
  return ok();
};

function test(c: CmdCtx, args: string[], dbl: boolean): Result {
  const { vfs } = c.sh;
  const p = (s: string) => vfs.resolve(c.sh.cwd, s);
  let i = 0;
  const intOf = (s: string): number => {
    if (!/^\s*-?\d+\s*$/.test(s)) throw new Error(`${s}: integer expression expected`);
    return Number(s);
  };
  const primary = (): boolean => {
    const a = args[i];
    if (a === '!') { i++; return !primary(); }
    if (a === '(') { i++; const v = or(); if (args[i] === ')') i++; return v; }
    const b = args[i + 1];
    if (b !== undefined && ['=', '==', '!=', '<', '>', '-eq', '-ne', '-lt', '-le', '-gt', '-ge', '=~'].includes(b) && args[i + 2] !== undefined) {
      const x = a;
      const y = args[i + 2];
      i += 3;
      switch (b) {
        case '=': case '==': return dbl && /[*?[]/.test(y) ? globRegex(y).test(x) : x === y;
        case '!=': return dbl && /[*?[]/.test(y) ? !globRegex(y).test(x) : x !== y;
        case '<': return x < y;
        case '>': return x > y;
        case '=~': { const r = makeRegex(posixRegex(y, true), ''); if (typeof r === 'string') throw new Error(r); return r.test(x); }
        case '-eq': return intOf(x) === intOf(y);
        case '-ne': return intOf(x) !== intOf(y);
        case '-lt': return intOf(x) < intOf(y);
        case '-le': return intOf(x) <= intOf(y);
        case '-gt': return intOf(x) > intOf(y);
        case '-ge': return intOf(x) >= intOf(y);
      }
    }
    if (/^-[zndefsxrw]$/.test(a) && b !== undefined) {
      i += 2;
      switch (a) {
        case '-z': return b === '';
        case '-n': return b !== '';
        case '-e': return vfs.exists(p(b));
        case '-f': return vfs.isFile(p(b));
        case '-d': return vfs.isDir(p(b));
        case '-s': return (vfs.read(p(b)) ?? '').length > 0;
        case '-x': return !!vfs.file(p(b))?.exec || vfs.isDir(p(b));
        case '-r': return vfs.exists(p(b));
        case '-w': return vfs.writable(p(b)) && vfs.exists(p(b));
      }
    }
    i++;
    return a !== undefined && a !== '';
  };
  const and = (): boolean => { let v = primary(); while (args[i] === '-a' || args[i] === '&&') { i++; const w = primary(); v = v && w; } return v; };
  const or = (): boolean => { let v = and(); while (args[i] === '-o' || args[i] === '||') { i++; const w = and(); v = v || w; } return v; };
  try {
    if (!args.length) return { out: '', code: 1 };
    const v = or();
    if (i < args.length) return fail(c, `${args[i]}: unexpected argument`, 2);
    return { out: '', code: v ? 0 : 1 };
  } catch (e) {
    return fail(c, (e as Error).message, 2);
  }
}

const bracket: Cmd = c => {
  const close = c.name === '[[' ? ']]' : ']';
  if (c.args[c.args.length - 1] !== close) return fail(c, `missing '${close}'`, 2);
  return test(c, c.args.slice(0, -1), c.name === '[[');
};

const flowCmd = (kind: 'break' | 'continue' | 'return' | 'exit'): Cmd => c => {
  const n = c.args[0] !== undefined ? Number(c.args[0]) : kind === 'return' || kind === 'exit' ? c.sh.lastCode : 1;
  return c.sh.flow(kind, kind === 'break' || kind === 'continue' ? n || 1 : 1, kind === 'return' || kind === 'exit' ? n : 0);
};

// ── About the workstation ─────────────────────────────────────────────────

const EPOCH_DAY = Date.UTC(2026, 10, 5) / 1000;

const date: Cmd = c => {
  const t = c.sh.host.now();
  const fmt = c.args.find(a => a.startsWith('+'));
  const [hh, mm, ss] = hms(t).split(':');
  if (!fmt) return ok(`Thu Nov  5 ${hms(t)} UTC 2026\n`);
  const map: Record<string, string> = {
    Y: '2026', m: '11', d: '05', H: hh, M: mm, S: ss, T: hms(t), F: DAY, s: String(EPOCH_DAY + Math.floor(t)), a: 'Thu', b: 'Nov', e: ' 5', Z: 'UTC', '%': '%', D: '11/05/26', R: `${hh}:${mm}`,
  };
  return ok(fmt.slice(1).replace(/%(.)/g, (m, k: string) => map[k] ?? m) + '\n');
};

const history: Cmd = c => {
  if (c.args[0] === '-c') { c.sh.history.length = 0; return ok(); }
  const h = c.sh.history;
  const n = Number(c.args[0]) || h.length;
  return ok(joinLines(h.slice(-n).map((l, i) => `${String(h.length - Math.min(n, h.length) + i + 1).padStart(5)}  ${l}`)));
};

const lookup = (kind: 'whois' | 'intel' | 'dns'): Cmd => c => {
  const q = c.args.filter(a => !a.startsWith('-') && !a.startsWith('+'))[0];
  if (!q) return fail(c, kind === 'intel' ? 'usage: intel <ip | domain | sha256>' : `usage: ${c.name} <${kind === 'dns' ? 'name' : 'ip | domain'}>`);
  const r = c.sh.host.lookup(kind, q);
  if (r !== undefined) return ok(r.endsWith('\n') ? r : r + '\n');
  if (kind === 'intel') return ok(`${q}\n  Reputation: no records\n  Not seen in any feed this workstation subscribes to. No record is not the same as safe.\n`);
  if (kind === 'whois') {
    if (/^10\./.test(q) || /^192\.168\./.test(q) || /^172\.(1[6-9]|2\d|3[01])\./.test(q)) return ok(`${q}\n  Private address (RFC 1918): not on the internet. Look it up in ~/docs/assets.csv.\n`);
    return ok(`${q}\n  No whois record found.\n`);
  }
  return { out: c.name === 'dig' ? `; <<>> DiG <<>> ${q}\n;; status: NXDOMAIN\n` : `** server can't find ${q}: NXDOMAIN\n`, code: c.name === 'dig' ? 0 : 1 };
};

const notHere = (why: string): Cmd => c => fail(c, why, 127);

const edit: Cmd = c => {
  const f = c.args.filter(a => !a.startsWith('-'))[0];
  if (!f) return fail(c, `usage: ${c.name} <file>   (for example: ${c.name} ~/bin/check.sh)`);
  const p = c.sh.vfs.resolve(c.sh.cwd, f);
  if (c.sh.vfs.isDir(p)) return fail(c, `${f} is a directory`);
  c.sh.edit = p;
  return ok();
};

const bash: Cmd = c => {
  const a = c.args.filter(x => x !== '-x' && x !== '-e' && x !== '-u');
  if (a[0] === '-c') {
    if (a[1] === undefined) return fail(c, '-c: option requires an argument', 2);
    const saved = c.sh.args;
    c.sh.args = a.slice(3);
    try { return c.sh.exec(parseOrThrow(a[1]), c.stdin); } finally { c.sh.args = saved; }
  }
  if (!a.length) return fail(c, 'an interactive shell inside the terminal is not supported here; you are already in bash');
  return c.sh.runScript(a[0], a.slice(1), c.stdin, false);
};

const parseOrThrow = (src: string) => parseShell(src);

const source: Cmd = c => {
  const f = c.args[0];
  if (!f) return fail(c, 'filename argument required', 2);
  const text = c.sh.vfs.read(c.sh.vfs.resolve(c.sh.cwd, f));
  if (text === undefined) return fail(c, `${f}: No such file or directory`);
  return c.sh.exec(parseOrThrow(text), c.stdin);
};

const typeCmd: Cmd = c => {
  const out: string[] = [];
  let code = 0;
  for (const n of c.args.filter(a => !a.startsWith('-'))) {
    if (c.sh.funcs.has(n)) out.push(c.name === 'which' ? n : `${n} is a function`);
    else if (BUILTINS.has(n)) out.push(c.name === 'which' ? `${n}: shell built-in command` : `${n} is a shell builtin`);
    else if (COMMANDS[n]) out.push(c.name === 'which' ? `/usr/bin/${n}` : `${n} is /usr/bin/${n}`);
    else {
      const p = `${HOME}/bin/${n}`;
      if (c.sh.vfs.isFile(p)) out.push(c.name === 'which' ? p : `${n} is ${p}`);
      else { if (c.name === 'type') c.sh.err += `bash: type: ${n}: not found\n`; code = 1; }
    }
  }
  return { out: joinLines(out), code };
};

const BUILTINS = new Set(['cd', 'echo', 'printf', 'read', 'export', 'unset', 'local', 'set', 'test', '[', '[[', 'true', 'false', 'exit', 'return', 'break', 'continue', 'shift', 'source', '.', 'history', 'type', 'help', 'pwd', 'let', 'declare']);

const help: Cmd = () => ok(`Commands on this workstation (try "man <command>" for options and examples):

  Moving around   pwd  ls  cd  find  file
  Reading files   cat  less  head  tail  tail -f  wc  nl  tac
  Searching       grep  egrep
  Slicing         cut  awk  sed  tr  sort  uniq  column  rev
  Files           touch  mkdir  cp  mv  rm  chmod  nano  tee
  Decoding        base64  sha256sum
  Looking up      whois  intel
  Network         ip  ping  traceroute  ss  netstat  arp  dig  nslookup  host  tcpdump -r
  Scripting       echo  printf  read  test [ ]  if  for  while  case  functions  $(...)  $((...))  bash script.sh
  Other           date  history  clear  whoami  hostname  xargs  seq  basename  dirname

  Pipes: cmd1 | cmd2     Save output: cmd > file (>> appends)     Stop tail -f: Ctrl+C
  Your files live in ~ (/home/analyst). Logs are in /var/log. Notes about the company are in ~/docs.
  Packet captures saved by the network sensor are in /var/captures (read them with tcpdump -r).
`);

export const MAN: Record<string, string> = {
  ls: 'ls [-l] [-a] [-h] [-t] [-r] [DIR...]\n  List a folder. -l long form (size, time), -a include hidden, -h sizes like 2.1M, -t newest first.\n  ls -lh /var/log',
  cd: 'cd [DIR]\n  Change folder. cd alone goes home; cd - goes back; cd .. goes up.',
  cat: 'cat [-n] [FILE...]\n  Print files. -n numbers the lines.\n  cat ~/docs/assets.csv',
  less: 'less FILE\n  Here, the same as cat: the terminal scrolls. Pipe into head to see the start.',
  head: 'head [-n N] [FILE...]\n  First N lines (10 by default). head -n 3 file, or head -3 file.',
  tail: 'tail [-n N] [-n +N] [-f] [FILE]\n  Last N lines (10 by default). -n +N starts at line N. -f follows the file as it grows; Ctrl+C stops.\n  tail -f /var/log/auth.log | grep Failed',
  grep: 'grep [OPTIONS] PATTERN [FILE...]\n  Print lines matching a regular expression.\n  -i ignore case    -v invert (lines NOT matching)   -c count matching lines   -n line numbers\n  -o print only the matched part   -E extended regex (+ ? | () without backslashes)   -F fixed string\n  -w whole word   -x whole line   -l file names only   -r search folders   -h/-H hide/show file names\n  -A N / -B N / -C N lines of context after/before/around   -m N stop after N matches   -e PAT (repeatable)\n  grep -c "Failed password" /var/log/auth.log\n  grep -oE "[0-9]+(\\.[0-9]+){3}" /var/log/auth.log | sort | uniq -c | sort -rn | head',
  egrep: 'egrep = grep -E',
  wc: 'wc [-l] [-w] [-c] [FILE...]\n  Count lines, words and bytes. wc -l counts lines.',
  sort: 'sort [-n] [-r] [-u] [-k N[,M]] [-t SEP] [-h] [FILE...]\n  Sort lines. -n numbers by value, -r reverse, -u drop duplicates, -k sort by field N (-k2,2 just field 2),\n  -t field separator (default: blanks), -h sizes like 2K 1M. Combine: sort -k3,3nr\n  ... | sort | uniq -c | sort -rn    (count, most first)',
  uniq: 'uniq [-c] [-d] [-u] [-i] [FILE]\n  Collapse ADJACENT repeated lines, so sort first. -c prefix counts, -d only repeated, -u only unique.',
  cut: 'cut -d SEP -f LIST [FILE...]   or   cut -c LIST\n  Pick fields split on one character (tab by default) or character positions. LIST: 1,3 or 2-4 or 3-\n  cut -d, -f1,3 ~/docs/assets.csv      cut -d= -f2',
  awk: "awk [-F SEP] [-v var=value] 'PROGRAM' [FILE...]\n  Pattern-action language. Fields are $1, $2 ... $NF (last); $0 is the line; NR line number; NF field count.\n  awk '{print $1}'                          first field\n  awk -F, '$4==\"Server\" {print $1}'        CSV, filter on a column\n  awk '/Failed/ {c[$(NF-3)]++} END {for (ip in c) print c[ip], ip}'   count by key\n  awk '{s+=$5} END {print s}'               sum a column\n  awk '$1 >= \"2026-11-05T09:00\"'            string comparison on timestamps\n  Functions: length substr split index tolower toupper sub gsub match int sprintf. printf works too.",
  sed: "sed [-n] [-E] 'SCRIPT' [FILE...]\n  Stream editor. s/OLD/NEW/ replaces (g = every match, I = ignore case), /RE/d deletes, -n with p prints only\n  selected lines, N,Mp prints a range.\n  sed 's/.*user=//'        sed -n '5,10p' file        sed -E 's/ +/ /g'",
  tr: "tr [-d] [-s] [-c] SET1 [SET2]\n  Translate or delete characters from standard input. Ranges a-z and classes [:upper:] [:digit:] work.\n  tr 'a-z' 'A-Z'     tr -d '\"'     tr -s ' '     tr ',' '\\n'",
  find: "find [PATH...] [-name GLOB] [-iname GLOB] [-type f|d] [-maxdepth N] [-size +10k]\n  find /var/log -name '*.log'",
  column: 'column -t [-s SEP]\n  Line columns up into a table. column -t -s, ~/docs/assets.csv',
  base64: 'base64 [-d] [FILE]\n  Encode, or with -d decode. echo SGVsbG8= | base64 -d\n  PowerShell -enc commands are UTF-16LE; the zero bytes are hidden when decoding here.',
  sha256sum: 'sha256sum [FILE...]\n  SHA-256 hash of each file, to compare with threat intelligence.',
  whois: 'whois IP|DOMAIN\n  Who owns an address: organisation, country, network.',
  intel: 'intel IP|DOMAIN|SHA256\n  Look an indicator up in the threat intelligence feeds the SOC subscribes to.',
  nano: 'nano FILE\n  Open a simple editor for FILE (create it if new). Save with Ctrl+S, close with Esc. Scripts go in ~/bin.',
  bash: 'bash SCRIPT [ARGS...]   or   bash -c "COMMANDS"\n  Run a script. Inside it, $1 $2 ... are the arguments, $# their count, $@ all of them.\n  Make a script runnable on its own: chmod +x ~/bin/x.sh, then run ~/bin/x.sh or just x.sh.',
  echo: 'echo [-n] [-e] TEXT...\n  Print text. -n no newline, -e understand \\n and \\t.',
  printf: "printf FORMAT [ARGS...]\n  Formatted output: %s text, %d whole number, %5d padded, %-10s left-aligned, %.2f two decimals, \\n newline.\n  printf '%-15s %5d\\n' 10.0.4.114 61",
  read: 'read [-r] VAR...\n  Read one line of input into variables. Usual pattern:\n  while read -r ip; do whois "$ip"; done < ips.txt',
  test: "test EXPR   or   [ EXPR ]\n  Strings: = != -z (empty) -n (not empty). Numbers: -eq -ne -lt -le -gt -ge. Files: -f -d -e -s.\n  if [ \"$n\" -gt 100 ]; then echo high; fi",
  xargs: 'xargs [-n N] [-I {}] COMMAND\n  Run COMMAND with the words from standard input as arguments.\n  cut -d, -f2 ips.csv | xargs -n1 whois',
  chmod: 'chmod +x FILE\n  Make a script runnable. chmod -x takes that away.',
  date: 'date [+FORMAT]\n  The time on the workstation (the shift clock). date +%H:%M',
  history: 'history [N]\n  Commands you have run. Up and down arrows recall them.',
  tee: 'tee [-a] FILE\n  Copy standard input to a file and to the screen.',
  seq: 'seq [FIRST [STEP]] LAST\n  Print a sequence of numbers.',
  for: 'for VAR in WORDS; do COMMANDS; done\n  for ip in $(cat ~/ips.txt); do grep -c "$ip" /var/log/auth.log; done\n  for ((i=1; i<=5; i++)); do echo $i; done',
  while: 'while COMMAND; do COMMANDS; done\n  while read -r line; do echo "$line"; done < file',
  if: 'if COMMAND; then ...; elif COMMAND; then ...; else ...; fi\n  The condition is any command: 0 exit status means true. if grep -q root file; then echo found; fi',
  ...NET_MAN,
};

const man: Cmd = c => {
  const n = c.args[0];
  if (!n) return fail(c, 'What manual page do you want? For example: man grep');
  const page = MAN[n] ?? (n === 'egrep' || n === 'fgrep' ? MAN['grep'] : n === 'more' ? MAN['less'] : n === 'vi' || n === 'vim' ? MAN['nano'] : n === '[' ? MAN['test'] : undefined);
  if (!page) return fail(c, `No manual entry for ${n}${COMMANDS[n] ? ' (it works like the usual Linux command)' : ''}`, 16);
  return ok(page + '\n');
};

export const COMMANDS: Record<string, Cmd> = {
  ls, cd, cat, tac, head: headTail(false), tail: headTail(true), less: cat, more: cat, touch, mkdir, rm, cp: cpmv(false), mv: cpmv(true), chmod, find,
  grep, egrep: grep, fgrep: grep, sort, uniq, cut, wc, tr, sed, awk: awkCmd, gawk: awkCmd, column, rev, nl, seq, tee, xargs, base64, sha256sum,
  file: fileCmd, basename, dirname, echo, printf, read, test: c => test(c, c.args, false), '[': bracket, '[[': bracket,
  true: () => ok(), false: () => ({ out: '', code: 1 }), ':': () => ok(),
  pwd: c => ok(c.sh.cwd + '\n'),
  export: c => { for (const a of c.args) { const m = /^([A-Za-z_]\w*)=(.*)$/s.exec(a); if (m) c.sh.vars.set(m[1], m[2]); } return ok(); },
  local: c => { for (const a of c.args) { const m = /^([A-Za-z_]\w*)(?:=(.*))?$/s.exec(a); if (m) c.sh.vars.set(m[1], m[2] ?? ''); } return ok(); },
  declare: c => { for (const a of c.args.filter(x => !x.startsWith('-'))) { const m = /^([A-Za-z_]\w*)(?:=(.*))?$/s.exec(a); if (m) c.sh.vars.set(m[1], m[2] ?? ''); } return ok(); },
  let: c => { let v = 0; for (const a of c.args) v = c.sh.arith(a); return { out: '', code: v ? 0 : 1 }; },
  unset: c => { for (const a of c.args) { c.sh.vars.delete(a); c.sh.funcs.delete(a); } return ok(); },
  set: c => (c.args.length ? ok() : ok(joinLines([...c.sh.vars].map(([k, v]) => `${k}=${v}`)))),
  env: c => ok(joinLines([...c.sh.vars].filter(([k]) => /^[A-Z]/.test(k)).map(([k, v]) => `${k}=${v}`))),
  printenv: c => (c.args[0] ? (c.sh.vars.has(c.args[0]) ? ok(c.sh.vars.get(c.args[0]) + '\n') : { out: '', code: 1 }) : ok(joinLines([...c.sh.vars].filter(([k]) => /^[A-Z]/.test(k)).map(([k, v]) => `${k}=${v}`)))),
  shift: c => { c.sh.args = c.sh.args.slice(Number(c.args[0] ?? 1)); return ok(); },
  exit: flowCmd('exit'), return: flowCmd('return'), break: flowCmd('break'), continue: flowCmd('continue'),
  source, '.': source, bash, sh: bash, type: typeCmd, which: typeCmd,
  history, help, man, date,
  clear: c => { c.sh.clear = true; return ok(); },
  whoami: () => ok('analyst\n'), hostname: () => ok('soc-ws\n'), id: () => ok('uid=1000(analyst) gid=1000(analyst) groups=1000(analyst),4(adm)\n'),
  uname: c => ok(c.args.includes('-a') ? 'Linux soc-ws 6.8.0-soc #1 SMP x86_64 GNU/Linux\n' : 'Linux\n'),
  sleep: () => ok(), alias: () => ok(),
  whois: lookup('whois'), intel: lookup('intel'),
  ...NET_COMMANDS,
  nano: edit, vi: edit, vim: edit, edit, code: edit,
  sudo: c => fail(c, 'analyst is not in the sudoers file. This incident will be reported. (The SOC workstation is read-only for investigation; response actions go through the ticket.)'),
  su: c => fail(c, 'Authentication failure'),
  ssh: notHere('connecting to other hosts is not allowed from the SOC workstation; their logs are collected in /var/log'),
  curl: notHere('this workstation has no internet access, on purpose: never fetch a suspicious URL from your own machine. Use intel and whois instead'),
  wget: notHere('this workstation has no internet access, on purpose: never fetch a suspicious URL from your own machine. Use intel and whois instead'),
  nc: notHere('opening connections from the SOC workstation is not allowed; ping, traceroute and dig are, and the firewall log shows the traffic'),
  nmap: notHere('scanning is not available from the SOC workstation, and scanning without authorisation is never OK'),
  python3: notHere('Python is not installed on this workstation; bash, awk and sed are'),
  python: notHere('Python is not installed on this workstation; bash, awk and sed are'),
  jq: notHere('jq is not installed; the logs here are plain text, so grep, cut and awk do the job'),
  md5sum: notHere('md5sum is not installed; use sha256sum (threat intel here uses SHA-256)'),
  zcat: notHere('there are no compressed logs on this workstation'),
};
