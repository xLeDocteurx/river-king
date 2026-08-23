# Dashboard Redesign ("Pro Editor" Style B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Propagate the approved "Éditeur Pro" visual identity (VS Code/Aseprite spirit) across the app via theme token redefinition, then rebuild the topbar and dashboard page as the reference showcase.

**Architecture:** All colors flow through CSS custom properties in `src/styles/theme.scss` mapped to Tailwind utilities in `tailwind.config.js` (prefix `tw-`). Redefining token values restyles the entire app for free; only topbar/dashboard/card templates get structural edits. Light and dark themes both stay (`.dark` class on `<html>` toggled by ThemeService — untouched).

**Tech Stack:** Angular 22 standalone components (signals, OnPush), Tailwind CSS v3 (`tw-` prefix), SCSS, Vitest via `@angular/build:unit-test` (jsdom).

## Global Constraints

- **All UI copy is English only. Non-negotiable.**
- Run ALL commands through devbox: `devbox run npm run test`, `devbox run npm run lint`, `devbox run npm run format:check`. Never bare `npm`/`npx`.
- Full test suite takes ~45–60 s wall time (builder startup dominates). A flaky spec exists: `pixel-data.spec > encodes pixel data from palette indices` fails ~once every few runs — re-run before investigating any failure.
- Commits go **directly on main**, message prefix `redesign:` for this feature.
- Tailwind classes ALWAYS prefixed `tw-` (e.g. `tw-bg-primary`). Valid color tokens: primary, primary-foreground, secondary, secondary-foreground, accent, accent-foreground, muted, muted-foreground, destructive, background, foreground, card-bg, card-fg, border, input. There is NO `bg-card`.
- Never inline templates: separate `.component.html` / `.component.scss` files.
- Every public method/class needs JSDoc (`@param`, `@returns`).
- Async IndexedDB work in event handlers is NOT tracked by `fixture.whenStable()` — flush with `await new Promise(r => setTimeout(r, 50));` before asserting.
- jsdom: no canvas; polyfill `HTMLDialogElement.showModal/close` when testing dialogs.

---

### Task 1: Stylesheet foundations — tokens + global conventions

Pure stylesheet swap (config-type change: no unit tests possible). Verified by the suite compiling and staying green.

**Files:**
- Modify: `src/styles/theme.scss` (lines 7–72, both `:root` and `.dark` blocks)
- Modify: `src/styles.scss`

**Interfaces:**
- Consumes: nothing.
- Produces: token values consumed by every later task (`--color-*` variables behind `tw-*` classes).

- [ ] **Step 1: Replace the `:root` block in `src/styles/theme.scss`**

```scss
:root {
  /* Surface & content */
  --color-background: #f3f3f3;
  --color-foreground: #1f1f1f;

  /* Cards */
  --color-card-bg: #ffffff;
  --color-card-fg: #1f1f1f;

  /* Brand – Primary (Blue) */
  --color-primary: #005fb8;
  --color-primary-foreground: #ffffff;

  /* Brand – Secondary */
  --color-secondary: #616161;
  --color-secondary-foreground: #ffffff;

  /* Accent highlight */
  --color-accent: #005fb8;
  --color-accent-foreground: #ffffff;

  /* Muted / subtle */
  --color-muted: #e8eaed;
  --color-muted-foreground: #616161;

  /* Destructive / Error */
  --color-destructive: #cd3131;

  /* Borders & inputs */
  --color-border: #d4d4d4;
  --color-input: #d4d4d4;
}
```

- [ ] **Step 2: Replace the `.dark, [data-theme='dark']` block in `src/styles/theme.scss`**

```scss
.dark,
[data-theme='dark'] {
  /* Surface & content */
  --color-background: #1e1e1e;
  --color-foreground: #cccccc;

  /* Cards */
  --color-card-bg: #252526;
  --color-card-fg: #cccccc;

  /* Brand – Primary (Blue) */
  --color-primary: #0e639c;
  --color-primary-foreground: #ffffff;

  /* Brand – Secondary */
  --color-secondary: #8a8a8a;
  --color-secondary-foreground: #1e1e1e;

  /* Accent highlight */
  --color-accent: #41a6f6;
  --color-accent-foreground: #1e1e1e;

  /* Muted / subtle */
  --color-muted: #2d2d2d;
  --color-muted-foreground: #969696;

  /* Destructive / Error */
  --color-destructive: #f14c4c;

  /* Borders & inputs */
  --color-border: #3c3c3c;
  --color-input: #3c3c3c;
}
```

Keep the comment header, `@font-face` and `.material-symbols` sections untouched.

- [ ] **Step 3: Extend `src/styles.scss`**

Replace its entire content with:

```scss
@use './styles/theme';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    font-family: theme('fontFamily.sans');
    font-size: 14px;
  }

  ::selection {
    background-color: var(--color-accent);
    color: var(--color-accent-foreground);
  }

  :focus-visible {
    outline: 1px solid var(--color-accent);
    outline-offset: -1px;
  }
}

/* Slim editor-style scrollbars */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-border);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-muted-foreground);
}
```

- [ ] **Step 4: Verify suite compiles and stays green**

Run: `devbox run npm run test`
Expected: all 172 tests pass (30 files). If `pixel-data.spec` encode test fails alone, re-run once.

- [ ] **Step 5: Commit**

```bash
git add src/styles/theme.scss src/styles.scss
git commit -m "redesign: adopt pro-editor theme tokens and global density conventions"
```

---

### Task 2: Topbar — brand mark, editor tabs, ghost theme toggle

**Files:**
- Modify: `src/app/app.spec.ts`
- Modify: `src/app/app.component.html`

**Interfaces:**
- Consumes: tokens from Task 1 (`muted` bar background, `accent` underline/highlight).
- Produces: nav links expose `aria-current="page"` on the active route (later tasks/tests may rely on it).

- [ ] **Step 1: Rewrite the failing tests in `src/app/app.spec.ts`**

Replace the `'should highlight the active nav item in the top bar'` test and add a toggle test:

```typescript
it('should mark the active nav tab with aria-current', async () => {
  const router = TestBed.inject(Router);
  await router.navigateByUrl('/project/p1/scenes');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();

  const compiled = fixture.nativeElement as HTMLElement;
  const links = Array.from(compiled.querySelectorAll('nav a'));
  expect(links.length).toBe(3);

  const active = links.filter((a) => a.getAttribute('aria-current') === 'page');
  expect(active).toHaveLength(1);
  expect(active[0].getAttribute('href')).toContain('/project/p1/scenes');
});

it('should render an icon-only theme toggle button', async () => {
  fixture.detectChanges();

  const compiled = fixture.nativeElement as HTMLElement;
  const toggle = compiled.querySelector<HTMLButtonElement>('header button[type="button"]');
  expect(toggle).toBeTruthy();
  expect(toggle!.getAttribute('aria-label')).toMatch(/switch to (light|dark) theme/i);
  expect(toggle!.textContent?.trim()).toBe('');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `devbox run npm run test`
Expected: FAIL — `aria-current` never set (routerLinkActive only toggles classes today), and the toggle button contains the text "Light"/"Dark".

- [ ] **Step 3: Rewrite `src/app/app.component.html`**

```html
<div class="tw-flex tw-flex-col tw-h-screen tw-bg-background tw-text-foreground">
  <header
    class="tw-flex tw-h-[35px] tw-items-center tw-justify-between tw-px-3 tw-border-b tw-border-border tw-bg-muted"
  >
    <div class="tw-flex tw-items-center tw-gap-5">
      <!-- Brand -->
      <a
        [routerLink]="['/']"
        class="tw-flex tw-items-center tw-gap-2 hover:tw-opacity-80 tw-transition"
      >
        <span class="tw-block tw-w-2.5 tw-h-2.5 tw-bg-accent" aria-hidden="true"></span>
        <span class="tw-text-sm tw-font-semibold">River King Engine</span>
      </a>

      <!-- Project navigation (visible only when inside a project) -->
      @if (isProjectRoute()) {
        <nav
          class="tw-flex tw-items-stretch tw-self-stretch tw-border-l tw-border-border tw-pl-4"
        >
          <a
            [routerLink]="['/project', projectId(), 'scenes']"
            routerLinkActive="tw-text-foreground tw-border-accent"
            ariaCurrentWhenActive="page"
            class="tw-flex tw-items-center tw-px-2.5 tw-text-xs tw-font-medium tw-text-muted-foreground tw-border-b tw-border-transparent hover:tw-text-foreground tw-transition"
          >
            Scenes
          </a>
          <a
            [routerLink]="['/project', projectId(), 'tiles']"
            routerLinkActive="tw-text-foreground tw-border-accent"
            ariaCurrentWhenActive="page"
            class="tw-flex tw-items-center tw-px-2.5 tw-text-xs tw-font-medium tw-text-muted-foreground tw-border-b tw-border-transparent hover:tw-text-foreground tw-transition"
          >
            Tiles
          </a>
          <a
            [routerLink]="['/project', projectId(), 'sprites']"
            routerLinkActive="tw-text-foreground tw-border-accent"
            ariaCurrentWhenActive="page"
            class="tw-flex tw-items-center tw-px-2.5 tw-text-xs tw-font-medium tw-text-muted-foreground tw-border-b tw-border-transparent hover:tw-text-foreground tw-transition"
          >
            Sprites
          </a>
        </nav>
      }
    </div>

    <button
      type="button"
      (click)="theme.toggle()"
      [attr.aria-label]="
        theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      "
      class="tw-inline-flex tw-items-center tw-justify-center tw-p-1.5 tw-rounded-sm tw-text-muted-foreground hover:tw-text-foreground hover:tw-bg-card-bg tw-transition"
    >
      <span class="material-symbols tw-text-base" aria-hidden="true">
        @if (theme.theme() === 'dark') {
          light_mode
        } @else {
          dark_mode
        }
      </span>
    </button>
  </header>

  <main class="tw-flex-1 tw-overflow-hidden">
    <router-outlet />
  </main>
</div>

<rk-toast />
```

NOTE: `ariaCurrentWhenActive="page"` (input of `routerLinkActive`) sets `aria-current` automatically on the active link — no extra binding needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `devbox run npm run test`
Expected: PASS — including both rewritten app tests and all others.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.component.html src/app/app.spec.ts
git commit -m "redesign: restyle topbar with editor tabs and ghost theme toggle"
```

---

### Task 3: Project card — anatomy and whole-card interaction

Behavioral change: opening moves from an explicit button to the whole card (click + keyboard). Delete stays a hover-revealed button that must not trigger open.

**Files:**
- Modify: `src/app/features/dashboard/project-card.component.spec.ts`
- Modify: `src/app/features/dashboard/project-card.component.ts`
- Modify: `src/app/features/dashboard/project-card.component.html`

**Interfaces:**
- Consumes: `Project` model (`name`, `updatedAt`, `palette[]`, `tileSize`, `mapWidth`, `mapHeight`, `id`).
- Produces: unchanged outputs `(open)="string"` / `(delete)="string"`; new public methods `activate(): void`, `onDelete(event: Event): void`; root element carries `data-testid="project-card"`, palette row `data-testid="palette-row"`.

- [ ] **Step 1: Update the failing tests in `project-card.component.spec.ts`**

Remove the `'should emit open with project id when open button clicked'` test. Add these three tests and adjust the palette test's container lookup:

```typescript
it('should emit open with project id when the card body is clicked', async () => {
  const fixture = TestBed.createComponent(ProjectCardComponent);
  const project = createMockProject({ id: 'project-42' });
  fixture.componentRef.setInput('project', project);
  await fixture.whenStable();
  fixture.detectChanges();

  let emittedId: string | undefined;
  fixture.componentInstance.open.subscribe((id) => {
    emittedId = id;
  });

  const compiled = fixture.nativeElement as HTMLElement;
  const card = compiled.querySelector<HTMLElement>('[data-testid="project-card"]');
  expect(card).toBeTruthy();
  card!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  expect(emittedId).toBe('project-42');
});

it('should emit open on Enter key press for keyboard accessibility', async () => {
  const fixture = TestBed.createComponent(ProjectCardComponent);
  fixture.componentRef.setInput('project', createMockProject({ id: 'project-7' }));
  await fixture.whenStable();
  fixture.detectChanges();

  let emittedId: string | undefined;
  fixture.componentInstance.open.subscribe((id) => {
    emittedId = id;
  });

  const compiled = fixture.nativeElement as HTMLElement;
  const card = compiled.querySelector<HTMLElement>('[data-testid="project-card"]');
  card!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

  expect(emittedId).toBe('project-7');
});

it('should show tile size and map dimensions in the meta line', async () => {
  const fixture = TestBed.createComponent(ProjectCardComponent);
  const updatedAt = new Date(2026, 0, 15).getTime();
  fixture.componentRef.setInput(
    'project',
    createMockProject({ updatedAt, tileSize: 16, mapWidth: 40, mapHeight: 30 }),
  );
  await fixture.whenStable();
  fixture.detectChanges();

  const compiled = fixture.nativeElement as HTMLElement;
  const meta = compiled.querySelector<HTMLElement>('[data-testid="card-meta"]');
  const expectedDate = new Date(updatedAt).toLocaleDateString();
  expect(meta!.textContent?.replace(/\s+/g, ' ').trim()).toBe(
    `Updated ${expectedDate} · Tile 16px · 40×30`,
  );
});
```

In `'should display palette colors'` replace the container lookup lines with:

```typescript
const paletteContainer = compiled.querySelector('[data-testid="palette-row"]');
```

In `'should emit delete with project id when delete button clicked'` append after the dispatch (delete must not bubble into open):

```typescript
let openEmitted = false;
fixture.componentInstance.open.subscribe(() => {
  openEmitted = true;
});
expect(openEmitted).toBe(false);
```

(Subscribe before dispatching.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `devbox run npm run test`
Expected: FAIL — no `[data-testid="project-card"]`, no `[data-testid="card-meta"]`, old markup lacks the meta wording.

- [ ] **Step 3: Implement the card**

Replace `src/app/features/dashboard/project-card.component.html` entirely:

```html
<div
  role="button"
  tabindex="0"
  data-testid="project-card"
  (click)="activate()"
  (keydown.enter)="activate()"
  (keydown.space)="activate()"
  class="tw-group tw-relative tw-p-3 tw-rounded-sm tw-border tw-border-border tw-bg-card-bg tw-cursor-pointer tw-transition hover:tw-border-accent"
>
  <div class="tw-flex tw-items-start tw-justify-between tw-mb-1">
    <h3 class="tw-text-sm tw-font-semibold tw-text-foreground">{{ project().name }}</h3>
    <button
      type="button"
      (click)="onDelete($event)"
      title="Delete"
      class="tw-p-1 tw-rounded-sm tw-opacity-0 group-hover:tw-opacity-100 focus-visible:tw-opacity-100 tw-text-destructive hover:tw-bg-destructive/10 tw-transition"
    >
      <span class="material-symbols tw-text-sm" aria-hidden="true">delete</span>
    </button>
  </div>
  <p
    data-testid="card-meta"
    class="tw-text-[11px] tw-leading-relaxed tw-text-muted-foreground tw-mb-3"
  >
    Updated {{ formatDate(project().updatedAt) }} · Tile {{ project().tileSize }}px ·
    {{ project().mapWidth }}×{{ project().mapHeight }}
  </p>
  <div data-testid="palette-row" class="tw-flex tw-gap-1">
    @for (color of project().palette.slice(0, 8); track $index) {
      <div
        class="tw-w-3 tw-h-3 tw-border tw-border-border/50"
        [style.background-color]="color"
      ></div>
    }
  </div>
</div>
```

Add the two methods to `ProjectCardComponent` in `project-card.component.ts` (after `formatDate`):

```typescript
/**
 * Activates the card's primary action: emits the open output with the project id.
 */
activate(): void {
  this.open.emit(this.project().id);
}

/**
 * Handles a delete click without triggering the card's open action.
 * @param event DOM click event, stopped so it does not bubble to the card root.
 */
onDelete(event: Event): void {
  event.stopPropagation();
  this.delete.emit(this.project().id);
}
```

Update the class JSDoc to: `Displays a single project as a clickable editor-style card: name, meta line, palette preview, and a hover delete action.`

- [ ] **Step 4: Run tests to verify they pass**

Run: `devbox run npm run test`
Expected: PASS — all card tests (old + new) green.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/dashboard/project-card.component.ts src/app/features/dashboard/project-card.component.html src/app/features/dashboard/project-card.component.spec.ts
git commit -m "redesign: rebuild project card with full-card interaction and pro-editor anatomy"
```

---

### Task 4: Dashboard shell — header label, status bar, dense grid

**Files:**
- Create: `src/app/features/dashboard/dashboard.component.spec.ts`
- Modify: `src/app/features/dashboard/dashboard.component.ts`
- Modify: `src/app/features/dashboard/dashboard.component.html`

**Interfaces:**
- Consumes: `ProjectCardComponent` (unchanged API), `ProjectService.getAll()`, `DatabaseService` (test seeding).
- Produces: public method `countLabel(count: number): string` returning `"1 project"` / `"n projects"`; DOM hooks `[data-testid="status-count"]`, `[data-testid="dashboard-title"]`.

- [ ] **Step 1: Write the failing spec `dashboard.component.spec.ts`**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import 'fake-indexeddb/auto';
import { DashboardComponent } from './dashboard.component';
import { DatabaseService } from '../../core/services/database.service';
import type { Project } from '../../shared/models/project.model';

function makeProject(id: string): Project {
  return {
    id,
    name: `Project ${id}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    palette: ['#000000'],
    tileSize: 16,
    mapWidth: 40,
    mapHeight: 30,
  };
}

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let db: DatabaseService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
  });

  async function mountWithProjects(projects: Project[]): Promise<void> {
    await db.projects.bulkAdd(projects);
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 50));
    fixture.detectChanges();
  }

  it('should display the My Projects header label', async () => {
    await mountWithProjects([]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="dashboard-title"]')?.textContent?.trim()).toBe(
      'My Projects',
    );
  });

  it('should pluralize the project count in the status bar', async () => {
    await mountWithProjects([
      makeProject('a'),
      makeProject('b'),
      makeProject('c'),
    ]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="status-count"]')?.textContent?.trim()).toBe(
      '3 projects',
    );
  });

  it('should use singular wording for a single project', async () => {
    await mountWithProjects([makeProject('only')]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="status-count"]')?.textContent?.trim()).toBe(
      '1 project',
    );
  });

  it('should render one card per project', async () => {
    await mountWithProjects([makeProject('a'), makeProject('b')]);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('rk-project-card').length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `devbox run npm run test`
Expected: FAIL — no `data-testid="dashboard-title"` / `"status-count"` in the template yet.

- [ ] **Step 3: Implement shell**

Add to `DashboardComponent` (after `formatDate`-equivalent area; near other helpers):

```typescript
/**
 * Builds the pluralized project count label for the status bar.
 * @param count Number of projects.
 * @returns Label such as "1 project" or "3 projects".
 */
countLabel(count: number): string {
  return `${count} ${count === 1 ? 'project' : 'projects'}`;
}
```

Rewrite `dashboard.component.html`:

```html
<div class="tw-min-h-screen tw-bg-background tw-text-foreground">
  <header class="tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-3">
    <h1
      data-testid="dashboard-title"
      class="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground"
    >
      My Projects
    </h1>
    <button
      type="button"
      (click)="createDialog.open()"
      class="tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-sm tw-bg-primary tw-text-primary-foreground tw-text-xs tw-transition hover:tw-opacity-90"
    >
      <span class="material-symbols tw-text-sm" aria-hidden="true">add</span>
      New Project
    </button>
  </header>

  <main class="tw-px-4 tw-pb-4">
    @if (projects().length === 0) {
      <div
        class="tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-20 tw-text-muted-foreground"
      >
        <span class="material-symbols tw-text-5xl tw-mb-3">folder_open</span>
        <p class="tw-text-sm tw-font-semibold">No projects yet</p>
        <p class="tw-text-xs">Create your first project to get started</p>
      </div>
    } @else {
      <div class="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-3">
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

  <footer
    class="tw-fixed tw-bottom-0 tw-left-0 tw-right-0 tw-h-[22px] tw-flex tw-items-center tw-justify-between tw-px-3 tw-bg-primary tw-text-primary-foreground tw-text-[11px]"
  >
    <span data-testid="status-count">{{ countLabel(projects().length) }}</span>
    <span>River King Engine</span>
  </footer>

  <rk-project-create-dialog #createDialog />

  <rk-confirm-dialog
    #confirmDialog
    [data]="deleteDialogData"
    (confirmed)="deleteProject(projectToDelete()!)"
    (cancelled)="projectToDelete.set(null)"
  />
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `devbox run npm run test`
Expected: PASS — all four new dashboard tests plus existing suites.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/dashboard/dashboard.component.ts src/app/features/dashboard/dashboard.component.html src/app/features/dashboard/dashboard.component.spec.ts
git commit -m "redesign: add dashboard header label, dense grid, and status bar"
```

---

### Task 5: Dashed quick-create row + dialog polish

The dashed "+ New Project…" affordance appears inside the grid (when projects exist) and as the empty-state CTA; both open the existing create dialog. Dialog inputs/buttons get crisp corners + token borders (visual only, no behavioral tests).

**Files:**
- Modify: `src/app/features/dashboard/dashboard.component.spec.ts`
- Modify: `src/app/features/dashboard/dashboard.component.html`
- Modify: `src/app/features/dashboard/project-create-dialog.component.html`

**Interfaces:**
- Consumes: `ProjectCreateDialogComponent.open()` (public, existing).
- Produces: DOM hook `[data-testid="new-project-dashed"]` (grid variant) and `[data-testid="new-project-empty"]` (empty-state variant).

- [ ] **Step 1: Add failing tests to `dashboard.component.spec.ts`**

Add imports and two tests:

```typescript
import { By } from '@angular/platform-browser';
import { ProjectCreateDialogComponent } from './project-create-dialog.component';
```

```typescript
function createDialogSpy(): ReturnType<typeof vi.fn> {
  const dialogEl = fixture.debugElement.query(
    By.directive(ProjectCreateDialogComponent),
  ).componentInstance as ProjectCreateDialogComponent;
  return vi.spyOn(dialogEl, 'open');
}

it('should open the create dialog from the dashed row', async () => {
  await mountWithProjects([makeProject('a')]);
  const openSpy = createDialogSpy();

  const compiled = fixture.nativeElement as HTMLElement;
  const dashed = compiled.querySelector<HTMLElement>('[data-testid="new-project-dashed"]');
  expect(dashed).toBeTruthy();
  dashed!.click();
  await new Promise((r) => setTimeout(r, 50));

  expect(openSpy).toHaveBeenCalledTimes(1);
});

it('should offer the dashed CTA in the empty state and open the dialog', async () => {
  await mountWithProjects([]);
  const openSpy = createDialogSpy();

  const compiled = fixture.nativeElement as HTMLElement;
  expect(compiled.textContent).toContain('No projects yet');
  const cta = compiled.querySelector<HTMLElement>('[data-testid="new-project-empty"]');
  expect(cta).toBeTruthy();
  cta!.click();
  await new Promise((r) => setTimeout(r, 50));

  expect(openSpy).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `devbox run npm run test`
Expected: FAIL — no dashed elements in the template.

- [ ] **Step 3: Implement template changes in `dashboard.component.html`**

Inside the `@else` branch, after the `@for` loop but still inside the grid div, append:

```html
<button
  type="button"
  data-testid="new-project-dashed"
  (click)="createDialog.open()"
  class="tw-border tw-border-dashed tw-border-border tw-rounded-sm tw-p-4 tw-text-xs tw-text-muted-foreground hover:tw-border-accent hover:tw-text-accent tw-transition"
>
  + New Project…
</button>
```

Inside the empty-state `@if` branch, below the two `<p>` lines, append:

```html
<button
  type="button"
  data-testid="new-project-empty"
  (click)="createDialog.open()"
  class="tw-mt-4 tw-border tw-border-dashed tw-border-border tw-rounded-sm tw-px-4 tw-py-2 tw-text-xs tw-text-muted-foreground hover:tw-border-accent hover:tw-text-accent tw-transition"
>
  + New Project…
</button>
```

- [ ] **Step 4: Restyle the create dialog inputs (visual only)**

In `project-create-dialog.component.html`: on the name `<input>`, replace radius/border classes with `tw-rounded-sm tw-border tw-border-input tw-bg-background`; give the Cancel button `tw-rounded-sm` and the submit button `tw-rounded-sm` (keep their existing colors). Do not alter any bindings or methods.

- [ ] **Step 5: Run tests to verify they pass**

Run: `devbox run npm run test`
Expected: PASS — full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/dashboard/dashboard.component.html src/app/features/dashboard/dashboard.component.spec.ts src/app/features/dashboard/project-create-dialog.component.html
git commit -m "redesign: dashed quick-create row, empty-state CTA, dialog polish"
```

---

### Task 6: Final verification gates

**Files:** none expected to change (fix fallout if any).

- [ ] **Step 1: Full gates**

```bash
devbox run npm run test
devbox run npm run lint
devbox run npm run format:check
```

Expected: suite green (~176 tests), ESLint clean, Prettier clean. If Prettier complains, run `devbox run npm run format` and amend-free re-commit the touched files with `redesign: formatting`.

- [ ] **Step 2: Report**

Summarize commits made and remind the user to push (pushing is not possible from this environment) and to eyeball the result via `devbox run npm run start` in both themes.
