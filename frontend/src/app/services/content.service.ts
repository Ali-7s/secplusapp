import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Question } from '../models/question.model';
import { Acronym, AcronymDetail, Term, TermDetail } from '../models/glossary.model';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private http = inject(HttpClient);

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

  getFullExam(): Observable<Question[]> {
    return this.http.get<Question[]>('/data/full-exam.json');
  }
}
