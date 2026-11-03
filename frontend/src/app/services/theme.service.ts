import { Injectable, computed, signal } from '@angular/core';

/** Black is the dark theme on true black: it sets data-theme="dark" too, so every dark-mode style applies. */
export type ThemeMode = 'light' | 'dark' | 'black';

export const THEMES: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'light', label: 'Light', icon: 'light_mode' },
  { mode: 'dark', label: 'Dark', icon: 'dark_mode' },
  { mode: 'black', label: 'Black', icon: 'contrast' },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('light');
  readonly dark = computed(() => this.mode() !== 'light');
  readonly current = computed(() => THEMES.find(t => t.mode === this.mode())!);
  /** The theme the toolbar button switches to next. */
  readonly next = computed(() => THEMES[(THEMES.findIndex(t => t.mode === this.mode()) + 1) % THEMES.length]);

  constructor() {
    let saved: string | null = null;
    try { saved = localStorage.getItem('sp-theme'); } catch { /* storage unavailable */ }
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    this.set(THEMES.some(t => t.mode === saved) ? saved as ThemeMode : prefersDark ? 'dark' : 'light');
  }

  cycle(): void {
    this.set(this.next().mode);
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    const root = document.documentElement;
    root.setAttribute('data-theme', mode === 'light' ? 'light' : 'dark');
    if (mode === 'black') root.setAttribute('data-shade', 'black');
    else root.removeAttribute('data-shade');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'black' ? '#000000' : '#1d4ed8');
    try { localStorage.setItem('sp-theme', mode); } catch { /* storage unavailable */ }
  }
}
