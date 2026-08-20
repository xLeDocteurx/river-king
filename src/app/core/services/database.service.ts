import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import type { Project } from '../../shared/models/project.model';
import type { Scene } from '../../shared/models/scene.model';
import type { Tile } from '../../shared/models/tile.model';
import type { Sprite } from '../../shared/models/sprite.model';
import type { Session } from '../../shared/models/session.model';

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
