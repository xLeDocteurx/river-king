# Frame Strip Redesign Implementation Plan

**Goal:** Refactor sprite editor navigation to tile-based, redesign frame strip UI per design system, add drag & drop reordering.

## Task 1: Convert left nav from sprite groups to tile list

**Files:** `sprite-editor.component.ts`, `sprite-editor.component.html`

- Add `selectedTileId` signal
- Add `selectTile(tileId)` method — selects first frame of tile
- Replace `spriteGroups`/`collapsedTiles`/`toggleTileGroup`/`isTileCollapsed` with simple `tiles` list
- Nav shows tiles with frame count badge
- Selecting a tile shows its frames in the frame strip and edits the first frame

## Task 2: Redesign frame strip UI

**Files:** `frame-strip.component.ts`, `.html`, `.scss`

- Consistent design system style: hover states, cursor-pointer, 1px borders, tw-rounded-sm
- Frame thumbnails with index numbers
- Play/stop, add, duplicate, delete buttons
- Section label "Frames" with uppercase tracking-wider

## Task 3: Add drag & drop reordering

**Files:** `frame-strip.component.ts`, `.html`, `.scss`

- HTML5 native drag & drop (draggable, dragstart, dragover, drop)
- Visual drag handle on each frame
- Emit `frameReorder(fromIndex, toIndex)` output
- Parent updates `tile.spriteIds` order

## Task 4: Remove URL navigation on frame select

**Files:** `sprite-editor.component.ts`

- `selectSprite()` should NOT call `router.navigate()` — stay on current URL
- Keep `selectTile()` for tile selection without navigation
