# Collision / Footprint Visibility Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scene-editor toolbar toggle that overlays a subtle marker on every blocking tile's full footprint, persisted for the browser session, without altering tile data.

**Architecture:** Mirror the existing grid-visibility toggle. `map-canvas.component.ts` gains a `showCollision` signal (persisted in `sessionStorage` under a new key, default OFF) plus a `tileBlocking` input (tileId → is-blocking). In `render()`, when `showCollision()` is on, a new `drawCollisionOverlay()` pass fills each blocking tile's footprint with a translucent token color, drawn after tiles and before the grid. `scene-editor.component.ts` builds `tileBlocking` from `projectTiles` (where `tile.properties.blocking` is true) and passes it down; its template adds a second floating toolbar button (`block` Material Symbol) next to the grid button that flips `mapCanvasRef()?.showCollision`.

**Tech Stack:** Angular 22 (OnPush, signals), Tailwind (`tw-` prefix), Material Symbols, jsdom + Vitest.

## Global Constraints

- English-only UI copy; Material Symbols icons; `tw-` Tailwind prefix.
- No inline templates; separate `.ts/.html/.scss`.
- JSDoc on every public method, class, and property.
- Collision is a diagnostic overlay only: never mutate tile/sprite data.
- `showCollision` persisted under key `'rk-scene-editor.show-collision'`, default **OFF** (restore from `'1'` only).
- Overlay must be drawn after tiles and before the grid.
- Disabled state must add zero draw cost (guard with `showCollision()`).
- Follow existing `showGrid` pattern for signal + persistence + toolbar.

---

### Task 1: Collision signal + persistence + tileBlocking input + overlay render pass

**Files:**
- Modify: `src/app/features/scene-editor/map-canvas.component.ts`
- Test: `src/app/features/scene-editor/map-canvas.component.spec.ts`

**Interfaces:**
- Consumes: `getFootprint(tileId, footprints)` (`map-footprint.ts`), `cssTokenColor(el, token, fallback)` (`grid-color.ts`).
- Produces: `export const COLLISION_VISIBLE_STORAGE_KEY: string`; `showCollision: WritableSignal<boolean>` (default OFF); input `tileBlocking: input<Record<number, boolean>>({})`; `private drawCollisionOverlay(ctx, scene, cell)`.

- [ ] **Step 1: Add the storage key + showCollision signal + input + persistence effect + overlay method**

In `map-canvas.component.ts`:

1. After line 22 (`export const GRID_VISIBLE_STORAGE_KEY = ...`), add:
```ts
/** sessionStorage key holding the collision overlay visibility preference for the current session. */
export const COLLISION_VISIBLE_STORAGE_KEY = 'rk-scene-editor.show-collision';
```

2. After the `tileFootprints` input, add:
```ts
/** Whether each tile id blocks movement (`Tile.properties.blocking`). Absent = non-blocking. */
tileBlocking = input<Record<number, boolean>>({});
```

3. After the `showGrid` signal (line 67), add:
```ts
/** Whether the collision overlay is visible (persisted for the current session; default OFF). */
showCollision = signal(this.readCollisionVisibility());
```

4. In the constructor, add reads to the re-render effect so toggling the overlay re-renders immediately, and add a persistence effect after the existing grid persistence effect (after line 137):
```ts
    effect(() => {
      this.tileBlocking();
      this.showCollision();
      this.render();
    });

    /** Persist the collision overlay visibility choice for the current browser session. */
    effect(() => {
      sessionStorage.setItem(COLLISION_VISIBLE_STORAGE_KEY, this.showCollision() ? '1' : '0');
    });
```
(Note: the second `effect` above is the persistence one; place both as separate effects. The first effect re-renders when `tileBlocking`/`showCollision` change.)

5. After `readGridVisibility()`, add:
```ts
/**
 * Reads the stored collision overlay visibility for the current session.
 * @returns True only when the session explicitly stores '1'; missing values default to hidden.
 */
private readCollisionVisibility(): boolean {
  return sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY) === '1';
}
```

6. In `render()`, immediately before the `// Grid drawn AFTER tiles` comment block (line 283), insert the collision pass:
```ts
    // Collision overlay drawn after tiles (stays on top) and before the grid.
    if (this.showCollision()) {
      this.drawCollisionOverlay(ctx, scene, cell);
    }
```

7. Add the overlay method (e.g. right after the `render()` method closes), using 'destructive' token for the diagnostic tint:
```ts
  /**
   * Draws a translucent marker over the full footprint of every blocking tile,
   * so designers can reason about collisions. Non-destructive; never mutates data.
   * @param ctx - Active 2D canvas context (already translated/scaled to the camera).
   * @param scene - The scene being rendered (provides width/height bounds).
   * @param cell - Grid cell size in pixels.
   */
  private drawCollisionOverlay(
    ctx: CanvasRenderingContext2D,
    scene: Scene,
    cell: number,
  ): void {
    const color = cssTokenColor(this.canvasRef().nativeElement, '--destructive', '#dc2626');
    const blocking = this.tileBlocking();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    for (const layer of this.layers()) {
      if (!layer.visible) continue;
      for (let y = 0; y < scene.height; y++) {
        for (let x = 0; x < scene.width; x++) {
          const tileId = layer.tileData[y]?.[x] ?? -1;
          if (tileId < 0 || !blocking[tileId]) continue;
          const { w, h } = getFootprint(tileId, this.tileFootprints());
          ctx.fillRect(x * cell, y * cell, w * cell, h * cell);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
```

- [ ] **Step 2: Add canvas unit tests**

In `map-canvas.component.spec.ts`, import the new key:
```ts
import { MapCanvasComponent, GRID_VISIBLE_STORAGE_KEY, COLLISION_VISIBLE_STORAGE_KEY } from './map-canvas.component';
```

Add the following tests (using a mocked 2D context to count overlay `fillRect` calls):

```ts
  it('defaults to hiding the collision overlay when no session preference is stored', () => {
    setup(makeScene(4, 4));
    expect(fixture.componentInstance.showCollision()).toBe(false);
  });

  it('restores the collision overlay from the session when enabled', () => {
    sessionStorage.setItem(COLLISION_VISIBLE_STORAGE_KEY, '1');
    setup(makeScene(4, 4));
    expect(fixture.componentInstance.showCollision()).toBe(true);
  });

  it('persists collision overlay visibility to the session storage', async () => {
    setup(makeScene(4, 4));
    const instance = fixture.componentInstance;
    instance.showCollision.set(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY)).toBe('1');
    instance.showCollision.set(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY)).toBe('0');
  });

  it('draws an overlay fill over blocking tile footprints only', () => {
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
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
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);

    try {
      const scene = makeScene(4, 2);
      scene.layers[0].tileData[0][0] = 1; // blocking tile
      scene.layers[0].tileData[1][3] = 2; // non-blocking tile
      setup(scene, { 1: { w: 2, h: 1 } });
      const instance = fixture.componentInstance;
      instance.showCollision.set(true);
      fixture.componentRef.setInput('tileBlocking', { 1: true });

      const before = (ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
      instance['drawCollisionOverlay'](ctx, scene, 16);

      const calls = (ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.slice(before);
      // Only tile id 1 is blocking -> exactly one overlay fill at its 2x1 footprint (x=0,y=0).
      expect(calls).toEqual([[0, 0, 32, 16]]);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('skips the overlay pass entirely when collision is hidden', () => {
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
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
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);

    try {
      setup(makeScene(2, 2));
      const instance = fixture.componentInstance;
      fixture.componentRef.setInput('tileBlocking', { 1: true });
      instance.showCollision.set(false);
      const before = (ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
      instance['drawCollisionOverlay'](ctx, makeScene(2, 2), 16);
      expect((ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.slice(before)).toEqual([]);
    } finally {
      getContextSpy.mockRestore();
    }
  });
```

- [ ] **Step 3: Run tests + lint**

Run: `devbox run npm run test -- --include='src/app/features/scene-editor/map-canvas.component.spec.ts'`
Expected: PASS (all MapCanvasComponent tests including the 5 new ones).
Run: `devbox run npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/scene-editor/map-canvas.component.ts src/app/features/scene-editor/map-canvas.component.spec.ts docs/superpowers/plans/2026-08-31-collision-visibility-toggle.md
git commit -m "feature-14: add collision overlay signal, persistence, and blocking render pass"
```

### Task 2: Scene-editor toolbar button + tileBlocking wiring

**Files:**
- Modify: `src/app/features/scene-editor/scene-editor.component.ts`
- Modify: `src/app/features/scene-editor/scene-editor.component.html`
- Test: `src/app/features/scene-editor/scene-editor.component.spec.ts`

**Interfaces:**
- Consumes: `COLLISION_VISIBLE_STORAGE_KEY` (for the persistence-equivalent test import), `showCollision` signal + `tileBlocking` input from `map-canvas.component`.
- Produces: signal `tileBlocking: WritableSignal<Record<number, boolean>>`; HTML binding `[tileBlocking]` and the `block` toolbar button toggling `mapCanvasRef()?.showCollision`.

- [ ] **Step 1: Build the tileBlocking map from project tiles**

In `scene-editor.component.ts`, after the `tileFootprints` signal declaration (line 104), add:
```ts
/** Whether each tile id blocks movement, derived from each tile's properties. */
tileBlocking = signal<Record<number, boolean>>({});
```

In `loadProjectData()`, after `this.projectTiles.set(tiles);` (line 273), add:
```ts
const blocking: Record<number, boolean> = {};
for (const tile of tiles) {
  if (tile.properties.blocking) blocking[tile.id] = true;
}
this.tileBlocking.set(blocking);
```

- [ ] **Step 2: Bind the input and add the toolbar button**

In `scene-editor.component.html`, add to the `<rk-map-canvas>` bindings (after `[tileFootprints]`, line 24):
```html
      [tileBlocking]="tileBlocking()"
```

Directly below the existing grid floating button (after line 34), add a second floating button:
```html
    <button
      class="tw-absolute tw-bottom-1 tw-right-1 tw-z-10 tw-flex tw-items-center tw-justify-center tw-w-6 tw-h-6 tw-rounded-sm tw-bg-card-bg tw-border tw-border-border tw-text-foreground tw-cursor-pointer hover:tw-bg-accent"
      [title]="mapCanvasRef()?.showCollision() ? 'Hide collisions' : 'Show collisions'"
      (click)="mapCanvasRef()?.showCollision.set(!mapCanvasRef()?.showCollision())"
    >
      <span class="material-symbols" aria-hidden="true">block</span>
    </button>
```
(Placement: bottom-right to avoid overlapping the top-right grid button.)

- [ ] **Step 3: Add scene-editor component tests**

In `scene-editor.component.spec.ts`, import the key (near the existing `GRID_VISIBLE_STORAGE_KEY` import, line 9):
```ts
import { COLLISION_VISIBLE_STORAGE_KEY } from './map-canvas.component';
```

Add after the existing grid-toggle test (line 112):
```ts
  it('toggles the collision overlay via the toolbar button and persists it for the session', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const byTitle = (title: string) =>
      fixture.nativeElement.querySelector(`button[title="${title}"]`) as HTMLButtonElement | null;
    expect(byTitle('Show collisions')).toBeTruthy();

    byTitle('Show collisions')!.click();
    fixture.detectChanges();
    expect(byTitle('Hide collisions')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY)).toBe('1');

    byTitle('Hide collisions')!.click();
    fixture.detectChanges();
    expect(byTitle('Show collisions')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY)).toBe('0');
  });
```

- [ ] **Step 4: Run tests + lint + build**

Run: `devbox run npm run test` — Expected: all suites pass (including the new tests).
Run: `devbox run npm run lint` — Expected: clean.
Run: `devbox run npm run build` — Expected: succeeds within budget (no warnings/errors).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/scene-editor.component.ts src/app/features/scene-editor/scene-editor.component.html src/app/features/scene-editor/scene-editor.component.spec.ts
git commit -m "feature-14: wire collision overlay input and toolbar toggle in scene editor"
```
