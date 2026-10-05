# #53 Runtime: Y-sort tile data & editor (overlay footprint)

Date: 2026-10-04
Status: Draft
Linked issue: #53
Epic: #48
Related: #54 (render half), #55 (configurable player layer), #67 (help-text homogenization)

## Problem

Part of the Mode Play work (epic: #48). Zeldalike depth rendering needs per-tile data
that the sorting relies on. An "overhanging" tile (tree canopy, tall grass, bush)
visually extends above its anchor cell. To sort it in front of / behind the player (the
#54 render half), we must know, per tile, that it overhangs, and where its ground cell
("foot") is. Today nothing marks a tile as overhanging, so #54 would have nothing to
consume.

This US is the **data/authoring** half: ship the sortable flag, the editor UI to set it,
and the convention that makes the anchor well-defined. No rendering change is made here;
tiles only opt in, so existing scenes and tiles are untouched until marked.

## User story

As a level designer, I can mark a tile (tree canopy, tall grass, bush) as "overhanging"
in the tile properties panel. Nothing changes visually yet; when the Y-sort render lands
(#54), overhanging tiles sort correctly in front of / behind the player.

## Design decisions (finalized 2026-10-04)

- **Option A — flag only (chosen).** The anchor is not a stored number: the bottom edge
  of the artwork is the ground contact. For a ySort tile placed at anchor cell `(gx, gy)`,
  the **anchor/bottom row used for depth comparison is `gy`** — #54 will render the sprite
  bottom-aligned to that cell (canopy rises above it). This covers the trees, tall grass,
  and bushes described in the issue and matches the standard Zelda-like tile convention
  (the painter plants the trunk on the ground, the crown overhangs upward).
- **Option B rejected (deferred).** A numeric `anchorOffset` (cells above the image bottom
  where the true foot lies) would only be needed when an image has transparent padding
  under the foot. If a real asset requires it later, add a retro-compatible optional
  field with default `0` (= Option A).
- **Data location: `TileProperties.ySort: boolean`.** `TileProperties` is documented as
  "runtime behaviour properties consumed by the scene engine"; depth sorting is runtime
  rendering behavior. Placing it next to `blocking`/`interactable` keeps the editor wiring
  uniform (the tile-properties form already manages that block).
- **Schema compatibility.** Non-indexed boolean → no Dexie version bump. Store the whole
  object (TileService persists whole `changes`). Legacy tiles lack the key: `undefined`
  must be read as `false` everywhere.
- **Editor UI: tile properties panel** (`tile-manager/properties/`). One checkbox
  "Overhanging (Y-sort)" in the runtime block, next to Blocking / Interactable, plus a
  short helper caption stating the bottom-edge convention. Auto-save reuses the existing
  form pipeline — no new persistence path.
- **No collision change in this US.** Footprint derivation (from first sprite) and the
  blocking grids are untouched; marking a tile ySort has no effect on placement or
  collision until decided together with #54.
- **Scope guard (AC #3):** the render path is not touched; existing tiles with no `ySort`
  key behave exactly as before.

## Architecture

### Data model change — `src/app/shared/models/tile.model.ts`

```ts
export interface TileProperties {
  /** Blocks character movement across the tile. */
  blocking: boolean;
  /** Whether the tile triggers an action on interaction. */
  interactable: boolean;
  /** Key of the action in GAME_ACTIONS; undefined when not interactable. */
  actionId?: string;
  /**
   * Whether the tile overhangs its ground cell (tree canopy, tall grass, bush).
   * Enables in-front / behind depth sorting in Play mode (#54). The bottom edge
   * of the artwork is the ground contact; unused by the current renderer.
   */
  ySort: boolean;
}
```

- `TileService.createTile` sets `ySort: false` explicitly (new tiles start non-sortable).
- All reads default to `false`: `t.properties.ySort ?? false`.

### Editor UI — `tile-manager/properties/tile-properties.component.{ts,html,scss}`

- Add `ySort: [false]` to the `properties` FormGroup (like `blocking`), so the existing
  `valueChanges` auto-save picks it up with no new plumbing.
- New `toggleYSort()` mirrors `toggleBlocking()`.
- `buildUpdatedTile` emits `ySort: value.properties?.ySort ?? false`.
- The tile-identity patch effect reads `ySort: t.properties.ySort ?? false` when
  (re)loading a tile, so legacy tiles open unchecked.
- Template: a checkbox labeled **Overhanging (Y-sort)** in the same section as
  Blocking/Interactable, with a caption line: _"Bottom of the artwork must touch the
  ground cell. Enables in-front/behind sorting in Play mode."_ (11px meta text per the
  design system; copy validated for the future #67 homogenization).

### Persistence & export/import

- `TileService.updateTile(id, changes)` stores the whole object → a changed
  `properties.ySort` persists as-is. No service change required.
- `ProjectIOService` serializes/deserializes tiles as whole objects, so `ySort` flows
  through project export/import (verify `project-io.service.ts` treats unknown
  property keys as pass-through, as it does today).

## Testing

- `tile-properties.component.spec.ts`:
  1. A legacy tile (no `ySort` key) opens with the checkbox unchecked and does not crash.
  2. Toggling the checkbox schedules the existing auto-save; after flush, the `save`
     output carries a tile with `ySort: true` (false when toggled back).
  3. `buildUpdatedTile` preserves `ySort` from the form for an arbitrary edit (e.g. a
     rename) without degrading other properties.
- `tile.service.spec.ts`: `createTile` returns a tile with `ySort: false`.
- Existing tile-properties specs stay green (the FormGroup change is additive).
- Full suite + lint + format via `npm run test`, `npm run lint`, `npm run format:check`.

## Manual QA

- Create a tile, tick "Overhanging (Y-sort)", reload the panel → still checked.
- Open a tile created before this US → checkbox unchecked, nothing else changed.
- Scene editor canvas renders identically before/after toggling (flag not yet consumed).

## Out of scope

- In-front / behind rendering and depth-sorted draw order — #54.
- Collision footprint consequences of overhang (revisit with #54).
- Numeric anchor offset (Option B) — deferred.
- Configurable player render layer — #55.
- App-wide helper-text homogenization — #67.
