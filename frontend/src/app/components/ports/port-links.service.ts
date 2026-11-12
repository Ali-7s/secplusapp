import { Injectable, inject } from '@angular/core';
import { ProgressService } from '../../services/progress.service';
import { SrsCard } from '../../utils/srs';
import { loadMemory } from './firewall-memory';
import { creditReview } from './port-links';
import { memoryKey } from './rule-cards';

const SLUG = 'ports-trainer';

/** Carries Review mode answers on port cards over to the Ports trainer, which keeps its state in its own saved work. */
@Injectable({ providedIn: 'root' })
export class PortLinks {
  private progress = inject(ProgressService);

  /**
   * Counts a Review answer on a port card for its firewall rules too (the port's level needs nothing: it is read from
   * the card itself). Returns a way to take it back (for Review mode's undo), or null if the card is not a port card.
   */
  reviewed(cardId: string, right: boolean): (() => void) | null {
    const memory = loadMemory(key => this.progress.lessonWork(SLUG, key));
    const rules = creditReview(memory, cardId, right, Date.now(), this.progress.data().review.retention);
    if (!rules) return null;

    const changed = Object.entries(rules);
    if (!changed.length) return () => undefined;
    const before: Record<string, SrsCard | null> = Object.fromEntries(changed.map(([fact]) => [memoryKey(fact), memory[fact] ?? null]));
    this.progress.setLessonWorks(SLUG, Object.fromEntries(changed.map(([fact, card]) => [memoryKey(fact), card])));
    return () => this.progress.setLessonWorks(SLUG, before);
  }
}
