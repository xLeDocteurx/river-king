# #52 Runtime: Interactable Tile Actions (E-key)

Date: 2026-09-05
Status: Draft
Linked issue: #52
Epic: #48
Depends on: #49 (player controller), #51-a (cell-level collision, player position semantics)
Related: #58 (pixel-perfect collision masks), #60 (drawable player hitbox)

## Problem

Part of the Mode Play work (epic: #48, depends on the player controller #49). The
tile model already carries `TileProperties.interactable` and `TileProperties.actionId`,
and the tile editor already ships the interactable checkbox + action-Id dropdown
(`tile-properties.component.ts`), but nothing consumes them at runtime. This US makes
interactable tiles emit their action, with a visible confirmation, when the player
presses a dedicated interaction key.

## User story

As a player, when I stand on or face an interactable tile (door, sign, portal, chest)
and press the interaction key, its registered action fires and I get a visible
confirmation. Level designers can rely on `interactable` + an `actionId` selected from
the existing `GAME_ACTIONS` registry to hook behavior into a scene.

## Design decisions (finalized 2026-09-05)

- **Explicit key trigger (E).** The player presses `E` to interact. Auto-fire on
  entry was considered and rejected: walking across a carpet of interactable tiles
  would trigger actions unintentionally. A dedicated key is also the base for future
  game objects (dialogues, items) that must not fire on mere proximity.
- **Scope: facing cell first, then the cell under the player.** Keypress `E` targets
  the tile in the cell directly in front of the player (facing direction). If that
  cell is out of bounds, empty, or not interactable, it falls back to the cell the
  player currently stands on. This is Zelda-like: you interact with what you look at.
- **Visible target indication.** While a valid target exists, an accent-colored frame
  is drawn around that cell on the play canvas — the player always knows what `E` will
  trigger.
- **Pure function module.** Target-detection logic lives in a pure TS module
  (`interaction.ts`, like `collision.ts`), fully testable without Angular. The player
  controller keeps the per-tile maps and calls it.
- **Keep the registry pure.** `GAME_ACTIONS` stays a plain `Record<string, () => void>`
  with no Angular dependency. The stub `test: () => alert('alert')` becomes a no-op;
  the visible confirmation is a runtime toast (`NotificationService`), not an `alert`.
- **5th parameter on `start()`.** `PlayerController.start` gains
  `interactableById: Map<number, string>` (tileId → actionId). A separate setter was
  rejected: `start` is the single entry point of a play session and the per-tile maps
  belong to one lifecycle. Call-sites are few (enterPlay + tests).

## Architecture

### Coordinate model (reuses #51-a)

- Player position is the **center** in grid cells; the cell under the player is
  `(Math.floor(x), Math.floor(y))`.
- The facing cell is `(floor(x) + dx, floor(y) + dy)` where `(dx, dy)` is the current
  `direction` (`{dx, dy}` ∈ {-1, 0, 1}², per `MOVEMENT_KEYS`).

### New pure module `interaction.ts` (scene-editor feature)

```ts
/**
 * Returns the effective tile id at a cell, following rendering order: the
 * topmost visible layer wins. Hidden layers are skipped. `-1` (empty) when no
 * layer paints that cell.
 *
 * @param x      - Cell column.
 * @param y      - Cell row.
 * @param layers - Scene layers; the LAST visible layer with a tile wins.
 * @returns The tile id painted at the cell, or `-1` when empty.
 */
export function topmostTileIdAt(x: number, y: number, layers: Layer[]): number;

/**
 * Finds the interactable tile `E` should trigger for a player: the facing cell
 * first, then the cell under the player.
 *
 * @param cell       - Cell under the player center.
 * @param direction  - Facing direction ({dx, dy}).
 * @param layers     - Scene layers.
 * @param interactableById - Map of tileId -> actionId for interactable tiles.
 * @returns {x, y, actionId} for the target, or `null` when nothing is in range.
 */
export function findInteractableTarget(
  cell: { x: number; y: number },
  direction: { dx: number; dy: number },
  layers: Layer[],
  interactableById: Map<number, string>,
): { x: number; y: number; actionId: string } | null;
```

Facing priority: the facing cell is checked first and wins when it is in bounds and
its topmost tile id is in `interactableById`. Otherwise the cell under the player is
checked the same way. Otherwise `null`.

### Integration

- `SceneEditorComponent.enterPlay()` builds
  `interactableById = new Map(projectTiles().filter(t => t.properties.interactable && !!t.properties.actionId).map(t => [t.id, t.properties.actionId as string]))`
  and calls `player.start(scene, spawn, blockingById, tileFootprints(), interactableById)`.
  Tiles flagged interactable without an `actionId` are excluded from the map (nothing
  to trigger).
- `PlayerController`:
  - `start(scene, spawn, blockingById, footprints, interactableById)`: stores the
    layers reference plus the new map, as today for the blocking grid.
  - `interactionTarget = signal<{ x, y, actionId } | null>(null)` — recomputed at the
    end of every `update(dt)` from the current center cell and direction, so the
    highlight follows movement and facing.
  - keydown handler: on `e` / `E` with `!event.repeat`, if `interactionTarget()` is
    non-null, calls `runGameAction(actionId)` and
    `notification.success("Action '<id>' triggered")`.
  - `stop()` already removes the window listeners (unchanged).
- `map-canvas.component.ts` (play render): when `playMode()` and
  `player.interactionTarget()` is non-null, draws an accent-colored stroke frame
  around the target cell (`strokeRect(cell.x*cellPx, cell.y*cellPx, cellPx, cellPx)`),
  same coordinate space as the spawn marker (under the camera transform).
- `game-actions.ts`: the `test` handler changes from `() => alert('alert')` to a
  no-op. The registry contract is unchanged.

## Edge cases

- **Key auto-repeat:** holding `E` fires once per press (`event.repeat` guard).
- **Facing cell out of bounds:** falls back to the cell under the player (e.g. player
  against the scene edge).
- **Below cell not interactable / empty:** `interactionTarget` is `null`; pressing `E`
  is a no-op.
- **Interactable tile flagged but no actionId:** excluded at map build time (#52); and
  even if reachable, `runGameAction('')` is a registry no-op (defensive).
- **Stale/unknown actionId:** `runGameAction` no-ops (existing registry behavior), so
  stale data cannot crash the runtime.
- **Interactable + blocking tile (e.g. a door):** still targetable from range; the
  player simply cannot walk through it (handled by #51-a).
- **Highlight when no target:** no frame is drawn.
- **Exit play mode:** `stop()` removes listeners; the signal and frame disappear with
  the play render.

## Testing

- `interaction.spec.ts` (pure):
  - `topmostTileIdAt`: top visible layer wins over lower ones; hidden layers are
    skipped; an opacity-0 layer still counts (consistent with #51-a); empty → `-1`;
    out-of-bounds read returns `-1` (caller guards, function defensive).
  - `findInteractableTarget`: facing cell wins; falls back to the under-player cell
    when facing is empty / non-interactable / out of bounds; `null` when neither is
    interactable or the map is empty.
- `play-controller.spec.ts`:
  - E on an interactable target calls `runGameAction` with the right id and shows the
    success toast.
  - E with no target does nothing (no toast, no action).
  - Held/repeated E fires once (`event.repeat`).
  - `interactionTarget` updates when the player moves and when direction changes.
- `map-canvas.component.spec.ts`: accent frame is drawn when a target exists; nothing
  when not.
- `game-actions.spec.ts`: `test` handler is a no-op (no throw, no alert).
- Full suite + lint stay green.

## Performance considerations

`findInteractableTarget` runs once per frame: it inspects two cells across the visible
layers (two scans of `layers`), with a `Map` lookup. Negligible for editor scene sizes
and play at ~60 fps.

## Out of scope

- Key/control remapping (idea captured as **A7** in `docs/ideas.md` — future issue).
- Real game-specific effects (dialogues, portals, object/tile switches — the "A3.
  Interactions réelles" thread of the engine roadmap).
- Auto-fire on entry/adjacency triggers.
- Pixel-perfect collision masks (#58) and the drawable player hitbox (#60).
- The interactable editor UI (checkbox + dropdown) — already shipped in the tile manager.