# Layout

## Vertical screen structure

Every screen lives inside the root shell (`app.component.html`) and composes three stacked
regions:

1. **Topbar** — 35px tall, rendered once by the root. Background `muted`, bottom 1px border.
   - Left: brand — 10px `accent` square (`tw-block tw-w-2.5 tw-h-2.5 tw-bg-accent`) +
     "River King Engine" in `tw-text-sm tw-font-semibold`, linking to `/`.
   - Project routes additionally render editor tabs (Scenes / Tiles / Sprites): plain 12px
     medium text (`tw-text-xs tw-font-medium`); active = `tw-text-foreground` + 1px `accent`
     bottom border; inactive = `tw-text-muted-foreground`, hover → foreground.
   - Right: ghost theme-toggle icon button (recipe in `components.md`).

2. **Content** — the scrollable area; the routed screen owns it entirely.

3. **Status bar** — **app-wide pattern**, present on every screen:
   - Anatomy: `tw-h-[22px]`, background `tw-bg-primary`, text `tw-text-primary-foreground`,
     `tw-text-[11px]`, padding `tw-px-3`, flex row with `tw-items-center tw-justify-between`.
   - Left slot: contextual info for the current screen (e.g. `{n} projects` on the dashboard,
     scene dimensions in the scene editor).
   - Right slot: always the literal text `River King Engine`.
   - Reference implementation: the dashboard's fixed footer. Until a shared component replaces
     it (phase 2 decision), each screen renders its own markup with this anatomy.

## Page header (non-workspace pages)

A single top row: section label on the left, primary action on the right.
Container: `tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-3`.
(Reference: dashboard header.)

## Editor workspace target anatomy (new pattern)

Workspace screens (tile-manager, scene-editor, sprite-editor) converge toward a three-column
body between topbar and status bar:

```
┌────────────────────────────────────────────────┐
│ Topbar (global)                                │
├───────────┬──────────────────────┬─────────────┤
│ Sidebar   │ Canvas / work area   │ Properties  │
│ list      │                      │ panel       │
├───────────┴──────────────────────┴─────────────┤
│ Status bar (contextual left info)              │
└────────────────────────────────────────────────┘
```

- Columns are separated by 1px `tw-border-border` verticals and scroll independently.
- **Sidebar list:** header = section label; items follow the selectable list item recipe
  (`components.md`); optional trailing action = dashed action row recipe.
- **Canvas:** content centered on `background`; an optional toolbar sits directly above as a
  single row of ghost icon buttons, separated from the canvas by a 1px bottom border.
- **Properties panel:** right column following the properties panel recipe (`components.md`).

## Grids

Responsive card grids:
`tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-3`.
