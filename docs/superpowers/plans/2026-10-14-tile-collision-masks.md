# Tile Collision Masks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give blocking tiles an optional per-pixel collision mask that can be painted in the tile editor and is sampled by the runtime player hitbox, falling back to full-footprint blocking when no mask exists.

**Architecture:** Add `collisionMask?: number[][] | null` to `Tile`. Replace the scene-editor's boolean blocking grid with a `CollisionField` (`full` boolean grid + per-cell `sub` rects from masks). `resolveCollision` gains an optional `sub` argument; when omitted it keeps the exact #51 behaviour. The play controller builds the field once at `start`. The pixel canvas gains a `collisionMask` input/output and two paint tools; the sprite editor loads, debounces-persists, and resets the mask.

**Tech Stack:** Angular 22 (standalone, OnPush, signals), TypeScript, Tailwind (`tw-` prefix), Vitest + jsdom, Dexie (IndexedDB).

## Global Constraints

- Angular 22 standalone components only; `ChangeDetectionStrategy.OnPush`; signals for state.
- Never inline templates — every component has `templateUrl` + `styleUrl`.
- Tailwind classes must use the `tw-` prefix; colors via theme tokens only (no raw hex except canvas overlays which have no CSS token).
- Material Symbols icons only: `<span class="material-symbols" aria-hidden="true">icon</span>`.
- UI copy is English only. Max radius `tw-rounded-sm`.
- Every public method/class/model property needs a JSDoc block.
- Do **not** bump `PROJECT_ARCHIVE_VERSION` (stays `1`); `collisionMask` is an additive optional archive field.
- The existing `collision.spec.ts` #51 tests MUST stay green (backward-compatible `resolveCollision`).
- Run all commands through `devbox run` (bare `ng`/`npm` may fail in this environment).

---

### Task 1: Tile model + project archive persistence

**Files:**

- Modify: `src/app/shared/models/tile.model.ts`
- Modify: `src/app/shared/models/project-archive.model.ts`
- Modify: `src/app/core/services/project-io.service.ts`
- Test: `src/app/core/services/project-io.service.spec.ts`

**Interfaces:**

- Consumes: existing `Tile`, `TileArchiveItem`, `ProjectIoService.exportProject/importProject`.
- Produces: `Tile.collisionMask?: number[][] | null`; `TileArchiveItem.collisionMask?: number[][]`.

- [ ] **Step 1: Write the failing tests**

Add these two tests to `src/app/core/services/project-io.service.spec.ts` immediately after the `'round-trips a stored anchor'` test (around line 384):

```ts
it('round-trips a stored collision mask', async () => {
  const { projectId, groundId } = await seedProject();
  const mask = [
    [1, 0],
    [0, 1],
  ];
  await db.tiles.update(groundId, { collisionMask: mask });
  const json = await service.exportProject(projectId);
  const result = await service.importProject(json, { kind: 'new' });
  const imported = await db.tiles.where('projectId').equals(result.projectId).toArray();
  const ground = imported.find((t) => t.name === 'Ground');
  expect(ground?.collisionMask).toEqual(mask);
});

it('drops a malformed collision mask on import', async () => {
  const json = validJsonOverrides({
    tiles: [{ ...validTile(), collisionMask: 'nope' as unknown as number[][] }],
  });
  const result = await service.importProject(json, { kind: 'new' });
  const imported = await db.tiles.where('projectId').equals(result.projectId).toArray();
  expect(imported[0].collisionMask).toBeUndefined();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npx ng test --watch=false --include='**/project-io.service.spec.ts'`
Expected: FAIL — TypeScript error `Property 'collisionMask' does not exist on type 'Tile'` (or the round-trip assertion fails).

- [ ] **Step 3a: Add the field to `Tile`**

In `src/app/shared/models/tile.model.ts`, after the `anchor` property (before the closing brace of `Tile`):

```ts
  /**
   * Optional per-pixel collision mask shared by all frames (`1` = solid,
   * `0`/absent = passable; row-major `[y][x]`). Dimensions match the frame
   * artwork and are scaled onto the tile's grid footprint. When absent or
   * `null`, the tile blocks its entire footprint.
   */
  collisionMask?: number[][] | null;
```

- [ ] **Step 3b: Add the field to `TileArchiveItem`**

In `src/app/shared/models/project-archive.model.ts`, after the `anchor` property of `TileArchiveItem`:

```ts
  /**
   * Optional per-pixel collision mask (see `Tile.collisionMask`). Omitted when
   * the tile has no mask.
   */
  collisionMask?: number[][];
```

- [ ] **Step 3c: Export the field**

In `src/app/core/services/project-io.service.ts`, in the `tiles.map` of `exportProject` (after the `anchor:` line, ~line 102):

```ts
        collisionMask: t.collisionMask ?? undefined,
```

- [ ] **Step 3d: Import the field defensively**

In `src/app/core/services/project-io.service.ts`, add a module-level helper after `isRecord` (~line 55):

```ts
/**
 * Validates a collision mask read from an archive, dropping malformed values.
 * @param value - Raw value from the archive tile item.
 * @returns A row-major numeric grid, or undefined when the shape is invalid.
 */
function normalizeCollisionMask(value: unknown): number[][] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  if (!value.every((row) => Array.isArray(row))) return undefined;
  return value as number[][];
}
```

Then in the tile-creation object inside `importProject` (~line 198, after `anchor: t.anchor,`):

```ts
            collisionMask: normalizeCollisionMask(t.collisionMask),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npx ng test --watch=false --include='**/project-io.service.spec.ts'`
Expected: PASS (including the pre-existing archive tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/models/tile.model.ts src/app/shared/models/project-archive.model.ts src/app/core/services/project-io.service.ts src/app/core/services/project-io.service.spec.ts
git commit -m "feature-58: persist the tile collision mask through the project archive"
```

---

### Task 2: Collision field + masked resolver

**Files:**

- Modify: `src/app/features/scene-editor/collision.ts`
- Test: `src/app/features/scene-editor/collision.spec.ts`

**Interfaces:**

- Consumes: `getFootprint`, `TileFootprintMap`, `Layer`.
- Produces: `CellRect`, `TileCollision`, `CollisionField`, `buildCollisionField(width,height,layers,tiles,footprints)`, and `resolveCollision(pos, move, half, grid, bounds, sub?)`.
- The existing `buildBlockingGrid` signature is unchanged (now delegates).

- [ ] **Step 1: Write the failing tests**

In `src/app/features/scene-editor/collision.spec.ts`, change the import line to:

```ts
import {
  buildBlockingGrid,
  buildCollisionField,
  resolveCollision,
  HALF_CELL_HITBOX,
  type CellRect,
} from './collision';
```

Append two new `describe` blocks at the end of the file:

```ts
describe('buildCollisionField', () => {
  it('marks unmasked blocking tiles over their full footprint', () => {
    const field = buildCollisionField(
      3,
      1,
      [layer([[1, -1, -1]])],
      new Map([[1, { blocking: true }]]),
      {},
    );
    expect(field.full[0]).toEqual([true, false, false]);
    expect(field.sub[0]).toEqual([null, null, null]);
  });

  it('maps solid mask pixels to sub-cell rects and leaves empty pixels walkable', () => {
    const mask = [
      [1, 0],
      [0, 1],
    ];
    const field = buildCollisionField(
      1,
      1,
      [layer([[1]])],
      new Map([[1, { blocking: true, mask }]]),
      {},
    );
    expect(field.full[0][0]).toBe(false);
    const rects = field.sub[0][0]!;
    expect(rects).toHaveLength(2);
    expect(rects).toContainEqual({ x0: 0, y0: 0, x1: 0.5, y1: 0.5 });
    expect(rects).toContainEqual({ x0: 0.5, y0: 0.5, x1: 1, y1: 1 });
  });

  it('treats an all-zero mask as fully passable', () => {
    const field = buildCollisionField(
      1,
      1,
      [layer([[1]])],
      new Map([
        [
          1,
          {
            blocking: true,
            mask: [
              [0, 0],
              [0, 0],
            ],
          },
        ],
      ]),
      {},
    );
    expect(field.full[0][0]).toBe(false);
    expect(field.sub[0][0]).toBeNull();
  });
});

describe('resolveCollision with masked sub-rects', () => {
  const bounds = { width: 3, height: 1 };
  const half = HALF_CELL_HITBOX;
  const emptyGrid = buildBlockingGrid(3, 1, [], new Map(), {});

  function subGrid(): (CellRect[] | null)[][] {
    return [[null, [{ x0: 1, y0: 0, x1: 1.5, y1: 0.5 }], null]];
  }

  it('passes through a masked cell when the hitbox misses the solid pixel', () => {
    // Player center y=0.75 -> span [0.5,1.0]; solid rect occupies y [0,0.5] only.
    expect(
      resolveCollision({ x: 0.5, y: 0.75 }, { x: 1, y: 0 }, half, emptyGrid, bounds, subGrid()),
    ).toEqual({ x: 1.5, y: 0.75 });
  });

  it('stops at a masked cell when the hitbox overlaps the solid pixel', () => {
    // Player center y=0.25 -> span [0,0.5], which overlaps the solid rect.
    expect(
      resolveCollision({ x: 0.5, y: 0.25 }, { x: 1, y: 0 }, half, emptyGrid, bounds, subGrid()),
    ).toEqual({ x: 0.75, y: 0.25 });
  });

  it('keeps the #51 behaviour when no sub-rects are provided', () => {
    const wall = buildBlockingGrid(3, 1, [], new Map(), {});
    wall[0][1] = true;
    expect(resolveCollision({ x: 0.5, y: 0.5 }, { x: 1, y: 0 }, half, wall, bounds)).toEqual({
      x: 0.75,
      y: 0.5,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npx ng test --watch=false --include='**/collision.spec.ts'`
Expected: FAIL — `buildCollisionField` is not exported / `resolveCollision` cannot take a 6th argument.

- [ ] **Step 3a: Add the types and field builder**

In `src/app/features/scene-editor/collision.ts`, add after `HALF_CELL_HITBOX`:

```ts
/** A solid sub-rectangle inside one grid cell, in world (cell) coordinates. */
export interface CellRect {
  /** Left edge (inclusive). */
  x0: number;
  /** Top edge (inclusive). */
  y0: number;
  /** Right edge (exclusive). */
  x1: number;
  /** Bottom edge (exclusive). */
  y1: number;
}

/** Per-tile collision inputs consumed by the field builder. */
export interface TileCollision {
  /** Blocks movement (from `Tile.properties.blocking`). */
  blocking: boolean;
  /** Optional per-pixel mask; absent/`null` blocks the full footprint. */
  mask?: number[][] | null;
}

/** The resolved collision field for a scene. */
export interface CollisionField {
  /** Full-cell blocking contributed by unmasked blocking tiles. */
  full: boolean[][];
  /** Per-cell solid sub-rects from masked blocking tiles (`null` when none). */
  sub: (CellRect[] | null)[][];
}

/**
 * Builds the collision field for a scene. Only visible layers contribute
 * (opacity is ignored). Unmasked blocking tiles fill their whole footprint;
 * masked blocking tiles contribute one sub-rect per solid (`>=1`) mask pixel,
 * bucketed into the grid cell that contains it. Out-of-scene cells are treated
 * as blocked by the resolver.
 *
 * @param width - Scene width in cells.
 * @param height - Scene height in cells.
 * @param layers - Scene layers; only the visibility flag is read.
 * @param tiles - Per-tile blocking flag and optional mask.
 * @param footprints - Grid-cell footprint per tile id (absent -> 1x1).
 * @returns The resolved collision field.
 */
export function buildCollisionField(
  width: number,
  height: number,
  layers: Layer[],
  tiles: Map<number, TileCollision>,
  footprints: TileFootprintMap,
): CollisionField {
  const full: boolean[][] = [];
  const sub: (CellRect[] | null)[][] = [];
  for (let y = 0; y < height; y++) {
    full.push(new Array<boolean>(width).fill(false));
    sub.push(new Array<CellRect[] | null>(width).fill(null));
  }
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (let y = 0; y < layer.tileData.length; y++) {
      const row = layer.tileData[y];
      for (let x = 0; x < row.length; x++) {
        const tileId = row[x];
        const info = tiles.get(tileId);
        if (tileId < 0 || !info?.blocking) continue;
        const { left, up, right, down } = getFootprint(tileId, footprints);
        const mask = info.mask;
        const maskW = mask?.[0]?.length ?? 0;
        if (!mask || mask.length === 0 || maskW === 0) {
          for (let fy = y - up; fy <= y + down; fy++) {
            if (fy < 0 || fy >= height) continue;
            for (let fx = x - left; fx <= x + right; fx++) {
              if (fx < 0 || fx >= width) continue;
              full[fy][fx] = true;
            }
          }
          continue;
        }
        const rectW = left + right + 1;
        const rectH = up + down + 1;
        const ox = x - left;
        const oy = y - up;
        const cellW = rectW / maskW;
        const cellH = rectH / mask.length;
        for (let my = 0; my < mask.length; my++) {
          const mrow = mask[my];
          for (let mx = 0; mx < (mrow?.length ?? 0); mx++) {
            if ((mrow?.[mx] ?? 0) < 1) continue;
            const x0 = ox + mx * cellW;
            const y0 = oy + my * cellH;
            const cx = Math.floor(x0);
            const cy = Math.floor(y0);
            if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
            const cell = (sub[cy][cx] ??= []);
            cell.push({ x0, y0, x1: x0 + cellW, y1: y0 + cellH });
          }
        }
      }
    }
  }
  return { full, sub };
}
```

- [ ] **Step 3b: Delegate `buildBlockingGrid`**

Replace the body of `buildBlockingGrid` (keep its JSDoc, update the `@returns` line to mention delegation):

```ts
export function buildBlockingGrid(
  width: number,
  height: number,
  layers: Layer[],
  blockingById: Map<number, boolean>,
  footprints: TileFootprintMap,
): boolean[][] {
  const tiles = new Map<number, TileCollision>();
  for (const [id, blocking] of blockingById) tiles.set(id, { blocking });
  return buildCollisionField(width, height, layers, tiles, footprints).full;
}
```

- [ ] **Step 3c: Add the `sub` parameter to `resolveCollision`**

Change the signature and the `blocked` predicate, and thread the swept AABB into each `blocked(...)` call:

```ts
export function resolveCollision(
  pos: { x: number; y: number },
  move: { x: number; y: number },
  half: number,
  grid: boolean[][],
  bounds: { width: number; height: number },
  sub?: (CellRect[] | null)[][],
): { x: number; y: number } {
  let x = pos.x;
  let y = pos.y;

  /**
   * A cell blocks when it is out of scene, when the full grid marks it, or when
   * its solid sub-rects (if any) intersect the tentative AABB.
   */
  const blocked = (
    col: number,
    row: number,
    ax0: number,
    ay0: number,
    ax1: number,
    ay1: number,
  ): boolean => {
    if (col < 0 || row < 0 || col >= bounds.width || row >= bounds.height) return true;
    const rowCells = grid[row];
    if (rowCells !== undefined && rowCells[col]) return true;
    const rects = sub?.[row]?.[col];
    if (!rects) return false;
    const ox0 = Math.max(ax0, col);
    const oy0 = Math.max(ay0, row);
    const ox1 = Math.min(ax1, col + 1);
    const oy1 = Math.min(ay1, row + 1);
    if (ox0 >= ox1 || oy0 >= oy1) return false;
    return rects.some((r) => ox0 < r.x1 && ox1 > r.x0 && oy0 < r.y1 && oy1 > r.y0);
  };

  const topRow = Math.floor(y - half - 1) + 1;
  const bottomRow = Math.ceil(y + half) - 1;
  const sweepX0 = Math.min(x, x + move.x) - half;
  const sweepX1 = Math.max(x, x + move.x) + half;

  let hitX = false;
  if (move.x > 0) {
    const newRight = x + move.x + half;
    for (let col = Math.ceil(x + half); col <= Math.floor(newRight); col++) {
      if (newRight <= col) break;
      let cellHit = false;
      for (let row = topRow; row <= bottomRow; row++) {
        if (blocked(col, row, sweepX0, y - half, sweepX1, y + half)) {
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
        if (blocked(col, row, sweepX0, y - half, sweepX1, y + half)) {
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

  const leftCol = Math.floor(x - half - 1) + 1;
  const rightCol = Math.ceil(x + half) - 1;
  const sweepY0 = Math.min(y, y + move.y) - half;
  const sweepY1 = Math.max(y, y + move.y) + half;

  let hitY = false;
  if (move.y > 0) {
    const newBottom = y + move.y + half;
    for (let row = Math.ceil(y + half); row <= Math.floor(newBottom); row++) {
      if (newBottom <= row) break;
      let cellHit = false;
      for (let col = leftCol; col <= rightCol; col++) {
        if (blocked(col, row, x - half, sweepY0, x + half, sweepY1)) {
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
        if (blocked(col, row, x - half, sweepY0, x + half, sweepY1)) {
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npx ng test --watch=false --include='**/collision.spec.ts'`
Expected: PASS — all pre-existing #51 tests plus the new ones.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/collision.ts src/app/features/scene-editor/collision.spec.ts
git commit -m "feature-58: resolve collisions against per-pixel tile masks"
```

---

### Task 3: Play controller + scene editor wiring

**Files:**

- Modify: `src/app/features/scene-editor/services/play-controller.ts`
- Modify: `src/app/features/scene-editor/scene-editor.component.ts`
- Test: `src/app/features/scene-editor/services/play-controller.spec.ts`

**Interfaces:**

- Consumes: `buildCollisionField`, `CollisionField`, `TileCollision`, `resolveCollision` from Task 2.
- Produces: `PlayerController.start(scene, spawn, collisionById: Map<number, TileCollision>, footprints, interactableById)`.

- [ ] **Step 1: Update the play-controller tests**

In `src/app/features/scene-editor/services/play-controller.spec.ts`, replace every `start(...)` call that passes a `Map<number, boolean>` (e.g. `new Map([[1, true]])`) with the object form `new Map([[1, { blocking: true }]])`, importing the type:

```ts
import type { TileCollision } from '../collision';
```

Add one behaviour test (adapt the factory/helper names to the file's existing style):

```ts
it('lets the player cross a masked cell where the mask is empty', () => {
  const controller = new PlayerController();
  controller.speed = 5;
  const layers = [{ id: 'l', name: 'l', visible: true, opacity: 1, tileData: [[1, -1]] }];
  const collision = new Map<number, TileCollision>([[1, { blocking: true, mask: [[0]] }]]);
  controller.start({ width: 2, height: 1 }, { x: 0, y: 0 }, collision, {}, new Map());
  // Cross the masked (but empty) cell to the right.
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
  for (let i = 0; i < 20; i++) controller.update(0.05);
  expect(controller.x()).toBeGreaterThan(1);
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' }));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npx ng test --watch=false --include='**/play-controller.spec.ts'`
Expected: FAIL — type errors (map value is not `boolean`) / crossing assertion fails.

- [ ] **Step 3a: Update the play controller**

In `src/app/features/scene-editor/services/play-controller.ts`:

Change the collision import (line 3) to:

```ts
import { buildCollisionField, resolveCollision, HALF_CELL_HITBOX } from '../collision';
import type { CollisionField, TileCollision } from '../collision';
```

Replace the `blockingGrid` field (line 62) with:

```ts
  private collisionField: CollisionField = { full: [], sub: [] };
```

Update `start` — change the `@param` JSDoc line, the `blockingById` parameter and its use:

```ts
   * @param collisionById - Per-tile blocking flag and optional collision mask.
   */
  start(
    scene: { width: number; height: number; layers: Layer[] },
    spawn: { x: number; y: number },
    collisionById: Map<number, TileCollision>,
    footprints: TileFootprintMap,
    interactableById: Map<number, string>,
  ): void {
    this.sceneWidth = scene.width;
    this.sceneHeight = scene.height;
    this.sceneLayers = scene.layers;
    this.collisionField = buildCollisionField(
      scene.width,
      scene.height,
      scene.layers,
      collisionById,
      footprints,
    );
    this.interactableById = interactableById;
    this.x.set(spawn.x + 0.5);
    this.y.set(spawn.y + 0.5);
    this.direction.set('down');
    this.moving.set(false);
    this.recomputeInteractionTarget();
    this.held.clear();
    if (!this.listenersActive) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.listenersActive = true;
    }
  }
```

(In the `update` method) replace the `resolveCollision` call:

```ts
const resolved = resolveCollision(
  { x: this.x(), y: this.y() },
  { x: dx * this.speed * dt, y: dy * this.speed * dt },
  HALF_CELL_HITBOX,
  this.collisionField.full,
  { width: this.sceneWidth, height: this.sceneHeight },
  this.collisionField.sub,
);
```

- [ ] **Step 3b: Wire the scene editor**

In `src/app/features/scene-editor/scene-editor.component.ts`, add near the existing `blockingById` computed:

```ts
  /** @internal Per-tile collision inputs (blocking + mask) for Play mode. */
  readonly collisionById = computed(() => {
    const tiles = new Map<number, TileCollision>();
    for (const t of this.projectTiles()) {
      tiles.set(t.id, { blocking: t.properties.blocking, mask: t.collisionMask ?? null });
    }
    return tiles;
  });
```

Add the import: `import type { TileCollision } from './collision';`

In `enterPlay`, change the `player.start` call's third argument from `this.blockingById()` to `this.collisionById()`:

```ts
this.player.start(
  scene,
  this.resolveSpawn(scene),
  this.collisionById(),
  this.tileFootprints(),
  interactableById,
);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npx ng test --watch=false --include='**/play-controller.spec.ts' --include='**/scene-editor.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/services/play-controller.ts src/app/features/scene-editor/services/play-controller.spec.ts src/app/features/scene-editor/scene-editor.component.ts
git commit -m "feature-58: feed the collision field into the play controller"
```

---

### Task 4: Collision tools + pixel canvas mask painting

**Files:**

- Modify: `src/app/features/sprite-editor/tools/drawing-tools.component.ts`
- Modify: `src/app/features/sprite-editor/tools/drawing-tools.component.html`
- Modify: `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts`
- Test: `src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts`

**Interfaces:**

- Consumes: `DrawingTool` union.
- Produces: `DrawingTool` gains `'collision' | 'collisionErase'`; `PixelCanvasComponent.collisionMask = input<number[][] | null>(null)` and `collisionMaskChange = output<number[][]>()`.

- [ ] **Step 1: Write the failing tests**

In `src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts`, follow the file's existing setup helper and add:

```ts
it('paints solid collision pixels with the collision tool', () => {
  setup();
  fixture.componentRef.setInput('tool', 'collision');
  fixture.detectChanges();
  fixture.componentInstance.onMouseDown(new MouseEvent('mousedown', { clientX: 4, clientY: 4 }));
  const emitted = emitSpy.mock.calls.at(-1)?.[0] as number[][];
  expect(emitted[0][0]).toBe(1);
});

it('clears collision pixels with the erase tool', () => {
  setup();
  fixture.componentRef.setInput('collisionMask', [[1, 1]]);
  fixture.componentRef.setInput('tool', 'collisionErase');
  fixture.detectChanges();
  fixture.componentInstance.onMouseDown(new MouseEvent('mousedown', { clientX: 4, clientY: 4 }));
  const emitted = emitSpy.mock.calls.at(-1)?.[0] as number[][];
  expect(emitted[0][0]).toBe(0);
});
```

> Adapt `setup()`/`emitSpy` to the helpers already defined in the spec (subscribe to `collisionMaskChange` into a spy array named `emitSpy` if not present).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npx ng test --watch=false --include='**/pixel-canvas.component.spec.ts'`
Expected: FAIL — `'collision'` is not assignable to `DrawingTool` / `collisionMask` input missing.

- [ ] **Step 3a: Extend the tool union**

In `src/app/features/sprite-editor/tools/drawing-tools.component.ts`:

```ts
/** Tools available on the sprite/tile canvas. */
export type DrawingTool = 'brush' | 'eraser' | 'fill' | 'anchor' | 'collision' | 'collisionErase';
```

- [ ] **Step 3b: Add the two tool buttons**

In `src/app/features/sprite-editor/tools/drawing-tools.component.html`, inside the button row (after the anchor button), add:

```html
<button
  type="button"
  data-testid="tool-collision"
  title="Collision"
  (click)="selectTool('collision')"
  [class.tw-bg-primary/10]="tool() === 'collision'"
  [class.tw-border-primary]="tool() === 'collision'"
  class="tw-p-1.5 tw-rounded-sm tw-border tw-border-border tw-transition hover:tw-bg-muted"
>
  <span class="material-symbols" aria-hidden="true">check_box</span>
</button>
<button
  type="button"
  data-testid="tool-collision-erase"
  title="Erase collision"
  (click)="selectTool('collisionErase')"
  [class.tw-bg-primary/10]="tool() === 'collisionErase'"
  [class.tw-border-primary]="tool() === 'collisionErase'"
  class="tw-p-1.5 tw-rounded-sm tw-border tw-border-border tw-transition hover:tw-bg-muted"
>
  <span class="material-symbols" aria-hidden="true">check_box_outline_blank</span>
</button>
```

- [ ] **Step 3c: Add mask input/output, editing, and overlay to the pixel canvas**

In `src/app/features/sprite-editor/canvas/pixel-canvas.component.ts`:

Add to the inputs (after `anchor`):

```ts
/** Optional per-pixel collision mask of the current tile (`1` = solid). */
collisionMask = input<number[][] | null>(null);
```

Add to the outputs (after `zoomChange`):

```ts
/** Emits the updated collision mask whenever it is painted. */
collisionMaskChange = output<number[][]>();
```

Add internal state next to `localPaletteIndices`:

```ts
  private localCollisionMask: number[][] = [];
```

In the main effect (after `this.gridRows/gridCols` are set and before `this.syncCanvasSize()`), sync the mask:

```ts
this.localCollisionMask = this.normalizeMask(this.collisionMask());
```

Add the helper:

```ts
  /**
   * @internal Resizes a mask input to the current grid, filling missing cells with 0.
   * @param mask - The mask input, or null when the tile has no mask.
   * @returns A `gridRows` x `gridCols` numeric grid.
   */
  private normalizeMask(mask: number[][] | null): number[][] {
    const grid: number[][] = [];
    for (let y = 0; y < this.gridRows(); y++) {
      const row: number[] = [];
      for (let x = 0; x < this.gridCols(); x++) {
        row.push(mask?.[y]?.[x] ?? 0);
      }
      grid.push(row);
    }
    return grid;
  }
```

In `render()`, after the "3. Next onion skin" block and before the ground-zone marker, draw the overlay:

```ts
// Collision mask overlay while a mask tool is active.
const maskTool = this.tool() === 'collision' || this.tool() === 'collisionErase';
if (maskTool && this.localCollisionMask.length > 0) {
  ctx.fillStyle = 'rgba(220, 38, 38, 0.35)';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if ((this.localCollisionMask[y]?.[x] ?? 0) >= 1) {
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
}
```

In `applyTool`, add a branch before the closing brace:

```ts
    } else if (tool === 'collision' || tool === 'collisionErase') {
      const value = tool === 'collision' ? 1 : 0;
      if (this.localCollisionMask[y][x] !== value) {
        this.localCollisionMask[y][x] = value;
        this.emitMaskAndRender();
      }
    }
```

Add the emitter next to `emitAndRender`:

```ts
  /** @internal Emits the updated collision mask and triggers a re-render. */
  private emitMaskAndRender() {
    this.collisionMaskChange.emit(this.localCollisionMask.map((row) => [...row]));
    this.render();
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npx ng test --watch=false --include='**/pixel-canvas.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor/tools/drawing-tools.component.ts src/app/features/sprite-editor/tools/drawing-tools.component.html src/app/features/sprite-editor/canvas/pixel-canvas.component.ts src/app/features/sprite-editor/canvas/pixel-canvas.component.spec.ts
git commit -m "feature-58: paint collision masks on the pixel canvas"
```

---

### Task 5: Sprite editor integration

**Files:**

- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts`
- Modify: `src/app/features/sprite-editor/sprite-editor.component.html`
- Test: `src/app/features/sprite-editor/sprite-editor.component.spec.ts`

**Interfaces:**

- Consumes: `TileService.updateTile`, `UndoService`, `PixelCanvasComponent.collisionMask/collisionMaskChange`.
- Produces: `SpriteEditorComponent.collisionMask` signal, `onCollisionMaskChange(mask)`, `onResetCollisionMask()`.

- [ ] **Step 1: Write the failing tests**

In `src/app/features/sprite-editor/sprite-editor.component.spec.ts`, add:

```ts
it('loads the current tile collision mask on selection', async () => {
  // select a tile whose collisionMask is set in the DB
  await component.selectTile(tileId);
  expect(component.collisionMask()).toEqual(storedMask);
});

it('persists a collision mask on onChange and can reset it to null', async () => {
  await component.selectTile(tileId);
  component.onCollisionMaskChange([
    [1, 0],
    [0, 0],
  ]);
  await component.onStrokeEnd([
    [0, 0],
    [0, 0],
  ]);
  const stored = await db.tiles.get(tileId);
  expect(stored?.collisionMask).toEqual([
    [1, 0],
    [0, 0],
  ]);
  await component.onResetCollisionMask();
  expect(component.collisionMask()).toBeNull();
  expect((await db.tiles.get(tileId))?.collisionMask).toBeNull();
});
```

> Adapt variable names (`tileId`, `storedMask`, `db`) to the spec's existing fixtures.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npx ng test --watch=false --include='**/sprite-editor.component.spec.ts'`
Expected: FAIL — `collisionMask` / `onCollisionMaskChange` / `onResetCollisionMask` do not exist.

- [ ] **Step 3a: Add labels and the mask signal**

In `src/app/features/sprite-editor/sprite-editor.component.ts`:

Extend `TOOL_LABELS`:

```ts
const TOOL_LABELS: Record<DrawingTool, string> = {
  brush: 'Brush',
  eraser: 'Eraser',
  fill: 'Fill',
  anchor: 'Anchor',
  collision: 'Collision',
  collisionErase: 'Erase collision',
};
```

Add near `paletteIndices` (line ~121):

```ts
  /** Per-pixel collision mask of the current tile, or null when unset. */
  readonly collisionMask = signal<number[][] | null>(null);
  /** @internal Mask snapshot at stroke start, for undo/compare. */
  private previousCollisionMask: number[][] | null = null;
```

- [ ] **Step 3b: Load the mask when a tile is selected**

In `selectTile(tileId)` (lines ~402-410), after `selectedTileId.set(tileId)`:

```ts
this.collisionMask.set(this.tiles().find((t) => t.id === tileId)?.collisionMask ?? null);
```

- [ ] **Step 3c: Handle mask edits, stroke ends, and reset**

In `onStrokeStart()` add an early branch:

```ts
  onStrokeStart(): void {
    const tool = this.selectedTool();
    if (tool === 'collision' || tool === 'collisionErase') {
      this.previousCollisionMask = this.collisionMask()?.map((row) => [...row]) ?? null;
      return;
    }
    this.previousIndices = this.paletteIndices()?.map((row) => [...row]) ?? null;
  }
```

At the start of `onStrokeEnd(finalIndices)` add:

```ts
const tool = this.selectedTool();
if (tool === 'collision' || tool === 'collisionErase') {
  void this.commitCollisionMask();
  return;
}
```

Add the handler and helpers:

```ts
  /**
   * Records a mask edit emitted by the pixel canvas (persisted on stroke end).
   * @param mask - The updated collision mask.
   */
  onCollisionMaskChange(mask: number[][]): void {
    this.collisionMask.set(mask);
  }

  /**
   * Resets the current tile's collision mask to null so it blocks its full
   * footprint again. Records an undo entry when a mask existed.
   */
  async onResetCollisionMask(): Promise<void> {
    const tile = this.currentTile();
    if (!tile) return;
    const previous = this.collisionMask();
    try {
      await this.tileService.updateTile(tile.id, { collisionMask: null });
      this.collisionMask.set(null);
      await this.loadTiles();
      if (previous && this.maskHasSolid(previous)) {
        this.undo.push({
          label: 'Reset collision mask',
          execute: () => void this.tileService.updateTile(tile.id, { collisionMask: null }),
          undo: () => void this.tileService.updateTile(tile.id, { collisionMask: previous }),
        });
      }
    } catch {
      this.notification.error('Failed to reset the collision mask.');
    }
  }

  /** @internal Persists the painted mask (null when empty) with an undo entry. */
  private async commitCollisionMask(): Promise<void> {
    const tile = this.currentTile();
    const previous = this.previousCollisionMask;
    this.previousCollisionMask = null;
    if (!tile || previous === null) return;
    const nextMask = this.collisionMask();
    const next = nextMask && this.maskHasSolid(nextMask) ? nextMask : null;
    const prev = this.maskHasSolid(previous) ? previous : null;
    if (JSON.stringify(next) === JSON.stringify(prev)) return;
    try {
      await this.tileService.updateTile(tile.id, { collisionMask: next });
      this.undo.push({
        label: 'Paint collision mask',
        execute: () => void this.tileService.updateTile(tile.id, { collisionMask: next }),
        undo: () => void this.tileService.updateTile(tile.id, { collisionMask: prev }),
      });
      await this.loadTiles();
    } catch {
      this.notification.error('Failed to save the collision mask.');
    }
  }

  /**
   * @internal Whether a mask has at least one solid pixel.
   * @param mask - The mask to inspect.
   * @returns True when any cell is >= 1.
   */
  private maskHasSolid(mask: number[][]): boolean {
    return mask.some((row) => row.some((v) => v >= 1));
  }
```

- [ ] **Step 3d: Wire the template**

In `src/app/features/sprite-editor/sprite-editor.component.html`, on `rk-pixel-canvas` add (after the `[anchor]` binding):

```html
[collisionMask]="collisionMask()" (collisionMaskChange)="onCollisionMaskChange($event)"
```

After the `@if (selectedTool() === 'anchor') { ... }` Auto-button block, add:

```html
@if (selectedTool() === 'collision' || selectedTool() === 'collisionErase') {
<button
  data-testid="reset-collision-mask"
  (click)="onResetCollisionMask()"
  [disabled]="!collisionMask()"
  title="Reset collision mask to full footprint"
  class="tw-px-2 tw-py-0.5 tw-text-xs tw-rounded-sm tw-border tw-border-border tw-bg-card-bg tw-text-foreground tw-cursor-pointer hover:tw-bg-accent disabled:tw-opacity-40"
>
  Reset
</button>
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npx ng test --watch=false --include='**/sprite-editor.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor/sprite-editor.component.ts src/app/features/sprite-editor/sprite-editor.component.html src/app/features/sprite-editor/sprite-editor.component.spec.ts
git commit -m "feature-58: paint and persist collision masks in the tile editor"
```

---

## Final verification

- [ ] `devbox run npm run test` — full suite green (baseline was 55 files / ~634 tests after #14).
- [ ] `devbox run npm run lint` — no errors.
- [ ] `devbox run npm run format:check` — clean (run `npx prettier --write <files>` if needed).
- [ ] `devbox run npm run build` — production build succeeds.
