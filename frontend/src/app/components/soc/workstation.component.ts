import { Component, NgZone, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Ev, hms } from './engine/events';
import { CheckResult, Ticket, checkScript, checkSiem, checkTerminal, markTicket, taskPoints } from './engine/grade';
import { Shift } from './engine/model';
import { Shell } from './engine/shell';
import { SiemRange, SiemResult } from './engine/siem';
import { shiftById } from './engine/shifts';
import { World, buildWorld, countBy, shellFor } from './engine/world';
import { ShiftSave, ShiftScreen, SocStore, TermLine } from './soc-store';
import { SocTerminalComponent } from './terminal.component';
import { SocSiemComponent } from './siem.component';
import { SocAlertsComponent } from './alerts.component';
import { SocTasksComponent } from './tasks.component';

type Pane = 'alerts' | 'tasks' | 'terminal' | 'siem';

const SPEEDS = [1, 10, 30, 60];
const TICK_MS = 500;

/**
 * One shift at the SOC: the clock, the alert queue, the tasks, the terminal and the SIEM side by side, and the
 * debrief at the end. Progress (tickets, tasks, your files, the clock) is saved and synced; the screen is per device.
 */
@Component({
  selector: 'app-soc-workstation',
  standalone: true,
  imports: [MatIconModule, RouterLink, SocTerminalComponent, SocSiemComponent, SocAlertsComponent, SocTasksComponent],
  templateUrl: './workstation.component.html',
  styleUrl: './workstation.component.scss',
})
export class SocWorkstationComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(SocStore);
  private zone = inject(NgZone);

  @ViewChild(SocSiemComponent) siem?: SocSiemComponent;

  readonly speeds = SPEEDS;
  readonly hms = hms;
  shift!: Shift;
  world!: World;
  shell!: Shell;
  save!: ShiftSave;
  screen: ShiftScreen = {};
  ready = false;

  now = signal(0);
  running = signal(false);
  speed = 10;
  left: 'alerts' | 'tasks' = 'alerts';
  right: 'terminal' | 'siem' = 'terminal';
  focusCol: 'left' | 'right' = 'left';
  openId: string | null = null;
  results: Record<string, CheckResult> = {};
  toast = signal<{ text: string; kind: 'alert' | 'task' | 'info' } | null>(null);
  showDebrief = false;
  confirmRestart = false;

  private timer?: ReturnType<typeof setInterval>;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private lastSave = 0;
  private seenAlerts = 0;

  readonly visibleAlerts = computed(() => this.shift.alerts.filter(a => a.t <= this.now()).sort((a, b) => b.t - a.t));
  readonly waitingAlerts = computed(() => this.shift.alerts.filter(a => a.t > this.now()).length);
  readonly nextAlert = computed(() => this.shift.alerts.filter(a => a.t > this.now()).sort((a, b) => a.t - b.t)[0]);
  readonly ended = computed(() => this.now() >= this.shift.end);
  readonly progressPct = computed(() => Math.min(100, ((this.now() - this.shift.start) * 100) / (this.shift.end - this.shift.start)));

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const shift = shiftById(id);
    if (!shift) { this.router.navigate(['/soc']); return; }
    this.shift = shift;
    this.init();
    this.zone.runOutsideAngular(() => { this.timer = setInterval(() => this.tick(), TICK_MS); });
    document.addEventListener('visibilitychange', this.onHide);
  }

  private init() {
    const s = this.shift;
    const saved = this.store.load(s.id);
    this.save = { clock: s.start, tickets: {}, tasks: {}, ...saved };
    if (!this.save.clock || this.save.clock < s.start) this.save.clock = s.start;
    this.save.clock = Math.min(this.save.clock, s.end);
    const clock = { now: this.save.clock };
    this.world = buildWorld(s, clock);
    this.world.vfs.restoreUserFiles(this.save.files);
    this.shell = shellFor(this.world);
    this.screen = this.store.screen(s.id);
    this.left = this.screen.left ?? 'alerts';
    this.right = this.screen.right ?? 'terminal';
    this.openId = this.screen.open ?? null;
    this.speed = SPEEDS.includes(this.screen.speed ?? 0) ? this.screen.speed! : 10;
    this.now.set(this.save.clock);
    this.running.set(false);
    this.results = {};
    this.seenAlerts = this.visibleAlerts().length;
    this.showDebrief = !!this.save.ended;
    this.ready = true;
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    document.removeEventListener('visibilitychange', this.onHide);
    if (this.ready) this.persist();
  }

  private onHide = () => { if (document.visibilityState === 'hidden' && this.ready) this.persist(); };

  // ── Clock ───────────────────────────────────────────────────────────────

  private tick() {
    if (!this.running()) return;
    this.zone.run(() => this.setClock(this.now() + (TICK_MS / 1000) * this.speed));
  }

  private setClock(t: number) {
    const v = Math.min(this.shift.end, t);
    this.world.clock.now = v;
    this.now.set(v);
    if (v >= this.shift.end) {
      this.running.set(false);
      this.say('The shift is over. Finish your tickets, then open the debrief.', 'info');
    }
    const n = this.visibleAlerts().length;
    if (n > this.seenAlerts) {
      const a = this.visibleAlerts()[0];
      this.say(`New ${a.severity} alert: ${a.rule}`, 'alert');
      this.seenAlerts = n;
    }
    if (Date.now() - this.lastSave > 10_000) this.persist();
  }

  play() {
    if (this.ended()) return;
    this.save.started = true;
    this.running.set(true);
  }

  pause() {
    this.running.set(false);
    this.persist();
  }

  setSpeed(s: number) {
    this.speed = s;
    this.saveScreen();
  }

  skipToNext() {
    const a = this.nextAlert();
    if (!a) return;
    this.save.started = true;
    this.setClock(a.t);
    this.persist();
  }

  skipToEnd() {
    this.save.started = true;
    this.setClock(this.shift.end);
    this.persist();
  }

  // ── Panes ───────────────────────────────────────────────────────────────

  pane(p: Pane) {
    if (p === 'alerts' || p === 'tasks') { this.left = p; this.focusCol = 'left'; }
    else { this.right = p; this.focusCol = 'right'; }
    this.saveScreen();
  }

  isPane(p: Pane) {
    return p === 'alerts' || p === 'tasks' ? this.focusCol === 'left' && this.left === p : this.focusCol === 'right' && this.right === p;
  }

  investigate(q: string) {
    this.pane('siem');
    queueMicrotask(() => this.siem?.setQuery(q));
  }

  setOpen(id: string | null) {
    this.openId = id;
    this.saveScreen();
  }

  // ── Live traffic ────────────────────────────────────────────────────────

  readonly recent = computed<Ev[]>(() => {
    const n = countBy(this.world.events, this.now());
    return this.world.events.slice(Math.max(0, n - 4), n).reverse();
  });

  readonly rates = computed(() => {
    const t = this.now();
    return this.shift.sources.map(src => {
      const list = this.world.bySource.get(src) ?? [];
      const n = countBy(list, t) - countBy(list, t - 300);
      return { src, perMin: Math.round(n / 5) };
    });
  });

  readonly totalEvents = computed(() => countBy(this.world.events, this.now()));

  // ── Tickets and tasks ───────────────────────────────────────────────────

  onTicket(e: { id: string; ticket: Ticket }) {
    this.save.tickets = { ...this.save.tickets, [e.id]: e.ticket };
    if (e.ticket.submitted) {
      const a = this.shift.alerts.find(x => x.id === e.id)!;
      const m = markTicket(a, e.ticket);
      this.say(`Ticket submitted: ${m.points} of ${m.max} points.`, 'info');
    }
    this.persist();
  }

  private openTasks(where: 'terminal' | 'siem') {
    return this.shift.tasks.filter(t => t.where === where && !t.script && !this.save.tasks[t.id]?.done && t.after <= this.now());
  }

  private done(id: string) {
    const t = this.shift.tasks.find(x => x.id === id)!;
    this.save.tasks = { ...this.save.tasks, [id]: { ...this.save.tasks[id], done: true } };
    this.say(`Task done: ${t.ask}`, 'task');
    this.persist();
  }

  onRan(e: { line: string; out: string }) {
    for (const t of this.openTasks('terminal')) if (checkTerminal(this.world, t, e.out)) this.done(t.id);
  }

  onSearched(e: { query: string; result: SiemResult; range: SiemRange }) {
    for (const t of this.openTasks('siem')) if (checkSiem(this.world, t, e.result, e.range)) this.done(t.id);
  }

  onReveal(id: string) {
    this.save.tasks = { ...this.save.tasks, [id]: { ...this.save.tasks[id], revealed: true } };
    this.persist();
  }

  onCheckScript(id: string) {
    const t = this.shift.tasks.find(x => x.id === id)!;
    const r = checkScript(this.world, t);
    this.results = { ...this.results, [id]: r };
    if (r.ok) this.done(id);
  }

  onFiles() {
    this.persist();
  }

  // ── Score ───────────────────────────────────────────────────────────────

  readonly maxScore = computed(() =>
    this.shift.alerts.reduce((s, a) => s + 4 + a.questions.length, 0) + this.shift.tasks.length * 2);

  score() {
    let pts = 0;
    for (const a of this.shift.alerts) {
      const t = this.save.tickets[a.id];
      if (t?.submitted) pts += markTicket(a, t).points;
    }
    for (const t of this.shift.tasks) pts += taskPoints(this.save.tasks[t.id]);
    return pts;
  }

  evidenceOf(m: { answers: Record<string, boolean> }) { return Object.values(m.answers).filter(Boolean).length; }

  tasksDone() { return this.shift.tasks.filter(t => this.save.tasks[t.id]?.done).length; }
  openAlertCount() { return this.visibleAlerts().filter(a => !this.save.tickets[a.id]?.submitted).length; }
  submittedCount() { return this.shift.alerts.filter(a => this.save.tickets[a.id]?.submitted).length; }

  alertRows() {
    return [...this.shift.alerts].sort((a, b) => a.t - b.t).map(a => {
      const t = this.save.tickets[a.id];
      const m = t?.submitted ? markTicket(a, t) : null;
      return { a, m, arrived: a.t <= this.now() };
    });
  }

  endShift() {
    this.running.set(false);
    const s = this.score();
    this.save.ended = true;
    this.save.best = Math.max(this.save.best ?? 0, s);
    this.showDebrief = true;
    this.persist();
  }

  restart() {
    this.confirmRestart = false;
    this.store.reset(this.shift.id);
    // Take the panes down and build them again, so the terminal and SIEM start fresh too.
    this.ready = false;
    setTimeout(() => {
      this.init();
      this.say('The shift has started again from the beginning. Your best score is kept.', 'info');
    });
  }

  // ── Saving ──────────────────────────────────────────────────────────────

  private persist() {
    this.lastSave = Date.now();
    this.save.clock = Math.floor(this.now());
    this.save.files = this.world.vfs.userFiles();
    this.store.save(this.shift.id, this.save);
  }

  private saveScreen() {
    this.screen = { ...this.screen, left: this.left, right: this.right, open: this.openId, speed: this.speed };
    this.store.saveScreen(this.shift.id, this.screen);
  }

  onTermChange(t: { lines: TermLine[]; history: string[]; cwd: string }) {
    this.screen = { ...this.screen, term: { lines: t.lines.slice(-400), history: t.history, cwd: t.cwd } };
    this.store.saveScreen(this.shift.id, this.screen);
  }

  onSiemChange(s: { query: string; range: string }) {
    this.screen = { ...this.screen, siem: s };
    this.store.saveScreen(this.shift.id, this.screen);
  }

  hideBrief() {
    this.screen = { ...this.screen, brief: false };
    this.store.saveScreen(this.shift.id, this.screen);
  }

  showBrief() {
    this.screen = { ...this.screen, brief: true };
    this.store.saveScreen(this.shift.id, this.screen);
  }

  get briefOpen() { return this.screen.brief !== false; }

  private say(text: string, kind: 'alert' | 'task' | 'info') {
    this.toast.set({ text, kind });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 6000);
  }
}
