# Onion Skin for Sprite Editor

Date: 2026-08-27
Status: Draft

## Problem

When animating sprites in the pixel editor, artists need to see adjacent frames
(previous and/or next) as reference while drawing the current frame. Without
this, matching motion timing, limb positions, and silhouette continuity between
frames is guesswork. Professional pixel-art tools (Aseprite, PyxelEdit) provide
"onion skin" — ghosted renderings of neighbouring frames at reduced opacity.

## Solution

Extend the sprite-editor's `pixel-canvas.component` to optionally render up to
two additional sprite layers behind or in front of the active sprite:

- **Previous frame onion skin** — the frame immediately before the current one
  in the animation sequence, rendered at configurable opacity.
- **Next frame onion skin** — the frame immediately after the current one,
  rendered at configurable opacity.

Each onion-skin layer is independently togglable and has its own opacity
control. The current (editable) sprite is always rendered at full opacity on top
(above previous, below next if next is enabled).

## Architecture

### `pixel-canvas.component.ts`

Two new `@Input` signals:

```ts
/** Pixel data URI of the previous frame for onion-skin reference, or null. */
onionSkinPrev = input<string | null>(null);
/** Pixel data URI of the next frame for onion-skin reference, or null. */
onionSkinNext = input<string | null>(null);
```

Two new `@Input` signals for opacity (0–1):

```ts
/** Opacity of the previous-frame onion skin (0 = invisible, 1 = fully opaque). */
onionSkinPrevOpacity = input<number>(0.35);
/** Opacity of the next-frame onion skin (0 = invisible, 1 = fully opaque). */
onionSkinNextOpacity = input<number>(0.35);
```

The component already caches decoded `HTMLImageElement` objects in
`loadedImages()`. Onion-skin URIs are decoded the same way (async, guarded by a
cache-version sentinel) and stored in a parallel cache that does **not** collide
with the editable sprite cache.

Rendering order in `render()`:

1. Clear canvas.
2. Draw **previous** onion skin (if present) at `onionSkinPrevOpacity`.
3. Draw **current** editable sprite at full opacity.
4. Draw **next** onion skin (if present) at `onionSkinNextOpacity`.
5. Draw grid, guides, cursor preview.

The editable layer is always sandwiched between previous (behind) and next
(in front) so the artist can see both temporal directions while editing the
present frame.

### `sprite-editor.component.ts`

The parent computes the adjacent frames from `currentFrames()`:

```ts
readonly onionSkinPrevData = computed(() => {
  const frames = this.currentFrames();
  const idx = this.previewFrameIndex();
  const prev = frames[idx - 1];
  return prev?.pixelData ?? null;
});

readonly onionSkinNextData = computed(() => {
  const frames = this.currentFrames();
  const idx = this.previewFrameIndex();
  const next = frames[idx + 1];
  return next?.pixelData ?? null;
});
```

Two new signals for UI state:

```ts
readonly onionSkinPrevEnabled = signal(false);
readonly onionSkinNextEnabled = signal(false);
readonly onionSkinPrevOpacity = signal(0.35);
readonly onionSkinNextOpacity = signal(0.35);
```

These are NOT persisted to the database — they are transient editor preferences.
(If we later want persistence, we add them to `SessionService`.)

### Sprite-editor toolbar

A new compact toolbar section above the pixel canvas (or integrated into the
existing mini-toolbar) with:

- Two toggle buttons: « Previous | Next » (Material Symbols: `skip_previous` /
  `skip_next`).
- Two small opacity sliders (range inputs, 0–100%) shown when the matching
toggle is active.
- A keyboard shortcut — `O` toggles previous, `P` toggles next (optional,
  out-of-scope for first pass).

The toolbar only appears when `currentTile()?.type === 'animated'` and
`currentFrames().length > 1`.

## UI / UX details

- **Disabled states**: If there is no previous frame (e.g. frame 0), the Previous
  button is disabled. If there is no next frame (last frame), Next is disabled.
- **Defaults**: Previous ON at 35 % opacity, Next OFF. This matches industry
  convention (artists mainly need the previous frame as reference).
- **Visual style**: The canvas background becomes slightly tinted (not plain
  `#1a1a2e`) when onion skin is active so the ghost frames read clearly against
  a mid-tone.

## Data model changes

None. No DB migration. Onion-skin state is purely runtime.

## Testing

### `pixel-canvas.component.spec.ts`

- When `onionSkinPrev` is set, the canvas draws the previous image at the
  configured opacity (assert via canvas pixel sampling or mock `drawImage` spy).
- When `onionSkinNext` is set, the canvas draws the next image.
- When both are set, render order is prev → current → next.
- When opacity is 0, `drawImage` is NOT called for that layer.
- Changing opacity triggers re-render.

### `sprite-editor.component.spec.ts`

- `onionSkinPrevData` computed returns correct `pixelData` for frame N‑1.
- `onionSkinNextData` computed returns correct `pixelData` for frame N+1.
- Prev button disabled when `previewFrameIndex() === 0`.
- Next button disabled when `previewFrameIndex() === last`.

## Performance considerations

- Onion-skin images are decoded once and cached per-URI. Switching between
  frames reuses the cache (the same URIs appear repeatedly during animation
  playback).
- The canvas render loop already runs on every brush stroke; adding two extra
 `drawImage` calls per frame is negligible for 16×16 to 64×64 sprites.

## Out of scope

- Onion skin in the **scene editor** (map canvas showing other layers as ghost).
- Keyboard shortcuts for toggling onion skin.
- More than one previous/next frame (e.g. frames N‑2, N+2).
- Colour-tinted onion skin (e.g. prev = red-tint, next = blue-tint).
- Persistence of onion-skin toggles/state across sessions.