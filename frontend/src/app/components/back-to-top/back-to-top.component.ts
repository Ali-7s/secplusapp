import { AfterViewInit, Component, DestroyRef, ElementRef, NgZone, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

/** How far the page has to be scrolled before the button appears (about one screenful). */
export const SHOW_AFTER_PX = 600;

/**
 * A round "back to top" button that appears once the page has been scrolled a long way, so you can get back
 * to the search box and filters without dragging the scrollbar through hundreds of cards.
 *
 * It is placed once in the app shell and works on every page. The app scrolls inside the side-nav content
 * area rather than the window, so that is the element it watches and scrolls.
 */
@Component({
  selector: 'app-back-to-top',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (visible()) {
      <button type="button" class="to-top" aria-label="Back to top" title="Back to top" (click)="jump()">
        <mat-icon aria-hidden="true">arrow_upward</mat-icon>
      </button>
    }
  `,
  styles: [`
    .to-top {
      position: fixed; right: 20px; bottom: 20px; z-index: 50;
      width: 48px; height: 48px; border: 0; border-radius: 50%; padding: 0; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--c-accent-solid); color: var(--c-on-accent);
      box-shadow: var(--shadow-lg);
      animation: to-top-in .18s ease-out both;
      transition: transform .15s ease, filter .15s ease;
    }
    .to-top:hover { filter: brightness(1.12); transform: translateY(-2px); }
    .to-top:active { transform: translateY(0); }
    @keyframes to-top-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 600px) { .to-top { right: 14px; bottom: 14px; } }
  `],
})
export class BackToTopComponent implements AfterViewInit {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router, { optional: true });

  readonly visible = signal(false);

  private scroller: HTMLElement | null = null;

  ngAfterViewInit() {
    this.scroller = this.host.nativeElement.closest<HTMLElement>('mat-sidenav-content')
      ?? (document.scrollingElement as HTMLElement | null);
    if (!this.scroller) return;

    // Scroll events arrive constantly. Listen outside Angular and only re-enter when the button toggles.
    const target: EventTarget = this.scroller === document.scrollingElement ? window : this.scroller;
    const onScroll = () => this.update();
    this.zone.runOutsideAngular(() => target.addEventListener('scroll', onScroll, { passive: true }));
    this.destroyRef.onDestroy(() => target.removeEventListener('scroll', onScroll));

    // A new page can change the scroll position (and the page height) without the user scrolling.
    this.router?.events
      .pipe(filter(event => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.update());

    this.update();
  }

  jump() {
    if (!this.scroller) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.scroller.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    // The button disappears at the top, so give keyboard focus to the page instead of losing it.
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }

  private update() {
    const show = (this.scroller?.scrollTop ?? 0) > SHOW_AFTER_PX;
    if (show !== this.visible()) this.zone.run(() => this.visible.set(show));
  }
}
