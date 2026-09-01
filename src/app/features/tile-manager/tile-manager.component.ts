import {
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
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
import { UndoService } from '../../core/services/undo.service';
import {
  KeyboardShortcutsService,
  ShortcutId,
} from '../../core/services/keyboard-shortcuts.service';
import type { Tile } from '../../shared/models/tile.model';
import { computeCollapsedKeys, type Folder } from '../../shared/models/folder.model';

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
  private readonly undo = inject(UndoService);
  private readonly shortcuts = inject(KeyboardShortcutsService);

  /** Reference to the confirm-dialog component for programmatic open/close. */
  private readonly confirmDialog = viewChild.required(ConfirmDialogComponent);

  /** Reference to the folder deletion confirm-dialog. */
  private readonly folderDeleteDialog = viewChild.required('folderDeleteDialog', {
    read: ConfirmDialogComponent,
  });

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

  /** Folder path pending deletion confirmation (null when none pending). */
  pendingDeleteFolderPath = signal<string | null>(null);

  /** Distinct folder paths for the current project (derived + materialized rows). */
  folders = signal<string[]>([]);

  /** Materialized tile folder rows (kind='tile') for the current project. */
  folderRows = signal<Folder[]>([]);

  /** Collapsed folder paths, derived from persisted folder state. */
  collapsedFolders = computed(() => computeCollapsedKeys(this.folderRows(), this.folders()));
  /** Whether the left tile/folder tree is visible (mobile-only toggle; not persisted). */
  readonly leftPanelOpen = signal(true);

  /** Static configuration data passed to the confirmation dialog. */
  readonly deleteDialogData: ConfirmDialogData = {
    title: 'Delete Tile',
    message: 'Are you sure you want to delete this tile? This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };

  /** Data shown in the folder deletion confirmation dialog. */
  readonly folderDeleteDialogData = computed<ConfirmDialogData>(() => {
    const path = this.pendingDeleteFolderPath();
    return {
      title: 'Delete Folder',
      message: path
        ? `Are you sure you want to delete the folder "${path}"? This cannot be undone.`
        : 'Are you sure you want to delete this folder? This cannot be undone.',
      confirmLabel: 'Delete',
    };
  });

  constructor() {
    this.shortcuts.shortcuts
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => this.onShortcut(id));

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

  /**
   * Handles a global keyboard shortcut.
   * @param id - The shortcut that was pressed.
   */
  onShortcut(id: ShortcutId): void {
    switch (id) {
      case 'delete': {
        const tileId = this.selectedTileId();
        if (tileId !== null) {
          this.requestDelete(tileId);
        }
        break;
      }
      case 'save': {
        const tile = this.selectedTile();
        if (tile) {
          void this.saveTile(tile);
        }
        break;
      }
      default:
        break;
    }
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
      const project =
        this.projectService.currentProject() ??
        (await this.projectService.getById(this.projectId()));
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
      const folderRows = await this.tileService.getFolderRows(this.projectId());
      this.folders.set(folders);
      this.folderRows.set(folderRows);
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
    const oldPath = this.tiles().find((t) => t.id === event.tileId)?.folderPath ?? '';
    if (oldPath === event.folderPath) return;
    try {
      await this.tileService.updateTileFolder(event.tileId, event.folderPath);
      await this.loadTiles();
      await this.loadFolders();
      this.undo.push({
        label: 'Move tile',
        execute: async () => {
          try {
            await this.tileService.updateTileFolder(event.tileId, event.folderPath);
            await this.loadTiles();
            await this.loadFolders();
          } catch (e) {
            this.notification.error('Failed to move tile');
            console.error(e);
          }
        },
        undo: async () => {
          try {
            await this.tileService.updateTileFolder(event.tileId, oldPath);
            await this.loadTiles();
            await this.loadFolders();
          } catch (e) {
            this.notification.error('Failed to move tile');
            console.error(e);
          }
        },
      });
    } catch (e) {
      console.error('Failed to move tile:', e);
      this.notification.error('Failed to move tile');
    }
  }

  /**
   * Toggles a folder's collapsed state and persists it to the tile folder rows.
   * @param path - The folder path to toggle.
   * @returns Promise that resolves when the folder state is persisted and folders reloaded.
   */
  async toggleFolder(path: string): Promise<void> {
    try {
      const collapsed = !this.collapsedFolders().includes(path);
      await this.tileService.upsertFolderState(this.projectId(), path, {
        collapsed,
        lastOpenedAt: Date.now(),
      });
      await this.loadFolders();
    } catch (e) {
      this.notification.error('Failed to update folder state');
      console.error(e);
    }
  }

  /**
   * Creates a folder, materializing a tile folder row and reloading folders.
   * @param name - The name of the new folder.
   * @returns Promise that resolves when the folder is created and folders reloaded.
   */
  async onCreateFolder(name: string): Promise<void> {
    try {
      await this.tileService.upsertFolderState(this.projectId(), name, {});
      await this.loadFolders();
      this.undo.push({
        label: 'Create folder',
        execute: async () => {
          await this.tileService.upsertFolderState(this.projectId(), name, {});
          await this.loadFolders();
        },
        undo: async () => {
          await this.tileService.deleteTileFolders(this.projectId(), name);
          await this.loadFolders();
        },
      });
    } catch (e) {
      this.notification.error('Failed to create the folder');
      console.error(e);
    }
  }

  /**
   * Requests deletion of an empty folder, opening the confirmation dialog.
   * Blocks folders whose tree still contains tiles with a notification.
   * @param path The folder path the user wants to delete.
   */
  onFolderDeleteRequest(path: string): void {
    const hasTiles = this.tiles().some(
      (t) => (t.folderPath ?? '') === path || (t.folderPath ?? '').startsWith(path + '/'),
    );
    if (hasTiles) {
      this.notification.warning(`Folder "${path}" is not empty and cannot be deleted.`);
      return;
    }
    this.pendingDeleteFolderPath.set(path);
    this.folderDeleteDialog().open();
  }

  /**
   * Deletes the pending folder (and any empty descendant folders) from the list
   * and its materialized tile folder rows, after user confirmation.
   * @returns Promise that resolves when the folder is deleted and folders reloaded.
   */
  async onConfirmFolderDelete(): Promise<void> {
    const path = this.pendingDeleteFolderPath();
    if (!path) return;
    this.pendingDeleteFolderPath.set(null);
    try {
      await this.tileService.deleteTileFolders(this.projectId(), path);
      await this.loadFolders();
    } catch (e) {
      this.notification.error('Failed to delete the folder');
      console.error(e);
    }
  }

  /**
   * Renames a folder, relocating every tile inside it (including nested
   * sub-folders) to the new path.
   * @param event The rename request emitted by the tile list tree.
   */
  async onFolderRename(event: { fromKey: string; toKey: string }): Promise<void> {
    const { fromKey, toKey } = event;
    if (!fromKey || fromKey === toKey) return;
    if (this.folders().includes(toKey)) {
      this.notification.warning('A folder with that name already exists.');
      return;
    }
    try {
      await this.tileService.renameFolder(this.projectId(), fromKey, toKey);
      await this.loadTiles();
      await this.loadFolders();
      this.notification.success('Folder renamed');
    } catch (e) {
      console.error('Failed to rename folder:', e);
      this.notification.error('Failed to rename the folder.');
    }
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
    const moves = tilesToUpdate.map((tile) => ({
      tileId: tile.id,
      oldPath: tile.folderPath || '',
      newPath:
        (tile.folderPath || '') === from
          ? newPrefix
          : (tile.folderPath || '').replace(from, newPrefix),
    }));
    try {
      for (const tile of tilesToUpdate) {
        const oldPath = tile.folderPath || '';
        const newPath = oldPath === from ? newPrefix : oldPath.replace(from, newPrefix);
        await this.tileService.updateTileFolder(tile.id, newPath);
      }
      await this.tileService.rewriteFolderRows(this.projectId(), from, newPrefix);
      await this.loadTiles();
      await this.loadFolders();
      this.undo.push({
        label: 'Move folder',
        execute: async () => {
          try {
            for (const m of moves) await this.tileService.updateTileFolder(m.tileId, m.newPath);
            await this.tileService.rewriteFolderRows(this.projectId(), from, newPrefix);
            await this.loadTiles();
            await this.loadFolders();
          } catch (e) {
            console.error('Failed to move folder:', e);
          }
        },
        undo: async () => {
          try {
            for (const m of moves) await this.tileService.updateTileFolder(m.tileId, m.oldPath);
            await this.tileService.rewriteFolderRows(this.projectId(), newPrefix, from);
            await this.loadTiles();
            await this.loadFolders();
          } catch (e) {
            console.error('Failed to move folder:', e);
          }
        },
      });
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
      if (tile?.folderPath) {
        await this.tileService.upsertFolderState(this.projectId(), tile.folderPath, {
          lastOpenedAt: Date.now(),
        });
        await this.loadFolders();
      }
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
      this.undo.push({
        label: 'Create tile',
        execute: async () => {
          try {
            await this.tileService.restoreTile(tile, [frame]);
            await this.loadTiles();
            await this.selectTile(tile.id);
          } catch (e) {
            this.notification.error('Failed to create tile');
            console.error(e);
          }
        },
        undo: async () => {
          try {
            await this.tileService.deleteTile(tile.id);
            await this.loadTiles();
          } catch (e) {
            this.notification.error('Failed to create tile');
            console.error(e);
          }
        },
      });
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
      const previous = await this.tileService.getTile(tile.id);
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
      if (!previous) return;
      this.undo.push({
        label: 'Edit tile',
        execute: async () => {
          try {
            await this.tileService.updateTile(tile.id, {
              name: tile.name,
              type: tile.type,
              animationSpeed: tile.animationSpeed,
              properties: tile.properties,
              spriteIds: tile.spriteIds,
            });
            const applied = await this.tileService.getTile(tile.id);
            this.selectedTile.set(applied ?? null);
          } catch (e) {
            this.notification.error('Failed to save tile');
            console.error(e);
          }
        },
        undo: async () => {
          try {
            await this.tileService.updateTile(tile.id, {
              name: previous.name,
              type: previous.type,
              animationSpeed: previous.animationSpeed,
              properties: previous.properties,
              spriteIds: previous.spriteIds,
            });
            const restored = await this.tileService.getTile(tile.id);
            this.selectedTile.set(restored ?? null);
          } catch (e) {
            this.notification.error('Failed to save tile');
            console.error(e);
          }
        },
      });
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
      const tile = await this.tileService.getTile(tileId);
      const sprites = await this.tileService.getSpritesForTile(tileId);
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
      if (!tile) return;
      this.undo.push({
        label: 'Delete tile',
        execute: async () => {
          try {
            await this.tileService.deleteTile(tileId);
            await this.loadTiles();
          } catch (e) {
            this.notification.error('Failed to redo delete tile');
            console.error(e);
          }
        },
        undo: async () => {
          try {
            await this.tileService.restoreTile(tile, sprites);
            await this.loadTiles();
          } catch (e) {
            this.notification.error('Failed to undo delete tile');
            console.error(e);
          }
        },
      });
    } catch (e) {
      this.notification.error('Failed to delete tile');
      console.error(e);
    }
  }
}
