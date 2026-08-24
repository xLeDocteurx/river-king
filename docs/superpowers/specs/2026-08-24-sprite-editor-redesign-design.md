# Sprite Editor Redesign — Design Spec

**Date:** 2026-08-24
**Approach:** Dense three-column workspace, coherent with Scene Editor redesign.
**Scope:** Visual/layout restyling + status bar context. No new capabilities.

---

## Goals

- Same density/identity rules as Scene Editor and Tile Manager (`w-56` panels, uppercase section labels).
- Remove redundant `h2` title above the canvas — the list highlight identifies the sprite.
- Status bar shows contextual info (sprite count, or name/dimensions/tool/color).

## Layout

```
┌──────────┬──────────────────────────────┬─────────┐
│ SPRITES  │  Canvas (flex-1, centered)    │ PALETTE │
│ (w-56)   │  no h2 title                  │ TOOLS   │
│ grouped  │  empty state: icon + text     │ (w-52)  │
│ by tile  │                               │         │
└──────────┴──────────────────────────────┴─────────┘
```

- Left list: `tw-w-56`, header `SPRITES` (uppercase, `text-xs font-semibold tracking-wider text-muted-foreground`), rows `tw-px-2 tw-py-1.5 tw-text-xs`. Keep tile group collapsible headers and NO create button (sprites are created via Tile Manager).
- Center: remove `<h2>`; empty state uses `image` Material Symbol icon + "No sprite selected" + hint.
- Right panel: `tw-w-52`; two sections labeled `PALETTE` and `TOOLS`.

## Sub-components

**PaletteManager:** drop `h3`, render label `PALETTE` (11px uppercase). Cells `tw-w-7 tw-h-7`, keep ring for selection.

**DrawingTools:** drop `h3`, label `TOOLS`. Buttons `tw-p-1.5`; selected state adds `tw-border-primary` (keep `tw-bg-primary/10`).

## Status Bar (StatusBarService)

Effect in `SpriteEditorComponent`:

- No sprite selected: `{n} sprite{s}` (e.g. `12 sprites`).
- Sprite selected: `{name} | {w}×{h} px | {Tool} | Color #{index+1}` (e.g. `frame 1 | 16×16 px | Brush | Color #3`). Tool name capitalized.

## Testing

- Update DOM assertions affected by restyle.
- Add status-bar context tests (spy on `setContext`; remember `fixture.detectChanges()` after async selections).

## Out of scope

- Inline animation preview, frame reordering, new drawing tools.
