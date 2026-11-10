import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { Acronym, AcronymDetail, Term, TermDetail } from '../models/glossary.model';
import { ExamQuestion } from '../models/exam.model';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private http = inject(HttpClient);
  private keyPoints?: Observable<Record<string, string[]>>;
  private examPool?: Observable<ExamQuestion[]>;

  getAcronyms(): Observable<Acronym[]> {
    return this.http.get<Acronym[]>('/data/acronyms.json');
  }

  getAcronymDetail(acronym: Acronym): Observable<AcronymDetail> {
    return of(acronym.detail);
  }

  getTerms(): Observable<Term[]> {
    return this.http.get<Term[]>('/data/terms.json');
  }

  getTermDetail(term: Term): Observable<TermDetail> {
    return of(term.detail);
  }

  /**
   * The key points a complete explanation of each Key Terms card covers, by term. Only Review needs them, so they
   * live in their own file and load on first use. If the file cannot be loaded the checklist falls back to the
   * sentences of the definition.
   */
  getKeyPoints(): Observable<Record<string, string[]>> {
    this.keyPoints ??= this.http.get<Record<string, string[]>>('/data/key-points-terms.json').pipe(
      catchError(() => of({} as Record<string, string[]>)),
      shareReplay(1),
    );
    return this.keyPoints;
  }

  /** The practice exam question pool, loaded once when the exam page first needs it. */
  getPracticeExam(): Observable<ExamQuestion[]> {
    this.examPool ??= this.http.get<ExamQuestion[]>('/data/practice-exam.json').pipe(shareReplay(1));
    return this.examPool;
  }
}
