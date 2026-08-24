import {
  Component,
  DestroyRef,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SpriteService } from './services/sprite.service';
import { PixelCanvasComponent } from './pixel-canvas.component';
import { PaletteManagerComponent } from './palette-manager.component';
import { DrawingToolsComponent, type DrawingTool } from './drawing-tools.component';
import { ProjectService } from '../dashboard/services/project.service';
import { TileService } from '../tile-manager/services/tile.service';
import { NotificationService } from '../../core/services/notification.service';
import type { Sprite } from '../../shared/models/sprite.model';
import type { Tile } from '../../shared/models/tile.model';

/**
 * Main page component for the sprite editor feature.
 *
 * Displays a list of sprites on the left, a pixel canvas in the center,
 * and drawing tools with palette manager on the right.
 */
@Component({
  selector: 'rk-sprite-editor',
  standalone: true,
  providers: [SpriteService, TileService],
  imports: [PixelCanvasComponent, PaletteManagerComponent, DrawingToolsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sprite-editor.component.html',
  styleUrl: './sprite-editor.component.scss',
})
export class SpriteEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly spriteService = inject(SpriteService);
  private readonly projectService = inject(ProjectService);
  private readonly tileService = inject(TileService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  /** Reactive signal holding the current project ID. */
  projectId = signal<string>('');

  /** Reactive signal holding the project's color palette. */
  projectPalette = signal<string[]>([]);

  /** Reactive signal holding the list of sprites. */
  sprites = signal<Sprite[]>([]);

  /** Tiles of the current project, used as group headers for the sprite list. */
  tiles = signal<Tile[]>([]);

  /** Sprites grouped under their parent tile, ordered by tile then sprite name. */
  readonly spriteGroups = computed(() => {
    const tilesById = new Map(this.tiles().map((t) => [t.id, t]));
    const groups = new Map<number, { tile: Tile; sprites: Sprite[] }>();
    for (const sprite of this.sprites()) {
      const tile = tilesById.get(sprite.tileId);
      if (!tile) continue;
      let group = groups.get(tile.id);
      if (!group) {
        group = { tile, sprites: [] };
        groups.set(tile.id, group);
      }
      group.sprites.push(sprite);
    }
    for (const group of groups.values()) {
      group.sprites.sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...groups.values()].sort((a, b) => a.tile.name.localeCompare(b.tile.name));
  });

  /** Reactive signal holding the ID of the currently selected sprite. */
  selectedSpriteId = signal<number | null>(null);

  /** Reactive signal holding the currently selected sprite data. */
  selectedSprite = signal<Sprite | null>(null);

  /** Reactive signal holding the selected palette color index. */
  selectedPaletteIndex = signal<number>(0);

  /** Reactive signal holding the selected drawing tool. */
  selectedTool = signal<DrawingTool>('brush');

  /** Reactive signal holding the decoded palette indices for the canvas. */
  paletteIndices = signal<number[][] | null>(null);

  /** Handle of the scheduled trailing save timer (null when idle). */
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /** Payload waiting to be persisted once drawing pauses. */
  private pendingSave: { spriteId: number; indices: number[][]; pixelData: string } | null = null;

  /** Computed signal deriving the selected color index (palette index + 1). */
  readonly selectedColorIndex = computed(() => this.selectedPaletteIndex() + 1);

  /** Initializes component, subscribing to route params to load project data and honor an optional sprite deep link. */
  ngOnInit() {
    this.destroyRef.onDestroy(() => void this.flushPersist());

    const projectParams =
      this.route.pathFromRoot?.find((r) => r.snapshot.paramMap.has('id'))?.params ??
      this.route.parent?.params;
    projectParams?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.projectId.set(id);
        this.loadProjectPalette();
        this.loadSprites();
        this.loadTiles();
      }
    });

    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (params) => {
      const raw = params['spriteId'];
      if (raw === null || raw === undefined) return;
      try {
        await this.loadSprites();
        this.loadTiles();
        const sprite = await this.spriteService.getSprite(Number(raw));
        if (!sprite) {
          this.notification.error('Sprite not found');
          return;
        }
        await this.selectSprite(sprite.id);
      } catch (e) {
        console.error('Failed to load sprite:', e);
        this.notification.error('Failed to load sprite');
      }
    });
  }

  /** Loads the project's color palette from the project service. */
  async loadProjectPalette() {
    try {
      const project = await this.projectService.getById(this.projectId());
      this.projectPalette.set(project?.palette ?? []);
    } catch (e) {
      this.notification.error('Failed to load project');
      console.error(e);
    }
  }

  /** Loads all sprites for the current project from the sprite service. */
  async loadSprites() {
    try {
      const sprites = await this.spriteService.getSprites(this.projectId());
      this.sprites.set(sprites);
    } catch (e) {
      this.notification.error('Failed to load sprites');
      console.error(e);
    }
  }

  /** Loads all tiles of the project for sprite grouping headers. */
  async loadTiles(): Promise<void> {
    try {
      this.tiles.set(await this.tileService.getTiles(this.projectId()));
    } catch (e) {
      this.notification.error('Failed to load tiles');
      console.error(e);
    }
  }

  /**
   * Selects a sprite by ID and loads its pixel data.
   * @param spriteId - The ID of the sprite to select.
   */
  async selectSprite(spriteId: number) {
    try {
      await this.flushPersist();
      this.selectedSpriteId.set(spriteId);
      const sprite = await this.spriteService.getSprite(spriteId);
      this.selectedSprite.set(sprite ?? null);

      if (sprite?.paletteIndices && sprite.paletteIndices.length > 0) {
        this.paletteIndices.set(sprite.paletteIndices.map((row) => [...row]));
      } else if (sprite) {
        const decoded = await this.spriteService.decodePixelData(
          sprite.pixelData,
          this.projectPalette(),
          sprite.width,
          sprite.height,
        );
        this.paletteIndices.set(decoded);
      } else {
        this.paletteIndices.set(null);
      }
    } catch (e) {
      this.notification.error('Failed to load sprite');
      console.error(e);
    }
  }

  /**
   * Handles canvas changes: echoes pixels locally right away and schedules
   * a single trailing save 250 ms after the last stroke event.
   * @param updatedIndices - The updated 2D array of palette indices.
   */
  onCanvasChange(updatedIndices: number[][]) {
    const sprite = this.selectedSprite();
    if (!sprite) return;

    try {
      const pixelData = this.spriteService.encodePixelData(updatedIndices, this.projectPalette());
      this.paletteIndices.set(updatedIndices.map((row) => [...row]));
      this.selectedSprite.update((s) =>
        s ? { ...s, paletteIndices: updatedIndices.map((row) => [...row]), pixelData } : null,
      );
      this.schedulePersist(sprite.id, updatedIndices, pixelData);
    } catch (e) {
      this.notification.error('Failed to save sprite');
      console.error(e);
    }
  }

  /**
   * Stores the payload and (re)starts the 250 ms trailing timer.
   * @param spriteId - Sprite being edited.
   * @param indices - Latest palette indices.
   * @param pixelData - Encoded pixel payload.
   */
  private schedulePersist(spriteId: number, indices: number[][], pixelData: string): void {
    this.pendingSave = { spriteId, indices, pixelData };
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.flushPersist();
    }, 250);
  }

  /**
   * Writes the pending payload to IndexedDB immediately (no-op when empty).
   * Called by the timer, before sprite switches, and on destruction.
   */
  private async flushPersist(): Promise<void> {
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    const payload = this.pendingSave;
    this.pendingSave = null;
    if (!payload) return;
    try {
      await this.spriteService.updateSprite(payload.spriteId, {
        paletteIndices: payload.indices,
        pixelData: payload.pixelData,
      });
    } catch (e) {
      this.notification.error('Failed to save sprite');
      console.error(e);
    }
  }
}
