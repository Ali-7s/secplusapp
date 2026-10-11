import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import { Acronym, AcronymDetail, Term, TermDetail } from '../models/glossary.model';
import { DeckId } from '../utils/brain-dump';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private http = inject(HttpClient);
  private keyPoints = new Map<DeckId, Observable<Record<string, string[]>>>();

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
   * The key points a complete explanation of each card covers, by card name. They are only needed in brain dump
   * mode, so they live in their own file and load on first use. If the file cannot be loaded the cards fall back
   * to the sentences of their definition.
   */
  getKeyPoints(deck: DeckId): Observable<Record<string, string[]>> {
    let points = this.keyPoints.get(deck);
    if (!points) {
      points = this.http.get<Record<string, string[]>>(`/data/braindump-${deck}.json`).pipe(
        catchError(() => of({} as Record<string, string[]>)),
        shareReplay(1),
      );
      this.keyPoints.set(deck, points);
    }
    return points;
  }
}
