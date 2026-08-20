export interface Tile {
  id: number;
  projectId: string;
  name: string;
  type: 'static' | 'animated';
  spriteIds: number[]; // references to Sprite.id
  animationSpeed: number; // ms per frame, default 200
  properties: TileProperties;
}

export interface TileProperties {
  collision: boolean;
  solid: boolean;
  interactable: boolean;
  eventScript?: string;
  layer: 'background' | 'foreground';
}
