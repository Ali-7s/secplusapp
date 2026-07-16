import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContentService } from '../../services/content.service';
import { ProgressService } from '../../services/progress.service';
import { Domain, SectionProgress } from '../../models/curriculum.model';

@Component({
  selector: 'app-roadmap',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatChipsModule, MatTooltipModule],
  templateUrl: './roadmap.component.html',
  styleUrl: './roadmap.component.scss'
})
export class RoadmapComponent implements OnInit {
  private contentService = inject(ContentService);
  private progressService = inject(ProgressService);

  domains: Domain[] = [];
  allProgress: SectionProgress[] = [];
  loading = true;

  // Study plan: weeks per domain (adjust based on weight)
  studyPlan = [
    { domainId: 'domain1', weeks: 1.5, priority: 'Foundation', tips: ['Start with CIA triad and security controls', 'Cryptography is heavily tested — know every algorithm', 'Understand PKI chain of trust thoroughly'] },
    { domainId: 'domain2', weeks: 2.5, priority: 'Critical', tips: ['Memorize all malware types and indicators', 'Social engineering tactics are on every exam', 'Know MITRE ATT&CK framework basics'] },
    { domainId: 'domain3', weeks: 2, priority: 'High', tips: ['Cloud shared responsibility model is key', 'Data states (at-rest, in-transit, in-use) tested heavily', 'Understand HA vs DR concepts'] },
    { domainId: 'domain4', weeks: 3, priority: 'Highest', tips: ['Domain 4 is 28% of the exam — spend the most time here', 'IAM and MFA questions are very common', 'Incident response phases must be memorized in order'] },
    { domainId: 'domain5', weeks: 2, priority: 'High', tips: ['Know compliance frameworks: HIPAA, PCI DSS, GDPR', 'Risk calculations (ALE = ARO × SLE) will appear', 'Vendor agreement types (SLA, MOU, MSA) tested often'] },
  ];

  totalWeeks = this.studyPlan.reduce((s, x) => s + x.weeks, 0);

  ngOnInit() {
    this.contentService.getCurriculum().subscribe({ next: d => { this.domains = d; this.loading = false; }, error: () => { this.loading = false; } });
    this.progressService.loadAll().subscribe({ next: p => this.allProgress = p, error: () => {} });
  }

  getDomain(id: string): Domain | undefined { return this.domains.find(d => d.id === id); }
  getPlan(id: string) { return this.studyPlan.find(p => p.domainId === id); }

  getDomainProgress(domainId: string): number {
    const sections = this.allProgress.filter(p => p.domainId === domainId);
    if (!sections.length) return 0;
    return Math.round(sections.filter(p => p.examPassed).length / sections.length * 100);
  }

  // Everything is always accessible — status is purely informational (passed or not).
  getStatus(sectionId: string): 'unlocked' | 'passed' {
    const p = this.allProgress.find(x => x.sectionId === sectionId);
    return p?.examPassed ? 'passed' : 'unlocked';
  }

  isCurrentSection(sectionId: string): boolean {
    return this.currentSection?.sectionId === sectionId;
  }

  get currentSection() {
    return this.allProgress.find(p => !p.examPassed);
  }
}
