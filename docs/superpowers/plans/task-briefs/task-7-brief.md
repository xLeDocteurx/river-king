# Task 7: Project Shell (Sidebar Navigation)

**Files:**

- Modify (replace placeholder): `src/app/features/project/pages/project-shell/project-shell.component.ts`
- Create: `src/app/features/project/components/project-sidebar/project-sidebar.component.ts`
- Create: `src/app/features/project/components/project-sidebar/project-sidebar.component.spec.ts`

**Context:**
Task 7. Previous tasks 1-6 complete. This task replaces the placeholder project-shell component from Task 4 and creates a sidebar navigation for the project workspace. The sidebar links to Scenes, Tiles, and Sprites sections within a project.

**Interfaces:**
- Consumes: `ActivatedRoute` (for project ID)
- Produces: ProjectShellComponent layout + ProjectSidebarComponent navigation

**Global Constraints:**
- ChangeDetectionStrategy.OnPush
- Standalone components
- Use signals (input())
- Tailwind prefix: `tw-`
- Component selector prefix: `rk-`
- Material Symbols icons

---

## Step 1: Implement ProjectSidebarComponent

Create: `src/app/features/project/components/project-sidebar/project-sidebar.component.ts`

```typescript
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'rk-project-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="tw-w-64 tw-h-full tw-border-r tw-border-border tw-bg-card tw-p-4 tw-flex tw-flex-col tw-gap-1">
      <div class="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-mb-2">
        <span class="material-symbols tw-text-primary" aria-hidden="true">construction</span>
        <span class="tw-font-semibold tw-text-foreground">Workspace</span>
      </div>

      <a
        [routerLink]="['scenes']"
        routerLinkActive="tw-bg-primary/10 tw-text-primary tw-border-l-2 tw-border-primary"
        class="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-rounded-md tw-transition hover:tw-bg-muted tw-text-muted-foreground"
      >
        <span class="material-symbols" aria-hidden="true">map</span>
        Scenes
      </a>
      <a
        [routerLink]="['tiles']"
        routerLinkActive="tw-bg-primary/10 tw-text-primary tw-border-l-2 tw-border-primary"
        class="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-rounded-md tw-transition hover:tw-bg-muted tw-text-muted-foreground"
      >
        <span class="material-symbols" aria-hidden="true">grid_view</span>
        Tiles
      </a>
      <a
        [routerLink]="['sprites']"
        routerLinkActive="tw-bg-primary/10 tw-text-primary tw-border-l-2 tw-border-primary"
        class="tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2 tw-rounded-md tw-transition hover:tw-bg-muted tw-text-muted-foreground"
      >
        <span class="material-symbols" aria-hidden="true">brush</span>
        Sprites
      </a>
    </nav>
  `,
})
export class ProjectSidebarComponent {
  projectId = input.required<string>();
}
```

---

## Step 2: Replace ProjectShellComponent placeholder

Replace: `src/app/features/project/pages/project-shell/project-shell.component.ts`

```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProjectSidebarComponent } from '../../components/project-sidebar/project-sidebar.component';

@Component({
  selector: 'rk-project-shell',
  standalone: true,
  imports: [RouterOutlet, ProjectSidebarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-h-screen tw-bg-background tw-text-foreground">
      <rk-project-sidebar projectId="" />
      <main class="tw-flex-1 tw-overflow-auto tw-p-4">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ProjectShellComponent {}
```

Note: The sidebar doesn't actually need the projectId for navigation since the router handles relative paths. Just pass an empty string or keep it optional.

---

## Step 3: Write tests for ProjectSidebarComponent

Create: `src/app/features/project/components/project-sidebar/project-sidebar.component.spec.ts`

Test cases:
1. Should render 3 navigation links (Scenes, Tiles, Sprites)
2. Should have correct routerLink paths
3. Should use Material Symbols icons

---

## Step 4: Run tests and lint

Run: `cd /home/lenoir/river-king && devbox run npm run test`
Expected: PASS

Run: `cd /home/lenoir/river-king && devbox run npm run lint`
Expected: PASS

Run: `cd /home/lenoir/river-king && devbox run npm run build`
Expected: PASS

---

## Step 5: Commit

```bash
cd /home/lenoir/river-king
git add src/app/features/project/
git commit -m "feature-7-project-shell: add project workspace shell with sidebar navigation"
```

---

**Report file:** Write to `docs/superpowers/plans/task-7-report.md`:
- Status: DONE / DONE_WITH_CONCERNS / BLOCKED
- Files created/modified
- Test results
- Lint results
- Build results
- Git commit hash
- Any issues encountered
