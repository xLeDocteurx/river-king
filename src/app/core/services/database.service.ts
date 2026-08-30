import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import type { Project } from '../../shared/models/project.model';
import type { Scene } from '../../shared/models/scene.model';
import type { Tile } from '../../shared/models/tile.model';
import type { Sprite } from '../../shared/models/sprite.model';
import type { Session } from '../../shared/models/session.model';
import type { Folder, FolderKind } from '../../shared/models/folder.model';
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

/**
 * IndexedDB wrapper for all persistent application data.
 *
 * Extends Dexie to define the schema and expose typed table references.
 * Schema migrations are handled via `this.version(N).stores(…).upgrade(…)`.
 *
 * @see {@link migrateTileProperties} for the v3 tile migration helper.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseService extends Dexie {
  /** Projects table — keyed by UUID. */
  projects!: Table<Project, string>;
  /** Scenes table — keyed by UUID, indexed by `projectId` and `folderPath`. */
  scenes!: Table<Scene, string>;
  /** Tiles table — auto-incremented id, indexed by `projectId` and `type`. */
  tiles!: Table<Tile, number>;
  /** Sprites table — auto-incremented id, indexed by `projectId` and `tileId`. */
  sprites!: Table<Sprite, number>;
  /** Sessions table — keyed by `projectId` (one session per project). */
  sessions!: Table<Session, string>;
  /** Folders table — keyed by UUID, indexed by `projectId` and `path`. */
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
    this.version(4)
      .stores({
        scenes: 'id, projectId, name, folderPath',
      })
      .upgrade(async (tx) => {
        await tx
          .table('scenes')
          .toCollection()
          .modify((scene: { tileData?: number[][]; layers?: unknown[] }) => {
            if (!scene.layers) {
              const tileData = scene.tileData ?? [];
              scene.layers = [
                {
                  id: crypto.randomUUID(),
                  name: 'Background',
                  visible: true,
                  opacity: 1,
                  tileData,
                },
              ];
              delete scene.tileData;
            }
          });
      });
    this.version(5)
      .stores({
        tiles: '++id, projectId, folderPath',
      })
      .upgrade(async (tx) => {
        await tx
          .table('tiles')
          .toCollection()
          .modify((tile: { folderPath?: string }) => {
            tile.folderPath = '';
          });
      });
    this.version(6)
      .stores({
        folders: 'id, projectId, path, kind',
      })
      .upgrade(async (tx) => {
        await tx
          .table('folders')
          .toCollection()
          .modify((folder: { kind?: string; collapsed?: boolean; lastOpenedAt?: number }) => {
            folder.kind = 'scene';
            folder.collapsed = false;
            folder.lastOpenedAt = 0;
          });
      });
  }

  /**
   * Returns every folder row belonging to a project for a single kind.
   * @param projectId - The owning project id.
   * @param kind - The folder kind to list.
   * @returns The persisted folder rows of that kind.
   */
  async getFoldersByKind(projectId: string, kind: FolderKind): Promise<Folder[]> {
    return this.folders
      .where('projectId')
      .equals(projectId)
      .filter((folder) => folder.kind === kind)
      .toArray();
  }

  /**
   * Inserts a folder row for `(projectId, kind, path)` with default folding
   * state, or applies the given changes when a row already exists.
   * @param projectId - The owning project id.
   * @param kind - The folder kind.
   * @param path - The folder path.
   * @param changes - Fields to set on the row (collapsed / lastOpenedAt).
   */
  async upsertFolderState(
    projectId: string,
    kind: FolderKind,
    path: string,
    changes: { collapsed?: boolean; lastOpenedAt?: number },
  ): Promise<void> {
    const existing = await this.folders
      .where('projectId')
      .equals(projectId)
      .filter((folder) => folder.kind === kind && folder.path === path)
      .first();
    if (existing) {
      await this.folders.update(existing.id, changes);
      return;
    }
    await this.folders.add({
      id: crypto.randomUUID(),
      projectId,
      kind,
      path,
      collapsed: changes.collapsed ?? false,
      lastOpenedAt: changes.lastOpenedAt ?? 0,
    });
  }

  /**
   * Deletes every folder row of a kind whose path equals `prefix` or lives
   * beneath `prefix/` (the whole empty subtree).
   * @param projectId - The owning project id.
   * @param kind - The folder kind to delete.
   * @param prefix - The folder path to remove, including descendants.
   */
  async deleteFoldersByKind(projectId: string, kind: FolderKind, prefix: string): Promise<void> {
    await this.folders
      .where('projectId')
      .equals(projectId)
      .filter(
        (folder) =>
          folder.kind === kind && (folder.path === prefix || folder.path.startsWith(prefix + '/')),
      )
      .delete();
  }

  /**
   * Rewrites every folder row path of a kind that matches `fromPath` exactly
   * or lives beneath `fromPath/`, moving it to `toPath`. Mirrors
   * `rewriteFolderPath` without importing from `shared/` (core independence).
   * @param projectId - The owning project id.
   * @param kind - The folder kind to rewrite.
   * @param fromPath - The current folder path.
   * @param toPath - The new folder path.
   */
  async renameFoldersOfKind(
    projectId: string,
    kind: FolderKind,
    fromPath: string,
    toPath: string,
  ): Promise<void> {
    await this.folders
      .where('projectId')
      .equals(projectId)
      .filter((folder) => folder.kind === kind)
      .modify((folder: Folder) => {
        if (fromPath === folder.path) {
          folder.path = toPath;
        } else if (folder.path.startsWith(fromPath + '/')) {
          folder.path = toPath + folder.path.slice(fromPath.length);
        }
      });
  }
}
