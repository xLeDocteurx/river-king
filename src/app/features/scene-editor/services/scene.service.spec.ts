import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { SceneService } from './scene.service';
import { DatabaseService } from '../../../core/services/database.service';

describe('SceneService', () => {
  let service: SceneService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [SceneService] });
    service = TestBed.inject(SceneService);
    const db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
    if ('folders' in db) {
      await db.folders.clear();
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a scene with a default layer containing empty tileData (all -1)', async () => {
    const scene = await service.createScene('proj-1', 'Test Scene', 10, 10);
    expect(scene.name).toBe('Test Scene');
    expect(scene.projectId).toBe('proj-1');
    expect(scene.width).toBe(10);
    expect(scene.height).toBe(10);
    expect(scene.layers).toHaveLength(1);
    expect(scene.layers[0].tileData).toHaveLength(10);
    expect(scene.layers[0].tileData[0]).toHaveLength(10);
    expect(scene.layers[0].tileData[0][0]).toBe(-1);
  });

  it('should list scenes by projectId', async () => {
    await service.createScene('proj-1', 'Scene A', 10, 10);
    await service.createScene('proj-1', 'Scene B', 10, 10);
    await service.createScene('proj-2', 'Scene C', 10, 10);
    const scenes = await service.getScenes('proj-1');
    expect(scenes.length).toBe(2);
    expect(scenes.some((s: { name: string }) => s.name === 'Scene A')).toBe(true);
    expect(scenes.some((s: { name: string }) => s.name === 'Scene B')).toBe(true);
  });

  it('should update a scene', async () => {
    const scene = await service.createScene('proj-1', 'Original', 10, 10);
    await service.updateScene(scene.id, { name: 'Updated' });
    const updated = await service.getScene(scene.id);
    expect(updated?.name).toBe('Updated');
  });

  it('should delete a scene', async () => {
    const scene = await service.createScene('proj-1', 'To Delete', 10, 10);
    await service.deleteScene(scene.id);
    const result = await service.getScene(scene.id);
    expect(result).toBeUndefined();
  });

  it('should update scene folderPath', async () => {
    const scene = await service.createScene('proj-1', 'Movable', 10, 10);
    expect(scene.folderPath).toBe('');
    await service.updateSceneFolder(scene.id, 'new-folder');
    const updated = await service.getScene(scene.id);
    expect(updated?.folderPath).toBe('new-folder');
  });

  it('should persist a folder for a project', async () => {
    await service.createFolder('proj-1', 'forest');
    const folders = await service.getFolders('proj-1');
    expect(folders).toHaveLength(1);
    expect(folders[0].path).toBe('forest');
    expect(folders[0].projectId).toBe('proj-1');
  });

  it('should not duplicate an existing folder path within the same project', async () => {
    await service.createFolder('proj-1', 'forest');
    await service.createFolder('proj-1', 'forest');
    const folders = await service.getFolders('proj-1');
    expect(folders).toHaveLength(1);
  });

  it('should allow the same folder path in different projects', async () => {
    await service.createFolder('proj-1', 'forest');
    await service.createFolder('proj-2', 'forest');
    expect(await service.getFolders('proj-1')).toHaveLength(1);
    expect(await service.getFolders('proj-2')).toHaveLength(1);
  });

  it('renameFolder rewrites folder rows and scene folderPaths (direct and nested)', async () => {
    await service.createFolder('proj-1', 'forest');
    await service.createFolder('proj-1', 'forest/caves');
    await service.createFolder('proj-1', 'town');
    const direct = await service.createScene('proj-1', 'Direct', 10, 10);
    await service.updateSceneFolder(direct.id, 'forest');
    const nested = await service.createScene('proj-1', 'Nested', 10, 10);
    await service.updateSceneFolder(nested.id, 'forest/caves');
    const root = await service.createScene('proj-1', 'Root', 10, 10);

    await service.renameFolder('proj-1', 'forest', 'woods');

    const paths = (await service.getFolders('proj-1')).map((f) => f.path).sort();
    expect(paths).toEqual(['town', 'woods', 'woods/caves']);
    expect((await service.getScene(direct.id))?.folderPath).toBe('woods');
    expect((await service.getScene(nested.id))?.folderPath).toBe('woods/caves');
    expect((await service.getScene(root.id))?.folderPath).toBe('');
  });

  it('renameFolder leaves other projects untouched', async () => {
    await service.createFolder('proj-1', 'forest');
    await service.createFolder('proj-2', 'forest');
    const other = await service.createScene('proj-2', 'Other', 10, 10);
    await service.updateSceneFolder(other.id, 'forest');

    await service.renameFolder('proj-1', 'forest', 'woods');

    expect((await service.getFolders('proj-1')).map((f) => f.path)).toEqual(['woods']);
    expect((await service.getFolders('proj-2')).map((f) => f.path)).toEqual(['forest']);
    expect((await service.getScene(other.id))?.folderPath).toBe('forest');
  });

  it('createFolder persists a kind=scene row with default folding state', async () => {
    await service.createFolder('proj-1', 'forest');
    const [folder] = await service.getFolders('proj-1');
    expect(folder.kind).toBe('scene');
    expect(folder.collapsed).toBe(false);
    expect(folder.lastOpenedAt).toBe(0);
  });

  it('upsertFolderState updates the existing scene folder row in place', async () => {
    await service.createFolder('proj-1', 'forest');
    await service.upsertFolderState('proj-1', 'forest', { collapsed: true, lastOpenedAt: 42 });

    const folders = await service.getFolders('proj-1');
    expect(folders).toHaveLength(1);
    expect(folders[0].collapsed).toBe(true);
    expect(folders[0].lastOpenedAt).toBe(42);
  });

  it('upsertFolderState inserts a row for a path that has no folder row yet', async () => {
    await service.upsertFolderState('proj-1', 'forest', { lastOpenedAt: 7 });
    const [folder] = await service.getFolders('proj-1');
    expect(folder.path).toBe('forest');
    expect(folder.kind).toBe('scene');
    expect(folder.lastOpenedAt).toBe(7);
  });

  it('getFolders ignores tile-kind folder rows sharing the same path', async () => {
    await service.createFolder('proj-1', 'forest');
    const db = TestBed.inject(DatabaseService);
    await db.upsertFolderState('proj-1', 'tile', 'forest', { collapsed: true });

    const folders = await service.getFolders('proj-1');
    expect(folders).toHaveLength(1);
    expect(folders[0].kind).toBe('scene');
  });
});
