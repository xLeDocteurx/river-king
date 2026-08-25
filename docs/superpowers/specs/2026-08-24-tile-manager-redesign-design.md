# Tile Manager Redesign — Design Spec

**Date:** 2026-08-24  
**Approach:** Workspace Editor Dense (coherent with Scene Editor redesign).  
**Scope:** Visual and layout restyling of the Tile Manager feature; no new functional capabilities.

---

## 1. Goals

Give the Tile Manager screen a dense, professional editor identity that matches the Scene Editor style. Fix the "bootstrap 2000s" form look by organizing fields into visual sections and tightening spacing.

- **Density**: smaller paddings, tighter typography, no wasted vertical space.
- **Identity**: the screen must read "asset editor" — panels have chrome, the form has clear sections.
- **Information at a glance**: status bar (blue footer) shows tile count when no selection, and detailed tile info when one is selected.
- **Consistency**: same column widths, header patterns, and chrome rules as the Scene Editor.

---

## 2. Current State Analysis

The Tile Manager (`tile-manager.component.html`) renders a two-column layout:

```
├─ TileList (w-64, left)
└─ TileProperties (flex-1, right, form)
```

Problems:

- **No status-bar context**: the tile manager never pushes data to `StatusBarService`.
- **Generic list spacing**: same `w-64` and loose paddings as the old scene list.
- **Flat form**: all fields are stacked vertically with no visual grouping — Name, Type, Sprite, Frames, Dimensions, Properties all look equally important.
- **Wide inputs**: every field spans nearly the full width of the panel (`tw-max-w-lg`), creating the classic bootstrap form look.
- **No panel header on the properties side**: the right area is just an anonymous scrollable form.

---

## 3. Proposed Design

### 3.1 Top-level layout (rk-tile-manager)

A single flex row filling the routed viewport.

```
┌────────────────────────────────────────────────────┐
│ Global topbar (35 px)                              │
├───────┬────────────────────────────────────────────┤
│       │                                            │
│ Tile  │      Tile Properties (inspector)          │
│ List  │      - Identity section                     │
│       │      - Sprite/Frames section              │
│       │      - Dimensions section                 │
│       │      - Properties section                 │
│       │                                            │
├───────┴────────────────────────────────────────────┤
│ Global status bar — tile context injected here     │
└────────────────────────────────────────────────────┘
```

#### Column widths

| Region     | Width              | Rationale                                   |
| ---------- | ------------------ | ------------------------------------------- |
| Tile list  | `tw-w-56` (224 px) | Same as scene list for visual coherence.    |
| Properties | `tw-flex-1`        | Claims remaining space; scrolls vertically. |

#### Chrome & borders

- Left panel (tile list): right border `tw-border-r tw-border-border`; background `tw-bg-card-bg`.
- Right panel (properties): no side border (it's the main area); background `tw-bg-background`.
- Canvas/inspector area is a vertical scrollable content area (`tw-overflow-auto`).

### 3.2 Tile List (rk-tile-list)

Same density treatment as the scene list.

**Header row:**

- `tw-flex tw-items-center tw-justify-between tw-px-3 tw-py-2 tw-border-b tw-border-border`
- Left: section label `TILES` in `tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground`
- Right: ghost icon button `add` → create tile (`tw-p-1 tw-rounded-sm hover:tw-bg-muted`)

**List body:**

- `tw-flex-1 tw-overflow-auto tw-px-2 tw-py-2`
- Tile rows: `tw-flex tw-items-center tw-gap-2 tw-px-2 tw-py-1.5 tw-rounded-sm tw-text-xs tw-text-foreground hover:tw-bg-muted tw-transition-colors`
  - Selected row: `tw-bg-primary/10`
  - Trailing delete button: `tw-p-1`
- Keep the `grid_view` icon for each row.

### 3.3 Tile Properties Form (rk-tile-properties) — Redesigned

The form is reorganized into **four sections** separated by horizontal rules (`tw-border-b tw-border-border`). Each section has a small uppercase label. Fields within a section are arranged horizontally where it makes sense.

**Section 1: Identity**

- Label: `IDENTITY` (`tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground tw-mb-2`)
- Name input: full width (it's the primary identifier)
- Type select: inline next to Name, or below — keep it simple, full width is fine for this one
- Animation Speed (if animated): inline right of Type

Simpler decision for density: stack Name and Type horizontally in a 2-column grid when space allows, but for consistency and predictability, keep them stacked but dense.

Actually, let's do a **2-column grid** for short fields:

```
Name            [input full width]
Type [select]   Speed (fps) [input number]
```

Implementation: `tw-grid tw-grid-cols-2 tw-gap-3` for fields that fit side-by-side.

**Section 2: Sprite / Frames**

- Label: `SPRITE`
- For static: a single clickable thumbnail with a label "Click to edit in Sprite Editor"
- For animated: frame count input + horizontal row of frame thumbnails

**Section 3: Dimensions**

- Label: `SIZE`
- Width (tiles) + Height (tiles) side by side, then Apply button
- `tw-grid tw-grid-cols-3 tw-gap-3` where col 1 and 2 are the number inputs, col 3 is the Apply button aligned bottom.

**Section 4: Properties**

- Label: `PROPERTIES`
- Blocking checkbox + Interactable checkbox side by side when room allows
- Action dropdown appears below when Interactable is checked

**Global form changes:**

- Remove `tw-max-w-lg` constraint — let the form breathe to the right edge.
- Reduce label text to `tw-text-[11px]`.
- Reduce input padding to `tw-px-2 tw-py-1.5`.
- Remove all `focus:tw-ring-2 focus:tw-ring-ring` overrides — the global `:focus-visible` rule handles focus.
- Add `tw-bg-card-bg` to the right panel wrapper for visual separation from the list? No, keep `tw-bg-background` — the form sits on the base page color; only panels have `card-bg`.

Actually, to make the form feel like an inspector panel, wrap it in a container with a subtle left border or keep it flush. Decision: keep it flush on `tw-bg-background` with the sections separated by bottom borders. The left edge of the form area is defined by the list's right border.

### 3.4 Status Bar Integration

Tile Manager pushes context to `StatusBarService` via an `effect`.

**When no tile is selected:**

```
{n} tiles
```

Example: `12 tiles`

**When a tile is selected:**

```
{tileName} | {type} | {w}×{h} tiles | {blocking?"Blocking":"Passable"} | {frames} frames
```

Example: `Water | static | 1×1 | Passable | 1 frame`
Example: `Torch | animated | 1×1 | Passable | 4 frames`

Implementation: `TileManagerComponent` injects `StatusBarService` and calls `setContext` inside an `effect` watching `tiles()`, `selectedTile()`, `selectedTileId()`, and `tileSpritesService.sprites()`.

---

## 4. Component Changes

### 4.1 tile-manager.component.ts

**Add:**

- `private readonly statusBar = inject(StatusBarService)`
- `effect` block that builds the context string

```typescript
statusBarEffect = effect(() => {
  const selected = this.selectedTile();
  const count = this.tiles().length;
  if (!selected) {
    this.statusBar.setContext(`${count} tile${count === 1 ? '' : 's'}`);
    return;
  }
  const sprites = this.tileSpritesService.sprites();
  const frameCount = sprites.length;
  const blocking = selected.properties.blocking ? 'Blocking' : 'Passable';
  const size = `${this.currentTiles().w}×${this.currentTiles().h}`;
  this.statusBar.setContext(
    `${selected.name} | ${selected.type} | ${size} tiles | ${blocking} | ${frameCount} frame${frameCount === 1 ? '' : 's'}`,
  );
});
```

**Note:** `currentTiles()` is a private method on `TilePropertiesComponent`, not on `TileManagerComponent`. To get dimensions, we can either:
a. Compute dimensions in the effect using `selected.properties` and `tileSize()`
b. Expose a helper on `TilePropertiesComponent`

Actually, the dimensions are the footprint dimensions stored in the tile's sprite. Since `TileManagerComponent` already loads `tileSize`, we can compute a reasonable display:

```typescript
const ts = this.tileSize();
const sprites = this.tileSpritesService.sprites();
const first = sprites[0];
const w = first ? Math.max(1, Math.round(first.width / ts)) : 1;
const h = first ? Math.max(1, Math.round(first.height / ts)) : 1;
```

But `tileSpritesService.sprites()` is a signal in `TileSpritesService`... wait, looking at the `TilePropertiesComponent`, `tileSprites` is `this.spriteService.sprites`. But `TileManagerComponent` doesn't have direct access to the sprites for the selected tile without querying the service.

Simpler approach: just show `tile.type` and `frameCount` from `tile.spriteIds.length`:

```typescript
statusBarEffect = effect(() => {
  const selected = this.selectedTile();
  const count = this.tiles().length;
  if (!selected) {
    this.statusBar.setContext(`${count} tile${count === 1 ? '' : 's'}`);
    return;
  }
  const frameCount = selected.spriteIds.length;
  const blocking = selected.properties.blocking ? 'Blocking' : 'Passable';
  this.statusBar.setContext(
    `${selected.name} | ${selected.type} | ${blocking} | ${frameCount} frame${frameCount === 1 ? '' : 's'}`,
  );
});
```

This is clean and doesn't require cross-component data access.

### 4.2 tile-manager.component.html

```html
<div class="tw-flex tw-h-full">
  <rk-tile-list
    class="tw-w-56 tw-shrink-0 tw-bg-card-bg tw-border-r tw-border-border"
    [tiles]="tiles()"
    [selectedTileId]="selectedTileId()"
    (tileSelect)="selectTile($event)"
    (tileCreate)="createTile()"
    (tileDelete)="requestDelete($event)"
  />
  <div class="tw-flex-1 tw-overflow-auto tw-p-4 tw-bg-background">
    @if (selectedTile()) {
    <rk-tile-properties
      [tile]="selectedTile()!"
      [projectTileSize]="tileSize()"
      [projectPalette]="palette()"
      (save)="saveTile($event)"
    />
    } @else {
    <div
      class="tw-h-full tw-flex tw-flex-col tw-items-center tw-justify-center tw-text-muted-foreground"
    >
      <span class="material-symbols tw-text-5xl tw-mb-3" aria-hidden="true">grid_view</span>
      <p class="tw-text-sm tw-font-semibold">No tile selected</p>
      <p class="tw-text-xs">Select a tile from the list to edit its properties</p>
    </div>
    }
  </div>
</div>

<rk-confirm-dialog
  #confirmDialog
  [data]="deleteDialogData"
  (confirmed)="deleteTile(tileToDelete()!)"
  (cancelled)="tileToDelete.set(null)"
/>
```

### 4.3 tile-list.component.html

Restyle per §3.2. Keep component API unchanged.

### 4.4 tile-properties.component.html

Full restyle with sections. Key changes:

- Wrap form in a `tw-flex tw-flex-col` with section blocks separated by borders.
- Each section starts with an uppercase label.
- Inputs use `tw-px-2 tw-py-1.5` (not `tw-px-3 tw-py-2`).
- Labels use `tw-text-[11px]`.
- Remove the redundant `focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-ring` classes (global focus handles this).
- Keep `[image-rendering:pixelated]` class on sprite thumbnails.
- Sprite thumbnails stay `tw-w-16 tw-h-16`.

Section layout sketch:

```html
<form [formGroup]="form" class="tw-flex tw-flex-col tw-gap-6">
  <!-- Identity -->
  <div class="tw-flex tw-flex-col tw-gap-3">
    <h4
      class="tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground"
    >
      Identity
    </h4>
    <div class="tw-flex tw-flex-col tw-gap-1">
      <label class="tw-text-[11px] tw-text-muted-foreground">Name</label>
      <input
        ...
        class="tw-px-2 tw-py-1.5 tw-rounded-sm tw-border tw-border-input tw-bg-background tw-text-foreground"
      />
    </div>
    <div class="tw-grid tw-grid-cols-2 tw-gap-3">
      <div class="tw-flex tw-flex-col tw-gap-1">
        <label class="tw-text-[11px] tw-text-muted-foreground">Type</label>
        <select ... />
      </div>
      @if (typeSelected() === 'animated') {
      <div class="tw-flex tw-flex-col tw-gap-1">
        <label class="tw-text-[11px] tw-text-muted-foreground">Speed (fps)</label>
        <input ... />
      </div>
      }
    </div>
  </div>

  <!-- Divider -->
  <div class="tw-border-b tw-border-border"></div>

  <!-- Sprite -->
  <div class="tw-flex tw-flex-col tw-gap-3">
    <h4
      class="tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground"
    >
      Sprite
    </h4>
    <!-- static or animated sprite rendering -->
  </div>

  <!-- Divider -->
  <div class="tw-border-b tw-border-border"></div>

  <!-- Size -->
  <div class="tw-flex tw-flex-col tw-gap-3">
    <h4
      class="tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground"
    >
      Size
    </h4>
    <div class="tw-grid tw-grid-cols-3 tw-gap-3 tw-items-end">
      <!-- width, height, apply button -->
    </div>
  </div>

  <!-- Divider -->
  <div class="tw-border-b tw-block"></div>

  <!-- Properties -->
  <div class="tw-flex tw-flex-col tw-gap-3">
    <h4
      class="tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground"
    >
      Properties
    </h4>
    <!-- blocking, interactable, action dropdown -->
  </div>
</form>
```

---

## 5. Token Usage Reference

| Element           | Background               | Text                                  | Border                         | Notes                      |
| ----------------- | ------------------------ | ------------------------------------- | ------------------------------ | -------------------------- |
| Tile list panel   | `tw-bg-card-bg`          | —                                     | `tw-border-r tw-border-border` | Right border only          |
| Tile list header  | same as panel            | `tw-text-muted-foreground`            | `tw-border-b tw-border-border` |                            |
| Tile row hover    | `hover:tw-bg-muted`      | `tw-text-foreground`                  | —                              |                            |
| Tile row selected | `tw-bg-primary/10`       | `tw-text-foreground`                  | —                              |                            |
| Properties area   | `tw-bg-background`       | —                                     | —                              | Base page color            |
| Section label     | —                        | `tw-text-muted-foreground`            | —                              | 11px uppercase             |
| Input             | `tw-bg-background`       | `tw-text-foreground`                  | `tw-border-input`              |                            |
| Sprite thumbnail  | —                        | —                                     | `tw-border-border`             | hover: `tw-border-accent`  |
| Status bar        | `tw-bg-primary` (global) | `tw-text-primary-foreground` (global) | —                              | Set via `StatusBarService` |

---

## 6. Accessibility & Interactions

- Keyboard operability on tile rows and form inputs.
- Focus rings remain visible (global rule).
- All Material Symbols have `aria-hidden="true"`.
- The empty state uses `aria-hidden="true"` on the decorative icon.

---

## 7. Testing Impact

- Update `tile-list.component.spec.ts` DOM assertions for changed classes.
- Add a test in `tile-manager.component.spec.ts` verifying `StatusBarService.setContext` is called correctly.
- `tile-properties.component.spec.ts` may need selector updates if the DOM structure changes significantly.

---

## 8. Out of Scope

- **Sprite editor integration**: the "Click to edit" behavior stays the same.
- **Animated preview**: no inline animation preview; thumbnails only.
- **Drag-and-drop reordering of frames**: not part of this visual pass.

---

## 9. Acceptance Criteria

1. Tile manager renders with compact left panel (`tw-w-56`) and no horizontal scroll.
2. Tile list header shows "TILES" in uppercase tracking-wider style.
3. Form fields are grouped into sections (Identity, Sprite, Size, Properties) with visible labels.
4. No `tw-max-w-lg` constraint on the form — it fills the right area.
5. Status bar shows tile count when no selection, and name/type/blocking/frames when selected.
6. Both light and dark themes verified.
7. All existing tests pass after DOM assertion updates.
