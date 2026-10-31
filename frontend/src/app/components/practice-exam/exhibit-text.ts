/**
 * Splitting text exhibits into the pieces their on-screen look needs: timestamps and field names in a log, the
 * prompt in a terminal, comments in a file, headers in a message. The text itself is never changed.
 */

export interface Segment {
  t: string;
  /** `time` for a timestamp, `key` for a field name such as "user=". */
  k?: 'time' | 'key';
}

export interface LogLine {
  parts: Segment[];
  /** A line about the log rather than in it: "... 250 more", "(no further entries)". */
  aside: boolean;
}

// Timestamps as logs write them: 2026-10-12 02:14:07, 2026-10-14T13:02:11Z, Sat 23:41, 06-14 02:10, 10:41:02.113,
// 01:40-02:11. A bare time needs a colon, so ports like "443" and sizes are left alone.
const TIME = String.raw`\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{2}:\d{2}(?::\d{2})?|\d{2}-\d{2} \d{2}:\d{2}|\b\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:-\d{2}:\d{2})?\b`;
const KEY = String.raw`\b[A-Za-z_][\w.-]*=`;
const TOKENS = new RegExp(`(${TIME})|(${KEY})`, 'g');

/** One log line cut into plain text, timestamps and field names. Only a timestamp near the start counts as one. */
export function logLine(line: string): LogLine {
  const aside = /^\s*(\.\.\.|\()/.test(line);
  const parts: Segment[] = [];
  let at = 0;
  for (const m of line.matchAll(TOKENS)) {
    const i = m.index ?? 0;
    const time = m[1] !== undefined && i < 24;
    if (!time && m[2] === undefined) continue;
    if (i > at) parts.push({ t: line.slice(at, i) });
    parts.push({ t: m[0], k: time ? 'time' : 'key' });
    at = i + m[0].length;
  }
  if (at < line.length) parts.push({ t: line.slice(at) });
  return { parts: merge(parts), aside };
}

/** Joins neighbouring plain pieces, which appear when a far-off "time" is skipped. */
function merge(parts: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last && !last.k && !p.k) last.t += p.t;
    else out.push({ ...p });
  }
  return out;
}

export interface TerminalLine {
  prompt?: string;
  text: string;
}

const PROMPT = /^(\$ |PS> |C:\\> |[\w-]+# )/;

/** A terminal session: lines that start with a prompt are commands, the rest is output. */
export function terminalLines(text: string): TerminalLine[] {
  return text.split('\n').map(line => {
    const m = line.match(PROMPT);
    return m ? { prompt: m[1], text: line.slice(m[1].length) } : { text: line };
  });
}

export interface FileLine {
  text: string;
  comment: boolean;
}

/** A config or code file, with comment lines (#, //, !, ;) marked so they can be dimmed. */
export function fileLines(text: string): FileLine[] {
  return text.split('\n').map(line => ({ text: line, comment: /^\s*(#|\/\/|!|;)/.test(line) }));
}

export interface Message {
  /** Header lines; a folded continuation line has an empty name. The first line of an HTTP message has none. */
  headers: { name: string; value: string }[];
  body: string;
}

/** An email or HTTP message: headers up to the first blank line, then the body. */
export function message(text: string): Message {
  const lines = text.split('\n');
  const blank = lines.findIndex(l => !l.trim());
  const head = blank < 0 ? lines : lines.slice(0, blank);
  const headers = head.map(line => {
    const m = line.match(/^([A-Za-z][\w-]*):\s+(.*)$/);
    return m ? { name: m[1], value: m[2] } : { name: '', value: line.trim() };
  });
  return { headers, body: blank < 0 ? '' : lines.slice(blank + 1).join('\n') };
}
