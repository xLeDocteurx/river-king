export interface Project {
  id: string;
  name: string;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  palette: string[]; // hex colors
  tileSize: number; // default 16
  mapWidth: number; // default 40 tiles
  mapHeight: number; // default 30 tiles
}
