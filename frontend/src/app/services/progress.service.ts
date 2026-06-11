import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { SectionProgress, ProgressSummary } from '../models/curriculum.model';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private api = inject(ApiService);

  summary = signal<ProgressSummary | null>(null);
  allProgress = signal<SectionProgress[]>([]);

  loadAll(): Observable<SectionProgress[]> {
    return this.api.get<SectionProgress[]>('/progress').pipe(
      tap(p => this.allProgress.set(p))
    );
  }

  loadSummary(): Observable<ProgressSummary> {
    return this.api.get<ProgressSummary>('/progress/summary').pipe(
      tap(s => this.summary.set(s))
    );
  }

  getSectionProgress(sectionId: string): Observable<SectionProgress> {
    return this.api.get<SectionProgress>(`/progress/${sectionId}`);
  }

  updatePractice(sectionId: string, answered: number, correct: number): Observable<void> {
    return this.api.post<void>(`/progress/${sectionId}/practice`, { answered, correct });
  }

  resetSection(sectionId: string): Observable<void> {
    return this.api.post<void>(`/progress/${sectionId}/reset`, {});
  }

  isUnlocked(sectionId: string): boolean {
    const p = this.allProgress().find(x => x.sectionId === sectionId);
    return p?.unlocked ?? sectionId === '1.1';
  }

  isPassed(sectionId: string): boolean {
    return this.allProgress().find(x => x.sectionId === sectionId)?.examPassed ?? false;
  }
}
