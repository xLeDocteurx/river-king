# Remove Camera Position Save/Restore — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all camera state persistence (cameraX, cameraY, cameraZoom) from the Session model and the save/restore flow; center the camera on the grid each time a scene loads.

**Architecture:** Strip three camera fields from the Session model, delete the debounced persist writes in MapCanvasComponent, remove the restoreCamera/initialCameraX/Y input pipeline from SceneEditorComponent → MapCanvasComponent, and add a `centerOnGrid()` method that fires once when a scene first loads.

**Tech Stack:** Angular 22 (standalone components, signals), Dexie/IndexedDB, Vitest + jsdom

## Global Constraints

- Prefix all Tailwind classes with `tw-` — standard classes like `bg-red-500` won't work
- Standalone components only — no NgModule; use `imports: [...]` in `@Component()`
- `ChangeDetectionStrategy.OnPush` required for shared components
- Use `input()`, `output()`, `model()`, signals — no RxJS Subject for component state
- Never inline templates — separate `.html` and `.scss` files
- Tests via Vitest (`ng test`); jsdom environment; no real browser
- `core/` must not import from `shared/` or `features/`
- Material Symbols only (`<span class="material-symbols">icon_name</span>`)

---

## File Map

| File                                                           | Change                                                                                                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/shared/models/session.model.ts`                       | Remove `cameraX`, `cameraY`, `cameraZoom` from `Session` interface and `createEmptySession()`                                                                            |
| `src/app/features/scene-editor/map-canvas.component.ts`        | Remove 3 inputs, 2 effects, `scheduleCameraPersist()`, `cameraRestored` flag, `SessionService` injection; add `centerOnGrid()` + one-shot effect                         |
| `src/app/features/scene-editor/map-canvas.component.html`      | No change expected (no camera-specific template bindings in the canvas template)                                                                                         |
| `src/app/features/scene-editor/scene-editor.component.ts`      | Remove 3 signals (`restoreCamera`, `initialCameraX`, `initialCameraY`), `restoreSession()`, camera reads from `selectScene()`, `restoreSession()` call from `ngOnInit()` |
| `src/app/features/scene-editor/scene-editor.component.html`    | Remove `[restoreCamera]`, `[initialCameraX]`, `[initialCameraY]` bindings                                                                                                |
| `src/app/core/services/session.service.spec.ts`                | Remove camera fields from test data and assertions                                                                                                                       |
| `src/app/features/scene-editor/map-canvas.component.spec.ts`   | Remove 3 camera tests, add `centerOnGrid` test                                                                                                                           |
| `src/app/features/scene-editor/scene-editor.component.spec.ts` | Remove 3 session-restore/camera tests                                                                                                                                    |

---

### Task 1: Remove camera fields from Session model

**Files:**

- Modify: `src/app/shared/models/session.model.ts:5-39`

**Interfaces:**

- Consumes: none (first task)
- Produces: `Session` interface (no camera fields), `createEmptySession()` (no camera fields)

- [ ] **Step 1: Remove camera fields from `Session` interface**

```typescript
// src/app/shared/models/session.model.ts
/** Persisted per-project UI session: last screen, element, and camera. */
export interface Session {
  /** Owning project id (primary key). */
  projectId: string;
  /** Workspace screen the user was last on. */
  lastScreen: ProjectScreen;
  /** Scene selected when the user left the scenes screen (null if none). */
  lastSceneId: string | null;
  /** Tile selected when the user left the tiles screen (null if none). */
  lastTileId: number | null;
  /** Sprite selected when the user left the sprites screen (null if none). */
  lastSpriteId: number | null;
}
```

- [ ] **Step 2: Remove camera fields from `createEmptySession()`**

```typescript
/**
 * Builds a default session for a project.
 * @param projectId - Id of the owning project.
 * @returns A fresh session pointing at the scenes screen.
 */
export function createEmptySession(projectId: string): Session {
  return {
    projectId,
    lastScreen: 'scenes',
    lastSceneId: null,
    lastTileId: null,
    lastSpriteId: null,
  };
}
```

- [ ] **Step 3: Update SessionService spec — remove camera fields from test data**

In `src/app/core/services/session.service.spec.ts`:

**Test "should get session for project" (line 25-36):** Remove `cameraX: 100, cameraY: 200, cameraZoom: 2` from the session literal. Remove `expect(session?.cameraZoom).toBe(2)`.

**Test "should save session for project" (line 38-48):** Remove `cameraX: 50, cameraY: 75, cameraZoom: 1.5` from the session literal. Remove `expect(result?.cameraX).toBe(50)`.

**Test "should update session partially" (line 50-56):** Change the update from `{ cameraX: 999 }` to `{ lastScreen: 'tiles' }`. Change the assertion to check `lastScreen` instead of camera fields:

```typescript
it('should update session partially', async () => {
  await service.saveSession(createEmptySession('proj-3'));
  await service.updateSession('proj-3', { lastScreen: 'tiles' });
  const result = await db.sessions.get('proj-3');
  expect(result?.lastScreen).toBe('tiles');
  expect(result?.lastTileId).toBeNull(); // unchanged
});
```

**Test "should create a defaulted session when updating a missing one" (line 63-76):** Remove `cameraX: 0, cameraY: 0, cameraZoom: 1` from the expected object:

```typescript
it('should create a defaulted session when updating a missing one', async () => {
  await service.updateSession('proj-new', { lastScreen: 'tiles', lastTileId: 7 });
  const result = await db.sessions.get('proj-new');
  expect(result).toEqual({
    projectId: 'proj-new',
    lastScreen: 'tiles',
    lastSceneId: null,
    lastTileId: 7,
    lastSpriteId: null,
  });
});
```

**Test "should backfill missing fields when updating a legacy session row" (line 78-92):** Remove `cameraX: 12, cameraY: 34, cameraZoom: 2` from the raw session literal. Remove the `expect(result?.cameraZoom).toBe(2)` assertion. Add `lastScreen: 'scenes'` to the literal since the test is about backfilling:

```typescript
it('should backfill missing fields when updating a legacy session row', async () => {
  await db.sessions.add({
    projectId: 'proj-legacy',
    lastScreen: 'scenes',
    lastSceneId: 'scene-9',
  } as Session);
  await service.updateSession('proj-legacy', { lastSpriteId: 5 });
  const result = await db.sessions.get('proj-legacy');
  expect(result?.lastScreen).toBe('scenes');
  expect(result?.lastSpriteId).toBe(5);
  expect(result?.lastSceneId).toBe('scene-9');
});
```

- [ ] **Step 4: Run session service tests to verify they pass**

Run: `devbox run npm run test -- --reporter=verbose -- src/app/core/services/session.service.spec.ts`
Expected: All 6 session service tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/models/session.model.ts src/app/core/services/session.service.spec.ts
git commit -m "remove cameraX/cameraY/cameraZoom from Session model"
```

---

### Task 2: Remove camera persist from MapCanvasComponent

**Files:**

- Modify: `src/app/features/scene-editor/map-canvas.component.ts`

**Interfaces:**

- Consumes: `Session` model (already updated, no camera fields)
- Produces: `MapCanvasComponent` without camera persist or restore inputs

- [ ] **Step 1: Remove `SessionService` import and injection**

Remove line 18:

```typescript
import { SessionService } from '../../core/services/session.service';
```

Remove line 111-112:

```typescript
  /** Persists camera state so a project reopens where the user left it. */
  private readonly sessions = inject(SessionService);
```

Also remove `inject` from the `@angular/core` import if no longer needed (check: `viewChild`, `signal`, `effect`, `input`, `output` are still used — but `inject` is only used for `SessionService`; however it's used elsewhere — actually no, `inject` is only used once at line 112). Let me check the full import list.

Looking at the imports: `Component, inject, input, output, viewChild, signal, effect, ChangeDetectionStrategy, AfterViewInit, OnDestroy, ElementRef`. Remove `inject` from the import since `SessionService` was its only use.

- [ ] **Step 2: Remove camera restore inputs**

Remove lines 50-63:

```typescript
/** Camera state to restore once at startup (from the persisted session). */
restoreCamera = input<{ x: number; y: number; zoom: number } | null>(null);
initialCameraX = input(0);
initialCameraY = input(0);
```

- [ ] **Step 3: Remove `cameraRestored` flag and `cameraPersistTimer`**

Remove line 98-99:

```typescript
  private cameraPersistTimer: ReturnType<typeof setTimeout> | null = null;
```

Remove line 100-101:

```typescript
  private cameraRestored = false;
```

- [ ] **Step 4: Remove camera restore effects**

Remove lines 136-158 (both effects):

```typescript
  /** Snap camera position when the parent signals a scene switch. */
  effect(() => { ... });

  /** Restore the full camera state (position + zoom) from the persisted session once. */
  effect(() => { ... });
```

- [ ] **Step 5: Add `centerOnGrid()` method and one-shot effect**

Add to the constructor (after the existing effects):

```typescript
/** Center the camera on the grid once when the scene first loads. */
effect(() => {
  const scene = this.scene();
  if (!scene) return;
  // Run once per scene load — if cameraX and cameraY are already set (from
  // a previous scene), we want to re-center. Use a simple flag approach:
  // read the canvas size, compute center offset, and let the user pan from there.
  queueMicrotask(() => this.centerOnGrid());
});
```

Add the `centerOnGrid()` method:

```typescript
  /**
   * Centers the camera so the grid is fully visible in the viewport.
   * Called once on scene load.
   */
  private centerOnGrid(): void {
    const scene = this.scene();
    const canvas = this.canvasRef()?.nativeElement;
    if (!scene || !canvas) return;
    const ts = this.tileSize();
    const gridW = scene.width * ts;
    const gridH = scene.height * ts;
    const vpW = canvas.width;
    const vpH = canvas.height;
    this.cameraX.set((vpW - gridW) / 2);
    this.cameraY.set((vpH - gridH) / 2);
    this.zoom.set(1);
    this.render();
  }
```

- [ ] **Step 6: Remove `scheduleCameraPersist()` method**

Remove lines 497-515:

```typescript
  private scheduleCameraPersist(): void { ... }
```

- [ ] **Step 7: Remove all `scheduleCameraPersist()` call sites**

Three call sites to remove:

- Line 428 in `onMouseMove`: remove `this.scheduleCameraPersist();`
- Line 478 in `onWheel`: remove `this.scheduleCameraPersist();`
- Line 493 in `centerOn`: remove `this.scheduleCameraPersist();`

- [ ] **Step 8: Run MapCanvasComponent tests**

Run: `devbox run npm run test -- --reporter=verbose -- src/app/features/scene-editor/map-canvas.component.spec.ts`
Expected: Tests for `restoreCamera` and `initialCameraX/Y` should now fail (inputs removed). The `scheduleCameraPersist` test should also fail. This is expected — we fix them in Task 4.

- [ ] **Step 9: Commit**

```bash
git add src/app/features/scene-editor/map-canvas.component.ts
git commit -m "remove camera persist and restore from MapCanvasComponent"
```

---

### Task 3: Remove camera restore from SceneEditorComponent

**Files:**

- Modify: `src/app/features/scene-editor/scene-editor.component.ts`
- Modify: `src/app/features/scene-editor/scene-editor.component.html`

**Interfaces:**

- Consumes: `MapCanvasComponent` (no longer has camera inputs)
- Produces: `SceneEditorComponent` without camera signals or `restoreSession()`

- [ ] **Step 1: Remove camera signals**

Remove lines 90-101:

```typescript
restoreCamera = signal<{ x: number; y: number; zoom: number } | null>(null);
initialCameraX = signal(0);
initialCameraY = signal(0);
```

- [ ] **Step 2: Remove `restoreSession()` method**

Remove lines 145-162 (the entire `restoreSession()` method).

- [ ] **Step 3: Remove camera reads from `selectScene()`**

In `selectScene()` (lines 237-256), remove lines 246-248:

```typescript
const stored = await this.sessions.getSession(this.projectId()).catch(() => undefined);
this.initialCameraX.set(stored?.cameraX ?? 0);
this.initialCameraY.set(stored?.cameraY ?? 0);
```

- [ ] **Step 4: Remove `restoreSession()` call from `ngOnInit()`**

Change lines 137-139 from:

```typescript
this.loadScenes()
  .then(() => this.restoreSession())
  .catch(() => undefined);
```

to:

```typescript
this.loadScenes()
  .then(() => this.restoreLastScene())
  .catch(() => undefined);
```

Add a new `restoreLastScene()` method that handles just the scene-selection part (without camera restore):

```typescript
  /**
   * Restores the last selected scene from the persisted session (without
   * camera restore — camera now centers on grid by default).
   */
  async restoreLastScene(): Promise<void> {
    const stored = await this.sessions.getSession(this.projectId()).catch(() => undefined);
    const urlSceneId = this.route.snapshot.paramMap.get('sceneId');
    let target = urlSceneId ?? undefined;
    if (!target && stored?.lastSceneId) target = stored.lastSceneId;
    if (target && !this.scenes().some((s) => s.id === target)) target = undefined;
    if (target) await this.selectScene(target);
  }
```

- [ ] **Step 5: Remove camera bindings from template**

In `scene-editor.component.html`, remove lines 22-24:

```html
[restoreCamera]="restoreCamera()" [initialCameraX]="initialCameraX()"
[initialCameraY]="initialCameraY()"
```

- [ ] **Step 6: Remove `SessionService` import if no longer needed**

Check: `this.sessions` is still used in `restoreLastScene()` and `selectScene()` (for `updateSession` with `lastScreen`/`lastSceneId`). Keep the import.

- [ ] **Step 7: Run SceneEditorComponent tests**

Run: `devbox run npm run test -- --reporter=verbose -- src/app/features/scene-editor/scene-editor.component.spec.ts`
Expected: Tests for `restoreSession()` and camera round-trip will fail (removed). Other tests should pass. Fix in Task 4.

- [ ] **Step 8: Commit**

```bash
git add src/app/features/scene-editor/scene-editor.component.ts src/app/features/scene-editor/scene-editor.component.html
git commit -m "remove camera restore from SceneEditorComponent"
```

---

### Task 4: Update all tests

**Files:**

- Modify: `src/app/features/scene-editor/map-canvas.component.spec.ts`
- Modify: `src/app/features/scene-editor/scene-editor.component.spec.ts`

**Interfaces:**

- Consumes: Tasks 1-3 (all implementation changes)
- Produces: Passing test suite

- [ ] **Step 1: Update MapCanvasComponent tests**

Remove these tests from `map-canvas.component.spec.ts`:

**Test "applies the restoreCamera input once at startup" (lines 100-114):** Delete entirely — `restoreCamera` input no longer exists.

**Test "persists the debounced camera state while panning" (lines 116-136):** Delete entirely — `scheduleCameraPersist` and `SessionService` injection removed.

**Test "snaps camera to initialCameraX/Y inputs when they change" (lines 167-180):** Delete entirely — `initialCameraX`/`initialCameraY` inputs no longer exist.

Add a new test for `centerOnGrid`:

```typescript
it('centers the camera on the grid when a scene is loaded', () => {
  setup(makeScene(10, 8));
  const instance = fixture.componentInstance;
  // Default tileSize is 16, canvas is 0x0 in jsdom so center is (0, 0)
  // The method sets cameraX = (vpW - gridW) / 2, cameraY = (vpH - gridH) / 2
  // With jsdom: vpW=0, vpH=0, gridW=10*16=160, gridH=8*16=128
  expect(instance.cameraX()).toBe(-80); // (0 - 160) / 2
  expect(instance.cameraY()).toBe(-64); // (0 - 128) / 2
  expect(instance.zoom()).toBe(1);
});
```

Also remove the `SessionService` import at the top of the spec file (line 4).

- [ ] **Step 2: Run MapCanvasComponent tests**

Run: `devbox run npm run test -- --reporter=verbose -- src/app/features/scene-editor/map-canvas.component.spec.ts`
Expected: All remaining tests pass (placement, footprint, image smoothing, hover preview, clear preview, centerOnGrid).

- [ ] **Step 3: Update SceneEditorComponent tests**

Remove these tests from `scene-editor.component.spec.ts`:

**Test "prefers the scene from the URL over the stored session when restoring" (lines 173-189):** This test calls `component.restoreSession()` which no longer exists. Rewrite to use `restoreLastScene()`:

```typescript
it('prefers the scene from the URL over the stored session when restoring', async () => {
  fixture.detectChanges();
  await fixture.whenStable();

  const fromUrl = await sceneService.createScene('p1', 'FromUrl', 10, 10);
  const fromSession = await sceneService.createScene('p1', 'FromSession', 10, 10);
  await component.loadScenes();
  await TestBed.inject(SessionService).updateSession('p1', {
    lastScreen: 'scenes',
    lastSceneId: fromSession.id,
  });
  paramSceneId = fromUrl.id;

  await component.restoreLastScene();

  expect(component.selectedSceneId()).toBe(fromUrl.id);
});
```

**Test "restores the stored scene and camera state" (lines 227-255):** Delete entirely — `restoreSession()` and `restoreCamera` signal no longer exist.

**Test "keeps defaults when no session exists" (lines 257-265):** Rewrite to test `restoreLastScene()`:

```typescript
it('keeps defaults when no session exists', async () => {
  const sessions = TestBed.inject(SessionService);
  vi.spyOn(sessions, 'getSession').mockResolvedValue(undefined);

  await component.restoreLastScene();

  expect(component.selectedSceneId()).toBeNull();
});
```

**Test "restores camera position from session and saves back after panning" (lines 284-353):** Delete entirely — camera persistence and `initialCameraX/Y` removed.

- [ ] **Step 4: Run SceneEditorComponent tests**

Run: `devbox run npm run test -- --reporter=verbose -- src/app/features/scene-editor/scene-editor.component.spec.ts`
Expected: All remaining tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/map-canvas.component.spec.ts src/app/features/scene-editor/scene-editor.component.spec.ts
git commit -m "update tests for camera persist removal"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `devbox run npm run test`
Expected: All tests pass across the entire project.

- [ ] **Step 2: Run the build**

Run: `devbox run npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run lint**

Run: `devbox run npm run lint`
Expected: No lint errors.

- [ ] **Step 4: Manual verification (optional)**

Load a scene in the dev server — the camera should be centered on the grid. Pan and zoom should work normally. Switching scenes should re-center.
