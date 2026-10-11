import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type FcMode = 'flip' | 'cloze' | 'dump';

const MODES: ReadonlyArray<{ id: FcMode; label: string; icon: string; hint: string }> = [
  { id: 'flip', label: 'Flip', icon: 'flip', hint: 'See the name, then flip the card for the answer' },
  { id: 'cloze', label: 'Cloze', icon: 'edit_note', hint: 'Read a description and type the name it belongs to' },
  { id: 'dump', label: 'Brain dump', icon: 'psychology', hint: 'Explain it from memory, then check yourself' },
];

/** The three ways to study the flashcards, shared by the Acronym Glossary and Key Terms. */
@Component({
  selector: 'app-fc-mode-switch',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modes" role="group" aria-label="Flashcard mode">
      @for (m of modes; track m.id) {
        <button type="button" [class.active]="mode() === m.id" [attr.aria-pressed]="mode() === m.id"
          [title]="m.hint" (click)="modeChange.emit(m.id)">
          <mat-icon aria-hidden="true">{{ m.icon }}</mat-icon><span>{{ m.label }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; max-width: 780px; }
    .modes {
      display: flex; gap: 4px; padding: 4px; border-radius: 14px;
      border: 1px solid var(--c-border); background: var(--c-surface-3);
    }
    button {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      min-width: 0; height: 40px; padding: 0 8px; border: 0; border-radius: 10px; cursor: pointer;
      background: transparent; color: var(--c-text-2); font: inherit; font-size: 14px; font-weight: 600;
      white-space: nowrap; transition: background .15s, color .15s;
    }
    button mat-icon { flex-shrink: 0; font-size: 19px; width: 19px; height: 19px; }
    button:hover { color: var(--c-text); }
    button.active { background: var(--c-surface); color: var(--c-primary); box-shadow: var(--shadow-sm); }
    button:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
    @media (max-width: 420px) {
      button { gap: 4px; padding: 0 4px; font-size: 13px; }
      button mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }
    @media (prefers-reduced-motion: reduce) { button { transition: none; } }
  `],
})
export class FcModeSwitchComponent {
  readonly mode = input.required<FcMode>();
  readonly modeChange = output<FcMode>();
  readonly modes = MODES;
}
