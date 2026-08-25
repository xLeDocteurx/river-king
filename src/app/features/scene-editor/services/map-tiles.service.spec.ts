import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { MapTilesService } from './map-tiles.service';
import { DatabaseService } from '../../../core/services/database.service';
import type { Sprite } from '../../../shared/models/sprite.model';

describe('MapTilesService', () => {
  let service: MapTilesService;
  let db: DatabaseService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [MapTilesService] });
    service = TestBed.inject(MapTilesService);
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
      width: 16,
      height: 16,
      pixelData: 'data:image/png;base64,MOCK',
      paletteIndices: Array.from({ length: 16 }, () => Array<number>(16).fill(0)),
      ...overrides,
    };
    const id = await db.sprites.add(sprite as Sprite);
    return { ...sprite, id };
  }

  it('returns an empty record when the project has no sprites', async () => {
    const { images } = await service.loadTileVisuals('proj-1', 16);
    expect(images).toEqual({});
  });

  it('maps each tileId to an array of all frame pixelDatas sorted by id', async () => {
    const first = await seedSprite({ tileId: 1, pixelData: 'data:image/png;base64,F1' });
    const second = await seedSprite({ tileId: 1, pixelData: 'data:image/png;base64,F2' });
    const other = await seedSprite({ tileId: 2, pixelData: 'data:image/png;base64,T2' });

    const { images } = await service.loadTileVisuals('proj-1', 16);

    expect(images[1]).toEqual([first.pixelData, second.pixelData]);
    expect(images[2]).toEqual([other.pixelData]);
    expect(Object.keys(images)).toHaveLength(2);
  });

  it('returns all frames for a tile when several frames exist', async () => {
    await seedSprite({ tileId: 5, pixelData: 'data:image/png;base64,A' });
    await seedSprite({ tileId: 5, pixelData: 'data:image/png;base64,B' });

    const { images } = await service.loadTileVisuals('proj-1', 16);

    expect(Object.keys(images)).toEqual(['5']);
    expect(images[5]).toHaveLength(2);
  });

  it('ignores standalone sprites (tileId <= 0)', async () => {
    await seedSprite({ tileId: 0 });
    const { images, footprints } = await service.loadTileVisuals('proj-1', 16);
    expect(images).toEqual({});
    expect(footprints).toEqual({});
  });

  it('only returns sprites belonging to the requested project', async () => {
    const mine = await seedSprite({ projectId: 'proj-1', tileId: 3 });
    await seedSprite({ projectId: 'proj-2', tileId: 3, pixelData: 'data:image/png;base64,OTHER' });

    const { images } = await service.loadTileVisuals('proj-1', 16);

    expect(images[3]).toEqual([mine.pixelData]);
  });

  it('computes footprints in grid cells using ceil of sprite dimensions', async () => {
    await seedSprite({ tileId: 1, width: 32, height: 40 });

    const { images, footprints } = await service.loadTileVisuals('proj-1', 16);

    expect(images[1]).toBeDefined();
    expect(footprints[1]).toEqual({ w: 2, h: 3 });
  });

  it('clamps footprints to at least one cell', async () => {
    await seedSprite({ tileId: 1, width: 8, height: 5 });

    const { footprints } = await service.loadTileVisuals('proj-1', 16);

    expect(footprints[1]).toEqual({ w: 1, h: 1 });
  });

  it('honours the provided tile size when computing footprints', async () => {
    await seedSprite({ tileId: 1, width: 48, height: 16 });

    const { footprints } = await service.loadTileVisuals('proj-1', 24);

    expect(footprints[1]).toEqual({ w: 2, h: 1 });
  });

  it('returns animation metadata for tiles with animated type and multiple frames', async () => {
    const tileId = await db.tiles.add({
      projectId: 'proj-1',
      name: 'anim',
      type: 'animated',
      spriteIds: [],
      animationSpeed: 12,
      properties: { blocking: false, interactable: false },
    } as unknown as import('../../../shared/models/tile.model').Tile);
    await seedSprite({ tileId, pixelData: 'data:image/png;base64,A' });
    await seedSprite({ tileId, pixelData: 'data:image/png;base64,B' });
    await seedSprite({ tileId, pixelData: 'data:image/png;base64,C' });

    const { animations } = await service.loadTileVisuals('proj-1', 16);

    expect(animations[tileId]).toEqual({ frameCount: 3, fps: 12 });
  });

  it('does not return animation metadata for static tiles', async () => {
    const tileId = await db.tiles.add({
      projectId: 'proj-1',
      name: 'static',
      type: 'static',
      spriteIds: [],
      animationSpeed: 8,
      properties: { blocking: false, interactable: false },
    } as unknown as import('../../../shared/models/tile.model').Tile);
    await seedSprite({ tileId, pixelData: 'data:image/png;base64,X' });

    const { animations } = await service.loadTileVisuals('proj-1', 16);

    expect(animations).toEqual({});
  });
});
