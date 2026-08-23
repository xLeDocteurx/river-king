import {
  Component,
  input,
  output,
  viewChild,
  signal,
  effect,
  ChangeDetectionStrategy,
  AfterViewInit,
  ElementRef,
} from '@angular/core';
import type { Scene } from '../../shared/models/scene.model';
import { getFootprint } from './map-footprint';
import type { TileFootprintMap } from './map-footprint';

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
export class MapCanvasComponent implements AfterViewInit {
  /** Required reference to the canvas element. */
  canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** The scene to render on the canvas. */
  scene = input<Scene | null>(null);
  /** Id of the tile currently selected for placement. */
  selectedTileId = input<number | null>(null);
  /** Project palette colors used for tile rendering. */
  palette = input<string[]>([]);
  /** Image sources (data URIs) for each tileId (first sprite frame). */
  tileImages = input<Record<number, string>>({});
  /** Size of one grid cell in pixels (from the project settings). */
  tileSize = input(16);
  /** Grid-cell footprint of each tile id; missing entries mean 1x1. */
  tileFootprints = input<TileFootprintMap>({});
  /** Emitted when a tile is placed on the canvas. */
  tilePlaced = output<{ x: number; y: number; tileId: number }>();

  /** Current camera X offset in pixels. */
  cameraX = signal(0);
  /** Current camera Y offset in pixels. */
  cameraY = signal(0);
  /** Current zoom level (1 = 100%). */
  zoom = signal(1);

  /** @internal Canvas 2D rendering context. */
  private ctx: CanvasRenderingContext2D | null = null;
  /** @internal Decoded images ready to draw, keyed by tileId. */
  private readonly loadedImages = signal<Record<number, HTMLImageElement>>({});
  /** @internal Guards against stale async image-cache rebuilds. */
  private imageCacheVersion = 0;
  /** @internal Whether the user is currently panning. */
  private isDragging = false;
  /** @internal Last mouse X position for pan delta calculation. */
  private lastMouseX = 0;
  /** @internal Last mouse Y position for pan delta calculation. */
  private lastMouseY = 0;

  constructor() {
    effect(() => {
      // Re-render whenever rendering inputs change
      this.palette();
      this.tileSize();
      this.tileFootprints();
      const sources = this.tileImages();
      void this.rebuildImageCache(sources);
      this.render();
    });
  }

  /**
   * Rebuilds the internal HTMLImageElement cache from the given data URIs,
   * then re-renders once every decodable image is ready. Images that fail
   * to decode are skipped so tiles fall back to palette colors.
   * @param sources - Map of tileId to image source string.
   */
  private async rebuildImageCache(sources: Record<number, string>): Promise<void> {
    const version = ++this.imageCacheVersion;
    if (Object.keys(sources).length === 0) {
      this.loadedImages.set({});
      return;
    }
    const entries = Object.entries(sources);
    const pairs = await Promise.all(
      entries.map(async ([tileId, src]) => ({
        tileId: Number(tileId),
        img: await this.loadImage(src),
      })),
    );
    if (version !== this.imageCacheVersion) return; // a newer request superseded this one
    const map: Record<number, HTMLImageElement> = {};
    for (const { tileId, img } of pairs) {
      if (img) map[tileId] = img;
    }
    this.loadedImages.set(map);
    this.render();
  }

  /**
   * Creates an HTMLImageElement and waits for it to load from the given source.
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
    this.ctx = canvas.getContext('2d');
    this.render();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scene = this.scene();
    if (!scene) return;

    const cell = this.tileSize();

    ctx.save();
    ctx.translate(this.cameraX(), this.cameraY());
    ctx.scale(this.zoom(), this.zoom());

    this.drawGrid(ctx, scene.width, scene.height, cell);

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
      const img = tileImages[tileId];
      if (img) {
        ctx.drawImage(img, x * cell, y * cell, w * cell, h * cell);
      } else {
        ctx.fillStyle = this.getTileColor(tileId);
        ctx.fillRect(x * cell, y * cell, w * cell, h * cell);
      }
    }

    ctx.restore();
  }

  /** @internal Draws the grid behind the tiles. */
  private drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cell: number,
  ): void {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
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
   * Handles mouse move for canvas panning.
   * @param event The native mouse event.
   */
  onMouseMove(event: MouseEvent): void {
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
   * Zooms the canvas in or out based on wheel direction.
   * @param event The native wheel event.
   */
  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    this.zoom.update((z) => Math.max(0.1, Math.min(5, z * zoomFactor)));
    this.render();
  }

  /** @internal Calculates grid coordinates and emits a tilePlaced event. The whole footprint must fit inside the scene. */
  private placeTile(event: MouseEvent): void {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const cell = this.tileSize();
    const x = Math.floor((event.clientX - rect.left - this.cameraX()) / (cell * this.zoom()));
    const y = Math.floor((event.clientY - rect.top - this.cameraY()) / (cell * this.zoom()));
    const scene = this.scene();
    const tileId = this.selectedTileId();
    if (!scene || tileId === null) return;

    const { w, h } = getFootprint(tileId, this.tileFootprints());
    if (x >= 0 && y >= 0 && x + w <= scene.width && y + h <= scene.height) {
      this.tilePlaced.emit({ x, y, tileId });
    }
  }
}
