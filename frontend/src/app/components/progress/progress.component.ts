import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { ProgressService } from '../../services/progress.service';
import { ContentService } from '../../services/content.service';
import { ProgressSummary, SectionProgress, Domain } from '../../models/curriculum.model';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatDividerModule, MatTableModule],
  templateUrl: './progress.component.html',
  styleUrl: './progress.component.scss'
})
export class ProgressComponent implements OnInit {
  private progressService = inject(ProgressService);
  private contentService = inject(ContentService);

  summary: ProgressSummary | null = null;
  allProgress: SectionProgress[] = [];
  domains: Domain[] = [];
  loading = true;

  ngOnInit() {
    this.contentService.getCurriculum().subscribe({ next: d => this.domains = d, error: () => {} });
    this.progressService.loadSummary().subscribe({ next: s => { this.summary = s; this.loading = false; }, error: () => { this.loading = false; } });
    this.progressService.loadAll().subscribe({ next: p => this.allProgress = p, error: () => {} });
  }

  getDomainSections(domainId: string): SectionProgress[] {
    return this.allProgress.filter(p => p.domainId === domainId);
  }

  getDomainName(domainId: string): string {
    return this.domains.find(d => d.id === domainId)?.name ?? domainId;
  }

  getDomainColor(domainId: string): string {
    return this.domains.find(d => d.id === domainId)?.color ?? '#3f51b5';
  }

  getSectionName(sectionId: string): string {
    for (const d of this.domains) {
      const s = d.sections.find(x => x.id === sectionId);
      if (s) return s.name;
    }
    return sectionId;
  }

  getWeakAreas(): SectionProgress[] {
    return this.allProgress.filter(p => p.examAttempts > 0 && !p.examPassed && p.bestExamScore > 0)
      .sort((a, b) => a.bestExamScore - b.bestExamScore)
      .slice(0, 5);
  }

  getAccuracy(p: SectionProgress): number {
    if (!p.practiceQuestionsAnswered) return 0;
    return Math.round(p.practiceQuestionsCorrect / p.practiceQuestionsAnswered * 100);
  }
}
