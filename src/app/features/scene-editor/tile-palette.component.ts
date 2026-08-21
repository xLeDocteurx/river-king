import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

/**
 * Displays a palette of available tiles for selection.
 */
@Component({
  selector: 'rk-tile-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tile-palette.component.html',
  styleUrl: './tile-palette.component.scss',
})
export class TilePaletteComponent {
  /** Id of the project this palette belongs to. */
  projectId = input.required<string>();
  /** Id of the currently selected tile. */
  selectedTileId = input<number | null>(null);
  /** List of available tile ids to display. */
  availableTiles = input<number[]>([0, 1, 2, 3, 4, 5, 6, 7]);
  /** Emitted when a tile is selected. */
  tileSelect = output<number>();

  /**
   * Returns a color hex value for a given tile id.
   * @param tileId The tile id to get a color for.
   * @returns A CSS hex color string.
   */
  getTileColor(tileId: number): string {
    const colors = [
      '#FF004D',
      '#FFA300',
      '#FFEC27',
      '#00E436',
      '#29ADFF',
      '#83769C',
      '#FF77A8',
      '#FFCCAA',
    ];
    return colors[tileId % colors.length];
  }
}
