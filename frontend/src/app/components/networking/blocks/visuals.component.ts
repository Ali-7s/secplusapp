import { NgTemplateOutlet } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FlowNode, NestedLayer, PortCell, PortLegend, PortTone } from '../networking.model';

/** A chain of boxes joined by arrows: a path through devices, or a stack of zones. */
@Component({
  selector: 'app-flow',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <figure class="flow" [class.right]="direction === 'right'">
      <div class="chain">
        @for (n of nodes; track $index; let last = $last) {
          <div [class]="'node ' + (n.tone ?? 'neutral')">
            <span class="lab">{{ n.label }}</span>
            @if (n.sub) { <span class="sub">{{ n.sub }}</span> }
          </div>
          @if (!last) {
            <mat-icon class="arr" aria-hidden="true">{{ direction === 'right' ? 'arrow_forward' : 'arrow_downward' }}</mat-icon>
          }
        }
      </div>
      @if (caption) { <figcaption>{{ caption }}</figcaption> }
    </figure>
  `,
  styles: [`
    :host { display: block; margin: 18px 0; }
    .flow { margin: 0; padding: 16px; border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); }
    .chain { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .right .chain { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 8px; }
    .node {
      min-width: 220px; max-width: 100%; box-sizing: border-box; text-align: center; padding: 9px 14px; border-radius: 10px;
      border: 2px solid var(--c-border-dark); background: var(--c-surface-2); color: var(--c-text); display: grid; gap: 1px;
    }
    .right .node { min-width: 0; }
    .node.accent { border-color: var(--c-accent);  background: var(--c-accent-light); }
    .node.safe   { border-color: var(--c-success); background: var(--c-success-light); }
    .node.warn   { border-color: var(--c-warning); background: var(--c-warning-light); }
    .node.danger { border-color: var(--c-error);   background: var(--c-error-light); }
    .lab { font-weight: 700; font-size: 14px; line-height: 1.35; }
    .sub { font-size: 12.5px; color: var(--c-text); line-height: 1.4; }
    .arr { color: var(--c-muted); flex: none; }
    figcaption { margin-top: 10px; text-align: center; font-size: 13px; color: var(--c-text-2); line-height: 1.5; }
  `],
})
export class FlowComponent {
  @Input({ required: true }) nodes: FlowNode[] = [];
  @Input() direction: 'down' | 'right' = 'down';
  @Input() caption = '';
}

/** A row of numbered switch ports coloured by VLAN (or any other grouping). */
@Component({
  selector: 'app-port-strip',
  standalone: true,
  template: `
    <figure class="ports">
      <div class="faceplate" role="img" [attr.aria-label]="caption || 'Switch ports'">
        @for (c of cells; track $index) {
          <div [class]="'port t-' + toneOf(c.group)"><span>{{ c.label }}</span></div>
        }
      </div>
      <ul class="legend">
        @for (l of legend; track l.group) {
          <li><span [class]="'sw t-' + toneOf(l.group)"></span>{{ l.label }}</li>
        }
      </ul>
      @if (caption) { <figcaption>{{ caption }}</figcaption> }
    </figure>
  `,
  styles: [`
    :host { display: block; margin: 18px 0; --g4: #7c3aed; }
    :host-context([data-theme="dark"]) { --g4: #a78bfa; }
    .ports { margin: 0; padding: 16px; border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); }
    .faceplate {
      display: flex; flex-wrap: wrap; gap: 6px; padding: 10px; border-radius: 10px;
      background: var(--c-surface-3); border: 2px solid var(--c-border-dark);
    }
    .port {
      width: 44px; height: 44px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
      border: 2px solid var(--c-border-dark); background: var(--c-surface-2); color: var(--c-text);
      font-weight: 800; font-size: 13px; font-family: 'Courier New', monospace;
    }
    .sw { flex: none; width: 18px; height: 18px; border-radius: 4px; border: 2px solid var(--c-border-dark); }
    .t-blue   { border-color: var(--c-accent);  background: var(--c-accent-light); }
    .t-green  { border-color: var(--c-success); background: var(--c-success-light); }
    .t-orange { border-color: var(--c-warning); background: var(--c-warning-light); }
    .t-red    { border-color: var(--c-error);   background: var(--c-error-light); }
    .t-purple { border-color: var(--g4);        background: color-mix(in srgb, var(--g4) 16%, transparent); }
    .t-gray   { border-style: dashed; border-color: var(--c-border-dark); background: var(--c-surface-2); color: var(--c-text-2); }
    .legend { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 6px; font-size: 13.5px; color: var(--c-text); }
    .legend li { display: flex; align-items: center; gap: 8px; line-height: 1.4; }
    figcaption { margin-top: 10px; font-size: 13px; color: var(--c-text-2); line-height: 1.5; }
    @media (max-width: 480px) { .port { width: 38px; height: 38px; } }
  `],
})
export class PortStripComponent {
  @Input({ required: true }) cells: PortCell[] = [];
  @Input({ required: true }) legend: PortLegend[] = [];
  @Input() caption = '';

  private readonly defaultTones: PortTone[] = ['blue', 'green', 'orange', 'purple', 'red', 'gray'];

  toneOf(group: string): PortTone {
    const index = Math.max(0, this.legend.findIndex(l => l.group === group));
    return this.legend[index]?.tone ?? this.defaultTones[index % this.defaultTones.length];
  }
}

/** Boxes inside boxes, to show one layer wrapping the next (encapsulation). */
@Component({
  selector: 'app-nested-boxes',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <figure class="nested">
      <ng-template #box let-i="i">
        @if (layers[i]; as l) {
          <div [class]="'box d' + (i % 4)">
            <div class="head"><span class="label">{{ l.label }}</span>@if (l.note) { <span class="note">{{ l.note }}</span> }</div>
            <ng-container *ngTemplateOutlet="box; context: { i: i + 1 }" />
          </div>
        }
      </ng-template>
      <ng-container *ngTemplateOutlet="box; context: { i: 0 }" />
      @if (caption) { <figcaption>{{ caption }}</figcaption> }
    </figure>
  `,
  styles: [`
    :host { display: block; margin: 18px 0; }
    .nested { margin: 0; padding: 16px; border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); }
    .box { padding: 8px 10px 10px; border-radius: 10px; border: 2px solid var(--c-border-dark); color: var(--c-text); }
    .box .box { margin-top: 8px; }
    /* Tint over an opaque surface, so nested boxes do not stack their translucent tints into mud. */
    .d0 { border-color: var(--c-error);   background: linear-gradient(var(--c-error-light), var(--c-error-light)) var(--c-surface); }
    .d1 { border-color: var(--c-warning); background: linear-gradient(var(--c-warning-light), var(--c-warning-light)) var(--c-surface); }
    .d2 { border-color: var(--c-success); background: linear-gradient(var(--c-success-light), var(--c-success-light)) var(--c-surface); }
    .d3 { border-color: var(--c-accent);  background: linear-gradient(var(--c-accent-light), var(--c-accent-light)) var(--c-surface); }
    .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
    .label { font-weight: 800; font-size: 14px; }
    .note { font-size: 12.5px; color: var(--c-text); }
    figcaption { margin-top: 10px; font-size: 13px; color: var(--c-text-2); line-height: 1.5; }
  `],
})
export class NestedBoxesComponent {
  @Input({ required: true }) layers: NestedLayer[] = [];
  @Input() caption = '';
}
