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

  it('ignores other keys', () => {
    progress.setLessonWork('crypto', 'hashlab', { text: 'mine' });
    window.dispatchEvent(new StorageEvent('storage', { key: 'sp-theme', newValue: 'dark' }));
    expect(progress.lessonWork('crypto', 'hashlab')).toEqual({ text: 'mine' });
  });
});
