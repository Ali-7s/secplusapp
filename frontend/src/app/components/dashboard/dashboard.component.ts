import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ContentService } from '../../services/content.service';
import { ProgressService } from '../../services/progress.service';
import { SrsService, SrsCard } from '../../services/srs.service';
import { Domain, ProgressSummary, SectionProgress } from '../../models/curriculum.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatChipsModule, MatTooltipModule, MatProgressSpinnerModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private contentService = inject(ContentService);
  private progressService = inject(ProgressService);
  private srs = inject(SrsService);

  domains: Domain[] = [];
  summary: ProgressSummary | null = null;
  allProgress: SectionProgress[] = [];
  loading = true;
  error = '';
  weakSpots: { sectionId: string; sectionName: string; pct: number }[] = [];
  dueCards: SrsCard[] = [];
  forecastCount = 0;
  reviewedThisVisit = new Set<string>();   // ids graded in-place, kept visible until reload

  ngOnInit() {
    this.contentService.getCurriculum().subscribe({
      next: domains => { this.domains = domains; this.loading = false; },
      error: e => { this.error = e.message; this.loading = false; }
    });
    this.progressService.loadSummary().subscribe({ next: s => this.summary = s, error: () => {} });
    this.progressService.loadAll().subscribe({ next: p => this.allProgress = p, error: () => {} });

    // Migrate any old per-device schedule to the server once, then load the queue
    const migrate = this.srs.migrateLegacy();
    if (migrate) migrate.subscribe({ next: () => this.refreshReviewQueue(), error: () => this.refreshReviewQueue() });
    else this.refreshReviewQueue();
  }

  refreshReviewQueue() {
    this.srs.getAll().subscribe(cards => {
      const now = Date.now();
      this.dueCards = cards
        .filter(c => c.due <= now || this.reviewedThisVisit.has(c.sectionId))
        .sort((a, b) => a.due - b.due);
      this.forecastCount = cards.filter(c => c.due > now).length;

      // Weak spots: lowest recall scores among sections NOT already in the due queue
      const dueIds = new Set(this.dueCards.map(c => c.sectionId));
      this.weakSpots = cards
        .filter(c => c.lastScore != null && !dueIds.has(c.sectionId))
        .sort((a, b) => (a.lastScore ?? 0) - (b.lastScore ?? 0))
        .slice(0, 3)
        .map(c => ({ sectionId: c.sectionId, sectionName: c.name, pct: c.lastScore ?? 0 }));
    });
  }

  /** Grade a due card in place (self-rated recall) without leaving the dashboard. */
  gradeDue(card: SrsCard, quality: number, e: Event) {
    e.preventDefault();
    e.stopPropagation();
    this.reviewedThisVisit.add(card.sectionId);
    this.dueCards = this.dueCards.filter(c => c.sectionId !== card.sectionId);
    this.srs.review(card.sectionId, card.name, quality).subscribe({
      next: () => this.forecastCount++,
      error: () => {},
    });
  }

  getDomainProgress(domainId: string): number {
    if (!this.summary) return 0;
    return this.summary.domainProgress?.find(d => d.domainId === domainId)?.progress ?? 0;
  }

  getSectionStatus(sectionId: string): 'locked' | 'unlocked' | 'passed' {
    const p = this.allProgress.find(x => x.sectionId === sectionId);
    if (!p) return 'locked';
    if (p.examPassed) return 'passed';
    if (p.unlocked) return 'unlocked';
    return 'locked';
  }

  getCurrentSection(): string {
    return this.allProgress.find(p => p.unlocked && !p.examPassed)?.sectionId ?? '1.1';
  }
}
