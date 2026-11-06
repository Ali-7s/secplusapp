import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { CMDS, Cmd, CmdId, FIXES, FixId, Output, PRIV_MISSIONS, PRIV_START, PrivState, run, toggleFix, unlocked } from './privesc';

interface Entry { cmd: CmdId; fixes: FixId[]; out: Output }
interface Saved { s: PrivState; tab: 'server' | 'web'; log: Entry[] }

/** Start as an ordinary user, look around, find three ways to root and two web escalations, then close them all. */
@Component({
  selector: 'app-privesc',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="Privilege escalation lab">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">stairs</mat-icon> Privilege escalation lab</div>
        <div class="count" aria-live="polite">{{ s.done.length }} of {{ missions.length }} missions</div>
      </header>
      <p class="intro">You are signed in as <span class="mono">jo</span>, an ordinary user on a company server, and a customer of its web app. Run the commands to look around. Each finding unlocks something to try. Then switch on the fixes and try everything again.</p>

      <ol class="missions">
        @for (m of missions; track m.id) {
          <li [class.done]="s.done.includes(m.id)"><mat-icon aria-hidden="true">{{ s.done.includes(m.id) ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon> {{ m.text }}</li>
        }
      </ol>

      <div class="tabs" role="tablist" aria-label="Where to work">
        <button type="button" role="tab" class="tab" [class.on]="tab === 'server'" [attr.aria-selected]="tab === 'server'" (click)="setTab('server')"><mat-icon aria-hidden="true">dns</mat-icon> Server (shell as jo)</button>
        <button type="button" role="tab" class="tab" [class.on]="tab === 'web'" [attr.aria-selected]="tab === 'web'" (click)="setTab('web')"><mat-icon aria-hidden="true">language</mat-icon> Web app (signed in as jo)</button>
      </div>

      <div class="grid">
        <div class="cmds" role="tabpanel">
          <div class="c-h">Look around</div>
          @for (c of shown('look'); track c.id) { 
            <button type="button" class="cmd" [class.mono]="c.mono" [class.used]="s.ran.includes(c.id)" [attr.aria-disabled]="!open(c)" (click)="go(c)">
              <mat-icon aria-hidden="true">{{ open(c) ? (tab === 'server' ? 'terminal' : 'http') : 'lock' }}</mat-icon>
              <span>{{ c.label }} @if (!open(c)) { <span class="hint">{{ lockHint(c) }}</span> }</span>
            </button>
          }
          <div class="c-h">Try to escalate</div>
          @for (c of shown('try'); track c.id) {
            <button type="button" class="cmd try" [class.mono]="c.mono" [class.used]="s.ran.includes(c.id)" [attr.aria-disabled]="!open(c)" (click)="go(c)">
              <mat-icon aria-hidden="true">{{ open(c) ? 'bolt' : 'lock' }}</mat-icon>
              <span>{{ c.label }} @if (!open(c)) { <span class="hint">{{ lockHint(c) }}</span> }</span>
            </button>
          }
        </div>

        <fieldset class="fixes">
          <legend>Fixes ({{ s.fixes.length }} on)</legend>
          @for (f of fixes; track f.id) {
            <label class="opt" [class.on]="s.fixes.includes(f.id)">
              <input type="checkbox" [checked]="s.fixes.includes(f.id)" (change)="fix(f.id)" />
              <span><span class="nm">{{ f.name }}</span><span class="sub">{{ f.where === 'web' ? 'Web app: ' : 'Server: ' }}{{ f.detail }}</span></span>
            </label>
          }
        </fieldset>
      </div>

      <div class="log-h"><span>Output, newest first</span><span class="spacer"></span>
        @if (log.length || s.done.length) { <button type="button" class="btn ghost" (click)="reset()">Start over</button> }
      </div>
      <ol class="term" aria-live="polite">
        @if (!log.length) { <li class="empty">Nothing run yet. Start with <span class="mono">id</span> to see who you are.</li> }
        @for (e of recent; track $index) {
          <li [class]="'out ' + e.out.tone">
            <div class="prompt mono">{{ prompt(e.cmd) }} {{ label(e.cmd) }}</div>
            @for (l of e.out.lines; track $index) { <div class="mono line">{{ l }}</div> }
            @if (e.out.note) { <div class="note"><mat-icon aria-hidden="true">{{ e.out.tone === 'bad' ? 'warning' : 'info' }}</mat-icon> {{ e.out.note }}</div> }
          </li>
        }
      </ol>

      @if (s.done.length === missions.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>All seven.</strong> Escalation needs something privileged that a user can influence: a writable file, an over-generous rule, an unpatched flaw, or an app that trusts the request. Least privilege, patching and server-side checks close them.</span>
        </div>
      }
    </section>
  `,
  styleUrl: './privesc.component.scss',
})
export class PrivescComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly missions = PRIV_MISSIONS;
  readonly fixes = FIXES;
  s: PrivState = PRIV_START;
  tab: 'server' | 'web' = 'server';
  log: Entry[] = [];

  ngOnInit() {
    const v = this.work?.get<Saved>('privesc');
    if (!v?.s) return;
    const ids = (a: unknown, ok: string[]) => (Array.isArray(a) ? a : []).filter(x => ok.includes(x));
    const cmdIds = CMDS.map(c => c.id);
    this.s = {
      fixes: ids(v.s.fixes, FIXES.map(f => f.id)), ran: ids(v.s.ran, cmdIds), webAdmin: !!v.s.webAdmin,
      done: ids(v.s.done, PRIV_MISSIONS.map(m => m.id)), triedFixed: ids(v.s.triedFixed, cmdIds), webFixed: ids(v.s.webFixed, cmdIds),
    };
    if (v.tab === 'web') this.tab = 'web';
    this.log = Array.isArray(v.log) ? v.log.filter(e => cmdIds.includes(e?.cmd)).slice(-12) : [];
  }

  get recent() { return [...this.log].reverse(); }
  shown(kind: 'look' | 'try') { return CMDS.filter(c => c.where === this.tab && c.kind === kind); }
  open(c: Cmd) { return unlocked(this.s, c); }
  lockHint(c: Cmd) { return 'First run: ' + (c.needs ?? []).map(n => this.label(n)).join(', '); }
  label(id: CmdId) { return CMDS.find(c => c.id === id)!.label; }
  prompt(id: CmdId) {
    const c = CMDS.find(x => x.id === id)!;
    return c.where === 'web' ? '>' : c.mono ? 'jo@app-server:~$' : 'jo:';
  }

  setTab(t: 'server' | 'web') { this.tab = t; this.save(); }
  go(c: Cmd) {
    if (!this.open(c)) return;
    const r = run(this.s, c.id);
    this.s = r.s;
    this.log = [...this.log, { cmd: c.id, fixes: [...this.s.fixes], out: r.out }].slice(-12);
    this.save();
  }
  fix(f: FixId) { this.s = toggleFix(this.s, f); this.save(); }
  reset() { this.s = PRIV_START; this.log = []; this.work?.clear('privesc'); }
  private save() { this.work?.set('privesc', { s: this.s, tab: this.tab, log: this.log }); }
}
