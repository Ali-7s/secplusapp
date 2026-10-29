import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { LessonWork } from '../lesson-work.service';
import { MatIconModule } from '@angular/material/icon';
import { QuizQuestion } from '../networking.model';
import { MdPipe } from './md.pipe';

/** The short self-check at the end of a lesson: pick an answer, see the explanation straight away. */
const CHECK_KEY = 'check';

@Component({
  selector: 'app-lesson-quiz',
  standalone: true,
  imports: [MatIconModule, MdPipe],
  template: `
    <section class="quiz" aria-labelledby="quiz-title">
      <h2 id="quiz-title"><mat-icon aria-hidden="true">quiz</mat-icon> Check yourself</h2>

      @for (q of questions; track $index; let qi = $index) {
        <div class="q">
          <p class="q-text">
            <span class="q-num">{{ qi + 1 }}</span>
            <span [innerHTML]="q.question | md"></span>
          </p>
          <div class="opts" role="group" [attr.aria-label]="'Answers for question ' + (qi + 1)">
            @for (o of q.options; track $index; let oi = $index) {
              <button type="button" class="opt"
                [class.locked]="picked[qi] !== null"
                [class.correct]="picked[qi] !== null && oi === q.answer"
                [class.wrong]="picked[qi] === oi && oi !== q.answer"
                [attr.aria-disabled]="picked[qi] !== null"
                (click)="pick(qi, oi)">
                <span class="letter">{{ letters[oi] }}</span>
                <span class="txt" [innerHTML]="o | md"></span>
                @if (picked[qi] !== null && oi === q.answer) {
                  <mat-icon class="mark ok" aria-label="Correct answer">check_circle</mat-icon>
                }
                @if (picked[qi] === oi && oi !== q.answer) {
                  <mat-icon class="mark bad" aria-label="Your answer, not correct">cancel</mat-icon>
                }
              </button>
            }
          </div>
          @if (picked[qi] !== null) {
            <div class="explain" role="status" [class.ok]="picked[qi] === q.answer">
              <strong>{{ picked[qi] === q.answer ? 'Correct.' : 'Not quite.' }}</strong>&ngsp;<span [innerHTML]="q.explanation | md"></span>
            </div>
          }
        </div>
      }

      @if (done) {
        <div class="summary" role="status">
          <mat-icon aria-hidden="true">{{ score === questions.length ? 'emoji_events' : 'replay' }}</mat-icon>
          <div>
            <strong>You got {{ score }} of {{ questions.length }}.</strong>
            {{ score === questions.length
              ? 'Nicely done. Move on to the next lesson.'
              : 'Read the explanations above, then try again, or look back through the lesson.' }}
          </div>
          <button type="button" class="again" (click)="reset()">Try again</button>
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .quiz {
      margin-top: 36px; padding: 20px 22px; border: 1px solid var(--c-border);
      border-radius: var(--r-lg); background: var(--c-surface);
    }
    h2 {
      display: flex; align-items: center; gap: 8px; margin: 0 0 16px;
      font-size: 18px; font-weight: 700; color: var(--c-primary);
    }
    .q + .q { margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--c-border); }
    .q-text { display: flex; gap: 10px; margin: 0 0 12px; font-size: 15px; line-height: 1.55; color: var(--c-text); font-weight: 600; }
    .q-num {
      flex: none; width: 24px; height: 24px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--c-accent-light); color: var(--c-primary); font-size: 12px; font-weight: 800;
    }
    .opts { display: grid; gap: 8px; }
    .opt {
      display: flex; align-items: flex-start; gap: 10px; width: 100%; text-align: left;
      font: inherit; font-size: 14px; line-height: 1.5; color: var(--c-text);
      background: var(--c-surface); border: 2px solid var(--c-border); border-radius: var(--r-md);
      padding: 10px 12px; cursor: pointer; transition: border-color .15s, background .15s;
    }
    .opt:hover:not(.locked) { border-color: var(--c-accent); background: var(--c-accent-light); }
    .opt.locked { cursor: default; }
    .opt.correct { border-color: var(--c-success); background: var(--c-success-light); }
    .opt.wrong   { border-color: var(--c-error);   background: var(--c-error-light); }
    .letter {
      flex: none; width: 22px; height: 22px; border-radius: 6px; margin-top: 1px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--c-surface-3); color: var(--c-text-2); font-size: 12px; font-weight: 800;
    }
    .txt { flex: 1; min-width: 0; }
    .mark { flex: none; font-size: 20px; width: 20px; height: 20px; margin-top: 1px; }
    .mark.ok  { color: var(--c-success); }
    .mark.bad { color: var(--c-error); }
    .explain {
      margin-top: 10px; padding: 10px 12px; border-radius: var(--r-md); font-size: 14px; line-height: 1.55;
      color: var(--c-text); background: var(--c-error-light); border-left: 4px solid var(--c-error);
    }
    .explain.ok { background: var(--c-success-light); border-left-color: var(--c-success); }
    .summary {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 22px; padding: 14px 16px;
      border-radius: var(--r-md); background: var(--c-accent-light); color: var(--c-text); font-size: 14px;
      mat-icon { color: var(--c-accent); flex: none; }
      div { flex: 1; min-width: 180px; line-height: 1.5; }
    }
    .again {
      font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; padding: 8px 16px; border-radius: 8px;
      border: 2px solid var(--c-accent); background: transparent; color: var(--c-primary);
    }
    .again:hover { background: var(--c-accent-light); }
    @media (max-width: 600px) { .quiz { padding: 16px 14px; } }
  `],
})
export class LessonQuizComponent implements OnChanges {
  private work = inject(LessonWork, { optional: true });

  @Input({ required: true }) questions: QuizQuestion[] = [];
  /** Fires once every question has an answer, so the lesson can remember the result. */
  @Output() finished = new EventEmitter<{ score: number; total: number }>();

  readonly letters = ['A', 'B', 'C', 'D'];
  picked: (number | null)[] = [];

  /** Picks up answers already given, so a refresh or a trip back through the lesson keeps them. */
  ngOnChanges() {
    const saved = this.work?.get<(number | null)[]>(CHECK_KEY);
    this.picked = Array.isArray(saved) && saved.length === this.questions.length ? [...saved] : this.questions.map(() => null);
  }

  get done(): boolean {
    return this.questions.length > 0 && this.picked.every(p => p !== null);
  }

  get score(): number {
    return this.questions.filter((q, i) => this.picked[i] === q.answer).length;
  }

  pick(question: number, option: number) {
    if (this.picked[question] !== null) return;
    this.picked[question] = option;
    this.work?.set(CHECK_KEY, this.picked);
    if (this.done) this.finished.emit({ score: this.score, total: this.questions.length });
  }

  reset() {
    this.picked = this.questions.map(() => null);
    this.work?.clear(CHECK_KEY);
  }
}
