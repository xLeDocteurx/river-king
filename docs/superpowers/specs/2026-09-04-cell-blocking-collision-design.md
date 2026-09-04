# #51-a Cell-Level Blocking Tile Collision (foundation)

Date: 2026-09-04
Status: Draft
Linked issue: #51
Epic: #48
Follow-up: #58 (pixel-perfect collision masks)

## Problem

Part of the Mode Play work (epic: #48, depends on the player controller #49). The
tile model already carries a `TileProperties.blocking` flag, but nothing consumes
it at runtime. This US makes blocking tiles physically stop the player: the
foundation of all future collision work.

The player hitbox is a **fixed 0.5×0.5 cell AABB, centered on the player
position**. Per-pixel collision masks (painted in the tile editor) are out of scope
here and tracked in #58. A drawable, configurable player hitbox is tracked in #60.

## User story

As a level designer, when I enter Play mode and my player walks into a tile flagged
as blocking, the player stops instead of walking through — while still sliding
along walls. Designers can rely on `blocking` per tile, and the footprint of
multi-cell tiles blocks entirely.

## Design decisions (finalized 2026-09-04)

- **Player position = center.** `player.x/y` (grid cells, fractional) represent the
  center of the player. The spawn start position is offset by `+0.5/+0.5` so the
  player centers exactly on the spawn cell (matching how the spawn marker is drawn:
  at the center of the cell).
- **Hitbox = fixed 0.5×0.5 AABB** spanning `[x-0.25, x+0.25] × [y-0.25, y+0.25]`.
- **Only visible layers collide.** A layer contributes to collision when
  `layer.visible === true`, **regardless of opacity** (a layer at 0% opacity still
  collides). Hidden layers (`visible === false`) are ignored — matching how
  rendering skips hidden layers.
- **Blocking covers the full footprint.** A tile with `blocking === true` blocks
  every cell of its grid-cell footprint (`getFootprint` / `TileFootprintMap`).
- **Axis-separated resolution.** X is resolved first, then Y, giving natural wall
  sliding and preventing snagging on corners.
- **Pure function module.** Collision logic lives in a pure TS module (like
  `map-footprint.ts` / `autogrow.ts`), fully testable without Angular. The player
  controller keeps the precomputed blocking grid and calls the resolver.

## Architecture

### Coordinate model

- Spawn: `(spawn.x + 0.5, spawn.y + 0.5)`.
- Placeholder render (Play mode): the 1×1 cell box is drawn centered on the
  position: `fillRect((px-0.5)*cell, (py-0.5)*cell, cell, cell)`.
- Camera follow: centers on `(px*cell, py*cell)`.
- Bounds: the AABB stays inside `[0, width] × [0, height]`; the center is clamped
  to `[0.25, width-0.25] × [0.25, height-0.25]`.

### New pure module `collision.ts` (scene-editor feature)

```ts
/**
 * Builds a 2D boolean grid marking which cells block player movement.
 * Only layers with `visible === true` contribute; blocking tiles mark their full
 * footprint. Returns a `height×width` array of booleans (`grid[y][x]`).
 *
 * @param width   - Scene width in cells.
 * @param height  - Scene height in cells.
 * @param layers  - Scene layers (rendering order; only visibility is read).
 * @param blockingById - Map of tileId -> blocking flag.
 * @param footprints - Grid-cell footprint per tileId (absent -> 1x1).
 * @returns The blocking grid; out-of-scene cells are treated as blocked by the resolver.
 */
export function buildBlockingGrid(
  width: number,
  height: number,
  layers: Layer[],
  blockingById: Map<number, boolean>,
  footprints: TileFootprintMap,
): boolean[][];

/**
 * Resolves a player movement on one axis/position update against the blocking
 * grid, axis-separated (X first, then Y), preventing tunneling at normal speeds.
 * The returned center position never overlaps a blocked cell nor leaves bounds.
 *
 * @param pos    - Current center position in cells (fractional).
 * @param move   - Requested delta this frame, in cells.
 * @param half   - Hitbox half-extent (0.25).
 * @param grid   - Blocking grid from buildBlockingGrid.
 * @param bounds - Scene size in cells.
 * @returns The resolved center position.
 */
export function resolveCollision(
  pos: { x: number; y: number },
  move: { x: number; y: number },
  half: number,
  grid: boolean[][],
  bounds: { width: number; height: number },
): { x: number; y: number };
```

Resolution detail: when the leading AABB edge would enter a blocked cell, the
center is clamped so the edge rests flush against the cell boundary
(`center = integerBoundary ± 0.25`). Cells outside the scene (out of bounds) are
treated as blocked, which naturally replaces the current `Math.min/max` bounds
clamp in `PlayerController.update`.

### Integration

- `SceneEditorComponent.enterPlay()`:
  - Builds `blockingById = new Map(projectTiles().map(t => [t.id, t.properties.blocking]))`.
  - Calls `player.start(scene, spawn, blockingById, tileFootprints())`.
- `PlayerController.start(scene, spawn, blockingById, footprints)`:
  - Stores `blockingGrid = buildBlockingGrid(scene.width, scene.height, scene.layers, blockingById, footprints)`.
  - Sets `x = spawn.x + 0.5`, `y = spawn.y + 0.5`.
- `PlayerController.update(dt)`:
  - Computes the normalized movement vector as today.
  - Calls `resolveCollision({ x, y }, { dx*speed*dt, dy*speed*dt }, 0.25, blockingGrid, bounds)`.
  - Writes the resolved position to `x`/`y` signals.
  - The existing `Math.max(0, Math.min(...))` clamp is removed (absorbed by the resolver).

## Edge cases

- **1-cell corridors are walkable** because the 0.5 hitbox is narrower than a cell.
- **Spawn inside a blocking tile** leaves the player stuck (no depenetration).
  Out of scope for this US; noted so future US (depenetration / spawn validation)
  can pick it up.
- **Multi-cell blocking tiles** block their whole footprint, so large tiles behave
  like solid blocks.
- **Diagonal movement** is normalized before resolution, and the axis separation
  yields standard sliding behavior.

## Testing

- `buildBlockingGrid`:
  - Only visible layers contribute; a hidden layer is ignored.
  - A layer at opacity `0` still contributes.
  - A blocking tile marks its full multi-cell footprint.
  - `blocking === false` tiles stay walkable; empty cells stay walkable.
- `resolveCollision`:
  - Stops before a perpendicular blocking tile.
  - Slides along a wall when moving diagonally into it.
  - Does not tunnel through a blocking tile even at a large `move` delta.
  - Clamps the center to scene bounds.
  - Returns the requested position when nothing is blocked.
- `PlayerController`:
  - Spawn centers on the spawn cell (`x = spawn.x + 0.5`).
  - Player stops against a blocking tile instead of crossing it.
  - Sliding along a wall works.
  - Movement is unchanged on fully walkable scenes.

## Performance considerations

One `boolean[][]` grid built once per Play entry; resolution is O(cells touched
per axis). Negligible for scene sizes in this editor.

## Out of scope

- Pixel-perfect collision masks (#58).
- Drawable/configurable player hitbox (#60).
- Depenetration / validating spawn not inside a blocking tile.
- Trigger actions on `interactable` tiles (#52).
