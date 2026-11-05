import { Component, DestroyRef, ElementRef, HostListener, Injector, ViewChild, afterNextRender, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Observable, forkJoin, map, shareReplay } from 'rxjs';
import { ContentService } from '../../services/content.service';
import { ProgressService } from '../../services/progress.service';
import { OBJECTIVE_NAMES } from '../../models/exam.model';
import { ScrollSpot, readSpot, sameSpot, scrollToSpot } from '../../utils/scroll-spot';
import { Block, CIA_GOALS, CIA_NAME, CalloutKind, CardRef, Lesson } from './networking.model';
import { TRACKS, trackLessons } from './lessons/lesson-index';
import { getLesson } from './lessons/lessons';
import { LessonPart, checkMinutes, lessonParts } from './lessons/parts';
import { MdPipe } from './blocks/md.pipe';
import { LessonWork } from './lesson-work.service';
import { LessonQuizComponent } from './blocks/lesson-quiz.component';
import { SequenceComponent } from './blocks/sequence.component';
import { LayerExplorerComponent } from './blocks/layer-explorer.component';
import { CidrReaderComponent } from './blocks/cidr-reader.component';
import { HardenListComponent } from './blocks/harden-list.component';
import { SpotIssuesComponent } from './blocks/spot-issues.component';
import { PbqPracticeComponent } from './blocks/pbq-practice.component';
import { FlowComponent, NestedBoxesComponent, PortStripComponent } from './blocks/visuals.component';
import { HashLabComponent } from './blocks/hash-lab.component';
import { KeyPickerComponent } from './blocks/key-picker.component';
import { CertCheckComponent } from './blocks/cert-check.component';
import { DecideComponent } from './blocks/decide.component';
import { RiskCalcComponent } from './blocks/risk-calc.component';
import { PolicyPlaygroundComponent } from './blocks/policy-playground.component';
import { BackupWeekComponent } from './blocks/backup-week.component';
import { EvidenceHuntComponent } from './blocks/evidence-hunt.component';
import { PasswordPolicyComponent } from './blocks/password-policy.component';
import { PermsLabComponent } from './blocks/perms-lab.component';
import { MdmConsoleComponent } from './blocks/mdm-console.component';
import { ControlSorterComponent } from './blocks/control-sorter.component';
import { CiaSorterComponent } from './blocks/cia-sorter.component';
import { EmailInspectorComponent } from './blocks/email-inspector.component';
import { CvssCalcComponent } from './blocks/cvss-calc.component';
import { NetworkLabComponent } from './blocks/network-lab/network-lab.component';

/** What the hover preview of a flashcard shows. */
interface CardPreview { title: string; subtitle?: string; text: string }

/** Step-by-step (one part at a time) or the whole lesson on one page. Remembered in this browser. */
type LessonView = 'steps' | 'all';
const VIEW_KEY = 'sp-lesson-view';

/** How long the page has to sit still before the reading position is saved. */
const SAVE_DELAY = 400;

const CALLOUT_ICONS: Record<CalloutKind, string> = {
  analogy: 'lightbulb',
  exam: 'school',
  secure: 'shield',
  tip: 'tips_and_updates',
  trap: 'warning',
};

@Component({
  selector: 'app-lesson',
  standalone: true,
  imports: [
    RouterLink, NgTemplateOutlet, MatIconModule, MdPipe, LessonQuizComponent, SequenceComponent, LayerExplorerComponent,
    CidrReaderComponent, HardenListComponent, SpotIssuesComponent, PbqPracticeComponent, FlowComponent, NestedBoxesComponent, PortStripComponent,
    HashLabComponent, KeyPickerComponent, CertCheckComponent, DecideComponent, RiskCalcComponent, PolicyPlaygroundComponent,
    BackupWeekComponent, EvidenceHuntComponent, PasswordPolicyComponent, PermsLabComponent, MdmConsoleComponent,
    ControlSorterComponent, CiaSorterComponent, EmailInspectorComponent, CvssCalcComponent, NetworkLabComponent,
  ],
  templateUrl: './lesson.component.html',
  styleUrl: './lesson.component.scss',
  providers: [LessonWork],
})
export class LessonComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private content = inject(ContentService);
  private router = inject(Router);
  readonly progress = inject(ProgressService);
  private work = inject(LessonWork);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  @ViewChild('related') private relatedSection?: ElementRef<HTMLElement>;

  /** Touch screens cannot hover, so the first tap previews a card and the second opens it. */
  readonly touch = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;
  preview: { key: string; kind: CardRef['kind']; name: string; left: number; top: number; card?: CardPreview; missing?: boolean } | null = null;
  private cards$?: Observable<Map<string, CardPreview>>;
  private hideTimer?: ReturnType<typeof setTimeout>;

  lesson: Lesson | undefined;
  readonly calloutIcons = CALLOUT_ICONS;
  readonly objectiveNames = OBJECTIVE_NAMES;
  readonly ciaGoals = CIA_GOALS;
  readonly ciaName = CIA_NAME;

  /** The lesson split at its headings; the self-check comes after the last part. */
  parts: LessonPart[] = [];
  /** Index into `parts`, or `parts.length` for the self-check. */
  step = 0;
  /** Set when the lesson reopened partway through, to offer starting over. */
  resumed = false;
  view: LessonView = this.loadView();

  /** The open lesson's slug, as a signal so a reading position arriving from another device can be followed. */
  private slug = signal('');
  /** Set once you scroll, click or press a key; from then on your own position wins over one arriving by sync. */
  private moved = false;
  /** The position last scrolled to on opening, so the same one is not applied twice. */
  private applied?: ScrollSpot;
  private saveTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const route = inject(ActivatedRoute);
    route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.saveNow();
      this.lesson = getLesson(params.get('slug'));
      this.work.slug = this.lesson?.slug ?? '';
      this.parts = this.lesson ? lessonParts(this.lesson) : [];
      this.step = 0;
      this.resumed = false;
      this.moved = false;
      this.applied = undefined;
      this.preview = null;
      this.scrollToTop();
      this.slug.set(this.lesson?.slug ?? '');
    });

    // `?part=N` opens a given part, as the links on the objectives page do. The parameter is then dropped, so a
    // refresh comes back to wherever you have read to instead.
    route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(query => {
      const raw = query.get('part');
      if (raw === null) return;
      const part = Number(raw);
      if (this.lesson && Number.isInteger(part)) this.jumpTo(part);
      this.router.navigate([], { relativeTo: route, queryParams: { part: null }, queryParamsHandling: 'merge', replaceUrl: true });
    });

    // Open the lesson where you were reading: on this device after a refresh, or on another one once sync brings
    // the position over (which can be a moment after the page opens). Once you start reading, you stay put.
    effect(() => {
      const slug = this.slug();
      const record = slug ? this.progress.lessonRecord(slug) : undefined;
      untracked(() => {
        if (this.moved || !record) return;
        const spot = this.spotFor(record.part ?? 0, record.scroll);
        if (this.applied && sameSpot(this.applied, spot)) return;
        this.applied = spot;
        this.step = spot.part;
        this.resumed = this.step > 0;
        afterNextRender(() => requestAnimationFrame(() => this.restore(spot)), { injector: this.injector });
      });
    });

    afterNextRender(() => {
      const scroller = this.scroller();
      if (!scroller) return;
      const onScroll = () => {
        if (!this.moved) return;
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.saveNow(), SAVE_DELAY);
      };
      const onInput = () => { this.moved = true; };
      const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
      scroller.addEventListener('scroll', onScroll, { passive: true });
      for (const type of inputs) scroller.addEventListener(type, onInput, { passive: true });
      // A refresh straight after scrolling should not lose the last stretch.
      const onHide = () => this.saveNow();
      window.addEventListener('pagehide', onHide);
      this.destroyRef.onDestroy(() => {
        this.saveNow();
        scroller.removeEventListener('scroll', onScroll);
        for (const type of inputs) scroller.removeEventListener(type, onInput);
        window.removeEventListener('pagehide', onHide);
      });
    });
  }

  /** The saved position, if it belongs to the saved part; otherwise the start of that part. */
  private spotFor(part: number, scroll: ScrollSpot | undefined): ScrollSpot {
    const p = Math.min(Math.max(part, 0), this.parts.length);
    return scroll && scroll.part === p ? scroll : { part: p, i: -1, f: 0 };
  }

  private restore(spot: ScrollSpot) {
    const scroller = this.scroller();
    if (scroller && !this.moved) scrollToSpot(this.host.nativeElement, scroller, spot);
  }

  /** Saves where you are reading, if you have moved since the lesson opened. */
  private saveNow() {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const scroller = this.scroller();
    if (!this.lesson || !this.moved || !scroller) return;
    const spot = readSpot(this.host.nativeElement, scroller);
    if (spot) this.progress.setLessonScroll(this.lesson.slug, spot);
  }

  // ── Step-by-step reading ─────────────────────────────────────────

  get onCheck(): boolean { return this.step >= this.parts.length; }
  get part(): LessonPart | undefined { return this.parts[this.step]; }
  get checkMinutes(): number { return this.lesson ? checkMinutes(this.lesson) : 1; }

  /** Title of whatever comes after the current step, for the Next button. */
  get nextTitle(): string {
    const next = this.parts[this.step + 1];
    return next ? next.title : 'Check yourself';
  }

  /** Skips the current optional part and any optional parts right after it. */
  skipOptional() {
    let next = this.step + 1;
    while (this.parts[next]?.optional) next++;
    this.goTo(next);
  }

  /** Title of the first part that is not optional after this one, for the Skip button. */
  get afterOptionalTitle(): string {
    let next = this.step + 1;
    while (this.parts[next]?.optional) next++;
    return this.parts[next]?.title ?? 'Check yourself';
  }

  goTo(step: number, scroll = true) {
    if (!this.lesson) return;
    this.step = Math.min(Math.max(step, 0), this.parts.length);
    this.resumed = false;
    this.progress.setLessonPart(this.lesson.slug, this.step);
    this.preview = null;
    if (scroll) this.scrollToTop();
  }

  /** Opens a part from a link, ahead of any saved reading position. */
  private jumpTo(part: number) {
    this.moved = true;
    this.goTo(part, false);
    const spot: ScrollSpot = { part: this.step, i: -1, f: 0 };
    // The page may still be settling (fonts, widgets), so place it once more a moment later.
    afterNextRender(() => {
      const place = () => { const scroller = this.scroller(); if (scroller) scrollToSpot(this.host.nativeElement, scroller, spot); };
      place();
      setTimeout(place, 250);
    }, { injector: this.injector });
  }

  /** Template outlets pass untyped context; these restore the types for the shared templates. */
  blocksOf(list: unknown): Block[] { return list as Block[]; }
  partOf(part: unknown): LessonPart { return part as LessonPart; }

  /** Switches view and keeps your place: the part you were reading opens in either. */
  setView(view: LessonView) {
    if (view === this.view) return;
    this.saveNow();
    const record = this.record;
    const spot = this.spotFor(this.view === 'all' ? record?.part ?? 0 : this.step, record?.scroll);
    this.view = view;
    this.step = spot.part;
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* storage unavailable */ }
    afterNextRender(() => {
      const scroller = this.scroller();
      if (scroller) scrollToSpot(this.host.nativeElement, scroller, spot);
    }, { injector: this.injector });
  }

  private loadView(): LessonView {
    try { return localStorage.getItem(VIEW_KEY) === 'all' ? 'all' : 'steps'; } catch { return 'steps'; }
  }

  /** The lessons in the same section as this one, which the pager steps through. */
  private get siblings() { return this.lesson ? trackLessons(this.lesson.track) : []; }

  /** "Networking Basics · Lesson 3 of 11". */
  get kicker(): string {
    const l = this.lesson;
    return l ? `${TRACKS[l.track].title} · ${TRACKS[l.track].unit} ${l.number} of ${this.siblings.length}` : '';
  }

  get previous() {
    return this.siblings.find(l => l.number === this.lesson!.number - 1);
  }

  get next() {
    return this.siblings.find(l => l.number === this.lesson!.number + 1);
  }

  /** True when the lesson teaches how to secure something, so the list and header can say so. */
  get coversSecurity(): boolean {
    return !!this.lesson?.blocks.some(b => b.type === 'harden' || (b.type === 'callout' && b.kind === 'secure') || (b.type === 'h' && b.tone === 'secure'));
  }

  // ── Remembering how the lesson went ─────────────────────────────────

  /** This lesson's saved progress: completion, self-check score and PBQs done. */
  get record() { return this.lesson ? this.progress.lessonRecord(this.lesson.slug) : undefined; }

  checkFinished(result: { score: number; total: number }) {
    if (this.lesson) this.progress.recordLessonCheck(this.lesson.slug, result.score, result.total);
  }

  pbqChecked(result: { id: string; fraction: number }) {
    if (this.lesson) this.progress.recordLessonPbq(this.lesson.slug, result.id, result.fraction);
  }

  linkFor(kind: 'acr' | 'term'): string {
    return kind === 'acr' ? '/acronyms' : '/terms';
  }

  // ── Flashcard previews ───────────────────────────────────────

  /** Mouse hover and keyboard focus. A tap on a touch screen also fires these, so touch waits for the click. */
  hoverPreview(ref: CardRef, event: Event) {
    if (!this.touch) this.showPreview(ref, event);
  }

  showPreview(ref: CardRef, event: Event) {
    clearTimeout(this.hideTimer);
    const key = ref.kind + ref.name;
    if (this.preview?.key === key) return;
    const chip = event.target as HTMLElement;
    const section = this.relatedSection?.nativeElement;
    if (!section) return;
    // Place the card under the chip, kept inside the section so it never runs off a phone screen.
    const box = section.getBoundingClientRect(), r = chip.getBoundingClientRect();
    const width = Math.min(320, box.width - 16);
    const left = Math.max(8, Math.min(r.left - box.left, box.width - width - 8));
    this.preview = { key, kind: ref.kind, name: ref.name, left, top: r.bottom - box.top + 6 };
    this.cardPreviews().subscribe(cards => {
      if (this.preview?.key !== key) return;
      const card = cards.get(key);
      this.preview = { ...this.preview, card, missing: !card };
    });
  }

  /** A short delay lets the pointer move from the chip onto the preview without it vanishing. */
  hidePreview() {
    if (this.touch) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => (this.preview = null), 120);
  }

  keepPreview() { clearTimeout(this.hideTimer); }

  /** On touch screens the preview stays open until you tap somewhere else. */
  @HostListener('document:click', ['$event'])
  closeOnOutsideTap(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.touch && this.preview && !target.closest('.chip, .card-preview')) this.preview = null;
  }

  /** On touch screens the chip has no router link: the first tap previews, a second tap on the same chip opens it. */
  chipClick(ref: CardRef, event: MouseEvent) {
    if (!this.touch) return;
    event.preventDefault();
    if (this.preview?.key === ref.kind + ref.name) {
      this.router.navigate([this.linkFor(ref.kind)], { queryParams: { q: ref.name } });
      return;
    }
    this.preview = null;
    this.showPreview(ref, event);
  }

  /** Both decks, loaded once on the first preview and indexed by kind and name. */
  private cardPreviews(): Observable<Map<string, CardPreview>> {
    this.cards$ ??= forkJoin([this.content.getAcronyms(), this.content.getTerms()]).pipe(
      map(([acronyms, terms]) => new Map<string, CardPreview>([
        ...acronyms.map(a => ['acr' + a.acronym, { title: a.acronym, subtitle: a.expansion, text: a.definition }] as const),
        ...terms.map(t => ['term' + t.term, { title: t.term, text: t.definition }] as const),
      ])),
      shareReplay(1),
    );
    return this.cards$;
  }

  /** The app scrolls inside the side-nav content area, not the window. */
  private scroller(): HTMLElement | null {
    return this.host.nativeElement.closest<HTMLElement>('mat-sidenav-content') ?? (document.scrollingElement as HTMLElement | null);
  }

  private scrollToTop() {
    this.scroller()?.scrollTo({ top: 0 });
  }
}
