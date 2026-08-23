# Editor UX Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the eight editor-UX improvements from the 2026-08-24 spec: Lospec palette picker at project creation, debounced sprite saves, tile-bound sprite lifecycle, grouped sprite list, 4-column palette panel, single consistent sprite-editor screen, URL-persisted tile selection, and subfolder-based feature structure.

**Architecture:** All changes stay inside the existing standalone-component + signals architecture. New pure constant file in `core/palettes/`; behavioral changes concentrate in `SpriteEditorComponent`, `TileManagerComponent`, and the project-create dialog; the structural change (subfolders mirroring the component hierarchy) lands LAST so functional diffs stay clean and the final move commit is mechanical renames.

**Tech Stack:** Angular 22 (standalone, OnPush, signals), TypeScript ~6.0, Tailwind CSS v3 (`tw-` prefix), Vitest via `@angular/build:unit-test` (jsdom), Devbox-wrapped npm.

## Global Constraints

- Always run npm commands through Devbox: `devbox run npm run …` (or `devbox run npx …`).
- Tailwind classes MUST use the `tw-` prefix and theme-token colors only (`tw-bg-background`, `tw-text-foreground`, `tw-border-border`, `tw-bg-muted`, `tw-bg-primary/10`, …). Never raw palette hex classes.
- UI copy in English only.
- Standalone components, `ChangeDetectionStrategy.OnPush`, signals over RxJS subjects. Never inline templates — always `templateUrl`/`styleUrl`.
- Every public class member keeps a JSDoc comment; new interfaces document every property.
- Async persistence failures surface via `NotificationService.error(...)` wrapped in try/catch.
- Destructive actions go through `ConfirmDialogComponent` (`rk-confirm-dialog`).
- Tests live beside the code as `*.spec.ts`, Vitest globals (`describe/it/expect/vi`). Run the full suite with `devbox run npm run test`; there is no per-file filter — read the per-file results from the summary output.
- Commits: Conventional Commits style used by this repo (`feat: …`, `refactor: …`, `docs: …`).
- Branch: `feature-editor-ux`. Never commit unless a step says so.

---

### Task 1: Lospec palette constants

**Files:**

- Create: `src/app/core/palettes/lospec-palettes.ts`
- Test: `src/app/core/palettes/lospec-palettes.spec.ts`

**Interfaces:**

- Consumes: nothing (pure constants).
- Produces: `interface LospecPalette { id: string; name: string; colors: string[] }` and `const LOSPEC_PALETTES: LospecPalette[]` (10 entries; ids exactly: `sweetie-16`, `33`, `pico-8`, `pico-8-secret-palette`, `slso8`, `oil-6`, `twilight-5`, `slimy-05`, `nymph-gb`, `2bit-demiboy`). Colors are lowercase hex WITHOUT `#`, in exact Lospec order. Task 2 consumes both exports.

- [ ] **Step 1: Write the failing test**

Create `src/app/core/palettes/lospec-palettes.spec.ts`:

```ts
import { LOSPEC_PALETTES } from './lospec-palettes';

describe('LOSPEC_PALETTES', () => {
  it('exposes the ten curated palettes with unique ids', () => {
    expect(LOSPEC_PALETTES.map((p) => p.id)).toEqual([
      'sweetie-16',
      '33',
      'pico-8',
      'pico-8-secret-palette',
      'slso8',
      'oil-6',
      'twilight-5',
      'slimy-05',
      'nymph-gb',
      '2bit-demiboy',
    ]);
  });

  it('has the expected color counts', () => {
    const counts = Object.fromEntries(LOSPEC_PALETTES.map((p) => [p.id, p.colors.length]));
    expect(counts).toEqual({
      'sweetie-16': 16,
      '33': 33,
      'pico-8': 16,
      'pico-8-secret-palette': 32,
      slso8: 8,
      'oil-6': 6,
      'twilight-5': 5,
      'slimy-05': 5,
      'nymph-gb': 4,
      '2bit-demiboy': 4,
    });
  });

  it('only contains valid lowercase hex colors without #', () => {
    for (const palette of LOSPEC_PALETTES) {
      for (const color of palette.colors) {
        expect(color).toMatch(/^[0-9a-f]{6}$/);
      }
    }
  });

  it('matches the canonical Lospec order for spot-checked palettes', () => {
    const sweetie = LOSPEC_PALETTES.find((p) => p.id === 'sweetie-16')!;
    expect(sweetie.name).toBe('Sweetie 16');
    expect(sweetie.colors.slice(0, 4)).toEqual(['1a1c2c', '5d275d', 'b13e53', 'ef7d57']);
    const pico = LOSPEC_PALETTES.find((p) => p.id === 'pico-8')!;
    expect(pico.name).toBe('PICO-8');
    expect(pico.colors.slice(8, 12)).toEqual(['ff004d', 'ffa300', 'ffec27', '00e436']);
  });
});
```

- [ ] **Step 2: Run the suite to verify the new spec fails**

Run: `devbox run npm run test`
Expected: FAIL — `lospec-palettes.spec.ts` cannot resolve `./lospec-palettes`.

- [ ] **Step 3: Create the constants file**

Create `src/app/core/palettes/lospec-palettes.ts`:

```ts
/**
 * Curated Lospec pixel-art palettes available at project creation.
 *
 * Colors are stored exactly as published on lospec.com: lowercase hex
 * WITHOUT the leading `#`, in canonical palette order.
 */
export interface LospecPalette {
  /** Stable identifier used by the project-create dialog. */
  id: string;
  /** Display name shown in the picker. */
  name: string;
  /** Palette colors, lowercase hex without `#`, in Lospec order. */
  colors: string[];
}

/** The ten palettes offered when creating a project. */
export const LOSPEC_PALETTES: LospecPalette[] = [
  {
    id: 'sweetie-16',
    name: 'Sweetie 16',
    colors: [
      '1a1c2c',
      '5d275d',
      'b13e53',
      'ef7d57',
      'ffcd75',
      'a7f070',
      '38b764',
      '257179',
      '29366f',
      '3b5dc9',
      '41a6f6',
      '73eff7',
      'f4f4f4',
      '94b0c2',
      '566c86',
      '333c57',
    ],
  },
  {
    id: '33',
    name: '👌33',
    colors: [
      '001b44',
      '1d3742',
      '2d3c9f',
      '4c7acc',
      '75a5d2',
      'a0bfd7',
      'd0d2dd',
      'eeffec',
      'bbf2d7',
      '94d1a8',
      '83be57',
      '416e57',
      '265a26',
      '3c8a15',
      '8fb228',
      'c4d727',
      'd7e173',
      'ffe0b4',
      'ffd075',
      'ffa226',
      'c56729',
      'b14694',
      '963e57',
      '832a68',
      '643544',
      '432932',
      '863331',
      'e23a17',
      'ff7d4c',
      'ffb578',
      'c7ab82',
      '898a77',
      '4d6061',
    ],
  },
  {
    id: 'pico-8',
    name: 'PICO-8',
    colors: [
      '000000',
      '1d2b53',
      '7e2553',
      '008751',
      'ab5236',
      '5f574f',
      'c2c3c7',
      'fff1e8',
      'ff004d',
      'ffa300',
      'ffec27',
      '00e436',
      '29adff',
      '83769c',
      'ff77a8',
      'ffccaa',
    ],
  },
  {
    id: 'pico-8-secret-palette',
    name: 'PICO-8 Secret Palette',
    colors: [
      '000000',
      '1d2b53',
      '7e2553',
      '008751',
      'ab5236',
      '5f574f',
      'c2c3c7',
      'fff1e8',
      'ff004d',
      'ffa300',
      'ffec27',
      '00e436',
      '29adff',
      '83769c',
      'ff77a8',
      'ffccaa',
      '291814',
      '111d35',
      '422136',
      '125359',
      '742f29',
      '49333b',
      'a28879',
      'f3ef7d',
      'be1250',
      'ff6c24',
      'a8e72e',
      '00b543',
      '065ab5',
      '754665',
      'ff6e59',
      'ff9d81',
    ],
  },
  {
    id: 'slso8',
    name: 'SLSO8',
    colors: ['0d2b45', '203c56', '544e68', '8d697a', 'd08159', 'ffaa5e', 'ffd4a3', 'ffecd6'],
  },
  {
    id: 'oil-6',
    name: 'Oil 6',
    colors: ['fbf5ef', 'f2d3ab', 'c69fa5', '8b6d9c', '494d7e', '272744'],
  },
  {
    id: 'twilight-5',
    name: 'Twilight 5',
    colors: ['fbbbad', 'ee8695', '4a7a96', '333f58', '292831'],
  },
  {
    id: 'slimy-05',
    name: 'Slimy 05',
    colors: ['d1cb95', '40985e', '1a644e', '04373b', '0a1a2f'],
  },
  {
    id: 'nymph-gb',
    name: 'Nymph GB',
    colors: ['2c2137', '446176', '3fac95', 'a1ef8c'],
  },
  {
    id: '2bit-demiboy',
    name: '2BIT Demiboy',
    colors: ['252525', '4b564d', '9aa57c', 'e0e9c4'],
  },
];
```

Note: PICO-8 arrays above use the lowercase forms returned by the Lospec API for BOTH pico-8 entries (the API returns mixed case for `pico-8` — normalize everything to lowercase; the spot-check assertions already expect lowercase).

- [ ] **Step 4: Run the suite to verify it passes**

Run: `devbox run npm run test`
Expected: PASS — `lospec-palettes.spec.ts` green, all other suites unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/palettes/
git commit -m "feat: add curated Lospec palette constants"
```

---

### Task 2: Palette picker in the project-create dialog

**Files:**

- Modify: `src/app/features/dashboard/project-create-dialog.component.ts`
- Modify: `src/app/features/dashboard/project-create-dialog.component.html`
- Modify: `src/app/features/dashboard/project-create-dialog.component.scss` (add swatch-strip helper if needed)
- Test: `src/app/features/dashboard/project-create-dialog.component.spec.ts`

**Interfaces:**

- Consumes: `LOSPEC_PALETTES` / `LospecPalette` from `../../core/palettes/lospec-palettes` (Task 1). Existing `ProjectService.create(CreateProjectDto)` — `palette` expects hex WITH `#`.
- Produces: dialog state `selectedPaletteId: WritableSignal<string>` (default `'sweetie-16'`, reset in `open()`). Nothing downstream depends on it.

- [ ] **Step 1: Update the component test first**

In `project-create-dialog.component.spec.ts` ADD these tests (keep every existing passing test that doesn't conflict; DELETE any assertion asserting the old hardcoded palette literal):

```ts
it('preselects Sweetie 16 and resets on open', () => {
  fixture.autoDetectComponents();
  component.open();
  expect(component.selectedPaletteId()).toBe('sweetie-16');
});

it('creates the project with the chosen palette colors prefixed by #', async () => {
  const createSpy = spyOn(projectService, 'create').and.resolveTo({ id: 'p1' });
  component.open();
  component.projectName.set('Test');
  component.selectedPaletteId.set('nymph-gb');
  await component.createProject(new Event('submit'));
  const dto = createSpy.calls.mostRecent().args[0];
  expect(dto.palette).toEqual(['#2c2137', '#446176', '#3fac95', '#a1ef8c']);
});
```

Adapt spy/setup names to the file's EXISTING conventions (read the current spec first — reuse how it obtains `ProjectService`, renders the dialog, and flushes async work; follow the repo pattern of flushing IndexedDB handlers with `await new Promise((r) => setTimeout(r, 50))` where needed).

- [ ] **Step 2: Run the suite to verify failure**

Run: `devbox run npm run test`
Expected: FAIL — `selectedPaletteId` does not exist.

- [ ] **Step 3: Implement the picker**

`project-create-dialog.component.ts`:

- Add imports: `import { LOSPEC_PALETTES } from '../../core/palettes/lospec-palettes';`
- Add member after `projectName`:

```ts
  /** Id of the palette selected in the picker (Sweetie 16 by default). */
  readonly selectedPaletteId = signal<string>('sweetie-16');

  /** Palettes offered by the picker. */
  readonly palettes = LOSPEC_PALETTES;

  /**
   * Selects a palette in the picker.
   * @param id - Palette id chosen by the user.
   */
  selectPalette(id: string): void {
    this.selectedPaletteId.set(id);
  }

  /** Returns the currently selected palette definition. */
  private selectedPalette() {
    return this.palettes.find((p) => p.id === this.selectedPaletteId()) ?? this.palettes[0];
  }
```

- In `open()` add `this.selectedPaletteId.set('sweetie-16');`
- Replace the hardcoded array in `createProject()` with:

```ts
        palette: this.selectedPalette().colors.map((c) => `#${c}`),
```

Update the class JSDoc: creation now uses the palette chosen in the dialog (default Sweetie 16).

`project-create-dialog.component.html` — insert BETWEEN the name `</label>` and the actions `<div>`:

```html
<fieldset class="tw-flex tw-flex-col tw-gap-1">
  <legend class="tw-text-sm tw-font-medium tw-mb-1">Palette</legend>
  @for (p of palettes; track p.id) {
  <button
    type="button"
    role="radio"
    [aria-checked]="selectedPaletteId() === p.id"
    (click)="selectPalette(p.id)"
    class="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-3 tw-py-2 tw-rounded-sm tw-text-left hover:tw-bg-muted"
    [class.tw-bg-primary/10]="selectedPaletteId() === p.id"
  >
    <span class="tw-text-sm tw-whitespace-nowrap">
      {{ p.name }}@if (p.id === 'sweetie-16') {
      <span class="tw-text-muted-foreground">(default)</span> }
    </span>
    <span class="tw-flex tw-gap-px tw-overflow-hidden" aria-hidden="true">
      @for (color of p.colors; track $index) {
      <span class="tw-w-1.5 tw-h-4" [style.background-color]="'#' + color"></span>
      }
    </span>
  </button>
  }
</fieldset>
```

Give the fieldset a max height with internal scroll by adding to the SCSS file:

```scss
fieldset {
  max-height: 220px;
  overflow-y: auto;
}
```

- [ ] **Step 4: Run the suite**

Run: `devbox run npm run test`
Expected: PASS — dialog specs green including the two new ones.

Also verify visually later; no lint/format step yet (gates run in Task 10, but run `devbox run npx prettier --check src/app/features/dashboard/project-create-dialog.component*` now and fix with `--write` before committing).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/dashboard/project-create-dialog.component.*
git commit -m "feat: offer curated palette choice when creating a project"
```

---

### Task 3: Debounced sprite persistence

**Files:**

- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts`
- Test: `src/app/features/sprite-editor/sprite-editor.component.spec.ts`

**Interfaces:**

- Consumes: existing `SpriteService.encodePixelData(indices, palette)` / `updateSprite(id, changes)`; existing `onCanvasChange(updatedIndices: number[][])` template contract with `PixelCanvasComponent` (unchanged signature).
- Produces: private members `persistTimer`, `pendingSave`, and methods `private schedulePersist(spriteId, updatedIndices, pixelData)` / `private flushPersist()` — no public API change. Task 7 relies on flush-before-switch behavior remaining in place.

- [ ] **Step 1: Add failing tests**

Append to the sprite-editor component spec (reuse its existing TestBed setup conventions; enable fake timers where shown):

```ts
it('debounces rapid strokes into one updateSprite call', async () => {
  vi.useFakeTimers();
  try {
    // arrange: select a sprite as the existing setup helpers do
    const updateSpy = spyOn(spriteService, 'updateSprite').and.resolveTo(undefined);
    await component.selectSprite(existingSpriteId);
    updateSpy.calls.reset();

    const stroke = component.paletteIndices()!.map((row) => [...row]);
    stroke[0][0] = 1;
    await component.onCanvasChange(stroke);
    stroke[0][0] = 2;
    await component.onCanvasChange(stroke);

    expect(updateSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.calls.mostRecent().args[0]).toBe(existingSpriteId);
  } finally {
    vi.useRealTimers();
  }
});

it('flushes the pending save when the component is destroyed', async () => {
  const updateSpy = spyOn(spriteService, 'updateSprite').and.resolveTo(undefined);
  await component.selectSprite(existingSpriteId);
  updateSpy.calls.reset();

  const stroke = component.paletteIndices()!.map((row) => [...row]);
  stroke[0][0] = 3;
  await component.onCanvasChange(stroke);

  fixture.destroy();
  expect(updateSpy).toHaveBeenCalledTimes(1);
});

it('flushes the pending save before switching sprites', async () => {
  const updateSpy = spyOn(spriteService, 'updateSprite').and.resolveTo(undefined);
  await component.selectSprite(existingSpriteId);
  updateSpy.calls.reset();

  const stroke = component.paletteIndices()!.map((row) => [...row]);
  stroke[0][0] = 4;
  await component.onCanvasChange(stroke);
  await component.selectSprite(otherSpriteId);

  expect(updateSpy).toHaveBeenCalledTimes(1);
  expect(updateSpy.calls.mostRecent().args[0]).toBe(existingSpriteId);
});
```

`existingSpriteId` / `otherSpriteId`: seed two sprites through the spec's existing seeding mechanism (the file already creates sprites for selection tests — reuse it; if it only seeds one, add a second via the seeded service).

- [ ] **Step 2: Verify failure**

Run: `devbox run npm run test`
Expected: FAIL — three writes today (one per stroke), none deferred.

- [ ] **Step 3: Implement the debounce**

In `SpriteEditorComponent`:

Add members (after `paletteIndices`):

```ts
  /** Handle of the scheduled trailing save timer (null when idle). */
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /** Payload waiting to be persisted once drawing pauses. */
  private pendingSave: { spriteId: number; indices: number[][]; pixelData: string } | null = null;
```

Replace `onCanvasChange` with:

```ts
  /**
   * Handles canvas changes: echoes pixels locally right away and schedules
   * a single trailing save 250 ms after the last stroke event.
   * @param updatedIndices - The updated 2D array of palette indices.
   */
  onCanvasChange(updatedIndices: number[][]) {
    const sprite = this.selectedSprite();
    if (!sprite) return;

    try {
      const pixelData = this.spriteService.encodePixelData(updatedIndices, this.projectPalette());
      this.paletteIndices.set(updatedIndices.map((row) => [...row]));
      this.selectedSprite.update((s) =>
        s ? { ...s, paletteIndices: updatedIndices.map((row) => [...row]), pixelData } : null,
      );
      this.schedulePersist(sprite.id, updatedIndices, pixelData);
    } catch (e) {
      this.notification.error('Failed to save sprite');
      console.error(e);
    }
  }

  /**
   * Stores the payload and (re)starts the 250 ms trailing timer.
   * @param spriteId - Sprite being edited.
   * @param indices - Latest palette indices.
   * @param pixelData - Encoded pixel payload.
   */
  private schedulePersist(spriteId: number, indices: number[][], pixelData: string): void {
    this.pendingSave = { spriteId, indices, pixelData };
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.flushPersist();
    }, 250);
  }

  /**
   * Writes the pending payload to IndexedDB immediately (no-op when empty).
   * Called by the timer, before sprite switches, and on destruction.
   */
  private async flushPersist(): Promise<void> {
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    const payload = this.pendingSave;
    this.pendingSave = null;
    if (!payload) return;
    try {
      await this.spriteService.updateSprite(payload.spriteId, {
        paletteIndices: payload.indices,
        pixelData: payload.pixelData,
      });
    } catch (e) {
      this.notification.error('Failed to save sprite');
      console.error(e);
    }
  }
```

Hook flush points:

- At the TOP of `selectSprite`: `await this.flushPersist();` (before changing selection state).
- In `ngOnInit`, register cleanup: `this.destroyRef.onDestroy(() => void this.flushPersist());`
- If `resizeSprites`/other flows replace the canvas data elsewhere in this component, call `void this.flushPersist()` before them too (check the file; today only `selectSprite` switches context).

- [ ] **Step 4: Verify pass**

Run: `devbox run npm run test`
Expected: PASS — debounce tests green, rest of suite unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor/sprite-editor.component.ts \
  src/app/features/sprite-editor/sprite-editor.component.spec.ts
git commit -m "feat: debounce sprite saves until drawing pauses"
```

---

### Task 4: Sprite lifecycle bound to tiles

**Files:**

- Modify: `src/app/features/tile-manager/tile-manager.component.ts` (`createTile`)
- Modify: `src/app/features/sprite-editor/sprite-editor.component.html` (remove add/delete buttons)
- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts` (remove CRUD handlers)
- Modify: `src/app/features/sprite-editor/sprite-editor.component.scss` (only if orphaned rules remain)
- Test: `src/app/features/tile-manager/tile-manager.component.spec.ts`, `src/app/features/sprite-editor/sprite-editor.component.spec.ts`

**Interfaces:**

- Consumes: `TileSpritesService.createBlankFrame(projectId: string, tileId: number, name: string, width: number, height: number): Promise<Sprite>` (returns created sprite; caller updates `tile.spriteIds` — same pattern as `TilePropertiesComponent.createFramesFrom`); `TileService.updateTile(id, changes)`.
- Produces: `TileManagerComponent.createTile()` now returns `Promise<void>` but leaves the new tile SELECTED (calls `selectTile(tile.id)`). Sprite editor loses `createSprite`, `requestDelete`, `deleteSprite`, `spriteToDelete`, `deleteDialogData`, `confirmDialogRef` — Tasks 5–7 build on the slimmed shell.

- [ ] **Step 1: Failing tests**

In `tile-manager.component.spec.ts` add (adapt seeding/spies to file conventions; `createBlankFrame` must be spied to resolve a fake `{ id: 99 }` sprite):

```ts
it('creates a first frame and selects the new tile', async () => {
  const frameSpy = spyOn(tileSpritesService, 'createBlankFrame').and.resolveTo({
    id: 99,
  } as never);
  const updateSpy = spyOn(tileService, 'updateTile').and.resolvedValue(undefined);

  await component.createTile();

  expect(frameSpy).toHaveBeenCalledWith(
    component.projectId(),
    jasmine.any(Number),
    'frame 1',
    component.tileSize(),
    component.palette(),
  );
  expect(updateSpy).toHaveBeenCalled();
  expect(component.selectedTileId()).not.toBeNull();
});
```

NOTE: this repo uses Vitest — if the existing specs use `vi.spyOn`, write `vi.spyOn(tileSpritesService, 'createBlankFrame').mockResolvedValue({ id: 99 } as never)` and `mockResolvedValue(undefined)`; match whichever the file already uses.

In `sprite-editor.component.spec.ts` DELETE tests covering `createSprite`, `requestDelete`, `deleteSprite` (manual CRUD no longer exists).

- [ ] **Step 2: Verify failure**

Run: `devbox run npm run test`
Expected: FAIL — tile-manager new test fails (no frame created).

- [ ] **Step 3: Implement**

`tile-manager.component.ts` — replace `createTile`:

```ts
  /**
   * Creates a new tile together with its first blank frame ("frame 1"),
   * refreshes the list and selects the new tile.
   * @returns Promise that resolves when the tile is ready.
   */
  async createTile(): Promise<void> {
    try {
      const tile = await this.tileService.createTile(
        this.projectId(),
        `Tile ${this.tiles().length + 1}`,
      );
      const frame = await this.tileSpritesService.createBlankFrame(
        this.projectId(),
        tile.id,
        'frame 1',
        this.tileSize(),
        this.palette(),
      );
      await this.tileService.updateTile(tile.id, { spriteIds: [frame.id] });
      await this.loadTiles();
      await this.selectTile(tile.id);
    } catch (e) {
      this.notification.error('Failed to create tile');
      console.error(e);
    }
  }
```

Check `TileService.createTile`'s actual return: if it resolves `void` instead of the created `Tile`, fetch it back with `await this.tileService.getTiles(...)` diffing, or extend `createTile` to return the new `Tile` (preferred; adjust its JSDoc) — read the service first and pick the smallest correct option.

`sprite-editor.component.html`:

- Delete the add-sprite `<button>` (lines 9–16 region: `(click)="createSprite()"`).
- Delete the per-row delete `<button>` (`(click)="requestDelete(...)"`) and unwrap the row `<div class="tw-flex tw-items-center tw-gap-1">` so the select `<button>` stands alone.
- Delete the entire `<rk-confirm-dialog …>` element at the bottom.

`sprite-editor.component.ts` — remove: `viewChild` + `effect` imports IF now unused, `ConfirmDialogComponent`/`ConfirmDialogData` imports, the provider entry `ConfirmDialogComponent` from `imports: []`, `confirmDialogRef`, `spriteToDelete`, `deleteDialogData`, the constructor effect, `createSprite()`, `requestDelete()`, `deleteSprite()`. Keep `SpriteService.deleteSprite` (service API stays for future flows).

- [ ] **Step 4: Verify pass**

Run: `devbox run npm run test`
Expected: PASS — updated suites green; nothing else regressed.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/tile-manager/tile-manager.component.ts \
  src/app/features/tile-manager/tile-manager.component.spec.ts \
  src/app/features/sprite-editor/
git commit -m "feat: bind sprite lifecycle to tile creation and frames"
```

---

### Task 5: Sprite list grouped by parent tile

**Files:**

- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts`
- Modify: `src/app/features/sprite-editor/sprite-editor.component.html`
- Test: `src/app/features/sprite-editor/sprite-editor.component.spec.ts`

**Interfaces:**

- Consumes: `TileService` from `../tile-manager/services/tile.service` (`getTiles(projectId): Promise<Tile[]>`, root-provided — same cross-feature convention as the existing `ProjectService` import). `Sprite.tileId: number`, `Tile.name: string`.
- Produces: `tiles = signal<Tile[]>([])` and `readonly spriteGroups = computed<{ tile: Tile; sprites: Sprite[] }[]>(()>…)` on the shell (shape below). Template renders groups; row click still calls `selectSprite(sprite.id)`.

- [ ] **Step 1: Failing test**

```ts
it('groups sprites under their parent tile in tile-name order', () => {
  component.sprites.set([
    { id: 1, name: 'frame 2', tileId: 20 } as Sprite,
    { id: 2, name: 'frame 1', tileId: 20 } as Sprite,
    { id: 3, name: 'frame 1', tileId: 10 } as Sprite,
  ]);
  component.tiles.set([
    { id: 10, name: 'Beta' },
    { id: 20, name: 'Alpha' },
  ] as Tile[]);

  expect(component.spriteGroups().map((g) => g.tile.name)).toEqual(['Alpha', 'Beta']);
  expect(component.spriteGroups()[0].sprites.map((s) => s.name)).toEqual(['frame 1', 'frame 2']);
});
```

- [ ] **Step 2: Verify failure**

Run: `devbox run npm run test`
Expected: FAIL — `spriteGroups` undefined.

- [ ] **Step 3: Implement**

TS: add `import { TileService } from '../tile-manager/services/tile.service';` and `import type { Tile } from '../../shared/models/tile.model';`; inject `private readonly tileService = inject(TileService);`; add signals/computed:

```ts
  /** Tiles of the current project, used as group headers for the sprite list. */
  tiles = signal<Tile[]>([]);

  /** Sprites grouped under their parent tile, ordered by tile then sprite name. */
  readonly spriteGroups = computed(() => {
    const tilesById = new Map(this.tiles().map((t) => [t.id, t]));
    const groups = new Map<number, { tile: Tile; sprites: Sprite[] }>();
    for (const sprite of this.sprites()) {
      const tile = tilesById.get(sprite.tileId);
      if (!tile) continue;
      let group = groups.get(tile.id);
      if (!group) {
        group = { tile, sprites: [] };
        groups.set(tile.id, group);
      }
      group.sprites.push(sprite);
    }
    return [...groups.values()].sort((a, b) => a.tile.name.localeCompare(b.tile.name));
  });
```

Inner ordering: sort each group's sprites by name — after the push loop add:

```ts
for (const group of groups.values()) {
  group.sprites.sort((a, b) => a.name.localeCompare(b.name));
}
```

Load tiles next to sprites: in the project-param subscription add `this.loadTiles();` and add:

```ts
  /** Loads all tiles of the project for sprite grouping headers. */
  async loadTiles(): Promise<void> {
    try {
      this.tiles.set(await this.tileService.getTiles(this.projectId()));
    } catch (e) {
      this.notification.error('Failed to load tiles');
      console.error(e);
    }
  }
```

HTML — replace the flat `@for (sprite of sprites() …)` block (rows keep the Task-4 slimmed markup) with:

```html
@for (group of spriteGroups(); track group.tile.id) {
<div
  class="tw-flex tw-items-center tw-gap-2 tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted-foreground tw-uppercase"
>
  <span class="material-symbols" aria-hidden="true">folder</span>
  <span>{{ group.tile.name }}</span>
</div>
@for (sprite of group.sprites; track sprite.id) {
<button
  type="button"
  (click)="selectSprite(sprite.id)"
  [class.tw-bg-primary/10]="selectedSpriteId() === sprite.id"
  class="tw-text-left tw-px-3 tw-py-2 tw-rounded-md tw-text-sm tw-text-foreground hover:tw-bg-muted tw-transition tw-flex tw-items-center tw-gap-2"
>
  <span class="material-symbols tw-text-muted-foreground" aria-hidden="true">image</span>
  <span>{{ sprite.name }}</span>
</button>
} } @empty {
<div class="tw-text-muted-foreground tw-text-sm tw-text-center tw-py-4">No sprites yet</div>
}
```

After loading sprites in `loadSprites()` / after any sprite mutation, ALSO refresh `this.loadTiles()` so renamed/new tiles reflect (simplest: call both wherever `loadSprites()` was called).

- [ ] **Step 4: Verify pass**

Run: `devbox run npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor/
git commit -m "feat: group sprite list under parent-tile folders"
```

---

### Task 6: Four-column palette panel

**Files:**

- Modify: `src/app/features/sprite-editor/palette-manager.component.html` (line 3 container)
- Test: `src/app/features/sprite-editor/palette-manager.component.spec.ts`

**Interfaces:**

- Consumes/Produces: none beyond markup.

- [ ] **Step 1: Failing test**

```ts
it('lays the swatches out in a four-column grid', () => {
  const grid = fixture.nativeElement.querySelector('[data-testid=palette-grid]');
  expect(grid.className).toContain('tw-grid-cols-4');
});
```

(If the spec renders with inputs, feed a 16-color `[palette]` as existing tests do.)

- [ ] **Step 2: Verify failure** — Run: `devbox run npm run test` — Expected: FAIL (no such class / element).

- [ ] **Step 3: Implement**

In `palette-manager.component.html` line 3 change:

```html
<div class="tw-grid tw-grid-cols-4 tw-gap-1" data-testid="palette-grid"></div>
```

(closing tag unchanged). Swatch buttons keep `tw-w-8 tw-h-8`.

- [ ] **Step 4: Verify pass** — Run: `devbox run npm run test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor/palette-manager.component.html \
  src/app/features/sprite-editor/palette-manager.component.spec.ts
git commit -m "feat: render palette swatches in a 4x4-friendly grid"
```

---

### Task 7: One consistent sprite editor screen (drop focus mode)

**Files:**

- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts`
- Modify: `src/app/features/sprite-editor/sprite-editor.component.html`
- Test: `src/app/features/sprite-editor/sprite-editor.component.spec.ts`

**Interfaces:**

- Consumes: Task 3 flush-before-switch; Task 5 grouped list.
- Produces: `focusMode`, `backToTiles()` REMOVED. `/sprites/:spriteId` stays a deep link that preselects the sprite in the standard layout. Router injection may be removed entirely if unused after this task (check `backToTiles` was its only use).

- [ ] **Step 1: Adjust tests**

DELETE any spec asserting focus-mode behavior (list hidden, back button present). ADD:

```ts
it('keeps the sprite list visible when a spriteId param is present', async () => {
  await simulateRouteParam('42'); // use the spec's existing route-param helper/conventions
  await new Promise((r) => setTimeout(r, 50)); // flush IndexedDB-driven loads
  expect(fixture.nativeElement.querySelector('rk-pixel-canvas')).toBeTruthy();
  expect(fixture.nativeElement.textContent).toContain('Sprites');
});

it('shows the selected sprite name above the canvas', async () => {
  await component.selectSprite(existingSpriteId);
  expect(fixture.nativeElement.textContent).toContain('frame 1');
});
```

- [ ] **Step 2: Verify failure** — Run: `devbox run npm run test` — Expected: FAIL (`backToTiles`/`focusMode` references in code, or missing name header).

- [ ] **Step 3: Implement**

TS: delete the `focusMode` signal and `backToTiles()`; in the `:spriteId` param subscription drop both `focusMode` writes; on not-found keep `this.notification.error('Sprite not found');` and `return;` (no navigation). Remove `Router` injection if now unused.

HTML target shape (full file):

```html
<div class="tw-flex tw-h-full">
  <!-- Left: Sprite List -->
  <div class="tw-w-64 tw-shrink-0 tw-border-r tw-border-border tw-bg-card-bg tw-flex tw-flex-col">
    <div class="tw-px-4 tw-py-3 tw-border-b tw-border-border">
      <h3 class="tw-font-semibold tw-text-foreground">Sprites</h3>
    </div>
    <div class="tw-flex-1 tw-overflow-auto tw-p-2 tw-flex tw-flex-col tw-gap-1">
      <!-- Task 5 grouped list block stays here unchanged -->
    </div>
  </div>

  <!-- Center: Canvas -->
  <div
    class="tw-flex-1 tw-flex tw-flex-col tw-items-center tw-justify-center tw-bg-background tw-p-4 tw-gap-4"
  >
    @if (selectedSprite(); as sprite) {
    <h2 class="tw-font-semibold tw-text-foreground">{{ sprite.name }}</h2>
    } @if (selectedSprite() && paletteIndices(); as indices) {
    <rk-pixel-canvas
      [paletteIndices]="indices"
      [palette]="projectPalette()"
      [selectedColorIndex]="selectedColorIndex()"
      [tool]="selectedTool()"
      (indicesChange)="onCanvasChange($event)"
    />
    } @else {
    <div class="tw-text-muted-foreground tw-text-center tw-py-20">Select a sprite to edit</div>
    }
  </div>

  <!-- Right: Tools -->
  <div
    class="tw-w-56 tw-shrink-0 tw-border-l tw-border-border tw-bg-card-bg tw-p-4 tw-flex tw-flex-col tw-gap-4"
  >
    <rk-palette-manager
      [palette]="projectPalette()"
      [selectedIndex]="selectedPaletteIndex()"
      (selectedIndexChange)="selectedPaletteIndex.set($event)"
    />
    <rk-drawing-tools [tool]="selectedTool()" (toolChange)="selectedTool.set($event)" />
  </div>
</div>
```

(The comment `<!-- Task 5 grouped list block stays here unchanged -->` marks the existing block — keep the real Task-5 markup, do NOT paste the comment.)

- [ ] **Step 4: Verify pass** — Run: `devbox run npm run test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/sprite-editor/
git commit -m "feat: make sprite editor layout consistent everywhere"
```

---

### Task 8: Persist selected tile in the URL

**Files:**

- Modify: `src/app/features/tile-manager/tile-manager.routes.ts`
- Modify: `src/app/features/tile-manager/tile-manager.component.ts`
- Test: `src/app/features/tile-manager/tile-manager.component.spec.ts`

**Interfaces:**

- Consumes: existing route hierarchy (`/project/:id/tiles`). Adds optional leaf `:tileId`.
- Produces: `selectTile(tileId)` additionally navigates; new private `restoreFromParams(tileId: number | undefined)`; `deleteTile` clears the URL segment when the deleted tile was selected. `createTile` (Task 4) ends on `selectTile`, so creating also updates the URL.

- [ ] **Step 1: Failing tests**

```ts
it('navigates to the tile route when a tile is selected', async () => {
  const navigateSpy = spyOn(component['router'], 'navigate').and.resolveTo(true);
  await component.selectTile(7);
  expect(navigateSpy).toHaveBeenCalledWith(['/project', component.projectId(), 'tiles', 7]);
});

it('restores the selection from the :tileId route param', async () => {
  await component.loadTiles();
  // emit params the way the spec's ActivatedRoute stub does for other params
  routeSubject.next({ id: component.projectId(), tileId: String(seedTileId) });
  await new Promise((r) => setTimeout(r, 50));
  expect(component.selectedTileId()).toBe(seedTileId);
});

it('clears the tile param when the selected tile is deleted', async () => {
  const navigateSpy = spyOn(component['router'], 'navigate').and.resolveTo(true);
  await component.selectTile(seedTileId);
  navigateSpy.calls.reset();
  await component.deleteTile(seedTileId);
  expect(navigateSpy).toHaveBeenCalledWith(['/project', component.projectId(), 'tiles']);
});
```

Match the file's existing ActivatedRoute mocking pattern (it already fakes parent params — extend the same stub with a `params` subject emitting `{ tileId }`).

- [ ] **Step 2: Verify failure** — Run: `devbox run npm run test` — Expected: FAIL.

- [ ] **Step 3: Implement**

Routes:

```ts
export const TILE_MANAGER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tile-manager.component').then((m) => m.TileManagerComponent),
  },
  {
    path: ':tileId',
    loadComponent: () => import('./tile-manager.component').then((m) => m.TileManagerComponent),
  },
];
```

Component TS:

- Inject `private readonly router = inject(Router);` and subscribe in `ngOnInit`:

```ts
this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
  const raw = params['tileId'];
  if (raw === undefined || raw === null) return;
  const tileId = Number(raw);
  if (Number.isFinite(tileId) && tileId !== this.selectedTileId()) {
    void this.restoreSelection(tileId);
  }
});
```

- Add:

```ts
  /**
   * Restores the selected tile after navigation or refresh.
   * @param tileId - Tile id taken from the URL.
   */
  private async restoreSelection(tileId: number): Promise<void> {
    if (this.tiles().length === 0) await this.loadTiles();
    const exists = this.tiles().some((t) => t.id === tileId);
    if (!exists) {
      this.router.navigate(['/project', this.projectId(), 'tiles']);
      return;
    }
    await this.selectTile(tileId);
  }
```

- In `selectTile`, after the existing body succeeds, add navigation guarded against loops:

```ts
if (this.route.snapshot.paramMap.get('tileId') !== String(tileId)) {
  void this.router.navigate(['/project', this.projectId(), 'tiles', tileId]);
}
```

- In `deleteTile`, when the deleted tile was selected, after clearing selection add:

```ts
if (this.route.snapshot.paramMap.get('tileId') !== null) {
  void this.router.navigate(['/project', this.projectId(), 'tiles']);
}
```

- [ ] **Step 4: Verify pass** — Run: `devbox run npm run test` — Expected: PASS (loop guard keeps select→navigate→params→restore from re-triggering).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/tile-manager/
git commit -m "feat: keep selected tile in the URL"
```

---

### Task 9: Feature subfolders + governance rule

**Files:**

- Move: `src/app/features/sprite-editor/pixel-canvas.component.*` → `src/app/features/sprite-editor/canvas/`
- Move: `src/app/features/sprite-editor/palette-manager.component.*` → `src/app/features/sprite-editor/palette/`
- Move: `src/app/features/sprite-editor/drawing-tools.component.*` → `src/app/features/sprite-editor/tools/`
- Move: `src/app/features/tile-manager/tile-list.component.*` → `src/app/features/tile-manager/list/`
- Move: `src/app/features/tile-manager/tile-properties.component.*` → `src/app/features/tile-manager/properties/`
- Modify: `src/app/features/sprite-editor/sprite-editor.component.ts` (import paths), `src/app/features/tile-manager/tile-manager.component.ts` (import paths), any sibling spec importing moved files (grep first)
- Modify: `AGENTS.md` (flat-structure rule)

**Interfaces:**

- Consumes: finished Tasks 1–8 (no further functional edits after this point).
- Produces: layout required by the AGENTS.md rule text below; `services/` subfolders stay untouched.

- [ ] **Step 1: Move files with git mv**

```bash
mkdir -p src/app/features/sprite-editor/{canvas,palette,tools} \
         src/app/features/tile-manager/{list,properties}
git mv src/app/features/sprite-editor/pixel-canvas.component.ts \
       src/app/features/sprite-editor/canvas/pixel-canvas.component.ts
# …repeat for .html/.scss/.spec.ts of pixel-canvas, palette-manager, drawing-tools,
# and for tile-list + tile-properties (.ts/.html/.scss/.spec.ts each)
```

Relative imports INSIDE moved components (e.g. pixel-canvas has none outside models/services) — grep to be sure:

```bash
grep -rn "from '\.\./\|from '\./" src/app/features/sprite-editor/canvas src/app/features/sprite-editor/palette src/app/features/sprite-editor/tools src/app/features/tile-manager/list src/app/features/tile-manager/properties
```

Fix any broken relative path (they were siblings; now one level deeper: `'../services/...'` becomes `'../../services/...'`, shared models `'../../shared/...'` → `'../../../shared/...'`).

Update shell imports:

- `sprite-editor.component.ts`: `'./pixel-canvas.component'` → `'./canvas/pixel-canvas.component'`; `'./palette-manager.component'` → `'./palette/palette-manager.component'`; `'./drawing-tools.component'` → `'./tools/drawing-tools.component'`.
- `tile-manager.component.ts`: `'./tile-list.component'` → `'./list/tile-list.component'`; `'./tile-properties.component'` → `'./properties/tile-properties.component'`.

- [ ] **Step 2: Verify green**

Run: `devbox run npm run build && devbox run npm run test`
Expected: build succeeds, full suite PASSES (pure moves — zero behavior change).

- [ ] **Step 3: Replace the AGENTS.md rule**

In AGENTS.md, inside the `## Folder architecture` section, REPLACE the bullet:

```markdown
- `features/` should expose lazy-loaded routes and keep internal files private. Flat structure: no `pages/` or `components/` sub-folders inside a feature.
```

WITH:

```markdown
- `features/` should expose lazy-loaded routes and keep internal files private. Features organize children into subfolders that mirror their component hierarchy (e.g. `canvas/`, `palette/`, `tools/`, `list/`, `properties/`): each subfolder holds one component's `.ts`, `.html`, `.scss`, and `.spec.ts`. The feature root keeps the routes file, the shell component, and the feature's services. Small features (a single component) may stay flat.
```

Also update the ASCII tree in the same section if it contradicts (add `services/` + example child folders under `scene-editor/`-style entries ONLY if trivially accurate; otherwise leave the tree and rely on the rule text). Check `README.md` files inside `features/*` for outdated structure claims and fix wording if present.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: organize editor features into hierarchy-mirroring subfolders"
```

---

### Task 10: Final verification gates

**Files:**

- Possibly modified: any file failing `format:check` (formatting-only commit)

**Interfaces:** none.

- [ ] **Step 1: Gates**

```bash
devbox run npm run build     # expect success, budgets respected
devbox run npm run lint      # expect zero errors/warnings
devbox run npm run format:check
devbox run npm run test      # expect all suites pass
```

- [ ] **Step 2: Format fix if needed**

If `format:check` fails: `devbox run npm run format`, re-run `format:check` (expect exit 0), then:

```bash
git add -A
git commit -m "style: apply prettier across editor UX batch"
```

- [ ] **Step 3: Report**

Summarize gate outcomes (build size, lint result, test totals) for the controller report.

---

## Self-Review Notes (controller)

- Spec coverage: D1→T1/T2, D2→T9, D3→T3, D4→T4, D5→T5, D6→T6, D7→T7, D8→T8. Error-handling/testing/out-of-scope sections honored per task.
- Type consistency: `LospecPalette{id,name,colors}` defined T1, consumed T2; `createBlankFrame(projectId,tileId,name,w,h)` matches shipped `TileSpritesService`; `spriteGroups` shape fixed in T5 and referenced only there.
- Known risks flagged inline: `TileService.createTile` return type (T4 Step 3), spec-convention adaptation notes in T2/T3/T4/T8, Prettier reflow permitted everywhere wording is intact.
