import {
  Component,
  input,
  output,
  viewChild,
  effect,
  ElementRef,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import type { Scene } from '../../../shared/models/scene.model';
import type { Layer } from '../../../shared/models/scene.model';
import type { TileFootprintMap } from '../map-footprint';

/**
 * A minimap overview of the scene displayed above the tile palette.
 * Renders the full scene at a reduced scale and draws a viewport
 * rectangle showing the currently visible area of the main canvas.
 * Clicking on the minimap pans the main canvas to center the clicked point.
 */
@Component({
  selector: 'rk-scene-minimap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scene-minimap.component.html',
  styleUrl: './scene-minimap.component.scss',
})
export class SceneMinimapComponent implements AfterViewInit, OnDestroy {
  /** The scene to render as a minimap. */
  scene = input.required<Scene>();
  /** Ordered layers for rendering. */
  layers = input<Layer[]>([]);
  /** Tile image data URIs keyed by tileId (first frame arrays). */
  tileImages = input<Record<number, string[]>>({});
  /** Size of one grid cell in pixels. */
  tileSize = input(16);
  /** Grid-cell footprint of each tile id. */
  tileFootprints = input<TileFootprintMap>({});
  /** Width of the main canvas viewport in CSS pixels. */
  viewportWidth = input(0);
  /** Height of the main canvas viewport in CSS pixels. */
  viewportHeight = input(0);
  /** Horizontal camera offset of the main canvas in pixels. */
  cameraX = input(0);
  /** Vertical camera offset of the main canvas in pixels. */
  cameraY = input(0);
  /** Zoom level of the main canvas. */
  zoom = input(1);

  /** Emits the world-space coordinates the user wants to center in the viewport. */
  cameraJump = output<{ x: number; y: number }>();

  canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('minimap');

  private ctx: CanvasRenderingContext2D | null = null;

  /** @internal Image cache: decoded HTMLImageElement per tileId. */
  private readonly imageCache = new Map<number, HTMLImageElement>();
  /** @internal Guards against stale async image-cache rebuilds. */
  private imageCacheVersion = 0;
  /** @internal ResizeObserver for canvas resolution sync. */
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      this.scene();
      this.layers();
      this.tileImages();
      this.tileSize();
      this.tileFootprints();
      this.cameraX();
      this.cameraY();
      this.zoom();
      this.viewportWidth();
      this.viewportHeight();
      this.render();
    });
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef().nativeElement;
    this.ctx = canvas.getContext('2d');
    this.syncCanvasSize();
    this.resizeObserver = new ResizeObserver(() => {
      this.syncCanvasSize();
      this.render();
    });
    this.resizeObserver.observe(canvas.parentElement!);
    void this.rebuildImageCache();
    this.render();
  }

  /** Cleans up the ResizeObserver on component destruction. */
  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  /** @internal Sets the canvas bitmap resolution to match its CSS rendered size. */
  private syncCanvasSize(): void {
    const canvas = this.canvasRef().nativeElement;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
  }

  /**
   * Handles click on the minimap: converts click coordinates to
   * world-space and emits cameraJump so the main canvas centers there.
   * @param event The native mouse event.
   */
  onMinimapClick(event: MouseEvent): void {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const cell = this.tileSize();
    const scale = this.computeScale();

    const worldX = (clickX / scale) * cell;
    const worldY = (clickY / scale) * cell;
    this.cameraJump.emit({ x: worldX, y: worldY });
  }

  /**
   * @internal Computes the minimap scale factor so the full scene fits within the canvas.
   * @returns Scale factor: minimap display pixels per world pixel.
   */
  private computeScale(): number {
    const scene = this.scene();
    const cell = this.tileSize();
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return 1;
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.width / dpr;
    const displayH = canvas.height / dpr;
    const worldW = scene.width * cell;
    const worldH = scene.height * cell;
    return Math.min(displayW / worldW, displayH / worldH);
  }

  /**
   * @internal Renders the minimap: draws all tiles at reduced scale, then
   * overlays the viewport rectangle.
   */
  private render(): void {
    const ctx = this.ctx;
    const canvas = this.canvasRef()?.nativeElement;
    if (!ctx || !canvas) return;

    const scene = this.scene();
    const cell = this.tileSize();
    const dpr = window.devicePixelRatio || 1;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const displayW = canvas.width / dpr;
    const displayH = canvas.height / dpr;
    const worldW = scene.width * cell;
    const worldH = scene.height * cell;
    const scale = Math.min(displayW / worldW, displayH / worldH);

    // Scale up for DPR-aware drawing.
    ctx.save();
    ctx.scale(dpr, dpr);

    // Draw background.
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, displayW, displayH);

    // Draw tiles from all visible layers.
    for (const layer of this.layers()) {
      if (!layer.visible) continue;
      if (layer.opacity < 1) ctx.globalAlpha = layer.opacity;
      for (let y = 0; y < scene.height; y++) {
        for (let x = 0; x < scene.width; x++) {
          const tileId = layer.tileData[y]?.[x] ?? -1;
          if (tileId < 0) continue;
          const img = this.imageCache.get(tileId);
          if (img) {
            ctx.drawImage(img, x * cell * scale, y * cell * scale, cell * scale, cell * scale);
          } else {
            ctx.fillStyle = '#94b0c2';
            ctx.fillRect(x * cell * scale, y * cell * scale, cell * scale, cell * scale);
          }
        }
      }
      if (layer.opacity < 1) ctx.globalAlpha = 1;
    }

    // Draw viewport rectangle.
    const camX = this.cameraX();
    const camY = this.cameraY();
    const zoom = this.zoom();
    const vpW = this.viewportWidth();
    const vpH = this.viewportHeight();

    const vpX = (-camX / zoom) * scale;
    const vpY = (-camY / zoom) * scale;
    const vpDrawW = (vpW / zoom) * scale;
    const vpDrawH = (vpH / zoom) * scale;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(vpX, vpY, vpDrawW, vpDrawH);

    ctx.restore();
  }

  /**
   * @internal Rebuilds the decoded image cache from data URIs.
   */
  private async rebuildImageCache(): Promise<void> {
    const version = ++this.imageCacheVersion;
    const sources = this.tileImages();
    const entries = Object.entries(sources);
    if (entries.length === 0) return;

    const pairs = await Promise.all(
      entries.map(async ([tileId, frames]) => ({
        tileId: Number(tileId),
        img: await this.loadImage(frames[0]),
      })),
    );
    if (version !== this.imageCacheVersion) return;

    this.imageCache.clear();
    for (const { tileId, img } of pairs) {
      if (img) this.imageCache.set(tileId, img);
    }
    this.render();
  }

  /**
   * @internal Loads an image from a data URI.
   * @param src The image source.
   * @returns The loaded image, or null on failure.
   */
  private loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
}
