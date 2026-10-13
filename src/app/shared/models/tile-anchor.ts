/**
 * Ground-cell anchor and four-directional footprint maths for tiles.
 *
 * A tile's anchor is the top-left, in pixels, of a `ts×ts` ground zone inside
 * the frame's artwork (frame-relative). The artwork may overflow that zone on
 * any side; the overflow, expressed in whole grid cells, is the footprint.
 * These helpers are pure so both the editor and the scene renderer share them.
 */

/** Top-left, in pixels, of a tile's `ts×ts` ground zone, relative to its frame. */
export interface TileAnchor {
  /** Horizontal offset of the ground zone from the frame's left edge, in pixels. */
  x: number;
  /** Vertical offset of the ground zone from the frame's top edge, in pixels. */
  y: number;
}

/** Grid-cell extents of a tile's artwork relative to its anchor cell. */
export interface AnchorFootprint {
  /** Number of grid cells the artwork extends to the left of the anchor cell. */
  left: number;
  /** Number of grid cells the artwork extends above the anchor cell. */
  up: number;
  /** Number of grid cells the artwork extends to the right of the anchor cell. */
  right: number;
  /** Number of grid cells the artwork extends below the anchor cell. */
  down: number;
}

/** Map of tile id to its directional grid-cell footprint. */
export type TileFootprintMap = Record<number, AnchorFootprint>;

/** A footprint with no overflow (a single 1×1 cell). */
export const EMPTY_FOOTPRINT: AnchorFootprint = { left: 0, up: 0, right: 0, down: 0 };

/**
 * Derives the default anchor for a frame: horizontally centered, bottom-aligned
 * (the ground edge is the frame's bottom). Clamped to non-negative offsets.
 * @param width - Frame width in pixels.
 * @param height - Frame height in pixels.
 * @param tileSize - Side length of one grid cell in pixels.
 * @returns The derived anchor.
 */
export function deriveAnchor(width: number, height: number, tileSize: number): TileAnchor {
  return {
    x: Math.max(0, Math.floor((width - tileSize) / 2)),
    y: Math.max(0, height - tileSize),
  };
}

/**
 * Clamps an anchor so its `ts×ts` zone stays fully inside the frame.
 * @param anchor - The anchor to clamp.
 * @param width - Frame width in pixels.
 * @param height - Frame height in pixels.
 * @param tileSize - Side length of one grid cell in pixels.
 * @returns A floored, in-bounds anchor.
 */
export function clampAnchor(
  anchor: TileAnchor,
  width: number,
  height: number,
  tileSize: number,
): TileAnchor {
  return {
    x: Math.min(Math.max(0, Math.floor(anchor.x)), Math.max(0, width - tileSize)),
    y: Math.min(Math.max(0, Math.floor(anchor.y)), Math.max(0, height - tileSize)),
  };
}

/**
 * Derives the directional grid-cell footprint of a frame from its anchor.
 * Overflow is rounded up with `ceil` so even a partial cell counts.
 * @param width - Frame width in pixels.
 * @param height - Frame height in pixels.
 * @param tileSize - Side length of one grid cell in pixels.
 * @param anchor - The frame's anchor (already resolved, not optional here).
 * @returns The footprint relative to the anchor cell.
 */
export function deriveFootprint(
  width: number,
  height: number,
  tileSize: number,
  anchor: TileAnchor,
): AnchorFootprint {
  return {
    left: Math.max(0, Math.ceil(anchor.x / tileSize)),
    up: Math.max(0, Math.ceil(anchor.y / tileSize)),
    right: Math.max(0, Math.ceil((width - anchor.x - tileSize) / tileSize)),
    down: Math.max(0, Math.ceil((height - anchor.y - tileSize) / tileSize)),
  };
}
