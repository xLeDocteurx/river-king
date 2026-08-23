# Components

Normative recipes. Class strings are copied verbatim from the reference implementation; do
not "improve" them without updating this file in the same change. Recipes tagged
**(new pattern)** define upcoming conventions not yet implemented anywhere.

## Primary button

Main action of a view — exactly one per view. (Reference: dashboard "+ New Project".)

```
tw-flex tw-items-center tw-gap-1.5 tw-px-3 tw-py-1.5 tw-rounded-sm tw-bg-primary tw-text-primary-foreground tw-text-xs tw-transition hover:tw-opacity-90
```

May carry a leading Material Symbol (`add`, …) sized `tw-text-sm`. Don't use `primary` fill
for anything else (status bar excepted).

## Outline button

Secondary/cancel action, typically in dialogs. (Reference: create-dialog "Cancel".)

```
tw-px-4 tw-py-2 tw-rounded-sm tw-border tw-border-border tw-bg-background tw-text-foreground hover:tw-bg-muted
```

Within one view, match the padding of the primary button it accompanies.

## Ghost icon button

Low-emphasis toolbar/header action. (Reference: topbar theme toggle.)

```
tw-inline-flex tw-items-center tw-justify-center tw-p-1.5 tw-rounded-sm tw-text-muted-foreground hover:tw-text-foreground hover:tw-bg-card-bg tw-transition
```

Icon inside sized `tw-text-base`. Always provide `aria-label`.

## Destructive icon button

Delete affordance revealed on parent hover. Requires the parent to carry `tw-group`.
(Reference: project-card trash.)

```
tw-p-1 tw-rounded-sm tw-opacity-0 group-hover:tw-opacity-100 focus-visible:tw-opacity-100 tw-text-destructive hover:tw-bg-destructive/10 tw-transition
```

Must stop propagation of click and keyboard events (parent is interactive — see
`interactions.md`).

## Dashed action row

Inline creation affordance appended to grids/lists. Label format: `+ Action name…`
(Reference: dashboard "+ New Project…".)

```
tw-border tw-border-dashed tw-border-border tw-rounded-sm tw-p-4 tw-text-xs tw-text-muted-foreground hover:tw-border-accent hover:tw-text-accent tw-transition
```

## Clickable card

Whole-surface navigation card. (Reference: project card.)

Container:

```
tw-group tw-relative tw-p-3 tw-rounded-sm tw-border tw-border-border tw-bg-card-bg tw-cursor-pointer tw-transition hover:tw-border-accent
```

Anatomy top-to-bottom: title (`tw-text-sm tw-font-semibold tw-text-foreground`), optional
destructive icon button absolutely positioned top-right, meta line
(`tw-text-[11px] tw-leading-relaxed tw-text-muted-foreground`), then free content rows.
The whole card is interactive: `role="button"` `tabindex="0"` `(keydown.enter)`
`(keydown.space)`.

## Selectable list item (**new pattern**)

Row in sidebar lists (tiles, sprites, scenes). Selected state: `muted` fill + medium-weight
`foreground` text (the fill also appears on hover — persistence plus weight marks selection).

Base + hover:

```
tw-flex tw-items-center tw-gap-2 tw-px-2 tw-py-1.5 tw-rounded-sm tw-cursor-pointer tw-text-foreground tw-transition hover:tw-bg-muted
```

Selected (added): `tw-bg-muted tw-font-medium`

Keyboard-selectable: `tabindex="0"` + Enter/Space. Single-select per list.

## Properties panel (**new pattern**)

Right column of editor workspaces (~260px): container
`tw-w-[260px] tw-bg-card-bg tw-border-l tw-border-border tw-p-3`, independently scrollable.
Header = section label. Fields stack vertically (`tw-flex tw-flex-col tw-gap-4`), each field
is `tw-flex tw-flex-col tw-gap-1` with a `tw-text-xs tw-font-medium` label above an input.

## Input

Form fields everywhere. (Reference: create-dialog name input.)

```
tw-px-3 tw-py-2 tw-rounded-sm tw-border tw-border-input tw-bg-background tw-text-foreground
```

## Dialog

Native `<dialog>` only, always through `<rk-dialog>` (focus trap, Escape, backdrop). Sheet
styling ships with the `.rk-dialog` class: `rounded-sm`, `border`, `background`,
`max-w-lg`, `backdrop black/50`. Content wrapper inside: `tw-p-6`; title
`tw-text-xl tw-font-bold tw-mb-4`; form stack `tw-flex tw-flex-col tw-gap-4`.

Actions row (right-aligned):

```
tw-flex tw-justify-end tw-gap-2
```

Cancel = outline button; confirm = primary button. When the dialog deletes data, the confirm
button swaps to destructive: `tw-px-4 tw-py-2 tw-rounded-sm tw-bg-destructive tw-text-white hover:tw-opacity-90`.

## Empty state

Compact, single call to action. (Reference: dashboard no-projects block.)

- Container: `tw-flex tw-flex-col tw-items-center tw-justify-center tw-py-20 tw-text-muted-foreground`
- Icon: Material Symbol, `tw-text-5xl tw-mb-3`
- Title: `tw-text-sm tw-font-semibold`; subtitle: `tw-text-xs`
- CTA: dashed action row with `tw-mt-4`

## Status bar

See `layout.md` — anatomy is normative; every screen renders it.
