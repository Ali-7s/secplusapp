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
import { ContentService } from '../../services/content.service';
import { Question, ExamSubmission, ExamResult } from '../../models/question.model';

const EXAM_MINUTES = 90;

@Component({
  selector: 'app-practice-exam',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatSnackBarModule, MatDividerModule],
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
    domain1: '#6366f1', domain2: '#ef4444', domain3: '#f59e0b',
    domain4: '#10b981', domain5: '#8b5cf6'
  };

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
        selectedAnswers: Array.isArray(this.answers[q.id]) ? this.answers[q.id] as string[] : undefined
      })),
      timeTakenSeconds: elapsed
    };
    this.contentService.submitExam(sub).subscribe({
      next: r => { this.result = r; this.state = 'result'; },
      error: e => { this.snackBar.open(e.message, 'OK', { duration: 5000 }); this.state = 'answering'; }
    });
  }

  retake() { this.state = 'intro'; this.result = null; this.questions = []; }

  get timerDisplay(): string {
    const m = Math.floor(this.secondsRemaining / 60).toString().padStart(2, '0');
    const s = (this.secondsRemaining % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  get timerPercent(): number { return (this.secondsRemaining / (this.examMinutes * 60)) * 100; }
  get timerWarning(): boolean { return this.secondsRemaining < 600; }

  get answeredCount(): number {
    return Object.keys(this.answers).filter(k => {
      const v = this.answers[k]; return Array.isArray(v) ? v.length > 0 : !!v;
    }).length;
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
