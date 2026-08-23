import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Tile } from '../../../shared/models/tile.model';

@Injectable()
export class TileService {
  private readonly db = inject(DatabaseService);

  async getTiles(projectId: string): Promise<Tile[]> {
    return this.db.tiles.where('projectId').equals(projectId).toArray();
  }

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

  async getTile(id: number): Promise<Tile | undefined> {
    return this.db.tiles.get(id);
  }
}
