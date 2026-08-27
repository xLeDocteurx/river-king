import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { Tile } from '../../../shared/models/tile.model';
import type { Sprite } from '../../../shared/models/sprite.model';

/**
 * Horizontal frame strip showing all frames of the current tile.
 * Allows selecting, adding, deleting, duplicating, and drag-reordering frames.
 */
@Component({
  selector: 'rk-frame-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './frame-strip.component.html',
  styleUrl: './frame-strip.component.scss',
})
export class FrameStripComponent {
  /** The current tile whose frames are displayed. */
  tile = input.required<Tile>();
  /** All sprites for the current tile, ordered by frame index. */
  frames = input.required<Sprite[]>();
  /** ID of the currently selected frame. */
  selectedFrameId = input<number | null>(null);

  /** Emits when a frame is clicked for selection. */
  frameSelect = output<number>();
  /** Emits when the "add frame" button is clicked. */
  addFrame = output<void>();
  /** Emits the ID of a frame to delete. */
  deleteFrame = output<number>();
  /** Emits the ID of a frame to duplicate. */
  duplicateFrame = output<number>();
  /** Emits when play/stop is toggled. */
  togglePlayback = output<void>();
  /** Emits [fromIndex, toIndex] when a frame is drag-reordered. */
  frameReorder = output<[number, number]>();
  /** Whether animation preview is currently playing. */
  playing = input(false);

  /** Index of the frame currently being dragged, or null. */
  private dragIndex: number | null = null;

  /**
   * Handles drag start: records the source index.
   * @param index - Index of the dragged frame.
   * @param event - The native drag event.
   */
  onDragStart(index: number, event: DragEvent): void {
    this.dragIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  /**
   * Handles drag over: allows drop.
   * @param event - The native drag event.
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  /**
   * Handles drop: emits the reorder event if the target differs from the source.
   * @param toIndex - Index where the frame was dropped.
   */
  onDrop(toIndex: number): void {
    if (this.dragIndex !== null && this.dragIndex !== toIndex) {
      this.frameReorder.emit([this.dragIndex, toIndex]);
    }
    this.dragIndex = null;
  }

  /** Clears drag state on drag end. */
  onDragEnd(): void {
    this.dragIndex = null;
  }
}
