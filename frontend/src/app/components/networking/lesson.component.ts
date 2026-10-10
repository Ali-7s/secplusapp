import { Component, ElementRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CalloutKind, Lesson } from './networking.model';
import { LESSON_META } from './lessons/lesson-index';
import { getLesson } from './lessons/lessons';
import { MdPipe } from './blocks/md.pipe';
import { LessonQuizComponent } from './blocks/lesson-quiz.component';
import { SequenceComponent } from './blocks/sequence.component';
import { LayerExplorerComponent } from './blocks/layer-explorer.component';
import { CidrReaderComponent } from './blocks/cidr-reader.component';
import { HardenListComponent } from './blocks/harden-list.component';
import { SpotIssuesComponent } from './blocks/spot-issues.component';
import { FlowComponent, NestedBoxesComponent, PortStripComponent } from './blocks/visuals.component';

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
    CidrReaderComponent, HardenListComponent, SpotIssuesComponent, FlowComponent, NestedBoxesComponent, PortStripComponent,
  ],
  templateUrl: './lesson.component.html',
  styleUrl: './lesson.component.scss',
})
export class LessonComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  lesson: Lesson | undefined;
  readonly total = LESSON_META.length;
  readonly calloutIcons = CALLOUT_ICONS;

  constructor() {
    inject(ActivatedRoute).paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.lesson = getLesson(params.get('slug'));
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

  /** The app scrolls inside the side-nav content area, not the window. */
  private scrollToTop() {
    const scroller = this.host.nativeElement.closest('mat-sidenav-content');
    (scroller ?? document.scrollingElement)?.scrollTo({ top: 0 });
  }
}
