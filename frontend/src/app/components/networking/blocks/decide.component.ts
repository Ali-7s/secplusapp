import { Component, Input, OnChanges, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { DecideStep } from '../networking.model';
import { MdPipe } from './md.pipe';

interface Saved { picks: number[][]; shown: number }

/**
 * A scenario told one decision at a time. Pick what you would do; a weaker choice explains itself and you try
 * again, the best one explains itself and lets you continue. Earlier decisions fold into a short trail.
 */
@Component({
  selector: 'app-decide',
  standalone: true,
  imports: [MatIconModule, MdPipe],
  template: `
    <section class="w" [attr.aria-label]="title">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">alt_route</mat-icon> {{ title }}</div>
        <div class="count" aria-live="polite">Decision {{ Math.min(shown, steps.length) }} of {{ steps.length }}</div>
      </header>
      @if (intro) { <p class="intro" [innerHTML]="intro | md"></p> }

      <ol class="steps">
        @for (s of steps; track $index; let si = $index) {
          @if (si < shown) {
            @if (si < shown - 1) {
              <li class="past">
                <details>
                  <summary>
                    <mat-icon aria-hidden="true" [class.first]="firstTry(si)">{{ firstTry(si) ? 'check_circle' : 'task_alt' }}</mat-icon>
                    @if (s.phase) { <span class="phase">{{ s.phase }}</span> }
                    <span class="chosen">{{ bestOf(si).text }}</span>
                  </summary>
                  <div class="situation" [innerHTML]="s.situation | md"></div>
                  <div class="why good"><strong>Best:</strong>&ngsp;<span [innerHTML]="bestOf(si).feedback | md"></span></div>
                </details>
              </li>
            } @else {
              <li class="current">
                <div class="situation" [innerHTML]="s.situation | md"></div>
                <div class="question">{{ s.question }}</div>
                <div class="opts">
                  @for (o of s.options; track $index; let oi = $index) {
                    @let tried = picks[si].includes(oi);
                    <button type="button" class="opt" [class.good]="tried && o.best" [class.bad]="tried && !o.best"
                      [attr.aria-disabled]="tried || done(si)" (click)="pick(si, oi)">
                      <mat-icon aria-hidden="true">{{ tried ? (o.best ? 'check_circle' : 'cancel') : 'radio_button_unchecked' }}</mat-icon>
                      <span>{{ o.text }}</span>
                    </button>
                    @if (tried) {
                      <div class="why" [class.good]="o.best" [class.bad]="!o.best">
                        <strong>{{ o.best ? 'Best choice.' : 'Not the best move.' }}</strong>&ngsp;<span [innerHTML]="o.feedback | md"></span>
                        @if (!o.best && !done(si)) { <em class="again">Try another option.</em> }
                      </div>
                    }
                  }
                </div>
                @if (done(si) && s.phase) {
                  <p class="phase-note"><mat-icon aria-hidden="true">flag</mat-icon> <span>That step was <strong>{{ s.phase }}</strong>.</span></p>
                }
                @if (done(si) && si < steps.length - 1) {
                  <div class="controls"><button type="button" class="btn primary" (click)="advance()">Next decision <mat-icon aria-hidden="true">chevron_right</mat-icon></button></div>
                }
              </li>
            }
          }
        }
      </ol>

      @if (finished) {
        <div class="result" role="status">
          <mat-icon aria-hidden="true">{{ firstTries === steps.length ? 'emoji_events' : 'info' }}</mat-icon>
          <div><strong>Scenario complete.</strong> You chose the best action first time in {{ firstTries }} of {{ steps.length }} decisions.
            Open any step above to read it again.</div>
        </div>
      }

      @if (started) {
        <div class="controls"><span class="spacer"></span><button type="button" class="btn ghost" (click)="reset()">Start the scenario over</button></div>
      }
    </section>
  `,
  styleUrl: './decide.component.scss',
})
export class DecideComponent implements OnChanges {
  private work = inject(LessonWork, { optional: true });
  readonly Math = Math;

  @Input({ required: true }) title = '';
  @Input() intro = '';
  @Input({ required: true }) steps: DecideStep[] = [];

  /** Option indexes tried at each step, in the order they were tried. */
  picks: number[][] = [];
  /** How many steps are on screen. */
  shown = 1;

  ngOnChanges() {
    const saved = this.work?.get<Saved>(this.key);
    this.picks = this.steps.map((s, i) => (saved?.picks?.[i] ?? []).filter(o => o >= 0 && o < s.options.length));
    this.shown = Math.min(Math.max(saved?.shown ?? 1, 1), this.steps.length);
    // Never show a step whose previous one has not been answered well.
    while (this.shown > 1 && !this.done(this.shown - 2)) this.shown--;
  }

  private get key(): string { return `decide:${this.title}`; }
  private save() { this.work?.set(this.key, { picks: this.picks, shown: this.shown }); }

  done(i: number): boolean { return this.picks[i].some(o => this.steps[i].options[o]?.best); }
  firstTry(i: number): boolean { return this.steps[i].options[this.picks[i][0]]?.best === true; }
  bestOf(i: number) { return this.steps[i].options.find(o => o.best)!; }
  get finished(): boolean { return this.shown === this.steps.length && this.done(this.steps.length - 1); }
  get started(): boolean { return this.picks.some(p => p.length > 0); }
  get firstTries(): number { return this.steps.filter((_, i) => this.firstTry(i)).length; }

  pick(step: number, option: number) {
    if (this.done(step) || this.picks[step].includes(option)) return;
    this.picks[step] = [...this.picks[step], option];
    this.save();
  }

  advance() {
    if (this.shown < this.steps.length && this.done(this.shown - 1)) {
      this.shown++;
      this.save();
    }
  }

  reset() {
    this.picks = this.steps.map(() => []);
    this.shown = 1;
    this.work?.clear(this.key);
  }
}
