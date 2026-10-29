import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ContentService } from '../../../services/content.service';
import { FirewallQuestion, MatchQuestion, OrderQuestion, isPbq } from '../../../models/exam.model';
import { ExamAnswer, GradedQuestion, gradeQuestion, isAnswered, seededRandom, shuffled } from '../../../utils/exam-engine';
import { PbqQuestion } from '../networking.model';
import { MdPipe } from './md.pipe';
import { LessonWork } from '../lesson-work.service';

/** A question's saved answer, and whether it was checked. */
interface SavedPbq { answer: ExamAnswer; checked: boolean }
/** Which exam questions were drawn for practice, in their order, and which one is open. */
interface SavedBank { ids: string[]; index: number }

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
  private work = inject(LessonWork, { optional: true });

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
    if (this.fromLesson) {
      // Practice already under way carries on where it was, which means loading the question bank straight away.
      const bank = this.work?.get<SavedBank>(this.bankKey);
      if (bank?.ids?.length && !this.list.length && !this.loading) this.start(bank);
      return;
    }
    this.list = this.questions;
    this.go(0);
  }

  private get bankKey(): string { return `bank:${this.fromLesson}`; }

  get q(): PbqQuestion | undefined { return this.list[this.index]; }
  get exam(): boolean { return !!this.fromLesson; }

  /** Exam-style practice loads the 1 MB question bank only when the learner asks for it. */
  start(saved?: SavedBank) {
    this.loading = true;
    this.content.getPracticeExam().subscribe({
      next: pool => {
        const mine = pool.filter((q): q is PbqQuestion => isPbq(q) && q.lesson === this.fromLesson);
        const byId = new Map(mine.map(q => [q.id, q]));
        const kept = (saved?.ids ?? []).map(id => byId.get(id)).filter((q): q is PbqQuestion => !!q);
        if (kept.length) {
          this.list = kept;
        } else {
          const rand = seededRandom(Date.now() % 2 ** 31);
          // Random order, but firewall rule tables first: they are the PBQ type learners most need to practice.
          this.list = shuffled(mine, rand).sort((a, b) => Number(b.kind === 'firewall') - Number(a.kind === 'firewall'));
        }
        this.loading = false;
        this.go(kept.length ? Math.min(saved!.index, kept.length - 1) : 0);
      },
      error: () => { this.loading = false; this.loadFailed = true; },
    });
  }

  /** Opens a question, with any answer saved for it earlier. */
  go(i: number) {
    this.index = i;
    this.blank();
    const q = this.q;
    const saved = q ? this.work?.get<SavedPbq>(`pbq:${q.id}`) : undefined;
    if (saved?.answer) {
      this.answer = structuredClone(saved.answer);
      this.checked = !!saved.checked;
    }
    if (this.exam) this.work?.set(this.bankKey, { ids: this.list.map(x => x.id), index: i } satisfies SavedBank);
  }

  /** Clears the answers, including the saved ones. */
  reset() {
    this.blank();
    if (this.q) this.work?.clear(`pbq:${this.q.id}`);
  }

  /** Empty answers. The worked-example rows of a guided firewall table stay filled in. */
  private blank() {
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
    this.save();
  }

  pick(i: number): string { return this.answer.picks?.[i] ?? ''; }
  setPick(i: number, value: string) { (this.answer.picks ??= [])[i] = value; this.save(); }

  orderOf(): number[] { return this.answer.order ?? this.startOrder; }
  drop(e: CdkDragDrop<number[]>) {
    const order = [...this.orderOf()];
    moveItemInArray(order, e.previousIndex, e.currentIndex);
    this.answer.order = order;
    this.save();
  }
  move(pos: number, delta: number) {
    const order = [...this.orderOf()], to = pos + delta;
    if (to < 0 || to >= order.length) return;
    [order[pos], order[to]] = [order[to], order[pos]];
    this.answer.order = order;
    this.save();
  }

  /** An ordering task can always be checked; the others need every box filled. */
  get ready(): boolean {
    const q = this.q;
    return !!q && (q.kind === 'order' || isAnswered(q, this.answer));
  }

  check() {
    if (this.q?.kind === 'order') this.answer.order ??= [...this.startOrder];
    this.checked = true;
    this.save();
    const g = this.graded;
    if (g && this.q) this.checkedResult.emit({ id: this.q.id, fraction: g.earned / g.max });
  }

  private save() {
    if (this.q) this.work?.set(`pbq:${this.q.id}`, { answer: this.answer, checked: this.checked } satisfies SavedPbq);
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
