# Tile Properties Form Redesign

Date: 2026-08-27
Status: Approved (visual companion validated)

## Problem

The current `tile-properties.component` form stacks all fields vertically with
repeated horizontal dividers (`tw-border-b`), creating too much visual noise
and excessive vertical space. Sprite frames, type/speed, size, and properties
depend on each other (frames hidden when static, fps hidden when static) yet
are spread across four separate bordered groups.

## Goals

- Remove unneeded section dividers; unify related fields into single header row
- Make the frame strip a first-class inline component instead of a isolated group
- Surface size & properties as compact inline controls instead of checkboxes
- Keep 100 % of existing logic (auto-save, type change, frame count/size dialogs)

## Design

### Layout (single column, no horizontal dividers)

Replace the four bordered groups with a unified stack of 4 inline rows:

1. **Identity row** (3 fields on one line):
   ```
   ┌────────────────┐ ┌────────┐ ┌────────┐
   │ Name           │ │ Type   │ │ FPS    │
   └────────────────┘ └────────┘ └────────┘
   ```
   - Name: flex-1 input
   - Type: select (static/animated), ~100 px
   - FPS: number input, ~80 px — hidden when type is `static` via `@if`

2. **Sprite card** (compact card, replaces the old "Sprite" group):
   - Card header (single row, aligned): on the left a label showing the current
     frame count (`Frames (4)`); on the right only the Play/Pause button (when
     animated) — no separate "Frames" number input above the strip
   - Inline frame strip with smaller thumbnails (~40 px) and a circular
     "+ Add" button at the end (spawns frames via the existing
     `onFrameCountInput` logic; currently the user edits a number input).
     **Decision:** keep the number input inside the card header so the count
     stays editable; the strip is read-only thumbnail navigation (click opens
     the sprite editor in focus mode). Add frame count input in header.
   - For type `static`: strip is still shown but only frame 1, play hidden.

3. **Size row** (3 fields on one line):
   ```
   ┌────────┐ ┌────────┐ ┌──────────────────┐
   │ Width  │ │ Height │ │ 16 x 16 px hint  │
   └────────┘ └────────┘ └──────────────────┘
   ```
   - Width / Height: number inputs (tile units, same as today)
   - Hint: auto-computed `currentTiles().w * projectTileSize` pixel hint

4. **Properties row** (badges, replaces checkboxes):
   ```
   Flags: [ Blocking ] [ Interactable → door_open ] [×]
   ```
   - Each badge is a toggle button: when OFF it is barely visible (muted
     border + text); when ON it gets `primary` background/text and an
     optional "×" to clear interactable.
   - Clicking `Blocking` toggles the reactive form `properties.blocking`.
   - Clicking `Interactable` toggles `interactableChecked()`; when it turns ON
     and no action is set, auto-focus or open the `rk-searchable-select`
     underneath.
   - The action badge, when set, shows `→ <actionId>`.
   - `rk-searchable-select` stays directly underneath, shown only when
     `interactableChecked()`.

### Specific field changes

| Old | New | Logic change |
|---|---|---|
| Sprite group with count input above strip | Compact card: header line (label + play + count) + strip + add button | Same `tileSprites()` / `onFrameCountInput` / frames dialog; Play button visibility linked to `typeSelected() === 'animated'` |
| Size in its own bordered group | Inline row with width + height + pixel hint | Same `widthTiles`/`heightTiles` signals & `onSizeInput` / size dialog |
| Properties group with checkboxes + select below | Inline badge row + select below | New badge toggle methods wrapping existing signals / form controls |
| 4 `div.tw-border-b` dividers | None | Removed entirely |

### Accessibility

- All inputs keep their `name`, `aria-label`, and keyboard operability.
- Badge toggle buttons must have `type="button"` and `[aria-pressed]="..."`.
- Keep `tabindex="0"` and Enter/Space for any custom surface.

### Responsive

- The panel width is fixed (`tw-w-72` or similar from the parent tile manager
  layout), so all rows are single-line within that width. No extra breakpoint
  logic needed.

## Files changed

- `src/app/features/tile-manager/properties/tile-properties.component.html` — fully rewritten layout
- `src/app/features/tile-manager/properties/tile-properties.component.scss` — new badge styles, sprite card background
- `src/app/features/tile-manager/properties/tile-properties.component.ts` — add `toggleBlocking()` and
  `toggleInteractable()` helpers; keep everything else unchanged

## Out of scope

- No change to auto-save logic, dialogs, or service calls.
- No change to parent (`tile-manager.component`) or routing.

## Testing

- Update existing `tile-properties.component.spec.ts` assertions to expect the
  new HTML structure (badge buttons instead of raw checkboxes, card instead of
  flattened groups).
- Verify `save` emission still fires on form changes and signal toggles.
