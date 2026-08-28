# Auto-grow Map for Scene Editor

Date: 2026-08-29
Status: Draft
Linked issue: #7

## Problem

The scene editor renders a fixed-size map (`scene.width × scene.height` in tiles, see
`Scene` in `shared/models/scene.model.ts`). Tile placement outside that rectangle is
rejected: `map-canvas.component.ts` computes the pointer cell in `footprintRectFor()`
and returns `null` whenever `x < 0 || y < 0 || x + w > scene.width || y + h > scene.height`
(lines 553–554), and `placeTile()` emits nothing for a `null` rect. The grid overlay
(`drawGrid()`) is also only drawn over the current `width × height` and only when
`zoom * cell >= 8` (line 271), so it disappears entirely when zoomed out.

Consequences:

- Users must pre-size the map before building; extending a level later means manual
  resizing.
- Because the grid vanishes when zoomed out and is confined to the in-memory rectangle,
  the user cannot see where extendable space would be.

This blocks free-form map building (e.g. a river meandering beyond the original canvas).

## Solution

Allow placing tiles beyond the current scene rectangle. When the selected tile's
footprint falls (partly or wholly) outside the scene, the scene **auto-grows** to include
it, expanding in all four directions as needed and keeping every layer aligned. The canvas
grid is redrawn across the whole viewport (with adaptive spacing) and the in-memory region
is visually distinguished so the extendable space is discoverable.

## Design decisions (finalized 2026-08-29)

1. **Expansion direction — all four.** Up/down/left/right. Implemented by prepending and
   appending rows & columns to each layer's dense `tileData` (no scene origin field needed;
   the camera is shifted to keep the view stable).
2. **Anti-balloon guard — `MAX_EXPAND_TILES = 16`.** A placement whose required growth
   exceeds 16 tiles in any direction is rejected and the user is notified. (At minimum zoom
   0.1 a stray click could otherwise sit hundreds of cells away. Panning keeps the boundary
   near the cursor, so the guard never blocks a deliberately large map.)
3. **Visual boundary.** Beyond the scene rectangle the grid is drawn at reduced alpha
   (`GRID_EXT_ALPHA = 0.35`); the scene edge is marked with a 1px boundary line using the
   normal grid stroke color. Inside the rectangle the grid keeps its normal alpha.
4. **Adaptive grid (always visible).** Major-line spacing is `cell × 2^k`, choosing the
   smallest `k ≥ 0` so that `spacing × zoom ≥ 8px` (the existing moiré threshold). The grid
   is drawn whenever `showGrid()` is on, across the entire viewport, regardless of zoom.

## Architecture

### map-canvas.component.ts

- **`footprintRectFor(event)`** (line 541): remove the inside-scene rejection. Compute
  `x, y, w, h` from the pointer as today; compute overflow
  `padLeft = max(0, -x)`, `padRight = max(0, x + w - width)`,
  `padTop = max(0, -y)`, `padBottom = max(0, y + h - height)`. If any of these
  `> MAX_EXPAND_TILES` return `null` (no preview, placement disabled). Otherwise return
  `{ x, y, w, h }` — even when outside the scene.
- **`updateCursorCell(event)`** (line 519): set `cursorCell` for any cell within the
  `MAX_EXPAND_TILES` reach of the scene; null only when beyond the guard (do not null it
  merely because `x/y` is out of `[0, width) × [0, height)`).
- **`drawGrid(ctx, scene, cell, viewportPx)`** (was `drawGrid(ctx, width, height, cell)`,
  line 354): draw the grid across the full viewport using adaptive spacing
  (`cell × 2^k`); draw the in-scene portion at normal alpha and the out-of-scene portion at
  `GRID_EXT_ALPHA`; stroke a 1px boundary rectangle at `(0, 0, width*cell, height*cell)`.
- **`render()`** (line 213): call the new `drawGrid` whenever `showGrid()` is on (remove the
  `zoom * cell >= 8` gate; adaptive spacing already prevents moiré). The hover preview
  already draws at world coordinates, so it renders outside the scene rectangle
  automatically.
- Constants `MAX_EXPAND_TILES = 16` and `GRID_EXT_ALPHA = 0.35` live in
  `map-canvas.component.ts` (or a shared `scene-editor` consts module).

### scene-editor.component.ts — `onTilePlaced` (line 356)

Before writing the tile, compute the same overflow as `footprintRectFor`. If growth is
needed and within the guard:

- Build `newWidth = width + padLeft + padRight`,
  `newHeight = height + padTop + padBottom`.
- For **every** layer, construct a fresh `tileData` of `newHeight × newWidth` filled with
  `-1`, then copy the old grid at offset `(padLeft, padTop)`. Use `clearOverlappedAnchors`
  from `map-footprint.ts` on the grown grid, then set
  `newTileData[y + padTop][x + padLeft] = tileId`.
- Persist via `sceneService.updateScene(scene.id, { width: newWidth, height: newHeight,
  layers: newLayers })`. `updateScene` already accepts `Partial<Scene>` (line 68), so
  `width`/`height` are persisted without a schema change.
- Shift the camera so the view does not jump:
  `mapCanvasRef().cameraX += padLeft * cell * zoom;
   mapCanvasRef().cameraY += padTop * cell * zoom`
  (existing content moves with the world; only the array indices shifted).
- **Undo/redo**: the pushed undo closure must restore `previousWidth`, `previousHeight`
  **and** `previousLayers`; the redo closure must restore the grown `width`/`height`/
  `layers`. (Currently `onTilePlaced` only restores `tileData` — extend it.)

### scene-minimap.component.ts (line 184) and layer/status-bar panels

No change required: they iterate `scene.width/height`, so they adapt automatically once
`width`/`height` grow. The status bar (#3) reflects the new size for free.

## UI / UX details

- **Placement feedback**: when a placement is rejected by the guard, show a non-blocking
  toast (NotificationService) e.g. "Placement trop éloigné de la carte — agrandissement
  limité à 16 tuiles." It is a soft UX guard, not an error, so a warning-style toast is
  preferred over `error()`.
- **Hover preview**: outside the scene the preview rectangle still renders (so the user sees
  where the tile will land), over the reduced-alpha grid region.
- **Defaults**: no change to the `showGrid` default (currently `true`).

## Data model changes

None at the schema level. `Scene.width`/`Scene.height` are existing fields whose values
grow; `Layer.tileData` stays a dense `number[][]` but is reallocated to the new size. No
DB migration.

## Testing

### scene-editor.component.spec.ts (onTilePlaced)

- Placing at `x = width` (one tile right of the edge) grows `scene.width` by 1 and writes
  the tile at the new cell.
- Placing at `x = -1` (one tile left) grows `scene.width` by 1, shifts existing content by
  one column, and `tileData[0][0]` becomes the new tile while old anchors move to column 1.
- Placing `2**k` tiles beyond the far edge grows by exactly that amount; `width`/`height`
  assertions hold.
- Placing `MAX_EXPAND_TILES + 1` tiles beyond the edge is rejected (scene unchanged,
  notification shown).
- Undo after an out-of-bounds placement restores both `tileData` **and** `width`/`height`.
- All layers grow together (assert every layer's `tileData` shape matches the new
  `width`/`height`).

### map-canvas.component.spec.ts

- `footprintRectFor` returns a rect for a pointer just outside the scene (within guard) and
  `null` beyond `MAX_EXPAND_TILES`.
- `drawGrid` draws across the full viewport, applies `GRID_EXT_ALPHA` outside the scene
  rectangle, and strokes a boundary line at the scene edge (assert via canvas pixel sampling
  or a `stroke`/`strokeRect` spy).
- Grid remains drawn at low zoom (adaptive spacing), i.e. no longer gated by
  `zoom * cell >= 8`.

## Performance considerations

- Growth reallocates every layer's `tileData` (`O(width × height)` per layer). Scenes are
  bounded by the guard in a single action, so this is negligible; large deliberate maps are
  built incrementally.
- Adaptive grid caps the number of lines drawn at low zoom (spacing grows with `2^k`), so
  the always-on grid stays cheap.
- The camera shift is `O(1)` (two signal updates), no re-render storm.

## Out of scope

- Sparse tile storage / infinite worlds (this design keeps a dense grid).
- Persisting the camera between sessions (already removed — commit 7b3bdff).
- Auto-shrink when the outermost tiles are deleted (the map only ever grows per action;
  manual resize remains a separate concern).
- Snapping helpers, guides, or "expand to fit selection" UI.
