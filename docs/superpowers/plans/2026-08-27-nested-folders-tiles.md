# Nested Folders for Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hierarchical folder organisation to the tile manager, matching the
scene-list pattern: grouped display, drag-and-drop between folders, inline folder
creation.

**Architecture:** Add optional `folderPath` to `Tile` model, bump IndexedDB to
version 5 with default migration, extend `TileService` with folder helpers,
replace `tile-list.component` with a new grouped tree component using CDK
drag-and-drop.

**Tech Stack:** Angular 22, Dexie (IndexedDB), Angular CDK drag-drop (already in
project via `@angular/cdk`), signals.

## Global Constraints

- Standalone components only; no `NgModule`.
- `ChangeDetectionStrategy.OnPush` required.
- Tailwind CSS with `tw-` prefix.
- Unit tests via Vitest + jsdom.
- No raw hex/rgb/hsl — Tailwind theme tokens only.
- English UI copy only.
- Component selector prefix `rk-`.

---

## Task 1: DB migration + Tile model update

**Files:**

- Modify: `src/app/shared/models/tile.model.ts`
- Modify: `src/app/core/services/database.service.ts`
- Test: `src/app/core/services/database.service.spec.ts`

**Interfaces:**

- Consumes: existing `Tile` interface
- Produces: `Tile` with optional `folderPath`; DB version 5 migration.

- [ ] **Step 1: Write failing test — DB opens at version 5**

In `database.service.spec.ts`, add:

```ts
it('opens at version 5 and tiles have folderPath default', async () => {
  const db = new DatabaseService();
  await db.init();
  expect(db.db.verno).toBe(5);
  const tile = await db.tiles.add({
    projectId: 'p1',
    name: 'Grass',
    type: 'static',
    animationSpeed: 1,
    properties: {},
    spriteIds: [],
  });
  const fetched = await db.tiles.get(tile);
  expect(fetched?.folderPath).toBe('');
});
```

- [ ] **Step 2: Run test → FAIL** (version is still 3)

Run:

```bash
devbox run npx vitest run src/app/core/services/database.service.spec.ts -t "version 5"
```

Expected: FAIL — `db.verno` is 4.

- [ ] **Step 3: Update Tile model**

In `src/app/shared/models/tile.model.ts`, add to `Tile` interface:

```ts
folderPath?: string;
```

- [ ] **Step 4: Bump DB version + add migration**

In `src/app/core/services/database.service.ts`, in the constructor / Dexie
setup where versions are declared:

```ts
this.version(5)
  .stores({
    tiles: '++id, projectId, folderPath',
    // …other stores inherited from previous versions unchanged
  })
  .upgrade(async (tx) => {
    await tx
      .table('tiles')
      .toCollection()
      .modify((tile: any) => {
        tile.folderPath = '';
      });
  });
```

> ⚠️ Make sure the version 3 declaration `this.version(3)` is kept above; Dexie
> chains versions. The project test already asserts version 3 opens correctly.

- [ ] **Step 5: Run DB test → PASS**

Run the test from Step 1 again.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/models/tile.model.ts src/app/core/services/database.service.ts
git commit -m "feat: add folderPath to Tile model and migrate DB to version 5"
```

---

## Task 2: TileService helpers

**Files:**

- Modify: `src/app/features/tile-manager/services/tile.service.ts`
- Test: `src/app/features/tile-manager/services/tile.service.spec.ts`

**Interfaces:**

- Consumes: DB version 5 with `folderPath` on tiles.
- Produces: `updateTileFolder()`, `getFolders()`.

- [ ] **Step 1: Write failing test — updateTileFolder persists path**

In `tile.service.spec.ts`:

```ts
it('updateTileFolder sets folderPath', async () => {
  const tile = await service.createTile('p1', 'Test');
  await service.updateTileFolder(tile.id, 'Terrain/Grass');
  const updated = await service.getTile(tile.id);
  expect(updated?.folderPath).toBe('Terrain/Grass');
});

it('getFolders returns distinct sorted folder paths', async () => {
  await service.createTile('p1', 'A');
  const t2 = await service.createTile('p1', 'B');
  await service.updateTileFolder(t2.id, 'UI/Buttons');
  const t3 = await service.createTile('p1', 'C');
  await service.updateTileFolder(t3.id, 'UI/Buttons');
  const folders = await service.getFolders('p1');
  expect(folders).toEqual(['', 'UI/Buttons']);
});
```

- [ ] **Step 2: Run tests → FAIL** (methods don't exist)

```bash
devbox run npx vitest run src/app/features/tile-manager/services/tile.service.spec.ts -t "updateTileFolder\|getFolders"
```

Expected: FAIL.

- [ ] **Step 3: Implement methods**

In `tile.service.ts`:

```ts
/**
 * Updates a tile's folder path.
 * @param tileId The tile to move.
 * @param folderPath The new folder path (empty string = root).
 */
async updateTileFolder(tileId: number, folderPath: string): Promise<void> {
  await this.db.tiles.update(tileId, { folderPath });
}

/**
 * Returns distinct, sorted folder paths for a project.
 * @param projectId The project to query.
 */
async getFolders(projectId: string): Promise<string[]> {
  const tiles = await this.db.tiles.where('projectId').equals(projectId).toArray();
  const paths = new Set(tiles.map(t => t.folderPath ?? ''));
  return Array.from(paths).sort((a, b) => a.localeCompare(b));
}
```

- [ ] **Step 4: Run tests → PASS**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/tile-manager/services/
git commit -m "feat: TileService folder helpers updateTileFolder and getFolders"
```

---

## Task 3: Tile-list-tree component

**Files:**

- Create: `src/app/features/tile-manager/list/tile-list-tree.component.ts`
- Create: `src/app/features/tile-manager/list/tile-list-tree.component.html`
- Create: `src/app/features/tile-manager/list/tile-list-tree.component.scss`
- Create: `src/app/features/tile-manager/list/tile-list-tree.component.spec.ts`
- Modify: `src/app/features/tile-manager/tile-manager.component.ts`
- Modify: `src/app/features/tile-manager/tile-manager.component.html`
- Delete (eventually): `src/app/features/tile-manager/list/tile-list.component.ts` + html + scss + spec

**Interfaces:**

- Consumes: `Tile[]`, `selectedTileId`, folder paths, collapsed state.
- Produces: `tileSelect`, `tileDelete`, `tileCreate`, `folderChange`, `toggleFolder`.

- [ ] **Step 1: Write failing test — tile-list-tree renders grouped tiles**

Create `tile-list-tree.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TileListTreeComponent } from './tile-list-tree.component';
import { CdkDropList, CdkDrag, CdkDropListGroup } from '@angular/cdk/drag-drop';

describe('TileListTreeComponent', () => {
  let component: TileListTreeComponent;
  let fixture: ComponentFixture<TileListTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TileListTreeComponent, CdkDropListGroup, CdkDropList, CdkDrag],
    }).compileComponents();
    fixture = TestBed.createComponent(TileListTreeComponent);
    component = fixture.componentInstance;
  });

  it('should emit tileSelect on click', () => {
    const spy = jest.spyOn(component.tileSelect, 'emit');
    component.tiles.set([
      {
        id: 1,
        name: 'Grass',
        projectId: 'p1',
        type: 'static',
        animationSpeed: 1,
        properties: {},
        spriteIds: [],
      },
    ]);
    fixture.detectChanges();
    // trigger click via emitted output directly — no DOM click in jsdom needed
    component.tileSelect.emit(1);
    expect(spy).toHaveBeenCalledWith(1);
  });
});
```

Run: `devbox run npx vitest run src/app/features/tile-manager/list/tile-list-tree.component.spec.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 2: Generate component scaffold**

Use Angular CLI (or manual files):

```bash
./node_modules/.bin/ng.js generate component features/tile-manager/list/tile-list-tree --prefix rk --skip-tests
```

Then delete the inline-template generated file; we'll write separate template
and style files per project convention.

- [ ] **Step 3: Implement TS + template + styles**

**`tile-list-tree.component.ts`** (standalone, OnPush):

```ts
import { Component, input, output, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CdkDropListGroup, CdkDropList, CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';
import type { Tile } from '../../../shared/models/tile.model';

@Component({
  selector: 'rk-tile-list-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag],
  templateUrl: './tile-list-tree.component.html',
  styleUrl: './tile-list-tree.component.scss',
})
export class TileListTreeComponent {
  tiles = input.required<Tile[]>();
  selectedTileId = input<number | null>(null);
  collapsedFolders = input<string[]>([]);

  tileSelect = output<number>();
  tileDelete = output<number>();
  tileCreate = output<void>();
  folderChange = output<{ tileId: number; folderPath: string }>();
  toggleFolder = output<string>();

  readonly rootTiles = computed(() => this.tiles().filter((t) => !t.folderPath));
  readonly folderGroups = computed(() => {
    const groups = new Map<string, Tile[]>();
    for (const tile of this.tiles()) {
      if (!tile.folderPath) continue;
      const list = groups.get(tile.folderPath) ?? [];
      list.push(tile);
      groups.set(tile.folderPath, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  onDrop(event: CdkDragDrop<Tile[]>, targetFolderPath: string): void {
    const tile = event.item.data as Tile;
    if (tile.folderPath !== targetFolderPath) {
      this.folderChange.emit({ tileId: tile.id, folderPath: targetFolderPath });
    }
  }
}
```

**`tile-list-tree.component.html`:**

```html
<div class="tw-flex tw-flex-col tw-h-full tw-bg-card-bg">
  <div
    class="tw-flex tw-items-center tw-justify-between tw-px-3 tw-py-2 tw-border-b tw-border-border"
  >
    <h3 class="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground">
      Tiles
    </h3>
    <div class="tw-flex tw-items-center tw-gap-1">
      <button
        type="button"
        (click)="tileCreate.emit()"
        class="tw-p-1 tw-rounded-sm hover:tw-bg-muted"
        title="New Tile"
      >
        <span class="material-symbols" aria-hidden="true">add</span>
      </button>
    </div>
  </div>

  <div class="tw-flex-1 tw-overflow-auto tw-p-2" cdkDropListGroup>
    <!-- Root / ungrouped -->
    <div
      cdkDropList
      [cdkDropListData]="rootTiles()"
      (cdkDropListDropped)="onDrop($event, '')"
      class="tw-min-h-[24px]"
    >
      @for (tile of rootTiles(); track tile.id) {
      <div cdkDrag [cdkDragData]="tile" class="tw-w-full tw-flex tw-items-center tw-gap-1">
        <button
          type="button"
          (click)="tileSelect.emit(tile.id)"
          [class.tw-bg-primary/10]="selectedTileId() === tile.id"
          class="tw-flex-1 tw-min-w-0 tw-text-left tw-px-2 tw-py-1.5 tw-rounded-sm tw-text-xs tw-text-foreground hover:tw-bg-muted tw-flex tw-items-center tw-gap-2"
        >
          <span class="material-symbols tw-text-muted-foreground" aria-hidden="true"
            >grid_view</span
          >
          <span class="tw-truncate">{{ tile.name }}</span>
        </button>
        <button
          type="button"
          (click)="tileDelete.emit(tile.id); $event.stopPropagation()"
          class="tw-p-1 tw-rounded-sm tw-shrink-0 tw-text-muted-foreground hover:tw-text-destructive hover:tw-bg-muted"
        >
          <span class="material-symbols tw-text-sm" aria-hidden="true">delete</span>
        </button>
      </div>
      }
    </div>

    <!-- Folder groups -->
    @for (group of folderGroups(); track group[0]) {
    <div class="tw-mt-2">
      <button
        type="button"
        (click)="toggleFolder.emit(group[0])"
        class="tw-flex tw-items-center tw-gap-1 tw-px-2 tw-py-1 tw-rounded-sm tw-text-[11px] tw-text-muted-foreground hover:tw-bg-muted tw-w-full tw-text-left"
      >
        <span class="material-symbols tw-text-sm" aria-hidden="true"
          >{{ collapsedFolders().includes(group[0]) ? 'chevron_right' : 'expand_more' }}</span
        >
        <span class="tw-truncate">{{ group[0] }}</span>
      </button>

      @if (!collapsedFolders().includes(group[0])) {
      <div
        cdkDropList
        [cdkDropListData]="group[1]"
        (cdkDropListDropped)="onDrop($event, group[0])"
        class="tw-min-h-[24px] tw-pl-4"
      >
        @for (tile of folderTiles; track tile.id) {
        <div cdkDrag [cdkDragData]="tile" class="tw-w-full tw-flex tw-items-center tw-gap-1">
          <button
            type="button"
            (click)="tileSelect.emit(tile.id)"
            [class.tw-bg-primary/10]="selectedTileId() === tile.id"
            class="tw-flex-1 tw-min-w-0 tw-text-left tw-px-2 tw-py-1.5 tw-rounded-sm tw-text-xs tw-text-foreground hover:tw-bg-muted tw-flex tw-items-center tw-gap-2"
          >
            <span class="material-symbols tw-text-muted-foreground" aria-hidden="true"
              >grid_view</span
            >
            <span class="tw-truncate">{{ tile.name }}</span>
          </button>
          <button
            type="button"
            (click)="tileDelete.emit(tile.id); $event.stopPropagation()"
            class="tw-p-1 tw-rounded-sm tw-shrink-0 tw-text-muted-foreground hover:tw-text-destructive hover:tw-bg-muted"
          >
            <span class="material-symbols tw-text-sm" aria-hidden="true">delete</span>
          </button>
        </div>
        }
      </div>
      }
    </div>
    }
  </div>
</div>
```

**`tile-list-tree.component.scss`:**

```scss
@import '../../../../styles/theme.scss';

.cdk-drag-preview {
  opacity: 0.9;
  outline: 1px solid var(--border);
  border-radius: 0.125rem;
}

.cdk-drag-placeholder {
  opacity: 0.3;
}
```

- [ ] **Step 4: Wire into tile-manager component + template**

In `tile-manager.component.ts`:

- Replace `TileListComponent` import with `TileListTreeComponent`.
- Add `folders = signal<string[]>([])`.
- Add `collapsedFolders = signal<string[]>([])`.
- Add `async loadFolders()` calling `tileService.getFolders(this.projectId())`.
- Add `onTileFolderChange(event: { tileId: number; folderPath: string })` handler:
  ```ts
  async onTileFolderChange(event: { tileId: number; folderPath: string }): Promise<void> {
    try {
      await this.tileService.updateTileFolder(event.tileId, event.folderPath);
      await this.loadTiles();
      await this.loadFolders();
    } catch (e) {
      console.error('Failed to move tile:', e);
      this.notification.error('Failed to move tile');
    }
  }
  ```
- Add `toggleFolder(path: string)` that adds/removes path from `collapsedFolders`.
- Call `loadFolders()` inside `ngOnInit` after `loadProject()`.

In `tile-manager.component.html`:

- Replace `<rk-tile-list>` with `<rk-tile-list-tree>` wiring all new outputs.

After wiring, delete the old `tile-list.component` files (ts, html, scss, spec) or
leave them for a cleanup pass.

- [ ] **Step 5: Run tile-list-tree tests → PASS**

```bash
devbox run npx vitest run src/app/features/tile-manager/list/tile-list-tree.component.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/tile-manager/
git commit -m "feat: tile-list-tree component with folder grouping and CDK drag-drop"
```

---

## Task 4: Inline folder creation

**Files:**

- Modify: `src/app/features/tile-manager/tile-manager.component.ts`
- Modify: `src/app/features/tile-manager/tile-manager.component.html`

- [ ] **Step 1: Add folder creation UI**

In `tile-manager.component.ts`:

```ts
readonly newFolderInputVisible = signal(false);
readonly newFolderPath = signal('');

showNewFolderInput(): void {
  this.newFolderInputVisible.set(true);
}

async confirmNewFolder(): Promise<void> {
  const path = this.newFolderPath().trim();
  if (!path) { this.newFolderInputVisible.set(false); return; }
  // No DB table for folders — just add to local signal list
  this.folders.update(list => [...list, path].sort((a, b) => a.localeCompare(b)));
  this.newFolderPath.set('');
  this.newFolderInputVisible.set(false);
}

cancelNewFolder(): void {
  this.newFolderInputVisible.set(false);
  this.newFolderPath.set('');
}
```

In `tile-manager.component.html`, above or inside the `<rk-tile-list-tree>`
section, add a "New Folder" quick input:

```html
@if (newFolderInputVisible()) {
<div class="tw-flex tw-items-center tw-gap-1 tw-px-3 tw-py-1 tw-border-b tw-border-border">
  <input
    type="text"
    [(ngModel)]="newFolderPath"
    placeholder="Folder path (e.g. UI/Buttons)"
    class="tw-flex-1 tw-px-2 tw-py-1 tw-rounded-sm tw-border tw-border-input tw-bg-background tw-text-xs tw-text-foreground"
    (keydown.enter)="confirmNewFolder()"
    (keydown.escape)="cancelNewFolder()"
  />
  <button type="button" (click)="confirmNewFolder()" class="tw-p-1 tw-rounded-sm hover:tw-bg-muted">
    <span class="material-symbols" aria-hidden="true">check</span>
  </button>
  <button type="button" (click)="cancelNewFolder()" class="tw-p-1 tw-rounded-sm hover:tw-bg-muted">
    <span class="material-symbols" aria-hidden="true">close</span>
  </button>
</div>
}
```

> This requires `FormsModule` or `ReactiveFormsModule` import in
> `tile-manager.component.ts`. Since the project prefers signals and we only need
> a simple text input, either use `(input)` + manual binding with a signal, or
> import `FormsModule`. To avoid adding a new module import just for one input,
> prefer the signal manual binding:

```html
<input [value]="newFolderPath()" (input)="newFolderPath.set($any($event.target).value)" … />
```

- [ ] **Step 2: Add a "New Folder" button in tile-list-tree**

In `tile-list-tree.component.html`, add next to the "New Tile" button:

```html
<button
  type="button"
  (click)="createFolder.emit()"
  class="tw-p-1 tw-rounded-sm hover:tw-bg-muted"
  title="New Folder"
>
  <span class="material-symbols" aria-hidden="true">create_new_folder</span>
</button>
```

Add `createFolder = output<void>()` to `TileListTreeComponent`.

Wire in `tile-manager.component.html`: `(createFolder)="showNewFolderInput()"`.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/tile-manager/
git commit -m "feat: inline folder creation in tile manager"
```

---

## Task 5: Lint + build + full test verification

- [ ] **Step 1: Run lint**

```bash
devbox run npm run lint
```

Expected: All files pass.

- [ ] **Step 2: Run build**

```bash
devbox run npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Run full test suite**

```bash
devbox run npm run test
```

Expected: No new failures introduced.

- [ ] **Step 4: Final commit (if lint fixes)**

```bash
git add …
git commit -m "chore: lint fixes for tile manager folders"
```
