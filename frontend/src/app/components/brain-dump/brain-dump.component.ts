import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject,
  input, signal, untracked, viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BrainDumpStore } from '../../services/brain-dump-store.service';
import { ContentService } from '../../services/content.service';
import {
  DeckId, DumpCard, Rating, Scope, buildRubric, highlight, pickDeck, rate, shuffled, tally,
} from '../../utils/brain-dump';

type Phase = 'write' | 'check' | 'done';

const VERDICTS: Record<Rating, { icon: string; title: string; hint: string }> = {
  nailed: { icon: 'check_circle', title: 'Nailed it', hint: 'You can explain this without looking, so it leaves the "not nailed yet" pile.' },
  partly: { icon: 'timelapse', title: 'Partly there', hint: 'Read what you missed. It stays in your review pile.' },
  missed: { icon: 'cancel', title: 'Not yet', hint: 'That is what this mode is for. Read the card, and it comes back for review.' },
};

/**
 * Brain dump flashcards: the card shows only a name, the learner writes everything they can say about it from
 * memory, and then ticks off a checklist of what a complete explanation covers. Being able to pick the right
 * name from a description is not the same as being able to explain the idea, and this mode trains the second.
 *
 * The same component serves the Acronym Glossary and Key Terms. How each card is rated is remembered in this
 * browser, so a later session can go straight to the cards that were missed.
 */
@Component({
  selector: 'app-brain-dump',
  standalone: true,
  imports: [NgTemplateOutlet, MatButtonModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brain-dump.component.html',
  styleUrl: './brain-dump.component.scss',
})
export class BrainDumpComponent {
  /** The cards on offer, already narrowed by the page's search and category filters. */
  readonly cards = input.required<DumpCard[]>();
  readonly deckId = input.required<DeckId>();

  private content = inject(ContentService);
  private store = inject(BrainDumpStore);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);

  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');
  private readonly answer = viewChild<ElementRef<HTMLElement>>('answer');

  /** Key points a complete answer covers, by card name. Empty until loaded, and when it cannot be. */
  readonly points = signal<Record<string, string[]>>({});
  readonly results = signal<ReadonlyMap<string, Rating>>(new Map());
  readonly scope = signal<Scope>('todo');
  readonly shuffle = signal(false);

  /** The cards in this round. Rating a card does not remove it, so the round keeps its length. */
  readonly deck = signal<DumpCard[]>([]);
  readonly index = signal(0);
  readonly phase = signal<Phase>('write');
  readonly draft = signal('');
  /** What was typed, frozen when the answer was shown. */
  readonly attempt = signal('');
  readonly covered = signal<ReadonlySet<number>>(new Set());
  readonly session = signal<Record<Rating, number>>({ nailed: 0, partly: 0, missed: 0 });
  readonly confirmReset = signal(false);

  readonly noun = computed(() => (this.deckId() === 'acronyms' ? 'acronym' : 'term'));
  readonly everyCard = computed(() =>
    this.cards().length === 1 ? `the ${this.noun()}` : `all ${this.cards().length} ${this.noun()}s`,
  );
  readonly prompt = computed(() =>
    this.deckId() === 'acronyms'
      ? 'What does it stand for, what is it, and what does it do? How is it different from similar things?'
      : 'What is it, how does it work, and why does it matter? How is it different from similar things?',
  );

  readonly card = computed<DumpCard | undefined>(() => this.deck()[this.index()]);
  readonly rubric = computed(() => {
    const card = this.card();
    return card ? buildRubric(card, this.points()[card.id]) : [];
  });
  readonly checklist = computed(() =>
    this.rubric().map(item => ({ tag: item.tag, segments: highlight(item.text, this.attempt()) })),
  );
  readonly definition = computed(() => highlight(this.card()?.definition ?? '', this.attempt()));
  readonly exam = computed(() => highlight(this.card()?.examContext ?? '', this.attempt()));

  readonly rating = computed(() => rate(this.covered().size, this.rubric().length));
  readonly verdict = computed(() => VERDICTS[this.rating()]);
  readonly isLast = computed(() => this.index() >= this.deck().length - 1);
  readonly progress = computed(() => (this.deck().length ? (this.index() / this.deck().length) * 100 : 0));

  readonly counts = computed(() => tally(this.cards(), this.results()));
  readonly sizes = computed(() => {
    const c = this.counts();
    return { todo: c.fresh + c.partly + c.missed, review: c.partly + c.missed, all: this.cards().length };
  });
  readonly hasProgress = computed(() => this.results().size > 0);

  private loadedDeck: DeckId | null = null;
  private firstRound = true;

  constructor() {
    effect(() => {
      const deck = this.deckId();
      this.cards(); // a new search or category filter means a new round
      untracked(() => {
        if (this.loadedDeck !== deck) {
          this.loadedDeck = deck;
          this.results.set(this.store.load(deck));
          const options = this.store.roundOptions(deck);
          this.scope.set(options.scope);
          this.shuffle.set(options.shuffle);
          this.content.getKeyPoints(deck).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => this.points.set(p));
        }
        // Take the keyboard to the box when the mode opens, but never while the learner is typing in the search field.
        this.restart(this.firstRound);
        this.firstRound = false;
      });
    });
  }

  onInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  reveal(): void {
    if (this.phase() !== 'write') return;
    this.attempt.set(this.draft().trim());
    this.covered.set(new Set());
    this.phase.set('check');
    this.focusLater(this.answer);
  }

  toggle(i: number): void {
    this.covered.update(ticked => {
      const next = new Set(ticked);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  }

  /** Records how the card went and moves on. */
  next(): void {
    const card = this.card();
    if (!card || this.phase() !== 'check') return;

    const rating = this.rating();
    const results = new Map(this.results());
    results.set(card.id, rating);
    this.results.set(results);
    this.store.save(this.deckId(), results);
    this.session.update(s => ({ ...s, [rating]: s[rating] + 1 }));
    this.begin(this.index() + 1, true);
  }

  /** Moves on without rating the card. */
  skip(): void {
    if (this.phase() === 'write') this.begin(this.index() + 1, true);
  }

  onScope(event: Event): void {
    this.setScope((event.target as HTMLSelectElement).value as Scope);
  }

  setScope(scope: Scope): void {
    this.scope.set(scope);
    this.rememberOptions();
    this.restart(true);
  }

  toggleShuffle(): void {
    this.shuffle.update(on => !on);
    this.rememberOptions();
    this.restart(true);
  }

  restart(focus = false): void {
    const round = pickDeck(this.cards(), this.results(), this.scope());
    this.deck.set(this.shuffle() ? shuffled(round) : round);
    this.session.set({ nailed: 0, partly: 0, missed: 0 });
    this.begin(0, focus);
  }

  resetProgress(): void {
    this.store.clear(this.deckId());
    this.results.set(new Map());
    this.confirmReset.set(false);
    this.setScope('todo');
  }

  private rememberOptions(): void {
    this.store.setRoundOptions(this.deckId(), { scope: this.scope(), shuffle: this.shuffle() });
  }

  private begin(index: number, focus: boolean): void {
    this.index.set(index);
    this.draft.set('');
    this.attempt.set('');
    this.covered.set(new Set());
    if (index >= this.deck().length) {
      this.phase.set('done');
      return;
    }
    this.phase.set('write');
    if (focus) this.focusLater(this.box);
  }

  /** Focuses once the next render has put the element on the page. */
  private focusLater(target: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }
}
