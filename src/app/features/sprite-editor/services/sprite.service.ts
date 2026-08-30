import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Sprite } from '../../../shared/models/sprite.model';
import { blankIndices, decodePixelData, encodePixelData } from '../../../shared/utils/pixel-data';

/**
 * CRUD and encoding utilities for sprites within the sprite editor feature.
 *
 * New sprites are created with a blank transparent canvas at the specified dimensions. The service
 * also provides palette-index ↔ base64-PNG conversion helpers used by the
 * editor's painting pipeline.
 */
@Injectable()
export class SpriteService {
  private readonly db = inject(DatabaseService);

  /**
   * Retrieve all sprites belonging to a project.
   *
   * @param projectId - The owning project's identifier.
   * @returns Array of sprites for the project.
   */
  async getSprites(projectId: string): Promise<Sprite[]> {
    return this.db.sprites.where('projectId').equals(projectId).toArray();
  }

  /**
   * Retrieve all sprites associated with a specific tile.
   *
   * @param tileId - The tile identifier to filter by.
   * @returns Array of sprites linked to the tile.
   */
  async getSpritesByTileId(tileId: number): Promise<Sprite[]> {
    return this.db.sprites.where('tileId').equals(tileId).toArray();
  }

  /**
   * Create a new blank sprite and persist it to the database.
   *
   * The sprite is initialised as a 16×16 transparent canvas.
   *
   * @param projectId - The owning project's identifier.
   * @param name      - Display name for the sprite.
   * @param tileId    - Tile this sprite is associated with.
   * @param width     - Sprite width in pixels (default 16).
   * @param height    - Sprite height in pixels (default 16).
   * @returns The newly created {@link Sprite} with its generated `id`.
   * @throws Will throw if the underlying IndexedDB write fails.
   */
  async createSprite(
    projectId: string,
    name: string,
    tileId: number,
    width = 16,
    height = 16,
  ): Promise<Sprite> {
    const paletteIndices = blankIndices(width, height);
    const pixelData = encodePixelData(paletteIndices, []);
    const sprite: Omit<Sprite, 'id'> = {
      projectId,
      tileId,
      name,
      width,
      height,
      pixelData,
      paletteIndices,
    };
    const id = await this.db.sprites.add(sprite as Sprite);
    return { ...sprite, id } as Sprite;
  }

  /**
   * Apply partial updates to an existing sprite.
   *
   * @param id      - The sprite's primary key.
   * @param changes - Fields to update (`id` is immutable).
   */
  async updateSprite(id: number, changes: Partial<Omit<Sprite, 'id'>>): Promise<void> {
    await this.db.sprites.update(id, changes);
  }

  /**
   * Permanently remove a sprite from the database.
   *
   * @param id - The sprite's primary key.
   */
  async deleteSprite(id: number): Promise<void> {
    await this.db.sprites.delete(id);
  }

  /**
   * Fetch a single sprite by its primary key.
   *
   * @param id - The sprite's primary key.
   * @returns The matching {@link Sprite}, or `undefined` if not found.
   */
  async getSprite(id: number): Promise<Sprite | undefined> {
    return this.db.sprites.get(id);
  }

  /**
   * Encode a palette-index grid into a base64 PNG data-URL.
   *
   * @param paletteIndices - 2-D grid of palette indices to encode.
   * @param palette        - Project palette used to resolve indices to colors.
   * @returns Base64-encoded PNG data-URL string.
   */
  encodePixelData(paletteIndices: number[][], palette: string[]): string {
    return encodePixelData(paletteIndices, palette);
  }

  /**
   * Decode a base64 PNG into a palette-index grid.
   *
   * @param pixelData - Base64-encoded PNG data-URL to decode.
   * @param palette   - Project palette for color-to-index mapping.
   * @param width     - Sprite width in pixels.
   * @param height    - Sprite height in pixels.
   * @returns 2-D array of palette indices matching the decoded image.
   */
  decodePixelData(
    pixelData: string,
    palette: string[],
    width: number,
    height: number,
  ): Promise<number[][]> {
    return decodePixelData(pixelData, palette, width, height);
  }
}
