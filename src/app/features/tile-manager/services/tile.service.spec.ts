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
    await db.folders.clear();
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

  it('updateTileFolder sets folderPath', async () => {
    const tile = await service.createTile('p1', 'Test');
    await service.updateTileFolder(tile.id, 'Terrain/Grass');
    const updated = await service.getTile(tile.id);
    expect(updated?.folderPath).toBe('Terrain/Grass');
  });

  it('getFolders returns distinct sorted folder paths', async () => {
    await service.createTile('p1', 'A');
    const t2 = await service.createTile('p1', 'B');
    await service.updateTileFolder(t2.id, 'UI/Buttons');
    const t3 = await service.createTile('p1', 'C');
    await service.updateTileFolder(t3.id, 'UI/Buttons');
    const folders = await service.getFolders('p1');
    expect(folders).toEqual(['', 'UI/Buttons']);
  });

  it('renameFolder rewrites folder paths of direct and nested tiles', async () => {
    const direct = await service.createTile('p1', 'Direct');
    await service.updateTileFolder(direct.id, 'forest');
    const nested = await service.createTile('p1', 'Nested');
    await service.updateTileFolder(nested.id, 'forest/caves');
    const unrelated = await service.createTile('p1', 'Town');
    await service.updateTileFolder(unrelated.id, 'town');

    await service.renameFolder('p1', 'forest', 'woods');

    expect((await service.getTile(direct.id))?.folderPath).toBe('woods');
    expect((await service.getTile(nested.id))?.folderPath).toBe('woods/caves');
    expect((await service.getTile(unrelated.id))?.folderPath).toBe('town');
  });

  it('renameFolder only affects the requested project', async () => {
    const mine = await service.createTile('p1', 'Mine');
    await service.updateTileFolder(mine.id, 'forest');
    const other = await service.createTile('p2', 'Other');
    await service.updateTileFolder(other.id, 'forest');

    await service.renameFolder('p1', 'forest', 'woods');

    expect((await service.getTile(mine.id))?.folderPath).toBe('woods');
    expect((await service.getTile(other.id))?.folderPath).toBe('forest');
  });

  it('getFolders unions derived tile paths with materialized tile folder rows', async () => {
    await service.createTile('p1', 'root-tile');
    const moved = await service.createTile('p1', 'A');
    await service.updateTileFolder(moved.id, 'UI/Buttons');
    await service.upsertFolderState('p1', 'UI/Buttons', { collapsed: true });
    await service.upsertFolderState('p1', 'empty-folder', { lastOpenedAt: 7 });

    const folders = await service.getFolders('p1');
    expect(folders).toEqual(['', 'empty-folder', 'UI/Buttons']);
  });

  it('getFolderRows returns materialized tile folder rows only', async () => {
    await service.upsertFolderState('p1', 'forest', { collapsed: true });
    const rows = await service.getFolderRows('p1');
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('tile');
    expect(rows[0].collapsed).toBe(true);
  });

  it('upsertFolderState persists folded state for a tile folder', async () => {
    await service.upsertFolderState('p1', 'forest', { collapsed: true, lastOpenedAt: 42 });
    const [row] = await service.getFolderRows('p1');
    expect(row.collapsed).toBe(true);
    expect(row.lastOpenedAt).toBe(42);
  });

  it('deleteTileFolders removes the tile folder subtree', async () => {
    await service.upsertFolderState('p1', 'forest', {});
    await service.upsertFolderState('p1', 'forest/caves', {});
    await service.deleteTileFolders('p1', 'forest');
    expect(await service.getFolderRows('p1')).toEqual([]);
  });

  it('renameFolder rewrites materialized tile folder rows, preserving state', async () => {
    await service.upsertFolderState('p1', 'forest', { collapsed: true });
    await service.upsertFolderState('p1', 'forest/caves', {});
    await service.upsertFolderState('p1', 'town', {});

    await service.renameFolder('p1', 'forest', 'woods');

    const rows = await service.getFolderRows('p1');
    expect(rows.map((r) => r.path).sort()).toEqual(['town', 'woods', 'woods/caves']);
    expect(rows.find((r) => r.path === 'woods')?.collapsed).toBe(true);
  });

  it('rewriteFolderRows rewrites materialized rows for a nesting move', async () => {
    await service.upsertFolderState('p1', 'forest', {});
    await service.upsertFolderState('p1', 'forest/caves', {});

    await service.rewriteFolderRows('p1', 'forest', 'town/forest');

    const rows = await service.getFolderRows('p1');
    expect(rows.map((r) => r.path).sort()).toEqual(['town/forest', 'town/forest/caves']);
  });
});
