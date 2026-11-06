import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SHIFTS } from './engine/shifts';
import { buildWorld, shellFor } from './engine/world';
import { SocTerminalComponent } from './terminal.component';

describe('SocTerminalComponent', () => {
  let fixture: ComponentFixture<SocTerminalComponent>;

  function create(saved?: SocTerminalComponent['saved']) {
    const world = buildWorld(SHIFTS[0], { now: SHIFTS[0].start });
    fixture = TestBed.createComponent(SocTerminalComponent);
    fixture.componentRef.setInput('shell', shellFor(world));
    if (saved) fixture.componentRef.setInput('saved', saved);
    // Tests run in development mode, so this also fails on an ExpressionChangedAfterItHasBeenChecked error.
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [SocTerminalComponent] }));

  it('shows the welcome line on its first render', () => {
    const el = create();
    expect(el.querySelector('.ln.note')?.textContent).toContain('Fernco SOC workstation');
  });

  it('restores the saved scrollback, history and folder before its first render', () => {
    const el = create({ lines: [{ k: 'in', t: 'analyst@soc-ws:~$ ls' }, { k: 'out', t: 'notes.txt' }], history: ['ls'], cwd: '/var/log' });
    const shown = [...el.querySelectorAll('.ln')].map(l => l.textContent);
    expect(shown).toEqual(['analyst@soc-ws:~$ ls', 'notes.txt']);
    expect(fixture.componentInstance.prompt).toBe('analyst@soc-ws:/var/log$ ');
    expect(fixture.componentInstance.history).toEqual(['ls']);
  });
});
