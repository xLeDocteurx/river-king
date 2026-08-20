import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'rk-tile-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-flex-col tw-h-full tw-bg-card tw-border-l tw-border-border tw-p-4">
      <h3 class="tw-font-semibold tw-text-foreground tw-mb-3">Tiles</h3>
      <div class="tw-flex tw-flex-wrap tw-gap-2">
        @for (tileId of availableTiles(); track tileId) {
          <button
            type="button"
            (click)="tileSelect.emit(tileId)"
            [class.tw-ring-2]="selectedTileId() === tileId"
            class="tw-w-10 tw-h-10 tw-rounded-md tw-border tw-border-border tw-transition hover:tw-border-primary"
            [style.background-color]="getTileColor(tileId)"
            title="Tile {{ tileId }}"
          ></button>
        }
      </div>
    </div>
  `,
})
export class TilePaletteComponent {
  projectId = input.required<string>();
  selectedTileId = input<number | null>(null);
  availableTiles = input<number[]>([0, 1, 2, 3, 4, 5, 6, 7]); // Placeholder tiles
  tileSelect = output<number>();

  getTileColor(tileId: number): string {
    const colors = ['#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'];
    return colors[tileId % colors.length];
  }
}
