import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';

// TODO: Migrate these interfaces to src/app/shared/models/ in Task 2

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  palette: string[];
  tileSize: number;
  mapWidth: number;
  mapHeight: number;
}

export interface Scene {
  id: string;
  projectId: string;
  name: string;
  folderPath: string;
  width: number;
  height: number;
  tileData: number[][];
}

export interface TileProperties {
  collision: boolean;
  solid: boolean;
  interactable: boolean;
  eventScript?: string;
  layer: 'background' | 'foreground';
}

export interface Tile {
  id: number;
  projectId: string;
  name: string;
  type: 'static' | 'animated';
  spriteIds: number[];
  animationSpeed: number;
  properties: TileProperties;
}

export interface Sprite {
  id: number;
  projectId: string;
  tileId: number;
  width: number;
  height: number;
  pixelData: string;
  paletteIndices?: number[][];
}

export interface Session {
  projectId: string;
  lastSceneId: string | null;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
}

@Injectable({ providedIn: 'root' })
export class DatabaseService extends Dexie {
  projects!: Table<Project, string>;
  scenes!: Table<Scene, string>;
  tiles!: Table<Tile, number>;
  sprites!: Table<Sprite, number>;
  sessions!: Table<Session, string>;

  constructor() {
    super('RiverKingDB');
    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      scenes: 'id, projectId, name, folderPath',
      tiles: '++id, projectId, name, type',
      sprites: '++id, projectId, tileId',
      sessions: 'projectId',
    });
  }
}
