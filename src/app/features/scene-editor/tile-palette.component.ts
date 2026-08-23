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

}
