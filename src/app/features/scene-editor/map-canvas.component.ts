import {
  Component,
  inject,
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
import { getFootprint } from './map-footprint';
import type { TileFootprintMap } from './map-footprint';
import { cssTokenColor, gridStrokeColor } from './grid-color';
import { SessionService } from '../../core/services/session.service';
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
  /** Camera state to restore once at startup (from the persisted session). */
  restoreCamera = input<{ x: number; y: number; zoom: number } | null>(null);
  /**
   * Horizontal camera offset to restore when the parent signals a scene
   * switch or initial load. Reactively snaps the internal cameraX whenever
   * the parent writes a new value.
   */
  initialCameraX = input(0);
  /**
   * Vertical camera offset to restore when the parent signals a scene
   * switch or initial load. Reactively snaps the internal cameraY whenever
   * the parent writes a new value.
   */
  initialCameraY = input(0);
  /** Emitted when a tile is placed on the canvas. */
  tilePlaced = output<{ x: number; y: number; tileId: number }>();

  /** Current camera X offset in pixels. */
  cameraX = signal(0);
  /** Current camera Y offset in pixels. */
  cameraY = signal(0);
  /** Current zoom level (1 = 100%). */
  zoom = signal(1);
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
  /** @internal Timer id of the pending debounced camera persist. */
  private cameraPersistTimer: ReturnType<typeof setTimeout> | null = null;
  /** @internal Whether restoreCamera input has already been consumed. */
  private cameraRestored = false;

  /**
   * Grid area under the cursor that the selected tile would occupy:
   * anchor cell plus footprint size, or null when no tile is selected,
   * the pointer is outside the scene, or the footprint would not fit.
   * Drives the placement preview rectangle.
   */
  readonly hoverCell = signal<{ x: number; y: number; w: number; h: number } | null>(null);

  /** Persists camera state so a project reopens where the user left it. */
  private readonly sessions = inject(SessionService);

  constructor() {
    /** Re-render whenever rendering inputs change. Image loading is async
     *  so the first sync render may show fallback colors until images decode. */
    effect(() => {
      this.palette();
      this.tileSize();
      this.tileFootprints();
      const sources = this.tileImages();
      void this.rebuildImageCache(sources);
      this.render();
    });

    /** Start or stop the animation loop when animation metadata changes. */
    effect(() => {
      const animations = this.tileAnimations();
      if (Object.keys(animations).length > 0) {
        this.startAnimationLoop();
      } else {
        this.stopAnimationLoop();
      }
    });

    /** Snap camera position when the parent signals a scene switch.
     *  Does NOT touch zoom — the caller may set `restoreCamera` separately. */
    effect(() => {
      const x = this.initialCameraX();
      const y = this.initialCameraY();
      this.cameraX.set(x);
      this.cameraY.set(y);
      this.render();
    });

    /** Restore the full camera state (position + zoom) from the persisted
     *  session once. Must run AFTER the initialCamera effect so it can
     *  override the x/y values with the persisted zoom-aware state. */
    effect(() => {
      const rc = this.restoreCamera();
      if (rc && !this.cameraRestored) {
        this.cameraX.set(rc.x);
        this.cameraY.set(rc.y);
        this.zoom.set(rc.zoom);
        this.cameraRestored = true;
        this.render();
      }
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
    const anchors: { x: number; y: number; tileId: number }[] = [];
    for (let y = 0; y < scene.height; y++) {
      for (let x = 0; x < scene.width; x++) {
        const tileId = scene.tileData[y]?.[x] ?? -1;
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

    // Grid drawn AFTER tiles so cell boundaries stay visible over filled cells.
    // Skipped when zoomed out enough that lines would create moiré noise
    // (threshold: rendered cell < 8 screen pixels).
    const effectiveZoom = this.zoom();
    if (effectiveZoom * cell >= 8) {
      this.drawGrid(ctx, scene.width, scene.height, cell);
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
    this.tickAnimation(performance.now());
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
        this.frameIndices.set(tileId, (current + 1) % meta.frameCount);
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

  /** @internal Draws the grid overlay after tiles so cell lines remain visible. */
  private drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cell: number,
  ): void {
    ctx.strokeStyle = gridStrokeColor(this.canvasRef().nativeElement);
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, height * cell);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell);
      ctx.lineTo(width * cell, y * cell);
      ctx.stroke();
    }
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
    this.updateHoverPreview(event);
    if (!this.isDragging) return;
    const dx = event.clientX - this.lastMouseX;
    const dy = event.clientY - this.lastMouseY;
    this.cameraX.update((v) => v + dx);
    this.cameraY.update((v) => v + dy);
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.scheduleCameraPersist();
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

    this.scheduleCameraPersist();
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
    this.scheduleCameraPersist();
    this.render();
  }

  /**
   * @internal Debounces the session write of the current camera state (400 ms
   * trailing edge) so panning and zooming do not hammer IndexedDB.
   */
  private scheduleCameraPersist(): void {
    if (this.cameraPersistTimer !== null) {
      clearTimeout(this.cameraPersistTimer);
    }
    this.cameraPersistTimer = setTimeout(() => {
      this.cameraPersistTimer = null;
      const projectId = this.scene()?.projectId;
      if (!projectId) return;
      void this.sessions.updateSession(projectId, {
        cameraX: this.cameraX(),
        cameraY: this.cameraY(),
        cameraZoom: this.zoom(),
      });
    }, 400);
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

  /**
   * @internal Computes the grid area the selected tile would occupy for a pointer
   * position, applying the same bounds rule as placement.
   * @param event The native mouse event.
   * @returns Anchor cell plus footprint size, or null when no tile is
   *     selected, the pointer is outside the scene, or it would not fit.
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
    if (x < 0 || y < 0 || x + w > scene.width || y + h > scene.height) return null;
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
