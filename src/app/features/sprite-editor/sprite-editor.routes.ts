import { Routes } from '@angular/router';

export const SPRITE_EDITOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./sprite-editor.component').then((m) => m.SpriteEditorComponent),
  },
  {
    path: ':spriteId',
    loadComponent: () => import('./sprite-editor.component').then((m) => m.SpriteEditorComponent),
  },
];
