import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import type { Tile } from '../../../shared/models/tile.model';
import type { Sprite } from '../../../shared/models/sprite.model';

/**
 * Horizontal frame strip showing all frames of the current tile.
 * Allows selecting, adding, deleting, and duplicating frames.
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
  /** Whether animation preview is currently playing. */
  playing = input(false);
}
