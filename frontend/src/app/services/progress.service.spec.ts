import { TestBed } from '@angular/core/testing';
import { ProgressService } from './progress.service';
import { ProgressData, emptyProgress } from '../utils/progress';

describe('ProgressService with the app open in two tabs', () => {
  const KEY = 'sp-progress';
  let progress: ProgressService;

  /** What the other tab writes: its own whole copy, which knows nothing of this tab's changes. */
  const otherTabCopy = (edit: (d: ProgressData) => void) => {
    const d = emptyProgress();
    edit(d);
    return JSON.stringify(d);
  };
  /** The other tab saves; the browser then tells this tab (never the tab that wrote). */
  const otherTabSaves = (value: string | null) => {
    if (value === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
    window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: value }));
  };
  const stored = () => JSON.parse(localStorage.getItem(KEY)!) as ProgressData;

  beforeEach(() => {
    localStorage.removeItem(KEY);
    progress = TestBed.inject(ProgressService);
  });

  afterEach(() => localStorage.removeItem(KEY));

  it('keeps work saved in another tab, and keeps it after this tab saves something else', () => {
    progress.setLessonWork('crypto', 'hashlab', { text: 'mine' });
    const later = Date.now() + 1000;
    otherTabSaves(otherTabCopy(d => { d.lessons['pki'] = { pbqs: {}, at: later, work: { certs: { v: { picked: 2 }, at: later } } }; }));

    expect(progress.lessonWork('pki', 'certs')).toEqual({ picked: 2 });
    expect(progress.lessonWork('crypto', 'hashlab')).toEqual({ text: 'mine' });
    // The other tab's copy lacked this tab's work, so the combination was written back.
    expect(stored().lessons['crypto']).toBeDefined();

    progress.setLessonWork('crypto', 'keys', { step: 1 });
    expect(stored().lessons['pki'].work?.['certs'].v).toEqual({ picked: 2 });
    expect(stored().lessons['crypto'].work?.['hashlab'].v).toEqual({ text: 'mine' });
  });

  it('combines work on the same lesson exercise by exercise', () => {
    progress.setLessonWork('logs', 'hunt:Night', { pins: [3] });
    const later = Date.now() + 1000;
    otherTabSaves(otherTabCopy(d => { d.lessons['logs'] = { pbqs: {}, at: later, part: 4, work: { 'hunt:Capture': { v: { pins: [7] }, at: later } } }; }));

    expect(progress.lessonWork('logs', 'hunt:Night')).toEqual({ pins: [3] });
    expect(progress.lessonWork('logs', 'hunt:Capture')).toEqual({ pins: [7] });
    expect(progress.lessonRecord('logs')?.part).toBe(4);
  });

  it('does not write again when the other tab already has everything, so the tabs do not answer each other forever', () => {
    progress.setLessonWork('risk', 'riskcalc', { sle: 100 });
    const same = localStorage.getItem(KEY);
    const setItem = spyOn(Storage.prototype, 'setItem').and.callThrough();
    otherTabSaves(same);
    expect(setItem.calls.allArgs().filter(([k]) => k === KEY).length).toBe(1);
  });

  it('does not count another tab\'s changes as its own', () => {
    const before = progress.changes();
    otherTabSaves(otherTabCopy(d => { d.days['2026-11-01'] = 3; }));
    expect(progress.data().days['2026-11-01']).toBe(3);
    expect(progress.changes()).toBe(before);
  });

  it('forgets with the other tab, so its next save does not bring the data back', () => {
    progress.setLessonWork('backups', 'backups', { week: 2 });
    otherTabSaves(null);
    expect(progress.hasProgress()).toBeFalse();
    progress.setLessonPart('pki', 1);
    expect(stored().lessons['backups']).toBeUndefined();
  });

  it('records several cards answered elsewhere at once, and counts only whole, checked answers as early reviews', () => {
    const day = 86_400_000;
    const learned = { state: 'review' as const, step: 0, interval: 10, ease: 2.5, due: Date.now() + 5 * day, reps: 3, lapses: 0, right: 3, wrong: 0, at: Date.now() - 5 * day, stability: 10, difficulty: 5, last: Date.now() - 5 * day };
    otherTabSaves(otherTabCopy(d => { d.cards['ref:proto:RDP'] = { ...learned }; d.cards['ref:proto:SSH / SFTP / SCP'] = { ...learned }; d.cards['ref:proto:Telnet'] = { ...learned }; }));

    progress.recordCards('ref', [{ name: 'proto:RDP', known: true, review: true }, { name: 'proto:SSH / SFTP / SCP', known: true }, { name: 'proto:Telnet', known: false }, { name: 'proto:DNS', known: true }]);

    // A whole answer reviews the card although it was not due; a partial one is only counted.
    expect(progress.card('ref', 'proto:RDP')!.due).toBeGreaterThan(learned.due);
    expect(progress.card('ref', 'proto:SSH / SFTP / SCP')!.due).toBe(learned.due);
    expect(progress.card('ref', 'proto:SSH / SFTP / SCP')!.right).toBe(4);
    expect(progress.card('ref', 'proto:Telnet')!.state).toBe('relearning');
    expect(progress.card('ref', 'proto:DNS')!.state).toBe('learning');
    // Nothing answered here used up Review mode's new cards for today.
    expect(progress.newLeftToday('ref')).toBe(progress.data().review.newPerDay);
    progress.recordCards('ref', []);
  });

  it('ignores other keys', () => {
    progress.setLessonWork('crypto', 'hashlab', { text: 'mine' });
    window.dispatchEvent(new StorageEvent('storage', { key: 'sp-theme', newValue: 'dark' }));
    expect(progress.lessonWork('crypto', 'hashlab')).toEqual({ text: 'mine' });
  });
});
