import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { Acronym, AcronymDetail } from '../../models/flashcard.model';

@Component({
  selector: 'app-acronyms',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatProgressSpinnerModule, MatProgressBarModule,
    MatSelectModule, MatTooltipModule, MatSlideToggleModule],
  templateUrl: './acronyms.component.html',
  styleUrl: './acronyms.component.scss'
})
export class AcronymsComponent implements OnInit {
  private contentService = inject(ContentService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

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

  // Carousel state
  fcIndex = 0;
  fcFlipped = false;
  fcDone = new Set<number>();

  ngOnInit() {
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
      },
      error: e => { this.error = e.message; this.loading = false; }
    });
  }

  filter() {
    const q = this.searchText.toLowerCase();
    this.filteredAcronyms = this.allAcronyms.filter(a => {
      const matchSearch = !q || a.acronym.toLowerCase().includes(q) ||
        a.expansion.toLowerCase().includes(q) || a.definition?.toLowerCase().includes(q);
      const matchCat = this.selectedCategory === 'All' || a.category === this.selectedCategory;
      return matchSearch && matchCat;
    });
    if (this.expandedAcronym && !this.filteredAcronyms.some(a => a.acronym === this.expandedAcronym)) {
      this.expandedAcronym = null;
    }
    this.fcIndex = 0;
    this.fcFlipped = false;
  }

  toggleFlashcardMode() {
    this.flashcardMode = !this.flashcardMode;
    this.expandedAcronym = null;
    this.fcReset();
  }

  fcFlip() { this.fcFlipped = !this.fcFlipped; }

  fcNext(known: boolean) {
    if (known) this.fcDone.add(this.fcIndex);
    this.fcFlipped = false;
    if (this.fcIndex < this.filteredAcronyms.length - 1) {
      this.fcIndex++;
    }
  }

  fcPrev() {
    if (this.fcIndex > 0) { this.fcIndex--; this.fcFlipped = false; }
  }

  fcReset() {
    this.fcIndex = 0;
    this.fcFlipped = false;
    this.fcDone.clear();
  }

  get fcDeckComplete(): boolean {
    return this.fcIndex === this.filteredAcronyms.length - 1 && this.fcFlipped;
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
    this.contentService.getAcronymDetail(key, acronym.expansion).subscribe({
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
    if (!this.quizSelected.has(acronym)) {
      this.quizSelected.set(acronym, letter);
    }
  }

  isQuizCorrect(acronym: string): boolean {
    const selected = this.quizSelected.get(acronym);
    const detail = this.cardDetails.get(acronym);
    return !!selected && !!detail && selected === detail.quizAnswer;
  }

  navigateToAcronym(acr: string, event: MouseEvent) {
    event.stopPropagation();
    const target = this.allAcronyms.find(a => a.acronym === acr);
    if (!target) return;
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
