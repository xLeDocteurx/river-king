import { Routes } from '@angular/router';

export const SCENE_EDITOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./scene-editor.component').then((m) => m.SceneEditorComponent),
  },
];
