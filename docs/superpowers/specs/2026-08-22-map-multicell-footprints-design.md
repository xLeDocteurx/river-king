# Design: Multi-cell tile footprints on the map canvas

Date: 2026-08-22
Status: Approved (pending implementation)

## Problem

The map canvas draws every placed tile into a single fixed 16x16 cell
(`MapCanvasComponent.tileSize`, hardcoded). Task 6 introduced per-tile sprite
sizes larger than one grid unit (e.g. a "2x2" tile produces a 32x32 px sprite).
Such sprites are currently squashed into one cell instead of covering their
full footprint on the map.

Additionally, the canvas ignores the project's `tileSize` setting entirely.

## Goals

- Tiles whose sprites span multiple grid cells render at their full footprint.
- Placement of a multi-cell tile replaces overlapped tiles ("Replace" policy,
  user decision).
- The canvas respects the project's `tileSize` instead of a hardcoded 16.
- All new logic must be testable under jsdom (no dependency on decoded image
  dimensions).

## Non-goals (YAGNI)

- Erase tool / right-click removal.
- Hover ghost preview while placing.
- Storing tileId in every covered cell (rejected "fill-all-cells" model).
- Rotation, flipping, per-cell cropping.

## Key facts driving the design

- `Sprite.width` / `Sprite.height` are stored in pixels (DB fields).
- `Scene.tileData[y][x]` stores one tile id per cell (`-1` = empty). Only the
  anchor cell of a placement carries the id; covered cells are virtual.
- `MapTilesService` already resolves the first sprite (lowest id) per tile id
  and returns data URIs; sprites with `tileId <= 0` are ignored.

## Architecture

### 1. MapTilesService

`loadTileImages(projectId)` is replaced by:

```ts
loadTileVisuals(projectId: string, tileSizePx: number):
  Promise<{ images: Record<number, string>; footprints: Record<number, { w: number; h: number }> }>
```

- Same DB query as before feeds both outputs in one pass.
- Footprints are expressed in **grid cells** computed from DB fields:
  `w = max(1, ceil(sprite.width / tileSizePx))`, same for `h`.
- First-sprite-per-tile rule unchanged (lowest id = first animation frame);
  animated tiles therefore use frame 1 dimensions, which is valid because
  `resizeSprites` keeps frames uniform.
- `tileSizePx` comes from the caller (the editor knows the project).

### 2. Pure geometry helpers — `features/scene-editor/map-footprint.ts`

Flat file inside the feature, exported pure functions shared by the canvas
and the editor (fully unit-testable):

- `getFootprint(tileId, footprints): { w: number; h: number }` — defaults to
  `{ w: 1, h: 1 }` when the tile has no entry.
- `clearOverlappedAnchors(tileData, x, y, w, h, footprints): number[][]` —
  returns a new tileData array where every existing anchor whose footprint
  intersects the rectangle `(x, y, w, h)` is removed (set to `-1`). This
  implements the Replace policy.

### 3. MapCanvasComponent rendering

New inputs:

- `tileSize = input(16)` — pixels per grid cell, from the project.
- `tileFootprints = input<Record<number, { w: number; h: number }>>({})`.

The hardcoded `private readonly tileSize = 16` is removed; every use site
(grid lines, draw coordinates, click math) reads `this.tileSize()`.

Render algorithm:

1. Collect anchors: every cell with `tileId >= 0`.
2. Build a coverage set by walking each anchor's footprint rect.
3. Draw each anchor exactly once at `(x * cell, y * cell)` sized
   `(w * cell, h * cell)` — image stretched over the footprint, palette-color
   fallback filling the same rect.
4. Skip cells that are covered but not anchors (already painted).

The constructor effect also tracks `tileSize()` and `tileFootprints()`.

### 4. Placement flow

- Click point = top-left corner of the footprint (anchor).
- `placeTile()` validates that the **entire** footprint fits inside the scene
  bounds before emitting; payload stays `{ x, y, tileId }`. Overlap is NOT
  checked in the canvas — policy lives in the editor.
- `SceneEditorComponent.onTilePlaced()` calls
  `clearOverlappedAnchors(...)`, then writes the anchor cell, then persists
  once via `sceneService.updateScene`.

### 5. Data flow summary

```
MapTilesService.loadTileVisuals(projectId, projectTileSize)
        │
        ├─ images ───────► MapCanvas [tileImages]      (existing)
        └─ footprints ───► MapCanvas [tileFootprints]
                        └─► SceneEditor (replace logic)
project.tileSize ───────► MapCanvas [tileSize]
```

Both visuals signals load during `loadProjectData()`. Re-entering the scene
editor after editing sprites reloads them (route re-creates the component),
so no reactive invalidation is needed within the feature.

## Edge cases

| Case | Behavior |
| --- | --- |
| No footprint entry for a tile | Treated as 1x1 |
| Sprite dims not multiples of cell size | `ceil` — partial edge cell covered |
| Animated tile | Frame 1 dims apply to all frames |
| Footprint would exceed scene bounds | Canvas refuses to emit (no partial placement) |
| Legacy maps with tileSize != 16 projects | Grid rescales via `[tileSize]`; existing single-cell placements render correctly |

## Error handling

- `loadTileVisuals` failures surface through the existing
  `notification.error('Failed to load tile images.')` path in
  `loadProjectData()`.
- Placement persistence errors keep the current try/catch + toast behavior.

## Testing (~8 new tests)

- **map-tiles.service.spec.ts** (extend): footprints computed with ceil and
  min-1 clamp; custom `tileSizePx` respected; first-frame dims; `tileId <= 0`
  still ignored; project isolation preserved.
- **map-canvas.component.spec.ts** (new): clicking inside bounds emits the
  correct `{ x, y, tileId }`; clicking near the edge with a large selected
  footprint emits nothing; default 1x1 when no footprints provided. Rendering
  itself cannot be asserted under jsdom (no canvas implementation) — geometry
  helpers carry that burden instead.
- **map-footprint.spec.ts** (new): `getFootprint` default + lookup;
  `clearOverlappedAnchors` removes only intersecting anchors, preserves
  others, does not mutate input.
- **scene-editor.component.spec.ts** (extend): placing a multi-cell tile
  clears an overlapping anchor and persists the merged result.
