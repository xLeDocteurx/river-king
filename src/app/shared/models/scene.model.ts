export interface Scene {
  id: string;
  projectId: string;
  name: string;
  folderPath: string; // "forest/caves" or ""
  width: number; // in tiles
  height: number; // in tiles
  tileData: number[][]; // 2D array, -1 = empty, >=0 = tile ID
}
