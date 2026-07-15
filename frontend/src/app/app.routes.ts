import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent) },
  { path: 'admin', loadComponent: () => import('./components/admin/admin.component').then(m => m.AdminComponent), canActivate: [adminGuard] },

  { path: '', loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [authGuard] },
  { path: 'roadmap', loadComponent: () => import('./components/roadmap/roadmap.component').then(m => m.RoadmapComponent), canActivate: [authGuard] },
  { path: 'domain/:id', loadComponent: () => import('./components/domain-detail/domain-detail.component').then(m => m.DomainDetailComponent), canActivate: [authGuard] },
  { path: 'section/:id', loadComponent: () => import('./components/section-study/section-study.component').then(m => m.SectionStudyComponent), canActivate: [authGuard] },
  { path: 'acronyms', loadComponent: () => import('./components/acronyms/acronyms.component').then(m => m.AcronymsComponent), canActivate: [authGuard] },
  { path: 'terms', loadComponent: () => import('./components/terms/terms.component').then(m => m.TermsComponent), canActivate: [authGuard] },
  { path: 'reference', loadComponent: () => import('./components/reference/reference.component').then(m => m.ReferenceComponent), canActivate: [authGuard] },
  { path: 'progress', loadComponent: () => import('./components/progress/progress.component').then(m => m.ProgressComponent), canActivate: [authGuard] },
  { path: 'exam/full', loadComponent: () => import('./components/practice-exam/practice-exam.component').then(m => m.PracticeExamComponent), canActivate: [authGuard] },
  { path: 'exam/domain/:id', loadComponent: () => import('./components/practice-exam/practice-exam.component').then(m => m.PracticeExamComponent), canActivate: [authGuard] },
  { path: 'setup', loadComponent: () => import('./components/setup/setup.component').then(m => m.SetupComponent), canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
