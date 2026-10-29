import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BrainDumpComponent } from './brain-dump.component';
import { ContentService } from '../../services/content.service';
import { DumpCard } from '../../utils/brain-dump';

const STORAGE_KEY = 'sp-braindump';

const cards: DumpCard[] = [
  {
    id: 'ACL', name: 'ACL', category: 'Access Control', expansion: 'Access Control List',
    definition: 'A set of rules that permits or denies traffic. It enforces least privilege.',
    examContext: 'Rules run top-down and the first match wins.', related: ['DAC', 'MAC'],
    variants: [{ title: 'Access control models compared', items: [{ name: 'DAC', detail: 'Owner decides.' }] }],
  },
  {
    id: 'AES', name: 'AES', category: 'Cryptography', expansion: 'Advanced Encryption Standard',
    definition: 'A symmetric block cipher.', examContext: 'Know the key sizes.', related: [],
  },
  {
    id: 'DNS', name: 'DNS', category: 'Network', expansion: 'Domain Name System',
    definition: 'Maps names to addresses.', examContext: 'Watch for poisoning.', related: [],
  },
];

describe('BrainDumpComponent', () => {
  let fixture: ComponentFixture<BrainDumpComponent>;
  let el: HTMLElement;
  let points: Record<string, string[]>;

  const q = <T extends HTMLElement = HTMLElement>(selector: string) => el.querySelector<T>(selector);
  const all = (selector: string) => Array.from(el.querySelectorAll<HTMLElement>(selector));
  const text = (selector: string) => q(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const flush = () => { fixture.detectChanges(); fixture.detectChanges(); };
  const buttonNamed = (label: RegExp) => all('button').find(b => label.test(b.textContent ?? ''));

  const write = (value: string) => {
    const box = q<HTMLTextAreaElement>('.bd-input')!;
    box.value = value;
    box.dispatchEvent(new Event('input'));
    flush();
  };
  const reveal = () => { buttonNamed(/Show answer/)!.click(); flush(); };
  const tick = (...indexes: number[]) => {
    for (const i of indexes) all('.bd-point input')[i].click();
    flush();
  };
  const next = () => { q('.bd-verdict button')!.click(); flush(); };

  /** Opens the component fresh, as the page does when brain dump mode is chosen. */
  const open = (deck: DumpCard[] = cards) => {
    fixture = TestBed.createComponent(BrainDumpComponent);
    fixture.componentRef.setInput('cards', deck);
    fixture.componentRef.setInput('deckId', 'acronyms');
    flush();
    el = fixture.nativeElement;
  };

  /** Ratings, their times and the saved round, so each test starts a fresh round. */
  const clearStorage = () => {
    for (const k of Object.keys(localStorage)) if (k.startsWith(STORAGE_KEY) || k.startsWith('sp-dump-round-')) localStorage.removeItem(k);
  };

  beforeEach(() => {
    clearStorage();
    points = { ACL: ['Permit and deny rules', 'First match wins'] };
    TestBed.configureTestingModule({
      imports: [BrainDumpComponent],
      providers: [{ provide: ContentService, useValue: { getKeyPoints: () => of(points) } }],
    });
    open();
  });

  afterEach(clearStorage);

  it('shows only the name and category at first, so the card has to be explained blind', () => {
    expect(text('.bd-name')).toBe('ACL');
    expect(text('.bd-cat')).toBe('Access Control');
    expect(q('.bd-input')).not.toBeNull();
    expect(el.textContent).not.toContain('Access Control List');
    expect(el.textContent).not.toContain('permits or denies');
    expect(text('.bd-progress')).toContain('Card 1 / 3');
  });

  it('shows the checklist after "Show answer": the letters, then the key points', () => {
    write('rules that allow or deny');
    reveal();
    expect(q('.bd-input')).toBeNull();
    expect(text('.bd-quote')).toBe('rules that allow or deny');
    const items = all('.bd-point .bd-text').map(p => p.textContent!.replace(/\s+/g, ' ').trim());
    expect(items).toEqual(['Letters Access Control List', 'Permit and deny rules', 'First match wins']);
  });

  it('marks the words that were also used', () => {
    write('a list of rules');
    reveal();
    const marked = all('.bd-points mark').map(m => m.textContent);
    expect(marked).toContain('rules');
    expect(marked).toContain('List');
  });

  it('says so when nothing was typed', () => {
    reveal();
    expect(text('.bd-quote')).toContain('Nothing typed');
  });

  it('can be submitted with Ctrl+Enter from the box', () => {
    write('something');
    q('.bd-input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
    flush();
    expect(q('.bd-points')).not.toBeNull();
  });

  it('turns ticks into a verdict', () => {
    reveal();
    expect(text('.bd-verdict p')).toContain('Not yet');
    expect(text('.bd-verdict p')).toContain('0 of 3');
    tick(0, 1);
    expect(text('.bd-verdict p')).toContain('Partly there');
    tick(2);
    expect(text('.bd-verdict p')).toContain('Nailed it');
    expect(text('.bd-verdict p')).toContain('3 of 3');
    tick(2);
    expect(text('.bd-verdict p')).toContain('Partly there');
  });

  it('shows the full card (definition, exam angle, comparison, related) after the answer', () => {
    reveal();
    const full = text('.bd-full')!;
    expect(full).toContain('A set of rules that permits or denies traffic.');
    expect(full).toContain('Rules run top-down');
    expect(full).toContain('Access control models compared');
    expect(full).toContain('Owner decides.');
    expect(full).toContain('DAC');
  });

  it('records the rating, remembers it and moves to a fresh card', () => {
    write('rules');
    reveal();
    tick(0, 1, 2);
    next();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ acronyms: { ACL: 'nailed' } });
    expect(text('.bd-name')).toBe('AES');
    expect(text('.bd-progress')).toContain('Card 2 / 3');
    expect(q<HTMLTextAreaElement>('.bd-input')!.value).toBe('');
    expect(text('.bd-tally')).toContain('1 nailed');
  });

  it('moves on without recording anything when a card is skipped', () => {
    buttonNamed(/Skip/)!.click();
    flush();
    expect(text('.bd-name')).toBe('AES');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ends the round with a summary and offers to redo what was not nailed', () => {
    for (const covered of [[0, 1, 2], [], []]) {
      reveal();
      tick(...covered);
      next();
    }
    expect(text('.bd-done h3')).toBe('Round complete');
    expect(text('.bd-done p')).toContain('1 nailed, 0 partly, 2 missed');
    expect(text('.bd-done-actions')).toContain('Redo the 2 to review');
  });

  it('puts only the cards that were not nailed in the next round', () => {
    reveal(); tick(0, 1, 2); next();            // ACL nailed
    reveal(); next();                           // AES missed
    buttonNamed(/Skip/)!.click(); flush();      // DNS skipped

    open();
    expect(text('.bd-progress')).toContain('Card 1 / 2');
    expect(text('.bd-name')).toBe('AES');
    expect(text('.bd-scope')).toContain('Not nailed yet (2)');
    expect(text('.bd-scope')).toContain('To review (1)');
    expect(text('.bd-scope')).toContain('All (3)');
  });

  it('can go through every card again, or just the ones to review', () => {
    reveal(); tick(0, 1, 2); next();
    reveal(); next();
    buttonNamed(/Skip/)!.click(); flush();

    const select = q<HTMLSelectElement>('.bd-scope select')!;
    select.value = 'all';
    select.dispatchEvent(new Event('change'));
    flush();
    expect(text('.bd-progress')).toContain('Card 1 / 3');
    expect(text('.bd-name')).toBe('ACL');

    select.value = 'review';
    select.dispatchEvent(new Event('change'));
    flush();
    expect(text('.bd-progress')).toContain('Card 1 / 1');
    expect(text('.bd-name')).toBe('AES');
  });

  it('says when everything is nailed', () => {
    for (let i = 0; i < 3; i++) { reveal(); tick(...all('.bd-point input').map((_, n) => n)); next(); }
    open();
    expect(text('.bd-done h3')).toBe('Every card here is nailed');
    expect(text('.bd-done p')).toContain('all 3 acronyms');
    expect(text('.bd-done-actions')).toContain('Go through them again');
  });

  it('carries on an unfinished round after a refresh, on the same card and with the half-typed answer', () => {
    reveal(); next();                           // ACL missed
    write('A symmetric cipher with');
    open();
    expect(text('.bd-progress')).toContain('Card 2 / 3');
    expect(text('.bd-name')).toBe('AES');
    expect(q<HTMLTextAreaElement>('.bd-input')!.value).toBe('A symmetric cipher with');
  });

  it('falls back to the sentences of the definition when a card has no written points', () => {
    buttonNamed(/Skip/)!.click(); flush();      // AES has none
    reveal();
    const items = all('.bd-point .bd-text').map(p => p.textContent!.replace(/\s+/g, ' ').trim());
    expect(items).toEqual(['Letters Advanced Encryption Standard', 'A symmetric block cipher.']);
  });

  it('starts the round over when the search narrows the cards', () => {
    fixture.componentRef.setInput('cards', [cards[2]]);
    flush();
    expect(text('.bd-name')).toBe('DNS');
    expect(text('.bd-progress')).toContain('Card 1 / 1');
  });

  it('asks before forgetting progress, then resets it', () => {
    reveal(); tick(0, 1, 2); next();
    expect(text('.bd-foot')).toContain('Reset brain dump progress');

    q('.bd-foot .bd-link')!.click(); flush();
    expect(text('.bd-foot')).toContain('Forget how you rated every acronym?');
    buttonNamed(/Cancel/)!.click(); flush();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).acronyms.ACL).toBe('nailed');

    q('.bd-foot .bd-link')!.click(); flush();
    buttonNamed(/Yes, reset it/)!.click(); flush();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).acronyms).toEqual({});
    expect(text('.bd-name')).toBe('ACL');
    expect(q('.bd-foot')).toBeNull();
  });

  it('keeps the deck choice when the component is reopened in the same visit', () => {
    const select = q<HTMLSelectElement>('.bd-scope select')!;
    select.value = 'all';
    select.dispatchEvent(new Event('change'));
    flush();

    // The page destroys and recreates the component when the learner flips to another mode and back.
    open();
    expect(q<HTMLSelectElement>('.bd-scope select')!.value).toBe('all');
  });
});
