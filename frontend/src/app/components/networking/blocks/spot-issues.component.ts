import { Component, Input, OnChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SpotLine } from '../networking.model';
import { MdPipe } from './md.pipe';

/**
 * A "spot the weaknesses" exercise in the style of a performance-based question: tap the lines of a device
 * configuration you think are insecure, then check.
 */
@Component({
  selector: 'app-spot-issues',
  standalone: true,
  imports: [MatIconModule, MdPipe],
  template: `
    <section class="spot" [attr.aria-label]="title">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">bug_report</mat-icon> {{ title }}</div>
        <div class="count" aria-live="polite">{{ selected.size }} selected</div>
      </header>
      <p class="intro" [innerHTML]="intro | md"></p>

      <ul class="lines">
        @for (line of lines; track $index; let i = $index) {
          <li>
            <button type="button" class="line"
              [class.picked]="selected.has(i) && !checked"
              [class.found]="checked && line.issue && selected.has(i)"
              [class.missed]="checked && line.issue && !selected.has(i)"
              [class.false-alarm]="checked && !line.issue && selected.has(i)"
              [attr.aria-pressed]="selected.has(i)" [attr.aria-disabled]="checked" (click)="toggle(i)">
              <span class="no" aria-hidden="true">{{ i + 1 }}</span>
              <code>{{ line.text }}</code>
              @if (checked) {
                @if (line.issue && selected.has(i)) { <mat-icon class="st ok" aria-label="Found it">check_circle</mat-icon> }
                @if (line.issue && !selected.has(i)) { <mat-icon class="st miss" aria-label="Missed">error</mat-icon> }
                @if (!line.issue && selected.has(i)) { <mat-icon class="st bad" aria-label="This line is fine">cancel</mat-icon> }
              }
            </button>
            @if (checked) {
              @if (line.issue) {
                <div class="why bad"><strong>Weak:</strong>&ngsp;<span [innerHTML]="line.issue.why | md"></span>
                  <div class="fix"><strong>Fix:</strong>&ngsp;<span [innerHTML]="line.issue.fix | md"></span></div></div>
              } @else if (line.fine) {
                <div class="why good"><strong>{{ selected.has(i) ? 'This one is fine:' : 'Fine:' }}</strong>&ngsp;<span [innerHTML]="line.fine | md"></span></div>
              }
            }
          </li>
        }
      </ul>

      @if (checked) {
        <div class="result" role="status">
          <mat-icon aria-hidden="true">{{ foundCount === issueCount && falseAlarms === 0 ? 'emoji_events' : 'info' }}</mat-icon>
          <div>
            <strong>You found {{ foundCount }} of {{ issueCount }} weaknesses</strong>@if (falseAlarms > 0) {, with {{ falseAlarms }} false {{ falseAlarms === 1 ? 'alarm' : 'alarms' }}}.
            Every weak line is explained above, and so is each good-practice line.
          </div>
        </div>
      }

      <div class="controls">
        @if (!checked) {
          <button type="button" class="btn primary" (click)="check()" [attr.aria-disabled]="selected.size === 0">Check my answers</button>
        } @else {
          <button type="button" class="btn" (click)="reset()">Try again</button>
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; margin: 18px 0; }
    .spot { border: 1px solid var(--c-warning); border-radius: var(--r-lg); background: var(--c-surface); padding: 16px 18px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
    .title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: var(--c-text); }
    .title mat-icon { color: var(--c-warning); }
    .count { font-size: 12px; font-weight: 700; color: var(--c-text); background: var(--c-warning-light); padding: 3px 10px; border-radius: 12px; }
    .intro { margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: var(--c-text-2); }
    .lines { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .line {
      width: 100%; display: flex; align-items: center; gap: 10px; text-align: left; cursor: pointer; font: inherit;
      padding: 6px 10px; border-radius: 8px; border: 2px solid var(--c-border); background: var(--c-surface-2); color: var(--c-text);
    }
    .line:hover { border-color: var(--c-warning); background: var(--c-warning-light); }
    .line.picked { border-color: var(--c-warning); background: var(--c-warning-light); }
    .line.found { border-color: var(--c-success); background: var(--c-success-light); }
    .line.missed { border-color: var(--c-error); background: var(--c-error-light); }
    .line.false-alarm { border-color: var(--c-error); background: var(--c-surface-3); }
    .line[aria-disabled='true'] { cursor: default; }
    .no { flex: none; width: 22px; text-align: right; font-size: 11px; font-weight: 600; color: var(--c-text); font-family: 'Courier New', monospace; }
    code { flex: 1; min-width: 0; font-family: 'Courier New', monospace; font-size: 13px; white-space: pre-wrap; word-break: break-word; color: var(--c-text); }
    .st { flex: none; font-size: 20px; width: 20px; height: 20px; }
    .st.ok { color: var(--c-success); }
    .st.miss, .st.bad { color: var(--c-error); }
    .why { margin: 4px 0 8px 32px; padding: 8px 12px; border-radius: 8px; font-size: 13.5px; line-height: 1.55; color: var(--c-text); }
    .why.bad { background: var(--c-error-light); border-left: 4px solid var(--c-error); }
    .why.good { background: var(--c-success-light); border-left: 4px solid var(--c-success); }
    .fix { margin-top: 4px; }
    .why code { font-size: 12.5px; padding: 0 5px; border-radius: 5px; background: var(--c-surface-3); border: 1px solid var(--c-border); flex: none; }
    .result {
      display: flex; gap: 12px; align-items: center; margin-top: 14px; padding: 12px 14px; border-radius: var(--r-md);
      background: var(--c-accent-light); font-size: 14px; line-height: 1.5; color: var(--c-text);
      mat-icon { color: var(--c-accent); flex: none; }
    }
    .controls { margin-top: 14px; display: flex; gap: 8px; }
    .btn {
      font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; padding: 9px 16px; border-radius: 8px;
      border: 2px solid var(--c-border-dark); background: var(--c-surface); color: var(--c-text);
    }
    .btn:hover { border-color: var(--c-accent); background: var(--c-accent-light); }
    .btn.primary { border-color: var(--c-accent-solid); background: var(--c-accent-solid); color: var(--c-on-accent); }
    .btn.primary:hover { filter: brightness(1.12); }
    .btn[aria-disabled='true'] { opacity: .45; cursor: default; pointer-events: none; }
    @media (max-width: 600px) { .spot { padding: 12px 12px; } .why { margin-left: 0; } }
  `],
})
export class SpotIssuesComponent implements OnChanges {
  @Input({ required: true }) title = '';
  @Input({ required: true }) intro = '';
  @Input({ required: true }) lines: SpotLine[] = [];

  selected = new Set<number>();
  checked = false;

  ngOnChanges() {
    this.reset();
  }

  get issueCount(): number {
    return this.lines.filter(l => l.issue).length;
  }

  get foundCount(): number {
    return this.lines.filter((l, i) => l.issue && this.selected.has(i)).length;
  }

  get falseAlarms(): number {
    return this.lines.filter((l, i) => !l.issue && this.selected.has(i)).length;
  }

  toggle(i: number) {
    if (this.checked) return;
    if (this.selected.has(i)) this.selected.delete(i);
    else this.selected.add(i);
  }

  check() {
    if (this.selected.size > 0) this.checked = true;
  }

  reset() {
    this.selected = new Set<number>();
    this.checked = false;
  }
}
