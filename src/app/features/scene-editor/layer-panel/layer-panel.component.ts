import { Component, computed, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { Layer } from '../../../shared/models/scene.model';

/**
 * Layer management panel for the scene editor.
 * Displays the layer stack with visibility toggles, opacity sliders,
 * rename-on-double-click, and add/delete/reorder controls.
 */
@Component({
  selector: 'rk-layer-panel',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './layer-panel.component.html',
  styleUrl: './layer-panel.component.scss',
})
export class LayerPanelComponent {
  /** Ordered layers from the scene. */
  layers = input<Layer[]>([]);
  /** Id of the currently active (selected) layer. */
  activeLayerId = input<string | null>(null);
  /** Whether the layer panel is collapsed. */
  collapsed = input(false);

  /** Emits when a layer is selected (clicked). */
  layerSelect = output<string>();
  /** Emits the name for a new layer to add. */
  addLayer = output<string>();
  /** Emits the id of a layer to delete. */
  deleteLayer = output<string>();
  /** Emits the id of a layer whose visibility should be toggled. */
  toggleVisibility = output<string>();
  /** Emits the layer id and new opacity value. */
  opacityChange = output<{ layerId: string; opacity: number }>();
  /** Emits the layer id and new name for rename. */
  rename = output<{ layerId: string; name: string }>();
  /** Emits layer id and direction for reordering. */
  reorder = output<{ layerId: string; direction: 'up' | 'down' }>();
  /** Emits to toggle collapsed state. */
  toggleCollapsed = output<void>();

  /** Layers in display order: topmost layer first. */
  readonly displayLayers = computed(() => [...this.layers()].reverse());

  /** Signal tracking which layer is being renamed (null when not renaming). */
  renamingLayerId = signal<string | null>(null);
  /** Signal holding the current rename value. */
  renameValue = signal('');

  /** Starts rename mode for a layer. */
  startRename(layer: Layer): void {
    this.renamingLayerId.set(layer.id);
    this.renameValue.set(layer.name);
  }

  /** Commits the rename if a valid non-empty name is entered. */
  commitRename(): void {
    const id = this.renamingLayerId();
    const name = this.renameValue().trim();
    if (id && name) {
      this.rename.emit({ layerId: id, name });
    }
    this.renamingLayerId.set(null);
    this.renameValue.set('');
  }

  /** Cancels the rename operation. */
  cancelRename(): void {
    this.renamingLayerId.set(null);
    this.renameValue.set('');
  }
}
