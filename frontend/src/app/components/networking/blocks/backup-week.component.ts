import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';

type Strategy = 'full' | 'incremental' | 'differential';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_GB = 600;
const CHANGE_GB = 40;
/** Restore and backup speed, GB per hour. */
const SPEED = 200;

const STRATEGIES: { id: Strategy; label: string; note: string }[] = [
  { id: 'full', label: 'Full every night', note: 'Every night copies everything.' },
  { id: 'incremental', label: 'Full Sunday + incrementals', note: 'Each night copies only what changed since the night before.' },
  { id: 'differential', label: 'Full Sunday + differentials', note: 'Each night copies everything that changed since Sunday\'s full.' },
];

interface Night { day: string; kind: 'Full' | 'Incremental' | 'Differential'; gb: number; order: number; after: boolean }

/**
 * A week of nightly backups at 23:00. Choose a strategy and the day the server dies (at 15:00), and see which
 * backup sets have to be restored, in what order, how long that takes, and what each strategy costs in storage.
 */
@Component({
  selector: 'app-backup-week',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="Backup week simulator">
      <header class="head"><div class="title"><mat-icon aria-hidden="true">backup</mat-icon> Backup week simulator</div></header>
      <p class="intro">A file server holds {{ full }} GB, and about {{ change }} GB of it changes each day. Backups run every night at 23:00.
        Pick a strategy and the day the server's disks fail, at 15:00.</p>

      <div class="pick" role="radiogroup" aria-label="Backup strategy">
        @for (s of strategies; track s.id) {
          <button type="button" role="radio" [attr.aria-checked]="strategy === s.id" [class.on]="strategy === s.id" (click)="setStrategy(s.id)">
            <strong>{{ s.label }}</strong><small>{{ s.note }}</small>
          </button>
        }
      </div>

      <div class="fail" role="radiogroup" aria-label="Day the server fails">
        <span class="lbl">Fails on</span>
        @for (d of days; track d; let i = $index) {
          @if (i > 0) {
            <button type="button" role="radio" [attr.aria-checked]="failDay === i" [class.on]="failDay === i" (click)="setFail(i)">{{ d }}</button>
          }
        }
      </div>

      <ol class="week" aria-label="This week's backups">
        @for (n of nights; track $index; let i = $index) {
          <li [class.used]="n.order > 0" [class.after]="n.after">
            <span class="d">{{ n.day }}@if (i === failDay) { <mat-icon class="bolt" aria-label="Fails here at 15:00">bolt</mat-icon> }</span>
            <span class="bar-wrap"><span class="bar" [style.height.%]="100 * n.gb / full"></span></span>
            <span class="k"><span class="long">{{ n.kind }}</span><span class="short" aria-hidden="true">{{ n.kind.slice(0, 4) }}</span></span>
            <span class="gb">{{ n.gb }} GB</span>
            @if (n.order > 0) { <span class="ord" [attr.aria-label]="'Restore step ' + n.order">{{ n.order }}</span> }
            @else if (n.after) { <span class="never">after the failure</span> }
          </li>
        }
      </ol>

      <div class="stats">
        <div class="stat"><span class="s-l">To restore</span><span class="s-v">{{ restoreList }}</span></div>
        <div class="stat"><span class="s-l">Restore time</span><span class="s-v">{{ restoreGb }} GB ≈ {{ hours(restoreGb) }}</span></div>
        <div class="stat"><span class="s-l">Data lost</span><span class="s-v">16 hours of changes (23:00 last night to 15:00)</span></div>
        <div class="stat"><span class="s-l">Stored per week</span><span class="s-v">{{ weekGb }} GB</span></div>
        <div class="stat"><span class="s-l">Longest nightly backup</span><span class="s-v">{{ hours(longestGb) }}</span></div>
      </div>
      <p class="note"><mat-icon aria-hidden="true">lightbulb</mat-icon> <span>{{ lesson }}</span></p>
    </section>
  `,
  styleUrl: './backup-week.component.scss',
})
export class BackupWeekComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly strategies = STRATEGIES;
  readonly days = DAYS;
  readonly full = FULL_GB;
  readonly change = CHANGE_GB;

  strategy: Strategy = 'incremental';
  failDay = 4;
  nights: Night[] = [];

  ngOnInit() {
    const saved = this.work?.get<{ strategy: Strategy; failDay: number }>('backups');
    if (saved && STRATEGIES.some(s => s.id === saved.strategy)) this.strategy = saved.strategy;
    if (saved && saved.failDay >= 1 && saved.failDay <= 6) this.failDay = saved.failDay;
    this.build();
  }

  setStrategy(s: Strategy) { this.strategy = s; this.save(); }
  setFail(d: number) { this.failDay = d; this.save(); }

  private save() {
    this.work?.set('backups', { strategy: this.strategy, failDay: this.failDay });
    this.build();
  }

  private build() {
    const last = this.failDay - 1;
    this.nights = DAYS.map((day, i) => {
      const kind = i === 0 || this.strategy === 'full' ? 'Full' : this.strategy === 'incremental' ? 'Incremental' : 'Differential';
      const gb = kind === 'Full' ? FULL_GB : kind === 'Incremental' ? CHANGE_GB : CHANGE_GB * i;
      return { day, kind, gb, order: 0, after: i > last };
    });
    // Which sets the restore needs, in order.
    const needed = this.strategy === 'full' ? [last]
      : this.strategy === 'incremental' ? Array.from({ length: last + 1 }, (_, i) => i)
      : last === 0 ? [0] : [0, last];
    needed.forEach((n, k) => (this.nights[n].order = k + 1));
  }

  private get used(): Night[] { return this.nights.filter(n => n.order > 0).sort((a, b) => a.order - b.order); }
  get restoreList(): string { return this.used.map(n => `${n.day} ${n.kind.toLowerCase()}`).join(', then '); }
  get restoreGb(): number { return this.used.reduce((s, n) => s + n.gb, 0); }
  get weekGb(): number { return this.nights.reduce((s, n) => s + n.gb, 0); }
  get longestGb(): number { return Math.max(...this.nights.map(n => n.gb)); }

  get lesson(): string {
    const n = this.used.length;
    if (this.strategy === 'full') return 'Fastest restore, always one set, but every night copies everything: the most storage and the longest backup window.';
    if (this.strategy === 'incremental') return `Smallest, fastest backups each night, but the restore needs the full plus every incremental since, in order (${n} sets here). Lose one and the chain breaks.`;
    return 'Each night\'s differential grows until the next full, but a restore only ever needs two sets: the full and the latest differential.';
  }

  hours(gb: number): string {
    const h = gb / SPEED;
    return h < 1 ? `${Math.round(h * 60)} minutes` : `${+h.toFixed(1)} hours`;
  }
}
