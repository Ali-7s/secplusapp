import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { ContentService } from '../../services/content.service';
import { ProgressService } from '../../services/progress.service';
import { Section } from '../../models/curriculum.model';
import { Question, ExamResult, ExamSubmission } from '../../models/question.model';
import { Flashcard, ConceptExplanation, Lab, Term } from '../../models/flashcard.model';

@Component({
  selector: 'app-section-study',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, MatTabsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatProgressBarModule, MatChipsModule, MatProgressSpinnerModule,
    MatDividerModule, MatSnackBarModule, MatDialogModule, MatBadgeModule
  ],
  templateUrl: './section-study.component.html',
  styleUrl: './section-study.component.scss'
})
export class SectionStudyComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private contentService = inject(ContentService);
  private progressService = inject(ProgressService);
  private snackBar = inject(MatSnackBar);
  private sanitizer = inject(DomSanitizer);

  protected readonly Object = Object;

  terms: Term[] = [];

  sectionId = '';
  section: Section | null = null;
  sectionProgress: any = null;
  isUnlocked = false;
  initialTabIndex = 0;

  // Learn tab
  explanation: ConceptExplanation | null = null;
  loadingExplanation = false;
  explanationError = '';

  // Flashcards tab
  flashcards: Flashcard[] = [];
  loadingFlashcards = false;
  flashcardFlipped = false;
  fcWriteAnswer = '';    // user's typed recall attempt before flip
  fcPass = 1;
  fcQueue: number[] = [];         // card indices for this pass
  fcQueuePos = 0;                  // position within fcQueue
  fcMastered = new Set<number>(); // "Got It" — removed from future passes
  fcRetry = new Set<number>();    // "Still Learning" — replayed next pass
  fcDone = false;

  // Practice tab
  practiceQuestions: Question[] = [];
  loadingPractice = false;
  practiceState: 'idle' | 'answering' | 'review' = 'idle';
  currentPracticeIndex = 0;
  practiceAnswers: Record<string, string | string[]> = {};
  practiceShowExplanation: Record<string, boolean> = {};
  practiceScore = 0;
  practiceTotal = 0;

  // Exam tab
  examQuestions: Question[] = [];
  loadingExam = false;
  examState: 'idle' | 'answering' | 'result' = 'idle';
  currentExamIndex = 0;
  examAnswers: Record<string, string | string[]> = {};
  examFlagged = new Set<string>();
  examResult: ExamResult | null = null;
  examStartTime = 0;
  examTimerInterval: any;
  examElapsedSeconds = 0;

  // Lab tab
  lab: Lab | null = null;
  loadingLab = false;
  labError = '';
  labStepExpanded = new Set<number>();
  labAnswers: Record<number, string> = {};
  labAnswerShown = new Set<number>();
  labCompleted = false;

  // Regenerating flags
  regeneratingExplanation = false;
  regeneratingFlashcards = false;
  regeneratingPractice = false;
  regeneratingExam = false;
  regeneratingLab = false;

  ngOnInit() {
    this.sectionId = this.route.snapshot.paramMap.get('id')!;
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'practice') {
      this.initialTabIndex = 2;
      this.loadPractice();
    }
    this.contentService.getTerms().subscribe({ next: t => this.terms = t, error: () => {} });
    this.loadExplanation();

    this.contentService.getSection(this.sectionId).subscribe({
      next: s => this.section = s,
      error: () => {}
    });
    this.progressService.getSectionProgress(this.sectionId).subscribe({
      next: p => {
        this.sectionProgress = p;
        this.isUnlocked = true;
        this.labCompleted = p.labCompleted;
      },
      error: () => { this.isUnlocked = true; }
    });
  }

  // ── Learn ──────────────────────────────────────────────────────────
  loadExplanation() {
    if (this.explanation || this.loadingExplanation) return;
    this.loadingExplanation = true;
    this.explanationError = '';
    this.contentService.getExplanation(this.sectionId).subscribe({
      next: e => { this.explanation = e; this.loadingExplanation = false; },
      error: err => { this.explanationError = err.message; this.loadingExplanation = false; }
    });
  }

  // ── Flashcards ─────────────────────────────────────────────────────
  loadFlashcards() {
    if (this.flashcards.length || this.loadingFlashcards) return;
    this.loadingFlashcards = true;
    this.contentService.getFlashcards(this.sectionId).subscribe({
      next: cards => {
        this.flashcards = cards;
        this.fcQueue = cards.map((_, i) => i);
        this.loadingFlashcards = false;
      },
      error: err => { this.loadingFlashcards = false; this.snackBar.open(err.message, 'OK', { duration: 4000 }); }
    });
  }

  get fcCard(): Flashcard | null {
    return this.fcQueue.length ? this.flashcards[this.fcQueue[this.fcQueuePos]] : null;
  }

  flipCard() { this.flashcardFlipped = !this.flashcardFlipped; }

  nextCard(known: boolean) {
    const idx = this.fcQueue[this.fcQueuePos];
    if (known) {
      this.fcMastered.add(idx);
    } else {
      this.fcRetry.add(idx);
    }
    this.flashcardFlipped = false;
    this.fcWriteAnswer = '';

    if (this.fcQueuePos < this.fcQueue.length - 1) {
      this.fcQueuePos++;
    } else {
      if (this.fcRetry.size > 0) {
        this.fcPass++;
        this.fcQueue = [...this.fcRetry];
        this.fcRetry.clear();
        this.fcQueuePos = 0;
      } else {
        this.fcDone = true;
        this.contentService.updateFlashcardProgress(this.sectionId, this.fcMastered.size).subscribe();
      }
    }
  }

  prevCard() {
    if (this.fcQueuePos > 0) { this.fcQueuePos--; this.flashcardFlipped = false; this.fcWriteAnswer = ''; }
  }

  resetFlashcards() {
    this.fcPass = 1;
    this.fcWriteAnswer = '';
    this.fcQueue = this.flashcards.map((_, i) => i);
    this.fcQueuePos = 0;
    this.flashcardFlipped = false;
    this.fcMastered.clear();
    this.fcRetry.clear();
    this.fcDone = false;
  }

  // ── Practice ──────────────────────────────────────────────────────
  loadPractice() {
    if (this.practiceQuestions.length || this.loadingPractice) return;
    this.loadingPractice = true;
    this.contentService.getPracticeQuestions(this.sectionId, 15).subscribe({
      next: q => { this.practiceQuestions = q; this.loadingPractice = false; this.practiceState = 'answering'; },
      error: err => { this.loadingPractice = false; this.snackBar.open(err.message, 'OK', { duration: 4000 }); }
    });
  }

  selectPracticeAnswer(questionId: string, answer: string) {
    const q = this.practiceQuestions.find(x => x.id === questionId);
    if (!q) return;
    if (q.type === 'MULTI_SELECT') {
      const curr = (this.practiceAnswers[questionId] as string[] | undefined) ?? [];
      const idx = curr.indexOf(answer);
      this.practiceAnswers[questionId] = idx >= 0 ? curr.filter(a => a !== answer) : [...curr, answer];
    } else {
      this.practiceAnswers[questionId] = answer;
    }
  }

  isPracticeSelected(questionId: string, option: string): boolean {
    const ans = this.practiceAnswers[questionId];
    return Array.isArray(ans) ? ans.includes(option) : ans === option;
  }

  submitPractice() {
    let correct = 0;
    this.practiceQuestions.forEach(q => {
      const given = this.practiceAnswers[q.id];
      const isCorrect = q.type === 'MULTI_SELECT'
        ? JSON.stringify([...(given as string[] || [])].sort()) === JSON.stringify([...(q.correctAnswers || [])].sort())
        : given === q.correctAnswer;
      if (isCorrect) correct++;
    });
    this.practiceScore = correct;
    this.practiceTotal = this.practiceQuestions.length;
    this.practiceState = 'review';
    this.progressService.updatePractice(this.sectionId, this.practiceTotal, this.practiceScore).subscribe();
  }

  isPracticeCorrect(q: Question): boolean {
    const given = this.practiceAnswers[q.id];
    if (q.type === 'MULTI_SELECT') {
      return JSON.stringify([...(given as string[] || [])].sort()) === JSON.stringify([...(q.correctAnswers || [])].sort());
    }
    return given === q.correctAnswer;
  }

  isCorrectOption(q: Question, opt: string): boolean {
    if (q.type === 'MULTI_SELECT') return (q.correctAnswers || []).includes(opt.charAt(0));
    return opt.startsWith(q.correctAnswer ?? '##');
  }

  reloadPractice() {
    this.practiceQuestions = [];
    this.practiceAnswers = {};
    this.practiceState = 'idle';
    this.practiceShowExplanation = {};
    this.loadPractice();
  }

  // ── Section Exam ───────────────────────────────────────────────────
  loadExam() {
    if (this.examQuestions.length || this.loadingExam) return;
    this.loadingExam = true;
    this.contentService.getSectionExam(this.sectionId).subscribe({
      next: q => { this.examQuestions = q; this.loadingExam = false; this.startExam(); },
      error: err => { this.loadingExam = false; this.snackBar.open(err.message, 'OK', { duration: 4000 }); }
    });
  }

  startExam() {
    this.examState = 'answering';
    this.currentExamIndex = 0;
    this.examAnswers = {};
    this.examFlagged.clear();
    this.examStartTime = Date.now();
    this.examElapsedSeconds = 0;
    this.examTimerInterval = setInterval(() => this.examElapsedSeconds++, 1000);
  }

  selectExamAnswer(questionId: string, answer: string) {
    const q = this.examQuestions.find(x => x.id === questionId);
    if (!q) return;
    if (q.type === 'MULTI_SELECT') {
      const curr = (this.examAnswers[questionId] as string[] | undefined) ?? [];
      const idx = curr.indexOf(answer);
      this.examAnswers[questionId] = idx >= 0 ? curr.filter(a => a !== answer) : [...curr, answer];
    } else {
      this.examAnswers[questionId] = answer;
    }
  }

  isExamSelected(questionId: string, option: string): boolean {
    const ans = this.examAnswers[questionId];
    return Array.isArray(ans) ? ans.includes(option) : ans === option;
  }

  toggleFlag(questionId: string) {
    this.examFlagged.has(questionId) ? this.examFlagged.delete(questionId) : this.examFlagged.add(questionId);
  }

  submitExam() {
    clearInterval(this.examTimerInterval);
    const answers: ExamSubmission['answers'] = this.examQuestions.map(q => ({
      questionId: q.id,
      selectedAnswer: typeof this.examAnswers[q.id] === 'string' ? this.examAnswers[q.id] as string : undefined,
      selectedAnswers: Array.isArray(this.examAnswers[q.id]) ? this.examAnswers[q.id] as string[] : undefined
    }));
    const sub: ExamSubmission = {
      sectionId: this.sectionId,
      examType: 'SECTION',
      answers,
      timeTakenSeconds: this.examElapsedSeconds
    };
    this.contentService.submitExam(sub).subscribe({
      next: r => { this.examResult = r; this.examState = 'result'; },
      error: err => this.snackBar.open(err.message, 'OK', { duration: 4000 })
    });
  }

  retakeExam() {
    this.examQuestions = [];
    this.examState = 'idle';
    this.examResult = null;
    this.loadExam();
  }

  get examTimerDisplay(): string {
    const m = Math.floor(this.examElapsedSeconds / 60).toString().padStart(2, '0');
    const s = (this.examElapsedSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  get examAnsweredCount(): number {
    return Object.keys(this.examAnswers).filter(k => {
      const v = this.examAnswers[k];
      return Array.isArray(v) ? v.length > 0 : !!v;
    }).length;
  }

  // ── Lab ────────────────────────────────────────────────────────────
  loadLab() {
    if (this.lab || this.loadingLab) return;
    this.loadingLab = true;
    this.labError = '';
    this.contentService.getLab(this.sectionId).subscribe({
      next: l => { this.lab = l; this.loadingLab = false; },
      error: err => { this.labError = err.message; this.loadingLab = false; }
    });
  }

  toggleStep(i: number) {
    this.labStepExpanded.has(i) ? this.labStepExpanded.delete(i) : this.labStepExpanded.add(i);
  }

  showLabAnswer(i: number) { this.labAnswerShown.add(i); }

  completeLab() {
    this.contentService.completeLab(this.sectionId).subscribe({
      next: () => { this.labCompleted = true; this.snackBar.open('Lab completed! Great work.', '🎉', { duration: 3000 }); }
    });
  }

  onTabChange(index: number) {
    if (index === 0) this.loadExplanation();
    if (index === 1) this.loadFlashcards();
    if (index === 2 && this.practiceState === 'idle') this.loadPractice();
    if (index === 3) this.loadLab();
  }

  // ── Regenerate ─────────────────────────────────────────────────────
  regenerateExplanation() {
    this.regeneratingExplanation = true;
    this.explanation = null;
    this.explanationError = '';
    this.contentService.regenerateExplanation(this.sectionId).subscribe({
      next: e => { this.explanation = e; this.regeneratingExplanation = false; },
      error: err => { this.explanationError = err.message; this.regeneratingExplanation = false; }
    });
  }

  regenerateFlashcards() {
    this.regeneratingFlashcards = true;
    this.flashcards = [];
    this.fcPass = 1;
    this.fcQueue = [];
    this.fcQueuePos = 0;
    this.flashcardFlipped = false;
    this.fcMastered.clear();
    this.fcRetry.clear();
    this.fcDone = false;
    this.contentService.regenerateFlashcards(this.sectionId).subscribe({
      next: cards => {
        this.flashcards = cards;
        this.fcQueue = cards.map((_, i) => i);
        this.regeneratingFlashcards = false;
      },
      error: err => { this.regeneratingFlashcards = false; this.snackBar.open(err.message, 'OK', { duration: 4000 }); }
    });
  }

  regeneratePractice() {
    this.regeneratingPractice = true;
    this.practiceQuestions = [];
    this.practiceState = 'idle';
    this.practiceAnswers = {};
    this.practiceShowExplanation = {};
    this.contentService.regeneratePracticeQuestions(this.sectionId, 15).subscribe({
      next: q => { this.practiceQuestions = q; this.practiceState = 'answering'; this.regeneratingPractice = false; },
      error: err => { this.regeneratingPractice = false; this.snackBar.open(err.message, 'OK', { duration: 4000 }); }
    });
  }

  regenerateSectionExam() {
    this.regeneratingExam = true;
    this.examQuestions = [];
    this.examState = 'idle';
    this.examAnswers = {};
    this.examFlagged.clear();
    this.examResult = null;
    this.contentService.regenerateSectionExam(this.sectionId).subscribe({
      next: q => { this.examQuestions = q; this.regeneratingExam = false; },
      error: err => { this.regeneratingExam = false; this.snackBar.open(err.message, 'OK', { duration: 4000 }); }
    });
  }

  regenerateLab() {
    this.regeneratingLab = true;
    this.lab = null;
    this.labError = '';
    this.labStepExpanded.clear();
    this.contentService.regenerateLab(this.sectionId).subscribe({
      next: l => { this.lab = l; this.regeneratingLab = false; },
      error: err => { this.labError = err.message; this.regeneratingLab = false; }
    });
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  linkTerms(text: string | undefined | null): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!this.terms.length) return this.sanitizer.bypassSecurityTrustHtml(escaped);

    const sorted = [...this.terms].sort((a, b) => b.term.length - a.term.length);
    const termMap = new Map(sorted.map(t => [t.term.toLowerCase(), t.term]));
    const pattern = sorted
      .map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    const result = escaped.replace(new RegExp(`\\b(${pattern})\\b`, 'gi'), (match) => {
      const canonical = termMap.get(match.toLowerCase()) ?? match;
      return `<a class="term-link" href="/terms?q=${encodeURIComponent(canonical)}">${match}</a>`;
    });
    return this.sanitizer.bypassSecurityTrustHtml(result);
  }

  formatMarkdown(text: string | undefined | null): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // Each **Heading** starts a new paragraph
    const html = '<p>' + escaped
      .replace(/\*\*([^*\n]+)\*\*/g, (_, h) => `</p><p><strong>${h}</strong>`)
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>')
      + '</p>'
      // Remove empty paragraphs left by leading/trailing replacements
      .replace(/<p>\s*<\/p>/g, '');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
