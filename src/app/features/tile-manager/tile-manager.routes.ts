import { Routes } from '@angular/router';

export const TILE_MANAGER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/tile-manager/tile-manager.component').then((m) => m.TileManagerComponent),
  },
];
