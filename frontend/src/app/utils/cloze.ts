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
