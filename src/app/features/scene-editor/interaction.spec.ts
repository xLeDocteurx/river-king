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
    expect(findInteractableTarget({ x: 1, y: 0 }, { dx: 1, dy: 0 }, [layerWith(7, [[2, 0]])], new Map())).toBeNull();
  });

  it('honors the topmost layer when the facing cell stacks two interactable tiles', () => {
    const bottom = layerWith(7, [[2, 0]]);
    const top = layer('top', [[-1, -1, 8], [-1, -1, -1]]);
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