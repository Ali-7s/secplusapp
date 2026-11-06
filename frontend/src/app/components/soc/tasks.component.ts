import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { hms } from './engine/events';
import { CheckResult, TaskState } from './engine/grade';
import { Task } from './engine/model';

/** The shift's analyst tasks. Terminal and SIEM tasks tick themselves off when your output matches; scripts are checked on request. */
@Component({
  selector: 'app-soc-tasks',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section aria-label="Tasks">
      <p class="intro">Do these in the terminal or the SIEM; each one ticks itself off when your output is right. Scripts are checked with the button. Showing a solution halves the points.</p>
      <ol class="list">
        @for (t of tasks; track t.id; let i = $index) {
          @let s = state[t.id];
          @let locked = t.after > now;
          <li class="task" [class.done]="s?.done" [class.locked]="locked">
            <div class="t-head">
              <mat-icon aria-hidden="true" class="state">{{ s?.done ? 'task_alt' : locked ? 'schedule' : 'radio_button_unchecked' }}</mat-icon>
              <div class="t-main">
                <div class="where"><mat-icon aria-hidden="true">{{ t.where === 'siem' ? 'manage_search' : 'terminal' }}</mat-icon> {{ t.where === 'siem' ? 'SIEM' : t.script ? 'Script' : 'Terminal' }}
                  @if (s?.done) { <span class="pts">{{ s?.revealed ? '1' : '2' }} pts</span> }</div>
                <p class="ask">{{ t.ask }}</p>
                @if (locked) {
                  <p class="sub">Available from {{ hms(t.after).slice(0, 5) }}, when the events it needs have happened.</p>
                } @else {
                  <div class="acts">
                    @if (!s?.done) {
                      <button type="button" class="link" (click)="toggle(t.id)" [attr.aria-expanded]="hints.has(t.id)">{{ hints.has(t.id) ? 'Hide hint' : 'Hint' }}</button>
                      @if (!s?.revealed) { <button type="button" class="link" (click)="reveal.emit(t.id)">Show a solution</button> }
                    }
                    @if (t.script && !s?.done) {
                      <button type="button" class="btn" (click)="checkScript.emit(t.id)"><mat-icon aria-hidden="true">play_arrow</mat-icon> Check my script</button>
                    }
                  </div>
                  @if (hints.has(t.id) && !s?.done) { <p class="hint">{{ t.hint }}</p> }
                  @if (results[t.id]; as r) {
                    @if (!r.ok && !s?.done) { <pre class="fail mono">{{ r.detail }}</pre> }
                  }
                  @if (s?.done || s?.revealed) {
                    <div class="learn" [class.good]="s?.done">
                      <span class="lbl">{{ s?.done ? 'Done.' : 'One way:' }}</span>
                      @if (!s?.done) { <code class="mono">{{ t.ref }}</code> }
                      <span>{{ t.learn }}</span>
                    </div>
                  }
                }
              </div>
            </div>
          </li>
        }
      </ol>
    </section>
  `,
  styleUrl: './tasks.component.scss',
})
export class SocTasksComponent {
  @Input({ required: true }) tasks: Task[] = [];
  @Input({ required: true }) state: Record<string, TaskState> = {};
  @Input() results: Record<string, CheckResult> = {};
  @Input() now = 0;
  @Output() reveal = new EventEmitter<string>();
  @Output() checkScript = new EventEmitter<string>();

  readonly hms = hms;
  hints = new Set<string>();

  toggle(id: string) {
    if (this.hints.has(id)) this.hints.delete(id);
    else this.hints.add(id);
  }
}
