import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { TileSpritesService } from './tile-sprites.service';
import { DatabaseService } from '../../../core/services/database.service';
import type { Sprite } from '../../../shared/models/sprite.model';

describe('TileSpritesService', () => {
  let service: TileSpritesService;
  let db: DatabaseService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [TileSpritesService] });
    service = TestBed.inject(TileSpritesService);
    db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.tiles.clear();
    await db.sprites.clear();
  });

  async function seedSprite(overrides: Partial<Omit<Sprite, 'id'>> = {}): Promise<Sprite> {
    const sprite: Omit<Sprite, 'id'> = {
      projectId: 'proj-1',
      tileId: 1,
      name: 'frame',
      width: 2,
      height: 2,
      pixelData: 'data:image/png;base64,MOCK',
      paletteIndices: [
        [0, 0],
        [0, 0],
      ],
      ...overrides,
    };
    const id = await db.sprites.add(sprite as Sprite);
    return { ...sprite, id };
  }

  it('getTileSprites returns frames ordered by id', async () => {
    await seedSprite({ name: 'first' });
    await seedSprite({ name: 'second' });
    const sprites = await service.getTileSprites(1);
    expect(sprites.map((s) => s.name)).toEqual(['first', 'second']);
  });

  it('createBlankFrame persists sprite with given dims and zero-filled indices', async () => {
    const sprite = await service.createBlankFrame('proj-1', 7, 'frame 2', 32, 16);
    expect(sprite.tileId).toBe(7);
    expect(sprite.width).toBe(32);
    expect(sprite.height).toBe(16);
    expect(sprite.paletteIndices).toHaveLength(16);
    expect(sprite.paletteIndices![0]).toHaveLength(32);
    expect(sprite.paletteIndices!.every((row) => row.every((v) => v === 0))).toBe(true);
    const stored = await db.sprites.get(sprite.id);
    expect(stored).toBeTruthy();
    expect(stored?.name).toBe('frame 2');
  });

  it('deleteSprites removes all listed ids', async () => {
    const a = await seedSprite({ name: 'a' });
    const b = await seedSprite({ name: 'b' });
    const kept = await seedSprite({ name: 'kept' });
    await service.deleteSprites([a.id, b.id]);
    const remaining = await db.sprites.toArray();
    expect(remaining.map((s) => s.id)).toEqual([kept.id]);
  });

  it('resizeSprites shrink crops top-left and persists new dims', async () => {
    const sprite = await seedSprite({
      width: 3,
      height: 3,
      paletteIndices: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    });
    await service.resizeSprites([sprite], 2, 2, ['#ff0000']);
    const stored = await db.sprites.get(sprite.id);
    expect(stored?.width).toBe(2);
    expect(stored?.height).toBe(2);
    expect(stored?.paletteIndices).toEqual([
      [1, 2],
      [4, 5],
    ]);
  });

  it('resizeSprites grow pads with zeros', async () => {
    const sprite = await seedSprite({
      paletteIndices: [
        [1, 0],
        [0, 0],
      ],
    });
    await service.resizeSprites([sprite], 3, 3, ['#ff0000']);
    const stored = await db.sprites.get(sprite.id);
    expect(stored?.width).toBe(3);
    expect(stored?.height).toBe(3);
    expect(stored?.paletteIndices).toEqual([
      [1, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });
});
