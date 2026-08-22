import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Sprite } from '../../../shared/models/sprite.model';
import { blankIndices, decodePixelData, encodePixelData } from '../../../shared/utils/pixel-data';

@Injectable()
export class SpriteService {
  private readonly db = inject(DatabaseService);

  async getSprites(projectId: string): Promise<Sprite[]> {
    return this.db.sprites.where('projectId').equals(projectId).toArray();
  }

  async getSpritesByTileId(tileId: number): Promise<Sprite[]> {
    return this.db.sprites.where('tileId').equals(tileId).toArray();
  }

  private static readonly BLANK_PIXEL_DATA =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZGBgEGHADxjZ2Nj+49fMyMj4n5E28IURuwFmYcVAumHUiFEzjFoBADkGA/wz9BzXAAAAAElFTkSuQmCC';

  async createSprite(projectId: string, name: string, tileId: number): Promise<Sprite> {
    const paletteIndices = blankIndices(16, 16);
    const sprite: Omit<Sprite, 'id'> = {
      projectId,
      tileId,
      name,
      width: 16,
      height: 16,
      pixelData: SpriteService.BLANK_PIXEL_DATA,
      paletteIndices,
    };
    const id = await this.db.sprites.add(sprite as Sprite);
    return { ...sprite, id } as Sprite;
  }

  async updateSprite(id: number, changes: Partial<Omit<Sprite, 'id'>>): Promise<void> {
    await this.db.sprites.update(id, changes);
  }

  async deleteSprite(id: number): Promise<void> {
    await this.db.sprites.delete(id);
  }

  async getSprite(id: number): Promise<Sprite | undefined> {
    return this.db.sprites.get(id);
  }

  encodePixelData(paletteIndices: number[][], palette: string[]): string {
    return encodePixelData(paletteIndices, palette);
  }

  decodePixelData(
    pixelData: string,
    palette: string[],
    width: number,
    height: number,
  ): Promise<number[][]> {
    return decodePixelData(pixelData, palette, width, height);
  }
}
