import { Injectable, inject } from '@angular/core';
import { ProgressService } from '../../services/progress.service';
import { TaskState, Ticket } from './engine/grade';
import { UserFiles } from './engine/vfs';

/** A shift in progress, saved with study progress so it survives a refresh and syncs between devices. */
export interface ShiftSave {
  clock: number;
  started?: boolean;
  tickets: Record<string, Ticket>;
  tasks: Record<string, TaskState>;
  files?: UserFiles;
  ended?: boolean;
  best?: number;
}

/** This device's screen: the terminal's scrollback and history, the SIEM search, the open tabs. */
export interface ShiftScreen {
  term?: { lines: TermLine[]; history: string[]; cwd: string };
  siem?: { query: string; range: string };
  left?: 'alerts' | 'tasks';
  right?: 'terminal' | 'siem';
  open?: string | null;
  brief?: boolean;
  speed?: number;
}

export interface TermLine { k: 'in' | 'out' | 'err' | 'note'; t: string }

const SLUG = 'soc-lab';

@Injectable({ providedIn: 'root' })
export class SocStore {
  private progress = inject(ProgressService);

  load(id: string): ShiftSave | undefined {
    return this.progress.lessonWork(SLUG, `shift:${id}`) as ShiftSave | undefined;
  }

  save(id: string, s: ShiftSave) {
    this.progress.setLessonWork(SLUG, `shift:${id}`, s);
  }

  /** Starts the shift again; the best score is kept. */
  reset(id: string) {
    const best = this.load(id)?.best;
    this.progress.setLessonWork(SLUG, `shift:${id}`, best ? { clock: 0, tickets: {}, tasks: {}, best } : null);
    try { localStorage.removeItem(screenKey(id)); } catch { /* storage unavailable */ }
  }

  screen(id: string): ShiftScreen {
    try {
      const v = JSON.parse(localStorage.getItem(screenKey(id)) ?? 'null');
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  }

  saveScreen(id: string, s: ShiftScreen) {
    try { localStorage.setItem(screenKey(id), JSON.stringify(s)); } catch { /* storage full or unavailable */ }
  }
}

const screenKey = (id: string) => `sp-soc-${id}`;
