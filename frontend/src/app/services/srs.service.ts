import { Injectable, signal } from '@angular/core';

/**
 * Spaced-repetition scheduler (SM-2 variant), persisted to localStorage.
 *
 * Items are scheduled at the *section* grain: each time you review a section
 * (via a brain dump or an explicit self-rating), the section's next due date
 * is pushed out along an expanding interval — unless you did poorly, in which
 * case it comes back tomorrow. This is the spacing effect: re-retrieving at
 * growing intervals is what turns short-term recall into durable memory.
 */

export interface SrsCard {
  id: string;            // sectionId
  name: string;          // section name (for display)
  ease: number;          // ease factor (SM-2), starts at 2.5, floor 1.3
  intervalDays: number;  // current scheduling interval in days
  reps: number;          // consecutive successful reviews
  due: number;           // epoch ms when next due
  lastReviewed: number;  // epoch ms of last review
  lapses: number;        // times forgotten (quality < 3)
}

const DAY = 24 * 60 * 60 * 1000;
const KEY = 'srs_cards_v1';

@Injectable({ providedIn: 'root' })
export class SrsService {
  /** Bumped whenever the store changes so components can react. */
  readonly version = signal(0);

  private load(): Record<string, SrsCard> {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private save(cards: Record<string, SrsCard>) {
    try {
      localStorage.setItem(KEY, JSON.stringify(cards));
      this.version.update(v => v + 1);
    } catch {}
  }

  getAll(): SrsCard[] {
    return Object.values(this.load());
  }

  getCard(id: string): SrsCard | null {
    return this.load()[id] ?? null;
  }

  /** Sections due now (due timestamp in the past), soonest first. */
  getDue(): SrsCard[] {
    const now = Date.now();
    return this.getAll()
      .filter(c => c.due <= now)
      .sort((a, b) => a.due - b.due);
  }

  getDueCount(): number {
    return this.getDue().length;
  }

  /** Count of cards becoming due within the next `days` days (excludes already-due). */
  forecastCount(days: number): number {
    const now = Date.now();
    const horizon = now + days * DAY;
    return this.getAll().filter(c => c.due > now && c.due <= horizon).length;
  }

  /**
   * Record a review and reschedule. `quality` is 0–5 (SM-2 convention):
   *   5 = perfect/easy, 4 = good, 3 = passed with effort,
   *   2 = wrong but familiar, 1 = wrong, 0 = blackout.
   * quality < 3 is a lapse: reset the interval and review again tomorrow.
   */
  review(id: string, name: string, quality: number): SrsCard {
    const cards = this.load();
    const now = Date.now();
    const existing = cards[id];

    let ease = existing?.ease ?? 2.5;
    let reps = existing?.reps ?? 0;
    let interval = existing?.intervalDays ?? 0;
    let lapses = existing?.lapses ?? 0;

    // SM-2 ease update
    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease < 1.3) ease = 1.3;

    if (quality < 3) {
      // Lapse — relearn from the start
      reps = 0;
      interval = 1;
      lapses += 1;
    } else {
      if (reps === 0) interval = 1;
      else if (reps === 1) interval = 6;
      else interval = Math.round(interval * ease);
      reps += 1;
    }
    if (interval < 1) interval = 1;

    const card: SrsCard = {
      id,
      name: name || existing?.name || id,
      ease,
      intervalDays: interval,
      reps,
      due: now + interval * DAY,
      lastReviewed: now,
      lapses,
    };
    cards[id] = card;
    this.save(cards);
    return card;
  }

  /** Map a brain-dump coverage percentage (0–100) to an SM-2 quality grade. */
  qualityFromScore(pct: number): number {
    if (pct >= 85) return 5;
    if (pct >= 70) return 4;
    if (pct >= 50) return 3;
    if (pct >= 35) return 2;
    return 1;
  }

  remove(id: string) {
    const cards = this.load();
    delete cards[id];
    this.save(cards);
  }

  /** Human-friendly "due" description, e.g. "tomorrow", "in 5 days", "in 3 weeks". */
  describeDue(ts: number): string {
    const now = Date.now();
    const diff = ts - now;
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
