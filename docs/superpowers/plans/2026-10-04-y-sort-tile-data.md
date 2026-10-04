# Y-sort Tile Data (#53) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a non-rendering `ySort` flag on `TileProperties` with an editor checkbox in the tile properties panel ("Overhanging (Y-sort)"), defaulting to `false` everywhere so existing tiles behave exactly as before.

**Architecture:** Add one boolean to the `TileProperties` model (non-indexed → no Dexie version bump). `TileService.createTile` and the v3 `migrateTileProperties` helper set it explicitly to `false`; every read defaults with `?? false`. The tile-properties form gains a `ySort` control wired exactly like the existing `blocking` control (form change → trailing auto-save → `save` output), plus a toggle button + helper caption.

**Tech Stack:** Angular 22 (standalone, signals, reactive forms), Vitest via `@angular/build:unit-test`, Tailwind `tw-` tokens, IndexedDB/Dexie (no migration).

## Global Constraints

- Angular 22 standalone components only; `ChangeDetectionStrategy.OnPush`; signals-first.
- Tailwind: `tw-` prefix, theme tokens only (never raw hex), max radius `tw-rounded-sm`. UI copy **English only**.
- Every new public method/member gets a JSDoc block; keep existing style.
- Tests await async DB work with a manual flush (`await new Promise(r => setTimeout(r, 50))`) — `fixture.whenStable()` does not track Dexie promises.
- Commands run through devbox; strip devbox startup noise with `grep -v "devbox|Welcome|Node.js version|npm version|^$|Running script|v22|10.9"`.
- Branch: `feature-53` (already created from develop, local). Commit messages prefixed `feature-53:`.
- No Dexie schema change. Legacy tiles lacking `ySort` are read as `false` everywhere.
- `ySort: boolean` is **required** in `TileProperties` (per approved spec): the two production builders that construct the object are updated, and every test fixture literal is swept (Task 2).

---

### Task 1: Data model `ySort` + production defaults

**Files:**
- Modify: `src/app/shared/models/tile.model.ts:29-36` (add `ySort`)
- Modify: `src/app/core/services/database.service.ts:16-24` (`migrateTileProperties`)
- Modify: `src/app/features/tile-manager/services/tile.service.ts:42-45` (`createTile`)
- Test: `src/app/core/services/database.service.spec.ts:7-34`, `src/app/features/tile-manager/services/tile.service.spec.ts:26-35`

**Interfaces:**
- Consumes: nothing.
- Produces: `TileProperties.ySort: boolean`; `migrateTileProperties()` and `TileService.createTile()` always return objects with `ySort: false`.

- [ ] **Step 1: Add `ySort` to the model**

Edit `src/app/shared/models/tile.model.ts`, after the `actionId` property (line 35):

```ts
  /** Key of the action in GAME_ACTIONS; undefined when not interactable. */
  actionId?: string;
  /**
   * Whether the tile overhangs its ground cell (tree canopy, tall grass, bush).
   * Enables in-front / behind depth sorting in Play mode (#54). The bottom edge
   * of the artwork is the ground contact; unused by the current renderer.
   */
  ySort: boolean;
```

- [ ] **Step 2: Write the failing tests**

In `src/app/core/services/database.service.spec.ts`, add `ySort: false` to the three expected objects (key order after `actionId`), e.g. lines 9-13 become:

```ts
    expect(migrateTileProperties({ collision: true, solid: false, layer: 'background' })).toEqual({
      blocking: true,
      interactable: false,
      actionId: undefined,
      ySort: false,
    });
```

Lines 24 and 28-32 get the same trailing `ySort: false,`.

In `src/app/features/tile-manager/services/tile.service.spec.ts`, in `'should create a tile with defaults'` (after the `tile.properties.interactable` assertion):

```ts
    expect(tile.properties.ySort).toBe(false);
```

- [ ] **Step 3: Run the two specs to verify they fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/database.service.spec.ts' --include='**/tile.service.spec.ts'
```

Expected: FAIL — `ySort` is `undefined` from `migrateTileProperties`/`createTile` (assertion fails: `expected undefined to be false in Vitest`), and the `toEqual` objects do not deep-equal.

- [ ] **Step 4: Implement production defaults**

`src/app/core/services/database.service.ts` — `migrateTileProperties` return gets `ySort: false` (after `actionId`):

```ts
  return {
    blocking: Boolean(oldProps?.['collision'] || oldProps?.['solid']),
    interactable: Boolean(oldProps?.['interactable']),
    actionId: undefined,
    ySort: false,
  };
```

`src/app/features/tile-manager/services/tile.service.ts` — `createTile` properties object (lines 42-45):

```ts
      properties: {
        blocking: false,
        interactable: false,
        ySort: false,
      },
```

- [ ] **Step 5: Run the two specs to verify they pass**

Run the same command as Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/models/tile.model.ts src/app/core/services/database.service.ts src/app/features/tile-manager/services/tile.service.ts src/app/core/services/database.service.spec.ts src/app/features/tile-manager/services/tile.service.spec.ts
git commit -m "feature-53: add ySort flag to TileProperties with false defaults"
```

---

### Task 2: Sweep TileProperties fixture literals repo-wide

Adding a required property breaks type-checking on every test fixture that builds a `TileProperties` literal. Sweep them all.

**Files:** the spec files listed below. No production code changes.

**Interfaces:**
- Consumes: `TileProperties` now requires `ySort`.
- Produces: a compiling test suite; the most common single-line literal becomes `{ blocking: false, interactable: false, ySort: false }`.

- [ ] **Step 1: replaceAll the common literal**

For each file below, replace **every** occurrence of `{ blocking: false, interactable: false }` with `{ blocking: false, interactable: false, ySort: false }` (use the editor's replace-all; the string is identical in every file):

- `src/app/features/tile-manager/tile-manager.component.spec.ts` (10×: lines 91, 226, 364, 415, 424, 457, 466, 491, 500, 532)
- `src/app/core/services/database.service.spec.ts` (line 47)
- `src/app/core/services/project-io.service.spec.ts` (line 51)
- `src/app/features/tile-manager/properties/tile-properties.component.spec.ts` (line 39, the `makeTile` helper)
- `src/app/features/tile-manager/list/tile-list-tree.component.spec.ts` (5×: lines 26, 58, 81, 146, 166)
- `src/app/features/sprite-editor/frame-strip/frame-strip.component.spec.ts` (line 17)
- `src/app/features/sprite-editor/sprite-editor.component.spec.ts` (8×: lines 126, 179, 242, 370, 416, 458, 508, 586)
- `src/app/features/scene-editor/tile-palette.component.spec.ts` (line 14)
- `src/app/features/scene-editor/services/map-tiles.service.spec.ts` (2×: lines 110, 128)
- `src/app/features/dashboard/import-project-dialog/import-project-dialog.component.spec.ts` (line 43)
- `src/app/features/scene-editor/scene-editor.component.spec.ts` (2×: lines 763, 813)
- `src/app/shared/models/project-archive.model.spec.ts` (line 33 — `{ blocking: false, interactable: false } satisfies TileProperties`; the `satisfies` stays, now with `ySort: false` present)

- [ ] **Step 2: Fix the variant literals manually**

Append `ySort: false` to the `properties` object in each (single-line variants):

- `src/app/core/services/project-io.service.spec.ts:60` → `properties: { blocking: true, interactable: true, actionId: 'talk', ySort: false },`
- `src/app/features/tile-manager/properties/tile-properties.component.spec.ts:245` → `properties: { blocking: false, interactable: true, actionId: 'test', ySort: false },`
- `src/app/features/tile-manager/properties/tile-properties.component.spec.ts:283` → `properties: { blocking: false, interactable: true, actionId: 'ghost', ySort: false },`
- `src/app/features/scene-editor/scene-editor.component.spec.ts:755` → `properties: { blocking: true, interactable: false, ySort: false },`
- `src/app/features/scene-editor/scene-editor.component.spec.ts:797` → `properties: { blocking: false, interactable: true, actionId: 'bell', ySort: false },`
- `src/app/features/scene-editor/scene-editor.component.spec.ts:805` → `properties: { blocking: false, interactable: true, ySort: false },`
- `src/app/features/dashboard/import-project-dialog/import-project-dialog.component.spec.ts:52` → `properties: { blocking: true, interactable: false, ySort: false },`

Then check `src/app/features/tile-manager/list/tile-list.component.spec.ts:15` (a multi-line literal `interactable: false,`): add `ySort: false,` to its `properties` object.

- [ ] **Step 3: Surface and fix any straggler via the type-checker**

Run the production build (type-checks every spec too):

```bash
devbox run npm run build
```

Fix any residual `TileProperties` literal flagged by TypeScript the same way (`ySort: false`). `properties: {}` objects cast as `as Tile` (project-io.service.spec.ts lines 287, 351) are intentional — leave them.

- [ ] **Step 4: Run the full suite**

Run:

```bash
devbox run npm run test -- --watch=false
```

Expected: all tests PASS (no behavior changed — fixtures only).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feature-53: add ySort false to all TileProperties test fixtures"
```

---

### Task 3: Tile properties editor UI (form, toggle, template)

**Files:**
- Modify: `src/app/features/tile-manager/properties/tile-properties.component.ts` (form group lines 88-91; patch effect 169-174; `toggleBlocking` 348-351; `buildUpdatedTile` 387-391)
- Modify: `src/app/features/tile-manager/properties/tile-properties.component.html` (Flags row 129-142)
- Test: `src/app/features/tile-manager/properties/tile-properties.component.spec.ts`

**Interfaces:**
- Consumes: `TileProperties.ySort` (Task 1) and the `makeTile` fixture now carrying `ySort: false` (Task 2).
- Produces: form control `properties.ySort`, method `toggleYSort()`, output `save` emits tiles with `ySort` preserved; DOM button `button[name="ySort"]` and a caption.

- [ ] **Step 1: Write the three failing tests**

In `src/app/features/tile-manager/properties/tile-properties.component.spec.ts`, update the import to also bring the type (line 9):

```ts
import type { Tile, TileProperties } from '../../../shared/models/tile.model';
```

Append these three tests inside the describe block (after the `'auto-saves form edits ~400ms after the last change'` test):

```ts
  it('legacy tile without ySort opens with the checkbox unchecked and does not crash', async () => {
    const legacy = makeTile({
      properties: {
        blocking: false,
        interactable: false,
      } as unknown as TileProperties,
    });
    await setup(legacy);
    const btn = fixture.debugElement.query(By.css('button[name="ySort"]'))
      .nativeElement as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(component.form.get('properties')?.get('ySort')?.value).toBe(false);
  });

  it('toggling Overhanging (Y-sort) emits ySort true then stays silent when reverted', async () => {
    await setup(makeTile());
    const btn = fixture.debugElement.query(By.css('button[name="ySort"]'))
      .nativeElement as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
    component.flushAutosave();
    fixture.detectChanges();
    expect(saved).toHaveLength(1);
    expect(saved[0].properties.ySort).toBe(true);
    expect(saved[0].properties.blocking).toBe(false);
    btn.click();
    fixture.detectChanges();
    component.flushAutosave();
    fixture.detectChanges();
    expect(saved).toHaveLength(1);
  });

  it('renaming a tile keeps its ySort flag in the emitted save', async () => {
    await setup(
      makeTile({ properties: { blocking: false, interactable: false, ySort: true } }),
    );
    const nameInput = fixture.debugElement.query(By.css('input[name="name"]'))
      .nativeElement as HTMLInputElement;
    nameInput.value = 'Renamed';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    component.flushAutosave();
    fixture.detectChanges();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Renamed');
    expect(saved[0].properties.ySort).toBe(true);
  });
```

- [ ] **Step 2: Run the spec to verify the tests fail**

Run:

```bash
devbox run npx ng test --watch=false --include='**/tile-properties.component.spec.ts'
```

Expected: FAIL — test 1 `query(By.css('button[name="ySort"]'))` returns null (throws on `btn.click()` is not a problem here; `toBeTruthy()` fails first), tests 2-3 fail for the same reason / missing `ySort` in the emitted tile.

- [ ] **Step 3: Add the `ySort` control to the form group**

`tile-properties.component.ts` lines 88-91:

```ts
    properties: this.fb.group({
      blocking: [false],
      ySort: [false],
    }),
```

- [ ] **Step 4: Patch stored value into the form (legacy-safe)**

`tile-properties.component.ts` lines 169-174:

```ts
      this.form.patchValue({
        name: t.name,
        type: t.type,
        animationSpeed: t.animationSpeed,
        properties: {
          blocking: t.properties.blocking,
          ySort: t.properties.ySort ?? false,
        },
      });
```

- [ ] **Step 5: Add `toggleYSort` next to `toggleBlocking` (after line 351)**

```ts
  /**
   * Toggles the Overhanging (Y-sort) flag via the reactive form.
   */
  toggleYSort(): void {
    const current = this.form.get('properties')?.get('ySort')?.value ?? false;
    this.form.get('properties')?.get('ySort')?.setValue(!current);
  }
```

- [ ] **Step 6: Emit `ySort` from `buildUpdatedTile`**

`tile-properties.component.ts` lines 387-391 — add one line after `actionId`:

```ts
      properties: {
        blocking: value.properties?.blocking ?? false,
        interactable: this.interactableChecked(),
        actionId: this.interactableChecked() ? (this.actionId() ?? undefined) : undefined,
        ySort: value.properties?.ySort ?? false,
      },
```

- [ ] **Step 7: Add the button and caption to the template**

In `tile-properties.component.html`, insert the Y-sort toggle as the third button in the Flags row, right after the Interactable button block (after line 138), keeping the same base classes:

```html
      <button
        type="button"
        name="ySort"
        (click)="toggleYSort()"
        [class.tw-bg-primary/10]="form.get('properties')?.get('ySort')?.value"
        [class.tw-border-primary]="form.get('properties')?.get('ySort')?.value"
        class="tw-px-2 tw-py-0.5 tw-rounded-sm tw-border tw-border-border tw-text-[11px] tw-text-foreground hover:tw-bg-muted tw-transition-colors"
      >
        Overhanging (Y-sort)
      </button>
```

Then insert the caption line immediately after the Flags row's closing `</div>` (after line 142, before the `@if (interactableChecked())` block):

```html
    <p class="tw-text-[11px] tw-text-muted-foreground tw-mt-2">
      Bottom of the artwork must touch the ground cell. Enables in-front/behind sorting in
      Play mode.
    </p>
```

- [ ] **Step 8: Run the spec to verify the tests pass**

Run the same command as Step 2. Expected: PASS (3 new + all existing).

- [ ] **Step 9: Run the full suite + lint + format**

```bash
devbox run npm run test -- --watch=false
devbox run npm run lint
devbox run npm run format:check
```

Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add src/app/features/tile-manager/properties/tile-properties.component.ts src/app/features/tile-manager/properties/tile-properties.component.html src/app/features/tile-manager/properties/tile-properties.component.spec.ts
git commit -m "feature-53: add Overhanging (Y-sort) toggle to tile properties panel"
```

---

### Task 4: Regression test — ySort survives project export/import

Pass-through is already guaranteed by `project-io.service.ts` (`properties: { ...t.properties }`, lines 99 and 186); this task locks it with a test.

**Files:**
- Modify: `src/app/core/services/project-io.service.spec.ts` (seed at line 60; assertion in the preserved-content test)

**Interfaces:**
- Consumes: `TileProperties.ySort` (Task 1; the seed literal was swept to `ySort: false` in Task 2).
- Produces: a test proving `ySort: true` round-trips through export → import.

- [ ] **Step 1: Seed the water tile with `ySort: true`**

`src/app/core/services/project-io.service.spec.ts:60`:

```ts
      properties: { blocking: true, interactable: true, actionId: 'talk', ySort: true },
```

- [ ] **Step 2: Assert the imported tile keeps the flag**

In `'imports as a new project with remapped ids and preserved content'`, after line 225 (`expect(waterSprites.map((s) => s.id)).toEqual(waterSpriteIds);`):

```ts
    expect(waterTile!.properties.ySort).toBe(true);
```

- [ ] **Step 3: Run the spec**

```bash
devbox run npx ng test --watch=false --include='**/project-io.service.spec.ts'
```

Expected: PASS immediately (characterization — verifies the spread pass-through).

- [ ] **Step 4: Commit**

```bash
git add src/app/core/services/project-io.service.spec.ts
git commit -m "feature-53: lock ySort export/import pass-through with a round-trip test"
```

---

### Task 5: Final verification

- [ ] **Step 1: Full suite**

```bash
devbox run npm run test -- --watch=false
```

Expected: 477+ passed, 0 failed.

- [ ] **Step 2: Lint + format**

```bash
devbox run npm run lint
devbox run npm run format:check
```

Expected: `All files pass linting.` / `All matched files use Prettier code style!`

- [ ] **Step 3: Production build**

```bash
devbox run npm run build
```

Expected: build succeeds within the bundle budgets.

- [ ] **Step 4: Confirm branch is clean and up to date with develop**

```bash
git status
git log --oneline develop..HEAD
```

Expected: working tree clean; 4 `feature-53:` commits ahead of develop.