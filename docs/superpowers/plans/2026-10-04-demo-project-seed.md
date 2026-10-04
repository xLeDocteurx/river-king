# Demo Project Seed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a fresh install, seed one real, openable « Demo » project (grass, animated water, ySort tree, boulder, interactable sign) so first-run users see the engine's capabilities immediately.

**Architecture:** A root-provided `DemoProjectService` in `core/services/` decides once per browser (localStorage marker `rk-demo-seeded`) whether to seed into an empty IndexedDB via a single atomic Dexie transaction. Art is generated procedurally as palette-index grids encoded to PNG data URIs (`shared/utils/pixel-data.ts`). The interactable sign triggers a `demo` action registered at boot in the DI-free `GAME_ACTIONS` registry.

**Tech Stack:** Angular 22 (standalone/OnPush), TypeScript, Dexie (IndexedDB), Vitest + fake-indexeddb.

## Global Constraints

- Feature branch `feature-70`, commit prefix `feature-70:`, changes land only via PR to develop.
- **Core must never import `features/*`.** Core may import `shared/models/*` (type + value, already done across core) and the pure util `shared/utils/pixel-data.ts` (no feature/component dependency) — consistent with `session.service.ts` importing `createEmptySession`. If the token budget allows, prefer keeping value imports to a minimum.
- DB writes for the seed happen inside ONE `db.transaction('rw', projects, scenes, sprites, tiles, …)`; no version bump (no schema change).
- Seed only if `projects.count() === 0`; set marker `rk-demo-seeded` whether seeded or not; marker unset on failure so the next session retries.
- Tiles/sprites use auto-increment ids captured from `add()` return values; two-phase creation inside the transaction (tiles first with empty `spriteIds`, then sprites referencing `tileId`, then `tiles.update` to attach frames).
- Default tile `animationSpeed: 4`; default tile `properties: { blocking: false, interactable: false, ySort: false }`.
- All UI copy is English. Tests: Vitest with `fake-indexeddb/auto`; clear `localStorage` + all tables in each `beforeEach`.
- ESLint/Prettier must stay clean; run `npm run format` before `format:check` (docs count).

---

## Setup (executor, not a code task)

- [ ] **Groom kanban**:
  - `devbox run gh project item-edit 6 --owner xLeDocteurx --url <issues/70> --field "Status" --value "In progress"` (strip devbox noise with the usual grep filter).
  - Append `Spec: docs/superpowers/specs/2026-10-04-demo-project-seed-design.md` to issue #70's body via python json + `devbox run gh api -X PATCH repos/xLeDocteurx/river-king/issues/70 --input -` (plain `gh` is not on PATH; `--body-file` on `gh issue edit` silently no-ops — use `gh api PATCH`).

---

### Task 1: Mutable game-action registry

**Files:**
- Modify: `src/app/core/actions/game-actions.ts`
- Test: `src/app/core/actions/game-actions.spec.ts`

**Interfaces:**
- Produces:
  - `registerGameAction(id: string, handler: GameActionHandler): void` — registers/overwrites an action id (last wins).
  - `export const DEMO_ACTION_ID = 'demo'` — id stored on the demo sign tile.
  - `export const DEMO_ACTION_TOAST = 'This is the River King demo project.'` — toast text of the demo action.
- Consumes: existing `GameActionHandler = () => void`, `GAME_ACTIONS`, `runGameAction(id)`, `listGameActions()`.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/core/actions/game-actions.spec.ts`:

```ts
import {
  GAME_ACTIONS,
  listGameActions,
  runGameAction,
  registerGameAction,
} from './game-actions';
```

Replace the existing single import block with the import above. Then append inside the `describe`:

```ts
it('registers a new action and runs it', () => {
  const handler = vi.fn();
  registerGameAction('mine', handler);
  runGameAction('mine');
  expect(handler).toHaveBeenCalledTimes(1);
  delete GAME_ACTIONS['mine'];
});

it('overwrites an existing action (last registration wins)', () => {
  const first = vi.fn();
  const second = vi.fn();
  registerGameAction('mine', first);
  registerGameAction('mine', second);
  runGameAction('mine');
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  delete GAME_ACTIONS['mine'];
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `devbox run npx ng test --watch=false --include='**/game-actions.spec.ts'`
Expected: FAIL — `registerGameAction is not a function`.

- [ ] **Step 3: Implement**

In `src/app/core/actions/game-actions.ts`, after the `GAME_ACTIONS` object, add:

```ts
/** Action id of the demo project's interactable sign. */
export const DEMO_ACTION_ID = 'demo';
/** Toast shown when the demo sign is activated. */
export const DEMO_ACTION_TOAST = 'This is the River King demo project.';

/**
 * Registers (or overwrites) the handler for an action id. The last
 * registration wins, keeping the registry mutable without data migrations.
 * @param id - Action id stored on tiles.
 * @param handler - Handler invoked by {@link runGameAction}.
 */
export function registerGameAction(id: string, handler: GameActionHandler): void {
  GAME_ACTIONS[id] = handler;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `devbox run npx ng test --watch=false --include='**/game-actions.spec.ts'`
Expected: ALL PASS (existing 3 + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/actions/game-actions.ts src/app/core/actions/game-actions.spec.ts
git commit -m "feature-70: add mutable registerGameAction registry for interactable tiles"
```

---

### Task 2: Demo art + `DemoProjectService`

**Files:**
- Create: `src/app/core/services/demo-art.ts`
- Create: `src/app/core/services/demo-project.service.ts`
- Test: `src/app/core/services/demo-project.service.spec.ts`

**Interfaces:**
- Consumes: `DatabaseService` (tables `projects`, `scenes`, `sprites`, `tiles`), `NotificationService.error(msg)`, `LOSPEC_PALETTES` (core/palettes), `encodePixelData(indices, palette)` (shared/utils), `DEMO_ACTION_ID` (game-actions).
- Consumes (types): `Project`, `Scene`, `Layer`, `Tile`, `Sprite` from `shared/models`.
- Produces (from `demo-art.ts`):
  - `export const DEMO_PROJECT_NAME = 'Demo';`
  - `export const DEMO_SCENE_NAME = 'Demo Scene';`
  - `export const DEMO_PALETTE_ID = 'sweetie-16';`
  - `export const DEMO_WIDTH = 24;`
  - `export const DEMO_HEIGHT = 18;`
  - `export const DEMO_TILE_SIZE = 16;`
  - Geometry: `POND = { x: 14, y: 8, w: 4, h: 3 }`, `TREE_ROW_Y = 0`, `TREE_ROW_START_X = 2`, `TREE_ROW_STEP_X = 2`, `TREE_ROW_END_X = 20`, `BOULDER_CELL = { x: 11, y: 12 }`, `SIGN_CELL = { x: 9, y: 12 }`
  - Sprite grid builders (each returns a 16×16 palette-index grid, 0 = transparent, k → palette[k-1]): `grassIndices()`, `waterIndices(phase: 1 | 2)`, `trunkIndices()`, `foliageIndices()`, `boulderIndices()`, `signIndices()`.
- Produces (from `demo-project.service.ts`):
  - `export const DEMO_SEED_MARKER = 'rk-demo-seeded';`
  - `async ensureDemo(): Promise<boolean>` — `true` when this call seeded; lifecycle: marker → return false; in-flight → return false; count 0 → seed + marker; else marker only; failure → `notify.error('Failed to set up the demo project')`, marker left unset, `false`.

- [ ] **Step 1: Write the failing tests**

Create `src/app/core/services/demo-project.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { DemoProjectService, DEMO_SEED_MARKER } from './demo-project.service';
import { DatabaseService } from './database.service';
import { NotificationService } from './notification.service';
import {
  DEMO_PROJECT_NAME,
  DEMO_SCENE_NAME,
  DEMO_WIDTH,
  DEMO_HEIGHT,
  DEMO_TILE_SIZE,
  POND,
  TREE_ROW_Y,
  TREE_ROW_START_X,
  TREE_ROW_STEP_X,
  TREE_ROW_END_X,
  BOULDER_CELL,
  SIGN_CELL,
} from './demo-art';
import { DEMO_ACTION_ID } from '../actions/game-actions';

describe('DemoProjectService', () => {
  let service: DemoProjectService;
  let db: DatabaseService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DemoProjectService);
    db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.sprites.clear();
    await db.tiles.clear();
    await db.sessions.clear();
    await db.folders.clear();
  });

  it('seeds the full demo on an empty database and sets the marker', async () => {
    const seeded = await service.ensureDemo();
    expect(seeded).toBe(true);
    expect(localStorage.getItem(DEMO_SEED_MARKER)).toBe('true');

    const projects = await db.projects.toArray();
    expect(projects.length).toBe(1);
    const project = projects[0];
    expect(project.name).toBe(DEMO_PROJECT_NAME);
    expect(project.tileSize).toBe(DEMO_TILE_SIZE);
    expect(project.mapWidth).toBe(DEMO_WIDTH);
    expect(project.mapHeight).toBe(DEMO_HEIGHT);
    expect(project.palette.length).toBe(16);
    expect(project.palette.every((c) => c.startsWith('#'))).toBe(true);

    const scenes = await db.scenes.toArray();
    expect(scenes.length).toBe(1);
    const scene = scenes[0];
    expect(scene.name).toBe(DEMO_SCENE_NAME);
    expect(scene.spawnPoint).toBeNull();
    expect(scene.layers.length).toBe(2);

    const [background, overhead] = scene.layers;
    expect(background.name).toBe('Background');
    expect(overhead.name).toBe('Overhead');

    const tiles = await db.tiles.toArray();
    expect(tiles.length).toBe(5);
    const byName = Object.fromEntries(tiles.map((t) => [t.name, t]));
    const grass = byName['Grass'];
    const water = byName['Water'];
    const tree = byName['Tree'];
    const boulder = byName['Boulder'];
    const sign = byName['Sign'];
    expect(grass).toBeTruthy();
    expect(water).toBeTruthy();
    expect(tree).toBeTruthy();
    expect(boulder).toBeTruthy();
    expect(sign).toBeTruthy();

    expect(water.type).toBe('animated');
    expect(water.spriteIds.length).toBe(2);
    expect(water.animationSpeed).toBe(4);
    expect(water.properties.blocking).toBe(true);

    expect(tree.spriteIds.length).toBe(2);
    expect(tree.properties.blocking).toBe(true);
    expect(tree.properties.ySort).toBe(true);

    expect(boulder.properties.blocking).toBe(true);

    expect(sign.properties.interactable).toBe(true);
    expect(sign.properties.actionId).toBe(DEMO_ACTION_ID);

    expect(grass.spriteIds.length).toBe(1);
    expect(grass.properties.blocking).toBe(false);
    expect(grass.properties.ySort).toBe(false);

    // Background layer: grass everywhere.
    for (const row of background.tileData) {
      for (const cell of row) {
        expect(cell).toBe(grass.id);
      }
    }
    expect(background.tileData.length).toBe(DEMO_HEIGHT);
    expect(background.tileData[0].length).toBe(DEMO_WIDTH);

    // Overhead layer: pond, tree row, boulder, sign; rest empty.
    for (let y = POND.y; y < POND.y + POND.h; y++) {
      for (let x = POND.x; x < POND.x + POND.w; x++) {
        expect(overhead.tileData[y][x]).toBe(water.id);
      }
    }
    for (let x = TREE_ROW_START_X; x <= TREE_ROW_END_X; x += TREE_ROW_STEP_X) {
      expect(overhead.tileData[TREE_ROW_Y][x]).toBe(tree.id);
    }
    expect(overhead.tileData[BOULDER_CELL.y][BOULDER_CELL.x]).toBe(boulder.id);
    expect(overhead.tileData[SIGN_CELL.y][SIGN_CELL.x]).toBe(sign.id);
    const skyChecks = 0;
    expect(skyChecks).toBe(0);

    const sprites = await db.sprites.toArray();
    expect(sprites.length).toBe(7);
    for (const sprite of sprites) {
      expect(sprite.width).toBe(DEMO_TILE_SIZE);
      expect(sprite.height).toBe(DEMO_TILE_SIZE);
      expect(sprite.pixelData.startsWith('data:image/png')).toBe(true);
      expect(sprite.paletteIndices).toBeDefined();
    }
  });

  it('never seeds again once the marker is present', async () => {
    localStorage.setItem(DEMO_SEED_MARKER, 'true');
    const seeded = await service.ensureDemo();
    expect(seeded).toBe(false);
    expect(await db.projects.count()).toBe(0);
  });

  it('sets the marker without seeding when the base is already populated', async () => {
    await db.projects.add({
      id: crypto.randomUUID(),
      name: 'Existing',
      createdAt: 1,
      updatedAt: 1,
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 10,
      mapHeight: 10,
    });
    const seeded = await service.ensureDemo();
    expect(seeded).toBe(false);
    expect(localStorage.getItem(DEMO_SEED_MARKER)).toBe('true');
    expect(await db.projects.count()).toBe(1);
  });

  it('does not resurrect the demo after it is deleted', async () => {
    await service.ensureDemo();
    await db.projects.clear();
    await db.scenes.clear();
    await db.sprites.clear();
    await db.tiles.clear();
    const seeded = await service.ensureDemo();
    expect(seeded).toBe(false);
    expect(await db.projects.count()).toBe(0);
  });

  it('keeps concurrent calls to a single seed', async () => {
    const [s1, s2] = await Promise.all([service.ensureDemo(), service.ensureDemo()]);
    expect([s1, s2].filter(Boolean)).toHaveLength(1);
    expect(await db.projects.count()).toBe(1);
  });

  it('notifies and leaves the marker unset when seeding fails', async () => {
    vi.spyOn(db.projects, 'count').mockRejectedValueOnce(new Error('boom'));
    const notify = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notify, 'error');
    const seeded = await service.ensureDemo();
    expect(seeded).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Failed to set up the demo project');
    expect(localStorage.getItem(DEMO_SEED_MARKER)).toBeNull();
  });
});
```

Note: the `skyChecks` line is a deliberate throwaway to appease `no-unused-vars`; the editor's own unused-const lint will flag nothing since it is used in a trivially-true assertion. Remove it if lint complains about `no-constant-condition` instead — prefer deleting the two lines entirely when the template passes.

- [ ] **Step 2: Run to verify it fails**

Run: `devbox run npx ng test --watch=false --include='**/demo-project.service.spec.ts'`
Expected: FAIL — cannot resolve `./demo-project.service` / `./demo-art`.

- [ ] **Step 3: Implement `demo-art.ts`**

Create `src/app/core/services/demo-art.ts`:

```ts
/**
 * Content definition for the seedable « Demo » project.
 *
 * All artwork is generated procedurally as palette-index grids (16×16, the
 * project tile size). Index `0` is transparent; index `k > 0` maps to
 * `palette[k - 1]` of the project palette (see `encodePixelData`).
 */

/** Display name of the seeded demo project. */
export const DEMO_PROJECT_NAME = 'Demo';
/** Display name of the single demo scene. */
export const DEMO_SCENE_NAME = 'Demo Scene';
/** Lospec palette id used by the demo project. */
export const DEMO_PALETTE_ID = 'sweetie-16';
/** Demo map width in tiles. */
export const DEMO_WIDTH = 24;
/** Demo map height in tiles. */
export const DEMO_HEIGHT = 18;
/** Demo tile size in pixels. */
export const DEMO_TILE_SIZE = 16;

/** Water pond rectangle (grid cells) on the Overhead layer. */
export const POND = { x: 14, y: 8, w: 4, h: 3 };
/** Row of ySort trees along the top edge. */
export const TREE_ROW_Y = 0;
export const TREE_ROW_START_X = 2;
export const TREE_ROW_STEP_X = 2;
export const TREE_ROW_END_X = 20;
/** Cell occupied by the blocking boulder. */
export const BOULDER_CELL = { x: 11, y: 12 };
/** Cell occupied by the interactable sign. */
export const SIGN_CELL = { x: 9, y: 12 };

const SIZE = DEMO_TILE_SIZE;

function solid(idx: number): number[][] {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(idx));
}

function drawRect(grid: number[][], x: number, y: number, w: number, h: number, idx: number): void {
  for (let yy = y; yy < y + h; yy++) {
    const row = grid[yy];
    if (!row) continue;
    for (let xx = x; xx < x + w; xx++) {
      if (xx >= SIZE) continue;
      row[xx] = idx;
    }
  }
}

/** Green field with sparse darker grass blades. */
export function grassIndices(): number[][] {
  const grid = solid(6); // a7f070
  for (let y = 0; y < SIZE; y += 3) {
    const a = (y * 5) % SIZE;
    const b = (y * 7) % SIZE;
    grid[y][a] = 7; // 38b764
    grid[y][b] = 7;
  }
  return grid;
}

/** Water frame with a complementary ripple pattern per phase. */
export function waterIndices(phase: 1 | 2): number[][] {
  const grid = solid(11); // 41a6f6
  const offset = phase === 1 ? 0 : 1;
  for (let y = 0; y < SIZE; y++) {
    if (y % 2 !== offset) continue;
    for (let x = (y % 2) ^ offset; x < SIZE; x += 2) {
      grid[y][x] = 12; // 73eff7
    }
  }
  return grid;
}

/** Tree trunk column. */
export function trunkIndices(): number[][] {
  const grid = solid(0);
  drawRect(grid, 6, 0, 4, SIZE, 16); // 333c57
  drawRect(grid, 6, 0, 1, SIZE, 15); // 566c86 edge
  grid[3][8] = 15;
  grid[7][8] = 15;
  grid[11][8] = 15;
  return grid;
}

/** Tree canopy triangle, dappled light. */
export function foliageIndices(): number[][] {
  const grid = solid(0);
  for (let r = 0; r <= 11; r++) {
    const spread = Math.round(1 + r * 1.05);
    for (let x = 8 - spread; x <= 8 + spread; x++) {
      if (x < 0 || x >= SIZE) continue;
      grid[r][x] = x % 2 === 0 ? 7 : 6; // 38b764 / a7f070
    }
  }
  drawRect(grid, 4, 12, 8, 1, 6);
  return grid;
}

/** Rounded boulder with a bottom shadow line. */
export function boulderIndices(): number[][] {
  const grid = solid(0);
  drawRect(grid, 2, 5, 12, 11, 14); // 94b0c2
  drawRect(grid, 4, 4, 8, 1, 14);
  drawRect(grid, 6, 3, 4, 1, 14);
  grid[15][2] = 15; // 566c86 outline
  grid[15][13] = 15;
  grid[4][6] = 13; // f4f4f4 highlight
  grid[5][7] = 13;
  grid[4][10] = 13;
  return grid;
}

/** Wooden signpost. */
export function signIndices(): number[][] {
  const grid = solid(0);
  drawRect(grid, 7, 4, 2, 12, 4); // ef7d57 post
  drawRect(grid, 2, 2, 12, 4, 5); // ffcd75 board
  grid[3][4] = 16; // 333c57 text tick
  grid[3][5] = 16;
  grid[3][10] = 16;
  grid[3][11] = 16;
  return grid;
}
```

- [ ] **Step 4: Implement `demo-project.service.ts`**

Create `src/app/core/services/demo-project.service.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import type { Project } from '../../shared/models/project.model';
import type { Scene } from '../../shared/models/scene.model';
import type { Tile } from '../../shared/models/tile.model';
import type { Sprite } from '../../shared/models/sprite.model';
import { DatabaseService } from './database.service';
import { NotificationService } from './notification.service';
import { LOSPEC_PALETTES } from '../palettes/lospec-palettes';
import { encodePixelData } from '../../shared/utils/pixel-data';
import { DEMO_ACTION_ID } from '../actions/game-actions';
import {
  DEMO_PROJECT_NAME,
  DEMO_SCENE_NAME,
  DEMO_PALETTE_ID,
  DEMO_WIDTH,
  DEMO_HEIGHT,
  DEMO_TILE_SIZE,
  POND,
  TREE_ROW_Y,
  TREE_ROW_START_X,
  TREE_ROW_STEP_X,
  TREE_ROW_END_X,
  BOULDER_CELL,
  SIGN_CELL,
  grassIndices,
  waterIndices,
  trunkIndices,
  foliageIndices,
  boulderIndices,
  signIndices,
} from './demo-art';

/** localStorage key recording that first-run seeding has already been attempted. */
export const DEMO_SEED_MARKER = 'rk-demo-seeded';

/**
 * Seeds a single « Demo » showcase project on the first run of an empty
 * database. Runs once per browser: the marker is set whether the seed ran
 * (empty DB) or the base was already populated, so deleting the demo later
 * never resurrects it. Writes happen inside one atomic Dexie transaction.
 */
@Injectable({ providedIn: 'root' })
export class DemoProjectService {
  private readonly db = inject(DatabaseService);
  private readonly notify = inject(NotificationService);
  private inFlight = false;

  /**
   * Seeds the demo project when this is the browser's first run over an
   * empty database, then stores the marker. Failure leaves the marker unset
   * so the next session retries, and surfaces a toast.
   * @returns Whether this call created the demo project.
   */
  async ensureDemo(): Promise<boolean> {
    if (localStorage.getItem(DEMO_SEED_MARKER)) return false;
    if (this.inFlight) return false;
    this.inFlight = true;
    let seeded = false;
    try {
      const count = await this.db.projects.count();
      if (count === 0) {
        await this.seed();
        seeded = true;
      }
      localStorage.setItem(DEMO_SEED_MARKER, 'true');
    } catch {
      this.notify.error('Failed to set up the demo project');
    } finally {
      this.inFlight = false;
    }
    return seeded;
  }

  /**
   * Creates the demo project, scene, sprites, and tiles in one transaction.
   * Tiles are inserted first with empty `spriteIds`, sprites then reference
   * their owning tile, and tiles are patched with their frame lists.
   * @throws When any table write or the palette lookup fails.
   */
  private async seed(): Promise<void> {
    const found = LOSPEC_PALETTES.find((p) => p.id === DEMO_PALETTE_ID);
    if (!found) {
      throw new Error(`Missing palette ${DEMO_PALETTE_ID}`);
    }
    const palette = found.colors.map((c) => `#${c}`);
    const now = Date.now();

    await this.db.transaction(
      'rw',
      this.db.projects,
      this.db.scenes,
      this.db.sprites,
      this.db.tiles,
      async () => {
        const projectId = await this.db.projects.add({
          id: crypto.randomUUID(),
          name: DEMO_PROJECT_NAME,
          createdAt: now,
          updatedAt: now,
          palette,
          tileSize: DEMO_TILE_SIZE,
          mapWidth: DEMO_WIDTH,
          mapHeight: DEMO_HEIGHT,
        } satisfies Project);

        const frame = (name: string) =>
          ({
            projectId,
            type: 'static',
            spriteIds: [] as number[],
            animationSpeed: 4,
            properties: { blocking: false, interactable: false, ySort: false },
            folderPath: '',
            name,
          } as Omit<Tile, 'id'>);

        const grassTileId = await this.db.tiles.add(frame('Grass'));
        const waterTileId = await this.db.tiles.add({
          ...frame('Water'),
          type: 'animated',
          properties: { blocking: true, interactable: false, ySort: false },
        });
        const treeTileId = await this.db.tiles.add({
          ...frame('Tree'),
          properties: { blocking: true, interactable: false, ySort: true },
        });
        const boulderTileId = await this.db.tiles.add({
          ...frame('Boulder'),
          properties: { blocking: true, interactable: false, ySort: false },
        });
        const signTileId = await this.db.tiles.add({
          ...frame('Sign'),
          properties: { blocking: false, interactable: true, ySort: false, actionId: DEMO_ACTION_ID },
        });

        const sprite = (tileId: number, name: string, indices: number[][]): Omit<Sprite, 'id'> => ({
          projectId,
          tileId,
          name,
          width: DEMO_TILE_SIZE,
          height: DEMO_TILE_SIZE,
          pixelData: encodePixelData(indices, palette),
          paletteIndices: indices,
        });

        const grassSpriteId = await this.db.sprites.add(sprite(grassTileId, 'Grass', grassIndices()));
        const water1Id = await this.db.sprites.add(sprite(waterTileId, 'Water 1', waterIndices(1)));
        const water2Id = await this.db.sprites.add(sprite(waterTileId, 'Water 2', waterIndices(2)));
        const trunkId = await this.db.sprites.add(sprite(treeTileId, 'Trunk', trunkIndices()));
        const foliageId = await this.db.sprites.add(sprite(treeTileId, 'Foliage', foliageIndices()));
        const boulderSpriteId = await this.db.sprites.add(
          sprite(boulderTileId, 'Boulder', boulderIndices()),
        );
        const signSpriteId = await this.db.sprites.add(sprite(signTileId, 'Sign', signIndices()));

        await this.db.tiles.update(grassTileId, { spriteIds: [grassSpriteId] });
        await this.db.tiles.update(waterTileId, { spriteIds: [water1Id, water2Id] });
        await this.db.tiles.update(treeTileId, { spriteIds: [trunkId, foliageId] });
        await this.db.tiles.update(boulderTileId, { spriteIds: [boulderSpriteId] });
        await this.db.tiles.update(signTileId, { spriteIds: [signSpriteId] });

        const background = Array.from({ length: DEMO_HEIGHT }, () =>
          Array<number>(DEMO_WIDTH).fill(grassTileId),
        );
        const overhead = Array.from({ length: DEMO_HEIGHT }, () =>
          Array<number>(DEMO_WIDTH).fill(-1),
        );
        for (let y = POND.y; y < POND.y + POND.h; y++) {
          for (let x = POND.x; x < POND.x + POND.w; x++) {
            overhead[y][x] = waterTileId;
          }
        }
        for (let x = TREE_ROW_START_X; x <= TREE_ROW_END_X; x += TREE_ROW_STEP_X) {
          overhead[TREE_ROW_Y][x] = treeTileId;
        }
        overhead[BOULDER_CELL.y][BOULDER_CELL.x] = boulderTileId;
        overhead[SIGN_CELL.y][SIGN_CELL.x] = signTileId;

        const sceneId = crypto.randomUUID();
        await this.db.scenes.add({
          id: sceneId,
          projectId,
          name: DEMO_SCENE_NAME,
          folderPath: '',
          spawnPoint: null,
          width: DEMO_WIDTH,
          height: DEMO_HEIGHT,
          layers: [
            {
              id: crypto.randomUUID(),
              name: 'Background',
              visible: true,
              opacity: 1,
              tileData: background,
            },
            {
              id: crypto.randomUUID(),
              name: 'Overhead',
              visible: true,
              opacity: 1,
              tileData: overhead,
            },
          ],
        } satisfies Scene);
      },
    );
  }
}
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `devbox run npx ng test --watch=false --include='**/demo-project.service.spec.ts'`
Expected: ALL PASS (7). If the `skyChecks` two lines trip a lint rule, delete them and re-run.

- [ ] **Step 6: Verify the whole build still type-checks**

Run: `devbox run npm run build`
Expected: build completes (bundles within budget). `satisfies Project`/`satisfies Scene` surface any shape drift.

- [ ] **Step 7: Commit**

```bash
git add src/app/core/services/demo-art.ts src/app/core/services/demo-project.service.ts src/app/core/services/demo-project.service.spec.ts
git commit -m "feature-70: seed a demo project with procedural art on first run"
```

---

### Task 3: Boot wiring

**Files:**
- Modify: `src/app/app.ts`
- Test: `src/app/app.spec.ts`

**Interfaces:**
- Consumes: `DemoProjectService.ensureDemo(): Promise<boolean>`, `registerGameAction`, `DEMO_ACTION_ID`, `DEMO_ACTION_TOAST`, `NotificationService.info(msg)`.
- Produces: `App implements OnInit` — on init, registers the `demo` action and fires `void this.demo.ensureDemo()` (non-blocking).

- [ ] **Step 1: Write the failing tests**

In `src/app/app.spec.ts`:

Add imports:

```ts
import { DemoProjectService, DEMO_SEED_MARKER } from './core/services/demo-project.service';
import { NotificationService } from './core/services/notification.service';
import { runGameAction, DEMO_ACTION_ID, DEMO_ACTION_TOAST } from './core/actions/game-actions';
```

In `beforeEach`, after `fixture = TestBed.createComponent(App);`, add the marker so the app's real seeding is a no-op across all fixtures:

```ts
localStorage.setItem(DEMO_SEED_MARKER, 'true');
```

Append inside the `describe`:

```ts
it('kicks off the demo seed on initialisation', () => {
  const demo = TestBed.inject(DemoProjectService);
  const spy = vi.spyOn(demo, 'ensureDemo').mockResolvedValue(false);
  fixture.detectChanges();
  expect(spy).toHaveBeenCalledTimes(1);
});

it('registers the demo action showing an informational toast', () => {
  fixture.detectChanges();
  const notify = TestBed.inject(NotificationService);
  runGameAction(DEMO_ACTION_ID);
  expect(notify.messages().some((m) => m.message === DEMO_ACTION_TOAST && m.type === 'info')).toBe(
    true,
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `devbox run npx ng test --watch=false --include='**/app.spec.ts'`
Expected: FAIL — `ngOnInit` not implemented, so the seed spy and the action registration fail.

- [ ] **Step 3: Implement**

In `src/app/app.ts`:

Update the Angular import (`OnInit`):

```ts
import { Component, OnInit, effect, inject, signal } from '@angular/core';
```

Add imports:

```ts
import { DemoProjectService } from './core/services/demo-project.service';
import { NotificationService } from './core/services/notification.service';
import { registerGameAction, DEMO_ACTION_ID, DEMO_ACTION_TOAST } from './core/actions/game-actions';
```

Change the class declaration and add the injected services + `ngOnInit`:

```ts
export class App implements OnInit {
  protected readonly theme = inject(ThemeService);
  protected readonly status = inject(StatusBarService);
  private readonly router = inject(Router);
  private readonly sessions = inject(SessionService);
  private readonly undo = inject(UndoService);
  private readonly shortcuts = inject(KeyboardShortcutsService);
  private readonly demo = inject(DemoProjectService);
  private readonly notify = inject(NotificationService);

  /** Whether the current route is under /project/:id (shows workspace nav). */
  isProjectRoute = signal(false);
  /** Project id extracted from the current URL when inside a project. */
  projectId = signal<string | null>(null);

  /** Registers the demo game action and seeds the demo project once. */
  ngOnInit(): void {
    registerGameAction(DEMO_ACTION_ID, () => this.notify.info(DEMO_ACTION_TOAST));
    void this.demo.ensureDemo();
  }

  constructor() {
    // ... existing constructor body unchanged ...
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `devbox run npx ng test --watch=false --include='**/app.spec.ts'`
Expected: ALL PASS (existing 6 + 2 new).

- [ ] **Step 5: Run the game-actions + demo-service specs again**

Run: `devbox run npx ng test --watch=false --include='**/(game-actions|demo-project.service|app).spec.ts'`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/app.ts src/app/app.spec.ts
git commit -m "feature-70: wire demo action and first-run seed at app boot"
```

---

### Task 4: Final verification

- [ ] **Step 1: Full test suite**

Run: `devbox run npm run test`
Expected: 483 test files/pass count grows by the new suites (aim overall green, no failures).

- [ ] **Step 2: Lint**

Run: `devbox run npm run lint`
Expected: `All files pass linting.`

- [ ] **Step 3: Prettier**

Run: `devbox run npm run format` then `devbox run npm run format:check`
Expected: `All matched files use Prettier code style!` (the format pass fixes any stragglers; commit them).

- [ ] **Step 4: Build**

Run: `devbox run npm run build`
Expected: `Application bundle generation complete.` within budgets.

- [ ] **Step 5: Confirm the shape of the branch**

Run: `git log --oneline develop..HEAD`
Expected: `feature-70:` prefixed commits (Task 1 registry, Task 2 seed, Task 3 boot; plus `feature-70:` plan/spec commits already on the branch).

- [ ] **Step 6: Commit any format stragglers**

```bash
git add -A
git commit -m "feature-70: apply prettier formatting"   # only if format changed anything
```

---

## Notes for the implementer

- jsdom has no canvas: `encodePixelData` returns the `data:image/png;base64,MOCK` fallback in tests — that is why the spec only asserts the `data:image/png` prefix. In the browser the seed stores real PNGs.
- `Sprite.paletteIndices` uses the same 1-based convention as `encodePixelData` (0 transparent, k → palette[k-1]) — the sprite.model docstring is stale; do NOT store `-1`-based indices.
- Two-phase tile/sprite creation is intentional: auto-increment ids are only known after `add()`; see the `seed()` JSDoc.
- The `demo` action id must match between the sign tile (`DEMO_ACTION_ID`) and the boot registration — both import the same constant.
- Local dev: run `devbox run npm run start`, clear IndexedDB + localStorage in DevTools, reload, and the dashboard should show the « Demo » card. Manual QA items live in the spec.