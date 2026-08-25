/**
 * Footprint of a tile expressed in grid cells.
 */
export interface TileFootprint {
  /** Width of the footprint in grid cells. */
  w: number;
  /** Height of the footprint in grid cells. */
  h: number;
}

/** Map of tile id to its grid-cell footprint. Entries may be absent for 1×1 tiles. */
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
