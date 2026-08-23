import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import 'fake-indexeddb/auto';
import { SceneEditorComponent } from './scene-editor.component';
import { SceneService } from './services/scene.service';
import { DatabaseService } from '../../core/services/database.service';

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SceneEditorComponent],
      providers: [{ provide: ActivatedRoute, useValue: { parent: { params: of({ id: 'p1' }) } } }],
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
    expect(component.selectedScene()?.tileData).toEqual(expected);
    const stored = await db.scenes.get(scene.id);
    expect(stored?.tileData).toEqual(expected);
  });
});
