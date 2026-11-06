/** Text helpers the shell commands share: POSIX regular expressions in JavaScript, printf, sha256. */

const CLASSES: Record<string, string> = {
  alpha: 'A-Za-z', digit: '0-9', alnum: 'A-Za-z0-9', upper: 'A-Z', lower: 'a-z', space: ' \\t\\n\\r\\f\\v',
  blank: ' \\t', punct: '!-\\/:-@\\[-`{-~', xdigit: '0-9A-Fa-f', word: 'A-Za-z0-9_',
};

/**
 * Turns a grep or sed pattern into a JavaScript one. Basic regular expressions (the default) treat + ? | ( ) { }
 * as plain characters unless escaped; extended ones (-E) treat them as operators, like JavaScript does.
 */
export function posixRegex(pattern: string, extended: boolean): string {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '[') {
      // Bracket expressions pass through, with [:class:] names expanded.
      let j = i + 1;
      let body = '';
      if (pattern[j] === '^') { body += '^'; j++; }
      if (pattern[j] === ']') { body += '\\]'; j++; }
      while (j < pattern.length && pattern[j] !== ']') {
        const m = /^\[:(\w+):\]/.exec(pattern.slice(j));
        if (m && CLASSES[m[1]]) { body += CLASSES[m[1]]; j += m[0].length; continue; }
        if (pattern[j] === '\\') body += '\\\\';
        else body += pattern[j];
        j++;
      }
      if (j >= pattern.length) { out += '\\['; continue; }
      out += `[${body}]`;
      i = j;
      continue;
    }
    if (c === '\\' && i + 1 < pattern.length) {
      const n = pattern[++i];
      if (!extended && '+?|(){}'.includes(n)) out += n;
      else if ('wWsSbBdD'.includes(n)) out += '\\' + n;
      else if (/[1-9]/.test(n)) out += '\\' + n;
      else if (n === '<' || n === '>') out += '\\b';
      else out += escapeRe(n);
      continue;
    }
    if (!extended && '+?|(){}'.includes(c)) { out += '\\' + c; continue; }
    out += c;
  }
  return out;
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Builds a RegExp, or returns the error message the real tool would give. */
export function makeRegex(source: string, flags: string): RegExp | string {
  try {
    return new RegExp(source, flags);
  } catch {
    return 'Invalid regular expression';
  }
}

/** A glob (*.log, file?.txt, [ab]*) as a RegExp. */
export function globRegex(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[') {
      const j = glob.indexOf(']', i + 1);
      if (j < 0) re += '\\[';
      else { re += '[' + glob.slice(i + 1, j).replace(/^!/, '^') + ']'; i = j; }
    } else re += escapeRe(c);
  }
  return new RegExp(`^${re}$`);
}

/** printf-style formatting: %s %d %i %f %x %c %% with flags, width and precision. */
export function format(fmt: string, args: (string | number)[], escapes = true): string {
  let i = 0;
  const next = () => (i < args.length ? args[i++] : '');
  let s = escapes ? unescape(fmt) : fmt;
  s = s.replace(/%([-+ 0#]*)(\d+|\*)?(?:\.(\d+|\*))?([sdifgexXoc%])/g, (_m, flags: string, width: string, prec: string, conv: string) => {
    if (conv === '%') return '%';
    const w = width === '*' ? Number(next()) : width ? Number(width) : 0;
    const p = prec === '*' ? Number(next()) : prec !== undefined ? Number(prec) : undefined;
    const a = next();
    let body: string;
    switch (conv) {
      case 's': body = String(a); if (p !== undefined) body = body.slice(0, p); break;
      case 'c': body = String(a).charAt(0); break;
      case 'd': case 'i': body = String(Math.trunc(toNum(a))); break;
      case 'f': body = toNum(a).toFixed(p ?? 6); break;
      case 'e': body = toNum(a).toExponential(p ?? 6); break;
      case 'g': body = String(Number(toNum(a).toPrecision(p || 6))); break;
      case 'x': body = Math.trunc(toNum(a)).toString(16); break;
      case 'X': body = Math.trunc(toNum(a)).toString(16).toUpperCase(); break;
      case 'o': body = Math.trunc(toNum(a)).toString(8); break;
      default: body = String(a);
    }
    if (flags.includes('+') && /[dif]/.test(conv) && toNum(a) >= 0) body = '+' + body;
    if (body.length < w) {
      if (flags.includes('-')) body = body.padEnd(w);
      else if (flags.includes('0') && /[difxXo]/.test(conv)) body = (body.startsWith('-') ? '-' + body.slice(1).padStart(w - 1, '0') : body.padStart(w, '0'));
      else body = body.padStart(w);
    }
    return body;
  });
  return s;
}

export function toNum(v: string | number): number {
  if (typeof v === 'number') return v;
  const m = /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(v);
  return m ? Number(m[0]) : 0;
}

/** Backslash escapes in echo -e and printf. */
export function unescape(s: string): string {
  return s.replace(/\\(n|t|r|\\|a|b|e|0|")/g, (_m, c: string) =>
    ({ n: '\n', t: '\t', r: '\r', '\\': '\\', a: '', b: '', e: '', '0': '', '"': '"' } as Record<string, string>)[c]);
}

/** SHA-256 of a string's UTF-8 bytes, as hex. */
export function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bits >>> 0);
  dv.setUint32(padded.length - 8, Math.floor(bits / 2 ** 32));
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map(x => x.toString(16).padStart(8, '0')).join('');
}

/** Splits text into lines, dropping the empty piece after a final newline. */
export function lines(text: string): string[] {
  if (!text) return [];
  const ls = text.split('\n');
  if (ls[ls.length - 1] === '') ls.pop();
  return ls;
}

export const joinLines = (ls: string[]) => (ls.length ? ls.join('\n') + '\n' : '');
