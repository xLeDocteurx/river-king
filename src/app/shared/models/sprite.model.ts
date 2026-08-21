export interface Sprite {
  id: number;
  projectId: string;
  tileId: number;
  name: string;
  width: number; // in pixels
  height: number; // in pixels
  pixelData: string; // base64 PNG
  paletteIndices?: number[][]; // for palette-based editing
}
