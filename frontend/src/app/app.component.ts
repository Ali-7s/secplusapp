import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { ProgressService } from './services/progress.service';
import { ContentService } from './services/content.service';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, CommonModule,
    MatToolbarModule, MatButtonModule, MatIconModule, MatSidenavModule,
    MatListModule, MatTooltipModule, MatProgressBarModule,
    MatMenuModule, MatDividerModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  auth = inject(AuthService);
  theme = inject(ThemeService);
  private progressService = inject(ProgressService);
  private contentService = inject(ContentService);
  private router = inject(Router);

  isConfigured = true;
  overallProgress = 0;

  navItems = [
    { path: '/', icon: 'dashboard', label: 'Dashboard', exact: true },
    { path: '/roadmap', icon: 'map', label: 'Study Roadmap' },
    { path: '/exam/full', icon: 'assignment', label: 'Full Practice Exam' },
    { path: '/acronyms', icon: 'abc', label: 'Acronym Glossary' },
    { path: '/terms', icon: 'menu_book', label: 'Key Terms' },
    { path: '/progress', icon: 'insights', label: 'My Progress' },
  ];

  ngOnInit() {
    if (this.auth.isAuthenticated()) {
      this.contentService.getStatus().subscribe({
        next: s => this.isConfigured = s.configured,
        error: () => this.isConfigured = false
      });
      this.progressService.loadSummary().subscribe({
        next: s => this.overallProgress = s.overallProgress,
        error: () => {}
      });
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  get userEmail(): string {
    return this.auth.currentUser()?.email ?? '';
  }

  get userInitial(): string {
    return this.userEmail.charAt(0).toUpperCase();
  }

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  get isLoggedIn(): boolean {
    return this.auth.isAuthenticated();
  }
}
