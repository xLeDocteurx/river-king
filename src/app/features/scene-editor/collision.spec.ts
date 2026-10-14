import {
  buildBlockingGrid,
  buildCollisionField,
  resolveCollision,
  HALF_CELL_HITBOX,
} from './collision';
import type { CellRect } from './collision';
import type { Layer } from '../../shared/models/scene.model';
import type { TileFootprintMap } from './map-footprint';

function layer(tileData: number[][], visible = true, opacity = 1): Layer {
  return { id: 'l', name: 'l', visible, opacity, tileData };
}

describe('buildBlockingGrid', () => {
  const blocking = new Map<number, boolean>([[1, true]]);

  it('produces a height x width grid of walkable cells for an empty scene', () => {
    const grid = buildBlockingGrid(3, 2, [], new Map(), {});
    expect(grid).toEqual([
      [false, false, false],
      [false, false, false],
    ]);
  });

  it('marks blocking tiles and leaves non-blocking tiles walkable', () => {
    const grid = buildBlockingGrid(3, 1, [layer([[1, 2, -1]])], blocking, {});
    expect(grid[0]).toEqual([true, false, false]);
  });

  it('ignores hidden layers', () => {
    const grid = buildBlockingGrid(3, 1, [layer([[1, -1, -1]], false)], blocking, {});
    expect(grid[0]).toEqual([false, false, false]);
  });

  it('blocks through visible layers even at 0% opacity', () => {
    const grid = buildBlockingGrid(3, 1, [layer([[1, -1, -1]], true, 0)], blocking, {});
    expect(grid[0]).toEqual([true, false, false]);
  });

  it('blocks the full footprint of multi-cell tiles', () => {
    const footprints: TileFootprintMap = { 1: { left: 0, up: 0, right: 1, down: 1 } };
    const scene = [
      [-1, -1, -1, -1],
      [-1, 1, -1, -1],
      [-1, -1, -1, -1],
      [-1, -1, -1, -1],
    ];
    const grid = buildBlockingGrid(4, 4, [layer(scene)], blocking, footprints);
    expect(grid[1][1]).toBe(true);
    expect(grid[1][2]).toBe(true);
    expect(grid[2][1]).toBe(true);
    expect(grid[2][2]).toBe(true);
    expect(grid[0][0]).toBe(false);
  });

  it('marks the cell above a bottom-anchored overhanging tile', () => {
    const footprints = { 1: { left: 0, up: 1, right: 0, down: 0 } };
    const layers = [
      {
        id: 'l1',
        name: 'L',
        visible: true,
        opacity: 1,
        tileData: [
          [-1, -1],
          [-1, 1],
        ],
      },
    ];
    const blocking = new Map<number, boolean>([[1, true]]);

    const grid = buildBlockingGrid(2, 2, layers, blocking, footprints);

    expect(grid[1][1]).toBe(true);
    expect(grid[0][1]).toBe(true);
    expect(grid[0][0]).toBe(false);
  });
});

describe('resolveCollision', () => {
  const bounds = { width: 5, height: 5 };
  const free = buildBlockingGrid(5, 5, [], new Map(), {});
  const half = HALF_CELL_HITBOX;

  function wallGrid(): boolean[][] {
    const grid = buildBlockingGrid(5, 5, [], new Map(), {});
    for (let y = 0; y < 5; y++) grid[y][2] = true;
    return grid;
  }

  function wallGridRow2(): boolean[][] {
    const grid = buildBlockingGrid(5, 5, [], new Map(), {});
    for (let x = 0; x < 5; x++) grid[2][x] = true;
    return grid;
  }

  it('returns the requested position when nothing blocks the path', () => {
    expect(resolveCollision({ x: 2, y: 2 }, { x: 0.5, y: 0.5 }, half, free, bounds)).toEqual({
      x: 2.5,
      y: 2.5,
    });
  });

  it('stops the player before a perpendicular wall', () => {
    expect(resolveCollision({ x: 1.5, y: 1.5 }, { x: 1, y: 0 }, half, wallGrid(), bounds)).toEqual({
      x: 1.75,
      y: 1.5,
    });
  });

  it('slides along a wall instead of stopping when moving diagonally', () => {
    expect(
      resolveCollision({ x: 1.5, y: 1.5 }, { x: 0.5, y: 0.5 }, half, wallGrid(), bounds),
    ).toEqual({
      x: 1.75,
      y: 2,
    });
  });

  it('does not tunnel through a wall even with a large delta', () => {
    expect(resolveCollision({ x: 1.5, y: 1.5 }, { x: 5, y: 0 }, half, wallGrid(), bounds)).toEqual({
      x: 1.75,
      y: 1.5,
    });
  });

  it('clamps the center inside the scene bounds via blocked out-of-scene cells', () => {
    expect(resolveCollision({ x: 0.5, y: 0.5 }, { x: -5, y: 0 }, half, free, bounds)).toEqual({
      x: 0.25,
      y: 0.5,
    });
    expect(resolveCollision({ x: 4.5, y: 4.5 }, { x: 0, y: 5 }, half, free, bounds)).toEqual({
      x: 4.5,
      y: 4.75,
    });
  });

  it('does not tunnel through a wall when starting already flush against it', () => {
    expect(resolveCollision({ x: 1.75, y: 1.5 }, { x: 1, y: 0 }, half, wallGrid(), bounds)).toEqual(
      {
        x: 1.75,
        y: 1.5,
      },
    );
  });

  it('does not embed into a wall when starting flush and pushing into it', () => {
    expect(
      resolveCollision({ x: 1.75, y: 1.5 }, { x: 0.25, y: 0 }, half, wallGrid(), bounds),
    ).toEqual({
      x: 1.75,
      y: 1.5,
    });
  });

  it('keeps sliding along a wall when already flush against it', () => {
    const first = resolveCollision(
      { x: 1.5, y: 1.5 },
      { x: 0.5, y: 0.5 },
      half,
      wallGrid(),
      bounds,
    );
    const second = resolveCollision(first, { x: 0.5, y: 0.5 }, half, wallGrid(), bounds);
    expect(first).toEqual({ x: 1.75, y: 2 });
    expect(second).toEqual({ x: 1.75, y: 2.5 });
  });

  it('does not tunnel through a horizontal wall when starting flush below it', () => {
    expect(
      resolveCollision({ x: 1.5, y: 1.75 }, { x: 0, y: 0.5 }, half, wallGridRow2(), bounds),
    ).toEqual({
      x: 1.5,
      y: 1.75,
    });
    expect(
      resolveCollision({ x: 1.5, y: 1.75 }, { x: 0, y: 0.25 }, half, wallGridRow2(), bounds),
    ).toEqual({
      x: 1.5,
      y: 1.75,
    });
  });
});

describe('buildCollisionField', () => {
  it('marks unmasked blocking tiles over their full footprint', () => {
    const field = buildCollisionField(
      3,
      1,
      [layer([[1, -1, -1]])],
      new Map([[1, { blocking: true }]]),
      {},
    );
    expect(field.full[0]).toEqual([true, false, false]);
    expect(field.sub[0]).toEqual([null, null, null]);
  });

  it('maps solid mask pixels to sub-cell rects and leaves empty pixels walkable', () => {
    const mask = [
      [1, 0],
      [0, 1],
    ];
    const field = buildCollisionField(
      1,
      1,
      [layer([[1]])],
      new Map([[1, { blocking: true, mask }]]),
      {},
    );
    expect(field.full[0][0]).toBe(false);
    const rects = field.sub[0][0]!;
    expect(rects).toHaveLength(2);
    expect(rects).toContainEqual({ x0: 0, y0: 0, x1: 0.5, y1: 0.5 });
    expect(rects).toContainEqual({ x0: 0.5, y0: 0.5, x1: 1, y1: 1 });
  });

  it('treats an all-zero mask as fully passable', () => {
    const field = buildCollisionField(
      1,
      1,
      [layer([[1]])],
      new Map([[1, { blocking: true, mask: [[0, 0], [0, 0]] }]]),
      {},
    );
    expect(field.full[0][0]).toBe(false);
    expect(field.sub[0][0]).toBeNull();
  });
});

describe('resolveCollision with masked sub-rects', () => {
  const bounds = { width: 3, height: 1 };
  const half = HALF_CELL_HITBOX;

  function emptyGrid(): boolean[][] {
    return buildBlockingGrid(3, 1, [], new Map(), {});
  }

  function subGrid(): (CellRect[] | null)[][] {
    return [[null, [{ x0: 1, y0: 0, x1: 1.5, y1: 0.5 }], null]];
  }

  it('lets the hitbox pass a masked cell where the mask is empty', () => {
    // Player center y=0.75 -> span [0.5,1] which misses the solid rect [0,0.5].
    expect(resolveCollision({ x: 0.5, y: 0.75 }, { x: 1, y: 0 }, half, emptyGrid(), bounds, subGrid())).toEqual(
      { x: 1.5, y: 0.75 },
    );
  });

  it('stops the hitbox at a masked cell where the mask is solid', () => {
    const result = resolveCollision(
      { x: 0.5, y: 0.25 },
      { x: 1, y: 0 },
      half,
      emptyGrid(),
      bounds,
      subGrid(),
    );
    expect(result).toEqual({ x: 0.75, y: 0.25 });
  });

  it('keeps the #51 behaviour when no sub-rects are provided', () => {
    const wall = emptyGrid();
    wall[0][1] = true;
    expect(resolveCollision({ x: 0.5, y: 0.5 }, { x: 1, y: 0 }, half, wall, bounds)).toEqual({
      x: 0.75,
      y: 0.5,
    });
  });
});

