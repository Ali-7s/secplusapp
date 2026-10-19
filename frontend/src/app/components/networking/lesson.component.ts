import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Observable, forkJoin, map, shareReplay } from 'rxjs';
import { ContentService } from '../../services/content.service';
import { CalloutKind, CardRef, Lesson } from './networking.model';
import { LESSON_META } from './lessons/lesson-index';
import { getLesson } from './lessons/lessons';
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
    RouterLink, MatIconModule, MdPipe, LessonQuizComponent, SequenceComponent, LayerExplorerComponent,
    CidrReaderComponent, HardenListComponent, SpotIssuesComponent, PbqPracticeComponent, FlowComponent, NestedBoxesComponent, PortStripComponent,
  ],
  templateUrl: './lesson.component.html',
  styleUrl: './lesson.component.scss',
})
export class LessonComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private content = inject(ContentService);
  private router = inject(Router);
  @ViewChild('related') private relatedSection?: ElementRef<HTMLElement>;

  /** Touch screens cannot hover, so the first tap previews a card and the second opens it. */
  readonly touch = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;
  preview: { key: string; kind: CardRef['kind']; name: string; left: number; top: number; card?: CardPreview; missing?: boolean } | null = null;
  private cards$?: Observable<Map<string, CardPreview>>;
  private hideTimer?: ReturnType<typeof setTimeout>;

  lesson: Lesson | undefined;
  readonly total = LESSON_META.length;
  readonly calloutIcons = CALLOUT_ICONS;

  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.lesson = getLesson(params.get('slug'));
      this.preview = null;
      this.scrollToTop();
    });
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
