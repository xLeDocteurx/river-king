import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { GroupedListComponent } from '../../shared/components/grouped-list/grouped-list.component';
import type { Scene } from '../../shared/models/scene.model';

/**
 * Displays scenes grouped by folderPath with drag-and-drop support.
 * Thin wrapper around {@link GroupedListComponent} for scene-specific binding.
 */
@Component({
  selector: 'rk-scene-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GroupedListComponent],
  templateUrl: './scene-list.component.html',
  styleUrl: './scene-list.component.scss',
})
export class SceneListComponent {
  scenes = input.required<Scene[]>();
  folders = input<string[]>([]);
  selectedSceneId = input<string | null>(null);
  sceneSelect = output<string>();
  createScene = output<void>();
  sceneDelete = output<string>();
  sceneFolderChange = output<{ sceneId: string; folderPath: string }>();
  createFolder = output<string>();
  folderRename = output<{ fromKey: string; toKey: string }>();

  collapsedFolders = signal<string[]>([]);

  groupByFolderPath = (scene: Scene) => scene.folderPath || '';

  onSceneSelect(id: string | number): void {
    this.sceneSelect.emit(String(id));
  }

  onSceneDelete(id: string | number): void {
    this.sceneDelete.emit(String(id));
  }

  onSceneFolderChange(event: { itemId: string | number; groupKey: string }): void {
    this.sceneFolderChange.emit({ sceneId: String(event.itemId), folderPath: event.groupKey });
  }

  onToggleGroup(key: string): void {
    this.collapsedFolders.update((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  }
}
