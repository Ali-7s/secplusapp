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

  domains: Domain[] = [];
  summary: ProgressSummary | null = null;
  allProgress: SectionProgress[] = [];
  loading = true;
  error = '';
  weakSpots: { sectionId: string; sectionName: string; pct: number }[] = [];

  ngOnInit() {
    this.contentService.getCurriculum().subscribe({
      next: domains => {
        this.domains = domains;
        this.loading = false;
        this.computeWeakSpots();
      },
      error: e => { this.error = e.message; this.loading = false; }
    });
    this.progressService.loadSummary().subscribe({ next: s => this.summary = s, error: () => {} });
    this.progressService.loadAll().subscribe({ next: p => this.allProgress = p, error: () => {} });
  }

  computeWeakSpots() {
    const scores: { sectionId: string; sectionName: string; pct: number; ts: number }[] = [];
    for (const domain of this.domains) {
      for (const section of domain.sections ?? []) {
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
