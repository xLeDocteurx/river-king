# Dashboard Redesign — "Pro Editor" Visual Identity (Style B)

**Date:** 2026-08-23
**Status:** Approved design (sections validated with user)
**Scope:** Phase 1 — design tokens, global conventions, topbar, dashboard page

---

## 1. Goal

Give the application a distinctive visual identity — **"Éditeur Pro"** (Aseprite / VS Code spirit) — chosen by the user among three mockup directions. The motivation is **purely visual**: character and identity, not new features.

The redesign is propagated through the existing token system rather than per-screen restyling, so the whole app inherits the new look automatically while the dashboard + topbar serve as the reference showcase.

## 2. Non-negotiable constraints

- **All UI copy is English only.** No French labels anywhere in the interface. This rule is absolute.
- Angular 22 standalone components, `OnPush`, signals; Tailwind prefix `tw-`; native `<dialog>` components.
- No new features: layout/visual changes only. Existing behaviors (create project, delete confirm, navigation) are preserved.
- Both themes are kept (light + dark). The chosen style B defines the dark theme; a derived light variant is defined in the same spirit.
- `ThemeService` logic is untouched: it keeps toggling the `.dark` class on `<html>`.

## 3. Approach

**Token redefinition** (chosen over "design-system layer first" and "page-by-page restyle"):

1. Redefine existing CSS custom property values in `src/styles/theme.scss`.
2. Add global conventions (density, radius, focus, scrollbars) in `src/styles.scss` / `theme.scss`.
3. Rebuild topbar + dashboard templates on top of the tokens.

Every screen already styles itself via `tw-bg-*` / `tw-border-border` classes bound to these variables, so the look cascades app-wide for free. A phase 2 audit (out of scope here) will catch hardcoded stragglers elsewhere.

## 4. Design tokens

### 4.1 Dark theme (`.dark`) — palette B exact

| Token                          | Current   | New       | Role                       |
| ------------------------------ | --------- | --------- | -------------------------- |
| `--color-background`           | `#0f172a` | `#1e1e1e` | page background            |
| `--color-card-bg`              | `#1e293b` | `#252526` | cards, panels              |
| `--color-card-fg`              | `#f8fafc` | `#cccccc` | card text                  |
| `--color-muted`                | `#1e293b` | `#2d2d2d` | bars, elevated surfaces    |
| `--color-muted-foreground`     | `#94a3b8` | `#969696` | secondary text             |
| `--color-border`               | `#334155` | `#3c3c3c` | 1px borders                |
| `--color-input`                | `#334155` | `#3c3c3c` | input borders              |
| `--color-primary`              | `#38bdf8` | `#0e639c` | action buttons             |
| `--color-primary-foreground`   | `#0f172a` | `#ffffff` | text on primary            |
| `--color-accent`               | `#fbbf24` | `#41a6f6` | highlight, focus, hover    |
| `--color-destructive`          | `#f87171` | `#f14c4c` | destructive actions        |
| `--color-secondary`            | `#94a3b8` | `#8a8a8a` | neutral secondary          |
| `--color-secondary-foreground` | `#0f172a` | `#1e1e1e` | text on secondary          |
| `--color-accent-foreground`    | `#0f172a` | `#1e1e1e` | text on accent backgrounds |
| `--color-foreground`           | `#f8fafc` | `#cccccc` | base text                  |

Accepted consequences:

- **Amber disappears from the identity** — every `tw-accent-*` usage becomes blue.
- Secondary/accent foregrounds follow contrast needs (`#ffffff` on primary).

### 4.2 Light theme (`:root`) — derived variant ("VS Code Light" spirit)

| Token                          | New       |
| ------------------------------ | --------- |
| `--color-background`           | `#f3f3f3` |
| `--color-card-bg`              | `#ffffff` |
| `--color-card-fg`              | `#1f1f1f` |
| `--color-muted`                | `#e8eaed` |
| `--color-muted-foreground`     | `#616161` |
| `--color-border`               | `#d4d4d4` |
| `--color-input`                | `#d4d4d4` |
| `--color-primary`              | `#005fb8` |
| `--color-primary-foreground`   | `#ffffff` |
| `--color-accent`               | `#005fb8` |
| `--color-accent-foreground`    | `#ffffff` |
| `--color-destructive`          | `#cd3131` |
| `--color-secondary`            | `#616161` |
| `--color-secondary-foreground` | `#ffffff` |
| `--color-foreground`           | `#1f1f1f` |

In light mode `accent` intentionally equals `primary` (same as VS Code Light); they stay distinct in dark mode (`#0e639c` vs `#41a6f6`).

## 5. Global conventions

Added once at stylesheet level, inherited everywhere:

- **Density at the root:** `html { font-size: 14px }` (down from browser default 16). All rem-based Tailwind spacing shrinks ~12% without touching templates. Component meta text uses explicit smaller sizes (11–12px).
- **Crisp corners:** maximum radius is `tw-rounded-sm` (2px) for buttons, inputs, cards, dialogs. No pill shapes.
- **Editor-style focus:** visible `outline: 1px solid var(--color-accent)` with `outline-offset: -1px` on focusable elements.
- **Slim scrollbars:** 10px track transparent; thumb `#3c3c3c`, hover `#4f4f4f` (light theme: `#c1c1c1`, hover `#a0a0a0`). WebKit + `scrollbar-width: thin` fallback.
- **Text selection** tinted with the accent color.

## 6. Topbar

Height 35px, background `muted`, bottom border `border`.

- **Brand (left):** replace the current `phishing` Material Symbol with a small square block filled with the accent color (10px, pure CSS — no icon dependency) + "River King Engine" in 12px semibold. Links to `/`.
- **Navigation tabs (Scenes / Tiles / Sprites):** editor-tab styling — plain text buttons; the active tab gets a 1px accent underline instead of the current filled button style. Still rendered only on project routes.
- **Theme toggle (right):** ghost icon button (Material Symbols `light_mode` / `dark_mode`), no filled background.

## 7. Dashboard page

### 7.1 Header row

- Left: section label **MY PROJECTS** — 12px, uppercase, letter-spaced.
- Right: `+ New Project` button styled `tw-bg-primary` → opens the existing create dialog.

### 7.2 Project grid

Responsive grid: 1 column (narrow), 2 columns (medium), 3 columns (wide). Cards use `card-bg` background with a 1px `border` border that becomes `accent` on hover.

### 7.3 Project card anatomy

- **Name** — semibold, `card-fg`.
- **Meta line** — 11px, `muted-foreground`: `Updated {formatted date} · Tile {size}px · {mapWidth}×{mapHeight}` (reuses existing `formatDate`).
- **Palette swatches** — row of up to 8 squares, 12px each, from `project.palette`.
- **Interaction:** the whole card is clickable to open the project (keyboard accessible: `tabindex="0"`, Enter/Space activate). A trash icon appears top-right on hover → existing confirm-dialog delete flow (stop propagation so it doesn't trigger open).

### 7.4 Empty state

Compact: muted icon + short English copy ("No projects yet") + the dashed "New Project…" row as the single call to action.

### 7.5 Dashed row

A dashed-border "+ New Project…" row appended after the grid items; hover turns border+text accent. Clicking opens the same create dialog as the header button.

### 7.6 Status bar

22px strip at the bottom of the dashboard page, background `primary`, white 11px text: left `{n} projects` (proper singular/plural), right `River King Engine`. Decorative identity element scoped to the dashboard page in phase 1 (app-wide status bar would be a phase 2 decision).

## 8. Create-project dialog

Functional behavior unchanged (form, Sweetie-16 default palette, navigation to `/project/:id`). Visual-only alignment: 2px radii, `input` border token, accent focus outline.

## 9. Error handling

No change to patterns: async failures keep going through `NotificationService` toasts (existing try/catch flows stay as-is).

## 10. Testing strategy

TDD where behavior is observable; pure CSS value swaps require no new tests.

New/updated tests:

1. Status bar renders the real project count with correct pluralization (`1 project` vs `n projects`).
2. Clicking a project card navigates to `/project/:id`.
3. The dashed "+ New Project…" row opens the create dialog (same as header button).
4. Existing specs updated if templates/classes they assert on change (no behavioral regressions expected from token work).

Verification gates: full suite green (`devbox run npm run test`), ESLint clean, Prettier clean.

## 11. Out of scope (phase 2 candidates)

- Audit of remaining screens (scene editor, tile manager, sprite editor) for hardcoded colors/spacing that escaped the token system.
- App-wide status bar.
- Any functional evolution of home-page features.

## 12. References

- Validated mockups: visual companion session `.superpowers/brainstorm/498560-1787513533/content/` (`style-direction.html` direction B; `light-variant.html` light derivation).
- Theme implementation: `src/styles/theme.scss`, Tailwind mapping in `tailwind.config.js`.
