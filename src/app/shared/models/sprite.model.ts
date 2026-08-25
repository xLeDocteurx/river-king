/**
 * A pixel-art sprite associated with a tile in a project.
 *
 * Sprites store both a flattened base64 PNG for rendering and an optional
 * palette-indexed grid used by the sprite editor's painting tools.
 */
export interface Sprite {
  /** Auto-incremented primary key. */
  id: number;
  /** Reference to the owning {@link Project.id}. */
  projectId: string;
  /** Tile identifier this sprite belongs to. */
  tileId: number;
  /** Human-readable sprite name. */
  name: string;
  /** Sprite width in pixels. */
  width: number;
  /** Sprite height in pixels. */
  height: number;
  /** Base64-encoded PNG data used for canvas rendering. */
  pixelData: string;
  /**
   * Optional 2-D grid of palette indices for palette-based editing.
   *
   * Each cell holds an index into the project's `palette` array,
   * or `-1` for transparent pixels.
   */
  paletteIndices?: number[][];
}
