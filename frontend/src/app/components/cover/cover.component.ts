import { Component, ElementRef, HostListener, OnInit, ViewChild, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const KEY = 'sp-cover';
/** A plain magnifier, so the tab's icon gives nothing away. */
const COVER_ICON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#5f6368" stroke-width="2.4"/><path d="M15 15l6 6" stroke="#5f6368" stroke-width="2.6" stroke-linecap="round"/></svg>');
const SHORTCUTS = ['News', 'Weather', 'Maps', 'Recipes', 'Translate'];

/** Original illustrated doodles in place of a logo, one a day, each linking to a search about its theme. */
const DOODLES = [
  { id: 'autumn', title: 'Celebrating autumn', query: 'autumn+leaves' },
  { id: 'night', title: 'Celebrating the night sky', query: 'meteor+shower+tonight' },
  { id: 'sea', title: 'Celebrating the world\'s oceans', query: 'world+oceans' },
  { id: 'balloons', title: 'Celebrating the first hot air balloon flight', query: 'first+hot+air+balloon+flight' },
] as const;
/** Stars for the night doodle: x, y, radius and twinkle delay. */
const STARS = [[30, 30, 1.6, 0], [92, 70, 1.2, 1.1], [150, 26, 1.8, 0.5], [196, 58, 1.2, 1.6], [236, 20, 1.5, 0.8], [282, 72, 1.1, 0.2],
  [384, 26, 1.7, 1.3], [400, 76, 1.2, 0.6], [128, 92, 1, 1.9], [20, 88, 1.2, 1.4]];

/**
 * The emergency screen. Escape covers the app with a plain search start page and swaps the tab's title and icon;
 * Escape again brings the app back exactly as it was. Searching opens a real web search in a new tab.
 * It stays up through a refresh (for this tab only), so reloading does not give the app away.
 */
@Component({
  selector: 'app-cover',
  standalone: true,
  templateUrl: './cover.component.html',
  styleUrl: './cover.component.scss',
})
export class CoverComponent implements OnInit {
  private doc = inject(DOCUMENT);
  readonly on = signal(false);
  readonly dots = Array.from({ length: 9 }, (_, i) => i);
  readonly shortcuts = SHORTCUTS;
  readonly stars = STARS;
  /** Today's doodle, so it changes from day to day like the real thing. */
  readonly doodle = DOODLES[Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000) % DOODLES.length];
  @ViewChild('q') private input?: ElementRef<HTMLInputElement>;
  private saved: { title: string; icons: [HTMLLinkElement, string | null][] } | null = null;

  ngOnInit() {
    let was = false;
    try { was = sessionStorage.getItem(KEY) === '1'; } catch { /* storage unavailable */ }
    if (was) this.show();
  }

  @HostListener('document:keydown', ['$event'])
  key(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.repeat) return;
    if (this.on()) { e.preventDefault(); this.hide(); return; }
    // Escape that closes the menu, a dialog or a menu panel does only that.
    if (e.defaultPrevented || this.doc.querySelector('.cdk-overlay-container .cdk-overlay-pane')) return;
    e.preventDefault();
    this.show();
  }

  /** After a search, clear the box so the next look at the screen shows nothing typed. */
  searched() {
    setTimeout(() => { if (this.input) this.input.nativeElement.value = ''; });
  }

  private show() {
    this.on.set(true);
    const links = [...this.doc.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    this.saved = { title: this.doc.title, icons: links.map(l => [l, l.getAttribute('href')]) };
    this.doc.title = 'New Tab';
    for (const l of links) l.setAttribute('href', COVER_ICON);
    try { sessionStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ }
    setTimeout(() => this.input?.nativeElement.focus());
  }

  private hide() {
    this.on.set(false);
    if (this.saved) {
      this.doc.title = this.saved.title;
      for (const [l, href] of this.saved.icons) if (href) l.setAttribute('href', href);
    }
    try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  }
}
