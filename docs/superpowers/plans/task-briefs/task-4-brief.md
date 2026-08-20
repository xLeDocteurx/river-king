# Task 4: Routing Setup

**Files:**

- Modify: `src/app/app.routes.ts`
- Create: `src/app/features/dashboard/dashboard.routes.ts`
- Create: `src/app/features/project/project.routes.ts`
- Create: `src/app/features/scene-editor/scene-editor.routes.ts`
- Create: `src/app/features/tile-manager/tile-manager.routes.ts`
- Create: `src/app/features/sprite-editor/sprite-editor.routes.ts`

**Context:**
This is Task 4 of a multi-task Angular 22 game engine build. Tasks 1-3 are complete (DatabaseService, Domain Models, ProjectService). This task wires up lazy-loaded routing for the entire application. The routes reference components that will be created in later tasks (Task 6: Dashboard, Task 7: Project Shell, Task 8: Scene Editor, Task 10: Tile Manager, Task 11: Sprite Editor). Angular lazy-loading means the component files don't need to exist yet — they will be created in their respective tasks.

**Global Constraints:**
- Angular standalone components
- Lazy loading via `loadComponent` and `loadChildren`
- Component selectors prefixed with `rk`

---

## Step 1: Update app.routes.ts

Read and modify: `src/app/app.routes.ts`

Replace with:

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
  {
    path: 'project/:id',
    loadChildren: () =>
      import('./features/project/project.routes').then((m) => m.PROJECT_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
```

---

## Step 2: Create dashboard.routes.ts

Create: `src/app/features/dashboard/dashboard.routes.ts`

```typescript
import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
];
```

---

## Step 3: Create project.routes.ts

Create: `src/app/features/project/project.routes.ts`

```typescript
import { Routes } from '@angular/router';

export const PROJECT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/project-shell/project-shell.component').then((m) => m.ProjectShellComponent),
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
      { path: '', redirectTo: 'scenes', pathMatch: 'full' },
    ],
  },
];
```

---

## Step 4: Create feature route files

Create: `src/app/features/scene-editor/scene-editor.routes.ts`

```typescript
import { Routes } from '@angular/router';

export const SCENE_EDITOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/scene-editor/scene-editor.component').then((m) => m.SceneEditorComponent),
  },
];
```

Create: `src/app/features/tile-manager/tile-manager.routes.ts`

```typescript
import { Routes } from '@angular/router';

export const TILE_MANAGER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/tile-manager/tile-manager.component').then((m) => m.TileManagerComponent),
  },
];
```

Create: `src/app/features/sprite-editor/sprite-editor.routes.ts`

```typescript
import { Routes } from '@angular/router';

export const SPRITE_EDITOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/sprite-editor/sprite-editor.component').then((m) => m.SpriteEditorComponent),
  },
];
```

---

## Step 5: Verify build passes

Run: `cd /home/lenoir/river-king && devbox run npm run build`
Expected: PASS — Build should succeed (lazy-loaded routes resolve at runtime, not build time)

Run: `cd /home/lenoir/river-king && devbox run npm run lint`
Expected: PASS

---

## Step 6: Commit

```bash
cd /home/lenoir/river-king
git add src/app/app.routes.ts src/app/features/*/dashboard.routes.ts src/app/features/*/project.routes.ts src/app/features/*/scene-editor.routes.ts src/app/features/*/tile-manager.routes.ts src/app/features/*/sprite-editor.routes.ts
git commit -m "feature-4-routing-setup: add lazy-loaded routes for all features"
```

---

**Report file:** Write to `docs/superpowers/plans/task-4-report.md`:
- Status: DONE / DONE_WITH_CONCERNS / BLOCKED
- Files created/modified
- Build results
- Lint results
- Git commit hash
- Any issues encountered
