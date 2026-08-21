import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Scene } from '../../../shared/models/scene.model';

@Injectable()
export class SceneService {
  private readonly db = inject(DatabaseService);

  /** Returns all scenes belonging to a project. */
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
  async createScene(projectId: string, name: string, width: number, height: number): Promise<Scene> {
    const scene: Scene = {
      id: crypto.randomUUID(),
      projectId,
      name,
      folderPath: '',
      width,
      height,
      tileData: Array.from({ length: height }, () => Array(width).fill(-1)),
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

  /** Deletes a scene by id. */
  async deleteScene(id: string): Promise<void> {
    await this.db.scenes.delete(id);
  }

  /**
   * Retrieves a single scene by id.
   * @param id The scene id.
   * @returns The scene, or undefined if not found.
   */
  async getScene(id: string): Promise<Scene | undefined> {
    return this.db.scenes.get(id);
  }
}
