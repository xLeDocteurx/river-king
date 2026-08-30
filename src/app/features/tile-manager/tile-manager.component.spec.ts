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
import type { Tile } from '../../shared/models/tile.model';

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
});
