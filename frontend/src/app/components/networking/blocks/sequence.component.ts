import { Component, Input, OnChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SequenceStep } from '../networking.model';
import { MdPipe } from './md.pipe';

/**
 * A step-through walkthrough of a conversation between devices (TCP handshake, DHCP, DNS, a web request...).
 * Each step shows who sends what to whom, an explanation, and optionally the header fields at that point.
 */
@Component({
  selector: 'app-sequence',
  standalone: true,
  imports: [MatIconModule, MdPipe],
  template: `
    <section class="seq" [attr.aria-label]="title">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">swap_horiz</mat-icon> {{ title }}</div>
        <div class="count" aria-live="polite">Step {{ shown }} of {{ steps.length }}</div>
      </header>
      @if (intro) { <p class="intro" [innerHTML]="intro | md"></p> }

      <ol class="list">
        @for (s of steps; track $index; let i = $index) {
          @if (i < shown) {
            <li class="step" [class.current]="i === shown - 1">
              <div class="route">
                <span class="num" aria-hidden="true">{{ i + 1 }}</span>
                <span [class]="'actor from ' + actorClass(s.from)">{{ s.from }}</span>
                <span class="arrow">
                  <span class="arrow-label">{{ s.label }}</span>
                  <mat-icon aria-hidden="true">arrow_right_alt</mat-icon>
                </span>
                <span [class]="'actor to ' + actorClass(s.to)">{{ s.to }}</span>
              </div>
              <div class="note" [innerHTML]="s.note | md"></div>

              @for (snap of s.snapshots ?? []; track snap.label) {
                <div class="snap">
                  <div class="snap-label">{{ snap.label }}</div>
                  <dl class="fields">
                    @for (f of snap.fields; track f.name) {
                      <div class="field" [class.changed]="f.changed">
                        <dt>{{ f.name }}</dt>
                        <dd>{{ f.value }}@if (f.changed) { <span class="chg">changed</span> }</dd>
                      </div>
                    }
                  </dl>
                </div>
              }

              @if (s.table; as t) {
                <div class="state">
                  <div class="snap-label">{{ t.title }}</div>
                  <div class="table-wrap">
                    <table>
                      <thead><tr>@for (c of t.columns; track c) { <th>{{ c }}</th> }</tr></thead>
                      <tbody>
                        @for (row of t.rows; track $index) {
                          <tr>@for (cell of row; track $index) { <td>{{ cell }}</td> }</tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            </li>
          }
        }
      </ol>

      <div class="controls">
        <button type="button" class="btn" (click)="back()" [attr.aria-disabled]="shown <= 1">
          <mat-icon aria-hidden="true">chevron_left</mat-icon> Back
        </button>
        <button type="button" class="btn primary" (click)="next()" [attr.aria-disabled]="shown >= steps.length">
          {{ shown >= steps.length ? 'That was the last step' : 'Next step' }}
          @if (shown < steps.length) { <mat-icon aria-hidden="true">chevron_right</mat-icon> }
        </button>
        <span class="spacer"></span>
        <button type="button" class="btn ghost" (click)="showAll()">Show all</button>
        <button type="button" class="btn ghost" (click)="reset()">Start over</button>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; margin: 18px 0; }
    .seq { border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); padding: 16px 18px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
    .title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: var(--c-primary); }
    .title mat-icon { color: var(--c-accent); }
    .count { font-size: 12px; font-weight: 700; color: var(--c-text-2); background: var(--c-surface-3); padding: 3px 10px; border-radius: 12px; }
    .intro { margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: var(--c-text-2); }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .step { border: 1px solid var(--c-border); border-radius: var(--r-md); padding: 12px 14px; background: var(--c-surface-2); }
    .step.current { border-color: var(--c-accent); box-shadow: 0 0 0 1px var(--c-accent); }

    .route { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: 8px; }
    .num {
      width: 22px; height: 22px; border-radius: 50%; background: var(--c-accent-solid); color: var(--c-on-accent);
      display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800;
    }
    .actor {
      padding: 4px 10px; border-radius: 8px; font-size: 13px; font-weight: 700; color: var(--c-text);
      border: 1px solid var(--c-border-dark); background: var(--c-surface-3); text-align: center;
    }
    .actor.a0 { background: var(--c-accent-light);  border-color: var(--c-accent); }
    .actor.a1 { background: var(--c-success-light); border-color: var(--c-success); }
    .actor.a2 { background: var(--c-warning-light); border-color: var(--c-warning); }
    .actor.a3 { background: var(--c-error-light);   border-color: var(--c-error); }
    .arrow { display: flex; flex-direction: column; align-items: center; min-width: 0; }
    .arrow-label { font-size: 12px; font-weight: 600; color: var(--c-text-2); text-align: center; line-height: 1.3; }
    .arrow mat-icon { width: 36px; height: 20px; font-size: 36px; line-height: 20px; color: var(--c-muted); }
    .note { margin-top: 8px; font-size: 14px; line-height: 1.6; color: var(--c-text); }

    .snap, .state { margin-top: 10px; }
    .snap-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: var(--c-text-2); margin-bottom: 6px; }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 6px; margin: 0; }
    .field { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 8px; padding: 6px 9px; min-width: 0; }
    .field.changed { border-color: var(--c-warning); background: var(--c-warning-light); }
    .field dt { font-size: 11px; color: var(--c-text-2); font-weight: 600; }
    .field dd { margin: 2px 0 0; font-family: 'Courier New', monospace; font-size: 12.5px; color: var(--c-text); word-break: break-word; }
    .chg { display: inline-block; white-space: nowrap; word-break: normal; margin-left: 6px; font-family: Roboto, sans-serif; font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--c-text); background: var(--c-warning-light); border: 1px solid var(--c-warning); border-radius: 8px; padding: 0 5px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--c-border); border-radius: 8px; background: var(--c-surface); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 7px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: var(--c-text-2); background: var(--c-surface-3); white-space: nowrap; }
    td { padding: 7px 10px; border-top: 1px solid var(--c-border); color: var(--c-text); font-family: 'Courier New', monospace; font-size: 12.5px; }

    .controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
    .spacer { flex: 1; }
    .btn {
      font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
      padding: 8px 14px; border-radius: 8px; border: 2px solid var(--c-border-dark); background: var(--c-surface); color: var(--c-text);
    }
    .btn:hover { border-color: var(--c-accent); background: var(--c-accent-light); }
    .btn.primary { border-color: var(--c-accent-solid); background: var(--c-accent-solid); color: var(--c-on-accent); }
    .btn.primary:hover { filter: brightness(1.12); }
    .btn.ghost { border-color: transparent; background: transparent; color: var(--c-text-2); }
    .btn.ghost:hover { background: var(--c-surface-3); border-color: transparent; }
    .btn[aria-disabled='true'] { opacity: .45; cursor: default; pointer-events: none; }
    .btn mat-icon { font-size: 20px; width: 20px; height: 20px; }

    /* Phones: "1  Laptop -> Router" on one line, the arrow label underneath. */
    @media (max-width: 600px) {
      .seq { padding: 12px 12px; }
      .route {
        grid-template-columns: auto auto auto 1fr;
        grid-template-areas: 'num from icon to' '. label label label';
        row-gap: 6px;
      }
      .route .num { grid-area: num; }
      .route .from { grid-area: from; }
      .route .to { grid-area: to; justify-self: start; }
      .route .arrow { display: contents; }
      .route .arrow-label { grid-area: label; text-align: left; }
      .route .arrow mat-icon { grid-area: icon; }
    }
  `],
})
export class SequenceComponent implements OnChanges {
  @Input({ required: true }) title = '';
  @Input() intro = '';
  @Input({ required: true }) steps: SequenceStep[] = [];

  shown = 1;
  private actors: string[] = [];

  ngOnChanges() {
    this.actors = [];
    for (const s of this.steps) {
      for (const name of [s.from, s.to]) if (!this.actors.includes(name)) this.actors.push(name);
    }
    this.shown = 1;
  }

  actorClass(name: string): string {
    return 'a' + (this.actors.indexOf(name) % 4);
  }

  next() { if (this.shown < this.steps.length) this.shown++; }
  back() { if (this.shown > 1) this.shown--; }
  showAll() { this.shown = this.steps.length; }
  reset() { this.shown = 1; }
}
