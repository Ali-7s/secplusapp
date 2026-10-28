import { Injectable, signal } from '@angular/core';
import { DeckId, Rating, Scope } from '../utils/brain-dump';

const STORAGE_KEY = 'sp-braindump';
/** When the ratings last changed on this device, so sync can keep the newer set. */
const CHANGED_KEY = 'sp-braindump-at';

type Saved = Partial<Record<DeckId, Record<string, Rating>>>;

/** How a round is set up: which cards, and whether they are shuffled. */
export interface RoundOptions {
  scope: Scope;
  shuffle: boolean;
}

const isRating = (value: unknown): value is Rating => value === 'missed' || value === 'partly' || value === 'nailed';

/**
 * Remembers which cards the learner could explain, so a study session can pick up where the last one stopped.
 *
 * It lives in this browser's localStorage. Storage can be blocked or full (private windows, strict settings), so
 * every access is guarded: when it fails, progress simply lasts until the page is closed.
 */
@Injectable({ providedIn: 'root' })
export class BrainDumpStore {
  private options: Partial<Record<DeckId, RoundOptions>> = {};
  /** Counts changes made on this device, so sync knows when there is something to send. */
  readonly changes = signal(0);

  /**
   * The deck and shuffle choice, kept for as long as the page is open so switching to another flashcard mode and
   * back does not undo it. Each visit starts from the cards not yet nailed.
   */
  roundOptions(deck: DeckId): RoundOptions {
    return this.options[deck] ?? { scope: 'todo', shuffle: false };
  }

  setRoundOptions(deck: DeckId, options: RoundOptions): void {
    this.options[deck] = options;
  }

  load(deck: DeckId): Map<string, Rating> {
    const ratings = new Map<string, Rating>();
    for (const [id, rating] of Object.entries(this.read()[deck] ?? {})) {
      if (isRating(rating)) ratings.set(id, rating);
    }
    return ratings;
  }

  save(deck: DeckId, results: ReadonlyMap<string, Rating>): void {
    try {
      const all = this.read();
      all[deck] = Object.fromEntries(results);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      localStorage.setItem(CHANGED_KEY, String(Date.now()));
      this.changes.update(n => n + 1);
    } catch {
      // Storage is blocked or full: keep going without saving.
    }
  }

  /** Every deck's ratings and when they last changed, for sync. */
  forSync(): { at: number; ratings: Record<string, Record<string, string>> } {
    let at = 0;
    try { at = Number(localStorage.getItem(CHANGED_KEY)) || 0; } catch { /* storage unavailable */ }
    return { at, ratings: this.read() as Record<string, Record<string, string>> };
  }

  /** Takes in ratings from another device. A study round already open keeps its own until it saves. */
  replaceFromSync(dump: { at: number; ratings: Record<string, Record<string, string>> }): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dump.ratings));
      localStorage.setItem(CHANGED_KEY, String(dump.at));
    } catch {
      // Storage is blocked or full: this device keeps what it had.
    }
  }

  clear(deck: DeckId): void {
    this.save(deck, new Map());
  }

  private read(): Saved {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Saved) : {};
    } catch {
      return {};
    }
  }
}
