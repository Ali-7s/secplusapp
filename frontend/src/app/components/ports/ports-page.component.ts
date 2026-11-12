import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProgressService, cardKey } from '../../services/progress.service';
import { PORTS, PortEntry } from '../reference/reference-data';
import { LessonWork } from '../networking/lesson-work.service';
import { PbqPracticeComponent } from '../networking/blocks/pbq-practice.component';
import { ExamAnswer, gradeQuestion, isStarted } from '../../utils/exam-engine';
import { MIXED, PortScenario, SCENARIOS, portOutcomes, portsRight, trainerEntry } from './firewall-scenarios';
import { FACTS, GeneratedRef, RuleMemory, buildTable, newTable } from './firewall-generator';
import { OldRuleHistory, RuleCounts, comesBack, factsIn, loadMemory, memoryFromHistory, memoryKey, newRulesLeft, rateTable, ruleCounts } from './firewall-memory';
import { SrsCard, formatDelay } from '../../utils/srs';
import { creditRules, factsOfEntry, reviewCardOf, tableCredits } from './port-links';
import { CardLookup, adoptOldLevels, cardLevel, drillAnswer, isDue, isNew, lastAnswered, nextDue, portLevel, portState, urgency } from './port-memory';
import { Unlocked, unlockedAfter } from './firewall-locks';
import { LOCK_AFTER, SetPractices, afterAnswer, afterOverrule, afterRound, isRested, lockedSets } from './set-breaks';
import {
  Asked, CORE_PORTS, GROUPS, MAX_LEVEL, PORT_HOOKS, PortGroup, PortQuestion, QRef, ROUND, buildQuestion, entryOf, isCore, partOf, pickRound, shortName, startOrder,
} from './ports-trainer';

/**
 * An answer in a round. `card` is the Review card it was a review of (none for the secure replacement), with the card
 * as it was before, so overruling a wrong mark can redo it. `review` is false when it only counted the answer.
 */
interface Answered { typed: string; right: boolean; note?: string; before: number; card?: string; cardBefore?: SrsCard | null; review?: boolean }

/** A round in progress. Saved after every answer, so a refresh lands on the same question. */
interface Round {
  set: string; refs: QRef[]; i: number; answers: Answered[]; typed: string;
  /** A set round whose set had not been drilled for an hour when it began, so finishing it opens locked sets. */
  rested?: boolean;
  /** The locked sets it opened, once finished. */
  opened?: string[];
}

const SLUG = 'ports-trainer';
/** How many ports a round of new ports starts with. */
const NEW_AT_ONCE = 5;

type View = 'drills' | 'firewalls';
/** A firewall scenario's state, as PbqPracticeComponent saves it. */
interface SavedScenario { answer?: ExamAnswer; checked?: boolean }

/** Ports in small sets by job: learn a set, drill it five ways, and watch each port's level grow. */
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
  readonly shortName = shortName;
  readonly entryOf = entryOf;
  readonly isCore = isCore;
  readonly coreTotal = CORE_PORTS.length;
  /** One bar per level, for the level bars on chips and cards. */
  readonly levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);
  readonly legend = [
    { level: 0, label: 'new' }, { level: 2, label: 'level 2 of 4' }, { level: MAX_LEVEL, label: 'mastered' }, { level: 2, label: 'due', due: true }, { level: 0, label: 'core port', core: true },
  ];
  /** A drill answer's firewall rules as they were before it, so overruling a wrong mark can put them back. */
  private rulesBefore: RuleMemory | null = null;
  learning = new Set<string>();

  /** How each port was last asked, so the next round asks it another way. */
  asked: Record<string, Asked> = (this.progress.lessonWork(SLUG, 'asked') as Record<string, Asked> | undefined) ?? {};
  /** A port's Review cards, which hold what the drills remember of it. */
  private readonly cardOf: CardLookup = id => this.progress.data().cards[cardKey('ref', id)];
  round: Round | null = (this.progress.lessonWork(SLUG, 'round') as Round | undefined) ?? null;
  /** Each set's misses and lock, so a day does not go on one set (set-breaks.ts). */
  sets: SetPractices = (this.progress.lessonWork(SLUG, 'sets') as SetPractices | undefined) ?? {};
  readonly LOCK_AFTER = LOCK_AFTER;
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
    adoptOldLevels(this.progress);
    this.asked = (this.progress.lessonWork(SLUG, 'asked') as Record<string, Asked> | undefined) ?? {};
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
      const lastAt = (port: string) => { const entry = trainerEntry(port); return entry ? lastAnswered(entry, this.cardOf) : undefined; };
      this.memory = memoryFromHistory(history, lastAt, Date.now(), this.retention);
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
   * A random table counts toward the ports' Review cards once, on its first check. So does a written scenario, but
   * only ever once: after that it may just be remembered. A second try comes after reading the answers, so it shows
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
    this.progress.setLessonWork(SLUG, 'fw:scored', { ...scored, [s.id]: mark });
    if (written) {
      // A written scenario's rows are not rules with memory of their own: its answers count on the Review cards the
      // way an answer outside Review mode does (a miss in full, a right answer only starts a new card).
      this.progress.recordCards('ref', portOutcomes(s, this.savedScenario(s)?.answer?.cells).flatMap(o => {
        const name = reviewCardOf(o.port);
        return name ? [{ name, known: o.right }] : [];
      }));
    }

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

  level(port: string) { return portLevel(port, this.cardOf); }
  /** A started port with a Review card due (or its other card still new). */
  due(port: string) { return isDue(port, this.cardOf, Date.now()); }
  dueIn(g: PortGroup) { return g.ports.filter(p => this.due(p)).length; }
  get dueAll() { return PORTS.filter(p => this.due(p.port)).length; }
  /** Due ports outside locked sets, which the main drill can ask. */
  get dueOpen() { return this.openPorts().filter(p => this.due(p)).length; }
  /** Ports never studied, in the order to start them: core ports first. */
  private newPorts() { return startOrder().filter(p => isNew(p, this.cardOf) && !this.lockedPort(p)); }

  // ── Breaks between sets ─────────────────────────────────────────────────

  private get lockedIds() { return lockedSets(this.sets, GROUPS.map(g => g.id)); }
  isLocked(set: string) { return this.lockedIds.has(set); }
  private lockedPort(port: string) { return GROUPS.some(g => g.ports.includes(port) && this.isLocked(g.id)); }
  private openPorts() { return PORTS.map(p => p.port).filter(p => !this.lockedPort(p)); }
  /** Misses in a set's drills since its last break. */
  misses(set: string) { return isRested(this.sets[set], Date.now()) ? 0 : this.sets[set]?.misses ?? 0; }
  /** The locked sets a round of this one would open: it is not locked and has not been drilled for an hour. */
  opens(g: PortGroup): string[] {
    if (this.isLocked(g.id) || !isRested(this.sets[g.id], Date.now())) return [];
    return GROUPS.filter(x => this.isLocked(x.id)).map(x => x.title);
  }
  private saveSets(changed: SetPractices) {
    this.sets = { ...this.sets, ...changed };
    this.progress.setLessonWork(SLUG, 'sets', this.sets);
  }
  /** How long until the next port falls due, when none is due now. */
  get nextDueIn(): string | null {
    const next = Math.min(...PORTS.map(p => nextDue(p.port, this.cardOf) ?? Infinity));
    return Number.isFinite(next) ? formatDelay(Math.max(0, next - Date.now())) : null;
  }

  private masteredIn(ports: string[]) { return ports.filter(p => this.level(p) >= MAX_LEVEL).length; }
  mastered(g: PortGroup) { return this.masteredIn(g.ports); }
  get masteredAll() { return this.masteredIn(PORTS.map(p => p.port)); }
  get masteredCore() { return this.masteredIn(CORE_PORTS); }
  get started() { return PORTS.some(p => !isNew(p.port, this.cardOf)); }

  toggleLearn(g: PortGroup) {
    if (this.learning.has(g.id)) this.learning.delete(g.id);
    else this.learning.add(g.id);
  }

  rating(e: PortEntry) {
    return e.status === 'secure' ? 'Encrypted' : e.status === 'insecure' ? 'Cleartext' : e.status === 'deprecated' ? 'Do not use' : 'Depends';
  }

  // ── Rounds ──────────────────────────────────────────────────────────────

  setTitle(id: string) {
    const titles: Record<string, string> = { due: 'Due for review', new: 'New ports', weak: 'Your weakest ports', all: 'Every port' };
    return titles[id] ?? GROUPS.find(g => g.id === id)?.title ?? '';
  }

  /** The overview's main drill: ports due for review, else ports not started yet, else none until something falls due. */
  get mainDrill(): { set: 'due' | 'new'; label: string } | null {
    const due = this.dueOpen;
    if (due) return { set: 'due', label: `Drill what's due (${due})` };
    return this.newPorts().length ? { set: 'new', label: this.started ? 'Learn new ports' : 'Start with the first ports' } : null;
  }

  start(set: string) {
    const now = Date.now();
    let ports: string[];
    if (this.isLocked(set)) return;
    if (set === 'due') {
      // The ports closest to forgotten first.
      ports = this.openPorts().filter(p => isDue(p, this.cardOf, now))
        .sort((a, b) => urgency(a, this.cardOf, now) - urgency(b, this.cardOf, now)).slice(0, ROUND);
    } else if (set === 'new') ports = this.newPorts().slice(0, NEW_AT_ONCE);
    else if (set === 'all') ports = this.openPorts();
    else ports = GROUPS.find(g => g.id === set)?.ports ?? [];
    if (!ports.length) return;
    this.round = { set, refs: pickRound(ports, p => portState(p, this.cardOf, now, this.asked[p])), i: 0, answers: [], typed: '' };
    if (GROUPS.some(g => g.id === set)) this.round.rested = isRested(this.sets[set], now);
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
    const now = Date.now();
    const a: Answered = { typed, right: v.right, note: v.note, before: this.level(q.port) };
    if (q.card) {
      const cardBefore = this.cardOf(q.card);
      Object.assign(a, { card: q.card, cardBefore: cardBefore ?? null, review: this.answerCard(q, q.card, cardBefore, v.right, now) });
    } else {
      this.progress.saveCards('ref', {}, 1);
    }
    r.answers[r.i] = a;
    this.asked = { ...this.asked, [q.port]: q.part === undefined ? { kind: q.kind } : { kind: q.kind, part: q.part } };
    this.progress.setLessonWork(SLUG, 'asked', this.asked);
    this.rulesBefore = this.memory;
    this.linkDrillToRules(q, v.right, now);
    if (r.rested !== undefined) this.saveSets({ [r.set]: afterAnswer(this.sets[r.set], v.right, now) });
    this.saveRound();
    setTimeout(() => this.nextBtn?.nativeElement.focus());
  }

  /** Saves a drill answer on the Review card it asks about. True when it was a review, false when it only counted. */
  private answerCard(q: PortQuestion, id: string, card: SrsCard | undefined, right: boolean, now: number, count = 1): boolean {
    const result = drillAnswer(card, q.kind, right, now, { retention: this.retention, id: cardKey('ref', id) });
    this.progress.saveCards('ref', { [id]: result?.card ?? card ?? null }, count);
    return !!result?.review;
  }

  /** Overrule a wrong mark (a typo, or an answer the checker did not know): the card is answered again from before. */
  override() {
    const r = this.round, q = this.question, a = this.answered;
    if (!r || !q || !a || a.right) return;
    a.right = true;
    a.note = undefined;
    if (a.card) a.review = this.answerCard(q, a.card, a.cardBefore ?? undefined, true, Date.now(), 0);
    if (r.rested !== undefined && this.sets[r.set]) this.saveSets({ [r.set]: afterOverrule(this.sets[r.set]) });
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
    if (this.finished && r.rested !== undefined) {
      const opened = afterRound(this.sets, r.set, r.rested);
      r.opened = Object.keys(opened).map(id => this.setTitle(id));
      this.saveSets(opened);
    }
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

  /** Ports in the round, with the level they started at, where they ended, and when they come back. */
  changes() {
    const r = this.round!;
    const first = new Map<string, number>();
    r.refs.forEach((ref, i) => { if (!first.has(ref.port) && r.answers[i]) first.set(ref.port, r.answers[i].before); });
    const now = Date.now();
    return [...first].map(([port, from]) => {
      const next = nextDue(port, this.cardOf);
      const back = next === undefined ? '' : next <= now ? 'due now' : `back in ${formatDelay(next - now)}`;
      return { port, name: shortName(entryOf(port)), from, to: this.level(port), back };
    });
  }

  /** The level on the question card: the port's level, and once answered, where it moved from and what happens next. */
  cardLevel(q: PortQuestion) {
    const a = this.answered;
    const to = this.level(q.port);
    const from = a ? a.before : to;
    return { from, to, text: from === to ? `Level ${to} of ${MAX_LEVEL}` : `Level ${from} → ${to}`, after: a ? this.afterNote(q, a, from, to) : '' };
  }

  /** What an answer did: when its card comes back, and why the level stayed where it was. */
  private afterNote(q: PortQuestion, a: Answered, from: number, to: number): string {
    const card = a.card ? this.cardOf(a.card) : undefined;
    if (!card) return '';
    const when = formatDelay(Math.max(0, card.due - Date.now()));
    if (!a.right) return `Next review in ${when}.`;
    if (!a.review) {
      return q.kind === 'transport' ? `This asked only TCP or UDP, so the level stays. Next review in ${when}.` : `Still learning: the next step is in ${when}, so the level stays.`;
    }
    if (to > from) return `Next review in ${when}.`;
    // The level is the weaker card's, so a right answer on the stronger one leaves it.
    if (cardLevel(card) > to) {
      const other = a.card === `port:${q.port}` ? `${shortName(entryOf(q.port))}: which port?` : `Port ${q.port}: which protocol?`;
      return `Stays at level ${to} until "${other}" catches up. Next review in ${when}.`;
    }
    return `Stays at level ${to}. Next review in ${when}.`;
  }

  hookForQuestion(q: PortQuestion) { return PORT_HOOKS[q.port]; }

  private saveRound() {
    this.progress.setLessonWork(SLUG, 'round', this.round ? JSON.parse(JSON.stringify(this.round)) : null);
  }

  private focusAnswer() {
    setTimeout(() => this.answerBox?.nativeElement.focus());
  }

}
