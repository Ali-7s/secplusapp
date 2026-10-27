import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
import { Acronym, AcronymDetail, variantsSearchText } from '../../models/glossary.model';
import { isAcronymClozeCorrect, maskAnswer } from '../../utils/cloze';
import { DumpCard, acronymToDumpCard } from '../../utils/brain-dump';
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
  selector: 'app-acronyms',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatProgressSpinnerModule, MatProgressBarModule,
    MatSelectModule, MatTooltipModule, MatSlideToggleModule, BrainDumpComponent, ReviewComponent, FcModeSwitchComponent, GuessToggleComponent],
  templateUrl: './acronyms.component.html',
  styleUrl: './acronyms.component.scss'
})
export class AcronymsComponent implements OnInit {
  private contentService = inject(ContentService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);

  private pendingAcronym = '';

  allAcronyms: Acronym[] = [];
  filteredAcronyms: Acronym[] = [];
  loading = false;
  error = '';
  searchText = '';
  selectedCategory = 'All';
  categories: string[] = ['All'];

  flashcardMode = false;
  expandedAcronym: string | null = null;
  cardDetails = new Map<string, AcronymDetail>();
  loadingDetails = new Set<string>();
  detailErrors = new Set<string>();
  quizSelected = new Map<string, string>();
  /** Quick Checks marked "I'm guessing" before answering: a right guess counts as not known yet. */
  quizGuessing = new Set<string>();

  private progress = inject(ProgressService);

  /** The flashcard deck: the filtered cards in smart order (due and struggling first) or A to Z. */
  deck: Acronym[] = [];
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
    if (q) this.pendingAcronym = q;
    this.load();
  }

  load() {
    this.loading = true;
    this.contentService.getAcronyms().subscribe({
      next: a => {
        this.allAcronyms = a.sort((x, y) => x.acronym.localeCompare(y.acronym));
        const cats = [...new Set(a.map(x => x.category).filter(Boolean))].sort();
        this.categories = ['All', ...cats];
        this.filter();
        this.loading = false;
        if (this.pendingAcronym) {
          this.navigateToAcronym(this.pendingAcronym);
          this.pendingAcronym = '';
        }
      },
      error: e => { this.error = e.message; this.loading = false; }
    });
  }

  filter() {
    // Best matches first: searching "PKI" lists the PKI card before cards that only mention PKI.
    const inCategory = this.allAcronyms.filter(a => this.selectedCategory === 'All' || a.category === this.selectedCategory);
    this.filteredAcronyms = rankBySearch(inCategory, a => searchRank(this.searchText, a.acronym, a.expansion, [a.definition, variantsSearchText(a)]));
    if (this.expandedAcronym && !this.filteredAcronyms.some(a => a.acronym === this.expandedAcronym)) {
      this.expandedAcronym = null;
    }
    this.buildDeck();
    this.dumpCards = this.filteredAcronyms.map(acronymToDumpCard);
    this.fcIndex = 0;
    this.fcFlipped = false;
  }

  toggleFlashcardMode() {
    this.flashcardMode = !this.flashcardMode;
    this.expandedAcronym = null;
    this.fcReset();
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
   * The description shown on a cloze card. Descriptions usually repeat the acronym ("CCMP is the encryption
   * protocol..."), so the acronym and its expansion are blanked out until the answer has been checked.
   */
  clozeText(a: Acronym): string {
    if (this.fcClozeChecked) return a.definition;
    let masked = this.clozeMasks.get(a.acronym);
    if (masked === undefined) {
      masked = maskAnswer(a.definition, [a.acronym, a.expansion]);
      this.clozeMasks.set(a.acronym, masked);
    }
    return masked;
  }

  checkAcronymCloze() {
    if (this.fcClozeChecked || !this.fcClozeInput.trim()) return;
    this.fcClozeChecked = true;
    this.fcClozeCorrect = isAcronymClozeCorrect(
      this.fcClozeInput, this.deck[this.fcIndex], this.allAcronyms);
  }

  fcClozeNext(known: boolean) {
    this.rememberCard(known);
    if (known) this.fcDone.add(this.fcIndex);
    this.fcClozeReset();
    if (this.fcIndex < this.deck.length - 1) this.fcIndex++;
  }

  fcGoTo(idx: number) { this.fcIndex = idx; this.fcFlipped = false; this.fcClozeReset(); }
  fcFlip() { this.fcFlipped = !this.fcFlipped; }

  fcNext(known: boolean) {
    this.rememberCard(known);
    if (known) this.fcDone.add(this.fcIndex);
    this.fcFlipped = false;
    this.fcClozeReset();
    if (this.fcIndex < this.deck.length - 1) {
      this.fcIndex++;
    }
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
    return this.deck.filter(a => isDue(this.progress.card('acr', a.acronym), now)).length;
  }

  private buildDeck() {
    this.deck = this.fcOrder === 'smart'
      ? smartOrder(this.filteredAcronyms, a => cardKey('acr', a.acronym), this.progress.data().cards, Date.now())
      : [...this.filteredAcronyms];
  }

  private rememberCard(known: boolean) {
    const card = this.deck[this.fcIndex];
    if (card) this.progress.recordCard('acr', card.acronym, known);
  }

  get fcDeckComplete(): boolean {
    return this.fcIndex === this.deck.length - 1 && this.fcFlipped;
  }

  toggleExpand(acronym: Acronym, event: MouseEvent) {
    event.stopPropagation();
    const key = acronym.acronym;
    if (this.expandedAcronym === key) {
      this.expandedAcronym = null;
      return;
    }
    this.expandedAcronym = key;
    if (!this.cardDetails.has(key) && !this.loadingDetails.has(key)) {
      this.loadDetail(acronym);
    }
  }

  loadDetail(acronym: Acronym) {
    const key = acronym.acronym;
    this.loadingDetails.add(key);
    this.detailErrors.delete(key);
    this.contentService.getAcronymDetail(acronym).subscribe({
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

  selectQuizOption(acronym: string, letter: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.quizSelected.has(acronym)) return;
    this.quizSelected.set(acronym, letter);
    const answer = this.cardDetails.get(acronym)?.quizAnswer;
    if (answer) this.progress.recordCard('acr', acronym, letter === answer && !this.quizGuessing.has(acronym));
  }

  toggleQuizGuess(acronym: string) {
    if (this.quizSelected.has(acronym)) return;
    this.quizGuessing.has(acronym) ? this.quizGuessing.delete(acronym) : this.quizGuessing.add(acronym);
  }

  isQuizCorrect(acronym: string): boolean {
    const selected = this.quizSelected.get(acronym);
    const detail = this.cardDetails.get(acronym);
    return !!selected && !!detail && selected === detail.quizAnswer;
  }

  /** Opens one card. Takes an exact name from a related chip, or any capitalization from a link (?q=vlan). */
  navigateToAcronym(name: string, event?: MouseEvent) {
    event?.stopPropagation();
    const target = this.allAcronyms.find(a => a.acronym === name)
      ?? this.allAcronyms.find(a => a.acronym.toLowerCase() === name.toLowerCase());
    if (!target) return;
    const acr = target.acronym;
    this.searchText = '';
    this.selectedCategory = 'All';
    this.filter();
    this.expandedAcronym = acr;
    if (!this.cardDetails.has(acr) && !this.loadingDetails.has(acr)) {
      this.loadDetail(target);
    }
    setTimeout(() => {
      document.getElementById('acr-' + acr)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  /** Networking lessons that explain this acronym, so a card can say "new to this? start here". */
  lessonsFor(acronym: string): LessonMeta[] {
    return lessonsForCard('acr', acronym).slice(0, 2);
  }

  onDetailClick(event: MouseEvent) {
    const el = (event.target as HTMLElement).closest('[data-acr]') as HTMLElement | null;
    if (el?.dataset['acr']) {
      this.navigateToAcronym(el.dataset['acr'], event);
    }
  }

  linkify(text: string, currentAcronym: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    const sorted = [...this.allAcronyms]
      .filter(a => a.acronym !== currentAcronym)
      .sort((a, b) => b.acronym.length - a.acronym.length);
    let result = this.escapeHtml(text);
    for (const a of sorted) {
      const esc = a.acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(
        new RegExp(`(?<![\\w/])${esc}(?![\\w/])`, 'g'),
        `<span class="acr-link" data-acr="${a.acronym}">${a.acronym}</span>`
      );
    }
    return this.sanitizer.bypassSecurityTrustHtml(result);
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  getRelatedList(relatedAcronyms: string): string[] {
    if (!relatedAcronyms) return [];
    return relatedAcronyms.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }

  getDetail(acronym: string): AcronymDetail | undefined {
    return this.cardDetails.get(acronym);
  }
}
