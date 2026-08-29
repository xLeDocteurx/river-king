import {
  Component,
  input,
  output,
  viewChild,
  signal,
  effect,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
  ElementRef,
} from '@angular/core';
import type { Scene } from '../../shared/models/scene.model';
import type { Layer } from '../../shared/models/scene.model';
import { getFootprint } from './map-footprint';
import type { TileFootprintMap } from './map-footprint';
import { cssTokenColor, gridStrokeColor } from './grid-color';
import { GRID_EXT_ALPHA, MAX_EXPAND_TILES } from './autogrow.consts';
import type { TileAnimationMeta } from './services/map-tiles.service';

/**
 * Canvas-based map renderer for a single scene.
 * Supports panning, zooming, and tile placement via mouse interaction.
 */
@Component({
  selector: 'rk-map-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-canvas.component.html',
  styleUrl: './map-canvas.component.scss',
})
export class MapCanvasComponent implements AfterViewInit, OnDestroy {
  /** Required reference to the canvas element. */
  canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** The scene to render on the canvas. */
  scene = input<Scene | null>(null);
  /** Ordered layers for rendering. Overrides scene.tileData when provided. */
  layers = input<Layer[]>([]);
  /** Id of the currently active layer for tile placement. */
  activeLayerId = input<string | null>(null);
  /** Id of the tile currently selected for placement. */
  selectedTileId = input<number | null>(null);
  /** Project palette colors used for tile rendering. */
  palette = input<string[]>([]);
  /** Image sources (data URIs) for each tileId, ordered by frame index. */
  tileImages = input<Record<number, string[]>>({});
  /** Size of one grid cell in pixels (from the project settings). */
  tileSize = input(16);
  /** Grid-cell footprint of each tile id; missing entries mean 1x1. */
  tileFootprints = input<TileFootprintMap>({});
  /** Animation metadata per tile id (absent for static tiles). */
  tileAnimations = input<Record<number, TileAnimationMeta>>({});
  /** Emitted when a tile is placed on the canvas. */
  tilePlaced = output<{ x: number; y: number; tileId: number }>();

  /** Current camera X offset in pixels. */
  cameraX = signal(0);
  /** Current camera Y offset in pixels. */
  cameraY = signal(0);
  /** Current zoom level (1 = 100%). */
  zoom = signal(1);
  /** Whether the grid overlay is visible. */
  showGrid = signal(true);
  /** Current canvas viewport width in CSS pixels. */
  viewportWidth = signal(0);
  /** Current canvas viewport height in CSS pixels. */
  viewportHeight = signal(0);

  /** @internal Canvas 2D rendering context. */
  private ctx: CanvasRenderingContext2D | null = null;
  /** @internal Decoded images ready to draw, keyed by tileId then frame index. */
  private readonly loadedImages = signal<Record<number, HTMLImageElement[]>>({});
  /** @internal Guards against stale async image-cache rebuilds. */
  private imageCacheVersion = 0;
  /** @internal Current frame index per tile for animation playback. */
  private readonly frameIndices = new Map<number, number>();
  /** @internal Timestamp of the last frame advance per tile. */
  private readonly lastFrameTimes = new Map<number, number>();
  /** @internal Handle for the active requestAnimationFrame loop. */
  private rafId = 0;
  /** @internal Whether the animation loop is currently running. */
  private animating = false;
  /** @internal Whether the user is currently panning. */
  private isDragging = false;
  /** @internal Last mouse X position for pan delta calculation. */
  private lastMouseX = 0;
  /** @internal Last mouse Y position for pan delta calculation. */
  private lastMouseY = 0;

  /**
   * Grid area under the cursor that the selected tile would occupy:
   * anchor cell plus footprint size, or null when no tile is selected,
   * the pointer is outside the scene, or the footprint would not fit.
   * Drives the placement preview rectangle.
   */
  readonly hoverCell = signal<{ x: number; y: number; w: number; h: number } | null>(null);
  /** Grid cell currently under the cursor (null when outside the scene). */
  readonly cursorCell = signal<{ x: number; y: number } | null>(null);

  /** @internal Whether the camera has been centered on the initial grid. */
  private gridCentered = false;

  constructor() {
    /** Re-render whenever rendering inputs change. Image loading is async
     *  so the first sync render may show fallback colors until images decode.
     *  Also starts/stops the animation loop when tileAnimations changes. */
    effect(() => {
      this.palette();
      this.tileSize();
      this.tileFootprints();
      const sources = this.tileImages();
      void this.rebuildImageCache(sources);
      this.render();
      const animations = this.tileAnimations();
      if (Object.keys(animations).length > 0 && !this.animating) {
        this.startAnimationLoop();
      } else if (Object.keys(animations).length === 0 && this.animating) {
        this.stopAnimationLoop();
      }
    });

    /** Center the camera on the grid once when the scene first loads. */
    effect(() => {
      const scene = this.scene();
      if (!scene || this.gridCentered) return;
      this.gridCentered = true;
      this.centerOnGrid();
    });
  }

  /**
   * @internal Rebuilds the internal HTMLImageElement cache from the given data URIs,
   * then re-renders once every decodable image is ready. Images that fail
   * to decode are skipped so tiles fall back to palette colors.
   * @param sources - Map of tileId to image source arrays (one per frame).
   */
  private async rebuildImageCache(sources: Record<number, string[]>): Promise<void> {
    const version = ++this.imageCacheVersion;
    const tileIds = Object.keys(sources).map(Number);
    if (tileIds.length === 0) {
      this.loadedImages.set({});
      return;
    }
    // Flatten all frames into (tileId, frameIndex, src) triples for parallel loading.
    const jobs: { tileId: number; frameIndex: number; src: string }[] = [];
    for (const tileId of tileIds) {
      const frames = sources[tileId];
      for (let i = 0; i < frames.length; i++) {
        jobs.push({ tileId, frameIndex: i, src: frames[i] });
      }
    }

    const results = await Promise.all(
      jobs.map(async (j) => ({
        tileId: j.tileId,
        frameIndex: j.frameIndex,
        img: await this.loadImage(j.src),
      })),
    );
    if (version !== this.imageCacheVersion) return;

    const map: Record<number, HTMLImageElement[]> = {};
    for (const { tileId, frameIndex, img } of results) {
      if (!img) continue;
      if (!map[tileId]) map[tileId] = [];
      map[tileId][frameIndex] = img;
    }
    this.loadedImages.set(map);
    this.render();
  }

  /**
   * @internal Creates an HTMLImageElement and waits for it to load from the given source.
   * @param src - Image source (typically a base64 data URI).
   * @returns The loaded image element, or null when decoding fails.
   */
  private loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef().nativeElement;
    const parent = canvas.parentElement!;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    this.viewportWidth.set(parent.clientWidth);
    this.viewportHeight.set(parent.clientHeight);
    this.ctx = canvas.getContext('2d');
    this.render();

    /** Resize the canvas bitmap whenever the parent container changes size. */
    const resizeObserver = new ResizeObserver(() => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      this.viewportWidth.set(parent.clientWidth);
      this.viewportHeight.set(parent.clientHeight);
      this.render();
    });
    resizeObserver.observe(parent);
  }

  /**
   * Renders the current scene onto the canvas. The canvas is cleared first,
   * so a null scene leaves it blank instead of showing a deleted scene's
   * last frame. Each anchor is drawn exactly once across its full footprint.
   */
  render(): void {
    const ctx = this.ctx;
    const canvas = this.canvasRef()?.nativeElement;
    if (!ctx || !canvas) return;

    // Re-applied on every render: assigning canvas.width/height (resize) resets
    // all 2D context state, including smoothing.
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scene = this.scene();
    if (!scene) return;

    const cell = this.tileSize();

    ctx.save();
    ctx.translate(this.cameraX(), this.cameraY());
    ctx.scale(this.zoom(), this.zoom());

    const tileImages = this.loadedImages();
    const layers = this.layers();

    for (const layer of layers) {
      if (!layer.visible) continue;
      if (layer.opacity < 1) {
        ctx.globalAlpha = layer.opacity;
      }
      const anchors: { x: number; y: number; tileId: number }[] = [];
      for (let y = 0; y < scene.height; y++) {
        for (let x = 0; x < scene.width; x++) {
          const tileId = layer.tileData[y]?.[x] ?? -1;
          if (tileId >= 0) {
            anchors.push({ x, y, tileId });
          }
        }
      }

      for (const { x, y, tileId } of anchors) {
        const { w, h } = getFootprint(tileId, this.tileFootprints());
        const frames = tileImages[tileId];
        const frameIdx = this.frameIndices.get(tileId) ?? 0;
        const img = frames?.[frameIdx];
        if (img) {
          ctx.drawImage(img, x * cell, y * cell, w * cell, h * cell);
        } else {
          ctx.fillStyle = this.getTileColor(tileId);
          ctx.fillRect(x * cell, y * cell, w * cell, h * cell);
        }
      }
      if (layer.opacity < 1) {
        ctx.globalAlpha = 1;
      }
    }

    // Grid drawn AFTER tiles so cell boundaries stay visible over filled cells.
    // Adaptive spacing (drawGrid) prevents moiré noise, so the grid stays on
    // at any zoom instead of vanishing when zoomed out.
    if (this.showGrid()) {
      this.drawGrid(ctx, scene, cell, this.viewportWidth(), this.viewportHeight());
    }

    const hover = this.hoverCell();
    if (hover) {
      const stroke = cssTokenColor(this.canvasRef().nativeElement, '--accent', '#ffffff');
      ctx.fillStyle = stroke;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(hover.x * cell, hover.y * cell, hover.w * cell, hover.h * cell);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(hover.x * cell, hover.y * cell, hover.w * cell, hover.h * cell);
    }

    ctx.restore();
  }

  /**
   * Starts the animation loop. Continuously advances frame indices for
   * animated tiles based on their fps and redraws the canvas.
   */
  private startAnimationLoop(): void {
    if (this.animating) return;
    this.animating = true;
    this.lastFrameTimes.clear();
    const now = performance.now();
    for (const id of Object.keys(this.tileAnimations()).map(Number)) {
      this.lastFrameTimes.set(id, now);
    }
    this.tickAnimation(now);
  }

  /**
   * Stops the animation loop and resets frame state.
   */
  private stopAnimationLoop(): void {
    this.animating = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.frameIndices.clear();
    this.lastFrameTimes.clear();
  }

  /**
   * Animation frame callback. Advances frame indices for all animated tiles
   * that are visible, then redraws and schedules the next tick.
   * @param now - Current timestamp from requestAnimationFrame.
   */
  private tickAnimation = (now: number): void => {
    if (!this.animating) return;
    const animations = this.tileAnimations();
    let needsRedraw = false;

    for (const tileIdStr of Object.keys(animations)) {
      const tileId = Number(tileIdStr);
      const meta = animations[tileId];
      const lastTime = this.lastFrameTimes.get(tileId) ?? now;
      const elapsed = now - lastTime;
      const interval = 1000 / meta.fps;

      if (elapsed >= interval) {
        const current = this.frameIndices.get(tileId) ?? 0;
        const next = (current + 1) % meta.frameCount;
        this.frameIndices.set(tileId, next);
        this.lastFrameTimes.set(tileId, now);
        needsRedraw = true;
      }
    }

    if (needsRedraw) this.render();
    this.rafId = requestAnimationFrame(this.tickAnimation);
  };

  /** Cleans up the animation loop on component destruction. */
  ngOnDestroy(): void {
    this.stopAnimationLoop();
  }

  /**
   * @internal Draws the grid overlay across the full viewport so extendable
   * space beyond the in-memory scene is visible. Major-line spacing adapts to
   * the zoom (`cell × 2^k`, smallest k with `spacing × zoom >= 8px`) so lines
   * never collapse into moiré noise. Inside the scene rectangle the grid uses
   * the normal stroke color; outside it, a reduced alpha (`GRID_EXT_ALPHA`).
   * A 1px boundary line marks the scene edge.
   */
  private drawGrid(
    ctx: CanvasRenderingContext2D,
    scene: Scene,
    cell: number,
    viewportW: number,
    viewportH: number,
  ): void {
    const zoom = this.zoom();
    const spacing = this.adaptiveGridSpacing(cell, zoom);
    const stroke = gridStrokeColor(this.canvasRef().nativeElement);

    this.strokeGridLines(ctx, stroke, scene, cell, zoom, viewportW, viewportH, spacing);

    const boundary = scene.width * cell;
    const boundaryH = scene.height * cell;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, boundary, boundaryH);
  }

  /** @internal Computes the adaptive major-line spacing for the current zoom. */
  private adaptiveGridSpacing(cell: number, zoom: number): number {
    let spacing = cell;
    while (spacing * zoom < 8) {
      spacing *= 2;
    }
    return spacing;
  }

  /**
   * @internal Strokes the grid lines across the viewport. Lines (or line
   * segments) inside the scene rectangle use normal alpha; everything outside
   * the rectangle (extended bands) uses `GRID_EXT_ALPHA`.
   */
  private strokeGridLines(
    ctx: CanvasRenderingContext2D,
    stroke: string,
    scene: Scene,
    cell: number,
    zoom: number,
    viewportW: number,
    viewportH: number,
    spacing: number,
  ): void {
    const sceneW = scene.width * cell;
    const sceneH = scene.height * cell;
    const left = -this.cameraX() / zoom;
    const top = -this.cameraY() / zoom;
    const right = left + viewportW / zoom;
    const bottom = top + viewportH / zoom;
    const viewTop = Math.max(top, 0);
    const viewBottom = Math.min(bottom, sceneH);
    const viewLeft = Math.max(left, 0);
    const viewRight = Math.min(right, sceneW);

    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;

    const segment = (x1: number, y1: number, x2: number, y2: number, alpha: number): void => {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    for (let x = Math.floor(left / spacing) * spacing; x <= right; x += spacing) {
      const inside = x >= 0 && x <= sceneW;
      if (inside) {
        if (viewBottom > viewTop) segment(x, viewTop, x, viewBottom, 1);
        if (top < 0) segment(x, top, x, Math.min(0, bottom), GRID_EXT_ALPHA);
        if (bottom > sceneH) segment(x, Math.max(sceneH, top), x, bottom, GRID_EXT_ALPHA);
      } else {
        segment(x, top, x, bottom, GRID_EXT_ALPHA);
      }
    }

    for (let y = Math.floor(top / spacing) * spacing; y <= bottom; y += spacing) {
      const inside = y >= 0 && y <= sceneH;
      if (inside) {
        if (viewRight > viewLeft) segment(viewLeft, y, viewRight, y, 1);
        if (left < 0) segment(left, y, Math.min(0, right), y, GRID_EXT_ALPHA);
        if (right > sceneW) segment(Math.max(sceneW, left), y, right, y, GRID_EXT_ALPHA);
      } else {
        segment(left, y, right, y, GRID_EXT_ALPHA);
      }
    }

    ctx.globalAlpha = 1;
  }

  /** @internal Returns a color from the project palette for a given tile id. */
  private getTileColor(tileId: number): string {
    const colors = this.palette();
    if (colors.length === 0) return '#94b0c2';
    return colors[tileId % colors.length];
  }

  /**
   * Handles the mouse down event for panning or tile placement.
   * @param event The native mouse event.
   */
  onMouseDown(event: MouseEvent): void {
    if (event.button === 1 || (event.button === 0 && !this.selectedTileId())) {
      // Middle mouse or left click without tile selection = pan
      this.isDragging = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (event.button === 0 && this.selectedTileId() !== null) {
      // Left click with tile selected = place tile
      this.placeTile(event);
    }
  }

  /**
   * Handles mouse move for the placement preview and canvas panning.
   * @param event The native mouse event.
   */
  onMouseMove(event: MouseEvent): void {
    this.updateCursorCell(event);
    this.updateHoverPreview(event);
    if (!this.isDragging) return;
    const dx = event.clientX - this.lastMouseX;
    const dy = event.clientY - this.lastMouseY;
    this.cameraX.update((v) => v + dx);
    this.cameraY.update((v) => v + dy);
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.render();
  }

  /**
   * Stops panning.
   */
  onMouseUp(): void {
    this.isDragging = false;
  }

  /**
   * Stops panning and clears the placement preview when the pointer
   * leaves the canvas.
   */
  onMouseLeave(): void {
    this.isDragging = false;
    this.cursorCell.set(null);
    if (this.hoverCell() !== null) {
      this.hoverCell.set(null);
      this.render();
    }
  }

  /**
   * Zooms the canvas in or out centered on the mouse cursor position.
   * The world-space point under the cursor stays pinned to the same
   * screen position after the zoom, giving natural "zoom to pointer" behavior.
   * @param event The native wheel event.
   */
  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const canvas = this.canvasRef().nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const oldZoom = this.zoom();
    const newZoom = Math.max(0.1, Math.min(5, oldZoom * (event.deltaY > 0 ? 0.9 : 1.1)));

    // World-space coordinate under cursor before zoom.
    const worldX = (mouseX - this.cameraX()) / oldZoom;
    const worldY = (mouseY - this.cameraY()) / oldZoom;

    // Adjust camera so the same world point stays under the cursor.
    this.cameraX.set(mouseX - worldX * newZoom);
    this.cameraY.set(mouseY - worldY * newZoom);
    this.zoom.set(newZoom);

    this.render();
  }

  /**
   * Centers the viewport on a given world-space point.
   * @param worldX The X coordinate in world (tile-pixel) space.
   * @param worldY The Y coordinate in world (tile-pixel) space.
   */
  centerOn(worldX: number, worldY: number): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const z = this.zoom();
    this.cameraX.set(-(worldX * z) + canvas.width / 2);
    this.cameraY.set(-(worldY * z) + canvas.height / 2);
    this.render();
  }

  /**
   * Centers the camera so the grid is fully visible in the viewport.
   * Called once on scene load.
   */
  private centerOnGrid(): void {
    const scene = this.scene();
    const canvas = this.canvasRef()?.nativeElement;
    if (!scene || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const ts = this.tileSize();
    const gridW = scene.width * ts;
    const gridH = scene.height * ts;
    const vpW = rect.width;
    const vpH = rect.height;
    this.cameraX.set((vpW - gridW) / 2);
    this.cameraY.set((vpH - gridH) / 2);
    this.zoom.set(1);
    this.render();
  }

  /**
   * @internal Recomputes the preview rectangle for the current pointer position and
   * re-renders only when the hovered cell actually changed.
   * @param event The native mouse event.
   */
  private updateHoverPreview(event: MouseEvent): void {
    const next = this.footprintRectFor(event);
    const prev = this.hoverCell();
    if (prev?.x === next?.x && prev?.y === next?.y && prev?.w === next?.w && prev?.h === next?.h) {
      return;
    }
    this.hoverCell.set(next);
    this.render();
  }

  /** @internal Updates the cursor cell signal with the grid position under the pointer. */
  private updateCursorCell(event: MouseEvent): void {
    const scene = this.scene();
    if (!scene) {
      this.cursorCell.set(null);
      return;
    }
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const cell = this.tileSize();
    const x = Math.floor((event.clientX - rect.left - this.cameraX()) / (cell * this.zoom()));
    const y = Math.floor((event.clientY - rect.top - this.cameraY()) / (cell * this.zoom()));
    const padLeft = Math.max(0, -x);
    const padRight = Math.max(0, x - (scene.width - 1));
    const padTop = Math.max(0, -y);
    const padBottom = Math.max(0, y - (scene.height - 1));
    const inReach =
      padLeft <= MAX_EXPAND_TILES &&
      padRight <= MAX_EXPAND_TILES &&
      padTop <= MAX_EXPAND_TILES &&
      padBottom <= MAX_EXPAND_TILES;
    this.cursorCell.set(inReach ? { x, y } : null);
  }

  /**
   * @internal Computes the grid area the selected tile would occupy for a pointer
   * position. Placement is allowed outside the current scene rectangle as long as the
   * required growth stays within `MAX_EXPAND_TILES` in every direction (the scene can
   * auto-grow to include it).
   * @param event The native mouse event.
   * @returns Anchor cell plus footprint size, or null when no tile is selected,
   *     the pointer is beyond the auto-grow guard, or the tile would not fit.
   */
  private footprintRectFor(
    event: MouseEvent,
  ): { x: number; y: number; w: number; h: number } | null {
    const scene = this.scene();
    const tileId = this.selectedTileId();
    if (!scene || tileId === null) return null;

    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const cell = this.tileSize();
    const x = Math.floor((event.clientX - rect.left - this.cameraX()) / (cell * this.zoom()));
    const y = Math.floor((event.clientY - rect.top - this.cameraY()) / (cell * this.zoom()));
    const { w, h } = getFootprint(tileId, this.tileFootprints());
    const padLeft = Math.max(0, -x);
    const padRight = Math.max(0, x + w - scene.width);
    const padTop = Math.max(0, -y);
    const padBottom = Math.max(0, y + h - scene.height);
    if (
      padLeft > MAX_EXPAND_TILES ||
      padRight > MAX_EXPAND_TILES ||
      padTop > MAX_EXPAND_TILES ||
      padBottom > MAX_EXPAND_TILES
    ) {
      return null;
    }
    return { x, y, w, h };
  }

  /** @internal Calculates grid coordinates and emits a tilePlaced event. The whole footprint must fit inside the scene. */
  private placeTile(event: MouseEvent): void {
    const tileId = this.selectedTileId();
    if (this.scene() === null || tileId === null) return;
    const rect = this.footprintRectFor(event);
    if (!rect) return;
    this.tilePlaced.emit({ x: rect.x, y: rect.y, tileId });
  }
}
