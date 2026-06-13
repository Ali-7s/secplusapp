import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

/**
 * Spaced-repetition scheduler — backed by the server so a learner's review
 * schedule follows them across every device, not trapped in one browser.
 *
 * The SM-2 math runs on the backend (see SrsService.java). This client just
 * reads the schedule, posts reviews, and formats due dates. `qualityFromScore`
 * and `describeDue` are pure helpers kept here for the components to use.
 */

export interface SrsCard {
  sectionId: string;
  name: string;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  lastScore: number | null;
  due: number;           // epoch ms when next due
  lastReviewed: number;  // epoch ms of last review
}

const DAY = 24 * 60 * 60 * 1000;
const LEGACY_KEY = 'srs_cards_v1';

@Injectable({ providedIn: 'root' })
export class SrsService {
  private api = inject(ApiService);

  /** All of the current user's cards. */
  getAll(): Observable<SrsCard[]> {
    return this.api.get<SrsCard[]>('/srs').pipe(catchError(() => of([])));
  }

  /** Record a review; backend reschedules and returns the updated card. */
  review(sectionId: string, name: string, quality: number, score?: number): Observable<SrsCard> {
    return this.api.post<SrsCard>('/srs/review', { sectionId, name, quality, score });
  }

  /**
   * One-time migration of a browser's old localStorage schedule to the server.
   * Returns the merged server list, or null if there was nothing to migrate.
   */
  migrateLegacy(): Observable<SrsCard[]> | null {
    let raw: string | null = null;
    try { raw = localStorage.getItem(LEGACY_KEY); } catch { return null; }
    if (!raw) return null;

    let parsed: Record<string, any>;
    try { parsed = JSON.parse(raw); } catch { localStorage.removeItem(LEGACY_KEY); return null; }

    const cards = Object.values(parsed).map((c: any) => ({
      sectionId: c.id ?? c.sectionId,
      name: c.name,
      ease: c.ease ?? 2.5,
      intervalDays: c.intervalDays ?? 0,
      reps: c.reps ?? 0,
      lapses: c.lapses ?? 0,
      // pull the old per-section brain-dump score across too, if present
      lastScore: this.readLegacyScore(c.id ?? c.sectionId),
      due: c.due ?? Date.now(),
      lastReviewed: c.lastReviewed ?? 0,
    })).filter(c => c.sectionId);

    if (!cards.length) { localStorage.removeItem(LEGACY_KEY); return null; }

    return this.api.post<SrsCard[]>('/srs/import', cards).pipe(
      tap(() => {
        try {
          localStorage.removeItem(LEGACY_KEY);
          // legacy brain-dump scores are now on the server cards
          Object.keys(localStorage)
            .filter(k => k.startsWith('brainDump_'))
            .forEach(k => localStorage.removeItem(k));
        } catch {}
      }),
      catchError(() => of([])),
    );
  }

  private readLegacyScore(sectionId: string): number | null {
    try {
      const raw = localStorage.getItem(`brainDump_${sectionId}`);
      if (!raw) return null;
      const e = JSON.parse(raw);
      return typeof e.pct === 'number' ? e.pct : null;
    } catch { return null; }
  }

  /** Map a brain-dump coverage percentage (0–100) to an SM-2 quality grade. */
  qualityFromScore(pct: number): number {
    if (pct >= 85) return 5;
    if (pct >= 70) return 4;
    if (pct >= 50) return 3;
    if (pct >= 35) return 2;
    return 1;
  }

  /** Human-friendly "due" description, e.g. "tomorrow", "in 5 days", "in 3 weeks". */
  describeDue(ts: number): string {
    const diff = ts - Date.now();
    if (diff <= 0) return 'now';
    const days = Math.round(diff / DAY);
    if (days <= 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days < 7) return `in ${days} days`;
    if (days < 14) return 'in 1 week';
    if (days < 30) return `in ${Math.round(days / 7)} weeks`;
    if (days < 60) return 'in 1 month';
    return `in ${Math.round(days / 30)} months`;
  }
}
