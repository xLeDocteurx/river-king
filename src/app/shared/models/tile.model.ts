export interface Tile {
  id: number;
  projectId: string;
  name: string;
  type: 'static' | 'animated';
  spriteIds: number[]; // references to Sprite.id
  animationSpeed: number; // fps (frames per second), default 8
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
