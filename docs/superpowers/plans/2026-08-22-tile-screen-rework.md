# Tile Screen Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the tile screen per spec `docs/superpowers/specs/2026-08-22-tile-screen-design.md`: merge collision/solid into `blocking`, remove layer/eventScript, add an action registry + searchable dropdown, sprite thumbnails with frame lifecycle management, tile-unit size control with crop warning, sprite-editor focus mode, and real sprite previews in the scene editor map canvas.

**Architecture:** Dexie v3 in-place migration for tiles; pure-function migration helper for testability; pixel encode/decode utilities extracted to `shared/utils` so both features reuse them; frame/size orchestration lives in a new feature-private `TileSpritesService`; confirmations via existing shared `ConfirmDialogComponent`.

**Tech Stack:** Angular 22 standalone components (signals, OnPush), Dexie, fake-indexeddb, Vitest via `@angular/build:unit-test`, Tailwind v3 with `tw-` prefix.

## Global Constraints

- ALL commands run through devbox: `devbox run npm run test|lint|format|format:check`. Bare npm/node fails (WSL interop).
- Tests are Vitest under jsdom; add `import 'fake-indexeddb/auto';` at top of any spec touching DatabaseService; clear tables in `beforeEach`.
- jsdom has NO canvas `getContext` — code paths already guard for it; tests assert fallback behavior.
- Every component needs separate `.html`/`.scss` files (never inline templates); OnPush required for shared components.
- JSDoc on every public method/class/model property (`@param`, `@returns`).
- Shared components are headless: no hardcoded colors, accept `class` input.
- Commit messages: `feature-11-tile-screen-rework: <description>`.
- Branch: `feature-11-tile-screen-rework` (already checked out). NO merging.
- Run `devbox run npm run format` before each commit.
- Full suite currently: 21 files / 103 tests passing. Never regress below that count without replacing tests intentionally.

---

### Task 1: Game action registry

**Files:**
- Create: `src/app/core/actions/game-actions.ts`
- Test: `src/app/core/actions/game-actions.spec.ts`

**Interfaces:**
- Produces: `GAME_ACTIONS: Record<string, () => void>`, `listGameActions(): string[]`, `runGameAction(id: string): void`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from 'vitest/globals';
import { GAME_ACTIONS, listGameActions, runGameAction } from './game-actions';

describe('game-actions', () => {
  it('exposes the test action', () => {
    expect(listGameActions()).toContain('test');
    expect(typeof GAME_ACTIONS['test']).toBe('function');
  });

  it('runs a known action', () => {
    const spy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    runGameAction('test');
    expect(spy).toHaveBeenCalledWith('alert');
    spy.mockRestore();
  });

  it('no-ops on unknown action id', () => {
    expect(() => runGameAction('does-not-exist')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `devbox run npm run test`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
/** Handler signature for game actions triggered by interactable tiles. */
export type GameActionHandler = () => void;

/**
 * Registry mapping action ids to handlers. Tiles store only the id,
 * so new handler shapes can be introduced without data migrations.
 */
export const GAME_ACTIONS: Record<string, GameActionHandler> = {
  test: () => alert('alert'),
};

/**
 * Lists all registered action ids.
 * @returns Array of action ids in registration order.
 */
export function listGameActions(): string[] {
  return Object.keys(GAME_ACTIONS);
}

/**
 * Runs a registered action by id.
 * @param id - Action id stored on the tile.
 * No-op when the id is unknown so stale data cannot crash the runtime.
 */
export function runGameAction(id: string): void {
  GAME_ACTIONS[id]?.();
}
```

- [ ] **Step 4: Verify pass** — `devbox run npm run test` → PASS
- [ ] **Step 5: Format + commit**

```bash
devbox run npm run format
git add src/app/core/actions/
git commit -m "feature-11-tile-screen-rework: add game action registry"
```

---

### Task 2: TileProperties model + Dexie v3 migration + reference cleanup

**Files:**
- Modify: `src/app/shared/models/tile.model.ts`
- Modify: `src/app/core/services/database.service.ts`
- Modify: `src/app/features/tile-manager/services/tile.service.ts`
- Modify: `src/app/features/tile-manager/tile-properties.component.ts` (form fields only)
- Modify: `src/app/features/tile-manager/tile-properties.component.html` (remove old fields)
- Test: extend `src/app/core/services/database.service.spec.ts` if absent create it

**Interfaces:**
- Produces: `TileProperties { blocking: boolean; interactable: boolean; actionId?: string }`, exported pure `migrateTileProperties(oldProps): TileProperties`

- [ ] **Step 1: Failing migration tests**

```ts
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { DatabaseService, migrateTileProperties } from './database.service';

describe('DatabaseService v3 migration', () => {
  it('merges collision/solid into blocking', () => {
    expect(migrateTileProperties({ collision: true, solid: false, layer: 'background' })).toEqual({
      blocking: true,
      interactable: false,
      actionId: undefined,
    });
  });

  it('keeps interactable, drops eventScript/layer', () => {
    const result = migrateTileProperties({
      collision: false,
      solid: true,
      interactable: true,
      eventScript: 'x()',
      layer: 'foreground',
    });
    expect(result).toEqual({ blocking: true, interactable: true, actionId: undefined });
  });

  it('handles missing properties', () => {
    expect(migrateTileProperties(undefined)).toEqual({
      blocking: false,
      interactable: false,
      actionId: undefined,
    });
  });

  it('opens at version 3', async () => {
    TestBed.configureTestingModule({});
    const db = TestBed.inject(DatabaseService);
    expect(db.verno).toBe(3);
  });
});
```

- [ ] **Step 2: Verify fail** — migrateTileProperties not exported / verno mismatch.
- [ ] **Step 3: Implement model change**

```ts
// tile.model.ts — replace TileProperties entirely
export interface TileProperties {
  /** Blocks character movement across the tile. */
  blocking: boolean;
  /** Whether the tile triggers an action on interaction. */
  interactable: boolean;
  /** Key of the action in GAME_ACTIONS; undefined when not interactable. */
  actionId?: string;
}
```

- [ ] **Step 4: Migration in database.service.ts** (add after version(2) block):

```ts
this.version(3)
  .stores({ folders: 'id, projectId, path' })
  .upgrade(async (tx) => {
    await tx.table('tiles').toCollection().modify((tile: { properties?: Record<string, unknown> }) => {
      tile.properties = migrateTileProperties(tile.properties);
    });
  });
```

Exported above the class:

```ts
import type { TileProperties } from '../../shared/models/tile.model';

/**
 * Converts legacy tile properties (collision/solid/layer/eventScript) to v3 shape.
 * @param oldProps - Raw stored properties of unknown shape.
 * @returns Migrated TileProperties.
 */
export function migrateTileProperties(
  oldProps: Record<string, unknown> | undefined,
): TileProperties {
  return {
    blocking: Boolean(oldProps?.['collision'] || oldProps?.['solid']),
    interactable: Boolean(oldProps?.['interactable']),
    actionId: undefined,
  };
}
```

Note: keep `version(2)` untouched; v3 repeats the stores schema (Dexie requires it) — copy the v1 stores object plus folders line exactly as v2 declared them.

- [ ] **Step 5: Fix all compile fallout**
  - `tile.service.ts` createTile defaults → `properties: { blocking: false, interactable: false }`.
  - `tile-properties.component.ts`: form group becomes:

```ts
properties: this.fb.group({
  blocking: [false],
  interactable: [false],
}),
```

effect patchValue uses `t.properties.blocking` / `t.properties.interactable`; onSubmit builds `{ blocking: …, interactable: …, actionId: value.properties?.interactable ? undefined : undefined }` — for now always omit actionId (Task 6 adds the dropdown).
  - `tile-properties.component.html`: delete Collision/Solid/Layer/Event Script blocks (lines ~49–92), add single Blocking checkbox mirroring the old Collision markup (`formControlName="blocking"`, label "Blocking").
  - Grep sweep: `grep -rn "eventScript\|\blayer\b\|\.collision\|\.solid" src/ --include=*.ts --include=*.html` — fix every remaining reference (specs included) by porting expectations to the new shape.

- [ ] **Step 6: Verify** — `devbox run npm run test` all PASS (update any old assertions about removed fields).
- [ ] **Step 7: Format + commit**

```bash
git add -A
git commit -m "feature-11-tile-screen-rework: merge collision/solid into blocking, drop layer/eventScript, Dexie v3"
```

---

### Task 3: Pixel data utilities extraction

**Files:**
- Create: `src/app/shared/utils/pixel-data.ts`
- Create: `src/app/shared/utils/pixel-data.spec.ts`
- Modify: `src/app/features/sprite-editor/services/sprite.service.ts` (delegate)

**Interfaces:**
- Produces: `encodePixelData(indices, palette): string`, `decodePixelData(dataUri, palette, w, h): Promise<number[][]>`, `blankIndices(w, h): number[][]`, `cropOrPadIndices(indices, newW, newH): number[][]`

- [ ] **Step 1: Failing tests for NEW helpers** (encode/decode move with their existing sprite.service.spec cases — cut those two describe blocks from `sprite.service.spec.ts` into the new spec file unchanged, importing functions instead of service):

```ts
describe('blankIndices', () => {
  it('creates h rows of w zeros', () => {
    expect(blankIndices(2, 3)).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
  });
});

describe('cropOrPadIndices', () => {
  it('crops keeping the top-left region', () => {
    const src = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    expect(cropOrPadIndices(src, 2, 2)).toEqual([
      [1, 2],
      [4, 5],
    ]);
  });

  it('pads with zeros when growing', () => {
    expect(cropOrPadIndices([[1]], 2, 2)).toEqual([
      [1, 0],
      [0, 0],
    ]);
  });

  it('handles empty source', () => {
    expect(cropOrPadIndices([], 2, 2)).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});
```

- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** — move `encodePixelData`, `decodePixelData`, `normalizeColor` bodies verbatim from SpriteService into exported functions (drop `private`/`this.`); then:

```ts
/**
 * Creates a width×height grid filled with palette index 0 (transparent).
 */
export function blankIndices(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => Array<number>(width).fill(0));
}

/**
 * Resizes an index grid, anchoring content to the top-left corner.
 * Shrinking crops; growing pads with transparent index 0.
 */
export function cropOrPadIndices(
  indices: number[][],
  newWidth: number,
  newHeight: number,
): number[][] {
  const result = blankIndices(newWidth, newHeight);
  for (let y = 0; y < Math.min(newHeight, indices.length); y++) {
    const row = indices[y] ?? [];
    for (let x = 0; x < Math.min(newWidth, row.length); x++) {
      result[y][x] = row[x];
    }
  }
  return result;
}
```

- [ ] **Step 4: SpriteService delegates** — replace method bodies with one-line calls to the utils; delete its `normalizeColor`. Keep public signatures identical so callers don't change.
- [ ] **Step 5:** `devbox run npm run test` → PASS.
- [ ] **Step 6: Format + commit** — `feature-11-tile-screen-rework: extract pixel-data utilities to shared`

---

### Task 4: rk-searchable-select shared component

**Files:**
- Create: `src/app/shared/components/searchable-select/searchable-select.component.{ts,html,scss}`
- Test: `searchable-select.component.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: selector `rk-searchable-select`; inputs `options: string[]` (required), `value: string | null`, `placeholder: string` (default `'Select…'`), `class: string`; output `valueChange: string`

- [ ] **Step 1: Failing spec**

```ts
import { TestBed, fixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SearchableSelectComponent } from './searchable-select.component';

describe('SearchableSelectComponent', () => {
  async function setup(opts: Partial<{ options: string[]; value: string | null }> = {}) {
    await TestBed.configureTestingModule({ imports: [SearchableSelectComponent] }).compileComponents();
    const f = fixture(CreateHost);
  }
  // Use a host component pattern:
  it('renders all options when query is empty', () => { /* host with options ['walk','talk'] → list shows both */ });
  it('filters case-insensitively', () => { /* type 'TA' → only 'talk' */ });
  it('emits valueChange on option click and closes list', () => { /* click 'talk' → emitted 'talk', list hidden */ });
  it('Escape closes the list', () => { /* dispatch keydown.escape on input → open signal false */ });
});
```

Write these as concrete tests with a minimal host component defined in the spec file (`@Component({ imports: [SearchableSelectComponent], template: '<rk-searchable-select [options]="opts" (valueChange)="onValue($event)" />' })`) following the existing style in `scene-list.component.spec.ts`.

- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement**

```ts
import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Headless searchable dropdown: text input filters options case-insensitively;
 * clicking an option emits it. Escape or selection closes the list.
 * Styling is left to the consumer via the `class` input.
 */
@Component({
  selector: 'rk-searchable-select',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.scss',
})
export class SearchableSelectComponent {
  /** All selectable values. */
  options = input.required<string[]>();
  /** Currently selected value, or null. */
  value = input<string | null>(null);
  /** Placeholder shown in the filter input. */
  placeholder = input<string>('Select…');
  /** Consumer styling hook. */
  class = input<string>('');
  /** Emits the chosen option. */
  valueChange = output<string>();

  /** Filter text typed by the user. */
  query = signal('');
  /** Whether the option list is visible. */
  open = signal(false);

  /** Options filtered by the current query (case-insensitive substring). */
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const opts = this.options();
    return q ? opts.filter((o) => o.toLowerCase().includes(q)) : opts;
  });

  /**
   * Updates the query from the input event and opens the list.
   * @param event - Input event from the search field.
   */
  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.open.set(true);
  }

  /**
   * Selects an option, emits it, and closes the list.
   * @param option - Chosen value.
   */
  select(option: string): void {
    this.valueChange.emit(option);
    this.query.set(option);
    this.open.set(false);
  }

  /** Closes the list without changing the value. */
  close(): void {
    this.open.set(false);
  }
}
```

Template (`searchable-select.component.html`):

```html
<div class="tw-relative tw-flex tw-flex-col tw-gap-1" [class]="class()">
  <input
    type="text"
    [ngModel]="query()"
    (ngModelChange)="query.set($event)"
    (input)="onInput($event)"
    (focus)="open.set(true)"
    (keydown.escape)="close()"
    [placeholder]="placeholder()"
    class="tw-w-full tw-px-3 tw-py-2 tw-rounded-md tw-border tw-border-input tw-bg-background tw-text-foreground focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-ring"
    aria-label="Action"
  />
  @if (open()) {
    <ul
      role="listbox"
      class="tw-absolute tw-top-full tw-z-10 tw-mt-1 tw-max-h-48 tw-w-full tw-overflow-auto tw-rounded-md tw-border tw-border-border tw-bg-background tw-shadow-md"
    >
      @for (option of filtered(); track option) {
        <li>
          <button
            type="button"
            role="option"
            (click)="select(option)"
            class="tw-w-full tw-text-left tw-px-3 tw-py-1.5 tw-text-sm hover:tw-bg-muted"
          >
            {{ option }}
          </button>
        </li>
      } @empty {
        <li class="tw-px-3 tw-py-1.5 tw-text-sm tw-text-muted-foreground">No match</li>
      }
    </ul>
  }
</div>
```

SCSS: `:host { display: block; }` only.

- [ ] **Step 4:** tests PASS. Note jsdom quirk: `(focus)` won't auto-fire; tests call `open.set(true)` indirectly via dispatching `focusin` or invoke component methods directly — prefer dispatching real DOM events where possible.
- [ ] **Step 5: Format + commit** — `feature-11-tile-screen-rework: add headless searchable-select component`

---

### Task 5: TileSpritesService (frame lifecycle + resize)

**Files:**
- Create: `src/app/features/tile-manager/services/tile-sprites.service.ts`
- Test: `tile-sprites.service.spec.ts`

**Interfaces:**
- Consumes: Task 3 utils; DatabaseService tables
- Produces:
  - `getTileSprites(tileId): Promise<Sprite[]>` (sorted by id ascending)
  - `createBlankFrame(projectId: string, tileId: number, name: string, widthPx: number, heightPx: number): Promise<Sprite>`
  - `deleteSprites(ids: number[]): Promise<void>`
  - `resizeSprites(sprites: Sprite[], widthPx: number, heightPx: number, palette: string[]): Promise<void>` — crop/pad indices, re-encode pixelData, persist width/height

- [ ] **Step 1: Failing spec** using fake-indexeddb/auto pattern from scene.service.spec.ts (clear tiles+sprites in beforeEach). Cases:
  1. `getTileSprites` returns frames ordered by id.
  2. `createBlankFrame` persists sprite with given dims, zero-filled paletteIndices, tileId set.
  3. `deleteSprites` removes all listed ids.
  4. `resizeSprites` shrink: indices cropped top-left, width/height updated in DB (jsdom: encode returns MOCK fallback — assert paletteIndices shape, not PNG bytes).
  5. `resizeSprites` grow: padded with zeros.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement**

```ts
import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import { blankIndices, cropOrPadIndices, encodePixelData } from '../../../shared/utils/pixel-data';
import type { Sprite } from '../../../shared/models/sprite.model';

/**
 * Feature-private service managing the sprites linked to a tile:
 * frame listing/creation/deletion and multi-frame resizing.
 */
@Injectable()
export class TileSpritesService {
  private readonly db = inject(DatabaseService);

  /** Lists sprites of a tile sorted by creation order (id). */
  async getTileSprites(tileId: number): Promise<Sprite[]> {
    const sprites = await this.db.sprites.where('tileId').equals(tileId).toArray();
    return sprites.sort((a, b) => a.id - b.id);
  }

  /** Creates a blank fully-transparent frame for a tile. */
  async createBlankFrame(
    projectId: string,
    tileId: number,
    name: string,
    widthPx: number,
    heightPx: number,
  ): Promise<Sprite> {
    const sprite: Omit<Sprite, 'id'> = {
      projectId,
      tileId,
      name,
      width: widthPx,
      height: heightPx,
      pixelData: encodePixelData(blankIndices(widthPx, heightPx), []),
      paletteIndices: blankIndices(widthPx, heightPx),
    };
    const id = await this.db.sprites.add(sprite as Sprite);
    return { ...sprite, id };
  }

  /** Deletes the given sprites by id. */
  async deleteSprites(ids: number[]): Promise<void> {
    await this.db.sprites.bulkDelete(ids);
  }

  /** Resizes every sprite to the given pixel dimensions (top-left anchored crop/pad). */
  async resizeSprites(
    sprites: Sprite[],
    widthPx: number,
    heightPx: number,
    palette: string[],
  ): Promise<void> {
    for (const sprite of sprites) {
      const indices = cropOrPadIndices(sprite.paletteIndices ?? [], widthPx, heightPx);
      await this.db.sprites.update(sprite.id, {
        width: widthPx,
        height: heightPx,
        paletteIndices: indices,
        pixelData: encodePixelData(indices, palette),
      });
    }
  }
}
```

- [ ] **Step 4:** PASS. **Step 5: Format + commit** — `feature-11-tile-screen-rework: add TileSpritesService for frame lifecycle and resizing`

---

### Task 6: Tile properties rework (thumbnails, frames, size, actions)

**Files:**
- Rewrite: `src/app/features/tile-manager/tile-properties.component.{ts,html}`
- Append small additions to: `tile-properties.component.scss`
- Rewrite: `tile-properties.component.spec.ts`

**Interfaces:**
- Consumes: Tasks 1/3/4/5 outputs; ConfirmDialogComponent; NotificationService
- Produces inputs: `projectTileSize: number` (required), `projectPalette: string[]` (required), `tileSprites: Sprite[]` (required); outputs added: `navigateToSprite: number`, `tilesChanged: void` (save/delete unchanged)

- [ ] **Step 1: Failing spec** — rewrite spec covering:
  1. static tile renders one thumbnail img bound to first sprite pixelData; click emits navigateToSprite with its id.
  2. animated renders N thumbnails (N = tileSprites length).
  3. increasing frames creates blank frames and emits tilesChanged (spy/inject TileSpritesService provided in TestBed).
  4. decreasing frames opens confirmation dialog; confirmed → deletes extras + emits tilesChanged.
  5. animated→static with >1 frames triggers same confirmation.
  6. shrinking size opens crop dialog labeled "Crop"; confirmed → resizeSprites called with px dims; grow calls resizeSprites WITHOUT dialog.
  7. interactable unchecked hides dropdown & saves actionId undefined; checked shows dropdown; choosing 'test' saves actionId 'test'.
  8. unknown stored actionId displays "(action inconnue)" hint.
  9. form save emits tile with blocking (old collision/solid gone from DOM).
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement TS** — structure:

```ts
// New injections: TileSpritesService, NotificationService
// New signals:
frameCount = signal(1);
widthTiles = signal(1);
heightTiles = signal(1);
actionId = signal<string | null>(null);
interactableChecked = signal(false);
pendingFrameReduction = signal<number | null>(null); // target count awaiting confirm
pendingSizeShrink = signal<{ w: number; h: number } | null>(null);

// effects: sync frameCount/size/actionId/interactableChecked whenever tile()/tileSprites() changes;
// effects: pendingFrameReduction !== null → framesDialog().open(); pendingSizeShrink !== null → sizeDialog().open();

// Handlers:
async onTypeChange(type: string): Promise<void> // static↔animated rules per spec §frames
async onFrameCountInput(target: number): Promise<void> // grow→create blanks; shrink→set pendingFrameReduction
async confirmFrameReduction(): Promise<void> // delete extras via svc, updateTile spriteIds slice, tilesChanged.emit(), success toast
cancelFrameReduction(): void
requestSizeApply(): void // compare vs current first-sprite tiles dims; shrink→pendingSizeShrink; else applySize
async applySize(): Promise<void> // svc.resizeSprites(all frames, w*ts, h*ts, palette); toast 'Frames resized'; tilesChanged.emit()
openSprite(spriteId: number): void // navigateToSprite.emit(spriteId)
onSubmit(): void // as Task 2 but actionId: interactableChecked() ? (actionId() ?? undefined) : undefined

// Computed helpers:
readonly knownActions = listGameActions();
unknownActionHint = computed(() => /* '(action inconnue)' when set & !known */ null as string | null);
currentTiles = computed(() => { const s = this.tileSprites()[0]; ... derive w/h in tiles via projectTileSize })
```

Two dialog instances in template: `framesDialog` (data: title 'Delete Frames', message 'This will permanently delete N frame(s)...', confirmLabel 'Delete') and `sizeDialog` (confirmLabel 'Crop', message about cropping/content loss). Follow the viewChild+effect+signal pattern used in tile-manager.component.ts:64-78.

- [ ] **Step 4: Implement template order** per spec: Name → Type → type-dependent section → Animation Speed (animated only, `@if (form value type === 'animated')` — bind via `(change)="onTypeChange(...)"` on select + local signal `typeSelected`) → Size (two number inputs min="1" + Apply button) → Properties (Blocking checkbox, Interactable checkbox, `@if (interactableChecked()) { <rk-searchable-select [options]="knownActions" [value]="actionId()" (valueChange)="actionId.set($event)" /> {{ unknownActionHint() }} }`) → Save button. Thumbnails: `<img [src]="sprite.pixelData" class="tw-w-16 tw-h-16 tw-border tw-border-border tw-cursor-pointer" />` inside buttons emitting openSprite; dashed placeholder div when no sprite (`@empty` / length check).
- [ ] **Step 5:** PASS + `grep -rn "collision\|solid" src/app/features/tile-manager/` → no hits outside migration code.
- [ ] **Step 6: Format + commit** — `feature-11-tile-screen-rework: rework tile properties UI (thumbnails, frames, size, actions)`

---

### Task 7: Tile manager parent wiring

**Files:**
- Modify: `src/app/features/tile-manager/tile-manager.component.ts` (+providers `[TileService, TileSpritesService]`)
- Modify: `tile-manager.component.html` (bind new inputs/outputs on `<rk-tile-properties>`)
- Test: update `tile-manager.component.spec.ts`

**Interfaces:** consumes Task 5/6; adds `navigateToSprite` handling via `Router.navigate(['/project', projectId(), 'sprites', id])`; `tilesChanged` → reload selected tile + its sprites.

- [ ] **Step 1: Failing spec additions**: parent provides TileSpritesService; tilesChanged triggers selectedTile refresh; navigateToSprite navigates (provideRouter).
- [ ] **Step 2–4: Implement + verify** — template binding:

```html
<rk-tile-properties
  [tile]="selectedTile()!"
  [projectTileSize]="tileSize()"
  [projectPalette]="palette()"
  [tileSprites]="selectedTileSprites()"
  (save)="saveTile($event)"
  (delete)="requestDelete($event)"
  (tilesChanged)="refreshAfterTilesChanged()"
  (navigateToSprite)="openSpriteEditor($event)"
/>
```

New in TS: `tileSize = signal(16)` loaded with projectId via ProjectService.getById (same call pattern as sprite-editor loadProjectPalette); `palette` signal likewise; `selectedTileSprites = signal<Sprite[]>([])` refreshed in selectTile/saveTile/refreshAfterTilesChanged via TileSpritesService.getTileSprites(tileId); `openSpriteEditor(id){ router.navigate(['/project', this.projectId(), 'sprites', id]); }`.

- [ ] **Step 5: Format + commit** — `feature-11-tile-screen-rework: wire tile manager to sprite frame operations and navigation`

---

### Task 8: Sprite editor focus mode

**Files:**
- Modify: `src/app/features/sprite-editor/sprite-editor.routes.ts` (add child route)
- Modify: `sprite-editor.component.ts` + `.html` + `.scss`
- Test: extend `sprite-editor.component.spec.ts`

**Interfaces:** route `/project/:id/sprites/:spriteId` → same component; `focusMode()` true hides sidebar; back button → `/project/:id/tiles`.

- [ ] **Step 1: Failing specs**: with `:spriteId` param sidebar hidden + requested sprite selected; without param unchanged; unknown id → error toast + redirect to tiles.
- [ ] **Step 2–4: Implement + verify**

Routes:

```ts
export const SPRITE_EDITOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./sprite-editor.component').then((m) => m.SpriteEditorComponent),
  },
  {
    path: ':spriteId',
    loadComponent: () => import('./sprite-editor.component').then((m) => m.SpriteEditorComponent),
  },
];
```

TS: `focusMode = signal(false); private readonly router = inject(Router);`
Project id resolution must survive the extra nesting — replace `route.parent?.params` subscription with:

```ts
const projectRoute = this.route.pathFromRoot.find((r) => r.snapshot.paramMap.has('id'));
projectRoute?.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((pm) => { ... });
this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (pm) => {
  const raw = pm.get('spriteId');
  if (raw === null) { this.focusMode.set(false); return; }
  this.focusMode.set(true);
  await this.loadSprites();
  const sprite = await this.spriteService.getSprite(Number(raw));
  if (!sprite) { this.notification.error('Sprite not found'); this.backToTiles(); return; }
  await this.selectSprite(sprite.id);
});
backToTiles(): void { this.router.navigate(['/project', this.projectId(), 'tiles']); }
```

HTML: wrap sidebar block (lines 2–42) in `@if (!focusMode()) { … }`; inside center column prepend when focusMode:

```html
@if (focusMode()) {
  <div class="tw-flex tw-items-center tw-gap-2">
    <button type="button" (click)="backToTiles()" class="tw-flex tw-items-center tw-gap-1 tw-px-3 tw-py-1.5 tw-rounded-md hover:tw-bg-muted">
      <span class="material-symbols" aria-hidden="true">arrow_back</span>
      Back to tiles
    </button>
    <h2 class="tw-font-semibold">{{ selectedSprite()?.name }}</h2>
  </div>
}
```

- [ ] **Step 5: Format + commit** — `feature-11-tile-screen-rework: add sprite editor focus mode via :spriteId route`

---

### Task 9: Real tile previews in scene editor map canvas

**Files:**
- Create: `src/app/features/scene-editor/services/map-tiles.service.ts` (+spec)
- Modify: `map-canvas.component.ts` (+spec additions), `.ts` render loop lines ~104–107 & getTileColor (~135–139)
- Modify: `scene-editor.component.ts`/`.html` (load + pass `tileImages`)

**Interfaces:** `MapTilesService.getTileImages(tileData: number[][]): Promise<Record<number, string>>` — unique ids ≥0 → first sprite's pixelData; MapCanvas new input `tileImages: Record<number, string>`.

- [ ] **Step 1: Failing specs**: service maps tileIds→first sprite pixelData, skips ids without tile/sprite; canvas builds HTMLImageElement cache keyed by tileId and sets src from tileImages; render skips unloaded ids (jsdom-safe assertions: cache size / src values / no throw).
- [ ] **Step 2–4: Implement + verify**

Service:

```ts
@Injectable()
export class MapTilesService {
  private readonly db = inject(DatabaseService);

  /** Maps every tile id present in tileData to its first frame's pixelData. */
  async getTileImages(tileData: number[][]): Promise<Record<number, string>> {
    const ids = [...new Set(tileData.flat().filter((id) => id >= 0))];
    const result: Record<number, string> = {};
    for (const id of ids) {
      const tile = await this.db.tiles.get(id);
      if (!tile || tile.spriteIds.length === 0) continue;
      const sprite = await this.db.sprites.get(tile.spriteIds[0]);
      if (sprite) result[id] = sprite.pixelData;
    }
    return result;
  }
}
```

Canvas: add `tileImages = input<Record<number, string>>({});` + `private images = new Map<number, HTMLImageElement>();`; effect on `tileImages()` → for each entry create Image, set src, onload → render(); entries absent → images.delete(id). Render loop replaces fillStyle/getTileColor branch with:

```ts
if (tileId >= 0) {
  const img = this.images.get(tileId);
  if (img?.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
  }
}
```

Delete `getTileColor` + its `palette` usage for tiles (keep `palette` input if used elsewhere — check references first). Scene editor: inject MapTilesService, load after scene fetch: `this.tileImages.set(await mapTiles.getTileImages(scene.tileData))`, bind `(tilePlaced)` flow already refreshes? ensure placed tiles appear: after emit handler saves tileData, also reload tileImages.

- [ ] **Step 5: Format + commit** — `feature-11-tile-screen-rework: render real sprite previews in map canvas`

---

### Task 10: Final verification

- [ ] `devbox run npm run format`
- [ ] `devbox run npm run lint` → clean
- [ ] `devbox run npm run test` → all files pass, count ≥ previous + new tests
- [ ] `devbox run npm run build` → succeeds within budgets
- [ ] `git status` clean; summarize commits created for morning review
