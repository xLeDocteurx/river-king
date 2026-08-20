import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Scene } from '../../../shared/models/scene.model';

@Injectable()
export class SceneService {
  private readonly db = inject(DatabaseService);

  async getScenes(projectId: string): Promise<Scene[]> {
    return this.db.scenes.where('projectId').equals(projectId).toArray();
  }

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

  async updateScene(id: string, changes: Partial<Omit<Scene, 'id'>>): Promise<void> {
    await this.db.scenes.update(id, changes);
  }

  async deleteScene(id: string): Promise<void> {
    await this.db.scenes.delete(id);
  }

  async getScene(id: string): Promise<Scene | undefined> {
    return this.db.scenes.get(id);
  }
}
