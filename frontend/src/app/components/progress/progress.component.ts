import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { ContentService } from '../../services/content.service';
import { ProgressService, cardKey } from '../../services/progress.service';
import { BrainDumpStore } from '../../services/brain-dump-store.service';
import { SyncService } from '../../services/sync.service';
import { DOMAIN_NAMES, ExamDomain, ExamQuestion, OBJECTIVE_NAMES } from '../../models/exam.model';
import { EXAM_SPECS, ExamLength, PASSING_SCALED } from '../../utils/exam-engine';
import { CardRecord, ExamRecord, objectiveScores } from '../../utils/progress';
import { isDueCard, isLearning, isMature } from '../../utils/srs';
import { DeckState, Plan, buildPlan, localDate } from '../../utils/plan';
import { SY0_701_RETIRES } from '../../content/objectives';
import { LESSON_META } from '../networking/lessons/lesson-index';

interface DeckStats { total: number; studied: number; learning: number; young: number; mature: number; due: number; dump: { nailed: number; partly: number; missed: number } }

/**
 * The Today page: a plan for the day toward your exam date, a readiness estimate, and below it everything the app
 * remembers about your studying: exam scores over time, weak objectives and
 * cards, flashcard and lesson progress, plus sync between devices and reset.
 */
@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, FormsModule, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './progress.component.html',
  styleUrl: './progress.component.scss',
})
export class ProgressComponent implements OnInit {
  private content = inject(ContentService);
  private dumpStore = inject(BrainDumpStore);
  readonly progress = inject(ProgressService);
  readonly sync = inject(SyncService);

  readonly passing = PASSING_SCALED;
  readonly domains = [1, 2, 3, 4, 5] as ExamDomain[];
  readonly domainNames = DOMAIN_NAMES;
  readonly lessons = LESSON_META;

  private pool = signal<ExamQuestion[]>([]);
  private acronymNames = signal<string[]>([]);
  private termNames = signal<string[]>([]);
  message = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  readonly retires = SY0_701_RETIRES;
  readonly today = localDate(Date.now());

  ngOnInit() {
    forkJoin([this.content.getPracticeExam(), this.content.getAcronyms(), this.content.getTerms()]).subscribe({
      next: ([pool, acronyms, terms]) => {
        this.pool.set(pool);
        this.acronymNames.set(acronyms.map(a => a.acronym));
        this.termNames.set(terms.map(t => t.term));
      },
      error: () => this.message.set({ kind: 'error', text: 'Some study data could not be loaded, so parts of this page may be empty.' }),
    });
  }

  // ── Today ─────────────────────────────────────────────────────────────

  readonly examDate = computed(() => this.progress.data().plan.examDate ?? null);

  private deckState(kind: 'acr' | 'term', names: string[], label: string, path: string): DeckState {
    const cards = this.progress.data().cards;
    const now = Date.now();
    let studied = 0, due = 0;
    for (const name of names) {
      const c = cards[cardKey(kind, name)];
      if (!c) continue;
      studied++;
      if (isDueCard(c, now)) due++;
    }
    return { label, path, total: names.length, studied, due, newLeftToday: Math.max(0, this.progress.newLeftToday(kind)) };
  }

  /** Objectives none of whose practice questions you have answered yet. */
  readonly untestedObjectives = computed(() => {
    const answered = this.progress.data().questions;
    const tested = new Set(this.pool().filter(q => answered[q.id]).map(q => q.objective));
    return Object.keys(OBJECTIVE_NAMES).filter(id => !tested.has(id));
  });

  readonly plan = computed<Plan | null>(() => {
    if (!this.pool().length) return null;
    const d = this.progress.data();
    const next = this.lessons.find(l => !d.lessons[l.slug]?.completedAt);
    return buildPlan({
      now: Date.now(),
      examDate: d.plan.examDate,
      decks: [
        this.deckState('acr', this.acronymNames(), 'Acronyms', '/acronyms'),
        this.deckState('term', this.termNames(), 'Key Terms', '/terms'),
      ],
      newPerDay: d.review.newPerDay,
      nextLesson: next && { slug: next.slug, number: next.number, title: next.title },
      exams: d.exams,
      weakObjectives: this.weakObjectives().map(o => o.objective),
      untestedObjectives: this.untestedObjectives(),
      missedQuestions: this.missedCount(),
      days: d.days,
    }, this.objectives().length, Object.keys(OBJECTIVE_NAMES).length);
  });

  setExamDate(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.progress.setExamDate(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
  }

  clearExamDate() { this.progress.setExamDate(null); }

  setNewPerDay(n: number) { this.progress.setNewPerDay(n); }

  verdictLabel(v: Plan['readiness']['verdict']): string {
    return { unknown: 'Not enough data yet', 'not-yet': 'Not ready yet', borderline: 'Borderline', ready: 'Looking ready' }[v];
  }

  // ── Exams ─────────────────────────────────────────────────────────────

  readonly exams = computed(() => this.progress.data().exams);
  readonly recentExams = computed(() => [...this.exams()].reverse().slice(0, 10));
  readonly bestScore = computed(() => Math.max(0, ...this.exams().map(e => e.scaled)));
  /** Average of the last three scores, the best single guide to readiness. */
  readonly recentAverage = computed(() => {
    const last = this.exams().slice(-3);
    return last.length ? Math.round(last.reduce((s, e) => s + e.scaled, 0) / last.length) : 0;
  });

  /** Per-domain percent averaged over the last five exams that included that domain. */
  readonly domainAverages = computed(() => this.domains.map(d => {
    const values = this.exams().map(e => e.byDomain[d]).filter((v): v is number => v !== null && v !== undefined).slice(-5);
    return { domain: d, name: this.domainNames[d], value: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null };
  }));

  /** Points for the score chart: x spread across the width, y from 100 (bottom) to 900 (top). */
  readonly chart = computed(() => {
    const exams = this.exams().slice(-20);
    const w = 600, h = 200, pad = 28;
    const x = (i: number) => exams.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (exams.length - 1);
    const y = (score: number) => h - pad - ((score - 100) / 800) * (h - 2 * pad);
    return {
      w, h,
      passY: y(PASSING_SCALED),
      points: exams.map((e, i) => ({ x: x(i), y: y(e.scaled), e })),
      line: exams.map((e, i) => `${x(i)},${y(e.scaled)}`).join(' '),
    };
  });

  lengthLabel(e: ExamRecord): string {
    if (e.length === 'objective' && e.objective) return `Objective ${e.objective} drill`;
    return e.length in EXAM_SPECS ? EXAM_SPECS[e.length as ExamLength].label : 'Practice exam';
  }

  // ── Weak spots ────────────────────────────────────────────────────────

  readonly objectives = computed(() => {
    const byId = new Map(this.pool().map(q => [q.id, q]));
    return objectiveScores(this.progress.data().questions, id => byId.get(id), 3);
  });
  readonly weakObjectives = computed(() => this.objectives().filter(o => o.rate < 0.75).slice(0, 8));
  readonly answeredCount = computed(() => Object.keys(this.progress.data().questions).length);
  readonly missedCount = computed(() => Object.values(this.progress.data().questions).filter(q => !q.last).length);

  objectiveName(o: string): string { return OBJECTIVE_NAMES[o] ?? 'Objective ' + o; }

  /** Glossary cards you get wrong most, for a targeted review. */
  readonly troubleCards = computed(() => Object.entries(this.progress.data().cards)
    .filter(([, c]) => c.wrong > 0 && !isMature(c) && (c.lapses > 0 || c.state !== 'review' || c.ease < 2.5))
    .sort(([, a], [, b]) => b.wrong - a.wrong || a.ease - b.ease)
    .slice(0, 16)
    .map(([key, c]) => {
      const [kind, ...rest] = key.split(':');
      const name = rest.join(':');
      return { kind, name, card: c, link: kind === 'acr' ? '/acronyms' : '/terms' };
    }));

  // ── Flashcards ────────────────────────────────────────────────────────

  readonly acronymStats = computed(() => this.deckStats('acr', this.acronymNames(), 'acronyms'));
  readonly termStats = computed(() => this.deckStats('term', this.termNames(), 'terms'));

  private deckStats(kind: 'acr' | 'term', names: string[], deck: 'acronyms' | 'terms'): DeckStats {
    const cards = this.progress.data().cards;
    const now = Date.now();
    let studied = 0, learning = 0, young = 0, mature = 0, due = 0;
    for (const name of names) {
      const c: CardRecord | undefined = cards[cardKey(kind, name)];
      if (!c) continue;
      studied++;
      if (isLearning(c)) learning++;
      else if (isMature(c)) mature++;
      else young++;
      if (isDueCard(c, now)) due++;
    }
    const dump = { nailed: 0, partly: 0, missed: 0 };
    for (const r of this.dumpStore.load(deck).values()) dump[r]++;
    return { total: names.length, studied, learning, young, mature, due, dump };
  }

  pct(part: number, whole: number): number { return whole ? Math.round((part / whole) * 100) : 0; }

  // ── Lessons ───────────────────────────────────────────────────────────

  lessonRecord(slug: string) { return this.progress.lessonRecord(slug); }
  readonly lessonsDone = computed(() => {
    this.progress.data();
    return this.lessons.filter(l => this.progress.lessonRecord(l.slug)?.completedAt).length;
  });
  pbqCount(slug: string): number { return Object.keys(this.progress.lessonRecord(slug)?.pbqs ?? {}).length; }

  // ── Reset ─────────────────────────────────────────────────────────────

  reset() {
    const where = this.sync.code() ? 'on every device you sync with' : 'in this browser';
    if (!confirm(`This deletes all saved progress ${where}: exam history, flashcard progress, lesson progress and brain dump ratings. This cannot be undone. Delete everything?`)) return;
    if (this.sync.code()) {
      this.progress.resetAll();
      void this.sync.syncNow().then(() => location.reload());
      return;
    }
    this.progress.resetAll();
    location.reload();
  }

  // ── Sync ──────────────────────────────────────────────────────────────

  syncCodeInput = '';
  readonly syncBusy = signal(false);
  readonly codeShown = signal(false);

  /** Jumps to the sync card and puts the cursor in the code box, for a device that has nothing yet. */
  goToSync() {
    const card = document.getElementById('sync');
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card?.querySelector<HTMLInputElement>('.code-input')?.focus({ preventScroll: true });
  }

  async turnOnSync() {
    this.syncBusy.set(true);
    await this.sync.turnOn();
    this.syncBusy.set(false);
    this.codeShown.set(true);
  }

  async connectSync() {
    this.syncBusy.set(true);
    const error = await this.sync.connect(this.syncCodeInput);
    this.syncBusy.set(false);
    if (error) {
      this.message.set({ kind: 'error', text: error });
      return;
    }
    this.syncCodeInput = '';
    this.message.set({ kind: 'ok', text: 'Connected. Your progress from your other devices is here, and changes now sync both ways.' });
  }

  async copyCode() {
    const code = this.sync.code();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.message.set({ kind: 'ok', text: 'Sync code copied.' });
    } catch {
      this.codeShown.set(true);
    }
  }

  turnOffSync() {
    if (!confirm('Stop syncing on this device? Your progress stays here and on your other devices, but changes here will no longer reach them.')) return;
    this.sync.turnOff();
    this.codeShown.set(false);
  }

  async forgetDevice() {
    if (!confirm('Remove your progress from this device? Anything not yet synced is sent first, so nothing is lost. Your other devices keep everything.')) return;
    this.syncBusy.set(true);
    await this.sync.turnOffAndForget();
    location.reload();
  }
}
