import { Injectable, computed, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

export const THEMES: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'light', label: 'Light', icon: 'light_mode' },
  { mode: 'dark', label: 'Dark', icon: 'dark_mode' },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('light');
  readonly dark = computed(() => this.mode() === 'dark');
  readonly current = computed(() => THEMES.find(t => t.mode === this.mode())!);
  /** The theme the toolbar button switches to next. */
  readonly next = computed(() => THEMES[(THEMES.findIndex(t => t.mode === this.mode()) + 1) % THEMES.length]);

  constructor() {
    let saved: string | null = null;
    try { saved = localStorage.getItem('sp-theme'); } catch { /* storage unavailable */ }
    // The black theme was removed; anyone who had it gets dark.
    if (saved === 'black') saved = 'dark';
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    this.set(THEMES.some(t => t.mode === saved) ? saved as ThemeMode : prefersDark ? 'dark' : 'light');
  }

  cycle(): void {
    this.set(this.next().mode);
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('sp-theme', mode); } catch { /* storage unavailable */ }
  }
}
