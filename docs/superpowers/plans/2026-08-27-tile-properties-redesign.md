# Tile Properties Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement task-by-task.

**Goal:** Redesign the `tile-properties.component` form into a compact, card-based inline layout replacing 4 separated bordered groups.

**Architecture:** Minor HTML/SCSS rewrite on the single `TilePropertiesComponent`; TS methods only gain 2 thin toggle wrappers. Auto-save, dialogs, and service interactions remain untouched.

**Tech Stack:** Angular 22 (standalone), Tailwind CSS with `tw-` prefix, SCSS, Vitest.

## Global Constraints

- Tailwind prefix is `tw-`; bare classes like `bg-red-500` do **not** work.
- `core/` must not import from `shared/` or `features/`.
- All async DB errors shown via `NotificationService.error()`.
- No inline templates; use `templateUrl` + `styleUrl`.
- Short component selector prefix `rk-`.
- Never bare `tw-transition` on draggable items; same caution applies here.

---

### Task 1: Add toggle helpers to TS

**Files:**

- Modify: `src/app/features/tile-manager/properties/tile-properties.component.ts`

**Interfaces:**

- Consumes: existing signals `interactableChecked`, `actionId`, reactive form `properties.blocking`
- Produces: public methods `toggleBlocking()`, `toggleInteractable()`

Add two thin methods below the existing `form` / `signals` block (around line 180–200). No changes to any other logic.

- [ ] **Step 1: Write methods**

```typescript
  /**
   * Toggles the Blocking flag via the reactive form.
   */
  toggleBlocking(): void {
    const current = this.form.get('properties')?.get('blocking')?.value ?? false;
    this.form.get('properties')?.get('blocking')?.setValue(!current);
  }

  /**
   * Toggles the Interactable flag and clears actionId when turning off.
   */
  toggleInteractable(): void {
    const next = !this.interactableChecked();
    this.interactableChecked.set(next);
    if (!next) {
      this.actionId.set(null);
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/tile-manager/properties/tile-properties.component.ts
git commit -m "feat: add toggle helpers for blocking and interactable"
```

---

### Task 2: Rewrite HTML layout

**Files:**

- Modify: `src/app/features/tile-manager/properties/tile-properties.component.html`

**Interfaces:**

- Consumes: `form`, `typeSelected()`, `frameCount()`, `tileSprites()`, `widthTiles()`, `heightTiles()`, `currentTiles()`, `interactableChecked()`, `actionId()`, `unknownActionHint()`, `knownActions`
- Produces: same `@Output` bindings — `save` still emitted via existing auto-save; dialogs unchanged

Replace the entire 201-line template with the redesigned inline layout.

Keep the existing form wrapper, dual confirm dialogs, and all field bindings;
only reorganize DOM structure.

- [ ] **Step 1: Rewrite template**

Key DOM structure (full content in edit):

1. `<form>` root unchanged
2. Row 1: Name (flex-1) + Type select + FPS number inline
3. Row 2: Sprite card with header + strip; `@if (typeSelected() === 'animated')` around FPS and Play button
4. Row 3: Width + Height + pixel hint inline
5. Row 4: Badge row (Blocking + Interactable) + Searchable select

- [ ] **Step 2: Commit**

```bash
git add src/app/features/tile-manager/properties/tile-properties.component.html
git commit -m "feat: redesign tile properties layout into inline card form"
```

---

### Task 3: Add SCSS styles

**Files:**

- Modify: `src/app/features/tile-manager/properties/tile-properties.component.scss`

**Interfaces:**

- Produces: `.sprite-card`, `.property-badge`, `.property-badge.active`, `.frame-strip-thumb`, `.frame-add-btn`

The file is currently empty. Add badge/card styling.

- [ ] **Step 1: Write SCSS**

```scss
.sprite-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  padding: 0.5rem;
}

.property-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  background: var(--bg-primary);
  color: var(--text-secondary);
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--accent);
  }

  &.active {
    background: var(--selected-bg);
    border-color: var(--selected-border);
    color: var(--accent);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/tile-manager/properties/tile-properties.component.scss
git commit -m "style: add badge and sprite card styles for tile properties"
```

---

### Task 4: Update tests

**Files:**

- Modify: `src/app/features/tile-manager/properties/tile-properties.component.spec.ts`

Update test assertions to query the new DOM:

- Replace checkbox queries with button/badge queries
- Keep form-value assertions (name, type, speed, blocking) intact
- Verify `frameReorder` etc still work

- [ ] **Step 1: Update DOM selectors in spec**

- [ ] **Step 2: Run component test**

```bash
devbox run npm run test -- --include="**/tile-properties.component.spec.ts"
```

Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add src/app/features/tile-manager/properties/tile-properties.component.spec.ts
git commit -m "test: update tile properties spec for redesigned layout"
```

---

### Task 5: Lint + build + full tests

- [ ] **Step 1: Run lint**

```bash
devbox run npm run lint
```

Expected: 0 errors

- [ ] **Step 2: Run build**

```bash
devbox run npm run build
```

Expected: passes, initial bundle < 500 KB warning

- [ ] **Step 3: Run full tests**

```bash
devbox run npm run test
```

Expected: all pre-existing passes still pass; any new failures are ours

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verify lint, build, and tests after redesign"
```

---

## Spec Coverage Review

| Spec requirement                             | Task                                  |
| -------------------------------------------- | ------------------------------------- |
| Single header row (name/type/fps)            | Task 2                                |
| Inline sprite card with header + strip + add | Task 2                                |
| Inline size row with pixel hint              | Task 2                                |
| Properties as badges                         | Task 2 + Task 3                       |
| Remove horizontal dividers                   | Task 2                                |
| Toggle helper methods                        | Task 1                                |
| Keep auto-save logic unchanged               | implicit — no edits in Task 1–2       |
| Keep dialogs untouched                       | implicit — dialogs remain in template |
| Accessibility (aria-pressed, type=button)    | Task 2                                |
| Test DOM selector update                     | Task 4                                |

No placeholders, no gaps.
