# Sprite Editor: Grid Visibility Toggle

Date: 2026-08-31
Status: Draft
Linked issue: #40

## Problem

The sprite editor's pixel canvas always draws a grid over the painted pixels. For
larger sprites, or when inspecting a finished piece of art, the grid lines add
visual noise and make it hard to judge the raw pixels. There is currently no way
to hide the grid while editing.

The grid-drawing logic already exists in `pixel-canvas.component.ts`
(render pass, "Draw grid LAST so it stays visible over painted pixels", guarded
by the moiré threshold `zoom * scale >= 8`), so only a visibility control and an
off switch are missing.

## Solution

Add a floating grid toggle button over the sprite pixel canvas that shows/hides
the grid. The grid still draws last (on top of pixels/onion skins) but is skipped
entirely when hidden. The toggle state is persisted for the current browser
session.

This mirrors the **scene editor grid visibility toggle** as a direct precedent
(`map-canvas.component.ts`): a Material Symbol button flipping a `showGrid`
signal persisted via `sessionStorage`.

## Design decisions (finalized 2026-08-31)

- **Location:** floating button overlaid on the top-right corner of the pixel
  canvas (outside the canvas element itself), because the canvas is a full-bleed
  `<canvas>` and the button should not be clipped/interact with drawing.
- **Persistence:** `sessionStorage`, mirroring the scene editor. Session-scoped
  and project-independent.
- **Default:** **ON**, preserving the current always-on behavior for existing
  users; the toggle lets them turn it off.
- **Signal ownership:** the `showGrid` signal lives on `PixelCanvasComponent`
  (it already owns grid rendering), unlike the scene editor where the toggle
  lives on the map canvas too. The floating button can live either in the
  component's own template or be driven by the parent; keeping it in
  `pixel-canvas.component.html` keeps the overlay co-located with the canvas it
  controls.

## Architecture

### PixelCanvasComponent changes

- New export `GRID_VISIBLE_STORAGE_KEY = 'rk-sprite-editor.show-grid'` (in
  `pixel-canvas.component.ts`) to avoid clashing with the scene editor key.
- New signal `showGrid = signal(readGridVisibility())`, persisted via an `effect`
  writing `sessionStorage.setItem(KEY, showGrid() ? '1' : '0')`, exactly as
  `map-canvas.component.ts:67,134-136,144-146`.
- `render()`: wrap the grid pass in `if (this.showGrid() && zoom * scale >= 8)`.
- Template/SCSS: a floating toggle button absolutely positioned over the canvas.

### Floating button placement

The pixel canvas is used inside `sprite-editor.component.html` as `<rk-pixel-canvas>`
(L93-106). The button should be a sibling overlay positioned over the canvas, not
inside the `<canvas>` element.

Two options:

1. Add the button inside `pixel-canvas.component.html` wrapped in a relative
   container together with the canvas.
2. Add the button in `sprite-editor.component.html`, floating over the
   `<rk-pixel-canvas>`, toggling `pixelCanvasRef()?.showGrid`.

Option 1 keeps grid state + its control co-located in one self-contained
component (consistent with how the map canvas owns both state and control is a
close analog, though the scene-editor's button lives in the parent). Decide at
implementation; Option 1 is preferred for cohesion.

## UI·UX details

- Floating icon button, top-right, matching the scene editor grid button styling:
  `tw-absolute tw-top-1 tw-right-1 tw-z-10 tw-flex tw-items-center tw-justify-center tw-w-6 tw-h-6 tw-rounded-sm tw-bg-card-bg tw-border tw-border-border tw-text-foreground tw-cursor-pointer hover:tw-bg-accent`.
- Icon: Material Symbol `grid_on` / `grid_off`, `title` "Hide grid" / "Show grid".
- Active/hover states + `tw-cursor-pointer` per design system. Never remove the
  focus ring.
- Positioned so it does not overlap interactive drawing (top-right corner, small,
  opaque with border so it reads as a control, not part of the art).

## Data model changes

None. No schema/model change.

## Testing

- Component test on `PixelCanvasComponent`: with `showGrid` enabled, grid is
  drawn; with it disabled, no grid is drawn (assert via stored flag / render
  behavior).
- Persistence test: toggling sets the `sessionStorage` key; initial load reads it
  (mirror existing map-canvas grid tests, `map-canvas.component.spec.ts:183-200`).
- Button interaction test: clicking the floating button flips `showGrid` and
  updates the key.
- Manual: overlay respects hidden-grid state; onion skins and pixels still
  render; grid reappears after toggle; state survives a reload within the
  session.

## Performance considerations

When hidden, the grid pass is skipped entirely (zero work). When visible,
behavior is unchanged from today. The moiré threshold (`zoom * scale >= 8`)
still applies to avoid line artifacts when zoomed out.

## Out of scope

- Persisting per project (session only, per decision).
- Changing the grid's color, thickness, or the moiré threshold.
- Grid visibility for the scene editor (already exists).
