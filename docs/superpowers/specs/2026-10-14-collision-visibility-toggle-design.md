# Collision / Footprint Visibility Toggle

Date: 2026-10-14
Status: Approved
Linked issue: #14
Supersedes: `2026-08-30-collision-visibility-toggle-design.md` (pre-dates directional footprints, #92)

## Problem

Blocking tiles are invisible on the map, which makes collision design hard to
reason about. A designer painting a scene cannot tell which tiles block movement
without inspecting each tile's properties. The data already exists
(`map-footprint.ts` resolves each tile's directional footprint; `TileProperties.blocking`
is stored on each tile), so only the visual overlay and its control are missing.

## Solution

Add a toolbar toggle in the scene editor that overlays a translucent marker on
every blocking tile's full footprint, without altering the underlying tiles. The
toggle state is persisted for the current browser session.

This follows the existing **grid visibility toggle** as a direct precedent: both
are scene-editor-only preferences stored in `sessionStorage`, surfaced as a
Material Symbol toolbar button that flips a signal consumed by the canvas.

## Design decisions (finalized 2026-10-14)

- **Location:** scene-editor toolbar, next to the existing grid toggle.
- **Marker:** translucent **red** fill (token `destructive`) at ~30% alpha, no
  stroke, drawn over the tile's **full directional footprint**. `destructive` is
  used here as a diagnostic ("blocked"), not as a destructive action.
- **Visibility scope:** only layers with `layer.visible === true` are marked,
  matching runtime collision (`buildBlockingGrid`). Layer `opacity` is ignored —
  an `opacity: 0` layer still collides and is therefore still marked.
- **Play mode:** the overlay is never drawn while `playMode()` is true (same rule
  as the grid).
- **Persistence:** `sessionStorage`, key `rk-scene-editor.show-collision`.
  **Default OFF.**
- **Minimap:** not shown on the scene minimap.

## Architecture

### Blocking lookup (scene editor)

`scene-editor.component.ts` already builds this map inside `enterPlay()`
(`new Map(projectTiles().map((t) => [t.id, t.properties.blocking]))`). Extract it
into a reusable computed:

```ts
readonly blockingById = computed(
  () => new Map(this.projectTiles().map((t) => [t.id, t.properties.blocking])),
);
```

`enterPlay()` reuses `this.blockingById()` instead of rebuilding it, and the
template passes it down: `[blockingById]="blockingById()"`.

### New canvas input (map canvas)

`map-canvas.component.ts` gains:

```ts
readonly blockingById = input<Map<number, boolean>>(new Map());
```

No other input changes.

### Toggle state + persistence

Mirror `GRID_VISIBLE_STORAGE_KEY` (`map-canvas.component.ts`):

- New export `COLLISION_VISIBLE_STORAGE_KEY = 'rk-scene-editor.show-collision'`.
- New signal `showCollision = signal(this.readCollisionVisibility())`.
- Persist effect: `sessionStorage.setItem(COLLISION_VISIBLE_STORAGE_KEY, this.showCollision() ? '1' : '0')`.
- `readCollisionVisibility()` returns `sessionStorage.getItem(KEY) === '1'`
  (defaults **OFF**, unlike the grid which defaults ON).

### New canvas render pass

Inside `render()`, **after** the tile loop and the spawn/play-mode drawing, and
**before** the grid pass, add:

```ts
if (this.showCollision() && !this.playMode()) this.drawCollisionOverlay(cell);
```

`drawCollisionOverlay(cell)`:

- Sets `fillStyle = cssTokenColor(..., '--destructive')`, `globalAlpha ≈ 0.3`, no stroke.
- Iterates `layers()`, skipping `!layer.visible`.
- Scans each layer's `tileData` like the tile loop; for each `tileId >= 0` with
  `blockingById().get(tileId) === true`, computes
  `rect = footprintRect(x, y, tileId, tileFootprints())` and
  `ctx.fillRect(rect.x * cell, rect.y * cell, rect.w * cell, rect.h * cell)`.
- Restores `globalAlpha`.

Because it runs in the same `ctx.save()/translate()/scale()` block as the tiles,
the marker aligns pixel-for-pixel with the rendered footprint (including multi-cell
and overhanging footprints).

### Toolbar button (scene editor)

Add a fourth button in the toolbar (`scene-editor.component.html`, after the grid
button), sharing the existing toolbar button classes:

- Icon: Material Symbol `block`.
- `[title]="mapCanvasRef()?.showCollision() ? 'Hide collisions' : 'Show collisions'"`
- `(click)="mapCanvasRef()?.showCollision.set(!mapCanvasRef()?.showCollision())"`

## Data model changes

None. The overlay reads the existing `TileProperties.blocking` and directional
footprints; no schema, model, or persistence change.

## Testing

Component tests (`map-canvas.component.spec.ts`):

- With `showCollision` on and a blocking tile present, a `fillRect` is issued over
  that tile's footprint in the destructive color.
- A non-blocking tile is not marked.
- A hidden layer's blocking tile is not marked.
- A visible `opacity: 0` layer's blocking tile **is** marked.
- A multi-cell / overhanging footprint is marked across its full rect.
- Nothing is marked while `playMode` is true.
- `sessionStorage` read (default off) and write (toggling) behave as specified.

Component tests (`scene-editor.component.spec.ts`):

- `blockingById()` maps tile ids to their `properties.blocking`.
- The toolbar button toggles `mapCanvasRef()?.showCollision()`.

## Performance considerations

One conditional fill per blocking tile per redraw, guarded by `showCollision()`, so
the disabled state costs nothing. The map canvas already redraws per frame.

## Out of scope

- Per-pixel collision masks (tracked in #58, reuses this overlay's UI later).
- Data model / persistence changes; the toggle is session-scoped only.
- Collision editing (this is a read-only diagnostic overlay).
- Minimap rendering of collisions.
