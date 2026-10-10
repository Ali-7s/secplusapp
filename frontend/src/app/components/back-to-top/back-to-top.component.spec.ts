import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackToTopComponent, SHOW_AFTER_PX } from './back-to-top.component';

describe('BackToTopComponent', () => {
  let fixture: ComponentFixture<BackToTopComponent>;
  let tallPage: HTMLElement;
  let main: HTMLElement;

  const button = () => fixture.nativeElement.querySelector('button.to-top') as HTMLButtonElement | null;
  const scrollTo = (top: number) => {
    document.scrollingElement!.scrollTop = top;
    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    // Make the test page tall enough to scroll, with a main element like the app shell has.
    tallPage = document.createElement('div');
    tallPage.style.height = '5000px';
    document.body.appendChild(tallPage);
    main = document.createElement('main');
    main.id = 'main-content';
    main.tabIndex = -1;
    document.body.appendChild(main);

    fixture = TestBed.createComponent(BackToTopComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.scrollingElement!.scrollTop = 0;
    tallPage.remove();
    main.remove();
  });

  it('is hidden until the page has been scrolled a long way', () => {
    expect(button()).toBeNull();
    scrollTo(SHOW_AFTER_PX - 100);
    expect(button()).toBeNull();
    scrollTo(SHOW_AFTER_PX + 400);
    expect(button()).not.toBeNull();
  });

  it('hides again when you scroll back near the top', () => {
    scrollTo(2000);
    expect(button()).not.toBeNull();
    scrollTo(100);
    expect(button()).toBeNull();
  });

  it('is labelled for screen readers', () => {
    scrollTo(2000);
    expect(button()!.getAttribute('aria-label')).toBe('Back to top');
  });

  it('scrolls to the top when clicked and moves keyboard focus to the page', () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList); // reduced motion: jump straight away
    scrollTo(3000);
    button()!.click();
    expect(document.scrollingElement!.scrollTop).toBe(0);
    expect(document.activeElement).toBe(main);

    window.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(button()).toBeNull();
  });

  it('asks for smooth scrolling unless the user prefers reduced motion', () => {
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    // scrollTo has two call shapes (options, or x and y), so type the spy loosely.
    const scrollSpy = spyOn(document.scrollingElement!, 'scrollTo') as unknown as jasmine.Spy;
    scrollTo(3000);
    button()!.click();
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
