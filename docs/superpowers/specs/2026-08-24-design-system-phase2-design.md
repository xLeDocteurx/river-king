# Design System Phase 2 — Existing Screens — Design

Date: 2026-08-24
Branch: executed directly on `main` (repo precedent; user approved merge of prior branch)
Status: Approved-by-delegation ("Go tu n'as pas besoin de moi pour tout ca. Avance !!!")

## Context

The design system docs (docs/design-system/) are shipped. The dashboard was restyled as their reference, but several shared components and feature templates still carry off-token patterns found by audit:

1. **toast** (`shared/components/toast/toast.component.html`): raw palette colors (`bg-green-600`, `bg-blue-600`, `bg-yellow-600`), white text/border hacks, `tw-rounded-md`, `tw-shadow-lg`, `hover:tw-bg-white/20`.
2. **dialog** (`shared/components/dialog/dialog.component.scss`): `.rk-dialog` uses `tw-shadow-xl` (design system forbids blurred shadows).
3. **searchable-select**: `tw-rounded-md` ×2, listbox `tw-shadow-md`.
4. **confirm-dialog**: `tw-rounded-md` ×2; destructive button uses raw `tw-text-white`.
5. **scene-list.component.scss**: `.cdk-drag-preview` has a hardcoded rgba box-shadow and `border-radius: 0.375rem`.
6. **Legacy radii sweep**: `tw-rounded-md` remains in project-sidebar (3×), scene-list html (6×), tile-palette (1×), sprite-editor shell (1×), drawing-tools (3×), tile-list (2×), tile-properties (7×).

## Decisions

### D1 — Toast restyle (token-bound, VS Code notification spirit)

Container per message: `tw-flex tw-items-start tw-gap-3 tw-min-w-[20rem] tw-max-w-[24rem] tw-rounded-sm tw-border tw-border-border tw-bg-card-bg tw-text-card-fg tw-px-4 tw-py-3` — no shadow. A 2px left edge carries the type color:

| Type    | Left edge / icon                                            |
| ------- | ----------------------------------------------------------- |
| success | `tw-border-l-primary` / `tw-text-primary`                   |
| error   | `tw-border-l-destructive` / `tw-text-destructive`           |
| info    | `tw-border-l-accent` / `tw-text-accent`                     |
| warning | `tw-border-l-muted-foreground` / `tw-text-muted-foreground` |

Static base gets `tw-border-l-2`; conditional classes above override the left side only. Dismiss button: `hover:tw-bg-muted`, icon inherits card-fg. No new tokens needed.

### D2 — `--color-destructive-foreground` token

Add `--color-destructive-foreground: #ffffff;` to both blocks in `src/styles/theme.scss` and map `'destructive-foreground': 'var(--color-destructive-foreground)'` in tailwind.config.js. Confirm-dialog's destructive button switches `tw-text-white` → `tw-text-destructive-foreground`.

### D3 — Shadow removals

Drop `tw-shadow-xl` from `.rk-dialog`, `tw-shadow-md` from the searchable-select listbox, `tw-shadow-lg` from toast (covered by D1). Borders already provide separation on every one of them.

### D4 — Radius normalization

All remaining `tw-rounded-md` → `tw-rounded-sm` in: searchable-select (2×), confirm-dialog (2×), and the seven feature templates listed above. No `rounded-full/lg/xl` exists anywhere.

### D5 — Scene-list drag preview

`.cdk-drag-preview`: replace the rgba box-shadow with `outline: 1px solid var(--border);` (layout-neutral separation) and set `border-radius: 0.125rem;`.

## Testing

- Toast spec: assert container classes (card-bg, rounded-sm) and that an error message yields `tw-border-l-destructive` while success yields `tw-border-l-primary`; existing behavior tests keep passing.
- Confirm-dialog/searchable-select specs unaffected except radius-class assertions if any exist (update to rounded-sm).
- Full suite green; prettier clean.

## Out of scope

- New screens or features; layout changes; toast positioning/animation rework.
