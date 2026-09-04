import { buildBlockingGrid, resolveCollision, HALF_CELL_HITBOX } from './collision';
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
    const footprints: TileFootprintMap = { 1: { w: 2, h: 2 } };
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
