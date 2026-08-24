# Design System Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every remaining shared component and feature template onto the design system (tokens only, `tw-rounded-sm`, no blurred shadows).

**Architecture:** Three mechanical tasks — (1) token addition + shared components restyle, (2) radius sweep across seven feature templates, (3) drag-preview cleanup + final gates. Spec is authoritative for visuals.

**Tech Stack:** Angular 22 standalone components, Tailwind v3 prefix `tw-`, Vitest via `devbox run npm run test`.

## Global Constraints

- Token-bound classes ONLY in templates; no raw palette classes (`bg-green-600`…), no raw hex, no `text-white`.
- Max radius `tw-rounded-sm`; NO shadow utilities anywhere (`shadow-sm|md|lg|xl` forbidden).
- Prettier must pass on all touched files; full suite green after each task.
- Commit style: `feat:`/`refactor:`/`docs:` prefixes as given per task.

---

### Task 1: destructive-foreground token + shared components

**Files:**

- Modify: `src/styles/theme.scss` (add one line to BOTH token blocks)
- Modify: `tailwind.config.js` (one map entry)
- Modify: `src/app/shared/components/toast/toast.component.html`
- Modify: `src/app/shared/components/toast/toast.component.spec.ts`
- Modify: `src/app/shared/components/dialog/dialog.component.scss`
- Modify: `src/app/shared/components/searchable-select/searchable-select.component.html`
- Modify: `src/app/shared/components/confirm-dialog/confirm-dialog.component.html`

**Interfaces:**

- Consumes: existing tokens (`card-bg`, `card-fg`, `primary`, `accent`, `destructive`, `muted-foreground`, `border`).
- Produces: Tailwind color `destructive-foreground`; toast markup contract below reused by NotificationService consumers (no API change).

- [ ] **Step 1: Failing toast spec additions**

In `toast.component.spec.ts` add (adapt to file's existing setup):

```ts
it('styles toasts on-token with a type-colored left edge', () => {
  service.error('Boom');
  fixture.detectChanges();
  const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
  expect(alert.className).toContain('tw-rounded-sm');
  expect(alert.className).toContain('tw-bg-card-bg');
  expect(alert.className).toContain('tw-border-l-destructive');
  expect(alert.className).not.toContain('shadow');
});

it('uses primary edge for success', () => {
  service.success('Saved');
  fixture.detectChanges();
  const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
  expect(alert.className).toContain('tw-border-l-primary');
});
```

- [ ] **Step 2:** `devbox run npm run test` → new tests FAIL.

- [ ] **Step 3: theme.scss** — add inside `:root` after the `--color-destructive` line:

```scss
--color-destructive-foreground: #ffffff;
```

and the identical line inside `.dark, [data-theme='dark']` after its `--color-destructive`.

- [ ] **Step 4: tailwind.config.js** — after `'destructive': 'var(--color-destructive)',` add:

```js
'destructive-foreground': 'var(--color-destructive-foreground)',
```

- [ ] **Step 5: toast.component.html** — replace the message `<div>` block with:

```html
<div
  class="tw-flex tw-items-start tw-gap-3 tw-min-w-[20rem] tw-max-w-[24rem] tw-rounded-sm tw-border tw-border-border tw-bg-card-bg tw-text-card-fg tw-border-l-2 tw-px-4 tw-py-3"
  [class.tw-border-l-primary]="msg.type === 'success'"
  [class.tw-border-l-destructive]="msg.type === 'error'"
  [class.tw-border-l-accent]="msg.type === 'info'"
  [class.tw-border-l-muted-foreground]="msg.type === 'warning'"
  role="alert"
>
  <span
    class="material-symbols"
    aria-hidden="true"
    [class.tw-text-primary]="msg.type === 'success'"
    [class.tw-text-destructive]="msg.type === 'error'"
    [class.tw-text-accent]="msg.type === 'info'"
    [class.tw-text-muted-foreground]="msg.type === 'warning'"
  >
    {{ iconFor(msg.type) }}
  </span>
  <span class="tw-flex-1 tw-text-sm">{{ msg.message }}</span>
  <button
    type="button"
    (click)="dismiss(msg.id)"
    class="tw-p-1 tw-rounded-sm hover:tw-bg-muted tw-transition tw-leading-none"
    aria-label="Close notification"
  >
    <span class="material-symbols" aria-hidden="true">close</span>
  </button>
</div>
```

(Outer container div unchanged.)

- [ ] **Step 6: dialog.component.scss** — remove ` tw-shadow-xl` from the first `@apply` of `.rk-dialog`.

- [ ] **Step 7: searchable-select.component.html** — input class `tw-rounded-md` → `tw-rounded-sm`; listbox class `tw-rounded-md` → `tw-rounded-sm` AND delete ` tw-shadow-md`.

- [ ] **Step 8: confirm-dialog.component.html** — both buttons `tw-rounded-md` → `tw-rounded-sm`; destructive button `tw-text-white` → `tw-text-destructive-foreground`.

- [ ] **Step 9:** Full suite PASS; `devbox run npx prettier --check` on touched files.

- [ ] **Step 10:**

```bash
git add -A && git commit -m "refactor: bring shared components onto design-system tokens"
```

### Task 2: radius sweep across feature templates

**Files (replaceAll `tw-rounded-md` → `tw-rounded-sm`):**

- `src/app/features/project/project-sidebar.component.html`
- `src/app/features/scene-editor/scene-list.component.html`
- `src/app/features/scene-editor/tile-palette.component.html`
- `src/app/features/sprite-editor/sprite-editor.component.html`
- `src/app/features/sprite-editor/tools/drawing-tools.component.html`
- `src/app/features/tile-manager/list/tile-list.component.html`
- `src/app/features/tile-manager/properties/tile-properties.component.html`

**Interfaces:** none (pure class-string swap).

- [ ] **Step 1:** Apply replaceAll in each listed file. Expected total replacements: 23 (3+6+1+1+3+2+7).
- [ ] **Step 2:** `grep -rn 'tw-rounded-md' src/app` → zero hits.
- [ ] **Step 3:** Full suite PASS; prettier --check clean.
- [ ] **Step 4:** `git add -A && git commit -m "refactor: normalize component radii to rounded-sm"`

### Task 3: scene-list drag preview + final gates

**Files:**

- Modify: `src/app/features/scene-editor/scene-list.component.scss`

**Interfaces:** none.

- [ ] **Step 1:** Replace `.cdk-drag-preview` block with:

```scss
.cdk-drag-preview {
  opacity: 0.9;
  outline: 1px solid var(--border);
  border-radius: 0.125rem;
}
```

- [ ] **Step 2:** Gates: `devbox run npm run build`, `devbox run npm run lint`, `devbox run npm run format:check`, `devbox run npm run test` — ALL pass (fix formatting-only failures via `devbox run npx prettier --write <file>` + commit `docs: fix formatting after phase 2` if needed).
- [ ] **Step 3:** `git add -A && git commit -m "refactor: remove drag-preview blur and legacy radius"` (skip if Step 2 produced no diff).

## Self-Review Notes

- Spec D1–D5 ↔ Tasks 1–3 mapped 1:1; no placeholders; counts verified by audit grep.
