import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PixelCanvasComponent } from './pixel-canvas.component';

function createMockCanvasContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
  };
}

describe('PixelCanvasComponent', () => {
  let fixture: ComponentFixture<PixelCanvasComponent>;
  let mockCtx: ReturnType<typeof createMockCanvasContext>;

  beforeEach(async () => {
    mockCtx = createMockCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId: string) => {
      if (contextId === '2d') {
        return mockCtx as unknown as CanvasRenderingContext2D;
      }
      return null;
    });

    await TestBed.configureTestingModule({
      imports: [PixelCanvasComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PixelCanvasComponent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupInputs(paletteIndices: number[][]) {
    fixture.componentRef.setInput('paletteIndices', paletteIndices);
    fixture.componentRef.setInput('palette', ['#ff0000', '#00ff00']);
    fixture.componentRef.setInput('selectedColorIndex', 1);
    fixture.componentRef.setInput('tool', 'brush');
    fixture.detectChanges();
  }

  it('should create', () => {
    setupInputs([[0]]);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should adapt grid dimensions and cell scale to a 32x32 sprite', () => {
    const indices = Array.from({ length: 32 }, () => Array(32).fill(0));
    setupInputs(indices);

    expect(fixture.componentInstance.gridRows()).toBe(32);
    expect(fixture.componentInstance.gridCols()).toBe(32);
    expect(fixture.componentInstance.cellScale()).toBe(8); // floor(256/32)

    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas.width).toBe(256);
    expect(canvas.height).toBe(256);

    // Drawing must work beyond the legacy 16x16 bounds: click at x=200/8=25.
    const spy = vi.fn();
    fixture.componentInstance.indicesChange.subscribe(spy);
    const rect = { left: 0, top: 0, width: 256, height: 256 };
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    canvas.dispatchEvent(
      new MouseEvent('mousedown', { clientX: 200, clientY: 200, bubbles: true }),
    );
    canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(spy).toHaveBeenCalled();
    const emitted = spy.mock.calls[0][0] as number[][];
    expect(emitted[25][25]).toBe(1);
  });

  it('should clamp the minimum cell scale for very large sprites', () => {
    const indices = Array.from({ length: 80 }, () => Array(80).fill(0));
    setupInputs(indices);

    expect(fixture.componentInstance.gridRows()).toBe(80);
    expect(fixture.componentInstance.cellScale()).toBe(4); // floor(256/80)=3 -> min 4

    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas.width).toBe(320); // 80 * 4
  });

  it('should emit change with updated palette indices on brush click', () => {
    const indices = Array.from({ length: 16 }, () => Array(16).fill(0));
    setupInputs(indices);
    const spy = vi.fn();
    fixture.componentInstance.indicesChange.subscribe(spy);

    const canvas = fixture.nativeElement.querySelector('canvas');
    const rect = { left: 0, top: 0, width: 256, height: 256 };
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);

    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 32, clientY: 48, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(spy).toHaveBeenCalled();
    const emitted = spy.mock.calls[0][0] as number[][];
    expect(emitted[3][2]).toBe(1); // x=32/16=2, y=48/16=3 => palette index 1
  });

  it('should emit change with 0 on eraser click', () => {
    const indices = Array.from({ length: 16 }, () => Array(16).fill(1));
    setupInputs(indices);
    fixture.componentRef.setInput('tool', 'eraser');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.indicesChange.subscribe(spy);

    const canvas = fixture.nativeElement.querySelector('canvas');
    const rect = { left: 0, top: 0, width: 256, height: 256 };
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);

    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 16, clientY: 16, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(spy).toHaveBeenCalled();
    const emitted = spy.mock.calls[0][0] as number[][];
    expect(emitted[1][1]).toBe(0);
  });

  it('should emit change on fill tool using flood fill', () => {
    const indices = Array.from({ length: 16 }, () => Array(16).fill(0));
    indices[7][7] = 1; // single colored pixel in the middle
    setupInputs(indices);
    fixture.componentRef.setInput('tool', 'fill');
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.indicesChange.subscribe(spy);

    const canvas = fixture.nativeElement.querySelector('canvas');
    const rect = { left: 0, top: 0, width: 256, height: 256 };
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);

    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 16, clientY: 16, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(spy).toHaveBeenCalled();
    const emitted = spy.mock.calls[0][0] as number[][];
    // The fill starts at (1,1) which is connected to a sea of 0s
    // It should fill almost everything except the isolated (7,7) pixel
    expect(emitted[1][1]).toBe(1);
    expect(emitted[0][0]).toBe(1);
    expect(emitted[7][7]).toBe(1); // was already 1 before fill (target=0, so this stays 1)
    expect(emitted[6][7]).toBe(1); // filled
  });

  it('should default zoom to 1', () => {
    setupInputs(Array.from({ length: 16 }, () => Array(16).fill(0)));
    expect(fixture.componentInstance.zoom()).toBe(1);
  });

  it('should zoom in on wheel up and emit zoomChange', () => {
    setupInputs(Array.from({ length: 16 }, () => Array(16).fill(0)));
    const zoomSpy = vi.fn();
    fixture.componentInstance.zoomChange.subscribe(zoomSpy);

    const canvas = fixture.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));

    expect(fixture.componentInstance.zoom()).toBeCloseTo(1.1, 5);
    expect(zoomSpy).toHaveBeenCalledWith(1.1);
  });

  it('should zoom out on wheel down', () => {
    setupInputs(Array.from({ length: 16 }, () => Array(16).fill(0)));
    const canvas = fixture.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }));

    expect(fixture.componentInstance.zoom()).toBeCloseTo(0.9, 5);
  });

  it('should clamp zoom to a maximum of 8', () => {
    setupInputs(Array.from({ length: 16 }, () => Array(16).fill(0)));
    const canvas = fixture.nativeElement.querySelector('canvas');
    for (let i = 0; i < 100; i++) {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    }
    expect(fixture.componentInstance.zoom()).toBe(8);
  });

  it('should clamp zoom to a minimum of 0.25', () => {
    setupInputs(Array.from({ length: 16 }, () => Array(16).fill(0)));
    const canvas = fixture.nativeElement.querySelector('canvas');
    for (let i = 0; i < 100; i++) {
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }));
    }
    expect(fixture.componentInstance.zoom()).toBe(0.25);
  });

  it('should resize canvas bitmap when zoom changes', () => {
    setupInputs(Array.from({ length: 16 }, () => Array(16).fill(0)));
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas.width).toBe(256); // 16 * 16 * 1

    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    fixture.detectChanges();
    expect(canvas.width).toBe(Math.round(256 * 1.1));
  });

  it('should still draw at zoomed levels', () => {
    const indices = Array.from({ length: 16 }, () => Array(16).fill(0));
    setupInputs(indices);

    // Zoom in
    const canvas = fixture.nativeElement.querySelector('canvas');
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.indicesChange.subscribe(spy);

    const rect = { left: 0, top: 0, width: 256 * 1.1, height: 256 * 1.1 };
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);

    // Click at position that maps to grid cell (2, 3) at zoom 1.1
    // effectiveScale = 16 * 1.1 = 17.6, so clientX = 2 * 17.6 + 8 = 43.2
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 43, clientY: 60, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(spy).toHaveBeenCalled();
    const emitted = spy.mock.calls[0][0] as number[][];
    expect(emitted[3][2]).toBe(1);
  });
});
