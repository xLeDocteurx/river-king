# Collision / Footprint Visibility Toggle

Date: 2026-08-30
Status: Draft
Linked issue: #14

## Problem

Blocking tiles are invisible on the map, which makes collision design hard to
reason about. A designer painting a scene cannot tell which tiles block movement
without inspecting each tile's properties. The footprint/blocking logic already
exists (`map-footprint.ts` returns tile footprints; `TileProperties.blocking` is
stored on each tile), so the rendering data is available — only the visual
overlay and its control are missing.

## Solution

Add a toolbar toggle in the scene editor that overlays a subtle visual marker on
every blocking tile, without altering the underlying tiles. The toggle state is
persisted for the current browser session.

This follows the existing **grid visibility toggle** as a direct precedent:
both are scene-editor-only preferences stored in `sessionStorage`, surfaced as a
Material Symbol toolbar button that flips a signal consumed by the canvas.

## Design decisions (finalized 2026-08-30)

- **Location:** scene-editor toolbar, next to the existing grid toggle.
- **Marker type:** subtle overlay on blocking tiles (e.g. tinted fill/stroke
  drawn on the canvas atop the tile), never mutating the tile's stored data.
- **Persistence:** `sessionStorage` (session-scoped, project-independent), mirroring
  the grid toggle. Default ON or OFF is a UX choice — see UI details.

## Architecture

### New canvas render pass (map canvas)

`map-canvas.component.ts` already iterates scene layers and draws each cell's tile
image. When the collision overlay is enabled, after drawing each tile the canvas
checks whether that `Tile.id` is blocking and, if so, draws a semi-transparent
marker (e.g. a filled stroke/hatch) over the cell's footprint area.

- Footprint for a tile id comes from the existing `footprints`/`getFootprint()`
  (`map-footprint.ts`) — reuse it so the marker covers the full footprint, not
  just one cell.
- Blocking is read from the tile's `TileProperties.blocking`. The canvas needs
  access to a blocking lookup per tile id; the tiles are already loaded by the
  scene editor and passed down (same flow as footprints/images).

### Toggle state + persistence

Mirror `GRID_VISIBLE_STORAGE_KEY`:

- New export `COLLISION_VISIBLE_STORAGE_KEY = 'rk-scene-editor.show-collision'`
  in `map-canvas.component.ts`.
- New signal `showCollision = signal(loadCollisionVisibility())`, persisted via an
  `effect` writing `sessionStorage.setItem(KEY, showCollision() ? '1' : '0')`,
  exactly as `showGrid` does (map-canvas.component.ts:134-136, 144-146).

### Toolbar control

In `scene-editor.component.html`, add a toolbar button adjacent to the grid toggle
that flips `mapCanvasRef()?.showCollision`. Use a Material Symbol icon, e.g.
`block` for blocking highlight (title "Show collisions"/"Hide collisions").

## UI·UX details

- Toolbar button: icon + `title` tooltip, `tw-cursor-pointer`, active/hover states
  matching the existing grid button styling.
- Marker rendering: clearly visible but non-destructive — a translucent fill over
  the footprint area, drawn _after_ tiles (so it stays on top) and _before_ the
  grid (so grid cells remain legible). Consider a low-contrast token color so it
  reads as a diagnostic overlay, not content.
- Default: **OFF** initially (matches the conservative "diagnostic overlay" intent
  and avoids surprising existing scenes); user toggles it on as needed. (Final
  default pending UX confirmation; OFF is recommended.)

## Data model changes

None. The overlay reads existing `TileProperties.blocking` + `footprints`; no
schema or model change.

## Testing

- Unit/component test on the canvas: with `showCollision` enabled and a blocking
  tile in the scene, an overlay is drawn for that tile's footprint; with it
  disabled, no overlay is drawn.
- Persistence test: toggling sets the `sessionStorage` key; initial load reads it
  (mirror existing grid tests).
- Toolbar test: clicking the button flips the signal.
- Manual: verify non-blocking tiles are not highlighted; marker respects the full
  footprint of multi-cell tiles.

## Performance considerations

The overlay adds one conditional fill per blocking tile per redraw. Cost is
negligible because the map canvas already redraws every frame/scene pass; guard
with the `showCollision()` flag so disabled state adds zero work.

## Out of scope

- Editing/per-tile collision toggling from the canvas (this is display-only).
- Persisting the toggle per project (session only, per user decision).
- Highlighting `interactable` or other `TileProperties` (blocking only).
