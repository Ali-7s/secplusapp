import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { hms } from './engine/events';
import { Ticket, TicketMark, emptyTicket, markTicket } from './engine/grade';
import { ACTIONS, ActionId, Alert, VERDICTS, Verdict } from './engine/model';

/** The alert queue and the ticket for each alert: verdict, response, evidence, then the debrief. */
@Component({
  selector: 'app-soc-alerts',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.scss',
})
export class SocAlertsComponent {
  @Input({ required: true }) alerts: Alert[] = [];
  @Input({ required: true }) tickets: Record<string, Ticket> = {};
  @Input() openId: string | null = null;
  @Input() waiting = 0;
  @Output() openIdChange = new EventEmitter<string | null>();
  @Output() ticketChange = new EventEmitter<{ id: string; ticket: Ticket }>();
  @Output() investigate = new EventEmitter<string>();

  readonly verdicts = VERDICTS;
  readonly actions = ACTIONS;
  readonly hms = hms;
  hints = new Set<string>();

  ticket(a: Alert): Ticket {
    return this.tickets[a.id] ?? emptyTicket();
  }

  mark(a: Alert): TicketMark | null {
    const t = this.tickets[a.id];
    return t?.submitted ? markTicket(a, t) : null;
  }

  status(a: Alert): 'new' | 'draft' | 'done' {
    const t = this.tickets[a.id];
    return t?.submitted ? 'done' : t && (t.verdict || t.actions.length || Object.values(t.answers).some(Boolean)) ? 'draft' : 'new';
  }

  toggle(a: Alert) {
    this.openIdChange.emit(this.openId === a.id ? null : a.id);
  }

  private update(a: Alert, change: (t: Ticket) => void) {
    const t: Ticket = structuredClone(this.ticket(a));
    change(t);
    // Keep it here at once: change detection is coalesced, so a second change in the same frame must build on this one.
    this.tickets = { ...this.tickets, [a.id]: t };
    this.ticketChange.emit({ id: a.id, ticket: t });
  }

  setVerdict(a: Alert, v: Verdict) { this.update(a, t => (t.verdict = v)); }
  toggleAction(a: Alert, id: ActionId) {
    this.update(a, t => (t.actions = t.actions.includes(id) ? t.actions.filter(x => x !== id) : [...t.actions, id]));
  }
  setAnswer(a: Alert, q: string, v: string) { this.update(a, t => (t.answers = { ...t.answers, [q]: v })); }
  setNotes(a: Alert, v: string) { this.update(a, t => (t.notes = v)); }

  canSubmit(a: Alert) {
    const t = this.ticket(a);
    return !!t.verdict && t.actions.length > 0;
  }

  submit(a: Alert) {
    if (!this.canSubmit(a)) return;
    this.update(a, t => (t.submitted = true));
  }

  toggleHint(key: string) {
    if (this.hints.has(key)) this.hints.delete(key);
    else this.hints.add(key);
  }

  actionLabel(id: ActionId) { return ACTIONS.find(x => x.id === id)?.label ?? id; }
  verdictLabel(id: Verdict | undefined) { return VERDICTS.find(x => x.id === id)?.label ?? 'none'; }
}
