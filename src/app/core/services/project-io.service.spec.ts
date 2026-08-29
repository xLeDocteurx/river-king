import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { DatabaseService } from './database.service';
import { ProjectIoService } from './project-io.service';
import {
  PROJECT_ARCHIVE_FORMAT,
  PROJECT_ARCHIVE_VERSION,
} from '../../shared/models/project-archive.model';
import type { Sprite } from '../../shared/models/sprite.model';
import type { Tile } from '../../shared/models/tile.model';
import type { ProjectArchive } from '../../shared/models/project-archive.model';
import type { Folder } from '../../shared/models/folder.model';

describe('ProjectIoService', () => {
  let db: DatabaseService;
  let service: ProjectIoService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [ProjectIoService],
    }).compileComponents();
    db = TestBed.inject(DatabaseService);
    service = TestBed.inject(ProjectIoService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
    await db.folders.clear();
  });

  /** Seeds a representative project. Returns its id plus the first tile id. */
  async function seedProject(): Promise<{ projectId: string; groundId: number }> {
    const projectId = 'proj-1';
    await db.projects.add({
      id: projectId,
      name: 'Heroes',
      createdAt: 1,
      updatedAt: 2,
      palette: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
    const groundId = await db.tiles.add({
      projectId,
      name: 'Ground',
      type: 'static',
      spriteIds: [] as number[],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
      folderPath: '',
    } as Tile);
    const waterId = await db.tiles.add({
      projectId,
      name: 'Water',
      type: 'animated',
      spriteIds: [] as number[],
      animationSpeed: 8,
      properties: { blocking: true, interactable: true, actionId: 'talk' },
      folderPath: 'nature',
    } as Tile);
    const groundSpriteId = await db.sprites.add({
      id: groundId,
      projectId,
      tileId: groundId,
      name: 'Ground frame',
      width: 16,
      height: 16,
      pixelData: 'data:image/png;base64,AAA',
      paletteIndices: [
        [0, 1],
        [1, 0],
      ],
    } as Sprite);
    const water1 = await db.sprites.add({
      projectId,
      tileId: waterId,
      name: 'Water 1',
      width: 16,
      height: 16,
      pixelData: 'data:image/png;base64,BBB',
    } as Sprite);
    const water2 = await db.sprites.add({
      projectId,
      tileId: waterId,
      name: 'Water 2',
      width: 16,
      height: 16,
      pixelData: 'data:image/png;base64,CCC',
    } as Sprite);
    await db.tiles.update(groundId, { spriteIds: [groundSpriteId] });
    await db.tiles.update(waterId, { spriteIds: [water1, water2] });
    await db.folders.add({ id: 'f-1', projectId, path: 'nature' });
    await db.scenes.add({
      id: 's-1',
      projectId,
      name: 'Level 1',
      folderPath: '',
      width: 10,
      height: 10,
      layers: [
        {
          id: 'l-1',
          name: 'Background',
          visible: true,
          opacity: 1,
          tileData: [
            [groundId, -1],
            [-1, waterId],
          ],
        },
      ],
    });
    return { projectId, groundId };
  }

  it('exports a complete, deterministic archive string', async () => {
    const { projectId } = await seedProject();
    const json = await service.exportProject(projectId);

    const archive = JSON.parse(json) as {
      format: string;
      formatVersion: number;
      exportedAt: number;
      project: { name: string; palette: string[]; tileSize: number };
      tiles: { sourceId: number; spriteIds: number[]; folderPath: string }[];
      sprites: { sourceId: number; pixelData: string }[];
      scenes: { name: string; layers: { tileData: number[][] }[] }[];
      folders: string[];
    };

    expect(archive.format).toBe(PROJECT_ARCHIVE_FORMAT);
    expect(archive.formatVersion).toBe(PROJECT_ARCHIVE_VERSION);
    expect(archive.project.name).toBe('Heroes');
    expect(archive.project.palette).toEqual(['#ff0000', '#00ff00', '#0000ff', '#ffffff']);
    expect(archive.project.tileSize).toBe(16);
    expect(archive.tiles).toHaveLength(2);
    expect(archive.tiles[0].spriteIds).toEqual([archive.tiles[0].sourceId]);
    expect(archive.tiles[1].spriteIds).toHaveLength(2);
    expect(archive.tiles[1].folderPath).toBe('nature');
    expect(archive.sprites).toHaveLength(3);
    expect(archive.sprites[0].pixelData).toBe('data:image/png;base64,AAA');
    expect(archive.scenes).toHaveLength(1);
    expect(archive.scenes[0].layers[0].tileData).toEqual([
      [archive.tiles[0].sourceId, -1],
      [-1, archive.tiles[1].sourceId],
    ]);
    expect(archive.folders).toEqual(['nature']);
  });

  it('throws a reference error when exporting an unknown project', async () => {
    await expect(service.exportProject('ghost')).rejects.toThrow(/not found/);
  });

  /** Imports seed data (see seedProject) as a fresh project and returns it. */
  async function importFresh(): Promise<{
    archive: ProjectArchive;
    result: { projectId: string; kind: 'new' | 'replace' };
  }> {
    const { projectId } = await seedProject();
    const json = await service.exportProject(projectId);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
    await db.folders.clear();
    const archive = JSON.parse(json) as ProjectArchive;
    const result = await service.importProject(json, { kind: 'new' });
    return { archive, result };
  }

  it('imports as a new project with remapped ids and preserved content', async () => {
    const { archive, result } = await importFresh();

    expect(result.kind).toBe('new');
    expect(result.projectId).toBeTruthy();
    expect(result.projectId).not.toBe('proj-1');

    const project = await db.projects.get(result.projectId);
    expect(project?.name).toBe('Heroes');
    expect(project?.palette).toEqual(['#ff0000', '#00ff00', '#0000ff', '#ffffff']);
    expect(project?.tileSize).toBe(16);
    expect(project?.mapWidth).toBe(40);
    expect(project?.mapHeight).toBe(30);

    const tiles = await db.tiles.where('projectId').equals(result.projectId).toArray();
    expect(tiles).toHaveLength(2);
    for (const tile of tiles) {
      expect(archive.tiles.some((t) => t.name === tile.name && t.type === tile.type)).toBe(true);
      expect(tile.spriteIds.length).toBeGreaterThan(0);
      for (const sid of tile.spriteIds) {
        const sprite = await db.sprites.get(sid);
        expect(sprite?.tileId).toBe(tile.id);
      }
    }

    const sprites = await db.sprites.where('projectId').equals(result.projectId).toArray();
    for (const sprite of sprites) {
      const tile = await db.tiles.get(sprite.tileId);
      expect(tile?.spriteIds).toContain(sprite.id);
    }
    const groundSprite = sprites.find((s) => s.name === 'Ground frame');
    expect(groundSprite?.pixelData).toBe('data:image/png;base64,AAA');
    expect(groundSprite?.paletteIndices).toEqual([
      [0, 1],
      [1, 0],
    ]);
    const waterSprites = sprites
      .filter((s) => s.name.startsWith('Water'))
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(waterSprites.map((s) => s.name)).toEqual(['Water 1', 'Water 2']);

    const waterTile = tiles.find((t) => t.name === 'Water');
    const waterSpriteIds = waterTile!.spriteIds;
    expect(waterSprites.map((s) => s.id)).toEqual(waterSpriteIds);

    const scenes = await db.scenes.where('projectId').equals(result.projectId).toArray();
    expect(scenes).toHaveLength(1);
    const level = scenes[0];
    expect(level.name).toBe('Level 1');
    const groundNewId = tiles.find((t) => t.name === 'Ground')!.id;
    const waterNewId = waterTile!.id;
    expect(level.layers[0].tileData).toEqual([
      [groundNewId, -1],
      [-1, waterNewId],
    ]);

    const folders = await db.folders.where('projectId').equals(result.projectId).toArray();
    expect(folders.map((f: Folder) => f.path)).toEqual(['nature']);

    expect((await db.sessions.toArray()).length).toBe(0);
  });

  it('supports importing the same file twice as two distinct projects', async () => {
    const { projectId } = await seedProject();
    const json = await service.exportProject(projectId);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
    await db.folders.clear();

    const first = await service.importProject(json, { kind: 'new' });
    const second = await service.importProject(json, { kind: 'new' });
    expect(first.projectId).not.toBe(second.projectId);

    const [t1, t2] = await Promise.all([
      db.tiles.where('projectId').equals(first.projectId).count(),
      db.tiles.where('projectId').equals(second.projectId).count(),
    ]);
    expect(t1).toBe(2);
    expect(t2).toBe(2);
  });
});