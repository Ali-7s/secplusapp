import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { ThemeService } from './services/theme.service';
import { BackToTopComponent } from './components/back-to-top/back-to-top.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, BackToTopComponent,
    MatToolbarModule, MatButtonModule, MatIconModule, MatSidenavModule, MatListModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  theme = inject(ThemeService);

  navItems = [
    { path: '/networking', icon: 'lan', label: 'Networking Basics' },
    { path: '/acronyms', icon: 'abc', label: 'Acronym Glossary' },
    { path: '/terms', icon: 'menu_book', label: 'Key Terms' },
    { path: '/reference', icon: 'table_chart', label: 'Reference Sheet' },
    { path: '/exam', icon: 'assignment', label: 'Practice Exam' },
  ];
}
