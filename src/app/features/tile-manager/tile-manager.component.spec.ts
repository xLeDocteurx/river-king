import 'fake-indexeddb/auto';
import { vi } from 'vitest';

if (!('showModal' in HTMLDialogElement.prototype)) {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    value: vi.fn(),
    writable: true,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value: vi.fn(),
    writable: true,
  });
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { TileManagerComponent } from './tile-manager.component';
import { AppDummyComponent } from '../../app-dummy.component';
import { DatabaseService } from '../../core/services/database.service';
import { SessionService } from '../../core/services/session.service';
import { StatusBarService } from '../../core/services/status-bar.service';
import { TileService } from './services/tile.service';
import { TileSpritesService } from './services/tile-sprites.service';
import { ProjectService } from '../../features/dashboard/services/project.service';
import { UndoService } from '../../core/services/undo.service';
import type { Tile } from '../../shared/models/tile.model';
import { NotificationService } from '../../core/services/notification.service';

describe('TileManagerComponent', () => {
  let fixture: ComponentFixture<TileManagerComponent>;
  const parentParams = new BehaviorSubject<{ id?: string }>({});
  const routeParams = new BehaviorSubject<{ tileId?: string }>({});

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TileManagerComponent],
      providers: [
        TileService,
        TileSpritesService,
        ProjectService,
        provideRouter([{ path: '**', component: AppDummyComponent }]),
        {
          provide: ActivatedRoute,
          useValue: {
            parent: { params: parentParams.asObservable() },
            params: routeParams.asObservable(),
            get snapshot() {
              return {
                paramMap: {
                  get: (key: string) =>
                    key === 'tileId' ? (routeParams.value.tileId ?? null) : null,
                },
              };
            },
          },
        },
      ],
    }).compileComponents();

    const db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
    await db.folders.clear();

    // Reset route param streams so subscriptions created in the next test
    // do not replay a stale tileId from a previous test.
    parentParams.next({});
    routeParams.next({});
  });

  async function setupWithProject() {
    parentParams.next({ id: 'test-proj' });
    fixture = TestBed.createComponent(TileManagerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Adds one minimal tile to the test project and returns its generated id. */
  async function addSeedTile(): Promise<number> {
    const db = TestBed.inject(DatabaseService);
    return db.tiles.add({
      projectId: 'test-proj',
      name: 'T',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
    } as unknown as import('../../shared/models/tile.model').Tile);
  }

  /** Flushes the fire-and-forget async undo/redo closures (Dexie + reload chain). */
  async function flushUndo() {
    await new Promise((r) => setTimeout(r, 250));
  }

  it('should create', async () => {
    await setupWithProject();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show placeholder when no tile selected', async () => {
    await setupWithProject();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Select a tile from the list to edit its properties');
  });

  it('loads project palette and tileSize on init', async () => {
    const db = TestBed.inject(DatabaseService);
    await db.projects.add({
      id: 'test-proj',
      name: 'Test Project',
      createdAt: 0,
      updatedAt: 0,
      palette: ['#ff0000', '#00ff00'],
      tileSize: 32,
      mapWidth: 40,
      mapHeight: 30,
    });
    await setupWithProject();
    await new Promise((r) => setTimeout(r, 100));
    const comp = fixture.componentInstance;
    expect(comp.tileSize()).toBe(32);
    expect(comp.palette()).toEqual(['#ff0000', '#00ff00']);
  });

  it('deletes an empty folder from the folder list after confirmation', async () => {
    await setupWithProject();
    const comp = fixture.componentInstance;
    const db = TestBed.inject(DatabaseService);
    await comp.onCreateFolder('mountain');
    await new Promise((r) => setTimeout(r, 50));
    expect(comp.folders()).toContain('mountain');

    comp.onFolderDeleteRequest('mountain');
    expect(comp.pendingDeleteFolderPath()).toBe('mountain');

    await comp.onConfirmFolderDelete();
    expect(comp.folders()).not.toContain('mountain');
    expect((await db.folders.toArray()).filter((f) => f.path === 'mountain')).toEqual([]);
  });

  it('removes empty descendant folders together with the deleted folder', async () => {
    await setupWithProject();
    const comp = fixture.componentInstance;
    const db = TestBed.inject(DatabaseService);
    await comp.onCreateFolder('forest');
    await comp.onCreateFolder('forest/caves');
    await new Promise((r) => setTimeout(r, 50));

    comp.onFolderDeleteRequest('forest');
    await comp.onConfirmFolderDelete();

    expect(comp.folders()).not.toContain('forest');
    expect(comp.folders()).not.toContain('forest/caves');
    expect(await db.folders.toArray()).toEqual([]);
  });

  it('blocks deletion of a folder that still contains tiles', async () => {
    await setupWithProject();
    const comp = fixture.componentInstance;
    const db = TestBed.inject(DatabaseService);
    const tileId = await addSeedTile();
    await db.tiles.update(tileId, { folderPath: 'mountain' });
    comp.folders.update((list) => [...list, 'mountain']);
    await comp.loadTiles();

    const notification = TestBed.inject(NotificationService);
    const warnSpy = vi.spyOn(notification, 'warning');

    comp.onFolderDeleteRequest('mountain');

    expect(comp.pendingDeleteFolderPath()).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('creates a first frame and selects the new tile', async () => {
    await setupWithProject();
    await new Promise((r) => setTimeout(r, 50));
    const comp = fixture.componentInstance;
    const tileSpritesService = fixture.debugElement.injector.get(TileSpritesService);
    const tileService = fixture.debugElement.injector.get(TileService);
    const frameSpy = vi
      .spyOn(tileSpritesService, 'createBlankFrame')
      .mockResolvedValue({ id: 99 } as never);
    const updateSpy = vi
      .spyOn(tileService, 'updateTile')
      .mockImplementation(() => Promise.resolve());
    vi.spyOn(comp['router'], 'navigate').mockResolvedValue(true);

    await comp.createTile();

    expect(frameSpy).toHaveBeenCalledWith(
      comp.projectId(),
      expect.any(Number),
      'frame 1',
      comp.tileSize(),
      comp.tileSize(),
    );
    expect(updateSpy).toHaveBeenCalledWith(expect.any(Number), { spriteIds: [99] });
    expect(comp.selectedTileId()).not.toBeNull();
  });

  it('loads tile sprites when a tile is selected', async () => {
    const db = TestBed.inject(DatabaseService);
    await db.projects.add({
      id: 'test-proj',
      name: 'Test Project',
      createdAt: 0,
      updatedAt: 0,
      palette: [],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
    const tileId = await db.tiles.add({
      projectId: 'test-proj',
      name: 'T',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
    } as unknown as import('../../shared/models/tile.model').Tile);
    await db.sprites.add({
      projectId: 'test-proj',
      tileId,
      name: 'frame',
      width: 16,
      height: 16,
      pixelData: 'data:image/png;base64,SPR',
      paletteIndices: Array.from({ length: 16 }, () => Array<number>(16).fill(0)),
    } as unknown as import('../../shared/models/sprite.model').Sprite);
    await setupWithProject();
    const comp = fixture.componentInstance;
    const spriteService = fixture.debugElement.injector.get(TileSpritesService);
    vi.spyOn(comp['router'], 'navigate').mockResolvedValue(true);
    await comp.selectTile(tileId);
    expect(spriteService.sprites().length).toBe(1);
    expect(spriteService.sprites()[0].pixelData).toContain('SPR');
  });

  it('navigates to the tile route when a tile is selected', async () => {
    await setupWithProject();
    const comp = fixture.componentInstance;
    const navigateSpy = vi.spyOn(comp['router'], 'navigate').mockResolvedValue(true);
    await comp.selectTile(7);
    expect(navigateSpy).toHaveBeenCalledWith(['/project', comp.projectId(), 'tiles', 7]);
  });

  it('restores the selection from the :tileId route param', async () => {
    const seedTileId = await addSeedTile();
    await setupWithProject();
    await new Promise((r) => setTimeout(r, 50));
    const comp = fixture.componentInstance;
    vi.spyOn(comp['router'], 'navigate').mockResolvedValue(true);
    // emit params the way the spec's ActivatedRoute stub does for other params
    routeParams.next({ tileId: String(seedTileId) });
    await new Promise((r) => setTimeout(r, 50));
    expect(comp.selectedTileId()).toBe(seedTileId);
  });

  it('clears the tile param when the selected tile is deleted', async () => {
    const seedTileId = await addSeedTile();
    await setupWithProject();
    await new Promise((r) => setTimeout(r, 50));
    const comp = fixture.componentInstance;
    const navigateSpy = vi.spyOn(comp['router'], 'navigate').mockResolvedValue(true);
    await comp.selectTile(seedTileId);
    // Simulate the router having applied the navigation to /tiles/:tileId.
    routeParams.next({ tileId: String(seedTileId) });
    await new Promise((r) => setTimeout(r, 50));
    navigateSpy.mockClear();
    await comp.deleteTile(seedTileId);
    expect(navigateSpy).toHaveBeenCalledWith(['/project', comp.projectId(), 'tiles']);
  });

  it('persists the selected tile into the session', async () => {
    await setupWithProject();
    const tileId = await addSeedTile();
    const sessions = TestBed.inject(SessionService);
    const spy = vi.spyOn(sessions, 'updateSession').mockImplementation(() => Promise.resolve());

    await fixture.componentInstance.selectTile(tileId);

    expect(spy).toHaveBeenCalledWith('test-proj', { lastTileId: tileId });
  });

  it('sets the status bar context when a tile is selected', async () => {
    await setupWithProject();
    await new Promise((r) => setTimeout(r, 50));
    const comp = fixture.componentInstance;
    const statusBar = TestBed.inject(StatusBarService);
    const spy = vi.spyOn(statusBar, 'setContext');

    const tileId = await addSeedTile();
    vi.spyOn(comp['router'], 'navigate').mockResolvedValue(true);

    await comp.selectTile(tileId);
    fixture.detectChanges();
    await fixture.whenStable();

    const lastCall = spy.mock.calls[spy.mock.calls.length - 1][0] as string;
    expect(lastCall).toContain('T');
    expect(lastCall).toContain('frames');
  });

  it('undo removes a created tile and redo recreates it with its frame', async () => {
    const db = TestBed.inject(DatabaseService);
    await db.projects.add({
      id: 'test-proj',
      name: 'Test Project',
      createdAt: 0,
      updatedAt: 0,
      palette: ['#ff0000'],
      tileSize: 32,
      mapWidth: 40,
      mapHeight: 30,
    });
    await setupWithProject();
    await new Promise((r) => setTimeout(r, 100));
    const comp = fixture.componentInstance;

    expect(await db.tiles.count()).toBe(0);
    await comp.createTile();
    await new Promise((r) => setTimeout(r, 50));
    const tile = await db.tiles.where('projectId').equals('test-proj').first();
    expect(tile?.name).toBe('Tile 1');
    expect(tile?.spriteIds).toHaveLength(1);

    const undo = TestBed.inject(UndoService);
    undo.undo();
    await flushUndo();
    expect(await db.tiles.count()).toBe(0);
    expect(await db.sprites.count()).toBe(0);

    undo.redo();
    await flushUndo();
    expect(await db.tiles.count()).toBe(1);
    expect(await db.sprites.count()).toBe(1);
  });

  it('undo restores a deleted tile with its sprites and redo deletes again', async () => {
    const db = TestBed.inject(DatabaseService);
    await db.projects.add({
      id: 'test-proj',
      name: 'Test Project',
      createdAt: 0,
      updatedAt: 0,
      palette: ['#ff0000'],
      tileSize: 32,
      mapWidth: 40,
      mapHeight: 30,
    });
    const tileId = await db.tiles.add({
      projectId: 'test-proj',
      name: 'T',
      type: 'static',
      spriteIds: [41],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
    } as unknown as import('../../shared/models/tile.model').Tile);
    await db.sprites.add({
      id: 41,
      projectId: 'test-proj',
      tileId,
      name: 'T frame',
      width: 32,
      height: 32,
      pixelData: '',
      paletteIndices: [],
    } as import('../../shared/models/sprite.model').Sprite);
    await setupWithProject();
    await new Promise((r) => setTimeout(r, 100));
    const comp = fixture.componentInstance;

    await comp.deleteTile(tileId);
    expect(await db.tiles.count()).toBe(0);
    expect(await db.sprites.count()).toBe(0);

    const undo = TestBed.inject(UndoService);
    undo.undo();
    await flushUndo();
    expect(await db.tiles.count()).toBe(1);
    expect(await db.sprites.count()).toBe(1);

    undo.redo();
    await flushUndo();
    expect(await db.tiles.count()).toBe(0);
    expect(await db.sprites.count()).toBe(0);
  });

  it('undo moves a folder back and redo moves it again', async () => {
    const db = TestBed.inject(DatabaseService);
    await db.projects.add({
      id: 'test-proj',
      name: 'Test Project',
      createdAt: 0,
      updatedAt: 0,
      palette: ['#ff0000'],
      tileSize: 32,
      mapWidth: 40,
      mapHeight: 30,
    });
    await db.tiles.add({
      projectId: 'test-proj',
      name: 'T1',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      folderPath: 'A',
      properties: { blocking: false, interactable: false },
    } as unknown as import('../../shared/models/tile.model').Tile);
    await db.tiles.add({
      projectId: 'test-proj',
      name: 'T2',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      folderPath: 'A',
      properties: { blocking: false, interactable: false },
    } as unknown as import('../../shared/models/tile.model').Tile);
    await setupWithProject();
    await new Promise((r) => setTimeout(r, 100));
    const comp = fixture.componentInstance;

    await comp.onFolderMove({ fromKey: 'A', toKey: 'B' });
    const moved = await db.tiles.where('projectId').equals('test-proj').toArray();
    expect(moved.every((t) => t.folderPath === 'B/A')).toBe(true);

    const undo = TestBed.inject(UndoService);
    undo.undo();
    await flushUndo();
    const restored = await db.tiles.where('projectId').equals('test-proj').toArray();
    expect(restored.every((t) => t.folderPath === 'A')).toBe(true);

    undo.redo();
    await flushUndo();
    const remade = await db.tiles.where('projectId').equals('test-proj').toArray();
    expect(remade.every((t) => t.folderPath === 'B/A')).toBe(true);
  });

  it('renames a folder and relocates its tiles', async () => {
    await setupWithProject();
    await new Promise((r) => setTimeout(r, 50));
    const comp = fixture.componentInstance;
    const db = TestBed.inject(DatabaseService);
    const directId = await db.tiles.add({
      projectId: 'test-proj',
      name: 'Direct',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
      folderPath: 'forest',
    } as unknown as import('../../shared/models/tile.model').Tile);
    const nestedId = await db.tiles.add({
      projectId: 'test-proj',
      name: 'Nested',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
      folderPath: 'forest/caves',
    } as unknown as import('../../shared/models/tile.model').Tile);

    const successSpy = vi.spyOn(TestBed.inject(NotificationService), 'success');
    await comp.onFolderRename({ fromKey: 'forest', toKey: 'woods' });

    expect((await db.tiles.get(directId))?.folderPath).toBe('woods');
    expect((await db.tiles.get(nestedId))?.folderPath).toBe('woods/caves');
    expect(comp.folders()).toContain('woods');
    expect(comp.folders()).not.toContain('forest');
    expect(successSpy).toHaveBeenCalledWith('Folder renamed');
  });

  it('warns instead of renaming when the target folder already exists', async () => {
    await setupWithProject();
    await new Promise((r) => setTimeout(r, 50));
    const comp = fixture.componentInstance;
    const db = TestBed.inject(DatabaseService);
    const directId = await db.tiles.add({
      projectId: 'test-proj',
      name: 'Direct',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
      folderPath: 'forest',
    } as unknown as import('../../shared/models/tile.model').Tile);
    await db.tiles.add({
      projectId: 'test-proj',
      name: 'Town',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
      folderPath: 'town',
    } as unknown as import('../../shared/models/tile.model').Tile);

    const warningSpy = vi.spyOn(TestBed.inject(NotificationService), 'warning');
    await comp.loadTiles();
    await comp.loadFolders();
    await comp.onFolderRename({ fromKey: 'forest', toKey: 'town' });

    expect(warningSpy).toHaveBeenCalledWith('A folder with that name already exists.');
    expect((await db.tiles.get(directId))?.folderPath).toBe('forest');
  });

  it('requests deletion of the selected tile on Delete', async () => {
    fixture = TestBed.createComponent(TileManagerComponent);
    const comp = fixture.componentInstance;
    comp.selectedTileId.set(7);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', cancelable: true }));
    fixture.detectChanges();
    expect(comp.tileToDelete()).toBe(7);
  });

  it('saves the selected tile on Ctrl+S', async () => {
    await setupWithProject();
    const comp = fixture.componentInstance;
    const tile = {
      id: 3,
      projectId: 'test-proj',
      name: 'Ground',
      type: 'static' as const,
      spriteIds: [],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
      folderPath: '',
    } as Tile;
    comp.selectedTile.set(tile);
    const saveSpy = vi.spyOn(comp, 'saveTile').mockResolvedValue();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true }),
    );
    expect(saveSpy).toHaveBeenCalledWith(tile);
  });

  it('toggleFolder persists folded state and materializes a tile folder row', async () => {
    await setupWithProject();
    const comp = fixture.componentInstance;
    const db = TestBed.inject(DatabaseService);

    await comp.toggleFolder('mountain');

    const rows = await db.getFoldersByKind('test-proj', 'tile');
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe('mountain');
    expect(rows[0].collapsed).toBe(true);
    expect(comp.collapsedFolders()).toContain('mountain');
  });

  it('selecting a tile touches its folder row', async () => {
    await setupWithProject();
    const comp = fixture.componentInstance;
    const db = TestBed.inject(DatabaseService);
    const tileId = await addSeedTile();
    await db.tiles.update(tileId, { folderPath: 'mountain' });
    await comp.loadTiles();

    await comp.selectTile(tileId);

    const rows = await db.getFoldersByKind('test-proj', 'tile');
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe('mountain');
    expect(rows[0].lastOpenedAt).toBeGreaterThan(0);
  });
});
