import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'services',
    loadComponent: () =>
      import('./pages/services-page/services-page').then((m) => m.ServicesPageComponent),
  },
];
