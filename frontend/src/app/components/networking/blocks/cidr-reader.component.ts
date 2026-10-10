import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CidrResult, analyse } from './cidr';

/** Type an IPv4 address or a CIDR block and see what it means. Reading, not subnetting homework. */
@Component({
  selector: 'app-cidr-reader',
  standalone: true,
  imports: [FormsModule, MatIconModule],
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
            <dl class="grid">
              <div><dt>Subnet mask</dt><dd>{{ result.mask }}</dd></div>
              <div><dt>Network address</dt><dd>{{ result.network }}</dd></div>
              <div><dt>Usable hosts</dt><dd>{{ result.hosts }}</dd></div>
              <div><dt>First host</dt><dd>{{ result.firstHost }}</dd></div>
              <div><dt>Last host</dt><dd>{{ result.lastHost }}</dd></div>
              <div><dt>Broadcast</dt><dd>{{ result.broadcast }}</dd></div>
            </dl>
            <p class="bits">
              The first <strong>{{ result.prefix }}</strong> bits are the network part and the remaining
              <strong>{{ 32 - result.prefix }}</strong> bits identify the host.
            </p>
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
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; margin: 0; }
    .grid > div { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-surface-2); min-width: 0; }
    dt { font-size: 11px; font-weight: 700; color: var(--c-text-2); text-transform: uppercase; letter-spacing: .4px; }
    dd { margin: 2px 0 0; font-family: 'Courier New', monospace; font-size: 14px; color: var(--c-text); word-break: break-word; }
    .bits { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--c-text); }
    .err { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--c-error-light); border-left: 4px solid var(--c-error); font-size: 13.5px; color: var(--c-text); }
  `],
})
export class CidrReaderComponent {
  readonly presets = ['192.168.1.0/24', '10.0.0.0/8', '172.16.0.0/12', '192.168.1.128/25', '10.1.2.0/30', '169.254.7.20', '172.32.0.9', '8.8.8.8', '127.0.0.1'];

  text = '192.168.1.0/24';
  result: CidrResult = analyse(this.text);

  update() {
    this.result = analyse(this.text);
  }

  use(value: string) {
    this.text = value;
    this.update();
  }
}
