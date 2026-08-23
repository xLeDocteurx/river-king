import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import { SpriteService } from './sprite.service';
import { DatabaseService } from '../../../core/services/database.service';

describe('SpriteService', () => {
  let service: SpriteService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [SpriteService] });
    service = TestBed.inject(SpriteService);
    const db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a sprite with defaults', async () => {
    const sprite = await service.createSprite('proj-1', 'Test Sprite', 42);
    expect(sprite.name).toBe('Test Sprite');
    expect(sprite.projectId).toBe('proj-1');
    expect(sprite.tileId).toBe(42);
    expect(sprite.width).toBe(16);
    expect(sprite.height).toBe(16);
    expect(sprite.pixelData).toBeTruthy();
    expect(sprite.paletteIndices).toHaveLength(16);
    expect(sprite.paletteIndices![0]).toHaveLength(16);
    expect(sprite.paletteIndices![0][0]).toBe(0);
  });

  it('should list sprites by projectId', async () => {
    await service.createSprite('proj-1', 'Sprite A', 1);
    await service.createSprite('proj-1', 'Sprite B', 2);
    await service.createSprite('proj-2', 'Sprite C', 3);
    const sprites = await service.getSprites('proj-1');
    expect(sprites.length).toBe(2);
    expect(sprites.some((s: { name: string }) => s.name === 'Sprite A')).toBe(true);
    expect(sprites.some((s: { name: string }) => s.name === 'Sprite B')).toBe(true);
  });

  it('should list sprites by tileId', async () => {
    await service.createSprite('proj-1', 'Sprite A', 1);
    await service.createSprite('proj-1', 'Sprite B', 1);
    await service.createSprite('proj-1', 'Sprite C', 2);
    const sprites = await service.getSpritesByTileId(1);
    expect(sprites.length).toBe(2);
  });

  it('should update a sprite', async () => {
    const sprite = await service.createSprite('proj-1', 'Original', 1);
    await service.updateSprite(sprite.id, { name: 'Updated' });
    const updated = await service.getSprite(sprite.id);
    expect(updated?.name).toBe('Updated');
  });

  it('should delete a sprite', async () => {
    const sprite = await service.createSprite('proj-1', 'To Delete', 1);
    await service.deleteSprite(sprite.id);
    const result = await service.getSprite(sprite.id);
    expect(result).toBeUndefined();
  });
});
