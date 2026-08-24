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

  it('should show placeholder when no sprite selected', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Select a sprite to edit');
  });

  it('should list sprites after creating one', async () => {
    await createProjectWithPalette();
    const db = TestBed.inject(DatabaseService);
    await db.tiles.add({
      id: 1,
      projectId: 'test-proj',
      name: 'Base Tile',
      type: 'static',
      spriteIds: [],
      animationSpeed: 8,
      properties: { blocking: false, interactable: false },
    } as Tile);
    await setupWithProject();
    const service = TestBed.inject(SpriteService);
    await service.createSprite('test-proj', 'Test Sprite', 1);
    await fixture.componentInstance.loadSprites();
    await fixture.componentInstance.loadTiles();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Test Sprite');
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

  it('keeps the sprite list visible when a spriteId param is present', async () => {
    await createProjectWithPalette();
    const service = TestBed.inject(SpriteService);
    const sprite = await service.createSprite('test-proj', 'Deep Linked Sprite', 1);
    await setupWithProject();

    routeParams.next({ spriteId: String(sprite.id) });
    await flushRouteWork();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('rk-pixel-canvas')).toBeTruthy();
    expect(compiled.textContent).toContain('Sprites');
  });

  it('shows the selected sprite name above the canvas', async () => {
    await createProjectWithPalette();
    await setupWithProject();
    const service = TestBed.inject(SpriteService);
    const sprite = await service.createSprite('test-proj', 'frame 1', 1);
    await fixture.componentInstance.selectSprite(sprite.id);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('frame 1');
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

  it('groups sprites under their parent tile in tile-name order', () => {
    fixture = TestBed.createComponent(SpriteEditorComponent);
    const component = fixture.componentInstance;
    component.sprites.set([
      { id: 1, name: 'frame 2', tileId: 20 } as Sprite,
      { id: 2, name: 'frame 1', tileId: 20 } as Sprite,
      { id: 3, name: 'frame 1', tileId: 10 } as Sprite,
    ]);
    component.tiles.set([
      { id: 10, name: 'Beta' },
      { id: 20, name: 'Alpha' },
    ] as Tile[]);

    expect(component.spriteGroups().map((g) => g.tile.name)).toEqual(['Alpha', 'Beta']);
    expect(component.spriteGroups()[0].sprites.map((s) => s.name)).toEqual(['frame 1', 'frame 2']);
  });

  it('collapses and expands a tile group when its header is clicked', async () => {
    await createProjectWithPalette();
    const db = TestBed.inject(DatabaseService);
    await db.tiles.add({
      id: 1,
      projectId: 'test-proj',
      name: 'Base Tile',
      type: 'static',
      spriteIds: [],
      animationSpeed: 8,
      properties: { blocking: false, interactable: false },
    } as Tile);
    await setupWithProject();
    const service = TestBed.inject(SpriteService);
    await service.createSprite('test-proj', 'alpha frame', 1);
    await service.createSprite('test-proj', 'beta frame', 1);
    const component = fixture.componentInstance;
    await component.loadSprites();
    await component.loadTiles();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('alpha frame');

    const header = Array.from(compiled.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Base Tile'),
    ) as HTMLButtonElement;
    header.click();
    fixture.detectChanges();
    expect(component.isTileCollapsed(1)).toBe(true);
    expect(compiled.textContent).not.toContain('alpha frame');
    expect(compiled.textContent).not.toContain('beta frame');

    header.click();
    fixture.detectChanges();
    expect(component.isTileCollapsed(1)).toBe(false);
    expect(compiled.textContent).toContain('alpha frame');
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
      animationSpeed: 8,
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
});
