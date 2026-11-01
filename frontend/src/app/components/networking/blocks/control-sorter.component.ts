import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';

export const CATEGORIES = ['Technical', 'Managerial', 'Operational', 'Physical'] as const;
export const TYPES = ['Preventive', 'Deterrent', 'Detective', 'Corrective', 'Compensating', 'Directive'] as const;
export type Category = typeof CATEGORIES[number];
export type ControlType = typeof TYPES[number];

export interface SortItem {
  control: string;
  category: Category;
  /** Every type that is a fair answer; the first is the best one. */
  types: ControlType[];
  why: string;
}

export const CONTROLS: SortItem[] = [
  { control: 'An inbound firewall rule that drops everything except HTTPS to the web server', category: 'Technical', types: ['Preventive'],
    why: 'A system enforces it (technical), and it stops the unwanted traffic before anything happens (preventive).' },
  { control: 'A lock and badge reader on the server room door', category: 'Physical', types: ['Preventive'],
    why: 'It is a physical barrier you can touch, and it keeps people out rather than reporting them afterwards.' },
  { control: 'A banner at sign-in: "This system is monitored. Misuse will be prosecuted."', category: 'Technical', types: ['Deterrent', 'Directive'],
    why: 'The system displays it (technical). It cannot stop anyone; it discourages misuse by warning of consequences, which is deterrent.' },
  { control: 'Motion sensors in the warehouse that alert security after hours', category: 'Physical', types: ['Detective'],
    why: 'Physical sensors in the building that notice and report an intruder, without stopping them: detective.' },
  { control: 'A manager reviews the weekly report of failed sign-ins and disabled accounts', category: 'Managerial', types: ['Detective'],
    why: 'Oversight by management (managerial) that finds problems after they happen (detective).' },
  { control: 'Restoring encrypted file shares from last night\'s backup after ransomware', category: 'Technical', types: ['Corrective'],
    why: 'The backup system does the work (technical), and it puts things right after the incident (corrective).' },
  { control: 'A fire extinguisher by the server racks', category: 'Physical', types: ['Corrective'],
    why: 'A physical object used after a fire starts, to limit the damage and restore safety: corrective.' },
  { control: 'An old controller that cannot be patched is put on its own VLAN, reachable only from one admin jump box', category: 'Technical', types: ['Compensating', 'Preventive'],
    why: 'Patching is the normal control and is not possible, so isolation is used instead: a compensating control, enforced by network devices.' },
  { control: 'A generator that powers the data center when the mains supply fails', category: 'Physical', types: ['Compensating', 'Corrective'],
    why: 'It stands in for the normal power supply when that fails, so it compensates. It is equipment you can touch, so it is physical.' },
  { control: 'The acceptable use policy every employee reads and signs', category: 'Managerial', types: ['Directive'],
    why: 'A policy set by management (managerial) that tells people what they must and must not do (directive).' },
  { control: 'Security guards patrolling the parking lot and checking doors at night', category: 'Operational', types: ['Detective', 'Deterrent'],
    why: 'People carry it out day to day (operational). Patrols find problems, and being seen also deters; detective is the best fit.' },
  { control: 'Yearly security awareness training with phishing simulations', category: 'Operational', types: ['Preventive', 'Directive'],
    why: 'Run by people for people (operational). Trained staff report and ignore phishing, which prevents incidents.' },
];

/** Long names for the hints next to each choice. */
const CATEGORY_HINT: Record<Category, string> = {
  Technical: 'Enforced by systems: hardware, software, firmware',
  Managerial: 'Policies, plans and oversight set by management',
  Operational: 'Carried out by people day to day',
  Physical: 'Something in the real world you can touch',
};

/**
 * Sort security controls by category (technical, managerial, operational, physical) and type (preventive, deterrent,
 * detective, corrective, compensating, directive). Some controls fit more than one type; the reason says which is best.
 */
@Component({
  selector: 'app-control-sorter',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="Control sorter">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">category</mat-icon> Sort the controls</div>
        <div class="count" aria-live="polite">{{ rightCount }} of {{ items.length }} sorted right</div>
      </header>
      <p class="intro">Each control has a <strong>category</strong> (how it is put in place) and a <strong>type</strong> (what it does). Pick one of each; the answer appears once you have both.</p>

      <ol class="list" aria-label="Controls">
        @for (c of items; track $index) {
          <li><button type="button" [class.on]="active === $index" [class.ok]="state($index) === 'ok'" [class.bad]="state($index) === 'bad'"
            [attr.aria-current]="active === $index" [attr.aria-label]="'Control ' + ($index + 1) + stateLabel($index)" (click)="go($index)">{{ $index + 1 }}</button></li>
        }
      </ol>

      <div class="card">
        <div class="control"><span class="cn">{{ active + 1 }}</span> {{ item.control }}</div>

        <div class="axis" role="group" aria-label="Category">
          <span class="al">Category</span>
          @for (c of categories; track c) {
            <button type="button" [class.on]="pick.category === c" [attr.aria-pressed]="pick.category === c"
              [class.right]="answered && c === item.category" [class.wrong]="answered && pick.category === c && c !== item.category"
              [title]="hint[c]" (click)="choose('category', c)">{{ c }}</button>
          }
        </div>
        <div class="axis" role="group" aria-label="Type">
          <span class="al">Type</span>
          @for (t of types; track t) {
            <button type="button" [class.on]="pick.type === t" [attr.aria-pressed]="pick.type === t"
              [class.right]="answered && t === item.types[0]" [class.ok]="answered && t !== item.types[0] && pick.type === t && item.types.includes(t)"
              [class.wrong]="answered && pick.type === t && !item.types.includes(t)" (click)="choose('type', t)">{{ t }}</button>
          }
        </div>

        @if (answered) {
          <div class="why" [class.good]="state(active) === 'ok'" [class.bad]="state(active) === 'bad'">
            <strong>{{ item.category }}, {{ item.types[0] }}.</strong>
            @if (pick.type !== item.types[0] && item.types.includes(pick.type!)) { {{ pick.type }} is a fair answer too. }
            {{ item.why }}
          </div>
        }
        <div class="controls">
          <button type="button" class="btn" [attr.aria-disabled]="active === 0" (click)="go(active - 1)"><mat-icon aria-hidden="true">chevron_left</mat-icon> Back</button>
          <button type="button" class="btn primary" [attr.aria-disabled]="active === items.length - 1" (click)="go(active + 1)">Next <mat-icon aria-hidden="true">chevron_right</mat-icon></button>
          <span class="spacer"></span>
          <button type="button" class="btn ghost" (click)="reset()">Start over</button>
        </div>
      </div>

      @if (rightCount === items.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>All sorted.</strong> Ask two questions of any control: who or what puts it in place (the category), and does it stop, discourage, find, fix, stand in for or tell (the type)?</span></div>
      }
    </section>
  `,
  styleUrl: './control-sorter.component.scss',
})
export class ControlSorterComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly items = CONTROLS;
  readonly categories = CATEGORIES;
  readonly types = TYPES;
  readonly hint = CATEGORY_HINT;

  active = 0;
  picks: { category?: Category; type?: ControlType }[] = CONTROLS.map(() => ({}));

  ngOnInit() {
    const saved = this.work?.get<{ active: number; picks: { category?: Category; type?: ControlType }[] }>('controls');
    if (!saved) return;
    if (saved.active >= 0 && saved.active < CONTROLS.length) this.active = saved.active;
    this.picks = CONTROLS.map((_, i) => ({ ...saved.picks?.[i] }));
  }

  get item() { return CONTROLS[this.active]; }
  get pick() { return this.picks[this.active]; }
  get answered(): boolean { return !!(this.pick.category && this.pick.type); }

  state(i: number): 'ok' | 'bad' | null {
    const p = this.picks[i], c = CONTROLS[i];
    if (!p.category || !p.type) return null;
    return p.category === c.category && c.types.includes(p.type) ? 'ok' : 'bad';
  }
  stateLabel(i: number): string {
    const s = this.state(i);
    return s === 'ok' ? ', sorted right' : s === 'bad' ? ', not right yet' : '';
  }
  get rightCount(): number { return CONTROLS.filter((_, i) => this.state(i) === 'ok').length; }

  go(i: number) {
    if (i < 0 || i >= CONTROLS.length) return;
    this.active = i;
    this.save();
  }
  choose(axis: 'category' | 'type', value: string) {
    this.picks = this.picks.map((p, i) => i === this.active ? { ...p, [axis]: value } : p);
    this.save();
  }
  reset() {
    this.picks = CONTROLS.map(() => ({}));
    this.active = 0;
    this.work?.clear('controls');
  }
  private save() { this.work?.set('controls', { active: this.active, picks: this.picks }); }
}
