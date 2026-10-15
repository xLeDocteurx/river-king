# Wake-up report — Play viewport resolution (#107)

**Date:** 2026-10-15
**Author:** OpenCode session (autonomous, overnight)
**Branch merged:** `feature-107` → `develop` (merge commit `50e7ede`, PR #108)
**Status:** ✅ Merged, CI green, issue closed, kanban **Done**

---

## TL;DR

You asked for Play mode to stop zooming and use a fixed, project-defined viewport
resolution, with a sane default close to a 16:9 Super-NES-ish look. It is fully shipped to
`develop` following the ticket flow (spec → plan → 6 TDD tasks → PR → merge). Default is
**256×144** (exactly 16:9 and exactly 16×9 tiles at 16 px). Play now renders integer-scaled,
letterboxed, with a clamped follow camera; edit mode is untouched.

---

## What you got

### Play mode

- **No more zoom in Play.** The mouse wheel is ignored while playing (it still works in Edit).
- **Fixed resolution, integer-scaled, centered (letterbox).** The game renders at the
  project's viewport resolution (in _game pixels_) and is scaled up by the largest integer
  factor that fits the canvas, preserving the aspect ratio; unused space is letterboxed.
  Never fractional, never stretched.
- **Camera follows the player and is clamped to the scene.** Entering Play snaps the camera
  onto the player (no start-up pan); each follow tick clamps so the viewport never shows
  outside the map. If the map is smaller than the viewport on an axis, that axis is centered.
- **Status bar** shows `View W×H` while playing instead of `Zoom: N%` (and drops the `Cam:` X,Y
  segment, which is meaningless in a fixed view).
- The **minimap** is adjusted so its viewport rectangle matches the scaled Play view.

### Project configuration

- Each project now carries `viewWidth` / `viewHeight` (optional fields; **no DB migration** —
  they are not indexed).
- The **project creation dialog** gained a **Play Resolution** dropdown with 4 presets:
  - **256×144 (16:9)** ← default
  - 320×180 (16:9)
  - 384×216 (16:9)
  - 256×224 (SNES 4:3)
- Existing projects (created before this feature) fall back to **256×144** automatically.
- **Export/Import** archives carry the resolution; older archives import with the default.
- The **demo project** seeds the default.

---

## Key design decisions (and the reasoning)

1. **Resolution in game pixels**, independent of `tileSize` — it is a camera/window concept,
   not a tile concept.

- **Integer scale, not fractional.** Keeps pixel art crisp; the alternative (fractional fit)
  blurs pixels or requires a filter, which defeats the pixel-art purpose.
- **Default 256×144.** It is exactly 16:9 _and_ an exact multiple of the standard 16 px tile
  (16×9 tiles), so it lines up perfectly with the tile grid — a nicer default than 320×180 for
  this specific engine.
- **Configured at creation only.** Editing it later is deferred to the existing settings-screen
  follow-up (#19) to keep this change focused.
- **Approach: clip + integer scale on the existing canvas** — no offscreen buffer, no CSS
  scaling. Simplest thing that is correct and testable.

---

## How it was built (traceability)

| Step   | Artifact                                                                                 |
| ------ | ---------------------------------------------------------------------------------------- |
| Spec   | `docs/superpowers/specs/2026-10-15-play-viewport-resolution-design.md`                   |
| Plan   | `docs/superpowers/plans/2026-10-15-play-viewport-resolution.md`                          |
| Issue  | [#107](https://github.com/xLeDocteurx/river-king/issues/107)                             |
| PR     | [#108](https://github.com/xLeDocteurx/river-king/pull/108) (merge commit into `develop`) |
| Kanban | Project #6 item → **Done**                                                               |

**Commits on the branch** (all `feature-107:` prefixed):

1. add spec and plan
2. add viewport resolution model and presets
3. persist viewport resolution on project creation
4. pick the play viewport resolution when creating a project
5. carry the viewport resolution in project archives
6. render the play view at a fixed integer-scaled resolution
7. drive the play viewport from the project scene editor
8. apply prettier formatting

### Files touched (21)

- **New:** `src/app/shared/models/viewport.ts`, `src/app/shared/models/viewport.spec.ts`,
  the spec and plan docs.
- **Model:** `project.model.ts`, `project-archive.model.ts`.
- **Services:** `dashboard/services/project.service.ts`, `core/services/project-io.service.ts`,
  `core/services/demo-project.service.ts`.
- **UI:** `dashboard/project-create-dialog.component.{ts,html}`,
  `scene-editor/map-canvas.component.ts`, `scene-editor/scene-editor.component.{ts,html}`.
- Plus the matching `*.spec.ts` files.

---

## Verification (all green before merge)

| Check                       | Result                                                                           |
| --------------------------- | -------------------------------------------------------------------------------- |
| `npm run test`              | **56 files / 674 tests passed**                                                  |
| `npm run lint`              | clean                                                                            |
| `npm run format:check`      | clean                                                                            |
| `npm run build`             | success — initial bundle ~390 kB (within the 500 kB warning / 1 MB error budget) |
| CI (`check` job on PR #108) | **passed**                                                                       |

---

## Notable implementation details / gotchas encountered

- **`untracked()` around the snap.** The snap-on-Play effect must wrap `snapCameraToPlayer()`
  in `untracked()`, otherwise the effect subscribes to `player.x()/player.y()` and fights the
  per-frame `followPlayer()` damping.
- **Plan bug caught during Task 4.** The plan suggested
  `...resolveViewport(project)` in the export literal, but `resolveViewport` returns
  `{ width, height }`, not `{ viewWidth, viewHeight }` — that would have emitted wrong keys.
  Fixed to explicit `viewWidth: view.width, viewHeight: view.height`.
- **Canvas test stubs.** Existing inline `ctx` stubs in `map-canvas.component.spec.ts` lacked
  `rect`/`clip`; added them so the new clip+scale render could be asserted.
- **Async DB in tests.** `loadProjectData()` performs IndexedDB work that `whenStable()` does
  not track; the new scene-editor tests call it explicitly and flush with a short timeout.

---

## Deliberately out of scope (follow-ups)

- An **editable project settings screen** for the resolution (#19 is the existing
  "Project rename / settings dialog", currently **Blocked**).
- A dedicated **fullscreen game mode** with true presentation controls.
- These were noted in the spec's follow-ups section.

---

## Suggested next steps

1. Play a scene and eyeball the letterbox behavior on your monitor — confirm 256×144 is the
   right default for your taste (it is trivially changeable per project at creation).
2. Decide whether editing the resolution after creation belongs in **#19** or its own ticket.
3. When you want to cut a release, the `release` skill is ready (develop → main via a labelled
   release PR).

No blockers. Everything is on `develop` and locally fast-forwarded.
