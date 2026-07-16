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
import { MatTooltipModule } from '@angular/material/tooltip';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ContentService } from '../../services/content.service';
import { ProgressService } from '../../services/progress.service';
import { SrsService } from '../../services/srs.service';
import { Section } from '../../models/curriculum.model';
import { Question, ExamResult, ExamSubmission } from '../../models/question.model';
import { Flashcard, ConceptExplanation, Lab, Term } from '../../models/flashcard.model';

@Component({
  selector: 'app-section-study',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, DragDropModule, MatTabsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatProgressBarModule, MatChipsModule, MatProgressSpinnerModule,
    MatDividerModule, MatSnackBarModule, MatDialogModule, MatBadgeModule, MatTooltipModule
  ],
  templateUrl: './section-study.component.html',
  styleUrl: './section-study.component.scss'
})
export class SectionStudyComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private contentService = inject(ContentService);
  private progressService = inject(ProgressService);
  private srs = inject(SrsService);
  private snackBar = inject(MatSnackBar);
  private sanitizer = inject(DomSanitizer);

  protected readonly Object = Object;
  protected readonly Math = Math;

  terms: Term[] = [];

  sectionId = '';
  section: Section | null = null;
  sectionProgress: any = null;
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

  // Cloze (active recall) mode
  fcClozeMode = false;
  fcClozeInput = '';
  fcClozeChecked = false;
  fcClozeCorrect = false;
  clozeCoveredCount = 0;
  clozeTotalWords = 0;

  // Background blur when recall inputs are focused (Active Recall mode)
  recallFocused = false;

  // Reading guide (Learn tab)
  readingGuideOpen = true;

  // "Explain it simpler" — on-demand plain-language rewrite of a block.
  // Cached per block (and on the backend) so it only ever calls the AI once.
  simplified: Record<string, string> = {};
  simplifyLoading: Record<string, boolean> = {};
  showSimplified: Record<string, boolean> = {};

  toggleSimplify(blockId: string, rawHtml: string) {
    if (this.simplified[blockId] != null) {           // already fetched — just toggle
      this.showSimplified[blockId] = !this.showSimplified[blockId];
      return;
    }
    const text = this.stripHtml(rawHtml).trim();
    if (!text || this.simplifyLoading[blockId]) return;
    this.simplifyLoading[blockId] = true;
    this.contentService.simplifyText(text).subscribe({
      next: r => {
        this.simplified[blockId] = r.simplified;
        this.showSimplified[blockId] = true;
        this.simplifyLoading[blockId] = false;
      },
      error: err => {
        this.simplifyLoading[blockId] = false;
        this.snackBar.open(err?.message || 'Could not simplify right now. Try again.', 'OK', { duration: 4000 });
      },
    });
  }

  private resetSimplified() {
    this.simplified = {};
    this.simplifyLoading = {};
    this.showSimplified = {};
  }

  // Active Recall Mode — block-by-block progressive reveal
  activeRecallMode = false;
  activeRecallStep = 0; // 0 = off; 1-5 = active step; 6+ = complete
  arInputs: string[] = ['', '', '', '', ''];

  readonly AR_PROMPTS: string[] = [
    'In your own words, what is this section fundamentally about?',
    'What\'s the one concept from that explanation you absolutely must understand?',
    'Cover the card — can you recall 3 key points without looking?',
    'What\'s the exam tip most likely to trip you up under test pressure?',
    'Describe a real-world scenario and name one common mistake to avoid.',
  ];

  readonly AR_STEP_NAMES: string[] = [
    'Overview', 'Explanation', 'Key Points', 'Exam Tips', 'Examples & Mistakes',
  ];

  toggleActiveRecall() {
    if (this.activeRecallMode) {
      this.activeRecallMode = false;
      this.activeRecallStep = 0;
    } else {
      this.activeRecallMode = true;
      this.activeRecallStep = 1;
      this.arInputs = ['', '', '', '', ''];
    }
  }

  submitAR(step: number) { this.activeRecallStep = step + 1; }

  private stripHtml(html: string): string {
    return html?.replace(/<[^>]+>/g, ' ') ?? '';
  }

  private blockKeywords(step: number): string[] {
    if (!this.explanation) return [];
    const sources: string[] = [
      this.explanation.overview ?? '',
      this.stripHtml(this.explanation.detailedExplanation ?? ''),
      (this.explanation.keyPoints ?? []).join(' '),
      (this.explanation.examTips ?? []).join(' '),
      [...(this.explanation.realWorldExamples ?? []), ...(this.explanation.commonMistakes ?? [])].join(' '),
    ];
    const raw = sources[step - 1] ?? '';
    return raw.toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length >= 5 && !this.STOP_WORDS.has(w));
  }

  arInputMinMet(step: number): boolean {
    const input = (this.arInputs[step - 1] ?? '').trim().toLowerCase();
    if (!input || input.length < 3) return false;
    const kws = this.blockKeywords(step);
    return !kws.length || kws.some(w => input.includes(w));
  }

  get explanationChunks(): string[] {
    const text = this.explanation?.detailedExplanation;
    if (!text) return [];
    const parts = text.split(/(?=<h[23][\s>])/i).filter(p => p.trim());
    return parts.length >= 2 ? parts : [text];
  }

  // Brain dump (Learn tab)
  brainDumpText = '';
  brainDumpChecked = false;
  brainDumpResults: { point: string; covered: boolean }[] = [];
  brainDumpCoveredCount = 0;
  nextReviewLabel = '';   // e.g. "tomorrow", "in 6 days" — set after scheduling

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

  // PBQ state (shared; question IDs differ between practice/exam so no collision)
  ddMatches: Record<string, Record<string, string>> = {};  // qId → {pairId: targetId}
  ddSelected: Record<string, string> = {};                  // qId → currently picked target id
  olItems: Record<string, string[]> = {};                   // qId → current order array

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
        this.labCompleted = p.labCompleted;
      },
      error: () => {}
    });
  }


  // ── Learn ──────────────────────────────────────────────────────────
  loadExplanation() {
    if (this.explanation || this.loadingExplanation) return;
    this.loadingExplanation = true;
    this.explanationError = '';
    this.contentService.getExplanation(this.sectionId).subscribe({
      next: e => { this.explanation = e; this.loadingExplanation = false; this.resetSimplified(); },
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
    this.fcClozeInput = '';
    this.fcClozeChecked = false;
    this.fcClozeCorrect = false;
    this.clozeCoveredCount = 0;
    this.clozeTotalWords = 0;

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
    if (this.fcQueuePos > 0) {
      this.fcQueuePos--;
      this.flashcardFlipped = false;
      this.fcWriteAnswer = '';
      this.fcClozeInput = '';
      this.fcClozeChecked = false;
      this.fcClozeCorrect = false;
      this.clozeCoveredCount = 0;
      this.clozeTotalWords = 0;
    }
  }

  resetFlashcards() {
    this.fcPass = 1;
    this.fcWriteAnswer = '';
    this.fcClozeInput = '';
    this.fcClozeChecked = false;
    this.fcClozeCorrect = false;
    this.clozeCoveredCount = 0;
    this.clozeTotalWords = 0;
    this.fcQueue = this.flashcards.map((_, i) => i);
    this.fcQueuePos = 0;
    this.flashcardFlipped = false;
    this.fcMastered.clear();
    this.fcRetry.clear();
    this.fcDone = false;
  }

  toggleClozeMode() {
    this.fcClozeMode = !this.fcClozeMode;
    this.fcClozeInput = '';
    this.fcClozeChecked = false;
    this.fcClozeCorrect = false;
    this.clozeCoveredCount = 0;
    this.clozeTotalWords = 0;
  }

  private readonly PHRASE_TERMINALS = new Set([
    'is','are','was','were','be','been','being',
    'can','will','would','could','should','must','may',
    'that','which','when','where','how','if',
    'in','on','at','of','to','for','by','with','from','as','into','than',
    'a','an','the',
    'implemented','used','means','refers','defines','occurs','enables',
    'provides','protects','ensures','allows','prevents','detects','requires',
  ]);

  private extractCloze(back: string): { before: string; answer: string; after: string } {
    if (!back?.trim()) return { before: '', answer: '', after: '' };

    // 1. "Short Label: VALUE" — blank the VALUE, not the label
    //    e.g. "Category: Physical | Type: Detective..." → before="Category: " answer="Physical"
    const colonIdx = back.indexOf(': ');
    if (colonIdx > 0 && colonIdx <= 20) {
      const label = back.substring(0, colonIdx);
      if (label.split(' ').length <= 2) {
        const rest = back.substring(colonIdx + 2);
        let end = rest.length;
        for (const sep of [' | ', '. ', '! ', ', ']) {
          const si = rest.indexOf(sep);
          if (si >= 0 && si < end) end = si;
        }
        end = Math.min(end, 50);
        const ws = rest.lastIndexOf(' ', end);
        if (ws > 3) end = ws;
        return { before: label + ': ', answer: rest.substring(0, end).trim(), after: ' ' + rest.substring(end).trim() };
      }
    }

    // 2. Em dash / en dash — blank the term before it
    for (const d of [' — ', ' – ']) {
      const i = back.indexOf(d);
      if (i > 0 && i <= 50) {
        return { before: '', answer: back.substring(0, i).trim(), after: back.substring(i) };
      }
    }

    // 3. First sentence (short answers that ARE the definition)
    for (const end of ['. ', '! ']) {
      const i = back.indexOf(end);
      if (i > 4 && i <= 80) {
        return { before: '', answer: back.substring(0, i + 1).trim(), after: ' ' + back.substring(i + 2).trim() };
      }
    }

    // 4. Comma clause
    const ci = back.indexOf(', ');
    if (ci > 4 && ci <= 50) {
      return { before: '', answer: back.substring(0, ci).trim(), after: back.substring(ci) };
    }

    // 5. First noun phrase (stop before function words) — e.g. "Compensating control implemented when..."
    const words = back.split(' ');
    let phrase = words[0];
    for (let w = 1; w < Math.min(words.length - 1, 5); w++) {
      const tok = words[w].toLowerCase().replace(/[^a-z]/g, '');
      if (this.PHRASE_TERMINALS.has(tok)) break;
      const next = phrase + ' ' + words[w];
      if (next.length > 35) break;
      phrase = next;
    }
    if (phrase.length > 3 && phrase.length < back.length - 1) {
      return { before: '', answer: phrase.trim(), after: ' ' + back.substring(phrase.length).trim() };
    }

    // 6. Hard fallback — word-boundary cut at 40 chars
    const max = Math.min(back.length - 1, 45);
    const spaceIdx = back.lastIndexOf(' ', max);
    const cut = spaceIdx > 10 ? spaceIdx : Math.min(35, back.length);
    return { before: '', answer: back.substring(0, cut).trim(), after: ' ' + back.substring(cut).trim() };
  }

  renderBack(text: string): string {
    if (!text?.trim()) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/ \| /g, '<br>')
      .replace(/ - (?=[A-Z\d])/g, '<br>• ');
  }

  hasCloze(back: string): boolean {
    return !!(back?.trim());
  }

  checkCloze() {
    if (this.fcClozeChecked) return;
    this.fcClozeChecked = true;
    const back = this.fcCard?.back ?? '';
    if (!back) { this.fcClozeCorrect = true; return; }
    const userText = this.fcClozeInput.toLowerCase();
    const keywords = back.toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length >= 4 && !this.STOP_WORDS.has(w));
    if (!keywords.length) { this.fcClozeCorrect = true; return; }
    const covered = keywords.filter(w => userText.includes(w)).length;
    this.clozeCoveredCount = covered;
    this.clozeTotalWords = keywords.length;
    this.fcClozeCorrect = covered / keywords.length >= 0.45;
  }

  get clozeScorePct(): number {
    return this.clozeTotalWords ? Math.round(this.clozeCoveredCount / this.clozeTotalWords * 100) : 0;
  }

  private fuzzyMatch(input: string, answer: string): boolean {
    const u = input.trim().toLowerCase();
    const a = answer.toLowerCase();
    if (!u) return false;
    if (u === a) return true;
    const uNums: string[] = u.match(/\d+/g) ?? [];
    const aNums: string[] = a.match(/\d+/g) ?? [];
    if (uNums.length && aNums.length && uNums.some(n => aNums.includes(n))) return true;
    const uNorm = u.replace(/[^a-z0-9]/g, '');
    const aNorm = a.replace(/[^a-z0-9]/g, '');
    if (uNorm.length >= 2 && (aNorm.includes(uNorm) || uNorm.includes(aNorm))) return true;
    return false;
  }

  private readonly STOP_WORDS = new Set([
    'that','this','with','from','they','have','more','when','your',
    'which','there','their','also','into','some','than','then','been',
    'were','will','would','could','should','each','used','uses','using',
    'often','include','includes','provides','most','allows','between',
    'through','because','without','against','another','these','those',
    'helps','ensure','requires','require','multiple','different','both'
  ]);

  checkBrainDump() {
    if (!this.explanation?.keyPoints?.length || !this.brainDumpText.trim()) return;
    const dump = this.brainDumpText.toLowerCase();
    this.brainDumpResults = this.explanation.keyPoints.map(point => {
      const words = (point.match(/\b[A-Z0-9]{2,}\b|\b[a-zA-Z]{4,}\b/g) ?? [])
        .filter(w => !this.STOP_WORDS.has(w.toLowerCase()));
      if (!words.length) return { point, covered: true };
      const hits = words.filter(w => dump.includes(w.toLowerCase())).length;
      return { point, covered: hits / words.length >= 0.4 };
    });
    this.brainDumpCoveredCount = this.brainDumpResults.filter(r => r.covered).length;
    this.brainDumpChecked = true;
    const pct = this.brainDumpResults.length
      ? Math.round(this.brainDumpCoveredCount / this.brainDumpResults.length * 100) : 0;
    // Schedule this section for spaced review on the server — quality + score from recall
    this.srs.review(this.sectionId, this.section?.name ?? this.sectionId, this.srs.qualityFromScore(pct), pct)
      .subscribe({
        next: card => this.nextReviewLabel = this.srs.describeDue(card.due),
        error: () => this.nextReviewLabel = '',
      });
  }

  resetBrainDump() {
    this.brainDumpText = '';
    this.brainDumpChecked = false;
    this.brainDumpResults = [];
    this.brainDumpCoveredCount = 0;
    this.nextReviewLabel = '';
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

  // ── PBQ: Drag-drop matching ────────────────────────────────
  ddSelectTarget(qId: string, targetId: string) {
    this.ddSelected[qId] = this.ddSelected[qId] === targetId ? '' : targetId;
  }

  ddAssignPair(qId: string, pairId: string) {
    const sel = this.ddSelected[qId];
    if (!sel) return;
    if (!this.ddMatches[qId]) this.ddMatches[qId] = {};
    // unassign this target from any other pair first
    for (const key of Object.keys(this.ddMatches[qId])) {
      if (this.ddMatches[qId][key] === sel) delete this.ddMatches[qId][key];
    }
    this.ddMatches[qId][pairId] = sel;
    this.ddSelected[qId] = '';
    this.ddMatches = { ...this.ddMatches };
  }

  ddUnassign(qId: string, pairId: string, e: Event) {
    e.stopPropagation();
    if (this.ddMatches[qId]) {
      delete this.ddMatches[qId][pairId];
      this.ddMatches = { ...this.ddMatches };
    }
  }

  ddGetMatch(qId: string, pairId: string): string {
    return this.ddMatches[qId]?.[pairId] ?? '';
  }

  ddIsAssigned(qId: string, targetId: string): boolean {
    return Object.values(this.ddMatches[qId] ?? {}).includes(targetId);
  }

  ddGetTargetLabel(q: Question, targetId: string): string {
    return q.dropTargets?.find(t => t.id === targetId)?.label ?? '';
  }

  ddAllMatched(q: Question): boolean {
    const m = this.ddMatches[q.id] ?? {};
    return (q.dragPairs?.length ?? 0) > 0 && Object.keys(m).length === q.dragPairs!.length;
  }

  isPairCorrect(q: Question, pairId: string): boolean {
    return this.ddMatches[q.id]?.[pairId] === q.correctPairs?.[pairId];
  }

  // ── PBQ: Order list ────────────────────────────────────────
  getOlItems(qId: string, q: Question): string[] {
    if (!this.olItems[qId]) {
      this.olItems[qId] = [...(q.orderItems ?? [])];
    }
    return this.olItems[qId];
  }

  dropOl(event: CdkDragDrop<string[]>, qId: string, q: Question) {
    const items = this.getOlItems(qId, q);
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.olItems = { ...this.olItems };
  }

  isOrderItemCorrect(q: Question, item: string, index: number): boolean {
    return q.correctOrder?.[index] === item;
  }

  olAllOrdered(q: Question): boolean {
    return (this.olItems[q.id]?.length ?? 0) === (q.orderItems?.length ?? 0);
  }

  // ── Shared correctness / submit ────────────────────────────
  isPracticeAnswered(q: Question): boolean {
    if (q.type === 'DRAG_DROP' || q.type === 'NETWORK_PLACEMENT') return this.ddAllMatched(q);
    if (q.type === 'ORDER_LIST') return this.olAllOrdered(q);
    if (q.type === 'FIREWALL_RULES') return this.fwAllFilled(q);
    const ans = this.practiceAnswers[q.id];
    return Array.isArray(ans) ? ans.length > 0 : !!ans;
  }

  get allPracticeAnswered(): boolean {
    return this.practiceQuestions.length > 0 &&
           this.practiceQuestions.every(q => this.isPracticeAnswered(q));
  }

  submitPractice() {
    let correct = 0;
    this.practiceQuestions.forEach(q => {
      if (this.isPracticeCorrect(q)) correct++;
    });
    this.practiceScore = correct;
    this.practiceTotal = this.practiceQuestions.length;
    this.practiceState = 'review';
    this.progressService.updatePractice(this.sectionId, this.practiceTotal, this.practiceScore).subscribe();
  }

  isPracticeCorrect(q: Question): boolean {
    if (q.type === 'DRAG_DROP' || q.type === 'NETWORK_PLACEMENT') {
      if (!q.correctPairs || !q.dragPairs?.length) return false;
      const m = this.ddMatches[q.id] ?? {};
      return q.dragPairs.every(p => m[p.id] === q.correctPairs![p.id]);
    }
    if (q.type === 'ORDER_LIST') {
      if (!q.correctOrder?.length) return false;
      return JSON.stringify(this.olItems[q.id] ?? []) === JSON.stringify(q.correctOrder);
    }
    if (q.type === 'FIREWALL_RULES') {
      return this.fwAllFilled(q) && this.fwRowIndexes(q).every(r => this.fwRowCorrect(q, r));
    }
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
    this.ddMatches = {};
    this.ddSelected = {};
    this.olItems = {};
    this.fwAnswers = {};
    this.practiceState = 'idle';
    this.practiceShowExplanation = {};
    this.loadPractice();
  }

  // ── PBQ: Firewall ruleset ──────────────────────────────────
  // fwAnswers[questionId][rowIndex][colIndex] = selected dropdown value
  fwAnswers: Record<string, string[][]> = {};

  fwRowIndexes(q: Question): number[] {
    return Array.from({ length: q.correctRules?.length ?? 0 }, (_, i) => i);
  }

  fwGet(qId: string, row: number, col: number): string {
    return this.fwAnswers[qId]?.[row]?.[col] ?? '';
  }

  fwSet(qId: string, row: number, col: number, value: string) {
    if (!this.fwAnswers[qId]) this.fwAnswers[qId] = [];
    if (!this.fwAnswers[qId][row]) this.fwAnswers[qId][row] = [];
    this.fwAnswers[qId][row][col] = value;
  }

  fwAllFilled(q: Question): boolean {
    const cols = q.firewallColumns?.length ?? 0;
    if (!cols || !q.correctRules?.length) return false;
    return this.fwRowIndexes(q).every(r =>
      Array.from({ length: cols }, (_, c) => c).every(c => !!this.fwGet(q.id, r, c)));
  }

  fwCellCorrect(q: Question, row: number, col: number): boolean {
    const colName = q.firewallColumns?.[col];
    if (!colName) return false;
    const expected = q.correctRules?.[row]?.[colName] ?? '';
    return this.fwGet(q.id, row, col).trim().toLowerCase() === expected.trim().toLowerCase();
  }

  fwRowCorrect(q: Question, row: number): boolean {
    const cols = q.firewallColumns?.length ?? 0;
    return Array.from({ length: cols }, (_, c) => c).every(c => this.fwCellCorrect(q, row, c));
  }

  isPbq(q: Question): boolean {
    return q.type === 'DRAG_DROP' || q.type === 'ORDER_LIST' || q.type === 'FIREWALL_RULES'
        || q.type === 'NETWORK_PLACEMENT' || q.type === 'LOG_ANALYSIS';
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

  fwToRows(q: Question): Record<string, string>[] {
    const cols = q.firewallColumns ?? [];
    return this.fwRowIndexes(q).map(r => {
      const row: Record<string, string> = {};
      cols.forEach((col, c) => row[col] = this.fwGet(q.id, r, c));
      return row;
    });
  }

  submitExam() {
    clearInterval(this.examTimerInterval);
    const answers: ExamSubmission['answers'] = this.examQuestions.map(q => ({
      questionId: q.id,
      selectedAnswer: typeof this.examAnswers[q.id] === 'string' ? this.examAnswers[q.id] as string : undefined,
      selectedAnswers: Array.isArray(this.examAnswers[q.id]) ? this.examAnswers[q.id] as string[] : undefined,
      pairAnswers: (q.type === 'DRAG_DROP' || q.type === 'NETWORK_PLACEMENT') ? (this.ddMatches[q.id] ?? {}) : undefined,
      orderAnswer: q.type === 'ORDER_LIST' ? (this.olItems[q.id] ?? q.orderItems ?? []) : undefined,
      firewallAnswer: q.type === 'FIREWALL_RULES' ? this.fwToRows(q) : undefined,
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
    this.ddMatches = {};
    this.ddSelected = {};
    this.olItems = {};
    this.fwAnswers = {};
    this.loadExam();
  }

  get examTimerDisplay(): string {
    const m = Math.floor(this.examElapsedSeconds / 60).toString().padStart(2, '0');
    const s = (this.examElapsedSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  isExamAnswered(q: Question): boolean {
    if (q.type === 'DRAG_DROP' || q.type === 'NETWORK_PLACEMENT') return this.ddAllMatched(q);
    if (q.type === 'ORDER_LIST') return this.olAllOrdered(q);
    if (q.type === 'FIREWALL_RULES') return this.fwAllFilled(q);
    const ans = this.examAnswers[q.id];
    return Array.isArray(ans) ? ans.length > 0 : !!ans;
  }

  get examAnsweredCount(): number {
    return this.examQuestions.filter(q => this.isExamAnswered(q)).length;
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
      next: e => { this.explanation = e; this.regeneratingExplanation = false; this.resetSimplified(); },
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
