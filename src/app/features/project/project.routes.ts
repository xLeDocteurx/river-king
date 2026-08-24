import { Routes } from '@angular/router';

export const PROJECT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./project-shell.component').then((m) => m.ProjectShellComponent),
    children: [
      {
        path: 'scenes',
        loadChildren: () =>
          import('../scene-editor/scene-editor.routes').then((m) => m.SCENE_EDITOR_ROUTES),
      },
      {
        path: 'tiles',
        loadChildren: () =>
          import('../tile-manager/tile-manager.routes').then((m) => m.TILE_MANAGER_ROUTES),
      },
      {
        path: 'sprites',
        loadChildren: () =>
          import('../sprite-editor/sprite-editor.routes').then((m) => m.SPRITE_EDITOR_ROUTES),
      },
      {
        path: '',
        loadComponent: () =>
          import('./session-restore/session-restore.component').then(
            (m) => m.SessionRestoreComponent,
          ),
      },
    ],
  },
];
