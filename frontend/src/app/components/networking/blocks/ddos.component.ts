import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { BOT_STEPS, DDOS_CHALLENGES, DEFENCES, DdosChallenge, DefenceId, LINK_MBPS, METHODS, Method, SERVER_RPS, SYN_PER_S, ddosMet, fmt, runDdos } from './ddos';

interface Saved { challenge: string | null; method: Method; bots: number; on: DefenceId[]; solved: string[] }

/** Launch DDoS attacks at a small online shop and defend it, with live meters for its link, server and connection table. */
@Component({
  selector: 'app-ddos',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="DDoS sandbox">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">tsunami</mat-icon> DDoS sandbox</div>
        <div class="count" aria-live="polite">{{ solved.length }} of {{ challenges.length }} challenges</div>
      </header>
      <p class="intro">Attack a small online shop, then defend it. Everything updates as you change it: watch which part gives way first, the internet link, the web server or its connection table.</p>

      <div class="chips" role="radiogroup" aria-label="Challenge">
        <button type="button" role="radio" class="chip" [class.on]="!challenge" [attr.aria-checked]="!challenge" (click)="pick(null)">Free play</button>
        @for (c of challenges; track c.id; let i = $index) {
          <button type="button" role="radio" class="chip" [class.on]="challenge?.id === c.id" [attr.aria-checked]="challenge?.id === c.id" (click)="pick(c)">
            @if (solved.includes(c.id)) { <mat-icon aria-hidden="true" class="done">task_alt</mat-icon> }
            {{ i + 1 }}. {{ c.role === 'attacker' ? 'Attack' : 'Defend' }}
          </button>
        }
      </div>
      @if (challenge) {
        <div class="goal" [class.met]="met"><mat-icon aria-hidden="true">{{ met ? 'emoji_events' : 'flag' }}</mat-icon>
          <div><strong>{{ challenge.role === 'attacker' ? 'Attacker' : 'Defender' }}:</strong> {{ challenge.goal }}
            @if (met) { <div class="lesson"><strong>Done.</strong> {{ challenge.lesson }}</div> }
          </div>
        </div>
      }

      <div class="cols">
        <fieldset class="panel">
          <legend><mat-icon aria-hidden="true">smart_toy</mat-icon> The attack</legend>
          <label class="bots">Bots
            <select [value]="bots" (change)="setBots(+$any($event.target).value)" [disabled]="!!challenge">
              @for (b of botSteps; track b) { <option [value]="b" [selected]="b === bots">{{ b.toLocaleString('en-US') }}</option> }
            </select>
          </label>
          @for (m of methods; track m.id) {
            <label class="opt" [class.on]="method === m.id" [class.locked]="methodLocked && method !== m.id">
              <input type="radio" name="ddos-method" [checked]="method === m.id" [disabled]="methodLocked" (change)="setMethod(m.id)" />
              <span><span class="on-name">{{ m.name }}</span><span class="sub">{{ m.detail }}</span></span>
            </label>
          }
        </fieldset>

        <fieldset class="panel">
          <legend><mat-icon aria-hidden="true">shield</mat-icon> Defences</legend>
          @for (d of defences; track d.id) {
            @if ($index === 3) { <div class="divider">Internet-wide: not the shop's to switch on</div> }
            <label class="opt" [class.on]="on.includes(d.id)" [class.locked]="!allowed(d.id)">
              <input type="checkbox" [checked]="on.includes(d.id)" [disabled]="!allowed(d.id)" (change)="toggle(d.id)" />
              <mat-icon aria-hidden="true">{{ d.icon }}</mat-icon>
              <span><span class="on-name">{{ d.name }}</span><span class="sub">{{ d.detail }}</span></span>
            </label>
          }
        </fieldset>
      </div>

      @let r = result;
      <div class="status" [class.up]="r.up" [class.down]="!r.up" role="status" aria-live="polite">
        <mat-icon aria-hidden="true">{{ r.up ? 'storefront' : 'cloud_off' }}</mat-icon><span>{{ r.verdict }}</span>
      </div>

      <div class="meters">
        @for (g of gauges; track g.name) {
          <div class="meter" [class.over]="g.value > g.max">
            <div class="m-top"><span>{{ g.name }}</span><span class="m-val">{{ g.label }}</span></div>
            <div class="bar" role="meter" [attr.aria-label]="g.name" [attr.aria-valuenow]="g.value" aria-valuemin="0" [attr.aria-valuemax]="g.max">
              <div class="fill" [style.width.%]="pct(g.value, g.max)"></div>
            </div>
            @if (g.value > g.max) { <div class="m-x">{{ times(g.value, g.max) }} its capacity</div> }
          </div>
        }
      </div>

      @if (r.notes.length) {
        <ul class="notes" aria-label="What each defence did">
          @for (n of r.notes; track n.id) {
            <li [class.good]="n.helped"><mat-icon aria-hidden="true">{{ n.helped ? 'check_circle' : 'remove_circle_outline' }}</mat-icon>
              <span><strong>{{ name(n.id) }}:</strong> {{ n.text }}</span></li>
          }
        </ul>
      }

      <div class="wire">
        <div class="wire-h"><mat-icon aria-hidden="true">sensors</mat-icon> Arriving at your firewall</div>
        @for (s of r.sample; track $index) { <div class="mono pkt">{{ s }}</div> }
      </div>

      @if (solved.length === challenges.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>All five done.</strong> Volumetric floods are stopped upstream, protocol floods at the server's TCP stack, and application floods by limiting each client.</span>
        </div>
      }
    </section>
  `,
  styleUrl: './ddos.component.scss',
})
export class DdosComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly challenges = DDOS_CHALLENGES;
  readonly methods = METHODS;
  readonly defences = DEFENCES;
  readonly botSteps = BOT_STEPS;

  challenge: DdosChallenge | null = null;
  method: Method = 'http';
  bots = 100;
  on: DefenceId[] = [];
  solved: string[] = [];

  ngOnInit() {
    const s = this.work?.get<Saved>('ddos');
    if (!s) return;
    this.challenge = DDOS_CHALLENGES.find(c => c.id === s.challenge) ?? null;
    if (METHODS.some(m => m.id === s.method)) this.method = s.method;
    if (BOT_STEPS.includes(s.bots)) this.bots = s.bots;
    this.on = (s.on ?? []).filter(d => DEFENCES.some(x => x.id === d));
    this.solved = (s.solved ?? []).filter(id => DDOS_CHALLENGES.some(c => c.id === id));
  }

  get result() { return runDdos({ method: this.method, bots: this.bots, on: this.on }); }
  get met() { return !!this.challenge && ddosMet(this.challenge, { method: this.method, bots: this.bots, on: this.on }); }
  get methodLocked() { return !!this.challenge && this.challenge.role === 'defender'; }

  get gauges() {
    const r = this.result;
    return [
      { name: 'Internet link', value: r.linkMbps, max: LINK_MBPS, label: `${this.mbps(r.linkMbps)} of 1 Gbps` },
      { name: 'Web server', value: r.serverRps, max: SERVER_RPS, label: `${r.serverRps.toLocaleString('en-US')} of ${SERVER_RPS.toLocaleString('en-US')} requests/s` },
      { name: 'Connection table', value: r.synRate, max: SYN_PER_S, label: `${r.synRate.toLocaleString('en-US')} of ${SYN_PER_S.toLocaleString('en-US')} half-open/s` },
    ];
  }

  allowed(d: DefenceId) { return !this.challenge || (this.challenge.role === 'defender' && this.challenge.allowed!.includes(d)); }
  name(d: DefenceId) { return DEFENCES.find(x => x.id === d)!.name; }
  pct(v: number, max: number) { return Math.min(100, v / max * 100); }
  times(v: number, max: number) { const x = v / max; return x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`; }
  mbps(n: number) { return fmt(n); }

  pick(c: DdosChallenge | null) {
    this.challenge = c;
    if (c) {
      this.bots = c.bots;
      if (c.method) this.method = c.method;
      this.on = [];
    }
    this.save();
  }

  setMethod(m: Method) { this.method = m; this.save(); }
  setBots(b: number) { if (BOT_STEPS.includes(b)) { this.bots = b; this.save(); } }
  toggle(d: DefenceId) {
    if (!this.allowed(d)) return;
    this.on = this.on.includes(d) ? this.on.filter(x => x !== d) : DEFENCES.map(x => x.id).filter(x => x === d || this.on.includes(x));
    this.save();
  }

  private save() {
    if (this.challenge && this.met && !this.solved.includes(this.challenge.id)) {
      this.solved = DDOS_CHALLENGES.map(c => c.id).filter(id => id === this.challenge!.id || this.solved.includes(id));
    }
    this.work?.set('ddos', { challenge: this.challenge?.id ?? null, method: this.method, bots: this.bots, on: this.on, solved: this.solved });
  }
}
