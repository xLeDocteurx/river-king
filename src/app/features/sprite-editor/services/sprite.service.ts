import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Sprite } from '../../../shared/models/sprite.model';

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
    const paletteIndices: number[][] = Array.from({ length: 16 }, () => Array(16).fill(0));
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
    const width = paletteIndices[0]?.length ?? 16;
    const height = paletteIndices.length ?? 16;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Fallback for test environments without canvas support
      return 'data:image/png;base64,MOCK';
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = paletteIndices[y]?.[x] ?? 0;
        if (idx > 0 && palette[idx - 1]) {
          ctx.fillStyle = palette[idx - 1];
          ctx.fillRect(x, y, 1, 1);
        } else {
          ctx.clearRect(x, y, 1, 1);
        }
      }
    }

    return canvas.toDataURL('image/png');
  }

  async decodePixelData(pixelData: string, palette: string[], width: number, height: number): Promise<number[][]> {
    if (!pixelData || pixelData === 'data:image/png;base64,' || !pixelData.startsWith('data:')) {
      return Array.from({ length: height }, () => Array(width).fill(0));
    }

    const img = new Image();
    img.src = pixelData;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Fallback for test environments without canvas support
      return Array.from({ length: height }, () => Array(width).fill(0));
    }
    ctx.drawImage(img, 0, 0);

    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, width, height);
    } catch {
      return Array.from({ length: height }, () => Array(width).fill(0));
    }

    const result: number[][] = [];
    const paletteColors = palette.map((c) => this.normalizeColor(c));

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];

        if (a < 128) {
          row.push(0);
        } else {
          const color = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
          let found = 0;
          for (let pi = 0; pi < paletteColors.length; pi++) {
            if (paletteColors[pi] === color) {
              found = pi + 1;
              break;
            }
          }
          row.push(found);
        }
      }
      result.push(row);
    }

    return result;
  }

  private normalizeColor(color: string): string {
    const hex = color.replace('#', '');
    if (hex.length === 3) {
      return `#${hex.split('').map((c) => c + c).join('')}`;
    }
    return color.toLowerCase();
  }
}
