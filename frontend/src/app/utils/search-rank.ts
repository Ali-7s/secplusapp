/**
 * How well a card matches the search box, so the best matches are listed first. Lower is better, and null
 * means no match. Searching "PKI" puts the PKI card itself first, then acronyms that start with PKI, then
 * acronyms that contain it, then matches in the full name, and last the cards that only mention PKI in their
 * definition.
 *
 * `name` is what the card is called (the acronym or term), `longName` its spelled-out form (an acronym's
 * expansion, or empty), and `rest` the other searchable text (definition, analogy, comparison tables).
 */
export function searchRank(query: string, name: string, longName: string, rest: (string | undefined)[]): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const n = name.toLowerCase();
  const l = longName.toLowerCase();
  // The card's own name first (exact, then starts with, then a word in it, then anywhere), then its full name.
  if (n === q) return 0;
  if (l && l === q) return 1;
  if (n.startsWith(q)) return 2;
  if (startsAWord(n, q)) return 3;
  if (n.includes(q)) return 4;
  if (l && l.startsWith(q)) return 5;
  if (startsAWord(l, q)) return 6;
  if (l.includes(q)) return 7;
  const texts = rest.map(text => text?.toLowerCase() ?? '');
  if (texts.some(text => startsAWord(text, q))) return 8;
  // Mid-word matches in long text are noise for short searches ("aes" inside "phrases"), so only longer ones count.
  if (q.length >= 4 && texts.some(text => text.includes(q))) return 9;
  return null;
}

/** True when the query begins one of the words in the text ("key" in "public key infrastructure"). */
function startsAWord(text: string, q: string): boolean {
  return text.split(/[\s\-/(),.;:'"]+/).some(word => word.startsWith(q));
}

/** Filters items to those that match and orders them best match first, keeping the original order within a rank. */
export function rankBySearch<T>(items: T[], rank: (item: T) => number | null): T[] {
  return items
    .map((item, i) => ({ item, i, r: rank(item) }))
    .filter((x): x is { item: T; i: number; r: number } => x.r !== null)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.item);
}
