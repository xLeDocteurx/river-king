# #51-a Cell-Level Blocking Tile Collision — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make blocking tiles physically stop the player in Play mode — axis-separated AABB-vs-grid resolution with wall sliding, using the fixed 0.5×0.5 centered hitbox — and render the 1×1 placeholder centered on the player position.

**Architecture:** A pure function module `collision.ts` (build tanking grid + resolver), held and consumed by `PlayerController`. `SceneEditorComponent.enterPlay()` derives per-tile blocking flags from `projectTiles()` and passes them plus footprints to `player.start(...)`. The resolver treats out-of-scene cells as blocked, which replaces the old `Math.min/max` bounds clamp.

**Tech Stack:** TypeScript ~6.0, Angular 22 standalone, signals, Vitest (via `@angular/build:unit-test`), pure TS modules pattern (like `map-footprint.ts`).

Spec: `docs/superpowers/specs/2026-09-04-cell-blocking-collision-design.md`

## Global Constraints

- Hitbox is a fixed 0.5×0.5 cell AABB centered on the player position → half-extent `0.25`.
- Player position (`x`/`y` signals) is the **center**; spawn starts at `spawn + 0.5`.
- Out-of-scene cells are treated as blocked; the center is effectively clamped to `[0.25, width-0.25] × [0.25, height-0.25]`.
- Only layers with `visible === true` contribute to collision, regardless of opacity (`0` included).
- A blocking tile blocks its FULL grid-cell footprint.
- Every public function/type gets a JSDoc block (`@param`, `@returns`).
- Run tests as `devbox run npm run test -- --watch=false`; run lint as `devbox run npm run lint`.
- Commit prefix: `feature-51:`.
- No backticks in `gh` command bodies (the shell runs the args unquoted).

---

### Task 1: Pure collision module (`collision.ts`)

**Files:**
- Create: `src/app/features/scene-editor/collision.ts`
- Test: `src/app/features/scene-editor/collision.spec.ts`

**Interfaces:**
- Consumes: `Layer` (`src/app/shared/models/scene.model.ts`, fields `visible`, `tileData`), `getFootprint`/`TileFootprintMap` (`./map-footprint`).
- Produces:
  - `export const HALF_CELL_HITBOX = 0.25`
  - `export function buildBlockingGrid(width: number, height: number, layers: Layer[], blockingById: Map<number, boolean>, footprints: TileFootprintMap): boolean[][]` — grid indexed `grid[y][x]`.
  - `export function resolveCollision(pos: { x: number; y: number }, move: { x: number; y: number }, half: number, grid: boolean[][], bounds: { width: number; height: number }): { x: number; y: number }`

- [ ] **Step 1: Write the failing test**

Create `src/app/features/scene-editor/collision.spec.ts`:

```ts
import { buildBlockingGrid, resolveCollision, HALF_CELL_HITBOX } from './collision';
import type { Layer } from '../../shared/models/scene.model';
import type { TileFootprintMap } from './map-footprint';

function layer(tileData: number[][], visible = true, opacity = 1): Layer {
  return { id: 'l', name: 'l', visible, opacity, tileData };
}

describe('buildBlockingGrid', () => {
  const blocking = new Map<number, boolean>([[1, true]]);

  it('produces a height x width grid of walkable cells for an empty scene', () => {
    const grid = buildBlockingGrid(3, 2, [], new Map(), {});
    expect(grid).toEqual([
      [false, false, false],
      [false, false, false],
    ]);
  });

  it('marks blocking tiles and leaves non-blocking tiles walkable', () => {
    const grid = buildBlockingGrid(3, 1, [layer([[1, 2, -1]])], blocking, {});
    expect(grid[0]).toEqual([true, false, false]);
  });

  it('ignores hidden layers', () => {
    const grid = buildBlockingGrid(3, 1, [layer([[1, -1, -1]], false)], blocking, {});
    expect(grid[0]).toEqual([false, false, false]);
  });

  it('blocks through visible layers even at 0% opacity', () => {
    const grid = buildBlockingGrid(3, 1, [layer([[1, -1, -1]], true, 0)], blocking, {});
    expect(grid[0]).toEqual([true, false, false]);
  });

  it('blocks the full footprint of multi-cell tiles', () => {
    const footprints: TileFootprintMap = { 1: { w: 2, h: 2 } };
    const scene = [
      [-1, -1, -1, -1],
      [-1, 1, -1, -1],
      [-1, -1, -1, -1],
      [-1, -1, -1, -1],
    ];
    const grid = buildBlockingGrid(4, 4, [layer(scene)], blocking, footprints);
    expect(grid[1][1]).toBe(true);
    expect(grid[1][2]).toBe(true);
    expect(grid[2][1]).toBe(true);
    expect(grid[2][2]).toBe(true);
    expect(grid[0][0]).toBe(false);
  });
});

describe('resolveCollision', () => {
  const bounds = { width: 5, height: 5 };
  const free = buildBlockingGrid(5, 5, [], new Map(), {});
  const half = HALF_CELL_HITBOX;

  function wallGrid(): boolean[][] {
    const grid = buildBlockingGrid(5, 5, [], new Map(), {});
    for (let y = 0; y < 5; y++) grid[y][2] = true;
    return grid;
  }

  it('returns the requested position when nothing blocks the path', () => {
    expect(resolveCollision({ x: 2, y: 2 }, { x: 0.5, y: 0.5 }, half, free, bounds)).toEqual({
      x: 2.5,
      y: 2.5,
    });
  });

  it('stops the player before a perpendicular wall', () => {
    expect(resolveCollision({ x: 1.5, y: 1.5 }, { x: 1, y: 0 }, half, wallGrid(), bounds)).toEqual({
      x: 1.75,
      y: 1.5,
    });
  });

  it('slides along a wall instead of stopping when moving diagonally', () => {
    expect(resolveCollision({ x: 1.5, y: 1.5 }, { x: 0.5, y: 0.5 }, half, wallGrid(), bounds)).toEqual({
      x: 1.75,
      y: 2,
    });
  });

  it('does not tunnel through a wall even with a large delta', () => {
    expect(resolveCollision({ x: 1.5, y: 1.5 }, { x: 5, y: 0 }, half, wallGrid(), bounds)).toEqual({
      x: 1.75,
      y: 1.5,
    });
  });

  it('clamps the center inside the scene bounds via blocked out-of-scene cells', () => {
    expect(resolveCollision({ x: 0.5, y: 0.5 }, { x: -5, y: 0 }, half, free, bounds)).toEqual({
      x: 0.25,
      y: 0.5,
    });
    expect(resolveCollision({ x: 4.5, y: 4.5 }, { x: 0, y: 5 }, half, free, bounds)).toEqual({
      x: 4.5,
      y: 4.75,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `devbox run npm run test -- --watch=false`
Expected: FAIL — `Cannot find module './collision'` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/app/features/scene-editor/collision.ts`:

```ts
import type { Layer } from '../../shared/models/scene.model';
import { getFootprint, type TileFootprintMap } from './map-footprint';

/** Half-extent of the fixed 0.5x0.5 player hitbox, in grid cells. */
export const HALF_CELL_HITBOX = 0.25;

/**
 * Builds a 2D boolean grid marking which cells block player movement.
 * Only layers with `visible === true` contribute; blocking tiles mark their full
 * grid-cell footprint. Returns a `height x width` array of booleans (`grid[y][x]`).
 *
 * @param width - Scene width in cells.
 * @param height - Scene height in cells.
 * @param layers - Scene layers; only the visibility flag is read.
 * @param blockingById - Map of tile id -> blocking flag.
 * @param footprints - Grid-cell footprint per tile id (absent -> 1x1).
 * @returns The blocking grid; out-of-scene cells are treated as blocked by the resolver.
 */
export function buildBlockingGrid(
  width: number,
  height: number,
  layers: Layer[],
  blockingById: Map<number, boolean>,
  footprints: TileFootprintMap,
): boolean[][] {
  const grid: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    grid.push(new Array<boolean>(width).fill(false));
  }
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (let y = 0; y < layer.tileData.length; y++) {
      const row = layer.tileData[y];
      for (let x = 0; x < row.length; x++) {
        const tileId = row[x];
        if (tileId < 0 || !blockingById.get(tileId)) continue;
        const { w, h } = getFootprint(tileId, footprints);
        for (let fy = y; fy < y + h && fy < height; fy++) {
          for (let fx = x; fx < x + w && fx < width; fx++) {
            grid[fy][fx] = true;
          }
        }
      }
    }
  }
  return grid;
}

/**
 * Resolves a player movement against the blocking grid, axis-separated (X first,
 * then Y), sweeping the leading AABB edge cell by cell so the player never
 * tunnels through a blocking tile. A cell counts as overlapped only when the AABB
 * crosses its interior, so an edge flush against a wall does not block sliding.
 * When an axis is unobstructed the full delta is applied on that axis.
 *
 * @param pos - Current center position in grid cells (fractional).
 * @param move - Requested delta this frame, in cells (X then Y are independent).
 * @param half - Hitbox half-extent.
 * @param grid - Blocking grid from `buildBlockingGrid`.
 * @param bounds - Scene size in cells; cells outside are treated as blocked.
 * @returns The resolved center position.
 */
export function resolveCollision(
  pos: { x: number; y: number },
  move: { x: number; y: number },
  half: number,
  grid: boolean[][],
  bounds: { width: number; height: number },
): { x: number; y: number } {
  let x = pos.x;
  let y = pos.y;

  /** A cell is blocked when it is in the grid and true, or outside the scene. */
  const blocked = (col: number, row: number): boolean => {
    if (col < 0 || row < 0 || col >= bounds.width || row >= bounds.height) return true;
    const rowCells = grid[row];
    return rowCells !== undefined && rowCells[col];
  };

  // Rows of the blocking grid strictly overlapped by the vertical AABB span
  // [y-half, y+half]; a flush edge (span ending on an integer) excludes that cell.
  const topRow = Math.floor(y - half - 1) + 1;
  const bottomRow = Math.ceil(y + half) - 1;

  let hitX = false;
  if (move.x > 0) {
    // ceil() start (not floor(x+half)+1) makes a flush right edge re-check the
    // wall cell it is pressed against, preventing tunneling on the next frame.
    const newRight = x + move.x + half;
    for (let col = Math.ceil(x + half); col <= Math.floor(newRight); col++) {
      if (newRight <= col) break;
      let cellHit = false;
      for (let row = topRow; row <= bottomRow; row++) {
        if (blocked(col, row)) {
          x = col - half;
          hitX = true;
          cellHit = true;
          break;
        }
      }
      if (cellHit) break;
    }
  } else if (move.x < 0) {
    const newLeft = x + move.x - half;
    for (let col = Math.floor(x - half) - 1; col >= Math.floor(newLeft); col--) {
      if (newLeft >= col + 1) continue;
      let cellHit = false;
      for (let row = topRow; row <= bottomRow; row++) {
        if (blocked(col, row)) {
          x = col + 1 + half;
          hitX = true;
          cellHit = true;
          break;
        }
      }
      if (cellHit) break;
    }
  }
  if (!hitX) x += move.x;

  // Columns strictly overlapped by the resolved horizontal AABB span.
  const leftCol = Math.floor(x - half - 1) + 1;
  const rightCol = Math.ceil(x + half) - 1;

  let hitY = false;
  if (move.y > 0) {
    // ceil() start (not floor(y+half)+1) makes a flush bottom edge re-check the
    // wall cell it is pressed against, preventing tunneling on the next frame.
    const newBottom = y + move.y + half;
    for (let row = Math.ceil(y + half); row <= Math.floor(newBottom); row++) {
      if (newBottom <= row) break;
      let cellHit = false;
      for (let col = leftCol; col <= rightCol; col++) {
        if (blocked(col, row)) {
          y = row - half;
          hitY = true;
          cellHit = true;
          break;
        }
      }
      if (cellHit) break;
    }
  } else if (move.y < 0) {
    const newTop = y + move.y - half;
    for (let row = Math.floor(y - half) - 1; row >= Math.floor(newTop); row--) {
      if (newTop >= row + 1) continue;
      let cellHit = false;
      for (let col = leftCol; col <= rightCol; col++) {
        if (blocked(col, row)) {
          y = row + 1 + half;
          hitY = true;
          cellHit = true;
          break;
        }
      }
      if (cellHit) break;
    }
  }
  if (!hitY) y += move.y;

  return { x, y };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `devbox run npm run test -- --watch=false`
Expected: PASS (collision suite green; unrelated suites may run too).

- [ ] **Step 5: Format and commit**

```bash
devbox run npx prettier --write src/app/features/scene-editor/collision.ts src/app/features/scene-editor/collision.spec.ts
git add src/app/features/scene-editor/collision.ts src/app/features/scene-editor/collision.spec.ts
git commit -m "feature-51: add pure blocking-grid and collision-resolution module"
```

---

### Task 2: Center-player semantics and runtime collision in `PlayerController`

**Files:**
- Modify: `src/app/features/scene-editor/services/play-controller.ts`
- Modify: `src/app/features/scene-editor/services/play-controller.spec.ts`
- Modify: `src/app/features/scene-editor/map-canvas.component.ts:311-322` (player placeholder render)
- Modify: `src/app/features/scene-editor/map-canvas.component.spec.ts:251,289` (start() call arguments)

**Interfaces:**
- Consumes (from Task 1): `buildBlockingGrid`, `resolveCollision`, `HALF_CELL_HITBOX`.
- Produces: `start(scene: { width: number; height: number; layers: Layer[] }, spawn: { x: number; y: number }, blockingById: Map<number, boolean>, footprints: TileFootprintMap): void` — centers the player at `spawn + 0.5` and precomputes the blocking grid. `update(dt)` resolves via `resolveCollision` instead of clamping to `[0, size-1]`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/app/features/scene-editor/services/play-controller.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { PlayerController } from './play-controller';
import type { Layer } from '../../../shared/models/scene.model';

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function release(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

function emptyScene(width: number, height: number): { width: number; height: number; layers: Layer[] } {
  return { width, height, layers: [] };
}

/** 4x4 scene with a blocking wall on column 2 (rows 0..3), tile id 0. */
function wallScene(): { width: number; height: number; layers: Layer[] } {
  const row = [-1, -1, 0, -1];
  return {
    width: 4,
    height: 4,
    layers: [
      {
        id: 'l1',
        name: 'wall',
        visible: true,
        opacity: 1,
        tileData: [row, [...row], [...row], [...row]],
      },
    ],
  };
}

const WALL = new Map<number, boolean>([[0, true]]);

describe('PlayerController', () => {
  let player: PlayerController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PlayerController] });
    player = TestBed.inject(PlayerController);
  });

  afterEach(() => {
    player.stop();
  });

  it('starts centered on the given spawn cell', () => {
    player.start(emptyScene(10, 10), { x: 3, y: 4 }, new Map(), {});
    expect(player.x()).toBe(3.5);
    expect(player.y()).toBe(4.5);
  });

  it('moves up when W is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {});
    press('w');
    player.update(1);
    expect(player.x()).toBe(5.5);
    expect(player.y()).toBeLessThan(5.5);
  });

  it('moves right when arrow-right is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {});
    press('ArrowRight');
    player.update(1);
    expect(player.x()).toBeGreaterThan(5.5);
    expect(player.y()).toBe(5.5);
  });

  it('normalizes diagonal movement so speed is not boosted', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {});
    player.speed = 1;
    press('d');
    press('s');
    player.update(1);
    expect(player.x()).toBeCloseTo(0.5 + Math.SQRT1_2, 5);
    expect(player.y()).toBeCloseTo(0.5 + Math.SQRT1_2, 5);
  });

  it('scales movement by dt', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {});
    player.speed = 4;
    press('d');
    player.update(0.5); // half a second -> 2 cells from the centered start (2.5)
    expect(player.x()).toBeCloseTo(2.5, 5);
  });

  it('clamps the player inside the scene bounds', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {});
    press('a');
    player.update(100);
    expect(player.x()).toBe(0.25);
  });

  it('sets direction and moving state from input', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {});
    press('a');
    player.update(0.1);
    expect(player.direction()).toBe('left');
    expect(player.moving()).toBe(true);
    release('a');
    player.update(0.1);
    expect(player.moving()).toBe(false);
  });

  it('does not move when no key is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {});
    player.update(1);
    expect(player.x()).toBe(5.5);
    expect(player.y()).toBe(5.5);
    expect(player.moving()).toBe(false);
  });

  it('stops when walking into a blocking tile', () => {
    player.start(wallScene(), { x: 1, y: 1 }, WALL, {});
    press('d');
    player.update(1);
    expect(player.x()).toBe(1.75);
    expect(player.y()).toBe(1.5);
  });

  it('slides along a blocking wall when moving diagonally', () => {
    player.start(wallScene(), { x: 1, y: 1 }, WALL, {});
    press('d');
    press('s');
    player.update(0.5);
    expect(player.x()).toBe(1.75);
    expect(player.y()).toBeCloseTo(1.5 + Math.SQRT1_2 * 5 * 0.5, 3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npm run test -- --watch=false`
Expected: FAIL — TypeScript errors (`start` called with 4 args, `update` still uses bounds clamp, position assertions like `3.5` fail).

- [ ] **Step 3: Implement the controller changes**

Edit `src/app/features/scene-editor/services/play-controller.ts`:

- Add imports (top of file):

```ts
import type { Layer } from '../../../shared/models/scene.model';
import { buildBlockingGrid, resolveCollision, HALF_CELL_HITBOX } from '../collision';
import type { TileFootprintMap } from '../map-footprint';
```

- Add a private field next to `sceneHeight`:

```ts
  private sceneHeight = 0;
  private blockingGrid: boolean[][] = [];
```

- Replace the `start` method body and JSDoc with:

```ts
  /**
   * Begins a Play session: attaches input listeners, builds the blocking grid
   * from the scene's visible layers, and resets the player to the given spawn
   * cell (position signals hold the center, offset by half a cell).
   * @param scene - The scene being played, with its width/height bounds and layers.
   * @param spawn - The spawn cell to start at (the player centers on it).
   * @param blockingById - Per-tile blocking flags.
   * @param footprints - Grid-cell footprint per tile id.
   */
  start(
    scene: { width: number; height: number; layers: Layer[] },
    spawn: { x: number; y: number },
    blockingById: Map<number, boolean>,
    footprints: TileFootprintMap,
  ): void {
    this.sceneWidth = scene.width;
    this.sceneHeight = scene.height;
    this.blockingGrid = buildBlockingGrid(
      scene.width,
      scene.height,
      scene.layers,
      blockingById,
      footprints,
    );
    this.x.set(spawn.x + 0.5);
    this.y.set(spawn.y + 0.5);
    this.direction.set('down');
    this.moving.set(false);
    this.held.clear();
    if (!this.listenersActive) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.listenersActive = true;
    }
  }
```

- Replace the two signal-update lines in `update(dt)` (the `Math.max(0, Math.min(...))` lines) with a collision-resolved move:

```ts
    const resolved = resolveCollision(
      { x: this.x(), y: this.y() },
      { x: dx * this.speed * dt, y: dy * this.speed * dt },
      HALF_CELL_HITBOX,
      this.blockingGrid,
      { width: this.sceneWidth, height: this.sceneHeight },
    );
    this.x.set(resolved.x);
    this.y.set(resolved.y);
```

- Update the `update` JSDoc: change "clamping to scene bounds" to "resolving against the blocking grid (out-of-scene cells block)".

- [ ] **Step 4: Update the player placeholder render in `map-canvas.component.ts`**

In `src/app/features/scene-editor/map-canvas.component.ts:311-322`, change the two `ctx.fillRect(...)`/`ctx.strokeRect(...)` calls so the 1×1 box is centered on the player position (position is now the center):

```ts
      ctx.fillRect((px - 0.5) * cell, (py - 0.5) * cell, cell, cell);
```

and

```ts
      ctx.strokeRect((px - 0.5) * cell, (py - 0.5) * cell, cell, cell);
```

- [ ] **Step 5: Update the `player.start` calls in `map-canvas.component.spec.ts`**

At line 251 and line 289, replace:
`player.start({ width: 4, height: 4 }, { x: 1, y: 2 });`
with:
`player.start({ width: 4, height: 4, layers: [] }, { x: 1, y: 2 }, new Map(), {});`

And at line 289, replace:
`player.start({ width: 4, height: 4 }, { x: 2, y: 2 });`
with:
`player.start({ width: 4, height: 4, layers: [] }, { x: 2, y: 2 }, new Map(), {});`

The existing render assertion (`fillRect` called with `16, 32, 16, 16`) stays valid: centered spawn at `(1.5, 2.5)` renders the 1×1 box at `(16, 32)` after the Step 4 change.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `devbox run npm run test -- --watch=false`
Expected: PASS — the previously failing PlayerController assertions now hold, the wall-stop and slide tests pass, and map-canvas render/follow tests are green.

- [ ] **Step 7: Format and commit**

```bash
devbox run npx prettier --write src/app/features/scene-editor/services/play-controller.ts src/app/features/scene-editor/services/play-controller.spec.ts src/app/features/scene-editor/map-canvas.component.ts src/app/features/scene-editor/map-canvas.component.spec.ts
git add src/app/features/scene-editor/services/play-controller.ts src/app/features/scene-editor/services/play-controller.spec.ts src/app/features/scene-editor/map-canvas.component.ts src/app/features/scene-editor/map-canvas.component.spec.ts
git commit -m "feature-51: center player position and resolve movement against blocking grid"
```

---

### Task 3: Wire blocking flags into Play mode entry

**Files:**
- Modify: `src/app/features/scene-editor/scene-editor.component.ts:274-284` (`enterPlay`)
- Modify: `src/app/features/scene-editor/scene-editor.component.spec.ts`

**Interfaces:**
- Consumes: `player.start(scene, spawn, blockingById, footprints)` (Task 2), `projectTiles()` signal (`Tile[]`), `tileFootprints()` signal (`TileFootprintMap`).
- Produces: `enterPlay()` passes a `Map<number, boolean>` of tileId → `properties.blocking` built from `projectTiles()`.

- [ ] **Step 1: Write the failing tests**

Edit `src/app/features/scene-editor/scene-editor.component.spec.ts`:

- Add imports after the existing `Scene` import (line 16):

```ts
import type { Tile } from '../../shared/models/tile.model';
import type { TileFootprintMap } from './map-footprint';
```

- Update the two existing `enterPlay` assertions to the new `start` argument list:

Replace `expect(startSpy).toHaveBeenCalledWith(scene, { x: 4, y: 3 });` with:
`expect(startSpy).toHaveBeenCalledWith(scene, { x: 4, y: 3 }, expect.any(Map), {});`

Replace `expect(startSpy).toHaveBeenCalledWith(stored, { x: 1, y: 2 });` with:
`expect(startSpy).toHaveBeenCalledWith(stored, { x: 1, y: 2 }, expect.any(Map), {});`

- Add a new test right after the "enters Play mode at an explicit stored spawn point" test:

```ts
  it('passes per-tile blocking flags and footprints to the player on enterPlay', async () => {
    const wallId = await db.tiles.add({
      projectId: 'p1',
      name: 'wall',
      type: 'static',
      spriteIds: [],
      animationSpeed: 1,
      properties: { blocking: true, interactable: false },
    } as Tile);
    const floorId = await db.tiles.add({
      projectId: 'p1',
      name: 'floor',
      type: 'static',
      spriteIds: [],
      animationSpeed: 1,
      properties: { blocking: false, interactable: false },
    } as Tile);

    fixture.detectChanges();
    await fixture.whenStable();
    const scene = await sceneService.createScene('p1', 'Play', 8, 6);
    await component.selectScene(scene.id);
    const player = fixture.debugElement.injector.get(PlayerController);
    const startSpy = vi.spyOn(player, 'start');

    component.enterPlay();

    expect(startSpy).toHaveBeenCalledTimes(1);
    const [, , blockingById, footprints] = startSpy.mock.calls[0] as [
      Scene,
      { x: number; y: number },
      Map<number, boolean>,
      TileFootprintMap,
    ];
    expect(blockingById.size).toBe(2);
    expect(blockingById.get(wallId)).toBe(true);
    expect(blockingById.get(floorId)).toBe(false);
    expect(footprints).toEqual({});
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npm run test -- --watch=false`
Expected: FAIL — the existing `toHaveBeenCalledWith` comparisons mismatch (extra args) and the new test hits a type error until `enterPlay` is updated.

- [ ] **Step 3: Implement the `enterPlay` change**

Replace the `enterPlay()` body in `src/app/features/scene-editor/scene-editor.component.ts` with:

```ts
  enterPlay(): void {
    const scene = this.selectedScene();
    if (!scene) return;
    const blockingById = new Map(this.projectTiles().map((t) => [t.id, t.properties.blocking]));
    this.player.start(scene, this.resolveSpawn(scene), blockingById, this.tileFootprints());
    this.playMode.set(true);
    this.placeSpawnMode.set(false);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npm run test -- --watch=false`
Expected: PASS — full suite green.

- [ ] **Step 5: Lint, format, and commit**

```bash
devbox run npm run lint
devbox run npm run format
git add src/app/features/scene-editor/scene-editor.component.ts src/app/features/scene-editor/scene-editor.component.spec.ts
git commit -m "feature-51: pass per-tile blocking flags into play mode"
```

Note: `devbox run npm run format` formats the whole repo; if it touches unrelated files, stage only the two files above in the commit.