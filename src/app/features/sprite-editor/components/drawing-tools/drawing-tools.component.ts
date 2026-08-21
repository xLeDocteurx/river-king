import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

export type DrawingTool = 'brush' | 'eraser' | 'fill';

@Component({
  selector: 'rk-drawing-tools',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-flex tw-flex-col tw-gap-2">
      <h3 class="tw-text-sm tw-font-semibold">Tools</h3>
      <div class="tw-flex tw-gap-1">
        <button
          type="button"
          data-testid="tool-brush"
          (click)="selectTool('brush')"
          [class.tw-bg-primary/10]="tool() === 'brush'"
          class="tw-p-2 tw-rounded-md tw-border tw-border-border tw-transition hover:tw-bg-muted"
          title="Brush"
        >
          <span class="material-symbols" aria-hidden="true">brush</span>
        </button>
        <button
          type="button"
          data-testid="tool-eraser"
          (click)="selectTool('eraser')"
          [class.tw-bg-primary/10]="tool() === 'eraser'"
          class="tw-p-2 tw-rounded-md tw-border tw-border-border tw-transition hover:tw-bg-muted"
          title="Eraser"
        >
          <span class="material-symbols" aria-hidden="true">ink_eraser</span>
        </button>
        <button
          type="button"
          data-testid="tool-fill"
          (click)="selectTool('fill')"
          [class.tw-bg-primary/10]="tool() === 'fill'"
          class="tw-p-2 tw-rounded-md tw-border tw-border-border tw-transition hover:tw-bg-muted"
          title="Fill"
        >
          <span class="material-symbols" aria-hidden="true">format_color_fill</span>
        </button>
      </div>
    </div>
  `,
})
export class DrawingToolsComponent {
  tool = input.required<DrawingTool>();
  toolChange = output<DrawingTool>();

  selectTool(selected: DrawingTool) {
    this.toolChange.emit(selected);
  }
}
