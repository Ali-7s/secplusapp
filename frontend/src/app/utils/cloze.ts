/**
 * Helpers for the cloze ("type the answer") flashcard modes.
 *
 * A cloze card shows a description and asks for the name it describes, but descriptions very often
 * repeat that name ("CCMP is the encryption protocol used in WPA2..."), which gives the answer away.
 * maskAnswer() blanks those mentions out before the description is shown.
 */

export const CLOZE_BLANK = '_____';

/** Characters that separate the parts of a name: "SD-WAN", "TCP/IP", "ATT&CK", "PCI DSS", "SE Linux". */
const SEPARATOR = String.raw`[\s\-/&]`;

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Regex source matching `phrase` however its parts are separated, so "SE Linux" also matches
 * "SELinux" and "SE-Linux", and "Time-of-check" also matches "time of check".
 */
function phraseSource(phrase: string): string {
  return phrase
    .split(new RegExp(`${SEPARATOR}+`))
    .filter(Boolean)
    .map(escapeRegExp)
    .join(`${SEPARATOR}*`);
}

/** Other written forms of an answer that give it away just as much ("TTPs" -> "TTP", "Policy" -> "Policies"). */
function inflections(answer: string): string[] {
  const forms: string[] = [];
  if (/[A-Z]s$/.test(answer)) forms.push(answer.slice(0, -1));
  else if (/(?:s|x|z|ch|sh)$/.test(answer)) forms.push(answer + 'es');
  if (/[^aeiou]y$/.test(answer)) forms.push(answer.slice(0, -1) + 'ies');
  return forms;
}

/** A piece of a description: either ordinary text or a mention of the card's answer. */
export interface ClozeSpan {
  text: string;
  answer: boolean;
}

/**
 * Splits `text` into ordinary text and mentions of any of `answers`, so the mentions can be blanked out before
 * the answer is checked and highlighted after it, showing where the blanks were.
 *
 * - Matches whole names only, ignoring case: "IP" leaves "IPv4" and "description" alone.
 * - A trailing plural or possessive belongs to the name ("ACLs", "ACL's", "Checksums").
 * - Parts may be separated by a space, hyphen, slash or ampersand, or not at all.
 */
export function answerSpans(text: string | null | undefined, answers: ReadonlyArray<string | null | undefined>): ClozeSpan[] {
  if (!text) return [];

  const names = new Set<string>();
  for (const answer of answers) {
    const trimmed = answer?.trim();
    if (!trimmed) continue;
    names.add(trimmed);
    inflections(trimmed).forEach(form => names.add(form));
  }

  // Longest first, so a full phrase is matched before any shorter name that appears inside it.
  const ordered = [...names].sort((a, b) => b.length - a.length);

  let spans: ClozeSpan[] = [{ text, answer: false }];
  for (const name of ordered) {
    const pattern = new RegExp(`(^|[^A-Za-z0-9])(${phraseSource(name)})(s|'s|’s)?(?![A-Za-z0-9])`, 'gi');
    spans = spans.flatMap(span => (span.answer ? [span] : splitOn(span.text, pattern)));
  }
  return spans.filter(span => span.text);
}

function splitOn(text: string, pattern: RegExp): ClozeSpan[] {
  const spans: ClozeSpan[] = [];
  let from = 0;
  for (const match of text.matchAll(pattern)) {
    const [whole, before, name, suffix] = match;
    // "ACLS" is a different word from "ACL" plus a plural "s", so only a lower-case suffix is treated as one.
    if (suffix === 'S') continue;
    const start = match.index! + before.length;
    spans.push({ text: text.slice(from, start), answer: false }, { text: name + (suffix ?? ''), answer: true });
    from = match.index! + whole.length;
  }
  spans.push({ text: text.slice(from), answer: false });
  return spans;
}

/**
 * Replaces every mention of any of `answers` in `text` with a blank (see answerSpans for what counts as one).
 * When a name and its expansion sit side by side, they collapse into one blank:
 * "Address Resolution Protocol (ARP)" becomes "_____".
 */
export function maskAnswer(text: string | null | undefined, answers: ReadonlyArray<string | null | undefined>): string {
  const masked = answerSpans(text, answers).map(span => (span.answer ? CLOZE_BLANK : span.text)).join('');
  const blank = escapeRegExp(CLOZE_BLANK);
  return masked
    .replace(new RegExp(`${blank}\\s*\\(\\s*${blank}\\s*\\)`, 'g'), CLOZE_BLANK)
    .replace(new RegExp(`${blank}(?:\\s+${blank})+`, 'g'), CLOZE_BLANK);
}

interface AcronymLike {
  acronym: string;
  expansion?: string;
}

const normalise = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * The other card a wrong answer names, if it names one: typing "IPsec" for AH ("_____ is an IPsec protocol...")
 * is a near miss worth explaining, since the description mentions the bigger thing the answer belongs to.
 */
export function otherCardNamed<T>(input: string, card: T, deck: ReadonlyArray<T>, name: (c: T) => string): T | undefined {
  const typed = normalise(input);
  if (!typed) return undefined;
  return deck.find(other => other !== card && normalise(name(other)) === typed);
}

/**
 * Checks a typed answer on an acronym cloze card.
 *
 * The typed text has to be the card's acronym, ignoring case, spaces and punctuation ("smime" = "S/MIME",
 * "aes 256" = "AES-256"). Part of an acronym does not count ("A" for "AES"), and neither does a different
 * card's acronym ("AES" for "AES-256"), unless that card is a synonym for the same expansion (TTP / TTPs,
 * CSRF / XSRF).
 */
export function isAcronymClozeCorrect(input: string, card: AcronymLike, deck: ReadonlyArray<AcronymLike>): boolean {
  const typed = normalise(input);
  if (!typed) return false;
  if (typed === normalise(card.acronym)) return true;

  const expansion = card.expansion?.trim().toLowerCase();
  if (!expansion) return false;
  return deck.some(
    other => other !== card && other.expansion?.trim().toLowerCase() === expansion && normalise(other.acronym) === typed,
  );
}

// ── Key Terms ─────────────────────────────────────────────────────────────

/** A term's words in a form to compare: lower case, "&" read as "and", plurals and a leading article dropped. */
function termWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(w => (w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w));
  return ['a', 'an', 'the'].includes(words[0]) ? words.slice(1) : words;
}

/** The ways of writing a term that count as the term: whole, and without a trailing "attack". */
function termForms(term: string): string[] {
  const words = termWords(term);
  const forms = [words.join('')];
  if (words.length > 1 && words[words.length - 1] === 'attack') forms.push(words.slice(0, -1).join(''));
  return forms;
}

/** How many slips turn `a` into `b`: a letter added, dropped or changed, or two neighbours swapped. */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * Checks a typed answer on a Key Terms cloze card. The answer has to be the whole term, though case, spacing,
 * punctuation, plurals, a leading "a" or "the" and a trailing "attack" do not matter ("on path" for "On-path
 * attack", "biometric" for "Biometrics"). Part of a term does not count ("access" for "Access control"). One
 * slip of the keyboard in a longer term is forgiven ("phising", "socail engineering"), unless what was typed is another term.
 */
export function isTermClozeCorrect(input: string, term: string, allTerms: ReadonlyArray<string>): boolean {
  const typed = termWords(input).join('');
  if (!typed) return false;
  const own = termForms(term);
  if (own.includes(typed)) return true;
  if (allTerms.some(other => other !== term && termForms(other).includes(typed))) return false;
  return own.some(form => form.length >= 7 && editDistance(typed, form) <= 1);
}
