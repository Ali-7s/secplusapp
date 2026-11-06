import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProgressService } from '../../services/progress.service';
import { PORTS, PortEntry } from '../reference/reference-data';
import {
  GROUPS, MAX_LEVEL, Mastery, PortGroup, PortQuestion, QRef, ROUND, buildQuestion, entryOf, levelOf, masteredIn, pickRound, roseToday, setRound, shortName, updateMastery,
} from './ports-trainer';

interface Answered { typed: string; right: boolean; note?: string; before: number }

/** A round in progress. Saved after every answer, so a refresh lands on the same question. */
interface Round { set: string; refs: QRef[]; i: number; answers: Answered[]; typed: string }

const SLUG = 'ports-trainer';

/** Ports in small sets by job: learn a set, drill it five ways, and watch each port's mastery grow. */
@Component({
  selector: 'app-ports-page',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './ports-page.component.html',
  styleUrl: './ports-page.component.scss',
})
export class PortsPageComponent {
  private progress = inject(ProgressService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  @ViewChild('answerBox') answerBox?: ElementRef<HTMLInputElement>;
  @ViewChild('nextBtn') nextBtn?: ElementRef<HTMLButtonElement>;

  readonly groups = GROUPS;
  readonly total = PORTS.length;
  readonly levels = Array.from({ length: MAX_LEVEL + 1 }, (_, i) => i);
  readonly shortName = shortName;
  readonly entryOf = entryOf;
  learning = new Set<string>();

  mastery: Mastery = (this.progress.lessonWork(SLUG, 'mastery') as Mastery | undefined) ?? {};
  round: Round | null = (this.progress.lessonWork(SLUG, 'round') as Round | undefined) ?? null;
  question: PortQuestion | null = null;

  constructor() {
    if (this.round && !this.round.refs?.length) this.round = null;
    this.load();
  }

  // ── Overview ────────────────────────────────────────────────────────────

  level(port: string) { return levelOf(this.mastery, port); }
  isOutside(port: string) { const g = GROUPS.find(x => x.id === this.round?.set); return !!g && !g.ports.includes(port); }
  mastered(g: PortGroup) { return masteredIn(this.mastery, g.ports); }
  get masteredAll() { return masteredIn(this.mastery, PORTS.map(p => p.port)); }
  get started() { return Object.keys(this.mastery).length > 0; }
  weakCount() { return PORTS.filter(p => this.level(p.port) < MAX_LEVEL).length; }

  toggleLearn(g: PortGroup) {
    if (this.learning.has(g.id)) this.learning.delete(g.id);
    else this.learning.add(g.id);
  }

  hookFor(g: PortGroup, port: string): string | undefined {
    const n = port.split(/[/-]/)[0];
    return g.hooks.find(h => new RegExp(`\\b${n}\\b`).test(h));
  }

  rating(e: PortEntry) {
    return e.status === 'secure' ? 'Encrypted' : e.status === 'insecure' ? 'Cleartext' : e.status === 'deprecated' ? 'Do not use' : 'Depends';
  }

  // ── Rounds ──────────────────────────────────────────────────────────────

  setTitle(id: string) {
    return id === 'weak' ? 'Your weakest ports' : id === 'all' ? 'Every port' : GROUPS.find(g => g.id === id)?.title ?? '';
  }

  start(set: string) {
    let ports: string[];
    if (set === 'weak') {
      const weak = PORTS.map(p => p.port).filter(p => this.level(p) < MAX_LEVEL);
      // Weakest first: ports already started but not mastered, else the next set not yet begun.
      const begun = weak.filter(p => this.mastery[p]);
      ports = begun.length >= 4 ? begun : [...begun, ...GROUPS.flatMap(g => g.ports).filter(p => weak.includes(p) && !begun.includes(p))].slice(0, 8);
      if (!ports.length) ports = PORTS.map(p => p.port);
    } else if (set === 'all') ports = PORTS.map(p => p.port);
    else ports = GROUPS.find(g => g.id === set)!.ports;
    const group = GROUPS.some(g => g.id === set);
    this.round = { set, refs: group ? setRound(ports, this.mastery) : pickRound(ports, this.mastery), i: 0, answers: [], typed: '' };
    this.load();
    this.saveRound();
    this.toTop();
    this.focusAnswer();
  }

  get answered(): Answered | undefined { return this.round?.answers[this.round.i]; }
  get finished() { return !!this.round && this.round.i >= this.round.refs.length; }
  get score() { return this.round?.answers.filter(a => a.right).length ?? 0; }

  private load() {
    this.question = this.round && this.round.i < this.round.refs.length ? buildQuestion(this.round.refs[this.round.i]) : null;
  }

  setTyped(v: string) {
    if (!this.round) return;
    this.round.typed = v;
    this.saveRound();
  }

  check(choice?: string) {
    const r = this.round, q = this.question;
    if (!r || !q || this.answered) return;
    const typed = choice ?? r.typed;
    if (!typed.trim()) return;
    const v = q.check(typed);
    const before = this.level(q.port);
    r.answers[r.i] = { typed, right: v.right, note: v.note, before };
    this.mastery = updateMastery(this.mastery, q.port, v.right, Date.now());
    this.progress.setLessonWork(SLUG, 'mastery', this.mastery);
    if (q.card) this.progress.recordCard('ref', q.card, v.right);
    this.saveRound();
    setTimeout(() => this.nextBtn?.nativeElement.focus());
  }

  /** Overrule a wrong mark (a typo, or an answer the checker did not know). */
  override() {
    const r = this.round, q = this.question, a = this.answered;
    if (!r || !q || !a || a.right) return;
    a.right = true;
    a.note = undefined;
    const m = { ...this.mastery, [q.port]: { ...(this.mastery[q.port] ?? { level: 0, right: 0, wrong: 1, at: 0 }), level: a.before, wrong: Math.max(0, (this.mastery[q.port]?.wrong ?? 1) - 1) } };
    this.mastery = updateMastery(m, q.port, true, Date.now());
    this.progress.setLessonWork(SLUG, 'mastery', this.mastery);
    if (q.card) this.progress.recordCard('ref', q.card, true);
    this.saveRound();
  }

  next() {
    const r = this.round;
    if (!r || !this.answered) return;
    r.i++;
    r.typed = '';
    this.load();
    this.saveRound();
    this.focusAnswer();
  }

  exit() {
    this.round = null;
    this.question = null;
    this.progress.setLessonWork(SLUG, 'round', null);
    this.toTop();
  }

  private toTop() {
    this.host.nativeElement.closest('mat-sidenav-content')?.scrollTo({ top: 0 });
  }

  /** Enter checks, then moves on. */
  key(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (this.answered) this.next();
    else this.check();
  }

  summary() {
    const r = this.round!;
    return r.refs.map((ref, i) => ({ q: buildQuestion(ref), a: r.answers[i] as Answered | undefined }));
  }

  /** Ports in the round, with the level they started at and where they ended. */
  changes() {
    const r = this.round!;
    const first = new Map<string, number>();
    r.refs.forEach((ref, i) => { if (!first.has(ref.port) && r.answers[i]) first.set(ref.port, r.answers[i].before); });
    return [...first].map(([port, from]) => ({ port, name: shortName(entryOf(port)), from, to: this.level(port), held: roseToday(this.mastery, port, Date.now()) }));
  }

  hookForQuestion(q: PortQuestion) {
    const g = GROUPS.find(x => x.ports.includes(q.port))!;
    return this.hookFor(g, q.port);
  }

  private saveRound() {
    this.progress.setLessonWork(SLUG, 'round', this.round ? JSON.parse(JSON.stringify(this.round)) : null);
  }

  private focusAnswer() {
    setTimeout(() => this.answerBox?.nativeElement.focus());
  }

  readonly ROUND = ROUND;
}
