import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GuessToggleComponent } from './guess-toggle.component';

describe('GuessToggleComponent', () => {
  let fixture: ComponentFixture<GuessToggleComponent>;
  const button = () => fixture.nativeElement.querySelector('button') as HTMLButtonElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(GuessToggleComponent);
    fixture.detectChanges();
  });

  it('reports a toggle and shows whether it is on', () => {
    let toggles = 0;
    fixture.componentInstance.toggled.subscribe(() => toggles++);
    button().click();
    expect(toggles).toBe(1);
    expect(button().getAttribute('aria-pressed')).toBe('false');

    fixture.componentRef.setInput('on', true);
    fixture.detectChanges();
    expect(button().getAttribute('aria-pressed')).toBe('true');
    expect(button().classList).toContain('on');
  });

  it('cannot be changed once the question is answered', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(button().disabled).toBeTrue();
  });
});
