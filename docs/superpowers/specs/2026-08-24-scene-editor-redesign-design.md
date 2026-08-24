# Scene Editor Redesign — Design Spec

**Date:** 2026-08-24  
**Approach:** Pro Editor (dense workspace, compact panels, status-bar-driven info).  
**Scope:** Visual and layout restyling of the existing Scene Editor feature; no new functional tools or canvas capabilities.

---

## 1. Goals

Give the Scene Editor a recognizable, professional identity inspired by dense pixel-art editors (Aseprite, Tiled) while staying strictly within the existing design-system tokens and the dashboard's clean visual language.

- **Density**: smaller paddings, tighter typography, no wasted space.
- **Identity**: the screen must immediately read "editor workspace" — panels have visible chrome, the canvas is the clear focal point.
- **Information at a glance**: camera position, zoom level, and scene dimensions live in the existing app-wide status bar (blue footer), not in a secondary bar above the canvas.
- **Consistency**: follow the dashboard header + status-bar pattern already proven in the app.

---

## 2. Current State Analysis

The Scene Editor (`src/app/features/scene-editor/scene-editor.component.html`) currently renders three columns:

```
├─ SceneList (w-64, left)
├─ MapCanvas (flex-1, center)
└─ TilePalette (w-64, right)
```

Problems:
- **No status-bar context**: the editor never pushes data to `StatusBarService`, so the global footer shows only the static "River King Engine" label.
- **Generic spacing**: `tw-w-64` panels and default paddings feel wasteful for an editor.
- **No panel chrome**: sidebars have limited visible borders and headers, so they blend into the canvas area — the screen feels flat and unfinished.
- **Palette dominance**: the tile palette uses large cells (`tw-w-10`) and generous padding, feeling oversized for an editor.

---

## 3. Proposed Design

### 3.1 Top-level layout (rk-scene-editor)

A single flex row filling the routed viewport. The global topbar (35 px) and global status bar (22 px) are **outside** this component and remain unchanged.

```
┌────────────────────────────────────────────────────┐
│ Global topbar (35 px)                              │
├───────┬────────────────────────────┬───────────────┤
│       │                            │               │
│ Scene │      Map Canvas            │  Tile         │
│ List  │      (drop-zone +          │  Palette      │
│       │       canvas element)      │  (right       │
│       │                            │   panel)      │
│       │                            │               │
├───────┴────────────────────────────┴───────────────┤
│ Global status bar — scene context injected here  │
└────────────────────────────────────────────────────┘
```

#### Column widths

| Region | Width | Rationale |
|--------|-------|-----------|
| Scene list | `tw-w-56` (224 px) | Compact but readable; one icon + truncated scene name. |
| Canvas | `tw-flex-1` | Always claims remaining space; never scrolls, the canvas itself pans/zooms. |
| Right panel | `tw-w-52` (208 px) | Narrower than today; will host layers + mini-palette stacked vertically. |

#### Chrome & borders

- Left panel (scene list): right border `tw-border-r tw-border-border`; background `tw-bg-card-bg`.
- Right panel (tile palette): left border `tw-border-l tw-border-border`; background `tw-bg-card-bg`.
- Canvas area: background `tw-bg-background` (the scene grid sits on the base page color).
- No additional outer borders: the panel borders create the visual separation; no invisible gutters.

### 3.2 Scene List (rk-scene-list)

**Header row** (restyled):
- `tw-flex tw-items-center tw-justify-between tw-px-3 tw-py-2 tw-border-b tw-border-border`
- Left: section label `SCENES` in `tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground`
- Right: two ghost icon buttons (`tw-p-1 tw-rounded-sm hover:tw-bg-muted`):
  - `create_new_folder` → create group
  - `add` → create scene

**List body**:
- `tw-flex-1 tw-overflow-auto tw-px-2 tw-py-2`
- Group headers: `tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground tw-px-2 tw-py-1`
- Scene rows: `tw-flex tw-items-center tw-gap-2 tw-px-2 tw-py-1.5 tw-rounded-sm tw-text-xs tw-text-foreground hover:tw-bg-muted tw-transition-colors`
  - Selected row: `tw-bg-primary/10` (keep existing).
  - Trailing delete button stays, but use `tw-p-1` instead of `tw-p-1.5` for density.
- Empty drop target inside collapsed groups: keep dashed border recipe.
- Remove the outer `tw-p-2` wrapper padding that currently creates a gutter between the list edge and the first group.

### 3.3 Right Panel — Tile Palette (restyled)

The right side is already `rk-tile-palette` with an existing header and a `tw-flex-wrap` grid. This redesign keeps the same structure but tightens spacing and cell sizes.

**Header row** (restyled):
- Same anatomy as the scene list header.
- Label: `TILES`
- Optional future action: a collapse-toggle icon (out of scope for this redesign; header is visual prep only).

**Tile grid**:
- Smaller padding on the panel root: `tw-p-2` instead of `tw-p-4`.
- Tighter gap: `tw-gap-1` instead of `tw-gap-2`.
- Smaller cells: `tw-w-8 tw-h-8` instead of `tw-w-10 tw-h-10` (32 px instead of 40 px).
- Keep existing hover (`hover:tw-border-primary`) and selected (`tw-ring-2`) behavior.
- Selected state refined to: `tw-border-accent tw-ring-1 tw-ring-accent` for consistency with hover tokens.

This keeps the existing wrap grid but makes it feel dense and intentional — a compact palette that competes less with the canvas.

### 3.4 Map Canvas (rk-map-canvas)

- Keep all existing interaction logic (pan, zoom, hover preview, tile placement).
- No secondary info bar above the canvas. All numerical readouts live in the global status bar.
- Canvas remains centered on `tw-bg-background` with the grid drawn via 2D context. No CSS changes to the rendering itself.
- The canvas wrapper (`<div class="tw-flex-1 tw-relative tw-overflow-hidden">`) stays; it is the drop zone for mouse events.

### 3.5 Status Bar Integration

The Scene Editor component owns an `effect` that updates `StatusBarService.context` whenever camera, zoom, or selected scene changes.

**Context string format** (single line, left side of the blue bar):

```
{sceneName} | {width}×{height} | Cam: {x},{y} | Zoom: {zoomPct}%
```

Example:
```
Forest Level | 40×30 | Cam: 120,-80 | Zoom: 150%
```

If no scene is selected, show:
```
No scene selected
```

Implementation: `SceneEditorComponent` calls `statusBar.setContext(...)` inside an `effect` that watches:
- `selectedScene()` (for name and dimensions)
- `mapCanvas.cameraX()`, `cameraY()`, `zoom()` (exposed via an output or direct service access)

**Open question**: should `MapCanvasComponent` expose its camera signals via an `output`, or should `SceneEditorComponent` query them via a `viewChild` reference?  
**Decision**: use `viewChild` — the parent already holds a `viewChild` reference pattern (`deleteConfirmDialog`). Add `mapCanvasRef = viewChild.required(MapCanvasComponent)` and read `cameraX`, `cameraY`, `zoom` directly. This avoids output-chaining for app-level state.

---

## 4. Component Changes

### 4.1 scene-editor.component.ts

**Add:**
- `private readonly statusBar = inject(StatusBarService)`
- `mapCanvasRef = viewChild.required(MapCanvasComponent)`
- `effect` block that builds the context string whenever selected scene or camera state changes.

**Modify:**
- Remove the `restoreCamera` input plumbing if it becomes redundant (keep the session restore logic, just don't plumb it as an `@Input` if the parent can call a method instead).  
  **Decision**: keep `restoreCamera` as `@Input` — it is consumed once in `ngAfterViewInit`; changing the wiring is unnecessary churn.

### 4.2 scene-editor.component.html

```html
<div class="tw-flex tw-h-full">
  <!-- Left: Scene List -->
  <rk-scene-list class="tw-w-56 tw-shrink-0 tw-bg-card-bg tw-border-r tw-border-border" ... />

  <!-- Center: Canvas -->
  <div class="tw-flex-1 tw-relative tw-overflow-hidden tw-bg-background">
    <rk-map-canvas
      [scene]="selectedScene()"
      [selectedTileId]="selectedTileId()"
      [palette]="projectPalette()"
      [tileImages]="tileImages()"
      [tileSize]="projectTileSize()"
      [tileFootprints]="tileFootprints()"
      [restoreCamera]="restoreCamera()"
      (tilePlaced)="onTilePlaced($event)"
    />
  </div>

  <!-- Right: Tile Palette -->
  <rk-tile-palette
    class="tw-w-52 tw-shrink-0 tw-bg-card-bg tw-border-l tw-border-border"
    [tiles]="projectTiles()"
    [selectedTileId]="selectedTileId()"
    [palette]="projectPalette()"
    [tileImages]="tileImages()"
    (tileSelect)="selectedTileId.set($event)"
  />
</div>

<rk-confirm-dialog [data]="deleteDialogData()" (confirmed)="onConfirmDelete()" />
```

### 4.3 scene-list.component.html

Restyle per §3.2. Keep all existing drag-and-drop logic and outputs. The component API (inputs/outputs) does **not** change.

### 4.4 tile-palette.component.html

Restyle the inner grid per §3.3. Keep component API unchanged.

### 4.5 map-canvas.component.ts

No structural changes. Existing camera signals (`cameraX`, `cameraY`, `zoom`) are already public class members, so `SceneEditorComponent` can reach them via `viewChild`.

---

## 5. Token Usage Reference

| Element | Background | Text | Border | Notes |
|---------|-----------|------|--------|-------|
| Scene list panel | `tw-bg-card-bg` | — | `tw-border-r tw-border-border` | Right border only |
| Scene list header | same as panel | `tw-text-muted-foreground` | `tw-border-b tw-border-border` | |
| Scene row hover | `hover:tw-bg-muted` | `tw-text-foreground` | — | |
| Scene row selected | `tw-bg-primary/10` | `tw-text-foreground` | — | |
| Right panel | `tw-bg-card-bg` | — | `tw-border-l tw-border-border` | Left border only |
| Tile cell hover | — | — | `hover:tw-border-accent` | |
| Tile cell selected | — | — | `tw-border-accent tw-ring-1 tw-ring-accent` | |
| Canvas area | `tw-bg-background` | — | — | Base page color |
| Status bar | `tw-bg-primary` (global) | `tw-text-primary-foreground` (global) | — | Set via `StatusBarService` |

All typography follows the design-system levels (§Typography & density in foundations.md).

---

## 6. Accessibility & Interactions

- Keyboard operability on scene rows and tile cells: `tabindex="0"` + Enter/Space handlers for selection.
- Focus rings remain visible (global `:focus-visible` rule); never override.
- Drag-and-drop retains existing CDK behavior; no new keyboard alternative required for this visual pass.
- All icons are Material Symbols with `aria-hidden="true"`; labels are text or `title` attributes.

---

## 7. Testing Impact

- Existing component tests continue to pass because component APIs are unchanged.
- Add a test in `scene-editor.component.spec.ts` verifying that `StatusBarService.setContext` is called with the correct string when a scene is selected and camera values change.
- Snapshot/visual changes in `scene-list.component.spec.ts` and `tile-palette.component.spec.ts` need updated DOM assertions (different class lists, same behavior).

---

## 8. Out of Scope (Phase 2+ ideas, deliberately excluded)

- **Toolbar on the left** (brush, eraser, selection, fill tools): there are no tool abstractions in the canvas today; adding them is a functional feature, not a visual redesign.
- **Layer system**: the scene data model has no layers; this redesign only visually restyles the existing tile placement.
- **Tabs in the right panel** (Layers / Palette / Properties): header is styled with room for future expansion, but no tab component is introduced now.
- **Canvas rulers / coordinates**: status bar provides numerical position; rulers are a separate feature.
- **Animated transitions**: no CSS transitions beyond the existing `tw-transition` on hover/focus.

---

## 9. Open Decisions (resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Info bar above canvas? | **No** | User confirmed removal; blue status bar at the bottom is sufficient. |
| Camera readout: output vs viewChild? | **viewChild** | Parent already uses `viewChild` for `ConfirmDialogComponent`; same pattern avoids output chaining. |
| Palette layout: list vs grid? | **Grid** | Grid is denser, aligns with Aseprite palette identity, and fits the narrower `tw-w-52` panel. |

---

## 10. Acceptance Criteria

1. Scene editor renders without horizontal page scroll; only the canvas itself pans.
2. Scene list and tile palette are each ≤ 230 px wide.
3. Global status bar (blue footer) dynamically shows selected-scene name, dimensions, camera coordinates, and zoom percentage.
4. Both light and dark themes look intentional — no hardcoded colors, no broken contrast.
5. All existing tests pass after updating DOM selectors where class names changed.
