import { Routes } from '@angular/router';
import { superAdminGuard } from './core/guards/super-admin.guard';

export const routes: Routes = [
  {
    path: 'services',
    loadComponent: () =>
      import('./pages/services-page/services-page').then((m) => m.ServicesPageComponent),
  },
  {
    path: 'bookTicket',
    loadComponent: () => import('./pages/booking/booking-page').then((m) => m.BookingPageComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminComponent),
  },
  {
    path: 'super-admin',
    loadComponent: () => import('./pages/super-admin/super-admin').then((m) => m.SuperAdminComponent),
    canActivate: [superAdminGuard],
  },
  {
    path: 'test',
    loadComponent: () => import('./pages/test/test').then((m) => m.TestComponent),
  },
  {
    path: 'add-feedback',
    loadComponent: () =>
      import('./pages/feedback-submission/feedback-submission').then((m) => m.FeedbackSubmissionComponent),
  },
];
