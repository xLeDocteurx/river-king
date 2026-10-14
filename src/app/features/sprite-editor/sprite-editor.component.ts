import {
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  ElementRef,
  HostListener,
  ViewChild,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SpriteService } from './services/sprite.service';
import { PixelCanvasComponent } from './canvas/pixel-canvas.component';
import { PaletteManagerComponent } from './palette/palette-manager.component';
import { DrawingToolsComponent, type DrawingTool } from './tools/drawing-tools.component';
import { FrameStripComponent } from './frame-strip/frame-strip.component';
import {
  ConfirmDialogComponent,
  type ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
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
import { clampAnchor, type TileAnchor } from '../../shared/models/tile-anchor';

/** Human-readable labels for the drawing tools, keyed by tool id. */
const TOOL_LABELS: Record<DrawingTool, string> = {
  brush: 'Brush',
  eraser: 'Eraser',
  fill: 'Fill',
  anchor: 'Anchor',
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
    ConfirmDialogComponent,
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

  /** Reference to the wrapper anchoring the onion popover (button + panel). */
  @ViewChild('onionAnchor', { static: false }) onionAnchor?: ElementRef<HTMLElement>;

  /** Reference to the dialog confirming the animated→static frame reduction. */
  private readonly framesDialog = viewChild.required<ConfirmDialogComponent>('framesDialog');

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

  /** Per-pixel collision mask of the current tile, or null when unset. */
  readonly collisionMask = signal<number[][] | null>(null);
  /** @internal Mask snapshot at stroke start, for undo/compare. */
  private previousCollisionMask: number[][] | null = null;
  /** @internal Whether the active stroke is editing the collision mask. */
  private collisionStrokeActive = false;

  /** Whether the canvas is editing the current tile's collision mask. */
  readonly collisionMode = signal(false);

  /** Reference to the pixel canvas so the toolbar can drive its grid toggle. */
  protected readonly pixelCanvasRef = viewChild(PixelCanvasComponent);

  /** Whether the pixel grid is shown (mirrored from the canvas for the toolbar). */
  readonly showGrid = computed(() => this.pixelCanvasRef()?.showGrid() ?? true);

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

  /** Ground-cell anchor of the current tile, or null when derived (bottom-center). */
  readonly tileAnchor = computed<TileAnchor | null>(() => this.currentTile()?.anchor ?? null);

  /** Whether previous-frame onion skin is enabled. */
  readonly onionSkinPrevEnabled = signal(false);

  /** Whether next-frame onion skin is enabled. */
  readonly onionSkinNextEnabled = signal(false);

  /** Opacity of the previous-frame onion skin (0–1). */
  readonly onionSkinPrevOpacity = signal(0.35);

  /** Opacity of the next-frame onion skin (0–1). */
  readonly onionSkinNextOpacity = signal(0.35);

  /** Whether the onion-skin controls popover is currently open. */
  readonly onionPanelOpen = signal(false);
  /** Whether the left tile list panel is visible (mobile-only toggle; not persisted). */
  readonly leftPanelOpen = signal(true);
  /** Whether the right palette/tools panel is visible (mobile-only toggle; not persisted). */
  readonly rightPanelOpen = signal(true);

  /** Whether an animated→static switch is awaiting frame-reduction confirmation. */
  readonly pendingStaticSwitch = signal(false);

  /** Static configuration for the frame-reduction confirmation dialog. */
  readonly framesDialogData: ConfirmDialogData = {
    title: 'Delete Frames',
    message:
      'Switching to static keeps only the first frame and permanently deletes the rest. This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };

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

  /** Opens or closes the onion-skin controls popover. */
  toggleOnionPanel(): void {
    this.onionPanelOpen.update((v) => !v);
  }

  /** Closes the onion-skin controls popover. */
  closeOnionPanel(): void {
    this.onionPanelOpen.set(false);
  }

  /**
   * Closes the onion popover when a click lands outside the button + panel.
   * @param event - The document-level mouse click event.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.onionPanelOpen()) return;
    const anchor = this.onionAnchor?.nativeElement;
    if (!anchor?.contains(event.target as Node)) {
      this.closeOnionPanel();
    }
  }

  /** Closes the onion popover when the user presses Escape. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeOnionPanel();
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
    const tool = this.collisionMode() ? 'Collision' : TOOL_LABELS[this.selectedTool()];
    const colorNumber = this.selectedPaletteIndex() + 1;
    const zoom = this.zoomLevel();
    const zoomPercent = `${Math.round(zoom * 100)}%`;
    const frames = this.currentFrames();
    const frameIdx = frames.findIndex((f) => f.id === sprite.id);
    const frameStr = frames.length > 0 ? ` | Frame ${frameIdx + 1}/${frames.length}` : '';
    const anchor = this.tileAnchor();
    const anchorSuffix =
      this.selectedTool() === 'anchor'
        ? ` | Anchor — ${anchor ? `${anchor.x}, ${anchor.y}` : 'Auto'}`
        : '';
    const colorSegment = this.collisionMode() ? '' : ` | Color #${colorNumber}`;
    this.statusBar.setContext(
      `${sprite.name} | ${sprite.width}×${sprite.height} px | ${tool}${colorSegment} | Zoom ${zoomPercent}${frameStr}${anchorSuffix}`,
    );
  });

  /** Effect opening the frame-reduction dialog when a static switch is pending. */
  private readonly framesDialogEffect = effect(() => {
    if (this.pendingStaticSwitch()) {
      this.framesDialog().open();
    }
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
      } catch {
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
      const project =
        this.projectService.currentProject() ??
        (await this.projectService.getById(this.projectId()));
      this.projectPalette.set(project?.palette ?? []);
      this.projectTileSize.set(project?.tileSize ?? 16);
    } catch {
      this.notification.error('Failed to load project');
    }
  }

  /** Loads all sprites for the current project from the sprite service. */
  async loadSprites() {
    try {
      const sprites = await this.spriteService.getSprites(this.projectId());
      this.sprites.set(sprites);
    } catch {
      this.notification.error('Failed to load sprites');
    }
  }

  /** Loads all tiles of the project. */
  async loadTiles(): Promise<void> {
    try {
      this.tiles.set(await this.tileService.getTiles(this.projectId()));
    } catch {
      this.notification.error('Failed to load tiles');
    }
  }

  /**
   * Selects a tile in the left nav and loads its first frame.
   * @param tileId - The tile to select.
   */
  async selectTile(tileId: number): Promise<void> {
    this.stopPlayback();
    this.onionPanelOpen.set(false);
    this.collisionMode.set(false);
    this.selectedTileId.set(tileId);
    this.collisionMask.set(this.tiles().find((t) => t.id === tileId)?.collisionMask ?? null);
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
      this.onionPanelOpen.set(false);
      this.collisionMode.set(false);
      this.selectedSpriteId.set(spriteId);
      const sprite = await this.spriteService.getSprite(spriteId);
      this.selectedSprite.set(sprite ?? null);

      if (sprite) {
        this.selectedTileId.set(sprite.tileId);
        this.collisionMask.set(
          this.tiles().find((t) => t.id === sprite.tileId)?.collisionMask ?? null,
        );
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
    } catch {
      this.notification.error('Failed to load sprite');
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
    } catch {
      this.notification.error('Failed to save sprite');
    }
  }

  /** Captures the pixel state before a stroke begins, for undo. */
  onStrokeStart(): void {
    if (this.collisionMode()) {
      this.collisionStrokeActive = true;
      this.previousCollisionMask = this.collisionMask()?.map((row) => [...row]) ?? null;
      return;
    }
    const current = this.paletteIndices();
    if (current) {
      this.previousIndices = current.map((row) => [...row]);
    }
  }

  /** Pushes an undo action when a stroke ends. */
  onStrokeEnd(finalIndices: number[][]): void {
    if (this.collisionMode()) {
      void this.commitCollisionMask();
      return;
    }
    if (!this.previousIndices) return;
    const sprite = this.selectedSprite();
    if (!sprite) return;

    const previous = this.previousIndices;
    this.previousIndices = null;
    const svc = this.spriteService;
    const spriteId = sprite.id;
    const palette = this.projectPalette();
    const selIndices = this.paletteIndices;
    const selSprite = this.selectedSprite;

    this.undo.push({
      label: 'Draw pixels',
      execute() {
        const grid = finalIndices.map((r) => [...r]);
        const pd = svc.encodePixelData(grid, palette);
        selIndices.set(grid);
        selSprite.update((s) => (s ? { ...s, paletteIndices: grid, pixelData: pd } : null));
        void svc.updateSprite(spriteId, { paletteIndices: grid, pixelData: pd });
      },
      undo() {
        const grid = previous.map((r) => [...r]);
        const pd = svc.encodePixelData(grid, palette);
        selIndices.set(grid);
        selSprite.update((s) => (s ? { ...s, paletteIndices: grid, pixelData: pd } : null));
        void svc.updateSprite(spriteId, { paletteIndices: grid, pixelData: pd });
      },
    });
  }

  /**
   * Records a painted collision mask from the canvas.
   * @param mask - The updated mask grid (1 = solid).
   */
  onCollisionMaskChange(mask: number[][]): void {
    this.collisionMask.set(mask.map((row) => [...row]));
  }

  /** @internal Persists the painted mask (null when full) with an undo entry. */
  private async commitCollisionMask(): Promise<void> {
    if (!this.collisionStrokeActive) return;
    this.collisionStrokeActive = false;
    const previous = this.previousCollisionMask;
    this.previousCollisionMask = null;
    const tile = this.currentTile();
    if (!tile) return;
    const next = this.storedFromMask(this.collisionMask());
    const prev = this.storedFromMask(previous);
    if (JSON.stringify(next) === JSON.stringify(prev)) return;
    try {
      await this.tileService.updateTile(tile.id, { collisionMask: next });
      this.undo.push({
        label: 'Paint collision mask',
        execute: () => void this.tileService.updateTile(tile.id, { collisionMask: next }),
        undo: () => void this.tileService.updateTile(tile.id, { collisionMask: prev }),
      });
      await this.loadTiles();
    } catch {
      this.notification.error('Failed to save the collision mask.');
    }
  }

  /**
   * Clears the current tile collision mask so it blocks its full footprint again.
   */
  async onResetCollisionMask(): Promise<void> {
    const tile = this.currentTile();
    if (!tile) return;
    const prevStored = this.storedFromMask(this.collisionMask());
    try {
      await this.tileService.updateTile(tile.id, { collisionMask: null });
      this.collisionMask.set(this.buildFullMask());
      await this.loadTiles();
      if (prevStored) {
        this.undo.push({
          label: 'Reset collision mask',
          execute: () => void this.tileService.updateTile(tile.id, { collisionMask: null }),
          undo: () => void this.tileService.updateTile(tile.id, { collisionMask: prevStored }),
        });
      }
    } catch {
      this.notification.error('Failed to reset the collision mask.');
    }
  }

  /** Toggles collision-mask painting; entering initialises a full mask. */
  toggleCollisionMode(): void {
    const next = !this.collisionMode();
    this.collisionMode.set(next);
    if (!next) return;
    if (this.selectedTool() === 'anchor') this.selectedTool.set('brush');
    if (!this.collisionMask()) this.collisionMask.set(this.buildFullMask());
  }

  /**
   * @internal A full (all-solid) mask matching the current sprite grid.
   * @returns A rows×cols grid of `1`.
   */
  private buildFullMask(): number[][] {
    const indices = this.paletteIndices();
    const rows = indices?.length ?? 0;
    const cols = rows > 0 ? Math.max(...indices!.map((row) => row.length)) : 0;
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 1));
  }

  /**
   * @internal Whether every mask cell is solid.
   * @param mask - The mask grid to inspect.
   * @returns True when no cell is empty.
   */
  private isFullMask(mask: number[][]): boolean {
    return mask.every((row) => row.every((v) => v >= 1));
  }

  /**
   * @internal Canonical stored value for a working mask: `null` when the mask is
   * full (the default footprint), otherwise the mask itself — including an
   * all-zero mask, which is persisted so a blocking tile can be made passable.
   * @param mask - The working mask, or null.
   * @returns The value to persist.
   */
  private storedFromMask(mask: number[][] | null): number[][] | null {
    return mask && !this.isFullMask(mask) ? mask : null;
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
    } catch {
      this.notification.error('Failed to save sprite');
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
      const prevSpriteIds = tile.spriteIds;
      const prevType = tile.type;
      await this.tileService.updateTile(tile.id, { spriteIds: newSpriteIds, type: newType });
      await this.loadSprites();
      await this.loadTiles();
      await this.selectSprite(newSprite.id);

      const tileId = tile.id;
      this.undo.push({
        label: 'Add frame',
        execute: async () => {
          try {
            await this.tileService.updateTile(tileId, { spriteIds: newSpriteIds, type: newType });
            await this.spriteService.restoreSprite(newSprite);
            await this.loadSprites();
            await this.loadTiles();
            await this.selectSprite(newSprite.id);
          } catch {
            this.notification.error('Failed to redo add frame');
          }
        },
        undo: async () => {
          try {
            await this.tileService.updateTile(tileId, { spriteIds: prevSpriteIds, type: prevType });
            await this.spriteService.deleteSprite(newSprite.id);
            await this.loadSprites();
            await this.loadTiles();
          } catch {
            this.notification.error('Failed to undo add frame');
          }
        },
      });
    } catch {
      this.notification.error('Failed to add frame');
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
      const deletedSprite = await this.spriteService.getSprite(frameId);
      if (!deletedSprite) return;
      const prevSpriteIds = tile.spriteIds;
      const prevType = tile.type;
      await this.tileService.updateTile(tile.id, { spriteIds: newSpriteIds, type: newType });
      await this.spriteService.deleteSprite(frameId);
      await this.loadSprites();
      await this.loadTiles();
      const adjacentIdx = Math.min(idx, newSpriteIds.length - 1);
      if (adjacentIdx >= 0) {
        await this.selectSprite(newSpriteIds[adjacentIdx]);
      }

      const tileId = tile.id;
      this.undo.push({
        label: 'Delete frame',
        execute: async () => {
          try {
            await this.tileService.updateTile(tileId, { spriteIds: newSpriteIds, type: newType });
            await this.spriteService.deleteSprite(frameId);
            await this.loadSprites();
            await this.loadTiles();
            if (adjacentIdx >= 0) await this.selectSprite(newSpriteIds[adjacentIdx]);
          } catch {
            this.notification.error('Failed to redo delete frame');
          }
        },
        undo: async () => {
          try {
            await this.tileService.updateTile(tileId, { spriteIds: prevSpriteIds, type: prevType });
            await this.spriteService.restoreSprite(deletedSprite);
            await this.loadSprites();
            await this.loadTiles();
            await this.selectSprite(frameId);
          } catch {
            this.notification.error('Failed to undo delete frame');
          }
        },
      });
    } catch {
      this.notification.error('Failed to delete frame');
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
      const newType = newSpriteIds.length > 1 ? 'animated' : tile.type;
      const prevSpriteIds = [...tile.spriteIds];
      const prevType = tile.type;
      await this.tileService.updateTile(tile.id, { spriteIds: newSpriteIds, type: newType });
      await this.loadSprites();
      await this.loadTiles();
      await this.selectSprite(newSprite.id);

      const tileId = tile.id;
      const sprite = newSprite;
      const removedId = newSprite.id;
      this.undo.push({
        label: 'Duplicate frame',
        execute: async () => {
          try {
            await this.tileService.updateTile(tileId, { spriteIds: newSpriteIds, type: newType });
            await this.spriteService.restoreSprite(sprite);
            await this.loadSprites();
            await this.loadTiles();
            await this.selectSprite(removedId);
          } catch {
            this.notification.error('Failed to redo duplicate frame');
          }
        },
        undo: async () => {
          try {
            await this.tileService.updateTile(tileId, { spriteIds: prevSpriteIds, type: prevType });
            await this.spriteService.deleteSprite(removedId);
            await this.loadSprites();
            await this.loadTiles();
            await this.selectSprite(prevSpriteIds[0]);
          } catch {
            this.notification.error('Failed to undo duplicate frame');
          }
        },
      });
    } catch {
      this.notification.error('Failed to duplicate frame');
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
      const prevSpriteIds = [...tile.spriteIds];
      const newSpriteIds = [...tile.spriteIds];
      const [moved] = newSpriteIds.splice(fromIndex, 1);
      newSpriteIds.splice(toIndex, 0, moved);
      await this.tileService.updateTile(tile.id, { spriteIds: newSpriteIds });
      await this.loadTiles();

      const tileId = tile.id;
      this.undo.push({
        label: 'Reorder frame',
        execute: async () => {
          try {
            await this.tileService.updateTile(tileId, { spriteIds: newSpriteIds });
            await this.loadTiles();
          } catch {
            this.notification.error('Failed to redo reorder frame');
          }
        },
        undo: async () => {
          try {
            await this.tileService.updateTile(tileId, { spriteIds: prevSpriteIds });
            await this.loadTiles();
          } catch {
            this.notification.error('Failed to undo reorder frame');
          }
        },
      });
    } catch {
      this.notification.error('Failed to reorder frame');
    }
  }

  /**
   * Updates the current tile's type and refreshes local state.
   * Switching an animated tile that holds several frames to `static` opens a
   * confirmation dialog first so the extra frames are reduced atomically.
   * @param type The new tile type.
   * @param select Optional select element, reset when the switch is deferred.
   */
  async onUpdateTileType(type: 'static' | 'animated', select?: HTMLSelectElement): Promise<void> {
    const tile = this.currentTile();
    if (!tile || tile.type === type) return;
    if (type === 'static' && tile.spriteIds.length > 1) {
      if (select) select.value = tile.type;
      this.pendingStaticSwitch.set(true);
      return;
    }
    try {
      const prevType = tile.type;
      await this.tileService.updateTile(tile.id, { type });
      await this.loadTiles();

      const tileId = tile.id;
      this.undo.push({
        label: 'Change tile type',
        execute: async () => {
          try {
            await this.tileService.updateTile(tileId, { type });
            await this.loadTiles();
          } catch {
            this.notification.error('Failed to redo type change');
          }
        },
        undo: async () => {
          try {
            await this.tileService.updateTile(tileId, { type: prevType });
            await this.loadTiles();
          } catch {
            this.notification.error('Failed to undo type change');
          }
        },
      });
    } catch {
      this.notification.error('Failed to update tile type');
    }
  }

  /**
   * Confirms the deferred animated→static switch by keeping the first frame
   * and deleting the rest, then records an undo entry.
   */
  async confirmStaticSwitch(): Promise<void> {
    const tile = this.currentTile();
    if (!tile) {
      this.pendingStaticSwitch.set(false);
      return;
    }
    const keepId = tile.spriteIds[0];
    const removedIds = tile.spriteIds.slice(1);
    const prevSpriteIds = [...tile.spriteIds];
    const prevType = tile.type;
    try {
      const removedSprites = (
        await Promise.all(removedIds.map((id) => this.spriteService.getSprite(id)))
      ).filter((s): s is Sprite => !!s);
      await this.tileService.updateTile(tile.id, { spriteIds: [keepId], type: 'static' });
      for (const id of removedIds) await this.spriteService.deleteSprite(id);
      await this.loadSprites();
      await this.loadTiles();
      await this.selectSprite(keepId);

      const tileId = tile.id;
      this.undo.push({
        label: 'Change tile type',
        execute: async () => {
          try {
            await this.tileService.updateTile(tileId, { spriteIds: [keepId], type: 'static' });
            for (const id of removedIds) await this.spriteService.deleteSprite(id);
            await this.loadSprites();
            await this.loadTiles();
            await this.selectSprite(keepId);
          } catch {
            this.notification.error('Failed to redo type change');
          }
        },
        undo: async () => {
          try {
            await this.tileService.updateTile(tileId, { spriteIds: prevSpriteIds, type: prevType });
            for (const sprite of removedSprites) await this.spriteService.restoreSprite(sprite);
            await this.loadSprites();
            await this.loadTiles();
            await this.selectSprite(keepId);
          } catch {
            this.notification.error('Failed to undo type change');
          }
        },
      });
    } catch {
      this.notification.error('Failed to update tile type');
    } finally {
      this.pendingStaticSwitch.set(false);
    }
  }

  /** Cancels the deferred animated→static switch (no changes applied). */
  cancelStaticSwitch(): void {
    this.pendingStaticSwitch.set(false);
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
      const prevSpeed = tile.animationSpeed;
      await this.tileService.updateTile(tile.id, { animationSpeed: clamped });
      await this.loadTiles();

      const tileId = tile.id;
      this.undo.push({
        label: 'Change animation speed',
        execute: async () => {
          try {
            await this.tileService.updateTile(tileId, { animationSpeed: clamped });
            await this.loadTiles();
          } catch {
            this.notification.error('Failed to redo speed change');
          }
        },
        undo: async () => {
          try {
            await this.tileService.updateTile(tileId, { animationSpeed: prevSpeed });
            await this.loadTiles();
          } catch {
            this.notification.error('Failed to undo speed change');
          }
        },
      });
    } catch {
      this.notification.error('Failed to update animation speed');
    }
  }

  /**
   * Persists a new ground-zone anchor for the current tile, clamped to the
   * active frame's bounds.
   * @param anchor - The anchor emitted by the pixel canvas.
   */
  async onAnchorChange(anchor: TileAnchor): Promise<void> {
    const tile = this.currentTile();
    const frame = this.selectedSprite();
    if (!tile || !frame) return;
    try {
      const clamped = clampAnchor(anchor, frame.width, frame.height, this.projectTileSize());
      await this.tileService.updateTile(tile.id, { anchor: clamped });
      await this.loadTiles();
    } catch (e) {
      console.error('Failed to save anchor:', e);
      this.notification.error('Failed to save anchor');
    }
  }

  /** Resets the current tile's anchor to the derived bottom-center position. */
  async onAutoAnchor(): Promise<void> {
    const tile = this.currentTile();
    if (!tile) return;
    try {
      await this.tileService.updateTile(tile.id, { anchor: null });
      await this.loadTiles();
    } catch (e) {
      console.error('Failed to reset anchor:', e);
      this.notification.error('Failed to save anchor');
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
