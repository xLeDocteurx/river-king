import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { Tile } from '../../../shared/models/tile.model';

/**
 * Tile list sidebar component.
 *
 * Displays the tiles for the current project and emits
 * selection and creation events to the parent.
 */
@Component({
  selector: 'rk-tile-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tile-list.component.html',
  styleUrl: './tile-list.component.scss',
})
export class TileListComponent {
  /** Tiles to render in the list. */
  tiles = input.required<Tile[]>();

  /** ID of the currently selected tile (used for highlight styling). */
  selectedTileId = input<number | null>(null);

  /** Emitted when a tile is clicked. */
  tileSelect = output<number>();

  /** Emitted when the light per-row delete button is clicked. */
  tileDelete = output<number>();

  /** Emitted when the add-tile button is clicked. */
  tileCreate = output<void>();
}
