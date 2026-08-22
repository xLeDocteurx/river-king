import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Sprite } from '../../../shared/models/sprite.model';

/**
 * Feature-private service responsible for loading the first frame
 * (lowest-id sprite) of every tile in a project as image source strings
 * (data URIs). Canvas rendering owns the actual HTMLImageElement cache.
 */
@Injectable()
export class MapTilesService {
  private readonly db = inject(DatabaseService);

  /**
   * Loads the first sprite for each tile in the project and returns its
   * `pixelData` image source. Standalone sprites (tileId <= 0) are ignored;
   * tiles whose frames fail to load simply stay absent so the canvas can
   * fall back to a palette color.
   *
   * @param projectId - The project whose tiles should be loaded.
   * @returns A record mapping tileId -> image source string (data URI).
   * @throws When the underlying database query fails.
   */
  async loadTileImages(projectId: string): Promise<Record<number, string>> {
    const sprites = await this.db.sprites.where('projectId').equals(projectId).toArray();

    // Keep only the first sprite (lowest id) for each tileId.
    const firstByTile = new Map<number, Sprite>();
    for (const sprite of sprites) {
      if (sprite.tileId <= 0) continue;
      const existing = firstByTile.get(sprite.tileId);
      if (!existing || sprite.id < existing.id) {
        firstByTile.set(sprite.tileId, sprite);
      }
    }

    const images: Record<number, string> = {};
    for (const [tileId, sprite] of firstByTile) {
      images[tileId] = sprite.pixelData;
    }
    return images;
  }
}
