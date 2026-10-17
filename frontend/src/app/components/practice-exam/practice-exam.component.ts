import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DOCUMENT, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ContentService } from '../../services/content.service';
import { lessonBySlug } from '../networking/lessons/lesson-index';
import {
  ChoiceQuestion, DOMAIN_NAMES, ExamDomain, ExamQuestion, FirewallQuestion, MatchQuestion, OrderQuestion, isPbq,
} from '../../models/exam.model';
import {
  EXAM_SPECS, ExamAnswer, ExamGrade, ExamItem, ExamLength, GradedQuestion, PASSING_SCALED,
  buildExam, examSize, correctIndexes, gradeExam, gradeQuestion, isAnswered, isStarted,
} from '../../utils/exam-engine';

export type ExamMode = 'exam' | 'study';
type ReviewFilter = 'all' | 'wrong' | 'flagged';

/** What is saved so a refresh mid-exam does not lose the attempt. The exam itself is rebuilt from the seed. */
interface SavedAttempt {
  length: ExamLength;
  mode: ExamMode;
  seed: number;
  answers: Record<string, ExamAnswer>;
  flagged: string[];
  checked: string[];
  index: number;
  deadline: number | null;
}

const STORAGE_KEY = 'sp-exam';

@Component({
  selector: 'app-practice-exam',
  standalone: true,
  imports: [DecimalPipe, NgTemplateOutlet, RouterLink, MatButtonModule, MatIconModule, DragDropModule],
  templateUrl: './practice-exam.component.html',
  styleUrl: './practice-exam.component.scss',
})
export class PracticeExamComponent implements OnInit, OnDestroy {
  private content = inject(ContentService);
  private document = inject(DOCUMENT);
  private route = inject(ActivatedRoute);

  readonly specs = EXAM_SPECS;
  readonly lengths: ExamLength[] = ['full', 'quick', 'network'];
  readonly domains = [1, 2, 3, 4, 5] as ExamDomain[];
  readonly domainNames = DOMAIN_NAMES;
  readonly passingScaled = PASSING_SCALED;
  readonly letters = 'ABCDEFGH';

  state: 'loading' | 'intro' | 'running' | 'result' | 'error' = 'loading';
  pool: ExamQuestion[] = [];
  private byId = new Map<string, ExamQuestion>();

  length: ExamLength = 'full';
  mode: ExamMode = 'exam';
  saved: SavedAttempt | null = null;

  seed = 0;
  items: ExamItem[] = [];
  answers: Record<string, ExamAnswer> = {};
  flagged = new Set<string>();
  /** Study mode: questions whose answer has been checked (and is now locked). */
  checked = new Set<string>();
  index = 0;
  deadline: number | null = null;
  secondsLeft = 0;
  showNavigator = false;
  confirmSubmit = false;

  grade: ExamGrade | null = null;
  reviewFilter: ReviewFilter = 'all';
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit() {
    const asked = this.route.snapshot.queryParamMap.get('length');
    if (asked && asked in this.specs) this.length = asked as ExamLength;
    this.content.getPracticeExam().subscribe({
      next: pool => {
        this.pool = pool;
        this.byId = new Map(pool.map(q => [q.id, q]));
        this.saved = this.loadSaved();
        this.state = 'intro';
      },
      error: () => (this.state = 'error'),
    });
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  // ── Starting, saving and resuming ────────────────────────────────────────

  get pbqCount(): number { return this.pool.filter(isPbq).length; }
  get choiceCount(): number { return this.pool.length - this.pbqCount; }
  totalFor(length: ExamLength): number { return examSize(length); }

  /** The Networking Basics lesson behind a question, for the "review the lesson" link in feedback. */
  lessonFor(q: ExamQuestion) { return lessonBySlug(q.lesson); }

  start() {
    this.begin({
      length: this.length, mode: this.mode, seed: Math.floor(Math.random() * 2 ** 31), answers: {}, flagged: [], checked: [],
      index: 0, deadline: this.mode === 'exam' ? Date.now() + this.specs[this.length].minutes * 60_000 : null,
    });
  }

  resume() {
    if (this.saved) this.begin(this.saved);
  }

  discardSaved() {
    this.saved = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  }

  private begin(a: SavedAttempt) {
    this.length = a.length;
    this.mode = a.mode;
    this.seed = a.seed;
    this.items = buildExam(this.pool, a.length, a.seed);
    this.answers = a.answers;
    this.flagged = new Set(a.flagged);
    this.checked = new Set(a.checked);
    this.index = Math.min(a.index, this.items.length - 1);
    this.deadline = a.deadline;
    this.grade = null;
    this.confirmSubmit = false;
    this.state = 'running';
    this.tick();
    clearInterval(this.timer);
    if (this.deadline) this.timer = setInterval(() => this.tick(), 1000);
    this.save();
  }

  private tick() {
    if (!this.deadline) return;
    this.secondsLeft = Math.max(0, Math.round((this.deadline - Date.now()) / 1000));
    if (this.secondsLeft === 0) this.submit();
  }

  private save() {
    if (this.state !== 'running') return;
    const attempt: SavedAttempt = {
      length: this.length, mode: this.mode, seed: this.seed, answers: this.answers, flagged: [...this.flagged],
      checked: [...this.checked], index: this.index, deadline: this.deadline,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(attempt)); } catch { /* storage unavailable */ }
  }

  private loadSaved(): SavedAttempt | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const a = JSON.parse(raw) as SavedAttempt;
      if (!(a.length in this.specs) || typeof a.seed !== 'number') return null;
      if (a.deadline && a.deadline < Date.now()) return null; // time ran out while away
      return a;
    } catch {
      return null;
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  get item(): ExamItem { return this.items[this.index]; }
  get current(): ExamQuestion { return this.byId.get(this.item.id)!; }
  question(item: ExamItem): ExamQuestion { return this.byId.get(item.id)!; }

  go(i: number) {
    const next = Math.max(0, Math.min(this.items.length - 1, i));
    if (next !== this.index) this.document.querySelector('mat-sidenav-content')?.scrollTo({ top: 0 });
    this.index = next;
    this.showNavigator = false;
    this.save();
  }

  toggleFlag(id: string) {
    this.flagged.has(id) ? this.flagged.delete(id) : this.flagged.add(id);
    this.save();
  }

  get answeredCount(): number {
    return this.items.filter(it => isAnswered(this.question(it), this.answers[it.id])).length;
  }

  navState(it: ExamItem): 'answered' | 'partial' | 'empty' {
    const q = this.question(it), a = this.answers[it.id];
    return isAnswered(q, a) ? 'answered' : isStarted(q, a) ? 'partial' : 'empty';
  }

  get timerText(): string {
    const m = Math.floor(this.secondsLeft / 60), s = this.secondsLeft % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Answering ──────────────────────────────────────────────────────────

  locked(id: string): boolean { return this.checked.has(id); }
  private answerFor(id: string): ExamAnswer { return (this.answers[id] ??= {}); }

  asChoice(q: ExamQuestion): ChoiceQuestion { return q as ChoiceQuestion; }
  asFirewall(q: ExamQuestion): FirewallQuestion { return q as FirewallQuestion; }
  asMatch(q: ExamQuestion): MatchQuestion { return q as MatchQuestion; }
  asOrder(q: ExamQuestion): OrderQuestion { return q as OrderQuestion; }

  needed(q: ChoiceQuestion): number { return correctIndexes(q).length; }

  chosen(id: string, option: number): boolean { return this.answers[id]?.choices?.includes(option) ?? false; }

  choose(q: ChoiceQuestion, option: number) {
    if (this.locked(q.id)) return;
    const a = this.answerFor(q.id);
    if (q.kind === 'single') a.choices = [option];
    else {
      const set = new Set(a.choices ?? []);
      set.has(option) ? set.delete(option) : set.add(option);
      a.choices = [...set];
    }
    this.save();
  }

  cell(id: string, row: number, col: string): string { return this.answers[id]?.cells?.[row]?.[col] ?? ''; }
  setCell(id: string, row: number, col: string, value: string) {
    if (this.locked(id)) return;
    const a = this.answerFor(id);
    a.cells ??= [];
    a.cells[row] = { ...(a.cells[row] ?? {}), [col]: value };
    this.save();
  }

  pick(id: string, i: number): string { return this.answers[id]?.picks?.[i] ?? ''; }
  setPick(id: string, i: number, value: string) {
    if (this.locked(id)) return;
    const a = this.answerFor(id);
    a.picks ??= [];
    a.picks[i] = value;
    this.save();
  }

  orderOf(q: OrderQuestion): number[] {
    return this.answers[q.id]?.order ?? this.item.itemOrder ?? q.items.map((_, i) => i);
  }
  private setOrder(q: OrderQuestion, order: number[]) {
    if (this.locked(q.id)) return;
    this.answerFor(q.id).order = order;
    this.save();
  }
  dropOrder(q: OrderQuestion, e: CdkDragDrop<number[]>) {
    const order = [...this.orderOf(q)];
    moveItemInArray(order, e.previousIndex, e.currentIndex);
    this.setOrder(q, order);
  }
  move(q: OrderQuestion, pos: number, delta: number) {
    const order = [...this.orderOf(q)], to = pos + delta;
    if (to < 0 || to >= order.length) return;
    [order[pos], order[to]] = [order[to], order[pos]];
    this.setOrder(q, order);
  }
  /** An untouched ordering PBQ counts as answered once the learner confirms the starting order is their answer. */
  keepOrder(q: OrderQuestion) { this.setOrder(q, [...this.orderOf(q)]); }

  hasOrder(id: string): boolean { return !!this.answers[id]?.order; }

  answered(q: ExamQuestion): boolean { return isAnswered(q, this.answers[q.id]); }

  // ── Study mode checking and grading ─────────────────────────────────────

  check(q: ExamQuestion) {
    if (q.kind === 'order' && !this.answers[q.id]?.order) this.keepOrder(q);
    this.checked.add(q.id);
    this.save();
  }

  graded(q: ExamQuestion, item?: ExamItem): GradedQuestion {
    return gradeQuestion(q, this.answers[q.id], item);
  }

  submit() {
    clearInterval(this.timer);
    this.grade = gradeExam(this.pool, this.items, this.answers);
    this.state = 'result';
    this.reviewFilter = this.grade.correctCount === this.items.length ? 'all' : 'wrong';
    this.discardSaved();
  }

  backToIntro() {
    this.state = 'intro';
    this.grade = null;
    this.items = [];
  }

  domainPercent(d: ExamDomain): number | null {
    const s = this.grade?.byDomain[d];
    return s && s.max ? Math.round((s.earned / s.max) * 100) : null;
  }

  get reviewList(): { item: ExamItem; q: ExamQuestion; g: GradedQuestion; n: number }[] {
    if (!this.grade) return [];
    return this.items
      .map((item, i) => ({ item, q: this.question(item), g: this.grade!.results[i], n: i + 1 }))
      .filter(r => this.reviewFilter === 'all' || (this.reviewFilter === 'wrong' ? !r.g.correct : this.flagged.has(r.q.id)));
  }

  get wrongCount(): number { return this.grade ? this.grade.results.filter(r => !r.correct).length : 0; }

  kindLabel(q: ExamQuestion): string {
    switch (q.kind) {
      case 'firewall': return 'PBQ · Firewall rules';
      case 'match': return 'PBQ · Configure / match';
      case 'order': return 'PBQ · Sequence';
      case 'multi': return `Select ${this.needed(q)}`;
      default: return 'Multiple choice';
    }
  }
}
