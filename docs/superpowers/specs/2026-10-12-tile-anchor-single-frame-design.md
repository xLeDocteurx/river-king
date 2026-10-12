# Tile anchor & 4-way footprint — single-frame static guarantee (canopy fix)

Date: 2026-10-12
Status: Draft
Linked issue: TBD (create with ticket-management)
Related: #48/#54 (Play-mode Y-sort render), #55 (configurable player layer)

## Problem

The demo tree's canopy is never drawn. The `Tree` tile is `static` with two 16×16
sprites (`trunk` + `foliage`) as a fake "composition" — but the map renderer draws only
frame index `0` for static tiles (`frameIndices.get(tileId) ?? 0` in
`map-canvas.component.ts`), so the foliage frame is dead data and the tree renders as a
bare 1×1 trunk. The two-frame hack exists because sprites only know one point of contact:
a sprite's blocking/placement footprint is always `{w,h}` cells down-right of the anchor
cell, so nothing can express "the artwork is taller/wider than its ground cell and
extends **above/left** of it".

This US makes the ground cell explicit and the footprint four-directional, then enforces
"static ⇒ exactly one frame" so artists never need the frame-stacking workaround again.

## Non-goals

- **No Y-sort rendering** — the `ySort` flag already exists (`tile.model.ts`); this US only
  makes oversized artwork render correctly **at its anchor cell**. Depth-sorting in front of
  / behind the player stays with #54.
- **No composition** — a tile is a tile; multi-sprite = animation, not layers.
- **No rotation / flip** of sprites.
- **No Play-mode collision resolve change** — only the blocking grid's marked rectangle
  becomes footprint-aware (already the case, now expressed per-direction).

## User story

As a level designer, I can have a tile whose artwork is larger than one grid cell and whose
ground cell is anywhere inside it (canopy overhanging in any direction). Static tiles accept
exactly one frame, so a tree is a single 16×32 sprite; the map, minimap, placement
overlaps, and collision all use the real footprint. The demo tree visibly renders with its
canopy.

## Design decisions (finalized 2026-10-12)

- **Anchor = ground cell, extension in all 4 directions.** A `ts×ts` sub-zone of the frame
  is the contact cell; the sprite may overflow it on any side.
- **Storage: optional `Tile.anchor: { x, y }` in pixels** (top-left of the `ts×ts` zone,
  relative to the frame's top-left, **shared by every frame of the tile**). Absent ⇒
  derived default (below). Editable later via the sprite-editor Anchor tool (separate US).
- **Derived default (no anchor stored): `x = floor((W − ts)/2)`, `y = H − ts`** (bottom-center),
  clamped to `≥ 0`. Single-cell sprites (`W === ts`) derive to `{0, 0}`; existing
  multi-cell tiles whose art is not mentally bottom-anchored will **shift** on screen —
  accepted, the old behavior was a fixed `{w,h}` bottom-right of the anchor cell anyway.
- **Brute pixel math, no grid snapping** for the derived/anchor math: even offsets (e.g.
  `8px` on a 32px tile at ts=16) are allowed; footprints use `ceil`.
- **Strict guard: `static ⇒ ≤ 1 frame`**, enforced at the persistence layer (see §3). Import
  trims static tiles to their lowest-id (oldest) frame.
- **Demo re-authored**: the tree becomes ONE 16×32 static sprite. Placement row moves down
  (canopy rises one cell — row 0 would clip the top edge).

## Architecture

### 1. Data model + shared anchor math

New pure module `src/app/shared/models/tile-anchor.ts` (no service, cross-feature):

```ts
export interface TileAnchor {
  /** Top-left x of the ts×ts ground zone, px, relative to the frame top-left. */
  x: number;
  /** Top-left y of the ts×ts ground zone, px. */
  y: number;
}

/** Grid-cell extents of a tile footprint, relative to its anchor cell. */
export type AnchorFootprint = {
  left: number;  // cells the art overhangs to the LEFT of the anchor cell
  up: number;    // cells above
  right: number; // cells to the right
  down: number;  // cells below
};

export type TileFootprintMap = Record<number, AnchorFootprint>;
```

Pure functions (JSDoc'd, unit-tested):

- `deriveAnchor(w: number, h: number, ts: number): TileAnchor` —
  `x = Math.max(0, Math.floor((w - ts) / 2))`, `y = Math.max(0, h - ts)`.
- `clampAnchor(anchor: TileAnchor, w: number, h: number, ts: number): TileAnchor` —
  `x ∈ [0, max(0, w − ts)]`, `y ∈ [0, max(0, h − ts)]`.
- `deriveFootprint(w: number, h: number, ts: number, anchor: TileAnchor): AnchorFootprint` —
  `left = max(0, ceil(ax / ts))`, `up = max(0, ceil(ay / ts))`,
  `right = max(0, ceil((w − ax − ts) / ts))`, `down = max(0, ceil((h − ay − ts) / ts))`.

`sprite.model.ts`, `tile.model.ts`:

- `Tile` gains `/** @description ...zones... optional; when absent the anchor is derived (bottom-center). */ anchor?: TileAnchor;`.
  Non-indexed object field → **no Dexie version bump**; legacy rows read as absent.

`map-footprint.ts` (scene-editor) reshapes:

- Replace `interface TileFootprint { w, h }` with the shared `AnchorFootprint` alias and
  re-export `TileFootprintMap`, `getFootprint` (default `{ left: 0, up: 0, right: 0, down: 0 }`).
- `clearOverlappedAnchors(...)` computes each existing anchor's **absolute rect**
  `(cx − fp.left, cy − fp.up, fp.left + fp.right + 1, fp.up + fp.down + 1)` and intersects
  against the placement rect `(x, y, w, h)` (replace policy unchanged, input never mutated).

`map-tiles.service.ts` `loadTileVisuals`:

- Per tile, resolve `anchor = tile.anchor ?? deriveAnchor(frame0.w, frame0.h, ts)` then
  `footprints[tileId] = deriveFootprint(frame0.w, frame0.h, ts, anchor)`.
- `images` / `animations` unchanged. Assumption (note in JSDoc): all frames of a tile share
  one size (resize applies to all), so frame 0 defines the footprint.

### 2. Render consumers

- **`map-canvas.component.ts`** — for anchor cell `(gx, gy)`, draw at
  `((gx − fp.left) * cell, (gy − fp.up) * cell)` sized
  `(fp.left + fp.right + 1) * cell` × `(fp.up + fp.down + 1) * cell`, full frame as source.
  Placement hint / `footprintRectFor` use the same absolute-rect math.
- **`collision.ts` `buildBlockingGrid`** — mark rows `y − up … y + down`, cols
  `x − left … x + right`, clamped to scene bounds.
- **`scene-minimap.component.ts`** — draw the image at the absolute rect (cells × `cell * scale`)
  instead of a single cell. `imageCache` already keys by first frame.
- **`play-controller.ts`** — unchanged beyond the type shape of `TileFootprintMap` passthrough.

### 3. Static single-frame guarantee

Invariant: **a persisted tile of `type: 'static'` has at most one sprite.**

- `TileService.updateTile(id, changes)` fetches the current row, resolves the effective
  type (`changes.type ?? current.type`), and **throws** `StaticTileFramesError` when the
  effective type is `'static'` and `changes.spriteIds.length > 1`. Callers surface the
  error as a `NotificationService.error` toast (existing pattern).
- **Frame-add paths promote to `'animated'`** so the guard never fires in normal use:
  `sprite-editor.component.ts` `onAddFrame` and `tile-properties.component.ts`
  `createFramesFrom`/`onFrameCountInput` growth send `{ type: 'animated', spriteIds }` in
  the same `updateTile` call when the current type is `'static'`. (Adding a second frame to
  a static tile *is* making an animation.)
- `animated → static` keeps the existing frames-deletion dialog
  (`pendingFrameReduction`, `confirmFrameReduction`).
- **Guard boundary:** the guard lives only in `TileService.updateTile`. The demo seed and the
  import path write tiles through `db.tiles.update` directly and are the **sanctioned
  normalization points** — they build valid states upstream (single-frame static, trims,
  clamps) and must not call the guarded service.

### 4. Import / export (`project-io.service.ts`, `project-archive.model.ts`)

- `TileArchiveItem` gains `anchor?: TileAnchor` (optional; v1 archives without it read as
  absent → derived). Export writes `tile.anchor` when set.
- **Static trim on import**: pre-compute, for every static tile in the archive with
  `spriteIds.length > 1`, the trimmed set (`sourceId`s after the first). Skip those sprites
  during insert; set the tile's `spriteIds` to `[oldest]` (lowest sourceId = frame 0).
- **Anchor clamp on import**: for each tile with an `anchor`, compute it against the
  **kept frame's** `width`/`height` (known from the archive sprite items) with `clampAnchor`
  before inserting; drop the anchor when the tile keeps no frames.

### 5. Resize clamp (`tile-properties.component.ts` `applySize`)

After `resizeSprites` (which crops/pads top-left), if the edited tile has a stored anchor,
persist `anchor = clampAnchor(tile.anchor, newW, newH, ts)` via `TileService.updateTile`.
No stored anchor ⇒ derivation recomputes automatically. Anchored frames therefore never
reference out-of-bounds zones after a shrink.

### 6. Demo tree re-author

- `demo-art.ts`: new `treeIndices(): number[][]` = 16×16 foliage rows on top of 16×16 trunk
  rows (a 16×32 grid; existing `foliageIndices`/`trunkIndices` content reused). Keep the old
  helpers if still referenced, else fold them away.
- `demo-project.service.ts`: the local `sprite()` helper gains optional `w`/`h` (defaults
  `DEMO_TILE_SIZE`). Tree = single sprite `'Tree'`, width 16, height 32, `spriteIds:[id]`.
  Remove `trunkId`/`foliageId`. Tile stays `static`, `blocking:true`, `ySort:true`; **no
  stored anchor** (derives `{0,16}`).
- `TREE_ROW_Y` constant: `0 → 2` (canopy +1 cell above; top row stays empty).

## Error handling

- `StaticTileFramesError` → toast `'Cannot save: a static tile can only have one frame'`
  (message wording finalized at implementation).
- Import clamp/trim are silent (data normalization, not user-visible errors).

## Testing

- `tile-anchor.model` unit tests: `deriveAnchor` (16×16→`{0,0}`; 16×32→`{0,16}`;
  32×32→`{8,16}`; 48×32→`{16,16}`), `clampAnchor` bounds incl. frame < ts, `deriveFootprint`
  (incl. `{0,16}`/16×32/16 → `{0,1,0,0}`; zero; clamping).
- `map-tiles.service.spec`: footprint shape; anchor stored vs derived; multi-frame tile keeps
  single footprint from frame 0.
- `collision.ts` spec: blocking rect respects `up`/`left` (new-style footprint).
- `map-canvas.component.spec`: oversized tile drawn at the offset rect (TDD red→green).
- `scene-minimap.component.spec`: footprint rect instead of single cell.
- `tile.service.spec`: guard rejects static `spriteIds.length > 1`; animated allowed;
  `type` promotion path.
- `project-io.service.spec`: static archive with 2 frames imports trimmed to 1; anchor
  clamped to kept-frame bounds; round-trip preserves a valid anchor.
- `demo-project.service.spec`: `tree.spriteIds.length === 1`; tree sprite 16×32; tree row at
  `TREE_ROW_Y = 2`; water stays 2-frame animated.