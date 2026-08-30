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
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { SpriteEditorComponent } from './sprite-editor.component';
import { DatabaseService } from '../../core/services/database.service';
import { SessionService } from '../../core/services/session.service';
import { NotificationService } from '../../core/services/notification.service';
import { StatusBarService } from '../../core/services/status-bar.service';
import { SpriteService } from './services/sprite.service';
import type { Sprite } from '../../shared/models/sprite.model';
import type { Tile } from '../../shared/models/tile.model';

describe('SpriteEditorComponent', () => {
  let fixture: ComponentFixture<SpriteEditorComponent>;
  const parentParams = new BehaviorSubject<{ id?: string }>({});
  const routeParams = new BehaviorSubject<{ spriteId?: string }>({});

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpriteEditorComponent],
      providers: [
        provideRouter([]),
        SpriteService,
        {
          provide: ActivatedRoute,
          useValue: {
            parent: { params: parentParams.asObservable() },
            params: routeParams.asObservable(),
            pathFromRoot: [] as unknown[],
            snapshot: {
              paramMap: {
                get: (key: string) =>
                  key === 'spriteId' ? (routeParams.value.spriteId ?? null) : null,
              },
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
    // do not replay a stale spriteId from a previous test.
    parentParams.next({});
    routeParams.next({});
  });

  async function setupWithProject() {
    parentParams.next({ id: 'test-proj' });
    fixture = TestBed.createComponent(SpriteEditorComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Flushes async route-subscription work (Dexie promises are not tracked by whenStable). */
  async function flushRouteWork() {
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
  }

  async function createProjectWithPalette() {
    const db = TestBed.inject(DatabaseService);
    await db.projects.add({
      id: 'test-proj',
      name: 'Test Project',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      palette: ['#ff0000', '#00ff00', '#0000ff'],
      tileSize: 16,
      mapWidth: 40,
      mapHeight: 30,
    });
  }

  it('should create', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show placeholder when no tile is selected', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No tile selected');
    expect(compiled.textContent).toContain('Select a tile from the list to start editing');
  });

  it('should list a tile with its new sprite after creating one', async () => {
    await createProjectWithPalette();
    const db = TestBed.inject(DatabaseService);
    await db.tiles.add({
      id: 1,
      projectId: 'test-proj',
      name: 'Base Tile',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
    } as Tile);
    await setupWithProject();
    const service = TestBed.inject(SpriteService);
    const sprite = await service.createSprite('test-proj', 'Test Sprite', 1);
    await db.tiles.update(1, { spriteIds: [sprite.id] });
    const component = fixture.componentInstance;
    await component.loadSprites();
    await component.loadTiles();
    await component.selectTile(1);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Base Tile');
    expect(component.currentFrames().map((f) => f.name)).toEqual(['Test Sprite']);
  });

  it('should select a sprite and show canvas', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    const service = TestBed.inject(SpriteService);
    const sprite = await service.createSprite('test-proj', 'Test Sprite', 1);
    await fixture.componentInstance.loadSprites();
    await fixture.componentInstance.selectSprite(sprite.id);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('rk-pixel-canvas')).toBeTruthy();
  });

  it('saves the sprite id to the session when a sprite is selected', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    const service = TestBed.inject(SpriteService);
    const sprite = await service.createSprite('test-proj', 'Nav Sprite', 1);
    const component = fixture.componentInstance;
    await component.loadSprites();
    const sessions = TestBed.inject(SessionService);
    const spy = vi.spyOn(sessions, 'updateSession').mockImplementation(() => Promise.resolve());

    await component.selectSprite(sprite.id);

    expect(spy).toHaveBeenCalledWith('test-proj', { lastSpriteId: sprite.id });
  });

  it('keeps the editor usable when a spriteId param is present', async () => {
    await createProjectWithPalette();
    const db = TestBed.inject(DatabaseService);
    await db.tiles.add({
      id: 1,
      projectId: 'test-proj',
      name: 'Base Tile',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
    } as Tile);
    const service = TestBed.inject(SpriteService);
    const sprite = await service.createSprite('test-proj', 'Deep Linked Sprite', 1);
    await db.tiles.update(1, { spriteIds: [sprite.id] });
    await setupWithProject();

    routeParams.next({ spriteId: String(sprite.id) });
    await flushRouteWork();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('rk-pixel-canvas')).toBeTruthy();
    expect(compiled.textContent).toContain('Base Tile');
    expect(compiled.textContent).toContain('Tiles');
  });

  it('swaps the empty state for the canvas when a sprite is selected', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    const service = fixture.debugElement.injector.get(SpriteService);
    const sprite = await service.createSprite('test-proj', 'frame 1', 1);
    await fixture.componentInstance.selectSprite(sprite.id);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('rk-pixel-canvas')).toBeTruthy();
    expect(compiled.textContent).not.toContain('No sprite selected');
  });

  it('sets the status bar context when a sprite is selected', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    fixture.detectChanges();
    await fixture.whenStable();

    const statusBar = TestBed.inject(StatusBarService);
    const spy = vi.spyOn(statusBar, 'setContext');
    const service = fixture.debugElement.injector.get(SpriteService);
    const sprite = await service.createSprite('test-proj', 'frame 1', 1);
    await fixture.componentInstance.loadSprites();
    await fixture.componentInstance.selectSprite(sprite.id);
    fixture.detectChanges();
    await fixture.whenStable();

    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lastCall?.[0]).toContain('frame 1');
    expect(lastCall?.[0]).toContain('px');
  });

  it('shows the selected frame index and count in the status bar', async () => {
    fixture = TestBed.createComponent(SpriteEditorComponent);
    fixture.componentInstance.sprites.set([
      { id: 1, name: 'frame A', tileId: 10, width: 16, height: 16, pixelData: 'A' } as Sprite,
      { id: 2, name: 'frame B', tileId: 10, width: 16, height: 16, pixelData: 'B' } as Sprite,
    ]);
    fixture.componentInstance.tiles.set([
      {
        id: 10,
        name: 'Test',
        type: 'animated',
        spriteIds: [1, 2],
        animationSpeed: 4,
        properties: { blocking: false, interactable: false },
      } as Tile,
    ]);
    fixture.componentInstance.selectedTileId.set(10);
    fixture.componentInstance.selectedSpriteId.set(2);
    fixture.componentInstance.selectedSprite.set(fixture.componentInstance.sprites()[1]);
    const statusBar = TestBed.inject(StatusBarService);
    const spy = vi.spyOn(statusBar, 'setContext');
    fixture.detectChanges();

    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lastCall?.[0]).toContain('Frame 2/2');
  });

  it('shows an error and does not navigate for an unknown spriteId param', async () => {
    await createProjectWithPalette();
    await setupWithProject();

    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const notification = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notification, 'error');

    routeParams.next({ spriteId: '9999' });
    await flushRouteWork();

    expect(errorSpy).toHaveBeenCalledWith('Sprite not found');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('shows an error notification when a deep-linked sprite fails to load', async () => {
    await createProjectWithPalette();
    await setupWithProject();

    // SpriteService is provided at the component level, so resolve it from
    // the component's injector to spy on the instance the component actually uses.
    const service = fixture.debugElement.injector.get(SpriteService);
    const notification = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notification, 'error');
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(service, 'getSprite').mockRejectedValue(new Error('db failure'));

    routeParams.next({ spriteId: '7' });
    await flushRouteWork();

    expect(errorSpy).toHaveBeenCalledWith('Failed to load sprite');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  /** Seeds two sprites and resolves the SpriteService instance the component uses. */
  async function seedTwoSprites() {
    await createProjectWithPalette();
    await setupWithProject();
    const spriteService = fixture.debugElement.injector.get(SpriteService);
    const existingSpriteId = (await spriteService.createSprite('test-proj', 'Existing Sprite', 1))
      .id;
    const otherSpriteId = (await spriteService.createSprite('test-proj', 'Other Sprite', 1)).id;
    return { spriteService, existingSpriteId, otherSpriteId };
  }

  it('debounces rapid strokes into one updateSprite call', async () => {
    const { spriteService, existingSpriteId } = await seedTwoSprites();
    const updateSpy = vi
      .spyOn(spriteService, 'updateSprite')
      .mockImplementation(() => Promise.resolve());

    vi.useFakeTimers();
    try {
      await fixture.componentInstance.selectSprite(existingSpriteId);
      updateSpy.mockClear();

      const stroke = fixture.componentInstance.paletteIndices()!.map((row) => [...row]);
      stroke[0][0] = 1;
      await fixture.componentInstance.onCanvasChange(stroke);
      stroke[0][0] = 2;
      await fixture.componentInstance.onCanvasChange(stroke);

      expect(updateSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(250);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy.mock.calls.at(-1)![0]).toBe(existingSpriteId);
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes the pending save when the component is destroyed', async () => {
    const { spriteService, existingSpriteId } = await seedTwoSprites();
    const updateSpy = vi
      .spyOn(spriteService, 'updateSprite')
      .mockImplementation(() => Promise.resolve());
    await fixture.componentInstance.selectSprite(existingSpriteId);
    updateSpy.mockClear();

    const stroke = fixture.componentInstance.paletteIndices()!.map((row) => [...row]);
    stroke[0][0] = 3;
    await fixture.componentInstance.onCanvasChange(stroke);

    fixture.destroy();
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('lists tiles with sprites in alphabetical order', () => {
    fixture = TestBed.createComponent(SpriteEditorComponent);
    const component = fixture.componentInstance;
    component.sprites.set([
      { id: 1, name: 'frame 2', tileId: 20 } as Sprite,
      { id: 2, name: 'frame 1', tileId: 20 } as Sprite,
      { id: 3, name: 'frame 1', tileId: 10 } as Sprite,
    ]);
    component.tiles.set([
      { id: 10, name: 'Beta', spriteIds: [3] },
      { id: 20, name: 'Alpha', spriteIds: [1, 2] },
    ] as Tile[]);

    expect(component.tilesWithSprites().map((t) => t.name)).toEqual(['Alpha', 'Beta']);
  });

  it('selects a tile and loads its first frame', async () => {
    await createProjectWithPalette();
    const db = TestBed.inject(DatabaseService);
    await db.tiles.add({
      id: 1,
      projectId: 'test-proj',
      name: 'Base Tile',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
    } as Tile);
    await setupWithProject();
    const service = TestBed.inject(SpriteService);
    const frame1 = await service.createSprite('test-proj', 'alpha frame', 1);
    const frame2 = await service.createSprite('test-proj', 'beta frame', 1);
    await db.tiles.update(1, { spriteIds: [frame1.id, frame2.id], type: 'animated' });
    const component = fixture.componentInstance;
    await component.loadSprites();
    await component.loadTiles();
    fixture.detectChanges();

    await component.selectTile(1);
    fixture.detectChanges();

    expect(component.selectedTileId()).toBe(1);
    expect(component.selectedSpriteId()).toBe(frame1.id);
  });

  it('flushes the pending save before switching sprites', async () => {
    const { spriteService, existingSpriteId, otherSpriteId } = await seedTwoSprites();
    const updateSpy = vi
      .spyOn(spriteService, 'updateSprite')
      .mockImplementation(() => Promise.resolve());
    await fixture.componentInstance.selectSprite(existingSpriteId);
    updateSpy.mockClear();

    const stroke = fixture.componentInstance.paletteIndices()!.map((row) => [...row]);
    stroke[0][0] = 4;
    await fixture.componentInstance.onCanvasChange(stroke);
    await fixture.componentInstance.selectSprite(otherSpriteId);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls.at(-1)![0]).toBe(existingSpriteId);
  });

  it('persists the selected sprite into the session', async () => {
    await createProjectWithPalette();
    const db = TestBed.inject(DatabaseService);
    await db.tiles.add({
      id: 1,
      projectId: 'test-proj',
      name: 'Base Tile',
      type: 'static',
      spriteIds: [],
      animationSpeed: 4,
      properties: { blocking: false, interactable: false },
    } as Tile);
    await setupWithProject();
    const service = TestBed.inject(SpriteService);
    const spriteId = (await service.createSprite('test-proj', 'frame', 1)).id;
    const component = fixture.componentInstance;
    await component.loadSprites();
    await component.loadTiles();
    const sessions = TestBed.inject(SessionService);
    const spy = vi.spyOn(sessions, 'updateSession').mockImplementation(() => Promise.resolve());

    await component.selectSprite(spriteId);

    expect(spy).toHaveBeenCalledWith('test-proj', { lastSpriteId: spriteId });
  });

  it('should compute previous onion skin data as the frame before current', async () => {
    fixture = TestBed.createComponent(SpriteEditorComponent);
    fixture.componentInstance.sprites.set([
      { id: 1, pixelData: 'A', tileId: 10 } as Sprite,
      { id: 2, pixelData: 'B', tileId: 10 } as Sprite,
    ]);
    fixture.componentInstance.tiles.set([
      { id: 10, name: 'Test', spriteIds: [1, 2], type: 'animated' } as Tile,
    ]);
    fixture.componentInstance.selectedTileId.set(10);
    fixture.componentInstance.selectedSpriteId.set(2);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.onionSkinPrevData()).toBe('A');
  });

  it('switches the drawing tool on digit key shortcuts', async () => {
    fixture = TestBed.createComponent(SpriteEditorComponent);
    const component = fixture.componentInstance;
    const event = new KeyboardEvent('keydown', { key: '2', cancelable: true });
    document.dispatchEvent(event);
    expect(component.selectedTool()).toBe('eraser');
  });

  it('deletes the selected frame on Delete', async () => {
    fixture = TestBed.createComponent(SpriteEditorComponent);
    const component = fixture.componentInstance;
    component.selectedSpriteId.set(42);
    const deleteSpy = vi.spyOn(component, 'onDeleteFrame').mockResolvedValue();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', cancelable: true }));
    expect(deleteSpy).toHaveBeenCalledWith(42);
  });

  it('flushes and confirms the sprite save on Ctrl+S', async () => {
    fixture = TestBed.createComponent(SpriteEditorComponent);
    const notification = TestBed.inject(NotificationService);
    const successSpy = vi.spyOn(notification, 'success');
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(successSpy).toHaveBeenCalledWith('Sprite saved');
  });
});
