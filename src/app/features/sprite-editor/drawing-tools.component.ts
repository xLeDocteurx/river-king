import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

export type DrawingTool = 'brush' | 'eraser' | 'fill';

/**
 * Drawing tools component for selecting the active tool in the sprite editor.
 *
 * Provides buttons for brush, eraser, and fill tools.
 */
@Component({
  selector: 'rk-drawing-tools',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drawing-tools.component.html',
  styleUrl: './drawing-tools.component.scss',
})
export class DrawingToolsComponent {
  /** Required currently selected drawing tool. */
  tool = input.required<DrawingTool>();

  /** Emits the newly selected drawing tool. */
  toolChange = output<DrawingTool>();

  /**
   * Selects the specified drawing tool.
   * @param selected - The drawing tool to activate.
   */
  selectTool(selected: DrawingTool) {
    this.toolChange.emit(selected);
  }
}
