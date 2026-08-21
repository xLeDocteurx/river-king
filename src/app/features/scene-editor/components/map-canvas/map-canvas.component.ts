import { Component, input, output, viewChild, signal, ChangeDetectionStrategy, AfterViewInit, ElementRef } from '@angular/core';
import type { Scene } from '../../../../shared/models/scene.model';

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
  /** @internal Whether the user is currently panning. */
  private isDragging = false;
  /** @internal Last mouse X position for pan delta calculation. */
  private lastMouseX = 0;
  /** @internal Last mouse Y position for pan delta calculation. */
  private lastMouseY = 0;
  /** @internal Size of a single tile in pixels. */
  private readonly tileSize = 16;

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
   * Renders the current scene onto the canvas.
   */
  render(): void {
    const ctx = this.ctx;
    const canvas = this.canvasRef()?.nativeElement;
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scene = this.scene();
    if (!scene) return;

    ctx.save();
    ctx.translate(this.cameraX(), this.cameraY());
    ctx.scale(this.zoom(), this.zoom());

    // Draw grid background
    this.drawGrid(ctx, scene.width, scene.height);

    // Draw tiles
    for (let y = 0; y < scene.height; y++) {
      for (let x = 0; x < scene.width; x++) {
        const tileId = scene.tileData[y]?.[x] ?? -1;
        if (tileId >= 0) {
          // Placeholder: draw colored square based on tile ID
          ctx.fillStyle = this.getTileColor(tileId);
          ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        }
      }
    }

    ctx.restore();
  }

  /** @internal Draws the grid behind the tiles. */
  private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * this.tileSize, 0);
      ctx.lineTo(x * this.tileSize, height * this.tileSize);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * this.tileSize);
      ctx.lineTo(width * this.tileSize, y * this.tileSize);
      ctx.stroke();
    }
  }

  /** @internal Returns a pseudo-random color for a given tile id. */
  private getTileColor(tileId: number): string {
    const colors = ['#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'];
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

  /** @internal Calculates grid coordinates and emits a tilePlaced event. */
  private placeTile(event: MouseEvent): void {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left - this.cameraX()) / (this.tileSize * this.zoom()));
    const y = Math.floor((event.clientY - rect.top - this.cameraY()) / (this.tileSize * this.zoom()));
    const scene = this.scene();
    const tileId = this.selectedTileId();

    if (scene && tileId !== null && x >= 0 && x < scene.width && y >= 0 && y < scene.height) {
      this.tilePlaced.emit({ x, y, tileId });
    }
  }
}
