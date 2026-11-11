import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProgressService } from '../../services/progress.service';
import { PORTS, PortEntry } from '../reference/reference-data';
import { LessonWork } from '../networking/lesson-work.service';
import { PbqPracticeComponent } from '../networking/blocks/pbq-practice.component';
import { ExamAnswer, gradeQuestion, isStarted } from '../../utils/exam-engine';
import { MIXED, PortScenario, SCENARIOS, portOutcomes, portsRight, trainerEntry } from './firewall-scenarios';
import { FACTS, GeneratedRef, RuleMemory, buildTable, newTable } from './firewall-generator';
import { OldRuleHistory, RuleCounts, comesBack, factsIn, loadMemory, memoryFromHistory, memoryKey, newRulesLeft, rateTable, ruleCounts } from './firewall-memory';
import { formatDelay } from '../../utils/srs';
import { creditRules, factsOfEntry, reviewCardOf, tableCredits } from './port-links';
import { Unlocked, unlockedAfter } from './firewall-locks';
import {
  CORE_PORTS, GROUPS, MAX_LEVEL, Mastery, PortGroup, PortQuestion, Practiced, QRef, buildQuestion, entryOf, isCore, levelOf, markPracticed, masteredIn, needsOtherSet, partOf, pickRound, roseRecently, setsPracticed, shortName, startOrder, updateMastery,
} from './ports-trainer';

interface Answered { typed: string; right: boolean; note?: string; before: number }

/** A round in progress. Saved after every answer, so a refresh lands on the same question. */
interface Round { set: string; refs: QRef[]; i: number; answers: Answered[]; typed: string }

const SLUG = 'ports-trainer';

type View = 'drills' | 'firewalls';
/** A firewall scenario's state, as PbqPracticeComponent saves it. */
interface SavedScenario { answer?: ExamAnswer; checked?: boolean }

/** Ports in small sets by job: learn a set, drill it five ways, and watch each port's mastery grow. */
@Component({
  selector: 'app-ports-page',
  standalone: true,
  imports: [RouterLink, MatIconModule, PbqPracticeComponent],
  providers: [LessonWork],
  templateUrl: './ports-page.component.html',
  styleUrl: './ports-page.component.scss',
})
export class PortsPageComponent {
  private progress = inject(ProgressService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private work = inject(LessonWork);
  @ViewChild('answerBox') answerBox?: ElementRef<HTMLInputElement>;
  @ViewChild('nextBtn') nextBtn?: ElementRef<HTMLButtonElement>;

  readonly groups = GROUPS;
  readonly total = PORTS.length;
  readonly levels = Array.from({ length: MAX_LEVEL + 1 }, (_, i) => i);
  readonly shortName = shortName;
  readonly entryOf = entryOf;
  readonly isCore = isCore;
  readonly coreTotal = CORE_PORTS.length;
  /** A drill answer's firewall rules as they were before it, so overruling a wrong mark can put them back. */
  private rulesBefore: RuleMemory | null = null;
  learning = new Set<string>();

  mastery: Mastery = (this.progress.lessonWork(SLUG, 'mastery') as Mastery | undefined) ?? {};
  practiced: Practiced = (this.progress.lessonWork(SLUG, 'practiced') as Practiced | undefined) ?? {};
  round: Round | null = (this.progress.lessonWork(SLUG, 'round') as Round | undefined) ?? null;
  question: PortQuestion | null = null;

  /** The view last used, unless a link asks for one (the Today page sends due firewall rules here with ?view=firewalls). */
  view: View = (inject(ActivatedRoute).snapshot.queryParamMap.get('view') ?? this.progress.lessonWork(SLUG, 'view')) === 'firewalls' ? 'firewalls' : 'drills';
  scenario: PortScenario | null = this.restoreScenario();
  /** Failed written scenarios whose Try again has been earned back. */
  unlocked: Unlocked = (this.progress.lessonWork(SLUG, 'fw:unlocked') as Unlocked | undefined) ?? {};
  /** What is remembered of each firewall rule: its spaced repetition card, which decides what the next random table asks. */
  memory: RuleMemory = loadMemory(key => this.progress.lessonWork(SLUG, key));
  /** The time the counts on screen were worked out for. */
  private clock = Date.now();
  /** When each rule of the open random table comes back, once it has been checked. */
  back: ReturnType<typeof comesBack> | null = null;
  readonly ruleTotal = FACTS.length;
  readonly scenarios = SCENARIOS;
  readonly MIXED = MIXED;
  readonly scenarioSets = [...GROUPS.map(g => ({ id: g.id, title: g.title })), { id: MIXED, title: 'Mixed: whole companies' }]
    .map(set => ({ ...set, items: SCENARIOS.filter(s => s.set === set.id) }));

  constructor() {
    this.work.slug = SLUG;
    if (this.round && !this.round.refs?.length) this.round = null;
    this.load();
    // A view asked for by a link is remembered like one chosen here.
    if (this.view !== (this.progress.lessonWork(SLUG, 'view') ?? 'drills')) this.progress.setLessonWork(SLUG, 'view', this.view);
    this.adoptOldHistory();
    this.refreshBack();
  }

  /** Tables used to keep a plain history of each rule. Turn it into rule memory once, then drop it. */
  private adoptOldHistory() {
    const history = this.progress.lessonWork(SLUG, 'fw:history') as OldRuleHistory | undefined;
    if (!history) return;
    const saved: Record<string, unknown> = { 'fw:history': null };
    if (!Object.keys(this.memory).length) {
      this.memory = memoryFromHistory(history, port => this.mastery[trainerEntry(port) ?? '']?.at, Date.now(), this.retention);
      for (const [fact, card] of Object.entries(this.memory)) saved[memoryKey(fact)] = card;
    }
    this.progress.setLessonWorks(SLUG, saved);
  }

  private saveRules(rules: RuleMemory) {
    const cards = Object.entries(rules);
    if (cards.length) this.progress.setLessonWorks(SLUG, Object.fromEntries(cards.map(([fact, card]) => [memoryKey(fact), card])));
  }

  /**
   * A drill answer about a port's number also counts for its firewall rules. It gives the number but not the whole
   * rule, so a right answer only starts rules that were new (the next table then asks them instead of treating them
   * as new), and a wrong one sends them back.
   */
  private linkDrillToRules(q: PortQuestion, right: boolean, now: number) {
    if (q.kind !== 'number' && q.kind !== 'situation') return;
    const changed = creditRules(this.memory, q.port, right, 'partial', now, this.retention, partOf(q)?.n);
    this.memory = { ...this.memory, ...changed };
    this.saveRules(changed);
  }

  /** Rules follow Review mode's two settings: the recall chance to aim for, and how many new ones a day. */
  private get retention() { return this.progress.data().review.retention; }

  // ── Firewall scenarios ──────────────────────────────────────────────────

  setView(view: View) {
    this.view = view;
    this.clock = Date.now();
    this.progress.setLessonWork(SLUG, 'view', view);
  }

  openScenario(s: PortScenario | null) {
    this.scenario = s;
    this.progress.setLessonWork(SLUG, 'fw:open', s?.id ?? null);
    this.refreshBack();
    this.toTop();
  }

  /** Rules due, new and learned among the ones this set's random table draws on. */
  rules(set: string): RuleCounts { return ruleCounts(this.memory, factsIn(set), this.clock); }

  /** What a set's random table has waiting: an unfinished table, rules due, new rules, or the time until the next is due. */
  randomState(set: string): string {
    if (this.randomUnfinished(set)) return 'In progress';
    const r = this.rules(set);
    if (r.due) return `${r.due} due`;
    if (r.fresh) return `${r.fresh} new`;
    return r.next ? `Next due in ${formatDelay(r.next - this.clock)}` : 'New every time';
  }

  /** Works out the "comes back" line for the open table: only a random table whose first check has been counted has one. */
  private refreshBack() {
    this.clock = Date.now();
    const s = this.scenario;
    const ref = s && s.seed !== undefined ? this.randomRef(s.set) : undefined;
    const scored = (this.progress.lessonWork(SLUG, 'fw:scored') as Record<string, string> | undefined) ?? {};
    this.back = s && ref && ref.seed === s.seed && scored[s.id] === String(s.seed) ? comesBack(this.memory, ref.flows, this.clock) : null;
  }

  private savedScenario(s: PortScenario) { return this.work.get<SavedScenario>(`pbq:${s.id}`); }

  private restoreScenario(): PortScenario | null {
    const id = this.progress.lessonWork(SLUG, 'fw:open') as string | null | undefined;
    if (!id) return null;
    if (!id.startsWith('gen-')) return SCENARIOS.find(s => s.id === id) ?? null;
    const ref = this.randomRef(id.slice(4));
    return ref ? buildTable(ref) : null;
  }

  private randomRef(set: string) { return this.progress.lessonWork(SLUG, `fw:gen:${set}`) as GeneratedRef | undefined; }

  /** A random table was started for this set and has not been checked yet. */
  randomUnfinished(set: string) { return !!this.randomRef(set) && !this.work.get<SavedScenario>(`pbq:gen-${set}`)?.checked; }

  /** Carries on with this set's unfinished random table, or builds a new one. Only the latest per set is kept. */
  openRandom(set: string, fresh = false) {
    let ref = this.randomRef(set);
    if (!ref || fresh || !this.randomUnfinished(set)) {
      const now = Date.now();
      const newLeft = newRulesLeft(this.memory, this.progress.data().review.newPerDay, now);
      ref = newTable(set, { level: port => this.level(port), memory: this.memory, now, newLeft }, now % 2 ** 31);
      this.progress.setLessonWork(SLUG, `fw:gen:${set}`, ref);
      this.work.clear(`pbq:gen-${set}`);
    }
    this.openScenario(buildTable(ref));
  }

  /** Rules right on the last check, or null if it has not been checked. */
  rulesRight(s: PortScenario): number | null {
    const saved = this.savedScenario(s);
    return saved?.checked ? gradeQuestion(s, saved.answer).parts.filter(p => p.ok).length : null;
  }
  isBegun(s: PortScenario) { return isStarted(s, this.savedScenario(s)?.answer); }
  get checkedCount() { return SCENARIOS.filter(s => this.savedScenario(s)?.checked).length; }

  get nextScenario(): PortScenario | undefined {
    return this.scenario ? SCENARIOS[SCENARIOS.indexOf(this.scenario) + 1] : undefined;
  }
  get firstUnchecked(): PortScenario | undefined { return SCENARIOS.find(s => !this.savedScenario(s)?.checked); }

  private failed(s: PortScenario) { const right = this.rulesRight(s); return right !== null && right < s.rows.length; }

  /**
   * A written scenario checked with a mistake cannot be tried again until every rule is right on a table from a
   * different category (see firewall-locks.ts).
   */
  locked(s: PortScenario) { return s.seed === undefined && this.failed(s) && !this.unlocked[s.id]; }

  categoryTitle(set: string) { return this.scenarioSets.find(x => x.id === set)?.title ?? ''; }

  /** The category offered for unlocking a scenario: the other set whose ports are weakest. */
  unlockSet(s: PortScenario): string {
    const average = (g: PortGroup) => g.ports.reduce((sum, p) => sum + this.level(p), 0) / g.ports.length;
    return GROUPS.filter(g => g.id !== s.set).reduce((a, b) => (average(b) < average(a) ? b : a)).id;
  }

  /**
   * A random table counts toward the ports' levels once, on its first check. So does a written scenario, but only
   * ever once: after that it may just be remembered. A second try comes after reading the answers, so it shows
   * nothing about memory and must neither raise a level nor drop one.
   */
  onScenarioChecked(s: PortScenario) {
    const written = s.seed === undefined;
    const mark = written ? 'done' : String(s.seed);
    const scored = (this.progress.lessonWork(SLUG, 'fw:scored') as Record<string, string> | undefined) ?? {};
    const first = written ? !scored[s.id] : scored[s.id] !== mark;
    const graded = gradeQuestion(s, this.savedScenario(s)?.answer);

    this.unlocked = unlockedAfter(this.unlocked, { id: s.id, set: s.set, written, perfect: graded.correct, first },
      SCENARIOS.filter(x => this.failed(x)).map(x => ({ id: x.id, set: x.set })));
    this.progress.setLessonWork(SLUG, 'fw:unlocked', this.unlocked);
    if (!first) return;

    const now = Date.now();
    for (const { port, right } of portOutcomes(s, this.savedScenario(s)?.answer?.cells)) {
      this.mastery = updateMastery(this.mastery, port, right, now, this.practiced);
    }
    this.recordPractice(s.set, s.rows.map(r => trainerEntry(r.answer['Port'])).filter((p): p is string => !!p), now);
    this.progress.setLessonWork(SLUG, 'mastery', this.mastery);
    this.progress.setLessonWork(SLUG, 'fw:scored', { ...scored, [s.id]: mark });

    // Each rule of a random table is rated like a Review card, which sets when it comes back.
    const ref = written ? undefined : this.randomRef(s.set);
    if (ref && ref.seed === s.seed && ref.flows.length === s.rows.length) {
      const right = portsRight(s, this.savedScenario(s)?.answer?.cells);
      const changed = rateTable(this.memory, ref.flows, right, now, this.retention);
      this.memory = { ...this.memory, ...changed };
      this.saveRules(changed);
      // The same answers count on each port's Review card, so Review mode does not ask again what a table just showed.
      this.progress.recordCards('ref', tableCredits(ref.flows, right).flatMap(c => {
        const name = reviewCardOf(c.port);
        return name ? [{ name, known: c.right, review: c.full }] : [];
      }));
    }
    this.refreshBack();
  }

  // ── Overview ────────────────────────────────────────────────────────────

  level(port: string) { return levelOf(this.mastery, port); }

  private waitsForOtherSet(port: string) { return this.level(port) < MAX_LEVEL && needsOtherSet(this.mastery, port, this.practiced); }
  /** Some of this set's ports can't go up again until a different set is practiced. */
  waiting(g: PortGroup) { return g.ports.some(p => this.waitsForOtherSet(p)); }

  private recordPractice(set: string, ports: string[], now: number) {
    this.practiced = markPracticed(this.practiced, setsPracticed(set, ports), now);
    this.progress.setLessonWork(SLUG, 'practiced', this.practiced);
  }

  mastered(g: PortGroup) { return masteredIn(this.mastery, g.ports); }
  get masteredAll() { return masteredIn(this.mastery, PORTS.map(p => p.port)); }
  get masteredCore() { return masteredIn(this.mastery, CORE_PORTS); }
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
      ports = begun.length >= 4 ? begun : [...begun, ...startOrder().filter(p => weak.includes(p) && !begun.includes(p))].slice(0, 8);
      if (!ports.length) ports = PORTS.map(p => p.port);
    } else if (set === 'all') ports = PORTS.map(p => p.port);
    else ports = GROUPS.find(g => g.id === set)!.ports;
    this.round = { set, refs: pickRound(ports, this.mastery), i: 0, answers: [], typed: '' };
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
    const now = Date.now();
    this.mastery = updateMastery(this.mastery, q.port, v.right, now, this.practiced, q);
    this.progress.setLessonWork(SLUG, 'mastery', this.mastery);
    if (q.card) this.progress.recordCard('ref', q.card, v.right);
    this.rulesBefore = this.memory;
    this.linkDrillToRules(q, v.right, now);
    if (r.answers.filter(Boolean).length === r.refs.length) this.recordPractice(r.set, r.refs.map(x => x.port), now);
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
    this.mastery = updateMastery(m, q.port, true, Date.now(), this.practiced, q);
    this.progress.setLessonWork(SLUG, 'mastery', this.mastery);
    if (q.card) this.progress.recordCard('ref', q.card, true);
    this.overruleRules(q);
    this.saveRound();
  }

  /** Puts the port's firewall rules back as they were before the wrong mark, then counts the answer as right. */
  private overruleRules(q: PortQuestion) {
    const before = this.rulesBefore;
    this.rulesBefore = null;
    if (!before || (q.kind !== 'number' && q.kind !== 'situation')) return;
    const restored: Record<string, unknown> = {};
    for (const fact of factsOfEntry(q.port)) restored[memoryKey(fact)] = before[fact] ?? null;
    this.progress.setLessonWorks(SLUG, restored);
    this.memory = before;
    this.linkDrillToRules(q, true, Date.now());
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
    return [...first].map(([port, from]) => ({ port, name: shortName(entryOf(port)), from, to: this.level(port), held: this.heldNote(port) }));
  }

  private heldNote(port: string): string {
    if (this.level(port) >= MAX_LEVEL) return '';
    if (this.waitsForOtherSet(port)) return 'same (do a different set first)';
    return roseRecently(this.mastery, port, Date.now()) ? 'same (already went up in the last hour)' : '';
  }

  /** The round's ports include some that need a different set before they can go up again. */
  roundWaits() { return this.changes().some(c => this.waitsForOtherSet(c.port)); }

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

}
