import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Domain, Section } from '../models/curriculum.model';
import { Question, ExamSubmission, ExamResult } from '../models/question.model';
import { Flashcard, ConceptExplanation, Lab, Acronym } from '../models/flashcard.model';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private api = inject(ApiService);

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
    return this.api.get<Question[]>(`/content/exam/${sectionId}`);
  }

  getFullExam(): Observable<Question[]> {
    return this.api.get<Question[]>('/content/exam/full');
  }

  getLab(sectionId: string): Observable<Lab> {
    return this.api.get<Lab>(`/content/lab/${sectionId}`);
  }

  completeLab(sectionId: string): Observable<void> {
    return this.api.post<void>(`/content/lab/${sectionId}/complete`, {});
  }

  getAcronyms(): Observable<Acronym[]> {
    return this.api.get<Acronym[]>('/content/acronyms');
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
    return this.api.post<Question[]>(`/content/exam/${sectionId}/regenerate`, {});
  }

  regenerateFullExam(): Observable<Question[]> {
    return this.api.post<Question[]>('/content/exam/full/regenerate', {});
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
