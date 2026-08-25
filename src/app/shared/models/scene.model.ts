/**
 * A single map scene within a project.
 *
 * Scenes store a 2-D grid of tile references that the map canvas renders.
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
   * 2-D array of tile indices.
   *
   * `-1` represents an empty cell; values `>= 0` are tile IDs referencing the
   * project's tile set.
   */
  tileData: number[][];
}
