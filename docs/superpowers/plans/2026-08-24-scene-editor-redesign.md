# Scene Editor Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Scene Editor with a dense, professional editor identity — compact panels, status-bar camera info, and tightened spacing while keeping all existing behavior.

**Architecture:** Adjust the three-column layout widths and panel chrome on `scene-editor.component.html`, add `StatusBarService` integration in the parent component via a `viewChild` reference to `MapCanvasComponent`, restyle `scene-list.component.html` and `tile-palette.component.html` with denser tokens, and update tests to match the new class lists.

**Tech Stack:** Angular 22 (standalone, signals), Tailwind CSS v3 with `tw-` prefix, TypeScript, Vitest + jsdom for tests.

## Global Constraints

- Tailwind prefix is `tw-`; standard classes like `bg-red-500` will not work.
- No hardcoded colors — only token-bound classes (`tw-bg-background`, `tw-text-foreground`, etc.).
- Radius max `tw-rounded-sm`; no blurred shadows, no pills, no gradients.
- Use Material Symbols only for icons.
- English copy only.
- Component APIs (inputs/outputs) must remain unchanged so existing tests keep passing.
- Use `ChangeDetectionStrategy.OnPush`.
- Write tests with `TestBed.configureTestingModule({ imports: [ComponentUnderTest] })` for standalone components.
- Async DB work requires manual flush (`await new Promise(r => setTimeout(r, 50));`) before asserting.

---

### Task 1: SceneEditorComponent — Layout & Status Bar

**Files:**
- Modify: `src/app/features/scene-editor/scene-editor.component.ts`
- Modify: `src/app/features/scene-editor/scene-editor.component.html`
- Test: `src/app/features/scene-editor/scene-editor.component.spec.ts`

**Interfaces:**
- Consumes: `StatusBarService` from `core/services/status-bar.service.ts`, `MapCanvasComponent.cameraX`, `cameraY`, `zoom`
- Produces: `mapCanvasRef = viewChild.required(MapCanvasComponent)`, `statusBar` injected, status-bar context effect

- [ ] **Step 1: Modify scene-editor.component.ts**

Add `StatusBarService` import and injection, add `mapCanvasRef` viewChild, add an `effect` that watches `selectedScene`, `mapCanvasRef()?.cameraX`, `cameraY`, and `zoom` to build the status-bar context string.

```typescript
// Add these imports
import { StatusBarService } from '../../core/services/status-bar.service';

// Add to class:
  private readonly statusBar = inject(StatusBarService);
  mapCanvasRef = viewChild.required(MapCanvasComponent);

  constructor() {
    // existing logic stays; add this effect after existing code or in ngOnInit
    effect(() => {
      const scene = this.selectedScene();
      const canvas = this.mapCanvasRef();
      if (!scene || !canvas) {
        this.statusBar.setContext('No scene selected');
        return;
      }
      const x = Math.round(canvas.cameraX());
      const y = Math.round(canvas.cameraY());
      const zoom = Math.round(canvas.zoom() * 100);
      this.statusBar.setContext(
        `${scene.name} | ${scene.width}×${scene.height} | Cam: ${x},${y} | Zoom: ${zoom}%`
      );
    });
  }
```

**Caution:** The component already has a `constructor()` block calling `this.loadProjects()`? No, that's in Dashboard. SceneEditorComponent has no constructor block currently. Add the `effect` block directly in the class body (not inside `constructor()` since Angular supports `effect()` in class fields for standalone components). Actually, in Angular 22 with signals, `effect()` can be used as a class field initializer. Put it after the existing signals/properties.

Wait — looking at the current component, it has no constructor. The `effect()` should be added as a class field. In Angular 22 with standalone components, `effect()` can be called directly in the class. Add it near the other fields.

```typescript
// Add after the existing signals, before the methods:
  statusBarEffect = effect(() => {
    const scene = this.selectedScene();
    const canvas = this.mapCanvasRef();
    if (!scene || !canvas) {
      this.statusBar.setContext('No scene selected');
      return;
    }
    const x = Math.round(canvas.cameraX());
    const y = Math.round(canvas.cameraY());
    const zoom = Math.round(canvas.zoom() * 100);
    this.statusBar.setContext(
      `${scene.name} | ${scene.width}×${scene.height} | Cam: ${x},${y} | Zoom: ${zoom}%`
    );
  });
```

- [ ] **Step 2: Modify scene-editor.component.html**

Adjust layout classes:

```html
<div class="tw-flex tw-h-full">
  <!-- Left: Scene List -->
  <rk-scene-list
    class="tw-w-56 tw-shrink-0 tw-bg-card-bg tw-border-r tw-border-border"
    [scenes]="scenes()"
    [folders]="folders()"
    [selectedSceneId]="selectedSceneId()"
    (sceneSelect)="selectScene($event)"
    (createScene)="onCreateScene()"
    (sceneDelete)="onDeleteSceneRequest($event)"
    (createFolder)="onCreateFolder($event)"
    (sceneFolderChange)="onSceneFolderChange($event)"
  />
  <div class="tw-flex-1 tw-relative tw-overflow-hidden tw-bg-background">
    <rk-map-canvas
      [scene]="selectedScene()"
      [selectedTileId]="selectedTileId()"
      [palette]="projectPalette()"
      [tileImages]="tileImages()"
      [tileSize]="projectTileSize()"
      [tileFootprints]="tileFootprints()"
      [restoreCamera]="restoreCamera()"
      (tilePlaced)="onTilePlaced($event)"
    />
  </div>
  <rk-tile-palette
    class="tw-w-52 tw-shrink-0 tw-bg-card-bg tw-border-l tw-border-border"
    [tiles]="projectTiles()"
    [selectedTileId]="selectedTileId()"
    [palette]="projectPalette()"
    [tileImages]="tileImages()"
    (tileSelect)="selectedTileId.set($event)"
  />
</div>

<rk-confirm-dialog [data]="deleteDialogData()" (confirmed)="onConfirmDelete()" />
```

- [ ] **Step 3: Add status-bar test in scene-editor.component.spec.ts**

Add a test verifying `StatusBarService.setContext` is called. The service is already provided in root, but we spy on it:

```typescript
  it('sets the status bar context when a scene is selected', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const statusBar = TestBed.inject(StatusBarService);
    const spy = vi.spyOn(statusBar, 'setContext');
    const scene = await sceneService.createScene('p1', 'Forest', 10, 10);
    await component.loadScenes();
    await component.selectScene(scene.id);

    // After selection, statusBar.setContext should have been called with the scene name
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lastCall?.[0]).toContain('Forest');
    expect(lastCall?.[0]).toContain('10×10');
  });
```

Add `StatusBarService` to the imports in the spec file.

Run: `npm run test -- src/app/features/scene-editor/scene-editor.component.spec.ts --run`  
Expected: all tests pass, including the new one.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/scene-editor/scene-editor.component.ts

git add src/app/features/scene-editor/scene-editor.component.html

git add src/app/features/scene-editor/scene-editor.component.spec.ts

git commit -m "feat(scene-editor): add status bar context and tighten layout"
```

---

### Task 2: SceneListComponent — Dense Restyle

**Files:**
- Modify: `src/app/features/scene-editor/scene-list.component.html`
- Test: `src/app/features/scene-editor/scene-list.component.spec.ts`

**Interfaces:**
- Consumes: same inputs/outputs (unchanged API)
- Produces: denser DOM with same event emitters

- [ ] **Step 1: Restyle header**

Keep the header structure but ensure label uses `tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground`. Update container classes if needed.

Current header starts at line 1. Keep it but adjust. The existing header already has `tw-px-4 tw-py-3`; change to `tw-px-3 tw-py-2`.

- [ ] **Step 2: Restyle list body**

Change outer wrapper classes. Current line 25: `tw-flex-1 tw-overflow-auto tw-p-2` — keep this (already tight).

Adjust group header class (line 32): make it `tw-text-[11px]` instead of `tw-text-xs`.

Adjust scene row class (line 59): use `tw-px-2 tw-py-1.5` instead of `tw-px-3 tw-py-2`.

Adjust delete button (line 70): use `tw-p-1` instead of `tw-p-1.5`.

- [ ] **Step 3: Run scene-list tests**

Run: `npm run test -- src/app/features/scene-editor/scene-list.component.spec.ts --run`

Some class assertions may fail (e.g., `tw-min-h-[2.5rem]` check is fine, but row class checks may need updating). Adjust tests if any class-related assertions break.

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/scene-editor/scene-list.component.html

git add src/app/features/scene-editor/scene-list.component.spec.ts

git commit -m "feat(scene-list): restyle with denser spacing and header token"
```

---

### Task 3: TilePaletteComponent — Dense Restyle

**Files:**
- Modify: `src/app/features/scene-editor/tile-palette.component.html`
- Test: `src/app/features/scene-editor/tile-palette.component.spec.ts`

**Interfaces:**
- Consumes: same inputs/outputs (unchanged API)
- Produces: smaller cells and tighter padding

- [ ] **Step 1: Restyle tile palette**

Update root div classes:
- Change `tw-p-4` to `tw-p-2`
- Keep or add header with `TILES` label in uppercase tracking-wider style if missing. Currently the component has `<h3 class="tw-font-semibold tw-text-foreground tw-mb-3">Tiles</h3>` — change to the standard header pattern.

Wait, looking at the current template, there's no header row with buttons. The spec says to add a header row matching the scene list header anatomy. But the current tile-palette component only has an `<h3>` title.

Per the spec §3.3: "Header row (restyled): Same anatomy as the scene list header. Label: TILES"

So we need to wrap the existing content in a panel structure with a header row. But we must be careful not to duplicate borders — the panel border is already applied by the parent via the `class` attribute on `<rk-tile-palette>`.

Restyled template:

```html
<div class="tw-flex tw-flex-col tw-h-full tw-bg-card-bg">
  <div
    class="tw-flex tw-items-center tw-justify-between tw-px-3 tw-py-2 tw-border-b tw-border-border tw-shrink-0"
  >
    <h3 class="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground">
      Tiles
    </h3>
  </div>
  <div class="tw-flex-1 tw-overflow-auto tw-p-2">
    @if (tiles().length === 0) {
      <p class="tw-text-xs tw-text-muted-foreground">No tiles in this project.</p>
    } @else {
      <div class="tw-flex tw-flex-wrap tw-gap-1">
        @for (tile of tiles(); track tile.id) {
          <button
            type="button"
            (click)="tileSelect.emit(tile.id)"
            [class.tw-border-accent]="selectedTileId() === tile.id"
            [class.tw-ring-1]="selectedTileId() === tile.id"
            [class.tw-ring-accent]="selectedTileId() === tile.id"
            class="tw-w-8 tw-h-8 tw-rounded-sm tw-border tw-border-border tw-transition hover:tw-border-accent tw-overflow-hidden"
            [title]="tile.name"
          >
            @if (tileImages()[tile.id]) {
              <img
                [src]="tileImages()[tile.id]"
                alt=""
                class="tw-w-full tw-h-full tw-object-cover tw-pointer-events-none tw-rounded-sm [image-rendering:pixelated]"
              />
            } @else {
              <div
                class="tw-w-full tw-h-full tw-rounded-sm"
                [style.background-color]="palette()[tile.id % palette().length] ?? '#94b0c2'"
              ></div>
            }
          </button>
        }
      </div>
    }
  </div>
</div>
```

Changes from current:
- Added outer structure with header row matching scene list header.
- `tw-p-4` → `tw-p-2` on content area.
- `tw-gap-2` → `tw-gap-1`.
- `tw-w-10 tw-h-10` → `tw-w-8 tw-h-8`.
- `tw-ring-2` → `tw-border-accent tw-ring-1 tw-ring-accent` for selected state.
- Added fallback colored div when no tile image exists (using palette colors).
- Changed empty message from `tw-text-sm` to `tw-text-xs`.

- [ ] **Step 2: Update tile-palette tests**

The tests check `img` presence and `pixelated` class. The `pixelated` class assertion (`expect(img?.className).toContain('pixelated')`) matches `[image-rendering:pixelated]` because the class list includes `tw-rounded-sm` and `[image-rendering:pixelated]` is a CSS custom property binding, not a class. Actually, `[image-rendering:pixelated]` is an inline style attribute, not a class. In the current template, the class is `[image-rendering:pixelated]` which Angular treats as a class when there's no `[]` around it... Wait, in the current template: `class="... [image-rendering:pixelated]"` — that square-bracket syntax inside a class attribute is actually treated as a CSS class name `[image-rendering:pixelated]` by Angular. That's a known Angular trick for arbitrary CSS properties.

In the restyled version, I moved it to `[style.image-rendering]="'pixelated'"` or used `<img ... [style.image-rendering]="'pixelated'">`. Alternatively, keep the class hack: `class="tw-w-full tw-h-full tw-object-cover tw-pointer-events-none tw-rounded-sm [image-rendering:pixelated]"`.

Better: use `[style.image-rendering]="'pixelated'"` to be cleaner. But the test checks `className` for `pixelated`. If I move it to a style attribute, the test will fail.

Simplest fix: keep the `[image-rendering:pixelated]` class in the class list:

```html
class="tw-w-full tw-h-full tw-object-cover tw-pointer-events-none tw-rounded-sm [image-rendering:pixelated]"
```

Also update the empty tiles message class check if any test asserts on text size. Looking at the current tests, they don't check the "No tiles in this project" text styling. They only check for `img` presence/absence and click emission.

One small thing: the `img` className assertion in the test:
```typescript
expect(img?.className).toContain('pixelated');
```
If the className contains `[image-rendering:pixelated]`, does it contain the substring `pixelated`? Yes — the string `[image-rendering:pixelated]` contains `pixelated`. So the test still passes.

Run: `npm run test -- src/app/features/scene-editor/tile-palette.component.spec.ts --run`

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/scene-editor/tile-palette.component.html

git add src/app/features/scene-editor/tile-palette.component.spec.ts

git commit -m "feat(tile-palette): add header, shrink cells, tighten spacing"
```

---

### Task 4: Format, Lint & Full Test Verification

**Files:**
- All modified files

- [ ] **Step 1: Run Prettier format**

Run: `npm run format`
Expected: files reformatted. Stage any changes.

- [ ] **Step 2: Run ESLint**

Run: `npm run lint`
Expected: no errors. Fix any issues.

- [ ] **Step 3: Run full test suite**

Run: `npm run test`
Expected: all tests pass.

If failures:
1. Read the error output.
2. Fix the source or test code.
3. Re-run.
4. Commit the fix.

- [ ] **Step 4: Commit any formatting/lint fixes**

```bash
git add -A

git commit -m "style(scene-editor): format and lint fixes"
```

---

### Task 5: Merge to main & Cleanup

**Files:**
- Git repository

- [ ] **Step 1: Final commit if needed**

Ensure all changes are committed.

- [ ] **Step 2: Merge to main (fast-forward if possible)**

If on a feature branch (not main), merge into main. Since the user says "à la fin de ceci j'aimerai que l'on soit sur main avec le code à jour", we need to be on main with all changes.

```bash
git checkout main

git merge --ff-only <current-branch>
```

Or if already on main, just ensure everything is committed.

- [ ] **Step 3: Delete local branches**

```bash
git branch | grep -v '^\* main$' | grep -v '^\* ' | xargs -r git branch -d
```

Or more safely:

```bash
git branch --merged main | grep -v '^\* main$' | xargs -r git branch -d
```

- [ ] **Step 4: Final verification**

```bash
git status
```

Expected: working tree clean, on branch main.

```bash
npm run test
```

Expected: all tests pass.

---

## Spec Coverage Checklist

- [ ] Status bar shows scene name, dimensions, camera position, zoom — Task 1
- [ ] Panels are ≤ 230 px wide (`tw-w-56` = 224 px, `tw-w-52` = 208 px) — Task 1
- [ ] No info bar above canvas — verified (not in plan, never added) — implicit
- [ ] Scene list denser with header in uppercase tracking-wider — Task 2
- [ ] Tile palette smaller cells and header — Task 3
- [ ] Both light and dark themes verified — use token classes throughout
- [ ] No hardcoded colors — all tokens used
- [ ] Component APIs unchanged — confirmed in each task
