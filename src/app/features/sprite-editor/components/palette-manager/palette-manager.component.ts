import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

/**
 * Palette manager component for selecting colors from the project palette.
 *
 * Renders a grid of color swatches and emits the selected index when clicked.
 */
@Component({
  selector: 'rk-palette-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './palette-manager.component.html',
  styleUrl: './palette-manager.component.scss',
})
export class PaletteManagerComponent {
  /** Required array of hex color strings representing the palette. */
  palette = input.required<string[]>();

  /** Required index of the currently selected color. */
  selectedIndex = input.required<number>();

  /** Emits the newly selected color index when a swatch is clicked. */
  selectedIndexChange = output<number>();

  /**
   * Selects a color by its index.
   * @param index - The index of the color to select.
   */
  selectColor(index: number) {
    this.selectedIndexChange.emit(index);
  }
}
