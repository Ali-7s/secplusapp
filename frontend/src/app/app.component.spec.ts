import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
      ],
    }),
  );

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('exposes the expected nav items', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;
    const paths = app.navItems.map(i => i.path);
    expect(paths).toEqual(['/acronyms', '/terms', '/reference']);
    expect(paths).not.toContain('/exam/full'); // Practice exam was removed
    expect(paths).not.toContain('/progress'); // Progress page was removed
  });
});
