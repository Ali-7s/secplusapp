import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Observable, forkJoin, map, shareReplay } from 'rxjs';
import { ContentService } from '../../services/content.service';
import { ProgressService } from '../../services/progress.service';
import { Block, CalloutKind, CardRef, Lesson } from './networking.model';
import { LESSON_META } from './lessons/lesson-index';
import { getLesson } from './lessons/lessons';
import { LessonPart, checkMinutes, lessonParts } from './lessons/parts';
import { MdPipe } from './blocks/md.pipe';
import { LessonQuizComponent } from './blocks/lesson-quiz.component';
import { SequenceComponent } from './blocks/sequence.component';
import { LayerExplorerComponent } from './blocks/layer-explorer.component';
import { CidrReaderComponent } from './blocks/cidr-reader.component';
import { HardenListComponent } from './blocks/harden-list.component';
import { SpotIssuesComponent } from './blocks/spot-issues.component';
import { PbqPracticeComponent } from './blocks/pbq-practice.component';
import { FlowComponent, NestedBoxesComponent, PortStripComponent } from './blocks/visuals.component';

/** What the hover preview of a flashcard shows. */
interface CardPreview { title: string; subtitle?: string; text: string }

/** Step-by-step (one part at a time) or the whole lesson on one page. Remembered in this browser. */
type LessonView = 'steps' | 'all';
const VIEW_KEY = 'sp-lesson-view';

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
  ],
  templateUrl: './lesson.component.html',
  styleUrl: './lesson.component.scss',
})
export class LessonComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private content = inject(ContentService);
  private router = inject(Router);
  readonly progress = inject(ProgressService);
  @ViewChild('related') private relatedSection?: ElementRef<HTMLElement>;

  /** Touch screens cannot hover, so the first tap previews a card and the second opens it. */
  readonly touch = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;
  preview: { key: string; kind: CardRef['kind']; name: string; left: number; top: number; card?: CardPreview; missing?: boolean } | null = null;
  private cards$?: Observable<Map<string, CardPreview>>;
  private hideTimer?: ReturnType<typeof setTimeout>;

  lesson: Lesson | undefined;
  readonly total = LESSON_META.length;
  readonly calloutIcons = CALLOUT_ICONS;

  /** The lesson split at its headings; the self-check comes after the last part. */
  parts: LessonPart[] = [];
  /** Index into `parts`, or `parts.length` for the self-check. */
  step = 0;
  /** Set when the lesson reopened partway through, to offer starting over. */
  resumed = false;
  view: LessonView = this.loadView();

  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.lesson = getLesson(params.get('slug'));
      this.parts = this.lesson ? lessonParts(this.lesson) : [];
      const saved = this.lesson ? this.progress.lessonRecord(this.lesson.slug)?.part ?? 0 : 0;
      this.step = Math.min(Math.max(saved, 0), this.parts.length);
      this.resumed = this.step > 0;
      this.preview = null;
      this.scrollToTop();
    });
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

  /** Template outlets pass untyped context; these restore the types for the shared templates. */
  blocksOf(list: unknown): Block[] { return list as Block[]; }
  partOf(part: unknown): LessonPart { return part as LessonPart; }

  setView(view: LessonView) {
    this.view = view;
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* storage unavailable */ }
  }

  private loadView(): LessonView {
    try { return localStorage.getItem(VIEW_KEY) === 'all' ? 'all' : 'steps'; } catch { return 'steps'; }
  }

  get previous() {
    return this.lesson ? LESSON_META.find(l => l.number === this.lesson!.number - 1) : undefined;
  }

  get next() {
    return this.lesson ? LESSON_META.find(l => l.number === this.lesson!.number + 1) : undefined;
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
  private scrollToTop() {
    const scroller = this.host.nativeElement.closest('mat-sidenav-content');
    (scroller ?? document.scrollingElement)?.scrollTo({ top: 0 });
  }
}
