# Sprite-editor Anchor tool (set/move the tile ground zone)

Date: 2026-10-12
Status: Approved
Linked issue: #93
Related: Spec A — `2026-10-12-tile-anchor-single-frame-design.md` (machinery this tool drives)

## Problem

Spec A stores an optional `Tile.anchor` (`{x,y}` px, top-left of the `ts×ts` ground zone)
with a `bottom-center` derived default. Without authoring UI, an artist cannot control
_where_ the ground cell sits inside a frame — needed as soon as a tile's art is offset (a
tree whose trunk is not dead-center-bottom, tall grass planted off-center, etc.). This US
adds an **Anchor** tool to the sprite editor so the ground zone can be picked visually.

Depends on Spec A being merged (the `TileAnchor` model, `deriveAnchor`, `clampAnchor`).

## Non-goals

- No map-side authoring (placement preview already follows the footprint).
- No per-frame anchors (a tile has one anchor shared by all frames, per Spec A).
- No anchor rotation / flip.

## User story

As a sprite artist, I open a tile's frame in the sprite editor, pick the **Anchor** tool,
hover over the canvas to preview a `ts×ts` highlight, and click to set the tile's ground
zone. An **Auto** button clears my manual choice and restores the derived bottom-center
position. The status bar shows the anchor coordinates while the tool is active.

## Design decisions (finalized 2026-10-12)

- **New tool in the existing toolbar**, alongside Brush / Eraser / Fill. Material Symbols
  icon for a reticle/crosshair — `center_focus_strong`.
- **Manual placement snaps to the `ts` grid**: the highlight follows the mouse snapped to
  cell boundaries (`x ∈ {0, ts, 2ts, …}`, `y ∈ {0, ts, 2ts, …}`), clamped so the zone stays
  inside the frame. Rationale: the map displays the ground zone as exactly one grid cell, so
  authoring at cell alignment is the intuitive mental model. Auto/derivation stays brute-pixel
  (Spec A, decision #4).
- **Click sets** the anchor; a subsequent click on the zone **moves** it (no drag). Applied
  per tile (`updateTile(tileId, { anchor })`), shared by all frames.
- **`Auto`** sends `updateTile(tileId, { anchor: null })` → derived bottom-center.
- **Status bar**: while the Anchor tool is active, `StatusBarService.setContext('Anchor — X, Y')`
  (px, top-left of the zone). Cleared when switching tools.
- **Subtle marker while painting** with non-anchor tools: the stored anchor zone is drawn as
  a thin dashed outline over the canvas so the ground cell stays visible while drawing.
- After a change, the tile's `mutationVersion` is bumped (`TileSpritesService.markMutated`)
  so the scene editor re-derives footprints on next load.

## Architecture

### `tools/drawing-tools.component.ts`

- Union `DrawingTool = 'brush' | 'eraser' | 'fill' | 'anchor'`.
- New button (`data-testid="tool-anchor"`, icon `center_focus_strong`, title `Anchor`),
  mirroring the existing buttons' `tool()` highlight classes.

### `canvas/pixel-canvas.component.ts`

- Inputs: `tileSize = input<number>(16)`, `anchor = input<TileAnchor | null>(null)`.
- Output: `anchorChange = output<TileAnchor>()`.
- When `tool() === 'anchor'`:
  - `mousemove`: compute snapped zone from pointer (existing `localToPixel`/zoom math),
    store a hover `signal` and render it as a highlighted `ts×ts` outline.
  - `mousedown` (single click, no drag): emit `anchorChange(snapped)`, update the local
    anchor signal, re-render.
- When `tool() !== 'anchor'` and `anchor()` is non-null: render the stored zone as a thin
  dashed outline (subtle, non-interactive).
- Existing brush/eraser/fill paths untouched.

### `sprite-editor.component.ts`

- Passes `tileSize` (project setting) and `anchor` (from the active tile) into the canvas.
- On `anchorChange`: `TileService.updateTile(tile.id, { anchor: clamped })` (defensive
  `clampAnchor` against the current frame's size), `TileSpritesService.markMutated()`.
- **Auto** button: sets `anchor = null` via `updateTile`, then reloads the tile.
- Wire the Anchor selection into the status bar via `StatusBarService`.

### `tile-properties.component.ts`

- No form field and no display here: the anchor is authored exclusively in the sprite
  editor. `applySize` (Spec A §5) is the only tile-properties hook.

## Error handling

- `updateTile` failures → `notification.error('Failed to save anchor')`.
- `clampAnchor` guarantees in-bounds output; no user-visible clamp errors.

## Testing

- `drawing-tools.component.spec`: anchor button emits `'anchor'` and highlights.
- `pixel-canvas.component.spec`: reuses the existing TrackingObserver/TrackedCtx patterns —
  hover shows snap-highlight; click emits snapped `TileAnchor` bounded to the frame; stored
  anchor outline renders for non-anchor tools; brush/eraser/fill still work with a stored
  anchor.
- `sprite-editor.component.spec`: saving an anchor calls `TileService.updateTile` with a
  clamped value; Auto sends `{ anchor: null }`; status bar context updates in anchor mode.
