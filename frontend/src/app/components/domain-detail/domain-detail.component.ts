import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule,
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

  getStatus(sectionId: string): 'locked' | 'unlocked' | 'passed' {
    const p = this.getProgress(sectionId);
    if (!p) return 'locked';
    if (p.examPassed) return 'passed';
    if (p.unlocked) return 'unlocked';
    return 'locked';
  }

  getStatusIcon(status: string): string {
    if (status === 'passed') return 'check_circle';
    if (status === 'unlocked') return 'lock_open';
    return 'lock';
  }

  getStatusColor(status: string): string {
    if (status === 'passed') return '#2e7d32';
    if (status === 'unlocked') return '#1565c0';
    return '#9e9e9e';
  }
}
