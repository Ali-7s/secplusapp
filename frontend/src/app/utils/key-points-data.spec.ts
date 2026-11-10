/**
 * Guards the key points Review checks a Key Terms explanation against (public/data/key-points-terms.json).
 *
 * A card without written points still works, because the checklist falls back to the sentences of its definition,
 * but it is much better with points. So these tests ask for every card to have them, and for the points file not
 * to keep entries for cards that were renamed or removed.
 */
describe('key points', () => {
  const decks = [{ deck: 'terms', key: 'term' }] as const;

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
        points = await load<Record<string, string[]>>(`/data/key-points-${deck}.json`);
      });

      it('has points for every card', () => {
        const missing = names.filter(name => !points[name]);
        expect(missing).withContext(`Add key points to key-points-${deck}.json for: ${missing.join(', ')}`).toEqual([]);
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
