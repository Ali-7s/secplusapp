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
      next: domains => {
        this.domains = domains;
        this.loading = false;
        this.refreshReviewQueue();
      },
      error: e => { this.error = e.message; this.loading = false; }
    });
    this.progressService.loadSummary().subscribe({ next: s => this.summary = s, error: () => {} });
    this.progressService.loadAll().subscribe({ next: p => this.allProgress = p, error: () => {} });
  }

  refreshReviewQueue() {
    this.dueCards = this.srs.getDue();
    this.forecastCount = this.srs.forecastCount(7);
    this.computeWeakSpots();
  }

  /** Grade a due card in place (self-rated recall) without leaving the dashboard. */
  gradeDue(card: SrsCard, quality: number, e: Event) {
    e.preventDefault();
    e.stopPropagation();
    this.srs.review(card.id, card.name, quality);
    this.reviewedThisVisit.add(card.id);
    // Drop it from the visible due list once graded
    this.dueCards = this.dueCards.filter(c => c.id !== card.id);
    this.forecastCount = this.srs.forecastCount(7);
  }

  computeWeakSpots() {
    const dueIds = new Set(this.dueCards.map(c => c.id));
    const scores: { sectionId: string; sectionName: string; pct: number; ts: number }[] = [];
    for (const domain of this.domains) {
      for (const section of domain.sections ?? []) {
        if (dueIds.has(section.id)) continue;   // don't double-list a section that's already due
        try {
          const raw = localStorage.getItem(`brainDump_${section.id}`);
          if (raw) {
            const entry = JSON.parse(raw);
            scores.push({ sectionId: section.id, sectionName: section.name, pct: entry.pct ?? 0, ts: entry.ts ?? 0 });
          }
        } catch {}
      }
    }
    this.weakSpots = scores.sort((a, b) => a.pct - b.pct).slice(0, 3);
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
