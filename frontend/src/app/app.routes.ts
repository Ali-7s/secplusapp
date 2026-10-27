import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/today', pathMatch: 'full' },
  { path: 'networking', loadComponent: () => import('./components/networking/networking.component').then(m => m.NetworkingComponent) },
  { path: 'networking/:slug', loadComponent: () => import('./components/networking/lesson.component').then(m => m.LessonComponent) },
  { path: 'acronyms', loadComponent: () => import('./components/acronyms/acronyms.component').then(m => m.AcronymsComponent) },
  { path: 'terms', loadComponent: () => import('./components/terms/terms.component').then(m => m.TermsComponent) },
  { path: 'exam', loadComponent: () => import('./components/practice-exam/practice-exam.component').then(m => m.PracticeExamComponent) },
  { path: 'objectives', loadComponent: () => import('./components/objectives/objectives.component').then(m => m.ObjectivesComponent) },
  { path: 'today', loadComponent: () => import('./components/progress/progress.component').then(m => m.ProgressComponent) },
  { path: 'progress', redirectTo: '/today' },
  { path: 'reference', loadComponent: () => import('./components/reference/reference.component').then(m => m.ReferenceComponent) },
  { path: '**', redirectTo: '/today' }
];
