import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FcMode, FcModeSwitchComponent } from './fc-mode-switch.component';

describe('FcModeSwitchComponent', () => {
  let fixture: ComponentFixture<FcModeSwitchComponent>;

  const buttons = () => Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'));

  beforeEach(() => {
    fixture = TestBed.createComponent(FcModeSwitchComponent);
    fixture.componentRef.setInput('mode', 'flip');
    fixture.detectChanges();
  });

  it('offers flip and review', () => {
    expect(buttons().map(b => b.querySelector('span')!.textContent)).toEqual(['Flip', 'Review']);
    expect(buttons().map(b => b.querySelector('mat-icon')!.textContent)).toEqual(['flip', 'event_repeat']);
  });

  it('marks the current mode as pressed', () => {
    expect(buttons().map(b => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);

    fixture.componentRef.setInput('mode', 'review');
    fixture.detectChanges();
    expect(buttons().map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(buttons()[1].classList).toContain('active');
  });

  it('tells the page which mode was chosen', () => {
    const chosen: FcMode[] = [];
    fixture.componentInstance.modeChange.subscribe((mode: FcMode) => chosen.push(mode));

    buttons()[1].click();
    buttons()[0].click();
    expect(chosen).toEqual(['review', 'flip']);
  });
});
