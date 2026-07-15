import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ContentService } from '../../services/content.service';
import { Question, ExamSubmission, ExamResult } from '../../models/question.model';

const EXAM_MINUTES = 90;

@Component({
  selector: 'app-practice-exam',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatSnackBarModule, MatDividerModule, DragDropModule],
  templateUrl: './practice-exam.component.html',
  styleUrl: './practice-exam.component.scss'
})
export class PracticeExamComponent implements OnInit, OnDestroy {
  private contentService = inject(ContentService);
  private snackBar = inject(MatSnackBar);
  private route = inject(ActivatedRoute);

  // Domain-exam mode when a :id route param is present; otherwise the full 90-question exam.
  domainId: string | null = null;
  examMinutes = EXAM_MINUTES;
  get isDomain(): boolean { return !!this.domainId; }
  get examTitle(): string { return this.isDomain ? 'Domain Exam' : 'Full Practice Exam'; }
  get examSubtitle(): string {
    return this.isDomain ? this.getDomainLabel(this.domainId!) : 'Simulate the real CompTIA Security+ SY0-701 exam experience';
  }
  get questionCountLabel(): string { return this.isDomain ? '~24 Questions' : '90 Questions'; }

  state: 'intro' | 'loading' | 'answering' | 'submitting' | 'result' = 'intro';
  questions: Question[] = [];
  answers: Record<string, string | string[]> = {};
  flagged = new Set<string>();
  currentIndex = 0;
  result: ExamResult | null = null;

  timerInterval: any;
  secondsRemaining = EXAM_MINUTES * 60;
  examStartTime = 0;

  domainLabels: Record<string, string> = {
    domain1: 'General Security Concepts',
    domain2: 'Threats, Vulnerabilities & Mitigations',
    domain3: 'Security Architecture',
    domain4: 'Security Operations',
    domain5: 'Security Program Management & Oversight'
  };

  domainColors: Record<string, string> = {
    foundations: '#0ea5e9',
    domain1: '#6366f1', domain2: '#ef4444', domain3: '#f59e0b',
    domain4: '#10b981', domain5: '#8b5cf6'
  };

  // ── PBQ state (keyed by question id so it survives navigation) ──
  ddMatches: Record<string, Record<string, string>> = {};  // qId → {pairId: targetId}
  ddSelected: Record<string, string> = {};
  olItems: Record<string, string[]> = {};
  fwAnswers: Record<string, string[][]> = {};

  isInteractivePbq(q: Question): boolean {
    return q.type === 'DRAG_DROP' || q.type === 'NETWORK_PLACEMENT' || q.type === 'ORDER_LIST' || q.type === 'FIREWALL_RULES';
  }

  // Drag-drop / network placement
  ddSelectTarget(qId: string, targetId: string) { this.ddSelected[qId] = this.ddSelected[qId] === targetId ? '' : targetId; }
  ddAssignPair(qId: string, pairId: string) {
    const sel = this.ddSelected[qId];
    if (!sel) return;
    if (!this.ddMatches[qId]) this.ddMatches[qId] = {};
    for (const key of Object.keys(this.ddMatches[qId])) { if (this.ddMatches[qId][key] === sel) delete this.ddMatches[qId][key]; }
    this.ddMatches[qId][pairId] = sel;
    this.ddSelected[qId] = '';
  }
  ddUnassign(qId: string, pairId: string, e: Event) { e.stopPropagation(); if (this.ddMatches[qId]) delete this.ddMatches[qId][pairId]; }
  ddGetMatch(qId: string, pairId: string): string { return this.ddMatches[qId]?.[pairId] ?? ''; }
  ddIsAssigned(qId: string, targetId: string): boolean { return Object.values(this.ddMatches[qId] ?? {}).includes(targetId); }
  ddGetTargetLabel(q: Question, targetId: string): string { return q.dropTargets?.find(t => t.id === targetId)?.label ?? ''; }
  ddAllMatched(q: Question): boolean { const m = this.ddMatches[q.id] ?? {}; return (q.dragPairs?.length ?? 0) > 0 && Object.keys(m).length === q.dragPairs!.length; }

  // Order list
  getOlItems(qId: string, q: Question): string[] { if (!this.olItems[qId]) this.olItems[qId] = [...(q.orderItems ?? [])]; return this.olItems[qId]; }
  dropOl(event: CdkDragDrop<string[]>, qId: string, q: Question) { moveItemInArray(this.getOlItems(qId, q), event.previousIndex, event.currentIndex); }
  olAllOrdered(q: Question): boolean { return (this.olItems[q.id]?.length ?? 0) === (q.orderItems?.length ?? 0); }

  // Firewall
  fwRowIndexes(q: Question): number[] { return Array.from({ length: q.correctRules?.length ?? 0 }, (_, i) => i); }
  fwGet(qId: string, row: number, col: number): string { return this.fwAnswers[qId]?.[row]?.[col] ?? ''; }
  fwSet(qId: string, row: number, col: number, value: string) {
    if (!this.fwAnswers[qId]) this.fwAnswers[qId] = [];
    if (!this.fwAnswers[qId][row]) this.fwAnswers[qId][row] = [];
    this.fwAnswers[qId][row][col] = value;
  }
  fwAllFilled(q: Question): boolean {
    const cols = q.firewallColumns?.length ?? 0;
    if (!cols || !q.correctRules?.length) return false;
    return this.fwRowIndexes(q).every(r => Array.from({ length: cols }, (_, c) => c).every(c => !!this.fwGet(q.id, r, c)));
  }
  fwToRows(q: Question): Record<string, string>[] {
    const cols = q.firewallColumns ?? [];
    return this.fwRowIndexes(q).map(r => { const row: Record<string, string> = {}; cols.forEach((col, c) => row[col] = this.fwGet(q.id, r, c)); return row; });
  }

  /** Whether a question (MC or PBQ) has been answered — drives the count + navigator. */
  isAnswered(q: Question): boolean {
    if (q.type === 'DRAG_DROP' || q.type === 'NETWORK_PLACEMENT') return this.ddAllMatched(q);
    if (q.type === 'ORDER_LIST') return this.olAllOrdered(q);
    if (q.type === 'FIREWALL_RULES') return this.fwAllFilled(q);
    const v = this.answers[q.id];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }

  ngOnInit() {
    this.domainId = this.route.snapshot.paramMap.get('id');
    if (this.domainId) this.examMinutes = 35;   // domain exam is shorter than the full 90-min exam
  }
  ngOnDestroy() { clearInterval(this.timerInterval); }

  startExam() {
    this.state = 'loading';
    const load = this.isDomain
      ? this.contentService.getDomainExam(this.domainId!)
      : this.contentService.getFullExam();
    load.subscribe({
      next: q => {
        this.questions = q;
        this.answers = {};
        this.ddMatches = {}; this.ddSelected = {}; this.olItems = {}; this.fwAnswers = {};
        this.flagged.clear();
        this.currentIndex = 0;
        this.secondsRemaining = this.examMinutes * 60;
        this.examStartTime = Date.now();
        this.state = 'answering';
        this.timerInterval = setInterval(() => {
          this.secondsRemaining--;
          if (this.secondsRemaining <= 0) { clearInterval(this.timerInterval); this.submitExam(); }
        }, 1000);
      },
      error: e => { this.snackBar.open(e.message, 'OK', { duration: 5000 }); this.state = 'intro'; }
    });
  }

  selectAnswer(questionId: string, answer: string) {
    const q = this.questions.find(x => x.id === questionId);
    if (!q) return;
    if (q.type === 'MULTI_SELECT') {
      const curr = (this.answers[questionId] as string[] | undefined) ?? [];
      const idx = curr.indexOf(answer);
      this.answers[questionId] = idx >= 0 ? curr.filter(a => a !== answer) : [...curr, answer];
    } else {
      this.answers[questionId] = answer;
    }
  }

  isSelected(questionId: string, option: string): boolean {
    const ans = this.answers[questionId];
    return Array.isArray(ans) ? ans.includes(option) : ans === option;
  }

  toggleFlag(id: string) { this.flagged.has(id) ? this.flagged.delete(id) : this.flagged.add(id); }

  submitExam() {
    clearInterval(this.timerInterval);
    this.state = 'submitting';
    const elapsed = Math.round((Date.now() - this.examStartTime) / 1000);
    const sub: ExamSubmission = {
      examType: this.isDomain ? 'DOMAIN' : 'FULL',
      domainId: this.domainId ?? undefined,
      answers: this.questions.map(q => ({
        questionId: q.id,
        selectedAnswer: typeof this.answers[q.id] === 'string' ? this.answers[q.id] as string : undefined,
        selectedAnswers: Array.isArray(this.answers[q.id]) ? this.answers[q.id] as string[] : undefined,
        pairAnswers: (q.type === 'DRAG_DROP' || q.type === 'NETWORK_PLACEMENT') ? (this.ddMatches[q.id] ?? {}) : undefined,
        orderAnswer: q.type === 'ORDER_LIST' ? (this.olItems[q.id] ?? q.orderItems ?? []) : undefined,
        firewallAnswer: q.type === 'FIREWALL_RULES' ? this.fwToRows(q) : undefined,
      })),
      timeTakenSeconds: elapsed
    };
    this.contentService.submitExam(sub).subscribe({
      next: r => { this.result = r; this.state = 'result'; },
      error: e => { this.snackBar.open(e.message, 'OK', { duration: 5000 }); this.state = 'answering'; }
    });
  }

  retake() {
    this.state = 'intro'; this.result = null; this.questions = [];
    this.ddMatches = {}; this.ddSelected = {}; this.olItems = {}; this.fwAnswers = {};
  }

  get timerDisplay(): string {
    const m = Math.floor(this.secondsRemaining / 60).toString().padStart(2, '0');
    const s = (this.secondsRemaining % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  get timerPercent(): number { return (this.secondsRemaining / (this.examMinutes * 60)) * 100; }
  get timerWarning(): boolean { return this.secondsRemaining < 600; }

  get answeredCount(): number {
    return this.questions.filter(q => this.isAnswered(q)).length;
  }

  get currentQ(): Question { return this.questions[this.currentIndex]; }

  isCorrect(q: Question): boolean {
    const given = this.answers[q.id];
    if (q.type === 'MULTI_SELECT') {
      return JSON.stringify([...(given as string[] || [])].sort()) === JSON.stringify([...(q.correctAnswers || [])].sort());
    }
    return given === q.correctAnswer;
  }

  isCorrectOption(q: Question, opt: string): boolean {
    if (q.type === 'MULTI_SELECT') return (q.correctAnswers || []).includes(opt.charAt(0));
    return opt.startsWith(q.correctAnswer ?? '##');
  }

  formatTime(s: number): string {
    const m = Math.floor(s / 60); const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }

  getDomainLabel(id: string): string { return this.domainLabels[id] ?? id; }
  getDomainColor(id: string): string { return this.domainColors[id] ?? '#3f51b5'; }

  getScaledScore(): number {
    if (!this.result) return 0;
    return Math.round((this.result.scorePercent / 100) * 900);
  }
}
