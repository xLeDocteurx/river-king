import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { CdkDropListGroup, CdkDropList, CdkDrag, type CdkDragDrop } from '@angular/cdk/drag-drop';
import type { Scene } from '../../shared/models/scene.model';

/**
 * Displays scenes grouped by folderPath with drag-and-drop support.
 * Scenes can be moved between groups via Angular CDK drag-and-drop.
 * Folder creation and scene deletion are delegated to the parent via outputs;
 * persisted folders are provided through the `folders` input.
 */
@Component({
  selector: 'rk-scene-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag],
  templateUrl: './scene-list.component.html',
  styleUrl: './scene-list.component.scss',
})
export class SceneListComponent {
  /** All scenes to display, grouped by folderPath. */
  scenes = input.required<Scene[]>();
  /** Persisted folder paths to display even when they contain no scene. */
  folders = input<string[]>([]);
  /** Id of the currently selected scene. */
  selectedSceneId = input<string | null>(null);
  /** Emitted when a scene is selected. */
  sceneSelect = output<string>();
  /** Emitted when the user requests creation of a new scene. */
  createScene = output<void>();
  /** Emitted when the user requests deletion of a scene (carries its id). */
  sceneDelete = output<string>();
  /** Emitted when a scene is moved to a different folder. */
  sceneFolderChange = output<{ sceneId: string; folderPath: string }>();
  /** Emitted when the user requests creation of a new folder (carries its path). */
  createFolder = output<string>();

  /** Computed grouping of scenes by folderPath, including persisted empty folders. */
  groups = computed<{ folderPath: string; scenes: Scene[] }[]>(() => {
    const map = new Map<string, Scene[]>();
    for (const folder of this.folders()) {
      if (!map.has(folder)) {
        map.set(folder, []);
      }
    }
    for (const scene of this.scenes()) {
      const folder = scene.folderPath || '';
      const arr = map.get(folder) ?? [];
      arr.push(scene);
      map.set(folder, arr);
    }
    return Array.from(map.entries())
      .map(([folderPath, scenes]) => ({ folderPath, scenes }))
      .sort((a, b) => a.folderPath.localeCompare(b.folderPath));
  });

  /**
   * Prompts the user for a group name and emits it for persistence.
   * Emits nothing when the prompt is cancelled or the name already exists.
   */
  onCreateGroup(): void {
    const name = window.prompt('Enter group name:')?.trim();
    if (!name) return;
    if (this.folders().includes(name)) return;
    if (this.scenes().some((s) => s.folderPath === name)) return;
    this.createFolder.emit(name);
  }

  /**
   * Handles a CDK drop event. Emits folderChange when a scene is moved between groups.
   * @param event The CDK drag-drop event.
   * @param targetFolderPath The folder path of the drop target group.
   */
  onDrop(event: CdkDragDrop<Scene[]>, targetFolderPath: string): void {
    if (event.previousContainer === event.container) return;
    const scene = event.item.data as Scene;
    if (scene.folderPath !== targetFolderPath) {
      this.sceneFolderChange.emit({ sceneId: scene.id, folderPath: targetFolderPath });
    }
  }
}
