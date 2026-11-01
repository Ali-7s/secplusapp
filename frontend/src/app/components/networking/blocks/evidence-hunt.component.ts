import { Component, Input, OnChanges, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { HuntRow, HuntTask } from '../networking.model';
import { MdPipe } from './md.pipe';

interface Saved { pins: Record<number, string>; active: number; open: string | null }

/**
 * An evidence hunt in the style of a SIEM search or a packet analyzer: filter and search the rows, open one to see
 * its details, and pin the row that answers each task. Pins are checked straight away and saved.
 */
@Component({
  selector: 'app-evidence-hunt',
  standalone: true,
  imports: [MatIconModule, MdPipe],
  template: `
    <section class="w" [attr.aria-label]="title">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">{{ look === 'siem' ? 'manage_search' : 'lan' }}</mat-icon> {{ title }}</div>
        <div class="count" aria-live="polite">{{ found }} of {{ tasks.length }} found</div>
      </header>
      @if (intro) { <p class="intro" [innerHTML]="intro | md"></p> }

      <ol class="tasks">
        @for (t of tasks; track $index; let i = $index) {
          @let pin = pins[i];
          @let ok = pin !== undefined && t.answer.includes(pin);
          <li [class.active]="active === i" [class.ok]="ok" [class.bad]="pin !== undefined && !ok">
            <button type="button" class="task" [attr.aria-pressed]="active === i" (click)="setActive(i)">
              <span class="tn">{{ i + 1 }}</span>
              <span class="ask" [innerHTML]="t.ask | md"></span>
              @if (pin !== undefined) {
                <span class="pin mono">#{{ pin }}</span>
                <mat-icon class="st" [attr.aria-label]="ok ? 'Right' : 'Not this one'">{{ ok ? 'check_circle' : 'cancel' }}</mat-icon>
              }
            </button>
            @if (pin !== undefined) {
              <div class="why" [class.good]="ok" [class.bad]="!ok"><span [innerHTML]="(ok ? t.why : t.hint) | md"></span></div>
            }
          </li>
        }
      </ol>

      <div class="filters">
        <label class="search">
          <mat-icon aria-hidden="true">search</mat-icon>
          <input type="search" [placeholder]="look === 'siem' ? 'Search events, e.g. an IP or a user' : 'Search packets, e.g. an IP or a word'"
            [value]="query" (input)="query = $any($event.target).value" [attr.aria-label]="'Search ' + title" />
        </label>
        @if (sources.length) {
          <div class="chips" role="radiogroup" [attr.aria-label]="look === 'siem' ? 'Log source' : 'Protocol'">
            <button type="button" role="radio" [attr.aria-checked]="source === ''" [class.on]="source === ''" (click)="source = ''">All</button>
            @for (s of sources; track s) {
              <button type="button" role="radio" [attr.aria-checked]="source === s" [class.on]="source === s" (click)="source = s">{{ s }}</button>
            }
          </div>
        }
      </div>

      <div class="scroll" [class.pcap]="look === 'pcap'">
        <table>
          <thead><tr><th scope="col" class="pc"><span class="sr">Pinned</span></th>@for (c of columns; track c) { <th scope="col">{{ c }}</th> }</tr></thead>
          <tbody>
            @for (r of shown; track r.id) {
              <tr [class.open]="open === r.id" (click)="toggleOpen(r.id)" (keydown.enter)="toggleOpen(r.id)" (keydown.space)="$event.preventDefault(); toggleOpen(r.id)"
                tabindex="0" [attr.aria-selected]="open === r.id">
                <td class="pc">@for (n of pinnedBy(r.id); track n) { <span class="badge">{{ n + 1 }}</span> }</td>
                @for (c of r.cells; track $index) { <td>{{ c }}</td> }
              </tr>
            } @empty {
              <tr><td [attr.colspan]="columns.length + 1" class="none">Nothing matches. Clear the search or pick another filter.</td></tr>
            }
          </tbody>
        </table>
      </div>
      <p class="shown">{{ shown.length }} of {{ rows.length }} {{ look === 'siem' ? 'events' : 'packets' }} shown. Tap one to open it.</p>

      @if (openRow; as r) {
        <div class="detail" aria-live="polite">
          <div class="d-head mono">{{ look === 'siem' ? 'Event' : 'Packet' }} #{{ r.id }}</div>
          <dl>
            @for (c of columns; track c; let j = $index) { <div><dt>{{ c }}</dt><dd class="mono">{{ r.cells[j] }}</dd></div> }
          </dl>
          @if (r.detail?.length) {
            <ul class="layers mono">@for (l of r.detail; track $index) { <li>{{ l }}</li> }</ul>
          }
          <div class="controls">
            <button type="button" class="btn primary" (click)="pinOpen()">
              <mat-icon aria-hidden="true">push_pin</mat-icon> Pin #{{ r.id }} as the answer to task {{ active + 1 }}
            </button>
          </div>
        </div>
      }

      @if (found > 0) {
        <div class="controls"><span class="spacer"></span><button type="button" class="btn ghost" (click)="reset()">Clear my pins</button></div>
      }
    </section>
  `,
  styleUrl: './evidence-hunt.component.scss',
})
export class EvidenceHuntComponent implements OnChanges {
  private work = inject(LessonWork, { optional: true });

  @Input({ required: true }) title = '';
  @Input() intro = '';
  @Input() look: 'siem' | 'pcap' = 'siem';
  @Input({ required: true }) columns: string[] = [];
  @Input({ required: true }) rows: HuntRow[] = [];
  @Input({ required: true }) tasks: HuntTask[] = [];

  pins: Record<number, string> = {};
  active = 0;
  open: string | null = null;
  query = '';
  source = '';

  ngOnChanges() {
    const saved = this.work?.get<Saved>(this.key);
    const ids = new Set(this.rows.map(r => r.id));
    this.pins = Object.fromEntries(Object.entries(saved?.pins ?? {}).filter(([i, id]) => +i < this.tasks.length && ids.has(id)));
    this.active = saved && saved.active >= 0 && saved.active < this.tasks.length ? saved.active : 0;
    this.open = saved?.open && ids.has(saved.open) ? saved.open : null;
  }

  private get key(): string { return `hunt:${this.title}`; }
  private save() { this.work?.set(this.key, { pins: this.pins, active: this.active, open: this.open }); }

  get sources(): string[] { return [...new Set(this.rows.map(r => r.source).filter((s): s is string => !!s))]; }

  get shown(): HuntRow[] {
    const q = this.query.trim().toLowerCase();
    return this.rows.filter(r => (!this.source || r.source === this.source)
      && (!q || [...r.cells, ...(r.detail ?? [])].some(c => c.toLowerCase().includes(q))));
  }

  get openRow(): HuntRow | undefined { return this.rows.find(r => r.id === this.open); }
  get found(): number { return this.tasks.filter((t, i) => this.pins[i] !== undefined && t.answer.includes(this.pins[i])).length; }

  pinnedBy(id: string): number[] { return this.tasks.map((_, i) => i).filter(i => this.pins[i] === id); }

  setActive(i: number) { this.active = i; this.save(); }
  toggleOpen(id: string) { this.open = this.open === id ? null : id; this.save(); }

  pinOpen() {
    if (!this.open) return;
    this.pins = { ...this.pins, [this.active]: this.open };
    // Move on to the next task without an answer, so pinning flows through the list.
    const next = this.tasks.findIndex((t, i) => i > this.active && !(this.pins[i] !== undefined && t.answer.includes(this.pins[i])));
    if (this.tasks[this.active].answer.includes(this.open) && next >= 0) this.active = next;
    this.save();
  }

  reset() { this.pins = {}; this.active = 0; this.save(); }
}
