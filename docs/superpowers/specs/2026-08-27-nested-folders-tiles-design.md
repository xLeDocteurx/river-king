# Nested Folders for Tiles

Date: 2026-08-27
Status: Draft

## Problem

Projects accumulate dozens of tiles. Today the tile-manager shows a flat list
(`tile-list.component`). Scenes already enjoy hierarchical organisation via
`folderPath` with drag-and-drop grouping in `scene-list.component`. Artists
expect the same capability for tiles: group by terrain, characters, UI, etc.,
and nest folders arbitrarily deep (`Backgrounds/Outdoor/Grass`,
`Characters/Enemies/Boss`).

## Solution

Add `folderPath` to the `Tile` model and replicate the scene-list pattern in
the tile manager: a grouped, collapsible, drag-and-drop tree with inline folder
management.

## Architecture

### 1. Data model

#### `src/app/shared/models/tile.model.ts`

Add optional `folderPath` to the `Tile` interface:

```ts
export interface Tile {
  id: number;
  projectId: string;
  name: string;
  type: 'static' | 'animated';
  animationSpeed: number;
  properties: TileProperties;
  spriteIds: number[];
  folderPath?: string; // NEW
}
```

Default value is `undefined` (treated as root / ungrouped).

#### IndexedDB migration (`database.service.ts`)

Bump the Dexie DB version from current (4) to **version 5**. Migration script:

```ts
this.version(5)
  .stores({
    tiles: '++id, projectId, folderPath',
    // …other stores unchanged (projects, scenes, sprites, sessions, folders)
  })
  .upgrade((tx) => {
    return tx
      .table('tiles')
      .toCollection()
      .modify((tile) => {
        tile.folderPath = '';
      });
  });
```

The `tiles` table index is updated from version 1's `'++id, projectId, name, type'`
to include `folderPath` so we can query efficiently by folder within a project.

> Dexie `stores()` declarations are **additive** — redeclaring a table in a new
> version overwrites its previous index definition for that version.

### 2. Service layer

#### `tile.service.ts`

- `getTiles(projectId)` already returns all tiles; no change required.
- Add `updateTileFolder(tileId: number, folderPath: string): Promise<void>`.
- Add `getFolders(projectId: string): Promise<TileFolder[]>` returning distinct
  folder paths for the project, sorted.

#### `tile-manager.component.ts`

Mirror `scene-editor.component.ts`:

- `folders = signal<string[]>([])`
- `loadFolders()` fetching distinct folder paths
- `onTileFolderChange({ tileId, folderPath })` handler calling
  `tileService.updateTileFolder()`

### 3. UI components

#### `tile-list.component.ts` → `tile-list-tree.component.ts` (new)

Rather than bolting drag-and-drop onto the flat list, we create a new
`TileListTreeComponent` that combines the current flat list behaviour with
grouped folder display. The old component can be deleted once the new one is
wired in.

**Responsibility**: render tiles grouped by `folderPath`, support:

- Collapsible folder headers (Material Symbols `expand_more` / `chevron_right`)
- Drag-and-drop of tiles between folders (CDK `CdkDropListGroup`,
  `CdkDropList`, `CdkDrag`) — reuse exact same imports as `scene-list.component.ts`
- Inline "New Folder" button that prompts for a path string
- Per-folder drop-zone when empty (same min-height guard as scene-list)

**Inputs**:

```ts
tiles = input.required<Tile[]>();
selectedTileId = input<number | null>(null);
collapsedFolders = input<string[]>([]); // folder paths currently collapsed
```

**Outputs**:

```ts
tileSelect = output<number>();
tileDelete = output<number>();
tileCreate = output<void>();
folderChange = output<{ tileId: number; folderPath: string }>();
toggleFolder = output<string>(); // toggles collapsed state
```

**Template structure**:

```html
<div cdkDropListGroup>
  <!-- Ungrouped / root tiles -->
  <div cdkDropList ...>@for (tile of rootTiles(); track tile.id) { … }</div>

  <!-- One section per folder -->
  @for (folder of folders(); track folder) {
  <div class="folder-header" (click)="toggleFolder.emit(folder)">
    <span class="material-symbols"
      >{{ isCollapsed(folder) ? 'chevron_right' : 'expand_more' }}</span
    >
    {{ folder }}
  </div>
  @if (!isCollapsed(folder)) {
  <div
    cdkDropList
    [cdkDropListData]="folderTiles(folder)"
    (cdkDropListDropped)="onDrop($event, folder)"
  >
    @for (tile of folderTiles(folder); track tile.id) { … }
  </div>
  } }
</div>
```

**SCSS**: Import the `.cdk-drag-preview` / `.cdk-drag-placeholder` rules from
`scene-list.component.scss`. Add folder-header styling (hover background, pointer
cursor, 11px uppercase label per design system).

### 4. State management

`tile-manager.component.ts` owns:

- `folders` signal (loaded from TileService)
- `collapsedFolders = signal<string[]>([])` — NOT persisted (simple runtime UX preference)
- Folder creation via a small inline prompt (no dialog needed: an input appears
  below the last folder, blur/Enter commits, Escape cancels)

## Drag-and-drop semantics

Identical to `scene-list.component.ts`:

- Drag a tile from one folder to another → emits `folderChange` with target path.
- Reorder within the same folder → also emits `folderChange` (with the same path)
  so parent can persist whatever ordering it chooses. For now we do NOT persist
  explicit ordering within a folder; tiles appear sorted by creation date / id.
- Empty-folder drop-zone has `min-height: 24px` so it remains a valid drop target.

## Testing

### `tile-list-tree.component.spec.ts` (new)

- Renders tiles grouped by folderPath.
- Root tiles shown when folderPath is empty/undefined.
- Clicking folder header toggles collapsed state.
- CDK drop event emits `folderChange` with correct tileId and target folder.
- Selection click emits `tileSelect`.

### `tile.service.spec.ts`

- `updateTileFolder` persists the new path.
- `getFolders` returns distinct sorted paths.

### `tile-manager.component.spec.ts`

- Folder creation flows: entering text and confirming creates a new folder.
- Moving a tile refreshes the list.

### `database.service.spec.ts`

- Migration to version 5 succeeds and adds `folderPath` default.

## Performance considerations

- `getFolders` uses Dexie's `toCollection().uniqueKeys()` or an explicit
  `groupBy` in JS. Dexie does not natively support `DISTINCT`, so we collect
  all tiles and derive unique folder paths in memory. Given a project has
  hundreds of tiles max, this is trivial.

## Out of scope

- Drag-and-drop of **folders** themselves (reordering folder hierarchy).
- Recursive sub-folder creation UI (folders are flat strings, not a tree widget).
- Folder renaming / deletion (can be added later via context menu).
- Persisting collapsed-folder state across sessions.
- Scene-editor tile palette also showing folders (the palette is meant for quick
  tile access, not organisation).
