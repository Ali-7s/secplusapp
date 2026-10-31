import { readSpot, sameSpot, scrollToSpot } from './scroll-spot';

/** A scrolling box holding two parts of paragraphs, laid out at the given width. */
function page(width: number) {
  const scroller = document.createElement('div');
  scroller.style.cssText = `position: fixed; top: 0; left: 0; width: ${width}px; height: 300px; overflow: auto; font: 16px/20px sans-serif;`;
  const root = document.createElement('article');
  for (let part = 0; part < 2; part++) {
    const el = document.createElement('div');
    el.dataset['part'] = String(part);
    el.innerHTML = `<h2>Part ${part}</h2>` + Array.from({ length: 12 }, (_, i) => `<p>${`Paragraph ${part}.${i} `.repeat(20)}</p>`).join('');
    root.appendChild(el);
  }
  const tail = document.createElement('section');
  tail.style.height = '2000px';
  tail.innerHTML = '<p>Flashcards</p>';
  root.appendChild(tail);
  scroller.appendChild(root);
  document.body.appendChild(scroller);
  return { scroller, root, done: () => scroller.remove() };
}

describe('scroll spot', () => {
  it('is the top of the first part before any scrolling', () => {
    const p = page(600);
    expect(readSpot(p.root, p.scroller)).toEqual({ part: 0, i: -1, f: 0 });
    p.done();
  });

  it('comes back to the same paragraph after scrolling away', () => {
    const p = page(600);
    p.scroller.scrollTop = 1500;
    const spot = readSpot(p.root, p.scroller)!;
    expect(spot.i).toBeGreaterThan(0);
    p.scroller.scrollTop = 0;
    expect(scrollToSpot(p.root, p.scroller, spot)).toBeTrue();
    expect(Math.abs(p.scroller.scrollTop - 1500)).toBeLessThan(2);
    p.done();
  });

  it('finds the same paragraph on a narrower screen, where the page is taller', () => {
    const wide = page(700);
    wide.scroller.scrollTop = 900;
    const spot = readSpot(wide.root, wide.scroller)!;
    expect(spot).not.toBeNull();
    wide.done();

    const narrow = page(320);
    scrollToSpot(narrow.root, narrow.scroller, spot);
    expect(readSpot(narrow.root, narrow.scroller)!.part).toBe(spot.part);
    expect(readSpot(narrow.root, narrow.scroller)!.i).toBe(spot.i);
    expect(narrow.scroller.scrollTop).toBeGreaterThan(900);
    narrow.done();
  });

  it('says so when the part is not on the page', () => {
    const p = page(600);
    expect(scrollToSpot(p.root, p.scroller, { part: 5, i: 2, f: 0 })).toBeFalse();
    p.done();
  });

  it('has no spot once past every part', () => {
    const p = page(600);
    p.scroller.scrollTop = p.scroller.scrollHeight;
    expect(readSpot(p.root, p.scroller)).toBeNull();
    p.done();
  });

  it('treats a sliver of difference as the same place', () => {
    expect(sameSpot({ part: 1, i: 3, f: 0.5 }, { part: 1, i: 3, f: 0.51 })).toBeTrue();
    expect(sameSpot({ part: 1, i: 3, f: 0.5 }, { part: 1, i: 4, f: 0.5 })).toBeFalse();
    expect(sameSpot(undefined, { part: 1, i: 3, f: 0.5 })).toBeFalse();
  });
});
