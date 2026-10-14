# Tile Collision Masks — Design

> **Issue:** #58 — *Runtime: pixel-perfect tile collision masks*
> **Status:** Approved (autonomous run; user review waived)
> **Related:** #14 (collision/footprint visibility toggle), #51 (cell-level blocking collision)

## Goal

Let a blocking tile expose an optional **per-pixel collision mask** so the runtime
player hitbox resolves against the tile's real opaque pixels instead of its whole
grid footprint. When a tile has no mask it keeps blocking its full footprint
(behaviour shipped in #51).

## Non-goals

- No change to the scene-editor visibility overlay from #14 (still marks the whole
  footprint of blocking tiles).
- No per-frame masks: a mask is a **tile-level** property shared by every frame.
- No automatic mask generation from sprite alpha.
- No change to the fixed 0.5×0.5 player hitbox or the axis-separated sweep.

---

## Data model

Add an optional field to `Tile` (`src/app/shared/models/tile.model.ts`):

```ts
/**
 * Optional per-pixel collision mask shared by all frames. `1` = solid,
 * `0` = passable; dimensions match the frame artwork. When absent or `null`
 * the tile blocks its full footprint (cell-level behaviour from #51).
 */
collisionMask?: number[][] | null;
```

Rationale for a **tile-level** mask rather than a per-sprite one:

- Collision is a gameplay property of the tile, like `properties.blocking`.
- All frames of a tile are authored at the same dimensions, so one mask covers them.
- The runtime resolves by `tileId`, so a single per-tile lookup is enough.

The mask dimensions are implicit in the array (`mask.length` rows × `mask[0].length`
columns), so no extra metadata is needed. A mask whose dimensions do not match the
frame artwork still resolves — the mask is stretched across the tile's footprint
rectangle (see below), exactly like the sprite artwork is drawn.

## Mask → world mapping

A tile is drawn into its **footprint rectangle** (cells), computed by
`footprintRect(anchorX, anchorY, tileId, footprints)` → `{ x, y, w, h }` (in cells).
The whole `W×H` artwork (and therefore the mask) maps linearly onto that rect:

```
pixel (mx, my)  ->  cell-space rect
  x0 = rect.x + mx * (w / W)      x1 = rect.x + (mx + 1) * (w / W)
  y0 = rect.y + my * (h / H)      y1 = rect.y + (my + 1) * (h / H)
```

For the common case `W = w * tileSize` and `H = h * tileSize`, each mask pixel maps to
an exact `1/tileSize` sub-cell square. The general case (sprite larger or smaller than
its footprint) still works because the mapping is a plain scale.

## Runtime collision

### Types and helpers (`src/app/features/scene-editor/collision.ts`)

```ts
/** A solid sub-rectangle inside one grid cell, in world (cell) coordinates. */
export interface CellRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Per-tile collision inputs consumed by the field builder. */
export interface TileCollision {
  /** Blocks movement (from `Tile.properties.blocking`). */
  blocking: boolean;
  /** Optional per-pixel mask; `undefined`/`null` blocks the full footprint. */
  mask?: number[][] | null;
}

/** The resolved collision field for a scene. */
export interface CollisionField {
  /** Per-cell full blocking contributed by unmasked blocking tiles (`full[y][x]`). */
  full: boolean[][];
  /** Per-cell solid sub-rects from masked blocking tiles (`sub[y][x]`, null when none). */
  sub: (CellRect[] | null)[][];
}

/**
 * Builds the collision field for a scene. Only visible layers contribute
 * (opacity is ignored). Unmasked blocking tiles fill their whole footprint;
 * masked blocking tiles contribute one sub-rect per solid (>=1) mask pixel,
 * bucketed into the grid cell that contains it. Out-of-scene cells are
 * treated as blocked by the resolver.
 */
export function buildCollisionField(
  width: number,
  height: number,
  layers: Layer[],
  tiles: Map<number, TileCollision>,
  footprints: TileFootprintMap,
): CollisionField;
```

`buildBlockingGrid` is kept for backward compatibility and now delegates:

```ts
export function buildBlockingGrid(
  width: number,
  height: number,
  layers: Layer[],
  blockingById: Map<number, boolean>,
  footprints: TileFootprintMap,
): boolean[][] {
  const tiles = new Map<number, TileCollision>(
    [...blockingById].map(([id, blocking]) => [id, { blocking }]),
  );
  return buildCollisionField(width, height, layers, tiles, footprints).full;
}
```

### Resolver

`resolveCollision` gains an optional fifth parameter for the masked sub-rects and keeps
its current signature/behaviour when it is omitted (all #51 tests must stay green):

```ts
export function resolveCollision(
  pos: { x: number; y: number },
  move: { x: number; y: number },
  half: number,
  grid: boolean[][],
  bounds: { width: number; height: number },
  sub?: (CellRect[] | null)[][],
): { x: number; y: number };
```

The internal `blocked(col, row)` predicate becomes `blocked(col, row, aabb)` where
`aabb` is the tentative player rectangle for the axis being resolved:

- Out of scene → blocked.
- `grid[row][col]` true → blocked (unmasked tile / full footprint).
- Otherwise, if `sub?.[row]?.[col]` has rects, blocked **iff** the AABB's overlap with
  cell `[col,col+1]×[row,row+1]` intersects any sub-rect. No solid pixel under the AABB
  overlap ⇒ the cell does not block.

When the axis is blocked, the existing clamping (`x = col - half`, etc.) is preserved, so
movement stops flush with the blocking cell rather than the exact pixel. This satisfies
"blocks only the masked pixels": a masked cell does not block where its mask is empty.
Axis-separated sliding, no-tunnelling and the flush-at-wall behaviour are unchanged.

### Play controller (`src/app/features/scene-editor/services/play-controller.ts`)

`start(...)` replaces the `blockingById: Map<number, boolean>` parameter with
`collisionById: Map<number, TileCollision>`. The controller stores a `CollisionField`
(built once in `start`) and passes `field.full` + `field.sub` to `resolveCollision`.

### Scene editor wiring (`scene-editor.component.ts`)

A new computed signal supplies the runtime inputs (the mask comes from the tile):

```ts
readonly collisionById = computed<Map<number, TileCollision>>(
  () => new Map(this.projectTiles().map((t) => [t.id, { blocking: t.properties.blocking, mask: t.collisionMask ?? null }])),
);
```

`enterPlay()` passes `this.collisionById()` to `player.start(...)`. The existing
`blockingById` computed (used by the #14 overlay input of `rk-map-canvas`) is unchanged.

## Tile editor UI

### Tools

`DrawingTool` (`src/app/features/sprite-editor/tools/drawing-tools.component.ts`) gains
two ids: `'collision'` and `'collisionErase'`. Two buttons are added to
`drawing-tools.component.html` (Material Symbols, same styling as the existing buttons,
with `data-testid="tool-collision"` / `data-testid="tool-collision-erase"`):

| Tool id | Icon | Title |
| --- | --- | --- |
| `collision` | `check_box` | Collision |
| `collisionErase` | `check_box_outline_blank` | Erase collision |

`TOOL_LABELS` in the sprite editor gains `collision: 'Collision'` and
`collisionErase: 'Erase collision'`.

### Pixel canvas

`PixelCanvasComponent` gains:

- `collisionMask = input<number[][] | null>(null)` — the current tile's mask.
- `collisionMaskChange = output<number[][]>()` — emitted on each mask edit.

When the active tool is `collision` or `collisionErase`, pointer painting edits the mask
(`1` for paint, `0` for erase) instead of `paletteIndices`, keeping the internal mask grid
sized to the sprite (`gridRows`×`gridCols`) and emitting the updated mask. `strokeStart`
fires as usual; `strokeEnd` still emits the final palette indices (unchanged) and the
editor uses the active tool to decide whether the stroke touched the mask.

Overlay: while a collision tool is active and a mask exists, solid (`>=1`) mask pixels are
drawn as a translucent red fill (`rgba(220, 38, 38, 0.35)`) between the sprite pixels and
the grid, so the user paints on top of the artwork.

### Sprite editor

`SpriteEditorComponent` gains:

- `readonly collisionMask = signal<number[][] | null>(null)` — the current tile's mask.
- Loaded in `selectTile`/`selectSprite` from `currentTile()?.collisionMask ?? null`.
- `onCollisionMaskChange(mask: number[][])` — updates the signal, records an undo entry on
  stroke end, and persists via `tileService.updateTile(tile.id, { collisionMask: mask })`
  using a 250 ms trailing debounce (same pattern as sprite pixel saves).
- `onResetCollisionMask()` — sets `collisionMask: null` (fall back to full-footprint
  blocking) and refreshes.
- Binds `[collisionMask]="collisionMask()"` and `(collisionMaskChange)="onCollisionMaskChange($event)"`
  on `rk-pixel-canvas`.
- Shows a **Reset collision** button (`data-testid="reset-collision-mask"`) next to the
  existing Auto button when a collision tool is active.

## Persistence

`Tile.collisionMask` is stored in IndexedDB through the existing `tiles` table; no schema
bump is required (Dexie is schemaless for extra properties).

### Project archive

`TileArchiveItem` (`project-archive.model.ts`) gains an **optional** `collisionMask?:
number[][]`. The exporter copies `t.collisionMask ?? undefined` (omitted when absent);
the importer writes it back on tile creation. The importer verifies the mask shape
defensively — a non-array mask, or rows that are not arrays, is dropped to `undefined`.

`PROJECT_ARCHIVE_VERSION` is **not** bumped: `collisionMask` is an additive optional field,
exactly like `anchor` was in v1 (see the `TileArchiveItem.anchor` comment). Bumping would
reject every previously-exported archive and contradict that precedent. Older archives
import unchanged (mask absent); older app versions ignore the extra field.

## Testing

- `collision.spec.ts`: `buildCollisionField` marks an unmasked blocking tile over its full
  footprint and a masked tile only on solid pixels (including a `1/tileSize` sub-cell rect);
  a masked tile with an all-zero mask contributes nothing; `resolveCollision` with `sub`
  passes through an empty mask region and stops at a solid pixel; omission of `sub`
  reproduces the #51 behaviour.
- `play-controller.spec.ts`: a masked tile lets the player cross where the mask is empty and
  blocks where it is solid.
- `pixel-canvas.component.spec.ts`: painting with `collision` sets mask pixels and emits;
  `collisionErase` clears them; the overlay is drawn.
- `sprite-editor.component.spec.ts`: mask loads on selection, persists on change, resets to
  `null`.
- `project-io.service.spec.ts`: a tile with a collision mask round-trips through
  export → import.

## Out of scope / follow-ups

- Refining the #14 scene-overlay to draw true mask shapes (currently full footprint).
- Sub-pixel clamping (the resolver stops at the cell edge, not the exact solid pixel).
- Mask editing for tiles without a sprite (mask needs a grid; the editor requires a frame).
