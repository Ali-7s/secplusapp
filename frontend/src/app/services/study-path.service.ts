import { Injectable, signal } from '@angular/core';
import { STUDY_PHASES, RECOMMENDED_FLAT_ORDER, StudyPhase } from '../config/study-path.config';
import { Section, SectionProgress } from '../models/curriculum.model';

@Injectable({ providedIn: 'root' })
export class StudyPathService {
  readonly recommended = signal(false);

  readonly phases = STUDY_PHASES;

  constructor() {
    const saved = localStorage.getItem('sp-study-mode');
    this.recommended.set(saved === 'recommended');
  }

  toggle() {
    const next = !this.recommended();
    this.recommended.set(next);
    localStorage.setItem('sp-study-mode', next ? 'recommended' : 'standard');
  }

  getPhase(objectiveNumber: string): StudyPhase | undefined {
    return STUDY_PHASES.find(p => p.objectives.includes(objectiveNumber));
  }

  getPhaseIndex(objectiveNumber: string): number {
    return STUDY_PHASES.findIndex(p => p.objectives.includes(objectiveNumber));
  }

  /** Sort a section array by the recommended flat order. */
  sortSections<T extends { objectiveNumber: string }>(sections: T[]): T[] {
    return [...sections].sort((a, b) => {
      const ai = RECOMMENDED_FLAT_ORDER.indexOf(a.objectiveNumber);
      const bi = RECOMMENDED_FLAT_ORDER.indexOf(b.objectiveNumber);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  /** Returns the section id to study next in the recommended sequence. */
  getNextSection(allSections: Section[], progress: SectionProgress[]): string {
    const sorted = this.sortSections(allSections);
    const next = sorted.find(s => {
      const p = progress.find(x => x.sectionId === s.id);
      return p?.unlocked && !p.examPassed;
    });
    if (next) return next.id;
    // fallback: first unlocked in any order
    const fallback = progress.find(p => p.unlocked && !p.examPassed);
    return fallback?.sectionId ?? '1.1';
  }

  /** Sections in a phase that have been passed / total. */
  getPhaseProgress(phase: StudyPhase, allSections: Section[], progress: SectionProgress[]): { passed: number; total: number } {
    const sectionIds = allSections
      .filter(s => phase.objectives.includes(s.objectiveNumber))
      .map(s => s.id);
    const total = sectionIds.length;
    const passed = sectionIds.filter(id => progress.find(p => p.sectionId === id)?.examPassed).length;
    return { passed, total };
  }

  /** 0-based index of the first phase that still has work to do. */
  getCurrentPhaseIndex(allSections: Section[], progress: SectionProgress[]): number {
    for (let i = 0; i < STUDY_PHASES.length; i++) {
      const { passed, total } = this.getPhaseProgress(STUDY_PHASES[i], allSections, progress);
      if (passed < total) return i;
    }
    return STUDY_PHASES.length - 1;
  }
}
