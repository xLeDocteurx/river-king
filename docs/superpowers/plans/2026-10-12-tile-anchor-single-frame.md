# Tile Anchor & 4-way Footprint — Single-frame Static Guarantee (#92) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every tile an explicit `ts×ts` ground cell (anchor) that can sit anywhere inside its artwork, express the footprint as four-directional `{left, up, right, down}`, render oversized artwork at its absolute rect, and enforce "static ⇒ exactly one frame" so a tree is a single 16×32 sprite whose canopy renders.

**Architecture:** A new pure shared module `tile-anchor.ts` owns the pixel math (`deriveAnchor`, `clampAnchor`, `deriveFootprint`). The scene-editor `map-footprint.ts` becomes a thin adapter over it (`getFootprint`, `footprintRect`, `clearOverlappedAnchors` now direction-aware). Storage adds an optional non-indexed `Tile.anchor` (no Dexie bump). The map canvas, minimap, collision grid, and scene placement all switch from `{w,h}` down-right to absolute-rect math. `TileService.updateTile` gains the static-single-frame guard; frame-add paths promote to `animated` in the same call. Demo tree is re-authored as one 16×32 sprite.

**Tech Stack:** Angular 22 (standalone, signals, OnPush), Vitest via `@angular/build:unit-test`, Tailwind `tw-` tokens, IndexedDB/Dexie (no migration), TypeScript ~6.0.

## Global Constraints

- Angular 22 standalone components only; `ChangeDetectionStrategy.OnPush`; signals-first.
- Tailwind: `tw-` prefix, theme tokens only (never raw hex), max radius `tw-rounded-sm`. UI copy **English only**.
- Every new public method/member gets a JSDoc block; every new model/interface documents every property.
- Tests await async DB work with a manual flush (`await new Promise(r => setTimeout(r, 50))`) — `fixture.whenStable()` does not track Dexie promises.
- Commands run through devbox; strip devbox startup noise with `grep -v "devbox|Welcome|Node.js version|npm version|^$|Running script|v22|10.9"`.
- Branch: `feature-92` (branched from `develop`). Commit messages prefixed `feature-92:`.
- No Dexie schema change. Legacy tiles lacking `anchor` are read as absent (anchor derived).
- `map-footprint.ts` **keeps its path** (`src/app/features/scene-editor/map-footprint.ts`) so all existing importers (`collision.ts`, `map-canvas.component.ts`, `scene-minimap.component.ts`, `map-tiles.service.ts`) are unaffected at first.

---

## File structure

- Create: `src/app/shared/models/tile-anchor.ts` (+ `.spec.ts`) — pure anchor math + shared types.
- Rewrite: `src/app/features/scene-editor/map-footprint.ts` — re-export shared types, add `footprintRect`, direction-aware `clearOverlappedAnchors`.
- Modify: `src/app/features/scene-editor/collision.ts` — directional blocking rows/cols.
- Modify: `src/app/features/scene-editor/services/map-tiles.service.ts` — `deriveFootprint` from stored/derived anchor.
- Modify: `src/app/features/scene-editor/map-canvas.component.ts` — absolute-rect render + placement.
- Modify: `src/app/features/scene-editor/minimap/scene-minimap.component.ts` — absolute-rect render.
- Modify: `src/app/features/scene-editor/scene-editor.component.ts` — `onTilePlaced` absolute-rect + anchor recompute.
- Modify: `src/app/shared/models/tile.model.ts` — optional `anchor`.
- Modify: `src/app/features/tile-manager/services/tile.service.ts` — static single-frame guard.
- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts` — `onDuplicateFrame` type.
- Modify: `src/app/features/tile-manager/properties/tile-properties.component.ts` — `createFramesFrom` type + `applySize` anchor clamp.
- Modify: `src/app/shared/models/project-archive.model.ts` + `src/app/core/services/project-io.service.ts` — anchor round-trip + import normalization.
- Modify: `src/app/core/services/demo-art.ts` + `demo-project.service.ts` — single 16×32 tree sprite.

---

### Task 1: Shared anchor math module

**Files:**

- Create: `src/app/shared/models/tile-anchor.ts`
- Test: `src/app/shared/models/tile-anchor.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `TileAnchor`, `AnchorFootprint`, `TileFootprintMap`, `deriveAnchor(w, h, ts)`, `clampAnchor(anchor, w, h, ts)`, `deriveFootprint(w, h, ts, anchor)`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/shared/models/tile-anchor.spec.ts`:

```ts
import { clampAnchor, deriveAnchor, deriveFootprint } from './tile-anchor';

describe('deriveAnchor', () => {
  it('centers a 16x16 sprite at the bottom of its single cell', () => {
    expect(deriveAnchor(16, 16, 16)).toEqual({ x: 0, y: 0 });
  });

  it('places a 16x32 sprite in the bottom cell (canopy above)', () => {
    expect(deriveAnchor(16, 32, 16)).toEqual({ x: 0, y: 16 });
  });

  it('centers a 32x32 sprite horizontally in its bottom cells', () => {
    expect(deriveAnchor(32, 32, 16)).toEqual({ x: 8, y: 16 });
  });

  it('centers a 32x40 sprite with an even 8px x offset', () => {
    expect(deriveAnchor(32, 40, 16)).toEqual({ x: 8, y: 24 });
  });

  it('centers a 48x32 sprite (x = 16)', () => {
    expect(deriveAnchor(48, 32, 16)).toEqual({ x: 16, y: 16 });
  });

  it('clamps to zero when the sprite is smaller than the tile size', () => {
    expect(deriveAnchor(8, 8, 16)).toEqual({ x: 0, y: 0 });
  });
});

describe('clampAnchor', () => {
  it('clamps an anchor past the frame bounds back inside', () => {
    expect(clampAnchor({ x: 24, y: 64 }, 32, 64, 16)).toEqual({ x: 16, y: 48 });
  });

  it('clamps negative coordinates to zero', () => {
    expect(clampAnchor({ x: -5, y: -9 }, 32, 32, 16)).toEqual({ x: 0, y: 0 });
  });

  it('leaves an in-bounds anchor unchanged', () => {
    expect(clampAnchor({ x: 8, y: 16 }, 32, 64, 16)).toEqual({ x: 8, y: 16 });
  });

  it('floors fractional coordinates', () => {
    expect(clampAnchor({ x: 7.9, y: 15.2 }, 32, 64, 16)).toEqual({ x: 7, y: 15 });
  });

  it('clamps to zero when the frame is smaller than the tile size', () => {
    expect(clampAnchor({ x: 4, y: 4 }, 8, 8, 16)).toEqual({ x: 0, y: 0 });
  });
});

describe('deriveFootprint', () => {
  it('returns an empty footprint for a single-cell sprite', () => {
    expect(deriveFootprint(16, 16, 16, { x: 0, y: 0 })).toEqual({
      left: 0,
      up: 0,
      right: 0,
      down: 0,
    });
  });

  it('marks one row above for a bottom-anchored 16x32 tree', () => {
    expect(deriveFootprint(16, 32, 16, { x: 0, y: 16 })).toEqual({
      left: 0,
      up: 1,
      right: 0,
      down: 0,
    });
  });

  it('marks one column each side for a centered 32x32 sprite', () => {
    expect(deriveFootprint(32, 32, 16, { x: 8, y: 16 })).toEqual({
      left: 1,
      up: 1,
      right: 1,
      down: 0,
    });
  });

  it('marks two columns/rows when the anchor is in the far corner', () => {
    expect(deriveFootprint(32, 32, 16, { x: 30, y: 30 })).toEqual({
      left: 2,
      up: 2,
      right: 0,
      down: 0,
    });
  });

  it('marks a 48x48 sprite anchored near the top-left', () => {
    expect(deriveFootprint(48, 48, 16, { x: 16, y: 32 })).toEqual({
      left: 1,
      up: 2,
      right: 1,
      down: 0,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/tile-anchor.spec.ts'
```

Expected: FAIL — cannot resolve `./tile-anchor` (module does not exist).

- [ ] **Step 3: Write the module**

Create `src/app/shared/models/tile-anchor.ts`:

```ts
/**
 * Ground-cell anchor and four-directional footprint maths for tiles.
 *
 * A tile's anchor is the top-left, in pixels, of a `ts×ts` ground zone inside
 * the frame's artwork (frame-relative). The artwork may overflow that zone on
 * any side; the overflow, expressed in whole grid cells, is the footprint.
 * These helpers are pure so both the editor and the scene renderer share them.
 */

/** Top-left, in pixels, of a tile's `ts×ts` ground zone, relative to its frame. */
export interface TileAnchor {
  /** Horizontal offset of the ground zone from the frame's left edge, in pixels. */
  x: number;
  /** Vertical offset of the ground zone from the frame's top edge, in pixels. */
  y: number;
}

/** Grid-cell extents of a tile's artwork relative to its anchor cell. */
export interface AnchorFootprint {
  /** Number of grid cells the artwork extends to the left of the anchor cell. */
  left: number;
  /** Number of grid cells the artwork extends above the anchor cell. */
  up: number;
  /** Number of grid cells the artwork extends to the right of the anchor cell. */
  right: number;
  /** Number of grid cells the artwork extends below the anchor cell. */
  down: number;
}

/** Map of tile id to its directional grid-cell footprint. */
export type TileFootprintMap = Record<number, AnchorFootprint>;

/** A footprint with no overflow (a single 1×1 cell). */
export const EMPTY_FOOTPRINT: AnchorFootprint = { left: 0, up: 0, right: 0, down: 0 };

/**
 * Derives the default anchor for a frame: horizontally centered, bottom-aligned
 * (the ground edge is the frame's bottom). Clamped to non-negative offsets.
 * @param width - Frame width in pixels.
 * @param height - Frame height in pixels.
 * @param tileSize - Side length of one grid cell in pixels.
 * @returns The derived anchor.
 */
export function deriveAnchor(width: number, height: number, tileSize: number): TileAnchor {
  return {
    x: Math.max(0, Math.floor((width - tileSize) / 2)),
    y: Math.max(0, height - tileSize),
  };
}

/**
 * Clamps an anchor so its `ts×ts` zone stays fully inside the frame.
 * @param anchor - The anchor to clamp.
 * @param width - Frame width in pixels.
 * @param height - Frame height in pixels.
 * @param tileSize - Side length of one grid cell in pixels.
 * @returns A floored, in-bounds anchor.
 */
export function clampAnchor(
  anchor: TileAnchor,
  width: number,
  height: number,
  tileSize: number,
): TileAnchor {
  return {
    x: Math.min(Math.max(0, Math.floor(anchor.x)), Math.max(0, width - tileSize)),
    y: Math.min(Math.max(0, Math.floor(anchor.y)), Math.max(0, height - tileSize)),
  };
}

/**
 * Derives the directional grid-cell footprint of a frame from its anchor.
 * Overflow is rounded up with `ceil` so even a partial cell counts.
 * @param width - Frame width in pixels.
 * @param height - Frame height in pixels.
 * @param tileSize - Side length of one grid cell in pixels.
 * @param anchor - The frame's anchor (already resolved, not optional here).
 * @returns The footprint relative to the anchor cell.
 */
export function deriveFootprint(
  width: number,
  height: number,
  tileSize: number,
  anchor: TileAnchor,
): AnchorFootprint {
  return {
    left: Math.max(0, Math.ceil(anchor.x / tileSize)),
    up: Math.max(0, Math.ceil(anchor.y / tileSize)),
    right: Math.max(0, Math.ceil((width - anchor.x - tileSize) / tileSize)),
    down: Math.max(0, Math.ceil((height - anchor.y - tileSize) / tileSize)),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/tile-anchor.spec.ts'
```

Expected: PASS (all 15 assertions).

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/shared/models/tile-anchor.ts src/app/shared/models/tile-anchor.spec.ts
git commit -m "feature-92: add shared tile-anchor maths module"
```

---

### Task 2: Reshape `map-footprint.ts` to directional footprints

**Files:**

- Rewrite: `src/app/features/scene-editor/map-footprint.ts`
- Test: `src/app/features/scene-editor/map-footprint.spec.ts`

**Interfaces:**

- Consumes: `AnchorFootprint`, `TileFootprintMap`, `EMPTY_FOOTPRINT` from Task 1.
- Produces: `TileFootprint` / `TileFootprintMap` type aliases re-exported from the shared module; `getFootprint(tileId, footprints): AnchorFootprint`; `footprintRect(x, y, tileId, footprints): {x,y,w,h}`; `clearOverlappedAnchors(tileData, x, y, w, h, footprints): number[][]`.

- [ ] **Step 1: Write the failing tests**

Replace `src/app/features/scene-editor/map-footprint.spec.ts`:

```ts
import { clearOverlappedAnchors, footprintRect, getFootprint } from './map-footprint';

describe('getFootprint', () => {
  it('defaults to an empty footprint when the tile has no entry', () => {
    expect(getFootprint(7, {})).toEqual({ left: 0, up: 0, right: 0, down: 0 });
  });

  it('returns the stored footprint for a known tile', () => {
    expect(getFootprint(7, { 7: { left: 1, up: 2, right: 1, down: 0 } })).toEqual({
      left: 1,
      up: 2,
      right: 1,
      down: 0,
    });
  });
});

describe('footprintRect', () => {
  const footprints = {
    1: { left: 0, up: 0, right: 1, down: 1 },
    2: { left: 0, up: 1, right: 0, down: 0 },
  };

  it('extends down-right for a bottom-right footprint', () => {
    expect(footprintRect(2, 1, 1, footprints)).toEqual({ x: 2, y: 1, w: 2, h: 2 });
  });

  it('extends upward for a bottom-anchored tile', () => {
    expect(footprintRect(1, 1, 2, footprints)).toEqual({ x: 1, y: 0, w: 1, h: 2 });
  });

  it('returns a single cell for an unknown tile', () => {
    expect(footprintRect(3, 4, 99, footprints)).toEqual({ x: 3, y: 4, w: 1, h: 1 });
  });
});

describe('clearOverlappedAnchors', () => {
  const footprints = {
    1: { left: 0, up: 0, right: 1, down: 1 },
    9: { left: 0, up: 0, right: 0, down: 0 },
  };

  it('removes only anchors whose footprint intersects the rectangle', () => {
    const tileData = [
      [1, -1, -1],
      [-1, -1, 9],
      [-1, -1, -1],
    ];

    const result = clearOverlappedAnchors(tileData, 1, 1, 2, 1, footprints);

    expect(result[0][0]).toBe(-1);
    expect(result[1][2]).toBe(-1);
  });

  it('keeps anchors outside the rectangle', () => {
    const tileData = [
      [-1, -1, -1],
      [-1, -1, -1],
      [-1, -1, 9],
    ];

    const result = clearOverlappedAnchors(tileData, 0, 0, 2, 2, footprints);

    expect(result[2][2]).toBe(9);
  });

  it('keeps a multi-cell anchor that only touches the rectangle edge', () => {
    const tileData = [
      [1, -1, -1],
      [-1, -1, -1],
      [-1, -1, -1],
    ];

    const result = clearOverlappedAnchors(tileData, 2, 0, 1, 2, footprints);

    expect(result[0][0]).toBe(1);
  });

  it('clears an upward-overhanging anchor whose body reaches the rectangle', () => {
    const overhang = { 2: { left: 0, up: 1, right: 0, down: 0 } };
    const tileData = [
      [-1, 2],
      [-1, -1],
    ];

    // Tile 2 anchored at (1,1) covers cells (1,0)-(1,1); rect only covers (0,0).
    const result = clearOverlappedAnchors(tileData, 0, 0, 1, 1, overhang);

    expect(result[1][1]).toBe(2);
  });

  it('does not mutate the input array', () => {
    const tileData = [
      [1, -1],
      [-1, 9],
    ];

    clearOverlappedAnchors(tileData, 0, 0, 2, 2, footprints);

    expect(tileData[0][0]).toBe(1);
    expect(tileData[1][1]).toBe(9);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/map-footprint.spec.ts'
```

Expected: FAIL — `footprintRect` is not exported; `getFootprint` returns `{w,h}`.

- [ ] **Step 3: Rewrite the module**

Replace `src/app/features/scene-editor/map-footprint.ts`:

```ts
import {
  EMPTY_FOOTPRINT,
  type AnchorFootprint,
  type TileFootprintMap,
} from '../../shared/models/tile-anchor';

export type { AnchorFootprint, TileFootprintMap } from '../../shared/models/tile-anchor';

/** Backwards-compatible alias for a tile footprint. */
export type TileFootprint = AnchorFootprint;

/**
 * Returns the directional grid-cell footprint of a tile.
 * @param tileId - The tile whose footprint to look up.
 * @param footprints - Known footprints keyed by tile id.
 * @returns The stored footprint, or an empty (1×1) footprint when absent.
 */
export function getFootprint(tileId: number, footprints: TileFootprintMap): AnchorFootprint {
  return footprints[tileId] ?? EMPTY_FOOTPRINT;
}

/**
 * Computes the absolute grid rectangle covered by a tile anchored at (x, y).
 * @param x - Anchor cell column.
 * @param y - Anchor cell row.
 * @param tileId - The tile whose footprint to apply.
 * @param footprints - Known footprints keyed by tile id.
 * @returns The absolute rectangle `{x, y, w, h}` in grid cells.
 */
export function footprintRect(
  x: number,
  y: number,
  tileId: number,
  footprints: TileFootprintMap,
): { x: number; y: number; w: number; h: number } {
  const fp = getFootprint(tileId, footprints);
  return {
    x: x - fp.left,
    y: y - fp.up,
    w: fp.left + fp.right + 1,
    h: fp.up + fp.down + 1,
  };
}

/**
 * Returns a new tileData array where every existing anchor whose absolute
 * footprint rectangle intersects `(x, y, w, h)` is cleared to -1 (the "Replace"
 * placement policy). The rectangle is the placed tile's absolute footprint.
 * @param tileData - Current scene grid (-1 = empty, >=0 = tile id anchor).
 * @param x - Placed rectangle top-left column (absolute).
 * @param y - Placed rectangle top-left row (absolute).
 * @param w - Placed rectangle width in cells.
 * @param h - Placed rectangle height in cells.
 * @param footprints - Known footprints keyed by tile id.
 * @returns A new tileData array; the input is never mutated.
 */
export function clearOverlappedAnchors(
  tileData: number[][],
  x: number,
  y: number,
  w: number,
  h: number,
  footprints: TileFootprintMap,
): number[][] {
  const result = tileData.map((row) => [...row]);
  for (let cy = 0; cy < result.length; cy++) {
    for (let cx = 0; cx < result[cy].length; cx++) {
      const tileId = result[cy][cx];
      if (tileId < 0) continue;
      const rect = footprintRect(cx, cy, tileId, footprints);
      const intersects =
        rect.x < x + w && x < rect.x + rect.w && rect.y < y + h && y < rect.y + rect.h;
      if (intersects) {
        result[cy][cx] = -1;
      }
    }
  }
  return result;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/map-footprint.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/features/scene-editor/map-footprint.ts src/app/features/scene-editor/map-footprint.spec.ts
git commit -m "feature-92: make map footprints four-directional"
```

---

### Task 3: Directional blocking grid in `collision.ts`

**Files:**

- Modify: `src/app/features/scene-editor/collision.ts:37-42`
- Test: `src/app/features/scene-editor/collision.spec.ts`

**Interfaces:**

- Consumes: `getFootprint` returning `AnchorFootprint` (Task 2).
- Produces: `buildBlockingGrid` marks `rows y-up..y+down`, `cols x-left..x+right`; `resolveCollision` unchanged.

- [ ] **Step 1: Write the failing test**

In `src/app/features/scene-editor/collision.spec.ts`, update any footprint fixture using `{ w, h }` to the directional shape, and add this test inside the `buildBlockingGrid` describe block:

```ts
it('marks the cell above a bottom-anchored overhanging tile', () => {
  const footprints = { 1: { left: 0, up: 1, right: 0, down: 0 } };
  const layers = [
    {
      id: 'l1',
      name: 'L',
      visible: true,
      opacity: 1,
      tileData: [
        [-1, -1],
        [-1, 1],
      ],
    },
  ];
  const blocking = new Map<number, boolean>([[1, true]]);

  const grid = buildBlockingGrid(2, 2, layers, blocking, footprints);

  expect(grid[1][1]).toBe(true);
  expect(grid[0][1]).toBe(true);
  expect(grid[0][0]).toBe(false);
});
```

Any existing `{ w: 2, h: 2 }` fixture becomes `{ left: 0, up: 0, right: 1, down: 1 }`.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
devbox run npx ng test --watch=false --include='**/collision.spec.ts'
```

Expected: FAIL — `getFootprint` no longer returns `{w,h}`; `grid[0][1]` is `false`.

- [ ] **Step 3: Implement directional loops**

In `src/app/features/scene-editor/collision.ts`, replace the footprint block (lines 37-42):

```ts
const { left, up, right, down } = getFootprint(tileId, footprints);
for (let fy = y - up; fy <= y + down; fy++) {
  if (fy < 0 || fy >= height) continue;
  for (let fx = x - left; fx <= x + right; fx++) {
    if (fx < 0 || fx >= width) continue;
    grid[fy][fx] = true;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
devbox run npx ng test --watch=false --include='**/collision.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/features/scene-editor/collision.ts src/app/features/scene-editor/collision.spec.ts
git commit -m "feature-92: mark directional blocking cells"
```

---

### Task 4: Resolve footprints in `map-tiles.service.ts`

**Files:**

- Modify: `src/app/features/scene-editor/services/map-tiles.service.ts:69-89`
- Test: `src/app/features/scene-editor/services/map-tiles.service.spec.ts`

**Interfaces:**

- Consumes: `deriveAnchor`, `deriveFootprint` (Task 1).
- Produces: `loadTileVisuals(projectId, tileSizePx)` returns directional `footprints`, using `tile.anchor ?? deriveAnchor(frame0.w, frame0.h, ts)`.

- [ ] **Step 1: Update/add failing tests**

In `src/app/features/scene-editor/services/map-tiles.service.spec.ts`, replace footprint assertions with the directional shape and add an explicit-anchor case:

```ts
it('derives a bottom-anchored footprint for an oversized single frame', async () => {
  // seed a static tile with one 16x32 sprite
  const { footprints } = await service.loadTileVisuals(projectId, 16);
  expect(footprints[tileId]).toEqual({ left: 0, up: 1, right: 0, down: 0 });
});

it('uses a stored tile anchor instead of the derived default', async () => {
  // seed a 32x32 tile whose anchor is { x: 0, y: 0 }
  const { footprints } = await service.loadTileVisuals(projectId, 16);
  expect(footprints[tileId]).toEqual({ left: 0, up: 0, right: 1, down: 1 });
});
```

Follow the file's existing seeding helpers; any `{ w, h }` literal becomes the directional object.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/map-tiles.service.spec.ts'
```

Expected: FAIL — current code returns `{w, h}` and ignores `tile.anchor`.

- [ ] **Step 3: Implement**

In `src/app/features/scene-editor/services/map-tiles.service.ts`, add imports:

```ts
import { deriveAnchor, deriveFootprint } from '../../../shared/models/tile-anchor';
```

Replace lines 71-76 (the footprint computation inside the `for` loop):

```ts
for (const [tileId, sprites] of spritesByTile) {
  // All frames for this tile.
  images[tileId] = sprites.map((s) => s.pixelData);

  // Animation metadata when the tile has more than one frame.
  const tile = tileById.get(tileId);
  if (tile && tile.type === 'animated') {
    animations[tileId] = { frameCount: sprites.length, fps: tile.animationSpeed };
  }

  // Footprint from the first frame; the anchor is shared by all frames.
  const first = sprites[0];
  const anchor = tile?.anchor ?? deriveAnchor(first.width, first.height, tileSizePx);
  footprints[tileId] = deriveFootprint(first.width, first.height, tileSizePx, anchor);
}
```

Update the `@returns` JSDoc to say "directional footprints".

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/map-tiles.service.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/features/scene-editor/services/map-tiles.service.ts src/app/features/scene-editor/services/map-tiles.service.spec.ts
git commit -m "feature-92: resolve directional footprints in map-tiles service"
```

---

### Task 5: Absolute-rect render and placement in `map-canvas.component.ts`

**Files:**

- Modify: `src/app/features/scene-editor/map-canvas.component.ts` (render loop ~282-293; `footprintRectFor` ~747-773; `placeTile` ~776-782)
- Test: `src/app/features/scene-editor/map-canvas.component.spec.ts`

**Interfaces:**

- Consumes: `footprintRect`, `getFootprint` (Task 2).
- Produces: `footprintRectFor` returns the **absolute** rect; `placeTile` emits the absolute rect origin `{x, y, tileId}`; the render loop draws each anchor at its absolute rect.

- [ ] **Step 1: Update/add failing tests**

In `src/app/features/scene-editor/map-canvas.component.spec.ts`, the `setup(scene, footprints)` helper's footprint parameter type becomes `Record<number, { left: number; up: number; right: number; down: number }>`. Keep the existing down-right cases (their numeric expectations are unchanged) and add:

```ts
it('draws an upward-overhanging tile at its absolute rect', () => {
  setup(makeScene(4, 4), { 1: { left: 0, up: 1, right: 0, down: 0 } });
  // select tile 1, place at anchor cell (1, 1)
  // expect drawImage called with (16, 0, 16, 32) at cell=16
});
```

Adapt to the file's existing drawImage-spy + `click(cellX, cellY)` helpers; assert the emitted `tilePlaced` event is `{ x: 1, y: 1, tileId: 1 }` and the hover cell is `{ x: 1, y: 0, w: 1, h: 2 }`.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/map-canvas.component.spec.ts'
```

Expected: FAIL — footprint type mismatch / wrong rect.

- [ ] **Step 3: Implement**

In `src/app/features/scene-editor/map-canvas.component.ts`, update the import from `./map-footprint` to include `footprintRect`.

Replace the render loop (lines 282-293):

```ts
for (const { x, y, tileId } of anchors) {
  const rect = footprintRect(x, y, tileId, this.tileFootprints());
  const frames = tileImages[tileId];
  const frameIdx = this.frameIndices.get(tileId) ?? 0;
  const img = frames?.[frameIdx];
  if (img) {
    ctx.drawImage(img, rect.x * cell, rect.y * cell, rect.w * cell, rect.h * cell);
  } else {
    ctx.fillStyle = this.getTileColor(tileId);
    ctx.fillRect(rect.x * cell, rect.y * cell, rect.w * cell, rect.h * cell);
  }
}
```

Replace `footprintRectFor` (lines 747-773):

```ts
  private footprintRectFor(
    event: MouseEvent,
  ): { x: number; y: number; w: number; h: number } | null {
    const scene = this.scene();
    const tileId = this.selectedTileId();
    if (!scene || tileId === null) return null;

    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const cell = this.tileSize();
    const x = Math.floor((event.clientX - rect.left - this.cameraX()) / (cell * this.zoom()));
    const y = Math.floor((event.clientY - rect.top - this.cameraY()) / (cell * this.zoom()));

    const placement = footprintRect(x, y, tileId, this.tileFootprints());
    const padLeft = Math.max(0, -placement.x);
    const padRight = Math.max(0, placement.x + placement.w - scene.width);
    const padTop = Math.max(0, -placement.y);
    const padBottom = Math.max(0, placement.y + placement.h - scene.height);
    if (
      padLeft > MAX_EXPAND_TILES ||
      padRight > MAX_EXPAND_TILES ||
      padTop > MAX_EXPAND_TILES ||
      padBottom > MAX_EXPAND_TILES
    ) {
      return null;
    }
    return placement;
  }
```

`placeTile` (lines 776-782) is unchanged: it already emits `{ x: rect.x, y: rect.y, tileId }`, now the absolute rect origin. Update the `footprintRectFor` JSDoc `@returns` to "absolute footprint rectangle".

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/map-canvas.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/features/scene-editor/map-canvas.component.ts src/app/features/scene-editor/map-canvas.component.spec.ts
git commit -m "feature-92: render and place tiles at absolute footprint rects"
```

---

### Task 6: Absolute-rect render in `scene-minimap.component.ts`

> **Depends on PR #91 (`test/spec-coverage`) being merged** — `scene-minimap.component.spec.ts` only exists on that branch. If #91 is not yet merged when you start, wait for it, then branch `feature-92` from the updated `develop`.

**Files:**

- Modify: `src/app/features/scene-editor/minimap/scene-minimap.component.ts:182-193`
- Test: `src/app/features/scene-editor/minimap/scene-minimap.component.spec.ts`

**Interfaces:**

- Consumes: `footprintRect` (Task 2).
- Produces: the minimap draws each tile at `(rect.x * cell * scale, rect.y * cell * scale, rect.w * cell * scale, rect.h * cell * scale)`.

- [ ] **Step 1: Add the failing test**

In `scene-minimap.component.spec.ts`, using its `makeScene`/`emptyTiles` helpers and the fake-`ctx` spy, add:

```ts
it('draws an upward-overhanging tile across two cells', () => {
  // scene 4x4, cell 16, two layers, tile 1 at anchor (1,1) with footprint {0,1,0,0}
  // canvas forced to 100x100 -> scale = 100 / 64 = 1.5625, cell*scale = 25
  // expect fillRect(25, 0, 25, 50) (or drawImage at the same rect when cached)
});
```

Follow the file's existing "force canvas size then re-set input" pattern to retrigger `render()`.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
devbox run npx ng test --watch=false --include='**/scene-minimap.component.spec.ts'
```

Expected: FAIL — tile drawn as a single cell.

- [ ] **Step 3: Implement**

In `src/app/features/scene-editor/minimap/scene-minimap.component.ts`, update the import from `../map-footprint` to include `footprintRect`.

Replace the inner draw (lines 184-192):

```ts
const tileId = layer.tileData[y]?.[x] ?? -1;
if (tileId < 0) continue;
const rect = footprintRect(x, y, tileId, this.tileFootprints());
const dx = rect.x * cell * scale;
const dy = rect.y * cell * scale;
const dw = rect.w * cell * scale;
const dh = rect.h * cell * scale;
const img = this.imageCache.get(tileId);
if (img) {
  ctx.drawImage(img, dx, dy, dw, dh);
} else {
  ctx.fillStyle = '#94b0c2';
  ctx.fillRect(dx, dy, dw, dh);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
devbox run npx ng test --watch=false --include='**/scene-minimap.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/features/scene-editor/minimap/scene-minimap.component.ts src/app/features/scene-editor/minimap/scene-minimap.component.spec.ts
git commit -m "feature-92: draw footprint rects in the scene minimap"
```

---

### Task 7: Anchor-aware placement in `scene-editor.component.ts`

**Files:**

- Modify: `src/app/features/scene-editor/scene-editor.component.ts:654-698`
- Test: `src/app/features/scene-editor/scene-editor.component.spec.ts:337,381`

**Interfaces:**

- Consumes: `getFootprint`, `footprintRect`, `clearOverlappedAnchors` (Task 2).
- Produces: `onTilePlaced` recomputes the anchor from the absolute rect origin and clears overlaps against the placed absolute rect.

- [ ] **Step 1: Update the failing tests**

In `src/app/features/scene-editor/scene-editor.component.spec.ts`, change the two footprint fixtures (`{ 1: { w: 2, h: 2 } }` → `{ 1: { left: 0, up: 0, right: 1, down: 1 } }`; `{ 9: { w: 1, h: 1 } }` → `{ 9: { left: 0, up: 0, right: 0, down: 0 } }`). The existing expected tileData matrices stay identical. Add an overhang-placement case:

```ts
it('places a bottom-anchored tile and grows the scene upward', async () => {
  // footprint { 1: { left: 0, up: 1, right: 0, down: 0 } }
  // onTilePlaced({ x: 1, y: 1, tileId: 1 }) on a 3x3 scene
  // expect anchor at (1,1), footprint covers (1,0); scene stays 3x3 (fits inside)
  // and tileData[1][1] === 1
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/scene-editor.component.spec.ts'
```

Expected: FAIL — `onTilePlaced` still reads `{w, h}`.

- [ ] **Step 3: Implement**

In `src/app/features/scene-editor/scene-editor.component.ts`, update the `./map-footprint` import to include `footprintRect` (keep `getFootprint`, `clearOverlappedAnchors`).

Replace the block at lines 654-698:

```ts
const fp = getFootprint(event.tileId, this.tileFootprints());
const placed = footprintRect(event.x, event.y, event.tileId, this.tileFootprints());
const padLeft = Math.max(0, -placed.x);
const padRight = Math.max(0, placed.x + placed.w - previousWidth);
const padTop = Math.max(0, -placed.y);
const padBottom = Math.max(0, placed.y + placed.h - previousHeight);

if (
  padLeft > MAX_EXPAND_TILES ||
  padRight > MAX_EXPAND_TILES ||
  padTop > MAX_EXPAND_TILES ||
  padBottom > MAX_EXPAND_TILES
) {
  this.notification.warning(
    'Placement too far from the map — the scene can grow by at most 16 tiles per direction.',
  );
  return;
}

const newWidth = previousWidth + padLeft + padRight;
const newHeight = previousHeight + padTop + padBottom;
const anchorX = event.x + padLeft + fp.left;
const anchorY = event.y + padTop + fp.up;

const newLayers = scene.layers.map((l, i) => {
  const grown = growTileData(l.tileData, padLeft, padRight, padTop, padBottom, newWidth, newHeight);
  if (i !== layerIdx) return { ...l, tileData: grown };
  const placedRect = {
    x: placed.x + padLeft,
    y: placed.y + padTop,
    w: placed.w,
    h: placed.h,
  };
  const cleared = clearOverlappedAnchors(
    grown,
    placedRect.x,
    placedRect.y,
    placedRect.w,
    placedRect.h,
    this.tileFootprints(),
  );
  cleared[anchorY][anchorX] = event.tileId;
  return { ...l, tileData: cleared };
});
```

Update the `onTilePlaced` JSDoc `@param event` line to note that `x`/`y` are the placed tile's absolute footprint top-left.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/scene-editor.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/features/scene-editor/scene-editor.component.ts src/app/features/scene-editor/scene-editor.component.spec.ts
git commit -m "feature-92: place tiles via absolute footprint rects"
```

---

### Task 8: `Tile.anchor` field + static single-frame guard

**Files:**

- Modify: `src/app/shared/models/tile.model.ts:24`
- Modify: `src/app/features/tile-manager/services/tile.service.ts:57-59`
- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts:655-678`
- Test: `src/app/features/tile-manager/services/tile.service.spec.ts`, `src/app/features/sprite-editor/sprite-editor.component.spec.ts`

**Interfaces:**

- Consumes: `TileAnchor` (Task 1).
- Produces: `Tile.anchor?: TileAnchor`; `StaticTileFramesError`; `TileService.updateTile` throws for static + >1 frames; `onDuplicateFrame` passes `type`.

- [ ] **Step 1: Write the failing tests**

In `src/app/features/tile-manager/services/tile.service.spec.ts`, add:

```ts
import { StaticTileFramesError } from './tile.service';

it('rejects saving more than one frame on a static tile', async () => {
  const tile = await service.createTile(projectId, 'Tree');
  await expect(service.updateTile(tile.id, { spriteIds: [1, 2] })).rejects.toBeInstanceOf(
    StaticTileFramesError,
  );
  const stored = await service.getTiles(projectId);
  expect(stored[0].spriteIds).toEqual([]);
});

it('allows multiple frames when the same call promotes to animated', async () => {
  const tile = await service.createTile(projectId, 'Water');
  await expect(
    service.updateTile(tile.id, { type: 'animated', spriteIds: [1, 2] }),
  ).resolves.toBeUndefined();
});
```

In `src/app/features/sprite-editor/sprite-editor.component.spec.ts`, add a duplicate-frame test asserting `TileService.updateTile` is called with `type: 'animated'` when duplicating a single-frame static tile (mock the service and assert the argument via `expect.objectContaining({ type: 'animated' })`).

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/tile.service.spec.ts' --include='**/sprite-editor.component.spec.ts'
```

Expected: FAIL — `StaticTileFramesError` is not exported; no guard; `onDuplicateFrame` sends no `type`.

- [ ] **Step 3: Implement**

In `src/app/shared/models/tile.model.ts`, add after the `spriteIds` field (line 17):

```ts
  /**
   * Optional ground-cell anchor in pixels (top-left of the `ts×ts` zone,
   * relative to the frame). Shared by all frames. When absent, the anchor is
   * derived as bottom-center (see `deriveAnchor`).
   */
  anchor?: TileAnchor;
```

and add the import at the top:

```ts
import type { TileAnchor } from './tile-anchor';
```

In `src/app/features/tile-manager/services/tile.service.ts`, add the error class after the imports:

```ts
/**
 * Raised when an update would leave a `static` tile with more than one frame.
 * Callers promote the tile to `animated` in the same {@link TileService.updateTile}
 * call, or reduce the frame list.
 */
export class StaticTileFramesError extends Error {
  constructor(id: number) {
    super(`Tile ${id} is static and cannot hold more than one frame`);
    this.name = 'StaticTileFramesError';
  }
}
```

Replace `updateTile` (lines 57-59):

```ts
  /**
   * Partially updates a tile by id, enforcing the static single-frame invariant.
   * A `static` tile may hold at most one sprite; pass `type: 'animated'` in the
   * same call to promote a tile while adding frames.
   * @param id - The tile id to update.
   * @param changes - Partial tile fields to apply.
   * @throws {StaticTileFramesError} When the effective type stays `static` while
   *     `changes.spriteIds` holds more than one frame.
   */
  async updateTile(id: number, changes: Partial<Omit<Tile, 'id'>>): Promise<void> {
    if (changes.spriteIds && changes.spriteIds.length > 1) {
      const current = await this.db.tiles.get(id);
      const effectiveType = changes.type ?? current?.type ?? 'static';
      if (effectiveType === 'static') {
        throw new StaticTileFramesError(id);
      }
    }
    await this.db.tiles.update(id, changes);
  }
```

In `src/app/features/sprite-editor/sprite-editor.component.ts` `onDuplicateFrame` (lines 632-688), compute the promoted type once before the `updateTile` calls:

```ts
const newSpriteIds = [...tile.spriteIds.filter((_, i) => i !== 0), newSprite.id];
const newSpriteIdsFull = [...tile.spriteIds];
newSpriteIdsFull.splice(tile.spriteIds.indexOf(frameId) + 1, 0, newSprite.id);
```

Replace with a single `newSpriteIds` list (keep the existing splice logic), then define:

```ts
const newSpriteIds = [...tile.spriteIds];
newSpriteIds.splice(tile.spriteIds.indexOf(frameId) + 1, 0, newSprite.id);
const newType = newSpriteIds.length > 1 ? 'animated' : tile.type;
const prevSpriteIds = tile.spriteIds;
const prevType = tile.type;
```

and send `{ spriteIds: newSpriteIds, type: newType }` in the main call (line 655) and both undo/redo closures (lines 666, 678).

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/tile.service.spec.ts' --include='**/sprite-editor.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/shared/models/tile.model.ts src/app/features/tile-manager/services/tile.service.ts src/app/features/sprite-editor/sprite-editor.component.ts src/app/features/tile-manager/services/tile.service.spec.ts src/app/features/sprite-editor/sprite-editor.component.spec.ts
git commit -m "feature-92: enforce static single-frame invariant"
```

---

### Task 9: `createFramesFrom` promotion + `applySize` anchor clamp

**Files:**

- Modify: `src/app/features/tile-manager/properties/tile-properties.component.ts:325-339,460-477`
- Test: `src/app/features/tile-manager/properties/tile-properties.component.spec.ts`

**Interfaces:**

- Consumes: `clampAnchor` (Task 1); `tile.anchor` (Task 8).
- Produces: `createFramesFrom` promotes to `animated`; `applySize` persists a clamped anchor after a resize.

- [ ] **Step 1: Write the failing tests**

In `src/app/features/tile-manager/properties/tile-properties.component.spec.ts`, add:

```ts
it('promotes a static tile to animated when adding a second frame', async () => {
  // tile with one sprite; call createFramesFrom(1, 2)
  // expect updateTile called with { spriteIds: [...], type: 'animated' }
});

it('clamps the stored anchor after a resize', async () => {
  // tile.anchor = { x: 24, y: 48 }, resize to 1x1 cells at ts=16
  // expect updateTile called with { anchor: { x: 0, y: 0 } }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/tile-properties.component.spec.ts'
```

Expected: FAIL — no `type` on the frame-add update; no anchor clamp.

- [ ] **Step 3: Implement**

In `createFramesFrom` (lines 474-476), include the promoted type:

```ts
const total = t.spriteIds.length + ids.length;
await this.tileService.updateTile(t.id, {
  spriteIds: [...t.spriteIds, ...ids],
  type: total > 1 ? 'animated' : t.type,
});
```

In `applySize`, after the resize succeeds (line 333), clamp the stored anchor:

```ts
await this.spriteService.resizeSprites(this.tileSprites(), w * ts, h * ts, palette);
const currentTile = this.tile();
if (currentTile?.anchor) {
  const clamped = clampAnchor(currentTile.anchor, w * ts, h * ts, ts);
  await this.tileService.updateTile(currentTile.id, { anchor: clamped });
}
await this.spriteService.markMutated();
```

Add `import { clampAnchor } from '../../../shared/models/tile-anchor';`.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/tile-properties.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/features/tile-manager/properties/tile-properties.component.ts src/app/features/tile-manager/properties/tile-properties.component.spec.ts
git commit -m "feature-92: promote promoted frames and clamp anchor on resize"
```

---

### Task 10: Anchor round-trip + import normalization in project I/O

**Files:**

- Modify: `src/app/shared/models/project-archive.model.ts:45-74`
- Modify: `src/app/core/services/project-io.service.ts` (export tiles ~93-101; import tiles ~179-208)
- Test: `src/app/core/services/project-io.service.spec.ts`

**Interfaces:**

- Consumes: `clampAnchor` (Task 1); `TileAnchor` type.
- Produces: `TileArchiveItem.anchor?: TileAnchor`; export writes it; import trims static tiles to the oldest frame, skips dropped sprites, clamps the anchor to the kept frame, and derives when absent.

- [ ] **Step 1: Write the failing tests**

In `src/app/core/services/project-io.service.spec.ts`, using its `seedProject`/`validJsonOverrides` helpers, add:

```ts
it('round-trips a stored anchor', async () => {
  // seed a tile with anchor { x: 8, y: 16 }; export then import
  // expect the imported tile's anchor to equal { x: 8, y: 16 }
});

it('trims a static archive tile to its oldest frame on import', async () => {
  // archive tile type 'static' with two spriteIds -> imported tile keeps one
});

it('clamps the imported anchor to the kept frame bounds', async () => {
  // archive anchor { x: 40, y: 40 } on a 16x32 frame -> imported anchor { x: 0, y: 16 }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/project-io.service.spec.ts'
```

Expected: FAIL — archive carries no anchor; import keeps two static frames.

- [ ] **Step 3: Implement**

In `src/app/shared/models/project-archive.model.ts`, add to `TileArchiveItem` (after `folderPath`):

```ts
  /**
   * Optional ground-cell anchor in pixels. Absent in v1 archives created before
   * the anchor feature; the importer derives the default when absent.
   */
  anchor?: TileAnchor;
```

with `import type { TileAnchor } from './tile-anchor';` at the top.

In `src/app/core/services/project-io.service.ts` export mapping (lines 93-101), add:

```ts
        anchor: t.anchor,
```

In `importProject`, before the tile-insert loop (line 179), precompute the normalized tiles:

```ts
const normalizedTiles = archive.tiles.map((t) => {
  if (t.type === 'static' && t.spriteIds.length > 1) {
    const kept = [...t.spriteIds].sort((a, b) => a - b)[0];
    return { ...t, spriteIds: [kept] };
  }
  return t;
});
const keptSpriteIds = new Set(normalizedTiles.flatMap((t) => t.spriteIds));
```

Insert tiles from `normalizedTiles` (not `archive.tiles`), writing `anchor: t.anchor` into the row. In the sprite loop (line 191), skip sprites not in `keptSpriteIds`:

```ts
for (const s of archive.sprites) {
  if (!keptSpriteIds.has(s.sourceId)) continue;
  // ...existing add
}
```

Keep the existing `spriteIds` patch loop (line 203) but iterate `normalizedTiles`. After it, add an anchor-clamp pass using the tile's first kept frame size (sprite insert order is by `sourceId`, so the first sprite of a tile is its oldest frame):

```ts
const frameSize = new Map<number, { width: number; height: number }>();
for (const s of archive.sprites) {
  if (!frameSize.has(s.tileSourceId)) {
    frameSize.set(s.tileSourceId, { width: s.width, height: s.height });
  }
}
for (const t of normalizedTiles) {
  if (!t.anchor) continue;
  const size = frameSize.get(t.sourceId);
  if (!size) continue;
  const newId = tileIdMap.get(t.sourceId)!;
  await this.db.tiles.update(newId, {
    anchor: clampAnchor(t.anchor, size.width, size.height, project.tileSize),
  });
}
```

Add `import { clampAnchor } from '../../shared/models/tile-anchor';`.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/project-io.service.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
devbox run npm run lint
git add src/app/shared/models/project-archive.model.ts src/app/core/services/project-io.service.ts src/app/core/services/project-io.service.spec.ts
git commit -m "feature-92: round-trip tile anchors and normalize on import"
```

---

### Task 11: Re-author the demo tree as one 16×32 sprite

**Files:**

- Modify: `src/app/core/services/demo-art.ts:76-99` (add `treeIndices`), `:25` (`TREE_ROW_Y`)
- Modify: `src/app/core/services/demo-project.service.ts:106-170`
- Test: `src/app/core/services/demo-project.service.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `treeIndices(): number[][]` (16×32 grid); demo tree = one sprite `'Tree'` width 16 height 32, `spriteIds: [id]`; `TREE_ROW_Y = 2`.

- [ ] **Step 1: Update the failing tests**

In `src/app/core/services/demo-project.service.spec.ts`, update expectations:

```ts
// tree tile
expect(tree.spriteIds.length).toBe(1);
// sprite count 7 -> 6
expect(sprites.length).toBe(6);
// the tree sprite is 16x32
const treeSprite = sprites.find((s) => s.name === 'Tree')!;
expect(treeSprite.width).toBe(16);
expect(treeSprite.height).toBe(32);
// tree row moved to y=2
```

Adjust any loop asserting every sprite is 16×16 to exempt the tree (height 32).

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/demo-project.service.spec.ts'
```

Expected: FAIL — tree still has two sprites.

- [ ] **Step 3: Implement**

In `src/app/core/services/demo-art.ts`, change `TREE_ROW_Y`:

```ts
/** Row of ySort trees (canopy overhangs one cell above the ground row). */
export const TREE_ROW_Y = 2;
```

Add a new export after `foliageIndices`:

```ts
/** Single 16×32 tree: canopy on top (rows 0-15), ground-anchored trunk below. */
export function treeIndices(): number[][] {
  return [...foliageIndices(), ...trunkIndices()];
}
```

In `src/app/core/services/demo-project.service.ts`, update the import list (line 25-30) to add `treeIndices` and drop `trunkIndices`/`foliageIndices` if now unused. Give the `sprite` helper optional size params:

```ts
const sprite = (
  tileId: number,
  name: string,
  indices: number[][],
  width = DEMO_TILE_SIZE,
  height = DEMO_TILE_SIZE,
) =>
  ({
    projectId,
    tileId,
    name,
    width,
    height,
    pixelData: encodePixelData(indices, palette),
    paletteIndices: indices,
  }) as Sprite;
```

Replace the trunk/foliage creation (lines 157-160) with:

```ts
const treeSpriteId = await this.db.sprites.add(
  sprite(treeTileId, 'Tree', treeIndices(), DEMO_TILE_SIZE, DEMO_TILE_SIZE * 2),
);
```

and update line 168:

```ts
await this.db.tiles.update(treeTileId, { spriteIds: [treeSpriteId] });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
devbox run npx ng test --watch=false --include='**/demo-project.service.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Full suite, lint, commit**

```bash
devbox run npm run test
devbox run npm run lint
git add src/app/core/services/demo-art.ts src/app/core/services/demo-project.service.ts src/app/core/services/demo-project.service.spec.ts
git commit -m "feature-92: re-author the demo tree as one 16x32 sprite"
```

---

## Self-review checklist

- [ ] `static` never persists with >1 frame (guard + all three add-frame paths promote).
- [ ] No importer of `map-footprint.ts` breaks (path kept; type via re-export).
- [ ] Absolute-rect math is identical in render, minimap, placement, and collision.
- [ ] Legacy rows without `anchor` derive a footprint (no Dexie bump).
- [ ] Import of v1 archives (no `anchor`) succeeds and derives.
- [ ] Demo tree renders with canopy (single 16×32, `TREE_ROW_Y = 2`).
- [ ] `devbox run npm run lint` and `devbox run npm run test` both clean.
