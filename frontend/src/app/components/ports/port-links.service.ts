import { Injectable, inject } from '@angular/core';
import { ProgressService } from '../../services/progress.service';
import { SrsCard } from '../../utils/srs';
import { loadMemory } from './firewall-memory';
import { creditReview } from './port-links';
import { Mastery, Practiced } from './ports-trainer';
import { memoryKey } from './rule-cards';

const SLUG = 'ports-trainer';

/** Carries Review mode answers on port cards over to the Ports trainer, which keeps its state in its own saved work. */
@Injectable({ providedIn: 'root' })
export class PortLinks {
  private progress = inject(ProgressService);

  /** Counts a Review answer in the trainer too. Returns a way to take it back (for Review mode's undo), or null if the card is not a port card. */
  reviewed(cardId: string, right: boolean): (() => void) | null {
    const mastery = (this.progress.lessonWork(SLUG, 'mastery') as Mastery | undefined) ?? {};
    const practiced = (this.progress.lessonWork(SLUG, 'practiced') as Practiced | undefined) ?? {};
    const memory = loadMemory(key => this.progress.lessonWork(SLUG, key));
    const change = creditReview({ mastery, practiced, memory }, cardId, right, Date.now(), this.progress.data().review.retention);
    if (!change) return null;

    const rules = Object.entries(change.rules);
    const before: Record<string, SrsCard | null> = Object.fromEntries(rules.map(([fact]) => [memoryKey(fact), memory[fact] ?? null]));
    this.progress.setLessonWorks(SLUG, { mastery: change.mastery, ...Object.fromEntries(rules.map(([fact, card]) => [memoryKey(fact), card])) });
    return () => this.progress.setLessonWorks(SLUG, { mastery, ...before });
  }
}
