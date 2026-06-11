import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../services/api.service';
import { UserSummary } from '../../models/auth.model';

interface SectionProgress {
  sectionId: string;
  domainId: string;
  examPassed: boolean;
  bestExamScore: number;
  examAttempts: number;
  flashcardsReviewed: number;
  practiceQuestionsAnswered: number;
  practiceQuestionsCorrect: number;
  labCompleted: boolean;
  conceptRead: boolean;
  unlocked: boolean;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink,
    MatTableModule, MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatSlideToggleModule, MatDialogModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatTooltipModule, MatFormFieldModule,
    MatInputModule, MatExpansionModule, MatSnackBarModule
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  users: UserSummary[] = [];
  loading = true;
  error = '';

  selectedUserId: number | null = null;
  userProgress: SectionProgress[] = [];
  progressLoading = false;

  editingSection: SectionProgress | null = null;
  editForm = this.fb.group({
    examPassed: [false],
    bestExamScore: [0],
    examAttempts: [0],
    flashcardsReviewed: [0],
    practiceQuestionsAnswered: [0],
    practiceQuestionsCorrect: [0],
    labCompleted: [false],
    conceptRead: [false],
    unlocked: [false]
  });

  displayedColumns = ['email', 'role', 'enabled', 'created', 'lastLogin', 'progress', 'actions'];
  stats = { totalUsers: 0, enabledUsers: 0 };

  ngOnInit(): void {
    this.loadUsers();
    this.loadStats();
  }

  loadUsers(): void {
    this.loading = true;
    this.api.get<UserSummary[]>('/admin/users').subscribe({
      next: users => { this.users = users; this.loading = false; },
      error: () => { this.error = 'Failed to load users'; this.loading = false; }
    });
  }

  loadStats(): void {
    this.api.get<any>('/admin/stats').subscribe({
      next: s => this.stats = s,
      error: () => {}
    });
  }

  selectUser(userId: number): void {
    if (this.selectedUserId === userId) {
      this.selectedUserId = null;
      this.userProgress = [];
      return;
    }
    this.selectedUserId = userId;
    this.editingSection = null;
    this.progressLoading = true;
    this.api.get<SectionProgress[]>(`/admin/users/${userId}/progress`).subscribe({
      next: p => { this.userProgress = p; this.progressLoading = false; },
      error: () => { this.progressLoading = false; }
    });
  }

  selectedUser(): UserSummary | undefined {
    return this.users.find(u => u.id === this.selectedUserId);
  }

  toggleEnabled(user: UserSummary): void {
    const newState = !user.enabled;
    this.api.put<void>(`/admin/users/${user.id}/enabled`, { enabled: newState }).subscribe({
      next: () => {
        user.enabled = newState;
        this.snackBar.open(`User ${newState ? 'enabled' : 'disabled'}`, 'OK', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to update user', 'OK', { duration: 3000 })
    });
  }

  deleteUser(user: UserSummary): void {
    if (!confirm(`Delete user ${user.email}? This cannot be undone.`)) return;
    this.api.delete<void>(`/admin/users/${user.id}`).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== user.id);
        if (this.selectedUserId === user.id) { this.selectedUserId = null; this.userProgress = []; }
        this.stats.totalUsers--;
        this.snackBar.open('User deleted', 'OK', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to delete user', 'OK', { duration: 3000 })
    });
  }

  startEdit(section: SectionProgress): void {
    this.editingSection = section;
    this.editForm.patchValue({
      examPassed: section.examPassed,
      bestExamScore: section.bestExamScore,
      examAttempts: section.examAttempts,
      flashcardsReviewed: section.flashcardsReviewed,
      practiceQuestionsAnswered: section.practiceQuestionsAnswered,
      practiceQuestionsCorrect: section.practiceQuestionsCorrect,
      labCompleted: section.labCompleted,
      conceptRead: section.conceptRead,
      unlocked: section.unlocked
    });
  }

  saveEdit(): void {
    if (!this.editingSection || !this.selectedUserId) return;
    const payload = this.editForm.value;
    this.api.put<SectionProgress>(
      `/admin/users/${this.selectedUserId}/progress/${this.editingSection.sectionId}`,
      payload
    ).subscribe({
      next: updated => {
        const idx = this.userProgress.findIndex(p => p.sectionId === updated.sectionId);
        if (idx !== -1) this.userProgress[idx] = updated;
        this.editingSection = null;
        this.snackBar.open('Progress updated', 'OK', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to save progress', 'OK', { duration: 3000 })
    });
  }

  cancelEdit(): void {
    this.editingSection = null;
  }
}
