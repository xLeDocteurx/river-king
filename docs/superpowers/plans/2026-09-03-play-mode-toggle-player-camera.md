# Play Mode (Toggle + Player + Camera) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Play/Edit toggle to the scene editor, a WASD/arrow-movable player rendered above all layers, a camera that follows it, and a spawn tool to place where it starts.

**Architecture:** A new `PlayerController` feature service (provided by the scene editor root) owns player state and movement. `MapCanvasComponent` gains `playMode`/`spawnPoint`/`placeSpawnMode` inputs plus a `spawnPlaced` output; its rAF loop now also runs continuously in Play mode to move the player and follow it. `SceneEditorComponent` adds the toggle buttons, spawn persistence (IndexedDB `spawnPoint`), and suppresses editor shortcuts while playing.

**Tech Stack:** Angular 22 standalone components + signals; Vitest (via `@angular/build:unit-test`). No new dependencies.

## Global Constraints

- Tailwind classes require the `tw-` prefix. No hardcoded hex/rgb in styles — use theme tokens (`tw-bg-background`, `--accent`, etc.).
- Icons use Material Symbols (`<span class="material-symbols">…</span>`).
- Every class and every public method needs JSDoc (`@param`, `@returns`, `@throws` where applicable).
- No inline templates/styles — separate `.html`/`.scss` files.
- Do NOT run `ng generate`. Write files directly.
- Run test/lint/format via `devbox run` (bare `npm run test` may fail in this environment).
- Destructive/async failures surface through `NotificationService.error()`.
- UI copy in English only.
- `feature-49` branch is already checked out. Commit messages prefixed `feature-49:`.

`spawnPoint` on `Scene` is a NON-indexed field, so **no Dexie schema migration** is needed (the `scenes` table only indexes `id, projectId, name, folderPath`).

---

### Task 1: Add `spawnPoint` to the Scene model

**Files:**

- Modify: `src/app/shared/models/scene.model.ts`
- Modify: `src/app/features/scene-editor/services/scene.service.ts`
- Test: `src/app/features/scene-editor/services/scene.service.spec.ts`

**Interfaces:**

- Produces: `Scene.spawnPoint: { x: number; y: number } | null`. A value of `null` (or `undefined` on legacy rows) means "use the scene center". `SceneService.createScene(...)` returns scenes with `spawnPoint: null`.

- [ ] **Step 1: Write the failing test**

Add to `src/app/features/scene-editor/services/scene.service.spec.ts`, inside the existing `describe('SceneService', ...)` block after the first `should create a scene ...` test:

```ts
it('creates a scene with a null spawnPoint by default', async () => {
  const scene = await service.createScene('proj-1', 'Spawn Default', 10, 10);
  expect(scene.spawnPoint).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test -- --include "**/scene.service.spec.ts"` · strip devbox noise.
Expected: FAIL — `scene.spawnPoint` is `undefined` (property doesn't exist yet).

- [ ] **Step 3: Add the field to the model**

In `src/app/shared/models/scene.model.ts`, add to the `Scene` interface (after `folderPath`):

```ts
  /**
   * Player spawn cell, in grid coordinates. `null` (or `undefined` on legacy
   * rows) means the default spawn: the scene center `(floor(width/2),
   * floor(height/2))`.
   */
  spawnPoint: { x: number; y: number } | null;
```

- [ ] **Step 4: Set default in createScene**

In `src/app/features/scene-editor/services/scene.service.ts`, in `createScene`, add `spawnPoint: null,` to the constructed scene object (after `folderPath: '',`):

```ts
    const scene: Scene = {
      id: crypto.randomUUID(),
      projectId,
      name,
      folderPath: '',
      spawnPoint: null,
      width,
      height,
      layers: [
```

- [ ] **Step 5: Run test to verify it passes**

Run: `devbox run npm run test -- --include "**/scene.service.spec.ts"` · strip devbox noise.
Expected: PASS (all SceneService tests green).

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/models/scene.model.ts src/app/features/scene-editor/services/scene.service.ts src/app/features/scene-editor/services/scene.service.spec.ts
git commit -m "feature-49: add spawnPoint field to Scene model (non-indexed)"
```

---

### Task 2: PlayerController service

**Files:**

- Create: `src/app/features/scene-editor/services/play-controller.ts`
- Test: `src/app/features/scene-editor/services/play-controller.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `type PlayerDirection = 'up' | 'down' | 'left' | 'right'`
  - `class PlayerController` with signals `readonly x: WritableSignal<number>`, `readonly y: WritableSignal<number>`, `readonly direction: Signal<PlayerDirection>`, `readonly moving: Signal<boolean>`, readonly prop `speed: number` (= 5), and methods `start(scene: { width: number; height: number }, spawn: { x: number; y: number }): void`, `update(dt: number): void`, `stop(): void`.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/scene-editor/services/play-controller.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { PlayerController } from './play-controller';

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function release(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

describe('PlayerController', () => {
  let player: PlayerController;
  const scene = { width: 10, height: 10 };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PlayerController] });
    player = TestBed.inject(PlayerController);
  });

  afterEach(() => {
    player.stop();
  });

  it('starts at the given spawn position', () => {
    player.start(scene, { x: 3, y: 4 });
    expect(player.x()).toBe(3);
    expect(player.y()).toBe(4);
  });

  it('moves up when W is held', () => {
    player.start(scene, { x: 5, y: 5 });
    press('w');
    player.update(1);
    expect(player.x()).toBe(5);
    expect(player.y()).toBeLessThan(5);
  });

  it('moves right when arrow-right is held', () => {
    player.start(scene, { x: 5, y: 5 });
    press('ArrowRight');
    player.update(1);
    expect(player.x()).toBeGreaterThan(5);
    expect(player.y()).toBe(5);
  });

  it('normalizes diagonal movement so speed is not boosted', () => {
    player.start(scene, { x: 0, y: 0 });
    player.speed = 1;
    press('d');
    press('s');
    player.update(1);
    // Diagonal = one unit of distance, split across axes.
    const expected = Math.SQRT1_2;
    expect(player.x()).toBeCloseTo(expected, 5);
    expect(player.y()).toBeCloseTo(expected, 5);
  });

  it('scales movement by dt', () => {
    player.start(scene, { x: 0, y: 0 });
    player.speed = 4;
    press('d');
    player.update(0.5); // half a second -> 2 cells
    expect(player.x()).toBeCloseTo(2, 5);
  });

  it('clamps the player inside the scene bounds', () => {
    player.start(scene, { x: 0, y: 0 });
    press('a');
    player.update(100);
    expect(player.x()).toBe(0);
  });

  it('sets direction and moving state from input', () => {
    player.start(scene, { x: 5, y: 5 });
    press('a');
    player.update(0.1);
    expect(player.direction()).toBe('left');
    expect(player.moving()).toBe(true);
    release('a');
    player.update(0.1);
    expect(player.moving()).toBe(false);
  });

  it('does not move when no key is held', () => {
    player.start(scene, { x: 5, y: 5 });
    player.update(1);
    expect(player.x()).toBe(5);
    expect(player.y()).toBe(5);
    expect(player.moving()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test -- --include "**/play-controller.spec.ts"` · strip devbox noise.
Expected: FAIL — cannot resolve/enrich `./play-controller` (module missing).

- [ ] **Step 3: Implement PlayerController**

Create `src/app/features/scene-editor/services/play-controller.ts`:

```ts
import { Injectable, signal } from '@angular/core';

/** The direction the player is currently facing. */
export type PlayerDirection = 'up' | 'down' | 'left' | 'right';

/** Maps an input key (lowercased) to a normalized movement vector. */
const MOVEMENT_KEYS: Record<string, { dx: number; dy: number }> = {
  w: { dx: 0, dy: -1 },
  arrowup: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  arrowdown: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  arrowleft: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
  arrowright: { dx: 1, dy: 0 },
};

/**
 * Holds the runtime player state and movement logic for Play mode.
 *
 * Position is expressed in grid cells (fractional). It tracks which movement
 * keys are currently held via raw window keydown/keyup listeners and applies
 * input to movement in `update(dt)` so playback is frame-rate independent.
 */
@Injectable()
export class PlayerController {
  /** Current player X position in grid cells (fractional). */
  readonly x = signal(0);
  /** Current player Y position in grid cells (fractional). */
  readonly y = signal(0);
  /** The direction the player is facing. */
  readonly direction = signal<PlayerDirection>('down');
  /** Whether the player currently has a movement axis held. */
  readonly moving = signal(false);
  /** Movement speed in grid cells per second. */
  speed = 5;

  private readonly held = new Set<string>();
  /** @internal Timestamp of the last key update, for dt-independent movement. */
  private listenersActive = false;
  private sceneWidth = 0;
  private sceneHeight = 0;

  /** @internal Records a held movement key. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.held.add(event.key.toLowerCase());
  };

  /** @internal Removes a released movement key. */
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.key.toLowerCase());
  };

  /**
   * Begins a Play session: attaches input listeners, applies bounds, and
   * resets the player to the given spawn cell.
   * @param scene - The scene being played, for its width/height bounds.
   * @param spawn - The spawn cell to start at.
   */
  start(scene: { width: number; height: number }, spawn: { x: number; y: number }): void {
    this.sceneWidth = scene.width;
    this.sceneHeight = scene.height;
    this.x.set(spawn.x);
    this.y.set(spawn.y);
    this.direction.set('down');
    this.moving.set(false);
    this.held.clear();
    if (!this.listenersActive) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.listenersActive = true;
    }
  }

  /**
   * Ends a Play session: releases all held keys and detaches input listeners.
   */
  stop(): void {
    this.held.clear();
    if (this.listenersActive) {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      this.listenersActive = false;
    }
  }

  /**
   * Advances the player by the given delta time, applying held input and
   * clamping to scene bounds. Updates facing direction and the moving state.
   * @param dt - Delta time in seconds.
   */
  update(dt: number): void {
    let dx = 0;
    let dy = 0;
    for (const key of this.held) {
      const m = MOVEMENT_KEYS[key];
      if (m) {
        dx += m.dx;
        dy += m.dy;
      }
    }

    if (dx === 0 && dy === 0) {
      this.moving.set(false);
      return;
    }

    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;

    this.x.update((v) => Math.max(0, Math.min(this.sceneWidth - 1, v + dx * this.speed * dt)));
    this.y.update((v) => Math.max(0, Math.min(this.sceneHeight - 1, v + dy * this.speed * dt)));

    if (Math.abs(dx) >= Math.abs(dy)) {
      this.direction.set(dx < 0 ? 'left' : 'right');
    } else {
      this.direction.set(dy < 0 ? 'up' : 'down');
    }
    this.moving.set(true);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test -- --include "**/play-controller.spec.ts"` · strip devbox noise.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/services/play-controller.ts src/app/features/scene-editor/services/play-controller.spec.ts
git commit -m "feature-49: add PlayerController service for Play mode movement"
```

---

### Task 3: MapCanvasComponent — player render, camera follow, spawn marker, Play loop

**Files:**

- Modify: `src/app/features/scene-editor/map-canvas.component.ts`
- Test: `src/app/features/scene-editor/map-canvas.component.spec.ts`

**Interfaces:**

- Consumes: `PlayerController` (injected), `cssTokenColor` from `./grid-color` (already imported).
- Produces:
  - New inputs: `playMode = input(false)`, `placeSpawnMode = input(false)`, `spawnPoint = input<{ x: number; y: number } | null>(null)`.
  - New output: `spawnPlaced = output<{ x: number; y: number }>()` emitted when a left click lands inside the scene while `placeSpawnMode` is true.
  - The rAF loop runs continuously while `playMode` is true, calling `PlayerController.update(dt)` and following the player.

- [ ] **Step 1: Write the failing tests**

Add the following tests to `src/app/features/scene-editor/map-canvas.component.spec.ts`. Also update the shared `setup(...)` helper to register a `PlayerController` provider (required by the component's new dependency).

Replace the `setup` function with:

```ts
function setup(scene: Scene, footprints: Record<number, { w: number; h: number }> = {}): void {
  TestBed.configureTestingModule({
    imports: [MapCanvasComponent],
    providers: [PlayerController],
  });
  fixture = TestBed.createComponent(MapCanvasComponent);
  placed = [];
  fixture.componentInstance.tilePlaced.subscribe((e) => placed.push(e));
  fixture.componentRef.setInput('scene', scene);
  fixture.componentRef.setInput('layers', scene.layers);
  fixture.componentRef.setInput('selectedTileId', 1);
  fixture.componentRef.setInput('tileFootprints', footprints);
  fixture.detectChanges();
}
```

Add the import at the top of the spec file (after the existing imports):

```ts
import { PlayerController } from './services/play-controller';
```

Add these new `it` blocks at the end of the `describe('MapCanvasComponent', ...)` block:

```ts
it('emits a spawnPlaced cell when placeSpawnMode is active', () => {
  setup(makeScene());
  const instance = fixture.componentInstance;
  let spawn: { x: number; y: number } | undefined;
  instance.spawnPlaced.subscribe((c) => (spawn = c));
  fixture.componentRef.setInput('placeSpawnMode', true);

  instance.onMouseDown(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 20 }));

  expect(spawn).toEqual({ x: 0, y: 1 });
  expect(placed).toEqual([]);
});

it('does not emit spawnPlaced when placeSpawnMode is off', () => {
  setup(makeScene());
  const instance = fixture.componentInstance;
  let spawn: { x: number; y: number } | undefined;
  instance.spawnPlaced.subscribe((c) => (spawn = c));

  instance.onMouseDown(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 20 }));

  expect(spawn).toBeUndefined();
});

it('draws the player placeholder in play mode', () => {
  const ctx = {
    imageSmoothingEnabled: true,
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
    setup(makeScene());
    const player = fixture.debugElement.injector.get(PlayerController);
    player.start({ width: 4, height: 4 }, { x: 1, y: 2 });
    fixture.componentRef.setInput('playMode', true);
    fixture.detectChanges();
    expect(ctx.fillRect).toHaveBeenCalledWith(16, 32, 16, 16);
  } finally {
    getContextSpy.mockRestore();
  }
});

it('does not draw the player placeholder outside play mode', () => {
  const ctx = {
    imageSmoothingEnabled: true,
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
    setup(makeScene());
    fixture.detectChanges();
    expect(ctx.fillRect).not.toHaveBeenCalledWith(16, 32, 16, 16);
  } finally {
    getContextSpy.mockRestore();
  }
});

it('follows the player by moving the camera toward the player cell', () => {
  setup(makeScene());
  const instance = fixture.componentInstance;
  const player = fixture.debugElement.injector.get(PlayerController);
  player.start({ width: 4, height: 4 }, { x: 2, y: 2 });
  fixture.componentRef.setInput('playMode', true);
  const beforeX = instance.cameraX();
  // jsdom canvas is 0x0 wide, so the target X is -(2*cell*zoom).
  instance['followPlayer']();
  expect(instance.cameraX()).toBeGreaterThan(beforeX);
});

it('ignores editing clicks in play mode', () => {
  setup(makeScene());
  const instance = fixture.componentInstance;
  fixture.componentRef.setInput('playMode', true);
  fixture.componentRef.setInput('selectedTileId', 1);
  instance.onMouseDown(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 20 }));
  expect(placed).toEqual([]);
});
```

Note: `addEventListener`/`removeEventListener` on `window` are used by `PlayerController`. In jsdom they are real, so key events fire correctly. No extra setup needed.

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test -- --include "**/map-canvas.component.spec.ts"` · strip devbox noise.
Expected: FAIL — the new inputs/outputs/properties don't exist yet (and the component cannot inject `PlayerController`).

- [ ] **Step 3: Implement the MapCanvasComponent changes**

In `src/app/features/scene-editor/map-canvas.component.ts`:

1. Add imports for `input`/`output` (already imported) and `PlayerController`:

```ts
import { PlayerController } from './services/play-controller';
```

2. Add `inject` to the `@angular/core` import list, and add an injection at class field level:

```ts
import {
  Component,
  input,
  output,
  viewChild,
  signal,
  effect,
  inject,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  ElementRef,
} from '@angular/core';
```

3. Add the three new inputs next to the existing inputs (after `tileAnimations`), and a new output, plus the `PlayerController` injection:

```ts
  /** Animation metadata per tile id (absent for static tiles). */
  tileAnimations = input<Record<number, TileAnimationMeta>>({});
  /** Whether Play mode is active; in Play mode a player renders and is followed. */
  playMode = input(false);
  /** Whether the next canvas click should place the spawn point instead of editing. */
  placeSpawnMode = input(false);
  /** Explicit player spawn cell; drawn as a marker in Edit mode. Null hides the marker. */
  spawnPoint = input<{ x: number; y: number } | null>(null);
  /** Emitted when a tile is placed on the canvas. */
  tilePlaced = output<{ x: number; y: number; tileId: number }>();
  /** Emitted when the spawn point is placed while placeSpawnMode is active. */
  spawnPlaced = output<{ x: number; y: number }>();

  /** Runtime player state for Play mode. */
  private readonly player = inject(PlayerController);
```

4. Replace the loop state fields. Change the block (currently lines ~84-86):

```ts
  /** @internal Handle for the active requestAnimationFrame loop. */
  private rafId = 0;
  /** @internal Whether the animation loop is currently running. */
  private animating = false;
```

to:

```ts
  /** @internal Handle for the active requestAnimationFrame loop. */
  private rafId = 0;
  /** @internal Whether the requestAnimationFrame loop is currently running. */
  private loopRunning = false;
  /** @internal Timestamp of the previous animation frame (for player dt). */
  private lastPlayTime = 0;
```

5. Update the constructor's first `effect` to use the new loop control. Replace the animation start/stop block (currently lines ~118-123):

```ts
const animations = this.tileAnimations();
if (Object.keys(animations).length > 0 && !this.animating) {
  this.startAnimationLoop();
} else if (Object.keys(animations).length === 0 && this.animating) {
  this.stopAnimationLoop();
}
```

with:

```ts
this.ensureLoop();
```

Then add a second effect right after that first `effect`, to keep the loop running while in Play mode:

```ts
/** Keep the loop running while in Play mode so the player is updated and drawn. */
effect(() => {
  this.playMode();
  this.ensureLoop();
});
```

6. Replace the three loop methods `startAnimationLoop`, `stopAnimationLoop`, and `tickAnimation` (currently lines ~305-361) with:

```ts
  /**
   * Ensures the requestAnimationFrame loop is running exactly when it is
   * needed: while Play mode is active or while there are animated tiles.
   */
  private ensureLoop(): void {
    const shouldRun = this.hasAnimatedTiles() || this.playMode();
    if (shouldRun && !this.loopRunning) {
      this.loopRunning = true;
      this.lastFrameTimes.clear();
      this.lastPlayTime = 0;
      const now = performance.now();
      for (const id of Object.keys(this.tileAnimations()).map(Number)) {
        this.lastFrameTimes.set(id, now);
      }
      this.tick(now);
    } else if (!shouldRun && this.loopRunning) {
      this.loopRunning = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      this.frameIndices.clear();
      this.lastFrameTimes.clear();
      this.lastPlayTime = 0;
    }
  }

  /** @internal Whether any tile in the scene is animated. */
  private hasAnimatedTiles(): boolean {
    return Object.keys(this.tileAnimations()).length > 0;
  }

  /**
   * Animation frame callback. Advances animated tiles, updates and follows
   * the player in Play mode, redraws, and schedules the next tick.
   * @param now - Current timestamp from requestAnimationFrame.
   */
  private tick = (now: number): void => {
    if (!this.loopRunning) return;

    let needsRedraw = false;

    if (this.playMode()) {
      const last = this.lastPlayTime;
      const dt = last ? (now - last) / 1000 : 0;
      this.lastPlayTime = now;
      this.player.update(dt);
      this.followPlayer();
      needsRedraw = true;
    }

    const animations = this.tileAnimations();
    for (const tileIdStr of Object.keys(animations)) {
      const tileId = Number(tileIdStr);
      const meta = animations[tileId];
      const lastTime = this.lastFrameTimes.get(tileId) ?? now;
      const elapsed = now - lastTime;
      const interval = 1000 / meta.fps;
      if (elapsed >= interval) {
        const current = this.frameIndices.get(tileId) ?? 0;
        const next = (current + 1) % meta.frameCount;
        this.frameIndices.set(tileId, next);
        this.lastFrameTimes.set(tileId, now);
        needsRedraw = true;
      }
    }

    if (needsRedraw) this.render();
    this.rafId = requestAnimationFrame(this.tick);
  };

  /**
   * Moves the camera toward the player cell using a damped lerp so the view
   * follows smoothly regardless of frame rate.
   */
  private followPlayer(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const cell = this.tileSize();
    const px = this.player.x() * cell;
    const py = this.player.y() * cell;
    const z = this.zoom();
    const targetX = -(px * z) + canvas.width / 2;
    const targetY = -(py * z) + canvas.height / 2;
    const k = 0.12;
    this.cameraX.update((v) => v + (targetX - v) * k);
    this.cameraY.update((v) => v + (targetY - v) * k);
  }
```

7. In `render()`, draw the spawn marker (Edit mode) and the player placeholder (Play mode). Right after the layers `for` loop finishes (after the `if (layer.opacity < 1) { ctx.globalAlpha = 1; }` block) and before the grid block, insert:

```ts
const spawn = this.spawnPoint();
if (spawn && !this.playMode()) {
  const marker = cssTokenColor(this.canvasRef().nativeElement, '--accent', '#ffffff');
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = marker;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(spawn.x * cell + cell / 2, spawn.y * cell + cell / 2, cell / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

if (this.playMode()) {
  const px = this.player.x();
  const py = this.player.y();
  const stroke = cssTokenColor(this.canvasRef().nativeElement, '--accent', '#ffffff');
  ctx.fillStyle = stroke;
  ctx.fillRect(px * cell, py * cell, cell, cell);
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(px * cell, py * cell, cell, cell);
  ctx.globalAlpha = 1;
}
```

8. Suppress the grid during Play mode. Change the grid draw condition (currently `if (this.showGrid()) {`):

```ts
if (this.showGrid() && !this.playMode()) {
  this.drawGrid(ctx, scene, cell, this.viewportWidth(), this.viewportHeight());
}
```

9. Handle editing interactions. Replace `onMouseDown` (currently lines ~478-488) with:

```ts
  onMouseDown(event: MouseEvent): void {
    if (this.playMode()) {
      return;
    }
    if (this.placeSpawnMode()) {
      if (event.button === 0) this.emitSpawnCell(event);
      return;
    }
    if (event.button === 1 || (event.button === 0 && !this.selectedTileId())) {
      // Middle mouse or left click without tile selection = pan
      this.isDragging = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (event.button === 0 && this.selectedTileId() !== null) {
      // Left click with tile selected = place tile
      this.placeTile(event);
    }
  }
```

10. Add the new `emitSpawnCell` helper method (after `placeTile`, near the end of the class):

```ts
  /**
   * @internal Computes the grid cell under a left-click and, if it is inside
   * the scene, emits a spawnPlaced event. Used while placeSpawnMode is active.
   * @param event The native mouse event.
   */
  private emitSpawnCell(event: MouseEvent): void {
    const scene = this.scene();
    if (!scene) return;
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const cell = this.tileSize();
    const x = Math.floor((event.clientX - rect.left - this.cameraX()) / (cell * this.zoom()));
    const y = Math.floor((event.clientY - rect.top - this.cameraY()) / (cell * this.zoom()));
    if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) return;
    this.spawnPlaced.emit({ x, y });
  }
```

11. Update `ngOnDestroy` (currently calls `this.stopAnimationLoop()`) to cancel the loop directly (the shared `PlayerController` is torn down by its owner, not the canvas):

```ts
  ngOnDestroy(): void {
    this.loopRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test -- --include "**/map-canvas.component.spec.ts"` · strip devbox noise.
Expected: PASS (all existing + new MapCanvasComponent tests green).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/map-canvas.component.ts src/app/features/scene-editor/map-canvas.component.spec.ts
git commit -m "feature-49: render and follow the player, draw spawn marker, support spawn placement"
```

---

### Task 4: SceneEditorComponent — Play/Edit toggle, spawn tool, Play safeguards

**Files:**

- Modify: `src/app/features/scene-editor/scene-editor.component.ts`
- Modify: `src/app/features/scene-editor/scene-editor.component.html`
- Test: `src/app/features/scene-editor/scene-editor.component.spec.ts`

**Interfaces:**

- Consumes:
  - `PlayerController` (new `providers` entry + injected).
  - `MapCanvasComponent` new inputs `playMode`, `placeSpawnMode`, `spawnPoint` and output `spawnPlaced`.
  - `SceneService.updateScene(id, { spawnPoint })` and `NotificationService`.
- Produces:
  - `playMode = signal(false)`, `placeSpawnMode = signal(false)`.
  - Methods `enterPlay(): void`, `exitPlay(): void`, `toggleSpawnTool(): void`, `onSpawnPlaced(cell: { x: number; y: number }): Promise<void>`.
  - A currently-played flag guard at the top of `onShortcut` that ignores editor shortcuts in Play mode.

- [ ] **Step 1: Write the failing tests**

Add the following tests at the end of the `describe('SceneEditorComponent', ...)` block in `src/app/features/scene-editor/scene-editor.component.spec.ts`:

```ts
it('entering Play starts the player at the scene center by default', async () => {
  fixture.detectChanges();
  await fixture.whenStable();
  const scene = await sceneService.createScene('p1', 'Play', 8, 6);
  await component.loadScenes();
  await component.selectScene(scene.id);

  component.enterPlay();

  const player = fixture.debugElement.injector.get(PlayerController);
  expect(component.playMode()).toBe(true);
  expect(player.x()).toBe(4);
  expect(player.y()).toBe(3);
});

it('entering Play starts the player at the explicit spawnPoint when set', async () => {
  fixture.detectChanges();
  await fixture.whenStable();
  const scene = await sceneService.createScene('p1', 'Play', 8, 6);
  await sceneService.updateScene(scene.id, { spawnPoint: { x: 2, y: 5 } });
  await component.loadScenes();
  await component.selectScene(scene.id);

  component.enterPlay();

  const player = fixture.debugElement.injector.get(PlayerController);
  expect(player.x()).toBe(2);
  expect(player.y()).toBe(5);
});

it('exiting Play stops the player and returns to Edit', async () => {
  fixture.detectChanges();
  await fixture.whenStable();
  const scene = await sceneService.createScene('p1', 'Play', 8, 6);
  await component.loadScenes();
  await component.selectScene(scene.id);

  component.enterPlay();
  component.exitPlay();

  expect(component.playMode()).toBe(false);
});

it('persists a placed spawn point and notifies success', async () => {
  fixture.detectChanges();
  await fixture.whenStable();
  const scene = await sceneService.createScene('p1', 'Spawn', 8, 6);
  await component.loadScenes();
  await component.selectScene(scene.id);
  const successSpy = vi.spyOn(TestBed.inject(NotificationService), 'success');

  await component.onSpawnPlaced({ x: 1, y: 2 });

  expect(component.selectedScene()?.spawnPoint).toEqual({ x: 1, y: 2 });
  expect((await db.scenes.get(scene.id))?.spawnPoint).toEqual({ x: 1, y: 2 });
  expect(component.placeSpawnMode()).toBe(false);
  expect(successSpy).toHaveBeenCalledWith('Spawn point set');
});

it('notifies an error when persisting the spawn point fails', async () => {
  fixture.detectChanges();
  await fixture.whenStable();
  const scene = await sceneService.createScene('p1', 'Spawn', 8, 6);
  await component.loadScenes();
  await component.selectScene(scene.id);
  const errorSpy = vi.spyOn(TestBed.inject(NotificationService), 'error');
  vi.spyOn(sceneService, 'updateScene').mockRejectedValue(new Error('db failure'));

  await component.onSpawnPlaced({ x: 1, y: 2 });

  expect(errorSpy).toHaveBeenCalledWith('Failed to set the spawn point.');
});

it('suppresses editor shortcuts while in Play mode', async () => {
  fixture.detectChanges();
  await fixture.whenStable();
  const scene = await sceneService.createScene('p1', 'Play', 8, 6);
  await component.loadScenes();
  await component.selectScene(scene.id);

  const undoService = TestBed.inject(UndoService);
  const undoSpy = vi.spyOn(undoService, 'undo');
  component.enterPlay();

  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true }),
  );

  expect(undoSpy).not.toHaveBeenCalled();
});

it('toggles the spawn tool', async () => {
  fixture.detectChanges();
  await fixture.whenStable();
  expect(component.placeSpawnMode()).toBe(false);
  component.toggleSpawnTool();
  expect(component.placeSpawnMode()).toBe(true);
  component.toggleSpawnTool();
  expect(component.placeSpawnMode()).toBe(false);
});

it('renders the Play and spawn toolbar buttons', async () => {
  fixture.detectChanges();
  await fixture.whenStable();
  const buttons = fixture.nativeElement.querySelectorAll(
    'button[title*="play" i], button[title*="Play" i]',
  );
  const spawn = fixture.nativeElement.querySelector('button[title="Place spawn point"]');
  expect(buttons.length).toBeGreaterThan(0);
  expect(spawn).toBeTruthy();
});
```

Add the `PlayerController` import at the top of the spec file:

```ts
import { PlayerController } from './services/play-controller';
```

Note: The "renders the Play ... toolbar buttons" test uses the exact `title` strings you will add in the HTML below. Keep them matching.

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test -- --include "**/scene-editor.component.spec.ts"` · strip devbox noise.
Expected: FAIL — methods/state don't exist yet (and `PlayerController` provider is missing).

- [ ] **Step 3: Implement the SceneEditorComponent changes**

In `src/app/features/scene-editor/scene-editor.component.ts`:

1. Add `PlayerController` to the import from services and to the `providers` array:

```ts
import { PlayerController } from './services/play-controller';
```

```ts
  providers: [SceneService, MapTilesService, PlayerController],
```

2. Inject the controller and add the new state fields (after the existing `selectedTileId` signal or near related state):

```ts
  private readonly player = inject(PlayerController);
```

Add new public signals near the other component state (e.g. after `rightPanelOpen`):

```ts
  /** Whether the scene is in Play mode (player controls the world). */
  readonly playMode = signal(false);
  /** Whether the next canvas click places the spawn point. */
  readonly placeSpawnMode = signal(false);
```

3. Suppress editor shortcuts in Play mode. At the top of `onShortcut`, add the guard:

```ts
  onShortcut(id: ShortcutId): void {
    if (this.playMode()) {
      return;
    }
    switch (id) {
```

4. Add the Play lifecycle and spawn methods. Insert them after `saveCurrentScene` (or anywhere in the class):

```ts
  /**
   * Resolves the effective spawn cell for a scene: the explicit spawnPoint,
   * or the scene center when none is set.
   * @param scene - The scene to resolve the spawn for.
   * @returns The spawn cell in grid coordinates.
   */
  private resolveSpawn(scene: Scene): { x: number; y: number } {
    return (
      scene.spawnPoint ?? { x: Math.floor(scene.width / 2), y: Math.floor(scene.height / 2) }
    );
  }

  /**
   * Enters Play mode: resets the player to the scene spawn and flips the
   * playMode signal so the canvas renders and follows the player.
   */
  enterPlay(): void {
    const scene = this.selectedScene();
    if (!scene) return;
    this.player.start(scene, this.resolveSpawn(scene));
    this.placeSpawnMode.set(false);
    this.playMode.set(true);
  }

  /**
   * Exits Play mode: stops the player and restores Edit behavior.
   */
  exitPlay(): void {
    this.playMode.set(false);
    this.player.stop();
  }

  /**
   * Toggles the "place spawn" tool on/off.
   */
  toggleSpawnTool(): void {
    this.placeSpawnMode.update((v) => !v);
  }

  /**
   * Persists a placed spawn point to the scene and clears the spawn tool.
   * @param cell - The grid cell chosen as the new spawn point.
   */
  async onSpawnPlaced(cell: { x: number; y: number }): Promise<void> {
    const scene = this.selectedScene();
    if (!scene) return;
    try {
      await this.sceneService.updateScene(scene.id, { spawnPoint: cell });
      this.selectedScene.update((s) => (s ? { ...s, spawnPoint: cell } : null));
      this.placeSpawnMode.set(false);
      this.notification.success('Spawn point set');
    } catch {
      this.notification.error('Failed to set the spawn point.');
    }
  }
```

Note: `Scene` is already imported as a type in this file (`import type { Scene, Layer } from '../../shared/models/scene.model';`).

5. Wire the new canvas inputs/outputs in the HTML. Edit `src/app/features/scene-editor/scene-editor.component.html`. First, replace the `rk-map-canvas` element to include the new bindings:

```html
<rk-map-canvas
  [scene]="selectedScene()"
  [layers]="sceneLayers()"
  [activeLayerId]="activeLayerId()"
  [selectedTileId]="selectedTileId()"
  [palette]="projectPalette()"
  [tileImages]="tileImages()"
  [tileSize]="projectTileSize()"
  [tileFootprints]="tileFootprints()"
  [tileAnimations]="tileAnimations()"
  [playMode]="playMode()"
  [placeSpawnMode]="placeSpawnMode()"
  [spawnPoint]="selectedScene()?.spawnPoint ?? null"
  (tilePlaced)="onTilePlaced($event)"
  (spawnPlaced)="onSpawnPlaced($event)"
/>
```

6. Replace the single floating grid-toggle `<button>` with a grouped toolbar that includes Play/Edit toggle and the spawn tool. Replace the current grid button block (lines ~43-49) with:

```html
<div class="tw-absolute tw-top-1 tw-right-1 tw-z-10 tw-flex tw-items-center tw-gap-1">
  <button
    class="tw-flex tw-items-center tw-justify-center tw-w-6 tw-h-6 tw-rounded-sm tw-bg-card-bg tw-border tw-border-border tw-text-foreground tw-cursor-pointer hover:tw-bg-accent"
    [title]="playMode() ? 'Exit play mode' : 'Enter play mode'"
    (click)="playMode() ? exitPlay() : enterPlay()"
  >
    <span class="material-symbols" aria-hidden="true"
      >{{ playMode() ? 'stop' : 'play_arrow' }}</span
    >
  </button>
  @if (!playMode()) {
  <button
    class="tw-flex tw-items-center tw-justify-center tw-w-6 tw-h-6 tw-rounded-sm tw-bg-card-bg tw-border tw-border-border tw-text-foreground tw-cursor-pointer hover:tw-bg-accent"
    [class.tw-bg-accent]="placeSpawnMode()"
    [title]="placeSpawnMode() ? 'Finish placing spawn' : 'Place spawn point'"
    (click)="toggleSpawnTool()"
  >
    <span class="material-symbols" aria-hidden="true">my_location</span>
  </button>
  }
  <button
    class="tw-flex tw-items-center tw-justify-center tw-w-6 tw-h-6 tw-rounded-sm tw-bg-card-bg tw-border tw-border-border tw-text-foreground tw-cursor-pointer hover:tw-bg-accent"
    [title]="mapCanvasRef()?.showGrid() ? 'Hide grid' : 'Show grid'"
    (click)="mapCanvasRef()?.showGrid.set(!mapCanvasRef()?.showGrid())"
  >
    <span class="material-symbols" aria-hidden="true">grid_on</span>
  </button>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test -- --include "**/scene-editor.component.spec.ts"` · strip devbox noise.
Expected: PASS (all existing + new SceneEditorComponent tests green).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/scene-editor.component.ts src/app/features/scene-editor/scene-editor.component.html src/app/features/scene-editor/scene-editor.component.spec.ts
git commit -m "feature-49: add Play/Edit toggle, spawn tool and shortcut guard to scene editor"
```

---

### Task 5: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `devbox run npm run test` · strip devbox noise.
Expected: all suites PASS.

- [ ] **Step 2: Run lint**

Run: `devbox run npm run lint` · strip devbox noise.
Expected: no errors.

- [ ] **Step 3: Run format check**

Run: `devbox run npm run format:check` · strip devbox noise.
Expected: no diffs. If diffs appear, run `devbox run npm run format` and commit the result.

- [ ] **Step 4: Run a production build**

Run: `devbox run npm run build`.
Expected: build succeeds within budget.

- [ ] **Step 5: Commit any formatting fixes**

```bash
git add -A
git commit -m "feature-49: apply formatting"
```

(only if Step 3 produced changes; otherwise skip)

---

## Self-Review notes

- **Spec coverage:** toggle button (HTML), player render above layers (canvas), camera follow (canvas), spawn default center + explicit + persistence + marker (editor + canvas), shortcuts suppressed in Play (editor guard), no session-position persistence (start resets each entry). All spec requirements map to a task.
- **Type consistency:** `PlayerController` signals/methods defined once in Task 2 and consumed identically in Tasks 3 and 4. `MapCanvasComponent` inputs (`playMode`, `placeSpawnMode`, `spawnPoint`) + output (`spawnPlaced`) defined in Task 3 and bound in Task 4. `Scene.spawnPoint` defined in Task 1, used in Tasks 1/4.
- **Out of scope maintained:** no collisions (#51), no interactables (#52), no Y-sort (#53/54/55), no real avatar (#56), no portals/dialogues/state, no position persistence across sessions.
