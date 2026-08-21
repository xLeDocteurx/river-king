import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'rk-palette-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-flex-col tw-gap-2">
      <h3 class="tw-text-sm tw-font-semibold">Palette</h3>
      <div class="tw-flex tw-flex-wrap tw-gap-1">
        @for (color of palette(); track $index) {
          <button
            type="button"
            (click)="selectColor($index)"
            [class.tw-ring-2]="selectedIndex() === $index"
            class="tw-w-8 tw-h-8 tw-rounded-sm tw-border tw-border-border"
            [style.background-color]="color"
          >
            <span class="tw-sr-only">Color {{ $index + 1 }}</span>
          </button>
        }
      </div>
    </div>
  `,
})
export class PaletteManagerComponent {
  palette = input.required<string[]>();
  selectedIndex = input.required<number>();
  selectedIndexChange = output<number>();

  selectColor(index: number) {
    this.selectedIndexChange.emit(index);
  }
}
