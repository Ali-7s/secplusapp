import { Component, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavContent, MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { ThemeService } from './services/theme.service';
import { SyncService } from './services/sync.service';
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
  private content = viewChild(MatSidenavContent);

  constructor() {
    // Starts syncing on page load when this device has a sync code.
    inject(SyncService);
    // The page scrolls inside the side-nav content, not the window, so the router's own scroll reset never
    // fires. Start each new page at the top; a query change on the same page (a search box) keeps its place.
    let lastPath = '';
    inject(Router).events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(e => {
      const path = e.urlAfterRedirects.split(/[?#]/)[0];
      if (lastPath && path !== lastPath) this.content()?.scrollTo({ top: 0 });
      lastPath = path;
    });
  }

  /** `short` is the label in the top bar on wide screens, where all six must fit; the side menu uses `label`. */
  navItems = [
    { path: '/networking', icon: 'lan', label: 'Networking Basics', short: 'Networking' },
    { path: '/acronyms', icon: 'abc', label: 'Acronym Glossary', short: 'Acronyms' },
    { path: '/terms', icon: 'menu_book', label: 'Key Terms', short: 'Key Terms' },
    { path: '/objectives', icon: 'checklist', label: 'Exam Objectives', short: 'Objectives' },
    { path: '/reference', icon: 'table_chart', label: 'Reference Sheet', short: 'Reference' },
    { path: '/exam', icon: 'assignment', label: 'Practice Exam', short: 'Exam' },
    { path: '/today', icon: 'today', label: 'Today and Progress', short: 'Today' },
  ];
}
