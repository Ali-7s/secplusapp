import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ContentService } from '../../services/content.service';
import { ProgressService } from '../../services/progress.service';
import { Domain, SectionProgress } from '../../models/curriculum.model';

@Component({
  selector: 'app-domain-detail',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatChipsModule, MatTooltipModule, MatProgressSpinnerModule
  ],
  templateUrl: './domain-detail.component.html',
  styleUrl: './domain-detail.component.scss'
})
export class DomainDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private contentService = inject(ContentService);
  private progressService = inject(ProgressService);

  domain: Domain | null = null;
  allProgress: SectionProgress[] = [];
  loading = true;
  error = '';

  // Domain brain dump
  brainDump = '';
  brainDumpChecked = false;
  brainDumpCovered = 0;
  brainDumpTotal = 0;
  brainDumpResults: { name: string; topics: { text: string; found: boolean }[] }[] = [];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.contentService.getDomain(id).subscribe({
      next: d => { this.domain = d; this.loading = false; },
      error: e => { this.error = e.message; this.loading = false; }
    });
    this.progressService.loadAll().subscribe({ next: p => this.allProgress = p, error: () => {} });
  }

  getProgress(sectionId: string): SectionProgress | undefined {
    return this.allProgress.find(p => p.sectionId === sectionId);
  }

  getStatus(sectionId: string): 'unlocked' | 'passed' | 'in_progress' {
    const p = this.getProgress(sectionId);
    if (!p) return 'unlocked';
    if (p.examPassed) return 'passed';
    const hasActivity = p.flashcardsReviewed > 0 || p.practiceQuestionsAnswered > 0 || p.conceptRead || p.examAttempts > 0;
    return hasActivity ? 'in_progress' : 'unlocked';
  }

  getStatusIcon(status: string): string {
    if (status === 'passed')      return 'check_circle';
    if (status === 'in_progress') return 'pending';
    return 'play_circle';
  }

  getStatusColor(status: string): string {
    if (status === 'passed')      return '#2e7d32';
    if (status === 'in_progress') return '#d97706';
    return '#1565c0';
  }

  checkBrainDump() {
    if (!this.domain || !this.brainDump.trim()) return;
    const dump = this.brainDump.toLowerCase();
    let total = 0; let covered = 0;
    this.brainDumpResults = this.domain.sections.map(s => {
      const topics = (s.keyTopics ?? []).map(topic => {
        total++;
        const words = topic.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
        const found = words.length === 0 ? true : words.some(w => dump.includes(w));
        if (found) covered++;
        return { text: topic, found };
      });
      return { name: s.name, topics };
    });
    this.brainDumpCovered = covered;
    this.brainDumpTotal = total;
    this.brainDumpChecked = true;
  }

  resetBrainDump() {
    this.brainDump = '';
    this.brainDumpChecked = false;
    this.brainDumpResults = [];
    this.brainDumpCovered = 0;
    this.brainDumpTotal = 0;
  }

  get brainDumpScorePct(): number {
    return this.brainDumpTotal ? Math.round(this.brainDumpCovered / this.brainDumpTotal * 100) : 0;
  }
}
