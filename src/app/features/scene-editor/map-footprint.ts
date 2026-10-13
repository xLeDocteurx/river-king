import {
  EMPTY_FOOTPRINT,
  type AnchorFootprint,
  type TileFootprintMap,
} from '../../shared/models/tile-anchor';

export type { AnchorFootprint, TileFootprintMap } from '../../shared/models/tile-anchor';

/** Backwards-compatible alias for a tile footprint. */
export type TileFootprint = AnchorFootprint;

/**
 * Returns the directional grid-cell footprint of a tile.
 * @param tileId - The tile whose footprint to look up.
 * @param footprints - Known footprints keyed by tile id.
 * @returns The stored footprint, or an empty (1×1) footprint when absent.
 */
export function getFootprint(tileId: number, footprints: TileFootprintMap): AnchorFootprint {
  return footprints[tileId] ?? EMPTY_FOOTPRINT;
}

/**
 * Computes the absolute grid rectangle covered by a tile anchored at (x, y).
 * @param x - Anchor cell column.
 * @param y - Anchor cell row.
 * @param tileId - The tile whose footprint to apply.
 * @param footprints - Known footprints keyed by tile id.
 * @returns The absolute rectangle `{x, y, w, h}` in grid cells.
 */
export function footprintRect(
  x: number,
  y: number,
  tileId: number,
  footprints: TileFootprintMap,
): { x: number; y: number; w: number; h: number } {
  const fp = getFootprint(tileId, footprints);
  return {
    x: x - fp.left,
    y: y - fp.up,
    w: fp.left + fp.right + 1,
    h: fp.up + fp.down + 1,
  };
}

/**
 * Returns a new tileData array where every existing anchor whose absolute
 * footprint rectangle intersects `(x, y, w, h)` is cleared to -1 (the "Replace"
 * placement policy). The rectangle is the placed tile's absolute footprint.
 * @param tileData - Current scene grid (-1 = empty, >=0 = tile id anchor).
 * @param x - Placed rectangle top-left column (absolute).
 * @param y - Placed rectangle top-left row (absolute).
 * @param w - Placed rectangle width in grid cells.
 * @param h - Placed rectangle height in grid cells.
 * @param footprints - Known footprints keyed by tile id.
 * @returns A new array where intersecting anchors are cleared.
 */
export function clearOverlappedAnchors(
  tileData: number[][],
  x: number,
  y: number,
  w: number,
  h: number,
  footprints: TileFootprintMap,
): number[][] {
  return tileData.map((row, cy) =>
    row.map((tileId, cx) => {
      if (tileId < 0) return tileId;
      const rect = footprintRect(cx, cy, tileId, footprints);
      const intersects =
        rect.x < x + w && x < rect.x + rect.w && rect.y < y + h && y < rect.y + rect.h;
      return intersects ? -1 : tileId;
    }),
  );
}
