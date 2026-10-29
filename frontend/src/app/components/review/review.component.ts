import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, input, signal, untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CardKind, ProgressService, cardKey } from '../../services/progress.service';
import { DumpCard } from '../../utils/brain-dump';
import { CardRecord, ProgressData } from '../../utils/progress';
import { Rating, SrsCard, formatDelay, nextCard, previewIntervals } from '../../utils/srs';
import { AnswerCheck, Verdict, expansionCheck } from '../../utils/typed-answer';

const RATINGS: ReadonlyArray<{ id: Rating; label: string; key: string }> = [
  { id: 'again', label: 'Again', key: '1' },
  { id: 'hard', label: 'Hard', key: '2' },
  { id: 'good', label: 'Good', key: '3' },
  { id: 'easy', label: 'Easy', key: '4' },
];

const DAY = 24 * 60 * 60 * 1000;

/** What you typed for the card on screen, kept so a refresh does not lose it. */
interface TypedDraft { id: string; text: string; checked: boolean; countedRight?: boolean }

const PROMPTS = { acr: 'What does it stand for?', term: 'What does it mean? Put it in your own words.', ref: 'Type your answer.' };

/**
 * Review mode: a spaced repetition session over the deck the page is showing. Each card shows its name, you recall
 * the answer, reveal it, and rate how it went. The rating decides when the card comes back (see utils/srs.ts), so
 * a session only holds cards that are due plus a daily allowance of new ones, and it ends when nothing is due.
 *
 * With "type answers" on (the default) you type your answer before the card turns over. An acronym is marked
 * against its expansion and most Reference cards against their own check; a wrong answer can only be rated Again.
 * Cards whose answer is an explanation (Key Terms) are not marked: you compare your words with the card.
 *
 * Keys: Enter checks a typed answer (Space or Enter shows the answer when typing is off), then 1 to 4 rate it
 * (Space is Good, or Again after a wrong answer), and Ctrl+Z undoes.
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
  private readonly answerEl = viewChild<ElementRef<HTMLInputElement>>('answerInput');

  readonly ratings = RATINGS;
  /** The card whose answer is showing; any other card starts face down. */
  private readonly revealedId = signal<string | null>(null);
  readonly reviewedThisSession = signal(0);
  readonly showSettings = signal(false);
  /** The clock the queue is worked out against; it moves on after each answer and every 30 seconds. */
  private readonly now = signal(Date.now());
  private lastAnswer: { name: string; card: CardRecord | undefined; review: ProgressData['review']; draft: TypedDraft | null } | null = null;
  readonly canUndo = signal(false);

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    // A new card on screen: bring back what was typed for it before a refresh, or start with an empty box.
    effect(() => {
      const id = this.card()?.id;
      untracked(() => this.restoreDraft(id));
    });
  }

  // ── Typing the answer ─────────────────────────────────────────────────

  readonly typing = computed(() => this.progress.data().review.typeAnswers !== false);
  readonly typed = signal('');
  /** Set once the typed answer is checked: the card turns over and shows how it went. */
  readonly checked = signal(false);
  private readonly countedRight = signal(false);

  readonly prompt = computed(() => this.card()?.prompt ?? PROMPTS[this.kind()]);

  /** How the current card marks a typed answer, or null when you compare it yourself. */
  private readonly check = computed<AnswerCheck | null>(() => {
    const c = this.card();
    if (!c) return null;
    if (c.check) return c.check;
    return this.kind() === 'acr' && c.expansion ? expansionCheck(c.expansion) : null;
  });

  /** The mark for the typed answer: null before checking, or for a card you compare yourself. */
  readonly verdict = computed<Verdict | null>(() => {
    if (!this.typing() || !this.checked()) return null;
    if (!this.typed().trim()) return { right: false, note: 'No answer given.' };
    const check = this.check();
    if (!check) return null;
    if (this.countedRight()) return { right: true, note: 'You counted this as right.' };
    return check(this.typed());
  });
  readonly selfCompare = computed(() => this.typing() && this.checked() && !this.verdict());
  /** After a wrong answer only Again is allowed, so a miss always comes back soon. */
  readonly onlyAgain = computed(() => this.verdict()?.right === false);

  private draftKey() { return `sp-review-typed-${this.kind()}`; }

  private saveDraft() {
    const id = this.card()?.id;
    try {
      if (!id || (!this.typed() && !this.checked())) localStorage.removeItem(this.draftKey());
      else localStorage.setItem(this.draftKey(), JSON.stringify({ id, text: this.typed(), checked: this.checked(), countedRight: this.countedRight() } satisfies TypedDraft));
    } catch { /* storage unavailable */ }
  }

  private readDraft(): TypedDraft | null {
    try {
      const d = JSON.parse(localStorage.getItem(this.draftKey()) ?? 'null') as TypedDraft | null;
      return d && typeof d.id === 'string' && typeof d.text === 'string' ? d : null;
    } catch {
      return null;
    }
  }

  private restoreDraft(id: string | undefined, draft = this.readDraft()) {
    const mine = id && draft?.id === id ? draft : null;
    this.typed.set(mine?.text ?? '');
    this.checked.set(!!mine?.checked);
    this.countedRight.set(!!mine?.countedRight);
    if (mine?.checked) this.revealedId.set(id!);
    else if (this.typing()) queueMicrotask(() => this.answerEl()?.nativeElement.focus({ preventScroll: true }));
  }

  setTyped(event: Event) {
    this.typed.set((event.target as HTMLInputElement).value);
    this.saveDraft();
  }

  /** Checks the typed answer and turns the card over. An empty box counts as not knowing it. */
  submit(giveUp = false) {
    if (!this.card() || this.checked()) return;
    if (giveUp) this.typed.set('');
    this.checked.set(true);
    this.saveDraft();
    this.reveal();
    this.focusCard();
  }

  /** For an answer the check got wrong (a synonym it does not know): you vouch for it and may rate it normally. */
  countAsRight() {
    this.countedRight.set(true);
    this.saveDraft();
  }

  setTypeAnswers(event: Event) {
    this.progress.setTypeAnswers((event.target as HTMLInputElement).checked);
  }

  readonly noun = computed(() => ({ acr: 'acronym', term: 'term', ref: 'card' })[this.kind()]);

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
    if (!card || !this.revealed() || (this.onlyAgain() && rating !== 'again')) return;
    this.lastAnswer = { name: card.id, card: this.record(), review: structuredClone(this.progress.data().review), draft: this.readDraft() };
    try { localStorage.removeItem(this.draftKey()); } catch { /* storage unavailable */ }
    this.canUndo.set(true);
    this.progress.answerCard(this.kind(), card.id, rating);
    this.reviewedThisSession.update(n => n + 1);
    this.revealedId.set(null);
    // Cleared here too: when the same card comes straight back, the screen does not change cards.
    this.typed.set('');
    this.checked.set(false);
    this.countedRight.set(false);
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
    // The undone card is due again, so it comes straight back; show its answer and your typed answer as they were.
    if (last.draft) {
      try { localStorage.setItem(this.draftKey(), JSON.stringify(last.draft)); } catch { /* storage unavailable */ }
    }
    this.restoreDraft(last.name, last.draft);
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
      if (this.typing()) { if (e.key.length === 1 || e.key === 'Enter') this.answerEl()?.nativeElement.focus(); return; }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.reveal(); }
      return;
    }
    const rating = e.key === ' ' || e.key === 'Enter' ? (this.onlyAgain() ? 'again' : 'good') : RATINGS.find(r => r.key === e.key)?.id;
    if (rating) { e.preventDefault(); this.answer(rating); }
  }

  private focusCard() {
    // Keep focus off the rating button just pressed, so Space does not press it again.
    queueMicrotask(() => this.cardEl()?.nativeElement.focus({ preventScroll: true }));
  }
}
