import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'project/:id',
    loadChildren: () => import('./features/project/project.routes').then((m) => m.PROJECT_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
