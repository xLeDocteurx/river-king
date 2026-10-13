import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SceneMinimapComponent } from './scene-minimap.component';
import type { Scene, Layer } from '../../../shared/models/scene.model';

// jsdom does not implement ResizeObserver (used by SceneMinimapComponent)
class ResizeObserverStub implements ResizeObserver {
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

function makeScene(width = 4, height = 4): Scene {
  return {
    id: 'scene-1',
    projectId: 'proj-1',
    name: 'S',
    folderPath: '',
    spawnPoint: null,
    width,
    height,
    layers: [],
  };
}

function makeLayer(id: string, visible: boolean, opacity: number, tileData: number[][]): Layer {
  return { id, name: id, visible, opacity, tileData };
}

function emptyTiles(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => Array<number>(width).fill(-1));
}

/**
 * Creates a fake 2D canvas context whose draw methods are spies and whose
 * `globalAlpha` assignments are recorded for later assertions.
 * @returns The fake context and the recorded globalAlpha assignment history.
 */
function makeCtx(): {
  ctx: CanvasRenderingContext2D;
  globalAlphaHistory: number[];
} {
  const globalAlphaHistory: number[] = [];
  let globalAlpha = 1;
  const ctx = {
    imageSmoothingEnabled: true,
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    lineWidth: 0,
    fillStyle: '',
    strokeStyle: '',
  };
  Object.defineProperty(ctx, 'globalAlpha', {
    configurable: true,
    get: () => globalAlpha,
    set: (value: number) => {
      globalAlpha = value;
      globalAlphaHistory.push(value);
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, globalAlphaHistory };
}

interface MinimapHarness {
  fixture: ComponentFixture<SceneMinimapComponent>;
  ctx: CanvasRenderingContext2D;
  getContextSpy: ReturnType<typeof vi.spyOn>;
  globalAlphaHistory: number[];
}

describe('SceneMinimapComponent', () => {
  /**
   * Renders the minimap, then resizes the canvas to a known size and forces a
   * re-render so drawing assertions are independent of jsdom's zero-sized DOM.
   * @param scene The scene input.
   * @param layers The layers input.
   * @param inputs Optional override inputs.
   * @param canvasSize Square bitmap size in device pixels.
   * @returns The fixture, fake context, getContext spy, and alpha history.
   */
  function setup(
    scene: Scene,
    layers: Layer[],
    inputs: {
      tileImages?: Record<number, string[]>;
      tileSize?: number;
      tileFootprints?: Record<number, { w: number; h: number }>;
      viewportWidth?: number;
      viewportHeight?: number;
      cameraX?: number;
      cameraY?: number;
      zoom?: number;
    } = {},
    canvasSize = 100,
  ): MinimapHarness {
    const { ctx, globalAlphaHistory } = makeCtx();
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    TestBed.configureTestingModule({ imports: [SceneMinimapComponent] });
    const fixture = TestBed.createComponent(SceneMinimapComponent);
    fixture.componentRef.setInput('scene', scene);
    fixture.componentRef.setInput('layers', layers);
    fixture.componentRef.setInput('tileImages', inputs.tileImages ?? {});
    fixture.componentRef.setInput('tileSize', inputs.tileSize ?? 16);
    fixture.componentRef.setInput('tileFootprints', inputs.tileFootprints ?? {});
    fixture.componentRef.setInput('viewportWidth', inputs.viewportWidth ?? 0);
    fixture.componentRef.setInput('viewportHeight', inputs.viewportHeight ?? 0);
    fixture.componentRef.setInput('cameraX', inputs.cameraX ?? 0);
    fixture.componentRef.setInput('cameraY', inputs.cameraY ?? 0);
    fixture.componentRef.setInput('zoom', inputs.zoom ?? 1);
    fixture.detectChanges();

    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    fixture.componentRef.setInput('tileImages', inputs.tileImages ? { ...inputs.tileImages } : {});
    fixture.detectChanges();

    return { fixture, ctx, getContextSpy, globalAlphaHistory };
  }

  it('initializes a 2D context, disables smoothing, and clears the canvas', () => {
    const { fixture, ctx, getContextSpy } = setup(makeScene(), []);
    try {
      expect(fixture.componentInstance['ctx']).toBe(ctx);
      expect(ctx.imageSmoothingEnabled).toBe(false);
      expect(ctx.clearRect).toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('canvas')).toBeTruthy();
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('renders the dark background across the visible area and no tiles for an empty grid', () => {
    const { ctx, getContextSpy } = setup(makeScene(4, 4), [
      makeLayer('l1', true, 1, emptyTiles(4, 4)),
    ]);
    try {
      expect(ctx.fillStyle).toBe('#1a1a1a');
      // Tile-sized fills only happen for non-empty cells; a background fill is
      // drawn once per render (initial zero-size canvas, then resized canvas).
      expect(ctx.fillRect).toHaveBeenNthCalledWith(1, 0, 0, 0, 0);
      expect(ctx.fillRect).toHaveBeenNthCalledWith(2, 0, 0, 100, 100);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('draws a placeholder tile for a non-empty cell', () => {
    const tileData = [
      [-1, -1, -1, -1],
      [-1, -1, -1, -1],
      [-1, 5, -1, -1],
      [-1, -1, -1, -1],
    ];
    const { ctx, getContextSpy } = setup(makeScene(4, 4), [makeLayer('l1', true, 1, tileData)]);
    try {
      const scale = Math.min(100 / (4 * 16), 100 / (4 * 16));
      const cell = 16 * scale;
      expect(ctx.fillRect).toHaveBeenCalledWith(cell, 2 * cell, cell, cell);
      expect(ctx.fillStyle).toBe('#94b0c2');
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('skips tiles from invisible layers', () => {
    const visible = [
      [-1, -1, -1, -1],
      [-1, -1, -1, -1],
      [-1, 5, -1, -1],
      [-1, -1, -1, -1],
    ];
    const hidden = [
      [-1, -1, -1, -1],
      [-1, -1, 6, -1],
      [-1, -1, -1, -1],
      [-1, -1, -1, -1],
    ];
    const { ctx, getContextSpy } = setup(makeScene(4, 4), [
      makeLayer('l1', true, 1, visible),
      makeLayer('l2', false, 1, hidden),
    ]);
    try {
      const cell = 16 * Math.min(100 / (4 * 16), 100 / (4 * 16));
      expect(ctx.fillRect).toHaveBeenCalledWith(cell, 2 * cell, cell, cell);
      expect(ctx.fillRect).not.toHaveBeenCalledWith(2 * cell, cell, cell, cell);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('applies the layer opacity to the context and restores it afterward', () => {
    const tileData = [
      [-1, -1, -1, -1],
      [-1, -1, 5, -1],
      [-1, -1, -1, -1],
      [-1, -1, -1, -1],
    ];
    const harness = setup(makeScene(4, 4), [makeLayer('l1', true, 0.4, tileData)]);
    try {
      expect(harness.globalAlphaHistory).toEqual([0.4, 1, 0.4, 1]);
    } finally {
      harness.getContextSpy.mockRestore();
    }
  });

  it('draws the viewport rectangle from camera, zoom, and viewport inputs', () => {
    const { ctx, getContextSpy } = setup(makeScene(4, 4), [], {
      cameraX: -10,
      cameraY: -20,
      zoom: 1,
      viewportWidth: 200,
      viewportHeight: 100,
    });
    try {
      const scale = Math.min(100 / (4 * 16), 100 / (4 * 16));
      expect(ctx.strokeRect).toHaveBeenCalledWith(10 * scale, 20 * scale, 200 * scale, 100 * scale);
      expect(ctx.strokeStyle).toBe('#ffffff');
      expect(ctx.lineWidth).toBe(1);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('redraws the viewport rectangle when the camera moves', () => {
    const { fixture, ctx, getContextSpy } = setup(makeScene(4, 4), [], {
      cameraX: -10,
      cameraY: -20,
      zoom: 1,
      viewportWidth: 200,
      viewportHeight: 100,
    });
    try {
      fixture.componentRef.setInput('cameraX', 10);
      fixture.detectChanges();

      const scale = Math.min(100 / (4 * 16), 100 / (4 * 16));
      expect(ctx.strokeRect).toHaveBeenLastCalledWith(
        -10 * scale,
        20 * scale,
        200 * scale,
        100 * scale,
      );
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('emits cameraJump with world coordinates on click', () => {
    const { fixture, getContextSpy } = setup(makeScene(4, 4), []);
    try {
      let jump: { x: number; y: number } | undefined;
      fixture.componentInstance.cameraJump.subscribe((point) => (jump = point));

      const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
      canvas.dispatchEvent(new MouseEvent('click', { clientX: 32, clientY: 40, bubbles: true }));

      const scale = Math.min(100 / (4 * 16), 100 / (4 * 16));
      expect(jump).toEqual({ x: (32 / scale) * 16, y: (40 / scale) * 16 });
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('keeps the context null when getContext returns null', () => {
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    try {
      TestBed.configureTestingModule({ imports: [SceneMinimapComponent] });
      const fixture = TestBed.createComponent(SceneMinimapComponent);
      fixture.componentRef.setInput('scene', makeScene());
      fixture.componentRef.setInput('layers', []);
      expect(() => fixture.detectChanges()).not.toThrow();
      expect(fixture.componentInstance['ctx']).toBeNull();
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('disconnects the ResizeObserver on destroy', () => {
    const disconnectSpy = vi.spyOn(ResizeObserverStub.prototype, 'disconnect');
    try {
      const { fixture, getContextSpy } = setup(makeScene(), []);
      try {
        fixture.destroy();
        expect(disconnectSpy).toHaveBeenCalledTimes(1);
      } finally {
        getContextSpy.mockRestore();
      }
    } finally {
      disconnectSpy.mockRestore();
    }
  });
});
