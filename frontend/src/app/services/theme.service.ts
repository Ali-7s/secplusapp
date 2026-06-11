import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal(false);

  constructor() {
    const saved = localStorage.getItem('sp-theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    this.apply(saved === 'dark' || (!saved && prefersDark));
  }

  toggle(): void {
    this.apply(!this.dark());
  }

  private apply(dark: boolean): void {
    this.dark.set(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('sp-theme', dark ? 'dark' : 'light');
  }
}
