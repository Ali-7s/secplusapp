import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { GUARDS, GuardId, ITEMS, ItemId, REPLAY_MISSIONS, ReplayMission, TARGETS, TargetId, missionsFor, replay } from './replay';

interface Attempt { item: ItemId; target: TargetId; on: GuardId[]; ok: boolean; text: string; note?: string }
interface Saved { item: ItemId; target: TargetId; on: GuardId[]; done: ReplayMission[]; mfaWins: ItemId[]; log: Attempt[] }

/** Replay captured credentials against real-looking services, then find the defence that stops each. */
@Component({
  selector: 'app-replay',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="Credential replay console">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">replay</mat-icon> Credential replay console</div>
        <div class="count" aria-live="polite">{{ done.length }} of {{ missions.length }} missions</div>
      </header>
      <p class="intro">You have captured three things, but no passwords. Pick what to replay and where, then press Replay. Afterwards, switch on defences and find what really stops each one.</p>

      <ol class="missions">
        @for (m of missions; track m.id) {
          <li [class.done]="done.includes(m.id)"><mat-icon aria-hidden="true">{{ done.includes(m.id) ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon> {{ m.text }}</li>
        }
      </ol>

      <div class="cols">
        <fieldset class="panel">
          <legend>1. What you captured</legend>
          @for (i of items; track i.id) {
            <label class="opt" [class.on]="item === i.id">
              <input type="radio" name="replay-item" [checked]="item === i.id" (change)="item = i.id; save()" />
              <mat-icon aria-hidden="true">{{ i.icon }}</mat-icon>
              <span><span class="nm">{{ i.name }}</span><span class="sub">{{ i.from }}</span></span>
            </label>
          }
        </fieldset>
        <fieldset class="panel">
          <legend>2. Where to replay it</legend>
          @for (t of targets; track t.id) {
            <label class="opt" [class.on]="target === t.id">
              <input type="radio" name="replay-target" [checked]="target === t.id" (change)="target = t.id; save()" />
              <span><span class="nm">{{ t.name }}</span><span class="sub">{{ t.how }}</span></span>
            </label>
          }
          <button type="button" class="btn primary go" (click)="fire()"><mat-icon aria-hidden="true">send</mat-icon> Replay</button>
        </fieldset>
        <fieldset class="panel">
          <legend>Defences ({{ on.length }} on)</legend>
          @for (g of guards; track g.id) {
            <label class="opt" [class.on]="on.includes(g.id)">
              <input type="checkbox" [checked]="on.includes(g.id)" (change)="toggle(g.id)" />
              <span><span class="nm">{{ g.name }}</span><span class="sub">{{ g.detail }}</span></span>
            </label>
          }
        </fieldset>
      </div>

      @if (log.length) {
        <div class="log-h"><span>Attempts, newest first</span><span class="spacer"></span><button type="button" class="btn ghost" (click)="reset()">Start over</button></div>
        <ol class="log" aria-live="polite">
          @for (a of recent; track $index) {
            <li [class.ok]="a.ok" [class.no]="!a.ok">
              <div class="a-h"><mat-icon aria-hidden="true">{{ a.ok ? 'lock_open' : 'block' }}</mat-icon>
                <strong>{{ itemName(a.item) }} → {{ targetName(a.target) }}</strong>
                <span class="defs">{{ a.on.length ? 'with ' + guardNames(a.on) : 'no defences' }}</span></div>
              <div>{{ a.text }}</div>
              @if (a.note) { <div class="note"><mat-icon aria-hidden="true">info</mat-icon> {{ a.note }}</div> }
            </li>
          }
        </ol>
      }

      @if (done.length === missions.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>All seven.</strong> MFA protects the moment of sign-in; replay reuses what comes after it. Stop the theft (Credential Guard, encryption), or make the captured thing useless (no NTLM, bound sessions, nonces).</span>
        </div>
      }
    </section>
  `,
  styleUrl: './replay.component.scss',
})
export class ReplayComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly missions = REPLAY_MISSIONS;
  readonly items = ITEMS;
  readonly targets = TARGETS;
  readonly guards = GUARDS;

  item: ItemId = 'hash';
  target: TargetId = 'fs';
  on: GuardId[] = [];
  done: ReplayMission[] = [];
  mfaWins: ItemId[] = [];
  log: Attempt[] = [];

  ngOnInit() {
    const s = this.work?.get<Saved>('replay');
    if (!s) return;
    if (ITEMS.some(i => i.id === s.item)) this.item = s.item;
    if (TARGETS.some(t => t.id === s.target)) this.target = s.target;
    this.on = (s.on ?? []).filter(g => GUARDS.some(x => x.id === g));
    this.done = (s.done ?? []).filter(id => REPLAY_MISSIONS.some(m => m.id === id));
    this.mfaWins = (s.mfaWins ?? []).filter(id => ITEMS.some(i => i.id === id));
    this.log = Array.isArray(s.log) ? s.log.slice(-20) : [];
  }

  get recent() { return [...this.log].reverse(); }
  itemName(id: ItemId) { return ITEMS.find(i => i.id === id)!.name; }
  targetName(id: TargetId) { return TARGETS.find(t => t.id === id)!.name; }
  guardNames(ids: GuardId[]) { return ids.map(id => GUARDS.find(g => g.id === id)!.name).join(', '); }

  toggle(g: GuardId) {
    this.on = this.on.includes(g) ? this.on.filter(x => x !== g) : GUARDS.map(x => x.id).filter(x => x === g || this.on.includes(x));
    // The MFA mission is about MFA alone, so changing defences starts that count again.
    this.mfaWins = [];
    this.save();
  }

  fire() {
    const r = replay(this.item, this.target, this.on);
    const m = missionsFor(this.item, this.target, this.on, this.mfaWins);
    this.mfaWins = m.mfaWins;
    this.done = REPLAY_MISSIONS.map(x => x.id).filter(id => m.done.includes(id) || this.done.includes(id));
    this.log = [...this.log, { item: this.item, target: this.target, on: [...this.on], ok: r.ok, text: r.text, note: r.note }].slice(-20);
    this.save();
  }

  reset() {
    this.done = []; this.mfaWins = []; this.log = []; this.on = [];
    this.work?.clear('replay');
  }

  save() { this.work?.set('replay', { item: this.item, target: this.target, on: this.on, done: this.done, mfaWins: this.mfaWins, log: this.log }); }
}
