# Play mode: fixed viewport resolution

**Date:** 2026-10-15
**Issue:** [#107](https://github.com/xLeDocteurx/river-king/issues/107)
**Status:** Approved

## Context

Play mode follows the player, but the play "view" today is the raw editor canvas at whatever
zoom the user set with the mouse wheel:

- `MapCanvasComponent.onWheel` zooms unconditionally (no `playMode` guard), so the user can
  zoom in/out while playing;
- the visible area is the canvas element size (variable), so there is no authored, reproducible
  "screen". `followPlayer()` simply centers the player using `canvas.width / 2`.

A game view should be a fixed, authored resolution. We add a **per-project viewport
resolution** (in _game pixels_) and render Play at that resolution, integer-scaled to fill the
available canvas.

## Goals

- Each project defines a viewport resolution (`viewWidth` × `viewHeight`, game pixels).
- In Play: **no zoom**; render at the fixed resolution, **integer-scaled** and centered
  (letterbox) to fill the canvas.
- Camera follows the player and is **clamped to the scene bounds** (centered per-axis when the
  scene is smaller than the view).
- Default resolution `256×144` (exact 16:9; exactly 16×9 tiles at a 16px tile size), selectable
  at creation from presets.
- Edit mode keeps free pan/zoom — **unchanged**.

## Non-goals

- No fullscreen/chromeless game mode (A5).
- No change to sprite/tile rendering filters (`imageSmoothingEnabled = false` already gives
  nearest-neighbour).
- No editable project settings screen (`#19`); resolution is chosen at creation only.

## Data model

`Project` gains two **optional** fields (game pixels):

```ts
/** Play-mode viewport width in game pixels (default 256). */
viewWidth?: number;
/** Play-mode viewport height in game pixels (default 144). */
viewHeight?: number;
```

New module `src/app/shared/models/viewport.ts`:

```ts
export interface ViewPreset {
  label: string;
  width: number;
  height: number;
}
export const DEFAULT_VIEW_WIDTH = 256;
export const DEFAULT_VIEW_HEIGHT = 144;
export const VIEW_PRESETS: ViewPreset[] = [
  { label: '256×144 (16:9)', width: 256, height: 144 },
  { label: '320×180 (16:9)', width: 320, height: 180 },
  { label: '384×216 (16:9)', width: 384, height: 216 },
  { label: '256×224 (SNES 4:3)', width: 256, height: 224 },
];
/** Resolves a project's viewport, falling back to the default. */
export function resolveViewport(p: Pick<Project, 'viewWidth' | 'viewHeight'>): {
  width: number;
  height: number;
};
```

- New projects always store `viewWidth` / `viewHeight`.
- Existing projects (no field) resolve to `256×144`. No Dexie migration is needed: these fields
  are not indexed, and the DB stores plain objects.

## Creation UX

`ProjectCreateDialogComponent` adds a preset `<select>` (labels from `VIEW_PRESETS`, default
`256×144`). `CreateProjectDto` gains `viewWidth` / `viewHeight`; `ProjectService.create` writes
them through. The dialog `open()` resets the preset to the default.

## Play rendering (`MapCanvasComponent`)

New inputs `viewWidth = input(DEFAULT_VIEW_WIDTH)`, `viewHeight = input(DEFAULT_VIEW_HEIGHT)`.

In Play mode, on every render/frame:

1. `scale = max(1, floor(min(canvasW / viewW, canvasH / viewH)))` (integer).
2. Destination rect centered: `destX = floor((canvasW - viewW * scale) / 2)`,
   `destY = floor((canvasH - viewH * scale) / 2)`.
3. Render: `ctx.save(); ctx.beginPath(); ctx.rect(destX, destY, viewW*scale, viewH*scale);
ctx.clip(); ctx.translate(cameraX, cameraY); ctx.scale(scale, scale); <draw world as today>;
ctx.restore();`

The camera stays in **screen pixels** exactly as today, and Play simply uses `scale` as the
effective zoom. Because the dest rect is centered, its center equals the canvas center, so
`followPlayer()`'s target `-(player * scale) + canvas.width / 2` is unchanged in shape — only
`zoom` is replaced by the integer `scale`. The bars outside the dest rect show the canvas
background (`clearRect` + parent `bg-background`).

- **Zoom disabled:** `onWheel` returns early when `playMode` is true.
- **Snap on entry:** the first Play frame snaps the camera to the player (no lerp slide from
  the previous edit camera).
- **Camera clamping (Play only):** per axis, in world space, let
  `left = (destX - cameraX) / scale` (world-space left edge shown by the dest rect).
  - if `scenePx >= view`: clamp `left` to `[0, scenePx - view]`;
  - else: `left = (scenePx - view) / 2` (center the scene, negative → margins on both sides).
    Then `cameraX = destX - left * scale` (same for Y).
- Expose `playScale`, `playOffsetX`, `playOffsetY` (0 in edit mode) so consumers can map the
  fixed view.

## Peripherals

- **Status bar** (`SceneEditorComponent`): while `playMode`, show the view resolution (e.g.
  `View 256×144`) instead of the zoom percentage.
- **Minimap**: pass values that describe the fixed view exactly:
  `viewportWidth = viewW * playScale`, `viewportHeight = viewH * playScale`,
  `cameraX = cameraX - playOffsetX`, `cameraY = cameraY - playOffsetY`, `zoom = playScale`.
  In edit mode, pass the values as today.
- `SceneEditorComponent` passes `[viewWidth]` / `[viewHeight]` to `rk-map-canvas` from the
  current project, resolved via `resolveViewport`.

## Export / import / demo

- `project-archive.model.ts` adds optional `viewWidth` / `viewHeight`.
- `project-io.service.ts`: export writes the resolved values; import resolves via
  `resolveViewport` (old archives → default). Validation treats them as optional numbers.
- `demo-project.service.ts` seeds `256×144`.

## Edge cases

- Canvas smaller than the view → `scale = 1`, the view overflows and is clipped.
- Scene smaller than the view (per axis) → scene centered with background margins.
- Scene larger → camera clamped so no out-of-scene area is shown inside the dest rect.
- `viewWidth` / `viewHeight` missing → default `256×144`.

## Testing

- `viewport.spec.ts`: `resolveViewport` fallback + explicit values; presets include the default.
- `project.service.spec.ts`: `create` persists `viewWidth` / `viewHeight`.
- `project-create-dialog.component.spec.ts`: default preset, chosen preset flows into `create`.
- `project-io.service.spec.ts`: round-trip; import of an archive without the fields → default.
- `map-canvas.component.spec.ts`: Play computes integer scale + centered dest; wheel ignored in
  Play; camera clamped at the scene edge; scene smaller than the view is centered; edit mode
  unchanged.
- `scene-editor.component.spec.ts`: passes the resolved view fields to the canvas; status bar
  shows the view resolution in Play.

## Follow-ups

- Project settings screen (`#19`) to edit the resolution after creation.
- Optional fullscreen / chromeless Play (A5).
