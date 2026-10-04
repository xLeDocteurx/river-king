/**
 * Content definition for the seedable « Demo » project.
 *
 * All artwork is generated procedurally as palette-index grids (16×16, the
 * project tile size). Index `0` is transparent; index `k > 0` maps to
 * `palette[k - 1]` of the project palette (see `encodePixelData`).
 */

/** Display name of the seeded demo project. */
export const DEMO_PROJECT_NAME = 'Demo';
/** Display name of the single demo scene. */
export const DEMO_SCENE_NAME = 'Demo Scene';
/** Lospec palette id used by the demo project. */
export const DEMO_PALETTE_ID = 'sweetie-16';
/** Demo map width in tiles. */
export const DEMO_WIDTH = 24;
/** Demo map height in tiles. */
export const DEMO_HEIGHT = 18;
/** Demo tile size in pixels. */
export const DEMO_TILE_SIZE = 16;

/** Water pond rectangle (grid cells) on the Overhead layer. */
export const POND = { x: 14, y: 8, w: 4, h: 3 };
/** Row of ySort trees along the top edge. */
export const TREE_ROW_Y = 0;
export const TREE_ROW_START_X = 2;
export const TREE_ROW_STEP_X = 2;
export const TREE_ROW_END_X = 20;
/** Cell occupied by the blocking boulder. */
export const BOULDER_CELL = { x: 11, y: 12 };
/** Cell occupied by the interactable sign. */
export const SIGN_CELL = { x: 9, y: 12 };

const SIZE = DEMO_TILE_SIZE;

function solid(idx: number): number[][] {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(idx));
}

function drawRect(grid: number[][], x: number, y: number, w: number, h: number, idx: number): void {
  for (let yy = y; yy < y + h; yy++) {
    const row = grid[yy];
    if (!row) continue;
    for (let xx = x; xx < x + w; xx++) {
      if (xx >= SIZE) continue;
      row[xx] = idx;
    }
  }
}

/** Green field with sparse darker grass blades. */
export function grassIndices(): number[][] {
  const grid = solid(6); // a7f070
  for (let y = 0; y < SIZE; y += 3) {
    const a = (y * 5) % SIZE;
    const b = (y * 7) % SIZE;
    grid[y][a] = 7; // 38b764
    grid[y][b] = 7;
  }
  return grid;
}

/** Water frame with a complementary ripple pattern per phase. */
export function waterIndices(phase: 1 | 2): number[][] {
  const grid = solid(11); // 41a6f6
  const offset = phase === 1 ? 0 : 1;
  for (let y = 0; y < SIZE; y++) {
    if (y % 2 !== offset) continue;
    for (let x = (y % 2) ^ offset; x < SIZE; x += 2) {
      grid[y][x] = 12; // 73eff7
    }
  }
  return grid;
}

/** Tree trunk column. */
export function trunkIndices(): number[][] {
  const grid = solid(0);
  drawRect(grid, 6, 0, 4, SIZE, 16); // 333c57
  drawRect(grid, 6, 0, 1, SIZE, 15); // 566c86 edge
  grid[3][8] = 15;
  grid[7][8] = 15;
  grid[11][8] = 15;
  return grid;
}

/** Tree canopy triangle, dappled light. */
export function foliageIndices(): number[][] {
  const grid = solid(0);
  for (let r = 0; r <= 11; r++) {
    const spread = Math.round(1 + r * 1.05);
    for (let x = 8 - spread; x <= 8 + spread; x++) {
      if (x < 0 || x >= SIZE) continue;
      grid[r][x] = x % 2 === 0 ? 7 : 6; // 38b764 / a7f070
    }
  }
  drawRect(grid, 4, 12, 8, 1, 6);
  return grid;
}

/** Rounded boulder with a bottom shadow line. */
export function boulderIndices(): number[][] {
  const grid = solid(0);
  drawRect(grid, 2, 5, 12, 11, 14); // 94b0c2
  drawRect(grid, 4, 4, 8, 1, 14);
  drawRect(grid, 6, 3, 4, 1, 14);
  grid[15][2] = 15; // 566c86 outline
  grid[15][13] = 15;
  grid[4][6] = 13; // f4f4f4 highlight
  grid[5][7] = 13;
  grid[4][10] = 13;
  return grid;
}

/** Wooden signpost. */
export function signIndices(): number[][] {
  const grid = solid(0);
  drawRect(grid, 7, 4, 2, 12, 4); // ef7d57 post
  drawRect(grid, 2, 2, 12, 4, 5); // ffcd75 board
  grid[3][4] = 16; // 333c57 text tick
  grid[3][5] = 16;
  grid[3][10] = 16;
  grid[3][11] = 16;
  return grid;
}