# Play viewport resolution — Implementation Plan

**Issue:** [#107](https://github.com/xLeDocteurx/river-king/issues/107)
**Spec:** `docs/superpowers/specs/2026-10-15-play-viewport-resolution-design.md`
**Branch:** `feature-107` (from `develop`)

## Goal

Give every project a fixed play **viewport resolution** (in game pixels, default **256×144**),
configured once at project creation. In Play mode the canvas stops zooming and instead renders
the fixed resolution **integer-scaled and centered (letterboxed)** to fill the available area,
with the camera following the player and clamped to the scene bounds. Edit mode is unchanged.

## Architecture

- **Model** — `Project` gains optional `viewWidth` / `viewHeight` (no Dexie migration: not indexed).
  A helper module `viewport.ts` owns the defaults, the presets, and `resolveViewport()`.
- **Creation** — the project create dialog offers a preset dropdown; `ProjectService.create`
  persists the choice.
- **Rendering** — `MapCanvasComponent` gets `viewWidth`/`viewHeight` inputs and derives
  `playScale` / `playOffsetX` / `playOffsetY` as **computed** signals; each Play render clips to
  the centered viewport rect and applies the integer scale instead of `zoom`.
- **Camera** — `onWheel` is a no-op in Play; entering Play snaps the camera onto the player, and
  every follow tick clamps it so the viewport never shows outside the scene.
- **Persistence** — archives carry the resolution (optional → old files fall back to default);
  the demo project seeds the default.

## Tech Stack

Angular 22 standalone components, signals (`input`, `computed`, `effect`), Vitest + jsdom,
Dexie, Tailwind (`tw-` prefix). No new dependencies.

## Global Constraints

- All commands run through **devbox**: `devbox run <cmd>`. Filter devbox banner with
  `grep -vE "devbox|Welcome|Node.js|npm version|^$|Running script|v22|10\.9"`.
- Targeted test run: `devbox run npx ng test --watch=false --include='**/<file>.spec.ts'`.
- Lint: `npm run lint`. Format: `npx prettier --write <files>` (check with `npm run format:check`).
- Standalone components only, `ChangeDetectionStrategy.OnPush`, no inline templates,
  JSDoc on every public member and every model property.
- Tailwind classes use the `tw-` prefix; theme tokens only (no raw hex in markup).
- UI copy is **English only**.
- Commit messages are prefixed with the branch name: `feature-107: <summary>`.
- After each task: run the task's spec file(s) (must pass) and commit.

---

## Task 1 — Viewport model module + `Project` fields

**Files:** `src/app/shared/models/viewport.ts` (new), `src/app/shared/models/viewport.spec.ts` (new),
`src/app/shared/models/project.model.ts` (edit).

### 1.1 Write the failing test

Create `src/app/shared/models/viewport.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_VIEW_HEIGHT, DEFAULT_VIEW_WIDTH, VIEW_PRESETS, resolveViewport } from './viewport';

describe('viewport', () => {
  it('defaults to a 16:9 resolution', () => {
    expect(DEFAULT_VIEW_WIDTH).toBe(256);
    expect(DEFAULT_VIEW_HEIGHT).toBe(144);
    expect(DEFAULT_VIEW_WIDTH / DEFAULT_VIEW_HEIGHT).toBeCloseTo(16 / 9, 2);
  });

  it('exposes the four presets in order', () => {
    expect(VIEW_PRESETS.map((p) => [p.width, p.height])).toEqual([
      [256, 144],
      [320, 180],
      [384, 216],
      [256, 224],
    ]);
  });

  it('resolves explicit dimensions', () => {
    expect(resolveViewport({ viewWidth: 320, viewHeight: 180 })).toEqual({ width: 320, height: 180 });
  });

  it('falls back to the default when dimensions are absent', () => {
    expect(resolveViewport({})).toEqual({ width: 256, height: 144 });
  });

  it('falls back to the default for zero or negative dimensions', () => {
    expect(resolveViewport({ viewWidth: 0, viewHeight: -5 })).toEqual({ width: 256, height: 144 });
  });
});
```

### 1.2 Implement the module

Create `src/app/shared/models/viewport.ts`:

```ts
import type { Project } from './project.model';

/**
 * A selectable play-viewport resolution preset.
 */
export interface ViewPreset {
  /** Human-readable label shown in the project creation dialog. */
  label: string;
  /** Viewport width in game pixels. */
  width: number;
  /** Viewport height in game pixels. */
  height: number;
}

/**
 * Default play-viewport width in game pixels (16:9).
 */
export const DEFAULT_VIEW_WIDTH = 256;

/**
 * Default play-viewport height in game pixels (16:9).
 */
export const DEFAULT_VIEW_HEIGHT = 144;

/**
 * Resolution presets offered when creating a project. The first entry is the default.
 */
export const VIEW_PRESETS: readonly ViewPreset[] = [
  { label: '256 × 144 (16:9)', width: 256, height: 144 },
  { label: '320 × 180 (16:9)', width: 320, height: 180 },
  { label: '384 × 216 (16:9)', width: 384, height: 216 },
  { label: '256 × 224 (SNES 4:3)', width: 256, height: 224 },
];

/**
 * Resolves the effective play viewport of a project, falling back to the default
 * 16:9 resolution when the project predates the setting or carries invalid values.
 * @param project - Any object carrying optional `viewWidth` / `viewHeight`.
 * @returns The resolved width and height in game pixels.
 */
export function resolveViewport(
  project: Pick<Project, 'viewWidth' | 'viewHeight'>,
): { width: number; height: number } {
  const width = project.viewWidth && project.viewWidth > 0 ? project.viewWidth : DEFAULT_VIEW_WIDTH;
  const height =
    project.viewHeight && project.viewHeight > 0 ? project.viewHeight : DEFAULT_VIEW_HEIGHT;
  return { width, height };
}
```

### 1.3 Add the fields to `Project`

In `src/app/shared/models/project.model.ts`, add after `mapHeight`:

```ts
  /** Play-viewport width in game pixels (default `256`, see `viewport.ts`). */
  viewWidth?: number;
  /** Play-viewport height in game pixels (default `144`, see `viewport.ts`). */
  viewHeight?: number;
```

### 1.4 Verify

```bash
devbox run npx ng test --watch=false --include='**/viewport.spec.ts'
```

Expected: 5 passing. Commit: `feature-107: add viewport resolution model and presets`.

---

## Task 2 — Persist the viewport on project creation

**Files:** `src/app/features/dashboard/services/project.service.ts`,
`src/app/features/dashboard/services/project.service.spec.ts`.

### 2.1 Failing tests

Add to `project.service.spec.ts` (inside the existing `describe`):

```ts
  it('stores the chosen play viewport resolution', async () => {
    const project = await service.create({
      name: 'P',
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 10,
      mapHeight: 10,
      viewWidth: 320,
      viewHeight: 180,
    });
    expect(project.viewWidth).toBe(320);
    expect(project.viewHeight).toBe(180);
  });

  it('defaults the play viewport when not provided', async () => {
    const project = await service.create({
      name: 'P',
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 10,
      mapHeight: 10,
    });
    expect(project.viewWidth).toBe(256);
    expect(project.viewHeight).toBe(144);
  });
```

(Adapt the constructor/setup to match the existing spec: it uses `TestBed` with an in-memory
`DatabaseService`. Reuse whatever helper the file already has to build the service.)

### 2.2 Implement

In `project.service.ts`:

```ts
import { resolveViewport } from '../../../shared/models/viewport';
```

Extend `CreateProjectDto`:

```ts
  /** Play-viewport width in game pixels (defaults to `256`). */
  viewWidth?: number;
  /** Play-viewport height in game pixels (defaults to `144`). */
  viewHeight?: number;
```

Update `create`:

```ts
  async create(dto: CreateProjectDto): Promise<Project> {
    const now = Date.now();
    const view = resolveViewport(dto);
    const project: Project = {
      id: crypto.randomUUID(),
      ...dto,
      viewWidth: view.width,
      viewHeight: view.height,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.projects.add(project);
    return project;
  }
```

### 2.3 Verify

```bash
devbox run npx ng test --watch=false --include='**/project.service.spec.ts'
```

Commit: `feature-107: persist viewport resolution on project creation`.

---

## Task 3 — Creation dialog preset dropdown

**Files:** `src/app/features/dashboard/project-create-dialog.component.ts` (+ `.html`),
`src/app/features/dashboard/project-create-dialog.component.spec.ts`.

### 3.1 Failing tests

Add to the dialog spec:

```ts
  it('defaults to the 256x144 viewport preset', () => {
    component.open();
    expect(component.selectedView()).toEqual({ label: '256 × 144 (16:9)', width: 256, height: 144 });
  });

  it('passes the selected viewport to the project service on create', async () => {
    component.open();
    component.projectName.set('Game');
    component.selectedViewIndex.set(1); // 320x180
    await component.createProject(new Event('submit'));
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ viewWidth: 320, viewHeight: 180 }),
    );
  });
```

(Reuse the existing spec's service spy; rename to match.)

### 3.2 Implement (component TS)

Add imports: `import { VIEW_PRESETS } from '../../shared/models/viewport';` and
`import type { ViewPreset } from '../../shared/models/viewport';`.

Add fields:

```ts
  /** Viewport presets offered at creation time. */
  readonly viewPresets = VIEW_PRESETS;
  /** Index of the selected viewport preset. */
  readonly selectedViewIndex = signal(0);

  /** The currently selected viewport preset. */
  readonly selectedView = computed<ViewPreset>(() => VIEW_PRESETS[this.selectedViewIndex()]);
```

In `open()` (reset each time the dialog opens): `this.selectedViewIndex.set(0);`

In `createProject`, pass the resolution into the DTO (alongside the existing fields):

```ts
      viewWidth: this.selectedView().width,
      viewHeight: this.selectedView().height,
```

### 3.3 Implement (template)

In `project-create-dialog.component.html`, add a fieldset between the Tile Size fieldset and the
Palette fieldset:

```html
      <label class="tw-flex tw-flex-col tw-gap-1">
        <span class="tw-text-sm tw-font-medium">Play Resolution</span>
        <select
          [value]="selectedViewIndex()"
          (change)="selectedViewIndex.set(+$any($event.target).value)"
          class="tw-px-3 tw-py-2 tw-rounded-sm tw-border tw-border-input tw-bg-background tw-text-foreground"
        >
          @for (preset of viewPresets; track preset.label; let i = $index) {
            <option [value]="i" [selected]="i === selectedViewIndex()">{{ preset.label }}</option>
          }
        </select>
      </label>
```

### 3.3 Verify

```bash
devbox run npx ng test --watch=false --include='**/project-create-dialog.component.spec.ts'
```

Commit: `feature-107: pick the play viewport resolution when creating a project`.

---

## Task 4 — Archive, import/export, and demo project

**Files:** `src/app/shared/models/project-archive.model.ts`,
`src/app/core/services/project-io.service.ts` (+ `.spec.ts`),
`src/app/core/services/demo-project.service.ts` (+ `.spec.ts` if present).

### 4.1 Failing tests

In `project-io.service.spec.ts` add:

```ts
  it('round-trips the viewport resolution through export and import', async () => {
    // create a project with viewWidth/viewHeight, export, import into a new project
    // and assert the imported project keeps 320x180.
  });

  it('imports an archive without viewport fields using the defaults', async () => {
    // build an archive object, delete project.viewWidth/viewHeight, import,
    // assert the stored project has viewWidth 256 and viewHeight 144.
  });
```

(Fill them using the file's existing fixtures/helpers.)

### 4.2 Model

In `ProjectArchiveProjectData` add:

```ts
  /**
   * Play-viewport width in game pixels. Absent in archives created before this
   * feature; the importer falls back to the default when missing.
   */
  viewWidth?: number;
  /**
   * Play-viewport height in game pixels. Absent in archives created before this
   * feature; the importer falls back to the default when missing.
   */
  viewHeight?: number;
```

### 4.3 Export & import

In `exportProject`, extend the `project` literal:

```ts
      project: {
        name: project.name,
        palette: [...project.palette],
        tileSize: project.tileSize,
        mapWidth: project.mapWidth,
        mapHeight: project.mapHeight,
        ...resolveViewport(project),
      },
```

(Export always writes concrete values.)

In `importProject`, compute once and store on the row:

```ts
    const view = resolveViewport(archive.project);
    const projectRow = {
      id: projectId,
      name: archive.project.name,
      createdAt: now,
      updatedAt: now,
      palette: [...archive.project.palette],
      tileSize: archive.project.tileSize,
      mapWidth: archive.project.mapWidth,
      mapHeight: archive.project.mapHeight,
      viewWidth: view.width,
      viewHeight: view.height,
    };
```

Import `resolveViewport` from `../../shared/models/viewport`.

### 4.4 Validation

In `validate`, after the existing `archive.project` shape checks (they stay as-is — the viewport
is optional), add:

```ts
    if (
      (p.viewWidth !== undefined && (typeof p.viewWidth !== 'number' || p.viewWidth <= 0)) ||
      (p.viewHeight !== undefined && (typeof p.viewHeight !== 'number' || p.viewHeight <= 0))
    ) {
      throw new ProjectImportError('This file has an invalid viewport resolution.');
    }
```

### 4.5 Demo project

In `demo-project.service.ts`, import the defaults and add them to the seeded project:

```ts
import { DEFAULT_VIEW_HEIGHT, DEFAULT_VIEW_WIDTH } from '../../shared/models/viewport';
```

```ts
          mapWidth: DEMO_WIDTH,
          mapHeight: DEMO_HEIGHT,
          viewWidth: DEFAULT_VIEW_WIDTH,
          viewHeight: DEFAULT_VIEW_HEIGHT,
```

Update any demo spec that asserts on the project row.

### 4.6 Verify

```bash
devbox run npx ng test --watch=false --include='**/project-io.service.spec.ts'
devbox run npx ng test --watch=false --include='**/demo-project.service.spec.ts'
```

Commit: `feature-107: carry the viewport resolution in project archives`.

---

## Task 5 — Play view: integer scale, centered letterbox, no zoom, clamped camera

**Files:** `src/app/features/scene-editor/map-canvas.component.ts` (+ `.spec.ts`).

### 5.1 Failing tests

Add to `map-canvas.component.spec.ts`:

```ts
  it('ignores wheel zoom in play mode', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    fixture.componentRef.setInput('playMode', true);
    const before = instance.zoom();
    instance.onWheel(new WheelEvent('wheel', { deltaY: -100 }));
    expect(instance.zoom()).toBe(before);
  });

  it('still zooms with the wheel in edit mode', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    const before = instance.zoom();
    instance.onWheel(new WheelEvent('wheel', { deltaY: -100 }));
    expect(instance.zoom()).toBeGreaterThan(before);
  });

  it('exposes an integer play scale and centered offsets', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    instance.viewportWidth.set(800);
    instance.viewportHeight.set(600);
    fixture.componentRef.setInput('viewWidth', 256);
    fixture.componentRef.setInput('viewHeight', 144);
    fixture.componentRef.setInput('playMode', true);
    // floor(min(800/256, 600/144)) = floor(min(3.125, 4.16)) = 3
    expect(instance.playScale()).toBe(3);
    expect(instance.playOffsetX()).toBe(Math.floor((800 - 256 * 3) / 2)); // 16
    expect(instance.playOffsetY()).toBe(Math.floor((600 - 144 * 3) / 2)); // 84
  });

  it('keeps the play scale at 1 in edit mode', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    expect(instance.playScale()).toBe(1);
    expect(instance.playOffsetX()).toBe(0);
  });

  it('clamps the play camera so the viewport stays inside the scene', () => {
    setup(makeScene()); // 4x4 scene, tileSize 16 -> 64x64 px
    const instance = fixture.componentInstance;
    instance.viewportWidth.set(64);
    instance.viewportHeight.set(64);
    fixture.componentRef.setInput('tileSize', 16);
    fixture.componentRef.setInput('viewWidth', 16);
    fixture.componentRef.setInput('viewHeight', 16);
    const player = fixture.debugElement.injector.get(PlayerController);
    player.start({ width: 4, height: 4, layers: [] }, { x: 0, y: 0 }, new Map(), {}, new Map());
    fixture.componentRef.setInput('playMode', true);
    instance['followPlayer']();
    instance['snapCameraToPlayer']();
    // camera must not reveal anything left/above the scene origin
    const left = (instance.playOffsetX() - instance.cameraX()) / instance.playScale();
    expect(left).toBeGreaterThanOrEqual(-0.001);
  });
```

(Adjust `makeScene()`/`setup()` usage to the existing helpers; the file already imports
`PlayerController` and builds a 4×4 scene.)

### 5.2 Inputs and computeds

Add to the imports: `computed`, and
`import { DEFAULT_VIEW_HEIGHT, DEFAULT_VIEW_WIDTH } from '../../shared/models/viewport';`.

After `playMode` input:

```ts
  /** Play-mode viewport width in game pixels (ignored in edit mode). */
  viewWidth = input(DEFAULT_VIEW_WIDTH);
  /** Play-mode viewport height in game pixels (ignored in edit mode). */
  viewHeight = input(DEFAULT_VIEW_HEIGHT);
```

After the `viewportHeight` signal:

```ts
  /**
   * Integer scale applied to the fixed Play viewport so it fits the canvas while
   * preserving its aspect ratio. Always `1` in edit mode.
   */
  readonly playScale = computed(() => {
    if (!this.playMode()) return 1;
    const vw = Math.max(1, this.viewWidth());
    const vh = Math.max(1, this.viewHeight());
    const cw = this.viewportWidth();
    const ch = this.viewportHeight();
    return Math.max(1, Math.floor(Math.min(cw / vw, ch / vh)));
  });

  /** Horizontal offset in device pixels of the centered Play viewport rect (`0` in edit mode). */
  readonly playOffsetX = computed(() =>
    this.playMode()
      ? Math.floor((this.viewportWidth() - this.viewWidth() * this.playScale()) / 2)
      : 0,
  );

  /** Vertical offset in device pixels of the centered Play viewport rect (`0` in edit mode). */
  readonly playOffsetY = computed(() =>
    this.playMode()
      ? Math.floor((this.viewportHeight() - this.viewHeight() * this.playScale()) / 2)
      : 0,
  );
```

### 5.3 Toggle the wheel guard

At the top of `onWheel`, right after `event.preventDefault();`:

```ts
    if (this.playMode()) return;
```

### 5.4 Clip + scale in `render`

Replace (in `render`):

```ts
    ctx.save();
    ctx.translate(this.cameraX(), this.cameraY());
    ctx.scale(this.zoom(), this.zoom());
```

with:

```ts
    ctx.save();
    if (this.playMode()) {
      const scale = this.playScale();
      const destX = this.playOffsetX();
      const destY = this.playOffsetY();
      ctx.beginPath();
      ctx.rect(destX, destY, this.viewWidth() * scale, this.viewHeight() * scale);
      ctx.clip();
      ctx.translate(this.cameraX(), this.cameraY());
      ctx.scale(scale, scale);
    } else {
      ctx.translate(this.cameraX(), this.cameraY());
      ctx.scale(this.zoom(), this.zoom());
    }
```

The single `ctx.restore()` at the end of `render` still closes the block.

### 5.5 Camera: snap + clamp

Update `followPlayer` to use the effective scale and clamp in Play:

```ts
  private followPlayer(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    const cell = this.tileSize();
    const px = this.player.x() * cell;
    const py = this.player.y() * cell;
    const z = this.playMode() ? this.playScale() : this.zoom();
    const targetX = -(px * z) + canvas.width / 2;
    const targetY = -(py * z) + canvas.height / 2;

    const k = 0.1; // keep the existing damping constant from the current code
    this.cameraX.update((v) => v + (targetX - v) * k);
    this.cameraY.update((v) => v + (targetY - v) * k);

    if (this.playMode()) this.clampPlayCamera();
  }

  /**
   * @internal Snaps the camera so the player sits at the viewport center, then
   * clamps. Used on the first Play frame so the run does not start with a pan.
   */
  private snapCameraToPlayer(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const cell = this.tileSize();
    const z = this.playScale();
    this.cameraX.set(-(this.player.x() * cell * z) + canvas.width / 2);
    this.cameraY.set(-(this.player.y() * cell * z) + canvas.height / 2);
    this.clampPlayCamera();
  }

  /**
   * @internal Clamps the Play camera so the fixed viewport never shows outside
   * the scene; axes where the scene is smaller than the viewport are centered.
   */
  private clampPlayCamera(): void {
    const scene = this.scene();
    if (!scene) return;
    const tile = this.tileSize();
    const scale = this.playScale();
    const viewW = this.viewWidth();
    const viewH = this.viewHeight();
    const destX = this.playOffsetX();
    const destY = this.playOffsetY();
    const sceneW = scene.width * tile;
    const sceneH = scene.height * tile;

    let left = (destX - this.cameraX()) / scale;
    let top = (destY - this.cameraY()) / scale;
    left =
      sceneW >= viewW ? Math.min(Math.max(left, 0), sceneW - viewW) : (sceneW - viewW) / 2;
    top = sceneH >= viewH ? Math.min(Math.max(top, 0), sceneH - viewH) : (sceneH - viewH) / 2;

    this.cameraX.set(destX - left * scale);
    this.cameraY.set(destY - top * scale);
  }
```

Add a snap-on-play effect (fields area, injection context):

```ts
  /** @internal Snaps the Play camera onto the player when Play mode begins. */
  private readonly snapOnPlayEffect = effect(() => {
    if (this.playMode()) this.snapCameraToPlayer();
  });
```

> If Angular rejects the signal write inside `effect()` on this version, fall back to snapping
> when `lastPlayTime === 0` at the top of `tick` (reset `lastPlayTime = 0` in the Play→false
> transition) and delete the effect. Run the tests to decide.

### 5.6 Verify

```bash
devbox run npx ng test --watch=false --include='**/map-canvas.component.spec.ts'
```

Commit: `feature-107: render the play view at a fixed integer-scaled resolution`.

---

## Task 6 — Scene editor: pass the viewport, status bar, minimap

**Files:** `src/app/features/scene-editor/scene-editor.component.ts` (+ `.html`, `.spec.ts`).

### 6.1 Failing tests

Add to `scene-editor.component.spec.ts` (reuse the file's existing project fixture; ensure the
project has `viewWidth: 320, viewHeight: 180`):

```ts
  it('passes the project viewport resolution to the map canvas', async () => {
    // after load, query rk-map-canvas debug element
    const canvas = fixture.debugElement.query(By.directive(MapCanvasComponent)).componentInstance;
    expect(canvas.viewWidth()).toBe(320);
    expect(canvas.viewHeight()).toBe(180);
  });

  it('shows the view resolution in the status bar during play', async () => {
    component.playMode.set(true);
    await fixture.whenStable();
    expect(statusBar.setContext).toHaveBeenCalledWith(expect.stringContaining('View 320×180'));
  });
```

### 6.2 Component

Import: `import { resolveViewport, DEFAULT_VIEW_WIDTH, DEFAULT_VIEW_HEIGHT } from '../../shared/models/viewport';`.

Add signals near `projectTileSize`:

```ts
  /** Play-viewport width in game pixels of the current project. */
  projectViewWidth = signal(DEFAULT_VIEW_WIDTH);
  /** Play-viewport height in game pixels of the current project. */
  projectViewHeight = signal(DEFAULT_VIEW_HEIGHT);
```

Set them in `loadProjectData` (inside the `if (project)` block):

```ts
        const view = resolveViewport(project);
        this.projectViewWidth.set(view.width);
        this.projectViewHeight.set(view.height);
```

Add minimap computeds (after `activeLayer` or near the other computeds):

```ts
  /** Viewport width fed to the minimap, adjusted for the scaled Play view. */
  readonly minimapViewportWidth = computed(() => {
    const canvas = this.mapCanvasRef();
    if (!canvas) return 0;
    return this.playMode()
      ? this.projectViewWidth() * canvas.playScale()
      : canvas.viewportWidth();
  });

  /** Viewport height fed to the minimap, adjusted for the scaled Play view. */
  readonly minimapViewportHeight = computed(() => {
    const canvas = this.mapCanvasRef();
    if (!canvas) return 0;
    return this.playMode()
      ? this.projectViewHeight() * canvas.playScale()
      : canvas.viewportHeight();
  });

  /** Camera X fed to the minimap, offset by the Play letterbox. */
  readonly minimapCameraX = computed(() => {
    const canvas = this.mapCanvasRef();
    if (!canvas) return 0;
    return this.playMode() ? canvas.cameraX() - canvas.playOffsetX() : canvas.cameraX();
  });

  /** Camera Y fed to the minimap, offset by the Play letterbox. */
  readonly minimapCameraY = computed(() => {
    const canvas = this.mapCanvasRef();
    if (!canvas) return 0;
    return this.playMode() ? canvas.cameraY() - canvas.playOffsetY() : canvas.cameraY();
  });

  /** Zoom fed to the minimap (the Play integer scale while playing). */
  readonly minimapZoom = computed(() => {
    const canvas = this.mapCanvasRef();
    if (!canvas) return 1;
    return this.playMode() ? canvas.playScale() : canvas.zoom();
  });
```

In `statusBarEffect`, replace the zoom part with a Play-aware segment:

```ts
    const zoomPart = this.playMode()
      ? `View ${this.projectViewWidth()}×${this.projectViewHeight()}`
      : `Zoom: ${zoom}%`;
```

and use `zoomPart` in the `parts` array instead of the `` `Zoom: ${zoom}%` `` entry, and drop
`Cam: …` while playing:

```ts
    const parts = [scene.name, `${scene.width}×${scene.height}`, layerName];
    if (!this.playMode()) parts.push(`Cam: ${x},${y}`);
    parts.push(zoomPart, `${layerCount} layer${layerCount === 1 ? '' : 's'}`);
    parts.push(`${tileCount} tile${tileCount === 1 ? '' : 's'}`);
    if (cursorStr) parts.push(cursorStr);
    this.statusBar.setContext(parts.join(' | '));
```

### 6.3 Template

On `<rk-map-canvas>` add:

```html
      [viewWidth]="projectViewWidth()"
      [viewHeight]="projectViewHeight()"
```

On `<rk-scene-minimap>` replace the four viewport/camera bindings and zoom:

```html
        [viewportWidth]="minimapViewportWidth()"
        [viewportHeight]="minimapViewportHeight()"
        [cameraX]="minimapCameraX()"
        [cameraY]="minimapCameraY()"
        [zoom]="minimapZoom()"
```

### 6.4 Verify

```bash
devbox run npx ng test --watch=false --include='**/scene-editor.component.spec.ts'
```

Commit: `feature-107: drive the play viewport from the project scene editor`.

---

## Final verification

```bash
devbox run npm run test        # full suite green
devbox run npm run lint        # clean
devbox run npm run format:check
devbox run npm run build
```

Fix formatting with `npx prettier --write <files>` as needed.

## Ship

1. Push `feature-107` and open a PR to `develop` titled
   `Play mode: fixed viewport resolution (#107)` with body `Closes #107`.
2. Wait for the `check` CI job; merge with a **merge commit** (`gh pr merge <n> --merge`).
3. Move kanban #107 to **Done**, fast-forward local `develop`.
4. Write the wake-up report and leave it in the repo (and print it).

## Self-review notes

- `viewWidth`/`viewHeight` are non-indexed → no Dexie version bump; existing projects read `undefined`.
- `playScale` is a `computed` (no writes during render) so it is safe to read from `render()`,
  which is invoked inside effects.
- The `snapCameraToPlayer` + effect fallback is called out explicitly because signal writes in
  `effect()` vary by Angular version.
- Out of scope: a project settings screen (#19) and a true fullscreen game mode (A5).
