/**
 * Top-level domain model representing a River King project.
 *
 * A project owns a tile palette, tile dimensions, and map grid size.
 * Scenes, tiles, sprites, and sessions all reference a project via `projectId`.
 */
export interface Project {
  /** Unique identifier (UUID). */
  id: string;
  /** Human-readable project name. */
  name: string;
  /** Unix epoch milliseconds when the project was created. */
  createdAt: number;
  /** Unix epoch milliseconds of the last modification. */
  updatedAt: number;
  /** Array of hex color strings (e.g. `"#ff0000"`) forming the project palette. */
  palette: string[];
  /** Side length in pixels for each tile (default `16`). */
  tileSize: number;
  /** Map width in tiles (default `40`). */
  mapWidth: number;
  /** Map height in tiles (default `30`). */
  mapHeight: number;
  /** Play-viewport width in game pixels (default `256`, see `viewport.ts`). */
  viewWidth?: number;
  /** Play-viewport height in game pixels (default `144`, see `viewport.ts`). */
  viewHeight?: number;
}
