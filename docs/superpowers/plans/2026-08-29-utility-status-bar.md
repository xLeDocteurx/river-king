# Plan — Utility status bar (cursor, zoom, counts) — issue #3

> Linked issue: #3 (kanban #6, P2 / S). Branch: `feature-3`.

## Ground truth audit (before touching anything)

The app already has an app-wide status bar: `core/services/status-bar.service.ts` exposes a single
flat `context` signal; features push a composed string via `setContext()` inside effects.

| AC  | Requirement                                  | Current state                                                                                                                    |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Cursor coordinates shown in the scene editor | **Already done** — `scene-editor.component.ts:111-133` status effect appends `Cursor: x,y` (from `mapCanvasRef().cursorCell()`). |
| AC2 | Current zoom shown and updated               | **Already done** — same effect appends `Zoom: n%` from `mapCanvasRef().zoom()`. Sprite editor also shows `Zoom n%`.              |
| AC3 | Number of selected items shown               | **Not done anywhere.** There is no multi-selection; the meaningful "counts" are per-selection-context totals.                    |

The scene editor line is currently:
`scene.name | W×H | layerName | Cam: x,y | Zoom: n%` [+ `| Cursor: x,y` when hovering].

## Scope decision

Deliver AC3 with real, useful counts and close the one visible gap in the other canvas editor:

1. **Scene editor** — append the count of layers and the number of placed (non-empty) tiles of the
   active layer: `| N layer(s) | M tile(s)`.
   - `layerCount` = `scene.layers.length`.
   - `tileCount` = non-`-1` cells of `activeLayer().tileData` (0 when no layer selected).
2. **Sprite editor** — append the selected frame position out of the tile's frame count:
   `| Frame i/N` (1-based), computed from `currentFrames()` + the index of `selectedSprite().id`.

Not in scope (deliberate, reported to the user): pixel-canvas cursor coordinates would need a new
public signal on `PixelCanvasComponent` — AC1 is scoped to the scene editor, so we skip it to avoid
scope creep.

## Tasks

### Task 1 — Tests (RED)

- `scene-editor.component.spec.ts`: insert after "sets the status bar context when a scene is selected":
  `shows the selected scene layer and tile counts in the status bar` — persists a 10×10 scene, sets
  cells (0,0),(1,1),(2,4)=tileId in layer 0, reloads + selects, asserts last context contains
  `1 layer` and `3 tiles`.
- `sprite-editor.component.spec.ts`: insert after "sets the status bar context when a sprite is selected":
  `shows the selected frame index and count in the status bar` — direct-signal setup (tiles + sprites
  - selectedTileId=10 + selectedSpriteId=2 + selectedSprite=sprite2), asserts last context contains
    `Frame 2/2`.

### Task 2 — Implement (GREEN)

- `scene-editor.component.ts` — extend `statusBarEffect`: compute `layerCount` + `tileCount`, append
  the two segments to `parts` (before the conditional cursor segment).
- `sprite-editor.component.ts` — extend `statusBarEffect`: in the sprite branch, compute
  `const frames = this.currentFrames(); const idx = frames.findIndex((f) => f.id === sprite.id);` and
  append ` | Frame ${idx+1}/${frames.length}` when `frames.length > 0`.

### Task 3 — Verify + ship

- Target tests green; `devbox run npm run lint`; `devbox run npm run build`.
- Commit per task (`feature-3:` prefix), push `feature-3`, open PR `Closes #3`, kanban → In review,
  French report in issue #3.

## Acceptance

- [ ] Empty/no-selection status still correct in both editors (existing `toContain` assertions unchanged).
- [ ] Scene editor shows layer + active-layer tile counts.
- [ ] Sprite editor shows `Frame i/N`.
