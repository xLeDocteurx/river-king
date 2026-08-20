import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TileService } from '../../services/tile.service';
import { TileListComponent } from '../../components/tile-list/tile-list.component';
import { TilePropertiesComponent } from '../../components/tile-properties/tile-properties.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import type { Tile } from '../../../../shared/models/tile.model';

@Component({
  selector: 'rk-tile-manager',
  standalone: true,
  providers: [TileService],
  imports: [TileListComponent, TilePropertiesComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-h-full">
      <rk-tile-list
        class="tw-w-64 tw-shrink-0 tw-border-r tw-border-border"
        [projectId]="projectId()"
        [tiles]="tiles()"
        [selectedTileId]="selectedTileId()"
        (tileSelect)="selectTile($event)"
        (tileCreate)="createTile()"
      />
      <div class="tw-flex-1 tw-p-4 tw-overflow-auto">
        @if (selectedTile()) {
          <rk-tile-properties
            [tile]="selectedTile()!"
            (save)="saveTile($event)"
            (delete)="requestDelete($event)"
          />
        } @else {
          <div class="tw-text-muted-foreground tw-text-center tw-py-20">
            Select a tile to edit its properties
          </div>
        }
      </div>
    </div>

    @if (tileToDelete()) {
      <div
        class="tw-fixed tw-inset-0 tw-bg-black/50 tw-flex tw-items-center tw-justify-center tw-z-50"
        tabindex="0"
        (click)="tileToDelete.set(null)"
        (keydown.enter)="tileToDelete.set(null)"
        (keydown.escape)="tileToDelete.set(null)"
      >
        <rk-confirm-dialog
          class="tw-bg-card tw-rounded-lg tw-shadow-lg"
          [data]="deleteDialogData()"
          (confirmed)="deleteTile(tileToDelete()!)"
          (cancelled)="tileToDelete.set(null)"
        />
      </div>
    }
  `,
})
export class TileManagerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tileService = inject(TileService);

  projectId = signal<string>('');
  tiles = signal<Tile[]>([]);
  selectedTileId = signal<number | null>(null);
  selectedTile = signal<Tile | null>(null);
  tileToDelete = signal<number | null>(null);

  deleteDialogData = signal<ConfirmDialogData>({
    title: 'Delete Tile',
    message: 'Are you sure you want to delete this tile? This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  });

  ngOnInit() {
    this.route.parent?.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.projectId.set(id);
        this.loadTiles();
      }
    });
  }

  async loadTiles() {
    const tiles = await this.tileService.getTiles(this.projectId());
    this.tiles.set(tiles);
  }

  async selectTile(tileId: number) {
    this.selectedTileId.set(tileId);
    const tile = await this.tileService.getTile(tileId);
    this.selectedTile.set(tile ?? null);
  }

  async createTile() {
    await this.tileService.createTile(this.projectId(), `Tile ${this.tiles().length + 1}`);
    await this.loadTiles();
  }

  async saveTile(tile: Tile) {
    await this.tileService.updateTile(tile.id, {
      name: tile.name,
      type: tile.type,
      animationSpeed: tile.animationSpeed,
      properties: tile.properties,
    });
    await this.loadTiles();
    const updated = await this.tileService.getTile(tile.id);
    this.selectedTile.set(updated ?? null);
  }

  requestDelete(tileId: number) {
    this.tileToDelete.set(tileId);
  }

  async deleteTile(tileId: number) {
    await this.tileService.deleteTile(tileId);
    this.tileToDelete.set(null);
    if (this.selectedTileId() === tileId) {
      this.selectedTileId.set(null);
      this.selectedTile.set(null);
    }
    await this.loadTiles();
  }
}
