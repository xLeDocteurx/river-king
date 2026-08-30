import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { GroupedListComponent } from '../../shared/components/grouped-list/grouped-list.component';
import type { Scene } from '../../shared/models/scene.model';

/**
 * Displays scenes grouped by folderPath with drag-and-drop support.
 * Thin wrapper around {@link GroupedListComponent} for scene-specific binding.
 * The collapsed set is owned by the parent shell; toggles are emitted upwards.
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
  /** Emitted when the user requests deletion of an empty folder. */
  folderDelete = output<string>();
  folderRename = output<{ fromKey: string; toKey: string }>();
  /** Folder paths rendered collapsed. Owned and persisted by the parent shell. */
  collapsedFolders = input<string[]>([]);
  /** Emitted when the user toggles a folder's collapsed state. */
  toggleFolder = output<string>();

  groupByFolderPath = (scene: Scene) => scene.folderPath || '';

  onSceneSelect(id: string | number): void {
    this.sceneSelect.emit(String(id));
  }

  onSceneDelete(id: string | number): void {
    this.sceneDelete.emit(String(id));
  }

  onFolderDelete(key: string): void {
    this.folderDelete.emit(key);
  }

  onSceneFolderChange(event: { itemId: string | number; groupKey: string }): void {
    this.sceneFolderChange.emit({ sceneId: String(event.itemId), folderPath: event.groupKey });
  }

  onToggleGroup(key: string): void {
    this.toggleFolder.emit(key);
  }
}
