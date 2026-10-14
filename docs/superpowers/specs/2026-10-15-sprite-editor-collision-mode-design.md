# Sprite editor: collision-mask painting mode

**Date:** 2026-10-15
**Issue:** [#105](https://github.com/xLeDocteurx/river-king/issues/105)
**Status:** Approved
**Supersedes (partially):** the tool-based UX of `2026-10-14-tile-collision-masks-design.md`

## Context

#58 shipped per-pixel tile collision masks, exposed as two extra tools
(`collision` / `collisionErase`) in the sprite editor toolbox. Two problems:

1. Collision painting reads as _one tool among many_ (next to Brush/Eraser/Fill/Anchor)
   instead of a distinct _mode_.
2. You can paint but never fully **clear** a mask: `commitCollisionMask` collapses an
   all-zero mask to `null`, and the runtime treats `null` as "full footprint". Erasing
   everything silently re-blocks the tile.

## Goals

- Make collision editing a **mode** toggled from a canvas overlay toolbar (the same
  pattern as the scene editor's Play / Grid toolbar).
- Reuse the existing drawing tools while the mode is active.
- Persist an empty (all-zero) mask so a blocking tile can be made fully passable.
- Fix the default-mask semantics in the editor so the runtime and the editor agree.

## Non-goals

- No change to the runtime collision model or `collision.ts` (`buildCollisionField` already
  treats an all-zero mask as fully passable).
- No per-frame masks for animated tiles: a mask stays **tile-level** (one grid, matching
  the sprite pixel grid).
- No collision badge in the tile manager (possible follow-up).

## UX

- A **canvas overlay toolbar** (top-right of the pixel canvas) contains, in order:
  **Grid** toggle, **Collision** toggle (icon `block`), and, only while the mode is
  active, a **Reset** button.
- While collision mode is active:
  - the drawing tools are reinterpreted — **Brush = solid**, **Eraser = empty**,
    **Fill = fill solid**;
  - the **Anchor** tool is hidden and, if it was active, the tool falls back to Brush;
  - the **colour palette** selection is hidden (only the brush/eraser/fill tools remain);
  - the **red mask overlay** is always shown;
  - the **status bar** indicates collision-edit mode.
- Exiting the mode restores the normal palette/tools and hides the overlay.

## Data semantics

A tile's effective collision is `mask ?? full footprint`:

| `properties.blocking` | `collisionMask`      | Effective collision            |
| --------------------- | -------------------- | ------------------------------ |
| `false`               | any                  | none                           |
| `true`                | `null` / `undefined` | full footprint (naive default) |
| `true`                | explicit grid        | exact `1` pixels               |

- **Entering** the mode with a `null` mask initialises the working mask to **full**
  (all `1`s, sprite grid dimensions): you hollow it out with the Eraser.
- **Commit** (on stroke end) stores the mask **unless it is fully solid**, in which case it
  stores `null` (canonical "full footprint"). An **all-zero** mask is a valid, distinct value
  ("nothing blocks") and **is persisted** — it must not collapse to `null`.
- **Reset** restores the default: working mask back to full, stored value `null`.

`storedFromMask(m) = m && !isFullMask(m) ? m : null`, where `isFullMask` is true when every
cell is `>= 1`.

## Architecture

Collision mode is **feature-level state owned by `SpriteEditorComponent`**; the canvas must
not drive application behaviour (repo convention: no child → parent app actions). The overlay
toolbar therefore lives in `sprite-editor.component.html`, like the scene editor's toolbar.

### `SpriteEditorComponent` (`sprite-editor.component.ts` / `.html`)

- New `collisionMode = signal(false)` and `pixelCanvasRef = viewChild(PixelCanvasComponent)`.
- Overlay toolbar over the canvas (`#onionAnchor`), top-right, containing the grid toggle
  (moved from the pixel canvas), the collision toggle and the conditional Reset.
- `toggleCollisionMode()`: flips the signal; on entry forces `selectedTool` away from
  `anchor` and initialises `collisionMask` to a full grid when it is `null`.
- `buildFullMask()`: `rows × cols` grid of `1`, sized from `paletteIndices`.
- `isFullMask(mask)` / `storedFromMask(mask)` helpers.
- `commitCollisionMask()`: stores `storedFromMask(collisionMask())` with undo.
- `onResetCollisionMask()`: sets the working mask to full and stores `null` with undo.
- Hide `rk-palette-manager` while `collisionMode` is on; pass `[collisionMode]` to
  `rk-pixel-canvas`.
- Status bar (`statusBarEffect`): when `collisionMode` is on, show `Collision` in place of
  the tool label and omit the colour segment.
- `selectTile` / `selectSprite` reset `collisionMode` to `false`.
- `TOOL_LABELS` drops `collision` / `collisionErase`.

### `PixelCanvasComponent` (`canvas/pixel-canvas.component.ts` / `.html`)

- New `collisionMode = input(false)`.
- `applyTool`: when `collisionMode` is on, **Brush** sets mask `1`, **Eraser** sets mask `0`,
  **Fill** flood-fills the mask with `1`; otherwise the previous colour behaviour runs.
- Overlay drawn when `collisionMode` (not based on the tool); the ground-zone marker is
  suppressed while in mode.
- The internal grid-toggle button is **removed** (moved to the parent toolbar);
  `showGrid` / `toggleGrid` / persistence stay.
- Drop the `collision` / `collisionErase` branches.
- `syncCollisionMask` is unchanged (the parent passes a full grid on entry).

### `DrawingToolsComponent` (`tools/drawing-tools.component.ts` / `.html`)

- `DrawingTool` union drops `collision` / `collisionErase`.
- New `collisionMode = input(false)`: hides the **Anchor** button while the mode is on.
- The two collision buttons are removed.

### Runtime (unchanged)

`collision.ts` (`buildCollisionField`, `resolveCollision`) already treats an all-zero mask as
passable and samples solid sub-rects otherwise. No runtime change.

## Testing

- **drawing-tools**: no `collision` buttons rendered; Anchor hidden when `collisionMode`.
- **pixel-canvas**: Brush/Eraser/Fill edit the mask in mode (`collisionMaskChange` emits);
  overlay rendered in mode; no colour edits while in mode; grid toggle tests retained for
  `showGrid` (button tests relocated to the parent).
- `SpriteEditorComponent`: toolbar collision toggle shows/hides the palette and anoints
  `Collision` in the status bar; entering the mode on a `null` mask yields a full working
  mask; committing a fully-solid mask stores `null`; committing an all-zero mask
  **persists** it; Reset stores `null`; switching tile/sprite exits the mode.

## Non-goals / follow-ups

- Custom-collision badge in the tile manager.
- Per-frame collision masks for animated tiles.
