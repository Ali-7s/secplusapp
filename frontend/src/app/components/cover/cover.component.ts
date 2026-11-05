import { Component, ElementRef, HostListener, OnInit, ViewChild, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const KEY = 'sp-cover';
/** A plain magnifier, so the tab's icon gives nothing away. */
const COVER_ICON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.5" fill="none" stroke="#5f6368" stroke-width="2.4"/><path d="M15 15l6 6" stroke="#5f6368" stroke-width="2.6" stroke-linecap="round"/></svg>');
const SHORTCUTS = ['News', 'Weather', 'Maps', 'Recipes', 'Translate'];

/**
 * The emergency screen. Escape covers the app with a plain search start page and swaps the tab's title and icon;
 * Escape again brings the app back exactly as it was. Searching opens a real web search in a new tab.
 * It stays up through a refresh (for this tab only), so reloading does not give the app away.
 */
@Component({
  selector: 'app-cover',
  standalone: true,
  template: `
    @if (on()) {
      <div class="cover" role="search">
        <header class="top">
          <a href="https://mail.google.com" target="_blank" rel="noopener">Mail</a>
          <a href="https://www.google.com/imghp" target="_blank" rel="noopener">Images</a>
          <span class="apps" aria-hidden="true">
            @for (i of dots; track i) { <i></i> }
          </span>
          <span class="avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
          </span>
        </header>

        <main class="middle">
          <div class="mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.5"/><path d="M15 15l6 6"/></svg>
            <span>Search</span>
          </div>
          <form class="box-form" action="https://www.google.com/search" method="get" target="_blank" (submit)="searched()">
            <label class="box">
              <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="M15 15l6 6"/></svg>
              <input #q name="q" type="search" autocomplete="off" aria-label="Search the web" placeholder="Search the web or type a URL" />
              <svg class="mic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>
            </label>
          </form>
          <ul class="tiles" aria-hidden="true">
            @for (s of shortcuts; track s) {
              <li><span class="tile">{{ s[0] }}</span><span class="tl">{{ s }}</span></li>
            }
          </ul>
        </main>
      </div>
    }
  `,
  styleUrl: './cover.component.scss',
})
export class CoverComponent implements OnInit {
  private doc = inject(DOCUMENT);
  readonly on = signal(false);
  readonly dots = Array.from({ length: 9 }, (_, i) => i);
  readonly shortcuts = SHORTCUTS;
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
