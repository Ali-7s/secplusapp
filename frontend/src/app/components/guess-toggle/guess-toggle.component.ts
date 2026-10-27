import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * "I'm guessing": ticked before answering a multiple choice question. A right answer marked as a guess still
 * scores, but the app remembers it as not known yet, so a lucky guess never counts as learned.
 */
@Component({
  selector: 'app-guess-toggle',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="guess" [class.on]="on()" [attr.aria-pressed]="on()" [disabled]="disabled()"
      title="Tick this before answering if you are not sure. A right guess then counts as not known yet and comes back for review."
      (click)="toggled.emit(); $event.stopPropagation()">
      <mat-icon aria-hidden="true">{{ on() ? 'help' : 'help_outline' }}</mat-icon>
      <span>I'm guessing</span>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .guess {
      display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 12px 0 9px; border-radius: 16px;
      border: 1px solid var(--c-border-dark); background: var(--c-surface); color: var(--c-text-2);
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
      transition: background .15s, border-color .15s, color .15s;
    }
    .guess mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .guess:hover:not(:disabled) { border-color: var(--c-warning); color: var(--c-text); }
    .guess.on { background: var(--c-warning-light); border-color: var(--c-warning); color: var(--c-text); }
    .guess.on mat-icon { color: var(--c-warning); }
    .guess:disabled { cursor: default; opacity: .6; }
    .guess:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { .guess { transition: none; } }
  `],
})
export class GuessToggleComponent {
  readonly on = input(false);
  readonly disabled = input(false);
  readonly toggled = output<void>();
}
