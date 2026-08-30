import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { DatabaseService, migrateTileProperties } from './database.service';
import type { Tile } from '../../shared/models/tile.model';

describe('migrateTileProperties', () => {
  it('merges collision/solid into blocking', () => {
    expect(migrateTileProperties({ collision: true, solid: false, layer: 'background' })).toEqual({
      blocking: true,
      interactable: false,
      actionId: undefined,
    });
  });

  it('keeps interactable, drops eventScript/layer', () => {
    const result = migrateTileProperties({
      collision: false,
      solid: true,
      interactable: true,
      eventScript: 'x()',
      layer: 'foreground',
    });
    expect(result).toEqual({ blocking: true, interactable: true, actionId: undefined });
  });

  it('handles missing properties', () => {
    expect(migrateTileProperties(undefined)).toEqual({
      blocking: false,
      interactable: false,
      actionId: undefined,
    });
  });
});

describe('DatabaseService v6 migration', () => {
  it('opens at version 6 and tiles have folderPath default', async () => {
    await Dexie.delete('RiverKingDB');
    const db = new DatabaseService();
    await db.open();
    expect(db.verno).toBe(6);
    const tile = await db.tiles.add({
      projectId: 'p1',
      name: 'Grass',
      type: 'static',
      animationSpeed: 1,
      properties: { blocking: false, interactable: false },
      spriteIds: [],
      folderPath: '',
    } as unknown as Tile);
    const fetched = await db.tiles.get(tile);
    expect(fetched?.folderPath).toBe('');
    await Dexie.delete('RiverKingDB');
  });

  it('seeds legacy folder rows with kind/collapsed/lastOpenedAt when upgrading from v5', async () => {
    await Dexie.delete('RiverKingDB');

    const legacy = new Dexie('RiverKingDB');
    legacy.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      scenes: 'id, projectId, name, folderPath',
      tiles: '++id, projectId, name, type',
      sprites: '++id, projectId, tileId',
      sessions: 'projectId',
    });
    legacy.version(2).stores({ folders: 'id, projectId, path' });
    legacy.version(3).stores({ folders: 'id, projectId, path' });
    legacy.version(4).stores({ scenes: 'id, projectId, name, folderPath' });
    legacy.version(5).stores({ tiles: '++id, projectId, folderPath' });
    await legacy.open();
    await (
      legacy.table('folders') as Dexie.Table<
        { id: string; projectId: string; path: string },
        string
      >
    ).add({ id: 'f1', projectId: 'p1', path: 'forest' });
    await legacy.close();

    const db = new DatabaseService();
    const upgradeEvents: string[] = [];
    db.on('blocked', () => upgradeEvents.push('blocked'));
    await db.open();
    expect(db.verno).toBe(6);
    const folder = await db.folders.get('f1');
    expect(folder?.kind).toBe('scene');
    expect(folder?.collapsed).toBe(false);
    expect(folder?.lastOpenedAt).toBe(0);

    await Dexie.delete('RiverKingDB');
  });
});

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DatabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have projects table', () => {
    expect(service.projects).toBeTruthy();
  });

  it('should add and retrieve a project', async () => {
    const project = {
      id: 'test-1',
      name: 'Test Project',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    };
    await service.projects.add(project);
    const result = await service.projects.get('test-1');
    expect(result?.name).toBe('Test Project');
  });
});

describe('DatabaseService folder row operations', () => {
  let db: DatabaseService;

  beforeEach(async () => {
    db = TestBed.inject(DatabaseService);
    await db.folders.clear();
  });

  it('getFoldersByKind returns only rows of the requested kind', async () => {
    await db.upsertFolderState('p1', 'scene', 'forest', {});
    await db.upsertFolderState('p1', 'tile', 'forest', {});
    const sceneRows = await db.getFoldersByKind('p1', 'scene');
    const tileRows = await db.getFoldersByKind('p1', 'tile');
    expect(sceneRows).toHaveLength(1);
    expect(sceneRows[0].kind).toBe('scene');
    expect(tileRows).toHaveLength(1);
    expect(tileRows[0].kind).toBe('tile');
  });

  it('upsertFolderState inserts a default row and updates it on later calls', async () => {
    await db.upsertFolderState('p1', 'tile', 'forest', { collapsed: true });
    let rows = await db.getFoldersByKind('p1', 'tile');
    expect(rows).toHaveLength(1);
    expect(rows[0].collapsed).toBe(true);
    expect(rows[0].lastOpenedAt).toBe(0);

    await db.upsertFolderState('p1', 'tile', 'forest', { lastOpenedAt: 42 });
    rows = await db.getFoldersByKind('p1', 'tile');
    expect(rows).toHaveLength(1);
    expect(rows[0].collapsed).toBe(true);
    expect(rows[0].lastOpenedAt).toBe(42);
  });

  it('deleteFoldersByKind removes the subtree but only for the requested kind', async () => {
    await db.upsertFolderState('p1', 'scene', 'forest', {});
    await db.upsertFolderState('p1', 'scene', 'forest/caves', {});
    await db.upsertFolderState('p1', 'tile', 'forest', {});
    await db.upsertFolderState('p1', 'tile', 'hills', {});

    await db.deleteFoldersByKind('p1', 'scene', 'forest');

    expect(await db.getFoldersByKind('p1', 'scene')).toEqual([]);
    const tileRows = await db.getFoldersByKind('p1', 'tile');
    expect(tileRows.map((r) => r.path).sort()).toEqual(['forest', 'hills']);
  });

  it('renameFoldersOfKind rewrites matching rows for that kind only', async () => {
    await db.upsertFolderState('p1', 'scene', 'forest', { collapsed: true });
    await db.upsertFolderState('p1', 'scene', 'forest/caves', {});
    await db.upsertFolderState('p1', 'scene', 'town', {});
    await db.upsertFolderState('p1', 'tile', 'forest', {});

    await db.renameFoldersOfKind('p1', 'scene', 'forest', 'woods');

    const scenePaths = (await db.getFoldersByKind('p1', 'scene')).map((r) => r.path).sort();
    expect(scenePaths).toEqual(['town', 'woods', 'woods/caves']);
    const woods = await db.getFoldersByKind('p1', 'scene');
    expect(woods.find((r) => r.path === 'woods')?.collapsed).toBe(true);
    expect((await db.getFoldersByKind('p1', 'tile'))[0].path).toBe('forest');
  });
});
