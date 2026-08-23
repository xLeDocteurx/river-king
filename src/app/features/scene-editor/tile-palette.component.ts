import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { Tile } from '../../shared/models/tile.model';

/**
 * Displays a palette of project tiles for selection.
 * Shows the tile's first-frame thumbnail when available, falling back to a palette color.
 */
@Component({
  selector: 'rk-tile-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tile-palette.component.html',
  styleUrl: './tile-palette.component.scss',
})
export class TilePaletteComponent {
  /** List of tiles available for placement. */
  tiles = input<Tile[]>([]);
  /** Project palette colors used for visual representation. */
  palette = input<string[]>([]);
  /** Id of the currently selected tile. */
  selectedTileId = input<number | null>(null);
  /** Image sources (data URIs) per tile id, used as real previews. */
  tileImages = input<Record<number, string>>({});
  /** Emitted when a tile is selected. */
  tileSelect = output<number>();

  /**
   * Returns a color hex value for a given tile id.
   * Cycles through the project palette.
   * @param tileId The tile id to get a color for.
   * @returns A CSS hex color string.
   */
  getTileColor(tileId: number): string {
    const colors = this.palette();
    if (colors.length === 0) return '#94b0c2';
    return colors[tileId % colors.length];
  }
}
