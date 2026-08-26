import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { TileService } from './tile.service';
import { SpriteService } from '../../sprite-editor/services/sprite.service';
import { DatabaseService } from '../../../core/services/database.service';

describe('TileService', () => {
  let service: TileService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [TileService, SpriteService] });
    service = TestBed.inject(TileService);
    const db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a tile with defaults', async () => {
    const tile = await service.createTile('proj-1', 'Test Tile');
    expect(tile.name).toBe('Test Tile');
    expect(tile.projectId).toBe('proj-1');
    expect(tile.type).toBe('static');
    expect(tile.animationSpeed).toBe(4);
    expect(tile.spriteIds).toEqual([]);
    expect(tile.properties.blocking).toBe(false);
    expect(tile.properties.interactable).toBe(false);
  });

  it('should list tiles by projectId', async () => {
    await service.createTile('proj-1', 'Tile A');
    await service.createTile('proj-1', 'Tile B');
    await service.createTile('proj-2', 'Tile C');
    const tiles = await service.getTiles('proj-1');
    expect(tiles.length).toBe(2);
    expect(tiles.some((t: { name: string }) => t.name === 'Tile A')).toBe(true);
    expect(tiles.some((t: { name: string }) => t.name === 'Tile B')).toBe(true);
  });

  it('should update a tile', async () => {
    const tile = await service.createTile('proj-1', 'Original');
    await service.updateTile(tile.id, { name: 'Updated', type: 'animated' });
    const updated = await service.getTile(tile.id);
    expect(updated?.name).toBe('Updated');
    expect(updated?.type).toBe('animated');
  });

  it('should delete a tile', async () => {
    const tile = await service.createTile('proj-1', 'To Delete');
    await service.deleteTile(tile.id);
    const result = await service.getTile(tile.id);
    expect(result).toBeUndefined();
  });

  it('should cascade-delete linked sprites when deleting a tile', async () => {
    const db = TestBed.inject(DatabaseService);
    const spriteService = TestBed.inject(SpriteService);

    const tile = await service.createTile('proj-1', 'Framed');
    const frame = await spriteService.createSprite('proj-1', 'Frame 1', tile.id);
    await spriteService.createSprite('proj-1', 'Unrelated', 9999);

    await service.deleteTile(tile.id);

    expect(await service.getTile(tile.id)).toBeUndefined();
    expect(await spriteService.getSprite(frame.id)).toBeUndefined();
    const remaining = await db.sprites.toArray();
    expect(remaining.map((s) => s.name)).toEqual(['Unrelated']);
  });
});
