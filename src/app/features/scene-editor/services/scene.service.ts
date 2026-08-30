import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Scene } from '../../../shared/models/scene.model';
import { rewriteFolderPath, type Folder } from '../../../shared/models/folder.model';

/**
 * Feature-private service providing CRUD operations for scenes and folders.
 *
 * Scenes represent tile-based maps within a project. Each scene stores a 2D
 * grid of tile ids (tileData) and belongs to an optional folder for
 * hierarchical organization.
 *
 * @see MapTilesService for tile visual data loading.
 */
@Injectable()
export class SceneService {
  private readonly db = inject(DatabaseService);

  /**
   * Returns all scenes belonging to a project.
   * @param projectId - The owning project id.
   * @returns Scenes for the project in database order.
   */
  async getScenes(projectId: string): Promise<Scene[]> {
    return this.db.scenes.where('projectId').equals(projectId).toArray();
  }

  /**
   * Creates a new scene with the specified dimensions.
   * @param projectId The project this scene belongs to.
   * @param name Display name of the scene.
   * @param width Scene width in tiles.
   * @param height Scene height in tiles.
   * @returns The created scene object.
   */
  async createScene(
    projectId: string,
    name: string,
    width: number,
    height: number,
  ): Promise<Scene> {
    const scene: Scene = {
      id: crypto.randomUUID(),
      projectId,
      name,
      folderPath: '',
      width,
      height,
      layers: [
        {
          id: crypto.randomUUID(),
          name: 'Background',
          visible: true,
          opacity: 1,
          tileData: Array.from({ length: height }, () => Array(width).fill(-1)),
        },
      ],
    };
    await this.db.scenes.add(scene);
    return scene;
  }

  /**
   * Partially updates a scene by id.
   * @param id The scene id to update.
   * @param changes Partial scene fields to apply.
   */
  async updateScene(id: string, changes: Partial<Omit<Scene, 'id'>>): Promise<void> {
    await this.db.scenes.update(id, changes);
  }

  /**
   * Moves a scene to a different folder.
   * @param sceneId The scene id to move.
   * @param folderPath The new folder path.
   */
  async updateSceneFolder(sceneId: string, folderPath: string): Promise<void> {
    await this.db.scenes.update(sceneId, { folderPath });
  }

  /**
   * Deletes a scene by id.
   * @param id - The scene id to delete.
   */
  async deleteScene(id: string): Promise<void> {
    await this.db.scenes.delete(id);
  }

  /**
   * Re-inserts a previously deleted scene (used to undo a deletion).
   * @param scene - The full scene row to restore.
   */
  async restoreScene(scene: Scene): Promise<void> {
    await this.db.scenes.add(scene);
  }

  /**
   * Retrieves a single scene by id.
   * @param id The scene id.
   * @returns The scene, or undefined if not found.
   */
  async getScene(id: string): Promise<Scene | undefined> {
    return this.db.scenes.get(id);
  }

  /**
   * Returns all folders belonging to a project.
   * @param projectId The project id.
   * @returns The list of persisted folders for this project.
   */
  async getFolders(projectId: string): Promise<Folder[]> {
    return this.db.getFoldersByKind(projectId, 'scene');
  }

  /**
   * Creates a folder for a project if the path does not already exist in it.
   * @param projectId The project the folder belongs to.
   * @param path The folder path to create.
   */
  async createFolder(projectId: string, path: string): Promise<void> {
    const exists = await this.db.folders
      .where('projectId')
      .equals(projectId)
      .filter((folder) => folder.kind === 'scene' && folder.path === path)
      .count();
    if (exists > 0) return;
    const folder: Folder = {
      id: crypto.randomUUID(),
      projectId,
      path,
      kind: 'scene',
      collapsed: false,
      lastOpenedAt: 0,
    };
    await this.db.folders.add(folder);
  }

  /**
   * Deletes a folder and its (empty) descendant folders from the project.
   * Scenes inside the removed folders are left untouched; callers must ensure
   * the whole subtree holds no scenes before calling this.
   * @param projectId The project the folder belongs to.
   * @param path The folder path to delete, including descendant paths.
   */
  async deleteFolder(projectId: string, path: string): Promise<void> {
    await this.db.deleteFoldersByKind(projectId, 'scene', path);
  }

  /**
   * Renames a folder path, rewriting every folder row and scene that
   * references it (exact match or any nested descendant). Runs atomically.
   * @param projectId The project that owns the folder.
   * @param fromPath The current folder path.
   * @param toPath The new folder path.
   */
  async renameFolder(projectId: string, fromPath: string, toPath: string): Promise<void> {
    await this.db.transaction('rw', this.db.folders, this.db.scenes, async () => {
      const folders = await this.db.folders
        .where('projectId')
        .equals(projectId)
        .filter((folder) => folder.kind === 'scene')
        .toArray();
      for (const folder of folders) {
        const rewritten = rewriteFolderPath(folder.path, fromPath, toPath);
        if (rewritten !== folder.path) {
          await this.db.folders.update(folder.id, { path: rewritten });
        }
      }
      const scenes = await this.db.scenes.where('projectId').equals(projectId).toArray();
      for (const scene of scenes) {
        const rewritten = rewriteFolderPath(scene.folderPath, fromPath, toPath);
        if (rewritten !== scene.folderPath) {
          await this.db.scenes.update(scene.id, { folderPath: rewritten });
        }
      }
    });
  }

  /**
   * Inserts or updates the persisted state of a scene folder row.
   * @param projectId The project that owns the folder.
   * @param path The folder path.
   * @param changes Fields to persist (collapsed override / lastOpenedAt touch).
   */
  async upsertFolderState(
    projectId: string,
    path: string,
    changes: { collapsed?: boolean; lastOpenedAt?: number },
  ): Promise<void> {
    await this.db.upsertFolderState(projectId, 'scene', path, changes);
  }
}
