import { Component, input, output, viewChild, signal, ChangeDetectionStrategy, AfterViewInit, ElementRef } from '@angular/core';
import type { Scene } from '../../../../shared/models/scene.model';

@Component({
  selector: 'rk-map-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas
      #canvas
      class="tw-w-full tw-h-full tw-cursor-crosshair"
      (mousedown)="onMouseDown($event)"
      (mousemove)="onMouseMove($event)"
      (mouseup)="onMouseUp()"
      (mouseleave)="onMouseUp()"
      (wheel)="onWheel($event)"
    ></canvas>
  `,
})
export class MapCanvasComponent implements AfterViewInit {
  canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  scene = input<Scene | null>(null);
  selectedTileId = input<number | null>(null);
  tilePlaced = output<{ x: number; y: number; tileId: number }>();

  private ctx: CanvasRenderingContext2D | null = null;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  cameraX = signal(0);
  cameraY = signal(0);
  zoom = signal(1);

  private readonly tileSize = 16;

  ngAfterViewInit() {
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

  render() {
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

  private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
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

  private getTileColor(tileId: number): string {
    const colors = ['#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'];
    return colors[tileId % colors.length];
  }

  onMouseDown(event: MouseEvent) {
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

  onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    const dx = event.clientX - this.lastMouseX;
    const dy = event.clientY - this.lastMouseY;
    this.cameraX.update((v) => v + dx);
    this.cameraY.update((v) => v + dy);
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.render();
  }

  onMouseUp() {
    this.isDragging = false;
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    this.zoom.update((z) => Math.max(0.1, Math.min(5, z * zoomFactor)));
    this.render();
  }

  private placeTile(event: MouseEvent) {
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
