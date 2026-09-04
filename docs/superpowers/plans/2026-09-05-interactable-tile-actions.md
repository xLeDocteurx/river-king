# Interactable Tile Actions (E-key) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make interactable tiles emit their registered `GAME_ACTIONS` handler when the player presses `E` on them, with a toast confirmation and an accent-colored frame that permanently highlights the current target cell in Play mode.

**Architecture:** A pure `interaction.ts` module (same pattern as `collision.ts`) decides what `E` targets: the facing cell first, the cell under the player second, using a per-tile `actionId` map. `PlayerController` gains a 5th `start()` parameter (`interactableById`), re-derives `interactionTarget` after every `update(dt)`, and fires the action + a `NotificationService` toast on `E` (repeat-guarded). `SceneEditorComponent.enterPlay()` builds the map from project tiles; `map-canvas` strokes an accent frame around `interactionTarget`.

**Tech Stack:** Angular 22 (signals, standalone), Vitest under `@angular/build:unit-test`, TypeScript ~6.0, canvas 2D rendering.

## Global Constraints

- Source code carries **no inline comments**; public functions/interfaces still get JSDoc (`@param` / `@returns`, documented properties) per AGENTS.md.
- Pure logic modules (`interaction.ts`) stay Angular-free, like `collision.ts` / `map-footprint.ts`.
- `core/` must not import from `shared/`/`features/`; the reverse is fine (`play-controller` may import `core/actions/game-actions` and `core/services/notification.service`).
- The `test` action becomes a no-op; use `test: () => undefined` — ESLint `no-empty-function` (enabled via `eslint.configs.recommended`) rejects `() => {}`.
- UI copy is English-only and exact: toast message is `` `Action '<id>' triggered` ``.
- Commit prefix: `feature-52:`. All commands run through devbox. Focused test command (npm's `--include` is silently swallowed — use `ng.js` directly):
  `devbox run node node_modules/@angular/cli/bin/ng.js test --watch=false --include=<spec>`.
- Every `player.start(...)` call site uses the 5-arg form `start(scene, spawn, blockingById, footprints, interactableById)`. The 5th parameter is **required** (no default) so interaction is never silently disabled.

---

### Task 1: Pure interaction target module

**Files:**

- Create: `src/app/features/scene-editor/interaction.ts`
- Test: `src/app/features/scene-editor/interaction.spec.ts`

**Interfaces:**

- Consumes: `Layer` from `../../shared/models/scene.model` (path identical to `collision.ts`).
- Produces: `InteractionTarget` (`{ x, y, actionId }`), `topmostTileIdAt(x, y, layers): number`, `findInteractableTarget(cell, direction, layers, interactableById): InteractionTarget | null`. Task 2 consumes these exact names.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/scene-editor/interaction.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findInteractableTarget, topmostTileIdAt } from './interaction';
import type { Layer } from '../../shared/models/scene.model';

/** Builds a single-layer scene where every listed cell holds `id`. */
function layerWith(id: number, cells: [number, number][], width = 3, height = 3): Layer {
  const tileData = Array.from({ length: height }, () => Array<number>(width).fill(-1));
  for (const [x, y] of cells) {
    tileData[y][x] = id;
  }
  return { id: 'l1', name: 'l1', visible: true, opacity: 1, tileData };
}

function layer(id: string, tileData: number[][], visible = true, opacity = 1): Layer {
  return { id, name: id, visible, opacity, tileData };
}

const BELL = new Map<number, string>([[7, 'bell']]);

describe('topmostTileIdAt', () => {
  it('returns the tile of the only visible layer', () => {
    expect(topmostTileIdAt(1, 0, [layer('l1', [[-1, 3, -1]])])).toBe(3);
  });

  it('lets the topmost visible layer win over a lower one', () => {
    const bottom = layer('bottom', [[5, -1, -1]]);
    const top = layer('top', [[-1, 6, -1]]);
    expect(topmostTileIdAt(1, 0, [bottom, top])).toBe(6);
    expect(topmostTileIdAt(0, 0, [bottom, top])).toBe(5);
  });

  it('skips hidden layers and falls through to a visible one below', () => {
    const visible = layer('visible', [[3, -1, -1]]);
    const hiddenTop = layer('hidden', [[9, -1, -1]], false);
    expect(topmostTileIdAt(0, 0, [visible, hiddenTop])).toBe(3);
  });

  it('counts an opacity-0 layer', () => {
    expect(topmostTileIdAt(0, 0, [layer('t0', [[4, -1, -1]], true, 0)])).toBe(4);
  });

  it('returns -1 for an empty cell', () => {
    expect(topmostTileIdAt(0, 0, [layer('l1', [[-1, -1, -1]])])).toBe(-1);
  });

  it('returns -1 for reads outside every layer', () => {
    expect(topmostTileIdAt(3, 3, [layer('l1', [[-1, -1, -1]])])).toBe(-1);
    expect(topmostTileIdAt(1, 0, [])).toBe(-1);
  });
});

describe('findInteractableTarget', () => {
  it('targets the facing cell when it is interactable', () => {
    const layers = [layerWith(7, [[2, 0]])];
    expect(findInteractableTarget({ x: 1, y: 0 }, { dx: 1, dy: 0 }, layers, BELL)).toEqual({
      x: 2,
      y: 0,
      actionId: 'bell',
    });
  });

  it('falls back to the cell under the player when the facing cell holds a non-interactable tile', () => {
    const layers = [layerWith(7, [[1, 0]]), layer('top', [[-1, -1, 99]])];
    expect(findInteractableTarget({ x: 1, y: 0 }, { dx: 1, dy: 0 }, layers, BELL)).toEqual({
      x: 1,
      y: 0,
      actionId: 'bell',
    });
  });

  it('falls back to the cell under the player when the facing cell is empty', () => {
    const layers = [layerWith(7, [[1, 0]])];
    expect(findInteractableTarget({ x: 1, y: 0 }, { dx: 1, dy: 0 }, layers, BELL)).toEqual({
      x: 1,
      y: 0,
      actionId: 'bell',
    });
  });

  it('falls back to the cell under the player when the facing cell is out of bounds', () => {
    const layers = [layerWith(7, [[1, 0]], 2, 1)];
    expect(findInteractableTarget({ x: 1, y: 0 }, { dx: 1, dy: 0 }, layers, BELL)).toEqual({
      x: 1,
      y: 0,
      actionId: 'bell',
    });
  });

  it('returns null when the facing cell is not interactable and the cell below is empty', () => {
    const layers = [layer('l1', [[-1, 99, -1]])];
    expect(findInteractableTarget({ x: 0, y: 0 }, { dx: 1, dy: 0 }, layers, BELL)).toBeNull();
  });

  it('returns null when the interactable map is empty', () => {
    expect(
      findInteractableTarget({ x: 1, y: 0 }, { dx: 1, dy: 0 }, [layerWith(7, [[2, 0]])], new Map()),
    ).toBeNull();
  });

  it('honors the topmost layer when the facing cell stacks two interactable tiles', () => {
    const bottom = layerWith(7, [[2, 0]]);
    const top = layer('top', [
      [-1, -1, 8],
      [-1, -1, -1],
    ]);
    const ring = new Map<number, string>([
      [7, 'bell'],
      [8, 'ring'],
    ]);
    expect(findInteractableTarget({ x: 1, y: 0 }, { dx: 1, dy: 0 }, [bottom, top], ring)).toEqual({
      x: 2,
      y: 0,
      actionId: 'ring',
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `devbox run node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/app/features/scene-editor/interaction.spec.ts`

Expected: FAIL — the module `src/app/features/scene-editor/interaction.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/app/features/scene-editor/interaction.ts`:

```ts
import type { Layer } from '../../shared/models/scene.model';

/** The cell `E` targets, with the action registered on its tile. */
export interface InteractionTarget {
  /** Target cell column. */
  x: number;
  /** Target cell row. */
  y: number;
  /** Action id registered on the tile, used with GAME_ACTIONS. */
  actionId: string;
}

/**
 * Returns the effective tile id at a cell, following rendering order: the
 * topmost visible layer wins. Hidden layers are skipped. `-1` (empty) when no
 * layer paints that cell.
 *
 * @param x      - Cell column.
 * @param y      - Cell row.
 * @param layers - Scene layers; the LAST visible layer with a tile wins.
 * @returns The tile id painted at the cell, or `-1` when empty.
 */
export function topmostTileIdAt(x: number, y: number, layers: Layer[]): number {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible) continue;
    const row = layer.tileData[y];
    if (!row) continue;
    const tileId = row[x] ?? -1;
    if (tileId >= 0) return tileId;
  }
  return -1;
}

/**
 * Finds the interactable tile `E` should trigger for a player: the facing cell
 * first, then the cell under the player.
 *
 * @param cell       - Cell under the player center.
 * @param direction  - Facing direction ({dx, dy}), each in {-1, 0, 1}.
 * @param layers     - Scene layers.
 * @param interactableById - Map of tileId -> actionId for interactable tiles.
 * @returns {x, y, actionId} for the target, or `null` when nothing is in range.
 */
export function findInteractableTarget(
  cell: { x: number; y: number },
  direction: { dx: number; dy: number },
  layers: Layer[],
  interactableById: Map<number, string>,
): InteractionTarget | null {
  const facingX = cell.x + direction.dx;
  const facingY = cell.y + direction.dy;
  const facingId = topmostTileIdAt(facingX, facingY, layers);
  const facingAction = facingId >= 0 ? interactableById.get(facingId) : undefined;
  if (facingAction) {
    return { x: facingX, y: facingY, actionId: facingAction };
  }

  const belowId = topmostTileIdAt(cell.x, cell.y, layers);
  const belowAction = belowId >= 0 ? interactableById.get(belowId) : undefined;
  if (belowAction) {
    return { x: cell.x, y: cell.y, actionId: belowAction };
  }

  return null;
}
```

Note on out-of-bounds: an out-of-scene facing cell has no row in any layer, so `topmostTileIdAt` yields `-1` and the under-player fallback triggers — no explicit bounds parameter is needed (matches the spec signature).

- [ ] **Step 4: Run the test to verify it passes**

Run: `devbox run node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/app/features/scene-editor/interaction.spec.ts`

Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/interaction.ts src/app/features/scene-editor/interaction.spec.ts
git commit -m "feature-52: add pure interaction target detection module"
```

---

### Task 2: Registry no-op, PlayerController E-key handling, enterPlay wiring

**Files:**

- Modify: `src/app/core/actions/game-actions.ts:9`
- Test: `src/app/core/actions/game-actions.spec.ts`
- Modify: `src/app/features/scene-editor/services/play-controller.ts`
- Test: `src/app/features/scene-editor/services/play-controller.spec.ts`
- Modify: `src/app/features/scene-editor/scene-editor.component.ts:274-285`
- Test: `src/app/features/scene-editor/scene-editor.component.spec.ts`
- Test: `src/app/features/scene-editor/map-canvas.component.spec.ts`

**Interfaces:**

- Consumes: `InteractionTarget`, `topmostTileIdAt` not needed here, `findInteractableTarget(cell, direction, layers, interactableById)` from `../interaction` (Task 1); `runGameAction(id)` from `../../../core/actions/game-actions`; `NotificationService` from `../../../core/services/notification.service` (root-provided).
- Produces: `PlayerController.start(scene, spawn, blockingById, footprints, interactableById)` (5 args, 5th required `Map<number, string>`), `PlayerController.interactionTarget` signal (`{ x, y, actionId } | null`). Task 3 reads `player.interactionTarget()`.

- [ ] **Step 1: Write/update the failing tests**

**1a. Replace `src/app/core/actions/game-actions.spec.ts` entirely:**

```ts
import { GAME_ACTIONS, listGameActions, runGameAction } from './game-actions';

describe('game-actions', () => {
  it('exposes the test action', () => {
    expect(listGameActions()).toContain('test');
    expect(typeof GAME_ACTIONS['test']).toBe('function');
  });

  it('runs a known action without alerting', () => {
    expect(() => runGameAction('test')).not.toThrow();
  });

  it('no-ops on unknown action id', () => {
    expect(() => runGameAction('does-not-exist')).not.toThrow();
  });
});
```

Drop the `vi` import and the `window.alert` spy.

**1b. Replace `src/app/features/scene-editor/services/play-controller.spec.ts` entirely** (10 existing tests now pass a 5th empty-map arg; 6 new tests cover E interaction). `NotificationService` is imported to read fired toasts:

```ts
import { TestBed } from '@angular/core/testing';
import { PlayerController } from './play-controller';
import { NotificationService } from '../../../core/services/notification.service';
import type { Layer } from '../../../shared/models/scene.model';

function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function release(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

function emptyScene(
  width: number,
  height: number,
): { width: number; height: number; layers: Layer[] } {
  return { width, height, layers: [] };
}

/** 4x4 scene with a blocking wall on column 2 (rows 0..3), tile id 0. */
function wallScene(): { width: number; height: number; layers: Layer[] } {
  const row = [-1, -1, 0, -1];
  return {
    width: 4,
    height: 4,
    layers: [
      {
        id: 'l1',
        name: 'wall',
        visible: true,
        opacity: 1,
        tileData: [row, [...row], [...row], [...row]],
      },
    ],
  };
}

const WALL = new Map<number, boolean>([[0, true]]);

/** 4x4 scene where the listed cells hold tile id 7. */
function sceneWithBell(cells: Array<[number, number]>): {
  width: number;
  height: number;
  layers: Layer[];
} {
  const tileData = Array.from({ length: 4 }, () => Array<number>(4).fill(-1));
  for (const [x, y] of cells) {
    tileData[y][x] = 7;
  }
  return {
    width: 4,
    height: 4,
    layers: [{ id: 'l1', name: 'interact', visible: true, opacity: 1, tileData }],
  };
}

const BELL = new Map<number, string>([[7, 'bell']]);

describe('PlayerController', () => {
  let player: PlayerController;
  let notification: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PlayerController] });
    player = TestBed.inject(PlayerController);
    notification = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    player.stop();
  });

  it('starts centered on the given spawn cell', () => {
    player.start(emptyScene(10, 10), { x: 3, y: 4 }, new Map(), {}, new Map());
    expect(player.x()).toBe(3.5);
    expect(player.y()).toBe(4.5);
  });

  it('moves up when W is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {}, new Map());
    press('w');
    player.update(1);
    expect(player.x()).toBe(5.5);
    expect(player.y()).toBeLessThan(5.5);
  });

  it('moves right when arrow-right is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {}, new Map());
    press('ArrowRight');
    player.update(1);
    expect(player.x()).toBeGreaterThan(5.5);
    expect(player.y()).toBe(5.5);
  });

  it('normalizes diagonal movement so speed is not boosted', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {}, new Map());
    player.speed = 1;
    press('d');
    press('s');
    player.update(1);
    expect(player.x()).toBeCloseTo(0.5 + Math.SQRT1_2, 5);
    expect(player.y()).toBeCloseTo(0.5 + Math.SQRT1_2, 5);
  });

  it('scales movement by dt', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {}, new Map());
    player.speed = 4;
    press('d');
    player.update(0.5);
    expect(player.x()).toBeCloseTo(2.5, 5);
  });

  it('clamps the player inside the scene bounds', () => {
    player.start(emptyScene(10, 10), { x: 0, y: 0 }, new Map(), {}, new Map());
    press('a');
    player.update(100);
    expect(player.x()).toBe(0.25);
  });

  it('sets direction and moving state from input', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {}, new Map());
    press('a');
    player.update(0.1);
    expect(player.direction()).toBe('left');
    expect(player.moving()).toBe(true);
    release('a');
    player.update(0.1);
    expect(player.moving()).toBe(false);
  });

  it('does not move when no key is held', () => {
    player.start(emptyScene(10, 10), { x: 5, y: 5 }, new Map(), {}, new Map());
    player.update(1);
    expect(player.x()).toBe(5.5);
    expect(player.y()).toBe(5.5);
    expect(player.moving()).toBe(false);
  });

  it('stops when walking into a blocking tile', () => {
    player.start(wallScene(), { x: 1, y: 1 }, WALL, {}, new Map());
    press('d');
    player.update(1);
    expect(player.x()).toBe(1.75);
    expect(player.y()).toBe(1.5);
  });

  it('slides along a blocking wall when moving diagonally', () => {
    player.start(wallScene(), { x: 1, y: 1 }, WALL, {}, new Map());
    press('d');
    press('s');
    player.update(0.5);
    expect(player.x()).toBe(1.75);
    expect(player.y()).toBeCloseTo(1.5 + Math.SQRT1_2 * 5 * 0.5, 3);
  });

  it('fires the facing-tile action and shows a success toast on E', () => {
    player.start(sceneWithBell([[2, 2]]), { x: 2, y: 1 }, new Map(), {}, BELL);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    expect(player.interactionTarget()).toEqual({ x: 2, y: 2, actionId: 'bell' });
    expect(
      notification
        .messages()
        .some((m) => m.type === 'success' && m.message === "Action 'bell' triggered"),
    ).toBe(true);
  });

  it('falls back to the cell under the player when the facing cell is empty', () => {
    player.start(sceneWithBell([[2, 1]]), { x: 2, y: 1 }, new Map(), {}, BELL);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E' }));
    expect(
      notification
        .messages()
        .some((m) => m.type === 'success' && m.message === "Action 'bell' triggered"),
    ).toBe(true);
  });

  it('does nothing on E without a target', () => {
    player.start(emptyScene(4, 4), { x: 2, y: 1 }, new Map(), {}, new Map());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    expect(notification.messages().length).toBe(0);
  });

  it('ignores repeated E keydown events', () => {
    player.start(sceneWithBell([[2, 2]]), { x: 2, y: 1 }, new Map(), {}, BELL);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', repeat: true }));
    expect(notification.messages().length).toBe(0);
  });

  it('updates the target when the player turns', () => {
    player.start(
      sceneWithBell([
        [1, 1],
        [2, 2],
      ]),
      { x: 2, y: 1 },
      new Map(),
      {},
      BELL,
    );
    expect(player.interactionTarget()).toEqual({ x: 2, y: 2, actionId: 'bell' });
    press('a');
    player.update(0);
    expect(player.interactionTarget()).toEqual({ x: 1, y: 1, actionId: 'bell' });
  });

  it('updates the target when the player moves', () => {
    player.start(sceneWithBell([[2, 3]]), { x: 2, y: 1 }, new Map(), {}, BELL);
    press('s');
    player.update(0.4);
    expect(player.interactionTarget()).toEqual({ x: 2, y: 3, actionId: 'bell' });
  });
});
```

**1c. Scene-editor spec — extend the two existing `enterPlay` assertions** (`scene-editor.component.spec.ts:716` and `:733`) to expect the 5th argument:

```ts
expect(startSpy).toHaveBeenCalledWith(scene, { x: 4, y: 3 }, expect.any(Map), {}, expect.any(Map));
```

```ts
expect(startSpy).toHaveBeenCalledWith(stored, { x: 1, y: 2 }, expect.any(Map), {}, expect.any(Map));
```

**1d. Scene-editor spec — add a DB-backed test** right after the existing `'passes per-tile blocking flags and footprints to the player on enterPlay'` (`scene-editor.component.spec.ts:736-775`):

```ts
it('passes only interactable tiles with an actionId to the player on enterPlay', async () => {
  const bellId = await db.tiles.add({
    projectId: 'p1',
    name: 'bell',
    type: 'static',
    spriteIds: [],
    animationSpeed: 1,
    properties: { blocking: false, interactable: true, actionId: 'bell' },
  } as unknown as Tile);
  const silentId = await db.tiles.add({
    projectId: 'p1',
    name: 'silent',
    type: 'static',
    spriteIds: [],
    animationSpeed: 1,
    properties: { blocking: false, interactable: true },
  } as unknown as Tile);
  const plainId = await db.tiles.add({
    projectId: 'p1',
    name: 'plain',
    type: 'static',
    spriteIds: [],
    animationSpeed: 1,
    properties: { blocking: false, interactable: false },
  } as unknown as Tile);

  fixture.detectChanges();
  await fixture.whenStable();
  const scene = await sceneService.createScene('p1', 'Play', 8, 6);
  await component.selectScene(scene.id);
  await component.loadProjectData();
  const player = fixture.debugElement.injector.get(PlayerController);
  const startSpy = vi.spyOn(player, 'start');

  component.enterPlay();

  expect(startSpy).toHaveBeenCalledTimes(1);
  const [, , , , interactableById] = startSpy.mock.calls[0] as [
    Scene,
    { x: number; y: number },
    Map<number, boolean>,
    TileFootprintMap,
    Map<number, string>,
  ];
  expect(interactableById.size).toBe(1);
  expect(interactableById.get(bellId)).toBe('bell');
  expect(interactableById.has(silentId)).toBe(false);
  expect(interactableById.has(plainId)).toBe(false);
});
```

The object spread must stay a direct literal argument to `db.tiles.add` with `as unknown as Tile`, matching the existing blocking-flags test (`:737-744`); `Tile` and `TileFootprintMap` type imports already exist at `scene-editor.component.spec.ts:17-18`.

**1e. Map-canvas spec — update the two existing `player.start(...)` calls** (`map-canvas.component.spec.ts:251` and `:289`) to the 5-arg form:

```ts
player.start({ width: 4, height: 4, layers: [] }, { x: 1, y: 2 }, new Map(), {}, new Map());
```

```ts
player.start({ width: 4, height: 4, layers: [] }, { x: 2, y: 2 }, new Map(), {}, new Map());
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/app/features/scene-editor/services/play-controller.spec.ts`

Expected: FAIL/compile error — `start` is still 4-arg and `interactionTarget` does not exist yet.

- [ ] **Step 3: Implement**

**3a. `src/app/core/actions/game-actions.ts:9`** — change the `test` handler to a no-op:

```ts
  test: () => undefined,
```

**3b. Replace `src/app/features/scene-editor/services/play-controller.ts` entirely:**

```ts
import { Injectable, inject, signal } from '@angular/core';
import type { Layer } from '../../../shared/models/scene.model';
import { buildBlockingGrid, resolveCollision, HALF_CELL_HITBOX } from '../collision';
import type { TileFootprintMap } from '../map-footprint';
import { findInteractableTarget } from '../interaction';
import type { InteractionTarget } from '../interaction';
import { runGameAction } from '../../../core/actions/game-actions';
import { NotificationService } from '../../../core/services/notification.service';

/** The direction the player is currently facing. */
export type PlayerDirection = 'up' | 'down' | 'left' | 'right';

/** Maps an input key (lowercased) to a normalized movement vector. */
const MOVEMENT_KEYS: Record<string, { dx: number; dy: number }> = {
  w: { dx: 0, dy: -1 },
  arrowup: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  arrowdown: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  arrowleft: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
  arrowright: { dx: 1, dy: 0 },
};

/** Maps the facing direction to its normalized movement vector. */
const DIRECTION_VECTORS: Record<PlayerDirection, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/**
 * Holds the runtime player state and movement logic for Play mode.
 *
 * Position is expressed in grid cells (fractional). It tracks which movement
 * keys are currently held via raw window keydown/keyup listeners and applies
 * input to movement in `update(dt)` so playback is frame-rate independent.
 * Interactable tiles are re-targeted after every update; pressing `E` fires
 * the targeted tile's registered action with a toast confirmation.
 */
@Injectable()
export class PlayerController {
  /** Current player X position in grid cells (fractional). */
  readonly x = signal(0);
  /** Current player Y position in grid cells (fractional). */
  readonly y = signal(0);
  /** The direction the player is facing. */
  readonly direction = signal<PlayerDirection>('down');
  /** Whether the player currently has a movement axis held. */
  readonly moving = signal(false);
  /** Movement speed in grid cells per second. */
  speed = 5;
  /** The interactable cell `E` currently targets, or null when out of range. */
  readonly interactionTarget = signal<InteractionTarget | null>(null);

  private readonly notification = inject(NotificationService);
  private readonly held = new Set<string>();
  /** @internal Whether the window input listeners are attached. */
  private listenersActive = false;
  private sceneWidth = 0;
  private sceneHeight = 0;
  private sceneLayers: Layer[] = [];
  private blockingGrid: boolean[][] = [];
  private interactableById: Map<number, string> = new Map();

  /** @internal Records a held key and fires the interaction on an E press. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.held.add(event.key.toLowerCase());
    if (event.key.toLowerCase() === 'e' && !event.repeat) {
      this.tryInteract();
    }
  };

  /** @internal Removes a released movement key. */
  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.key.toLowerCase());
  };

  /** @internal Fires the currently targeted tile action, if any. */
  private readonly tryInteract = (): void => {
    const target = this.interactionTarget();
    if (!target) return;
    runGameAction(target.actionId);
    this.notification.success(`Action '${target.actionId}' triggered`);
  };

  /**
   * Begins a Play session: attaches input listeners, builds the blocking grid
   * from the scene's visible layers, resets the player to the given spawn cell
   * (position signals hold the center, offset by half a cell), and derives the
   * initial interaction target.
   * @param scene - The scene being played, with its width/height bounds and layers.
   * @param spawn - The spawn cell to start at (the player centers on it).
   * @param blockingById - Per-tile blocking flags.
   * @param footprints - Grid-cell footprint per tile id.
   * @param interactableById - Per-tile action id for interactable tiles.
   */
  start(
    scene: { width: number; height: number; layers: Layer[] },
    spawn: { x: number; y: number },
    blockingById: Map<number, boolean>,
    footprints: TileFootprintMap,
    interactableById: Map<number, string>,
  ): void {
    this.sceneWidth = scene.width;
    this.sceneHeight = scene.height;
    this.sceneLayers = scene.layers;
    this.blockingGrid = buildBlockingGrid(
      scene.width,
      scene.height,
      scene.layers,
      blockingById,
      footprints,
    );
    this.interactableById = interactableById;
    this.x.set(spawn.x + 0.5);
    this.y.set(spawn.y + 0.5);
    this.direction.set('down');
    this.moving.set(false);
    this.recomputeInteractionTarget();
    this.held.clear();
    if (!this.listenersActive) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.listenersActive = true;
    }
  }

  /**
   * Ends a Play session: releases all held keys and detaches input listeners.
   */
  stop(): void {
    this.held.clear();
    if (this.listenersActive) {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      this.listenersActive = false;
    }
  }

  /**
   * Advances the player by the given delta time, applying held input and
   * resolving against the blocking grid (out-of-scene cells block). Updates
   * facing direction, the moving state, and re-derives the interaction target.
   * @param dt - Delta time in seconds.
   */
  update(dt: number): void {
    let dx = 0;
    let dy = 0;
    for (const key of this.held) {
      const m = MOVEMENT_KEYS[key];
      if (m) {
        dx += m.dx;
        dy += m.dy;
      }
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;

      const resolved = resolveCollision(
        { x: this.x(), y: this.y() },
        { x: dx * this.speed * dt, y: dy * this.speed * dt },
        HALF_CELL_HITBOX,
        this.blockingGrid,
        { width: this.sceneWidth, height: this.sceneHeight },
      );
      this.x.set(resolved.x);
      this.y.set(resolved.y);

      if (Math.abs(dx) >= Math.abs(dy)) {
        this.direction.set(dx < 0 ? 'left' : 'right');
      } else {
        this.direction.set(dy < 0 ? 'up' : 'down');
      }
      this.moving.set(true);
    } else {
      this.moving.set(false);
    }

    this.recomputeInteractionTarget();
  }

  /** @internal Derives the interactable cell from the center cell and direction. */
  private recomputeInteractionTarget(): void {
    this.interactionTarget.set(
      findInteractableTarget(
        { x: Math.floor(this.x()), y: Math.floor(this.y()) },
        DIRECTION_VECTORS[this.direction()],
        this.sceneLayers,
        this.interactableById,
      ),
    );
  }
}
```

Note: the restructured `update` no longer early-returns — the else branch sets `moving` and the target is recomputed on every frame (so a standing player keeps a valid target). Existing behavior is unchanged for all legacy tests.

**3c. `src/app/features/scene-editor/scene-editor.component.ts` `enterPlay()` (`:278-285`)** — build the interactable map and pass it as the 5th argument:

```ts
  enterPlay(): void {
    const scene = this.selectedScene();
    if (!scene) return;
    const blockingById = new Map(this.projectTiles().map((t) => [t.id, t.properties.blocking]));
    const interactableById = new Map(
      this.projectTiles()
        .filter((t) => t.properties.interactable && !!t.properties.actionId)
        .map((t) => [t.id, t.properties.actionId as string]),
    );
    this.player.start(scene, this.resolveSpawn(scene), blockingById, this.tileFootprints(), interactableById);
    this.playMode.set(true);
    this.placeSpawnMode.set(false);
  }
```

Update its JSDoc (`:274-277`) to mention "per-tile interactable action ids":

```ts
/**
 * Enters Play mode: starts the player controller at the scene's spawn point,
 * passing per-tile blocking flags, footprints, and interactable action ids,
 * and turns off editing tools.
 */
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/app/features/scene-editor/services/play-controller.spec.ts`

Expected: PASS (16 tests). Then the same focused command for `game-actions.spec.ts`, `scene-editor.component.spec.ts`, and `map-canvas.component.spec.ts` — all green.

- [ ] **Step 5: Full suite + lint**

```bash
devbox run npm run test -- --watch=false
devbox run npm run lint
```

Expected: 455 + 6 (play-controller) + 1 (scene-editor DB test) = 462 tests pass; lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/actions/game-actions.ts src/app/core/actions/game-actions.spec.ts
git add src/app/features/scene-editor/services/play-controller.ts src/app/features/scene-editor/services/play-controller.spec.ts
git add src/app/features/scene-editor/scene-editor.component.ts src/app/features/scene-editor/scene-editor.component.spec.ts
git add src/app/features/scene-editor/map-canvas.component.spec.ts
git commit -m "feature-52: trigger interactable tile actions on E press"
```

---

### Task 3: Accent frame around the interaction target

**Files:**

- Modify: `src/app/features/scene-editor/map-canvas.component.ts` (play-mode render block, `:311-322`)
- Test: `src/app/features/scene-editor/map-canvas.component.spec.ts`

**Interfaces:**

- Consumes: `player.interactionTarget()` signal (`{ x, y, actionId } | null`, from Task 2). `player` is already injected in `map-canvas.component.ts`. No new imports.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/features/scene-editor/map-canvas.component.spec.ts` (the `ctx` mock shape matches the existing placeholder tests `:233-247`):

```ts
it('draws an accent frame around the interaction target in play mode', () => {
  const ctx = {
    imageSmoothingEnabled: true,
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  try {
    setup(makeScene());
    const player = fixture.debugElement.injector.get(PlayerController);
    const tileData = [
      [-1, -1, -1, -1],
      [-1, -1, -1, -1],
      [-1, -1, 7, -1],
      [-1, -1, -1, -1],
    ];
    player.start(
      {
        width: 4,
        height: 4,
        layers: [{ id: 'l1', name: 'interact', visible: true, opacity: 1, tileData }],
      },
      { x: 2, y: 1 },
      new Map(),
      {},
      new Map([[7, 'bell']]),
    );
    fixture.componentRef.setInput('playMode', true);
    fixture.detectChanges();
    expect(ctx.strokeRect).toHaveBeenCalledWith(32, 32, 16, 16);
  } finally {
    getContextSpy.mockRestore();
  }
});

it('draws no interaction frame when there is no target in play mode', () => {
  const ctx = {
    imageSmoothingEnabled: true,
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  try {
    setup(makeScene());
    const player = fixture.debugElement.injector.get(PlayerController);
    player.start({ width: 4, height: 4, layers: [] }, { x: 2, y: 1 }, new Map(), {}, new Map());
    fixture.componentRef.setInput('playMode', true);
    fixture.detectChanges();
    expect(ctx.strokeRect).not.toHaveBeenCalledWith(32, 32, 16, 16);
  } finally {
    getContextSpy.mockRestore();
  }
});
```

Why `(32, 32, 16, 16)`: spawn `(2, 1)` centers the player at `(2.5, 1.5)`, cell `(2, 1)`, facing down → target cell `(2, 2)` → frame at `(2*16, 2*16, 16, 16)`. Cell size is 16px (the placeholder tests already assert `fillRect(16, 32, 16, 16)` for a `(1, 2)` spawn).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `devbox run node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/app/features/scene-editor/map-canvas.component.spec.ts`

Expected: the frame test FAILS (`strokeRect` not called with `32, 32, 16, 16`).

- [ ] **Step 3: Implement**

In `src/app/features/scene-editor/map-canvas.component.ts`, inside the existing `if (this.playMode()) { ... }` block (`:311-322`), after the player placeholder `strokeRect` and before the closing brace, add the frame draw. `stroke` (accent color) is already defined in that block:

```ts
const target = this.player.interactionTarget();
if (target) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(target.x * cell, target.y * cell, cell, cell);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `devbox run node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/app/features/scene-editor/map-canvas.component.spec.ts`

Expected: PASS (both new tests + 20 existing = 22 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/map-canvas.component.ts src/app/features/scene-editor/map-canvas.component.spec.ts
git commit -m "feature-52: highlight the interaction target in play mode"
```
