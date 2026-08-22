# Multi-cell Map Footprints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render tiles at their real sprite footprint on the map canvas, replace overlapped tiles when placing ("Replace" policy), respect the project `tileSize`, and show real thumbnails in the right-side tile palette.

**Architecture:** `MapTilesService.loadTileVisuals` computes per-tile footprints (in grid cells, from `Sprite.width/height` ÷ project `tileSize`, ceil) alongside the existing image sources. Pure geometry helpers (`map-footprint.ts`) are shared by the canvas renderer (draw each anchor once over its footprint, skip covered cells) and the editor (clear overlapped anchors before writing the new one).

**Tech Stack:** Angular 22 (standalone, signals, OnPush), Vitest via `@angular/build:unit-test` (jsdom), Dexie/fake-indexeddb, Tailwind v3 with `tw-` prefix.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-22-map-multicell-footprints-design.md`
- Run ALL commands through devbox: `devbox run npm run test|lint|format`. Bare `npx vitest` does NOT work in this repo (no jsdom env, `HTMLDialogElement is not defined`). There is no per-file test runner shortcut — run the full suite.
- Commit message prefix: `feature-11-tile-screen-rework: <summary>`
- Every exported function/interface needs JSDoc (`@param`, `@returns`) per AGENTS.md.
- Components stay OnPush + standalone; templates never inlined.
- jsdom cannot decode images or provide canvas 2D contexts — never depend on `img.naturalWidth` or a working context in production logic paths that need testing.
- Suite currently passes: 143 tests / 26 files. Keep it green after every task.

---

### Task 1: Pure footprint helpers

**Files:**
- Create: `src/app/features/scene-editor/map-footprint.ts`
- Test: `src/app/features/scene-editor/map-footprint.spec.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `type TileFootprint = { w: number; h: number }`, `type TileFootprintMap = Record<number, TileFootprint>`, `getFootprint(tileId: number, footprints: TileFootprintMap): TileFootprint`, `clearOverlappedAnchors(tileData: number[][], x: number, y: number, w: number, h: number, footprints: TileFootprintMap): number[][]`. Later tasks import both types and both functions from `./map-footprint`.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/scene-editor/map-footprint.spec.ts`:

```ts
import { clearOverlappedAnchors, getFootprint } from './map-footprint';

describe('getFootprint', () => {
  it('defaults to a 1x1 footprint when the tile has no entry', () => {
    expect(getFootprint(7, {})).toEqual({ w: 1, h: 1 });
  });

  it('returns the stored footprint for a known tile', () => {
    expect(getFootprint(7, { 7: { w: 2, h: 3 } })).toEqual({ w: 2, h: 3 });
  });
});

describe('clearOverlappedAnchors', () => {
  const footprints = { 1: { w: 2, h: 2 }, 9: { w: 1, h: 1 } };

  it('removes only anchors whose footprint intersects the rectangle', () => {
    const tileData = [
      [1, -1, -1],
      [-1, -1, 9],
      [-1, -1, -1],
    ];

    const result = clearOverlappedAnchors(tileData, 1, 1, 2, 1, footprints);

    // Tile 1 anchored at (0,0) spans cells x 0..1 / y 0..1 -> shares (1,1).
    expect(result[0][0]).toBe(-1);
    // Tile 9 anchored at (2,1) sits inside the rectangle x 1..2 / y 1..1.
    expect(result[1][2]).toBe(-1);
  });

  it('keeps anchors outside the rectangle', () => {
    const tileData = [
      [-1, -1, -1],
      [-1, -1, -1],
      [-1, -1, 9],
    ];

    const result = clearOverlappedAnchors(tileData, 0, 0, 2, 2, footprints);

    expect(result[2][2]).toBe(9);
  });

  it('does not mutate the input array', () => {
    const tileData = [
      [1, -1],
      [-1, 9],
    ];

    clearOverlappedAnchors(tileData, 0, 0, 2, 2, footprints);

    expect(tileData[0][0]).toBe(1);
    expect(tileData[1][1]).toBe(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test`
Expected: FAIL — `Cannot find module './map-footprint'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/features/scene-editor/map-footprint.ts`:

```ts
/**
 * Footprint of a tile expressed in grid cells.
 */
export interface TileFootprint {
  /** Width of the footprint in grid cells. */
  w: number;
  /** Height of the footprint in grid cells. */
  h: number;
}

/** Map of tile id to its grid-cell footprint. */
export type TileFootprintMap = Record<number, TileFootprint>;

/**
 * Returns the grid-cell footprint of a tile.
 * @param tileId - The tile whose footprint to look up.
 * @param footprints - Known footprints keyed by tile id.
 * @returns The stored footprint, or a 1x1 footprint when absent.
 */
export function getFootprint(tileId: number, footprints: TileFootprintMap): TileFootprint {
  return footprints[tileId] ?? { w: 1, h: 1 };
}

/**
 * Returns a new tileData array where every existing anchor whose footprint
 * intersects the rectangle starting at (x, y) sized w*h is cleared to -1
 * (the "Replace" placement policy).
 * @param tileData - Current scene grid (-1 = empty, >=0 = tile id anchor).
 * @param x - Rectangle top-left column.
 * @param y - Rectangle top-left row.
 * @param w - Rectangle width in cells.
 * @param h - Rectangle height in cells.
 * @param footprints - Known footprints keyed by tile id.
 * @returns A new tileData array; the input is never mutated.
 */
export function clearOverlappedAnchors(
  tileData: number[][],
  x: number,
  y: number,
  w: number,
  h: number,
  footprints: TileFootprintMap,
): number[][] {
  const result = tileData.map((row) => [...row]);
  for (let cy = 0; cy < result.length; cy++) {
    for (let cx = 0; cx < result[cy].length; cx++) {
      const tileId = result[cy][cx];
      if (tileId < 0) continue;
      const fp = getFootprint(tileId, footprints);
      const intersects = cx < x + w && x < cx + fp.w && cy < y + h && y < cy + fp.h;
      if (intersects) {
        result[cy][cx] = -1;
      }
    }
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test`
Expected: PASS — all suites green (143 + 5 new = 148 tests / 27 files).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/map-footprint.ts src/app/features/scene-editor/map-footprint.spec.ts
git commit -m "feature-11-tile-screen-rework: add pure tile footprint helpers"
```

---

### Task 2: Service returns images + footprints

**Files:**
- Modify: `src/app/features/scene-editor/services/map-tiles.service.ts` (replace whole method)
- Modify: `src/app/features/scene-editor/services/map-tiles.service.spec.ts`
- Modify: `src/app/features/scene-editor/scene-editor.component.ts:61-62,90-119` (data loading adaptation)

**Interfaces:**
- Consumes: `TileFootprintMap` from `../map-footprint`.
- Produces: `MapTilesService.loadTileVisuals(projectId: string, tileSizePx: number): Promise<{ images: Record<number, string>; footprints: TileFootprintMap }>` (replaces `loadTileImages`, which is deleted). SceneEditor exposes signals `projectTileSize = signal<number>(16)` and `tileFootprints = signal<TileFootprintMap>({})` used by Tasks 4–5.

- [ ] **Step 1: Update the failing tests**

In `map-tiles.service.spec.ts`, replace every `service.loadTileImages('proj-1')` call with `(await service.loadTileVisuals('proj-1', 16)).images` and destructure accordingly. Concretely, the five `it` bodies become:

```ts
it('returns an empty record when the project has no sprites', async () => {
  const { images } = await service.loadTileVisuals('proj-1', 16);
  expect(images).toEqual({});
});

it('maps each tileId to the pixelData of its first (lowest-id) frame', async () => {
  const first = await seedSprite({ tileId: 1, pixelData: 'data:image/png;base64,F1' });
  const second = await seedSprite({ tileId: 1, pixelData: 'data:image/png;base64,F2' });
  const other = await seedSprite({ tileId: 2, pixelData: 'data:image/png;base64,T2' });

  const { images } = await service.loadTileVisuals('proj-1', 16);

  expect(images[1]).toBe(first.pixelData);
  expect(images[1]).not.toBe(second.pixelData);
  expect(images[2]).toBe(other.pixelData);
  expect(Object.keys(images)).toHaveLength(2);
});

it('returns exactly one entry per tile when several frames exist', async () => {
  await seedSprite({ tileId: 5, pixelData: 'data:image/png;base64,A' });
  await seedSprite({ tileId: 5, pixelData: 'data:image/png;base64,B' });

  const { images } = await service.loadTileVisuals('proj-1', 16);

  expect(Object.keys(images)).toEqual(['5']);
});

it('ignores standalone sprites (tileId <= 0)', async () => {
  await seedSprite({ tileId: 0 });
  const { images, footprints } = await service.loadTileVisuals('proj-1', 16);
  expect(images).toEqual({});
  expect(footprints).toEqual({});
});

it('only returns sprites belonging to the requested project', async () => {
  const mine = await seedSprite({ projectId: 'proj-1', tileId: 3 });
  await seedSprite({ projectId: 'proj-2', tileId: 3, pixelData: 'data:image/png;base64,OTHER' });

  const { images } = await service.loadTileVisuals('proj-1', 16);

  expect(images[3]).toBe(mine.pixelData);
});
```

Then append three new footprint tests before the closing `});`:

```ts
it('computes footprints in grid cells using ceil of sprite dimensions', async () => {
  await seedSprite({ tileId: 1, width: 32, height: 40 });

  const { images, footprints } = await service.loadTileVisuals('proj-1', 16);

  expect(images[1]).toBeDefined();
  expect(footprints[1]).toEqual({ w: 2, h: 3 });
});

it('clamps footprints to at least one cell', async () => {
  await seedSprite({ tileId: 1, width: 8, height: 5 });

  const { footprints } = await service.loadTileVisuals('proj-1', 16);

  expect(footprints[1]).toEqual({ w: 1, h: 1 });
});

it('honours the provided tile size when computing footprints', async () => {
  await seedSprite({ tileId: 1, width: 48, height: 16 });

  const { footprints } = await service.loadTileVisuals('proj-1', 24);

  expect(footprints[1]).toEqual({ w: 2, h: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test`
Expected: FAIL — `loadTileVisuals is not a function`.

- [ ] **Step 3: Implement the service**

Replace the whole content of `src/app/features/scene-editor/services/map-tiles.service.ts` with:

```ts
import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Sprite } from '../../../shared/models/sprite.model';
import type { TileFootprintMap } from '../map-footprint';

/**
 * Feature-private service responsible for loading the visual data of every
 * tile in a project: the first frame (lowest-id sprite) image source plus
 * that sprite's footprint expressed in grid cells.
 */
@Injectable()
export class MapTilesService {
  private readonly db = inject(DatabaseService);

  /**
   * Loads the first sprite for each tile in the project and returns both its
   * `pixelData` image source and its footprint in grid cells. Footprints use
   * ceil(sprite dimension / tileSizePx), clamped to at least one cell.
   * Standalone sprites (tileId <= 0) are ignored so tiles without sprites can
   * fall back to a palette color.
   *
   * @param projectId - The project whose tiles should be loaded.
   * @param tileSizePx - Size of one grid cell in pixels (project setting).
   * @returns Images (tileId -> data URI) and footprints (tileId -> cells).
   * @throws When the underlying database query fails.
   */
  async loadTileVisuals(
    projectId: string,
    tileSizePx: number,
  ): Promise<{ images: Record<number, string>; footprints: TileFootprintMap }> {
    const sprites = await this.db.sprites.where('projectId').equals(projectId).toArray();

    // Keep only the first sprite (lowest id) for each tileId.
    const firstByTile = new Map<number, Sprite>();
    for (const sprite of sprites) {
      if (sprite.tileId <= 0) continue;
      const existing = firstByTile.get(sprite.tileId);
      if (!existing || sprite.id < existing.id) {
        firstByTile.set(sprite.tileId, sprite);
      }
    }

    const images: Record<number, string> = {};
    const footprints: TileFootprintMap = {};
    for (const [tileId, sprite] of firstByTile) {
      images[tileId] = sprite.pixelData;
      footprints[tileId] = {
        w: Math.max(1, Math.ceil(sprite.width / tileSizePx)),
        h: Math.max(1, Math.ceil(sprite.height / tileSizePx)),
      };
    }
    return { images, footprints };
  }
}
```

Then adapt the single caller in `scene-editor.component.ts` so the build stays green:

1. Add the type import next to the other model imports:

```ts
import type { TileFootprintMap } from './map-footprint';
```

2. Add two signals after `tileImages` (line ~62):

```ts
/** Grid-cell footprint of each tile, derived from its first sprite. */
tileFootprints = signal<TileFootprintMap>({});
/** Size of one grid cell in pixels, from the project settings. */
projectTileSize = signal<number>(16);
```

3. In `loadProjectData()` (line ~95-98), also store the project tile size:

```ts
if (project) {
  this.projectPalette.set(project.palette);
  this.projectTileSize.set(project.tileSize ?? 16);
}
```

4. Rename `loadTileImages()` to `loadTileVisuals()` and update its body + the call site at line ~101 (`await this.loadTileImages();` becomes `await this.loadTileVisuals();`):

```ts
/**
 * Loads the first sprite image and footprint of each tile in the project.
 */
async loadTileVisuals(): Promise<void> {
  try {
    const { images, footprints } = await this.mapTilesService.loadTileVisuals(
      this.projectId(),
      this.projectTileSize(),
    );
    this.tileImages.set(images);
    this.tileFootprints.set(footprints);
  } catch (e) {
    console.error('Failed to load tile images:', e);
    this.notification.error('Failed to load tile images.');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test`
Expected: PASS — 151 tests / 27 files.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/services/map-tiles.service.ts src/app/features/scene-editor/services/map-tiles.service.spec.ts src/app/features/scene-editor/scene-editor.component.ts
git commit -m "feature-11-tile-screen-rework: load tile visuals with grid-cell footprints"
```

---

### Task 3: Canvas renders footprints and bounds-checks placement

**Files:**
- Modify: `src/app/features/scene-editor/map-canvas.component.ts`
- Create: `src/app/features/scene-editor/map-canvas.component.spec.ts`

**Interfaces:**
- Consumes: `getFootprint`, `TileFootprintMap` from `./map-footprint`.
- Produces: inputs `tileSize = input(16)` and `tileFootprints = input<TileFootprintMap>({})` consumed by Task 4's template bindings. `tilePlaced` payload unchanged `{ x, y, tileId }`; emission now guaranteed to fit the whole footprint.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/scene-editor/map-canvas.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { MapCanvasComponent } from './map-canvas.component';
import type { Scene } from '../../shared/models/scene.model';

// jsdom does not implement ResizeObserver (used by MapCanvasComponent)
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = ResizeObserverStub;
}

function makeScene(width = 4, height = 4): Scene {
  return {
    id: 'scene-1',
    projectId: 'proj-1',
    name: 'S',
    folderPath: '',
    width,
    height,
    tileData: Array.from({ length: height }, () => Array<number>(width).fill(-1)),
  };
}

describe('MapCanvasComponent', () => {
  let fixture: ComponentFixture<MapCanvasComponent>;
  let placed: { x: number; y: number; tileId: number }[];

  function setup(scene: Scene, footprints: Record<number, { w: number; h: number }> = {}): void {
    TestBed.configureTestingModule({ imports: [MapCanvasComponent] });
    fixture = TestBed.createComponent(MapCanvasComponent);
    placed = [];
    fixture.componentInstance.tilePlaced.subscribe((e) => placed.push(e));
    fixture.componentRef.setInput('scene', scene);
    fixture.componentRef.setInput('selectedTileId', 1);
    fixture.componentRef.setInput('tileFootprints', footprints);
    fixture.detectChanges();
  }

  function click(instance: MapCanvasComponent, clientX: number, clientY: number): void {
    // jsdom rects are all-zero, so client coords equal canvas-relative coords.
    instance.onMouseDown(new MouseEvent('mousedown', { button: 0, clientX, clientY }));
  }

  it('emits the clicked cell when the default 1x1 footprint fits', () => {
    setup(makeScene());
    click(fixture.componentInstance, 10, 20);

    expect(placed).toEqual([{ x: 0, y: 1, tileId: 1 }]);
  });

  it('does not emit when a large footprint would exceed the scene bounds', () => {
    setup(makeScene(4, 4), { 1: { w: 2, h: 2 } });
    // Click lands on cell (3,0): 3 + 2 > width 4.
    click(fixture.componentInstance, 55, 10);

    expect(placed).toEqual([]);
  });

  it('emits when the same footprint fits flush against the edge', () => {
    setup(makeScene(4, 4), { 1: { w: 2, h: 2 } });
    // Click lands on cell (2,1): 2 + 2 <= 4 and 1 + 2 <= 4.
    click(fixture.componentInstance, 33, 20);

    expect(placed).toEqual([{ x: 2, y: 1, tileId: 1 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test`
Expected: FAIL — `setInput` errors on unknown input `tileFootprints` (and/or bounds tests fail because placement ignores footprints today).

- [ ] **Step 3: Implement**

In `map-canvas.component.ts`:

1. Add imports (after the existing `Scene` type import):

```ts
import { getFootprint } from './map-footprint';
import type { TileFootprintMap } from './map-footprint';
```

2. Add two inputs after `tileImages` (line ~36):

```ts
/** Size of one grid cell in pixels (from the project settings). */
tileSize = input(16);
/** Grid-cell footprint of each tile id; missing entries mean 1x1. */
tileFootprints = input<TileFootprintMap>({});
```

3. Delete the field `private readonly tileSize = 16;` (line ~60).

4. In the constructor effect, track the new inputs:

```ts
constructor() {
  effect(() => {
    // Re-render whenever rendering inputs change
    this.palette();
    this.tileSize();
    this.tileFootprints();
    const sources = this.tileImages();
    void this.rebuildImageCache(sources);
    this.render();
  });
}
```

5. Replace `render()` with:

```ts
/**
 * Renders the current scene onto the canvas. Each tile anchor is drawn once
 * across its whole footprint; cells covered by another anchor's footprint
 * are skipped so nothing paints twice.
 */
render(): void {
  const ctx = this.ctx;
  const canvas = this.canvasRef()?.nativeElement;
  if (!ctx || !canvas) return;

  const scene = this.scene();
  if (!scene) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cell = this.tileSize();

  ctx.save();
  ctx.translate(this.cameraX(), this.cameraY());
  ctx.scale(this.zoom(), this.zoom());

  this.drawGrid(ctx, scene.width, scene.height, cell);

  const tileImages = this.loadedImages();
  const anchors: { x: number; y: number; tileId: number }[] = [];
  const covered = new Set<string>();
  for (let y = 0; y < scene.height; y++) {
    for (let x = 0; x < scene.width; x++) {
      const tileId = scene.tileData[y]?.[x] ?? -1;
      if (tileId >= 0) {
        anchors.push({ x, y, tileId });
        const { w, h } = getFootprint(tileId, this.tileFootprints());
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            covered.add(`${x + dx},${y + dy}`);
          }
        }
      }
    }
  }

  for (const { x, y, tileId } of anchors) {
    const { w, h } = getFootprint(tileId, this.tileFootprints());
    const img = tileImages[tileId];
    if (img) {
      ctx.drawImage(img, x * cell, y * cell, w * cell, h * cell);
    } else {
      ctx.fillStyle = this.getTileColor(tileId);
      ctx.fillRect(x * cell, y * cell, w * cell, h * cell);
    }
  }

  ctx.restore();
}
```

6. Change `drawGrid` signature to take the cell size:

```ts
/** @internal Draws the grid behind the tiles. */
private drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cell: number,
): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cell, 0);
    ctx.lineTo(x * cell, height * cell);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell);
    ctx.lineTo(width * cell, y * cell);
    ctx.stroke();
  }
}
```

7. Replace `placeTile()` with:

```ts
/** @internal Calculates grid coordinates and emits a tilePlaced event. The whole footprint must fit inside the scene. */
private placeTile(event: MouseEvent): void {
  const canvas = this.canvasRef().nativeElement;
  const rect = canvas.getBoundingClientRect();
  const cell = this.tileSize();
  const x = Math.floor((event.clientX - rect.left - this.cameraX()) / (cell * this.zoom()));
  const y = Math.floor((event.clientY - rect.top - this.cameraY()) / (cell * this.zoom()));
  const scene = this.scene();
  const tileId = this.selectedTileId();
  if (!scene || tileId === null) return;

  const { w, h } = getFootprint(tileId, this.tileFootprints());
  if (x >= 0 && y >= 0 && x + w <= scene.width && y + h <= scene.height) {
    this.tilePlaced.emit({ x, y, tileId });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test`
Expected: PASS — 154 tests / 28 files. (jsdom prints "Not implemented: HTMLCanvasElement's getContext()" warnings; harmless.)

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/map-canvas.component.ts src/app/features/scene-editor/map-canvas.component.spec.ts
git commit -m "feature-11-tile-screen-rework: render multi-cell footprints and bounds-check placement"
```

---

### Task 4: Editor applies the Replace policy

**Files:**
- Modify: `src/app/features/scene-editor/scene-editor.component.ts` (imports + `onTilePlaced`)
- Modify: `src/app/features/scene-editor/scene-editor.component.html:14-19` (canvas bindings)
- Modify: `src/app/features/scene-editor/scene-editor.component.spec.ts`

**Interfaces:**
- Consumes: `clearOverlappedAnchors`, `getFootprint` from `./map-footprint`; canvas inputs `tileSize`/`tileFootprints` from Task 3; signal `tileFootprints` from Task 2.
- Produces: nothing new downstream.

- [ ] **Step 1: Write the failing test**

Append to `scene-editor.component.spec.ts` (inside the existing `describe`):

```ts
it('replaces overlapped anchors when placing a multi-cell tile', async () => {
  fixture.detectChanges();
  await fixture.whenStable();

  const scene = await sceneService.createScene('p1', 'Footprint', 4, 4);
  await component.loadScenes();
  await component.selectScene(scene.id);
  component.tileFootprints.set({ 1: { w: 2, h: 2 } });

  await component.onTilePlaced({ x: 2, y: 1, tileId: 9 });
  await component.onTilePlaced({ x: 1, y: 1, tileId: 1 });

  const expected = [
    [-1, -1, -1, -1],
    [-1, 1, -1, -1],
    [-1, -1, -1, -1],
    [-1, -1, -1, -1],
  ];
  expect(component.selectedScene()?.tileData).toEqual(expected);
  const stored = await db.scenes.get(scene.id);
  expect(stored?.tileData).toEqual(expected);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test`
Expected: FAIL — the second placement overwrites only cell (1,1); tile 9 survives at (2,1), so `stored?.tileData[1][2]` is `9` instead of `-1`.

- [ ] **Step 3: Implement**

1. In `scene-editor.component.ts`, add the helpers import (next to the service imports):

```ts
import { clearOverlappedAnchors, getFootprint } from './map-footprint';
```

2. Replace `onTilePlaced` (lines ~235-253) with:

```ts
/**
 * Handles a tile placement event from the map canvas: removes every anchor
 * overlapping the incoming footprint (Replace policy), writes the new anchor,
 * then persists the updated grid.
 * @param event Object containing x, y coordinates and the placed tile id.
 */
async onTilePlaced(event: { x: number; y: number; tileId: number }): Promise<void> {
  const scene = this.selectedScene();
  if (!scene) return;

  try {
    const { w, h } = getFootprint(event.tileId, this.tileFootprints());
    const newTileData = clearOverlappedAnchors(
      scene.tileData,
      event.x,
      event.y,
      w,
      h,
      this.tileFootprints(),
    );
    newTileData[event.y][event.x] = event.tileId;

    await this.sceneService.updateScene(scene.id, { tileData: newTileData });
    this.selectedScene.update((s) => (s ? { ...s, tileData: newTileData } : null));
  } catch (e) {
    console.error('Failed to place tile:', e);
    this.notification.error('Failed to place the tile.');
  }
}
```

3. In `scene-editor.component.html`, bind the new canvas inputs on `<rk-map-canvas>`:

```html
<rk-map-canvas
  [scene]="selectedScene()"
  [selectedTileId]="selectedTileId()"
  [palette]="projectPalette()"
  [tileImages]="tileImages()"
  [tileSize]="projectTileSize()"
  [tileFootprints]="tileFootprints()"
  (tilePlaced)="onTilePlaced($event)"
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test`
Expected: PASS — 155 tests / 28 files.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/scene-editor.component.ts src/app/features/scene-editor/scene-editor.component.html src/app/features/scene-editor/scene-editor.component.spec.ts
git commit -m "feature-11-tile-screen-rework: replace overlapped tiles on multi-cell placement"
```

---

### Task 5: Real thumbnails in the tile palette

**Files:**
- Modify: `src/app/features/scene-editor/tile-palette.component.ts`
- Modify: `src/app/features/scene-editor/tile-palette.component.html`
- Modify: `src/app/features/scene-editor/scene-editor.component.html` (`<rk-tile-palette>` binding)
- Create: `src/app/features/scene-editor/tile-palette.component.spec.ts`

**Interfaces:**
- Consumes: signal `tileImages` from Task 2 (bound as `[tileImages]`).
- Produces: input `tileImages = input<Record<number, string>>({})` on `TilePaletteComponent`.

- [ ] **Step 1: Write the failing test**

Create `src/app/features/scene-editor/tile-palette.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TilePaletteComponent } from './tile-palette.component';
import type { Tile } from '../../shared/models/tile.model';

function makeTile(id: number, name: string): Tile {
  return {
    id,
    projectId: 'proj-1',
    name,
    type: 'static',
    spriteIds: [],
    animationSpeed: 8,
    properties: { blocking: false, interactable: false },
  };
}

describe('TilePaletteComponent', () => {
  let fixture: ComponentFixture<TilePaletteComponent>;

  function setup(
    tiles: Tile[],
    tileImages: Record<number, string>,
  ): ComponentFixture<TilePaletteComponent> {
    TestBed.configureTestingModule({ imports: [TilePaletteComponent] });
    fixture = TestBed.createComponent(TilePaletteComponent);
    fixture.componentRef.setInput('tiles', tiles);
    fixture.componentRef.setInput('tileImages', tileImages);
    fixture.detectChanges();
    return fixture;
  }

  it('renders an image preview when a tile image exists', () => {
    const compiled = setup([makeTile(1, 'Water')], { 1: 'data:image/png;base64,IMG' })
      .nativeElement as HTMLElement;

    const img = compiled.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,IMG');
  });

  it('keeps a plain colored button when no tile image exists', () => {
    const compiled = setup([makeTile(2, 'Void')], {}).nativeElement as HTMLElement;

    expect(compiled.querySelector('img')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `devbox run npm run test`
Expected: FAIL — unknown input `tileImages` (first test finds no `<img>` either way).

- [ ] **Step 3: Implement**

1. In `tile-palette.component.ts`, add the input after `selectedTileId` and refresh the class JSDoc:

```ts
/** Image sources (data URIs) per tile id, used as real previews. */
tileImages = input<Record<number, string>>({});
```

(Class doc becomes: `Displays a palette of project tiles for selection. Shows the tile's first-frame thumbnail when available, falling back to a palette color.`)

2. In `tile-palette.component.html`, replace the `<button>` block (lines 8-15) with:

```html
<button
  type="button"
  (click)="tileSelect.emit(tile.id)"
  [class.tw-ring-2]="selectedTileId() === tile.id"
  class="tw-w-10 tw-h-10 tw-rounded-md tw-border tw-border-border tw-transition hover:tw-border-primary tw-overflow-hidden"
  [style.background-color]="getTileColor(tile.id)"
  [title]="tile.name"
>
  @if (tileImages()[tile.id]) {
    <img
      [src]="tileImages()[tile.id]"
      alt=""
      class="tw-w-full tw-h-full tw-object-cover tw-pointer-events-none"
    />
  }
</button>
```

(The palette-color background stays as fallback behind the image.)

3. In `scene-editor.component.html`, add the binding to `<rk-tile-palette>`:

```html
<rk-tile-palette
  class="tw-w-64 tw-shrink-0"
  [tiles]="projectTiles()"
  [selectedTileId]="selectedTileId()"
  [palette]="projectPalette()"
  [tileImages]="tileImages()"
  (tileSelect)="selectedTileId.set($event)"
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `devbox run npm run test`
Expected: PASS — 157 tests / 29 files.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/scene-editor/tile-palette.component.ts src/app/features/scene-editor/tile-palette.component.html src/app/features/scene-editor/scene-editor.component.html src/app/features/scene-editor/tile-palette.component.spec.ts
git commit -m "feature-11-tile-screen-rework: show real tile thumbnails in the palette"
```

---

### Task 6: Final verification

**Files:** none created.

- [ ] **Step 1: Format, lint, full suite, build**

```bash
devbox run npm run format
devbox run npm run lint
devbox run npm run test
devbox run npm run build
```

Expected: format leaves files unchanged (or trivial reflows to commit); lint reports zero problems; tests pass (~157 / 29 files, exit 0 — if the known-flaky `pixel-data.spec.ts > encodePixelData > encodes pixel data from palette indices` trips once, re-run before investigating); build completes around 270 kB initial.

- [ ] **Step 2: Fix anything found, then report**

If verification surfaces issues, fix them and amend NOTHING — make a follow-up commit with the standard prefix. Report results to the user.
