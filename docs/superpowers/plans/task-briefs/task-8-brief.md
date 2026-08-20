# Task 8: Scene Editor (Map Canvas)

**Files:**

- Modify (replace placeholder): `src/app/features/scene-editor/pages/scene-editor/scene-editor.component.ts`
- Create: `src/app/features/scene-editor/components/map-canvas/map-canvas.component.ts`
- Create: `src/app/features/scene-editor/components/scene-list/scene-list.component.ts`
- Create: `src/app/features/scene-editor/components/tile-palette/tile-palette.component.ts`
- Create: `src/app/features/scene-editor/services/scene.service.ts`
- Create: `src/app/features/scene-editor/services/scene.service.spec.ts`

**Context:**
Task 8. Previous tasks 1-7 complete. This is the core feature of the engine - a scene map editor with canvas-based rendering. Users can view scenes, pan around, zoom, and place tiles.

**Interfaces:**
- Consumes: `DatabaseService` (scenes table), `ProjectService` (project data)
- Produces: Scene editor with interactive canvas, scene list, tile palette

**Global Constraints:**
- ChangeDetectionStrategy.OnPush
- Standalone components
- Use signals (signal(), input(), output())
- Tailwind prefix: `tw-`
- Component selector prefix: `rk-`
- Material Symbols icons
- Tile size: 16x16 pixels

---

## Step 1: Create SceneService

Create: `src/app/features/scene-editor/services/scene.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { DatabaseService } from '../../../core/services/database.service';
import type { Scene } from '../../../shared/models/scene.model';

@Injectable()
export class SceneService {
  private readonly db = inject(DatabaseService);

  async getScenes(projectId: string): Promise<Scene[]> {
    return this.db.scenes.where('projectId').equals(projectId).toArray();
  }

  async createScene(projectId: string, name: string, width: number, height: number): Promise<Scene> {
    const scene: Scene = {
      id: crypto.randomUUID(),
      projectId,
      name,
      folderPath: '',
      width,
      height,
      tileData: Array.from({ length: height }, () => Array(width).fill(-1)),
    };
    await this.db.scenes.add(scene);
    return scene;
  }

  async updateScene(id: string, changes: Partial<Omit<Scene, 'id'>>): Promise<void> {
    await this.db.scenes.update(id, changes);
  }

  async deleteScene(id: string): Promise<void> {
    await this.db.scenes.delete(id);
  }

  async getScene(id: string): Promise<Scene | undefined> {
    return this.db.scenes.get(id);
  }
}
```

Create tests: `src/app/features/scene-editor/services/scene.service.spec.ts`

Test cases:
1. Should be created
2. Should create a scene with empty tileData (all -1)
3. Should list scenes by projectId
4. Should update a scene
5. Should delete a scene

Use `fake-indexeddb/auto` and clean up tables in `beforeEach`.

---

## Step 2: Implement MapCanvasComponent

Create: `src/app/features/scene-editor/components/map-canvas/map-canvas.component.ts`

This is the core interactive canvas component. Features:
- Render scene tileData array
- Display tile grid (optional)
- Pan camera (middle mouse or click-drag)
- Zoom (mouse wheel)
- Click to place selected tile (if any)
- Canvas size fills container

```typescript
import { Component, input, output, viewChild, signal, effect, ChangeDetectionStrategy, AfterViewInit, ElementRef } from '@angular/core';
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
```

---

## Step 3: Implement SceneListComponent

Create: `src/app/features/scene-editor/components/scene-list/scene-list.component.ts`

Shows list of scenes in the project with folder organization.

```typescript
import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import type { Scene } from '../../../../shared/models/scene.model';

@Component({
  selector: 'rk-scene-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-flex-col tw-h-full tw-bg-card tw-border-r tw-border-border">
      <div class="tw-flex tw-items-center tw-justify-between tw-px-4 tw-py-3 tw-border-b tw-border-border">
        <h3 class="tw-font-semibold tw-text-foreground">Scenes</h3>
        <button
          type="button"
          (click)="createScene.emit()"
          class="tw-p-1 tw-rounded-md hover:tw-bg-muted"
          title="New Scene"
        >
          <span class="material-symbols" aria-hidden="true">add</span>
        </button>
      </div>
      <div class="tw-flex-1 tw-overflow-auto tw-p-2">
        @for (scene of scenes(); track scene.id) {
          <button
            type="button"
            (click)="sceneSelect.emit(scene.id)"
            [class.tw-bg-primary/10]="selectedSceneId() === scene.id"
            class="tw-w-full tw-text-left tw-px-3 tw-py-2 tw-rounded-md tw-text-sm tw-text-foreground hover:tw-bg-muted tw-transition tw-flex tw-items-center tw-gap-2"
          >
            <span class="material-symbols tw-text-muted-foreground" aria-hidden="true">map</span>
            <span>{{ scene.name }}</span>
          </button>
        } @empty {
          <div class="tw-text-muted-foreground tw-text-sm tw-text-center tw-py-4">No scenes yet</div>
        }
      </div>
    </div>
  `,
})
export class SceneListComponent {
  scenes = input.required<Scene[]>();
  selectedSceneId = input<string | null>(null);
  sceneSelect = output<string>();
  createScene = output<void>();
}
```

---

## Step 4: Implement TilePaletteComponent (placeholder)

Create: `src/app/features/scene-editor/components/tile-palette/tile-palette.component.ts`

For now a simple placeholder showing available tiles. Full tile data will come from Task 10 (Tile Manager).

```typescript
import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'rk-tile-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-flex-col tw-h-full tw-bg-card tw-border-l tw-border-border tw-p-4">
      <h3 class="tw-font-semibold tw-text-foreground tw-mb-3">Tiles</h3>
      <div class="tw-flex tw-flex-wrap tw-gap-2">
        @for (tileId of availableTiles(); track tileId) {
          <button
            type="button"
            (click)="tileSelect.emit(tileId)"
            [class.tw-ring-2]="selectedTileId() === tileId"
            class="tw-w-10 tw-h-10 tw-rounded-md tw-border tw-border-border tw-transition hover:tw-border-primary"
            [style.background-color]="getTileColor(tileId)"
            title="Tile {{ tileId }}"
          ></button>
        }
      </div>
    </div>
  `,
})
export class TilePaletteComponent {
  projectId = input.required<string>();
  selectedTileId = input<number | null>(null);
  availableTiles = input<number[]>([0, 1, 2, 3, 4, 5, 6, 7]); // Placeholder tiles
  tileSelect = output<number>();

  getTileColor(tileId: number): string {
    const colors = ['#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'];
    return colors[tileId % colors.length];
  }
}
```

---

## Step 5: Replace SceneEditorComponent placeholder

Replace: `src/app/features/scene-editor/pages/scene-editor/scene-editor.component.ts`

```typescript
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SceneService } from '../../services/scene.service';
import { MapCanvasComponent } from '../../components/map-canvas/map-canvas.component';
import { SceneListComponent } from '../../components/scene-list/scene-list.component';
import { TilePaletteComponent } from '../../components/tile-palette/tile-palette.component';
import type { Scene } from '../../../../shared/models/scene.model';

@Component({
  selector: 'rk-scene-editor',
  standalone: true,
  providers: [SceneService],
  imports: [MapCanvasComponent, SceneListComponent, TilePaletteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-h-full">
      <rk-scene-list
        class="tw-w-64 tw-shrink-0"
        [scenes]="scenes()"
        [selectedSceneId]="selectedSceneId()"
        (sceneSelect)="selectScene($event)"
        (createScene)="onCreateScene()"
      />
      <div class="tw-flex-1 tw-relative tw-overflow-hidden">
        <rk-map-canvas
          [scene]="selectedScene()"
          [selectedTileId]="selectedTileId()"
          (tilePlaced)="onTilePlaced($event)"
        />
      </div>
      <rk-tile-palette
        class="tw-w-64 tw-shrink-0"
        [projectId]="projectId()"
        [selectedTileId]="selectedTileId()"
        (tileSelect)="selectedTileId.set($event)"
      />
    </div>
  `,
})
export class SceneEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly sceneService = inject(SceneService);

  projectId = signal<string>('');
  scenes = signal<Scene[]>([]);
  selectedSceneId = signal<string | null>(null);
  selectedScene = signal<Scene | null>(null);
  selectedTileId = signal<number | null>(null);

  ngOnInit() {
    this.route.parent?.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.projectId.set(id);
        this.loadScenes();
      }
    });
  }

  async loadScenes() {
    const scenes = await this.sceneService.getScenes(this.projectId());
    this.scenes.set(scenes);
  }

  async selectScene(sceneId: string) {
    this.selectedSceneId.set(sceneId);
    const scene = await this.sceneService.getScene(sceneId);
    this.selectedScene.set(scene ?? null);
  }

  async onCreateScene() {
    await this.sceneService.createScene(
      this.projectId(),
      `Scene ${this.scenes().length + 1}`,
      40,
      30,
    );
    await this.loadScenes();
  }

  async onTilePlaced(event: { x: number; y: number; tileId: number }) {
    const scene = this.selectedScene();
    if (!scene) return;

    const newTileData = scene.tileData.map((row) => [...row]);
    newTileData[event.y][event.x] = event.tileId;

    await this.sceneService.updateScene(scene.id, { tileData: newTileData });
    this.selectedScene.update((s) => (s ? { ...s, tileData: newTileData } : null));
  }
}
```

---

## Step 6: Run tests and lint

Run: `cd /home/lenoir/river-king && devbox run npm run test`
Expected: PASS

Run: `cd /home/lenoir/river-king && devbox run npm run lint`
Expected: PASS

Run: `cd /home/lenoir/river-king && devbox run npm run build`
Expected: PASS

---

## Step 7: Commit

```bash
cd /home/lenoir/river-king
git add src/app/features/scene-editor/
git commit -m "feature-8-scene-editor: add scene editor with map canvas, scene list, and tile palette"
```

---

**Report file:** Write to `docs/superpowers/plans/task-8-report.md`:
- Status: DONE / DONE_WITH_CONCERNS / BLOCKED
- Files created/modified
- Test results: pass/fail + count per file
- Lint results
- Build results
- Git commit hash
- Any issues encountered
