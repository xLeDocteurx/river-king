import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Sprite } from '../../../shared/models/sprite.model';
import type { TileFootprintMap } from '../map-footprint';

/**
 * Feature-private service responsible for loading the visual data of every
 * tile in a project: the first frame (lowest-id sprite) image source plus
 * that sprite's footprint expressed in grid cells.
 */
@Injectable()
export class MapTilesService {
  private readonly db = inject(DatabaseService);

  /**
   * Loads the first sprite for each tile in the project and returns both its
   * `pixelData` image source and its footprint in grid cells. Footprints use
   * ceil(sprite dimension / tileSizePx), clamped to at least one cell.
   * Standalone sprites (tileId <= 0) are ignored so tiles without sprites can
   * fall back to a palette color.
   *
   * @param projectId - The project whose tiles should be loaded.
   * @param tileSizePx - Size of one grid cell in pixels (project setting).
   * @returns Images (tileId -> data URI) and footprints (tileId -> cells).
   * @throws When the underlying database query fails.
   */
  async loadTileVisuals(
    projectId: string,
    tileSizePx: number,
  ): Promise<{ images: Record<number, string>; footprints: TileFootprintMap }> {
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
    const footprints: TileFootprintMap = {};
    for (const [tileId, sprite] of firstByTile) {
      images[tileId] = sprite.pixelData;
      footprints[tileId] = {
        w: Math.max(1, Math.ceil(sprite.width / tileSizePx)),
        h: Math.max(1, Math.ceil(sprite.height / tileSizePx)),
      };
    }
    return { images, footprints };
  }
}
