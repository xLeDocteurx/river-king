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
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TileService } from './services/tile.service';
import { TileListComponent } from './tile-list.component';
import { TilePropertiesComponent } from './tile-properties.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from '../../core/services/notification.service';
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
  providers: [TileService],
  imports: [TileListComponent, TilePropertiesComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tile-manager.component.html',
  styleUrl: './tile-manager.component.scss',
})
export class TileManagerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tileService = inject(TileService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  /** Reference to the confirm-dialog component for programmatic open/close. */
  private readonly confirmDialog = viewChild.required(ConfirmDialogComponent);

  /** ID of the currently loaded project. */
  projectId = signal<string>('');

  /** List of tiles belonging to the current project. */
  tiles = signal<Tile[]>([]);

  /** ID of the tile currently selected in the list. */
  selectedTileId = signal<number | null>(null);

  /** Full tile object for the selected tile (null if none selected). */
  selectedTile = signal<Tile | null>(null);

  /** ID of the tile pending deletion (null when no deletion requested). */
  tileToDelete = signal<number | null>(null);

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
  }

  /** Reads the project ID from the parent route and loads tiles. */
  ngOnInit() {
    this.route.parent?.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.projectId.set(id);
        this.loadTiles();
      }
    });
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
   * Selects a tile by ID and fetches its details.
   * @param tileId - The ID of the tile to select.
   * @returns Promise that resolves when the tile is loaded.
   */
  async selectTile(tileId: number): Promise<void> {
    try {
      this.selectedTileId.set(tileId);
      const tile = await this.tileService.getTile(tileId);
      this.selectedTile.set(tile ?? null);
    } catch (e) {
      this.notification.error('Failed to load tile');
      console.error(e);
    }
  }

  /**
   * Creates a new tile with a default name and refreshes the list.
   * @returns Promise that resolves when the tile is created.
   */
  async createTile(): Promise<void> {
    try {
      await this.tileService.createTile(this.projectId(), `Tile ${this.tiles().length + 1}`);
      await this.loadTiles();
      this.notification.success('Tile created');
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
      }
      await this.loadTiles();
    } catch (e) {
      this.notification.error('Failed to delete tile');
      console.error(e);
    }
  }
}
