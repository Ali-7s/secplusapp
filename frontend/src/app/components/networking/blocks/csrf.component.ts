import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { CSRF_GUARDS, CSRF_MISSIONS, CsrfGuard, CsrfMission, PAYLOADS, PayloadId, csrf, csrfMissions } from './forgery';

interface Attempt { p: PayloadId; on: CsrfGuard[]; ok: boolean; text: string }
interface Saved { p: PayloadId; on: CsrfGuard[]; done: CsrfMission[]; stopped: PayloadId[]; log: Attempt[] }

/** Write the attacker's page, let Sam open it while signed in to the bank, and find what really stops it. */
@Component({
  selector: 'app-csrf',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="Cross-site request forgery lab">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">move_up</mat-icon> CSRF: forge Sam's bank transfer</div>
        <div class="count" aria-live="polite">{{ done.length }} of {{ missions.length }} missions</div>
      </header>
      <p class="intro">Sam is signed in to bank.example in one tab. You run prizes.example. Choose what to put on your page, then send Sam there. You never see Sam's password or cookie: Sam's own browser does the work.</p>

      <ol class="missions">
        @for (m of missions; track m.id) {
          <li [class.done]="done.includes(m.id)"><mat-icon aria-hidden="true">{{ done.includes(m.id) ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon> {{ m.text }}</li>
        }
      </ol>

      <div class="cols">
        <fieldset class="panel">
          <legend>Your page on prizes.example</legend>
          @for (x of payloads; track x.id) {
            <label class="opt" [class.on]="p === x.id">
              <input type="radio" name="csrf-payload" [checked]="p === x.id" (change)="p = x.id; save()" />
              <span class="body"><span class="nm">{{ x.name }}</span><span class="sub">{{ x.how }}</span>
                @if (p === x.id) { <pre class="code mono">{{ x.code }}</pre> }</span>
            </label>
          }
          <button type="button" class="btn primary go" (click)="fire()"><mat-icon aria-hidden="true">send</mat-icon> Send Sam to your page</button>
        </fieldset>
        <fieldset class="panel">
          <legend>The bank's defences ({{ on.length }} on)</legend>
          @for (g of guards; track g.id) {
            <label class="opt" [class.on]="on.includes(g.id)">
              <input type="checkbox" [checked]="on.includes(g.id)" (change)="toggle(g.id)" />
              <span class="body"><span class="nm">{{ g.name }}</span><span class="sub">{{ g.detail }}</span></span>
            </label>
          }
        </fieldset>
      </div>

      @if (log.length) {
        <div class="log-h"><span>What happened, newest first</span><span class="spacer"></span><button type="button" class="btn ghost" (click)="reset()">Start over</button></div>
        <ol class="log" aria-live="polite">
          @for (a of recent; track $index) {
            <li [class.ok]="a.ok" [class.no]="!a.ok">
              <div class="a-h"><mat-icon aria-hidden="true">{{ a.ok ? 'payments' : 'block' }}</mat-icon><strong>{{ name(a.p) }}</strong>
                <span class="defs">{{ a.on.length ? 'with ' + guardNames(a.on) : 'no defences' }}</span></div>
              <div>{{ a.text }}</div>
            </li>
          }
        </ol>
      }

      @if (done.length === missions.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>All five.</strong> CSRF works because the browser adds Sam's cookie to requests that another site started. A secret token the attacker cannot read, or a fresh confirmation from Sam, breaks it.</span>
        </div>
      }
    </section>
  `,
  styleUrl: './forgery.component.scss',
})
export class CsrfComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly missions = CSRF_MISSIONS;
  readonly payloads = PAYLOADS;
  readonly guards = CSRF_GUARDS;
  p: PayloadId = 'img';
  on: CsrfGuard[] = [];
  done: CsrfMission[] = [];
  stopped: PayloadId[] = [];
  log: Attempt[] = [];

  ngOnInit() {
    const s = this.work?.get<Saved>('csrf');
    if (!s) return;
    const ok = <T extends string>(a: unknown, ids: T[]) => (Array.isArray(a) ? a : []).filter((x): x is T => ids.includes(x));
    const pids = PAYLOADS.map(x => x.id);
    if (pids.includes(s.p)) this.p = s.p;
    this.on = ok(s.on, CSRF_GUARDS.map(g => g.id));
    this.done = ok(s.done, CSRF_MISSIONS.map(m => m.id));
    this.stopped = ok(s.stopped, pids);
    this.log = Array.isArray(s.log) ? s.log.filter(a => pids.includes(a?.p)).slice(-12) : [];
  }

  get recent() { return [...this.log].reverse(); }
  name(id: PayloadId) { return PAYLOADS.find(x => x.id === id)!.name; }
  guardNames(ids: CsrfGuard[]) { return ids.map(id => CSRF_GUARDS.find(g => g.id === id)!.name).join(', '); }

  toggle(g: CsrfGuard) {
    this.on = this.on.includes(g) ? this.on.filter(x => x !== g) : CSRF_GUARDS.map(x => x.id).filter(x => x === g || this.on.includes(x));
    this.stopped = [];
    this.save();
  }

  fire() {
    const r = csrf(this.p, this.on);
    const m = csrfMissions(this.p, this.on, this.stopped);
    this.stopped = m.stopped;
    this.done = CSRF_MISSIONS.map(x => x.id).filter(id => m.done.includes(id) || this.done.includes(id));
    this.log = [...this.log, { p: this.p, on: [...this.on], ok: r.ok, text: r.text }].slice(-12);
    this.save();
  }

  reset() { this.on = []; this.done = []; this.stopped = []; this.log = []; this.work?.clear('csrf'); }
  save() { this.work?.set('csrf', { p: this.p, on: this.on, done: this.done, stopped: this.stopped, log: this.log }); }
}
