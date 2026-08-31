import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapCanvasComponent, GRID_VISIBLE_STORAGE_KEY, COLLISION_VISIBLE_STORAGE_KEY } from './map-canvas.component';
import type { Scene, Layer } from '../../shared/models/scene.model';

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
    TestBed.configureTestingModule({ imports: [MapCanvasComponent] });
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

  it('defaults to hiding the collision overlay when no session preference is stored', () => {
    setup(makeScene(4, 4));
    expect(fixture.componentInstance.showCollision()).toBe(false);
  });

  it('restores the collision overlay from the session when enabled', () => {
    sessionStorage.setItem(COLLISION_VISIBLE_STORAGE_KEY, '1');
    setup(makeScene(4, 4));
    expect(fixture.componentInstance.showCollision()).toBe(true);
  });

  it('persists collision overlay visibility to the session storage', async () => {
    setup(makeScene(4, 4));
    const instance = fixture.componentInstance;
    instance.showCollision.set(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY)).toBe('1');
    instance.showCollision.set(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY)).toBe('0');
  });

  it('draws an overlay fill over blocking tile footprints only', () => {
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
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
      const scene = makeScene(4, 2);
      scene.layers[0].tileData[0][0] = 1; // blocking tile
      scene.layers[0].tileData[1][3] = 2; // non-blocking tile
      setup(scene, { 1: { w: 2, h: 1 } });
      const instance = fixture.componentInstance;
      instance.showCollision.set(true);
      fixture.componentRef.setInput('tileBlocking', { 1: true });

      const before = (ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
      instance['drawCollisionOverlay'](ctx, scene, 16);

      const calls = (ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.slice(before);
      // Only tile id 1 is blocking -> exactly one overlay fill at its 2x1 footprint (x=0,y=0).
      expect(calls).toEqual([[0, 0, 32, 16]]);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('skips the overlay pass entirely when collision is hidden', () => {
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
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
      setup(makeScene(2, 2));
      const instance = fixture.componentInstance;
      fixture.componentRef.setInput('tileBlocking', { 1: true });
      instance.showCollision.set(false);
      const before = (ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
      instance['drawCollisionOverlay'](ctx, makeScene(2, 2), 16);
      expect((ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.slice(before)).toEqual([]);
    } finally {
      getContextSpy.mockRestore();
    }
  });
});
