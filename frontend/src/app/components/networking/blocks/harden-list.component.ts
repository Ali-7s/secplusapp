import { Component, Input, OnChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { HardenItem } from '../networking.model';
import { MdPipe } from './md.pipe';

/** A hardening checklist. Tap an item to mark it as something you understand. */
@Component({
  selector: 'app-harden-list',
  standalone: true,
  imports: [MatIconModule, MdPipe],
  template: `
    <section class="harden" [attr.aria-label]="title">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">shield</mat-icon> {{ title }}</div>
        <div class="count" aria-live="polite">{{ done.size }} of {{ items.length }} reviewed</div>
      </header>
      @if (intro) { <p class="intro" [innerHTML]="intro | md"></p> }
      <ul class="items">
        @for (item of items; track $index; let i = $index) {
          <li>
            <button type="button" class="item" [class.done]="done.has(i)" [attr.aria-pressed]="done.has(i)" (click)="toggle(i)">
              <mat-icon class="tick" aria-hidden="true">{{ done.has(i) ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
              <span class="body">
                <span class="action" [innerHTML]="item.action | md"></span>
                <span class="why" [innerHTML]="item.why | md"></span>
                @if (item.example) { <span class="example"><code>{{ item.example }}</code></span> }
              </span>
            </button>
          </li>
        }
      </ul>
    </section>
  `,
  styles: [`
    :host { display: block; margin: 18px 0; }
    .harden { border: 1px solid var(--c-success); border-radius: var(--r-lg); background: var(--c-surface); padding: 16px 18px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
    .title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: var(--c-text); }
    .title mat-icon { color: var(--c-success); }
    .count { font-size: 12px; font-weight: 700; color: var(--c-text); background: var(--c-success-light); padding: 3px 10px; border-radius: 12px; }
    .intro { margin: 0 0 10px; font-size: 14px; line-height: 1.6; color: var(--c-text-2); }
    .items { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .item {
      width: 100%; display: flex; gap: 10px; align-items: flex-start; text-align: left; cursor: pointer; font: inherit;
      padding: 10px 12px; border-radius: var(--r-md); border: 1px solid var(--c-border); background: var(--c-surface-2); color: var(--c-text);
      transition: border-color .15s, background .15s;
    }
    .item:hover { border-color: var(--c-success); background: var(--c-success-light); }
    .item.done { border-color: var(--c-success); background: var(--c-success-light); }
    .tick { flex: none; color: var(--c-muted); margin-top: 1px; }
    .item.done .tick { color: var(--c-success); }
    .body { display: grid; gap: 3px; min-width: 0; }
    .action { font-weight: 700; font-size: 14.5px; line-height: 1.45; }
    .why { font-size: 13.5px; line-height: 1.55; color: var(--c-text-2); }
    .item:hover .why, .item.done .why { color: var(--c-text); }
    .example code, .why code, .action code {
      font-family: 'Courier New', monospace; font-size: 12.5px; padding: 1px 6px; border-radius: 6px;
      background: var(--c-surface-3); color: var(--c-text); border: 1px solid var(--c-border); word-break: break-word;
    }
    @media (max-width: 600px) { .harden { padding: 12px 12px; } }
  `],
})
export class HardenListComponent implements OnChanges {
  @Input({ required: true }) title = '';
  @Input() intro = '';
  @Input({ required: true }) items: HardenItem[] = [];

  done = new Set<number>();

  ngOnChanges() {
    this.done = new Set<number>();
  }

  toggle(i: number) {
    if (this.done.has(i)) this.done.delete(i);
    else this.done.add(i);
  }
}
