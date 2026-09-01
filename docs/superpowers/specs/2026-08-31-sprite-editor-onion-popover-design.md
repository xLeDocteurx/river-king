# Sprite Editor: Onion Skin Controls Behind a Floating Button + Popover

Date: 2026-08-31
Status: Draft
Linked issue: #41

## Problem

The sprite editor renders the onion-skin controls (prev/next toggles + two opacity
sliders) as an inline row that appears above the canvas whenever the selected tile is
animated with more than one frame
(`sprite-editor.component.html:40-92`). On a small canvas area this row occupies
significant vertical space and is always visible, even when the user is not adjusting
onion settings.

## Solution

Replace the inline Onion row with a single compact floating button (same geometry and
styling as the grid visibility button now rendered on the pixel canvas). Clicking the
button toggles a small floating popover panel anchored to it that holds the existing
controls. The panel is non-modal and closes on outside click, Escape, button re-click,
or tile/frame switch. Onion-skin rendering on the canvas is unchanged — only the
control placement changes.

The grid toggle (issue #40 / PR #42) is the direct visual precedent: a Material Symbol
floating button over the canvas.

## Design decisions (finalized 2026-08-31)

- **Control location:** the onion button floats over the pixel canvas in the sprite
  editor, at the **bottom-left** corner of the canvas (`tw-absolute tw-bottom-1
tw-left-1`). The grid toggle occupies the top-right corner, so the two never
  overlap.
- **Panel placement:** the popover opens **above** the button (`tw-absolute
tw-bottom-9 tw-left-0`), since the button sits at the bottom of the canvas.
- **Non-modal popover:** uses the floating-panel styling precedent from
  `rk-searchable-select` (`searchable-select.component.html:25`:
  `tw-absolute tw-z-10 tw-border tw-border-border tw-bg-background tw-rounded-sm`).
  Native `<dialog>` is intentionally **not** used (it is modal; the panel is
  lightweight and non-modal).
- **Panel contents:** the exact controls that existed in the inline row — prev toggle
  (`skip_previous`) + its opacity slider, next toggle (`skip_next`) + its opacity
  slider, reusing the existing `onionSkinPrevEnabled/NextEnabled` and
  `onionSkinPrevOpacity/NextOpacity` signals. No new state for the onion values
  themselves.
- **Button visibility:** the button shows only when onion skinning is available —
  `currentTile()?.type === 'animated' && currentFrames().length > 1` (the same
  condition that gated the old row).
- **Close behavior:**
  - **Outside click** — a document-level click listener closes the panel when the
    click lands outside both the button and the panel.
  - **Escape** — a document-level `keydown.escape` listener closes the panel.
  - **Button re-click** — clicking the floating button toggles the panel.
  - **Tile/frame switch** — `selectSprite` and `selectTile` reset the panel to closed.

## Architecture

### Sprite editor component (`sprite-editor.component.ts`)

Add a small amount of UI state — the open state of the panel — plus close-on-outside
listeners. No change to onion value state or to what is passed to the canvas.

- New signal: `readonly onionPanelOpen = signal(false);`
- New method `toggleOnionPanel(): void` — flips `onionPanelOpen`.
- New method `closeOnionPanel(): void` — sets it `false`.
- `@HostListener('document:click', ['$event'])` handler `onDocumentClick(...)` — closes
  the panel when the click target is outside the wrapper element (button + panel). Uses
  a `@ViewChild` reference to the wrapper `<div>`.
- `@HostListener('document:keydown.escape')` handler `onEscape()` — calls
  `closeOnionPanel()`.
- Close on switch: `selectSprite` and `selectTile` call `onionPanelOpen.set(false)`.

### Template (`sprite-editor.component.html`)

- Wrap the existing `<rk-pixel-canvas>` in `<div class="tw-relative" #onionAnchor>`.
- Inside that wrapper, when onion is available, add the floating toggle button
  (bottom-left) and the popover panel (opened above it when `onionPanelOpen()`).
- Move the prev/next toggle buttons + conditional opacity sliders verbatim from the old
  row into the panel.
- Remove the old inline Onion row (`sprite-editor.component.html:40-92`).

## UI·UX details

- **Floating button** — mirrors the grid button: `tw-absolute` + Material Symbol icon
  `style` (e.g. `layer` / `invert_colors`), 6x6 (w-6 h-6)
  `tw-rounded-sm tw-bg-card-bg tw-border tw-border-border tw-text-foreground
tw-cursor-pointer hover:tw-bg-accent`, `[title]` tooltip and `[attr.aria-label]`.
- **Popover panel** — `tw-absolute tw-z-10 tw-rounded-sm tw-border tw-border-border
tw-bg-background tw-shadow` with the prev/next buttons and sliders laid out as in the
  old row.
- All styling uses design-system tokens (`tw-*` prefix); no hardcoded colors.

## Data model changes

None. This is purely presentational — the onion state signals already exist and are
consumed unchanged by the pixel canvas.

## Testing

- Component test: when the selected tile is animated with `>1` frame, the floating
  button is rendered and the old inline Onion row/controls are **not** present.
- Component test: clicking the floating button toggles the panel open/closed.
- Component test: clicking outside the wrapper closes an open panel; pressing Escape
  closes it.
- Component test: switching tile or frame closes an open panel.
- Component test: prev/next toggles and opacity sliders inside the panel still flip the
  existing `onionSkin*` signals (behavior preserved from the old row).
- Element/DOM dispatch for outside-click in jsdom: dispatch a `click` event on
  `document.body` and assert the panel signal is closed.

## Performance considerations

Negligible. The panel only renders the controls (same count as before) when open; the
canvas receives identical inputs regardless of panel state. The document-level
listeners are cheap and attached only while the component is alive (`@HostListener`
is torn down automatically with the component).

## Out of scope

- Changing onion-skin rendering behavior on the canvas (unchanged by this issue).
- Adding onion controls anywhere else (e.g. the frame strip).
- Persisting popover open/closed state or onion toggle state across sessions (neither
  is requested; the values reset each editor load as today).
