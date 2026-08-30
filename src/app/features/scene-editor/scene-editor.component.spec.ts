import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SceneEditorComponent } from './scene-editor.component';
import { AppDummyComponent } from '../../app-dummy.component';
import { SceneService } from './services/scene.service';
import { GRID_VISIBLE_STORAGE_KEY } from './map-canvas.component';
import { DatabaseService } from '../../core/services/database.service';
import { NotificationService } from '../../core/services/notification.service';
import { SessionService } from '../../core/services/session.service';
import { StatusBarService } from '../../core/services/status-bar.service';
import { UndoService } from '../../core/services/undo.service';
import { createEmptySession } from '../../shared/models/session.model';
import type { Scene } from '../../shared/models/scene.model';

// jsdom does not implement HTMLDialogElement methods
const dialogProto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
if (typeof dialogProto['showModal'] !== 'function') {
  dialogProto['showModal'] = function () {
    // no-op
  };
}
if (typeof dialogProto['close'] !== 'function') {
  dialogProto['close'] = function (returnValue?: string) {
    (this as unknown as HTMLDialogElement).returnValue = returnValue ?? '';
    (this as unknown as HTMLDialogElement).dispatchEvent(new Event('close'));
  };
}

// jsdom does not implement ResizeObserver (used by MapCanvasComponent)
class ResizeObserverStub {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = ResizeObserverStub;
}

describe('SceneEditorComponent', () => {
  let fixture: ComponentFixture<SceneEditorComponent>;
  let component: SceneEditorComponent;
  let sceneService: SceneService;
  let db: DatabaseService;
  /** Mutable stand-in for the :sceneId route parameter. */
  let paramSceneId: string | null = null;

  beforeEach(async () => {
    paramSceneId = null;
    await TestBed.configureTestingModule({
      imports: [SceneEditorComponent],
      providers: [
        provideRouter([{ path: '**', component: AppDummyComponent }]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => (key === 'sceneId' ? paramSceneId : null) },
            },
            parent: { params: of({ id: 'p1' }) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SceneEditorComponent);
    component = fixture.componentInstance;
    // SceneService is provided at the component level, so resolve it from the component's injector.
    sceneService = fixture.debugElement.injector.get(SceneService);
    db = TestBed.inject(DatabaseService);
    await db.projects.clear();
    await db.scenes.clear();
    await db.tiles.clear();
    await db.sprites.clear();
    await db.sessions.clear();
    if ('folders' in db) {
      await db.folders.clear();
    }
  });

  it('should create', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('toggles the grid via the toolbar button and persists it for the session', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const byTitle = (title: string) =>
      fixture.nativeElement.querySelector(`button[title="${title}"]`) as HTMLButtonElement | null;
    const gridButton = byTitle('Hide grid');
    expect(gridButton).toBeTruthy();

    gridButton!.click();
    fixture.detectChanges();
    expect(byTitle('Show grid')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(GRID_VISIBLE_STORAGE_KEY)).toBe('0');

    byTitle('Show grid')!.click();
    fixture.detectChanges();
    expect(byTitle('Hide grid')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(GRID_VISIBLE_STORAGE_KEY)).toBe('1');
  });

  it('should persist a newly created folder and expose it to the scene list', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.onCreateFolder('forest');

    const stored = await db.folders.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0].path).toBe('forest');
    expect(component.folders()).toContain('forest');
  });

  it('should not persist a duplicate folder path', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.onCreateFolder('forest');
    await component.onCreateFolder('forest');

    expect(await db.folders.toArray()).toHaveLength(1);
  });

  it('renames a folder and relocates every scene inside it', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.onCreateFolder('forest');
    const scene = await sceneService.createScene('p1', 'Forest Scene', 10, 10);
    await sceneService.updateSceneFolder(scene.id, 'forest');
    await component.loadScenes();

    const successSpy = vi.spyOn(TestBed.inject(NotificationService), 'success');
    await component.onFolderRename({ fromKey: 'forest', toKey: 'woods' });

    expect((await db.folders.toArray()).map((f) => f.path)).toEqual(['woods']);
    expect((await db.scenes.get(scene.id))?.folderPath).toBe('woods');
    expect(component.folders()).toEqual(['woods']);
    expect(component.scenes()[0].folderPath).toBe('woods');
    expect(successSpy).toHaveBeenCalledWith('Folder renamed');
  });

  it('renames nested descendants along with the folder', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.onCreateFolder('forest/caves');
    const scene = await sceneService.createScene('p1', 'Deep Scene', 10, 10);
    await sceneService.updateSceneFolder(scene.id, 'forest/caves');
    await component.loadScenes();

    await component.onFolderRename({ fromKey: 'forest', toKey: 'woods' });

    expect((await db.folders.toArray()).map((f) => f.path)).toEqual(['woods/caves']);
    expect((await db.scenes.get(scene.id))?.folderPath).toBe('woods/caves');
  });

  it('warns instead of renaming when the target folder already exists', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.onCreateFolder('forest');
    await component.onCreateFolder('town');
    const scene = await sceneService.createScene('p1', 'S', 10, 10);
    await sceneService.updateSceneFolder(scene.id, 'forest');
    await component.loadScenes();

    const warningSpy = vi.spyOn(TestBed.inject(NotificationService), 'warning');
    await component.onFolderRename({ fromKey: 'forest', toKey: 'town' });

    expect(warningSpy).toHaveBeenCalledWith('A folder with that name already exists.');
    expect((await db.scenes.get(scene.id))?.folderPath).toBe('forest');
  });

  it('should delete a scene after confirmation and clear its selection', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const scene = await sceneService.createScene('p1', 'Doomed', 10, 10);
    await component.loadScenes();
    await component.selectScene(scene.id);

    component.onDeleteSceneRequest(scene.id);
    expect(component.pendingDeleteSceneId()).toBe(scene.id);

    await component.onConfirmDelete();

    expect(await db.scenes.get(scene.id)).toBeUndefined();
    expect(component.scenes().some((s) => s.id === scene.id)).toBe(false);
    expect(component.selectedSceneId()).toBeNull();
    expect(component.selectedScene()).toBeNull();
  });

  it('should keep the selection when deleting a non-selected scene', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const kept = await sceneService.createScene('p1', 'Kept', 10, 10);
    const doomed = await sceneService.createScene('p1', 'Doomed', 10, 10);
    await component.loadScenes();
    await component.selectScene(kept.id);

    component.onDeleteSceneRequest(doomed.id);
    await component.onConfirmDelete();

    expect(component.selectedSceneId()).toBe(kept.id);
  });

  it('shows an error notification when loading the selected scene fails', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const notification = TestBed.inject(NotificationService);
    const errorSpy = vi.spyOn(notification, 'error');
    vi.spyOn(sceneService, 'getScene').mockRejectedValue(new Error('db failure'));

    await expect(component.selectScene('broken-id')).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('updates the URL when a scene is selected', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const scene = await sceneService.createScene('p1', 'Routed', 10, 10);
    await component.loadScenes();
    const navSpy = vi
      .spyOn(component['router'], 'navigate')
      .mockImplementation(() => Promise.resolve(true));

    await component.selectScene(scene.id);

    expect(navSpy).toHaveBeenCalledWith(['/project', 'p1', 'scenes', scene.id]);
  });

  it('prefers the scene from the URL over the stored session when restoring', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const fromUrl = await sceneService.createScene('p1', 'FromUrl', 10, 10);
    const fromSession = await sceneService.createScene('p1', 'FromSession', 10, 10);
    await component.loadScenes();
    await TestBed.inject(SessionService).updateSession('p1', {
      lastScreen: 'scenes',
      lastSceneId: fromSession.id,
    });
    paramSceneId = fromUrl.id;

    await component.restoreLastScene();

    expect(component.selectedSceneId()).toBe(fromUrl.id);
  });

  it('replaces overlapped anchors when placing a multi-cell tile', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const scene = await sceneService.createScene('p1', 'Footprint', 4, 4);
    await component.loadScenes();
    await component.selectScene(scene.id);
    component.tileFootprints.set({ 1: { w: 2, h: 2 } });

    await component.onTilePlaced({ x: 2, y: 1, tileId: 9 });
    await component.onTilePlaced({ x: 1, y: 1, tileId: 1 });

    const expected = [
      [-1, -1, -1, -1],
      [-1, 1, -1, -1],
      [-1, -1, -1, -1],
      [-1, -1, -1, -1],
    ];
    expect(component.selectedScene()?.layers[0].tileData).toEqual(expected);
    const stored = await db.scenes.get(scene.id);
    expect(stored?.layers[0].tileData).toEqual(expected);
  });

  it('grows the scene to the right when placing at the far edge', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const scene = await sceneService.createScene('p1', 'Grow', 4, 4);
    await component.loadScenes();
    await component.selectScene(scene.id);

    await component.onTilePlaced({ x: 4, y: 0, tileId: 9 });

    const updated = component.selectedScene();
    expect(updated?.width).toBe(5);
    expect(updated?.height).toBe(4);
    expect(updated?.layers[0].tileData).toHaveLength(4);
    expect(updated?.layers[0].tileData[0]).toHaveLength(5);
    expect(updated?.layers[0].tileData[0][4]).toBe(9);
    const stored = await db.scenes.get(scene.id);
    expect(stored?.width).toBe(5);
    expect(stored?.layers[0].tileData[0][4]).toBe(9);
  });

  it('grows the scene to the left and shifts existing content', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const scene = await sceneService.createScene('p1', 'Grow', 4, 4);
    await component.loadScenes();
    await component.selectScene(scene.id);
    component.tileFootprints.set({ 9: { w: 1, h: 1 } });

    await component.onTilePlaced({ x: 0, y: 0, tileId: 2 });
    await component.onTilePlaced({ x: -1, y: 0, tileId: 9 });

    const updated = component.selectedScene();
    expect(updated?.width).toBe(5);
    expect(updated?.layers[0].tileData[0][0]).toBe(9);
    expect(updated?.layers[0].tileData[0][1]).toBe(2);
  });

  it('does not place when the placement is beyond the grow guard', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const notification = TestBed.inject(NotificationService);
    const warningSpy = vi.spyOn(notification, 'warning');
    const scene = await sceneService.createScene('p1', 'Grow', 4, 4);
    await component.loadScenes();
    await component.selectScene(scene.id);

    await component.onTilePlaced({ x: 20, y: 0, tileId: 9 });

    expect(warningSpy).toHaveBeenCalledTimes(1);
    expect(component.selectedScene()?.width).toBe(4);
    expect(component.selectedScene()?.layers[0].tileData[0]).toHaveLength(4);
  });

  it('grows every layer together', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const scene = await sceneService.createScene('p1', 'Grow', 4, 4);
    await component.loadScenes();
    await component.selectScene(scene.id);
    await component.onAddLayer('Layer 2');

    await component.onTilePlaced({ x: 4, y: 0, tileId: 9 });

    const updated = component.selectedScene();
    expect(updated?.width).toBe(5);
    for (const layer of updated?.layers ?? []) {
      expect(layer.tileData).toHaveLength(4);
      expect(layer.tileData[0]).toHaveLength(5);
    }
  });

  it('shifts the camera when the scene grows to the left', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const scene = await sceneService.createScene('p1', 'Grow', 4, 4);
    await component.loadScenes();
    await component.selectScene(scene.id);
    fixture.detectChanges();
    const beforeX = component.mapCanvasRef()?.cameraX() ?? 0;

    await component.onTilePlaced({ x: -1, y: 0, tileId: 9 });

    const afterX = component.mapCanvasRef()?.cameraX() ?? 0;
    const cell = component.projectTileSize();
    expect(afterX).toBeCloseTo(beforeX + cell, 5);
  });

  it('undo restores width, height and layers after an out-of-bounds placement', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const scene = await sceneService.createScene('p1', 'Grow', 4, 4);
    await component.loadScenes();
    await component.selectScene(scene.id);

    await component.onTilePlaced({ x: 4, y: 0, tileId: 9 });
    expect(component.selectedScene()?.width).toBe(5);

    const undo = TestBed.inject(UndoService);
    undo.undo();
    await new Promise((r) => setTimeout(r, 50));

    expect(component.selectedScene()?.width).toBe(4);
    expect(component.selectedScene()?.height).toBe(4);
    expect(component.selectedScene()?.layers[0].tileData[0]).toHaveLength(4);
    const stored = await db.scenes.get(scene.id);
    expect(stored?.width).toBe(4);
    expect(stored?.layers[0].tileData[0]).toHaveLength(4);
  });

  it('persists the selected scene into the session', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const sessions = TestBed.inject(SessionService);
    const spy = vi.spyOn(sessions, 'updateSession').mockImplementation(() => Promise.resolve());
    const scene = await sceneService.createScene('p1', 'S1', 8, 8);
    await component.loadScenes();
    await component.selectScene(scene.id);

    expect(spy).toHaveBeenCalledWith('p1', { lastScreen: 'scenes', lastSceneId: scene.id });
  });

  it('restores the stored scene without camera state', async () => {
    const storedScene = {
      id: 'scene-rest',
      projectId: 'p1',
      name: 'Resumed',
      folderPath: '',
      width: 8,
      height: 8,
      layers: [],
    } as Scene;
    const svc = fixture.debugElement.injector.get(SceneService);
    vi.spyOn(svc, 'getScenes').mockResolvedValue([storedScene]);
    vi.spyOn(svc, 'getScene').mockResolvedValue(storedScene);
    const sessions = TestBed.inject(SessionService);
    vi.spyOn(sessions, 'getSession').mockResolvedValue({
      ...createEmptySession('p1'),
      lastSceneId: 'scene-rest',
    });
    await component.loadScenes();
    await component.restoreLastScene();

    expect(component.selectedSceneId()).toBe('scene-rest');
  });

  it('keeps defaults when no session exists', async () => {
    const sessions = TestBed.inject(SessionService);
    vi.spyOn(sessions, 'getSession').mockResolvedValue(undefined);

    await component.restoreLastScene();

    expect(component.selectedSceneId()).toBeNull();
  });

  it('sets the status bar context when a scene is selected', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const statusBar = TestBed.inject(StatusBarService);
    const spy = vi.spyOn(statusBar, 'setContext');
    const scene = await sceneService.createScene('p1', 'Forest', 10, 10);
    await component.loadScenes();
    await component.selectScene(scene.id);
    fixture.detectChanges();
    await fixture.whenStable();

    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lastCall?.[0]).toContain('Forest');
    expect(lastCall?.[0]).toContain('10×10');
  });

  it('shows the selected scene layer and tile counts in the status bar', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const statusBar = TestBed.inject(StatusBarService);
    const spy = vi.spyOn(statusBar, 'setContext');
    const scene = await sceneService.createScene('p1', 'Forest', 10, 10);
    scene.layers[0].tileData[0][0] = 5;
    scene.layers[0].tileData[1][1] = 5;
    scene.layers[0].tileData[2][4] = 3;
    await sceneService.updateScene(scene.id, { layers: scene.layers });
    await component.loadScenes();
    await component.selectScene(scene.id);
    fixture.detectChanges();
    await fixture.whenStable();

    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lastCall?.[0]).toContain('1 layer');
    expect(lastCall?.[0]).toContain('3 tiles');
  });
});
