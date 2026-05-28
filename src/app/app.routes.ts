import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'services',
    loadComponent: () =>
      import('./pages/services-page/services-page').then((m) => m.ServicesPageComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminComponent),
  },
  {
    path: 'test',
    loadComponent: () => import('./pages/test/test').then((m) => m.TestComponent),
  },
];
