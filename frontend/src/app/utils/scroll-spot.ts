/**
 * Where you are in a long page, as "part 3, its 5th paragraph (or heading, list item, table...) is at the top of
 * the screen, this far through it", rather than a pixel offset. The same lesson is taller on a phone than on a
 * laptop, so pixels would land somewhere else on another device; the paragraph is the same everywhere.
 *
 * The page marks each part with a `data-part` attribute holding its number. A part can be on the page alone
 * (one part at a time) or with all the others (the whole lesson), and a spot works in both.
 */

export interface ScrollSpot {
  /** The part at the top of the screen. */
  part: number;
  /** Index of the element at the top of the screen among the part's readable elements, or -1 for the very top. */
  i: number;
  /**
   * How far through that element the top of the screen is, 0 to 1. Outside that range when the top of the screen
   * is on something with no text to measure from, such as an interactive diagram just before or after it.
   */
  f: number;
}

/** The elements a position is measured from, in document order. */
const ANCHORS = 'h1, h2, h3, h4, p, li, pre, table, figure, blockquote';

/** The line on screen a position refers to: a little below the top, clear of the app bar. */
const LINE = 96;

const parts = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-part]')];

const anchors = (part: HTMLElement) => [...part.querySelectorAll<HTMLElement>(ANCHORS)].filter(el => el.offsetParent !== null);

const partNumber = (el: HTMLElement) => Number(el.dataset['part']);

/** The spot at the reading line now, or null when the line is past every part (in the flashcards or pager). */
export function readSpot(root: HTMLElement, scroller: HTMLElement): ScrollSpot | null {
  const all = parts(root);
  if (!all.length) return null;
  if (scroller.scrollTop < 8) return { part: partNumber(all[0]), i: -1, f: 0 };
  const line = scroller.getBoundingClientRect().top + LINE;
  // The part under the reading line, or else the first one below it.
  const part = all.find(p => p.getBoundingClientRect().bottom > line);
  if (!part) return null;
  const list = anchors(part);
  if (!list.length) return { part: partNumber(part), i: -1, f: 0 };
  const found = list.findIndex(el => el.getBoundingClientRect().bottom > line);
  const i = found < 0 ? list.length - 1 : found;
  const r = list[i].getBoundingClientRect();
  const f = r.height ? (line - r.top) / r.height : 0;
  return { part: partNumber(part), i, f: Math.round(f * 1000) / 1000 };
}

/** Scrolls so the spot is back at the reading line. Returns false when its part is not on the page. */
export function scrollToSpot(root: HTMLElement, scroller: HTMLElement, spot: ScrollSpot): boolean {
  const all = parts(root);
  const part = all.find(p => partNumber(p) === spot.part);
  if (!part) return false;
  if (spot.i < 0 && part === all[0]) {
    scroller.scrollTo({ top: 0 });
    return true;
  }
  const list = anchors(part);
  const el = list[Math.min(Math.max(spot.i, 0), list.length - 1)];
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const f = spot.i < 0 ? 0 : spot.f;
  const line = scroller.getBoundingClientRect().top + LINE;
  scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + (r.top + f * r.height - line)) });
  return true;
}

/** Whether two spots are the same place, give or take a sliver of a paragraph. */
export const sameSpot = (a: ScrollSpot | undefined, b: ScrollSpot) =>
  !!a && a.part === b.part && a.i === b.i && Math.abs(a.f - b.f) < 0.02;
