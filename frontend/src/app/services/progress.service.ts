import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { CardKind, CardRecord, ExamRecord, LessonRecord, ProgressData, noNewToday, parseProgress, recordQuestion } from '../utils/progress';
import { Rating, answerOutsideQueue, clampRetention, dayKey, schedule } from '../utils/srs';
import { ScrollSpot, sameSpot } from '../utils/scroll-spot';
import { mergeProgress, stableStringify } from '../utils/sync';

const KEY = 'sp-progress';

export type { CardKind };
export const cardKey = (kind: CardKind, name: string) => `${kind}:${name}`;

/**
 * The app's memory. Progress lives in this browser's localStorage under "sp-progress", so studying works offline
 * and every answer saves instantly. With sync on (SyncService) an encrypted copy keeps every device alike.
 *
 * Each open tab holds its own copy and writes the whole of it back on every change, so two tabs would overwrite each
 * other's work. Instead, when another tab saves, this one combines that copy with its own, by the same rules sync uses.
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly state = signal<ProgressData>(parseProgress(this.read(KEY)));
  readonly data = this.state.asReadonly();
  readonly hasProgress = computed(() => {
    const d = this.state();
    return d.exams.length > 0 || Object.keys(d.questions).length > 0 || Object.keys(d.cards).length > 0 || Object.keys(d.lessons).length > 0;
  });
  private askedToPersist = false;
  /** Counts changes made on this device, so sync knows when there is something to send. */
  readonly changes = signal(0);

  constructor() {
    const onStorage = (e: StorageEvent) => this.fromOtherTab(e);
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

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
   * A flashcard rated in flip mode (got it is Good, still learning is Again), or a Quick Check answered
   * right or wrong. These happen outside Review mode's queue, so remembering a card early never pushes it out.
   */
  recordCard(kind: CardKind, name: string, known: boolean) {
    const key = cardKey(kind, name);
    const now = Date.now();
    this.update(d => {
      d.cards[key] = answerOutsideQueue(d.cards[key], known ? 'good' : 'again', now, { retention: d.review.retention, id: key });
      this.studied(d, now);
    });
  }

  /**
   * Several cards answered at once somewhere other than Review mode, such as the ports a checked firewall table
   * asked about. An answer marked `review` was typed, checked and tested the whole card, so it counts as a review
   * even when the card was not due yet; the others follow the rule above.
   */
  recordCards(kind: CardKind, answers: { name: string; known: boolean; review?: boolean }[]) {
    if (!answers.length) return;
    const now = Date.now();
    this.update(d => {
      for (const a of answers) {
        const key = cardKey(kind, a.name);
        const opts = { retention: d.review.retention, id: key };
        d.cards[key] = a.review ? schedule(d.cards[key], a.known ? 'good' : 'again', now, opts) : answerOutsideQueue(d.cards[key], a.known ? 'good' : 'again', now, opts);
      }
      this.studied(d, now, answers.length);
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
      d.cards[key] = schedule(d.cards[key], rating, now, { retention: d.review.retention, id: key });
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

  /**
   * Cards worked out elsewhere, saved as they are: the Ports trainer schedules a port's Reference cards by its own
   * rules (see port-memory.ts). `answers` counts toward today's study activity; null removes a card.
   */
  saveCards(kind: CardKind, cards: Record<string, CardRecord | null>, answers = 0) {
    if (!Object.keys(cards).length && !answers) return;
    this.update(d => {
      for (const [name, card] of Object.entries(cards)) {
        const key = cardKey(kind, name);
        if (card) d.cards[key] = card;
        else delete d.cards[key];
      }
      if (answers) this.studied(d, Date.now(), answers);
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

  /** Whether Review mode asks you to type each answer before showing it. */
  setTypeAnswers(on: boolean) {
    this.update(d => {
      d.review.typeAnswers = on;
      d.settingsAt = Date.now();
    });
  }

  /** The recall chance Review mode times reviews for (0.8 to 0.95). */
  setRetention(r: number) {
    this.update(d => {
      d.review.retention = clampRetention(r);
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

  /** Saves where you are reading. The part goes with it, so switching between one part at a time and the whole lesson keeps your place. */
  setLessonScroll(slug: string, spot: ScrollSpot) {
    const record = this.state().lessons[slug];
    if (sameSpot(record?.scroll, spot) && record?.part === spot.part) return;
    this.update(d => {
      const lesson = this.lesson(d, slug);
      lesson.scroll = spot;
      lesson.part = spot.part;
    });
  }

  /** Saved work on one of a lesson's exercises, or undefined when there is none (or it was reset). */
  lessonWork(slug: string, key: string): unknown {
    return this.state().lessons[slug]?.work?.[key]?.v ?? undefined;
  }

  /** Saves work on one of a lesson's exercises; null records a reset, so other devices drop their copy too. */
  setLessonWork(slug: string, key: string, value: unknown) {
    this.update(d => {
      const work = (this.lesson(d, slug).work ??= {});
      work[key] = { v: value == null ? null : structuredClone(value), at: Date.now() };
    });
  }

  /** Saves several pieces of a lesson's work in one go, each under its own key. */
  setLessonWorks(slug: string, values: Record<string, unknown>) {
    const at = Date.now();
    this.update(d => {
      const work = (this.lesson(d, slug).work ??= {});
      for (const [key, value] of Object.entries(values)) work[key] = { v: value == null ? null : structuredClone(value), at };
    });
  }

  lessonRecord(slug: string): LessonRecord | undefined {
    return this.state().lessons[slug];
  }

  // ── Reset ─────────────────────────────────────────────────────────────

  /**
   * Forgets all study progress (keeps the light or dark theme and sync). The reset is dated so that, with sync on,
   * other devices drop their older copies too instead of bringing them back.
   */
  resetAll() {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('sp-') && k !== 'sp-theme' && k !== 'sp-sync') localStorage.removeItem(k);
    } catch { /* storage unavailable */ }
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
  }

  /** Takes in progress combined with another device's copy. It is not a change made here, so it does not count as one. */
  replaceFromSync(data: ProgressData) {
    this.state.set(data);
    this.write(KEY, JSON.stringify(data));
  }

  // ── Other tabs ────────────────────────────────────────────────────────

  /**
   * Another tab of the app changed the stored progress. The browser tells every tab except the one that wrote, so
   * this never answers its own writes. Changes made in the other tab were counted there, so they are not counted here.
   */
  private fromOtherTab(e: StorageEvent) {
    if (e.key !== KEY && e.key !== null) return;
    if (e.newValue === null || e.key === null) {
      // The other tab forgot this device (or storage was cleared). Follow it, or the next save here would bring the data back.
      if (this.read(KEY) === null) this.state.set(parseProgress(null));
      return;
    }
    const theirs = parseProgress(e.newValue);
    const merged = mergeProgress(this.state(), theirs);
    const text = stableStringify(merged);
    if (text !== stableStringify(this.state())) this.state.set(merged);
    // This tab had something the other did not: store the combination. The other tab then finds nothing new, so it stops there.
    if (text !== stableStringify(theirs)) this.write(KEY, JSON.stringify(merged));
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
    if (d.review.day !== today) d.review = { ...d.review, day: today, newToday: noNewToday() };
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

