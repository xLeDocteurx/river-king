# Folder Smart Folding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a list has more than 6 top-level folders, folders collapse by default, while user-touched folders stay expanded and manual collapse/expand overrides are persisted in IndexedDB — applied identically to the scene list and the tile tree.

**Architecture:** Extend the unified `Folder` model with `kind: 'scene' | 'tile'`, `collapsed`, `lastOpenedAt` (schema v6). The fold rule lives in a pure helper `computeCollapsedKeys()` in `shared/models/folder.model.ts`. `DatabaseService` gains 4 generic kind-scoped row operations; `SceneService` and `TileService` delegate to them. The feature shells (`SceneEditorComponent`, `TileManagerComponent`) load folder rows into a signal, compute the collapsed set reactively, and persist on toggle; the two list components stay dumb (collapsed set is an input, toggle is an output). Tile folder rows are materialized lazily on first interaction (toggle or tile selection) instead of pre-writing a row per derived path.

**Tech Stack:** Angular 22 standalone, Dexie/IndexedDB, Signals (`signal`/`computed`/`input`/`output`), Vitest (via `@angular/build:unit-test`), Tailwind prefix `tw-`, Material Symbols.

## Global Constraints

- Schema version must move from 5 to 6. The `folders` store becomes `'id, projectId, path, kind'`.
- Folder fold threshold is a fixed exported constant `FOLDER_FOLD_THRESHOLD = 6`. No user-facing setting.
- Rule (finalized from spec §Shared folding logic): a path is collapsed when (a) its row has `collapsed === true`, OR (b) it is not "untouched" by being un-touched — precisely: collapse when there is no row with `lastOpenedAt > 0` AND `topLevelCount > threshold`. Root (`path === ''`) is never folded.
- `topLevelCount` = number of distinct first segments among non-empty folder paths.
- `core/` must not runtime-import `shared/`; `database.service.ts` already type-imports `Folder`. Translate `rewriteFolderPath` inline inside `DatabaseService.renameFoldersOfKind` (3 lines) instead of importing it.
- All public methods/classes get JSDoc (AGENTS.md). No inline templates. Tailwind prefix `tw-`.
- Commit messages start with `feature-17: `. Branch is already `feature-17`.
- Run commands via `devbox run …`. Test command: `devbox run npm run test` (adds `-- --include <glob>` to run a subset; fall back to the full suite if a subset is rejected).
- UI copy is English only.

---

### Task 1: Folder model — `FolderKind`, new fields, threshold constant, `computeCollapsedKeys`

**Files:**
- Modify: `src/app/shared/models/folder.model.ts`
- Test: `src/app/shared/models/folder.model.spec.ts` (new)

**Interfaces:**
- Produces (consumed by every later task):
  - `export type FolderKind = 'scene' | 'tile';`
  - `export interface Folder { id: string; projectId: string; path: string; kind: FolderKind; collapsed: boolean; lastOpenedAt: number; }`
  - `export const FOLDER_FOLD_THRESHOLD = 6;`
  - `export function computeCollapsedKeys(rows: Pick<Folder, 'path' | 'collapsed' | 'lastOpenedAt'>[], paths: string[], threshold?: number): string[]`

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/models/folder.model.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeCollapsedKeys, FOLDER_FOLD_THRESHOLD } from './folder.model';

describe('computeCollapsedKeys', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const six = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('collapses every folder by default when top-level count exceeds the threshold', () => {
    expect(computeCollapsedKeys([], seven)).toEqual(seven);
  });

  it('leaves everything expanded at or below the threshold', () => {
    expect(computeCollapsedKeys([], six)).toEqual([]);
  });

  it('never folds the ungrouped root', () => {
    const paths = ['', ...seven];
    expect(computeCollapsedKeys([], paths)).toEqual(seven);
  });

  it('keeps touched folders (lastOpenedAt > 0) expanded above the threshold', () => {
    const rows = [{ path: 'a', collapsed: false, lastOpenedAt: 123 }];
    expect(computeCollapsedKeys(rows, seven)).not.toContain('a');
    expect(computeCollapsedKeys(rows, seven)).toContain('b');
  });

  it('explicit collapsed state wins even below the threshold', () => {
    const rows = [{ path: 'c', collapsed: true, lastOpenedAt: 0 }];
    expect(computeCollapsedKeys(rows, six)).toEqual(['c']);
  });

  it('explicit collapsed state wins over a recent lastOpenedAt', () => {
    const rows = [{ path: 'a', collapsed: true, lastOpenedAt: 999 }];
    expect(computeCollapsedKeys(rows, seven)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('counts distinct top-level segments, so nested keys do not inflate the count', () => {
    // 6 distinct top-levels ('props','forest','mountain','swamp','town','castle') -> not > 6 -> expanded
    const paths = ['props', 'forest/caves', 'mountain/lava', 'swamp', 'town', 'castle'];
    expect(computeCollapsedKeys([], paths)).toEqual([]);
  });

  it('exposes the default threshold constant', () => {
    expect(FOLDER_FOLD_THRESHOLD).toBe(6);
  });
});
```

Wait — one expectation above is wrong for the "recent lastOpenedAt + collapsed" case. If the user explicitly collapsed 'a', that collapses only 'a', while b..g still follow the default (above threshold) rule and collapse too, so `expect(computeCollapsedKeys(rows, seven)).toEqual(seven)` is correct. Fix the assertion in the test file to `toEqual(seven)` and continue.

- [ ] **Step 2: Run the test to verify it fails**

Run: `devbox run npm run test -- --include src/app/shared/models/folder.model.spec.ts`
Expected: FAIL — `computeCollapsedKeys` / `FOLDER_FOLD_THRESHOLD` not exported.

- [ ] **Step 3: Write the minimal implementation**

Modify `src/app/shared/models/folder.model.ts` to read:

```ts
/**
 * Which folder-based list a folder row belongs to. Scene folders and tile
 * folders sharing the same path must not collide, so this discriminator is
 * part of the row's composite identity `(projectId, kind, path)`.
 */
export type FolderKind = 'scene' | 'tile';

/**
 * A user-created folder used to group scenes or tiles within a project.
 */
export interface Folder {
  /** Unique identifier (UUID). */
  id: string;
  /** Id of the project this folder belongs to. */
  projectId: string;
  /** Folder path displayed to the user (e.g. "forest/caves" or "forest"). */
  path: string;
  /** Which list this folder row belongs to (`'scene'` or `'tile'`). */
  kind: FolderKind;
  /** Manual override: `true` keeps the folder folded, `false` keeps it expanded. */
  collapsed: boolean;
  /** Epoch ms of the last interaction (selecting an item inside or manual toggle), 0 if never. */
  lastOpenedAt: number;
}

/** Number of top-level folders above which lists fold folders by default. */
export const FOLDER_FOLD_THRESHOLD = 6;

/**
 * Rewrites `path` to its new location after a folder rename. The path is
 * rewritten when it equals `from` exactly or lives beneath `from/...`.
 * Unrelated paths are returned unchanged.
 * @param path - The path to rewrite (e.g. a scene or folder path).
 * @param from - The folder path being renamed.
 * @param to - The new folder path.
 * @returns The rewritten path, or `path` when it is not affected.
 */
export function rewriteFolderPath(path: string, from: string, to: string): string {
  if (from === path) return to;
  if (path.startsWith(from + '/')) return to + path.slice(from.length);
  return path;
}

/**
 * Computes the set of folder paths that should render collapsed.
 *
 * Rule: a path is collapsed when its row was explicitly collapsed
 * (`collapsed === true`), or when the user never touched it (no row with
 * `lastOpenedAt > 0`) and the number of distinct top-level folders exceeds
 * the threshold. The ungrouped root (`''`) is never folded.
 * @param rows - Persisted folder rows for the list's kind (empty for a flat project).
 * @param paths - Every rendered folder path (derived paths + persisted rows).
 * @param threshold - Top-level folder count that triggers default folding.
 * @returns Distinct collapsed folder paths, in `paths` order.
 */
export function computeCollapsedKeys(
  rows: Pick<Folder, 'path' | 'collapsed' | 'lastOpenedAt'>[],
  paths: string[],
  threshold: number = FOLDER_FOLD_THRESHOLD,
): string[] {
  const nonEmpty = paths.filter((path) => path !== '');
  const topLevelCount = new Set(nonEmpty.map((path) => path.split('/')[0])).size;
  const defaultCollapsed = topLevelCount > threshold;
  const collapsed = new Set<string>();
  for (const path of paths) {
    if (path === '') continue;
    const row = rows.find((r) => r.path === path);
    if (row?.collapsed) {
      collapsed.add(path);
    } else if (!(row && row.lastOpenedAt > 0) && defaultCollapsed) {
      collapsed.add(path);
    }
  }
  return Array.from(collapsed);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `devbox run npm run test -- --include src/app/shared/models/folder.model.spec.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/models/folder.model.ts src/app/shared/models/folder.model.spec.ts
git commit -m "feature-17: add Folder kind/collapsed/lastOpenedAt fields and computeCollapsedKeys"
```

---

### Task 2: DatabaseService — schema v6 migration + kind-scoped folder row operations

**Files:**
- Modify: `src/app/core/services/database.service.ts`
- Modify: `src/app/core/services/database.service.spec.ts`

**Interfaces:**
- Consumes: `Folder`, `FolderKind` from `shared/models/folder.model` (type-only).
- Produces (consumed by Tasks 3 and 4):
  - `async getFoldersByKind(projectId: string, kind: FolderKind): Promise<Folder[]>`
  - `async upsertFolderState(projectId: string, kind: FolderKind, path: string, changes: { collapsed?: boolean; lastOpenedAt?: number }): Promise<void>`
  - `async deleteFoldersByKind(projectId: string, kind: FolderKind, prefix: string): Promise<void>`
  - `async renameFoldersOfKind(projectId: string, kind: FolderKind, fromPath: string, toPath: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Modify `src/app/core/services/database.service.spec.ts`:

1. Change line 3 import to also pull `Dexie`, and line 8 import already imports `Tile`:

```ts
import Dexie from 'dexie';
```

2. Replace the existing describe block (lines 35–52, `describe('DatabaseService v5 migration', …)`) with a v6 version plus a migration-seeding test:

```ts
describe('DatabaseService v6 migration', () => {
  it('opens at version 6 and tiles have folderPath default', async () => {
    await Dexie.delete('RiverKingDB');
    const db = new DatabaseService();
    await db.open();
    expect(db.verno).toBe(6);
    const tile = await db.tiles.add({
      projectId: 'p1',
      name: 'Grass',
      type: 'static',
      animationSpeed: 1,
      properties: { blocking: false, interactable: false },
      spriteIds: [],
      folderPath: '',
    } as unknown as Tile);
    const fetched = await db.tiles.get(tile);
    expect(fetched?.folderPath).toBe('');
    await Dexie.delete('RiverKingDB');
  });

  it('seeds legacy folder rows with kind/collapsed/lastOpenedAt when upgrading from v5', async () => {
    await Dexie.delete('RiverKingDB');

    const legacy = new Dexie('RiverKingDB');
    legacy.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      scenes: 'id, projectId, name, folderPath',
      tiles: '++id, projectId, name, type',
      sprites: '++id, projectId, tileId',
      sessions: 'projectId',
    });
    legacy.version(2).stores({ folders: 'id, projectId, path' });
    legacy.version(3).stores({ folders: 'id, projectId, path' });
    legacy.version(4).stores({ scenes: 'id, projectId, name, folderPath' });
    legacy.version(5).stores({ tiles: '++id, projectId, folderPath' });
    await legacy.open();
    await (legacy.table('folders') as Dexie.Table<{ id: string; projectId: string; path: string }, string>)
      .add({ id: 'f1', projectId: 'p1', path: 'forest' });
    await legacy.close();

    const db = new DatabaseService();
    const upgradeEvents: string[] = [];
    db.on('blocked', () => upgradeEvents.push('blocked'));
    await db.open();
    expect(db.verno).toBe(6);
    const folder = await db.folders.get('f1');
    expect(folder?.kind).toBe('scene');
    expect(folder?.collapsed).toBe(false);
    expect(folder?.lastOpenedAt).toBe(0);

    await Dexie.delete('RiverKingDB');
  });
});
```

3. Add a new describe block for the four row operations at the end of the file:

```ts
describe('DatabaseService folder row operations', () => {
  let db: DatabaseService;

  beforeEach(async () => {
    db = TestBed.inject(DatabaseService);
    await db.folders.clear();
  });

  it('getFoldersByKind returns only rows of the requested kind', async () => {
    await db.upsertFolderState('p1', 'scene', 'forest', {});
    await db.upsertFolderState('p1', 'tile', 'forest', {});
    const sceneRows = await db.getFoldersByKind('p1', 'scene');
    const tileRows = await db.getFoldersByKind('p1', 'tile');
    expect(sceneRows).toHaveLength(1);
    expect(sceneRows[0].kind).toBe('scene');
    expect(tileRows).toHaveLength(1);
    expect(tileRows[0].kind).toBe('tile');
  });

  it('upsertFolderState inserts a default row and updates it on later calls', async () => {
    await db.upsertFolderState('p1', 'tile', 'forest', { collapsed: true });
    let rows = await db.getFoldersByKind('p1', 'tile');
    expect(rows).toHaveLength(1);
    expect(rows[0].collapsed).toBe(true);
    expect(rows[0].lastOpenedAt).toBe(0);

    await db.upsertFolderState('p1', 'tile', 'forest', { lastOpenedAt: 42 });
    rows = await db.getFoldersByKind('p1', 'tile');
    expect(rows).toHaveLength(1);
    expect(rows[0].collapsed).toBe(true);
    expect(rows[0].lastOpenedAt).toBe(42);
  });

  it('deleteFoldersByKind removes the subtree but only for the requested kind', async () => {
    await db.upsertFolderState('p1', 'scene', 'forest', {});
    await db.upsertFolderState('p1', 'scene', 'forest/caves', {});
    await db.upsertFolderState('p1', 'tile', 'forest', {});
    await db.upsertFolderState('p1', 'tile', 'hills', {});

    await db.deleteFoldersByKind('p1', 'scene', 'forest');

    expect(await db.getFoldersByKind('p1', 'scene')).toEqual([]);
    const tileRows = await db.getFoldersByKind('p1', 'tile');
    expect(tileRows.map((r) => r.path).sort()).toEqual(['forest', 'hills']);
  });

  it('renameFoldersOfKind rewrites matching rows for that kind only', async () => {
    await db.upsertFolderState('p1', 'scene', 'forest', { collapsed: true });
    await db.upsertFolderState('p1', 'scene', 'forest/caves', {});
    await db.upsertFolderState('p1', 'scene', 'town', {});
    await db.upsertFolderState('p1', 'tile', 'forest', {});

    await db.renameFoldersOfKind('p1', 'scene', 'forest', 'woods');

    const scenePaths = (await db.getFoldersByKind('p1', 'scene')).map((r) => r.path).sort();
    expect(scenePaths).toEqual(['town', 'woods', 'woods/caves']);
    const woods = await db.getFoldersByKind('p1', 'scene');
    expect(woods.find((r) => r.path === 'woods')?.collapsed).toBe(true);
    expect((await db.getFoldersByKind('p1', 'tile'))[0].path).toBe('forest');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npm run test -- --include src/app/core/services/database.service.spec.ts`
Expected: FAIL — `getFoldersByKind` / `upsertFolderState` / `deleteFoldersByKind` / `renameFoldersOfKind` do not exist; `db.verno` is still 5.

- [ ] **Step 3: Write the minimal implementation**

Modify `src/app/core/services/database.service.ts`:

a) Change the type import on line 8:

```ts
import type { Folder, FolderKind } from '../../shared/models/folder.model';
```

b) Append the v6 version block right after the v5 block (after line 110):

```ts
    this.version(6)
      .stores({
        folders: 'id, projectId, path, kind',
      })
      .upgrade(async (tx) => {
        await tx
          .table('folders')
          .toCollection()
          .modify((folder: Record<string, unknown>) => {
            folder.kind = 'scene';
            folder.collapsed = false;
            folder.lastOpenedAt = 0;
          });
      });
```

c) Add four methods at the end of the class (after the constructor, still inside the braces):

```ts
  /**
   * Returns every folder row belonging to a project for a single kind.
   * @param projectId - The owning project id.
   * @param kind - The folder kind to list.
   * @returns The persisted folder rows of that kind.
   */
  async getFoldersByKind(projectId: string, kind: FolderKind): Promise<Folder[]> {
    return this.folders
      .where('projectId')
      .equals(projectId)
      .filter((folder) => folder.kind === kind)
      .toArray();
  }

  /**
   * Inserts a folder row for `(projectId, kind, path)` with default folding
   * state, or applies the given changes when a row already exists.
   * @param projectId - The owning project id.
   * @param kind - The folder kind.
   * @param path - The folder path.
   * @param changes - Fields to set on the row (collapsed / lastOpenedAt).
   */
  async upsertFolderState(
    projectId: string,
    kind: FolderKind,
    path: string,
    changes: { collapsed?: boolean; lastOpenedAt?: number },
  ): Promise<void> {
    const existing = await this.folders
      .where('projectId')
      .equals(projectId)
      .filter((folder) => folder.kind === kind && folder.path === path)
      .first();
    if (existing) {
      await this.folders.update(existing.id, changes);
      return;
    }
    await this.folders.add({
      id: crypto.randomUUID(),
      projectId,
      kind,
      path,
      collapsed: changes.collapsed ?? false,
      lastOpenedAt: changes.lastOpenedAt ?? 0,
    });
  }

  /**
   * Deletes every folder row of a kind whose path equals `prefix` or lives
   * beneath `prefix/` (the whole empty subtree).
   * @param projectId - The owning project id.
   * @param kind - The folder kind to delete.
   * @param prefix - The folder path to remove, including descendants.
   */
  async deleteFoldersByKind(projectId: string, kind: FolderKind, prefix: string): Promise<void> {
    await this.folders
      .where('projectId')
      .equals(projectId)
      .filter(
        (folder) => folder.kind === kind && (folder.path === prefix || folder.path.startsWith(prefix + '/')),
      )
      .delete();
  }

  /**
   * Rewrites every folder row path of a kind that matches `fromPath` exactly
   * or lives beneath `fromPath/`, moving it to `toPath`. Mirrors
   * `rewriteFolderPath` without importing from `shared/` (core independence).
   * @param projectId - The owning project id.
   * @param kind - The folder kind to rewrite.
   * @param fromPath - The current folder path.
   * @param toPath - The new folder path.
   */
  async renameFoldersOfKind(
    projectId: string,
    kind: FolderKind,
    fromPath: string,
    toPath: string,
  ): Promise<void> {
    await this.folders
      .where('projectId')
      .equals(projectId)
      .filter((folder) => folder.kind === kind)
      .modify((folder: Folder) => {
        if (fromPath === folder.path) {
          folder.path = toPath;
        } else if (folder.path.startsWith(fromPath + '/')) {
          folder.path = toPath + folder.path.slice(fromPath.length);
        }
      });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npm run test -- --include src/app/core/services/database.service.spec.ts`
Expected: PASS (all existing + 6 new tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/database.service.ts src/app/core/services/database.service.spec.ts
git commit -m "feature-17: schema v6 and kind-scoped folder row operations"
```

---

### Task 3: SceneService — kind-scoped folders + folder state upsert

**Files:**
- Modify: `src/app/features/scene-editor/services/scene.service.ts`
- Modify: `src/app/features/scene-editor/services/scene.service.spec.ts`

**Interfaces:**
- Consumes: `DatabaseService.getFoldersByKind / upsertFolderState / deleteFoldersByKind` (Task 2).
- Produces (consumed by Task 6):
  - `async getFolders(projectId: string): Promise<Folder[]>` — now kind=`'scene'` only.
  - `async createFolder(projectId: string, path: string): Promise<void>` — rows carry `kind`/`collapsed`/`lastOpenedAt`.
  - `async deleteFolder(projectId: string, path: string): Promise<void>` — delegating to `deleteFoldersByKind`.
  - `async renameFolder(projectId: string, fromPath: string, toPath: string): Promise<void>` — rewrites scene-kind rows only.
  - NEW `async upsertFolderState(projectId: string, path: string, changes: { collapsed?: boolean; lastOpenedAt?: number }): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Append to `src/app/features/scene-editor/services/scene.service.spec.ts`:

```ts
  it('createFolder persists a kind=scene row with default folding state', async () => {
    await service.createFolder('proj-1', 'forest');
    const [folder] = await service.getFolders('proj-1');
    expect(folder.kind).toBe('scene');
    expect(folder.collapsed).toBe(false);
    expect(folder.lastOpenedAt).toBe(0);
  });

  it('upsertFolderState updates the existing scene folder row in place', async () => {
    await service.createFolder('proj-1', 'forest');
    await service.upsertFolderState('proj-1', 'forest', { collapsed: true, lastOpenedAt: 42 });

    const folders = await service.getFolders('proj-1');
    expect(folders).toHaveLength(1);
    expect(folders[0].collapsed).toBe(true);
    expect(folders[0].lastOpenedAt).toBe(42);
  });

  it('upsertFolderState inserts a row for a path that has no folder row yet', async () => {
    await service.upsertFolderState('proj-1', 'forest', { lastOpenedAt: 7 });
    const [folder] = await service.getFolders('proj-1');
    expect(folder.path).toBe('forest');
    expect(folder.kind).toBe('scene');
    expect(folder.lastOpenedAt).toBe(7);
  });

  it('getFolders ignores tile-kind folder rows sharing the same path', async () => {
    await service.createFolder('proj-1', 'forest');
    const db = TestBed.inject(DatabaseService);
    await db.upsertFolderState('proj-1', 'tile', 'forest', { collapsed: true });

    const folders = await service.getFolders('proj-1');
    expect(folders).toHaveLength(1);
    expect(folders[0].kind).toBe('scene');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npm run test -- --include src/app/features/scene-editor/services/scene.service.spec.ts`
Expected: FAIL — `upsertFolderState` not defined; `createFolder` rows lack `kind`/`collapsed`/`lastOpenedAt`.

- [ ] **Step 3: Write the minimal implementation**

Modify `src/app/features/scene-editor/services/scene.service.ts`:

a) `getFolders` (replace body at lines 111–113):

```ts
  async getFolders(projectId: string): Promise<Folder[]> {
    return this.db.getFoldersByKind(projectId, 'scene');
  }
```

b) `createFolder` (replace lines 120–129):

```ts
  async createFolder(projectId: string, path: string): Promise<void> {
    const exists = await this.db.folders
      .where('projectId')
      .equals(projectId)
      .filter((folder) => folder.kind === 'scene' && folder.path === path)
      .count();
    if (exists > 0) return;
    const folder: Folder = {
      id: crypto.randomUUID(),
      projectId,
      path,
      kind: 'scene',
      collapsed: false,
      lastOpenedAt: 0,
    };
    await this.db.folders.add(folder);
  }
```

c) `deleteFolder` (replace lines 138–144):

```ts
  async deleteFolder(projectId: string, path: string): Promise<void> {
    await this.db.deleteFoldersByKind(projectId, 'scene', path);
  }
```

d) `renameFolder` — replace the two lines at 158–160 so the row loop is scene-kind scoped (lines 154–161 become):

```ts
  async renameFolder(projectId: string, fromPath: string, toPath: string): Promise<void> {
    await this.db.transaction('rw', this.db.folders, this.db.scenes, async () => {
      const folders = await this.db.folders
        .where('projectId')
        .equals(projectId)
        .filter((folder) => folder.kind === 'scene')
        .toArray();
      for (const folder of folders) {
        const rewritten = rewriteFolderPath(folder.path, fromPath, toPath);
        if (rewritten !== folder.path) {
          await this.db.folders.update(folder.id, { path: rewritten });
        }
      }
```

e) Add a new method at the end of the class:

```ts
  /**
   * Inserts or updates the persisted state of a scene folder row.
   * @param projectId The project that owns the folder.
   * @param path The folder path.
   * @param changes Fields to persist (collapsed override / lastOpenedAt touch).
   */
  async upsertFolderState(
    projectId: string,
    path: string,
    changes: { collapsed?: boolean; lastOpenedAt?: number },
  ): Promise<void> {
    await this.db.upsertFolderState(projectId, 'scene', path, changes);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npm run test -- --include src/app/features/scene-editor/services/scene.service.spec.ts`
Expected: PASS (all existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/services/scene.service.ts src/app/features/scene-editor/services/scene.service.spec.ts
git commit -m "feature-17: kind-scope scene folder rows and add folder state upsert"
```

---

### Task 4: TileService — materialized tile folder rows

**Files:**
- Modify: `src/app/features/tile-manager/services/tile.service.ts`
- Modify: `src/app/features/tile-manager/services/tile.service.spec.ts`

**Interfaces:**
- Consumes: `DatabaseService` folder row operations (Task 2).
- Produces (consumed by Task 8):
  - `async getFolders(projectId: string): Promise<string[]>` — now unions derived paths with materialized `kind='tile'` rows.
  - NEW `async getFolderRows(projectId: string): Promise<Folder[]>`
  - `async renameFolder(projectId, fromPath, toPath): Promise<void>` — also rewrites `kind='tile'` rows, runs in a transaction.
  - NEW `async deleteTileFolders(projectId: string, path: string): Promise<void>`
  - NEW `async rewriteFolderRows(projectId: string, fromPath: string, toPath: string): Promise<void>`
  - NEW `async upsertFolderState(projectId: string, path: string, changes: { collapsed?: boolean; lastOpenedAt?: number }): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Append to `src/app/features/tile-manager/services/tile.service.spec.ts`:

```ts
  it('getFolders unions derived tile paths with materialized tile folder rows', async () => {
    const t1 = await service.createTile('p1', 'A');
    await service.updateTileFolder(t1.id, 'UI/Buttons');
    await service.upsertFolderState('p1', 'UI/Buttons', { collapsed: true });
    await service.upsertFolderState('p1', 'empty-folder', { lastOpenedAt: 7 });

    const folders = await service.getFolders('p1');
    expect(folders).toEqual(['', 'UI/Buttons', 'empty-folder']);
  });

  it('getFolderRows returns materialized tile folder rows only', async () => {
    await service.upsertFolderState('p1', 'forest', { collapsed: true });
    const rows = await service.getFolderRows('p1');
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('tile');
    expect(rows[0].collapsed).toBe(true);
  });

  it('upsertFolderState persists folded state for a tile folder', async () => {
    await service.upsertFolderState('p1', 'forest', { collapsed: true, lastOpenedAt: 42 });
    const [row] = await service.getFolderRows('p1');
    expect(row.collapsed).toBe(true);
    expect(row.lastOpenedAt).toBe(42);
  });

  it('deleteTileFolders removes the tile folder subtree', async () => {
    await service.upsertFolderState('p1', 'forest', {});
    await service.upsertFolderState('p1', 'forest/caves', {});
    await service.deleteTileFolders('p1', 'forest');
    expect(await service.getFolderRows('p1')).toEqual([]);
  });

  it('renameFolder rewrites materialized tile folder rows, preserving state', async () => {
    await service.upsertFolderState('p1', 'forest', { collapsed: true });
    await service.upsertFolderState('p1', 'forest/caves', {});
    await service.upsertFolderState('p1', 'town', {});

    await service.renameFolder('p1', 'forest', 'woods');

    const rows = await service.getFolderRows('p1');
    expect(rows.map((r) => r.path).sort()).toEqual(['town', 'woods', 'woods/caves']);
    expect(rows.find((r) => r.path === 'woods')?.collapsed).toBe(true);
  });

  it('rewriteFolderRows rewrites materialized rows for a nesting move', async () => {
    await service.upsertFolderState('p1', 'forest', {});
    await service.upsertFolderState('p1', 'forest/caves', {});

    await service.rewriteFolderRows('p1', 'forest', 'town/forest');

    const rows = await service.getFolderRows('p1');
    expect(rows.map((r) => r.path).sort()).toEqual(['town/forest', 'town/forest/caves']);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npm run test -- --include src/app/features/tile-manager/services/tile.service.spec.ts`
Expected: FAIL — new methods missing.

- [ ] **Step 3: Write the minimal implementation**

Modify `src/app/features/tile-manager/services/tile.service.ts`:

a) Change the `folder.model` import (line 3) to:

```ts
import { rewriteFolderPath, type Folder } from '../../../shared/models/folder.model';
```

b) Replace `getFolders` (lines 73–77):

```ts
  async getFolders(projectId: string): Promise<string[]> {
    const tiles = await this.db.tiles.where('projectId').equals(projectId).toArray();
    const rows = await this.getFolderRows(projectId);
    const paths = new Set<string>();
    for (const tile of tiles) paths.add(tile.folderPath ?? '');
    for (const row of rows) paths.add(row.path);
    return Array.from(paths).sort((a, b) => a.localeCompare(b));
  }
```

c) Replace `renameFolder` (lines 86–94):

```ts
  async renameFolder(projectId: string, fromPath: string, toPath: string): Promise<void> {
    await this.db.transaction('rw', this.db.tiles, this.db.folders, async () => {
      const tiles = await this.db.tiles.where('projectId').equals(projectId).toArray();
      for (const tile of tiles) {
        const rewritten = rewriteFolderPath(tile.folderPath ?? '', fromPath, toPath);
        if (rewritten !== tile.folderPath) {
          await this.updateTileFolder(tile.id, rewritten);
        }
      }
      await this.db.renameFoldersOfKind(projectId, 'tile', fromPath, toPath);
    });
  }
```

d) Add four new methods at the end of the class:

```ts
  /**
   * Returns the materialized tile folder rows (kind='tile') for a project.
   * Rows only exist for folders the user has interacted with.
   * @param projectId - The project to query.
   */
  async getFolderRows(projectId: string): Promise<Folder[]> {
    return this.db.getFoldersByKind(projectId, 'tile');
  }

  /**
   * Inserts or updates the persisted state of a tile folder row (materializing
   * the row on first interaction).
   * @param projectId - The owning project id.
   * @param path - The folder path.
   * @param changes - Fields to persist (collapsed override / lastOpenedAt touch).
   */
  async upsertFolderState(
    projectId: string,
    path: string,
    changes: { collapsed?: boolean; lastOpenedAt?: number },
  ): Promise<void> {
    await this.db.upsertFolderState(projectId, 'tile', path, changes);
  }

  /**
   * Deletes every materialized tile folder row under a path (exact or nested).
   * @param projectId - The owning project id.
   * @param path - The folder path to remove, including descendants.
   */
  async deleteTileFolders(projectId: string, path: string): Promise<void> {
    await this.db.deleteFoldersByKind(projectId, 'tile', path);
  }

  /**
   * Rewrites materialized tile folder rows after a nesting folder move, where
   * `fromPath` moves beneath `toPath` (so `fromPath` becomes `toPath/fromPath`).
   * @param projectId - The owning project id.
   * @param fromPath - The moved folder path.
   * @param toPath - The destination path (`fromPath` prefixed with it).
   */
  async rewriteFolderRows(projectId: string, fromPath: string, toPath: string): Promise<void> {
    await this.db.renameFoldersOfKind(projectId, 'tile', fromPath, toPath);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npm run test -- --include src/app/features/tile-manager/services/tile.service.spec.ts`
Expected: PASS (all existing + 6 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/tile-manager/services/tile.service.ts src/app/features/tile-manager/services/tile.service.spec.ts
git commit -m "feature-17: lazy materialization of tile folder rows and state upsert"
```

---

### Task 5: SceneListComponent — collapsed state becomes an input, toggle becomes an output

**Files:**
- Modify: `src/app/features/scene-editor/scene-list.component.ts`
- Modify: `src/app/features/scene-editor/scene-list.component.spec.ts`
- (Template `scene-list.component.html` is unchanged — it already binds `collapsedFolders()` and `(toggleGroup)="onToggleGroup($event)"`.)

**Interfaces:**
- Consumes: nothing new.
- Produces (consumed by Task 6):
  - `collapsedFolders = input<string[]>([])` — replaces the local signal.
  - `toggleFolder = output<string>()` — new.
  - `onToggleGroup(key: string): void` — now emits `toggleFolder`.

- [ ] **Step 1: Write the failing tests**

Replace the collapse test in `src/app/features/scene-editor/scene-list.component.spec.ts` (existing lines 74–98) with:

```ts
  it('renders folders collapsed when the collapsedFolders input contains them', () => {
    const scenes: Scene[] = [
      makeScene('s1', 'Forest 1', 'forest'),
      makeScene('s2', 'Cave 1', 'caves'),
    ];
    fixture.componentRef.setInput('scenes', scenes);
    fixture.componentRef.setInput('collapsedFolders', ['forest']);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Forest 1');
    expect(compiled.textContent).toContain('Cave 1');
    expect(compiled.querySelectorAll('[cdkDropList]').length).toBe(1);
  });

  it('renders folders expanded when absent from the collapsedFolders input', () => {
    const scenes: Scene[] = [
      makeScene('s1', 'Forest 1', 'forest'),
      makeScene('s2', 'Cave 1', 'caves'),
    ];
    fixture.componentRef.setInput('scenes', scenes);
    fixture.componentRef.setInput('collapsedFolders', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Forest 1');
    expect(fixture.nativeElement.querySelectorAll('[cdkDropList]').length).toBe(2);
  });

  it('emits toggleFolder when a folder header is clicked', () => {
    const scenes: Scene[] = [makeScene('s1', 'Forest 1', 'forest')];
    fixture.componentRef.setInput('scenes', scenes);
    fixture.detectChanges();

    const headerFor = (path: string) =>
      Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(path),
      ) as HTMLButtonElement;

    const emitSpy = vi.spyOn(component.toggleFolder, 'emit');
    headerFor('forest')!.click();
    fixture.detectChanges();
    expect(emitSpy).toHaveBeenCalledWith('forest');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `devbox run npm run test -- --include src/app/features/scene-editor/scene-list.component.spec.ts`
Expected: FAIL — `collapsedFolders` is a signal (not an input) and `toggleFolder` does not exist on the component.

- [ ] **Step 3: Write the minimal implementation**

Replace the body of `src/app/features/scene-editor/scene-list.component.ts` with:

```ts
import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { GroupedListComponent } from '../../shared/components/grouped-list/grouped-list.component';
import type { Scene } from '../../shared/models/scene.model';

/**
 * Displays scenes grouped by folderPath with drag-and-drop support.
 * Thin wrapper around {@link GroupedListComponent} for scene-specific binding.
 * The collapsed set is owned by the parent shell; toggles are emitted upwards.
 */
@Component({
  selector: 'rk-scene-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GroupedListComponent],
  templateUrl: './scene-list.component.html',
  styleUrl: './scene-list.component.scss',
})
export class SceneListComponent {
  scenes = input.required<Scene[]>();
  folders = input<string[]>([]);
  selectedSceneId = input<string | null>(null);
  /** Folder paths rendered collapsed. Owned and persisted by the parent shell. */
  collapsedFolders = input<string[]>([]);
  sceneSelect = output<string>();
  createScene = output<void>();
  sceneDelete = output<string>();
  sceneFolderChange = output<{ sceneId: string; folderPath: string }>();
  createFolder = output<string>();
  /** Emitted when the user requests deletion of an empty folder. */
  folderDelete = output<string>();
  folderRename = output<{ fromKey: string; toKey: string }>();
  /** Emitted when the user toggles a folder's collapsed state. */
  toggleFolder = output<string>();

  groupByFolderPath = (scene: Scene) => scene.folderPath || '';

  onSceneSelect(id: string | number): void {
    this.sceneSelect.emit(String(id));
  }

  onSceneDelete(id: string | number): void {
    this.sceneDelete.emit(String(id));
  }

  onFolderDelete(key: string): void {
    this.folderDelete.emit(key);
  }

  onSceneFolderChange(event: { itemId: string | number; groupKey: string }): void {
    this.sceneFolderChange.emit({ sceneId: String(event.itemId), folderPath: event.groupKey });
  }

  onToggleGroup(key: string): void {
    this.toggleFolder.emit(key);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `devbox run npm run test -- --include src/app/features/scene-editor/scene-list.component.spec.ts`
Expected: PASS (the replaced collapse tests + all existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/scene-list.component.ts src/app/features/scene-editor/scene-list.component.spec.ts
git commit -m "feature-17: scene list collapses flow through input/output instead of local state"
```

---

### Task 6: SceneEditorComponent — own the folding state

**Files:**
- Modify: `src/app/features/scene-editor/scene-editor.component.ts`
- Modify: `src/app/features/scene-editor/scene-editor.component.html`
- Modify: `src/app/features/scene-editor/scene-editor.component.spec.ts`

**Interfaces:**
- Consumes: `computeCollapsedKeys`, `type Folder` (Task 1); `SceneService.getFolders` (scene-kind) + `upsertFolderState` (Task 3).
- Produces: nothing new for later tasks.
- Internal surface (used by tests):
  - `folderRows = signal<Folder[]>([])`
  - `collapsedFolders = computed(() => computeCollapsedKeys(this.folderRows(), this.folders()))`
  - `async onToggleSceneFolder(path: string): Promise<void>`
  - `loadFolders()` now populates `folderRows` + `folders`; `selectScene()` touches the scene's folder.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/features/scene-editor/scene-editor.component.spec.ts` (the existing `describe` block; helpers `component`, `sceneService`, `db`, and the folder tests setup already exist):

```ts
  it('loadFolders captures folder rows and computes the collapsed set', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    for (let i = 0; i < 7; i++) await component.onCreateFolder(`f${i}`);
    await component.loadFolders();
    expect(component.folderRows()).toHaveLength(7);
    // 7 top-level folders > threshold 6 -> everything default-collapses
    expect(component.collapsedFolders().sort()).toEqual(['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6']);
  });

  it('touching a folder keeps it expanded above the threshold', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    for (let i = 0; i < 7; i++) await component.onCreateFolder(`f${i}`);
    await component.loadFolders();

    await component.onToggleSceneFolder('f0'); // expands -> writes collapsed=false + lastOpenedAt=now

    expect(component.collapsedFolders()).not.toContain('f0');
    expect(component.collapsedFolders()).toContain('f1');
    const row = (await db.folders.toArray()).find((r) => r.path === 'f0');
    expect(row?.collapsed).toBe(false);
    expect(row?.lastOpenedAt).toBeGreaterThan(0);
  });

  it('collapsing a folder above the threshold persists collapsed=true', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    for (let i = 0; i < 7; i++) await component.onCreateFolder(`f${i}`);
    await component.loadFolders();

    await component.onFolderRename({ fromKey: 'f6', toKey: 'f6x' }); // no-op rename guard test is elsewhere
    await component.onToggleSceneFolder('f6'); // re-collapse an already-collapsed folder -> collapsed=true stays

    const row = (await db.folders.toArray()).find((r) => r.path === 'f6');
    expect(row?.collapsed).toBe(true);
  });

  it('selectScene bumps lastOpenedAt of the selected scene folder', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await component.onCreateFolder('forest');
    const scene = await sceneService.createScene('p1', 'Forest 1', 10, 10);
    await sceneService.updateSceneFolder(scene.id, 'forest');

    await component.selectScene(scene.id);

    const row = (await db.folders.toArray()).find((r) => r.path === 'forest');
    expect(row?.lastOpenedAt).toBeGreaterThan(0);
  });
```

Note: `onCreateFolder` in the spec's existing tests is awaited directly (line 118), so the new tests can await it too. Each `onCreateFolder` also calls `loadFolders()` internally, but the explicit `await component.loadFolders()` keeps the rows signal fresh before asserting.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npm run test -- --include src/app/features/scene-editor/scene-editor.component.spec.ts`
Expected: FAIL — `folderRows` / `collapsedFolders` / `onToggleSceneFolder` do not exist; `selectScene` never touches the folder row.

- [ ] **Step 3: Write the minimal implementation**

Modify `src/app/features/scene-editor/scene-editor.component.ts`:

a) Add an import after line 36 (`import type { Scene, Layer } …`):

```ts
import { computeCollapsedKeys, type Folder } from '../../shared/models/folder.model';
```

b) After the `folders` signal declaration (line 90), add:

```ts
  /** Persisted scene folder rows for the current project (kind='scene'). */
  folderRows = signal<Folder[]>([]);
  /** Folder paths that render collapsed, derived from persisted folder state. */
  collapsedFolders = computed(() => computeCollapsedKeys(this.folderRows(), this.folders()));
```

c) Replace `loadFolders` (lines 320–328):

```ts
  async loadFolders(): Promise<void> {
    try {
      const rows = await this.sceneService.getFolders(this.projectId());
      this.folderRows.set(rows);
      this.folders.set(rows.map((f) => f.path));
    } catch (e) {
      console.error('Failed to load folders:', e);
      this.notification.error('Failed to load folders.');
    }
  }
```

d) In `selectScene` (lines 334–355), insert the touch block right after the `activeLayerId` if/else (after line 343), before `void this.sessions.updateSession(...)`:

```ts
      if (scene?.folderPath) {
        await this.sceneService.upsertFolderState(this.projectId(), scene.folderPath, {
          lastOpenedAt: Date.now(),
        });
        await this.loadFolders();
      }
```

e) Add a new method after `selectScene` (after line 355):

```ts
  /**
   * Persists a manual collapse/expand for a folder and refreshes folder state.
   * @param path The folder path the user toggled.
   */
  async onToggleSceneFolder(path: string): Promise<void> {
    try {
      const collapsed = !this.collapsedFolders().includes(path);
      await this.sceneService.upsertFolderState(this.projectId(), path, {
        collapsed,
        lastOpenedAt: Date.now(),
      });
      await this.loadFolders();
    } catch (e) {
      console.error('Failed to update folder state:', e);
      this.notification.error('Failed to update folder state.');
    }
  }
```

f) Modify `src/app/features/scene-editor/scene-editor.component.html` — add two lines to the `rk-scene-list` element (after the `[folders]` line, keep existing outputs):

```html
    [collapsedFolders]="collapsedFolders()"
```
and
```html
    (toggleFolder)="onToggleSceneFolder($event)"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npm run test -- --include src/app/features/scene-editor/scene-editor.component.spec.ts`
Expected: PASS (all existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/scene-editor.component.ts src/app/features/scene-editor/scene-editor.component.html src/app/features/scene-editor/scene-editor.component.spec.ts
git commit -m "feature-17: scene editor owns and persists folder folding state"
```

---

### Task 7: TileListTreeComponent — collapsed-state tests

**Files:**
- Modify: `src/app/features/tile-manager/list/tile-list-tree.component.spec.ts`
- (No component source change: `TileListTreeComponent` already exposes `collapsedFolders` input and `toggleFolder` output, and its template already binds both.)

**Interfaces:**
- Consumes: existing `collapsedFolders` input + `toggleFolder` output.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test (verifies current behavior is already correct)**

Append to `src/app/features/tile-manager/list/tile-list-tree.component.spec.ts`:

```ts
  it('renders children collapsed when collapsedFolders input contains the folder', () => {
    fixture.componentRef.setInput('tiles', [
      {
        id: 1,
        name: 'Grass',
        projectId: 'p1',
        type: 'static',
        animationSpeed: 1,
        properties: { blocking: false, interactable: false },
        spriteIds: [],
        folderPath: 'forest',
      },
    ]);
    fixture.componentRef.setInput('folders', ['forest']);
    fixture.componentRef.setInput('collapsedFolders', ['forest']);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Grass');
  });

  it('emits toggleFolder when a folder header is clicked', () => {
    const emitSpy = vi.spyOn(component.toggleFolder, 'emit');
    fixture.componentRef.setInput('tiles', [
      {
        id: 1,
        name: 'Grass',
        projectId: 'p1',
        type: 'static',
        animationSpeed: 1,
        properties: { blocking: false, interactable: false },
        spriteIds: [],
        folderPath: 'forest',
      },
    ]);
    fixture.componentRef.setInput('folders', ['forest']);
    fixture.detectChanges();

    const headerFor = (path: string) =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
        b.textContent?.includes(path),
      ) as HTMLButtonElement;
    headerFor('forest')!.click();
    fixture.detectChanges();
    expect(emitSpy).toHaveBeenCalledWith('forest');
  });
```

- [ ] **Step 2: Run the test**

Run: `devbox run npm run test -- --include src/app/features/tile-manager/list/tile-list-tree.component.spec.ts`
Expected: PASS. (If the header-click test fails, inspect `GroupedListComponent`'s collapse button selector and adjust `headerFor` to match the button that actually carries the folder label — the scene-list spec uses the same helper successfully.)

- [ ] **Step 3: Commit**

```bash
git add src/app/features/tile-manager/list/tile-list-tree.component.spec.ts
git commit -m "feature-17: cover tile tree collapse input and toggle output"
```

---

### Task 8: TileManagerComponent — own the folding state and materialize tile rows

**Files:**
- Modify: `src/app/features/tile-manager/tile-manager.component.ts`
- Modify: `src/app/features/tile-manager/tile-manager.component.spec.ts`

**Interfaces:**
- Consumes: `computeCollapsedKeys`, `type Folder` (Task 1); `TileService.getFolderRows / upsertFolderState / deleteTileFolders / rewriteFolderRows` (Task 4).
- Produces: nothing new for later tasks.
- Internal surface (used by tests):
  - `folderRows = signal<Folder[]>([])`
  - `collapsedFolders` becomes `computed(() => computeCollapsedKeys(this.folderRows(), this.folders()))`
  - `async toggleFolder(path: string): Promise<void>` — persists instead of local-signal flipping.
  - `async onCreateFolder(name: string): Promise<void>` — materializes a `kind='tile'` row.
  - `async onConfirmFolderDelete(): Promise<void>` — also deletes tile folder rows.
  - `onFolderMove` — also rewrites materialized rows; `selectTile()` touches the tile's folder.

- [ ] **Step 1: Write the failing tests**

Modify `src/app/features/tile-manager/tile-manager.component.spec.ts`:

a) Add a folders cleanup inside the existing `beforeEach` (after `await db.sessions.clear();`, lines 62–66):

```ts
    await db.folders.clear();
```

b) Replace the three folder tests at lines 130–155 with async versions (they now write real rows):

```ts
  it('deletes an empty folder from the folder list after confirmation', async () => {
    await setupWithProject();
    const comp = fixture.componentInstance;
    const db = TestBed.inject(DatabaseService);
    await comp.onCreateFolder('mountain');
    await new Promise((r) => setTimeout(r, 50));
    expect(comp.folders()).toContain('mountain');

    comp.onFolderDeleteRequest('mountain');
    expect(comp.pendingDeleteFolderPath()).toBe('mountain');

    await comp.onConfirmFolderDelete();
    expect(comp.folders()).not.toContain('mountain');
    expect((await db.folders.toArray()).filter((f) => f.path === 'mountain')).toEqual([]);
  });

  it('removes empty descendant folders together with the deleted folder', async () => {
    await setupWithProject();
    const comp = fixture.componentInstance;
    const db = TestBed.inject(DatabaseService);
    await comp.onCreateFolder('forest');
    await comp.onCreateFolder('forest/caves');
    await new Promise((r) => setTimeout(r, 50));

    comp.onFolderDeleteRequest('forest');
    await comp.onConfirmFolderDelete();

    expect(comp.folders()).not.toContain('forest');
    expect(comp.folders()).not.toContain('forest/caves');
    expect(await db.folders.toArray()).toEqual([]);
  });
```

The cluster test at lines 157–173 (`blocks deletion of a folder that still contains tiles`) is unchanged — it mutates `comp.folders` directly (`update(...)`), which still works because `folders` remains a writable signal.

c) Append new tests at the end of the `describe` block:

```ts
  it('toggleFolder persists folded state and materializes a tile folder row', async () => {
    await setupWithProject();
    const comp = fixture.componentInstance;
    const db = TestBed.inject(DatabaseService);

    await comp.toggleFolder('mountain');

    const rows = await db.getFoldersByKind('test-proj', 'tile');
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe('mountain');
    expect(rows[0].collapsed).toBe(true);
    expect(comp.collapsedFolders()).toContain('mountain');
  });

  it('selecting a tile touches its folder row', async () => {
    await setupWithProject();
    const comp = fixture.componentInstance;
    const db = TestBed.inject(DatabaseService);
    const tileId = await addSeedTile();
    await db.tiles.update(tileId, { folderPath: 'mountain' });
    await comp.loadTiles();

    await comp.selectTile(tileId);

    const rows = await db.getFoldersByKind('test-proj', 'tile');
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe('mountain');
    expect(rows[0].lastOpenedAt).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run npm run test -- --include src/app/features/tile-manager/tile-manager.component.spec.ts`
Expected: FAIL — `collapsedFolders` is a writable signal (computed missing), `toggleFolder` flips the signal instead of writing rows, `onCreateFolder`/`onConfirmFolderDelete` stay signal-only, and `folderRows`/`getFoldersByKind` calls fail to compile.

- [ ] **Step 3: Write the minimal implementation**

Modify `src/app/features/tile-manager/tile-manager.component.ts`:

a) Add an import after line 31 (`import type { Tile } …`):

```ts
import { computeCollapsedKeys, type Folder } from '../../shared/models/folder.model';
```

b) Replace the `folders`/`collapsedFolders` signal pair (lines 94–98):

```ts
  /** Distinct folder paths for the current project (derived + materialized rows). */
  folders = signal<string[]>([]);

  /** Materialized tile folder rows (kind='tile') for the current project. */
  folderRows = signal<Folder[]>([]);

  /** Collapsed folder paths, derived from persisted folder state. */
  collapsedFolders = computed(() => computeCollapsedKeys(this.folderRows(), this.folders()));
```

c) Replace `loadFolders` (lines 240–248):

```ts
  async loadFolders(): Promise<void> {
    try {
      const folders = await this.tileService.getFolders(this.projectId());
      const folderRows = await this.tileService.getFolderRows(this.projectId());
      this.folders.set(folders);
      this.folderRows.set(folderRows);
    } catch (e) {
      this.notification.error('Failed to load folders');
      console.error(e);
    }
  }
```

d) Replace `toggleFolder` (lines 294–298):

```ts
  async toggleFolder(path: string): Promise<void> {
    try {
      const collapsed = !this.collapsedFolders().includes(path);
      await this.tileService.upsertFolderState(this.projectId(), path, {
        collapsed,
        lastOpenedAt: Date.now(),
      });
      await this.loadFolders();
    } catch (e) {
      this.notification.error('Failed to update folder state');
      console.error(e);
    }
  }
```

e) Replace `onCreateFolder` (lines 304–316):

```ts
  async onCreateFolder(name: string): Promise<void> {
    try {
      await this.tileService.upsertFolderState(this.projectId(), name, {});
      await this.loadFolders();
      this.undo.push({
        label: 'Create folder',
        execute: async () => {
          await this.tileService.upsertFolderState(this.projectId(), name, {});
          await this.loadFolders();
        },
        undo: async () => {
          await this.tileService.deleteTileFolders(this.projectId(), name);
          await this.loadFolders();
        },
      });
    } catch (e) {
      this.notification.error('Failed to create the folder');
      console.error(e);
    }
  }
```

f) Replace `onConfirmFolderDelete` (lines 340–345):

```ts
  async onConfirmFolderDelete(): Promise<void> {
    const path = this.pendingDeleteFolderPath();
    if (!path) return;
    this.pendingDeleteFolderPath.set(null);
    try {
      await this.tileService.deleteTileFolders(this.projectId(), path);
      await this.loadFolders();
    } catch (e) {
      this.notification.error('Failed to delete the folder');
      console.error(e);
    }
  }
```

g) In `onFolderMove` (lines 375–425), compute a move target once (add after line 380, where `newPrefix` is computed) and rewrite rows after the tile loop:

After the existing line `const newPrefix = to ? to + '/' + from : from;` add nothing new (that IS the move target) — reuse it. Inside the `try` block, after the `for (const tile of tilesToUpdate) { … }` loop and before `await this.loadTiles();`, insert:

```ts
      await this.tileService.rewriteFolderRows(this.projectId(), from, newPrefix);
```

Inside the `execute` closure (after its tile loop) add:

```ts
            await this.tileService.rewriteFolderRows(this.projectId(), from, newPrefix);
```

and inside the `undo` closure (after its tile loop) add:

```ts
            await this.tileService.rewriteFolderRows(this.projectId(), newPrefix, from);
```

h) In `selectTile` (lines 432–446), insert after `this.selectedTile.set(tile ?? null);`:

```ts
      if (tile?.folderPath) {
        await this.tileService.upsertFolderState(this.projectId(), tile.folderPath, {
          lastOpenedAt: Date.now(),
        });
        await this.loadFolders();
      }
```

(Note: `toggleFolder` is declared later in the file than `loadFolders`, but method order in a class is irrelevant to the compiler.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run npm run test -- --include src/app/features/tile-manager/tile-manager.component.spec.ts`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/tile-manager/tile-manager.component.ts src/app/features/tile-manager/tile-manager.component.spec.ts
git commit -m "feature-17: tile manager persists folding state and materializes tile folder rows"
```

---

### Task 9: Full verification

**Files:** none (or whatever format/lint fixes surface).

- [ ] **Step 1: Format the touched files**

Run: `devbox run npm run format`
Expected: Prettier reformats any touched file; no output beyond file list.

- [ ] **Step 2: Lint**

Run: `devbox run npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `devbox run npm run test`
Expected: all suites pass (including the untouched `scene-editor`, `tile-manager`, `scene.service`, `tile.service`, `database.service`, and the two list specs).

- [ ] **Step 4: Produce a production build**

Run: `devbox run npm run build`
Expected: build succeeds within the bundle/style budgets.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "feature-17: format and lint fixes"
```
(Only if Step 1–3 changed files.)

---

## Self-review notes (checked before save)

- **Spec coverage:** threshold constant (Task 1), schema v6 + migration defaults (Task 2), shared fold computation (Task 1), persistence + `lastOpenedAt` recency >0 (Tasks 1/6/8), manual-override-wins rule (Task 1), lazy tile materialization (Tasks 4/8), applied to both lists (Tasks 6–8), flat projects unchanged (`computeCollapsedKeys` no-op ≤ threshold; verified in Task 1), no threshold setting, no virtualization.
- **Type consistency:** `upsertFolderState(projectId, path, changes)` on `SceneService`/`TileService` (kind baked in) vs `upsertFolderState(projectId, kind, path, changes)` on `DatabaseService` — distinct signatures, documented in each service's Interfaces block. `computeCollapsedKeys(rows, paths)` matches all three call sites (Task 1 signature, Task 6 and Task 8 usage).
- **Known toggling nuance:** toggling a folder that is already collapsed re-writes `collapsed=true` (keeps it folded); toggling an expanded folder writes `collapsed=false` + bumps `lastOpenedAt`, which is a durable expand override (spec §Design decisions: "any manual toggle sets the flag explicitly").