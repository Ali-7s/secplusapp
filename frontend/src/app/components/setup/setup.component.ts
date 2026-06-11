import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatStepperModule } from '@angular/material/stepper';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ContentService } from '../../services/content.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatStepperModule, MatSnackBarModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss'
})
export class SetupComponent {
  private contentService = inject(ContentService);
  private snackBar = inject(MatSnackBar);

  apiKeyNote = '';
  testing = false;
  testResult: 'idle' | 'success' | 'error' = 'idle';
  testError = '';
  showKey = false;

  testConnection() {
    this.testing = true;
    this.testResult = 'idle';
    this.contentService.getStatus().subscribe({
      next: s => {
        this.testing = false;
        if (s.configured) {
          this.testResult = 'success';
          this.snackBar.open('API connected! Claude is ready.', '🎉', { duration: 3000 });
        } else {
          this.testResult = 'error';
          this.testError = 'Backend is running but ANTHROPIC_API_KEY is not set.';
        }
      },
      error: e => { this.testing = false; this.testResult = 'error'; this.testError = e.message; }
    });
  }
}
