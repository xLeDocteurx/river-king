import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Tile } from '../../../shared/models/tile.model';

/**
 * Feature-private service providing CRUD operations for tiles.
 *
 * Each tile belongs to a project and carries metadata (name, type,
 * animation speed, properties) plus an ordered list of sprite frame ids.
 * Deletion cascades to linked sprites atomically.
 *
 * @see TileSpritesService for sprite-level operations.
 */
@Injectable()
export class TileService {
  private readonly db = inject(DatabaseService);

  /**
   * Returns all tiles belonging to the given project.
   * @param projectId - The owning project id.
   * @returns Tiles for the project in database order.
   */
  async getTiles(projectId: string): Promise<Tile[]> {
    return this.db.tiles.where('projectId').equals(projectId).toArray();
  }

  /**
   * Creates a static tile with sensible defaults (no frames, non-blocking).
   * @param projectId - The owning project id.
   * @param name - Display name for the tile.
   * @returns The persisted tile with its generated id.
   */
  async createTile(projectId: string, name: string): Promise<Tile> {
    const tile: Omit<Tile, 'id'> = {
      projectId,
      name,
      type: 'static',
      spriteIds: [],
      animationSpeed: 8,
      properties: {
        blocking: false,
        interactable: false,
      },
    };
    const id = await this.db.tiles.add(tile as Tile);
    return { ...tile, id } as Tile;
  }

  /**
   * Partially updates a tile by id.
   * @param id - The tile id to update.
   * @param changes - Partial tile fields to apply.
   */
  async updateTile(id: number, changes: Partial<Omit<Tile, 'id'>>): Promise<void> {
    await this.db.tiles.update(id, changes);
  }

  /**
   * Deletes a tile and cascade-deletes every sprite linked to it.
   * Both operations run atomically in a single readwrite transaction.
   * @param id - The id of the tile to delete.
   * @throws When the underlying IndexedDB transaction fails; no partial deletion is persisted.
   */
  async deleteTile(id: number): Promise<void> {
    await this.db.transaction('rw', this.db.tiles, this.db.sprites, async () => {
      await this.db.sprites.where('tileId').equals(id).delete();
      await this.db.tiles.delete(id);
    });
  }

  /**
   * Retrieves a single tile by id.
   * @param id - The tile id.
   * @returns The tile, or undefined if not found.
   */
  async getTile(id: number): Promise<Tile | undefined> {
    return this.db.tiles.get(id);
  }
}
