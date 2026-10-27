import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ContentService } from '../../../services/content.service';
import { FirewallQuestion, MatchQuestion, OrderQuestion, isPbq } from '../../../models/exam.model';
import { ExamAnswer, GradedQuestion, gradeQuestion, isAnswered, seededRandom, shuffled } from '../../../utils/exam-engine';
import { PbqQuestion } from '../networking.model';
import { MdPipe } from './md.pipe';

/**
 * Hands-on PBQ practice inside a lesson: a firewall table, a matching form or an ordering task, with a
 * check button that explains every rule, prompt or step. It runs either the lesson's own guided questions
 * or, on request, the practice exam's PBQs tagged with this lesson (loaded only when the learner asks).
 */
@Component({
  selector: 'app-pbq-practice',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, DragDropModule, MdPipe],
  templateUrl: './pbq-practice.component.html',
  styleUrl: './pbq-practice.component.scss',
})
export class PbqPracticeComponent implements OnChanges {
  private content = inject(ContentService);

  @Input({ required: true }) title = '';
  @Input() intro = '';
  /** The lesson's own guided questions. */
  @Input() questions: PbqQuestion[] = [];
  /** Instead, load the practice exam's PBQs tagged with this lesson slug. */
  @Input() fromLesson = '';
  /** Firewall tables: pre-fill and lock this many rows as a worked example. */
  @Input() given = 0;
  /** Fires each time an answer is checked, with the share of parts right (0 to 1). */
  @Output() checkedResult = new EventEmitter<{ id: string; fraction: number }>();

  list: PbqQuestion[] = [];
  index = 0;
  loading = false;
  loadFailed = false;
  answer: ExamAnswer = {};
  checked = false;
  /** Starting order of an ordering task: scrambled, never already solved. */
  private startOrder: number[] = [];

  ngOnChanges() {
    if (this.fromLesson) return;
    this.list = this.questions;
    this.go(0);
  }

  get q(): PbqQuestion | undefined { return this.list[this.index]; }
  get exam(): boolean { return !!this.fromLesson; }

  /** Exam-style practice loads the 1 MB question bank only when the learner asks for it. */
  start() {
    this.loading = true;
    this.content.getPracticeExam().subscribe({
      next: pool => {
        const rand = seededRandom(Date.now() % 2 ** 31);
        // Random order, but firewall rule tables first: they are the PBQ type learners most need to practice.
        this.list = shuffled(pool.filter((q): q is PbqQuestion => isPbq(q) && q.lesson === this.fromLesson), rand)
          .sort((a, b) => Number(b.kind === 'firewall') - Number(a.kind === 'firewall'));
        this.loading = false;
        this.go(0);
      },
      error: () => { this.loading = false; this.loadFailed = true; },
    });
  }

  go(i: number) {
    this.index = i;
    this.checked = false;
    this.reset();
  }

  /** Clears the answers. The worked-example rows of a guided firewall table stay filled in. */
  reset() {
    const q = this.q;
    this.answer = {};
    this.checked = false;
    if (!q) return;
    if (q.kind === 'firewall' && this.givenRows) this.answer.cells = q.rows.slice(0, this.givenRows).map(r => ({ ...r.answer }));
    if (q.kind === 'order') {
      const rand = seededRandom([...q.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
      let order = shuffled(q.items.map((_, i) => i), rand);
      while (q.items.length > 1 && order.every((v, i) => v === i)) order = shuffled(order, rand);
      this.startOrder = order;
    }
  }

  get givenRows(): number { return this.exam ? 0 : this.given; }
  isGiven(row: number): boolean { return row < this.givenRows; }

  asFirewall(q: PbqQuestion): FirewallQuestion { return q as FirewallQuestion; }
  asMatch(q: PbqQuestion): MatchQuestion { return q as MatchQuestion; }
  asOrder(q: PbqQuestion): OrderQuestion { return q as OrderQuestion; }

  cell(row: number, col: string): string { return this.answer.cells?.[row]?.[col] ?? ''; }
  setCell(row: number, col: string, value: string) {
    const cells = (this.answer.cells ??= []);
    cells[row] = { ...(cells[row] ?? {}), [col]: value };
  }

  pick(i: number): string { return this.answer.picks?.[i] ?? ''; }
  setPick(i: number, value: string) { (this.answer.picks ??= [])[i] = value; }

  orderOf(): number[] { return this.answer.order ?? this.startOrder; }
  drop(e: CdkDragDrop<number[]>) {
    const order = [...this.orderOf()];
    moveItemInArray(order, e.previousIndex, e.currentIndex);
    this.answer.order = order;
  }
  move(pos: number, delta: number) {
    const order = [...this.orderOf()], to = pos + delta;
    if (to < 0 || to >= order.length) return;
    [order[pos], order[to]] = [order[to], order[pos]];
    this.answer.order = order;
  }

  /** An ordering task can always be checked; the others need every box filled. */
  get ready(): boolean {
    const q = this.q;
    return !!q && (q.kind === 'order' || isAnswered(q, this.answer));
  }

  check() {
    if (this.q?.kind === 'order') this.answer.order ??= [...this.startOrder];
    this.checked = true;
    const g = this.graded;
    if (g && this.q) this.checkedResult.emit({ id: this.q.id, fraction: g.earned / g.max });
  }

  get graded(): GradedQuestion | null {
    const q = this.q;
    return q && this.checked ? gradeQuestion(q, this.answer, { id: q.id, itemOrder: this.startOrder }) : null;
  }

  get score(): string {
    const g = this.graded;
    if (!g) return '';
    const right = g.parts.filter(p => p.ok).length;
    return `${right} of ${g.parts.length} right`;
  }

  kindLabel(q: PbqQuestion): string {
    return q.kind === 'firewall' ? 'Firewall rules' : q.kind === 'order' ? 'Put in order' : 'Match or configure';
  }
}
