import { Component, Input, OnChanges, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { KeyName, KeyTask } from '../networking.model';
import { MdPipe } from './md.pipe';

const KEYS: { id: KeyName; owner: 'alice' | 'bob'; kind: 'public' | 'private'; label: string }[] = [
  { id: 'alice-public', owner: 'alice', kind: 'public', label: "Alice's public" },
  { id: 'alice-private', owner: 'alice', kind: 'private', label: "Alice's private" },
  { id: 'bob-public', owner: 'bob', kind: 'public', label: "Bob's public" },
  { id: 'bob-private', owner: 'bob', kind: 'private', label: "Bob's private" },
];

type Picks = (KeyName | null)[][];

/**
 * "Which key?": Alice and Bob each have a key pair, and every task asks which key does each half of the job.
 * Picks and whether they were checked are saved with the lesson.
 */
@Component({
  selector: 'app-key-picker',
  standalone: true,
  imports: [MatIconModule, MdPipe],
  template: `
    <section class="w" [attr.aria-label]="title">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">key</mat-icon> {{ title }}</div>
        <div class="count" aria-live="polite">{{ answered }} of {{ tasks.length }} answered</div>
      </header>
      @if (intro) { <p class="intro" [innerHTML]="intro | md"></p> }

      <div class="people">
        @for (p of people; track p.id) {
          <div [class]="'person ' + p.id">
            <div class="p-name"><mat-icon aria-hidden="true">person</mat-icon> {{ p.name }}</div>
            <div class="p-key"><span [class]="'chip public ' + p.id"><mat-icon class="k" aria-hidden="true">key</mat-icon> Public key</span> Anyone may have a copy.</div>
            <div class="p-key"><span [class]="'chip private ' + p.id"><mat-icon class="k" aria-hidden="true">key</mat-icon> Private key</span> Only {{ p.name }} has it.</div>
          </div>
        }
      </div>

      <ol class="tasks">
        @for (t of tasks; track $index; let ti = $index) {
          <li class="task" [class.right]="checked && isRight(ti)" [class.wrong]="checked && !isRight(ti)">
            <div class="goal"><span class="num" aria-hidden="true">{{ ti + 1 }}</span><span [innerHTML]="t.goal | md"></span></div>
            @for (verb of t.verbs; track $index; let vi = $index) {
              <div class="slot" role="radiogroup" [attr.aria-label]="verb">
                <span class="verb">{{ verb }}</span>
                <span class="choices">
                  @for (k of keys; track k.id) {
                    <button type="button" role="radio" [class]="'chip ' + k.kind + ' ' + k.owner"
                      [class.on]="picks[ti][vi] === k.id"
                      [class.correct]="checked && t.answer[vi] === k.id"
                      [class.miss]="checked && picks[ti][vi] === k.id && t.answer[vi] !== k.id"
                      [attr.aria-checked]="picks[ti][vi] === k.id" [attr.aria-disabled]="checked"
                      (click)="pick(ti, vi, k.id)">
                      @if (checked && t.answer[vi] === k.id) { <mat-icon aria-hidden="true">check</mat-icon> }
                      @else if (checked && picks[ti][vi] === k.id) { <mat-icon aria-hidden="true">close</mat-icon> }
                      @else { <mat-icon class="k" aria-hidden="true">key</mat-icon> }
                      {{ k.label }}
                    </button>
                  }
                </span>
              </div>
            }
            @if (checked) {
              <div class="why" [class.good]="isRight(ti)" [class.bad]="!isRight(ti)">
                <strong>{{ isRight(ti) ? 'Right.' : 'Not quite.' }}</strong>&ngsp;<span [innerHTML]="t.why | md"></span>
              </div>
            }
          </li>
        }
      </ol>

      @if (checked) {
        <div class="result" role="status">
          <mat-icon aria-hidden="true">{{ score === tasks.length ? 'emoji_events' : 'info' }}</mat-icon>
          <div><strong>{{ score }} of {{ tasks.length }} tasks right.</strong> The rule behind all of them: whoever must be the only one able to do something uses their own private key.</div>
        </div>
      }

      <div class="controls">
        @if (!checked) {
          <button type="button" class="btn primary" (click)="check()" [attr.aria-disabled]="answered === 0">Check my answers</button>
        } @else {
          <button type="button" class="btn" (click)="reset()">Try again</button>
        }
      </div>
    </section>
  `,
  styleUrl: './key-picker.component.scss',
})
export class KeyPickerComponent implements OnChanges {
  private work = inject(LessonWork, { optional: true });

  @Input({ required: true }) title = '';
  @Input() intro = '';
  @Input({ required: true }) tasks: KeyTask[] = [];

  readonly keys = KEYS;
  readonly people = [{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }];
  picks: Picks = [];
  checked = false;

  ngOnChanges() {
    const saved = this.work?.get<{ picks: Picks; checked: boolean }>(this.key);
    this.picks = this.tasks.map((_, i) => [saved?.picks?.[i]?.[0] ?? null, saved?.picks?.[i]?.[1] ?? null]);
    this.checked = !!saved?.checked;
  }

  private get key(): string { return `keys:${this.title}`; }
  private save() { this.work?.set(this.key, { picks: this.picks, checked: this.checked }); }

  /** Tasks with both halves picked. */
  get answered(): number { return this.picks.filter(p => p[0] && p[1]).length; }
  get score(): number { return this.tasks.filter((_, i) => this.isRight(i)).length; }
  isRight(i: number): boolean { return this.picks[i][0] === this.tasks[i].answer[0] && this.picks[i][1] === this.tasks[i].answer[1]; }

  pick(task: number, slot: number, key: KeyName) {
    if (this.checked) return;
    this.picks[task][slot] = this.picks[task][slot] === key ? null : key;
    this.save();
  }

  check() {
    if (!this.answered) return;
    this.checked = true;
    this.save();
  }

  reset() {
    this.picks = this.tasks.map(() => [null, null]);
    this.checked = false;
    this.work?.clear(this.key);
  }
}
