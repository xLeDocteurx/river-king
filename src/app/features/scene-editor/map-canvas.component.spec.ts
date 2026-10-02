import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapCanvasComponent, GRID_VISIBLE_STORAGE_KEY } from './map-canvas.component';
import type { Scene, Layer } from '../../shared/models/scene.model';
import { PlayerController } from './services/play-controller';

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

function makeDefaultLayer(width: number, height: number): Layer {
  return {
    id: 'layer-default',
    name: 'Background',
    visible: true,
    opacity: 1,
    tileData: Array.from({ length: height }, () => Array<number>(width).fill(-1)),
  };
}

function makeScene(width = 4, height = 4): Scene {
  return {
    id: 'scene-1',
    projectId: 'proj-1',
    name: 'S',
    folderPath: '',
    spawnPoint: null,
    width,
    height,
    layers: [makeDefaultLayer(width, height)],
  };
}

describe('MapCanvasComponent', () => {
  let fixture: ComponentFixture<MapCanvasComponent>;
  let placed: { x: number; y: number; tileId: number }[];

  beforeEach(() => {
    sessionStorage.clear();
  });

  function setup(scene: Scene, footprints: Record<number, { w: number; h: number }> = {}): void {
    TestBed.configureTestingModule({
      imports: [MapCanvasComponent],
      providers: [PlayerController],
    });
    fixture = TestBed.createComponent(MapCanvasComponent);
    placed = [];
    fixture.componentInstance.tilePlaced.subscribe((e) => placed.push(e));
    fixture.componentRef.setInput('scene', scene);
    fixture.componentRef.setInput('layers', scene.layers);
    fixture.componentRef.setInput('selectedTileId', 1);
    fixture.componentRef.setInput('tileFootprints', footprints);
    fixture.detectChanges();
  }

  function click(instance: MapCanvasComponent, clientX: number, clientY: number): void {
    // jsdom rects are all-zero, so client coords equal canvas-relative coords.
    instance.onMouseDown(new MouseEvent('mousedown', { button: 0, clientX, clientY }));
  }

  it('emits the clicked cell when the default 1x1 footprint fits', () => {
    setup(makeScene());
    click(fixture.componentInstance, 10, 20);

    expect(placed).toEqual([{ x: 0, y: 1, tileId: 1 }]);
  });

  it('emits when the footprint exceeds the scene bounds within the grow reach', () => {
    setup(makeScene(4, 4), { 1: { w: 2, h: 2 } });
    // Anchor cell (3,0): 3 + 2 > width 4, but within the auto-grow guard (1 tile).
    click(fixture.componentInstance, 55, 10);

    expect(placed).toEqual([{ x: 3, y: 0, tileId: 1 }]);
  });

  it('does not emit when the placement is beyond the auto-grow guard', () => {
    setup(makeScene(4, 4), { 1: { w: 2, h: 2 } });
    // Anchor cell (20,0): 20 + 2 - width 4 = 18 > MAX_EXPAND_TILES (16).
    click(fixture.componentInstance, 330, 10);

    expect(placed).toEqual([]);
  });

  it('emits when the same footprint fits flush against the edge', () => {
    setup(makeScene(4, 4), { 1: { w: 2, h: 2 } });
    // Click lands on cell (2,1): 2 + 2 <= 4 and 1 + 2 <= 4.
    click(fixture.componentInstance, 33, 20);

    expect(placed).toEqual([{ x: 2, y: 1, tileId: 1 }]);
  });

  it('disables image smoothing so upscaled tiles render pixel-perfect', () => {
    const ctx = {
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);

    try {
      setup(makeScene());
      expect(fixture.componentInstance['ctx']).toBe(ctx);
      expect(ctx.imageSmoothingEnabled).toBe(false);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('does not shift the camera in jsdom (zero-size canvas)', () => {
    setup(makeScene(10, 8));
    const instance = fixture.componentInstance;
    // jsdom canvas is 0x0, so centerOnGrid skips — camera stays at origin
    expect(instance.cameraX()).toBe(0);
    expect(instance.cameraY()).toBe(0);
    expect(instance.zoom()).toBe(1);
  });

  it('clears the preview when the pointer leaves the canvas', () => {
    setup(makeScene(4, 4), { 1: { w: 2, h: 2 } });
    const instance = fixture.componentInstance;

    instance.onMouseMove(new MouseEvent('mousemove', { clientX: 33, clientY: 20 }));

    expect(instance.hoverCell()).toEqual({ x: 2, y: 1, w: 2, h: 2 });
  });

  it('shows no preview without a selected tile', () => {
    setup(makeScene(4, 4));
    fixture.componentRef.setInput('selectedTileId', null);
    const instance = fixture.componentInstance;

    instance.onMouseMove(new MouseEvent('mousemove', { clientX: 33, clientY: 20 }));

    expect(instance.hoverCell()).toBeNull();
  });

  it('shows a preview when the footprint exceeds the scene bounds within the grow reach', () => {
    setup(makeScene(4, 4), { 1: { w: 2, h: 2 } });
    const instance = fixture.componentInstance;

    // Anchor cell (3,0): within the auto-grow guard, so the preview stays.
    instance.onMouseMove(new MouseEvent('mousemove', { clientX: 50, clientY: 5 }));

    expect(instance.hoverCell()).toEqual({ x: 3, y: 0, w: 2, h: 2 });
  });

  it('shows no preview when the placement is beyond the auto-grow guard', () => {
    setup(makeScene(4, 4), { 1: { w: 2, h: 2 } });
    const instance = fixture.componentInstance;

    // Anchor cell (20,0): 20 + 2 - width 4 = 18 > MAX_EXPAND_TILES (16).
    instance.onMouseMove(new MouseEvent('mousemove', { clientX: 330, clientY: 5 }));

    expect(instance.hoverCell()).toBeNull();
  });

  it('clears the preview when the pointer leaves the canvas', () => {
    setup(makeScene(4, 4), { 1: { w: 2, h: 2 } });
    const instance = fixture.componentInstance;
    instance.onMouseMove(new MouseEvent('mousemove', { clientX: 33, clientY: 20 }));
    expect(instance.hoverCell()).not.toBeNull();

    instance.onMouseLeave();

    expect(instance.hoverCell()).toBeNull();
  });

  it('defaults to showing the grid when no session preference is stored', () => {
    setup(makeScene(4, 4));
    expect(fixture.componentInstance.showGrid()).toBe(true);
  });

  it('restores the grid visibility from the session when hidden', () => {
    sessionStorage.setItem(GRID_VISIBLE_STORAGE_KEY, '0');
    setup(makeScene(4, 4));
    expect(fixture.componentInstance.showGrid()).toBe(false);
  });

  it('persists grid visibility changes to the session storage', async () => {
    setup(makeScene(4, 4));
    const instance = fixture.componentInstance;
    instance.showGrid.set(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(GRID_VISIBLE_STORAGE_KEY)).toBe('0');
    instance.showGrid.set(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(GRID_VISIBLE_STORAGE_KEY)).toBe('1');
  });

  it('emits a spawnPlaced cell when placeSpawnMode is active', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    let spawn: { x: number; y: number } | undefined;
    instance.spawnPlaced.subscribe((c) => (spawn = c));
    fixture.componentRef.setInput('placeSpawnMode', true);

    instance.onMouseDown(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 20 }));

    expect(spawn).toEqual({ x: 0, y: 1 });
    expect(placed).toEqual([]);
  });

  it('does not emit spawnPlaced when placeSpawnMode is off', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    let spawn: { x: number; y: number } | undefined;
    instance.spawnPlaced.subscribe((c) => (spawn = c));

    instance.onMouseDown(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 20 }));

    expect(spawn).toBeUndefined();
  });

  it('draws the player placeholder in play mode', () => {
    const ctx = {
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      setup(makeScene());
      const player = fixture.debugElement.injector.get(PlayerController);
      player.start({ width: 4, height: 4 }, { x: 1, y: 2 });
      fixture.componentRef.setInput('playMode', true);
      fixture.detectChanges();
      expect(ctx.fillRect).toHaveBeenCalledWith(16, 32, 16, 16);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('does not draw the player placeholder outside play mode', () => {
    const ctx = {
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      setup(makeScene());
      fixture.detectChanges();
      expect(ctx.fillRect).not.toHaveBeenCalledWith(16, 32, 16, 16);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('follows the player by moving the camera toward the player cell', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    const player = fixture.debugElement.injector.get(PlayerController);
    player.start({ width: 4, height: 4 }, { x: 2, y: 2 });
    fixture.componentRef.setInput('playMode', true);
    const beforeX = instance.cameraX();
    // jsdom canvas is 0x0 wide, so the target X is -(2*cell*zoom), far below
    // the camera's starting position; the camera eases toward it.
    instance['followPlayer']();
    expect(instance.cameraX()).toBeLessThan(beforeX);
  });

  it('ignores editing clicks in play mode', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    fixture.componentRef.setInput('playMode', true);
    fixture.componentRef.setInput('selectedTileId', 1);
    instance.onMouseDown(new MouseEvent('mousedown', { button: 0, clientX: 10, clientY: 20 }));
    expect(placed).toEqual([]);
  });
});
