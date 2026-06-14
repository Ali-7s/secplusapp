import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Note } from '../models/note.model';

@Injectable({ providedIn: 'root' })
export class NotesService {
  private api = inject(ApiService);

  getAll(): Observable<Note[]> {
    return this.api.get<Note[]>('/notes');
  }

  getForSection(sectionId: string): Observable<Note[]> {
    return this.api.get<Note[]>(`/notes/section/${sectionId}`);
  }

  create(body: { sectionId: string; sectionName?: string; quote?: string; note: string }): Observable<Note> {
    return this.api.post<Note>('/notes', body);
  }

  delete(id: number): Observable<void> {
    return this.api.delete<void>(`/notes/${id}`);
  }
}
