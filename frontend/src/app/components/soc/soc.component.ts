import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { hms } from './engine/events';
import { SHIFTS } from './engine/shifts';
import { SocStore } from './soc-store';

/** The SOC Lab's front page: what it is, and the shifts to pick from. */
@Component({
  selector: 'app-soc',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="page-header">
      <mat-icon aria-hidden="true">terminal</mat-icon>
      <div>
        <h1>SOC Lab</h1>
        <p>Work shifts as a security operations analyst: live traffic, a SIEM, a Linux terminal and an alert queue.</p>
      </div>
    </div>


    <ul class="shifts">
      @for (s of shifts; track s.id) {
        @let st = status(s.id, s.start, s.end);
        <li>
          <a class="shift" [routerLink]="['/soc', s.id]">
            <span class="num">{{ s.number }}</span>
            <span class="body">
              <span class="name">{{ s.title }}</span>
              <span class="tag">{{ s.tagline }}</span>
              <span class="meta"><mat-icon aria-hidden="true">schedule</mat-icon> {{ hms(s.start).slice(0, 5) }} to {{ hms(s.end).slice(0, 5) }} · {{ s.alerts.length }} alerts · {{ s.tasks.length }} tasks</span>
              <span class="skills">@for (k of s.skills; track k) { <span class="skill">{{ k }}</span> }</span>
            </span>
            <span class="state" [attr.data-st]="st.kind">{{ st.label }}</span>
          </a>
        </li>
      }
    </ul>
  `,
  styleUrl: './soc.component.scss',
})
export class SocComponent {
  private store = inject(SocStore);
  readonly shifts = SHIFTS;
  readonly hms = hms;

  status(id: string, start: number, end: number): { kind: string; label: string } {
    const s = this.store.load(id);
    if (s?.ended || (s?.best && !s.started)) return { kind: 'done', label: `Best ${s.best ?? 0}` };
    if (s?.started && s.clock > start) return { kind: 'going', label: s.clock >= end ? 'Shift over' : `At ${hms(s.clock).slice(0, 5)}` };
    return { kind: 'new', label: 'Start' };
  }
}
