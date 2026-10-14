import type { Layer } from '../../shared/models/scene.model';
import { getFootprint, type TileFootprintMap } from './map-footprint';

/** Half-extent of the fixed 0.5x0.5 player hitbox, in grid cells. */
export const HALF_CELL_HITBOX = 0.25;

/** A solid sub-rectangle inside one grid cell, in world (cell) coordinates. */
export interface CellRect {
  /** Left edge (>= cell x). */
  x0: number;
  /** Top edge (>= cell y). */
  y0: number;
  /** Right edge (<= cell x + 1). */
  x1: number;
  /** Bottom edge (<= cell y + 1). */
  y1: number;
}

/** Per-tile blocking flag and optional per-pixel collision mask. */
export interface TileCollision {
  /** Blocks movement (from `Tile.properties.blocking`). */
  blocking: boolean;
  /** Optional per-pixel mask; absent/`null` blocks the full footprint. */
  mask?: number[][] | null;
}

/** The resolved collision field for a scene. */
export interface CollisionField {
  /** Full-cell blocking contributed by unmasked blocking tiles. */
  full: boolean[][];
  /** Per-cell solid sub-rects from masked blocking tiles (`null` when none). */
  sub: (CellRect[] | null)[][];
}

/**
 * Builds the collision field for a scene. Only visible layers contribute
 * (opacity is ignored). Unmasked blocking tiles fill their whole footprint;
 * masked blocking tiles contribute one sub-rect per solid (`>=1`) mask pixel,
 * bucketed into the grid cell that contains it. Out-of-scene cells are treated
 * as blocked by the resolver.
 *
 * @param width - Scene width in cells.
 * @param height - Scene height in cells.
 * @param layers - Scene layers; only the visibility flag is read.
 * @param tiles - Per-tile blocking flag and optional mask.
 * @param footprints - Grid-cell footprint per tile id (absent -> 1x1).
 * @returns The resolved collision field.
 */
export function buildCollisionField(
  width: number,
  height: number,
  layers: Layer[],
  tiles: Map<number, TileCollision>,
  footprints: TileFootprintMap,
): CollisionField {
  const full: boolean[][] = [];
  const sub: (CellRect[] | null)[][] = [];
  for (let y = 0; y < height; y++) {
    full.push(new Array<boolean>(width).fill(false));
    sub.push(new Array<CellRect[] | null>(width).fill(null));
  }
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (let y = 0; y < layer.tileData.length; y++) {
      for (let x = 0; x < layer.tileData[y].length; x++) {
        const tileId = layer.tileData[y][x];
        const tile = tiles.get(tileId);
        if (tileId < 0 || !tile?.blocking) continue;
        const fp = getFootprint(tileId, footprints);
        const rect = {
          x: x - fp.left,
          y: y - fp.up,
          w: fp.left + fp.right + 1,
          h: fp.up + fp.down + 1,
        };
        const mask = tile.mask;
        const maskW = mask?.[0]?.length ?? 0;
        if (!mask || mask.length === 0 || maskW === 0) {
          for (let fy = rect.y; fy < rect.y + rect.h; fy++) {
            for (let fx = rect.x; fx < rect.x + rect.w; fx++) {
              if (fx < 0 || fy < 0 || fx >= width || fy >= height) continue;
              full[fy][fx] = true;
            }
          }
          continue;
        }
        const cellW = rect.w / maskW;
        const cellH = rect.h / mask.length;
        for (let my = 0; my < mask.length; my++) {
          for (let mx = 0; mx < maskW; mx++) {
            if ((mask[my]?.[mx] ?? 0) < 1) continue;
            const x0 = rect.x + mx * cellW;
            const y0 = rect.y + my * cellH;
            const cx = Math.floor(x0);
            const cy = Math.floor(y0);
            if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
            const cell = (sub[cy][cx] ??= []);
            cell.push({ x0, y0, x1: x0 + cellW, y1: y0 + cellH });
          }
        }
      }
    }
  }
  return { full, sub };
}

/**
 * Builds a 2D boolean grid marking which cells block player movement.
 * Only layers with `visible === true` contribute; blocking tiles mark their full
 * grid-cell footprint. Returns a `height x width` array of booleans (`grid[y][x]`).
 *
 * @param width - Scene width in cells.
 * @param height - Scene height in cells.
 * @param layers - Scene layers; only the visibility flag is read.
 * @param blockingById - Map of tile id -> blocking flag.
 * @param footprints - Grid-cell footprint per tile id (absent -> 1x1).
 * @returns The blocking grid; out-of-scene cells are treated as blocked by the resolver.
 */
export function buildBlockingGrid(
  width: number,
  height: number,
  layers: Layer[],
  blockingById: Map<number, boolean>,
  footprints: TileFootprintMap,
): boolean[][] {
  const tiles = new Map<number, TileCollision>();
  for (const [id, blocking] of blockingById) tiles.set(id, { blocking });
  return buildCollisionField(width, height, layers, tiles, footprints).full;
}

/**
 * Resolves a player movement against the blocking grid, axis-separated (X first,
 * then Y), sweeping the leading AABB edge cell by cell so the player never
 * tunnels through a blocking tile. A cell counts as overlapped only when the AABB
 * crosses its interior, so an edge flush against a wall does not block sliding.
 * When an axis is unobstructed the full delta is applied on that axis.
 *
 * @param pos - Current center position in grid cells (fractional).
 * @param move - Requested delta this frame, in cells (X then Y are independent).
 * @param half - Hitbox half-extent.
 * @param grid - Blocking grid from `buildBlockingGrid`.
 * @param bounds - Scene size in cells; cells outside are treated as blocked.
 * @param sub - Optional per-cell solid sub-rects from masked tiles; when omitted
 *     every occupied cell blocks its whole area (the pre-mask behaviour).
 * @returns The resolved center position.
 */
export function resolveCollision(
  pos: { x: number; y: number },
  move: { x: number; y: number },
  half: number,
  grid: boolean[][],
  bounds: { width: number; height: number },
  sub?: (CellRect[] | null)[][],
): { x: number; y: number } {
  let x = pos.x;
  let y = pos.y;

  /**
   * A cell blocks when it is out of scene, when the full grid marks it, or when
   * its solid sub-rects (if any) intersect the tentative AABB.
   */
  const blocked = (
    col: number,
    row: number,
    ax0: number,
    ay0: number,
    ax1: number,
    ay1: number,
  ): boolean => {
    if (col < 0 || row < 0 || col >= bounds.width || row >= bounds.height) return true;
    const rowCells = grid[row];
    if (rowCells !== undefined && rowCells[col]) return true;
    const rects = sub?.[row]?.[col];
    if (!rects) return false;
    const ox0 = Math.max(ax0, col);
    const oy0 = Math.max(ay0, row);
    const ox1 = Math.min(ax1, col + 1);
    const oy1 = Math.min(ay1, row + 1);
    if (ox0 >= ox1 || oy0 >= oy1) return false;
    return rects.some((r) => ox0 < r.x1 && ox1 > r.x0 && oy0 < r.y1 && oy1 > r.y0);
  };

  // Rows of the blocking grid strictly overlapped by the vertical AABB span
  // [y-half, y+half]; a flush edge (span ending on an integer) excludes that cell.
  const topRow = Math.floor(y - half - 1) + 1;
  const bottomRow = Math.ceil(y + half) - 1;
  const sweepX0 = Math.min(x, x + move.x) - half;
  const sweepX1 = Math.max(x, x + move.x) + half;

  let hitX = false;
  if (move.x > 0) {
    const newRight = x + move.x + half;
    for (let col = Math.ceil(x + half); col <= Math.floor(newRight); col++) {
      if (newRight <= col) break;
      let cellHit = false;
      for (let row = topRow; row <= bottomRow; row++) {
        if (blocked(col, row, sweepX0, y - half, sweepX1, y + half)) {
          x = col - half;
          hitX = true;
          cellHit = true;
          break;
        }
      }
      if (cellHit) break;
    }
  } else if (move.x < 0) {
    const newLeft = x + move.x - half;
    for (let col = Math.floor(x - half) - 1; col >= Math.floor(newLeft); col--) {
      if (newLeft >= col + 1) continue;
      let cellHit = false;
      for (let row = topRow; row <= bottomRow; row++) {
        if (blocked(col, row, sweepX0, y - half, sweepX1, y + half)) {
          x = col + 1 + half;
          hitX = true;
          cellHit = true;
          break;
        }
      }
      if (cellHit) break;
    }
  }
  if (!hitX) x += move.x;

  // Columns strictly overlapped by the resolved horizontal AABB span.
  const leftCol = Math.floor(x - half - 1) + 1;
  const rightCol = Math.ceil(x + half) - 1;
  const sweepY0 = Math.min(y, y + move.y) - half;
  const sweepY1 = Math.max(y, y + move.y) + half;

  let hitY = false;
  if (move.y > 0) {
    const newBottom = y + move.y + half;
    for (let row = Math.ceil(y + half); row <= Math.floor(newBottom); row++) {
      if (newBottom <= row) break;
      let cellHit = false;
      for (let col = leftCol; col <= rightCol; col++) {
        if (blocked(col, row, x - half, sweepY0, x + half, sweepY1)) {
          y = row - half;
          hitY = true;
          cellHit = true;
          break;
        }
      }
      if (cellHit) break;
    }
  } else if (move.y < 0) {
    const newTop = y + move.y - half;
    for (let row = Math.floor(y - half) - 1; row >= Math.floor(newTop); row--) {
      if (newTop >= row + 1) continue;
      let cellHit = false;
      for (let col = leftCol; col <= rightCol; col++) {
        if (blocked(col, row, x - half, sweepY0, x + half, sweepY1)) {
          y = row + 1 + half;
          hitY = true;
          cellHit = true;
          break;
        }
      }
      if (cellHit) break;
    }
  }
  if (!hitY) y += move.y;

  return { x, y };
}
