import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { CHALLENGES, CONTROLS, ControlId, Frame, HOSTS, HostState, SAMPLES, SEGMENT_NAME, SampleId, Segment, SimResult, judge, simulate } from './outbreak';

interface Saved { sample: SampleId; on: ControlId[]; hour: number; solved: SampleId[] }

const STATE: Record<HostState, { label: string; icon: string }> = {
  clean: { label: 'Clean', icon: 'check_circle' },
  infected: { label: 'Infected', icon: 'coronavirus' },
  isolated: { label: 'Isolated', icon: 'block' },
  encrypted: { label: 'Encrypted', icon: 'lock' },
  wiped: { label: 'Deleted', icon: 'delete_forever' },
  restored: { label: 'Restored', icon: 'settings_backup_restore' },
};

/**
 * The outbreak simulator: pick a sample and some defences, release it into a ten-machine office, and step through
 * what happens hour by hour. Each sample has a challenge that can only be met with the right defence.
 */
@Component({
  selector: 'app-outbreak',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="Outbreak simulator">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">coronavirus</mat-icon> Outbreak simulator</div>
        <div class="count" aria-live="polite">{{ solved.length }} of {{ challenges.length }} challenges</div>
      </header>
      <p class="intro">Pick a sample, choose your defences, then release it and step through the hours. Every defence you turn on reports what it did, or why it did nothing.</p>

      <div class="samples" role="radiogroup" aria-label="Malware sample">
        @for (s of samples; track s.id) {
          <button type="button" role="radio" class="chip" [class.on]="sample === s.id" [attr.aria-checked]="sample === s.id" (click)="pickSample(s.id)">
            @if (solved.includes(s.id)) { <mat-icon aria-hidden="true" class="done">task_alt</mat-icon> }
            {{ s.name }}
          </button>
        }
      </div>

      <div class="challenge" [class.met]="verdict.ok && finished">
        <mat-icon aria-hidden="true">{{ solved.includes(sample) ? 'emoji_events' : 'flag' }}</mat-icon>
        <div>
          <div class="ch-goal"><strong>Challenge:</strong> {{ challenge.goal }}</div>
          <div class="ch-start">How it starts: {{ sampleInfo.start }}.</div>
        </div>
      </div>

      <fieldset class="defences">
        <legend>Your defences <span class="muted">({{ on.length }} on)</span></legend>
        @for (c of controls; track c.id) {
          <label class="def" [class.on]="on.includes(c.id)" [class.off-limits]="challenge.without === c.id">
            <input type="checkbox" [checked]="on.includes(c.id)" (change)="toggle(c.id)" />
            <mat-icon aria-hidden="true">{{ c.icon }}</mat-icon>
            <span><span class="dn">{{ c.name }}</span><span class="dd">{{ challenge.without === c.id ? 'Not part of this challenge: assume it fails' : c.detail }}</span></span>
          </label>
        }
      </fieldset>

      <div class="net" aria-label="The office network">
        @for (seg of segments; track seg) {
          <div class="seg">
            <div class="seg-name">{{ segName[seg] }}</div>
            <div class="hosts">
              @for (h of hostsIn(seg); track h.id) {
                @let s = stateOf(h.id);
                <div class="host" [class]="'host ' + s" [attr.aria-label]="h.id + ', ' + h.name + ': ' + stateInfo[s].label">
                  <div class="h-top">
                    <mat-icon aria-hidden="true" class="kind">{{ h.server ? 'dns' : 'computer' }}</mat-icon>
                    <span class="hid">{{ h.id }}</span>
                    <mat-icon class="patch" [class.yes]="h.patched || on.includes('patch')" [attr.aria-label]="(h.patched || on.includes('patch')) ? 'Patched' : 'Not patched'">{{ (h.patched || on.includes('patch')) ? 'verified_user' : 'gpp_maybe' }}</mat-icon>
                  </div>
                  <div class="hname">{{ h.name }}</div>
                  <div class="hstate"><mat-icon aria-hidden="true">{{ stateInfo[s].icon }}</mat-icon> {{ stateInfo[s].label }}</div>
                  @if (h.id === 'FS' && frame && frame.share !== 'clean') {
                    <div class="share" [class]="'share ' + frame.share">Share: {{ shareLabel(frame.share) }}</div>
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>
      <div class="legend"><mat-icon aria-hidden="true" class="yes">verified_user</mat-icon> patched <mat-icon aria-hidden="true">gpp_maybe</mat-icon> missing the SMB patch</div>

      <div class="timeline">
        <div class="clock" aria-live="polite">
          @if (hour < 0) { Not released yet } @else { Hour {{ hour }} of {{ result.frames.length - 1 }} }
        </div>
        <span class="spacer"></span>
        @if (hour < 0) {
          <button type="button" class="btn primary" (click)="step()"><mat-icon aria-hidden="true">play_arrow</mat-icon> Release it</button>
        } @else if (!finished) {
          <button type="button" class="btn primary" (click)="step()"><mat-icon aria-hidden="true">skip_next</mat-icon> Next hour</button>
          <button type="button" class="btn" (click)="toEnd()">Run to the end</button>
        }
        @if (hour >= 0) { <button type="button" class="btn ghost" (click)="restart()"><mat-icon aria-hidden="true">replay</mat-icon> Reset</button> }
      </div>

      @if (hour >= 0) {
        <ol class="log" aria-label="What happened">
          @for (f of shown; track f.hour) {
            <li>
              <div class="lh">Hour {{ f.hour }}</div>
              <ul>
                @for (e of f.events; track $index) {
                  <li class="ev" [class]="'ev ' + e.tone">
                    <mat-icon aria-hidden="true">{{ e.tone === 'bad' ? 'warning' : e.tone === 'good' ? 'shield' : e.tone === 'none' ? 'remove_circle_outline' : 'info' }}</mat-icon>
                    <span>@if (e.control) { <strong>{{ controlName(e.control) }}:</strong> } {{ e.text }}</span>
                  </li>
                }
              </ul>
            </li>
          }
        </ol>
      }

      @if (finished) {
        <div class="why" role="status" [class.good]="verdict.ok" [class.bad]="!verdict.ok">
          <strong>{{ verdict.ok ? 'Challenge met.' : 'Challenge not met.' }}</strong> {{ verdict.why }}
          @if (!verdict.ok) { Change your defences and release it again. }
        </div>
      }

      @if (solved.length === challenges.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>All six stopped.</strong> No single defence stops everything: each kind of malware is beaten by what blocks the way it works.</span>
        </div>
      }
    </section>
  `,
  styleUrl: './outbreak.component.scss',
})
export class OutbreakComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly samples = SAMPLES;
  readonly controls = CONTROLS;
  readonly challenges = CHALLENGES;
  readonly segments: Segment[] = ['office', 'finance', 'servers'];
  readonly segName = SEGMENT_NAME;
  readonly stateInfo = STATE;

  sample: SampleId = 'worm';
  on: ControlId[] = [];
  /** -1 before release. */
  hour = -1;
  solved: SampleId[] = [];
  result: SimResult = simulate('worm', []);

  ngOnInit() {
    const s = this.work?.get<Saved>('outbreak');
    if (s) {
      if (SAMPLES.some(x => x.id === s.sample)) this.sample = s.sample;
      this.on = (s.on ?? []).filter(c => CONTROLS.some(x => x.id === c));
      this.solved = (s.solved ?? []).filter(id => SAMPLES.some(x => x.id === id));
    }
    this.rerun();
    if (s && Number.isInteger(s.hour)) this.hour = Math.min(Math.max(s.hour, -1), this.result.frames.length - 1);
  }

  get sampleInfo() { return SAMPLES.find(s => s.id === this.sample)!; }
  get challenge() { return CHALLENGES.find(c => c.sample === this.sample)!; }
  get verdict() { return judge(this.challenge, this.on); }
  get frame(): Frame | null { return this.hour >= 0 ? this.result.frames[this.hour] : null; }
  get shown(): Frame[] { return this.result.frames.slice(0, this.hour + 1); }
  get finished() { return this.hour === this.result.frames.length - 1; }

  hostsIn(seg: Segment) { return HOSTS.filter(h => h.seg === seg); }
  stateOf(id: string): HostState { return this.frame?.hosts[id] ?? 'clean'; }
  controlName(id: ControlId) { return CONTROLS.find(c => c.id === id)!.name; }
  shareLabel(s: string) { return s === 'infected' ? 'infected files' : s; }

  pickSample(id: SampleId) {
    this.sample = id;
    this.restart();
  }

  toggle(id: ControlId) {
    this.on = this.on.includes(id) ? this.on.filter(c => c !== id) : CONTROLS.map(c => c.id).filter(c => c === id || this.on.includes(c));
    this.restart();
  }

  step() {
    if (this.finished) return;
    this.hour++;
    this.done();
  }

  toEnd() {
    this.hour = this.result.frames.length - 1;
    this.done();
  }

  restart() {
    this.rerun();
    this.hour = -1;
    this.save();
  }

  private rerun() { this.result = simulate(this.sample, this.on); }

  private done() {
    if (this.finished && this.verdict.ok && !this.solved.includes(this.sample)) {
      this.solved = SAMPLES.map(s => s.id).filter(id => id === this.sample || this.solved.includes(id));
    }
    this.save();
  }

  private save() { this.work?.set('outbreak', { sample: this.sample, on: this.on, hour: this.hour, solved: this.solved }); }
}
