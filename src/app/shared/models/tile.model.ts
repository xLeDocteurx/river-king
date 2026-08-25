/**
 * A tile definition stored in the project database.
 *
 * Tiles reference one or more sprites for rendering and carry runtime
 * properties (blocking, interactable) consumed by the scene engine.
 */
export interface Tile {
  /** Auto-incremented primary key. */
  id: number;
  /** Id of the owning project. */
  projectId: string;
  /** Human-readable tile name (unique within a project). */
  name: string;
  /** Whether the tile is a single frame or a frame sequence. */
  type: 'static' | 'animated';
  /** Ordered sprite ids composing the tile's frames (references `Sprite.id`). */
  spriteIds: number[];
  /** Animation playback speed in frames per second. Defaults to `8`. */
  animationSpeed: number;
  /** Runtime behaviour properties consumed by the scene engine. */
  properties: TileProperties;
}

/**
 * Runtime properties of a tile.
 */
export interface TileProperties {
  /** Blocks character movement across the tile. */
  blocking: boolean;
  /** Whether the tile triggers an action on interaction. */
  interactable: boolean;
  /** Key of the action in GAME_ACTIONS; undefined when not interactable. */
  actionId?: string;
}
