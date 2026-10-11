/**
 * Guards the key points that brain dump mode checks explanations against (public/data/braindump-*.json).
 *
 * A card without written points still works, because brain dump falls back to the sentences of its definition,
 * but the checklist is much better with points. So these tests ask for every card to have them, and for the points
 * file not to keep entries for cards that were renamed or removed.
 */
describe('brain dump key points', () => {
  const decks = [
    { deck: 'acronyms', key: 'acronym' },
    { deck: 'terms', key: 'term' },
  ] as const;

  const load = async <T>(path: string): Promise<T> => {
    const response = await fetch(path);
    expect(response.ok).withContext(path).toBeTrue();
    return response.json() as Promise<T>;
  };

  for (const { deck, key } of decks) {
    describe(deck, () => {
      let names: string[];
      let points: Record<string, string[]>;

      beforeAll(async () => {
        const cards = await load<Array<Record<string, string>>>(`/data/${deck}.json`);
        names = cards.map(card => card[key]);
        points = await load<Record<string, string[]>>(`/data/braindump-${deck}.json`);
      });

      it('has points for every card', () => {
        const missing = names.filter(name => !points[name]);
        expect(missing).withContext(`Add key points to braindump-${deck}.json for: ${missing.join(', ')}`).toEqual([]);
      });

      it('has no points for cards that no longer exist', () => {
        const known = new Set(names);
        const stale = Object.keys(points).filter(name => !known.has(name));
        expect(stale).withContext('Rename or remove these entries').toEqual([]);
      });

      it('gives each card three to six short, distinct points', () => {
        const problems: string[] = [];
        for (const [name, list] of Object.entries(points)) {
          if (!Array.isArray(list) || list.length < 3 || list.length > 6) problems.push(`${name}: ${list?.length} points`);
          const seen = new Set<string>();
          for (const point of list ?? []) {
            if (typeof point !== 'string' || point.length < 12 || point.length > 140) problems.push(`${name}: bad length "${point}"`);
            if (seen.has(point.toLowerCase())) problems.push(`${name}: repeated point "${point}"`);
            seen.add(point.toLowerCase());
          }
        }
        expect(problems).toEqual([]);
      });
    });
  }
});
