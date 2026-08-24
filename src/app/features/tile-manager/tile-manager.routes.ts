import { Routes } from '@angular/router';

export const TILE_MANAGER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tile-manager.component').then((m) => m.TileManagerComponent),
  },
  {
    path: ':tileId',
    loadComponent: () => import('./tile-manager.component').then((m) => m.TileManagerComponent),
  },
];
