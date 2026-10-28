import { Injectable, signal } from '@angular/core';
import { DeckId, Rating, Scope } from '../utils/brain-dump';
import { DeckTimes, SyncedBrainDump } from '../utils/sync';

const STORAGE_KEY = 'sp-braindump';
/** When each card was rated and each deck cleared, so sync can keep the newest rating of every card. */
const TIMES_KEY = 'sp-braindump-times';

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

  /**
   * Saves one card's rating, dated, on top of whatever is stored now. Saving card by card (rather than a whole
   * round) means ratings that arrived from another device while a round was open are never overwritten.
   */
  rate(deck: DeckId, id: string, rating: Rating): void {
    this.change(deck, (ratings, times) => {
      ratings[id] = rating;
      times.cards[id] = Date.now();
    });
  }

  /** Forgets a deck's ratings. The clear is dated so synced devices forget their older ratings too. */
  clear(deck: DeckId): void {
    this.change(deck, (ratings, times) => {
      for (const id of Object.keys(ratings)) delete ratings[id];
      times.cleared = Date.now();
      times.cards = {};
    });
  }

  /** Every deck's ratings and when each was made, for sync. */
  forSync(): SyncedBrainDump {
    return { ratings: this.read() as SyncedBrainDump['ratings'], times: this.readTimes() };
  }

  /** Takes in ratings combined with another device's. Not a change made here, so it does not count as one. */
  replaceFromSync(dump: SyncedBrainDump): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dump.ratings));
      localStorage.setItem(TIMES_KEY, JSON.stringify(dump.times));
    } catch {
      // Storage is blocked or full: this device keeps what it had.
    }
  }

  private change(deck: DeckId, edit: (ratings: Record<string, Rating>, times: DeckTimes) => void): void {
    try {
      const all = this.read();
      const times = this.readTimes();
      const ratings = (all[deck] ??= {});
      const deckTimes = (times[deck] ??= { cards: {} });
      edit(ratings, deckTimes);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      localStorage.setItem(TIMES_KEY, JSON.stringify(times));
      this.changes.update(n => n + 1);
    } catch {
      // Storage is blocked or full: keep going without saving.
    }
  }

  private readTimes(): SyncedBrainDump['times'] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(TIMES_KEY) ?? '{}');
      // An early build saved a single number here; ratings without a time count as the oldest.
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as SyncedBrainDump['times']) : {};
    } catch {
      return {};
    }
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
