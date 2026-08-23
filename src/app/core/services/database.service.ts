import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import type { Project } from '../../shared/models/project.model';
import type { Scene } from '../../shared/models/scene.model';
import type { Tile } from '../../shared/models/tile.model';
import type { Sprite } from '../../shared/models/sprite.model';
import type { Session } from '../../shared/models/session.model';
import type { Folder } from '../../shared/models/folder.model';
import type { TileProperties } from '../../shared/models/tile.model';

/**
 * Converts legacy tile properties (collision/solid/layer/eventScript) to the v3 shape.
 * @param oldProps - Raw stored properties of unknown shape.
 * @returns Migrated TileProperties with blocking merged from collision/solid.
 */
export function migrateTileProperties(
  oldProps: Record<string, unknown> | undefined,
): TileProperties {
  return {
    blocking: Boolean(oldProps?.['collision'] || oldProps?.['solid']),
    interactable: Boolean(oldProps?.['interactable']),
    actionId: undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class DatabaseService extends Dexie {
  projects!: Table<Project, string>;
  scenes!: Table<Scene, string>;
  tiles!: Table<Tile, number>;
  sprites!: Table<Sprite, number>;
  sessions!: Table<Session, string>;
  folders!: Table<Folder, string>;

  constructor() {
    super('RiverKingDB');
    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      scenes: 'id, projectId, name, folderPath',
      tiles: '++id, projectId, name, type',
      sprites: '++id, projectId, tileId',
      sessions: 'projectId',
    });
    this.version(2).stores({
      folders: 'id, projectId, path',
    });
    this.version(3)
      .stores({
        folders: 'id, projectId, path',
      })
      .upgrade(async (tx) => {
        await tx
          .table('tiles')
          .toCollection()
          .modify((tile: { properties?: Record<string, unknown> }) => {
            tile.properties = migrateTileProperties(
              tile.properties as Record<string, unknown> | undefined,
            ) as unknown as Record<string, unknown>;
          });
      });
  }
}
