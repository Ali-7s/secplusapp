import { Injectable, computed, signal } from '@angular/core';
import {
  CardRecord, ExamRecord, LessonRecord, ProgressData, makeBackup, parseProgress, readBackup, recordQuestion,
} from '../utils/progress';
import { Rating, answerOutsideQueue, dayKey, schedule } from '../utils/srs';

const KEY = 'sp-progress';
const BACKUP_KEY = 'sp-last-backup';

export type CardKind = 'acr' | 'term';
export const cardKey = (kind: CardKind, name: string) => `${kind}:${name}`;

/**
 * The app's memory. Progress lives in this browser's localStorage under "sp-progress"; the backup file carries
 * every "sp-" key so it can be restored here or in another browser. Nothing is ever sent anywhere.
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly state = signal<ProgressData>(parseProgress(this.read(KEY)));
  readonly data = this.state.asReadonly();
  readonly lastBackup = signal<number | null>(Number(this.read(BACKUP_KEY)) || null);
  readonly hasProgress = computed(() => {
    const d = this.state();
    return d.exams.length > 0 || Object.keys(d.questions).length > 0 || Object.keys(d.cards).length > 0 || Object.keys(d.lessons).length > 0;
  });
  private askedToPersist = false;

  // ── Recording ─────────────────────────────────────────────────────────

  /** A graded practice exam, plus the result of every question in it. */
  recordExam(exam: Omit<ExamRecord, 'at'>, results: { id: string; correct: boolean }[]) {
    const now = Date.now();
    this.update(d => {
      d.exams.push({ ...exam, at: now });
      for (const r of results) d.questions[r.id] = recordQuestion(d.questions[r.id], r.correct, now);
    });
  }

  /**
   * A flashcard rated in flip or cloze mode (got it is Good, still learning is Again), or a Quick Check answered
   * right or wrong. These happen outside Review mode's queue, so remembering a card early never pushes it out.
   */
  recordCard(kind: CardKind, name: string, known: boolean) {
    const key = cardKey(kind, name);
    this.update(d => { d.cards[key] = answerOutsideQueue(d.cards[key], known ? 'good' : 'again', Date.now()); });
  }

  /** An answer in Review mode. A card seen for the first time counts toward today's new-card limit. */
  answerCard(kind: CardKind, name: string, rating: Rating) {
    const key = cardKey(kind, name);
    const now = Date.now();
    this.update(d => {
      if (!d.cards[key]) {
        this.rollDay(d, now);
        d.review.newToday[kind]++;
      }
      d.cards[key] = schedule(d.cards[key], rating, now);
    });
  }

  /** Puts a card and the daily counts back as they were before an answer, for Review mode's undo. */
  restoreCard(kind: CardKind, name: string, card: CardRecord | undefined, review: ProgressData['review']) {
    const key = cardKey(kind, name);
    this.update(d => {
      if (card) d.cards[key] = card;
      else delete d.cards[key];
      d.review = review;
    });
  }

  /** New cards Review mode may still introduce today in a deck. */
  newLeftToday(kind: CardKind): number {
    const a = this.state().review;
    return a.day === dayKey(Date.now()) ? a.newPerDay - a.newToday[kind] : a.newPerDay;
  }

  setNewPerDay(n: number) {
    this.update(d => { d.review.newPerDay = Math.max(0, Math.min(999, Math.round(n))); });
  }

  /** Raises today's new-card limit for one deck. */
  studyMoreNew(kind: CardKind, extra: number) {
    this.update(d => {
      this.rollDay(d, Date.now());
      d.review.newToday[kind] -= extra;
    });
  }

  card(kind: CardKind, name: string): CardRecord | undefined {
    return this.state().cards[cardKey(kind, name)];
  }

  /** A finished end-of-lesson self-check. Finishing it marks the lesson complete. */
  recordLessonCheck(slug: string, score: number, total: number) {
    const now = Date.now();
    this.update(d => {
      const l = this.lesson(d, slug);
      l.check = { score, total, at: now };
      l.completedAt ??= now;
    });
  }

  /** A checked PBQ inside a lesson; keeps the best result. */
  recordLessonPbq(slug: string, id: string, fraction: number) {
    this.update(d => {
      const l = this.lesson(d, slug);
      l.pbqs[id] = Math.max(l.pbqs[id] ?? 0, fraction);
    });
  }

  lessonRecord(slug: string): LessonRecord | undefined {
    return this.state().lessons[slug];
  }

  // ── Backup ────────────────────────────────────────────────────────────

  /** Every saved key of the app as a downloadable backup file. */
  exportBackup(): { name: string; text: string } {
    const data: Record<string, string> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('sp-') && k !== BACKUP_KEY) data[k] = localStorage.getItem(k) ?? '';
      }
    } catch { /* storage unavailable */ }
    const now = new Date();
    this.write(BACKUP_KEY, String(now.getTime()));
    this.lastBackup.set(now.getTime());
    return { name: `secplus-progress-${now.toISOString().slice(0, 10)}.json`, text: JSON.stringify(makeBackup(data, now), null, 1) };
  }

  /** Replaces this browser's saved data with a backup. The page reloads afterwards so every screen picks it up. */
  importBackup(text: string): string | null {
    const result = readBackup(text);
    if ('error' in result) return result.error;
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('sp-')) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(result.data)) localStorage.setItem(k, v);
    } catch {
      return 'This browser would not let the backup be saved.';
    }
    this.state.set(parseProgress(this.read(KEY)));
    return null;
  }

  /** Forgets all study progress (keeps the light or dark theme). */
  resetAll() {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('sp-') && k !== 'sp-theme') localStorage.removeItem(k);
    } catch { /* storage unavailable */ }
    this.state.set(parseProgress(null));
    this.lastBackup.set(null);
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /** Starts fresh new-card counts on a new day. */
  private rollDay(d: ProgressData, now: number) {
    const today = dayKey(now);
    if (d.review.day !== today) d.review = { ...d.review, day: today, newToday: { acr: 0, term: 0 } };
  }

  private lesson(d: ProgressData, slug: string): LessonRecord {
    return (d.lessons[slug] ??= { pbqs: {} });
  }

  private update(change: (d: ProgressData) => void) {
    const next = structuredClone(this.state());
    change(next);
    this.state.set(next);
    this.write(KEY, JSON.stringify(next));
    this.persist();
  }

  /** Asks the browser not to clear this site's storage when space runs low. */
  private persist() {
    if (this.askedToPersist) return;
    this.askedToPersist = true;
    try { void navigator.storage?.persist?.(); } catch { /* not supported */ }
  }

  private read(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  private write(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* storage full or unavailable */ }
  }
}

