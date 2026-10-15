import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MapCanvasComponent,
  GRID_VISIBLE_STORAGE_KEY,
  COLLISION_VISIBLE_STORAGE_KEY,
} from './map-canvas.component';
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

/** A recorded `fillRect` call with the `globalAlpha` active at call time. */
interface FillCall {
  args: number[];
  alpha: number;
}

/**
 * Builds a canvas 2D context stub that records every `fillRect` call together
 * with the `globalAlpha` in effect, so tests can isolate the collision overlay.
 * @returns The fake context and the list of recorded fills.
 */
function makeRecordingCtx(): { ctx: CanvasRenderingContext2D; fills: FillCall[] } {
  const fills: FillCall[] = [];
  const ctx: Record<string, unknown> = {
    imageSmoothingEnabled: true,
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    arc: vi.fn(),
  };
  ctx['fillRect'] = (x: number, y: number, w: number, h: number) => {
    fills.push({ args: [x, y, w, h], alpha: Number(ctx['globalAlpha']) });
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
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

  function setup(
    scene: Scene,
    footprints: Record<number, { left: number; up: number; right: number; down: number }> = {},
  ): void {
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
    setup(makeScene(4, 4), { 1: { left: 0, up: 0, right: 1, down: 1 } });
    // Anchor cell (3,0): 3 + 2 > width 4, but within the auto-grow guard (1 tile).
    click(fixture.componentInstance, 55, 10);

    expect(placed).toEqual([{ x: 3, y: 0, tileId: 1 }]);
  });

  it('does not emit when the placement is beyond the auto-grow guard', () => {
    setup(makeScene(4, 4), { 1: { left: 0, up: 0, right: 1, down: 1 } });
    // Anchor cell (20,0): 20 + 2 - width 4 = 18 > MAX_EXPAND_TILES (16).
    click(fixture.componentInstance, 330, 10);

    expect(placed).toEqual([]);
  });

  it('emits when the same footprint fits flush against the edge', () => {
    setup(makeScene(4, 4), { 1: { left: 0, up: 0, right: 1, down: 1 } });
    // Click lands on cell (2,1): 2 + 2 <= 4 and 1 + 2 <= 4.
    click(fixture.componentInstance, 33, 20);

    expect(placed).toEqual([{ x: 2, y: 1, tileId: 1 }]);
  });

  it('draws an upward-overhanging tile at its absolute rect and emits its anchor cell', () => {
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
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].tileData[1][1] = 1;
      setup(scene, { 1: { left: 0, up: 1, right: 0, down: 0 } });

      // The anchor cell (1,1) draws a 1x2 rect one row above itself.
      expect(ctx.fillRect).toHaveBeenCalledWith(16, 0, 16, 32);

      const instance = fixture.componentInstance;
      instance.onMouseMove(new MouseEvent('mousemove', { clientX: 24, clientY: 24 }));
      expect(instance.hoverCell()).toEqual({ x: 1, y: 0, w: 1, h: 2 });

      click(instance, 24, 24);
      expect(placed).toEqual([{ x: 1, y: 1, tileId: 1 }]);
    } finally {
      getContextSpy.mockRestore();
    }
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
      rect: vi.fn(),
      clip: vi.fn(),
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
    setup(makeScene(4, 4), { 1: { left: 0, up: 0, right: 1, down: 1 } });
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
    setup(makeScene(4, 4), { 1: { left: 0, up: 0, right: 1, down: 1 } });
    const instance = fixture.componentInstance;

    // Anchor cell (3,0): within the auto-grow guard, so the preview stays.
    instance.onMouseMove(new MouseEvent('mousemove', { clientX: 50, clientY: 5 }));

    expect(instance.hoverCell()).toEqual({ x: 3, y: 0, w: 2, h: 2 });
  });

  it('shows no preview when the placement is beyond the auto-grow guard', () => {
    setup(makeScene(4, 4), { 1: { left: 0, up: 0, right: 1, down: 1 } });
    const instance = fixture.componentInstance;

    // Anchor cell (20,0): 20 + 2 - width 4 = 18 > MAX_EXPAND_TILES (16).
    instance.onMouseMove(new MouseEvent('mousemove', { clientX: 330, clientY: 5 }));

    expect(instance.hoverCell()).toBeNull();
  });

  it('clears the preview when the pointer leaves the canvas', () => {
    setup(makeScene(4, 4), { 1: { left: 0, up: 0, right: 1, down: 1 } });
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

  it('restores the collision overlay visibility from the session when enabled', () => {
    sessionStorage.setItem(COLLISION_VISIBLE_STORAGE_KEY, '1');
    setup(makeScene(4, 4));
    expect(fixture.componentInstance.showCollision()).toBe(true);
  });

  it('persists collision overlay visibility changes to the session storage', async () => {
    setup(makeScene(4, 4));
    const instance = fixture.componentInstance;
    instance.showCollision.set(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY)).toBe('1');
    instance.showCollision.set(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem(COLLISION_VISIBLE_STORAGE_KEY)).toBe('0');
  });

  it('marks a blocking tile with a translucent fill over its footprint when enabled', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].tileData[0][0] = 1;
      setup(scene);
      fixture.componentRef.setInput('blockingById', new Map([[1, true]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.detectChanges();

      expect(fills).toContainEqual({ args: [0, 0, 16, 16], alpha: 0.3 });
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('does not mark a non-blocking tile', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].tileData[0][0] = 1;
      setup(scene);
      fixture.componentRef.setInput('blockingById', new Map([[1, false]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.detectChanges();

      expect(fills.some((f) => f.alpha === 0.3)).toBe(false);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('does not mark blocking tiles on hidden layers', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].visible = false;
      scene.layers[0].tileData[0][0] = 1;
      setup(scene);
      fixture.componentRef.setInput('blockingById', new Map([[1, true]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.detectChanges();

      expect(fills.some((f) => f.alpha === 0.3)).toBe(false);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('marks blocking tiles on a visible opacity-0 layer', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].opacity = 0;
      scene.layers[0].tileData[0][0] = 1;
      setup(scene);
      fixture.componentRef.setInput('blockingById', new Map([[1, true]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.detectChanges();

      expect(fills).toContainEqual({ args: [0, 0, 16, 16], alpha: 0.3 });
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('marks a multi-cell blocking footprint across its full rect', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].tileData[0][0] = 1;
      setup(scene, { 1: { left: 0, up: 0, right: 1, down: 0 } });
      fixture.componentRef.setInput('blockingById', new Map([[1, true]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.detectChanges();

      expect(fills).toContainEqual({ args: [0, 0, 32, 16], alpha: 0.3 });
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('does not draw the collision overlay in play mode', () => {
    const { ctx, fills } = makeRecordingCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      const scene = makeScene(4, 4);
      scene.layers[0].tileData[0][0] = 1;
      setup(scene);
      fixture.componentRef.setInput('blockingById', new Map([[1, true]]));
      fixture.componentInstance.showCollision.set(true);
      fixture.componentRef.setInput('playMode', true);
      fixture.detectChanges();

      expect(fills.some((f) => f.alpha === 0.3)).toBe(false);
    } finally {
      getContextSpy.mockRestore();
    }
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
      rect: vi.fn(),
      clip: vi.fn(),
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
      player.start({ width: 4, height: 4, layers: [] }, { x: 1, y: 2 }, new Map(), {}, new Map());
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
      rect: vi.fn(),
      clip: vi.fn(),
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
    player.start({ width: 4, height: 4, layers: [] }, { x: 2, y: 2 }, new Map(), {}, new Map());
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

  it('draws an accent frame around the interaction target in play mode', () => {
    const ctx = {
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
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
      const tileData = [
        [-1, -1, -1, -1],
        [-1, -1, -1, -1],
        [-1, -1, 7, -1],
        [-1, -1, -1, -1],
      ];
      player.start(
        {
          width: 4,
          height: 4,
          layers: [{ id: 'l1', name: 'interact', visible: true, opacity: 1, tileData }],
        },
        { x: 2, y: 1 },
        new Map(),
        {},
        new Map([[7, 'bell']]),
      );
      fixture.componentRef.setInput('playMode', true);
      fixture.detectChanges();
      expect(ctx.strokeRect).toHaveBeenCalledWith(32, 32, 16, 16);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('draws no interaction frame when there is no target in play mode', () => {
    const ctx = {
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
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
      player.start({ width: 4, height: 4, layers: [] }, { x: 2, y: 1 }, new Map(), {}, new Map());
      fixture.componentRef.setInput('playMode', true);
      fixture.detectChanges();
      expect(ctx.strokeRect).not.toHaveBeenCalledWith(32, 32, 16, 16);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('runs the rAF loop in play mode even without animated tiles', () => {
    const ctx = {
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      setup(makeScene());
      const instance = fixture.componentInstance;
      expect(instance['hasAnimatedTiles']()).toBe(false);

      fixture.componentRef.setInput('playMode', true);
      fixture.detectChanges();

      expect(instance['loopRunning']).toBe(true);
      expect(instance['rafId']).toBeGreaterThan(0);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('does not run the rAF loop in edit mode without animated tiles', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;

    expect(instance['hasAnimatedTiles']()).toBe(false);
    expect(instance['loopRunning']).toBe(false);
    expect(instance['rafId']).toBe(0);
  });

  it('cancels the rAF loop when leaving play mode', () => {
    const ctx = {
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      setup(makeScene());
      const instance = fixture.componentInstance;

      fixture.componentRef.setInput('playMode', true);
      fixture.detectChanges();
      expect(instance['loopRunning']).toBe(true);
      expect(instance['rafId']).toBeGreaterThan(0);

      fixture.componentRef.setInput('playMode', false);
      fixture.detectChanges();

      expect(instance['loopRunning']).toBe(false);
      expect(instance['rafId']).toBe(0);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('ignores wheel zoom in play mode', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    fixture.componentRef.setInput('playMode', true);
    const before = instance.zoom();
    instance.onWheel(new WheelEvent('wheel', { deltaY: -100 }));
    expect(instance.zoom()).toBe(before);
  });

  it('still zooms with the wheel in edit mode', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    const before = instance.zoom();
    instance.onWheel(new WheelEvent('wheel', { deltaY: -100 }));
    expect(instance.zoom()).toBeGreaterThan(before);
  });

  it('exposes an integer play scale and centered offsets', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    instance.viewportWidth.set(800);
    instance.viewportHeight.set(600);
    fixture.componentRef.setInput('viewWidth', 256);
    fixture.componentRef.setInput('viewHeight', 144);
    fixture.componentRef.setInput('playMode', true);
    // floor(min(800/256, 600/144)) = floor(min(3.125, 4.16)) = 3
    expect(instance.playScale()).toBe(3);
    expect(instance.playOffsetX()).toBe(Math.floor((800 - 256 * 3) / 2)); // 16
    expect(instance.playOffsetY()).toBe(Math.floor((600 - 144 * 3) / 2)); // 84
  });

  it('keeps the play scale at 1 in edit mode', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    expect(instance.playScale()).toBe(1);
    expect(instance.playOffsetX()).toBe(0);
    expect(instance.playOffsetY()).toBe(0);
  });

  it('clamps the play camera so the viewport stays inside the scene', () => {
    setup(makeScene()); // 4x4 scene, tileSize 16 -> 64x64 px
    const instance = fixture.componentInstance;
    instance.viewportWidth.set(64);
    instance.viewportHeight.set(64);
    fixture.componentRef.setInput('tileSize', 16);
    fixture.componentRef.setInput('viewWidth', 16);
    fixture.componentRef.setInput('viewHeight', 16);
    const player = fixture.debugElement.injector.get(PlayerController);
    player.start({ width: 4, height: 4, layers: [] }, { x: 0, y: 0 }, new Map(), {}, new Map());
    fixture.componentRef.setInput('playMode', true);
    instance['clampPlayCamera']();
    // camera must not reveal anything left/above the scene origin
    const left = (instance.playOffsetX() - instance.cameraX()) / instance.playScale();
    expect(left).toBeGreaterThanOrEqual(-0.001);
  });

  it('draws the play view clipped to the centered viewport rect', () => {
    const rect = vi.fn();
    const clip = vi.fn();
    const ctx = {
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      rect,
      clip,
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      setup(makeScene());
      const instance = fixture.componentInstance;
      instance.viewportWidth.set(800);
      instance.viewportHeight.set(600);
      fixture.componentRef.setInput('viewWidth', 256);
      fixture.componentRef.setInput('viewHeight', 144);
      fixture.componentRef.setInput('playMode', true);
      instance.render();

      expect(rect).toHaveBeenCalledWith(16, 84, 768, 432);
      expect(clip).toHaveBeenCalled();
      expect(ctx.scale).toHaveBeenCalledWith(3, 3);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('does not clip or letterbox the edit view', () => {
    const clip = vi.fn();
    const ctx = {
      imageSmoothingEnabled: true,
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip,
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    try {
      setup(makeScene());
      fixture.componentInstance.render();
      expect(clip).not.toHaveBeenCalled();
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('snaps the camera to the player when play mode begins', () => {
    setup(makeScene());
    const instance = fixture.componentInstance;
    const player = fixture.debugElement.injector.get(PlayerController);
    player.start({ width: 4, height: 4, layers: [] }, { x: 2, y: 2 }, new Map(), {}, new Map());
    instance.viewportWidth.set(64);
    instance.viewportHeight.set(64);
    fixture.componentRef.setInput('tileSize', 16);
    fixture.componentRef.setInput('viewWidth', 16);
    fixture.componentRef.setInput('viewHeight', 16);
    fixture.componentRef.setInput('playMode', true);
    fixture.detectChanges();
    // jsdom canvas is 0x0; camera centers the player then clamps inside the scene.
    expect(instance.cameraX()).toBeLessThanOrEqual(0);
    expect(instance.cameraY()).toBeLessThanOrEqual(0);
    const left = (instance.playOffsetX() - instance.cameraX()) / instance.playScale();
    expect(left).toBeGreaterThanOrEqual(-0.001);
  });

  it('disconnects the ResizeObserver on destroy', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    class TrackingObserver {
      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    }
    const original = globalThis.ResizeObserver;
    (globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = TrackingObserver;
    try {
      setup(makeScene());
      expect(observe).toHaveBeenCalledTimes(1);

      fixture.destroy();

      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      (globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = original;
    }
  });
});
