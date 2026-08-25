import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Sprite } from '../../../shared/models/sprite.model';
import type { Tile } from '../../../shared/models/tile.model';
import type { TileFootprintMap } from '../map-footprint';

/** Animation metadata for a tile that has more than one frame. */
export interface TileAnimationMeta {
  /** Total number of frames (sprite count) for this tile. */
  frameCount: number;
  /** Playback speed in frames per second. */
  fps: number;
}

/**
 * Feature-private service responsible for loading the visual data of every
 * tile in a project: all animation frame image sources, animation metadata,
 * and each tile's footprint expressed in grid cells.
 */
@Injectable()
export class MapTilesService {
  private readonly db = inject(DatabaseService);

  /**
   * Loads every sprite frame for each tile in the project, ordered by
   * ascending id (creation order = playback order). Returns all frame data
   * URIs per tile, animation metadata for animated tiles, and the footprint
   * in grid cells derived from the first sprite. Standalone sprites
   * (tileId <= 0) are ignored so tiles without sprites can fall back to a
   * palette color.
   *
   * @param projectId - The project whose tiles should be loaded.
   * @param tileSizePx - Size of one grid cell in pixels (project setting).
   * @returns Frame images, animation metadata, and footprints keyed by tileId.
   * @throws When the underlying database query fails.
   */
  async loadTileVisuals(
    projectId: string,
    tileSizePx: number,
  ): Promise<{
    images: Record<number, string[]>;
    animations: Record<number, TileAnimationMeta>;
    footprints: TileFootprintMap;
  }> {
    const [allSprites, tiles] = await Promise.all([
      this.db.sprites.where('projectId').equals(projectId).toArray(),
      this.db.tiles.where('projectId').equals(projectId).toArray(),
    ]);

    // Index tiles by id for animation metadata lookup.
    const tileById = new Map<number, Tile>();
    for (const t of tiles) tileById.set(t.id, t);

    // Group sprites by tileId, sorted by ascending id (frame order).
    const spritesByTile = new Map<number, Sprite[]>();
    for (const sprite of allSprites) {
      if (sprite.tileId <= 0) continue;
      let arr = spritesByTile.get(sprite.tileId);
      if (!arr) {
        arr = [];
        spritesByTile.set(sprite.tileId, arr);
      }
      arr.push(sprite);
    }
    for (const arr of spritesByTile) arr[1].sort((a, b) => a.id - b.id);

    const images: Record<number, string[]> = {};
    const animations: Record<number, TileAnimationMeta> = {};
    const footprints: TileFootprintMap = {};

    for (const [tileId, sprites] of spritesByTile) {
      // All frames for this tile.
      images[tileId] = sprites.map((s) => s.pixelData);

      // Animation metadata when the tile has multiple frames.
      const tile = tileById.get(tileId);
      if (tile && tile.type === 'animated' && sprites.length > 1) {
        animations[tileId] = {
          frameCount: sprites.length,
          fps: tile.animationSpeed,
        };
      }

      // Footprint derived from the first sprite.
      const first = sprites[0];
      footprints[tileId] = {
        w: Math.max(1, Math.ceil(first.width / tileSizePx)),
        h: Math.max(1, Math.ceil(first.height / tileSizePx)),
      };
    }

    return { images, animations, footprints };
  }
}
