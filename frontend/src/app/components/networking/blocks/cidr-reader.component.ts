import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CidrField, CidrResult, CidrWorking, analyse, explain } from './cidr';
import { MdPipe } from './md.pipe';

/** Type an IPv4 address or a CIDR block and see what it means, with the working behind every value. */
@Component({
  selector: 'app-cidr-reader',
  standalone: true,
  imports: [FormsModule, MatIconModule, MdPipe],
  template: `
    <section class="cidr" aria-label="IP address and CIDR reader">
      <div class="title"><mat-icon aria-hidden="true">calculate</mat-icon> Try it: read an address or a block</div>
      <label class="input-row">
        <span class="lbl">IPv4 address or CIDR block</span>
        <input type="text" [(ngModel)]="text" (ngModelChange)="update()" placeholder="192.168.1.0/24"
          autocomplete="off" autocapitalize="off" spellcheck="false" />
      </label>
      <div class="presets" aria-label="Examples to try">
        @for (p of presets; track p) {
          <button type="button" class="chip" (click)="use(p)">{{ p }}</button>
        }
      </div>

      @if (result.ok) {
        <div class="out" aria-live="polite">
          <div class="kind">
            <span class="kind-type">{{ result.kind?.type }}</span>
            <span class="kind-note">{{ result.kind?.note }}</span>
          </div>
          @if (result.prefix !== undefined) {
            <p class="how-hint"><mat-icon aria-hidden="true">touch_app</mat-icon> Hover over a box, or tap it, to see how that value is worked out.</p>
            <dl class="grid">
              @for (f of fields; track f.key) {
                <div class="cell" role="button" tabindex="0" [class.on]="shown === f.key"
                  [attr.aria-pressed]="pinned === f.key" [attr.aria-describedby]="shown === f.key ? 'cidr-how' : null"
                  (mouseenter)="hovered = f.key" (mouseleave)="hovered = null" (focus)="hovered = f.key" (blur)="hovered = null"
                  (click)="togglePin(f.key)" (keydown.enter)="togglePin(f.key)" (keydown.space)="$event.preventDefault(); togglePin(f.key)">
                  <dt>{{ f.label }}</dt><dd>{{ value(f.key) }}</dd>
                </div>
              }
            </dl>
            @if (working && shown) {
              <div class="how" id="cidr-how" aria-live="polite">
                <div class="how-title">How the {{ labelOf(shown).toLowerCase() }} is worked out</div>
                <p [innerHTML]="working[shown] | md"></p>
              </div>
            }
            @if (block) {
              <div class="strip" aria-label="The whole block of addresses">
                <div class="seg reserved"><span class="lbl">Network</span><span class="addr">{{ block.network }}</span><span class="note">reserved</span></div>
                <div class="seg usable"><span class="lbl">Usable by devices</span><span class="addr">{{ block.first }} to {{ block.last }}</span><span class="note">{{ result.hosts }} addresses</span></div>
                <div class="seg reserved"><span class="lbl">Broadcast</span><span class="addr">{{ block.broadcast }}</span><span class="note">reserved</span></div>
              </div>
            }
            <p class="bits">
              The first <strong>{{ result.prefix }}</strong> bits are the network part and the remaining
              <strong>{{ 32 - result.prefix }}</strong> bits identify the host.
            </p>
            @if (working) {
              <button type="button" class="walk-btn" (click)="walkthrough = !walkthrough" [attr.aria-expanded]="walkthrough">
                <mat-icon aria-hidden="true">{{ walkthrough ? 'expand_less' : 'school' }}</mat-icon>
                {{ walkthrough ? 'Hide the walkthrough' : 'Walk me through all of it, in order' }}
              </button>
              @if (walkthrough) {
                <ol class="walk">
                  @for (k of order; track k) {
                    <li><strong>{{ labelOf(k) }}.</strong>&ngsp;<span [innerHTML]="working[k] | md"></span></li>
                  }
                </ol>
              }
            }
          }
        </div>
      } @else {
        <p class="err" role="alert">{{ result.error }}</p>
      }
    </section>
  `,
  styles: [`
    :host { display: block; margin: 18px 0; }
    .cidr { border: 1px solid var(--c-border); border-radius: var(--r-lg); background: var(--c-surface); padding: 16px 18px; }
    .title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: var(--c-primary); margin-bottom: 12px; }
    .title mat-icon { color: var(--c-accent); }
    .input-row { display: grid; gap: 4px; }
    .lbl { font-size: 12px; font-weight: 700; color: var(--c-text-2); }
    input {
      font: inherit; font-family: 'Courier New', monospace; font-size: 16px; padding: 10px 12px; border-radius: 10px;
      border: 2px solid var(--c-border-dark); background: var(--c-surface-2); color: var(--c-text); width: 100%; box-sizing: border-box;
    }
    input:focus { border-color: var(--c-accent); }
    .presets { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 4px; }
    .chip {
      font: inherit; font-family: 'Courier New', monospace; font-size: 12px; cursor: pointer; padding: 4px 10px; border-radius: 14px;
      border: 1px solid var(--c-border-dark); background: var(--c-surface-3); color: var(--c-text);
    }
    .chip:hover { border-color: var(--c-accent); background: var(--c-accent-light); }
    .out { margin-top: 12px; display: grid; gap: 10px; }
    .kind { padding: 10px 12px; border-radius: 10px; background: var(--c-accent-light); border-left: 4px solid var(--c-accent); display: grid; gap: 2px; }
    .kind-type { font-weight: 800; color: var(--c-text); font-size: 14px; }
    .kind-note { font-size: 13px; line-height: 1.5; color: var(--c-text); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 8px; margin: 0; }
    .grid > div { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-surface-2); min-width: 0; cursor: help; }
    .grid > .cell.on { border-color: var(--c-accent); background: var(--c-accent-light); }
    .grid > .cell:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 1px; }
    .how-hint { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 13px; color: var(--c-text-2); }
    .how-hint mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--c-accent); }
    .how { padding: 10px 12px; border-radius: 10px; background: var(--c-surface-2); border: 1px solid var(--c-accent); }
    .how-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: var(--c-accent-solid); margin-bottom: 4px; }
    .how p { margin: 0; font-size: 14px; line-height: 1.6; color: var(--c-text); }
    .strip { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr); gap: 4px; }
    .seg { display: flex; flex-direction: column; gap: 2px; padding: 8px; border-radius: 8px; text-align: center; min-width: 0; }
    .seg.reserved { background: var(--c-error-light); border: 1px solid var(--c-error); }
    .seg.usable { background: var(--c-success-light); border: 1px solid var(--c-success); }
    .seg .lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; color: var(--c-text-2); }
    .seg .addr { font-family: 'Courier New', monospace; font-size: 13px; color: var(--c-text); overflow-wrap: anywhere; }
    .seg .note { font-size: 11.5px; color: var(--c-text-2); }
    .walk-btn { justify-self: start; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 18px; cursor: pointer;
      font: inherit; font-size: 13.5px; font-weight: 700; border: 1px solid var(--c-accent); background: var(--c-surface); color: var(--c-accent-solid); }
    .walk-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .walk { margin: 0; padding-left: 22px; display: grid; gap: 8px; }
    .walk li { font-size: 14px; line-height: 1.6; color: var(--c-text); }
    @media (max-width: 520px) { .strip { grid-template-columns: 1fr; } }
    dt { font-size: 11px; font-weight: 700; color: var(--c-text-2); text-transform: uppercase; letter-spacing: .4px; }
    dd { margin: 2px 0 0; font-family: 'Courier New', monospace; font-size: 14px; color: var(--c-text); word-break: break-word; }
    .bits { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--c-text); }
    .err { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--c-error-light); border-left: 4px solid var(--c-error); font-size: 13.5px; color: var(--c-text); }
  `],
})
export class CidrReaderComponent {
  readonly presets = ['192.168.1.0/24', '10.0.0.0/8', '172.16.0.0/12', '192.168.1.128/25', '10.1.2.0/30', '169.254.7.20', '172.32.0.9', '8.8.8.8', '127.0.0.1'];

  /** The boxes, in the order the addresses appear in the block. */
  readonly fields: { key: CidrField; label: string }[] = [
    { key: 'mask', label: 'Subnet mask' },
    { key: 'network', label: 'Network address' },
    { key: 'firstHost', label: 'First host' },
    { key: 'lastHost', label: 'Last host' },
    { key: 'broadcast', label: 'Broadcast' },
    { key: 'hosts', label: 'Usable hosts' },
  ];
  /** The order a person works the values out in. */
  readonly order: CidrField[] = ['mask', 'network', 'broadcast', 'firstHost', 'lastHost', 'hosts'];

  text = '192.168.1.0/24';
  result: CidrResult = analyse(this.text);
  working: CidrWorking | null = null;
  hovered: CidrField | null = null;
  pinned: CidrField | null = null;
  walkthrough = false;

  constructor() { this.update(); }

  get shown(): CidrField | null { return this.hovered ?? this.pinned; }

  /** The network, first, last and broadcast addresses, for the strip under the boxes (normal subnets only). */
  get block(): { network: string; first: string; last: string; broadcast: string } | null {
    const r = this.result;
    if (!r.ok || r.prefix === undefined || r.prefix > 30) return null;
    return { network: r.network!, first: r.firstHost!, last: r.lastHost!, broadcast: r.broadcast! };
  }

  update() {
    this.result = analyse(this.text);
    const r = this.result;
    this.working = r.ok && r.prefix !== undefined && r.ip ? explain(r.ip, r.prefix) : null;
  }

  use(value: string) {
    this.text = value;
    this.update();
  }

  value(key: CidrField): string { return this.result[key] ?? ''; }
  labelOf(key: CidrField): string { return this.fields.find(f => f.key === key)!.label; }

  /** Tapping a box keeps its explanation open; tapping it again closes it. */
  togglePin(key: CidrField) {
    if (this.pinned === key) { this.pinned = null; this.hovered = null; }
    else this.pinned = key;
  }
}
