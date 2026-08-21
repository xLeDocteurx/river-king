import {
  Component,
  input,
  output,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  AfterViewInit,
  effect,
} from '@angular/core';

@Component({
  selector: 'rk-pixel-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas
      #canvas
      class="tw-cursor-crosshair"
      (mousedown)="onMouseDown($event)"
      (mousemove)="onMouseMove($event)"
      (mouseup)="onMouseUp()"
      (mouseleave)="onMouseLeave()"
    ></canvas>
  `,
})
export class PixelCanvasComponent implements AfterViewInit {
  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  paletteIndices = input.required<number[][]>();
  palette = input.required<string[]>();
  selectedColorIndex = input.required<number>();
  tool = input.required<'brush' | 'eraser' | 'fill'>();

  indicesChange = output<number[][]>();

  readonly canvasWidth = 256;
  readonly canvasHeight = 256;
  readonly scale = 16;
  readonly spriteSize = 16;

  private isDrawing = false;
  private localPaletteIndices: number[][] = [];
  private rectCache: DOMRect | null = null;

  constructor() {
    effect(() => {
      this.localPaletteIndices = this.paletteIndices().map((row) => [...row]);
      this.render();
    });
  }

  ngAfterViewInit() {
    const ref = this.canvasRef();
    if (!ref) return;
    const canvas = ref.nativeElement;
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;
    this.render();
  }

  private render() {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark checkerboard background
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.spriteSize; x++) {
      ctx.beginPath();
      ctx.moveTo(x * this.scale, 0);
      ctx.lineTo(x * this.scale, this.canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= this.spriteSize; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * this.scale);
      ctx.lineTo(this.canvasWidth, y * this.scale);
      ctx.stroke();
    }

    // Draw pixels
    const indices = this.localPaletteIndices;
    if (indices.length === 0) return;

    for (let y = 0; y < this.spriteSize; y++) {
      for (let x = 0; x < this.spriteSize; x++) {
        const idx = indices[y]?.[x] ?? 0;
        if (idx > 0) {
          const color = this.palette()[idx - 1];
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
          }
        }
      }
    }
  }

  private getPixelCoordinates(event: MouseEvent): { x: number; y: number } {
    if (!this.rectCache) {
      return { x: -1, y: -1 };
    }
    const x = Math.floor((event.clientX - this.rectCache.left) / this.scale);
    const y = Math.floor((event.clientY - this.rectCache.top) / this.scale);
    return { x, y };
  }

  onMouseDown(event: MouseEvent) {
    this.isDrawing = true;
    const ref = this.canvasRef();
    if (ref) {
      this.rectCache = ref.nativeElement.getBoundingClientRect();
    }
    this.applyTool(event);
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDrawing) return;
    this.applyTool(event);
  }

  onMouseUp() {
    this.isDrawing = false;
  }

  onMouseLeave() {
    this.isDrawing = false;
    this.rectCache = null;
  }

  private applyTool(event: MouseEvent) {
    const { x, y } = this.getPixelCoordinates(event);
    if (x < 0 || x >= this.spriteSize || y < 0 || y >= this.spriteSize) return;

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
    }
  }

  private floodFill(startX: number, startY: number, targetColor: number, fillColor: number) {
    const stack: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();
    const key = (x: number, y: number) => `${x},${y}`;

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= this.spriteSize || y < 0 || y >= this.spriteSize) continue;
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

  private emitAndRender() {
    this.indicesChange.emit(this.localPaletteIndices.map((row) => [...row]));
    this.render();
  }
}
