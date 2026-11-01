import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';

export type MetricId = 'AV' | 'AC' | 'PR' | 'UI' | 'S' | 'C' | 'I' | 'A';
export type Vector = Record<MetricId, string>;

interface Metric {
  id: MetricId;
  name: string;
  ask: string;
  values: { v: string; l: string; tip: string }[];
}

const CIA = (what: string): Metric['values'] => [
  { v: 'H', l: 'High', tip: `Total loss of ${what}, or a serious loss of the most important part` },
  { v: 'L', l: 'Low', tip: `Some loss of ${what}, limited in what the attacker can reach` },
  { v: 'N', l: 'None', tip: `No loss of ${what}` },
];

export const METRICS: Metric[] = [
  { id: 'AV', name: 'Attack vector', ask: 'From where can the attacker exploit it?', values: [
    { v: 'N', l: 'Network', tip: 'From anywhere that can reach it, including the internet' },
    { v: 'A', l: 'Adjacent', tip: 'Only from the same local network or Bluetooth range' },
    { v: 'L', l: 'Local', tip: 'Only with a session on the machine, or by tricking its user into opening a file' },
    { v: 'P', l: 'Physical', tip: 'Only by touching the device' },
  ] },
  { id: 'AC', name: 'Attack complexity', ask: 'Does it need conditions the attacker cannot control?', values: [
    { v: 'L', l: 'Low', tip: 'It works every time' },
    { v: 'H', l: 'High', tip: 'It needs a race condition, a man-in-the-middle position or other preparation' },
  ] },
  { id: 'PR', name: 'Privileges required', ask: 'What account does the attacker need first?', values: [
    { v: 'N', l: 'None', tip: 'No account at all' },
    { v: 'L', l: 'Low', tip: 'An ordinary user account' },
    { v: 'H', l: 'High', tip: 'An administrator account' },
  ] },
  { id: 'UI', name: 'User interaction', ask: 'Does someone else have to do something?', values: [
    { v: 'N', l: 'None', tip: 'The attacker does it alone' },
    { v: 'R', l: 'Required', tip: 'A user must click, open or visit something' },
  ] },
  { id: 'S', name: 'Scope', ask: 'Can it affect things beyond the vulnerable component?', values: [
    { v: 'U', l: 'Unchanged', tip: 'Only the vulnerable component and what it controls' },
    { v: 'C', l: 'Changed', tip: 'It breaks out to other components, such as a browser user or the host under a VM' },
  ] },
  { id: 'C', name: 'Confidentiality', ask: 'Can the attacker read data?', values: CIA('confidentiality') },
  { id: 'I', name: 'Integrity', ask: 'Can the attacker change data?', values: CIA('integrity') },
  { id: 'A', name: 'Availability', ask: 'Can the attacker stop it working?', values: CIA('availability') },
];

const AV: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC: Record<string, number> = { L: 0.77, H: 0.44 };
const UI: Record<string, number> = { N: 0.85, R: 0.62 };
const IMPACT: Record<string, number> = { H: 0.56, L: 0.22, N: 0 };

/** CVSS 3.1's own rounding: up to one decimal place, done in integers to avoid floating-point surprises. */
function roundUp(x: number): number {
  const i = Math.round(x * 100000);
  return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10;
}

/** The CVSS 3.1 base score, exactly as the specification computes it. */
export function cvssScore(v: Vector): number {
  const changed = v.S === 'C';
  const pr = v.PR === 'N' ? 0.85 : v.PR === 'L' ? (changed ? 0.68 : 0.62) : (changed ? 0.5 : 0.27);
  const iss = 1 - (1 - IMPACT[v.C]) * (1 - IMPACT[v.I]) * (1 - IMPACT[v.A]);
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
  const exploitability = 8.22 * AV[v.AV] * AC[v.AC] * pr * UI[v.UI];
  if (impact <= 0) return 0;
  return roundUp(Math.min((changed ? 1.08 : 1) * (impact + exploitability), 10));
}

export function severity(score: number): 'None' | 'Low' | 'Medium' | 'High' | 'Critical' {
  if (score === 0) return 'None';
  if (score < 4) return 'Low';
  if (score < 7) return 'Medium';
  if (score < 9) return 'High';
  return 'Critical';
}

export const vectorString = (v: Vector) => 'CVSS:3.1/' + METRICS.map(m => `${m.id}:${v[m.id]}`).join('/');

export interface CvssTask {
  name: string;
  story: string;
  target: Vector;
  /** Why each metric has its value, shown when that metric is set wrong. */
  why: Record<MetricId, string>;
}

const vec = (s: string): Vector => Object.fromEntries(s.split('/').map(p => p.split(':'))) as Vector;

export const CVSS_TASKS: CvssTask[] = [
  {
    name: 'Logging library runs attacker code',
    story: 'A logging library used by an internet-facing web app runs code from any text it logs. An attacker with no account sends one crafted request header, nobody has to click anything, and the code runs on the server with full control, from where it can reach other systems. (This is how Log4Shell worked in 2021.)',
    target: vec('AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H'),
    why: {
      AV: 'One request over the internet is enough, so the vector is Network.',
      AC: 'It works every time with one crafted header: Low complexity.',
      PR: 'The attacker has no account: None.',
      UI: 'Nobody has to click or open anything: None.',
      S: 'The code escapes the logging library and takes over the server and what it can reach, so scope is Changed.',
      C: 'Full control of the server means all its data can be read: High.',
      I: 'The attacker can change anything on the server: High.',
      A: 'The attacker can shut the server down: High.',
    },
  },
  {
    name: 'Script stored in a forum post',
    story: 'Any signed-in member of a company forum can put a script in a post. When another member views the post, the script runs in their browser and can read or change some of what that page shows them, but cannot crash the forum.',
    target: vec('AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N'),
    why: {
      AV: 'The attacker posts over the network: Network.',
      AC: 'Posting the script works every time: Low.',
      PR: 'Only signed-in members can post, so an ordinary account is needed: Low.',
      UI: 'Another member has to view the post: Required.',
      S: 'The flaw is in the forum, but the script runs in the victim\'s browser, another component: Changed.',
      C: 'It can read some of what the victim\'s page shows: Low.',
      I: 'It can change some of what the page shows: Low.',
      A: 'The forum keeps running: None.',
    },
  },
  {
    name: 'Kernel flaw lets a user become administrator',
    story: 'On a Linux server, any user who is already signed in can run a small program that exploits a kernel bug and becomes root. It works reliably and needs no one else\'s help.',
    target: vec('AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H'),
    why: {
      AV: 'The attacker must already be running code on the machine: Local.',
      AC: 'It works reliably: Low.',
      PR: 'An ordinary signed-in user is needed first: Low.',
      UI: 'No one else has to do anything: None.',
      S: 'The kernel is the component that is broken, and root on that same system is the result, so scope is Unchanged.',
      C: 'Root can read everything: High.',
      I: 'Root can change everything: High.',
      A: 'Root can stop everything: High.',
    },
  },
  {
    name: 'Kiosk boots from a USB stick',
    story: 'A lobby kiosk lets anyone who plugs in a USB stick boot their own operating system, with full access to the kiosk\'s disk. No account is needed, but the attacker has to be standing at the kiosk.',
    target: vec('AV:P/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'),
    why: {
      AV: 'The attacker has to touch the device: Physical.',
      AC: 'Plugging in a stick works every time: Low.',
      PR: 'No account is needed: None.',
      UI: 'No one else has to do anything: None.',
      S: 'Only the kiosk is affected: Unchanged.',
      C: 'Full access to the disk: High.',
      I: 'The disk can be changed: High.',
      A: 'The kiosk can be wiped: High.',
    },
  },
  {
    name: 'One packet crashes the VPN gateway',
    story: 'A malformed packet sent from the internet to the company\'s VPN gateway makes it crash and restart, every time. No data is exposed or changed, but nobody can connect while it keeps crashing.',
    target: vec('AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H'),
    why: {
      AV: 'The packet comes from the internet: Network.',
      AC: 'It crashes every time: Low.',
      PR: 'No account is needed: None.',
      UI: 'No one has to do anything: None.',
      S: 'Only the gateway is affected: Unchanged.',
      C: 'No data is exposed: None.',
      I: 'No data is changed: None.',
      A: 'Nobody can connect: High.',
    },
  },
];

const START: Vector = vec('AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N');

/**
 * A CVSS 3.1 base score calculator: set the eight metrics and see the score, its severity and the vector string.
 * Each task describes a vulnerability to score; checking shows why any metric you set differently has its value.
 */
@Component({
  selector: 'app-cvss-calc',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="CVSS calculator">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">speed</mat-icon> CVSS 3.1 calculator</div>
        <div class="count" aria-live="polite">{{ doneCount }} of {{ tasks.length }} scored</div>
      </header>
      <p class="intro">Pick a vulnerability, read what it does, and set the eight base metrics to match. The score updates as you go. Press <strong>Check</strong> to compare with how it should be scored.</p>

      <div class="tasks" role="tablist" aria-label="Vulnerability">
        @for (t of tasks; track $index) {
          <button type="button" role="tab" [attr.aria-selected]="active === $index" [class.on]="active === $index" [class.done]="done[$index]" (click)="pick($index)">
            <mat-icon aria-hidden="true">{{ done[$index] ? 'check_circle' : 'bug_report' }}</mat-icon>{{ t.name }}
          </button>
        }
      </div>
      <p class="story">{{ task.story }}</p>

      <div class="metrics">
        @for (m of metrics; track m.id) {
          <fieldset [class.wrong]="checked && v[m.id] !== task.target[m.id]">
            <legend><span class="mid mono">{{ m.id }}</span> {{ m.name }} <span class="ask">{{ m.ask }}</span></legend>
            <div class="opts">
              @for (o of m.values; track o.v) {
                <button type="button" [class.on]="v[m.id] === o.v" [attr.aria-pressed]="v[m.id] === o.v" [title]="o.tip" (click)="set(m.id, o.v)">{{ o.l }}</button>
              }
            </div>
            <div class="tip">{{ tipFor(m) }}</div>
            @if (checked && v[m.id] !== task.target[m.id]) { <div class="why bad">{{ task.why[m.id] }}</div> }
          </fieldset>
        }
      </div>

      <div class="score" [attr.data-sev]="sev">
        <div class="num" aria-live="polite"><span class="n">{{ score.toFixed(1) }}</span><span class="s">{{ sev }}</span></div>
        <div class="vec mono">{{ vector }}</div>
      </div>
      <p class="bands">Severity bands: None 0.0 · Low 0.1–3.9 · Medium 4.0–6.9 · High 7.0–8.9 · Critical 9.0–10.0</p>

      @if (checked) {
        @if (done[active]) {
          <div class="why good"><strong>Scored right: {{ score.toFixed(1) }} {{ sev }}.</strong> Every metric matches how this vulnerability is rated.</div>
        } @else {
          <div class="why bad">{{ wrongCount }} metric{{ wrongCount === 1 ? '' : 's' }} differ{{ wrongCount === 1 ? 's' : '' }}, marked above with the reason. Change them and check again.</div>
        }
      }
      @if (doneCount === tasks.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>All five scored.</strong> Notice that the base score says how bad a flaw is in general, not how urgent it is for you: exposure, asset value and active exploitation decide that.</span></div>
      }
      <div class="controls">
        <button type="button" class="btn primary" (click)="check()"><mat-icon aria-hidden="true">fact_check</mat-icon> Check</button>
        <span class="spacer"></span>
        <button type="button" class="btn ghost" (click)="reset()">Start over</button>
      </div>
    </section>
  `,
  styleUrl: './cvss-calc.component.scss',
})
export class CvssCalcComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly metrics = METRICS;
  readonly tasks = CVSS_TASKS;

  active = 0;
  /** Your metrics for each task. */
  vectors: Vector[] = CVSS_TASKS.map(() => ({ ...START }));
  done: boolean[] = CVSS_TASKS.map(() => false);
  checked = false;

  ngOnInit() {
    const saved = this.work?.get<{ active: number; vectors: Partial<Vector>[]; done: boolean[]; checked?: boolean }>('cvss');
    if (!saved) return;
    if (saved.active >= 0 && saved.active < CVSS_TASKS.length) this.active = saved.active;
    this.vectors = CVSS_TASKS.map((_, i) => ({ ...START, ...saved.vectors?.[i] }));
    this.done = CVSS_TASKS.map((_, i) => !!saved.done?.[i]);
    this.checked = !!saved.checked;
  }

  get task() { return CVSS_TASKS[this.active]; }
  get v(): Vector { return this.vectors[this.active]; }
  get score(): number { return cvssScore(this.v); }
  get sev() { return severity(this.score); }
  get vector(): string { return vectorString(this.v); }
  get doneCount(): number { return this.done.filter(Boolean).length; }
  get wrongCount(): number { return METRICS.filter(m => this.v[m.id] !== this.task.target[m.id]).length; }
  tipFor(m: Metric): string { return m.values.find(o => o.v === this.v[m.id])?.tip ?? ''; }

  pick(i: number) { this.active = i; this.checked = false; this.save(); }
  set(id: MetricId, value: string) {
    this.vectors = this.vectors.map((v, i) => i === this.active ? { ...v, [id]: value } : v);
    this.checked = false;
    this.save();
  }
  check() {
    this.checked = true;
    if (this.wrongCount === 0) this.done = this.done.map((d, i) => d || i === this.active);
    this.save();
  }
  reset() {
    this.vectors = CVSS_TASKS.map(() => ({ ...START }));
    this.done = CVSS_TASKS.map(() => false);
    this.checked = false;
    this.active = 0;
    this.work?.clear('cvss');
  }
  private save() { this.work?.set('cvss', { active: this.active, vectors: this.vectors, done: this.done, checked: this.checked }); }
}
