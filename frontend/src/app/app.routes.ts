import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/acronyms', pathMatch: 'full' },
  { path: 'acronyms', loadComponent: () => import('./components/acronyms/acronyms.component').then(m => m.AcronymsComponent) },
  { path: 'terms', loadComponent: () => import('./components/terms/terms.component').then(m => m.TermsComponent) },
  { path: 'reference', loadComponent: () => import('./components/reference/reference.component').then(m => m.ReferenceComponent) },
  { path: '**', redirectTo: '/acronyms' }
];
