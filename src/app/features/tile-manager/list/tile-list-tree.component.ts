import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { GroupedListComponent } from '../../../shared/components/grouped-list/grouped-list.component';
import type { Tile } from '../../../shared/models/tile.model';

/**
 * Displays tiles grouped by folderPath with drag-and-drop support.
 * Uses {@link GroupedListComponent} with indented groups for visual nesting.
 */
@Component({
  selector: 'rk-tile-list-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GroupedListComponent],
  templateUrl: './tile-list-tree.component.html',
  styleUrl: './tile-list-tree.component.scss',
})
export class TileListTreeComponent {
  tiles = input.required<Tile[]>();
  folders = input<string[]>([]);
  selectedTileId = input<number | null>(null);
  collapsedFolders = input<string[]>([]);

  tileSelect = output<number>();
  tileDelete = output<number>();
  tileCreate = output<void>();
  createFolder = output<string>();
  folderChange = output<{ tileId: number; folderPath: string }>();
  folderMove = output<{ fromKey: string; toKey: string }>();
  toggleFolder = output<string>();

  groupByFolderPath = (tile: Tile) => tile.folderPath || '';

  onTileSelect(id: string | number): void {
    this.tileSelect.emit(Number(id));
  }

  onTileDelete(id: string | number): void {
    this.tileDelete.emit(Number(id));
  }

  onTileFolderChange(event: { itemId: string | number; groupKey: string }): void {
    this.folderChange.emit({ tileId: Number(event.itemId), folderPath: event.groupKey });
  }

  onGroupMove(event: { fromKey: string; toKey: string }): void {
    this.folderMove.emit(event);
  }
}
