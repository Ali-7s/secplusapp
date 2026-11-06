import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/today', pathMatch: 'full' },
  { path: 'lessons', loadComponent: () => import('./components/networking/networking.component').then(m => m.NetworkingComponent) },
  { path: 'lessons/:slug', loadComponent: () => import('./components/networking/lesson.component').then(m => m.LessonComponent) },
  // Lessons used to live under /networking; old links and bookmarks still work.
  { path: 'networking', redirectTo: '/lessons', pathMatch: 'full' },
  { path: 'networking/:slug', redirectTo: '/lessons/:slug' },
  { path: 'acronyms', loadComponent: () => import('./components/acronyms/acronyms.component').then(m => m.AcronymsComponent) },
  { path: 'terms', loadComponent: () => import('./components/terms/terms.component').then(m => m.TermsComponent) },
  { path: 'exam', loadComponent: () => import('./components/practice-exam/practice-exam.component').then(m => m.PracticeExamComponent) },
  { path: 'objectives', loadComponent: () => import('./components/objectives/objectives.component').then(m => m.ObjectivesComponent) },
  { path: 'today', loadComponent: () => import('./components/progress/progress.component').then(m => m.ProgressComponent) },
  { path: 'progress', redirectTo: '/today' },
  { path: 'soc', loadComponent: () => import('./components/soc/soc.component').then(m => m.SocComponent) },
  { path: 'soc/:id', loadComponent: () => import('./components/soc/workstation.component').then(m => m.SocWorkstationComponent) },
  { path: 'ports', loadComponent: () => import('./components/ports/ports-page.component').then(m => m.PortsPageComponent) },
  { path: 'reference', loadComponent: () => import('./components/reference/reference.component').then(m => m.ReferenceComponent) },
  { path: '**', redirectTo: '/today' }
];
