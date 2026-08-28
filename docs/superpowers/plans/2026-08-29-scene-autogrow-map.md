# Plan: Auto-grow Map for Scene Editor (issue #7)

Date: 2026-08-29
Spec: `docs/superpowers/specs/2026-08-29-scene-autogrow-map-design.md`
Status: Ready → In progress

## Tasks

### 1. Shared constants module

- [ ] Create `src/app/features/scene-editor/autogrow.consts.ts` exporting:
  - `MAX_EXPAND_TILES = 16`
  - `GRID_EXT_ALPHA = 0.35`
- [ ] Commit `chore: add auto-grow constants (MAX_EXPAND_TILES, GRID_EXT_ALPHA)`

### 2. map-canvas.component.ts — preview + cursor + grid

- [ ] `footprintRectFor(event)`: remove inside-scene rejection. Compute
      `padLeft = max(0,-x)`, `padRight = max(0, x+w-width)`,
      `padTop = max(0,-y)`, `padBottom = max(0, y+h-height)`; if any `> MAX_EXPAND_TILES`
      return `null`; otherwise return the rect (may be outside the scene).
- [ ] `updateCursorCell(event)`: set `cursorCell` for any cell within `MAX_EXPAND_TILES`
      of the scene; null only when beyond the guard (not merely out of `[0,width)`x`[0,height)`).
- [ ] `drawGrid`: signature `(ctx, scene, cell, viewportW, viewportH)`. Adaptive major-line
      spacing `spacing = cell * 2**k` with smallest `k>=0` such that `spacing*zoom >= 8`.
      Draw across full viewport; in-scene cells at normal alpha, out-of-scene at
      `GRID_EXT_ALPHA`; stroke 1px boundary rect at `(0,0,width*cell,height*cell)`.
- [ ] `render()`: replace the `zoom*cell >= 8` gate with "draw whenever `showGrid()` on".
- [ ] Commit `feat(scene-editor): adaptive full-viewport grid + out-of-bounds placement preview`

### 3. scene-editor.component.ts — growth in onTilePlaced

- [ ] Add helper `growTileData(tileData, padLeft, padRight, padTop, padBottom, newW, newH)`:
      new grid filled `-1`, old grid copied at offset `(padLeft, padTop)`.
- [ ] `onTilePlaced(event)`: compute pads vs `scene.width/height`; if any `> MAX_EXPAND_TILES`
      → `notification.warning(...)` + return (no change).
- [ ] If growth needed: grow **every** layer; for the active layer run
      `clearOverlappedAnchors(grownTileData, x+padLeft, y+padTop, w, h, footprints)` then
      set `grown[y+padTop][x+padLeft] = tileId`; persist `{ width, height, layers }`;
      shift camera `+= padLeft*cell*zoom` / `+= padTop*cell*zoom`.
- [ ] If no growth needed: keep current path (stamp in place, persist layers only).
- [ ] Undo/redo closures restore `width`/`height` **and** layers (grown ↔ previous).
- [ ] Commit `feat(scene-editor): auto-grow scene (all layers) when placing outside bounds`

### 4. Tests

- [ ] `map-canvas.component.spec.ts`:
  - update `does not emit when a large footprint would exceed the scene bounds` → now emits
    when within guard; add truly-beyond-guard case expecting `[]`.
  - update `shows no preview when the footprint would exceed the scene bounds` → within guard
    shows preview; beyond guard hides.
- [ ] `scene-editor.component.spec.ts`: add growth tests — place at `x=width` grows width by 1
      and stamps; place at `x=-1` shifts content right; rejected beyond guard + notification;
      undo restores width/height/layers; all layers grow together.
- [ ] `npm run test` green.

### 5. Verify

- [ ] `devbox run npm run lint`
- [ ] `devbox run npm run test`
- [ ] `devbox run npm run build`

### 6. Kanban

- [ ] Move issue #7 In progress → In review after merge-ready state.