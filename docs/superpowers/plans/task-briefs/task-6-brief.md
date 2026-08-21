# Task 6: Dashboard Page (List Projects)

**Files:**

- Modify (replace placeholder): `src/app/features/dashboard/pages/dashboard/dashboard.component.ts`
- Create: `src/app/features/dashboard/pages/dashboard/dashboard.component.scss`
- Create: `src/app/features/dashboard/components/project-card/project-card.component.ts`
- Create: `src/app/features/dashboard/components/project-card/project-card.component.spec.ts`
- Create (or modify placeholder): `src/app/features/dashboard/components/project-form/project-form.component.ts`

**Context:**
This is Task 6. Tasks 1-5 are complete. This page replaces the placeholder dashboard component created in Task 4. It lists all projects, allows creating new ones, opening existing ones (routes to `/project/:id`), and deleting with confirmation.

**Interfaces:**

- Consumes: `ProjectService` (CRUD), `ConfirmDialogComponent` (shared)
- Produces: Dashboard page with project list + create/delete functionality

**Global Constraints:**

- ChangeDetectionStrategy.OnPush
- Standalone components with imports array
- Use signals (signal(), input(), output())
- Tailwind prefix: `tw-`
- Component selector prefix: `rk-`
- Material Symbols icons
- `darkMode: 'class'` via `.dark` class
- All deletions require ConfirmDialog

---

## Step 1: Implement DashboardComponent

Replace the placeholder at: `src/app/features/dashboard/pages/dashboard/dashboard.component.ts`

```typescript
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import type { Project } from '../../../shared/models/project.model';
import { ProjectCardComponent } from '../../components/project-card/project-card.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'rk-dashboard',
  standalone: true,
  imports: [ProjectCardComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-min-h-screen tw-bg-background tw-text-foreground">
      <header
        class="tw-flex tw-items-center tw-justify-between tw-px-6 tw-py-4 tw-border-b tw-border-border"
      >
        <div class="tw-flex tw-items-center tw-gap-3">
          <span class="material-symbols tw-text-3xl tw-text-primary" aria-hidden="true"
            >castle</span
          >
          <h1 class="tw-text-2xl tw-font-bold">River King Engine</h1>
        </div>
        <button
          type="button"
          (click)="showCreateForm.set(true)"
          class="tw-flex tw-items-center tw-gap-2 tw-px-4 tw-py-2 tw-rounded-md tw-bg-primary tw-text-primary-foreground tw-transition hover:tw-opacity-90"
        >
          <span class="material-symbols" aria-hidden="true">add</span>
          New Project
        </button>
      </header>

      <main class="tw-p-6">
        @if (projects().length === 0) {
          <div
            class="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-20 tw-text-muted-foreground"
          >
            <span class="material-symbols tw-text-6xl tw-mb-4">folder_open</span>
            <p class="tw-text-lg tw-font-semibold">No projects yet</p>
            <p>Create your first project to get started</p>
          </div>
        } @else {
          <div class="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-4">
            @for (project of projects(); track project.id) {
              <rk-project-card
                [project]="project"
                (open)="openProject($event)"
                (delete)="requestDelete($event)"
              />
            }
          </div>
        }
      </main>

      @if (showCreateForm()) {
        <div
          class="tw-fixed tw-inset-0 tw-bg-black/50 tw-flex tw-items-center tw-justify-center tw-z-50"
          (click)="showCreateForm.set(false)"
        >
          <div
            class="tw-bg-card tw-rounded-lg tw-shadow-lg tw-p-6 tw-max-w-md tw-w-full"
            (click)="$event.stopPropagation()"
          >
            <h2 class="tw-text-xl tw-font-bold tw-mb-4">New Project</h2>
            <form (submit)="createProject($event)" class="tw-flex tw-flex-col tw-gap-4">
              <label class="tw-flex tw-flex-col tw-gap-1">
                <span class="tw-text-sm tw-font-medium">Name</span>
                <input
                  type="text"
                  [value]="projectName()"
                  (input)="projectName.set($any($event.target).value)"
                  placeholder="My Awesome Game"
                  class="tw-px-3 tw-py-2 tw-rounded-md tw-border tw-border-input tw-bg-background tw-text-foreground focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-ring"
                  required
                />
              </label>
              <div class="tw-flex tw-justify-end tw-gap-2">
                <button
                  type="button"
                  (click)="showCreateForm.set(false)"
                  class="tw-px-4 tw-py-2 tw-rounded-md tw-border tw-border-border tw-bg-background tw-text-foreground hover:tw-bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="tw-px-4 tw-py-2 tw-rounded-md tw-bg-primary tw-text-primary-foreground hover:tw-opacity-90"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      @if (projectToDelete()) {
        <div
          class="tw-fixed tw-inset-0 tw-bg-black/50 tw-flex tw-items-center tw-justify-center tw-z-50"
          (click)="projectToDelete.set(null)"
        >
          <rk-confirm-dialog
            class="tw-bg-card tw-rounded-lg tw-shadow-lg"
            [data]="deleteDialogData()"
            (confirmed)="deleteProject(projectToDelete()!)"
            (cancelled)="projectToDelete.set(null)"
          />
        </div>
      }
    </div>
  `,
})
export class DashboardComponent {
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);

  projects = signal<Project[]>([]);
  showCreateForm = signal(false);
  projectToDelete = signal<string | null>(null);
  projectName = signal('');

  deleteDialogData = signal<ConfirmDialogData>({
    title: 'Delete Project',
    message: 'Are you sure you want to delete this project? This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  });

  constructor() {
    this.loadProjects();
  }

  async loadProjects() {
    try {
      const projects = await this.projectService.getAll();
      this.projects.set(projects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }

  async createProject(event: Event) {
    event.preventDefault();
    const name = this.projectName().trim();
    if (!name) return;

    try {
      const project = await this.projectService.create({
        name,
        palette: [
          '#000000',
          '#1D2B53',
          '#7E2553',
          '#008751',
          '#AB5236',
          '#5F574F',
          '#C2C3C7',
          '#FFF1E8',
          '#FF004D',
          '#FFA300',
          '#FFEC27',
          '#00E436',
          '#29ADFF',
          '#83769C',
          '#FF77A8',
          '#FFCCAA',
        ],
        tileSize: 16,
        mapWidth: 40,
        mapHeight: 30,
      });
      this.showCreateForm.set(false);
      this.projectName.set('');
      this.loadProjects();
      this.router.navigate(['/project', project.id]);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  }

  openProject(id: string) {
    this.router.navigate(['/project', id]);
  }

  requestDelete(id: string) {
    this.projectToDelete.set(id);
  }

  async deleteProject(id: string) {
    try {
      await this.projectService.delete(id);
      this.projectToDelete.set(null);
      this.loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }
}
```

---

## Step 2: Implement ProjectCardComponent

Create: `src/app/features/dashboard/components/project-card/project-card.component.ts`

```typescript
import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { Project } from '../../../../shared/models/project.model';

@Component({
  selector: 'rk-project-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="tw-group tw-relative tw-p-4 tw-rounded-lg tw-border tw-border-border tw-bg-card tw-transition hover:tw-border-primary hover:tw-shadow-md"
    >
      <div class="tw-flex tw-items-start tw-justify-between tw-mb-2">
        <div class="tw-flex tw-items-center tw-gap-2">
          <span class="material-symbols tw-text-primary" aria-hidden="true">videogame_asset</span>
          <h3 class="tw-text-lg tw-font-semibold tw-text-foreground">{{ project().name }}</h3>
        </div>
        <div class="tw-flex tw-gap-1 tw-opacity-0 group-hover:tw-opacity-100 tw-transition">
          <button
            type="button"
            (click)="open.emit(project().id); $event.stopPropagation()"
            class="tw-p-1 tw-rounded-md hover:tw-bg-muted"
            title="Open"
          >
            <span class="material-symbols tw-text-sm" aria-hidden="true">open_in_new</span>
          </button>
          <button
            type="button"
            (click)="delete.emit(project().id); $event.stopPropagation()"
            class="tw-p-1 tw-rounded-md tw-text-destructive hover:tw-bg-destructive/10"
            title="Delete"
          >
            <span class="material-symbols tw-text-sm" aria-hidden="true">delete</span>
          </button>
        </div>
      </div>
      <div class="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-text-muted-foreground">
        <span class="material-symbols tw-text-xs" aria-hidden="true">calendar_today</span>
        <span>{{ formatDate(project().updatedAt) }}</span>
      </div>
      <div class="tw-flex tw-gap-1 tw-mt-3">
        @for (color of project().palette.slice(0, 8); track $index) {
          <div
            class="tw-w-4 tw-h-4 tw-rounded-sm tw-border tw-border-border/50"
            [style.background-color]="color"
          ></div>
        }
      </div>
    </div>
  `,
})
export class ProjectCardComponent {
  project = input.required<Project>();
  open = output<string>();
  delete = output<string>();

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }
}
```

---

## Step 3: Create SCSS for Dashboard

Create: `src/app/features/dashboard/pages/dashboard/dashboard.component.scss`

Keep minimal or empty (Tailwind handles styling via inline classes).

---

## Step 4: Write tests for ProjectCardComponent

Create: `src/app/features/dashboard/components/project-card/project-card.component.spec.ts`

Test cases:

1. Should render project name
2. Should emit `open` with project id when open button clicked
3. Should emit `delete` with project id when delete button clicked
4. Should display palette colors

---

## Step 5: Run tests and lint

Run: `cd /home/lenoir/river-king && devbox run npm run test`
Expected: PASS (all test files)

Run: `cd /home/lenoir/river-king && devbox run npm run lint`
Expected: PASS

Run: `cd /home/lenoir/river-king && devbox run npm run build`
Expected: PASS

---

## Step 6: Commit

```bash
cd /home/lenoir/river-king
git add src/app/features/dashboard/
git commit -m "feature-6-dashboard: add dashboard page with project list, create, and delete"
```

---

**Report file:** Write to `docs/superpowers/plans/task-6-report.md`:

- Status: DONE / DONE_WITH_CONCERNS / BLOCKED
- Files created/modified (list each)
- Test results: pass/fail + count per file
- Lint results
- Build results
- Git commit hash
- Any issues encountered
