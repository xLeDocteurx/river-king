import {
  Component,
  DestroyRef,
  inject,
  signal,
  OnInit,
  ChangeDetectionStrategy,
  viewChild,
  effect,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TileService } from './services/tile.service';
import { TileSpritesService } from './services/tile-sprites.service';
import { ProjectService } from '../../features/dashboard/services/project.service';
import { TileListTreeComponent } from './list/tile-list-tree.component';
import { TilePropertiesComponent } from './properties/tile-properties.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from '../../core/services/notification.service';
import { SessionService } from '../../core/services/session.service';
import { StatusBarService } from '../../core/services/status-bar.service';
import type { Tile } from '../../shared/models/tile.model';

/**
 * Tile manager page component.
 *
 * Displays a split-pane layout with a tile list on the left
 * and a properties editor on the right. Handles tile CRUD
 * operations backed by IndexedDB via {@link TileService}.
 */
@Component({
  selector: 'rk-tile-manager',
  standalone: true,
  providers: [TileService, TileSpritesService],
  imports: [TileListTreeComponent, TilePropertiesComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tile-manager.component.html',
  styleUrl: './tile-manager.component.scss',
})
export class TileManagerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tileService = inject(TileService);
  private readonly tileSpritesService = inject(TileSpritesService);
  private readonly projectService = inject(ProjectService);
  private readonly sessions = inject(SessionService);
  private readonly notification = inject(NotificationService);
  private readonly statusBar = inject(StatusBarService);
  private readonly destroyRef = inject(DestroyRef);

  /** Reference to the confirm-dialog component for programmatic open/close. */
  private readonly confirmDialog = viewChild.required(ConfirmDialogComponent);

  /** ID of the currently loaded project. */
  projectId = signal<string>('');

  /** Tile size in pixels (loaded from project). */
  tileSize = signal<number>(16);

  /** Project palette hex colors (loaded from project). */
  palette = signal<string[]>([]);

  /** List of tiles belonging to the current project. */
  tiles = signal<Tile[]>([]);

  /** ID of the tile currently selected in the list. */
  selectedTileId = signal<number | null>(null);

  /** Full tile object for the selected tile (null if none selected). */
  selectedTile = signal<Tile | null>(null);

  /** ID of the tile pending deletion (null when no deletion requested). */
  tileToDelete = signal<number | null>(null);

  /** Distinct folder paths for the current project. */
  folders = signal<string[]>([]);

  /** Collapsed folder paths in the tree view. */
  collapsedFolders = signal<string[]>([]);



  /** Static configuration data passed to the confirmation dialog. */
  readonly deleteDialogData: ConfirmDialogData = {
    title: 'Delete Tile',
    message: 'Are you sure you want to delete this tile? This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };

  constructor() {
    effect(() => {
      const id = this.tileToDelete();
      if (id !== null) {
        this.confirmDialog().open();
      }
    });

    // Reload dependent data when the sprite state service reports a mutation.
    effect(() => {
      const version = this.tileSpritesService.mutationVersion();
      if (version === 0) return;
      void this.reloadAfterSpriteMutation();
    });

    // Push contextual info to the status bar.
    effect(() => {
      const selected = this.selectedTile();
      const count = this.tiles().length;
      if (!selected) {
        this.statusBar.setContext(`${count} tile${count === 1 ? '' : 's'}`);
        return;
      }
      const frameCount = selected.spriteIds.length;
      const blocking = selected.properties.blocking ? 'Blocking' : 'Passable';
      this.statusBar.setContext(
        `${selected.name} | ${selected.type} | ${blocking} | ${frameCount} frame${frameCount === 1 ? '' : 's'}`,
      );
    });
  }

  /** Reads the project ID from the parent route and loads tiles + project settings. */
  ngOnInit() {
    this.route.parent?.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.projectId.set(id);
        this.loadProject().then(() => {
          void this.loadTiles();
          void this.loadFolders();
        });
      }
    });

    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const raw = params['tileId'];
      if (raw === undefined || raw === null) return;
      const tileId = Number(raw);
      if (Number.isFinite(tileId) && tileId !== this.selectedTileId()) {
        void this.restoreSelection(tileId);
      }
    });
  }

  /**
   * Loads the project so palette and tileSize are available for the editor.
   * @returns Promise that resolves when the project is loaded.
   */
  async loadProject(): Promise<void> {
    try {
      const project = await this.projectService.getById(this.projectId());
      if (project) {
        this.tileSize.set(project.tileSize);
        this.palette.set(project.palette);
      }
    } catch (e) {
      this.notification.error('Failed to load project');
      console.error(e);
    }
  }

  /**
   * Loads all tiles for the current project.
   * @returns Promise that resolves when tiles are loaded.
   */
  async loadTiles(): Promise<void> {
    try {
      const tiles = await this.tileService.getTiles(this.projectId());
      this.tiles.set(tiles);
    } catch (e) {
      this.notification.error('Failed to load tiles');
      console.error(e);
    }
  }

  /**
   * Loads distinct folder paths for the current project.
   * @returns Promise that resolves when folders are loaded.
   */
  async loadFolders(): Promise<void> {
    try {
      const folders = await this.tileService.getFolders(this.projectId());
      this.folders.set(folders);
    } catch (e) {
      this.notification.error('Failed to load folders');
      console.error(e);
    }
  }

  /**
   * Handles tile drag-and-drop folder changes.
   * @param event - Contains tileId and the new folderPath.
   */
  async onTileFolderChange(event: { tileId: number; folderPath: string }): Promise<void> {
    try {
      await this.tileService.updateTileFolder(event.tileId, event.folderPath);
      await this.loadTiles();
      await this.loadFolders();
    } catch (e) {
      console.error('Failed to move tile:', e);
      this.notification.error('Failed to move tile');
    }
  }

  /**
   * Toggles a folder's collapsed state in the tree view.
   * @param path - The folder path to toggle.
   */
  toggleFolder(path: string): void {
    this.collapsedFolders.update((list) => (list.includes(path) ? list.filter((p) => p !== path) : [...list, path]));
  }

  /**
   * Creates a folder locally and persists it to both local state and service.
   * @param name - The name of the new folder.
   */
  onCreateFolder(name: string): void {
    this.folders.update((list) => [...list, name].sort((a, b) => a.localeCompare(b)));
  }

  /**
   * Moves all tiles from one folder into another (nested).
   * Updates folderPath for direct members and all nested sub-folders.
   * @param event Object containing fromKey and toKey folder paths.
   */
  async onFolderMove(event: { fromKey: string; toKey: string }): Promise<void> {
    const from = event.fromKey;
    const to = event.toKey;
    if (!from || from === to) return;
    const prefix = from + '/';
    const newPrefix = to ? to + '/' + from : from;
    const tilesToUpdate = this.tiles().filter(
      (t) => (t.folderPath || '') === from || (t.folderPath || '').startsWith(prefix),
    );
    try {
      for (const tile of tilesToUpdate) {
        const oldPath = tile.folderPath || '';
        const newPath = oldPath === from ? newPrefix : oldPath.replace(from, newPrefix);
        await this.tileService.updateTileFolder(tile.id, newPath);
      }
      await this.loadTiles();
      await this.loadFolders();
    } catch (e) {
      console.error('Failed to move folder:', e);
      this.notification.error('Failed to move folder');
    }
  }

  /**
   * Selects a tile by ID and fetches its details plus linked sprites.
   * @param tileId - The ID of the tile to select.
   * @returns Promise that resolves when the tile is loaded.
   */
  async selectTile(tileId: number): Promise<void> {
    try {
      this.selectedTileId.set(tileId);
      const tile = await this.tileService.getTile(tileId);
      this.selectedTile.set(tile ?? null);
      await this.tileSpritesService.loadForTile(tileId);
      void this.sessions.updateSession(this.projectId(), { lastTileId: tileId });
      if (this.route.snapshot.paramMap.get('tileId') !== String(tileId)) {
        void this.router.navigate(['/project', this.projectId(), 'tiles', tileId]);
      }
    } catch (e) {
      this.notification.error('Failed to load tile');
      console.error(e);
    }
  }

  /**
   * @internal Restores the selected tile after navigation or refresh.
   * @param tileId - Tile id taken from the URL.
   */
  private async restoreSelection(tileId: number): Promise<void> {
    if (this.tiles().length === 0) await this.loadTiles();
    const exists = this.tiles().some((t) => t.id === tileId);
    if (!exists) {
      this.router.navigate(['/project', this.projectId(), 'tiles']);
      return;
    }
    await this.selectTile(tileId);
  }

  /**
   * @internal Reloads the tiles list and the selected tile object after the sprite
   * state service reports a frame lifecycle or size mutation.
   */
  private async reloadAfterSpriteMutation(): Promise<void> {
    try {
      await this.loadTiles();
      const id = this.selectedTileId();
      if (id !== null) {
        const tile = await this.tileService.getTile(id);
        this.selectedTile.set(tile ?? null);
      }
    } catch (e) {
      this.notification.error('Failed to refresh tiles');
      console.error(e);
    }
  }

  /**
   * Creates a new tile together with its first blank frame ("frame 1"),
   * refreshes the list and selects the new tile.
   * @returns Promise that resolves when the tile is ready.
   */
  async createTile(): Promise<void> {
    try {
      const tile = await this.tileService.createTile(
        this.projectId(),
        `Tile ${this.tiles().length + 1}`,
      );
      const frame = await this.tileSpritesService.createBlankFrame(
        this.projectId(),
        tile.id,
        'frame 1',
        this.tileSize(),
        this.tileSize(),
      );
      await this.tileService.updateTile(tile.id, { spriteIds: [frame.id] });
      await this.loadTiles();
      await this.selectTile(tile.id);
    } catch (e) {
      this.notification.error('Failed to create tile');
      console.error(e);
    }
  }

  /**
   * Persists tile changes and refreshes the list + selected tile.
   * @param tile - The updated tile to save.
   * @returns Promise that resolves when the save is complete.
   */
  async saveTile(tile: Tile): Promise<void> {
    try {
      await this.tileService.updateTile(tile.id, {
        name: tile.name,
        type: tile.type,
        animationSpeed: tile.animationSpeed,
        properties: tile.properties,
        spriteIds: tile.spriteIds,
      });
      await this.loadTiles();
      const updated = await this.tileService.getTile(tile.id);
      this.selectedTile.set(updated ?? null);
    } catch (e) {
      this.notification.error('Failed to save tile');
      console.error(e);
    }
  }

  /**
   * Requests deletion of a tile by setting the pending-delete signal.
   * The confirm dialog opens reactively via the constructor effect.
   * @param tileId - The ID of the tile to delete.
   */
  requestDelete(tileId: number): void {
    this.tileToDelete.set(tileId);
  }

  /**
   * Deletes the tile and clears selection if it was selected.
   * @param tileId - The ID of the tile to delete.
   * @returns Promise that resolves when deletion is complete.
   */
  async deleteTile(tileId: number): Promise<void> {
    try {
      await this.tileService.deleteTile(tileId);
      this.tileToDelete.set(null);
      if (this.selectedTileId() === tileId) {
        this.selectedTileId.set(null);
        this.selectedTile.set(null);
        this.tileSpritesService.clearSelection();
        if (this.route.snapshot.paramMap.get('tileId') !== null) {
          void this.router.navigate(['/project', this.projectId(), 'tiles']);
        }
      }
      await this.loadTiles();
    } catch (e) {
      this.notification.error('Failed to delete tile');
      console.error(e);
    }
  }
}
