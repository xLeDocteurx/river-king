# Design System Reference — "Pro Editor" Documentation Layer

**Date:** 2026-08-23
**Status:** Approved design (sections validated with user)
**Scope:** Documentation only — layered reference docs, AGENTS.md rules, token comments

---

## 1. Goal

Codify the "Pro Editor" visual identity introduced by the dashboard redesign (commit series
`fec0fe3..596b196`) into an explicit, enforceable design system so that:

1. Future components are built in the same spirit without re-deriving conventions each time.
2. The remaining screens (scene-editor, tile-manager, sprite-editor) can be restyled against a
   stable reference in the follow-up phase.

The deliverable is **documentation only**. No visual or behavioral change to existing code,
except one-line role comments added to `theme.scss` tokens (anti-drift measure).

## 2. Non-negotiable constraints

- All UI copy is English only. Documentation is also written in English (repo convention).
- No code changes beyond comments in `src/styles/theme.scss`.
- Every documented rule must either match implemented reality or be explicitly marked as
  `(new pattern)` — defined for upcoming needs, consistent with the VS Code/Aseprite spirit.
- Both themes (light + dark) stay first-class; every style rule applies to both.
- `AGENTS.md` stays concise: imperative digest only, full detail lives in `docs/design-system/`.

## 3. Approach

Chosen approach: **layered docs** (option B), enriched with one-line token comments from
option C. Rejected alternatives: single monolithic doc (hard to grow during phase 2) and
full source-of-truth-in-code (info scattered across two supports).

Deliverable structure:

```
docs/design-system/
├── README.md          # Index: what to read per task type, how to use the reference
├── foundations.md     # Identity, tokens, themes, typography/density, radii, focus, icons
├── layout.md          # Screen anatomy: topbar, tabs, panels, canvas, app-wide status bar
├── components.md      # Normative anatomies with copy-paste Tailwind recipes
├── interactions.md    # Hover/focus/keyboard, selection, destructive flows, async feedback
└── checklist.md       # Mandatory pre-delivery checklist for any UI work
```

Supporting changes:

- `AGENTS.md`: new imperative "Design System" section (~20 lines), merged into / placed right
  after the existing "Styling rules" section, pointing to `docs/design-system/`.
- `src/styles/theme.scss`: one-line comment above each custom property stating its role.

## 4. Content specification

### 4.1 `foundations.md`

- **Identity statement:** "Pro editor" spirit (VS Code / Aseprite). Dense, crisp, sober.
  Forbidden by default: decorative gradients, blurred shadows, pill shapes, large radii,
  amber/warm accents.
- **Token table:** all 15 tokens (`background`, `foreground`, `card-bg`, `card-fg`, `primary`,
  `primary-foreground`, `secondary`, `secondary-foreground`, `accent`, `accent-foreground`,
  `muted`, `muted-foreground`, `destructive`, `border`, `input`) with role and usage rules:
  - Hardcoded hex values are forbidden inside component templates/styles; use `tw-*` classes
    bound to tokens.
  - `primary` = main actions only; `accent` = highlight/focus/hover states;
    `destructive` = deletion/errors only; `muted` = bars and elevated surfaces.
- **Themes:** strict light/dark parity; any new style must be verified in both themes.
- **Typography & density:** root is 14px (global); scale = 11px meta text · 12px standard UI
  text · semibold for titles · section labels 12px uppercase with wide tracking.
- **Global conventions recap:** max radius `tw-rounded-sm`; focus ring 1px solid accent with
  `-1px` offset (already global via `:focus-visible`); slim scrollbars; accent-tinted text
  selection; Material Symbols icons (sizes `tw-text-sm` inline, `tw-text-base` topbar).

### 4.2 `layout.md`

- **Vertical screen grid:** topbar 35px (global, already in `app.component.html`) → scrollable
  content → status bar 22px. Status bar becomes an **app-wide pattern** (user decision): all
  screens render it, dashboard's fixed footer is the current reference implementation.
- **Status bar anatomy:** `tw-h-[22px]`, background `primary`, white 11px text; left slot =
  screen-specific contextual info (e.g. `{n} projects` on dashboard); right slot always
  `River King Engine`. The propagation mechanism (shared component vs per-screen markup) is an
  implementation decision deferred to phase 2 — this spec fixes anatomy and placement only.
- **Editor screen target pattern** _(new pattern)_: left sidebar list + central canvas area +
  right properties panel, separated by 1px `border`. Target anatomy for tile-manager,
  scene-editor, sprite-editor restyling.
- **Page header:** section label left (12px uppercase, letter-spaced, muted-foreground);
  primary action button right.

### 4.3 `components.md`

Normative recipes with canonical Tailwind class strings extracted from implemented components:

| Component               | Status      | Reference implementation         |
| ----------------------- | ----------- | -------------------------------- |
| Primary button          | implemented | Dashboard "+ New Project" header |
| Ghost icon button       | implemented | Topbar theme toggle              |
| Destructive icon button | implemented | Project card trash               |
| Dashed quick-create row | implemented | Dashboard "+ New Project…"       |
| Clickable card          | implemented | Project card                     |
| Selectable list item    | **(new)**   | —                                |
| Properties panel        | **(new)**   | —                                |
| Dialog                  | implemented | Native `<dialog>` components     |
| Empty state             | implemented | Dashboard no-projects block      |

- **Selectable list item** _(new)_: selected = background `muted` + text `foreground`;
  hover = subtle emphasis; never uses `primary` fill for selection.
- **Properties panel** _(new)_: title 12px uppercase muted-foreground; stacked labeled inputs
  using `input` border token, radius `rounded-sm`.
- **Dialog actions row:** right-aligned; ghost "Cancel" + primary confirm; destructive variant
  when the action deletes data.
- Each recipe lists: purpose, class string(s), do/don't notes.

### 4.4 `interactions.md`

- Hover state visible on every interactive surface (border/text → accent, or subtle bg).
- Keyboard access mandatory on custom interactive surfaces: `tabindex="0"` +
  Enter/Space activation; focus-visible ring must remain visible.
- Nested buttons stop event propagation (reference: project card delete).
- Destructive actions always go through `confirm-dialog`; never immediate.
- Async failures report through `NotificationService` toasts; never silent catches.
- Loading states: intentionally unspecified until a screen needs one; extend this file then
  (explicit deferral, not an omission).

### 4.5 `checklist.md`

Pre-delivery checklist, all items mandatory:

- [ ] No hardcoded hex; only token-bound `tw-*` classes
- [ ] Verified in light AND dark theme
- [ ] Radii ≤ `rounded-sm`; no blurred shadows, no pills
- [ ] Focus visible + keyboard operable on all interactive elements
- [ ] All UI copy in English
- [ ] Meta text 11px muted-foreground; section labels 12px uppercase
- [ ] Destructive actions → confirm-dialog
- [ ] Async errors → NotificationService
- [ ] Status bar rendered with contextual content
- [ ] `data-testid` present on testable elements

### 4.6 `README.md`

Index explaining what to read per task: new component → foundations + components + checklist;
new screen → foundations + layout + interactions + checklist; restyling pass → layout +
components diff against current markup.

## 5. AGENTS.md changes

New imperative block (~20 lines) appended as a dedicated subsection at the end of the
existing "Styling rules" section:

- Tokens only (no hex); token semantics table pointer; both themes mandatory.
- Density/radius/focus/icon non-negotiables (one line each).
- Status bar app-wide; destructive = confirm-dialog; errors = NotificationService.
- English-only UI copy.
- Explicit pointers: full reference at `docs/design-system/` (read relevant files before
  building UI); run `docs/design-system/checklist.md` before delivering any UI work.

## 6. Error handling

Not applicable — documentation-only deliverable.

## 7. Testing strategy

No tests required (no behavior change). Verification gates:

1. `npm run build` succeeds.
2. `npm run lint` clean.
3. `npm run format:check` clean (docs included).

## 8. Out of scope

- Restyling of scene-editor, tile-manager, sprite-editor (next work item, tooled by this doc).
- Shared `rk-*` primitives; revisit if drift appears despite the docs.
- Loading-state patterns; status-bar shared component/mechanism (phase 2 implementation).
- Any functional evolution.

## 9. References

- Implemented identity: commits `fec0fe3..596b196`; `src/styles/theme.scss`, `src/styles.scss`,
  `src/app/app.component.html`, dashboard components.
- Previous spec: `docs/superpowers/specs/2026-08-23-dashboard-redesign-design.md`.
