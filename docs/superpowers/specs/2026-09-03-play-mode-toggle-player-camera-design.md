# Play Mode: Toggle + Player Controller + Camera Follow

Date: 2026-09-03
Status: Draft
Linked issue: #49
Epic: #48

## Problem

A scene can be composed but never walked through. This US delivers the core of
Direction A (Mode Play): a Play/Edit toggle, a player the user moves with
WASD/arrow keys, and a camera that follows. It is the first runtime slice of the
`Mode Play` epic.

Related work is deliberately excluded so this US stays small and shippable:

- Full player authoring (a player is a set of animations, not one sprite) is a
  dedicated issue: **#56**.
- Depth rendering (Y-sort in front/behind player, configurable player layer) is
  split out: **#53**, **#54**, **#55**.
- Tile collisions are **#51**; interactable actions are **#52**.

## User story

As a level designer, I can toggle a scene into Play mode, move a player around
with WASD/arrows, and have the camera follow me — so I can walk through what I
built. I can also set where the player starts in the scene.

## Proposed behavior

- A **Play/Edit toggle** in the scene editor.
- Entering Play mode: the user controls a player (WASD/arrow keys), the camera
  follows, and the pre-built layers are the playable world.
- The player renders **above all layers** (v1). Depth work is deferred.
- A **spawn tool** lets the user place the player's starting point on the scene;
  the default is the scene center.
- Each entry into Play starts the player at the spawn point (no session-position
  persistence).

## Design decisions (finalized 2026-09-03)

- **Toggle location:** overlay button(s) on the scene canvas, matching the
  existing floating grid-toggle pattern (`scene-editor.component.html:43-49`).
  A Play button flips a `playMode` signal; in Play mode a toolbar overlay offers
  Stop/back-to-edit.
- **Player render v1 = above everything.** No Y-sort, no configurable layer in
  this US (deferred to #53/#54/#55).
- **Spawn is stored on the scene** (IndexedDB), as a non-indexed field — no Dexie
  schema migration required (the `scenes` table only indexes
  `id, projectId, name, folderPath`; Dexie stores whole objects).
- **Default spawn:** scene center `(floor(width/2), floor(height/2))` when no
  explicit spawn is set. Re-checked: using center is safe and showable; portals
  (Direction C) will not conflict — a portal overrides the position at runtime and
  can later reuse this same `spawnPoint` concept as a landing offset.
- **No session-position persistence:** every Play entry starts from the spawn.
- **Placeholder sprite:** this US uses a simple placeholder/colored box for the
  player; the real avatar comes from #56.

## Architecture

### Data model change

Add to `Scene` (`src/app/shared/models/scene.model.ts`):

```ts
/** Player spawn cell, in grid coordinates. Absent -> scene center. */
spawnPoint: { x: number; y: number } | null;
```

- Non-indexed, so no Dexie version bump. Existing scenes have `spawnPoint ===
  undefined` which is treated as "use default (center)".
- `ProjectIOService` serializes/deserializes scenes as whole objects, so the new
  field flows through project export/import unchanged (verify in
  `project-io.service.ts`).

### Play mode state

`SceneEditorComponent` owns a `playMode = signal(false)`.

- Toggling to Play requests the map canvas and `PlayerController` to start.
- Toggling back to Edit stops the loop and restores editor behavior.

### PlayerController (scene-editor feature service)

A testable service holding runtime player state and movement logic:

- State: position (grid-cell float or screen offset), direction, speed.
- `update(dt)`: applies input direction to movement.
- Exposed as signals so the canvas can read the player position each frame.
- Lives in the scene-editor feature (`features/scene-editor/services/`) and is
  provided by the scene editor root component — consistent with how
  `MapTilesService` is provided today. (Movement-only for #49; collision hooks
  land in #51.)

### Rendering inside MapCanvasComponent

`MapCanvasComponent` already runs the rAF loop (extended by #50 for continuous
runs) and owns the camera signals. In `render()`:

1. Draw all layers as today (unchanged).
2. If `playMode`:
   - Convert the player's grid position to screen coords using the same camera
     transform.
   - `drawImage` the placeholder sprite above everything.
   - Drive the camera to follow the player (lerp the camera to the player's
     screen position).

Add inputs: `playMode: InputSignal<boolean>`, and an input carrying the current
player render position (or read `PlayerController` directly via inject).

### Input handling

- Reuse the existing `KeyboardShortcutsService` where possible, but note that
  WASD/arrow **held keys** need raw keydown/keyup listeners (presence is stateful,
  not one-shot shortcuts). Add a lightweight key-state tracker (e.g. a
  `KeyStateService` or a listener inside `PlayerController`) that records
  currently-held movement keys.
- When `playMode` is on, editor-only shortcuts (undo/redo/delete/save) should be
  suppressed or ignored to avoid accidental destructive edits.

### Spawn tool

- A toolbar button (overlay, near the grid toggle) enters "place spawn" mode:
  the next click on the canvas sets `scene.spawnPoint`. A marker (e.g. a pinned
  icon) is drawn at the spawn cell so it is visible in Edit mode.
- Persisting: call `SceneService.updateScene(scene.id, { spawnPoint })`, same
  flow as saving other scene edits, with error handling via
  `NotificationService.error()`.

## UI/UX details

- Play button: Material Symbol, e.g. `play_arrow` / `stop`, distinct active state.
- In Play mode, hide editing affordances (grid, palette selection highlight) to
  signal "game view"; keep the minimap or replace with an in-game feel per
  simplicity.
- Spawn marker: subtle, non-destructive overlay in Edit mode, drawn on the canvas
  above tiles but below the grid.

## Error handling

- Async IndexedDB writes (spawn persistence) wrapped in `try/catch`; failures
  surface via `NotificationService.error()` per project convention.
- Entering Play with no scene selected is a no-op (toggle disabled).

## Testing

- **PlayerController unit tests:** movement changes position per input direction
  (with/without diagonal), direction state updates, update is frame-rate
  independent (uses `dt`).
- **Canvas tests:** with `playMode` on, the placeholder is drawn after layers;
  with it off, nothing extra is drawn; camera centers on the player.
- **Spawn:** default resolves to scene center; a placed spawn persists via
  `SceneService` and renders a marker; update failure calls
  `NotificationService.error()`.
- **Toggle:** Play flips the signal and starts/stops the loop; editor shortcuts
  are suppressed in Play mode.
- Manual: walk a scene, camera follows smoothly, exit restores Edit unchanged.

## Performance considerations

- Player draw is one extra `drawImage` per frame — negligible.
- Camera follow uses the existing camera signals; no new per-frame allocations of
  concern.

## Out of scope

- Real player avatar / animations (#56).
- Y-sort / configurable player layer (#53/#54/#55).
- Tile collisions (#51) and interactable actions (#52).
- Portals, dialogues, state variables (Direction C).
- Persisting the player's last position across Play sessions.
