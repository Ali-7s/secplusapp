import { TestBed } from '@angular/core/testing';
import { CoverComponent } from './cover.component';
import { ThemeService } from '../../services/theme.service';

describe('CoverComponent', () => {
  let title: string;
  beforeEach(() => {
    title = document.title;
    sessionStorage.removeItem('sp-cover');
  });
  afterEach(() => {
    document.title = title;
    sessionStorage.removeItem('sp-cover');
  });

  const press = (key: string, init: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
    document.dispatchEvent(e);
    return e;
  };

  it('covers the app on Escape, changes the tab title, and comes back on Escape', () => {
    const f = TestBed.createComponent(CoverComponent);
    f.detectChanges();
    press('Escape');
    f.detectChanges();
    expect(f.nativeElement.querySelector('.cover')).toBeTruthy();
    expect(document.title).toBe('New Tab');
    expect(sessionStorage.getItem('sp-cover')).toBe('1');
    press('Escape');
    f.detectChanges();
    expect(f.nativeElement.querySelector('.cover')).toBeNull();
    expect(document.title).toBe(title);
    expect(sessionStorage.getItem('sp-cover')).toBeNull();
  });

  it('leaves Escape alone when something else has already handled it', () => {
    const f = TestBed.createComponent(CoverComponent);
    f.detectChanges();
    const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    e.preventDefault();
    document.dispatchEvent(e);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.cover')).toBeNull();
    press('a');
    f.detectChanges();
    expect(f.nativeElement.querySelector('.cover')).toBeNull();
  });

  it('stays up through a refresh of the same tab', () => {
    sessionStorage.setItem('sp-cover', '1');
    const f = TestBed.createComponent(CoverComponent);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.cover')).toBeTruthy();
    press('Escape');
  });
});

describe('ThemeService', () => {
  let saved: string | null;
  beforeEach(() => { saved = localStorage.getItem('sp-theme'); });
  afterEach(() => {
    if (saved === null) localStorage.removeItem('sp-theme'); else localStorage.setItem('sp-theme', saved);
  });

  it('turns the removed black theme into dark', () => {
    localStorage.setItem('sp-theme', 'black');
    const theme = new ThemeService();
    expect(theme.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('sp-theme')).toBe('dark');
  });
});
