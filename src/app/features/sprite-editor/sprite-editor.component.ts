import {
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
  computed,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SpriteService } from './services/sprite.service';
import { PixelCanvasComponent } from './canvas/pixel-canvas.component';
import { PaletteManagerComponent } from './palette/palette-manager.component';
import { DrawingToolsComponent, type DrawingTool } from './tools/drawing-tools.component';
import { FrameStripComponent } from './frame-strip/frame-strip.component';
import { ProjectService } from '../dashboard/services/project.service';
import { TileService } from '../tile-manager/services/tile.service';
import { NotificationService } from '../../core/services/notification.service';
import { SessionService } from '../../core/services/session.service';
import { StatusBarService } from '../../core/services/status-bar.service';
import { UndoService } from '../../core/services/undo.service';
import {
  KeyboardShortcutsService,
  ShortcutId,
} from '../../core/services/keyboard-shortcuts.service';
import type { Sprite } from '../../shared/models/sprite.model';
import type { Tile } from '../../shared/models/tile.model';

/** Human-readable labels for the drawing tools, keyed by tool id. */
const TOOL_LABELS: Record<DrawingTool, string> = {
  brush: 'Brush',
  eraser: 'Eraser',
  fill: 'Fill',
};

/**
 * Main page component for the sprite editor feature.
 *
 * Displays a tile list on the left, a pixel canvas in the center
 * with a frame strip below it, and drawing tools with palette manager on the right.
 */
@Component({
  selector: 'rk-sprite-editor',
  standalone: true,
  providers: [SpriteService, TileService],
  imports: [
    PixelCanvasComponent,
    PaletteManagerComponent,
    DrawingToolsComponent,
    FrameStripComponent,
  ],
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
  private readonly sessions = inject(SessionService);
  private readonly statusBar = inject(StatusBarService);
  private readonly undo = inject(UndoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly shortcuts = inject(KeyboardShortcutsService);

  /** Reactive signal holding the current project ID. */
  projectId = signal<string>('');

  /** Reactive signal holding the project's color palette. */
  projectPalette = signal<string[]>([]);

  /** Tile size from the project settings. */
  projectTileSize = signal<number>(16);

  /** Reactive signal holding the list of sprites. */
  sprites = signal<Sprite[]>([]);

  /** Tiles of the current project. */
  tiles = signal<Tile[]>([]);

  /** ID of the currently selected tile in the left nav. */
  selectedTileId = signal<number | null>(null);

  /** ID of the currently selected frame (sprite). */
  selectedSpriteId = signal<number | null>(null);

  /** Reactive signal holding the currently selected sprite data. */
  selectedSprite = signal<Sprite | null>(null);

  /** Reactive signal holding the selected palette color index. */
  selectedPaletteIndex = signal<number>(0);

  /** Reactive signal holding the selected drawing tool. */
  selectedTool = signal<DrawingTool>('brush');

  /** Reactive signal holding the current canvas zoom level. */
  zoomLevel = signal<number>(1);

  /** Reactive signal holding the decoded palette indices for the canvas. */
  paletteIndices = signal<number[][] | null>(null);
  /** Palette indices snapshot before the current stroke, used for undo. */
  private previousIndices: number[][] | null = null;

  /** @internal Handle of the scheduled trailing save timer (null when idle). */
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /** @internal Payload waiting to be persisted once drawing pauses. */
  private pendingSave: { spriteId: number; indices: number[][]; pixelData: string } | null = null;

  /** Computed signal deriving the selected color index (palette index + 1). */
  readonly selectedColorIndex = computed(() => this.selectedPaletteIndex() + 1);

  /** Tiles that have at least one sprite, sorted by name. */
  readonly tilesWithSprites = computed(() =>
    this.tiles()
      .filter((t) => t.spriteIds.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  /** The tile that owns the currently selected sprite. */
  readonly currentTile = computed(() => {
    const tileId = this.selectedTileId();
    if (tileId === null) return null;
    return this.tiles().find((t) => t.id === tileId) ?? null;
  });

  /** Ordered frames (sprites) belonging to the current tile. */
  readonly currentFrames = computed(() => {
    const tile = this.currentTile();
    if (!tile) return [];
    const spritesById = new Map(this.sprites().map((s) => [s.id, s]));
    return tile.spriteIds.map((id) => spritesById.get(id)).filter((s): s is Sprite => !!s);
  });

  /** Whether previous-frame onion skin is enabled. */
  readonly onionSkinPrevEnabled = signal(false);

  /** Whether next-frame onion skin is enabled. */
  readonly onionSkinNextEnabled = signal(false);

  /** Opacity of the previous-frame onion skin (0–1). */
  readonly onionSkinPrevOpacity = signal(0.35);

  /** Opacity of the next-frame onion skin (0–1). */
  readonly onionSkinNextOpacity = signal(0.35);

  /** Computed pixel data for the previous frame onion skin, or null. */
  readonly onionSkinPrevData = computed(() => {
    const frames = this.currentFrames();
    const selectedId = this.selectedSpriteId();
    const idx = frames.findIndex((f) => f.id === selectedId);
    return frames[idx - 1]?.pixelData ?? null;
  });

  /** Computed pixel data for the next frame onion skin, or null. */
  readonly onionSkinNextData = computed(() => {
    const frames = this.currentFrames();
    const selectedId = this.selectedSpriteId();
    const idx = frames.findIndex((f) => f.id === selectedId);
    return frames[idx + 1]?.pixelData ?? null;
  });

  /** Whether the current tile has a frame before the selected sprite. */
  hasPrevFrame(): boolean {
    const frames = this.currentFrames();
    const selectedId = this.selectedSpriteId();
    const idx = frames.findIndex((f) => f.id === selectedId);
    return idx > 0;
  }

  /** Whether the current tile has a frame after the selected sprite. */
  hasNextFrame(): boolean {
    const frames = this.currentFrames();
    const selectedId = this.selectedSpriteId();
    const idx = frames.findIndex((f) => f.id === selectedId);
    return idx >= 0 && idx < frames.length - 1;
  }

  /** Whether the animation preview is playing. */
  readonly previewPlaying = signal(false);
  private previewTimer: ReturnType<typeof setInterval> | null = null;
  private previewFrameIndex = 0;

  /** Effect pushing the current editor state into the app-wide status bar context. */
  readonly statusBarEffect = effect(() => {
    const sprite = this.selectedSprite();
    if (!sprite) {
      const count = this.sprites().length;
      this.statusBar.setContext(`${count} sprite${count === 1 ? '' : 's'}`);
      return;
    }
    const tool = TOOL_LABELS[this.selectedTool()];
    const colorNumber = this.selectedPaletteIndex() + 1;
    const zoom = this.zoomLevel();
    const zoomPercent = `${Math.round(zoom * 100)}%`;
    const frames = this.currentFrames();
    const frameIdx = frames.findIndex((f) => f.id === sprite.id);
    const frameStr = frames.length > 0 ? ` | Frame ${frameIdx + 1}/${frames.length}` : '';
    this.statusBar.setContext(
      `${sprite.name} | ${sprite.width}×${sprite.height} px | ${tool} | Color #${colorNumber} | Zoom ${zoomPercent}${frameStr}`,
    );
  });

  constructor() {
    this.shortcuts.shortcuts
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => this.onShortcut(id));
  }

  /** Initializes component, subscribing to route params to load project data. */
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
        await this.loadTiles();
        const sprite = await this.spriteService.getSprite(Number(raw));
        if (!sprite) {
          this.notification.error('Sprite not found');
          return;
        }
        this.selectedTileId.set(sprite.tileId);
        await this.selectSprite(sprite.id);
      } catch (e) {
        console.error('Failed to load sprite:', e);
        this.notification.error('Failed to load sprite');
      }
    });
  }

  /**
   * Handles a global keyboard shortcut.
   * @param id - The shortcut that was pressed.
   */
  onShortcut(id: ShortcutId): void {
    switch (id) {
      case 'undo':
        this.undo.undo();
        break;
      case 'redo':
        this.undo.redo();
        break;
      case 'delete': {
        const frameId = this.selectedSpriteId();
        if (frameId !== null) {
          void this.onDeleteFrame(frameId);
        }
        break;
      }
      case 'save':
        void this.flushPersist();
        this.notification.success('Sprite saved');
        break;
      case 'tool.brush':
        this.selectedTool.set('brush');
        break;
      case 'tool.eraser':
        this.selectedTool.set('eraser');
        break;
      case 'tool.fill':
        this.selectedTool.set('fill');
        break;
      default:
        break;
    }
  }

  /** Loads the project's color palette from the project service. */
  async loadProjectPalette() {
    try {
      const project = await this.projectService.getById(this.projectId());
      this.projectPalette.set(project?.palette ?? []);
      this.projectTileSize.set(project?.tileSize ?? 16);
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

  /** Loads all tiles of the project. */
  async loadTiles(): Promise<void> {
    try {
      this.tiles.set(await this.tileService.getTiles(this.projectId()));
    } catch (e) {
      this.notification.error('Failed to load tiles');
      console.error(e);
    }
  }

  /**
   * Selects a tile in the left nav and loads its first frame.
   * @param tileId - The tile to select.
   */
  async selectTile(tileId: number): Promise<void> {
    this.stopPlayback();
    this.selectedTileId.set(tileId);
    const tile = this.tiles().find((t) => t.id === tileId);
    if (tile && tile.spriteIds.length > 0) {
      await this.selectSprite(tile.spriteIds[0]);
    } else {
      await this.flushPersist();
      this.selectedSpriteId.set(null);
      this.selectedSprite.set(null);
      this.paletteIndices.set(null);
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

      if (sprite) {
        this.selectedTileId.set(sprite.tileId);
      }

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
      void this.sessions.updateSession(this.projectId(), { lastSpriteId: spriteId });
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

  /** Captures the pixel state before a stroke begins, for undo. */
  onStrokeStart(): void {
    const current = this.paletteIndices();
    if (current) {
      this.previousIndices = current.map((row) => [...row]);
    }
  }

  /** Pushes an undo action when a stroke ends. */
  onStrokeEnd(finalIndices: number[][]): void {
    if (!this.previousIndices) return;
    const sprite = this.selectedSprite();
    if (!sprite) return;

    const previous = this.previousIndices;
    this.previousIndices = null;
    const svc = this.spriteService;
    const palette = this.projectPalette();
    const selIndices = this.paletteIndices;
    const selSprite = this.selectedSprite;

    this.undo.push({
      label: 'Draw pixels',
      execute() {
        const pd = svc.encodePixelData(finalIndices, palette);
        selIndices.set(finalIndices.map((r) => [...r]));
        selSprite.update((s) =>
          s ? { ...s, paletteIndices: finalIndices.map((r) => [...r]), pixelData: pd } : null,
        );
      },
      undo() {
        const pd = svc.encodePixelData(previous, palette);
        selIndices.set(previous.map((r) => [...r]));
        selSprite.update((s) =>
          s ? { ...s, paletteIndices: previous.map((r) => [...r]), pixelData: pd } : null,
        );
      },
    });
  }

  /**
   * @internal Stores the payload and (re)starts the 250 ms trailing timer.
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
   * @internal Writes the pending payload to IndexedDB immediately (no-op when empty).
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

  /** Adds a new blank frame to the current tile. */
  async onAddFrame(): Promise<void> {
    const tile = this.currentTile();
    if (!tile) return;
    try {
      const frameNum = tile.spriteIds.length + 1;
      const newSprite = await this.spriteService.createSprite(
        this.projectId(),
        `${tile.name} ${frameNum}`,
        tile.id,
        this.projectTileSize(),
        this.projectTileSize(),
      );
      const newSpriteIds = [...tile.spriteIds, newSprite.id];
      const newType = newSpriteIds.length > 1 ? 'animated' : tile.type;
      await this.tileService.updateTile(tile.id, { spriteIds: newSpriteIds, type: newType });
      await this.loadSprites();
      await this.loadTiles();
      await this.selectSprite(newSprite.id);
    } catch (e) {
      this.notification.error('Failed to add frame');
      console.error(e);
    }
  }

  /** Deletes a frame from the current tile and selects an adjacent frame. */
  async onDeleteFrame(frameId: number): Promise<void> {
    const tile = this.currentTile();
    if (!tile || tile.spriteIds.length <= 1) return;
    try {
      const idx = tile.spriteIds.indexOf(frameId);
      const newSpriteIds = tile.spriteIds.filter((id) => id !== frameId);
      const newType = newSpriteIds.length > 1 ? 'animated' : 'static';
      await this.tileService.updateTile(tile.id, { spriteIds: newSpriteIds, type: newType });
      await this.spriteService.deleteSprite(frameId);
      await this.loadSprites();
      await this.loadTiles();
      const adjacentIdx = Math.min(idx, newSpriteIds.length - 1);
      if (adjacentIdx >= 0) {
        await this.selectSprite(newSpriteIds[adjacentIdx]);
      }
    } catch (e) {
      this.notification.error('Failed to delete frame');
      console.error(e);
    }
  }

  /** Duplicates a frame and appends it after the original. */
  async onDuplicateFrame(frameId: number): Promise<void> {
    const tile = this.currentTile();
    if (!tile) return;
    try {
      const original = await this.spriteService.getSprite(frameId);
      if (!original) return;
      const newSprite = await this.spriteService.createSprite(
        this.projectId(),
        `${original.name} copy`,
        tile.id,
        original.width,
        original.height,
      );
      await this.spriteService.updateSprite(newSprite.id, {
        paletteIndices: original.paletteIndices
          ? original.paletteIndices.map((r) => [...r])
          : undefined,
        pixelData: original.pixelData,
      });
      const idx = tile.spriteIds.indexOf(frameId);
      const newSpriteIds = [...tile.spriteIds];
      newSpriteIds.splice(idx + 1, 0, newSprite.id);
      await this.tileService.updateTile(tile.id, { spriteIds: newSpriteIds });
      await this.loadSprites();
      await this.selectSprite(newSprite.id);
    } catch (e) {
      this.notification.error('Failed to duplicate frame');
      console.error(e);
    }
  }

  /** Reorders a frame within the current tile's spriteIds array. */
  async onFrameReorder(fromIndex: number, toIndex: number): Promise<void> {
    const tile = this.currentTile();
    if (!tile) return;
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= tile.spriteIds.length) return;
    if (toIndex < 0 || toIndex >= tile.spriteIds.length) return;
    try {
      const newSpriteIds = [...tile.spriteIds];
      const [moved] = newSpriteIds.splice(fromIndex, 1);
      newSpriteIds.splice(toIndex, 0, moved);
      await this.tileService.updateTile(tile.id, { spriteIds: newSpriteIds });
      await this.loadTiles();
    } catch (e) {
      this.notification.error('Failed to reorder frame');
      console.error(e);
    }
  }

  /**
   * Updates the current tile's type and refreshes local state.
   * @param type The new tile type.
   */
  async onUpdateTileType(type: 'static' | 'animated'): Promise<void> {
    const tile = this.currentTile();
    if (!tile || tile.type === type) return;
    try {
      await this.tileService.updateTile(tile.id, { type });
      await this.loadTiles();
    } catch (e) {
      this.notification.error('Failed to update tile type');
      console.error(e);
    }
  }

  /**
   * Updates the current tile's animation speed and refreshes local state.
   * @param speed Target speed in frames per second.
   */
  async onUpdateAnimationSpeed(speed: number): Promise<void> {
    const tile = this.currentTile();
    if (!tile) return;
    const clamped = Math.max(1, Math.min(60, speed));
    if (tile.animationSpeed === clamped) return;
    try {
      await this.tileService.updateTile(tile.id, { animationSpeed: clamped });
      await this.loadTiles();
    } catch (e) {
      this.notification.error('Failed to update animation speed');
      console.error(e);
    }
  }

  /** Toggles animation preview playback for the current tile's frames. */
  togglePlayback(): void {
    if (this.previewPlaying()) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  private startPlayback(): void {
    const frames = this.currentFrames();
    const tile = this.currentTile();
    if (frames.length < 2 || !tile) return;
    this.previewPlaying.set(true);
    this.previewFrameIndex = 0;
    const interval = 1000 / tile.animationSpeed;
    this.previewTimer = setInterval(() => {
      this.previewFrameIndex = (this.previewFrameIndex + 1) % frames.length;
      this.selectSprite(frames[this.previewFrameIndex].id);
    }, interval);
  }

  private stopPlayback(): void {
    this.previewPlaying.set(false);
    if (this.previewTimer) {
      clearInterval(this.previewTimer);
      this.previewTimer = null;
    }
  }
}
