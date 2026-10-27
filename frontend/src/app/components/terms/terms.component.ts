import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ContentService } from '../../services/content.service';
import { Term, TermDetail, variantsSearchText } from '../../models/glossary.model';
import { maskAnswer } from '../../utils/cloze';
import { DumpCard, termToDumpCard } from '../../utils/brain-dump';
import { LessonMeta } from '../networking/networking.model';
import { lessonsForCard } from '../networking/lessons/lesson-index';
import { BrainDumpComponent } from '../brain-dump/brain-dump.component';
import { ReviewComponent } from '../review/review.component';
import { GuessToggleComponent } from '../guess-toggle/guess-toggle.component';
import { FcMode, FcModeSwitchComponent } from '../brain-dump/fc-mode-switch.component';
import { rankBySearch, searchRank } from '../../utils/search-rank';
import { ProgressService, cardKey } from '../../services/progress.service';
import { isDue, smartOrder } from '../../utils/progress';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatProgressSpinnerModule, MatProgressBarModule,
    MatSelectModule, MatTooltipModule, MatSlideToggleModule, BrainDumpComponent, ReviewComponent, FcModeSwitchComponent, GuessToggleComponent],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss'
})
export class TermsComponent implements OnInit {
  private contentService = inject(ContentService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);

  private pendingTerm = '';

  allTerms: Term[] = [];
  filteredTerms: Term[] = [];
  loading = false;
  error = '';
  searchText = '';
  selectedCategory = 'All';
  categories: string[] = ['All'];

  flashcardMode = false;
  expandedTerm: string | null = null;
  cardDetails = new Map<string, TermDetail>();
  loadingDetails = new Set<string>();
  detailErrors = new Set<string>();
  quizSelected = new Map<string, string>();
  /** Quick Checks marked "I'm guessing" before answering: a right guess counts as not known yet. */
  quizGuessing = new Set<string>();

  private progress = inject(ProgressService);

  /** The flashcard deck: the filtered cards in smart order (due and struggling first) or A to Z. */
  deck: Term[] = [];
  fcOrder: 'smart' | 'az' = 'smart';

  // Carousel state
  fcIndex = 0;
  fcFlipped = false;
  fcDone = new Set<number>();

  // Flip, cloze and brain dump are three ways through the same filtered cards.
  fcMode: FcMode = 'flip';
  /** The filtered cards in the shape brain dump mode works with. */
  dumpCards: DumpCard[] = [];

  // Cloze mode
  fcClozeInput = '';
  fcClozeChecked = false;
  fcClozeCorrect = false;
  private clozeMasks = new Map<string, string>();

  ngOnInit() {
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) this.pendingTerm = q;
    // "?mode=review" (from the Today plan) opens the flashcards straight into Review mode.
    if (this.route.snapshot.queryParamMap.get('mode') === 'review') {
      this.flashcardMode = true;
      this.fcMode = 'review';
    }
    this.load();
  }

  load() {
    this.loading = true;
    this.contentService.getTerms().subscribe({
      next: t => {
        this.allTerms = t.sort((a, b) => a.term.localeCompare(b.term));
        this.rebuildCategories();
        this.filter();
        this.loading = false;
        if (this.pendingTerm) {
          this.navigateToTerm(this.pendingTerm);
          this.pendingTerm = '';
        }
      },
      error: e => { this.error = e.message; this.loading = false; }
    });
  }

  private rebuildCategories() {
    const cats = [...new Set(this.allTerms.map(x => x.category).filter(Boolean))].sort();
    this.categories = ['All', ...cats];
  }

  filter() {
    // Best matches first: searching "PKI" lists the PKI card before cards that only mention PKI.
    const inCategory = this.allTerms.filter(t => this.selectedCategory === 'All' || t.category === this.selectedCategory);
    this.filteredTerms = rankBySearch(inCategory, t => searchRank(this.searchText, t.term, '', [t.definition, t.analogy, variantsSearchText(t)]));
    if (this.expandedTerm && !this.filteredTerms.some(t => t.term === this.expandedTerm)) {
      this.expandedTerm = null;
    }
    this.buildDeck();
    this.dumpCards = this.filteredTerms.map(termToDumpCard);
    this.fcIndex = 0;
    this.fcFlipped = false;
  }

  toggleFlashcardMode() {
    this.flashcardMode = !this.flashcardMode;
    this.expandedTerm = null;
    this.fcReset();
  }

  toggleExpand(term: Term, event: MouseEvent) {
    event.stopPropagation();
    const key = term.term;
    if (this.expandedTerm === key) { this.expandedTerm = null; return; }
    this.expandedTerm = key;
    if (!this.cardDetails.has(key) && !this.loadingDetails.has(key)) {
      this.loadDetail(term);
    }
  }

  loadDetail(term: Term) {
    const key = term.term;
    this.loadingDetails.add(key);
    this.detailErrors.delete(key);
    this.contentService.getTermDetail(term).subscribe({
      next: d => {
        this.cardDetails.set(key, d);
        this.loadingDetails.delete(key);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingDetails.delete(key);
        this.detailErrors.add(key);
        this.cdr.markForCheck();
      }
    });
  }

  selectQuizOption(term: string, letter: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.quizSelected.has(term)) return;
    this.quizSelected.set(term, letter);
    const answer = this.cardDetails.get(term)?.quizAnswer;
    if (answer) this.progress.recordCard('term', term, letter === answer && !this.quizGuessing.has(term));
  }

  toggleQuizGuess(term: string) {
    if (this.quizSelected.has(term)) return;
    this.quizGuessing.has(term) ? this.quizGuessing.delete(term) : this.quizGuessing.add(term);
  }

  isQuizCorrect(term: string): boolean {
    const selected = this.quizSelected.get(term);
    const detail = this.cardDetails.get(term);
    return !!selected && !!detail && selected === detail.quizAnswer;
  }

  getDetail(term: string): TermDetail | undefined {
    return this.cardDetails.get(term);
  }

  getRelatedList(relatedTerms: string): string[] {
    if (!relatedTerms) return [];
    return relatedTerms.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }

  /** Returns true if this related-term name has a card to link to. */
  hasCard(name: string): boolean {
    return this.allTerms.some(t => t.term.toLowerCase() === name.toLowerCase());
  }

  /** Networking lessons that explain this term, so a card can say "new to this? start here". */
  lessonsFor(term: string): LessonMeta[] {
    return lessonsForCard('term', term).slice(0, 2);
  }

  navigateToTerm(name: string, event?: MouseEvent) {
    event?.stopPropagation();
    const target = this.allTerms.find(t => t.term.toLowerCase() === name.toLowerCase());
    if (!target) return;
    this.searchText = '';
    this.selectedCategory = 'All';
    this.filter();
    this.expandedTerm = target.term;
    if (!this.cardDetails.has(target.term) && !this.loadingDetails.has(target.term)) {
      this.loadDetail(target);
    }
    setTimeout(() => {
      document.getElementById('term-' + target.term)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  private fcClozeReset() {
    this.fcClozeInput = '';
    this.fcClozeChecked = false;
    this.fcClozeCorrect = false;
  }

  get fcClozeMode(): boolean { return this.fcMode === 'cloze'; }

  setFcMode(mode: FcMode) {
    // Review answers reschedule cards, so smart order starts over with the new due dates.
    const fromReview = this.fcMode === 'review' && mode !== 'review';
    this.fcMode = mode;
    if (fromReview) this.fcReset();
    this.fcFlipped = false;
    this.fcClozeReset();
  }

  /**
   * The description or hint shown on a cloze card, with the term blanked out wherever the text repeats it,
   * until the answer has been checked.
   */
  clozeText(t: Term, field: 'definition' | 'analogy'): string {
    if (this.fcClozeChecked) return t[field];
    const key = `${t.term}|${field}`;
    let masked = this.clozeMasks.get(key);
    if (masked === undefined) {
      masked = maskAnswer(t[field], [t.term]);
      this.clozeMasks.set(key, masked);
    }
    return masked;
  }

  checkTermCloze() {
    if (this.fcClozeChecked || !this.fcClozeInput.trim()) return;
    this.fcClozeChecked = true;
    const u = this.fcClozeInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const a = this.deck[this.fcIndex].term.toLowerCase().replace(/[^a-z0-9]/g, '');
    this.fcClozeCorrect = u === a || a.includes(u) || u.includes(a);
  }

  fcClozeNext(known: boolean) {
    this.rememberCard(known);
    if (known) this.fcDone.add(this.fcIndex);
    this.fcClozeReset();
    if (this.fcIndex < this.deck.length - 1) this.fcIndex++;
  }

  // Carousel
  fcGoTo(idx: number) { this.fcIndex = idx; this.fcFlipped = false; this.fcClozeReset(); }
  fcFlip() { this.fcFlipped = !this.fcFlipped; }

  fcNext(known: boolean) {
    this.rememberCard(known);
    if (known) this.fcDone.add(this.fcIndex);
    this.fcFlipped = false;
    this.fcClozeReset();
    if (this.fcIndex < this.deck.length - 1) this.fcIndex++;
  }

  fcPrev() {
    if (this.fcIndex > 0) { this.fcIndex--; this.fcFlipped = false; this.fcClozeReset(); }
  }

  fcReset() {
    this.buildDeck();
    this.fcIndex = 0;
    this.fcFlipped = false;
    this.fcDone.clear();
    this.fcClozeReset();
  }

  /** Moves on without rating the card (the Next button). */
  fcSkip() {
    this.fcFlipped = false;
    this.fcClozeReset();
    if (this.fcIndex < this.deck.length - 1) this.fcIndex++;
  }

  setFcOrder(order: 'smart' | 'az') {
    this.fcOrder = order;
    this.fcReset();
  }

  /** Cards in the current deck that are due for review today. */
  get fcDueCount(): number {
    const now = Date.now();
    return this.deck.filter(t => isDue(this.progress.card('term', t.term), now)).length;
  }

  private buildDeck() {
    this.deck = this.fcOrder === 'smart'
      ? smartOrder(this.filteredTerms, t => cardKey('term', t.term), this.progress.data().cards, Date.now())
      : [...this.filteredTerms];
  }

  private rememberCard(known: boolean) {
    const card = this.deck[this.fcIndex];
    if (card) this.progress.recordCard('term', card.term, known);
  }
}
