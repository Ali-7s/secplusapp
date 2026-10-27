/**
 * Maps the official exam objectives onto the app's study material, so you can see which topics have a glossary
 * card and practice questions, and which are thin. Pure functions only (no Angular), so they can be unit tested
 * and reused by the authoring scripts.
 */

/** One topic from an objective's outline. Leaves are the topics coverage is measured on. */
export interface ObjectiveTopic {
  name: string;
  /** Glossary cards (acronym or term names) that teach this topic when its own name does not match one. */
  see?: string[];
  sub?: ObjectiveTopic[];
}

export interface ExamObjective {
  id: string;
  domain: number;
  title: string;
  topics: ObjectiveTopic[];
}

export interface GlossaryCard {
  kind: 'acr' | 'term';
  name: string;
  /** What the acronym stands for. */
  expansion?: string;
}

/** A practice question, reduced to what coverage needs. */
export interface CoverageQuestion {
  id: string;
  objective: string;
  /** Stem, options and explanations, already normalized with `normalize`. */
  text: string;
}

export interface TopicCoverage {
  /** "Zero Trust > Control Plane > Adaptive identity". */
  path: string;
  name: string;
  cards: GlossaryCard[];
  /** Questions on this objective that mention the topic. */
  questions: string[];
  status: 'covered' | 'partial' | 'gap';
}

/**
 * Lower case words with plurals folded ("Certificate authorities" and "certificate authority" match). Acronyms
 * written in capitals keep a final S, so RTOS stays apart from RTO and IPS from IP; "APIs" still folds to "api".
 */
export function normalize(text: string): string {
  return text
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(word => (/^[A-Z0-9]{2,}$/.test(word) ? word.toLowerCase() : stem(word.toLowerCase())))
    .join(' ');
}

function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us') && !(word.endsWith('is') && word.length > 5)) return word.slice(0, -1);
  return word;
}

/** Abbreviations given in brackets: "Hardware security module (HSM)" gives HSM. */
function abbreviations(name: string): string[] {
  return [...name.matchAll(/\(([A-Za-z0-9.\-/ ]+)\)/g)].flatMap(m => m[1].split('/')).map(s => s.trim()).filter(Boolean);
}

/**
 * The names a topic could go by: its own name without brackets, each side of "A/B" and "A vs. B", and, for a
 * short word like "Hot" or "Preventive", the word joined to its heading ("Hot site", "Preventive control").
 */
export function topicNames(name: string, parent?: string): string[] {
  const plain = name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const out = new Set<string>([plain]);
  for (const part of plain.split(/\s*\/\s*|\s+vs\.?\s+/i)) if (part.trim()) out.add(part.trim());
  if (parent && plain.split(' ').length <= 2) {
    const head = parent.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/);
    for (const n of [1, 2, head.length]) out.add(`${plain} ${head.slice(0, n).join(' ')}`);
  }
  return [...out].map(normalize).filter(s => s.length > 1);
}

/** Looks glossary cards up by acronym, expansion or term name, all normalized. */
export function glossaryIndex(cards: GlossaryCard[]): Map<string, GlossaryCard[]> {
  const index = new Map<string, GlossaryCard[]>();
  const add = (key: string, card: GlossaryCard) => {
    const k = normalize(key);
    if (!k) return;
    const list = index.get(k) ?? [];
    if (!list.includes(card)) list.push(card);
    index.set(k, list);
  };
  for (const c of cards) {
    add(c.name, c);
    if (c.expansion) add(c.expansion, c);
    // "Zero Trust Architecture (ZTA)" can be found as either half.
    const bare = c.name.replace(/\([^)]*\)/g, ' ').trim();
    if (bare !== c.name) add(bare, c);
  }
  return index;
}

/** Cards that teach a topic: by its names, its abbreviations, and any `see` links. */
export function cardsFor(topic: ObjectiveTopic, parent: string | undefined, index: Map<string, GlossaryCard[]>): GlossaryCard[] {
  const found: GlossaryCard[] = [];
  const add = (list?: GlossaryCard[]) => list?.forEach(c => { if (!found.includes(c)) found.push(c); });
  for (const s of topic.see ?? []) add(index.get(normalize(s)));
  for (const a of abbreviations(topic.name)) add(index.get(normalize(a))?.filter(c => c.kind === 'acr'));
  for (const n of topicNames(topic.name, parent)) add(index.get(n));
  return found;
}

/** Whether `needle` appears in `text` as whole words (both already normalized). */
function mentions(text: string, needle: string): boolean {
  return ` ${text} `.includes(` ${needle} `);
}

/** Every leaf topic of an objective with the cards and questions that cover it. */
export function objectiveCoverage(objective: ExamObjective, index: Map<string, GlossaryCard[]>, questions: CoverageQuestion[]): TopicCoverage[] {
  const own = questions.filter(q => q.objective === objective.id);
  const out: TopicCoverage[] = [];
  const walk = (topics: ObjectiveTopic[], path: string[]) => {
    for (const t of topics) {
      if (t.sub?.length) {
        walk(t.sub, [...path, t.name]);
        continue;
      }
      const parent = path[path.length - 1];
      const cards = cardsFor(t, parent, index);
      const needles = new Set([
        ...topicNames(t.name, parent),
        ...abbreviations(t.name).map(normalize),
        ...(t.see ?? []).map(normalize),
        ...cards.map(c => normalize(c.name)),
      ]);
      const hits = own.filter(q => [...needles].some(n => mentions(q.text, n))).map(q => q.id);
      out.push({
        path: [...path, t.name].join(' > '),
        name: t.name,
        cards,
        questions: hits,
        status: cards.length && hits.length ? 'covered' : cards.length || hits.length ? 'partial' : 'gap',
      });
    }
  };
  walk(objective.topics, []);
  return out;
}

/**
 * Turns an indented outline into topics: "Heading" then "  Item" lines, two spaces per level. A topic taught by
 * a card with another name links to it after "=>", with several names separated by ";":
 * "Unskilled attacker => Script kiddie".
 */
export function parseOutline(text: string): ObjectiveTopic[] {
  const root: ObjectiveTopic[] = [];
  const stack: ObjectiveTopic[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const depth = Math.floor((line.length - line.trimStart().length) / 2);
    const [name, links] = line.trim().split(/\s*=>\s*/);
    const node: ObjectiveTopic = { name };
    if (links) node.see = links.split(/\s*;\s*/).filter(Boolean);
    stack.length = depth;
    const parent = stack[depth - 1];
    if (parent) (parent.sub ??= []).push(node);
    else root.push(node);
    stack[depth] = node;
  }
  return root;
}

/** The objectives as topics, from the outlines in objectives.ts. */
export function buildObjectives(outlines: ReadonlyArray<readonly [id: string, title: string, outline: string]>): ExamObjective[] {
  return outlines.map(([id, title, outline]) => ({ id, domain: Number(id[0]), title, topics: parseOutline(outline) }));
}

/** Every string inside a question (stem, options, explanations), joined for `normalize`. */
export function collectText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(collectText).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(collectText).join(' ');
  return '';
}
