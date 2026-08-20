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
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create a scene with empty tileData (all -1)', async () => {
    const scene = await service.createScene('proj-1', 'Test Scene', 10, 10);
    expect(scene.name).toBe('Test Scene');
    expect(scene.projectId).toBe('proj-1');
    expect(scene.width).toBe(10);
    expect(scene.height).toBe(10);
    expect(scene.tileData).toHaveLength(10);
    expect(scene.tileData[0]).toHaveLength(10);
    expect(scene.tileData[0][0]).toBe(-1);
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
});
