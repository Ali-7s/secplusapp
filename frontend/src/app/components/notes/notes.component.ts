import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotesService } from '../../services/notes.service';
import { Note } from '../../models/note.model';

interface NoteGroup { sectionId: string; sectionName: string; notes: Note[]; }

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="page-container">
      <div class="notes-head">
        <h1><mat-icon>sticky_note_2</mat-icon> My Notes</h1>
        <p>Everything you've highlighted and annotated while studying, grouped by section.</p>
      </div>

      @if (loading) {
        <div class="loading-container"><mat-spinner></mat-spinner><p>Loading your notes...</p></div>
      } @else if (!groups.length) {
        <div class="empty-notes">
          <mat-icon>edit_note</mat-icon>
          <h3>No notes yet</h3>
          <p>In any <strong>Learn</strong> section, select a sentence and click <em>Add note</em> to save your own annotations. They'll collect here.</p>
          <button mat-raised-button color="primary" routerLink="/">Go study</button>
        </div>
      } @else {
        <div class="notes-count">{{ total }} note{{ total === 1 ? '' : 's' }} across {{ groups.length }} section{{ groups.length === 1 ? '' : 's' }}</div>
        @for (g of groups; track g.sectionId) {
          <div class="note-group">
            <div class="ng-header">
              <a [routerLink]="['/section', g.sectionId]" class="ng-title">
                <mat-icon>menu_book</mat-icon>
                <span>{{ g.sectionName || ('Section ' + g.sectionId) }}</span>
              </a>
              <span class="ng-count">{{ g.notes.length }}</span>
            </div>
            @for (n of g.notes; track n.id) {
              <div class="note-item">
                @if (n.quote) { <blockquote class="note-quote">“{{ n.quote }}”</blockquote> }
                <p class="note-text">{{ n.note }}</p>
                <div class="note-meta">
                  <span>{{ n.createdAt | date:'mediumDate' }}</span>
                  <button mat-icon-button class="note-del" (click)="remove(n)" matTooltip="Delete note">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .notes-head h1 { display: flex; align-items: center; gap: 10px; margin: 0 0 4px; font-size: 24px; }
    .notes-head mat-icon { color: #7c3aed; }
    .notes-head p { color: #64748b; margin: 0 0 20px; }
    .notes-count { font-size: 13px; color: #94a3b8; margin-bottom: 16px; font-weight: 600; }
    .empty-notes { text-align: center; padding: 60px 24px; color: #64748b;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #c4b5fd; }
      h3 { margin: 12px 0 8px; color: #1e293b; } p { max-width: 420px; margin: 0 auto 20px; line-height: 1.6; } }
    .note-group { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
    .ng-header { display: flex; align-items: center; gap: 10px; padding: 12px 18px; background: #faf5ff; border-bottom: 1px solid #eee; }
    .ng-title { display: flex; align-items: center; gap: 8px; text-decoration: none; color: #6b21a8; font-weight: 700; font-size: 15px; flex: 1;
      mat-icon { font-size: 18px; width: 18px; height: 18px; } &:hover span { text-decoration: underline; } }
    .ng-count { background: #ede9fe; color: #7c3aed; font-weight: 700; font-size: 12px; padding: 2px 10px; border-radius: 10px; }
    .note-item { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; &:last-child { border-bottom: none; } }
    .note-quote { margin: 0 0 8px; padding: 6px 12px; border-left: 3px solid #a855f7; background: #faf5ff;
      color: #6b21a8; font-style: italic; font-size: 13.5px; border-radius: 0 6px 6px 0; }
    .note-text { margin: 0; color: #334155; line-height: 1.6; white-space: pre-wrap; }
    .note-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #94a3b8; }
    .note-del { color: #cbd5e1; &:hover { color: #dc2626; } }
    :host-context([data-theme="dark"]) {
      .notes-head p, .notes-count { color: var(--c-muted); }
      .note-group { border-color: var(--c-border); }
      .ng-header { background: rgba(168,85,247,.1); border-color: var(--c-border); }
      .ng-title { color: #c4b5fd; }
      .ng-count { background: rgba(124,58,237,.2); color: #c4b5fd; }
      .note-item { border-color: var(--c-border); }
      .note-quote { background: rgba(168,85,247,.12); color: #e9d5ff; }
      .note-text { color: var(--c-text-2); }
      .empty-notes h3 { color: var(--c-text); } .empty-notes p { color: var(--c-muted); }
    }
  `],
})
export class NotesComponent implements OnInit {
  private notesService = inject(NotesService);
  private snackBar = inject(MatSnackBar);

  loading = true;
  groups: NoteGroup[] = [];
  total = 0;

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.notesService.getAll().subscribe({
      next: notes => { this.groups = this.group(notes); this.total = notes.length; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  private group(notes: Note[]): NoteGroup[] {
    const map = new Map<string, NoteGroup>();
    for (const n of notes) {                       // notes arrive newest-first
      let g = map.get(n.sectionId);
      if (!g) { g = { sectionId: n.sectionId, sectionName: n.sectionName ?? '', notes: [] }; map.set(n.sectionId, g); }
      if (!g.sectionName && n.sectionName) g.sectionName = n.sectionName;
      g.notes.push(n);
    }
    return [...map.values()];
  }

  remove(n: Note) {
    this.notesService.delete(n.id).subscribe({
      next: () => {
        this.groups = this.groups
          .map(g => ({ ...g, notes: g.notes.filter(x => x.id !== n.id) }))
          .filter(g => g.notes.length);
        this.total--;
        this.snackBar.open('Note deleted', 'OK', { duration: 2000 });
      },
      error: () => this.snackBar.open('Could not delete note', 'OK', { duration: 3000 }),
    });
  }
}
