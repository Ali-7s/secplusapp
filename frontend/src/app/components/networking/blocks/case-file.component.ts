import { Component, Input, OnChanges, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { CaseFile } from '../networking.model';
import { MdPipe } from './md.pipe';

interface Saved { at: number; picks: (string | null)[]; checked: boolean[] }

/**
 * "What is it?": each case is a handful of clues from tickets, logs and tools. Pick the malware or attack, then see
 * why, which clue gave it away, and the look-alike it is most often confused with.
 */
@Component({
  selector: 'app-case-file',
  standalone: true,
  imports: [MatIconModule, MdPipe],
  template: `
    <section class="w" [attr.aria-label]="title">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">{{ icon }}</mat-icon> {{ title }}</div>
        <div class="count" aria-live="polite">{{ rightCount }} of {{ cases.length }} right</div>
      </header>
      @if (intro) { <p class="intro" [innerHTML]="intro | md"></p> }

      <ol class="list" aria-label="Cases">
        @for (c of cases; track $index; let i = $index) {
          <li><button type="button" [class.on]="i === at" [class.ok]="state(i) === 'ok'" [class.bad]="state(i) === 'bad'"
            [attr.aria-current]="i === at" [attr.aria-label]="'Case ' + (i + 1) + ': ' + c.name + stateLabel(i)" (click)="go(i)">{{ i + 1 }}</button></li>
        }
      </ol>

      @let c = cases[at];
      <div class="card">
        <div class="name"><span class="cn">{{ at + 1 }}</span> {{ c.name }}</div>
        <ul class="clues" aria-label="Clues">
          @for (cl of c.clues; track $index) {
            <li class="clue" [class.key]="checked[at] && cl.key">
              <div class="from">
                <span>{{ cl.from }}</span>
                @if (checked[at] && cl.key) { <span class="tag"><mat-icon aria-hidden="true">search</mat-icon> The giveaway</span> }
              </div>
              <div class="text" [class.mono]="cl.mono" [innerHTML]="cl.text | md"></div>
            </li>
          }
        </ul>

        <div class="ask" role="radiogroup" [attr.aria-label]="'What is case ' + (at + 1) + '?'">
          <div class="q">What is it?</div>
          <div class="opts">
            @for (o of options; track o) {
              <button type="button" role="radio" class="opt" [attr.aria-checked]="picks[at] === o" [attr.aria-disabled]="checked[at]"
                [class.on]="picks[at] === o && !checked[at]"
                [class.correct]="checked[at] && o === c.answer" [class.miss]="checked[at] && picks[at] === o && o !== c.answer"
                [class.near]="checked[at] && o === c.near?.option && o !== picks[at]"
                (click)="pick(o)">
                <mat-icon aria-hidden="true">{{ checked[at] && o === c.answer ? 'check_circle' : checked[at] && picks[at] === o ? 'cancel' : picks[at] === o ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
                <span>{{ o }}</span>
              </button>
            }
          </div>
        </div>

        @if (checked[at]) {
          <div class="why" role="status" [class.good]="picks[at] === c.answer" [class.bad]="picks[at] !== c.answer">
            <strong>{{ picks[at] === c.answer ? 'Right: ' : 'Not this time. It is ' }}{{ c.answer }}.</strong>&ngsp;<span [innerHTML]="c.why | md"></span>
          </div>
          @if (c.near) {
            <div class="near-why"><mat-icon aria-hidden="true">compare_arrows</mat-icon>
              <span><strong>Why not {{ c.near.option }}?</strong>&ngsp;<span [innerHTML]="c.near.why | md"></span></span>
            </div>
          }
        }

        <div class="controls">
          @if (!checked[at]) {
            <button type="button" class="btn primary" (click)="check()" [attr.aria-disabled]="!picks[at]"><mat-icon aria-hidden="true">check</mat-icon> Check</button>
          } @else if (at < cases.length - 1) {
            <button type="button" class="btn primary" (click)="go(at + 1)">Next case <mat-icon aria-hidden="true">chevron_right</mat-icon></button>
          }
          <span class="spacer"></span>
          @if (checked[at]) { <button type="button" class="btn ghost" (click)="retry()">Try this case again</button> }
          @if (anyChecked) { <button type="button" class="btn ghost" (click)="reset()">Start over</button> }
        </div>
      </div>

      @if (rightCount === cases.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>Every case solved.</strong> When two answers look alike, go back to the clue that only one of them explains.</span>
        </div>
      }
    </section>
  `,
  styleUrl: './case-file.component.scss',
})
export class CaseFileComponent implements OnChanges {
  private work = inject(LessonWork, { optional: true });

  @Input({ required: true }) title = '';
  @Input() intro = '';
  @Input() icon = 'search';
  @Input({ required: true }) options: string[] = [];
  @Input({ required: true }) cases: CaseFile[] = [];

  at = 0;
  picks: (string | null)[] = [];
  checked: boolean[] = [];

  ngOnChanges() {
    const saved = this.work?.get<Saved>(this.key);
    this.at = Math.min(Math.max(saved?.at ?? 0, 0), this.cases.length - 1);
    this.picks = this.cases.map((_, i) => {
      const p = saved?.picks?.[i] ?? null;
      return p && this.options.includes(p) ? p : null;
    });
    this.checked = this.cases.map((_, i) => !!saved?.checked?.[i] && !!this.picks[i]);
  }

  private get key(): string { return `cases:${this.title}`; }
  private save() { this.work?.set(this.key, { at: this.at, picks: this.picks, checked: this.checked }); }

  state(i: number): 'ok' | 'bad' | null {
    if (!this.checked[i]) return null;
    return this.picks[i] === this.cases[i].answer ? 'ok' : 'bad';
  }
  stateLabel(i: number): string {
    const s = this.state(i);
    return s === 'ok' ? ', right' : s === 'bad' ? ', not right yet' : '';
  }
  get rightCount(): number { return this.cases.filter((_, i) => this.state(i) === 'ok').length; }
  get anyChecked(): boolean { return this.checked.some(Boolean); }

  go(i: number) {
    if (i < 0 || i >= this.cases.length) return;
    this.at = i;
    this.save();
  }

  pick(o: string) {
    if (this.checked[this.at]) return;
    this.picks = this.picks.map((p, i) => i === this.at ? o : p);
    this.save();
  }

  check() {
    if (!this.picks[this.at]) return;
    this.checked = this.checked.map((c, i) => i === this.at ? true : c);
    this.save();
  }

  retry() {
    this.picks = this.picks.map((p, i) => i === this.at ? null : p);
    this.checked = this.checked.map((c, i) => i === this.at ? false : c);
    this.save();
  }

  reset() {
    this.at = 0;
    this.picks = this.cases.map(() => null);
    this.checked = this.cases.map(() => false);
    this.work?.clear(this.key);
  }
}
