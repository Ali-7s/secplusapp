import { Component, Input, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';

/** How often something happens: once every N years, or N times a year. */
type Rate = { mode: 'every' | 'per'; n: number };

interface AleState { av: number; ef: number; rate: Rate; cost: number; ef2: number; rate2: Rate }
interface UpState { mtbf: number; mttr: number; sla: number; a: number; b: number }

const ALE_DEFAULTS: AleState = {
  av: 400000, ef: 50, rate: { mode: 'every', n: 5 },
  cost: 20000, ef2: 50, rate2: { mode: 'every', n: 25 },
};
const UP_DEFAULTS: UpState = { mtbf: 1990, mttr: 10, sla: 99.9, a: 99.9, b: 99.5 };

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/**
 * Risk calculators you can play with. `ale` works out SLE and ALE and whether a control pays for itself;
 * `availability` works out uptime from MTBF and MTTR, an SLA's downtime allowance, and chains and redundant pairs.
 */
@Component({
  selector: 'app-risk-calc',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" [attr.aria-label]="show === 'ale' ? 'Risk calculator' : 'Availability calculator'">
      @if (show === 'ale') {
        <header class="head"><div class="title"><mat-icon aria-hidden="true">calculate</mat-icon> Risk calculator: is the control worth it?</div>
          <button type="button" class="btn ghost" (click)="resetAle()">Reset</button></header>
        <p class="intro">Change any number. The working is shown line by line, the way the exam expects you to do it.</p>

        <div class="grid">
          <fieldset>
            <legend>The risk today</legend>
            <label><span>Asset value (AV), $</span><input type="number" min="0" step="1000" [value]="a.av" (input)="setA('av', num($event))" /></label>
            <label><span>Exposure factor (EF): share lost in one event, %</span><input type="number" min="0" max="100" [value]="a.ef" (input)="setA('ef', num($event))" /></label>
            <div class="rate">
              <span>How often it happens</span>
              <div class="rate-row">
                <select [attr.aria-label]="'How often'" (change)="setRate('rate', 'mode', $any($event.target).value)">
                  <option value="every" [selected]="a.rate.mode === 'every'">Once every … years</option>
                  <option value="per" [selected]="a.rate.mode === 'per'">Times per year</option>
                </select>
                <input type="number" min="0" step="any" [value]="a.rate.n" (input)="setRate('rate', 'n', num($event))" />
              </div>
            </div>
          </fieldset>
          <fieldset>
            <legend>With the control</legend>
            <label><span>Yearly cost of the control, $</span><input type="number" min="0" step="1000" [value]="a.cost" (input)="setA('cost', num($event))" /></label>
            <label><span>Exposure factor with it, %</span><input type="number" min="0" max="100" [value]="a.ef2" (input)="setA('ef2', num($event))" /></label>
            <div class="rate">
              <span>How often it happens with it</span>
              <div class="rate-row">
                <select [attr.aria-label]="'How often'" (change)="setRate('rate2', 'mode', $any($event.target).value)">
                  <option value="every" [selected]="a.rate2.mode === 'every'">Once every … years</option>
                  <option value="per" [selected]="a.rate2.mode === 'per'">Times per year</option>
                </select>
                <input type="number" min="0" step="any" [value]="a.rate2.n" (input)="setRate('rate2', 'n', num($event))" />
              </div>
            </div>
          </fieldset>
        </div>

        <ol class="work">
          <li><span class="f">SLE = AV × EF</span><span class="v">{{ m(a.av) }} × {{ a.ef }}% = <strong>{{ m(sle) }}</strong></span></li>
          <li><span class="f">ARO</span><span class="v">{{ rateText(a.rate) }} = <strong>{{ fmt(aro) }}</strong> a year</span></li>
          <li><span class="f">ALE = SLE × ARO</span><span class="v">{{ m(sle) }} × {{ fmt(aro) }} = <strong>{{ m(ale) }}</strong> a year</span></li>
          <li class="sep"><span class="f">SLE with the control</span><span class="v">{{ m(a.av) }} × {{ a.ef2 }}% = <strong>{{ m(sle2) }}</strong></span></li>
          <li><span class="f">ARO with the control</span><span class="v">{{ rateText(a.rate2) }} = <strong>{{ fmt(aro2) }}</strong></span></li>
          <li><span class="f">ALE with the control</span><span class="v">{{ m(sle2) }} × {{ fmt(aro2) }} = <strong>{{ m(ale2) }}</strong> a year</span></li>
          <li class="sep"><span class="f">Loss it prevents</span><span class="v">{{ m(ale) }} − {{ m(ale2) }} = <strong>{{ m(ale - ale2) }}</strong> a year</span></li>
          <li><span class="f">Minus its yearly cost</span><span class="v">{{ m(ale - ale2) }} − {{ m(a.cost) }} = <strong>{{ net >= 0 ? '+' : '−' }}{{ m(abs(net)) }}</strong> a year</span></li>
        </ol>
        <p class="verdict" role="status" [class.ok]="net > 0" [class.warn]="net <= 0">
          <mat-icon aria-hidden="true">{{ net > 0 ? 'thumb_up' : 'thumb_down' }}</mat-icon>
          @if (net > 0) {
            <span><strong>Worth it.</strong> The control saves more each year than it costs. This is <strong>mitigation</strong>.</span>
          } @else {
            <span><strong>Not worth it.</strong> The control costs more than the loss it prevents. Consider <strong>accepting</strong> the risk, or <strong>transferring</strong> it (insurance).</span>
          }
        </p>
      } @else {
        <header class="head"><div class="title"><mat-icon aria-hidden="true">speed</mat-icon> Availability calculator</div>
          <button type="button" class="btn ghost" (click)="resetUp()">Reset</button></header>

        <h3 class="sub">From MTBF and MTTR</h3>
        <div class="row">
          <label><span>MTBF, hours</span><input type="number" min="0" [value]="u.mtbf" (input)="setU('mtbf', num($event))" /></label>
          <label><span>MTTR, hours</span><input type="number" min="0" [value]="u.mttr" (input)="setU('mttr', num($event))" /></label>
        </div>
        <p class="line">Availability = MTBF ÷ (MTBF + MTTR) = {{ fmt(u.mtbf) }} ÷ {{ fmt(u.mtbf + u.mttr) }} = <strong>{{ pct(fromMtbf) }}</strong></p>

        <h3 class="sub">What an SLA allows</h3>
        <div class="row">
          <label><span>Promised availability, %</span><input type="number" min="0" max="100" step="0.01" [value]="u.sla" (input)="setU('sla', num($event))" /></label>
        </div>
        <p class="line">Downtime allowed: <strong>{{ dur(downMonth) }}</strong> in a 30-day month (43,200 minutes × {{ fmt(100 - u.sla) }}%),
          or <strong>{{ dur(downYear) }}</strong> in a year.</p>

        <h3 class="sub">Chains and redundant pairs</h3>
        <div class="row">
          <label><span>Component A, %</span><input type="number" min="0" max="100" step="0.01" [value]="u.a" (input)="setU('a', num($event))" /></label>
          <label><span>Component B, %</span><input type="number" min="0" max="100" step="0.01" [value]="u.b" (input)="setU('b', num($event))" /></label>
        </div>
        <ul class="pairs">
          <li><mat-icon aria-hidden="true">link</mat-icon>
            <span><strong>In series</strong> (both must be up): A × B = {{ pct(u.a / 100) }} × {{ pct(u.b / 100) }} = <strong>{{ pct(series) }}</strong>. Always below the weaker one.</span></li>
          <li><mat-icon aria-hidden="true">call_split</mat-icon>
            <span><strong>B doubled up</strong> (either copy will do): 1 − (1 − B)² = 1 − {{ fmt4(1 - u.b / 100) }}² = <strong>{{ pct(pairB) }}</strong>. Both copies have to fail at once.</span></li>
          <li><mat-icon aria-hidden="true">hub</mat-icon>
            <span><strong>A in series with doubled-up B</strong>: {{ pct(u.a / 100) }} × {{ pct(pairB) }} = <strong>{{ pct(u.a / 100 * pairB) }}</strong>. The chain is now limited by A.</span></li>
        </ul>
      }
    </section>
  `,
  styleUrl: './risk-calc.component.scss',
})
export class RiskCalcComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });

  @Input() show: 'ale' | 'availability' = 'ale';

  a: AleState = structuredClone(ALE_DEFAULTS);
  u: UpState = { ...UP_DEFAULTS };

  ngOnInit() {
    this.a = { ...structuredClone(ALE_DEFAULTS), ...this.work?.get<AleState>('risk:ale') };
    this.u = { ...UP_DEFAULTS, ...this.work?.get<UpState>('risk:up') };
  }

  // ── ALE ──────────────────────────────────────────────────────────
  get sle() { return this.a.av * this.a.ef / 100; }
  get aro() { return aro(this.a.rate); }
  get ale() { return this.sle * this.aro; }
  get sle2() { return this.a.av * this.a.ef2 / 100; }
  get aro2() { return aro(this.a.rate2); }
  get ale2() { return this.sle2 * this.aro2; }
  get net() { return this.ale - this.ale2 - this.a.cost; }

  rateText(r: Rate): string {
    return r.mode === 'every' ? `1 ÷ ${this.fmt(r.n)} years` : `${this.fmt(r.n)} times a year`;
  }

  setA<K extends keyof AleState>(key: K, value: AleState[K]) {
    this.a = { ...this.a, [key]: value };
    this.work?.set('risk:ale', this.a);
  }

  setRate(which: 'rate' | 'rate2', key: keyof Rate, value: string | number) {
    this.setA(which, { ...this.a[which], [key]: value } as Rate);
  }

  resetAle() { this.a = structuredClone(ALE_DEFAULTS); this.work?.clear('risk:ale'); }

  // ── Availability ─────────────────────────────────────────────────
  get fromMtbf() { return this.u.mtbf + this.u.mttr > 0 ? this.u.mtbf / (this.u.mtbf + this.u.mttr) : 0; }
  get downMonth() { return 43200 * (100 - this.u.sla) / 100; }
  get downYear() { return 525600 * (100 - this.u.sla) / 100; }
  get series() { return (this.u.a / 100) * (this.u.b / 100); }
  get pairB() { return 1 - (1 - this.u.b / 100) ** 2; }

  setU<K extends keyof UpState>(key: K, value: UpState[K]) {
    this.u = { ...this.u, [key]: value };
    this.work?.set('risk:up', this.u);
  }

  resetUp() { this.u = { ...UP_DEFAULTS }; this.work?.clear('risk:up'); }

  // ── Formatting ───────────────────────────────────────────────────
  num(e: Event): number { const v = parseFloat((e.target as HTMLInputElement).value); return Number.isFinite(v) ? v : 0; }
  m(v: number) { return money.format(Math.round(v)); }
  abs(v: number) { return Math.abs(v); }
  fmt(v: number) { return Number.isFinite(v) ? +v.toFixed(4) + '' : '–'; }
  fmt4(v: number) { return v.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''); }
  pct(v: number) { return `${+(v * 100).toFixed(4)}%`; }

  /** Minutes as "43.2 minutes" or "8.76 hours". */
  dur(min: number) { return min < 120 ? `${+min.toFixed(1)} minutes` : `${+(min / 60).toFixed(2)} hours`; }
}

function aro(r: Rate): number {
  if (r.mode === 'per') return r.n;
  return r.n > 0 ? 1 / r.n : 0;
}
