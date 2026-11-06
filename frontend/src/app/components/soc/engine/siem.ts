/**
 * The SIEM's search language, modelled on the pipe-based languages real SIEMs use:
 *
 *   source=auth action=failed | stats count by src | sort -count | head 5
 *
 * The first part filters events (field=value with * wildcards, != > < >= <=, free text, NOT, OR, brackets); each
 * command after a pipe reshapes the results: stats, top, rare, timechart, table, fields, sort, head, tail, dedup,
 * where, eval, rename, search.
 */

import { Ev, hms } from './events';

export type Row = Record<string, string>;

export type SiemResult =
  | { kind: 'events'; events: Ev[]; rows: Row[]; extra: string[] }
  | { kind: 'table'; cols: string[]; rows: Row[] }
  | { kind: 'chart'; span: number; buckets: { t: number; n: number }[]; cols: string[]; rows: Row[] };

export class SiemError extends Error {}

const TRANSFORMING = new Set(['stats', 'top', 'rare', 'timechart', 'table', 'fields', 'chart']);
export const SIEM_COMMANDS = ['stats', 'top', 'rare', 'timechart', 'table', 'fields', 'sort', 'head', 'tail', 'dedup', 'where', 'eval', 'rename', 'search'];

/** Splits on | outside quotes. */
function splitPipes(q: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (const ch of q) {
    if (ch === '"') inQ = !inQ;
    if (ch === '|' && !inQ) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (inQ) throw new SiemError('A quote is not closed.');
  out.push(cur.trim());
  return out;
}

const isNum = (s: string | undefined) => s !== undefined && s !== '' && /^-?\d+(\.\d+)?$/.test(s.trim());

function wildcard(v: string): RegExp {
  return new RegExp(`^${v.split('*').map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i');
}

export function rowOf(e: Ev): Row {
  return { _time: hms(e.t), source: e.source, host: e.host, ...e.f, _raw: e.raw };
}

// ── Search terms ──────────────────────────────────────────────────────────

type Pred = (r: Row) => boolean;

function tokenizeSearch(s: string): string[] {
  const re = /\s*([A-Za-z_][\w.]*(?:!=|>=|<=|=|>|<)(?:"[^"]*"|[^\s()]*)|"[^"]*"|\(|\)|[^\s()]+)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) if (m[1]) out.push(m[1]);
  return out;
}

function compileSearch(s: string): Pred {
  const toks = tokenizeSearch(s);
  let i = 0;
  const peek = () => toks[i];
  const term = (t: string): Pred => {
    const m = /^([A-Za-z_][\w.]*)(!=|>=|<=|=|>|<)(.*)$/.exec(t);
    if (m) {
      const [, f, op, raw] = m;
      const v = raw.startsWith('"') ? raw.slice(1, -1) : raw;
      if (v === '' && op !== '=' && op !== '!=') throw new SiemError(`"${t}" needs a value after ${op}.`);
      if (op === '=' || op === '!=') {
        const re = wildcard(v);
        return op === '=' ? r => r[f] !== undefined && re.test(r[f]) : r => r[f] !== undefined && !re.test(r[f]);
      }
      if (!isNum(v)) throw new SiemError(`"${t}": ${op} compares numbers; ${v} is not a number.`);
      const n = Number(v);
      return r => {
        if (!isNum(r[f])) return false;
        const x = Number(r[f]);
        return op === '>' ? x > n : op === '<' ? x < n : op === '>=' ? x >= n : x <= n;
      };
    }
    const word = t.startsWith('"') ? t.slice(1, -1) : t;
    if (word.includes('*')) {
      const re = new RegExp(word.split('*').map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i');
      return r => re.test(r['_raw'] ?? Object.values(r).join(' '));
    }
    const w = word.toLowerCase();
    return r => (r['_raw'] ?? Object.values(r).join(' ')).toLowerCase().includes(w);
  };
  const primary = (): Pred => {
    const t = peek();
    if (t === undefined) throw new SiemError('The search ends too early.');
    if (t.toUpperCase() === 'NOT') { i++; const p = primary(); return r => !p(r); }
    if (t === '(') {
      i++;
      const p = or();
      if (peek() !== ')') throw new SiemError('A bracket is not closed.');
      i++;
      return p;
    }
    if (t === ')') throw new SiemError('There is a ) without a (.');
    i++;
    return term(t);
  };
  const and = (): Pred => {
    let p = primary();
    while (peek() !== undefined && peek() !== ')' && peek().toUpperCase() !== 'OR') {
      if (peek().toUpperCase() === 'AND') { i++; continue; }
      const a = p;
      const b = primary();
      p = r => a(r) && b(r);
    }
    return p;
  };
  const or = (): Pred => {
    let p = and();
    while (peek()?.toUpperCase() === 'OR') {
      i++;
      const a = p;
      const b = and();
      p = r => a(r) || b(r);
    }
    return p;
  };
  if (!toks.length) return () => true;
  const p = or();
  if (i < toks.length) throw new SiemError(`Unexpected "${toks[i]}".`);
  return p;
}

// ── Expressions for where and eval ────────────────────────────────────────

type Val = string | number;
type Fn = (r: Row) => Val;

function compileExpr(src: string): Fn {
  const toks = src.match(/"[^"]*"|\d+(?:\.\d+)?|[A-Za-z_][\w.]*|==|!=|>=|<=|[-+*/()<>=,!]/g) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const num = (v: Val) => (typeof v === 'number' ? v : isNum(v) ? Number(v) : NaN);
  const truthy = (v: Val) => (typeof v === 'number' ? v !== 0 : v !== '' && v !== 'false');
  const or = (): Fn => {
    let a = and();
    while (peek()?.toUpperCase() === 'OR') { i++; const x = a; const b = and(); a = r => (truthy(x(r)) || truthy(b(r)) ? 1 : 0); }
    return a;
  };
  const and = (): Fn => {
    let a = not();
    while (peek()?.toUpperCase() === 'AND') { i++; const x = a; const b = not(); a = r => (truthy(x(r)) && truthy(b(r)) ? 1 : 0); }
    return a;
  };
  const not = (): Fn => {
    if (peek()?.toUpperCase() === 'NOT' || peek() === '!') { i++; const a = not(); return r => (truthy(a(r)) ? 0 : 1); }
    return cmp();
  };
  const cmp = (): Fn => {
    const a = add();
    const op = peek();
    if (['=', '==', '!=', '>', '<', '>=', '<='].includes(op)) {
      i++;
      const b = add();
      return r => {
        const x = a(r);
        const y = b(r);
        const nx = num(x);
        const ny = num(y);
        const c = !isNaN(nx) && !isNaN(ny) ? nx - ny : String(x).localeCompare(String(y));
        return (op === '=' || op === '==' ? c === 0 : op === '!=' ? c !== 0 : op === '>' ? c > 0 : op === '<' ? c < 0 : op === '>=' ? c >= 0 : c <= 0) ? 1 : 0;
      };
    }
    return a;
  };
  const add = (): Fn => {
    let a = mul();
    while (peek() === '+' || peek() === '-') {
      const op = toks[i++];
      const x = a;
      const b = mul();
      a = op === '+' ? r => { const p = x(r); const q = b(r); return typeof p === 'number' && typeof q === 'number' ? p + q : !isNaN(num(p)) && !isNaN(num(q)) ? num(p) + num(q) : String(p) + String(q); } : r => num(x(r)) - num(b(r));
    }
    return a;
  };
  const mul = (): Fn => {
    let a = unary();
    while (peek() === '*' || peek() === '/') {
      const op = toks[i++];
      const x = a;
      const b = unary();
      a = op === '*' ? r => num(x(r)) * num(b(r)) : r => num(x(r)) / num(b(r));
    }
    return a;
  };
  const unary = (): Fn => {
    if (peek() === '-') { i++; const a = unary(); return r => -num(a(r)); }
    return primary();
  };
  const primary = (): Fn => {
    const t = toks[i++];
    if (t === undefined) throw new SiemError('The expression ends too early.');
    if (t === '(') { const a = or(); if (toks[i++] !== ')') throw new SiemError('A bracket is not closed.'); return a; }
    if (t.startsWith('"')) { const s = t.slice(1, -1); return () => s; }
    if (/^\d/.test(t)) { const n = Number(t); return () => n; }
    if (peek() === '(') {
      i++;
      const args: Fn[] = [];
      if (peek() !== ')') { args.push(or()); while (peek() === ',') { i++; args.push(or()); } }
      if (toks[i++] !== ')') throw new SiemError(`${t}( is not closed.`);
      const name = t.toLowerCase();
      switch (name) {
        case 'len': return r => String(args[0](r)).length;
        case 'lower': return r => String(args[0](r)).toLowerCase();
        case 'upper': return r => String(args[0](r)).toUpperCase();
        case 'round': return r => { const d = args[1] ? num(args[1](r)) : 0; return Math.round(num(args[0](r)) * 10 ** d) / 10 ** d; };
        case 'tonumber': return r => num(args[0](r));
        case 'like': return r => (new RegExp(`^${String(args[1](r)).replace(/[.+?^${}()|[\]\\*]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i').test(String(args[0](r))) ? 1 : 0);
        case 'match': return r => (new RegExp(String(args[1](r))).test(String(args[0](r))) ? 1 : 0);
        case 'substr': return r => String(args[0](r)).substr(num(args[1](r)) - 1, args[2] ? num(args[2](r)) : undefined);
        case 'isnull': return r => (args[0](r) === '' ? 1 : 0);
        case 'isnotnull': return r => (args[0](r) !== '' ? 1 : 0);
        case 'if': return r => (truthy(args[0](r)) ? args[1](r) : args[2](r));
      }
      throw new SiemError(`Unknown function ${t}(). Try len, lower, upper, round, substr, like, match, if.`);
    }
    if (['AND', 'OR', 'NOT'].includes(t.toUpperCase())) throw new SiemError(`Unexpected ${t}.`);
    return r => { const v = r[t]; return v === undefined ? '' : isNum(v) ? Number(v) : v; };
  };
  const f = or();
  if (i < toks.length) throw new SiemError(`Unexpected "${toks[i]}" in the expression.`);
  return f;
}

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

// ── Commands ──────────────────────────────────────────────────────────────

interface Agg { fn: string; field?: string; as: string }

function parseAggs(s: string): { aggs: Agg[]; by: string[] } {
  const [left, right] = s.split(/\s+by\s+/i);
  const by = right ? right.split(/[\s,]+/).filter(Boolean) : [];
  const aggs: Agg[] = [];
  const re = /(\w+)(?:\(([\w.]*)\))?(?:\s+as\s+([\w.]+))?/gi;
  let m: RegExpExecArray | null;
  const body = left.trim();
  if (!body) throw new SiemError('stats needs something to calculate, such as count or dc(user).');
  while ((m = re.exec(body))) {
    const fn = m[1].toLowerCase();
    if (!['count', 'dc', 'sum', 'avg', 'min', 'max', 'values', 'distinct_count', 'earliest', 'latest'].includes(fn)) {
      throw new SiemError(`Unknown function ${m[1]}. Use count, dc(field), sum(field), avg(field), min(field), max(field) or values(field).`);
    }
    if (fn !== 'count' && !m[2]) throw new SiemError(`${fn} needs a field, like ${fn}(bytes).`);
    aggs.push({ fn: fn === 'distinct_count' ? 'dc' : fn, field: m[2] || undefined, as: m[3] ?? (m[2] ? `${fn}(${m[2]})` : 'count') });
  }
  return { aggs, by };
}

function aggregate(rows: Row[], aggs: Agg[], by: string[]): { cols: string[]; rows: Row[] } {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (by.some(b => r[b] === undefined)) continue;
    const k = by.map(b => r[b]).join('\u0000');
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(r);
  }
  if (!by.length && !groups.size) groups.set('', []);
  const out: Row[] = [];
  for (const [k, g] of groups) {
    const row: Row = {};
    if (by.length) k.split('\u0000').forEach((v, i) => (row[by[i]] = v));
    for (const a of aggs) {
      const vals = a.field ? g.map(r => r[a.field!]).filter((v): v is string => v !== undefined && v !== '') : [];
      const nums = vals.filter(isNum).map(Number);
      switch (a.fn) {
        case 'count': row[a.as] = String(a.field ? vals.length : g.length); break;
        case 'dc': row[a.as] = String(new Set(vals).size); break;
        case 'sum': row[a.as] = fmtNum(nums.reduce((s, n) => s + n, 0)); break;
        case 'avg': row[a.as] = nums.length ? fmtNum(nums.reduce((s, n) => s + n, 0) / nums.length) : ''; break;
        case 'min': row[a.as] = nums.length ? fmtNum(Math.min(...nums)) : vals.sort()[0] ?? ''; break;
        case 'max': row[a.as] = nums.length ? fmtNum(Math.max(...nums)) : vals.sort().slice(-1)[0] ?? ''; break;
        case 'values': row[a.as] = [...new Set(vals)].sort().join(', '); break;
        case 'earliest': row[a.as] = vals[vals.length - 1] ?? ''; break;
        case 'latest': row[a.as] = vals[0] ?? ''; break;
      }
    }
    out.push(row);
  }
  out.sort((a, b) => by.map(f => cmpVals(a[f], b[f])).find(x => x !== 0) ?? 0);
  return { cols: [...by, ...aggs.map(a => a.as)], rows: out };
}

function cmpVals(a: string | undefined, b: string | undefined): number {
  if (a === undefined) return b === undefined ? 0 : 1;
  if (b === undefined) return -1;
  if (isNum(a) && isNum(b)) return Number(a) - Number(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

function parseSpan(s: string | undefined): number {
  if (!s) return 300;
  const m = /^(\d+)(s|m|min|h)$/.exec(s);
  if (!m) throw new SiemError(`span=${s} is not a time span. Use, for example, span=30s, span=1m or span=1h.`);
  return Number(m[1]) * (m[2] === 's' ? 1 : m[2] === 'h' ? 3600 : 60);
}

export interface SiemRange { from: number; to: number }

export function runSiem(query: string, events: Ev[], range: SiemRange): SiemResult {
  const segs = splitPipes(query);
  const first = segs[0];
  const startsWithCmd = SIEM_COMMANDS.includes(first.split(/\s+/)[0]) && first.split(/\s+/)[0] !== 'search';
  const searchText = startsWithCmd ? '' : first.replace(/^search\s+/, '');
  const cmds = startsWithCmd ? segs : segs.slice(1);
  const pred = compileSearch(searchText);

  // Newest first, like a SIEM's event view.
  let evs = events.filter(e => e.t >= range.from && e.t <= range.to);
  let rows: Row[] = [];
  const evOf = new Map<Row, Ev>();
  for (let i = evs.length - 1; i >= 0; i--) {
    const r = rowOf(evs[i]);
    if (pred(r)) { rows.push(r); evOf.set(r, evs[i]); }
  }
  let cols: string[] | null = null;
  let chart: { span: number; buckets: { t: number; n: number }[] } | null = null;
  const extra: string[] = [];

  for (const seg of cmds) {
    if (!seg) throw new SiemError('There is an empty step between two pipes.');
    const [name, ...restParts] = seg.split(/\s+/);
    const rest = restParts.join(' ');
    const cmd = name.toLowerCase();
    if (!SIEM_COMMANDS.includes(cmd)) throw new SiemError(`Unknown command "${name}". Commands: ${SIEM_COMMANDS.join(', ')}.`);
    if (TRANSFORMING.has(cmd)) chart = null;
    switch (cmd) {
      case 'search': { const p = compileSearch(rest); rows = rows.filter(p); break; }
      case 'stats': {
        const { aggs, by } = parseAggs(rest);
        const r = aggregate(rows, aggs, by);
        rows = r.rows;
        cols = r.cols;
        break;
      }
      case 'top': case 'rare': {
        const m = /^(?:limit=(\d+)\s+|(\d+)\s+)?([\w.]+)(?:\s+by\s+([\w.]+))?$/i.exec(rest.trim());
        if (!m) throw new SiemError(`${cmd} needs a field, like: ${cmd} src  or  ${cmd} limit=5 user`);
        const limit = Number(m[1] ?? m[2] ?? 10);
        const f = m[3];
        const r = aggregate(rows, [{ fn: 'count', as: 'count' }], [f]);
        const total = r.rows.reduce((s, x) => s + Number(x['count']), 0) || 1;
        r.rows.sort((a, b) => (cmd === 'top' ? Number(b['count']) - Number(a['count']) : Number(a['count']) - Number(b['count'])) || cmpVals(a[f], b[f]));
        rows = r.rows.slice(0, limit).map(x => ({ ...x, percent: (Number(x['count']) * 100 / total).toFixed(1) }));
        cols = [f, 'count', 'percent'];
        break;
      }
      case 'timechart': {
        const m = /^(?:span=(\S+)\s+)?(?:count)(?:\s+by\s+([\w.]+))?(?:\s+span=(\S+))?$/i.exec(rest.trim());
        if (!m) throw new SiemError('Use: timechart span=1m count   (or: timechart span=5m count by host)');
        const span = parseSpan(m[1] ?? m[3]);
        const byField = m[2];
        const start = Math.floor(range.from / span) * span;
        const n = Math.max(1, Math.ceil((range.to + 1 - start) / span));
        if (n > 1500) throw new SiemError('That span makes too many buckets for this time range; use a bigger span.');
        const timeOf = (r: Row) => { const [h, mi, s] = (r['_time'] ?? '0:0:0').split(':').map(Number); return h * 3600 + mi * 60 + s; };
        if (byField) {
          const keys = [...new Set(rows.map(r => r[byField]).filter((v): v is string => v !== undefined))].sort().slice(0, 10);
          const table: Row[] = Array.from({ length: n }, (_, i) => ({ _time: hms(start + i * span).slice(0, span < 60 ? 8 : 5), ...Object.fromEntries(keys.map(k => [k, '0'])) }));
          for (const r of rows) {
            const k = r[byField];
            if (k === undefined || !keys.includes(k)) continue;
            const b = Math.floor((timeOf(r) - start) / span);
            if (b >= 0 && b < n) table[b][k] = String(Number(table[b][k]) + 1);
          }
          rows = table;
          cols = ['_time', ...keys];
        } else {
          const buckets = Array.from({ length: n }, (_, i) => ({ t: start + i * span, n: 0 }));
          for (const r of rows) {
            const b = Math.floor((timeOf(r) - start) / span);
            if (b >= 0 && b < n) buckets[b].n++;
          }
          chart = { span, buckets };
          rows = buckets.map(b => ({ _time: hms(b.t).slice(0, span < 60 ? 8 : 5), count: String(b.n) }));
          cols = ['_time', 'count'];
        }
        break;
      }
      case 'table': case 'fields': {
        const fs = rest.split(/[\s,]+/).filter(Boolean).filter(f => f !== '+');
        if (!fs.length) throw new SiemError(`${cmd} needs field names, like: ${cmd} _time src user`);
        if (fs[0] === '-') {
          const drop = new Set(fs.slice(1));
          cols = (cols ?? [...new Set(rows.flatMap(r => Object.keys(r)))].filter(k => k !== '_raw')).filter(c => !drop.has(c));
        } else cols = fs;
        rows = rows.map(r => Object.fromEntries(cols!.map(c => [c, r[c] ?? ''])));
        break;
      }
      case 'sort': {
        const parts = rest.split(/[\s,]+/).filter(Boolean);
        let limit = Infinity;
        if (parts[0] && /^\d+$/.test(parts[0])) limit = Number(parts.shift());
        if (!parts.length) throw new SiemError('sort needs a field: sort -count sorts biggest first, sort src A to Z.');
        const keys = parts.map(p => ({ f: p.replace(/^[-+]/, ''), desc: p.startsWith('-') }));
        rows = [...rows].sort((a, b) => {
          for (const k of keys) { const c = cmpVals(a[k.f], b[k.f]); if (c) return k.desc ? -c : c; }
          return 0;
        }).slice(0, limit);
        break;
      }
      case 'head': case 'tail': {
        const n = rest.trim() ? Number(rest.trim().replace(/^limit=/, '')) : 10;
        if (!Number.isInteger(n) || n < 0) throw new SiemError(`${cmd} takes a number, like ${cmd} 5`);
        rows = cmd === 'head' ? rows.slice(0, n) : rows.slice(-n);
        break;
      }
      case 'dedup': {
        const fs = rest.split(/[\s,]+/).filter(Boolean);
        if (!fs.length) throw new SiemError('dedup needs a field, like: dedup src');
        const seen = new Set<string>();
        rows = rows.filter(r => { if (fs.some(f => r[f] === undefined)) return false; const k = fs.map(f => r[f]).join('\u0000'); if (seen.has(k)) return false; seen.add(k); return true; });
        break;
      }
      case 'where': {
        if (!rest.trim()) throw new SiemError('where needs a condition, like: where count > 20');
        const f = compileExpr(rest);
        rows = rows.filter(r => { const v = f(r); return typeof v === 'number' ? v !== 0 : v !== ''; });
        break;
      }
      case 'eval': {
        const m = /^([A-Za-z_][\w.]*)\s*=\s*(.+)$/.exec(rest.trim());
        if (!m) throw new SiemError('Use: eval newfield=expression, for example eval qlen=len(query)');
        const f = compileExpr(m[2]);
        rows = rows.map(r => {
          const v = f(r);
          const nr = { ...r, [m[1]]: typeof v === 'number' ? (isNaN(v) ? '' : fmtNum(v)) : v };
          const e = evOf.get(r);
          if (e) evOf.set(nr, e);
          return nr;
        });
        if (cols && !cols.includes(m[1])) cols = [...cols, m[1]];
        if (!cols && !extra.includes(m[1])) extra.push(m[1]);
        break;
      }
      case 'rename': {
        const m = /^([\w.()]+)\s+as\s+([\w.]+)$/i.exec(rest.trim());
        if (!m) throw new SiemError('Use: rename oldname as newname');
        rows = rows.map(r => { const { [m[1]]: v, ...others } = r; return v === undefined ? r : { ...others, [m[2]]: v }; });
        if (cols) cols = cols.map(c => (c === m[1] ? m[2] : c));
        break;
      }
    }
  }

  if (chart && cols) return { kind: 'chart', span: chart.span, buckets: chart.buckets, cols, rows };
  if (cols) return { kind: 'table', cols, rows };
  return { kind: 'events', events: rows.map(r => evOf.get(r)!).filter(Boolean), rows, extra };
}

/** The fields in a set of events, with their most common values, for the side panel. */
export function fieldSummary(rows: Row[], limit = 5): { field: string; distinct: number; top: { v: string; n: number }[] }[] {
  const counts = new Map<string, Map<string, number>>();
  for (const r of rows) {
    for (const [k, v] of Object.entries(r)) {
      if (k === '_raw' || k === '_time') continue;
      let m = counts.get(k);
      if (!m) counts.set(k, (m = new Map()));
      m.set(v, (m.get(v) ?? 0) + 1);
    }
  }
  const order = ['source', 'host'];
  return [...counts.entries()]
    .map(([field, m]) => ({ field, distinct: m.size, top: [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, limit).map(([v, n]) => ({ v, n })) }))
    .sort((a, b) => (order.indexOf(a.field) + 1 || 99) - (order.indexOf(b.field) + 1 || 99) || (a.field < b.field ? -1 : 1));
}
