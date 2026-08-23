# Design System Reference Documentation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Codify the "Pro Editor" visual identity into a layered documentation reference
(`docs/design-system/`), an imperative AGENTS.md section, and one-line role comments on the
design tokens in `src/styles/theme.scss`.

**Architecture:** Documentation only. Six focused Markdown files (index, foundations, layout,
component recipes, interactions, checklist), one ~20-line imperative block merged into
AGENTS.md's "Styling rules" section, and comment-only edits to `theme.scss`. No behavioral
code changes; correctness gate is build/lint/format, not tests (per spec §7).

**Tech Stack:** Plain Markdown; references the existing Tailwind v3 token system (prefix
`tw-`); all npm commands run through Devbox.

## Global Constraints

- All documentation written in English.
- No source-code changes except comments in `src/styles/theme.scss`.
- Every documented rule must match shipped code unless explicitly tagged **(new pattern)**;
  class strings in recipes are copied verbatim from the reference implementations named there.
- Light and dark themes are first-class: every rule applies to both.
- Run npm through Devbox: `devbox run npm run <script>`; one-off tools via
  `devbox run npx <tool>`.
- This deliverable has **no tests** (spec §7). Verification = Prettier per file, then full
  gates in Task 8.
- Commit style follows the repo log: `docs: …` messages, committed after each task.

## File Structure

| File                                              | Responsibility                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/styles/theme.scss` _(modify, comments only)_ | One-line role comment above each of the 15 tokens in both theme blocks                               |
| `docs/design-system/foundations.md`               | Identity statement, token table, themes, typography/density, global conventions, icons               |
| `docs/design-system/layout.md`                    | Vertical screen grid, topbar/status-bar anatomy, editor workspace target pattern, page header, grids |
| `docs/design-system/components.md`                | Normative recipes with canonical Tailwind class strings                                              |
| `docs/design-system/interactions.md`              | Hover/focus/keyboard/selection/destructive/async-error rules                                         |
| `docs/design-system/checklist.md`                 | Mandatory pre-delivery checklist                                                                     |
| `docs/design-system/README.md`                    | Index: what to read per task type                                                                    |
| `AGENTS.md` _(modify)_                            | Imperative "Design system (mandatory)" subsection at end of "Styling rules"                          |

Reference implementations quoted throughout (read-only): `src/app/app.component.html`,
`src/styles/styles.scss`, `src/app/features/dashboard/dashboard.component.html`,
`src/app/features/dashboard/project-card.component.html`,
`src/app/features/dashboard/project-create-dialog.component.html`,
`src/app/shared/components/dialog/dialog.component.scss`.

---

### Task 1: Token role comments in theme.scss

**Files:**

- Modify: `src/styles/theme.scss`

**Interfaces:**

- Produces: commented custom properties. No API change; later tasks quote these roles in prose.

- [ ] **Step 1: Add one-line comments above each property in the `:root` block**

Replace the whole `:root { … }` block (lines 7–38) with:

```scss
:root {
  /* Surface & content */
  /* Page background behind all content */
  --color-background: #f3f3f3;
  /* Default text color */
  --color-foreground: #1f1f1f;

  /* Cards */
  /* Elevated surfaces: cards, panels */
  --color-card-bg: #ffffff;
  /* Text on elevated surfaces */
  --color-card-fg: #1f1f1f;

  /* Brand – Primary (Blue) */
  /* Main action color: primary buttons, status bar fill */
  --color-primary: #005fb8;
  /* Text/icons rendered on primary backgrounds */
  --color-primary-foreground: #ffffff;

  /* Brand – Secondary */
  /* Neutral secondary color (rarely used; prefer muted) */
  --color-secondary: #616161;
  /* Text on secondary backgrounds */
  --color-secondary-foreground: #ffffff;

  /* Accent highlight */
  /* Highlight state color: hover, focus ring, text selection, active tab underline */
  --color-accent: #005fb8;
  /* Text rendered on accent backgrounds */
  --color-accent-foreground: #ffffff;

  /* Muted / subtle */
  /* Subtle surfaces: bars, selected rows */
  --color-muted: #e8eaed;
  /* Secondary/meta text */
  --color-muted-foreground: #616161;

  /* Destructive / Error */
  /* Destruction and errors only */
  --color-destructive: #cd3131;

  /* Borders & inputs */
  /* Structural 1px borders */
  --color-border: #d4d4d4;
  /* Input field borders */
  --color-input: #d4d4d4;
}
```

- [ ] **Step 2: Add the same comments to the dark block**

Apply the identical comment lines to the matching properties inside
`.dark, [data-theme='dark'] { … }` (values stay unchanged).

- [ ] **Step 3: Verify formatting**

Run: `devbox run npx prettier --check src/styles/theme.scss`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/styles/theme.scss
git commit -m "docs: document design-token roles in theme.scss"
```

---

### Task 2: foundations.md

**Files:**

- Create: `docs/design-system/foundations.md`

**Interfaces:**

- Produces: canonical vocabulary used by all later files ("section label", token semantics,
  typography scale). The exact class strings defined here are reused verbatim in Tasks 3–5.

- [ ] **Step 1: Write the file**

````markdown
# Foundations

## Identity — "Pro Editor"

The application looks like a professional pixel-art editor (VS Code / Aseprite spirit).

- **Dense** — compact paddings (`tw-p-3` cards, `tw-px-3 tw-py-1.5` buttons), small text,
  tight grids (`tw-gap-3`).
- **Crisp** — flat fills, 1px borders, sharp corners (2px maximum radius).
- **Sober** — color carries meaning (action / highlight / danger), never decoration.

Forbidden by default: decorative gradients, blurred shadows (`tw-shadow-*`), pill shapes,
radii larger than `tw-rounded-sm`, warm accent hues (amber/orange).

## Color tokens

Tokens are CSS custom properties in `src/styles/theme.scss`, mapped to Tailwind classes in
`tailwind.config.js`. Hardcoded hex/rgb/hsl values and raw Tailwind palette classes
(`tw-bg-red-500`) inside components are forbidden.

| Token classes                                  | Role             | Use for                                                             | Never use for           |
| ---------------------------------------------- | ---------------- | ------------------------------------------------------------------- | ----------------------- |
| `tw-bg-background` · `tw-text-foreground`      | Page base        | Screen background, base text                                        |                         |
| `tw-bg-card-bg` · `tw-text-card-fg`            | Elevated surface | Cards, panels, popups, list containers                              |                         |
| `tw-bg-muted`                                  | Subtle surface   | Bars (topbar), selected list rows                                   | Main actions            |
| `tw-text-muted-foreground`                     | Secondary text   | Meta lines, section labels, inactive elements                       | Body copy               |
| `tw-bg-primary` · `tw-text-primary-foreground` | Action           | The single primary button per view; status bar fill                 | Decoration, large fills |
| `tw-accent-*`                                  | Highlight        | Hover border/text, focus ring, text selection, active tab underline | Large fills             |
| `tw-destructive`                               | Danger           | Delete affordances, error feedback                                  | Anything else           |
| `tw-border-border`                             | Structure        | 1px borders between regions, cards, inputs' container               |                         |
| `tw-border-input`                              | Inputs           | Form field borders                                                  |                         |

The `secondary` tokens exist but are rarely needed — prefer `muted`.

Sparing opacity modifiers on token colors are acceptable where already proven
(`hover:tw-bg-destructive/10`, `tw-border-border/50`); prefer solid token fills otherwise.

## Themes

Light (`:root`) and dark (`.dark`) have strict parity: every rule applies to both. Verify
every new style under both themes using the topbar toggle. If contrast fails in one theme,
fix it at the token level — never with a theme-specific hack inside a component.

## Typography & density

Root font-size is 14px (set globally in `styles.scss`). Never set `font-size` on `html`
locally; rem-based utilities inherit the density.

| Level                   | Classes                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Meta / auxiliary (11px) | `tw-text-[11px]` (+ `tw-text-muted-foreground` for secondary meta)                    |
| Standard UI text (12px) | `tw-text-xs`                                                                          |
| Titles                  | `tw-text-sm tw-font-semibold`                                                         |
| Dialog titles           | `tw-text-xl tw-font-bold`                                                             |
| Section labels          | `tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground` |

## Shape & global conventions

Applied globally once (`styles.scss`); never re-implement locally:

- **Radius:** max `tw-rounded-sm` (2px) on buttons, inputs, cards, dialogs — everything.
  No pills.
- **Focus:** `:focus-visible` renders a 1px solid `accent` outline at `-1px` offset. Never
  remove it and never add replacement focus styles.
- **Scrollbars:** slim, transparent track, thumb `border` → hover `muted-foreground`.
  Do not restyle per component.
- **Text selection:** accent-tinted globally. Do not restyle.

## Icons

Material Symbols only (webfont declared in `theme.scss`):

```html
<span class="material-symbols" aria-hidden="true">add</span>
```

Always with `aria-hidden="true"` when decorative. Sizes: `tw-text-sm` inline next to 12px
text · `tw-text-base` standalone ghost icon buttons · `tw-text-5xl` empty-state illustrations.
````

- [ ] **Step 2: Verify formatting**

Run: `devbox run npx prettier --write docs/design-system/foundations.md && devbox run npx prettier --check docs/design-system/foundations.md`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add docs/design-system/foundations.md
git commit -m "docs: add design-system foundations reference"
```

---

### Task 3: layout.md

**Files:**

- Create: `docs/design-system/layout.md`

**Interfaces:**

- Consumes: "section label" and token vocabulary from `foundations.md`.
- Produces: the status-bar anatomy (22px, `bg-primary`, left contextual slot, right
  `River King Engine`) referenced by `checklist.md`; editor-workspace column names referenced
  by `components.md` recipes.

- [ ] **Step 1: Write the file**

````markdown
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
````

- [ ] **Step 2: Verify formatting**

Run: `devbox run npx prettier --write docs/design-system/layout.md && devbox run npx prettier --check docs/design-system/layout.md`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add docs/design-system/layout.md
git commit -m "docs: add design-system layout reference"
```

---

### Task 4: components.md

**Files:**

- Create: `docs/design-system/components.md`

**Interfaces:**

- Consumes: token semantics (`foundations.md`); status-bar anatomy (`layout.md`).
- Produces: canonical recipes referenced by name from `interactions.md`, `checklist.md`,
  README, and future phase-2 plans: _primary button_, _outline button_, _ghost icon button_,
  _destructive icon button_, _dashed action row_, _clickable card_, _selectable list item_,
  _properties panel_, _input_, _dialog_, _empty state_.

- [ ] **Step 1: Write the file**

````markdown
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

Anatomy top-to-bottom: a header row (`tw-flex tw-items-start tw-justify-between tw-mb-1`)
holding the title (`tw-text-sm tw-font-semibold tw-text-foreground`) and, on its right, the
optional destructive icon button; then the meta line
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
````

- [ ] **Step 2: Verify formatting**

Run: `devbox run npx prettier --write docs/design-system/components.md && devbox run npx prettier --check docs/design-system/components.md`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add docs/design-system/components.md
git commit -m "docs: add design-system component recipes"
```

---

### Task 5: interactions.md

**Files:**

- Create: `docs/design-system/interactions.md`

**Interfaces:**

- Consumes: recipes by name from `components.md`; `NotificationService` contract from
  `core/services/notification.service.ts` (`error(message)`, `success(message)`).

- [ ] **Step 1: Write the file**

````markdown
# Interactions

## Hover

Every interactive surface shows a visible hover state — border/text shifting to `accent`
(cards, dashed rows) or a subtle background shift (ghost buttons, list rows) — combined with
`tw-transition`. Non-interactive surfaces get no hover styling.

Explicitly set `tw-cursor-pointer` on clickable non-button surfaces (buttons don't inherit it
from Tailwind preflight).

## Keyboard

Custom interactive surfaces (cards, list rows) must be keyboard-operable:

```html
role="button" tabindex="0" (keydown.enter)="activate()" (keydown.space)="activate()"
```

The global `:focus-visible` accent ring comes for free — never remove it, never add custom
focus styles. Interactive elements hidden until parent hover must also become visible on
keyboard focus (`focus-visible:tw-opacity-100`, see destructive icon button).

Nested controls inside an interactive surface stop propagation for click AND keydown so the
parent doesn't activate (reference: project-card delete button).

## Selection

Single-select lists follow the selectable-list-item recipe: `muted` fill + `font-medium`
marks the selected row; hover alone never persists selection. Escape closes dialogs (native
`<dialog>` behavior).

## Destructive actions

Any data-destroying action (delete project/tile/sprite/scene) goes through
`rk-confirm-dialog` — never immediate, never browser `confirm()`. The confirm button uses
the destructive variant. The `destructive` color is reserved for these affordances and error
feedback.

## Async feedback

IndexedDB and other async operations are wrapped in `try/catch`; failures call
`notification.error(message)` (toast, auto-dismissed). Optional success confirmation via
`notification.success(...)`. Never swallow errors silently. Toasts are provided by
`<rk-toast />` mounted once at the root.

## Loading states

Intentionally unspecified until a screen needs one. When the first case appears, define the
pattern here and follow it everywhere else.
````

- [ ] **Step 2: Verify formatting**

Run: `devbox run npx prettier --write docs/design-system/interactions.md && devbox run npx prettier --check docs/design-system/interactions.md`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add docs/design-system/interactions.md
git commit -m "docs: add design-system interaction rules"
```

---

### Task 6: checklist.md + README.md

**Files:**

- Create: `docs/design-system/checklist.md`
- Create: `docs/design-system/README.md`

**Interfaces:**

- Consumes: file names produced by Tasks 2–5 (links must match exactly).

- [ ] **Step 1: Write checklist.md**

```markdown
# Delivery Checklist

Mandatory before delivering any UI work — new components, new screens, restyling passes.
Every item applies to both themes.

- [ ] **No hardcoded colors** — only token-bound `tw-*` classes; no hex/rgb/hsl, no raw
      Tailwind palette classes.
- [ ] **Both themes verified** — toggled light AND dark; nothing unreadable in either.
- [ ] **Shape discipline** — radii ≤ `tw-rounded-sm`; no blurred shadows, no pills, no
      gradients.
- [ ] **Keyboard + focus** — every interactive element reachable and operable by keyboard;
      focus ring visible; nested controls stop propagation.
- [ ] **English copy** — all UI text in English, no exceptions.
- [ ] **Type scale respected** — meta text 11px muted-foreground; standard UI 12px; section
      labels uppercase tracking-wider; no ad-hoc font sizes.
- [ ] **Token semantics** — `primary` for the single main action, `accent` for
      highlight/hover/focus, `destructive` only for danger.
- [ ] **Destructive flows** — confirm-dialog in front of every data-destroying action.
- [ ] **Async errors surfaced** — failures reported via NotificationService, never swallowed.
- [ ] **Status bar present** — screen renders the status bar with meaningful contextual info
      on the left.
- [ ] **Test hooks** — `data-testid` attributes on elements tests will target.
```

- [ ] **Step 2: Write README.md**

```markdown
# Design System Reference

River King Engine's visual identity is **"Pro Editor"** (VS Code / Aseprite spirit): dense,
crisp, sober. This folder is the normative reference for any UI work in this repository.

## What to read per task

| Task                         | Read                                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| New component                | `foundations.md` → `components.md` → `checklist.md`                       |
| New screen / page            | `foundations.md` → `layout.md` → `interactions.md` → `checklist.md`       |
| Restyling an existing screen | `layout.md` → `components.md`, diffing current markup against the recipes |
| Choosing a color / text size | `foundations.md`                                                          |

## How the rules work

- Rules tagged **(new pattern)** define conventions agreed for upcoming work that is not yet
  implemented anywhere; apply them as soon as the situation arises.
- Everything else reflects shipped code. Reference implementations: topbar
  (`src/app/app.component.html`) and dashboard (`src/app/features/dashboard/`).
- If you change how something looks, update the relevant file here in the same commit.
- `checklist.md` is mandatory before delivering any UI work; AGENTS.md carries the condensed
  non-negotiables.
```

- [ ] **Step 3: Verify formatting**

Run: `devbox run npx prettier --write docs/design-system/checklist.md docs/design-system/README.md && devbox run npx prettier --check docs/design-system/`
Expected: exit 0 for the whole folder.

- [ ] **Step 4: Commit**

```bash
git add docs/design-system/checklist.md docs/design-system/README.md
git commit -m "docs: add design-system delivery checklist and index"
```

---

### Task 7: AGENTS.md design-system subsection

**Files:**

- Modify: `AGENTS.md` (end of the `## Styling rules` section, i.e. immediately before the
  `## Angular conventions` heading)

**Interfaces:**

- Consumes: final paths `docs/design-system/*` from Tasks 2–6 (must exist before this task).

- [ ] **Step 1: Insert the subsection**

Append to the end of the `## Styling rules` section, keeping two blank lines before
`## Angular conventions`:

```markdown
### Design system (mandatory)

Full reference: `docs/design-system/` — read `foundations.md` plus the relevant pattern file
before building any UI. Run through `docs/design-system/checklist.md` before delivering any
UI work.

- Colors: token-bound classes only (`tw-bg-background`, `tw-accent`, …). Never hardcode
  hex/rgb/hsl or raw Tailwind palette classes. `primary` = the main action, `accent` =
  highlight/hover/focus, `destructive` = deletion/error only.
- Density: root is 14px (global); UI text `tw-text-xs`; meta text `tw-text-[11px]`;
  section labels 12px uppercase tracking-wider.
- Shape: max radius `tw-rounded-sm`. No blurred shadows, no pills, no gradients.
- Icons: Material Symbols only.
- Layout: topbar 35px (root-owned) → scrollable content → status bar 22px app-wide
  (`bg-primary`, 11px; left = contextual info, right = `River King Engine`).
- Interactions: visible hover + `tw-cursor-pointer` on interactive surfaces; keyboard
  operability (`tabindex="0"` + Enter/Space on custom surfaces); never remove the global
  focus ring.
- Destructive actions go through `rk-confirm-dialog`; async failures call
  `NotificationService.error()`.
- UI copy: English only — absolute.
```

- [ ] **Step 2: Verify formatting**

Run: `devbox run npx prettier --check AGENTS.md`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: enforce design-system rules in AGENTS.md"
```

---

### Task 8: Final verification gates

**Files:**

- Possibly modify: any file flagged by the gates (fix in place)

- [ ] **Step 1: Build**

Run: `devbox run npm run build`
Expected: success, within budgets.

- [ ] **Step 2: Lint**

Run: `devbox run npm run lint`
Expected: zero errors/warnings.

- [ ] **Step 3: Format check**

Run: `devbox run npm run format:check`
Expected: all files pass. If a doc file fails, run `devbox run npm run format` and commit:

```bash
git add -A
git commit -m "docs: fix formatting after design-system docs"
```

- [ ] **Step 4: Report**

Summarize: files created/modified, commits made, gate results.
