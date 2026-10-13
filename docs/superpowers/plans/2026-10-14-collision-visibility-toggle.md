# Collision / Footprint Visibility Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scene-editor toolbar toggle that overlays a translucent red marker on every blocking tile's full directional footprint, persisted for the browser session.

**Architecture:** Mirrors the existing grid-visibility toggle. `MapCanvasComponent` gains a `blockingById` input plus a `showCollision` signal (session-persisted) and a conditional render pass; `SceneEditorComponent` derives `blockingById` from its tiles (reused by `enterPlay`) and exposes a fourth toolbar button that flips the canvas signal.

**Tech Stack:** Angular 22 (standalone, signals, OnPush), TypeScript, Vitest + jsdom, Tailwind (`tw-` prefix), Material Symbols.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-14-collision-visibility-toggle-design.md` (Approved).
- UI copy is English only.
- Token-bound classes only; no hardcoded hex/rgb in templates.
- Never inline templates: edit the existing `.html` files.
- Every public method needs a JSDoc block; every new signal/input is documented.
- Tailwind prefix `tw-` is mandatory.
- Marker color: `--destructive` token, `globalAlpha` 0.3, no stroke, full footprint.
- Session storage key: `rk-scene-editor.show-collision`, default OFF.
- Overlay is edit-mode only (`!playMode()`) and only for `layer.visible === true`.

---

### Task 1: Canvas collision overlay (`MapCanvasComponent`)

**Files:**
- Modify: `src/app/features/scene-editor/map-canvas.component.ts`
- Test: `src/app/features/scene-editor/map-canvas.component.spec.ts`

**Interfaces:**
- Consumes: `footprintRect(x, y, tileId, footprints)` and `cssTokenColor(element, token, fallback)` (already imported).
- Produces: `export const COLLISION_VISIBLE_STORAGE_KEY`; input `blockingById = input<Map<number, boolean>>(new Map())`; signal `showCollision = signal(...)` (public, writable); method `drawCollisionOverlay(cell: number): void`.

- [ ] **Step 1: Write the failing tests**

In `map-canvas.component.spec.ts`, update the import on line 2 to include the new key:

```ts
import { MapCanvasComponent, GRID_VISIBLE_STORAGE_KEY, COLLISION_VISIBLE_STORAGE_KEY } from './map-canvas.component';
```

Add a recording-context helper after the `makeScene` helper (after line 27):

```ts
interface FillCall {
  args: number[];
  alpha: number;
}

/** Builds a 2D-context stub that records every `fillRect`, with the alpha active at the time. */
function makeRecordingCtx(): { ctx: CanvasRenderingContext2D; fills: FillCall[] } {
  const fills: FillCall[] = [];
  const ctx: Record<string, unknown> = {
    imageSmoothingEnabled: true,
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    arc: vi.fn(),
  };
  ctx['fillRect'] = (x: number, y: number, w: number, h: number) => {
    fills.push({ args: [x, y, w, h], alpha: Number(ctx['globalAlpha']) });
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
}
```

Add the following tests (place them right after the grid-persistence test, after line 245):

```ts
  it('defaults to hiding the collision overlay when no session preference is stored', () => {
    setup(makeScene(4, 4));
    expect(fixture.componentInstance.showCollision()).toBe(false);
  });

  it('restores the collision overlay visibility from the session when enabled', () => {
    sessionStorage.setItem(COLLISION_VISIBLE_STORAGE_KEY, '1');
    setup(makeScene(4, 4));
    expect(fixture.componentInstance.showCollision()).toBe(true);
  });

  it('persists collision overlay visibility changes to the session storage', async () => {
    setup(makeScene(4, 4));
    const instance = fixture.componentInstance;
    instance.showCollision.set(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY)).toBe('1');
    instance.showCollision.set(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY)).toBe('0');
  });

  it('marks a blocking tile with a translucent fill over its footprint when enabled', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].tileData[0][0] = 1;
      setup(scene);
      fixture.componentRef.setInput('blockingById', new Map([[1, true]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.detectChanges();

      expect(fills).toContainEqual({ args: [0, 0, 16, 16], alpha: 0.3 });
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('does not mark a non-blocking tile', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].tileData[0][0] = 1;
      setup(scene);
      fixture.componentRef.setInput('blockingById', new Map([[1, false]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.detectChanges();

      expect(fills.some((f) => f.alpha === 0.3)).toBe(false);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('does not mark blocking tiles on hidden layers', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].visible = false;
      scene.layers[0].tileData[0][0] = 1;
      setup(scene);
      fixture.componentRef.setInput('blockingById', new Map([[1, true]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.detectChanges();

      expect(fills.some((f) => f.alpha === 0.3)).toBe(false);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('marks blocking tiles on a visible opacity-0 layer', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].opacity = 0;
      scene.layers[0].tileData[0][0] = 1;
      setup(scene);
      fixture.componentRef.setInput('blockingById', new Map([[1, true]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.detectChanges();

      expect(fills).toContainEqual({ args: [0, 0, 16, 16], alpha: 0.3 });
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('marks a multi-cell blocking footprint across its full rect', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].tileData[0][0] = 1;
      setup(scene, { 1: { left: 0, up: 0, right: 1, down: 0 } });
      fixture.componentRef.setInput('blockingById', new Map([[1, true]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.detectChanges();

      expect(fills).toContainEqual({ args: [0, 0, 32, 16], alpha: 0.3 });
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('does not draw the collision overlay in play mode', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].tileData[0][0] = 1;
      setup(scene);
      fixture.componentRef.setInput('blockingById', new Map([[1, true]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.componentRef.setInput('playMode', true);
      fixture.detectChanges();

      expect(fills.some((f) => f.alpha === 0.3)).toBe(false);
    } finally {
      getContextSpy.mockRestore();
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npx ng test --watch=false --include='**/map-canvas.component.spec.ts'`
Expected: FAIL — `COLLISION_VISIBLE_STORAGE_KEY` is not exported and `showCollision` does not exist.

- [ ] **Step 3: Implement the overlay in `map-canvas.component.ts`**

3a. After the `GRID_VISIBLE_STORAGE_KEY` export (line 24), add:

```ts
/** sessionStorage key holding the collision-overlay visibility preference for the current session. */
export const COLLISION_VISIBLE_STORAGE_KEY = 'rk-scene-editor.show-collision';
/** Fallback marker color used when the `--destructive` token cannot be resolved. */
const COLLISION_MARKER_FALLBACK = '#dc2626';
```

3b. After the `tileAnimations` input (line 58), add:

```ts
  /** Per-tile blocking flags used to draw the collision overlay. */
  blockingById = input<Map<number, boolean>>(new Map());
```

3c. After the `showGrid` signal (line 80), add:

```ts
  /** Whether the collision overlay is visible (persisted for the current session). */
  showCollision = signal(this.readCollisionVisibility());
```

3d. Add `this.blockingById();` and `this.showCollision();` to the first render effect so both trigger a redraw. The effect becomes:

```ts
    effect(() => {
      this.palette();
      this.tileSize();
      this.tileFootprints();
      this.blockingById();
      this.showCollision();
      const sources = this.tileImages();
      void this.rebuildImageCache(sources);
      this.render();
      this.ensureLoop();
    });
```

3e. After the grid-persistence effect (line 155), add:

```ts
    /** Persist the collision-overlay visibility choice for the current browser session. */
    effect(() => {
      sessionStorage.setItem(COLLISION_VISIBLE_STORAGE_KEY, this.showCollision() ? '1' : '0');
    });
```

3f. After `readGridVisibility()` (line 164), add:

```ts
  /**
   * Reads the stored collision-overlay visibility for the current session.
   * @returns True only when the session explicitly stores '1'; missing values default to hidden.
   */
  private readCollisionVisibility(): boolean {
    return sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY) === '1';
  }
```

3g. In `render()`, immediately before the grid pass (line 336), add:

```ts
    // Collision overlay drawn above every tile but below the grid; edit mode only.
    if (this.showCollision() && !this.playMode()) {
      this.drawCollisionOverlay(cell);
    }
```

3h. After the `render()` method (line 353), add:

```ts
  /**
   * @internal Draws a translucent destructive-color marker over the full footprint
   * of every blocking tile on visible layers. Runs inside the camera transform so
   * markers align with the rendered tiles. Layer opacity is ignored (matches runtime).
   * @param cell - Size of one grid cell in pixels.
   */
  private drawCollisionOverlay(cell: number): void {
    const ctx = this.ctx;
    const scene = this.scene();
    if (!ctx || !scene) return;
    const blocking = this.blockingById();
    const footprints = this.tileFootprints();
    ctx.fillStyle = cssTokenColor(
      this.canvasRef().nativeElement,
      '--destructive',
      COLLISION_MARKER_FALLBACK,
    );
    ctx.globalAlpha = 0.3;
    for (const layer of this.layers()) {
      if (!layer.visible) continue;
      for (let y = 0; y < scene.height; y++) {
        for (let x = 0; x < scene.width; x++) {
          const tileId = layer.tileData[y]?.[x] ?? -1;
          if (tileId < 0 || blocking.get(tileId) !== true) continue;
          const rect = footprintRect(x, y, tileId, footprints);
          ctx.fillRect(rect.x * cell, rect.y * cell, rect.w * cell, rect.h * cell);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npx ng test --watch=false --include='**/map-canvas.component.spec.ts'`
Expected: PASS — all map-canvas tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/map-canvas.component.ts src/app/features/scene-editor/map-canvas.component.spec.ts
git commit -m "feature-14: draw the collision/footprint overlay on the map canvas"
```

---

### Task 2: Scene-editor wiring (`SceneEditorComponent`)

**Files:**
- Modify: `src/app/features/scene-editor/scene-editor.component.ts`
- Modify: `src/app/features/scene-editor/scene-editor.component.html`
- Test: `src/app/features/scene-editor/scene-editor.component.spec.ts`

**Interfaces:**
- Consumes: `MapCanvasComponent.blockingById` and `.showCollision` (Task 1).
- Produces: `SceneEditorComponent.blockingById` computed (`Map<number, boolean>`), consumed by the template and `enterPlay()`.

- [ ] **Step 1: Write the failing tests**

Add to `scene-editor.component.spec.ts`:

```ts
  it('derives per-tile blocking flags from the project tiles', () => {
    component.projectTiles.set([
      { id: 1, properties: { blocking: true } } as unknown as Tile,
      { id: 2, properties: { blocking: false } } as unknown as Tile,
    ]);

    expect(component.blockingById().get(1)).toBe(true);
    expect(component.blockingById().get(2)).toBe(false);
  });

  it('toggles the collision overlay from the toolbar button', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      'button[title="Show collisions"]',
    ) as HTMLButtonElement | null;
    expect(button).toBeTruthy();

    button?.click();
    fixture.detectChanges();

    expect(component.mapCanvasRef()?.showCollision()).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npx ng test --watch=false --include='**/scene-editor.component.spec.ts'`
Expected: FAIL — `blockingById` does not exist and no button with title `Show collisions`.

- [ ] **Step 3: Implement the wiring**

3a. In `scene-editor.component.ts`, after the `sceneLayers` computed (line 130), add:

```ts
  /** Per-tile blocking flags, derived from the project's tiles. */
  readonly blockingById = computed(
    () => new Map(this.projectTiles().map((t) => [t.id, t.properties.blocking])),
  );
```

3b. In `enterPlay()`, replace the local map:

```ts
    const blockingById = new Map(this.projectTiles().map((t) => [t.id, t.properties.blocking]));
```

with:

```ts
    const blockingById = this.blockingById();
```

3c. In `scene-editor.component.html`, after the `tileAnimations` binding (line 40), add:

```html
      [blockingById]="blockingById()"
```

3d. In `scene-editor.component.html`, after the grid button `</button>` (line 73), add:

```html
      <button
        class="tw-inline-flex tw-items-center tw-justify-center tw-w-6 tw-h-6 tw-rounded-sm tw-bg-card-bg tw-border tw-border-border tw-text-foreground tw-cursor-pointer hover:tw-bg-accent"
        [title]="mapCanvasRef()?.showCollision() ? 'Hide collisions' : 'Show collisions'"
        (click)="mapCanvasRef()?.showCollision.set(!mapCanvasRef()?.showCollision())"
      >
        <span class="material-symbols" aria-hidden="true">block</span>
      </button>
```

- [ ] **Step 4: Run the full suite to verify everything passes**

Run: `devbox run npm run test`
Then: `devbox run npm run lint`
Expected: all tests green, lint clean.

- [ ] **Step 5: Apply formatting and commit**

```bash
devbox run npx prettier --write src/app/features/scene-editor/scene-editor.component.ts src/app/features/scene-editor/scene-editor.component.html src/app/features/scene-editor/scene-editor.component.spec.ts
git add src/app/features/scene-editor/scene-editor.component.ts src/app/features/scene-editor/scene-editor.component.html src/app/features/scene-editor/scene-editor.component.spec.ts
git commit -m "feature-14: wire the collision toggle into the scene editor toolbar"
```
