import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

/** Supported drawing tool identifiers for the sprite canvas. */
export type DrawingTool = 'brush' | 'eraser' | 'fill' | 'anchor';

/**
 * Drawing tools component for selecting the active tool in the sprite editor.
 *
 * Provides buttons for brush, eraser, fill, and anchor tools.
 */
@Component({
  selector: 'rk-drawing-tools',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drawing-tools.component.html',
  styleUrl: './drawing-tools.component.scss',
})
export class DrawingToolsComponent {
  /** Required active drawing tool. */
  tool = input.required<DrawingTool>();

  /** Whether the sprite editor is in collision-mask painting mode. */
  collisionMode = input(false);

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
