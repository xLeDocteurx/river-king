# Editor UX Batch & Feature Structure — Design

Date: 2026-08-24
Branch: `feature-editor-ux` (off main @ 4852229)
Status: Approved-by-delegation (user asleep, autonomy granted twice after request; decisions documented here for morning review)

## Context

The user requested eight improvements in one batch, on a new branch:

1. Choose a palette when creating a project (10 curated Lospec palettes; Sweetie 16 stays the default/current).
2. Revisit the "flat feature" rule — allow subfolders inside a feature, ideally mirroring the parent/child component tree. Proposals requested; recommendation wanted.
3. Debounce sprite saves (~0.25 s after the last drawing action) instead of saving on every pixel.
4. On the sprites screen, remove the manual add/delete buttons — sprites must live and die with tile creation, frame-count changes, and animation-type changes. User noted two pain points: deleting frames could orphan tiles, and a newly created tile has no sprite until its type is edited ("chiant").
5. Group the sprite list under folder headers named after the parent tile (display-only; no drag & drop).
6. Make the palette panel 4 swatches wide instead of 5 (16-color default becomes a 4×4 square).
7. Kill the sprite editor "focus mode": one consistent screen regardless of entry point, even at the cost of the "Back to tiles" button.
8. Persist the selected tile in the URL on the tiles screen (refresh currently loses the selection, unlike sprites).

## Decisions

### D1 — Palette picker at project creation

New file `src/app/core/palettes/lospec-palettes.ts` exporting:

```ts
export interface LospecPalette {
  id: string;
  name: string;
  colors: string[]; // hex WITHOUT '#', lowercase, exact Lospec order
}
export const LOSPEC_PALETTES: LospecPalette[];
```

All 10 palettes embedded verbatim (hex fetched from lospec.com JSON API): sweetie-16 (16), 33 (33), pico-8 (16), pico-8-secret-palette (32), slso8 (8), oil-6 (6), twilight-5 (5), slimy-05 (5), nymph-gb (4), 2bit-demiboy (4). Palette sizes legitimately vary.

`ProjectCreateDialogComponent`: adds a palette selector between the name input and the actions row — a vertical list of selectable rows, each showing palette name + a compact swatch strip; Sweetie 16 preselected and labeled "(default)". Selection stored in a signal; `createProject()` uses the chosen palette's colors instead of the hardcoded array (hardcoded array deleted). No other ProjectService changes — `project.palette` already carries the hex array.

### D2 — Feature folder structure (rule change)

Options considered:

- **A. By kind** (`components/`, `services/`) — classic Angular, but splits one logical unit across trees.
- **B. Mirror the component hierarchy** — each child region gets a subfolder holding its `.ts/.html/.scss/.spec`; feature root keeps routes + shell + feature service.
- **C. Flat until N files** — status quo; doesn't answer the readability complaint.

**Recommendation (adopted): B**, because it matches how the user already thinks about the app (parent/child) and keeps each visual region self-contained. Rule text for AGENTS.md (replaces the flat-structure sentence):

> Features are organized into subfolders that mirror their component hierarchy. Each subfolder holds one component's `.ts`, `.html`, `.scss`, and `.spec` files. The feature root keeps the routes file, the feature shell component, and the feature's services. Small features (a single component) may stay flat.

Applied in this batch to the two features being reworked. The trees below are illustrative — subfolder names follow the feature's ACTUAL child components (verify before moving):

```
features/sprite-editor/
├── sprite-editor.routes.ts
├── sprite-editor.component.{ts,html,scss,spec.ts}   # shell stays at root
├── canvas/pixel-canvas.component.*                  # example naming
├── palette/palette-manager.component.*
└── tools/drawing-tools.component.*

features/tile-manager/
├── tile-manager.routes.ts
├── tile-manager.component.*
├── list/tile-list.component.*
└── properties/tile-properties.component.*
```

Dashboard, scenes, project-shell keep their current layout (small enough); the design-system phase-2 pass will apply the rule opportunistically where it edits those files anyway.

### D3 — Debounced sprite persistence

`SpriteEditorComponent.onCanvasChange` stops writing IndexedDB synchronously. A private `schedulePersist()` stores the pending payload and (re)starts a 250 ms trailing timer; the actual `updateSprite` runs only when the user pauses. Immediate behaviors unchanged: canvas renders locally, parent signals (`paletteIndices`, `selectedSprite`) echo instantly.

Flush guarantees: pending save flushes on `ngOnDestroy`, on sprite switch (`selectSprite`), and before creating/resizing operations that replace sprite data. Worst case lost work on a hard browser refresh mid-stroke: ≤250 ms of pixels (accepted; noted in spec deliberately).

### D4 — Sprite lifecycle bound to tiles

- **Remove** the add-sprite button and per-row delete button from the sprites screen (they may live in the shell template or the sprite-list component — remove wherever rendered, along with their handlers: `createSprite()` and the standalone `requestDelete()`/`deleteSprite()` path).
- **Chicken-egg fix:** `TileManagerComponent.createTile` now creates the tile AND its first blank frame ("frame 1", static type) in sequence, so every new tile immediately owns one sprite. The dashed placeholder in tile-properties disappears in practice.
- Existing transitions already cover every legitimate deletion: animated→static with >1 frames asks confirmation and deletes extras; shrinking frame count asks confirmation; `tileService.deleteTile` cascades sprite deletion in one transaction. Static tiles therefore always hold exactly one sprite.
- Pre-existing orphan sprites in local dev databases are left alone (no migration; UI can no longer produce them).

### D5 — Sprite list grouped by parent tile

The sprite list markup stays where it is today (inline in the sprite editor shell). A computed groups `sprites()` by `tileId`, ordered by parent tile name (`localeCompare`), each group's rows sorted by sprite name; tiles for name lookup arrive via the project-wide `TileService.getTiles(projectId)`. Header rows reuse the scene-list folder-header recipe (`tw-flex tw-items-center tw-gap-2 tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted-foreground tw-uppercase` + material-symbols `folder`). Row click selects through the existing handler; selection highlight unchanged. No drag & drop, no manual CRUD buttons (D4).

### D6 — Palette panel width

`palette-manager.component.html`: swap the flex-wrap container for `tw-grid tw-grid-cols-4 tw-gap-1`; swatches keep `tw-w-8 tw-h-8`. 16-color palettes render 4×4; other sizes wrap in complete rows of 4.

### D7 — One consistent sprite editor screen

Delete the focus-mode machinery: the `focusMode` signal, both conditional template branches, the centered "Back to tiles" button, and `backToTiles()`. The screen is always: sprite list (left) · canvas (center) · tools (right). The `/sprites/:spriteId` route remains purely as a deep link — entering via a tile-properties thumbnail opens the same screen with that sprite preselected (param subscription already does this). The sprite name header moves into the persistent canvas header area.

### D8 — Tile selection persisted in URL

`TILE_MANAGER_ROUTES` gains `':tileId'` beside `''`. Selecting a tile calls `router.navigate(['/project', projectId, 'tiles', tileId])`; `createTile` navigates to the freshly created tile; the param subscription restores `selectedTileId` on load (mirroring the sprite editor's existing param handling). Refresh and deep links now preserve the highlighted tile. Browser Back walks tile selections — accepted as natural.

## Error handling

- All IndexedDB writes (debounced saves included) stay wrapped in try/catch → `NotificationService.error(...)`.
- Frame-reduction and type-change confirms reuse `rk-confirm-dialog`.
- A failed debounced flush retries once on next stroke scheduling; persistent failure surfaces one toast (not one per pixel batch).

## Testing

- `lospec-palettes.spec.ts`: ids unique, every palette non-empty, all hex valid (`/^[0-9a-f]{6}$/i`), counts match spec (16/33/16/32/8/6/5/5/4/4).
- Dialog spec: default selection is Sweetie 16; chosen palette reaches `ProjectService.create`.
- Sprite editor spec: rapid `onCanvasChange` bursts produce ONE `updateSprite` after quiet period (fake timers); flush on destroy/sprite-switch covered.
- Tile manager spec: `createTile` produces tile + first frame; `:tileId` param restores selection.
- Sprite list spec: grouping order, header labels from parent tiles, selection output intact.
- Palette manager spec: renders 4 columns (class assertions).
- All existing specs updated for moved files (D2) — pure path/import churn.

## Out of scope

- Design-system application to remaining screens (phase 2, separate spec).
- Sprite reordering / drag & drop.
- Migration of pre-existing orphan sprite rows.
