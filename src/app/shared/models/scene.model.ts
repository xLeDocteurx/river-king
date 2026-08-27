/**
 * A single renderable layer within a scene.
 *
 * Layers are stacked bottom-to-top. Each layer has its own tile grid,
 * visibility toggle, and opacity value.
 */
export interface Layer {
  /** Unique identifier (UUID). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Whether this layer is rendered on the canvas. */
  visible: boolean;
  /** Opacity from 0 (fully transparent) to 1 (fully opaque). */
  opacity: number;
  /**
   * 2-D array of tile indices for this layer.
   *
   * `-1` represents an empty cell; values `>= 0` are tile IDs referencing the
   * project's tile set.
   */
  tileData: number[][];
}

/**
 * A single map scene within a project.
 *
 * Scenes contain an ordered array of layers, each holding a 2-D grid
 * of tile references that the map canvas renders.
 */
export interface Scene {
  /** Unique identifier (UUID). */
  id: string;
  /** Reference to the owning {@link Project.id}. */
  projectId: string;
  /** Display name of the scene. */
  name: string;
  /** Optional folder path for organisation (e.g. `"forest/caves"` or `""` for root). */
  folderPath: string;
  /** Scene width in tiles. */
  width: number;
  /** Scene height in tiles. */
  height: number;
  /**
   * Ordered layers, bottom-to-top. The first layer is rendered behind all others.
   */
  layers: Layer[];
}
