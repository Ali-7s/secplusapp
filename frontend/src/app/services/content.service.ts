import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, timer, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Domain, Section } from '../models/curriculum.model';
import { Question, ExamSubmission, ExamResult } from '../models/question.model';
import { Flashcard, ConceptExplanation, Lab, Acronym, AcronymDetail, Term, TermDetail } from '../models/flashcard.model';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  // Exam generation is async on the server: a 202 means "still generating, poll again".
  // We retry the GET every few seconds until it returns 200 with the questions.
  private readonly EXAM_POLL_MS = 3000;
  private readonly EXAM_POLL_MAX = 120;   // ~6 min ceiling before giving up

  private pollExam(path: string, attempt = 0): Observable<Question[]> {
    return this.http.get<Question[]>(`/api${path}`, { observe: 'response' }).pipe(
      switchMap(resp => {
        if (resp.status === 202) {
          if (attempt >= this.EXAM_POLL_MAX) {
            return throwError(() => new Error('Exam is taking too long to generate. Please try again.'));
          }
          return timer(this.EXAM_POLL_MS).pipe(switchMap(() => this.pollExam(path, attempt + 1)));
        }
        return of(resp.body ?? []);
      }),
      catchError(err => throwError(() =>
        err instanceof HttpErrorResponse
          ? new Error(err.error?.message || 'Exam generation failed. Please try again.')
          : err)),
    );
  }

  getCurriculum(): Observable<Domain[]> {
    return this.api.get<Domain[]>('/curriculum');
  }

  getDomain(id: string): Observable<Domain> {
    return this.api.get<Domain>(`/domains/${id}`);
  }

  getSection(id: string): Observable<Section> {
    return this.api.get<Section>(`/sections/${id}`);
  }

  getExplanation(sectionId: string): Observable<ConceptExplanation> {
    return this.api.get<ConceptExplanation>(`/content/explain/${sectionId}`);
  }

  getFlashcards(sectionId: string): Observable<Flashcard[]> {
    return this.api.get<Flashcard[]>(`/content/flashcards/${sectionId}`);
  }

  updateFlashcardProgress(sectionId: string, reviewed: number): Observable<void> {
    return this.api.post<void>(`/content/flashcards/${sectionId}/progress`, { reviewed });
  }

  getPracticeQuestions(sectionId: string, count = 10): Observable<Question[]> {
    return this.api.get<Question[]>(`/content/questions/${sectionId}?count=${count}`);
  }

  getSectionExam(sectionId: string): Observable<Question[]> {
    return this.pollExam(`/content/exam/${sectionId}`);
  }

  getFullExam(): Observable<Question[]> {
    return this.pollExam('/content/exam/full');
  }

  getLab(sectionId: string): Observable<Lab> {
    return this.api.get<Lab>(`/content/lab/${sectionId}`);
  }

  simplifyText(text: string): Observable<{ simplified: string }> {
    return this.api.post<{ simplified: string }>('/content/simplify', { text });
  }

  completeLab(sectionId: string): Observable<void> {
    return this.api.post<void>(`/content/lab/${sectionId}/complete`, {});
  }

  getAcronyms(): Observable<Acronym[]> {
    return this.api.get<Acronym[]>('/content/acronyms');
  }

  getAcronymDetail(acronym: string, expansion: string): Observable<AcronymDetail> {
    return this.api.get<AcronymDetail>(`/content/acronyms/${encodeURIComponent(acronym)}/detail?expansion=${encodeURIComponent(expansion)}`);
  }

  getTerms(): Observable<Term[]> {
    return this.api.get<Term[]>('/content/terms');
  }

  getTermDetail(term: string, definition: string): Observable<TermDetail> {
    return this.api.get<TermDetail>(`/content/terms/${encodeURIComponent(term)}/detail?definition=${encodeURIComponent(definition)}`);
  }

  regenerateTerms(): Observable<Term[]> {
    return this.api.post<Term[]>('/content/terms/regenerate', {});
  }

  generateMissingTerms(termNames: string[]): Observable<Term[]> {
    return this.api.post<Term[]>('/content/terms/generate-missing', termNames);
  }

  regenerateExplanation(sectionId: string): Observable<ConceptExplanation> {
    return this.api.post<ConceptExplanation>(`/content/explain/${sectionId}/regenerate`, {});
  }

  regenerateFlashcards(sectionId: string): Observable<Flashcard[]> {
    return this.api.post<Flashcard[]>(`/content/flashcards/${sectionId}/regenerate`, {});
  }

  regeneratePracticeQuestions(sectionId: string, count = 10): Observable<Question[]> {
    return this.api.post<Question[]>(`/content/questions/${sectionId}/regenerate?count=${count}`, {});
  }

  regenerateSectionExam(sectionId: string): Observable<Question[]> {
    // POST evicts + kicks off generation (returns 202), then we poll the GET until ready
    return this.http.post(`/api/content/exam/${sectionId}/regenerate`, {}, { observe: 'response' }).pipe(
      switchMap(() => this.pollExam(`/content/exam/${sectionId}`)),
      catchError(err => throwError(() =>
        err instanceof HttpErrorResponse ? new Error(err.error?.message || 'Failed to regenerate exam.') : err)),
    );
  }

  regenerateFullExam(): Observable<Question[]> {
    return this.http.post('/api/content/exam/full/regenerate', {}, { observe: 'response' }).pipe(
      switchMap(() => this.pollExam('/content/exam/full')),
      catchError(err => throwError(() =>
        err instanceof HttpErrorResponse ? new Error(err.error?.message || 'Failed to regenerate exam.') : err)),
    );
  }

  regenerateLab(sectionId: string): Observable<Lab> {
    return this.api.post<Lab>(`/content/lab/${sectionId}/regenerate`, {});
  }

  regenerateAcronyms(): Observable<Acronym[]> {
    return this.api.post<Acronym[]>('/content/acronyms/regenerate', {});
  }

  submitExam(submission: ExamSubmission): Observable<ExamResult> {
    return this.api.post<ExamResult>('/exam/submit', submission);
  }

  getStatus(): Observable<{ configured: boolean; version: string; exam: string }> {
    return this.api.get('/status');
  }
}
