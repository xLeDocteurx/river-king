import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { CdkDropListGroup, CdkDropList, CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';
import type { Tile } from '../../../shared/models/tile.model';

/**
 * Grouped tree view of tiles with folder organisation and CDK drag-drop.
 */
@Component({
  selector: 'rk-tile-list-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag],
  templateUrl: './tile-list-tree.component.html',
  styleUrl: './tile-list-tree.component.scss',
})
export class TileListTreeComponent {
  tiles = input.required<Tile[]>();
  selectedTileId = input<number | null>(null);
  collapsedFolders = input<string[]>([]);

  tileSelect = output<number>();
  tileDelete = output<number>();
  tileCreate = output<void>();
  createFolder = output<void>();
  folderChange = output<{ tileId: number; folderPath: string }>();
  toggleFolder = output<string>();

  readonly rootTiles = computed(() => this.tiles().filter((t) => !t.folderPath));
  readonly folderGroups = computed(() => {
    const groups = new Map<string, Tile[]>();
    for (const tile of this.tiles()) {
      if (!tile.folderPath) continue;
      const list = groups.get(tile.folderPath) ?? [];
      list.push(tile);
      groups.set(tile.folderPath, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  onDrop(event: CdkDragDrop<Tile[]>, targetFolderPath: string): void {
    const tile = event.item.data as Tile;
    if (tile.folderPath !== targetFolderPath) {
      this.folderChange.emit({ tileId: tile.id, folderPath: targetFolderPath });
    }
  }
}
