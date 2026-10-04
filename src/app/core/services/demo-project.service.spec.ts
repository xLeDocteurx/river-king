import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { DemoProjectService, DEMO_SEED_MARKER } from './demo-project.service';
import { DatabaseService } from './database.service';
import { NotificationService } from './notification.service';
import {
  DEMO_PROJECT_NAME,
  DEMO_SCENE_NAME,
  DEMO_WIDTH,
  DEMO_HEIGHT,
  DEMO_TILE_SIZE,
  POND,
  TREE_ROW_Y,
  TREE_ROW_START_X,
  TREE_ROW_STEP_X,
  TREE_ROW_END_X,
  BOULDER_CELL,
  SIGN_CELL,
} from './demo-art';
import { DEMO_ACTION_ID } from '../actions/game-actions';

describe('DemoProjectService', () => {
  let service: DemoProjectService;
  let db: DatabaseService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DemoProjectService);
    db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.sprites.clear();
    await db.tiles.clear();
    await db.sessions.clear();
    await db.folders.clear();
  });

  it('seeds the full demo on an empty database and sets the marker', async () => {
    const seeded = await service.ensureDemo();
    expect(seeded).toBe(true);
    expect(localStorage.getItem(DEMO_SEED_MARKER)).toBe('true');

    const projects = await db.projects.toArray();
    expect(projects.length).toBe(1);
    const project = projects[0];
    expect(project.name).toBe(DEMO_PROJECT_NAME);
    expect(project.tileSize).toBe(DEMO_TILE_SIZE);
    expect(project.mapWidth).toBe(DEMO_WIDTH);
    expect(project.mapHeight).toBe(DEMO_HEIGHT);
    expect(project.palette.length).toBe(16);
    expect(project.palette.every((c) => c.startsWith('#'))).toBe(true);

    const scenes = await db.scenes.toArray();
    expect(scenes.length).toBe(1);
    const scene = scenes[0];
    expect(scene.name).toBe(DEMO_SCENE_NAME);
    expect(scene.spawnPoint).toBeNull();
    expect(scene.layers.length).toBe(2);

    const [background, overhead] = scene.layers;
    expect(background.name).toBe('Background');
    expect(overhead.name).toBe('Overhead');

    const tiles = await db.tiles.toArray();
    expect(tiles.length).toBe(5);
    const byName = Object.fromEntries(tiles.map((t) => [t.name, t]));
    const grass = byName['Grass'];
    const water = byName['Water'];
    const tree = byName['Tree'];
    const boulder = byName['Boulder'];
    const sign = byName['Sign'];
    expect(grass).toBeTruthy();
    expect(water).toBeTruthy();
    expect(tree).toBeTruthy();
    expect(boulder).toBeTruthy();
    expect(sign).toBeTruthy();

    expect(water.type).toBe('animated');
    expect(water.spriteIds.length).toBe(2);
    expect(water.animationSpeed).toBe(4);
    expect(water.properties.blocking).toBe(true);

    expect(tree.spriteIds.length).toBe(2);
    expect(tree.properties.blocking).toBe(true);
    expect(tree.properties.ySort).toBe(true);

    expect(boulder.properties.blocking).toBe(true);

    expect(sign.properties.interactable).toBe(true);
    expect(sign.properties.actionId).toBe(DEMO_ACTION_ID);

    expect(grass.spriteIds.length).toBe(1);
    expect(grass.properties.blocking).toBe(false);
    expect(grass.properties.ySort).toBe(false);

    // Background layer: grass everywhere.
    for (const row of background.tileData) {
      for (const cell of row) {
        expect(cell).toBe(grass.id);
      }
    }
    expect(background.tileData.length).toBe(DEMO_HEIGHT);
    expect(background.tileData[0].length).toBe(DEMO_WIDTH);

    // Overhead layer: pond, tree row, boulder, sign; rest empty.
    for (let y = POND.y; y < POND.y + POND.h; y++) {
      for (let x = POND.x; x < POND.x + POND.w; x++) {
        expect(overhead.tileData[y][x]).toBe(water.id);
      }
    }
    for (let x = TREE_ROW_START_X; x <= TREE_ROW_END_X; x += TREE_ROW_STEP_X) {
      expect(overhead.tileData[TREE_ROW_Y][x]).toBe(tree.id);
    }
    expect(overhead.tileData[BOULDER_CELL.y][BOULDER_CELL.x]).toBe(boulder.id);
    expect(overhead.tileData[SIGN_CELL.y][SIGN_CELL.x]).toBe(sign.id);

    const sprites = await db.sprites.toArray();
    expect(sprites.length).toBe(7);
    for (const sprite of sprites) {
      expect(sprite.width).toBe(DEMO_TILE_SIZE);
      expect(sprite.height).toBe(DEMO_TILE_SIZE);
      expect(sprite.pixelData.startsWith('data:image/png')).toBe(true);
      expect(sprite.paletteIndices).toBeDefined();
    }
  });

  it('never seeds again once the marker is present', async () => {
    localStorage.setItem(DEMO_SEED_MARKER, 'true');
    const seeded = await service.ensureDemo();
    expect(seeded).toBe(false);
    expect(await db.projects.count()).toBe(0);
  });

  it('sets the marker without seeding when the base is already populated', async () => {
    await db.projects.add({
      id: crypto.randomUUID(),
      name: 'Existing',
      createdAt: 1,
      updatedAt: 1,
      palette: ['#000000'],
      tileSize: 16,
      mapWidth: 10,
      mapHeight: 10,
    });
    const seeded = await service.ensureDemo();
    expect(seeded).toBe(false);
    expect(localStorage.getItem(DEMO_SEED_MARKER)).toBe('true');
    expect(await db.projects.count()).toBe(1);
  });

  it('does not resurrect the demo after it is deleted', async () => {
    await service.ensureDemo();
    await db.projects.clear();
    await db.scenes.clear();
    await db.sprites.clear();
    await db.tiles.clear();
    const seeded = await service.ensureDemo();
    expect(seeded).toBe(false);
    expect(await db.projects.count()).toBe(0);
  });

  it('keeps concurrent calls to a single seed', async () => {
    const [s1, s2] = await Promise.all([service.ensureDemo(), service.ensureDemo()]);
    expect([s1, s2].filter(Boolean)).toHaveLength(1);
    expect(await db.projects.count()).toBe(1);
  });

  it('notifies and leaves the marker unset when seeding fails', async () => {
    vi.spyOn(db.projects, 'count').mockRejectedValueOnce(new Error('boom'));
    const notify = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notify, 'error');
    const seeded = await service.ensureDemo();
    expect(seeded).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Failed to set up the demo project');
    expect(localStorage.getItem(DEMO_SEED_MARKER)).toBeNull();
  });
});