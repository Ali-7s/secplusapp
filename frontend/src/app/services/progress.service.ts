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
 * every "sp-" key so it can be restored here or in another browser. Nothing leaves the browser unless sync is
 * turned on (SyncService), and then only encrypted.
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
  /** Counts changes made on this device, so sync knows when there is something to send. */
  readonly changes = signal(0);

  // ── Recording ─────────────────────────────────────────────────────────

  /** A graded practice exam, plus the result of every question in it. */
  recordExam(exam: Omit<ExamRecord, 'at'>, results: { id: string; correct: boolean }[]) {
    const now = Date.now();
    this.update(d => {
      d.exams.push({ ...exam, at: now });
      for (const r of results) d.questions[r.id] = recordQuestion(d.questions[r.id], r.correct, now);
      this.studied(d, now, results.length);
    });
  }

  /**
   * A flashcard rated in flip or cloze mode (got it is Good, still learning is Again), or a Quick Check answered
   * right or wrong. These happen outside Review mode's queue, so remembering a card early never pushes it out.
   */
  recordCard(kind: CardKind, name: string, known: boolean) {
    const key = cardKey(kind, name);
    const now = Date.now();
    this.update(d => {
      d.cards[key] = answerOutsideQueue(d.cards[key], known ? 'good' : 'again', now);
      this.studied(d, now);
    });
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
      this.studied(d, now);
    });
  }

  /** The exam date the Today page plans toward ("2026-12-15"), or null to clear it. */
  setExamDate(date: string | null) {
    this.update(d => {
      if (date) d.plan.examDate = date;
      else delete d.plan.examDate;
      d.settingsAt = Date.now();
    });
  }

  /** Puts a card and the daily counts back as they were before an answer, for Review mode's undo. */
  restoreCard(kind: CardKind, name: string, card: CardRecord | undefined, review: ProgressData['review']) {
    const key = cardKey(kind, name);
    this.update(d => {
      // The restored card is stamped now, so sync treats the undo as the latest answer.
      if (card) d.cards[key] = { ...card, at: Math.max(Date.now(), (d.cards[key]?.at ?? 0) + 1) };
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
    this.update(d => {
      d.review.newPerDay = Math.max(0, Math.min(999, Math.round(n)));
      d.settingsAt = Date.now();
    });
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
      this.studied(d, now, total);
    });
  }

  /** A checked PBQ inside a lesson; keeps the best result. */
  recordLessonPbq(slug: string, id: string, fraction: number) {
    this.update(d => {
      const l = this.lesson(d, slug);
      l.pbqs[id] = Math.max(l.pbqs[id] ?? 0, fraction);
      this.studied(d, Date.now());
    });
  }

  /** Remembers the part of a lesson being read. Reading position is not study activity, so it does not count toward streaks. */
  setLessonPart(slug: string, part: number) {
    if (this.state().lessons[slug]?.part === part) return;
    this.update(d => { this.lesson(d, slug).part = part; });
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

  /**
   * Forgets all study progress (keeps the light or dark theme and sync). The reset is dated so that, with sync on,
   * other devices drop their older copies too instead of bringing them back.
   */
  resetAll() {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('sp-') && k !== 'sp-theme' && k !== 'sp-sync') localStorage.removeItem(k);
      // Dating the now-empty brain dump ratings lets them replace older ratings on synced devices.
      localStorage.setItem('sp-braindump-at', String(Date.now()));
    } catch { /* storage unavailable */ }
    this.lastBackup.set(null);
    this.update(d => {
      Object.assign(d, parseProgress(null));
      // Settings are reset too, so they count as changed now and win over other devices' older choices.
      d.resetAt = d.settingsAt = Date.now();
    });
  }

  /** Forgets everything on this device without telling other devices, for leaving a borrowed computer clean. */
  forgetThisDevice() {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('sp-') && k !== 'sp-theme') localStorage.removeItem(k);
    } catch { /* storage unavailable */ }
    this.state.set(parseProgress(null));
    this.lastBackup.set(null);
  }

  /** Takes in progress combined with another device's copy. It is not a change made here, so it does not count as one. */
  replaceFromSync(data: ProgressData) {
    this.state.set(data);
    this.write(KEY, JSON.stringify(data));
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /** Counts study activity on today's date, keeping the last 120 days. */
  private studied(d: ProgressData, now: number, amount = 1) {
    const today = dayKey(now);
    d.days[today] = (d.days[today] ?? 0) + amount;
    const keys = Object.keys(d.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 120))) delete d.days[k];
  }

  /** Starts fresh new-card counts on a new day. */
  private rollDay(d: ProgressData, now: number) {
    const today = dayKey(now);
    if (d.review.day !== today) d.review = { ...d.review, day: today, newToday: { acr: 0, term: 0 } };
  }

  private lesson(d: ProgressData, slug: string): LessonRecord {
    const lesson = (d.lessons[slug] ??= { pbqs: {} });
    lesson.at = Date.now();
    return lesson;
  }

  private update(change: (d: ProgressData) => void) {
    const next = structuredClone(this.state());
    change(next);
    this.state.set(next);
    this.write(KEY, JSON.stringify(next));
    this.changes.update(n => n + 1);
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

