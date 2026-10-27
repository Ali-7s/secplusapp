import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, inject, input, signal, viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CardKind, ProgressService, cardKey } from '../../services/progress.service';
import { DumpCard } from '../../utils/brain-dump';
import { CardRecord, ProgressData } from '../../utils/progress';
import { Rating, SrsCard, formatDelay, nextCard, previewIntervals } from '../../utils/srs';

const RATINGS: ReadonlyArray<{ id: Rating; label: string; key: string }> = [
  { id: 'again', label: 'Again', key: '1' },
  { id: 'hard', label: 'Hard', key: '2' },
  { id: 'good', label: 'Good', key: '3' },
  { id: 'easy', label: 'Easy', key: '4' },
];

const DAY = 24 * 60 * 60 * 1000;

/**
 * Review mode: a spaced repetition session over the deck the page is showing. Each card shows its name, you recall
 * the answer, reveal it, and rate how it went. The rating decides when the card comes back (see utils/srs.ts), so
 * a session only holds cards that are due plus a daily allowance of new ones, and it ends when nothing is due.
 *
 * Keys: Space or Enter shows the answer, then 1 to 4 rate it (Space is Good), and Ctrl+Z undoes.
 */
@Component({
  selector: 'app-review',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review.component.html',
  styleUrl: './review.component.scss',
})
export class ReviewComponent {
  /** The cards on offer, already narrowed by the page's search and category filters. */
  readonly cards = input.required<DumpCard[]>();
  readonly kind = input.required<CardKind>();

  readonly progress = inject(ProgressService);
  private readonly cardEl = viewChild<ElementRef<HTMLElement>>('card');

  readonly ratings = RATINGS;
  /** The card whose answer is showing; any other card starts face down. */
  private readonly revealedId = signal<string | null>(null);
  readonly reviewedThisSession = signal(0);
  readonly showSettings = signal(false);
  /** The clock the queue is worked out against; it moves on after each answer and every 30 seconds. */
  private readonly now = signal(Date.now());
  private lastAnswer: { name: string; card: CardRecord | undefined; review: ProgressData['review'] } | null = null;
  readonly canUndo = signal(false);

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  readonly noun = computed(() => (this.kind() === 'acr' ? 'acronym' : 'term'));

  /** This deck's study records, by card id. */
  private readonly records = computed(() => {
    const all = this.progress.data().cards;
    const out: Record<string, SrsCard> = {};
    for (const c of this.cards()) {
      const r = all[cardKey(this.kind(), c.id)];
      if (r) out[c.id] = r;
    }
    return out;
  });

  readonly newLeft = computed(() => {
    this.progress.data();
    return Math.max(0, this.progress.newLeftToday(this.kind()));
  });

  readonly queue = computed(() => nextCard(this.cards().map(c => c.id), this.records(), this.now(), this.newLeft()));
  readonly card = computed(() => {
    const id = this.queue().next;
    return id ? this.cards().find(c => c.id === id) : undefined;
  });
  readonly revealed = computed(() => !!this.card() && this.revealedId() === this.card()!.id);
  readonly record = computed(() => (this.card() ? this.records()[this.card()!.id] : undefined));
  /** Which counter the current card belongs to, underlined. */
  readonly cardQueue = computed<'new' | 'learning' | 'review' | null>(() => {
    if (!this.card()) return null;
    const r = this.record();
    return !r ? 'new' : r.state === 'review' ? 'review' : 'learning';
  });
  readonly intervals = computed(() => previewIntervals(this.record(), this.now()));

  // ── The finished screen ───────────────────────────────────────────────

  readonly unseenCount = computed(() => this.cards().filter(c => !this.records()[c.id]).length);
  readonly studiedCount = computed(() => Object.keys(this.records()).length);
  readonly dueTomorrow = computed(() => {
    const end = this.now() + DAY;
    return Object.values(this.records()).filter(r => r.due <= end).length;
  });
  /** When the next card in this deck falls due, as "3h" or "2d". */
  readonly nextDueIn = computed(() => {
    const dues = Object.values(this.records()).map(r => r.due).filter(d => d > this.now());
    return dues.length ? formatDelay(Math.min(...dues) - this.now()) : null;
  });

  // ── Actions ───────────────────────────────────────────────────────────

  reveal() {
    const card = this.card();
    if (card) this.revealedId.set(card.id);
  }

  answer(rating: Rating) {
    const card = this.card();
    if (!card || !this.revealed()) return;
    this.lastAnswer = { name: card.id, card: this.record(), review: structuredClone(this.progress.data().review) };
    this.canUndo.set(true);
    this.progress.answerCard(this.kind(), card.id, rating);
    this.reviewedThisSession.update(n => n + 1);
    this.revealedId.set(null);
    this.now.set(Date.now());
    this.focusCard();
  }

  undo() {
    const last = this.lastAnswer;
    if (!last) return;
    this.progress.restoreCard(this.kind(), last.name, last.card, last.review);
    this.lastAnswer = null;
    this.canUndo.set(false);
    this.reviewedThisSession.update(n => Math.max(0, n - 1));
    this.now.set(Date.now());
    // The undone card is due again, so it comes straight back; show its answer as it was.
    this.revealedId.set(last.name);
  }

  studyMore(extra: number) {
    this.progress.studyMoreNew(this.kind(), extra);
    this.now.set(Date.now());
  }

  setNewPerDay(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) this.progress.setNewPerDay(value);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (this.canUndo()) { e.preventDefault(); this.undo(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || !this.card()) return;
    // Let Space and Enter on a focused button click that button instead.
    if ((e.key === ' ' || e.key === 'Enter') && target?.closest('button, a')) return;
    if (!this.revealed()) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.reveal(); }
      return;
    }
    const rating = e.key === ' ' || e.key === 'Enter' ? 'good' : RATINGS.find(r => r.key === e.key)?.id;
    if (rating) { e.preventDefault(); this.answer(rating); }
  }

  private focusCard() {
    // Keep focus off the rating button just pressed, so Space does not press it again.
    queueMicrotask(() => this.cardEl()?.nativeElement.focus({ preventScroll: true }));
  }
}
