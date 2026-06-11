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
import { StudyPathService } from '../../services/study-path.service';
import { StudyPhase } from '../../config/study-path.config';

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
  readonly studyPath = inject(StudyPathService);

  domains: Domain[] = [];
  summary: ProgressSummary | null = null;
  allProgress: SectionProgress[] = [];
  loading = true;
  error = '';

  ngOnInit() {
    this.contentService.getCurriculum().subscribe({
      next: domains => { this.domains = domains; this.loading = false; },
      error: e => { this.error = e.message; this.loading = false; }
    });
    this.progressService.loadSummary().subscribe({ next: s => this.summary = s, error: () => {} });
    this.progressService.loadAll().subscribe({ next: p => this.allProgress = p, error: () => {} });
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
    if (this.studyPath.recommended()) {
      const allSections = this.domains.flatMap(d => d.sections);
      return this.studyPath.getNextSection(allSections, this.allProgress);
    }
    return this.allProgress.find(p => p.unlocked && !p.examPassed)?.sectionId ?? '1.1';
  }

  get currentPhase(): StudyPhase | undefined {
    if (!this.studyPath.recommended()) return undefined;
    const allSections = this.domains.flatMap(d => d.sections);
    const idx = this.studyPath.getCurrentPhaseIndex(allSections, this.allProgress);
    return this.studyPath.phases[idx];
  }

  get currentPhaseIndex(): number {
    const allSections = this.domains.flatMap(d => d.sections);
    return this.studyPath.getCurrentPhaseIndex(allSections, this.allProgress);
  }

  get currentPhaseProgress(): { passed: number; total: number } {
    const phase = this.currentPhase;
    if (!phase) return { passed: 0, total: 0 };
    const allSections = this.domains.flatMap(d => d.sections);
    return this.studyPath.getPhaseProgress(phase, allSections, this.allProgress);
  }
}
