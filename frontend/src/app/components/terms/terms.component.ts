import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { Term, TermDetail } from '../../models/flashcard.model';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatProgressSpinnerModule, MatProgressBarModule,
    MatSelectModule, MatTooltipModule, MatSlideToggleModule],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss'
})
export class TermsComponent implements OnInit {
  private contentService = inject(ContentService);
  private cdr = inject(ChangeDetectorRef);

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

  // Carousel state
  fcIndex = 0;
  fcFlipped = false;
  fcDone = new Set<number>();

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.contentService.getTerms().subscribe({
      next: t => {
        this.allTerms = t.sort((a, b) => a.term.localeCompare(b.term));
        const cats = [...new Set(t.map(x => x.category).filter(Boolean))].sort();
        this.categories = ['All', ...cats];
        this.filter();
        this.loading = false;
      },
      error: e => { this.error = e.message; this.loading = false; }
    });
  }

  filter() {
    const q = this.searchText.toLowerCase();
    this.filteredTerms = this.allTerms.filter(t => {
      const matchSearch = !q || t.term.toLowerCase().includes(q) ||
        t.definition?.toLowerCase().includes(q) || t.analogy?.toLowerCase().includes(q);
      const matchCat = this.selectedCategory === 'All' || t.category === this.selectedCategory;
      return matchSearch && matchCat;
    });
    if (this.expandedTerm && !this.filteredTerms.some(t => t.term === this.expandedTerm)) {
      this.expandedTerm = null;
    }
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
    this.contentService.getTermDetail(key, term.definition).subscribe({
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
    if (!this.quizSelected.has(term)) this.quizSelected.set(term, letter);
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

  navigateToTerm(name: string, event: MouseEvent) {
    event.stopPropagation();
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

  // Carousel
  fcFlip() { this.fcFlipped = !this.fcFlipped; }

  fcNext(known: boolean) {
    if (known) this.fcDone.add(this.fcIndex);
    this.fcFlipped = false;
    if (this.fcIndex < this.filteredTerms.length - 1) this.fcIndex++;
  }

  fcPrev() {
    if (this.fcIndex > 0) { this.fcIndex--; this.fcFlipped = false; }
  }

  fcReset() { this.fcIndex = 0; this.fcFlipped = false; this.fcDone.clear(); }
}
