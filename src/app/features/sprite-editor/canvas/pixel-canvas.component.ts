import {
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  AfterViewInit,
  effect,
} from '@angular/core';
import type { TileAnchor } from '../../../shared/models/tile-anchor';
import type { DrawingTool } from '../tools/drawing-tools.component';

/** Session storage key used to persist the sprite canvas grid visibility. */
export const GRID_VISIBLE_STORAGE_KEY = 'rk-sprite-editor.show-grid';

/**
 * Pixel canvas component for drawing and editing sprite pixel data.
 *
 * Renders a grid matching the sprite dimensions derived from the
 * `paletteIndices` input (any width/height), with an adaptive cell scale that
 * keeps the canvas around 256px. Supports brush, eraser, flood-fill, and anchor
 * tools. Emits updated palette indices on change.
 *
 * With the anchor tool active the pointer snaps to the tile grid (`tileSize`)
 * and clicking emits the chosen ground cell through `anchorChange` without
 * painting; under the paint tools a stored anchor is drawn as a subtle outline.
 *
 * Zoom is controlled via mouse wheel and applied natively through the canvas
 * 2D context's `scale()` transform. The zoom factor multiplies the adaptive
 * cell scale so the canvas bitmap resizes proportionally. Zoom is clamped
 * between 0.25× and 8×.
 */
@Component({
  selector: 'rk-pixel-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pixel-canvas.component.html',
  styleUrl: './pixel-canvas.component.scss',
})
export class PixelCanvasComponent implements AfterViewInit {
  /** Reference to the underlying HTML canvas element. */
  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  /** Required 2D array of palette indices representing the sprite pixels. */
  paletteIndices = input.required<number[][]>();

  /** Required array of hex color strings defining the project palette. */
  palette = input.required<string[]>();

  /** Required index of the currently selected color in the palette. */
  selectedColorIndex = input.required<number>();

  /** Required active drawing tool. */
  tool = input.required<DrawingTool>();

  /** Side length in pixels of one map grid cell, used to snap the anchor zone. */
  tileSize = input<number>(16);

  /** Stored ground-cell anchor of the current tile, or null when derived. */
  anchor = input<TileAnchor | null>(null);

  /** Optional per-pixel collision mask of the current tile (`1` = solid). */
  collisionMask = input<number[][] | null>(null);

  /** Emits the snapped anchor chosen with the anchor tool. */
  anchorChange = output<TileAnchor>();

  /** @internal Snapped ground zone under the pointer while the anchor tool is active. */
  private readonly hoverZone = signal<TileAnchor | null>(null);

  /** Emits updated palette indices whenever the canvas is modified. */
  indicesChange = output<number[][]>();

  /** Emits when a new stroke begins (mousedown). */
  strokeStart = output<void>();

  /** Emits when a stroke ends (mouseup/leave) with the final indices. */
  strokeEnd = output<number[][]>();

  /** Emits the current zoom factor whenever it changes. */
  zoomChange = output<number>();

  /** Emits the updated collision mask whenever it is painted. */
  collisionMaskChange = output<number[][]>();

  /** Pixel data URI of the previous frame for onion-skin reference, or null. */
  onionSkinPrev = input<string | null>(null);

  /** Pixel data URI of the next frame for onion-skin reference, or null. */
  onionSkinNext = input<string | null>(null);

  /** Opacity of the previous-frame onion skin (0–1). */
  onionSkinPrevOpacity = input<number>(0.35);

  /** Opacity of the next-frame onion skin (0–1). */
  onionSkinNextOpacity = input<number>(0.35);

  /** Number of pixel rows in the current sprite grid (derived from input). */
  readonly gridRows = signal(1);

  /** Number of pixel columns in the current sprite grid (derived from input). */
  readonly gridCols = signal(1);

  /** Current zoom factor (1 = 100%). Controlled via mouse wheel. */
  readonly zoom = signal(1);

  /** Whether the pixel grid is drawn over the sprite. Defaults to on (visible). */
  readonly showGrid = signal(this.readGridVisibility());

  /** Device pixels per grid cell; adapts to keep the canvas near 256px. */
  readonly cellScale = computed(() =>
    Math.max(4, Math.floor(256 / Math.max(this.gridRows(), this.gridCols(), 1))),
  );

  /** Canvas bitmap width in device pixels, accounting for zoom. */
  readonly canvasWidth = computed(() =>
    Math.round(this.gridCols() * this.cellScale() * this.zoom()),
  );

  /** Canvas bitmap height in device pixels, accounting for zoom. */
  readonly canvasHeight = computed(() =>
    Math.round(this.gridRows() * this.cellScale() * this.zoom()),
  );

  private isDrawing = false;
  private localPaletteIndices: number[][] = [];
  private localCollisionMask: number[][] = [];
  private rectCache: DOMRect | null = null;

  private readonly onionSkinImages = signal<{
    prev: HTMLImageElement | null;
    next: HTMLImageElement | null;
  }>({ prev: null, next: null });

  constructor() {
    effect(() => {
      const indices = this.paletteIndices();
      this.localPaletteIndices = indices.map((row) => [...row]);
      this.gridRows.set(Math.max(1, indices.length));
      this.gridCols.set(Math.max(1, ...indices.map((row) => row.length)));
      this.syncCollisionMask();
      this.syncCanvasSize();

      // Track the anchor inputs so a change re-renders the ground-zone marker.
      this.tileSize();
      this.anchor();

      // Track onion-skin inputs so load + re-render happens when they change.
      this.onionSkinPrev();
      this.onionSkinNext();
      this.onionSkinPrevOpacity();
      this.onionSkinNextOpacity();
      void this.loadOnionSkinImages();

      this.render();
    });

    /** Persist the grid visibility choice for the current browser session. */
    effect(() => {
      sessionStorage.setItem(GRID_VISIBLE_STORAGE_KEY, this.showGrid() ? '1' : '0');
    });
  }

  /** Lifecycle hook called after view initialization. */
  ngAfterViewInit() {
    this.syncCanvasSize();
    this.render();
  }

  /** @internal Sizes the canvas bitmap to the current grid dimensions and cell scale. */
  private syncCanvasSize() {
    const ref = this.canvasRef();
    if (!ref) return;
    ref.nativeElement.width = this.canvasWidth();
    ref.nativeElement.height = this.canvasHeight();
  }

  /** Loads an image from a data URI and returns it as an HTMLImageElement. */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /** Loads previous/next onion-skin images asynchronously and triggers a re-render once decoded. */
  private async loadOnionSkinImages(): Promise<void> {
    const prevUri = this.onionSkinPrev();
    const nextUri = this.onionSkinNext();
    const [prevImg, nextImg] = await Promise.all([
      prevUri ? this.loadImage(prevUri) : Promise.resolve(null),
      nextUri ? this.loadImage(nextUri) : Promise.resolve(null),
    ]);
    this.onionSkinImages.set({ prev: prevImg, next: nextImg });
    this.render();
  }

  /** Toggles whether the pixel grid is drawn over the sprite. */
  toggleGrid(): void {
    this.showGrid.update((v) => !v);
    this.render();
  }

  /**
   * Reads the stored grid visibility for the current session.
   * @returns True unless the session explicitly stores '0'; missing values default to visible.
   */
  private readGridVisibility(): boolean {
    return sessionStorage.getItem(GRID_VISIBLE_STORAGE_KEY) !== '0';
  }

  /** @internal Renders the background, pixel data, then the grid on top so cell boundaries stay visible. */
  private render() {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = this.canvasWidth();
    const height = this.canvasHeight();
    const rows = this.gridRows();
    const cols = this.gridCols();
    const scale = this.cellScale();
    const zoom = this.zoom();

    // Dark checkerboard background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.scale(zoom, zoom);

    // 1. Previous onion skin (behind current)
    const prevImg = this.onionSkinImages().prev;
    if (prevImg) {
      ctx.save();
      ctx.globalAlpha = this.onionSkinPrevOpacity();
      ctx.drawImage(prevImg, 0, 0, cols * scale, rows * scale);
      ctx.restore();
    }

    // 2. Draw pixels
    const indices = this.localPaletteIndices;
    if (indices.length > 0) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const idx = indices[y]?.[x] ?? 0;
          if (idx > 0) {
            const color = this.palette()[idx - 1];
            if (color) {
              ctx.fillStyle = color;
              ctx.fillRect(x * scale, y * scale, scale, scale);
            }
          }
        }
      }
    }

    // 3. Next onion skin (in front of current, before grid)
    const nextImg = this.onionSkinImages().next;
    if (nextImg) {
      ctx.save();
      ctx.globalAlpha = this.onionSkinNextOpacity();
      ctx.drawImage(nextImg, 0, 0, cols * scale, rows * scale);
      ctx.restore();
    }

    // Collision mask overlay while a mask tool is active.
    const maskTool = this.tool() === 'collision' || this.tool() === 'collisionErase';
    if (maskTool && this.localCollisionMask.length > 0) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.35)';
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if ((this.localCollisionMask[y]?.[x] ?? 0) >= 1) {
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      }
    }

    // Ground-zone marker: bright highlight while the anchor tool is active,
    // otherwise a subtle dashed outline of the stored zone.
    const ts = this.tileSize();
    const zone = this.tool() === 'anchor' ? (this.hoverZone() ?? this.anchor()) : this.anchor();
    if (zone) {
      ctx.save();
      ctx.strokeStyle = this.tool() === 'anchor' ? '#ffffff' : '#555555';
      ctx.lineWidth = 1;
      ctx.setLineDash(this.tool() === 'anchor' ? [] : [3, 3]);
      ctx.strokeRect(zone.x * scale, zone.y * scale, ts * scale, ts * scale);
      ctx.restore();
    }

    // Draw grid LAST so it stays visible over painted pixels.
    // Skip when zoomed out far enough that lines would create moiré
    // (threshold: rendered cell < 8 screen pixels).
    if (this.showGrid() && zoom * scale >= 8) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      for (let x = 0; x <= cols; x++) {
        ctx.beginPath();
        ctx.moveTo(x * scale, 0);
        ctx.lineTo(x * scale, height / zoom);
        ctx.stroke();
      }
      for (let y = 0; y <= rows; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * scale);
        ctx.lineTo(width / zoom, y * scale);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Converts a mouse event into pixel grid coordinates.
   * Accounts for the current zoom factor when mapping screen pixels to grid cells.
   * @param event - The mouse event to convert.
   * @returns Grid coordinates { x, y } clamped to the sprite bounds.
   */
  private getPixelCoordinates(event: MouseEvent): { x: number; y: number } {
    if (!this.rectCache) {
      return { x: -1, y: -1 };
    }
    const effectiveScale = this.cellScale() * this.zoom();
    const x = Math.floor((event.clientX - this.rectCache.left) / effectiveScale);
    const y = Math.floor((event.clientY - this.rectCache.top) / effectiveScale);
    return { x, y };
  }

  /**
   * @internal Snaps a pointer position to the `ts` grid, clamped so the ground
   * zone stays inside the frame.
   * @param event - The mouse event.
   * @returns The snapped anchor, or null when the pointer is off-canvas.
   */
  private snappedAnchor(event: MouseEvent): TileAnchor | null {
    const px = this.getPixelCoordinates(event);
    if (px.x < 0 || px.y < 0) return null;
    const ts = this.tileSize();
    const maxX = Math.max(0, this.gridCols() - ts);
    const maxY = Math.max(0, this.gridRows() - ts);
    const x = Math.min(Math.max(0, Math.floor(px.x / ts) * ts), maxX);
    const y = Math.min(Math.max(0, Math.floor(px.y / ts) * ts), maxY);
    return { x, y };
  }

  /**
   * Handles mouse down on the canvas to start drawing.
   * @param event - The mouse down event.
   */
  onMouseDown(event: MouseEvent) {
    const ref = this.canvasRef();
    if (ref) {
      this.rectCache = ref.nativeElement.getBoundingClientRect();
    }
    if (this.tool() === 'anchor') {
      const snapped = this.snappedAnchor(event);
      if (snapped) {
        this.hoverZone.set(snapped);
        this.anchorChange.emit(snapped);
        this.render();
      }
      return;
    }
    this.isDrawing = true;
    this.strokeStart.emit();
    this.applyTool(event);
  }

  /**
   * Handles mouse move to continue drawing while dragging, or to follow the
   * pointer with the ground-zone highlight while the anchor tool is active.
   * @param event - The mouse move event.
   */
  onMouseMove(event: MouseEvent) {
    if (this.tool() === 'anchor') {
      const snapped = this.snappedAnchor(event);
      this.hoverZone.set(snapped);
      this.render();
      return;
    }
    if (!this.isDrawing) return;
    this.applyTool(event);
  }

  /** Handles mouse up to stop drawing. */
  onMouseUp() {
    this.isDrawing = false;
    this.strokeEnd.emit(this.localPaletteIndices.map((row) => [...row]));
  }

  /** Handles mouse leaving the canvas to stop drawing. */
  onMouseLeave() {
    this.isDrawing = false;
    this.hoverZone.set(null);
    this.strokeEnd.emit(this.localPaletteIndices.map((row) => [...row]));
    this.rectCache = null;
  }

  /**
   * Handles mouse wheel to zoom in/out. Zoom is clamped between 0.25 and 8.
   * @param event - The wheel event.
   */
  onWheel(event: WheelEvent) {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    this.zoom.update((z) => Math.max(0.25, Math.min(8, z * factor)));
    this.zoomChange.emit(this.zoom());
    this.syncCanvasSize();
    this.render();
  }

  /** @internal Dispatches brush, eraser, or fill for the given mouse event. */
  private applyTool(event: MouseEvent) {
    const { x, y } = this.getPixelCoordinates(event);
    if (x < 0 || x >= this.gridCols() || y < 0 || y >= this.gridRows()) return;

    const current = this.localPaletteIndices[y][x];
    const tool = this.tool();

    if (tool === 'brush') {
      if (current !== this.selectedColorIndex()) {
        this.localPaletteIndices[y][x] = this.selectedColorIndex();
        this.emitAndRender();
      }
    } else if (tool === 'eraser') {
      if (current !== 0) {
        this.localPaletteIndices[y][x] = 0;
        this.emitAndRender();
      }
    } else if (tool === 'fill') {
      const targetColor = current;
      const fillColor = this.selectedColorIndex();
      if (targetColor === fillColor) return;
      this.floodFill(x, y, targetColor, fillColor);
      this.emitAndRender();
    } else if (tool === 'collision' || tool === 'collisionErase') {
      const value = tool === 'collision' ? 1 : 0;
      if (this.localCollisionMask[y][x] !== value) {
        this.localCollisionMask[y][x] = value;
        this.emitMaskAndRender();
      }
    }
  }

  /**
   * @internal Performs a stack-based flood fill from the given pixel.
   * @param startX - Starting column.
   * @param startY - Starting row.
   * @param targetColor - Palette index to replace.
   * @param fillColor - Palette index to fill with.
   */
  private floodFill(startX: number, startY: number, targetColor: number, fillColor: number) {
    const stack: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();
    const key = (x: number, y: number) => `${x},${y}`;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= this.gridCols() || y < 0 || y >= this.gridRows()) continue;
      if (visited.has(key(x, y))) continue;
      visited.add(key(x, y));
      if (this.localPaletteIndices[y][x] !== targetColor) continue;

      this.localPaletteIndices[y][x] = fillColor;

      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
  }

  /** @internal Emits the updated indices and triggers a re-render. */
  private emitAndRender() {
    this.indicesChange.emit(this.localPaletteIndices.map((row) => [...row]));
    this.render();
  }

  /** @internal Emits the updated collision mask and triggers a re-render. */
  private emitMaskAndRender() {
    this.collisionMaskChange.emit(this.localCollisionMask.map((row) => [...row]));
    this.render();
  }

  /**
   * @internal Sizes the local collision mask to the sprite grid, filling
   * missing values with `0` so every cell is paintable.
   */
  private syncCollisionMask() {
    const mask = this.collisionMask();
    const rows = this.gridRows();
    const cols = this.gridCols();
    const result: number[][] = [];
    for (let y = 0; y < rows; y++) {
      const sourceRow = mask?.[y];
      const row: number[] = [];
      for (let x = 0; x < cols; x++) {
        row.push(sourceRow?.[x] ?? 0);
      }
      result.push(row);
    }
    this.localCollisionMask = result;
  }
}
