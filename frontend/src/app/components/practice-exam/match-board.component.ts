import { Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { CdkDragEnd, CdkDragMove, CdkDragStart, DragDropModule } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatchQuestion } from '../../models/exam.model';
import { MatchSegment, matchSegments } from '../../utils/exam-engine';

const SCROLL_EDGE_TOP = 110;
const SCROLL_EDGE_BOTTOM = 70;
const SCROLL_SPEED = 10;

/**
 * Answers a matching question. Prompts that share their answers get a bank to drag from, as on the real exam; prompts
 * with their own answers stay dropdowns. A tap or Enter on an answer and then on a slot does the same as a drag, which
 * phones and keyboards need. Answers stay in the bank after use, so the board never hints that one is used up.
 */
@Component({
  selector: 'app-match-board',
  standalone: true,
  imports: [DragDropModule, MatIconModule],
  templateUrl: './match-board.component.html',
  styleUrl: './match-board.component.scss',
})
export class MatchBoardComponent implements OnChanges, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);

  @Input({ required: true }) question!: MatchQuestion;
  @Input() picks: readonly (string | null | undefined)[] = [];
  @Input() disabled = false;
  @Output() picked = new EventEmitter<{ index: number; value: string }>();

  segments: MatchSegment[] = [];
  /** The answer tapped and waiting for a slot. */
  selected: { seg: number; value: string } | null = null;
  /** The slot under the answer being dragged. */
  hot: number | null = null;

  private justDragged = false;
  private pointer: { x: number; y: number } | null = null;
  private frame = 0;

  get hasBoard() { return this.segments.some(s => s.pool); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['question']) {
      this.segments = matchSegments(this.question);
      this.selected = null;
    }
    if (this.disabled) this.selected = null;
  }

  ngOnDestroy() { cancelAnimationFrame(this.frame); }

  isUsed(seg: MatchSegment, option: string) { return seg.prompts.some(i => this.picks[i] === option); }
  isSelected(s: number, option: string) { return this.selected?.seg === s && this.selected.value === option; }
  showsGroup(i: number) {
    const p = this.question.prompts;
    return !!p[i].group && (i === 0 || p[i - 1].group !== p[i].group);
  }

  // ── Tap or keyboard ──

  tapAnswer(s: number, value: string) {
    if (this.justDragged || this.disabled) return;
    this.selected = this.isSelected(s, value) ? null : { seg: s, value };
  }

  tapSlot(s: number, index: number) {
    if (this.justDragged || this.disabled || this.selected?.seg !== s) return;
    this.picked.emit({ index, value: this.selected.value });
    this.selected = null;
  }

  clear(index: number) { this.picked.emit({ index, value: '' }); }

  // ── Dragging ──

  dragStarted(e: CdkDragStart, s: number) {
    this.justDragged = true;
    this.selected = null;
    const scroller = this.host.nativeElement.closest('mat-sidenav-content');
    if (!scroller) return;
    const dragged = e.source.getRootElement();
    const startTop = scroller.scrollTop;
    this.zone.runOutsideAngular(() => {
      const step = () => {
        const point = this.pointer;
        if (point) {
          const box = scroller.getBoundingClientRect();
          if (point.y < box.top + SCROLL_EDGE_TOP) scroller.scrollBy(0, -SCROLL_SPEED);
          else if (point.y > box.bottom - SCROLL_EDGE_BOTTOM) scroller.scrollBy(0, SCROLL_SPEED);
          // The drag library only follows window scrolling, so without this the answer would ride away with the page.
          dragged.style.translate = `0 ${scroller.scrollTop - startTop}px`;
          const hot = this.slotAt(point, s);
          if (hot !== this.hot) this.zone.run(() => this.hot = hot);
        }
        this.frame = requestAnimationFrame(step);
      };
      this.frame = requestAnimationFrame(step);
    });
  }

  dragMoved(e: CdkDragMove, s: number) {
    this.pointer = e.pointerPosition;
    this.hot = this.slotAt(e.pointerPosition, s);
  }

  /** Lands an answer on the slot under it. `from` is the slot it was dragged out of, if any. */
  dragEnded(e: CdkDragEnd, s: number, value: string, from?: number) {
    cancelAnimationFrame(this.frame);
    this.pointer = null;
    this.hot = null;
    const to = this.slotAt(e.dropPoint, s);
    if (to !== null && to !== from) {
      this.picked.emit({ index: to, value });
      if (from !== undefined) this.picked.emit({ index: from, value: '' });
    } else if (to === null && from !== undefined && this.overBank(e.dropPoint, s)) {
      this.picked.emit({ index: from, value: '' });
    }
    e.source.getRootElement().style.translate = '';
    e.source.reset();
    // The click that ends a drag must not count as a tap.
    setTimeout(() => this.justDragged = false, 50);
  }

  private under(point: { x: number; y: number }) { return document.elementsFromPoint(point.x, point.y); }

  private slotAt(point: { x: number; y: number }, s: number): number | null {
    const slot = this.under(point).find(el => el.classList.contains('slot') && el.getAttribute('data-seg') === String(s));
    return slot ? Number(slot.getAttribute('data-slot')) : null;
  }

  private overBank(point: { x: number; y: number }, s: number) {
    return this.under(point).some(el => el.classList.contains('bank') && el.getAttribute('data-seg') === String(s));
  }
}
