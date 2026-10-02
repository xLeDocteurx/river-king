import type { Layer } from '../../shared/models/scene.model';
import { getFootprint, type TileFootprintMap } from './map-footprint';

/** Half-extent of the fixed 0.5x0.5 player hitbox, in grid cells. */
export const HALF_CELL_HITBOX = 0.25;

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
  const grid: boolean[][] = [];
  for (let y = 0; y < height; y++) {
    grid.push(new Array<boolean>(width).fill(false));
  }
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (let y = 0; y < layer.tileData.length; y++) {
      const row = layer.tileData[y];
      for (let x = 0; x < row.length; x++) {
        const tileId = row[x];
        if (tileId < 0 || !blockingById.get(tileId)) continue;
        const { w, h } = getFootprint(tileId, footprints);
        for (let fy = y; fy < y + h && fy < height; fy++) {
          for (let fx = x; fx < x + w && fx < width; fx++) {
            grid[fy][fx] = true;
          }
        }
      }
    }
  }
  return grid;
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
 * @returns The resolved center position.
 */
export function resolveCollision(
  pos: { x: number; y: number },
  move: { x: number; y: number },
  half: number,
  grid: boolean[][],
  bounds: { width: number; height: number },
): { x: number; y: number } {
  let x = pos.x;
  let y = pos.y;

  /** A cell is blocked when it is in the grid and true, or outside the scene. */
  const blocked = (col: number, row: number): boolean => {
    if (col < 0 || row < 0 || col >= bounds.width || row >= bounds.height) return true;
    const rowCells = grid[row];
    return rowCells !== undefined && rowCells[col];
  };

  // Rows of the blocking grid strictly overlapped by the vertical AABB span
  // [y-half, y+half]; a flush edge (span ending on an integer) excludes that cell.
  const topRow = Math.floor(y - half - 1) + 1;
  const bottomRow = Math.ceil(y + half) - 1;

  let hitX = false;
  if (move.x > 0) {
    const newRight = x + move.x + half;
    for (let col = Math.ceil(x + half); col <= Math.floor(newRight); col++) {
      if (newRight <= col) break;
      let cellHit = false;
      for (let row = topRow; row <= bottomRow; row++) {
        if (blocked(col, row)) {
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
        if (blocked(col, row)) {
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

  let hitY = false;
  if (move.y > 0) {
    const newBottom = y + move.y + half;
    for (let row = Math.ceil(y + half); row <= Math.floor(newBottom); row++) {
      if (newBottom <= row) break;
      let cellHit = false;
      for (let col = leftCol; col <= rightCol; col++) {
        if (blocked(col, row)) {
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
        if (blocked(col, row)) {
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
