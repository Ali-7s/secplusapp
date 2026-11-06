import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { SSRF_GUARDS, SSRF_MISSIONS, SsrfGuard, SsrfMission, SsrfResult, SsrfTrial, preview, ssrfMissions } from './forgery';

interface Attempt { input: string; on: SsrfGuard[]; r: SsrfResult }
interface Saved { input: string; on: SsrfGuard[]; done: SsrfMission[]; trial: SsrfTrial; log: Attempt[] }

/** A link-preview box on a cloud server. Type addresses and make the server fetch what only it can reach. */
@Component({
  selector: 'app-ssrf',
  standalone: true,
  imports: [MatIconModule, FormsModule],
  template: `
    <section class="w" aria-label="Server-side request forgery lab">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">travel_explore</mat-icon> SSRF: the link preview box</div>
        <div class="count" aria-live="polite">{{ done.length }} of {{ missions.length }} missions</div>
      </header>
      <p class="intro">A chat app shows a preview of any link you paste. To build it, the app's server fetches the address itself, from inside the company's cloud network. Type addresses and see what the server will fetch for you.</p>

      <ol class="missions">
        @for (m of missions; track m.id) {
          <li [class.done]="done.includes(m.id)"><mat-icon aria-hidden="true">{{ done.includes(m.id) ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon> {{ m.text }}</li>
        }
      </ol>

      <details class="known">
        <summary><mat-icon aria-hidden="true">lightbulb</mat-icon> What you have found out so far</summary>
        <ul>
          <li>Cloud servers can ask a metadata service at <span class="mono">169.254.169.254</span> about themselves.</li>
          <li>An admin panel with no sign-in listens on the server itself, port <span class="mono">8080</span>.</li>
          <li>There is an HR portal at <span class="mono">10.0.5.12</span>, reachable only from the internal network.</li>
          <li>You own <span class="mono">evil.example</span>. It redirects wherever you say: <span class="mono">/redirect?to=</span>…</li>
          <li>Software accepts an IPv4 address written as one big number (127.0.0.1 is 2130706433), and <span class="mono">127.1</span> is short for 127.0.0.1.</li>
        </ul>
      </details>

      <div class="cols">
        <div class="panel">
          <form class="box" (ngSubmit)="fire()">
            <label class="lbl" for="ssrf-url">Paste a link</label>
            <div class="row">
              <input id="ssrf-url" name="url" class="mono" [(ngModel)]="input" (ngModelChange)="save()" placeholder="https://news.example/story" autocomplete="off" spellcheck="false" />
              <button type="submit" class="btn primary"><mat-icon aria-hidden="true">preview</mat-icon> Preview</button>
            </div>
          </form>
          @if (last; as a) {
            <div class="card" [class.ok]="a.r.ok" [class.no]="!a.r.ok" aria-live="polite">
              @if (a.r.hops.length) {
                <ol class="hops">
                  @for (h of a.r.hops; track $index) { <li class="mono">{{ h.url }}@if (h.ip) { <span class="ip"> → {{ h.ip }}</span> }</li> }
                </ol>
              }
              <div class="status"><strong>{{ a.r.status }}</strong></div>
              @for (l of a.r.lines; track $index) { <div class="mono line">{{ l }}</div> }
              @if (a.r.note) { <div class="note"><mat-icon aria-hidden="true">info</mat-icon> {{ a.r.note }}</div> }
            </div>
          }
        </div>
        <fieldset class="panel">
          <legend>The server's defences ({{ on.length }} on)</legend>
          @for (g of guards; track g.id) {
            <label class="opt" [class.on]="on.includes(g.id)">
              <input type="checkbox" [checked]="on.includes(g.id)" (change)="toggle(g.id)" />
              <span class="body"><span class="nm">{{ g.name }}</span><span class="sub">{{ g.detail }}</span></span>
            </label>
          }
        </fieldset>
      </div>

      @if (log.length > 1) {
        <div class="log-h"><span>Earlier tries</span><span class="spacer"></span><button type="button" class="btn ghost" (click)="reset()">Start over</button></div>
        <ol class="log compact">
          @for (a of earlier; track $index) {
            <li [class.ok]="a.r.ok" [class.no]="!a.r.ok"><button type="button" class="again mono" (click)="input = a.input; save()" [title]="'Put this address back in the box'">{{ a.input }}</button>
              <span class="defs">{{ a.r.status }}{{ a.on.length ? ' · ' + a.on.length + ' defence' + (a.on.length > 1 ? 's' : '') + ' on' : '' }}</span></li>
          }
        </ol>
      }

      @if (done.length === missions.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>All five.</strong> SSRF turns the server into your proxy inside the network. Block lists are easy to spell around; check the destination the server actually connects to, on every redirect, or only allow known sites.</span>
        </div>
      }
    </section>
  `,
  styleUrl: './forgery.component.scss',
})
export class SsrfComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly missions = SSRF_MISSIONS;
  readonly guards = SSRF_GUARDS;
  input = '';
  on: SsrfGuard[] = [];
  done: SsrfMission[] = [];
  trial: SsrfTrial = { news: false, metaStopped: false };
  log: Attempt[] = [];

  ngOnInit() {
    const s = this.work?.get<Saved>('ssrf');
    if (!s) return;
    const ok = <T extends string>(a: unknown, ids: T[]) => (Array.isArray(a) ? a : []).filter((x): x is T => ids.includes(x));
    this.input = typeof s.input === 'string' ? s.input : '';
    this.on = ok(s.on, SSRF_GUARDS.map(g => g.id));
    this.done = ok(s.done, SSRF_MISSIONS.map(m => m.id));
    this.trial = { news: !!s.trial?.news, metaStopped: !!s.trial?.metaStopped };
    // Results are recomputed rather than trusted from storage.
    this.log = (Array.isArray(s.log) ? s.log : []).filter(a => typeof a?.input === 'string').slice(-10)
      .map(a => { const on = ok(a.on, SSRF_GUARDS.map(g => g.id)); return { input: a.input, on, r: preview(a.input, on) }; });
  }

  get last() { return this.log[this.log.length - 1]; }
  get earlier() { return this.log.slice(0, -1).reverse(); }

  toggle(g: SsrfGuard) {
    this.on = this.on.includes(g) ? this.on.filter(x => x !== g) : SSRF_GUARDS.map(x => x.id).filter(x => x === g || this.on.includes(x));
    this.trial = { news: false, metaStopped: false };
    this.save();
  }

  fire() {
    const input = this.input.trim();
    if (!input) return;
    const m = ssrfMissions(input, this.on, this.trial);
    this.trial = m.trial;
    this.done = SSRF_MISSIONS.map(x => x.id).filter(id => m.done.includes(id) || this.done.includes(id));
    this.log = [...this.log, { input, on: [...this.on], r: preview(input, this.on) }].slice(-10);
    this.save();
  }

  reset() { this.on = []; this.done = []; this.trial = { news: false, metaStopped: false }; this.log = []; this.input = ''; this.work?.clear('ssrf'); }
  save() { this.work?.set('ssrf', { input: this.input, on: this.on, done: this.done, trial: this.trial, log: this.log.map(a => ({ input: a.input, on: a.on })) }); }
}
