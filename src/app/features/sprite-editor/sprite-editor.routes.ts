import { Routes } from '@angular/router';

export const SPRITE_EDITOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/sprite-editor/sprite-editor.component').then((m) => m.SpriteEditorComponent),
  },
];
